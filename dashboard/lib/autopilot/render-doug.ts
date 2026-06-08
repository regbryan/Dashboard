import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, full-bleed renderer for DOUG MITCHELL (Scale LLP). Quiet,
// corporate-restrained LinkedIn thought-leadership — LANDSCAPE 16:9 to match his
// v2 reference designs: a corporate/architectural PHOTO under a teal scrim with a
// teal pill eyebrow + bold white headline, plus text-forward variants on solid
// teal. Teal-charcoal #1F5560 + cream-mint #D8EBE5, NO accent color (the restraint
// IS the brand). Display sans only (Montserrat). The SCALE LLP + "Doug Mitchell,
// Partner" lockup is NEVER drawn here (overlaid later) — a clean top-left zone is
// reserved for it.

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
const TEAL_DK = "#15393F";
const MINT = "#D8EBE5";
const MINT_MUTED = "#A7C5BF";
const WHITE = "#FFFFFF";

const W = 1280;
const H = 720; // 16:9 LinkedIn landscape
const LOGO_ZONE = 96; // clean top-left reserve for the SCALE LLP / Doug Mitchell lockup overlay

export type DougArchetype =
  | "PHOTO" | "PANEL" | "SPLIT" | "WARSTORY" | "TITLE"
  | "LIST" | "FRAMEWORK" | "STAT" | "CONTRAST" | "MINT";
export type DougRenderInput = {
  archetype: DougArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headline?: string | null;
  subtitle?: string | null;
  listItems?: { lead?: string | null; text: string }[] | null;
  bigStat?: string | null;
  quote?: string | null;
  photo?: Buffer | null;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({ type, props: { style, children } });
const img = (src: string, style: Record<string, unknown>): El => ({ type: "img", props: { src, style } });

// Teal pill eyebrow with white caps text.
function pill(text: string | null | undefined, bg = TEAL, color = WHITE): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "flex-start", background: bg, color, fontFamily: "Montserrat", fontWeight: 700, fontSize: "22px", letterSpacing: "3px", padding: "11px 22px" }, text.toUpperCase())];
}
function headingEl(text: string | null | undefined, color: string, size: number, width = "86%"): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width, fontFamily: "Montserrat", fontWeight: 700, fontSize: `${size}px`, lineHeight: 1.1, letterSpacing: "0.5px", color, textTransform: "uppercase" }, text.trim())];
}
function subtitleEl(text: string | null | undefined, color: string, width = "82%"): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", width, fontFamily: "MontserratBody", fontWeight: 400, fontSize: "27px", lineHeight: 1.38, color }, text.trim())];
}
function logoReserve(): El {
  return h("div", { display: "flex", width: "100%", height: `${LOGO_ZONE}px` }, []);
}

// PHOTO_TITLE (A) — corporate photo + teal scrim + pill + bold white headline.
function photoTitle(input: DougRenderInput, dataUri: string): El {
  return h("div", { display: "flex", position: "relative", width: "100%", height: "100%", background: TEAL }, [
    img(dataUri, { position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", objectFit: "cover" }),
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", background: "rgba(21,57,63,0.72)" }, []),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "64px 72px" }, [
      logoReserve(),
      h("div", { display: "flex", flexDirection: "column", gap: "20px", width: "100%" }, [
        ...pill(input.eyebrow),
        ...headingEl(input.headline, WHITE, 58),
        ...subtitleEl(input.subtitle, MINT),
      ]),
    ]),
  ]);
}

// PANEL — corporate photo (visible) + a solid teal panel block over it holding the
// headline + subtitle (the "100 Deals Closed" reference look).
function panelCard(input: DougRenderInput, dataUri: string): El {
  return h("div", { display: "flex", position: "relative", justifyContent: "flex-start", alignItems: "center", width: "100%", height: "100%", background: TEAL }, [
    img(dataUri, { position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", objectFit: "cover" }),
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", background: "rgba(21,57,63,0.28)" }, []),
    h("div", { display: "flex", flexDirection: "column", gap: "18px", maxWidth: "72%", background: TEAL, padding: "44px 52px", marginLeft: "72px" }, [
      ...pill(input.eyebrow, TEAL_DK),
      ...headingEl(input.headline, WHITE, 54, "100%"),
      ...subtitleEl(input.subtitle, MINT, "100%"),
    ]),
  ]);
}

// SPLIT — photo left, solid teal panel right with the full text block.
function splitCard(input: DougRenderInput, dataUri: string): El {
  const photo = h("div", { display: "flex", width: "46%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const panel = h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "54%", height: "100%", background: TEAL, padding: "60px 60px" }, [
    logoReserve(),
    h("div", { display: "flex", flexDirection: "column", gap: "18px", width: "100%" }, [
      ...pill(input.eyebrow, TEAL_DK),
      ...headingEl(input.headline, WHITE, 50, "100%"),
      ...subtitleEl(input.subtitle, MINT, "100%"),
    ]),
  ]);
  return h("div", { display: "flex", flexDirection: "row", width: "100%", height: "100%", background: TEAL }, [photo, panel]);
}

// WAR-STORY (G) — dark photo + big white hook headline + WAR STORY pill.
function warStory(input: DougRenderInput, dataUri: string): El {
  const hook = input.quote?.trim() || input.headline || "";
  return h("div", { display: "flex", position: "relative", width: "100%", height: "100%", background: TEAL_DK }, [
    img(dataUri, { position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", objectFit: "cover" }),
    h("div", { display: "flex", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", background: "rgba(12,30,34,0.82)" }, []),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "64px 72px" }, [
      logoReserve(),
      h("div", { display: "flex", flexDirection: "column", gap: "22px", width: "100%" }, [
        ...headingEl(hook, WHITE, 56, "90%"),
        ...pill(input.eyebrow || "War Story"),
      ]),
    ]),
  ]);
}

// TITLE (default) — text-only teal title card (no photo).
function titleCard(input: DougRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: TEAL, padding: "64px 72px" }, [
    logoReserve(),
    h("div", { display: "flex", flexDirection: "column", gap: "20px", width: "100%" }, [
      ...pill(input.eyebrow, TEAL_DK),
      ...headingEl(input.headline, WHITE, 58),
      ...subtitleEl(input.subtitle, MINT),
    ]),
  ]);
}

// MINT — inverted light insight card (mint bg, teal text).
function mintCard(input: DougRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: MINT, padding: "64px 72px" }, [
    logoReserve(),
    h("div", { display: "flex", flexDirection: "column", gap: "20px", width: "100%" }, [
      ...pill(input.eyebrow, TEAL, WHITE),
      ...headingEl(input.headline, TEAL, 58),
      ...subtitleEl(input.subtitle, "#3A6068"),
    ]),
  ]);
}

// D — list card (teal bg, headline + numbered advisory points).
function listCard(input: DougRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 4);
  const rows = items.map((it, i) => h("div", { display: "flex", alignItems: "flex-start", gap: "20px", width: "100%" }, [
    h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "30px", color: MINT_MUTED }, String(i + 1).padStart(2, "0")),
    h("div", { display: "flex", flexGrow: 1, fontFamily: "MontserratBody", fontWeight: 400, fontSize: "28px", lineHeight: 1.3, color: MINT }, it.lead?.trim() ? `${it.lead}. ${it.text}` : it.text),
  ]));
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "40px", width: "100%", height: "100%", background: TEAL, padding: "60px 72px" }, [
    h("div", { display: "flex", flexDirection: "column", gap: "16px", width: "100%" }, [...pill(input.eyebrow, TEAL_DK), ...headingEl(input.headline, WHITE, 46)]),
    h("div", { display: "flex", flexDirection: "column", gap: "18px", width: "100%" }, rows),
  ]);
}

// FRAMEWORK — numbered framework (number + bold lead + muted detail), 3 across.
function frameworkCard(input: DougRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 3);
  const col = (it: { lead?: string | null; text: string }, i: number) =>
    h("div", { display: "flex", flexDirection: "column", gap: "12px", width: "31%", flexGrow: 1 }, [
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "44px", color: MINT_MUTED }, String(i + 1).padStart(2, "0")),
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "30px", lineHeight: 1.12, color: WHITE }, it.lead?.trim() || it.text),
      ...(it.lead?.trim() && it.text?.trim() ? [h("div", { display: "flex", fontFamily: "MontserratBody", fontWeight: 400, fontSize: "23px", lineHeight: 1.32, color: MINT }, it.text)] : []),
    ]);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "54px", width: "100%", height: "100%", background: TEAL, padding: "60px 72px" }, [
    h("div", { display: "flex", flexDirection: "column", gap: "16px", width: "100%" }, [...pill(input.eyebrow, TEAL_DK), ...headingEl(input.headline, WHITE, 46)]),
    h("div", { display: "flex", flexDirection: "row", gap: "34px", width: "100%" }, items.map(col)),
  ]);
}

// STAT — big mint numeral stacked over a supporting line (teal bg).
function statCard(input: DougRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", width: "100%", height: "100%", background: TEAL, padding: "60px 72px" }, [
    h("div", { display: "flex", flexDirection: "column", gap: "16px", marginBottom: "8px" }, pill(input.eyebrow, TEAL_DK)),
    h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "180px", lineHeight: 0.92, color: MINT }, input.bigStat ?? ""),
    ...headingEl(input.headline, WHITE, 44, "92%"),
    ...subtitleEl(input.subtitle, MINT, "80%"),
  ]);
}

// CONTRAST — the belief (muted) vs the reality (bold), two columns on teal.
function contrastCard(input: DougRenderInput): El {
  const belief = input.subtitle?.trim();
  const reality = input.headline?.trim();
  const colEl = (label: string, text: string | undefined, labelColor: string, textColor: string, weight: 400 | 700) =>
    h("div", { display: "flex", flexDirection: "column", gap: "14px", width: "44%" }, [
      h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "22px", letterSpacing: "3px", color: labelColor }, label),
      ...(text ? [h("div", { display: "flex", fontFamily: weight === 700 ? "Montserrat" : "MontserratBody", fontWeight: weight, fontSize: "36px", lineHeight: 1.22, color: textColor }, text)] : []),
    ]);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "44px", width: "100%", height: "100%", background: TEAL, padding: "60px 72px" }, [
    h("div", { display: "flex", flexDirection: "column", gap: "16px" }, pill(input.eyebrow, TEAL_DK)),
    h("div", { display: "flex", flexDirection: "row", alignItems: "center", gap: "40px", width: "100%" }, [
      colEl("THE BELIEF", belief, MINT_MUTED, MINT, 400),
      h("div", { display: "flex", width: "3px", height: "180px", background: MINT_MUTED }, []),
      colEl("THE REALITY", reality, WHITE, WHITE, 700),
    ]),
  ]);
}

export async function renderDougDesign(input: DougRenderInput): Promise<Buffer> {
  const outWidth = input.width ?? W;
  const toUri = async (buf: Buffer) => `data:image/jpeg;base64,${(await sharp(buf).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer()).toString("base64")}`;
  const a = input.archetype;
  let root: El;
  if (a === "PHOTO" || a === "PANEL" || a === "SPLIT" || a === "WARSTORY") {
    const uri = await toUri(input.photo as Buffer);
    root =
      a === "PANEL" ? panelCard(input, uri)
      : a === "SPLIT" ? splitCard(input, uri)
      : a === "WARSTORY" ? warStory(input, uri)
      : photoTitle(input, uri);
  } else if (a === "LIST") {
    root = listCard(input);
  } else if (a === "FRAMEWORK") {
    root = frameworkCard(input);
  } else if (a === "STAT") {
    root = statCard(input);
  } else if (a === "CONTRAST") {
    root = contrastCard(input);
  } else if (a === "MINT") {
    root = mintCard(input);
  } else {
    root = titleCard(input);
  }
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: outWidth } }).render().asPng());
}

export function dougArchetypeNeedsPhoto(a: DougArchetype): boolean {
  return a === "PHOTO" || a === "PANEL" || a === "SPLIT" || a === "WARSTORY";
}
