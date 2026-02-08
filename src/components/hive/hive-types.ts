// ---------------------------------------------------------------------------
// hive-types.ts -- TypeScript interfaces for the hive visualization data model
// ---------------------------------------------------------------------------

/** A node in the hive tree data structure (input to layout). */
export interface HiveNode {
  /** Stable unique identifier (used for deterministic sort). */
  id: string;
  /** Human-readable label displayed on hover / tooltip. */
  name: string;
  /** Tier depth: 0 = center, 1 = main themes, 2 = sub-themes. */
  tier: 0 | 1 | 2;
  /** Child nodes (undefined or empty for leaf nodes). */
  children?: HiveNode[];
  /** Arbitrary payload for future extensibility (e.g. thumbnail URL). */
  meta?: Record<string, unknown>;
}

/** Root of the hive tree -- always tier 0 with children. */
export type HiveData = HiveNode;

/** A node after layout computation -- screen-space position resolved. */
export interface LayoutNode {
  id: string;
  tier: number;
  /** Cartesian x (logical units, center = 0). */
  x: number;
  /** Cartesian y (logical units, center = 0). */
  y: number;
  /** Angle in radians from the radial layout. */
  angle: number;
  /** Distance from center in logical units. */
  radius: number;
  /** Parent node id (null for center). */
  parentId: string | null;
  /** Node color (rgba string). Tier-1 gets unique color, tier-2 inherits from parent. */
  color: string;
}

/** A connection between two positioned nodes. */
export interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
}

/** Complete layout output consumed by the renderer. */
export interface LayoutResult {
  nodes: LayoutNode[];
  links: LayoutLink[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/** Per-tier visual configuration for the renderer. */
export interface TierConfig {
  /** Draw radius for circle nodes (px), or dimensions for center rect. */
  radius: number;
  /** Fill color (rgba string). */
  fill: string;
  /** Connection line opacity for links targeting this tier. */
  lineOpacity: number;
}

/** Canvas dimensions used by resize / fit-to-viewport logic. */
export interface CanvasSize {
  /** CSS pixel width. */
  width: number;
  /** CSS pixel height. */
  height: number;
  /** Device pixel ratio. */
  dpr: number;
}

// ---------------------------------------------------------------------------
// Interaction types (Phase 49)
// ---------------------------------------------------------------------------

/** Camera state for zoom/pan -- extracted from HiveCanvas for shared use. */
export interface Camera {
  zoom: number;
  panX: number;
  panY: number;
}

/** Fit-to-viewport transform computed from layout bounds. */
export interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Mutable interaction state stored in refs (not React state). */
export interface InteractionState {
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  connectedNodeIds: Set<string>;
}

/** Result of a hit detection query. */
export interface HitTestResult {
  node: LayoutNode;
  screenX: number;
  screenY: number;
}
