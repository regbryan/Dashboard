import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, full-bleed renderer for OMEGA MORTGAGE GROUP. Distinct design
// language from IEC: editorial serif display (Playfair) + flowing SCRIPT accent
// (Allura), navy #005181 + warm cream, HOLLOW navy numbered rings, gold reserved
// for review stars only, photo-forward. Logo + NMLS/compliance are NEVER drawn
// here — added later via the dashboard footer overlay.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Montserrat", data: f("montserrat-700.woff"), weight: 700, style: "normal" },
      { name: "Playfair", data: f("playfair-700.woff"), weight: 700, style: "normal" },
      { name: "Allura", data: f("allura-400.woff"), weight: 400, style: "normal" },
    ];
  }
  return fontsCache;
}

const NAVY = "#005181";
const CREAM = "#FBF9F5";
const NEARWHITE = "#FEFEFE";
const GOLD = "#FDD314";
const NEARBLACK = "#231F20";
const WHITE = "#FFFFFF";

export type OmegaArchetype = "A" | "C" | "D" | "G";
export type OmegaHeadlineLine = { text: string; style: "serif" | "script" };
export type OmegaRenderInput = {
  archetype: OmegaArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headlineLines: OmegaHeadlineLine[];
  body?: string | null;
  cta?: string | null;
  listItems?: { number?: string | null; text: string }[] | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo?: Buffer | null;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({ type, props: { style, children } });
const img = (src: string, style: Record<string, unknown>): El => ({ type: "img", props: { src, style } });

let goldStarCache: string | null = null;
async function goldStarUri(): Promise<string> {
  if (!goldStarCache) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="${GOLD}" d="M12 2l2.95 6.18 6.8.78-5.05 4.6 1.36 6.7L12 17.9 5.94 20.3l1.36-6.7L2.25 8.96l6.8-.78z"/></svg>`;
    goldStarCache = `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
  }
  return goldStarCache;
}

function eyebrow(text: string | null | undefined, onNavy: boolean): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: onNavy ? NEARWHITE : NAVY, color: onNavy ? NAVY : WHITE, fontFamily: "Montserrat", fontWeight: 700, fontSize: "24px", letterSpacing: "4px", padding: "12px 26px", borderRadius: "999px" }, text.toUpperCase())];
}
function headline(lines: OmegaHeadlineLine[], color: string, serifSize: number, scriptSize: number): El {
  return h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "0px", width: "100%" },
    lines.map((l) => l.style === "script"
      ? h("div", { display: "flex", width: "100%", justifyContent: "center", fontFamily: "Allura", fontWeight: 400, fontSize: `${scriptSize}px`, lineHeight: 1.0, color }, l.text)
      : h("div", { display: "flex", width: "100%", justifyContent: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: `${serifSize}px`, lineHeight: 1.06, color }, l.text)));
}
function bodyEl(text: string | null | undefined, color: string): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "88%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Montserrat", fontWeight: 700, fontSize: "28px", lineHeight: 1.4, color }, text.trim())];
}
function softCta(text: string | null | undefined, onNavy: boolean): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: onNavy ? NEARWHITE : NAVY, color: onNavy ? NAVY : WHITE, fontFamily: "Montserrat", fontWeight: 700, fontSize: "26px", letterSpacing: "2px", padding: "16px 34px", borderRadius: "999px" }, text.trim().toUpperCase())];
}

function photoHeroTree(input: OmegaRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", width: "100%", height: "58%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const panel = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "22px", flexGrow: 1, width: "100%", background: CREAM, padding: "52px 80px 104px" }, [
    ...eyebrow(input.eyebrow, false),
    headline(input.headlineLines, NAVY, 60, 88),
    ...bodyEl(input.body, NEARBLACK),
    ...softCta(input.cta, false),
  ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [photo, panel]);
}

function listicleTree(input: OmegaRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const ring = (n: string) => h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "72px", height: "72px", borderRadius: "999px", border: `3px solid ${NAVY}`, fontFamily: "Playfair", fontWeight: 700, fontSize: "38px", color: NAVY }, n);
  const rows = items.map((it, i) => h("div", { display: "flex", alignItems: "center", gap: "26px" }, [
    ring(it.number ?? String(i + 1)),
    h("div", { display: "flex", width: "80%", fontFamily: "Montserrat", fontWeight: 700, fontSize: "30px", lineHeight: 1.25, color: NEARBLACK }, it.text),
  ]));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: CREAM, padding: "92px 84px 104px" }, [
    ...eyebrow(input.eyebrow, false),
    headline(input.headlineLines, NAVY, 62, 90),
    h("div", { display: "flex", flexDirection: "column", gap: "24px", width: "100%", marginTop: "6px" }, rows),
    ...softCta(input.cta, false),
  ]);
}

function bigNumberTree(input: OmegaRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", width: "100%", height: "100%", background: CREAM, padding: "92px 84px 104px" }, [
    ...eyebrow(input.eyebrow, false),
    h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "330px", lineHeight: 0.95, color: NAVY }, input.bigStat ?? ""),
    headline(input.headlineLines, NAVY, 56, 84),
    ...bodyEl(input.body, NEARBLACK),
    ...softCta(input.cta, false),
  ]);
}

async function reviewTree(input: OmegaRenderInput): Promise<El> {
  const u = await goldStarUri();
  const stars = h("div", { display: "flex", gap: "14px" }, Array.from({ length: 5 }, () => img(u, { width: "56px", height: "56px" })));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "32px", width: "100%", height: "100%", background: NAVY, padding: "92px 84px 104px" }, [
    ...eyebrow(input.eyebrow, true),
    stars,
    h("div", { display: "flex", width: "90%", justifyContent: "center", textAlign: "center", fontFamily: "Allura", fontWeight: 400, fontSize: "76px", lineHeight: 1.1, color: WHITE }, input.quote ?? input.headlineLines.map((l) => l.text).join(" ")),
    ...(input.attribution ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "30px", color: NEARWHITE }, `— ${input.attribution}`)] : []),
  ]);
}

export async function renderOmegaDesign(input: OmegaRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  let root: El;
  if (input.archetype === "A") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    root = photoHeroTree(input, `data:image/jpeg;base64,${jpeg.toString("base64")}`);
  } else if (input.archetype === "C") {
    root = listicleTree(input);
  } else if (input.archetype === "D") {
    root = bigNumberTree(input);
  } else {
    root = await reviewTree(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function omegaArchetypeNeedsPhoto(a: OmegaArchetype): boolean {
  return a === "A";
}
