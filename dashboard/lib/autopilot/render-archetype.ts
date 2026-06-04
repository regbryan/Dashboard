import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Deterministic, FULL-BLEED IEC archetype renderer. Text + panels are drawn in
// real fonts (never the AI), so layouts never frame, garble, or drift. Only A
// and C use an AI-generated text-free photo; D/E/F/G/H are pure code (no photo,
// no AI image call) for fast, free, infinitely-repeatable variety.
//
//   A — navy panel + photo below            E — navy header + cream numbered cards
//   C — photo + light-blue panel below       F — navy, huge red number hero
//   D — navy testimonial card (quote+stars)  G — light-blue stat card (big number)
//                                            H — cream brand-story (huge year)

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");
type LoadedFont = { name: string; data: Buffer; weight: 600 | 700 | 800; style: "normal" | "italic" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Oswald", data: f("oswald-600.woff"), weight: 600, style: "normal" },
      { name: "Poppins", data: f("poppins-700.woff"), weight: 700, style: "normal" },
      { name: "Poppins", data: f("poppins-800.woff"), weight: 800, style: "normal" },
      { name: "Montserrat", data: f("montserrat-700.woff"), weight: 700, style: "normal" },
      { name: "Playfair", data: f("playfair-700.woff"), weight: 700, style: "normal" },
      { name: "Playfair", data: f("playfair-700-italic.woff"), weight: 700, style: "italic" },
    ];
  }
  return fontsCache;
}

// IEC strict color contract.
const NAVY = "#104B94";
const LIGHT_BLUE = "#87ABCF";
const RED = "#DB222A";
const WHITE = "#FFFFFF";
const NEAR_BLACK = "#191518";
const CREAM = "#F5F1EA";
const EMPHASIS_ON_NAVY = "#A9C6E8";

export type ArchetypeKey = "A" | "C" | "D" | "E" | "F" | "G" | "H";
export type HeadlineLine = { text: string; style: "sans" | "italic-serif" };
export type ArchetypeRenderInput = {
  archetype: ArchetypeKey;
  width?: number;
  height?: number;
  eyebrow?: { color?: "red" | "navy" | "light-blue"; text: string } | null;
  headlineLines: HeadlineLine[];
  body?: string | null;
  trust?: string | null;
  cta: string;
  photo?: Buffer | null;
  listItems?: { number?: string | null; text: string }[] | null;
  quote?: string | null;
  attribution?: string | null;
  bigStat?: string | null;
};

type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({
  type,
  props: { style, children },
});
const img = (src: string, style: Record<string, unknown>): El => ({ type: "img", props: { src, style } });

const PILL_BG: Record<string, string> = { red: RED, navy: NAVY, "light-blue": LIGHT_BLUE };

// A red 5-point star as a PNG data URI (Satori can't render the ★ glyph from our fonts).
let starUriCache: string | null = null;
async function starUri(): Promise<string> {
  if (!starUriCache) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><path fill="${RED}" d="M12 2l2.95 6.18 6.8.78-5.05 4.6 1.36 6.7L12 17.9 5.94 20.3l1.36-6.7L2.25 8.96l6.8-.78z"/></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    starUriCache = `data:image/png;base64,${png.toString("base64")}`;
  }
  return starUriCache;
}
async function starRow(count: number, size = 48, gap = 10): Promise<El> {
  const uri = await starUri();
  return h(
    "div",
    { display: "flex", flexDirection: "row", gap: `${gap}px` },
    Array.from({ length: count }, () => img(uri, { width: `${size}px`, height: `${size}px` }))
  );
}

function eyebrowPill(eyebrow: ArchetypeRenderInput["eyebrow"]): El[] {
  if (!eyebrow?.text) return [];
  const bg = PILL_BG[eyebrow.color ?? "red"] ?? RED;
  return [
    h(
      "div",
      {
        display: "flex",
        alignSelf: "flex-start",
        background: bg,
        color: bg === LIGHT_BLUE ? NAVY : WHITE,
        fontFamily: "Poppins",
        fontWeight: 800,
        fontSize: "26px",
        letterSpacing: "1.5px",
        padding: "12px 22px",
        borderRadius: "999px",
      },
      eyebrow.text.toUpperCase()
    ),
  ];
}

function headlineEls(lines: HeadlineLine[], sansColor: string, italicColor: string, size = 78): El {
  return h(
    "div",
    { display: "flex", flexDirection: "column", marginTop: "20px" },
    lines.map((l) =>
      l.style === "italic-serif"
        ? h(
            "div",
            { display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontWeight: 700, fontSize: `${size - 2}px`, lineHeight: 1.04, color: italicColor },
            l.text
          )
        : h(
            "div",
            { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: `${size}px`, lineHeight: 1.02, letterSpacing: "0.5px", color: sansColor, textTransform: "uppercase" },
            l.text
          )
    )
  );
}

function ctaPill(text: string, onLight: boolean): El {
  const pillBg = onLight ? NAVY : WHITE;
  const txt = onLight ? WHITE : NAVY;
  return h(
    "div",
    { display: "flex", alignItems: "center", alignSelf: "flex-start", background: pillBg, borderRadius: "999px", padding: "16px 18px 16px 28px", marginTop: "30px", gap: "16px" },
    [
      h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "30px", color: txt }, text),
      h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", borderRadius: "999px", background: RED, color: WHITE, fontFamily: "Poppins", fontWeight: 800, fontSize: "28px" }, "›"),
    ]
  );
}

function bodyEl(body: string | undefined | null, color: string): El[] {
  if (!body?.trim()) return [];
  return [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "30px", lineHeight: 1.32, color, marginTop: "24px", width: "92%" }, body.trim())];
}
function trustEl(trust: string | undefined | null, color: string): El[] {
  if (!trust?.trim()) return [];
  return [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "26px", color, marginTop: "22px" }, trust.trim())];
}

// --- A / C: panel + photo ---------------------------------------------------
function panel(input: ArchetypeRenderInput, surface: "navy" | "light-blue", width: number): El {
  const onNavy = surface === "navy";
  const pad = Math.round(width * 0.066);
  const kids: El[] = [
    ...eyebrowPill(input.eyebrow),
    headlineEls(input.headlineLines, onNavy ? WHITE : NAVY, onNavy ? EMPHASIS_ON_NAVY : NAVY),
    ...bodyEl(input.body, onNavy ? "#E6EEF8" : NEAR_BLACK),
    ...trustEl(input.trust, onNavy ? WHITE : NAVY),
    ctaPill(input.cta, !onNavy),
  ];
  return h(
    "div",
    { display: "flex", flexDirection: "column", justifyContent: "center", background: onNavy ? NAVY : LIGHT_BLUE, padding: `${pad}px`, width: "100%" },
    kids
  );
}

// --- D: testimonial card ----------------------------------------------------
async function testimonial(input: ArchetypeRenderInput, width: number): Promise<El> {
  const pad = Math.round(width * 0.075);
  const initials = (input.attribution ?? "IEC").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "IEC";
  const kids: El[] = [
    ...eyebrowPill(input.eyebrow),
    h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "150px", color: RED, lineHeight: 0.8, marginTop: "10px", height: "90px" }, "“"),
    h("div", { display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontWeight: 700, fontSize: "52px", lineHeight: 1.22, color: WHITE, marginTop: "20px" }, input.quote ?? input.headlineLines.map((l) => l.text).join(" ")),
    await starRow(5, 52, 12),
    h("div", { display: "flex", alignItems: "center", gap: "20px", marginTop: "30px" }, [
      h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "92px", height: "92px", borderRadius: "999px", background: LIGHT_BLUE, color: NAVY, fontFamily: "Poppins", fontWeight: 800, fontSize: "40px" }, initials),
      h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "34px", color: WHITE }, input.attribution ?? "Inland Empire Comfort"),
    ]),
    ...trustEl(input.trust, "#C7D6EC"),
    ctaPill(input.cta, false),
  ];
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", background: NAVY, padding: `${pad}px` }, kids);
}

// --- E: numbered list (navy header + cream cards) ---------------------------
function numberedList(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.06);
  const items = (input.listItems ?? []).slice(0, 3);
  const header = h(
    "div",
    { display: "flex", flexDirection: "column", background: NAVY, padding: `${pad}px ${pad}px ${Math.round(pad * 0.8)}px` },
    [...eyebrowPill(input.eyebrow), headlineEls(input.headlineLines, WHITE, EMPHASIS_ON_NAVY, 64)]
  );
  const cards = h(
    "div",
    { display: "flex", flexDirection: "column", flexGrow: 1, gap: "22px", padding: `${pad}px`, justifyContent: "center" },
    items.map((it, i) =>
      h("div", { display: "flex", alignItems: "center", gap: "26px", background: WHITE, borderRadius: "20px", padding: "26px 30px" }, [
        h("div", { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: "84px", color: RED, lineHeight: 1 }, it.number ?? String(i + 1)),
        h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "34px", lineHeight: 1.2, color: NAVY, width: "78%" }, it.text),
      ])
    )
  );
  const footer = h("div", { display: "flex", justifyContent: "center", padding: `0 ${pad}px ${pad}px` }, [ctaPill(input.cta, false)]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [header, cards, footer]);
}

// --- F: big-number hero (navy) ----------------------------------------------
function bigNumberHero(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.07);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", background: NAVY, padding: `${pad}px` }, [
    ...eyebrowPill(input.eyebrow),
    h("div", { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: "320px", lineHeight: 0.9, color: RED, marginTop: "18px" }, input.bigStat ?? ""),
    headlineEls(input.headlineLines, WHITE, EMPHASIS_ON_NAVY, 64),
    ...bodyEl(input.body, "#E6EEF8"),
    ctaPill(input.cta, false),
  ]);
}

// --- G: stat card (light-blue) ----------------------------------------------
function statCard(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.07);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", background: LIGHT_BLUE, padding: `${pad}px` }, [
    ...eyebrowPill(input.eyebrow),
    h("div", { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: "300px", lineHeight: 0.9, color: NAVY, marginTop: "18px" }, input.bigStat ?? ""),
    headlineEls(input.headlineLines, NAVY, NAVY, 60),
    ...bodyEl(input.body, NEAR_BLACK),
    ctaPill(input.cta, true),
  ]);
}

// --- H: brand-story (cream) -------------------------------------------------
function brandStory(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.07);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", background: CREAM, padding: `${pad}px` }, [
    ...eyebrowPill(input.eyebrow),
    headlineEls(input.headlineLines, NAVY, NAVY, 60),
    h("div", { display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontWeight: 700, fontSize: "260px", lineHeight: 0.95, color: NAVY }, input.bigStat ?? ""),
    h("div", { display: "flex", width: "120px", height: "8px", background: RED, borderRadius: "4px", marginTop: "8px" }, []),
    ...bodyEl(input.body, NEAR_BLACK),
    ctaPill(input.cta, true),
  ]);
}

export async function renderArchetypeDesign(input: ArchetypeRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;

  let root: El;
  if (input.archetype === "A" || input.archetype === "C") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    const surface: "navy" | "light-blue" = input.archetype === "A" ? "navy" : "light-blue";
    const panelEl = panel(input, surface, width);
    const photoBlock = h("div", { display: "flex", flexGrow: 1, width: "100%" }, [
      img(dataUri, { width: "100%", height: "100%", objectFit: "cover" }),
    ]);
    const seam = h("div", { display: "flex", width: "100%", height: "8px", background: RED }, []);
    const order = input.archetype === "A" ? [panelEl, seam, photoBlock] : [photoBlock, seam, panelEl];
    root = h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: NAVY }, order);
  } else if (input.archetype === "D") {
    root = await testimonial(input, width);
  } else if (input.archetype === "E") {
    root = numberedList(input, width);
  } else if (input.archetype === "F") {
    root = bigNumberHero(input, width);
  } else if (input.archetype === "G") {
    root = statCard(input, width);
  } else {
    root = brandStory(input, width);
  }

  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

// archetypes that need an AI photo (others are pure code)
export function archetypeNeedsPhoto(a: ArchetypeKey): boolean {
  return a === "A" || a === "C";
}
