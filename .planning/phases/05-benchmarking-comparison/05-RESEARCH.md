# Phase 5: Benchmarking & Comparison - Research

**Researched:** 2026-02-16
**Domain:** Side-by-side comparison UI, self-benchmarking, sortable table patterns, Recharts multi-series charts, Next.js searchParams-driven pages
**Confidence:** HIGH

## Summary

Phase 5 adds two major features on top of the existing competitor dashboard and detail pages: (1) a side-by-side comparison view where users can pick any two tracked competitors (or themselves vs. a competitor) to compare metrics in parallel columns, and (2) a sortable leaderboard table that ranks all tracked competitors by any metric column. Both features reuse the existing data layer (competitor_profiles, competitor_snapshots, competitor_videos) and utility functions (computeGrowthVelocity, computeEngagementRate, computePostingCadence, computeAverageViews) already built in Phases 1-4.

The comparison view lives at `/competitors/compare` with query params controlling which competitors are selected (`?a=handle1&b=handle2`). This is a server component that fetches both competitors' data in parallel, pre-computes all metrics server-side, and passes them to a client comparison component. For self-benchmarking (BENCH-02), the user's own TikTok handle is stored in `creator_profiles.tiktok_handle`. The key design challenge is that the user's data lives in `creator_profiles` (not `competitor_profiles`), so the user must also exist as a competitor_profile if they want rich analytics. The simplest approach is: when the user selects "Compare with me," scrape/upsert the user's handle into competitor_profiles (reusing the existing scraping pipeline), then fetch the same data structure as any competitor. This unifies the data model and avoids a parallel fetch path.

The sortable leaderboard (BENCH-03) enhances the existing `CompetitorTable` component with clickable column headers and client-side sorting state. Since all data is already fetched server-side and passed as props, sorting is purely a client-side array sort operation stored in Zustand or local component state.

**Primary recommendation:** Build the comparison page as a server component at `/competitors/compare/page.tsx` driven by searchParams. Create a `ComparisonView` client component that renders two parallel columns with metric cards and optional overlay Recharts charts (BarChart grouped bars for metric comparison, AreaChart with dual lines for growth overlay). Enhance the existing `CompetitorTable` with sortable headers. For self-benchmarking, auto-add the user's handle to `competitor_profiles` via the existing `addCompetitor` server action (or a lightweight variant) when they first request a self-comparison.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | ^3.7.0 | Grouped BarChart for metric comparison, dual-line AreaChart for growth overlay | Already installed. Recharts supports multiple `<Bar>` elements without `stackId` for grouped bars, and multiple `<Area>`/`<Line>` elements on the same chart |
| `@supabase/supabase-js` | ^2.93.1 | Fetch two competitors' data in parallel via server component | Already installed. Same query patterns as Phase 4 detail page |
| `next` | 16.1.5 | `searchParams` for comparison selection, server components | Already installed. App Router `searchParams` prop for page.tsx |
| `zustand` | ^5.0.10 | Sort state for leaderboard, view mode toggle | Already installed. Extend `competitors-store.ts` or local state |
| `tailwindcss` | ^4 | Two-column comparison layout, responsive grid | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.563.0 | Sort icons (ArrowUpDown, ChevronUp, ChevronDown) | Already installed. For sortable column headers |
| `@phosphor-icons/react` | ^2.1.10 | Navigation icons if needed | Already installed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| searchParams-driven comparison | Zustand store for selection | searchParams are shareable (URL copy), SEO-indexable, work with server components. Zustand would require client-side fetching |
| Grouped BarChart for metric comparison | RadarChart | RadarChart is visually striking but harder to read for non-technical users. BarChart is immediately understandable. Recharts supports both |
| Auto-add user to competitor_profiles | Separate user data model | Unifying the data model means all comparison logic is identical regardless of "self" or "competitor". No branching in fetch or display code |
| Client-side sort | Server-side sort via searchParams | With ~20 competitors max, client-side sort is instant (< 1ms). Server-side adds network round-trip. Client-side is simpler |

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
│   ├── competitors-client.tsx            # Dashboard client (exists, MODIFY for leaderboard sorting + compare link)
│   ├── compare/
│   │   ├── page.tsx                      # Comparison page server component (NEW)
│   │   ├── loading.tsx                   # Comparison page skeleton (NEW)
│   │   └── comparison-client.tsx         # Client comparison view (NEW)
│   └── [handle]/
│       └── page.tsx                      # Detail page (exists, ADD "Compare" button)
├── components/competitors/
│   ├── competitor-table.tsx              # Table (exists, MODIFY for sortable headers)
│   ├── comparison/
│   │   ├── comparison-view.tsx           # Side-by-side metric columns (NEW)
│   │   ├── comparison-selector.tsx       # Competitor picker dropdowns (NEW)
│   │   ├── comparison-metric-card.tsx    # Single metric comparison card (NEW)
│   │   ├── comparison-bar-chart.tsx      # Grouped BarChart for metrics (NEW)
│   │   └── comparison-growth-chart.tsx   # Dual-line growth overlay (NEW)
│   └── charts/
│       └── (existing chart components reused)
├── lib/
│   └── competitors-utils.ts             # (exists, ADD comparison-specific helpers)
└── stores/
    └── competitors-store.ts             # (exists, ADD sort state)
```

### Pattern 1: searchParams-Driven Comparison Page

**What:** Use Next.js `searchParams` to drive competitor selection so the URL is shareable and the page works as a server component.

**When to use:** Whenever page state should be bookmarkable, shareable, or needs server-side data fetching.

**Example:**
```typescript
// src/app/(app)/competitors/compare/page.tsx
interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { a, b } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch both competitor profiles in parallel
  const [profileA, profileB] = await Promise.all([
    a ? fetchCompetitorData(supabase, a, user.id) : null,
    b ? fetchCompetitorData(supabase, b, user.id) : null,
  ]);

  return (
    <ComparisonClient
      profileA={profileA}
      profileB={profileB}
      competitors={allCompetitors} // for selector dropdowns
    />
  );
}
```

### Pattern 2: Self-Benchmarking via Unified Data Model

**What:** When the user selects "Compare with me," treat their own TikTok handle as a competitor_profile entry. This avoids branching the data model.

**When to use:** For BENCH-02 self-benchmarking requirement.

**How it works:**
1. User clicks "Compare with me" on the comparison page
2. System reads `creator_profiles.tiktok_handle` for the current user
3. If a `competitor_profiles` entry already exists for that handle, use it
4. If not, trigger the existing scraping pipeline to create one (reuse `addCompetitor` logic)
5. Comparison view renders identically -- user's data is in the same shape as any competitor

**Key insight:** The user's `creator_profiles` only has `tiktok_followers` (INTEGER, no video data, no snapshots). The `competitor_profiles` table has full metrics, snapshots, and videos. For a meaningful comparison, the user's handle MUST go through the competitor scraping pipeline to get the same data granularity.

### Pattern 3: Client-Side Sortable Table

**What:** Enhance the existing `CompetitorTable` with clickable column headers that toggle sort direction.

**When to use:** For BENCH-03 sortable leaderboard requirement.

**Example:**
```typescript
// In competitor-table.tsx
type SortKey = "followers" | "likes" | "videos" | "engagement" | "growth" | "cadence";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

function useSortedCompetitors(
  competitors: CompetitorCardData[],
  sort: SortState
): CompetitorCardData[] {
  return useMemo(() => {
    const sorted = [...competitors].sort((a, b) => {
      let valA: number, valB: number;
      switch (sort.key) {
        case "followers":
          valA = a.follower_count ?? 0;
          valB = b.follower_count ?? 0;
          break;
        case "engagement":
          valA = computeEngagementRate(a.videos) ?? 0;
          valB = computeEngagementRate(b.videos) ?? 0;
          break;
        case "growth":
          valA = computeGrowthVelocity(a.snapshots)?.percentage ?? 0;
          valB = computeGrowthVelocity(b.snapshots)?.percentage ?? 0;
          break;
        case "cadence":
          valA = computePostingCadence(a.videos)?.postsPerWeek ?? 0;
          valB = computePostingCadence(b.videos)?.postsPerWeek ?? 0;
          break;
        // ... other cases
      }
      return sort.dir === "asc" ? valA - valB : valB - valA;
    });
    return sorted;
  }, [competitors, sort]);
}
```

### Pattern 4: Grouped BarChart for Metric Comparison

**What:** Recharts BarChart with two `<Bar>` elements (no `stackId`) for side-by-side grouped bars comparing metrics.

**When to use:** For the comparison page metric cards.

**Example:**
```typescript
// Source: Context7 /recharts/recharts
// Grouped bars: omit stackId prop to get side-by-side bars
<ResponsiveContainer width="100%" height={250}>
  <BarChart data={comparisonData}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
    <XAxis dataKey="metric" stroke="var(--color-foreground-muted)" fontSize={12} />
    <YAxis stroke="var(--color-foreground-muted)" fontSize={12} />
    <Tooltip content={<ChartTooltip />} />
    <Bar dataKey="competitorA" fill="var(--color-accent)" isAnimationActive={false} />
    <Bar dataKey="competitorB" fill="#82ca9d" isAnimationActive={false} />
  </BarChart>
</ResponsiveContainer>
```

### Anti-Patterns to Avoid

- **Fetching user data from creator_profiles for comparison:** The `creator_profiles` table has `tiktok_followers` (single integer, no time-series, no videos). Using it directly for comparison would create an asymmetric view. Always use `competitor_profiles` + `competitor_snapshots` + `competitor_videos` for both sides.

- **Client-side data fetching for comparison:** Resist the urge to fetch competitor data client-side when the user changes selection. Use router.push with new searchParams to trigger a server component re-render. This keeps data fetching in server components.

- **Sorting in Zustand store:** Sort state for the leaderboard table does not need persistence. Use `useState` inside the table component unless there's a strong reason for persistence across navigation.

- **Building a separate metric computation path for "self":** The self-benchmarking path should use exactly the same data structures and utility functions as competitor-vs-competitor. One code path, not two.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table headers | Custom sort implementation from scratch | `useMemo` with `Array.sort` + sort state | Trivial with ~20 items. No library needed. Just track `{key, dir}` and sort in useMemo |
| Grouped bar chart | Custom SVG bars | Recharts `<Bar>` without `stackId` | Recharts handles grouped positioning, labels, tooltips automatically |
| Multi-line growth chart | Custom SVG paths | Recharts `<AreaChart>` with two `<Area>` elements | Dual data series is native to Recharts. Same pattern as existing FollowerGrowthChart, just add a second Area |
| URL-driven state | Complex state management | Next.js `searchParams` + `useRouter().push()` | searchParams is the standard pattern for filter/comparison state in Next.js App Router |
| Competitor selection UI | Custom multi-select | Two `<SearchableSelect>` components (existing) | The `SearchableSelect` component in `src/components/ui/select.tsx` already handles search-to-filter with full keyboard nav |

**Key insight:** Every component needed for Phase 5 either already exists or is a minor composition of existing parts. No new UI primitives, no new data fetching patterns, no new libraries.

## Common Pitfalls

### Pitfall 1: Self-Benchmarking Data Gap
**What goes wrong:** User connects TikTok @handle during onboarding, but their handle has never been scraped into `competitor_profiles`. The comparison page shows empty data for "You."
**Why it happens:** `creator_profiles.tiktok_handle` is just a text field from onboarding. It does not trigger scraping.
**How to avoid:** When the user first requests a self-comparison, check if their handle exists in `competitor_profiles`. If not, trigger a scrape (reuse `addCompetitor` server action). Show a loading state during this initial scrape. Cache the result -- subsequent comparisons are instant.
**Warning signs:** "You" column shows all "--" values or null metrics.

### Pitfall 2: N+1 Queries in Comparison Page
**What goes wrong:** Fetching profile, snapshots, and videos in separate sequential queries for each competitor (4+ round-trips).
**Why it happens:** Copy-pasting the detail page fetch pattern without batching.
**How to avoid:** Use `Promise.all` to fetch both competitors' data in parallel. Within each competitor, also parallelize snapshots + videos fetch (same pattern as existing `[handle]/page.tsx`).
**Warning signs:** Comparison page is noticeably slower than detail page.

### Pitfall 3: Sorting Recomputes Derived Metrics Every Render
**What goes wrong:** Calling `computeEngagementRate()` and `computeGrowthVelocity()` inside the sort comparator on every render.
**Why it happens:** These are O(n) functions over the videos/snapshots arrays. Calling them in sort comparator makes overall complexity O(n * m * log(m)) where m = number of competitors.
**How to avoid:** Pre-compute all derived metrics once (in useMemo or server-side) into an enriched array, then sort on the pre-computed values. With ~20 competitors this is not a performance problem, but it's cleaner code.
**Warning signs:** Unnecessary re-computation on each sort toggle.

### Pitfall 4: Broken "Compare" Navigation from Dashboard
**What goes wrong:** User selects two competitors to compare but the URL is constructed incorrectly (missing handles, wrong encoding).
**Why it happens:** TikTok handles can contain periods and underscores which may need encoding.
**How to avoid:** Use `encodeURIComponent()` when constructing the comparison URL. Decode in the comparison page with `decodeURIComponent()`. Test with handles like `user.name_123`.
**Warning signs:** 404 or empty state on comparison page despite valid selections.

### Pitfall 5: Stale SearchableSelect Options
**What goes wrong:** Competitor list in the comparison selector does not include a recently added competitor.
**Why it happens:** The competitor list was fetched server-side during initial page load and is not updated when a new competitor is added in another tab.
**How to avoid:** The server component re-renders on navigation. Using `router.push` to update searchParams triggers a fresh server-side fetch. This is sufficient. Do not add client-side caching of the competitor list.
**Warning signs:** New competitor missing from comparison picker until page refresh.

## Code Examples

Verified patterns from official sources and existing codebase:

### Fetching Two Competitors in Parallel (Server Component)
```typescript
// Reuses the exact query pattern from existing [handle]/page.tsx
async function fetchCompetitorData(
  supabase: SupabaseClient,
  handle: string,
  userId: string
) {
  // Verify user tracks this competitor
  const { data: profile } = await supabase
    .from("competitor_profiles")
    .select("*")
    .eq("tiktok_handle", handle)
    .single();

  if (!profile) return null;

  const { data: junction } = await supabase
    .from("user_competitors")
    .select("id")
    .eq("competitor_id", profile.id)
    .eq("user_id", userId)
    .single();

  if (!junction) return null;

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

  return { profile, snapshots: snapshots ?? [], videos: videos ?? [] };
}
```

### Sortable Column Header Component
```typescript
// Source: Existing codebase patterns + standard React pattern
interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}

function SortableHeader({ label, sortKey, currentSort, onSort, align = "right" }: SortableHeaderProps) {
  const isActive = currentSort.key === sortKey;

  return (
    <th
      className={cn(
        "py-3 px-4 font-medium text-foreground-muted text-xs cursor-pointer select-none transition-colors hover:text-foreground",
        align === "right" ? "text-right" : "text-left"
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </span>
    </th>
  );
}
```

### Dual-Line Growth Comparison Chart
```typescript
// Source: Context7 /recharts/recharts - multiple Area elements on same chart
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={mergedGrowthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
    <defs>
      <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
    <XAxis dataKey="date" stroke="var(--color-foreground-muted)" fontSize={12} />
    <YAxis stroke="var(--color-foreground-muted)" fontSize={12} tickFormatter={formatCount} />
    <Tooltip content={<ChartTooltip formatter={formatCount} />} />
    <Area type="monotone" dataKey="followersA" stroke="var(--color-accent)" fill="url(#gradA)" strokeWidth={2} isAnimationActive={false} />
    <Area type="monotone" dataKey="followersB" stroke="#82ca9d" fill="url(#gradB)" strokeWidth={2} isAnimationActive={false} />
  </AreaChart>
</ResponsiveContainer>
```

### Comparison Metric Card
```typescript
// Simple stat comparison: two values side by side with colored indicator for "winner"
interface ComparisonMetricCardProps {
  label: string;
  valueA: string;
  valueB: string;
  rawA: number;
  rawB: number;
  handleA: string;
  handleB: string;
}

function ComparisonMetricCard({ label, valueA, valueB, rawA, rawB, handleA, handleB }: ComparisonMetricCardProps) {
  const aWins = rawA > rawB;
  const bWins = rawB > rawA;
  const tie = rawA === rawB;

  return (
    <div className="border border-white/[0.06] rounded-xl p-4">
      <p className="text-xs text-foreground-muted mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={cn("text-lg font-semibold", aWins && !tie ? "text-accent" : "text-foreground")}>
            {valueA}
          </p>
          <p className="text-xs text-foreground-muted truncate">@{handleA}</p>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-semibold", bWins && !tie ? "text-accent" : "text-foreground")}>
            {valueB}
          </p>
          <p className="text-xs text-foreground-muted truncate">@{handleB}</p>
        </div>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side data fetching in comparison pages | Server component with searchParams-driven fetching | Next.js App Router (stable since Next 13.4, current 16.1.5) | Eliminates loading waterfalls, enables sharing comparison URLs |
| Separate chart library for comparison (e.g., Chart.js) | Same Recharts instance with multi-series data | Recharts 2.x+ (current 3.7.0) | No bundle size increase. Multi-series is a core Recharts feature |
| Complex state management for table sorting | Simple useState + useMemo | React standard pattern | For small datasets (~20 items), simple patterns outperform library solutions |

**Deprecated/outdated:**
- `pages/` directory routing for Next.js: Use App Router `app/` with async `searchParams`.
- Recharts `<BarChart layout="vertical">` for comparison: Horizontal grouped bars are more intuitive for metric comparison.

## Data Model Considerations

### User Self-Benchmarking Data Flow

The user's TikTok handle is stored in two places:

| Table | Field | Data Available | Limitations |
|-------|-------|---------------|-------------|
| `creator_profiles` | `tiktok_handle`, `tiktok_followers` | Handle string, follower count (integer) | No video data, no snapshots, no heart_count, stale (set at onboarding) |
| `competitor_profiles` | `tiktok_handle`, full metrics | Full profile, snapshots, videos, engagement | Only exists if someone tracked this handle as a competitor |

**Recommendation:** For self-benchmarking, the user's handle MUST be in `competitor_profiles` with scraped data. The flow is:

1. User requests self-comparison
2. Server checks if `competitor_profiles` row exists for user's handle
3. If not: scrape via existing pipeline (same as `addCompetitor`), insert profile + snapshot + videos
4. Also create a `user_competitors` junction row so RLS allows the user to read their own scraped data
5. Fetch comparison data using the unified competitor data model

This is a one-time operation per user. After the first self-comparison, subsequent requests are instant.

### Comparison Metrics to Display

Based on existing utility functions and the requirements:

| Metric | Source | Computation | Utility Function |
|--------|--------|-------------|-----------------|
| Followers | `competitor_profiles.follower_count` | Direct | `formatCount()` |
| Total Likes | `competitor_profiles.heart_count` | Direct | `formatCount()` |
| Video Count | `competitor_profiles.video_count` | Direct | `formatCount()` |
| Engagement Rate | `competitor_videos` | (likes+comments+shares)/views*100 | `computeEngagementRate()` |
| Growth Rate | `competitor_snapshots` | Week-over-week % change | `computeGrowthVelocity()` |
| Posting Frequency | `competitor_videos.posted_at` | Posts per week | `computePostingCadence()` |
| Avg Views/Video | `competitor_videos.views` | Mean of last 30 | `computeAverageViews()` |

All utility functions already exist in `src/lib/competitors-utils.ts`. No new computation functions needed.

### Sortable Leaderboard Metrics

For BENCH-03, the table needs sorting by:
- Followers (direct from `follower_count`)
- Growth rate (computed via `computeGrowthVelocity`)
- Engagement rate (computed via `computeEngagementRate`)
- Posting frequency (computed via `computePostingCadence`)

**Implementation note:** Pre-compute all derived metrics in the server component (or in a useMemo in the client) into an enriched data structure, then sort on pre-computed values. This avoids recomputing on every sort toggle.

## Open Questions

1. **Compare button placement on dashboard**
   - What we know: Users need a way to select two competitors for comparison. The dashboard has a card grid and a table.
   - What's unclear: Should there be checkboxes on cards/rows, a dedicated "Compare" button in the header, or a floating action?
   - Recommendation: Add a "Compare" link/button in the page header area (next to Grid/Table toggle). Clicking it navigates to `/competitors/compare` where the user picks from dropdowns. This is simpler than adding selection state to the dashboard and keeps the dashboard clean.

2. **Self-comparison trigger UX**
   - What we know: The user's TikTok handle is in `creator_profiles`. Comparison needs it in `competitor_profiles`.
   - What's unclear: Should we auto-scrape the user's handle at onboarding time to pre-populate, or wait until they first request a comparison?
   - Recommendation: Lazy scrape on first comparison request. This avoids unnecessary API calls for users who never use the comparison feature. Show a "Setting up your profile for comparison..." loading state.

3. **Max competitors for leaderboard sorting**
   - What we know: Users can track unlimited competitors in theory. Sorting is client-side.
   - What's unclear: At what scale does client-side sorting become slow?
   - Recommendation: Not a concern for v1. JavaScript sorts 1000 items in < 1ms. Even 100 tracked competitors would be instant. No pagination needed.

## Sources

### Primary (HIGH confidence)
- Context7 `/recharts/recharts` - Verified: multiple `<Bar>` elements without `stackId` produces grouped (side-by-side) bars, multiple `<Area>` elements on one chart works natively, `RadarChart` with multiple `<Radar>` elements for multi-series comparison
- Existing codebase: `src/lib/competitors-utils.ts` - All computation functions verified in code
- Existing codebase: `src/app/(app)/competitors/[handle]/page.tsx` - Server component parallel fetch pattern verified
- Existing codebase: `src/components/ui/select.tsx` - `SearchableSelect` component with full keyboard navigation verified
- Existing codebase: `src/components/competitors/competitor-table.tsx` - Current table structure verified, sortable headers can be added to existing `<th>` elements
- Existing codebase: `supabase/migrations/20260216100000_competitor_tables.sql` - Schema verified for all data needed
- Existing codebase: `supabase/migrations/20260202000000_v16_schema.sql` - `creator_profiles.tiktok_handle` field verified

### Secondary (MEDIUM confidence)
- Next.js App Router `searchParams` as Promise in page.tsx - Verified in existing `[handle]/page.tsx` which uses `Promise<{ handle: string }>` for params

### Tertiary (LOW confidence)
- None. All patterns verified against existing codebase or Context7.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use. No new dependencies.
- Architecture: HIGH - Follows exact same server component + client chart pattern established in Phases 3-4. searchParams pattern verified in Next.js App Router.
- Pitfalls: HIGH - All pitfalls derived from analyzing existing data model and code patterns. Self-benchmarking data gap is the most critical and has a clear solution.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no fast-moving dependencies)
