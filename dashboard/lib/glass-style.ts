/**
 * Shared inline-style fragments for liquid-glass surfaces on the
 * dashboard.
 *
 * Why these live as inline JS values instead of a CSS class:
 *   The Tailwind v4 + LightningCSS pipeline collapses
 *   `backdrop-filter` declarations down to `-webkit-backdrop-filter`
 *   only when Safari is in browserslist. Chromium 146+ (and the
 *   Electron build inside Claude Preview) reports
 *   `CSS.supports('-webkit-backdrop-filter')` as `false`, so the
 *   property silently drops. Declaring it inline on the element
 *   sidesteps the LightningCSS pass entirely.
 *
 * The companion `.lg-surface--card` class in app/globals.css still
 * handles background, border, gradient, box-shadow, and hover.
 * Only the blur lives here.
 */
export const cardBackdropFilter = {
  backdropFilter: "blur(10px) saturate(145%)",
  WebkitBackdropFilter: "blur(10px) saturate(145%)",
} as const;
