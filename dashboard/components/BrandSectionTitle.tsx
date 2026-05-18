"use client";

import { usePathname } from "next/navigation";

type SectionKey = "designs" | "calendar" | "kit" | "assets";

const SECTION_TITLES: Array<{ suffix: string; key: SectionKey; label: string }> = [
  { suffix: "/calendar", key: "calendar", label: "Calendar" },
  { suffix: "/kit", key: "kit", label: "Brand Kit" },
  { suffix: "/assets", key: "assets", label: "Assets" },
];

export default function BrandSectionTitle({
  slug,
  subtitles,
}: {
  slug: string;
  subtitles: Record<SectionKey, string>;
}) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/brand/${slug}`;

  let key: SectionKey = "designs";
  let label = "Designs";
  for (const s of SECTION_TITLES) {
    const full = `${base}${s.suffix}`;
    if (pathname === full || pathname.startsWith(`${full}/`)) {
      key = s.key;
      label = s.label;
      break;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: "white",
          letterSpacing: "-0.01em",
          margin: 0,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </h1>
      <p
        style={{
          margin: 0,
          color: "#9999a6",
          fontSize: "13px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "60vw",
        }}
      >
        {subtitles[key]}
      </p>
    </div>
  );
}
