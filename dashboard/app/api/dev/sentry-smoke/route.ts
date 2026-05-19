import { NextResponse } from "next/server";
import { requireAdmin, handleAuthError } from "@/lib/api-auth";

import { withRequestContextFromHeaders } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dev/sentry-smoke
 *
 * Admin-only. Deliberately throws so we can verify the Sentry
 * pipeline end-to-end after install. Expected workflow:
 *
 *   1. Set NEXT_PUBLIC_SENTRY_DSN + SENTRY_AUTH_TOKEN in Vercel
 *      preview env.
 *   2. Deploy a preview.
 *   3. Sign in as admin, hit /api/dev/sentry-smoke once.
 *   4. Within ~60 seconds the error should appear in Sentry's
 *      issues list, tagged with the current commit SHA as the
 *      release.
 *   5. Delete this route OR leave it as a periodic health probe.
 *
 * Returns 500 with a marker body so the caller can confirm the
 * route is wired without having to load Sentry UI to see the throw.
 */
export async function GET() {
  return withRequestContextFromHeaders(() => handleGET());
}

async function handleGET() {
  try {
    await requireAdmin();
  } catch (err) {
    const authResp = handleAuthError(err);
    if (authResp) return authResp;
    throw err;
  }

  // Intentionally throw — Sentry's Next.js integration captures this
  // via the App Router error boundary + onRequestError hook.
  throw new Error(
    "Sentry smoke test — if you see this in Sentry within 60s, the pipeline is wired correctly."
  );

  // Unreachable; satisfies the NextResponse return type for
  // TypeScript.
  return NextResponse.json({ ok: false });
}
