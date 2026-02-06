# Project Research Summary

**Project:** Virtuna v2.3 — Brand Deals & Affiliate Page
**Domain:** Creator platform UI — brand deal management, affiliate link tracking, earnings visualization
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This milestone is a pure UI composition exercise leveraging Virtuna's existing 36-component Raycast-quality design system. The brand deals page implements a three-tab interface (Deals / Affiliates / Earnings) with glassmorphic cards, mock data, and no backend. Research confirms zero new dependencies are required — every capability (tabs, cards, badges, clipboard, charts) exists in the current stack or is available via browser APIs.

The recommended approach follows the Settings page pattern: server component handling URL search params for tab state, client component orchestrating tab content, and direct import of typed mock data. Components should compose existing primitives (GlassCard, Badge, Button, Avatar) rather than reimplementing, with v0 MCP used for rapid layout generation guided by explicit design token instructions. The Recharts library (already installed at v3.7.0) handles the earnings chart with custom dark-mode theming.

Critical risks center on design system drift during v0 generation and glassmorphism performance at scale. v0 may generate components using shadcn defaults (zinc-*, arbitrary values) instead of Virtuna's semantic tokens (bg-surface, text-foreground, etc.), requiring systematic token-alignment passes. Card grids with 12-20+ glassmorphic elements risk GPU compositing overhead, especially on mobile — mitigation involves reserving glass effects for hero elements and using solid surface cards for grids.

## Key Findings

### Recommended Stack

**Zero new dependencies required.** All capabilities are already available in the installed stack or as browser APIs.

**Core technologies:**
- **Recharts 3.7.0** (already installed): Earnings area chart with custom glassmorphic tooltip — React 19 compatible, SVG-based, supports custom theming
- **@radix-ui/react-tabs 1.1.13** (already installed): Three-tab layout (Deals / Affiliates / Earnings) — a11y built-in, matches Settings page pattern
- **Navigator.clipboard API** (browser native): Copy-to-clipboard for affiliate links — already used in two project components (CopyButton pattern)
- **Intl.NumberFormat / DateTimeFormat** (browser native): Currency and date formatting — no need for date-fns or currency libraries with mock data
- **Framer Motion 12.29.3** (already installed): Tab transitions and card entrance animations
- **Existing design system components**: GlassCard, Badge, Button, Avatar, Typography — 36 components ready to compose

**Alternatives rejected:**
- Tremor/Nivo charts (Recharts lighter, already installed)
- clipboard-copy npm (3-line browser API wrapper)
- date-fns (overkill for mock data display)
- Additional state management (Zustand already installed, but page-local state sufficient)

### Expected Features

**Must have (table stakes):**
- **Deals tab**: Card grid of brand deals with logo, title, description, payout, status badges (Active/Pending/Expired), category tags, Apply CTA, filter/search
- **Affiliates tab**: Active affiliate link cards with copy-to-clipboard + stats (clicks, conversions, commission), available products grid with Generate Link CTA
- **Earnings tab**: Summary stat cards (Total/Pending/Paid/This Month), earnings chart with period selector (7d/30d/90d), earnings breakdown by source
- **Tab navigation**: URL-synced tabs for shareability, back-button support

**Should have (competitive/differentiators):**
- Glassmorphic deal cards with category color tinting (orange for creative, green for wellness)
- Animated stat cards with count-up effect (premium feel)
- Copy link micro-interaction (icon morph Copy → Check, toast confirmation)
- "New This Week" highlighted section in Deals
- Featured deal ambient glow (GradientGlow behind 1-2 hero cards)
- Earnings chart with glass overlay styling

**Defer (v2+ / anti-features for UI-only milestone):**
- Real affiliate link generation/tracking (backend)
- Payment processing integration (backend)
- Real brand/merchant API integration (use mock data)
- Application/approval workflow (mock state transitions only)
- Contract signing, multi-currency, notifications, messaging
- Analytics export/CSV download

### Architecture Approach

Route structure follows existing app conventions: `src/app/(app)/brand-deals/page.tsx` (server component) renders `brand-deals-client.tsx` (client component with tab orchestration). The (app) route group provides AppShell with sidebar and auth guard. Tab state syncs with URL search params using the Settings page pattern: server reads searchParams, validates, passes defaultTab to client.

**Major components:**
1. **BrandDealsClient** — Client-side tab orchestrator using Radix Tabs with URL sync
2. **DealsTab + DealCard** — Card grid of brand offers, composes GlassCard/Badge/Button/Avatar
3. **AffiliatesTab + AffiliateLinkCard + ProductCard** — Active links section + available products grid with copy interaction
4. **EarningsTab + EarningsSummaryCard + EarningsChart** — Stat cards (GlassCard with green glow) + Recharts area chart with dark theming
5. **Mock data layer** — Typed TS files (mock-deals.ts, mock-affiliates.ts, mock-earnings.ts) with edge-case coverage

**Integration points:**
- Sidebar navigation requires wiring: add href to navItems, derive active from usePathname()
- All new components live in `src/components/app/brand-deals/`
- No DS component modifications needed
- No stores needed (static mock data imported directly)

### Critical Pitfalls

1. **v0 MCP Design System Drift** — v0 generates components using shadcn defaults (zinc-*, rounded-xl, shadow-lg) instead of Virtuna's tokens (bg-surface, radius-lg, --shadow-lg). Visually similar but breaks token integrity. **Prevention:** Include globals.css @theme block in every v0 prompt, specify exact component imports, systematic token-replacement pass after generation.

2. **Glassmorphism Performance Degradation** — Card grids with 12-20+ GlassCards trigger GPU compositing per card (backdrop-filter: blur). Mobile scroll stutters, Safari fans spin. Violates BRAND-BIBLE "max 2-3 glass layers" rule. **Prevention:** Use solid surface cards for grids (bg-surface-elevated), reserve glass for hero elements only, remove glow prop from grid cards, test on real mobile hardware.

3. **Recharts Dark Mode Invisibility** — Recharts defaults assume light backgrounds: axis lines, tick labels, grid lines render dark-on-dark. Chart appears blank on Virtuna's #07080a background. **Prevention:** Create CHART_THEME config mapping Virtuna tokens to chart props, wrap in themed component, explicitly set every color prop, test tooltip rendering.

4. **Tab Navigation URL Desync** — Three failure modes: stale tab state on sidebar re-click, shared URLs don't open to correct tab, back button navigates away instead of switching tabs. **Prevention:** Follow Settings page searchParams pattern, use router.replace with scroll: false for tab changes, validate tab param with fallback.

5. **Card Grid Height Inconsistency** — Variable content (long brand names, 2-line descriptions, different payouts) creates uneven row heights and ragged layout. **Prevention:** Flex column with spacer (header fixed, body flex-grow, footer fixed CTA), truncate descriptions with line-clamp-2, standardize brand logo containers, test with realistic edge-case mock data.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Tab Shell
**Rationale:** Establish routing and tab infrastructure before building any content. The Settings page provides a proven pattern for URL-synced tabs. Sidebar navigation must be wired to route to pages (not just toggle state). This foundation prevents rework on tab components.

**Delivers:**
- Route: `src/app/(app)/brand-deals/page.tsx` with searchParams handling
- Client component: `brand-deals-client.tsx` with three-tab shell using Radix Tabs
- Sidebar navigation wiring: href mapping, pathname-based active state
- TypeScript interfaces for all data shapes (BrandDeal, AffiliateLink, Product, Earnings)
- Mock data files with intentional edge cases (no logo, long text, $0 values, expired states)

**Addresses:**
- Tab/URL sync pitfall (research flag: tab navigation)
- Sidebar routing gap (architecture finding)
- Mock data uniformity trap (research flag: edge cases)

**Avoids:**
- Building tab content before infrastructure is proven
- Discovering tab state issues after components are built

**Research Flag:** Standard pattern (Settings page) — no additional research needed

---

### Phase 2: Deals Tab — Discovery Surface
**Rationale:** Deals tab is the primary feature surface and establishes card grid patterns used in other tabs. Must address glass performance and design token alignment early since these affect all subsequent card-based components.

**Delivers:**
- DealCard component composing GlassCard/Badge/Button/Avatar
- DealsTab with responsive card grid (2-3 columns)
- Filter pills for categories (reuse FilterPill from DS)
- Search input for brand filtering
- "New This Week" section with 2-3 featured cards
- Featured card ambient glow (GradientGlow behind hero cards only)
- Apply button state transitions (Apply → Applied)
- Empty state handling

**Addresses:**
- Glassmorphism performance (use solid cards for grid, glass for heroes)
- v0 token drift (establish prompt template and review checklist)
- Card height consistency (flex column layout with pinned CTA, line-clamp)
- Color semantic mapping (orange for deals, coral for CTAs)

**Uses:**
- v0 MCP for DealCard layout generation (with explicit token/component instructions)
- Existing DS: GlassCard, Badge, Button, Avatar, Typography

**Avoids:**
- Too many glass layers (BRAND-BIBLE 2-3 max rule)
- Inconsistent card heights (flex layout solution)

**Research Flag:** Needs v0 prompt calibration — test DealCard generation first, refine template based on output quality

---

### Phase 3: Affiliates Tab — Link Management
**Rationale:** Introduces copy-to-clipboard interaction pattern (reusable for other features). Simpler layout than Deals (no filters), focuses on core affiliate functionality.

**Delivers:**
- AffiliateLinkCard with copy button (icon swap + toast)
- ProductCard with Generate Link CTA
- Two-section layout: Active Links + Available Products
- Copy interaction with visual feedback (Copy icon → Check icon, 2s timeout)
- Mock link generation action (adds card to active list)
- Inline click/conversion stats display

**Addresses:**
- Copy-to-clipboard UX (reuse CopyButton pattern from showcase)
- Feedback without toast noise (button state is the feedback)
- Link truncation (URL display with ellipsis)

**Uses:**
- Navigator.clipboard.writeText() (browser native)
- Existing useToast() for confirmation
- Existing CopyButton pattern (icon swap, aria-label update)

**Implements:**
- Reusable useCopyToClipboard hook (extractable for future use)

**Avoids:**
- Toast overuse (button feedback sufficient)
- Missing accessible announcements (aria-live or aria-label swap)

**Research Flag:** Standard pattern (CopyButton exists) — no additional research needed

---

### Phase 4: Earnings Tab — Financial Overview
**Rationale:** Most complex tab due to chart theming requirements. Builds on stat card patterns (similar to dashboard). Chart wrapper established here becomes reusable for future data viz.

**Delivers:**
- EarningsSummaryCard (GlassCard with green glow, count-up animation)
- Four summary stats: Total Earned, Pending, Paid Out, This Month
- EarningsChart with Recharts area chart
- Chart dark-mode theming (CHART_THEME config with Virtuna tokens)
- Custom glassmorphic tooltip for chart
- Period selector pills (7D/30D/90D/All)
- Earnings breakdown table/list

**Addresses:**
- Recharts dark mode invisibility (theme config with token mapping)
- Chart tooltip clipping (padding, no overflow:hidden on parent)
- Color semantics (green for earnings, semantic tokens for chart elements)

**Uses:**
- Recharts 3.7.0: AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
- Framer Motion for count-up animation
- Intl.NumberFormat for currency formatting

**Implements:**
- Reusable chart theming wrapper (VirtunaChart component)
- Green accent for earnings (BRAND-BIBLE rule)

**Avoids:**
- Default Recharts styling (all colors explicitly set)
- Tooltip positioning bugs (proper container padding)

**Research Flag:** Needs chart theming research — Recharts v3 dark mode API may have updates since last checked, verify CSS variable support

---

### Phase 5: Polish & Integration
**Rationale:** After core functionality is built, add loading states, refine interactions, and validate cross-page navigation.

**Delivers:**
- Skeleton components for all tab content
- Empty states for each tab (no deals, no links, no earnings)
- Mobile responsiveness verification
- Tab transition animations (Framer Motion)
- Font consistency audit (Funnel Display for headings)
- Icon weight consistency (Phosphor regular/fill)
- Cross-page navigation testing (dashboard → brand-deals → settings)

**Addresses:**
- Loading state gaps (production-ready UI)
- Font/icon inconsistency (v0 output cleanup)
- Mobile glass performance (real device testing)

**Avoids:**
- Shipping without loading states (feels unfinished)
- Skipping mobile testing (glass performance only visible on device)

**Research Flag:** Standard polish work — no additional research needed

---

### Phase Ordering Rationale

- **Foundation first prevents rework** — Tab infrastructure and routing must be solid before building content. Changing tab patterns after components are built is expensive.
- **Deals before Affiliates** — Deals tab establishes card grid patterns, glass usage strategy, and v0 generation workflow. Lessons learned apply to Affiliates and Earnings tabs.
- **Affiliates before Earnings** — Simpler layout tests copy interaction pattern. Earnings chart is the most complex component (theming, tooltip, data viz) — tackle last.
- **Polish as final phase** — Loading states and empty states require complete components to exist. Mobile testing requires all tabs functional.
- **v0 calibration in Phase 2** — First v0 generation (DealCard) reveals token drift and component composition issues. Refine prompt template before Phases 3-4.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Deals tab):** v0 prompt calibration — test DealCard generation, measure token drift, refine prompt template for design system adherence
- **Phase 4 (Earnings tab):** Recharts v3 dark mode capabilities — verify CSS variable support, check for improved theming APIs since v3.0 release

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Settings page provides exact pattern for URL-synced tabs
- **Phase 3 (Affiliates):** CopyButton pattern already implemented in showcase
- **Phase 5 (Polish):** Standard loading/empty state work, no novel patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all tools verified in package.json; browser APIs well-supported |
| Features | HIGH | Cross-referenced 8+ creator platforms (Aspire, Impact, Amazon Associates); table stakes and differentiators clearly identified |
| Architecture | HIGH | Direct codebase analysis; Settings page provides exact pattern; sidebar routing gap documented |
| Pitfalls | HIGH | v0 drift verified against token system; glass performance backed by BRAND-BIBLE rules; Recharts dark mode documented; tab sync pattern proven |

**Overall confidence:** HIGH

All four research dimensions are grounded in verifiable sources: existing codebase patterns (Settings, CopyButton, sidebar), installed dependencies (package.json), platform benchmarks (Aspire, Impact docs), and design system documentation (BRAND-BIBLE.md).

### Gaps to Address

**1. v0 MCP Current Capabilities**
The research assumes v0 output will require token-alignment passes. v0's ability to consume custom design tokens may have improved recently. **Resolution:** Phase 2 includes v0 prompt calibration step — generate DealCard first, measure drift, refine prompt template before generating remaining components.

**2. Recharts v3 CSS Variable Support**
Research assumes manual prop-based theming. Recharts v3 may support CSS variables directly for easier dark mode. **Resolution:** Phase 4 flags this for verification before building EarningsChart. If CSS variable support exists, theming is simpler; if not, CHART_THEME config object is the fallback.

**3. Sidebar Routing Coordination with v2.1 Dashboard Rebuild**
The v2.1 Dashboard Rebuild (parallel milestone) may also change sidebar navigation patterns. Wiring Brand Deals to route-based navigation in v2.3 might conflict. **Resolution:** Check v2.1 planning for sidebar changes before Phase 1. If v2.1 changes routing model, coordinate to adopt the same pattern. Surgical sidebar.tsx change (10-15 lines) is low-risk if isolated to v2.3.

**4. ToastProvider Availability**
Copy-to-clipboard uses useToast() for confirmation, but AppShell doesn't appear to wrap children in ToastProvider. **Resolution:** Phase 3 verifies ToastProvider exists in app layout. If missing, either add ToastProvider or use button-only feedback (icon swap without toast, still accessible).

## Sources

### Primary (HIGH confidence)
**Codebase (direct analysis):**
- `package.json` — Dependency verification (Recharts 3.7.0, Radix Tabs 1.1.13, Framer Motion 12.29.3)
- `src/app/(app)/settings/page.tsx` — URL-synced tabs pattern with searchParams
- `src/app/(app)/dashboard/page.tsx` — Server/client split pattern
- `src/components/app/sidebar.tsx` — Navigation model gaps (useState, no routing)
- `src/app/(marketing)/showcase/_components/copy-button.tsx` — Copy-to-clipboard pattern
- `src/components/ui/tabs.tsx` — Radix Tabs implementation
- `src/components/primitives/GlassCard.tsx` — Glass component API
- `src/app/globals.css` — Design token definitions (@theme block)
- `.planning/BRAND-BIBLE.md` — Color semantics, glassmorphism limits (max 2-3 layers), typography

**Platform Documentation:**
- [Aspire Creator Portal Overview](https://help.aspireiq.com/en/articles/6565403-creator-portal-overview) — Deal card patterns, campaign workflows
- [Aspire Creator Marketplace](https://help.aspireiq.com/en/articles/6023393-overview-of-aspire-s-creator-marketplace) — Discovery surface, filters
- [Aspire Affiliate Performance Dashboard](https://help.aspireiq.com/en/articles/6143584-affiliate-performance-dashboard) — Metrics display
- [Impact.com Partner Dashboard Widgets](https://help.impact.com/en/support/solutions/articles/48001235447-partner-dashboard-widgets-explained) — Earnings stats, chart patterns
- [Amazon Associates Dashboard](https://affiliate-program.amazon.com/help/node/topic/GMWAK55DQX8JEK7C) — Affiliate link management UI

### Secondary (MEDIUM confidence)
**Technology Documentation:**
- [Recharts GitHub releases](https://github.com/recharts/recharts/releases) — v3.7.0 confirmed latest
- [Recharts Documentation](https://recharts.github.io/en-US/) — API reference
- [Recharts 3.0 Migration Guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) — Breaking changes
- [MDN Navigator.clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard) — Clipboard API support
- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) — v1.1.13 component API

**Design Systems + AI:**
- [AI Design System with MCP](https://medium.com/design-bootcamp/how-to-build-an-ai-design-system-6d80d7aa200d)
- [Design Systems and AI: Why MCP Servers Are The Unlock](https://www.figma.com/blog/design-systems-ai-mcp/)
- [AI-Powered Prototyping with Design Systems](https://vercel.com/blog/ai-powered-prototyping-with-design-systems)

**Next.js Patterns:**
- [Next.js useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Next.js searchParams sync](https://nextjs.org/docs/messages/next-prerender-sync-params)

### Tertiary (LOW confidence)
**UX/UI Patterns:**
- [Baymard: Dashboard Cards Consistency](https://baymard.com/blog/cards-dashboard-layout) — Grid layout best practices
- [Mobbin: Toast UI Design Best Practices](https://mobbin.com/glossary/toast) — Feedback patterns
- [Replacing Toasts with Accessible Feedback Patterns](https://dev.to/miasalazar/replacing-toasts-with-accessible-user-feedback-patterns-1p8l) — Copy button UX
- [Dark Glassmorphism Performance](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) — Backdrop-filter performance concerns
- [Dashboard Design Principles](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles) — Layout patterns

---

**Research completed:** 2026-02-05
**Ready for roadmap:** Yes
**Recommended next step:** Create roadmap with 5 phases as suggested above
