"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sticky tab strip rendered above every page inside a brand. Keeps
 * Designs / Calendar / Brand Kit / Assets one click away no matter how
 * far the operator has scrolled.
 *
 * Active state computed from usePathname() with longest-suffix match so
 * nested routes (e.g. /calendar/foo) keep the right tab highlighted.
 */
const SECTIONS = [
  { label: "Designs", suffix: "" },
  { label: "Calendar", suffix: "/calendar" },
  { label: "Brand Kit", suffix: "/kit" },
  { label: "Assets", suffix: "/assets" },
] as const;

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
    <nav
      role="tablist"
      aria-label="Brand sections"
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        overflowX: "auto",
        borderBottom: "1px solid #1a1a2e",
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
            style={{
              position: "relative",
              padding: "12px 18px",
              fontSize: "14px",
              fontWeight: active ? 600 : 500,
              color: active ? "white" : "#9999a6",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "color 0.15s ease",
            }}
          >
            {s.label}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: "14px",
                right: "14px",
                bottom: "-1px",
                height: "2px",
                borderRadius: "2px 2px 0 0",
                background: accentColor,
                opacity: active ? 1 : 0,
                boxShadow: active ? `0 0 12px ${accentColor}80` : undefined,
                transition: "opacity 0.15s ease",
              }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
