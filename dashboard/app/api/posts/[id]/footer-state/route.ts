import { requirePostAccess, handleAuthError } from "@/lib/api-auth";
import { hasFooterSnapshot } from "@/lib/overlay-footer";

import { withRequestContext } from "@/lib/request-context";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestContext(_req as Request, () => handleGET(_req, { params }));
}

async function handleGET(
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
    const has = await hasFooterSnapshot(postId);
    return Response.json({ hasSnapshot: has });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
