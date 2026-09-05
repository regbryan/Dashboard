import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderScboardwalkDesign } from "@/lib/autopilot/render-scboardwalk";

// Shared core for creating a hiring-post DRAFT from a scraped open position.
// Used by BOTH the HTTP ingest route (Dify platform path) and the native cron
// (works-today path). Renders the SC Boardwalk "blue bands, no photo" card,
// stores it, and inserts an in_review post. Idempotent on the ATS req id.

const BUCKET = "post-images";
// Only SC Boardwalk has a hiring engine today; gate to it (extensible later).
export const HIRING_SUPPORTED_BRANDS = new Set(["scboardwalk"]);

export type HiringJob = {
  reqId: string | number;
  title: string;
  category?: string | null;
  employeeType?: string | null;
  payText?: string | null;
  detailLine?: string | null;
  caption?: string | null;
};

export type HiringDraftResult =
  | { ok: true; skipped: boolean; postId: number; postNumber?: number; storagePath?: string; reqId: string; reason?: string }
  | { ok: false; status: number; error: string };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function createHiringDraft(
  brandId: string,
  job: HiringJob
): Promise<HiringDraftResult> {
  if (!HIRING_SUPPORTED_BRANDS.has(brandId)) {
    return { ok: false, status: 400, error: `hiring-draft not supported for brand '${brandId}'` };
  }
  const reqId = job.reqId != null ? String(job.reqId).trim() : "";
  const title = (job.title ?? "").trim();
  if (!reqId || !title) {
    return { ok: false, status: 400, error: "reqId and title are required" };
  }

  const admin = supabaseAdmin();

  // Dedup: already drafted this requisition? (posts table is the source of truth.)
  const { data: existingRows, error: dedupErr } = await admin
    .from("posts")
    .select("id, image_brief")
    .eq("brand_id", brandId);
  if (dedupErr) return { ok: false, status: 500, error: dedupErr.message };

  const already = ((existingRows ?? []) as { id: number; image_brief: unknown }[]).find((r) => {
    const b = r.image_brief as { hiring?: { reqId?: unknown } } | null;
    return b?.hiring?.reqId != null && String(b.hiring.reqId) === reqId;
  });
  if (already) {
    return { ok: true, skipped: true, reason: "already_drafted", postId: already.id, reqId };
  }

  // Next post_number for the brand.
  const { data: maxRow } = await admin
    .from("posts")
    .select("post_number")
    .eq("brand_id", brandId)
    .order("post_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const postNumber = (((maxRow ?? {}) as { post_number?: number | null }).post_number ?? 0) + 1;

  const now = new Date();
  const nowIso = now.toISOString();
  const date = nowIso.slice(0, 10);
  const day = DOW[now.getUTCDay()];

  const payType = [job.payText?.trim(), job.employeeType?.trim()].filter(Boolean).join(" · ");
  const detailLine = (job.detailLine?.trim() || payType || "Flexible hours, great perks. Apply today!").slice(0, 90);

  let bytes: Buffer;
  try {
    bytes = await renderScboardwalkDesign({ eyebrow: "Now Hiring", headline: title, detailLine });
  } catch (err) {
    return { ok: false, status: 500, error: `render failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const filePath = `autopilot/hiring-${reqId}-v${Date.now()}.png`;
  const storageKey = `${brandId}/${filePath}`;
  const upload = await admin.storage.from(BUCKET).upload(storageKey, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (upload.error) return { ok: false, status: 500, error: `storage upload failed: ${upload.error.message}` };

  const imageBrief = {
    hiring: {
      reqId,
      title,
      category: job.category ?? null,
      employeeType: job.employeeType ?? null,
      payText: job.payText ?? null,
      source: "entertime",
      scrapedAt: nowIso,
    },
  };

  const { data: inserted, error: insErr } = await admin
    .from("posts")
    .insert({
      brand_id: brandId,
      post_number: postNumber,
      date,
      day,
      post_type: "Image Post",
      content_pillar: "Hiring",
      concept: `Now Hiring — ${title}`,
      caption: job.caption ?? null,
      status: "in_review",
      file_path: filePath,
      image_brief: imageBrief,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { ok: false, status: 500, error: `posts insert failed: ${insErr?.message ?? "no row"}` };
  }

  return {
    ok: true,
    skipped: false,
    postId: (inserted as { id: number }).id,
    postNumber,
    storagePath: storageKey,
    reqId,
  };
}
