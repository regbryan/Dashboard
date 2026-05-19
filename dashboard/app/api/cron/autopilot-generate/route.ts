import type { NextRequest } from "next/server";
import { runAllBrandsAutopilot, runBrandAutopilot } from "@/lib/autopilot";

import { withRequestContext } from "@/lib/request-context";

// 300s ceiling matches Vercel Pro's cap. Each gen is 5-20s; per-brand cap of
// 3 + N brands keeps us well inside this.
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const q = req.nextUrl.searchParams.get("secret");
  return q === secret;
}

export async function GET(req: NextRequest) {
  return withRequestContext(req as Request, () => handleGET(req));
}

async function handleGET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const lookaheadParam = req.nextUrl.searchParams.get("lookahead");
  const lookaheadDays = lookaheadParam ? Number(lookaheadParam) : undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  const brandFilter = req.nextUrl.searchParams.get("brand");

  try {
    if (brandFilter) {
      const summary = await runBrandAutopilot(brandFilter, {
        dryRun,
        lookaheadDays:
          Number.isFinite(lookaheadDays) && lookaheadDays! > 0
            ? lookaheadDays
            : undefined,
        limit: Number.isFinite(limit) && limit! > 0 ? limit : undefined,
      });
      return Response.json({ ok: true, dryRun, summaries: [summary] });
    }
    const { summaries } = await runAllBrandsAutopilot({
      dryRun,
      lookaheadDays:
        Number.isFinite(lookaheadDays) && lookaheadDays! > 0
          ? lookaheadDays
          : undefined,
      limitPerBrand: Number.isFinite(limit) && limit! > 0 ? limit : undefined,
    });
    return Response.json({ ok: true, dryRun, summaries });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
