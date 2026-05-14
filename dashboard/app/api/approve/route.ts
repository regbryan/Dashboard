import { after } from "next/server";
import { requirePostAccess, handleAuthError, type AuthedClient } from "@/lib/api-auth";
import { sendEmail } from "@/lib/send-email";
import { autoQueueApprovedPost } from "@/lib/socialpilot-queue";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post_id, status, comment } = body;

    if (!post_id || !status) {
      return Response.json(
        { error: "post_id and status are required" },
        { status: 400 }
      );
    }

    if (status !== "approved" && status !== "changes_requested") {
      return Response.json(
        { error: 'status must be "approved" or "changes_requested"' },
        { status: 400 }
      );
    }

    const { ctx } = await requirePostAccess(post_id);

    const now = new Date().toISOString();

    const { data: approval, error } = await ctx.supabase
      .from("approvals")
      .insert({ post_id, status, comment: comment || null, created_at: now })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Approval history keeps the literal client decision ("changes_requested")
    // for audit, but the post itself flips back into the regeneration queue
    // so the team's workflow surfaces it as work-to-do.
    const newPostStatus = status === "changes_requested" ? "generating" : status;

    await ctx.supabase
      .from("posts")
      .update({ status: newPostStatus, updated_at: now })
      .eq("id", post_id);

    // Best-effort confirmation email to the reviewer. Never block the response
    // on email delivery — Resend hiccups should not appear as approval errors.
    sendReviewerConfirmation({
      supabase: ctx.supabase,
      postId: post_id,
      status,
      comment: comment || null,
      reviewerEmail: ctx.user.email ?? null,
    }).catch((e) => {
      console.error("[approve] reviewer confirmation failed", e);
    });

    // Auto-queue to SocialPilot when an approval lands. Gated on Growth
    // tier + brand having a bound SP profile. Wrapped in after() so the
    // SP roundtrip never holds up the client's approval response.
    // autoQueueApprovedPost handles all skip + failure branches and
    // writes status onto the post row — never re-throws.
    if (status === "approved") {
      after(async () => {
        try {
          const outcome = await autoQueueApprovedPost(post_id);
          if (outcome.status === "failed") {
            console.warn("[approve] socialpilot auto-queue failed", {
              post_id,
              error: outcome.error,
              recoverable: outcome.recoverable,
            });
          }
        } catch (e) {
          console.error("[approve] socialpilot auto-queue crashed", e);
        }
      });
    }

    return Response.json(approval);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}

async function sendReviewerConfirmation(args: {
  supabase: AuthedClient;
  postId: number | string;
  status: "approved" | "changes_requested";
  comment: string | null;
  reviewerEmail: string | null;
}) {
  const { supabase, postId, status, comment, reviewerEmail } = args;
  if (!reviewerEmail) return;

  const { data: postRow } = await supabase
    .from("posts")
    .select("id, post_number, concept, brand_id, brands:brand_id (id, name)")
    .eq("id", postId)
    .maybeSingle();

  type PostJoin = {
    id: number;
    post_number: number | null;
    concept: string | null;
    brand_id: string;
    brands: { id: string; name: string } | null;
  };
  const post = postRow as PostJoin | null;
  const brandName = post?.brands?.name ?? "your brand";
  const postNumber = post?.post_number ?? "?";
  const concept = post?.concept ?? "Untitled";

  const isApproved = status === "approved";
  const headline = isApproved
    ? `You approved Post #${postNumber}`
    : `Your change request was sent`;
  const body = isApproved
    ? `Thanks for approving "${concept}" for ${brandName}. The team has been notified and will move it into scheduling.`
    : `Thanks — your change request on "${concept}" for ${brandName} has been sent to the team. We'll review your notes and get back to you within 1 business day.`;
  const commentBlock = comment?.trim()
    ? `<div style="margin-top:14px;padding:12px 14px;background:#f6f6f7;border-left:3px solid ${
        isApproved ? "#22c55e" : "#c084fc"
      };border-radius:4px;font-size:14px;color:#333;white-space:pre-wrap;"><strong style="display:block;margin-bottom:4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.04em;">Your note</strong>${escapeHtml(
        comment.trim()
      )}</div>`
    : "";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:520px;margin:0 auto;color:#111;">
      <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;">${escapeHtml(headline)}</h1>
      <p style="font-size:14px;color:#444;margin:0;line-height:1.55;">${escapeHtml(body)}</p>
      ${commentBlock}
      <p style="margin-top:24px;font-size:12px;color:#888;">${escapeHtml(brandName)} · Post #${postNumber}</p>
    </div>
  `;
  const text = [
    headline,
    "",
    body,
    ...(comment?.trim() ? ["", "Your note:", comment.trim()] : []),
    "",
    `${brandName} · Post #${postNumber}`,
  ].join("\n");

  await sendEmail({
    to: reviewerEmail,
    subject: isApproved
      ? `Approved: Post #${postNumber} — ${concept}`
      : `Change request received — Post #${postNumber}`,
    html,
    text,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
