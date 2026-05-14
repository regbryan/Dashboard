import {
  requireAdmin,
  handleAuthError,
  AuthError,
} from "@/lib/api-auth";
import {
  listAccounts,
  isSocialPilotConfigured,
  SocialPilotNotConfiguredError,
  SocialPilotAuthError,
} from "@/lib/socialpilot";

/**
 * Lists the social profiles connected to the agency's SocialPilot
 * account. Used by the per-brand binding dropdown so operators can
 * map each dashboard brand to its SP profile.
 *
 * Admin-only. Returns:
 *   - 200 { accounts: [...] }            normal
 *   - 200 { accounts: [], configured: false }  pre-bootstrap (UI shows
 *                                               "Connect SocialPilot" CTA)
 *   - 502 { error: 'sp_auth_failed' }    refresh token dead → reconnect
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();

    if (!(await isSocialPilotConfigured())) {
      return Response.json({ accounts: [], configured: false });
    }

    const accounts = await listAccounts();
    return Response.json({ accounts, configured: true });
  } catch (err) {
    if (err instanceof SocialPilotNotConfiguredError) {
      return Response.json({ accounts: [], configured: false });
    }
    if (err instanceof SocialPilotAuthError) {
      return Response.json(
        { error: "sp_auth_failed", reconnect_required: true },
        { status: 502 }
      );
    }
    const handled = handleAuthError(err);
    if (handled) return handled;
    if (err instanceof AuthError) {
      return Response.json(err.body, { status: err.status });
    }
    console.error("[socialpilot/accounts] failed", err);
    return Response.json({ error: "list_failed" }, { status: 500 });
  }
}
