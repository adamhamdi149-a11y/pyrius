/**
 * Motion tokens for JS-driven animation (the orb, timed reveals).
 * Mirrors src/styles/motion.css so CSS and canvas move with one rhythm.
 */

export const DURATION = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 420,
  slower: 700,
  orbFlight: 760,
  welcomeLeave: 380,
  successPulse: 1200,
} as const;

export type OrbMood = "idle" | "thinking" | "listening" | "success" | "error";

/**
 * What each orb state means visually. The renderer eases toward these targets,
 * so changing state is always a smooth transition, never a jump.
 * - energy: internal current speed and brightness
 * - glow: halo strength
 * - listen: ripple rings and warmer hue
 * - dim: desaturation used for the error state
 */
export const ORB_STATES: Record<OrbMood, { energy: number; glow: number; listen: number; dim: number }> = {
  idle: { energy: 0.05, glow: 0.5, listen: 0, dim: 0 },
  thinking: { energy: 1, glow: 0.85, listen: 0, dim: 0 },
  listening: { energy: 0.35, glow: 0.8, listen: 1, dim: 0 },
  success: { energy: 0.2, glow: 0.75, listen: 0, dim: 0 },
  error: { energy: 0, glow: 0.3, listen: 0, dim: 0.65 },
};

/** Per-frame easing factor: higher = snappier. Frame-rate independent. */
export const ease = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function finePointer() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Inline style for staggered children: <li style={stagger(i)}> inside .m-stagger */
export const stagger = (i: number, max = 10) => ({ ["--i" as string]: Math.min(i, max) });
