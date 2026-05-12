import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { generateBrandPost, type AutopilotPostRow } from "./pipeline";

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

/**
 * Run autopilot for a specific brand slug. Picks every not_started post
 * landing in the next lookaheadDays for that brand, generates up to
 * MAX_POSTS_PER_TICK, returns a structured summary.
 */
export async function runBrandAutopilot(
  brandSlug: string,
  opts: { lookaheadDays?: number; limit?: number; dryRun?: boolean } = {}
): Promise<AutopilotRunSummary> {
  const lookahead = opts.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;
  const limit = Math.min(opts.limit ?? MAX_POSTS_PER_TICK, MAX_POSTS_PER_TICK);
  const summary: AutopilotRunSummary = {
    brandSlug,
    picked: 0,
    generated: 0,
    failed: 0,
    errors: [],
    successes: [],
  };

  const today = new Date();
  const horizon = new Date(today.getTime() + lookahead * 24 * 60 * 60 * 1000);
  const todayIso = today.toISOString().slice(0, 10);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin()
    .from("posts")
    .select(
      "id, brand_id, post_number, date, post_type, content_pillar, concept, caption, visual_direction, file_path, status"
    )
    .eq("brand_id", brandSlug)
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
    const result = await generateBrandPost(row);
    if (result.ok) {
      summary.generated += 1;
      summary.successes.push({ postId: result.postId, storagePath: result.storagePath });
    } else {
      summary.failed += 1;
      summary.errors.push({ postId: result.postId, error: result.error });
    }
  }

  return summary;
}

/**
 * Run autopilot for every brand in the brands table. Cron uses this so the
 * daily tick covers all brands rather than just IEC.
 */
export async function runAllBrandsAutopilot(
  opts: { lookaheadDays?: number; limitPerBrand?: number; dryRun?: boolean } = {}
): Promise<{ summaries: AutopilotRunSummary[] }> {
  const { data } = await supabaseAdmin().from("brands").select("id");
  const brands = (data ?? []) as { id: string }[];
  const summaries: AutopilotRunSummary[] = [];
  for (const b of brands) {
    summaries.push(
      await runBrandAutopilot(b.id, {
        lookaheadDays: opts.lookaheadDays,
        limit: opts.limitPerBrand,
        dryRun: opts.dryRun,
      })
    );
  }
  return { summaries };
}

// Backwards compatibility for the IEC-only cron call site. Deprecated —
// new callers should use runBrandAutopilot or runAllBrandsAutopilot.
export async function runIECAutopilot(
  opts: { lookaheadDays?: number; limit?: number; dryRun?: boolean } = {}
): Promise<AutopilotRunSummary> {
  return runBrandAutopilot("iec", opts);
}
