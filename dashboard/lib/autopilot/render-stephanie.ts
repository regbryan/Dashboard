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
const CREAM = "#F2EBDF"; // warm bokeh-cream ground (the "In Contract" celebration)
const WHITE = "#FFFFFF";
const NEARBLACK = "#1A1A1A";

export type StephanieArchetype =
  | "A" | "C" | "D" | "G"
  | "PHOTOBAND" | "TOPBAND" | "SPLIT" | "POLAROID" | "CHECK" | "NUMBER";
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
  bigStat?: string | null;
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

// Thin elegant check mark as drawn SVG (Playfair has no ✓ glyph).
const iconCache: Record<string, string> = {};
async function checkUri(color: string): Promise<string> {
  if (!iconCache[color]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    iconCache[color] = `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
  }
  return iconCache[color];
}

// Left-aligned serif + script headline (for the split panel).
function headlineLeft(lines: StephanieHeadlineLine[], serifColor: string, scriptColor: string, serifSize: number, scriptSize: number): El {
  return h("div", { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px", width: "100%" },
    lines.map((l) => l.style === "script"
      ? h("div", { display: "flex", fontFamily: "Allura", fontWeight: 400, fontSize: `${scriptSize}px`, lineHeight: 1.0, color: scriptColor }, l.text)
      : h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: `${serifSize}px`, lineHeight: 1.1, color: serifColor }, l.text)));
}

// PHOTOBAND — lifestyle photo on top, a deep-blue band beneath holding the serif
// statement + body (the "this is why I do what I do" / "closer than you think" look).
function photoBandTree(input: StephanieRenderInput, dataUri: string): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: DEEP_BLUE }, [
    h("div", { display: "flex", width: "100%", height: "60%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "18px", flexGrow: 1, width: "100%", padding: "48px 80px 70px" }, [
      ...eyebrow(input.eyebrow, true),
      headline(input.headlineLines, WHITE, ICE_BLUE, 52, 82),
      ...bodyEl(input.body, ICE_BLUE),
    ]),
  ]);
}

// TOPBAND — a deep-blue band on top (serif statement + body) over the photo
// (the "closing costs — let's clear this up" look).
function topBandTree(input: StephanieRenderInput, dataUri: string): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: DEEP_BLUE }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "14px", width: "100%", padding: "60px 80px 46px" }, [
      headline(input.headlineLines, WHITE, ICE_BLUE, 46, 72),
      ...bodyEl(input.body, ICE_BLUE),
    ]),
    h("div", { display: "flex", flexGrow: 1, width: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
  ]);
}

// SPLIT — lifestyle photo left, a deep-blue panel right with a left-aligned serif
// + script headline and a check list (the "choosing a lender" look).
function splitTree(input: StephanieRenderInput, dataUri: string, checkIcon: string): El {
  const items = (input.listItems ?? []).slice(0, 5);
  const panel = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", width: "50%", height: "100%", background: DEEP_BLUE, padding: "70px 48px" }, [
    headlineLeft(input.headlineLines, WHITE, ICE_BLUE, 54, 76),
    h("div", { display: "flex", flexDirection: "column", gap: "18px", width: "100%", marginTop: "16px" },
      items.map((it) => h("div", { display: "flex", alignItems: "flex-start", gap: "16px", width: "100%" }, [
        img(checkIcon, { width: "28px", height: "28px", marginTop: "6px" }),
        h("div", { display: "flex", flexGrow: 1, fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "29px", lineHeight: 1.28, color: WHITE }, it.text),
      ]))),
  ]);
  const photo = h("div", { display: "flex", width: "50%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  return h("div", { display: "flex", flexDirection: "row", width: "100%", height: "100%", background: DEEP_BLUE }, [photo, panel]);
}

// POLAROID — a celebration: a script header over a white-framed photo on a warm
// bokeh-cream ground, with a serif caption (the "In Contract — Sarah" look).
function polaroidTree(input: StephanieRenderInput, dataUri: string): El {
  const headerScript = input.headlineLines.find((l) => l.style === "script")?.text || input.headlineLines[0]?.text || "In Contract";
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "34px", width: "100%", height: "100%", background: CREAM, padding: "96px 80px" }, [
    h("div", { display: "flex", fontFamily: "Allura", fontWeight: 400, fontSize: "118px", lineHeight: 0.9, color: DEEP_BLUE }, headerScript),
    h("div", { display: "flex", background: WHITE, padding: "20px 20px 30px", boxShadow: "0 22px 60px rgba(0,0,0,0.18)" }, [
      img(dataUri, { width: "560px", height: "560px", objectFit: "cover" }),
    ]),
    ...(input.body?.trim()
      ? [h("div", { display: "flex", width: "86%", justifyContent: "center", textAlign: "center", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "31px", lineHeight: 1.4, color: NEARBLACK }, input.body.trim())]
      : []),
  ]);
}

// CHECK — a checkmark list card (no photo): deep-blue ground, serif + script title,
// ice-blue checks. The list cousin of the dash-led values card.
function checkCardTree(input: StephanieRenderInput, checkIcon: string): El {
  const items = (input.listItems ?? []).slice(0, 5);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: DEEP_BLUE, padding: "104px 84px 112px" }, [
    ...eyebrow(input.eyebrow, true),
    headline(input.headlineLines, WHITE, ICE_BLUE, 60, 92),
    h("div", { display: "flex", flexDirection: "column", gap: "18px", width: "76%", alignSelf: "center", marginTop: "6px" },
      items.map((it) => h("div", { display: "flex", alignItems: "flex-start", gap: "16px", width: "100%" }, [
        img(checkIcon, { width: "28px", height: "28px", marginTop: "6px" }),
        h("div", { display: "flex", flexGrow: 1, fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", lineHeight: 1.32, color: WHITE }, it.text),
      ]))),
    ...softCta(input.cta, true),
  ]);
}

// NUMBER — a quiet big-stat card: a large serif numeral on an ice-blue ground,
// serif label + body. Editorial, never loud.
function numberCardTree(input: StephanieRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", width: "100%", height: "100%", background: ICE_BLUE, padding: "104px 84px 112px" }, [
    ...eyebrow(input.eyebrow, false),
    h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "240px", lineHeight: 1.0, color: DEEP_BLUE }, input.bigStat ?? ""),
    headline(input.headlineLines, DEEP_BLUE, DEEP_BLUE, 52, 84),
    ...bodyEl(input.body, NEARBLACK),
    ...softCta(input.cta, false),
  ]);
}

export async function renderStephanieDesign(input: StephanieRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const toUri = async (buf: Buffer) => `data:image/jpeg;base64,${(await sharp(buf).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer()).toString("base64")}`;
  const a = input.archetype;
  let root: El;
  if (a === "A" || a === "PHOTOBAND" || a === "TOPBAND" || a === "SPLIT" || a === "POLAROID") {
    const uri = await toUri(input.photo as Buffer);
    root =
      a === "PHOTOBAND" ? photoBandTree(input, uri)
      : a === "TOPBAND" ? topBandTree(input, uri)
      : a === "SPLIT" ? splitTree(input, uri, await checkUri(ICE_BLUE))
      : a === "POLAROID" ? polaroidTree(input, uri)
      : photoOverlayCardTree(input, uri);
  } else if (a === "D") {
    root = quoteCardTree(input);
  } else if (a === "G") {
    root = testimonialCardTree(input);
  } else if (a === "CHECK") {
    root = checkCardTree(input, await checkUri(ICE_BLUE));
  } else if (a === "NUMBER") {
    root = numberCardTree(input);
  } else {
    root = valuesCardTree(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function stephanieArchetypeNeedsPhoto(a: StephanieArchetype): boolean {
  return a === "A" || a === "PHOTOBAND" || a === "TOPBAND" || a === "SPLIT" || a === "POLAROID";
}
