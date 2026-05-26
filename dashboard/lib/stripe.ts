import "server-only";
import Stripe from "stripe";

/**
 * Lazily-constructed Stripe SDK client. We don't initialize at module
 * load so the build doesn't fail when the env var isn't set (e.g.
 * preview deployments without Stripe creds). Callers should be ready
 * to handle a `null` return if they want to gracefully degrade —
 * route handlers usually just 500 if Stripe is missing, which is fine
 * because Stripe is a hard dependency of the checkout flow.
 *
 * apiVersion intentionally omitted so we pick up the account's
 * default — avoids future drift between this code and the dashboard.
 */
let _client: Stripe | null = null;

export function stripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it in Vercel env vars before using checkout."
    );
  }
  _client = new Stripe(key);
  return _client;
}

const TIER_TO_PRICE_ENV: Record<string, string> = {
  starter: "STRIPE_PRICE_STARTER",
  growth: "STRIPE_PRICE_GROWTH",
};

export function priceIdForTier(tier: string): string | null {
  const envKey = TIER_TO_PRICE_ENV[tier];
  if (!envKey) return null;
  return process.env[envKey] ?? null;
}
