import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveColors, hexToRgb } from "../lib/colors";
import { EASE_OUT_QUINT, fadeRise } from "../lib/motion";
import type { StatsReelProps } from "../types";

/**
 * Stats reel. 9:16, 12 seconds @ 30fps = 360 frames.
 *
 * The big number counts up from 0 to its final value with a
 * deceleration curve — feels like the camera is settling on it.
 * If the stat doesn't parse as a number (e.g. "1 in 3"), it
 * skips the counter and just reveals it whole.
 *
 *   0-45    headline rises
 *   30-180  number counts up (5s)
 *   180-210 label fades in
 *   210-240 footer slides in
 *   240+    hold
 */
export const StatsReel = ({
  brandKit,
  headline,
  stat,
  statLabel,
  footer,
}: StatsReelProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = resolveColors(brandKit);

  // Parse the leading number out of stat (handles "94%", "3.2x", "1,200+")
  const numMatch = stat.match(/^(\d+(?:[,.]\d+)*)(.*)$/);
  const targetNum = numMatch
    ? parseFloat(numMatch[1].replace(/,/g, ""))
    : null;
  const suffix = numMatch ? numMatch[2] : "";

  const countT = Math.max(0, Math.min(1, (frame - 30) / (5 * fps)));
  const eased = EASE_OUT_QUINT(countT);
  const currentNum =
    targetNum !== null
      ? Math.round(targetNum * eased * 10) / 10
      : null;
  const displayedStat =
    currentNum !== null
      ? `${formatNumber(currentNum, numMatch![1])}${suffix}`
      : stat;

  const headlineAnim = fadeRise(frame, 0, 30, 18);
  const labelAnim = fadeRise(frame, 180, 24, 12);
  const footerAnim = fadeRise(frame, 210, 24, 10);

  // Number scale-in: starts at 0.85, springs to 1.0 over first 30 frames
  const numScale = interpolate(
    Math.min(frame, 45),
    [15, 45],
    [0.85, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const numOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: c.background,
        fontFamily: brandKit.fonts.body,
        padding: "80px 80px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Subtle accent column on the right edge */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          backgroundColor: c.accent,
          opacity: 0.45,
          transformOrigin: "top",
          transform: `scaleY(${Math.min(frame / 30, 1)})`,
        }}
      />

      {/* Eyebrow + headline */}
      <div>
        <div
          style={{
            color: c.accent,
            fontFamily: brandKit.fonts.body,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 24,
            opacity: headlineAnim.opacity,
            transform: `translateY(${headlineAnim.translateY}px)`,
          }}
        >
          {brandKit.name}
        </div>
        <div
          style={{
            color: c.foreground,
            fontFamily: brandKit.fonts.display,
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
            opacity: headlineAnim.opacity,
            transform: `translateY(${headlineAnim.translateY}px)`,
          }}
        >
          {headline}
        </div>
      </div>

      {/* The hero number */}
      <div
        style={{
          textAlign: "left",
          color: c.foreground,
          fontFamily: brandKit.fonts.display,
          fontSize: 280,
          fontWeight: 800,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          opacity: numOpacity,
          transform: `scale(${numScale})`,
          transformOrigin: "left center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {displayedStat}
      </div>

      {/* Label + footer */}
      <div>
        <div
          style={{
            color: `rgba(${hexToRgb(c.foreground)}, 0.78)`,
            fontFamily: brandKit.fonts.body,
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.32,
            maxWidth: "85%",
            opacity: labelAnim.opacity,
            transform: `translateY(${labelAnim.translateY}px)`,
          }}
        >
          {statLabel}
        </div>
        {footer && (
          <div
            style={{
              marginTop: 28,
              paddingTop: 18,
              borderTop: `1px solid rgba(${hexToRgb(c.foreground)}, 0.14)`,
              color: `rgba(${hexToRgb(c.foreground)}, 0.5)`,
              fontFamily: brandKit.fonts.body,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.05em",
              opacity: footerAnim.opacity,
              transform: `translateY(${footerAnim.translateY}px)`,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Match the formatting of the input — preserves comma grouping and
 * decimal places when the target had them, falls back to integer
 * display otherwise.
 */
function formatNumber(value: number, originalString: string): string {
  const hadComma = originalString.includes(",");
  const hadDecimal = originalString.includes(".");
  if (hadDecimal) {
    const decimals = originalString.split(".")[1]?.length ?? 1;
    return value.toFixed(decimals);
  }
  const int = Math.round(value);
  return hadComma ? int.toLocaleString("en-US") : String(int);
}
