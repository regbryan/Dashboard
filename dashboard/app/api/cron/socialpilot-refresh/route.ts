import { getValidAccessToken, SocialPilotNotConfiguredError } from "@/lib/socialpilot";
import { logger } from "@/lib/logger";

/**
 * Hourly token-refresh cron. Keeps the agency access token warm so a
 * client approval that triggers queueing never has to wait on a token
 * refresh (or worse, hit a dead refresh token mid-request).
 *
 * Behavior:
 *   - If SocialPilot isn't configured yet → 200 ok+skipped (not an error)
 *   - If refresh succeeds → 200 ok+refreshed
 *   - If refresh fails (dead refresh token, SP outage) → 500 so Vercel
 *     surfaces the cron failure in the dashboard. last_error is also
 *     written to socialpilot_credentials for the operator banner.
 *
 * Gate: Bearer CRON_SECRET, with ?secret= fallback for manual testing.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  // Match the pattern used by the other crons in this app: a missing
  // CRON_SECRET env is treated as unauthorized (401) rather than a
  // misconfiguration error. Stripe-style 5xx behavior would trip Vercel
  // Cron's retry logic; 401 fails closed without retry storm.
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
    const token = await getValidAccessToken();
    return Response.json({
      ok: true,
      refreshed: true,
      token_prefix: token.slice(0, 6),
    });
  } catch (err) {
    if (err instanceof SocialPilotNotConfiguredError) {
      // No creds yet — totally fine, log and move on. Don't 500.
      return Response.json({
        ok: true,
        skipped: true,
        reason: "not_configured",
      });
    }
    logger.error("cron/socialpilot-refresh", "failed", { err });
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
