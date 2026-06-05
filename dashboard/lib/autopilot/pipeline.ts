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
  buildPhotoPrompt,
  type ArchetypeSpec,
} from "./archetype-prompt";
import { synthesizeArchetypeSpec } from "./archetype-spec";
import { renderArchetypeDesign, archetypeNeedsPhoto, type ArchetypeKey } from "./render-archetype";
import { synthesizeOmegaSpec } from "./omega-spec";
import { renderOmegaDesign, omegaArchetypeNeedsPhoto } from "./render-omega";
import { synthesizeCscSpec } from "./csc-spec";
import { renderCscDesign, cscArchetypeNeedsPhoto } from "./render-csc";
import { synthesizeBlitzSpec } from "./blitz-spec";
import { renderBlitzDesign, blitzArchetypeNeedsPhoto } from "./render-blitz";
import { synthesizeStephanieSpec } from "./stephanie-spec";
import { renderStephanieDesign, stephanieArchetypeNeedsPhoto } from "./render-stephanie";
import { synthesizeRiversideSpec } from "./riverside-spec";
import { renderRiversideDesign, riversideArchetypeNeedsPhoto } from "./render-riverside";
import { synthesizeDougSpec } from "./doug-spec";
import { renderDougDesign, dougArchetypeNeedsPhoto } from "./render-doug";

const SATORI_ARCHETYPES = new Set(["A", "C", "D", "E", "F", "G", "H"]);

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

  // Generate an image with the pro model, falling back to flash on failure.
  const genImage = async (imgPrompt: string) => {
    let g = await generateImage({ prompt: imgPrompt, aspectRatio: aspect, model: ARCHETYPE_IMAGE_MODEL });
    if (!g.ok) {
      console.error(`[archetype] pro model ${ARCHETYPE_IMAGE_MODEL} failed (${g.error}); falling back to gemini-2.5-flash-image`);
      g = await generateImage({ prompt: imgPrompt, aspectRatio: aspect, model: "gemini-2.5-flash-image" });
    }
    return g;
  };

  try {
    if (template?._engine === "omega") {
      // OMEGA PATH: its own design language (serif + Allura script, navy/cream,
      // hollow rings, photo-forward). Photo-hero needs a text-free AI photo;
      // list/stat/review render fully in code. No logo / NMLS ever drawn.
      const s = await synthesizeOmegaSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `omega spec: ${s.error}` };
      }
      const ospec = s.spec;
      let omegaPhoto: Buffer | null = null;
      let tag = "omega";
      if (omegaArchetypeNeedsPhoto(ospec.archetype)) {
        const gen = await genImage(
          `A single photorealistic PHOTOGRAPH only — no text, letters, numbers, logos, or watermarks anywhere, edge-to-edge. Scene: ${ospec.photo.description}. Warm golden-hour / window light; real, diverse families or couples in or around a home; magazine quality. Never stock-cheesy or fintech illustration. No stiff posing.`
        );
        if (!gen.ok) {
          await revert();
          return { ok: false, postId: post.id, error: gen.error };
        }
        omegaPhoto = gen.bytes;
        tag = `${gen.model}+omega`;
      }
      bytes = await renderOmegaDesign({
        archetype: ospec.archetype,
        width,
        height,
        eyebrow: ospec.eyebrow,
        headlineLines: ospec.headlineLines,
        body: ospec.body,
        cta: ospec.cta,
        listItems: ospec.listItems,
        bigStat: ospec.bigStat,
        quote: ospec.quote,
        attribution: ospec.attribution,
        photo: omegaPhoto,
      });
      mimeType = "image/png";
      model = `${tag}-${ospec.archetype}`;
    } else if (template?._engine === "csc") {
      // CSC PATH: its own design language (heavy bold sans, sunny yellow +
      // electric blue, FILLED numbered circles, calm-not-alarmist). Only the
      // command-photo (C) needs a text-free AI photo; listicle/big-number/review
      // render fully in code. Logo + CYBERSAFETYCOP.COM are composited on top.
      const s = await synthesizeCscSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `csc spec: ${s.error}` };
      }
      const cspec = s.spec;
      let cscPhoto: Buffer | null = null;
      let tag = "csc";
      if (cscArchetypeNeedsPhoto(cspec.archetype)) {
        const gen = await genImage(
          `A single photorealistic PHOTOGRAPH only — no text, letters, numbers, logos, or watermarks anywhere, edge-to-edge. Scene: ${cspec.photo.description}. Bright, warm, reassuring; a calm parent and child together — NEVER scared, shocked, panicked, or in danger. Natural light, real diverse families, magazine quality. No stock cheese.`
        );
        if (!gen.ok) {
          await revert();
          return { ok: false, postId: post.id, error: gen.error };
        }
        cscPhoto = gen.bytes;
        tag = `${gen.model}+csc`;
      }
      bytes = await renderCscDesign({
        archetype: cspec.archetype,
        width,
        height,
        eyebrow: cspec.eyebrow,
        headline: cspec.headline,
        body: cspec.body,
        cta: cspec.cta,
        listItems: cspec.listItems,
        bigStat: cspec.bigStat,
        quote: cspec.quote,
        attribution: cspec.attribution,
        photo: cscPhoto,
      });
      mimeType = "image/png";
      model = `${tag}-${cspec.archetype}`;
    } else if (template?._engine === "blitz") {
      // BLITZ PATH: soft, feminine, airy design language (dusty rose + sage +
      // beige, casual script hook + light sans). Only the photo-hero (A) needs
      // a text-free AI photo of an ORGANIZED SPACE (never people); listicle/
      // question/testimonial render fully in code. Logo/wordmark composited later.
      const s = await synthesizeBlitzSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `blitz spec: ${s.error}` };
      }
      const bspec = s.spec;
      let blitzPhoto: Buffer | null = null;
      let tag = "blitz";
      if (blitzArchetypeNeedsPhoto(bspec.archetype)) {
        const gen = await genImage(
          `A single photorealistic PHOTOGRAPH only — no text, letters, numbers, logos, or watermarks anywhere, edge-to-edge. Scene: ${bspec.photo.description}. A bright, airy, beautifully ORGANIZED home space — clear bins, labeled jars, matching baskets, everything in its place. Warm natural light, soft pastel/neutral tones, lots of breathing room. ABSOLUTELY NO people, hands, or faces. Magazine quality, never cluttered or moody.`
        );
        if (!gen.ok) {
          await revert();
          return { ok: false, postId: post.id, error: gen.error };
        }
        blitzPhoto = gen.bytes;
        tag = `${gen.model}+blitz`;
      }
      bytes = await renderBlitzDesign({
        archetype: bspec.archetype,
        width,
        height,
        eyebrow: bspec.eyebrow,
        headlineLines: bspec.headlineLines,
        body: bspec.body,
        cta: bspec.cta,
        listItems: bspec.listItems,
        quote: bspec.quote,
        attribution: bspec.attribution,
        photo: blitzPhoto,
      });
      mimeType = "image/png";
      model = `${tag}-${bspec.archetype}`;
    } else if (template?._engine === "stephanie") {
      // STEPHANIE PATH: dusty steel-blue + white serif overlay cards, Allura
      // script personal accent. TEXT-CARD-first (personal brand — real photos
      // can't be fabricated). Only the photo-overlay (A) needs a people-free
      // lifestyle photo; values/quote/testimonial render fully in code. AHL
      // logo / NMLS / DRE / headshot / compliance composited (or manual) later.
      const s = await synthesizeStephanieSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `stephanie spec: ${s.error}` };
      }
      const stspec = s.spec;
      let stephaniePhoto: Buffer | null = null;
      let tag = "stephanie";
      if (stephanieArchetypeNeedsPhoto(stspec.archetype)) {
        const gen = await genImage(
          `A single photorealistic PHOTOGRAPH only — no text, letters, numbers, logos, or watermarks anywhere, edge-to-edge. Scene: ${stspec.photo.description}. A warm, inviting home/lifestyle moment in soft natural light — ABSOLUTELY NO people, faces, or hands. Editorial, magazine quality, calm and feminine. Never corporate stock or dark/moody.`
        );
        if (!gen.ok) {
          await revert();
          return { ok: false, postId: post.id, error: gen.error };
        }
        stephaniePhoto = gen.bytes;
        tag = `${gen.model}+stephanie`;
      }
      bytes = await renderStephanieDesign({
        archetype: stspec.archetype,
        width,
        height,
        eyebrow: stspec.eyebrow,
        headlineLines: stspec.headlineLines,
        body: stspec.body,
        cta: stspec.cta,
        listItems: stspec.listItems,
        quote: stspec.quote,
        attribution: stspec.attribution,
        photo: stephaniePhoto,
      });
      mimeType = "image/png";
      model = `${tag}-${stspec.archetype}`;
    } else if (template?._engine === "riverside") {
      // RIVERSIDE PATH: modern-Western design language (warm earthy palette,
      // crafted slab serif + condensed rust labels). Only the product-hero (A)
      // needs a text-free AI photo of a HAT in context (never people); process/
      // drop/customer-feature render fully in code. EST. 2021 logo added later.
      const s = await synthesizeRiversideSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `riverside spec: ${s.error}` };
      }
      const rvspec = s.spec;
      let riversidePhoto: Buffer | null = null;
      let tag = "riverside";
      if (riversideArchetypeNeedsPhoto(rvspec.archetype)) {
        const gen = await genImage(
          `A single photorealistic PHOTOGRAPH only — no text, letters, numbers, logos, or watermarks anywhere, edge-to-edge. Scene: ${rvspec.photo.description}. A richly-lit Western HAT in context on a rich dark background (dark wood, tooled leather, rope), warm side-light, shallow depth of field. ABSOLUTELY NO people, faces, or hands. Modern Western, never costume. Never floating-product-on-white.`
        );
        if (!gen.ok) {
          await revert();
          return { ok: false, postId: post.id, error: gen.error };
        }
        riversidePhoto = gen.bytes;
        tag = `${gen.model}+riverside`;
      }
      bytes = await renderRiversideDesign({
        archetype: rvspec.archetype,
        width,
        height,
        eyebrow: rvspec.eyebrow,
        headline: rvspec.headline,
        body: rvspec.body,
        cta: rvspec.cta,
        listItems: rvspec.listItems,
        quote: rvspec.quote,
        attribution: rvspec.attribution,
        photo: riversidePhoto,
      });
      mimeType = "image/png";
      model = `${tag}-${rvspec.archetype}`;
    } else if (template?._engine === "doug") {
      // DOUG PATH: quiet corporate LinkedIn title cards (teal + cream-mint, no
      // accent). Square 1:1 by brand convention. Only the photo title-card (C)
      // needs a text-free corporate/architectural photo (no people); title/list/
      // war-story render fully in code. SCALE LLP wordmark composited later.
      const s = await synthesizeDougSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `doug spec: ${s.error}` };
      }
      const dgspec = s.spec;
      let dougPhoto: Buffer | null = null;
      let tag = "doug";
      if (dougArchetypeNeedsPhoto(dgspec.archetype)) {
        const gen = await genImage(
          `A single photorealistic PHOTOGRAPH only — no text, letters, numbers, logos, or watermarks anywhere, edge-to-edge. Scene: ${dgspec.photo.description}. A quiet, corporate, architectural image (glass towers, a city skyline at dusk, an empty boardroom) — ABSOLUTELY NO people, faces, or hands. Restrained and professional. It will sit under a heavy teal overlay.`
        );
        if (!gen.ok) {
          await revert();
          return { ok: false, postId: post.id, error: gen.error };
        }
        dougPhoto = gen.bytes;
        tag = `${gen.model}+doug`;
      }
      // LinkedIn title cards are square — native 1200x1200 (NOT the 4:5 used
      // for the Instagram brands).
      bytes = await renderDougDesign({
        archetype: dgspec.archetype,
        width: 1200,
        height: 1200,
        eyebrow: dgspec.eyebrow,
        headline: dgspec.headline,
        subtitle: dgspec.subtitle,
        listItems: dgspec.listItems,
        quote: dgspec.quote,
        photo: dougPhoto,
      });
      mimeType = "image/png";
      model = `${tag}-${dgspec.archetype}`;
    } else if (template) {
      // ARCHETYPE PATH (IEC): build the prompt from the locked brand contract.
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

      // Archetypes A and C render deterministically full-bleed in code (Satori):
      // the AI makes ONLY a text-free photo; the panel + all text are drawn here,
      // so the design can never frame, garble text, or drift off-brand.
      const letter = spec.archetype.split("_")[0].toUpperCase();
      const satoriArch = (SATORI_ARCHETYPES.has(letter) ? letter : null) as ArchetypeKey | null;

      if (satoriArch) {
        // Code-rendered, full-bleed. A/C need a text-free AI photo; D/E/F/G/H
        // are pure code (no AI image call at all).
        let photo: Buffer | null = null;
        let modelTag = "satori";
        if (archetypeNeedsPhoto(satoriArch)) {
          const gen = await genImage(buildPhotoPrompt(template, spec));
          if (!gen.ok) {
            await revert();
            return { ok: false, postId: post.id, error: gen.error };
          }
          photo = gen.bytes;
          modelTag = `${gen.model}+satori`;
        }
        bytes = await renderArchetypeDesign({
          archetype: satoriArch,
          width,
          height,
          eyebrow: spec.eyebrow,
          headlineLines: spec.headline_lines.map((l) => ({ text: l.text, style: l.style })),
          body: spec.body_copy,
          trust: spec.trust_element,
          cta: spec.cta.text,
          photo,
          listItems: spec.list_items ?? null,
          quote: spec.quote ?? null,
          attribution: spec.attribution ?? null,
          bigStat: spec.big_stat ?? null,
        });
        mimeType = "image/png";
        model = `${modelTag}-${satoriArch}`;
      } else {
        // Other archetypes: the AI renders the whole designed graphic from the
        // full contract prompt (until those archetypes are built in Satori too).
        const gen = await genImage(
          buildArchetypePrompt(template, spec, { aspectRatio: aspect, platform: "Instagram" })
        );
        if (!gen.ok) {
          await revert();
          return { ok: false, postId: post.id, error: gen.error };
        }
        bytes = gen.bytes;
        mimeType = gen.mimeType;
        model = `${gen.model}+archetype`;
      }
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
