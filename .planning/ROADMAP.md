# Roadmap: Virtuna

## Milestones

- v2.3 Brand Deals & Affiliate Page -- Phases 53-57 (active)
- v2.2 Trending Page -- Phases 50-52 (active, parallel worktree)
- v2.1 Dashboard Rebuild -- Phases 45-49 (active, parallel worktree)
- v2.0 Design System Foundation -- Phases 39-44 (shipped 2026-02-05) | [Archive](milestones/v2.0-ROADMAP.md)
- v1.2 Visual Accuracy Refinement -- Phases 11-14 (shipped 2026-01-30)
- v1.1 Pixel-Perfect Clone -- Phases 1-10 (shipped 2026-01-29)
- v1.3.2-v1.7 -- Phases 15-38 (archived 2026-02-03)

## v2.3 Brand Deals & Affiliate Page

**Milestone Goal:** Glassmorphic brand deals & affiliate page with three-tab layout (Deals / Affiliates / Earnings) built using v0 MCP guided by the Virtuna design system. All UI with mock data -- no backend integration.

- [x] **Phase 53: Foundation & Tab Shell** -- Route, tab navigation, sidebar wiring, mock data layer, and shared utilities (completed 2026-02-05)
- [ ] **Phase 54: Deals Tab** -- Brand deal card grid with filters, search, featured section, apply interaction, and color/performance foundations
- [ ] **Phase 55: Affiliates Tab** -- Active link cards with copy-to-clipboard and available products grid with generate link action
- [ ] **Phase 56: Earnings Tab** -- Summary stat cards with count-up, earnings chart, period selector, and breakdown list
- [ ] **Phase 57: Responsive & Accessibility** -- Loading skeletons for all tabs, responsive mobile verification, keyboard accessibility audit

### Phase 53: Foundation & Tab Shell

**Goal:** Brand Deals page exists with working three-tab navigation synced to URL, sidebar integration, typed mock data, and shared utilities -- ready for tab content.

**Requirements:** PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, PAGE-07

**Description:** Establish the `/brand-deals` route under the `(app)` route group following the Settings page pattern: server component reads searchParams, client component orchestrates Radix Tabs with URL sync. Wire sidebar navigation with pathname-based active state. Define TypeScript interfaces and mock data fixtures with edge cases. Extract reusable `useCopyToClipboard` hook. Add page header with design system Typography.

**Success Criteria:**
1. Navigating to `/brand-deals` renders a page with three tabs (Deals / Affiliates / Earnings) and placeholder content in each
2. Clicking a tab updates the URL search param (`?tab=deals`); browser back/forward navigates between tabs correctly
3. Sidebar "Brand Deals" nav item is highlighted when on `/brand-deals` and navigates to the page on click
4. Mock data files export typed arrays of BrandDeal, AffiliateLink, Product, and EarningsSummary with edge cases (long names, zero values, missing optional fields)

**Dependencies:** None (foundation phase)

**Plans:** 2 plans

Plans:
- [x] 53-01-PLAN.md -- Types, mock data fixtures, and useCopyToClipboard hook
- [x] 53-02-PLAN.md -- Page route, tab shell with sliding pill, header with contextual stats, sidebar wiring

---

### Phase 54: Deals Tab

**Goal:** Users can browse brand deals in a filterable, searchable card grid with featured highlights and apply to deals via CTA.

**Requirements:** DEAL-01, DEAL-02, DEAL-03, DEAL-04, DEAL-05, DEAL-06, DEAL-07, DEAL-08, DEAL-09, DEAL-10, DEAL-11, DEAL-12, PLSH-01, PLSH-02

**Description:** Build the DealsTab component with a responsive 2-3 column card grid rendering 8-12 mock deals. Each DealCard uses solid `bg-surface-elevated` backgrounds (not glassmorphic blur) for grid scroll performance — glass reserved for featured deals with GradientGlow only. Card composes Badge/Button/Avatar showing brand logo, title, description (line-clamped), payout, category tags, and status badges. Color semantics follow Brand Bible: orange for creative deal categories, green for earnings values, blue for analytics. "New This Week" highlighted section at top. Filter pills for categories, debounced search by brand name. Apply button toggles to "Applied" on click. Empty state when no deals match filters. Hover states on cards. This phase establishes the color and performance patterns carried forward to Phases 55-56.

**Success Criteria:**
1. Deals tab shows 8-12 deal cards in a responsive grid (3 columns on desktop, 2 on tablet, 1 on mobile) with brand logo, title, description, payout, tags, and status badge on each card
2. Deal cards use solid surface backgrounds (no backdrop-filter blur) and scroll smoothly; only featured deal cards use GradientGlow
3. User can filter deals by category using filter pills and search by brand name — results update live; empty state shows when no deals match with a clear-filters CTA
4. Clicking "Apply" on a deal card changes the button to an "Applied" badge; "New This Week" section appears at top with info badge
5. Color semantics follow Brand Bible: orange for creative categories, green for earnings values, blue for analytics — pattern established for subsequent tabs

**Dependencies:** Phase 53 (needs tab shell, mock data, page structure)

**Plans:** TBD

---

### Phase 55: Affiliates Tab

**Goal:** Users can view their active affiliate links with stats, copy links to clipboard, and generate new affiliate links from available products.

**Requirements:** AFFL-01, AFFL-02, AFFL-03, AFFL-04, AFFL-05, AFFL-06, AFFL-07, AFFL-08, AFFL-09, AFFL-10

**Description:** Build the AffiliatesTab with two sections: Active Links (4-5 cards) and Available Products (6-8 cards). Active link cards show product image, name, truncated URL, copy button (icon morphs Copy to Check for 2s via useCopyToClipboard), click/conversion/commission stats, and status badge. Available product cards show image, name, commission rate, and "Generate Link" CTA that adds the product to the active links list with toast feedback. Empty state for when no active links exist.

**Success Criteria:**
1. Affiliates tab shows "Active Links" section with 4-5 affiliate link cards displaying product name, truncated URL, click count, conversions, commission earned, and status badge
2. Clicking the copy button on an affiliate link copies the URL to clipboard, morphs the icon from Copy to Check for 2 seconds, and shows a toast confirmation
3. "Available Products" section shows 6-8 product cards with commission rate; clicking "Generate Link" adds the product to the active links list with success feedback
4. Empty state renders when no active links exist (before any links are generated)

**Dependencies:** Phase 53 (needs tab shell, mock data, useCopyToClipboard hook)

**Plans:** TBD

---

### Phase 56: Earnings Tab

**Goal:** Users can view their earnings overview with animated stat cards, a themed area chart with period selection, and a per-source earnings breakdown.

**Requirements:** EARN-01, EARN-02, EARN-03, EARN-04, EARN-05, EARN-06, EARN-07, EARN-08, EARN-09

**Description:** Build the EarningsTab with three sections: summary stat cards, earnings chart, and breakdown list. Four stat cards (Total Earned, Pending, Paid Out, This Month) with count-up animation respecting prefers-reduced-motion and percentage change indicators (green/red). Recharts area chart with dark-mode theming using Virtuna design tokens, gradient fill with green accent, glassmorphic hover tooltip, and period selector pills (7D/30D/90D/All Time). Breakdown section with per-deal/link earnings sorted by earnings descending. All monetary values formatted with Intl.NumberFormat.

**Success Criteria:**
1. Four stat cards display Total Earned, Pending, Paid Out, and This Month with values that animate on mount (count-up effect) and show green/red percentage change indicators
2. Earnings area chart renders with dark-mode theming (visible axes, labels, grid on dark background), gradient fill with green accent, and a glassmorphic tooltip on hover showing date and formatted value
3. Period selector pills (7D, 30D, 90D, All Time) update the chart data with a brief loading transition
4. Earnings breakdown section lists per-source earnings (source name, clicks, conversions, earnings) sorted by earnings descending, with all monetary values formatted as USD via Intl.NumberFormat
5. Count-up animation respects `prefers-reduced-motion` by showing static values instead

**Dependencies:** Phase 53 (needs tab shell, mock data)

**Plans:** TBD

---

### Phase 57: Responsive & Accessibility

**Goal:** Page has loading skeletons, verified responsive mobile layout, and full keyboard accessibility across all tabs.

**Requirements:** PLSH-03, PLSH-04, PLSH-05

**Description:** Add skeleton loading states for all three tabs matching their content layout shapes. Verify responsive layout across viewports (stat cards 2-col on mobile, deal grid 1-col, affiliate cards stacked). Ensure all tab content is keyboard-navigable (Tab through interactive elements, Enter activates CTAs). Note: performance (PLSH-01) and color semantics (PLSH-02) were baked into Phase 54 as foundational patterns.

**Success Criteria:**
1. Loading skeleton states render for each tab before content appears, matching the layout shape of actual content (card grid skeleton for deals, two-section skeleton for affiliates, stat cards + chart skeleton for earnings)
2. Page layout adapts correctly on mobile viewport: stat cards in 2 columns, deal grid single column, affiliate cards stacked vertically
3. User can navigate all tab content with keyboard only — Tab moves through interactive elements, Enter activates buttons/CTAs

**Dependencies:** Phases 53, 54, 55, 56 (all content must be built before cross-tab verification)

**Plans:** TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10 | v1.1 | 44/44 | Complete | 2026-01-29 |
| 11-14 | v1.2 | 8/8 | Complete | 2026-01-30 |
| 15-38 | v1.3.2-v1.7 | - | Archived | 2026-02-03 |
| 39-44 | v2.0 | 35/35 | Complete | 2026-02-05 |
| 45-49 | v2.1 | 0/3+ | In Progress | - |
| 50-52 | v2.2 | 0/? | In Progress | - |
| 53 | v2.3 | 2/2 | Complete | 2026-02-05 |
| 54 | v2.3 | 0/? | Not started | - |
| 55 | v2.3 | 0/? | Not started | - |
| 56 | v2.3 | 0/? | Not started | - |
| 57 | v2.3 | 0/? | Not started | - |

---
*Roadmap created: 2026-02-03*
*Last updated: 2026-02-05 -- Phase 53 complete (Foundation & Tab Shell, 2/2 plans, goal verified)*
