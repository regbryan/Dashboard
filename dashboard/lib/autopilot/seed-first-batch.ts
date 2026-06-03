import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import {
  dayShortFor,
  makePillarPicker,
  makeTypePicker,
  parsePostsPerWeek,
  pickPillars,
  planHorizonDates,
} from "./calendar-plan";

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
  const dates = planHorizonDates(postsPerWeek, HORIZON_DAYS, new Date());

  const typePicker = makeTypePicker(platform);
  const pillarPicker = makePillarPicker(pillars);

  const now = new Date().toISOString();
  const rows = dates.map((iso, idx) => ({
    brand_id: brandSlug,
    post_number: idx + 1,
    date: iso,
    day: dayShortFor(iso),
    post_type: typePicker(idx),
    content_pillar: pillarPicker(idx),
    status: "not_started" as const,
    created_at: now,
    updated_at: now,
  }));

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
