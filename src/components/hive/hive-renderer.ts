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
  BEZIER_CURVE_INTENSITY,
  CONNECTION_FADE_END,
  CONNECTION_FADE_START,
  DEPTH_LAYER_CONFIG,
  DIM_LINE_OPACITY,
  DIM_OPACITY,
  HIVE_OUTER_RADIUS,
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
import type { DepthLayer, LayoutLink, LayoutNode, LayoutResult, ParallaxOffset } from './hive-types';

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

function drawBezierConnections(
  ctx: CanvasRenderingContext2D,
  links: LayoutLink[],
  transform: FitTransform,
  depthLayer: DepthLayer,
  visibility?: Record<number, TierVisibility>,
  interaction?: InteractionRenderState,
  parallaxOffset?: ParallaxOffset,
): void {
  const { scale, offsetX, offsetY } = transform;

  for (const { source, target } of links) {
    // Background culling: skip background-to-background links
    if (source.depthLayer === 'background' && target.depthLayer === 'background') continue;

    // Only draw links that belong to this depth layer pass
    // A link belongs to a layer if its higher-depth endpoint matches
    const linkLayer = source.depthLayer === depthLayer || target.depthLayer === depthLayer;
    if (!linkLayer) continue;

    const targetTier = target.tier;
    const sourceTier = source.tier;

    // Determine line opacity based on link type
    let baseOpacity: number;
    if (sourceTier === 0 && targetTier === 1) {
      baseOpacity = 0.08;
    } else if (sourceTier === 1 && targetTier === 1) {
      baseOpacity = 0.06;
    } else {
      baseOpacity = LINE_OPACITY[targetTier] ?? 0.10;
    }

    if (baseOpacity <= 0) continue;

    // Distance-based opacity fade (HIVE-4)
    const worldDist = Math.sqrt((source.x - target.x) ** 2 + (source.y - target.y) ** 2);
    const normalized = worldDist / HIVE_OUTER_RADIUS;
    if (normalized > CONNECTION_FADE_END) continue;
    const distFade = normalized < CONNECTION_FADE_START ? 1
      : 1 - (normalized - CONNECTION_FADE_START) / (CONNECTION_FADE_END - CONNECTION_FADE_START);

    // Animation
    const animTier = Math.max(sourceTier, targetTier);
    const vis = visibility?.[animTier];
    if (vis !== undefined && vis.opacity <= 0) continue;
    let finalOpacity = vis !== undefined ? baseOpacity * vis.opacity : baseOpacity;
    finalOpacity *= Math.max(0, distFade);

    // Interaction: dim unrelated links
    if (!isLinkRelevant(source.id, target.id, interaction)) {
      finalOpacity = DIM_LINE_OPACITY;
    }

    if (finalOpacity <= 0.001) continue;

    // Apply parallax offset based on each endpoint's depth layer
    const srcConfig = DEPTH_LAYER_CONFIG[source.depthLayer];
    const tgtConfig = DEPTH_LAYER_CONFIG[target.depthLayer];
    const px = parallaxOffset?.x ?? 0;
    const py = parallaxOffset?.y ?? 0;

    const sx = source.x * scale + offsetX + px * srcConfig.parallaxFactor;
    const sy = source.y * scale + offsetY + py * srcConfig.parallaxFactor;
    const tx = target.x * scale + offsetX + px * tgtConfig.parallaxFactor;
    const ty = target.y * scale + offsetY + py * tgtConfig.parallaxFactor;

    // Bezier control point (HIVE-4)
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    const dx = tx - sx, dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.5) continue;
    const curveDir = hashString(source.id + target.id) > 0.5 ? 1 : -1;
    const cpx = mx + (-dy / dist) * dist * BEZIER_CURVE_INTENSITY * curveDir;
    const cpy = my + (dx / dist) * dist * BEZIER_CURVE_INTENSITY * curveDir;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${finalOpacity})`;
    ctx.lineWidth = 0.7;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cpx, cpy, tx, ty);
    ctx.stroke();
  }
}

/**
 * Draw nodes for a single depth layer using batched draw calls.
 *
 * Nodes are grouped by fill color for fewer state changes.
 * Depth layer config scales size and opacity for 2.5D effect.
 */
function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: LayoutNode[],
  depthLayer: DepthLayer,
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
  interaction?: InteractionRenderState,
  parallaxOffset?: ParallaxOffset,
): void {
  const { scale, offsetX, offsetY } = transform;
  const depthConfig = DEPTH_LAYER_CONFIG[depthLayer];
  const px = (parallaxOffset?.x ?? 0) * depthConfig.parallaxFactor;
  const py = (parallaxOffset?.y ?? 0) * depthConfig.parallaxFactor;

  // Group nodes by color+alpha for batched drawing
  const colorGroups = new Map<string, Array<{ x: number; y: number; r: number }>>();

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

    // Interaction opacity + depth layer opacity
    const interactionOpacity = getNodeInteractionOpacity(node.id, interaction);
    const combinedAlpha = animOpacity * interactionOpacity * depthConfig.opacity;

    const drawRadius = config.base * sizeMultiplier * animScale * depthConfig.sizeMultiplier;

    // Sub-pixel optimization: skip nodes too small to see
    if (drawRadius * scale < 0.5) continue;

    const x = node.x * scale + offsetX + px;
    const y = node.y * scale + offsetY + py;

    // Create color key including alpha for batching
    const colorKey = combinedAlpha < 1 ? `${node.color}|${combinedAlpha.toFixed(2)}` : node.color;
    let group = colorGroups.get(colorKey);
    if (!group) {
      group = [];
      colorGroups.set(colorKey, group);
    }
    group.push({ x, y, r: drawRadius });
  }

  // Batch draw per color group
  for (const [key, circles] of colorGroups) {
    const pipeIdx = key.indexOf('|');
    const color = pipeIdx >= 0 ? key.slice(0, pipeIdx) : key;
    const alpha = pipeIdx >= 0 ? parseFloat(key.slice(pipeIdx + 1)) : 1;

    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const c of circles) {
      ctx.moveTo(c.x + c.r, c.y);
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    }
    ctx.fill();
    if (alpha < 1) ctx.globalAlpha = 1;
  }
}

function drawCenterRect(
  ctx: CanvasRenderingContext2D,
  centerNode: LayoutNode,
  transform: FitTransform,
  visibility?: Record<number, TierVisibility>,
  interaction?: InteractionRenderState,
  parallaxOffset?: ParallaxOffset,
): void {
  const vis = visibility?.[0];
  if (vis !== undefined && vis.opacity <= 0) return;

  const { scale, offsetX, offsetY } = transform;
  const { width, height, borderRadius } = NODE_SIZES.center;
  const fgConfig = DEPTH_LAYER_CONFIG.foreground;

  const scaleMultiplier = vis !== undefined ? vis.scale : 1;
  const drawWidth = width * scaleMultiplier;
  const drawHeight = height * scaleMultiplier;

  const px = (parallaxOffset?.x ?? 0) * fgConfig.parallaxFactor;
  const py = (parallaxOffset?.y ?? 0) * fgConfig.parallaxFactor;
  const cx = Math.round(centerNode.x * scale + offsetX + px);
  const cy = Math.round(centerNode.y * scale + offsetY + py);

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
  parallaxOffset?: ParallaxOffset,
): void {
  const { scale, offsetX, offsetY } = transform;
  const depthConfig = DEPTH_LAYER_CONFIG[selectedNode.depthLayer];
  const px = (parallaxOffset?.x ?? 0) * depthConfig.parallaxFactor;
  const py = (parallaxOffset?.y ?? 0) * depthConfig.parallaxFactor;
  const sx = Math.round(selectedNode.x * scale + offsetX + px);
  const sy = Math.round(selectedNode.y * scale + offsetY + py);

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
  parallaxOffset?: ParallaxOffset,
): void {
  const transform = computeFitTransform(layout.bounds, canvasWidth, canvasHeight);

  // Pre-bucket nodes by depth layer (HIVE-1)
  const buckets: Record<DepthLayer, LayoutNode[]> = {
    background: [], midground: [], foreground: [],
  };
  for (const node of layout.nodes) {
    if (node.tier === 0) continue;
    buckets[node.depthLayer].push(node);
  }

  // Render back-to-front: background → midground → foreground
  const layers: DepthLayer[] = ['background', 'midground', 'foreground'];
  for (const layer of layers) {
    drawBezierConnections(ctx, layout.links, transform, layer, visibility, interaction, parallaxOffset);
    drawNodes(ctx, buckets[layer], layer, transform, visibility, interaction, parallaxOffset);
  }

  // Center rectangle (foreground, on top of everything)
  const centerNode = layout.nodes.find((n) => n.tier === 0);
  if (centerNode) {
    drawCenterRect(ctx, centerNode, transform, visibility, interaction, parallaxOffset);
  }

  // Selected node glow (topmost layer)
  if (interaction?.selectedNodeId) {
    const selectedNodeObj = layout.nodes.find(
      (n) => n.id === interaction.selectedNodeId,
    );
    if (selectedNodeObj) {
      drawSelectedGlow(ctx, selectedNodeObj, transform, parallaxOffset);
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
