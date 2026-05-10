// ---------------------------------------------------------------------------
// behavioral-hero-constants.ts -- Visual constants for the behavioral-simulation
// hero (Phase 2). Particle counts, motion tunables, gradient string, easing.
// ---------------------------------------------------------------------------
//
// Source: .planning/phases/02-foundation-hero/02-CONTEXT.md D-30 (file-naming),
// D-38 (constants block). Mirrors the `hive-constants.ts` shape so future tweaks
// happen in one place.
//
// Color note: coral uses the exact hex `#FF7F50` and rgba(255, 127, 80, alpha)
// form -- NOT round-tripped through oklch(). Tailwind v4 oklch() compilation is
// inaccurate for very dark / very saturated values per CLAUDE.md "Known
// Technical Issues" -- the hex form is the source of truth across the brand.
//
// Chip note: the 87 percent confidence chip is rendered as a DOM overlay by
// Plan 04 (`BehavioralHero.tsx`). The `BehavioralCanvas.tsx` component paints
// particles only -- it does NOT call `ctx.fillText` for the chip. The constants
// below are exported so Plan 04 can read them when it builds the DOM chip.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Particle counts (D-05) -- desktop / mobile branching at <640px CSS width
// ---------------------------------------------------------------------------

/**
 * Particle population per viewport class.
 *
 * - `desktop`: 250 particles for >=640px CSS width
 * - `mobile`: 120 particles for <640px CSS width (graceful scaling per HERO-08)
 *
 * Invariant: `mobile < desktop` (asserted in `__tests__/behavioral-hero-constants.test.ts`).
 */
export const PARTICLE_COUNTS = {
  desktop: 250,
  mobile: 120,
} as const;

// ---------------------------------------------------------------------------
// Particle sizes (D-09) -- random in [min, max], scaled on mobile
// ---------------------------------------------------------------------------

/**
 * Particle radius range in CSS pixels.
 *
 * Each particle picks a random radius in `[min, max]`. On mobile (<640px), the
 * picked value is multiplied by `mobileScale` so the visual density doesn't
 * overwhelm a smaller viewport.
 */
export const PARTICLE_SIZES = {
  min: 2,
  max: 3,
  mobileScale: 0.85,
} as const;

// ---------------------------------------------------------------------------
// Particle colors (D-10) -- 70% coral, 30% Raycast neutral gray
// ---------------------------------------------------------------------------

/**
 * Per-particle color palette.
 *
 * - `coral`: `#FF7F50` -- exact brand hex (BRAND-BIBLE coral)
 * - `neutral`: `#9c9c9d` -- Raycast `--color-gray-400`
 * - `coralRatio`: 0.7 -- 70% of particles are coral, 30% are neutral
 */
export const PARTICLE_COLORS = {
  coral: '#FF7F50',
  neutral: '#9c9c9d',
  coralRatio: 0.7,
} as const;

// ---------------------------------------------------------------------------
// Particle motion (D-36) -- drift+attract: Brownian + radial attractor + damping
// ---------------------------------------------------------------------------

/**
 * Motion equation tunables for the one-shot ~2.2s drift+attract animation.
 *
 * Each frame:
 *   - Brownian: vx, vy += gaussian() * sigmaScale * dt
 *   - Attractor: vx, vy += (targetX - x, targetY - y) * k * dt where
 *     k = `attractorPeakStrength * easeOutCubic(t)`, `t` in [0, 1]
 *   - Damping: vx, vy *= damping
 *   - Apply: x, y += vx, vy * dt
 *
 * `targetOffsetY` is a fraction of canvas height: -0.05 means the convergence
 * point sits 5% above the canvas vertical center (slight upper-center bias so
 * the chip overlay reads as "above the fold").
 *
 * `animationDurationMs` (2200ms) is enforced to live in the [2000, 2400]ms
 * window per CONTEXT.md D-07 -- asserted in the Vitest invariant suite.
 */
export const PARTICLE_MOTION = {
  brownianSigmaPxPerSec: 8,
  brownianSigmaMobile: 6,
  attractorPeakStrength: 1.4,
  damping: 0.92,
  animationDurationMs: 2200,
  targetOffsetY: -0.05,
} as const;

// ---------------------------------------------------------------------------
// Confidence chip (D-34) -- consumed by Plan 04 as a DOM overlay (NOT canvas)
// ---------------------------------------------------------------------------

/**
 * Visual constants for the "87 percent" DOM-overlay chip rendered by Plan 04.
 *
 * The chip is positioned at the canvas convergence point (upper-center) and
 * uses coral on coral-tinted background per Raycast accent treatment. Note
 * `borderRadius: 12` matches the Raycast `--radius-lg` token; `paddingX: 16`
 * + `paddingY: 8` produces the standard pill metric.
 *
 * Invariant: `percentage` is in [80, 95] -- asserted in the Vitest suite. The
 * value is a marketing illustration, not a real prediction (no PII surface).
 */
export const CONFIDENCE_CHIP = {
  percentage: 87,
  label: '87%',
  bgColor: 'rgba(255, 127, 80, 0.15)',
  borderColor: 'rgba(255, 127, 80, 0.4)',
  textColor: '#FF7F50',
  borderRadius: 12,
  fontWeight: 500,
  fontSizePx: 16,
  paddingX: 16,
  paddingY: 8,
} as const;

// ---------------------------------------------------------------------------
// Hero gradient (D-37) -- ambient backdrop string consumed by Plan 04
// ---------------------------------------------------------------------------

/**
 * Radial-gradient string for the hero ambient backdrop.
 *
 * Stops drop coral alpha 0.18 -> 0.10 -> 0.04 -> 0 across 0% -> 18% -> 38% ->
 * 70%, then fades to the page bg `#07080a` at 70%. Ellipse 90% 70% positioned
 * at 50% 35% biases the bloom toward the upper third (under the convergence
 * point + chip), matching the visual hierarchy of the locked hero spec.
 *
 * Coral uses rgba(255, 127, 80, alpha) NOT oklch() per CLAUDE.md "Tailwind v4
 * oklch inaccuracy" rule.
 */
export const HERO_GRADIENT =
  'radial-gradient(ellipse 90% 70% at 50% 35%, rgba(255, 127, 80, 0.18) 0%, rgba(255, 127, 80, 0.10) 18%, rgba(255, 127, 80, 0.04) 38%, #07080a 70%)' as const;

// ---------------------------------------------------------------------------
// Easing (D-36) -- verbatim match to use-hive-animation.ts:57
// ---------------------------------------------------------------------------

/**
 * Cubic ease-out easing function. Verbatim source equivalent to the hive
 * animation easing (use-hive-animation.ts:57). Used to scale the attractor
 * strength over the animation lifetime so the early frames drift gently and
 * the later frames lock onto the target.
 *
 * Boundary invariants asserted in the Vitest suite:
 *   easeOutCubic(0) === 0
 *   easeOutCubic(1) === 1
 *   easeOutCubic(0.5) ≈ 0.875
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
