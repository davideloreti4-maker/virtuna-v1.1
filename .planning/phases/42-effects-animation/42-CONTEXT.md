# Phase 42: Effects & Animation - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement glassmorphism effects and animation patterns matching the Raycast aesthetic. Includes GlassPanel component, FadeInUp/stagger animations, noise texture, chromatic aberration, and gradient glow effects. All existing components remain unchanged — this phase adds effect primitives and animation utilities only.

</domain>

<decisions>
## Implementation Decisions

### Glass effect behavior
- GlassPanel architecture must match how Raycast structures their glass surfaces — researcher to extract Raycast's exact approach and we replicate
- Blur intensity levels: extract Raycast's exact blur values per context (not predefined sm/md/lg)
- Border treatment: match Raycast's exact border opacity, color, and style — no custom coral glow variants
- Backdrop content awareness: researcher studies if Raycast adapts glass appearance based on scroll/background and we replicate that behavior

### Animation choreography
- Trigger behavior: match Raycast exactly — researcher determines whether scroll-triggered (intersection observer) or mount-based per section type
- Stagger timing: extract Raycast's exact stagger delays from their extension grid and feature lists
- Animation technology: match Raycast's approach — researcher checks whether they use CSS-only, Framer Motion, or another library
- Easing curves: extract Raycast's exact cubic-bezier values from their CSS and tokenize them as design tokens

### Decorative effects
- Noise texture: match Raycast's implementation approach (CSS, SVG filter, or canvas) — researcher extracts exact method
- Chromatic aberration: replicate Raycast's exact usage — researcher identifies where/when they apply it
- Gradient glow colors: keep Raycast's original gradient glow palette (purple, blue, etc.) — do NOT replace with coral
- Effects organization: mirror Raycast's code structure for how effects are organized (standalone vs bundled)

### Performance boundaries
- Mobile blur: match Raycast's exact mobile optimization behavior — researcher checks if/how they reduce blur on mobile
- Reduced motion: replicate Raycast's `prefers-reduced-motion` handling — researcher extracts their approach
- Low-power devices: follow Raycast's approach to conditionally disabling decorative effects
- GPU compositing: match Raycast's strategy for `will-change` / GPU layer promotion on animated and glass elements

### Claude's Discretion
- Internal component API design (prop names, defaults) as long as behavior matches Raycast
- File organization within the effects directory
- TypeScript type granularity
- Test strategy

</decisions>

<specifics>
## Specific Ideas

- The overarching direction is clear: **match Raycast 1:1 across every dimension** — blur values, easing curves, animation triggers, effect placement, performance optimizations. Researcher must do thorough extraction from raycast.com to capture exact values.
- Gradient glows are an exception to the coral brand rule — they keep Raycast's original color palette (purple, blue, etc.) as decorative elements.

</specifics>

<deferred>
## Deferred Ideas

- Full visual audit and color correction pass across all existing components and showcase to match Raycast 1:1 — user wants this but it's a separate effort from Effects & Animation. Note for roadmap backlog or Phase 43/44 scope.

</deferred>

---

*Phase: 42-effects-animation*
*Context gathered: 2026-02-05*
