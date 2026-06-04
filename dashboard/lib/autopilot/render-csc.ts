import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, full-bleed renderer for CYBER SAFETY COP. Bright, calm,
// empowering: sunny yellow #FFDE59 + electric blue #057AC0, HEAVY bold sans
// (Poppins ExtraBold) — no italic/serif/script. FILLED solid-blue numbered
// circles with white numerals. Logo + cybersafetycop.com are NEVER drawn here
// (composited on top later) — a clean top zone is reserved for them.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 700 | 800; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Poppins", data: f("poppins-700.woff"), weight: 700, style: "normal" },
      { name: "Poppins", data: f("poppins-800.woff"), weight: 800, style: "normal" },
      { name: "Montserrat", data: f("montserrat-700.woff"), weight: 700, style: "normal" },
    ];
  }
  return fontsCache;
}

const YELLOW = "#FFDE59";
const BLUE = "#057AC0";
const DARKGRAY = "#646668";
const WHITE = "#FFFFFF";

const TOP_RESERVE = 150; // clean zone reserved for the logo composite

export type CscArchetype = "A" | "C" | "D" | "G";
export type CscRenderInput = {
  archetype: CscArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headline?: string | null;
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

let yellowStarCache: string | null = null;
async function yellowStarUri(): Promise<string> {
  if (!yellowStarCache) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="${YELLOW}" d="M12 2l2.95 6.18 6.8.78-5.05 4.6 1.36 6.7L12 17.9 5.94 20.3l1.36-6.7L2.25 8.96l6.8-.78z"/></svg>`;
    yellowStarCache = `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
  }
  return yellowStarCache;
}

function pill(text: string | null | undefined, bg: string, color: string): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: bg, color, fontFamily: "Montserrat", fontWeight: 700, fontSize: "26px", letterSpacing: "2px", padding: "13px 30px", borderRadius: "999px" }, text.toUpperCase())];
}
function heading(text: string | null | undefined, color: string, size: number): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "94%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Poppins", fontWeight: 800, fontSize: `${size}px`, lineHeight: 1.08, color }, text.trim())];
}
function bodyEl(text: string | null | undefined, color: string): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "86%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Poppins", fontWeight: 700, fontSize: "28px", lineHeight: 1.36, color }, text.trim())];
}
function ctaEl(text: string | null | undefined): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: BLUE, color: WHITE, fontFamily: "Poppins", fontWeight: 800, fontSize: "26px", letterSpacing: "1px", padding: "16px 34px", borderRadius: "999px" }, text.trim())];
}

function listicle(input: CscRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const circle = (n: string) => h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "74px", height: "74px", borderRadius: "999px", background: BLUE, color: WHITE, fontFamily: "Poppins", fontWeight: 800, fontSize: "38px" }, n);
  const rows = items.map((it, i) => h("div", { display: "flex", alignItems: "center", gap: "26px" }, [
    circle(it.number ?? String(i + 1)),
    h("div", { display: "flex", width: "78%", fontFamily: "Poppins", fontWeight: 700, fontSize: "30px", lineHeight: 1.22, color: DARKGRAY }, it.text),
  ]));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "32px", width: "100%", height: "100%", background: YELLOW, padding: `${TOP_RESERVE}px 84px 96px` }, [
    ...pill(input.eyebrow, BLUE, WHITE),
    ...heading(input.headline, DARKGRAY, 64),
    h("div", { display: "flex", flexDirection: "column", gap: "24px", width: "100%", marginTop: "4px" }, rows),
    ...ctaEl(input.cta),
  ]);
}

function bigNumber(input: CscRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", width: "100%", height: "100%", background: YELLOW, padding: `${TOP_RESERVE}px 84px 96px` }, [
    ...pill(input.eyebrow, BLUE, WHITE),
    h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "320px", lineHeight: 0.95, color: BLUE }, input.bigStat ?? ""),
    ...heading(input.headline, DARKGRAY, 58),
    ...bodyEl(input.body, DARKGRAY),
    ...ctaEl(input.cta),
  ]);
}

function commandPhoto(input: CscRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", flexGrow: 1, width: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const band = h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", width: "100%", background: "rgba(5,122,192,0.92)", padding: "44px 70px 56px" }, [
    ...heading(input.headline, WHITE, 56),
    ...bodyEl(input.body, "#E6F2FB"),
  ]);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: BLUE }, [
    h("div", { display: "flex", width: "100%", height: `${TOP_RESERVE}px`, background: "rgba(0,0,0,0)" }, []),
    photo,
    band,
  ]);
}

async function review(input: CscRenderInput): Promise<El> {
  const u = await yellowStarUri();
  const stars = h("div", { display: "flex", gap: "14px" }, Array.from({ length: 5 }, () => img(u, { width: "56px", height: "56px" })));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "32px", width: "100%", height: "100%", background: BLUE, padding: `${TOP_RESERVE}px 84px 96px` }, [
    ...pill(input.eyebrow, WHITE, BLUE),
    stars,
    h("div", { display: "flex", width: "90%", justifyContent: "center", textAlign: "center", fontFamily: "Poppins", fontWeight: 800, fontSize: "46px", lineHeight: 1.22, color: WHITE }, input.quote ?? input.headline ?? ""),
    ...(input.attribution ? [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "28px", color: YELLOW }, `— ${input.attribution}`)] : []),
  ]);
}

export async function renderCscDesign(input: CscRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  let root: El;
  if (input.archetype === "C") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    root = commandPhoto(input, `data:image/jpeg;base64,${jpeg.toString("base64")}`);
  } else if (input.archetype === "D") {
    root = bigNumber(input);
  } else if (input.archetype === "G") {
    root = await review(input);
  } else {
    root = listicle(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function cscArchetypeNeedsPhoto(a: CscArchetype): boolean {
  return a === "C";
}
