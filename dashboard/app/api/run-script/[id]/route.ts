import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseRenderedMp4Path } from "@/lib/hyperframes";
import { requireAdmin, handleAuthError } from "@/lib/api-auth";

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
  // NOTE: no production gate here. This endpoint only READS a script_runs row
  // (it executes nothing), and the client must be able to poll run status in
  // production for the production-safe scripts (overlay_logo, overlay_footer,
  // and their undos). The POST route is what gates actual execution. A stray
  // 501 here made the client poll until its 90s timeout — apply jobs ran fine
  // server-side but never reported success/failure back to the UI.
  try {
    await requireAdmin();
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("script_runs")
    .select("id, script_name, status, output, started_at, completed_at, post_id")
    .eq("id", runId)
    .single();

  if (error || !data) {
    return Response.json({ error: "run not found" }, { status: 404 });
  }

  const row = data as {
    id: number;
    script_name: string;
    status: string;
    output: string | null;
    started_at: string;
    completed_at: string | null;
    post_id: number | null;
  };

  return Response.json({
    runId: row.id,
    scriptName: row.script_name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    postId: row.post_id,
    output: row.output,
    renderedPath: parseRenderedMp4Path(row.output),
  });
}
