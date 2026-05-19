/**
 * Unit tests for src/lib/engine/wave3.ts — Phase 7 Plan 07-02b orchestration.
 *
 * Mirrors `wave0-niche-detector.test.ts` for OpenAI mocking + env-vars-before-import.
 * Uses `vi.mock("../deepseek", async (importOriginal) => ...)` to mock `isCircuitOpen`
 * while preserving the rest of the deepseek module (W-3 importOriginal pattern).
 *
 * Test surface (12 tests):
 *   1 — fires exactly 10 parallel deepseek-chat calls (PERSONA-01)
 *   2 — successful Wave3Outcome.results carries 10 entries with the full PersonaSimulationResult shape (PERSONA-11)
 *   3 — D-13 threshold met (7/10 succeed) → aggregate non-null + 3 failure warnings
 *   4 — D-13 threshold not met (5/10 succeed) → aggregate null + wave_3_below_threshold (5/7)
 *   5 — Promise.allSettled isolation: rejections don't cancel others; all 10 attempted
 *   6 — D-18 cost telemetry: wave-level stage_end carries non-negative cost_cents
 *   7 — PIPE-08 events: 22 stage events fire when all 10 succeed (10 per-persona pairs + 1 wave pair)
 *   8 — PERSONA-09 env override: DEEPSEEK_PERSONA_MODEL=custom-model routed to OpenAI client
 *   9 — D-17 cache stability: identical inputs → identical system prompt bytes per slot
 *  10 — Pitfall 5 retry-once on validation failure → 11 total mockCreate calls
 *  11 — AbortError no-retry: timeout → no retry, slot fails after first attempt
 *  12 — W-3 circuit-breaker fast-fail: 0 calls fire when isCircuitOpen()==true
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentPayload, Wave0Result } from "../types";
import type { CreatorContext } from "../creator";
import type { StageEvent } from "../events";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// vi.mock factories are hoisted; use vi.hoisted to share refs safely.
const { mockCreate, mockIsCircuitOpen } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockIsCircuitOpen: vi.fn(() => false),
}));

vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

// W-3: mock isCircuitOpen while preserving other deepseek.ts exports (importOriginal).
vi.mock("../deepseek", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../deepseek")>();
  return { ...orig, isCircuitOpen: mockIsCircuitOpen };
});

process.env.DEEPSEEK_API_KEY = "test-key";

import { runWave3 } from "../wave3";

// =====================================================
// Test fixtures
// =====================================================

function makePayload(): ContentPayload {
  return {
    content_text: "test caption",
    content_type: "video",
    input_mode: "text",
    video_url: null,
    video_storage_path: null,
    hashtags: ["beauty"],
    duration_hint: 30,
    niche: null,
    creator_handle: null,
    society_id: null,
  };
}

function makeWave0Result(): Wave0Result {
  return {
    content_type: { type: "slideshow", confidence: 0.85 },
    niche: {
      primary: "beauty",
      sub: "skincare",
      micro: null,
      confidence: 0.9,
      source: "ai",
    },
  };
}

function makeCreatorContext(): CreatorContext {
  return {
    found: false,
    follower_count: null,
    avg_views: null,
    engagement_rate: null,
    niche: null,
    posting_frequency: null,
    platform_averages: {
      avg_views: 50_000,
      avg_engagement_rate: 0.06,
      avg_share_rate: 0.02,
      avg_comment_rate: 0.01,
    },
    target_platforms: null,
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
  };
}

function mockPersonaResponse(
  overrides: Partial<{
    scroll_past_second: number;
    watch_through_pct: number;
    comment_intent: number;
    share_intent: number;
    save_intent: number;
    reasoning: string;
  }> = {},
) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            scroll_past_second: 5,
            watch_through_pct: 80,
            comment_intent: 20,
            share_intent: 30,
            save_intent: 70,
            reasoning: "default test reasoning",
            ...overrides,
          }),
        },
      },
    ],
    usage: {
      prompt_tokens: 3000,
      prompt_cache_hit_tokens: 2500,
      prompt_cache_miss_tokens: 500,
      completion_tokens: 150,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCircuitOpen.mockReturnValue(false);
});

// =====================================================
// Test suite
// =====================================================

describe("runWave3 — Phase 7 orchestration (Plan 07-02b)", () => {
  it("Test 1 (PERSONA-01): fires exactly 10 parallel deepseek-chat calls", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    expect(mockCreate.mock.calls.length).toBe(10);
  });

  it("Test 2 (PERSONA-11): all-succeed → 10 results with full PersonaSimulationResult shape", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    const outcome = await runWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
    );
    expect(outcome.results.length).toBe(10);
    for (const r of outcome.results) {
      expect(r.persona_id).toBeTruthy();
      expect(r.archetype).toBeTruthy();
      expect(r.slot_type).toBeTruthy();
      expect(r.niche).toBeTruthy();
      expect(typeof r.scroll_past_second).toBe("number");
      expect(typeof r.watch_through_pct).toBe("number");
      expect(typeof r.comment_intent).toBe("number");
      expect(typeof r.share_intent).toBe("number");
      expect(typeof r.save_intent).toBe("number");
      expect(typeof r.reasoning).toBe("string");
      expect(r.reasoning.length).toBeGreaterThan(0);
    }
  });

  it("Test 3 (D-13 threshold met): 7 succeed / 3 fail → aggregate non-null + 3 failure warnings", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n <= 7) return Promise.resolve(mockPersonaResponse());
      return Promise.reject(new Error("simulated failure"));
    });
    const outcome = await runWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
    );
    expect(outcome.aggregate).not.toBeNull();
    expect(outcome.results.length).toBe(7);
    const failureWarnings = outcome.warnings.filter((w) =>
      w.startsWith("Persona "),
    );
    expect(failureWarnings.length).toBe(3);
  });

  it("Test 4 (D-13 threshold not met): 5 succeed / 5 fail → aggregate null + below-threshold warning", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n <= 5) return Promise.resolve(mockPersonaResponse());
      return Promise.reject(new Error("simulated failure"));
    });
    const outcome = await runWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
    );
    expect(outcome.aggregate).toBeNull();
    expect(
      outcome.warnings.some((w) => w.includes("wave_3_below_threshold (5/7)")),
    ).toBe(true);
  });

  it("Test 5 (Promise.allSettled isolation): rejections don't stop other calls — 10 attempted", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      // Reject every other call
      if (n % 2 === 0) return Promise.reject(new Error("alternating failure"));
      return Promise.resolve(mockPersonaResponse());
    });
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    expect(mockCreate.mock.calls.length).toBe(10);
  });

  it("Test 6 (D-18 cost telemetry): wave-level stage_end carries non-negative cost_cents", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    const events: StageEvent[] = [];
    await runWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
      (e) => events.push(e),
    );
    const waveEnd = events.find(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas",
    );
    expect(waveEnd).toBeDefined();
    if (waveEnd && waveEnd.type === "stage_end") {
      expect(waveEnd.cost_cents).toBeGreaterThanOrEqual(0);
    }
  });

  it("Test 7 (PIPE-08 events): all-succeed fires 22 stage events (10 per-persona pairs + 1 wave pair)", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    const events: StageEvent[] = [];
    await runWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
      (e) => events.push(e),
    );
    expect(events.length).toBe(22);
    const starts = events.filter((e) => e.type === "stage_start");
    const ends = events.filter((e) => e.type === "stage_end");
    expect(starts.length).toBe(11);
    expect(ends.length).toBe(11);
    // Per-persona stage names follow the wave_3_persona_${archetype}_${slot_type} pattern.
    const perPersonaStarts = starts.filter(
      (e) =>
        e.type === "stage_start" &&
        (e as { stage: string }).stage.startsWith("wave_3_persona_"),
    );
    expect(perPersonaStarts.length).toBe(10);
  });

  it("Test 8 (PERSONA-09): DEEPSEEK_PERSONA_MODEL env override routes to OpenAI client", async () => {
    const prev = process.env.DEEPSEEK_PERSONA_MODEL;
    process.env.DEEPSEEK_PERSONA_MODEL = "custom-model";
    vi.resetModules();
    // Re-establish the deepseek mock for the freshly imported module graph.
    vi.doMock("../deepseek", async (importOriginal) => {
      const orig = await importOriginal<typeof import("../deepseek")>();
      return { ...orig, isCircuitOpen: () => false };
    });
    vi.doMock("openai", () => {
      const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
        this.chat = { completions: { create: mockCreate } };
      });
      return { default: MockOpenAI };
    });
    const { runWave3: freshRunWave3 } = await import("../wave3");
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    await freshRunWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
    );
    for (const call of mockCreate.mock.calls) {
      expect((call[0] as { model: string }).model).toBe("custom-model");
    }
    if (prev === undefined) delete process.env.DEEPSEEK_PERSONA_MODEL;
    else process.env.DEEPSEEK_PERSONA_MODEL = prev;
    vi.doUnmock("../deepseek");
    vi.doUnmock("openai");
  });

  it("Test 9 (D-17 cache stability): identical inputs → identical per-slot system prompts across invocations", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    const firstCallSystem = (mockCreate.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    }).messages[0]!.content;
    // Second invocation — same slot 0 → identical system prompt bytes (DeepSeek cache prefix).
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    const secondInvocationFirstCallSystem = (mockCreate.mock.calls[10]![0] as {
      messages: Array<{ role: string; content: string }>;
    }).messages[0]!.content;
    expect(secondInvocationFirstCallSystem).toBe(firstCallSystem);
  });

  it("Test 10 (Pitfall 5 retry-once on validation failure): retry once → 11 total calls", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      // First call returns invalid JSON (missing required fields).
      if (n === 1) {
        return Promise.resolve({
          choices: [{ message: { content: JSON.stringify({}) } }],
          usage: { prompt_tokens: 100, completion_tokens: 10 },
        });
      }
      return Promise.resolve(mockPersonaResponse());
    });
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    // Original 10 calls + 1 retry on the first slot = 11 total.
    expect(mockCreate.mock.calls.length).toBe(11);
  });

  it("Test 11 (AbortError no-retry): AbortError fails the slot without retry", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n === 1) {
        const err = new Error("Aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }
      return Promise.resolve(mockPersonaResponse());
    });
    const outcome = await runWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
    );
    // No retry attempted → exactly 10 calls fired (one of which failed).
    expect(mockCreate.mock.calls.length).toBe(10);
    expect(outcome.results.length).toBe(9);
  });

  it("Test 12 (W-3 circuit-breaker fast-fail): isCircuitOpen==true → 0 calls + below-threshold warning", async () => {
    mockIsCircuitOpen.mockReturnValue(true);
    const outcome = await runWave3(
      makePayload(),
      null,
      makeWave0Result(),
      makeCreatorContext(),
    );
    expect(mockCreate.mock.calls.length).toBe(0);
    expect(outcome.aggregate).toBeNull();
    expect(outcome.results).toEqual([]);
    expect(outcome.warnings).toContain("wave_3_circuit_breaker_open");
  });
});
