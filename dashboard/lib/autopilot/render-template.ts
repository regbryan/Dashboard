import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Renders a designed post graphic with REAL fonts (Satori → SVG → resvg PNG)
// so text is pixel-perfect, then composites the brand's real logo via sharp.
// Fonts + logos are bundled (lib/autopilot/fonts, lib/autopilot/brand-logos)
// and traced into the serverless functions via next.config.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");

type LoadedFont = { name: string; data: Buffer; weight: 600 | 700 | 800; style: "normal" };
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    const f = (file: string) => readFileSync(path.join(FONT_DIR, file));
    fontsCache = [
      { name: "Oswald", data: f("oswald-600.woff"), weight: 600, style: "normal" },
      { name: "Playfair", data: f("playfair-700.woff"), weight: 700, style: "normal" },
      { name: "Poppins", data: f("poppins-700.woff"), weight: 700, style: "normal" },
      { name: "Poppins", data: f("poppins-800.woff"), weight: 800, style: "normal" },
      { name: "Montserrat", data: f("montserrat-700.woff"), weight: 700, style: "normal" },
    ];
  }
  return fontsCache;
}

export type DesignFont = "condensed" | "serif";
export type DesignColors = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  palette?: string[] | null;
};
export type DesignRow = { label?: string | null; text: string };
type CTA = { name?: string | null; phone?: string | null; website?: string | null };

export type DesignTheme = "light" | "dark";
export type DesignCardInput = {
  width?: number;
  height?: number;
  colors: DesignColors;
  eyebrow?: string | null;
  headline: string;
  rows?: DesignRow[];
  cta?: CTA | null;
  displayFont?: DesignFont;
  theme?: DesignTheme;
  logo?: Buffer | null;
};
export type PhotoOverlayInput = {
  photo: Buffer;
  width?: number;
  height?: number;
  colors: DesignColors;
  eyebrow?: string | null;
  headline: string;
  rows?: DesignRow[];
  cta?: CTA | null;
  displayFont?: DesignFont;
  logo?: Buffer | null;
};

type El = { type: string; props: { style: Record<string, unknown>; children: unknown } };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({
  type,
  props: { style, children },
});

const dispFamily = (df?: DesignFont) => (df === "serif" ? "Playfair" : "Oswald");
// Condensed (Oswald) reads best uppercase; serif (Playfair) keeps natural case.
const head = (s: string, df?: DesignFont) => (df === "serif" ? s : s.toUpperCase());

// Relative luminance for picking readable text/accent against a background.
function lum(hex?: string | null): number {
  if (!hex) return 0;
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((ch) => ch + ch).join("") : m;
  if (n.length < 6) return 0;
  const ch = (i: number) => parseInt(n.slice(i, i + 2), 16) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(ch(0)) + 0.7152 * f(ch(2)) + 0.0722 * f(ch(4));
}
const contrastText = (bg?: string | null) => (lum(bg) > 0.45 ? "#23201C" : "#FFFFFF");
const readableOn = (color?: string | null, bg?: string | null) =>
  !!color && Math.abs(lum(color) - lum(bg)) > 0.28;

async function compositeLogo(
  base: Buffer,
  logo: Buffer | null | undefined,
  width: number
): Promise<Buffer> {
  if (!logo) return base;
  const lw = Math.round(width * 0.17);
  const pad = Math.round(width * 0.045);
  try {
    const resized = await sharp(logo).resize({ width: lw, fit: "inside" }).png().toBuffer();
    return await sharp(base)
      .composite([{ input: resized, top: pad, left: width - lw - pad }])
      .png()
      .toBuffer();
  } catch {
    return base; // never fail the whole render over a logo
  }
}

export async function renderDesignedCard(input: DesignCardInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const c = input.colors ?? {};
  const disp = dispFamily(input.displayFont);

  const primary = c.primary || "#1a2340";
  const accentRaw = c.accent || c.primary || (c.palette && c.palette[0]) || "#90B0D0";
  const isLight = input.theme === "light";

  // Background + primary text color.
  const bgBase = isLight ? "#EFE7DC" : primary;
  const bg = isLight
    ? `linear-gradient(160deg, #FFFFFF 0%, ${bgBase} 100%)`
    : `linear-gradient(160deg, #0b1124 0%, ${primary} 100%)`;
  const text = contrastText(bgBase);

  // Decorative accent that's guaranteed to read on the background (falls back
  // through the palette, then to the text color for all-light brands).
  const decor =
    [accentRaw, c.secondary, primary, ...(c.palette ?? [])].find((x) => readableOn(x, bgBase)) ||
    text;

  // CTA bar — colored, with contrast-safe text.
  const ctaBg = isLight ? primary : c.secondary || "#2a3358";
  const ctaName = contrastText(ctaBg);
  const ctaSub = readableOn(accentRaw, ctaBg) ? accentRaw : ctaName;

  const header = h("div", { display: "flex", flexDirection: "column", width: "72%" }, [
    ...(input.eyebrow
      ? [h("div", { display: "flex", fontFamily: disp, fontSize: "36px", color: decor, letterSpacing: "2px" }, head(input.eyebrow, "condensed"))]
      : []),
    h("div", { display: "flex", fontFamily: disp, fontSize: "84px", color: text, lineHeight: 1.04, letterSpacing: input.displayFont === "serif" ? "0px" : "-1px", marginTop: "16px" }, head(input.headline, input.displayFont)),
    h("div", { display: "flex", width: "160px", height: "8px", background: decor, borderRadius: "4px", marginTop: "22px" }, []),
  ]);

  const rows =
    input.rows && input.rows.length > 0
      ? h(
          "div",
          { display: "flex", flexDirection: "column", gap: "30px" },
          input.rows.map((r) =>
            h("div", { display: "flex", flexDirection: "column", gap: "6px" }, [
              ...(r.label
                ? [h("div", { display: "flex", fontFamily: disp, fontSize: "38px", color: decor, letterSpacing: "1px" }, head(r.label, "condensed"))]
                : []),
              h("div", { display: "flex", fontFamily: "Poppins", fontSize: "42px", fontWeight: 700, color: text, lineHeight: 1.18 }, r.text),
            ])
          )
        )
      : h("div", { display: "flex" }, []);

  const cta = input.cta
    ? h("div", { display: "flex", flexDirection: "column", background: ctaBg, borderRadius: "18px", padding: "26px 32px", borderLeft: `10px solid ${decor}` }, [
        ...(input.cta.name ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "34px", fontWeight: 800, color: ctaName }, input.cta.name)] : []),
        ...(input.cta.phone || input.cta.website
          ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "27px", fontWeight: 700, color: ctaSub, marginTop: "6px" }, [input.cta.phone, input.cta.website].filter(Boolean).join("  ·  "))]
          : []),
      ])
    : h("div", { display: "flex" }, []);

  const tree = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      background: bg,
      padding: "84px 64px 72px",
      justifyContent: "space-between",
      fontFamily: "Poppins",
    },
    [header, rows, cta]
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  const png = Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
  return compositeLogo(png, input.logo, width);
}

/**
 * "Photo + text" mode: nano banana makes the photo, this overlays the headline
 * on a top legibility band and a CTA bar at the bottom, plus the real logo.
 */
export async function renderPhotoOverlay(input: PhotoOverlayInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const c = input.colors ?? {};
  const accent = c.accent || c.primary || (c.palette && c.palette[0]) || "#90B0D0";
  const barBg = c.primary || "#1a2340";
  const barName = contrastText(barBg);
  const barSub = readableOn(accent, barBg) ? accent : barName;
  const disp = dispFamily(input.displayFont);

  const topBand = h("div", { display: "flex", flexDirection: "column", background: "rgba(11,17,36,0.82)", padding: "48px 56px", borderBottom: `8px solid ${accent}` }, [
    ...(input.eyebrow
      ? [h("div", { display: "flex", fontFamily: disp, fontSize: "32px", color: accent, letterSpacing: "2px", marginBottom: "12px" }, head(input.eyebrow, "condensed"))]
      : []),
    h("div", { display: "flex", width: "80%", fontFamily: disp, fontSize: "74px", color: "white", lineHeight: 1.04, letterSpacing: input.displayFont === "serif" ? "0px" : "-1px" }, head(input.headline, input.displayFont)),
  ]);

  // Optional structured rows (e.g. MYTH / FACT, tips) rendered in REAL fonts
  // over the photo in legible translucent cards — driven entirely by the JSON
  // brief, so the words can never garble. Empty by default → headline + CTA only.
  const rowsBlock =
    input.rows && input.rows.length > 0
      ? h(
          "div",
          { display: "flex", flexDirection: "column", gap: "22px", padding: "0 56px" },
          input.rows.map((r) =>
            h(
              "div",
              {
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "rgba(11,17,36,0.82)",
                padding: "26px 30px",
                borderRadius: "16px",
                borderLeft: `10px solid ${accent}`,
              },
              [
                ...(r.label
                  ? [h("div", { display: "flex", fontFamily: disp, fontSize: "34px", color: accent, letterSpacing: "1px" }, head(r.label, "condensed"))]
                  : []),
                h("div", { display: "flex", fontFamily: "Poppins", fontSize: "40px", fontWeight: 700, color: "white", lineHeight: 1.18 }, r.text),
              ]
            )
          )
        )
      : null;

  const bottomBar = input.cta
    ? h("div", { display: "flex", flexDirection: "column", background: barBg, padding: "30px 56px", borderTop: `8px solid ${accent}` }, [
        ...(input.cta.name ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "34px", fontWeight: 800, color: barName }, input.cta.name)] : []),
        ...(input.cta.phone || input.cta.website
          ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "27px", fontWeight: 700, color: barSub, marginTop: "6px" }, [input.cta.phone, input.cta.website].filter(Boolean).join("  ·  "))]
          : []),
      ])
    : h("div", { display: "flex" }, []);

  const overlayTree = h(
    "div",
    { display: "flex", flexDirection: "column", width: "100%", height: "100%", justifyContent: "space-between", fontFamily: "Poppins" },
    rowsBlock ? [topBand, rowsBlock, bottomBar] : [topBand, bottomBar]
  );

  const svg = await satori(overlayTree as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "rgba(0,0,0,0)" }).render().asPng();

  const bg = await sharp(input.photo).resize(width, height, { fit: "cover" }).toBuffer();
  const composed = await sharp(bg).composite([{ input: Buffer.from(overlayPng), top: 0, left: 0 }]).png().toBuffer();
  return compositeLogo(composed, input.logo, width);
}
