import "server-only";
import type { StephanieArchetype, StephanieHeadlineLine } from "./render-stephanie";
import { loadBrandTemplate } from "./archetype-prompt";

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
  listItems?: { lead?: string | null; text: string }[] | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo: { include: boolean; description: string };
};

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null; post_number?: number | null };
export type StephanieSynthResult = { ok: true; spec: StephanieSpec } | { ok: false; error: string };

// ── AI FULL-DESIGN path ───────────────────────────────────────────────────────
// The model draws the ENTIRE post (photo + layout + text). Variety + polish come
// from the model; the brand kit is fully encoded so it stays on-brand. Every
// restriction from her kit is baked in so nothing gets dropped.
const WITH_PEOPLE_SCENE =
  "a warm, bright, photorealistic LIFESTYLE photo with REAL PEOPLE relevant to the topic — a happy couple or young family at home (a sunny porch, a kitchen, a living room, unpacking moving boxes, reviewing papers at a table). Natural daylight, aspirational but candid lifestyle stock; NEVER stiff corporate stock, never dark or moody. Generic everyday people, NOT a specific identifiable person";

function archetypeLayout(spec: StephanieSpec): string {
  switch (spec.archetype) {
    case "SIGNATURE": case "A": case "PHOTOBAND":
      return `A full-bleed lifestyle PHOTOGRAPH (${WITH_PEOPLE_SCENE}) fills the whole frame. A semi-transparent dusty STEEL-BLUE banner (#3D5A80, ~88% opacity) spans the width near the TOP holding the headline + body. A clean solid WHITE footer strip at the very bottom with the website centered.`;
    case "SIGBOTTOM": case "TOPBAND":
      return `A full-bleed lifestyle PHOTOGRAPH (${WITH_PEOPLE_SCENE}) fills the whole frame. A semi-transparent dusty STEEL-BLUE banner (#3D5A80, ~88% opacity) spans the width at the BOTTOM holding the headline + body, with the website on a small white line beneath.`;
    case "STATEMENT": case "D":
      return `A full-bleed lifestyle PHOTOGRAPH (${WITH_PEOPLE_SCENE}), softly DARKENED with a steel-blue overlay, fills the frame. The bold serif headline sits centered over it in white, large and editorial. A small white footer line at the bottom with the website.`;
    case "CHECKLIST": case "CHECK": case "C":
      return `A soft, lightly-lit home/desk PHOTOGRAPH (keys on a counter, mortgage papers, a bright kitchen) under a light white scrim fills the frame. A small deep-blue TAB at the top holds the eyebrow label; below it a bold serif headline; then 4 numbered cards, each a deep-blue number box beside a pale ice-blue bar with a bold title + a short subtitle; a deep-blue CTA button; a white footer with the website.`;
    case "ALTBARS":
      return `A soft lifestyle PHOTOGRAPH background. A bold serif headline at the top. Below it, 4 FULL-WIDTH bars alternating color (sky blue, white, deep steel-blue, white) and alternating the number side left/right; each bar shows a number + a short myth/title + a one-line truth. A white footer with the website.`;
    case "STEPS":
      return `A clean ICE-BLUE card (no photo). A serif headline at the top. Below, a vertical numbered PATH: 4 deep-blue round number chips down the left connected by a thin sky-blue line, each beside a bold step title + a short detail. A white footer with the website.`;
    case "VS":
      return `A TWO-COLUMN comparison. The headline across the top on white. Then two equal columns, EACH with its own lifestyle PHOTOGRAPH (${WITH_PEOPLE_SCENE}) behind a brand-color tint (left column deep steel-blue, right column lighter sky-blue), each with a label band naming the option and one short line describing it. A white footer with the website.`;
    case "BIGSTAT": case "NUMBER":
      return `A lifestyle PHOTOGRAPH (${WITH_PEOPLE_SCENE}) fills the TOP half. The bottom half is an ICE-BLUE panel with a small eyebrow label, a VERY LARGE serif numeral, and a short caption. A white footer with the website.`;
    case "G":
      return `An elegant testimonial card on a solid dusty STEEL-BLUE background (no photo). A flowing script header, the client quote in large white serif, and an attribution beneath. A white footer with the website.`;
    case "POLAROID":
      return `A warm CREAM background. A large flowing-script header at the top. A white-framed celebration PHOTOGRAPH (house keys on a counter, a "SOLD" sign in a green yard, a welcome mat — no people, no text) below it, with a short warm caption. A white footer with the website.`;
    default:
      return `A full-bleed lifestyle PHOTOGRAPH (${WITH_PEOPLE_SCENE}) with a steel-blue headline band and a white website footer.`;
  }
}

// JSON-CONTRACT generation (mirrors buildOmegaDesignPrompt): instead of a prose
// paragraph (which lets the model re-interpret "steel blue" and drift the brand
// color post-to-post), we hand the model the brand's STRICT JSON contract from
// brand-templates/stephanie.json — exact hexes, a forbidden-color list, hard
// rules, and a negative prompt — with this post's copy + layout filled in. The
// model follows the contract instead of guessing, so #3D5A80 stays locked across
// the whole feed. STRICT_COLOR_CONTRACT carries Stephanie's exact hexes + a
// FORBIDDEN list + an _ENFORCE_EXACT flag so the deep steel blue never drifts.
export function buildStephanieDesignPrompt(spec: StephanieSpec): string {
  const tpl = loadBrandTemplate("stephanie");
  const serif = spec.headlineLines.filter((l) => l.style !== "script").map((l) => l.text).join(" ");
  const script = spec.headlineLines.find((l) => l.style === "script")?.text || "";
  const list_items = (spec.listItems ?? []).map((it, i) => ({
    number: String(i + 1),
    lead: it.lead || null,
    text: it.text,
  }));

  const contract = {
    INSTRUCTION:
      "Create ONE Instagram post graphic, 4:5 portrait (1080x1350), for Stephanie Perez Home Loans — a warm, trustworthy female mortgage loan officer's PERSONAL brand. Soft, feminine, calming, editorial; NOT corporate, NOT fintech. This JSON is a STRICT brand contract — obey every field exactly. Do NOT improvise or vary the colors; use the STRICT_COLOR_CONTRACT hex values precisely. Render every word EXACTLY as written under CONTENT, crisp and correctly spelled, no invented words.",
    STRICT_COLOR_CONTRACT: {
      deep_steel_blue: "#3D5A80",
      light_sky_blue: "#98C1D9",
      ice_blue: "#E0FBFC",
      white: "#FFFFFF",
      near_black_text: "#000000",
      ...(tpl?.STRICT_COLOR_CONTRACT ?? {}),
      FORBIDDEN: [
        "NO tan, gold, or brown anywhere",
        "NO blue other than deep steel blue #3D5A80, light sky blue #98C1D9, ice blue #E0FBFC",
        "no navy #005181 (that's Omega), no gold (that's Omega), no red, no neon",
        ...((Array.isArray((tpl?.STRICT_COLOR_CONTRACT as { FORBIDDEN?: unknown })?.FORBIDDEN)
          ? ((tpl?.STRICT_COLOR_CONTRACT as { FORBIDDEN?: string[] }).FORBIDDEN as string[])
          : [])),
      ],
      _ENFORCE_EXACT:
        "Use these exact hex values for every fill, band, and text color. Do not approximate, tint, or substitute. The deep steel blue MUST be #3D5A80 on every post.",
    },
    TYPOGRAPHY: tpl?.TYPOGRAPHY ?? {
      display_serif: "Elegant high-contrast display serif (Playfair/Bodoni/Didot weight), mixed-case. Carries hero headlines.",
      body_serif: "Refined lighter-weight serif, sentence case, for body copy.",
      script: "Flowing personal script — the personal signature accent only (one short accent max).",
      sans: "Clean simple sans for small labels/footer.",
    },
    LAYOUT: { archetype: spec.archetype, description: archetypeLayout(spec) },
    CONTENT: {
      eyebrow: spec.eyebrow || null,
      headline_serif: serif || null,
      headline_script_accent: script || null,
      body: spec.body || null,
      list_items: list_items.length ? list_items : null,
      big_stat: spec.bigStat || null,
      quote: spec.quote || null,
      attribution: spec.attribution || null,
      cta: spec.cta || null,
      footer: "stephanieperezhomeloans.com — small, centered, on a clean white strip at the very bottom.",
    },
    GLOBAL_HARD_RULES: tpl?.GLOBAL_HARD_RULES ?? [
      "Photos are warm lifestyle scenes with REAL people relevant to homeownership (NEVER a specific identifiable person); celebration scenes (keys, SOLD signs) are people-free.",
      "NO logo, wordmark, monogram, brand mark, or company-name graphic.",
      "NO 'NMLS', 'DRE', license numbers, phone numbers, or compliance/legal fine print — those are overlaid after delivery.",
      "Render every word crisply and correctly spelled; no gibberish.",
      "Serif carries the voice; a flowing script is the personal signature accent only (one short accent max). No bold-sans headline dominance.",
      "First-person, warm, calm, values-forward voice.",
    ],
    GLOBAL_NEGATIVE_PROMPT:
      tpl?.GLOBAL_NEGATIVE_PROMPT ??
      "navy, gold, red, tan fill, brown, bright colors, neon, bold sans headline, logo, AHL, NMLS, DRE, license number, phone number, compliance footer, watermark, border, outer frame, rounded outer corners, misspelled or garbled text",
  };
  return "Follow this JSON brand contract EXACTLY when generating the image:\n\n" + JSON.stringify(contract, null, 2);
}

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

// VARIETY ORDER — the full reference-matched template set, interleaved so adjacent
// posts contrast (photo-hero / text / list / split / stat / celebration). Posts are
// DEALT across this list by position (post_number) so a month cycles through every
// layout instead of clustering on one. This is the fix for "all the designs look
// the same": variety is forced by distribution, not left to content keywords (which
// kept funneling everything onto SIGNATURE/SIGBOTTOM).
//   SIGNATURE  photo + band (top)       SIGBOTTOM  photo + band (bottom)
//   STATEMENT  bold hook over photo     CHECKLIST  numbered checklist over photo
//   ALTBARS    myth/mistake bars        STEPS      numbered process path (no photo)
//   VS         two-photo comparison     BIGSTAT    photo + big numeral
//   G          text testimonial         POLAROID   client celebration (script + framed)
// PHOTO layouts ONLY in the rotation (client rule: Instagram designs need
// photos). STEPS (no-photo path card) and G (text testimonial) are no longer
// dealt — G remains reachable via the testimonial lock, where a photo would
// mean fabricating a client's face.
const STEPHANIE_VARIETY_ORDER: StephanieArchetype[] = [
  "SIGNATURE", "CHECKLIST", "STATEMENT", "SIGBOTTOM", "VS", "ALTBARS", "BIGSTAT", "POLAROID",
];

// Only a few layouts are genuinely content-LOCKED (a closing celebration, an actual
// testimonial, a real comparison, a myth/mistake list, a step-by-step process).
// Everything else is spread by position so the feed varies.
export function pickArchetype(
  pillar: string | null,
  concept: string | null,
  postNumber?: number | null
): StephanieArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  // Content-locked exceptions (rare, genuinely layout-specific):
  if (has(/just closed|in contract|closing day|welcome home|keys to|client win|new homeowner|congrat/)) return "POLAROID";
  if (has(/testimonial|review|what (my )?clients say|client said|hear from|client (story|spotlight)|success story/)) return "G";
  // NOTE: no "vs" → VS lock. Stephanie's June had 3 comparison posts; locking them
  // all to VS clustered the feed onto the two-column layout. VS still appears via
  // the variety order below — comparisons just spread across other layouts too.
  if (has(/\b\d+\s+(myths|mistakes|things not|don'?ts)\b|myths? (exposed|busted)|things not to do|\bmistakes to avoid/)) return "ALTBARS";
  if (has(/the process|your path|step-by-step|step by step|road ?map|timeline|what happens (after|next)|from .* to the keys|how (it works|to buy)/)) return "CHECKLIST"; // step-by-step → numbered cards OVER A PHOTO (client: IG needs photos)

  // Everything else: DEAL a distinct layout by position so the feed varies. Use
  // post_number when available (consecutive posts → consecutive, distinct layouts);
  // fall back to a concept hash so it's still deterministic without a number.
  const n = Number.isFinite(postNumber) ? Number(postNumber) : hashStr(`${pillar ?? ""}|${concept ?? ""}`);
  return STEPHANIE_VARIETY_ORDER[((n % STEPHANIE_VARIETY_ORDER.length) + STEPHANIE_VARIETY_ORDER.length) % STEPHANIE_VARIETY_ORDER.length];
}

const PEOPLE_FREE = "a warm, inviting, photorealistic LIFESTYLE scene with ABSOLUTELY NO people/faces/hands — a cozy sunlit living room, a welcoming front porch, house keys on a counter, a quiet tree-lined neighborhood, a kitchen with morning light. Soft natural light, magazine quality. No text in the photo.";
// Stephanie's photos are warm lifestyle stock WITH people (per her kit), not empty rooms.
const WITH_PEOPLE = "a warm, bright, photorealistic LIFESTYLE photo with REAL PEOPLE relevant to the topic — e.g. a happy couple or a young family at home (a sunny front porch, a kitchen, a living room, unpacking moving boxes, reviewing papers at a table). Natural light, aspirational but candid lifestyle stock — NEVER stiff corporate stock, never dark or moody. No text, logos, or watermarks.";
const SOFT_BG = "a soft, lightly-lit, uncluttered home/desk BACKGROUND — house keys on a clean counter, mortgage papers and a pen, a bright airy kitchen or entryway. It sits under a white scrim so keep it simple and low-contrast. Natural light. No people needed. No text, logos, or watermarks.";

function dataInstruction(a: StephanieArchetype): string {
  switch (a) {
    case "SIGNATURE":
      return `SIGNATURE HERO (full-bleed photo + headline band + footer). headline_lines = ONE warm serif headline that states the idea plainly (a hook or promise, e.g. "You don't need 20% down."). body = REQUIRED — 2-3 dense first-person sentences that deliver the actual value/explanation (this fills the band, so never leave it short). photo.include = true; "photo.description" = ${WITH_PEOPLE}`;
    case "CHECKLIST":
      return `NUMBERED CHECKLIST over a soft photo. eyebrow = a SHORT all-caps tab label (e.g. "INSIDER TIP", "BUYER CHECKLIST", "BEFORE YOU BUY"). headline_lines = ONE serif headline naming the list. Fill "list_items" with EXACTLY 4 objects { "lead":"<a 2-4 word bold title>", "text":"<one short subtitle line>" }. cta = a short imperative (e.g. "DM CHECK to start", "Save this list"). photo.include = true; "photo.description" = ${SOFT_BG}`;
    case "SIGBOTTOM":
      return `SIGNATURE HERO (photo + headline band at the BOTTOM) — use for PERSONAL / trust / "why I do this" posts. headline_lines = ONE warm first-person serif line (e.g. "This is why I do what I do."). body = REQUIRED 2-3 first-person sentences (her story / values / why clients can trust her). photo.include = true; "photo.description" = ${WITH_PEOPLE}`;
    case "STATEMENT":
      return `BOLD STATEMENT over a darkened full-bleed photo. eyebrow = a short all-caps label (e.g. "A GENTLE REMINDER"). headline_lines = ONE short, punchy, uplifting serif line (<=8 words; e.g. "Your dream home is closer than you think.") + AT MOST one short script accent. body = optional ONE short sentence. cta = a soft 2-3 word invite. photo.include = true; "photo.description" = ${WITH_PEOPLE}`;
    case "ALTBARS":
      return `NUMBERED MYTH/MISTAKE LIST over a soft photo (full-width alternating bars). headline_lines = ONE serif headline (e.g. "4 Credit Score Myths Exposed"). Fill "list_items" with EXACTLY 4 objects { "lead":"<the myth/mistake, 3-5 words>", "text":"<the one-line truth/correction>" }. photo.include = true; "photo.description" = ${SOFT_BG}`;
    case "STEPS":
      return `NUMBERED PROCESS / PATH (no photo — clean ice-blue card with a timeline). headline_lines = ONE serif headline (e.g. "Your Path to the Keys"). Fill "list_items" with EXACTLY 4 objects in ORDER { "lead":"<the step, 2-4 words>", "text":"<one short line>" }. photo.include = false.`;
    case "VS":
      return `TWO-PHOTO COMPARISON (a lifestyle photo behind each column). headline_lines = ONE serif headline naming the two things (e.g. "Pre-Qualification vs. Pre-Approval"). eyebrow = a short label (e.g. "KNOW THE DIFFERENCE"). Fill "list_items" with EXACTLY 2 objects { "lead":"<option name>", "text":"<one short sentence describing it>" } — left = the lesser/first option, right = the stronger one. photo.include = true; "photo.description" = ${WITH_PEOPLE}`;
    case "BIGSTAT":
      return `BIG STAT (photo on top + a large numeral below). eyebrow = a short label (e.g. "MORTGAGE MYTH BUSTED"). big_stat = the single key figure (<=5 chars, e.g. "3.5%", "3%", "0%"). headline_lines = ONE short serif line framing the number (e.g. "could be your down payment"). body = ONE short clause of context. photo.include = true; "photo.description" = ${WITH_PEOPLE}`;
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

  const archetype = pickArchetype(post.content_pillar, post.concept, post.post_number);
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
    ? (parsed.list_items as { lead?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 5)
        .map((it) => ({ lead: typeof it.lead === "string" && it.lead.trim() ? clean(it.lead) : null, text: clean(it.text) }))
        .filter((it) => it.text.length > 0)
    : null;

  const bodyText = clean(parsed.body);
  const usesList = (a: StephanieArchetype) => a === "C" || a === "SPLIT" || a === "CHECK" || a === "EDITORIAL" || a === "SPLITBLOCK" || a === "CHECKLIST" || a === "ALTBARS" || a === "STEPS" || a === "VS";
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
    bigStat: finalArch === "NUMBER" || finalArch === "BIGSTAT" ? clean(parsed.big_stat) || null : null,
    quote: isQuote ? quoteText || null : null,
    attribution: isQuote ? clean(parsed.attribution) || null : null,
    photo: {
      include: (finalArch === "A" || finalArch === "PHOTOBAND" || finalArch === "TOPBAND" || finalArch === "SPLIT" || finalArch === "POLAROID") && photoObj.include !== false,
      description: clean(photoObj.description),
    },
  };
  return { ok: true, spec };
}
