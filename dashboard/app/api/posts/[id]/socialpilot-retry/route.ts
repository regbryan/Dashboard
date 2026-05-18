import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { autoQueueApprovedPost } from "@/lib/socialpilot-queue";
import { logger } from "@/lib/logger";

/**
 * Retry the SocialPilot queue step for a post that previously failed
 * (or was skipped due to a transient condition). Admin-only — only
 * the operator should be retrying.
 *
 * Body: empty. We re-run the same auto-queue logic the approval handler
 * runs; idempotent if already queued.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await params;
    const outcome = await autoQueueApprovedPost(id);
    return Response.json(outcome);
  } catch (err) {
    const handled = handleAuthError(err);
    if (handled) return handled;
    logger.error("posts/socialpilot-retry", "failed", { err });
    return Response.json({ error: "retry_failed" }, { status: 500 });
  }
}
