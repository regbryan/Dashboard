import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import { generateImage } from "./gemini";
import { buildIECImagePrompt, ensureIECCaptionFooter } from "./iec";

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
  | { ok: true; postId: number; storagePath: string; model: string }
  | { ok: false; postId: number; error: string };

/**
 * Generate one IEC post end-to-end:
 *   1. build prompt from posts.concept + visual_direction
 *   2. call Gemini -> image bytes
 *   3. upload to post-images bucket
 *   4. ensure caption has the mandatory IEC footer block
 *   5. set status='in_review' so it appears in the dashboard approval queue
 *
 * No logo and no image-burned footer — both are IEC-specific rules
 * (universal "no automated logos"; IEC compliance lives in caption).
 */
export async function generateIECPost(
  post: PostRow
): Promise<GenerateOneResult> {
  const admin = supabaseAdmin();

  if (!post.concept && !post.visual_direction) {
    return {
      ok: false,
      postId: post.id,
      error: "post has no concept or visual_direction; nothing to generate",
    };
  }

  const prompt = buildIECImagePrompt({
    concept: post.concept,
    visualDirection: post.visual_direction,
    contentPillar: post.content_pillar,
    postType: post.post_type,
  });

  // Mark generating so concurrent ticks don't double-pick this row.
  await admin
    .from("posts")
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("id", post.id);

  const gen = await generateImage({ prompt, aspectRatio: "1:1" });
  if (!gen.ok) {
    await admin
      .from("posts")
      .update({
        status: "not_started",
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    return { ok: false, postId: post.id, error: gen.error };
  }

  const ext = gen.mimeType === "image/jpeg" ? "jpg" : "png";
  const filePath =
    post.file_path && post.file_path.length > 0
      ? post.file_path
      : `autopilot/post-${post.post_number ?? post.id}-v1.${ext}`;
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
        status: "not_started",
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    return {
      ok: false,
      postId: post.id,
      error: `storage upload failed: ${upload.error.message}`,
    };
  }

  const nextCaption = ensureIECCaptionFooter(post.caption);

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
    model: gen.model,
  };
}

// Re-export the row shape so the dispatcher can type its query.
export type { PostRow as AutopilotPostRow };

export const AUTOPILOT_BUCKET = BUCKET;
