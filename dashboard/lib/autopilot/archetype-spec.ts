import "server-only";
import type { BrandTemplate, ArchetypeSpec } from "./archetype-prompt";

// Turns a calendar post (concept + pillar + type) into a structured ArchetypeSpec:
// picks the right archetype from the brand's catalog and writes the on-image copy
// (eyebrow, headline with italic-serif emphasis, body, trust, CTA, photo brief) in
// the brand voice. Uses the same Gemini text-model + JSON-mode pattern as
// authorSlots() in generate-calendar.ts. The phone in the CTA is forced in code.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// The IEC social-tracking phone is the only number allowed on an image. We set
// it deterministically rather than trusting the LLM to remember the rule.
const IMAGE_PHONE = "951.789.3238";

type SpecPost = {
  concept: string | null;
  content_pillar: string | null;
  post_type: string | null;
  post_number?: number | null;
};

export type SynthSpecResult =
  | { ok: true; spec: ArchetypeSpec }
  | { ok: false; error: string };

/**
 * Resolve the model's archetype choice to a real template key. Template keys are
 * full names like "A_color_block_photo_split"; the model may return the full key
 * OR just the leading code ("A", "J2"). Returns the canonical key or null.
 */
function resolveArchetypeKey(template: BrandTemplate, chosen: string): string | null {
  const keys = Object.keys(template.ARCHETYPES ?? {});
  const c = chosen.trim().toUpperCase();
  if (!c) return null;
  // Exact (case-insensitive) match.
  let hit = keys.find((k) => k.toUpperCase() === c);
  if (hit) return hit;
  // Leading code match: "A" -> "A_color_block_photo_split", "J2" -> "J2_myth_busted_cutout".
  hit = keys.find((k) => k.split("_")[0].toUpperCase() === c);
  return hit ?? null;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// The brand never labels its own artwork with its name or abbreviation (client
// rule: "they don't refer to themselves as IEC"). Normalize for comparison.
function normalizeLabel(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
// True if `text` IS the brand's name/short (whole-word for the short acronym, so
// "IEC" and "IEC TIP" are rejected but "EFFICIENCY"/"SERVICE" are not), or empty.
function isBrandSelfLabel(text: string, brandName: string, brandShort: string): boolean {
  const n = normalizeLabel(text);
  if (!n) return true;
  if (brandName && n === normalizeLabel(brandName)) return true;
  if (brandShort) {
    const s = normalizeLabel(brandShort);
    if (s && n === s) return true;
    if (s && new RegExp(`\\b${s}\\b`, "i").test(text.replace(/[^A-Za-z0-9 ]/g, " "))) return true;
  }
  return false;
}
// Resolve a safe eyebrow CATEGORY label: prefer the model's, but if it's the
// brand name/short (or empty) fall back to the content pillar, then a per-
// archetype default — NEVER the brand's own name. Empty result = no pill.
function safeEyebrowText(
  modelText: string,
  pillar: string | null,
  forcedLetter: string,
  brandName: string,
  brandShort: string
): string {
  const archetypeDefault = forcedLetter === "D" ? "5-STAR REVIEW" : "";
  const model = modelText.toUpperCase().slice(0, 32);
  if (model && !isBrandSelfLabel(model, brandName, brandShort)) return model;
  const pillarLabel = (pillar ?? "").trim().toUpperCase().slice(0, 32);
  if (pillarLabel && !isBrandSelfLabel(pillarLabel, brandName, brandShort)) return pillarLabel;
  return archetypeDefault;
}

// VARIETY ORDER for IEC — photo archetypes lead (Instagram/HVAC favors real
// photos: A/B/C/I are the photo layouts) but every position is a DIFFERENT layout
// so the feed never repeats the same look. Posts are DEALT across this by
// post_number, instead of content keywords clustering onto A/C.
const IEC_VARIETY_ORDER = ["A", "C", "B", "I", "QUAD", "E", "D", "H", "F", "G"];

// Only a few layouts are genuinely content-LOCKED (myth split, emergency hero,
// a real testimonial, a founder story). Everything else is spread by position so
// the feed varies — the fix for "all the IEC designs look the same".
function pickArchetypeLetter(
  pillar: string | null,
  concept: string | null,
  postNumber?: number | null
): string {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  if (has(/\bmyth\b|misconcept|truth about|debunk|don'?t believe/)) return "I"; // PHOTO — myth-vs-truth split
  if (has(/emergency|24\/7|broke down|no (heat|a\/?c|cooling)|heat ?wave|middle of (summer|the night)|stuck without/)) return "B"; // PHOTO — dramatic full-bleed
  if (has(/\breview\b|testimon|\bspotlight\b|customer (love|story|win)|5[- ]star/)) return "D"; // testimonial (no fabricated customer photo)
  if (has(/founder|family[- ]owned|about us|our story|since \d{4}|\b\d+\s+years (in|of)/)) return "H"; // founder/brand story
  // Everything else: deal a distinct layout by position so the feed varies.
  const n = Number.isFinite(postNumber) ? Number(postNumber) : hashStr(t);
  return IEC_VARIETY_ORDER[((n % IEC_VARIETY_ORDER.length) + IEC_VARIETY_ORDER.length) % IEC_VARIETY_ORDER.length];
}

function dataInstruction(letter: string, market: string): string {
  switch (letter) {
    case "D":
      return `This is a TESTIMONIAL card. Fill "quote" (a realistic 1-2 sentence customer quote, ${market} homeowner voice) and "attribution" (e.g. "The Patel Family, Riverside"). headline_lines: a short 2-line lead-in (e.g. the gist of the review) is fine. photo.include MUST be false.`;
    case "E":
      return `This is a NUMBERED LIST. Fill "list_items" with EXACTLY 3 objects { "number": "1|2|3", "text": "<short, specific item>" }. headline_lines = the list's title (2-3 lines). photo.include MUST be false.`;
    case "QUAD":
      return `This is a 4-CARD GRID. Fill "list_items" with EXACTLY 4 objects { "number": "1|2|3|4", "text": "<short warning sign / reason / tip>" }. headline_lines = the grid's title (2-3 lines). photo.include MUST be false.`;
    case "I":
      return `This is a MYTH-vs-TRUTH split. headline_lines = the MYTH — the common misconception, 1-2 short bold lines (no "myth:" prefix; the label is added in code). body_copy = the TRUTH — the correction, 1-2 short sentences (no "truth:" prefix). This uses a PHOTO: set photo.include = true and write photo.description = a relevant ${market} home or HVAC-equipment scene (no people unless a homeowner naturally fits). Leave list_items/big_stat empty.`;
    case "F":
      return `This is a BIG-NUMBER hero. Fill "big_stat" with the single hero number/stat (<=5 chars, e.g. "$99", "0%", "24/7"). headline_lines = the supporting line. photo.include MUST be false.`;
    case "G":
      return `This is a BIG-STAT card. Fill "big_stat" with the hero number (<=5 chars, e.g. "78°F", "30%"). headline_lines = the supporting line. photo.include MUST be false.`;
    case "H":
      return `This is a BRAND-STORY. Fill "big_stat" with a year or number (<=5 chars, e.g. "2009", "15+"). headline_lines = the supporting line. photo.include MUST be false.`;
    default:
      return [
        `This uses a PHOTO. Set photo.include = true and write a "photo.description" of a BEAUTIFUL, photorealistic, magazine-quality scene that fits the concept. Leave quote/list_items/big_stat empty.`,
        `PHOTO SUBJECT — match it to the concept:`,
        `  • Comfort / gift / Father's or Mother's Day / "quiet home" / family / people → SHOW a happy, relaxed PERSON or FAMILY enjoying a comfortable home (e.g. a content dad relaxing on the sofa for Father's Day; a mom for Mother's Day; a family together in a cozy living room). The person is the point — include them. A real homeowner/family, NOT a technician.`,
        `  • AC / seasonal / efficiency / equipment → a clean outdoor AC condenser beside a tidy ${market} home, or a bright modern interior. No people needed.`,
        `  • Service call / repair / tune-up visit / "our crew" → a single working technician (per the technician rule below) — this is the ONLY case that gets a worker.`,
        `Never put a WORKER/technician in a gift, comfort, seasonal, or lifestyle post — but a relaxed homeowner/family is welcome and encouraged there.`,
      ].join("\n");
  }
}

export async function synthesizeArchetypeSpec(
  template: BrandTemplate,
  post: SpecPost
): Promise<SynthSpecResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const brand = template.BRAND ?? {};
  const brandName = (brand.name as string) ?? "";
  const brandShort = (brand.short as string) ?? "";
  const voice = (brand.voice as string) ?? "warm, straight-talking, no hype";
  const trustMarks = Array.isArray(brand.trust_marks)
    ? (brand.trust_marks as string[]).join("; ")
    : "";

  const market = (brand.market as string) ?? "the local area";
  // Archetype is chosen deterministically (by content pillar) for guaranteed
  // variety — the model only writes the copy/data for that archetype.
  const forcedLetter = pickArchetypeLetter(post.content_pillar, post.concept, post.post_number);
  const forcedKey = resolveArchetypeKey(template, forcedLetter) ?? forcedLetter;
  const archDesc = template.ARCHETYPES?.[forcedKey]?.description ?? "";

  const instruction = [
    `You are a senior brand designer for ${brand.name ?? "the brand"}. Voice: ${voice}.`,
    `Write the copy for ONE social graphic. The LAYOUT (archetype) is already chosen for you below — do NOT change it; just fill its copy.`,
    ``,
    `POST:`,
    `- concept: ${post.concept ?? ""}`,
    `- content pillar: ${post.content_pillar ?? ""}`,
    `- post type: ${post.post_type ?? ""}`,
    ``,
    `ARCHETYPE (fixed): ${forcedLetter} — ${archDesc}`,
    dataInstruction(forcedLetter, market),
    ``,
    `RULES:`,
    `- The headline mixes BOLD SANS lines with exactly 1-2 ITALIC-SERIF emphasis words/phrase (a short emotional or temporal phrase). 2-3 short lines. The italic styling is applied automatically by the "style" field — do NOT wrap any words in asterisks, underscores, or markdown.`,
    `- The eyebrow is a short CATEGORY label for the post (e.g. "AC MAINTENANCE TIP", "HOME EFFICIENCY", "5-STAR REVIEW", "ENERGY SAVINGS"). It must NEVER be the company name or an abbreviation of it — do NOT use "${brandName}"${brandShort ? ` or "${brandShort}"` : ""}.`,
    `- Body copy: 1-3 short sentences in the brand voice. No hype, no pressure.`,
    `- CTA text is overridden in code with the phone; just return "CALL ${IMAGE_PHONE}".`,
    `- Trust element (optional): pick from — ${trustMarks || "a 5-star review line"}.`,
    `- Most photos should have NO worker. ONLY if the concept is genuinely about service/repair/the crew may the photo include a technician — and then: a single technician in a SOLID NAVY short-sleeve polo + dark navy work pants, shown FROM BEHIND or side profile, kneeling and actively working on a furnace or AC condenser — back to camera, face not visible, NO hat, NO logo/text on clothing. NEVER a posed team/crew lineup.`,
    ``,
    `Return ONLY a JSON object with this exact shape (fill only the field(s) the archetype needs):`,
    `{`,
    `  "eyebrow": { "color": "red" | "navy" | "light-blue", "text": "<ALL CAPS short CATEGORY label — never the brand name>" },`,
    `  "headline_lines": [ { "text": "<line>", "style": "sans" | "italic-serif" } ],`,
    `  "body_copy": "<1-3 sentences>",`,
    `  "photo": { "include": true | false, "description": "<scene, or empty>" },`,
    `  "trust_element": "<short trust line or null>",`,
    `  "quote": "<D only>", "attribution": "<D only>",`,
    `  "list_items": [ { "number": "1", "text": "..." } ],`,
    `  "big_stat": "<F/G/H only>",`,
    `  "cta": { "text": "CALL ${IMAGE_PHONE}" }`,
    `}`,
  ].join("\n");

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
    return { ok: false, error: `gemini fetch: ${err instanceof Error ? err.message : String(err)}` };
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

  let parsed: Partial<ArchetypeSpec>;
  try {
    parsed = JSON.parse(text) as Partial<ArchetypeSpec>;
  } catch {
    return { ok: false, error: "gemini spec was not valid JSON" };
  }

  // Archetype was chosen deterministically (forcedKey) — the model only wrote copy.
  const archetype = forcedKey;
  // Strip stray markdown emphasis markers — the model sometimes wraps words in
  // *asterisks* / _underscores_ / `backticks`, which would render literally.
  const clean = (v: unknown): string =>
    typeof v === "string" ? v.replace(/[*_`]+/g, "").replace(/\s{2,}/g, " ").trim() : "";
  const lines = Array.isArray(parsed.headline_lines)
    ? parsed.headline_lines
        .filter((l): l is { text: string; style: "sans" | "italic-serif" } =>
          !!l && typeof l.text === "string"
        )
        .map((l) => ({
          text: clean(l.text),
          style: (l.style === "italic-serif" ? "italic-serif" : "sans") as "sans" | "italic-serif",
        }))
        .filter((l) => l.text.length > 0)
    : [];
  if (lines.length === 0) return { ok: false, error: "gemini returned no headline lines" };

  const letter = archetype.split("_")[0].toUpperCase();
  const usesPhoto = letter === "A" || letter === "B" || letter === "C" || letter === "I";

  const listItems = Array.isArray(parsed.list_items)
    ? parsed.list_items
        .filter((it): it is { number?: string | null; text: string } => !!it && typeof it.text === "string")
        .slice(0, 4)
        .map((it, i) => ({
          number: typeof it.number === "string" && it.number.trim() ? it.number.trim() : String(i + 1),
          text: clean(it.text),
        }))
    : null;

  const str = (v: unknown) => clean(v) || null;

  const spec: ArchetypeSpec = {
    archetype,
    eyebrow: {
      color:
        parsed.eyebrow?.color === "navy" || parsed.eyebrow?.color === "light-blue"
          ? parsed.eyebrow.color
          : "red",
      text: safeEyebrowText(clean(parsed.eyebrow?.text), post.content_pillar, forcedLetter, brandName, brandShort),
    },
    headline_lines: lines,
    body_copy: clean(parsed.body_copy),
    photo: {
      include: usesPhoto && parsed.photo?.include !== false,
      description: typeof parsed.photo?.description === "string" ? parsed.photo.description : "",
    },
    trust_element: str(parsed.trust_element),
    // Per-archetype extras (only the relevant one is used by the renderer).
    quote: letter === "D" ? str(parsed.quote) : null,
    attribution: letter === "D" ? str(parsed.attribution) : null,
    list_items: letter === "E" || letter === "QUAD" ? listItems : null,
    big_stat: letter === "F" || letter === "G" || letter === "H" ? str(parsed.big_stat) : null,
    // Phone forced in code — never trust the model with the number.
    cta: { text: `CALL ${IMAGE_PHONE}` },
  };

  return { ok: true, spec };
}
