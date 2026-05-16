import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/**
 * SocialPilot publishing client.
 *
 * Architecture (per /app-review SocialPilot integration plan):
 *
 *   - One agency SocialPilot account (CC Marketing's). Many brand IG
 *     profiles connected inside it. We hold ONE OAuth refresh token
 *     in the singleton `socialpilot_credentials` row.
 *
 *   - Access tokens are short-lived (24h per their docs). The client
 *     lazy-refreshes on demand using the refresh token (60-day TTL),
 *     and an hourly cron keeps it warm before expiry.
 *
 *   - All calls hit https://api.socialpilot.co/v1/. Bearer auth.
 *
 *   - This module fails LOUDLY if creds aren't provisioned yet
 *     (during dev before the client hands over their Client ID/Secret
 *     and we run the one-time OAuth bootstrap). Callers should
 *     guard with `isSocialPilotConfigured()` if they want to skip
 *     gracefully.
 *
 * Phase 1 (this file): typed surface + lazy refresh wiring + safe
 * pre-creds failure. No production calls yet.
 *
 * Phase 2 (next): /api/socialpilot/connect + callback that populates
 * the singleton row.
 *
 * Phase 4 (later): queueing on client approval.
 */

const BASE_URL = "https://api.socialpilot.co/v1";

// Token refresh ahead of expiry — gives us a 5-minute buffer so we
// don't hand out a token that's about to die mid-request.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000;

// ─── Errors ─────────────────────────────────────────────────────────────

export class SocialPilotNotConfiguredError extends Error {
  constructor() {
    super(
      "SocialPilot is not configured. Run the OAuth bootstrap at " +
        "/api/socialpilot/connect (admin-only) before any client " +
        "approval can auto-queue."
    );
    this.name = "SocialPilotNotConfiguredError";
  }
}

export class SocialPilotAuthError extends Error {
  constructor(public readonly cause: unknown) {
    super(
      "SocialPilot refresh failed. The agency refresh token is dead. " +
        "reconnect via /api/socialpilot/connect."
    );
    this.name = "SocialPilotAuthError";
  }
}

export class SocialPilotApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "SocialPilotApiError";
  }
}

// ─── Types (from the published Ruby wrapper + their docs) ───────────────

export type SocialPilotAccount = {
  id: string;
  name: string;
  type: string; // "instagram" | "facebook" | "linkedin" | "twitter" | ...
  picture?: string;
};

export type QueuePostInput = {
  /** SP profile ID(s) to publish to. Single brand = single account. */
  accountIds: string[];
  /** Caption text. SP applies platform-specific length limits server-side. */
  caption: string;
  /** Public URL to the image. SP downloads it. Must be HTTPS, reachable. */
  imageUrl: string;
  /** When to publish. ISO 8601, must be in the future. */
  scheduledAt: Date;
};

export type QueuePostResult = {
  /** SP's post ID — store on posts.socialpilot_post_id. */
  postId: string;
  /** SP echoes back the scheduled time. */
  scheduledAt: string;
};

// ─── Credentials access (singleton row) ─────────────────────────────────

type CredsRow = {
  id: number;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  scope: string | null;
  refreshed_at: string | null;
  last_error: string | null;
  last_refresh_at: string | null;
};

async function loadCredentials(): Promise<CredsRow> {
  const { data, error } = await supabaseAdmin()
    .from("socialpilot_credentials")
    .select(
      "id, refresh_token, access_token, access_token_expires_at, scope, refreshed_at, last_error, last_refresh_at"
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new SocialPilotApiError(0, error, "creds load failed");
  if (!data || !data.refresh_token) {
    throw new SocialPilotNotConfiguredError();
  }
  return data as CredsRow;
}

/** Cheap check callers can use to short-circuit before calling. */
export async function isSocialPilotConfigured(): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("socialpilot_credentials")
    .select("refresh_token")
    .eq("id", 1)
    .maybeSingle();
  const row = data as { refresh_token?: string | null } | null;
  return !!row?.refresh_token;
}

// ─── Token refresh ──────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  scope?: string;
}> {
  const clientId = process.env.SOCIALPILOT_CLIENT_ID;
  const clientSecret = process.env.SOCIALPILOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SocialPilotNotConfiguredError();
  }

  // OAuth 2.0 standard refresh-token grant. SocialPilot follows the
  // RFC 6749 §6 form. Their token endpoint is documented at
  // developer.socialpilot.co/api/authentication.
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new SocialPilotAuthError({ status: res.status, body: errBody });
  }
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
}

/**
 * Returns a valid access token, refreshing transparently if the cached
 * one is missing or within TOKEN_REFRESH_BUFFER_MS of expiry. Persists
 * the new token + expiry so other invocations can use it.
 */
export async function getValidAccessToken(): Promise<string> {
  const creds = await loadCredentials();

  const now = Date.now();
  const expiresAt = creds.access_token_expires_at
    ? new Date(creds.access_token_expires_at).getTime()
    : 0;

  if (creds.access_token && expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return creds.access_token;
  }

  // Refresh.
  try {
    const tok = await refreshAccessToken(creds.refresh_token!);
    const newExpiresAt = new Date(now + tok.expires_in * 1000).toISOString();
    await supabaseAdmin()
      .from("socialpilot_credentials")
      .update({
        access_token: tok.access_token,
        access_token_expires_at: newExpiresAt,
        scope: tok.scope ?? creds.scope,
        last_refresh_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    return tok.access_token;
  } catch (err) {
    // Persist the failure so the operator UI can show a reconnect prompt.
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin()
      .from("socialpilot_credentials")
      .update({
        last_error: msg,
        last_refresh_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    throw err;
  }
}

// ─── HTTP wrapper ───────────────────────────────────────────────────────

async function spFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getValidAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SocialPilotApiError(
      res.status,
      body,
      `SocialPilot ${init.method ?? "GET"} ${path} failed: ${res.status}`
    );
  }
  return (await res.json()) as T;
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * List all social profiles connected to the agency's SocialPilot account.
 * Used by the brand-binding UI to populate the "SocialPilot account"
 * dropdown.
 */
export async function listAccounts(): Promise<SocialPilotAccount[]> {
  const data = await spFetch<{ accounts?: SocialPilotAccount[] } | SocialPilotAccount[]>(
    "/accounts/list"
  );
  // Their API shape varies by endpoint version; normalize both forms.
  if (Array.isArray(data)) return data;
  return data.accounts ?? [];
}

/**
 * Queue a post with an image to the given SP profile(s) at a scheduled
 * time. Returns the SP post ID for storage on posts.socialpilot_post_id.
 *
 * Phase 4 wires this into the approval handler.
 */
export async function queuePost(
  input: QueuePostInput
): Promise<QueuePostResult> {
  if (input.scheduledAt.getTime() <= Date.now()) {
    throw new SocialPilotApiError(
      400,
      null,
      `scheduledAt must be in the future (got ${input.scheduledAt.toISOString()})`
    );
  }
  const data = await spFetch<{ post_id?: string; id?: string; scheduled_at?: string }>(
    "/post/update_with_image",
    {
      method: "POST",
      body: JSON.stringify({
        accounts: input.accountIds,
        content: input.caption,
        image_url: input.imageUrl,
        scheduled_time: input.scheduledAt.toISOString(),
      }),
    }
  );
  const postId = data.post_id ?? data.id;
  if (!postId) {
    throw new SocialPilotApiError(
      0,
      data,
      "SocialPilot response missing post_id"
    );
  }
  return {
    postId,
    scheduledAt: data.scheduled_at ?? input.scheduledAt.toISOString(),
  };
}
