# Phase 55: Affiliates Tab - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the AffiliatesTab component with two sections: Active Links (affiliate link cards with stats and copy-to-clipboard) and Available Products (product cards with commission rates and "Generate Link" CTA). All UI with mock data. Copy interaction uses existing useCopyToClipboard hook. Generate Link adds product to active links with feedback.

</domain>

<decisions>
## Implementation Decisions

### Active Link card layout
- Stats are the hero — clicks, conversions, and commission earned are the most prominent elements on each card
- Stats displayed as mini KPI blocks (three small labeled stat blocks inside each card), not inline text
- Small product thumbnail/image included on each card for visual identity
- Copy button uses icon morph only (Copy icon -> Check icon for 2s) — no toast needed since inline feedback is sufficient
- Truncated affiliate URL visible on card with the copy button adjacent

### Available Products presentation
- Grid layout matching the Deals tab (2-3 column responsive grid) for visual consistency across tabs
- Commission rate displayed as a hero number (large percentage like "15%") — it's the main visual anchor of each product card
- "Generate Link" CTA on each product card

### Section structure & flow
- Claude's Discretion: section ordering, visual weight between sections, heading style (with/without counts), divider treatment

### Empty & edge states
- Claude's Discretion: empty state design (when no active links), product state after generation (remove vs badge), "all generated" state, status badge color coding

### UI Generation approach
- Use v0 MCP as the primary tool for all design/UI component generation
- Follow established patterns from Phase 54 (deal cards, grid layout, color semantics)

### Claude's Discretion
- Section ordering (Active Links first vs Available Products first)
- Visual weight distribution between sections
- Section heading style and separation method
- "Generate Link" interaction flow (instant vs animated)
- Available product card style relative to deal cards (same weight vs simpler)
- Empty state design approach
- Product state management after link generation
- Status badge color scheme on active links

</decisions>

<specifics>
## Specific Ideas

- Stats-first card design — the affiliate link card should make performance data (clicks, conversions, commission) immediately scannable
- Mini KPI blocks inside cards — similar to dashboard stat cards but miniaturized within each affiliate link card
- Commission rate as hero number on product cards — large, prominent percentage that catches the eye
- Grid consistency with Deals tab — same responsive column pattern (3 lg, 2 sm, 1 mobile)
- Icon morph for copy (no toast) — Copy -> Check for 2s via useCopyToClipboard hook already built in Phase 53
- v0 MCP is the dedicated UI generation tool for building all components in this phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 55-affiliates-tab*
*Context gathered: 2026-02-06*
