import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic renderer for BLITZ ORGANIZATION. Soft, feminine, airy — dusty
// rose #ECB7B9 + sage #9CAF9C + warm beige on cream. CASUAL handwritten SCRIPT
// (Caveat) carries the emotional hook; LIGHT clean sans (Montserrat) carries the
// information; a sage/rose HIGHLIGHTER swash sits under a headline word; numbered
// ROUNDED BARS (alternating rose/sage) are the signature list. Photos are of
// organized SPACES (never people). Logo/wordmark composited later.

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
const PINKBG = "#FCEEF0"; // soft pink ground (the "5 things" / bars background)
const WHITE = "#FFFFFF";
const CHARCOAL = "#454545";
const NEARWHITE = "#FBF8F4";

export type BlitzArchetype =
  | "A" | "C" | "D" | "G"
  | "PHOTOPANEL" | "QUAD" | "COMPARE" | "CHECK" | "STATEMENT" | "STAT";
export type BlitzHeadlineLine = { text: string; style: "script" | "sans" };
export type BlitzRenderInput = {
  archetype: BlitzArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headlineLines: BlitzHeadlineLine[];
  body?: string | null;
  cta?: string | null;
  listItems?: { number?: string | null; lead?: string | null; text: string }[] | null;
  quadItems?: { heading: string; text: string }[] | null;
  compare?: { keepLabel?: string; keep: string[]; tossLabel?: string; toss: string[] } | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo?: Buffer | null;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({ type, props: { style, children } });
const img = (src: string, style: Record<string, unknown>): El => ({ type: "img", props: { src, style } });

// Check / cross marks as drawn SVG (the fonts have no ✓/✕ glyph).
const iconCache: Record<string, string> = {};
async function iconUri(kind: "check" | "cross", color: string): Promise<string> {
  const key = `${kind}:${color}`;
  if (!iconCache[key]) {
    const d = kind === "check" ? "M4 12.5l5 5L20 6.5" : "M6 6l12 12M18 6L6 18";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path d="${d}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    iconCache[key] = `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
  }
  return iconCache[key];
}

// Sage pill, charcoal spaced label.
function eyebrow(text: string | null | undefined, bg = SAGE): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: bg, color: CHARCOAL, fontFamily: "Montserrat", fontWeight: 700, fontSize: "22px", letterSpacing: "4px", padding: "11px 26px", borderRadius: "999px" }, text.toUpperCase())];
}

// Script hook (Caveat, the focal point) + a sans line on a HIGHLIGHTER swash.
function headline(lines: BlitzHeadlineLine[], scriptSize: number, sansSize: number, highlight = SAGE): El {
  return h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "100%" },
    lines.map((l) => l.style === "script"
      ? h("div", { display: "flex", width: "100%", justifyContent: "center", textAlign: "center", fontFamily: "Caveat", fontWeight: 700, fontSize: `${scriptSize}px`, lineHeight: 1.0, color: CHARCOAL }, l.text)
      : h("div", { display: "flex", alignSelf: "center", background: highlight, borderRadius: "8px", padding: "2px 16px", fontFamily: "Montserrat", fontWeight: 700, fontSize: `${sansSize}px`, lineHeight: 1.24, color: CHARCOAL }, l.text)));
}

function bodyEl(text: string | null | undefined, color = CHARCOAL): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width: "84%", alignSelf: "center", justifyContent: "center", textAlign: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: "27px", lineHeight: 1.45, color }, text.trim())];
}

function softCta(text: string | null | undefined): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: ROSE, color: CHARCOAL, fontFamily: "Montserrat", fontWeight: 700, fontSize: "25px", letterSpacing: "1px", padding: "15px 36px", borderRadius: "999px" }, text.trim())];
}

// PHOTO HERO (A) — organized-space photo on top, a cream panel beneath with the
// script hook + soft CTA.
function photoHeroTree(input: BlitzRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", width: "100%", height: "56%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const panel = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "22px", flexGrow: 1, width: "100%", background: CREAM, padding: "48px 84px 96px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 92, 40),
    ...softCta(input.cta),
  ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [photo, panel]);
}

// BARS (C) — the signature numbered list: alternating rose/sage rounded bars with
// a big white number + bold lead + light detail, alternating left/right. Pink
// ground, sage eyebrow, script + highlighter headline, soft CTA.
function barsTree(input: BlitzRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 5);
  const bar = (it: { number?: string | null; lead?: string | null; text: string }, i: number) => {
    const bg = i % 2 === 0 ? ROSE : SAGE;
    const num = h("div", { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: "104px", fontFamily: "Montserrat", fontWeight: 700, fontSize: "72px", lineHeight: 1, color: WHITE }, it.number ?? String(i + 1).padStart(2, "0"));
    const textCol = h("div", { display: "flex", flexDirection: "column", gap: "2px", flexGrow: 1 }, [
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "34px", lineHeight: 1.08, color: WHITE }, it.lead?.trim() || it.text),
      ...(it.lead?.trim() && it.text?.trim()
        ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "25px", lineHeight: 1.2, color: NEARWHITE }, it.text)]
        : []),
    ]);
    const kids = i % 2 === 0 ? [num, textCol] : [textCol, num];
    return h("div", { display: "flex", alignItems: "center", gap: "22px", width: "100%", background: bg, borderRadius: "22px", padding: "22px 34px" }, kids);
  };
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "26px", width: "100%", height: "100%", background: PINKBG, padding: "92px 70px 96px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 96, 42),
    h("div", { display: "flex", flexDirection: "column", gap: "20px", width: "100%", marginTop: "6px" }, items.map(bar)),
    ...softCta(input.cta),
  ]);
}

// QUESTION CARD (D) — a casual script question + reassuring body.
function questionCardTree(input: BlitzRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", width: "100%", height: "100%", background: CREAM, padding: "110px 88px 120px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 116, 42),
    ...bodyEl(input.body),
    ...softCta(input.cta),
  ]);
}

// TESTIMONIAL (G) — a warm client quote on rose.
function testimonialTree(input: BlitzRenderInput): El {
  const quote = input.quote ?? input.headlineLines.map((l) => l.text).join(" ");
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "28px", width: "100%", height: "100%", background: ROSE, padding: "104px 88px 116px" }, [
    h("div", { display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: "150px", lineHeight: 0.6, color: WHITE }, "“"),
    h("div", { display: "flex", width: "88%", justifyContent: "center", textAlign: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: "40px", lineHeight: 1.4, color: CHARCOAL }, quote),
    ...(input.attribution ? [h("div", { display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: "56px", color: WHITE }, input.attribution)] : []),
  ]);
}

// PHOTOPANEL — an organized-space photo with a dusty-rose question panel beneath
// (the "what's the best way to maintain…" reference).
function photoPanelTree(input: BlitzRenderInput, dataUri: string): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: ROSE }, [
    h("div", { display: "flex", width: "100%", height: "46%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "20px", flexGrow: 1, width: "100%", background: ROSE, padding: "50px 76px 96px" }, [
      ...(input.headlineLines.length
        ? [h("div", { display: "flex", flexDirection: "column", gap: "6px", width: "100%" },
            input.headlineLines.map((l) => l.style === "script"
              ? h("div", { display: "flex", fontFamily: "Caveat", fontWeight: 700, fontSize: "78px", lineHeight: 1.0, color: CHARCOAL }, l.text)
              : h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "40px", lineHeight: 1.18, color: CHARCOAL }, l.text)))]
        : []),
      ...(input.body?.trim()
        ? [h("div", { display: "flex", width: "100%", fontFamily: "Montserrat", fontWeight: 400, fontSize: "27px", lineHeight: 1.5, color: CHARCOAL }, input.body.trim())]
        : []),
    ]),
  ]);
}

// QUAD — a 2x2 grid of soft cards (alternating rose/sage tints) for "zones / areas
// / tips" content.
function quadTree(input: BlitzRenderInput): El {
  const items = (input.quadItems ?? []).slice(0, 4);
  const tints = ["#F6DCDE", "#DCE6DC", "#DCE6DC", "#F6DCDE"];
  const card = (it: { heading: string; text: string }, i: number) =>
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", width: "47%", flexGrow: 1, background: tints[i % 4], borderRadius: "20px", padding: "32px 30px" }, [
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "32px", lineHeight: 1.1, color: CHARCOAL }, it.heading),
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "24px", lineHeight: 1.3, color: CHARCOAL }, it.text),
    ]);
  return h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", width: "100%", height: "100%", background: CREAM, padding: "90px 70px 96px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 88, 40),
    h("div", { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignContent: "stretch", gap: "22px", width: "100%", flexGrow: 1, marginTop: "8px" }, items.map(card)),
    ...softCta(input.cta),
  ]);
}

// COMPARE — a "keep / toss" two-panel (sage keep ✓ / rose toss ✕).
function compareTree(input: BlitzRenderInput, keepIcon: string, tossIcon: string): El {
  const c = input.compare ?? { keep: [], toss: [] };
  const col = (bg: string, icon: string, label: string, items: string[]) =>
    h("div", { display: "flex", flexDirection: "column", gap: "16px", width: "50%", height: "100%", background: bg, padding: "54px 40px" }, [
      h("div", { display: "flex", alignItems: "center", gap: "12px" }, [
        h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "52px", height: "52px", borderRadius: "999px", background: WHITE }, [img(icon, { width: "30px", height: "30px" })]),
        h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "34px", color: WHITE }, label.toUpperCase()),
      ]),
      h("div", { display: "flex", flexDirection: "column", gap: "12px" },
        items.slice(0, 5).map((t) => h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "26px", lineHeight: 1.26, color: WHITE }, t))),
    ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "12px", width: "100%", padding: "90px 60px 30px" }, [
      ...eyebrow(input.eyebrow),
      headline(input.headlineLines, 92, 40),
    ]),
    h("div", { display: "flex", flexDirection: "row", flexGrow: 1, width: "100%" }, [
      col(SAGE, keepIcon, c.keepLabel ?? "Keep", c.keep),
      col(ROSE, tossIcon, c.tossLabel ?? "Toss", c.toss),
    ]),
  ]);
}

// CHECK — a soft checklist (sage checks on cream).
function checkTree(input: BlitzRenderInput, checkIcon: string): El {
  const items = (input.listItems ?? []).slice(0, 5);
  const row = (t: string) => h("div", { display: "flex", alignItems: "center", gap: "20px", width: "100%", background: WHITE, borderRadius: "18px", padding: "22px 28px" }, [
    h("div", { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: "48px", height: "48px", borderRadius: "999px", background: SAGE }, [img(checkIcon, { width: "26px", height: "26px" })]),
    h("div", { display: "flex", width: "82%", fontFamily: "Montserrat", fontWeight: 400, fontSize: "28px", lineHeight: 1.22, color: CHARCOAL }, t),
  ]);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "24px", width: "100%", height: "100%", background: PINKBG, padding: "92px 76px 100px" }, [
    ...eyebrow(input.eyebrow),
    headline(input.headlineLines, 92, 40),
    h("div", { display: "flex", flexDirection: "column", gap: "16px", width: "100%", marginTop: "6px" }, items.map((it) => row(it.text))),
    ...softCta(input.cta),
  ]);
}

// STATEMENT — a soft, bold encouragement / myth-soften on rose (e.g. "Clutter
// isn't a character flaw.").
function statementTree(input: BlitzRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "28px", width: "100%", height: "100%", background: ROSE, padding: "104px 84px 116px" }, [
    ...eyebrow(input.eyebrow, WHITE),
    headline(input.headlineLines, 124, 44, WHITE),
    ...bodyEl(input.body, CHARCOAL),
    ...softCta(input.cta),
  ]);
}

// STAT — a soft big number (e.g. the "3-bin rule"): rose numeral on cream.
function statTree(input: BlitzRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "16px", width: "100%", height: "100%", background: CREAM, padding: "104px 84px 116px" }, [
    ...eyebrow(input.eyebrow),
    h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "300px", lineHeight: 0.95, color: ROSE }, input.bigStat ?? ""),
    headline(input.headlineLines, 96, 42),
    ...bodyEl(input.body),
    ...softCta(input.cta),
  ]);
}

export async function renderBlitzDesign(input: BlitzRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const toUri = async (buf: Buffer) => `data:image/jpeg;base64,${(await sharp(buf).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer()).toString("base64")}`;
  const a = input.archetype;
  let root: El;
  if (a === "A") {
    root = photoHeroTree(input, await toUri(input.photo as Buffer));
  } else if (a === "PHOTOPANEL") {
    root = photoPanelTree(input, await toUri(input.photo as Buffer));
  } else if (a === "C") {
    root = barsTree(input);
  } else if (a === "D") {
    root = questionCardTree(input);
  } else if (a === "QUAD") {
    root = quadTree(input);
  } else if (a === "COMPARE") {
    root = compareTree(input, await iconUri("check", SAGE), await iconUri("cross", ROSE));
  } else if (a === "CHECK") {
    root = checkTree(input, await iconUri("check", WHITE));
  } else if (a === "STATEMENT") {
    root = statementTree(input);
  } else if (a === "STAT") {
    root = statTree(input);
  } else {
    root = testimonialTree(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function blitzArchetypeNeedsPhoto(a: BlitzArchetype): boolean {
  return a === "A" || a === "PHOTOPANEL";
}
