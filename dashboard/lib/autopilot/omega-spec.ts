import "server-only";
import type { OmegaArchetype, OmegaHeadlineLine } from "./render-omega";

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

// Route each post to the layout that FITS ITS CONTENT — this is what gives the
// feed real variety (the v8 design language), instead of forcing everything into
// one photo-top mold. Mirrors the brand's archetype taxonomy:
//   COLLAGE  4-photo grid + centered card   (market updates / seasonal)
//   B        full-bleed warm photo          (Father's Day / big emotional moment)
//   E        photo + statement              (testimonials / client wins / gratitude)
//   A        photo + numbered list          (step-by-step educational w/ a photo)
//   C        numbered list / comparison      (lists, "X vs Y", no photo)
//   D        big-number hero / closure card  (stats; or a dignified holiday card)
export function pickArchetype(concept: string | null, pillar: string | null): OmegaArchetype {
  const c = (concept ?? "").toLowerCase();
  const p = (pillar ?? "").toLowerCase();
  const has = (re: RegExp) => re.test(c);

  // 1. Holiday closure / observance → dignified statement card (no numeral).
  if (has(/juneteenth|closed today|in observance|observance|memorial day|holiday/) || p.includes("juneteenth")) return "D";
  // 2. Father's Day / dad → full-bleed warm photo (magazine cover).
  if (has(/father|\bdad\b|\bdads\b/) || p.includes("father")) return "B";
  // 3. Market update → photo-collage hero (the v8_08 silhouette).
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
  // 9. Default educational → numbered listicle.
  return "C";
}

function dataInstruction(a: OmegaArchetype, isClosure: boolean): string {
  switch (a) {
    case "COLLAGE":
      return `PHOTO-COLLAGE market update (4 photos behind a centered card). Fill headline_lines (serif + one short script accent, e.g. "Market Update" / "where rates stand") and write "body" as 2-3 SHORT standalone lines SEPARATED BY NEWLINES — each a punchy sentence about where rates / inventory / sellers stand. Soft CTA. No list. Four photos are added automatically — leave photo.description empty.`;
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
  const isClosure =
    /juneteenth|closed today|in observance|observance|memorial day|holiday/i.test(post.concept ?? "") ||
    (post.content_pillar ?? "").toLowerCase().includes("juneteenth");
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
    `Return ONLY JSON: { "eyebrow":"", "headline_lines":[{"text":"","style":"serif"}], "body":"", "cta":"", "list_items":[{"number":"1","lead":"","text":""}], "big_stat":"", "quote":"", "attribution":"", "photo":{"include":false,"description":""} }`,
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

  const spec: OmegaSpec = {
    archetype,
    eyebrow: clean(parsed.eyebrow).toUpperCase().slice(0, 32) || "OMEGA",
    headlineLines: lines,
    body: archetype === "COLLAGE" ? cleanMultiline(parsed.body) : clean(parsed.body),
    cta: isClosure ? "" : clean(parsed.cta) || "Let's talk",
    listItems: archetype === "A" || archetype === "C" ? listItems : null,
    bigStat: archetype === "D" && !isClosure ? clean(parsed.big_stat) || null : null,
    quote: archetype === "G" ? clean(parsed.quote) || null : null,
    attribution: archetype === "G" ? clean(parsed.attribution) || null : null,
    photo: { include: archetype === "A" || archetype === "B" || archetype === "E" || archetype === "COLLAGE", description: clean(photoObj.description) },
  };
  return { ok: true, spec };
}
