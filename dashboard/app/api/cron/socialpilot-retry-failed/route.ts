import { supabaseAdmin } from "@/lib/supabase-admin";
import { autoQueueApprovedPost } from "@/lib/socialpilot-queue";
import { logger } from "@/lib/logger";

/**
 * Auto-retry cron for SocialPilot queue failures.
 *
 * Picks up posts where socialpilot_queue_status='failed', their last
 * attempt was at least RETRY_MIN_AGE_MS ago, and they haven't exceeded
 * MAX_RETRIES. Runs autoQueueApprovedPost on each; that function
 * handles all eligibility gating + overlay re-apply + SP queueing.
 *
 * Bounded both ways:
 *   - MAX_RETRIES caps per-post attempts (default 5) so a permanently
 *     broken post doesn't get hammered forever.
 *   - BATCH_LIMIT caps per-tick attempts (default 20) so a backlog
 *     can't blow out the function timeout.
 *   - RETRY_MIN_AGE_MS prevents thrashing — a freshly-failed post
 *     gets a breather before the next attempt (10 min).
 *
 * Schedule (vercel.json): every 2 hours.
 *
 * Gate: Bearer CRON_SECRET, with ?secret= fallback for manual testing.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RETRIES = 5;
const BATCH_LIMIT = 20;
const RETRY_MIN_AGE_MS = 10 * 60_000; // 10 minutes

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const provided =
    (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ??
    url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoffIso = new Date(Date.now() - RETRY_MIN_AGE_MS).toISOString();

  const { data: failed, error } = await supabaseAdmin()
    .from("posts")
    .select(
      "id, socialpilot_retry_count, socialpilot_queued_at, socialpilot_error"
    )
    .eq("socialpilot_queue_status", "failed")
    .lt("socialpilot_retry_count", MAX_RETRIES)
    .lt("socialpilot_queued_at", cutoffIso)
    .order("socialpilot_queued_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    logger.error("cron/socialpilot-retry-failed", "query failed", { err: error });
    return Response.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  type Row = {
    id: string | number;
    socialpilot_retry_count: number;
  };
  const rows = (failed ?? []) as Row[];

  const results: Array<{
    post_id: string | number;
    attempt: number;
    status: string;
    detail?: string;
  }> = [];

  for (const row of rows) {
    try {
      const outcome = await autoQueueApprovedPost(row.id);
      results.push({
        post_id: row.id,
        attempt: (row.socialpilot_retry_count ?? 0) + 1,
        status: outcome.status,
        detail:
          outcome.status === "failed"
            ? outcome.error
            : outcome.status === "skipped"
            ? outcome.reason
            : undefined,
      });
    } catch (err) {
      results.push({
        post_id: row.id,
        attempt: (row.socialpilot_retry_count ?? 0) + 1,
        status: "crashed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const summary = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return Response.json({
    ok: true,
    considered: rows.length,
    summary,
    results,
  });
}
