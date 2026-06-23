import { requireAdmin, handleAuthError } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getImageUrl } from "@/lib/image-url";
import { zipSync, strToU8 } from "fflate";
import { withRequestContext } from "@/lib/request-context";

// Bulk export: zip every APPROVED design for a brand (image files) plus a
// captions.csv (post #, date, concept, caption, hashtags) for client handoff.
// Admin-only. Downloading a dozen full-res images can take a moment, so allow
// a generous duration.
export const maxDuration = 120;
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  return withRequestContext(req as Request, () => handleGET(req, { params }));
}

type ExportPost = {
  id: number;
  post_number: number | null;
  date: string | null;
  concept: string | null;
  caption: string | null;
  hashtags: string | null;
  file_path: string | null;
  updated_at: string | null;
};

// CSV-escape a single cell: wrap in quotes and double internal quotes when the
// value contains a comma, quote, or newline (captions are multi-line + commas).
function csvCell(v: string | null | undefined): string {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// A safe, readable filename stem for an image, e.g. "omega-post-23-2026-06-26".
function fileStem(brandId: string, p: ExportPost): string {
  const num = p.post_number ?? p.id;
  const date = (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) ? p.date : "undated";
  return `${brandId}-post-${num}-${date}`;
}

async function handleGET(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    await requireAdmin();
    const { brandId } = await params;
    const admin = supabaseAdmin();

    const { data: brand } = await admin
      .from("brands")
      .select("id, name")
      .eq("id", brandId)
      .maybeSingle();
    if (!brand) {
      return Response.json({ error: "brand not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("posts")
      .select("id, post_number, date, concept, caption, hashtags, file_path, updated_at")
      .eq("brand_id", brandId)
      .eq("status", "approved")
      .not("file_path", "is", null)
      .order("post_number", { ascending: true });
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const posts = (data ?? []) as ExportPost[];
    if (posts.length === 0) {
      return Response.json({ error: "no approved designs to export" }, { status: 404 });
    }

    const files: Record<string, Uint8Array> = {};
    const csvRows: string[] = ["post_number,date,concept,caption,hashtags"];
    const usedNames = new Set<string>();
    let included = 0;

    for (const p of posts) {
      if (!p.file_path) continue;
      const url = getImageUrl(brandId, p.file_path, p.updated_at);
      if (!url) continue;
      const res = await fetch(url).catch(() => null);
      if (!res || !res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());

      const ext = (p.file_path.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      let name = `${fileStem(brandId, p)}.${ext}`;
      // Guard against two posts colliding on the same stem.
      let n = 2;
      while (usedNames.has(name)) name = `${fileStem(brandId, p)}-${n++}.${ext}`;
      usedNames.add(name);

      files[name] = bytes;
      included++;
      csvRows.push(
        [p.post_number ?? "", p.date ?? "", p.concept ?? "", p.caption ?? "", p.hashtags ?? ""]
          .map((c) => csvCell(String(c)))
          .join(",")
      );
    }

    if (included === 0) {
      return Response.json({ error: "could not fetch any approved images" }, { status: 502 });
    }

    // Prepend a UTF-8 BOM so Excel renders emoji/accents in captions correctly.
    files["captions.csv"] = strToU8("﻿" + csvRows.join("\r\n"));

    const zip = zipSync(files, { level: 6 });
    const stamp = (posts[0]?.updated_at ?? "").slice(0, 10) || "export";
    const filename = `${brandId}-approved-${stamp}.zip`;

    return new Response(Buffer.from(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Count": String(included),
      },
    });
  } catch (err) {
    const res = handleAuthError(err);
    if (res) return res;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
