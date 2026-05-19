/**
 * Unit tests for retrieval/re-ranker.ts —
 *  - D-04a hashtag overlap bonus (+5%)
 *  - Original similarity field UNMUTATED (D-02 persistence integrity)
 *  - Hashtag normalization (lowercase + strip leading #)
 *  - K-slicing (top-K returned sorted)
 *  - Edge cases: empty input, K=0, K=1, no overlap, all overlap, unknown niche
 *
 * Pure module — no IO. Defensively mocks logger + sentry.
 */

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

import { softRerank, HASHTAG_BONUS } from "@/lib/engine/retrieval/re-ranker";
import type { MatchRow } from "@/lib/engine/retrieval/pgvector-client";

type RankInput = MatchRow & {
  relaxed_to: "strict" | "niche+platform" | "niche_only";
};

function makeRow(overrides: Partial<RankInput>): RankInput {
  return {
    source_id: "00000000-0000-0000-0000-000000000000",
    similarity: 0.5,
    source_pool: "training_corpus",
    video_url: null,
    creator_handle: null,
    caption: null,
    views: 100,
    likes: 10,
    shares: 1,
    comments: 1,
    saves: null,
    hashtags: [],
    posted_at: null,
    bucket_label: "average",
    niche: "beauty",
    follower_count: null,
    relaxed_to: "strict",
    ...overrides,
  };
}

describe("HASHTAG_BONUS constant", () => {
  it("equals 0.05 per D-04a spec", () => {
    expect(HASHTAG_BONUS).toBe(0.05);
  });
});

describe("softRerank — hashtag overlap bonus", () => {
  it("adds +0.05 to similarity for items whose hashtags overlap with tag_filters", () => {
    // beauty tag_filters include "grwm" — overlap gets bonus.
    const a = makeRow({ source_id: "a-1", similarity: 0.7, hashtags: ["grwm"] });
    const b = makeRow({ source_id: "b-2", similarity: 0.8, hashtags: ["random"] });
    const result = softRerank([a, b], "beauty", 5);
    // a: 0.7 + 0.05 = 0.75 (overlap)
    // b: 0.8 (no overlap)
    // sort by rerank_score desc → b first (0.8), then a (0.75)
    expect(result[0]!.source_id).toBe("b-2");
    expect(result[0]!.rerank_score).toBeCloseTo(0.8, 5);
    expect(result[1]!.source_id).toBe("a-1");
    expect(result[1]!.rerank_score).toBeCloseTo(0.75, 5);
  });

  it("reverses order when bonus pushes lower-similarity item past higher", () => {
    const a = makeRow({ source_id: "a-1", similarity: 0.7, hashtags: ["grwm"] });
    const b = makeRow({ source_id: "b-2", similarity: 0.71, hashtags: [] });
    const result = softRerank([a, b], "beauty", 5);
    // a: 0.75 (bonus); b: 0.71
    expect(result[0]!.source_id).toBe("a-1");
    expect(result[1]!.source_id).toBe("b-2");
  });
});

describe("softRerank — immutability (D-02 persistence integrity)", () => {
  it("does NOT mutate the original `similarity` field on overlap", () => {
    const a = makeRow({ source_id: "a-1", similarity: 0.7, hashtags: ["grwm"] });
    const inputSimBefore = a.similarity;
    const result = softRerank([a], "beauty", 5);
    expect(result[0]!.similarity).toBe(inputSimBefore); // 0.7 preserved
    expect(result[0]!.rerank_score).toBeCloseTo(0.75, 5); // bonus on the sort key, not similarity
    // also verify the source object wasn't mutated
    expect(a.similarity).toBe(0.7);
  });
});

describe("softRerank — taxonomy lookup edge cases", () => {
  it("applies no bonus when inputNiche is not in NICHE_TREE", () => {
    const a = makeRow({
      source_id: "a-1",
      similarity: 0.7,
      hashtags: ["grwm", "makeup"],
    });
    const result = softRerank([a], "unknown-niche-xyz", 5);
    expect(result[0]!.rerank_score).toBe(0.7); // no bonus
  });

  it("applies no bonus when item has empty hashtags", () => {
    const a = makeRow({ source_id: "a-1", similarity: 0.7, hashtags: [] });
    const result = softRerank([a], "beauty", 5);
    expect(result[0]!.rerank_score).toBe(0.7);
  });

  it("treats null hashtags as empty (no bonus, no throw)", () => {
    const a = makeRow({
      source_id: "a-1",
      similarity: 0.7,
      // forced null to simulate pre-migration row
      hashtags: null as unknown as string[],
    });
    const result = softRerank([a], "beauty", 5);
    expect(result[0]!.rerank_score).toBe(0.7);
  });
});

describe("softRerank — hashtag normalization", () => {
  it("normalizes uppercase + #-prefixed hashtags to match lowercase taxonomy entries", () => {
    // beauty tag_filters include "grwm" — input has "#GRWM" which must match after normalization.
    const a = makeRow({ source_id: "a-1", similarity: 0.7, hashtags: ["#GRWM"] });
    const result = softRerank([a], "beauty", 5);
    expect(result[0]!.rerank_score).toBeCloseTo(0.75, 5); // bonus applied
  });

  it("matches even when item hashtag has mixed case + no # prefix", () => {
    const a = makeRow({
      source_id: "a-1",
      similarity: 0.7,
      hashtags: ["SkinCareRoutine"],
    });
    const result = softRerank([a], "beauty", 5);
    expect(result[0]!.rerank_score).toBeCloseTo(0.75, 5);
  });
});

describe("softRerank — K slicing", () => {
  it("returns at most K items sorted desc by rerank_score", () => {
    const items: RankInput[] = [];
    for (let i = 0; i < 8; i++) {
      items.push(
        makeRow({
          source_id: `id-${i}`,
          similarity: i * 0.1, // 0, 0.1, 0.2 ... 0.7
          hashtags: [],
        }),
      );
    }
    const result = softRerank(items, "beauty", 5);
    expect(result).toHaveLength(5);
    // descending by similarity
    const scores = result.map((r) => r.rerank_score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!);
    }
  });

  it("returns empty array when K=0", () => {
    const a = makeRow({ source_id: "a-1", similarity: 0.7 });
    expect(softRerank([a], "beauty", 0)).toEqual([]);
  });

  it("returns single item when K=1", () => {
    const a = makeRow({ source_id: "a-1", similarity: 0.7 });
    const b = makeRow({ source_id: "b-2", similarity: 0.6 });
    const result = softRerank([a, b], "beauty", 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.source_id).toBe("a-1");
  });

  it("preserves relative order when all items have overlap (all get same bonus)", () => {
    const a = makeRow({
      source_id: "a-1",
      similarity: 0.7,
      hashtags: ["grwm"],
    });
    const b = makeRow({
      source_id: "b-2",
      similarity: 0.6,
      hashtags: ["makeup"],
    });
    const result = softRerank([a, b], "beauty", 5);
    expect(result[0]!.source_id).toBe("a-1");
    expect(result[1]!.source_id).toBe("b-2");
  });

  it("returns empty array when input is empty", () => {
    expect(softRerank([], "beauty", 5)).toEqual([]);
  });
});

describe("softRerank — similarity cap at 1.0", () => {
  it("caps rerank_score at 1.0 when bonus would push over", () => {
    const a = makeRow({
      source_id: "a-1",
      similarity: 0.99,
      hashtags: ["grwm"],
    });
    const result = softRerank([a], "beauty", 5);
    expect(result[0]!.rerank_score).toBeLessThanOrEqual(1.0);
  });
});
