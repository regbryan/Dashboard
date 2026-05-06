import "server-only";
import path from "node:path";
import sharp from "sharp";
import { supabaseAdmin } from "./supabase-admin";

// Compositing pipeline: download post + logo from Supabase Storage, run
// sharp in-process to overlay, re-upload. No Python, no local filesystem,
// works identically in dev and on Vercel.
//
// A snapshot of the original (pre-logo) image is kept as a sibling object
// with `_pre_logo` appended before the extension. Re-apply uses that snapshot
// as the base so multiple overlays don't stack. Undo restores the snapshot
// and deletes it.

const BUCKET = "post-images";

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
  // brand_logos.id of the variant to use. When omitted, the brand's default
  // variant (is_default=true) is selected automatically.
  logoId?: string;
};

type PostRow = {
  id: number;
  brand_id: string;
  file_path: string | null;
};

type BrandLogoRow = {
  id: string;
  brand_id: string;
  storage_path: string;
};

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function isImageFile(filePath: string): boolean {
  return IMAGE_EXTS.has(path.posix.extname(filePath).toLowerCase());
}

function postKey(brandId: string, filePath: string): string {
  return `${brandId}/${filePath}`;
}

function snapshotKey(brandId: string, filePath: string): string {
  const ext = path.posix.extname(filePath);
  const base = filePath.slice(0, filePath.length - ext.length);
  return `${brandId}/${base}_pre_logo${ext}`;
}

async function loadPost(postId: number): Promise<PostRow> {
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .select("id, brand_id, file_path")
    .eq("id", postId)
    .maybeSingle();
  if (error || !data) throw new Error(`Post ${postId} not found`);
  return data as PostRow;
}

async function resolveLogo(
  brandId: string,
  logoId: string | undefined
): Promise<BrandLogoRow> {
  const sb = supabaseAdmin();
  if (logoId) {
    const { data } = await sb
      .from("brand_logos")
      .select("id, brand_id, storage_path")
      .eq("id", logoId)
      .maybeSingle();
    const row = data as BrandLogoRow | null;
    if (!row) throw new Error(`Logo variant ${logoId} not found`);
    if (row.brand_id !== brandId) {
      throw new Error("Logo variant belongs to a different brand");
    }
    return row;
  }
  // Fall back to the brand's default variant.
  const { data: def } = await sb
    .from("brand_logos")
    .select("id, brand_id, storage_path")
    .eq("brand_id", brandId)
    .eq("is_default", true)
    .maybeSingle();
  const row = def as BrandLogoRow | null;
  if (!row) {
    throw new Error(`No default logo configured for brand ${brandId}`);
  }
  return row;
}

async function downloadObject(key: string): Promise<Buffer> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(BUCKET).download(key);
  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message ?? "no data"}`);
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

async function uploadObject(key: string, body: Buffer, contentType: string) {
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(key, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

async function objectExists(key: string): Promise<boolean> {
  const sb = supabaseAdmin();
  const dir = key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : "";
  const name = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
  const { data } = await sb.storage.from(BUCKET).list(dir, { search: name });
  return !!data?.some((f) => f.name === name);
}

export async function hasLogoSnapshot(postId: number): Promise<boolean> {
  try {
    const post = await loadPost(postId);
    if (!post.file_path) return false;
    return await objectExists(snapshotKey(post.brand_id, post.file_path));
  } catch {
    return false;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function computePosition(args: {
  position: OverlayPosition;
  postW: number;
  postH: number;
  logoW: number;
  logoH: number;
  padding: number;
  xPct?: number;
  yPct?: number;
}): { x: number; y: number } {
  const { position, postW, postH, logoW, logoH, padding } = args;
  const maxX = Math.max(0, postW - logoW);
  const maxY = Math.max(0, postH - logoH);
  switch (position) {
    case "top-left":
      return { x: padding, y: padding };
    case "top-center":
      return { x: Math.floor((postW - logoW) / 2), y: padding };
    case "top-right":
      return { x: postW - logoW - padding, y: padding };
    case "bottom-left":
      return { x: padding, y: postH - logoH - padding };
    case "bottom-center":
      return {
        x: Math.floor((postW - logoW) / 2),
        y: postH - logoH - padding,
      };
    case "bottom-right":
      return { x: postW - logoW - padding, y: postH - logoH - padding };
    case "center":
      return {
        x: Math.floor((postW - logoW) / 2),
        y: Math.floor((postH - logoH) / 2),
      };
    case "custom": {
      const xp = args.xPct ?? 0;
      const yp = args.yPct ?? 0;
      return {
        x: clamp(Math.round(postW * xp), 0, maxX),
        y: clamp(Math.round(postH * yp), 0, maxY),
      };
    }
    default:
      return { x: padding, y: padding };
  }
}

function backgroundBlockSvg(
  width: number,
  height: number,
  hex: string,
  radius = 10
): Buffer {
  const safe = /^#[0-9a-fA-F]{6,8}$/.test(hex) ? hex : "#000000";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${safe}"/></svg>`
  );
}

export async function applyOverlayLogo(
  postId: number,
  vars: OverlayVars
): Promise<{ ok: true } | { ok: false; error: string }> {
  let post: PostRow;
  try {
    post = await loadPost(postId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!post.file_path) {
    return { ok: false, error: "Post has no file_path" };
  }
  if (!isImageFile(post.file_path)) {
    return {
      ok: false,
      error: `Logo overlay only supports images (got ${path.posix.extname(post.file_path)})`,
    };
  }

  let logo: BrandLogoRow;
  try {
    logo = await resolveLogo(post.brand_id, vars.logoId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const postObj = postKey(post.brand_id, post.file_path);
  const snapObj = snapshotKey(post.brand_id, post.file_path);

  // Snapshot policy: re-apply onto the original, not the previous overlay.
  // If a snapshot exists, use it as the base. Otherwise the current post
  // file IS the original — copy it to snapshot before overwriting.
  const snapExisted = await objectExists(snapObj);
  let baseBuf: Buffer;
  try {
    if (snapExisted) {
      baseBuf = await downloadObject(snapObj);
    } else {
      baseBuf = await downloadObject(postObj);
      await uploadObject(snapObj, baseBuf, "image/png");
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  let logoBuf: Buffer;
  try {
    logoBuf = await downloadObject(logo.storage_path);
  } catch (err) {
    return {
      ok: false,
      error: `Failed to download logo: ${err instanceof Error ? err.message : err}`,
    };
  }

  try {
    const baseMeta = await sharp(baseBuf).metadata();
    const postW = baseMeta.width ?? 0;
    const postH = baseMeta.height ?? 0;
    if (!postW || !postH) {
      return { ok: false, error: "Could not determine post dimensions" };
    }

    const maxLogoWidth = clamp(vars.maxLogoWidth ?? 0.3, 0.01, 0.95);
    const targetW = Math.max(1, Math.round(postW * maxLogoWidth));

    // Resize logo to target width preserving aspect ratio.
    const resizedLogo = await sharp(logoBuf)
      .ensureAlpha()
      .resize({ width: targetW })
      .toBuffer({ resolveWithObject: true });
    const logoH = resizedLogo.info.height;
    const logoW = resizedLogo.info.width;

    const padding = clamp(vars.padding ?? 40, 0, Math.min(postW, postH));
    const { x, y } = computePosition({
      position: (vars.position as OverlayPosition) ?? "top-left",
      postW,
      postH,
      logoW,
      logoH,
      padding,
      xPct: vars.xPct,
      yPct: vars.yPct,
    });

    const composites: sharp.OverlayOptions[] = [];
    if (vars.backgroundBlock) {
      const bgPad = 12;
      const bgRadius = 10;
      const bgW = logoW + bgPad * 2;
      const bgH = logoH + bgPad * 2;
      const bgX = clamp(x - bgPad, 0, postW);
      const bgY = clamp(y - bgPad, 0, postH);
      composites.push({
        input: backgroundBlockSvg(bgW, bgH, vars.backgroundBlock, bgRadius),
        left: bgX,
        top: bgY,
      });
    }
    composites.push({ input: resizedLogo.data, left: x, top: y });

    const outBuf = await sharp(baseBuf)
      .composite(composites)
      .png()
      .toBuffer();

    await uploadObject(postObj, outBuf, "image/png");

    // Bump updated_at so client-grid revalidations see fresh content.
    await supabaseAdmin()
      .from("posts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", post.id);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function undoOverlayLogo(
  postId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  let post: PostRow;
  try {
    post = await loadPost(postId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!post.file_path) {
    return { ok: false, error: "Post has no file_path" };
  }
  if (!isImageFile(post.file_path)) {
    return { ok: false, error: "Logo overlay only supports images" };
  }
  const postObj = postKey(post.brand_id, post.file_path);
  const snapObj = snapshotKey(post.brand_id, post.file_path);
  if (!(await objectExists(snapObj))) {
    return { ok: false, error: "No snapshot to restore" };
  }
  try {
    const buf = await downloadObject(snapObj);
    await uploadObject(postObj, buf, "image/png");
    const sb = supabaseAdmin();
    await sb.storage.from(BUCKET).remove([snapObj]);
    await sb
      .from("posts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", post.id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
