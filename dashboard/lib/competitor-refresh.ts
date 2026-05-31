import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import {
  discoverProfile,
  isConfigured,
  IgGraphNotConfiguredError,
  type DiscoverResult,
} from "@/lib/ig-business-discovery";

/**
 * Per-brand competitor refresh — reads every brand_kits.competitor_handles
 * array, dedupes across brands (one shared cache), and upserts the
 * fresh Business Discovery payload into ig_profile_cache.
 *
 * Skip rules:
 *   - Handle was fetched < FRESH_HOURS ago → skip
 *   - Handle is empty / whitespace → skip
 *   - Graph API returned an error (private / not business) → log + skip,
 *     don't write a stale row
 *
 * Schema (ig_profile_cache):
 *   handle      text  (lowercased, primary key)
 *   payload     jsonb (the full CompetitorProfile)
 *   fetched_at  timestamptz
 *
 * Rate budget: 200 calls/hour per IG account. With ~3 competitors ×
 * 8 brands deduped, a daily refresh costs ~12-24 calls. Daily cadence
 * is fine even with extras.
 */

const FRESH_HOURS = 20; // re-fetch only if older than this

export type RefreshSummary = {
  ok: true;
  skipped?: false;
  attempted: number;
  refreshed: number;
  cached: number;
  errors: { handle: string; error: string }[];
};

export type RefreshSkip = {
  ok: true;
  skipped: true;
  reason: "not_configured";
};

export type RefreshFail = {
  ok: false;
  error: string;
};

export type RefreshResult = RefreshSummary | RefreshSkip | RefreshFail;

export async function refreshAllCompetitors(): Promise<RefreshResult> {
  if (!isConfigured()) {
    return { ok: true, skipped: true, reason: "not_configured" };
  }

  const admin = supabaseAdmin();

  // 1) Pull every brand's competitor_handles. Dedupe + normalize.
  const { data: brandKitsRaw, error: bkErr } = await admin
    .from("brand_kits")
    .select("slug, competitor_handles")
    .not("competitor_handles", "is", null);
  if (bkErr) {
    return { ok: false, error: `brand_kits read: ${bkErr.message}` };
  }
  const brandKits = (brandKitsRaw ?? []) as {
    slug: string;
    competitor_handles: string[] | null;
  }[];
  const wanted = new Set<string>();
  for (const bk of brandKits) {
    for (const h of bk.competitor_handles ?? []) {
      const norm = h.trim().replace(/^@/, "").toLowerCase();
      if (norm) wanted.add(norm);
    }
  }
  if (wanted.size === 0) {
    return { ok: true, attempted: 0, refreshed: 0, cached: 0, errors: [] };
  }

  // 2) Check existing cache freshness — skip handles that don't need refresh.
  const { data: existingRaw } = await admin
    .from("ig_profile_cache")
    .select("handle, fetched_at")
    .in("handle", Array.from(wanted));
  const existing = new Map<string, string>();
  for (const row of (existingRaw ?? []) as { handle: string; fetched_at: string }[]) {
    existing.set(row.handle, row.fetched_at);
  }
  const freshCutoffMs = Date.now() - FRESH_HOURS * 3600 * 1000;
  const toFetch: string[] = [];
  let cached = 0;
  for (const handle of wanted) {
    const lastFetch = existing.get(handle);
    const lastFetchMs = lastFetch ? Date.parse(lastFetch) : 0;
    if (lastFetchMs > freshCutoffMs) {
      cached++;
    } else {
      toFetch.push(handle);
    }
  }

  // 3) For each handle that needs refresh, hit Business Discovery + upsert.
  //    Sequential calls (not parallel) so a rate-limit response can stop
  //    the loop cleanly and we don't burn the whole budget in one burst.
  let refreshed = 0;
  const errors: { handle: string; error: string }[] = [];
  for (const handle of toFetch) {
    let result: DiscoverResult;
    try {
      result = await discoverProfile(handle);
    } catch (err) {
      if (err instanceof IgGraphNotConfiguredError) {
        // Shouldn't happen here (we checked isConfigured above) but
        // belt-and-suspenders.
        return { ok: true, skipped: true, reason: "not_configured" };
      }
      errors.push({
        handle,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    if (!result.ok) {
      errors.push({ handle, error: result.error });
      logger.warn("competitor-refresh", "discover failed", {
        handle,
        error: result.error,
        status: result.status ?? null,
      });
      continue;
    }
    const { error: upErr } = await admin.from("ig_profile_cache").upsert(
      {
        handle,
        payload: result.profile,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "handle" },
    );
    if (upErr) {
      errors.push({ handle, error: `upsert: ${upErr.message}` });
      continue;
    }
    refreshed++;
  }

  return {
    ok: true,
    attempted: toFetch.length,
    refreshed,
    cached,
    errors,
  };
}
