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

export type OmegaArchetype = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "COLLAGE";
export type OmegaHeadlineLine = { text: string; style: "serif" | "script" };
export type OmegaRenderInput = {
  archetype: OmegaArchetype;
  width?: number;
  height?: number;
  eyebrow?: string | null;
  headlineLines: OmegaHeadlineLine[];
  body?: string | null;
  cta?: string | null;
  listItems?: { number?: string | null; lead?: string | null; text: string }[] | null;
  bigStat?: string | null;
  quote?: string | null;
  attribution?: string | null;
  photo?: Buffer | null;
  photos?: Buffer[] | null; // COLLAGE: up to 4 photos arranged in a 2x2 grid
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
function softCta(text: string | null | undefined, onNavy: boolean): El[] {
  if (!text?.trim()) return [];
  return [h("div", { display: "flex", alignSelf: "center", background: onNavy ? NEARWHITE : NAVY, color: onNavy ? NAVY : WHITE, fontFamily: "Montserrat", fontWeight: 700, fontSize: "26px", letterSpacing: "2px", padding: "16px 34px", borderRadius: "999px" }, text.trim().toUpperCase())];
}

// PHOTO + STATEMENT — the emotional / story / celebration format. A LARGE photo
// (the brand is photo-driven) with a left-aligned script+serif headline and a
// warm paragraph below. Different content shape from the photo+list, still
// photo-forward.
function photoStatementTree(input: OmegaRenderInput, dataUri: string): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [
    zone("104px"), // logo overlay
    h("div", { display: "flex", width: "100%", height: "46%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center bottom" })]),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: "26px", flexGrow: 1, width: "100%", padding: "44px 84px 0" }, [
      headlineLeft(input.headlineLines, NAVY, 50, 72),
      ...(input.body?.trim()
        ? [h("div", { display: "flex", width: "100%", fontFamily: "Montserrat", fontWeight: 400, fontSize: "27px", lineHeight: 1.5, color: NEARBLACK }, input.body.trim())]
        : []),
    ]),
    zone("96px"), // OMGLENDING.COM overlay
  ]);
}

// Left-aligned script+serif headline (the reference editorial style).
function headlineLeft(lines: OmegaHeadlineLine[], color: string, serifSize: number, scriptSize: number): El {
  return h("div", { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0px", width: "100%" },
    lines.map((l) => l.style === "script"
      ? h("div", { display: "flex", fontFamily: "Allura", fontWeight: 400, fontSize: `${scriptSize}px`, lineHeight: 1.0, color }, l.text)
      : h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: `${serifSize}px`, lineHeight: 1.06, color }, l.text)));
}

// A reserved clean band (no drawn content) for the logo (top) / compliance
// (bottom) that the dashboard overlay adds later — per the no-baked-logo rule.
function zone(height: string): El {
  return h("div", { display: "flex", width: "100%", height }, []);
}

// Numbered list rows in the reference style: hollow navy ring, bold navy lead,
// muted detail line beneath.
function numberedRows(items: { number?: string | null; lead?: string | null; text: string }[]): El[] {
  return items.slice(0, 3).map((it, i) =>
    h("div", { display: "flex", alignItems: "flex-start", gap: "26px", width: "100%" }, [
      h("div", { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: "58px", height: "58px", borderRadius: "999px", border: `3px solid ${NAVY}`, fontFamily: "Playfair", fontWeight: 700, fontSize: "30px", color: NAVY }, it.number ?? String(i + 1)),
      h("div", { display: "flex", flexDirection: "column", gap: "4px", width: "84%" }, [
        h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "29px", lineHeight: 1.2, color: NAVY }, it.lead?.trim() || it.text),
        ...(it.lead?.trim() && it.text?.trim()
          ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "24px", lineHeight: 1.32, color: NEARBLACK }, it.text)]
          : []),
      ]),
    ])
  );
}

// SIGNATURE LAYOUT — photo + 3-point numbered list (the brand's workhorse:
// post01/04/08). Logo zone reserved top, contained photo band, left-aligned
// script+serif headline, numbered list with bold lead + detail, footer zone.
function photoListTree(input: OmegaRenderInput, dataUri: string): El {
  const items = input.listItems ?? [];
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [
    zone("104px"), // logo overlay lands here
    h("div", { display: "flex", width: "100%", height: "40%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center bottom" })]),
    h("div", { display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: "30px", flexGrow: 1, width: "100%", padding: "44px 84px 0" }, [
      headlineLeft(input.headlineLines, NAVY, 54, 76),
      h("div", { display: "flex", flexDirection: "column", gap: "24px", width: "100%", marginTop: "4px" }, numberedRows(items)),
    ]),
    zone("96px"), // OMGLENDING.COM / compliance overlay lands here
  ]);
}

// FULL-BLEED EDITORIAL (B) — photo fills the whole frame; headline + body over a
// navy gradient scrim at the bottom. Magazine-cover silhouette.
function fullBleedTree(input: OmegaRenderInput, dataUri: string): El {
  const overlay = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      gap: "22px",
      position: "absolute",
      left: "0px",
      bottom: "0px",
      width: "100%",
      height: "74%",
      padding: "0 84px 132px",
      backgroundImage: "linear-gradient(to top, rgba(0,38,61,0.96) 0%, rgba(0,38,61,0.82) 26%, rgba(0,38,61,0.0) 72%)",
    },
    [
      headlineLeft(input.headlineLines, WHITE, 62, 92),
      ...(input.body?.trim()
        ? [h("div", { display: "flex", width: "86%", fontFamily: "Montserrat", fontWeight: 400, fontSize: "26px", lineHeight: 1.5, color: NEARWHITE }, input.body.trim())]
        : []),
    ]
  );
  return h("div", { display: "flex", position: "relative", width: "100%", height: "100%", background: NAVY }, [
    img(dataUri, { position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }),
    overlay,
  ]);
}

// SPLIT (F) — photo on the right, a solid navy panel on the left holding the
// headline (white) and the list or statement. Editorial, totally different
// silhouette from the photo-top layouts.
function splitTree(input: OmegaRenderInput, dataUri: string): El {
  const items = (input.listItems ?? []).slice(0, 3);
  const lines = input.headlineLines.map((l) =>
    l.style === "script"
      ? h("div", { display: "flex", fontFamily: "Allura", fontWeight: 400, fontSize: "62px", lineHeight: 1.0, color: WHITE }, l.text)
      : h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "44px", lineHeight: 1.08, color: WHITE }, l.text)
  );
  const panelKids: El[] = [h("div", { display: "flex", flexDirection: "column" }, lines)];
  if (items.length) {
    panelKids.push(
      h("div", { display: "flex", flexDirection: "column", gap: "18px", marginTop: "20px" },
        items.map((it, i) =>
          h("div", { display: "flex", flexDirection: "column", gap: "3px" }, [
            h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "23px", color: WHITE }, `${it.number ?? i + 1}.  ${it.lead?.trim() || it.text}`),
            ...(it.lead?.trim() && it.text?.trim()
              ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: "19px", lineHeight: 1.32, color: NEARWHITE }, it.text)]
              : []),
          ])
        )
      )
    );
  } else if (input.body?.trim()) {
    panelKids.push(h("div", { display: "flex", marginTop: "20px", fontFamily: "Montserrat", fontWeight: 400, fontSize: "24px", lineHeight: 1.45, color: NEARWHITE }, input.body.trim()));
  }
  const panel = h("div", { display: "flex", flexDirection: "column", justifyContent: "center", width: "44%", height: "100%", background: NAVY, padding: "72px 50px" }, panelKids);
  const photo = h("div", { display: "flex", width: "56%", height: "100%" }, [img(dataUri, { width: "100%", height: "100%", objectFit: "cover" })]);
  return h("div", { display: "flex", flexDirection: "row", width: "100%", height: "100%", background: NAVY }, [panel, photo]);
}

// PHOTO-COLLAGE HERO (the v8_08 "Market Update" silhouette) — a 2x2 grid of warm
// photos behind a CENTERED navy card holding eyebrow + serif headline + a few
// tight body lines + soft CTA. Navy bands top/bottom reserved for logo + footer
// overlay. The most photo-rich, magazine-spread layout in the set.
function collageTree(input: OmegaRenderInput, uris: string[]): El {
  const cells = uris.slice(0, 4);
  const grid = h(
    "div",
    { display: "flex", flexWrap: "wrap", position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%" },
    cells.map((u) => h("div", { display: "flex", width: "50%", height: "50%" }, [img(u, { width: "100%", height: "100%", objectFit: "cover" })]))
  );
  const bodyLines = input.body?.trim() ? input.body.trim().split("\n").map((s) => s.trim()).filter(Boolean) : [];
  const card = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "14px",
      width: "70%",
      background: NAVY,
      padding: "56px 56px 50px",
      boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
    },
    [
      ...(input.eyebrow?.trim()
        ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: "22px", letterSpacing: "5px", color: NEARWHITE, marginBottom: "4px" }, input.eyebrow.toUpperCase())]
        : []),
      headline(input.headlineLines, WHITE, 58, 84),
      ...bodyLines.map((ln) =>
        h("div", { display: "flex", width: "100%", justifyContent: "center", textAlign: "center", fontFamily: "Montserrat", fontWeight: 400, fontSize: "26px", lineHeight: 1.42, color: NEARWHITE }, ln)
      ),
      ...(input.cta?.trim()
        ? [h("div", { display: "flex", marginTop: "10px", fontFamily: "Montserrat", fontWeight: 700, fontSize: "20px", letterSpacing: "1px", color: NEARWHITE }, input.cta.trim())]
        : []),
    ]
  );
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: NAVY }, [
    zone("104px"), // logo overlay
    h("div", { display: "flex", position: "relative", flexGrow: 1, width: "100%", alignItems: "center", justifyContent: "center" }, [grid, card]),
    zone("96px"), // OMGLENDING.COM / footer overlay
  ]);
}

// NUMBERED LISTICLE / COMPARISON (the v8_02 "5 Mistakes" + v8_06 "Pre-Qual ≠
// Pre-Approval" silhouette). Cream card, eyebrow pill, centered serif headline,
// then 2–5 hollow-navy rings each with a BOLD navy lead + a muted detail line,
// soft CTA. Handles both long lists and 2-item comparisons (item count changes
// the silhouette). No photo.
function listicleTree(input: OmegaRenderInput): El {
  const items = (input.listItems ?? []).slice(0, 5);
  const many = items.length >= 4;
  const ring = (n: string) => h("div", { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: many ? "64px" : "72px", height: many ? "64px" : "72px", borderRadius: "999px", border: `3px solid ${NAVY}`, fontFamily: "Playfair", fontWeight: 700, fontSize: many ? "32px" : "38px", color: NAVY }, n);
  const rows = items.map((it, i) =>
    h("div", { display: "flex", alignItems: "flex-start", gap: "24px", width: "100%" }, [
      ring(it.number ?? String(i + 1)),
      h("div", { display: "flex", flexDirection: "column", gap: "4px", width: "82%" }, [
        h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: many ? "28px" : "31px", lineHeight: 1.2, color: NAVY }, it.lead?.trim() || it.text),
        ...(it.lead?.trim() && it.text?.trim()
          ? [h("div", { display: "flex", fontFamily: "Montserrat", fontWeight: 400, fontSize: many ? "23px" : "25px", lineHeight: 1.32, color: NEARBLACK }, it.text)]
          : []),
      ]),
    ])
  );
  return h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: many ? "24px" : "30px", width: "100%", height: "100%", background: CREAM, padding: "84px 80px 96px" }, [
    ...eyebrow(input.eyebrow, false),
    headline(input.headlineLines, NAVY, many ? 56 : 62, many ? 80 : 90),
    h("div", { display: "flex", flexDirection: "column", gap: many ? "20px" : "26px", width: "100%", marginTop: "6px" }, rows),
    ...softCta(input.cta, false),
  ]);
}

function bigNumberTree(input: OmegaRenderInput): El {
  return h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", background: CREAM }, [
    zone("128px"), // logo overlay
    h("div", { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: "28px", flexGrow: 1, width: "100%", padding: "0 84px" }, [
      // A dignified statement card (e.g. the Juneteenth closure) sets no bigStat —
      // skip the oversize numeral entirely so it doesn't leave a huge gap.
      ...(input.bigStat?.trim()
        ? [h("div", { display: "flex", fontFamily: "Playfair", fontWeight: 700, fontSize: "240px", lineHeight: 1.0, color: NAVY }, input.bigStat.trim())]
        : []),
      headlineLeft(input.headlineLines, NAVY, 56, 80),
      ...(input.body?.trim()
        ? [h("div", { display: "flex", width: "90%", fontFamily: "Montserrat", fontWeight: 400, fontSize: "29px", lineHeight: 1.4, color: NEARBLACK, marginTop: "14px" }, input.body.trim())]
        : []),
    ]),
    zone("96px"), // OMGLENDING.COM overlay
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
  if (input.archetype === "COLLAGE") {
    const photos = (input.photos ?? []).slice(0, 4);
    const uris = await Promise.all(
      photos.map(async (p) => {
        const jpeg = await sharp(p).jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
        return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      })
    );
    root = collageTree(input, uris);
  } else if (input.archetype === "A" || input.archetype === "B" || input.archetype === "E" || input.archetype === "F") {
    // Near-lossless: q95 + full 4:4:4 chroma (no color/edge subsampling) +
    // mozjpeg. Avoids the q90/4:2:0 softening that was visible on skin and
    // smooth walls in the composited photo.
    const jpeg = await sharp(input.photo as Buffer)
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
    const uri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    root =
      input.archetype === "B" ? fullBleedTree(input, uri)
      : input.archetype === "F" ? splitTree(input, uri)
      : input.archetype === "E" ? photoStatementTree(input, uri)
      : photoListTree(input, uri);
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
  return a === "A" || a === "B" || a === "E" || a === "F";
}

// COLLAGE needs 4 photos rather than 1; kept separate so the single-photo
// pipeline path isn't confused by it.
export function omegaArchetypeNeedsPhotoGrid(a: OmegaArchetype): boolean {
  return a === "COLLAGE";
}
