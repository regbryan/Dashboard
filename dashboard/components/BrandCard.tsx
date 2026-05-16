"use client";

import Link from "next/link";
import { useState } from "react";

interface BrandStats {
  not_started: number;
  generating: number;
  in_review: number;
  changes_requested: number;
  approved: number;
  scheduled: number;
  posted: number;
  total: number;
  has_image: number;
}

interface Brand {
  id: string;
  name: string;
  colorPrimary: string;
  handle: string;
  cadence: string;
  stats: BrandStats;
}

export default function BrandCard({ brand }: { brand: Brand }) {
  const { stats } = brand;
  const approved = stats.approved + stats.scheduled + stats.posted;
  const generated = stats.has_image;
  const genPct = stats.total > 0 ? Math.round((generated / stats.total) * 100) : 0;
  const approvedPct = stats.total > 0 ? Math.round((approved / stats.total) * 100) : 0;
  const needsReview = stats.in_review;

  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/dashboard/brand/${brand.id}`}
      className="block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "20px 22px",
        borderRadius: "16px",
        textDecoration: "none",
        color: "inherit",
        // Liquid Glass — Shiny/Specular variant.
        // Semi-transparent base so backdrop-filter has something to
        // refract; lets the page bg show subtly through the card.
        backgroundColor: "rgba(19, 18, 31, 0.7)",
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
        // Hover ONLY changes border color — no lift, no sheen sweep,
        // no colored glow. Just a brighter ring to signal clickable.
        border: `1px solid ${hovered ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.18)"}`,
        transition: "border-color 0.2s ease",
      }}
    >
      {/* Specular curved highlight at the top edge — the "shine"
          character of Liquid Glass. Stays static, always visible. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 110% 50% at 50% -10%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 28%, transparent 55%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Card content above the highlight layer */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Brand header */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: "18px" }}
        >
          <div className="flex items-center" style={{ gap: "10px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: brand.colorPrimary || "#8b5cff",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "white",
                letterSpacing: "-0.01em",
              }}
            >
              {brand.name}
            </span>
          </div>
          {needsReview > 0 && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "999px",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                background: "rgba(192,132,252,0.14)",
                color: "#e9d5ff",
                border: "1px solid rgba(192,132,252,0.3)",
              }}
            >
              {needsReview} TO REVIEW
            </span>
          )}
        </div>

        {/* Progress bars */}
        <div className="flex flex-col" style={{ gap: "14px" }}>
          <ProgressRow
            label="Generated"
            value={generated}
            total={stats.total}
            pct={genPct}
            color="#3b81ff"
          />
          <ProgressRow
            label="Approved"
            value={approved}
            total={stats.total}
            pct={approvedPct}
            color="#7de29c"
          />
        </div>
      </div>
    </Link>
  );
}

function ProgressRow({
  label,
  value,
  total,
  pct,
  color,
}: {
  label: string;
  value: number;
  total: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div
        className="flex justify-between"
        style={{
          fontSize: "11px",
          color: "#9999a6",
          letterSpacing: "0.06em",
          marginBottom: "6px",
        }}
      >
        <span style={{ textTransform: "uppercase", fontWeight: 600, color: "#8a8a98" }}>
          {label}
        </span>
        <span style={{ color: "#bfbfcc" }}>
          <strong style={{ color: "white", fontWeight: 600 }}>{value}</strong> / {total}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: "4px",
          background: "rgba(255,255,255,0.06)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: "999px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
