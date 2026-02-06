// ---------------------------------------------------------------------------
// hive-renderer.ts -- Pure Canvas 2D drawing functions for the hive
// ---------------------------------------------------------------------------
//
// All functions are side-effect-free (except drawing to the provided context).
// No React, no hooks, no DOM queries -- only CanvasRenderingContext2D operations.
//
// Performance: Batched draw calls group same-styled elements into a single
// beginPath/fill or beginPath/stroke call, reducing Canvas API overhead from
// O(n) to O(tiers) for n nodes.
// ---------------------------------------------------------------------------

import {
  LINE_OPACITY,
  NODE_SIZES,
  SKELETON_DOT_RADII,
  SKELETON_DOTS,
  SKELETON_RINGS,
  TIER_COLORS,
} from './hive-constants';
import { computeFitTransform } from './hive-layout';
import type { LayoutLink, LayoutNode, LayoutResult } from './hive-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-tier visibility for progressive build animation. */
interface TierVisibility {
  opacity: number;
  scale: number;
}

/** Transform produced by computeFitTransform. */
interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Draw connection lines batched by target-node tier.
 *
 * Groups links by target tier so each tier gets a single beginPath/stroke
 * with the appropriate opacity.
 */
function drawConnectionLines(
  ctx: CanvasRenderingContext2D,
  links: LayoutLink[],
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
): void {
  // Group links by target node tier
  const byTier = new Map<number, LayoutLink[]>();
  for (const link of links) {
    const tier = link.target.tier;
    const group = byTier.get(tier);
    if (group) {
      group.push(link);
    } else {
      byTier.set(tier, [link]);
    }
  }

  const { scale, offsetX, offsetY } = transform;

  for (const [tier, tierLinks] of byTier) {
    const baseOpacity = LINE_OPACITY[tier] ?? 0;
    if (baseOpacity <= 0) continue;

    // Apply animation visibility
    const vis = visibility?.[tier];
    if (vis !== undefined && vis.opacity <= 0) continue;
    const finalOpacity = vis !== undefined ? baseOpacity * vis.opacity : baseOpacity;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${finalOpacity})`;
    ctx.lineWidth = 1;

    for (const { source, target } of tierLinks) {
      const sx = Math.round(source.x * scale + offsetX);
      const sy = Math.round(source.y * scale + offsetY);
      const tx = Math.round(target.x * scale + offsetX);
      const ty = Math.round(target.y * scale + offsetY);

      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
    }

    ctx.stroke();
  }
}

/**
 * Draw nodes as circles, batched by tier.
 *
 * Skips tier 0 (center) -- handled separately by drawCenterRect.
 * Supports optional per-tier visibility for animation (opacity + scale).
 */
function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: LayoutNode[],
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
): void {
  // Group by tier for batch rendering
  const byTier = new Map<number, LayoutNode[]>();
  for (const node of nodes) {
    if (node.tier === 0) continue; // center handled by drawCenterRect
    const group = byTier.get(node.tier);
    if (group) {
      group.push(node);
    } else {
      byTier.set(node.tier, [node]);
    }
  }

  const { scale, offsetX, offsetY } = transform;

  // Tier-to-radius mapping
  const tierRadii: Record<number, number> = {
    1: NODE_SIZES.tier1.radius,
    2: NODE_SIZES.tier2.radius,
    3: NODE_SIZES.tier3.radius,
  };

  for (const [tier, tierNodes] of byTier) {
    const fill = TIER_COLORS[tier];
    const baseRadius = tierRadii[tier];
    if (!fill || baseRadius === undefined) continue;

    // Apply animation visibility
    const vis = visibility?.[tier];
    if (vis !== undefined && vis.opacity <= 0) continue;
    const radiusScale = vis !== undefined ? vis.scale : 1;
    const drawRadius = baseRadius * radiusScale;

    if (vis !== undefined && vis.opacity < 1) {
      ctx.globalAlpha = vis.opacity;
    }

    ctx.beginPath();
    for (const node of tierNodes) {
      const x = Math.round(node.x * scale + offsetX);
      const y = Math.round(node.y * scale + offsetY);
      ctx.moveTo(x + drawRadius, y);
      ctx.arc(x, y, drawRadius, 0, Math.PI * 2);
    }
    ctx.fillStyle = fill;
    ctx.fill();

    // Reset globalAlpha if changed
    if (vis !== undefined && vis.opacity < 1) {
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * Draw the center element as a rounded rectangle.
 *
 * Dimensions from NODE_SIZES.center. Filled with subtle dark, stroked with
 * tier-0 color. Supports visibility param for animation.
 */
function drawCenterRect(
  ctx: CanvasRenderingContext2D,
  centerNode: LayoutNode,
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
): void {
  const vis = visibility?.[0];
  if (vis !== undefined && vis.opacity <= 0) return;

  const { scale, offsetX, offsetY } = transform;
  const { width, height, borderRadius } = NODE_SIZES.center;

  const scaleMultiplier = vis !== undefined ? vis.scale : 1;
  const drawWidth = width * scaleMultiplier;
  const drawHeight = height * scaleMultiplier;

  const cx = Math.round(centerNode.x * scale + offsetX);
  const cy = Math.round(centerNode.y * scale + offsetY);

  if (vis !== undefined && vis.opacity < 1) {
    ctx.globalAlpha = vis.opacity;
  }

  // Fill
  ctx.beginPath();
  ctx.roundRect(
    cx - drawWidth / 2,
    cy - drawHeight / 2,
    drawWidth,
    drawHeight,
    borderRadius,
  );
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();

  // Stroke
  const strokeColor = TIER_COLORS[0] ?? 'rgba(255, 255, 255, 0.10)';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Reset globalAlpha if changed
  if (vis !== undefined && vis.opacity < 1) {
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Exported render functions
// ---------------------------------------------------------------------------

/**
 * Render a complete hive visualization from a LayoutResult.
 *
 * Draw order: connection lines (bottom) -> nodes (middle) -> center rect (top).
 *
 * The caller is responsible for clearing the canvas before calling this
 * function (ctx.clearRect) and applying ctx.scale(dpr, dpr) for retina.
 *
 * @param ctx          - Canvas 2D rendering context (already DPR-scaled)
 * @param layout       - Positioned nodes and links from computeHiveLayout
 * @param canvasWidth  - CSS pixel width
 * @param canvasHeight - CSS pixel height
 * @param visibility   - Optional per-tier visibility for progressive build animation.
 *                        Tiers not present in the record are hidden (opacity 0).
 */
export function renderHive(
  ctx: CanvasRenderingContext2D,
  layout: LayoutResult,
  canvasWidth: number,
  canvasHeight: number,
  visibility?: Record<number, TierVisibility>,
): void {
  // Compute fit transform once, pass to all draw helpers
  const transform = computeFitTransform(layout.bounds, canvasWidth, canvasHeight);

  // 1. Connection lines (underneath everything)
  drawConnectionLines(ctx, layout.links, transform, visibility);

  // 2. Nodes by tier (on top of lines)
  drawNodes(ctx, layout.nodes, transform, visibility);

  // 3. Center rectangle (on top of everything)
  const centerNode = layout.nodes.find((n) => n.tier === 0);
  if (centerNode) {
    drawCenterRect(ctx, centerNode, transform, visibility);
  }
}

/**
 * Render a skeleton loading state with concentric rings and placeholder dots.
 *
 * Draws at canvas center. Used when hive data is loading (layout not yet
 * available). All dots are batched per ring for minimal Canvas API calls.
 *
 * The caller is responsible for clearing the canvas and applying DPR scale.
 *
 * @param ctx          - Canvas 2D rendering context (already DPR-scaled)
 * @param canvasWidth  - CSS pixel width
 * @param canvasHeight - CSS pixel height
 */
export function renderSkeletonHive(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  // 1. Draw concentric rings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;

  for (const ringRadius of SKELETON_RINGS) {
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2. Draw placeholder dots on each ring (batched per ring)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';

  for (let i = 0; i < SKELETON_RINGS.length; i++) {
    const ringRadius = SKELETON_RINGS[i];
    const dotCount = SKELETON_DOTS[i];
    const dotRadius = SKELETON_DOT_RADII[i];

    if (ringRadius === undefined || dotCount === undefined || dotRadius === undefined) {
      continue;
    }

    ctx.beginPath();
    for (let j = 0; j < dotCount; j++) {
      const angle = (j / dotCount) * Math.PI * 2;
      const x = Math.round(cx + ringRadius * Math.cos(angle));
      const y = Math.round(cy + ringRadius * Math.sin(angle));
      ctx.moveTo(x + dotRadius, y);
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // 3. Center rectangle placeholder
  const { width, height, borderRadius } = NODE_SIZES.center;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.roundRect(cx - width / 2, cy - height / 2, width, height, borderRadius);
  ctx.fill();
}
