import "server-only";
import { supabaseAdmin } from "../supabase-admin";

// Derive a brand_kits row from a brand's approved-post history. Uses Gemini's
// text model (not the image model) to extract structured fields from the
// concept / caption / visual_direction / content_pillar text written across
// every approved post for that brand. Writes back via upsert on brand_kits.slug
// — preserves any user-edited fields by only overwriting fields the model
// confidently produced and recording per-field confidence in brand_kits.confidence.

const TEXT_ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Minimum approved posts needed before derivation is meaningful. Lowered
// from 3 to 1 — the legacy backfill (colors + name + compliance) gives every
// brand a baseline, so deriving from even a single post can only improve
// things further. Confidence is recorded per field; reviewers can override.
const MIN_POSTS_FOR_DERIVATION = 1;

export type DeriveKitResult =
  | { ok: true; brandSlug: string; postsAnalyzed: number; model: string; updated: boolean }
  | { ok: false; brandSlug: string; error: string };

type ApprovedPost = {
  concept: string | null;
  caption: string | null;
  visual_direction: string | null;
  content_pillar: string | null;
  post_type: string | null;
  hashtags: string | null;
};

type DerivedKit = {
  positioning?: string;
  photography_direction?: string;
  tone?: {
    keywords?: string[];
    vocab_use?: string[];
    vocab_avoid?: string[];
    dos?: string[];
    donts?: string[];
  };
  content_pillars?: { name: string; pct: number; description?: string }[];
  hashtags?: {
    always_on?: string[];
    service?: string[];
    local?: string[];
    community?: string[];
  };
  confidence?: Record<string, "low" | "medium" | "high">;
};

export async function deriveBrandKitForSlug(
  slug: string
): Promise<DeriveKitResult> {
  const admin = supabaseAdmin();

  const { data: brand, error: brandErr } = await admin
    .from("brands")
    .select("id, name")
    .eq("id", slug)
    .maybeSingle();
  if (brandErr || !brand) {
    return { ok: false, brandSlug: slug, error: "brand not found" };
  }

  // Pull EVERY post for this brand with meaningful brief content — regardless
  // of status. The calendar entries themselves capture the brand's intended
  // direction (concept, visual_direction, content_pillar, caption, hashtags).
  // We don't need approval history to learn the brand's voice and themes.
  // Approved posts get sorted to the top so they carry more signal weight.
  const { data: postsData, error: postsErr } = await admin
    .from("posts")
    .select("concept, caption, visual_direction, content_pillar, post_type, hashtags, status")
    .eq("brand_id", slug)
    .or("concept.not.is.null,visual_direction.not.is.null")
    .order("status", { ascending: false })
    .order("post_number", { ascending: false })
    .limit(60);
  if (postsErr) {
    return { ok: false, brandSlug: slug, error: `posts query: ${postsErr.message}` };
  }
  const posts = (postsData ?? []) as ApprovedPost[];
  if (posts.length < MIN_POSTS_FOR_DERIVATION) {
    return {
      ok: false,
      brandSlug: slug,
      error: `only ${posts.length} post(s) with concept/visual_direction; need >= ${MIN_POSTS_FOR_DERIVATION}`,
    };
  }

  const derivation = await callGeminiForDerivation((brand as { name: string }).name, posts);
  if (!derivation.ok) {
    return { ok: false, brandSlug: slug, error: derivation.error };
  }

  // Upsert into brand_kits. Only overwrite the derivable fields — preserve
  // anything else a human filled in (positioning_user_edit, mission, etc.).
  const upsertPayload: Record<string, unknown> = {
    slug,
    name: (brand as { name: string }).name,
    updated_at: new Date().toISOString(),
  };
  if (derivation.kit.positioning) upsertPayload.positioning = derivation.kit.positioning;
  if (derivation.kit.photography_direction)
    upsertPayload.photography_direction = derivation.kit.photography_direction;
  if (derivation.kit.tone) upsertPayload.tone = derivation.kit.tone;
  if (derivation.kit.content_pillars)
    upsertPayload.content_pillars = derivation.kit.content_pillars;
  if (derivation.kit.hashtags) upsertPayload.hashtags = derivation.kit.hashtags;
  upsertPayload.confidence = {
    ...(derivation.kit.confidence ?? {}),
    _derived_from_post_count: posts.length,
    _derived_at: new Date().toISOString(),
    _model: derivation.model,
  };

  const { error: upsertErr } = await admin
    .from("brand_kits")
    .upsert(upsertPayload, { onConflict: "slug" });
  if (upsertErr) {
    return { ok: false, brandSlug: slug, error: `upsert: ${upsertErr.message}` };
  }

  return {
    ok: true,
    brandSlug: slug,
    postsAnalyzed: posts.length,
    model: derivation.model,
    updated: true,
  };
}

async function callGeminiForDerivation(
  brandName: string,
  posts: ApprovedPost[]
): Promise<
  | { ok: true; kit: DerivedKit; model: string }
  | { ok: false; error: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const postsLine = posts
    .map((p, i) => {
      const parts: string[] = [`POST ${i + 1}`];
      if (p.content_pillar) parts.push(`Pillar: ${p.content_pillar}`);
      if (p.post_type) parts.push(`Type: ${p.post_type}`);
      if (p.concept) parts.push(`Concept: ${p.concept}`);
      if (p.visual_direction) parts.push(`Visual: ${p.visual_direction}`);
      if (p.caption) parts.push(`Caption: ${p.caption}`);
      if (p.hashtags) parts.push(`Hashtags: ${p.hashtags}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");

  const instruction = `You are deriving a brand kit for "${brandName}" by analyzing ${posts.length} previously APPROVED social media posts. The posts have been approved by the client, so they represent the brand's de facto on-brand style.

Return ONLY strict JSON (no markdown fences) matching this schema. Omit any field you can't confidently derive — better to leave it out than guess. Add a "confidence" object with "low" | "medium" | "high" per derived field.

{
  "positioning": "1-2 sentence positioning statement that captures what this brand stands for",
  "photography_direction": "Visual direction summary: subjects, lighting, settings, mood",
  "tone": {
    "keywords": ["adjective", "adjective"],
    "vocab_use": ["phrases this brand uses"],
    "vocab_avoid": ["phrases this brand never uses"],
    "dos": ["voice do"],
    "donts": ["voice don't"]
  },
  "content_pillars": [{"name": "Education", "pct": 40, "description": ""}],
  "hashtags": {
    "always_on": [],
    "service": [],
    "local": [],
    "community": []
  },
  "confidence": {
    "positioning": "high",
    "photography_direction": "medium",
    "tone": "high",
    "content_pillars": "high",
    "hashtags": "medium"
  }
}

Approved posts:

${postsLine}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: `gemini fetch: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `gemini ${res.status}: ${t.slice(0, 400)}` };
  }

  type Part = { text?: string };
  type Candidate = { content?: { parts?: Part[] } };
  let body: { candidates?: Candidate[] };
  try {
    body = (await res.json()) as { candidates?: Candidate[] };
  } catch {
    return { ok: false, error: "gemini returned non-JSON envelope" };
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "no text in gemini response" };

  let parsed: DerivedKit;
  try {
    parsed = JSON.parse(text) as DerivedKit;
  } catch {
    return { ok: false, error: "gemini text was not valid JSON" };
  }

  return { ok: true, kit: parsed, model };
}

export async function deriveAllBrands(): Promise<{
  results: DeriveKitResult[];
}> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("brands").select("id");
  if (error || !data) return { results: [] };
  const results: DeriveKitResult[] = [];
  for (const row of data as { id: string }[]) {
    results.push(await deriveBrandKitForSlug(row.id));
  }
  return { results };
}
