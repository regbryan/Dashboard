import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, full-bleed renderer for DOUG MITCHELL (Scale LLP). The quietest
// engine: corporate-restrained LinkedIn title cards. Teal-charcoal #1F5560 +
// cream-mint #D8EBE5, NO accent color (the restraint IS the brand). Display sans
// only (Montserrat) — no serif/script/emoji/flourish. Square 1:1. The SCALE LLP
// wordmark is NEVER drawn here (overlaid later) — a clean corner is left for it;
// the textual "Doug Mitchell, Partner" attribution IS rendered.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Montserrat", data: f("montserrat-700.woff"), weight: 700, style: "normal" },
      { name: "MontserratBody", data: f("montserrat-400.woff"), weight: 400, style: "normal" },
    ];
  }
  return fontsCache;
}

const TEAL = "#1F5560";
const MINT = "#D8EBE5";

export type DougArchetype = "A" | "C" | "D" | "G";
export type DougRenderInput = {
  archetype: DougArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headline?: string | null;
  subtitle?: string | null;
  listItems?: { text: string }[] | null;
  quote?: string | null;
  photo?: Buffer | null;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({ type, props: { style, children } });
const img = (src: string, style: Record<string, unknown>): El => ({ type: "img", props: { src, style } });

const ATTRIBUTION = "Doug Mitchell, Partner";

// Small spaced sans category label.
function eyebrow(text: string | null | undefined): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", fontFamily: "MontserratBody", fontWeight: 400, fontSize: "22px", letterSpacing: "5px", color: MINT, opacity: 0.75 }, text.toUpperCase())];
}
function heading(text: string | null | undefined, size: number, align: "left" | "center"): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "100%", textAlign: align, justifyContent: align === "center" ? "center" : "flex-start", fontFamily: "Montserrat", fontWeight: 700, fontSize: `${size}px`, lineHeight: 1.14, color: MINT }, text.trim())];
}
function subtitleEl(text: string | null | undefined, align: "left" | "center"): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "92%", textAlign: align, justifyContent: align === "center" ? "center" : "flex-start", fontFamily: "MontserratBody", fontWeight: 400, fontSize: "27px", lineHeight: 1.4, color: MINT, opacity: 0.82 }, text.trim())];
}
// Quiet attribution band — a thin mint rule over the name.
function attribution(): El {
  return h("div", { display: "flex", flexDirection: "column", gap: "12px", width: "100%" }, [
    h("div", { display: "flex", width: "84px", height: "3px", background: MINT, opacity: 0.6 }, []),
    h("div", { display: "flex", fontFamily: "MontserratBody", fontWeight: 400, fontSize: "24px", letterSpacing: "1px", color: MINT }, ATTRIBUTION),
  ]);
}

// Left-aligned title card with a bottom attribution — the Scale LLP look.
function titleCardTree(input: DougRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: TEAL, padding: "96px 88px" }, [
    h("div", { display: "flex", flexDirection: "column", gap: "26px", width: "100%" }, eyebrow(input.eyebrow)),
    h("div", { display: "flex", flexDirection: "column", gap: "24px", width: "100%" }, [
      ...heading(input.headline, 74, "left"),
      ...subtitleEl(input.subtitle, "left"),
    ]),
    attribution(),
  ]);
}

function photoTitleCardTree(input: DougRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const overlay = h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", background: "rgba(31,85,96,0.82)" }, []);
  const content = h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "96px 88px" }, [
    h("div", { display: "flex", flexDirection: "column", gap: "26px", width: "100%" }, eyebrow(input.eyebrow)),
    h("div", { display: "flex", flexDirection: "column", gap: "24px", width: "100%" }, [
      ...heading(input.headline, 74, "left"),
      ...subtitleEl(input.subtitle, "left"),
    ]),
    attribution(),
  ]);
  return h("div", { display: "flex", position: "relative", width: "100%", height: "100%", background: TEAL }, [photo, overlay, content]);
}

function listCardTree(input: DougRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const rows = items.map((it, i) => h("div", { display: "flex", alignItems: "flex-start", gap: "20px", width: "100%" }, [
    h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "32px", color: MINT, opacity: 0.7 }, String(i + 1).padStart(2, "0")),
    h("div", { display: "flex", flexGrow: 1, fontFamily: "MontserratBody", fontWeight: 400, fontSize: "30px", lineHeight: 1.3, color: MINT }, it.text),
  ]));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: TEAL, padding: "96px 88px" }, [
    h("div", { display: "flex", flexDirection: "column", gap: "26px", width: "100%" }, [
      ...eyebrow(input.eyebrow),
      ...heading(input.headline, 58, "left"),
    ]),
    h("div", { display: "flex", flexDirection: "column", gap: "22px", width: "100%" }, rows),
    attribution(),
  ]);
}

function warStoryCardTree(input: DougRenderInput): El {
  const quote = input.quote ?? input.headline ?? "";
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: TEAL, padding: "96px 88px" }, [
    h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "120px", lineHeight: 0.8, color: MINT, opacity: 0.45 }, "“"),
    h("div", { display: "flex", width: "100%", fontFamily: "Montserrat", fontWeight: 700, fontSize: "52px", lineHeight: 1.22, color: MINT }, quote),
    attribution(),
  ]);
}

// LinkedIn feed images are SQUARE. The layout is authored on a fixed 1080
// logical canvas (the proven proportions) and the PNG is rendered at LinkedIn's
// native 1200x1200, so the look is identical — just at the platform-native size.
const DOUG_LOGICAL = 1080;
const DOUG_OUTPUT = 1200;

export async function renderDougDesign(input: DougRenderInput): Promise<Buffer> {
  const outputWidth = input.width ?? DOUG_OUTPUT;
  let root: El;
  if (input.archetype === "C") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    root = photoTitleCardTree(input, `data:image/jpeg;base64,${jpeg.toString("base64")}`);
  } else if (input.archetype === "D") {
    root = listCardTree(input);
  } else if (input.archetype === "G") {
    root = warStoryCardTree(input);
  } else {
    root = titleCardTree(input);
  }
  // Square logical canvas keeps the proofed proportions; resvg upscales to the
  // native LinkedIn output size while preserving the 1:1 aspect.
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width: DOUG_LOGICAL, height: DOUG_LOGICAL, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: outputWidth } }).render().asPng());
}

export function dougArchetypeNeedsPhoto(a: DougArchetype): boolean {
  return a === "C";
}
