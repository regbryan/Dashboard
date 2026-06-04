import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { generateImage } from "./gemini";
import { buildBrandImagePrompt, ensureBrandCaptionFooter } from "./brand-prompt";
import { BRAND_CAPTION_FOOTERS } from "./brand-rules";
import type { DesignMode } from "./brief";
import {
  renderDesignedCard,
  renderPhotoOverlay,
  type DesignColors,
} from "./render-template";

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

/** Brand colors + CTA used by the Satori designed/overlay render. */
async function loadDesignContext(
  brandId: string
): Promise<{ colors: DesignColors; cta: { name?: string; phone?: string; website?: string } }> {
  const admin = supabaseAdmin();
  const { data: brand } = await admin
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle();
  const { data: kit } = await admin
    .from("brand_kits")
    .select("colors, website_url")
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
  return {
    colors,
    cta: {
      name: (brand?.name as string | undefined) || undefined,
      phone: parsePhone(BRAND_CAPTION_FOOTERS[brandId]?.text),
      website: formatWebsite(kit?.website_url as string | null | undefined),
    },
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
    if (mode === "card") {
      const ctx = await loadDesignContext(post.brand_id);
      bytes = await renderDesignedCard({
        width,
        height,
        colors: ctx.colors,
        eyebrow: design.eyebrow ?? post.content_pillar,
        headline,
        rows: design.rows ?? [],
        cta: ctx.cta,
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

  const { error: updateErr } = await admin
    .from("posts")
    .update({
      file_path: filePath,
      caption: nextCaption,
      status: "in_review",
      updated_at: new Date().toISOString(),
    })
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
