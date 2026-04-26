import { requirePostAccess, handleAuthError } from "@/lib/api-auth";
import { hasLogoSnapshot } from "@/lib/overlay-logo";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);
    if (!Number.isFinite(postId)) {
      return Response.json({ error: "invalid id" }, { status: 400 });
    }
    const { ctx } = await requirePostAccess(postId);
    if (!ctx.isAdmin) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const has = await hasLogoSnapshot(postId);
    return Response.json({ hasSnapshot: has });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
