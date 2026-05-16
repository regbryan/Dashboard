import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveColors, hexToRgb } from "../lib/colors";
import { EASE_OUT_EXPO, fadeRise, kenBurns } from "../lib/motion";
import type { ProductRevealProps } from "../types";

/**
 * Product / still reveal. 1:1 or 9:16, 10 seconds @ 30fps = 300 frames.
 *
 * Composition:
 *   0-30    image masked-reveal from bottom (clip-path inset),
 *           full ken-burns underneath
 *   30-90   headline rises over scrim
 *   60-120  subhead fades in
 *   240-280 CTA pill slides up
 *   280-300 hold
 *
 * Reuses Gemini-generated stills as input — no new image generation
 * needed for the first reels.
 */
export const ProductReveal = ({
  brandKit,
  headline,
  subhead,
  imageUrl,
  cta,
}: ProductRevealProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const c = resolveColors(brandKit);

  // Masked image reveal — inset clip-path from 100% (hidden) to 0%
  const revealT = Math.max(0, Math.min(1, frame / 30));
  const revealEased = EASE_OUT_EXPO(revealT);
  const inset = (1 - revealEased) * 100;

  const kb = kenBurns(frame, durationInFrames);

  const headlineAnim = fadeRise(frame, 30, 36, 24);
  const subheadAnim = fadeRise(frame, 60, 36, 16);
  const ctaAnim = fadeRise(frame, 240, 30, 14);

  // Scrim that darkens the bottom half so type stays legible no
  // matter what the image is. Fades in alongside the reveal.
  const scrimOpacity = interpolate(frame, [10, 40], [0, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: c.background }}>
      {/* Masked image — clipped from the bottom edge upward */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `inset(${inset}% 0 0 0)`,
        }}
      >
        <Img
          src={imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${kb.scale}) translate(${kb.translateX}px, ${kb.translateY}px)`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* Bottom-up scrim for type legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, rgba(${hexToRgb(
            c.background
          )}, 0.92) 0%, rgba(${hexToRgb(c.background)}, 0.5) 38%, transparent 62%)`,
          opacity: scrimOpacity,
        }}
      />

      {/* Accent rule */}
      <div
        style={{
          position: "absolute",
          left: 64,
          bottom: cta ? 280 : 200,
          width: 48,
          height: 3,
          backgroundColor: c.accent,
          opacity: headlineAnim.opacity,
          transformOrigin: "left center",
          transform: `scaleX(${headlineAnim.opacity})`,
        }}
      />

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: cta ? 200 : 140,
          color: c.foreground,
          fontFamily: brandKit.fonts.display,
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          opacity: headlineAnim.opacity,
          transform: `translateY(${headlineAnim.translateY}px)`,
        }}
      >
        {headline}
      </div>

      {/* Subhead */}
      {subhead && (
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            bottom: cta ? 140 : 90,
            color: `rgba(${hexToRgb(c.foreground)}, 0.78)`,
            fontFamily: brandKit.fonts.body,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.4,
            opacity: subheadAnim.opacity,
            transform: `translateY(${subheadAnim.translateY}px)`,
          }}
        >
          {subhead}
        </div>
      )}

      {/* CTA pill */}
      {cta && (
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 70,
            padding: "16px 28px",
            borderRadius: 999,
            backgroundColor: c.accent,
            color: c.background,
            fontFamily: brandKit.fonts.body,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.02em",
            opacity: ctaAnim.opacity,
            transform: `translateY(${ctaAnim.translateY}px)`,
            boxShadow: `0 18px 40px -10px rgba(${hexToRgb(c.accent)}, 0.5)`,
          }}
        >
          {cta} →
        </div>
      )}

      {/* Brand handle — top-right corner mark */}
      <div
        style={{
          position: "absolute",
          top: 56,
          right: 64,
          color: `rgba(${hexToRgb(c.foreground)}, 0.85)`,
          fontFamily: brandKit.fonts.body,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.04em",
          padding: "10px 16px",
          borderRadius: 999,
          backgroundColor: `rgba(${hexToRgb(c.background)}, 0.6)`,
          backdropFilter: "blur(8px)",
          opacity: Math.min(frame / 30, 1),
        }}
      >
        {brandKit.handle
          ? `@${brandKit.handle.replace(/^@/, "")}`
          : brandKit.name}
      </div>
    </AbsoluteFill>
  );
};
