import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { generateImage } from "./gemini";
import { buildBrandImagePrompt, ensureBrandCaptionFooter } from "./brand-prompt";
import { BRAND_CAPTION_FOOTERS } from "./brand-rules";
import type { DesignMode, ImageBrief } from "./brief";
import {
  renderDesignedCard,
  renderPhotoOverlay,
  type DesignColors,
  type DesignFont,
} from "./render-template";
import {
  loadBrandTemplate,
  buildArchetypePrompt,
  type ArchetypeSpec,
} from "./archetype-prompt";
import { synthesizeArchetypeSpec } from "./archetype-spec";

// The pro image model used for template (archetype) brands. Isolated to this
// path so a model/access issue can't break the generic flow. Override via env.
const ARCHETYPE_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL_PRO || "gemini-3-pro-image-preview";

const BUCKET = "post-images";

type PostRow = {
  id: number;
  brand_id: string;
  post_number: number | null;
  date: string | null;
  post_type: string | null;
  content_pillar: string | null;
  concept: string | null;
  caption: string | null;
  visual_direction: string | null;
  file_path: string | null;
  status: string | null;
};

export type GenerateOneResult =
  | { ok: true; postId: number; storagePath: string; model: string; brandSlug: string }
  | { ok: false; postId: number; error: string };

function aspectToSize(aspect: string): { width: number; height: number } {
  switch (aspect) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
      return { width: 1920, height: 1080 };
    default:
      return { width: 1080, height: 1350 }; // 4:5
  }
}

function formatWebsite(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "") || undefined;
}

function parsePhone(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d{3}[.\-\s]?\d{3}[.\-\s]?\d{4})/);
  return m ? m[1] : undefined;
}

/** Brand colors + CTA + display font used by the Satori render. */
async function loadDesignContext(brandId: string): Promise<{
  colors: DesignColors;
  cta: { name?: string; phone?: string; website?: string };
  displayFont: DesignFont;
}> {
  const admin = supabaseAdmin();
  const { data: brand } = await admin
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle();
  const { data: kit } = await admin
    .from("brand_kits")
    .select("colors, website_url, fonts")
    .eq("slug", brandId)
    .maybeSingle();

  const raw = ((kit?.colors ?? {}) as Record<string, unknown>) || {};
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const colors: DesignColors = {
    primary: str(raw.primary),
    secondary: str(raw.secondary),
    accent: str(raw.accent),
    palette: Array.isArray(raw.palette)
      ? (raw.palette.filter((x) => typeof x === "string") as string[])
      : null,
  };

  // Serif (Playfair) for elegant brands; condensed (Oswald) otherwise.
  const fontStr = JSON.stringify((kit as { fonts?: unknown })?.fonts ?? {}).toLowerCase();
  const displayFont: DesignFont =
    fontStr.includes("serif") || fontStr.includes("playfair") || brandId === "omega" || brandId === "stephanie"
      ? "serif"
      : "condensed";

  return {
    colors,
    cta: {
      name: (brand?.name as string | undefined) || undefined,
      phone: parsePhone(BRAND_CAPTION_FOOTERS[brandId]?.text),
      website: formatWebsite(kit?.website_url as string | null | undefined),
    },
    displayFont,
  };
}

/**
 * Generate one post end-to-end for ANY brand. Honors the brief's design mode:
 *   - "ai"    → nano banana photo only (default)
 *   - "card"  → full Satori designed card (real fonts, perfect text, no photo)
 *   - "photo" → nano banana photo + Satori headline/CTA overlay (sharp composite)
 * Then uploads, applies the caption footer, and sets status='in_review'.
 */
export async function generateBrandPost(
  post: PostRow,
  opts: { regenerate?: boolean } = {}
): Promise<GenerateOneResult> {
  const admin = supabaseAdmin();

  // Reels / videos / stories don't get a static design — their deliverable is
  // the video itself (handled separately). Skip them so the design generator
  // and the bulk "Generate designs" action never produce a still for a reel.
  const ptype = (post.post_type ?? "").toLowerCase();
  if (ptype.includes("reel") || ptype.includes("video") || ptype.includes("story")) {
    return {
      ok: false,
      postId: post.id,
      error: "skipped: reels/videos do not get a static design",
    };
  }

  if (!post.concept && !post.visual_direction) {
    return {
      ok: false,
      postId: post.id,
      error: "post has no concept or visual_direction; nothing to generate",
    };
  }

  const promptResult = await buildBrandImagePrompt(post.brand_id, post.id);
  if ("error" in promptResult) {
    return { ok: false, postId: post.id, error: promptResult.error };
  }
  const prompt = promptResult.text;
  const brief = promptResult.brief;
  const design = brief.design ?? {};
  const mode: DesignMode = design.mode ?? "ai";
  const aspect = brief.aspect_ratio ?? "1:1";
  const { width, height } = aspectToSize(aspect);
  const headline = (design.headline || post.concept || "").trim();

  // Template brands (e.g. IEC) generate from their locked archetype contract.
  const template = loadBrandTemplate(post.brand_id);
  let specToPersist: ArchetypeSpec | null = null;

  const previousStatus = post.status ?? "not_started";
  await admin
    .from("posts")
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", post.id);

  const revert = async () => {
    await admin
      .from("posts")
      .update({ status: previousStatus, updated_at: new Date().toISOString() })
      .eq("id", post.id);
  };

  let bytes: Buffer;
  let mimeType: string;
  let model: string;

  try {
    if (template) {
      // ARCHETYPE PATH: build the prompt from the locked brand contract and
      // let the pro image model render the full designed graphic. No logo, no
      // Satori overlay — the contract enforces colors, layout, and hard rules.
      let spec = (design.archetypeSpec ?? null) as ArchetypeSpec | null;
      if (!spec) {
        const s = await synthesizeArchetypeSpec(template, {
          concept: post.concept,
          content_pillar: post.content_pillar,
          post_type: post.post_type,
        });
        if (!s.ok) {
          await revert();
          return { ok: false, postId: post.id, error: `spec synthesis: ${s.error}` };
        }
        spec = s.spec;
      }
      specToPersist = spec;
      const archetypePrompt = buildArchetypePrompt(template, spec, {
        aspectRatio: aspect,
        platform: "Instagram",
      });
      let gen = await generateImage({
        prompt: archetypePrompt,
        aspectRatio: aspect,
        model: ARCHETYPE_IMAGE_MODEL,
      });
      if (!gen.ok) {
        // Pro model unavailable (wrong id / no access / quota). Log it and
        // fall back to the flash image model so the post still generates from
        // the same contract prompt (slightly higher text-garble risk).
        console.error(
          `[archetype] pro model ${ARCHETYPE_IMAGE_MODEL} failed (${gen.error}); falling back to gemini-2.5-flash-image`
        );
        gen = await generateImage({
          prompt: archetypePrompt,
          aspectRatio: aspect,
          model: "gemini-2.5-flash-image",
        });
      }
      if (!gen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: gen.error };
      }
      bytes = gen.bytes;
      mimeType = gen.mimeType;
      model = `${gen.model}+archetype`;
    } else if (mode === "card") {
      const ctx = await loadDesignContext(post.brand_id);
      bytes = await renderDesignedCard({
        width,
        height,
        colors: ctx.colors,
        eyebrow: design.eyebrow ?? post.content_pillar,
        headline,
        rows: design.rows ?? [],
        cta: ctx.cta,
        displayFont: ctx.displayFont,
      });
      mimeType = "image/png";
      model = "satori-card";
    } else {
      const gen = await generateImage({ prompt, aspectRatio: aspect });
      if (!gen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: gen.error };
      }
      if (mode === "photo") {
        const ctx = await loadDesignContext(post.brand_id);
        bytes = await renderPhotoOverlay({
          photo: gen.bytes,
          width,
          height,
          colors: ctx.colors,
          eyebrow: design.eyebrow ?? post.content_pillar,
          headline,
          cta: ctx.cta,
          displayFont: ctx.displayFont,
        });
        mimeType = "image/png";
        model = `${gen.model}+satori-overlay`;
      } else {
        bytes = gen.bytes;
        mimeType = gen.mimeType;
        model = gen.model;
      }
    }
  } catch (err) {
    await revert();
    return {
      ok: false,
      postId: post.id,
      error: `render failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const filePath =
    opts.regenerate || !post.file_path || post.file_path.length === 0
      ? `autopilot/post-${post.post_number ?? post.id}-v${Date.now()}.${ext}`
      : post.file_path;
  const storageKey = `${post.brand_id}/${filePath}`;

  const upload = await admin.storage.from(BUCKET).upload(storageKey, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (upload.error) {
    await revert();
    return {
      ok: false,
      postId: post.id,
      error: `storage upload failed: ${upload.error.message}`,
    };
  }

  const nextCaption = ensureBrandCaptionFooter(post.brand_id, post.caption);

  const updatePayload: Record<string, unknown> = {
    file_path: filePath,
    caption: nextCaption,
    status: "in_review",
    updated_at: new Date().toISOString(),
  };
  // Persist the archetype spec so a future regenerate is reproducible and the
  // operator can edit it in the brief panel.
  if (specToPersist) {
    const nextBrief: ImageBrief = {
      ...brief,
      design: { ...(brief.design ?? {}), archetypeSpec: specToPersist },
    };
    updatePayload.image_brief = nextBrief;
  }

  const { error: updateErr } = await admin
    .from("posts")
    .update(updatePayload)
    .eq("id", post.id);
  if (updateErr) {
    return {
      ok: false,
      postId: post.id,
      error: `posts update failed: ${updateErr.message}`,
    };
  }

  return {
    ok: true,
    postId: post.id,
    storagePath: storageKey,
    brandSlug: post.brand_id,
    model,
  };
}

export type { PostRow as AutopilotPostRow };
