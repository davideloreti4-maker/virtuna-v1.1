---
phase: 1
plan: C
title: Cron stub + Apify scrape primitives (apify-jobs, normalize-scrape)
status: pending
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/cron/refresh-corpus/route.ts
  - vercel.json
  - src/lib/engine/corpus/apify-jobs.ts
  - src/lib/engine/corpus/normalize-scrape.ts
  - src/lib/engine/corpus/follower-tier.ts
  - src/lib/engine/corpus/__tests__/apify-jobs.test.ts
  - src/lib/engine/corpus/__tests__/normalize-scrape.test.ts
  - src/lib/engine/corpus/__tests__/follower-tier.test.ts
autonomous: true
requirements: [CORPUS-02, CORPUS-04, CORPUS-07]
must_haves:
  truths:
    - "GET /api/cron/refresh-corpus exists, requires cron auth, returns 200 with stubbed status when authorized"
    - "vercel.json registers refresh-corpus at the monthly schedule (matches 30-day cadence intent)"
    - "buildApifyJobs(niche, isPilot) returns the three named scrape configs per niche (trending/average/under) for D-06"
    - "normalizeScrapedItem(item, niche, corpus_version, scrapeKind) handles both clockworks and apidojo TikTok output formats and produces a deterministic normalized row; scrape_kind (W6) is propagated onto NormalizedCorpusRow so the orchestrator can encode it as bucket_target"
    - "Age filter at scrape time uses newestPostDate = today - 7d (Pitfall 1)"
    - "getFollowerTier() classifies follower_count into nano/micro/mid/large/mega"
  artifacts:
    - path: src/app/api/cron/refresh-corpus/route.ts
      provides: "Cron stub for 30-day corpus refresh (CORPUS-02; full mechanism in Phase 11/12)"
      contains: "verifyCronAuth"
    - path: vercel.json
      provides: "refresh-corpus cron registration"
      contains: "/api/cron/refresh-corpus"
    - path: src/lib/engine/corpus/apify-jobs.ts
      provides: "buildApifyJobs(niche, isPilot) → { trending, average, under } config tuple"
      contains: "buildApifyJobs"
    - path: src/lib/engine/corpus/normalize-scrape.ts
      provides: "normalizeScrapedItem(item, niche, corpus_version, scrapeKind) → typed normalized row OR null (W6 — scrape_kind propagation)"
      contains: "normalizeScrapedItem"
    - path: src/lib/engine/corpus/follower-tier.ts
      provides: "getFollowerTier(count) → 'nano'|'micro'|'mid'|'large'|'mega'|null"
      contains: "getFollowerTier"
  key_links:
    - from: src/app/api/cron/refresh-corpus/route.ts
      to: src/lib/cron-auth.ts
      via: "verifyCronAuth(request) — pattern matches every existing cron route"
      pattern: "verifyCronAuth"
    - from: src/lib/engine/corpus/normalize-scrape.ts
      to: src/lib/schemas/competitor.ts
      via: "apifyVideoSchema reuse for clockworks format validation (Zod safeParse + skip-on-fail)"
      pattern: "apifyVideoSchema"
    - from: src/lib/engine/corpus/normalize-scrape.ts
      to: scripts/extract-training-data.ts
      via: "Reuse follower-tier classification logic (extract into shared module)"
      pattern: "getFollowerTier"
---

<objective>
Build three independent infra pieces that all downstream plans depend on but that have zero dependency on each other (or on Plans A/B):

1. **Cron stub for 30-day refresh** (CORPUS-02) — `/api/cron/refresh-corpus` route + `vercel.json` registration. Full mechanism is deferred to Phase 11/12 (per CONTEXT line 15); Phase 1 only needs the route to exist with cron auth and the schedule registered.
2. **Apify scrape job configs** (CORPUS-07) — `buildApifyJobs(niche, isPilot)` returns the three named scrape configs per niche (5 niches × 3 configs = 15 jobs per D-06). Pure config builder; no Apify calls in this plan.
3. **Scrape item normalizer** (CORPUS-04) — `normalizeScrapedItem` handles both `clockworks/tiktok-scraper` and `apidojo/tiktok-scraper-api` output shapes and produces a deterministic normalized row. Plus the `follower_tier` classifier extracted from `scripts/extract-training-data.ts`.

All three are pure-function or pure-route work, independent of the schema (Plan A) and metrics (Plan B). Wave 1 parallel with A and B.

Purpose: Provides the scrape primitives that Plan D's orchestrator composes.
Output: One cron route + 3 corpus module files + their tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md
@.planning/phases/01-training-corpus-eval-foundation/01-RESEARCH.md
@.planning/phases/01-training-corpus-eval-foundation/01-PATTERNS.md
@src/lib/cron-auth.ts
@src/lib/logger.ts
@src/app/api/cron/refresh-competitors/route.ts
@src/app/api/cron/scrape-trending/route.ts
@src/app/api/cron/calibration-audit/route.ts
@src/lib/schemas/competitor.ts
@scripts/extract-training-data.ts
@scripts/import-apify-data.ts
@vercel.json

<interfaces>
<!-- From src/lib/cron-auth.ts:9-18 -->
- `verifyCronAuth(request: Request) → NextResponse | null` — returns NextResponse (401) on auth failure, null on success. Pattern: `const authError = verifyCronAuth(request); if (authError) return authError;`

<!-- From src/lib/logger.ts:63 -->
- `createLogger({ module: string }) → Logger` — JSON in prod, pretty in dev

<!-- From src/lib/schemas/competitor.ts:31-69 (REUSE — do not redefine) -->
- `apifyVideoSchema` — Zod schema for clockworks output
- `apifyProfileSchema` — Zod schema for profile-scraper output
- `normalizeHandle(raw: string) → string` — handle normalization (lines 10-20)

<!-- From scripts/extract-training-data.ts:68-75 -->
- Existing follower-tier classification logic (extract into the new shared module)

<!-- Existing crons at the same pattern (refresh-competitors/route.ts is the closest analog) -->
From src/app/api/cron/calibration-audit/route.ts:
```typescript
export const maxDuration = 60;
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;
  // ... try/catch with log.error + 500 response on failure
}
```

<!-- Existing vercel.json crons array (entries are objects with path + schedule) -->
From vercel.json lines 1-31: 7 existing crons, monthly cadence example:
`{ "path": "/api/cron/calibration-audit", "schedule": "0 4 1 * *" }`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Refresh-corpus cron stub + vercel.json registration</name>
  <files>src/app/api/cron/refresh-corpus/route.ts, vercel.json</files>
  <behavior>
- `GET /api/cron/refresh-corpus` without auth → 401 (verifyCronAuth returns error response)
- `GET /api/cron/refresh-corpus` with valid `CRON_SECRET` Bearer auth → 200 with body `{ status: "stubbed", message: <Phase 11/12 note> }`
- `vercel.json` `crons` array gets one new entry pointing at `/api/cron/refresh-corpus` with schedule `0 6 1 * *` (monthly 1st, 6 AM UTC — matches D-12 30-day cadence intent and aligns with the calibration-audit precedent)
  </behavior>
  <action>
**src/app/api/cron/refresh-corpus/route.ts** — per PATTERNS §9 concrete skeleton:

```typescript
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/refresh-corpus" });

export const maxDuration = 60;

/**
 * GET /api/cron/refresh-corpus
 *
 * D-12 / CORPUS-02: 30-day rolling corpus refresh.
 *
 * STUB ONLY in Phase 1. CONTEXT line 15 explicitly defers the full mechanism
 * to Phase 11/12 (operational concern). Phase 1 only needs:
 *   1. Route exists with cron-auth guard
 *   2. vercel.json registers the schedule
 *   3. Returns 200 to confirm the schedule fires successfully
 *
 * When Phase 11/12 lands, this stub is replaced with the actual scrape trigger
 * that creates a new `full.YYYY-MM-DD` corpus_version and runs the orchestrator.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    log.info("Refresh-corpus stub invoked (no-op until Phase 11/12)");
    return NextResponse.json({
      status: "stubbed",
      message: "Phase 1 stub; full 30-day refresh implemented in Phase 11/12",
      next_steps: "See .planning/ROADMAP.md Phase 11/12",
    });
  } catch (error) {
    log.error("Failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**vercel.json** — append one entry to the `crons` array (preserve all existing entries unchanged):

```json
{
  "path": "/api/cron/refresh-corpus",
  "schedule": "0 6 1 * *"
}
```

The cron fires on the 1st of each month at 6 AM UTC. Monthly cadence approximates the 30-day rolling refresh and aligns with the calibration-audit precedent.

CRITICAL: DO NOT change any existing cron entries in `vercel.json`. Use Edit with the existing file as context — insert the new entry into the `crons` array.

CRITICAL: DO NOT call `revalidatePath()` — corpus isn't user-facing (per PATTERNS §9 pitfall).
  </action>
  <verify>
    <automated>test -f src/app/api/cron/refresh-corpus/route.ts && grep -q "verifyCronAuth" src/app/api/cron/refresh-corpus/route.ts && grep -q "/api/cron/refresh-corpus" vercel.json && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))" && grep -q "stubbed" src/app/api/cron/refresh-corpus/route.ts</automated>
  </verify>
  <done>Route file exists with cron auth + stub response. vercel.json is valid JSON and contains the new cron entry. No existing entries removed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Apify scrape job configs (apify-jobs.ts) and follower-tier helper</name>
  <files>src/lib/engine/corpus/apify-jobs.ts, src/lib/engine/corpus/follower-tier.ts, src/lib/engine/corpus/__tests__/apify-jobs.test.ts, src/lib/engine/corpus/__tests__/follower-tier.test.ts</files>
  <behavior>
- `buildApifyJobs("beauty", true)` returns an object with keys `trending`, `average`, `under`, each with `actorId`, `input`, `expectedItems` fields
- `trending` config uses `TRENDING_FEED_HASHTAGS["beauty"]` (high-traffic tags)
- `average` and `under` configs use `NICHE_HASHTAGS["beauty"]` (niche-specific tags)
- All three configs set `newestPostDate` to ~7 days ago (D-04 / Pitfall 1)
- All three configs set `oldestPostDate` to ~90 days ago (sanity bound)
- All three configs set `excludePinnedPosts: true`
- `isPilot=true` produces ~5× smaller `resultsPerPage` than `isPilot=false`
- All 5 niches (beauty, fitness, edu, comedy, lifestyle) produce non-empty hashtag lists
- `getFollowerTier(500)` → "nano"; `getFollowerTier(50_000)` → "micro"; `getFollowerTier(500_000)` → "mid"; `getFollowerTier(2_000_000)` → "large"; `getFollowerTier(20_000_000)` → "mega"; `getFollowerTier(null)` / `getFollowerTier(undefined)` → null
  </behavior>
  <action>
**src/lib/engine/corpus/apify-jobs.ts** — per RESEARCH §A.1 concrete skeleton:

```typescript
import type { Niche } from "./eval-config";

export type ScrapeConfigKind = "trending" | "average" | "under";

export interface ApifyScrapeConfig {
  actorId: string;
  input: Record<string, unknown>;
  expectedItems: number;
}

/** Niche-specific hashtags (D-03; 4 per niche balances breadth/precision). */
const NICHE_HASHTAGS: Record<Niche, string[]> = {
  beauty:    ["beauty", "skincare", "makeup", "glowup"],
  fitness:   ["fitness", "gym", "workout", "gymtok"],
  edu:       ["learnontiktok", "education", "studytips", "edutok"],
  comedy:    ["comedy", "funny", "humor", "fyp"],
  lifestyle: ["lifestyle", "dayinmylife", "morningroutine", "aesthetic"],
};

/** High-traffic hashtags for viral candidate sourcing — D-02 trending strategy. */
const TRENDING_FEED_HASHTAGS: Record<Niche, string[]> = {
  beauty:    ["beauty", "fyp"],
  fitness:   ["fitness", "fyp"],
  edu:       ["learnontiktok", "fyp"],
  comedy:    ["comedy", "fyp"],
  lifestyle: ["lifestyle", "fyp"],
};

/** D-04: min video age = 7 days. Apify date helper. */
function daysAgoISO(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0]!;
}

const ACTOR_CLOCKWORKS_TIKTOK = "clockworks/tiktok-scraper";

/**
 * Build the three Apify configs per niche (D-06).
 * Pilot uses smaller resultsPerPage; full uses ~5x larger.
 *
 * IMPORTANT (Pitfall 1): `newestPostDate` is 7 days ago, not today.
 * This means "only videos uploaded ON OR BEFORE 7 days ago" — i.e., the
 * video has had ≥ 7 days to plateau (D-04).
 */
export function buildApifyJobs(
  niche: Niche,
  isPilot: boolean,
): Record<ScrapeConfigKind, ApifyScrapeConfig> {
  const sizeMultiplier = isPilot ? 1 : 5;
  const newestPostDate = daysAgoISO(7);     // D-04 age floor
  const oldestPostDate = daysAgoISO(90);    // sanity ceiling

  const baseInput = {
    newestPostDate,
    oldestPostDate,
    excludePinnedPosts: true,
  };

  return {
    trending: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        ...baseInput,
        hashtags: TRENDING_FEED_HASHTAGS[niche],
        resultsPerPage: 40 * sizeMultiplier,
      },
      expectedItems: isPilot ? 15 : 60,
    },
    average: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        ...baseInput,
        hashtags: NICHE_HASHTAGS[niche],
        resultsPerPage: 60 * sizeMultiplier,
      },
      expectedItems: isPilot ? 25 : 100,
    },
    under: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        ...baseInput,
        hashtags: NICHE_HASHTAGS[niche],
        resultsPerPage: 80 * sizeMultiplier,
        // Pitfall 2: no server-side ascending-by-views sort. Scrape broadly;
        // client-side filter (in orchestrator, Plan D) drops to ≤ underCeiling.
      },
      expectedItems: isPilot ? 25 : 100,
    },
  };
}

export function listNicheHashtags(niche: Niche): string[] {
  return [...NICHE_HASHTAGS[niche]];
}
```

**src/lib/engine/corpus/follower-tier.ts** — extracted from `scripts/extract-training-data.ts:68-75` for reuse:

```typescript
export type FollowerTier = "nano" | "micro" | "mid" | "large" | "mega";

/**
 * Classify a creator into a follower-count tier.
 * Aligned with industry-standard influencer tiers (1k/10k/100k/1M cutoffs).
 *
 * Returns null when count is missing/zero — clockworks profile-scraper does
 * not always populate followers (RESEARCH §A.3); downstream callers handle
 * NULL gracefully.
 */
export function getFollowerTier(
  count: number | null | undefined,
): FollowerTier | null {
  if (count === null || count === undefined || count <= 0) return null;
  if (count < 10_000) return "nano";
  if (count < 100_000) return "micro";
  if (count < 1_000_000) return "mid";
  if (count < 10_000_000) return "large";
  return "mega";
}
```

**Tests:**

`__tests__/apify-jobs.test.ts`:
- `buildApifyJobs("beauty", true)` returns object with keys `trending`, `average`, `under`
- Each config has `actorId === "clockworks/tiktok-scraper"`, `expectedItems > 0`, and `input.newestPostDate` matches /^\d{4}-\d{2}-\d{2}$/
- All 5 niches in NICHES const produce non-empty hashtag lists for both `trending` and `average`/`under` flavors
- Pilot vs full: full `resultsPerPage` is exactly 5× pilot
- Date filter sanity: parse `newestPostDate` and `oldestPostDate`, assert that `oldestPostDate` is older than `newestPostDate` and that `newestPostDate` is approximately 7 days before today (allow ± 1 day tolerance for timezone)

`__tests__/follower-tier.test.ts`:
- Table-driven: 0, 500, 5_000, 50_000, 500_000, 2_000_000, 20_000_000 → null, "nano", "nano", "micro", "mid", "large", "mega"
- null + undefined → null
- Negative count → null

Run tests after writing them.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/apify-jobs.test.ts src/lib/engine/corpus/__tests__/follower-tier.test.ts</automated>
  </verify>
  <done>Both test files pass. `buildApifyJobs` returns the documented shape for all 5 niches; getFollowerTier table matches spec.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Normalize Apify scrape items (both clockworks + apidojo formats)</name>
  <files>src/lib/engine/corpus/normalize-scrape.ts, src/lib/engine/corpus/__tests__/normalize-scrape.test.ts</files>
  <behavior>
- `normalizeScrapedItem(clockworksItem, "beauty", "pilot.2026-05-12", "trending")` returns a row with: `platform_video_id`, `video_url`, `creator_handle`, `views`, `likes`, `comments`, `shares`, `saves`, `posted_at` (Date), `duration_seconds`, `follower_count`, `follower_tier`, `caption`, `hashtags` (string[]), `niche`, `corpus_version`, `scrape_kind` (echoes the 4th argument — W6)
- `normalizeScrapedItem(apidojoItem, ...)` produces the IDENTICAL output shape from the apidojo format
- Items that fail Zod safeParse return `null` (skip-on-fail, never throw)
- Items with `views < 1` return `null` (CORPUS-08 quality validation rule 2 — but only the views check; engagement-zero check happens in orchestrator)
- Items with `posted_at` newer than 7 days ago return `null` (Pitfall 1 belt-and-suspenders date filter)
- `posted_at` is always a `Date` instance, even when input is Unix seconds (clockworks) or Unix ms (apidojo)
- `creator_handle` is normalized via `normalizeHandle` from schemas/competitor.ts
  </behavior>
  <action>
**src/lib/engine/corpus/normalize-scrape.ts** — per RESEARCH §A.3 enrichment matrix + PATTERNS §10:

```typescript
import { z } from "zod";
import { normalizeHandle, apifyVideoSchema } from "@/lib/schemas/competitor";
import { createLogger } from "@/lib/logger";
import { getFollowerTier, type FollowerTier } from "./follower-tier";
import type { Niche } from "./eval-config";
import type { ScrapeConfigKind } from "./apify-jobs";    // W6

const log = createLogger({ module: "corpus/normalize-scrape" });

export interface NormalizedCorpusRow {
  platform: "tiktok";
  platform_video_id: string;
  video_url: string | null;
  creator_handle: string | null;
  niche: Niche;
  corpus_version: string;
  scrape_kind: ScrapeConfigKind;          // W6: which ScrapeConfigKind produced this row; powers bucket_target

  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  duration_seconds: number | null;
  completion_pct: number | null;          // Always null — see KNOWN GAP in migration header

  follower_count: number | null;
  follower_tier: FollowerTier | null;

  caption: string | null;
  hashtags: string[];
  sound_name: string | null;
  posted_at: Date;
  scraped_at: Date;
}

/** apidojo-specific schema — built parallel to apifyVideoSchema (clockworks). */
const apidojoVideoSchema = z.object({
  id: z.string(),
  postPage: z.string().optional(),
  views: z.union([z.number(), z.string()]).optional(),
  likes: z.union([z.number(), z.string()]).optional(),
  comments: z.union([z.number(), z.string()]).optional(),
  shares: z.union([z.number(), z.string()]).optional(),
  bookmarks: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  uploadedAt: z.union([z.number(), z.string()]).optional(),
  channel: z
    .object({
      username: z.string().optional(),
      followers: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
  video: z
    .object({
      duration: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Normalize an Apify scrape item (clockworks OR apidojo format) into a
 * NormalizedCorpusRow. Returns null on parse failure or age-filter failure
 * (skip-on-fail pattern; never throws).
 *
 * Niche is set by the orchestrator from which buildApifyJobs(niche) produced
 * the call — NOT from the item itself.
 */
export function normalizeScrapedItem(
  item: unknown,
  niche: Niche,
  corpus_version: string,
  scrapeKind: ScrapeConfigKind,                                  // W6
): NormalizedCorpusRow | null {
  // Try clockworks first (project's primary actor per apify-provider.ts:9-10)
  const clockworks = apifyVideoSchema.safeParse(item);
  if (clockworks.success) {
    return normalizeClockworks(clockworks.data, niche, corpus_version, scrapeKind);
  }
  // Fallback: apidojo format
  const apidojo = apidojoVideoSchema.safeParse(item);
  if (apidojo.success) {
    return normalizeApidojo(apidojo.data, niche, corpus_version, scrapeKind);
  }
  log.debug("Item did not match any known Apify schema; skipping", {
    parseError: clockworks.error?.message,
  });
  return null;
}

function normalizeClockworks(
  item: z.infer<typeof apifyVideoSchema>,
  niche: Niche,
  corpus_version: string,
  scrape_kind: ScrapeConfigKind,
): NormalizedCorpusRow | null {
  // Map clockworks fields per RESEARCH §A.3 enrichment matrix
  const i = item as Record<string, unknown>;
  const id = String(i.id ?? "");
  if (!id) return null;

  const views = toNumber(i.playCount);
  if (views < 1) return null;             // CORPUS-08 quality rule

  const createTimeSec = toNumber((i as { createTime?: unknown }).createTime);
  const posted_at = new Date(createTimeSec * 1000);
  if (!isFinite(posted_at.getTime())) return null;
  if (Date.now() - posted_at.getTime() < SEVEN_DAYS_MS) return null; // Pitfall 1

  const authorMeta = (i as { authorMeta?: Record<string, unknown> }).authorMeta ?? {};
  const videoMeta = (i as { videoMeta?: Record<string, unknown> }).videoMeta ?? {};
  const hashtagItems = (i.hashtags as Array<{ name?: string }> | undefined) ?? [];
  const follower_count =
    toNullableNumber((authorMeta as { fans?: unknown }).fans);

  return {
    platform: "tiktok",
    platform_video_id: id,
    video_url: typeof i.webVideoUrl === "string" ? i.webVideoUrl : null,
    creator_handle: normalizeOrNull((authorMeta as { name?: unknown }).name),
    niche,
    corpus_version,
    scrape_kind,                          // W6
    views,
    likes: toNumber(i.diggCount),
    comments: toNumber(i.commentCount),
    shares: toNumber(i.shareCount),
    saves: toNumber(i.collectCount),
    duration_seconds: toNullableNumber(videoMeta.duration),
    completion_pct: null,                 // KNOWN GAP — not available from Apify
    follower_count,
    follower_tier: getFollowerTier(follower_count ?? undefined),
    caption: typeof i.text === "string" ? i.text : null,
    hashtags: hashtagItems
      .map((h) => (typeof h?.name === "string" ? h.name : null))
      .filter((s): s is string => s !== null),
    sound_name: typeof (i as { musicMeta?: { musicName?: unknown } }).musicMeta
      ?.musicName === "string"
      ? (i as { musicMeta: { musicName: string } }).musicMeta.musicName
      : null,
    posted_at,
    scraped_at: new Date(),
  };
}

function normalizeApidojo(
  item: z.infer<typeof apidojoVideoSchema>,
  niche: Niche,
  corpus_version: string,
  scrape_kind: ScrapeConfigKind,
): NormalizedCorpusRow | null {
  const id = item.id;
  if (!id) return null;

  const views = toNumber(item.views);
  if (views < 1) return null;

  const uploadedRaw = item.uploadedAt;
  // apidojo uses ms Unix per RESEARCH §A.3
  const uploadedMs =
    typeof uploadedRaw === "number" && uploadedRaw < 10_000_000_000
      ? uploadedRaw * 1000
      : toNumber(uploadedRaw);
  const posted_at = new Date(uploadedMs);
  if (!isFinite(posted_at.getTime())) return null;
  if (Date.now() - posted_at.getTime() < SEVEN_DAYS_MS) return null;

  const follower_count = toNullableNumber(item.channel?.followers);

  return {
    platform: "tiktok",
    platform_video_id: id,
    video_url: item.postPage ?? null,
    creator_handle: normalizeOrNull(item.channel?.username),
    niche,
    corpus_version,
    scrape_kind,                          // W6
    views,
    likes: toNumber(item.likes),
    comments: toNumber(item.comments),
    shares: toNumber(item.shares),
    saves: toNumber(item.bookmarks),
    duration_seconds: toNullableNumber(item.video?.duration),
    completion_pct: null,                 // KNOWN GAP — not available from Apify
    follower_count,
    follower_tier: getFollowerTier(follower_count ?? undefined),
    caption: item.title ?? null,
    hashtags: item.hashtags ?? [],
    sound_name: null,                     // apidojo doesn't expose sound name reliably
    posted_at,
    scraped_at: new Date(),
  };
}

function toNumber(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "string" && x.length > 0) {
    const n = Number(x);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function toNullableNumber(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = toNumber(x);
  return n > 0 ? n : null;
}

function normalizeOrNull(x: unknown): string | null {
  if (typeof x !== "string" || x.length === 0) return null;
  return normalizeHandle(x);
}
```

**Tests `__tests__/normalize-scrape.test.ts`:**

Build two fixture objects (one clockworks-shaped, one apidojo-shaped) with known values for the same logical TikTok video. Assert:
- Both return rows with identical `platform_video_id`, `views`, `niche`, `corpus_version`
- Both return `posted_at` as `Date` instance
- `completion_pct` is always null
- `creator_handle` is normalized (call `normalizeHandle` directly with `@DaviDe ` → `davide` and assert the normalizer output matches what normalizeScrapedItem produces)
- `follower_tier` is derived correctly when `follower_count` populated, null when missing
- An item with `views: 0` returns null
- An item with `createTime` within last 7 days returns null
- An item whose top-level shape matches neither schema returns null
- A clockworks item with no `authorMeta.fans` returns row with `follower_count: null`, `follower_tier: null`
- W6: passing `scrapeKind="trending"` puts `scrape_kind: "trending"` on the resulting row; passing `"under"` puts `"under"`. The same item normalized with two different `scrapeKind` values yields two rows whose `scrape_kind` differs but other fields are identical.

Run tests after writing them. If `apifyVideoSchema` from competitor.ts is shaped differently than expected, use Read on `src/lib/schemas/competitor.ts:52-69` to confirm field names before writing the test.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/normalize-scrape.test.ts</automated>
  </verify>
  <done>Tests pass for both clockworks and apidojo fixtures. Returns null on view=0, future date, and unknown schema. completion_pct is always null. follower_tier derived correctly.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| External request → cron route | HTTP request from Vercel cron infrastructure crosses into application code via the `GET` handler |
| Apify dataset items → normalize-scrape | Untrusted JSON from external Apify actor crosses into application code |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-C-01 | Spoofing | Unauthenticated request to /api/cron/refresh-corpus | mitigate | `verifyCronAuth(request)` Bearer token check (same idiom as 7 existing crons). Stub returns 200 only after auth passes. |
| T-01-C-02 | Tampering | Malformed Apify item with unexpected fields | mitigate | Zod `safeParse` against both clockworks and apidojo schemas; skip-on-fail (return null). No silent type coercion; explicit `toNumber`/`toNullableNumber` helpers. |
| T-01-C-03 | Tampering | Item with views=0 or future posted_at gaming the corpus | mitigate | normalize-scrape rejects views < 1 and posted_at within 7 days. CORPUS-08 validation also runs in orchestrator (Plan D) as belt-and-suspenders. |
| T-01-C-04 | Information disclosure | Logging full Apify item including any PII | accept | Items contain only public TikTok handles + public engagement counters. `log.debug` may emit parseError messages but no full payload. Structured logger (logger.ts) strips secrets by design. |
| T-01-C-05 | DoS | Cron stub holding open connections | mitigate | `maxDuration = 60` cap; stub returns immediately; no long-running work in Phase 1. |
</threat_model>

<verification>
- `src/app/api/cron/refresh-corpus/route.ts` exists with cron-auth guard
- `vercel.json` is valid JSON, contains the new cron entry, retains all 7 existing entries
- `npx vitest run src/lib/engine/corpus/__tests__/apify-jobs.test.ts src/lib/engine/corpus/__tests__/follower-tier.test.ts src/lib/engine/corpus/__tests__/normalize-scrape.test.ts` passes
- `npx tsc --noEmit` passes with no new errors
</verification>

<success_criteria>
1. Cron route exists and is registered in vercel.json (CORPUS-02 stub)
2. `buildApifyJobs` returns 15 valid configs (5 niches × 3 kinds) with D-04 age filter applied
3. `normalizeScrapedItem` handles both clockworks and apidojo formats with identical output shape
4. All three test files pass and `tsc --noEmit` is clean
</success_criteria>

<requirement_coverage>
| Requirement | Cross-link | Task |
|---|---|---|
| CORPUS-02 | REQUIREMENTS.md §Training Corpus | T1 (cron route + vercel.json — stub only, full mechanism Phase 11/12) |
| CORPUS-04 | REQUIREMENTS.md §Training Corpus | T3 (normalize captures views/likes/comments/shares/saves/follower fields; completion_pct exists as nullable per user decision 2026-05-11) |
| CORPUS-07 | REQUIREMENTS.md §Training Corpus | T2 (apify-jobs.ts builds corpus-specific scrape configs, separate from competitor scraping) |
</requirement_coverage>

<out_of_scope>
- Actual Apify call execution (Plan D's orchestrator)
- Webhook handling — Phase 1 uses synchronous `.call()` not `.start()` + webhook (RESEARCH §A.2 + PATTERNS §8 alternative)
- 30-day refresh execution logic (Phase 11/12 per CONTEXT line 15)
- Adjusting `src/app/api/webhooks/apify/route.ts` to route corpus items (Phase 11/12)
- Updating `src/lib/scraping/` index/types (deliberately keeping corpus scrape primitives inside `src/lib/engine/corpus/` per RESEARCH §"Primary recommendation")
</out_of_scope>

<output>
After completion, create `.planning/phases/01-training-corpus-eval-foundation/01-C-SUMMARY.md` per `@$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
