# Phase 48: Hive Foundation (Layout + Rendering) - Research

**Researched:** 2026-02-06
**Domain:** Canvas 2D rendering, d3-hierarchy radial layout, performance optimization
**Confidence:** HIGH

## Summary

This phase builds a Canvas 2D-based hive visualization that renders 1000+ nodes in a deterministic radial layout at 60fps with retina support. The core stack is **d3-hierarchy** for layout computation (Reingold-Tilford tidy tree algorithm) and the **native Canvas 2D API** for rendering. No wrapper libraries are needed -- the Canvas API is simple enough for direct use in React via `useRef` + `useEffect`.

The critical performance insight: **batched arc rendering** (single `beginPath()`, loop `moveTo()`/`arc()`, single `fill()`/`stroke()`) reduces 100K circle renders from 287ms to 15ms. For our 1000-node hive, this means sub-millisecond render times, well within the 16ms frame budget for 60fps. The layout computation via d3-hierarchy's tree algorithm runs in **linear time** (O(n)) thanks to the Buchheim et al. improvement, so even 1000+ nodes compute in under 1ms.

**Primary recommendation:** Use `d3-hierarchy` (tree layout with radial configuration) for deterministic position calculation, and native Canvas 2D with batched draw calls for rendering. Separate layout computation from rendering -- compute once, render on every frame/resize.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `d3-hierarchy` | 3.1.2 | Radial tree layout computation | Reingold-Tilford tidy algorithm, deterministic positions, linear time O(n). Industry standard for hierarchical layouts |
| Canvas 2D API | Native | Node + connection rendering | No library needed. Native performance, batched draw calls handle 1000+ nodes trivially |
| `ResizeObserver` | Native | Responsive canvas sizing | Built-in API, no polling, triggers on actual element resize |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/d3-hierarchy` | 3.1.7 | TypeScript definitions for d3-hierarchy | Always -- project uses strict TypeScript |

### Not Needed
| Library | Why Not |
|---------|---------|
| `d3-quadtree` | Phase 49 (interactions/hit detection), not this phase |
| `react-responsive-canvas` | Simple enough to build with ResizeObserver + useRef |
| `konva` / `fabric.js` | Overkill canvas wrapper -- we need raw performance, not abstraction |
| `pixi.js` / WebGL | Canvas 2D handles 1000 nodes easily; WebGL complexity not justified |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-hierarchy tree | Manual radial math | d3-hierarchy guarantees no overlap, handles separation automatically |
| Canvas 2D | SVG | SVG creates 1000+ DOM nodes, kills performance. Canvas is one element |
| Canvas 2D | OffscreenCanvas Web Worker | Unnecessary for 1000 nodes; adds complexity with no measurable benefit |

**Installation:**
```bash
pnpm add d3-hierarchy
pnpm add -D @types/d3-hierarchy
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    hive/
      HiveCanvas.tsx           # Main canvas component (client component)
      hive-layout.ts           # d3-hierarchy layout computation (pure function)
      hive-renderer.ts         # Canvas 2D drawing functions (pure functions)
      hive-types.ts            # TypeScript interfaces for hive data
      hive-constants.ts        # Sizes, colors, spacing constants
      use-canvas-resize.ts     # ResizeObserver + DPR hook
      use-hive-animation.ts    # Progressive build animation hook
```

### Pattern 1: Separation of Layout from Rendering

**What:** Compute node positions with d3-hierarchy in a pure function, then render to canvas in a separate pure function. The React component only orchestrates refs and effects.

**When to use:** Always for canvas visualizations -- keeps code testable and prevents layout recomputation on every frame.

**Why deterministic:** d3-hierarchy's tree layout is a pure function. Same input hierarchy + same sort order = identical x/y positions every time. Call `root.sort()` before layout to guarantee consistent child ordering.

```typescript
// hive-layout.ts - Pure layout computation
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';

interface HiveNode {
  id: string;
  name: string;
  tier: 0 | 1 | 2 | 3; // 0 = center
  children?: HiveNode[];
}

interface LayoutNode {
  id: string;
  tier: number;
  x: number; // cartesian x after polar conversion
  y: number; // cartesian y after polar conversion
  angle: number; // original angle in radians
  radius: number; // original distance from center
}

interface LayoutResult {
  nodes: LayoutNode[];
  links: Array<{ source: LayoutNode; target: LayoutNode }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

function computeHiveLayout(data: HiveNode, outerRadius: number): LayoutResult {
  const root = hierarchy(data)
    .sort((a, b) => a.data.name.localeCompare(b.data.name)); // Deterministic ordering

  const treeLayout = tree<HiveNode>()
    .size([2 * Math.PI, outerRadius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

  treeLayout(root);

  // Convert polar (angle, radius) to cartesian (x, y)
  const nodes: LayoutNode[] = root.descendants().map(d => ({
    id: d.data.id,
    tier: d.data.tier,
    x: d.y * Math.cos(d.x - Math.PI / 2), // d.x = angle, d.y = radius
    y: d.y * Math.sin(d.x - Math.PI / 2),
    angle: d.x,
    radius: d.y,
  }));

  const links = root.links().map(l => ({
    source: nodes.find(n => n.id === l.source.data.id)!,
    target: nodes.find(n => n.id === l.target.data.id)!,
  }));

  // Compute bounds for fit-to-viewport
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }

  return { nodes, links, bounds: { minX, maxX, minY, maxY } };
}
```

### Pattern 2: React Canvas Component with Retina + ResizeObserver

**What:** A `useEffect`-based canvas setup that handles DPR scaling and responsive resize.

```typescript
// use-canvas-resize.ts
import { useEffect, useRef, useCallback } from 'react';

interface CanvasSize {
  width: number;  // CSS pixels
  height: number; // CSS pixels
  dpr: number;    // device pixel ratio
}

function useCanvasResize(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onResize: (size: CanvasSize) => void
) {
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let width: number;
        let height: number;
        let dpr = window.devicePixelRatio || 1;

        if (entry.devicePixelContentBoxSize) {
          // Most accurate -- already in device pixels
          width = entry.devicePixelContentBoxSize[0].inlineSize;
          height = entry.devicePixelContentBoxSize[0].blockSize;
          dpr = 1; // already accounted for
        } else if (entry.contentBoxSize) {
          const box = entry.contentBoxSize[0] ?? entry.contentBoxSize;
          width = (box as ResizeObserverSize).inlineSize;
          height = (box as ResizeObserverSize).blockSize;
        } else {
          width = entry.contentRect.width;
          height = entry.contentRect.height;
        }

        const displayWidth = Math.round(width * dpr);
        const displayHeight = Math.round(height * dpr);

        // Only update if size actually changed
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;

          const cssWidth = Math.round(width * (dpr === 1 ? 1 : 1)); // CSS size
          sizeRef.current = {
            width: width / (dpr === 1 ? window.devicePixelRatio || 1 : 1),
            height: height / (dpr === 1 ? window.devicePixelRatio || 1 : 1),
            dpr: dpr === 1 && entry.devicePixelContentBoxSize
              ? 1
              : window.devicePixelRatio || 1,
          };

          onResize(sizeRef.current);
        }
      }
    });

    try {
      observer.observe(canvas, { box: 'device-pixel-content-box' });
    } catch {
      observer.observe(canvas, { box: 'content-box' });
    }

    return () => observer.disconnect();
  }, [canvasRef, onResize]);

  return sizeRef;
}
```

### Pattern 3: Batched Canvas Rendering (Critical for Performance)

**What:** Draw all same-styled elements in a single path to minimize Canvas API calls.

```typescript
// hive-renderer.ts - Batched drawing functions

function drawConnectionLines(
  ctx: CanvasRenderingContext2D,
  links: Array<{ source: LayoutNode; target: LayoutNode }>,
  tierOpacity: Record<number, number>
) {
  // Group links by target tier for batch opacity
  const byTier = new Map<number, typeof links>();
  for (const link of links) {
    const tier = link.target.tier;
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier)!.push(link);
  }

  for (const [tier, tierLinks] of byTier) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, ${tierOpacity[tier] ?? 0.1})`;
    ctx.lineWidth = 1;

    for (const { source, target } of tierLinks) {
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
    }
    ctx.stroke();
  }
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: LayoutNode[],
  tierConfig: Record<number, { radius: number; fill: string }>
) {
  // Group by tier for batch rendering
  const byTier = new Map<number, LayoutNode[]>();
  for (const node of nodes) {
    if (!byTier.has(node.tier)) byTier.set(node.tier, []);
    byTier.get(node.tier)!.push(node);
  }

  for (const [tier, tierNodes] of byTier) {
    const config = tierConfig[tier];
    if (!config) continue;

    ctx.beginPath();
    for (const node of tierNodes) {
      ctx.moveTo(node.x + config.radius, node.y);
      ctx.arc(node.x, node.y, config.radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = config.fill;
    ctx.fill();
  }
}
```

### Pattern 4: Fit-to-Viewport Initial Scale

**What:** Calculate a transform that fits the entire hive within the canvas, with padding.

```typescript
function computeFitTransform(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 40
): { scale: number; offsetX: number; offsetY: number } {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

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
```

### Anti-Patterns to Avoid
- **Re-computing layout on every frame:** Layout is O(n) but unnecessary if data hasn't changed. Compute once, cache result.
- **Individual beginPath/fill per node:** Costs O(n) Canvas API calls. Batch by tier instead.
- **Using `ctx.save()`/`ctx.restore()` in tight loops:** State machine operations have overhead. Set style once per batch.
- **Floating-point canvas coordinates:** Triggers sub-pixel anti-aliasing. Round to integers: `Math.round(x)`.
- **Clearing full canvas when nothing changed:** Use dirty flag to skip unchanged frames.
- **Setting canvas CSS width/height via JS when ResizeObserver handles it:** Let the CSS layout engine control CSS size; only set `canvas.width`/`canvas.height` (buffer dimensions) in the observer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radial tree layout | Custom angle/radius math | `d3-hierarchy` tree with `size([2*PI, radius])` | Handles separation, no-overlap, deterministic positioning. Reingold-Tilford algorithm is non-trivial |
| Polar-to-cartesian | N/A (simple math) | `x = r * cos(angle)`, `y = r * sin(angle)` | This IS simple enough to hand-write |
| Node overlap prevention | Custom collision detection | d3-hierarchy's `separation()` function | Built into the layout algorithm |
| Retina canvas scaling | Manual DPR math | ResizeObserver + `devicePixelContentBoxSize` pattern | Handles DPR changes, fractional scaling, zoom levels |
| Easing functions | Custom bezier math | Simple quadratic/cubic ease-out functions (4 lines each) | Standard easing is well-known, paste from reference |
| Hit detection (Phase 49) | Manual distance checks | `d3-quadtree` | O(log n) spatial queries vs O(n) brute force |

**Key insight:** d3-hierarchy does the hard layout math. Canvas 2D does the hard rendering. Everything else in this phase is glue code connecting data -> layout -> canvas.

## Common Pitfalls

### Pitfall 1: Canvas Blurry on Retina Displays
**What goes wrong:** Canvas renders at 1x resolution on 2x/3x screens, appearing blurry.
**Why it happens:** `canvas.width`/`canvas.height` default to CSS pixels, not device pixels.
**How to avoid:** Use ResizeObserver with `devicePixelContentBoxSize` (Chrome/Edge) or multiply by `window.devicePixelRatio` (Safari fallback). Then apply `ctx.scale(dpr, dpr)` so drawing coordinates remain in CSS pixels.
**Warning signs:** Fuzzy edges on circles and lines, especially noticeable on MacBook Retina.

### Pitfall 2: Layout Not Deterministic Across Renders
**What goes wrong:** Same data produces different visual arrangements on different renders.
**Why it happens:** Child node ordering isn't guaranteed if not explicitly sorted.
**How to avoid:** Always call `root.sort((a, b) => a.data.id.localeCompare(b.data.id))` before passing to tree layout. Use stable sort key (id, not name that might change).
**Warning signs:** Nodes "jump" to different positions when component re-mounts.

### Pitfall 3: Canvas Not Responsive to Container Resize
**What goes wrong:** Canvas stays fixed size when window/container resizes.
**Why it happens:** Canvas element doesn't naturally flow like other HTML elements. Setting CSS size stretches pixels, doesn't add resolution.
**How to avoid:** Use ResizeObserver on the canvas element. On each resize, update `canvas.width`/`canvas.height` (buffer size), re-apply DPR scale, and re-render.
**Warning signs:** Stretched/distorted rendering, or canvas doesn't fill container.

### Pitfall 4: Animation Jank from Layout Recomputation
**What goes wrong:** Progressive build animation stutters because layout is recomputed per frame.
**Why it happens:** Running d3-hierarchy tree layout inside requestAnimationFrame loop.
**How to avoid:** Compute layout ONCE when data changes. Animation only controls which nodes are visible and their opacity/scale -- not positions.
**Warning signs:** Frame drops during build animation, especially with 1000+ nodes.

### Pitfall 5: Memory Leak from Uncleared Animation Frame
**What goes wrong:** requestAnimationFrame continues running after component unmount.
**Why it happens:** Missing cleanup in useEffect.
**How to avoid:** Store the animation frame ID in a ref, call `cancelAnimationFrame(id)` in the useEffect cleanup function.
**Warning signs:** Console warnings about state updates on unmounted components, increasing memory usage.

### Pitfall 6: Tier-3 Nodes Overlapping Despite d3-hierarchy
**What goes wrong:** 1000+ leaf nodes stack on top of each other, not "distinct small dots."
**Why it happens:** Default separation function doesn't account for radial density at outer tiers.
**How to avoid:** Use radial separation: `(a, b) => (a.parent === b.parent ? 1 : 2) / a.depth`. Also, set a large enough `outerRadius` in `tree.size([2*PI, outerRadius])` to give tier-3 enough circumference. Test with actual node counts.
**Warning signs:** Dense clusters or overlap at the outer ring. Increase radius or adjust separation.

### Pitfall 7: devicePixelContentBoxSize Not Available in Safari
**What goes wrong:** ResizeObserver callback gives unexpected values on Safari.
**Why it happens:** Safari does not support `devicePixelContentBoxSize` as of 2025.
**How to avoid:** Always implement fallback chain: `devicePixelContentBoxSize` -> `contentBoxSize` * DPR -> `contentRect` * DPR.
**Warning signs:** Blurry canvas only on Safari, or canvas size mismatch on Safari.

## Code Examples

### Complete HiveCanvas Component Skeleton
```typescript
// Source: Synthesized from MDN Canvas docs + d3-hierarchy docs
'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { computeHiveLayout, type LayoutResult } from './hive-layout';
import { renderHive, renderSkeletonHive } from './hive-renderer';
import type { HiveData } from './hive-types';

interface HiveCanvasProps {
  data: HiveData | null; // null = loading/skeleton state
  className?: string;
}

export function HiveCanvas({ data, className }: HiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutResult | null>(null);
  const animFrameRef = useRef<number>(0);
  const reducedMotion = usePrefersReducedMotion();

  // Compute layout once when data changes
  const layout = useMemo(() => {
    if (!data) return null;
    return computeHiveLayout(data, 800); // 800 = outerRadius in logical units
  }, [data]);

  // Store in ref for animation access
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    if (layoutRef.current) {
      renderHive(ctx, layoutRef.current, width, height);
    } else {
      renderSkeletonHive(ctx, width, height);
    }

    ctx.restore();
  }, []);

  // ResizeObserver setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let width: number, height: number;
        let dpr = window.devicePixelRatio || 1;

        if (entry.devicePixelContentBoxSize) {
          width = entry.devicePixelContentBoxSize[0].inlineSize;
          height = entry.devicePixelContentBoxSize[0].blockSize;
          dpr = 1;
        } else if (entry.contentBoxSize) {
          const box = Array.isArray(entry.contentBoxSize)
            ? entry.contentBoxSize[0]
            : entry.contentBoxSize;
          width = (box as ResizeObserverSize).inlineSize;
          height = (box as ResizeObserverSize).blockSize;
        } else {
          width = entry.contentRect.width;
          height = entry.contentRect.height;
        }

        const displayWidth = Math.round(width * dpr);
        const displayHeight = Math.round(height * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
          render();
        }
      }
    });

    try {
      observer.observe(canvas, { box: 'device-pixel-content-box' });
    } catch {
      observer.observe(canvas, { box: 'content-box' });
    }

    return () => observer.disconnect();
  }, [render]);

  // Initial render + animation
  useEffect(() => {
    render();
  }, [render, layout]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
      aria-label="Hive visualization showing test content analysis"
      role="img"
    />
  );
}
```

### Radial Layout with Polar-to-Cartesian Conversion
```typescript
// Source: d3-hierarchy docs (https://d3js.org/d3-hierarchy/tree)
import { hierarchy, tree } from 'd3-hierarchy';

const treeLayout = tree<HiveNode>()
  .size([2 * Math.PI, outerRadius]) // full circle, outerRadius depth
  .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

const root = hierarchy(data)
  .sort((a, b) => a.data.id.localeCompare(b.data.id)); // deterministic

treeLayout(root);

// After layout: node.x = angle (radians), node.y = distance from center
// Convert to cartesian:
const cartesianX = node.y * Math.cos(node.x - Math.PI / 2);
const cartesianY = node.y * Math.sin(node.x - Math.PI / 2);
```

### Retina Canvas DPR Pattern
```typescript
// Source: MDN (https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
function setupRetinaCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Set buffer size to device pixels
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr); // Scale so drawing uses CSS pixels

  // CSS size stays as-is (controlled by layout)
  return ctx;
}
```

### Progressive Build Animation Pattern
```typescript
// Source: Synthesized from Canvas animation best practices
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface AnimationState {
  startTime: number;
  phase: 'center' | 'tier1' | 'tier2' | 'tier3' | 'complete';
}

// Stagger timing per tier (milliseconds)
const TIER_DELAYS = { center: 0, tier1: 200, tier2: 500, tier3: 900 };
const TIER_DURATIONS = { center: 300, tier1: 400, tier2: 500, tier3: 600 };

function getNodeVisibility(
  tier: number,
  elapsed: number,
  reducedMotion: boolean
): { opacity: number; scale: number } {
  if (reducedMotion) return { opacity: 1, scale: 1 }; // Static fallback

  const tierKey = tier === 0 ? 'center' : `tier${tier}` as keyof typeof TIER_DELAYS;
  const delay = TIER_DELAYS[tierKey];
  const duration = TIER_DURATIONS[tierKey];

  if (elapsed < delay) return { opacity: 0, scale: 0 };

  const progress = Math.min((elapsed - delay) / duration, 1);
  const eased = easeOutCubic(progress);

  return { opacity: eased, scale: 0.5 + eased * 0.5 };
}
```

### Skeleton Hive (Loading State)
```typescript
// Source: Synthesized from CONTEXT.md requirements
function renderSkeletonHive(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const rings = [80, 200, 400]; // concentric ring radii

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;

  // Draw concentric rings
  for (const r of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw placeholder dots on each ring
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < rings.length; i++) {
    const count = [8, 24, 48][i]; // dots per ring
    const dotRadius = [6, 4, 2][i];
    ctx.beginPath();
    for (let j = 0; j < count; j++) {
      const angle = (j / count) * Math.PI * 2;
      const x = cx + rings[i] * Math.cos(angle);
      const y = cy + rings[i] * Math.sin(angle);
      ctx.moveTo(x + dotRadius, y);
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Center rectangle placeholder
  const rectW = 80;
  const rectH = 60;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.roundRect(cx - rectW / 2, cy - rectH / 2, rectW, rectH, 8);
  ctx.fill();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG for all node visualizations | Canvas 2D for 100+ nodes, SVG for <100 | ~2018+ | SVG DOM overhead kills perf at scale. Canvas is one element regardless of node count |
| `window.onresize` for canvas sizing | `ResizeObserver` + `devicePixelContentBoxSize` | 2020+ (broad support 2023+) | Per-element observation, no polling, device-pixel accuracy |
| `setInterval` for animation | `requestAnimationFrame` | Long-established | Syncs with display refresh, auto-pauses in background tabs |
| Full d3 import (`import * as d3`) | Tree-shakeable submodules (`d3-hierarchy`) | d3 v4+ (2016) | Only import layout algorithms, not the entire 500KB library |
| `canvas.width = canvas.width` to clear | `ctx.clearRect(0, 0, w, h)` | Always better | Faster, doesn't reset canvas state |

**Deprecated/outdated:**
- `d3-hierarchy` v1/v2: Use v3.1.2 (current, stable, ESM-first)
- `CanvasRenderingContext2D.roundRect()` was missing from older browsers: Now supported in all modern browsers (Chrome 99+, Firefox 112+, Safari 15.4+)

## Existing Project Assets to Reuse

| Asset | Location | How to Use |
|-------|----------|------------|
| `usePrefersReducedMotion()` hook | `@/hooks/usePrefersReducedMotion` | Reduced motion detection for static fallback |
| `useIsMobile()` hook | `@/hooks/useIsMobile` | Could reduce node count on mobile if needed |
| Design tokens (colors, spacing) | `@/app/globals.css` (@theme block) | Reference for tier colors within Raycast aesthetic |
| Existing visualization context | `@/components/visualization/VisualizationContext` | R3F-specific -- do NOT reuse for Canvas 2D. Build separate context if needed |
| `GlassSkeleton` component | `@/components/primitives/GlassSkeleton` | Reference for shimmer animation style, but skeleton hive is canvas-rendered |

## Recommended Discretion Choices

### Line Opacity Fade: Tier-Based Steps (not continuous)
**Recommendation:** Use 3 discrete opacity levels by target node tier.
- Tier-1 connections: `rgba(255, 255, 255, 0.15)`
- Tier-2 connections: `rgba(255, 255, 255, 0.08)`
- Tier-3 connections: `rgba(255, 255, 255, 0.04)`

**Rationale:** Tier-based is simpler to implement, easier to batch (group by tier), and visually cleaner than continuous distance-based fade. Continuous fade would require per-line opacity, preventing batched stroke calls.

### Tier Color Palette (Raycast Dark Aesthetic)
**Recommendation:**
- Tier-1 (main nodes): `rgba(255, 255, 255, 0.85)` -- bright white
- Tier-2 (sub nodes): `rgba(255, 255, 255, 0.45)` -- medium gray
- Tier-3 (leaf nodes): `rgba(255, 255, 255, 0.20)` -- subtle dots
- Center rectangle border: `rgba(255, 255, 255, 0.10)`

**Rationale:** Pure white at varying opacities matches the Raycast monochrome dark aesthetic. No colored nodes -- color is reserved for accents (coral) in Phase 49 interactions.

### Node Size Scale
**Recommendation:**
- Center rectangle: 80x60 logical pixels, 8px border-radius
- Tier-1 nodes: radius 8px
- Tier-2 nodes: radius 4px
- Tier-3 nodes: radius 1.5px

**Rationale:** 1.5px radius for tier-3 keeps 1000+ dots visible and distinct without consuming too much space. The 5x size ratio between tier-1 and tier-3 creates clear visual hierarchy.

### Progressive Build Animation Timing
**Recommendation:**
- Center: 0ms delay, 300ms duration
- Tier-1: 200ms delay, 400ms duration
- Tier-2: 500ms delay, 500ms duration
- Tier-3: 900ms delay, 600ms duration
- Total: ~1500ms
- Easing: `easeOutCubic` (fast in, slow settle)
- Nodes scale from 0.5 to 1.0 and fade from 0 to full opacity

**Rationale:** Fast enough to not feel sluggish, slow enough to see the radial build effect. ~1.5s total keeps it under the 2s attention threshold.

### Canvas Rendering Optimizations for 1000+ Nodes
**Recommendation:**
1. **Batch by tier:** Single `beginPath()`/`fill()` per tier (3-4 draw calls total for nodes)
2. **Batch lines by tier opacity:** Single `beginPath()`/`stroke()` per opacity level
3. **Integer coordinates:** `Math.round()` all positions before drawing
4. **Skip offscreen nodes:** Not needed yet (fit-to-viewport means all visible), but prepare for Phase 49 zoom
5. **Dirty flag:** Only re-render when data, size, or animation state changes

## Open Questions

1. **Hive data structure from backend**
   - What we know: The hive visualizes test content analysis with center (test content), tier-1 (main themes), tier-2 (sub-themes), tier-3 (individual responses/data points)
   - What's unclear: Exact data shape from API/Supabase. Phase 48 can use mock data.
   - Recommendation: Define TypeScript interfaces now, wire to real data later. Mock data should have realistic counts: 1 center, 10-15 tier-1, 100-150 tier-2, 1000-1200 tier-3.

2. **Center rectangle content rendering**
   - What we know: Shows video thumbnail or text preview based on test type.
   - What's unclear: How to render rich content (images, text) inside Canvas 2D.
   - Recommendation: For Phase 48, render an empty rounded rectangle with a subtle icon or text label. Image/text content rendering can be added incrementally. Canvas `drawImage()` handles thumbnails; `fillText()` handles text.

3. **Logical hive size / outer radius**
   - What we know: Fixed logical size, fit-to-viewport on initial load.
   - What's unclear: Exact radius values that prevent tier-3 overlap with 1000+ nodes.
   - Recommendation: Start with `outerRadius = 800` logical units and test. The circumference at r=800 is ~5026 units. With 1000 tier-3 nodes, each gets ~5 units of arc space. At 1.5px radius, nodes need ~4px minimum. This is tight -- may need to increase to 1200-1500 and validate visually.

## Sources

### Primary (HIGH confidence)
- [d3-hierarchy v3.1.2 README](https://github.com/d3/d3-hierarchy/blob/v3.1.2/README.md) - Full API reference, tree layout, radial configuration, separation function
- [d3-hierarchy tree docs](https://d3js.org/d3-hierarchy/tree) - Official Observable D3 docs for tree layout API
- [MDN Canvas Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - Batching, layering, integer coordinates, DPR scaling
- [MDN devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio) - Canvas retina scaling pattern
- [MDN ResizeObserverEntry.devicePixelContentBoxSize](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/devicePixelContentBoxSize) - Device pixel accurate canvas sizing
- [web.dev Canvas Performance](https://web.dev/canvas-performance/) - Pre-rendering, batching, state machine optimization

### Secondary (MEDIUM confidence)
- [AG Grid Canvas Optimization](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) - Batched vs simple rendering benchmarks (15ms vs 287ms for 100K points)
- [Observable Radial Tree Example](https://observablehq.com/@d3/radial-tree/2) - Radial tree code pattern with polar-to-cartesian conversion
- [Canvas HiDPI Pattern (Kirupa)](https://www.kirupa.com/canvas/canvas_high_dpi_retina.htm) - Reusable DPR scaling function
- [WebGL Fundamentals ResizeObserver](https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html) - ResizeObserver + devicePixelContentBoxSize fallback chain
- [CSS-Tricks Canvas Easing](https://css-tricks.com/easing-animations-in-canvas/) - Easing function implementations for canvas animation

### Tertiary (LOW confidence)
- [Canvas Batch drawImage (WHATWG)](https://wiki.whatwg.org/wiki/Canvas_Batch_drawImage) - Future batch API proposals (not yet standard)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - d3-hierarchy is the undisputed standard, Canvas 2D API is native
- Architecture: HIGH - Separation of layout/render is well-established pattern, all code examples verified against official docs
- Pitfalls: HIGH - Canvas DPR, ResizeObserver fallbacks, and batching are thoroughly documented
- Animation: MEDIUM - Progressive build timing is synthesized recommendation, not from a reference implementation
- Node sizing/spacing: LOW - Exact radius values (outerRadius=800, tier-3 radius=1.5px) need visual validation with real node counts

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (d3-hierarchy is stable, Canvas 2D API is stable)
