# Phase 4: Detail Page & Analytics - Research

**Researched:** 2026-02-16
**Domain:** Next.js dynamic routes, Recharts charting (line/area/bar), data computation utilities, CSS grid heatmap, dark theme chart styling
**Confidence:** HIGH

## Summary

Phase 4 builds the competitor detail page -- a data-rich analytics view accessible by clicking any competitor card/row on the dashboard. The page lives at `/competitors/[handle]` and is split into two major sections: (1) growth/engagement metrics with Recharts charts, and (2) content analysis with video feeds, hashtag rankings, posting heatmap, and duration breakdown.

The existing codebase provides strong foundations to build on. Recharts ^3.7.0 is already installed and used for sparkline charts (`CompetitorSparkline`). The database schema already stores all required data: `competitor_snapshots` for time-series follower data, `competitor_videos` with per-video metrics (views, likes, comments, shares, saves, hashtags, duration_seconds, posted_at), and `competitor_profiles` for header data. The `competitors-utils.ts` utility file already has `formatCount`, `computeGrowthVelocity`, and `computeEngagementRate` functions that can be extended for the detail page.

The key architectural decision is server component data fetching. The detail page `page.tsx` should be a server component that fetches ALL data (profile, snapshots, videos) in parallel, then passes props to client chart components. This mirrors the existing `competitors/page.tsx` pattern (server fetches, client renders). All computation (engagement rate per video, average views, hashtag frequency, posting cadence, duration breakdown, heatmap aggregation) should happen in pure utility functions that run server-side to minimize client bundle size.

For the heatmap (CONT-05), Recharts has no native heatmap component. The correct approach is a pure CSS grid of divs with dynamic background-color opacity based on post frequency. This avoids fighting Recharts' API and produces a cleaner result. Zero new packages needed.

**Primary recommendation:** Build the detail page as a server component with parallel Supabase queries. Extract all analytics computation into `competitors-utils.ts` (pure functions, testable, server-safe). Use Recharts `AreaChart` with gradient fill for follower growth, `BarChart` for engagement breakdown and duration distribution, and a pure CSS grid for the posting time heatmap. Keep all chart wrapper components in `src/components/competitors/charts/` and detail section components in `src/components/competitors/detail/`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | ^3.7.0 | Line/area/bar charts | Already installed. Used for sparklines. Extends to full charts with same API |
| `@supabase/supabase-js` | ^2.93.1 | Database queries | Already installed. Server component queries via `createClient()` |
| `next` | 16.1.5 | Dynamic routes `[handle]` | Already installed. App Router dynamic segments |
| `tailwindcss` | ^4 | Layout + heatmap styling | Already installed. CSS grid for heatmap, responsive layout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.563.0 | Detail page icons (ArrowUp/Down, Eye, Heart, etc.) | Already installed. Used in GrowthDelta |
| `@phosphor-icons/react` | ^2.1.10 | Additional icons (TrendUp, etc.) | Already installed. Used in sidebar |
| `zustand` | ^5.0.10 | Active tab state on detail page (if needed) | Already installed. Currently stores view mode |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts AreaChart | Recharts LineChart | AreaChart with gradient fill looks more polished on dark theme. Same API, just adds fill |
| CSS grid heatmap | Recharts ScatterChart hack | Recharts has no native heatmap. ScatterChart requires custom shapes, awkward axis config. CSS grid is simpler, more accessible, more performant |
| Server-side computation | Client-side computation | Server-side keeps client bundle small. Videos array can be 30+ items -- computing engagement/hashtags/cadence server-side avoids sending raw data to client |
| Separate chart components | Inline charts in page | Separate components (`FollowerGrowthChart`, `EngagementChart`, etc.) are reusable for Phase 5 comparison views |

**Installation:**
```bash
# Nothing to install -- all dependencies already present
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(app)/competitors/
│   ├── page.tsx                          # Dashboard (exists)
│   ├── competitors-client.tsx            # Dashboard client (exists)
│   ├── loading.tsx                       # Dashboard loading (exists)
│   └── [handle]/
│       ├── page.tsx                      # Detail page server component (NEW)
│       └── loading.tsx                   # Detail page skeleton (NEW)
├── components/competitors/
│   ├── competitor-card.tsx               # Card component (exists)
│   ├── competitor-table.tsx              # Table component (exists)
│   ├── detail/
│   │   ├── detail-header.tsx             # Profile header section (NEW)
│   │   ├── growth-section.tsx            # Growth + avg views section (NEW)
│   │   ├── engagement-section.tsx        # Per-video engagement section (NEW)
│   │   ├── top-videos-section.tsx        # Top + recent videos (NEW)
│   │   ├── content-analysis-section.tsx  # Hashtags + heatmap + duration (NEW)
│   │   └── video-card.tsx               # Individual video card (NEW)
│   └── charts/
│       ├── follower-growth-chart.tsx     # AreaChart with gradient (NEW)
│       ├── engagement-bar-chart.tsx      # BarChart for per-video breakdown (NEW)
│       ├── posting-heatmap.tsx           # CSS grid heatmap (NEW)
│       └── duration-breakdown-chart.tsx  # Horizontal BarChart (NEW)
└── lib/
    └── competitors-utils.ts              # Extended with detail page computations (MODIFY)
```

### Pattern 1: Server Component Detail Page with Parallel Queries

**What:** The `[handle]/page.tsx` is an async server component that fetches profile, snapshots, and videos in parallel using `Promise.all`, then passes pre-computed data as props to client chart components.

**When to use:** Always for data-heavy pages where all data is available server-side.

**Why:** Minimizes waterfall requests. Keeps computation server-side (no shipping raw arrays to client). Mirrors existing `competitors/page.tsx` pattern.

**Example:**
```typescript
// Source: Existing competitors/page.tsx pattern + Next.js 15 docs
// src/app/(app)/competitors/[handle]/page.tsx

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface DetailPageProps {
  params: Promise<{ handle: string }>;
}

export default async function CompetitorDetailPage({ params }: DetailPageProps) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Verify user tracks this competitor (RLS enforces this, but we need profile_id)
  const { data: profile } = await supabase
    .from("competitor_profiles")
    .select("*")
    .eq("tiktok_handle", handle)
    .single();

  if (!profile) notFound();

  // Parallel fetch: snapshots + videos
  const [{ data: snapshots }, { data: videos }] = await Promise.all([
    supabase
      .from("competitor_snapshots")
      .select("*")
      .eq("competitor_id", profile.id)
      .order("snapshot_date", { ascending: true }),
    supabase
      .from("competitor_videos")
      .select("*")
      .eq("competitor_id", profile.id)
      .order("posted_at", { ascending: false }),
  ]);

  // Pass to client sections with pre-computed data
  return (
    <div className="space-y-8">
      <DetailHeader profile={profile} />
      <GrowthSection snapshots={snapshots ?? []} videos={videos ?? []} />
      <EngagementSection videos={videos ?? []} />
      <TopVideosSection videos={videos ?? []} />
      <ContentAnalysisSection videos={videos ?? []} />
    </div>
  );
}
```

### Pattern 2: Next.js 15 Dynamic Route Params (Async)

**What:** In Next.js 15, `params` is a Promise that must be awaited. This changed from Next.js 14 where params was a plain object.

**When to use:** Every `[handle]` dynamic route page and layout.

**Why:** Next.js 15 made this change for streaming/partial prerendering support. Failing to await params causes a TypeScript error and runtime warning.

**Example:**
```typescript
// Source: Next.js 15 migration docs
// CORRECT in Next.js 15:
interface PageProps {
  params: Promise<{ handle: string }>;
}

export default async function Page({ params }: PageProps) {
  const { handle } = await params;
  // ...
}

// INCORRECT (Next.js 14 pattern):
// export default async function Page({ params }: { params: { handle: string } }) {
//   const { handle } = params; // TypeScript error in Next.js 15
// }
```

### Pattern 3: Client Chart Wrapper Components

**What:** Each chart is a `"use client"` component that receives pre-computed data as props and renders Recharts components. The parent server component does all data fetching and computation.

**When to use:** For every Recharts chart (they require browser APIs: SVG, DOM events).

**Why:** Recharts components are inherently client-side (interactive, SVG-based). By wrapping them in dedicated client components, we keep the page server component tree clean and avoid `"use client"` bubbling up.

**Example:**
```typescript
// Source: Existing CompetitorSparkline pattern + Recharts docs
// src/components/competitors/charts/follower-growth-chart.tsx

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FollowerGrowthChartProps {
  data: { date: string; followers: number }[];
}

export function FollowerGrowthChart({ data }: FollowerGrowthChartProps) {
  if (data.length < 2) {
    return <p className="text-sm text-foreground-muted">Not enough data yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          stroke="var(--color-foreground-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--color-foreground-muted)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCount(v)}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="followers"
          stroke="var(--color-accent)"
          fill="url(#followerGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 4: Pure Utility Functions for Analytics Computation

**What:** All analytics logic (engagement rate per video, average views, hashtag frequency, posting cadence, posting time aggregation, duration bucketing) lives in `competitors-utils.ts` as pure functions.

**When to use:** For any computation that transforms raw database rows into display data.

**Why:** Pure functions are testable, server-safe (no `"use client"`), and reusable across detail page, comparison view (Phase 5), and AI context (Phase 6).

**Example functions to add:**
```typescript
// These extend the existing competitors-utils.ts

/** Compute engagement rate for a single video: (likes + comments + shares) / views * 100 */
export function computeVideoEngagementRate(video: VideoMetrics): number | null;

/** Compute average views across recent videos (last 30) */
export function computeAverageViews(videos: VideoMetrics[], limit?: number): number | null;

/** Compute posting frequency: posts per week over a date range */
export function computePostingCadence(videos: { posted_at: string | null }[]): {
  postsPerWeek: number;
  postsPerMonth: number;
} | null;

/** Extract and rank hashtags by frequency from video captions */
export function computeHashtagFrequency(
  videos: { hashtags: string[] | null }[]
): { tag: string; count: number }[];

/** Aggregate posting times into a 7x24 grid (day-of-week x hour) */
export function computePostingTimeGrid(
  videos: { posted_at: string | null }[]
): number[][];  // [dayOfWeek][hour] = count

/** Bucket videos by duration into format categories */
export function computeDurationBreakdown(
  videos: { duration_seconds: number | null }[]
): { label: string; count: number; percentage: number }[];
```

### Pattern 5: CSS Grid Heatmap (No Recharts)

**What:** A 7-row x 24-column CSS grid where each cell's background opacity represents post frequency. Days on Y-axis, hours on X-axis.

**When to use:** For the posting time heatmap (CONT-05).

**Why:** Recharts has no native heatmap component. Using ScatterChart with custom shapes is hacky and hard to maintain. A CSS grid is simpler, more accessible (real DOM elements, not SVG), responsive, and matches the dark theme naturally.

**Example:**
```typescript
// src/components/competitors/charts/posting-heatmap.tsx
"use client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface PostingHeatmapProps {
  /** 7x24 grid: grid[dayIndex][hourIndex] = post count */
  grid: number[][];
}

export function PostingHeatmap({ grid }: PostingHeatmapProps) {
  const maxCount = Math.max(...grid.flat(), 1);

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "40px repeat(24, 1fr)" }}>
        {/* Hour labels */}
        <div /> {/* Empty corner cell */}
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[10px] text-foreground-muted text-center">
            {h}
          </div>
        ))}

        {/* Day rows */}
        {DAYS.map((day, dayIdx) => (
          <>
            <div key={`label-${day}`} className="text-xs text-foreground-muted flex items-center">
              {day}
            </div>
            {Array.from({ length: 24 }, (_, h) => {
              const count = grid[dayIdx]?.[h] ?? 0;
              const opacity = count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0.03;
              return (
                <div
                  key={`${dayIdx}-${h}`}
                  className="aspect-square rounded-sm"
                  style={{ backgroundColor: `oklch(0.72 0.16 40 / ${opacity})` }}
                  title={`${day} ${h}:00 - ${count} posts`}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Fetching data on the client for the detail page:** All data is already in Supabase. Server components can fetch it in one round-trip. Don't use `useEffect` + client-side fetch for initial data load.
- **Passing raw video arrays to chart components:** Pre-compute all derived data (engagement rates, hashtag frequencies, etc.) in the server component or utility functions. Charts should receive simple `{ label, value }[]` arrays.
- **Using `"use client"` on the detail page.tsx:** Only chart wrappers and interactive elements need `"use client"`. The page itself should be a server component for zero-JS data fetching.
- **Putting all charts in one massive component:** Split into focused section components (`GrowthSection`, `EngagementSection`, `ContentAnalysisSection`). Each section handles its own layout and wraps its chart components.
- **Hardcoding chart colors:** Use CSS custom properties (`var(--color-accent)`, `rgba(255,255,255,0.06)`) to match the dark theme. Recharts accepts CSS variable strings for `stroke`, `fill`, and color props.
- **Forgetting to handle empty data:** Every chart must handle the case where snapshots or videos are empty (e.g., freshly added competitor with no historical data). Show a clear "Not enough data" message.
- **Using Next.js 14 params pattern:** In Next.js 15, `params` is a `Promise<{ handle: string }>`, not `{ handle: string }`. Must `await params`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Follower growth line chart | Custom SVG/Canvas chart | Recharts AreaChart | Already installed, handles responsive, tooltips, animations, dark theme |
| Number formatting | Custom format function | Existing `formatCount()` from `competitors-utils.ts` | Already handles K/M suffixes, null fallback |
| Engagement rate formula | Inline calculation | Existing `computeEngagementRate()` + new `computeVideoEngagementRate()` | Centralized, testable, reusable for Phase 5 |
| Growth velocity | Custom delta calculation | Existing `computeGrowthVelocity()` | Already handles edge cases (< 2 snapshots, 0 follower count) |
| Chart tooltip styling | Custom overlay component | Recharts `<Tooltip content={<CustomTooltip />}` /> | Recharts handles positioning, animation, outside-click dismiss |
| Responsive charts | Manual resize handlers | Recharts `<ResponsiveContainer>` | Already used in sparklines. Handles resize observer internally |
| Heatmap chart | Recharts ScatterChart hack | Pure CSS grid with dynamic opacity | Simpler, accessible, responsive, theme-matching. Recharts has no heatmap |

**Key insight:** This phase is primarily a UI/composition task with analytics computations. All the hard infrastructure (scraping, database, authentication) was done in Phases 1-2. The risk here is over-engineering the charts -- keep them simple, rely on Recharts defaults, and focus on dark theme integration.

## Common Pitfalls

### Pitfall 1: Recharts CSS Variable Resolution in SSR

**What goes wrong:** Recharts renders SVG on the server during SSR. CSS custom properties (`var(--color-accent)`) may not resolve correctly during server-side rendering because the SVG is generated before the browser processes CSS.

**Why it happens:** SVG `fill` and `stroke` attributes are evaluated at render time. During SSR, there's no CSS cascade to resolve `var()` references.

**How to avoid:** Mark all Recharts wrapper components as `"use client"`. This ensures they only render in the browser where CSS variables are available. The existing `CompetitorSparkline` already does this correctly. Additionally, `isAnimationActive={false}` prevents layout shift during hydration.

**Warning signs:** Charts render with missing colors (black fill/stroke) on initial page load, then flash to correct colors.

### Pitfall 2: Large Video Arrays in Client Bundle

**What goes wrong:** Passing raw `competitor_videos[]` (30+ rows, each with caption, hashtags, url, etc.) directly to client components inflates the RSC payload and client bundle.

**Why it happens:** Temptation to pass all data and compute client-side for interactivity.

**How to avoid:** Pre-compute all derived data in the server component. Chart components receive minimal `{ label: string; value: number }[]` arrays. Only the `video-card.tsx` component needs full video data, and only for the visible video list (already limited to 20 by CONT-04).

**Warning signs:** RSC payload exceeds 128KB. Page load time spikes. React DevTools shows large serialized props.

### Pitfall 3: Timezone Handling for Posting Time Heatmap

**What goes wrong:** `posted_at` timestamps from Apify are in UTC. The heatmap shows posting times in UTC, which doesn't match the viewer's timezone or the creator's timezone. A video posted at 9 AM EST shows as 2 PM on the heatmap.

**Why it happens:** No timezone conversion applied to `posted_at` before bucketing into hour-of-day.

**How to avoid:** For v1, display in UTC with a "(UTC)" label. Don't attempt timezone detection/conversion -- it's complex (creator timezone vs viewer timezone) and adds scope. Document as a Phase 7 improvement.

**Warning signs:** Users report heatmap doesn't match their intuitive sense of when a creator posts.

### Pitfall 4: Chart Container Height Collapse

**What goes wrong:** Recharts `ResponsiveContainer` with `width="100%"` and a percentage height collapses to 0px if the parent container has no explicit height.

**Why it happens:** CSS percentage heights require the parent to have a defined height. In a `space-y-8` flex layout, the chart container's height is content-based.

**How to avoid:** Always use explicit pixel height on `ResponsiveContainer`: `<ResponsiveContainer width="100%" height={300}>`. Never use percentage height without a fixed-height parent.

**Warning signs:** Chart renders as a 0-height invisible element. No errors in console.

### Pitfall 5: Hashtag Extraction from Both Fields

**What goes wrong:** The `competitor_videos` table has a `hashtags TEXT[]` column (extracted during scraping) AND hashtags embedded in the `caption` text (e.g., "#fyp #viral"). Only counting the `hashtags` array misses tags in captions, and counting both double-counts tags.

**Why it happens:** Apify's video scraper extracts hashtags into a structured array, but the caption text also contains the hashtag text.

**How to avoid:** Use the `hashtags` column as the source of truth for hashtag frequency analysis. The structured array is already extracted and normalized during scraping (Phase 1). Don't parse captions for hashtags -- it would double-count and be fragile.

**Warning signs:** Hashtag frequency counts are inflated (doubled) or inconsistent with visible captions.

### Pitfall 6: Division by Zero in Engagement Calculations

**What goes wrong:** Computing engagement rate as `(likes + comments + shares) / views * 100` crashes with `Infinity` or `NaN` when `views` is 0 or null.

**Why it happens:** New or private videos can have 0 views in the database.

**How to avoid:** The existing `computeEngagementRate` already filters `v.views > 0`. The new per-video function `computeVideoEngagementRate` must do the same. Always check `views !== null && views > 0` before dividing.

**Warning signs:** `NaN%` or `Infinity%` appearing in the UI.

## Code Examples

Verified patterns from official sources and existing codebase:

### Dark Theme Chart Tooltip
```typescript
// Reusable tooltip matching Raycast dark theme
// Source: Recharts docs + existing Raycast design tokens

"use client";

interface ChartTooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
  formatter?: (value: number) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter = (v) => v.toLocaleString(),
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
      style={{
        background: "#18191a",
        boxShadow: "rgba(0,0,0,0.5) 0px 4px 12px",
      }}
    >
      {label && (
        <p className="text-foreground-muted text-xs mb-1">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="text-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
    </div>
  );
}
```

### Engagement Rate Per Video Computation
```typescript
// Extension to competitors-utils.ts
// Formula from ENGM-01: (likes + comments + shares) / views * 100

interface VideoMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export function computeVideoEngagementRate(video: VideoMetrics): number | null {
  if (!video.views || video.views <= 0) return null;
  const engagement = (video.likes ?? 0) + (video.comments ?? 0) + (video.shares ?? 0);
  return Math.round((engagement / video.views) * 100 * 10) / 10;
}
```

### Duration Breakdown Bucketing
```typescript
// CONT-06: < 15s, 15-60s, 1-3min, 3min+

export function computeDurationBreakdown(
  videos: { duration_seconds: number | null }[]
): { label: string; count: number; percentage: number }[] {
  const buckets = [
    { label: "< 15s", min: 0, max: 15, count: 0 },
    { label: "15-60s", min: 15, max: 60, count: 0 },
    { label: "1-3 min", min: 60, max: 180, count: 0 },
    { label: "3+ min", min: 180, max: Infinity, count: 0 },
  ];

  const validVideos = videos.filter((v) => v.duration_seconds !== null && v.duration_seconds > 0);

  for (const video of validVideos) {
    const d = video.duration_seconds!;
    const bucket = buckets.find((b) => d >= b.min && d < b.max);
    if (bucket) bucket.count++;
  }

  const total = validVideos.length || 1;
  return buckets.map(({ label, count }) => ({
    label,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}
```

### Hashtag Frequency Extraction
```typescript
// CONT-03: Extract and rank hashtags from video hashtags array

export function computeHashtagFrequency(
  videos: { hashtags: string[] | null }[]
): { tag: string; count: number }[] {
  const freq: Record<string, number> = {};

  for (const video of videos) {
    if (!video.hashtags) continue;
    for (const tag of video.hashtags) {
      const normalized = tag.toLowerCase().trim();
      if (normalized) {
        freq[normalized] = (freq[normalized] ?? 0) + 1;
      }
    }
  }

  return Object.entries(freq)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
```

### Posting Time Grid Aggregation
```typescript
// CONT-05: Day-of-week x Hour grid for heatmap

export function computePostingTimeGrid(
  videos: { posted_at: string | null }[]
): number[][] {
  // 7 days x 24 hours, initialized to 0
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const video of videos) {
    if (!video.posted_at) continue;
    const date = new Date(video.posted_at);
    const day = date.getUTCDay(); // 0=Sun, 1=Mon, ...
    const hour = date.getUTCHours();
    // Shift to Mon=0, Sun=6 for display
    const adjustedDay = day === 0 ? 6 : day - 1;
    grid[adjustedDay][hour]++;
  }

  return grid;
}
```

### Linking Competitor Cards to Detail Page
```typescript
// Modification to existing competitor-card.tsx and competitor-table.tsx
// Wrap card/row in Next.js Link to /competitors/[handle]

import Link from "next/link";

// In CompetitorCard:
<Link href={`/competitors/${data.tiktok_handle}`}>
  <Card className="cursor-pointer">
    {/* existing card content */}
  </Card>
</Link>

// In CompetitorTable row:
<Link href={`/competitors/${c.tiktok_handle}`}>
  <tr className="... cursor-pointer">
    {/* existing row content */}
  </tr>
</Link>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 14 `params: { handle: string }` | Next.js 15 `params: Promise<{ handle: string }>` | Next.js 15 (Oct 2024) | Must await params. Old pattern causes TypeScript error |
| Recharts v2 `ResponsiveContainer` required wrapper div | Recharts v3 `ResponsiveContainer` works directly | Recharts 3.0 | Cleaner composition, same API |
| `generateStaticParams` for all pages | Dynamic rendering by default | Next.js 15 | Detail pages with handle param render dynamically (no ISR needed for user-specific data behind auth) |
| Chart.js for React | Recharts (already chosen) | Project decision | Recharts is more React-idiomatic (declarative components vs imperative API) |

**Deprecated/outdated:**
- **Next.js 14 params pattern**: `params` is now a Promise in Next.js 15. Synchronous access causes deprecation warning.
- **Recharts v2 `isAnimationActive` default**: v3 still defaults to `true`. Set `false` for SSR-hydrated charts to prevent layout shift.

## Open Questions

1. **Chart tooltip timezone display**
   - What we know: `posted_at` is stored as TIMESTAMPTZ (UTC). Heatmap grid uses UTC hours.
   - What's unclear: Whether users expect posting times in their local timezone vs the creator's timezone vs UTC.
   - Recommendation: Display UTC for v1 with "(UTC)" label. Add timezone selector in Phase 7 polish.

2. **Video thumbnail display in video cards**
   - What we know: The `competitor_videos` table has `video_url` but no thumbnail URL field. TikTok video URLs may have OG image metadata.
   - What's unclear: Whether Apify returns a thumbnail/cover image URL that we could store.
   - Recommendation: For v1, display video cards without thumbnails (text-based with metrics). Add thumbnail scraping as a Phase 7 enhancement if Apify provides cover images.

3. **Snapshot data sparsity for new competitors**
   - What we know: A freshly added competitor has exactly 1 snapshot (from `addCompetitor`). The growth chart needs >= 2 data points.
   - What's unclear: How many days of data the average user will have before viewing the detail page.
   - Recommendation: Show "Not enough data yet" for charts with < 2 data points. Show the single data point as a stat card instead. Cron will fill in data over time.

4. **Navigation back to dashboard**
   - What we know: The sidebar "Competitors" link goes to `/competitors`. The detail page is `/competitors/[handle]`.
   - What's unclear: Whether to add a breadcrumb (Competitors > @handle) or rely on sidebar navigation + browser back.
   - Recommendation: Add a simple breadcrumb at the top of the detail page. Minimal implementation: "< Back to Competitors" link.

## Sources

### Primary (HIGH confidence)
- Recharts documentation (Context7: /recharts/recharts) - AreaChart, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, CartesianGrid
- Existing codebase: `src/components/competitors/competitor-sparkline.tsx` - Recharts integration pattern, `"use client"` wrapper, `isAnimationActive={false}`
- Existing codebase: `src/app/(app)/competitors/page.tsx` - Server component data fetching pattern, parallel queries, prop passing
- Existing codebase: `src/lib/competitors-utils.ts` - Pure utility function pattern, engagement rate formula, number formatting
- Existing codebase: `src/types/database.types.ts` - Full schema for `competitor_profiles`, `competitor_snapshots`, `competitor_videos`
- Existing codebase: `src/app/globals.css` - CSS custom properties for dark theme colors
- Existing codebase: `src/components/competitors/competitor-card.tsx` - `CompetitorCardData` interface, card structure

### Secondary (MEDIUM confidence)
- [Recharts ScatterChart API](https://recharts.github.io/en-US/api/ScatterChart/) - ScatterChart component props
- [Next.js 15 Dynamic Routes docs](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes) - Async params pattern
- [Recharts heatmap issue #237](https://github.com/recharts/recharts/issues/237) - Confirms no native heatmap support
- [CodeSandbox: Heatmap on Cartesian Recharts](https://codesandbox.io/s/heatmap-on-cartesian-recharts-demo-39o5yv) - Heatmap workaround using Recharts

### Tertiary (LOW confidence)
- None. All findings verified against codebase or Context7.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed. Recharts patterns verified via Context7 with 215 code snippets. No new dependencies needed.
- Architecture: HIGH - Extends proven patterns from Phase 3 (server component + client wrapper). File structure follows existing conventions exactly.
- Pitfalls: HIGH - Identified from existing codebase patterns (sparkline SSR behavior), Recharts docs (ResponsiveContainer height), and database schema analysis (nullable fields, timezone storage).
- Chart implementations: HIGH for AreaChart/BarChart (Recharts native, verified via Context7). HIGH for CSS grid heatmap (simple div-based, no library dependency).
- Utility functions: HIGH - Pure functions with clear inputs/outputs, based on well-defined formulas from requirements (ENGM-01, CONT-02, CONT-03, CONT-05, CONT-06).

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stable domain, Recharts API and Next.js 15 patterns are well-established)
