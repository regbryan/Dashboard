import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { loadOrSynthesizeBrief, saveBrief, type ImageBrief } from "@/lib/autopilot/brief";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await params;
    const postId = Number(idStr);
    if (!Number.isFinite(postId)) {
      return Response.json({ ok: false, error: "invalid post id" }, { status: 400 });
    }
    const result = await loadOrSynthesizeBrief(postId);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await params;
    const postId = Number(idStr);
    if (!Number.isFinite(postId)) {
      return Response.json({ ok: false, error: "invalid post id" }, { status: 400 });
    }
    let body: { brief?: ImageBrief };
    try {
      body = (await req.json()) as { brief?: ImageBrief };
    } catch {
      return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
    }
    if (!body.brief || typeof body.brief !== "object") {
      return Response.json({ ok: false, error: "brief is required" }, { status: 400 });
    }
    const result = await saveBrief(postId, body.brief);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
