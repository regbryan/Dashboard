import type { NextRequest } from "next/server";
import { deriveAllBrands } from "@/lib/autopilot/derive-kit";

// Each brand = one Gemini text call. 8 brands * ~5s each = under 60s, but
// give headroom for slow models.
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { results } = await deriveAllBrands();
    const ok = results.filter((r) => r.ok).length;
    const failed = results.length - ok;
    return Response.json({ ok: true, summary: { total: results.length, ok, failed }, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
