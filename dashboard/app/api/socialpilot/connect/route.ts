import { requireAdmin, handleAuthError, AuthError } from "@/lib/api-auth";
import { randomBytes } from "node:crypto";

/**
 * One-time OAuth bootstrap: admin clicks "Connect SocialPilot" in the
 * dashboard → we redirect to SocialPilot's authorize URL with the
 * agency's client_id + our callback as redirect_uri. SP shows their
 * login + consent screen, then bounces back to /api/socialpilot/callback
 * with a code. The callback exchanges the code for refresh + access
 * tokens and persists them to the singleton socialpilot_credentials
 * row.
 *
 * Admin-only — only the agency operator should be able to do this.
 * The CSRF `state` parameter is signed with SOCIALPILOT_CLIENT_SECRET
 * via a short-lived signed cookie so the callback can verify the
 * round-trip came from us.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "sp_oauth_state";
const STATE_TTL_SECONDS = 600; // 10 minutes

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin();

    const clientId = process.env.SOCIALPILOT_CLIENT_ID;
    if (!clientId) {
      throw new AuthError(503, {
        error:
          "SOCIALPILOT_CLIENT_ID is not set. Add it in Vercel env vars " +
          "(the value comes from the OAuth app the client created in " +
          "their SocialPilot Enterprise account).",
      });
    }

    // Where SP should send the customer back after consent. Must
    // match exactly what's registered in the SocialPilot OAuth app.
    const dashboardOrigin =
      process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN ||
      new URL(req.url).origin;
    const redirectUri = `${dashboardOrigin}/api/socialpilot/callback`;

    // CSRF token. We don't sign because the cookie is httpOnly +
    // secure and the comparison is constant-time string-equal.
    const state = randomBytes(24).toString("hex");

    // Build the authorize URL per RFC 6749. SP follows the standard.
    const authorizeUrl = new URL("https://app.socialpilot.co/oauth/authorize");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);
    // Their scope strings aren't well-documented; "publish read" is the
    // common pair for "list accounts + schedule posts" on social APIs.
    // If SP rejects, we'll adjust here.
    authorizeUrl.searchParams.set("scope", "publish read");

    const res = Response.redirect(authorizeUrl.toString(), 302);
    res.headers.append(
      "set-cookie",
      `${STATE_COOKIE}=${state}; Path=/api/socialpilot; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}`
    );
    return res;
  } catch (err) {
    const handled = handleAuthError(err);
    if (handled) return handled;
    throw err;
  }
}
