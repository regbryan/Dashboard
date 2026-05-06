import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { supabaseAdmin } from "./supabase-admin";
import { brandFolderPath, postImagePath, PROJECT_ROOT } from "./paths";

export const VALID_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center",
  "custom",
] as const;
export type OverlayPosition = (typeof VALID_POSITIONS)[number];

export type OverlayVars = {
  position?: OverlayPosition;
  maxLogoWidth?: number; // 0.05 – 0.6
  padding?: number; // px (ignored when position='custom')
  backgroundBlock?: string | null; // hex like "#000000"
  // For position='custom': logo top-left as fractions of post width/height.
  xPct?: number; // 0.0 – 1.0
  yPct?: number; // 0.0 – 1.0
};

type PostLookup = {
  id: number;
  brand_id: string;
  file_path: string | null;
  brands: {
    folder_path: string | null;
    logo_path: string | null;
  } | null;
};

function snapshotPath(absPostPath: string): string {
  const ext = path.extname(absPostPath);
  const base = absPostPath.slice(0, -ext.length);
  return `${base}_pre_logo${ext}`;
}

async function reuploadToSupabase(
  brandId: string,
  filePath: string,
  absPath: string
) {
  const buf = await fs.readFile(absPath);
  const sb = supabaseAdmin();
  const { error } = await sb.storage
    .from("post-images")
    .upload(`${brandId}/${filePath}`, buf, {
      contentType: "image/png",
      upsert: true,
    });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
}

async function loadPost(postId: number): Promise<PostLookup> {
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .select("id, brand_id, file_path, brands:brand_id (folder_path, logo_path)")
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) throw new Error(`Post ${postId} not found`);
  const post = data as unknown as PostLookup;
  if (!post.file_path) throw new Error(`Post ${postId} has no file_path`);
  if (!post.brands?.folder_path) throw new Error(`Brand has no folder_path`);
  if (!post.brands.logo_path) throw new Error(`Brand has no logo_path configured`);
  return post;
}

export async function hasLogoSnapshot(postId: number): Promise<boolean> {
  try {
    const post = await loadPost(postId);
    if (!post.file_path || !post.brands?.folder_path) return false;
    const abs = postImagePath(post.brands.folder_path, post.file_path);
    return existsSync(snapshotPath(abs));
  } catch {
    return false;
  }
}

export async function applyOverlayLogo(
  postId: number,
  vars: OverlayVars
): Promise<{ ok: true } | { ok: false; error: string }> {
  let post: PostLookup;
  try {
    post = await loadPost(postId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!post.file_path || !post.brands?.folder_path || !post.brands.logo_path) {
    return { ok: false, error: "Missing post or brand paths" };
  }

  const absPost = postImagePath(post.brands.folder_path, post.file_path);
  const absLogo = path.join(brandFolderPath(post.brands.folder_path), post.brands.logo_path);
  const snap = snapshotPath(absPost);

  if (!existsSync(absPost)) return { ok: false, error: `Post not found: ${absPost}` };
  if (!existsSync(absLogo)) return { ok: false, error: `Logo not found: ${absLogo}` };

  // Snapshot once. Re-runs overlay onto the original, not onto a previous overlay.
  if (existsSync(snap)) {
    await fs.copyFile(snap, absPost);
  } else {
    await fs.copyFile(absPost, snap);
  }

  const args = [
    path.join(PROJECT_ROOT, "overlay_logo.py"),
    absPost,
    absLogo,
    "--position",
    vars.position ?? "top-left",
    "--max-logo-width",
    String(vars.maxLogoWidth ?? 0.3),
    "--padding",
    String(vars.padding ?? 40),
  ];
  if (vars.backgroundBlock) {
    args.push("--background-block", vars.backgroundBlock);
  }
  if (vars.position === "custom") {
    if (typeof vars.xPct !== "number" || typeof vars.yPct !== "number") {
      return { ok: false, error: "position='custom' requires xPct and yPct" };
    }
    args.push("--x-pct", String(vars.xPct), "--y-pct", String(vars.yPct));
  }

  const result = await runPython(args);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  try {
    await reuploadToSupabase(post.brand_id, post.file_path, absPost);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true };
}

export async function undoOverlayLogo(
  postId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  let post: PostLookup;
  try {
    post = await loadPost(postId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!post.file_path || !post.brands?.folder_path) {
    return { ok: false, error: "Missing post or brand paths" };
  }
  const absPost = postImagePath(post.brands.folder_path, post.file_path);
  const snap = snapshotPath(absPost);
  if (!existsSync(snap)) {
    return { ok: false, error: "No snapshot to restore" };
  }
  await fs.copyFile(snap, absPost);
  await fs.unlink(snap);
  try {
    await reuploadToSupabase(post.brand_id, post.file_path, absPost);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true };
}

function runPython(args: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const cmd = process.env.PYTHON_BIN || "python";
    const proc = spawn(cmd, args, { cwd: PROJECT_ROOT });
    let stderr = "";
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err) => resolve({ ok: false, error: err.message }));
    proc.on("close", (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderr.trim() || stdout.trim() || `python exited ${code}` });
    });
  });
}
