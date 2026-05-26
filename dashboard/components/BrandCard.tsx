"use client";

import Link from "next/link";
import { cardBackdropFilter } from "@/lib/glass-style";

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
  colorSecondary?: string | null;
  colorAccent?: string | null;
  handle: string;
  cadence: string;
  stats: BrandStats;
  voiceConfidence?: "high" | "low" | "missing" | null;
  colorConfidence?: "high" | "low" | "missing" | null;
  nextPost?: {
    date: string;
    concept: string | null;
    status: string;
  } | null;
}

export default function BrandCard({ brand }: { brand: Brand }) {
  const { stats } = brand;
  const approved = stats.approved + stats.scheduled + stats.posted;
  const generated = stats.has_image;
  const genPct = stats.total > 0 ? Math.round((generated / stats.total) * 100) : 0;
  const approvedPct = stats.total > 0 ? Math.round((approved / stats.total) * 100) : 0;
  const needsReview = stats.in_review;

  return (
    <Link
      href={`/dashboard/brand/${brand.id}`}
      className="block lg-surface--card"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "20px 22px",
        borderRadius: "16px",
        textDecoration: "none",
        color: "inherit",
        ...cardBackdropFilter,
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
            <SwatchRow
              primary={brand.colorPrimary}
              secondary={brand.colorSecondary}
              accent={brand.colorAccent}
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
          <div className="flex items-center" style={{ gap: "6px" }}>
            <ReadinessPill
              voice={brand.voiceConfidence}
              color={brand.colorConfidence}
            />
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

        {brand.nextPost && <NextPostRow next={brand.nextPost} />}
      </div>
    </Link>
  );
}

/**
 * 3-dot brand identity row. Primary always shown; secondary + accent
 * shown when set. Null accent (intentional, like Doug) collapses
 * gracefully to 2 dots. Brands with no palette at all render a
 * single neutral dot.
 */
function SwatchRow({
  primary,
  secondary,
  accent,
}: {
  primary: string | null | undefined;
  secondary: string | null | undefined;
  accent: string | null | undefined;
}) {
  const colors = [primary, secondary, accent].filter(
    (c): c is string => !!c,
  );
  if (colors.length === 0) {
    return (
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: "#8b5cff",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      className="flex items-center"
      style={{ gap: "3px", flexShrink: 0 }}
      title={colors.join(" / ")}
    >
      {colors.map((c, i) => (
        <div
          key={`${c}-${i}`}
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: c,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Readiness state derived from voice + color confidence flags on the
 * brand row. Brands at status=high on both render "READY" in a muted
 * green; missing flags surface as amber warnings so the operator can
 * see at a glance which brands can't dispatch through brand-render.
 */
function ReadinessPill({
  voice,
  color,
}: {
  voice: "high" | "low" | "missing" | null | undefined;
  color: "high" | "low" | "missing" | null | undefined;
}) {
  const voiceOk = voice === "high";
  const colorOk = color === "high";
  if (voice == null && color == null) return null;

  let label: string;
  let palette: { bg: string; fg: string; border: string };

  if (voiceOk && colorOk) {
    label = "READY";
    palette = { bg: "rgba(74, 222, 128, 0.10)", fg: "#86efac", border: "rgba(74, 222, 128, 0.30)" };
  } else if (!voiceOk && !colorOk) {
    label = "BOTH TBD";
    palette = { bg: "rgba(251, 146, 60, 0.12)", fg: "#fdba74", border: "rgba(251, 146, 60, 0.32)" };
  } else if (!voiceOk) {
    label = "VOICE TBD";
    palette = { bg: "rgba(251, 191, 36, 0.12)", fg: "#fcd34d", border: "rgba(251, 191, 36, 0.30)" };
  } else {
    label = "PALETTE TBD";
    palette = { bg: "rgba(251, 191, 36, 0.12)", fg: "#fcd34d", border: "rgba(251, 191, 36, 0.30)" };
  }

  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: "999px",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function NextPostRow({
  next,
}: {
  next: { date: string; concept: string | null; status: string };
}) {
  const [y, m, d] = next.date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const label = dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dt.getTime() - today.getTime()) / 86_400_000);
  const relative =
    diffDays === 0
      ? "today"
      : diffDays === 1
        ? "tomorrow"
        : diffDays > 1 && diffDays <= 7
          ? `in ${diffDays} days`
          : null;

  return (
    <div
      style={{
        marginTop: "14px",
        paddingTop: "12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#8a8a98",
          fontWeight: 600,
          marginBottom: "4px",
        }}
      >
        Next post
      </div>
      <div
        className="flex items-baseline"
        style={{ gap: "8px", fontSize: "12px", color: "#dcdce4" }}
      >
        <span style={{ color: "white", fontWeight: 500 }}>{label}</span>
        {relative && (
          <span style={{ color: "#c084fc", fontSize: "11px" }}>
            ({relative})
          </span>
        )}
      </div>
      {next.concept && (
        <div
          style={{
            marginTop: "3px",
            fontSize: "11px",
            color: "#9999a6",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {next.concept}
        </div>
      )}
    </div>
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
