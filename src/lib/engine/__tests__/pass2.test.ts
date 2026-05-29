/**
 * Phase 3 Pass 2 orchestrator — unit tests (Plan 06 Task 2).
 *
 * 15 tests:
 *   Orchestrator (12 — flipped from it.skip):
 *     1  — fires exactly 10 parallel calls with enable_thinking: true
 *     2  — all-succeed → 10 Pass2PersonaResult entries with full shape
 *     3  — 7/10 succeed → pass2_aggregate_built=true + 3 failure warnings
 *     4  — 5/10 succeed → pass2_aggregate_built=false
 *     5  — Promise.allSettled isolation — 10 attempted even with rejections
 *     6  — cost telemetry: wave_3_pass2 stage_end carries cost_cents >= 0
 *     7  — events: 22 stage events when all 10 succeed (10 per-persona pairs + 1 wave pair)
 *     8  — Zod validation failure → retry-once → 11 total API calls
 *     9  — segment count mismatch validation → persona dropped from aggregate (D-06)
 *    10  — AbortError → no retry → slot fails after first attempt
 *    11  — thinking_budget: 8000 present in every API call argument
 *    12  — D-23 telemetry: pass2_latency_ms and pass2_cost_cents logged per persona
 *
 *   persona-prompts-pass2 behavioral coverage (W5) (3 new):
 *    13  — buildPass2UserContent with all-null keyframeUris → length 1, type "text"
 *    14  — buildPass2UserContent with 3 non-null interleaved → 3 image_url items + 1 text
 *    15  — STABLE_PASS2_SYSTEM_PROMPT contains literal "EXACTLY"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StageEvent } from "../events";

// =====================================================
// Mocks (mirror wave3.test.ts mock infrastructure verbatim)
// =====================================================

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

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DASHSCOPE_API_KEY = "test-key";

import { runWave3Pass2 } from "../wave3/pass2";
import type { PersonaSimulationResult } from "../types";

// =====================================================
// Test fixture factories
// =====================================================

function makeSegments(count = 5) {
  return Array.from({ length: count }, (_, i) => ({
    idx: i,
    t_start: i * 2,
    t_end: (i + 1) * 2,
    visual_event: `event_${i}`,
    audio_event: `audio_${i}`,
    is_hook_zone: i === 0,
  }));
}

function mockPass2Response(segmentCount = 5) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            persona_id: "test-persona",
            segment_reactions: Array.from({ length: segmentCount }, (_, i) => ({
              t_start: i * 2,
              t_end: (i + 1) * 2,
              attention: 0.75,
              reason: i === 0 ? "first segment hook" : undefined,
              swipe_predicted: false,
            })),
            pass2_latency_ms: 1200,
            pass2_cost_cents: 0.3,
          }),
        },
      },
    ],
    usage: { prompt_tokens: 5000, completion_tokens: 400 },
  };
}

function makePass1Result(idx: number): PersonaSimulationResult {
  return {
    persona_id: `fyp-${idx}-high_engager-beauty`,
    archetype: "high_engager",
    slot_type: "fyp",
    niche: "beauty",
    scroll_past_second: 5,
    watch_through_pct: 80,
    comment_intent: 20,
    share_intent: 30,
    save_intent: 70,
    rewatch_intent: 40,
    reasoning: `test reasoning ${idx}`,
  };
}

function makePass1Results(count = 10): PersonaSimulationResult[] {
  return Array.from({ length: count }, (_, i) => makePass1Result(i));
}

function makeKeyframeUris(count = 5): (string | null)[] {
  return Array.from({ length: count }, () => null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =====================================================
// Test suite — Orchestrator (12 tests)
// =====================================================

describe("runWave3Pass2 — Phase 3 Pass 2 orchestrator (Plan 06)", () => {
  it("Test 1: fires exactly 10 parallel calls with enable_thinking: true", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPass2Response(5)));
    await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    expect(mockCreate.mock.calls.length).toBe(10);
    for (const call of mockCreate.mock.calls) {
      const args = call[0] as Record<string, unknown>;
      expect(args.enable_thinking).toBe(true);
    }
  });

  it("Test 2: all-succeed → 10 Pass2PersonaResult entries with full shape", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPass2Response(5)));
    const outcome = await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    expect(outcome.pass2Results.length).toBe(10);
    for (const r of outcome.pass2Results) {
      expect(r.persona_id).toBeTruthy();
      expect(r.archetype).toBeTruthy();
      expect(r.slot_type).toBeTruthy();
      expect(Array.isArray(r.segment_reactions)).toBe(true);
      expect(r.segment_reactions.length).toBe(5);
      expect(typeof r.pass2_latency_ms).toBe("number");
      expect(typeof r.pass2_cost_cents).toBe("number");
    }
  });

  it("Test 3: 7/10 succeed → pass2_aggregate_built=true + 3 failure warnings", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n <= 7) return Promise.resolve(mockPass2Response(5));
      return Promise.reject(new Error("simulated failure"));
    });
    const outcome = await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    expect(outcome.pass2_aggregate_built).toBe(true);
    expect(outcome.pass2_success_count).toBe(7);
    const failureWarnings = outcome.warnings.filter((w) => w.startsWith("Persona "));
    expect(failureWarnings.length).toBe(3);
  });

  it("Test 4: 5/10 succeed → pass2_aggregate_built=false", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n <= 5) return Promise.resolve(mockPass2Response(5));
      return Promise.reject(new Error("simulated failure"));
    });
    const outcome = await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    expect(outcome.pass2_aggregate_built).toBe(false);
    expect(outcome.pass2_success_count).toBe(5);
  });

  it("Test 5: Promise.allSettled isolation — 10 attempted even with rejections", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n % 2 === 0) return Promise.reject(new Error("alternating failure"));
      return Promise.resolve(mockPass2Response(5));
    });
    await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    expect(mockCreate.mock.calls.length).toBe(10);
  });

  it("Test 6: cost telemetry: wave_3_pass2 stage_end carries cost_cents >= 0", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPass2Response(5)));
    const events: StageEvent[] = [];
    await runWave3Pass2(
      makeSegments(5),
      makeKeyframeUris(5),
      makePass1Results(),
      undefined,
      (e) => events.push(e),
    );
    const waveEnd = events.find(
      (e) =>
        e.type === "stage_end" && (e as { stage?: string }).stage === "wave_3_pass2",
    );
    expect(waveEnd).toBeDefined();
    if (waveEnd && waveEnd.type === "stage_end") {
      expect(waveEnd.cost_cents).toBeGreaterThanOrEqual(0);
    }
  });

  it("Test 7: events: 22 stage events when all 10 succeed (10 per-persona pairs + 1 wave pair)", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPass2Response(5)));
    const events: StageEvent[] = [];
    await runWave3Pass2(
      makeSegments(5),
      makeKeyframeUris(5),
      makePass1Results(),
      undefined,
      (e) => events.push(e),
    );
    const stageEvents = events.filter(
      (e) => e.type === "stage_start" || e.type === "stage_end",
    );
    expect(stageEvents.length).toBe(22);
    const starts = stageEvents.filter((e) => e.type === "stage_start");
    const ends = stageEvents.filter((e) => e.type === "stage_end");
    expect(starts.length).toBe(11);
    expect(ends.length).toBe(11);
    const perPersonaStarts = starts.filter(
      (e) =>
        e.type === "stage_start" &&
        (e as { stage?: string }).stage?.startsWith("wave_3_pass2_persona_"),
    );
    expect(perPersonaStarts.length).toBe(10);
  });

  it("Test 8: Zod validation failure → retry-once → 11 total API calls", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n === 1) {
        // First call returns invalid Zod response (attention out of range)
        return Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  persona_id: "test",
                  segment_reactions: [{ t_start: 0, t_end: 2, attention: 99, swipe_predicted: false }],
                  pass2_latency_ms: 1000,
                  pass2_cost_cents: 0.1,
                }),
              },
            },
          ],
          usage: { prompt_tokens: 5000, completion_tokens: 400 },
        });
      }
      return Promise.resolve(mockPass2Response(5));
    });
    await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    // 10 slots: slot 0 fails on attempt 1, retries (attempt 2) → 11 total calls
    expect(mockCreate.mock.calls.length).toBe(11);
  });

  it("Test 9: segment count mismatch validation → persona dropped from aggregate (D-06)", async () => {
    // When ALL calls return a mismatch, every slot fails (with one retry attempt each).
    // D-06 guard: segment_reactions.length mismatch triggers validation failure → retry once → drops persona.
    // Result: 0 successes, pass2_aggregate_built=false.
    mockCreate.mockImplementation(() =>
      Promise.resolve({
        choices: [
          {
            message: {
              content: JSON.stringify({
                persona_id: "test",
                segment_reactions: [
                  { t_start: 0, t_end: 2, attention: 0.8, swipe_predicted: false },
                  { t_start: 2, t_end: 4, attention: 0.7, swipe_predicted: false },
                  { t_start: 4, t_end: 6, attention: 0.6, swipe_predicted: false },
                ], // only 3, but segments.length === 5 — D-06 mismatch
                pass2_latency_ms: 1000,
                pass2_cost_cents: 0.1,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 5000, completion_tokens: 400 },
      }),
    );
    const outcome = await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    // All 10 personas dropped — mismatch validation guard working
    expect(outcome.pass2_success_count).toBe(0);
    expect(outcome.pass2_aggregate_built).toBe(false);
    // Warnings contain mismatch failure messages
    const hasMismatchWarning = outcome.warnings.some(
      (w) => w.includes("mismatch") || w.includes("failed"),
    );
    expect(hasMismatchWarning).toBe(true);
    // 10 slots × 2 attempts each (retry-once on validation failure) = 20 total calls
    expect(mockCreate.mock.calls.length).toBe(20);
  });

  it("Test 10: AbortError → no retry → slot fails after first attempt", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n === 1) {
        const err = new Error("Request aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }
      return Promise.resolve(mockPass2Response(5));
    });
    await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    // AbortError on slot 0 → no retry → exactly 10 calls (no 11th)
    expect(mockCreate.mock.calls.length).toBe(10);
  });

  it("Test 11: thinking_budget: 8000 present in every API call argument", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPass2Response(5)));
    await runWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());
    expect(mockCreate.mock.calls.length).toBe(10);
    for (const call of mockCreate.mock.calls) {
      const args = call[0] as Record<string, unknown>;
      expect(args.thinking_budget).toBe(8000);
    }
  });

  it("Test 12: D-23 telemetry: pass2_latency_ms + pass2_cost_cents logged per persona", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPass2Response(5)));
    const { createLogger } = await import("@/lib/logger");
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.mocked(createLogger).mockReturnValue(mockLogger as unknown as ReturnType<typeof createLogger>);

    // Re-import with fresh module to capture mocked logger
    vi.resetModules();
    vi.doMock("openai", () => {
      const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
        this.chat = { completions: { create: mockCreate } };
      });
      return { default: MockOpenAI };
    });
    vi.doMock("@/lib/logger", () => ({
      createLogger: vi.fn(() => mockLogger),
    }));
    const { runWave3Pass2: freshRunWave3Pass2 } = await import("../wave3/pass2");

    mockCreate.mockImplementation(() => Promise.resolve(mockPass2Response(5)));
    await freshRunWave3Pass2(makeSegments(5), makeKeyframeUris(5), makePass1Results());

    // Verify that info was called with pass2_latency_ms and pass2_cost_cents
    const infoCalls = mockLogger.info.mock.calls;
    const telemetryCalls = infoCalls.filter(
      (call) =>
        typeof call[1] === "object" &&
        call[1] !== null &&
        "pass2_latency_ms" in (call[1] as Record<string, unknown>) &&
        "pass2_cost_cents" in (call[1] as Record<string, unknown>),
    );
    expect(telemetryCalls.length).toBeGreaterThan(0);
  });
});

// =====================================================
// persona-prompts-pass2 behavioral coverage (W5)
// =====================================================

describe("persona-prompts-pass2 behavioral coverage (W5)", () => {
  // Import directly from the module (pure function — no mocks needed)
  const segmentCount = 5;
  const slot = {
    persona_id: "fyp-1-tough_crowd-beauty",
    archetype: "tough_crowd" as const,
    slot_type: "fyp" as const,
    niche: "beauty",
    niche_label: "Beauty",
    archetype_definition: "You scroll past unless the hook lands hard.",
    scroll_past_triggers: ["slow openings"],
    stop_triggers: ["unusual visual hook"],
    motivator: "entertainment-seeker" as const,
    time_of_day_label: "Morning commute scroller",
    time_of_day_description: "Half-awake, scrolling on the bus.",
    niche_instantiation: "You scroll past most beauty content.",
  };

  const pass1: PersonaSimulationResult = {
    persona_id: "fyp-1-tough_crowd-beauty",
    archetype: "tough_crowd",
    slot_type: "fyp",
    niche: "beauty",
    scroll_past_second: 3,
    watch_through_pct: 45,
    comment_intent: 5,
    share_intent: 10,
    save_intent: 20,
    rewatch_intent: 15,
    reasoning: "hook didn't land fast enough",
  };

  it("Test 13: buildPass2UserContent with all-null keyframeUris → length 1, type 'text'", async () => {
    const { buildPass2UserContent } = await import("../wave3/persona-prompts-pass2");
    const result = buildPass2UserContent(slot, pass1, makeSegments(segmentCount), [null, null, null, null, null]);
    expect(result.length).toBe(1);
    expect(result[0]!.type).toBe("text");
  });

  it("Test 14: buildPass2UserContent with 3 non-null interleaved → 3 image_url items + 1 text", async () => {
    const { buildPass2UserContent } = await import("../wave3/persona-prompts-pass2");
    const result = buildPass2UserContent(
      slot,
      pass1,
      makeSegments(segmentCount),
      ["url1", null, "url2", null, "url3"],
    );
    const imageItems = result.filter((item) => item.type === "image_url");
    const textItems = result.filter((item) => item.type === "text");
    expect(imageItems.length).toBe(3);
    expect(textItems.length).toBe(1);
    expect(result.length).toBe(4);
    // image items come first, text last
    expect(result[result.length - 1]!.type).toBe("text");
  });

  it("Test 15: STABLE_PASS2_SYSTEM_PROMPT contains literal 'EXACTLY'", async () => {
    const { STABLE_PASS2_SYSTEM_PROMPT } = await import("../wave3/persona-prompts-pass2");
    expect(STABLE_PASS2_SYSTEM_PROMPT).toContain("EXACTLY");
  });
});
