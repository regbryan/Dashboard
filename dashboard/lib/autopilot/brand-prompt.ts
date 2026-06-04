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
  archetype: string | null;
  industry: string | null;
  visual_donts: string[] | null;
  colors: Record<string, unknown> | null;
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
    .select("positioning, tagline, tone, archetype, industry, visual_donts, colors")
    .eq("slug", brandSlug)
    .maybeSingle();
  const kit = (kitData ?? null) as KitRow | null;

  // Post type drives whether we treat the brief as a single still or the
  // cover frame of a video. Reel/video storyboards must NOT be rendered as
  // multi-panel collages.
  const { data: postRow } = await admin
    .from("posts")
    .select("post_type")
    .eq("id", postId)
    .maybeSingle();
  const postType = ((postRow as { post_type?: string | null } | null)?.post_type ?? "").toLowerCase();
  const isVideoCover =
    postType.includes("reel") || postType.includes("video") || postType.includes("story");

  const platform = (brand.platform ?? "instagram").toLowerCase();

  // Output dimensions per platform/post type — IG feed 4:5, reels/stories
  // 9:16, LinkedIn 1:1. The brief default is 1:1 AND the brief panel saves that
  // before generating, so we must correct a missing/square aspect even on a
  // saved brief. An explicitly-chosen non-square aspect (4:5/9:16/16:9) is kept.
  const current = briefResult.brief.aspect_ratio;
  if (!current || current === "1:1") {
    briefResult.brief.aspect_ratio = chooseAspectRatio(platform, isVideoCover);
  }

  // The structured envelope sent to Gemini. Plain JSON. Each field is what
  // the user sees and edits in the ImageBriefPanel — plus brand context
  // that's pulled from brand_kit so it stays current automatically.
  const brandColors = readBrandColors(kit?.colors);

  const envelope = {
    platform,
    brand: {
      name: brand.name,
      tagline: kit?.tagline ?? null,
      positioning: kit?.positioning ?? null,
      archetype: kit?.archetype ?? null,
      industry: kit?.industry ?? null,
      voice_keywords: readToneKeywords(kit?.tone),
      colors: brandColors,
    },
    brief: briefResult.brief,
    constraints: {
      aspect_ratio: briefResult.brief.aspect_ratio ?? "1:1",
      no_logo: true,
      no_watermark: true,
      no_footer_band: true,
      no_brand_name_text: true,
      // Hard rule: the model never draws text. All copy is composited later
      // in real fonts via Satori, so the image must be entirely text-free.
      no_text: true,
    },
    negative: [
      ...UNIVERSAL_NEGATIVE_RULES,
      ...(kit?.visual_donts && kit.visual_donts.length > 0
        ? kit.visual_donts.map((d) => `Avoid: ${d}.`)
        : []),
    ],
  };

  // Natural-language framing + JSON body. Image models follow JSON better
  // when they're told it IS a brief, not arbitrary text.
  const frameLine = isVideoCover
    ? `This image is the single COVER frame for a short video. Depict ONE striking, unified moment that captures the concept. Ignore any "reel", "quick-cut", "sequence", or "step-by-step" phrasing in the subject — do NOT split the scene into separate panels, a grid, a storyboard, or before/after frames.`
    : `Render a single cohesive scene. If the subject reads like a sequence of shots or steps, condense it into ONE unified image — not a multi-panel collage — UNLESS the brief's composition explicitly calls for panels or an infographic layout.`;

  const colorLine =
    brandColors.palette.length > 0
      ? `Use the brand palette as the dominant color story${
          brandColors.primary
            ? ` (primary ${brandColors.primary}${
                brandColors.secondary ? `, secondary ${brandColors.secondary}` : ""
              }${brandColors.accent ? `, accent ${brandColors.accent}` : ""})`
            : ` (${brandColors.palette.join(", ")})`
        }. The image must feel unmistakably on-brand.`
      : "";

  // Text rendering is where image models fail (garbled/misspelled words like
  // "therosaot", "for hr optimal"). They CANNOT be trusted to spell — so we
  // never let them draw text at all. Every word on the final image is rendered
  // later in real fonts via Satori (renderPhotoOverlay / renderDesignedCard),
  // driven by the JSON brief. The model's only job is clean, text-free imagery.
  const textLine =
    `TEXT — CRITICAL: Do NOT place ANY text in the image — no headlines, labels, captions, callout boxes, signs, badges, numbers, letters, or lettering of any kind. The image must be completely text-free. All copy is composited later in a separate design step. Do NOT invent or guess at words.`;

  const text = [
    `Generate a high-quality, polished social media image for ${brand.name} based on the JSON brief below.`,
    `Honor every field. Treat the negative constraints as hard rules.`,
    frameLine,
    `Aim for an intentionally designed, on-brand result: one clear focal subject, clean professional composition, balanced and full — no dead space, no sparse empty backdrops, no generic stock-photo clichés.`,
    colorLine,
    textLine,
    "",
    "```json",
    JSON.stringify(envelope, null, 2),
    "```",
  ]
    .filter(Boolean)
    .join("\n");

  return { text, brief: briefResult.brief, briefIsSaved: briefResult.saved };
}

type BrandColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
  palette: string[];
};

/**
 * Normalize brand_kits.colors (shape varies: {primary,secondary,accent,palette}
 * and/or {roles:{...}}) into an explicit color set the image model can use.
 * Previously only colors.roles was read, so brands storing flat primary/
 * secondary/accent (e.g. IEC) passed an empty/null palette and the output
 * ignored the brand colors entirely.
 */
function readBrandColors(colors: Record<string, unknown> | null | undefined): BrandColors {
  const out: BrandColors = { palette: [] };
  if (!colors || typeof colors !== "object") return out;
  const c = colors as Record<string, unknown>;
  const hex = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

  out.primary = hex(c.primary);
  out.secondary = hex(c.secondary);
  out.accent = hex(c.accent);

  const seen = new Set<string>();
  const add = (v: unknown) => {
    const h = hex(v);
    if (h && !seen.has(h.toLowerCase())) {
      seen.add(h.toLowerCase());
      out.palette.push(h);
    }
  };
  add(c.primary);
  add(c.secondary);
  add(c.accent);
  if (Array.isArray(c.palette)) for (const v of c.palette) add(v);
  if (c.roles && typeof c.roles === "object") {
    for (const v of Object.values(c.roles as Record<string, unknown>)) add(v);
  }
  return out.palette.length > 6 ? { ...out, palette: out.palette.slice(0, 6) } : out;
}

function readToneKeywords(tone: Record<string, unknown> | null | undefined): string[] {
  if (!tone) return [];
  const kw = (tone as { keywords?: unknown }).keywords;
  if (!Array.isArray(kw)) return [];
  return kw.filter((k) => typeof k === "string").slice(0, 6) as string[];
}

/**
 * Correct output dimensions per platform/post type:
 *   - Reels / Stories / video covers → 9:16 vertical
 *   - LinkedIn / Facebook feed → 1:1 square
 *   - Instagram / TikTok feed image → 4:5 portrait (IG-recommended)
 */
function chooseAspectRatio(
  platform: string,
  isVideoCover: boolean
): "1:1" | "4:5" | "9:16" {
  if (isVideoCover) return "9:16";
  if (platform === "linkedin" || platform === "facebook") return "1:1";
  return "4:5";
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
