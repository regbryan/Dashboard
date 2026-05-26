/**
 * Shared empty-state surface for the four brand tabs (Designs / Calendar /
 * Brand Kit / Assets). Renders as a `.lg-surface--card` with consistent
 * padding, radius, and muted text — one place to tune the look when the
 * design changes.
 *
 * Why this exists: before extraction, each tab page re-declared the
 * same inline style block for its empty state (60px 24px, radius 16,
 * #7a7a88 text, etc.). Drift was inevitable; the calendar empty state
 * was 60px tall while the designs grid was 80px. Now they're identical.
 */
import { cardBackdropFilter } from "@/lib/glass-style";

export default function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="lg-surface--card"
      style={{
        borderRadius: "16px",
        padding: "60px 24px",
        textAlign: "center",
        color: "#7a7a88",
        fontSize: "14px",
        ...cardBackdropFilter,
      }}
    >
      {children}
    </div>
  );
}
