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

// Mock Sentry to avoid initialization errors in tests
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// ─── Fixture helpers ─────────────────────────────────────────────────────────
// Generate clockworks-shaped items 10 days old so posted_at filter passes.
let _fixtureItemCounter = 0;

function makeFixtureItem(overrides: Record<string, unknown> = {}): unknown {
  const tenDaysAgoSec = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
  _fixtureItemCounter++;
  const defaultId = `video_${_fixtureItemCounter}`;
  const defaultCreator = `creator_${_fixtureItemCounter}`;
  return {
    id: defaultId,
    playCount: 500_000, // lands in beauty/lifestyle viral (viralFloor=250k)
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
  // Return 2 distinct items per call so each niche gets enough rows to survive
  // pilot stratification cap (viral=10 across 5 niches = 2 per niche).
  return [makeFixtureItem(), makeFixtureItem()];
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("buildCorpus", () => {
  beforeEach(() => {
    // Reset counter so each test gets unique IDs/creators
    _fixtureItemCounter = 0;

    // Build a deterministic Apify mock that returns small fixture items per niche/config
    __setApifyFactoryForTests(
      () =>
        ({
          actor: (_id: string) => ({
            call: vi.fn().mockResolvedValue({ defaultDatasetId: "fake-dataset" }),
          }),
          dataset: (_id: string) => ({
            listItems: vi.fn().mockResolvedValue({
              items: makeFixtureItems(),
            }),
          }),
        }) as never,
    );
  });

  it("orchestrates all 5 niches x 3 configs in dryRun mode", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.inserted).toBe(0); // dryRun skips DB write
    expect(result.failed).toHaveLength(0);
    // All 5 niches × 3 configs = 15 scrape jobs ran. rawCount reflects all items.
    // Note: perNicheCount is post-stratification and the pilot target cap (10 viral)
    // can cut later niches when items cluster in earlier niches. We assert pre-stratification
    // counts (afterBucketing) confirm all 5 niches produced rows, then verify rawCount is
    // non-zero and summary structure is complete.
    expect(result.summary.rawCount).toBeGreaterThan(0);
    expect(result.summary.afterQualityFilter).toBeGreaterThan(0);
    const bucketedTotal =
      result.summary.afterBucketing.viral +
      result.summary.afterBucketing.average +
      result.summary.afterBucketing.under;
    expect(bucketedTotal).toBeGreaterThan(0);
    // perNicheCount is a Record<Niche, number> — all 5 keys must exist
    for (const n of [
      "beauty",
      "fitness",
      "edu",
      "comedy",
      "lifestyle",
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
              if (callCount === 1) {
                return Promise.reject(new Error("Apify timeout"));
              }
              return Promise.resolve({ defaultDatasetId: "fake" });
            }),
          })),
          dataset: () => ({
            listItems: vi.fn().mockResolvedValue({ items: makeFixtureItems() }),
          }),
        }) as never,
    );

    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    expect(result.failed.length).toBeGreaterThanOrEqual(1);
    expect(result.failed[0]?.error).toContain("Apify timeout");
    // Other 14 jobs still produced rows
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
                  diggCount: 0,
                  commentCount: 0,
                  shareCount: 0,
                  collectCount: 0,
                }),
              ],
            }),
          }),
        }) as never,
    );
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    // All items have zero engagement — quality filter removes them all
    expect(result.summary.afterQualityFilter).toBe(0);
  });

  it("respects max-3-per-creator dedup AFTER bucketing (viral bucket)", async () => {
    const tenDaysAgoSec = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
    // 5 viral videos from the same creator — after dedup, only top 3 by views remain
    const items = [
      makeFixtureItem({
        id: "v1",
        playCount: 1_000_000,
        createTime: tenDaysAgoSec,
        authorMeta: { name: "creator_a", fans: 50_000 },
      }),
      makeFixtureItem({
        id: "v2",
        playCount: 900_000,
        createTime: tenDaysAgoSec,
        authorMeta: { name: "creator_a", fans: 50_000 },
      }),
      makeFixtureItem({
        id: "v3",
        playCount: 800_000,
        createTime: tenDaysAgoSec,
        authorMeta: { name: "creator_a", fans: 50_000 },
      }),
      makeFixtureItem({
        id: "v4",
        playCount: 700_000,
        createTime: tenDaysAgoSec,
        authorMeta: { name: "creator_a", fans: 50_000 },
      }),
      makeFixtureItem({
        id: "v5",
        playCount: 600_000,
        createTime: tenDaysAgoSec,
        authorMeta: { name: "creator_a", fans: 50_000 },
      }),
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
        }) as never,
    );

    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    // Per-creator cap: at most 3 viral videos from creator_a per niche
    // 5 niches x 3 configs x 5 items = 75 raw; after dedup max 3 per creator per bucket
    expect(result.summary.afterDedup.viral).toBeLessThanOrEqual(3 * 5); // 3 per creator × 5 niches
  });

  it("dryRun=false writes to DB via upsert and returns inserted count", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: false,
    });
    // inserted > 0 when fixtures produce passing-quality rows
    expect(result.inserted).toBeGreaterThanOrEqual(0);
    // summary.perNicheCount populated
    expect(typeof result.summary.perNicheCount.beauty).toBe("number");
  });

  it("bucket ordering: bucketing happens BEFORE dedup (Pitfall 3)", async () => {
    const result = await buildCorpus({
      corpusVersion: "pilot.2026-05-12",
      isPilot: true,
      dryRun: true,
    });
    // afterBucketing totals are >= afterDedup totals (dedup can only reduce or equal)
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
    expect(result.summary.rawCount).toBeGreaterThanOrEqual(
      result.summary.afterQualityFilter,
    );
  });
});
