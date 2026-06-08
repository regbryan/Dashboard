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
  | "PHOTOBAND" | "TOPBAND" | "SPLIT" | "POLAROID" | "CHECK" | "NUMBER"
  // Photo-free but STRUCTURALLY distinct (not the centered-on-solid-card silhouette):
  | "EDITORIAL" | "SPLITBLOCK" | "PULLQUOTE"
  // Reference-matched templates (full-bleed photo, dense, footer):
  | "SIGNATURE" | "SIGBOTTOM" | "STATEMENT" | "CHECKLIST" | "ALTBARS"
  | "STEPS" | "VS" | "BIGSTAT";
export type StephanieHeadlineLine = { text: string; style: "serif" | "script" };
export type StephanieRenderInput = {
  archetype: StephanieArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headlineLines: StephanieHeadlineLine[];
  body?: string | null;
  cta?: string | null;
  listItems?: { lead?: string | null; text: string }[] | null;
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

function testimonialCardTree(input: StephanieRenderInput, heart: string): El {
  const quote = input.quote ?? input.headlineLines.map((l) => l.text).join(" ");
  const header = input.eyebrow?.trim() || "In Contract";
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: DEEP_BLUE }, [
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "30px", flexGrow: 1, width: "100%", padding: "70px 86px" }, [
      h("div", { display: "flex", fontFamily: "Allura", fontWeight: 400, fontSize: "104px", lineHeight: 0.9, color: SKY_BLUE }, header),
      h("div", { display: "flex", width: "88%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "48px", lineHeight: 1.32, color: WHITE }, quote),
      ...(input.attribution ? [h("div", { display: "flex", alignItems: "center", gap: "14px" }, [
        h("div", { display: "flex", width: "40px", height: "2px", background: SKY_BLUE }),
        h("div", { display: "flex", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", letterSpacing: "1px", color: ICE_BLUE }, input.attribution),
      ])] : []),
    ]),
    footerBar(heart),
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

async function heartUri(color: string): Promise<string> {
  const key = `heart-${color}`;
  if (!iconCache[key]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.55-10-9.28C.55 9 1.3 5.7 4.4 4.85c2.05-.56 3.86.5 4.95 2.02C10.45 5.35 12.25 4.3 14.3 4.85c3.1.85 3.85 4.15 2.4 6.87C19.5 16.45 12 21 12 21z" fill="${color}"/></svg>`;
    iconCache[key] = `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
  }
  return iconCache[key];
}

// White footer bar with the website — present on every reference design.
function footerBar(heart: string): El {
  return h("div", { display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", width: "100%", background: WHITE, padding: "24px 0" }, [
    h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "23px", letterSpacing: "0.5px", color: DEEP_BLUE }, "stephanieperezhomeloans.com"),
    img(heart, { width: "22px", height: "22px" }),
  ]);
}

// SIGNATURE — the brand's hero template (v2 references): a full-bleed lifestyle
// photo with people, a translucent deep-blue band across the TOP holding a big
// serif headline + a dense 2-3 line body, and the white website footer. Fills
// the frame edge to edge — no dead space.
function signatureTree(input: StephanieRenderInput, dataUri: string, heart: string): El {
  const body = input.body?.trim();
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", background: DEEP_BLUE }, [
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", width: "100%", background: "rgba(61,90,128,0.90)", padding: "60px 70px 50px" }, [
      h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", width: "100%" },
        input.headlineLines.map((l) => l.style === "script"
          ? h("div", { display: "flex", width: "100%", justifyContent: "center", textAlign: "center", fontFamily: "Allura", fontWeight: 400, fontSize: "74px", lineHeight: 1.0, color: ICE_BLUE }, l.text)
          : h("div", { display: "flex", width: "96%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "56px", lineHeight: 1.12, color: WHITE }, l.text))),
      ...(body ? [h("div", { display: "flex", width: "90%", justifyContent: "center", textAlign: "center", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", lineHeight: 1.45, color: ICE_BLUE }, body)] : []),
    ]),
    h("div", { display: "flex", flexGrow: 1, width: "100%" }),
    footerBar(heart),
  ]);
}

// CHECKLIST — a photo background under a soft white scrim, an "INSIDER TIP" tab,
// a big serif headline, then a staggered column of numbered cards (deep-blue
// number box + ice-blue bar with bold title + light subtitle), a deep-blue CTA
// button, and the footer. Dense and frame-filling.
function checklistTree(input: StephanieRenderInput, dataUri: string, heart: string): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const headlineText = input.headlineLines.filter((l) => l.style !== "script").map((l) => l.text).join(" ") || input.headlineLines.map((l) => l.text).join(" ");
  const eyebrowText = (input.eyebrow ?? "INSIDER TIP").toUpperCase();
  const rows = items.map((it, i) => {
    const numBox = h("div", { display: "flex", justifyContent: "center", alignItems: "center", width: "92px", height: "92px", background: DEEP_BLUE }, [
      h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "40px", color: WHITE }, String(i + 1).padStart(2, "0")),
    ]);
    const bar = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px", background: "rgba(224,251,252,0.94)", padding: "14px 26px", height: "92px" }, [
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "30px", color: DEEP_BLUE }, it.lead || it.text),
      ...(it.lead && it.text ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "24px", color: NEARBLACK }, it.text)] : []),
    ]);
    return h("div", { display: "flex", justifyContent: i % 2 === 0 ? "flex-start" : "flex-end", width: "100%" }, [
      h("div", { display: "flex", alignItems: "stretch", maxWidth: "78%" }, [numBox, bar]),
    ]);
  });
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", background: ICE_BLUE }, [
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", background: "rgba(255,255,255,0.80)" }),
    h("div", { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", flexGrow: 1, width: "100%", padding: "58px 64px 44px" }, [
      h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "22px", width: "100%" }, [
        h("div", { display: "flex", justifyContent: "center", alignItems: "center", background: DEEP_BLUE, padding: "10px 28px" }, [
          h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "26px", letterSpacing: "5px", color: WHITE }, eyebrowText),
        ]),
        h("div", { display: "flex", width: "98%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "58px", lineHeight: 1.1, color: NEARBLACK }, headlineText),
      ]),
      h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "20px", width: "100%", flexGrow: 1, padding: "26px 0px" }, rows),
      ...(input.cta?.trim() ? [h("div", { display: "flex", justifyContent: "center", alignItems: "center", background: DEEP_BLUE, padding: "18px 46px" }, [
        h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "28px", letterSpacing: "2px", color: WHITE }, input.cta.trim().toUpperCase()),
      ])] : []),
    ]),
    footerBar(heart),
  ]);
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

// ── Photo-free but STRUCTURALLY distinct layouts ──────────────────────────────
// These break the shared "centered text on a solid card" silhouette of C/CHECK/
// D/NUMBER/G so the all-text feed actually varies in SHAPE, not just wording.

const eyebrowLeft = (text: string | null | undefined, color: string): El[] =>
  text?.trim()
    ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "22px", letterSpacing: "6px", color }, text.toUpperCase())]
    : [];
const ctaLeft = (text: string | null | undefined, color: string): El[] =>
  text?.trim()
    ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "23px", letterSpacing: "3px", padding: "10px 4px", borderBottom: `2px solid ${color}`, color, marginTop: "8px" }, text.trim().toUpperCase())]
    : [];
const dashRows = (items: { text: string }[], dashColor: string, textColor: string): El =>
  h("div", { display: "flex", flexDirection: "column", gap: "16px", width: "100%" },
    items.map((it) => h("div", { display: "flex", alignItems: "flex-start", gap: "16px", width: "100%" }, [
      h("div", { display: "flex", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", color: dashColor, marginTop: "2px" }, "—"),
      h("div", { display: "flex", flexGrow: 1, fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "29px", lineHeight: 1.32, color: textColor }, it.text),
    ])));

// EDITORIAL — a sky-blue rail down the left edge, everything LEFT-ALIGNED and
// anchored, magazine-column feel. The opposite of the centered cards.
function editorialTree(input: StephanieRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const content = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "26px", flexGrow: 1, height: "100%", padding: "112px 92px 112px 78px" }, [
    ...eyebrowLeft(input.eyebrow, SKY_BLUE),
    headlineLeft(input.headlineLines, WHITE, SKY_BLUE, 66, 100),
    ...(input.body?.trim() ? [h("div", { display: "flex", width: "100%", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "31px", lineHeight: 1.46, color: ICE_BLUE }, input.body.trim())] : []),
    ...(items.length ? [dashRows(items, SKY_BLUE, WHITE)] : []),
    ...ctaLeft(input.cta, ICE_BLUE),
  ]);
  return h("div", { display: "flex", flexDirection: "row", width: "100%", height: "100%", background: DEEP_BLUE }, [
    h("div", { display: "flex", width: "18px", height: "100%", background: SKY_BLUE }),
    content,
  ]);
}

// SPLITBLOCK — a hard two-tone horizontal division: a deep-blue headline block on
// top, a warm cream content block below. Color-blocked, not a solid field.
function splitBlockTree(input: StephanieRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const top = h("div", { display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start", gap: "16px", width: "100%", height: "47%", background: DEEP_BLUE, padding: "0px 84px 50px" }, [
    ...eyebrowLeft(input.eyebrow, ICE_BLUE),
    headlineLeft(input.headlineLines, WHITE, ICE_BLUE, 60, 90),
  ]);
  const bottomBody = items.length
    ? [dashRows(items, DEEP_BLUE, NEARBLACK)]
    : (input.body?.trim() ? [h("div", { display: "flex", width: "100%", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "34px", lineHeight: 1.46, color: NEARBLACK }, input.body.trim())] : []);
  const bottom = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "26px", width: "100%", flexGrow: 1, background: CREAM, padding: "54px 84px 64px" }, [
    ...bottomBody,
    ...ctaLeft(input.cta, DEEP_BLUE),
  ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [top, bottom]);
}

// PULLQUOTE — an oversized editorial pull-quote: a giant serif quotation mark, a
// large left-aligned statement, attribution kicked to the lower right.
function pullQuoteTree(input: StephanieRenderInput): El {
  const quote = input.quote?.trim() || input.headlineLines.map((l) => l.text).join(" ");
  const tag = input.attribution?.trim() || input.eyebrow?.trim() || "";
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "4px", width: "100%", height: "100%", background: ICE_BLUE, padding: "96px 90px 104px" }, [
    h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "170px", lineHeight: 1.0, height: "120px", color: SKY_BLUE }, "“"),
    h("div", { display: "flex", width: "96%", fontFamily: "Playfair", fontWeight: 700, fontSize: "60px", lineHeight: 1.22, color: DEEP_BLUE }, quote),
    ...(tag ? [h("div", { display: "flex", alignItems: "center", gap: "16px", alignSelf: "flex-end", marginTop: "26px" }, [
      h("div", { display: "flex", width: "54px", height: "2px", background: DEEP_BLUE }),
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "24px", letterSpacing: "2px", color: DEEP_BLUE }, tag.toUpperCase()),
    ])] : []),
  ]);
}

// SIGBOTTOM — the photo+band signature with the band anchored at the BOTTOM
// (her "Rates have shifted." / "why I do what I do" personal posts).
function sigBottomTree(input: StephanieRenderInput, dataUri: string, heart: string): El {
  const body = input.body?.trim();
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", background: DEEP_BLUE }, [
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", flexGrow: 1, width: "100%" }),
    h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", width: "100%", background: "rgba(61,90,128,0.90)", padding: "52px 70px 44px" }, [
      h("div", { display: "flex", width: "96%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "56px", lineHeight: 1.12, color: WHITE }, input.headlineLines.map((l) => l.text).join(" ")),
      ...(body ? [h("div", { display: "flex", width: "90%", justifyContent: "center", textAlign: "center", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", lineHeight: 1.45, color: ICE_BLUE }, body)] : []),
    ]),
    footerBar(heart),
  ]);
}

// STATEMENT — a bold serif statement directly over a darkened full-bleed photo
// (no band). Big, editorial, cinematic.
function statementTree(input: StephanieRenderInput, dataUri: string, heart: string): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", background: DEEP_BLUE }, [
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", background: "rgba(20,32,54,0.58)" }),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "20px", flexGrow: 1, width: "100%", padding: "80px 80px" }, [
      ...eyebrow(input.eyebrow, true),
      h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "100%" },
        input.headlineLines.map((l) => l.style === "script"
          ? h("div", { display: "flex", width: "100%", justifyContent: "center", textAlign: "center", fontFamily: "Allura", fontWeight: 400, fontSize: "92px", lineHeight: 1.0, color: ICE_BLUE }, l.text)
          : h("div", { display: "flex", width: "92%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "72px", lineHeight: 1.14, color: WHITE }, l.text))),
      ...(input.body?.trim() ? [h("div", { display: "flex", width: "80%", justifyContent: "center", textAlign: "center", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "30px", lineHeight: 1.45, color: ICE_BLUE }, input.body.trim())] : []),
      ...softCta(input.cta, true),
    ]),
    footerBar(heart),
  ]);
}

// ALTBARS — a photo background, a headline on a dark top scrim, then FULL-WIDTH
// numbered bars that alternate color (sky / white / navy) and number side
// (her "4 Credit Score Myths Exposed" look). Bolder than the staggered checklist.
function altBarsTree(input: StephanieRenderInput, dataUri: string, heart: string): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const headlineText = input.headlineLines.filter((l) => l.style !== "script").map((l) => l.text).join(" ") || input.headlineLines.map((l) => l.text).join(" ");
  const palette = [
    { bg: SKY_BLUE, num: WHITE, title: WHITE, sub: "#EAF4FA" },
    { bg: "rgba(255,255,255,0.94)", num: DEEP_BLUE, title: DEEP_BLUE, sub: NEARBLACK },
    { bg: DEEP_BLUE, num: WHITE, title: WHITE, sub: ICE_BLUE },
    { bg: "rgba(255,255,255,0.94)", num: DEEP_BLUE, title: DEEP_BLUE, sub: NEARBLACK },
  ];
  const bars = items.map((it, i) => {
    const c = palette[i % 4];
    const numEl = h("div", { display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "46px", color: c.num, width: "96px" }, String(i + 1).padStart(2, "0"));
    const txt = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px", flexGrow: 1, alignItems: i % 2 === 0 ? "flex-start" : "flex-end" }, [
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "30px", color: c.title, textAlign: i % 2 === 0 ? "left" : "right" }, it.lead || it.text),
      ...(it.lead && it.text ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "23px", color: c.sub, textAlign: i % 2 === 0 ? "left" : "right" }, it.text)] : []),
    ]);
    return h("div", { display: "flex", alignItems: "center", gap: "20px", width: "92%", height: "104px", background: c.bg, padding: "0 24px", alignSelf: i % 2 === 0 ? "flex-start" : "flex-end" }, i % 2 === 0 ? [numEl, txt] : [txt, numEl]);
  });
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative", background: DEEP_BLUE }, [
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", background: "rgba(34,46,68,0.46)" }),
    h("div", { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: "12px", width: "100%", padding: "58px 50px 26px" }, [
      h("div", { display: "flex", width: "96%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "56px", lineHeight: 1.1, color: WHITE }, headlineText),
    ]),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px", flexGrow: 1, width: "100%", padding: "12px 40px 30px" }, bars),
    footerBar(heart),
  ]);
}

// VS — a two-column comparison (e.g. "Pre-Qualification | Pre-Approval"), a deep-
// blue column beside a sky column, with the headline above. Uses the first two
// list items as the two options (lead = the option name, text = the description).
function vsTree(input: StephanieRenderInput, heart: string): El {
  const items = (input.listItems ?? []).slice(0, 2);
  const headlineText = input.headlineLines.filter((l) => l.style !== "script").map((l) => l.text).join(" ") || input.headlineLines.map((l) => l.text).join(" ");
  const col = (it: { lead?: string | null; text: string } | undefined, bg: string, headerBg: string, labelColor: string, txtColor: string) =>
    h("div", { display: "flex", flexDirection: "column", width: "50%", height: "100%", background: bg }, [
      h("div", { display: "flex", justifyContent: "center", alignItems: "center", width: "100%", padding: "44px 28px", background: headerBg }, [
        h("div", { display: "flex", textAlign: "center", justifyContent: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "38px", lineHeight: 1.12, color: labelColor }, it?.lead || ""),
      ]),
      h("div", { display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", flexGrow: 1, padding: "60px 42px" }, [
        h("div", { display: "flex", textAlign: "center", justifyContent: "center", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "31px", lineHeight: 1.5, color: txtColor }, it?.text || ""),
      ]),
    ]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: WHITE }, [
    h("div", { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", padding: "52px 64px 28px" }, [
      ...eyebrow(input.eyebrow, false),
      h("div", { display: "flex", width: "96%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "50px", lineHeight: 1.12, color: DEEP_BLUE }, headlineText),
    ]),
    h("div", { display: "flex", flexDirection: "row", flexGrow: 1, width: "100%" }, [
      col(items[0], DEEP_BLUE, "rgba(0,0,0,0.16)", WHITE, ICE_BLUE),
      col(items[1], ICE_BLUE, SKY_BLUE, DEEP_BLUE, NEARBLACK),
    ]),
    footerBar(heart),
  ]);
}

// STEPS — a clean ice-blue process card: headline, then a vertical numbered path
// with a sky-blue connecting line tying the round chips together. No photo.
function stepsTree(input: StephanieRenderInput, heart: string): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const headlineText = input.headlineLines.filter((l) => l.style !== "script").map((l) => l.text).join(" ") || input.headlineLines.map((l) => l.text).join(" ");
  const rows = items.map((it, i) => h("div", { display: "flex", alignItems: "center", gap: "26px", width: "100%" }, [
    h("div", { display: "flex", justifyContent: "center", alignItems: "center", width: "78px", height: "78px", borderRadius: "39px", background: DEEP_BLUE, border: `4px solid ${ICE_BLUE}`, fontFamily: "Playfair", fontWeight: 700, fontSize: "36px", color: WHITE }, String(i + 1)),
    h("div", { display: "flex", flexDirection: "column", gap: "2px", flexGrow: 1 }, [
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "32px", color: DEEP_BLUE }, it.lead || it.text),
      ...(it.lead && it.text ? [h("div", { display: "flex", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "27px", color: NEARBLACK }, it.text)] : []),
    ]),
  ]));
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: ICE_BLUE }, [
    h("div", { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, width: "100%", padding: "56px 80px 44px" }, [
      h("div", { display: "flex", width: "96%", justifyContent: "center", textAlign: "center", fontFamily: "Playfair", fontWeight: 700, fontSize: "56px", lineHeight: 1.12, color: DEEP_BLUE, marginBottom: "46px" }, headlineText),
      h("div", { display: "flex", flexDirection: "row", width: "100%", flexGrow: 1 }, [
        // connecting line behind the chips
        h("div", { display: "flex", flexDirection: "column", alignItems: "center", width: "78px" }, [
          h("div", { display: "flex", width: "4px", flexGrow: 1, background: SKY_BLUE, marginTop: "30px", marginBottom: "30px" }),
        ]),
        h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "34px", flexGrow: 1, marginLeft: "-78px", width: "100%" }, rows),
      ]),
    ]),
    footerBar(heart),
  ]);
}

// BIGSTAT — a photo on top, an ice-blue panel below with a large serif numeral +
// label + body. A bold stat moment (rates, percentages, "0% down").
function bigStatTree(input: StephanieRenderInput, dataUri: string, heart: string): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: ICE_BLUE }, [
    h("div", { display: "flex", width: "100%", height: "54%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "10px", flexGrow: 1, width: "100%", padding: "26px 70px" }, [
      ...eyebrow(input.eyebrow, false),
      h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "138px", lineHeight: 1.0, color: DEEP_BLUE }, input.bigStat ?? ""),
      h("div", { display: "flex", width: "88%", justifyContent: "center", textAlign: "center", fontFamily: "PlayfairLight", fontWeight: 400, fontSize: "29px", lineHeight: 1.4, color: NEARBLACK }, (input.headlineLines[0]?.text ? input.headlineLines[0].text + (input.body ? " — " + input.body : "") : input.body) ?? ""),
    ]),
    footerBar(heart),
  ]);
}

export async function renderStephanieDesign(input: StephanieRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const toUri = async (buf: Buffer) => `data:image/jpeg;base64,${(await sharp(buf).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer()).toString("base64")}`;
  const a = input.archetype;
  let root: El;
  if (a === "SIGNATURE" || a === "SIGBOTTOM" || a === "STATEMENT" || a === "CHECKLIST" || a === "ALTBARS" || a === "BIGSTAT" || a === "A" || a === "PHOTOBAND" || a === "TOPBAND" || a === "SPLIT" || a === "POLAROID") {
    const uri = await toUri(input.photo as Buffer);
    const heart = await heartUri(DEEP_BLUE);
    root =
      a === "SIGNATURE" ? signatureTree(input, uri, heart)
      : a === "SIGBOTTOM" ? sigBottomTree(input, uri, heart)
      : a === "STATEMENT" ? statementTree(input, uri, heart)
      : a === "CHECKLIST" ? checklistTree(input, uri, heart)
      : a === "ALTBARS" ? altBarsTree(input, uri, heart)
      : a === "BIGSTAT" ? bigStatTree(input, uri, heart)
      : a === "PHOTOBAND" ? photoBandTree(input, uri)
      : a === "TOPBAND" ? topBandTree(input, uri)
      : a === "SPLIT" ? splitTree(input, uri, await checkUri(ICE_BLUE))
      : a === "POLAROID" ? polaroidTree(input, uri)
      : photoOverlayCardTree(input, uri);
  } else if (a === "VS") {
    root = vsTree(input, await heartUri(DEEP_BLUE));
  } else if (a === "STEPS") {
    root = stepsTree(input, await heartUri(DEEP_BLUE));
  } else if (a === "D") {
    root = quoteCardTree(input);
  } else if (a === "G") {
    root = testimonialCardTree(input, await heartUri(DEEP_BLUE));
  } else if (a === "CHECK") {
    root = checkCardTree(input, await checkUri(ICE_BLUE));
  } else if (a === "NUMBER") {
    root = numberCardTree(input);
  } else if (a === "EDITORIAL") {
    root = editorialTree(input);
  } else if (a === "SPLITBLOCK") {
    root = splitBlockTree(input);
  } else if (a === "PULLQUOTE") {
    root = pullQuoteTree(input);
  } else {
    root = valuesCardTree(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export function stephanieArchetypeNeedsPhoto(a: StephanieArchetype): boolean {
  return a === "SIGNATURE" || a === "SIGBOTTOM" || a === "STATEMENT" || a === "CHECKLIST" || a === "ALTBARS" || a === "BIGSTAT" || a === "A" || a === "PHOTOBAND" || a === "TOPBAND" || a === "SPLIT" || a === "POLAROID";
}
