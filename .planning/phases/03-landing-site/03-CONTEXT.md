# Phase 3: Landing Site - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build pixel-perfect landing pages matching societies.io exactly. This includes the homepage with hero, features, testimonials, CTAs, all visible sections, navigation setup, and scroll animations. Auth pages, pricing page, and blog are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Reference Fidelity
- **Exact match** — every pixel, spacing, and color must match societies.io
- When reference is unclear: **pause and ask** for clarification before proceeding
- Source access: screenshots for reference + can inspect live site via browser dev tools
- **Download actual assets** from societies.io (images, icons, logos)

### Animation Behavior
- Scroll trigger points: **match societies.io exactly** — inspect their triggers and replicate
- Animation replay behavior: **match societies.io** — check if they replay on scroll-up
- Parallax effects: **inspect site to confirm** — replicate if present
- Reduced motion: Claude's discretion for accessibility handling

### Navigation Handling
- Header scroll behavior: **match societies.io** — inspect sticky/hide/blur behavior
- Unbuilt pages (Pricing, Blog, etc.): redirect to **/coming-soon** page
- Mobile navigation: **match societies.io exactly** — inspect and replicate their mobile menu
- External links: **match societies.io** — check their link target behavior

### Section Breakdown
- Include **all sections** visible on societies.io homepage
- Theme: **dark mode only** — no light/dark toggle on landing
- Hero CTAs: **match societies.io** — check their CTA destinations
- Interactive elements (tabs, carousels): **replicate them** — user confirmed they exist

### Claude's Discretion
- Reduced motion accessibility implementation approach
- Asset organization and naming conventions
- Component structure for landing sections

</decisions>

<specifics>
## Specific Ideas

- Use v0 MCP for UI design accuracy (user directive from Phase 2)
- Reference inspection via browser dev tools for exact measurements
- When in doubt, ask — don't make assumptions on this pixel-perfect clone

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-landing-site*
*Context gathered: 2026-01-28*
