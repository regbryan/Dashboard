import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { applyOverlayFooter, type FooterVars } from "./overlay-footer";
import { applyOverlayLogo, type OverlayVars } from "./overlay-logo";

/**
 * Branded-overlay automation. Runs between client approval and the
 * SocialPilot queue handoff so a hands-off publish never needs the
 * operator to remember to paint a footer or composite a logo.
 *
 * Reads `brands.publishing_overlays` (jsonb array of rules). Each rule
 * has a `type` discriminator plus type-specific params that pass
 * directly into the existing applyOverlayFooter / applyOverlayLogo
 * functions. Those are idempotent (snapshot policy) so a retry path
 * doesn't double-paint.
 *
 * Returns { applied: N } on success or { applied: N, failedAt, error }
 * on the first failure — autoQueueApprovedPost treats any failure as
 * a queue failure and writes the reason to posts.socialpilot_error.
 *
 * NULL or [] rules → no-op (skipped: 'no_rules'), no error.
 */

export type OverlayRule =
  | ({ type: "footer" } & FooterRule)
  | ({ type: "logo" } & LogoRule);

// FooterVars + the discriminator. Inlining the fields here for clarity
// at the call site; keeps schema docs alongside the type.
type FooterRule = FooterVars;
type LogoRule = OverlayVars;

export type ApplyResult =
  | { ok: true; applied: number; skipped?: "no_rules" }
  | { ok: false; applied: number; failedAt: number; error: string };

export async function applyPublishingOverlays(
  postId: number | string
): Promise<ApplyResult> {
  const idNum = typeof postId === "number" ? postId : Number(postId);
  if (!Number.isFinite(idNum)) {
    return { ok: false, applied: 0, failedAt: 0, error: "invalid_post_id" };
  }

  // Load the brand's overlay rules.
  const { data: postRow } = await supabaseAdmin()
    .from("posts")
    .select("id, brand_id")
    .eq("id", idNum)
    .maybeSingle();
  if (!postRow) {
    return { ok: false, applied: 0, failedAt: 0, error: "post_not_found" };
  }
  const post = postRow as { id: number; brand_id: string };

  const { data: brandRow } = await supabaseAdmin()
    .from("brands")
    .select("publishing_overlays")
    .eq("id", post.brand_id)
    .maybeSingle();
  const overlays =
    (brandRow as { publishing_overlays?: unknown } | null)?.publishing_overlays;

  if (!overlays || !Array.isArray(overlays) || overlays.length === 0) {
    return { ok: true, applied: 0, skipped: "no_rules" };
  }

  // Validate each rule shape before doing any work — fail loudly on a
  // malformed brand config rather than half-applying.
  for (let i = 0; i < overlays.length; i++) {
    const raw = overlays[i];
    if (!raw || typeof raw !== "object" || !("type" in raw)) {
      return {
        ok: false,
        applied: 0,
        failedAt: i,
        error: `rule[${i}] missing 'type' discriminator`,
      };
    }
    const t = (raw as { type: unknown }).type;
    if (t !== "footer" && t !== "logo") {
      return {
        ok: false,
        applied: 0,
        failedAt: i,
        error: `rule[${i}] unsupported type: ${String(t)}`,
      };
    }
  }

  // Apply in array order. Each step's snapshot machinery keeps re-runs
  // idempotent — repeat applies produce the same final image.
  let applied = 0;
  for (let i = 0; i < overlays.length; i++) {
    const rule = overlays[i] as OverlayRule;
    try {
      const result =
        rule.type === "footer"
          ? await applyOverlayFooter(idNum, rule)
          : await applyOverlayLogo(idNum, rule);
      if (!result.ok) {
        return {
          ok: false,
          applied,
          failedAt: i,
          error: `rule[${i}] ${rule.type}: ${result.error}`,
        };
      }
      applied++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        applied,
        failedAt: i,
        error: `rule[${i}] ${rule.type} crashed: ${msg}`,
      };
    }
  }

  return { ok: true, applied };
}
