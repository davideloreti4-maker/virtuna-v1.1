# Phase 49: Hive Interactions (Click, Hover & Navigation) - Research

**Researched:** 2026-02-08
**Domain:** Canvas 2D interaction (hit detection, hover/click feedback, overlay positioning)
**Confidence:** HIGH

## Summary

This phase adds interactive behaviors to the existing HiveCanvas: d3-quadtree for O(log n) hit detection, hover highlighting with connected-node emphasis, click glow/scale effects with a GlassCard info overlay, debounced hover states, and pinch-to-zoom for mobile. The existing HiveCanvas already has zoom (wheel) and pan (mouse drag) implemented in Phase 48, so those need augmentation rather than fresh implementation.

The standard approach uses `d3-quadtree` (v3.0.1) for spatial indexing of layout nodes, a screen-to-world coordinate inverse transform to convert mouse positions into layout space, and a ref-based interaction state model (no React state for per-frame changes) that feeds into the existing `renderHive()` pipeline. The GlassCard info overlay is a React component absolutely positioned over the canvas container using DOM coordinates derived from the clicked node's world-space position.

**Primary recommendation:** Install `d3-quadtree` + `@types/d3-quadtree`, build the quadtree once from `LayoutResult.nodes`, implement screen-to-world conversion using the existing camera transform math, and add interaction state as a ref-based object that the renderer reads during each draw call. The overlay is a React DOM element (not canvas-drawn) positioned via `position: absolute` relative to the canvas container.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `d3-quadtree` | ^3.0.1 | O(log n) spatial hit detection | D3 module, purpose-built for 2D point lookups. Already using d3-hierarchy in this project. |
| `@types/d3-quadtree` | ^3.0.6 | TypeScript definitions | DefinitelyTyped, matches d3-quadtree v3 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GlassPanel (existing) | n/a | Glass overlay for node info | Click overlay uses existing design system component |
| GlassCard (existing) | n/a | Alternative card wrapper | If overlay needs glow/color theming |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-quadtree | d3-delaunay (Voronoi) | Voronoi expands hit areas to fill empty space — better for sparse charts, worse for dense clusters where nearest-neighbor distance is meaningful. Quadtree with search radius is more appropriate for this hive (~350 nodes, varying density). |
| d3-quadtree | Manual brute-force loop | O(n) per mousemove, fine for 350 nodes but violates the success criteria requiring O(log n). Quadtree future-proofs for larger datasets. |
| DOM overlay | Canvas-drawn tooltip | Canvas tooltip requires redrawing text on every frame and can't leverage existing GlassPanel/GlassCard design system components. DOM overlay is standard for mixed canvas+UI. |

**Installation:**
```bash
pnpm add d3-quadtree
pnpm add -D @types/d3-quadtree
```

## Architecture Patterns

### Recommended File Structure
```
src/components/hive/
├── HiveCanvas.tsx              # Existing — add interaction event handlers + overlay
├── hive-renderer.ts            # Existing — add interactive render mode (dim/highlight)
├── hive-interaction.ts         # NEW — quadtree builder, hit detection, coordinate transforms
├── hive-types.ts               # Existing — add InteractionState, HitTestResult types
├── hive-constants.ts           # Existing — add interaction constants (thresholds, opacities)
├── use-hive-interaction.ts     # NEW — hook managing interaction refs + event wiring
├── HiveNodeOverlay.tsx         # NEW — React component for the click info GlassCard
├── hive-layout.ts              # Existing — unchanged
├── hive-mock-data.ts           # Existing — unchanged
├── use-hive-animation.ts       # Existing — unchanged
└── use-canvas-resize.ts        # Existing — unchanged
```

### Pattern 1: Ref-Based Interaction State (No React State for Per-Frame Data)
**What:** Store all interaction state (hovered node, selected node, interaction mode) in refs, not useState. The render function reads refs synchronously on each frame.
**When to use:** Always for canvas interaction state that changes on mousemove (60fps). React re-renders would be catastrophic for performance.
**Why it fits:** HiveCanvas already uses this pattern — `cameraRef`, `isDraggingRef`, `lastMouseRef` are all refs. The animation hook returns a getter-based result object reading from refs. Interaction state follows the same convention.

```typescript
// Source: Existing HiveCanvas pattern (Phase 48)
interface InteractionState {
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  connectedNodeIds: Set<string>;  // Precomputed for hovered/selected node
}

const interactionRef = useRef<InteractionState>({
  hoveredNodeId: null,
  selectedNodeId: null,
  connectedNodeIds: new Set(),
});
```

### Pattern 2: Screen-to-World Coordinate Inverse Transform
**What:** Convert mouse screen coordinates to layout (world) space by reversing the camera transform chain, then query the quadtree in world space.
**When to use:** Every mouse event that needs to identify which node is under the cursor.
**Why it's critical:** The canvas applies DPR scaling, camera pan, camera zoom, and fit-transform. Mouse events report screen coordinates. The quadtree stores nodes in layout space (pre-transform). The inverse must undo all four transforms.

```typescript
// Source: Derived from existing HiveCanvas camera transform
// Canvas transform chain (applied in render):
//   1. DPR scale: ctx.scale(dpr, dpr)
//   2. Camera translate: ctx.translate(cssW/2 + cam.panX, cssH/2 + cam.panY)
//   3. Camera zoom: ctx.scale(cam.zoom, cam.zoom)
//   4. Camera re-center: ctx.translate(-cssW/2, -cssH/2)
//   5. Fit transform: translate(offsetX, offsetY) + scale(fitScale)
//
// Inverse (screen → layout space):
function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  fitTransform: { scale: number; offsetX: number; offsetY: number },
): { x: number; y: number } {
  // Undo camera transform
  const cx = (screenX - canvasWidth / 2 - camera.panX) / camera.zoom + canvasWidth / 2;
  const cy = (screenY - canvasHeight / 2 - camera.panY) / camera.zoom + canvasHeight / 2;
  // Undo fit transform
  const worldX = (cx - fitTransform.offsetX) / fitTransform.scale;
  const worldY = (cy - fitTransform.offsetY) / fitTransform.scale;
  return { x: worldX, y: worldY };
}
```

### Pattern 3: Quadtree with Search Radius for Tiered Hit Priority
**What:** Build one quadtree from all LayoutNodes. On mouse event, call `find(wx, wy, radius)` with a search radius proportional to node visual size. To handle tier priority (CONTEXT.md: tier-2 over tier-1 over center), run multiple passes with increasing radius or use the visit() method.
**When to use:** Every mousemove / click after coordinate conversion.
**Approach for tier priority:** Since tier-2 nodes are smaller, find the closest node first; if it's within its visual hit radius, use it. If the closest node is a large tier-1 node, still prefer a tier-2 node that's slightly farther but within its own visual radius. Implementation: single `find()` call, then check if the found node's tier matches expectations, or use `visit()` for a custom radius-per-tier search.

```typescript
// Source: d3-quadtree official docs (https://d3js.org/d3-quadtree)
import { quadtree } from 'd3-quadtree';
import type { LayoutNode } from './hive-types';

function buildQuadtree(nodes: LayoutNode[]) {
  return quadtree<LayoutNode>()
    .x(d => d.x)
    .y(d => d.y)
    .addAll(nodes);
}

// Simple find — closest node within radius
function findNodeAtPoint(
  tree: Quadtree<LayoutNode>,
  worldX: number,
  worldY: number,
  searchRadius: number,
): LayoutNode | undefined {
  return tree.find(worldX, worldY, searchRadius) ?? undefined;
}
```

### Pattern 4: Connected Node Precomputation via Adjacency Map
**What:** Build a `Map<string, Set<string>>` of connected node IDs from `LayoutResult.links` once. On hover, look up the hovered node's connections in O(1) instead of iterating all links.
**When to use:** At layout computation time (once per data change), not per-frame.

```typescript
function buildAdjacencyMap(links: LayoutLink[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const { source, target } of links) {
    if (!map.has(source.id)) map.set(source.id, new Set());
    if (!map.has(target.id)) map.set(target.id, new Set());
    map.get(source.id)!.add(target.id);
    map.get(target.id)!.add(source.id);
  }
  return map;
}
```

### Pattern 5: DOM Overlay for Info Card (Not Canvas-Drawn)
**What:** The GlassCard info overlay is a React component rendered as a sibling to the canvas, positioned absolutely. The node's world-space coordinates are transformed to screen space (inverse of Pattern 2) and used as CSS top/left. Auto-positioning flips the overlay when near viewport edges.
**When to use:** When the user clicks a node (selectedNodeId !== null).

```typescript
// World-to-screen (for positioning the overlay)
function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  fitTransform: { scale: number; offsetX: number; offsetY: number },
): { x: number; y: number } {
  const fittedX = worldX * fitTransform.scale + fitTransform.offsetX;
  const fittedY = worldY * fitTransform.scale + fitTransform.offsetY;
  const screenX = (fittedX - canvasWidth / 2) * camera.zoom + canvasWidth / 2 + camera.panX;
  const screenY = (fittedY - canvasHeight / 2) * camera.zoom + canvasHeight / 2 + camera.panY;
  return { x: screenX, y: screenY };
}
```

### Pattern 6: Click-vs-Drag Discrimination
**What:** Track mouse-down position and compare against mouse-up position. If the distance is below a threshold (e.g., 5px), treat as click. Otherwise, it was a drag (pan).
**When to use:** The existing HiveCanvas sets `isDraggingRef = true` on any mousedown. This must be refined so that short-distance mouse movements don't suppress click events.

```typescript
const CLICK_DRAG_THRESHOLD = 5; // pixels

const mouseDownPos = useRef({ x: 0, y: 0 });

// In mousedown handler:
mouseDownPos.current = { x: e.clientX, y: e.clientY };

// In mouseup handler:
const dx = e.clientX - mouseDownPos.current.x;
const dy = e.clientY - mouseDownPos.current.y;
const distance = Math.sqrt(dx * dx + dy * dy);
if (distance < CLICK_DRAG_THRESHOLD) {
  // This was a click — do hit detection
  handleNodeClick(e);
} else {
  // This was a drag/pan — already handled
}
```

### Anti-Patterns to Avoid
- **useState for hover state:** Triggers React re-renders 60 times/second. Use refs.
- **Rebuilding quadtree on every mousemove:** Build once when layout changes, reuse on every event.
- **Drawing tooltips on canvas:** Loses access to design system, text rendering is poor, accessibility is lost. Use DOM overlay.
- **Debouncing render calls:** The existing pattern uses requestAnimationFrame for animation — interaction renders should also use rAF coalescing, not setTimeout debounce.
- **Iterating all nodes for hit detection:** Defeats the purpose of quadtree. Always use `tree.find()`.
- **Forgetting DPR in coordinate conversion:** Mouse events report CSS pixels; canvas buffer is DPR-scaled. The existing code already handles this via `sizeRef.current.dpr`, but the interaction system must be consistent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spatial indexing / nearest-neighbor | Custom grid or brute-force loop | `d3-quadtree` | O(log n) guaranteed, handles edge cases (empty regions, coincident points), battle-tested |
| Overlay positioning math | Manual position calculation from scratch | Derive from existing camera transform (already in HiveCanvas) | Camera math already exists; just invert it |
| Glass card styling | Custom CSS for overlay | Existing `GlassPanel` / `GlassCard` components | Design system consistency, already handles blur, borders, tints |
| Pinch-to-zoom gesture math | Custom touch distance tracking | Pointer Events API pattern (MDN) | Standard approach, handles all pointer types, works with existing zoom logic |

**Key insight:** Most of the hard math (camera transforms, fit-to-viewport) already exists in HiveCanvas. The interaction layer primarily needs to *invert* these transforms and *augment* the renderer with dimming/highlighting logic.

## Common Pitfalls

### Pitfall 1: Coordinate Space Mismatch
**What goes wrong:** Hit detection fails because mouse coordinates are in screen space but quadtree nodes are in layout space. Hover appears offset or misaligned.
**Why it happens:** The canvas applies 4 transforms (DPR, pan, zoom, fit). Forgetting any one produces an offset.
**How to avoid:** Write a single `screenToWorld()` function that undoes ALL transforms in reverse order. Test by logging both the mouse position and the found node position — they should match visually.
**Warning signs:** Hover triggers on wrong nodes, or hover only works at zoom=1 pan=0.

### Pitfall 2: Click-vs-Drag Suppression
**What goes wrong:** Clicks never register because any slight mouse movement during click triggers isDraggingRef.
**Why it happens:** The current HiveCanvas sets `isDraggingRef = true` on mousedown, then starts panning on any mousemove. Even a 1px movement suppresses click.
**How to avoid:** Introduce a distance threshold (5px). Only set isDraggingRef=true after mouse moves beyond the threshold. Check distance on mouseup to discriminate click from drag.
**Warning signs:** Cannot click nodes at all, or can only click if mouse is perfectly stationary.

### Pitfall 3: Stale Quadtree After Layout Change
**What goes wrong:** After data changes (new HiveData), the quadtree still references old node positions.
**Why it happens:** Quadtree was built once and never rebuilt.
**How to avoid:** Rebuild quadtree whenever `layout` (the memoized LayoutResult) changes. Use useMemo or useEffect keyed on layout.
**Warning signs:** Hover highlights wrong nodes after data refresh.

### Pitfall 4: Overlay Position Drift During Zoom/Pan
**What goes wrong:** The GlassCard overlay stays at its initial screen position while the user zooms/pans, causing it to visually detach from the clicked node.
**Why it happens:** Overlay position was computed once on click and never updated.
**How to avoid:** Recalculate overlay position on every render frame (or at minimum on camera change). Since the overlay is a DOM element, update its `style.transform` or `style.left/top` when camera changes. Alternatively, dismiss the overlay on pan/zoom start.
**Warning signs:** Overlay floats away from its node when panning.

### Pitfall 5: Hover Flicker in Dense Clusters
**What goes wrong:** Cursor moves between densely packed tier-2 nodes, causing rapid hover/unhover cycles that look like flickering.
**Why it happens:** Adjacent nodes are only a few pixels apart; tiny mouse movements jump between nodes.
**How to avoid:** Debounce hover state changes with a short timeout (~16-30ms). If the hovered node changes again within the debounce window, cancel the previous transition. This smooths rapid changes without adding noticeable delay.
**Warning signs:** Nodes near cluster centers flash rapidly on mousemove.

### Pitfall 6: Overlay Clipped by Canvas Container
**What goes wrong:** GlassCard overlay renders outside the visible area when the node is near a container edge.
**Why it happens:** Overlay is positioned relative to node screen position without bounds checking.
**How to avoid:** Measure overlay dimensions after render, check against container bounds (getBoundingClientRect), flip placement side if it would overflow. Standard tooltip positioning pattern.
**Warning signs:** Overlay partially hidden or cut off at edges.

## Code Examples

### Building the Quadtree from LayoutResult
```typescript
// Source: d3-quadtree official docs (https://d3js.org/d3-quadtree)
import { quadtree, type Quadtree } from 'd3-quadtree';
import type { LayoutNode, LayoutResult } from './hive-types';

export function buildHiveQuadtree(layout: LayoutResult): Quadtree<LayoutNode> {
  return quadtree<LayoutNode>()
    .x(d => d.x)
    .y(d => d.y)
    .addAll(layout.nodes);
}
```

### Hit Detection with Tier-Aware Search Radius
```typescript
// Source: d3-quadtree find() with radius (https://d3js.org/d3-quadtree)
// Adapted for hive tier sizes from hive-constants.ts

const HIT_RADIUS_BY_TIER: Record<number, number> = {
  0: 40,   // Center rect is large
  1: 16,   // Tier-1 nodes: radius 8 * ~2 for comfortable hit target
  2: 10,   // Tier-2 nodes: radius 4 * ~2.5 for comfortable hit target
};

export function findHoveredNode(
  tree: Quadtree<LayoutNode>,
  worldX: number,
  worldY: number,
  zoomLevel: number,
): LayoutNode | undefined {
  // Adjust search radius inversely with zoom — at high zoom, targets are visually larger
  const baseRadius = 20;
  const searchRadius = baseRadius / Math.max(zoomLevel * 0.5, 0.3);
  const found = tree.find(worldX, worldY, searchRadius);
  return found ?? undefined;
}
```

### Renderer Augmentation: Dim/Highlight Mode
```typescript
// Source: Existing hive-renderer.ts pattern, augmented with interaction state

interface RenderOptions {
  visibility?: Record<number, TierVisibility>;
  interaction?: {
    hoveredNodeId: string | null;
    selectedNodeId: string | null;
    connectedNodeIds: Set<string>;
  };
}

// In drawNodes, apply per-node opacity based on interaction:
function getNodeInteractionOpacity(
  nodeId: string,
  interaction: RenderOptions['interaction'],
): number {
  if (!interaction) return 1;
  const { hoveredNodeId, selectedNodeId, connectedNodeIds } = interaction;
  const activeId = selectedNodeId ?? hoveredNodeId;
  if (!activeId) return 1; // No hover/selection — full opacity

  if (nodeId === activeId) return 1;                    // Hovered/selected: full
  if (connectedNodeIds.has(nodeId)) return 1;           // Connected: full
  return 0.15;                                           // Unrelated: dimmed
}
```

### Overlay Auto-Positioning
```typescript
// Source: Standard tooltip positioning pattern

interface OverlayPosition {
  left: number;
  top: number;
  placement: 'right' | 'left' | 'bottom' | 'top';
}

function computeOverlayPosition(
  nodeScreenX: number,
  nodeScreenY: number,
  overlayWidth: number,
  overlayHeight: number,
  containerWidth: number,
  containerHeight: number,
  offset: number = 16,
): OverlayPosition {
  // Prefer right placement
  if (nodeScreenX + offset + overlayWidth < containerWidth) {
    return {
      left: nodeScreenX + offset,
      top: Math.max(8, Math.min(nodeScreenY - overlayHeight / 2, containerHeight - overlayHeight - 8)),
      placement: 'right',
    };
  }
  // Fall back to left
  if (nodeScreenX - offset - overlayWidth > 0) {
    return {
      left: nodeScreenX - offset - overlayWidth,
      top: Math.max(8, Math.min(nodeScreenY - overlayHeight / 2, containerHeight - overlayHeight - 8)),
      placement: 'left',
    };
  }
  // Fall back to bottom
  return {
    left: Math.max(8, Math.min(nodeScreenX - overlayWidth / 2, containerWidth - overlayWidth - 8)),
    top: nodeScreenY + offset,
    placement: 'bottom',
  };
}
```

### Pinch-to-Zoom via Pointer Events
```typescript
// Source: MDN Pointer Events / Pinch zoom gestures
// (https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures)

// Track active pointers for pinch detection
const pointerCache = useRef<Map<number, PointerEvent>>(new Map());
const prevPinchDist = useRef<number>(-1);

function handlePointerDown(e: PointerEvent) {
  pointerCache.current.set(e.pointerId, e);
}

function handlePointerMove(e: PointerEvent) {
  pointerCache.current.set(e.pointerId, e);

  if (pointerCache.current.size === 2) {
    const [p1, p2] = [...pointerCache.current.values()];
    const curDist = Math.hypot(
      p1.clientX - p2.clientX,
      p1.clientY - p2.clientY,
    );

    if (prevPinchDist.current > 0) {
      const zoomDelta = (curDist - prevPinchDist.current) * ZOOM_SENSITIVITY * 2;
      // Apply to existing camera zoom logic
      const cam = cameraRef.current;
      cam.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * (1 + zoomDelta)));
      render();
    }
    prevPinchDist.current = curDist;
  }
}

function handlePointerUp(e: PointerEvent) {
  pointerCache.current.delete(e.pointerId);
  if (pointerCache.current.size < 2) {
    prevPinchDist.current = -1;
  }
}
```

### Hover Debounce (Preventing Flicker)
```typescript
// Simple timeout-based debounce for hover state changes

const hoverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function setHoveredNode(nodeId: string | null) {
  if (hoverDebounceRef.current) {
    clearTimeout(hoverDebounceRef.current);
  }

  const current = interactionRef.current.hoveredNodeId;

  // Instant clear (node → null) feels snappier
  if (nodeId === null && current !== null) {
    interactionRef.current.hoveredNodeId = null;
    interactionRef.current.connectedNodeIds = new Set();
    render();
    return;
  }

  // Debounce node changes (node → different node) to prevent flicker
  if (nodeId !== current) {
    hoverDebounceRef.current = setTimeout(() => {
      interactionRef.current.hoveredNodeId = nodeId;
      interactionRef.current.connectedNodeIds = nodeId
        ? adjacencyMap.get(nodeId) ?? new Set()
        : new Set();
      render();
    }, 16); // ~1 frame at 60fps — smooths rapid node changes
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `d3-quadtree` v2 (UMD) | `d3-quadtree` v3 (ESM) | 2021 (v3.0.0) | Tree-shakeable, proper ESM exports. No API changes. |
| SVG `<circle>` events for hit detection | Canvas + quadtree picking | Long-standing | Canvas required for 300+ nodes. Quadtree picking is the established Canvas pattern. |
| Touch events for mobile zoom | Pointer events | Widespread 2020+ | Pointer events unify mouse/touch/pen. All modern browsers support them. |
| `getTransform().inverse()` for coordinate conversion | Manual inverse math | N/A | Canvas getTransform() returns a DOMMatrix, but for simple pan/zoom the manual inverse is clearer and avoids matrix object allocation per frame. |

**Deprecated/outdated:**
- `d3.quadtree()` in d3 v3 (old API, generator-based) -- replaced by d3-quadtree v3 modular package
- Touch events (`touchstart/touchmove/touchend`) for gesture handling -- replaced by Pointer Events API

## Open Questions

1. **Overlay update frequency during zoom/pan**
   - What we know: The overlay must stay visually attached to its node during camera changes
   - What's unclear: Whether to recalculate on every rAF frame (smooth but computation) or dismiss the overlay when zoom/pan starts (simpler)
   - Recommendation: CONTEXT.md says "click locks the hover state" implying the overlay should persist. Recalculate position on each render. If this causes jank, optimize later by dismissing on fast zoom gestures only.

2. **Exact dim opacity for unrelated nodes**
   - What we know: CONTEXT.md marks this as Claude's discretion
   - What's unclear: Best visual balance depends on actual visual density
   - Recommendation: Start with 0.15 opacity for unrelated nodes (matches AntStack reference implementation). Fine-tune visually. Connected nodes at 1.0, unrelated at 0.15, lines follow same ratio.

3. **Glow effect implementation for clicked node**
   - What we know: CONTEXT.md specifies "glow/scale effects" on click
   - What's unclear: Whether glow should be canvas-drawn (shadow blur) or a CSS effect on the overlay
   - Recommendation: Use canvas `shadowBlur` + `shadowColor` for the selected node's glow (keeps it in canvas rendering pipeline). Scale effect via larger draw radius. Both are cheap to render.

## Sources

### Primary (HIGH confidence)
- d3-quadtree official docs (https://d3js.org/d3-quadtree) -- full API reference, find() with radius, x/y accessors
- d3-quadtree GitHub (https://github.com/d3/d3-quadtree) -- v3.0.1 confirmed, ESM package
- MDN Pointer Events / Pinch zoom gestures (https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures) -- pinch-to-zoom pattern with Pointer Events API
- Existing HiveCanvas.tsx codebase -- camera transform chain, ref-based state pattern, zoom/pan implementation

### Secondary (MEDIUM confidence)
- AntStack blog: D3 network graphs with canvas interaction (https://www.antstack.com/blog/leveling-up-your-d3-network-graphs-from-simple-canvas-to-interactive-powerhouse/) -- quadtree canvas interaction pattern, hover highlighting with opacity dimming, hoveredNodeRef pattern
- GeeksforGeeks: click vs drag discrimination (https://www.geeksforgeeks.org/javascript/how-to-differentiate-mouse-click-and-drag-event-using-javascript/) -- distance threshold approach
- Rob Louie: Canvas coordinate transforms (https://roblouie.com/article/617/transforming-mouse-coordinates-to-canvas-coordinates/) -- screen-to-world via getTransform().invertSelf()
- D3 In Depth: Picking interaction (https://www.d3indepth.com/interaction/) -- quadtree find() for mouse picking

### Tertiary (LOW confidence)
- None -- all critical claims verified against official docs or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- d3-quadtree is the canonical D3 solution, verified via official docs and Context7
- Architecture: HIGH -- patterns derived directly from existing HiveCanvas codebase + verified D3 patterns
- Pitfalls: HIGH -- coordinate space mismatch and click-vs-drag are well-documented problems with known solutions; flicker debounce verified via AntStack reference

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (stable domain, d3-quadtree hasn't changed in 3 years)
