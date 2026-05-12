import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { deriveBrandKitForSlug } from "@/lib/autopilot/derive-kit";

export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    await requireAdmin();
    const { brandId } = await params;
    const result = await deriveBrandKitForSlug(brandId);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 400 });
    }
    return Response.json(result);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
