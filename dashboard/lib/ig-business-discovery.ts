import "server-only";

/**
 * Instagram Graph API — Business Discovery client.
 *
 * One agency IG Business account does all competitor lookups. Business
 * Discovery lets any IG Business/Creator account look up any *public*
 * IG Business or Creator account — no relationship with the target
 * needed. So a single token covers competitor research across every
 * brand in the dashboard.
 *
 * Env vars (all required for live mode; absence = no-op):
 *   IG_GRAPH_TOKEN        long-lived access token (60-day, refreshable)
 *   IG_GRAPH_USER_ID      querying account's IG user id
 *   META_GRAPH_VERSION    e.g. "v21.0" (optional, defaults to v21.0)
 *
 * Limits:
 *   - 200 calls/hour per IG account (per Meta)
 *   - Target must be a public Business or Creator account
 *   - Returns an `error` shape on personal/private accounts instead of throwing
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/
 */

export class IgGraphNotConfiguredError extends Error {
  constructor() {
    super(
      "Instagram Graph API not configured — set IG_GRAPH_TOKEN + IG_GRAPH_USER_ID in env",
    );
    this.name = "IgGraphNotConfiguredError";
  }
}

const GRAPH_BASE = "https://graph.facebook.com";
const DEFAULT_VERSION = "v21.0";
// Cap recent-media pull at 12 per call — enough for engagement trend
// signal without burning rate limit on giant carousels.
const MEDIA_LIMIT = 12;

export type CompetitorMedia = {
  caption: string | null;
  like_count: number | null;
  comments_count: number | null;
  timestamp: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | string;
  permalink: string;
};

export type CompetitorProfile = {
  username: string;
  name: string | null;
  biography: string | null;
  followers_count: number;
  follows_count: number | null;
  media_count: number;
  profile_picture_url: string | null;
  website: string | null;
  media: CompetitorMedia[];
  fetched_at: string;
};

export type DiscoverResult =
  | { ok: true; profile: CompetitorProfile }
  | { ok: false; error: string; status?: number };

function getConfig(): { token: string; userId: string; version: string } {
  const token = process.env.IG_GRAPH_TOKEN;
  const userId = process.env.IG_GRAPH_USER_ID;
  if (!token || !userId) throw new IgGraphNotConfiguredError();
  const version = process.env.META_GRAPH_VERSION || DEFAULT_VERSION;
  return { token, userId, version };
}

export function isConfigured(): boolean {
  return !!(process.env.IG_GRAPH_TOKEN && process.env.IG_GRAPH_USER_ID);
}

/**
 * Look up a public IG Business/Creator account by username.
 *
 * Returns `{ ok: false, error }` for: private account, non-business
 * account, account not found, rate-limited, or any other graceful
 * failure. Throws IgGraphNotConfiguredError if env isn't set —
 * callers should catch this and treat it as a skip, not an error.
 */
export async function discoverProfile(
  handle: string,
): Promise<DiscoverResult> {
  const { token, userId, version } = getConfig();
  // Strip leading @ if present — Graph API expects the bare username.
  const username = handle.replace(/^@/, "").trim();
  if (!username) return { ok: false, error: "empty handle" };

  // Field list inside business_discovery follows Meta's nested-field
  // syntax: business_discovery.username(<target>){<fields>}.
  const fields = [
    "username",
    "name",
    "biography",
    "followers_count",
    "follows_count",
    "media_count",
    "profile_picture_url",
    "website",
    `media.limit(${MEDIA_LIMIT}){caption,like_count,comments_count,timestamp,media_type,permalink}`,
  ].join(",");

  const url =
    `${GRAPH_BASE}/${version}/${userId}` +
    `?fields=business_discovery.username(${encodeURIComponent(username)}){${fields}}` +
    `&access_token=${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (err) {
    return {
      ok: false,
      error: `network: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Meta returns 200 with an error envelope for "target isn't a
  // business account" — so we have to look at the response body
  // even when res.ok.
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "non-JSON response", status: res.status };
  }
  type GraphErrorBody = { error?: { message?: string; code?: number } };
  type GraphSuccessBody = {
    business_discovery?: {
      username: string;
      name?: string;
      biography?: string;
      followers_count: number;
      follows_count?: number;
      media_count: number;
      profile_picture_url?: string;
      website?: string;
      media?: { data?: CompetitorMedia[] };
    };
  };
  const errBody = body as GraphErrorBody;
  if (errBody.error) {
    return {
      ok: false,
      error: errBody.error.message ?? "graph error",
      status: res.status,
    };
  }
  const okBody = body as GraphSuccessBody;
  const bd = okBody.business_discovery;
  if (!bd) {
    return {
      ok: false,
      error: "no business_discovery in response (account may not be business/creator)",
      status: res.status,
    };
  }

  return {
    ok: true,
    profile: {
      username: bd.username,
      name: bd.name ?? null,
      biography: bd.biography ?? null,
      followers_count: bd.followers_count,
      follows_count: bd.follows_count ?? null,
      media_count: bd.media_count,
      profile_picture_url: bd.profile_picture_url ?? null,
      website: bd.website ?? null,
      media: bd.media?.data ?? [],
      fetched_at: new Date().toISOString(),
    },
  };
}

/**
 * Refresh a long-lived access token to extend it another ~60 days.
 * Call this monthly via cron so the token never expires unattended.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-login#long-lived-access-tokens
 *
 * Note: this returns the new token; the operator must update the
 * IG_GRAPH_TOKEN env var in Vercel. The cron logs the new token's
 * prefix + expiry so the operator can rotate without waiting for the
 * old one to die.
 */
export type RefreshTokenResult =
  | { ok: true; accessToken: string; expiresIn: number }
  | { ok: false; error: string };

export async function refreshLongLivedToken(): Promise<RefreshTokenResult> {
  const { token, version } = getConfig();
  const url =
    `${GRAPH_BASE}/${version}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(process.env.META_APP_ID ?? "")}` +
    `&client_secret=${encodeURIComponent(process.env.META_APP_SECRET ?? "")}` +
    `&fb_exchange_token=${encodeURIComponent(token)}`;

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return {
      ok: false,
      error:
        "META_APP_ID + META_APP_SECRET required to refresh long-lived token",
    };
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (err) {
    return {
      ok: false,
      error: `network: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  type RefreshBody = {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  const body = (await res.json().catch(() => ({}))) as RefreshBody;
  if (!res.ok || body.error) {
    return {
      ok: false,
      error: body.error?.message ?? `status ${res.status}`,
    };
  }
  if (!body.access_token || typeof body.expires_in !== "number") {
    return { ok: false, error: "missing access_token in refresh response" };
  }
  return {
    ok: true,
    accessToken: body.access_token,
    expiresIn: body.expires_in,
  };
}
