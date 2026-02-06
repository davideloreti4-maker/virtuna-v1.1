# Phase 53: Foundation & Tab Shell - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the `/brand-deals` route with working three-tab navigation (Deals / Affiliates / Earnings) synced to URL, sidebar integration with active state, typed mock data fixtures, and shared utilities (useCopyToClipboard). This phase delivers the scaffolding — tab content is built in Phases 54-56.

</domain>

<decisions>
## Implementation Decisions

### UI generation approach
- **v0 MCP is the primary UI generation tool** for all visual components in this milestone
- Every v0 prompt must include Brand Bible guidance: glassmorphic dark theme, coral (#FF7F50) accent, Raycast-quality aesthetics
- Feed v0 the relevant BRAND-BIBLE.md sections (color tokens, glass rules, typography, component patterns) so output aligns with the design system
- Max 2-3 glass layers per viewport (Brand Bible rule) — glass for hero/header elements, solid `bg-surface-elevated` for repeated grid cards
- All v0-generated components must use existing design system tokens (not hardcoded colors/spacing)

### Tab navigation & URL sync
- Pill/segment control style (like Raycast segmented control), not underline tabs
- Animated sliding background indicator — pill slides smoothly between tabs on click (Framer Motion or CSS transition)
- Default tab is **Earnings** (show the money first) when visiting `/brand-deals` without a `?tab` param
- URL sync via `?tab=deals|affiliates|earnings` search param
- Tab content transition animation: Claude's discretion

### Mock data design
- Use **real brand names** (Nike, Spotify, Adobe, etc.) for realistic demos/screenshots
- Brand logos fetched via **external logo API** (logo.dev, clearbit, or similar)
- **7-8 deal categories**: Tech, Fashion, Gaming, Fitness, Beauty, Food, Travel, Finance
- Earnings data shows a **mix of tiers** — different creator levels with progression and goals to reach (not just one bracket)
- Edge cases covered: long names, zero values, missing optional fields (per roadmap requirements)

### Page header & layout
- Header includes **title + summary stats** (right-aligned row)
- Summary stats are **tab-contextual** — stats change per active tab:
  - Earnings tab: total earned, pending, paid out
  - Deals tab: active deals, new this week, applied
  - Affiliates tab: active links, total clicks, total earned
- Header area uses a **subtle glass panel** background (counts toward Brand Bible 2-3 glass layer budget)
- Tab control position: Claude's discretion (inside header vs below it)
- Content width: **match existing pages** (follow Settings/Dashboard pattern)
- Header action buttons: Claude's discretion

### Sidebar integration
- Keep **current position** in sidebar nav (Briefcase icon already configured)
- Show a **badge with new deals count** on the nav item
- Badge styling: Claude's discretion (match existing patterns or use coral accent)
- Tab memory on re-navigation: Claude's discretion (always default vs remember last)

### Claude's Discretion
- Tab content transition animation style
- Tab control position (inside header block vs separate bar below)
- Header action button presence/absence
- Sidebar badge style
- Tab memory behavior on sidebar re-click
- Content width specifics (follow existing page patterns)

</decisions>

<specifics>
## Specific Ideas

- Pill/segment tabs should feel like Raycast's segmented control with smooth sliding indicator
- Earnings as default tab — "show the money first" philosophy
- Header stats should feel lightweight (right-aligned, not heavy cards) — the tab content area is the hero
- Mock data earnings should show a progression narrative: some sources just starting ($50/mo), some mid-tier ($500/mo), some high performers ($5,000/mo) — giving creators goals to reach

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 53-foundation-tab-shell*
*Context gathered: 2026-02-05*
