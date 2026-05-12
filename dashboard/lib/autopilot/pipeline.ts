import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { generateImage } from "./gemini";
import { buildBrandImagePrompt, ensureBrandCaptionFooter } from "./brand-prompt";

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

/**
 * Generate one post end-to-end for ANY brand:
 *   1. build prompt via the generic builder (reads brand_kits + brands)
 *   2. call Gemini -> image bytes
 *   3. upload to post-images bucket
 *   4. ensure the brand's mandatory caption footer (if any) is present
 *   5. set status='in_review' so it appears in the dashboard approval queue
 *
 * Logo overlay and image-burned footer compliance are NOT applied here —
 * those are post-processing steps the user runs manually (or via a future
 * per-brand chain). The universal "no automated logos" rule is enforced in
 * the prompt itself.
 *
 * `regenerate=true` allows the caller to overwrite an image even if the
 * post already has a file_path — needed for the manual regenerate button.
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

  const promptResult = await buildBrandImagePrompt(post.brand_id, {
    concept: post.concept,
    visual_direction: post.visual_direction,
    content_pillar: post.content_pillar,
    post_type: post.post_type,
  });
  if (typeof promptResult !== "string") {
    return { ok: false, postId: post.id, error: promptResult.error };
  }
  const prompt = promptResult;

  const previousStatus = post.status ?? "not_started";
  await admin
    .from("posts")
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", post.id);

  const gen = await generateImage({ prompt, aspectRatio: "1:1" });
  if (!gen.ok) {
    await admin
      .from("posts")
      .update({
        status: previousStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    return { ok: false, postId: post.id, error: gen.error };
  }

  const ext = gen.mimeType === "image/jpeg" ? "jpg" : "png";
  const filePath =
    opts.regenerate || !post.file_path || post.file_path.length === 0
      ? `autopilot/post-${post.post_number ?? post.id}-v${Date.now()}.${ext}`
      : post.file_path;
  const storageKey = `${post.brand_id}/${filePath}`;

  const upload = await admin.storage
    .from(BUCKET)
    .upload(storageKey, gen.bytes, {
      contentType: gen.mimeType,
      upsert: true,
    });
  if (upload.error) {
    await admin
      .from("posts")
      .update({
        status: previousStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
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
    model: gen.model,
  };
}

// Backwards-compatible alias — older callers can keep using this name.
export const generateIECPost = generateBrandPost;

export type { PostRow as AutopilotPostRow };
export const AUTOPILOT_BUCKET = BUCKET;
