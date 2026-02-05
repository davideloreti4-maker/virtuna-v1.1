# Technology Stack: Brand Deals & Affiliate Page UI

**Project:** Virtuna v2.3 -- Brand Deals & Affiliate Page
**Researched:** 2026-02-05
**Mode:** Stack additions for new UI milestone
**Overall confidence:** HIGH

## Executive Finding

**Zero new dependencies required.** Every capability needed for the brand deals page is already installed or available as a browser API. This milestone is a pure UI composition exercise using existing design system components, Recharts (already in `package.json`), the native Clipboard API (already used in two components), and the existing Radix-based Tabs component.

---

## Existing Stack (Already Installed -- DO NOT Re-add)

These are already in `package.json` and directly relevant to this milestone:

| Technology | Version | Purpose for Brand Deals | Confidence |
|------------|---------|-------------------------|------------|
| `recharts` | `^3.7.0` | Earnings chart (AreaChart / LineChart) | HIGH |
| `@radix-ui/react-tabs` | `^1.1.13` | Three-tab layout (Deals / Affiliates / Earnings) | HIGH |
| `framer-motion` | `^12.29.3` | Tab content transitions, card entrance animations | HIGH |
| `@phosphor-icons/react` | `^2.1.10` | Copy icon, deal status icons, category icons | HIGH |
| `lucide-react` | `^0.563.0` | Supplementary icons (TrendingUp, DollarSign, etc.) | HIGH |
| `class-variance-authority` | `^0.7.1` | Deal card variant styling (active/expired/pending) | HIGH |
| `clsx` + `tailwind-merge` | latest | Conditional class composition | HIGH |

### Recharts 3.7.0 Details

Recharts 3.7.0 is the latest stable release (published ~January 2026). It is already declared in `package.json` but not yet used in any component. Key facts:

- **React 19 compatible** -- works with the project's React 19.2.3
- **"use client" required** -- Recharts renders SVG and must be in a client component
- **Relevant components for earnings chart:** `AreaChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Legend`
- **Custom tooltip support** -- accepts a React component via `content` prop on `<Tooltip>`, enabling glassmorphic tooltip styling that matches the design system
- **Gradient fills** -- supports SVG `<defs>` and `<linearGradient>` for coral-to-transparent area fills

**Source:** [Recharts GitHub releases](https://github.com/recharts/recharts/releases), [npm registry](https://www.npmjs.com/package/recharts), [Recharts docs](https://recharts.github.io/en-US/)

---

## Capability 1: Charting (Earnings Chart)

### Recommendation: Use existing `recharts@^3.7.0`

**Why Recharts (already installed):**
- Already in `package.json` -- zero bundle size increase from adding a dependency
- Recharts 3.x is the most popular React chart library with native component composition
- SVG-based rendering matches the design system's precision approach
- Custom tooltip and legend support enables glassmorphic styling
- `ResponsiveContainer` handles responsive sizing automatically

**What to build:**
- An `EarningsChart` client component using `AreaChart` with a coral gradient fill
- Custom `GlassTooltip` component passed via `<Tooltip content={<GlassTooltip />} />`
- Time-series X axis (months), currency Y axis with `$` formatter

**Alternatives NOT recommended:**

| Library | Why Not |
|---------|---------|
| Tremor | Built on Recharts anyway; adds ~50KB for opinionated high-level APIs we don't need since we have our own design system |
| Nivo | D3-based, heavier bundle (~100KB+), overkill for a single area chart |
| Chart.js / react-chartjs-2 | Canvas-based (not SVG), harder to style consistently with glassmorphic CSS |
| Visx (Airbnb) | Low-level D3 primitives, too much boilerplate for a simple earnings chart |

**Confidence:** HIGH -- Recharts is already installed and v3.7.0 is current.

---

## Capability 2: Copy-to-Clipboard

### Recommendation: Use native `navigator.clipboard.writeText()` -- NO library needed

**Why native API:**
- Already used in two project components:
  - `src/app/(marketing)/showcase/_components/copy-button.tsx` -- uses `navigator.clipboard.writeText()`
  - `src/components/app/simulation/share-button.tsx` -- same pattern
- The Clipboard API is supported in all modern browsers (Chrome 66+, Firefox 63+, Safari 13.1+)
- Works on localhost (secure context) and HTTPS
- Total implementation: ~10 lines of code

**What to build:**
- Extract a reusable `useCopyToClipboard` hook in `src/hooks/useCopyToClipboard.ts`
- Pattern: `const { copy, copied } = useCopyToClipboard({ resetDelay: 2000 })`
- Used by affiliate link cards to copy links with visual feedback
- Pair with existing `useToast()` for "Copied!" confirmation toast

**Hook implementation pattern (already proven in codebase):**
```typescript
// src/hooks/useCopyToClipboard.ts
export function useCopyToClipboard(options?: { resetDelay?: number }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), options?.resetDelay ?? 2000);
      return true;
    } catch {
      return false;
    }
  }, [options?.resetDelay]);

  return { copy, copied };
}
```

**Alternatives NOT recommended:**

| Library | Why Not |
|---------|---------|
| `clipboard-copy` npm | 1KB package wrapping a 3-line browser API -- unnecessary |
| `react-copy-to-clipboard` | Adds render-prop abstraction over the same `navigator.clipboard` API |
| `usehooks-ts` `useCopyToClipboard` | Would add entire usehooks-ts package for one hook |

**Confidence:** HIGH -- native API already proven in two project components.

**Source:** [MDN Navigator.clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard)

---

## Capability 3: Tab Component

### Recommendation: Use existing `Tabs` / `CategoryTabs` components -- NO changes needed

**Why existing components:**
- `src/components/ui/tabs.tsx` -- Full Radix-based tab system with Raycast glass pill styling, already exported: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, with `sm/md/lg` size variants
- `src/components/ui/category-tabs.tsx` -- Higher-level `CategoryTabs` with icon + count badge support, horizontal scrolling, controlled/uncontrolled modes
- Both are built on `@radix-ui/react-tabs@1.1.13` with full a11y (arrow key nav, roving tabindex, ARIA roles)

**Which to use for brand deals:**
- **`CategoryTabs`** is the best fit for the Deals / Affiliates / Earnings three-tab layout because:
  - Supports icons per tab (can use Phosphor icons for each section)
  - Supports count badges (e.g., "Deals (12)")
  - Already handles controlled/uncontrolled state
  - Matches existing app patterns

**Example usage:**
```tsx
const tabs = [
  { value: "deals", label: "Deals", icon: <Handshake />, count: 12 },
  { value: "affiliates", label: "Affiliates", icon: <Link />, count: 8 },
  { value: "earnings", label: "Earnings", icon: <CurrencyDollar /> },
];

<CategoryTabs categories={tabs} defaultValue="deals">
  <TabsContent value="deals">...</TabsContent>
  <TabsContent value="affiliates">...</TabsContent>
  <TabsContent value="earnings">...</TabsContent>
</CategoryTabs>
```

**Alternatives NOT recommended:**

| Approach | Why Not |
|----------|---------|
| Build new tab component | Existing `CategoryTabs` already has the exact pattern needed |
| Use URL-based routing tabs | Overkill for a single page with three views; client-side state is simpler |
| Headless UI tabs | Already have Radix tabs installed and styled |

**Confidence:** HIGH -- components exist, are tested, and match the use case exactly.

---

## Capability 4: Additional UI Utilities

### 4a. Number/Currency Formatting

**Recommendation:** Use native `Intl.NumberFormat` -- NO library needed

```typescript
// Format currency
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

// Format compact numbers (1.2K, 3.5M)
const formatCompact = (value: number): string =>
  new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
```

Use for: earnings stat cards, chart axis labels, deal values.

### 4b. Date Formatting

**Recommendation:** Use native `Intl.DateTimeFormat` -- NO library needed

The earnings chart X axis needs month labels. `Intl.DateTimeFormat` handles this:

```typescript
const formatMonth = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
```

**Why NOT date-fns/dayjs:** This milestone uses mock data with simple date strings. `Intl.DateTimeFormat` handles everything needed. If date manipulation becomes complex in a future backend milestone, consider adding `date-fns` then.

### 4c. Toast Feedback

**Already available:** `src/components/ui/toast.tsx` provides `useToast()` with variant support (success, error, info). Use for "Link copied!" feedback after clipboard copy.

### 4d. Card Components

**Already available:** `src/components/primitives/GlassCard.tsx` and `src/components/ui/card.tsx` provide the glassmorphic card foundation. Deal cards and affiliate link cards should compose these.

### 4e. Badge/Status Components

**Already available:** `src/components/ui/badge.tsx` for deal status indicators (Active, Pending, Expired). `src/components/primitives/GlassPill.tsx` for category tags.

### 4f. Progress Indicators

**Already available:** The design system includes progress components for displaying earnings progress toward goals.

---

## What NOT to Add

| Tempting Addition | Why Skip |
|-------------------|----------|
| `date-fns` or `dayjs` | Mock data only; `Intl.DateTimeFormat` suffices for display |
| `react-query` / `@tanstack/query` | UI-only milestone with mock data; no data fetching |
| `chart.js` or `nivo` | Recharts already installed, lighter, better React integration |
| `clipboard-copy` npm | Browser API is 3 lines, already used in project |
| `react-number-format` | `Intl.NumberFormat` covers all formatting needs |
| `@radix-ui/react-tooltip` | Not needed; Recharts has built-in tooltip, and simple `title` attrs suffice elsewhere |
| State management additions | Zustand already installed; brand deals mock data is page-local state |
| Form libraries | No forms in this milestone (UI display only) |

---

## Mock Data Strategy

Since this is a UI-only milestone, define TypeScript interfaces and mock data in a dedicated file:

```
src/lib/mock-brand-deals.ts
```

Interfaces needed:
- `BrandDeal` -- id, brand name, logo URL, status, value, dates, description
- `AffiliateLink` -- id, platform, url, code, clicks, conversions, commission
- `EarningsSummary` -- total, thisMonth, lastMonth, growth percentage
- `EarningsDataPoint` -- date, amount (for chart)

**Confidence:** HIGH -- follows existing pattern in `src/lib/mock-data.ts` and `src/lib/mock-societies.ts`.

---

## Installation

```bash
# Nothing to install. All dependencies are already in package.json.
# Just run:
pnpm install  # or npm install
```

If `node_modules` are not yet populated (recharts shows in package.json but not in node_modules):
```bash
pnpm install
```

---

## Integration Points with Existing Stack

| Existing Component | How Brand Deals Uses It |
|--------------------|------------------------|
| `CategoryTabs` | Three-tab layout container |
| `GlassCard` / `Card` | Deal cards, affiliate link cards, stat cards |
| `Badge` | Deal status (Active/Pending/Expired) |
| `GlassPill` | Category tags on deals |
| `Button` | CTA buttons, copy buttons |
| `useToast()` | "Copied!" feedback |
| `Icon` (Phosphor) | Section icons, action icons |
| `Typography` | Headings, labels, values |
| `Spinner` | Loading states (if any) |
| `framer-motion` | Tab content transitions, card stagger entrance |
| `Skeleton` | Loading placeholder states |

---

## File Structure Recommendation

```
src/
  components/
    app/
      brand-deals/
        brand-deals-page.tsx        # Main page with CategoryTabs
        deals-tab.tsx               # Deals grid content
        affiliates-tab.tsx          # Affiliates list content
        earnings-tab.tsx            # Earnings summary + chart
        deal-card.tsx               # Individual deal card
        affiliate-link-card.tsx     # Affiliate link with copy button
        earnings-chart.tsx          # Recharts AreaChart (client component)
        earnings-stat-card.tsx      # Summary stat card
  hooks/
    useCopyToClipboard.ts           # Extracted reusable hook
  lib/
    mock-brand-deals.ts             # TypeScript interfaces + mock data
    format.ts                       # Currency/number formatters (optional utility file)
```

---

## Sources

- [Recharts GitHub Releases](https://github.com/recharts/recharts/releases) -- confirmed v3.7.0 is latest
- [Recharts npm](https://www.npmjs.com/package/recharts) -- version and peer dependencies
- [Recharts Documentation](https://recharts.github.io/en-US/) -- v3.7.0 API reference
- [Recharts 3.0 Migration Guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- breaking changes from 2.x
- [MDN Navigator.clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard) -- browser clipboard API
- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) -- v1.1.13 component docs
- [Radix Tabs npm](https://www.npmjs.com/package/@radix-ui/react-tabs) -- version confirmation
- Project codebase: `package.json`, `src/components/ui/tabs.tsx`, `src/components/ui/category-tabs.tsx`, `src/app/(marketing)/showcase/_components/copy-button.tsx`, `src/components/app/simulation/share-button.tsx`
