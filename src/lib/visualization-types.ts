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
 * Animation configuration per CONTEXT.md
 * - Idle breathing: 2-3 second cycle
 * - Gathering: 3-4 seconds duration
 * - Transitions: 0.3-0.5s ease
 */
export const ANIMATION_CONFIG = {
  // Idle breathing animation
  breathing: {
    duration: 2500,      // 2.5s cycle (middle of 2-3s range)
    scaleMin: 1,
    scaleMax: 1.05,      // 5% scale increase
    glowMin: 0.8,
    glowMax: 1.2,
  },

  // Gathering state (builds anticipation)
  gathering: {
    duration: 3500,      // 3.5s (middle of 3-4s range)
    scaleTo: 1.1,        // Larger scale
    glowIntensity: 1.5,  // Brighter glow
    bounce: 0.25,        // Spring bounce
  },

  // Analyzing state (particles swirl inside)
  analyzing: {
    rotationSpeed: 0.02, // Radians per frame for internal motion
    glowPulse: true,
    glowIntensity: 1.3,
  },

  // Complete state (celebration flash, then dim)
  complete: {
    flashDuration: 300,  // Brief flash
    flashIntensity: 2,
    settleIntensity: 0.6, // Dimmer passive state
    settleDuration: 500,
  },

  // State transitions
  transition: {
    duration: 400,       // 0.4s (middle of 0.3-0.5s range)
    easing: 'ease-out',
  },

  // Hover/tap interaction
  interaction: {
    glowBoost: 1.3,      // 30% brighter on hover
    duration: 200,       // Quick response
  },
} as const;
