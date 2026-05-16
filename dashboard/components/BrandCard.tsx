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
        // Base tinted surface — slightly luminous so the card pops off
        // the page even before the highlights stack on top.
        backgroundColor: "rgba(22, 20, 42, 0.62)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        // Multi-layer box-shadow does most of the "glass" reading:
        //   1) inset top highlight — specular edge catching ambient light
        //   2) inset bottom dim — defines back rim, gives the slab thickness
        //   3) inset side hints — soft vertical edge gloss
        //   4) outer drop — separates the card from the page
        // On hover, multiplies the specular and adds a violet rim glow.
        boxShadow: hovered
          ? [
              // Slightly brighter top edge (35% vs rest's 30%) — subtle
              // "catches a bit more light" on hover without flashing.
              "inset 0 1px 0 rgba(255,255,255,0.36)",
              "inset 0 -1px 0 rgba(0,0,0,0.42)",
              "inset 1px 0 0 rgba(255,255,255,0.07)",
              "inset -1px 0 0 rgba(255,255,255,0.07)",
              // Soft drop shadow lift — was 20px 50px -16px @75%.
              "0 16px 40px -16px rgba(0,0,0,0.65)",
              // Violet rim glow toned down (was 0.30 @ 32px).
              "0 0 22px rgba(139,92,255,0.14)",
            ].join(", ")
          : [
              "inset 0 1px 0 rgba(255,255,255,0.30)",
              "inset 0 -1px 0 rgba(0,0,0,0.4)",
              "inset 1px 0 0 rgba(255,255,255,0.06)",
              "inset -1px 0 0 rgba(255,255,255,0.06)",
              "0 12px 36px -16px rgba(0,0,0,0.65)",
            ].join(", "),
        transition: "box-shadow 0.3s ease, transform 0.3s ease",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {/* Specular curved highlight — radial halo at the top edge that
          reads as ambient light catching the curved top of a glass piece.
          Always visible. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 110% 50% at 50% -10%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 28%, transparent 55%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Sheen sweep — diagonal light streak that slides across on hover.
          Off-screen at rest, slides in during 700ms when hovered. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          background:
            "linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%)",
          backgroundSize: "250% 100%",
          backgroundPosition: hovered ? "-30% 0" : "120% 0",
          transition: "background-position 0.7s ease",
        }}
      />

      {/* Card content sits above both highlight layers */}
      <div style={{ position: "relative", zIndex: 1 }}>
      {/* Brand header */}
      <div className="flex items-center justify-between" style={{ marginBottom: "18px" }}>
        <div className="flex items-center" style={{ gap: "10px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: brand.colorPrimary || "#8b5cff",
              flexShrink: 0,
              boxShadow: `0 0 12px ${brand.colorPrimary || "#8b5cff"}`,
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
        <ProgressRow label="Generated" value={generated} total={stats.total} pct={genPct} color="#3b81ff" />
        <ProgressRow label="Approved" value={approved} total={stats.total} pct={approvedPct} color="#7de29c" />
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
        <span style={{ textTransform: "uppercase", fontWeight: 600, color: "#6f6f7e" }}>{label}</span>
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
            boxShadow: `0 0 10px ${color}55`,
          }}
        />
      </div>
    </div>
  );
}
