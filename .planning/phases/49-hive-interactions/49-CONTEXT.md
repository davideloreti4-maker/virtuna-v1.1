# Phase 49: Hive Interactions (Click, Hover & Navigation) - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Add interactive exploration behaviors to the existing hive canvas: hover highlighting with connected-node emphasis, click info overlays, zoom/pan navigation, and performant hit detection via d3-quadtree. The hive currently renders ~350 nodes (center + tier-1 + tier-2, no tier-3) with a deterministic radial layout.

</domain>

<decisions>
## Implementation Decisions

### Hover feedback
- Dim unrelated nodes on hover — Claude's discretion on dim intensity
- Connected nodes get brighter + connection lines between hovered and connected nodes highlight
- Transitions are instant (~50ms) — snappy, native-app feel
- Cursor behavior on node hover — Claude's discretion

### Click & info overlay
- GlassCard overlay shows: node name, type/tier label, and key metric values
- Smart auto-positioning: overlay appears near the clicked node, flipping sides to stay within canvas bounds
- Dismiss via close button (X) or clicking elsewhere on canvas
- Clicking another node closes current overlay and opens that node's overlay
- Clicking a node locks the hover highlight state — connected nodes stay emphasized until overlay is dismissed

### Zoom & pan controls
- Scroll wheel zoom + mobile pinch-to-zoom support (no visible buttons)
- Reset/fit button appears only when user has zoomed or panned away from default view
- Pan via click-and-drag on empty canvas space
- Wide zoom range (0.2x–8x) for freedom to explore dense regions and zoom out

### Node density handling
- ~350 nodes (tier-3 already removed from layout)
- Hover priority: smallest/closest tier first (tier-2 over tier-1 over center) — lets you target individual nodes
- Hover debounce and click-vs-drag threshold — Claude's discretion

### Claude's Discretion
- Dim opacity level for unrelated nodes during hover
- Cursor style on node hover (pointer vs default)
- Debounce timing for hover transitions (~350 node density)
- Click-vs-drag distance threshold for distinguishing node selection from pan
- GlassCard overlay animation (fade in, scale, etc.)
- Reset button styling and placement

</decisions>

<specifics>
## Specific Ideas

- Hover should feel instant and snappy — not sluggish or animated
- Click locks the hover state (selected node stays highlighted with connections) — acts as a "pinned" inspection mode
- Overlay auto-positions near the node, not in a fixed sidebar — keeps spatial context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 49-hive-interactions*
*Context gathered: 2026-02-08*
