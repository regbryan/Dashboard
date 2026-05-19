import { stripe, priceIdForTier } from "@/lib/stripe";
import { logger } from "@/lib/logger";

import { withRequestContext } from "@/lib/request-context";

/**
 * Create a Stripe Checkout Session for a given pricing tier.
 *
 * Called by the marketing site's pricing CTAs. Returns the hosted
 * checkout URL the browser should redirect to.
 *
 * No auth — anyone landing on pricing can buy. Payment is the gate;
 * sign-in happens AFTER the customer completes checkout.
 *
 * Body:
 *   { tier: 'starter' | 'growth' }
 *
 * Response (success):
 *   { url: 'https://checkout.stripe.com/...' }
 *
 * Response (failure):
 *   { error: '...' } with appropriate status code
 */
export const dynamic = "force-dynamic";

const ALLOWED_TIERS = new Set(["starter", "growth"]);

// Allow the marketing site (and localhost in dev) to call this from
// a different origin. Pricing CTAs do a POST with JSON which triggers
// a preflight, so we need both OPTIONS handling and the headers on
// the actual response.
const ALLOWED_ORIGINS = [
  "https://socialpulse.media",
  "https://www.socialpulse.media",
  process.env.NEXT_PUBLIC_MARKETING_ORIGIN,
].filter(Boolean) as string[];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Vercel preview deploys — restrict to our project's preview pattern
  // (looser pattern previously let any *.vercel.app probe the endpoint).
  if (/^https:\/\/(?:dashboard|social-media-website)-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
    return true;
  }
  if (/^http:\/\/localhost(?::\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  // Only echo the origin back when it's actually allowed. Returning a
  // fixed fallback for foreign origins is harmless (browser still
  // rejects on mismatch) but cleaner to omit ACAO entirely so the
  // browser-side error is unambiguous.
  if (allowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: Request) {
  return withRequestContext(req as Request, () => handlePOST(req));
}

async function handlePOST(req: Request) {
  const cors = corsHeaders(req.headers.get("origin"));

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_json" },
      { status: 400, headers: cors }
    );
  }

  const tier =
    typeof body === "object" && body !== null && "tier" in body
      ? String((body as { tier: unknown }).tier).toLowerCase()
      : null;

  if (!tier || !ALLOWED_TIERS.has(tier)) {
    return Response.json(
      { error: "tier must be one of: starter, growth" },
      { status: 400, headers: cors }
    );
  }

  const priceId = priceIdForTier(tier);
  if (!priceId) {
    return Response.json(
      {
        error: `STRIPE_PRICE_${tier.toUpperCase()} env var not set. Configure the price ID in Vercel before this tier can be sold.`,
      },
      { status: 500, headers: cors }
    );
  }

  // origin tells us where to send success/cancel — usually the marketing
  // site that opened the checkout, but we also accept it overriding via
  // the env so the same Dashboard backend can serve multiple front-ends.
  const origin =
    process.env.NEXT_PUBLIC_MARKETING_ORIGIN ||
    req.headers.get("origin") ||
    "https://socialpulse.media";

  // After Stripe redirects back to the success URL, the customer needs
  // to sign in to claim their pending_signup. The Dashboard URL is the
  // home of that flow.
  const dashboardOrigin =
    process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN ||
    `https://${req.headers.get("host") ?? "dashboard.socialpulse.media"}`;

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // After success, send them to the dashboard's claim handler with
      // the session id; that route will redirect to login if they're
      // not signed in, then resume and provision their brand.
      success_url: `${dashboardOrigin}/api/onboarding/claim?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      // Pass tier through so the webhook can persist it without
      // looking up the price → tier mapping again.
      metadata: { tier },
      subscription_data: {
        metadata: { tier },
      },
      // Standard tax + promo behavior for now — can tighten later.
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return Response.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502, headers: cors }
      );
    }

    return Response.json({ url: session.url }, { headers: cors });
  } catch (err) {
    // Log the full Stripe error server-side; never echo internals
    // (parameter names, account IDs, request IDs) to the browser.
    logger.error("stripe/checkout", "session create failed", { tier, err });
    return Response.json(
      { error: "checkout_failed" },
      { status: 502, headers: cors }
    );
  }
}
