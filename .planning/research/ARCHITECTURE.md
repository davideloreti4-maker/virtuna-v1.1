# Architecture Patterns

**Domain:** Content Intelligence backend for existing Next.js 15 + Supabase + Vercel frontend
**Researched:** 2026-02-13
**Confidence:** HIGH (verified against existing codebase, Vercel docs, Supabase docs)

---

## Recommended Architecture

### High-Level System Diagram

```
                    CLIENT (Existing)
                    ================
    ContentForm -----> POST /api/analyze --------+
    TrendingClient --> GET  /api/trending -----+  |
    BrandDealsPage --> GET  /api/deals ------+  |  |
                                             |  |  |
                    API ROUTES (New)          |  |  |
                    ===============          |  |  |
    /api/deals/*  <-------------------------+  |  |
    /api/trending/*  <-------------------------+  |
    /api/analyze     <----------------------------+
         |
         +---> Gemini Flash (visual analysis) -----+
         +---> DB lookups (rules, trends) ---------+
                                                    |
         DeepSeek R1 (reasoning) <-----------------+
              |
              v
         Supabase (analysis_results, outcomes)

                    CRON ROUTES (New)
                    ================
    /api/cron/scrape-trending  (every 6h)  ---> Apify Actor ---> scraped_videos
    /api/cron/calculate-trends (hourly)    ---> scraped_videos --> trending_sounds
    /api/cron/validate-rules   (daily)     ---> outcomes --> rule_library
    /api/cron/retrain-ml       (weekly)    ---> outcomes --> ml_models
    /api/cron/sync-whop        (daily)     ---> [EXISTS] Whop API --> user_subscriptions
```

### Component Boundaries

| Component | Responsibility | Communicates With | Location |
|-----------|---------------|-------------------|----------|
| **Content Intelligence Engine** | Orchestrates dual-model prediction pipeline | Gemini API, DeepSeek API, Supabase | `src/lib/engine/` |
| **Analysis API Route** | HTTP endpoint, auth, rate limiting, request validation | Engine, Supabase Auth | `src/app/api/analyze/route.ts` |
| **Trending API Routes** | Serve real trending data, pagination, filters | Supabase `scraped_videos` table | `src/app/api/trending/` |
| **Deals API Routes** | Replace mock deal data with real endpoints | Supabase `deals` table | `src/app/api/deals/` |
| **Cron Routes** | Background job entry points | Apify API, Supabase, Engine | `src/app/api/cron/` |
| **TanStack Query Hooks** | Server state management, caching, pagination | API routes | `src/hooks/queries/` |
| **Zustand Stores** | Client-only state (bookmarks, sidebar, form state, simulation phase) | Nothing external | `src/stores/` (exists) |
| **Supabase Schema** | All persistent data | N/A | `supabase/migrations/` |

---

## Integration Points with Existing Code

### 1. ContentForm -> Analysis Engine (Critical Path)

**Current state:** `ContentForm` calls `onSubmit(content)` which triggers `testStore.submitTest()` with mock `setTimeout` delays and `generateMockVariants()`.

**Integration plan:**

```
ContentForm.onSubmit(content)
    |
    v
testStore.submitTest(content, societyId)  <-- MODIFY: replace mock logic
    |
    +-- Option A: Keep Zustand orchestration, call fetch() to /api/analyze
    +-- Option B: Use TanStack Query mutation, store result in query cache
```

**Recommendation: Option A for phase 1, migrate to Option B later.** The existing `submitTest` in `test-store.ts` already manages simulation phases (`analyzing`, `matching`, `simulating`, `generating`) with cancellation support. Replacing the mock `setTimeout` calls with real `fetch()` to `/api/analyze` preserves the existing UX flow with minimal changes. The simulation phases map directly to server-side pipeline stages via Server-Sent Events (SSE).

**Files to modify:**
- `src/stores/test-store.ts` -- replace mock generation with API call
- `src/types/test.ts` -- extend `TestResult` with engine response fields (or map)

**Files to create:**
- `src/app/api/analyze/route.ts` -- POST handler
- `src/lib/engine/pipeline.ts` -- orchestrator
- `src/lib/engine/gemini.ts` -- Gemini Flash client
- `src/lib/engine/deepseek.ts` -- DeepSeek R1 client
- `src/lib/engine/rules.ts` -- rule lookup + scoring
- `src/lib/engine/trends.ts` -- trend data enrichment
- `src/lib/engine/types.ts` -- shared engine types

### 2. TrendingClient -> Real Data (High Impact)

**Current state:** `TrendingClient` imports `getTrendingStats()` and `getAllVideos()` from `src/lib/trending-mock-data.ts`. The `useInfiniteVideos` hook also imports `getVideosByCategory()` from mock data. All 42 videos are static.

**Integration plan:**

```
TrendingClient
    |
    v
useInfiniteVideos(category)  <-- REWRITE: TanStack Query infinite query
    |
    v
GET /api/trending?category=breaking-out&cursor=xyz&limit=12
    |
    v
Supabase: SELECT * FROM scraped_videos WHERE category = $1 ...
```

**Files to modify:**
- `src/hooks/use-infinite-videos.ts` -- rewrite to use TanStack Query `useInfiniteQuery`
- `src/app/(app)/trending/trending-client.tsx` -- adapt to async data (replace `useMemo` stats)
- `src/types/trending.ts` -- align `TrendingVideo` type with DB schema

**Files to create:**
- `src/app/api/trending/route.ts` -- GET with pagination
- `src/app/api/trending/stats/route.ts` -- aggregated category stats
- `src/hooks/queries/use-trending.ts` -- TanStack Query wrapper
- `src/lib/queries/query-keys.ts` -- centralized query key factory

**Files to delete (eventually):**
- `src/lib/trending-mock-data.ts` -- replaced by real data

### 3. Brand Deals -> Real API (Moderate Impact)

**Current state:** `brand-deals-page.tsx` imports from `src/lib/mock-brand-deals.ts`. Components consume static arrays.

**Integration plan:** Same pattern as trending -- TanStack Query hooks wrapping API routes that query existing `deals`, `deal_enrollments` tables. The schema already exists.

**Files to create:**
- `src/app/api/deals/route.ts` -- GET deals list with filters
- `src/app/api/deals/[id]/apply/route.ts` -- POST enrollment
- `src/app/api/deals/enrollments/route.ts` -- GET user's enrollments
- `src/hooks/queries/use-deals.ts` -- TanStack Query hooks

### 4. Bookmark Store -> Database Sync (Low Priority, Future)

**Current state:** `bookmark-store.ts` uses `localStorage` with manual `_hydrate()`. Works entirely client-side.

**Integration plan (deferred):** Keep `localStorage` for now. Later, sync to Supabase `user_bookmarks` table. The existing pattern is fine for MVP -- bookmarks are low-value data that doesn't need server persistence yet.

### 5. ViralResultsCard -> Engine Results (Natural Fit)

**Current state:** `ViralResultsCard` accepts a `ViralResult` prop with `overallScore`, `tier`, `confidence`, `factors[]`. Currently only shown in the showcase.

**Integration plan:** The engine response type should map to `ViralResult`. The existing component needs no modification -- only the data source changes. The `/api/analyze` response should return data shaped to populate both `TestResult` (for simulation panel) and `ViralResult` (for the premium results card).

---

## Data Flow Patterns

### Pattern 1: Analysis Request (Synchronous with SSE Progress)

```
Client                    Server                     External APIs
------                    ------                     -------------
POST /api/analyze    -->  Validate + auth check
  { content, type }       Create analysis record

                     <--  SSE: { phase: "analyzing" }

                          Gemini Flash(content)  --> Google AI API
                          DB: rules lookup       --> Supabase
                          DB: trend lookup       --> Supabase

                     <--  SSE: { phase: "matching" }

                          Wait for Gemini result

                     <--  SSE: { phase: "simulating" }

                          DeepSeek R1(prompt)    --> DeepSeek API

                     <--  SSE: { phase: "generating" }

                          Aggregate scores
                          Save to analysis_results

                     <--  SSE: { phase: "complete", data: AnalysisResult }
```

**Why SSE over polling:** The existing simulation UI already expects sequential phase updates. SSE maps cleanly to `simulationPhase` state in `test-store.ts`. No additional client infrastructure needed -- just an `EventSource` or `fetch()` with streaming reader.

**Implementation:**

```typescript
// src/app/api/analyze/route.ts
export async function POST(request: Request) {
  const { content, testType, societyId } = await request.json();
  const user = await getAuthUser(request);

  // Rate limit check
  // ...

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ phase: 'analyzing' });

        // Parallel: Gemini + DB lookups
        const [geminiResult, rules, trends] = await Promise.all([
          analyzeWithGemini(content, testType),
          lookupRules(testType),
          lookupTrends(testType),
        ]);

        send({ phase: 'matching' });

        // Sequential: DeepSeek reasoning with all inputs
        const deepseekResult = await reasonWithDeepSeek({
          geminiAnalysis: geminiResult,
          rules,
          trends,
          content,
        });

        send({ phase: 'simulating' });

        // Score aggregation
        const result = aggregateScores(geminiResult, deepseekResult, rules, trends);

        send({ phase: 'generating' });

        // Persist
        await saveAnalysisResult(user.id, result);

        send({ phase: 'complete', data: result });
      } catch (error) {
        send({ phase: 'error', message: 'Analysis failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### Pattern 2: Apify Scraping Pipeline (Cron -> Webhook -> DB)

```
Vercel Cron (every 6h)
    |
    v
GET /api/cron/scrape-trending
    |
    v
Apify API: Start Actor run (tiktok-scraper)
    |                              |
    v                              v
Return 200 (fire-and-forget)    Apify completes run
                                   |
                                   v
                              POST /api/webhooks/apify
                                   |
                                   v
                              Fetch results from Apify dataset
                                   |
                                   v
                              Transform + upsert into scraped_videos
                                   |
                                   v
                              Invalidate trending cache
```

**Why fire-and-forget + webhook:** Apify scraping takes 2-10 minutes. Vercel functions timeout at 300s (Hobby) / 800s (Pro with Fluid Compute). The cron route should kick off the Apify actor and return immediately. Apify's webhook calls back when done.

**Implementation:**

```typescript
// src/app/api/cron/scrape-trending/route.ts
export async function GET(request: Request) {
  verifycronSecret(request);

  const actorRun = await fetch('https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`,
    },
    body: JSON.stringify({
      input: { /* scraper config */ },
      webhooks: [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`,
        headersTemplate: `{"Authorization": "Bearer ${process.env.APIFY_WEBHOOK_SECRET}"}`,
      }],
    }),
  });

  return NextResponse.json({ started: true, runId: (await actorRun.json()).data.id });
}

// src/app/api/webhooks/apify/route.ts
export async function POST(request: Request) {
  verifyApifyWebhook(request);

  const { resource } = await request.json();
  const datasetId = resource.defaultDatasetId;

  // Fetch results from Apify dataset
  const results = await fetchApifyDataset(datasetId);

  // Transform and upsert
  const supabase = createServiceClient();
  const transformed = results.map(transformApifyToVideo);

  await supabase.from('scraped_videos').upsert(transformed, {
    onConflict: 'platform_video_id',
  });

  return NextResponse.json({ processed: transformed.length });
}
```

### Pattern 3: Trend Calculation (Cron -> DB -> DB)

```
Vercel Cron (hourly)
    |
    v
GET /api/cron/calculate-trends
    |
    v
Supabase: SELECT sounds/hashtags from scraped_videos
  WHERE scraped_at > NOW() - INTERVAL '7 days'
  GROUP BY sound_id
  ORDER BY velocity DESC
    |
    v
Calculate: velocity = growth_rate * recency_weight
    |
    v
Supabase: UPSERT into trending_sounds
    |
    v
Return { calculated: count }
```

**This fits within Vercel function limits** because it's pure DB queries and math -- no external API waits. Should complete in under 30 seconds for thousands of videos.

---

## Database Schema Design

### New Tables (Content Intelligence)

```sql
-- =====================================================
-- SCRAPED VIDEOS (Apify pipeline output)
-- =====================================================
CREATE TABLE scraped_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'tiktok',
  platform_video_id TEXT NOT NULL,

  -- Video metadata
  title TEXT,
  description TEXT,
  creator_handle TEXT,
  creator_display_name TEXT,
  creator_avatar_url TEXT,
  thumbnail_url TEXT,
  video_url TEXT,

  -- Metrics (snapshotted at scrape time)
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,

  -- Classification
  hashtags TEXT[] DEFAULT '{}',
  sound_id TEXT,
  sound_name TEXT,
  category TEXT CHECK (category IN ('breaking-out', 'trending-now', 'rising-again')),

  -- Computed metrics
  velocity NUMERIC(10,2),  -- views relative to creator average
  engagement_rate NUMERIC(8,4),

  -- Timestamps
  published_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- Dedup
  UNIQUE(platform, platform_video_id)
);

CREATE INDEX idx_scraped_videos_category ON scraped_videos(category);
CREATE INDEX idx_scraped_videos_scraped_at ON scraped_videos(scraped_at DESC);
CREATE INDEX idx_scraped_videos_velocity ON scraped_videos(velocity DESC NULLS LAST);
CREATE INDEX idx_scraped_videos_sound_id ON scraped_videos(sound_id) WHERE sound_id IS NOT NULL;

-- =====================================================
-- TRENDING SOUNDS (hourly aggregation)
-- =====================================================
CREATE TABLE trending_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_id TEXT NOT NULL UNIQUE,
  sound_name TEXT,

  -- Trend metrics
  video_count INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  avg_engagement_rate NUMERIC(8,4),
  velocity_score NUMERIC(10,2),

  -- Lifecycle
  first_seen_at TIMESTAMPTZ,
  peak_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  trend_phase TEXT CHECK (trend_phase IN ('emerging', 'rising', 'peak', 'declining', 'dead'))
);

CREATE INDEX idx_trending_sounds_velocity ON trending_sounds(velocity_score DESC);
CREATE INDEX idx_trending_sounds_phase ON trending_sounds(trend_phase);

-- =====================================================
-- ANALYSIS RESULTS (engine output)
-- =====================================================
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input
  content TEXT NOT NULL,
  test_type TEXT NOT NULL,

  -- Scores
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  confidence TEXT NOT NULL CHECK (confidence IN ('High', 'Medium', 'Low')),

  -- Detailed breakdown (JSONB for flexible schema evolution)
  factors JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{ id, name, score, maxScore, description, tips[] }]

  attention JSONB,
  -- Structure: { full: number, partial: number, ignore: number }

  variants JSONB DEFAULT '[]',
  -- Structure: [{ id, type, content, impactScore, label }]

  insights TEXT[] DEFAULT '{}',
  conversation_themes JSONB DEFAULT '[]',

  -- Engine metadata
  gemini_model TEXT,
  deepseek_model TEXT,
  engine_version TEXT,
  latency_ms INTEGER,
  cost_cents NUMERIC(8,4),

  -- Score components
  rule_score NUMERIC(5,2),
  trend_score NUMERIC(5,2),
  ml_score NUMERIC(5,2),
  score_weights JSONB,
  -- Structure: { rule: 0.5, trend: 0.3, ml: 0.2 }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_user_id ON analysis_results(user_id);
CREATE INDEX idx_analysis_results_created_at ON analysis_results(created_at DESC);

-- =====================================================
-- OUTCOMES (actual performance tracking)
-- =====================================================
CREATE TABLE outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Actual performance
  actual_views BIGINT,
  actual_likes BIGINT,
  actual_shares BIGINT,
  actual_engagement_rate NUMERIC(8,4),

  -- Predicted vs actual
  predicted_score INTEGER,
  actual_score INTEGER,
  delta INTEGER,  -- actual - predicted

  -- When we collected this
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  platform TEXT DEFAULT 'tiktok',
  platform_post_url TEXT
);

CREATE INDEX idx_outcomes_analysis_id ON outcomes(analysis_id);
CREATE INDEX idx_outcomes_user_id ON outcomes(user_id);

-- =====================================================
-- RULE LIBRARY (expert heuristics)
-- =====================================================
CREATE TABLE rule_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rule definition
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  -- Categories: 'hook', 'emotion', 'structure', 'trend', 'audio', 'visual'

  -- Scoring
  weight NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 10.0,

  -- Rule logic (stored as structured evaluation criteria)
  evaluation_prompt TEXT NOT NULL,
  -- The prompt template sent to the LLM for scoring this factor

  -- Validation
  accuracy_rate NUMERIC(5,4),
  -- Updated by rule validator cron
  sample_count INTEGER DEFAULT 0,

  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rule_library_category ON rule_library(category);
CREATE INDEX idx_rule_library_active ON rule_library(is_active) WHERE is_active = TRUE;
```

### RLS Policies for New Tables

```sql
-- scraped_videos: Public read (trending page is public)
ALTER TABLE scraped_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scraped videos"
  ON scraped_videos FOR SELECT
  USING (true);
-- Writes: service_role only (cron routes use service client)

-- trending_sounds: Public read
ALTER TABLE trending_sounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view trending sounds"
  ON trending_sounds FOR SELECT
  USING (true);

-- analysis_results: User owns their results
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own analysis results"
  ON analysis_results FOR SELECT
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can create analysis results"
  ON analysis_results FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- outcomes: User owns their outcomes
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own outcomes"
  ON outcomes FOR SELECT
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can create own outcomes"
  ON outcomes FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- rule_library: Public read (engine needs this), admin write
ALTER TABLE rule_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active rules"
  ON rule_library FOR SELECT
  USING (is_active = true);
```

### RLS Design Decisions

1. **`(SELECT auth.uid())` wrapper everywhere** -- Already established in existing migrations. The subquery wrapper causes PostgreSQL to cache the auth function result per-statement, yielding 94%+ performance improvement on large tables. (Source: [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv))

2. **Public read for scraped_videos and trending_sounds** -- The trending page is accessible to all authenticated users. No per-user filtering needed.

3. **Service role for all writes to scraped/trending tables** -- Cron routes use `createServiceClient()` (pattern already established in `sync-whop/route.ts`). No RLS INSERT policies needed for these tables.

4. **JSONB for flexible nested data in analysis_results** -- Factors, variants, and themes are complex nested structures. JSONB allows schema evolution without migrations. Performance is fine since we query by `user_id` (indexed), not by JSONB contents.

5. **TEXT + CHECK over ENUMs** -- Already established pattern in existing schema. More flexible for migrations.

---

## API Route Organization

### Directory Structure

```
src/app/api/
  analyze/
    route.ts                 # POST: Submit content for analysis
  trending/
    route.ts                 # GET: Paginated trending videos
    stats/route.ts           # GET: Aggregate category stats
    [videoId]/route.ts       # GET: Single video detail
  deals/
    route.ts                 # GET: Filtered deal listings
    [id]/
      route.ts               # GET: Single deal detail
      apply/route.ts         # POST: Apply to deal
    enrollments/route.ts     # GET: User's deal enrollments
  outcomes/
    route.ts                 # POST: Report outcome, GET: User's outcomes
  cron/
    scrape-trending/route.ts # GET: Kick off Apify scraper
    calculate-trends/route.ts # GET: Aggregate trend metrics
    validate-rules/route.ts  # GET: Validate rule accuracy
    retrain-ml/route.ts      # GET: Retrain ML models (future)
    sync-whop/route.ts       # [EXISTS] Whop subscription sync
  webhooks/
    apify/route.ts           # POST: Apify run completion webhook
    whop/route.ts            # [EXISTS] Whop payment webhooks
  subscription/route.ts      # [EXISTS]
  whop/checkout/route.ts     # [EXISTS]
```

### vercel.json Cron Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-trending",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/calculate-trends",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/validate-rules",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/retrain-ml",
      "schedule": "0 4 * * 1"
    },
    {
      "path": "/api/cron/sync-whop",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Vercel Pro plan allows 40 cron jobs.** We use 5. Each uses `CRON_SECRET` authorization (pattern already established in `sync-whop`). (Source: [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs))

**Function timeout considerations:**
- `/api/analyze`: 60-120s (Gemini + DeepSeek sequential). Set `maxDuration: 120` in route config.
- `/api/cron/scrape-trending`: <5s (fire-and-forget to Apify). Default timeout fine.
- `/api/cron/calculate-trends`: <30s (DB aggregation). Default timeout fine.
- `/api/webhooks/apify`: <60s (fetch dataset + upsert). Set `maxDuration: 60`.

(Source: [Vercel Function Limits](https://vercel.com/docs/functions/limitations) -- Pro plan: up to 800s with Fluid Compute)

---

## TanStack Query + Zustand Coexistence

### Architecture Rule

**Zustand = client state. TanStack Query = server state. Never mix.**

| State Type | Tool | Examples |
|------------|------|----------|
| Server data (fetched from API) | TanStack Query | Trending videos, deals, analysis results, user profile |
| Client-only UI state | Zustand | Sidebar collapsed, form content, simulation phase, bookmarks |
| Derived/computed | Neither (React `useMemo`) | Filtered video list, stats calculations |

### Existing Zustand Stores -- What Changes

| Store | Current Use | After Integration | Change? |
|-------|-------------|-------------------|---------|
| `test-store.ts` | Mock simulation + localStorage results | Real API calls + simulation phase tracking | **MODIFY** -- keep phase management, remove mock data generation, results come from API |
| `bookmark-store.ts` | localStorage bookmark IDs | Keep as-is (client-only) | **NO CHANGE** |
| `sidebar-store.ts` | Sidebar collapsed state | Keep as-is | **NO CHANGE** |
| `society-store.ts` | Selected society | Keep as-is | **NO CHANGE** |
| `settings-store.ts` | User settings | Keep as-is | **NO CHANGE** |

### TanStack Query Setup

```typescript
// src/lib/queries/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,      // 1 minute
        gcTime: 5 * 60 * 1000,     // 5 minutes
        refetchOnWindowFocus: false, // Avoid surprise refetches
        retry: 1,
      },
    },
  });
}

// src/lib/queries/query-keys.ts
export const queryKeys = {
  trending: {
    all: ['trending'] as const,
    list: (category: string, cursor?: string) =>
      ['trending', 'list', category, cursor] as const,
    stats: () => ['trending', 'stats'] as const,
    detail: (id: string) => ['trending', 'detail', id] as const,
  },
  deals: {
    all: ['deals'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['deals', 'list', filters] as const,
    detail: (id: string) => ['deals', 'detail', id] as const,
    enrollments: () => ['deals', 'enrollments'] as const,
  },
  analysis: {
    all: ['analysis'] as const,
    history: () => ['analysis', 'history'] as const,
    detail: (id: string) => ['analysis', 'detail', id] as const,
  },
} as const;
```

### Provider Setup

```typescript
// src/app/(app)/providers.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { makeQueryClient } from '@/lib/queries/query-client';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// src/app/(app)/layout.tsx -- MODIFY existing
// Wrap children with AppProviders
```

### Example: Trending Page Migration

```typescript
// src/hooks/queries/use-trending.ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/query-keys';
import type { TrendingVideo, TrendingCategory, TrendingStats } from '@/types/trending';

interface TrendingPage {
  videos: TrendingVideo[];
  nextCursor: string | null;
  total: number;
}

export function useTrendingVideos(category: TrendingCategory) {
  return useInfiniteQuery({
    queryKey: queryKeys.trending.list(category),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ category, limit: '12' });
      if (pageParam) params.set('cursor', pageParam);

      const res = await fetch(`/api/trending?${params}`);
      if (!res.ok) throw new Error('Failed to fetch trending');
      return res.json() as Promise<TrendingPage>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
  });
}

export function useTrendingStats() {
  return useQuery({
    queryKey: queryKeys.trending.stats(),
    queryFn: async () => {
      const res = await fetch('/api/trending/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<TrendingStats>;
    },
    staleTime: 5 * 60 * 1000, // Stats change slowly
  });
}
```

---

## Patterns to Follow

### Pattern 1: Service Client for Cron/Webhook Routes

**What:** Use Supabase service role client (bypasses RLS) in server-only routes.
**When:** Cron routes, webhook handlers, any route writing data on behalf of system (not user).
**Already established:** `sync-whop/route.ts` and `webhooks/whop/route.ts` both use this pattern.

```typescript
// src/lib/supabase/service.ts (NEW -- extract from existing routes)
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

### Pattern 2: Cron Route Authorization

**What:** Verify `CRON_SECRET` Bearer token on all cron endpoints.
**Already established:** `sync-whop/route.ts` checks `authorization` header.

```typescript
// src/lib/cron-auth.ts (NEW -- extract shared pattern)
import { NextResponse } from 'next/server';

export function verifyCronAuth(request: Request): NextResponse | null {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null; // Authorized
}
```

### Pattern 3: SSE for Long-Running Analysis

**What:** Stream progress phases via Server-Sent Events for the analysis endpoint.
**When:** The `/api/analyze` route takes 3-8 seconds with parallel AI calls.
**Why:** Maps directly to existing `simulationPhase` state machine in `test-store.ts`. The phases (`analyzing` -> `matching` -> `simulating` -> `generating`) are already defined client-side.

### Pattern 4: Cursor-Based Pagination

**What:** Use opaque cursor strings (base64-encoded `created_at` + `id`) for infinite scroll.
**When:** Trending videos, analysis history, deal listings.
**Why:** Offset pagination breaks when new items are inserted. Cursor pagination is stable.

```typescript
// Encoding
const cursor = Buffer.from(`${row.created_at}|${row.id}`).toString('base64url');

// Decoding + query
const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|');
const { data } = await supabase
  .from('scraped_videos')
  .select('*')
  .lt('created_at', createdAt)
  .order('created_at', { ascending: false })
  .limit(pageSize);
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mixing Server State into Zustand

**What:** Storing API response data in Zustand stores alongside client state.
**Why bad:** Leads to stale data, cache invalidation nightmares, and manual refetch logic that TanStack Query handles automatically. The existing `test-store.ts` storing `tests[]` in localStorage is tech debt -- acceptable for now but should migrate to TanStack Query + server persistence.
**Instead:** Zustand for UI state only. TanStack Query for all data fetched from APIs.

### Anti-Pattern 2: Supabase Client Queries from Components

**What:** Importing Supabase client directly in components and making queries.
**Why bad:** Bypasses API route layer, makes it harder to add rate limiting/auth/caching, and couples components to database schema.
**Instead:** Components -> TanStack Query hooks -> API routes -> Supabase.

### Anti-Pattern 3: Long-Running Cron Routes

**What:** Waiting for external API completion inside cron route handlers.
**Why bad:** Vercel function timeout. Apify scraping takes minutes. The cron route will 504.
**Instead:** Fire-and-forget pattern. Cron triggers the job, webhook receives the result.

### Anti-Pattern 4: Polling for Analysis Progress

**What:** Client polling `/api/analyze/status/:id` every second to check progress.
**Why bad:** Unnecessary network requests, latency spikes, and complexity.
**Instead:** SSE stream from the analysis endpoint. One connection, real-time updates.

### Anti-Pattern 5: Creating New Supabase Service Clients Per-Query

**What:** Calling `createServiceClient()` multiple times within a single request handler.
**Why bad:** Each call creates a new HTTP client. Wasteful.
**Instead:** Create once per request handler, pass to helper functions.

---

## File Ownership Zones for Parallel Development

### Zone A: Engine (can work independently)

```
src/lib/engine/
  pipeline.ts        -- Orchestrator
  gemini.ts          -- Gemini Flash client
  deepseek.ts        -- DeepSeek R1 client
  rules.ts           -- Rule lookup + scoring
  trends.ts          -- Trend data enrichment
  aggregator.ts      -- Score aggregation
  types.ts           -- Shared engine types
```

**Dependencies:** Supabase client, API keys. No UI dependencies.

### Zone B: Database (can work independently)

```
supabase/migrations/
  20260213000000_content_intelligence.sql  -- New tables
src/types/database.types.ts                -- Regenerate after migration
```

**Dependencies:** None. Pure SQL.

### Zone C: API Routes (depends on Zone A + B)

```
src/app/api/
  analyze/route.ts
  trending/route.ts
  trending/stats/route.ts
  deals/route.ts
  deals/[id]/apply/route.ts
  deals/enrollments/route.ts
  outcomes/route.ts
  cron/scrape-trending/route.ts
  cron/calculate-trends/route.ts
  cron/validate-rules/route.ts
  webhooks/apify/route.ts
src/lib/supabase/service.ts
src/lib/cron-auth.ts
```

### Zone D: Client Integration (depends on Zone C)

```
src/hooks/queries/            -- All TanStack Query hooks
src/lib/queries/              -- Query client, key factory
src/app/(app)/providers.tsx   -- QueryClientProvider
src/stores/test-store.ts      -- Modify for real API
src/hooks/use-infinite-videos.ts  -- Rewrite for TanStack Query
```

### Zone E: UI Polish (depends on Zone D, can start in parallel with mocks)

```
src/components/app/simulation/   -- Already built, wire to real data
src/components/viral-results/    -- Already built, wire to real data
src/components/trending/         -- Already built, swap mock data
src/components/app/brand-deals/  -- Already built, swap mock data
```

### Parallel Development Strategy

```
Wave 1 (no dependencies): Zone A + Zone B in parallel
Wave 2 (depends on Wave 1): Zone C
Wave 3 (depends on Wave 2): Zone D + Zone E in parallel
```

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Analysis API cost | ~$1.30/day | ~$130/day | Tier-gated, cache common analyses |
| Supabase row count | ~1K analyses, ~500 videos | ~100K analyses, ~5K videos | Partition by date, archive old |
| Apify scraper | 1 actor run / 6h | Same (scraping is independent of users) | Same |
| TanStack Query cache | No concern | No concern | Stale-while-revalidate for trending |
| Function cold starts | Negligible | Negligible (Fluid Compute keeps warm) | Multi-region function deployment |
| ML training data | Too early | Enough for basic model | Production ML pipeline |

---

## Sources

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) -- HIGH confidence, official docs
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) -- HIGH confidence, official docs
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- HIGH confidence, official docs
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) -- HIGH confidence, official docs
- [TanStack Query + Zustand coexistence](https://javascript.plainenglish.io/zustand-and-tanstack-query-the-dynamic-duo-that-simplified-my-react-state-management-e71b924efb90) -- MEDIUM confidence, community pattern
- [Zustand + TanStack Query discussion](https://github.com/pmndrs/zustand/discussions/2289) -- MEDIUM confidence, maintainer-adjacent
- [Next.js after() API](https://nextjs.org/docs/app/api-reference/functions/unstable_after) -- HIGH confidence, official docs
- [Apify TikTok Scraper](https://apify.com/clockworks/tiktok-scraper) -- MEDIUM confidence, third-party service
- [DeepSeek R1 API](https://api-docs.deepseek.com/) -- MEDIUM confidence, official but may change
- [Gemini API Structured Output](https://ai.google.dev/gemini-api/docs/function-calling) -- MEDIUM confidence, rapid iteration
- Existing codebase at `/Users/davideloreti/virtuna-backend-foundation/` -- HIGH confidence, primary source
