import { after } from "next/server";
import { requireUser, handleAuthError, AuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWelcomeEmail } from "@/lib/emails/welcome";
import { seedFirstBatch } from "@/lib/autopilot/seed-first-batch";
import { runBrandAutopilot } from "@/lib/autopilot";
import { logger } from "@/lib/logger";

/**
 * Self-serve provisioning endpoint.
 *
 * Called from the /onboarding form when a signed-in user (Google OAuth)
 * submits their brand details. We create three rows in one atomic
 * sequence:
 *
 *   1. `brands` — public-facing identity (name, handle, platform,
 *      colors, cadence)
 *   2. `brand_kits` — voice + content + visual rules used by the
 *      autopilot. The fields are sparse on first submit; the rest get
 *      filled in by derivation from approved posts or by the operator
 *      via the Edit form.
 *   3. `user_brand_access` — ties the signed-in user to the new brand
 *      so they can immediately see it on their dashboard.
 *
 * Slug must be unique and url-safe. We re-check existence inside the
 * transaction so two concurrent submissions can't race.
 */
export const dynamic = "force-dynamic";

type OnboardingPayload = {
  slug: string;
  name: string;
  handle?: string | null;
  platform?: string | null;
  cadence?: string | null;
  websiteUrl?: string | null;
  tagline?: string | null;
  positioning?: string | null;
  mission?: string | null;
  description?: string | null;
  hqLocation?: string | null;
  archetype?: string | null;
  industry?: string | null;
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  colorAccent?: string | null;
  toneKeywords?: string[];
  dos?: string[];
  donts?: string[];
  visualDonts?: string[];
  contentPillars?: Array<{ name: string; pct: number | null; description?: string }>;
  audiences?: Array<{ tier: string; description: string }>;
  hashtagsAlwaysOn?: string[];
  hashtagsLocal?: string[];
  hashtagsService?: string[];
  hashtagsCommunity?: string[];
};

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = await requireUser();

    const body = (await req.json().catch(() => null)) as OnboardingPayload | null;
    if (!body) {
      throw new AuthError(400, { error: "invalid_body" });
    }
    if (!body.slug || !SLUG_RE.test(body.slug)) {
      throw new AuthError(400, {
        error:
          "Slug must be lowercase letters, numbers, or hyphens. 2 to 32 characters, no leading or trailing hyphen.",
      });
    }
    if (!body.name || body.name.trim().length === 0) {
      throw new AuthError(400, { error: "Brand name is required." });
    }

    const admin = supabaseAdmin();

    // Build the brand_kits payload as JSON for the RPC. Fields that
    // came in empty stay omitted; the SQL function coalesces them.
    const tone: Record<string, unknown> = {};
    if (body.toneKeywords?.length) tone.keywords = body.toneKeywords;
    if (body.dos?.length) tone.dos = body.dos;
    if (body.donts?.length) tone.donts = body.donts;

    const colors: Record<string, unknown> = {};
    if (body.colorPrimary) colors.primary = body.colorPrimary;
    if (body.colorSecondary) colors.secondary = body.colorSecondary;
    if (body.colorAccent) colors.accent = body.colorAccent;

    const hashtags: Record<string, string[]> = {};
    if (body.hashtagsAlwaysOn?.length) hashtags.always_on = body.hashtagsAlwaysOn;
    if (body.hashtagsLocal?.length) hashtags.local = body.hashtagsLocal;
    if (body.hashtagsService?.length) hashtags.service = body.hashtagsService;
    if (body.hashtagsCommunity?.length) hashtags.community = body.hashtagsCommunity;

    const kitPayload: Record<string, unknown> = {
      tagline: body.tagline?.trim() || null,
      positioning: body.positioning?.trim() || null,
      mission: body.mission?.trim() || null,
      description: body.description?.trim() || null,
      hq_location: body.hqLocation?.trim() || null,
      archetype: body.archetype?.trim() || null,
      industry: body.industry?.trim() || null,
      primary_platform: body.platform?.trim() || "instagram",
      website_url: body.websiteUrl?.trim() || null,
      colors: Object.keys(colors).length > 0 ? colors : null,
      tone: Object.keys(tone).length > 0 ? tone : null,
      content_pillars: body.contentPillars?.length ? body.contentPillars : null,
      audiences: body.audiences?.length ? body.audiences : null,
      hashtags: Object.keys(hashtags).length > 0 ? hashtags : null,
      visual_donts: body.visualDonts?.length ? body.visualDonts : null,
      onboarding_status: "completed_self_serve",
    };

    // Atomic insert: brands + brand_kits + user_brand_access in one
    // Postgres transaction. If any of the three fails, Postgres rolls
    // back automatically — no half-provisioned brand stranded.
    const { data: rpcResult, error: rpcErr } = await admin.rpc(
      "provision_brand",
      {
        p_slug: body.slug,
        p_name: body.name.trim(),
        p_handle: body.handle?.trim() || null,
        p_platform: body.platform?.trim() || "instagram",
        p_cadence: body.cadence?.trim() || null,
        p_color_primary: body.colorPrimary || null,
        p_color_secondary: body.colorSecondary || null,
        p_color_accent: body.colorAccent || null,
        p_kit_payload: kitPayload,
        p_user_id: ctx.user.id,
      }
    );

    if (rpcErr) {
      logger.error("onboarding/create", "RPC transport error", { err: rpcErr });
      throw new AuthError(500, { error: "Failed to create brand." });
    }
    const result = rpcResult as
      | { ok: true; slug: string }
      | { ok: false; code: string; error: string; sqlstate?: string };
    if (!result.ok) {
      logger.warn("onboarding/create", "provision rejected", { result });
      throw new AuthError(result.code === "slug_taken" ? 409 : 500, {
        error: result.error,
      });
    }

    // 4. Claim the pending_signup if this user was Stripe-staged, and
    // copy the subscription state onto the new brand row so the
    // autopilot gate has something to check.
    const { data: pending } = await admin
      .from("pending_signups")
      .select(
        "id, tier, stripe_customer_id, stripe_subscription_id"
      )
      .or(
        `claimed_by_user_id.eq.${ctx.user.id},email.eq.${(ctx.user.email ?? "").toLowerCase()}`
      )
      .is("claimed_at", null)
      .limit(1)
      .maybeSingle();
    if (pending) {
      // Copy Stripe state onto the brand FIRST — if this fails the
      // webhook can still recover via stripe_customer_id matching, so
      // leave pending_signups un-claimed until the brand update lands.
      const { error: brandUpdateErr } = await admin
        .from("brands")
        .update({
          subscription_status: "active",
          subscription_tier: pending.tier,
          stripe_customer_id: pending.stripe_customer_id,
          stripe_subscription_id: pending.stripe_subscription_id,
        })
        .eq("id", body.slug);
      if (brandUpdateErr) {
        logger.error(
          "onboarding/create",
          "failed to copy Stripe state onto brand",
          { brand: body.slug, pending: pending.id, err: brandUpdateErr }
        );
        // Don't claim the pending row — let the webhook/operator
        // recover. The brand still works, just without subscription
        // metadata until reconciliation.
      } else {
        const { error: claimErr } = await admin
          .from("pending_signups")
          .update({
            claimed_at: new Date().toISOString(),
            claimed_by_user_id: ctx.user.id,
            claimed_brand_id: body.slug,
          })
          .eq("id", pending.id);
        if (claimErr) {
          logger.error("onboarding/create", "failed to claim pending_signup", {
            pending: pending.id,
            err: claimErr,
          });
        }
      }
    }

    // 5. Seed the calendar — create ~14 days of placeholder posts so
    // the customer's Designs / Calendar tabs aren't empty when they
    // first land. Synchronous because we want the calendar populated
    // BEFORE the redirect. Then fire-and-forget kick off image
    // generation for the first 2 posts so they see content within
    // a minute or two without waiting for tomorrow's cron tick.
    const seed = await seedFirstBatch(body.slug).catch((err) => {
      logger.warn("onboarding/create", "seed failed", { err });
      return null;
    });
    if (seed && !seed.skipped && seed.postsCreated > 0) {
      // after() keeps the work alive on Vercel after the response is
      // sent — otherwise the serverless container can be frozen mid-
      // generation and the customer's first posts never finish.
      after(async () => {
        try {
          const summary = await runBrandAutopilot(body.slug, {
            limit: 2,
            lookaheadDays: 14,
          });
          if (summary.failed > 0) {
            logger.warn(
              "onboarding/create",
              "first-batch autopilot had failures",
              { errors: summary.errors }
            );
          }
        } catch (err) {
          logger.warn("onboarding/create", "autopilot kickoff failed", { err });
        }
      });
    }

    // 6. Welcome email — fire-and-forget so a transient Resend outage
    // doesn't block the redirect to the user's brand new dashboard.
    // We pull tier from the just-claimed pending_signup if present.
    if (ctx.user.email) {
      const dashboardOrigin =
        process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN ||
        new URL(req.url).origin;
      const tier = pending?.tier ?? null;
      const userEmail = ctx.user.email;
      const brandName = body.name.trim();
      const brandSlug = body.slug;
      after(async () => {
        const res = await sendWelcomeEmail({
          to: userEmail,
          brandName,
          brandSlug,
          tier,
          dashboardUrl: dashboardOrigin,
        });
        if (!res.ok) {
          logger.warn("onboarding/create", "welcome email failed", { err: res.error });
        }
      });
    }

    return Response.json({
      ok: true,
      slug: body.slug,
      redirect: `/dashboard/brand/${body.slug}`,
    });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
