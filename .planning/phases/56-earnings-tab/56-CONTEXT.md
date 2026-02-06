# Phase 56: Earnings Tab - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the EarningsTab with three sections: summary stat cards (2x2 grid with count-up animation), an area chart with period selection, and a per-source earnings breakdown list. All data from mock fixtures. Uses Recharts (already installed). Period selector updates all sections, not just the chart.

</domain>

<decisions>
## Implementation Decisions

### Stat card animations
- Count-up animation duration: ~2 seconds, medium pace
- Each card shows: themed icon + animated value + descriptive label
- Layout: 2x2 grid (not 4-column row)
- Percentage change indicators: green for positive, red for negative
- Count-up respects `prefers-reduced-motion` (shows static values)

### Chart styling & interaction
- Area chart gradient fill uses **coral/orange** accent (brand color), NOT green
- Tooltip: **solid dark card** (opaque bg like Raycast modals, NOT glassmorphic blur)
- Grid: subtle horizontal grid lines (white/[0.04] or similar) for value reference
- Dark-mode theming with visible axes, labels on dark background

### Breakdown list format
- Each row shows: source name, clicks, conversions, earnings (full detail)
- Sorted by earnings descending
- Capped at 5-6 visible rows with scroll for overflow
- All monetary values formatted as USD via Intl.NumberFormat

### Period selector behavior
- Default selected period: **30D** (last 30 days)
- Periods: 7D, 30D, 90D, All Time
- Transition: **fade out/in** (~200ms) between periods
- Selector style: **sliding pill** matching the main tab navigation pattern (reuse/adapt)
- Scope: **everything updates** (stat cards, chart, AND breakdown all reflect selected period)

### Claude's Discretion
- Green/red percentage change threshold logic (any positive vs threshold-based)
- Chart height (balance visibility with breakdown section)
- Breakdown list styling (table rows vs stacked row cards)
- Whether breakdown rows include mini progress bars for relative earnings
- Loading skeleton design for the earnings tab
- Exact spacing, typography, and icon choices for stat cards

</decisions>

<specifics>
## Specific Ideas

- Use v0 MCP with dedicated, detailed generation prompts for all UI components in this phase
- Reuse `formatCurrency`/`formatNumber` utilities from `affiliate-utils.ts` (established in Phase 55)
- Color semantics: green for earnings values in stat cards, coral/orange for chart accent
- Recharts 3.7.0 already installed — no new dependencies needed
- Sliding pill period selector should feel consistent with the tab shell from Phase 53

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 56-earnings-tab*
*Context gathered: 2026-02-06*
