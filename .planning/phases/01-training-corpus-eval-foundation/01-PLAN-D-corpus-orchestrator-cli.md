---
phase: 1
plan: D
title: Corpus orchestrator + build CLI (Apify -> bucket -> dedup -> upsert)
status: pending
type: execute
wave: 2
depends_on: [A, B, C]
files_modified:
  - src/lib/engine/corpus/orchestrator.ts
  - src/lib/engine/corpus/corpus-version.ts
  - src/lib/engine/corpus/cli/build-corpus-args.ts
  - scripts/build-corpus.ts
  - package.json
  - src/lib/engine/corpus/__tests__/orchestrator.test.ts
  - src/lib/engine/corpus/__tests__/corpus-version.test.ts
  - src/lib/engine/corpus/__tests__/build-corpus-args.test.ts
autonomous: true
requirements: [CORPUS-01, CORPUS-03, CORPUS-08]
must_haves:
  truths:
    - "buildCorpus({corpusVersion, isPilot, dryRun}) orchestrates 5 niches x 3 configs sequentially with per-config isolated failures"
    - "Bucketing runs AFTER scrape but BEFORE max-3-per-creator dedup (Pitfall 3 order)"
    - "Dedup max-3-per-creator runs within each bucket (Pitfall 3)"
    - "Quality validation (CORPUS-08) drops rows with views below 1, all-zero engagement, or out-of-window posted_at"
    - "Upsert into training_corpus is idempotent on (corpus_version, platform_video_id)"
    - "bucket_target column captures the SCRAPE INTENT (which ScrapeConfigKind the row came from), distinct from final `bucket` after empirical classification — drift between intent and outcome is observable"
    - "tsx scripts/build-corpus.ts --version <v> --pilot|--full [--dry-run] runs the orchestrator end-to-end"
    - "corpus-version.ts caches sealed snapshots (D-13 immutable per version)"
    - "CLI argument parsing extracted to src/lib/engine/corpus/cli/build-corpus-args.ts with dedicated unit tests covering all flags and conflicting-flag rejection (catches false-positive smoke tests)"
  artifacts:
    - path: src/lib/engine/corpus/orchestrator.ts
      provides: "buildCorpus(opts) — Apify orchestration, bucketing, dedup, validation, upsert"
      contains: "buildCorpus"
    - path: src/lib/engine/corpus/corpus-version.ts
      provides: "loadCorpusVersion / sealCorpusVersion — read/write the threshold snapshot for a given version"
      contains: "loadCorpusVersion"
    - path: src/lib/engine/corpus/cli/build-corpus-args.ts
      provides: "parseBuildCorpusArgs(argv) — pure-function CLI argument parser"
      contains: "parseBuildCorpusArgs"
    - path: scripts/build-corpus.ts
      provides: "CLI: tsx scripts/build-corpus.ts --version <v> --pilot|--full [--dry-run] [--max-cost-cents N]"
      exports: ["main"]
    - path: package.json
      provides: "build-corpus npm script registration"
      contains: "build-corpus"
  key_links:
    - from: src/lib/engine/corpus/orchestrator.ts
      to: src/lib/engine/corpus/apify-jobs.ts
      via: "import { buildApifyJobs, type ScrapeConfigKind }"
      pattern: "buildApifyJobs"
    - from: src/lib/engine/corpus/orchestrator.ts
      to: src/lib/engine/corpus/normalize-scrape.ts
      via: "import { normalizeScrapedItem } passing the ScrapeConfigKind so bucket_target propagates through the row"
      pattern: "normalizeScrapedItem"
    - from: src/lib/engine/corpus/orchestrator.ts
      to: src/lib/engine/corpus/bucketing.ts
      via: "import { bucketByViews } and apply per-niche thresholds from getThresholds(version)"
      pattern: "bucketByViews"
    - from: src/lib/engine/corpus/orchestrator.ts
      to: src/lib/supabase/service.ts
      via: "createServiceClient() — service-role write to training_corpus"
      pattern: "createServiceClient"
    - from: scripts/build-corpus.ts
      to: src/lib/engine/corpus/cli/build-corpus-args.ts
      via: "Thin CLI shell delegates parsing to parseBuildCorpusArgs(process.argv.slice(2))"
      pattern: "parseBuildCorpusArgs"
    - from: scripts/build-corpus.ts
      to: src/lib/engine/corpus/orchestrator.ts
      via: "import { buildCorpus } via tsx + tsconfig-paths bootstrap"
      pattern: "buildCorpus"
---

<objective>
Wire Plans A (training_corpus table), B (bucketing + thresholds + config), and C (apify-jobs + normalize-scrape) into a single end-to-end orchestrator that builds the corpus. The orchestrator owns the scrape -> normalize -> bucket -> dedup -> validate -> upsert pipeline. The CLI is a thin shell that calls the orchestrator with the right flags (parsing extracted to a testable module per BLOCKER-5).

This plan does NOT actually scrape — Plan F (pilot) and Plan G (full) drive the CLI against Apify. Plan D establishes the machinery.

Purpose: Provides the runnable artifact (`tsx scripts/build-corpus.ts`) that Plans F/G operate to produce the pilot and full corpus.
Output: Orchestrator module + corpus-version cache + CLI + CLI args module + tests that mock Apify and assert end-to-end behavior.
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
@src/lib/engine/corpus/apify-jobs.ts
@src/lib/engine/corpus/normalize-scrape.ts
@src/lib/engine/corpus/bucketing.ts
@src/lib/engine/corpus/thresholds.ts
@src/lib/engine/corpus/eval-config.ts
@src/lib/supabase/service.ts
@src/app/api/cron/refresh-competitors/route.ts
@src/lib/cache.ts
@scripts/benchmark.ts
@scripts/import-apify-data.ts
@package.json

<interfaces>
<!-- From Plan B (already written by Wave 1) -->
- `import { NICHES, type Niche, TARGET_DISTRIBUTION_PILOT, TARGET_DISTRIBUTION_FULL } from "./eval-config"`
- `import { bucketByViews } from "./bucketing"`
- `import { getThresholds, type CorpusVersion } from "./thresholds"`

<!-- From Plan C (already written by Wave 1) -->
- `import { buildApifyJobs, type ScrapeConfigKind } from "./apify-jobs"`
- `import { normalizeScrapedItem, type NormalizedCorpusRow } from "./normalize-scrape"` — NOTE: Plan C must propagate `ScrapeConfigKind` into `NormalizedCorpusRow` (see W6 below)

<!-- From existing codebase -->
- `import { ApifyClient } from "apify-client"` (already installed v2.22.1)
- `import { createServiceClient } from "@/lib/supabase/service"` (line 11)
- `import { createLogger } from "@/lib/logger"` (line 63)
- `import * as Sentry from "@sentry/nextjs"`
- `import { createCache } from "@/lib/cache"` for corpus-version.ts caching

<!-- Patterns to mirror -->
- `src/app/api/cron/refresh-competitors/route.ts:50-100` — per-item isolated failures (one config failure does NOT abort the batch)
- `scripts/benchmark.ts:1-22` — exact tsx + dotenv + tsconfig-paths bootstrap for the CLI
- `scripts/benchmark.ts:760-768` — process.exit(0/1) pattern
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: corpus-version.ts — snapshot reader/writer with caching</name>
  <files>src/lib/engine/corpus/corpus-version.ts, src/lib/engine/corpus/__tests__/corpus-version.test.ts</files>
  <behavior>
- `loadCorpusVersion("pilot.2026-05-12")` synchronously returns the snapshot (from THRESHOLD_SNAPSHOTS via getThresholds + row count from DB)
- Repeated calls hit the cache (use createCache from @/lib/cache; D-13 says immutable -> cache forever or until manual invalidation)
- `loadCorpusVersion("unknown.version")` returns null (NOT throws — mirror ml.ts:475 "model not yet trained" pattern per PATTERNS §6)
- `sealCorpusVersion(version, opts)` is an in-memory function that returns the snapshot object for the orchestrator to attach to inserted rows; actual SQL row counts are queried lazily
- Snapshot includes: `version`, `niche_thresholds`, `sealed_at` (ISO timestamp), `row_count` (current DB count for that version; 0 if not yet built)
  </behavior>
  <action>
**src/lib/engine/corpus/corpus-version.ts** — per PATTERNS §6 concrete skeleton:

```typescript
import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import { createLogger } from "@/lib/logger";
import { getThresholds, listKnownVersions, type ThresholdsByNiche } from "./thresholds";

const log = createLogger({ module: "corpus/corpus-version" });

export interface CorpusVersionSnapshot {
  version: string;                                  // e.g., "pilot.2026-05-12"
  niche_thresholds: ThresholdsByNiche;
  sealed_at: string;                                 // ISO timestamp (set when first row inserted)
  row_count: number;                                 // current DB count for this version
}

// D-13 fixed-snapshot -> cache forever. Manual invalidation only.
const cache = createCache<CorpusVersionSnapshot>(Number.MAX_SAFE_INTEGER);

/**
 * Read a corpus version's snapshot: threshold values (immutable per D-13)
 * plus a live row count from the DB. Returns null when the version is not
 * registered in thresholds.ts (matches the ml.ts:475 "not yet trained" idiom).
 */
export async function loadCorpusVersion(
  version: string,
): Promise<CorpusVersionSnapshot | null> {
  const cached = cache.get(version);
  if (cached) {
    // Refresh row_count only (thresholds are immutable, cached forever)
    const fresh = await fetchRowCount(version);
    return { ...cached, row_count: fresh };
  }

  let thresholds: ThresholdsByNiche;
  try {
    thresholds = getThresholds(version);
  } catch {
    log.warn("Unknown corpus_version", { version, known: listKnownVersions() });
    return null;
  }

  const row_count = await fetchRowCount(version);
  const snapshot: CorpusVersionSnapshot = {
    version,
    niche_thresholds: thresholds,
    sealed_at: new Date().toISOString(),
    row_count,
  };
  cache.set(version, snapshot);
  return snapshot;
}

/** Manual cache invalidation — only used by tests. */
export function invalidateCorpusVersionCache(): void {
  cache.clear();
}

async function fetchRowCount(version: string): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("training_corpus")
    .select("id", { count: "exact", head: true })
    .eq("corpus_version", version);
  if (error) {
    log.warn("Row count fetch failed; returning 0", { error: error.message });
    return 0;
  }
  return count ?? 0;
}

/**
 * Convenience: list all known corpus versions (from thresholds.ts).
 * The DB may have additional `corpus_version` values written prior to thresholds.ts
 * registration — those are considered orphan rows; surfacing them is Plan F's job.
 */
export { listKnownVersions };
```

**Tests `__tests__/corpus-version.test.ts`** (use Vitest mocks for the Supabase client; `vi.mock("@/lib/supabase/service")`):

- `loadCorpusVersion("pilot.2026-05-12")` returns a snapshot with `niche_thresholds` matching `getThresholds(...)` output and `version === "pilot.2026-05-12"`
- `loadCorpusVersion("does-not-exist")` returns null (does NOT throw)
- Cache hit on second call (mock createCache or test via `invalidateCorpusVersionCache()` flip)
- Supabase error path: `fetchRowCount` returns 0 when the mock rejects with an error

Mock pattern (use existing test conventions from `src/lib/engine/__tests__/`):
```typescript
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 10, error: null }),
      }),
    }),
  })),
}));
```

Run tests after writing them.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/corpus-version.test.ts</automated>
  </verify>
  <done>Tests pass. loadCorpusVersion returns null for unknown versions (no throw). Cache invalidation works.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: orchestrator.ts — scrape, bucket, dedup, validate, upsert (with scrape-intent propagation per W6)</name>
  <files>src/lib/engine/corpus/orchestrator.ts, src/lib/engine/corpus/__tests__/orchestrator.test.ts</files>
  <behavior>
- `buildCorpus({ corpusVersion, isPilot: true, dryRun: true })` walks 5 niches x 3 configs, mocks return small fixtures, returns `{ inserted: 0, failed: [], summary }` (dryRun skips DB)
- Per-config failure is isolated: one mocked `actor.call()` rejection does NOT throw from `buildCorpus`; instead the niche/config pair appears in `failed[]`
- Pitfall 3 order: bucketing happens BEFORE max-3-per-creator dedup
- Dedup within bucket: at most 3 videos per `creator_handle` per bucket; viral sorted desc by views, average desc by views, under asc by views (RESEARCH §A.2)
- CORPUS-08 quality validation rules:
  - `views < 1` already filtered in normalize-scrape (Plan C); orchestrator double-checks
  - All-zero engagement (`likes + comments + shares + saves === 0`) rejected
  - `posted_at` already filtered to 7-90d window in normalize-scrape; orchestrator double-checks 7d floor
- Stratified sampling caps each bucket at the target (pilot 10/20/20, full 100/200/200)
- All-5-niches assertion: when fixture produces at least 1 row per niche, summary reports all 5 niches with non-zero counts (CORPUS-03)
- Non-dryRun path: writes to `training_corpus` via supabase.upsert with onConflict on `(corpus_version, platform_video_id)`
- **W6 — bucket_target propagation:** Each row carries `scrape_kind: ScrapeConfigKind` (from `NormalizedCorpusRow` — Plan C carries the scrape intent through normalization). The orchestrator maps `scrape_kind` -> `bucket_target` on the DB insert, distinct from `bucket` (which is the empirical classification result). This makes drift between scrape intent and actual classification observable: e.g., "trending" scrape that classified as "under" is a flag for review.
  </behavior>
  <action>
**Plan C dependency note (W6 prerequisite):** Plan C's `NormalizedCorpusRow` must include a `scrape_kind: ScrapeConfigKind` field, set by `normalizeScrapedItem(item, niche, corpus_version, scrapeKind)`. The orchestrator passes the kind through. Without this, `bucket_target` collapses to `bucket` and the column is a no-op. Plan C must add the `scrape_kind` field to `NormalizedCorpusRow` and accept it as the 4th argument to `normalizeScrapedItem` — see Plan C task 3 W6 step.

**src/lib/engine/corpus/orchestrator.ts** — per RESEARCH §A.2 + Pitfalls 1/3 + PATTERNS §10:

```typescript
import { ApifyClient } from "apify-client";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

import { NICHES, type Niche, TARGET_DISTRIBUTION_PILOT, TARGET_DISTRIBUTION_FULL } from "./eval-config";
import { buildApifyJobs, type ScrapeConfigKind } from "./apify-jobs";
import { normalizeScrapedItem, type NormalizedCorpusRow } from "./normalize-scrape";
import { bucketByViews } from "./bucketing";
import { getThresholds, type CorpusVersion } from "./thresholds";

const log = createLogger({ module: "corpus/orchestrator" });

const CONFIGS: ScrapeConfigKind[] = ["trending", "average", "under"];

export interface BuildCorpusOptions {
  corpusVersion: CorpusVersion | string;
  isPilot: boolean;
  dryRun?: boolean;
  apifyWaitSecs?: number;                 // override for testing
}

export interface BuildCorpusResult {
  inserted: number;
  failed: Array<{ niche: Niche; config: ScrapeConfigKind; error: string }>;
  summary: {
    rawCount: number;
    afterQualityFilter: number;
    afterBucketing: { viral: number; average: number; under: number };
    afterDedup: { viral: number; average: number; under: number };
    afterStratification: { viral: number; average: number; under: number };
    perNicheCount: Record<Niche, number>;
  };
}

/**
 * Apify client factory — overridable for tests.
 */
let apifyFactory: () => ApifyClient = () =>
  new ApifyClient({ token: process.env.APIFY_TOKEN ?? "" });

export function __setApifyFactoryForTests(f: () => ApifyClient): void {
  apifyFactory = f;
}

export async function buildCorpus(
  opts: BuildCorpusOptions,
): Promise<BuildCorpusResult> {
  const { corpusVersion, isPilot, dryRun = false } = opts;
  const supabase = createServiceClient();
  const apify = apifyFactory();
  const thresholds = getThresholds(corpusVersion);

  const failed: BuildCorpusResult["failed"] = [];
  const rawRows: NormalizedCorpusRow[] = [];

  // 5 niches x 3 configs sequential (per RESEARCH §A.2 reasoning: Apify concurrency caps + per-failure isolation)
  for (const niche of NICHES) {
    const jobs = buildApifyJobs(niche, isPilot);
    for (const config of CONFIGS) {
      const job = jobs[config];
      log.info("Starting scrape", { niche, config, actorId: job.actorId });
      try {
        const run = await apify
          .actor(job.actorId)
          .call(job.input, { waitSecs: opts.apifyWaitSecs ?? 600 });
        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        log.info("Scrape complete", { niche, config, rawItems: items.length });

        for (const item of items) {
          // W6: pass `config` (the ScrapeConfigKind) into normalize so bucket_target propagates
          const normalized = normalizeScrapedItem(item, niche, String(corpusVersion), config);
          if (normalized) rawRows.push(normalized);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("Scrape failed; continuing to next config", {
          niche,
          config,
          error: msg,
        });
        Sentry.captureException(err, {
          tags: { stage: "corpus_scrape", niche, config, corpusVersion: String(corpusVersion) },
        });
        failed.push({ niche, config, error: msg });
        // Continue — per refresh-competitors:99 isolation pattern
      }
    }
  }

  const rawCount = rawRows.length;
  log.info("All scrapes complete", { rawCount });

  // CORPUS-08 quality filter (orchestrator-level — belt-and-suspenders over normalize-scrape)
  const qualityFiltered = rawRows.filter(
    (r) =>
      r.views >= 1 &&
      r.likes + r.comments + r.shares + r.saves > 0 &&
      Date.now() - r.posted_at.getTime() >= 7 * 24 * 60 * 60 * 1000,
  );

  // Pitfall 3 ORDER: bucket FIRST, dedup AFTER
  const bucketed = qualityFiltered.map((r) => ({
    ...r,
    bucket: bucketByViews({ views: r.views, niche: r.niche }, thresholds),
  }));

  const counts = (label: "viral" | "average" | "under") =>
    bucketed.filter((r) => r.bucket === label).length;
  const afterBucketing = { viral: counts("viral"), average: counts("average"), under: counts("under") };

  // Dedup max-3-per-creator within each bucket
  const dedup = (
    rows: typeof bucketed,
    dir: "desc" | "asc",
  ): typeof bucketed => {
    const byCreator = new Map<string, typeof bucketed>();
    for (const r of rows) {
      const key = r.creator_handle ?? `__anon_${r.platform_video_id}`;
      const arr = byCreator.get(key) ?? [];
      arr.push(r);
      byCreator.set(key, arr);
    }
    const out: typeof bucketed = [];
    for (const arr of byCreator.values()) {
      const sorted = [...arr].sort((a, b) =>
        dir === "desc" ? b.views - a.views : a.views - b.views,
      );
      out.push(...sorted.slice(0, 3));            // D-05 max 3 per creator
    }
    return out;
  };

  const viral = dedup(bucketed.filter((r) => r.bucket === "viral"), "desc");
  const average = dedup(bucketed.filter((r) => r.bucket === "average"), "desc");
  const under = dedup(bucketed.filter((r) => r.bucket === "under"), "asc");
  const afterDedup = { viral: viral.length, average: average.length, under: under.length };

  // Stratified sample down to targets
  const targets = isPilot ? TARGET_DISTRIBUTION_PILOT : TARGET_DISTRIBUTION_FULL;
  const sampleTo = (rows: typeof bucketed, n: number) => rows.slice(0, n);
  const final = [
    ...sampleTo(viral, targets.viral),
    ...sampleTo(average, targets.average),
    ...sampleTo(under, targets.under),
  ];
  const afterStratification = {
    viral: Math.min(viral.length, targets.viral),
    average: Math.min(average.length, targets.average),
    under: Math.min(under.length, targets.under),
  };

  const perNicheCount = NICHES.reduce(
    (acc, n) => ({ ...acc, [n]: final.filter((r) => r.niche === n).length }),
    {} as Record<Niche, number>,
  );

  log.info("Pipeline complete", {
    rawCount,
    afterQualityFilter: qualityFiltered.length,
    afterBucketing,
    afterDedup,
    afterStratification,
    perNicheCount,
  });

  if (dryRun) {
    log.info("Dry run — skipping DB write", { wouldInsert: final.length });
    return {
      inserted: 0,
      failed,
      summary: { rawCount, afterQualityFilter: qualityFiltered.length, afterBucketing, afterDedup, afterStratification, perNicheCount },
    };
  }

  // Strip the Date instances back to ISO strings for the DB insert
  const dbRows = final.map((r) => ({
    platform: r.platform,
    platform_video_id: r.platform_video_id,
    video_url: r.video_url,
    creator_handle: r.creator_handle,
    posted_at: r.posted_at.toISOString(),
    scraped_at: r.scraped_at.toISOString(),
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    duration_seconds: r.duration_seconds,
    completion_pct: r.completion_pct,
    follower_count: r.follower_count,
    follower_tier: r.follower_tier,
    caption: r.caption,
    hashtags: r.hashtags,
    sound_name: r.sound_name,
    corpus_version: r.corpus_version,
    niche: r.niche,
    bucket: r.bucket,
    bucket_target: bucketTargetFor(r),       // W6: from scrape_kind, not from bucket
  }));

  const { error } = await supabase
    .from("training_corpus")
    .upsert(dbRows, { onConflict: "corpus_version,platform_video_id" });

  if (error) {
    log.error("Upsert failed", { error: error.message });
    throw error;
  }

  log.info("Corpus build complete", { corpusVersion, inserted: final.length });
  return {
    inserted: final.length,
    failed,
    summary: { rawCount, afterQualityFilter: qualityFiltered.length, afterBucketing, afterDedup, afterStratification, perNicheCount },
  };
}

/**
 * W6 fix: bucket_target encodes the SCRAPE INTENT (which ScrapeConfigKind
 * produced the row), distinct from `bucket` which is the empirical classification.
 * `ScrapeConfigKind = "trending" | "average" | "under"`. "trending" intent maps
 * to "viral" target (the trending feed sources viral candidates per D-02);
 * "average" and "under" map directly.
 */
function bucketTargetFor(
  r: NormalizedCorpusRow & { bucket: "viral" | "average" | "under" },
): "viral" | "average" | "under" {
  switch (r.scrape_kind) {
    case "trending": return "viral";
    case "average":  return "average";
    case "under":    return "under";
    default:         return r.bucket;     // legacy fallback if scrape_kind missing
  }
}
```

**Tests `__tests__/orchestrator.test.ts`** — must mock Apify and Supabase:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { __setApifyFactoryForTests, buildCorpus } from "../orchestrator";

// Mock Supabase service client to swallow upserts in tests
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
    }),
  })),
}));

describe("buildCorpus", () => {
  beforeEach(() => {
    // Build a deterministic Apify mock that returns small fixture items per niche/config
    __setApifyFactoryForTests(() => ({
      actor: (_id: string) => ({
        call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake-dataset" }),
      }),
      dataset: (_id: string) => ({
        listItems: vi.fn().mockResolvedValue({
          items: makeFixtureItems(),  // helper that returns clockworks-shaped items
        }),
      }),
    }) as never);
  });

  it("orchestrates all 5 niches x 3 configs in dryRun mode", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.inserted).toBe(0); // dryRun
    // All 5 niches represented
    for (const n of ["beauty","fitness","edu","comedy","lifestyle"] as const) {
      expect(result.summary.perNicheCount[n]).toBeGreaterThan(0);
    }
  });

  it("isolates per-config failures without aborting the batch", async () => {
    __setApifyFactoryForTests(() => ({
      actor: vi.fn(() => ({
        call: vi
          .fn()
          .mockRejectedValueOnce(new Error("Apify timeout"))   // first call fails
          .mockResolvedValue({ defaultDatasetId: "fake" }),    // rest succeed
      })),
      dataset: () => ({ listItems: vi.fn().mockResolvedValue({ items: makeFixtureItems() }) }),
    }) as never);

    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.failed.length).toBeGreaterThanOrEqual(1);
    expect(result.failed[0]?.error).toContain("Apify timeout");
    expect(result.summary.rawCount).toBeGreaterThan(0); // other 14 jobs still produced rows
  });

  it("applies CORPUS-08 quality filter (rejects all-zero engagement)", async () => {
    __setApifyFactoryForTests(() => ({
      actor: () => ({ call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake" }) }),
      dataset: () => ({
        listItems: vi.fn().mockResolvedValue({
          items: [makeFixtureItem({ likes: 0, comments: 0, shares: 0, collectCount: 0 })],
        }),
      }),
    }) as never);
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.summary.afterQualityFilter).toBe(0);
  });

  it("respects max-3-per-creator dedup AFTER bucketing", async () => {
    // 5 viral videos from the same creator -> after dedup, only top 3 by views remain
    __setApifyFactoryForTests(() => ({
      actor: () => ({ call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake" }) }),
      dataset: () => ({
        listItems: vi.fn().mockResolvedValue({
          items: [
            makeFixtureItem({ id: "v1", playCount: 1_000_000, authorMeta: { name: "creator_a" } }),
            makeFixtureItem({ id: "v2", playCount: 900_000, authorMeta: { name: "creator_a" } }),
            makeFixtureItem({ id: "v3", playCount: 800_000, authorMeta: { name: "creator_a" } }),
            makeFixtureItem({ id: "v4", playCount: 700_000, authorMeta: { name: "creator_a" } }),
            makeFixtureItem({ id: "v5", playCount: 600_000, authorMeta: { name: "creator_a" } }),
          ],
        }),
      }),
    }) as never);
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    // At most 3 viral videos for creator_a (top 3 by views)
    expect(result.summary.afterDedup.viral).toBeLessThanOrEqual(3 * 5); // 5 niches each loop
  });
});

// Fixture helpers — generate clockworks-shaped items 8+ days old so date filter passes
function makeFixtureItem(overrides: Record<string, unknown> = {}): unknown { /* ... */ }
function makeFixtureItems(): unknown[] { /* ... */ }
```

Implement `makeFixtureItem` to return clockworks-shaped objects: `{ id, playCount, diggCount, commentCount, shareCount, collectCount, createTime (Unix sec, 10 days ago), webVideoUrl, text, hashtags, authorMeta: { name, fans } }`. Use a base shape with views = 500_000 (lands in beauty/lifestyle viral range or comedy/fitness/edu non-under) and merge `overrides`.

Run tests after writing them; iterate until green.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/orchestrator.test.ts</automated>
  </verify>
  <done>All 4 test cases pass. Bucketing happens before dedup. Per-config failures isolated. All 5 niches surface in summary when fixtures cover them. bucket_target is computed from scrape_kind (W6), not from bucket.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: CLI args module + scripts/build-corpus.ts + package.json script + args tests (BLOCKER-5)</name>
  <files>src/lib/engine/corpus/cli/build-corpus-args.ts, src/lib/engine/corpus/__tests__/build-corpus-args.test.ts, scripts/build-corpus.ts, package.json</files>
  <behavior>
BLOCKER-5 resolution: the CLI's argument parser is extracted into a testable module. The previous `grep -q "Usage"` smoke test was a false-positive gate.
1. `parseBuildCorpusArgs(argv: string[])` is pure: returns a typed `BuildCorpusArgs` struct on success, or throws `BuildCorpusArgsError` on validation failure. It does NOT call `process.exit` directly — the CLI shell in scripts/build-corpus.ts handles exit-code translation.
2. Every flag is tested:
   - `--version <v>` is REQUIRED.
   - Exactly one of `--pilot` or `--full` must be present (both/neither -> throw).
   - `--dry-run` is a boolean flag.
   - `--max-cost-cents <N>` parses as optional non-negative integer.
   - Conflicting flags (e.g., `--version` without value) throw.
3. The CLI smoke test in <verify> still runs but is no longer the sole gate.
  </behavior>
  <action>
**src/lib/engine/corpus/cli/build-corpus-args.ts** — pure, testable argument parser:

```typescript
export interface BuildCorpusArgs {
  version: string;
  isPilot: boolean;
  dryRun: boolean;
  maxCostCents?: number;
}

export class BuildCorpusArgsError extends Error {
  constructor(message: string, public readonly usage: string) {
    super(message);
    this.name = "BuildCorpusArgsError";
  }
}

export const BUILD_CORPUS_USAGE = [
  "Usage: tsx scripts/build-corpus.ts --version <pilot.YYYY-MM-DD|full.YYYY-MM-DD> --pilot|--full [options]",
  "",
  "Required:",
  "  --version <v>                  Corpus version identifier (e.g., pilot.2026-05-12)",
  "  --pilot OR --full              Pick exactly one — determines target distribution",
  "",
  "Options:",
  "  --dry-run                      Run the full pipeline but skip the DB write",
  "  --max-cost-cents <N>           Soft cost ceiling for monitoring (orchestrator does not enforce)",
].join("\n");

/**
 * Parse CLI arguments for scripts/build-corpus.ts. Pure function — returns a typed
 * BuildCorpusArgs struct on success or throws BuildCorpusArgsError on validation failure.
 * Does NOT call process.exit; the CLI shell does that.
 */
export function parseBuildCorpusArgs(argv: string[]): BuildCorpusArgs {
  const get = (flag: string): string | undefined => {
    const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
    if (i < 0) return undefined;
    const a = argv[i]!;
    if (a.includes("=")) return a.split("=", 2)[1];
    const next = argv[i + 1];
    // Conflicting-flag guard: a flag value must not itself start with `--`.
    if (next === undefined || next.startsWith("--")) {
      throw new BuildCorpusArgsError(`Flag ${flag} requires a value`, BUILD_CORPUS_USAGE);
    }
    return next;
  };

  const version = get("--version");
  if (!version) {
    throw new BuildCorpusArgsError("--version is required", BUILD_CORPUS_USAGE);
  }

  const isPilot = argv.includes("--pilot");
  const isFull = argv.includes("--full");
  if (isPilot && isFull) {
    throw new BuildCorpusArgsError("Pass exactly one of --pilot or --full", BUILD_CORPUS_USAGE);
  }
  if (!isPilot && !isFull) {
    throw new BuildCorpusArgsError("Pass --pilot or --full", BUILD_CORPUS_USAGE);
  }

  const dryRun = argv.includes("--dry-run");

  const maxCostRaw = get("--max-cost-cents");
  let maxCostCents: number | undefined;
  if (maxCostRaw !== undefined) {
    const n = Number(maxCostRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      throw new BuildCorpusArgsError(
        `--max-cost-cents must be a non-negative integer (got ${maxCostRaw})`,
        BUILD_CORPUS_USAGE,
      );
    }
    maxCostCents = n;
  }

  return { version, isPilot, dryRun, maxCostCents };
}
```

**src/lib/engine/corpus/__tests__/build-corpus-args.test.ts**:

```typescript
import { describe, it, expect } from "vitest";
import { parseBuildCorpusArgs, BuildCorpusArgsError, BUILD_CORPUS_USAGE } from "../cli/build-corpus-args";

describe("parseBuildCorpusArgs", () => {
  it("requires --version", () => {
    expect(() => parseBuildCorpusArgs([])).toThrow(BuildCorpusArgsError);
    expect(() => parseBuildCorpusArgs(["--pilot"])).toThrow(/--version is required/);
  });

  it("requires exactly one of --pilot or --full", () => {
    expect(() => parseBuildCorpusArgs(["--version", "v1"])).toThrow(/--pilot or --full/);
    expect(() => parseBuildCorpusArgs(["--version", "v1", "--pilot", "--full"])).toThrow(/exactly one/);
  });

  it("parses pilot mode", () => {
    const args = parseBuildCorpusArgs(["--version", "pilot.2026-05-12", "--pilot"]);
    expect(args.version).toBe("pilot.2026-05-12");
    expect(args.isPilot).toBe(true);
    expect(args.dryRun).toBe(false);
    expect(args.maxCostCents).toBeUndefined();
  });

  it("parses full mode", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--full"]);
    expect(args.version).toBe("full.2026-05-12");
    expect(args.isPilot).toBe(false);
  });

  it("parses --dry-run", () => {
    const args = parseBuildCorpusArgs(["--version", "v1", "--pilot", "--dry-run"]);
    expect(args.dryRun).toBe(true);
  });

  it("parses --max-cost-cents", () => {
    const args = parseBuildCorpusArgs(["--version", "v1", "--pilot", "--max-cost-cents", "1000"]);
    expect(args.maxCostCents).toBe(1000);
  });

  it("rejects non-integer --max-cost-cents", () => {
    expect(() => parseBuildCorpusArgs(["--version", "v1", "--pilot", "--max-cost-cents", "abc"])).toThrow(BuildCorpusArgsError);
    expect(() => parseBuildCorpusArgs(["--version", "v1", "--pilot", "--max-cost-cents", "-5"])).toThrow(BuildCorpusArgsError);
  });

  it("rejects conflicting flags (value missing or another flag taken as value)", () => {
    expect(() => parseBuildCorpusArgs(["--version", "--pilot"])).toThrow(/requires a value/);
    expect(() => parseBuildCorpusArgs(["--version", "v1", "--pilot", "--max-cost-cents"])).toThrow(/requires a value/);
  });

  it("supports `--flag=value` syntax", () => {
    const args = parseBuildCorpusArgs(["--version=pilot.2026-05-12", "--pilot", "--max-cost-cents=1500"]);
    expect(args.version).toBe("pilot.2026-05-12");
    expect(args.maxCostCents).toBe(1500);
  });

  it("BUILD_CORPUS_USAGE contains the required documentation strings", () => {
    expect(BUILD_CORPUS_USAGE).toContain("--version");
    expect(BUILD_CORPUS_USAGE).toContain("--pilot");
    expect(BUILD_CORPUS_USAGE).toContain("--full");
  });
});
```

**scripts/build-corpus.ts** — thin shell delegating to `parseBuildCorpusArgs`. Pattern matches `scripts/benchmark.ts:1-22` exactly:

```typescript
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// After path registration — safe to use @/ aliases
import { buildCorpus } from "../src/lib/engine/corpus/orchestrator";
import { parseBuildCorpusArgs, BuildCorpusArgsError } from "../src/lib/engine/corpus/cli/build-corpus-args";

const log = (msg: string) => console.log(`[build-corpus] ${msg}`);

async function main() {
  let args;
  try {
    args = parseBuildCorpusArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof BuildCorpusArgsError) {
      log(err.message);
      log("");
      log(err.usage);
      process.exit(1);
    }
    throw err;
  }

  log(`Starting corpus build: version=${args.version} pilot=${args.isPilot} dryRun=${args.dryRun}`);
  const result = await buildCorpus({
    corpusVersion: args.version,
    isPilot: args.isPilot,
    dryRun: args.dryRun,
  });
  log(`Inserted: ${result.inserted}`);
  log(`Failed configs: ${result.failed.length}`);
  log(`Summary: ${JSON.stringify(result.summary, null, 2)}`);
  if (result.failed.length > 0) {
    log("Failures:");
    for (const f of result.failed) log(`  ${f.niche}/${f.config}: ${f.error}`);
  }
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) log(err.stack);
  process.exit(1);
});
```

**package.json** — add the npm script alongside `benchmark`:

Use Edit/Write to add the new script in the existing `"scripts"` block. Inserted line:
```json
"build-corpus": "npx tsx scripts/build-corpus.ts",
```

Place after `"benchmark": "npx tsx scripts/benchmark.ts"`. Preserve all other scripts unchanged.

Verify (BLOCKER-5): args test file is the PRIMARY gate. CLI smoke is SECONDARY.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/build-corpus-args.test.ts && test -f scripts/build-corpus.ts && grep -q "build-corpus" package.json && npx tsx scripts/build-corpus.ts 2>&1 | grep -q "Usage"</automated>
  </verify>
  <done>parseBuildCorpusArgs unit tests pass. Script exists, package.json has build-corpus entry, CLI prints usage when invoked without args. The args module is the primary correctness gate; the CLI smoke is secondary. (Real Apify execution deferred to Plans F/G.)</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLI (operator-driven) -> application | `tsx scripts/build-corpus.ts` runs locally with env-var auth; not exposed via HTTP |
| Apify dataset items -> orchestrator | Untrusted external data crosses normalize-scrape (Zod validated in Plan C) |
| Orchestrator -> training_corpus | Service-role writes only via createServiceClient |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-D-01 | Tampering | Untrusted Apify items reaching the DB | mitigate | normalize-scrape (Plan C) Zod safeParse + orchestrator CORPUS-08 quality double-check |
| T-01-D-02 | Tampering | Borderline videos manipulating bucket boundaries | accept | D-10 hard cutoff makes this deterministic — same input -> same bucket. Pitfall 3 ordering ensures bucket assignment can't be gamed by creator-dominated scrapes (dedup runs after). |
| T-01-D-03 | DoS | Apify run hangs indefinitely | mitigate | `waitSecs: 600` (10 min) timeout per call. Per-config failure isolated — one timeout doesn't block the other 14 jobs. |
| T-01-D-04 | Spoofing | Stale APIFY_TOKEN in env | accept | Operator-driven CLI; token rotation is operator concern. Apify returns 401 on invalid token -> caught by per-config try/catch -> reported in `failed[]`. |
| T-01-D-05 | Repudiation | Failed upsert leaves no audit trail | mitigate | Sentry captures all per-config failures with tags (niche, config, corpusVersion). Structured logger emits per-job events. `failed[]` array surfaced in CLI output. |
</threat_model>

<verification>
- `npx vitest run src/lib/engine/corpus/__tests__/corpus-version.test.ts src/lib/engine/corpus/__tests__/orchestrator.test.ts src/lib/engine/corpus/__tests__/build-corpus-args.test.ts` passes
- `scripts/build-corpus.ts` exists; `npx tsx scripts/build-corpus.ts` (no args) exits 1 with usage
- `package.json` has `"build-corpus": "npx tsx scripts/build-corpus.ts"` in scripts
- `npx tsc --noEmit` passes
- Mocked end-to-end run produces all 5 niches in summary.perNicheCount
- bucket_target column propagates from scrape_kind (not collapsed to bucket)
</verification>

<success_criteria>
1. `buildCorpus({corpusVersion, isPilot, dryRun})` works end-to-end in tests with mocked Apify + Supabase
2. Pitfall 3 ordering preserved (bucket -> dedup, not reverse)
3. Per-config failures don't abort the batch (refresh-competitors:99 isolation pattern)
4. CLI shells the orchestrator and prints structured summary; parsing is testable
5. `package.json` exposes `build-corpus` npm script
6. bucket_target column encodes scrape INTENT (W6 — propagated from Plan C's NormalizedCorpusRow.scrape_kind)
</success_criteria>

<requirement_coverage>
| Requirement | Cross-link | Task |
|---|---|---|
| CORPUS-01 | REQUIREMENTS.md §Training Corpus | T2 (stratification + targets) + Plans F/G operational drive the actual 500-video build |
| CORPUS-03 | REQUIREMENTS.md §Training Corpus | T2 (perNicheCount in summary asserts all 5 niches) |
| CORPUS-08 | REQUIREMENTS.md §Training Corpus | T2 (quality filter: views<1, all-zero engagement, age window) |
</requirement_coverage>

<out_of_scope>
- Running the actual scrape against live Apify (Plans F + G)
- Threshold recalibration logic — Plan F adds `full.YYYY-MM-DD` to thresholds.ts after pilot
- Cost cap enforcement at scrape time — Apify costs are billed by Apify infra; engine API costs only matter at eval time (covered by Plan E)
- Webhook-driven async scrape pattern (RESEARCH §A.2 prefers sync `.call()` for 15 small jobs; webhooks would over-engineer Phase 1)
- Updates to existing `scripts/import-apify-data.ts` (separate concern; corpus uses its own normalize-scrape)
</out_of_scope>

<output>
After completion, create `.planning/phases/01-training-corpus-eval-foundation/01-D-SUMMARY.md` per `@$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
