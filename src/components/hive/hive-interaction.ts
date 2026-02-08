// ---------------------------------------------------------------------------
// hive-interaction.ts -- Pure utility functions for hive interaction layer
// ---------------------------------------------------------------------------
//
// Quadtree spatial indexing, hit detection, coordinate transforms between
// screen space and layout (world) space, adjacency map for connected-node
// lookups, and overlay positioning logic.
//
// All functions are pure (no side effects, no React dependency).
// ---------------------------------------------------------------------------

import { quadtree, type Quadtree } from 'd3-quadtree';

import { HIT_SEARCH_RADIUS, HIT_ZOOM_FLOOR } from './hive-constants';
import type {
  Camera,
  FitTransform,
  LayoutLink,
  LayoutNode,
  LayoutResult,
} from './hive-types';

// ---------------------------------------------------------------------------
// Quadtree builder
// ---------------------------------------------------------------------------

/**
 * Build a d3 quadtree from all layout nodes for O(log n) spatial queries.
 *
 * Call once per layout computation (when data changes), reuse for all
 * subsequent hit detection queries until the next layout change.
 */
export function buildHiveQuadtree(layout: LayoutResult): Quadtree<LayoutNode> {
  return quadtree<LayoutNode>()
    .x((d) => d.x)
    .y((d) => d.y)
    .addAll(layout.nodes);
}

// ---------------------------------------------------------------------------
// Adjacency map
// ---------------------------------------------------------------------------

/**
 * Build a bidirectional adjacency map from layout links.
 *
 * For each link, both source and target are added to each other's set,
 * creating an undirected graph. Lookups are O(1) by node ID.
 */
export function buildAdjacencyMap(
  links: LayoutLink[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const { source, target } of links) {
    if (!map.has(source.id)) map.set(source.id, new Set());
    if (!map.has(target.id)) map.set(target.id, new Set());
    map.get(source.id)!.add(target.id);
    map.get(target.id)!.add(source.id);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/**
 * Convert screen (CSS pixel) coordinates to layout (world) space.
 *
 * Inverts the canvas transform chain applied during rendering:
 *   1. Camera translate: ctx.translate(cssW/2 + panX, cssH/2 + panY)
 *   2. Camera zoom: ctx.scale(zoom, zoom)
 *   3. Camera re-center: ctx.translate(-cssW/2, -cssH/2)
 *   4. Fit transform: translate(offsetX, offsetY) + scale(fitScale)
 *
 * DPR is handled separately by the canvas buffer and does not affect
 * CSS-pixel-level coordinate math.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  fitTransform: FitTransform,
): { x: number; y: number } {
  // Undo camera transform
  const cx =
    (screenX - canvasWidth / 2 - camera.panX) / camera.zoom + canvasWidth / 2;
  const cy =
    (screenY - canvasHeight / 2 - camera.panY) / camera.zoom +
    canvasHeight / 2;

  // Undo fit transform
  const worldX = (cx - fitTransform.offsetX) / fitTransform.scale;
  const worldY = (cy - fitTransform.offsetY) / fitTransform.scale;

  return { x: worldX, y: worldY };
}

/**
 * Convert layout (world) space coordinates to screen (CSS pixel) space.
 *
 * Forward transform for overlay positioning -- applies fit transform
 * then camera transform in the same order as the canvas renderer.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  fitTransform: FitTransform,
): { x: number; y: number } {
  // Apply fit transform
  const fittedX = worldX * fitTransform.scale + fitTransform.offsetX;
  const fittedY = worldY * fitTransform.scale + fitTransform.offsetY;

  // Apply camera transform
  const screenX =
    (fittedX - canvasWidth / 2) * camera.zoom + canvasWidth / 2 + camera.panX;
  const screenY =
    (fittedY - canvasHeight / 2) * camera.zoom +
    canvasHeight / 2 +
    camera.panY;

  return { x: screenX, y: screenY };
}

// ---------------------------------------------------------------------------
// Hit detection
// ---------------------------------------------------------------------------

/**
 * Find the closest node to a world-space point using quadtree search.
 *
 * The search radius scales inversely with zoom level -- at high zoom,
 * nodes are visually larger so the search area shrinks in world space.
 * A floor prevents the radius from becoming too small at extreme zoom.
 *
 * @returns The closest LayoutNode within the search radius, or undefined.
 */
export function findHoveredNode(
  tree: Quadtree<LayoutNode>,
  worldX: number,
  worldY: number,
  zoomLevel: number,
): LayoutNode | undefined {
  const searchRadius =
    HIT_SEARCH_RADIUS / Math.max(zoomLevel * 0.5, HIT_ZOOM_FLOOR);
  const found = tree.find(worldX, worldY, searchRadius);
  return found ?? undefined;
}

// ---------------------------------------------------------------------------
// Overlay positioning
// ---------------------------------------------------------------------------

/** Placement direction for the overlay relative to the node. */
export type OverlayPlacement = 'right' | 'left' | 'bottom';

/** Computed overlay position with placement direction. */
export interface OverlayPosition {
  left: number;
  top: number;
  placement: OverlayPlacement;
}

/**
 * Compute the optimal position for an info overlay relative to a node.
 *
 * Prefers right placement, falls back to left, then bottom. Clamps
 * vertical position to keep the overlay within container bounds with
 * an 8px margin.
 *
 * @param nodeScreenX - Node screen X coordinate (CSS pixels).
 * @param nodeScreenY - Node screen Y coordinate (CSS pixels).
 * @param overlayWidth - Overlay element width (CSS pixels).
 * @param overlayHeight - Overlay element height (CSS pixels).
 * @param containerWidth - Container element width (CSS pixels).
 * @param containerHeight - Container element height (CSS pixels).
 * @param offset - Gap between node and overlay edge (default 16px).
 */
export function computeOverlayPosition(
  nodeScreenX: number,
  nodeScreenY: number,
  overlayWidth: number,
  overlayHeight: number,
  containerWidth: number,
  containerHeight: number,
  offset: number = 16,
): OverlayPosition {
  const margin = 8;

  // Clamp vertical position helper
  const clampTop = (top: number): number =>
    Math.max(margin, Math.min(top, containerHeight - overlayHeight - margin));

  // Prefer right placement
  if (nodeScreenX + offset + overlayWidth < containerWidth - margin) {
    return {
      left: nodeScreenX + offset,
      top: clampTop(nodeScreenY - overlayHeight / 2),
      placement: 'right',
    };
  }

  // Fall back to left
  if (nodeScreenX - offset - overlayWidth > margin) {
    return {
      left: nodeScreenX - offset - overlayWidth,
      top: clampTop(nodeScreenY - overlayHeight / 2),
      placement: 'left',
    };
  }

  // Fall back to bottom
  return {
    left: Math.max(
      margin,
      Math.min(
        nodeScreenX - overlayWidth / 2,
        containerWidth - overlayWidth - margin,
      ),
    ),
    top: Math.min(
      nodeScreenY + offset,
      containerHeight - overlayHeight - margin,
    ),
    placement: 'bottom',
  };
}
