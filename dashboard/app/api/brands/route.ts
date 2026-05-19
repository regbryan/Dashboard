import { requireUser, handleAuthError } from "@/lib/api-auth";

import { withRequestContextFromHeaders } from "@/lib/request-context";

export async function GET() {
  return withRequestContextFromHeaders(() => handleGET());
}

async function handleGET() {
  try {
    const ctx = await requireUser();

    // Admins see all brands. Non-admins see only brands they have access to.
    const accessibleIds: string[] | null = ctx.isAdmin
      ? null
      : await ctx.supabase
          .from("user_brand_access")
          .select("brand_id")
          .eq("user_id", ctx.user.id)
          .then(({ data }) => (data || []).map((r: { brand_id: string }) => r.brand_id));

    let brandsQuery = ctx.supabase.from("brands").select("*").order("name");
    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) return Response.json([]);
      brandsQuery = brandsQuery.in("id", accessibleIds);
    }
    const { data: brands } = await brandsQuery;

    let postsQuery = ctx.supabase.from("posts").select("brand_id, status");
    if (accessibleIds !== null) {
      postsQuery = postsQuery.in("brand_id", accessibleIds);
    }
    const { data: posts } = await postsQuery;

    const statsMap: Record<string, Record<string, number>> = {};
    for (const post of posts || []) {
      if (!statsMap[post.brand_id]) {
        statsMap[post.brand_id] = {
          not_started: 0, generating: 0, in_review: 0,
          changes_requested: 0, approved: 0, scheduled: 0, posted: 0, total: 0,
        };
      }
      const s = statsMap[post.brand_id];
      s.total++;
      s[post.status] = (s[post.status] || 0) + 1;
    }

    const result = (brands || []).map((row) => ({
      id: row.id,
      name: row.name,
      handle: row.handle,
      platform: row.platform,
      colorPrimary: row.color_primary ?? null,
      colorSecondary: row.color_secondary ?? null,
      colorAccent: row.color_accent ?? null,
      cadence: row.cadence,
      stats: statsMap[row.id] || {
        not_started: 0, generating: 0, in_review: 0,
        changes_requested: 0, approved: 0, scheduled: 0, posted: 0, total: 0,
      },
    }));

    return Response.json(result);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
