# Phase 20: Visualization Foundation - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the visual core for the dashboard's analysis visualization — central glowing orb with ambient breathing animation, dark mode design system, and rendering foundation. This replaces the current static nodes display in the main content area.

**Not in scope:** Particles (Phase 21), node system (Phase 22), interactions (Phase 23).

</domain>

<decisions>
## Implementation Decisions

### Orb Visual Identity
- Soft-edged sphere (not hard geometric or irregular) — professional for B2B, captivating for B2C
- White/silver core with cyan glow — clean, premium, neutral enough for both audiences
- Subtle halo glow — elegant, doesn't overpower surrounding UI
- Internal swirling movement — gives the orb life, like plasma or nebula inside
- Compact size (15-20% of viewport) — focal point but leaves room for particles/nodes

### Breathing Animation
- Gentle pulse (5-8% scale change) — clearly alive but not distracting
- Perfectly rhythmic (no variation) — consistent 3-4 second cycles
- Medium duration (3-4 seconds per cycle) — balanced, calming but not sleepy

### Rendering Approach
- **Dashboard integration:** Main content area, replaces current nodes display
- Edge-to-edge in content area (no border/card treatment) — immersive within bounds
- Visualization is for app/dashboard only — NOT the landing page

### Dark Mode Palette
- Background matches existing dashboard theme — seamless integration
- Medium vibrance accents (cyan highlights) — balanced between enterprise and consumer
- Purple-to-cyan gradient palette per v1.4 requirements

### Claude's Discretion
- Canvas 2D vs WebGL decision (based on effect requirements and mobile performance)
- Glow pulse behavior (constant vs synced with scale)
- Edge/rim highlight treatment
- Orb position (dead center vs slightly elevated)
- Background darkness level (to match existing dashboard)
- Ambient color/gradient treatment
- Sidebar visibility during visualization

</decisions>

<specifics>
## Specific Ideas

- "Needs to work for B2B and B2C" — polished but not cold, professional but captivating
- Internal swirling effect like a nebula or plasma — the orb should feel alive
- Replaces current static nodes in the dashboard — this IS the new nodes visualization

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-visualization-foundation*
*Context gathered: 2026-01-31*
