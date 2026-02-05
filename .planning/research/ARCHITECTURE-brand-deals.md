# Architecture: Brand Deals & Affiliate Page

**Domain:** Brand deals & affiliate page UI integration into existing Virtuna platform
**Researched:** 2026-02-05
**Confidence:** HIGH (based on direct codebase analysis, not external sources)

---

## 1. Route Structure

### Recommendation: `src/app/(app)/brand-deals/page.tsx`

**Why this path:**
- The `(app)` route group houses all authenticated pages (dashboard, settings)
- `(app)/layout.tsx` provides AppShell with sidebar, auth guard, and fonts
- Route `/brand-deals` matches the sidebar nav item ID exactly (`id: "brand-deals"` in sidebar.tsx line 33)
- Consistent with existing convention: `/dashboard`, `/settings`

**File structure:**
```
src/app/(app)/brand-deals/
  page.tsx              # Server component: metadata + BrandDealsClient render
  brand-deals-client.tsx  # Client component: tab state, mock data, interactivity
```

**Pattern precedent:** This mirrors the dashboard pattern exactly:
- `dashboard/page.tsx` -- server component with metadata, renders `<DashboardClient />`
- `dashboard/dashboard-client.tsx` -- `"use client"`, imports stores/components

**Sidebar wiring required:** The sidebar currently sets `activeNav` state on click but does NOT route. The "Brand Deals" nav item (sidebar.tsx line 33) needs to be wired to `router.push("/brand-deals")`. This is a small surgical change to `sidebar.tsx`.

### Alternative Considered: `/deals`

Shorter URL, but breaks the naming convention established by the sidebar nav item `id: "brand-deals"`. Consistency wins -- use `/brand-deals`.

---

## 2. Component Organization

### New Components Needed

All new components live in `src/components/app/brand-deals/` following the settings pattern (`src/components/app/settings/`).

| Component | Purpose | Client/Server |
|-----------|---------|---------------|
| `BrandDealsPage` | Root client component, tab orchestration | Client |
| `DealsTab` | Card grid of brand deal offers | Client |
| `DealCard` | Individual brand deal card | Client |
| `AffiliatesTab` | Active links + available products | Client |
| `AffiliateLinkCard` | Active affiliate link with copy/stats | Client |
| `ProductCard` | Available product with "Generate Link" CTA | Client |
| `EarningsTab` | Summary stats + chart | Client |
| `EarningsSummaryCard` | Individual stat card (total, monthly, pending) | Client |
| `EarningsChart` | Earnings over time chart | Client |

**Barrel export:** `src/components/app/brand-deals/index.ts` exports all components, following the settings pattern.

**Registration:** Add to `src/components/app/index.ts`:
```typescript
// Brand Deals
export * from "./brand-deals";
```

### Existing DS Components to Reuse (NO modifications needed)

| DS Component | Used For | Import Path |
|-------------|----------|-------------|
| `Tabs, TabsList, TabsTrigger, TabsContent` | Three-tab navigation (Deals / Affiliates / Earnings) | `@/components/ui` |
| `Card, CardHeader, CardContent, CardFooter` | Deal cards, stat cards | `@/components/ui` |
| `GlassCard` (ui) | Alternative for deal cards (glassmorphic variant) | `@/components/ui` |
| `Badge` | Status badges (Active, Pending, Expired, New) | `@/components/ui` |
| `Button` | Apply/Claim CTAs, Generate Link, Copy Link | `@/components/ui` |
| `Avatar` | Brand logos (with fallback to initials) | `@/components/ui` |
| `Heading, Text, Caption` | All typography | `@/components/ui` |
| `Skeleton` | Loading states | `@/components/ui` |
| `GlassCard` (primitives) | Premium stat cards with glow | `@/components/primitives` |
| `GlassPanel` | Section containers if needed | `@/components/primitives` |

### Key DS Component Mappings Per Page Element

**Deals Tab:**
```
Deal Card Layout:
  Card (or GlassCard from ui)
    CardHeader
      Avatar (brand logo, size="md")
      Heading level={4} (brand name)
      Badge variant="success" (Active) / variant="warning" (Pending)
    CardContent
      Text (offer description)
      Text size="sm" muted (commission/payout details)
    CardFooter
      Caption (deadline/expiry)
      Button variant="primary" (Apply) / Button variant="secondary" (View Details)
```

**Affiliates Tab - Active Links:**
```
Affiliate Link Card:
  Card
    CardContent
      Avatar size="sm" (product icon)
      Text (product name)
      Caption (affiliate link URL, truncated)
      Button variant="ghost" size="sm" (Copy icon)
      Badge variant="info" ("clicks" count)
      Text size="sm" (commission earned)
```

**Affiliates Tab - Available Products:**
```
Product Card:
  Card (or ExtensionCard pattern -- icon + title + description + metadata)
    CardHeader
      Avatar (product image)
      Heading level={5} (product name)
    CardContent
      Text size="sm" muted (description)
      Caption (commission rate)
    CardFooter
      Button variant="primary" ("Generate Link")
```

**Earnings Tab - Summary:**
```
Stat Card:
  GlassCard (primitives) with color="green" glow tinted
    Heading level={4} (stat label: "Total Earnings")
    Heading level={2} (stat value: "$12,450")
    Caption (period or change indicator)
    Badge variant="success" ("+12% vs last month")
```

**Earnings Tab - Chart:**
```
Chart Container:
  Card
    CardHeader
      Heading level={4} ("Earnings Over Time")
      Caption ("Last 6 months")
    CardContent
      [Chart component -- see Section 5 below]
```

### Component NOT to Reuse

| Component | Why Not |
|-----------|---------|
| `ExtensionCard` | Close match but its fixed layout (icon-top, title, description, gradient glow) is designed for extension/feature cards. Deal cards need brand logo LEFT, offer details RIGHT, CTA BOTTOM. Better to compose with `Card` + `Avatar` + `Badge` + `Button`. |
| `CategoryTabs` | Tempting but it hardcodes horizontal scroll and specific styling. The brand deals page needs the standard `Tabs` with the three tabs (Deals / Affiliates / Earnings) -- use `Tabs` + `TabsList` + `TabsTrigger` directly. |
| `FilterPillGroup` | Dashboard-specific country filters. Not relevant for brand deals. |

---

## 3. Tab State Management

### Recommendation: URL Search Params (same as Settings)

**Pattern to follow:** `src/app/(app)/settings/page.tsx` lines 11-23

```typescript
// page.tsx (server component)
interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const VALID_TABS = ["deals", "affiliates", "earnings"] as const;
type ValidTab = (typeof VALID_TABS)[number];

export default async function BrandDealsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "deals";

  return <BrandDealsClient defaultTab={defaultTab} />;
}
```

```typescript
// brand-deals-client.tsx (client component)
"use client";

interface BrandDealsClientProps {
  defaultTab?: "deals" | "affiliates" | "earnings";
}

export function BrandDealsClient({ defaultTab = "deals" }: BrandDealsClientProps) {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Heading level={1} className="mb-8">Brand Deals</Heading>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>
        <TabsContent value="deals"><DealsTab /></TabsContent>
        <TabsContent value="affiliates"><AffiliatesTab /></TabsContent>
        <TabsContent value="earnings"><EarningsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
```

**Why URL params over alternatives:**

| Approach | Verdict | Reason |
|----------|---------|--------|
| URL search params (`?tab=deals`) | **Use this** | Established pattern (settings page), shareable URLs, SSR-friendly, back button works |
| Zustand store | No | Overkill for tab state, persists across navigation (unwanted), adds store for no reason |
| Local `useState` | No | Loses tab state on page refresh, not linkable |
| Radix `defaultValue` alone | Partial | Works but loses URL shareability; combine with search params as settings does |

---

## 4. Mock Data Approach

### Recommendation: Co-located Static TypeScript Files

**Pattern:** Create typed mock data files alongside the components.

```
src/components/app/brand-deals/
  data/
    mock-deals.ts        # Deal[] array with brand logos, offers, payouts
    mock-affiliates.ts   # AffiliateLink[] and Product[] arrays
    mock-earnings.ts     # EarningsSummary and MonthlyEarnings[] arrays
  types.ts               # BrandDeal, AffiliateLink, Product, EarningsSummary interfaces
```

**Why this approach:**

| Approach | Verdict | Reason |
|----------|---------|--------|
| Co-located TypeScript files | **Use this** | Type-safe, importable, easy to swap with API calls later, no runtime overhead |
| JSON files | No | Lose TypeScript types, need separate type definitions, harder refactoring |
| Inline data | No | Clutters component files, hard to maintain, impossible to share across components |
| Zustand store with mock data | No | No interactivity warrants a store; mock data is read-only display data |
| MSW / API mocking | No | Extreme overkill for UI-only milestone with no backend |

**Type definitions (in `types.ts`):**

```typescript
export interface BrandDeal {
  id: string;
  brand: {
    name: string;
    logo?: string;    // URL or undefined (Avatar fallback handles it)
    initials: string; // For Avatar fallback
  };
  title: string;
  description: string;
  payout: string;          // "$500" or "15% commission"
  payoutType: "flat" | "commission";
  status: "active" | "pending" | "expired" | "new";
  category: string;        // "Fashion", "Tech", etc.
  deadline?: string;       // ISO date string
  requirements?: string;
}

export interface AffiliateLink {
  id: string;
  product: {
    name: string;
    image?: string;
    initials: string;
  };
  url: string;
  clicks: number;
  conversions: number;
  commissionEarned: string;  // "$245.00"
  commissionRate: string;    // "15%"
  createdAt: string;
}

export interface AvailableProduct {
  id: string;
  name: string;
  image?: string;
  initials: string;
  description: string;
  commissionRate: string;
  category: string;
}

export interface EarningsSummary {
  totalEarnings: string;
  thisMonth: string;
  pendingPayout: string;
  changePercent: number;  // +12 or -5
}

export interface MonthlyEarnings {
  month: string;
  amount: number;
}
```

**Mock data volume:** 6-8 deals, 4-5 active affiliate links, 8-10 available products, 6 months of earnings data. Enough to demonstrate card grid layouts at various viewport widths without being excessive.

---

## 5. Earnings Chart Strategy

### Recommendation: Simple CSS/HTML Bar Chart (No Library)

For a mock-data-only milestone, a charting library (Recharts, Chart.js, etc.) is unnecessary dependency bloat.

**Approach:** Build a simple bar chart using Tailwind CSS:

```typescript
// Simplified concept
function EarningsChart({ data }: { data: MonthlyEarnings[] }) {
  const max = Math.max(...data.map(d => d.amount));
  return (
    <div className="flex items-end gap-3 h-48">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
          <div
            className="w-full rounded-t-md bg-success/60"
            style={{ height: `${(d.amount / max) * 100}%` }}
          />
          <Caption>{d.month}</Caption>
        </div>
      ))}
    </div>
  );
}
```

**Why not a chart library:**
- Zero new dependencies
- Matches glassmorphic design (chart libraries need heavy theming)
- Mock data only -- no real-time updates, tooltips, or interactions needed
- If a real chart is needed later (backend integration milestone), add Recharts then

**If the team decides a chart library IS warranted,** Recharts is the recommendation for React/Next.js (tree-shakeable, SSR-compatible, well-maintained). But defer that decision.

---

## 6. v0 MCP Integration Strategy

### How v0 Output Integrates With Existing Patterns

v0 MCP generates React components. The strategy for integration:

**Feed v0 these context files:**
1. `BRAND-BIBLE.md` -- colors, typography, spacing, glass effects
2. `docs/tokens.md` -- exact CSS custom property names
3. `docs/components.md` -- component APIs and examples
4. `docs/usage-guidelines.md` -- composition patterns

**v0 output handling:**
1. v0 generates a component (e.g., DealCard)
2. Review output for:
   - Uses `cn()` utility (not raw `clsx` or template literals)
   - Uses DS components (`Button`, `Badge`, `Card`, `Avatar`, `Heading`, `Text`, `Caption`)
   - Uses semantic tokens (`text-foreground`, `bg-surface`, `border-border`) not raw colors
   - Uses `"use client"` directive where needed
   - Follows TypeScript strict (no `any`, explicit return types for exports)
3. Adapt: replace any v0-generated custom components with DS equivalents
4. Place in `src/components/app/brand-deals/`

**What v0 should generate vs what exists:**

| Generate with v0 | Use existing (do NOT regenerate) |
|-------------------|----------------------------------|
| DealCard layout | Button (import from @/components/ui) |
| AffiliateLinkCard layout | Badge (import from @/components/ui) |
| ProductCard layout | Card, CardHeader, CardContent, CardFooter |
| EarningsSummaryCard layout | Avatar (import from @/components/ui) |
| EarningsChart | Tabs, TabsList, TabsTrigger, TabsContent |
| Page layout/composition | Heading, Text, Caption |
| | GlassCard, GlassPanel (primitives) |
| | Skeleton |

**Key instruction for v0 prompts:** "Import these components from @/components/ui -- do NOT recreate them: Button, Badge, Card, CardHeader, CardContent, CardFooter, Avatar, Heading, Text, Caption, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton. Import GlassCard and GlassPanel from @/components/primitives."

---

## 7. Data Flow Diagram

```
Route: /brand-deals?tab=deals
  |
  v
page.tsx (Server Component)
  - Reads searchParams.tab
  - Validates against VALID_TABS
  - Renders <BrandDealsClient defaultTab={validatedTab} />
  |
  v
BrandDealsClient (Client Component, "use client")
  - Receives defaultTab prop
  - Renders Tabs with three TabsContent panels
  - No Zustand store -- purely presentational
  |
  +-- DealsTab
  |     Imports: MOCK_DEALS from ./data/mock-deals
  |     Renders: Card grid of DealCard components
  |     DS: Card, Avatar, Badge, Button, Heading, Text, Caption
  |
  +-- AffiliatesTab
  |     Imports: MOCK_ACTIVE_LINKS, MOCK_PRODUCTS from ./data/mock-affiliates
  |     Renders: Two sections -- active links list + product grid
  |     DS: Card, Avatar, Badge, Button, Heading, Text, Caption
  |     Local state: useState for "copy link" feedback
  |
  +-- EarningsTab
        Imports: MOCK_SUMMARY, MOCK_MONTHLY from ./data/mock-earnings
        Renders: Three stat cards + bar chart
        DS: GlassCard (primitives), Heading, Text, Caption, Badge
```

**No stores needed.** All data is static mock data imported at the component level. The only local state is:
- Copy-to-clipboard feedback (useState in AffiliateLinkCard)
- Potential hover/interaction states (CSS-only preferred)

---

## 8. Sidebar Navigation Wiring

### Current State (sidebar.tsx lines 30-34, 56-58)

The sidebar has three nav items but they only set `activeNav` local state -- they do NOT navigate:
```typescript
const navItems = [
  { label: "Content Intelligence", icon: Lightbulb, id: "content-intelligence" },
  { label: "Trending Feed", icon: TrendUp, id: "trending-feed" },
  { label: "Brand Deals", icon: Briefcase, id: "brand-deals" },
] as const;
```

### Required Change

Map nav item IDs to routes:
```typescript
const navRoutes: Record<string, string> = {
  "content-intelligence": "/dashboard",
  "trending-feed": "/trending",  // v2.2 milestone
  "brand-deals": "/brand-deals",
};
```

Update the `SidebarNavItem` onClick to use `router.push(navRoutes[item.id])` instead of `setActiveNav(item.id)`.

Determine active state from `usePathname()` instead of local state:
```typescript
const pathname = usePathname();
const activeNav = navItems.find(item => pathname.startsWith(navRoutes[item.id]))?.id;
```

**Scope:** This is a surgical 10-15 line change to `sidebar.tsx`. It benefits ALL page routes, not just brand deals.

---

## 9. Brand Bible Color Mapping

Per BRAND-BIBLE.md section 2 color usage rules:

| Page Section | Recommended Color | Rationale |
|-------------|-------------------|-----------|
| Deal cards (general) | Neutral (no tint) | Deals are brand-agnostic chrome |
| Deal card CTA "Apply" | Coral/accent (`variant="primary"`) | Primary action, coral accent |
| Status badges | Semantic (`success`, `warning`, `error`, `info`) | Badge component handles this |
| Affiliate link cards | Neutral | Data-focused, information chrome |
| Earnings stat cards | Green (`color="green"` on GlassCard) | "Green for positive -- growth, success, earnings" |
| Earnings chart bars | `bg-success/60` | Green semantic for earnings |
| Page heading | White (`text-foreground`) | Standard |

---

## 10. Suggested Build Order

Based on dependencies and progressive complexity:

### Phase 1: Route + Tab Shell
1. Create `src/app/(app)/brand-deals/page.tsx` (server component with metadata + searchParams)
2. Create `src/components/app/brand-deals/brand-deals-page.tsx` (client, three tabs with placeholder content)
3. Create `src/components/app/brand-deals/index.ts` (barrel export)
4. Update `src/components/app/index.ts` to export brand-deals
5. Wire sidebar navigation (`sidebar.tsx` -- route on click, pathname-based active state)
6. Verify: Navigate to `/brand-deals`, tabs switch, sidebar highlights correctly

### Phase 2: Types + Mock Data
1. Create `src/components/app/brand-deals/types.ts` (all interfaces)
2. Create `src/components/app/brand-deals/data/mock-deals.ts`
3. Create `src/components/app/brand-deals/data/mock-affiliates.ts`
4. Create `src/components/app/brand-deals/data/mock-earnings.ts`

### Phase 3: Deals Tab (v0 MCP)
1. Prompt v0 for DealCard component (provide DS component APIs + BRAND-BIBLE)
2. Build DealsTab with card grid
3. Wire mock data into grid
4. Verify: Card grid renders, responsive, badges show correct variants

### Phase 4: Affiliates Tab (v0 MCP)
1. Prompt v0 for AffiliateLinkCard (active links with copy button)
2. Prompt v0 for ProductCard (available products with Generate Link CTA)
3. Build AffiliatesTab with two sections
4. Wire mock data
5. Add copy-to-clipboard interaction (navigator.clipboard API)

### Phase 5: Earnings Tab (v0 MCP)
1. Prompt v0 for EarningsSummaryCard (stat cards with GlassCard)
2. Build simple bar chart (CSS-based)
3. Build EarningsTab with stat cards + chart
4. Wire mock data
5. Verify: Green color scheme, stat cards with glow

### Phase 6: Polish + Integration
1. Loading states (Skeleton placeholders)
2. Empty states (what if no deals? no affiliates?)
3. Mobile responsiveness verification
4. Final sidebar integration testing
5. Cross-page navigation testing (dashboard -> brand-deals -> settings)

---

## 11. File Tree Summary

```
src/
  app/(app)/
    brand-deals/
      page.tsx                          # Server: metadata + searchParams -> BrandDealsClient
      brand-deals-client.tsx            # Client: tab shell with Tabs component
  components/app/
    brand-deals/
      index.ts                          # Barrel export
      brand-deals-page.tsx              # Main page component (alias for brand-deals-client usage)
      deals-tab.tsx                     # Deals card grid
      deal-card.tsx                     # Individual deal card
      affiliates-tab.tsx                # Active links + available products
      affiliate-link-card.tsx           # Active affiliate link card
      product-card.tsx                  # Available product card
      earnings-tab.tsx                  # Stat cards + chart
      earnings-summary-card.tsx         # Individual stat card
      earnings-chart.tsx                # Simple bar chart
      types.ts                          # BrandDeal, AffiliateLink, etc.
      data/
        mock-deals.ts                   # BrandDeal[] mock data
        mock-affiliates.ts              # AffiliateLink[] + AvailableProduct[] mock data
        mock-earnings.ts                # EarningsSummary + MonthlyEarnings[] mock data
```

**Files modified (existing):**
- `src/components/app/sidebar.tsx` -- Wire nav items to routes, pathname-based active state
- `src/components/app/index.ts` -- Add brand-deals barrel export

**Files NOT modified:**
- No DS components modified
- No stores added or modified
- No globals.css changes
- No layout changes

---

## 12. Anti-Patterns to Avoid

### Do NOT create a Zustand store for brand deals
Mock data is read-only. A store adds complexity with zero benefit. Import mock data directly in tab components.

### Do NOT create custom tab/card/badge components
The DS already has these. v0 MCP should compose with existing components, not recreate them.

### Do NOT add charting dependencies for mock data
A CSS bar chart is sufficient. Chart libraries (Recharts, Chart.js) can be added in a future backend-integration milestone when real data warrants interactive charts.

### Do NOT put mock data in page.tsx as inline objects
Co-locate mock data in typed files under `data/`. This makes swapping to API calls later a surgical change (replace import with fetch).

### Do NOT modify the (app) layout
The existing layout provides AppShell (sidebar + auth guard). Brand deals page should render inside `<main>` via the children prop. No layout changes needed.

---

## Sources

All findings are from direct codebase analysis (HIGH confidence):
- `src/app/(app)/layout.tsx` -- AppShell integration
- `src/app/(app)/settings/page.tsx` -- URL params tab pattern
- `src/app/(app)/dashboard/page.tsx` -- Server/client split pattern
- `src/components/app/settings/settings-page.tsx` -- Tab component usage
- `src/components/app/sidebar.tsx` -- Nav items, routing gaps
- `src/components/ui/index.ts` -- Available DS components
- `src/components/ui/tabs.tsx` -- Radix tabs API
- `src/components/ui/card.tsx` -- Card/GlassCard API
- `src/components/ui/badge.tsx` -- Badge variants
- `src/components/ui/button.tsx` -- Button variants
- `src/components/ui/avatar.tsx` -- Avatar with fallback
- `src/components/primitives/GlassCard.tsx` -- Premium card with glow
- `src/stores/sidebar-store.ts` -- Store pattern reference
- `.planning/BRAND-BIBLE.md` -- Color usage rules
- `.planning/PROJECT.md` -- v2.3 scope and constraints
