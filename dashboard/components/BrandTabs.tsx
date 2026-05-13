"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * File-folder tabs above every brand sub-route. The active tab sits
 * forward — same fill as the content surface below — with rounded top
 * corners and a 1px negative margin-bottom so its lower edge overlaps
 * the container's separator line, visually merging tab + content into
 * a single folder.
 *
 * Active state via longest-suffix pathname match so nested routes keep
 * the right tab highlighted (e.g. /post/[id] still reads as Designs).
 */
const SECTIONS = [
  { label: "Designs", suffix: "" },
  { label: "Calendar", suffix: "/calendar" },
  { label: "Brand Kit", suffix: "/kit" },
  { label: "Assets", suffix: "/assets" },
] as const;

const FOLDER_BG = "#0f0f1a"; // matches PostCard / BrandKitPanel surface
const FOLDER_BORDER = "#1a1a2e";
const MUTED_FILL = "#0a0a14";

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
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "4px",
        borderBottom: `1px solid ${FOLDER_BORDER}`,
        marginBottom: "-1px", // sits flush over the next surface's top edge
        overflowX: "auto",
        paddingTop: "6px",
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
              padding: active ? "11px 20px 12px" : "9px 18px 10px",
              fontSize: "13px",
              fontWeight: active ? 600 : 500,
              color: active ? "white" : "#9999a6",
              textDecoration: "none",
              whiteSpace: "nowrap",
              background: active ? FOLDER_BG : MUTED_FILL,
              border: `1px solid ${FOLDER_BORDER}`,
              borderTop: active
                ? `2px solid ${accentColor}`
                : `1px solid ${FOLDER_BORDER}`,
              borderBottomColor: active ? FOLDER_BG : FOLDER_BORDER,
              borderTopLeftRadius: "9px",
              borderTopRightRadius: "9px",
              marginBottom: active ? "-1px" : "0",
              boxShadow: active
                ? `0 -6px 14px -8px ${accentColor}40`
                : undefined,
              transition: "color 0.15s ease, background 0.15s ease",
              zIndex: active ? 2 : 1,
            }}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
