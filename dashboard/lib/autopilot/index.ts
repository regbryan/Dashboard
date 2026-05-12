import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { generateIECPost, type AutopilotPostRow } from "./pipeline";

export type AutopilotRunSummary = {
  brandSlug: string;
  picked: number;
  generated: number;
  failed: number;
  errors: { postId: number; error: string }[];
  successes: { postId: number; storagePath: string }[];
};

const DEFAULT_LOOKAHEAD_DAYS = 2;
// Hard cap per tick so a runaway calendar doesn't drain credits or cross the
// serverless function timeout. Bump deliberately when comfortable.
const MAX_POSTS_PER_TICK = 3;

async function resolveBrandId(slug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("brands")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Run autopilot for IEC: pull every not_started post landing in the next
 * lookaheadDays, generate up to MAX_POSTS_PER_TICK, return a structured
 * summary that the cron route surfaces in its JSON response.
 */
export async function runIECAutopilot(
  opts: { lookaheadDays?: number; limit?: number; dryRun?: boolean } = {}
): Promise<AutopilotRunSummary> {
  const lookahead = opts.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;
  const limit = Math.min(opts.limit ?? MAX_POSTS_PER_TICK, MAX_POSTS_PER_TICK);
  const summary: AutopilotRunSummary = {
    brandSlug: "iec",
    picked: 0,
    generated: 0,
    failed: 0,
    errors: [],
    successes: [],
  };

  const brandId = await resolveBrandId("iec");
  if (!brandId) {
    summary.errors.push({ postId: -1, error: "iec brand row not found" });
    return summary;
  }

  const today = new Date();
  const horizon = new Date(today.getTime() + lookahead * 24 * 60 * 60 * 1000);
  const todayIso = today.toISOString().slice(0, 10);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin()
    .from("posts")
    .select(
      "id, brand_id, post_number, date, post_type, content_pillar, concept, caption, visual_direction, file_path, status"
    )
    .eq("brand_id", brandId)
    .eq("status", "not_started")
    .gte("date", todayIso)
    .lte("date", horizonIso)
    .order("date", { ascending: true })
    .limit(limit);

  if (error) {
    summary.errors.push({ postId: -1, error: `query failed: ${error.message}` });
    return summary;
  }

  const rows = (data ?? []) as AutopilotPostRow[];
  summary.picked = rows.length;

  if (opts.dryRun) return summary;

  for (const row of rows) {
    const result = await generateIECPost(row);
    if (result.ok) {
      summary.generated += 1;
      summary.successes.push({
        postId: result.postId,
        storagePath: result.storagePath,
      });
    } else {
      summary.failed += 1;
      summary.errors.push({ postId: result.postId, error: result.error });
    }
  }

  return summary;
}
