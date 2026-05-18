import {
  requireAdmin,
  handleAuthError,
  AuthError,
} from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Set or clear the SocialPilot account binding for a brand.
 *
 * PUT { socialpilot_account_id: string | null }
 *
 * Admin-only because the SP dropdown is in the operator panel. Also
 * enforces tier === 'growth' — the queueing feature is Growth-only,
 * so we don't let Starter brands bind a SP profile (avoids confusion
 * where the binding is set but nothing actually queues).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
): Promise<Response> {
  try {
    await requireAdmin();
    const { brandId } = await params;

    const body = (await req.json().catch(() => null)) as
      | { socialpilot_account_id?: string | null }
      | null;
    if (!body || !("socialpilot_account_id" in body)) {
      throw new AuthError(400, { error: "missing_socialpilot_account_id" });
    }
    const accountId = body.socialpilot_account_id;
    if (accountId !== null && (typeof accountId !== "string" || !accountId.trim())) {
      throw new AuthError(400, { error: "invalid_account_id" });
    }

    const admin = supabaseAdmin();

    // Tier gate. Growth-only.
    const { data: brand, error: brandErr } = await admin
      .from("brands")
      .select("id, subscription_tier")
      .eq("id", brandId)
      .maybeSingle();
    if (brandErr || !brand) {
      throw new AuthError(404, { error: "brand_not_found" });
    }
    const tier = (brand as { subscription_tier?: string | null })
      .subscription_tier;
    if (tier !== "growth" && accountId !== null) {
      throw new AuthError(409, {
        error:
          "SocialPilot publishing is a Growth-tier feature. Upgrade the " +
          "brand's subscription before binding a SocialPilot account.",
      });
    }

    const { error: updErr } = await admin
      .from("brands")
      .update({ socialpilot_account_id: accountId })
      .eq("id", brandId);
    if (updErr) {
      logger.error("brands/socialpilot", "update failed", { err: updErr });
      throw new AuthError(500, { error: "update_failed" });
    }

    return Response.json({ ok: true, brand_id: brandId, socialpilot_account_id: accountId });
  } catch (err) {
    const handled = handleAuthError(err);
    if (handled) return handled;
    throw err;
  }
}
