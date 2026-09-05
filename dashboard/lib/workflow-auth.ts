import "server-only";
import type { NextRequest } from "next/server";

// Shared-secret auth for machine-to-machine calls FROM the workflow platform
// (Dify) INTO the dashboard — the hiring-draft ingest + dedup endpoints. Not a
// user session; the caller proves itself with WORKFLOW_INGEST_SECRET, sent as
// `Authorization: Bearer <secret>` (preferred) or `?secret=<secret>`.
// Mirrors the cron routes' CRON_SECRET pattern.
export function authorizeWorkflow(req: NextRequest): boolean {
  const secret = process.env.WORKFLOW_INGEST_SECRET;
  if (!secret) return false; // unset => deny (fail closed)
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}
