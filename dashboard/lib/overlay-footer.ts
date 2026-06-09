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
  // Square corners — 90° edges, no rounding (per brand preference).
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
    // Guard: a large font (or a narrow width) can render the text layer WIDER or
    // TALLER than the post — Pango overflows the wrap width on unbreakable tokens
    // (e.g. a long URL), and many wrapped lines can exceed the post height. sharp
    // refuses to composite a layer bigger than the base ("Image to composite must
    // have same dimensions or smaller"), so shrink an oversized text layer to fit
    // inside the post before compositing. The common fit-to-width path already
    // fits, so this is a no-op there.
    let textData = textImg.data;
    let textW = textImg.info.width;
    let textH = textImg.info.height;
    if (textW > postW || textH > postH) {
      const fitted = await sharp(textImg.data)
        .resize({
          width: Math.min(textW, postW),
          height: Math.min(textH, postH),
          fit: "inside",
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      textData = fitted.data;
      textW = fitted.info.width;
      textH = fitted.info.height;
    }

    const padding = clamp(vars.edgePadding ?? 24, 0, Math.min(postW, postH));
    const position = (vars.position ?? "bottom-center") as FooterPosition;

    // The footer is a BAND that spans the requested width (the Width slider), not
    // a bar that hugs the text. At 100% it's a true edge-to-edge strip — which is
    // what the panel preview shows, so preview now matches the baked output.
    const vPad = Math.max(8, Math.round(sizePt * 0.5)); // inner vertical breathing room
    const hPad = Math.max(8, Math.round(sizePt * 0.5)); // inset text from band edge when left/right aligned
    const bandWidth = clamp(blockWidth, 64, postW);
    const bandHeight = Math.min(postH, textH + vPad * 2);

    // Horizontal + vertical band placement.
    let bandLeft: number;
    let bandTop: number;
    switch (position) {
      case "bottom-left":
        bandLeft = padding;
        bandTop = postH - bandHeight - padding;
        break;
      case "bottom-right":
        bandLeft = postW - bandWidth - padding;
        bandTop = postH - bandHeight - padding;
        break;
      case "top-left":
        bandLeft = padding;
        bandTop = padding;
        break;
      case "top-center":
        bandLeft = Math.round((postW - bandWidth) / 2);
        bandTop = padding;
        break;
      case "top-right":
        bandLeft = postW - bandWidth - padding;
        bandTop = padding;
        break;
      case "custom": {
        // xPct/yPct are the top-left of the text block (panel converts the drag
        // anchor → top-left). The band starts at that left and lifts above the
        // text by vPad so the text sits vertically centered in the band.
        const xp = vars.xPct ?? 0.04;
        const yp = vars.yPct ?? 0.92;
        bandLeft = Math.round(postW * xp);
        bandTop = Math.round(postH * yp) - vPad;
        break;
      }
      case "bottom-center":
      default:
        bandLeft = Math.round((postW - bandWidth) / 2);
        bandTop = postH - bandHeight - padding;
        break;
    }
    bandLeft = clamp(bandLeft, 0, Math.max(0, postW - bandWidth));
    bandTop = clamp(bandTop, 0, Math.max(0, postH - bandHeight));

    // Text placement WITHIN the band, honoring alignment.
    let textX: number;
    if (align === "left") textX = bandLeft + hPad;
    else if (align === "right") textX = bandLeft + bandWidth - textW - hPad;
    else textX = bandLeft + Math.round((bandWidth - textW) / 2);
    textX = clamp(textX, 0, Math.max(0, postW - textW));
    const textY = clamp(bandTop + vPad, 0, Math.max(0, postH - textH));

    const composites: sharp.OverlayOptions[] = [];
    if (vars.background) {
      composites.push({
        input: bgBarSvg(bandWidth, bandHeight, vars.background, vars.backgroundOpacity ?? 0.55),
        left: bandLeft,
        top: bandTop,
      });
    }
    composites.push({ input: textData, left: textX, top: textY });

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
