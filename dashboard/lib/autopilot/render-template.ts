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

export type DesignCardInput = {
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
export type PhotoOverlayInput = {
  photo: Buffer;
  width?: number;
  height?: number;
  colors: DesignColors;
  eyebrow?: string | null;
  headline: string;
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
  const accent = c.accent || c.primary || (c.palette && c.palette[0]) || "#90B0D0";
  const deep = c.primary || "#1a2340";
  const barBg = c.secondary || "#2a3358";
  const disp = dispFamily(input.displayFont);

  const header = h("div", { display: "flex", flexDirection: "column", width: "72%" }, [
    ...(input.eyebrow
      ? [h("div", { display: "flex", fontFamily: disp, fontSize: "36px", color: accent, letterSpacing: "2px" }, head(input.eyebrow, "condensed"))]
      : []),
    h("div", { display: "flex", fontFamily: disp, fontSize: "84px", color: "white", lineHeight: 1.04, letterSpacing: input.displayFont === "serif" ? "0px" : "-1px", marginTop: "16px" }, head(input.headline, input.displayFont)),
    h("div", { display: "flex", width: "160px", height: "8px", background: accent, borderRadius: "4px", marginTop: "22px" }, []),
  ]);

  const rows =
    input.rows && input.rows.length > 0
      ? h(
          "div",
          { display: "flex", flexDirection: "column", gap: "30px" },
          input.rows.map((r) =>
            h("div", { display: "flex", flexDirection: "column", gap: "6px" }, [
              ...(r.label
                ? [h("div", { display: "flex", fontFamily: disp, fontSize: "38px", color: accent, letterSpacing: "1px" }, head(r.label, "condensed"))]
                : []),
              h("div", { display: "flex", fontFamily: "Poppins", fontSize: "42px", fontWeight: 700, color: "white", lineHeight: 1.18 }, r.text),
            ])
          )
        )
      : h("div", { display: "flex" }, []);

  const cta = input.cta
    ? h("div", { display: "flex", flexDirection: "column", background: barBg, borderRadius: "18px", padding: "26px 32px", borderLeft: `10px solid ${accent}` }, [
        ...(input.cta.name ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "34px", fontWeight: 800, color: "white" }, input.cta.name)] : []),
        ...(input.cta.phone || input.cta.website
          ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "27px", fontWeight: 700, color: accent, marginTop: "6px" }, [input.cta.phone, input.cta.website].filter(Boolean).join("  ·  "))]
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
      background: `linear-gradient(160deg, #0b1124 0%, ${deep} 100%)`,
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
  const disp = dispFamily(input.displayFont);

  const topBand = h("div", { display: "flex", flexDirection: "column", background: "rgba(11,17,36,0.82)", padding: "48px 56px", borderBottom: `8px solid ${accent}` }, [
    ...(input.eyebrow
      ? [h("div", { display: "flex", fontFamily: disp, fontSize: "32px", color: accent, letterSpacing: "2px", marginBottom: "12px" }, head(input.eyebrow, "condensed"))]
      : []),
    h("div", { display: "flex", width: "80%", fontFamily: disp, fontSize: "74px", color: "white", lineHeight: 1.04, letterSpacing: input.displayFont === "serif" ? "0px" : "-1px" }, head(input.headline, input.displayFont)),
  ]);

  const bottomBar = input.cta
    ? h("div", { display: "flex", flexDirection: "column", background: barBg, padding: "30px 56px", borderTop: `8px solid ${accent}` }, [
        ...(input.cta.name ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "34px", fontWeight: 800, color: "white" }, input.cta.name)] : []),
        ...(input.cta.phone || input.cta.website
          ? [h("div", { display: "flex", fontFamily: "Poppins", fontSize: "27px", fontWeight: 700, color: accent, marginTop: "6px" }, [input.cta.phone, input.cta.website].filter(Boolean).join("  ·  "))]
          : []),
      ])
    : h("div", { display: "flex" }, []);

  const overlayTree = h("div", { display: "flex", flexDirection: "column", width: "100%", height: "100%", justifyContent: "space-between", fontFamily: "Poppins" }, [topBand, bottomBar]);

  const svg = await satori(overlayTree as unknown as Parameters<typeof satori>[0], { width, height, fonts: fonts() });
  const overlayPng = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: "rgba(0,0,0,0)" }).render().asPng();

  const bg = await sharp(input.photo).resize(width, height, { fit: "cover" }).toBuffer();
  const composed = await sharp(bg).composite([{ input: Buffer.from(overlayPng), top: 0, left: 0 }]).png().toBuffer();
  return compositeLogo(composed, input.logo, width);
}
