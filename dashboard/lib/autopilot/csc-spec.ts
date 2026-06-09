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

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null; post_number?: number | null };
export type CscSynthResult = { ok: true; spec: CscSpec } | { ok: false; error: string };

// ============================================================================
// AI FULL-DESIGN PROMPT (the model draws the ENTIRE post). Mirrors
// buildStephanieDesignPrompt: CSC's whole kit (heavy bold sans, sunny yellow +
// electric blue, FILLED blue number circles, calm-not-alarmist, no logo/url
// baked) is encoded so nothing gets dropped. Replaces the Satori render-csc path.
// ============================================================================
const CSC_KIDS_PHOTO =
  "a warm, bright, POSITIVE photorealistic photo of a calm parent and child (or a tween/teen) together at home using a phone or tablet — reassuring and capable, NEVER scared, shocked, panicked, or in danger. Natural light, real diverse people, magazine quality, no stock cheese. No text or logos in the photo";

function cscArchetypeLayout(spec: CscSpec): string {
  switch (spec.archetype) {
    case "A":
      return `SUNNY YELLOW (#FFDE59) full background. A bold header pill at the top holds the eyebrow/title; below it the headline; then 3 NUMBERED ROWS, each a FILLED solid electric-blue circle with a white numeral (NEVER a hollow ring), a bold ALL-CAPS action lead, and one short supporting line.`;
    case "QUAD":
      return `A clean white or ice-blue (#D9EDF8) field. A bold header at top, then a 2x2 GRID of EXACTLY 4 rounded cards (blue or yellow accented), each with a short bold heading and one doable phrase.`;
    case "PHOTOSPLIT":
      return `A SPLIT layout: a ${CSC_KIDS_PHOTO} fills one half; the other half is a solid electric-blue panel with the bold headline, 3 short benefit bullet lines (each with a small check), and a short trust tag line. NO partner brand names.`;
    case "YHEADER":
      return `A bold SUNNY-YELLOW header bar across the TOP holds the headline plus a short electric-blue accent line; below it a ${CSC_KIDS_PHOTO} fills the rest, with one short white caption sentence on a blue band.`;
    case "COMPARE":
      return `A TWO-COLUMN compare on white. The headline across the top. Left column (electric-blue header) lists 3 short "do/safe" phrases each with a check; right column (gray header) lists 3 short "avoid/risky" phrases each with an X. Heavy bold sans throughout.`;
    case "CHECK":
      return `A clean white/ice-blue checklist card. A bold headline at the top, then 4-5 rows each with a sunny-yellow or blue CHECKMARK and one short doable item in bold sans.`;
    case "STATEMENT":
      return `A bold electric-blue or sunny-yellow field (no photo). ONE large, calm, bold myth-busting headline dominates the frame; one short reassuring sentence beneath. Heavy bold sans, mixed-case.`;
    case "D":
      return `SUNNY-YELLOW background. ONE huge electric-blue NUMERAL/stat dominates the upper area; a bold topic headline beneath. A ${CSC_KIDS_PHOTO} can fill the lower portion behind a blue swoosh band.`;
    case "C":
      return `A full-bleed ${CSC_KIDS_PHOTO} fills the frame. A short bold ALL-CAPS command (3-5 words) sits in the upper-left in white or sunny-yellow over a subtle scrim.`;
    case "G":
      return `A clean card (white or ice-blue). A bold header, a warm parent quote in large bold sans, optional row of sunny-yellow stars, and an attribution line beneath. Calm and relieved in tone, never fearful.`;
    default:
      return `SUNNY YELLOW background with a bold header pill and 3 FILLED-blue-circle numbered rows. Heavy bold sans, calm and empowering.`;
  }
}

// CSC's STRICT brand contract, encoded inline (exact hexes/fonts/rules lifted
// verbatim from this file's prior prose version). Handing the model the JSON
// contract — exact hexes, a FORBIDDEN list, hard rules, and a negative prompt —
// instead of a prose paragraph stops it re-interpreting "blue"/"yellow" and
// drifting the brand color post-to-post. This is the same pattern proven on
// Omega; #057AC0 + #FFDE59 stay locked across the whole feed.
const CSC_STRICT_COLOR_CONTRACT = {
  electric_blue: "#057AC0",
  light_blue: "#66ABD3",
  sunny_yellow: "#FFDE59",
  ice_blue: "#D9EDF8",
  white: "#FFFFFF",
  dark_gray: "#646668",
  light_gray: "#AEAFB0",
  color_roles: {
    "#057AC0": "Electric blue — eyebrow pills, FILLED numbered circles, big numerals, CTAs, swooshes.",
    "#66ABD3": "Lighter blue — soft secondary fills.",
    "#FFDE59": "SATURATED sunny yellow — dominant background on listicle/stat posts. NEVER muted or pastel.",
    "#D9EDF8": "Ice blue — soft alternate background.",
    "#FFFFFF": "White — text on blue, card fills.",
    "#646668": "Dark gray — headline + body text on yellow/white.",
    "#AEAFB0": "Light gray — secondary text only.",
  },
  FORBIDDEN: [
    "NO coral / pink (reserved for co-branded posts ONLY)",
    "NO muted or pastel yellow — sunny yellow must stay saturated #FFDE59",
    "NO blue other than #057AC0 / #66ABD3",
    "NO italic, NO serif emphasis, NO script (that is another brand's pattern)",
    "NO hollow numbered rings — CSC circles are FILLED solid blue with white numerals",
  ],
  _ENFORCE_EXACT:
    "Use these hex values EXACTLY. Do NOT improvise, re-interpret, or shift any color — #057AC0 and #FFDE59 must be identical on every post.",
};

const CSC_TYPOGRAPHY = {
  display:
    "HEAVY bold sans-serif headlines (Montserrat / Poppins / Bebas Neue style), mixed-case — command via WEIGHT and CASE.",
  rule: "ABSOLUTELY NO italic, NO serif emphasis, NO script. CSC is bold sans only.",
  numbered_circles: "FILLED solid electric-blue (#057AC0) circles with WHITE numerals — NEVER hollow rings.",
  body: "Regular/medium sans, dark gray (#646668) or white, generous line height.",
  eyebrow: "Solid electric-blue pill, white ALL-CAPS bold label.",
};

const CSC_GLOBAL_HARD_RULES = [
  "NO logo, brand mark, or the words \"CYBER SAFETY COP\" / \"CYBERSAFETYCOP.COM\" / any URL — the logo is composited separately after delivery.",
  "Leave a clean SOLID-COLOR top ~12% zone (no key text/content) so the logo can be overlaid cleanly later.",
  "Numbered lists use FILLED solid blue circles with white numerals — NEVER hollow rings.",
  "Calm, EMPOWERING, capable tone — never scary, never alarmist, never a shocked-parent or predator-panic vibe. Always \"here's what you can do\".",
  "NEVER show \"BRIGHT CANARY\", \"OURPACT\", or any partner/app brand name; no predator/fear/horror imagery; no shocked-parent cliché.",
  "NO misspellings, no watermarks, no UI chrome, no stray borders. Photos must look like real editorial photography, never AI-plastic.",
];

const CSC_GLOBAL_NEGATIVE_PROMPT =
  "italic, serif, script font, hollow numbered circles, muted yellow, pastel yellow, coral, pink, Bright Canary palette, OurPact, alarmist, fear-mongering, shocked parent, panicked face, scared child, predator, horror palette, dark moody, logo, CYBER SAFETY COP, CYBERSAFETYCOP.COM, any URL, watermark, UI chrome, border, outer frame, stray borders, AI-plastic photo, misspelled or garbled text";

// JSON-CONTRACT generation (same shape as buildOmegaDesignPrompt): we hand the
// model the STRICT JSON contract — exact hexes, a FORBIDDEN list, hard rules,
// and a negative prompt — with this post's copy + layout filled in. The model
// follows the contract instead of guessing, so the brand color is locked feed-wide.
export function buildCscDesignPrompt(spec: CscSpec): string {
  const numbered_list = (spec.listItems ?? []).map((it, i) => ({
    filled_blue_circle_numeral: String(it.number || String(i + 1).padStart(2, "0")),
    lead: it.lead || null,
    text: it.text,
  }));
  const four_cards = (spec.quadItems ?? []).map((q) => ({ heading: q.heading, text: q.text }));
  const compare = spec.compare
    ? {
        good_label: spec.compare.goodLabel || "Do this",
        good: spec.compare.good ?? [],
        bad_label: spec.compare.badLabel || "Not that",
        bad: spec.compare.bad ?? [],
      }
    : null;

  const contract = {
    INSTRUCTION:
      "Create ONE Instagram post graphic, 4:5 portrait (1080x1350), for Cyber Safety Cop — a brand that teaches parents to keep kids safe online. This JSON is a STRICT brand contract — obey every field exactly. Do NOT improvise or vary the colors; use the STRICT_COLOR_CONTRACT hex values precisely. Render every word EXACTLY as written under CONTENT, crisp and correctly spelled, no invented words. Tone is CALM, EMPOWERING, capable — never scary or alarmist.",
    STRICT_COLOR_CONTRACT: CSC_STRICT_COLOR_CONTRACT,
    TYPOGRAPHY: CSC_TYPOGRAPHY,
    LAYOUT: { archetype: spec.archetype, description: cscArchetypeLayout(spec) },
    CONTENT: {
      eyebrow_pill: spec.eyebrow || null,
      headline: spec.headline || null,
      headline_accent: spec.headlineAccent || null,
      body: spec.body || null,
      numbered_list: numbered_list.length ? numbered_list : null,
      four_cards: four_cards.length ? four_cards : null,
      benefit_bullets: spec.bullets && spec.bullets.length ? spec.bullets : null,
      compare,
      trust_tag: spec.coralTag || null,
      big_stat: spec.bigStat || null,
      quote: spec.quote || null,
      attribution: spec.attribution || null,
      cta: spec.cta || null,
      footer:
        "NONE — leave the bottom ~12% a calm, empty quiet zone (no text, no logo, no URL); the logo is overlaid after delivery.",
    },
    GLOBAL_HARD_RULES: CSC_GLOBAL_HARD_RULES,
    GLOBAL_NEGATIVE_PROMPT: CSC_GLOBAL_NEGATIVE_PROMPT,
  };
  return "Follow this JSON brand contract EXACTLY when generating the image:\n\n" + JSON.stringify(contract, null, 2);
}

function hashStr(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

// VARIETY ORDER — the FULL CscArchetype set, interleaved so adjacent posts
// contrast (text / grid / photo / compare). Posts are DEALT across this list by
// position (post_number) so a month cycles through every layout instead of
// clustering on the "A" workhorse. This is the fix for "all the designs look the
// same": variety is forced by distribution, not by content keywords (which kept
// funneling everything onto A). Mirrors OMEGA_VARIETY_ORDER.
//   A          bold numbered STEPS          (text, yellow)
//   QUAD       2x2 cards                    (text grid)
//   PHOTOSPLIT photo + blue panel           (photo)
//   YHEADER    yellow header + photo        (photo)
//   COMPARE    do-this / not-that columns   (text)
//   CHECK      checkmark checklist          (text)
//   STATEMENT  myth-bust / bold claim       (text, bold field)
//   D          big-number stat              (text/photo)
//   C          full-bleed command photo     (photo)
//   G          parent review card           (text)
const CSC_VARIETY_ORDER: CscArchetype[] = [
  "A", "QUAD", "PHOTOSPLIT", "YHEADER", "COMPARE", "CHECK", "STATEMENT", "D", "C", "G",
];

// Only a few layouts are genuinely content-LOCKED (a real testimonial, the "1
// setting" spotlight, a partner/Bright-Canary explainer, an explicit compare).
// Everything else is spread by position so the feed varies.
export function pickArchetype(
  pillar: string | null,
  concept: string | null,
  postNumber?: number | null
): CscArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  // Content-locked exceptions (rare, genuinely layout-specific):
  if (has(/review|testimon|parent said|5-star|five star|what parents/)) return "G"; // a real review → testimonial card
  // "The 1 setting" spotlight wins over the generic Bright Canary explainer — the
  // YHEADER reference is itself a Bright Canary post.
  if (has(/\bthe (1|one)\b|one setting|single setting|spotlight|inside bright/)) return "YHEADER"; // single-setting spotlight
  if (has(/bright canary|how .{0,24}(protects?|works|keeps)|membership|partner|trusted by|the app that/)) return "PHOTOSPLIT"; // partner / Bright Canary explainer
  if (has(/ vs\.?\b| versus |public.{0,12}private|private.{0,12}public|safe.{0,8}(vs|or).{0,8}risky|do this|not that|difference between/)) return "COMPARE"; // explicit compare / vs

  // Everything else: DEAL a distinct layout by position so the feed varies. Use
  // post_number when available (consecutive posts → consecutive, distinct
  // layouts); fall back to a concept hash so it's still deterministic without one.
  const n = Number.isFinite(postNumber) ? Number(postNumber) : hashStr(t);
  return CSC_VARIETY_ORDER[((n % CSC_VARIETY_ORDER.length) + CSC_VARIETY_ORDER.length) % CSC_VARIETY_ORDER.length];
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

  const archetype = pickArchetype(post.content_pillar, post.concept, post.post_number);
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
