import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { loadOrSynthesizeBrief, type ImageBrief } from "./brief";
import { BRAND_CAPTION_FOOTERS, UNIVERSAL_NEGATIVE_RULES } from "./brand-rules";

// Builds the Gemini image-gen input from a structured JSON brief layered on
// top of the brand kit. Everything the model sees is inspectable here —
// no hidden context, no inferred fields. If posts.image_brief is set, that
// brief is used verbatim. Otherwise it's synthesized on the fly from
// concept + visual_direction + brand kit.

type BrandRow = {
  id: string;
  name: string;
  platform: string | null;
};

type KitRow = {
  positioning: string | null;
  tagline: string | null;
  tone: Record<string, unknown> | null;
};

export type BuiltPrompt = {
  text: string;
  brief: ImageBrief;
  briefIsSaved: boolean;
};

export async function buildBrandImagePrompt(
  brandSlug: string,
  postId: number
): Promise<BuiltPrompt | { error: string }> {
  const admin = supabaseAdmin();

  const briefResult = await loadOrSynthesizeBrief(postId);
  if (!briefResult.ok) return { error: briefResult.error };

  const { data: brandData } = await admin
    .from("brands")
    .select("id, name, platform")
    .eq("id", brandSlug)
    .maybeSingle();
  if (!brandData) return { error: `brand ${brandSlug} not found` };
  const brand = brandData as BrandRow;

  const { data: kitData } = await admin
    .from("brand_kits")
    .select("positioning, tagline, tone")
    .eq("slug", brandSlug)
    .maybeSingle();
  const kit = (kitData ?? null) as KitRow | null;

  const platform = (brand.platform ?? "instagram").toLowerCase();

  // The structured envelope sent to Gemini. Plain JSON. Each field is what
  // the user sees and edits in the ImageBriefPanel — plus brand context
  // that's pulled from brand_kit so it stays current automatically.
  const envelope = {
    platform,
    brand: {
      name: brand.name,
      tagline: kit?.tagline ?? null,
      positioning: kit?.positioning ?? null,
      voice_keywords: readToneKeywords(kit?.tone),
    },
    brief: briefResult.brief,
    constraints: {
      aspect_ratio: briefResult.brief.aspect_ratio ?? "1:1",
      no_logo: true,
      no_watermark: true,
      no_footer_band: true,
      no_brand_name_text: true,
    },
    negative: UNIVERSAL_NEGATIVE_RULES,
  };

  // Natural-language framing + JSON body. Image models follow JSON better
  // when they're told it IS a brief, not arbitrary text.
  const text = [
    `Generate a high-quality social media image for ${brand.name} based on the JSON brief below.`,
    `Honor every field. Treat the negative constraints as hard rules.`,
    `Composition must be visually full and bold — no dead space, no sparse empty backdrops.`,
    "",
    "```json",
    JSON.stringify(envelope, null, 2),
    "```",
  ].join("\n");

  return { text, brief: briefResult.brief, briefIsSaved: briefResult.saved };
}

function readToneKeywords(tone: Record<string, unknown> | null | undefined): string[] {
  if (!tone) return [];
  const kw = (tone as { keywords?: unknown }).keywords;
  if (!Array.isArray(kw)) return [];
  return kw.filter((k) => typeof k === "string").slice(0, 6) as string[];
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
