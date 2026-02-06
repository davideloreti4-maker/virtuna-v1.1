# Phase 56: Earnings Tab - Research

**Researched:** 2026-02-06
**Domain:** Recharts AreaChart, count-up animation via motion hooks, period selector, Intl.NumberFormat, dark-theme charting
**Confidence:** HIGH

## Summary

This phase builds the EarningsTab component with three sections: (1) a 2x2 grid of stat cards with count-up animation, (2) a coral/orange-themed Recharts AreaChart with gradient fill and period selection, and (3) a per-source earnings breakdown list. All data comes from existing mock fixtures (`MOCK_EARNINGS_SUMMARY` in `src/lib/mock-brand-deals.ts`) which already contain `totalEarned`, `pendingPayout`, `paidOut`, `thisMonth`, `monthlyBreakdown[]`, and `topSources[]`.

The count-up animation uses motion's built-in `useMotionValue` + `useTransform` + `animate` -- no new dependency needed. The chart uses Recharts 3.7.0 (already installed) with SVG `<linearGradient>` for the coral area fill. The period selector reuses the sliding pill pattern from `BrandDealsTabs` (Phase 53). The existing `formatCurrency` and `formatNumber` utilities from `affiliate-utils.ts` handle all monetary formatting. The `usePrefersReducedMotion` hook already exists at `src/hooks/usePrefersReducedMotion.ts` for accessibility.

**Primary recommendation:** Zero new dependencies. Build EarningsTab as a container component with four presentational children: `EarningsStatCards`, `EarningsPeriodSelector`, `EarningsChart`, and `EarningsBreakdownList`. Use the motion `animate` function for count-up, Recharts `AreaChart` with coral gradient for the chart, and derive period-filtered data from the existing `MOCK_EARNINGS_SUMMARY` fixture.

## Standard Stack

### Core (already installed -- NO new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | 3.7.0 | AreaChart with gradient fill, custom tooltip, responsive container | Already installed, most popular React chart library, SVG-based |
| `motion` (motion/react) | ^12.29.2 | Count-up animation via `useMotionValue` + `useTransform` + `animate` | Already used across codebase, zero new dependency |
| `@phosphor-icons/react` | ^2.1.10 | Stat card icons (CurrencyDollar, Wallet, ArrowUp, etc.) | Codebase standard icon library |
| `react` | 19.2.3 | `useMemo`, `useState`, `useEffect` for data derivation | Framework |
| Tailwind CSS | v4 | Dark theme styling, responsive grid | Codebase standard |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` + `tailwind-merge` | latest | `cn()` utility for conditional classes | Every component |
| `class-variance-authority` | ^0.7.1 | Variant styling if stat cards need size/color variants | Optional |

### No New Dependencies Required

All capabilities are available from existing installations and browser APIs:
- Count-up animation: `motion/react` hooks (already installed)
- Charting: `recharts` (already installed)
- Number formatting: `Intl.NumberFormat` (browser API, already wrapped in `affiliate-utils.ts`)
- Reduced motion detection: `usePrefersReducedMotion` hook (already exists)
- Period selector animation: `motion/react` `layoutId` (same pattern as `BrandDealsTabs`)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| motion `animate` for count-up | `react-countup` npm | Adds ~7KB dependency for something achievable in ~15 lines with existing motion |
| motion `animate` for count-up | `AnimateNumber` (Motion+) | Requires paid Motion+ membership, adds `motion-plus` package |
| motion `animate` for count-up | Custom `requestAnimationFrame` hook | More boilerplate, no easing functions built in, motion already installed |
| Custom period-filtered mock data | Real API calls | Out of scope -- UI-only milestone |

## Architecture Patterns

### Recommended Project Structure

```
src/components/app/brand-deals/
  earnings-tab.tsx              # Container: manages period state, derives filtered data
  earnings-stat-cards.tsx       # Presentational: 2x2 grid of stat cards with count-up
  earnings-chart.tsx            # Presentational: Recharts AreaChart wrapper
  earnings-period-selector.tsx  # Presentational: sliding pill period selector
  earnings-breakdown-list.tsx   # Presentational: per-source breakdown table/list
```

### Pattern 1: Container/Presentational Split (established in Phase 55)

**What:** `EarningsTab` is the container that owns period state and derives filtered data. It passes data down to four presentational children.
**When to use:** When a section has multiple UI components that share derived state.
**Source:** Existing `AffiliatesTab` and `DealsTab` patterns in `/src/components/app/brand-deals/`

```typescript
// earnings-tab.tsx (Container)
"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MOCK_EARNINGS_SUMMARY } from "@/lib/mock-brand-deals";

type Period = "7d" | "30d" | "90d" | "all";

export function EarningsTab() {
  const [period, setPeriod] = useState<Period>("30d");

  // Derive period-filtered data from mock
  const filteredData = useMemo(() => {
    return filterEarningsByPeriod(MOCK_EARNINGS_SUMMARY, period);
  }, [period]);

  return (
    <div className="space-y-6">
      <EarningsStatCards stats={filteredData.stats} />
      <div>
        <EarningsPeriodSelector activePeriod={period} onPeriodChange={setPeriod} />
        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EarningsChart data={filteredData.chartData} />
          </motion.div>
        </AnimatePresence>
      </div>
      <EarningsBreakdownList sources={filteredData.sources} />
    </div>
  );
}
```

### Pattern 2: Count-Up Animation with Motion Hooks

**What:** Use `useMotionValue(0)` + `useTransform(count, Math.round)` + `animate(count, target, { duration: 2 })` for smooth number animation. Respect `prefers-reduced-motion` by checking `usePrefersReducedMotion()` and skipping animation if true.
**When to use:** Stat card values that should animate on mount.
**Source:** motion.dev docs (useMotionValue, useTransform, animate APIs)

```typescript
// useCountUp.ts (custom hook)
"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface UseCountUpOptions {
  /** Target value to count up to */
  to: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Format function applied to the rounded value */
  format?: (value: number) => string;
}

export function useCountUp({ to, duration = 2, format }: UseCountUpOptions) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    const val = Math.round(latest);
    return format ? format(val) : val.toString();
  });

  useEffect(() => {
    if (prefersReducedMotion) {
      count.jump(to);
      return;
    }
    const animation = animate(count, to, {
      duration,
      ease: "easeOut",
    });
    return () => animation.stop();
  }, [to, duration, prefersReducedMotion, count]);

  return rounded;
}
```

### Pattern 3: Recharts AreaChart with Coral Gradient (Dark Theme)

**What:** AreaChart wrapped in ResponsiveContainer, with SVG `<linearGradient>` using coral color, dark-themed axes, and custom tooltip.
**When to use:** Earnings chart visualization.
**Source:** Recharts 3.7.0 docs (AreaChart, linearGradient, custom Tooltip)

```typescript
// earnings-chart.tsx
"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { formatCurrency } from "@/lib/affiliate-utils";

interface EarningsChartProps {
  data: { month: string; amount: number }[];
}

export function EarningsChart({ data }: EarningsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF7F50" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#FF7F50" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          horizontal={true}
          vertical={false}
          stroke="rgba(255, 255, 255, 0.04)"
        />
        <XAxis
          dataKey="month"
          tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 12 }}
          axisLine={{ stroke: "rgba(255, 255, 255, 0.06)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip content={<EarningsTooltip />} cursor={false} />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#FF7F50"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#earningsGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 4: Period Selector with Sliding Pill (reuse BrandDealsTabs pattern)

**What:** Reuse the `motion.div` `layoutId` sliding pill pattern from `BrandDealsTabs` for the period selector pills (7D, 30D, 90D, All Time).
**When to use:** Any pill/segment selector that needs animated sliding indicator.
**Source:** Existing `src/components/app/brand-deals/brand-deals-tabs.tsx`

```typescript
// earnings-period-selector.tsx
"use client";

import { motion } from "motion/react";

type Period = "7d" | "30d" | "90d" | "all";

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All Time" },
];

interface EarningsPeriodSelectorProps {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
}

export function EarningsPeriodSelector({
  activePeriod,
  onPeriodChange,
}: EarningsPeriodSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-elevated/50 p-1">
      {PERIODS.map((p) => {
        const isActive = activePeriod === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onPeriodChange(p.value)}
            className="relative rounded-full px-3 py-1 text-xs font-medium outline-none"
          >
            {isActive && (
              <motion.div
                layoutId="earnings-period-pill"
                className="absolute inset-0 z-0 rounded-full border border-white/10 bg-white/10"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`relative z-10 ${
              isActive ? "text-foreground" : "text-foreground-muted"
            }`}>
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

### Pattern 5: Solid Dark Tooltip (Raycast Modal Style)

**What:** Custom Recharts tooltip with solid opaque dark background (NOT glassmorphic). Matches Raycast modal styling: solid bg, inset shadow, border.
**When to use:** Chart tooltip hover interaction.
**Source:** CONTEXT.md decision: "solid dark card (opaque bg like Raycast modals, NOT glassmorphic blur)"

```typescript
// Inside earnings-chart.tsx
function EarningsTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-lg border border-white/[0.08] px-3 py-2"
      style={{
        background: "#222326",
        boxShadow: "rgba(255,255,255,0.1) 0 1px 0 0 inset, 0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatCurrency(payload[0].value ?? 0)}
      </p>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Using `framer-motion` import path:** Codebase uses `motion/react`. Always `import { ... } from "motion/react"`.
- **Using React state for count-up animation:** Motion values (`useMotionValue`) bypass React state, avoiding re-renders on every animation frame. Don't use `useState` + `setInterval` for counting.
- **Hardcoding colors in chart SVG:** Use design token values (`#FF7F50` for coral, `rgba(255,255,255,0.04)` for grid). Reference globals.css token values by name/hex.
- **Adding `backdrop-filter` to tooltip:** CONTEXT.md explicitly says solid opaque bg, NOT glassmorphic. Use `bg: #222326` not glass blur.
- **Rendering chart in a server component:** Recharts uses SVG and browser APIs -- must be `"use client"`.
- **Adding `legend` to chart:** Single area with known semantics (earnings) does not need a legend. Keep it minimal per Raycast aesthetic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Count-up animation | `useState` + `setInterval` loop | `useMotionValue` + `animate` from `motion/react` | Motion handles easing, cleanup, and doesn't trigger React re-renders |
| Number formatting | Manual `$` + `.toLocaleString()` | `formatCurrency()` from `affiliate-utils.ts` | Already exists, uses `Intl.NumberFormat` properly |
| Reduced motion detection | Manual `matchMedia` listener | `usePrefersReducedMotion()` from `src/hooks/` | Already exists with SSR-safe defaults |
| Sliding pill indicator | CSS position + width calculation | `motion.div` with `layoutId` | Auto-measures, auto-animates, already proven in `BrandDealsTabs` |
| Chart responsive sizing | Manual resize observer | `<ResponsiveContainer>` from Recharts | Built-in, handles all edge cases |
| Period data filtering | Complex date arithmetic | Simple array slice on mock `monthlyBreakdown` | Mock data only has 6 months, simple index math suffices |

**Key insight:** Every capability needed is already installed. This phase is pure composition -- wiring existing hooks, components, and utilities into a new tab view.

## Common Pitfalls

### Pitfall 1: Count-Up Fires Every Tab Switch

**What goes wrong:** Count-up animation replays every time user switches away from and back to the Earnings tab.
**Why it happens:** `Tabs.Content` with `forceMount` remounts the content when tab changes, retriggering `useEffect`.
**How to avoid:** The `BrandDealsPage` already uses `forceMount={currentTab === "earnings" ? true : undefined}`, which only mounts when active. Since `AnimatePresence` unmounts on tab switch, the count-up will replay -- which is actually the desired behavior (fresh entrance animation). If NOT desired, lift the animation-complete state to the parent.
**Warning signs:** Values visibly "reset to 0" and animate up again when switching back to Earnings.

### Pitfall 2: Recharts Gradient ID Collision

**What goes wrong:** If multiple chart instances share the same `<linearGradient id="earningsGradient">`, only one gradient renders correctly.
**Why it happens:** SVG `id` attributes are global within the document.
**How to avoid:** Use a unique, descriptive gradient ID (e.g., `earnings-area-gradient`). Since only one chart exists in this tab, collision is unlikely, but prefix with component context for safety.
**Warning signs:** Chart gradient appears as solid fill or transparent.

### Pitfall 3: motion.span Doesn't Render MotionValue as Text

**What goes wrong:** Passing a `MotionValue<string>` directly as `{children}` to a regular `<span>` shows "[object Object]" instead of the formatted number.
**Why it happens:** Regular React elements can't render MotionValues. Only `motion.*` elements can.
**How to avoid:** Use `<motion.span>{rounded}</motion.span>` (not `<span>{rounded}</span>`). The `motion.span` component knows how to subscribe to MotionValue updates and render them.
**Warning signs:** Stat card shows "[object Object]" or doesn't update.

### Pitfall 4: Chart Area Has No Visible Fill on Dark Background

**What goes wrong:** The coral gradient fill is invisible because `stopOpacity` is too low on the dark `#07080a` background.
**Why it happens:** Opacity values tuned for light backgrounds don't work on dark backgrounds.
**How to avoid:** Use higher opacity at top (0.3-0.4) and very low at bottom (0.02-0.05). Test visually against `#07080a` background.
**Warning signs:** Chart shows only the stroke line, no filled area visible.

### Pitfall 5: YAxis Cuts Off Dollar Values

**What goes wrong:** YAxis labels like "$12,000" get clipped by the chart margin.
**Why it happens:** Default left margin is too small for formatted currency strings.
**How to avoid:** Set adequate left margin on `<AreaChart margin={{ left: 10 }}>` and use compact formatting (e.g., `$12K` instead of `$12,000`) via `tickFormatter`.
**Warning signs:** Dollar signs or digits are partially hidden on the left edge.

### Pitfall 6: Period Transition Flashes White/Blank

**What goes wrong:** When switching periods, chart briefly shows empty state before new data renders.
**Why it happens:** `AnimatePresence mode="wait"` unmounts old content before mounting new, creating a brief gap.
**How to avoid:** Use `mode="wait"` with short duration (200ms) and ensure the new content renders immediately (no async data loading -- it's all mock data). The fade transition masks the swap.
**Warning signs:** Visible flash or content jump between period switches.

## Code Examples

### Count-Up Stat Card (Verified Pattern)

```typescript
// Source: motion.dev docs (useMotionValue + animate) + existing usePrefersReducedMotion hook
"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatCurrency } from "@/lib/affiliate-utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  change: number; // percentage, positive or negative
  isCurrency?: boolean;
}

function StatCard({ icon, label, value, change, isCurrency = true }: StatCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const count = useMotionValue(0);
  const display = useTransform(count, (latest) =>
    isCurrency ? formatCurrency(Math.round(latest)) : Math.round(latest).toLocaleString()
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      count.jump(value);
      return;
    }
    const animation = animate(count, value, {
      duration: 2,
      ease: "easeOut",
    });
    return () => animation.stop();
  }, [value, prefersReducedMotion, count]);

  const isPositive = change >= 0;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5">
      <div className="mb-3 flex items-center gap-2 text-foreground-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <motion.span className="text-2xl font-bold text-foreground">
        {display}
      </motion.span>
      <div className={`mt-1 text-xs font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
        {isPositive ? "+" : ""}{change}%
      </div>
    </div>
  );
}
```

### Dark-Themed AreaChart with Coral Gradient

```typescript
// Source: Recharts 3.7.0 docs (AreaChart, linearGradient, custom Tooltip)
// + CONTEXT.md decisions (coral accent, solid tooltip, horizontal grid)

<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
    <defs>
      <linearGradient id="earnings-area-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#FF7F50" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#FF7F50" stopOpacity={0.02} />
      </linearGradient>
    </defs>
    <CartesianGrid
      horizontal={true}
      vertical={false}
      stroke="rgba(255, 255, 255, 0.04)"
    />
    <XAxis
      dataKey="month"
      tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 12 }}
      axisLine={{ stroke: "rgba(255, 255, 255, 0.06)" }}
      tickLine={false}
    />
    <YAxis
      tick={{ fill: "rgba(255, 255, 255, 0.4)", fontSize: 12 }}
      axisLine={false}
      tickLine={false}
      tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}K`}
      width={50}
    />
    <Tooltip content={<EarningsTooltip />} cursor={false} />
    <Area
      type="monotone"
      dataKey="amount"
      stroke="#FF7F50"
      strokeWidth={2}
      fillOpacity={1}
      fill="url(#earnings-area-gradient)"
      animationDuration={1000}
    />
  </AreaChart>
</ResponsiveContainer>
```

### Period Data Filtering (Mock Data)

```typescript
// Derive period-filtered data from MOCK_EARNINGS_SUMMARY
type Period = "7d" | "30d" | "90d" | "all";

function filterEarningsByPeriod(summary: EarningsSummary, period: Period) {
  const breakdown = summary.monthlyBreakdown;

  // Simple slice approach for mock data (6 entries total)
  const chartData = period === "7d" ? breakdown.slice(-1)
    : period === "30d" ? breakdown.slice(-2)
    : period === "90d" ? breakdown.slice(-3)
    : breakdown;

  // Stat card values scale proportionally for shorter periods
  const ratio = chartData.reduce((s, d) => s + d.amount, 0) / summary.totalEarned;

  return {
    chartData,
    stats: {
      totalEarned: Math.round(summary.totalEarned * ratio),
      pending: Math.round(summary.pendingPayout * ratio),
      paidOut: Math.round(summary.paidOut * ratio),
      thisMonth: summary.thisMonth, // always current month
    },
    sources: summary.topSources, // same sources regardless of period for mock
  };
}
```

### Existing Utilities to Reuse

```typescript
// src/lib/affiliate-utils.ts (already exists)
formatCurrency(2725)  // "$2,725"
formatNumber(5420)    // "5,420"

// src/hooks/usePrefersReducedMotion.ts (already exists)
const prefersReducedMotion = usePrefersReducedMotion();
// Returns true if user prefers reduced motion, false otherwise
// Defaults to true (reduced motion) for SSR safety
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-countup` library | `motion/react` `useMotionValue` + `animate` | 2024+ (motion v11+) | Zero new dependency, same hooks library already in bundle |
| `framer-motion` import | `motion/react` import | Late 2024 | Rebranded; codebase already migrated |
| Recharts 2.x `<Tooltip>` | Recharts 3.x `<Tooltip content={<Custom />}>` | Recharts 3.0 (2024) | Same API, improved TypeScript types |
| CSS `@media (prefers-reduced-motion)` | `usePrefersReducedMotion()` hook | Always (React pattern) | Hook already exists in codebase |

**Deprecated/outdated:**
- `framer-motion` import path: Use `motion/react` instead
- `react-countup` library: Unnecessary when motion is already installed
- `AnimateNumber` (Motion+): Paid premium component, not needed for this use case

## Open Questions

1. **Mock data granularity for 7D period**
   - What we know: `monthlyBreakdown` only has monthly data points (6 entries). A "7D" period showing a single month bar looks sparse.
   - What's unclear: Whether to generate daily mock data for 7D or just show the current month's bar.
   - Recommendation: Show the last month's data point for 7D (single point is fine for mock data). When backend is integrated later, this will use daily granularity. Document this as a known simplification.

2. **Percentage change values for stat cards**
   - What we know: CONTEXT.md says "green for positive, red for negative". `MOCK_EARNINGS_SUMMARY` doesn't include percentage change values.
   - What's unclear: Where the change percentages come from.
   - Recommendation: Add hardcoded percentage change values alongside the stat card data (e.g., `+12.5%` for totalEarned, `-3.2%` for pending). These are mock values. Keep them in the component or add to the mock fixture.

3. **Breakdown list: table rows vs stacked cards**
   - What we know: CONTEXT.md marks this as "Claude's Discretion". Columns: source name, clicks, conversions, earnings.
   - What's unclear: Which visual approach fits better.
   - Recommendation: Use table-style rows (not stacked cards) for the breakdown. A horizontal row layout with columns is more scannable for tabular data with 4 columns. Use the same `bg-white/[0.03]` stat block pattern from `AffiliateLinkCard` for visual consistency.

## Sources

### Primary (HIGH confidence)
- **Recharts 3.7.0** (`/recharts/recharts` via Context7) -- AreaChart, linearGradient, Tooltip `content` prop, CartesianGrid `horizontal`/`vertical`, XAxis/YAxis tick/axisLine styling, ResponsiveContainer, animationDuration
- **Motion** (`/websites/motion_dev` via Context7) -- `useMotionValue`, `useTransform`, `animate`, `useSpring`, `layoutId` for sliding pills
- **Codebase direct reading** (HIGH confidence):
  - `src/lib/affiliate-utils.ts` -- `formatCurrency`, `formatNumber` utilities
  - `src/hooks/usePrefersReducedMotion.ts` -- Reduced motion detection hook
  - `src/lib/mock-brand-deals.ts` -- `MOCK_EARNINGS_SUMMARY` fixture with all needed data
  - `src/types/brand-deals.ts` -- `EarningsSummary`, `MonthlyEarning`, `EarningSource` interfaces
  - `src/components/app/brand-deals/brand-deals-tabs.tsx` -- Sliding pill `layoutId` pattern
  - `src/components/app/brand-deals/brand-deals-page.tsx` -- Tab content structure, `AnimatePresence` pattern
  - `src/components/app/brand-deals/affiliates-tab.tsx` -- Container/presentational pattern reference
  - `src/components/app/brand-deals/affiliate-link-card.tsx` -- Mini KPI stat block pattern (`bg-white/[0.03]`)
  - `src/components/ui/skeleton.tsx` -- Loading skeleton with shimmer animation
  - `src/app/globals.css` -- Design tokens (coral scale, borders, surfaces, shadows)

### Secondary (MEDIUM confidence)
- [motion.dev docs - useMotionValue](https://motion.dev/docs/react-motion-value) -- count-up animation pattern with `animate`
- [motion.dev docs - useSpring](https://motion.dev/docs/react-use-spring) -- spring-based number animation alternative
- [Recharts customization patterns](https://context7.com/recharts/recharts/llms.txt) -- dark theme axis/grid styling

### Tertiary (LOW confidence)
- [buildui.com/recipes/animated-number](https://buildui.com/recipes/animated-number) -- Community pattern for count-up (confirms motion approach)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and verified in `package.json` (Recharts 3.7.0, motion 12.29.2)
- Architecture: HIGH -- Container/presentational pattern proven in Phase 55 (`AffiliatesTab`, `DealsTab`); sliding pill proven in Phase 53 (`BrandDealsTabs`)
- Count-up animation: HIGH -- motion `useMotionValue` + `animate` is documented, free, and codebase already has `usePrefersReducedMotion`
- Chart theming: HIGH -- Recharts axis/grid styling confirmed via Context7 docs; coral gradient pattern verified
- Pitfalls: HIGH -- Common issues (gradient visibility on dark bg, MotionValue rendering, SVG id collision) well-documented

**Research date:** 2026-02-06
**Valid until:** 2026-03-08 (stable -- no fast-moving dependencies)
