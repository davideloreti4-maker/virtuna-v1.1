# Phase 50: Data Layer & Page Shell - Research

**Researched:** 2026-02-05
**Domain:** Next.js App Router page creation, mock data architecture, Radix Tabs with URL sync
**Confidence:** HIGH

## Summary

This phase creates the `/trending` route within the `(app)` route group, a typed mock data layer with 40+ trending videos, and a category tab system synced to URL search params. The domain is well-understood: it combines existing project patterns (server component page wrapper + client component, Radix Tabs, design system Typography/Skeleton) with a standard Next.js `useSearchParams` + `window.history.pushState` pattern for shallow URL updates.

The existing codebase provides strong precedent: the Settings page demonstrates server-component-reads-searchParams + passes-to-client-component, the Sidebar shows how navigation items are added, and the CategoryTabs component already wraps Radix Tabs with the exact API needed (controlled `value`/`onValueChange`, category definitions with labels).

**Primary recommendation:** Use the existing CategoryTabs component in controlled mode, sync tab state with URL search params via `useSearchParams` + `window.history.pushState`, and follow the Settings page server/client component split pattern exactly.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-tabs` | ^1.1.13 | Tab primitives (a11y, keyboard nav) | Already installed; existing Tabs + CategoryTabs wrap it |
| `next/navigation` | 16.1.5 | `useSearchParams`, `usePathname`, `useRouter` | Built-in; official Next.js URL state management |
| `lucide-react` | ^0.563.0 | `TrendingUp` icon for sidebar nav item | Already installed; used throughout sidebar |
| Design system | -- | Typography (Heading), Skeleton, CategoryTabs, Tabs | Already built in v2.0; verified API matches requirements |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | ^5.0.10 | State management (only if tab state needs cross-component sharing) | NOT needed for this phase -- URL params are the source of truth |
| `framer-motion` | ^12.29.3 | Tab content transition animation (fade) | Discretionary: brief fade-out/in when switching tabs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `window.history.pushState` for URL sync | `router.push`/`router.replace` | `pushState` is shallower (no server re-render), recommended by Next.js docs for SPA-style URL state |
| `useSearchParams` on client | `searchParams` prop on server page | Settings page already uses server-side `searchParams` for initial value -- use same pattern |
| CategoryTabs component | Raw Radix Tabs | CategoryTabs already wraps Radix with scrollable list, icon/count support, controlled mode -- no need to rewrite |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(app)/trending/
│   ├── page.tsx                  # Server component: reads searchParams, exports metadata
│   └── trending-client.tsx       # Client component: tabs, filtering, URL sync, skeleton states
├── lib/
│   └── trending-mock-data.ts     # Mock data file: typed video array, category filtering helpers
└── types/
    └── trending.ts               # TypeScript types: TrendingVideo, TrendingCategory, etc.
```

### Pattern 1: Server/Client Component Split (from Settings page)

**What:** Server component reads `searchParams`, validates tab value, passes to client component as prop.
**When to use:** Any page that needs URL search params for initial state.
**Example:**
```typescript
// Source: Verified pattern from src/app/(app)/settings/page.tsx

// page.tsx (server component)
import type { Metadata } from "next";
import { TrendingClient } from "./trending-client";

export const metadata: Metadata = {
  title: "Trending | Virtuna",
  description: "Discover trending TikTok videos across categories",
};

const VALID_TABS = ["breaking-out", "trending-now", "rising-again"] as const;
type ValidTab = (typeof VALID_TABS)[number];

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function TrendingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "breaking-out";

  return <TrendingClient defaultTab={defaultTab} />;
}
```

### Pattern 2: Controlled Tabs with URL Sync via pushState

**What:** CategoryTabs in controlled mode (`value`/`onValueChange`), synced to URL via `useSearchParams` + `window.history.pushState`.
**When to use:** Tabs that should be shareable via URL and support browser back/forward.
**Example:**
```typescript
// Source: Next.js v16.1.5 docs - shallow routing with pushState
// Combined with existing CategoryTabs controlled mode API

"use client";

import { useSearchParams } from "next/navigation";
import { CategoryTabs, TabsContent } from "@/components/ui/category-tabs";

const CATEGORIES = [
  { value: "breaking-out", label: "Breaking Out" },
  { value: "trending-now", label: "Trending Now" },
  { value: "rising-again", label: "Rising Again" },
];

function TrendingTabs({ defaultTab }: { defaultTab: string }) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? defaultTab;

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  return (
    <CategoryTabs
      categories={CATEGORIES}
      value={currentTab}
      onValueChange={handleTabChange}
    >
      <TabsContent value="breaking-out">...</TabsContent>
      <TabsContent value="trending-now">...</TabsContent>
      <TabsContent value="rising-again">...</TabsContent>
    </CategoryTabs>
  );
}
```

### Pattern 3: Skeleton Loading Flash on Tab Switch

**What:** Brief skeleton display (~200-300ms) when switching tabs to simulate data fetch latency.
**When to use:** Tab content areas to create realistic loading UX.
**Example:**
```typescript
// useState + useEffect with setTimeout to show skeleton briefly

const [isLoading, setIsLoading] = useState(false);

function handleTabChange(value: string) {
  setIsLoading(true);
  // Update URL
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", value);
  window.history.pushState(null, "", `?${params.toString()}`);
  // Show skeleton for 200-300ms
  setTimeout(() => setIsLoading(false), 250);
}
```

### Pattern 4: Mock Data Module with Category Filtering

**What:** Typed mock data array with helper functions for filtering by category and computing stats.
**When to use:** Any data layer that needs to serve filtered subsets.
**Example:**
```typescript
// src/lib/trending-mock-data.ts
import type { TrendingVideo, TrendingCategory } from "@/types/trending";

export const TRENDING_VIDEOS: TrendingVideo[] = [
  // 40+ videos across 3 categories
];

export function getVideosByCategory(category: TrendingCategory): TrendingVideo[] {
  return TRENDING_VIDEOS.filter((v) => v.category === category);
}

export function getCategoryStats(): Record<TrendingCategory, { count: number; totalViews: number }> {
  // Compute aggregate stats per category
}
```

### Anti-Patterns to Avoid

- **Don't use `router.push` for tab changes:** This triggers a full Next.js navigation (server component re-render). Use `window.history.pushState` for shallow URL updates per Next.js docs.
- **Don't create a Zustand store for tab state:** URL search params are the single source of truth. Adding a store creates sync complexity.
- **Don't build a new Tabs component:** CategoryTabs already provides the exact API needed (controlled mode, scrollable list, no count badges if omitted).
- **Don't put `useSearchParams` in a server component:** It's a client-only hook. Read `searchParams` prop in the server page component, pass validated default to the client component.
- **Don't skip the Suspense boundary:** `useSearchParams` requires a Suspense boundary in the App Router for static rendering support. Wrap the client component or the component using `useSearchParams` in `<Suspense>`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab a11y (keyboard nav, ARIA) | Custom tab implementation | Radix Tabs via CategoryTabs | Full keyboard nav, roving tabindex, ARIA roles built-in |
| URL search param management | Manual URL parsing/serialization | `useSearchParams` + `URLSearchParams` | Standard Web API + Next.js integration, handles encoding |
| Tab styling with active state | Custom CSS state tracking | Radix `data-[state=active]` attribute | Already styled in TabsTrigger with CVA variants |
| Shimmer skeleton animation | Custom CSS keyframes | `Skeleton` component from `@/components/ui/skeleton` | Already built with shimmer animation and motion-reduce support |
| Loading delay simulation | `new Promise` or manual approach | `setTimeout` with state toggle | Simple, predictable, easy to remove when real API exists |

**Key insight:** This phase should compose existing design system components, not create new ones. Every UI primitive needed (Typography Heading, Skeleton, CategoryTabs, TabsContent) already exists and has been verified.

## Common Pitfalls

### Pitfall 1: useSearchParams Without Suspense Boundary

**What goes wrong:** Build error or runtime warning when `useSearchParams` is used without a Suspense boundary in Next.js App Router.
**Why it happens:** Next.js requires Suspense for client components that read search params to support static rendering.
**How to avoid:** Wrap the client component in `<Suspense>` at the page level, OR rely on the server component reading `searchParams` and passing validated default to client.
**Warning signs:** "Missing Suspense boundary" warning in console or build output.

### Pitfall 2: Hydration Mismatch with URL-Derived State

**What goes wrong:** Server renders with default tab, client reads URL and renders different tab, causing hydration mismatch.
**Why it happens:** Server component doesn't know the URL search params (it does if you use the `searchParams` prop though).
**How to avoid:** Use the Settings page pattern: server component reads `searchParams` prop (it's a Promise in Next.js 16+, await it), validates, passes correct initial tab to client. This ensures server and client agree on initial state.
**Warning signs:** Hydration mismatch errors in console, flash of wrong tab on initial load.

### Pitfall 3: Tab Switch Causes Layout Shift

**What goes wrong:** Stats bar or content area jumps/resizes when switching between tabs with different content lengths.
**Why it happens:** No minimum height set, stats bar hidden when tab has zero results.
**How to avoid:** Keep stats bar visible with zeroed values (per CONTEXT.md decision). Set a minimum height on the content area. Use consistent grid layout that fills space even when empty.
**Warning signs:** Visual jank when clicking tabs rapidly.

### Pitfall 4: Stale searchParams After pushState

**What goes wrong:** `useSearchParams` doesn't update after `window.history.pushState` because the component doesn't re-render.
**Why it happens:** `pushState` integrates with the Next.js Router (per docs), but re-render depends on React's state update cycle.
**How to avoid:** Use local state to track the current tab in addition to URL sync. The local state drives the UI; URL is for shareability/back-forward. On popstate (browser back/forward), sync local state from URL.
**Warning signs:** Tab UI doesn't update when clicking browser back button.

### Pitfall 5: `searchParams` Is a Promise in Next.js 16+

**What goes wrong:** Type error or runtime crash when treating `searchParams` as a plain object in the server page component.
**Why it happens:** Starting from Next.js 15+, `searchParams` in page components is a `Promise<{ [key: string]: string | string[] | undefined }>`. Must be awaited.
**How to avoid:** Use `const params = await searchParams;` in the server component, exactly as the Settings page does.
**Warning signs:** TypeScript error "Property 'tab' does not exist on type 'Promise<...>'".

## Code Examples

### Complete Server Page Component

```typescript
// Source: Verified pattern from src/app/(app)/settings/page.tsx + Next.js v16.1.5 docs
// File: src/app/(app)/trending/page.tsx

import type { Metadata } from "next";
import { Suspense } from "react";
import { TrendingClient } from "./trending-client";

export const metadata: Metadata = {
  title: "Trending | Virtuna",
  description: "Discover trending TikTok videos across categories",
};

const VALID_TABS = ["breaking-out", "trending-now", "rising-again"] as const;
type ValidTab = (typeof VALID_TABS)[number];

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function TrendingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "breaking-out";

  return (
    <Suspense fallback={<TrendingPageSkeleton />}>
      <TrendingClient defaultTab={defaultTab} />
    </Suspense>
  );
}

function TrendingPageSkeleton() {
  // Skeleton matching page layout shape
  return <div className="mx-auto max-w-[1280px] p-6">...</div>;
}
```

### TypeScript Types for Trending Data

```typescript
// File: src/types/trending.ts

/** Trending video category */
export type TrendingCategory = "breaking-out" | "trending-now" | "rising-again";

/** Display labels for categories */
export const CATEGORY_LABELS: Record<TrendingCategory, string> = {
  "breaking-out": "Breaking Out",
  "trending-now": "Trending Now",
  "rising-again": "Rising Again",
};

/** A single trending video entry */
export interface TrendingVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  creator: {
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  views: number;
  likes: number;
  shares: number;
  date: string; // ISO 8601
  category: TrendingCategory;
  hashtags: string[];
  tiktokUrl: string;
  /** Views multiplier relative to creator's average */
  velocity: number;
}

/** Stats for a single category */
export interface CategoryStats {
  count: number;
  totalViews: number;
}

/** Aggregate stats across all categories */
export interface TrendingStats {
  totalVideos: number;
  totalViews: number;
  byCategory: Record<TrendingCategory, CategoryStats>;
}
```

### Mock Data Structure

```typescript
// File: src/lib/trending-mock-data.ts
import type { TrendingVideo, TrendingCategory, TrendingStats } from "@/types/trending";

export const TRENDING_VIDEOS: TrendingVideo[] = [
  {
    id: "vid_001",
    title: "This pasta trick changed my life",
    thumbnailUrl: "https://picsum.photos/seed/vid001/400/500",
    creator: {
      handle: "@chefmaria",
      displayName: "Chef Maria",
      avatarUrl: "https://picsum.photos/seed/chef1/100/100",
    },
    views: 4_200_000,
    likes: 312_000,
    shares: 45_000,
    date: "2026-02-04T14:30:00Z",
    category: "breaking-out",
    hashtags: ["#cookinghack", "#pasta", "#foodtok", "#viral"],
    tiktokUrl: "https://www.tiktok.com/@chefmaria/video/7000000000001",
    velocity: 46,
  },
  // ... 39+ more videos
];

export function getVideosByCategory(category: TrendingCategory): TrendingVideo[] {
  return TRENDING_VIDEOS.filter((v) => v.category === category);
}

export function getTrendingStats(): TrendingStats {
  const stats: TrendingStats = {
    totalVideos: TRENDING_VIDEOS.length,
    totalViews: TRENDING_VIDEOS.reduce((sum, v) => sum + v.views, 0),
    byCategory: {
      "breaking-out": { count: 0, totalViews: 0 },
      "trending-now": { count: 0, totalViews: 0 },
      "rising-again": { count: 0, totalViews: 0 },
    },
  };
  for (const video of TRENDING_VIDEOS) {
    stats.byCategory[video.category].count++;
    stats.byCategory[video.category].totalViews += video.views;
  }
  return stats;
}
```

### Adding Sidebar Nav Item for Trending

```typescript
// In src/components/app/sidebar.tsx
// Add import:
import { TrendingUp } from "lucide-react";
// Add in the nav section alongside existing nav items:
<SidebarNavItem
  label="Trending"
  icon={TrendingUp}
  onClick={() => {
    router.push("/trending");
    onMobileOpenChange?.(false);
  }}
/>
```

### Coral Accent on Active Tab

The existing CategoryTabs uses the Tabs component which has `data-[state=active]:bg-white/5` styling. For coral accent, override the active state styling:

```typescript
// Option: Override TabsTrigger active state for coral accent
// In the trending page's CategoryTabs usage, pass className to customize:
<TabsTrigger
  className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent data-[state=active]:border-accent/20"
/>

// OR: Add a coral variant to the CategoryTabs component via className override
// The CategoryTabs renders TabsTrigger with className="shrink-0", so additional
// classes can be added to the categories or via the parent's className prop
```

### Sticky Tabs on Scroll

```typescript
// Tabs bar sticky while heading scrolls away
<div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border pb-3">
  <CategoryTabs ... />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `router.push` for shallow URL update | `window.history.pushState` | Next.js 14+ (SPA guide) | No server re-render, true shallow routing |
| `searchParams` as sync object | `searchParams` as `Promise` | Next.js 15+ | Must `await` in server components |
| Custom tab components | Radix Tabs primitives | Stable since Radix 1.0 | Full a11y for free |
| Pages Router `shallow: true` | App Router `pushState` | Next.js 13+ migration | `shallow` option removed in App Router |

**Deprecated/outdated:**
- `router.push(url, { shallow: true })`: Does not exist in App Router. Use `window.history.pushState` instead.
- Sync `searchParams` in Next.js 16: `searchParams` is now a Promise; always await it in server components.

## Open Questions

1. **popstate Listener for Browser Back/Forward**
   - What we know: `window.history.pushState` integrates with Next.js router per docs. `useSearchParams` should reflect the updated URL after popstate events.
   - What's unclear: Whether `useSearchParams` auto-updates on popstate without a re-render trigger, or if a manual `popstate` event listener is needed to sync local state.
   - Recommendation: Test during implementation. If `useSearchParams` doesn't auto-sync, add a `popstate` listener in a `useEffect` that reads URL and updates local tab state. Alternatively, derive tab state directly from `useSearchParams` on every render (no local state) to avoid sync issues.

2. **Coral Accent Styling on CategoryTabs**
   - What we know: The existing TabsTrigger uses `data-[state=active]:bg-white/5` (glass pill style). The requirement is coral accent.
   - What's unclear: Whether to modify the CategoryTabs component globally to accept an `accent` variant, or override via className at usage site.
   - Recommendation: Override at the usage site via className to avoid breaking other CategoryTabs usages. Can be refactored into a variant later if needed.

## Sources

### Primary (HIGH confidence)
- Context7 `/vercel/next.js/v16.1.5` - `useSearchParams` hook, `window.history.pushState` shallow routing, Suspense boundary pattern
- Context7 `/websites/radix-ui` - Radix Tabs composition pattern (confirmed controlled mode API)
- Codebase: `src/app/(app)/settings/page.tsx` - Server component searchParams pattern (verified: Promise-based, awaited)
- Codebase: `src/components/ui/category-tabs.tsx` - CategoryTabs API (verified: controlled `value`/`onValueChange`, category definitions)
- Codebase: `src/components/ui/tabs.tsx` - Radix Tabs wrapper (verified: CVA variants, a11y built-in)
- Codebase: `src/components/ui/typography.tsx` - Heading component (verified: `level` + `size` props)
- Codebase: `src/components/ui/skeleton.tsx` - Skeleton component (verified: shimmer animation)
- Codebase: `src/components/app/sidebar.tsx` - Navigation item pattern (verified: SidebarNavItem + router.push)
- Codebase: `src/components/app/app-shell.tsx` - AppShell layout (verified: flex, sidebar + main)
- Codebase: `src/app/(app)/layout.tsx` - App route group layout (verified: font loading, AppShell wrapper)

### Secondary (MEDIUM confidence)
- Next.js v16.1.5 docs (Context7) - `pushState` and `replaceState` integrate with Next.js Router, sync with `usePathname` and `useSearchParams`

### Tertiary (LOW confidence)
- None - all findings verified via Context7 or codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in codebase
- Architecture: HIGH - Server/client split pattern verified from existing Settings page, URL sync pattern from official Next.js v16.1.5 docs via Context7
- Pitfalls: HIGH - Pitfalls identified from verified sources (Suspense requirement from docs, Promise searchParams from codebase, layout shift from CONTEXT.md decisions)

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days - stable domain, no fast-moving dependencies)
