/**
 * route-test-card.test.ts — a Test run remembers the chat it was started in, and the SERVER adds the
 * result card there when the run completes (2026-11-26, "Server adds the card").
 *
 * Before: the client POSTed `/api/tools/test/card` after `complete`, and that route used the chat
 * open NOW. A creator who moved to chat B mid-run got A's card in B; one who closed the app got no
 * card at all.
 *
 * The route and the card builder (lib/tools/test-card.ts) are real. The stand-ins are I/O: the
 * engine pack, the prediction cache, the Supabase clients (a scored row for the card read), the
 * thread lookup, the message write (insert-once), keyframe signing and corpus search.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@google/genai", () => ({
  Type: { STRING: "STRING", NUMBER: "NUMBER", INTEGER: "INTEGER", BOOLEAN: "BOOLEAN", ARRAY: "ARRAY", OBJECT: "OBJECT" },
}));

/** A chainable, awaitable query: every builder method returns itself; awaiting or .single() gives `result`. */
function chain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "gte", "lte", "order", "limit", "insert", "upsert", "update", "delete", "neq", "not", "or"]) {
    q[m] = vi.fn(() => q);
  }
  q.single = vi.fn(async () => result);
  q.maybeSingle = vi.fn(async () => result);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

const SCORED_ROW = {
  id: "placeholder",
  user_id: "u1",
  overall_score: 72,
  deleted_at: null,
  variants: {
    apollo: {
      dimensions: [
        { name: "hook", band: "strong", score: 87, lever: "Contrast", evidence: "Strong cold open." },
        { name: "clarity", band: "strong", score: 72, lever: "One message", evidence: "Legible." },
      ],
      rewrites: [],
    },
  },
  heatmap: {
    segments: [
      { idx: 0, t_start: 0, t_end: 3, label: "cold open", is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 3, t_end: 6, label: "setup", is_hook_zone: false, keyframe_uri: null },
    ],
    personas: [],
  },
  counterfactuals: { suggestions: [{ type: "fix", headline: "Recut the open", detail: "Front-load it.", timestamp_ms: 1000, signal_anchor: "retention" }] },
  verbatim: null,
};

let anonymous = false;
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1", is_anonymous: anonymous } }, error: null })) },
    from: vi.fn((table: string) => (table === "analysis_results" ? chain({ data: SCORED_ROW, error: null }) : chain())),
  })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => chain({ data: { analysis_count: 0 }, error: null })),
    storage: { from: vi.fn(() => ({ remove: vi.fn() })) },
    rpc: vi.fn(async () => ({ error: null })),
  })),
}));

const CHAT_A = { id: "chat-A", user_id: "u1", type: "open", reading_id: null, active_audience_id: null };
const CHAT_B = { id: "chat-B", user_id: "u1", type: "open", reading_id: null, active_audience_id: null };
const owned = new Map<string, typeof CHAT_A>([["chat-A", CHAT_A]]);
/** How many owned-chat lookups answer before the chat disappears (archived mid-run); -1: never. */
let ownedLookupsLeft = -1;
vi.mock("@/lib/threads/threads", () => ({
  // The chat open NOW (the cookie) is B: the creator moved there mid-run.
  createOpenThreadLazy: vi.fn(async () => CHAT_B),
  getOwnedOpenThread: vi.fn(async (_u: string, id: string) => {
    if (ownedLookupsLeft === 0) return null;
    if (ownedLookupsLeft > 0) ownedLookupsLeft--;
    return owned.get(id) ?? null;
  }),
}));

/** `after()` from next/server: what the route asks to be kept alive, past the response. */
const keptAlive: Promise<unknown>[] = [];
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (p: Promise<unknown>) => {
    keptAlive.push(p);
  },
}));

/** Billing: one charge per run, whatever the card does. */
const recordUsage = vi.fn(async () => {});
vi.mock("@/lib/billing/record-usage", () => ({ recordUsage: (...a: unknown[]) => recordUsage(...(a as [])) }));

/** The message write: insert-once, recorded with the frame position it happened at. */
const writes: Array<{ id: string; threadId: string; blocks: Array<{ type: string }>; beforeComplete: boolean }> = [];
let completeSent = false;
let insertFails = false;
vi.mock("@/lib/threads/messages", () => ({
  findMessage: vi.fn(async (id: string) => (writes.some((w) => w.id === id) ? { id, body: { blocks: [] } } : null)),
  insertMessageOnce: vi.fn(async (id: string, threadId: string, _role: string, blocks: Array<{ type: string }>) => {
    if (insertFails) throw new Error("insert failed");
    if (writes.some((w) => w.id === id)) return { inserted: false, row: null };
    writes.push({ id, threadId, blocks, beforeComplete: !completeSent });
    return { inserted: true, row: {} };
  }),
}));
/** Frame signing, held open by a test to stand for a card build that hangs. */
let framesGate: Promise<void> | null = null;
vi.mock("@/lib/engine/filmstrip/storage", () => ({
  signAnalysisFrames: vi.fn(async () => {
    if (framesGate) await framesGate;
    return {};
  }),
}));
vi.mock("@/lib/grounding/corpus-tool", () => ({
  executeCorpusSearch: vi.fn(async () => ({ content: "", examples: [], citable: [], record: {} })),
}));
vi.mock("@/lib/grounding/retrieve", () => ({ retrieveCachedExamples: vi.fn() }));

const RESULT = {
  overall_score: 0.72, confidence: 0.5, confidence_label: "MEDIUM", is_calibrated: false, behavioral_predictions: null,
  feature_vector: null, reasoning: "", warnings: [], predicted_engagement: null, factors: [], suggestions: [], rule_score: 0,
  trend_score: 0, gemini_score: 0, behavioral_score: 0, ml_score: 0, score_weights: {}, latency_ms: 100, cost_cents: 1,
  engine_version: "test", gemini_model: "x", deepseek_model: null, input_mode: "tiktok_url", has_video: true,
  signal_availability: {}, persona_behavioral_aggregate: null, persona_simulation_results: null, retrieval_score: 0,
  retrieval_evidence: [], platform_fit: null,
};
vi.mock("@/lib/engine/packs", () => ({
  resolvePack: () => ({
    run: vi.fn(async () => ({ warnings: [], video_storage_path: null })),
    scoring: { run: vi.fn(async () => RESULT) },
  }),
}));
let cacheHit: Record<string, unknown> | null = null;
vi.mock("@/lib/engine/cache/prediction-cache", () => ({
  computeContentHash: vi.fn(() => "hash"),
  lookupPredictionCache: vi.fn(async () => cacheHit),
  populatePredictionCache: vi.fn(),
}));

import { testCardTiming, testCardMessageId } from "@/lib/tools/test-card";

beforeEach(() => {
  writes.length = 0;
  keptAlive.length = 0;
  completeSent = false;
  insertFails = false;
  framesGate = null;
  cacheHit = null;
  anonymous = false;
  ownedLookupsLeft = -1;
  recordUsage.mockClear();
  testCardTiming.waitMs = 8000;
});

async function run(body: Record<string, unknown>): Promise<string> {
  const { POST } = await import("@/app/api/analyze/route");
  const res = await POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input_mode: "tiktok_url", tiktok_url: "https://www.tiktok.com/@creator/video/123", content_type: "video", ...body }),
    }),
  );
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value);
    if (chunk.includes("event: complete")) completeSent = true;
    out += chunk;
  }
  return out;
}

describe("POST /api/analyze — the server adds the Test card to the run's own chat", () => {
  it("started in chat A, the creator is in chat B now: the card lands in A before `complete`, B gets nothing", async () => {
    const frames = await run({ thread_id: "chat-A" });
    expect(frames).toContain("event: complete");
    expect(writes.map((w) => w.threadId)).toEqual(["chat-A"]);
    expect(writes[0]!.blocks.map((b) => b.type)).toEqual(["run-header", "video-test-card"]);
    // Written before `complete`, so a client seal that follows finds it and adds nothing.
    expect(writes[0]!.beforeComplete).toBe(true);
  });

  it("no client seal at all (the app was closed): the card is still written, by the server alone", async () => {
    await run({ thread_id: "chat-A" });
    expect(writes).toHaveLength(1);
  });

  it("a run that names no chat (the board, the funnel): no card from the server, as before", async () => {
    await run({});
    expect(writes).toHaveLength(0);
  });

  it("a chat that is not the caller's own: ignored, no card anywhere", async () => {
    await run({ thread_id: "someone-elses" });
    expect(writes).toHaveLength(0);
  });

  it("the chat was archived mid-run (gone by the end): no card", async () => {
    ownedLookupsLeft = 1; // the start finds it, the end does not
    await run({ thread_id: "chat-A" });
    expect(writes).toHaveLength(0);
  });

  it("a sealed visitor (the /go funnel): no server card", async () => {
    anonymous = true;
    await run({ thread_id: "chat-A" });
    expect(writes).toHaveLength(0);
  });
});

describe("POST /api/analyze — the card never holds `complete` back, and the run outlives the tab", () => {
  it("a card build that hangs: `complete` still goes out at the wait, and the card lands when the build ends", async () => {
    testCardTiming.waitMs = 50;
    let releaseFrames: () => void = () => {};
    framesGate = new Promise<void>((r) => (releaseFrames = r));
    const t0 = Date.now();
    const frames = await run({ thread_id: "chat-A" });
    expect(frames).toContain("event: complete");
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(writes).toHaveLength(0); // still building
    releaseFrames();
    await Promise.all(keptAlive);
    expect(writes.map((w) => w.threadId)).toEqual(["chat-A"]);
  });

  it("the run (and its card) is registered with after(): the function lives until both are done", async () => {
    await run({ thread_id: "chat-A" });
    expect(keptAlive.length).toBeGreaterThan(0);
    await Promise.all(keptAlive);
    expect(writes).toHaveLength(1);
  });

  it("billing: one charge per run, and none extra when the card fails", async () => {
    await run({ thread_id: "chat-A" });
    expect(recordUsage).toHaveBeenCalledTimes(1);
    insertFails = true;
    const frames = await run({ thread_id: "chat-A", run_nonce: "run-2" });
    expect(frames).toContain("event: complete");
    expect(recordUsage).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/analyze — a run's own nonce", () => {
  it("the same video run again in the same chat: each run gets its card", async () => {
    await run({ thread_id: "chat-A", run_nonce: "run-1" });
    await run({ thread_id: "chat-A", run_nonce: "run-2" });
    expect(writes).toHaveLength(2);
  });

  it("a cache hit (the same analysis, no new row) still gets its card, under this run's nonce", async () => {
    cacheHit = { ...RESULT, id: "an-cached" };
    const frames = await run({ thread_id: "chat-A", run_nonce: "run-3" });
    expect(frames).toContain("event: complete");
    await Promise.all(keptAlive);
    expect(writes.map((w) => [w.id, w.threadId])).toEqual([[testCardMessageId("an-cached", "chat-A", "run-3"), "chat-A"]]);
    expect(recordUsage).not.toHaveBeenCalled(); // a cache hit is not a new Reading
  });
});
