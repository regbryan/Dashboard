import "server-only";
import type { RiversideArchetype } from "./render-riverside";
import { loadBrandTemplate } from "./archetype-prompt";

// Synthesizes a Riverside Hat Co design spec from a calendar post. Product-
// FORWARD (hats in context, never people): the product-hero (A) is the default;
// process/care card (C), drop/event card (D), and customer feature (G) round it
// out. Warm crafted SLAB serif + condensed rust labels. Confidently casual,
// Western-not-costume, craft-forward voice. NEVER bakes the EST. 2021 logo.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type RiversideSpec = {
  archetype: RiversideArchetype;
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
  listItems?: { text: string }[] | null;
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
export type RiversideSynthResult = { ok: true; spec: RiversideSpec } | { ok: false; error: string };

// ============================================================================
// AI FULL-DESIGN PROMPT (the model draws the ENTIRE post). Riverside's whole kit
// (earthy tan/saddle/rust/cream, crafted slab serif + condensed rust label,
// HATS-in-context photos with NO people, modern-Western-not-costume voice, no
// EST.2021 logo baked) is encoded. Replaces the Satori render-riverside path.
// ============================================================================
const RIVERSIDE_HAT =
  "a richly-lit, photorealistic Western HAT in context — a black felt cowboy hat or a woven straw hat resting on a dark wood credenza, tooled leather, or coiled rope, warm directional side-light, shallow depth of field, moody and crafted. Modern Western, never costume or rhinestone kitsch. ABSOLUTELY NO people, faces, or hands; never a floating product on a white background. No text or logos in the photo";

function riversideArchetypeLayout(spec: RiversideSpec): string {
  switch (spec.archetype) {
    case "C":
      return `A warm CREAM (#F2E6D5) card (no photo). A tall condensed rust (#C9572C) eyebrow label, a crafted slab-serif headline, then 3-4 craft-forward steps in a clean list (each naming what's done). Earthy, tactile, editorial.`;
    case "D":
      return `A confident announcement card. A rich earthy background (saddle brown #3A2E1F or a moody hat-shop scene) with a crafted slab-serif headline, a condensed rust label, and one short detail line (days, booking). Bold but understated.`;
    case "G":
      return `A warm CREAM customer-feature card (no photo, NO fabricated face). A condensed rust label, the customer's quote in crafted slab serif, and a first-name + city attribution beneath.`;
    default:
      return `A full-bleed ${RIVERSIDE_HAT} fills the frame. A crafted slab-serif headline and a tall condensed rust (#C9572C) label sit over a moody lower scrim, with a short detail line and a direct CTA.`;
  }
}

// JSON-CONTRACT generation: instead of a prose paragraph (which lets the model
// re-interpret the palette and drift the brand colors post-to-post), we hand the
// model the brand's STRICT JSON contract from brand-templates/riverside.json —
// exact hexes, a forbidden-color list, hard rules, and a negative prompt — with
// this post's copy + layout filled in. The model follows the contract instead of
// guessing, so the warm earthy palette is locked across the whole feed. Mirrors
// buildOmegaDesignPrompt.
export function buildRiversideDesignPrompt(spec: RiversideSpec): string {
  const tpl = loadBrandTemplate("riverside");
  const baseColors = (tpl?.STRICT_COLOR_CONTRACT ?? {}) as Record<string, unknown>;
  const list_items = (spec.listItems ?? []).map((it) => ({ text: it.text }));

  const contract = {
    INSTRUCTION:
      "Create ONE Instagram post graphic, 4:5 portrait (1080x1350), for Riverside Hat Co — a small-batch custom Western hat shop. This JSON is a STRICT brand contract — obey every field exactly. Do NOT improvise or vary the colors; use the STRICT_COLOR_CONTRACT hex values precisely. Tactile, editorial, lived-in (Yellowstone / Stagecoach mood), NEVER costume-cowboy, rhinestone, or \"yeehaw\" kitsch. Render every word EXACTLY as written under CONTENT, crisp and correctly spelled, no invented words.",
    STRICT_COLOR_CONTRACT: {
      tan: "#B89A6D",
      brown: "#3A2E1F",
      rust: "#C9572C",
      cream: "#F2E6D5",
      ...baseColors,
      FORBIDDEN:
        (baseColors.FORBIDDEN as unknown) ??
        ["bright blue", "neon", "pastels", "jewel tones", "rhinestone / costume-cowboy color", "any cool/clinical color", "navy", "pure-white blocks"],
      _ENFORCE_EXACT:
        "Use these hexes precisely: warm tan #B89A6D, dark saddle brown #3A2E1F, rust #C9572C (THE accent — labels/CTAs), cream #F2E6D5. No bright/neon colors, no pure-white blocks, no blue. Do NOT drift the palette.",
    },
    TYPOGRAPHY: tpl?.TYPOGRAPHY ?? {
      display: "Warm crafted SLAB SERIF for headlines (mixed-case, sturdy, lived-in).",
      label: "Tall CONDENSED sans, ALL-CAPS, letter-spaced, in rust — the western-poster eyebrow / category label.",
      body: "Clean readable sans for detail lines. Confident, understated.",
    },
    LAYOUT: { archetype: spec.archetype, description: riversideArchetypeLayout(spec) },
    CONTENT: {
      eyebrow: spec.eyebrow || null,
      headline: spec.headline || null,
      body: spec.body || null,
      list_items: list_items.length ? list_items : null,
      quote: spec.quote || null,
      attribution: spec.attribution || null,
      cta: spec.cta || null,
      logo_zone: "NONE — leave a calm corner; the EST. 2021 oval logo / phone are overlaid after delivery.",
    },
    GLOBAL_HARD_RULES: tpl?.GLOBAL_HARD_RULES ?? [
      "HATS-in-context photos only — NO people, faces, or hands; never a floating product on a white background.",
      "DO NOT bake the EST. 2021 logo, brand mark, monogram, or phone number into the image — added separately.",
      "Warm crafted SLAB serif headline + tall condensed rust label.",
      "Warm earthy palette only — tan + dark saddle brown + rust + cream. NO blue, NO neon, NO pastels.",
      "Confidently casual, craft-forward voice. Avoid yeehaw / howdy / partner / costume-cowboy kitsch.",
    ],
    GLOBAL_NEGATIVE_PROMPT:
      tpl?.GLOBAL_NEGATIVE_PROMPT ??
      "people, faces, person, hands, model, floating product on white, studio seamless white, blue, neon, pastel, jewel tones, rhinestone, costume cowboy, yeehaw, howdy, EST. 2021 logo, brand mark, monogram, phone number, watermark, border, outer frame, misspelled or garbled text",
  };
  return "Follow this JSON brand contract EXACTLY when generating the image:\n\n" + JSON.stringify(contract, null, 2);
}

// VARIETY ORDER — Riverside's four archetypes, interleaved so adjacent posts
// contrast (product photo / care card / drop card / customer feature). Posts are
// DEALT across this list by position (post_number) so a run cycles A->C->D->G->A
// instead of clustering on A or D. This is the fix for "the designs all look the
// same": variety is forced by distribution, not left to content keywords.
const RIVERSIDE_VARIETY_ORDER: RiversideArchetype[] = ["A", "C", "D", "G"];

function hashStr(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

// Only content-LOCKED rules remain (a genuine customer feature, an actual how-to,
// a real event/drop). Everything else is spread by position so the feed varies.
function pickArchetype(
  pillar: string | null,
  concept: string | null,
  postNumber?: number | null
): RiversideArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();

  // Content-locked exceptions — kept DELIBERATELY NARROW. (A previous broad
  // "event|sale|drop|promo|gift|..." rule caught nearly all Riverside content —
  // which is mostly "new arrivals / drops" — and clustered the whole feed onto the
  // D text card. A new-arrival/drop is best shown as the hat PHOTO, so it now
  // falls through to the position-dealt spread (mostly A) instead of a text card.)
  if (/\bcustomer\b|\breview\b|testimon|came in|\bwore\b/.test(t)) return "G"; // genuine customer feature
  if (/process|how to|care|clean|shape|re-?crease|re-?band|\bsteps\b|maintain|how a hat/.test(t)) return "C"; // genuine how-to
  if (/hat bar|trailer|pop-?up|brought the bar|book a chair/.test(t)) return "D"; // a real in-person EVENT only

  // Everything else: DEAL a distinct layout by position so the feed varies. Use
  // post_number when available (consecutive posts → consecutive, distinct
  // layouts); fall back to a concept hash so it's still deterministic without one.
  const n = Number.isFinite(postNumber) ? Number(postNumber) : hashStr(t);
  return RIVERSIDE_VARIETY_ORDER[((n % RIVERSIDE_VARIETY_ORDER.length) + RIVERSIDE_VARIETY_ORDER.length) % RIVERSIDE_VARIETY_ORDER.length];
}

function dataInstruction(a: RiversideArchetype): string {
  switch (a) {
    case "C":
      return `PROCESS / CARE CARD. Fill "list_items" with 3-4 craft-forward steps { "text":"<name what's done — 're-crease the crown', 'swap the band'>" }. headline = the card title. photo.include = false.`;
    case "D":
      return `DROP / EVENT CARD. headline = a confident announcement (e.g. "Summer straws just landed", "We brought the bar to you"). Add a short "body" with the detail (days, booking). photo.include = false.`;
    case "G":
      return `CUSTOMER FEATURE (text only, NO fabricated face). Fill "quote" (a warm 1-2 sentence customer line, real-person voice) and "attribution" (a first name + city, e.g. "Jess, Riverside"). photo.include = false.`;
    default:
      return `PRODUCT HERO (the default). photo.include = true; "photo.description" = a richly-lit photorealistic HAT in context — a black felt cowboy or woven straw hat on a dark wood credenza, tooled leather, or rope, warm side-light, shallow depth of field. ABSOLUTELY NO people, faces, or hands. Never floating-product-on-white. No text in the photo.`;
  }
}

export async function synthesizeRiversideSpec(post: SpecPost): Promise<RiversideSynthResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const archetype = pickArchetype(post.content_pillar, post.concept, post.post_number);
  const instruction = [
    `You write copy for Riverside Hat Co's Instagram (@riversidehatco) — a small-batch custom Western hat shop in Riverside, CA (EST. 2021), known for custom hat shaping and the Hat Bar Trailer. Voice: confidently casual, Western-but-NOT-costume (modern, lived-in, Yellowstone/Stagecoach — NEVER 'yeehaw / howdy / partner' or rhinestone kitsch), craft-forward (name what's done — 're-creased the crown', 'swapped the band'), locally proud (Riverside / the IE).`,
    `Visual brand: warm crafted SLAB serif headline + tall condensed rust label. Earthy palette (tan, saddle brown, rust, cream).`,
    ``,
    `POST: concept="${post.concept ?? ""}", pillar="${post.content_pillar ?? ""}", type="${post.post_type ?? ""}"`,
    `ARCHETYPE (fixed): ${archetype}. ${dataInstruction(archetype)}`,
    ``,
    `RULES:`,
    `- headline: ONE short, confident, mixed-case headline. Craft-forward or anticipation-building, never costume-cowboy. No markdown/asterisks.`,
    `- body: ONE short detail sentence (materials, days, what was done). Use periods/commas, NOT em dashes.`,
    `- cta: a short, direct 2-5 word CTA — e.g. "Book a chair", "Come touch them in person", "DM to book". No FOMO manipulation.`,
    `- eyebrow: a short ALL-CAPS label (e.g. "NEW ARRIVALS", "THE CUSTOM PROCESS", "HAT BAR TRAILER", "CUSTOMER FEATURE").`,
    `- NEVER include the EST. 2021 logo, the phone number, or any brand mark — those are added separately.`,
    `- Avoid: "yeehaw", "howdy", "partner", "vibes", "statement piece", "authentic", "crafted with care", em dashes.`,
    ``,
    `Return ONLY JSON: { "eyebrow":"", "headline":"", "body":"", "cta":"", "list_items":[{"text":""}], "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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
  if (!headline && archetype !== "G") return { ok: false, error: "riverside: no headline" };

  const photoObj = (parsed.photo ?? {}) as { include?: unknown; description?: unknown };
  const listItems = Array.isArray(parsed.list_items)
    ? (parsed.list_items as { text?: unknown }[])
        .filter((it) => it && typeof it.text === "string")
        .slice(0, 4)
        .map((it) => ({ text: clean(it.text) }))
        .filter((it) => it.text.length > 0)
    : null;

  const spec: RiversideSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 28) || "RIVERSIDE HAT CO",
    headline,
    body: clean(parsed.body),
    cta: clean(parsed.cta) || "Book a chair",
    listItems: archetype === "C" ? listItems : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: archetype === "A" && photoObj.include !== false, description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
