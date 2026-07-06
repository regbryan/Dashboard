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

export type ArchetypeKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "QUAD";
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

function eyebrowPill(eyebrow: ArchetypeRenderInput["eyebrow"], centered = false): El[] {
  if (!eyebrow?.text) return [];
  const bg = PILL_BG[eyebrow.color ?? "red"] ?? RED;
  return [
    h(
      "div",
      {
        display: "flex",
        alignSelf: centered ? "center" : "flex-start",
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

// Uniform vertical rhythm between every block in a panel.
const GAP = "30px";

type HeadlineOpts = { serif?: boolean; centered?: boolean };
function headlineEls(
  lines: HeadlineLine[],
  sansColor: string,
  italicColor: string,
  size = 78,
  opts: HeadlineOpts = {}
): El {
  const { serif = false, centered = false } = opts;
  const just = centered ? "center" : "flex-start";
  return h(
    "div",
    { display: "flex", flexDirection: "column", gap: serif ? "4px" : "6px", alignItems: centered ? "center" : "flex-start", width: "100%" },
    lines.map((l) => {
      const base = { display: "flex", width: "100%", justifyContent: just, lineHeight: 1.12 } as Record<string, unknown>;
      if (l.style === "italic-serif") {
        // Italic-serif emphasis line (Playfair italic) in both modes.
        return h("div", { ...base, fontFamily: "Playfair", fontStyle: "italic", fontWeight: 700, fontSize: `${size - 2}px`, color: italicColor }, l.text);
      }
      if (serif) {
        // Elegant serif headline (title-case) like the v6 promo posts.
        return h("div", { ...base, fontFamily: "Playfair", fontWeight: 700, fontSize: `${size - 2}px`, color: sansColor }, l.text);
      }
      // Condensed all-caps (lists / big-number archetypes).
      return h("div", { ...base, fontFamily: "Oswald", fontWeight: 600, fontSize: `${size}px`, lineHeight: 1.08, letterSpacing: "0.5px", color: sansColor, textTransform: "uppercase" }, l.text);
    })
  );
}

function ctaPill(text: string, onLight: boolean, opts: { centered?: boolean; arrow?: boolean; size?: number } = {}): El {
  const { centered = false, arrow = true, size = 30 } = opts;
  const pillBg = onLight ? NAVY : WHITE;
  const txt = onLight ? WHITE : NAVY;
  const pad = arrow ? "16px 18px 16px 28px" : `${Math.round(size * 0.55)}px ${Math.round(size * 1.1)}px`;
  const kids: El[] = [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: `${size}px`, color: txt }, text)];
  if (arrow) {
    kids.push(h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "44px", height: "44px", borderRadius: "999px", background: RED, color: WHITE, fontFamily: "Poppins", fontWeight: 800, fontSize: "28px" }, "›"));
  }
  return h(
    "div",
    { display: "flex", alignItems: "center", alignSelf: centered ? "center" : "flex-start", background: pillBg, borderRadius: "999px", padding: pad, gap: "16px" },
    kids
  );
}

function bodyEl(body: string | undefined | null, color: string, centered = false, size = 30): El[] {
  if (!body?.trim()) return [];
  return [h("div", {
    display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: `${size}px`, lineHeight: 1.34, color,
    width: centered ? "90%" : "92%",
    ...(centered ? { alignSelf: "center", textAlign: "center", justifyContent: "center" } : {}),
  }, body.trim())];
}
function trustEl(trust: string | undefined | null, color: string, centered = false, size = 26): El[] {
  if (!trust?.trim()) return [];
  return [h("div", {
    display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: `${size}px`, color,
    ...(centered ? { alignSelf: "center" } : {}),
  }, trust.trim())];
}

// Cap panel body copy so the A/C panel can never outgrow its band and squeeze
// the photo. Cuts at a sentence end where possible, else at a word boundary.
function capBody(body: string | undefined | null, max = 210): string | null {
  const t = (body ?? "").trim();
  if (t.length <= max) return t || null;
  const slice = t.slice(0, max);
  const sentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentence > max * 0.5) return slice.slice(0, sentence + 1);
  const word = slice.lastIndexOf(" ");
  return `${slice.slice(0, word > 0 ? word : max).trimEnd()}…`;
}

// A thin red rule with a centered red star — the IEC seam accent.
async function seamStar(bg: string, width: number): Promise<El> {
  const u = await starUri();
  const sidePad = Math.round(width * 0.05);
  return h(
    "div",
    { display: "flex", alignItems: "center", justifyContent: "center", gap: "26px", background: bg, padding: `26px ${sidePad}px` },
    [
      h("div", { display: "flex", flexGrow: 1, height: "3px", background: RED }, []),
      img(u, { width: "34px", height: "34px" }),
      h("div", { display: "flex", flexGrow: 1, height: "3px", background: RED }, []),
    ]
  );
}

// --- A / C: photo + centered serif panel (matches the v6 promo look) --------
// COMPACT by design: the photo owns ≥50% of the card (client rule — IG designs
// carry real photography), so the panel uses tighter type and capped body copy
// instead of growing to fit whatever the model wrote.
function panel(input: ArchetypeRenderInput, surface: "navy" | "light-blue", width: number): El {
  const onNavy = surface === "navy";
  const pad = Math.round(width * 0.045);
  const main = onNavy ? WHITE : NAVY;
  // CALL pill + trust line stay tight together, then participate in the panel rhythm.
  const ctaGroup = h(
    "div",
    { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
    [
      ctaPill(input.cta, !onNavy, { centered: true, arrow: false, size: 26 }),
      ...trustEl(input.trust, onNavy ? "#C7D6EC" : "#1C3A63", true, 22),
    ]
  );
  const kids: El[] = [
    ...eyebrowPill(input.eyebrow, true),
    headlineEls(input.headlineLines, main, onNavy ? EMPHASIS_ON_NAVY : NAVY, 52, { serif: true, centered: true }),
    ...bodyEl(capBody(input.body), onNavy ? "#DCE8F6" : NEAR_BLACK, true, 25),
    ctaGroup,
  ];
  return h(
    "div",
    { display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", alignItems: "center", gap: "20px", background: onNavy ? NAVY : LIGHT_BLUE, padding: `${pad}px`, width: "100%" },
    kids
  );
}

// --- D: testimonial card ----------------------------------------------------
async function testimonial(input: ArchetypeRenderInput, width: number): Promise<El> {
  const pad = Math.round(width * 0.075);
  const initials = (input.attribution ?? "IEC").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "IEC";
  const kids: El[] = [
    ...eyebrowPill(input.eyebrow),
    h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "150px", color: RED, lineHeight: 0.8, height: "70px" }, "“"),
    h("div", { display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontWeight: 700, fontSize: "52px", lineHeight: 1.24, color: WHITE }, input.quote ?? input.headlineLines.map((l) => l.text).join(" ")),
    await starRow(5, 52, 12),
    h("div", { display: "flex", alignItems: "center", gap: "20px" }, [
      h("div", { display: "flex", alignItems: "center", justifyContent: "center", width: "92px", height: "92px", borderRadius: "999px", background: LIGHT_BLUE, color: NAVY, fontFamily: "Poppins", fontWeight: 800, fontSize: "40px" }, initials),
      h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "34px", color: WHITE }, input.attribution ?? "Inland Empire Comfort"),
    ]),
    ...trustEl(input.trust, "#C7D6EC"),
    ctaPill(input.cta, false),
  ];
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: GAP, width: "100%", height: "100%", background: NAVY, padding: `${pad}px` }, kids);
}

// --- E: numbered list (navy header + cream cards) ---------------------------
function numberedList(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.06);
  const items = (input.listItems ?? []).slice(0, 3);
  const header = h(
    "div",
    { display: "flex", flexDirection: "column", gap: GAP, background: NAVY, padding: `${pad}px ${pad}px ${Math.round(pad * 0.8)}px` },
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
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: GAP, width: "100%", height: "100%", background: NAVY, padding: `${pad}px` }, [
    ...eyebrowPill(input.eyebrow),
    h("div", { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: "300px", lineHeight: 0.95, color: RED }, input.bigStat ?? ""),
    headlineEls(input.headlineLines, WHITE, EMPHASIS_ON_NAVY, 64),
    ...bodyEl(input.body, "#E6EEF8"),
    ctaPill(input.cta, false),
  ]);
}

// --- G: stat card (light-blue) ----------------------------------------------
function statCard(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.07);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: GAP, width: "100%", height: "100%", background: LIGHT_BLUE, padding: `${pad}px` }, [
    ...eyebrowPill(input.eyebrow),
    h("div", { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: "290px", lineHeight: 0.95, color: NAVY }, input.bigStat ?? ""),
    headlineEls(input.headlineLines, NAVY, NAVY, 60),
    ...bodyEl(input.body, NEAR_BLACK),
    ctaPill(input.cta, true),
  ]);
}

// --- H: brand-story (cream) -------------------------------------------------
function brandStory(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.07);
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: GAP, width: "100%", height: "100%", background: CREAM, padding: `${pad}px` }, [
    ...eyebrowPill(input.eyebrow),
    headlineEls(input.headlineLines, NAVY, NAVY, 60),
    h("div", { display: "flex", flexDirection: "column", gap: "14px" }, [
      h("div", { display: "flex", fontFamily: "Playfair", fontStyle: "italic", fontWeight: 700, fontSize: "240px", lineHeight: 1.0, color: NAVY }, input.bigStat ?? ""),
      h("div", { display: "flex", width: "120px", height: "8px", background: RED, borderRadius: "4px" }, []),
    ]),
    ...bodyEl(input.body, NEAR_BLACK),
    ctaPill(input.cta, true),
  ]);
}

// --- B: full-bleed photo + navy gradient panel (emergency / dramatic hero) ---
function fullBleed(input: ArchetypeRenderInput, dataUri: string, width: number): El {
  const pad = Math.round(width * 0.066);
  const overlay = h(
    "div",
    {
      display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: GAP,
      position: "absolute", left: "0px", bottom: "0px", width: "100%", height: "62%",
      padding: `${pad}px`,
      backgroundImage: "linear-gradient(to top, rgba(16,75,148,0.97) 0%, rgba(16,75,148,0.85) 32%, rgba(16,75,148,0.0) 100%)",
    },
    [
      ...eyebrowPill(input.eyebrow),
      headlineEls(input.headlineLines, WHITE, EMPHASIS_ON_NAVY, 80),
      ...bodyEl(input.body, "#DCE8F6"),
      ctaPill(input.cta, false),
    ]
  );
  return h("div", { display: "flex", position: "relative", width: "100%", height: "100%", background: NAVY }, [
    img(dataUri, { position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", objectFit: "cover" }),
    overlay,
  ]);
}

// --- I: myth-vs-truth split (cream column + photo column + red caption bar) ---
function mythSplit(input: ArchetypeRenderInput, dataUri: string, width: number): El {
  const pad = Math.round(width * 0.05);
  const label = (text: string) => h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "32px", letterSpacing: "0.5px", color: RED }, text);
  const left = h(
    "div",
    { display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px", width: "56%", height: "100%", background: CREAM, padding: `${pad}px` },
    [
      ...eyebrowPill(input.eyebrow),
      label("MYTH:"),
      headlineEls(input.headlineLines, NAVY, NAVY, 50),
      h("div", { display: "flex", width: "110px", height: "6px", background: RED, borderRadius: "3px", margin: "6px 0" }, []),
      label("TRUTH:"),
      ...bodyEl(input.body, NEAR_BLACK),
    ]
  );
  const right = h("div", { display: "flex", width: "44%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  const bar = h(
    "div",
    { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", background: RED, padding: "26px 40px" },
    [h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 800, fontSize: "30px", color: WHITE }, input.cta)]
  );
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [
    h("div", { display: "flex", flexDirection: "row", flexGrow: 1, width: "100%" }, [left, right]),
    bar,
  ]);
}

// --- QUAD: 2x2 cards (4 warning signs / services) ---------------------------
function quad(input: ArchetypeRenderInput, width: number): El {
  const pad = Math.round(width * 0.06);
  const items = (input.listItems ?? []).slice(0, 4);
  const header = h(
    "div",
    { display: "flex", flexDirection: "column", gap: GAP, background: NAVY, padding: `${pad}px ${pad}px ${Math.round(pad * 0.8)}px` },
    [...eyebrowPill(input.eyebrow), headlineEls(input.headlineLines, WHITE, EMPHASIS_ON_NAVY, 60)]
  );
  const card = (it: { number?: string | null; text: string }, i: number) =>
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px", width: "47%", flexGrow: 1, background: WHITE, borderRadius: "20px", padding: "28px 28px" }, [
      h("div", { display: "flex", fontFamily: "Oswald", fontWeight: 600, fontSize: "64px", lineHeight: 1, color: RED }, it.number ?? String(i + 1)),
      h("div", { display: "flex", fontFamily: "Poppins", fontWeight: 700, fontSize: "29px", lineHeight: 1.18, color: NAVY }, it.text),
    ]);
  const grid = h(
    "div",
    { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignContent: "stretch", gap: "22px", flexGrow: 1, padding: `${pad}px`, width: "100%" },
    items.map(card)
  );
  const footer = h("div", { display: "flex", justifyContent: "center", padding: `0 ${pad}px ${pad}px` }, [ctaPill(input.cta, false)]);
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [header, grid, footer]);
}

export async function renderArchetypeDesign(input: ArchetypeRenderInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;

  let root: El;
  if (input.archetype === "A" || input.archetype === "B" || input.archetype === "C" || input.archetype === "I") {
    const jpeg = await sharp(input.photo as Buffer).jpeg({ quality: 90 }).toBuffer();
    const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    if (input.archetype === "B") {
      root = fullBleed(input, dataUri, width);
    } else if (input.archetype === "I") {
      root = mythSplit(input, dataUri, width);
    } else {
      const surface: "navy" | "light-blue" = input.archetype === "A" ? "navy" : "light-blue";
      const panelEl = panel(input, surface, width);
      // The photo owns HALF the card, guaranteed — the panel flexes into the rest.
      const photoBlock = h("div", { display: "flex", width: "100%", height: "50%", flexShrink: 0 }, [
        img(dataUri, { width: "100%", height: "100%", objectFit: "cover" }),
      ]);
      const seam = await seamStar(surface === "navy" ? NAVY : LIGHT_BLUE, width);
      const order = input.archetype === "A" ? [panelEl, seam, photoBlock] : [photoBlock, seam, panelEl];
      root = h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: NAVY }, order);
    }
  } else if (input.archetype === "D") {
    root = await testimonial(input, width);
  } else if (input.archetype === "E") {
    root = numberedList(input, width);
  } else if (input.archetype === "F") {
    root = bigNumberHero(input, width);
  } else if (input.archetype === "G") {
    root = statCard(input, width);
  } else if (input.archetype === "QUAD") {
    root = quad(input, width);
  } else {
    root = brandStory(input, width);
  }

  const svg = await satori(root as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

// archetypes that need an AI photo (others are pure code)
export function archetypeNeedsPhoto(a: ArchetypeKey): boolean {
  return a === "A" || a === "B" || a === "C" || a === "I";
}
