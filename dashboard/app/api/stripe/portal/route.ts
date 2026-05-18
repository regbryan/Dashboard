import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, handleAuthError, AuthError } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * Create a Stripe Customer Portal session for the signed-in user's
 * brand. Stripe hosts the portal — update payment method, view
 * invoices, cancel subscription, change tier — all without us
 * building UI for any of it.
 *
 * Returns:
 *   { url: 'https://billing.stripe.com/...' }
 *
 * Caller redirects the browser to the URL.
 *
 * Auth: signed-in user must have brand access (any role). Admins can
 * pass ?brand=<slug> to manage on behalf of a specific brand.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireUser();
    const url = new URL(req.url);
    const requestedBrand = url.searchParams.get("brand");

    // Find the brand whose billing to manage. For admins explicitly
    // request a slug; otherwise find the user's first brand.
    const admin = supabaseAdmin();
    let brandId: string | null = null;
    if (ctx.isAdmin && requestedBrand) {
      brandId = requestedBrand;
    } else {
      const { data: access } = await admin
        .from("user_brand_access")
        .select("brand_id")
        .eq("user_id", ctx.user.id)
        .limit(1)
        .maybeSingle();
      brandId = (access as { brand_id?: string } | null)?.brand_id ?? null;
    }

    if (!brandId) {
      throw new AuthError(404, {
        error: "No brand found for this user.",
      });
    }

    const { data: brand } = await admin
      .from("brands")
      .select("stripe_customer_id, name")
      .eq("id", brandId)
      .maybeSingle();

    const customerId = (
      brand as { stripe_customer_id?: string | null; name?: string } | null
    )?.stripe_customer_id;
    if (!customerId) {
      throw new AuthError(409, {
        error: `"${
          (brand as { name?: string } | null)?.name ?? brandId
        }" was manually provisioned without a Stripe customer. Billing portal isn't available. Contact support to migrate.`,
      });
    }

    // Where to send them after they close the portal. Back to their
    // brand dashboard is the obvious choice.
    const origin =
      req.headers.get("origin") ||
      `https://${req.headers.get("host") ?? "dashboard.socialpulse.media"}`;

    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/brand/${brandId}`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    // Log internals; return a generic error so we don't leak Stripe
    // request IDs / parameter names to the browser.
    logger.error("stripe/portal", "session create failed", { err });
    return Response.json(
      { error: "portal_unavailable" },
      { status: 502 }
    );
  }
}
