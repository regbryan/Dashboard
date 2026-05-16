import { FALLBACK_COLORS, type VideoBrandKit } from "../types";

/**
 * Color resolution — prepends "#" to bare hex values and falls back
 * to neutral defaults when the brand kit is incomplete. Compositions
 * call this once at the top and use the returned object everywhere.
 */
export function resolveColors(kit: VideoBrandKit) {
  const c = kit.colors;
  return {
    primary: hash(c.primary || FALLBACK_COLORS.primary),
    secondary: hash(c.secondary || FALLBACK_COLORS.secondary),
    accent: hash(c.accent || FALLBACK_COLORS.accent),
    background: hash(c.background || FALLBACK_COLORS.background),
    foreground: hash(c.foreground || FALLBACK_COLORS.foreground),
  };
}

function hash(hex: string): string {
  const trimmed = hex.trim().replace(/^#/, "");
  return `#${trimmed}`;
}

/** Convert a hex color to "r,g,b" for rgba() composition. */
export function hexToRgb(hex: string): string {
  const h = hex.replace(/^#/, "");
  const full =
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
