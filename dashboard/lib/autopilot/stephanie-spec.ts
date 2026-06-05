import "server-only";
import type { StephanieArchetype, StephanieHeadlineLine } from "./render-stephanie";

// Synthesizes a Stephanie Perez design spec from a calendar post. TEXT-CARD
// FIRST (she's a personal brand — her real photos can't be fabricated): the
// values/services card (C) is the workhorse; quote (D), testimonial (G), and a
// people-free lifestyle photo-overlay (A) round it out. White SERIF voice +
// flowing SCRIPT personal accent. First-person, calm, values-forward. NEVER
// bakes the AHL logo / NMLS / DRE / headshot / compliance.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type StephanieSpec = {
  archetype: StephanieArchetype;
  eyebrow: string;
  headlineLines: StephanieHeadlineLine[];
  body: string;
  cta: string;
  listItems?: { text: string }[] | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type StephanieSynthResult = { ok: true; spec: StephanieSpec } | { ok: false; error: string };

function pickArchetype(pillar: string | null, concept: string | null): StephanieArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  if (/in contract|client|testimon|celebrat|closed|congrat|review/.test(t)) return "G";
  if (/inspir|motivat|quote|dream|equity|did you know|fun fact|calm power/.test(t)) return "D";
  if (/lifestyle|seasonal|holiday|photo|st\.?\s*patrick|christmas|spring|summer|fall|winter/.test(t)) return "A";
  return "C"; // values / services / education — the personal-brand workhorse
}

function dataInstruction(a: StephanieArchetype): string {
  switch (a) {
    case "A":
      return `PHOTO OVERLAY CARD. photo.include = true; "photo.description" = a warm, inviting, photorealistic LIFESTYLE scene with ABSOLUTELY NO people/faces/hands — a cozy sunlit living room, a welcoming front porch, house keys on a counter, a quiet tree-lined neighborhood, a kitchen with morning light. Soft natural light, magazine quality. No text in the photo.`;
    case "D":
      return `QUOTE / INSPIRATIONAL CARD. headline = a calm, uplifting serif line (educational hook or inspirational quote). Add a short "body" sentence. photo.include = false.`;
    case "G":
      return `TESTIMONIAL / CELEBRATION (text only, NO fabricated headshot). Fill "quote" (a warm 1-2 sentence client celebration in Stephanie's first-person voice) and "attribution" (e.g. "The Reyes Family"). photo.include = false.`;
    default:
      return `VALUES / SERVICES CARD (the workhorse). Optionally fill "list_items" with 3-5 short first-person promises { "text":"I ..." } (e.g. "I'll tell you what you need to know — honestly"). headline = the card title (e.g. "What I will do for you"). photo.include = false.`;
  }
}

export async function synthesizeStephanieSpec(post: SpecPost): Promise<StephanieSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.content_pillar, post.concept);
  const instruction = [
    `You write copy for Stephanie Perez's Instagram (@stephanieperezhomeloans) — a personal-brand mortgage loan consultant in El Dorado Hills / Sacramento Valley. Voice: FIRST-PERSON singular ("I/me/my", NEVER "we/our team"), values-forward (honesty, integrity, calm), unhurried, relational. A trusted friend who happens to be your loan officer; 15 years in law enforcement before mortgage.`,
    `Visual brand: elegant SERIF carries the voice; a flowing SCRIPT is the personal signature accent (one short accent max). Calm and editorial.`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype)}`,
    ``,
    `RULES:`,
    `- headline_lines: 1-2 lines, each { "text", "style": "serif" | "script" }. Mostly "serif"; AT MOST ONE short "script" accent line (a warm personal phrase). Mixed-case. No markdown/asterisks.`,
    `- body: ONE short, calm, plain-English sentence in first-person voice (used on quote/values cards; optional elsewhere).`,
    `- cta: a SOFT, relational invitation, 2-4 words — e.g. "I'd love to help", "DM me", "Let's talk". NEVER "Apply now" / "Limited time" / "Best rates".`,
    `- eyebrow: a short ALL-CAPS label (e.g. "FIRST-TIME BUYERS", "THE QUIET POWER OF EQUITY", "THE TRUTH ABOUT WORKING WITH ME").`,
    `- NEVER include the AHL logo, "Answer Home Loans", "Stevenson Lending Group", NMLS, DRE, any license number, or a compliance footer — those are added separately.`,
    `- Always first-person ("I"), never "we". Calm and values-forward, never urgent or salesy.`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline_lines":[{"text":"","style":"serif"}], "body":"", "cta":"", "list_items":[{"text":""}], "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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
        .map((l) => ({ text: clean(l.text), style: (l.style === "script" ? "script" : "serif") as "serif" | "script" }))
        .filter((l) => l.text.length > 0)
    : [];
  if (lines.length === 0 && archetype !== "G") return { ok: false, error: "stephanie: no headline lines" };
  // At most one script accent (the personal signature). Demote any extras to serif.
  let sawScript = false;
  for (const l of lines) {
    if (l.style === "script") {
      if (sawScript) l.style = "serif";
      sawScript = true;
    }
  }

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 5)
        .map((it) => ({ text: clean(it.text) }))
        .filter((it) => it.text.length > 0)
    : null;

  const spec: StephanieSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 36) || "WITH STEPHANIE",
    headlineLines: lines,
    body: clean(parsed.body),
    cta: clean(parsed.cta) || "I'd love to help",
    listItems: archetype === "C" ? listItems : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: archetype === "A" && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
