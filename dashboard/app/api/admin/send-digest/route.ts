import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { runFeedbackDigest } from "@/lib/digest";

import { withRequestContextFromHeaders } from "@/lib/request-context";

// Manual trigger for the feedback digest. Same logic as the twice-daily cron,
// but bypasses the quiet window so the admin gets every pending row right now.
export async function POST() {
  return withRequestContextFromHeaders(() => handlePOST());
}

async function handlePOST() {
  try {
    await requireAdmin();
    const result = await runFeedbackDigest({ ignoreQuietWindow: true });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 500 });
    }
    return Response.json(result);
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
