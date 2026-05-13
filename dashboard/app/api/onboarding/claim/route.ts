import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Stripe → Dashboard handoff.
 *
 * When a customer completes Stripe checkout, Stripe redirects them
 * here with their session_id. Flow:
 *
 *   1. If not signed in: redirect to /login?next=<this-url-with-
 *      session_id>. After they Google-OAuth back, this handler runs
 *      again with their session intact.
 *   2. Look up `pending_signups` by stripe_session_id. If missing,
 *      the webhook hasn't fired yet — bounce to /onboarding/pending
 *      which polls. (For now, we just send to /onboarding so they
 *      can fill in their brand manually if the webhook is delayed.)
 *   3. If found AND already claimed: redirect to their existing
 *      brand. Idempotent.
 *   4. If found AND unclaimed: mark claimed_by_user_id with the
 *      signed-in user, then redirect to /onboarding which will pick
 *      up the staged tier and customer info.
 *
 * The actual brand row creation happens later in /onboarding when the
 * user fills in their name + slug. We don't create the brand here
 * because we don't yet know what they want it called.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Must be signed in to claim. If not, bounce through login keeping
  // the session_id so we resume after OAuth.
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "next",
      `/api/onboarding/claim?session_id=${encodeURIComponent(sessionId)}`
    );
    return NextResponse.redirect(loginUrl);
  }

  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from("pending_signups")
    .select(
      "id, email, tier, claimed_at, claimed_brand_id, claimed_by_user_id"
    )
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  // Webhook delay — pending_signups row doesn't exist yet. Send them
  // to onboarding anyway; they can fill in their brand manually and
  // we'll backfill the link when the webhook fires.
  if (!row) {
    return NextResponse.redirect(
      new URL("/onboarding?pending=1", req.url)
    );
  }

  // Already claimed — idempotent. If we have a brand_id, send them
  // home; otherwise back to onboarding.
  if (row.claimed_at) {
    if (row.claimed_brand_id) {
      return NextResponse.redirect(
        new URL(`/dashboard/brand/${row.claimed_brand_id}`, req.url)
      );
    }
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Soft-claim: record the user_id now so the onboarding submit can
  // tie the brand back to this pending_signup. We DON'T set
  // claimed_at yet — that happens when the brand is actually created.
  await admin
    .from("pending_signups")
    .update({ claimed_by_user_id: user.id })
    .eq("id", row.id);

  return NextResponse.redirect(
    new URL(`/onboarding?paid=${row.tier}`, req.url)
  );
}
