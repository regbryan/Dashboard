/**
 * Single source of truth for the admin allowlist. Used by:
 *   - proxy.ts (route-level admin redirects)
 *   - lib/api-auth.ts (ctx.isAdmin + requireAdmin)
 *
 * Sourced from the ADMIN_EMAILS env var (comma-separated, lowercased)
 * with a hardcoded fallback so a missing env doesn't lock out the
 * operator. Rotating an admin no longer requires a code deploy —
 * update the Vercel env and redeploy any branch.
 *
 * Comparison is case-insensitive: emails get lowercased on both sides.
 */
const FALLBACK_ADMINS = [
  "reggie@inspiredideationstrategies.com",
  "reggieebryant@gmail.com",
  "courtney@workbyccmarketing.com",
];

function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || !raw.trim()) return FALLBACK_ADMINS.map((e) => e.toLowerCase());
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS_LOWER = new Set(parseAdminEmails());

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS_LOWER.has(email.toLowerCase());
}
