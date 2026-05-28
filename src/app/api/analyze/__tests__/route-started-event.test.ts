/**
 * Plan 01-02 T3 — assertions for POST /api/analyze event:started frame
 * (Pitfall #6 Option A — placeholder row INSERT + first SSE frame is event:started).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Sentry to avoid Next.js client/edge runtime probes during route import.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// @google/genai not installed in this worktree (pre-existing — see 01-01-SUMMARY
// deferred issues). schemas.ts only uses `Type` enum which we stub minimally.
vi.mock("@google/genai", () => ({
  Type: {
    STRING: "STRING",
    NUMBER: "NUMBER",
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
    OBJECT: "OBJECT",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    })),
  })),
}));

// Single service-mock object so spies on .from(...) survive across the route call.
const fromSpy = vi.fn(() => ({
  insert: vi.fn(async () => ({ error: null })),
  upsert: vi.fn(async () => ({ error: null })),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(async () => ({ data: { analysis_count: 0 }, error: null })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: fromSpy,
    storage: { from: vi.fn(() => ({ remove: vi.fn() })) },
    rpc: vi.fn(async () => ({ error: null })),
  })),
}));

vi.mock("@/lib/engine/pipeline", () => ({
  runPredictionPipeline: vi.fn(async () => ({
    warnings: [],
    payload: { input_mode: "text", content_text: "hi everyone here", content_type: "video" },
    ruleResult: { matched_rules: [] },
    wave3Result: null,
    retrievalResult: { score: 0, evidence: [] },
    personaBehavioralAggregate: null,
  })),
}));

vi.mock("@/lib/engine/aggregator", () => ({
  aggregateScores: vi.fn(async () => ({
    overall_score: 0.5,
    confidence: 0.5,
    confidence_label: "MEDIUM",
    is_calibrated: false,
    behavioral_predictions: null,
    feature_vector: null,
    reasoning: "",
    warnings: [],
    predicted_engagement: null,
    factors: [],
    suggestions: [],
    rule_score: 0,
    trend_score: 0,
    gemini_score: 0,
    behavioral_score: 0,
    ml_score: 0,
    score_weights: {},
    latency_ms: 100,
    cost_cents: 1,
    engine_version: "test",
    gemini_model: "x",
    deepseek_model: null,
    input_mode: "text",
    has_video: false,
    signal_availability: {},
    persona_behavioral_aggregate: null,
    persona_simulation_results: null,
    retrieval_score: 0,
    retrieval_evidence: [],
    platform_fit: null,
  })),
}));

vi.mock("@/lib/engine/cache/prediction-cache", () => ({
  computeContentHash: vi.fn(() => "hash"),
  lookupPredictionCache: vi.fn(async () => null),
  populatePredictionCache: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function readAllFrames(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

describe("POST /api/analyze — event:started (Pitfall #6 Option A)", () => {
  it("emits event:started with {id} as the FIRST frame BEFORE event:phase", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const req = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input_mode: "text",
        content_text: "hi everyone here",
        content_type: "video",
      }),
    });
    const res = await POST(req);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const body = await readAllFrames(res);
    const startedIdx = body.indexOf("event: started");
    const phaseIdx = body.indexOf("event: phase");
    expect(startedIdx).toBeGreaterThanOrEqual(0);
    expect(phaseIdx).toBeGreaterThan(startedIdx);
    // Started frame contains an alphanumeric id (replaces W3 fragile nanoid grep gate)
    expect(body).toMatch(/event: started\ndata: \{"id":"[a-zA-Z0-9_-]+"\}/);
  });

  it("INSERTs a placeholder row with overall_score=null BEFORE pipeline runs", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const req = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input_mode: "text",
        content_text: "hi everyone here",
        content_type: "video",
      }),
    });
    await POST(req);
    // .from("analysis_results") called at least once for placeholder insert + final upsert.
    const calls = fromSpy.mock.calls as ReadonlyArray<readonly unknown[]>;
    const analysisResultsCalls = calls.filter((c) => c[0] === "analysis_results");
    expect(analysisResultsCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT emit event:started in cache-hit branch (single complete frame stays unchanged)", async () => {
    const cache = await import("@/lib/engine/cache/prediction-cache");
    (cache.lookupPredictionCache as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      overall_score: 0.9,
      confidence: 0.9,
      confidence_label: "HIGH",
    });
    const { POST } = await import("@/app/api/analyze/route");
    const req = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input_mode: "text",
        content_text: "hi everyone here",
        content_type: "video",
      }),
    });
    const res = await POST(req);
    const body = await readAllFrames(res);
    expect(body).not.toContain("event: started");
    expect(body).toContain("event: complete");
  });
});
