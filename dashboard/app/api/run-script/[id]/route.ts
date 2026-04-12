import { getDb } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const run = db
    .prepare("SELECT * FROM script_runs WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!run) {
    return Response.json({ error: "Script run not found" }, { status: 404 });
  }

  return Response.json({
    id: run.id,
    script_name: run.script_name,
    brand_id: run.brand_id,
    post_id: run.post_id,
    status: run.status,
    output: run.output,
    started_at: run.started_at,
    completed_at: run.completed_at,
  });
}
