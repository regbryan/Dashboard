import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

// Builds an image-generation prompt from a brand's LOCKED archetype contract
// (bundled at lib/autopilot/brand-templates/<slug>.json, sourced from the
// client-approved post-template.json). This is how the dashboard *enforces*
// the brand rules deterministically: every prompt is assembled from the same
// strict color contract, archetype layout, hard rules, and negative prompt —
// the AI never gets to skip them. Validated to reproduce the IEC "v6" look.
//
// Only brands with a bundled template use this path; others fall back to the
// generic brand-prompt.ts envelope.

const TEMPLATE_DIR = path.join(process.cwd(), "lib", "autopilot", "brand-templates");

export type BrandTemplate = {
  _engine?: string;
  STRICT_COLOR_CONTRACT?: Record<string, unknown>;
  BRAND?: Record<string, unknown>;
  ARCHETYPES?: Record<string, { description?: string; when_to_use?: string }>;
  REUSABLE_ELEMENTS?: Record<string, unknown>;
  TYPOGRAPHY?: Record<string, unknown>;
  GLOBAL_HARD_RULES?: string[];
  GLOBAL_NEGATIVE_PROMPT?: string;
};

const templateCache = new Map<string, BrandTemplate | null>();

/** Load a brand's bundled archetype template, or null if it has none. */
export function loadBrandTemplate(slug: string): BrandTemplate | null {
  if (templateCache.has(slug)) return templateCache.get(slug) ?? null;
  let tpl: BrandTemplate | null = null;
  try {
    const raw = readFileSync(path.join(TEMPLATE_DIR, `${slug}.json`), "utf8");
    tpl = JSON.parse(raw) as BrandTemplate;
  } catch {
    tpl = null; // no template for this brand → generic path
  }
  templateCache.set(slug, tpl);
  return tpl;
}

export type ArchetypeHeadlineLine = {
  text: string;
  style: "sans" | "italic-serif";
};
export type ArchetypeSpec = {
  archetype: string; // canonical template key, e.g. "A_color_block_photo_split"
  eyebrow: { color: "red" | "navy" | "light-blue"; text: string };
  headline_lines: ArchetypeHeadlineLine[];
  body_copy: string;
  photo: { include: boolean; description: string };
  trust_element?: string | null;
  cta: { text: string };
  // Per-archetype extras (only the relevant ones are filled):
  list_items?: { number?: string | null; text: string }[] | null; // E (numbered list)
  quote?: string | null; // D (testimonial)
  attribution?: string | null; // D — e.g. "The Patel Family, Riverside"
  big_stat?: string | null; // F/G/H — e.g. "78°F", "2009", "$99", "15+"
};

const ASPECT_LABEL: Record<string, string> = {
  "4:5": "4:5 portrait",
  "1:1": "1:1 square",
  "9:16": "9:16 vertical",
  "16:9": "16:9 landscape",
};

function colorContractLines(c: Record<string, unknown> | undefined): string[] {
  if (!c) return [];
  const hex = (k: string) => (typeof c[k] === "string" ? (c[k] as string) : null);
  const navy = hex("navy_hero") ?? "#104B94";
  const lightBlue = hex("light_blue_secondary") ?? "#87ABCF";
  const red = hex("red_accent_default") ?? "#DB222A";
  return [
    `- Navy ${navy} = HERO, the dominant color (headline panels, primary blocks).`,
    `- Red ${red} = the ONLY accent — eyebrow pills, stars, numerals, dividers, CTA arrows.`,
    `- Light blue ${lightBlue} = soft secondary + the italic-serif emphasis word on navy.`,
    `- White #FFFFFF = text on navy, CTA pill fill.`,
    `FORBIDDEN colors: yellow, gold, orange, any teal fills. Stars are ALWAYS red, never gold or yellow.`,
  ];
}

function renderHeadline(lines: ArchetypeHeadlineLine[]): string[] {
  return lines.map((l, i) =>
    l.style === "italic-serif"
      ? `  • line ${i + 1} in ITALIC SERIF, light blue #87ABCF (emphasis): "${l.text}"`
      : `  • line ${i + 1} in BOLD CONDENSED SANS, white: "${l.text}"`
  );
}

/**
 * Build a prompt for a TEXT-FREE photo only (used by the Satori archetype path:
 * the AI makes the photo, code draws the panel + text). No text/logos/frames.
 */
export function buildPhotoPrompt(template: BrandTemplate, spec: ArchetypeSpec): string {
  const uniform = (template.GLOBAL_HARD_RULES ?? []).find((r) =>
    r.startsWith("TECHNICIAN UNIFORM")
  );
  const scene = spec.photo?.description?.trim() || "a clean, on-brand lifestyle photo relevant to the topic";
  const mentionsTech = /technician|tech\b|worker|crew|repair|service call/i.test(scene);
  return [
    `A single photorealistic PHOTOGRAPH only. ABSOLUTELY NO text, letters, numbers, words, captions, logos, watermarks, badges, signs, or graphic overlays of any kind anywhere in the image — a clean photo, nothing else. Fill the entire frame edge-to-edge; no border, frame, or margin.`,
    `Scene: ${scene}`,
    `Do NOT add any workers, technicians, or people unless the scene above explicitly describes them. Prefer a beautiful, magazine-quality scene.`,
    mentionsTech && uniform ? uniform : "",
    `Natural light, professional, photorealistic. Not a stock-photo cliché. No one posing for the camera.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Assemble the full contract prompt for one post. */
export function buildArchetypePrompt(
  template: BrandTemplate,
  spec: ArchetypeSpec,
  opts: { aspectRatio?: string; platform?: string } = {}
): string {
  const brand = template.BRAND ?? {};
  const brandName = (brand.name as string) ?? "the brand";
  const market = brand.market ? ` (${brand.market})` : "";
  const platform = opts.platform ?? "Instagram";
  const aspect = ASPECT_LABEL[opts.aspectRatio ?? "4:5"] ?? "4:5 portrait";

  const arch = template.ARCHETYPES?.[spec.archetype];
  const archDesc =
    arch?.description ??
    "navy hero panel with eyebrow, headline, and CTA on top; photo below.";

  const out: string[] = [];
  out.push(
    `Create ONE ${platform} post graphic, ${aspect}, for ${brandName}${market}. Follow this brand design system EXACTLY. Render every word crisply and CORRECTLY SPELLED — no garbled, warped, or misspelled text anywhere.`,
    ""
  );
  out.push("STRICT COLOR CONTRACT — use ONLY these colors:");
  out.push(...colorContractLines(template.STRICT_COLOR_CONTRACT));
  out.push("");
  out.push(`LAYOUT — Archetype ${spec.archetype}: ${archDesc}`);
  out.push("Fill that layout with exactly these elements:");
  out.push(
    `- Eyebrow: a small ${spec.eyebrow.color} rounded pill, white ALL-CAPS text: "${spec.eyebrow.text}"`
  );
  out.push("- Headline:");
  out.push(...renderHeadline(spec.headline_lines));
  if (spec.body_copy?.trim()) {
    out.push(`- Body copy, clean sans, 1-3 short sentences: "${spec.body_copy.trim()}"`);
  }
  if (spec.trust_element?.trim()) {
    out.push(`- Trust element: ${spec.trust_element.trim()}`);
  }
  out.push(`- CTA: a rounded pill button with a small red arrow: "${spec.cta.text}"`);
  // Phone burn-in (contract-driven): if the brand defines a social phone for the
  // image, render it EXACTLY (dots format) and forbid the website-only number.
  const phoneOnImage = typeof brand.phone_on_image === "string" ? (brand.phone_on_image as string) : null;
  const phoneForbidden =
    typeof brand.phone_website_only_NEVER_on_image === "string"
      ? (brand.phone_website_only_NEVER_on_image as string)
      : null;
  if (phoneOnImage) {
    out.push(
      `- Phone (REQUIRED): render the phone number exactly as "${phoneOnImage}" — same digits, dots format, no parentheses or dashes — clearly legible in the CTA or footer area.${
        phoneForbidden ? ` NEVER render "${phoneForbidden}" or any other phone number.` : ""
      }`
    );
  }
  if (spec.photo?.include) {
    out.push(
      `- Photo: ${spec.photo.description.trim()} Photorealistic, natural light, not a stock-photo cliché.`
    );
  } else {
    out.push(
      "- No photograph — a clean text-and-color-block design (the message is strong on its own)."
    );
  }
  out.push("");
  const typo = template.TYPOGRAPHY ?? {};
  out.push(
    `TYPOGRAPHY: ${
      (typo.sans_headline as string) ?? "bold condensed sans for headlines and labels"
    }; italic serif for the 1-2 emphasis words ONLY (never a whole headline).`
  );
  out.push("");
  out.push("HARD RULES (treat as absolute):");
  for (const r of template.GLOBAL_HARD_RULES ?? []) out.push(`- ${r}`);
  out.push("");
  out.push(`Do NOT include: ${template.GLOBAL_NEGATIVE_PROMPT ?? ""}`);

  return out.join("\n");
}
