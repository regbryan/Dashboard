import type { NextRequest } from "next/server";
import { deriveAllBrands } from "@/lib/autopilot/derive-kit";
import { deriveVisualsForAllBrands } from "@/lib/autopilot/derive-visuals";

import { withRequestContext } from "@/lib/request-context";

// Two passes (text + visuals) across N brands. Pro plan caps at 300s so we
// match that ceiling. If derivation across all brands ever doesn't fit, we
// switch to sharding (split brand list across multiple invocations) rather
// than asking for a higher cap.
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  return withRequestContext(req as Request, () => handleGET(req));
}

async function handleGET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const [text, visuals] = await Promise.all([
      deriveAllBrands(),
      deriveVisualsForAllBrands(),
    ]);
    const textOk = text.results.filter((r) => r.ok).length;
    const visualsOk = visuals.results.filter((r) => r.ok).length;
    return Response.json({
      ok: true,
      summary: {
        text: { total: text.results.length, ok: textOk },
        visuals: { total: visuals.results.length, ok: visualsOk },
      },
      text: text.results,
      visuals: visuals.results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
