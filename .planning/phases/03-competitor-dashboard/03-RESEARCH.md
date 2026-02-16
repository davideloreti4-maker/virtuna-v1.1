# Phase 3: Competitor Dashboard - Research

**Researched:** 2026-02-16
**Domain:** React dashboard UI, data fetching, Recharts sparklines, Zustand state management
**Confidence:** HIGH

## Summary

Phase 3 builds the user-facing competitor dashboard -- the first page where users SEE their tracked competitors. It depends entirely on Phase 1 (database schema, scraping types) and Phase 2 (add/remove server actions, junction table, database types). All backend infrastructure is complete and verified.

The phase requires: (1) a server component page that fetches competitor data from Supabase via the auth client and RLS junction table, (2) a client component dashboard with card grid and table views, (3) a Zustand store for view toggle state, (4) Recharts sparkline mini-charts from snapshot time-series, (5) computed engagement rate and growth velocity from profile + snapshot data, (6) skeleton loading states and empty states, and (7) a sidebar navigation entry.

**Primary recommendation:** Use server component data fetching (Supabase server client in page.tsx) with props-passing to a client component for interactivity. This matches the established dashboard pattern (`page.tsx` server wrapper -> `*-client.tsx` client component). Do NOT fetch data in a Zustand store -- use Zustand only for UI state (view toggle). Sparklines use Recharts `<LineChart>` with zero axes/grid/tooltip for a compact 80x32px inline chart.

## Standard Stack

### Core (already installed -- zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 3.7.0 | Sparkline mini-charts for growth trends | Already installed, project decision: no new packages |
| Zustand | 5.0.10 | Client-side view toggle state (grid/table) | Already installed, project state management standard |
| @supabase/ssr | 0.8.0 | Server-side auth client for data fetching | Already installed, auth + RLS pattern |
| @radix-ui/react-tabs | 1.1.13 | View toggle (grid/table) accessible tabs | Already installed, Tabs component exists |
| @radix-ui/react-avatar | 1.1.11 | Competitor avatar with fallback | Already installed, Avatar component exists |
| @phosphor-icons/react | 2.1.10 | Sidebar nav icon, UI icons | Already installed, sidebar icon standard |

### Supporting (already available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | 0.7.1 | Competitor card variants | If card needs size/state variants |
| framer-motion | 12.29.3 | Page transitions, card stagger | Optional: stagger-reveal on card grid |
| lucide-react | 0.563.0 | Additional icons (ArrowUp, ArrowDown for velocity) | Growth delta indicators |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts sparkline | SVG path hand-rolled | Recharts already installed, hand-rolling sparkline is unnecessary complexity |
| Zustand for view state | URL search params | URL params would persist across navigation but add complexity; localStorage via Zustand is simpler and matches existing patterns |
| Server component fetch | Client-side useEffect fetch | Server fetch is faster (no client waterfall), works with RLS, matches project conventions |

**Installation:**
```bash
# No installation needed -- all dependencies already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(app)/competitors/
│   ├── page.tsx                    # Server component: fetch data, pass as props
│   └── competitors-client.tsx      # Client component: grid/table views, interactivity
├── components/competitors/
│   ├── competitor-card.tsx          # Individual competitor card with stats
│   ├── competitor-card-skeleton.tsx # Loading skeleton for card
│   ├── competitor-table.tsx         # Table/leaderboard view
│   ├── competitor-table-skeleton.tsx# Loading skeleton for table
│   ├── competitor-sparkline.tsx     # Recharts sparkline wrapper
│   ├── competitor-empty-state.tsx   # Empty state with CTA
│   ├── growth-delta.tsx             # Green/red velocity indicator
│   └── index.ts                    # Barrel exports
├── stores/
│   └── competitors-store.ts         # View toggle state only (grid/table)
└── lib/
    └── competitors-utils.ts         # Formatting, engagement rate calc, velocity calc
```

### Pattern 1: Server Component Data Fetching with Client Handoff

**What:** Page server component fetches all competitor data from Supabase, passes as props to a client component for interactivity.
**When to use:** When the page needs auth-gated database queries AND client-side interactivity (view toggle, hover states).

```typescript
// src/app/(app)/competitors/page.tsx (Server Component)
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CompetitorsClient } from "./competitors-client";

export const metadata: Metadata = {
  title: "Competitors | Virtuna",
  description: "Track and analyze your TikTok competitors.",
};

export default async function CompetitorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null; // AuthGuard in AppShell handles redirect
  }

  // Fetch competitors via junction table (RLS handles scoping)
  const { data: competitors } = await supabase
    .from("user_competitors")
    .select(`
      competitor_id,
      added_at,
      competitor_profiles (
        id, tiktok_handle, display_name, avatar_url,
        follower_count, heart_count, video_count,
        last_scraped_at, scrape_status
      )
    `)
    .order("added_at", { ascending: false });

  // Fetch recent snapshots for sparklines (last 14 days per competitor)
  // ... build snapshot map keyed by competitor_id

  return <CompetitorsClient competitors={competitors ?? []} snapshots={snapshotMap} />;
}
```

**Why this pattern:** The existing codebase uses `page.tsx` (server) -> `*-client.tsx` (client) for the dashboard. This is the established pattern. Server fetching avoids client waterfalls and works naturally with Supabase RLS.

### Pattern 2: Recharts Sparkline (Zero-Chrome Mini-Chart)

**What:** A compact LineChart with no axes, grid, tooltip, or labels -- just a single trend line.
**When to use:** Inline in cards/tables to show growth direction at a glance.

```typescript
// Source: Recharts docs - LineChart basic usage + stripped chrome
// Verified via Context7 /recharts/recharts
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: { value: number }[];
  color?: string;
  width?: number;
  height?: number;
}

export function CompetitorSparkline({
  data,
  color = "var(--color-accent)",
  width = 80,
  height = 32,
}: SparklineProps) {
  if (data.length < 2) return null;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Key details (verified via Context7):**
- `dot={false}` removes data point dots
- `isAnimationActive={false}` prevents animation on load (sparklines should be instant)
- No `<XAxis>`, `<YAxis>`, `<CartesianGrid>`, `<Tooltip>` = zero chrome
- `<ResponsiveContainer>` makes it fill its parent
- `type="monotone"` creates smooth curves

### Pattern 3: Zustand Store for UI-Only State

**What:** A minimal Zustand store for view toggle (grid/table) with localStorage persistence.
**When to use:** When UI state needs to persist across navigation but doesn't involve server data.

```typescript
// Source: Zustand v5 docs - persist middleware
// Verified via Context7 /pmndrs/zustand
import { create } from "zustand";
import { persist } from "zustand/middleware";

type ViewMode = "grid" | "table";

interface CompetitorsUIState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const useCompetitorsStore = create<CompetitorsUIState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    { name: "virtuna-competitors-view" }
  )
);
```

**Why this pattern:** Matches `sidebar-store.ts` exactly -- simple persist middleware, no manual hydration needed for this case. The persist middleware handles SSR safety automatically. Only UI state goes here; competitor DATA comes from server component props.

### Pattern 4: Growth Velocity Calculation

**What:** Compute week-over-week follower growth percentage from snapshots.
**When to use:** For the green/red delta indicator on cards.

```typescript
// src/lib/competitors-utils.ts
export function computeGrowthVelocity(
  snapshots: { follower_count: number; snapshot_date: string }[]
): { percentage: number; direction: "up" | "down" | "flat" } | null {
  if (snapshots.length < 2) return null;

  // Sort by date descending
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
  );

  const latest = sorted[0]!.follower_count;
  // Find snapshot ~7 days ago
  const weekAgo = sorted.find((s) => {
    const daysAgo = (Date.now() - new Date(s.snapshot_date).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo >= 6; // At least 6 days ago
  });

  if (!weekAgo) return null;

  const previous = weekAgo.follower_count;
  if (previous === 0) return null;

  const percentage = ((latest - previous) / previous) * 100;

  return {
    percentage: Math.round(percentage * 10) / 10,
    direction: percentage > 0.5 ? "up" : percentage < -0.5 ? "down" : "flat",
  };
}

export function computeEngagementRate(
  videos: { views: number | null; likes: number | null; comments: number | null; shares: number | null }[]
): number | null {
  const validVideos = videos.filter((v) => v.views && v.views > 0);
  if (validVideos.length === 0) return null;

  const totalEngagement = validVideos.reduce(
    (sum, v) => sum + (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0),
    0
  );
  const totalViews = validVideos.reduce((sum, v) => sum + (v.views ?? 0), 0);

  if (totalViews === 0) return null;
  return (totalEngagement / totalViews) * 100;
}

export function formatCount(count: number | null): string {
  if (count === null || count === undefined) return "--";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}
```

### Pattern 5: Supabase Join Query for Competitors with Snapshots

**What:** Fetch all user competitors with their profiles and recent snapshots in minimal queries.
**When to use:** Server component page load.

```typescript
// Fetch competitors with profiles
const { data: competitors } = await supabase
  .from("user_competitors")
  .select(`
    competitor_id,
    added_at,
    competitor_profiles (
      id, tiktok_handle, display_name, avatar_url, verified,
      follower_count, following_count, heart_count, video_count,
      last_scraped_at, scrape_status
    )
  `)
  .order("added_at", { ascending: false });

// Fetch snapshots for all competitor IDs (last 14 days for sparklines)
const competitorIds = competitors?.map((c) => c.competitor_id) ?? [];
const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];

const { data: snapshots } = await supabase
  .from("competitor_snapshots")
  .select("competitor_id, follower_count, snapshot_date")
  .in("competitor_id", competitorIds)
  .gte("snapshot_date", fourteenDaysAgo)
  .order("snapshot_date", { ascending: true });
```

**Important:** The junction table RLS policy ensures `user_competitors` returns only rows where `user_id = auth.uid()`. The `competitor_profiles` join works because the profile SELECT policy checks `id IN (SELECT competitor_id FROM user_competitors WHERE user_id = auth.uid())`. This means a single authenticated query returns only the user's competitors -- no extra filtering needed in application code.

### Anti-Patterns to Avoid

- **Fetching data in Zustand store:** Do NOT create a `fetchCompetitors()` action in a Zustand store. Server component fetching is faster, avoids client waterfalls, and naturally integrates with RLS. Use Zustand only for client UI state (view mode).
- **Using `useEffect` + client Supabase for initial data load:** This creates a loading waterfall (page renders -> auth check -> query -> render). Server components eliminate this.
- **Putting engagement rate in the database:** Engagement rate is a computed value from videos. Calculate it on the fly from video data. Storing it creates staleness issues.
- **Using `<Image>` from next/image for TikTok avatars without configuring remote patterns:** TikTok avatar URLs come from `p16-sign-sg.tiktokcdn.com` and similar CDN domains. Either add to `next.config.ts` `remotePatterns` or use a plain `<img>` tag. The Avatar component uses Radix AvatarImage which renders a native `<img>` -- no config needed.
- **Large Supabase queries without `.in()` guard:** If `competitorIds` is empty, `.in("competitor_id", [])` returns nothing. Always guard against empty arrays to avoid unnecessary queries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sparkline chart | SVG path generator | Recharts `<LineChart>` with zero chrome | Already installed, handles edge cases (empty data, resize), accessible |
| Number formatting (1.2M, 45.3K) | Custom formatter | Simple utility function | Straightforward math, no library needed, but must handle null/BIGINT |
| View toggle (grid/table) | Custom toggle state | Radix `<Tabs>` + Zustand persist | Tabs component already exists with full a11y, Zustand persist matches sidebar pattern |
| Avatar with fallback | Custom image loading | Radix `<Avatar>` component | Already exists at `src/components/ui/avatar.tsx`, handles load/error states |
| Skeleton loading | Custom shimmer div | Existing `<Skeleton>` component | Already exists at `src/components/ui/skeleton.tsx` with shimmer animation |
| Growth delta badge | Custom colored span | Existing `<Badge>` with `success`/`error` variant | Badge component has semantic color variants |

**Key insight:** The design system already has 90% of the building blocks: Card, Avatar, Badge, Skeleton, Tabs, Button. Phase 3 is primarily composition of existing components with competitor-specific data mapping.

## Common Pitfalls

### Pitfall 1: Supabase Join Returns Nested Object, Not Flat Row
**What goes wrong:** Supabase `.select("user_competitors.*, competitor_profiles(*)")` returns `{ competitor_id: "...", competitor_profiles: { id: "...", tiktok_handle: "..." } }` -- the profile is a nested object, not flattened.
**Why it happens:** Supabase PostgREST returns foreign key relationships as nested objects.
**How to avoid:** Type the response correctly. The profile data is at `competitor.competitor_profiles`, not at the top level. Define a TypeScript type for the joined response.
**Warning signs:** TypeScript errors accessing `competitor.tiktok_handle` instead of `competitor.competitor_profiles.tiktok_handle`.

### Pitfall 2: BIGINT Metric Display
**What goes wrong:** BIGINT values from PostgreSQL arrive as `number` in JavaScript. For viral creators with 2B+ followers, this can exceed JavaScript's safe integer range (2^53).
**Why it happens:** The database uses BIGINT for follower_count, heart_count, etc. JavaScript `number` type has limited precision.
**How to avoid:** The database.types.ts defines these as `number` (Supabase JS client coerces). For display, use the `formatCount()` utility which handles millions/billions formatting. For extremely large numbers (> 9 quadrillion), this won't matter for TikTok metrics -- the largest TikTok account has ~160M followers.
**Warning signs:** Numbers displaying as scientific notation or losing precision.

### Pitfall 3: Empty Snapshots Array for New Competitors
**What goes wrong:** A competitor just added has zero or one snapshot. Sparkline and velocity calculations fail or render nothing.
**Why it happens:** Snapshots accumulate daily from the cron job. A newly added competitor has at most 1 snapshot (from the initial scrape).
**How to avoid:** Guard all sparkline/velocity code: `if (snapshots.length < 2) return null`. Show a "Not enough data" indicator or hide the sparkline for new competitors.
**Warning signs:** Empty sparkline areas, NaN percentages, crashes on `.sort()` of empty arrays.

### Pitfall 4: TikTok Avatar URLs and CORS/CSP
**What goes wrong:** TikTok CDN avatar URLs may fail to load due to CORS or Content Security Policy restrictions.
**Why it happens:** TikTok uses multiple CDN domains (p16-sign-sg.tiktokcdn.com, p16-sign-va.tiktokcdn.com, etc.) that rotate.
**How to avoid:** Use the Radix `<Avatar>` component which has built-in fallback (shows initials when image fails). Do NOT use `next/image` for avatars -- use native `<img>` via Radix. The Avatar component at `src/components/ui/avatar.tsx` already handles this with `<AvatarFallback>`.
**Warning signs:** Broken image icons, console CORS errors, images loading then disappearing.

### Pitfall 5: Hydration Mismatch with Zustand Persist
**What goes wrong:** Server renders with default state (grid view), client hydrates from localStorage (table view) -- React throws hydration mismatch.
**Why it happens:** `persist` middleware reads localStorage on mount, which doesn't exist on server.
**How to avoid:** Use `suppressHydrationWarning` on the container, OR render both views with CSS visibility toggle based on state, OR accept the brief flash (standard Zustand persist behavior). The sidebar store uses persist without issues -- follow the same pattern.
**Warning signs:** React hydration mismatch warnings in console, brief layout shift on load.

### Pitfall 6: next.config.ts remotePatterns Missing TikTok CDN
**What goes wrong:** If someone uses `next/image` for avatars, they'll get a build error because TikTok CDN domains aren't in `remotePatterns`.
**Why it happens:** Current `next.config.ts` only allows `picsum.photos` domains.
**How to avoid:** Either: (a) use native `<img>` via Radix Avatar (recommended, no config change needed), or (b) add TikTok CDN patterns to next.config.ts. Option (a) is better because TikTok CDN domains change.
**Warning signs:** Build errors mentioning "invalid src prop", runtime errors about unoptimized images.

## Code Examples

Verified patterns from official sources and existing codebase:

### Competitor Card Composition (Using Existing Components)
```typescript
// Compose from existing Card, Avatar, Badge, + new Sparkline
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Text, Caption } from "@/components/ui/typography";
import { CompetitorSparkline } from "./competitor-sparkline";
import { GrowthDelta } from "./growth-delta";
import { formatCount } from "@/lib/competitors-utils";

// Card uses existing Raycast styling:
// - bg-transparent, border-white/[0.06], rounded-[12px]
// - hover:bg-white/[0.02]
// - inset shadow rgba(255,255,255,0.05)
```

### Skeleton Card (Using Existing Skeleton)
```typescript
// Source: existing src/components/ui/skeleton.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CompetitorCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
```

### Empty State Pattern
```typescript
// Matches project empty state conventions (centered, muted text, CTA button)
import { Button } from "@/components/ui/button";
import { Users } from "@phosphor-icons/react";

function CompetitorEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
        <Users size={32} className="text-foreground-muted" weight="thin" />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-1">
        No competitors tracked yet
      </h2>
      <p className="text-sm text-foreground-muted mb-6 text-center max-w-sm">
        Add your first TikTok competitor to start tracking their growth, engagement, and content strategy.
      </p>
      <Button variant="primary">Add Competitor</Button>
    </div>
  );
}
```

### Sidebar Navigation Entry
```typescript
// Add to navItems array in src/components/app/sidebar.tsx
// Uses existing SidebarNavItem component
import { UsersThree } from "@phosphor-icons/react";

// Add to navItems array (after Trending):
{ label: "Competitors", icon: UsersThree, id: "competitors", href: "/competitors" }
```

### Table View (HTML Table with Raycast Styling)
```typescript
// Table matches dark theme: transparent bg, white/[0.06] borders, text-foreground-secondary
// Use <table> element (not a component library) for simplicity
// Sortable columns can be added in Phase 5 (BENCH-03)
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-white/[0.06]">
      <th className="py-3 px-4 text-left font-medium text-foreground-muted">Creator</th>
      <th className="py-3 px-4 text-right font-medium text-foreground-muted">Followers</th>
      <th className="py-3 px-4 text-right font-medium text-foreground-muted">Likes</th>
      {/* ... */}
    </tr>
  </thead>
  <tbody>
    {/* Rows with hover:bg-white/[0.02] */}
  </tbody>
</table>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side data fetching via useEffect | Server component fetch + props | Next.js 13+ (App Router) | No loading waterfall, instant data |
| Zustand for server state | Zustand for UI-only state, server components for data | Next.js 13+ RSC | Separation of concerns, less client JS |
| Custom chart libraries | Recharts v3 with composable components | Recharts 3.0 | Declarative API, tree-shakable |
| CSS Modules for loading skeletons | Tailwind + inline animation | Tailwind v4 | Consistent with design system |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps`: Replaced by async server components in App Router
- `SWR` / `@tanstack/react-query` for initial page data: Unnecessary when server components fetch data directly (still useful for mutations/revalidation, but not needed in Phase 3)

## Open Questions

1. **TikTok avatar CDN stability**
   - What we know: TikTok uses multiple CDN domains that rotate. Avatar URLs stored at scrape time may expire.
   - What's unclear: How long TikTok CDN URLs remain valid. Some expire after hours, some persist for months.
   - Recommendation: Use Radix Avatar fallback (initials from handle) as the safety net. If avatars become consistently broken in production, consider proxying through a Supabase storage bucket in Phase 7 (polish).

2. **Engagement rate data availability for new competitors**
   - What we know: Engagement rate requires video data. Phase 2 decision: video scraping is non-fatal -- profile can be tracked even if video scrape fails. Daily cron does NOT scrape videos (deferred to Phase 7).
   - What's unclear: For competitors where video scraping failed, engagement rate will show as "--". This is acceptable for MVP.
   - Recommendation: Show "--" for missing engagement rate with a tooltip "Video data not yet available". No blocker for Phase 3.

3. **Snapshot data for sparklines on day one**
   - What we know: Snapshots accumulate daily from cron. New competitors get 1 snapshot on add. Sparklines need 2+ data points.
   - What's unclear: Whether to show a placeholder or hide the sparkline entirely for new competitors.
   - Recommendation: Hide sparkline for < 2 data points. Show "Tracking started" text. After 2+ days of cron runs, sparklines will appear naturally.

## Sources

### Primary (HIGH confidence)
- Context7 `/recharts/recharts` - LineChart basic usage, ResponsiveContainer, Line component props
- Context7 `/pmndrs/zustand` - Async actions pattern, persist middleware, store creation
- Codebase `src/components/ui/card.tsx` - Card component with Raycast styling (lines 51-67)
- Codebase `src/components/ui/avatar.tsx` - Avatar with fallback (lines 152-165)
- Codebase `src/components/ui/skeleton.tsx` - Skeleton with shimmer (lines 14-31)
- Codebase `src/components/ui/tabs.tsx` - Tabs with Radix (lines 30-142)
- Codebase `src/components/ui/badge.tsx` - Badge with semantic variants (lines 33-79)
- Codebase `src/components/app/sidebar.tsx` - Navigation structure (lines 31-39)
- Codebase `src/stores/sidebar-store.ts` - Zustand persist pattern (lines 11-23)
- Codebase `src/app/(app)/dashboard/page.tsx` - Server component wrapper pattern
- Codebase `src/types/database.types.ts` - competitor_profiles, competitor_snapshots types
- Codebase `supabase/migrations/20260216100000_competitor_tables.sql` - RLS policies, schema

### Secondary (MEDIUM confidence)
- Codebase `.planning/phases/02-competitor-management/02-01-SUMMARY.md` - Server action patterns, ActionResult type
- Codebase `.planning/codebase/ARCHITECTURE.md` - Data flow patterns, client/server separation

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase and official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use throughout codebase
- Architecture: HIGH - Server component fetch + client component interactivity matches established dashboard pattern exactly
- Pitfalls: HIGH - All pitfalls identified from actual codebase analysis (RLS queries, BIGINT types, avatar URLs, snapshot availability)
- Code examples: HIGH - All examples derived from existing components in the codebase

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- all dependencies are established, no fast-moving APIs)
