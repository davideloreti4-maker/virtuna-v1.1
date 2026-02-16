// ---------------------------------------------------------------------------
// hive-layout.ts -- Deterministic scattered layout
// ---------------------------------------------------------------------------
//
// Uses d3-hierarchy only for tree structure (parent-child links).
// Node positions are computed with deterministic pseudo-random placement
// using golden angle distribution + hash-based jitter, creating an organic
// network graph feel rather than a hierarchical tree.
// ---------------------------------------------------------------------------

import { hierarchy } from 'd3-hierarchy';
import { HIVE_OUTER_RADIUS, VIEWPORT_PADDING, getNodeColor } from './hive-constants';
import type { HiveNode, HiveData, LayoutNode, LayoutLink, LayoutResult } from './hive-types';

// ---------------------------------------------------------------------------
// Deterministic hash (pure, no external deps)
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h;
}

/** Returns a deterministic value in [0, 1] based on string. */
function hash01(s: string): number {
  return (hashString(s) & 0x7fffffff) / 0x7fffffff;
}

/** Returns a deterministic value in [0, 1] with a salt. */
function hash01s(s: string, salt: string): number {
  return hash01(salt + s);
}

// ---------------------------------------------------------------------------
// Golden angle for even angular distribution
// ---------------------------------------------------------------------------

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.399 radians

// ---------------------------------------------------------------------------
// computeHiveLayout
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic scattered layout.
 *
 * Pure function: same `data` always produces identical `LayoutResult`.
 *
 * Uses golden angle distribution for base angles (even spacing) with
 * per-node hash-based radius variation. Creates an organic, network-like
 * appearance where nodes scatter freely rather than forming concentric rings.
 *
 * Links are derived from the tree hierarchy but positions are independent.
 */
export function computeHiveLayout(
  data: HiveData,
  outerRadius: number = HIVE_OUTER_RADIUS,
): LayoutResult {
  // 1. Build d3 hierarchy for structure (links) and sort deterministically
  const root = hierarchy<HiveNode>(data)
    .sort((a, b) => a.data.id.localeCompare(b.data.id));

  const descendants = root.descendants();

  // 2. Position nodes using golden angle + hash-based scatter
  const nodeMap = new Map<string, LayoutNode>();
  const nodes: LayoutNode[] = [];

  // Separate tiers for independent positioning
  const tier1Nodes = descendants.filter(d => d.data.tier === 1);
  const tier2Nodes = descendants.filter(d => d.data.tier === 2);

  // Center node
  const centerDesc = descendants.find(d => d.data.tier === 0);
  if (centerDesc) {
    const centerLayout: LayoutNode = {
      id: centerDesc.data.id,
      name: centerDesc.data.name,
      tier: 0,
      x: 0, y: 0, angle: 0, radius: 0,
      parentId: null,
      color: 'rgba(255, 255, 255, 0.10)',
      meta: centerDesc.data.meta,
    };
    nodes.push(centerLayout);
    nodeMap.set(centerDesc.data.id, centerLayout);
  }

  // Tier-1: symmetrically spaced around center, each with unique color
  const TIER1_RADIUS = outerRadius * 0.15;
  const tier1ColorMap = new Map<string, number>(); // id → color index

  for (let i = 0; i < tier1Nodes.length; i++) {
    const d = tier1Nodes[i]!;
    const angle = (i / tier1Nodes.length) * 2 * Math.PI;
    const r = TIER1_RADIUS;

    const x = Math.round(r * Math.cos(angle));
    const y = Math.round(r * Math.sin(angle));

    tier1ColorMap.set(d.data.id, i);

    const layoutNode: LayoutNode = {
      id: d.data.id,
      name: d.data.name,
      tier: 1,
      x, y, angle, radius: r,
      parentId: d.parent?.data.id ?? null,
      color: getNodeColor(i, 0.85),
      meta: d.data.meta,
    };
    nodes.push(layoutNode);
    nodeMap.set(d.data.id, layoutNode);
  }

  // Tier-2: clustered in a cone behind their parent tier-1 node
  // Each color group fans out away from center, behind its tier-1 parent
  const tier2ByParent = new Map<string, typeof tier2Nodes>();
  for (const d of tier2Nodes) {
    const pid = d.parent?.data.id ?? '';
    if (!tier2ByParent.has(pid)) tier2ByParent.set(pid, []);
    tier2ByParent.get(pid)!.push(d);
  }

  // How far the cluster extends outward from the tier-1 node
  const CLUSTER_MIN_DIST = outerRadius * 0.04;
  const CLUSTER_MAX_DIST = outerRadius * 0.50;
  // Angular half-width of the cone (±50 degrees from parent direction)
  const CONE_HALF_ANGLE = Math.PI * 0.28;

  for (const [parentId, children] of tier2ByParent) {
    const parentNode = nodeMap.get(parentId);
    if (!parentNode) continue;

    const colorIndex = tier1ColorMap.get(parentId) ?? 0;
    // Direction from center to parent — cluster fans out along this axis
    const parentAngle = Math.atan2(parentNode.y, parentNode.x);

    for (let i = 0; i < children.length; i++) {
      const d = children[i]!;

      // Golden angle base for organic scatter within the cone
      const goldenOffset = i * GOLDEN_ANGLE;
      // Map golden angle into cone range using modulo + hash jitter
      const normalizedAngle = ((goldenOffset % (2 * CONE_HALF_ANGLE)) / (2 * CONE_HALF_ANGLE)) * 2 - 1;
      const angleJitter = (hash01s(d.data.id, 'ang') - 0.5) * 0.6;
      const angle = parentAngle + CONE_HALF_ANGLE * (normalizedAngle + angleJitter);

      // Scattered radial distance: mix sqrt distribution with hash for organic feel
      const rNorm = Math.sqrt((i + 0.5) / children.length);
      const rHash = hash01(d.data.id);
      const rMix = rNorm * 0.5 + rHash * 0.5;
      const dist = CLUSTER_MIN_DIST + (CLUSTER_MAX_DIST - CLUSTER_MIN_DIST) * rMix;

      // Position: start from parent, go outward in the cone direction
      const x = Math.round(parentNode.x + dist * Math.cos(angle));
      const y = Math.round(parentNode.y + dist * Math.sin(angle));

      const layoutNode: LayoutNode = {
        id: d.data.id,
        name: d.data.name,
        tier: 2,
        x, y, angle, radius: dist,
        parentId: parentId || null,
        color: getNodeColor(colorIndex, 0.55),
        meta: d.data.meta,
      };
      nodes.push(layoutNode);
      nodeMap.set(d.data.id, layoutNode);
    }
  }

  // 3. Build links:
  //    - center → tier-1 (hub connections)
  //    - tier-1 ↔ tier-1 (mesh between all tier-1 nodes)
  //    - tier-1 → tier-2 (parent-child only — same color group)
  const links: LayoutLink[] = [];

  // Center → tier-1
  const centerNode = nodeMap.get(centerDesc?.data.id ?? '');
  if (centerNode) {
    for (const t1 of tier1Nodes) {
      const t1Node = nodeMap.get(t1.data.id);
      if (t1Node) links.push({ source: centerNode, target: t1Node });
    }
  }

  // Tier-1 ↔ tier-1 mesh (connect every pair)
  for (let i = 0; i < tier1Nodes.length; i++) {
    for (let j = i + 1; j < tier1Nodes.length; j++) {
      const a = nodeMap.get(tier1Nodes[i]!.data.id);
      const b = nodeMap.get(tier1Nodes[j]!.data.id);
      if (a && b) links.push({ source: a, target: b });
    }
  }

  // Tier-1 → tier-2 (parent-child from hierarchy)
  for (const l of root.links()) {
    if (l.source.data.tier === 1 && l.target.data.tier === 2) {
      const source = nodeMap.get(l.source.data.id);
      const target = nodeMap.get(l.target.data.id);
      if (source && target) links.push({ source, target });
    }
  }

  // 4. Compute bounding box
  const NODE_PADDING = 20;
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

export function computeFitTransform(
  bounds: LayoutResult['bounds'],
  canvasWidth: number,
  canvasHeight: number,
  padding: number = VIEWPORT_PADDING,
): { scale: number; offsetX: number; offsetY: number } {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

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
