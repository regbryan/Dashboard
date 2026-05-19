import { requireBrandAccess, handleAuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { brandFolderPath } from "@/lib/paths";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { withRequestContext } from "@/lib/request-context";

// Serve the brand's local logo PNG so the LogoOverlayPanel preview can render
// it in the browser. Logos live on disk under <brand folder>/<logo_path>; they
// are not in Supabase Storage (the upstream automation pipeline writes them
// locally). This route is therefore local-only — production deploys serving
// from Vercel won't have access to those files. The whole logo overlay
// feature is gated to local dev anyway via NODE_ENV/ENABLE_LOCAL_SCRIPTS, so
// that's consistent.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(_req as Request, () => handleGET(_req, { params }));
}

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const ctx = await requireBrandAccess(brandId);

    const { data: brand } = await ctx.supabase
      .from("brands")
      .select("folder_path, logo_path")
      .eq("id", brandId)
      .maybeSingle();

    const row = brand as { folder_path: string | null; logo_path: string | null } | null;
    if (!row?.folder_path || !row.logo_path) {
      return Response.json({ error: "no_logo_configured" }, { status: 404 });
    }

    // Use service role for the existsSync check path resolution — same logic
    // applyOverlayLogo uses, just for read-only serving.
    void supabaseAdmin();

    const abs = path.join(brandFolderPath(row.folder_path), row.logo_path);
    if (!existsSync(abs)) {
      return Response.json(
        { error: "logo_file_missing", path: abs },
        { status: 404 }
      );
    }

    const buf = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".svg"
        ? "image/svg+xml"
        : "application/octet-stream";

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        // Cache aggressively per-deploy. Logos rarely change; if they do, a
        // hard refresh handles it.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    throw err;
  }
}
