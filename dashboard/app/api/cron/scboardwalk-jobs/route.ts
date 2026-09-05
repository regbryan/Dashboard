import type { NextRequest } from "next/server";
import { runScboardwalkJobsSync } from "@/lib/scboardwalk-jobs";
import { withRequestContext } from "@/lib/request-context";

// Daily SC Boardwalk hiring sync: scrape the ATS job board, draft any NEW open
// positions as in_review hiring posts (dedup on ATS req id). Serverless render
// + a handful of storage writes stay well under the function cap.
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
  const summary = await runScboardwalkJobsSync();
  return Response.json(summary, { status: summary.ok ? 200 : 500 });
}
