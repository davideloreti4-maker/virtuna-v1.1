# Phase 53: Foundation & Tab Shell - Research

**Researched:** 2026-02-05
**Domain:** Next.js App Router page scaffolding, Radix Tabs with URL sync, sidebar wiring, TypeScript mock data, reusable clipboard hook
**Confidence:** HIGH

## Summary

This phase creates the `/brand-deals` route with three-tab navigation (Deals / Affiliates / Earnings) synced to URL search params, sidebar integration, typed mock data fixtures, and a reusable `useCopyToClipboard` hook. The codebase already has all the building blocks: the Settings page demonstrates the server-reads-searchParams / client-orchestrates pattern, Radix Tabs is installed and wrapped in both `tabs.tsx` and `category-tabs.tsx`, the sidebar has a "Brand Deals" nav item (Briefcase icon) with `useState`-based active state, and `motion/react` (framer-motion successor) is available for the sliding pill indicator.

The key technical decisions are: (1) use `window.history.pushState` for URL sync instead of `router.push` to avoid server component re-renders, (2) use Motion's `layoutId` for the animated sliding pill tab indicator, (3) build a new `BrandDealsTabs` component rather than modifying the existing `CategoryTabs` (which is a different visual style -- scrollable list, not pill/segment control), and (4) extract clipboard logic into `src/hooks/useCopyToClipboard.ts` from the existing inline patterns in `copy-button.tsx` and `share-button.tsx`.

**Primary recommendation:** Follow the Settings page pattern exactly (server component in `page.tsx` reads `searchParams`, passes `defaultTab` to client component), but enhance with controlled Radix Tabs + `window.history.pushState` for live URL sync and browser back/forward support. Use `motion/react` `layoutId` for the sliding pill animation.

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-tabs` | ^1.1.13 | Accessible tab navigation | Already used in Settings page and `tabs.tsx` |
| `motion` (motion/react) | ^12.29.2 | Sliding pill animation via `layoutId` | Already used across all motion components |
| `next` | 16.1.5 | App Router, `searchParams`, `useSearchParams`, `usePathname` | Framework |
| `zustand` | ^5.0.10 | State management (sidebar store) | Already used for sidebar, settings |
| `@phosphor-icons/react` | ^2.1.10 | Icons (Briefcase already in sidebar) | Codebase standard icon library |
| `zod` | ^4.3.6 | Optional: runtime validation of mock data shapes | Already installed |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | ^0.7.1 | Variant styling for tab triggers | Follow existing `tabsTriggerVariants` pattern |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.4.0 | Class composition via `cn()` | Every component |
| `recharts` | ^3.7.0 | Earnings chart (Phase 56, not this phase) | Already installed for later phases |

### No New Dependencies Required

All libraries needed for Phase 53 are already installed. **Do not add any new packages.**

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `window.history.pushState` | `router.push` / `router.replace` | `router.push` triggers server component re-render; `pushState` is shallow and integrates with `useSearchParams` per Next.js 16 docs |
| Motion `layoutId` | CSS transition on pill position | CSS requires manual width/position calculation; `layoutId` auto-animates between positions. Motion already installed. |
| New `BrandDealsTabs` | Extend `CategoryTabs` | CategoryTabs is scrollable list with count badges, not pill/segment control. Different visual pattern. |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(app)/brand-deals/
│   └── page.tsx                    # Server component: reads searchParams, validates tab, renders client
├── components/app/brand-deals/
│   ├── index.ts                    # Barrel export
│   ├── brand-deals-page.tsx        # Client component: orchestrates tabs, header, URL sync
│   ├── brand-deals-header.tsx      # Header with title + tab-contextual summary stats
│   └── brand-deals-tabs.tsx        # Pill/segment tab control with sliding indicator
├── hooks/
│   └── useCopyToClipboard.ts       # Reusable clipboard hook (extracted from existing patterns)
├── types/
│   └── brand-deals.ts              # BrandDeal, AffiliateLink, EarningsSummary, Product interfaces
└── lib/
    └── mock-brand-deals.ts         # Typed mock data fixtures with edge cases
```

### Pattern 1: Server-reads-searchParams, Client Orchestrates (Settings Page Pattern)

**What:** Server component page reads `searchParams` and passes validated `defaultTab` to a client component that manages the interactive tab UI.
**When to use:** Any page with URL-synced tab navigation in Next.js App Router.
**Source:** Existing `src/app/(app)/settings/page.tsx`

```typescript
// src/app/(app)/brand-deals/page.tsx
import { Metadata } from "next";
import { BrandDealsPage } from "@/components/app/brand-deals";

export const metadata: Metadata = {
  title: "Brand Deals | Virtuna",
  description: "Manage brand deals, affiliate links, and earnings",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const VALID_TABS = ["earnings", "deals", "affiliates"] as const;
type ValidTab = (typeof VALID_TABS)[number];

export default async function BrandDeals({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "earnings"; // Default: "show the money first"

  return <BrandDealsPage defaultTab={defaultTab} />;
}
```

### Pattern 2: Controlled Radix Tabs + URL Sync via pushState

**What:** Use Radix Tabs in controlled mode (`value` + `onValueChange`) and sync tab changes to the URL using `window.history.pushState` for shallow routing. Read initial value from `useSearchParams`, fall back to `defaultTab` prop.
**When to use:** When tabs must sync with URL without triggering server re-renders.
**Source:** Next.js 16.1.5 docs (SPA guide) + Radix Tabs API

```typescript
// Inside the client component
"use client";

import { useSearchParams } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";

const VALID_TABS = ["earnings", "deals", "affiliates"] as const;
type ValidTab = (typeof VALID_TABS)[number];

interface BrandDealsPageProps {
  defaultTab: ValidTab;
}

export function BrandDealsPage({ defaultTab }: BrandDealsPageProps) {
  const searchParams = useSearchParams();

  // Derive current tab from URL, falling back to server-validated default
  const tabParam = searchParams.get("tab") || "";
  const currentTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : defaultTab;

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  return (
    <Tabs.Root value={currentTab} onValueChange={handleTabChange}>
      {/* Tab list and content */}
    </Tabs.Root>
  );
}
```

**Critical detail:** `window.history.pushState` integrates with Next.js `useSearchParams` -- React re-renders when the URL changes, keeping the tab UI in sync. This also preserves browser back/forward navigation.

### Pattern 3: Motion layoutId for Sliding Pill Indicator

**What:** Render a `motion.div` with `layoutId="active-tab-pill"` inside only the active tab trigger. Motion auto-animates it between positions.
**When to use:** Animated sliding background indicator for tab/segment controls.
**Source:** Motion docs (`motion.dev/docs/react-layout-group`)

```typescript
import { motion } from "motion/react";

function TabTrigger({ value, label, isActive }: {
  value: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Tabs.Trigger value={value} className="relative px-4 py-1.5 text-sm">
      {isActive && (
        <motion.div
          layoutId="brand-deals-tab-pill"
          className="absolute inset-0 rounded-full bg-white/10 border border-white/10"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </Tabs.Trigger>
  );
}
```

### Pattern 4: Sidebar Navigation with usePathname

**What:** Replace `useState`-based active nav with `usePathname()`-based active state and `Link` components for actual routing.
**When to use:** When sidebar nav items link to real routes (not just in-page state).
**Source:** Existing showcase `sidebar-nav.tsx` pattern

```typescript
// Current sidebar uses: useState("content-intelligence") + onClick={() => setActiveNav(id)}
// This must change to: usePathname() comparison + Link or router.push

const pathname = usePathname();
// ...
<SidebarNavItem
  icon={Briefcase}
  label="Brand Deals"
  isActive={pathname.startsWith("/brand-deals")}
  onClick={() => router.push("/brand-deals")}
/>
```

**Important:** The sidebar currently uses local `useState` for active nav state. The nav items have IDs ("content-intelligence", "trending-feed", "brand-deals") but no routes. Brand Deals is the first item to get a real route. The sidebar wiring must introduce `usePathname()` for the active state of items that have routes, while keeping `useState` for items that don't have routes yet.

### Pattern 5: Typed Mock Data with Edge Cases

**What:** Define TypeScript interfaces in `src/types/brand-deals.ts`, create fixture arrays in `src/lib/mock-brand-deals.ts` with realistic data and deliberate edge cases.
**Source:** Existing `src/types/settings.ts` + `src/lib/mock-data.ts` patterns

```typescript
// src/types/brand-deals.ts
export interface BrandDeal {
  id: string;
  brandName: string;
  brandLogo: string; // URL from logo API
  category: BrandDealCategory;
  status: "active" | "pending" | "expired" | "applied";
  commission: number; // percentage (0-100)
  fixedFee?: number; // optional fixed payment
  startDate: string; // ISO date
  endDate?: string; // optional (ongoing deals)
  description: string;
  requirements?: string;
}

export type BrandDealCategory =
  | "tech" | "fashion" | "gaming" | "fitness"
  | "beauty" | "food" | "travel" | "finance";

export interface AffiliateLink {
  id: string;
  dealId: string; // references BrandDeal.id
  url: string;
  shortCode: string;
  clicks: number;
  conversions: number;
  earnings: number;
  createdAt: string;
  product?: Product;
}

export interface Product {
  id: string;
  name: string;
  imageUrl?: string;
  price: number;
}

export interface EarningsSummary {
  totalEarned: number;
  pendingPayout: number;
  paidOut: number;
  monthlyBreakdown: MonthlyEarning[];
  topSources: EarningSource[];
}

export interface MonthlyEarning {
  month: string; // "2026-01"
  amount: number;
}

export interface EarningSource {
  brandName: string;
  brandLogo: string;
  totalEarned: number;
  dealCount: number;
}
```

### Anti-Patterns to Avoid

- **Using `router.push` for tab changes:** Triggers server component re-render, noticeable lag on tab switch. Use `window.history.pushState` instead.
- **Building tab component from scratch:** Radix Tabs provides full keyboard navigation (arrow keys, Home/End), roving tabindex, and ARIA roles. Don't replicate this.
- **Hardcoding colors instead of design tokens:** Every color must reference `globals.css` tokens (`text-foreground`, `bg-surface-elevated`, etc.), not raw hex/rgb values.
- **Rendering `defaultValue` + `onValueChange` together:** Radix Tabs treats `defaultValue` as uncontrolled. For URL sync you need `value` (controlled mode). Don't mix both -- use `value` when you need controlled behavior.
- **Using `framer-motion` import path:** The codebase has migrated motion components to `motion/react`. Use `import { motion } from "motion/react"` not `from "framer-motion"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab accessibility (keyboard nav, ARIA) | Custom tab buttons with manual ARIA | `@radix-ui/react-tabs` | Arrow keys, Home/End, roving tabindex, role="tab/tabpanel" -- all handled |
| Sliding pill animation | Manual position/width calculation + CSS transition | `motion/react` `layoutId` | Auto-measures and animates between any positions, handles resizes |
| Tab validation | Custom string checking | `as const` array + `.includes()` type guard | Already pattern in Settings page, type-safe |
| Clipboard interaction | Inline `navigator.clipboard.writeText` in each component | `useCopyToClipboard` hook | Centralizes try/catch, timeout reset, and copied state. Already 2 duplicate inline implementations exist. |
| URL search param manipulation | Manual string concatenation | `URLSearchParams` API | Handles encoding, multiple params, proper serialization |

**Key insight:** The codebase already has every primitive needed. This phase is about composition and wiring, not building new low-level components. The sliding pill tab is the only truly new UI element.

## Common Pitfalls

### Pitfall 1: Server Component Re-render on Tab Switch

**What goes wrong:** Using `router.push("/brand-deals?tab=deals")` triggers a full Next.js navigation cycle, re-running the server component and causing visible loading jank.
**Why it happens:** In App Router, `router.push` and `router.replace` are not shallow -- they trigger server-side rendering.
**How to avoid:** Use `window.history.pushState(null, "", `?${params.toString()}`)` which integrates with `useSearchParams` for reactive updates without server re-render.
**Warning signs:** Tab switches feel sluggish, network tab shows RSC payload on every tab click.

### Pitfall 2: Radix Tabs Controlled vs Uncontrolled Mixing

**What goes wrong:** Passing both `defaultValue` and `value` to `Tabs.Root` causes unpredictable behavior.
**Why it happens:** `defaultValue` is for uncontrolled mode, `value` is for controlled mode. They're mutually exclusive in Radix.
**How to avoid:** Use `value` + `onValueChange` for URL-synced tabs (controlled). Pass `defaultValue` only when the component first renders without URL param and you don't need ongoing sync.
**Warning signs:** Tab state gets "stuck" or doesn't update when URL changes.

### Pitfall 3: SSR Hydration Mismatch with useSearchParams

**What goes wrong:** `useSearchParams()` returns different values on server vs client, causing React hydration errors.
**Why it happens:** Search params may not be available during SSR.
**How to avoid:** The server component already validates and passes `defaultTab` as a prop. The client component should use `defaultTab` as the initial fallback and only read `useSearchParams` for subsequent updates. Wrap `useSearchParams` usage in a Suspense boundary if needed, but the server-side default pattern avoids this naturally.
**Warning signs:** Console hydration mismatch warnings.

### Pitfall 4: Sidebar Active State Regression

**What goes wrong:** Adding `usePathname()` to the sidebar breaks active state for other nav items that don't have routes yet.
**Why it happens:** The sidebar currently uses `useState("content-intelligence")` for active state. Changing to `usePathname()` only works for items with real routes.
**How to avoid:** Use a hybrid approach: `usePathname()` determines active state for items with routes (`/brand-deals`), while keeping `useState` for items that are still in-page actions. Route-based items take precedence.
**Warning signs:** "Content Intelligence" or "Trending Feed" losing their active highlight.

### Pitfall 5: Logo API Rate Limits in Mock Data

**What goes wrong:** Using live logo API URLs in mock data causes 429 (rate limit) errors during development when hot-reloading.
**Why it happens:** Each re-render fetches logos via external API.
**How to avoid:** Use static logo URLs in mock data (e.g., `https://logo.clearbit.com/nike.com` or `https://img.logo.dev/nike.com?token=...`). For development, consider placeholder images or a single logo URL per brand stored as a constant. External logo APIs have generous free tiers (logo.dev: free with registration, clearbit: deprecated but CDN still works for common brands).
**Warning signs:** Broken image icons, 429 errors in console.

### Pitfall 6: Lightning CSS Stripping backdrop-filter

**What goes wrong:** Glass panel styles in CSS classes lose their `backdrop-filter` property during build.
**Why it happens:** Tailwind v4's Lightning CSS bundler strips `backdrop-filter` and `-webkit-backdrop-filter` from compiled CSS.
**How to avoid:** The codebase already handles this -- `GlassPanel` uses CSS class names from `globals.css` (`.glass-blur-*`) which are defined outside the Tailwind compilation pipeline. Don't add new glass blur via Tailwind utilities; use the existing `GlassPanel` component or `glass-blur-*` utility classes.
**Warning signs:** Glass panel appears fully transparent with no blur.

## Code Examples

### useCopyToClipboard Hook

Extracted from the existing inline pattern in `copy-button.tsx` and `share-button.tsx`:

```typescript
// src/hooks/useCopyToClipboard.ts
"use client";

import { useState, useCallback } from "react";

interface UseCopyToClipboardReturn {
  /** Whether the text was recently copied (resets after timeout) */
  copied: boolean;
  /** Copy text to clipboard. Returns true if successful. */
  copy: (text: string) => Promise<boolean>;
}

/**
 * Hook for copying text to the clipboard with feedback state.
 *
 * @param resetDelay - Time in ms before `copied` resets to false (default: 2000)
 *
 * @example
 * ```tsx
 * const { copied, copy } = useCopyToClipboard();
 * <button onClick={() => copy(affiliateLink)}>
 *   {copied ? "Copied!" : "Copy Link"}
 * </button>
 * ```
 */
export function useCopyToClipboard(resetDelay = 2000): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!navigator.clipboard) {
      console.warn("Clipboard API not available");
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetDelay);
      return true;
    } catch {
      console.error("Failed to copy to clipboard");
      return false;
    }
  }, [resetDelay]);

  return { copied, copy };
}
```

### Brand Logo URL Pattern

```typescript
// Use logo.dev for brand logos (free tier with registration)
// Format: https://img.logo.dev/{domain}?token={token}&size=64
// Or clearbit (deprecated CDN, still serves common brands):
// Format: https://logo.clearbit.com/{domain}

// In mock data:
const BRAND_LOGOS: Record<string, string> = {
  nike: "https://logo.clearbit.com/nike.com",
  spotify: "https://logo.clearbit.com/spotify.com",
  adobe: "https://logo.clearbit.com/adobe.com",
  // ... etc
};
```

### Sidebar Badge for New Deals Count

```typescript
// SidebarNavItem already has icon + label. Add optional badge:
<SidebarNavItem
  icon={Briefcase}
  label="Brand Deals"
  isActive={pathname.startsWith("/brand-deals")}
  onClick={() => router.push("/brand-deals")}
  badge={3} // new deals count
/>
```

The `SidebarNavItem` component will need a small extension to support an optional `badge` prop. The existing `Badge` component (`src/components/ui/badge.tsx`) has `size="sm"` variant that works well for nav item counts.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `router.push` for URL sync | `window.history.pushState` + `useSearchParams` | Next.js 14+ (App Router SPA guide) | Avoids server re-renders on param changes |
| `framer-motion` package | `motion` package (`motion/react`) | Late 2024 | Same API, lighter bundle. Codebase already uses both -- new code should use `motion/react` |
| Clearbit logo API | logo.dev / brand.dev / brandfetch | Clearbit deprecated ~2024 | logo.dev is the recommended replacement, free tier available |
| `defaultValue` for URL tabs | `value` (controlled) + `onValueChange` | Always (Radix pattern) | Controlled mode required for URL sync |

**Deprecated/outdated:**
- `framer-motion` import path: Use `motion/react` instead (same library, rebranded)
- Clearbit logo API: Deprecated, but CDN still works for common brands. logo.dev is the official successor.

## Open Questions

1. **Logo API token for mock data**
   - What we know: logo.dev requires a free API token; clearbit CDN still serves logos without auth for major brands
   - What's unclear: Whether to use clearbit (no token needed, may break), logo.dev (needs token in env), or static placeholder images
   - Recommendation: Use clearbit CDN URLs in mock data (simplest, no env token needed, works for Nike/Spotify/Adobe etc). Fall back to placeholder avatar if image fails to load. Migrate to logo.dev when backend integration happens.

2. **Tab content transition animation**
   - What we know: Context says "Claude's discretion". Options: fade, slide, none
   - What's unclear: Which feels best with the sliding pill
   - Recommendation: Simple fade with `AnimatePresence` + `motion.div` opacity transition (200ms). Lightweight, doesn't compete with the pill animation.

3. **Tab memory on re-navigation**
   - What we know: Context says "Claude's discretion"
   - What's unclear: Whether clicking "Brand Deals" in sidebar should always go to default tab (Earnings) or remember last active tab
   - Recommendation: Always navigate to default tab (Earnings). Simpler, predictable. The URL already captures tab state -- users can bookmark specific tabs. Re-clicking the sidebar nav is "start fresh" behavior.

## Sources

### Primary (HIGH confidence)
- **Radix UI Tabs API** - `/radix-ui/website` via Context7 -- `value`, `onValueChange`, `defaultValue` controlled/uncontrolled modes, accessibility features
- **Next.js 16.1.5 searchParams** - `/vercel/next.js/v16.1.5` via Context7 -- `searchParams: Promise<{}>` in server components, `useSearchParams` + `usePathname` in client components
- **Next.js 16.1.5 shallow routing** - `/vercel/next.js/v16.1.5` SPA guide via Context7 -- `window.history.pushState` integrates with `useSearchParams` for shallow URL updates
- **Motion layoutId** - `/websites/motion_dev` via Context7 -- `layoutId` for shared element transitions between tab indicators

### Secondary (MEDIUM confidence)
- **Logo API options** - [logo.dev](https://www.logo.dev/), [brand.dev](https://www.brand.dev/), [brandfetch](https://brandfetch.com/developers/logo-api) -- free tier logo APIs as Clearbit replacement
- **useCopyToClipboard patterns** - [usehooks.com](https://usehooks.com/usecopytoclipboard), [usehooks-ts](https://usehooks-ts.com/react-hook/use-copy-to-clipboard) -- standard implementation patterns

### Codebase Patterns (HIGH confidence - direct source reading)
- `src/app/(app)/settings/page.tsx` -- Server-reads-searchParams pattern
- `src/components/app/settings/settings-page.tsx` -- Client component with Radix Tabs
- `src/components/app/sidebar.tsx` -- Current sidebar nav with `useState` active state
- `src/components/app/sidebar-nav-item.tsx` -- Nav item component (needs badge extension)
- `src/components/ui/tabs.tsx` -- Existing Radix Tabs wrapper with CVA variants
- `src/components/ui/category-tabs.tsx` -- CategoryTabs (different pattern, not for pill/segment)
- `src/app/(marketing)/showcase/_components/copy-button.tsx` -- Existing clipboard pattern
- `src/components/app/simulation/share-button.tsx` -- Another clipboard pattern (duplicate)
- `src/stores/sidebar-store.ts` -- Zustand persist pattern
- `src/types/settings.ts` -- TypeScript interface pattern for typed fixtures
- `src/app/globals.css` -- Design tokens, glass utility classes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use in the codebase
- Architecture: HIGH - Settings page provides a proven pattern; URL sync via pushState is documented in Next.js 16 official docs
- Pitfalls: HIGH - Server re-render issue well-documented; glassmorphism gotchas known from prior phases (MEMORY.md)
- Mock data design: MEDIUM - Interface shapes are straightforward but logo API choice needs runtime validation

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (stable -- no fast-moving dependencies)
