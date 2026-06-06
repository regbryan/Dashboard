import "server-only";
import type { OmegaArchetype, OmegaHeadlineLine } from "./render-omega";

// Synthesizes an Omega design spec from a calendar post. Photo-FIRST: most posts
// are the photo-hero (A); text archetypes (C list, D big-number, G review) are
// used only for genuine lists, stats, and reviews. Serif headline + flowing
// script accent. NEVER bakes logo / NMLS / compliance — those are overlay-only.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type OmegaSpec = {
  archetype: OmegaArchetype;
  eyebrow: string;
  headlineLines: OmegaHeadlineLine[];
  body: string;
  cta: string;
  listItems?: { number?: string | null; lead?: string | null; text: string }[] | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = {
  concept: string | null;
  content_pillar: string | null;
  post_type: string | null;
  post_number?: number | null;
};
export type OmegaSynthResult = { ok: true; spec: OmegaSpec } | { ok: false; error: string };

function pickArchetype(
  concept: string | null,
  pillar: string | null,
  postNumber: number | null | undefined
): OmegaArchetype {
  // Match content to format the way the brand's real feed does, so a mixed
  // calendar yields a mixed feed (educational -> photo+list, emotional ->
  // statement, stat -> big number, review -> testimonial) instead of one
  // template repeating.
  const c = (concept ?? "").toLowerCase();
  const p = (pillar ?? "").toLowerCase();

  // Genuine single-number stat → big-number (D).
  if (/\d\s?%/.test(c) || /\$\s?\d/.test(c) || /\b\d+\b\s*(days|years|months|points)\b/.test(c)) {
    return "D";
  }
  // Explicit testimonial / quote → G.
  if (/testimonial|review|["“]|hear from|client said|what .+ (say|said)/.test(c)) {
    return "G";
  }
  // Emotional / celebration / community content → editorial STATEMENT (E). These
  // are not tactical lists. Driven by the "Client Stories & Community" pillar and
  // clear concept cues (NOT incidental words — the cues below are intentional).
  const emotional =
    p.includes("community") || p.includes("client stories") ||
    /celebrat|milestone|congrat|welcome home|thank you|grateful|refer|who do you know|tag (a|someone|them)|journey|memories|proud|love story|dream come true|for dad|for mom|father'?s day|mother'?s day|juneteenth|\bpride\b|home for/.test(c);
  if (emotional) {
    return "E";
  }
  // Educational / practical content → photo + numbered list (A, the signature),
  // with a light rotation to E so long runs of how-to posts still break up.
  if (((postNumber ?? 0) % 5) === 0 && (postNumber ?? 0) > 0) {
    return "E";
  }
  return "A";
}

function dataInstruction(a: OmegaArchetype): string {
  switch (a) {
    case "A":
    case "C":
      return `PHOTO + 3-POINT LIST (the signature). Fill "list_items" with EXACTLY 3 objects { "number":"1", "lead":"<a short bold takeaway, max 5 words, e.g. 'FHA: 3.5% down'>", "text":"<one supporting sentence>" }. A photo is added automatically — leave photo.description empty.`;
    case "D":
      return `BIG-NUMBER stat. Fill "big_stat" with a single short number/stat (<=4 chars, e.g. "3%", "20%", "15"). Write a one-sentence body explaining why it matters. No list, no photo.`;
    case "E":
      return `STATEMENT post — no photo, no list, no stat. Just the script+serif headline and a warm 2-3 sentence body paragraph (personal, partnering, like talking to a friend). Leave list_items, big_stat, photo.description empty.`;
    case "G":
      return `TESTIMONIAL. Fill "quote" (a warm 1-2 sentence client quote, homebuyer voice) and "attribution" (e.g. "The Reyes Family"). No photo.`;
    default:
      return ``;
  }
}

export async function synthesizeOmegaSpec(post: SpecPost): Promise<OmegaSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.concept, post.content_pillar, post.post_number);
  const instruction = [
    `You write copy for Omega Mortgage Group's Instagram. Voice: a warm, patient senior loan officer guiding a first-time homebuyer — educational, reassuring, partnering. Never pushy, never hard-sell, never "APPLY NOW".`,
    `Editorial/premium feel. The headline is an elegant SERIF display with ONE flowing SCRIPT accent line (a short connecting phrase) — e.g. serif "Your Dream Home" + script "is closer than you think".`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype)}`,
    ``,
    `RULES:`,
    `- headline_lines: 2-3 lines, each { "text", "style": "serif" | "script" }. Exactly ONE short "script" accent line; the rest "serif". Mixed-case (NOT all caps). No markdown/asterisks.`,
    `- body: a short reassuring line — or a warm 2-3 sentence paragraph for a statement (E) post — in the brand voice.`,
    `- cta: a soft 2-3 word CTA — e.g. "Let's talk", "See if you qualify", "Ask us how". NEVER "Apply now" / "Limited time".`,
    `- eyebrow: a short ALL-CAPS category label (e.g. "FIRST-TIME BUYERS", "WAYS TO SAVE", "WHY REFINANCE?").`,
    `- NEVER include the logo, the words OMEGA/MORTGAGE/GROUP, NMLS, license numbers, or any compliance text — those are added separately.`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline_lines":[{"text":"","style":"serif"}], "body":"", "cta":"", "list_items":[{"number":"1","lead":"","text":""}], "big_stat":"", "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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
  if (lines.length === 0) return { ok: false, error: "omega: no headline lines" };
  // Guarantee at least one script accent line for the signature look.
  if (!lines.some((l) => l.style === "script") && lines.length > 1) lines[lines.length - 1].style = "script";

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { number?: unknown; lead?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 3)
        .map((it, i) => ({
          number: typeof it.number === "string" && it.number.trim() ? it.number.trim() : String(i + 1),
          lead: typeof it.lead === "string" && it.lead.trim() ? clean(it.lead) : null,
          text: clean(it.text),
        }))
    : null;

  const spec: OmegaSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 32) || "OMEGA",
    headlineLines: lines,
    body: clean(parsed.body),
    cta: clean(parsed.cta) || "Let's talk",
    listItems: archetype === "A" || archetype === "C" ? listItems : null,
    bigStat: archetype === "D" ? clean(parsed.big_stat) || null : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: archetype === "A", description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
