"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Brand sub-nav — shiny gradient pills matching the dashboard's
 * existing ShinyButton language. Active tab gets the full sp-shiny
 * primary treatment: violet vertical gradient, 1px inner top
 * highlight, violet rim, soft outer glow. Inactive tabs are quiet
 * text that brighten on hover.
 *
 * No folder shapes, no SVG hacks, no Framer Motion dep — just the
 * tokens already established in globals.css. Active suffix computed
 * via longest-match on usePathname() so nested routes stay accurate.
 */
const SECTIONS = [
  { label: "Designs", suffix: "" },
  { label: "Calendar", suffix: "/calendar" },
  { label: "Brand Kit", suffix: "/kit" },
  { label: "Assets", suffix: "/assets" },
] as const;

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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "5px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
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
            className="brand-tab"
            style={{
              position: "relative",
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: 500,
              letterSpacing: "0.01em",
              lineHeight: 1,
              color: active ? "white" : "rgba(255,255,255,0.55)",
              textDecoration: "none",
              borderRadius: "999px",
              whiteSpace: "nowrap",
              background: active
                ? "linear-gradient(180deg, #1e1838 0%, #0c0a16 100%)"
                : "transparent",
              border: active
                ? "1px solid rgba(139,92,255,0.35)"
                : "1px solid transparent",
              boxShadow: active
                ? "inset 0 1px 0 rgba(255,255,255,0.12)"
                : undefined,
              transition:
                "color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.3s ease",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              if (active) return;
              e.currentTarget.style.color = "white";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              if (active) return;
              e.currentTarget.style.color = "rgba(255,255,255,0.55)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
