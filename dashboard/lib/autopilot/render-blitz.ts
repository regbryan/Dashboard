import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, full-bleed renderer for BLITZ ORGANIZATION. Soft, feminine,
// airy design language — distinct from IEC (bold patriotic), Omega (navy serif),
// and CSC (sunny bold sans). Dusty rose #ECB7B9 + sage + warm beige on cream.
// CASUAL handwritten SCRIPT (Caveat) carries the emotional hook; LIGHT clean
// sans (Montserrat 400) carries the information. Photos are of organized SPACES
// (never people). Logo/wordmark are NEVER drawn here (composited on top later) —
// a calm, uncluttered zone with breathing room is left for them.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Montserrat", data: f("montserrat-400.woff"), weight: 400, style: "normal" },
      { name: "Montserrat", data: f("montserrat-700.woff"), weight: 700, style: "normal" },
      { name: "Caveat", data: f("caveat-700.woff"), weight: 700, style: "normal" },
    ];
  }
  return fontsCache;
}

const ROSE = "#ECB7B9";
const SAGE = "#9CAF9C";
const CREAM = "#FBF8F4";
const WHITE = "#FFFFFF";
const CHARCOAL = "#595959";

export type BlitzArchetype = "A" | "C" | "D" | "G";
export type BlitzHeadlineLine = { text: string; style: "script" | "sans" };
export type BlitzRenderInput = {
  archetype: BlitzArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headlineLines: BlitzHeadlineLine[];
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

// Small dusty-rose pill, charcoal spaced label.
function eyebrow(text: string | null | undefined): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: ROSE, color: CHARCOAL, fontFamily: "Montserrat", fontWeight: 700, fontSize: "22px", letterSpacing: "4px", padding: "11px 26px", borderRadius: "999px" }, text.toUpperCase())];
}

// Script hook (Caveat, the focal point) + light-sans info lines (Montserrat 400).
function headline(lines: BlitzHeadlineLine[], scriptSize: number, sansSize: number): El {
  return h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "100%" },
    lines.map((l) => l.style === "script"
      ? h("div", { display: "flex", width: "100%", justifyContent: "center", textAlign: "center", fontFamily: "Caveat", fontWeight: 700, fontSize: `${scriptSize}px`, lineHeight: 1.02, color: CHARCOAL }, l.text)
      : h("div", { display: "flex", width: "92%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: `${sansSize}px`, lineHeight: 1.3, color: CHARCOAL }, l.text)));
}

function bodyEl(text: string | null | undefined): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "84%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: "27px", lineHeight: 1.45, color: CHARCOAL }, text.trim())];
}

// Soft rose pill CTA — mixed-case, gentle (never shouting).
function softCta(text: string | null | undefined): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: ROSE, color: CHARCOAL, fontFamily: "Montserrat", fontWeight: 700, fontSize: "25px", letterSpacing: "1px", padding: "15px 36px", borderRadius: "999px" }, text.trim())];
}

function photoHeroTree(input: BlitzRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", width: "100%", height: "56%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const panel = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "22px", flexGrow: 1, width: "100%", background: CREAM, padding: "48px 84px 96px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 92, 40),
    ...softCta(input.cta),
  ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [photo, panel]);
}

function softListicleTree(input: BlitzRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  // Soft marker: a small rose/sage dot (alternating) — NOT a heavy filled circle.
  const dot = (i: number) => h("div", { display: "flex", width: "20px", height: "20px", borderRadius: "999px", background: i % 2 === 0 ? ROSE : SAGE, marginTop: "10px" }, []);
  const rows = items.map((it, i) => h("div", { display: "flex", alignItems: "flex-start", gap: "24px", width: "84%" }, [
    dot(i),
    h("div", { display: "flex", flexGrow: 1, fontFamily: "Montserrat", fontWeight: 400, fontSize: "30px", lineHeight: 1.3, color: CHARCOAL }, it.text),
  ]));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "34px", width: "100%", height: "100%", background: CREAM, padding: "104px 80px 110px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 96, 40),
    h("div", { display: "flex", flexDirection: "column", gap: "26px", width: "100%", alignItems: "center", marginTop: "8px" }, rows),
    ...softCta(input.cta),
  ]);
}

function questionCardTree(input: BlitzRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: CREAM, padding: "110px 88px 120px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 116, 42),
    ...bodyEl(input.body),
    ...softCta(input.cta),
  ]);
}

function testimonialTree(input: BlitzRenderInput): El {
  const quote = input.quote ?? input.headlineLines.map((l) => l.text).join(" ");
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "28px", width: "100%", height: "100%", background: ROSE, padding: "104px 88px 116px" }, [
    h("div", { display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: "150px", lineHeight: 0.6, color: WHITE }, "“"),
    h("div", { display: "flex", width: "88%", justifyContent: "center", textAlign: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: "40px", lineHeight: 1.4, color: CHARCOAL }, quote),
    ...(input.attribution ? [h("div", { display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: "56px", color: WHITE }, input.attribution)] : []),
  ]);
}

export async function renderBlitzDesign(input: BlitzRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  let root: El;
  if (input.archetype === "A") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    root = photoHeroTree(input, `data:image/jpeg;base64,${jpeg.toString("base64")}`);
  } else if (input.archetype === "C") {
    root = softListicleTree(input);
  } else if (input.archetype === "D") {
    root = questionCardTree(input);
  } else {
    root = testimonialTree(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function blitzArchetypeNeedsPhoto(a: BlitzArchetype): boolean {
  return a === "A";
}
