// ---------------------------------------------------------------------------
// hive-renderer.ts -- Pure Canvas 2D drawing functions for the hive
// ---------------------------------------------------------------------------
//
// Societies.io style: varied node sizes, per-node opacity variation,
// prominent connection lines, organic network feel.
//
// Performance: Nodes are drawn individually (not batched per tier) to support
// per-node size/opacity variation. Still efficient at ~150 nodes.
// ---------------------------------------------------------------------------

import {
  DIM_LINE_OPACITY,
  DIM_OPACITY,
  LINE_OPACITY,
  NODE_SIZES,
  SELECTED_GLOW_BLUR,
  SELECTED_GLOW_COLOR,
  SELECTED_SCALE,
  SKELETON_DOT_RADII,
  SKELETON_DOTS,
  SKELETON_RINGS,
} from './hive-constants';
import { computeFitTransform } from './hive-layout';
import type { LayoutLink, LayoutNode, LayoutResult } from './hive-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierVisibility {
  opacity: number;
  scale: number;
}

interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Interaction state passed to the renderer for dim/highlight/glow effects. */
export interface InteractionRenderState {
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  connectedNodeIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Deterministic per-node hash (for size/opacity variation)
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return (h & 0x7fffffff) / 0x7fffffff; // [0, 1]
}

// ---------------------------------------------------------------------------
// Interaction opacity helpers
// ---------------------------------------------------------------------------

/**
 * Compute the interaction-based opacity for a single node.
 *
 * When no interaction is active, returns 1 (full opacity).
 * Active/connected nodes stay at 1; unrelated dim to DIM_OPACITY.
 */
function getNodeInteractionOpacity(
  nodeId: string,
  interaction: InteractionRenderState | undefined,
): number {
  if (!interaction) return 1;
  const activeId = interaction.selectedNodeId ?? interaction.hoveredNodeId;
  if (!activeId) return 1;
  if (nodeId === activeId) return 1;
  if (interaction.connectedNodeIds.has(nodeId)) return 1;
  return DIM_OPACITY;
}

/**
 * Determine whether a link should be rendered at full or dimmed opacity.
 *
 * A link is "relevant" when the active node is one of its endpoints and the
 * other endpoint is connected. Otherwise it dims to DIM_LINE_OPACITY.
 */
function isLinkRelevant(
  sourceId: string,
  targetId: string,
  interaction: InteractionRenderState | undefined,
): boolean {
  if (!interaction) return true;
  const activeId = interaction.selectedNodeId ?? interaction.hoveredNodeId;
  if (!activeId) return true;

  const sourceIsRelevant =
    sourceId === activeId || interaction.connectedNodeIds.has(sourceId);
  const targetIsRelevant =
    targetId === activeId || interaction.connectedNodeIds.has(targetId);

  return sourceIsRelevant && targetIsRelevant;
}

// ---------------------------------------------------------------------------
// Tier radii config (shared between drawNodes and drawSelectedGlow)
// ---------------------------------------------------------------------------

const TIER_RADII: Record<
  number,
  { base: number; minMult: number; maxMult: number }
> = {
  1: {
    base: NODE_SIZES.tier1.radius,
    minMult: NODE_SIZES.tier1.minMultiplier,
    maxMult: NODE_SIZES.tier1.maxMultiplier,
  },
  2: {
    base: NODE_SIZES.tier2.radius,
    minMult: NODE_SIZES.tier2.minMultiplier,
    maxMult: NODE_SIZES.tier2.maxMultiplier,
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function drawConnectionLines(
  ctx: CanvasRenderingContext2D,
  links: LayoutLink[],
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
  interaction?: InteractionRenderState,
): void {
  const { scale, offsetX, offsetY } = transform;

  // Draw each link individually to support per-link coloring
  for (const { source, target } of links) {
    const targetTier = target.tier;
    const sourceTier = source.tier;

    // Determine line opacity based on link type
    let baseOpacity: number;
    if (sourceTier === 0 && targetTier === 1) {
      // Center -> tier-1: subtle white
      baseOpacity = 0.08;
    } else if (sourceTier === 1 && targetTier === 1) {
      // Tier-1 <-> tier-1 mesh: very subtle white
      baseOpacity = 0.06;
    } else {
      // Tier-1 -> tier-2: use LINE_OPACITY
      baseOpacity = LINE_OPACITY[targetTier] ?? 0.10;
    }

    if (baseOpacity <= 0) continue;

    // Animation: use the higher tier's visibility
    const animTier = Math.max(sourceTier, targetTier);
    const vis = visibility?.[animTier];
    if (vis !== undefined && vis.opacity <= 0) continue;
    let finalOpacity = vis !== undefined ? baseOpacity * vis.opacity : baseOpacity;

    // Interaction: dim unrelated links
    if (!isLinkRelevant(source.id, target.id, interaction)) {
      finalOpacity = DIM_LINE_OPACITY;
    }

    const strokeColor = `rgba(255, 255, 255, ${finalOpacity})`;

    const sx = Math.round(source.x * scale + offsetX);
    const sy = Math.round(source.y * scale + offsetY);
    const tx = Math.round(target.x * scale + offsetX);
    const ty = Math.round(target.y * scale + offsetY);

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 0.7;
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
}

/**
 * Draw nodes using node.color with per-node size variation.
 *
 * Tier-1 nodes use their assigned color at full opacity.
 * Tier-2 nodes use their inherited parent color (already at lower opacity).
 * Size varies per node via deterministic hash.
 */
function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: LayoutNode[],
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
  interaction?: InteractionRenderState,
): void {
  const { scale, offsetX, offsetY } = transform;

  for (const node of nodes) {
    if (node.tier === 0) continue;

    const config = TIER_RADII[node.tier];
    if (!config) continue;

    // Per-node size variation
    const sizeHash = hashString(node.id);
    const sizeMultiplier =
      config.minMult + sizeHash * (config.maxMult - config.minMult);

    // Animation
    const vis = visibility?.[node.tier];
    if (vis !== undefined && vis.opacity <= 0) continue;
    const animScale = vis !== undefined ? vis.scale : 1;
    const animOpacity = vis !== undefined ? vis.opacity : 1;

    // Interaction opacity
    const interactionOpacity = getNodeInteractionOpacity(node.id, interaction);
    const combinedAlpha = animOpacity * interactionOpacity;

    const drawRadius = config.base * sizeMultiplier * animScale;

    const x = Math.round(node.x * scale + offsetX);
    const y = Math.round(node.y * scale + offsetY);

    ctx.beginPath();
    ctx.arc(x, y, drawRadius, 0, Math.PI * 2);

    if (combinedAlpha < 1) {
      ctx.globalAlpha = combinedAlpha;
    }
    ctx.fillStyle = node.color;
    ctx.fill();
    if (combinedAlpha < 1) {
      ctx.globalAlpha = 1;
    }
  }
}

function drawCenterRect(
  ctx: CanvasRenderingContext2D,
  centerNode: LayoutNode,
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
  interaction?: InteractionRenderState,
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

  // Combined animation + interaction opacity
  const animOpacity = vis !== undefined ? vis.opacity : 1;
  const interactionOpacity = getNodeInteractionOpacity(
    centerNode.id,
    interaction,
  );
  const combinedAlpha = animOpacity * interactionOpacity;

  if (combinedAlpha < 1) {
    ctx.globalAlpha = combinedAlpha;
  }

  const rx = cx - drawWidth / 2;
  const ry = cy - drawHeight / 2;

  // Opaque background
  ctx.beginPath();
  ctx.roundRect(rx, ry, drawWidth, drawHeight, borderRadius);
  ctx.fillStyle = '#07080a';
  ctx.fill();

  // Semi-transparent white fill
  ctx.beginPath();
  ctx.roundRect(rx, ry, drawWidth, drawHeight, borderRadius);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();

  // Stroke
  ctx.beginPath();
  ctx.roundRect(rx, ry, drawWidth, drawHeight, borderRadius);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (combinedAlpha < 1) {
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw a glow + enlarged circle/rect for the selected node.
 *
 * Uses canvas shadowBlur for the glow effect with coral accent color.
 * The node is redrawn slightly larger (SELECTED_SCALE) on top of the
 * existing draw to create a visual pop effect.
 */
function drawSelectedGlow(
  ctx: CanvasRenderingContext2D,
  selectedNode: LayoutNode,
  transform: FitTransform,
): void {
  const { scale, offsetX, offsetY } = transform;
  const sx = Math.round(selectedNode.x * scale + offsetX);
  const sy = Math.round(selectedNode.y * scale + offsetY);

  ctx.save();
  ctx.shadowBlur = SELECTED_GLOW_BLUR;
  ctx.shadowColor = SELECTED_GLOW_COLOR;

  if (selectedNode.tier === 0) {
    // Center rectangle glow
    const { width, height, borderRadius } = NODE_SIZES.center;
    const w = width * SELECTED_SCALE;
    const h = height * SELECTED_SCALE;

    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy - h / 2, w, h, borderRadius);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
  } else {
    // Circle node glow
    const config = TIER_RADII[selectedNode.tier];
    if (config) {
      const sizeHash = hashString(selectedNode.id);
      const baseRadius =
        config.base *
        (config.minMult + sizeHash * (config.maxMult - config.minMult));

      ctx.beginPath();
      ctx.arc(sx, sy, baseRadius * SELECTED_SCALE, 0, Math.PI * 2);
      ctx.fillStyle = selectedNode.color;
      ctx.fill();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Exported render functions
// ---------------------------------------------------------------------------

export function renderHive(
  ctx: CanvasRenderingContext2D,
  layout: LayoutResult,
  canvasWidth: number,
  canvasHeight: number,
  visibility?: Record<number, TierVisibility>,
  interaction?: InteractionRenderState,
): void {
  const transform = computeFitTransform(layout.bounds, canvasWidth, canvasHeight);

  // 1. Connection lines (underneath)
  drawConnectionLines(ctx, layout.links, transform, visibility, interaction);

  // 2. Nodes with per-node variation (on top of lines)
  drawNodes(ctx, layout.nodes, transform, visibility, interaction);

  // 3. Center rectangle (on top of everything)
  const centerNode = layout.nodes.find((n) => n.tier === 0);
  if (centerNode) {
    drawCenterRect(ctx, centerNode, transform, visibility, interaction);
  }

  // 4. Selected node glow (topmost layer)
  if (interaction?.selectedNodeId) {
    const selectedNodeObj = layout.nodes.find(
      (n) => n.id === interaction.selectedNodeId,
    );
    if (selectedNodeObj) {
      drawSelectedGlow(ctx, selectedNodeObj, transform);
    }
  }
}

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

  // 2. Draw placeholder dots on each ring
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
