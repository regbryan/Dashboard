"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Brand sub-nav rendered as premium file-folder tabs.
 *
 * Restraint over decoration: no stripe across the active tab, no
 * heavy borders. Active state is communicated by elevation — a card
 * surface with a soft inner top highlight and a faint accent glow
 * radiating upward. Inactive tabs are quiet text that brighten on
 * hover. The tab strip's separator line is "punched" by the active
 * tab so the folder connects seamlessly to the content surface.
 *
 * Active suffix uses longest-match on usePathname() so nested routes
 * (e.g. /post/[id]) keep the right tab highlighted.
 */
const SECTIONS = [
  { label: "Designs", suffix: "" },
  { label: "Calendar", suffix: "/calendar" },
  { label: "Brand Kit", suffix: "/kit" },
  { label: "Assets", suffix: "/assets" },
] as const;

const ACTIVE_BG = "#0f0f1a";

export default function BrandTabs({
  slug,
  accentColor = "#8b5cff",
}: {
  slug: string;
  accentColor?: string;
}) {
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
      className="flex items-end gap-1 overflow-x-auto"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginBottom: "-1px",
        paddingTop: "10px",
      }}
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
              "group/tab relative whitespace-nowrap transition-all duration-200 ease-out " +
              (active
                ? "text-white"
                : "text-[#7a7a88] hover:text-[#dcdce4]")
            }
            style={{
              padding: active ? "12px 22px 14px" : "9px 20px 11px",
              fontSize: "13px",
              fontWeight: active ? 600 : 500,
              letterSpacing: active ? "-0.005em" : "0",
              textDecoration: "none",
              background: active
                ? `linear-gradient(180deg, #16162b 0%, ${ACTIVE_BG} 65%, ${ACTIVE_BG} 100%)`
                : "transparent",
              border: active
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid transparent",
              borderBottomColor: active ? ACTIVE_BG : "transparent",
              borderTopLeftRadius: "11px",
              borderTopRightRadius: "11px",
              marginBottom: active ? "-1px" : "0",
              boxShadow: active
                ? [
                    `0 -14px 28px -16px ${accentColor}33`,
                    "inset 0 1px 0 rgba(255,255,255,0.06)",
                  ].join(", ")
                : undefined,
              zIndex: active ? 2 : 1,
            }}
          >
            {/* Inactive hover surface — soft top fade */}
            {!active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-1 top-1 bottom-0 rounded-t-[10px] opacity-0 transition-opacity duration-200 ease-out group-hover/tab:opacity-100"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
                }}
              />
            )}
            <span className="relative">{s.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
