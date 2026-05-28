/**
 * Phase 8 Plan 04 — runBenchmarkRetrieval integration tests.
 *
 * Covers all 12 behaviors specified in 08-04-PLAN.md Task 1:
 *   1. Happy path Tier 1 only (5 matches)
 *   2. Tier 1 returns 3 + Tier 2 returns 2 → mixed relaxed_to tags
 *   3. All tiers return 0 → graceful empty
 *   4. Corpus returns 0, scraped fills 5
 *   5. min_corpus_size gate fires (evidence preserved, score=null, availability=false)
 *   6. wave0Result.niche null → early graceful return, no embedder call
 *   7. embedder throws → outer catch, graceful empty
 *   8. RPC throws → graceful empty
 *   9. D-03 score formula: similarity-weighted bucket vote (concrete numeric)
 *  10. stage_start + stage_end events emit with correct stage/wave
 *  11. RetrievalEvidenceItem.similarity_score is RAW cosine (NOT boosted rerank_score)
 *  12. Corpus niche alias: 'education' → 'edu' for training_corpus, 'education' for scraped_videos
 */

// =====================================================
// Mocks — must come BEFORE imports per vitest hoisting rules
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Mock embedder — vi.hoisted() pattern lets us reference these from inside vi.mock factories,
// which are themselves hoisted to the top of the file.
const { mockEmbedQuery, mockBuildSubjectText, mockMatchCorpus, mockMatchScraped } =
  vi.hoisted(() => ({
    mockEmbedQuery: vi.fn(),
    mockBuildSubjectText: vi.fn(
      (input: {
        primary_slug: string | null;
        creator_handle: string | null;
        caption: string | null;
        hashtags: string[] | null;
      }) => `mock-subject:${input.primary_slug ?? ""}`,
    ),
    mockMatchCorpus: vi.fn(),
    mockMatchScraped: vi.fn(),
  }));

vi.mock("@/lib/engine/retrieval/embedder", () => ({
  buildSubjectText: mockBuildSubjectText,
  embedQuery: mockEmbedQuery,
}));

vi.mock("@/lib/engine/retrieval/pgvector-client", () => ({
  matchTrainingCorpus: mockMatchCorpus,
  matchScrapedVideos: mockMatchScraped,
}));

// Mock NICHE_TREE — control benchmark_filters.min_corpus_size per test
vi.mock("@/lib/niches/taxonomy", () => ({
  NICHE_TREE: [
    {
      slug: "beauty",
      label: "Beauty",
      benchmark_filters: {
        tag_filters: ["grwm", "makeup", "skincare"],
        min_corpus_size: 3,
      },
    },
    {
      slug: "education",
      label: "Education",
      benchmark_filters: {
        tag_filters: ["learnontiktok", "edutok"],
        min_corpus_size: 3,
      },
    },
    {
      slug: "tech-gadgets",
      label: "Tech",
      benchmark_filters: {
        tag_filters: ["tech", "techtok"],
        min_corpus_size: 100, // High gate — used for Test 5
      },
    },
  ],
}));

import { runBenchmarkRetrieval } from "@/lib/engine/retrieval/retrieval-stage";
import type { MatchRow } from "@/lib/engine/retrieval/pgvector-client";
import type {
  ContentPayload,
  Wave0Result,
  BenchmarkRetrievalResult,
} from "@/lib/engine/types";
import type { CreatorContext } from "@/lib/engine/creator";
import type { StageEvent } from "@/lib/engine/events";
import type { SupabaseClient } from "@supabase/supabase-js";

// =====================================================
// Helpers
// =====================================================

function makePayload(overrides?: Partial<ContentPayload>): ContentPayload {
  return {
    content_text: "GRWM #beauty",
    content_type: "video",
    input_mode: "text",
    video_url: null,
    video_storage_path: null,
    hashtags: ["beauty", "grwm"],
    duration_hint: null,
    niche: null,
    creator_handle: "alice",
    society_id: null,
    ...overrides,
  };
}

function makeCreatorContext(
  overrides?: Partial<CreatorContext>,
): CreatorContext {
  return {
    found: true,
    follower_count: 5000, // → 'nano' tier
    avg_views: null,
    engagement_rate: null,
    niche: null,
    posting_frequency: null,
    platform_averages: {
      avg_views: 50000,
      avg_engagement_rate: 0.06,
      avg_share_rate: 0.008,
      avg_comment_rate: 0.005,
    },
    target_platforms: ["tiktok"],
    niche_primary: null,
    niche_sub: null,
    target_audience: null,
    primary_goal: null,
    creator_stage: null,
    content_style: null,
    cuts_per_second: null,
    reference_creators: null,
    past_wins: null,
    past_flops: null,
    time_of_day_aware: null,
    pain_points: null,
    ...overrides,
  };
}

function makeWave0Result(niche: string | null = "beauty"): Wave0Result {
  // D-17 (Phase 13 Plan 03): niche shape changed from { primary, sub, micro, confidence, source }
  // to { primary_slug, micro_slug, confidence }
  return {
    content_type: null,
    niche: niche
      ? {
          primary_slug: niche,
          micro_slug: null,
          confidence: 0.9,
        }
      : null,
  };
}

function makeMatchRow(
  overrides: Partial<MatchRow> = {},
): MatchRow {
  return {
    source_id: "00000000-0000-0000-0000-000000000001",
    similarity: 0.85,
    source_pool: "training_corpus",
    video_url: "https://tiktok.com/video/1",
    creator_handle: "creator1",
    caption: "Test caption",
    views: 1_000_000,
    likes: 100_000,
    shares: 5_000,
    comments: 2_000,
    saves: 10_000,
    hashtags: ["beauty", "grwm"],
    posted_at: "2026-04-01T00:00:00Z",
    bucket_label: "viral",
    niche: "beauty",
    follower_count: null,
    ...overrides,
  };
}

const fakeSupabase = {} as SupabaseClient;

// =====================================================
// Tests
// =====================================================

describe("runBenchmarkRetrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default embedder behavior
    mockEmbedQuery.mockResolvedValue({
      vector: new Array(768).fill(0.1),
      cost_cents: 0.0001,
    });
  });

  // -------------------------------------------------------
  // Test 1 — happy path Tier 1 only (5 matches)
  // -------------------------------------------------------
  it("Test 1: happy path Tier 1 only — 5 strict matches", async () => {
    const rows: MatchRow[] = Array.from({ length: 5 }, (_, i) =>
      makeMatchRow({
        source_id: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa000${i + 1}`,
        similarity: 0.9 - i * 0.05,
      }),
    );
    mockMatchCorpus.mockResolvedValueOnce(rows);
    mockMatchScraped.mockResolvedValue([]);

    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
    });

    expect(result.evidence).toHaveLength(5);
    expect(result.evidence.every((e) => e.relaxed_to === "strict")).toBe(
      true,
    );
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(0);
    expect(result.score!).toBeLessThanOrEqual(1);
    expect(result.availability).toBe(true);
    expect(result.cost_cents).toBeGreaterThan(0);
  });

  // -------------------------------------------------------
  // Test 2 — Tier 1 returns 3 + Tier 2 returns 2
  // -------------------------------------------------------
  it("Test 2: Tier 1 returns 3 + Tier 2 returns 2 → mixed relaxed_to tags", async () => {
    // K_REC = 10, but we only need K=5 evidence after re-rank
    // We control match counts to verify per-tier tagging.
    const tier1Rows: MatchRow[] = Array.from({ length: 3 }, (_, i) =>
      makeMatchRow({
        source_id: `11111111-aaaa-aaaa-aaaa-aaaaaaaa000${i + 1}`,
        similarity: 0.9 - i * 0.05,
      }),
    );
    const tier2Rows: MatchRow[] = Array.from({ length: 2 }, (_, i) =>
      makeMatchRow({
        source_id: `22222222-aaaa-aaaa-aaaa-aaaaaaaa000${i + 1}`,
        similarity: 0.7 - i * 0.05,
      }),
    );

    // Tier 1 corpus → 3, scraped → 0; Tier 2 corpus → 2, scraped → 0; Tier 3 → 0
    mockMatchCorpus
      .mockResolvedValueOnce(tier1Rows) // Tier 1
      .mockResolvedValueOnce(tier2Rows) // Tier 2
      .mockResolvedValueOnce([]); // Tier 3
    mockMatchScraped.mockResolvedValue([]);

    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
    });

    expect(result.evidence).toHaveLength(5);
    const strictCount = result.evidence.filter(
      (e) => e.relaxed_to === "strict",
    ).length;
    const tier2Count = result.evidence.filter(
      (e) => e.relaxed_to === "niche+platform",
    ).length;
    expect(strictCount).toBe(3);
    expect(tier2Count).toBe(2);
  });

  // -------------------------------------------------------
  // Test 3 — all tiers return 0 → graceful empty
  // -------------------------------------------------------
  it("Test 3: all tiers return 0 → evidence=[], score=null, availability=false, cost_cents>0", async () => {
    mockMatchCorpus.mockResolvedValue([]);
    mockMatchScraped.mockResolvedValue([]);

    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
    });

    expect(result.evidence).toEqual([]);
    expect(result.score).toBeNull();
    expect(result.availability).toBe(false);
    expect(result.cost_cents).toBeGreaterThan(0); // embedding cost still incurred
  });

  // -------------------------------------------------------
  // Test 4 — corpus returns 0, scraped fills 5
  // -------------------------------------------------------
  it("Test 4: corpus returns 0, scraped fills 5 — all evidence has source_pool='scraped_videos'", async () => {
    mockMatchCorpus.mockResolvedValue([]);
    const scrapedRows: MatchRow[] = Array.from({ length: 5 }, (_, i) =>
      makeMatchRow({
        source_id: `33333333-aaaa-aaaa-aaaa-aaaaaaaa000${i + 1}`,
        similarity: 0.8 - i * 0.05,
        source_pool: "scraped_videos",
        bucket_label: null, // scraped_videos has no corpus label
      }),
    );
    mockMatchScraped.mockResolvedValueOnce(scrapedRows);

    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
    });

    expect(result.evidence).toHaveLength(5);
    expect(
      result.evidence.every((e) => e.source_pool === "scraped_videos"),
    ).toBe(true);
    expect(result.evidence.every((e) => e.relaxed_to === "strict")).toBe(true);
    expect(
      result.evidence.every((e) => e.bucket_source === "derived"),
    ).toBe(true);
  });

  // -------------------------------------------------------
  // Test 5 — min_corpus_size gate fires
  // -------------------------------------------------------
  it("Test 5: min_corpus_size gate fires — evidence preserved, score=null, availability=false", async () => {
    // tech-gadgets has min_corpus_size=100 (mocked above); supply 3 rows → pool too small
    const rows: MatchRow[] = Array.from({ length: 3 }, (_, i) =>
      makeMatchRow({
        source_id: `44444444-aaaa-aaaa-aaaa-aaaaaaaa000${i + 1}`,
        similarity: 0.8 - i * 0.05,
        niche: "tech-gadgets",
      }),
    );
    mockMatchCorpus.mockResolvedValueOnce(rows).mockResolvedValue([]);
    mockMatchScraped.mockResolvedValue([]);

    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("tech-gadgets"),
      supabase: fakeSupabase,
    });

    // Evidence preserved for transparency
    expect(result.evidence.length).toBeGreaterThan(0);
    // But score nulled by gate
    expect(result.score).toBeNull();
    expect(result.availability).toBe(false);
  });

  // -------------------------------------------------------
  // Test 6 — wave0Result.niche is null → early graceful return
  // -------------------------------------------------------
  it("Test 6: wave0Result.niche null → early graceful empty, no embedder call", async () => {
    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result(null),
      supabase: fakeSupabase,
    });

    expect(result.evidence).toEqual([]);
    expect(result.score).toBeNull();
    expect(result.availability).toBe(false);
    expect(result.cost_cents).toBe(0);
    expect(mockEmbedQuery).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------
  // Test 7 — embedder throws → graceful empty
  // -------------------------------------------------------
  it("Test 7: embedder throws → outer catch returns graceful empty + stage_end ok:false", async () => {
    mockEmbedQuery.mockRejectedValueOnce(new Error("Gemini API down"));

    const events: StageEvent[] = [];
    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
      onEvent: (e) => events.push(e),
    });

    expect(result.evidence).toEqual([]);
    expect(result.score).toBeNull();
    expect(result.availability).toBe(false);
    const end = events.find(
      (e) => e.type === "stage_end" && e.stage === "retrieval",
    );
    expect(end).toBeDefined();
    if (end && end.type === "stage_end") {
      expect(end.ok).toBe(false);
      expect(end.warning).toMatch(/Gemini API down/);
    }
  });

  // -------------------------------------------------------
  // Test 8 — RPC throws → graceful empty (or empty pool, no score)
  // -------------------------------------------------------
  it("Test 8: RPC throws on ALL tiers → graceful empty result", async () => {
    mockMatchCorpus.mockRejectedValue(new Error("RPC failure"));
    mockMatchScraped.mockRejectedValue(new Error("RPC failure"));

    const result = await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
    });

    // Per-tier try/catch swallows the RPC error → 0 collected → score=null
    expect(result.evidence).toEqual([]);
    expect(result.score).toBeNull();
    expect(result.availability).toBe(false);
    expect(result.cost_cents).toBeGreaterThan(0); // embed still happened
  });

  // -------------------------------------------------------
  // Test 9 — D-03 score formula
  // -------------------------------------------------------
  it("Test 9: D-03 score formula — Σ(sim·bucket_value)/Σ(sim) = 0.731", async () => {
    // 2 viral (sim=0.8) + 1 average (sim=0.6) + 1 under (sim=0.4)
    // numerator = 0.8*1.0 + 0.8*1.0 + 0.6*0.5 + 0.4*0.0 = 1.9
    // denominator = 0.8 + 0.8 + 0.6 + 0.4 = 2.6
    // → 1.9 / 2.6 ≈ 0.7307692307...
    const rows: MatchRow[] = [
      makeMatchRow({
        source_id: "55555555-aaaa-aaaa-aaaa-aaaaaaaa0001",
        similarity: 0.8,
        bucket_label: "viral",
        hashtags: [], // no hashtag overlap → no rerank bonus on sort tie
      }),
      makeMatchRow({
        source_id: "55555555-aaaa-aaaa-aaaa-aaaaaaaa0002",
        similarity: 0.8,
        bucket_label: "viral",
        hashtags: [],
      }),
      makeMatchRow({
        source_id: "55555555-aaaa-aaaa-aaaa-aaaaaaaa0003",
        similarity: 0.6,
        bucket_label: "average",
        hashtags: [],
      }),
      makeMatchRow({
        source_id: "55555555-aaaa-aaaa-aaaa-aaaaaaaa0004",
        similarity: 0.4,
        bucket_label: "under",
        hashtags: [],
      }),
    ];
    mockMatchCorpus.mockResolvedValueOnce(rows).mockResolvedValue([]);
    mockMatchScraped.mockResolvedValue([]);

    const result = await runBenchmarkRetrieval({
      payload: makePayload({ hashtags: [] }),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
    });

    expect(result.score).not.toBeNull();
    expect(result.score!).toBeCloseTo(1.9 / 2.6, 4);
  });

  // -------------------------------------------------------
  // Test 10 — stage events
  // -------------------------------------------------------
  it("Test 10: stage_start + stage_end events emit with stage='retrieval', wave=1", async () => {
    mockMatchCorpus.mockResolvedValue([]);
    mockMatchScraped.mockResolvedValue([]);

    const events: StageEvent[] = [];
    await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
      onEvent: (e) => events.push(e),
    });

    const start = events.find(
      (e) => e.type === "stage_start" && e.stage === "retrieval",
    );
    const end = events.find(
      (e) => e.type === "stage_end" && e.stage === "retrieval",
    );
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    if (start && start.type === "stage_start") {
      expect(start.wave).toBe(1);
    }
    if (end && end.type === "stage_end") {
      expect(end.wave).toBe(1);
      expect(end.cost_cents).toBeGreaterThanOrEqual(0);
    }
  });

  // -------------------------------------------------------
  // Test 11 — similarity_score is RAW cosine (not rerank_score)
  // -------------------------------------------------------
  it("Test 11: persisted similarity_score is RAW cosine, NOT boosted rerank_score", async () => {
    // Single item with hashtag overlap → re-ranker would add +0.05 bonus to sort key
    const row = makeMatchRow({
      source_id: "66666666-aaaa-aaaa-aaaa-aaaaaaaa0001",
      similarity: 0.7,
      hashtags: ["grwm", "makeup"], // overlaps with NICHE_TREE tag_filters for beauty
    });
    mockMatchCorpus.mockResolvedValueOnce([row]).mockResolvedValue([]);
    mockMatchScraped.mockResolvedValue([]);

    const result = await runBenchmarkRetrieval({
      payload: makePayload({ hashtags: ["grwm"] }),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("beauty"),
      supabase: fakeSupabase,
    });

    expect(result.evidence).toHaveLength(1);
    // Raw cosine 0.7 — NOT 0.75 (which would be 0.7 + 0.05 hashtag boost)
    expect(result.evidence[0]!.similarity_score).toBe(0.7);
  });

  // -------------------------------------------------------
  // Test 12 — corpus niche alias (education → edu)
  // -------------------------------------------------------
  it("Test 12: education alias — matchTrainingCorpus called with niche='edu', matchScrapedVideos with 'education'", async () => {
    mockMatchCorpus.mockResolvedValue([]);
    mockMatchScraped.mockResolvedValue([]);

    await runBenchmarkRetrieval({
      payload: makePayload(),
      creatorContext: makeCreatorContext(),
      wave0Result: makeWave0Result("education"),
      supabase: fakeSupabase,
    });

    expect(mockMatchCorpus).toHaveBeenCalledWith(
      fakeSupabase,
      expect.objectContaining({ niche: "edu" }),
    );
    expect(mockMatchScraped).toHaveBeenCalledWith(
      fakeSupabase,
      expect.objectContaining({ niche: "education" }),
    );
  });
});

// Type assertion to silence "BenchmarkRetrievalResult unused"
const _typeProbe: BenchmarkRetrievalResult | null = null;
void _typeProbe;
