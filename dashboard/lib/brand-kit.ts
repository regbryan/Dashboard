import "server-only";
// Use the service-role client so we can read brand_kits regardless of RLS.
// brand_kits has a single is_admin() policy that the anon-key client (used
// elsewhere on the page) can't satisfy — it returned zero rows even when
// data was clearly present in the table. Service role is fine here: this
// function is server-only and the page itself is admin-gated.
import { supabaseAdmin } from "./supabase-admin";

// Loader for everything we'd want to see on the per-brand "Brand Kit" panel.
// Pulls the legacy `brands` row (always populated) and the newer `brand_kits`
// row (currently mostly empty — onboarding flow fills it in), then layers on
// the autopilot rules that are enforced in code regardless of DB state.

export type BrandKitView = {
  brand: BrandRow;
  kit: BrandKitRow | null;
  logoCount: number;
  defaultLogoUrl: string | null;
  rules: AutopilotRule[];
};

export type BrandRow = {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
  cadence: string | null;
  compliance: string | null;
  has_brand_doc: number | null;
};

export type BrandKitRow = {
  positioning: string | null;
  mission: string | null;
  tagline: string | null;
  description: string | null;
  photography_direction: string | null;
  compliance_footer: string | null;
  colors: Record<string, unknown> | null;
  fonts: Record<string, unknown> | null;
  tone: Record<string, unknown> | null;
  content_pillars: unknown[] | null;
  hashtags: Record<string, unknown> | null;
  audiences: unknown[] | null;
  primary_platform: string | null;
  hq_location: string | null;
  service_area: string[] | null;
  onboarding_status: string | null;
  archetype: string | null;
  industry: string | null;
  visual_donts: string[] | null;
  website_url: string | null;
};

export type AutopilotRule = {
  label: string;
  detail: string;
  source: "universal" | "brand";
};

const UNIVERSAL_RULES: AutopilotRule[] = [
  {
    label: "No automated logos",
    detail:
      "Generation pipeline never paints a logo. Client composites manually after.",
    source: "universal",
  },
  {
    label: "No image-burned footer",
    detail:
      "Compliance text is appended to the caption, not painted onto the image (except where the brand explicitly requires it — e.g. OMG navy footer).",
    source: "universal",
  },
];

const BRAND_RULES: Record<string, AutopilotRule[]> = {
  iec: [
    {
      label: "Caption footer required",
      detail:
        "Every IEC IG caption must end with #InlandEmpireComfort + License No.: 1053697 + 📞: 951.789.3238 — enforced by autopilot.",
      source: "brand",
    },
  ],
  omega: [
    {
      label: "Navy footer band on image",
      detail:
        "Full disclosure compliance text painted into a navy footer band on every image (incl. each carousel slide).",
      source: "brand",
    },
  ],
  csc: [
    {
      label: "Logo overlay clean-band",
      detail:
        "overlay_logo.py runs with --clean-band to erase nanobanana's ghost logo before compositing the real one.",
      source: "brand",
    },
  ],
};

export async function loadBrandKit(slug: string): Promise<BrandKitView | null> {
  const { data: brand } = await supabaseAdmin()
    .from("brands")
    .select(
      "id, name, handle, platform, color_primary, color_secondary, color_accent, cadence, compliance, has_brand_doc"
    )
    .eq("id", slug)
    .maybeSingle();

  if (!brand) return null;

  const { data: kit } = await supabaseAdmin()
    .from("brand_kits")
    .select(
      "positioning, mission, tagline, description, photography_direction, compliance_footer, colors, fonts, tone, content_pillars, hashtags, audiences, primary_platform, hq_location, service_area, onboarding_status, archetype, industry, visual_donts, website_url"
    )
    .eq("slug", slug)
    .maybeSingle();

  const { count: logoCount } = await supabaseAdmin()
    .from("brand_logos")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", slug);

  // Pull the default logo for the hero. Prefer is_default=true, fall
  // back to the first row alphabetically by label.
  const { data: defaultLogoRow } = await supabaseAdmin()
    .from("brand_logos")
    .select("storage_path")
    .eq("brand_id", slug)
    .order("is_default", { ascending: false })
    .order("label", { ascending: true })
    .limit(1)
    .maybeSingle();

  const defaultLogoUrl = buildLogoUrl(
    (defaultLogoRow as { storage_path?: string | null } | null)?.storage_path ?? null
  );

  const rules: AutopilotRule[] = [
    ...UNIVERSAL_RULES,
    ...(BRAND_RULES[slug] ?? []),
  ];

  return {
    brand: brand as BrandRow,
    kit: (kit ?? null) as BrandKitRow | null,
    logoCount: logoCount ?? 0,
    defaultLogoUrl,
    rules,
  };
}

/**
 * Build a public URL for a brand_logos.storage_path. The path already
 * includes the full key inside the post-images bucket (e.g.
 * "logos/blitz/4C.png"). Each segment is URI-encoded so filenames
 * with spaces or `&` resolve correctly.
 */
function buildLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/post-images/${encoded}`;
}
