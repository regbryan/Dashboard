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
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null; post_number?: number | null };
export type StephanieSynthResult = { ok: true; spec: StephanieSpec } | { ok: false; error: string };

// Content router across Stephanie's 10 layouts — picks the one that fits each
// post for a varied, on-brand feed.
//   POLAROID  client celebration (script + framed photo on cream)
//   G         pure text testimonial / review
//   NUMBER    a quiet big stat (rate / market / %)
//   SPLIT     "choosing / what to look for" + check list beside a photo
//   CHECK     a checklist / first-steps card (no photo)
//   TOPBAND   explainer statement (band on top of a photo)
//   PHOTOBAND personal statement over a lifestyle photo
//   D         inspirational / quote      A  lifestyle photo-overlay
//   C         values / services workhorse
function hashStr(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

// When no keyword rule fires, spread across the three STRUCTURALLY DISTINCT
// text layouts — EDITORIAL (left-rail, left-aligned column), SPLITBLOCK (two-tone
// horizontal color block), PULLQUOTE (oversized editorial quote). These don't
// share the centered-on-a-solid-card silhouette of C/CHECK/D/NUMBER, so the
// all-text feed varies in SHAPE, not just wording. Index by (feed position +
// concept hash) so neither parity nor a raw hash clusters. The old centered cards
// stay reachable only via explicit rules (checklist→CHECK, %/rate→NUMBER,
// testimonial→G); photo layouts stay rule-gated too.
const STEPHANIE_TEXT_ROTATION: StephanieArchetype[] = ["EDITORIAL", "SPLITBLOCK", "PULLQUOTE"];

export function pickArchetype(
  pillar: string | null,
  concept: string | null,
  postNumber: number = 0,
): StephanieArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  if (has(/in contract|just closed|she'?s a homeowner|he'?s a homeowner|client win|keys to|welcome home|closing day|congrat/)) return "POLAROID";
  if (has(/testimonial|review|what (my )?clients say|client said|hear from/)) return "G";
  if (has(/\b\d+ ?[-–] ?\d+%|\b\d+%|rate update|market update|by the numbers|the number/)) return "NUMBER";
  if (has(/choosing a|what to look for|how to choose|red flags|questions to ask|signs of a/)) return "SPLIT";
  if (has(/check ?list|first steps|before you (shop|buy)|to-?do|step-by-step|\b\d+ (steps|things to do|things to gather)/)) return "CHECK";
  if (has(/let'?s clear this up|the truth about|here'?s what|explained|breaking down|what .* actually/)) return "TOPBAND";
  if (has(/why i do|closer than you think|i hear it all the time|here'?s the thing|you can trust|high-stakes/)) return "PHOTOBAND";
  if (has(/inspir|motivat|quote|dream|equity|fun fact|calm power|you deserve/)) return "D";
  if (has(/lifestyle|seasonal|holiday|st\.?\s*patrick|christmas|spring|summer|fall|winter/)) return "A";
  const idx = (Math.abs(postNumber) + hashStr(`${pillar ?? ""}|${concept ?? ""}`)) % STEPHANIE_TEXT_ROTATION.length;
  return STEPHANIE_TEXT_ROTATION[idx];
}

const PEOPLE_FREE = "a warm, inviting, photorealistic LIFESTYLE scene with ABSOLUTELY NO people/faces/hands — a cozy sunlit living room, a welcoming front porch, house keys on a counter, a quiet tree-lined neighborhood, a kitchen with morning light. Soft natural light, magazine quality. No text in the photo.";

function dataInstruction(a: StephanieArchetype): string {
  switch (a) {
    case "A":
      return `PHOTO OVERLAY CARD. photo.include = true; "photo.description" = ${PEOPLE_FREE}`;
    case "PHOTOBAND":
      return `PHOTO + STATEMENT BAND. photo.include = true; "photo.description" = ${PEOPLE_FREE} headline_lines = ONE calm first-person serif statement (e.g. "This is why I do what I do."). body = a warm 1-2 sentence first-person elaboration.`;
    case "TOPBAND":
      return `PHOTO + TOP EXPLAINER BAND. photo.include = true; "photo.description" = ${PEOPLE_FREE} headline_lines = a short serif explainer line (e.g. "Closing costs — let's clear this up."). body = ONE plain-English first-person sentence that clears it up.`;
    case "SPLIT":
      return `PHOTO + CHECK PANEL. photo.include = true; "photo.description" = ${PEOPLE_FREE} headline_lines = a serif title + AT MOST ONE short script accent (e.g. serif "Choosing a Lender" + script "what to look for"). Fill "list_items" with 4-5 SHORT check points.`;
    case "POLAROID":
      return `CLIENT CELEBRATION. photo.include = true; "photo.description" = a joyful but PEOPLE-FREE celebration scene — house keys on a counter, a "SOLD" sign in a green front yard, a welcome mat at a new front door. No people/faces/hands, no text. headline_lines = ONE short SCRIPT line (e.g. "In Contract" / "Just Closed"). body = a warm 1-2 sentence first-person client celebration.`;
    case "CHECK":
      return `CHECKLIST CARD (no photo). headline_lines = a serif title + AT MOST ONE short script accent (e.g. serif "Your First Steps" + script "before you shop"). Fill "list_items" with 4-5 short, CONCRETE tips or steps ABOUT THE TOPIC that the READER can act on — imperative or second-person (e.g. "Keep card balances under 30%", "Pay every bill on time"). These are real, topic-specific actions — NOT first-person "I'll..." promises. photo.include = false.`;
    case "NUMBER":
      return `QUIET BIG STAT (no photo). Fill "big_stat" with the single most relevant number for THIS topic (<=5 chars — e.g. credit utilization "30%", DTI "43%", disclosure window "3 days", the down-payment myth "20%", a low-down option "3.5%"). headline_lines = a short serif label that frames what the number means. body = ONE calm first-person sentence. photo.include = false.`;
    case "D":
      return `INSIGHT / REFRAME CARD (no list, no generic platitude). headline_lines = ONE calm serif line that reframes THIS topic in a fresh, specific way (e.g. for Rent vs Buy: "Renting isn't wasted money — but it isn't building yours, either."), optionally one short script accent. body = ONE supporting first-person sentence. photo.include = false.`;
    case "G":
      return `TESTIMONIAL / CELEBRATION (text only, NO fabricated headshot). Fill "quote" (a warm 1-2 sentence client celebration in Stephanie's first-person voice) and "attribution" (e.g. "The Reyes Family"). photo.include = false.`;
    case "EDITORIAL":
      return `LEFT-ALIGNED EDITORIAL COLUMN (no photo). headline_lines = a serif title + AT MOST ONE short script accent. body = REQUIRED — ONE plain-English first-person sentence (never leave it empty). Fill "list_items" with 3-4 short, CONCRETE points ABOUT THE TOPIC (real takeaways or tips, NOT "I'll..." promises). photo.include = false.`;
    case "SPLITBLOCK":
      return `TWO-TONE SPLIT (deep-blue headline block over a cream content block, no photo). headline_lines = ONE serif title (no script needed). body = REQUIRED — ONE-TWO calm sentences that explain the topic; this fills the lower block, so it must NOT be empty. You MAY also add "list_items" of 3-4 short concrete points about the topic. photo.include = false.`;
    case "PULLQUOTE":
      return `OVERSIZED PULL-QUOTE (no photo, no list). Fill "quote" with ONE short, quotable INSIGHT or reframe about this topic (<=16 words, e.g. "Your credit score isn't a verdict — it's a habit."). "attribution" = a short context tag (e.g. "On Credit", "On Rent vs. Buy"). photo.include = false.`;
    default:
      return `VALUES / TAKEAWAYS CARD. Fill "list_items" with 3-5 short points. Choose by concept: for a "what I do for you / why work with me" post, use first-person promises ("I'll tell you what you need to know — honestly"); for an EDUCATIONAL or topic post, use the KEY TAKEAWAYS about the topic instead (NOT "I'll..." promises). headline = a title that fits the concept. photo.include = false.`;
  }
}

export async function synthesizeStephanieSpec(post: SpecPost): Promise<StephanieSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.content_pillar, post.concept, post.post_number ?? 0);
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
    `Return ONLY JSON: { "eyebrow":"", "headline_lines":[{"text":"","style":"serif"}], "body":"", "cta":"", "list_items":[{"text":""}], "big_stat":"", "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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

  const bodyText = clean(parsed.body);
  const usesList = (a: StephanieArchetype) => a === "C" || a === "SPLIT" || a === "CHECK" || a === "EDITORIAL" || a === "SPLITBLOCK";
  const keptList = usesList(archetype) ? listItems : null;

  // Guard: EDITORIAL/SPLITBLOCK have a dedicated content area that looks broken
  // when empty. If the model returned neither body nor list, fall back to the
  // headline-only PULLQUOTE (which needs only the headline) so we never ship a
  // half-empty card.
  let finalArch = archetype;
  let quoteText = archetype === "G" || archetype === "PULLQUOTE" ? clean(parsed.quote) : "";
  if ((finalArch === "SPLITBLOCK" || finalArch === "EDITORIAL") && !bodyText && !(keptList && keptList.length)) {
    finalArch = "PULLQUOTE";
    quoteText = lines.map((l) => l.text).join(" ");
  }
  const isQuote = finalArch === "G" || finalArch === "PULLQUOTE";

  const spec: StephanieSpec = {
    archetype: finalArch,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 36) || "WITH STEPHANIE",
    headlineLines: lines,
    body: bodyText,
    cta: clean(parsed.cta) || "I'd love to help",
    listItems: usesList(finalArch) ? keptList : null,
    bigStat: finalArch === "NUMBER" ? clean(parsed.big_stat) || null : null,
    quote: isQuote ? quoteText || null : null,
    attribution: isQuote ? clean(parsed.attribution) || null : null,
    photo: {
      include: (finalArch === "A" || finalArch === "PHOTOBAND" || finalArch === "TOPBAND" || finalArch === "SPLIT" || finalArch === "POLAROID") && photoObj.include !== false,
      description: clean(photoObj.description),
    },
  };
  return { ok: true, spec };
}
