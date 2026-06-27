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
import { synthesizeOmegaSpec, buildOmegaDesignPrompt } from "./omega-spec";
import { synthesizeCscSpec, buildCscDesignPrompt } from "./csc-spec";
import { synthesizeBlitzSpec, buildBlitzDesignPrompt } from "./blitz-spec";
import { synthesizeStephanieSpec, buildStephanieDesignPrompt } from "./stephanie-spec";
import { synthesizeRiversideSpec, buildRiversideDesignPrompt } from "./riverside-spec";
import { synthesizeDougSpec, buildDougDesignPrompt } from "./doug-spec";
import { buildScboardwalkSpec, buildScboardwalkPhotoPrompt, renderScboardwalkDesign } from "./render-scboardwalk";

const SATORI_ARCHETYPES = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "I", "QUAD"]);

// The pro image model used for template (archetype) brands. Isolated to this
// path so a model/access issue can't break the generic flow. Override via env.
const ARCHETYPE_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL_PRO || "gemini-3-pro-image-preview";

// ── Omega photo-scene variety ────────────────────────────────────────────
// The old prompt hardcoded "golden-hour / family-or-couple / in a home" on
// EVERY photo, so every photo-hero looked identical. This rotates subjects,
// moments, light, and framing deterministically by post number (reproducible,
// neighbours never alike) and biases toward the concept for seasonal/community
// posts so they stay relevant. The brand voice (warm, real, diverse, navy/cream
// overlay added later) is unchanged — only the photo stops repeating.
const OMEGA_SUBJECTS = [
  "a young first-time-buyer couple",
  "a family with two young children",
  "a single first-time buyer in their thirties",
  "a multigenerational family — grandparents, parents and kids",
  "an older couple downsizing to a smaller home",
  "a parent and their grown child",
  "a pair of close friends buying their first place together",
];
const OMEGA_MOMENTS = [
  "holding a set of new house keys on the front porch",
  "carrying moving boxes into a bright, nearly-empty living room",
  "sharing coffee and easy conversation at a sunlit kitchen table",
  "going over paperwork together at a dining table, relaxed and reassured",
  "hanging a framed picture on the wall of their new home",
  "planting flowers together in the front garden",
  "sitting close on the front steps of their home, talking",
  "unpacking a kitchen box and laughing in a new home",
  "looking out a big window at their new neighbourhood street",
  "raising mugs in a small celebratory toast in a new living room",
];
const OMEGA_LIGHT = [
  "warm golden-hour light",
  "bright, airy midday daylight",
  "soft diffused morning light",
  "cosy evening lamplight",
];
const OMEGA_FRAMING = [
  "a wide environmental shot that shows the room",
  "a natural medium candid",
  "an intimate close-up on hands and faces",
];

function omegaPhotoScene(post: { post_number: number | null; concept: string | null }): string {
  const c = (post.concept ?? "").toLowerCase();
  // Concept-specific scenes keep seasonal / community posts relevant.
  if (/\bfather|\bdad\b/.test(c)) return "a father with his kids on the porch of their family home, a proud tender moment, soft natural light, a natural medium candid";
  if (/\bmother|\bmom\b/.test(c)) return "a mother with her children in the sunlit living room of their home, warm and joyful, soft morning light, a natural medium candid";
  if (/juneteenth/.test(c)) return "a joyful Black family gathered on the porch of their new home, celebrating together, warm golden-hour light, a wide environmental shot";
  if (/\bpride\b/.test(c)) return "a joyful same-sex couple — clearly two women together OR two men together — holding new house keys at the doorway of their first home, warm and genuine, soft daylight, an intimate medium candid";
  if (/veteran|military/.test(c)) return "a veteran and their family in front of their new home, proud and grateful, warm daylight, a wide environmental shot";

  const n = Math.max(0, post.post_number ?? 0);
  const subject = OMEGA_SUBJECTS[(n * 3) % OMEGA_SUBJECTS.length];
  const moment = OMEGA_MOMENTS[(n * 7 + 2) % OMEGA_MOMENTS.length];
  const light = OMEGA_LIGHT[(n * 5 + 1) % OMEGA_LIGHT.length];
  const framing = OMEGA_FRAMING[n % OMEGA_FRAMING.length];
  return `${subject} ${moment}, ${light}, ${framing}`;
}

// The 4 cells of the photo-collage hero (v8_08 "Market Update" silhouette): a
// family moment, a home exterior, a warm detail, and an arrival — diverse, warm,
// summer real-estate. Slightly rotated by post_number so repeat collages vary.
function omegaCollageScenes(post: { post_number: number | null }): string[] {
  const pool = [
    "a joyful, diverse family laughing together on a sunny suburban front porch in summer",
    "a beautiful craftsman-style suburban home exterior with a bright green lawn, blue sky and warm golden-hour light",
    "a welcoming front porch with blooming summer flowers in pots beside the front door",
    "a happy couple stepping through the open front door of their new home holding keys, warm natural light",
    "a young family playing with their kids in the green backyard of their new home",
    "a charming two-story home with a 'SOLD' -free clean front yard and a flowering tree, late afternoon sun",
  ];
  const n = Math.max(0, post.post_number ?? 0);
  // Always lead with a family + a home exterior; fill the rest from the pool.
  // Returns up to 6 distinct scenes (callers slice to 4 or 6).
  return [
    pool[0],
    pool[1],
    pool[(n + 2) % pool.length],
    pool[(n + 3) % pool.length],
    pool[(n + 4) % pool.length],
    pool[(n + 5) % pool.length],
  ];
}

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
  // aspectOverride lets a brand request a different photo aspect than the design
  // canvas (e.g. Omega's photo-hero composites a LANDSCAPE photo into a wide
  // band on a portrait card).
  const genImage = async (
    imgPrompt: string,
    aspectOverride?: "1:1" | "4:5" | "9:16" | "16:9"
  ) => {
    const a = aspectOverride ?? aspect;
    let g = await generateImage({ prompt: imgPrompt, aspectRatio: a, model: ARCHETYPE_IMAGE_MODEL });
    if (!g.ok) {
      console.error(`[archetype] pro model ${ARCHETYPE_IMAGE_MODEL} failed (${g.error}); falling back to gemini-2.5-flash-image`);
      g = await generateImage({ prompt: imgPrompt, aspectRatio: a, model: "gemini-2.5-flash-image" });
    }
    return g;
  };

  try {
    if (template?._engine === "omega") {
      // OMEGA PATH (JSON-CONTRACT → AI FULL-DESIGN): the model draws the ENTIRE
      // post from the brand's STRICT JSON contract. buildOmegaDesignPrompt emits
      // brand-templates/omega.json (exact STRICT_COLOR_CONTRACT + FORBIDDEN colors
      // + GLOBAL_NEGATIVE_PROMPT) with the chosen layout + this post's copy filled
      // in. JSON gives BOTH color control and variety; pickArchetype now deals a
      // different layout to each post so the feed doesn't repeat. (This is the
      // workflow the brand owner uses by hand to get exactly what they want.)
      const s = await synthesizeOmegaSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
        post_number: post.post_number,
        // Operator layout-override (image_brief.design.forceArchetype), e.g. pin
        // a post to the full-bleed photo (B) instead of its position-dealt layout.
        forceArchetype: (design as { forceArchetype?: string | null }).forceArchetype ?? null,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `omega spec: ${s.error}` };
      }
      const ospec = s.spec;
      const omGen = await genImage(buildOmegaDesignPrompt(ospec), "4:5");
      if (!omGen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: omGen.error };
      }
      bytes = omGen.bytes;
      mimeType = omGen.mimeType;
      model = `${omGen.model}+omega-json-${ospec.archetype}`;
    } else if (template?._engine === "csc") {
      // CSC PATH (JSON-CONTRACT → AI FULL-DESIGN): buildCscDesignPrompt emits the
      // strict JSON color contract (exact hexes + forbidden + negative prompt) +
      // chosen layout + copy; the model draws the whole post. JSON controls color;
      // pickArchetype deals a different layout per post so the feed varies.
      const s = await synthesizeCscSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
        post_number: post.post_number,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `csc spec: ${s.error}` };
      }
      const cspec = s.spec;
      const cscGen = await genImage(buildCscDesignPrompt(cspec), "4:5");
      if (!cscGen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: cscGen.error };
      }
      bytes = cscGen.bytes;
      mimeType = cscGen.mimeType;
      model = `${cscGen.model}+csc-json-${cspec.archetype}`;
    } else if (template?._engine === "blitz") {
      // BLITZ PATH: soft, feminine, airy design language (dusty rose + sage +
      // beige, casual script hook + light sans). Only the photo-hero (A) needs
      // a text-free AI photo of an ORGANIZED SPACE (never people); listicle/
      // question/testimonial render fully in code. Logo/wordmark composited later.
      const s = await synthesizeBlitzSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
        post_number: post.post_number,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `blitz spec: ${s.error}` };
      }
      const bspec = s.spec;
      // JSON-CONTRACT → AI FULL-DESIGN: buildBlitzDesignPrompt emits the strict
      // JSON color contract + chosen layout + copy; the model draws the whole post.
      // pickArchetype deals a different layout per post so the feed varies.
      const blitzGen = await genImage(buildBlitzDesignPrompt(bspec), "4:5");
      if (!blitzGen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: blitzGen.error };
      }
      bytes = blitzGen.bytes;
      mimeType = blitzGen.mimeType;
      model = `${blitzGen.model}+blitz-json-${bspec.archetype}`;
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
        post_number: post.post_number,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `stephanie spec: ${s.error}` };
      }
      const stspec = s.spec;
      // JSON-CONTRACT → AI FULL-DESIGN: buildStephanieDesignPrompt emits the strict
      // JSON color contract + chosen layout + copy; the model draws the whole post.
      // pickArchetype deals a different layout per post so the feed varies.
      const stGen = await genImage(buildStephanieDesignPrompt(stspec), "4:5");
      if (!stGen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: stGen.error };
      }
      bytes = stGen.bytes;
      mimeType = stGen.mimeType;
      model = `${stGen.model}+stephanie-json-${stspec.archetype}`;
    } else if (template?._engine === "riverside") {
      // RIVERSIDE PATH: modern-Western design language (warm earthy palette,
      // crafted slab serif + condensed rust labels). Only the product-hero (A)
      // needs a text-free AI photo of a HAT in context (never people); process/
      // drop/customer-feature render fully in code. EST. 2021 logo added later.
      const s = await synthesizeRiversideSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
        post_number: post.post_number,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `riverside spec: ${s.error}` };
      }
      const rvspec = s.spec;
      // JSON-CONTRACT → AI FULL-DESIGN: buildRiversideDesignPrompt emits the strict
      // JSON color contract + chosen layout + copy; the model draws the whole post.
      // pickArchetype deals a different layout per post so the feed varies.
      const rvGen = await genImage(buildRiversideDesignPrompt(rvspec), "4:5");
      if (!rvGen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: rvGen.error };
      }
      bytes = rvGen.bytes;
      mimeType = rvGen.mimeType;
      model = `${rvGen.model}+riverside-json-${rvspec.archetype}`;
    } else if (template?._engine === "doug") {
      // DOUG PATH: quiet corporate LinkedIn thought-leadership (teal + cream-mint,
      // no accent), LANDSCAPE 16:9 to match his reference designs. Photo covers
      // (PHOTO/PANEL/SPLIT/WARSTORY) need a text-free corporate/architectural photo
      // (no people); the rest render fully in code. SCALE LLP wordmark overlaid later.
      const s = await synthesizeDougSpec({
        concept: post.concept,
        content_pillar: post.content_pillar,
        post_type: post.post_type,
        post_number: post.post_number,
      });
      if (!s.ok) {
        await revert();
        return { ok: false, postId: post.id, error: `doug spec: ${s.error}` };
      }
      const dgspec = s.spec;
      // JSON-CONTRACT → AI FULL-DESIGN (LANDSCAPE 16:9): buildDougDesignPrompt
      // emits the strict teal/cream-mint JSON contract + chosen layout + copy +
      // byline; the model draws the whole card. pickArchetype deals a different
      // layout per post and the copy gen varies the headline formula, so the feed
      // no longer reads as one solid-teal text card repeated.
      const dgGen = await genImage(buildDougDesignPrompt(dgspec), "16:9");
      if (!dgGen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: dgGen.error };
      }
      bytes = dgGen.bytes;
      mimeType = dgGen.mimeType;
      model = `${dgGen.model}+doug-json-${dgspec.archetype}`;
    } else if (template?._engine === "scboardwalk") {
      // SC BOARDWALK PATH (HYBRID): code paints the client's blue-band hiring
      // template (header band + apply footer with the EXACT url/handle) and
      // composites a NO-PEOPLE AI photo in the middle — so it always matches the
      // client's layout and can never fabricate a uniform we've never seen.
      const sbSpec = buildScboardwalkSpec(post.concept);
      const sbGen = await genImage(buildScboardwalkPhotoPrompt(sbSpec), "1:1");
      if (!sbGen.ok) {
        await revert();
        return { ok: false, postId: post.id, error: sbGen.error };
      }
      bytes = await renderScboardwalkDesign({
        eyebrow: sbSpec.eyebrow,
        headline: sbSpec.headline,
        detailLine: sbSpec.detailLine,
        photo: sbGen.bytes,
      });
      mimeType = "image/png";
      model = `${sbGen.model}+scboardwalk`;
    } else if (template) {
      // ARCHETYPE PATH (IEC): build the prompt from the locked brand contract.
      let spec = (design.archetypeSpec ?? null) as ArchetypeSpec | null;
      if (!spec) {
        const s = await synthesizeArchetypeSpec(template, {
          concept: post.concept,
          content_pillar: post.content_pillar,
          post_type: post.post_type,
          post_number: post.post_number,
        });
        if (!s.ok) {
          await revert();
          return { ok: false, postId: post.id, error: `spec synthesis: ${s.error}` };
        }
        spec = s.spec;
      }
      specToPersist = spec;

      // IEC HYBRID (exact brand color): archetypes A-J render deterministically
      // full-bleed in code (Satori) — the AI makes ONLY the text-free photo; the
      // navy/red panels, the phone (951.789.3238), and ALL text are drawn in code
      // at exact hex, so the design can never drift off-brand, garble text, or burn
      // the wrong phone number. (buildArchetypePrompt remains for any non-Satori
      // archetype, with the contract's phone/color rules baked in.)
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
