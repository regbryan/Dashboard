import { supabaseAdmin } from "./supabase-admin";
import { startHyperFramesRender, type HyperFramesVars } from "./hyperframes";
import {
  applyOverlayLogo,
  undoOverlayLogo,
  VALID_POSITIONS,
  type OverlayPosition,
} from "./overlay-logo";

export interface RunScriptOptions {
  scriptName: string;
  brandId?: string | null;
  postId?: number | null;
  vars?: HyperFramesVars | Record<string, unknown>;
}

/**
 * Script dispatcher. Inserts a script_runs row, kicks off the work in the
 * background, returns runId. The /api/run-script route is the only caller
 * and gates which scripts are allowed in production (overlay_logo and
 * undo_logo are now production-safe via sharp + Supabase Storage).
 */
export async function runScript(opts: RunScriptOptions): Promise<number> {
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
      void startHyperFramesRender(runId, {
        postId,
        overrides: vars as HyperFramesVars | undefined,
      });
      break;
    }
    case "overlay_logo": {
      if (!postId) throw new Error("overlay_logo requires postId");
      const v = (vars ?? {}) as Record<string, unknown>;
      const position =
        typeof v.position === "string" &&
        (VALID_POSITIONS as readonly string[]).includes(v.position)
          ? (v.position as OverlayPosition)
          : "top-left";
      const overlayVars = {
        position,
        maxLogoWidth:
          typeof v.maxLogoWidth === "number" ? v.maxLogoWidth : undefined,
        padding: typeof v.padding === "number" ? v.padding : undefined,
        backgroundBlock:
          typeof v.backgroundBlock === "string" ? v.backgroundBlock : null,
        xPct: typeof v.xPct === "number" ? v.xPct : undefined,
        yPct: typeof v.yPct === "number" ? v.yPct : undefined,
        logoId: typeof v.logoId === "string" ? v.logoId : undefined,
      };
      void applyOverlayLogo(postId, overlayVars).then((res) =>
        admin
          .from("script_runs")
          .update({
            status: res.ok ? "success" : "error",
            output: res.ok ? "Overlay applied" : res.error,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId)
      );
      break;
    }
    case "undo_logo": {
      if (!postId) throw new Error("undo_logo requires postId");
      void undoOverlayLogo(postId).then((res) =>
        admin
          .from("script_runs")
          .update({
            status: res.ok ? "success" : "error",
            output: res.ok ? "Overlay reverted" : res.error,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId)
      );
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
