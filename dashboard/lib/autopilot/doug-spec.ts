import "server-only";
import type { DougArchetype } from "./render-doug";

// Synthesizes a Doug Mitchell (Scale LLP) LinkedIn title-card spec from a post.
// TEXT-FIRST thought leadership: the title card (A) is the default; list card
// (D), war-story card (G), and an occasional corporate-photo card (C) round it
// out. Quiet, advisory, plain-spoken M&A voice. NO accent, NO emoji, NO hustle.
// NEVER bakes the SCALE LLP wordmark (overlaid later); attribution IS rendered.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type DougSpec = {
  archetype: DougArchetype;
  eyebrow: string;
  headline: string;
  subtitle: string;
  listItems?: { lead?: string | null; text: string }[] | null;
  bigStat?: string | null;
  quote?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type DougSynthResult = { ok: true; spec: DougSpec } | { ok: false; error: string };

function hashStr(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

// Content router across Doug's 10 landscape LinkedIn layouts.
//   WARSTORY  dark photo + hook       CONTRAST  belief vs reality
//   FRAMEWORK numbered frame          STAT      big number
//   LIST      advisory list           SPLIT     photo + teal panel
//   MINT      light insight card      PANEL     photo + teal headline panel
//   PHOTO     photo cover (default)    TITLE     text-only teal title
export function pickArchetype(pillar: string | null, concept: string | null): DougArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  if (has(/war story|i advised|anonymi|the deal that|almost died|client i|mistake i see|11 ?pm|night before close/)) return "WARSTORY";
  if (has(/ vs\.?\b| versus |most (people|founders|owners) (think|believe)|why .* (is wrong|gets it wrong)|the myth|contrarian|everyone says/)) return "CONTRAST";
  if (has(/framework|the \d+-part|\d+ pillars|how to think about|a frame not|mental model/)) return "FRAMEWORK";
  if (has(/\$\s?\d|\b\d+\s+deals|\b\d+\+? years|\b\d+%|by the numbers|in \d+ deals/)) return "STAT";
  if (has(/hidden cost|the cheapest|what (most )?founders miss|before you sign/)) return "SPLIT";
  if (has(/\b\d+\s+(things|reasons|mistakes|steps|questions|ways|moves|clauses)\b|every (founder|buyer|seller)|checklist/)) return "LIST";
  if (has(/practical advice|the one thing|a reminder|principle|rule of thumb|note to founders/)) return "MINT";
  if (has(/flagship|cover|cityscape|skyline|feature graphic|milestone/)) return "PANEL";
  return hashStr(concept ?? t) % 2 === 0 ? "PHOTO" : "TITLE";
}

const CORP_PHOTO = "a quiet corporate/architectural scene — glass towers, a city skyline at dusk, an empty boardroom table, modern office architecture. ABSOLUTELY NO people, faces, or hands. It sits under a teal scrim. No text in the photo.";

function dataInstruction(a: DougArchetype): string {
  switch (a) {
    case "PHOTO":
    case "PANEL":
    case "SPLIT":
      return `PHOTO COVER. photo.include = true; "photo.description" = ${CORP_PHOTO} headline = an advisory thought-leadership headline; subtitle = one sharp supporting line.`;
    case "WARSTORY":
      return `WAR-STORY (dark photo + hook). photo.include = true; "photo.description" = ${CORP_PHOTO} Fill "quote" with the SHORT hook line (an anonymized, specific moment — e.g. "The deal that almost died at 11pm the night before close"). Keep it punchy; the body of the story goes in the LinkedIn caption, not the image.`;
    case "TITLE":
      return `TITLE CARD (text only). headline = an advisory thought-leadership headline; subtitle = one sharp supporting line. photo.include = false.`;
    case "LIST":
      return `LIST CARD. Fill "list_items" with 3-4 advisory points { "text":"<specific, operator-language point>" }. headline = the list promise. photo.include = false.`;
    case "FRAMEWORK":
      return `FRAMEWORK (3 parts). Fill "list_items" with EXACTLY 3 objects { "lead":"<a one-word part name>", "text":"<one short sentence>" }. headline = the framework's name (e.g. "The 3-Part Diligence Framework"). photo.include = false.`;
    case "STAT":
      return `BIG NUMBER. Fill "big_stat" with one short figure (<=6 chars, e.g. "$2.3M", "100", "20+"). headline = a short supporting line; subtitle = one sentence of context. photo.include = false.`;
    case "CONTRAST":
      return `BELIEF vs REALITY. subtitle = the common BELIEF (the thing people assume). headline = the REALITY (the sharper truth). Keep both to one short line. photo.include = false.`;
    case "MINT":
      return `LIGHT INSIGHT CARD. headline = one quiet, quotable advisory principle; subtitle = one supporting line. photo.include = false.`;
    default:
      return `TITLE CARD. headline = an advisory headline; subtitle = one sharp line. photo.include = false.`;
  }
}

export async function synthesizeDougSpec(post: SpecPost): Promise<DougSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.content_pillar, post.concept);
  const instruction = [
    `You write LinkedIn thought-leadership title-card copy for Doug Mitchell, Esq., a Partner at Scale LLP writing on M&A. Audience: founders/CEOs 12-36 months from an exit, plus M&A peers. Voice: expert but plain-spoken (no Latin, define any legalese on first use), advisory framing (give a frame, not a to-do list), specific over general (anonymized real examples with numbers), QUIET authority (no bravado, no hustle, nothing political).`,
    `Visual brand: quiet teal + cream-mint title card, NO accent color, NO emoji. Tone test: a McKinsey partner's LinkedIn, never a hustle bro's.`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype)}`,
    ``,
    `HEADLINE GRAMMAR (use one): "The Hidden Cost of [X]" · "[X] vs [Y]: The Winning Formula for [outcome]" · "Embracing [counterintuitive concept] in M&A" · "Avoiding [bad outcome]: The Power of [Y]" · "Why [belief] is Wrong About [topic]" · "The [N] [things] Every [founder] Should [know] Before [milestone]".`,
    ``,
    `RULES:`,
    `- headline: ONE advisory headline that LANDS an idea (not curiosity-gap clickbait). Mixed-case. No markdown/asterisks.`,
    `- subtitle: ONE sharp supporting line (used on title/photo cards).`,
    `- eyebrow: a short ALL-CAPS pillar label (e.g. "M&A EDUCATION", "BEFORE YOU SIGN", "WAR STORY", "PRACTICAL ADVICE").`,
    `- NEVER include the SCALE LLP wordmark/logo or any firm mark — added separately. Do NOT write "Doug Mitchell" or "Partner" in the copy (the card adds the attribution).`,
    `- No emoji, no hustle language ("game-changer", "10x", "level up", "disrupt"), nothing political. Avoid casual "litigation" (Doug helps clients avoid it).`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline":"", "subtitle":"", "list_items":[{"lead":"","text":""}], "big_stat":"", "quote":"", "photo":{"include":false,"description":""} }`,
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
  const headline = clean(parsed.headline);
  if (!headline && archetype !== "WARSTORY") return { ok: false, error: "doug: no headline" };

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { lead?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 4)
        .map((it) => ({ lead: typeof it.lead === "string" && it.lead.trim() ? clean(it.lead) : null, text: clean(it.text) }))
        .filter((it) => it.text.length > 0)
    : null;

  const needsPhoto = archetype === "PHOTO" || archetype === "PANEL" || archetype === "SPLIT" || archetype === "WARSTORY";

  const spec: DougSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 28) || "M&A ADVISORY",
    headline,
    subtitle: clean(parsed.subtitle),
    listItems: archetype === "LIST" || archetype === "FRAMEWORK" ? listItems : null,
    bigStat: archetype === "STAT" ? clean(parsed.big_stat) || null : null,
    quote: archetype === "WARSTORY" ? clean(parsed.quote) || null : null,
    photo: { include: needsPhoto && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
