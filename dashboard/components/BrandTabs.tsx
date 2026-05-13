"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Premium folder tabs that flow into a content card via concave corner
 * flares — the active tab's bottom-left and bottom-right curves spread
 * outward and merge into the rounded top of the surface below. Done
 * with radial-gradient pseudo-elements (cheap, no SVG, no JS).
 *
 * Inactive tabs are quiet text on the page background with a subtle
 * hover. No color accent.
 */
const SECTIONS = [
  { label: "Designs", suffix: "" },
  { label: "Calendar", suffix: "/calendar" },
  { label: "Brand Kit", suffix: "/kit" },
  { label: "Assets", suffix: "/assets" },
] as const;

export const TAB_CARD_BG = "#1e1e30";
// Page bg color the circle "punches through" with — must match the
// surface immediately behind the tabs so the bite reads as page, not
// some other color.
const PAGE_BG = "#07070e";
// CSS-Tricks "Tabs with Round Out Borders" two-layer technique:
//   1. SQUARE (card color, just outside the tab) — extends the card up
//      beside the tab so we have a card-colored surface to curve out of
//   2. CIRCLE (page color, double the square size, border-radius 50%)
//      sits ON TOP of the square AND overlaps the tab's bottom corner.
//      The rounded edge bites a quarter-circle out of both, producing
//      the concave outward swoop that connects tab → card.
const SQ = 14;
const CIRCLE = SQ * 2;

export default function BrandTabs({ slug }: { slug: string }) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/brand/${slug}`;

  const activeSuffix = (() => {
    let match = "";
    for (const s of SECTIONS) {
      if (s.suffix === "") continue;
      const full = `${base}${s.suffix}`;
      if (pathname === full || pathname.startsWith(`${full}/`)) {
        if (s.suffix.length > match.length) match = s.suffix;
      }
    }
    if (!match && (pathname === base || pathname === `${base}/`)) match = "";
    return match;
  })();

  return (
    <div
      role="tablist"
      aria-label="Brand sections"
      className="flex items-end justify-center overflow-x-auto"
      style={{ gap: "2px", paddingTop: "8px", marginBottom: "-1px" }}
    >
      {SECTIONS.map((s) => {
        const href = `${base}${s.suffix}`;
        const active = s.suffix === activeSuffix;
        return (
          <Link
            key={s.label}
            href={href}
            role="tab"
            aria-selected={active}
            className={
              "group/tab relative whitespace-nowrap transition-colors duration-200 ease-out " +
              (active
                ? "text-white"
                : "text-[#8a8a96] hover:text-[#dcdce4]")
            }
            style={{
              padding: active ? "14px 28px 18px" : "10px 22px 14px",
              fontSize: "14px",
              fontWeight: active ? 600 : 500,
              letterSpacing: active ? "-0.005em" : "0.005em",
              textDecoration: "none",
              background: active ? TAB_CARD_BG : "transparent",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
              marginBottom: active ? "0" : "0",
              zIndex: active ? 2 : 1,
            }}
          >
            {/* Active flares — CSS-Tricks "Round Out Borders" technique.
                Two stacked elements per side: card-color square extends
                the card up beside the tab; page-color circle on top
                bites a curve out of both the square AND the tab's
                bottom corner. */}
            {active && (
              <>
                {/* LEFT side — square (card color, beneath) */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: -SQ,
                    width: SQ,
                    height: SQ,
                    background: TAB_CARD_BG,
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                {/* LEFT side — circle (page bg, on top, rounds the corner out) */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: -CIRCLE,
                    width: CIRCLE,
                    height: CIRCLE,
                    borderRadius: "50%",
                    background: PAGE_BG,
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
                {/* RIGHT side — mirror */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: -SQ,
                    width: SQ,
                    height: SQ,
                    background: TAB_CARD_BG,
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: -CIRCLE,
                    width: CIRCLE,
                    height: CIRCLE,
                    borderRadius: "50%",
                    background: PAGE_BG,
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
              </>
            )}

            {/* Inactive hover surface */}
            {!active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-1 top-1 bottom-0 rounded-t-[12px] opacity-0 transition-opacity duration-200 ease-out group-hover/tab:opacity-100"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            )}

            <span className="relative">{s.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
