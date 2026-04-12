import { getDb } from "@/lib/db";
import { runScript } from "@/lib/scripts";
import { PROJECT_ROOT } from "@/lib/paths";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();

  const { script, brand_id, post_id } = body;

  if (!script) {
    return Response.json({ error: "script is required" }, { status: 400 });
  }

  const validScripts = ["overlay_logo", "extract_captions", "run_all_overlays"];
  if (!validScripts.includes(script)) {
    return Response.json(
      { error: `Invalid script. Must be one of: ${validScripts.join(", ")}` },
      { status: 400 }
    );
  }

  let args: string[] = [];
  let brandId = brand_id;
  let postId = post_id;

  if (script === "extract_captions") {
    args = ["extract_captions.py"];
    if (brand_id) {
      const brand = db
        .prepare("SELECT * FROM brands WHERE id = ?")
        .get(brand_id) as Record<string, unknown> | undefined;
      if (!brand) {
        return Response.json({ error: "Brand not found" }, { status: 404 });
      }
      args.push("--brand", brand.name as string);
    }
  } else if (script === "run_all_overlays") {
    args = ["run_all_overlays.py"];
  } else if (script === "overlay_logo") {
    if (!brand_id || !post_id) {
      return Response.json(
        { error: "brand_id and post_id are required for overlay_logo" },
        { status: 400 }
      );
    }

    const brand = db
      .prepare("SELECT * FROM brands WHERE id = ?")
      .get(brand_id) as Record<string, unknown> | undefined;
    if (!brand) {
      return Response.json({ error: "Brand not found" }, { status: 404 });
    }

    const post = db
      .prepare("SELECT * FROM posts WHERE id = ?")
      .get(post_id) as Record<string, unknown> | undefined;
    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (!brand.logo_path) {
      return Response.json(
        { error: "Brand has no logo_path configured" },
        { status: 400 }
      );
    }

    const postPath = `${PROJECT_ROOT}/${brand.folder_path}/${post.file_path}`;
    const logoPath = `${PROJECT_ROOT}/${brand.folder_path}/${brand.logo_path}`;
    const position = brand.logo_position as string;
    const maxWidth = String(brand.logo_max_width);
    const padding = String(brand.logo_padding);
    const bgBlock = (brand.logo_bg_block as string) || "None";

    const oneLiner = `import sys; sys.path.insert(0, '.'); from overlay_logo import overlay_logo; overlay_logo(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), int(sys.argv[5]), sys.argv[6] if sys.argv[6] != 'None' else None)`;
    args = ["-c", oneLiner, postPath, logoPath, position, maxWidth, padding, bgBlock];
  }

  const runId = runScript({
    scriptName: script,
    args,
    brandId,
    postId,
  });

  return Response.json({ run_id: runId });
}
