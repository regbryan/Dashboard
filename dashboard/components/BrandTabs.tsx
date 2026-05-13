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
const FLARE = 20;

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
            {/* Active flares — concave corners that merge into the card */}
            {active && (
              <>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: -FLARE,
                    width: FLARE,
                    height: FLARE,
                    // Gradient center at TOP-RIGHT of this pseudo (= tab's
                    // bottom-left corner). Inside the radius: transparent
                    // (concave cutout). Outside: card color filling the
                    // bottom-left of the pseudo and bleeding into the card.
                    background: `radial-gradient(circle at top right, transparent ${FLARE}px, ${TAB_CARD_BG} ${FLARE + 0.5}px)`,
                    pointerEvents: "none",
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: -FLARE,
                    width: FLARE,
                    height: FLARE,
                    // Mirror of the left flare — gradient center at TOP-LEFT
                    // of this pseudo (= tab's bottom-right corner).
                    background: `radial-gradient(circle at top left, transparent ${FLARE}px, ${TAB_CARD_BG} ${FLARE + 0.5}px)`,
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
