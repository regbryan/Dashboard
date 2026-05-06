import type { NextRequest } from "next/server";
import { runScript } from "@/lib/scripts";
import { requireAdmin, handleAuthError } from "@/lib/api-auth";

// Scripts that run safely in any environment, including production on
// Vercel. These don't shell out — they read/write Supabase Storage in
// process via sharp. Other scripts (hyperframes_render, run_all_overlays,
// etc.) still spawn Python and only work locally.
const PRODUCTION_SAFE_SCRIPTS = new Set(["overlay_logo", "undo_logo"]);

export async function POST(request: NextRequest) {
  let body: {
    script?: string;
    post_id?: number;
    brand_id?: string;
    vars?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const requestedScript = body.script;
  if (!requestedScript) {
    return Response.json({ error: "script is required" }, { status: 400 });
  }

  const isProductionGated =
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_LOCAL_SCRIPTS !== "1";
  if (isProductionGated && !PRODUCTION_SAFE_SCRIPTS.has(requestedScript)) {
    return Response.json(
      { error: "Script execution is only available in local development" },
      { status: 501 }
    );
  }

  try {
    await requireAdmin();
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }

  try {
    const runId = await runScript({
      scriptName: requestedScript,
      postId: body.post_id ?? null,
      brandId: body.brand_id ?? null,
      vars: body.vars,
    });
    return Response.json({ runId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
