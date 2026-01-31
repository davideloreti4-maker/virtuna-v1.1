/**
 * Orb animation states for the progressive disclosure visualization
 */
export type OrbState = 'idle' | 'gathering' | 'analyzing' | 'complete';

/**
 * Configuration constants for the orb
 * Orb size is 15-20% of visualization area per CONTEXT.md
 */
export const ORB_CONFIG = {
  // Size as percentage of min(width, height)
  sizePercent: 0.17, // ~17% - middle of 15-20% range

  // Colors - using design tokens values
  baseColor: 'rgba(255, 255, 255, 0.9)', // White/silver base
  midColor: 'rgba(240, 240, 240, 0.7)',  // Mid-tone
  accentColor: 'rgba(229, 120, 80, 0.4)', // Orange accent (#E57850)
  edgeColor: 'rgba(200, 200, 200, 0.2)',  // Transparent edge
  glowColor: 'rgba(229, 120, 80, 0.5)',   // Outer glow

  // Glow settings
  glowBlur: 15, // Subtle soft glow per CONTEXT.md

  // Gradient stops for glass effect (offset from center for light refraction look)
  lightOffsetPercent: 0.3, // 30% offset for inner light source
} as const;

/**
 * Configuration for breathing animation
 */
export const BREATHING_CONFIG = {
  duration: 2500, // 2.5 seconds per CONTEXT.md (2-3 second range)
  scaleMin: 1,
  scaleMax: 1.05,
  glowMin: 0.8,
  glowMax: 1,
} as const;
