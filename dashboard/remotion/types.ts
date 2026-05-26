/**
 * Shared types for Remotion compositions. Kept independent of the
 * Supabase loader (lib/brand-kit.ts) so compositions stay pure
 * functions of their props — easy to preview in Remotion Studio
 * without touching the DB, and trivially serializable for Lambda
 * inputProps later.
 *
 * The Dashboard's loadBrandKit() result gets mapped down to
 * VideoBrandKit in the /api/render-reel route.
 */

export type VideoBrandKit = {
  /** Brand slug — also used to name the output file. */
  slug: string;
  /** Display name shown in lower thirds. */
  name: string;
  /** @instagram handle, with or without the @. */
  handle?: string;
  /** Hex colors, no #. Falls back to a sober neutral if missing. */
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    /** Optional background; defaults to near-black tinted toward primary. */
    background?: string;
    /** Optional foreground/text; defaults to near-white tinted toward primary. */
    foreground?: string;
  };
  /** Google Font family names. Pair = display + body. */
  fonts: {
    display: string;
    body: string;
  };
  /**
   * Jungian archetype drives subtle motion personality:
   * - "Hero" / "Ruler" → confident, bold, slower reveals
   * - "Sage" / "Creator" → measured, typographic-led
   * - "Jester" / "Lover" → playful, faster, more curves
   * - "Caregiver" / "Everyman" → warm, soft easings
   * - "Outlaw" / "Magician" → tight, contrast-heavy, snap cuts
   * Default: "Sage".
   */
  archetype?: string;
  /** Optional logo image (public URL). Composited as lower-third sting. */
  logoUrl?: string;
};

/** Props for QuoteCard composition. */
export type QuoteCardProps = {
  brandKit: VideoBrandKit;
  quote: string;
  attribution?: string;
};

/** Props for StatsReel composition. */
export type StatsReelProps = {
  brandKit: VideoBrandKit;
  headline: string;
  stat: string; // e.g. "94%"
  statLabel: string; // e.g. "of homeowners delayed AC service"
  footer?: string;
};

/** Props for ProductReveal composition. */
export type ProductRevealProps = {
  brandKit: VideoBrandKit;
  headline: string;
  subhead?: string;
  imageUrl: string;
  cta?: string;
};

/** Default colors when a brand kit is missing fields. Neutral but tinted. */
export const FALLBACK_COLORS = {
  primary: "1a1a2e",
  secondary: "13121f",
  accent: "c084fc",
  background: "0a0a14",
  foreground: "f4f4f5",
} as const;
