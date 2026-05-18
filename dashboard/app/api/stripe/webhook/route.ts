import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

/**
 * Stripe webhook receiver.
 *
 * Handles the full subscription lifecycle:
 *
 *   checkout.session.completed       → stage in pending_signups
 *   customer.subscription.updated    → sync status/tier on brands row
 *   customer.subscription.deleted    → mark brand 'canceled'
 *   invoice.payment_failed           → mark brand 'past_due'
 *   invoice.paid                     → mark brand 'active' (recover)
 *
 * Signature verification: Stripe sends `stripe-signature` header with
 * an HMAC of the raw body using STRIPE_WEBHOOK_SECRET. We MUST read
 * `req.text()` (raw) not `req.json()` (parsed) so the bytes match.
 *
 * proxy.ts must allow /api/stripe/webhook through unauthenticated.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // stripe-node needs Node, not Edge

const PRICE_TO_TIER: Record<string, "starter" | "growth"> = {};
if (process.env.STRIPE_PRICE_STARTER) {
  PRICE_TO_TIER[process.env.STRIPE_PRICE_STARTER] = "starter";
}
if (process.env.STRIPE_PRICE_GROWTH) {
  PRICE_TO_TIER[process.env.STRIPE_PRICE_GROWTH] = "growth";
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    // 4xx, not 5xx — Stripe retries 5xx for up to 3 days, which would
    // hammer a misconfigured endpoint. 400 makes it give up quickly so
    // an operator can fix the env and reattach. Log loud so the miss
    // surfaces in the deploy logs.
    logger.error(
      "stripe/webhook",
      "misconfigured: missing STRIPE_WEBHOOK_SECRET or signature header",
      { has_sig: !!sig, has_secret: !!secret }
    );
    return Response.json(
      { error: "webhook_misconfigured" },
      { status: 400 }
    );
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "signature_verification_failed";
    return Response.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        return await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
      case "customer.subscription.updated":
      case "customer.subscription.created":
        return await handleSubscriptionUpsert(
          event.data.object as Stripe.Subscription
        );
      case "customer.subscription.deleted":
        return await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
      case "invoice.payment_failed":
        return await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice
        );
      case "invoice.paid":
      case "invoice.payment_succeeded":
        return await handleInvoicePaid(
          event.data.object as Stripe.Invoice
        );
      default:
        // Ack so Stripe doesn't keep retrying.
        return Response.json({ received: true, ignored: event.type });
    }
  } catch (err) {
    // Returning 500 makes Stripe retry — usually what we want for
    // transient DB issues.
    logger.error("stripe/webhook", "handler crashed", {
      type: event.type,
      err,
    });
    return Response.json({ error: "handler_failed" }, { status: 500 });
  }
}

// ─── handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<Response> {
  const email =
    session.customer_details?.email?.toLowerCase() ??
    (session.customer_email ? session.customer_email.toLowerCase() : null);
  const tier = (session.metadata?.tier as string | undefined) ?? null;

  if (!email) {
    logger.warn("stripe/webhook", "completed session has no email", {
      session_id: session.id,
    });
    return Response.json({ received: true, error: "no_email" });
  }
  if (!tier || (tier !== "starter" && tier !== "growth")) {
    logger.warn("stripe/webhook", "completed session has unknown tier", {
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
    logger.error("stripe/webhook", "failed to insert pending_signup", { err: error });
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ received: true, staged: true });
}

async function handleSubscriptionUpsert(
  sub: Stripe.Subscription
): Promise<Response> {
  // Tier comes from either metadata (we set it at checkout time) or
  // we recover it from the price ID on the active line item.
  const metadataTier = sub.metadata?.tier as string | undefined;
  const priceTier = (() => {
    const firstItem = sub.items?.data?.[0];
    const priceId = firstItem?.price?.id;
    return priceId ? PRICE_TO_TIER[priceId] : undefined;
  })();
  const tier = metadataTier || priceTier || null;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Subscription objects expose period end on items.data[0] in newer
  // Stripe API versions; fall back to legacy top-level field if present.
  const periodEnd = readCurrentPeriodEnd(sub);
  const update: Record<string, unknown> = {
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    subscription_current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    subscription_cancel_at: sub.cancel_at
      ? new Date(sub.cancel_at * 1000).toISOString()
      : null,
  };
  if (tier) update.subscription_tier = tier;

  // Match by stripe_subscription_id first (most specific), then by
  // stripe_customer_id (covers race where a brand row was provisioned
  // before its sub id was attached).
  const admin = supabaseAdmin();
  const { data: bySub } = await admin
    .from("brands")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (bySub) {
    await admin.from("brands").update(update).eq("id", bySub.id);
    return Response.json({ received: true, matched: "subscription_id" });
  }

  const { data: byCustomer } = await admin
    .from("brands")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (byCustomer) {
    await admin.from("brands").update(update).eq("id", byCustomer.id);
    return Response.json({ received: true, matched: "customer_id" });
  }

  // No brand provisioned yet — the customer probably hasn't completed
  // onboarding. The onboarding submit will copy subscription state
  // from pending_signups when it lands.
  return Response.json({ received: true, matched: "none_yet" });
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<Response> {
  const admin = supabaseAdmin();
  await admin
    .from("brands")
    .update({
      subscription_status: "canceled",
      subscription_cancel_at: sub.canceled_at
        ? new Date(sub.canceled_at * 1000).toISOString()
        : new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id);
  return Response.json({ received: true, canceled: sub.id });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<Response> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return Response.json({ received: true, ignored: "no_sub" });
  await supabaseAdmin()
    .from("brands")
    .update({ subscription_status: "past_due" })
    .eq("stripe_subscription_id", subId);
  return Response.json({ received: true, past_due: subId });
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice
): Promise<Response> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return Response.json({ received: true, ignored: "no_sub" });
  // Renewal/recovery — move back to active.
  await supabaseAdmin()
    .from("brands")
    .update({ subscription_status: "active" })
    .eq("stripe_subscription_id", subId);
  return Response.json({ received: true, paid: subId });
}

// ─── helpers ──────────────────────────────────────────────────────────

/**
 * Extract the subscription id from an Invoice across Stripe API
 * versions. Newer API exposes it as `invoice.subscription` (string |
 * Subscription); older snapshots might use `invoice.subscription_id`.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as {
    subscription?: string | Stripe.Subscription | null;
    subscription_id?: string | null;
  };
  if (typeof raw.subscription === "string") return raw.subscription;
  if (raw.subscription && typeof raw.subscription === "object") {
    return raw.subscription.id;
  }
  if (raw.subscription_id) return raw.subscription_id;
  return null;
}

/**
 * Read the current_period_end on a Subscription. Recent Stripe API
 * versions moved this off the Subscription onto the SubscriptionItem;
 * older versions still expose it at the top level. Try both.
 */
function readCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  const raw = sub as unknown as {
    current_period_end?: number | null;
    items?: { data?: Array<{ current_period_end?: number | null }> };
  };
  if (typeof raw.current_period_end === "number") {
    return raw.current_period_end;
  }
  const item = raw.items?.data?.[0];
  if (item && typeof item.current_period_end === "number") {
    return item.current_period_end;
  }
  return null;
}
