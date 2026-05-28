/**
 * Unit tests for retrieval/embedder.ts — D-06 subject formula determinism,
 * Gemini embedContent contract (mocked), and dimensionality validation.
 *
 * Mocks all external IO: @sentry/nextjs, @/lib/logger, @google/genai.
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

const mockEmbedContent = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { embedContent: mockEmbedContent };
  });
  return { GoogleGenAI: MockGoogleGenAI };
});

import {
  buildSubjectText,
  embedQuery,
  embedBatch,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
} from "@/lib/engine/corpus/embedder";

describe("buildSubjectText (D-06)", () => {
  it("produces byte-identical output for identical inputs", () => {
    const a = buildSubjectText({
      primary_slug: "beauty",
      creator_handle: "Charli",
      caption: "GRWM!",
      hashtags: ["fyp", "makeup"],
    });
    const b = buildSubjectText({
      primary_slug: "beauty",
      creator_handle: "Charli",
      caption: "GRWM!",
      hashtags: ["fyp", "makeup"],
    });
    expect(a).toBe(b);
    expect(a).toBe("[niche:beauty] @charli: GRWM!\n#fyp #makeup");
  });

  it("treats null fields as empty strings", () => {
    expect(
      buildSubjectText({
        primary_slug: "tech-gadgets",
        creator_handle: null,
        caption: null,
        hashtags: null,
      }),
    ).toBe("[niche:tech-gadgets] @: \n");
  });

  it("truncates caption to 500 chars", () => {
    const long = "x".repeat(600);
    const out = buildSubjectText({
      primary_slug: "comedy",
      creator_handle: "user",
      caption: long,
      hashtags: [],
    });
    expect(out).toContain("x".repeat(500));
    expect(out).not.toContain("x".repeat(501));
  });

  it("lowercases the handle", () => {
    const out = buildSubjectText({
      primary_slug: "fitness",
      creator_handle: "Charli_DAMELIO",
      caption: "hi",
      hashtags: [],
    });
    expect(out).toContain("@charli_damelio:");
  });

  it("treats null primary_slug as empty string", () => {
    const out = buildSubjectText({
      primary_slug: null,
      creator_handle: "abc",
      caption: "hello",
      hashtags: ["tag1"],
    });
    expect(out).toBe("[niche:] @abc: hello\n#tag1");
  });

  it("space-joins hashtags with # prefix", () => {
    const out = buildSubjectText({
      primary_slug: "beauty",
      creator_handle: "user",
      caption: "",
      hashtags: ["a", "b", "c"],
    });
    expect(out).toContain("#a #b #c");
  });
});

// DEFERRED to M2 (per FINAL-VALIDATION-REPORT 13): embedder calls intentionally
// throw "Embedding deferred to M2" until a DashScope re-embedding job lands.
// Retrieval weight is 0 in M1 so callers degrade gracefully; these unit tests
// document contract that the production module no longer implements.
describe.skip("embedQuery (deferred to M2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("calls embedContent with RETRIEVAL_QUERY task type and 768 dims", async () => {
    const mockVec = new Array(EMBEDDING_DIM).fill(0).map((_, i) => Math.sin(i));
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: mockVec }],
    });
    const result = await embedQuery("hello world");
    expect(result.vector).toHaveLength(EMBEDDING_DIM);
    expect(result.cost_cents).toBeGreaterThan(0);
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: EMBEDDING_MODEL,
        contents: ["hello world"],
        config: expect.objectContaining({
          outputDimensionality: 768,
          taskType: "RETRIEVAL_QUERY",
        }),
      }),
    );
  });

  it("throws when response shape is wrong (too few dims)", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [1, 2, 3] }],
    });
    await expect(embedQuery("hi")).rejects.toThrow(
      /Embedding response shape unexpected/,
    );
  });

  it("throws when embeddings array is empty", async () => {
    mockEmbedContent.mockResolvedValueOnce({ embeddings: [] });
    await expect(embedQuery("hi")).rejects.toThrow(
      /Embedding response shape unexpected/,
    );
  });

  it("computes positive cost_cents for non-empty text", async () => {
    const mockVec = new Array(EMBEDDING_DIM).fill(0);
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: mockVec }],
    });
    // 100 chars → est 25 tokens → 25 * 0.15 / 1M * 100 = 0.000375 cents
    const result = await embedQuery("x".repeat(100));
    expect(result.cost_cents).toBeGreaterThan(0);
    expect(result.cost_cents).toBeLessThan(1); // sanity
  });
});

describe.skip("embedBatch (deferred to M2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("calls embedContent with RETRIEVAL_DOCUMENT task type for arrays", async () => {
    const mockVec = new Array(EMBEDDING_DIM).fill(0);
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: mockVec }, { values: mockVec }],
    });
    const result = await embedBatch(["a", "b"]);
    expect(result.vectors).toHaveLength(2);
    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: ["a", "b"],
        config: expect.objectContaining({
          taskType: "RETRIEVAL_DOCUMENT",
        }),
      }),
    );
  });

  it("returns empty result for empty input without calling SDK", async () => {
    const result = await embedBatch([]);
    expect(result.vectors).toEqual([]);
    expect(result.cost_cents).toBe(0);
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it("rejects batches over 100 texts", async () => {
    await expect(embedBatch(new Array(101).fill("x"))).rejects.toThrow(
      /sync batch limit is 100/,
    );
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it("throws when vectors.length !== texts.length", async () => {
    const mockVec = new Array(EMBEDDING_DIM).fill(0);
    // Mock 3 responses for retry attempts (call retries up to MAX_RETRIES=2 → 3 total)
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: mockVec }], // only 1 embedding for 2 texts
    });
    await expect(embedBatch(["a", "b"])).rejects.toThrow(
      /batch shape unexpected/,
    );
  });

  it("throws when any vector has wrong dimensionality", async () => {
    const goodVec = new Array(EMBEDDING_DIM).fill(0);
    const badVec = new Array(100).fill(0);
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: goodVec }, { values: badVec }],
    });
    await expect(embedBatch(["a", "b"])).rejects.toThrow(
      /batch dim unexpected/,
    );
  });
});
