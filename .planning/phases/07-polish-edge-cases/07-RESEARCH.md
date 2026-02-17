# Phase 7: Polish & Edge Cases - Research

**Researched:** 2026-02-17
**Domain:** UI polish, error/stale state handling, responsive design
**Confidence:** HIGH

## Summary

Phase 7 is a cross-cutting polish phase that adds three capabilities to the existing competitor tracker: stale data indicators, error states with retry, and mobile responsiveness. The good news is that the infrastructure for all three is already partially in place -- `last_scraped_at` and `scrape_status` columns exist in `competitor_profiles` and are already queried on the competitors listing page. The data just needs to be threaded through to the UI components and displayed.

The responsive work is straightforward Tailwind mobile-first refactoring. All Recharts charts already use `ResponsiveContainer` with `width="100%"`, so they resize natively. The main gaps are: fixed-column grid layouts that don't collapse on small screens, tables that overflow without horizontal scroll affordance, and the detail page stats row using `grid-cols-3` with no responsive step-down.

**Primary recommendation:** Thread `last_scraped_at` and `scrape_status` through existing component interfaces, add a reusable `<StaleIndicator>` and `<ScrapeErrorBanner>` component pair, then audit every competitor view for responsive breakpoints.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | v4 | Responsive breakpoints, utility classes | Already in project, mobile-first by default |
| Recharts | v3.7 | Chart responsiveness | Already used, `ResponsiveContainer` handles resize |
| Zustand | v5.0 | UI state (view mode) | Already used for competitors store |
| Radix UI Tabs | v1.1 | View toggle | Already used in competitors-client |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | v0.563 | Icons for stale/error indicators | Already in project, used across detail components |
| Phosphor Icons | v2.1 | Alternative icons | Already in project, used in sidebar/intelligence |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom relative time | `date-fns formatDistanceToNow` | Zero new deps constraint -- hand-roll is fine for simple "2h ago" display |
| Custom retry button | React Query mutation | Overkill -- a simple server action call with `useTransition` suffices |

**Installation:**
```bash
# No new packages needed -- zero new npm packages constraint
```

## Architecture Patterns

### Existing File Structure (Files to Modify)
```
src/
├── components/competitors/
│   ├── competitor-card.tsx         # Add stale indicator, error badge
│   ├── competitor-table.tsx        # Add stale/error column, responsive scroll
│   ├── competitor-empty-state.tsx   # Already responsive
│   ├── detail/
│   │   ├── detail-header.tsx       # Add stale indicator, error banner, responsive stats
│   │   ├── growth-section.tsx      # Responsive grid adjustments
│   │   ├── engagement-section.tsx  # Responsive table scroll
│   │   ├── top-videos-section.tsx  # Already has responsive grid
│   │   └── content-analysis-section.tsx  # Responsive heatmap
│   ├── comparison/
│   │   ├── comparison-metric-card.tsx  # Responsive text sizing
│   │   └── comparison-selector.tsx     # Already responsive (flex-col sm:flex-row)
│   ├── intelligence/
│   │   └── intelligence-section.tsx    # Responsive card grid
│   └── charts/
│       ├── posting-heatmap.tsx         # Needs mobile scroll indicator
│       └── [all charts]               # Already use ResponsiveContainer
├── app/(app)/competitors/
│   ├── competitors-client.tsx      # Thread stale/error data to cards
│   ├── page.tsx                    # Already queries last_scraped_at, scrape_status
│   ├── [handle]/page.tsx           # Pass profile.last_scraped_at to detail header
│   └── compare/comparison-client.tsx  # Responsive metric grid
└── components/competitors/
    ├── stale-indicator.tsx         # NEW: reusable timestamp display
    └── scrape-error-banner.tsx     # NEW: error state with retry button
```

### Pattern 1: Stale Data Indicator
**What:** A small, unobtrusive component showing when data was last refreshed using relative time (e.g., "Updated 2h ago", "Updated 3d ago").
**When to use:** On every competitor view that displays scraped data.
**Example:**
```typescript
// Pure function -- no library needed for simple relative time
function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// Stale threshold: > 48 hours shows warning color
function isStale(isoDate: string | null): boolean {
  if (!isoDate) return true;
  return Date.now() - new Date(isoDate).getTime() > 48 * 60 * 60 * 1000;
}

// Component
function StaleIndicator({ lastScrapedAt }: { lastScrapedAt: string | null }) {
  const stale = isStale(lastScrapedAt);
  return (
    <span className={`text-xs ${stale ? "text-warning" : "text-foreground-muted"}`}>
      Updated {formatRelativeTime(lastScrapedAt)}
    </span>
  );
}
```

### Pattern 2: Error State with Retry
**What:** A banner/badge showing scrape failure with a retry button that calls `addCompetitor` server action to re-scrape.
**When to use:** When `scrape_status === "failed"`.
**Example:**
```typescript
"use client";
import { useTransition } from "react";

function ScrapeErrorBanner({
  handle,
  onRetry,
}: {
  handle: string;
  onRetry: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border border-red-500/20 bg-red-500/[0.05] rounded-lg p-3 flex items-center justify-between">
      <span className="text-sm text-red-400">
        Data refresh failed
      </span>
      <button
        onClick={() => startTransition(() => onRetry())}
        disabled={isPending}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/[0.06] text-foreground hover:bg-white/[0.02] disabled:opacity-50"
      >
        {isPending ? "Retrying..." : "Retry"}
      </button>
    </div>
  );
}
```

### Pattern 3: Responsive Grid Step-Down
**What:** Using Tailwind mobile-first breakpoints to collapse multi-column grids on small screens.
**When to use:** Any grid that currently starts at 2+ columns.
**Example:**
```typescript
// Before (detail-header stats):
<div className="grid grid-cols-3 gap-4">

// After:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">

// Before (comparison metrics):
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

// After (already good -- starts at 2 cols which works on mobile):
// Keep as-is, but reduce gap on mobile:
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
```

### Anti-Patterns to Avoid
- **Don't add new npm packages:** Constraint from prior decisions. `formatDistanceToNow` from date-fns is tempting but a 5-line helper does the job.
- **Don't use client-side data fetching for retry:** Use server actions with `useTransition` for retry. Keeps the pattern consistent with `addCompetitor`.
- **Don't hide content on mobile:** Stack vertically instead. Every piece of data shown on desktop should be accessible on mobile, even if scrollable.
- **Don't add "use client" to server components for stale indicators:** Pass `lastScrapedAt` as a prop and render the indicator in the nearest existing client component, or keep the indicator as a server component if no interactivity needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive charts | Custom SVG viewport logic | Recharts `ResponsiveContainer` | Already in use, handles resize via ResizeObserver |
| Horizontal scroll indicator | Custom scroll detection JS | CSS `overflow-x-auto` + visual gradient fade | Pure CSS, no JS needed |
| Retry mechanism | Custom retry queue/polling | Server action + `useTransition` | React 19 pattern, already used in project |
| Relative time display | Full i18n time library | Simple `formatRelativeTime` helper | 10 lines of code, no edge cases for "Xh/Xd ago" |

**Key insight:** This phase is about threading existing data through existing components and adjusting CSS. There is almost no new logic to build.

## Common Pitfalls

### Pitfall 1: Data Threading Gaps
**What goes wrong:** `last_scraped_at` and `scrape_status` are already fetched on the competitors page but NOT passed through `CompetitorCardData` or used in any component. Easy to miss threading it to ALL views.
**Why it happens:** Data exists in the server query but the interface types (`CompetitorCardData`, `CompetitorRow`) don't include these fields.
**How to avoid:** Extend `CompetitorCardData` interface with `last_scraped_at` and `scrape_status` fields. Update the mapping in `competitors-client.tsx`. Then every consumer (card, table) gets the data automatically.
**Warning signs:** If a view shows stale indicators but another doesn't, threading is incomplete.

### Pitfall 2: Detail Page Missing Stale Data
**What goes wrong:** The detail page (`[handle]/page.tsx`) fetches the full profile via `select("*")` which includes `last_scraped_at` and `scrape_status`, but `DetailHeader` receives the full profile type. The stale indicator can be added directly, but the retry action needs a server action or API route -- not just a client-side call.
**Why it happens:** `DetailHeader` is a server component. For retry functionality, a client wrapper or inline "use client" button is needed.
**How to avoid:** Create a small client `<RetryButton>` component that calls the retry server action and embed it inside the server `DetailHeader`.

### Pitfall 3: Heatmap Overflow on Mobile
**What goes wrong:** The posting heatmap has `min-w-[600px]` and `overflow-x-auto` on its container, but no visual indicator that content is scrollable horizontally.
**Why it happens:** Touch users don't see scrollbars by default.
**How to avoid:** Add a subtle gradient fade on the right edge when content overflows, or add a small "scroll for more" hint on mobile.

### Pitfall 4: Table Horizontal Scroll Without Affordance
**What goes wrong:** The competitor table and engagement table use `overflow-x-auto` but on mobile, all columns squeeze. No scroll indicator.
**Why it happens:** Tables with 8+ columns don't fit on 375px screens.
**How to avoid:** Set `min-w-[640px]` on the table element so it scrolls rather than squeezing. The parent already has `overflow-x-auto`.

### Pitfall 5: Chart Tooltip Touch Issues
**What goes wrong:** Recharts tooltips are hover-based. On mobile, they appear on tap but may not dismiss cleanly.
**Why it happens:** Recharts tooltip behavior on touch is tap-to-show, tap-elsewhere-to-hide. This works but can feel janky.
**How to avoid:** Accept the default Recharts touch behavior -- it's good enough. Don't try to customize tooltip interaction for touch, as it creates more problems than it solves.

### Pitfall 6: Retry Server Action Needs Specific Pattern
**What goes wrong:** Calling `addCompetitor` as a retry won't work because the profile already exists. The retry needs to trigger a re-scrape, not re-add.
**Why it happens:** `addCompetitor` skips scraping when a profile exists (step 4a).
**How to avoid:** Create a dedicated `retryScrape` server action (or reuse the cron refresh logic for a single handle) that: (1) scrapes the profile, (2) updates `competitor_profiles`, (3) updates `scrape_status` to "success". This is a thin wrapper around the same scraping logic used in `refresh-competitors/route.ts`.

## Code Examples

### Extending CompetitorCardData Interface
```typescript
// In competitor-card.tsx -- add these two fields
export interface CompetitorCardData {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number | null;
  heart_count: number | null;
  video_count: number | null;
  last_scraped_at: string | null;    // NEW
  scrape_status: string | null;      // NEW
  snapshots: { follower_count: number; snapshot_date: string }[];
  videos: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    posted_at: string | null;
  }[];
}
```

### Threading Data in competitors-client.tsx
```typescript
// In the mapping function, add the new fields:
const cards: CompetitorCardData[] = competitors
  .filter((row) => row.competitor_profiles !== null)
  .map((row) => {
    const profile = row.competitor_profiles!;
    return {
      id: profile.id,
      tiktok_handle: profile.tiktok_handle,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      follower_count: profile.follower_count,
      heart_count: profile.heart_count,
      video_count: profile.video_count,
      last_scraped_at: profile.last_scraped_at,    // NEW
      scrape_status: profile.scrape_status,          // NEW
      snapshots: snapshotMap[profile.id] ?? [],
      videos: videosMap[profile.id] ?? [],
    };
  });
```

### Retry Server Action Pattern
```typescript
// src/app/actions/competitors/retry-scrape.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";

export async function retryScrape(handle: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify user tracks this competitor
  const { data: profile } = await supabase
    .from("competitor_profiles")
    .select("id")
    .eq("tiktok_handle", handle)
    .single();

  if (!profile) return { error: "Competitor not found" };

  const serviceClient = createServiceClient();
  const scraper = createScrapingProvider();

  try {
    const profileData = await scraper.scrapeProfile(handle);

    await serviceClient.from("competitor_profiles").update({
      display_name: profileData.displayName,
      bio: profileData.bio,
      avatar_url: profileData.avatarUrl,
      verified: profileData.verified,
      follower_count: profileData.followerCount,
      following_count: profileData.followingCount,
      heart_count: profileData.heartCount,
      video_count: profileData.videoCount,
      last_scraped_at: new Date().toISOString(),
      scrape_status: "success",
    }).eq("id", profile.id);

    revalidatePath("/competitors");
    revalidatePath(`/competitors/${handle}`);
    return {};
  } catch {
    return { error: "Scrape failed -- please try again later" };
  }
}
```

### Responsive Detail Header Stats
```typescript
// Before:
<div className="grid grid-cols-3 gap-4">

// After:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
```

### Mobile Scroll Gradient for Heatmap/Tables
```typescript
// Wrap scrollable content with a gradient fade indicator
<div className="relative">
  <div className="overflow-x-auto">
    {/* table or heatmap content */}
  </div>
  {/* Right edge fade (mobile only) */}
  <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Date-fns `formatDistanceToNow` | Simple custom helper | N/A (zero deps constraint) | No dependency needed for basic relative time |
| CSS media queries | Tailwind breakpoint prefixes | Tailwind v3+ | Mobile-first is the default in Tailwind |
| Custom chart resize logic | Recharts `ResponsiveContainer` | Recharts v2+ | Already in use, uses ResizeObserver API |
| `useTransition` for mutations | React 19 server actions + `useTransition` | React 19 | Already the pattern in this codebase |

**Deprecated/outdated:**
- None relevant -- the project's stack is current.

## Open Questions

1. **Stale threshold value**
   - What we know: The intelligence service uses 7 days as stale. The cron runs daily at 6 AM UTC.
   - What's unclear: Should the UI stale indicator use the same 7-day threshold, or a shorter one (e.g., 48h)?
   - Recommendation: Use 48 hours for visual warning (yellow tint), but don't block anything. Data older than 7 days should show a stronger "outdated" indicator. The cron should keep things fresh daily, so 48h stale only appears if the cron fails.

2. **Retry scope**
   - What we know: The cron re-scrapes profiles and snapshots but not videos. `addCompetitor` scrapes both profile and videos on first add.
   - What's unclear: Should retry re-scrape just the profile (like cron), or also videos?
   - Recommendation: Profile-only retry (matches cron behavior). Video re-scrape is expensive and rarely fails independently. Keep it simple.

3. **Comparison page stale data**
   - What we know: The comparison page fetches profiles via `competitor_profiles` select("*") which includes `last_scraped_at`.
   - What's unclear: Should each comparison side show its own stale indicator?
   - Recommendation: Yes, show a small stale indicator under each competitor's name in the selector area. The data for it is already available.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `competitor_profiles` schema with `last_scraped_at` (string|null) and `scrape_status` (string|null) fields -- verified in `database.types.ts`
- Codebase analysis: Competitors page already queries both fields in the Supabase select -- verified in `competitors/page.tsx` line 28
- Codebase analysis: Cron route sets `scrape_status: "success"` on success and `"failed"` on error -- verified in `refresh-competitors/route.ts`
- Context7 `/recharts/recharts` -- `ResponsiveContainer` uses ResizeObserver, handles responsive sizing automatically
- Context7 `/websites/tailwindcss` -- mobile-first breakpoint system, `sm:` prefix applies at 640px+

### Secondary (MEDIUM confidence)
- Recharts touch tooltip behavior -- based on Recharts documentation that tooltips work on tap for mobile. Not explicitly tested in this codebase.

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new packages, all tools already in project and verified
- Architecture: HIGH - Patterns derived directly from existing codebase conventions (server actions, client wrappers, Tailwind responsive)
- Pitfalls: HIGH - All pitfalls identified from direct code reading, not assumptions

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- stable domain, no moving parts)
