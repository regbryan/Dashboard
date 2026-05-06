import type { NextRequest } from "next/server";
import { runClientReadyDigest } from "@/lib/client-notify";

// Daily client-facing digest. Mirrors the owner digest cron's auth pattern
// (Bearer CRON_SECRET, with ?secret=... fallback for testing).
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
  const result = await runClientReadyDigest();
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json(result);
}
