import "server-only";
import type { RiversideArchetype } from "./render-riverside";

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

type SpecPost = { concept: string | null; content_pillar: string | null; post_type: string | null };
export type RiversideSynthResult = { ok: true; spec: RiversideSpec } | { ok: false; error: string };

function pickArchetype(pillar: string | null, concept: string | null): RiversideArchetype {
  const t = `${pillar ?? ""} ${concept ?? ""}`.toLowerCase();
  if (/customer|feature|review|testimon|came in|wore|client/.test(t)) return "G";
  if (/process|how to|care|clean|shape|re-?crease|re-?band|steps|maintain|how a hat/.test(t)) return "C";
  if (/event|hat bar|trailer|promo|sale|gift|book|wedding|father|drop event|pop-?up/.test(t)) return "D";
  return "A"; // product hero (new arrivals / drops) default
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

  const archetype = pickArchetype(post.content_pillar, post.concept);
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
