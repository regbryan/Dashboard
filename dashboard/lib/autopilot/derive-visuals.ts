import "server-only";
import sharp from "sharp";
import { supabaseAdmin } from "../supabase-admin";

// Visual-side brand-kit derivation. Two artifacts:
//   1. Color palette — deterministic, cheap. Downloads approved-post images,
//      downsamples each to 24x24 raw RGB, buckets pixels into a 6x6x6 RGB cube
//      (216 buckets), aggregates frequency across the batch, returns the top
//      N bucket centroids (skipping near-white and near-black so backgrounds
//      don't dominate the palette).
//   2. Typography attributes — sends one sample image to Gemini Vision and
//      asks for serif/sans-serif, weight, mood. Low confidence by design —
//      fonts in social-post photos are usually overlay text, not the brand's
//      actual typography. Fed in for completeness; treat as a hint, not truth.

const BUCKET = "post-images";
const MAX_POSTS_TO_SAMPLE = 8;
const SAMPLE_SIZE = 24; // pixels per side after resize
const PALETTE_BUCKETS = 6; // 6^3 = 216 bins
const TOP_COLORS = 6;

const TEXT_ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export type DeriveVisualsResult =
  | { ok: true; brandSlug: string; postsAnalyzed: number; colors: PaletteColor[]; fonts: TypographyHint | null }
  | { ok: false; brandSlug: string; error: string };

export type PaletteColor = {
  hex: string;
  weight: number; // 0..1, share of sampled pixels
};

export type TypographyHint = {
  classification: string | null; // e.g., "sans-serif, geometric"
  weight: string | null; // e.g., "medium to bold"
  mood: string | null; // e.g., "modern, trustworthy"
  confidence: "low" | "medium" | "high";
  note: string;
};

export async function deriveBrandVisuals(slug: string): Promise<DeriveVisualsResult> {
  const admin = supabaseAdmin();

  // brand_kits.name is NOT NULL with no default; Postgres validates NOT NULL
  // during INSERT row construction BEFORE ON CONFLICT DO UPDATE kicks in, so
  // the visuals upsert needs name even when only updating an existing row.
  const { data: brand, error: brandErr } = await admin
    .from("brands")
    .select("name")
    .eq("id", slug)
    .maybeSingle();
  if (brandErr || !brand) {
    return { ok: false, brandSlug: slug, error: "brand not found" };
  }
  const brandName = (brand as { name: string }).name;

  const { data: postsData, error: postsErr } = await admin
    .from("posts")
    .select("file_path")
    .eq("brand_id", slug)
    .eq("status", "approved")
    .not("file_path", "is", null)
    .order("post_number", { ascending: false })
    .limit(MAX_POSTS_TO_SAMPLE);
  if (postsErr) return { ok: false, brandSlug: slug, error: `posts: ${postsErr.message}` };

  const posts = (postsData ?? []) as { file_path: string }[];
  if (posts.length === 0) {
    return { ok: false, brandSlug: slug, error: "no approved posts with images" };
  }

  // Tally pixel frequencies across all sampled posts.
  const buckets = new Map<number, number>();
  let totalPixels = 0;
  let firstImageBuffer: Buffer | null = null;
  let firstImageMime = "image/png";

  for (const p of posts) {
    const key = `${slug}/${p.file_path}`;
    const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(key);
    if (dlErr || !blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());

    let raw: { data: Buffer; info: sharp.OutputInfo };
    try {
      raw = await sharp(buf)
        .removeAlpha()
        .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside" })
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      continue;
    }
    const pixels = raw.data;
    for (let i = 0; i < pixels.length; i += 3) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // Skip near-white and near-black — backgrounds and shadows drown out
      // the brand palette otherwise.
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < 18 || lum > 237) continue;
      const bucket = colorBucket(r, g, b);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
      totalPixels += 1;
    }
    if (!firstImageBuffer) {
      firstImageBuffer = buf;
      firstImageMime = key.toLowerCase().endsWith(".jpg") || key.toLowerCase().endsWith(".jpeg")
        ? "image/jpeg"
        : "image/png";
    }
  }

  if (totalPixels === 0) {
    return { ok: false, brandSlug: slug, error: "could not sample any pixels" };
  }

  const colors = topBucketsToPalette(buckets, totalPixels, TOP_COLORS);

  let fonts: TypographyHint | null = null;
  if (firstImageBuffer) {
    fonts = await callGeminiForTypography(firstImageBuffer, firstImageMime);
  }

  // Write back to brand_kits.colors + brand_kits.fonts (preserve other fields).
  const colorsPayload: Record<string, string | string[]> = {};
  if (colors[0]) colorsPayload.primary = colors[0].hex;
  if (colors[1]) colorsPayload.secondary = colors[1].hex;
  if (colors[2]) colorsPayload.accent = colors[2].hex;
  if (colors.length > 3) colorsPayload.palette = colors.map((c) => c.hex);

  const fontsPayload = fonts
    ? {
        classification: fonts.classification,
        weight: fonts.weight,
        mood: fonts.mood,
        confidence: fonts.confidence,
        note: fonts.note,
      }
    : null;

  const { data: existingKit } = await admin
    .from("brand_kits")
    .select("confidence")
    .eq("slug", slug)
    .maybeSingle();
  const existingConfidence = (existingKit as { confidence: Record<string, unknown> | null } | null)?.confidence ?? {};

  const upsertPayload: Record<string, unknown> = {
    slug,
    name: brandName,
    updated_at: new Date().toISOString(),
    colors: colorsPayload,
    confidence: {
      ...existingConfidence,
      colors: "high",
      fonts: fonts ? fonts.confidence : "low",
      _visuals_derived_at: new Date().toISOString(),
      _visuals_sampled_posts: posts.length,
    },
  };
  if (fontsPayload) upsertPayload.fonts = fontsPayload;

  const { error: upsertErr } = await admin
    .from("brand_kits")
    .upsert(upsertPayload, { onConflict: "slug" });
  if (upsertErr) {
    return { ok: false, brandSlug: slug, error: `upsert: ${upsertErr.message}` };
  }

  return { ok: true, brandSlug: slug, postsAnalyzed: posts.length, colors, fonts };
}

function colorBucket(r: number, g: number, b: number): number {
  const rb = Math.min(PALETTE_BUCKETS - 1, Math.floor((r / 256) * PALETTE_BUCKETS));
  const gb = Math.min(PALETTE_BUCKETS - 1, Math.floor((g / 256) * PALETTE_BUCKETS));
  const bb = Math.min(PALETTE_BUCKETS - 1, Math.floor((b / 256) * PALETTE_BUCKETS));
  return rb * PALETTE_BUCKETS * PALETTE_BUCKETS + gb * PALETTE_BUCKETS + bb;
}

function bucketCentroid(bucket: number): { r: number; g: number; b: number } {
  const bb = bucket % PALETTE_BUCKETS;
  const gb = Math.floor(bucket / PALETTE_BUCKETS) % PALETTE_BUCKETS;
  const rb = Math.floor(bucket / (PALETTE_BUCKETS * PALETTE_BUCKETS));
  const step = 256 / PALETTE_BUCKETS;
  return {
    r: Math.round(rb * step + step / 2),
    g: Math.round(gb * step + step / 2),
    b: Math.round(bb * step + step / 2),
  };
}

function topBucketsToPalette(
  buckets: Map<number, number>,
  total: number,
  k: number
): PaletteColor[] {
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
  return sorted.map(([bucket, count]) => {
    const { r, g, b } = bucketCentroid(bucket);
    return {
      hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase(),
      weight: Number((count / total).toFixed(3)),
    };
  });
}

async function callGeminiForTypography(
  imageBuf: Buffer,
  mimeType: string
): Promise<TypographyHint | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const prompt = `Look at this approved social media post and describe any typography visible in the image (headlines, overlays, captions baked into the image). If you see text, return ONLY strict JSON:

{"classification":"sans-serif | serif | display | script (+ shape, e.g. geometric / humanist)","weight":"light | regular | medium | bold | mixed","mood":"2-3 adjectives","confidence":"low | medium | high","note":"short caveat about what you saw"}

If there is no visible typography in the image (just photography with no text), return:
{"classification":null,"weight":null,"mood":null,"confidence":"low","note":"no typography visible in this sample"}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBuf.toString("base64") } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  type Part = { text?: string };
  type Candidate = { content?: { parts?: Part[] } };
  let body: { candidates?: Candidate[] };
  try {
    body = (await res.json()) as { candidates?: Candidate[] };
  } catch {
    return null;
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as TypographyHint;
    return parsed;
  } catch {
    return null;
  }
}

export async function deriveVisualsForAllBrands(): Promise<{ results: DeriveVisualsResult[] }> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("brands").select("id");
  if (error || !data) return { results: [] };
  const results: DeriveVisualsResult[] = [];
  for (const row of data as { id: string }[]) {
    results.push(await deriveBrandVisuals(row.id));
  }
  return { results };
}
