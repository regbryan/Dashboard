import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .order("name");

  const { data: posts } = await supabase
    .from("posts")
    .select("brand_id, status");

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
}
