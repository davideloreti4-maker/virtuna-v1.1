# Phase 40: Core Components - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Build foundational component set (Button, Card, GlassCard, Input) with full TypeScript types and accessibility. Components must match Raycast styling exactly, using coral only where Raycast uses their accent red. Dark mode only.

</domain>

<decisions>
## Implementation Decisions

### Visual Styling Approach
- Match Raycast 1:1 — exact shadows, borders, radii, spacing
- Coral (#FF7F50) replaces Raycast accent red (#ff6363) only where Raycast uses it
- Do NOT make coral the default button color — follow Raycast's accent usage patterns
- Dark mode only — no light mode support needed

### Glassmorphism
- Use blur values from Phase 39 extraction data (Claude's discretion on exact values)
- Match Raycast's glass intensity, not heavier or lighter

### Claude's Discretion
- Exact glassmorphism blur values based on extraction data
- Specific implementation of focus rings and hover states
- Component prop naming conventions
- Keyboard navigation patterns

</decisions>

<specifics>
## Specific Ideas

- "Match Raycast, only use coral when Raycast uses their accent red" — don't over-apply coral branding
- Raycast homepage is the visual reference — dark, subtle, glass effects

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-core-components*
*Context gathered: 2026-02-03*
