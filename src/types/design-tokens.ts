/**
 * Design Token Types for Virtuna v2.0
 *
 * These types provide type safety for design token usage across the codebase.
 * Values correspond to CSS custom properties defined in globals.css @theme.
 */

/** Primitive color scale steps (100-900) */
export type ColorScale = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** Gray scale including 50 and 950 for extremes */
export type GrayScale = 50 | ColorScale | 950;

/** Semantic color tokens for component usage */
export type SemanticColor =
  | 'background'
  | 'background-elevated'
  | 'surface'
  | 'surface-elevated'
  | 'foreground'
  | 'foreground-secondary'
  | 'foreground-muted'
  | 'accent'
  | 'accent-hover'
  | 'accent-active'
  | 'accent-foreground'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'border'
  | 'border-hover'
  | 'border-glass'
  | 'hover'
  | 'active'
  | 'disabled';

/** Spacing scale tokens (8px base, geometric progression) */
export type SpacingToken = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

/** Shadow elevation tokens */
export type ShadowToken = 'sm' | 'md' | 'lg' | 'xl' | 'glass' | 'glow-accent';

/** Border radius scale tokens */
export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

/** Animation duration tokens */
export type DurationToken = 'fast' | 'normal' | 'slow';

/** Easing function tokens */
export type EaseToken = 'out-cubic' | 'out-quart' | 'in-out' | 'spring';

/** Z-index layer tokens */
export type ZIndexToken =
  | 'base'
  | 'dropdown'
  | 'sticky'
  | 'modal-backdrop'
  | 'modal'
  | 'toast'
  | 'tooltip';

/** Responsive breakpoint tokens */
export type BreakpointToken = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Font family tokens */
export type FontFamilyToken = 'display' | 'sans' | 'mono';

/** Font weight tokens */
export type FontWeightToken = 'regular' | 'medium' | 'semibold' | 'bold';

/** Text size tokens */
export type TextSizeToken =
  | 'xs'
  | 'sm'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | 'hero';

/** Line height tokens */
export type LineHeightToken = 'none' | 'tight' | 'snug' | 'normal' | 'relaxed';

/** Letter spacing tokens */
export type TrackingToken = 'tight' | 'normal' | 'wide';

/**
 * Helper type for accessing coral scale values
 * Usage: `bg-coral-${CoralStep}` in Tailwind classes
 */
export type CoralStep = ColorScale;

/**
 * Helper type for accessing gray scale values
 * Usage: `bg-gray-${GrayStep}` in Tailwind classes
 */
export type GrayStep = GrayScale;

/**
 * Gradient token names
 */
export type GradientToken = 'coral' | 'card-bg' | 'overlay' | 'glow-coral';

/**
 * CSS variable accessor helper
 * Returns the CSS var() function call for a given token name
 *
 * @example
 * cssVar('color-accent') // returns 'var(--color-accent)'
 * cssVar('spacing-4') // returns 'var(--spacing-4)'
 */
export function cssVar(token: string): string {
  return `var(--${token})`;
}

/**
 * Type-safe CSS variable accessor for color tokens
 *
 * @example
 * colorVar('accent') // returns 'var(--color-accent)'
 * colorVar('coral', 500) // returns 'var(--color-coral-500)'
 */
export function colorVar(name: SemanticColor): string;
export function colorVar(name: 'coral' | 'gray', scale: ColorScale): string;
export function colorVar(
  name: SemanticColor | 'coral' | 'gray',
  scale?: ColorScale
): string {
  if (scale !== undefined) {
    return `var(--color-${name}-${scale})`;
  }
  return `var(--color-${name})`;
}

/**
 * Type-safe CSS variable accessor for spacing tokens
 *
 * @example
 * spacingVar(4) // returns 'var(--spacing-4)'
 */
export function spacingVar(size: SpacingToken): string {
  return `var(--spacing-${size})`;
}

/**
 * Design token configuration object type
 * Useful for component prop typing
 */
export interface TokenConfig {
  color?: SemanticColor;
  spacing?: SpacingToken;
  radius?: RadiusToken;
  shadow?: ShadowToken;
}
