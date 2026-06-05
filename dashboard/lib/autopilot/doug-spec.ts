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
  listItems?: { text: string }[] | null;
  quote?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type DougSynthResult = { ok: true; spec: DougSpec } | { ok: false; error: string };

function pickArchetype(pillar: string | null, concept: string | null): DougArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  if (/war story|i advised|anonymi|a founder|client i|story|mistake i see/.test(t)) return "G";
  if (/\b\d+\s+(things|reasons|mistakes|steps|questions|ways|moves)\b|every founder|every buyer|every seller|checklist|before you sign/.test(t)) return "D";
  if (/flagship|cover|visual|cityscape|skyline|feature graphic/.test(t)) return "C";
  return "A"; // title card default
}

function dataInstruction(a: DougArchetype): string {
  switch (a) {
    case "C":
      return `PHOTO TITLE CARD. photo.include = true; "photo.description" = a quiet corporate/architectural scene — glass towers, a city skyline at dusk, an empty boardroom table, modern office architecture. ABSOLUTELY NO people, faces, or hands. It will sit under a heavy teal overlay. No text in the photo.`;
    case "D":
      return `LIST CARD. Fill "list_items" with 3-4 advisory points { "text":"<specific, operator-language point>" }. headline = the list promise ('The 3 things every founder should settle before an LOI'). photo.include = false.`;
    case "G":
      return `WAR-STORY CARD. Fill "quote" with a short, anonymized, SPECIFIC war story in Doug's first-person advisory voice (a real consequence with a number, e.g. escrow lost, deal delayed). photo.include = false.`;
    default:
      return `TITLE CARD (the default). headline = an advisory thought-leadership headline; subtitle = one sharp supporting line. photo.include = false.`;
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
    `Return ONLY JSON: { "eyebrow":"", "headline":"", "subtitle":"", "list_items":[{"text":""}], "quote":"", "photo":{"include":false,"description":""} }`,
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
  if (!headline && archetype !== "G") return { ok: false, error: "doug: no headline" };

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 4)
        .map((it) => ({ text: clean(it.text) }))
        .filter((it) => it.text.length > 0)
    : null;

  const spec: DougSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 28) || "M&A ADVISORY",
    headline,
    subtitle: clean(parsed.subtitle),
    listItems: archetype === "D" ? listItems : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    photo: { include: archetype === "C" && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
