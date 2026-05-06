import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/send-email";
import { buildClaudeRevisionLink } from "@/lib/claude-link";
import { getImageUrl } from "@/lib/image-url";

const QUIET_MINUTES = 10;

export type PendingApproval = {
  id: string;
  post_id: number;
  status: "approved" | "changes_requested";
  comment: string | null;
  created_at: string;
  posts: {
    id: number;
    post_number: number | null;
    concept: string | null;
    post_type: string | null;
    date: string | null;
    caption: string | null;
    hashtags: string | null;
    cta: string | null;
    visual_direction: string | null;
    file_path: string | null;
    brand_id: string;
    brands: { id: string; name: string } | null;
  } | null;
};

export type DigestResult = {
  brandId: string;
  brandName: string;
  rows: number;
  approved: number;
  changes: number;
  sent: boolean;
  skipped?: string;
  error?: string;
};

export type DigestRunOpts = {
  // When true (manual trigger), skip the 10-minute quiet window so the owner
  // gets every pending row immediately. Cron leaves it false.
  ignoreQuietWindow?: boolean;
};

export type DigestRunOutput = {
  ok: boolean;
  brandsNotified: number;
  rowsFlushed: number;
  results: DigestResult[];
  error?: string;
};

export async function runFeedbackDigest(
  opts: DigestRunOpts = {}
): Promise<DigestRunOutput> {
  const sb = supabaseAdmin();

  const { data: rows, error } = await sb
    .from("approvals")
    .select(
      "id, post_id, status, comment, created_at, posts:post_id (id, post_number, concept, post_type, date, caption, hashtags, cta, visual_direction, file_path, brand_id, brands:brand_id (id, name))"
    )
    .in("status", ["approved", "changes_requested"])
    .is("notified_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, brandsNotified: 0, rowsFlushed: 0, results: [], error: error.message };
  }

  const pending = (rows ?? []) as unknown as PendingApproval[];
  if (!pending.length) {
    return { ok: true, brandsNotified: 0, rowsFlushed: 0, results: [] };
  }

  const dashboardBase = (process.env.DASHBOARD_URL || "").replace(/\/$/, "");
  const notifyTo = (process.env.NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!notifyTo.length) {
    return {
      ok: false,
      brandsNotified: 0,
      rowsFlushed: 0,
      results: [],
      error: "NOTIFY_EMAIL not set",
    };
  }

  const byBrand = new Map<string, PendingApproval[]>();
  for (const r of pending) {
    const brandId = r.posts?.brands?.id;
    if (!brandId) continue;
    const arr = byBrand.get(brandId) ?? [];
    arr.push(r);
    byBrand.set(brandId, arr);
  }

  const cutoff = Date.now() - QUIET_MINUTES * 60 * 1000;
  const results: DigestResult[] = [];

  for (const [brandId, group] of byBrand) {
    const brandName = group[0].posts?.brands?.name ?? brandId;
    const approvedCount = group.filter((g) => g.status === "approved").length;
    const changesCount = group.filter((g) => g.status === "changes_requested").length;

    if (!opts.ignoreQuietWindow) {
      const newest = Math.max(
        ...group.map((g) => new Date(g.created_at).getTime())
      );
      if (newest > cutoff) {
        results.push({
          brandId,
          brandName,
          rows: group.length,
          approved: approvedCount,
          changes: changesCount,
          sent: false,
          skipped: "still_active",
        });
        continue;
      }
    }

    const html = renderHtml({ brandId, brandName, group, dashboardBase });
    const text = renderText({ brandId, brandName, group, dashboardBase });
    const subject = renderSubject({ brandName, approvedCount, changesCount });

    const send = await sendEmail({ to: notifyTo, subject, html, text });

    if (!send.ok) {
      results.push({
        brandId,
        brandName,
        rows: group.length,
        approved: approvedCount,
        changes: changesCount,
        sent: false,
        error: send.error,
      });
      continue;
    }

    const ids = group.map((g) => g.id);
    const { error: flushErr } = await sb
      .from("approvals")
      .update({ notified_at: new Date().toISOString() })
      .in("id", ids);
    if (flushErr) {
      console.error("[feedback-digest] flush failed", flushErr.message);
    }

    results.push({
      brandId,
      brandName,
      rows: group.length,
      approved: approvedCount,
      changes: changesCount,
      sent: true,
    });
  }

  return {
    ok: true,
    brandsNotified: results.filter((r) => r.sent).length,
    rowsFlushed: results.filter((r) => r.sent).reduce((acc, r) => acc + r.rows, 0),
    results,
  };
}

function renderSubject(args: {
  brandName: string;
  approvedCount: number;
  changesCount: number;
}): string {
  const { brandName, approvedCount, changesCount } = args;
  if (changesCount && approvedCount) {
    return `${brandName}: ${approvedCount} approved, ${changesCount} change${
      changesCount === 1 ? "" : "s"
    } requested`;
  }
  if (changesCount) {
    return `${brandName}: ${changesCount} change${
      changesCount === 1 ? "" : "s"
    } requested`;
  }
  return `${brandName}: ${approvedCount} approved`;
}

function renderHtml(args: {
  brandId: string;
  brandName: string;
  group: PendingApproval[];
  dashboardBase: string;
}): string {
  const { brandId, brandName, group, dashboardBase } = args;
  const total = group.length;
  const approvedCount = group.filter((g) => g.status === "approved").length;
  const changesCount = total - approvedCount;

  const headline =
    changesCount && approvedCount
      ? `${approvedCount} approved · ${changesCount} change${
          changesCount === 1 ? "" : "s"
        } requested`
      : changesCount
      ? `${changesCount} change request${changesCount === 1 ? "" : "s"}`
      : `${approvedCount} approved`;

  const itemsHtml = group
    .map((g) => {
      const num = g.posts?.post_number ?? "?";
      const concept = g.posts?.concept ?? "Untitled";
      const link = dashboardBase
        ? `${dashboardBase}/dashboard/brand/${brandId}/post/${g.post_id}`
        : "#";
      const comment = (g.comment ?? "").trim();
      const isApproved = g.status === "approved";
      const pillBg = isApproved ? "#dcfce7" : "#fef3c7";
      const pillFg = isApproved ? "#166534" : "#92400e";
      const pillLabel = isApproved ? "Approved" : "Changes requested";
      const accentBorder = isApproved ? "#22c55e" : "#c084fc";

      const commentBlock = comment
        ? `<div style="margin-top:8px;padding:10px 12px;background:#f6f6f7;border-left:3px solid ${accentBorder};border-radius:4px;font-size:13px;color:#333;white-space:pre-wrap;">${escapeHtml(
            comment
          )}</div>`
        : isApproved
        ? ""
        : `<div style="margin-top:8px;font-size:12px;color:#999;font-style:italic;">No comment provided</div>`;

      // Only generate the Claude revision link for changes_requested rows.
      // Approvals don't need a revision; the link would be noise.
      let claudeLinkHtml = "";
      if (!isApproved) {
        const post = g.posts;
        const assetUrl = post?.brand_id && post?.file_path
          ? getImageUrl(post.brand_id, post.file_path)
          : null;
        const claudeUrl = buildClaudeRevisionLink({
          brandName,
          postNumber: post?.post_number,
          concept: post?.concept,
          postType: post?.post_type,
          date: post?.date,
          caption: post?.caption,
          hashtags: post?.hashtags,
          cta: post?.cta,
          visualDirection: post?.visual_direction,
          assetUrl,
          clientComment: g.comment,
        });
        claudeLinkHtml = `<a href="${claudeUrl}" style="font-size:12px;color:#7c3aed;text-decoration:none;margin-left:14px;">Draft revision in Claude →</a>`;
      }

      return `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #eaeaea;vertical-align:top;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;padding:2px 8px;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;border-radius:999px;background:${pillBg};color:${pillFg};">${pillLabel}</span>
              <span style="font-size:13px;color:#666;">Post #${num}</span>
            </div>
            <div style="font-size:15px;font-weight:600;color:#111;margin-top:6px;">
              ${escapeHtml(concept)}
            </div>
            ${commentBlock}
            <div style="margin-top:10px;">
              <a href="${link}" style="font-size:12px;color:#7c3aed;text-decoration:none;">Open post →</a>${claudeLinkHtml}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <h1 style="font-size:20px;font-weight:600;margin:0 0 6px;">${escapeHtml(
        brandName
      )} — ${headline}</h1>
      <p style="font-size:14px;color:#666;margin:0 0 20px;">
        The client just finished reviewing. Here's the full update.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #eaeaea;border-radius:8px;border-collapse:separate;overflow:hidden;">
        ${itemsHtml}
      </table>
      ${
        dashboardBase
          ? `<p style="margin-top:20px;font-size:13px;"><a href="${dashboardBase}/dashboard/brand/${brandId}" style="color:#7c3aed;text-decoration:none;">Open ${escapeHtml(
              brandName
            )} dashboard →</a></p>`
          : ""
      }
    </div>
  `;
}

function renderText(args: {
  brandId: string;
  brandName: string;
  group: PendingApproval[];
  dashboardBase: string;
}): string {
  const { brandId, brandName, group, dashboardBase } = args;
  const approvedCount = group.filter((g) => g.status === "approved").length;
  const changesCount = group.length - approvedCount;

  const headline =
    changesCount && approvedCount
      ? `${approvedCount} approved, ${changesCount} change${
          changesCount === 1 ? "" : "s"
        } requested`
      : changesCount
      ? `${changesCount} change request${changesCount === 1 ? "" : "s"}`
      : `${approvedCount} approved`;

  const lines = [
    `${brandName} — ${headline}`,
    "",
    ...group.map((g) => {
      const num = g.posts?.post_number ?? "?";
      const concept = g.posts?.concept ?? "Untitled";
      const label = g.status === "approved" ? "[APPROVED]" : "[CHANGES]";
      const comment = (g.comment ?? "").trim();
      const commentLine =
        comment || g.status === "changes_requested"
          ? `\n  ${comment || "(no comment)"}`
          : "";
      return `${label} Post #${num} — ${concept}${commentLine}`;
    }),
    ...(dashboardBase
      ? ["", `Dashboard: ${dashboardBase}/dashboard/brand/${brandId}`]
      : []),
  ];

  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
