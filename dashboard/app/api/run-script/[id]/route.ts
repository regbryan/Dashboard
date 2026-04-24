import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { parseRenderedMp4Path } from "@/lib/hyperframes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_LOCAL_SCRIPTS !== "1"
  ) {
    return Response.json(
      { error: "Script execution is only available in local development" },
      { status: 501 }
    );
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
