# Phase 16: Hero Section - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Create dramatic first impression with gradient lighting, macOS window mockup, and premium typography. This phase delivers the hero section only — navigation, feature cards, and other landing page sections are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Gradient Animation
- Slow continuous drift (10-20 second cycle), colors always moving
- Purple-to-cyan palette matching Raycast style and project tokens
- No cursor interaction — pure autonomous animation
- Animation runs independently of user input

### Window Mockup
- Static screenshot of Virtuna app showing results state (completed analysis with insights)
- Floating with perspective — angled 3D rotation for depth, Raycast-style
- Gentle bob animation — small up/down float on 3-5 second loop
- Uses TrafficLights component from Phase 15
- Wrapped in GlassPanel from Phase 15

### Typography & Headline
- Headline communicates product value — what Virtuna does
- Partial gradient text — one key word uses purple-to-cyan gradient, rest is white
- Short tagline subheadline (1 line) explaining the benefit
- Text positioned relative to mockup (text left of floating mockup given perspective layout)

### CTA Button
- Single primary button — "Try Free"
- Solid button with hover state, no ambient glow
- Links to sign up page (/signup)
- Premium hover effect with spring physics (per roadmap success criteria)

### Claude's Discretion
- Gradient prominence/intensity (dramatic vs subtle)
- Headline font size (48-72px range based on composition)
- Exact headline copy and tagline wording
- Entrance animation sequencing and timing
- Exact perspective angle for mockup

</decisions>

<specifics>
## Specific Ideas

- Raycast landing page as primary reference for gradient lighting and mockup presentation
- Results state screenshot shows the "value delivered" — completed analysis
- Perspective float gives depth without being gimmicky
- Single focused CTA reduces decision paralysis

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-hero-section*
*Context gathered: 2026-01-31*
