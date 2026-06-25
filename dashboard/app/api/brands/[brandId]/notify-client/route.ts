import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { notifyBrandReady } from "@/lib/client-notify";
import { withRequestContext } from "@/lib/request-context";

// On-demand "Notify client" for a brand: send one consolidated "designs ready
// for review" email to the brand's client allowlist covering every in_review
// post not yet notified, and stamp them. Admin-only. Mirrors notify-client
// per-post, but scoped to a whole brand from the brand page.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(req as Request, () => handlePOST(req, { params }));
}

async function handlePOST(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    await requireAdmin();
    const { brandId } = await params;
    const result = await notifyBrandReady(brandId);
    if (!result.ok && result.error) {
      return Response.json(result, { status: 500 });
    }
    return Response.json(result);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
