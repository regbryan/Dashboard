import "server-only";
import path from "node:path";
import sharp from "sharp";
import { supabaseAdmin } from "./supabase-admin";

// Text-rendered footer overlay. Reads brands.compliance, lays it out via
// sharp's text input (Pango-backed wrapping at the requested width),
// optionally paints a translucent background bar behind it, composites onto
// the post, and re-uploads. Snapshot lives at <file>_pre_footer.<ext> so
// re-apply works on the original and Undo restores it.

const BUCKET = "post-images";

export type FooterPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right"
  | "custom";

export type FooterVars = {
  position?: FooterPosition;
  // Block width as fraction of post width. Default 0.92 (92%) — full-width
  // strip with breathing room on the sides.
  widthPct?: number;
  // Font size as fraction of post width. Default 0.014 (1.4%).
  fontSizePct?: number;
  // When true, auto-size the font so the text spans the block width on a single
  // line (fontSizePct is ignored). Great for a full-width compliance strip.
  fitToWidth?: boolean;
  // Foreground (text) color. Hex.
  color?: string;
  // Optional background bar. null = no bar.
  background?: string | null;
  // Bar opacity 0–1 (only used when background is set).
  backgroundOpacity?: number;
  align?: "left" | "center" | "right";
  // Custom positioning (top-left of the rendered text block, fractions
  // of post w/h). Used when position='custom'.
  xPct?: number;
  yPct?: number;
  // Padding (px) between the text block and the post edge for the named
  // edge positions. Ignored for 'custom'.
  edgePadding?: number;
  // Override of the brand's compliance text. Falls back to brands.compliance.
  textOverride?: string;
};

type PostRow = {
  id: number;
  brand_id: string;
  file_path: string | null;
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
  return `${brandId}/${base}_pre_footer${ext}`;
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

async function loadBrandCompliance(brandId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("brands")
    .select("compliance")
    .eq("id", brandId)
    .maybeSingle();
  const row = data as { compliance: string | null } | null;
  return row?.compliance ?? null;
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

export async function hasFooterSnapshot(postId: number): Promise<boolean> {
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

function escapePangoText(s: string): string {
  // Pango markup escapes — &, <, > are special. Apostrophes/quotes are safe.
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPangoMarkup(text: string, color: string, sizePt: number): string {
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#FFFFFF";
  return `<span foreground="${safeColor}" size="${Math.round(sizePt * 1024)}">${escapePangoText(text)}</span>`;
  // size in pango is in 1024ths of a point.
}

function bgBarSvg(width: number, height: number, hex: string, opacity: number): Buffer {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#000000";
  const op = clamp(opacity, 0, 1);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" fill="${safe}" fill-opacity="${op}"/></svg>`
  );
}

export async function applyOverlayFooter(
  postId: number,
  vars: FooterVars
): Promise<{ ok: true } | { ok: false; error: string }> {
  let post: PostRow;
  try {
    post = await loadPost(postId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!post.file_path) return { ok: false, error: "Post has no file_path" };
  if (!isImageFile(post.file_path)) {
    return {
      ok: false,
      error: `Footer overlay only supports images (got ${path.posix.extname(post.file_path)})`,
    };
  }

  // Resolve text — explicit override wins, else brand compliance.
  let text = vars.textOverride?.trim();
  if (!text) {
    const compliance = await loadBrandCompliance(post.brand_id);
    text = compliance?.trim() ?? "";
  }
  if (!text) {
    return {
      ok: false,
      error:
        "No footer text. Either set brands.compliance for this brand or pass a textOverride.",
    };
  }

  const postObj = postKey(post.brand_id, post.file_path);
  const snapObj = snapshotKey(post.brand_id, post.file_path);
  // Preserve the original format on re-upload — the AI designs are now .jpg, and
  // writing PNG bytes to a .jpg key (image/png content-type) is a mismatch that
  // can break display/publishing.
  const outExt = path.posix.extname(post.file_path).toLowerCase();
  const isJpeg = outExt === ".jpg" || outExt === ".jpeg";
  const outType = isJpeg ? "image/jpeg" : outExt === ".webp" ? "image/webp" : "image/png";

  const snapExisted = await objectExists(snapObj);
  let baseBuf: Buffer;
  try {
    if (snapExisted) {
      baseBuf = await downloadObject(snapObj);
    } else {
      baseBuf = await downloadObject(postObj);
      await uploadObject(snapObj, baseBuf, outType);
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    const baseMeta = await sharp(baseBuf).metadata();
    const postW = baseMeta.width ?? 0;
    const postH = baseMeta.height ?? 0;
    if (!postW || !postH) {
      return { ok: false, error: "Could not determine post dimensions" };
    }

    const widthPct = clamp(vars.widthPct ?? 0.92, 0.1, 1.0);
    const blockWidth = Math.max(64, Math.round(postW * widthPct));
    const align = vars.align ?? "center";
    const color = vars.color ?? "#FFFFFF";

    // Determine font size. Fit-to-width measures the text's natural single-line
    // width at a probe size and scales the font to fill the block width — but
    // clamps to a READABLE range. A long disclaimer therefore stays legible and
    // WRAPS across the full width (all text shown) instead of shrinking to an
    // illegible single line. Short text lands on one full-width line.
    let sizePt: number;
    if (vars.fitToWidth) {
      // Auto-size the font to span the block width on ~one line, then clamp to a
      // readable band so long text WRAPS instead of shrinking. Estimate the
      // single-line width from CHARACTER COUNT (avg advance ≈ 0.5em) rather than
      // rendering a probe — a long compliance string probed at a large point size
      // produced a Cairo text surface past the 32767px limit and crashed
      // ("text: invalid value (too big)" / vips out-of-memory). This mirrors the
      // client preview's sizing, so the rendered output matches what's shown.
      const charUnits = Math.max(text.replace(/\n/g, "").length * 0.5, 1);
      const singleLineFrac = widthPct / charUnits;
      const effFrac = clamp(singleLineFrac * 0.97, 0.013, 0.03);
      sizePt = Math.max(5, Math.round(postW * effFrac));
    } else {
      const fontSizePct = clamp(vars.fontSizePct ?? 0.014, 0.004, 0.06);
      // Sharp's text input treats size in points; we approximate px≈pt here.
      sizePt = Math.max(5, Math.round(postW * fontSizePct));
    }

    // Always wrap at the block width so ALL text is shown — short text lands on
    // a single full-width line; long text wraps to multiple readable lines.
    const textImg = await sharp({
      text: {
        text: buildPangoMarkup(text, color, sizePt),
        rgba: true,
        width: blockWidth,
        align,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    const textW = textImg.info.width;
    const textH = textImg.info.height;

    const padding = clamp(vars.edgePadding ?? 24, 0, Math.min(postW, postH));
    const position = (vars.position ?? "bottom-center") as FooterPosition;

    let x: number;
    let y: number;
    switch (position) {
      case "bottom-left":
        x = padding;
        y = postH - textH - padding;
        break;
      case "bottom-right":
        x = postW - textW - padding;
        y = postH - textH - padding;
        break;
      case "top-left":
        x = padding;
        y = padding;
        break;
      case "top-center":
        x = Math.floor((postW - textW) / 2);
        y = padding;
        break;
      case "top-right":
        x = postW - textW - padding;
        y = padding;
        break;
      case "custom": {
        const xp = vars.xPct ?? 0.04;
        const yp = vars.yPct ?? 0.92;
        x = clamp(Math.round(postW * xp), 0, Math.max(0, postW - textW));
        y = clamp(Math.round(postH * yp), 0, Math.max(0, postH - textH));
        break;
      }
      case "bottom-center":
      default:
        x = Math.floor((postW - textW) / 2);
        y = postH - textH - padding;
        break;
    }

    const composites: sharp.OverlayOptions[] = [];
    if (vars.background) {
      const barPad = Math.max(8, Math.round(sizePt * 0.4));
      const barW = textW + barPad * 2;
      const barH = textH + barPad * 2;
      const barX = clamp(x - barPad, 0, postW);
      const barY = clamp(y - barPad, 0, postH);
      composites.push({
        input: bgBarSvg(barW, barH, vars.background, vars.backgroundOpacity ?? 0.55),
        left: barX,
        top: barY,
      });
    }
    composites.push({ input: textImg.data, left: x, top: y });

    const composed = sharp(baseBuf).composite(composites);
    const outBuf = await (
      isJpeg ? composed.jpeg({ quality: 92 }) : outExt === ".webp" ? composed.webp() : composed.png()
    ).toBuffer();
    await uploadObject(postObj, outBuf, outType);

    await supabaseAdmin()
      .from("posts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", post.id);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function undoOverlayFooter(
  postId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  let post: PostRow;
  try {
    post = await loadPost(postId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!post.file_path) return { ok: false, error: "Post has no file_path" };
  if (!isImageFile(post.file_path)) {
    return { ok: false, error: "Footer overlay only supports images" };
  }
  const postObj = postKey(post.brand_id, post.file_path);
  const snapObj = snapshotKey(post.brand_id, post.file_path);
  if (!(await objectExists(snapObj))) {
    return { ok: false, error: "No footer snapshot to restore" };
  }
  const undoExt = path.posix.extname(post.file_path).toLowerCase();
  const undoType =
    undoExt === ".jpg" || undoExt === ".jpeg"
      ? "image/jpeg"
      : undoExt === ".webp"
        ? "image/webp"
        : "image/png";
  try {
    const buf = await downloadObject(snapObj);
    await uploadObject(postObj, buf, undoType);
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
