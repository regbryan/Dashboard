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

function archetypeCatalog(template: BrandTemplate): string {
  const a = template.ARCHETYPES ?? {};
  return Object.entries(a)
    .map(([key, v]) => `  ${key}: ${v.description ?? ""}${v.when_to_use ? ` (use for: ${v.when_to_use})` : ""}`)
    .join("\n");
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
    `Choose the single best ARCHETYPE (return just its letter/key) from this catalog:`,
    archetypeCatalog(template),
    ``,
    `RULES:`,
    `- The headline mixes BOLD SANS lines with exactly 1-2 ITALIC-SERIF emphasis words/phrase (a short emotional or temporal phrase). Split it into 2-3 short lines.`,
    `- Body copy: 1-3 short sentences in the brand voice. No hype, no pressure.`,
    `- CTA text will be set in code — return a short cta.text but it WILL be overridden with the phone; just suggest "CALL <phone>" or the website ${brand.website ?? ""}.`,
    `- Trust element (optional): pick from — ${trustMarks || "a 5-star review line"}.`,
    `- Photo: set include=false for text-only/listicle/review/stat archetypes. If include=true, describe a photorealistic scene. PEOPLE are allowed (a homeowner, a single technician working) but NEVER a posed team/crew lineup of fake employees.`,
    ``,
    `Return ONLY a JSON object with this exact shape:`,
    `{`,
    `  "archetype": "<key from the catalog>",`,
    `  "eyebrow": { "color": "red" | "navy" | "light-blue", "text": "<ALL CAPS short label>" },`,
    `  "headline_lines": [ { "text": "<line>", "style": "sans" | "italic-serif" } ],`,
    `  "body_copy": "<1-3 sentences>",`,
    `  "photo": { "include": true | false, "description": "<scene, or empty>" },`,
    `  "trust_element": "<short trust line or null>",`,
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
  const archetype = typeof parsed.archetype === "string" ? parsed.archetype.trim() : "";
  if (!archetype || !template.ARCHETYPES?.[archetype]) {
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
      include: parsed.photo?.include !== false,
      description: typeof parsed.photo?.description === "string" ? parsed.photo.description : "",
    },
    trust_element:
      typeof parsed.trust_element === "string" && parsed.trust_element.trim()
        ? parsed.trust_element.trim()
        : null,
    // Phone forced in code — never trust the model with the number.
    cta: { text: `CALL ${IMAGE_PHONE}` },
  };

  return { ok: true, spec };
}
