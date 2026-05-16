import { interpolate, spring, type SpringConfig } from "remotion";

/**
 * Motion primitives shared across compositions. All easings are
 * exponential ease-out — no bounce, no elastic. Matches the
 * dashboard's CSS motion conventions.
 */

export const EASE_OUT_QUART = (t: number) => 1 - Math.pow(1 - t, 4);
export const EASE_OUT_QUINT = (t: number) => 1 - Math.pow(1 - t, 5);
export const EASE_OUT_EXPO = (t: number) =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

/**
 * Archetype → spring config. Drives the subtle personality
 * difference between brands without changing layout.
 */
export function archetypeSpring(archetype: string | undefined): SpringConfig {
  const a = (archetype ?? "Sage").toLowerCase();
  if (a.includes("hero") || a.includes("ruler")) {
    return { damping: 22, stiffness: 90, mass: 1.1, overshootClamping: false };
  }
  if (a.includes("jester") || a.includes("lover")) {
    return { damping: 14, stiffness: 140, mass: 0.8, overshootClamping: false };
  }
  if (a.includes("caregiver") || a.includes("everyman")) {
    return { damping: 18, stiffness: 80, mass: 1.0, overshootClamping: false };
  }
  if (a.includes("outlaw") || a.includes("magician")) {
    return { damping: 26, stiffness: 160, mass: 0.9, overshootClamping: false };
  }
  // Sage / Creator / default
  return { damping: 20, stiffness: 100, mass: 1.0, overshootClamping: false };
}

/**
 * Fade-and-rise entrance. Returns { opacity, translateY }.
 * `delay` is in frames, `duration` is in frames.
 */
export function fadeRise(
  frame: number,
  delay: number,
  duration: number,
  riseFrom = 24
) {
  const t = Math.max(0, Math.min(1, (frame - delay) / duration));
  const eased = EASE_OUT_QUART(t);
  return {
    opacity: eased,
    translateY: (1 - eased) * riseFrom,
  };
}

/**
 * Frame-driven spring helper that takes our archetype config.
 */
export function archetypeSpringValue(
  frame: number,
  fps: number,
  delay: number,
  archetype: string | undefined
) {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: archetypeSpring(archetype),
  });
}

/**
 * Ken-burns transform for still-image compositions. Slowly drifts
 * + scales over the full duration. `scale` ranges 1.02 → 1.12 across
 * the composition length.
 */
export function kenBurns(frame: number, durationInFrames: number) {
  const t = frame / durationInFrames;
  const scale = interpolate(t, [0, 1], [1.02, 1.12]);
  const translateX = interpolate(t, [0, 1], [-12, 12]);
  const translateY = interpolate(t, [0, 1], [-8, 8]);
  return { scale, translateX, translateY };
}
