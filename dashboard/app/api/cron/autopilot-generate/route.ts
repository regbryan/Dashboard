import type { NextRequest } from "next/server";
import { runIECAutopilot } from "@/lib/autopilot";

// Long-ish budget — three Gemini image gens + uploads can take 30–60s.
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const q = req.nextUrl.searchParams.get("secret");
  return q === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const lookaheadParam = req.nextUrl.searchParams.get("lookahead");
  const lookaheadDays = lookaheadParam ? Number(lookaheadParam) : undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const summary = await runIECAutopilot({
      dryRun,
      lookaheadDays:
        Number.isFinite(lookaheadDays) && lookaheadDays! > 0
          ? lookaheadDays
          : undefined,
      limit:
        Number.isFinite(limit) && limit! > 0 ? limit : undefined,
    });
    return Response.json({ ok: true, dryRun, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
