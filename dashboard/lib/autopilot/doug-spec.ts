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

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null; post_number?: number | null };
export type DougSynthResult = { ok: true; spec: DougSpec } | { ok: false; error: string };

// ============================================================================
// AI FULL-DESIGN PROMPT (the model draws the ENTIRE post). Doug's whole kit
// (quiet teal + cream-mint, NO accent color, NO emoji, corporate no-people
// photos, McKinsey-partner restraint, LANDSCAPE LinkedIn) is encoded. The
// SCALE LLP wordmark/logo is NEVER drawn; a plain-text byline IS rendered.
// Replaces the Satori render-doug path.
// ============================================================================
const DOUG_CORP =
  "a quiet, restrained corporate/architectural scene — glass towers, a city skyline at dusk, an empty modern boardroom table, clean office architecture. ABSOLUTELY NO people, faces, or hands. Muted and professional, sitting under a deep teal scrim. No text or logos in the photo";

function dougArchetypeLayout(spec: DougSpec): string {
  switch (spec.archetype) {
    case "PHOTO":
    case "PANEL":
    case "SPLIT":
      return `A LANDSCAPE cover: a ${DOUG_CORP} under a deep teal (#1F5560) scrim. The advisory headline sits large in cream-mint (#D8EBE5)/white over the lower-left, with one sharp subtitle line beneath. Calm, premium, lots of negative space.`;
    case "WARSTORY":
      return `A LANDSCAPE dark cover: a ${DOUG_CORP} under a heavy near-black teal scrim. ONE short, specific hook line sits large in cream-mint, understated and serious.`;
    case "TITLE":
      return `A text-only LANDSCAPE title card on a solid deep TEAL (#1F5560) field. The advisory headline is large in cream-mint/white, with one sharp subtitle line beneath. Generous margins, quiet authority — no photo, no decoration.`;
    case "LIST":
      return `A LANDSCAPE list card (teal or cream-mint field). A headline promise on top, then 3-4 advisory points each as a clean row with a small marker and one operator-language line. Restrained, no icons-as-clutter.`;
    case "FRAMEWORK":
      return `A LANDSCAPE framework card. The framework's name as the headline, then EXACTLY 3 parts in a clean horizontal row, each with a one-word part name and one short sentence. Teal + cream-mint, structured and quiet.`;
    case "STAT":
      return `A LANDSCAPE big-number card on a solid deep TEAL field. ONE large figure in cream-mint dominates; a short supporting headline and one sentence of context beneath. Minimal.`;
    case "CONTRAST":
      return `A LANDSCAPE belief-vs-reality card. A smaller muted "the belief" line on top, then the sharper "reality" headline large beneath it, divided by a thin rule. Teal + cream-mint, no accent color.`;
    case "MINT":
      return `A LANDSCAPE light insight card on a CREAM-MINT (#D8EBE5) field. ONE quiet, quotable advisory principle in teal as the headline, with one supporting line beneath. Calm and spacious.`;
    default:
      return `A text-only LANDSCAPE title card on a deep TEAL field with a cream-mint advisory headline and one sharp subtitle line.`;
  }
}

// JSON-CONTRACT generation (mirrors buildOmegaDesignPrompt): instead of a prose
// paragraph (which lets the model re-interpret "teal" and drift the brand color
// post-to-post — Doug's specific failure mode was almost every card collapsing to
// the same solid-teal text look), we hand the model a STRICT JSON contract: exact
// hexes, a FORBIDDEN-color list, hard rules, and a negative prompt — with this
// post's copy + layout filled in. The model follows the contract instead of
// guessing, so #1F5560 / #D8EBE5 are locked across the whole feed.
export function buildDougDesignPrompt(spec: DougSpec): string {
  const list_points = (spec.listItems ?? []).map((it) => ({
    lead: it.lead || null,
    text: it.text,
  }));

  const contract = {
    INSTRUCTION:
      "Create ONE LinkedIn post graphic, 16:9 LANDSCAPE (1920x1080), for Doug Mitchell, Esq., a Partner at Scale LLP who writes on M&A for founders. This JSON is a STRICT brand contract — obey every field exactly. Do NOT improvise or vary the colors; use the STRICT_COLOR_CONTRACT hex values precisely. Render every word EXACTLY as written under CONTENT, crisp and correctly spelled, no invented words. Tone test: a McKinsey partner's LinkedIn — restrained, authoritative, spacious, serious, never a hustle bro.",
    STRICT_COLOR_CONTRACT: {
      deep_teal: "#1F5560",
      cream_mint: "#D8EBE5",
      white: "#FFFFFF",
      muted_gray: "#8A9A9C",
      usage:
        "Deep teal #1F5560 is dominant (fields, scrims, headlines on light cards). Cream-mint #D8EBE5 and white carry headlines/figures on teal. Muted gray is for secondary/eyebrow text ONLY.",
      FORBIDDEN:
        "NO accent color of any kind. NO bright or saturated colors. NO emoji. NO blue or green other than this exact teal. NO multi-hue gradients, NO neon, NO gold. Teal + cream-mint + white + muted gray are the ONLY colors permitted.",
      _ENFORCE_EXACT: true,
    },
    TYPOGRAPHY: {
      family:
        "A clean, professional, high-legibility sans or a restrained serif. Authority through whitespace and hierarchy, not ornament.",
      forbidden: "NO script, NO emoji, NO decorative or display type, NO outlined/3D text.",
    },
    LAYOUT: { archetype: spec.archetype, description: dougArchetypeLayout(spec) },
    CONTENT: {
      eyebrow: spec.eyebrow || null,
      headline: spec.headline || null,
      subtitle: spec.subtitle || null,
      listItems: list_points.length ? list_points : null,
      bigStat: spec.bigStat || null,
      quote: spec.quote || null,
      byline: "Doug Mitchell, Esq. · Scale LLP",
    },
    GLOBAL_HARD_RULES: [
      "Do NOT draw the SCALE LLP wordmark, logo, or any firm mark — only the plain-text byline 'Doug Mitchell, Esq. · Scale LLP' is allowed.",
      "NO emoji.",
      "NO hustle language ('game-changer', '10x', 'level up', 'disrupt') anywhere in the image.",
      "Quiet McKinsey-partner restraint: calm, uncluttered, generous negative space, authority through hierarchy not decoration.",
      "Any photography is a corporate NO-PEOPLE scene (glass towers, skyline at dusk, empty boardroom, office architecture) under a deep teal scrim — ABSOLUTELY no people, faces, or hands.",
      "Spell every word perfectly; no gibberish, no invented words, no watermarks, no UI chrome.",
    ],
    GLOBAL_NEGATIVE_PROMPT:
      "SCALE LLP wordmark, logo, firm mark, emoji, hustle language, stock-photo people, faces, hands, accent colors, bright colors, neon, gold, multi-hue gradients, script type, decorative type, misspellings, gibberish text, watermarks, UI chrome, clutter",
  };
  return "Follow this JSON brand contract EXACTLY when generating the image:\n\n" + JSON.stringify(contract, null, 2);
}

function hashStr(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

// VARIETY ORDER — the FULL Doug template set, interleaved so adjacent posts
// contrast: photo covers and text cards alternate (the fix for Doug's "almost
// every card is a solid-teal text block" sameness). Posts are DEALT across this
// list by position (post_number) so a month cycles through every layout instead
// of clustering on TITLE/STAT/CONTRAST. Variety is forced by distribution, not
// left to content keywords.
const DOUG_VARIETY_ORDER: DougArchetype[] = [
  "PHOTO", "TITLE", "SPLIT", "LIST", "PANEL", "STAT", "WARSTORY", "FRAMEWORK", "MINT", "CONTRAST",
];

// Only a few layouts are genuinely content-LOCKED (a war story, a belief-vs
// contrast, a hard $/N-deals stat, an explicit framework). Everything else is
// spread by position so the feed varies.
export function pickArchetype(
  pillar: string | null,
  concept: string | null,
  postNumber?: number | null
): DougArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  // Content-locked exceptions (rare, genuinely layout-specific):
  if (has(/war story|i advised|anonymi|the deal that|almost died|client i|mistake i see|11 ?pm|night before close/)) return "WARSTORY";
  if (has(/ vs\.?\b| versus |most (people|founders|owners) (think|believe)|why .* (is wrong|gets it wrong)|the myth|contrarian|everyone says/)) return "CONTRAST";
  if (has(/framework|the \d+-part|\d+ pillars|how to think about|a frame not|mental model/)) return "FRAMEWORK";
  if (has(/\$\s?\d|\b\d+\s+deals|\b\d+\+? years|\b\d+%|by the numbers|in \d+ deals/)) return "STAT";

  // Everything else: DEAL a distinct layout by position so the feed varies. Use
  // post_number when available (consecutive posts → consecutive, distinct
  // layouts); fall back to a concept hash so it's still deterministic.
  const n = Number.isFinite(postNumber) ? Number(postNumber) : hashStr(concept ?? t);
  return DOUG_VARIETY_ORDER[((n % DOUG_VARIETY_ORDER.length) + DOUG_VARIETY_ORDER.length) % DOUG_VARIETY_ORDER.length];
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

  const archetype = pickArchetype(post.content_pillar, post.concept, post.post_number);
  const instruction = [
    `You write LinkedIn thought-leadership title-card copy for Doug Mitchell, Esq., a Partner at Scale LLP writing on M&A. Audience: founders/CEOs 12-36 months from an exit, plus M&A peers. Voice: expert but plain-spoken (no Latin, define any legalese on first use), advisory framing (give a frame, not a to-do list), specific over general (anonymized real examples with numbers), QUIET authority (no bravado, no hustle, nothing political).`,
    `Visual brand: quiet teal + cream-mint title card, NO accent color, NO emoji. Tone test: a McKinsey partner's LinkedIn, never a hustle bro's.`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype)}`,
    ``,
    `HEADLINE STRUCTURE — VARY IT. Doug's feed has been repeating "The Power of X" and "The Hidden Cost of Y" over and over; that is a defect. Rotate across DIFFERENT structures and do NOT reuse the same opening formula twice in a row: a direct question ("What is your earnout really worth?"), a single sharp declarative claim ("Reps and warranties are where deals quietly die"), a "Before you sign…" caution, an "X is not Y" reframe ("A letter of intent is not a contract"), a number-led insight ("Three diligence questions that change the price"), or a quiet contrarian statement ("The highest bid is rarely the best deal"). The "The Hidden Cost of…" / "The Power of…" / "[X] vs [Y]" / "Why [belief] is Wrong" molds are still ALLOWED but must be the exception, not the default — never lead two posts the same way. Keep the quiet advisory voice throughout; vary the shape, not the tone.`,
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
