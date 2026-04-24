const LABELS: Record<string, string> = {
  not_started: "Approval Not Started",
};

const COLORS: Record<string, { color: string; bg: string; border: string }> = {
  not_started: {
    color: "#bfbfcc",
    bg: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.12)",
  },
  generating: {
    color: "#fbd38d",
    bg: "rgba(251,191,36,0.1)",
    border: "rgba(251,191,36,0.3)",
  },
  in_review: {
    color: "#e9d5ff",
    bg: "rgba(192,132,252,0.14)",
    border: "rgba(192,132,252,0.35)",
  },
  changes_requested: {
    color: "#fbb27a",
    bg: "rgba(251,146,60,0.12)",
    border: "rgba(251,146,60,0.32)",
  },
  approved: {
    color: "#a7f3c4",
    bg: "rgba(125,226,156,0.12)",
    border: "rgba(125,226,156,0.3)",
  },
  scheduled: {
    color: "#c4b5fd",
    bg: "rgba(139,92,255,0.14)",
    border: "rgba(139,92,255,0.35)",
  },
  posted: {
    color: "#bae6fd",
    bg: "rgba(59,130,246,0.14)",
    border: "rgba(59,130,246,0.35)",
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const meta = COLORS[status] || COLORS.not_started;
  const label = LABELS[status] ?? status.replace(/_/g, " ").toUpperCase();

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: "999px",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
      }}
    >
      {label}
    </span>
  );
}
