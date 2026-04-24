import { supabaseAdmin } from "./supabase-admin";
import { startHyperFramesRender, type HyperFramesVars } from "./hyperframes";

export interface RunScriptOptions {
  scriptName: string;
  brandId?: string | null;
  postId?: number | null;
  vars?: HyperFramesVars;
}

/**
 * Dev-only script dispatcher. Production API routes should refuse to call this.
 * Inserts a script_runs row, kicks off the work in the background, and returns runId.
 */
export async function runScript(opts: RunScriptOptions): Promise<number> {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_LOCAL_SCRIPTS !== "1") {
    throw new Error("Script execution is only available in local development");
  }

  const { scriptName, brandId = null, postId = null, vars } = opts;
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from("script_runs")
    .insert({
      script_name: scriptName,
      brand_id: brandId,
      post_id: postId,
      started_at: new Date().toISOString(),
      status: "running",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Could not create script_runs row: ${error?.message}`);
  }
  const runId = Number((data as { id: number }).id);

  // Dispatch per script name. All handlers run async; failures are captured
  // into script_runs.output so the client can poll.
  switch (scriptName) {
    case "hyperframes_render": {
      if (!postId) throw new Error("hyperframes_render requires postId");
      // Intentional fire-and-forget: the renderer updates script_runs when done.
      void startHyperFramesRender(runId, { postId, overrides: vars });
      break;
    }
    default:
      await admin
        .from("script_runs")
        .update({
          status: "error",
          output: `Unknown script: ${scriptName}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      throw new Error(`Unknown script: ${scriptName}`);
  }

  return runId;
}
