import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

// Renders a designed post graphic with REAL fonts (Satori → SVG → PNG) so text
// is pixel-perfect — the fix for AI image models garbling words. nano banana
// makes the photo; this renders the headline/CTA/badges; sharp composites.
//
// Fonts are bundled in lib/autopilot/fonts/ (copied from @fontsource) so they
// ship with the serverless function — see next.config outputFileTracingIncludes.

const FONT_DIR = path.join(process.cwd(), "lib", "autopilot", "fonts");

type LoadedFont = {
  name: string;
  data: Buffer;
  weight: 400 | 700 | 800;
  style: "normal";
};
let fontsCache: LoadedFont[] | null = null;
function fonts(): LoadedFont[] {
  if (!fontsCache) {
    fontsCache = [
      { name: "Anton", data: readFileSync(path.join(FONT_DIR, "anton-400.woff")), weight: 400, style: "normal" },
      { name: "Jakarta", data: readFileSync(path.join(FONT_DIR, "jakarta-700.woff")), weight: 700, style: "normal" },
      { name: "Jakarta", data: readFileSync(path.join(FONT_DIR, "jakarta-800.woff")), weight: 800, style: "normal" },
    ];
  }
  return fontsCache;
}

export type DesignColors = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  palette?: string[] | null;
};
export type DesignRow = { label?: string | null; text: string };
export type DesignCardInput = {
  width?: number;
  height?: number;
  colors: DesignColors;
  eyebrow?: string | null;
  headline: string;
  rows?: DesignRow[];
  cta?: { name?: string | null; phone?: string | null; website?: string | null } | null;
};

// Plain Satori element objects (no JSX needed in a server lib).
type El = { type: string; props: { style: Record<string, unknown>; children: unknown } };
const h = (type: string, style: Record<string, unknown>, children: unknown = []): El => ({
  type,
  props: { style, children },
});

export async function renderDesignedCard(input: DesignCardInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const c = input.colors ?? {};
  const accent = c.primary || (c.palette && c.palette[0]) || "#90B0D0";
  const deep = c.accent || "#1a2340";
  const barBg = c.secondary || "#2a3358";

  const header = h("div", { display: "flex", flexDirection: "column" }, [
    ...(input.eyebrow
      ? [h("div", { display: "flex", fontFamily: "Anton", fontSize: "34px", color: accent, letterSpacing: "2px", marginBottom: "16px" }, input.eyebrow.toUpperCase())]
      : []),
    h("div", { display: "flex", fontFamily: "Anton", fontSize: "86px", color: "white", lineHeight: 1.02, letterSpacing: "-1px" }, input.headline),
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
                ? [h("div", { display: "flex", fontFamily: "Anton", fontSize: "38px", color: accent, letterSpacing: "1px" }, r.label.toUpperCase())]
                : []),
              h("div", { display: "flex", fontSize: "42px", fontWeight: 700, color: "white", lineHeight: 1.15 }, r.text),
            ])
          )
        )
      : h("div", { display: "flex" }, []);

  const cta = input.cta
    ? h("div", { display: "flex", flexDirection: "column", background: barBg, borderRadius: "18px", padding: "26px 32px", borderLeft: `10px solid ${accent}` }, [
        ...(input.cta.name ? [h("div", { display: "flex", fontSize: "34px", fontWeight: 800, color: "white" }, input.cta.name)] : []),
        ...(input.cta.phone || input.cta.website
          ? [h("div", { display: "flex", fontSize: "28px", fontWeight: 700, color: accent, marginTop: "6px" }, [input.cta.phone, input.cta.website].filter(Boolean).join("  ·  "))]
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
      padding: "72px 64px",
      justifyContent: "space-between",
      fontFamily: "Jakarta",
    },
    [header, rows, cta]
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: fonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  return Buffer.from(png);
}

export type PhotoOverlayInput = {
  photo: Buffer;
  width?: number;
  height?: number;
  colors: DesignColors;
  eyebrow?: string | null;
  headline: string;
  cta?: { name?: string | null; phone?: string | null; website?: string | null } | null;
};

/**
 * "Photo + text" mode: nano banana makes the photo, this overlays the headline
 * on a top legibility band and a CTA bar at the bottom (real fonts, perfect
 * text), then sharp composites it over the photo.
 */
export async function renderPhotoOverlay(input: PhotoOverlayInput): Promise<Buffer> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1350;
  const c = input.colors ?? {};
  const accent = c.primary || (c.palette && c.palette[0]) || "#90B0D0";
  const barBg = c.accent || "#1a2340";

  const topBand = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      background: "rgba(11,17,36,0.82)",
      padding: "48px 56px",
      borderBottom: `8px solid ${accent}`,
    },
    [
      ...(input.eyebrow
        ? [h("div", { display: "flex", fontFamily: "Anton", fontSize: "32px", color: accent, letterSpacing: "2px", marginBottom: "12px" }, input.eyebrow.toUpperCase())]
        : []),
      h("div", { display: "flex", fontFamily: "Anton", fontSize: "76px", color: "white", lineHeight: 1.02, letterSpacing: "-1px" }, input.headline),
    ]
  );

  const bottomBar = input.cta
    ? h("div", { display: "flex", flexDirection: "column", background: barBg, padding: "30px 56px", borderTop: `8px solid ${accent}` }, [
        ...(input.cta.name ? [h("div", { display: "flex", fontSize: "34px", fontWeight: 800, color: "white" }, input.cta.name)] : []),
        ...(input.cta.phone || input.cta.website
          ? [h("div", { display: "flex", fontSize: "28px", fontWeight: 700, color: accent, marginTop: "6px" }, [input.cta.phone, input.cta.website].filter(Boolean).join("  ·  "))]
          : []),
      ])
    : h("div", { display: "flex" }, []);

  const overlayTree = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      justifyContent: "space-between",
      fontFamily: "Jakarta",
    },
    [topBand, bottomBar]
  );

  const svg = await satori(overlayTree as unknown as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: fonts(),
  });
  const overlayPng = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();

  const bg = await sharp(input.photo).resize(width, height, { fit: "cover" }).toBuffer();
  return sharp(bg)
    .composite([{ input: Buffer.from(overlayPng), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
