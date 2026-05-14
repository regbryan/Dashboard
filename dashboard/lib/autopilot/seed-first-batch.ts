import "server-only";
import { supabaseAdmin } from "../supabase-admin";

/**
 * Create the initial calendar for a brand new brand so they have
 * something to look at the moment they finish onboarding — instead
 * of an empty Designs / Calendar tab until tomorrow's cron run.
 *
 * Inserts ~14 days of posts at the brand's cadence, distributing post
 * types and content pillars sensibly. All rows are
 * status='not_started' so the autopilot cron picks them up on its
 * next tick, or the caller can fire a one-off generation immediately.
 *
 * Idempotent-ish: skips if the brand already has any posts. (Don't
 * want to double-seed if the operator re-triggers this for any reason.)
 */
export type SeedSummary = {
  brandSlug: string;
  skipped: boolean;
  reason?: string;
  postsCreated: number;
  dates: string[];
};

const HORIZON_DAYS = 14;
// Lower bound — if cadence string is unparseable we still seed ~1/wk
// rather than seeding nothing.
const DEFAULT_POSTS_PER_WEEK = 3;

// Visual mix: most brands lean image-heavy, with reels for variety and
// the occasional text post. Numbers are weights (sum doesn't need to
// be 100).
const POST_TYPE_WEIGHTS: Record<"Image" | "Reel" | "Text Post", number> = {
  Image: 6,
  Reel: 3,
  "Text Post": 1,
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function seedFirstBatch(
  brandSlug: string
): Promise<SeedSummary> {
  const admin = supabaseAdmin();

  // Bail if posts already exist for this brand — re-running shouldn't
  // pollute their calendar.
  const { count: existing } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandSlug);
  if ((existing ?? 0) > 0) {
    return {
      brandSlug,
      skipped: true,
      reason: `brand already has ${existing} posts`,
      postsCreated: 0,
      dates: [],
    };
  }

  // Pull cadence + pillars + platform from brand_kits.
  const { data: kitRow } = await admin
    .from("brand_kits")
    .select("primary_platform, content_pillars")
    .eq("slug", brandSlug)
    .maybeSingle();

  const kit = (kitRow ?? {}) as {
    primary_platform?: string | null;
    content_pillars?: unknown[] | null;
  };

  // Also read cadence from brands table (legacy field that's set on
  // onboarding from "3 per week" style strings).
  const { data: brandRow } = await admin
    .from("brands")
    .select("cadence")
    .eq("id", brandSlug)
    .maybeSingle();
  const cadence = ((brandRow ?? {}) as { cadence?: string | null }).cadence;

  const postsPerWeek = parsePostsPerWeek(cadence);
  const pillars = pickPillars(kit.content_pillars);
  const platform = (kit.primary_platform || "instagram").toLowerCase();

  // Plan dates. Spread evenly across the horizon at the target cadence.
  const dates = planDates(postsPerWeek, HORIZON_DAYS);

  // Weighted-random post type picker. Seeded with deterministic counter
  // so the first three posts are spread (Image / Reel / Image) rather
  // than risk three Reels in a row for a small N.
  const typePicker = makeTypePicker(platform);

  // Weighted-random pillar picker by pct.
  const pillarPicker = makePillarPicker(pillars);

  const rows = dates.map((iso, idx) => {
    const d = new Date(`${iso}T12:00:00.000Z`);
    const day = DAY_SHORT[d.getUTCDay()];
    return {
      brand_id: brandSlug,
      post_number: idx + 1,
      date: iso,
      day,
      post_type: typePicker(idx),
      content_pillar: pillarPicker(idx),
      status: "not_started" as const,
    };
  });

  if (rows.length === 0) {
    return {
      brandSlug,
      skipped: true,
      reason: "no dates planned (cadence resolved to 0?)",
      postsCreated: 0,
      dates: [],
    };
  }

  const { error } = await admin.from("posts").insert(rows);
  if (error) {
    return {
      brandSlug,
      skipped: true,
      reason: `insert failed: ${error.message}`,
      postsCreated: 0,
      dates: [],
    };
  }

  return {
    brandSlug,
    skipped: false,
    postsCreated: rows.length,
    dates,
  };
}

// ─── helpers ──────────────────────────────────────────────────────────

/** Parse "3 per week" / "5/wk" / "weekly" / etc. → posts per week. */
function parsePostsPerWeek(input: string | null | undefined): number {
  if (!input) return DEFAULT_POSTS_PER_WEEK;
  const lower = input.toLowerCase().trim();
  if (lower.includes("daily")) return 7;
  if (lower.includes("weekly")) return 1;
  if (lower.includes("twice")) return 2;
  // Find the first integer in the string.
  const match = lower.match(/(\d+)/);
  if (match) {
    const n = parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 14) return n;
  }
  return DEFAULT_POSTS_PER_WEEK;
}

/**
 * Spread N posts/week over the given horizon. Start tomorrow (so the
 * customer's first post date isn't the day they signed up, which feels
 * rushed) and step at the cadence interval.
 */
function planDates(postsPerWeek: number, horizonDays: number): string[] {
  const total = Math.max(
    1,
    Math.round((postsPerWeek / 7) * horizonDays)
  );
  const stepDays = horizonDays / total;
  const dates: string[] = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < total; i++) {
    const d = new Date(start);
    // +1 to skip today; floor so we always land on a whole day.
    d.setUTCDate(d.getUTCDate() + 1 + Math.floor(i * stepDays));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

type PillarPick = { name: string; pct: number };

function pickPillars(raw: unknown[] | null | undefined): PillarPick[] {
  if (!raw || raw.length === 0) {
    // Fallback so we always have something to put in content_pillar.
    return [
      { name: "Educational", pct: 50 },
      { name: "Behind the scenes", pct: 25 },
      { name: "Promotional", pct: 25 },
    ];
  }
  const out: PillarPick[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : null;
    const pct = typeof o.pct === "number" ? o.pct : 0;
    if (name) out.push({ name, pct: Math.max(0, pct) });
  }
  if (out.length === 0) {
    return [{ name: "Educational", pct: 100 }];
  }
  // If every pct is 0, give them equal weight.
  if (out.every((p) => p.pct === 0)) {
    return out.map((p) => ({ ...p, pct: 1 }));
  }
  return out;
}

/**
 * Deterministic weighted picker. Uses cumulative weights and a
 * (idx + small constant) walk so the first few posts spread across
 * the available pillars rather than the picker getting unlucky with
 * RNG on a 5-post sample.
 */
function makePillarPicker(pillars: PillarPick[]): (idx: number) => string {
  const total = pillars.reduce((sum, p) => sum + p.pct, 0);
  const cumulative: number[] = [];
  let acc = 0;
  for (const p of pillars) {
    acc += p.pct;
    cumulative.push(acc / total);
  }
  return (idx: number) => {
    // (idx * golden_ratio_step) mod 1 — gives a well-spread sequence
    // that visits every bucket in roughly the right proportion.
    const t = (idx * 0.6180339887 + 0.13) % 1;
    for (let i = 0; i < cumulative.length; i++) {
      if (t <= cumulative[i]) return pillars[i].name;
    }
    return pillars[pillars.length - 1].name;
  };
}

function makeTypePicker(platform: string): (idx: number) => string {
  // LinkedIn / Facebook → no Reels; bump Image + Text Post.
  // Instagram / TikTok → Reels stay in the mix.
  const weights = { ...POST_TYPE_WEIGHTS };
  if (platform === "linkedin" || platform === "facebook") {
    weights.Reel = 0;
    weights["Text Post"] = 3;
  }
  const entries = Object.entries(weights).filter(([, w]) => w > 0) as Array<
    [keyof typeof POST_TYPE_WEIGHTS, number]
  >;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const cumulative: number[] = [];
  let acc = 0;
  for (const [, w] of entries) {
    acc += w;
    cumulative.push(acc / total);
  }
  return (idx: number) => {
    const t = (idx * 0.3819660113 + 0.07) % 1;
    for (let i = 0; i < cumulative.length; i++) {
      if (t <= cumulative[i]) return entries[i][0];
    }
    return entries[entries.length - 1][0];
  };
}
