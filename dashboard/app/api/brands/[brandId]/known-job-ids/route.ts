import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { authorizeWorkflow } from "@/lib/workflow-auth";
import { withRequestContext } from "@/lib/request-context";

// GET /api/brands/<brandId>/known-job-ids
// Returns the set of external ATS requisition ids we've ALREADY drafted a
// hiring post for, so the workflow's diff step only creates drafts for NEW
// openings. Machine-auth (WORKFLOW_INGEST_SECRET). Reads the id off each post's
// image_brief.hiring.reqId — the posts table is the dedup source of truth.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(req as Request, () => handleGET(req, { params }));
}

async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  if (!authorizeWorkflow(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { brandId } = await params;

  const { data, error } = await supabaseAdmin()
    .from("posts")
    .select("image_brief")
    .eq("brand_id", brandId);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const ids = Array.from(
    new Set(
      ((data ?? []) as { image_brief: unknown }[])
        .map((r) => {
          const brief = r.image_brief as { hiring?: { reqId?: unknown } } | null;
          const raw = brief?.hiring?.reqId;
          return raw == null ? null : String(raw);
        })
        .filter((v): v is string => !!v)
    )
  );

  return Response.json({ brandId, count: ids.length, ids });
}
