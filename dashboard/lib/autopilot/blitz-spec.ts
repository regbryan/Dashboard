import "server-only";
import type { BlitzArchetype, BlitzHeadlineLine } from "./render-blitz";
import { loadBrandTemplate } from "./archetype-prompt";

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

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null; post_number?: number | null };
export type BlitzSynthResult = { ok: true; spec: BlitzSpec } | { ok: false; error: string };

// ============================================================================
// AI FULL-DESIGN PROMPT (the model draws the ENTIRE post). Blitz's whole kit
// (dusty rose + sage + beige, casual script hook + light sans, organized-SPACES
// photos with NO people, warm-encourager voice, no logo baked) is encoded so
// nothing gets dropped. Replaces the Satori render-blitz path.
// ============================================================================
const BLITZ_SPACE =
  "a bright, airy, photorealistic ORGANIZED SPACE — a pantry, closet, drawer, linen shelf, or cabinets with clear bins, labeled jars, matching baskets, everything in its place. Warm natural light, soft pastel/neutral tones, lots of breathing room, magazine quality. ABSOLUTELY NO people, hands, or faces. No text or logos in the photo";

function blitzArchetypeLayout(spec: BlitzSpec): string {
  switch (spec.archetype) {
    case "A":
      return `A full-bleed ${BLITZ_SPACE} fills the frame. A soft, airy panel or gentle scrim carries a casual handwritten SCRIPT hook plus a short light-sans line, with a soft CTA. Lots of breathing room.`;
    case "C":
      return `A soft cream/dusty-rose card (no photo). A casual handwritten SCRIPT hook at the top, then 3-5 NUMBERED ROWS/soft bars, each with a small rounded number chip, a short bold lead, and one doable line. Airy spacing, sage + rose accents.`;
    case "QUAD":
      return `A soft cream card (no photo). A script hook header, then a 2x2 GRID of EXACTLY 4 gentle rounded cards (rose/sage/beige), each with a short heading (a zone/area) and one doable phrase.`;
    case "CHECK":
      return `A soft cream/beige checklist card (no photo). A script hook header, then 4-5 rows each with a soft sage or rose CHECKMARK and one short reset step in light sans.`;
    case "COMPARE":
      return `A soft two-column KEEP / TOSS card (no photo). A script "Keep or Toss?" hook on top; left column "Keep" (sage) with 3 short phrases each with a check; right column "Toss" (dusty rose) with 3 short phrases each with a soft x. Gentle, never shaming.`;
    case "STAT":
      return `A soft cream card (no photo). ONE large dusty-rose or sage NUMBER as the focal point, a script line naming the trick, and one short light-sans explanation beneath.`;
    case "PHOTOPANEL":
      return `A split card: a ${BLITZ_SPACE} fills one side; the other side is a soft cream/beige panel with a short light-sans QUESTION and a warm 1-2 sentence practical answer.`;
    case "STATEMENT":
      return `A soft, airy cream/rose field (no photo). A warm handwritten SCRIPT line plus a short light-sans line, centered with generous space, and one reassuring sentence. Gentle and encouraging, never shaming.`;
    case "D":
      return `A soft cream/beige card (no photo). ONE casual handwritten SCRIPT question or warm hook dominates, with a short reassuring light-sans line beneath. Empathetic and calming.`;
    case "G":
      return `A soft cream testimonial card (no photo). A small script header, the client's warm quote in light sans, and an attribution beneath. Relief and calm in tone.`;
    default:
      return `A full-bleed ${BLITZ_SPACE} with a casual script hook and a soft light-sans line. Airy, warm, encouraging.`;
  }
}

// JSON-CONTRACT generation (mirrors buildOmegaDesignPrompt): instead of a prose
// paragraph (which lets the model re-interpret "dusty rose" and drift the palette
// post-to-post), we hand the model a STRICT JSON contract — exact hexes, a
// forbidden-color list, hard rules, and a negative prompt — with this post's copy
// + layout filled in. The model follows the contract instead of guessing, so the
// exact Blitz palette (#ECB7B9 / #9CAF9C / #DAD6CF) is locked across the feed.
// STRICT_COLOR_CONTRACT is built inline from the prose version's exact hexes so it
// holds even without the bundled blitz.json template.
export function buildBlitzDesignPrompt(spec: BlitzSpec): string {
  const tpl = loadBrandTemplate("blitz");
  const script = spec.headlineLines.find((l) => l.style === "script")?.text || "";
  const sans = spec.headlineLines.filter((l) => l.style !== "script").map((l) => l.text).join(" ");
  const numbered_list = (spec.listItems ?? []).map((it, i) => ({
    soft_number_chip: it.number || String(i + 1).padStart(2, "0"),
    lead: it.lead || null,
    text: it.text,
  }));
  const four_cards = (spec.quadItems ?? []).map((q) => ({ heading: q.heading, text: q.text }));
  const keep_toss = spec.compare
    ? {
        keep_label: spec.compare.keepLabel || "Keep",
        keep: spec.compare.keep ?? [],
        toss_label: spec.compare.tossLabel || "Toss",
        toss: spec.compare.toss ?? [],
      }
    : null;

  // Exact Blitz palette from the prose version (also matches brand-templates/blitz.json).
  const STRICT_COLOR_CONTRACT = tpl?.STRICT_COLOR_CONTRACT ?? {
    rose: "#ECB7B9",
    sage: "#9CAF9C",
    beige: "#DAD6CF",
    cream: "#FBF8F4",
    white: "#FFFFFF",
    charcoal: "#595959",
    color_roles: {
      "#ECB7B9": "Dusty rose — the signature Blitz accent. Pills, banners, soft CTA buttons, list markers, quote backgrounds. Always present somewhere.",
      "#9CAF9C": "Soft sage green — organic secondary. Alternate markers, dividers, soft panels that pair with the rose.",
      "#DAD6CF": "Warm beige — soft neutral background panel, card fill, photo overlay band.",
      "#FBF8F4": "Warm cream / off-white — primary airy background for text cards (softer than pure white).",
      "#FFFFFF": "White — clean background, breathing room.",
      "#595959": "Soft warm charcoal — all headline + body text. Never pure black.",
    },
    FORBIDDEN: [
      "no bright or saturated colors",
      "no black blocks (text is soft warm charcoal, never pure black)",
      "no blue",
      "no neon",
    ],
    _ENFORCE_EXACT: "Use these hex values precisely. Do NOT improvise, shift, or saturate the palette — soft, muted, pastel only.",
  };

  const contract = {
    INSTRUCTION:
      "Create ONE Instagram post graphic, 4:5 portrait (1080x1350), for Blitz Organization — a professional home-organizing service. This JSON is a STRICT brand contract — obey every field exactly. Do NOT improvise or vary the colors; use the STRICT_COLOR_CONTRACT hex values precisely. Render every word EXACTLY as written under CONTENT, crisp and correctly spelled, no invented words. Soft, airy, warm, calming — like a Pinterest home-organization aesthetic; never corporate, busy, cluttered, or harsh.",
    STRICT_COLOR_CONTRACT,
    TYPOGRAPHY: tpl?.TYPOGRAPHY ?? {
      script: "CASUAL handwritten script (a friendly handwritten note, NOT formal calligraphy) — carries the emotional hook line ONLY.",
      sans: "LIGHT, clean, airy sans for everything else (subheads, body, list, CTA). No heavy bold blocks, no serif, no all-caps shouting.",
      rule: "Casual script for the emotion; light sans for the info. Exactly ONE short script hook per design.",
    },
    LAYOUT: { archetype: spec.archetype, description: blitzArchetypeLayout(spec) },
    CONTENT: {
      eyebrow_label: spec.eyebrow || null,
      headline_script_hook: script || null,
      headline_sans_line: sans || null,
      body: spec.body || null,
      numbered_list: numbered_list.length ? numbered_list : null,
      four_cards: four_cards.length ? four_cards : null,
      keep_toss,
      big_stat: spec.bigStat || null,
      quote: spec.quote || null,
      attribution: spec.attribution || null,
      cta: spec.cta || null,
    },
    GLOBAL_HARD_RULES: tpl?.GLOBAL_HARD_RULES ?? [
      "No people in photos — organized SPACES only (pantry, closet, drawer, shelves with clear bins, labeled jars, matching baskets). Absolutely no people, hands, or faces.",
      "Typography: a CASUAL handwritten script hook (the emotional line) paired with a LIGHT clean sans for everything else. No serif, no heavy bold all-caps dominance.",
      "Voice: warm, encouraging, calm — never shaming. NEVER the words 'messy', 'dirty', 'disaster', 'hoarder'. Soft CTAs only (never 'BOOK NOW').",
      "Soft and airy: generous white space, layouts breathe, text is never crammed.",
      "Palette is dusty rose + sage + warm beige + cream/white + soft charcoal. No bright/saturated colors, no black blocks, no blue.",
      "Do NOT bake the logo or wordmark into the image — it is composited on top afterward. Keep a calm, uncluttered corner with breathing room for it.",
      "Render every word crisply and correctly spelled.",
    ],
    GLOBAL_NEGATIVE_PROMPT:
      tpl?.GLOBAL_NEGATIVE_PROMPT ??
      "people, faces, person, hands, fake named staff, bright colors, saturated colors, neon, blue, navy, red, black blocks, bold all-caps headline, formal calligraphy, serif font, dark moody background, cluttered busy layout, text cramming, shaming language, logo, wordmark, watermark, border, outer frame, misspelled or garbled text",
  };
  return "Follow this JSON brand contract EXACTLY when generating the image:\n\n" + JSON.stringify(contract, null, 2);
}

// Content router across Blitz's 10 layouts.
//   C         the signature numbered BARS (5 things / steps)
//   QUAD      a 2x2 grid (zones / areas)        CHECK  a reset checklist
//   COMPARE   keep / toss                        STAT   a big-number trick (3-bin rule)
//   PHOTOPANEL organized photo + question panel   STATEMENT soft encouragement
//   D         empathetic question card           G  testimonial    A  photo-hero
function hashStr(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

// VARIETY ORDER — the FULL Blitz template set, interleaved so adjacent posts
// contrast (photo / list / grid / checklist / statement / testimonial). Posts are
// DEALT across this list by position (post_number) so a month cycles through every
// layout instead of clustering on one. Mirrors OMEGA_VARIETY_ORDER: variety is
// forced by distribution, not left to content keywords (which kept funneling onto
// C / D / STATEMENT).
const BLITZ_VARIETY_ORDER: BlitzArchetype[] = [
  "A", "C", "QUAD", "CHECK", "COMPARE", "STAT", "PHOTOPANEL", "STATEMENT", "D", "G",
];

// Only a few layouts are genuinely content-LOCKED (a real testimonial, an actual
// keep/toss, a named number-rule trick). Everything else is spread by position.
export function pickArchetype(
  pillar: string | null,
  concept: string | null,
  postNumber?: number | null
): BlitzArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  // Content-locked exceptions (rare, genuinely layout-specific):
  if (has(/review|testimon|client (love|story|joy|win)|loved|social proof|spotlight/)) return "G"; // testimonial / client
  if (has(/keep or toss|keep vs|what to keep|what to toss|toss or keep|this or that/)) return "COMPARE"; // keep-or-toss / this-or-that
  if (has(/\b\d+[- ]?bin\b|\d+-?bin rule|the \d+ rule|our favorite trick|golden rule/)) return "STAT"; // n-bin / golden-rule trick

  // Everything else: DEAL a distinct layout by position so the feed varies. Use
  // post_number when available (consecutive posts → consecutive, distinct layouts);
  // fall back to a concept hash so it's still deterministic without a number.
  const n = Number.isFinite(postNumber) ? Number(postNumber) : hashStr(`${pillar ?? ""}|${concept ?? ""}`);
  return BLITZ_VARIETY_ORDER[((n % BLITZ_VARIETY_ORDER.length) + BLITZ_VARIETY_ORDER.length) % BLITZ_VARIETY_ORDER.length];
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

  const archetype = pickArchetype(post.content_pillar, post.concept, post.post_number);
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
