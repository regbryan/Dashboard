import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, full-bleed renderer for RIVERSIDE HAT CO. Modern-Western (not
// costume) design language: warm earthy palette — tan #B89A6D + dark saddle
// brown #3A2E1F + rust #C9572C + cream #F2E6D5 — with a warm crafted SLAB serif
// (Bitter) headline and a tall condensed rust label (Oswald). Product photos are
// of HATS in context (never people/faces). The EST. 2021 oval logo is NEVER
// drawn here (added later) — a calm corner is left for it.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Bitter", data: f("bitter-700.woff"), weight: 700, style: "normal" },
      { name: "BitterBody", data: f("bitter-400.woff"), weight: 400, style: "normal" },
      { name: "Oswald", data: f("oswald-600.woff"), weight: 600, style: "normal" },
    ];
  }
  return fontsCache;
}

const TAN = "#B89A6D";
const BROWN = "#3A2E1F";
const RUST = "#C9572C";
const CREAM = "#F2E6D5";

export type RiversideArchetype = "A" | "C" | "D" | "G";
export type RiversideRenderInput = {
  archetype: RiversideArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headline?: string | null;
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

// Tall condensed rust label (Oswald, all-caps, spaced).
function label(text: string | null | undefined, color: string): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", fontFamily: "Oswald", fontWeight: 600, fontSize: "26px", letterSpacing: "6px", color }, text.toUpperCase())];
}
// Crafted slab-serif headline (Bitter).
function heading(text: string | null | undefined, color: string, size: number): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "92%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Bitter", fontWeight: 700, fontSize: `${size}px`, lineHeight: 1.1, color }, text.trim())];
}
function bodyEl(text: string | null | undefined, color: string): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "82%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "BitterBody", fontWeight: 400, fontSize: "28px", lineHeight: 1.4, color }, text.trim())];
}
// Rust-underlined condensed CTA.
function ctaEl(text: string | null | undefined, onDark: boolean): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", fontFamily: "Oswald", fontWeight: 600, fontSize: "24px", letterSpacing: "3px", padding: "10px 4px", borderBottom: `3px solid ${RUST}`, color: onDark ? CREAM : BROWN }, text.trim().toUpperCase())];
}

function productHeroTree(input: RiversideRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", width: "100%", height: "58%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const panel = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", flexGrow: 1, width: "100%", background: CREAM, padding: "48px 80px 92px" }, [
    ...label(input.eyebrow, RUST),
    ...heading(input.headline, BROWN, 58),
    ...bodyEl(input.body, BROWN),
    ...ctaEl(input.cta, false),
  ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [photo, panel]);
}

function processCardTree(input: RiversideRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  // Small filled rust square marker — sturdy and western.
  const square = () => h("div", { display: "flex", width: "20px", height: "20px", background: RUST, marginTop: "10px" }, []);
  const rows = items.map((it) => h("div", { display: "flex", alignItems: "flex-start", gap: "22px", width: "84%" }, [
    square(),
    h("div", { display: "flex", flexGrow: 1, fontFamily: "BitterBody", fontWeight: 400, fontSize: "29px", lineHeight: 1.32, color: BROWN }, it.text),
  ]));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: CREAM, padding: "100px 80px 108px" }, [
    ...label(input.eyebrow, RUST),
    ...heading(input.headline, BROWN, 60),
    h("div", { display: "flex", flexDirection: "column", gap: "22px", width: "100%", alignItems: "center", marginTop: "6px" }, rows),
    ...ctaEl(input.cta, false),
  ]);
}

function dropCardTree(input: RiversideRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "26px", width: "100%", height: "100%", background: BROWN, padding: "104px 84px 112px" }, [
    ...label(input.eyebrow, RUST),
    ...heading(input.headline, CREAM, 78),
    h("div", { display: "flex", width: "120px", height: "4px", background: RUST }, []),
    ...bodyEl(input.body, TAN),
    ...ctaEl(input.cta, true),
  ]);
}

function customerFeatureTree(input: RiversideRenderInput): El {
  const quote = input.quote ?? input.headline ?? "";
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "28px", width: "100%", height: "100%", background: BROWN, padding: "104px 88px 116px" }, [
    h("div", { display: "flex", width: "70px", height: "6px", background: RUST }, []),
    h("div", { display: "flex", width: "86%", justifyContent: "center", textAlign: "center", fontFamily: "Bitter", fontWeight: 700, fontSize: "46px", lineHeight: 1.25, color: CREAM }, quote),
    ...(input.attribution ? [h("div", { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: "26px", letterSpacing: "4px", color: TAN }, `— ${input.attribution.toUpperCase()}`)] : []),
  ]);
}

export async function renderRiversideDesign(input: RiversideRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  let root: El;
  if (input.archetype === "A") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    root = productHeroTree(input, `data:image/jpeg;base64,${jpeg.toString("base64")}`);
  } else if (input.archetype === "D") {
    root = dropCardTree(input);
  } else if (input.archetype === "G") {
    root = customerFeatureTree(input);
  } else {
    root = processCardTree(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function riversideArchetypeNeedsPhoto(a: RiversideArchetype): boolean {
  return a === "A";
}
