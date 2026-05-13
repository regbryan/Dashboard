import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Stripe webhook receiver.
 *
 * Listens for `checkout.session.completed` and stages a row in
 * `pending_signups`. We can't create the brand or user_brand_access
 * yet because the customer hasn't signed in — we don't know their
 * Supabase user_id. The /api/onboarding/claim endpoint reconciles
 * later when they sign in.
 *
 * Signature verification: Stripe sends `stripe-signature` header with
 * an HMAC of the raw body using STRIPE_WEBHOOK_SECRET. We MUST read
 * `req.text()` (raw) not `req.json()` (parsed) so the bytes match
 * exactly what Stripe signed.
 *
 * proxy.ts allows /api/stripe/webhook through unauthenticated — must
 * be added to its publicRoutes list (see related commit).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // stripe-node needs Node, not Edge

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return Response.json(
      {
        error:
          "Stripe webhook misconfigured. Set STRIPE_WEBHOOK_SECRET in Vercel and configure the endpoint in Stripe dashboard.",
      },
      { status: 500 }
    );
  }

  // Raw body — see note above.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "signature_verification_failed";
    return Response.json({ error: msg }, { status: 400 });
  }

  // Only act on completed checkouts. Stripe sends a lot of other events
  // (payment_intent.*, invoice.*, customer.*) — silently ack them so
  // they don't show up as "failed" in the Stripe dashboard.
  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const email =
    session.customer_details?.email?.toLowerCase() ??
    (session.customer_email ? session.customer_email.toLowerCase() : null);
  const tier =
    (session.metadata?.tier as string | undefined) ?? null;

  if (!email) {
    // Without an email we can't reconcile to a user later. Log + ack
    // so Stripe doesn't retry forever.
    console.warn("[stripe webhook] completed session has no email", {
      session_id: session.id,
    });
    return Response.json({ received: true, error: "no_email" });
  }
  if (!tier || (tier !== "starter" && tier !== "growth")) {
    console.warn("[stripe webhook] completed session has unknown tier", {
      session_id: session.id,
      tier,
    });
    return Response.json({ received: true, error: "bad_tier" });
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  // Upsert by stripe_session_id — webhook delivery isn't guaranteed
  // exactly-once; we want the second delivery to be a no-op.
  const { error } = await supabaseAdmin()
    .from("pending_signups")
    .upsert(
      {
        email,
        tier,
        stripe_session_id: session.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        amount_total: session.amount_total ?? null,
        currency: session.currency ?? null,
      },
      { onConflict: "stripe_session_id" }
    );

  if (error) {
    console.error("[stripe webhook] failed to insert pending_signup", error);
    // Return 500 so Stripe retries — better than silently dropping.
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ received: true, staged: true });
}
