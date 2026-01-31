# Phase 20: Visualization Foundation - Context

**Gathered:** 2026-01-31 (updated)
**Status:** Ready for planning

<domain>
## Phase Boundary

Central orb component with processing states + pan/zoom canvas infrastructure for the progressive disclosure visualization. This phase delivers the orb (visual + animations), pan/zoom interactions, and layout structure. Segments, personas, and modals are separate phases.

**Locked decisions from v1.4 planning:**
- Progressive Disclosure approach (not chaos-to-order)
- Hierarchy: Orb → 10-12 Segments (big nodes) → 10 Personas per segment (small dots)
- No particles in MVP
- Reuse existing node visuals and PersonaCard for modal

**Not in scope:** Particles, segment nodes (Phase 21), personas (Phase 22), modal (Phase 23).

</domain>

<decisions>
## Implementation Decisions

### Orb Visual Design
- Glass-like translucent appearance (semi-transparent, background visible through)
- White/silver base with subtle orange inner glow as accent
- Small size: 15-20% of visualization area (compact center, more room for segments)
- Subtle soft glow effect around orb
- Orb dims slightly when segments appear (focus shifts to segments)
- Casts subtle illumination on nearby segments
- Internal texture: **Claude's discretion** - try smooth gradient, noise/grain, and layered rings, pick best match

### Orb Animation States
- **Idle breathing:** 2-3 second cycle, both scale pulse and glow intensity combined
- **Gathering:** 3-4 seconds duration (builds anticipation)
- **Analyzing:** Particles swirl inside the orb (rotation/spin effect)
- **Complete:** Brief celebration flash, then settle to dimmer passive state
- **Transitions:** Smooth blend (0.3-0.5s ease between states)
- **Idle interaction:** Responds to hover/tap with subtle glow brighten

### Rendering Approach
- **Hybrid:** Canvas for orb animations + DOM for segments (easier tap handling)
- **New component:** Fresh `ProgressiveVisualization` component, not extending existing NetworkVisualization
- **Orb rendering:** Claude's discretion based on visual requirements (canvas or DOM)
- **Priority:** Balanced - both animation smoothness and interaction reliability matter

### Layout Structure
- Full background (same as current NetworkVisualization)
- Fully responsive scaling
- Mobile: Same visualization scaled down proportionally
- Results panel overlays on top (visualization stays full)
- Z-layer: Above background, below modals/sheets
- Clean edge, no fade/vignette
- Segments positioned at medium distance (2.5-3x orb radius)

### Pan/Zoom (Core Feature - Phase 20)
- **Input:** Both desktop (drag + wheel) and touch (pinch/drag)
- **Bounds:** Min/max zoom limits (Claude determines sensible values)
- **Momentum:** None - stops immediately when finger lifts (direct control)
- **Reset button:** Subtle icon that appears after user moves view
- **Auto-center:** Disabled - user always controls view position
- **Small screens:** Pan/zoom always enabled, no minimum screen size cutoff
- **Initial state:** Orb centered on load

### Claude's Discretion
- Orb internal texture (test 3 options, pick best)
- Orb rendering method (canvas vs DOM)
- Exact zoom min/max limits
- Reset button icon and position
- Exact transition easing curves
- Canvas 2D vs WebGL (based on effect requirements and mobile performance)

</decisions>

<specifics>
## Specific Ideas

- Orb should feel like looking into a glass sphere with something alive inside
- Orange accent is the app's brand color - use sparingly, not dominant
- "Particles inside orb" during analyzing = small dots swirling, not literal particles
- Pan/zoom should feel like Google Maps or Figma canvas (smooth, predictable)
- Needs to work for B2B and B2C — polished but not cold, professional but captivating

</specifics>

<deferred>
## Deferred Ideas

- Particles rushing to orb (removed from MVP, could add in polish phase)
- Sound design for state transitions (Phase 24 or later)
- Segment nodes popping out (Phase 21)
- Persona expansion on segment tap (Phase 22)
- Persona modal details (Phase 23)

</deferred>

---

*Phase: 20-visualization-foundation*
*Context gathered: 2026-01-31*
