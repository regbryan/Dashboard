import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

import { withRequestContext } from "@/lib/request-context";

// Admin-only PATCH for human-only brand-kit fields. The derivation pipeline
// fills in positioning / tone / pillars / hashtags / photography direction /
// colors / fonts automatically. This endpoint covers the fields a human
// has to provide once per brand: archetype, industry, anti-patterns,
// named color roles.

const VALID_ARCHETYPES = new Set([
  "Hero",
  "Caregiver",
  "Sage",
  "Outlaw",
  "Creator",
  "Innocent",
  "Explorer",
  "Ruler",
  "Magician",
  "Lover",
  "Jester",
  "Everyman",
]);

type PatchBody = {
  archetype?: string | null;
  industry?: string | null;
  visual_donts?: string[] | null;
  // Color roles get merged into the existing colors jsonb under .roles.
  color_roles?: {
    background?: string | null;
    text?: string | null;
    cta?: string | null;
    highlight?: string | null;
    neutral_dark?: string | null;
    neutral_light?: string | null;
  } | null;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(req as Request, () => handlePATCH(req, { params }));
}

async function handlePATCH(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    await requireAdmin();
    const { brandId } = await params;

    let body: PatchBody;
    try {
      body = (await req.json()) as PatchBody;
    } catch {
      return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
    }

    if (body.archetype && !VALID_ARCHETYPES.has(body.archetype)) {
      return Response.json(
        { ok: false, error: `archetype must be one of: ${[...VALID_ARCHETYPES].join(", ")}` },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // Load existing colors so we can preserve hex codes that came from
    // derivation while patching the .roles sub-object.
    const { data: existing } = await admin
      .from("brand_kits")
      .select("colors")
      .eq("slug", brandId)
      .maybeSingle();
    const existingColors =
      (existing as { colors: Record<string, unknown> | null } | null)?.colors ?? {};

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if ("archetype" in body) updates.archetype = body.archetype || null;
    if ("industry" in body) updates.industry = body.industry || null;
    if ("visual_donts" in body) {
      const arr = Array.isArray(body.visual_donts) ? body.visual_donts : null;
      updates.visual_donts = arr ? arr.filter((s) => typeof s === "string" && s.trim().length > 0) : null;
    }
    if ("color_roles" in body) {
      const cleanedRoles = body.color_roles
        ? Object.fromEntries(
            Object.entries(body.color_roles).filter(
              ([, v]) => typeof v === "string" && v.trim().length > 0
            )
          )
        : null;
      updates.colors = {
        ...existingColors,
        roles: cleanedRoles && Object.keys(cleanedRoles).length > 0 ? cleanedRoles : undefined,
      };
    }

    const { error } = await admin
      .from("brand_kits")
      .update(updates)
      .eq("slug", brandId);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
