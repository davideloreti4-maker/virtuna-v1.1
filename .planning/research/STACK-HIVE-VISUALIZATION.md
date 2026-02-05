# Stack Research: Hive Node Visualization

**Project:** Virtuna Dashboard Rebuild
**Researched:** 2026-02-05
**Dimension:** Stack additions for 1000+ node hive/radial hierarchical visualization with interactive nodes

---

## Executive Summary

The hive visualization requires **two new packages**: `d3-hierarchy` for radial tree layout computation and `d3-quadtree` for efficient Canvas 2D hit-testing. The existing 2D Canvas approach in `network-visualization.tsx` (200 dots, radial distribution, connecting lines) is the correct rendering foundation -- scale it up rather than switching to R3F/WebGL.

**Core recommendation: Canvas 2D + d3-hierarchy layout, NOT React Three Fiber.**

R3F is already in the project for the GlassOrb (custom shaders, 3D morphing), but using it for a 2D hierarchical node layout would be overengineering. Canvas 2D handles 1000 nodes with connecting lines at 60fps comfortably, provides simpler hit-testing via quadtree, and the existing `network-visualization.tsx` already demonstrates the exact pattern needed. The hive visualization is fundamentally a 2D radial tree -- using WebGL adds complexity (instanced mesh raycasting bugs, orthographic camera setup, shader overhead) without meaningful performance benefit at this scale.

---

## Rendering Approach Decision

### Canvas 2D (RECOMMENDED)

| Criterion | Assessment |
|-----------|------------|
| Performance at 1000 nodes | Excellent -- 60fps with basic optimization |
| Performance at 1000 nodes + 2000 lines | Good -- batch path operations, single stroke call |
| Hit-testing | Quadtree lookup: O(log n), sub-millisecond |
| Hover/click on individual nodes | Simple with quadtree spatial index |
| Glow effects | `shadowBlur`, `createRadialGradient()` -- already used in existing code |
| Glassmorphism aesthetic | Radial gradients, alpha compositing, blur filters |
| Integration with design system | Overlay HTML tooltips/panels with existing glass components |
| Complexity | Low -- extend existing `network-visualization.tsx` pattern |
| Retina support | Already handled in existing code (dpr scaling) |

**Why Canvas 2D wins for this use case:**
1. The visualization is fundamentally 2D (radial layout, no depth/rotation)
2. 1000 nodes is well within Canvas 2D's comfort zone (struggles begin at 10K+)
3. Connecting lines between nodes are trivial with `ctx.beginPath()/lineTo()/stroke()`
4. The existing `network-visualization.tsx` already renders 200 animated dots with connections at 60fps
5. Hit-testing with `d3-quadtree` is simpler and more reliable than R3F raycasting on instanced meshes

### React Three Fiber / WebGL (NOT RECOMMENDED for this feature)

| Criterion | Assessment |
|-----------|------------|
| Performance at 1000 nodes | Overkill -- WebGL shines at 10K-100K+ nodes |
| InstancedMesh raycasting | Known bugs in R3F v9: `onClick` returns all instances in line of sight, not just the clicked one ([Issue #3289](https://github.com/pmndrs/react-three-fiber/issues/3289)) |
| 2D layout in 3D engine | Requires orthographic camera, z-fighting management, no rotation |
| Line rendering | THREE.Line is not GPU-instanced; need custom shaders or `THREE.LineSegments` |
| Tooltip integration | Must project 3D coords to screen space, then overlay HTML |
| Complexity | High -- fighting the 3D paradigm for a 2D visualization |
| Existing R3F in project | Keep for GlassOrb only; don't conflate 3D effects with 2D data viz |

**When to reconsider WebGL:** If the visualization evolves to require 3D depth, camera rotation, or 10K+ nodes with per-frame position updates. Not relevant for the current decorative hive layout.

### SVG (NOT RECOMMENDED)

| Criterion | Assessment |
|-----------|------------|
| Performance at 1000 nodes | Poor -- DOM overhead, >5000 elements causes visible lag |
| With 2000+ connecting lines | Very poor -- each line is a DOM element |
| Interactivity | Easy (native click/hover) but at unacceptable performance cost |

**Verdict: SVG is too slow for 1000+ nodes with connecting lines.**

---

## New Packages Required

### 1. d3-hierarchy (Layout Computation)

| Attribute | Value |
|-----------|-------|
| Package | `d3-hierarchy` |
| Version | **3.1.2** (latest stable) |
| Types | `@types/d3-hierarchy` v3.1.7 |
| Bundle size | ~12KB minified (tree-shakeable ESM) |
| Confidence | **HIGH** -- stable, well-documented, no major version in 4 years |

**What it provides:**
- `d3.tree()` layout algorithm -- computes x,y positions for hierarchical data
- `d3.hierarchy()` -- converts raw JSON tree data into traversable hierarchy nodes
- Radial layout via `tree.size([360, radius])` -- treats x as angle, y as depth radius
- Custom `separation()` function for radial spacing: `(a, b) => (a.parent == b.parent ? 1 : 2) / a.depth`
- Deterministic layout -- same input always produces same output (no simulation ticks)

**Why d3-hierarchy over d3-force:**
- Force-directed layout is non-deterministic and requires simulation ticks (expensive at 1000+ nodes)
- The hive visualization has explicit hierarchy: center thumbnail > main nodes > sub-nodes > leaf nodes
- d3-hierarchy produces instant, deterministic positions -- no "settling" animation needed
- Force-directed is for graph data without inherent hierarchy; ours has clear parent-child structure

**Why NOT full `d3` package:**
- Full d3 is ~500KB; we only need the hierarchy module (~12KB)
- d3-hierarchy is a standalone ESM module with zero dependencies
- Import only what's needed: `import { tree, hierarchy } from 'd3-hierarchy'`

**Integration pattern:**

```typescript
import { hierarchy, tree } from 'd3-hierarchy'

interface HiveNode {
  id: string
  label: string
  type: 'center' | 'main' | 'sub' | 'leaf'
  children?: HiveNode[]
}

// Build hierarchy from data
const root = hierarchy(hiveData)

// Configure radial tree layout
const layout = tree<HiveNode>()
  .size([2 * Math.PI, outerRadius]) // Full circle, max radius
  .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth!)

// Compute positions
layout(root)

// Convert polar to Cartesian for Canvas rendering
root.each(node => {
  const angle = node.x  // radians
  const radius = node.y // distance from center
  node.data._cx = centerX + radius * Math.cos(angle - Math.PI / 2)
  node.data._cy = centerY + radius * Math.sin(angle - Math.PI / 2)
})
```

### 2. d3-quadtree (Hit-Testing)

| Attribute | Value |
|-----------|-------|
| Package | `d3-quadtree` |
| Version | **3.0.1** (latest stable) |
| Types | `@types/d3-quadtree` v3.0.6 |
| Bundle size | ~5KB minified |
| Confidence | **HIGH** -- stable spatial indexing, no dependencies |

**What it provides:**
- O(log n) spatial lookup for finding the node under the cursor
- `quadtree.find(x, y, radius)` -- finds nearest point within radius
- Rebuilds in O(n log n) -- fast enough for layout changes
- `visit()` method for range queries (e.g., "all nodes within 50px of cursor")

**Why quadtree over brute-force hit-testing:**
- Brute-force: O(n) per mouse move event = 1000 distance calculations per frame
- Quadtree: O(log n) per mouse move = ~10 comparisons per frame
- At 60fps with mousemove, that's 60K vs 600 calculations/second
- For 1000 nodes this is the difference between smooth and janky hover

**Integration pattern:**

```typescript
import { quadtree } from 'd3-quadtree'

// Build quadtree from computed positions
const qt = quadtree<ComputedNode>()
  .x(d => d.cx)
  .y(d => d.cy)
  .addAll(computedNodes)

// On mousemove, find nearest node
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = (e.clientX - rect.left) * dpr
  const my = (e.clientY - rect.top) * dpr

  const hitRadius = 20 // px tolerance
  const found = qt.find(mx, my, hitRadius)

  if (found) {
    setHoveredNode(found)
    canvas.style.cursor = 'pointer'
  } else {
    setHoveredNode(null)
    canvas.style.cursor = 'default'
  }
})
```

---

## Packages NOT Needed

| Package | Why NOT |
|---------|---------|
| **PixiJS / @pixi/react** | WebGL 2D renderer is overkill for 1000 static nodes; adds 200KB+ bundle weight; Canvas 2D is sufficient |
| **react-force-graph** | Force-directed, not hierarchical; wrong layout paradigm for a hive |
| **reagraph** | Full graph library with its own rendering; too heavy for a decorative visualization |
| **d3-force** | Non-deterministic simulation; wrong for hierarchical data with known structure |
| **konva / react-konva** | Canvas abstraction layer; adds complexity without benefit for custom rendering |
| **visx** | D3 + React bindings focused on SVG; we want Canvas for performance |
| **@nivo/network** | Charting library, not a general-purpose node visualization |
| **Full `d3` package** | 500KB; only need `d3-hierarchy` (12KB) and `d3-quadtree` (5KB) |
| **three (additional)** | Already installed; not recommended for this 2D visualization |
| **OffscreenCanvas / Web Worker** | Premature optimization; 1000 nodes doesn't need worker thread rendering |

---

## Existing Stack: Already Sufficient

| Existing Package | Version | Role in Hive Visualization |
|-----------------|---------|---------------------------|
| `react` | 19.2.3 | Component architecture, refs for canvas |
| `next` | 16.1.5 | Page routing, client component boundary |
| `framer-motion` / `motion` | 12.29.x | Animate tooltip/panel appearance, NOT canvas animation |
| `zustand` | 5.0.10 | Store hive interaction state (selected node, zoom level, filters) |
| `tailwindcss` | 4 | Style overlay UI (tooltips, panels, controls) |
| `@radix-ui/*` | various | Dropdown menus, dialogs for node detail views |
| `clsx` + `tailwind-merge` | latest | Conditional classes for overlay components |

**What stays separate:**
- R3F + Three.js + Drei stay in the project for the GlassOrb and any future 3D effects
- The hive visualization is a separate Canvas 2D component, not inside the R3F canvas
- The two rendering systems (R3F for 3D effects, Canvas 2D for data viz) coexist without conflict

---

## Performance Considerations

### Canvas 2D at 1000+ Nodes

| Technique | Purpose | Impact |
|-----------|---------|--------|
| **Batch path operations** | Draw all lines in one `beginPath()`/`stroke()` pair | 10x fewer draw calls |
| **Layer separation** | Static lines on one canvas, animated nodes on another | Avoid redrawing static content |
| **Typed arrays** | `Float32Array` for node positions | 2-4x faster iteration |
| **requestAnimationFrame** | Sync with display refresh | Smooth 60fps |
| **Throttle mousemove** | Limit quadtree lookups to ~30/sec | Reduce computation |
| **Skip offscreen nodes** | Don't draw nodes outside viewport (with zoom/pan) | Scales with viewport, not total |
| **Pre-compute gradients** | Cache `createRadialGradient()` results | Avoid per-frame gradient creation |
| **DPR-aware sizing** | Already in existing code | Crisp on retina, performant on 1x |

### Expected Performance Profile

| Metric | 200 nodes (current) | 1000 nodes (target) | 5000 nodes (stretch) |
|--------|---------------------|---------------------|----------------------|
| Draw calls/frame | ~400 (unoptimized) | ~50 (batched) | ~50 (batched) |
| Quadtree lookup | N/A | <0.1ms | <0.5ms |
| Frame time | <2ms | <5ms | <12ms |
| FPS | 60 | 60 | 60 (with culling) |
| Memory | ~50KB | ~200KB | ~800KB |

### Optimization Priority

1. **Batch line drawing** -- Single `beginPath()`, multiple `lineTo()`, single `stroke()` (vs one per line)
2. **Quadtree for hit-testing** -- `d3-quadtree` replaces O(n) distance checking
3. **Layered canvases** -- Static lines layer + interactive nodes layer
4. **Viewport culling** -- Only draw visible nodes when zoomed in

---

## Architecture: How the Pieces Fit

```
                    +-----------------------+
                    |   Hive Data (static)  |
                    |   JSON tree structure  |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |    d3-hierarchy        |
                    |    tree().size([2PI,r])|
                    |    -> polar coords     |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |   Coordinate Transform |
                    |   polar -> cartesian   |
                    +-----------+-----------+
                                |
              +-----------------+------------------+
              |                                    |
    +---------v---------+            +-------------v----------+
    |  Canvas Layer 1   |            |   d3-quadtree          |
    |  (static lines)   |            |   (spatial index)      |
    |  Draw once on      |            |   Rebuilt on layout    |
    |  layout change     |            |   change only          |
    +-------------------+            +-------------+----------+
              |                                    |
    +---------v---------+            +-------------v----------+
    |  Canvas Layer 2   |            |   Mouse Event Handler  |
    |  (nodes + glow)   |            |   mousemove -> find()  |
    |  Redraw on hover/  |            |   click -> find()      |
    |  animation frame   |            +------------------------+
    +-------------------+
              |
    +---------v---------+
    |  HTML Overlay      |
    |  (tooltips, panels)|
    |  Positioned via    |
    |  node coordinates  |
    |  Uses Glass* comps |
    +-------------------+
```

### Component Boundaries

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| `HiveVisualization` | React + Canvas 2D | Container, canvas refs, resize handling |
| `useHiveLayout` | d3-hierarchy | Compute node positions from tree data |
| `useHiveInteraction` | d3-quadtree + events | Hit-testing, hover/click state |
| `HiveCanvas` | Canvas 2D API | Render lines and nodes |
| `HiveTooltip` | React + Framer Motion | Glass overlay for hovered node info |
| `HiveControls` | React + Radix UI | Zoom, filter, reset controls |

---

## Installation

```bash
pnpm add d3-hierarchy d3-quadtree
pnpm add -D @types/d3-hierarchy @types/d3-quadtree
```

**Total bundle impact:** ~17KB minified (~6KB gzipped). Negligible.

---

## Confidence Assessment

| Decision | Confidence | Reasoning |
|----------|------------|-----------|
| Canvas 2D over WebGL/R3F | **HIGH** | 1000 nodes is well within Canvas 2D limits; WebGL adds complexity without benefit at this scale; existing pattern in codebase |
| d3-hierarchy for layout | **HIGH** | Industry standard for hierarchical layouts; v3.1.2 stable for 4 years; deterministic radial tree is exactly what's needed |
| d3-quadtree for hit-testing | **HIGH** | O(log n) spatial queries are the standard approach for Canvas 2D interactivity; d3-quadtree is battle-tested |
| Layered canvas rendering | **HIGH** | Well-documented optimization pattern; MDN recommends it; reduces redraw cost significantly |
| NOT using PixiJS | **HIGH** | WebGL 2D renderer is overkill; adds 200KB+ for 1000 static/decorative nodes |
| NOT using d3-force | **HIGH** | Force-directed is wrong paradigm for known hierarchical structure; non-deterministic |
| Keeping R3F for GlassOrb only | **HIGH** | R3F serves 3D shader effects; hive viz is 2D; separate rendering contexts is cleaner |
| Framer Motion for overlays only | **HIGH** | Animate HTML tooltips, not canvas content; canvas uses requestAnimationFrame directly |
| HTML overlay for tooltips | **MEDIUM** | Standard pattern but positioning accuracy depends on canvas-to-DOM coordinate mapping; may need adjustment |

---

## Sources

### Rendering Approach
- [SVG vs Canvas vs WebGL: Performance 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025) -- Benchmarks showing Canvas 2D handles 1000s of nodes, WebGL needed at 10K+
- [SVG vs Canvas vs WebGL for Diagram Viewers](https://medium.com/@codetip.top/svg-vs-canvas-vs-webgl-for-diagram-viewers-tradeoffs-bottlenecks-and-how-to-measure-8cedbd3b7499) -- Tradeoff analysis
- [Canvas Optimization - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) -- Layered canvas, batch rendering
- [Canvas Performance - web.dev](https://web.dev/canvas-performance/) -- Pre-rendering, typed arrays

### R3F InstancedMesh Issues
- [instancedMesh onClick Issue #3289](https://github.com/pmndrs/react-three-fiber/issues/3289) -- Known bug: onClick returns all instances in path
- [InstancedMesh onClick Discussion #2103](https://github.com/pmndrs/react-three-fiber/discussions/2103) -- Regression from older versions
- [R3F Scaling Performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) -- Instancing guidelines

### Layout Algorithm
- [d3-hierarchy Tree Layout](https://d3js.org/d3-hierarchy/tree) -- Official docs, radial layout configuration
- [d3-hierarchy GitHub v3.1.2](https://github.com/d3/d3-hierarchy/tree/v3.1.2) -- Source, TypeScript definitions
- [Tree & Cluster Layouts DeepWiki](https://deepwiki.com/d3/d3-hierarchy/3.1-tree-and-cluster-layouts) -- Radial coordinate conversion

### Spatial Indexing
- [d3-quadtree Official](https://d3js.org/d3-quadtree) -- API documentation, `find()` method
- [Quadtree Hit-Testing Performance](https://dev.to/shivuser/how-we-made-our-canvas-application-30x-faster-a-deep-dive-into-performance-engineering-2f8p) -- 30x speedup with spatial indexing

### Canvas 2D Performance
- [OffscreenCanvas - web.dev](https://web.dev/articles/offscreen-canvas) -- Worker thread rendering (noted but not recommended for this scale)
- [Konva Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html) -- Layered canvas pattern reference

---

*Research completed: 2026-02-05*
*Ready for roadmap creation*
