# Phase 54: Deals Tab - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Filterable, searchable brand deal card grid with featured highlights, apply interaction, and color/performance foundations. Users can browse deals, filter by category, search by brand, and apply via modal. Establishes color semantics (orange/green/blue) and solid-surface card pattern for subsequent tabs.

</domain>

<decisions>
## Implementation Decisions

### Card content & density
- 3-line max description (line-clamped) — enough context to gauge interest
- Payout value prominent, top-right of card — large green text, money is the first thing you see
- Single primary category tag per card — one colored badge, keeps cards minimal
- Brand logo small (24px), inline with title — compact, title-led design
- Card content hierarchy: brand logo + name → title → description (3 lines) → single category tag + status badge → payout anchored top-right

### Featured section ("New This Week")
- Horizontal scroll row above the main grid — carousel-style, featured deals scroll horizontally
- Featured cards same size as regular cards with accent indicator — small "New" badge or colored top border (not GradientGlow, not larger)
- Always visible when there are new deals — not dismissible
- Section has "New This Week" heading with info badge

### Filter & search behavior
- "All" pill at start of filter row — clicking it clears any category filter, always visible
- Filter pill placement and search bar layout: Claude's discretion
- Single vs multi-select category filters: Claude's discretion
- Empty state design: Claude's discretion (must include clear-filters CTA)
- Search is debounced by brand name

### Apply interaction flow
- Clicking "Apply" opens a modal (not inline toggle) — uses existing design system modal/dialog pattern
- Modal fields: name, contact email, short pitch textarea
- After submit: modal shows brief success state (checkmark/message), then closes
- Card button morphs to "Applied" badge after modal closes
- Applied cards get subtle opacity/muted treatment — visually deprioritized in grid
- No undo — once applied, stays applied

### Claude's Discretion
- Filter pill placement and search bar layout
- Single vs multi-select category filtering
- Empty state design (with clear-filters CTA required)
- Featured row deal count (based on mock data and viewport)
- Exact card spacing, border radius, shadow depth
- Loading/transition animations for filter changes
- Color semantics implementation details (orange creative, green earnings, blue analytics)

</decisions>

<specifics>
## Specific Ideas

- Use v0 MCP as primary UI generation tool — dedicated workflow for creating all design UI components
- Deal cards use solid `bg-surface-elevated` backgrounds (not glassmorphic blur) for grid scroll performance — glass reserved for featured section only if needed
- Color semantics follow Brand Bible: orange for creative deal categories, green for earnings/payout values, blue for analytics
- Reuse design system modal pattern from Phase 46 for the apply modal
- "New This Week" as horizontal scroll row gives visual hierarchy — main grid below for browsing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-deals-tab*
*Context gathered: 2026-02-06*
