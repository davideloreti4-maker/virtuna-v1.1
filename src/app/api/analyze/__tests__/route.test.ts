/**
 * Integration tests for /api/analyze route handler — Phase 3.
 *
 * Coverage (matches 03-03-PLAN behavior matrix):
 * - Accept-header content negotiation (PIPE-04)
 * - Cache short-circuit (CACHE-02)
 * - Stage event forwarding (PIPE-02, PIPE-03)
 * - Provenance INSERT (PIPE-05, PIPE-06, CACHE-01)
 *
 * All engine + DB layers are mocked. Route is exercised via direct POST(req) calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mock engine dependencies BEFORE importing the route
// =====================================================

vi.mock("@/lib/engine/pipeline", () => ({
  runPredictionPipeline: vi.fn(),
}));

vi.mock("@/lib/engine/aggregator", () => ({
  aggregateScores: vi.fn(),
}));

vi.mock("@/lib/engine/cache/prediction-cache", () => ({
  computeContentHash: vi.fn(() => "fake-hash-abc123"),
  lookupPredictionCache: vi.fn(),
  populatePredictionCache: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-req-id"),
}));

// =====================================================
// Mock Supabase auth + service clients
// =====================================================

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: { virtuna_tier: "pro" }, error: null })
          ),
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: { storage_retention_opted_in: false }, error: null })
          ),
        })),
      })),
    })),
  })),
}));

const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
const mockStorageRemove = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "analysis_results") {
        return { insert: mockInsert };
      }
      if (table === "usage_tracking") {
        // Route uses .select().eq().eq().eq().single() then .upsert() on this table
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: { analysis_count: 0 },
                      error: null,
                    })
                  ),
                })),
              })),
            })),
          })),
          upsert: mockUpsert,
        };
      }
      return {};
    }),
    storage: {
      from: vi.fn(() => ({ remove: mockStorageRemove })),
    },
    rpc: vi.fn(() => ({
      catch: vi.fn(() => Promise.resolve()),
    })),
  })),
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { POST } from "../route";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores } from "@/lib/engine/aggregator";
import {
  lookupPredictionCache,
  populatePredictionCache,
} from "@/lib/engine/cache/prediction-cache";
import type { StageEventCallback } from "@/lib/engine/events";

// =====================================================
// Test helpers
// =====================================================

const makeRequest = (
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  url: string = "https://example.com/api/analyze"
): Request =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const validInput = {
  input_mode: "text",
  content_text: "This is a test piece of content for analysis.",
  content_type: "video",
};

// Minimal PipelineResult shape — only what route.ts accesses.
const fakePipelineResult = {
  ruleResult: {
    matched_rules: [
      {
        rule_id: "rule-1",
        rule_name: "test rule",
        score: 8,
        max_score: 10,
        tier: "regex",
      },
    ],
  },
  warnings: [],
};

// Minimal PredictionResult shape — only what route.ts persists / returns.
const fakeFinalResult = {
  overall_score: 80,
  confidence: 0.85,
  confidence_label: "HIGH",
  is_calibrated: true,
  behavioral_predictions: {},
  feature_vector: {},
  reasoning: "fake reasoning",
  warnings: [],
  predicted_engagement: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
  factors: [],
  suggestions: [],
  rule_score: 55,
  trend_score: 30,
  gemini_score: 70,
  behavioral_score: 60,
  ml_score: 0,
  score_weights: { behavioral: 0.35, gemini: 0.25, ml: 0.15, rules: 0.15, trends: 0.10 },
  latency_ms: 1500,
  cost_cents: 0.5,
  engine_version: "3.0.0",
  gemini_model: "gemini-2.5-flash",
  deepseek_model: "deepseek-chat",
  input_mode: "text",
  has_video: false,
  signal_availability: {
    behavioral: true,
    gemini: true,
    ml: false,
    rules: true,
    trends: true,
    content_type: false,
    niche: false,
    personas: false,
  },
};

const readSSEPayload = async (res: Response): Promise<string> => {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let payload = "";
  let done = false;
  while (!done) {
    const r = await reader.read();
    if (r.value) payload += decoder.decode(r.value);
    done = r.done;
  }
  return payload;
};

// =====================================================
// Test setup
// =====================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  mockInsert.mockResolvedValue({ error: null });
  mockUpsert.mockResolvedValue({ error: null });
  mockStorageRemove.mockResolvedValue({ error: null });

  // Default: cache miss
  (lookupPredictionCache as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    null
  );

  // Default: pipeline + aggregator return the fakes
  (runPredictionPipeline as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    fakePipelineResult
  );
  (aggregateScores as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    fakeFinalResult
  );
});

// =====================================================
// PIPE-04 — Accept-header content negotiation
// =====================================================

describe("POST /api/analyze — Accept-header content negotiation (PIPE-04)", () => {
  it("returns SSE Content-Type when Accept: text/event-stream", async () => {
    const req = makeRequest(validInput, { Accept: "text/event-stream" });
    const res = await POST(req);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(res.headers.get("vary")).toContain("Accept");
    expect(res.headers.get("cache-control")).toContain("no-transform");
  });

  it("returns JSON Content-Type when Accept: application/json", async () => {
    const req = makeRequest(validInput, { Accept: "application/json" });
    const res = await POST(req);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.overall_score).toBe(80);
  });

  it("defaults to SSE when Accept header is missing", async () => {
    const req = makeRequest(validInput);
    const res = await POST(req);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});

// =====================================================
// CACHE-02 — Cache short-circuit
// =====================================================

describe("POST /api/analyze — cache short-circuit (CACHE-02)", () => {
  it("returns cached JSON result without invoking pipeline on cache hit", async () => {
    (lookupPredictionCache as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      fakeFinalResult
    );
    const req = makeRequest(validInput, { Accept: "application/json" });
    const res = await POST(req);
    expect(runPredictionPipeline).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual(fakeFinalResult);
  });

  it("on SSE cache hit, emits single event: complete with cached payload", async () => {
    (lookupPredictionCache as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      fakeFinalResult
    );
    const req = makeRequest(validInput, { Accept: "text/event-stream" });
    const res = await POST(req);
    expect(runPredictionPipeline).not.toHaveBeenCalled();
    const payload = await readSSEPayload(res);
    expect(payload).toContain("event: complete");
    expect(payload).toContain('"overall_score":80');
  });

  it("bypassCache=true (via query param) skips cache lookup", async () => {
    const req = makeRequest(
      validInput,
      { Accept: "application/json" },
      "https://example.com/api/analyze?bypass_cache=true"
    );
    await POST(req);
    expect(lookupPredictionCache).toHaveBeenCalledWith(
      expect.any(String),
      "user-1",
      expect.objectContaining({ bypass: true })
    );
  });
});

// =====================================================
// PIPE-02 + PIPE-03 — Stage event forwarding
// =====================================================

describe("POST /api/analyze — stage event forwarding (PIPE-02, PIPE-03)", () => {
  it("passes onStageEvent callback into runPredictionPipeline (SSE path)", async () => {
    const req = makeRequest(validInput, { Accept: "text/event-stream" });
    const res = await POST(req);
    // Drain the stream so the start() async body runs to completion.
    await readSSEPayload(res);
    expect(runPredictionPipeline).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        onStageEvent: expect.any(Function),
        bypassCache: false,
      })
    );
  });

  it("emits event: stage messages on SSE stream when pipeline fires events", async () => {
    (runPredictionPipeline as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (
        _input: unknown,
        opts: { onStageEvent?: StageEventCallback }
      ) => {
        opts.onStageEvent?.({
          type: "stage_start",
          stage: "gemini_analysis",
          wave: 1,
          timestamp_ms: 0,
        });
        opts.onStageEvent?.({
          type: "stage_end",
          stage: "gemini_analysis",
          wave: 1,
          duration_ms: 100,
          cost_cents: 0,
          ok: true,
        });
        return fakePipelineResult;
      }
    );

    const req = makeRequest(validInput, { Accept: "text/event-stream" });
    const res = await POST(req);
    const payload = await readSSEPayload(res);
    expect(payload).toContain("event: stage");
    expect(payload).toContain('"stage":"gemini_analysis"');
    expect(payload).toContain('"type":"stage_start"');
    expect(payload).toContain('"type":"stage_end"');
  });

  it("preserves legacy event: phase envelope on the SSE stream (backwards compat)", async () => {
    const req = makeRequest(validInput, { Accept: "text/event-stream" });
    const res = await POST(req);
    const payload = await readSSEPayload(res);
    expect(payload).toContain("event: phase");
  });
});

// =====================================================
// PIPE-05 + PIPE-06 + CACHE-01 — Provenance INSERT
// =====================================================

describe("POST /api/analyze — provenance INSERT (PIPE-05, PIPE-06, CACHE-01)", () => {
  it("INSERTs content_hash + signal_availability columns into analysis_results", async () => {
    const req = makeRequest(validInput, { Accept: "application/json" });
    await POST(req);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_hash: "fake-hash-abc123",
        signal_availability: expect.objectContaining({
          behavioral: true,
          gemini: true,
        }),
        engine_version: "3.0.0",
      })
    );
  });

  it("hydrates L1 cache after successful INSERT (bypass=false on default path)", async () => {
    const req = makeRequest(validInput, { Accept: "application/json" });
    await POST(req);
    expect(populatePredictionCache).toHaveBeenCalledWith(
      "fake-hash-abc123",
      "user-1",
      expect.objectContaining({ overall_score: 80 }),
      expect.objectContaining({ bypass: false })
    );
  });

  it("propagates bypass=true to populatePredictionCache when bypass_cache=true", async () => {
    const req = makeRequest(
      validInput,
      { Accept: "application/json" },
      "https://example.com/api/analyze?bypass_cache=true"
    );
    await POST(req);
    expect(populatePredictionCache).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ bypass: true })
    );
  });

  // Phase 6 Plan 06-06 (Note 7 / Q4 RESOLVED) — analysis_results.audio_description persistence
  it("INSERTs audio_description column when finalResult.audio_description is populated", async () => {
    (aggregateScores as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...fakeFinalResult,
      audio_description: "upbeat hip-hop, 90 BPM, sampled female vocal hook",
    });
    const req = makeRequest(validInput, { Accept: "application/json" });
    await POST(req);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        audio_description: "upbeat hip-hop, 90 BPM, sampled female vocal hook",
      })
    );
  });

  it("INSERTs audio_description = null when finalResult.audio_description is null/undefined", async () => {
    // fakeFinalResult has no audio_description field → falsy ?? null path applies.
    const req = makeRequest(validInput, { Accept: "application/json" });
    await POST(req);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        audio_description: null,
      })
    );
  });
});
