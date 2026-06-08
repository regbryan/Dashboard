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
  listItems?: { number?: string | null; lead?: string | null; text: string }[] | null;
  quadItems?: { heading: string; text: string }[] | null;
  compare?: { keepLabel?: string; keep: string[]; tossLabel?: string; toss: string[] } | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type BlitzSynthResult = { ok: true; spec: BlitzSpec } | { ok: false; error: string };

// Content router across Blitz's 10 layouts.
//   C         the signature numbered BARS (5 things / steps)
//   QUAD      a 2x2 grid (zones / areas)        CHECK  a reset checklist
//   COMPARE   keep / toss                        STAT   a big-number trick (3-bin rule)
//   PHOTOPANEL organized photo + question panel   STATEMENT soft encouragement
//   D         empathetic question card           G  testimonial    A  photo-hero
export function pickArchetype(pillar: string | null, concept: string | null): BlitzArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  if (has(/review|testimon|client love|loved|social proof/)) return "G";
  if (has(/keep or toss|keep vs|what to keep|what to toss|toss or keep|this or that/)) return "COMPARE";
  if (has(/\b\d+[- ]?bin\b|\d+-?bin rule|the \d+ rule|our favorite trick|golden rule/)) return "STAT";
  if (has(/check ?list|sunday reset|weekly reset|reset routine|\b\d+[- ]?minute/)) return "CHECK";
  if (has(/\b\d+\s+(zones|areas|rooms|spaces|drawers|categories)\b/)) return "QUAD";
  if (has(/\b\d+\s+(ways|tips|steps|reasons|things|rules|habits|ideas|items|mistakes)\b/)) return "C";
  if (has(/maintain|best way to|how to keep|keep it (this way|organized)|stay organized|long.?term/)) return "PHOTOPANEL";
  if (has(/clutter isn'?t|you'?re not|gentle reminder|no judgment|grace|permission to|not about being/)) return "STATEMENT";
  if (has(/\?|question|how does|how can|what is|why |dear busy mom|empath|mental health|overwhelm|did you know/)) return "D";
  return "A"; // photo-hero (organized space) default
}

const ORGANIZED_SPACE = "a bright, airy, photorealistic ORGANIZED SPACE — a pantry, closet, drawer, or shelves with clear bins, labeled jars, matching baskets, everything in its place. Warm natural light, soft pastel/neutral tones, breathing room. ABSOLUTELY NO people, hands, or faces. No text in the photo.";

function dataInstruction(a: BlitzArchetype): string {
  switch (a) {
    case "C":
      return `SIGNATURE NUMBERED LIST. Fill "list_items" with 3-5 objects { "number":"01", "lead":"<a short bold item, max 4 words>", "text":"<one short, doable line>" }. headline_lines = a casual script hook + a short sans line. photo.include = false.`;
    case "QUAD":
      return `2x2 GRID. Fill "quad_items" with EXACTLY 4 objects { "heading":"<a 2-3 word zone/area>", "text":"<one short doable phrase>" }. headline_lines = a script hook + short sans line. photo.include = false.`;
    case "CHECK":
      return `RESET CHECKLIST. Fill "list_items" with 4-5 objects { "text":"<one short doable reset step>" }. headline_lines = a script hook + short sans line. photo.include = false.`;
    case "COMPARE":
      return `KEEP / TOSS. Fill "compare" = { "keep_label":"Keep", "keep":[3 short phrases], "toss_label":"Toss", "toss":[3 short phrases] }. headline_lines = a short script hook (e.g. "Keep or Toss?"). photo.include = false.`;
    case "STAT":
      return `BIG-NUMBER TRICK. Fill "big_stat" with a single short number (e.g. "3", "15", "80%"). headline_lines = a script line naming the trick (e.g. "The 3-Bin Rule"). body = one short explanation. photo.include = false.`;
    case "PHOTOPANEL":
      return `ORGANIZED PHOTO + QUESTION PANEL. photo.include = true; "photo.description" = ${ORGANIZED_SPACE} headline_lines = ONE short sans question (e.g. "What's the best way to maintain an organized space?"). body = a warm 1-2 sentence practical answer.`;
    case "STATEMENT":
      return `SOFT ENCOURAGEMENT. headline_lines = a warm script line + a short sans line (e.g. script "Clutter isn't a" + sans "character flaw"). body = one reassuring sentence (no shame). photo.include = false.`;
    case "D":
      return `QUESTION / EMPATHETIC CARD. The headline is a CASUAL SCRIPT question or warm hook (e.g. "How does clutter affect your mental health?", "Dear busy mom…"). Add a short reassuring "body". photo.include = false.`;
    case "G":
      return `TESTIMONIAL. Fill "quote" (a warm 1-2 sentence client quote — relief and calm, "I actually want to keep it this way") and "attribution" (e.g. "Jamie, El Dorado Hills"). photo.include = false.`;
    default:
      return `PHOTO HERO (the default). photo.include = true; "photo.description" = ${ORGANIZED_SPACE}`;
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
    `Return ONLY JSON: { "eyebrow":"", "headline_lines":[{"text":"","style":"script"}], "body":"", "cta":"", "list_items":[{"number":"01","lead":"","text":""}], "quad_items":[{"heading":"","text":""}], "compare":{"keep_label":"","keep":[""],"toss_label":"","toss":[""]}, "big_stat":"", "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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
  const cleanArr = (v: unknown, n: number): string[] =>
    Array.isArray(v) ? (v as unknown[]).map(clean).filter(Boolean).slice(0, n) : [];
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { number?: unknown; lead?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 5)
        .map((it, i) => ({
          number: typeof it.number === "string" && it.number.trim() ? it.number.trim() : String(i + 1).padStart(2, "0"),
          lead: typeof it.lead === "string" && it.lead.trim() ? clean(it.lead) : null,
          text: clean(it.text),
        }))
        .filter((it) => it.text.length > 0)
    : null;
  const quadItems = Array.isArray(parsed.quad_items)
    ? (parsed.quad_items as { heading?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.heading === "string" && typeof it.text === "string")
        .slice(0, 4)
        .map((it) => ({ heading: clean(it.heading), text: clean(it.text) }))
    : null;
  const cmpRaw = (parsed.compare ?? {}) as { keep_label?: unknown; keep?: unknown; toss_label?: unknown; toss?: unknown };
  const compare = { keepLabel: clean(cmpRaw.keep_label) || "Keep", keep: cleanArr(cmpRaw.keep, 5), tossLabel: clean(cmpRaw.toss_label) || "Toss", toss: cleanArr(cmpRaw.toss, 5) };

  const spec: BlitzSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 28) || "BLITZ",
    headlineLines: lines,
    body: clean(parsed.body),
    cta: clean(parsed.cta) || "save this for later",
    listItems: archetype === "C" || archetype === "CHECK" ? listItems : null,
    quadItems: archetype === "QUAD" ? quadItems : null,
    compare: archetype === "COMPARE" ? compare : null,
    bigStat: archetype === "STAT" ? clean(parsed.big_stat) || null : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: (archetype === "A" || archetype === "PHOTOPANEL") && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
