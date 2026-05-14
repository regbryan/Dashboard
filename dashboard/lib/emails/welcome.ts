import "server-only";
import { sendEmail } from "../send-email";

/**
 * Welcome email sent after a customer completes onboarding and their
 * brand is fully provisioned. Single message, plain visual treatment —
 * intentionally not a marketing blast.
 *
 * Returns the send result so the caller can log a warning if delivery
 * fails (we don't want a transient email outage to block provisioning).
 */
export async function sendWelcomeEmail({
  to,
  brandName,
  brandSlug,
  tier,
  dashboardUrl,
}: {
  to: string;
  brandName: string;
  brandSlug: string;
  tier: string | null;
  dashboardUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const brandUrl = `${dashboardUrl}/dashboard/brand/${brandSlug}`;
  const tierLine = tier
    ? `<p style="margin: 0 0 14px; color: #6f6f7e; font-size: 13px;">Your <strong style="color: #c084fc; text-transform: capitalize;">${escapeHtml(
        tier
      )}</strong> plan is active.</p>`
    : "";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#07070e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07070e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#0f0f1a;border:1px solid #1a1a2e;border-radius:16px;">
          <tr>
            <td style="padding:32px 36px 28px;">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c084fc;font-weight:600;margin-bottom:14px;">SocialPulse</div>
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;line-height:1.2;">Welcome, ${escapeHtml(
                brandName
              )}.</h1>
              ${tierLine}
              <p style="margin:0 0 18px;color:#bfbfcc;font-size:14px;line-height:1.55;">
                Your dashboard is ready. The autopilot will start drafting posts based on the
                brand kit you submitted — your first batch lands on the calendar within a day.
              </p>
              <p style="margin:0 0 28px;color:#9999a6;font-size:13px;line-height:1.55;">
                Anything you left blank during onboarding can be filled in later from the
                Brand Kit tab. Derivation also fills voice / palette / photography direction
                from approved posts over time.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(180deg,#1e1838 0%,#0c0a16 100%);border:1px solid rgba(139,92,255,0.35);border-radius:999px;">
                    <a href="${brandUrl}" style="display:inline-block;padding:11px 24px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.01em;">Open your dashboard →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#4a4a55;font-size:11px;line-height:1.5;max-width:520px;">
          You're receiving this because you completed onboarding for ${escapeHtml(
            brandName
          )} on SocialPulse.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text =
    `Welcome, ${brandName}.\n\n` +
    `Your dashboard is ready. The autopilot will start drafting posts based on ` +
    `the brand kit you submitted — your first batch lands on the calendar within a day.\n\n` +
    `Open your dashboard: ${brandUrl}\n\n` +
    `Anything you left blank during onboarding can be filled in later from the Brand Kit tab.`;

  return sendEmail({
    to,
    subject: `Welcome to SocialPulse, ${brandName}`,
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
