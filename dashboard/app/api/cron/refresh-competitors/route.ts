import { withRequestContext } from "@/lib/request-context";
import { logger } from "@/lib/logger";
import { refreshAllCompetitors } from "@/lib/competitor-refresh";

/**
 * Daily competitor-cache refresh via IG Graph API Business Discovery.
 *
 * Behavior:
 *   - If IG Graph isn't configured (no IG_GRAPH_TOKEN) → 200 ok+skipped.
 *     This lets the cron sit dormant until the operator wires the
 *     Meta app + token. Same pattern as the SocialPilot cron.
 *   - Refreshes any handle in brand_kits.competitor_handles whose
 *     cache row is older than 20 hours.
 *   - Returns a summary { attempted, refreshed, cached, errors }.
 *
 * Gate: Bearer CRON_SECRET, with ?secret= fallback for manual testing.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  return withRequestContext(req as Request, () => handleGET(req));
}

async function handleGET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const provided =
    (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ??
    url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllCompetitors();
    if (!result.ok) {
      logger.error("cron/refresh-competitors", "failed", {
        error: result.error,
      });
      return Response.json(result, { status: 500 });
    }
    if (result.skipped) {
      logger.info("cron/refresh-competitors", "skipped", {
        reason: result.reason,
      });
      return Response.json(result);
    }
    logger.info("cron/refresh-competitors", "refreshed", {
      attempted: result.attempted,
      refreshed: result.refreshed,
      cached: result.cached,
      errorCount: result.errors.length,
    });
    return Response.json(result);
  } catch (err) {
    logger.error("cron/refresh-competitors", "threw", { err });
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
