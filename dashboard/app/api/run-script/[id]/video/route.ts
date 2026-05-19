import type { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseRenderedMp4Path } from "@/lib/hyperframes";
import { requireAdmin, AuthError } from "@/lib/api-auth";

import { withRequestContext } from "@/lib/request-context";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestContext(_request as Request, () => handleGET(_request, { params }));
}

async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_LOCAL_SCRIPTS !== "1"
  ) {
    return new Response("Not available in production", { status: 501 });
  }

  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(err.body.error, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) {
    return new Response("invalid id", { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("script_runs")
    .select("output")
    .eq("id", runId)
    .single();

  if (error || !data) {
    return new Response("not found", { status: 404 });
  }

  const mp4Path = parseRenderedMp4Path((data as { output: string | null }).output);
  if (!mp4Path) {
    return new Response("no render yet", { status: 404 });
  }

  // Path-traversal guard: rendered files must live under <root>/.renders.
  // This route is dev-only (gated above) so cwd resolution is safe; the
  // turbopackIgnore comment stops the NFT tracer from pulling the whole
  // project into this route's bundle.
  const normalized = path.resolve(mp4Path);
  const projectRoot = process.env.PROJECT_ROOT ?? /*turbopackIgnore: true*/ process.cwd();
  const rendersRoot = path.resolve(projectRoot, ".renders");
  if (!normalized.startsWith(rendersRoot + path.sep) && normalized !== rendersRoot) {
    return new Response("forbidden", { status: 403 });
  }
  if (!fs.existsSync(normalized)) {
    return new Response("file missing", { status: 404 });
  }

  const bytes = fs.readFileSync(normalized);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}
