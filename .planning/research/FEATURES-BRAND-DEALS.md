# Feature Landscape: Brand Deals & Affiliate Page

**Domain:** Creator/influencer platform -- brand deals, affiliate links, and earnings management
**Researched:** 2026-02-05
**Confidence:** HIGH (cross-referenced across 8+ real platforms)

---

## Table Stakes

Features users expect from any brand deal/affiliate page. Missing = page feels incomplete or amateurish.

### Deals Tab

| Feature | Why Expected | Complexity | Existing Component | Notes |
|---------|-------------|------------|-------------------|-------|
| Brand deal card grid | Every creator platform (Aspire, Impact, Collabstr) uses card grids for browsing deals | Medium | `GlassCard` | Core layout. 2-3 column responsive grid. Each card = one brand deal opportunity |
| Brand logo/avatar on card | Universal pattern -- Aspire, Impact, ShareASale all show brand identity prominently | Low | `Avatar` component exists | Top-left or centered at top of card. Circular or rounded-square |
| Deal title/offer description | Aspire shows campaign name + brief description. Impact shows brand + offer details | Low | Typography system | H3 for title, body-small for description. 2-3 line clamp |
| Payout/commission display | Impact Finance Widget, Aspire show compensation type. Users need to know what they earn | Low | Typography | Bold, prominent number. Format: "$500" flat fee or "15% commission" |
| Compensation type indicator | Aspire filters by Payment, Product Only, Commission, Other. Users need to distinguish deal types | Low | `Badge` (existing) | Badge variants: "Paid" (success), "Commission" (info), "Product" (default) |
| Apply/Claim CTA button | Aspire has "Apply" on campaigns, Impact has "View Terms" + action. Every marketplace has a primary action | Low | `Button` (existing) | Primary variant for available deals. State changes on interaction |
| Deal status badges | Aspire shows "Waiting", "Next task" labels. Impact shows approval states. HubSpot deal cards show Pending/Approved/Rejected | Low | `Badge` (existing) | Applied (warning), Active (success), Expired (error), New (info) |
| Category/niche tags | Aspire filters by Beauty, Fashion, Fitness, etc. ShareASale by merchant category | Low | `Badge` or `GlassPill` | Small tags under card title. 1-3 per card |
| Filter/search for deals | Aspire: search by brand, filter by compensation + category + network. ShareASale: filter by EPC, commission. Universal pattern | Medium | `FilterPill` (existing), `Input` (existing) | Filter pills for categories + search input. Compensation type filter |
| Empty state | Standard UX -- what to show when no deals match filters or none available | Low | None (new) | Illustration + message + CTA. "No deals match your filters" |

### Affiliates Tab

| Feature | Why Expected | Complexity | Existing Component | Notes |
|---------|-------------|------------|-------------------|-------|
| Active affiliate link cards | Impact "Create A Link" widget, Aspire "My Offers" tab, Amazon Associates link management -- every affiliate dashboard shows active links | Medium | `GlassCard` | Card per active product/link. Shows product name, link URL, stats |
| Copyable affiliate link | BetterLinks one-click copy, Impact link generation, Amazon link builder. Copy-to-clipboard is THE core affiliate interaction | Low | `Button` + `useToast` | Truncated URL + copy icon button. Toast confirmation "Link copied!" |
| Click count per link | Amazon Associates tracks clicks per link. Impact Snapshot widget. Universal metric | Low | Typography | Prominent number on card. Real-time feel (even with mock data) |
| Commission rate/amount | Amazon shows commission %, Impact shows daily earnings per link. Users need to see earning potential | Low | Typography | "12% commission" or "$2.50 per sale" |
| Available products grid | Aspire Creator Marketplace "All Projects" section, Impact "Find Your Next Campaign", Amazon product search. Browse-to-generate pattern | Medium | `GlassCard` | Grid of products user CAN generate links for. "Generate Link" CTA |
| Generate link action | Impact "Create A Link" widget is a quick-action. Amazon has link builder. Core conversion action | Low | `Button` | Primary CTA on available product cards. Simulates link generation |
| Product image/thumbnail | Amazon product images, Impact brand logos on campaigns. Visual identification | Low | Image element | Small thumbnail (48-64px) or brand logo on each card |
| Link status indicator | Active vs expired vs paused. Standard in affiliate management UIs | Low | `Badge` (existing) | Active (success), Expired (error), Paused (warning) |

### Earnings Tab

| Feature | Why Expected | Complexity | Existing Component | Notes |
|---------|-------------|------------|-------------------|-------|
| Summary stat cards | Aspire: Commission Earned, Total Paid, Pending, Total Due. Impact: Finance Widget with daily/pending/balance. Amazon: Consolidated Summary of Earnings. Universal top-of-page pattern | Medium | `GlassCard` (stats variant exists in Brand Bible) | 3-4 cards in a row. Total Earned, Pending, Paid, This Month |
| Earnings chart | Impact Snapshot widget with date range. YouTube affiliate metrics chart. Amazon daily earnings graph. Visual trend is expected | High | New (Recharts) | Area or bar chart showing earnings over time. 7d/30d/90d toggle |
| Period selector/filter | Impact Snapshot date range selector. Amazon monthly summary. YouTube time period filter. Standard analytics pattern | Low | `GlassPill` group or `Tabs` | "7 Days", "30 Days", "90 Days", "All Time" pill group |
| Earnings breakdown by source | Amazon shows earnings by program. YouTube shows per-product breakdown. Understanding WHERE money comes from | Medium | Table or card list | List of deals/links with individual earnings. Sortable |

---

## Differentiators

Features that would make Virtuna's brand deals page stand out compared to standard creator platforms. Not expected, but impressive when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Glassmorphic deal cards with brand color tinting | No creator platform uses glassmorphism. Standard platforms (Aspire, Impact) use flat white/gray cards. Virtuna's glass aesthetic applied to deal cards would be visually distinctive | Medium | Use `GlassCard` with `tint` prop matching brand/category color. Orange for creative, green for wellness, etc. |
| Tiered commission progress bar | Aspire's "Details" tab shows tiered commission with progress bars and "next milestone" indicator. Most platforms lack this. Shows growth/gamification | Medium | Progress bar component. "Level 2: $500/$1000 -- Next: 18% commission" |
| Animated stat cards with count-up | Earnings stat cards that animate values on mount. Adds premium feel vs static numbers | Low | `framer-motion` animate. countUp effect on numbers |
| Deal match score | Leverage Virtuna's AI positioning -- show how well a deal matches the creator's audience/content. No competitor does this well | Medium | Small ring/score indicator on deal card. "92% match" with tooltip |
| Ambient glow behind featured deals | "Boosted" or featured deals get `GradientGlow` behind them, like Impact's "Boosted Product Widget" but with glassmorphic treatment | Low | `GradientGlow` component already exists. Wrap featured deal cards |
| Inline link performance sparkline | Tiny sparkline chart on each active affiliate link card showing click trend. Most platforms only show totals | Medium | Small SVG sparkline (no library needed). 30-day click trend |
| Copy link with visual feedback animation | Beyond toast -- the copy button itself transforms (checkmark, color change) before resetting. Micro-interaction polish | Low | Button state transition. Icon morphs from Copy to Check for 2s |
| Earnings chart with glass overlay style | Chart rendered inside a GlassPanel with tinted gradient beneath the area fill. Unique to Virtuna's design language | High | Recharts + custom glass styling. Gradient fill matching accent color |
| "New This Week" highlighted section | Aspire does this. A highlighted row/section at the top of Deals showing fresh opportunities | Low | Filtered subset of deals. Section header with `Badge variant="info"` |
| Deal detail slide-over panel | Instead of navigating away, clicking a deal card opens a slide-over/drawer with full details, requirements, deliverables | Medium | Would need a new `Drawer` or reuse `Dialog` component |

---

## Anti-Features

Features to deliberately NOT build for this UI-only milestone. Common in real platforms but wrong for Virtuna's scope.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real affiliate link generation/tracking | Backend infrastructure, URL shortener, click tracking server -- massive scope for UI-only milestone | Mock "Generate Link" action that adds a card to the active links list with a fake URL |
| Payment processing / PayPal integration | Aspire/Impact have PayPal, Stripe, wire transfer setup. Requires backend + financial compliance | Show mock "Payment Method: PayPal (connected)" in earnings tab. Static display only |
| Real brand/merchant API integration | ShareASale, Impact, CJ Affiliate all have merchant APIs. Not needed for UI demonstration | Hardcode 8-12 mock brand deals with realistic data. JSON fixtures |
| Application/approval workflow | Aspire has multi-step apply > review > brief > deliver flow. HubSpot has pipeline approvals | Button changes state on click (Apply > Applied). No backend state machine |
| Contract/brief signing | Aspire Creator Portal has "Review and Sign Brief" task. Legal complexity | Deal detail panel can show mock deliverables/terms as read-only text |
| Multi-currency support | Impact.com supports global currencies. Adds complexity with no UI payoff | Use USD ($) only throughout |
| Notification system for deal updates | Real platforms notify creators of new deals, approval status changes | No push notifications. Static "New" badges on fresh mock deals |
| Merchant/brand messaging | Aspire, Collabstr have in-platform messaging between creators and brands | Not in scope. No chat/messaging UI |
| Analytics export/CSV download | Amazon Associates, Impact allow report exports. Backend feature | No export buttons. Data is view-only |
| A/B link testing | Advanced affiliate feature (create multiple links for same product to test). Over-scoped | Single link per product. No variant testing |
| Promo code management | Aspire shows promo codes alongside links. Separate feature surface | Focus on affiliate links only. No promo code generation/display |
| Tax form / 1099 generation | Real affiliate platforms require tax documentation. Legal/backend | Completely out of scope. No tax-related UI |

---

## Feature Dependencies

```
Deals Tab (standalone -- no dependencies on other tabs)
  |
  +-- Brand deal card component (new)
  |     +-- Depends on: GlassCard, Badge, Button, Avatar
  |     +-- Category tags use: Badge or GlassPill
  |
  +-- Deal filter system
  |     +-- Depends on: FilterPill (existing), Input (existing)
  |     +-- New: category filter data, compensation type filter
  |
  +-- Deal detail panel (differentiator)
        +-- Depends on: Dialog or new Drawer component

Affiliates Tab (standalone)
  |
  +-- Active link card component (new)
  |     +-- Depends on: GlassCard, Badge, Button, useToast (for copy)
  |     +-- Copy interaction depends on: Clipboard API, Toast system
  |
  +-- Available products grid
  |     +-- Depends on: GlassCard, Button
  |     +-- "Generate Link" adds to active links (local state)
  |
  +-- Sparkline component (differentiator)
        +-- No dependencies (pure SVG)

Earnings Tab (depends on chart library)
  |
  +-- Summary stat cards
  |     +-- Depends on: GlassCard (stats pattern from Brand Bible)
  |     +-- Count-up animation: framer-motion (already in project)
  |
  +-- Earnings chart
  |     +-- Depends on: Recharts (new dependency) OR custom SVG
  |     +-- Period selector: GlassPill or Tabs (existing)
  |
  +-- Earnings breakdown list
        +-- Depends on: Table or card list layout

Page-Level Dependencies:
  +-- Three-tab layout: Tabs component (existing, Radix-based)
  +-- Page header with title: Typography system (existing)
  +-- Sidebar navigation item: sidebar-nav-item.tsx (existing)
  +-- Mock data fixtures: New JSON/TS files
```

---

## MVP Recommendation

For the brand deals milestone, prioritize in this order:

### Must Build (all three tabs functional)

1. **Deals tab with deal card grid** -- The primary discovery surface. 8-12 mock deals with brand logos, payouts, category tags, Apply CTA with state change, and filter pills for categories
2. **Affiliates tab with active links + available products** -- Core affiliate functionality. 4-5 active links with copy-to-clipboard + toast feedback, 6-8 available products with "Generate Link" action
3. **Earnings tab with stat cards + chart** -- Financial overview. 4 summary stat cards (Total Earned, Pending, Paid Out, This Month) + area chart with period selector

### Should Build (polish and differentiation)

4. **Glassmorphic card tinting per category** -- Low effort, high visual impact. Use existing `GlassCard` tint prop with semantic color mapping (orange for creative deals, green for wellness, etc.)
5. **Copy link micro-interaction** -- Button icon morph (Copy icon > Check icon) + toast confirmation. Leverages existing `useToast` hook
6. **Animated stat card count-up** -- Numbers animate from 0 on mount. Uses existing framer-motion
7. **"New This Week" section in Deals** -- Simple filter + section header with info badge
8. **Featured deal ambient glow** -- 1-2 deals get `GradientGlow` behind them. Existing component

### Defer to Future

- Deal detail slide-over panel (needs Drawer component)
- Tiered commission progress bar (gamification feature)
- Inline sparklines (nice-to-have polish)
- Deal match score (needs AI narrative to be meaningful)

---

## Information Architecture (from platform research)

### Deals Tab Layout (top to bottom)

```
[Page Header: "Brand Deals" + subtitle]
[Tabs: Deals | Affiliates | Earnings]
---
[Filter Row: All | Beauty | Tech | Lifestyle | Food | Fitness]
[Search Input: "Search brands..."]
---
["New This Week" section -- 2-3 featured cards with glow]
---
[Deal Card Grid -- 2-3 columns]
  [Card: Logo | Title | Description | Tags | Payout | Apply Button]
  [Card: Logo | Title | Description | Tags | Payout | Status Badge]
  ...
```

### Affiliates Tab Layout (top to bottom)

```
[Section: "Active Links" -- header + count badge]
[Active Link Cards -- 1-2 columns, wider cards]
  [Card: Product Image | Name | Link (truncated) | Copy Button | Clicks | Commission | Status]
  ...
---
[Section: "Available Products" -- header]
[Product Grid -- 2-3 columns]
  [Card: Product Image | Name | Commission Rate | "Generate Link" Button]
  ...
```

### Earnings Tab Layout (top to bottom)

```
[Summary Stat Cards -- 4 columns on desktop, 2 on mobile]
  [Total Earned] [Pending] [Paid Out] [This Month]
---
[Period Selector: 7D | 30D | 90D | All]
[Earnings Area Chart -- full width]
---
[Breakdown Section: "Earnings by Source"]
[Table/List: Deal Name | Clicks | Conversions | Earnings | Status]
```

---

## Card Anatomy (from cross-platform research)

### Deal Card (based on Aspire, Impact, Collabstr patterns)

```
+---------------------------------------+
|  [Brand Logo]  Brand Name             |
|                                       |
|  Deal Title / Campaign Name           |
|  Brief description of the offer...    |
|                                       |
|  [Beauty] [Instagram]   <- tags       |
|                                       |
|  $500 flat fee          [Apply]       |
|  -- or --                             |
|  15% commission         [Applied]     |
+---------------------------------------+
```

Key decisions from research:
- **Brand logo top-left** (Aspire, Impact pattern)
- **Payout bottom-left, CTA bottom-right** (standard card action pattern)
- **Tags between description and payout** (Aspire category + network pattern)
- **Status badge replaces CTA** when already applied (HubSpot deal card pattern)

### Active Affiliate Link Card (based on Amazon Associates, Impact, BetterLinks)

```
+-------------------------------------------------------+
|  [Product Image]  Product Name           [Active]      |
|                   https://vrt.na/af/x8k... [Copy]      |
|                                                        |
|  Clicks: 1,247    Conversions: 89    Commission: $445  |
+-------------------------------------------------------+
```

Key decisions from research:
- **Horizontal layout** (wider cards for link display -- Amazon, BetterLinks pattern)
- **Copy button inline with URL** (BetterLinks one-click copy pattern)
- **Stats row at bottom** (Amazon Associates metrics pattern)
- **Status badge top-right** (standard indicator position)

### Earnings Stat Card (based on Aspire, Impact Finance Widget, Brand Bible stats pattern)

```
+-------------------+
|  Total Earned      |  <- label (caption size, secondary text)
|  $12,450          |  <- value (H2 size, bold, primary text)
|  +12.5% vs last   |  <- change indicator (caption, green/red)
+-------------------+
```

Key decisions from research:
- **Follow Brand Bible stats card pattern** exactly (already documented)
- **Green for positive change, red for negative** (Brand Bible: green = growth/success)
- **4 cards in a row** (Aspire shows 7 metrics, but 4 is cleaner for glassmorphic cards)

---

## Color Semantics for Brand Deals (per Brand Bible rules)

| Element | Color | Rationale (Brand Bible rule) |
|---------|-------|------------------------------|
| Earnings/money values | Green (`gradient-green`) | "Green for positive -- Growth, success, earnings" |
| Deal cards default tint | Orange (`gradient-orange`) | "Orange for content creation -- Creativity" |
| Analytics/click metrics | Blue (`gradient-blue`) | "Blue for data -- Analytics, charts, metrics" |
| AI match score (if built) | Purple (`gradient-purple`) | "Purple for AI -- Anything AI/ML powered" |
| CTA buttons | Coral (#E57850) | Primary accent for CTAs |
| Status badges | Semantic variants | success/warning/error/info per existing Badge |

---

## Sources

### Platform Documentation (HIGH confidence)
- [Aspire Creator Portal Overview](https://help.aspireiq.com/en/articles/6565403-creator-portal-overview)
- [Aspire Creator Marketplace](https://help.aspireiq.com/en/articles/6023393-overview-of-aspire-s-creator-marketplace)
- [Aspire Affiliate Performance Dashboard](https://help.aspireiq.com/en/articles/6143584-affiliate-performance-dashboard)
- [Impact.com Partner Dashboard Widgets](https://help.impact.com/en/support/solutions/articles/48001235447-partner-dashboard-widgets-explained)
- [Amazon Associates Dashboard](https://affiliate-program.amazon.com/help/node/topic/GMWAK55DQX8JEK7C)
- [YouTube Affiliate Metrics](https://support.google.com/youtube/answer/16322165)

### Ecosystem Research (MEDIUM confidence)
- [Tapfiliate: Affiliate Marketing Platforms 2026](https://tapfiliate.com/blog/affiliate-marketing-platforms-for-growing-brands-cck/)
- [Shopify: Affiliate Marketing Metrics 2026](https://www.shopify.com/blog/affiliate-marketing-metrics)
- [InfluenceFlow: Brand & Creator Management 2026](https://influenceflow.io/resources/platform-solutions-for-brand-and-creator-management-complete-2026-guide/)

### UI/UX Patterns (MEDIUM confidence)
- [Baymard: Dashboard Cards Consistency](https://baymard.com/blog/cards-dashboard-layout)
- [Eleken: Card UI Design Examples](https://www.eleken.co/blog-posts/card-ui-examples-and-best-practices-for-product-owners)
- [Mobbin: Toast UI Design Best Practices](https://mobbin.com/glossary/toast)
- [DesignRush: Dashboard Design Principles 2026](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
