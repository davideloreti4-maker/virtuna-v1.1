// ---------------------------------------------------------------------------
// hive-constants.ts -- Visual constants for hive rendering & animation
// ---------------------------------------------------------------------------

import type { TierConfig } from './hive-types';

// ---------------------------------------------------------------------------
// Layout geometry
// ---------------------------------------------------------------------------

/**
 * Outermost tier radius in logical units.
 * Reduced from 1200 to 600 after removing tier-3 — fewer nodes need less space.
 */
export const HIVE_OUTER_RADIUS = 600 as const;

/** Pixels of padding when fitting the hive to the viewport. */
export const VIEWPORT_PADDING = 60 as const;

// ---------------------------------------------------------------------------
// Node sizes (societies.io style -- varied, larger nodes)
// ---------------------------------------------------------------------------

export const NODE_SIZES = {
  center: { width: 65, height: 86, borderRadius: 8 },
  tier1: { radius: 8, minMultiplier: 0.8, maxMultiplier: 1.5 },
  tier2: { radius: 4, minMultiplier: 0.5, maxMultiplier: 1.8 },
} as const;

// ---------------------------------------------------------------------------
// Tier colors (societies.io style -- muted grays with per-node variation)
// ---------------------------------------------------------------------------

/** Base fill opacity range per tier. Actual opacity varies per node. */
export const TIER_OPACITY = {
  1: { min: 0.5, max: 0.95 },
  2: { min: 0.3, max: 0.75 },
} as const;

/** Tier-indexed fill colors (base, before per-node opacity variation). */
export const TIER_COLORS: Record<number, string> = {
  0: 'rgba(255, 255, 255, 0.10)',
  1: 'rgba(255, 255, 255, 0.85)',
  2: 'rgba(255, 255, 255, 0.55)',
} as const;

// ---------------------------------------------------------------------------
// Connection line opacity (societies.io style -- more prominent)
// ---------------------------------------------------------------------------

/** Opacity for connection lines keyed by *target* node tier. */
export const LINE_OPACITY: Record<number, number> = {
  1: 0.18,
  2: 0.10,
} as const;

// ---------------------------------------------------------------------------
// Progressive build animation timing (ms)
// ---------------------------------------------------------------------------

export const ANIMATION_TIMING = {
  center: { delay: 0, duration: 300 },
  tier1: { delay: 200, duration: 400 },
  tier2: { delay: 500, duration: 500 },
} as const;

// ---------------------------------------------------------------------------
// Skeleton loading state
// ---------------------------------------------------------------------------

/** Radii for skeleton concentric rings (CSS px). */
export const SKELETON_RINGS = [40, 120] as const;

/** Number of placeholder dots per skeleton ring. */
export const SKELETON_DOTS = [8, 24] as const;

/** Dot radius per skeleton ring. */
export const SKELETON_DOT_RADII = [8, 5] as const;

// ---------------------------------------------------------------------------
// Node color palette (10 distinct colors for tier-1 groups)
// ---------------------------------------------------------------------------

export const NODE_COLORS = [
  'rgba(107, 138, 255, {a})',  // Blue
  'rgba(167, 139, 250, {a})',  // Purple
  'rgba(94, 234, 212, {a})',   // Teal
  'rgba(244, 114, 182, {a})',  // Pink
  'rgba(251, 191, 36, {a})',   // Amber
  'rgba(74, 222, 128, {a})',   // Green
  'rgba(251, 113, 133, {a})',  // Rose
  'rgba(34, 211, 238, {a})',   // Cyan
  'rgba(251, 146, 60, {a})',   // Orange
  'rgba(196, 181, 253, {a})',  // Lavender
] as const;

/** Get a color string from the palette with the given alpha. */
export function getNodeColor(index: number, alpha: number): string {
  const template = NODE_COLORS[index % NODE_COLORS.length]!;
  return template.replace('{a}', alpha.toFixed(2));
}

// ---------------------------------------------------------------------------
// Pre-built tier config (combines sizes, colors, opacity)
// ---------------------------------------------------------------------------

export const TIER_CONFIG: Record<number, TierConfig> = {
  0: {
    radius: 0,
    fill: 'rgba(255, 255, 255, 0.10)',
    lineOpacity: 0,
  },
  1: {
    radius: 6,
    fill: 'rgba(255, 255, 255, 0.85)',
    lineOpacity: 0.18,
  },
  2: {
    radius: 4,
    fill: 'rgba(255, 255, 255, 0.55)',
    lineOpacity: 0.10,
  },
} as const;
