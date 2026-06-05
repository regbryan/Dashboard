import "server-only";
import type { BlitzArchetype, BlitzHeadlineLine } from "./render-blitz";

// Synthesizes a Blitz Organization design spec from a calendar post. Photo-FIRST
// (organized SPACES, never people): the photo-hero (A) is the default; soft
// listicle (C), question/empathetic card (D), and testimonial (G) cover tips,
// hooks, and social proof. CASUAL script hook + LIGHT sans. Warm-encourager
// voice, never shaming, soft CTAs. NEVER bakes the logo/wordmark.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type BlitzSpec = {
  archetype: BlitzArchetype;
  eyebrow: string;
  headlineLines: BlitzHeadlineLine[];
  body: string;
  cta: string;
  listItems?: { text: string }[] | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type BlitzSynthResult = { ok: true; spec: BlitzSpec } | { ok: false; error: string };

function pickArchetype(pillar: string | null, concept: string | null): BlitzArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  if (/review|testimon|client|loved|social proof|transformation reveal/.test(t)) return "G";
  if (/\b\d+\s+(ways|tips|steps|reasons|things|rules|habits|ideas)\b|checklist|how to|maintain|tips/.test(t)) return "C";
  if (/\?|question|how does|how can|what is|why |dear busy mom|empath|mental health|fun fact|did you know/.test(t)) return "D";
  return "A"; // photo-hero (organized space) default
}

function dataInstruction(a: BlitzArchetype): string {
  switch (a) {
    case "C":
      return `SOFT LISTICLE. Fill "list_items" with 3-4 objects { "text":"<short, specific, doable organizing tip>" }. photo.include = false.`;
    case "D":
      return `QUESTION / EMPATHETIC CARD. The headline is a CASUAL SCRIPT question or warm hook (e.g. "How does clutter affect your mental health?", "Dear busy mom…"). Add a short reassuring "body". photo.include = false.`;
    case "G":
      return `TESTIMONIAL. Fill "quote" (a warm 1-2 sentence client quote — relief and calm, "I actually want to keep it this way") and "attribution" (e.g. "Jamie, El Dorado Hills"). photo.include = false.`;
    default:
      return `PHOTO HERO (the default). photo.include = true; "photo.description" = a bright, airy, photorealistic ORGANIZED SPACE — a pantry, closet, drawer, or shelves with clear bins, labeled jars, matching baskets, everything in its place. Warm natural light, soft pastel/neutral tones, breathing room. ABSOLUTELY NO people, hands, or faces. No text in the photo.`;
  }
}

export async function synthesizeBlitzSpec(post: SpecPost): Promise<BlitzSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.content_pillar, post.concept);
  const instruction = [
    `You write copy for Blitz Organization's Instagram (@blitzyourspace) — a professional home organizing service in El Dorado Hills / Sacramento. Voice: a warm, encouraging friend who's great at organizing — question-driven, practical, calm. NEVER shaming about mess (no "messy/dirty/disaster/hoarder"), NEVER hard-sell ("BOOK NOW"). Soft, inviting CTAs only.`,
    `Visual brand: a CASUAL handwritten SCRIPT hook carries the emotion; LIGHT clean sans carries the info. Dusty rose + sage + warm beige, airy and soft.`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype)}`,
    ``,
    `RULES:`,
    `- headline_lines: 1-2 lines, each { "text", "style": "script" | "sans" }. Exactly ONE short "script" hook line (the emotional phrase); an optional "sans" line carries the supporting info. Mixed-case, warm. No markdown/asterisks.`,
    `- body: ONE short, reassuring, practical sentence in the brand voice (used on the question card; optional elsewhere).`,
    `- cta: a SOFT 2-4 word invitation — e.g. "save this for later", "follow for more", "let's get started", "DM us". NEVER "Book now" / "Limited spots".`,
    `- eyebrow: a short ALL-CAPS category label (e.g. "PANTRY TIPS", "DEAR BUSY MOM", "CLIENT LOVE", "PANTRY REVEAL").`,
    `- NEVER include the logo, the word BLITZ, the wordmark, or any URL — those are added separately.`,
    `- Tone: warm, encouraging, calm. Never shame the reader for clutter.`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline_lines":[{"text":"","style":"script"}], "body":"", "cta":"", "list_items":[{"text":""}], "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
  ].join("\n");

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: instruction }] }], generationConfig: { responseMimeType: "application/json" } }) });
  } catch (err) {
    return { ok: false, error: `gemini fetch: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok) return { ok: false, error: `gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}` };

  type Part = { text?: string };
  let bodyJson: { candidates?: { content?: { parts?: Part[] } }[] };
  try {
    bodyJson = (await res.json()) as { candidates?: { content?: { parts?: Part[] } }[] };
  } catch {
    return { ok: false, error: "gemini returned non-JSON envelope" };
  }
  const text = bodyJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "no text in gemini response" };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "gemini spec was not valid JSON" };
  }

  const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/[*_`]+/g, "").replace(/\s{2,}/g, " ").trim() : "");
  const lines = Array.isArray(parsed.headline_lines)
    ? (parsed.headline_lines as { text?: unknown; style?: unknown }[])
        .filter((l) => l && typeof l.text === "string")
        .map((l) => ({ text: clean(l.text), style: (l.style === "sans" ? "sans" : "script") as "script" | "sans" }))
        .filter((l) => l.text.length > 0)
    : [];
  if (lines.length === 0 && archetype !== "G") return { ok: false, error: "blitz: no headline lines" };
  // Guarantee exactly one script hook (the signature). If none flagged, the first line becomes the script hook.
  if (lines.length > 0 && !lines.some((l) => l.style === "script")) lines[0].style = "script";

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 4)
        .map((it) => ({ text: clean(it.text) }))
        .filter((it) => it.text.length > 0)
    : null;

  const spec: BlitzSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 28) || "BLITZ",
    headlineLines: lines,
    body: clean(parsed.body),
    cta: clean(parsed.cta) || "save this for later",
    listItems: archetype === "C" ? listItems : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: archetype === "A" && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
