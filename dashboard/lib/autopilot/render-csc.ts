import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic renderer for CYBER SAFETY COP. Bright, calm, empowering, FLAT and
// BOLD: sunny yellow #FFDE59 + electric blue #057AC0 + soft light-blue grounds +
// a coral accent, HEAVY bold sans (Poppins ExtraBold) — no italic/serif/script.
// FILLED solid-blue numbered circles/bars with white numerals. Logo +
// cybersafetycop.com are NEVER drawn here (composited later) — a clean top zone
// is reserved for them.

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
const LIGHTBLUE = "#CFE6F6"; // soft background tint used across the references
const CORAL = "#F0726A"; // secondary accent panel ("Trusted by")
const HEAD = "#4E5052"; // dark-gray headings
const BODYGRAY = "#3E4042";
const DARKGRAY = "#646668";
const WHITE = "#FFFFFF";
const NEARWHITE = "#EAF4FC";

const TOP_RESERVE = 150; // clean zone reserved for the logo composite
const FOOT_RESERVE = 86; // clean zone reserved for the cybersafetycop.com composite

export type CscArchetype =
  | "A" | "C" | "D" | "G"
  | "QUAD" | "PHOTOSPLIT" | "YHEADER" | "COMPARE" | "STATEMENT" | "CHECK";
export type CscRenderInput = {
  archetype: CscArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headline?: string | null;
  headlineAccent?: string | null; // optional blue emphasis line (YHEADER)
  body?: string | null;
  cta?: string | null;
  listItems?: { number?: string | null; lead?: string | null; text: string }[] | null;
  quadItems?: { heading: string; text: string }[] | null;
  bullets?: string[] | null;
  coralTag?: string | null; // PHOTOSPLIT coral-panel callout
  compare?: { goodLabel?: string; good: string[]; badLabel?: string; bad: string[] } | null;
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

// Check / cross marks as drawn SVG (Poppins has no ✓/✕ glyph — they tofu).
const iconCache: Record<string, string> = {};
async function iconUri(kind: "check" | "cross", color: string): Promise<string> {
  const key = `${kind}:${color}`;
  if (!iconCache[key]) {
    const d = kind === "check" ? "M4 12.5l5 5L20 6.5" : "M6 6l12 12M18 6L6 18";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    iconCache[key] = `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
  }
  return iconCache[key];
}

function pill(text: string | null | undefined, bg: string, color: string): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: bg, color, fontFamily: "Montserrat", fontWeight: 700, fontSize: "26px", letterSpacing: "2px", padding: "13px 30px", borderRadius: "999px" }, text.toUpperCase())];
}
function heading(text: string | null | undefined, color: string, size: number, width = "94%"): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width, alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Poppins", fontWeight: 800, fontSize: `${size}px`, lineHeight: 1.08, color }, text.trim())];
}
function bodyEl(text: string | null | undefined, color: string, size = 28): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "86%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Poppins", fontWeight: 700, fontSize: `${size}px`, lineHeight: 1.36, color }, text.trim())];
}
function ctaEl(text: string | null | undefined): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: BLUE, color: WHITE, fontFamily: "Poppins", fontWeight: 800, fontSize: "26px", letterSpacing: "1px", padding: "16px 34px", borderRadius: "999px" }, text.trim())];
}

// STEPS (A) — the workhorse. Soft light-blue ground, blue pill eyebrow, big gray
// heading, then 3 BOLD BLUE ROUNDED BARS: a huge white number + a bold white lead
// + a white detail line. Matches the "tell / block / delete" reference.
function steps(input: CscRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 3);
  const bar = (it: { number?: string | null; lead?: string | null; text: string }, i: number) =>
    h("div", { display: "flex", alignItems: "center", gap: "26px", width: "100%", background: BLUE, borderRadius: "26px", padding: "26px 34px" }, [
      h("div", { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: "108px", fontFamily: "Poppins", fontWeight: 800, fontSize: "92px", lineHeight: 1, color: WHITE }, it.number ?? String(i + 1).padStart(2, "0")),
      h("div", { display: "flex", flexDirection: "column", gap: "4px", width: "78%" }, [
        h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "40px", lineHeight: 1.04, color: WHITE }, (it.lead?.trim() || it.text).toUpperCase()),
        ...(it.lead?.trim() && it.text?.trim()
          ? [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "26px", lineHeight: 1.26, color: NEARWHITE }, it.text)]
          : []),
      ]),
    ]);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "26px", width: "100%", height: "100%", background: LIGHTBLUE, padding: `${TOP_RESERVE}px 76px ${FOOT_RESERVE + 24}px` }, [
    ...pill(input.eyebrow, BLUE, WHITE),
    ...heading(input.headline, HEAD, 62),
    h("div", { display: "flex", flexDirection: "column", gap: "22px", width: "100%", marginTop: "6px" }, items.map(bar)),
    ...ctaEl(input.cta),
  ]);
}

// QUAD — blue header band (pill + heading) over a 2x2 grid of white cards (blue
// heading + gray detail), soft CTA. For "4 settings / signs / apps" content.
function quad(input: CscRenderInput): El {
  const items = (input.quadItems ?? []).slice(0, 4);
  const card = (it: { heading: string; text: string }) =>
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "12px", width: "47%", flexGrow: 1, background: WHITE, borderRadius: "22px", padding: "34px 32px" }, [
      h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "34px", lineHeight: 1.08, color: BLUE }, it.heading),
      h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "24px", lineHeight: 1.3, color: BODYGRAY }, it.text),
    ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: LIGHTBLUE }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "16px", width: "100%", background: BLUE, padding: `${TOP_RESERVE}px 70px 40px` }, [
      ...pill(input.eyebrow, YELLOW, BLUE),
      ...heading(input.headline, WHITE, 58),
    ]),
    h("div", { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignContent: "stretch", gap: "24px", flexGrow: 1, width: "100%", padding: "40px 70px 16px" }, items.map(card)),
    h("div", { display: "flex", justifyContent: "center", width: "100%", padding: `0 0 ${FOOT_RESERVE + 8}px` }, ctaEl(input.cta)),
  ]);
}

// PHOTOSPLIT — photo on top, a split bottom panel: a wide BLUE panel (white pill +
// white headline card + white bullets) and a narrow CORAL panel (a short callout).
// Matches the "bright canary explainer" reference.
function photoSplit(input: CscRenderInput, dataUri: string): El {
  const bullets = (input.bullets ?? []).slice(0, 4);
  const bluePanel = h("div", { display: "flex", flexDirection: "column", gap: "16px", width: "64%", background: BLUE, padding: "34px 34px 40px" }, [
    ...(input.eyebrow?.trim()
      ? [h("div", { display: "flex", alignSelf: "flex-start", background: "rgba(255,255,255,0.0)", border: `2px solid ${WHITE}`, color: WHITE, fontFamily: "Montserrat", fontWeight: 700, fontSize: "20px", letterSpacing: "1px", padding: "8px 18px", borderRadius: "999px" }, input.eyebrow.toUpperCase())]
      : []),
    ...(input.headline?.trim()
      ? [h("div", { display: "flex", background: WHITE, borderRadius: "12px", padding: "16px 20px", fontFamily: "Poppins", fontWeight: 800, fontSize: "32px", lineHeight: 1.06, color: BLUE }, input.headline.toUpperCase())]
      : []),
    h("div", { display: "flex", flexDirection: "column", gap: "8px", width: "100%" },
      bullets.map((b) => h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "25px", lineHeight: 1.22, color: WHITE }, `•  ${b}`))),
  ]);
  const coralPanel = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", width: "36%", background: CORAL, padding: "34px 30px" }, [
    h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "32px", lineHeight: 1.12, color: WHITE }, (input.coralTag ?? input.attribution ?? "").trim()),
  ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BLUE }, [
    h("div", { display: "flex", width: "100%", height: `${TOP_RESERVE}px`, background: WHITE }, []),
    h("div", { display: "flex", flexGrow: 1, width: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", flexDirection: "row", width: "100%" }, [bluePanel, coralPanel]),
  ]);
}

// YHEADER — a YELLOW header band (bold gray heading + optional blue accent line)
// over a photo, with a white caption footer. Matches the "1 setting" reference.
function yHeader(input: CscRenderInput, dataUri: string): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: WHITE }, [
    h("div", { display: "flex", width: "100%", height: `${TOP_RESERVE}px`, background: WHITE }, []),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px", width: "100%", background: YELLOW, padding: "34px 56px 38px" }, [
      ...(input.headline?.trim()
        ? [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "58px", lineHeight: 1.04, color: HEAD }, input.headline.toUpperCase())]
        : []),
      ...(input.headlineAccent?.trim()
        ? [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "58px", lineHeight: 1.04, color: BLUE }, input.headlineAccent.toUpperCase())]
        : []),
    ]),
    h("div", { display: "flex", flexGrow: 1, width: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", justifyContent: "center", alignItems: "center", width: "100%", background: WHITE, padding: `28px 56px ${FOOT_RESERVE}px` }, [
      ...(input.body?.trim() ? [h("div", { display: "flex", width: "92%", justifyContent: "center", textAlign: "center", fontFamily: "Poppins", fontWeight: 700, fontSize: "26px", lineHeight: 1.34, color: BODYGRAY }, input.body.trim())] : []),
    ]),
  ]);
}

// COMPARE — a "do this / not that" two-panel: a BLUE good column (✓) and a CORAL
// risky column (✗), each with a label + a few short points.
function compare(input: CscRenderInput, goodIcon: string, badIcon: string): El {
  const c = input.compare ?? { good: [], bad: [] };
  const col = (bg: string, icon: string, label: string, items: string[]) =>
    h("div", { display: "flex", flexDirection: "column", gap: "16px", width: "50%", height: "100%", background: bg, padding: "56px 40px" }, [
      h("div", { display: "flex", alignItems: "center", gap: "12px" }, [
        h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "56px", height: "56px", borderRadius: "999px", background: WHITE }, [img(icon, { width: "34px", height: "34px" })]),
        h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "34px", color: WHITE }, label.toUpperCase()),
      ]),
      h("div", { display: "flex", flexDirection: "column", gap: "12px" },
        items.slice(0, 4).map((t) => h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "26px", lineHeight: 1.26, color: WHITE }, t))),
    ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: LIGHTBLUE }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "14px", width: "100%", padding: `${TOP_RESERVE}px 60px 30px` }, [
      ...pill(input.eyebrow, BLUE, WHITE),
      ...heading(input.headline, HEAD, 56),
    ]),
    h("div", { display: "flex", flexDirection: "row", flexGrow: 1, width: "100%" }, [
      col(BLUE, goodIcon, c.goodLabel ?? "Do this", c.good),
      col(CORAL, badIcon, c.badLabel ?? "Not this", c.bad),
    ]),
  ]);
}

// STATEMENT — a bold full-card claim / myth-bust. Big bold heading centered on a
// solid ground, short reassuring body, soft CTA.
function statement(input: CscRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: BLUE, padding: `${TOP_RESERVE}px 80px ${FOOT_RESERVE + 24}px` }, [
    ...pill(input.eyebrow, YELLOW, BLUE),
    ...heading(input.headline, WHITE, 78, "96%"),
    ...bodyEl(input.body, NEARWHITE, 30),
    ...(input.cta?.trim() ? [h("div", { display: "flex", alignSelf: "center", background: YELLOW, color: BLUE, fontFamily: "Poppins", fontWeight: 800, fontSize: "26px", letterSpacing: "1px", padding: "16px 34px", borderRadius: "999px" }, input.cta.trim())] : []),
  ]);
}

// CHECK — a checkmark list (yellow check chips on a light ground). For "app
// checklist" style content.
function checklist(input: CscRenderInput, checkIcon: string): El {
  const items = (input.listItems ?? []).slice(0, 5);
  const row = (t: string) => h("div", { display: "flex", alignItems: "center", gap: "22px", width: "100%", background: WHITE, borderRadius: "18px", padding: "22px 28px" }, [
    h("div", { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: "52px", height: "52px", borderRadius: "999px", background: YELLOW }, [img(checkIcon, { width: "30px", height: "30px" })]),
    h("div", { display: "flex", width: "82%", fontFamily: "Poppins", fontWeight: 700, fontSize: "28px", lineHeight: 1.22, color: BODYGRAY }, t),
  ]);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "24px", width: "100%", height: "100%", background: LIGHTBLUE, padding: `${TOP_RESERVE}px 76px ${FOOT_RESERVE + 24}px` }, [
    ...pill(input.eyebrow, BLUE, WHITE),
    ...heading(input.headline, HEAD, 60),
    h("div", { display: "flex", flexDirection: "column", gap: "18px", width: "100%", marginTop: "6px" }, items.map((it) => row(it.text))),
    ...ctaEl(input.cta),
  ]);
}

function bigNumber(input: CscRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", width: "100%", height: "100%", background: YELLOW, padding: `${TOP_RESERVE}px 84px ${FOOT_RESERVE + 24}px` }, [
    ...pill(input.eyebrow, BLUE, WHITE),
    h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "320px", lineHeight: 0.95, color: BLUE }, input.bigStat ?? ""),
    ...heading(input.headline, HEAD, 58),
    ...bodyEl(input.body, HEAD),
    ...ctaEl(input.cta),
  ]);
}

function commandPhoto(input: CscRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", flexGrow: 1, width: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const band = h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", width: "100%", background: "rgba(5,122,192,0.92)", padding: `44px 70px ${FOOT_RESERVE}px` }, [
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
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "32px", width: "100%", height: "100%", background: BLUE, padding: `${TOP_RESERVE}px 84px ${FOOT_RESERVE + 24}px` }, [
    ...pill(input.eyebrow, WHITE, BLUE),
    stars,
    h("div", { display: "flex", width: "90%", justifyContent: "center", textAlign: "center", fontFamily: "Poppins", fontWeight: 800, fontSize: "46px", lineHeight: 1.22, color: WHITE }, input.quote ?? input.headline ?? ""),
    ...(input.attribution ? [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "28px", color: YELLOW }, `— ${input.attribution}`)] : []),
  ]);
}

export async function renderCscDesign(input: CscRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const toUri = async (buf: Buffer) => `data:image/jpeg;base64,${(await sharp(buf).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer()).toString("base64")}`;
  let root: El;
  if (input.archetype === "C") {
    root = commandPhoto(input, await toUri(input.photo as Buffer));
  } else if (input.archetype === "PHOTOSPLIT") {
    root = photoSplit(input, await toUri(input.photo as Buffer));
  } else if (input.archetype === "YHEADER") {
    root = yHeader(input, await toUri(input.photo as Buffer));
  } else if (input.archetype === "QUAD") {
    root = quad(input);
  } else if (input.archetype === "COMPARE") {
    root = compare(input, await iconUri("check", BLUE), await iconUri("cross", CORAL));
  } else if (input.archetype === "STATEMENT") {
    root = statement(input);
  } else if (input.archetype === "CHECK") {
    root = checklist(input, await iconUri("check", BLUE));
  } else if (input.archetype === "D") {
    root = bigNumber(input);
  } else if (input.archetype === "G") {
    root = await review(input);
  } else {
    root = steps(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function cscArchetypeNeedsPhoto(a: CscArchetype): boolean {
  return a === "C" || a === "PHOTOSPLIT" || a === "YHEADER";
}
