import { requireAdmin, handleAuthError, AuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

import { withRequestContext } from "@/lib/request-context";

/**
 * Set the brand's auto-overlay rules. JSON array, each element shaped
 * like `{ type: "logo" | "footer", ...params }`. Pass `null` or `[]`
 * to clear (brand falls back to no auto-overlay — operator handles
 * via the manual Footer/Logo Overlay panels on each post).
 *
 * Admin-only. The schema is stored as raw jsonb so we can iterate
 * without migrations; lib/publishing-pipeline.ts validates shape at
 * apply time and refuses unknown discriminators.
 *
 * GET returns the current value for the editor; PUT replaces it.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
): Promise<Response> {
  return withRequestContext(_req as Request, () => handleGET(_req, { params }));
}

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
): Promise<Response> {
  try {
    await requireAdmin();
    const { brandId } = await params;
    const { data, error } = await supabaseAdmin()
      .from("brands")
      .select("publishing_overlays")
      .eq("id", brandId)
      .maybeSingle();
    if (error || !data) {
      throw new AuthError(404, { error: "brand_not_found" });
    }
    return Response.json({
      brand_id: brandId,
      overlays:
        (data as { publishing_overlays?: unknown }).publishing_overlays ?? null,
    });
  } catch (err) {
    const handled = handleAuthError(err);
    if (handled) return handled;
    throw err;
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
): Promise<Response> {
  return withRequestContext(req as Request, () => handlePUT(req, { params }));
}

async function handlePUT(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
): Promise<Response> {
  try {
    await requireAdmin();
    const { brandId } = await params;

    const body = (await req.json().catch(() => null)) as
      | { overlays?: unknown }
      | null;
    if (!body || !("overlays" in body)) {
      throw new AuthError(400, { error: "missing_overlays_field" });
    }

    const overlays = body.overlays;
    // null or [] = clear. Otherwise must be an array of objects with
    // a string `type` of "footer" | "logo". Defensive — the DB
    // constraint also enforces array-or-null but it doesn't validate
    // element shape.
    if (overlays !== null && !Array.isArray(overlays)) {
      throw new AuthError(400, { error: "overlays_must_be_array_or_null" });
    }
    if (Array.isArray(overlays)) {
      for (let i = 0; i < overlays.length; i++) {
        const el = overlays[i];
        if (!el || typeof el !== "object") {
          throw new AuthError(400, {
            error: `overlays[${i}] must be an object`,
          });
        }
        const t = (el as { type?: unknown }).type;
        if (t !== "footer" && t !== "logo") {
          throw new AuthError(400, {
            error: `overlays[${i}].type must be "footer" or "logo"`,
          });
        }
      }
    }

    const { error: updErr } = await supabaseAdmin()
      .from("brands")
      .update({ publishing_overlays: overlays })
      .eq("id", brandId);
    if (updErr) {
      logger.error("brands/publishing-overlays", "update failed", { err: updErr });
      throw new AuthError(500, { error: "update_failed" });
    }

    return Response.json({ ok: true, brand_id: brandId, overlays });
  } catch (err) {
    const handled = handleAuthError(err);
    if (handled) return handled;
    throw err;
  }
}
