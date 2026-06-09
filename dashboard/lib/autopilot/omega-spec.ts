import "server-only";
import type { OmegaArchetype, OmegaHeadlineLine } from "./render-omega";
import { loadBrandTemplate } from "./archetype-prompt";

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
  quadItems?: { heading: string; text: string }[] | null;
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

// ============================================================================
// AI FULL-DESIGN PROMPT (the model draws the ENTIRE post — photo + layout +
// text). Mirrors stephanie-spec's buildStephanieDesignPrompt: variety + polish
// come from the model; Omega's whole kit is baked in so nothing gets dropped.
// Replaces the deterministic Satori render-omega path.
// ============================================================================
const OMEGA_PEOPLE =
  "a warm, bright, photorealistic LIFESTYLE photograph with REAL, DIVERSE people relevant to homeownership — a happy first-time-buyer couple or a young multigenerational family at home (a sunny porch, a kitchen, a living room, unpacking moving boxes, holding house keys, reviewing papers at a table). Natural daylight, aspirational but candid editorial lifestyle stock; NEVER stiff corporate stock, never fintech illustration, never dark or moody. Generic everyday people, NOT a specific identifiable person";

function omegaArchetypeLayout(spec: OmegaSpec): string {
  switch (spec.archetype) {
    case "A":
      return `A warm lifestyle PHOTOGRAPH (${OMEGA_PEOPLE}) fills the TOP ~55% of the frame. Below it, on a near-white panel: a small solid NAVY pill holding the eyebrow label, then the editorial serif headline (one word in flowing script accent), then a NUMBERED LIST — each row a thin HOLLOW navy ring with a navy numeral inside (never a filled circle), a short bold lead, and a one-line detail.`;
    case "B":
      return `A full-bleed warm lifestyle PHOTOGRAPH (${OMEGA_PEOPLE}) fills the ENTIRE frame, magazine-cover style. A soft navy gradient scrim across the BOTTOM holds the serif+script headline in white and one short body line beneath it.`;
    case "BHEADER":
      return `A full-bleed warm lifestyle PHOTOGRAPH (${OMEGA_PEOPLE}) fills the frame. A solid NAVY header bar across the TOP holds the serif+script headline in white; a short body line sits just beneath the bar over a subtle scrim.`;
    case "C":
      return `NO photo. A clean near-white editorial card. A small solid NAVY pill holds the eyebrow; below it a large serif headline with one italic/script accent word; then a NUMBERED LIST (3-5 rows, or EXACTLY 2 for a comparison) — each row a thin HOLLOW navy ring with a navy numeral inside (never filled), a bold lead, and a one-line detail. Generous navy-on-cream editorial spacing.`;
    case "D":
      return spec.bigStat
        ? `NO photo. A solid NAVY field. ONE giant editorial serif numeral/stat in white or warm cream dominates the upper-center; a short serif topic line and a 1-2 sentence body sit beneath it. Calm, premium, lots of negative space.`
        : `NO photo. A dignified, restrained card (solid navy or warm cream). A respectful serif headline centered with a short sincere 1-2 sentence message. No CTA, no numerals — quiet and tasteful (an office-closed / observance card).`;
    case "E":
      return `A warm lifestyle PHOTOGRAPH (${OMEGA_PEOPLE}) fills roughly the LEFT or TOP portion. The remaining area is a navy or cream panel carrying a serif+script headline and a warm 2-3 sentence statement (or, for a testimonial, the client's quote in large serif with an attribution beneath — gold 5 stars allowed here ONLY).`;
    case "F":
      return `A PHOTO-LEFT / PANEL-RIGHT split. The left ~half is a warm lifestyle PHOTOGRAPH (${OMEGA_PEOPLE}); the right ~half is a warm CREAM panel with an eyebrow, a serif+script headline, a heartfelt 1-2 sentence body, and a soft CTA.`;
    case "G":
      return `NO photo. An elegant testimonial card on solid NAVY. A flowing script header, a row of GOLD 5-star marks (gold is allowed ONLY here), the client quote in large white serif, and an attribution beneath.`;
    case "QUAD":
      return `NO photo. A four-quadrant CARD GRID on cream/navy. A serif headline names the topic across the top; below, EXACTLY 4 equal cards, each with a short bold heading and one supporting phrase. Clean editorial grid, hollow-ring or simple icon accents (no filled number circles).`;
    case "COLLAGE":
      return `A 2x2 GRID of four warm homeownership lifestyle PHOTOGRAPHS (${OMEGA_PEOPLE}) behind a centered near-white card. The card holds a serif+script headline and 2-3 short standalone lines about where the market/rates/inventory stand. Editorial magazine collage.`;
    case "COLLAGE6":
      return `A SIX-photo magazine COLLAGE of warm homeownership lifestyle PHOTOGRAPHS (${OMEGA_PEOPLE}) arranged in a clean grid, with a horizontal NAVY band across the middle holding a serif+script headline and a warm 1-2 sentence summary.`;
    default:
      return `A warm lifestyle PHOTOGRAPH (${OMEGA_PEOPLE}) with a navy serif+script headline treatment. Editorial, premium, magazine quality.`;
  }
}

// JSON-CONTRACT generation: instead of a prose paragraph (which lets the model
// re-interpret "navy" and drift the brand color post-to-post), we hand the model
// the brand's STRICT JSON contract from brand-templates/omega.json — exact hexes,
// a forbidden-color list, hard rules, and a negative prompt — with this post's
// copy + layout filled in. The model follows the contract instead of guessing, so
// #005181 is locked across the whole feed. (This is the "JSON gives full control"
// approach the brand was built on.)
export function buildOmegaDesignPrompt(spec: OmegaSpec): string {
  const tpl = loadBrandTemplate("omega");
  const serif = spec.headlineLines.filter((l) => l.style !== "script").map((l) => l.text).join(" ");
  const script = spec.headlineLines.find((l) => l.style === "script")?.text || "";
  const numbered_list = (spec.listItems ?? []).map((it, i) => ({
    hollow_navy_ring_numeral: String(it.number || i + 1),
    lead: it.lead || null,
    text: it.text,
  }));
  const four_cards = (spec.quadItems ?? []).map((q) => ({ heading: q.heading, text: q.text }));

  const contract = {
    INSTRUCTION:
      "Create ONE Instagram post graphic, 4:5 portrait (1080x1350), for Omega Mortgage Group. This JSON is a STRICT brand contract — obey every field exactly. Do NOT improvise or vary the colors; use the STRICT_COLOR_CONTRACT hex values precisely. Render every word EXACTLY as written under CONTENT, crisp and correctly spelled, no invented words.",
    STRICT_COLOR_CONTRACT: tpl?.STRICT_COLOR_CONTRACT ?? {},
    TYPOGRAPHY: tpl?.TYPOGRAPHY ?? {},
    LAYOUT: { archetype: spec.archetype, description: omegaArchetypeLayout(spec) },
    CONTENT: {
      eyebrow_pill: spec.eyebrow || null,
      headline_serif: serif || null,
      headline_script_accent: script || null,
      body: spec.body || null,
      numbered_list: numbered_list.length ? numbered_list : null,
      four_cards: four_cards.length ? four_cards : null,
      big_stat: spec.bigStat || null,
      quote: spec.quote || null,
      attribution: spec.attribution || null,
      cta: spec.cta || null,
      footer: "NONE — leave the bottom ~12% a calm, empty quiet zone (no text, no logo); compliance is overlaid after delivery.",
    },
    GLOBAL_HARD_RULES: tpl?.GLOBAL_HARD_RULES ?? [],
    GLOBAL_NEGATIVE_PROMPT: tpl?.GLOBAL_NEGATIVE_PROMPT ?? "",
  };
  return "Follow this JSON brand contract EXACTLY when generating the image:\n\n" + JSON.stringify(contract, null, 2);
}

// Route each post to the layout that FITS ITS CONTENT — this is what gives the
// feed real variety (the v8 design language), instead of forcing everything into
// one photo-top mold. Mirrors the brand's archetype taxonomy:
//   COLLAGE  4-photo grid + centered card   (market updates / seasonal)
//   B        full-bleed warm photo          (Father's Day / big emotional moment)
//   E        photo + statement              (testimonials / client wins / gratitude)
//   A        photo + numbered list          (step-by-step educational w/ a photo)
//   C        numbered list / comparison      (lists, "X vs Y", no photo)
//   D        big-number hero / closure card  (stats; or a dignified holiday card)
function hashStr(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

// Generic educational concepts would all collapse onto the "C" listicle — spread
// them across a varied mix (listicle, photo+list, photo+statement, grid) so the
// feed never repeats a layout. Holiday/recap-specific layouts stay rule-gated.
const OMEGA_DEFAULT_ROTATION: OmegaArchetype[] = ["C", "A", "E", "QUAD"];

export function pickArchetype(concept: string | null, pillar: string | null): OmegaArchetype {
  const c = (concept ?? "").toLowerCase();
  const p = (pillar ?? "").toLowerCase();
  const has = (re: RegExp) => re.test(c);

  // 1. Holiday CLOSURE → dignified statement card (no numeral). Must be an actual
  //    office-closed notice — a celebratory holiday post (e.g. "Juneteenth & the
  //    Dream of Homeownership", Client Stories) is NOT a closure and should get a
  //    warm photo instead.
  if (has(/closed today|closed for|office (is |will be )?closed|in observance of|closed in observance/)) return "D";
  // 2. "What X covers / includes" multi-part explainer → quadrant card-grid.
  if (has(/what .{0,30}\b(cover|covers|include|includes)\b|what'?s included|\bbreakdown\b|four (things|parts|components)|components of/)) return "QUAD";
  // 3. Myth-bust / punchy single claim that benefits from a home photo → full-bleed
  //    with a top header bar ("You Don't Need 20% Down").
  if (has(/you don'?t need|don'?t need \d+%|\d+% (rule|myth)|is a myth|debunk/)) return "BHEADER";
  // 4. Father's Day / dad → full-bleed warm photo (magazine cover).
  if (has(/father|\bdad\b|\bdads\b/) || p.includes("father")) return "B";
  // 5. Mother's Day / mom → photo-left + cream panel split (the "For the Moms" look).
  if (has(/mother'?s day|\bmoms?\b|mothers/) || p.includes("mother")) return "F";
  // 6. Market recap / mid-year / round-up → 6-photo magazine collage.
  if (has(/recap|mid-?year|year in review|round-?up|by the numbers|highlights|state of the market/)) return "COLLAGE6";
  // 7. Market update → photo-collage hero (the v8_08 silhouette).
  if (p.includes("market") || has(/market update/)) return "COLLAGE";
  // 4. Testimonial / client story / referral / gratitude → photo + statement.
  if (p.includes("testimonial") || p.includes("client") || p.includes("refer") ||
      has(/client win|testimonial|thank you|families|grateful|refer|who do you know/)) return "E";
  // 5. Refi math / break-even → a big-number moment.
  if ((p.includes("refinance") || has(/\brefi\b/)) && has(/math|break-?even|number|formula/)) return "D";
  // 6. Big-number stat → 0% down, percentages, dollar amounts, day counts.
  if (p.includes("down payment") || has(/\b\d+%|\$\d|\bzero down\b|\b0% down\b|\b\d{2,}\b.*\b(day|families|clients|points|pts)\b|credit boost/)) return "D";
  // 7. Comparison / "vs" / either-or → numbered comparison list.
  if (has(/ vs\.?\b| versus |≠|pre-?qual|qualification|lock.*float|float.*lock|\bfha\b|conventional|is it still/)) return "C";
  // 8. Step-by-step / checklist (often with a photo) → photo + numbered list.
  if (has(/before you tour|things to do|\bsteps\b|checklist|before you/)) return "A";
  // 9. Default educational → spread across a varied mix (was always "C").
  return OMEGA_DEFAULT_ROTATION[hashStr(`${c}|${p}`) % OMEGA_DEFAULT_ROTATION.length];
}

function dataInstruction(a: OmegaArchetype, isClosure: boolean): string {
  switch (a) {
    case "COLLAGE":
      return `PHOTO-COLLAGE market update (4 photos behind a centered card). Fill headline_lines (serif + one short script accent, e.g. "Market Update" / "where rates stand") and write "body" as 2-3 SHORT standalone lines SEPARATED BY NEWLINES — each a punchy sentence about where rates / inventory / sellers stand. Soft CTA. No list. Four photos are added automatically — leave photo.description empty.`;
    case "COLLAGE6":
      return `SIX-PHOTO MAGAZINE COLLAGE with a center band. Fill headline_lines (serif + one short script accent) naming the topic, and write "body" as ONE warm 1-2 sentence summary. No list. Six photos are added automatically — leave photo.description empty.`;
    case "QUAD":
      return `QUADRANT CARD-GRID. Fill "quad_items" with EXACTLY 4 objects { "heading":"<a 2-4 word category>", "text":"<one short supporting phrase>" }. headline_lines name the topic (e.g. serif "What Closing Costs Cover"). eyebrow short. Soft CTA. No photo, no list, no big_stat.`;
    case "BHEADER":
      return `FULL-BLEED PHOTO + TOP HEADER. The photo fills the frame; a navy header bar at the top holds the headline, with a short body just beneath. Write a punchy script+serif headline (e.g. serif "You Don't Need" + script "20% Down") and ONE 1-2 sentence body that busts the myth or lands the claim. No list, no stat. A photo is added automatically — leave photo.description empty.`;
    case "F":
      return `PHOTO + PANEL STATEMENT (photo left, text panel right). Write an eyebrow, a warm script+serif headline, a heartfelt 1-2 sentence body, and a soft CTA. No list. A photo is added automatically — leave photo.description empty.`;
    case "A":
      return `PHOTO + NUMBERED LIST. Fill "list_items" with 3-4 objects { "number":"1", "lead":"<a short bold takeaway, max 5 words>", "text":"<one supporting sentence>" }. A photo is added automatically — leave photo.description empty.`;
    case "C":
      return `NUMBERED LIST / COMPARISON — NO photo. Fill "list_items" with objects { "number":"1", "lead":"<a short bold phrase>", "text":"<one supporting sentence>" }: use 3-5 items for a list, or EXACTLY 2 items for a comparison ("X vs Y"). The headline names the topic.`;
    case "B":
      return `FULL-BLEED PHOTO + HEADLINE. The photo fills the entire frame; the headline and a short body sit over a navy scrim at the bottom. No list, no stat. Write a punchy script+serif headline and ONE warm 1-2 sentence body line that lands the message. Keep it tight — this is a magazine cover, not a paragraph. A photo is added automatically — leave photo.description empty.`;
    case "E":
      return `PHOTO + STATEMENT. No list. Write the script+serif headline and a warm 2-3 sentence body paragraph (personal, heartfelt, like talking to a friend; for a testimonial, the body IS the client's warm quote). A photo is added automatically — leave photo.description empty.`;
    case "D":
      if (isClosure)
        return `DIGNIFIED CLOSURE CARD. Leave "big_stat" EMPTY. Write a respectful serif headline (e.g. "Honoring Juneteenth") and a short, sincere 1-2 sentence body (e.g. that the office is closed today in observance). No list, no photo, and NO commercial CTA — set "cta" to "".`;
      return `BIG-NUMBER hero. Fill "big_stat" with ONE short number/stat (e.g. "0%", "47", "+40 pts"). Write the headline and a 1-2 sentence body. No list, no photo.`;
    case "G":
      return `TESTIMONIAL. Fill "quote" and "attribution". No photo.`;
    default:
      return ``;
  }
}

export async function synthesizeOmegaSpec(post: SpecPost): Promise<OmegaSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.concept, post.content_pillar);
  const isClosure = /closed today|closed for|office (is |will be )?closed|in observance of|closed in observance/i.test(post.concept ?? "");
  const instruction = [
    `You write copy for Omega Mortgage Group's Instagram. Voice: a warm, patient senior loan officer guiding a first-time homebuyer — educational, reassuring, partnering. Never pushy, never hard-sell, never "APPLY NOW".`,
    `Editorial/premium feel. The headline is an elegant SERIF display with ONE flowing SCRIPT accent line (a short connecting phrase) — e.g. serif "Your Dream Home" + script "is closer than you think".`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype, isClosure)}`,
    ``,
    `RULES:`,
    `- headline_lines: 2-3 lines, each { "text", "style": "serif" | "script" }. Exactly ONE short "script" accent line; the rest "serif". Mixed-case (NOT all caps). No markdown/asterisks.`,
    `- body: a short reassuring line — or a warm 2-3 sentence paragraph for a statement (E) post — in the brand voice.`,
    `- cta: a soft 2-3 word CTA — e.g. "Let's talk", "See if you qualify", "Ask us how". NEVER "Apply now" / "Limited time".`,
    `- eyebrow: a short ALL-CAPS category label (e.g. "FIRST-TIME BUYERS", "WAYS TO SAVE", "WHY REFINANCE?").`,
    `- NEVER include the logo, the words OMEGA/MORTGAGE/GROUP, NMLS, license numbers, or any compliance text — those are added separately.`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline_lines":[{"text":"","style":"serif"}], "body":"", "cta":"", "list_items":[{"number":"1","lead":"","text":""}], "quad_items":[{"heading":"","text":""}], "big_stat":"", "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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

  // The collage body is a few short stacked lines — preserve the line breaks
  // (the normal clean() collapses runs of whitespace, which would merge them).
  const cleanMultiline = (v: unknown): string =>
    typeof v === "string"
      ? v.replace(/[*_`]+/g, "").split(/\n+/).map((s) => s.replace(/\s{2,}/g, " ").trim()).filter(Boolean).slice(0, 3).join("\n")
      : "";

  const quadItems = Array.isArray(parsed.quad_items)
    ? (parsed.quad_items as { heading?: unknown; text?: unknown }[])
        .filter((it) => it && typeof it.heading === "string" && typeof it.text === "string")
        .slice(0, 4)
        .map((it) => ({ heading: clean(it.heading), text: clean(it.text) }))
    : null;

  const needsSinglePhoto = archetype === "A" || archetype === "B" || archetype === "E" || archetype === "F" || archetype === "BHEADER";

  const spec: OmegaSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 32) || "OMEGA",
    headlineLines: lines,
    body: archetype === "COLLAGE" ? cleanMultiline(parsed.body) : clean(parsed.body),
    cta: isClosure ? "" : clean(parsed.cta) || "Let's talk",
    listItems: archetype === "A" || archetype === "C" ? listItems : null,
    quadItems: archetype === "QUAD" ? quadItems : null,
    bigStat: archetype === "D" && !isClosure ? clean(parsed.big_stat) || null : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: needsSinglePhoto || archetype === "COLLAGE" || archetype === "COLLAGE6", description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
