"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * File-drawer tabs. Each section reads as the top edge of a manila
 * folder sitting in a drawer — inactive folders are recessed slightly,
 * the active one is pulled forward with a clear elevation shadow and
 * sits flush against the content surface below.
 *
 * No colored accent — depth alone communicates which folder is open.
 * Active state computed via longest-suffix pathname match.
 */
const SECTIONS = [
  { label: "Designs", suffix: "" },
  { label: "Calendar", suffix: "/calendar" },
  { label: "Brand Kit", suffix: "/kit" },
  { label: "Assets", suffix: "/assets" },
] as const;

const ACTIVE_BG = "#15151f";
const INACTIVE_BG = "#0c0c14";
const RIM = "rgba(255,255,255,0.06)";

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
      className="flex items-end overflow-x-auto"
      style={{
        gap: "2px",
        borderBottom: `1px solid ${RIM}`,
        marginBottom: "-1px",
        paddingTop: "16px",
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
                : "text-[#8a8a96] hover:text-[#cfcfd8]")
            }
            style={{
              // Active sits ~5px taller so it reads as pulled forward
              padding: active ? "13px 22px 14px" : "8px 20px 10px",
              fontSize: "13px",
              fontWeight: active ? 600 : 500,
              letterSpacing: active ? "-0.005em" : "0.005em",
              textDecoration: "none",
              // Subtle vertical gradient on active for a paper-like sheen;
              // flat muted fill on inactive so they recede.
              background: active
                ? `linear-gradient(180deg, #1c1c2a 0%, ${ACTIVE_BG} 60%, ${ACTIVE_BG} 100%)`
                : INACTIVE_BG,
              border: `1px solid ${RIM}`,
              // Bottom of active tab merges into the content surface
              borderBottomColor: active ? ACTIVE_BG : RIM,
              // Folder-top silhouette: rounded top, square bottom corners
              borderTopLeftRadius: "9px",
              borderTopRightRadius: "9px",
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              // Active "punches through" the drawer rim
              marginBottom: active ? "-1px" : "0",
              boxShadow: active
                ? [
                    // Soft elevation lift — folder pulled out toward viewer
                    "0 -1px 0 rgba(255,255,255,0.04) inset",
                    "0 10px 22px -14px rgba(0,0,0,0.6)",
                    "0 2px 0 rgba(0,0,0,0.35) inset",
                  ].join(", ")
                : [
                    // Inactive folders sit slightly recessed
                    "0 1px 0 rgba(0,0,0,0.25) inset",
                  ].join(", "),
              zIndex: active ? 2 : 1,
            }}
          >
            {/* Inactive hover surface — paper brightens slightly */}
            {!active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-t-[9px] opacity-0 transition-opacity duration-200 ease-out group-hover/tab:opacity-100"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 60%, transparent 100%)",
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
