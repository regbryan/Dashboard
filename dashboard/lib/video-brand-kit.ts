import "server-only";
import { loadBrandKit } from "./brand-kit";
import type { VideoBrandKit } from "../remotion/types";

/**
 * Map the Dashboard's loadBrandKit() result down to the
 * serializable VideoBrandKit shape that Remotion compositions
 * accept. Stays defensive — every field has a fallback so the
 * render can't fail on a half-populated brand.
 */
export async function loadVideoBrandKit(
  slug: string
): Promise<VideoBrandKit | null> {
  const view = await loadBrandKit(slug);
  if (!view) return null;
  const { brand, kit, defaultLogoUrl } = view;

  // Pull fonts out of kit.fonts JSON. Schema is loose — we accept
  // either {display, body} or {heading, body} or a single string.
  const fontsJson = (kit?.fonts ?? {}) as Record<string, unknown>;
  const displayFont =
    pickString(fontsJson, ["display", "heading", "headline", "title"]) ??
    "Plus Jakarta Sans";
  const bodyFont =
    pickString(fontsJson, ["body", "text", "paragraph"]) ?? "Inter";

  // Pull colors. Prefer brand_kits.colors JSON (richer) over the
  // legacy brands.color_* columns.
  const colorsJson = (kit?.colors ?? {}) as Record<string, unknown>;
  const primary =
    pickString(colorsJson, ["primary"]) ?? brand.color_primary ?? "1a1a2e";
  const secondary =
    pickString(colorsJson, ["secondary"]) ?? brand.color_secondary ?? "13121f";
  const accent =
    pickString(colorsJson, ["accent"]) ?? brand.color_accent ?? "c084fc";
  const background = pickString(colorsJson, ["background", "bg"]);
  const foreground = pickString(colorsJson, ["foreground", "fg", "text"]);

  return {
    slug,
    name: brand.name,
    handle: brand.handle ?? undefined,
    archetype: kit?.archetype ?? undefined,
    colors: {
      primary: stripHash(primary),
      secondary: stripHash(secondary),
      accent: stripHash(accent),
      ...(background ? { background: stripHash(background) } : {}),
      ...(foreground ? { foreground: stripHash(foreground) } : {}),
    },
    fonts: { display: displayFont, body: bodyFont },
    ...(defaultLogoUrl ? { logoUrl: defaultLogoUrl } : {}),
  };
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function stripHash(hex: string): string {
  return hex.replace(/^#/, "");
}
