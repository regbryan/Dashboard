import type { NextRequest } from "next/server";
import {
  requireBrandAccess,
  requirePostAccess,
  handleAuthError,
} from "@/lib/api-auth";

const PROTECTED_STATUSES = ["approved", "posted", "scheduled"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      brandId?: string;
      postId?: string;
    } | null;

    if (!body || (!body.brandId && !body.postId)) {
      return Response.json(
        { error: "brandId or postId required" },
        { status: 400 }
      );
    }

    if (body.postId) {
      const { ctx, brandId } = await requirePostAccess(body.postId);
      const { data, error } = await ctx.supabase
        .from("posts")
        .update({ status: "in_review", updated_at: new Date().toISOString() })
        .eq("id", body.postId)
        .not("status", "in", `(${PROTECTED_STATUSES.join(",")})`)
        .select("id");
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ ok: true, brandId, updated: data?.length ?? 0 });
    }

    const ctx = await requireBrandAccess(body.brandId!);
    const { data, error } = await ctx.supabase
      .from("posts")
      .update({ status: "in_review", updated_at: new Date().toISOString() })
      .eq("brand_id", body.brandId)
      .not("status", "in", `(${PROTECTED_STATUSES.join(",")})`)
      .select("id");
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, updated: data?.length ?? 0 });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
