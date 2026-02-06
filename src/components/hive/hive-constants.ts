// ---------------------------------------------------------------------------
// hive-constants.ts -- Visual constants for hive rendering & animation
// ---------------------------------------------------------------------------

import type { TierConfig } from './hive-types';

// ---------------------------------------------------------------------------
// Layout geometry
// ---------------------------------------------------------------------------

/**
 * Outermost tier radius in logical units.
 *
 * At r=1200 the circumference is ~7540 units. With 1000 tier-3 nodes at
 * radius 1.5px each needing ~4px spacing, total demand is ~4000px --
 * fits comfortably within the available circumference.
 */
export const HIVE_OUTER_RADIUS = 1200 as const;

/** Pixels of padding when fitting the hive to the viewport. */
export const VIEWPORT_PADDING = 60 as const;

// ---------------------------------------------------------------------------
// Node sizes
// ---------------------------------------------------------------------------

export const NODE_SIZES = {
  center: { width: 80, height: 60, borderRadius: 8 },
  tier1: { radius: 8 },
  tier2: { radius: 4 },
  tier3: { radius: 1.5 },
} as const;

// ---------------------------------------------------------------------------
// Tier colors (Raycast dark aesthetic -- pure white at varying opacity)
// ---------------------------------------------------------------------------

/** Tier-indexed fill colors. Tier 0 = center rectangle border color. */
export const TIER_COLORS: Record<number, string> = {
  0: 'rgba(255, 255, 255, 0.10)',
  1: 'rgba(255, 255, 255, 0.85)',
  2: 'rgba(255, 255, 255, 0.45)',
  3: 'rgba(255, 255, 255, 0.20)',
} as const;

// ---------------------------------------------------------------------------
// Connection line opacity (tier-based steps)
// ---------------------------------------------------------------------------

/** Opacity for connection lines keyed by *target* node tier. */
export const LINE_OPACITY: Record<number, number> = {
  1: 0.15,
  2: 0.08,
  3: 0.04,
} as const;

// ---------------------------------------------------------------------------
// Progressive build animation timing (ms)
// ---------------------------------------------------------------------------

export const ANIMATION_TIMING = {
  center: { delay: 0, duration: 300 },
  tier1: { delay: 200, duration: 400 },
  tier2: { delay: 500, duration: 500 },
  tier3: { delay: 900, duration: 600 },
} as const;

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

/** Radii for skeleton concentric rings (CSS px). */
export const SKELETON_RINGS = [80, 200, 400] as const;

/** Number of placeholder dots per skeleton ring. */
export const SKELETON_DOTS = [8, 24, 48] as const;

/** Dot radius per skeleton ring. */
export const SKELETON_DOT_RADII = [6, 4, 2] as const;

// ---------------------------------------------------------------------------
// Pre-built tier config (combines sizes, colors, opacity)
// ---------------------------------------------------------------------------

/**
 * Combined visual config per tier for the renderer.
 *
 * - `radius`: draw size (for circles). Center uses the rectangle
 *   dimensions from NODE_SIZES.center instead.
 * - `fill`: rgba fill color.
 * - `lineOpacity`: opacity for connection lines targeting this tier.
 */
export const TIER_CONFIG: Record<number, TierConfig> = {
  0: {
    radius: 0, // center is a rectangle, not a circle
    fill: 'rgba(255, 255, 255, 0.10)',
    lineOpacity: 0, // no connections *to* center
  },
  1: {
    radius: 8,
    fill: 'rgba(255, 255, 255, 0.85)',
    lineOpacity: 0.15,
  },
  2: {
    radius: 4,
    fill: 'rgba(255, 255, 255, 0.45)',
    lineOpacity: 0.08,
  },
  3: {
    radius: 1.5,
    fill: 'rgba(255, 255, 255, 0.20)',
    lineOpacity: 0.04,
  },
} as const;
