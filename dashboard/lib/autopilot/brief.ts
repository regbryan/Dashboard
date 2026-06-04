import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import type { ArchetypeSpec } from "./archetype-prompt";

// Structured image-generation brief. This is what gets sent to Gemini as
// the JSON portion of the prompt. Stored on posts.image_brief so users
// can edit it before regenerating — no more guessing what the model saw.
//
// Auto-synthesis flow: when posts.image_brief is null, we build a brief
// from posts.concept + posts.visual_direction + brand_kit and return it.
// First time the user opens the panel, they see the auto-synthesized brief,
// can edit, save (PATCH), then click Generate.

// How the final image is produced:
//   "ai"    — nano banana photo only (default, original behavior)
//   "card"  — full Satori designed card (no photo), perfect text
//   "photo" — nano banana photo + Satori headline/CTA overlay composited
export type DesignMode = "ai" | "card" | "photo";
export type DesignRow = { label?: string | null; text: string };
export type PostDesign = {
  mode?: DesignMode;
  eyebrow?: string | null;
  headline?: string | null;
  rows?: DesignRow[];
  // For template brands (e.g. IEC): the chosen archetype + structured copy used
  // to build the contract prompt. Persisted so a regenerate is reproducible and
  // the operator can edit it in the brief panel.
  archetypeSpec?: ArchetypeSpec | null;
};

export type ImageBrief = {
  subject: string;
  composition?: string;
  lighting?: string;
  mood?: string;
  style?: string;
  // Hex codes copied from brand_kit.colors at brief time. Stored so a brief
  // remains reproducible even if the brand kit later changes.
  palette?: string[];
  text_overlay?: string | null;
  aspect_ratio?: "1:1" | "4:5" | "9:16" | "16:9";
  // Free-text notes the human added — preserved verbatim into the prompt.
  notes?: string | null;
  // Designed-graphic spec (Satori render). Defaults to mode "ai" = no change.
  design?: PostDesign;
};

type PostRow = {
  id: number;
  brand_id: string;
  concept: string | null;
  visual_direction: string | null;
  content_pillar: string | null;
  post_type: string | null;
  image_brief: unknown;
};

type KitRow = {
  positioning: string | null;
  tone: Record<string, unknown> | null;
  colors: Record<string, unknown> | null;
  photography_direction: string | null;
  primary_platform: string | null;
};

const LOGO_TERMS_PATTERN =
  /\b(logo|watermark|brand[\s-]?mark|brand[\s-]?name(?:\s+text)?)\b/i;

export async function loadOrSynthesizeBrief(
  postId: number
): Promise<{ ok: true; brief: ImageBrief; saved: boolean } | { ok: false; error: string }> {
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("posts")
    .select(
      "id, brand_id, concept, visual_direction, content_pillar, post_type, image_brief"
    )
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "post not found" };
  const post = data as PostRow;

  // Saved brief wins.
  if (post.image_brief && typeof post.image_brief === "object") {
    return { ok: true, brief: post.image_brief as ImageBrief, saved: true };
  }

  // Auto-synthesize from calendar + brand kit.
  const { data: kitData } = await admin
    .from("brand_kits")
    .select("positioning, tone, colors, photography_direction, primary_platform")
    .eq("slug", post.brand_id)
    .maybeSingle();
  const kit = (kitData ?? null) as KitRow | null;

  const palette = readPalette(kit?.colors);
  const moodKeywords = readMoodKeywords(kit?.tone);

  const subject = post.visual_direction
    ? stripLogoMentions(post.visual_direction)
    : post.concept ?? "";

  // Default output dimensions per platform/post type: IG feed 4:5, reels/
  // stories 9:16, LinkedIn 1:1. The panel shows this default and generation
  // respects it (no longer hardcoded square).
  const ptype = (post.post_type ?? "").toLowerCase();
  const isVideo =
    ptype.includes("reel") || ptype.includes("video") || ptype.includes("story");
  const plat = (kit?.primary_platform ?? "instagram").toLowerCase();
  const defaultAspect: "1:1" | "4:5" | "9:16" = isVideo
    ? "9:16"
    : plat === "linkedin" || plat === "facebook"
      ? "1:1"
      : "4:5";

  const brief: ImageBrief = {
    subject: subject.trim(),
    composition: undefined,
    lighting: undefined,
    mood: moodKeywords.length > 0 ? moodKeywords.join(", ") : undefined,
    style: kit?.photography_direction ?? undefined,
    palette: palette.length > 0 ? palette : undefined,
    // Auto-fill the on-image headline from the post's concept so the operator
    // doesn't retype it. The prompt renders text_overlay verbatim; clear it in
    // the panel for photo-only posts.
    text_overlay: post.concept ? post.concept.trim() : null,
    aspect_ratio: defaultAspect,
    notes: null,
    // Default design = "ai" (no change); headline/eyebrow pre-filled so the
    // operator can flip to a designed card or photo-overlay in one click.
    design: {
      mode: "ai",
      eyebrow: post.content_pillar ?? null,
      headline: post.concept ? post.concept.trim() : null,
      rows: [],
    },
  };

  return { ok: true, brief, saved: false };
}

export async function saveBrief(
  postId: number,
  brief: ImageBrief
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Trim required field; reject empty subject.
  if (!brief.subject || brief.subject.trim().length === 0) {
    return { ok: false, error: "subject is required" };
  }
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("posts")
    .update({ image_brief: brief, updated_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function readPalette(colors: Record<string, unknown> | null | undefined): string[] {
  if (!colors) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  function add(hex: unknown) {
    if (typeof hex !== "string") return;
    const k = hex.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(hex);
  }
  add(colors.primary);
  add(colors.secondary);
  add(colors.accent);
  const pal = colors.palette;
  if (Array.isArray(pal)) for (const v of pal) add(v);
  return out.slice(0, 6);
}

function readMoodKeywords(tone: Record<string, unknown> | null | undefined): string[] {
  if (!tone) return [];
  const kw = (tone as { keywords?: unknown }).keywords;
  if (!Array.isArray(kw)) return [];
  return kw.filter((k) => typeof k === "string").slice(0, 4) as string[];
}

function stripLogoMentions(s: string): string {
  const cleaned = s
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !LOGO_TERMS_PATTERN.test(sentence))
    .join(" ")
    .trim();
  return cleaned.length > 0 ? cleaned : s.replace(LOGO_TERMS_PATTERN, "").trim();
}
