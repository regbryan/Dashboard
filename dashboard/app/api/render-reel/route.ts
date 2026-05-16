import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { loadVideoBrandKit } from "@/lib/video-brand-kit";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Remotion's bundler + renderer pull in headless Chromium and a
// full webpack bundle. Force the Node runtime and a long max
// duration; nothing about this route is Edge-compatible.
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Whitelist of allowed compositions — keeps the type narrow at runtime. */
const COMPOSITIONS = ["QuoteCard", "StatsReel", "ProductReveal"] as const;
type Composition = (typeof COMPOSITIONS)[number];

/** Cap on the JSON request body. 64 KB is generous for text+url props. */
const MAX_BODY_BYTES = 64 * 1024;

/** Safe-filename regex — letters, digits, dash, underscore only. */
const SAFE_TOKEN = /^[a-zA-Z0-9_-]+$/;

type Body = {
  composition: Composition;
  brandSlug: string;
  inputProps: Record<string, unknown>;
  /** Optional output filename (no extension). Defaults to `<brand>-<comp>-<timestamp>`. */
  filename?: string;
};

/**
 * POST /api/render-reel
 *
 * Admin-only. Renders one of the three brand-conditioned Remotion
 * compositions locally, uploads the resulting MP4 to the
 * Supabase Storage `post-videos` bucket, and returns the signed URL.
 *
 * This is the local-render path. Lambda is wired in later by
 * swapping the renderMedia() block for renderMediaOnLambda(); the
 * surface area of this route stays the same.
 *
 * ### Security posture
 *
 * - Admin-only via requireAdmin().
 * - Body capped at 64 KB to prevent oversized inputProps payloads.
 * - `composition` is a whitelist; `brandSlug` and `filename` are
 *   regex-validated to prevent path traversal in tmp path and
 *   storage key.
 * - `imageUrl` props are blocked from hitting private networks
 *   (loopback / link-local / RFC 1918) so a compromised admin
 *   session can't SSRF cloud metadata endpoints via headless Chrome.
 * - Supabase errors are logged server-side, never echoed raw.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAdmin();

    // Read the body as text first so we can enforce a size cap.
    // req.json() has no built-in size limit on Node runtime.
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "request body too large" },
        { status: 413 }
      );
    }

    let body: Body;
    try {
      body = JSON.parse(raw) as Body;
    } catch {
      return NextResponse.json(
        { error: "invalid JSON body" },
        { status: 400 }
      );
    }

    // Composition: must be one of the whitelisted ids.
    if (!COMPOSITIONS.includes(body.composition)) {
      return NextResponse.json(
        { error: `composition must be one of: ${COMPOSITIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // brandSlug: must be a safe token. Even though loadVideoBrandKit
    // would 404 on garbage, we use this string in a filesystem path
    // and storage key — defense in depth.
    if (!body.brandSlug || !SAFE_TOKEN.test(body.brandSlug)) {
      return NextResponse.json(
        { error: "brandSlug must match [a-zA-Z0-9_-]+" },
        { status: 400 }
      );
    }

    // filename (optional): same safe-token rule. No dots, no slashes.
    if (body.filename !== undefined && !SAFE_TOKEN.test(body.filename)) {
      return NextResponse.json(
        { error: "filename must match [a-zA-Z0-9_-]+" },
        { status: 400 }
      );
    }

    // SSRF guard: any string field in inputProps that looks like a
    // URL must be public-internet HTTPS. Catches `imageUrl` on
    // ProductReveal plus anything similar future compositions add.
    const ssrfError = checkInputPropsForSsrf(body.inputProps);
    if (ssrfError) {
      return NextResponse.json({ error: ssrfError }, { status: 400 });
    }

    // Resolve the brand kit and merge it into inputProps so the
    // composition receives a full VideoBrandKit on `brandKit`.
    const brandKit = await loadVideoBrandKit(body.brandSlug);
    if (!brandKit) {
      return NextResponse.json(
        { error: `brand "${body.brandSlug}" not found` },
        { status: 404 }
      );
    }

    const inputProps = { ...body.inputProps, brandKit };

    // Lazy-load Remotion to keep cold start fast for everything
    // else. These imports only resolve when the route actually fires.
    const { bundle } = await import("@remotion/bundler");
    const { renderMedia, selectComposition } = await import(
      "@remotion/renderer"
    );

    const entryPoint = path.resolve(process.cwd(), "remotion/index.ts");
    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: body.composition,
      inputProps,
    });

    const safeFilename =
      body.filename ??
      `${body.brandSlug}-${body.composition}-${Date.now()}`;
    const outputPath = path.join(os.tmpdir(), `${safeFilename}.mp4`);

    // Final sanity check: the resolved tmp path must still sit
    // inside os.tmpdir(). Bug-belt for any future filename relaxation.
    if (!outputPath.startsWith(os.tmpdir())) {
      return NextResponse.json(
        { error: "filename resolved outside tmp" },
        { status: 400 }
      );
    }

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
    });

    // Upload to Supabase Storage.
    const fileBytes = await fs.readFile(outputPath);
    const storageKey = `${body.brandSlug}/${safeFilename}.mp4`;
    const admin = supabaseAdmin();
    const { error: uploadErr } = await admin.storage
      .from("post-videos")
      .upload(storageKey, fileBytes, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (uploadErr) {
      // Log server-side, return generic to caller.
      console.error("[render-reel] upload failed", {
        storageKey,
        message: uploadErr.message,
      });
      return NextResponse.json(
        { error: "upload failed" },
        { status: 500 }
      );
    }

    // Generate a 7-day signed URL for preview. Long-lived storage
    // is the bucket itself — signed URLs are for the dashboard UI.
    const { data: signed } = await admin.storage
      .from("post-videos")
      .createSignedUrl(storageKey, 60 * 60 * 24 * 7);

    // Best-effort cleanup of the tmp file.
    fs.unlink(outputPath).catch(() => {});

    return NextResponse.json({
      ok: true,
      storageKey,
      signedUrl: signed?.signedUrl ?? null,
      composition: body.composition,
      brandSlug: body.brandSlug,
      renderedBy: ctx.user.email,
    });
  } catch (err) {
    const authResp = handleAuthError(err);
    if (authResp) return authResp;
    // Log full error, return generic to caller.
    console.error("[render-reel] render failed", err);
    return NextResponse.json({ error: "render failed" }, { status: 500 });
  }
}

/**
 * Walk inputProps recursively and reject any URL-looking string that
 * points at a private network. Catches the obvious SSRF vector
 * where a composition prop (e.g. ProductReveal.imageUrl) is fetched
 * by headless Chromium inside the render.
 *
 * Returns an error message if a bad URL is found; null otherwise.
 */
function checkInputPropsForSsrf(
  value: unknown,
  depth = 0
): string | null {
  if (depth > 6) return "inputProps too deeply nested";
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (!looksLikeUrl(value)) return null;
    return isPublicHttpUrl(value)
      ? null
      : `url not allowed (private network or non-http): ${redact(value)}`;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const err = checkInputPropsForSsrf(v, depth + 1);
      if (err) return err;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const err = checkInputPropsForSsrf(v, depth + 1);
      if (err) return err;
    }
    return null;
  }
  return null;
}

function looksLikeUrl(s: string): boolean {
  return /^(https?:|\/\/)/i.test(s.trim());
}

function isPublicHttpUrl(s: string): boolean {
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();

  // Block obvious private destinations. This is intentionally a
  // denylist of literals — we don't resolve DNS here, so a hostname
  // that resolves to a private IP at fetch time is still possible
  // (classic DNS-rebinding-style SSRF). For full coverage we'd need
  // a fetch-time hook inside Chromium, which Remotion doesn't expose.
  // For now this catches the 99% case (admin paste of a localhost
  // or metadata URL) and we accept the residual risk under the
  // admin-only gate.
  if (host === "localhost" || host === "0.0.0.0") return false;
  if (host === "169.254.169.254") return false; // AWS / GCP / Azure IMDS
  if (host === "metadata.google.internal") return false;
  if (host.endsWith(".internal")) return false;

  // RFC 1918 + loopback + link-local IPv4 literals
  if (/^127\./.test(host)) return false;
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false;

  // IPv6 loopback + link-local + unique-local
  if (host === "::1" || host === "[::1]") return false;
  if (/^\[?fe80:/i.test(host)) return false;
  if (/^\[?fc/i.test(host) || /^\[?fd/i.test(host)) return false;

  return true;
}

function redact(s: string): string {
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}
