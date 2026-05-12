import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { deriveBrandKitForSlug } from "@/lib/autopilot/derive-kit";
import { deriveBrandVisuals } from "@/lib/autopilot/derive-visuals";

export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    await requireAdmin();
    const { brandId } = await params;

    // Run text and visual derivation in parallel. Either may fail
    // independently — text needs >=3 approved posts, visuals need at least
    // one approved post with a file_path. Return both results so the user
    // sees what worked and what didn't.
    const [textResult, visualsResult] = await Promise.all([
      deriveBrandKitForSlug(brandId),
      deriveBrandVisuals(brandId),
    ]);

    const anyOk =
      ("ok" in textResult && textResult.ok) ||
      ("ok" in visualsResult && visualsResult.ok);

    return Response.json(
      { ok: anyOk, text: textResult, visuals: visualsResult },
      { status: anyOk ? 200 : 400 }
    );
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
