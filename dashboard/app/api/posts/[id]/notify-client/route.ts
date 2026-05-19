import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { notifyOnePost } from "@/lib/client-notify";

import { withRequestContext } from "@/lib/request-context";

// Manual "Send Email Now" trigger from the admin post page. Admin-only —
// reuses the same notify function the cron uses, so the email and the
// client_notified_at stamp are identical between manual and scheduled paths.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestContext(_req as Request, () => handlePOST(_req, { params }));
}

async function handlePOST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await notifyOnePost(id);
    if (!result.ok && result.error) {
      return Response.json({ error: result.error }, { status: 500 });
    }
    return Response.json(result);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
