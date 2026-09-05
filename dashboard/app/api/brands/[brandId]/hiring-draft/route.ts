import type { NextRequest } from "next/server";
import { authorizeWorkflow } from "@/lib/workflow-auth";
import { withRequestContext } from "@/lib/request-context";
import { createHiringDraft, type HiringJob } from "@/lib/hiring-draft";

// POST /api/brands/<brandId>/hiring-draft
// Called by the Dify workflow for each NEW open position it scrapes. Renders the
// SC Boardwalk "blue bands, no photo" card (operator adds the real photo at
// approval), stores it, and inserts an in_review post. Idempotent on the ATS
// requisition id. Machine-auth via WORKFLOW_INGEST_SECRET.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(req as Request, () => handlePOST(req, { params }));
}

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  if (!authorizeWorkflow(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { brandId } = await params;

  let body: HiringJob;
  try {
    body = (await req.json()) as HiringJob;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const result = await createHiringDraft(brandId, body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result);
}
