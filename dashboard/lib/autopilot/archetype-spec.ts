import "server-only";
import type { BrandTemplate, ArchetypeSpec } from "./archetype-prompt";

// Turns a calendar post (concept + pillar + type) into a structured ArchetypeSpec:
// picks the right archetype from the brand's catalog and writes the on-image copy
// (eyebrow, headline with italic-serif emphasis, body, trust, CTA, photo brief) in
// the brand voice. Uses the same Gemini text-model + JSON-mode pattern as
// authorSlots() in generate-calendar.ts. The phone in the CTA is forced in code.

const TEXT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// The IEC social-tracking phone is the only number allowed on an image. We set
// it deterministically rather than trusting the LLM to remember the rule.
const IMAGE_PHONE = "951.789.3238";

type SpecPost = {
  concept: string | null;
  content_pillar: string | null;
  post_type: string | null;
};

export type SynthSpecResult =
  | { ok: true; spec: ArchetypeSpec }
  | { ok: false; error: string };

// Archetypes we render deterministically (code) — the selector only picks these.
const SUPPORTED = new Set(["A", "C", "D", "E", "F", "G", "H"]);

function archetypeCatalog(template: BrandTemplate): string {
  const a = template.ARCHETYPES ?? {};
  return Object.entries(a)
    .filter(([key]) => SUPPORTED.has(key.split("_")[0].toUpperCase()))
    .map(([key, v]) => `  ${key}: ${v.description ?? ""}${v.when_to_use ? ` (use for: ${v.when_to_use})` : ""}`)
    .join("\n");
}

/**
 * Resolve the model's archetype choice to a real template key. Template keys are
 * full names like "A_color_block_photo_split"; the model may return the full key
 * OR just the leading code ("A", "J2"). Returns the canonical key or null.
 */
function resolveArchetypeKey(template: BrandTemplate, chosen: string): string | null {
  const keys = Object.keys(template.ARCHETYPES ?? {});
  const c = chosen.trim().toUpperCase();
  if (!c) return null;
  // Exact (case-insensitive) match.
  let hit = keys.find((k) => k.toUpperCase() === c);
  if (hit) return hit;
  // Leading code match: "A" -> "A_color_block_photo_split", "J2" -> "J2_myth_busted_cutout".
  hit = keys.find((k) => k.split("_")[0].toUpperCase() === c);
  return hit ?? null;
}

export async function synthesizeArchetypeSpec(
  template: BrandTemplate,
  post: SpecPost
): Promise<SynthSpecResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };

  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  const url = `${TEXT_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const brand = template.BRAND ?? {};
  const voice = (brand.voice as string) ?? "warm, straight-talking, no hype";
  const trustMarks = Array.isArray(brand.trust_marks)
    ? (brand.trust_marks as string[]).join("; ")
    : "";

  const instruction = [
    `You are a senior brand designer for ${brand.name ?? "the brand"}. Voice: ${voice}.`,
    `Turn the calendar post below into ONE structured design spec for a single social graphic.`,
    ``,
    `POST:`,
    `- concept: ${post.concept ?? ""}`,
    `- content pillar: ${post.content_pillar ?? ""}`,
    `- post type: ${post.post_type ?? ""}`,
    ``,
    `Choose the single best ARCHETYPE (return just its letter, e.g. "A") from this catalog:`,
    archetypeCatalog(template),
    ``,
    `PICK FOR VARIETY — match the archetype to the content so a month of posts looks different, not all the same:`,
    `- Customer reviews / social proof / trust → D (testimonial card).`,
    `- Tips, checklists, warning signs, "X things" → E (numbered list, 3 items).`,
    `- Efficiency / temperature / money stats → G (big-number stat card).`,
    `- A financing offer, percentage, or "X years" milestone → F (big red number hero).`,
    `- Founder story, family-owned, values, "since 2009" → H (brand story, huge year).`,
    `- Seasonal promos / educational scenes that benefit from a real photo → A or C.`,
    `Prefer a text-only archetype (D/E/F/G/H) when the message stands on its own — they are cleaner and add variety.`,
    ``,
    `RULES:`,
    `- The headline mixes BOLD SANS lines with exactly 1-2 ITALIC-SERIF emphasis words/phrase (a short emotional or temporal phrase). 2-3 short lines.`,
    `- Body copy: 1-3 short sentences in the brand voice. No hype, no pressure.`,
    `- CTA text is overridden in code with the phone; just return "CALL ${IMAGE_PHONE}".`,
    `- Trust element (optional): pick from — ${trustMarks || "a 5-star review line"}.`,
    `- PER-ARCHETYPE DATA (fill ONLY the one for your chosen archetype):`,
    `   • D → "quote" (the customer's words, 1-2 sentences) and "attribution" (e.g. "The Patel Family, Riverside").`,
    `   • E → "list_items": exactly 3 objects { "number": "1|2|3", "text": "<short item>" }.`,
    `   • F, G, or H → "big_stat": the single hero number/stat/year (e.g. "78°F", "$99", "2009", "15+"). Keep it SHORT (<=5 chars).`,
    `- Photo: ONLY A and C use a photo (include=true). All of D/E/F/G/H set photo.include=false. If include=true, describe a photorealistic scene. PEOPLE allowed (a homeowner, a single technician working) but NEVER a posed team/crew lineup.`,
    `- If the photo shows an IEC technician: a single technician in a SOLID NAVY short-sleeve polo + dark navy work pants, shown FROM BEHIND or side profile, kneeling and actively working on a furnace or AC condenser — back to camera, face not visible, NO hat, NO logo/text on clothing.`,
    ``,
    `Return ONLY a JSON object with this exact shape (include only the per-archetype field you filled):`,
    `{`,
    `  "archetype": "<letter from the catalog>",`,
    `  "eyebrow": { "color": "red" | "navy" | "light-blue", "text": "<ALL CAPS short label>" },`,
    `  "headline_lines": [ { "text": "<line>", "style": "sans" | "italic-serif" } ],`,
    `  "body_copy": "<1-3 sentences>",`,
    `  "photo": { "include": true | false, "description": "<scene, or empty>" },`,
    `  "trust_element": "<short trust line or null>",`,
    `  "quote": "<D only>", "attribution": "<D only>",`,
    `  "list_items": [ { "number": "1", "text": "..." } ],`,
    `  "big_stat": "<F/G/H only>",`,
    `  "cta": { "text": "CALL ${IMAGE_PHONE}" }`,
    `}`,
  ].join("\n");

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch (err) {
    return { ok: false, error: `gemini fetch: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `gemini ${res.status}: ${t.slice(0, 400)}` };
  }

  type Part = { text?: string };
  type Candidate = { content?: { parts?: Part[] } };
  let body: { candidates?: Candidate[] };
  try {
    body = (await res.json()) as { candidates?: Candidate[] };
  } catch {
    return { ok: false, error: "gemini returned non-JSON envelope" };
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, error: "no text in gemini response" };

  let parsed: Partial<ArchetypeSpec>;
  try {
    parsed = JSON.parse(text) as Partial<ArchetypeSpec>;
  } catch {
    return { ok: false, error: "gemini spec was not valid JSON" };
  }

  // Validate + normalize, forcing the phone rule deterministically.
  const archetype = resolveArchetypeKey(
    template,
    typeof parsed.archetype === "string" ? parsed.archetype : ""
  );
  if (!archetype) {
    return { ok: false, error: `gemini chose an unknown archetype: ${String(parsed.archetype)}` };
  }
  const lines = Array.isArray(parsed.headline_lines)
    ? parsed.headline_lines
        .filter((l): l is { text: string; style: "sans" | "italic-serif" } =>
          !!l && typeof l.text === "string"
        )
        .map((l) => ({
          text: l.text,
          style: (l.style === "italic-serif" ? "italic-serif" : "sans") as "sans" | "italic-serif",
        }))
    : [];
  if (lines.length === 0) return { ok: false, error: "gemini returned no headline lines" };

  const letter = archetype.split("_")[0].toUpperCase();
  const usesPhoto = letter === "A" || letter === "C";

  const listItems = Array.isArray(parsed.list_items)
    ? parsed.list_items
        .filter((it): it is { number?: string | null; text: string } => !!it && typeof it.text === "string")
        .slice(0, 3)
        .map((it, i) => ({
          number: typeof it.number === "string" && it.number.trim() ? it.number.trim() : String(i + 1),
          text: it.text,
        }))
    : null;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const spec: ArchetypeSpec = {
    archetype,
    eyebrow: {
      color:
        parsed.eyebrow?.color === "navy" || parsed.eyebrow?.color === "light-blue"
          ? parsed.eyebrow.color
          : "red",
      text: (parsed.eyebrow?.text ?? "").toString().toUpperCase().slice(0, 32) || "IEC",
    },
    headline_lines: lines,
    body_copy: typeof parsed.body_copy === "string" ? parsed.body_copy : "",
    photo: {
      include: usesPhoto && parsed.photo?.include !== false,
      description: typeof parsed.photo?.description === "string" ? parsed.photo.description : "",
    },
    trust_element: str(parsed.trust_element),
    // Per-archetype extras (only the relevant one is used by the renderer).
    quote: letter === "D" ? str(parsed.quote) : null,
    attribution: letter === "D" ? str(parsed.attribution) : null,
    list_items: letter === "E" ? listItems : null,
    big_stat: letter === "F" || letter === "G" || letter === "H" ? str(parsed.big_stat) : null,
    // Phone forced in code — never trust the model with the number.
    cta: { text: `CALL ${IMAGE_PHONE}` },
  };

  return { ok: true, spec };
}
