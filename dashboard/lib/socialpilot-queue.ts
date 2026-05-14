import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { getImageUrl } from "./image-url";
import { applyPublishingOverlays } from "./publishing-pipeline";
import {
  queuePost,
  isSocialPilotConfigured,
  SocialPilotApiError,
  SocialPilotAuthError,
  SocialPilotNotConfiguredError,
} from "./socialpilot";

/**
 * Triggered by the approval handler (app/api/approve) the moment a
 * post flips to `approved`. Decides whether the post is eligible to
 * be auto-queued to SocialPilot, and if so, sends it.
 *
 * Eligibility (all must be true):
 *   1. Brand is on the `growth` tier (Starter brands stay manual).
 *   2. Brand has `socialpilot_account_id` set (operator bound it).
 *   3. SocialPilot is globally configured (refresh token exists).
 *   4. Post has a file_path (we have an image to attach).
 *   5. Post has a caption (something to publish).
 *   6. Post's `date` is in the future (SP won't accept past dates).
 *   7. Post isn't already queued (idempotent if approval fires twice).
 *
 * Failure modes are caught here and written to
 * posts.socialpilot_queue_status / socialpilot_error so the UI can
 * show a retry. We never re-throw — the approval response shouldn't
 * 500 because SP is having a moment.
 */
export type SpQueueOutcome =
  | { status: "queued"; postId: string; socialpilotPostId: string }
  | {
      status: "skipped";
      reason:
        | "not_growth"
        | "no_account_id"
        | "sp_not_configured"
        | "no_image"
        | "no_caption"
        | "past_date"
        | "already_queued";
    }
  | { status: "failed"; error: string; recoverable: boolean };

export async function autoQueueApprovedPost(
  postId: string | number
): Promise<SpQueueOutcome> {
  const admin = supabaseAdmin();

  const { data: postRow, error: postErr } = await admin
    .from("posts")
    .select(
      "id, brand_id, caption, file_path, date, updated_at, socialpilot_post_id, socialpilot_queue_status"
    )
    .eq("id", postId)
    .maybeSingle();
  if (postErr || !postRow) {
    return { status: "failed", error: "post_not_found", recoverable: false };
  }
  const post = postRow as {
    id: string | number;
    brand_id: string;
    caption: string | null;
    file_path: string | null;
    date: string | null;
    updated_at: string | null;
    socialpilot_post_id: string | null;
    socialpilot_queue_status: string | null;
  };

  // Idempotency: don't double-queue.
  if (post.socialpilot_queue_status === "queued" && post.socialpilot_post_id) {
    return { status: "skipped", reason: "already_queued" };
  }

  // Brand tier + binding gate.
  const { data: brandRow } = await admin
    .from("brands")
    .select("id, subscription_tier, socialpilot_account_id")
    .eq("id", post.brand_id)
    .maybeSingle();
  const brand = (brandRow ?? null) as {
    subscription_tier?: string | null;
    socialpilot_account_id?: string | null;
  } | null;

  if (brand?.subscription_tier !== "growth") {
    return { status: "skipped", reason: "not_growth" };
  }
  if (!brand.socialpilot_account_id) {
    return { status: "skipped", reason: "no_account_id" };
  }
  if (!(await isSocialPilotConfigured())) {
    return { status: "skipped", reason: "sp_not_configured" };
  }

  // Content gates.
  if (!post.file_path) return { status: "skipped", reason: "no_image" };
  if (!post.caption || !post.caption.trim()) {
    return { status: "skipped", reason: "no_caption" };
  }

  // Scheduling. posts.date is a DATE (no time). Publish at 12:00 UTC
  // local-noon-ish — operators can refine in SP itself if they want a
  // different slot. If the date is today or past, skip and let the
  // operator publish manually.
  if (!post.date) return { status: "skipped", reason: "past_date" };
  const scheduledAt = new Date(`${post.date}T12:00:00.000Z`);
  if (scheduledAt.getTime() <= Date.now()) {
    await markFailure(postId, "scheduled date is in the past");
    return { status: "skipped", reason: "past_date" };
  }

  // Branded-overlay automation. If the brand has publishing_overlays
  // configured (e.g. OMG navy footer, CSC logo with clean-band), apply
  // them onto the stored image BEFORE we send SP the URL. The overlay
  // functions update posts.file_path in place (idempotent via snapshots).
  // Skipped silently when the brand has no rules.
  const overlayResult = await applyPublishingOverlays(post.id);
  if (!overlayResult.ok) {
    await markFailure(
      postId,
      `overlay pipeline failed: ${overlayResult.error}`
    );
    return {
      status: "failed",
      error: overlayResult.error,
      recoverable: false,
    };
  }

  // Re-read updated_at so the cache-bust query string on the image
  // URL reflects the just-composited overlays. Without this, SP could
  // pull a CDN-cached pre-overlay image.
  let imageVersion: string | null = post.updated_at;
  if (overlayResult.applied > 0) {
    const { data: refreshed } = await supabaseAdmin()
      .from("posts")
      .select("updated_at")
      .eq("id", post.id)
      .maybeSingle();
    imageVersion =
      (refreshed as { updated_at?: string | null } | null)?.updated_at ??
      post.updated_at;
  }

  const imageUrl = getImageUrl(post.brand_id, post.file_path, imageVersion);
  if (!imageUrl) {
    await markFailure(postId, "could not build public image URL");
    return { status: "failed", error: "image_url_failed", recoverable: false };
  }

  try {
    const result = await queuePost({
      accountIds: [brand.socialpilot_account_id],
      caption: post.caption,
      imageUrl,
      scheduledAt,
    });
    await admin
      .from("posts")
      .update({
        socialpilot_post_id: result.postId,
        socialpilot_queue_status: "queued",
        socialpilot_queued_at: new Date().toISOString(),
        socialpilot_error: null,
      })
      .eq("id", postId);
    return {
      status: "queued",
      postId: String(post.id),
      socialpilotPostId: result.postId,
    };
  } catch (err) {
    const isAuth = err instanceof SocialPilotAuthError;
    const isApi = err instanceof SocialPilotApiError;
    const isMissing = err instanceof SocialPilotNotConfiguredError;
    const msg = err instanceof Error ? err.message : String(err);
    await markFailure(postId, msg);
    return {
      status: "failed",
      error: msg,
      recoverable: isAuth || (isApi && isRetryable((err as SocialPilotApiError).status)) || isMissing,
    };
  }
}

function isRetryable(status: number): boolean {
  // 5xx and 429 are retryable; 4xx (other) usually means content rejected.
  return status === 429 || (status >= 500 && status < 600);
}

async function markFailure(postId: string | number, message: string) {
  await supabaseAdmin()
    .from("posts")
    .update({
      socialpilot_queue_status: "failed",
      socialpilot_error: message.slice(0, 500),
      socialpilot_queued_at: new Date().toISOString(),
    })
    .eq("id", postId);
}
