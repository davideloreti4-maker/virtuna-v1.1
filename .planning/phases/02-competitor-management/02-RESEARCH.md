# Phase 2: Competitor Management - Research

**Researched:** 2026-02-16
**Domain:** Next.js server actions, Vercel cron jobs, Supabase upsert patterns, Apify async scraping, handle validation
**Confidence:** HIGH

## Summary

Phase 2 builds the user-facing operations layer on top of Phase 1's data foundation: server actions for adding and removing competitors, and a Vercel cron route for daily batch re-scraping. The core challenge is bridging the synchronous user experience ("paste a handle, see it get validated") with the asynchronous scraping backend ("Apify actors take 5-60s to complete").

Phase 1 established a junction table deduplication model: `competitor_profiles` are globally shared (one row per TikTok handle), linked to users through `user_competitors`. Phase 2's server actions must work with this model -- the "add competitor" flow is a two-step operation: (1) find or create the shared `competitor_profiles` row, (2) insert a `user_competitors` junction row linking the current user. The "remove competitor" flow only deletes the junction row, never the shared profile (other users may still track it).

The cron route follows the proven backend-foundation pattern: `GET /api/cron/refresh-competitors` protected by `CRON_SECRET` Bearer token, using the service role client to bypass RLS. The key architectural choice is whether to use synchronous `.call()` (simpler, blocks until done) or asynchronous `.start()` + webhook (non-blocking, handles larger batches). For Phase 2, the research recommends a **hybrid approach**: synchronous `.call()` with short timeout for the initial add-competitor validation (single profile, fast), and synchronous `.call()` with longer timeout for the cron batch (all unique handles). The async webhook pattern from backend-foundation is available as a scaling escape hatch but adds complexity unnecessary at launch scale.

**Primary recommendation:** Use Next.js server actions (in `src/app/actions/competitors/`) with `revalidatePath` for add/remove operations. Use the existing `createScrapingProvider()` factory from Phase 1 for scraping calls. Create `vercel.json` with a daily cron schedule and `src/lib/cron-auth.ts` for endpoint protection. Keep the scraping synchronous for now; switch to async webhook pattern only when batch size exceeds 50 handles or cron execution exceeds 30s.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.1.5 | Server actions, API route handlers, `revalidatePath` | Already installed. Server actions are the built-in mutation pattern for Next.js App Router |
| `@supabase/supabase-js` | ^2.93.1 | Database operations (CRUD, RLS-gated queries) | Already installed. Typed with generated `Database` type |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client with cookies | Already installed. Used by `createClient()` in server actions |
| `apify-client` | ^2.22.1 | Apify actor calls for TikTok scraping | Already installed by Phase 1 (01-02). Used via `ScrapingProvider` abstraction |
| `zod` | ^4.3.6 | Input validation for handle format, action params | Already installed. Phase 1 established Zod schemas for scraping output |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-alert-dialog` | ^1.1.15 | Confirmation dialog for competitor removal | Already installed. Use for destructive action confirmation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server actions for mutations | API routes (POST /api/competitors) | Server actions are simpler (no manual auth check, built-in revalidation). API routes needed only for non-mutation endpoints (cron, webhooks) |
| Synchronous Apify `.call()` for cron | Async `.start()` + webhook | Webhook pattern is production-proven in backend-foundation but adds 3 files (cron route, webhook route, webhook handler) vs. 1 file (cron route with inline processing). Use sync until batch size justifies async |
| `vercel.json` cron | Supabase `pg_cron` | Vercel Cron is already the pattern (backend-foundation uses it). pg_cron can't easily call external APIs (Apify) |

**Installation:**
```bash
# Nothing to install -- all dependencies already present from Phase 1
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── actions/
│   │   └── competitors/
│   │       ├── add.ts               # addCompetitor server action
│   │       └── remove.ts            # removeCompetitor server action
│   ├── api/
│   │   └── cron/
│   │       └── refresh-competitors/
│   │           └── route.ts         # GET: daily batch re-scrape
│   └── (app)/
│       └── competitors/             # Phase 3 creates the page here
├── lib/
│   ├── cron-auth.ts                 # CRON_SECRET verification utility
│   ├── scraping/                    # Phase 1 output (reused)
│   │   ├── types.ts
│   │   ├── apify-provider.ts
│   │   └── index.ts
│   ├── schemas/
│   │   └── competitor.ts            # Phase 1 Zod schemas (reused)
│   └── supabase/
│       ├── server.ts                # Existing (RLS-gated)
│       └── service.ts               # Phase 1 output (service role, RLS-bypass)
vercel.json                          # NEW: Cron schedule configuration
```

### Pattern 1: Server Actions for Competitor Mutations

**What:** `"use server"` functions in `src/app/actions/competitors/` that handle add/remove operations with Supabase, validate input, scrape initial data, and call `revalidatePath`.

**When to use:** For all user-initiated mutations (add competitor, remove competitor). NOT for cron routes or background jobs.

**Why this location:** The roadmap's file ownership specifies `src/app/actions/competitors/`. Placing actions in a dedicated `actions/` directory (rather than colocated `competitors/actions.ts`) keeps server actions separate from page components and allows reuse across pages. This matches the project's existing pattern in `src/app/(onboarding)/signup/actions.ts` but elevates to a top-level `actions/` directory since competitor actions will be called from multiple UI contexts (dashboard, detail page, etc.).

**Example:**
```typescript
// Source: Next.js v16.1.5 docs (server actions, revalidatePath) + existing signup/actions.ts pattern
// src/app/actions/competitors/add.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import { normalizeHandle } from "@/lib/schemas/competitor";

export async function addCompetitor(handle: string) {
  // 1. Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 2. Validate and normalize handle
  const normalized = normalizeHandle(handle);
  if (!normalized || normalized.length < 2) {
    return { error: "Invalid TikTok handle" };
  }

  // 3. Check if user already tracks this handle (via RLS-gated query)
  const { data: existing } = await supabase
    .from("user_competitors")
    .select("id, competitor_id")
    .eq("competitor_id",
      // Subquery: find competitor_profiles.id by handle
      // Actually: need to join. Simpler approach below.
    );
  // Better: use service client to check competitor_profiles directly
  const serviceClient = createServiceClient();

  // 3a. Find or create shared competitor profile
  let { data: profile } = await serviceClient
    .from("competitor_profiles")
    .select("id")
    .eq("tiktok_handle", normalized)
    .single();

  if (!profile) {
    // Profile doesn't exist yet -- scrape to validate handle exists
    const scraper = createScrapingProvider();
    try {
      const profileData = await scraper.scrapeProfile(normalized);
      // ... insert profile and videos with service client
    } catch {
      return { error: "TikTok handle not found" };
    }
  }

  // 4. Insert junction row (user_competitors)
  // ... uses authenticated supabase client (RLS allows INSERT)

  // 5. Revalidate
  revalidatePath("/competitors");
  return { success: true };
}
```

### Pattern 2: Junction Table Deduplication in Add Flow

**What:** The add-competitor flow is a multi-step operation that works with the shared profile model from Phase 1.

**When to use:** Every time a user adds a competitor.

**Why:** The Phase 1 schema uses globally shared `competitor_profiles` with a `user_competitors` junction table. When User A adds @charlidamelio and the profile already exists (User B added it earlier), we skip the scrape and just create the junction row. This is the deduplication benefit -- no duplicate Apify calls.

**Flow:**
```
User pastes @handle
    |
    v
1. normalizeHandle(input) -- strip @, lowercase, URL extraction
    |
    v
2. Service client: SELECT from competitor_profiles WHERE tiktok_handle = normalized
    |
    +-- EXISTS: Profile already scraped
    |     |
    |     v
    |   3a. Auth client: INSERT user_competitors (user_id, competitor_id)
    |     |
    |     +-- UNIQUE violation (23505)? -> "Already tracking this competitor"
    |     +-- Success -> revalidatePath, return
    |
    +-- NOT EXISTS: Need to validate handle and scrape
          |
          v
        3b. scrapeProfile(normalized) via ScrapingProvider
          |
          +-- Throws? -> "Handle not found on TikTok"
          +-- Returns ProfileData ->
                |
                v
              4. Service client: INSERT competitor_profiles (upsert on tiktok_handle)
                |
                v
              5. Service client: INSERT competitor_snapshots (initial snapshot)
                |
                v
              6. scrapeVideos(normalized) via ScrapingProvider
                |
                v
              7. Service client: UPSERT competitor_videos (batch)
                |
                v
              8. Auth client: INSERT user_competitors
                |
                v
              9. revalidatePath("/competitors")
```

**Critical detail:** Step 3b-7 use the **service client** (bypasses RLS) because `competitor_profiles`, `competitor_snapshots`, and `competitor_videos` don't have INSERT policies for authenticated users (by design -- writes are service-role only except for `user_competitors`). Step 8 uses the **authenticated client** because `user_competitors` has an INSERT policy requiring `user_id = auth.uid()`.

**Wait -- there IS an INSERT policy on competitor_profiles:** The Phase 1 migration includes `"Authenticated users can create competitor profiles" ON competitor_profiles FOR INSERT TO authenticated WITH CHECK (true)`. So the auth client CAN insert profiles. But snapshots and videos have no INSERT policy -- those are service-role only. For consistency and to avoid splitting the transaction across two clients, use the service client for all data writes (profile + snapshot + videos) and the auth client only for the junction row.

### Pattern 3: Cron Route with Batch Re-scraping

**What:** A Vercel cron-triggered GET route that re-scrapes all tracked competitors.

**When to use:** Once daily (configurable to 12h on Pro plan).

**Why:** Fulfills DATA-06 and GROW-06. Fresh follower/engagement snapshots enable the time-series charts in Phase 4.

**Example:**
```typescript
// Source: Backend-foundation pattern (scrape-trending/route.ts) + Vercel Cron docs
// src/app/api/cron/refresh-competitors/route.ts

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const scraper = createScrapingProvider();

  // Get all unique handles that need refreshing
  const { data: profiles } = await supabase
    .from("competitor_profiles")
    .select("id, tiktok_handle")
    .in("scrape_status", ["pending", "success", "failed"]);

  let refreshed = 0;
  let failed = 0;

  for (const profile of profiles ?? []) {
    try {
      // Scrape fresh profile data
      const profileData = await scraper.scrapeProfile(profile.tiktok_handle);

      // Update profile with latest metrics
      await supabase
        .from("competitor_profiles")
        .update({
          display_name: profileData.displayName,
          follower_count: profileData.followerCount,
          // ... other fields
          last_scraped_at: new Date().toISOString(),
          scrape_status: "success",
        })
        .eq("id", profile.id);

      // Insert daily snapshot (UNIQUE constraint deduplicates)
      await supabase
        .from("competitor_snapshots")
        .upsert({
          competitor_id: profile.id,
          follower_count: profileData.followerCount,
          // ... other fields
          snapshot_date: new Date().toISOString().split("T")[0],
        }, { onConflict: "competitor_id,snapshot_date" });

      refreshed++;
    } catch (error) {
      console.error(`[refresh-competitors] Failed for ${profile.tiktok_handle}:`, error);
      await supabase
        .from("competitor_profiles")
        .update({ scrape_status: "failed" })
        .eq("id", profile.id);
      failed++;
      // Continue to next handle -- don't block batch (Success Criteria #4)
    }
  }

  return NextResponse.json({ refreshed, failed, total: profiles?.length ?? 0 });
}
```

### Pattern 4: Cron Auth Utility

**What:** Shared utility to verify the `CRON_SECRET` Bearer token on cron endpoints.

**When to use:** Every cron route handler, as the first check.

**Why:** Prevents unauthorized access to cron endpoints. The backend-foundation already has this exact utility at `src/lib/cron-auth.ts`. Since backend-foundation hasn't been merged into this worktree, we create our own copy.

**Example:**
```typescript
// Source: Backend-foundation src/lib/cron-auth.ts (verified) + Vercel Cron docs (Context7)
// src/lib/cron-auth.ts

import { NextResponse } from "next/server";

export function verifyCronAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
```

### Pattern 5: Vercel Cron Configuration

**What:** `vercel.json` at project root with cron schedule entries.

**When to use:** For any scheduled background job.

**Why:** Vercel Cron is the established pattern (backend-foundation uses it for 5 cron jobs). Configuration is declarative in `vercel.json`.

**Example:**
```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-competitors",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Schedule note:** `0 6 * * *` = daily at 6:00 AM UTC. On Vercel Pro plan, can change to `0 */12 * * *` (every 12 hours) for more frequent updates. The Hobby plan limits to daily schedules only.

### Anti-Patterns to Avoid

- **Importing `apify-client` directly in server actions:** Use `createScrapingProvider()` factory from Phase 1's barrel export. The lazy `require()` in the factory prevents pulling `apify-client` into client bundles. Never `import { ApifyClient } from "apify-client"` in action files.

- **Deleting the shared `competitor_profiles` row when a user removes a competitor:** Only delete the `user_competitors` junction row. The profile may be tracked by other users. If no users track a profile anymore, it becomes orphaned but harmless. A future cleanup cron can handle orphaned profiles.

- **Using the authenticated client for snapshot/video writes:** The Phase 1 schema has no INSERT policies on `competitor_snapshots` or `competitor_videos` for authenticated users. Writes to these tables MUST use the service role client.

- **Awaiting video scraping in the add-competitor flow:** Profile scraping is fast (2-10s) and validates the handle exists. Video scraping is slower (10-30s for 30 videos). The add flow should scrape the profile synchronously (validates handle, gets initial metrics) but can defer video scraping to background or skip it entirely (the daily cron will pick it up). This keeps the add-competitor response time under 15s.

- **Querying `competitor_profiles` with the auth client for the add flow:** The auth client can only SELECT profiles the user already tracks (RLS policy: `id IN (SELECT competitor_id FROM user_competitors ...)`). When adding a new competitor, the user does NOT yet have a junction row, so the RLS policy will return nothing even if the profile exists. Use the service client to check for existing profiles.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Handle validation (exists on TikTok) | Manual HTTP check to tiktok.com | `scrapeProfile()` from ScrapingProvider | Apify handles TikTok's anti-bot. If scrape returns data, handle exists. If it throws, handle doesn't exist |
| Handle normalization | Custom regex per input format | `normalizeHandle()` from `src/lib/schemas/competitor.ts` | Phase 1 already built this with URL extraction, @ stripping, lowercase |
| Cron endpoint auth | Custom middleware or token check | `verifyCronAuth()` utility | One-line check, matches backend-foundation pattern exactly |
| Duplicate tracking prevention | Application-level check-then-insert | PostgreSQL UNIQUE constraint on `user_competitors(user_id, competitor_id)` | Database-level uniqueness prevents race conditions. Catch error code `23505` |
| Daily snapshot deduplication | Application-level date check | `UPSERT` with `onConflict: "competitor_id,snapshot_date"` | Phase 1's UNIQUE constraint on `competitor_snapshots(competitor_id, snapshot_date)` handles this at DB level |
| Service role client | Inline `createClient` with env vars | `createServiceClient()` from `src/lib/supabase/service.ts` | Phase 1 already built this. Centralized, typed, session-less |

**Key insight:** Phase 1 built all the foundation utilities this phase needs. The research reveals zero new dependencies or utilities to create from scratch. The work is pure orchestration -- wiring existing pieces (ScrapingProvider, normalizeHandle, createServiceClient, Zod schemas) into server actions and a cron route.

## Common Pitfalls

### Pitfall 1: RLS Blindspot in Add-Competitor Flow

**What goes wrong:** Server action uses the authenticated Supabase client to check if a `competitor_profiles` row exists for a handle. But the user has no junction row yet, so RLS's SELECT policy returns nothing even though the profile exists (another user added it). The action then creates a duplicate profile, violating the UNIQUE constraint on `tiktok_handle`.

**Why it happens:** The RLS policy on `competitor_profiles` is `id IN (SELECT competitor_id FROM user_competitors WHERE user_id = auth.uid())`. New users who haven't yet linked to this competitor can't see its profile row through the auth client.

**How to avoid:** Use the **service client** (bypasses RLS) to check for existing profiles. The service client can see all `competitor_profiles` rows regardless of who tracks them. Then use the auth client only for the `user_competitors` INSERT (which has its own RLS policy).

**Warning signs:** `UNIQUE constraint violation on tiktok_handle` errors when multiple users try to add the same competitor.

### Pitfall 2: Vercel Function Timeout During Batch Scraping

**What goes wrong:** The cron route scrapes all tracked competitors sequentially. With 30+ competitors, each taking 5-10s, the total execution exceeds Vercel's function timeout (10s Hobby, 60s Pro, 300s Pro with `maxDuration`).

**Why it happens:** Synchronous `.call()` on Apify blocks until each actor completes. Sequential processing multiplies the latency.

**How to avoid:** Three-tier defense:
1. **Deduplicate handles first:** Multiple users tracking the same creator should only trigger one scrape. Query `SELECT DISTINCT tiktok_handle FROM competitor_profiles` before scraping.
2. **Set `maxDuration` in the route config:** Export `export const maxDuration = 300` (5 minutes, requires Vercel Pro). This gives headroom for up to ~30 unique handles at 10s each.
3. **If still exceeding timeout:** Switch to the async `.start()` + webhook pattern from backend-foundation, where the cron route fires off a single Apify actor run with all handles as input, and a webhook handler processes results when the actor completes.

**Warning signs:** Cron route returning 504 Gateway Timeout. Vercel function logs showing incomplete batches.

### Pitfall 3: Race Condition on Profile Creation

**What goes wrong:** Two users simultaneously add the same new handle. Both check that the profile doesn't exist, both attempt to INSERT, one succeeds and one hits the UNIQUE constraint error.

**Why it happens:** TOCTOU (time-of-check-time-of-use) race between the existence check and the INSERT.

**How to avoid:** Use PostgreSQL `ON CONFLICT` (upsert) for the profile INSERT. If the profile already exists, the upsert becomes an UPDATE (or no-op with `ON CONFLICT DO NOTHING`). Then proceed to insert the junction row. The database handles the race condition atomically.

```typescript
// Service client: upsert profile (handles race condition)
const { data: profile } = await serviceClient
  .from("competitor_profiles")
  .upsert(
    { tiktok_handle: normalized, display_name: profileData.displayName, ... },
    { onConflict: "tiktok_handle" }
  )
  .select("id")
  .single();
```

**Warning signs:** Intermittent `23505` errors during high-concurrency competitor additions.

### Pitfall 4: Forgetting to Revalidate After Cron Scrape

**What goes wrong:** Cron route updates profiles and snapshots in the database, but the competitors page still shows stale data until the user refreshes their browser.

**Why it happens:** Next.js caches server component renders. Without `revalidatePath`, the cache persists until the next deployment or manual revalidation.

**How to avoid:** Call `revalidatePath("/competitors")` at the end of the cron route after all updates complete. Note: `revalidatePath` in a Route Handler (not a server action) requires importing from `next/cache` and works the same way.

**Warning signs:** Users seeing yesterday's data even after the cron ran successfully.

### Pitfall 5: Scraping Failure Blocking Entire Batch

**What goes wrong:** One invalid handle (e.g., a deleted TikTok account) throws an unhandled error in the cron loop, crashing the entire batch and leaving subsequent competitors unrefreshed.

**Why it happens:** No try-catch around individual scraping calls within the batch loop.

**How to avoid:** Wrap each competitor's scrape-update cycle in a try-catch. On failure, log the error, set `scrape_status = 'failed'` on that profile, and continue to the next handle. This is explicitly required by Success Criteria #4.

**Warning signs:** Cron route completing with `failed > 0` but `refreshed` counts not matching expected totals.

## Code Examples

Verified patterns from official sources and existing codebase:

### Server Action with Supabase Auth Check

```typescript
// Source: Next.js v16.1.5 docs (server actions) + existing signup/actions.ts pattern
// src/app/actions/competitors/add.ts

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import { normalizeHandle } from "@/lib/schemas/competitor";
import type { ProfileData } from "@/lib/scraping";

interface ActionResult {
  error?: string;
  data?: { competitorId: string; handle: string };
}

export async function addCompetitor(handle: string): Promise<ActionResult> {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Normalize
  const normalized = normalizeHandle(handle);
  if (!normalized || normalized.length < 2) {
    return { error: "Invalid TikTok handle" };
  }

  const serviceClient = createServiceClient();

  // Check if profile already exists (service client bypasses RLS)
  let { data: profile } = await serviceClient
    .from("competitor_profiles")
    .select("id, scrape_status")
    .eq("tiktok_handle", normalized)
    .single();

  // If no existing profile, validate handle via scraping
  if (!profile) {
    const scraper = createScrapingProvider();
    let profileData: ProfileData;

    try {
      profileData = await scraper.scrapeProfile(normalized);
    } catch {
      return { error: "TikTok handle not found or could not be scraped" };
    }

    // Insert new shared profile (upsert handles race condition)
    const { data: newProfile, error: profileError } = await serviceClient
      .from("competitor_profiles")
      .upsert({
        tiktok_handle: normalized,
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
      }, { onConflict: "tiktok_handle" })
      .select("id")
      .single();

    if (profileError || !newProfile) {
      return { error: "Failed to create competitor profile" };
    }

    profile = newProfile;

    // Insert initial snapshot
    await serviceClient
      .from("competitor_snapshots")
      .upsert({
        competitor_id: profile.id,
        follower_count: profileData.followerCount,
        following_count: profileData.followingCount,
        heart_count: profileData.heartCount,
        video_count: profileData.videoCount,
        snapshot_date: new Date().toISOString().split("T")[0],
      }, { onConflict: "competitor_id,snapshot_date" });

    // Scrape and insert videos (deferred or inline)
    try {
      const videos = await scraper.scrapeVideos(normalized);
      if (videos.length > 0) {
        await serviceClient
          .from("competitor_videos")
          .upsert(
            videos.map(v => ({
              competitor_id: profile!.id,
              platform_video_id: v.platformVideoId,
              video_url: v.videoUrl,
              caption: v.caption,
              views: v.views,
              likes: v.likes,
              comments: v.comments,
              shares: v.shares,
              saves: v.saves,
              hashtags: v.hashtags,
              duration_seconds: v.durationSeconds,
              posted_at: v.postedAt.toISOString(),
            })),
            { onConflict: "competitor_id,platform_video_id" }
          );
      }
    } catch (err) {
      // Video scraping failure is non-fatal -- profile is still added
      console.warn("[addCompetitor] Video scraping failed:", err);
    }
  }

  // Insert junction row (auth client -- RLS enforces user_id)
  const { error: linkError } = await supabase
    .from("user_competitors")
    .insert({
      user_id: user.id,
      competitor_id: profile.id,
    });

  if (linkError) {
    if (linkError.code === "23505") {
      return { error: "You are already tracking this competitor" };
    }
    return { error: "Failed to track competitor" };
  }

  revalidatePath("/competitors");
  return { data: { competitorId: profile.id, handle: normalized } };
}
```

### Remove Competitor Server Action

```typescript
// Source: Next.js v16.1.5 docs + Phase 1 schema (user_competitors DELETE policy)
// src/app/actions/competitors/remove.ts

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function removeCompetitor(competitorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Delete only the junction row (RLS ensures user can only delete own links)
  const { error } = await supabase
    .from("user_competitors")
    .delete()
    .eq("user_id", user.id)
    .eq("competitor_id", competitorId);

  if (error) return { error: "Failed to remove competitor" };

  revalidatePath("/competitors");
  return { success: true };
}
```

### Cron Route with Per-Handle Error Isolation

```typescript
// Source: Backend-foundation scrape-trending/route.ts + Vercel Cron docs (Context7)
// src/app/api/cron/refresh-competitors/route.ts

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";

// Allow up to 5 minutes for batch processing (Vercel Pro required)
export const maxDuration = 300;

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const scraper = createScrapingProvider();

  // Get distinct handles to scrape (deduplication -- scrape once per handle)
  const { data: profiles } = await supabase
    .from("competitor_profiles")
    .select("id, tiktok_handle");

  if (!profiles?.length) {
    return NextResponse.json({ refreshed: 0, failed: 0, total: 0 });
  }

  // Deduplicate: group profiles by handle (multiple users may track same handle)
  const handleMap = new Map<string, string[]>();
  for (const p of profiles) {
    const existing = handleMap.get(p.tiktok_handle) ?? [];
    existing.push(p.id);
    handleMap.set(p.tiktok_handle, existing);
  }

  let refreshed = 0;
  let failed = 0;

  for (const [handle, profileIds] of handleMap) {
    try {
      const profileData = await scraper.scrapeProfile(handle);

      // Update ALL profile rows for this handle
      await supabase
        .from("competitor_profiles")
        .update({
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
        })
        .in("id", profileIds);

      // Insert snapshot for each profile row (one per profile per day)
      const today = new Date().toISOString().split("T")[0];
      for (const profileId of profileIds) {
        await supabase
          .from("competitor_snapshots")
          .upsert({
            competitor_id: profileId,
            follower_count: profileData.followerCount,
            following_count: profileData.followingCount,
            heart_count: profileData.heartCount,
            video_count: profileData.videoCount,
            snapshot_date: today,
          }, { onConflict: "competitor_id,snapshot_date" });
      }

      refreshed++;
    } catch (error) {
      console.error(`[refresh-competitors] Failed for ${handle}:`, error);
      // Mark all profiles for this handle as failed
      await supabase
        .from("competitor_profiles")
        .update({ scrape_status: "failed" })
        .in("id", profileIds);
      failed++;
      // Continue to next handle -- DO NOT break (Success Criteria #4)
    }
  }

  // Revalidate competitors page cache
  revalidatePath("/competitors");

  return NextResponse.json({
    refreshed,
    failed,
    total: handleMap.size,
    profiles: profiles.length,
  });
}
```

### vercel.json Cron Configuration

```json
// Source: Vercel Cron docs (Context7: /llmstxt/vercel_llms_txt)
// vercel.json (project root)
{
  "crons": [
    {
      "path": "/api/cron/refresh-competitors",
      "schedule": "0 6 * * *"
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API routes for all mutations | Server actions with `revalidatePath` | Next.js 14+ (stable in 15+) | Server actions eliminate manual fetch calls, integrate with React forms via `useActionState`, auto-handle CSRF |
| `unstable_cacheTag` / `unstable_cacheLife` | `revalidatePath` (stable) | Next.js 15+ | `revalidatePath` is the stable API for on-demand cache invalidation. Tag-based revalidation still experimental |
| Manual Bearer token check in each cron route | Shared `verifyCronAuth()` utility | Established in backend-foundation | DRY -- one utility, all cron routes |
| Apify `.call()` everywhere | `.call()` for small batches, `.start()` + webhook for large | Serverless adoption | `.call()` blocks the function. Acceptable for <30s jobs. Switch to async for longer operations |

**Deprecated/outdated:**
- **`useFormState`**: Renamed to `useActionState` in React 19. The project uses React 19.2.3, so always use `useActionState`.
- **`revalidateTag`**: Still experimental/unstable in Next.js 16.1.5. Use `revalidatePath` instead.

## Open Questions

1. **Video scraping in add-competitor flow: inline or deferred?**
   - What we know: Profile scraping takes 2-10s (validates handle, gets metrics). Video scraping takes 10-30s for 30 videos. Together, the add flow could take 15-40s.
   - What's unclear: Is 15-40s acceptable for the add-competitor UX, or should video scraping be deferred?
   - Recommendation: Scrape profile synchronously (validates handle, populates initial metrics for the card). Attempt video scraping but with a short timeout -- if it completes within 15s, include it. If not, the daily cron will fill in videos. This gives a responsive add flow while still getting initial video data when Apify is fast.

2. **Snapshot deduplication across shared profiles**
   - What we know: The junction table model means each `competitor_profiles` row has its own `competitor_snapshots`. If two users track @charlidamelio, there are two profile rows, and the cron creates two snapshot rows with identical data.
   - What's unclear: Whether this duplication is acceptable or whether snapshots should be per-handle (not per-profile-row).
   - Recommendation: Accept the duplication for v1. At 365 rows/year per profile, even 1000 duplicate profiles = 365K extra rows/year -- trivial for PostgreSQL. Deduplicating snapshots would require restructuring the schema (shared snapshot table with a different FK) which is out of scope.

3. **Vercel plan tier confirmation**
   - What we know: `maxDuration = 300` and sub-daily cron schedules require Vercel Pro plan.
   - What's unclear: Whether this project is on Vercel Pro or Hobby.
   - Recommendation: Design for daily cron (works on any plan). Set `maxDuration = 60` as a safe default. Document that Pro plan enables `maxDuration = 300` and `0 */12 * * *` schedule.

4. **What happens to orphaned profiles after removal?**
   - What we know: Removing a competitor deletes only the junction row. If no users track a profile, it remains in `competitor_profiles` with snapshots and videos.
   - What's unclear: Should orphaned profiles be cleaned up?
   - Recommendation: Leave orphaned profiles for now. They don't affect queries (RLS hides them from all users). Add a cleanup cron in Phase 7 (Polish) if storage becomes a concern.

## Sources

### Primary (HIGH confidence)
- Next.js v16.1.5 docs (Context7: /vercel/next.js/v16.1.5) - Server actions, revalidatePath, route handlers, error handling patterns
- Vercel docs (Context7: /llmstxt/vercel_llms_txt) - Cron job configuration, CRON_SECRET security, vercel.json format
- Existing codebase: `src/app/(onboarding)/signup/actions.ts` - Server action pattern with Supabase auth
- Existing codebase: `src/lib/supabase/service.ts` (Phase 1) - Service role client factory
- Existing codebase: `src/lib/scraping/` (Phase 1) - ScrapingProvider interface, ApifyScrapingProvider, createScrapingProvider factory
- Existing codebase: `src/lib/schemas/competitor.ts` (Phase 1) - normalizeHandle, Zod schemas
- Existing codebase: `supabase/migrations/20260216100000_competitor_tables.sql` (Phase 1) - Schema, RLS policies, constraints
- Backend-foundation: `src/app/api/cron/scrape-trending/route.ts` - Cron route pattern with verifyCronAuth
- Backend-foundation: `src/app/api/webhooks/apify/route.ts` - Webhook handler pattern, batch upsert
- Backend-foundation: `src/lib/cron-auth.ts` - CRON_SECRET verification utility
- Backend-foundation: `vercel.json` - Cron schedule configuration format

### Secondary (MEDIUM confidence)
- Phase 1 RESEARCH.md - Apify actor field names, provider abstraction rationale, RLS performance notes
- Milestone ARCHITECTURE.md - Data flow patterns, component boundaries, scheduling rationale

### Tertiary (LOW confidence)
- Apify actor response timing (2-10s for profile, 10-30s for videos) - Based on WebSearch estimates, not benchmarked against running actors. Actual timing may vary by handle popularity and Apify load.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies. All libraries already installed from Phase 1 or project setup.
- Architecture: HIGH - Server actions follow existing `signup/actions.ts` pattern. Cron route follows backend-foundation `scrape-trending/route.ts` pattern. All Supabase operations use Phase 1's schema and utilities.
- Pitfalls: HIGH - RLS blindspot in add flow (verified against actual migration RLS policies). Timeout risk in cron batch (verified against Vercel function limits). Race condition handling (verified with PostgreSQL ON CONFLICT). Error isolation (explicit Success Criteria #4).
- Apify timing: MEDIUM - Response times are estimates. Zod validation at ingestion boundary mitigates schema drift risk.

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- stable domain, Next.js server actions are stable, Vercel Cron is stable)
