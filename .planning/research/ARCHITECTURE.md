# Architecture Patterns

**Domain:** TikTok Competitor Intelligence Tracker integrated into existing Next.js 15 + Supabase platform
**Researched:** 2026-02-16
**Confidence:** HIGH (verified against existing codebase, Supabase docs, Vercel docs, Apify docs, backend-foundation architecture)

---

## Recommended Architecture

### High-Level System Diagram

```
                    CLIENT (Existing App Shell)
                    ===========================
    /competitors (NEW page) ------+
         |                        |
    CompetitorDashboard           |
         |                        |
    +----+----+----+----+         |
    |    |    |    |    |         |
  Cards Grid Charts Table       |
  (Competitor Overview)          |
         |                        |
    SERVER ACTIONS + API ROUTES   |
    ============================  |
    addCompetitor()    <---------+ (server action)
    removeCompetitor() <---------+ (server action)
    refreshCompetitor() <--------+ (API route)
    GET /api/competitors/search   (API route - Apify lookup)
    GET /api/competitors/[id]/metrics (API route)
         |
         +---> Supabase (competitor_profiles, competitor_snapshots)
         +---> Apify TikTok Profile Scraper (on-demand + scheduled)

                    CRON / SCHEDULED REFRESH
                    ========================
    Vercel Cron (every 12h) ---> GET /api/cron/refresh-competitors
         |
         v
    For each tracked competitor:
         |
         +---> Apify TikTok Profile Scraper (batch)
         +---> Upsert into competitor_snapshots
         +---> Update competitor_profiles.latest_*
         +---> Revalidate /competitors page cache
```

### Component Boundaries

| Component | Responsibility | Communicates With | Location |
|-----------|---------------|-------------------|----------|
| **Competitors Page** | Route entry, metadata, server data fetch | Supabase (server), child components | `src/app/(app)/competitors/page.tsx` |
| **CompetitorDashboard** | Client orchestration, tabs, filters, state | Child components, server actions | `src/components/competitors/competitor-dashboard.tsx` |
| **AddCompetitorModal** | Handle input, search, add flow | Server action `addCompetitor()`, search API | `src/components/competitors/add-competitor-modal.tsx` |
| **CompetitorCard** | Display single competitor summary | Props only | `src/components/competitors/competitor-card.tsx` |
| **CompetitorTable** | Sortable leaderboard view | Props + Zustand sort state | `src/components/competitors/competitor-table.tsx` |
| **GrowthChart** | Time-series follower/engagement charts | Props (snapshot data), Recharts | `src/components/competitors/growth-chart.tsx` |
| **BenchmarkPanel** | Side-by-side own stats vs competitor | Props (own profile + competitor) | `src/components/competitors/benchmark-panel.tsx` |
| **CompetitorDetail** | Expanded view with full metrics | Props + server data | `src/components/competitors/competitor-detail.tsx` |
| **Server Actions** | Add/remove/refresh competitors | Supabase, Apify API | `src/app/(app)/competitors/actions.ts` |
| **Cron Route** | Batch refresh all tracked competitors | Supabase service client, Apify API | `src/app/api/cron/refresh-competitors/route.ts` |
| **Search API** | Search TikTok profiles by handle/name | Apify API | `src/app/api/competitors/search/route.ts` |

---

## Integration Points with Existing Code

### 1. New Route: /competitors (App Route Group)

**Existing pattern:** Routes live in `src/app/(app)/` under the shared `AppShell` layout with sidebar navigation, `ToastProvider`, and middleware-enforced auth. Examples: `/dashboard`, `/trending`, `/referrals`, `/settings`.

**Integration:**
- Add `src/app/(app)/competitors/page.tsx` as a server component (matches existing pattern from `dashboard/page.tsx`, `trending/page.tsx`)
- Server component fetches initial competitor data, passes to client `CompetitorDashboard`
- Add `competitors/actions.ts` for server actions (matches existing `login/actions.ts`, `signup/actions.ts` pattern)

**Files to create:**
- `src/app/(app)/competitors/page.tsx` -- server component, metadata, initial data fetch
- `src/app/(app)/competitors/actions.ts` -- server actions for add/remove/refresh

**Files to modify:**
- `src/components/app/sidebar.tsx` -- add "Competitors" nav item (between Trending and Content Intelligence)
- `src/lib/supabase/middleware.ts` -- add `/competitors` to `PROTECTED_PREFIXES`
- `src/types/database.types.ts` -- regenerate after migration (new tables)

### 2. Sidebar Navigation Addition

**Existing pattern:** Sidebar has two nav groups: `navItems` (Dashboard, Trending) and `navItemsAfterSelector` (Content Intelligence, Referrals). The TikTok account selector sits between them.

**Integration:** Add "Competitors" to `navItems` array, after Trending, before the TikTok account selector. This positions it logically -- Dashboard (home) > Trending (discovery) > Competitors (tracking).

```typescript
// src/components/app/sidebar.tsx -- MODIFY navItems
import { UsersThree } from "@phosphor-icons/react"; // or UsersFour

const navItems = [
  { label: "Dashboard", icon: House, id: "dashboard", href: "/dashboard" },
  { label: "Trending", icon: TrendUp, id: "trending", href: "/trending" },
  { label: "Competitors", icon: UsersThree, id: "competitors", href: "/competitors" },
] as const;
```

### 3. Middleware Auth Protection

**Existing pattern:** `PROTECTED_PREFIXES` array in `src/lib/supabase/middleware.ts` gates routes behind auth.

**Integration:** Add `/competitors` to the array:

```typescript
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/brand-deals",
  "/settings",
  "/welcome",
  "/referrals",
  "/competitors", // NEW
];
```

### 4. Supabase Client Reuse

**Existing pattern:** Two client factories:
- `src/lib/supabase/server.ts` -- `createClient()` for server components/actions (uses cookies)
- `src/lib/supabase/client.ts` -- `createClient()` for client components (browser client)
- Service client pattern in `sync-whop/route.ts` -- inline `createServiceClient()` for cron/webhook routes

**Integration:** Use the same factories. Extract the inline service client to shared utility:

```typescript
// src/lib/supabase/service.ts (NEW -- extract from sync-whop/route.ts)
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}
```

This was already identified as a pattern to extract in the backend-foundation architecture. The competitors tool should do it first since it ships first.

### 5. Zustand Store for Client-Only State

**Existing pattern:** Zustand stores in `src/stores/` for sidebar, settings, society, tooltips. All use `localStorage` + manual `_hydrate()`. Client-only state, not server data.

**Integration:** Create `src/stores/competitors-store.ts` for UI-only state:
- Active view mode (grid vs table)
- Sort field and direction
- Filter state (niche, date range)
- Selected competitor ID (for detail panel)

Do NOT store competitor data in Zustand. Competitor profiles and metrics come from the server and should be fetched via server components or server actions, not cached in client state.

### 6. Existing UI Components to Reuse

The design system provides everything needed without new primitives:

| Existing Component | Usage in Competitors |
|-------------------|---------------------|
| `Card` | Competitor cards |
| `Avatar` | Competitor profile photos |
| `Badge` | Niche tags, status indicators |
| `Button` | Add, refresh, remove actions |
| `Dialog` | Add competitor modal, competitor detail |
| `Skeleton` | Loading states |
| `Tabs` | Overview/Growth/Content tabs |
| `Input` | Search/filter inputs |
| `Spinner` | Refresh indicator |
| `Toast` | Success/error feedback |
| `CategoryTabs` | Grid/Table view switcher |

New components to create (all in `src/components/competitors/`):
- `competitor-dashboard.tsx` -- main client component
- `competitor-card.tsx` -- card for grid view
- `competitor-table.tsx` -- sortable table view
- `growth-chart.tsx` -- Recharts time-series
- `benchmark-panel.tsx` -- comparison view
- `add-competitor-modal.tsx` -- search + add flow
- `competitor-detail.tsx` -- expanded metrics view
- `competitor-search.tsx` -- search input with debounce

### 7. Recharts Reuse

**Existing:** `recharts@3.7.0` already installed and used in the earnings dashboard. The existing area chart pattern can be adapted for competitor growth charts (follower count over time, engagement rate over time).

### 8. Future Prediction Engine Hook Points

**Backend-foundation architecture** defines `analysis_results`, `outcomes`, and `rule_library` tables. The competitor data model should be designed so the prediction engine can:

1. **Use competitor data as context for predictions** -- When analyzing a user's content, the engine can pull competitor engagement rates and posting patterns as benchmark context
2. **Compare predicted vs competitor performance** -- "Your content would perform 2x better than @competitor's average"
3. **Feed competitor trend data into rule validation** -- Competitor posting patterns inform trend detection rules

**Integration points designed into this architecture:**
- `competitor_profiles.id` can be referenced by future `analysis_context` JSONB field in `analysis_results`
- `competitor_snapshots` time-series data feeds into trend calculations
- `competitor_videos` (future) can be analyzed by the prediction engine for pattern extraction

---

## Database Schema Design

### New Tables

```sql
-- =====================================================
-- COMPETITOR PROFILES (tracked competitors)
-- One row per competitor per user (users track independently)
-- =====================================================
CREATE TABLE competitor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- TikTok identity
  tiktok_handle TEXT NOT NULL,
  tiktok_id TEXT,                    -- Platform's unique ID (if available from scraper)
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Latest metrics (denormalized from most recent snapshot for fast reads)
  latest_followers BIGINT DEFAULT 0,
  latest_following BIGINT DEFAULT 0,
  latest_likes BIGINT DEFAULT 0,    -- Total likes received
  latest_video_count INTEGER DEFAULT 0,
  latest_engagement_rate NUMERIC(8,4),

  -- Classification
  niches TEXT[] DEFAULT '{}',
  region TEXT,

  -- Tracking metadata
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_scraped_at TIMESTAMPTZ,
  scrape_status TEXT DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'active', 'failed', 'paused')),
  scrape_error TEXT,

  -- Unique constraint: one user can't track the same handle twice
  UNIQUE(user_id, tiktok_handle)
);

CREATE INDEX idx_competitor_profiles_user_id ON competitor_profiles(user_id);
CREATE INDEX idx_competitor_profiles_handle ON competitor_profiles(tiktok_handle);
CREATE INDEX idx_competitor_profiles_scrape_status ON competitor_profiles(scrape_status);

-- =====================================================
-- COMPETITOR SNAPSHOTS (time-series metrics)
-- One row per competitor per scrape event
-- This is the time-series table for growth tracking
-- =====================================================
CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,

  -- Metrics at this point in time
  followers BIGINT NOT NULL DEFAULT 0,
  following BIGINT DEFAULT 0,
  total_likes BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  engagement_rate NUMERIC(8,4),

  -- Computed deltas (vs previous snapshot)
  followers_delta BIGINT DEFAULT 0,   -- followers gained/lost since last snapshot
  likes_delta BIGINT DEFAULT 0,

  -- Posting activity since last snapshot
  new_videos_count INTEGER DEFAULT 0,

  -- Snapshot metadata
  scraped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_competitor_snapshots_competitor_id ON competitor_snapshots(competitor_id);
CREATE INDEX idx_competitor_snapshots_scraped_at ON competitor_snapshots(scraped_at DESC);
-- Composite index for efficient time-range queries per competitor
CREATE INDEX idx_competitor_snapshots_competitor_time
  ON competitor_snapshots(competitor_id, scraped_at DESC);

-- =====================================================
-- COMPETITOR VIDEOS (top/recent videos per competitor)
-- Stores a rolling window of recent videos for content analysis
-- =====================================================
CREATE TABLE competitor_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,

  -- TikTok video identity
  platform_video_id TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,

  -- Content
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  sound_name TEXT,

  -- Metrics
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  engagement_rate NUMERIC(8,4),

  -- Timing
  published_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- Dedup: one video per competitor entry
  UNIQUE(competitor_id, platform_video_id)
);

CREATE INDEX idx_competitor_videos_competitor_id ON competitor_videos(competitor_id);
CREATE INDEX idx_competitor_videos_published_at ON competitor_videos(published_at DESC);
CREATE INDEX idx_competitor_videos_views ON competitor_videos(views DESC);
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE competitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_videos ENABLE ROW LEVEL SECURITY;

-- competitor_profiles: Users manage their own tracked competitors
CREATE POLICY "Users can view their own competitors"
  ON competitor_profiles FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can add competitors"
  ON competitor_profiles FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own competitors"
  ON competitor_profiles FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can remove their own competitors"
  ON competitor_profiles FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- competitor_snapshots: Users can view snapshots for their tracked competitors
-- Uses subquery join to competitor_profiles for ownership check
CREATE POLICY "Users can view snapshots of their competitors"
  ON competitor_snapshots FOR SELECT
  USING (competitor_id IN (
    SELECT id FROM competitor_profiles WHERE user_id = (SELECT auth.uid())
  ));
-- Writes: service_role only (cron/scraper routes)

-- competitor_videos: Same pattern as snapshots
CREATE POLICY "Users can view videos of their competitors"
  ON competitor_videos FOR SELECT
  USING (competitor_id IN (
    SELECT id FROM competitor_profiles WHERE user_id = (SELECT auth.uid())
  ));
-- Writes: service_role only
```

### RLS Design Decisions

1. **`(SELECT auth.uid())` wrapper** -- Already established pattern in all existing migrations. Provides 94%+ query performance improvement by caching the auth function result per-statement.

2. **Per-user competitor tracking** -- Each user has their own set of tracked competitors. Two users tracking the same `@handle` get separate `competitor_profiles` rows. This is intentional: it keeps RLS simple (direct `user_id` ownership) and allows per-user customization (notes, categories) later. The snapshot data for the same handle could theoretically be shared, but the complexity of shared ownership with RLS is not worth the storage savings at this scale.

3. **Subquery join for snapshots/videos RLS** -- Snapshots and videos don't have a direct `user_id`. The RLS policy uses `competitor_id IN (SELECT id FROM competitor_profiles WHERE user_id = auth.uid())`. This is the same pattern used for `affiliate_clicks` and `affiliate_conversions` in the existing schema. Performance is fine because the subquery is on an indexed column.

4. **Service role for writes to snapshots/videos** -- Scraping results are written by cron routes using the service client (bypasses RLS). No INSERT/UPDATE policies needed for these tables. This matches the pattern planned for `scraped_videos` in the backend-foundation architecture.

5. **TEXT + CHECK over ENUMs** -- Already established pattern. `scrape_status` uses CHECK constraint for flexibility.

6. **Denormalized `latest_*` fields on competitor_profiles** -- The dashboard overview reads `competitor_profiles` for the card grid. Including latest metrics avoids a JOIN to `competitor_snapshots` for every card render. Updated atomically when a new snapshot is inserted (in the same transaction within the cron route).

### Time-Series Strategy: Plain PostgreSQL (Not TimescaleDB)

**Decision:** Use plain PostgreSQL tables with composite indexes for time-series competitor metrics.

**Rationale:**
- TimescaleDB is deprecated on Supabase Postgres 17 and will only be supported on Postgres 15 until ~May 2026
- The data volume is small: even with 50 competitors tracked by 1000 users, refreshed every 12 hours, that is ~36,500 snapshot rows per month -- trivially handled by plain PostgreSQL
- The `(competitor_id, scraped_at DESC)` composite index makes time-range queries per competitor efficient
- If data grows significantly, native PostgreSQL range partitioning by `scraped_at` month can be added later without schema changes
- Materialized views can be added for aggregated weekly/monthly metrics if query performance degrades

### Migration File

```
supabase/migrations/20260216000000_competitor_tracking.sql
```

Follows the existing naming convention (`YYYYMMDDHHMMSS_description.sql`).

---

## Data Flow Patterns

### Pattern 1: Add Competitor (Server Action)

```
User enters @handle in AddCompetitorModal
    |
    v
Server action: addCompetitor(handle)
    |
    +--1. Validate handle format (strip @, lowercase)
    +--2. Check user hasn't exceeded competitor limit (optional future gate)
    +--3. INSERT into competitor_profiles (status: 'pending')
    +--4. Kick off immediate scrape via Apify
    |     |
    |     v
    |   Apify TikTok Profile Scraper (single profile)
    |     |
    |     v
    |   Transform response -> UPDATE competitor_profiles + INSERT snapshot
    |
    +--5. revalidatePath('/competitors')
    +--6. Return success/error to client
```

**Implementation:**

```typescript
// src/app/(app)/competitors/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function addCompetitor(handle: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Normalize handle
  const normalizedHandle = handle.replace(/^@/, '').toLowerCase().trim();
  if (!normalizedHandle || normalizedHandle.length < 2) {
    return { error: 'Invalid TikTok handle' };
  }

  // Insert competitor profile
  const { data: competitor, error: insertError } = await supabase
    .from('competitor_profiles')
    .insert({
      user_id: user.id,
      tiktok_handle: normalizedHandle,
      scrape_status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') { // unique_violation
      return { error: 'You are already tracking this competitor' };
    }
    return { error: 'Failed to add competitor' };
  }

  // Fire-and-forget: trigger initial scrape
  // Uses internal API route to avoid importing Apify client in server action
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/competitors/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify({ competitorId: competitor.id, handle: normalizedHandle }),
  }).catch(console.error); // Don't await -- return immediately to user

  revalidatePath('/competitors');
  return { data: competitor };
}

export async function removeCompetitor(competitorId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('competitor_profiles')
    .delete()
    .eq('id', competitorId);

  if (error) return { error: 'Failed to remove competitor' };

  revalidatePath('/competitors');
  return { success: true };
}
```

**Why server actions over API routes for mutations:** The existing codebase uses server actions for auth flows (`login/actions.ts`, `signup/actions.ts`). Server actions integrate naturally with Next.js form handling and `revalidatePath`. For mutations that don't need streaming or long-running responses, they are simpler than API routes.

### Pattern 2: Scheduled Competitor Refresh (Cron)

```
Vercel Cron (every 12h) ---> GET /api/cron/refresh-competitors
    |
    v
Authorization check (CRON_SECRET Bearer token)
    |
    v
Supabase service client: SELECT DISTINCT tiktok_handle
  FROM competitor_profiles
  WHERE scrape_status = 'active'
    |
    v
Batch scrape via Apify (all unique handles in one actor run)
    |
    v
For each scraped profile:
    +--1. Find all competitor_profiles with this handle
    +--2. UPDATE competitor_profiles SET latest_* = scraped values
    +--3. INSERT competitor_snapshots with new metrics
    +--4. Calculate deltas from previous snapshot
    +--5. UPSERT competitor_videos (recent videos)
    |
    v
revalidatePath('/competitors')
Return { refreshed: count }
```

**Why 12-hour refresh interval:**
- TikTok metrics don't change by the second -- daily granularity is sufficient for competitor tracking
- Twice daily captures morning and evening shifts in follower counts
- Keeps Apify costs low (~$0.30 per 1,000 profiles)
- Matches the "check in once a day" usage pattern for competitor dashboards
- Can be increased to 6h or decreased to 24h based on usage data

**Why batch all unique handles, not per-user:**
- If 100 users all track `@charlidamelio`, we scrape once, not 100 times
- The cron route queries `SELECT DISTINCT tiktok_handle` across all users
- After scraping, it updates ALL `competitor_profiles` rows matching each handle
- This is a massive cost optimization for popular competitors

### Pattern 3: On-Demand Single Competitor Refresh (API Route)

```
User clicks "Refresh" button on competitor card
    |
    v
POST /api/competitors/[id]/refresh
    |
    v
Auth check + ownership verification
Rate limit: max 1 refresh per competitor per hour
    |
    v
Apify single-profile scrape (fast, ~2-5 seconds)
    |
    v
UPDATE competitor_profiles + INSERT snapshot
    |
    v
Return updated competitor data
```

**Implementation note:** This is a separate API route (not server action) because it needs to return the scraped data directly and the client needs to update the UI optimistically or with the response data.

### Pattern 4: Competitor Search (API Route)

```
User types in AddCompetitorModal search input
    |
    v (debounced 300ms)
GET /api/competitors/search?q=charlidamelio
    |
    v
Apify TikTok Profile Scraper (search mode)
  OR TikTok User Scraper (name-based search)
    |
    v
Return: [{ handle, displayName, avatarUrl, followers, verified }]
```

**Why an API route, not a server action:** Search needs to return data that the client renders immediately. Server actions are better for mutations. The search route can also implement caching (same search term within 5 minutes returns cached results).

### Pattern 5: Data Flow from Storage to UI

```
SERVER COMPONENT (page.tsx)
    |
    v
Supabase server client: SELECT * FROM competitor_profiles
  WHERE user_id = auth.uid()
  ORDER BY added_at DESC
    |
    v
Pass as props to CompetitorDashboard (client component)
    |
    v
CLIENT COMPONENT renders:
  +-- Grid view: CompetitorCard[] (uses latest_* fields)
  +-- Table view: CompetitorTable (uses latest_* fields)
  +-- Charts: fetches snapshots on-demand when user opens detail
  +-- Benchmark: compares with creator_profiles data
```

**Why server component for initial data fetch (not TanStack Query):**
- The existing codebase does NOT use TanStack Query yet (it is planned for backend-foundation)
- Adding TanStack Query as a dependency for this milestone would introduce a new pattern before the backend-foundation milestone establishes it
- Server components with `revalidatePath` are simpler and match existing patterns
- The competitors page doesn't need real-time updates -- data changes every 12 hours
- When backend-foundation ships TanStack Query, the competitors page can optionally migrate

**For snapshot time-series data (charts):** Load on-demand when user opens a specific competitor's detail view. Use a client-side fetch to an API route or a server action that returns the last 30 days of snapshots. This avoids loading potentially large time-series data for all competitors on page load.

---

## Scraping Architecture

### Apify TikTok Profile Scraper

**Actor:** `clockworks/tiktok-profile-scraper` (HIGH confidence -- actively maintained, widely used)

**Output fields per profile:**
- `uniqueId` (handle), `nickname` (display name), `id` (TikTok user ID)
- `avatarLarger` (avatar URL), `signature` (bio), `verified`
- `followerCount`, `followingCount`, `heartCount` (total likes), `videoCount`
- `region`, `createTime`
- Recent videos array with per-video metrics

**Input:**
```json
{
  "profiles": ["charlidamelio", "khaby.lame", "bellapoarch"],
  "resultsPerPage": 1,
  "shouldDownloadVideos": false,
  "shouldDownloadCovers": false
}
```

**Pricing:** ~$0.30 per 1,000 profiles. At 50 competitors refreshed twice daily = ~100 scrapes/day = $0.003/day. Negligible cost.

**Error handling:** Apify actors can fail due to TikTok rate limiting or anti-bot measures. The scrape status field on `competitor_profiles` tracks failures. Failed scrapes should be retried on the next cron cycle, not immediately.

### Scraping Service Layer

```typescript
// src/lib/scraping/tiktok.ts
interface TikTokProfileData {
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  isVerified: boolean;
  followers: number;
  following: number;
  totalLikes: number;
  videoCount: number;
  region: string;
  recentVideos: TikTokVideoData[];
}

export async function scrapeTikTokProfiles(handles: string[]): Promise<TikTokProfileData[]> {
  // Start Apify actor run synchronously (waits for completion)
  // Use synchronous run for small batches (< 50 profiles)
  // Use async run + webhook for large batches
  const response = await fetch(
    `https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIFY_API_TOKEN}`,
      },
      body: JSON.stringify({
        profiles: handles,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    }
  );

  if (!response.ok) throw new Error(`Apify scrape failed: ${response.status}`);
  const rawData = await response.json();
  return rawData.map(transformApifyProfile);
}
```

**Why synchronous Apify runs for competitor scraping:**
- Profile scraping is fast (2-10 seconds for < 50 profiles)
- The cron route can wait for completion within Vercel's function timeout
- Avoids the complexity of webhook-based async flow used for video scraping in backend-foundation
- For the initial scrape when adding a competitor, the user waits 2-5 seconds with a loading state

**When to switch to async (webhook-based):**
- If batch size exceeds 100 profiles per cron run
- If Apify response time exceeds 60 seconds consistently
- At that point, adopt the same fire-and-forget + webhook pattern from backend-foundation

---

## Caching Strategy

### Server-Side Caching

| Data | Strategy | Rationale |
|------|----------|-----------|
| Competitor list (page load) | `revalidatePath('/competitors')` after scrape | Data changes only when scrape completes or competitor added/removed |
| Competitor snapshots (charts) | `unstable_cache` with 1h TTL or API route with `Cache-Control: max-age=3600` | Snapshot data is immutable once written |
| Competitor search results | In-memory cache (Map) with 5-minute TTL in API route | Same search term shouldn't hit Apify twice |
| Competitor videos | Same as snapshots -- immutable once written | No need to re-fetch |

### Client-Side Caching

No TanStack Query in this milestone (see rationale above). Client caching is handled by:
- Next.js server component caching (full route cache with `revalidatePath` invalidation)
- React `useState` for data received as props (component-level)
- `useSWR` is NOT recommended -- if we need client-side fetching, use simple `fetch` with `useEffect` (matches existing `useSubscription` pattern) until TanStack Query is introduced in backend-foundation

### Next.js Caching Configuration

```typescript
// src/app/(app)/competitors/page.tsx
// Dynamic because each user sees different competitors (auth-dependent)
export const dynamic = 'force-dynamic';
// This is already the default for server components that call cookies()/headers()
// which our Supabase server client does. Explicit here for clarity.
```

**Why not ISR for the competitors page:** The page content is per-user (each user tracks different competitors). ISR caches at the path level, not per-user. `force-dynamic` with `revalidatePath` is the correct approach for user-specific data pages.

---

## Scheduling: Vercel Cron (Not pg_cron)

**Decision:** Use Vercel Cron for scheduled competitor refreshes.

**Rationale:**

| Factor | Vercel Cron | Supabase pg_cron |
|--------|------------|-----------------|
| External API calls (Apify) | Native -- it's just an HTTP endpoint | Requires `net.http_get` extension, more complex |
| Existing pattern | Already used for `sync-whop` cron | Not used in this project |
| Monitoring | Vercel dashboard, function logs | Database logs, harder to debug |
| Error handling | Standard try/catch, NextResponse | PL/pgSQL exception handling |
| Complexity | Simple -- add entry to vercel.json | Moderate -- SQL function + cron job + extension setup |
| Access to app code | Full -- can import any module | None -- pure SQL/HTTP |

**pg_cron would be appropriate for:** Pure database operations like cleanup, aggregation, or partition management that don't need external API calls. For the competitor refresh (which requires Apify API calls), Vercel Cron is the clear choice.

**vercel.json addition:**

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-competitors",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

**Note:** This requires Vercel Pro plan (Hobby plan limits cron to daily). The existing project already uses Vercel Cron for `sync-whop`, so it's presumably already on Pro or will need to be.

---

## Page Structure

### Route: `/competitors`

```
/competitors
  |
  +-- CompetitorDashboard (client component, main orchestrator)
       |
       +-- Header section
       |    +-- Page title + subtitle
       |    +-- "Add Competitor" button (opens modal)
       |    +-- View toggle (Grid / Table)
       |    +-- Filter/sort controls
       |
       +-- Stats bar (summary metrics)
       |    +-- Total competitors tracked
       |    +-- Average engagement rate
       |    +-- Fastest growing competitor
       |    +-- Most recent refresh time
       |
       +-- Main content (conditional on view mode)
       |    +-- Grid view: CompetitorCard grid (2-3 columns)
       |    |    +-- Avatar, handle, followers, engagement
       |    |    +-- Mini sparkline (last 14 days followers)
       |    |    +-- Actions: View detail, Refresh, Remove
       |    |
       |    +-- Table view: CompetitorTable
       |         +-- Sortable columns: Handle, Followers, Growth, Engagement, Videos, Last Updated
       |         +-- Row click -> opens detail
       |
       +-- Empty state (when no competitors tracked)
       |    +-- Illustration + CTA to add first competitor
       |
       +-- AddCompetitorModal (dialog)
       |    +-- Search input (debounced)
       |    +-- Search results list
       |    +-- Or: paste handle directly
       |    +-- Add button per result
       |
       +-- CompetitorDetailPanel (dialog or slide-over)
            +-- Full profile header
            +-- Tabs: Overview | Growth | Content | Benchmark
            +-- Overview: Key metrics + recent activity
            +-- Growth: Recharts line charts (followers, likes over time)
            +-- Content: Top videos grid, posting frequency chart
            +-- Benchmark: Side-by-side with user's own stats
```

### Component Hierarchy

```
page.tsx (Server Component)
  |-- Fetches competitor_profiles for current user
  |-- Passes data as props
  |
  +-- CompetitorDashboard (Client Component, "use client")
       |
       +-- CompetitorHeader
       |    +-- Button (Add Competitor)
       |    +-- CategoryTabs (Grid / Table toggle)
       |    +-- Select (Sort by)
       |
       +-- CompetitorStatsBar
       |
       +-- CompetitorGrid (conditional)
       |    +-- CompetitorCard (x N)
       |         +-- Avatar, Badge, sparkline
       |
       +-- CompetitorTable (conditional)
       |    +-- Table rows with sorting
       |
       +-- CompetitorEmptyState (conditional)
       |
       +-- AddCompetitorModal
       |    +-- CompetitorSearch
       |    +-- Search result items
       |
       +-- CompetitorDetailPanel
            +-- Tabs
            +-- GrowthChart
            +-- ContentGrid
            +-- BenchmarkPanel
```

---

## File Structure (New Files)

```
src/
  app/
    (app)/
      competitors/
        page.tsx                    # Server component, metadata, data fetch
        actions.ts                  # Server actions: add, remove, refresh
    api/
      competitors/
        search/route.ts             # GET: Search TikTok profiles
        [id]/
          refresh/route.ts          # POST: On-demand single refresh
      cron/
        refresh-competitors/route.ts # GET: Batch scheduled refresh
  components/
    competitors/
      competitor-dashboard.tsx      # Main client orchestrator
      competitor-card.tsx           # Grid view card
      competitor-table.tsx          # Table/leaderboard view
      competitor-stats-bar.tsx      # Summary stats row
      competitor-header.tsx         # Title + controls
      competitor-empty-state.tsx    # No competitors CTA
      competitor-detail.tsx         # Detail panel/modal
      competitor-search.tsx         # Search input + results
      add-competitor-modal.tsx      # Add flow dialog
      growth-chart.tsx              # Recharts time-series
      benchmark-panel.tsx           # Own stats vs competitor
      content-grid.tsx              # Competitor's top videos
      index.ts                      # Barrel export
  lib/
    scraping/
      tiktok.ts                     # Apify TikTok profile scraper client
      transform.ts                  # Raw Apify data -> DB types
    supabase/
      service.ts                    # Shared service client (extracted)
  stores/
    competitors-store.ts            # UI state: view mode, sort, filters
  types/
    competitor.ts                   # TypeScript types for competitors
supabase/
  migrations/
    20260216000000_competitor_tracking.sql  # New tables + RLS
vercel.json                         # Cron job configuration (NEW file)
```

### Modified Files

| File | Change |
|------|--------|
| `src/components/app/sidebar.tsx` | Add "Competitors" nav item |
| `src/lib/supabase/middleware.ts` | Add `/competitors` to protected prefixes |
| `src/types/database.types.ts` | Regenerate after migration |
| `src/app/api/cron/sync-whop/route.ts` | Extract `createServiceClient` to shared module |
| `next.config.ts` | Add TikTok CDN to `images.remotePatterns` for avatar URLs |

---

## Patterns to Follow

### Pattern 1: Server Component Page with Client Dashboard

**What:** Server component fetches data, client component handles interactivity.
**Already established:** `dashboard/page.tsx` -> `dashboard-client.tsx`.
**Apply to:** `competitors/page.tsx` -> `competitor-dashboard.tsx`.

```typescript
// src/app/(app)/competitors/page.tsx
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { CompetitorDashboard } from '@/components/competitors/competitor-dashboard';

export const metadata: Metadata = {
  title: 'Competitors | Virtuna',
  description: 'Track and analyze your TikTok competitors.',
};

export default async function CompetitorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null; // Middleware handles redirect

  const { data: competitors } = await supabase
    .from('competitor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  // Also fetch user's own profile for benchmarking
  const { data: ownProfile } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <CompetitorDashboard
      competitors={competitors ?? []}
      ownProfile={ownProfile}
    />
  );
}
```

### Pattern 2: Server Actions for Mutations with revalidatePath

**What:** Mutations (add, remove) as server actions that revalidate the page cache.
**Already established:** Auth actions in `login/actions.ts`, `signup/actions.ts`.
**Apply to:** `competitors/actions.ts` for add/remove/refresh.

### Pattern 3: Cron Route with CRON_SECRET Authorization

**What:** Verify `CRON_SECRET` Bearer token on cron endpoints using service client.
**Already established:** `sync-whop/route.ts`.
**Apply to:** `refresh-competitors/route.ts`.

### Pattern 4: Zustand for UI-Only State

**What:** Use Zustand stores for view mode, sort preferences, selected items.
**Already established:** `sidebar-store.ts`, `settings-store.ts`.
**Apply to:** `competitors-store.ts` for grid/table toggle, sort field, selected competitor ID.

```typescript
// src/stores/competitors-store.ts
import { create } from 'zustand';

type ViewMode = 'grid' | 'table';
type SortField = 'followers' | 'engagement' | 'growth' | 'added';
type SortDirection = 'asc' | 'desc';

interface CompetitorsState {
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  selectedCompetitorId: string | null;
  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;
  setSelectedCompetitor: (id: string | null) => void;
}

export const useCompetitorsStore = create<CompetitorsState>((set) => ({
  viewMode: 'grid',
  sortField: 'followers',
  sortDirection: 'desc',
  selectedCompetitorId: null,
  setViewMode: (viewMode) => set({ viewMode }),
  setSortField: (sortField) => set({ sortField }),
  toggleSortDirection: () =>
    set((state) => ({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' })),
  setSelectedCompetitor: (selectedCompetitorId) => set({ selectedCompetitorId }),
}));
```

### Pattern 5: Debounced Search with useDebounce Hook

**What:** Debounce user input before making API calls.
**Already established:** `src/hooks/use-debounce.ts` exists in the codebase.
**Apply to:** Competitor search input in `AddCompetitorModal`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Competitor Data in Zustand

**What:** Putting scraped competitor data into a Zustand store.
**Why bad:** Competitor data is server state -- it lives in Supabase. Caching it in Zustand means stale data, manual invalidation, and duplicated state management. Server components already handle the data fetching.
**Instead:** Server component passes data as props. `revalidatePath` handles cache invalidation after mutations or scrapes.

### Anti-Pattern 2: Scraping in Server Actions Directly

**What:** Importing Apify client code directly into server actions.
**Why bad:** Server actions should be thin -- validate input, call DB, revalidate. Scraping logic (API calls, transformation, error handling) is complex enough to warrant its own module.
**Instead:** Server actions call `src/lib/scraping/tiktok.ts` or fire off a request to an internal API route. Separation of concerns.

### Anti-Pattern 3: One Snapshot per User per Scrape

**What:** Creating separate snapshot rows for each user tracking the same competitor.
**Why bad:** If 100 users track `@charlidamelio`, you'd create 100 identical snapshot rows every 12 hours. Massive waste.
**Instead:** The cron route deduplicates by handle. It scrapes each unique handle once, then updates all `competitor_profiles` rows matching that handle. Snapshots are per `competitor_id` but the actual Apify API call is per unique handle.

**Wait -- this creates a subtlety.** If two users track the same handle, they have different `competitor_profiles` rows and thus different `competitor_snapshots` time-series. This IS technically duplicated data, but it keeps the RLS model simple (ownership through `competitor_id`). The alternative -- a shared `tiktok_profiles` table with a many-to-many `user_competitors` join table -- adds schema complexity and RLS complexity for minimal storage savings. At the expected scale (< 10,000 unique handles), the duplication is acceptable.

### Anti-Pattern 4: Polling for Scrape Completion

**What:** Client polling an endpoint to check if the initial scrape has completed.
**Why bad:** The initial scrape takes 2-5 seconds. Polling adds complexity for a brief wait.
**Instead:** The add flow uses optimistic UI: immediately show the competitor card in "pending" state. When the scrape completes (background), the next page visit (or explicit refresh) shows full data. For immediate feedback, the server action can await the Apify call if latency is acceptable (< 5s), or the page can auto-refresh after a short delay.

### Anti-Pattern 5: Loading All Snapshots on Page Load

**What:** Fetching 30+ days of snapshots for all competitors when the page loads.
**Why bad:** Most users view the overview grid/table. Chart data is only needed when they drill into a specific competitor.
**Instead:** Load snapshots on-demand when user opens the competitor detail panel. This keeps the initial page load fast and database queries light.

---

## Scalability Considerations

| Concern | At 100 users (50 competitors each) | At 10K users | At 100K users |
|---------|-------------------------------------|--------------|---------------|
| Unique handles to scrape | ~2,000 unique handles | ~20,000 unique | ~50,000 unique |
| Apify cost per refresh | $0.60 (2K profiles) | $6 (20K) | $15 (50K) |
| Snapshot rows per month | ~120K | ~12M | ~120M |
| Cron execution time | < 30s | ~5 min (may need batching) | Needs async webhook pattern |
| Database storage | < 100 MB | ~5 GB | ~50 GB (needs partitioning) |
| RLS query performance | No concern | No concern | Consider read replicas |

**Scaling triggers:**
- **> 50K unique handles:** Switch from synchronous Apify calls to async (fire-and-forget + webhook), matching the backend-foundation pattern
- **> 10M snapshot rows:** Add PostgreSQL range partitioning by month on `competitor_snapshots`
- **> 50K users:** Consider a shared `tiktok_profiles` table to deduplicate snapshot storage
- **Query latency > 500ms:** Add materialized views for aggregated weekly/monthly metrics, refreshed by pg_cron

---

## Prediction Engine Integration Points

The competitor data model is designed to serve as input context for the prediction engine (backend-foundation milestone). Here are the specific hook points:

### 1. Competitor Benchmarking in Predictions

When the prediction engine analyzes a user's content, it can pull competitor data as benchmark context:

```typescript
// Future: src/lib/engine/context.ts
async function getCompetitorContext(userId: string, niche: string) {
  const supabase = createServiceClient();

  // Get user's tracked competitors in same niche
  const { data: competitors } = await supabase
    .from('competitor_profiles')
    .select('latest_followers, latest_engagement_rate, latest_video_count')
    .eq('user_id', userId)
    .contains('niches', [niche]);

  return {
    avgCompetitorEngagement: average(competitors.map(c => c.latest_engagement_rate)),
    avgCompetitorFollowers: average(competitors.map(c => c.latest_followers)),
    topCompetitorEngagement: max(competitors.map(c => c.latest_engagement_rate)),
  };
}
```

### 2. Competitor Video Analysis

Future capability: the prediction engine can analyze competitor videos to extract patterns (hooks, topics, formats) that perform well:

```typescript
// Future: competitor_videos can be fed into Gemini Flash for pattern extraction
// This doesn't require schema changes -- the competitor_videos table already stores
// description, hashtags, sound_name, and engagement metrics
```

### 3. Growth Prediction

Competitor snapshot time-series data can train simple growth models:

```typescript
// Future: Use competitor_snapshots to predict follower growth trajectories
// Input: 30 days of snapshots for a competitor
// Output: Predicted followers in 7/14/30 days
// This feeds into the prediction engine's "competitor intelligence" module
```

### 4. Schema-Level Integration

No foreign keys between competitor tables and prediction engine tables. Instead, the prediction engine references competitors by ID in its JSONB fields:

```sql
-- Future addition to analysis_results (backend-foundation schema)
-- analysis_results.metadata JSONB can include:
-- { "competitor_context": { "competitor_ids": [...], "avg_engagement": 0.045 } }
```

This keeps the two systems loosely coupled while enabling rich integration.

---

## Build Order (Dependency Graph)

```
Phase 1: Schema + Foundation
  - Migration: competitor_profiles, competitor_snapshots, competitor_videos
  - Types: src/types/competitor.ts
  - Extract: src/lib/supabase/service.ts
  - Scraping: src/lib/scraping/tiktok.ts + transform.ts
  No dependencies, can start immediately.

Phase 2: Server Actions + API Routes
  - Server actions: add, remove (competitors/actions.ts)
  - API routes: search, single refresh, cron refresh
  - vercel.json cron config
  Depends on Phase 1 (schema + scraping layer).

Phase 3: Page + Core Components
  - Route: /competitors/page.tsx
  - Middleware: add protected prefix
  - Sidebar: add nav item
  - Components: dashboard, card, table, header, empty state, stats bar
  - Store: competitors-store.ts
  Depends on Phase 2 (server actions for add/remove).

Phase 4: Detail + Charts
  - Components: detail panel, growth chart, content grid, benchmark
  - API: snapshot data fetching for charts
  Depends on Phase 3 (core UI) + Phase 1 (snapshot data).

Phase 5: Search + Add Flow
  - Components: add-competitor-modal, competitor-search
  - API: search route
  Depends on Phase 3 (modal renders within dashboard).
  Can be built in parallel with Phase 4.

Phase 6: Polish + Edge Cases
  - Loading skeletons, error states, empty states
  - Rate limiting on refresh
  - Scrape failure handling + retry
  - Mobile responsive layout
  Can start after Phase 3.
```

---

## Sources

- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- HIGH confidence, official docs
- [Supabase pg_cron](https://supabase.com/docs/guides/cron) -- HIGH confidence, official docs
- [Supabase TimescaleDB Deprecation](https://supabase.com/docs/guides/database/extensions/timescaledb) -- HIGH confidence, official docs
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) -- HIGH confidence, official docs
- [Vercel Cron Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- HIGH confidence, official docs
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- HIGH confidence, official docs
- [Apify TikTok Profile Scraper](https://apify.com/clockworks/tiktok-profile-scraper) -- MEDIUM confidence, third-party service
- [Apify TikTok Scraper API](https://apify.com/apidojo/tiktok-scraper-api) -- MEDIUM confidence, third-party service
- [Next.js ISR & Revalidation](https://nextjs.org/docs/app/guides/incremental-static-regeneration) -- HIGH confidence, official docs
- [Next.js revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) -- HIGH confidence, official docs
- Backend-foundation architecture at `/Users/davideloreti/virtuna-backend-foundation/.planning/research/ARCHITECTURE.md` -- HIGH confidence, sibling milestone
- Existing codebase at `/Users/davideloreti/virtuna-competitors-tool/` -- HIGH confidence, primary source
