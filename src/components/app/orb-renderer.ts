import { ORB_CONFIG } from "@/lib/visualization-types";

/**
 * Create the radial gradient for the glass orb
 * Uses offset center for light refraction effect
 */
export function createOrbGradient(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number
): CanvasGradient {
  // Offset light source for glass refraction look
  const lightX = centerX - radius * ORB_CONFIG.lightOffsetPercent;
  const lightY = centerY - radius * ORB_CONFIG.lightOffsetPercent;

  const gradient = ctx.createRadialGradient(
    lightX, lightY, 0,  // Inner circle at light source
    centerX, centerY, radius // Outer circle at orb edge
  );

  // Glass-like gradient: bright center -> mid-tone -> orange accent -> transparent edge
  gradient.addColorStop(0, ORB_CONFIG.baseColor);
  gradient.addColorStop(0.3, ORB_CONFIG.midColor);
  gradient.addColorStop(0.6, ORB_CONFIG.accentColor);
  gradient.addColorStop(1, ORB_CONFIG.edgeColor);

  return gradient;
}

/**
 * Draw the glass orb on canvas
 *
 * @param ctx - Canvas 2D context
 * @param centerX - X center coordinate
 * @param centerY - Y center coordinate
 * @param radius - Orb radius
 * @param glowIntensity - Glow intensity multiplier (0-1), default 1
 */
export function drawGlassOrb(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  glowIntensity: number = 1
): void {
  // Use Math.floor to avoid sub-pixel anti-aliasing overhead per RESEARCH.md
  const x = Math.floor(centerX);
  const y = Math.floor(centerY);
  const r = Math.floor(radius);

  // Create and apply gradient
  const gradient = createOrbGradient(ctx, x, y, r);

  // Draw main orb body
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Draw outer glow (apply shadowBlur only once, reset immediately per RESEARCH.md)
  ctx.shadowColor = ORB_CONFIG.glowColor;
  ctx.shadowBlur = ORB_CONFIG.glowBlur * glowIntensity;
  ctx.fill();
  ctx.shadowBlur = 0; // Reset immediately for performance

  // Add subtle inner highlight for glass depth
  const highlightGradient = ctx.createRadialGradient(
    x - r * 0.4, y - r * 0.4, 0,
    x - r * 0.4, y - r * 0.4, r * 0.3
  );
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = highlightGradient;
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Calculate orb radius based on container dimensions
 * Orb is 15-20% of the visualization area per CONTEXT.md
 */
export function calculateOrbRadius(width: number, height: number): number {
  const minDimension = Math.min(width, height);
  return Math.floor(minDimension * ORB_CONFIG.sizePercent / 2);
}
