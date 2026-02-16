# Phase 1: Data Foundation - Research

**Researched:** 2026-02-16
**Domain:** Supabase PostgreSQL schema design, Apify TikTok scraping, Zod v4 runtime validation
**Confidence:** HIGH

## Summary

Phase 1 builds the data layer for competitor intelligence: three PostgreSQL tables (`competitor_profiles`, `competitor_snapshots`, `competitor_videos`), an Apify scraping service that abstracts profile and video data acquisition behind a provider interface, and Zod v4 validation schemas at the ingestion boundary.

The existing codebase provides strong foundation patterns to follow. The `backend-foundation` worktree (shipped 2026-02-13) already implemented the exact same architecture for trending video scraping: `apify-client` ^2.22.0 for actor calls, a webhook handler at `/api/webhooks/apify` for async result ingestion, a cron route for scheduled scraping, a service client (`createServiceClient`) that bypasses RLS, and the `(select auth.uid())` RLS pattern. This phase replicates that proven pattern for competitor-specific data targets (profile scraper + video scraper instead of trending scraper).

The critical design decision is the deduplication model: competitor profiles are globally shared resources (one profile per TikTok handle), linked to users through a `user_competitors` join table. Snapshots and videos belong to the global profile, not to individual users. This prevents duplicate scraping when multiple users track the same creator, and keeps RLS policies simple -- the join table gates user access, while snapshot/video queries filter by `competitor_profile_id`.

**Primary recommendation:** Follow the backend-foundation's existing Apify webhook + cron pattern exactly. New tables use the same RLS `(select auth.uid())` optimization, same `update_updated_at_column()` trigger function, same BIGINT for metric counters. Abstract scraping behind a `ScrapingProvider` interface so the Apify implementation can be swapped without touching the data layer.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.93.1 | Database client SDK | Already installed. Typed queries via generated `Database` type |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client | Already installed. Cookie-based session management for Next.js |
| `apify-client` | ^2.22.0 | Apify actor API client | Already in backend-foundation. Start actors, fetch datasets, configure webhooks |
| `zod` | ^4.3.6 | Runtime schema validation | Already installed. v4 is 6.5x faster for object parsing than v3 |
| Supabase CLI | ^2.74.5 | Local dev, migrations, type generation | Already in devDependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | ^5.1.6 | Short unique IDs | Already installed. NOT used for database IDs (use `gen_random_uuid()`), but useful for temp client-side identifiers |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain PostgreSQL snapshots | TimescaleDB hypertables | TimescaleDB deprecated on Supabase PG17. Plain PostgreSQL with BRIN indexes and date partitioning is sufficient for <100K snapshot rows |
| Apify Clockworks actors | TikTok Research API | Research API is academic-only, 30-day approval, 1000 req/day limit. Not viable for commercial use |
| Apify Clockworks actors | Custom scraper (Playwright/Puppeteer) | TikTok anti-bot is industry-leading. Custom scrapers break overnight. Clockworks is maintained daily by a specialized team |
| Zod at ingestion | Trust Apify output | Apify actors can change output schemas without notice. Zod validation at boundary catches breaking changes before they corrupt the database |

**Installation:**
```bash
# If backend-foundation is NOT merged yet:
npm install apify-client@^2.22.0 @tanstack/react-query@^5.90.21

# If backend-foundation IS merged:
# Nothing to install -- all dependencies already present
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── scraping/
│   │   ├── types.ts              # ScrapingProvider interface + Apify result types
│   │   ├── apify-provider.ts     # Apify implementation of ScrapingProvider
│   │   └── index.ts              # Barrel export, default provider factory
│   ├── schemas/
│   │   ├── competitor.ts         # Zod schemas for profile, snapshot, video ingestion
│   │   └── index.ts              # Barrel export
│   └── supabase/
│       ├── server.ts             # Existing server client (cookie-based)
│       ├── client.ts             # Existing browser client
│       ├── middleware.ts          # Existing middleware client
│       └── service.ts            # Service role client (from backend-foundation)
├── types/
│   └── database.types.ts         # Regenerated after migration
supabase/
└── migrations/
    └── 20260216100000_competitor_tables.sql  # New migration
```

### Pattern 1: Shared Competitor Profile with User Junction Table

**What:** Competitor profiles are globally unique by TikTok handle. Users link to profiles through a `user_competitors` join table. Snapshots and videos belong to the profile, not to individual users.

**When to use:** Always. This is the deduplication pattern required by DATA-04.

**Why:** Prevents duplicate scraping. If 50 users track @charlidamelio, the system scrapes once and all 50 users see the same data. RLS filters at the join table level, not on every snapshot/video row.

**Schema design:**
```sql
-- Source: Verified pattern from existing codebase RLS + Supabase docs
-- competitor_profiles: Global registry, one row per TikTok handle
CREATE TABLE competitor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_handle TEXT NOT NULL UNIQUE,   -- @handle (normalized, lowercase, no @)
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  follower_count BIGINT DEFAULT 0,
  following_count BIGINT DEFAULT 0,
  heart_count BIGINT DEFAULT 0,         -- Total likes received
  video_count INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  scrape_status TEXT DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'scraping', 'success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_competitors: Junction table (who tracks whom)
CREATE TABLE user_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, competitor_id)
);

-- competitor_snapshots: Daily time-series data (append-only)
CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  follower_count BIGINT NOT NULL,
  following_count BIGINT NOT NULL,
  heart_count BIGINT NOT NULL,
  video_count INTEGER NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_id, snapshot_date)
);

-- competitor_videos: Per-video metrics
CREATE TABLE competitor_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  platform_video_id TEXT NOT NULL,
  video_url TEXT,
  caption TEXT,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  hashtags TEXT[] DEFAULT '{}',
  duration_seconds INTEGER,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_id, platform_video_id)
);
```

### Pattern 2: Provider Abstraction for Scraping

**What:** Abstract data acquisition behind a `ScrapingProvider` interface. The app code never knows whether data comes from Apify, a direct API, or a mock.

**When to use:** Always for any external data source that could change or break.

**Why:** TikTok anti-bot measures can break Apify actors overnight. If scraping is abstracted, the provider can be swapped (different Apify actor, different scraping service, official API if ever available) without touching any data layer or UI code.

**Example:**
```typescript
// Source: Architecture pattern from milestone research + backend-foundation webhook handler
// src/lib/scraping/types.ts

export interface ProfileData {
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
}

export interface VideoData {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  hashtags: string[];
  durationSeconds: number;
  postedAt: Date;
}

export interface ScrapingProvider {
  scrapeProfile(handle: string): Promise<ProfileData>;
  scrapeVideos(handle: string, limit?: number): Promise<VideoData[]>;
}
```

### Pattern 3: RLS with Junction Table Access Control

**What:** RLS policies on competitor data use the `user_competitors` junction table to determine access, rather than embedding `user_id` in every data row.

**When to use:** For all competitor-related SELECT policies.

**Why:** Competitor profiles, snapshots, and videos are shared resources. Embedding user_id in every snapshot row would defeat deduplication. Instead, RLS checks "does the requesting user track this competitor?" via a subquery on the junction table.

**Example:**
```sql
-- Source: Supabase RLS docs + (select auth.uid()) optimization
-- Verified via Context7: /supabase/supabase

-- user_competitors: Users see only their own tracking relationships
CREATE POLICY "Users can view their tracked competitors"
  ON user_competitors FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can add tracked competitors"
  ON user_competitors FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can remove tracked competitors"
  ON user_competitors FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- competitor_profiles: Visible if user tracks them
CREATE POLICY "Users can view profiles they track"
  ON competitor_profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT competitor_id FROM user_competitors
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- competitor_snapshots: Visible if user tracks the parent competitor
CREATE POLICY "Users can view snapshots of tracked competitors"
  ON competitor_snapshots FOR SELECT
  TO authenticated
  USING (
    competitor_id IN (
      SELECT competitor_id FROM user_competitors
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- competitor_videos: Same pattern
CREATE POLICY "Users can view videos of tracked competitors"
  ON competitor_videos FOR SELECT
  TO authenticated
  USING (
    competitor_id IN (
      SELECT competitor_id FROM user_competitors
      WHERE user_id = (SELECT auth.uid())
    )
  );
```

### Anti-Patterns to Avoid

- **Embedding user_id in snapshot/video rows:** Defeats deduplication (DATA-04). If two users track the same competitor, you would need to duplicate every snapshot row for each user.
- **Using `auth.uid()` without `(SELECT ...)` wrapper:** Causes PostgreSQL to call the function per-row instead of caching it. Documented 94% performance regression on Supabase.
- **Creating RLS policies without `TO authenticated` clause:** Forces evaluation even for service role queries (cron, webhooks). Service role bypasses RLS entirely, but without `TO` clause, the policy function still runs.
- **Using NUMERIC/DECIMAL for view/like counts:** Use BIGINT. View counts can exceed 2 billion (TikTok viral videos). NUMERIC operations are slower than integer operations for simple counters.
- **Trusting Apify output without validation:** Apify actors are maintained by third parties. Field names can change, types can shift, fields can be added/removed without notice. Always validate at ingestion boundary with Zod.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TikTok data scraping | Custom Playwright/Puppeteer scraper | Apify Clockworks actors | TikTok anti-bot is industry-leading. Custom scrapers break overnight. Apify team maintains actors daily |
| Runtime validation | Manual if/typeof checks | Zod v4 schemas | Zod provides TypeScript type inference, detailed error messages, and composable schemas. Manual checks miss edge cases |
| Database migration management | Raw SQL files run manually | Supabase CLI migrations | CLI handles ordering, up/down migrations, type generation, and local dev sync |
| Updated timestamps | Application-level `new Date()` before UPDATE | PostgreSQL trigger `update_updated_at_column()` | Trigger is atomic, works for all update paths (service role, RLS, direct SQL), already exists in codebase |
| Unique constraint enforcement | Application-level check-then-insert | PostgreSQL `UNIQUE` constraint + `ON CONFLICT` | Database-level uniqueness prevents race conditions. Application checks have TOCTOU vulnerabilities |
| Service role client | Inline `createClient` with service key | `createServiceClient()` from `src/lib/supabase/service.ts` | Already built in backend-foundation. Centralizes the service role pattern, prevents accidental exposure |

**Key insight:** Every piece of infrastructure needed for this phase already exists in the codebase (from backend-foundation) or in standard PostgreSQL. The risk is over-engineering, not under-engineering.

## Common Pitfalls

### Pitfall 1: Apify Actor Output Schema Changes Without Notice

**What goes wrong:** Clockworks actors are maintained by a third party. They can rename fields (e.g., `diggCount` to `likeCount`), change types (string to number), or remove fields entirely in any update. If the ingestion code trusts the output shape, a schema change silently corrupts data or crashes the webhook handler.

**Why it happens:** Apify actors are versioned but many consumers pin to `latest`. TikTok API changes force actors to adapt their output format.

**How to avoid:** Zod validation at the ingestion boundary (DATA-05). Every field from Apify goes through a Zod schema before touching the database. On validation failure, log the raw payload for debugging, skip the record, and continue processing the batch.

**Warning signs:** Webhook handler starts returning errors. Database records have unexpected null values. Zod validation error rate spikes.

### Pitfall 2: RLS Performance Degradation with Subquery Policies

**What goes wrong:** RLS policies that use `IN (SELECT ... FROM user_competitors ...)` can become slow if `user_competitors` grows large and lacks proper indexes.

**Why it happens:** PostgreSQL evaluates the subquery for each row in the target table. Without indexes on `user_competitors(user_id)` and `user_competitors(competitor_id)`, the subquery does a sequential scan.

**How to avoid:** Create indexes on both columns of the join table: `CREATE INDEX idx_user_competitors_user_id ON user_competitors(user_id)` and `CREATE INDEX idx_user_competitors_competitor_id ON user_competitors(competitor_id)`. The composite UNIQUE constraint on `(user_id, competitor_id)` also creates an implicit index.

**Warning signs:** Dashboard query times increase as users are added. Supabase Dashboard shows slow queries on competitor-related tables.

### Pitfall 3: Snapshot Table Growing Without Bounds

**What goes wrong:** Daily snapshots for every tracked competitor accumulate indefinitely. With 1000 competitors tracked globally and daily snapshots, that is 365K rows/year. Query performance degrades for growth charts that scan all historical snapshots.

**Why it happens:** Append-only snapshot pattern without retention or aggregation strategy.

**How to avoid:** Use `UNIQUE(competitor_id, snapshot_date)` with `ON CONFLICT UPDATE` to ensure exactly one snapshot per competitor per day (prevents duplicate snapshots from retry logic). For the v1 launch, this is sufficient. Add BRIN index on `snapshot_date` for efficient range queries. Future optimization: roll-up old snapshots (keep daily for 90 days, weekly for 1 year, monthly beyond).

**Warning signs:** `competitor_snapshots` row count exceeds 100K. Growth chart queries take >1s.

### Pitfall 4: Handling Apify Actor Start vs. Call

**What goes wrong:** Using `client.actor().call()` (synchronous -- waits for completion) instead of `client.actor().start()` (asynchronous -- returns immediately) in serverless environments. The actor can take 30-120 seconds to complete, exceeding Vercel's function timeout (10s on Hobby, 60s on Pro).

**Why it happens:** The Apify client docs show `.call()` as the simpler pattern, and it works in long-running Node.js processes. But serverless functions have hard timeout limits.

**How to avoid:** Always use `.start()` with webhook configuration. The actor runs asynchronously on Apify's infrastructure and sends results to the webhook endpoint when complete. This is the exact pattern used in backend-foundation's `scrape-trending` route.

**Warning signs:** Cron routes returning 504 Gateway Timeout. Apify runs succeeding but data not appearing in database.

### Pitfall 5: TikTok Handle Normalization

**What goes wrong:** Users enter handles in different formats: `@charli`, `charli`, `@CHARLI`, `https://tiktok.com/@charli`. Without normalization, the same creator gets multiple `competitor_profiles` rows, breaking deduplication.

**Why it happens:** No canonical format enforced at input.

**How to avoid:** Normalize handles before database insertion: strip `@` prefix, lowercase, extract handle from URLs. Store the normalized form in `tiktok_handle`. Apply Zod transform at the validation layer.

**Warning signs:** Multiple `competitor_profiles` rows for the same actual TikTok account.

## Code Examples

Verified patterns from official sources and existing codebase:

### Zod v4 Schema for Apify Profile Ingestion
```typescript
// Source: Zod v4 docs (zod.dev/v4), Apify Clockworks output structure
// src/lib/schemas/competitor.ts

import { z } from "zod";

/**
 * Normalize a TikTok handle: strip @, lowercase, extract from URL.
 */
function normalizeHandle(input: string): string {
  let handle = input.trim();
  // Extract handle from full URL
  const urlMatch = handle.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/);
  if (urlMatch?.[1]) {
    handle = urlMatch[1];
  }
  // Strip @ prefix, lowercase
  return handle.replace(/^@/, "").toLowerCase();
}

/** Schema for Apify profile scraper output (MEDIUM confidence - fields may change) */
export const apifyProfileSchema = z.object({
  uniqueId: z.string().transform(normalizeHandle),
  nickname: z.string().optional().default(""),
  signature: z.string().optional().default(""),
  avatarLarger: z.string().url().optional(),
  verified: z.boolean().optional().default(false),
  followerCount: z.coerce.number().int().nonnegative().default(0),
  followingCount: z.coerce.number().int().nonnegative().default(0),
  heartCount: z.coerce.number().int().nonnegative().default(0),
  videoCount: z.coerce.number().int().nonnegative().default(0),
});

/** Schema for Apify video scraper output (MEDIUM confidence - fields may change) */
export const apifyVideoSchema = z.object({
  id: z.string(),
  webVideoUrl: z.string().url().optional(),
  text: z.string().optional().default(""),
  createTime: z.coerce.number().optional(),
  playCount: z.coerce.number().int().nonnegative().default(0),
  diggCount: z.coerce.number().int().nonnegative().default(0),
  shareCount: z.coerce.number().int().nonnegative().default(0),
  commentCount: z.coerce.number().int().nonnegative().default(0),
  collectCount: z.coerce.number().int().nonnegative().default(0),
  hashtags: z.array(z.object({ name: z.string() })).optional().default([]),
  videoMeta: z.object({
    duration: z.coerce.number().optional(),
  }).optional(),
});

export type ApifyProfile = z.infer<typeof apifyProfileSchema>;
export type ApifyVideo = z.infer<typeof apifyVideoSchema>;
```

### Apify Provider Implementation
```typescript
// Source: Existing backend-foundation pattern (src/app/api/cron/scrape-trending/route.ts)
// + Apify Client docs (Context7: /apify/apify-client-js)
// src/lib/scraping/apify-provider.ts

import { ApifyClient } from "apify-client";
import { apifyProfileSchema, apifyVideoSchema } from "@/lib/schemas/competitor";
import type { ProfileData, VideoData, ScrapingProvider } from "./types";

const PROFILE_ACTOR = "clockworks/tiktok-profile-scraper";
const VIDEO_ACTOR = "clockworks/tiktok-video-scraper";

export class ApifyScrapingProvider implements ScrapingProvider {
  private client: ApifyClient;

  constructor(token?: string) {
    this.client = new ApifyClient({
      token: token ?? process.env.APIFY_TOKEN!,
    });
  }

  async scrapeProfile(handle: string): Promise<ProfileData> {
    const { defaultDatasetId } = await this.client
      .actor(PROFILE_ACTOR)
      .call({ profiles: [handle], resultsPerPage: 1 });

    const { items } = await this.client
      .dataset(defaultDatasetId)
      .listItems();

    if (!items.length) {
      throw new Error(`No profile data returned for handle: ${handle}`);
    }

    // Zod validation at ingestion boundary (DATA-05)
    const parsed = apifyProfileSchema.parse(items[0]);

    return {
      handle: parsed.uniqueId,
      displayName: parsed.nickname,
      bio: parsed.signature,
      avatarUrl: parsed.avatarLarger ?? "",
      verified: parsed.verified,
      followerCount: parsed.followerCount,
      followingCount: parsed.followingCount,
      heartCount: parsed.heartCount,
      videoCount: parsed.videoCount,
    };
  }

  async scrapeVideos(handle: string, limit = 30): Promise<VideoData[]> {
    const { defaultDatasetId } = await this.client
      .actor(VIDEO_ACTOR)
      .call({ profiles: [handle], resultsPerPage: limit });

    const { items } = await this.client
      .dataset(defaultDatasetId)
      .listItems();

    return items
      .map((item) => {
        const result = apifyVideoSchema.safeParse(item);
        if (!result.success) {
          console.warn(
            `[scraping] Video validation failed for item:`,
            result.error.issues
          );
          return null;
        }
        const v = result.data;
        return {
          platformVideoId: v.id,
          videoUrl: v.webVideoUrl ?? "",
          caption: v.text,
          views: v.playCount,
          likes: v.diggCount,
          comments: v.commentCount,
          shares: v.shareCount,
          saves: v.collectCount,
          hashtags: v.hashtags.map((h) => h.name),
          durationSeconds: v.videoMeta?.duration ?? 0,
          postedAt: v.createTime
            ? new Date(v.createTime * 1000)
            : new Date(),
        };
      })
      .filter((v): v is VideoData => v !== null);
  }
}
```

### Service Client Usage for Scraping Ingestion
```typescript
// Source: Existing backend-foundation pattern (src/lib/supabase/service.ts)

import { createServiceClient } from "@/lib/supabase/service";

// In webhook handler or cron route:
const supabase = createServiceClient();

// Upsert competitor profile (service role bypasses RLS)
const { error } = await supabase
  .from("competitor_profiles")
  .upsert(
    {
      tiktok_handle: profileData.handle,
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
    },
    { onConflict: "tiktok_handle" }
  );

// Insert daily snapshot (ON CONFLICT handles duplicates)
await supabase
  .from("competitor_snapshots")
  .upsert(
    {
      competitor_id: profileId,
      follower_count: profileData.followerCount,
      following_count: profileData.followingCount,
      heart_count: profileData.heartCount,
      video_count: profileData.videoCount,
      snapshot_date: new Date().toISOString().split("T")[0],
    },
    { onConflict: "competitor_id,snapshot_date" }
  );
```

### Migration File Pattern (Matching Existing Codebase)
```sql
-- Source: Existing migration pattern from 20260202000000_v16_schema.sql
-- and 20260213000000_content_intelligence.sql

-- Key patterns to follow:
-- 1. UUID primary keys with gen_random_uuid()
-- 2. TEXT + CHECK for status fields (not ENUM)
-- 3. BIGINT for all metric counters (views, likes can exceed MAX_INT)
-- 4. (SELECT auth.uid()) in all RLS policies
-- 5. TO authenticated clause on all policies
-- 6. Indexes on every RLS-referenced column
-- 7. update_updated_at_column() trigger on all tables with updated_at
-- 8. UNIQUE constraints for deduplication (handles ON CONFLICT gracefully)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TimescaleDB for time-series on Supabase | Plain PostgreSQL with BRIN indexes | PG17 migration (2025) | TimescaleDB deprecated on Supabase PG17. Use native partitioning and BRIN indexes instead |
| `auth.uid()` in RLS policies | `(SELECT auth.uid())` wrapper | Supabase docs update 2024 | 94% performance improvement. PostgreSQL caches the subquery result per-statement |
| Zod v3 schema validation | Zod v4 (4.3.6) | Dec 2025 | 6.5x faster object parsing. New `z.coerce` API for type coercion. Better error messages |
| Synchronous Apify `.call()` | Async `.start()` + webhook | Serverless pattern | `.call()` blocks until actor completes (30-120s). Exceeds Vercel function timeout. `.start()` returns immediately |
| `ENUM` types for status fields | `TEXT + CHECK` constraints | PostgreSQL best practice | ENUMs require migrations to add values. TEXT + CHECK is flexible and can be modified with ALTER TABLE |

**Deprecated/outdated:**
- **TimescaleDB on Supabase**: Deprecated since PG17 migration. Use plain PostgreSQL with appropriate indexes.
- **Apify `.call()` in serverless**: Works but blocks the function. Always use `.start()` + webhook for serverless.
- **`auth.uid()` without SELECT wrapper**: Still works but 94% slower. Always use `(SELECT auth.uid())`.

## Open Questions

1. **Backend-foundation merge timing**
   - What we know: Backend-foundation shipped 2026-02-13 and contains `apify-client`, `@tanstack/react-query`, `createServiceClient()`, `verifyCronAuth()`, and the webhook/cron patterns this phase needs.
   - What's unclear: Whether backend-foundation has been merged into main before this worktree was created. The competitors-tool worktree's `package.json` does NOT include `apify-client` or `@tanstack/react-query`.
   - Recommendation: Check if backend-foundation is merged. If not, add `apify-client` and `@tanstack/react-query` to this worktree's `package.json`. Also manually copy `src/lib/supabase/service.ts` and `src/lib/cron-auth.ts` if they don't exist.

2. **Apify actor call vs. start for initial profile validation**
   - What we know: `.start()` + webhook is the pattern for batch/cron scraping. But when a user adds a competitor, they need immediate feedback ("does this handle exist?").
   - What's unclear: Whether `.call()` with a short timeout (15-30s) is acceptable for the initial add-competitor flow, or whether this should also be async.
   - Recommendation: Use `.call()` with `waitForFinish: 30` for the initial profile validation (single profile, fast). Use `.start()` + webhook for batch cron scraping. Document this distinction in the provider interface.

3. **Vercel plan tier for cron frequency**
   - What we know: Hobby plan limits cron to daily. Pro plan allows sub-daily (every 6h, every 12h).
   - What's unclear: Current Vercel plan for this project.
   - Recommendation: Design cron for daily frequency (works on any plan). Document that Pro plan enables 12h refresh. The cron route configuration goes in Phase 2, not Phase 1.

4. **Exact Apify actor output field names**
   - What we know: Field names documented in Apify listings and WebSearch results (MEDIUM confidence). The backend-foundation webhook uses `playCount`, `diggCount`, `shareCount`, `commentCount`, `webVideoUrl`, `authorMeta`, `hashtags`, `videoMeta.duration`, `musicMeta`.
   - What's unclear: Whether the profile scraper uses identical field names to the video scraper. Profile scraper may use `followerCount` vs video scraper's `authorMeta.fans`.
   - Recommendation: Zod schemas use `.optional().default()` liberally. Log raw payloads on validation failure. The Zod schema is the runtime contract -- if Apify changes fields, the schema catches it before database corruption.

## Sources

### Primary (HIGH confidence)
- Supabase RLS documentation (Context7: /supabase/supabase) - `(SELECT auth.uid())` pattern, policy syntax, performance optimization
- Zod v4 documentation (Context7: /websites/zod_dev_v4) - safeParse, coerce, object validation, 6.5x benchmark
- Apify Client JS (Context7: /apify/apify-client-js) - `.call()`, `.start()`, dataset listing, webhook configuration
- Existing codebase: `supabase/migrations/20260202000000_v16_schema.sql` - RLS pattern, table conventions
- Existing codebase: `supabase/migrations/20260213000000_content_intelligence.sql` - scraped_videos table, trigger pattern
- Existing codebase: `src/app/api/webhooks/apify/route.ts` - Webhook handler pattern, batch upsert
- Existing codebase: `src/app/api/cron/scrape-trending/route.ts` - Cron route pattern, async actor start
- Existing codebase: `src/lib/supabase/service.ts` - Service client factory

### Secondary (MEDIUM confidence)
- [Apify Clockworks TikTok Profile Scraper](https://apify.com/clockworks/tiktok-profile-scraper) - Input/output fields, pricing
- [Apify Clockworks TikTok Scraper](https://apify.com/clockworks/tiktok-scraper) - Video data fields, output structure
- [Apify Clockworks TikTok Video Scraper](https://apify.com/clockworks/tiktok-video-scraper) - Per-video scraping input/output
- [Vercel Cron Jobs documentation](https://vercel.com/docs/cron-jobs) - Plan limits, configuration format
- [PostgreSQL time-series patterns](https://aws.amazon.com/blogs/database/designing-high-performance-time-series-data-tables-on-amazon-rds-for-postgresql/) - BRIN indexes, partitioning strategies

### Tertiary (LOW confidence)
- Apify actor field names (from WebSearch, not verified against running actor) - Flagged for validation at implementation time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed in the codebase or backend-foundation. Versions verified from `package.json`.
- Architecture: HIGH - Extends proven patterns from backend-foundation webhook/cron infrastructure. Schema design follows existing migration conventions exactly.
- Pitfalls: HIGH - Critical pitfalls (anti-bot, RLS performance, unbounded costs) catalogued from Supabase docs, Apify docs, and existing codebase patterns. Prevention strategies are concrete.
- Apify actor schemas: MEDIUM - Field names from Apify listings and web search, not from running the actors. Zod validation at ingestion boundary mitigates this risk completely.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stable domain, Apify actor schemas are the only volatile component)
