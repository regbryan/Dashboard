import type { NextRequest } from "next/server";
import { runScript } from "@/lib/scripts";

export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_LOCAL_SCRIPTS !== "1"
  ) {
    return Response.json(
      { error: "Script execution is only available in local development" },
      { status: 501 }
    );
  }

  let body: {
    script?: string;
    post_id?: number;
    brand_id?: string;
    vars?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const script = body.script;
  if (!script) {
    return Response.json({ error: "script is required" }, { status: 400 });
  }

  try {
    const runId = await runScript({
      scriptName: script,
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
