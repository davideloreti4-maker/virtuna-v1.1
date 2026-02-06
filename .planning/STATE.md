# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Raycast-quality design system enabling rapid, consistent UI development
**Current focus:** v2.3 Brand Deals & Affiliate Page -- Phase 57 complete (2/2 plans), milestone feature-complete

## Current Position

**Milestone:** v2.3 -- Brand Deals & Affiliate Page
**Phase:** 57 of 57 (Responsive & Accessibility) -- COMPLETE
**Plan:** 2/2 complete
**Status:** Phase 57 complete, milestone v2.3 feature-complete
**Last activity:** 2026-02-06 -- Completed 57-02-PLAN.md (Keyboard accessibility across all interactive components)

Progress: [██████████] 100%

## Phase Overview

| Phase | Name | Requirements | Depends On | Status |
|-------|------|-------------|------------|--------|
| 53 | Foundation & Tab Shell | 7 (PAGE-*) | None | Complete (2026-02-05) |
| 54 | Deals Tab | 14 (DEAL-* + PLSH-01,02) | Phase 53 | Complete (3/3 plans) |
| 55 | Affiliates Tab | 10 (AFFL-*) | Phase 53 | Complete (2/2 plans) |
| 56 | Earnings Tab | 9 (EARN-*) | Phase 53 | Complete (3/3 plans) |
| 57 | Responsive & Accessibility | 3 (PLSH-03,04,05) | 53-56 | Complete (2/2 plans) |

Note: Phases 54, 55, 56 are independent of each other (can build in any order after 53).

## Dependency Graph

```
Phase 53 (Foundation) ✓
  |
  +---> Phase 54 (Deals + color/perf patterns) ✓ --+
  +---> Phase 55 (Affiliates) ✓                     +--> Phase 57 (Verify) ✓
  +---> Phase 56 (Earnings) ✓                      --+
```

## Shipped Milestones

- v2.0 Design System Foundation (2026-02-05) -- 6 phases, 35 plans, 125 requirements
- v1.2 Visual Accuracy Refinement (2026-01-30) -- 2 phases
- v1.1 Pixel-Perfect Clone (2026-01-29) -- 10 phases

## Parallel Milestones

- v2.1 Dashboard Rebuild (main worktree, phases 45-49)
- v2.2 Trending Page (separate worktree, phases 50-52)

## Infrastructure URLs

- **GitHub**: https://github.com/davideloreti4-maker/virtuna-v1.1
- **Vercel**: https://virtuna-v11.vercel.app
- **Showcase**: /showcase (component documentation, 7 pages)
- **Worktree**: ~/virtuna-v2.3-brand-deals (branch: milestone/v2.3-brand-deals)

## Accumulated Context

### Decisions
- Phase numbering starts at 53 (v2.1 uses 45-49, v2.2 uses 50-52)
- v0 MCP is the primary UI generation tool for this milestone
- UI-only milestone -- mock data, no backend integration
- Separate worktree to avoid conflicting with v2.1 and v2.2 work
- Deal grid cards use solid bg-surface-elevated (not glass) for performance
- PLSH-01 (solid cards) and PLSH-02 (color semantics) baked into Phase 54 as foundational patterns
- Phase 57 slimmed to verification-only: loading skeletons, responsive, keyboard a11y
- [DEC-53-01-01] Use clearbit CDN for brand logos (no local assets)
- [DEC-53-01-02] Monetary values as numbers, formatted at render time
- [DEC-53-01-03] Simple setTimeout in clipboard hook (no useRef needed)
- [DEC-53-02-01] Use window.history.pushState for tab URL sync (not router.push)
- [DEC-53-02-02] Motion layoutId for sliding pill animation
- [DEC-53-02-03] Hybrid sidebar nav: usePathname for routed items, useState for non-routed
- [DEC-53-02-04] Inline backdrop-filter on header (Lightning CSS workaround)
- [DEC-53-02-05] LinkSimple icon instead of Link to avoid next/link conflict
- [DEC-54-01-01] Reuse GradientColor type for CATEGORY_COLORS (no new color types)
- [DEC-54-01-02] Featured deals use border-t-2 orange accent (not GradientGlow)
- [DEC-54-01-03] Applied cards show opacity-60 mute treatment
- [DEC-54-02-01] Search input controlled by parent -- debounce responsibility in DealsTab container
- [DEC-54-02-02] FILTER_CATEGORIES as explicit runtime array mirrors BrandDealCategory union
- [DEC-54-03-01] Applied state lifted to BrandDealsPage to survive tab switches
- [DEC-54-03-02] DealApplyModal uses design system Dialog/InputField/Button (not raw Radix)
- [DEC-54-03-03] Search debounced at 300ms via useDebouncedCallback
- [DEC-54-03-04] Responsive grid: 3 cols lg, 2 sm, 1 mobile
- [DEC-55-01-01] formatCurrency uses maximumFractionDigits: 0 (whole dollars, no cents)
- [DEC-55-01-02] StatBlock private function inside affiliate-link-card.tsx (not exported)
- [DEC-55-01-03] STATUS_VARIANT as const Record for type-safe badge variant mapping
- [DEC-55-02-01] Nullish coalesce on date split for strict TS array indexing
- [DEC-56-01-01] Percentage change values hardcoded in EarningsStatCards (mock data has no change data)
- [DEC-56-01-02] useCountUp returns MotionValue<string> requiring motion.span for rendering
- [DEC-56-02-01] Use TooltipContentProps (not TooltipProps) for Recharts v3 custom tooltip
- [DEC-56-02-02] Pass tooltip as function content prop (not JSX element) for Recharts v3 type safety
- [DEC-56-03-01] Period filtering uses proportional ratio scaling for stat cards (periodTotal/total)
- [DEC-56-03-02] Sources list is same for all periods (mock simplification)
- [DEC-57-02-01] AffiliateLinkCard has no onKeyDown -- relies on nested copy button for keyboard activation
- [DEC-57-02-02] GlassPill focus ring guarded by isInteractive (only button pills, not span pills)
- [DEC-57-02-03] Focus ring uses ring-offset-background for contrast on dark theme

### Key Technical Notes
- Settings page pattern for URL-synced tabs (server reads searchParams, client orchestrates)
- Recharts 3.7.0 already installed for earnings chart
- CopyButton pattern exists in showcase (reuse for affiliate links)
- BRAND-BIBLE max 2-3 glass layers rule -- glass for hero elements only
- Sidebar Brand Deals nav item now routes to /brand-deals with usePathname active state
- Git worktree may lose files on commit -- use `git checkout HEAD -- <files>` to restore if needed
- Reusable hooks live in src/hooks/ (useDebouncedCallback, useCopyToClipboard, useIsMobile, etc.)
- Color semantic pattern established: orange=creative, blue=tech, green=fitness/earnings, cyan=travel
- formatPayout fallback chain: payoutRange > fee+commission > fee > commission > TBD
- formatCurrency/formatNumber utilities in affiliate-utils.ts (reusable for Phase 56 Earnings)
- Mini KPI stat block pattern: bg-white/[0.03] rounded-lg with bold value + uppercase muted label
- Hero commission rate pattern: text-2xl font-bold text-green-400 centered block
- Container/presentational split: AffiliatesTab owns state, Plan 01 components are pure presentational
- ToastProvider at layout level for global toast support (useToast hook available everywhere)
- Generate Link pattern: prepend to state, show toast, derive available products via useMemo Set filter
- useCountUp hook: MotionValue-based count-up (useMotionValue + animate + useTransform), respects prefers-reduced-motion
- MotionValue rendering: always use motion.span (not regular span) to render MotionValue as text content
- Recharts v3 custom tooltip: use TooltipContentProps type + function content prop (not JSX element)
- SVG gradient IDs must be unique per chart component (prefix with component name) to avoid collisions
- EarningsPeriodSelector uses layoutId="earnings-period-pill" (distinct from main tabs "brand-deals-tab-pill")
- EarningsTab container pattern: period state + useMemo filterEarningsByPeriod + AnimatePresence fade
- EarningsBreakdownList: sorted desc by totalEarned, Avatar xs, formatCurrency green-400 text
- Card a11y pattern: tabIndex={0} + role=article + aria-label + focus-visible ring + onKeyDown Enter for primary CTA
- Focus-visible ring pattern: focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background
- EarningsPeriodSelector has role=radiogroup with role=radio + aria-checked on each button

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed 57-02-PLAN.md (Keyboard accessibility across all interactive components)
Resume file: None

---
*State created: 2026-02-05*
*Last updated: 2026-02-06 -- Phase 57 complete (2/2 plans), milestone v2.3 feature-complete*
