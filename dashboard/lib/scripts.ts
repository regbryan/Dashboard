import { supabaseAdmin } from "./supabase-admin";
import { startHyperFramesRender, type HyperFramesVars } from "./hyperframes";
import {
  applyOverlayLogo,
  undoOverlayLogo,
  VALID_POSITIONS,
  type OverlayPosition,
} from "./overlay-logo";
import {
  applyOverlayFooter,
  undoOverlayFooter,
  type FooterPosition,
} from "./overlay-footer";

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
      // Await synchronously: sharp+storage work is fast (a few seconds) and
      // serverless functions kill fire-and-forget background work as soon
      // as the response returns. The route's HTTP response holds the
      // function alive until this completes.
      const logoRes = await applyOverlayLogo(postId, overlayVars);
      await admin
        .from("script_runs")
        .update({
          status: logoRes.ok ? "success" : "error",
          output: logoRes.ok ? "Overlay applied" : logoRes.error,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      break;
    }
    case "undo_logo": {
      if (!postId) throw new Error("undo_logo requires postId");
      const undoLogoRes = await undoOverlayLogo(postId);
      await admin
        .from("script_runs")
        .update({
          status: undoLogoRes.ok ? "success" : "error",
          output: undoLogoRes.ok ? "Overlay reverted" : undoLogoRes.error,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      break;
    }
    case "overlay_footer": {
      if (!postId) throw new Error("overlay_footer requires postId");
      const v = (vars ?? {}) as Record<string, unknown>;
      const allowedPositions = new Set([
        "bottom-center",
        "bottom-left",
        "bottom-right",
        "top-center",
        "top-left",
        "top-right",
        "custom",
      ]);
      const position =
        typeof v.position === "string" && allowedPositions.has(v.position)
          ? (v.position as FooterPosition)
          : "bottom-center";
      const allowedAlign = new Set(["left", "center", "right"]);
      const footerVars = {
        position,
        widthPct: typeof v.widthPct === "number" ? v.widthPct : undefined,
        fontSizePct:
          typeof v.fontSizePct === "number" ? v.fontSizePct : undefined,
        fitToWidth: typeof v.fitToWidth === "boolean" ? v.fitToWidth : undefined,
        color: typeof v.color === "string" ? v.color : undefined,
        background:
          typeof v.background === "string" ? v.background : null,
        backgroundOpacity:
          typeof v.backgroundOpacity === "number"
            ? v.backgroundOpacity
            : undefined,
        align:
          typeof v.align === "string" && allowedAlign.has(v.align)
            ? (v.align as "left" | "center" | "right")
            : undefined,
        xPct: typeof v.xPct === "number" ? v.xPct : undefined,
        yPct: typeof v.yPct === "number" ? v.yPct : undefined,
        edgePadding:
          typeof v.edgePadding === "number" ? v.edgePadding : undefined,
        textOverride:
          typeof v.textOverride === "string" ? v.textOverride : undefined,
      };
      const footerRes = await applyOverlayFooter(postId, footerVars);
      await admin
        .from("script_runs")
        .update({
          status: footerRes.ok ? "success" : "error",
          output: footerRes.ok ? "Footer applied" : footerRes.error,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      break;
    }
    case "undo_footer": {
      if (!postId) throw new Error("undo_footer requires postId");
      const undoFooterRes = await undoOverlayFooter(postId);
      await admin
        .from("script_runs")
        .update({
          status: undoFooterRes.ok ? "success" : "error",
          output: undoFooterRes.ok ? "Footer reverted" : undoFooterRes.error,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
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
