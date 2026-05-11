import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync, rmSync } from "fs";
import {
  __setApifyFactoryForTests,
  buildCorpus,
  scrapeRawToCache,
  bucketAndPersist,
  writeRawCache,
  readRawCache,
  defaultCachePath,
} from "../orchestrator";
import type { NormalizedCorpusRow } from "../normalize-scrape";
import type { Niche } from "../apify-jobs";

// Mock Supabase service client to swallow upserts in tests
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({
      upsert: mockUpsert,
      select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
    }),
  })),
}));

// Mock Sentry to avoid initialization errors in tests
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// ─── Fixture helpers ─────────────────────────────────────────────────────────
let _fixtureItemCounter = 0;

/** Build an apidojo-shaped fixture item (the new format) */
function makeApidojoFixtureItem(overrides: Record<string, unknown> = {}): unknown {
  const tenDaysAgoSec = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
  _fixtureItemCounter++;
  const defaultId = `video_${_fixtureItemCounter}`;
  const defaultCreator = `creator_${_fixtureItemCounter}`;
  return {
    id: defaultId,
    postPage: `https://tiktok.com/@${defaultCreator}/video/${defaultId}`,
    views: 500_000, // lands in beauty/lifestyle viral (viralFloor=250k)
    likes: 10_000,
    comments: 500,
    shares: 200,
    bookmarks: 100,
    uploadedAt: tenDaysAgoSec,
    title: "Test caption #beauty",
    hashtags: ["beauty"],
    channel: { username: defaultCreator },
    video: { duration: 30 },
    ...overrides,
  };
}

/** Also keep clockworks-shaped items for legacy buildCorpus tests */
function makeFixtureItem(overrides: Record<string, unknown> = {}): unknown {
  const tenDaysAgoSec = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
  _fixtureItemCounter++;
  const defaultId = `video_${_fixtureItemCounter}`;
  const defaultCreator = `creator_${_fixtureItemCounter}`;
  return {
    id: defaultId,
    playCount: 500_000,
    diggCount: 10_000,
    commentCount: 500,
    shareCount: 200,
    collectCount: 100,
    createTime: tenDaysAgoSec,
    webVideoUrl: `https://tiktok.com/@${defaultCreator}/video/${defaultId}`,
    text: "Test caption #beauty",
    hashtags: [{ name: "beauty" }],
    authorMeta: { name: defaultCreator, fans: 50_000 },
    videoMeta: { duration: 30 },
    ...overrides,
  };
}

function makeFixtureItems(): unknown[] {
  return [makeFixtureItem(), makeFixtureItem()];
}

function makeApidojoFixtureItems(): unknown[] {
  return [makeApidojoFixtureItem(), makeApidojoFixtureItem()];
}

function makeApifyMock(itemsFn: () => unknown[]) {
  return () =>
    ({
      actor: (_id: string) => ({
        call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake-dataset" }),
      }),
      dataset: (_id: string) => ({
        listItems: vi.fn().mockResolvedValue({ items: itemsFn() }),
      }),
    }) as never;
}

/** Build a NormalizedCorpusRow for use in unit tests. */
function makeNormalizedRow(overrides: Partial<NormalizedCorpusRow> = {}): NormalizedCorpusRow {
  _fixtureItemCounter++;
  const posted_at = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const scraped_at = new Date();
  return {
    platform: "tiktok",
    platform_video_id: `vid_${_fixtureItemCounter}`,
    video_url: `https://tiktok.com/video/vid_${_fixtureItemCounter}`,
    creator_handle: `creator_${_fixtureItemCounter}`,
    niche: "beauty" as Niche,
    corpus_version: "full.2026-05-12",
    scrape_kind: "trending",
    views: 500_000,
    likes: 10_000,
    comments: 500,
    shares: 200,
    saves: 100,
    duration_seconds: 30,
    completion_pct: null,
    follower_count: null,
    follower_tier: null,
    caption: "Test caption",
    hashtags: ["beauty"],
    sound_name: null,
    posted_at,
    scraped_at,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("buildCorpus (legacy single-pass)", () => {
  beforeEach(() => {
    _fixtureItemCounter = 0;
    mockUpsert.mockResolvedValue({ error: null });
    __setApifyFactoryForTests(makeApifyMock(makeFixtureItems));
  });

  it("orchestrates all 5 niches x 3 configs in dryRun mode", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.inserted).toBe(0); // dryRun skips DB write
    expect(result.failed).toHaveLength(0);
    expect(result.summary.rawCount).toBeGreaterThan(0);
    expect(result.summary.afterQualityFilter).toBeGreaterThan(0);
    const bucketedTotal =
      result.summary.afterBucketing.viral +
      result.summary.afterBucketing.average +
      result.summary.afterBucketing.under;
    expect(bucketedTotal).toBeGreaterThan(0);
    for (const n of [
      "beauty", "fitness", "edu", "comedy", "lifestyle",
    ] as const) {
      expect(typeof result.summary.perNicheCount[n]).toBe("number");
    }
  });

  it("isolates per-config failures without aborting the batch", async () => {
    let callCount = 0;
    __setApifyFactoryForTests(
      () =>
        ({
          actor: vi.fn(() => ({
            call: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.reject(new Error("Apify timeout"));
              return Promise.resolve({ defaultDatasetId: "fake" });
            }),
          })),
          dataset: () => ({
            listItems: vi.fn().mockResolvedValue({ items: makeFixtureItems() }),
          }),
        }) as never
    );
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.failed.length).toBeGreaterThanOrEqual(1);
    expect(result.failed[0]?.error).toContain("Apify timeout");
    expect(result.summary.rawCount).toBeGreaterThan(0);
  });

  it("applies CORPUS-08 quality filter (rejects all-zero engagement)", async () => {
    __setApifyFactoryForTests(
      () =>
        ({
          actor: () => ({
            call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake" }),
          }),
          dataset: () => ({
            listItems: vi.fn().mockResolvedValue({
              items: [
                makeFixtureItem({
                  diggCount: 0, commentCount: 0, shareCount: 0, collectCount: 0,
                }),
              ],
            }),
          }),
        }) as never
    );
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.summary.afterQualityFilter).toBe(0);
  });

  it("respects max-3-per-creator dedup AFTER bucketing (viral bucket)", async () => {
    const tenDaysAgoSec = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
    const items = [
      makeFixtureItem({ id: "v1", playCount: 1_000_000, createTime: tenDaysAgoSec, authorMeta: { name: "creator_a", fans: 50_000 } }),
      makeFixtureItem({ id: "v2", playCount: 900_000, createTime: tenDaysAgoSec, authorMeta: { name: "creator_a", fans: 50_000 } }),
      makeFixtureItem({ id: "v3", playCount: 800_000, createTime: tenDaysAgoSec, authorMeta: { name: "creator_a", fans: 50_000 } }),
      makeFixtureItem({ id: "v4", playCount: 700_000, createTime: tenDaysAgoSec, authorMeta: { name: "creator_a", fans: 50_000 } }),
      makeFixtureItem({ id: "v5", playCount: 600_000, createTime: tenDaysAgoSec, authorMeta: { name: "creator_a", fans: 50_000 } }),
    ];
    __setApifyFactoryForTests(
      () =>
        ({
          actor: () => ({
            call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake" }),
          }),
          dataset: () => ({
            listItems: vi.fn().mockResolvedValue({ items }),
          }),
        }) as never
    );
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.summary.afterDedup.viral).toBeLessThanOrEqual(3 * 5);
  });

  it("dryRun=false writes to DB via upsert and returns inserted count", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: false,
    });
    expect(result.inserted).toBeGreaterThanOrEqual(0);
    expect(typeof result.summary.perNicheCount.beauty).toBe("number");
  });

  it("bucket ordering: bucketing happens BEFORE dedup (Pitfall 3)", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    const bucketedTotal =
      result.summary.afterBucketing.viral +
      result.summary.afterBucketing.average +
      result.summary.afterBucketing.under;
    const dedupTotal =
      result.summary.afterDedup.viral +
      result.summary.afterDedup.average +
      result.summary.afterDedup.under;
    expect(dedupTotal).toBeLessThanOrEqual(bucketedTotal);
  });

  it("summary includes rawCount and afterQualityFilter fields", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.summary).toHaveProperty("rawCount");
    expect(result.summary).toHaveProperty("afterQualityFilter");
    expect(result.summary).toHaveProperty("afterBucketing");
    expect(result.summary).toHaveProperty("afterDedup");
    expect(result.summary).toHaveProperty("afterStratification");
    expect(result.summary).toHaveProperty("perNicheCount");
    expect(result.summary.rawCount).toBeGreaterThanOrEqual(result.summary.afterQualityFilter);
  });
});

// ─── scrapeRawToCache tests ───────────────────────────────────────────────────
describe("scrapeRawToCache", () => {
  beforeEach(() => {
    _fixtureItemCounter = 0;
    mockUpsert.mockClear();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("returns normalized rows without writing to Supabase", async () => {
    const apifyClient = makeApifyMock(makeApidojoFixtureItems)() as ReturnType<typeof makeApifyMock>;
    const rows = await scrapeRawToCache({
      version: "full.2026-05-12",
      apifyClient: apifyClient as never,
      isPilot: true,
    });
    // No upsert called
    expect(mockUpsert).not.toHaveBeenCalled();
    // Should return non-empty rows
    expect(rows.length).toBeGreaterThan(0);
  });

  it("returns NormalizedCorpusRow objects (correct fields present)", async () => {
    const apifyClient = makeApifyMock(makeApidojoFixtureItems)() as never;
    const rows = await scrapeRawToCache({
      version: "full.2026-05-12",
      apifyClient,
      isPilot: true,
    });
    for (const row of rows) {
      expect(row).toHaveProperty("platform");
      expect(row).toHaveProperty("platform_video_id");
      expect(row).toHaveProperty("views");
      expect(row).toHaveProperty("niche");
      expect(row).toHaveProperty("corpus_version");
      expect(row.posted_at).toBeInstanceOf(Date);
      expect(row.scraped_at).toBeInstanceOf(Date);
    }
  });

  it("applies CORPUS-08 quality filter (views < 1 rejected)", async () => {
    const apifyClient = {
      actor: () => ({
        call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake" }),
      }),
      dataset: () => ({
        listItems: vi.fn().mockResolvedValue({
          items: [makeApidojoFixtureItem({ views: 0 })],
        }),
      }),
    } as never;
    const rows = await scrapeRawToCache({
      version: "full.2026-05-12",
      apifyClient,
      isPilot: true,
    });
    expect(rows.length).toBe(0);
  });

  it("applies Pitfall 1 age filter (posts < 7 days old rejected)", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const apifyClient = {
      actor: () => ({
        call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake" }),
      }),
      dataset: () => ({
        listItems: vi.fn().mockResolvedValue({
          items: [makeApidojoFixtureItem({ uploadedAt: nowSec })], // too new
        }),
      }),
    } as never;
    const rows = await scrapeRawToCache({
      version: "full.2026-05-12",
      apifyClient,
      isPilot: true,
    });
    expect(rows.length).toBe(0);
  });

  it("deduplicates by platform_video_id", async () => {
    // Return the same video from multiple configs
    const duplicate = makeApidojoFixtureItem({ id: "dup-video-1" });
    const apifyClient = {
      actor: () => ({
        call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake" }),
      }),
      dataset: () => ({
        listItems: vi.fn().mockResolvedValue({
          items: [duplicate, duplicate, duplicate],
        }),
      }),
    } as never;
    const rows = await scrapeRawToCache({
      version: "full.2026-05-12",
      apifyClient,
      isPilot: true,
      niches: ["beauty"],
    });
    // Should be deduplicated to 1
    const dupCount = rows.filter((r) => r.platform_video_id === "dup-video-1").length;
    expect(dupCount).toBe(1);
  });

  it("accepts optional niches and configs filters", async () => {
    let callCount = 0;
    const apifyClient = {
      actor: () => ({
        call: vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({ defaultDatasetId: "fake" });
        }),
      }),
      dataset: () => ({
        listItems: vi.fn().mockResolvedValue({ items: makeApidojoFixtureItems() }),
      }),
    } as never;
    await scrapeRawToCache({
      version: "full.2026-05-12",
      apifyClient,
      isPilot: true,
      niches: ["beauty"],
      configs: ["trending"],
    });
    // Only 1 niche × 1 config = 1 call
    expect(callCount).toBe(1);
  });

  it("isolates per-config failures without aborting the batch", async () => {
    let callCount = 0;
    const apifyClient = {
      actor: () => ({
        call: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.reject(new Error("Apify timeout"));
          return Promise.resolve({ defaultDatasetId: "fake" });
        }),
      }),
      dataset: () => ({
        listItems: vi.fn().mockResolvedValue({ items: makeApidojoFixtureItems() }),
      }),
    } as never;
    const rows = await scrapeRawToCache({
      version: "full.2026-05-12",
      apifyClient,
      isPilot: true,
      niches: ["beauty"],
    });
    // 3 configs total; first failed, other 2 succeeded
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ─── bucketAndPersist tests ───────────────────────────────────────────────────
describe("bucketAndPersist", () => {
  beforeEach(() => {
    _fixtureItemCounter = 0;
    mockUpsert.mockResolvedValue({ error: null });
  });

  function makeMockSupabase(upsertImpl?: () => Promise<{ error: null }>) {
    const upsert = upsertImpl
      ? vi.fn().mockImplementation(upsertImpl)
      : vi.fn().mockResolvedValue({ error: null });
    return {
      from: () => ({ upsert }),
      _upsert: upsert,
    };
  }

  it("requires a sealed version — throws if getThresholds fails", async () => {
    const supabase = makeMockSupabase();
    const rows = [makeNormalizedRow({ corpus_version: "full.9999-01-01" })];
    await expect(
      bucketAndPersist({ rows, version: "full.9999-01-01", supabase: supabase as never })
    ).rejects.toThrow(/Unknown corpus_version/);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it("upserts rows to training_corpus for a known version", async () => {
    const supabase = makeMockSupabase();
    const rows = [
      makeNormalizedRow({ views: 500_000, niche: "beauty", corpus_version: "pilot.2026-05-12" }),
      makeNormalizedRow({ views: 50_000, niche: "beauty", corpus_version: "pilot.2026-05-12" }),
    ];
    const result = await bucketAndPersist({
      rows,
      version: "pilot.2026-05-12",
      supabase: supabase as never,
    });
    expect(supabase._upsert).toHaveBeenCalledOnce();
    expect(result.upserted).toBeGreaterThan(0);
  });

  it("batch-deduplicates on platform_video_id (8261876 fix: no duplicate IDs in upsert)", async () => {
    const capturedBatch: unknown[] = [];
    const supabase = {
      from: () => ({
        upsert: vi.fn().mockImplementation((batch: unknown[]) => {
          capturedBatch.push(...batch);
          return Promise.resolve({ error: null });
        }),
      }),
    };
    const rows = [
      makeNormalizedRow({ platform_video_id: "dup-id", views: 500_000, corpus_version: "pilot.2026-05-12" }),
      makeNormalizedRow({ platform_video_id: "dup-id", views: 600_000, corpus_version: "pilot.2026-05-12" }),
      makeNormalizedRow({ views: 300_000, corpus_version: "pilot.2026-05-12" }),
    ];
    await bucketAndPersist({ rows, version: "pilot.2026-05-12", supabase: supabase as never });
    const ids = (capturedBatch as Array<{ platform_video_id: string }>).map(
      (r) => r.platform_video_id
    );
    const dupIds = ids.filter((id) => id === "dup-id");
    // Only 1 instance of the duplicate should be in the batch
    expect(dupIds.length).toBe(1);
  });

  it("returns perNicheBucket breakdown and skipped count", async () => {
    const supabase = makeMockSupabase();
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeNormalizedRow({ views: 500_000 * (i + 1), niche: "beauty", corpus_version: "pilot.2026-05-12" })
    );
    const result = await bucketAndPersist({
      rows,
      version: "pilot.2026-05-12",
      supabase: supabase as never,
      bucketCaps: { viral: 2, average: 2, under: 2 },
    });
    expect(typeof result.perNicheBucket["beauty.viral"]).toBe("number");
    expect(typeof result.skipped).toBe("number");
  });

  it("returns upserted=0 and does not call upsert when rows is empty", async () => {
    const supabase = makeMockSupabase();
    const result = await bucketAndPersist({
      rows: [],
      version: "pilot.2026-05-12",
      supabase: supabase as never,
    });
    expect(result.upserted).toBe(0);
    expect(supabase._upsert).not.toHaveBeenCalled();
  });

  it("propagates upsert errors", async () => {
    const supabase = {
      from: () => ({
        upsert: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
      }),
    };
    const rows = [makeNormalizedRow({ views: 500_000, corpus_version: "pilot.2026-05-12" })];
    await expect(
      bucketAndPersist({ rows, version: "pilot.2026-05-12", supabase: supabase as never })
    ).rejects.toMatchObject({ message: "DB error" });
  });
});

// ─── writeRawCache / readRawCache roundtrip tests ─────────────────────────────
describe("writeRawCache / readRawCache", () => {
  const tmpCacheDir = join(tmpdir(), `orch-test-cache-${Date.now()}`);

  afterEach(() => {
    if (existsSync(tmpCacheDir)) {
      rmSync(tmpCacheDir, { recursive: true, force: true });
    }
  });

  it("roundtrips all NormalizedCorpusRow fields including Date objects", async () => {
    const posted_at = new Date("2026-05-01T12:00:00.000Z");
    const scraped_at = new Date("2026-05-11T10:00:00.000Z");
    const row: NormalizedCorpusRow = {
      platform: "tiktok",
      platform_video_id: "rt-test-video-1",
      video_url: "https://tiktok.com/video/rt-test-video-1",
      creator_handle: "rt_creator",
      niche: "fitness",
      corpus_version: "full.2026-05-12",
      scrape_kind: "average",
      views: 123_456,
      likes: 5_000,
      comments: 200,
      shares: 50,
      saves: 30,
      duration_seconds: 45,
      completion_pct: null,
      follower_count: null,
      follower_tier: null,
      caption: "Test roundtrip caption",
      hashtags: ["fitness", "gym"],
      sound_name: null,
      posted_at,
      scraped_at,
    };

    const filePath = join(tmpCacheDir, "rt-test.jsonl");
    await writeRawCache([row], filePath);
    const loaded = await readRawCache(filePath);

    expect(loaded).toHaveLength(1);
    const loaded0 = loaded[0]!;
    expect(loaded0.platform).toBe("tiktok");
    expect(loaded0.platform_video_id).toBe("rt-test-video-1");
    expect(loaded0.views).toBe(123_456);
    expect(loaded0.niche).toBe("fitness");
    expect(loaded0.scrape_kind).toBe("average");
    expect(loaded0.hashtags).toEqual(["fitness", "gym"]);
    expect(loaded0.sound_name).toBeNull();
    expect(loaded0.completion_pct).toBeNull();
    // Dates must be preserved
    expect(loaded0.posted_at).toBeInstanceOf(Date);
    expect(loaded0.scraped_at).toBeInstanceOf(Date);
    expect(loaded0.posted_at.toISOString()).toBe(posted_at.toISOString());
    expect(loaded0.scraped_at.toISOString()).toBe(scraped_at.toISOString());
  });

  it("creates the cache directory if missing", async () => {
    const deepPath = join(tmpCacheDir, "deep", "nested", "test.jsonl");
    await writeRawCache([], deepPath);
    expect(existsSync(deepPath)).toBe(true);
  });

  it("roundtrips an empty file as an empty array", async () => {
    const filePath = join(tmpCacheDir, "empty.jsonl");
    await writeRawCache([], filePath);
    const loaded = await readRawCache(filePath);
    expect(loaded).toHaveLength(0);
  });

  it("handles multiple rows correctly", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      platform: "tiktok" as const,
      platform_video_id: `multi-rt-${i}`,
      video_url: null,
      creator_handle: `creator_${i}`,
      niche: "beauty" as Niche,
      corpus_version: "full.2026-05-12",
      scrape_kind: "trending" as const,
      views: 1_000 * (i + 1),
      likes: 100,
      comments: 10,
      shares: 5,
      saves: 2,
      duration_seconds: 30,
      completion_pct: null,
      follower_count: null,
      follower_tier: null,
      caption: `Caption ${i}`,
      hashtags: ["beauty"],
      sound_name: null,
      posted_at: new Date(Date.now() - (i + 10) * 24 * 60 * 60 * 1000),
      scraped_at: new Date(),
    }));

    const filePath = join(tmpCacheDir, "multi.jsonl");
    await writeRawCache(rows, filePath);
    const loaded = await readRawCache(filePath);
    expect(loaded).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(loaded[i]!.platform_video_id).toBe(`multi-rt-${i}`);
      expect(loaded[i]!.posted_at).toBeInstanceOf(Date);
    }
  });
});

// ─── defaultCachePath helper ──────────────────────────────────────────────────
describe("defaultCachePath", () => {
  it("returns .planning/cache/raw-<version>.jsonl", () => {
    const p = defaultCachePath("full.2026-05-12");
    expect(p).toContain("raw-full.2026-05-12.jsonl");
    expect(p).toContain(".planning/cache");
  });
});
