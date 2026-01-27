# Phase 3: Landing Site - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build pixel-perfect landing pages matching societies.io: Homepage, Pricing, and About pages. Includes navigation, scroll animations, and full mobile responsiveness. Auth flows and app screens are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Visual Fidelity
- Exact clone — pixel-for-pixel match with societies.io
- Download and use exact images from societies.io
- Match exact fonts, sizes, weights, and line heights
- Replicate all micro-interactions (hover states, transitions, button effects, link underlines)

### Page Structure
- Core pages only: Homepage, Pricing, About
- Exact copy from societies.io (same headlines, subheadlines, CTA text)
- Exact navigation menu structure (all items, dropdowns, structure)
- Nav items linking to unbuilt pages route to a "Coming Soon" placeholder page
- Update Header and Footer from Phase 2 to match societies.io pixel-perfect
- Pricing page: match societies.io interaction pattern (if they have monthly/yearly toggle, we do too)
- About page: full clone of every section (team, mission, values, timeline, etc.)
- CTAs link to /login or /signup routes (even if not built yet)

### Scroll Animations
- Match societies.io animations exactly — reverse-engineer their scroll animations
- If they use parallax, we use parallax
- Do NOT respect prefers-reduced-motion — animations are core to the experience

### Mobile Behavior
- Pixel-perfect mobile layouts matching societies.io
- Match societies.io breakpoints exactly (reverse-engineer from their CSS)
- Replicate all touch interactions (swipe, tap states, gestures)

### Claude's Discretion
- Mobile navigation pattern (hamburger, slide-out, etc.)
- Whether to extend Phase 2 animation components or create landing-specific ones

</decisions>

<specifics>
## Specific Ideas

- societies.io is the single source of truth — if in doubt, match what they do
- This is a portfolio piece demonstrating pixel-perfect replication ability
- No creative interpretation — fidelity is the goal

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-landing-site*
*Context gathered: 2026-01-27*
