import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, full-bleed renderer for STEPHANIE PEREZ HOME LOANS. Distinct
// from Omega: dusty STEEL-blue #3D5A80 (not navy) + light sky + ice blue, white
// SERIF on blue overlay cards is the signature, flowing SCRIPT (Allura) only as
// the personal signature accent, TEXT-CARD-first (she's a personal brand — her
// real photos can't be fabricated; photos are people-free lifestyle scenes).
// AHL logo / NMLS / DRE / headshot / compliance are NEVER drawn here.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Playfair", data: f("playfair-700.woff"), weight: 700, style: "normal" },
      { name: "PlayfairLight", data: f("playfair-400.woff"), weight: 400, style: "normal" },
      { name: "Montserrat", data: f("montserrat-400.woff"), weight: 400, style: "normal" },
      { name: "Allura", data: f("allura-400.woff"), weight: 400, style: "normal" },
    ];
  }
  return fontsCache;
}

const DEEP_BLUE = "#3D5A80";
const SKY_BLUE = "#98C1D9";
const ICE_BLUE = "#E0FBFC";
const WHITE = "#FFFFFF";
const NEARBLACK = "#1A1A1A";

export type StephanieArchetype = "A" | "C" | "D" | "G";
export type StephanieHeadlineLine = { text: string; style: "serif" | "script" };
export type StephanieRenderInput = {
  archetype: StephanieArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headlineLines: StephanieHeadlineLine[];
  body?: string | null;
  cta?: string | null;
  listItems?: { text: string }[] | null;
  quote?: string | null;
  attribution?: string | null;
  photo?: Buffer | null;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({ type, props: { style, children } });
const img = (src: string, style: Record<string, unknown>): El => ({ type: "img", props: { src, style } });

// Small spaced sans category label (optionally on blue).
function eyebrow(text: string | null | undefined, onBlue: boolean): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: "22px", letterSpacing: "6px", color: onBlue ? ICE_BLUE : DEEP_BLUE }, text.toUpperCase())];
}

// Serif headline (Playfair) + flowing script accent (Allura).
function headline(lines: StephanieHeadlineLine[], serifColor: string, scriptColor: string, serifSize: number, scriptSize: number): El {
  return h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "100%" },
    lines.map((l) => l.style === "script"
      ? h("div", { display: "flex", width: "100%", justifyContent: "center", textAlign: "center", fontFamily: "Allura", fontWeight: 400, fontSize: `${scriptSize}px`, lineHeight: 1.0, color: scriptColor }, l.text)
      : h("div", { display: "flex", width: "94%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: `${serifSize}px`, lineHeight: 1.12, color: serifColor }, l.text)));
}

// Light body serif (Playfair 400).
function bodyEl(text: string | null | undefined, color: string): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "84%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", lineHeight: 1.45, color }, text.trim())];
}

// Soft, relational CTA — thin underlined sans, never a pushy button.
function softCta(text: string | null | undefined, onBlue: boolean): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: "24px", letterSpacing: "3px", padding: "10px 4px", borderBottom: `2px solid ${onBlue ? ICE_BLUE : DEEP_BLUE}`, color: onBlue ? ICE_BLUE : DEEP_BLUE }, text.trim().toUpperCase())];
}

function photoOverlayCardTree(input: StephanieRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  // Semi-transparent deep-blue overlay card centered over the photo.
  const card = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", width: "80%", background: "rgba(61,90,128,0.88)", padding: "60px 56px", marginLeft: "10%", marginRight: "10%" }, [
    ...eyebrow(input.eyebrow, true),
    headline(input.headlineLines, WHITE, ICE_BLUE, 58, 92),
    ...softCta(input.cta, true),
  ]);
  return h("div", { display: "flex", position: "relative", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", background: DEEP_BLUE }, [
    photo,
    h("div", { display: "flex", width: "100%", justifyContent: "center" }, [card]),
  ]);
}

function valuesCardTree(input: StephanieRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 5);
  const rows = items.map((it) => h("div", { display: "flex", alignItems: "flex-start", gap: "18px", width: "82%" }, [
    h("div", { display: "flex", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", color: SKY_BLUE, marginTop: "2px" }, "—"),
    h("div", { display: "flex", flexGrow: 1, fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", lineHeight: 1.35, color: WHITE }, it.text),
  ]));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: DEEP_BLUE, padding: "104px 84px 112px" }, [
    ...eyebrow(input.eyebrow, true),
    headline(input.headlineLines, WHITE, ICE_BLUE, 62, 96),
    ...(items.length > 0
      ? [h("div", { display: "flex", flexDirection: "column", gap: "20px", width: "100%", alignItems: "center", marginTop: "6px" }, rows)]
      : bodyEl(input.body, ICE_BLUE)),
    ...softCta(input.cta, true),
  ]);
}

function quoteCardTree(input: StephanieRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "26px", width: "100%", height: "100%", background: ICE_BLUE, padding: "110px 88px 120px" }, [
    ...eyebrow(input.eyebrow, false),
    headline(input.headlineLines, DEEP_BLUE, DEEP_BLUE, 64, 104),
    ...bodyEl(input.body, NEARBLACK),
    ...softCta(input.cta, false),
  ]);
}

function testimonialCardTree(input: StephanieRenderInput): El {
  const quote = input.quote ?? input.headlineLines.map((l) => l.text).join(" ");
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: DEEP_BLUE, padding: "104px 88px 116px" }, [
    h("div", { display: "flex", fontFamily: "Allura", fontWeight: 400, fontSize: "92px", lineHeight: 0.9, color: SKY_BLUE }, "In Contract"),
    h("div", { display: "flex", width: "86%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "44px", lineHeight: 1.3, color: WHITE }, quote),
    ...(input.attribution ? [h("div", { display: "flex", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", letterSpacing: "1px", color: ICE_BLUE }, input.attribution)] : []),
  ]);
}

export async function renderStephanieDesign(input: StephanieRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  let root: El;
  if (input.archetype === "A") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    root = photoOverlayCardTree(input, `data:image/jpeg;base64,${jpeg.toString("base64")}`);
  } else if (input.archetype === "D") {
    root = quoteCardTree(input);
  } else if (input.archetype === "G") {
    root = testimonialCardTree(input);
  } else {
    root = valuesCardTree(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function stephanieArchetypeNeedsPhoto(a: StephanieArchetype): boolean {
  return a === "A";
}
