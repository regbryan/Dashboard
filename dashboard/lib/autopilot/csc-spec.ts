import "server-only";
import type { CscArchetype } from "./render-csc";

// Synthesizes a Cyber Safety Cop design spec from a calendar post. Routes each
// post to the layout that fits its content (10 layouts), the way the references
// do. HEAVY bold sans — no italic/serif/script. Calm, empowering, NEVER alarmist.
// NEVER bakes the logo / CYBERSAFETYCOP.COM — those are composited on top.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type CscSpec = {
  archetype: CscArchetype;
  eyebrow: string;
  headline: string;
  headlineAccent?: string | null;
  body: string;
  cta: string;
  listItems?: { number?: string | null; lead?: string | null; text: string }[] | null;
  quadItems?: { heading: string; text: string }[] | null;
  bullets?: string[] | null;
  coralTag?: string | null;
  compare?: { goodLabel?: string; good: string[]; badLabel?: string; bad: string[] } | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type CscSynthResult = { ok: true; spec: CscSpec } | { ok: false; error: string };

// Content router — picks the layout that fits each post for a varied feed.
//   A          bold numbered STEPS (sequence: tell/block/delete, "3 steps")
//   QUAD       2x2 cards (a count of settings/signs/apps/features)
//   COMPARE    do-this/not-that, public vs private
//   STATEMENT  myth-bust / bold claim
//   CHECK      checkmark checklist
//   PHOTOSPLIT product/partner explainer (photo + blue/coral panel)
//   YHEADER    single spotlight setting (yellow header + photo)
//   D          big-number stat        C  command photo        G  review
export function pickArchetype(pillar: string | null, concept: string | null): CscArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  if (has(/review|testimon|parent said|5-star|five star|what parents/)) return "G";
  if (has(/bright canary|how .{0,24}(protects?|works|keeps)|membership|partner|trusted by|the app that/)) return "PHOTOSPLIT";
  if (has(/\bthe (1|one)\b|one setting|single setting|spotlight|inside bright/)) return "YHEADER";
  if (has(/ vs\.?\b| versus |public.{0,12}private|private.{0,12}public|safe.{0,8}(vs|or).{0,8}risky|do this|not that|difference between/)) return "COMPARE";
  if (has(/check ?list|things to check|tech check|audit their|back-to-school list/)) return "CHECK";
  if (has(/\bmyth\b|isn'?t (actually|really|truly)|not as private|truth about|reality check|debunk/)) return "STATEMENT";
  if (has(/\b\d+%|percent|how many|\b\d+ in \d+\b|the number/)) return "D";
  if (has(/\b\d+\s+(settings?|signs?|apps?|features?|red flags?|reasons?|rules?)\b/)) return "QUAD";
  if (has(/\b\d+\s+(steps?|ways?|things?|tips?|mistakes?)\b|how to|step-by-step|if .{0,20}(wrong|happens)|what to do/)) return "A";
  if (has(/talk to your|conversation|sit down|moment|tonight|family time/)) return "C";
  return "A"; // numbered steps is the workhorse default
}

function dataInstruction(a: CscArchetype): string {
  switch (a) {
    case "QUAD":
      return `2x2 CARD GRID. Fill "quad_items" with EXACTLY 4 objects { "heading":"<2-3 word label>", "text":"<one short doable phrase>" }. headline = the title (e.g. "4 Settings Every Parent Should Turn On"). photo.include = false.`;
    case "PHOTOSPLIT":
      return `PHOTO + SPLIT PANEL (product/partner explainer). photo.include = true; "photo.description" = a warm, POSITIVE photo of a calm parent + child together with a phone/tablet (never scared). Fill "bullets" with 3 short benefit phrases, "coral_tag" with a short trust line (e.g. "Trusted by Clay Cranford"). headline = what it does (e.g. "How Bright Canary Protects Your Kid's Phone").`;
    case "YHEADER":
      return `YELLOW HEADER + PHOTO. photo.include = true; "photo.description" = a calm, positive photo of a tween/teen using a phone safely at home (never scared). headline = the main line; "headline_accent" = a short blue second line (e.g. "Inside Bright Canary"). body = one caption sentence explaining the setting.`;
    case "COMPARE":
      return `TWO-COLUMN COMPARE. Fill "compare" = { "good_label":"<short>", "good":[3 short phrases], "bad_label":"<short>", "bad":[3 short phrases] } (e.g. Private vs Public). headline names the topic. photo.include = false.`;
    case "STATEMENT":
      return `BOLD MYTH-BUST. headline = one bold, calm myth-busting claim (e.g. "A 'private' account isn't actually private."). body = one reassuring sentence + what to do. photo.include = false.`;
    case "CHECK":
      return `CHECKMARK CHECKLIST. Fill "list_items" with 4-5 objects { "text":"<one short doable item>" } (no numbers needed). headline = the checklist title. photo.include = false.`;
    case "D":
      return `BIG-NUMBER stat. Fill "big_stat" with a single short number/stat (<=4 chars, e.g. "73%", "1", "9/10"). headline = the topic the number describes. photo.include = false.`;
    case "C":
      return `PHOTO + COMMAND BAND. photo.include = true; "photo.description" = a warm, POSITIVE, photorealistic moment of a calm parent and child together (e.g. looking at a phone together at the kitchen table). Bright, reassuring — NEVER scared. headline = a short command (e.g. "Talk to your kids about it tonight").`;
    case "G":
      return `TESTIMONIAL. Fill "quote" (a warm 1-2 sentence parent quote — relief/empowerment, NOT fear) and "attribution" (e.g. "Danielle, mom of 3"). photo.include = false.`;
    default:
      return `BOLD NUMBERED STEPS (the workhorse). Fill "list_items" with EXACTLY 3 objects { "number":"01", "lead":"<ONE bold action word, e.g. TELL>", "text":"<one short supporting sentence>" }. headline = the title (e.g. "If Something Feels Wrong Online"). photo.include = false.`;
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
    `- body: ONE short, reassuring, practical sentence (omit where the instruction says so).`,
    `- cta: a short 2-5 word CTA — e.g. "Swipe for the steps", "Save this for tonight", "Learn how". Action, not fear.`,
    `- eyebrow: a short ALL-CAPS category label (e.g. "PARENT TIPS", "DID YOU KNOW", "SAFETY RULES", "ONLINE SAFETY").`,
    `- NEVER include the logo, the words CYBER SAFETY COP / CYBERSAFETYCOP.COM, or any URL — those are added separately.`,
    `- Tone: calm and empowering. NEVER use horror, panic, "predator", or shock framing.`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline":"", "headline_accent":"", "body":"", "cta":"", "list_items":[{"number":"01","lead":"","text":""}], "quad_items":[{"heading":"","text":""}], "bullets":[""], "coral_tag":"", "compare":{"good_label":"","good":[""],"bad_label":"","bad":[""]}, "big_stat":"", "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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
  const cleanArr = (v: unknown, n: number): string[] =>
    Array.isArray(v) ? (v as unknown[]).map(clean).filter(Boolean).slice(0, n) : [];
  const headline = clean(parsed.headline);
  if (!headline && archetype !== "G") return { ok: false, error: "csc: no headline" };

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { number?: unknown; lead?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 5)
        .map((it, i) => ({
          number: typeof it.number === "string" && it.number.trim() ? it.number.trim() : String(i + 1).padStart(2, "0"),
          lead: typeof it.lead === "string" && it.lead.trim() ? clean(it.lead) : null,
          text: clean(it.text),
        }))
    : null;
  const quadItems = Array.isArray(parsed.quad_items)
    ? (parsed.quad_items as { heading?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.heading === "string" && typeof it.text === "string")
        .slice(0, 4)
        .map((it) => ({ heading: clean(it.heading), text: clean(it.text) }))
    : null;
  const cmpRaw = (parsed.compare ?? {}) as { good_label?: unknown; good?: unknown; bad_label?: unknown; bad?: unknown };
  const compare = { goodLabel: clean(cmpRaw.good_label) || "Do this", good: cleanArr(cmpRaw.good, 4), badLabel: clean(cmpRaw.bad_label) || "Not this", bad: cleanArr(cmpRaw.bad, 4) };

  const needsPhoto = archetype === "C" || archetype === "PHOTOSPLIT" || archetype === "YHEADER";

  const spec: CscSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 32) || "ONLINE SAFETY",
    headline,
    headlineAccent: archetype === "YHEADER" ? clean(parsed.headline_accent) || null : null,
    body: clean(parsed.body),
    cta: clean(parsed.cta) || "Learn how",
    listItems: archetype === "A" || archetype === "CHECK" ? listItems : null,
    quadItems: archetype === "QUAD" ? quadItems : null,
    bullets: archetype === "PHOTOSPLIT" ? cleanArr(parsed.bullets, 4) : null,
    coralTag: archetype === "PHOTOSPLIT" ? clean(parsed.coral_tag) || null : null,
    compare: archetype === "COMPARE" ? compare : null,
    bigStat: archetype === "D" ? clean(parsed.big_stat) || null : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: needsPhoto && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
