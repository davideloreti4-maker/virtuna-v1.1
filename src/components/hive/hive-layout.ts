// ---------------------------------------------------------------------------
// hive-layout.ts -- Deterministic radial layout using d3-hierarchy
// ---------------------------------------------------------------------------

import { hierarchy, tree } from 'd3-hierarchy';
import { HIVE_OUTER_RADIUS, VIEWPORT_PADDING } from './hive-constants';
import type { HiveNode, HiveData, LayoutNode, LayoutLink, LayoutResult } from './hive-types';

// ---------------------------------------------------------------------------
// computeHiveLayout
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic radial tree layout for hive data.
 *
 * Pure function: same `data` always produces identical `LayoutResult`.
 *
 * Uses d3-hierarchy's Reingold-Tilford tidy tree algorithm configured for
 * radial placement. Converts polar coordinates (angle, radius) to cartesian
 * (x, y) and rounds to integers to avoid sub-pixel anti-aliasing artifacts.
 *
 * @param data     - Root hive node (tier 0 with children)
 * @param outerRadius - Logical radius for outermost tier (default 1200)
 * @returns Layout with positioned nodes, links, and bounding box
 */
export function computeHiveLayout(
  data: HiveData,
  outerRadius: number = HIVE_OUTER_RADIUS,
): LayoutResult {
  // 1. Build d3 hierarchy and sort deterministically by id
  const root = hierarchy<HiveNode>(data)
    .sort((a, b) => a.data.id.localeCompare(b.data.id));

  // 2. Create radial tree layout
  const treeLayout = tree<HiveNode>()
    .size([2 * Math.PI, outerRadius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

  // 3. Apply layout -- returns a HierarchyPointNode with x/y assigned
  const laid = treeLayout(root);

  // 4. Build a map from id -> LayoutNode for link resolution
  const nodeMap = new Map<string, LayoutNode>();
  const nodes: LayoutNode[] = [];

  for (const d of laid.descendants()) {
    // d.x = angle (radians), d.y = distance from center
    const angle = d.x;
    const r = d.y;
    const cartesianX = Math.round(r * Math.cos(angle - Math.PI / 2));
    const cartesianY = Math.round(r * Math.sin(angle - Math.PI / 2));

    const layoutNode: LayoutNode = {
      id: d.data.id,
      tier: d.data.tier,
      x: cartesianX,
      y: cartesianY,
      angle,
      radius: r,
      parentId: d.parent?.data.id ?? null,
    };

    nodes.push(layoutNode);
    nodeMap.set(d.data.id, layoutNode);
  }

  // 5. Build links from d3 hierarchy links, resolving to LayoutNode refs
  const links: LayoutLink[] = [];
  for (const l of laid.links()) {
    const source = nodeMap.get(l.source.data.id);
    const target = nodeMap.get(l.target.data.id);
    if (source && target) {
      links.push({ source, target });
    }
  }

  // 6. Compute bounding box (account for node draw radii at edges)
  const NODE_PADDING = 10; // max node radius buffer
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    if (n.x - NODE_PADDING < minX) minX = n.x - NODE_PADDING;
    if (n.x + NODE_PADDING > maxX) maxX = n.x + NODE_PADDING;
    if (n.y - NODE_PADDING < minY) minY = n.y - NODE_PADDING;
    if (n.y + NODE_PADDING > maxY) maxY = n.y + NODE_PADDING;
  }

  return { nodes, links, bounds: { minX, maxX, minY, maxY } };
}

// ---------------------------------------------------------------------------
// computeFitTransform
// ---------------------------------------------------------------------------

/**
 * Calculate a transform (scale + offset) that fits the layout bounds
 * inside a canvas with optional padding.
 *
 * @param bounds       - Bounding box from LayoutResult
 * @param canvasWidth  - CSS pixel width of the canvas
 * @param canvasHeight - CSS pixel height of the canvas
 * @param padding      - Viewport padding (default VIEWPORT_PADDING)
 * @returns Transform to apply to canvas context
 */
export function computeFitTransform(
  bounds: LayoutResult['bounds'],
  canvasWidth: number,
  canvasHeight: number,
  padding: number = VIEWPORT_PADDING,
): { scale: number; offsetX: number; offsetY: number } {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  // Avoid division by zero for degenerate cases
  if (contentWidth <= 0 || contentHeight <= 0) {
    return { scale: 1, offsetX: canvasWidth / 2, offsetY: canvasHeight / 2 };
  }

  const scaleX = (canvasWidth - padding * 2) / contentWidth;
  const scaleY = (canvasHeight - padding * 2) / contentHeight;
  const scale = Math.min(scaleX, scaleY);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    scale,
    offsetX: canvasWidth / 2 - centerX * scale,
    offsetY: canvasHeight / 2 - centerY * scale,
  };
}
