# Phase 48: Hive Foundation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Canvas-based hive visualization that renders 1000+ nodes in a deterministic radial layout at 60fps with retina support. This phase covers layout calculation, node rendering, connection lines, and the canvas infrastructure. Interactions (hover, click, zoom/pan) are Phase 49.

</domain>

<decisions>
## Implementation Decisions

### Node visual design
- All tier nodes are **circles** (tier-1, tier-2, tier-3)
- **Tier-based coloring** — each tier gets its own distinct shade (tier-1 brightest, tier-3 dimmest). No metric-based color mapping
- Center element is a **rounded rectangle** showing test content preview: video thumbnail if user uploaded video, text preview if user uploaded text. Empty rectangle when no test has been run
- Tier-3 leaf nodes (1000+) are **distinct small dots** — every individual node visible, no density cloud effect

### Connection lines
- **Straight lines** between parent-child nodes (no curves/bezier)
- **Draw all connections** including tier-2 to tier-3 lines — complete network visualization
- **Uniform subtle white** color for all lines — no color inheritance from nodes
- Line opacity fade: **Claude's Discretion** (tier-based steps or continuous distance)

### Layout density & spacing
- **Fixed logical size** — hive has a consistent map-like size. Users navigate/zoom/pan to explore (not auto-filling window)
- **Spread out** spacing — generous gaps between nodes, open and airy feel
- **No overlap** — every node (including 1000+ tier-3) must be fully distinct with clear separation
- **Fit to viewport** initial zoom — auto-scale so the full hive is visible on first load, user zooms in to explore

### Loading & animation
- **Skeleton hive** loading state — faint concentric rings with placeholder dots while data loads
- **Progressive build** animation — center appears first, then tier-1 radiates out, tier-2 follows, tier-3 last
- **First load only** — build animation plays once on initial render; subsequent visits show hive immediately
- **No empty state** — hive structure always visible with all nodes. Center content rectangle simply empty when no test run

### Claude's Discretion
- Line opacity fade algorithm (tier-step vs continuous)
- Exact tier color palette (within Raycast dark aesthetic)
- Node size scale per tier
- Progressive build animation timing and easing
- Skeleton hive visual details
- Canvas rendering optimizations for 1000+ distinct non-overlapping dots

</decisions>

<specifics>
## Specific Ideas

- Center rounded rectangle should show actual test content: video thumbnail for video tests, text preview for text tests
- "I want users to navigate fully the nodes map" — the hive should feel like an explorable map, not a static chart
- Spread out, airy layout — each node clearly distinguishable even at tier-3 scale

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 48-hive-foundation*
*Context gathered: 2026-02-06*
