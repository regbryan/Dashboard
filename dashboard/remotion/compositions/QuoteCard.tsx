import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveColors, hexToRgb } from "../lib/colors";
import { archetypeSpringValue, fadeRise } from "../lib/motion";
import type { QuoteCardProps } from "../types";

/**
 * Editorial quote card. 9:16, 8 seconds @ 30fps = 240 frames.
 *
 * Composition:
 *   0-30   bg gradient sweeps in
 *   15-90  primary line of quote reveals word-by-word
 *   45-120 second line reveals
 *   75-150 attribution slides up
 *   ...    hold until end
 *
 * No images. Pure typographic. Designed to read on mute, in feed,
 * at 6 inches from a face on a phone.
 */
export const QuoteCard = ({ brandKit, quote, attribution }: QuoteCardProps) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const c = resolveColors(brandKit);

  // Split quote into two visual lines for kinetic reveal. Naive
  // split at the midpoint word boundary — good enough for ≤24 words.
  const words = quote.split(" ");
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");

  const bgProgress = archetypeSpringValue(frame, fps, 0, brandKit.archetype);
  const line1Anim = fadeRise(frame, 15, 30, 16);
  const line2Anim = fadeRise(frame, 45, 30, 16);
  const attribAnim = fadeRise(frame, 75, 30, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: c.background,
        fontFamily: brandKit.fonts.body,
      }}
    >
      {/* Diagonal accent wash — sweeps in from the left edge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${c.primary} 0%, transparent 60%)`,
          opacity: 0.45 * bgProgress,
          transform: `translateX(${(1 - bgProgress) * -width * 0.2}px)`,
        }}
      />
      {/* Accent corner mark — a confident, restrained anchor */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 80,
          width: 56,
          height: 4,
          backgroundColor: c.accent,
          opacity: bgProgress,
          transformOrigin: "left center",
          transform: `scaleX(${bgProgress})`,
        }}
      />

      {/* Quote body — display font, large, tight leading */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: height * 0.28,
          color: c.foreground,
          fontFamily: brandKit.fonts.display,
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
        }}
      >
        <div
          style={{
            opacity: line1Anim.opacity,
            transform: `translateY(${line1Anim.translateY}px)`,
          }}
        >
          {line1}
        </div>
        {line2 && (
          <div
            style={{
              marginTop: 12,
              opacity: line2Anim.opacity,
              transform: `translateY(${line2Anim.translateY}px)`,
              color: c.accent,
            }}
          >
            {line2}
          </div>
        )}
      </div>

      {/* Attribution — small caps, body font, low-contrast */}
      {attribution && (
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            bottom: 140,
            color: `rgba(${hexToRgb(c.foreground)}, 0.62)`,
            fontFamily: brandKit.fonts.body,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: attribAnim.opacity,
            transform: `translateY(${attribAnim.translateY}px)`,
          }}
        >
          — {attribution}
        </div>
      )}

      {/* Lower-third brand mark */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 60,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: `rgba(${hexToRgb(c.foreground)}, 0.5)`,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.04em",
          opacity: attribAnim.opacity,
        }}
      >
        <span>{brandKit.name}</span>
        {brandKit.handle && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>
              @{brandKit.handle.replace(/^@/, "")}
            </span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
