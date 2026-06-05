import "server-only";
import type { CscArchetype } from "./render-csc";

// Synthesizes a Cyber Safety Cop design spec from a calendar post. List-FIRST:
// the workhorse is the yellow numbered listicle (A); big-number (D), command
// photo (C), and review (G) are used for stats, photo-led tips, and reviews.
// HEAVY bold sans — no italic/serif/script. Calm, empowering, NEVER alarmist.
// NEVER bakes the logo / CYBERSAFETYCOP.COM — those are composited on top.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type CscSpec = {
  archetype: CscArchetype;
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
  listItems?: { number?: string | null; text: string }[] | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type CscSynthResult = { ok: true; spec: CscSpec } | { ok: false; error: string };

function pickArchetype(pillar: string | null, concept: string | null): CscArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  if (/review|testimon|parent said|5-star|five star|what parents/.test(t)) return "G";
  if (/\b\d+\s+(ways|tips|steps|reasons|things|settings|signs|mistakes|apps|rules)\b|checklist|how to|step-by-step|every parent/.test(t)) return "A";
  if (/\b\d+%|percent|stat|did you know|number|how many|the 1 |the one /.test(t)) return "D";
  if (/talk to your|conversation|moment|reassur|sit down|family time/.test(t)) return "C";
  return "A"; // numbered listicle is the workhorse default
}

function dataInstruction(a: CscArchetype): string {
  switch (a) {
    case "D":
      return `BIG-NUMBER stat. Fill "big_stat" with a single short number/stat (<=4 chars, e.g. "73%", "1", "9/10"). headline = the topic the number describes. photo.include = false.`;
    case "C":
      return `PHOTO + COMMAND BAND. photo.include = true; "photo.description" = a warm, POSITIVE, photorealistic moment of a calm parent and child together (e.g. a parent and tween looking at a phone together at the kitchen table, a mom and son laughing on the couch). Bright, reassuring — NEVER scared, shocked, or panicked. No text in the photo. headline = a short command (e.g. "Talk to your kids about it tonight").`;
    case "G":
      return `TESTIMONIAL. Fill "quote" (a warm 1-2 sentence parent quote — relief/empowerment, NOT fear) and "attribution" (e.g. "Danielle, mom of 3"). photo.include = false.`;
    default:
      return `NUMBERED LISTICLE (the workhorse). Fill "list_items" with 3-4 objects { "number":"1", "text":"<short, specific, doable step>" }. headline = the list title (e.g. "4 Settings Every Parent Should Turn On"). photo.include = false.`;
  }
}

export async function synthesizeCscSpec(post: SpecPost): Promise<CscSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.content_pillar, post.concept);
  const instruction = [
    `You write copy for Cyber Safety Cop's Instagram. Cyber Safety Cop teaches parents how to keep kids and teens safe online. Voice: a calm, empowering, practical guide — helps parents feel CAPABLE, never scared. No fear-mongering, no predator panic, no shocked-mom cliché. Always end on "here's what you can do".`,
    `Visual brand: HEAVY bold sans headlines, mixed-case. Sunny yellow + electric blue. NO italic, NO serif, NO script.`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype)}`,
    ``,
    `RULES:`,
    `- headline: ONE short, bold, mixed-case headline (NOT all caps). Command or curiosity, never alarmist. No markdown/asterisks.`,
    `- body: ONE short, reassuring, practical sentence (omit for the listicle if redundant).`,
    `- cta: a short 2-5 word CTA — e.g. "Swipe for the steps", "Save this for tonight", "Learn how". Action, not fear.`,
    `- eyebrow: a short ALL-CAPS category label (e.g. "PARENT TIPS", "DID YOU KNOW", "PARENT REVIEWS", "ONLINE SAFETY").`,
    `- NEVER include the logo, the words CYBER SAFETY COP / CYBERSAFETYCOP.COM, or any URL — those are added separately.`,
    `- Tone: calm and empowering. NEVER use horror, panic, "predator", "danger" shock framing.`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline":"", "body":"", "cta":"", "list_items":[{"number":"1","text":""}], "big_stat":"", "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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
  if (!headline && archetype !== "G") return { ok: false, error: "csc: no headline" };

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { number?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 4)
        .map((it, i) => ({ number: typeof it.number === "string" && it.number.trim() ? it.number.trim() : String(i + 1), text: clean(it.text) }))
    : null;

  const spec: CscSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 32) || "ONLINE SAFETY",
    headline,
    body: clean(parsed.body),
    cta: clean(parsed.cta) || "Learn how",
    listItems: archetype === "A" ? listItems : null,
    bigStat: archetype === "D" ? clean(parsed.big_stat) || null : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: archetype === "C" && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
