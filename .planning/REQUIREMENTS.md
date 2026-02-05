# Requirements: Virtuna v2.3 Brand Deals & Affiliate Page

**Defined:** 2026-02-05
**Core Value:** Glassmorphic brand deals & affiliate page built with v0 MCP guided by the Virtuna design system

## v2.3 Requirements

### Page Foundation

- [ ] **PAGE-01**: Brand Deals page route exists at `/brand-deals` under `(app)` route group
- [ ] **PAGE-02**: Three-tab layout (Deals / Affiliates / Earnings) using existing CategoryTabs component
- [ ] **PAGE-03**: Active tab state syncs with URL search params (`?tab=deals`); browser back/forward navigates between tabs
- [ ] **PAGE-04**: Sidebar "Brand Deals" nav item wired to `/brand-deals` route with active state derived from `usePathname()`
- [ ] **PAGE-05**: Mock data defined as typed TypeScript fixtures (BrandDeal, AffiliateLink, EarningsSummary interfaces) with edge cases (long names, zero values, missing fields)
- [ ] **PAGE-06**: Page header with title and subtitle using design system Typography
- [ ] **PAGE-07**: Reusable `useCopyToClipboard` hook extracted for affiliate link copy interactions

### Deals Tab

- [ ] **DEAL-01**: Deal card grid renders 8-12 mock brand deals in a 2-3 column responsive grid
- [ ] **DEAL-02**: Each deal card shows brand logo/avatar, deal title, and offer description (2-3 line clamp)
- [ ] **DEAL-03**: Each deal card shows payout amount ("$500 flat fee" or "15% commission") and compensation type Badge
- [ ] **DEAL-04**: Each deal card shows category/niche tags as Badge or GlassPill components (1-3 per card)
- [ ] **DEAL-05**: Each deal card has an Apply/Claim CTA Button (primary variant) that changes to "Applied" Badge on click (local state)
- [ ] **DEAL-06**: Deal status badges display correctly (New, Applied, Active, Expired) with semantic colors
- [ ] **DEAL-07**: Filter pills allow filtering deals by category (All, Beauty, Tech, Lifestyle, Food, Fitness)
- [ ] **DEAL-08**: Search input allows filtering deals by brand name with debounced input
- [ ] **DEAL-09**: "New This Week" highlighted section at top with info Badge
- [ ] **DEAL-10**: 1-2 featured deals render with GradientGlow ambient effect
- [ ] **DEAL-11**: Empty state shown when no deals match filters (illustration + message + clear filters CTA)
- [ ] **DEAL-12**: Deal cards have visible hover state (subtle border/elevation change)

### Affiliates Tab

- [ ] **AFFL-01**: "Active Links" section displays 4-5 active affiliate link cards with count Badge in header
- [ ] **AFFL-02**: Each active link card shows product image/thumbnail, product name, and truncated affiliate URL
- [ ] **AFFL-03**: Each active link card has a copy-to-clipboard button (via `useCopyToClipboard` hook) with toast confirmation
- [ ] **AFFL-04**: Copy button icon morphs from Copy to Check icon for 2 seconds as visual feedback
- [ ] **AFFL-05**: Each active link card shows click count, conversion count, and commission earned
- [ ] **AFFL-06**: Each active link card shows status Badge (Active, Expired, Paused)
- [ ] **AFFL-07**: "Available Products" section displays 6-8 products in a 2-3 column grid
- [ ] **AFFL-08**: Each available product card shows product image, name, and commission rate
- [ ] **AFFL-09**: "Generate Link" Button adds product to active links list with brief success feedback (toast + card appears at top of active list)
- [ ] **AFFL-10**: Empty state for active links section when none exist

### Earnings Tab

- [ ] **EARN-01**: 4 summary stat cards in a responsive row (Total Earned, Pending, Paid Out, This Month)
- [ ] **EARN-02**: Stat card values animate with count-up effect on mount (respects `prefers-reduced-motion` -- shows static values)
- [ ] **EARN-03**: Each stat card shows percentage change indicator (green for positive, red for negative)
- [ ] **EARN-04**: Period selector pills (7D, 30D, 90D, All Time) update chart data with brief loading transition
- [ ] **EARN-05**: Earnings area chart renders with Recharts, dark-mode themed (custom axis/grid/tick colors from design tokens)
- [ ] **EARN-06**: Chart uses gradient fill with green accent color matching Brand Bible semantics
- [ ] **EARN-07**: Chart tooltip on hover shows date and formatted earnings value in glassmorphic-styled tooltip
- [ ] **EARN-08**: Earnings breakdown section shows per-deal/link earnings in a list (columns: source name, clicks, conversions, earnings) sorted by earnings descending
- [ ] **EARN-09**: All monetary values formatted with Intl.NumberFormat (USD)

### Polish

- [ ] **PLSH-01**: Deal cards use solid `bg-surface-elevated` for grid performance (not glassmorphic blur on every card)
- [ ] **PLSH-02**: Color semantics follow Brand Bible (green=earnings, orange=creative deals, blue=analytics/clicks)
- [ ] **PLSH-03**: Loading skeleton states for all three tabs using design system Skeleton pattern
- [ ] **PLSH-04**: Responsive layout works on mobile (stat cards 2-col, deal grid 1-col, affiliate cards stack vertically)
- [ ] **PLSH-05**: All tab content keyboard-navigable (Tab through cards, Enter to activate CTAs)

## Future Requirements

### Backend Integration (v2.4+)

- **BACK-01**: Real brand deal data from API
- **BACK-02**: Affiliate link generation and click tracking
- **BACK-03**: Earnings calculation from real conversion data
- **BACK-04**: Application/approval workflow with status persistence

### Advanced Features (v2.4+)

- **ADV-01**: Deal detail slide-over panel with full requirements/deliverables
- **ADV-02**: Tiered commission progress bars (gamification)
- **ADV-03**: Inline sparkline charts on affiliate link cards
- **ADV-04**: AI-powered deal match score

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real affiliate link generation/tracking | UI-only milestone, backend comes later |
| Payment processing (PayPal/Stripe) | Requires backend + financial compliance |
| Brand/merchant API integration | Mock data sufficient for UI milestone |
| Application/approval workflow backend | Button state change only, no persistence |
| Contract/brief signing | Legal complexity, out of scope |
| Multi-currency support | USD only, simplifies UI |
| Notification system for deal updates | Static "New" badges sufficient |
| Merchant/brand messaging | No chat/messaging UI |
| Analytics export/CSV download | View-only data |
| Promo code management | Separate feature surface |
| Light mode theme | Dark-mode first across all milestones |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAGE-01 | Phase 53 | Pending |
| PAGE-02 | Phase 53 | Pending |
| PAGE-03 | Phase 53 | Pending |
| PAGE-04 | Phase 53 | Pending |
| PAGE-05 | Phase 53 | Pending |
| PAGE-06 | Phase 53 | Pending |
| PAGE-07 | Phase 53 | Pending |
| DEAL-01 | Phase 54 | Pending |
| DEAL-02 | Phase 54 | Pending |
| DEAL-03 | Phase 54 | Pending |
| DEAL-04 | Phase 54 | Pending |
| DEAL-05 | Phase 54 | Pending |
| DEAL-06 | Phase 54 | Pending |
| DEAL-07 | Phase 54 | Pending |
| DEAL-08 | Phase 54 | Pending |
| DEAL-09 | Phase 54 | Pending |
| DEAL-10 | Phase 54 | Pending |
| DEAL-11 | Phase 54 | Pending |
| DEAL-12 | Phase 54 | Pending |
| AFFL-01 | Phase 55 | Pending |
| AFFL-02 | Phase 55 | Pending |
| AFFL-03 | Phase 55 | Pending |
| AFFL-04 | Phase 55 | Pending |
| AFFL-05 | Phase 55 | Pending |
| AFFL-06 | Phase 55 | Pending |
| AFFL-07 | Phase 55 | Pending |
| AFFL-08 | Phase 55 | Pending |
| AFFL-09 | Phase 55 | Pending |
| AFFL-10 | Phase 55 | Pending |
| EARN-01 | Phase 56 | Pending |
| EARN-02 | Phase 56 | Pending |
| EARN-03 | Phase 56 | Pending |
| EARN-04 | Phase 56 | Pending |
| EARN-05 | Phase 56 | Pending |
| EARN-06 | Phase 56 | Pending |
| EARN-07 | Phase 56 | Pending |
| EARN-08 | Phase 56 | Pending |
| EARN-09 | Phase 56 | Pending |
| PLSH-01 | Phase 54 | Pending |
| PLSH-02 | Phase 54 | Pending |
| PLSH-03 | Phase 57 | Pending |
| PLSH-04 | Phase 57 | Pending |
| PLSH-05 | Phase 57 | Pending |

**Coverage:**
- v2.3 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 -- Traceability updated with phase assignments (phases 53-57); PLSH-01/02 moved to Phase 54*
