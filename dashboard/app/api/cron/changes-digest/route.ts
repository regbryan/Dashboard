import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/send-email";

const QUIET_MINUTES = 10;

type PendingApproval = {
  id: string;
  post_id: number;
  comment: string | null;
  created_at: string;
  posts: {
    id: number;
    post_number: number | null;
    concept: string | null;
    brand_id: string;
    brands: { id: string; slug: string; name: string } | null;
  } | null;
};

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  // Vercel Cron also sends ?cron=1 with the same header; accept query for testing.
  const q = req.nextUrl.searchParams.get("secret");
  return q === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();

  const { data: rows, error } = await sb
    .from("approvals")
    .select(
      "id, post_id, comment, created_at, posts:post_id (id, post_number, concept, brand_id, brands:brand_id (id, slug, name))"
    )
    .eq("status", "changes_requested")
    .is("notified_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const pending = (rows ?? []) as unknown as PendingApproval[];
  if (!pending.length) {
    return Response.json({ ok: true, brandsNotified: 0, rowsFlushed: 0 });
  }

  // Group by brand.
  const byBrand = new Map<string, PendingApproval[]>();
  for (const r of pending) {
    const brandId = r.posts?.brands?.id;
    if (!brandId) continue;
    const arr = byBrand.get(brandId) ?? [];
    arr.push(r);
    byBrand.set(brandId, arr);
  }

  const dashboardBase = (process.env.DASHBOARD_URL || "").replace(/\/$/, "");
  const notifyTo = (process.env.NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!notifyTo.length) {
    return Response.json(
      { error: "NOTIFY_EMAIL not set" },
      { status: 500 }
    );
  }

  const cutoff = Date.now() - QUIET_MINUTES * 60 * 1000;
  const results: Array<{
    brandId: string;
    brandName: string;
    rows: number;
    sent: boolean;
    skipped?: string;
    error?: string;
  }> = [];

  for (const [brandId, group] of byBrand) {
    const newest = Math.max(
      ...group.map((g) => new Date(g.created_at).getTime())
    );
    if (newest > cutoff) {
      results.push({
        brandId,
        brandName: group[0].posts?.brands?.name ?? brandId,
        rows: group.length,
        sent: false,
        skipped: "still_active",
      });
      continue;
    }

    const brandName = group[0].posts?.brands?.name ?? brandId;
    const brandSlug = group[0].posts?.brands?.slug ?? brandId;

    const itemsHtml = group
      .map((g) => {
        const num = g.posts?.post_number ?? "?";
        const concept = g.posts?.concept ?? "Untitled";
        const link = dashboardBase
          ? `${dashboardBase}/dashboard/brand/${brandId}/post/${g.post_id}`
          : "#";
        const comment = (g.comment ?? "").trim();
        return `
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #eaeaea;vertical-align:top;">
              <div style="font-size:13px;color:#666;">Post #${num}</div>
              <div style="font-size:15px;font-weight:600;color:#111;margin-top:2px;">
                ${escapeHtml(concept)}
              </div>
              ${
                comment
                  ? `<div style="margin-top:8px;padding:10px 12px;background:#f6f6f7;border-left:3px solid #c084fc;border-radius:4px;font-size:13px;color:#333;white-space:pre-wrap;">${escapeHtml(
                      comment
                    )}</div>`
                  : `<div style="margin-top:8px;font-size:12px;color:#999;font-style:italic;">No comment provided</div>`
              }
              <div style="margin-top:10px;">
                <a href="${link}" style="font-size:12px;color:#7c3aed;text-decoration:none;">Open post →</a>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <h1 style="font-size:20px;font-weight:600;margin:0 0 6px;">${escapeHtml(
          brandName
        )} — ${group.length} change request${group.length === 1 ? "" : "s"}</h1>
        <p style="font-size:14px;color:#666;margin:0 0 20px;">
          The client just finished reviewing. Here's everything they asked for.
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

    const textLines = [
      `${brandName} — ${group.length} change request${group.length === 1 ? "" : "s"}`,
      "",
      ...group.map((g) => {
        const num = g.posts?.post_number ?? "?";
        const concept = g.posts?.concept ?? "Untitled";
        const comment = (g.comment ?? "").trim() || "(no comment)";
        return `Post #${num} — ${concept}\n  ${comment}`;
      }),
      ...(dashboardBase
        ? ["", `Dashboard: ${dashboardBase}/dashboard/brand/${brandId}`]
        : []),
    ];

    const send = await sendEmail({
      to: notifyTo,
      subject: `${brandName}: ${group.length} change${
        group.length === 1 ? "" : "s"
      } requested`,
      html,
      text: textLines.join("\n"),
    });

    if (!send.ok) {
      results.push({
        brandId,
        brandName,
        rows: group.length,
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
      console.error("[changes-digest] flush failed", flushErr.message);
    }

    results.push({ brandId, brandName, rows: group.length, sent: true });
  }

  return Response.json({
    ok: true,
    brandsNotified: results.filter((r) => r.sent).length,
    rowsFlushed: results
      .filter((r) => r.sent)
      .reduce((acc, r) => acc + r.rows, 0),
    results,
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
