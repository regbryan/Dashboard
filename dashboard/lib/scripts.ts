import { spawn } from "child_process";
import { getDb } from "@/lib/db";
import { PROJECT_ROOT } from "@/lib/paths";

export function runScript(options: {
  scriptName: string;
  args?: string[];
  brandId?: string;
  postId?: number;
}): number {
  const { scriptName, args = [], brandId, postId } = options;
  const db = getDb();
  const now = new Date().toISOString();

  // Insert script_runs record with status "running"
  const result = db
    .prepare(
      "INSERT INTO script_runs (script_name, brand_id, post_id, started_at, status) VALUES (?, ?, ?, ?, ?)"
    )
    .run(scriptName, brandId || null, postId || null, now, "running");

  const runId = Number(result.lastInsertRowid);

  // Spawn the Python process
  const child = spawn("python", args, {
    cwd: PROJECT_ROOT,
    shell: true,
  });

  let output = "";

  child.stdout.on("data", (data: Buffer) => {
    output += data.toString();
  });

  child.stderr.on("data", (data: Buffer) => {
    output += data.toString();
  });

  child.on("close", (code: number | null) => {
    const completedAt = new Date().toISOString();
    const finalStatus = code === 0 ? "success" : "error";

    db.prepare(
      "UPDATE script_runs SET status = ?, output = ?, completed_at = ? WHERE id = ?"
    ).run(finalStatus, output, completedAt, runId);
  });

  child.on("error", (err: Error) => {
    const completedAt = new Date().toISOString();
    db.prepare(
      "UPDATE script_runs SET status = ?, output = ?, completed_at = ? WHERE id = ?"
    ).run("error", `Spawn error: ${err.message}`, completedAt, runId);
  });

  return runId;
}
