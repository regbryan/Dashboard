import { requireAdmin, handleAuthError, AuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * OAuth callback. SocialPilot redirects here after admin consent with
 * ?code=... + ?state=.... We:
 *   1. verify state matches the cookie we set in /connect (CSRF guard)
 *   2. POST code → access_token + refresh_token at SP's token endpoint
 *   3. persist to the singleton socialpilot_credentials row (upsert id=1)
 *   4. redirect to /dashboard with a success flag
 *
 * Failure modes:
 *   - state mismatch → 400 (CSRF)
 *   - SP token exchange fails → 502 with last_error captured
 *   - admin not signed in → 403 (proxy.ts would 401, but defense-in-depth)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "sp_oauth_state";

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const spError = url.searchParams.get("error");
    if (spError) {
      console.error("[socialpilot/callback] SP returned error", {
        error: spError,
        description: url.searchParams.get("error_description"),
      });
      return redirectToDashboard(req, { sp: "denied" });
    }
    if (!code || !state) {
      throw new AuthError(400, { error: "missing_code_or_state" });
    }

    // CSRF check: state must match the cookie we set in /connect.
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookieState = readCookie(cookieHeader, STATE_COOKIE);
    if (!cookieState || !timingSafeEq(cookieState, state)) {
      throw new AuthError(400, { error: "state_mismatch" });
    }

    const clientId = process.env.SOCIALPILOT_CLIENT_ID;
    const clientSecret = process.env.SOCIALPILOT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new AuthError(503, { error: "socialpilot_not_configured" });
    }

    const dashboardOrigin =
      process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN ||
      new URL(req.url).origin;
    const redirectUri = `${dashboardOrigin}/api/socialpilot/callback`;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://api.socialpilot.co/v1/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => "");
      console.error("[socialpilot/callback] token exchange failed", {
        status: tokenRes.status,
        body: errBody.slice(0, 500),
      });
      throw new AuthError(502, { error: "token_exchange_failed" });
    }

    const tok = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope?: string;
    };

    if (!tok.refresh_token || !tok.access_token) {
      throw new AuthError(502, { error: "token_response_missing_fields" });
    }

    const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
    const now = new Date().toISOString();

    const { error: upsertErr } = await supabaseAdmin()
      .from("socialpilot_credentials")
      .upsert(
        {
          id: 1,
          refresh_token: tok.refresh_token,
          access_token: tok.access_token,
          access_token_expires_at: expiresAt,
          scope: tok.scope ?? null,
          last_refresh_at: now,
          last_error: null,
          updated_at: now,
        },
        { onConflict: "id" }
      );
    if (upsertErr) {
      console.error("[socialpilot/callback] credentials upsert failed", upsertErr);
      throw new AuthError(500, { error: "credentials_persist_failed" });
    }

    // Clear the state cookie; bounce back to the dashboard with a
    // success flag the UI can show as a toast.
    const res = redirectToDashboard(req, { sp: "connected" });
    res.headers.append(
      "set-cookie",
      `${STATE_COOKIE}=; Path=/api/socialpilot; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
    );
    return res;
  } catch (err) {
    const handled = handleAuthError(err);
    if (handled) return handled;
    throw err;
  }
}

function redirectToDashboard(req: Request, params: Record<string, string>): Response {
  const dashboardOrigin =
    process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || new URL(req.url).origin;
  const target = new URL("/dashboard", dashboardOrigin);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return Response.redirect(target.toString(), 302);
}

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}
