# Phase 47: Results Panel, Top Bar & Loading States - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the results display (ImpactScore, AttentionBreakdown, Variants, Insights, Themes), top bar (ContextBar + filter/legend pills), and loading states to design system components. This completes Wave 1 — full dashboard design system coverage. No new features; purely a migration to GlassCard, GlassProgress, Badge, Typography, GlassPill, Spinner, and Button primitives.

</domain>

<decisions>
## Implementation Decisions

### Results Panel Layout
- Stacked cards in a single scrollable column — each section (ImpactScore, AttentionBreakdown, Variants, Insights, Themes) is its own GlassCard
- All sections always visible (no collapsible/accordion behavior)
- ImpactScore card is same size as other section cards, but the score number uses coral accent color for emphasis
- AttentionBreakdown uses GlassProgress horizontal bars for each attention metric (not a segmented bar)

### Variants Display
- Claude's Discretion: choose between side-by-side columns or stacked rows based on the existing data structure and component patterns

### Top Bar & Filter Pills
- Filter/legend pills use neutral glass style (GlassPill) with a small colored dot or left border to indicate category — not tinted backgrounds
- Pills are toggleable: clicking shows/hides that data category in results. Active pills visually distinct from inactive
- ContextBar display style: Claude's Discretion (inline text row vs breadcrumb — pick based on existing ContextBar structure and Raycast patterns)
- Pill overflow handling: Claude's Discretion (horizontal scroll vs wrap — pick based on expected pill count and viewport)

### Loading & Progress States
- Skeleton shimmer placeholders in the shape of the final stacked-card layout
- No separate progress bar or percentage — skeletons alone convey loading
- Progressive reveal: each section fades in from skeleton to real content as it becomes ready (not all-at-once)
- Visible cancel button below the skeleton area — clicking stops the process and returns to previous state

### Results Interactions
- Share button copies link to clipboard with a brief toast confirmation (no dropdown menu)
- Result cards use standard Raycast hover (translate-y-0.5, border brightens) — no extra content appears on hover
- Insights and Themes sections have expandable items: each insight/theme is a row that expands to show longer detail on click

### Claude's Discretion
- Variant comparison layout (side-by-side vs stacked)
- ContextBar display format
- Pill overflow strategy
- Skeleton shimmer animation timing and style
- Exact spacing and typography within cards
- Toast notification implementation for share action
- Expand/collapse animation for insight/theme items

</decisions>

<specifics>
## Specific Ideas

- Use v0 with dedicated, detailed generation prompts for all UI component generation during this phase
- Maintain Raycast design language: clean, dark, minimal — color only for accents (coral for emphasis, colored dots for category pills)
- Progressive reveal should feel smooth — skeleton-to-content transition, not jarring swaps

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-results-topbar-loading*
*Context gathered: 2026-02-06*
