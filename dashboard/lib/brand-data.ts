/**
 * Per-request memoized brand-scoped queries.
 *
 * React's `cache()` deduplicates by argument-shape within a single
 * render pass. The brand layout fetches posts + brand for the
 * header subtitles; the Designs and Calendar pages need the same
 * rows. Without cache(), both layout and page issue independent
 * Supabase round-trips for the same brand_id. With it, the page
 * receives the layout's response instead of re-fetching.
 *
 * The cache scope is one request — different requests still get
 * fresh data. Don't reach for this on data that needs to be fresh
 * mid-render; it's strictly an in-flight dedup.
 */

import { cache } from "react";
import { supabase } from "@/lib/supabase";

/**
 * All columns any brand-page consumer cares about — superset of the
 * inline queries the Designs and Calendar pages used to write
 * themselves. Consumers project what they actually need.
 */
const POST_COLUMNS =
  "id, post_number, date, day, post_type, content_pillar, concept, visual_direction, caption, status, file_path, updated_at";

export type BrandPost = {
  id: number;
  post_number: number;
  date: string | null;
  day: string | null;
  post_type: string | null;
  content_pillar: string | null;
  concept: string | null;
  visual_direction: string | null;
  caption: string | null;
  status: string;
  file_path: string | null;
  updated_at: string | null;
};

export const getBrandPosts = cache(async (slug: string): Promise<BrandPost[]> => {
  const { data } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("brand_id", slug)
    .order("post_number");
  return (data ?? []) as BrandPost[];
});

export type BrandRow = {
  id: string;
  name: string;
  handle: string | null;
  color_primary: string | null;
  cadence: string | null;
  compliance: string | null;
  platform: string | null;
};

export const getBrand = cache(async (slug: string): Promise<BrandRow | null> => {
  const { data } = await supabase
    .from("brands")
    .select("id, name, handle, color_primary, cadence, compliance, platform")
    .eq("id", slug)
    .single();
  return (data as BrandRow | null) ?? null;
});

/**
 * Tiny count-only fetch for the Assets subtitle in the layout. The
 * Assets page itself uses supabaseAdmin() to read storage_path etc.,
 * which the anon client can't access. So this stays separate — but
 * it's also tiny (single column, single eq filter).
 */
export const getBrandLogoCount = cache(async (slug: string): Promise<number> => {
  const { data } = await supabase
    .from("brand_logos")
    .select("id")
    .eq("brand_id", slug);
  return (data ?? []).length;
});
