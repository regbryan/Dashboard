import "server-only";
import { supabaseAdmin } from "../supabase-admin";

// Generic image-gen prompt builder. Replaces the IEC-hardcoded version.
// Pulls everything from brand_kits (positioning, tone, photography direction,
// colors, content pillars) and brands (legacy colors, compliance) so the
// autopilot's output style is whatever the brand's approved-post history
// already showed us — set by deriveBrandKitForSlug + deriveBrandVisuals.
//
// Per-brand mandatory rules (no auto logos, IEC caption footer, OMG navy
// footer band on image, CSC clean-band) live in brand-rules.ts since they're
// compliance enforced in code regardless of brand_kits state.

import { BRAND_CAPTION_FOOTERS, UNIVERSAL_NEGATIVE_RULES } from "./brand-rules";

export type PromptablePost = {
  concept: string | null;
  visual_direction: string | null;
  content_pillar: string | null;
  post_type: string | null;
};

type BrandRow = {
  id: string;
  name: string;
  platform: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
};

type KitRow = {
  positioning: string | null;
  tagline: string | null;
  photography_direction: string | null;
  tone: Record<string, unknown> | null;
  colors: Record<string, unknown> | null;
  content_pillars: unknown[] | null;
};

const LOGO_TERMS_PATTERN =
  /\b(logo|watermark|brand[\s-]?mark|brand[\s-]?name(?:\s+text)?)\b/i;

export async function buildBrandImagePrompt(
  brandSlug: string,
  post: PromptablePost
): Promise<string | { error: string }> {
  const admin = supabaseAdmin();

  const { data: brandData } = await admin
    .from("brands")
    .select("id, name, platform, color_primary, color_secondary, color_accent")
    .eq("id", brandSlug)
    .maybeSingle();
  if (!brandData) return { error: `brand ${brandSlug} not found` };
  const brand = brandData as BrandRow;

  const { data: kitData } = await admin
    .from("brand_kits")
    .select("positioning, tagline, photography_direction, tone, colors, content_pillars")
    .eq("slug", brandSlug)
    .maybeSingle();
  const kit = (kitData ?? null) as KitRow | null;

  const lines: string[] = [];

  const platform = (brand.platform ?? "instagram").toLowerCase();
  const dimensions =
    platform === "linkedin"
      ? "LinkedIn-friendly square (1:1)"
      : "Instagram square (1:1)";
  lines.push(`${dimensions} post for ${brand.name}.`);

  if (kit?.tagline) lines.push(`Tagline: ${kit.tagline}.`);
  if (kit?.positioning) lines.push(`Brand positioning: ${kit.positioning}`);

  const palette = collectPalette(brand, kit);
  if (palette.length > 0) {
    lines.push(`Brand palette: ${palette.join(", ")}.`);
  }

  const toneKeywords = readToneKeywords(kit?.tone);
  if (toneKeywords.length > 0) {
    lines.push(`Visual mood (from tone): ${toneKeywords.join(", ")}.`);
  }

  if (post.content_pillar) lines.push(`Content pillar: ${post.content_pillar}.`);
  if (post.post_type) lines.push(`Post type: ${post.post_type}.`);
  if (post.concept) lines.push(`Concept: ${post.concept}`);
  if (post.visual_direction) {
    const cleaned = stripLogoMentions(post.visual_direction);
    if (cleaned.length > 0) lines.push(`Visual direction: ${cleaned}`);
  }

  if (kit?.photography_direction) {
    lines.push(`Photography style learned from approved posts: ${kit.photography_direction}`);
  }

  for (const rule of UNIVERSAL_NEGATIVE_RULES) {
    lines.push(rule);
  }

  lines.push(
    "Composition must be visually full and bold — no dead space, no sparse empty backdrops."
  );

  return lines.join(" ");
}

function collectPalette(brand: BrandRow, kit: KitRow | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  function add(label: string, hex: string | null | undefined) {
    if (!hex) return;
    const k = hex.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(`${label} ${hex}`);
  }
  // Prefer brand_kits.colors (derived from real images) over legacy brands.color_*
  if (kit?.colors && typeof kit.colors === "object") {
    const c = kit.colors as Record<string, unknown>;
    if (typeof c.primary === "string") add("primary", c.primary);
    if (typeof c.secondary === "string") add("secondary", c.secondary);
    if (typeof c.accent === "string") add("accent", c.accent);
    const pal = c.palette;
    if (Array.isArray(pal)) {
      let i = 1;
      for (const v of pal) {
        if (typeof v === "string" && !seen.has(v.toLowerCase())) {
          add(`palette#${i}`, v);
          i += 1;
        }
        if (out.length >= 6) break;
      }
    }
  }
  add("primary", brand.color_primary);
  add("secondary", brand.color_secondary);
  add("accent", brand.color_accent);
  return out;
}

function readToneKeywords(tone: Record<string, unknown> | null | undefined): string[] {
  if (!tone) return [];
  const kw = (tone as { keywords?: unknown }).keywords;
  if (Array.isArray(kw)) return kw.filter((k) => typeof k === "string").slice(0, 6) as string[];
  return [];
}

export function stripLogoMentions(visualDirection: string): string {
  const cleaned = visualDirection
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !LOGO_TERMS_PATTERN.test(s))
    .join(" ")
    .trim();
  return cleaned.length > 0 ? cleaned : visualDirection.replace(LOGO_TERMS_PATTERN, "").trim();
}

export function ensureBrandCaptionFooter(
  brandSlug: string,
  caption: string | null
): string {
  const block = BRAND_CAPTION_FOOTERS[brandSlug];
  const base = (caption ?? "").trimEnd();
  if (!block) return base;
  if (block.guard && block.guard.every((token) => base.includes(token))) {
    return base;
  }
  return `${base}\n\n${block.text}`;
}
