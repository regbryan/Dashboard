import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/send-email";
import { getBrandClientEmails } from "@/lib/brand-clients";
import { logger } from "@/lib/logger";

// Posts ready-for-client-review notifications. Two entry points share one
// rendering pipeline:
//   - notifyOnePost(postId)   manual "Send now" button on the admin post page.
//   - runClientReadyDigest()  daily cron that batches everything still
//                             unnotified into one email per brand.
//
// Both stamp posts.client_notified_at so we never double-notify. mark-in-review
// clears that column when a post returns to in_review after a regeneration,
// so a re-notification fires next cycle.

export type ReadyPostRow = {
  id: number;
  brand_id: string;
  post_number: number | null;
  concept: string | null;
  date: string | null;
  post_type: string | null;
  brands: { id: string; name: string } | null;
};

export type NotifyOneResult = {
  ok: boolean;
  sent: boolean;
  recipients: number;
  skipped?: "no_recipients" | "wrong_status" | "already_notified" | "post_not_found";
  error?: string;
};

export type DigestBrandResult = {
  brandId: string;
  brandName: string;
  posts: number;
  recipients: number;
  sent: boolean;
  skipped?: "no_recipients";
  error?: string;
};

export type DigestRunResult = {
  ok: boolean;
  brandsNotified: number;
  postsFlushed: number;
  results: DigestBrandResult[];
  error?: string;
};

const POST_SELECT =
  "id, brand_id, post_number, concept, date, post_type, status, client_notified_at, brands:brand_id (id, name)";

function dashboardBase(): string {
  return (process.env.DASHBOARD_URL || "").replace(/\/$/, "");
}

function reviewLink(brandId: string, postId?: number | string): string {
  const base = dashboardBase();
  if (!base) return "#";
  if (postId !== undefined) {
    return `${base}/client/${brandId}/post/${postId}`;
  }
  return `${base}/client/${brandId}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Notify reviewers about a single post. Used by the "Send Email Now" admin
 * button. Returns a structured result rather than throwing — the caller
 * surfaces "no recipients" / "already notified" cases as informational, not
 * errors.
 */
export async function notifyOnePost(
  postId: number | string
): Promise<NotifyOneResult> {
  const sb = supabaseAdmin();

  const { data: row, error } = await sb
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    return { ok: false, sent: false, recipients: 0, error: error.message };
  }
  if (!row) {
    return { ok: false, sent: false, recipients: 0, skipped: "post_not_found" };
  }

  type PostJoin = ReadyPostRow & {
    status: string;
    client_notified_at: string | null;
  };
  const post = row as unknown as PostJoin;

  if (post.status !== "in_review") {
    return { ok: false, sent: false, recipients: 0, skipped: "wrong_status" };
  }

  const recipients = await getBrandClientEmails(post.brand_id);
  if (!recipients.length) {
    return { ok: true, sent: false, recipients: 0, skipped: "no_recipients" };
  }

  const brandName = post.brands?.name ?? post.brand_id;
  const num = post.post_number ?? "?";
  const concept = post.concept ?? "Untitled";
  const link = reviewLink(post.brand_id, post.id);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:520px;margin:0 auto;color:#111;">
      <h1 style="font-size:20px;font-weight:600;margin:0 0 6px;">${escapeHtml(brandName)}: Post #${num} ready for review</h1>
      <p style="font-size:14px;color:#444;margin:0 0 16px;line-height:1.55;">A new design is ready for your review:</p>
      <div style="border:1px solid #eaeaea;border-radius:8px;padding:14px 16px;">
        <div style="font-size:13px;color:#666;">Post #${num}${post.post_type ? ` · ${escapeHtml(post.post_type)}` : ""}${post.date ? ` · ${escapeHtml(post.date)}` : ""}</div>
        <div style="font-size:15px;font-weight:600;color:#111;margin-top:4px;">${escapeHtml(concept)}</div>
        <div style="margin-top:14px;">
          <a href="${link}" style="display:inline-block;padding:8px 14px;background:#7c3aed;color:white;font-size:13px;font-weight:500;text-decoration:none;border-radius:6px;">Open & review →</a>
        </div>
      </div>
      <p style="margin-top:20px;font-size:12px;color:#888;">${escapeHtml(brandName)}</p>
    </div>
  `;

  const text = [
    `${brandName}: Post #${num} ready for review`,
    "",
    concept,
    "",
    `Review: ${link}`,
  ].join("\n");

  const send = await sendEmail({
    to: recipients,
    subject: `${brandName}: Post #${num} ready for review`,
    html,
    text,
  });

  if (!send.ok) {
    return {
      ok: false,
      sent: false,
      recipients: recipients.length,
      error: send.error,
    };
  }

  // Stamp so the cron doesn't re-send. Use service role so RLS doesn't block.
  await sb
    .from("posts")
    .update({ client_notified_at: new Date().toISOString() })
    .eq("id", post.id);

  return { ok: true, sent: true, recipients: recipients.length };
}

/**
 * Daily digest: find every in_review post that hasn't been notified yet,
 * group by brand, send one email per brand to that brand's reviewer
 * allowlist, and stamp client_notified_at on each post in the batch.
 */
export async function runClientReadyDigest(): Promise<DigestRunResult> {
  const sb = supabaseAdmin();

  const { data: rows, error } = await sb
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "in_review")
    .is("client_notified_at", null)
    .order("post_number", { ascending: true });

  if (error) {
    return {
      ok: false,
      brandsNotified: 0,
      postsFlushed: 0,
      results: [],
      error: error.message,
    };
  }

  type PostJoin = ReadyPostRow;
  const pending = (rows ?? []) as unknown as PostJoin[];
  if (!pending.length) {
    return { ok: true, brandsNotified: 0, postsFlushed: 0, results: [] };
  }

  const byBrand = new Map<string, PostJoin[]>();
  for (const r of pending) {
    const arr = byBrand.get(r.brand_id) ?? [];
    arr.push(r);
    byBrand.set(r.brand_id, arr);
  }

  const results: DigestBrandResult[] = [];

  for (const [brandId, group] of byBrand) {
    const brandName = group[0].brands?.name ?? brandId;
    const recipients = await getBrandClientEmails(brandId);

    if (!recipients.length) {
      results.push({
        brandId,
        brandName,
        posts: group.length,
        recipients: 0,
        sent: false,
        skipped: "no_recipients",
      });
      continue;
    }

    const html = renderBrandDigestHtml({ brandId, brandName, posts: group });
    const text = renderBrandDigestText({ brandId, brandName, posts: group });

    const send = await sendEmail({
      to: recipients,
      subject:
        group.length === 1
          ? `${brandName}: Post #${group[0].post_number ?? "?"} ready for review`
          : `${brandName}: ${group.length} posts ready for review`,
      html,
      text,
    });

    if (!send.ok) {
      results.push({
        brandId,
        brandName,
        posts: group.length,
        recipients: recipients.length,
        sent: false,
        error: send.error,
      });
      continue;
    }

    const ids = group.map((g) => g.id);
    const { error: flushErr } = await sb
      .from("posts")
      .update({ client_notified_at: new Date().toISOString() })
      .in("id", ids);
    if (flushErr) {
      logger.error("client-digest", "flush failed", { err: flushErr });
    }

    results.push({
      brandId,
      brandName,
      posts: group.length,
      recipients: recipients.length,
      sent: true,
    });
  }

  return {
    ok: true,
    brandsNotified: results.filter((r) => r.sent).length,
    postsFlushed: results.filter((r) => r.sent).reduce((acc, r) => acc + r.posts, 0),
    results,
  };
}

export type NotifyBrandResult = {
  ok: boolean;
  sent: boolean;
  recipients: number;
  posts: number;
  skipped?: "no_posts" | "no_recipients";
  error?: string;
};

/**
 * On-demand, per-brand notify: email this brand's client allowlist ONE
 * consolidated "designs ready for review" digest covering every in_review
 * post that hasn't been notified yet, and stamp client_notified_at on them.
 * Powers the "Notify client" button on the brand page — same email template
 * and dedupe rule as the cron digest, just scoped to one brand and triggered
 * by the operator instead of the schedule.
 */
export async function notifyBrandReady(
  brandId: string
): Promise<NotifyBrandResult> {
  const sb = supabaseAdmin();

  const { data: rows, error } = await sb
    .from("posts")
    .select(POST_SELECT)
    .eq("brand_id", brandId)
    .eq("status", "in_review")
    .is("client_notified_at", null)
    .order("post_number", { ascending: true });
  if (error) {
    return { ok: false, sent: false, recipients: 0, posts: 0, error: error.message };
  }
  const pending = (rows ?? []) as unknown as ReadyPostRow[];
  if (!pending.length) {
    return { ok: true, sent: false, recipients: 0, posts: 0, skipped: "no_posts" };
  }

  const recipients = await getBrandClientEmails(brandId);
  if (!recipients.length) {
    return { ok: true, sent: false, recipients: 0, posts: pending.length, skipped: "no_recipients" };
  }

  const brandName = pending[0].brands?.name ?? brandId;
  const html = renderBrandDigestHtml({ brandId, brandName, posts: pending });
  const text = renderBrandDigestText({ brandId, brandName, posts: pending });

  const send = await sendEmail({
    to: recipients,
    subject:
      pending.length === 1
        ? `${brandName}: Post #${pending[0].post_number ?? "?"} ready for review`
        : `${brandName}: ${pending.length} posts ready for review`,
    html,
    text,
  });
  if (!send.ok) {
    return { ok: false, sent: false, recipients: recipients.length, posts: pending.length, error: send.error };
  }

  const ids = pending.map((p) => p.id);
  await sb
    .from("posts")
    .update({ client_notified_at: new Date().toISOString() })
    .in("id", ids);

  return { ok: true, sent: true, recipients: recipients.length, posts: pending.length };
}

function renderBrandDigestHtml(args: {
  brandId: string;
  brandName: string;
  posts: ReadyPostRow[];
}): string {
  const { brandId, brandName, posts } = args;
  const intro =
    posts.length === 1
      ? "A new design is ready for your review:"
      : `${posts.length} new designs are ready for your review.`;

  const itemsHtml = posts
    .map((p) => {
      const num = p.post_number ?? "?";
      const concept = p.concept ?? "Untitled";
      const link = reviewLink(brandId, p.id);
      const meta = [
        p.post_type ? escapeHtml(p.post_type) : null,
        p.date ? escapeHtml(p.date) : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #eaeaea;vertical-align:top;">
            <div style="font-size:13px;color:#666;">Post #${num}${meta ? ` · ${meta}` : ""}</div>
            <div style="font-size:15px;font-weight:600;color:#111;margin-top:4px;">${escapeHtml(concept)}</div>
            <div style="margin-top:8px;">
              <a href="${link}" style="font-size:12px;color:#7c3aed;text-decoration:none;">Open & review →</a>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <h1 style="font-size:20px;font-weight:600;margin:0 0 6px;">${escapeHtml(brandName)}: ready for review</h1>
      <p style="font-size:14px;color:#666;margin:0 0 18px;">${escapeHtml(intro)}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #eaeaea;border-radius:8px;border-collapse:separate;overflow:hidden;">
        ${itemsHtml}
      </table>
      <p style="margin-top:20px;font-size:13px;">
        <a href="${reviewLink(brandId)}" style="color:#7c3aed;text-decoration:none;">Open ${escapeHtml(brandName)} review queue →</a>
      </p>
    </div>
  `;
}

function renderBrandDigestText(args: {
  brandId: string;
  brandName: string;
  posts: ReadyPostRow[];
}): string {
  const { brandId, brandName, posts } = args;
  const lines = [
    `${brandName}: ${posts.length} ready for review`,
    "",
    ...posts.map((p) => {
      const num = p.post_number ?? "?";
      const concept = p.concept ?? "Untitled";
      const link = reviewLink(brandId, p.id);
      return `Post #${num}: ${concept}\n  ${link}`;
    }),
    "",
    `Review queue: ${reviewLink(brandId)}`,
  ];
  return lines.join("\n");
}
