/**
 * Phase 7 D-16 / D-18 cost budget regression tests.
 *
 * Mirrors `wave3.test.ts` for OpenAI mocking + env-vars-before-import.
 * Uses vi.hoisted() to share mockCreate / mockIsCircuitOpen safely with hoisted vi.mock factories.
 *
 * Covers:
 *  1 — Typical cache-mostly-warm mix produces wave-level cost ≤ 2.5 cents (D-16 ceiling)
 *  2 — All-cache-hit produces wave-level cost ≤ 0.5 cents (well under budget)
 *  3 — All-cache-miss worst case still under 2.5-cent ceiling (D-16 line 143-144 math)
 *  4 — D-18 per-call cost_cents sum to wave-level cost_cents (telemetry invariant)
 *  5 — D-18 cache-hit pricing is APPLIED (not silently falling back to cache-miss)
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

// vi.mock factories are hoisted; vi.hoisted shares refs safely with them.
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

// W-3: preserve other deepseek.ts exports while overriding isCircuitOpen.
vi.mock("../deepseek", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../deepseek")>();
  return { ...orig, isCircuitOpen: mockIsCircuitOpen };
});

process.env.DEEPSEEK_API_KEY = "test-key";

import { runWave3 } from "../wave3";

// =====================================================
// Test fixtures (mirror wave3.test.ts)
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

function mockResponseWithUsage(usage: {
  prompt_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
}) {
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
            reasoning: "test reasoning",
          }),
        },
      },
    ],
    usage,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCircuitOpen.mockReturnValue(false);
});

describe("Phase 7 D-16 cost budget (≤$0.025 / 2.5 cents per Wave 3 stage)", () => {
  it("Test 1: typical cache-mostly-warm mix produces wave-level cost ≤ 2.5 cents", async () => {
    mockCreate.mockImplementation(() =>
      Promise.resolve(
        mockResponseWithUsage({
          prompt_cache_hit_tokens: 2800,
          prompt_cache_miss_tokens: 200,
          completion_tokens: 150,
        }),
      ),
    );
    const events: StageEvent[] = [];
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext(), (e) =>
      events.push(e),
    );

    const waveEnd = events.find(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas",
    );
    expect(waveEnd).toBeDefined();
    const cost = (waveEnd as { cost_cents: number }).cost_cents;
    expect(cost).toBeLessThanOrEqual(2.5);
    expect(cost).toBeGreaterThan(0);
  });

  it("Test 2: all-cache-hit produces wave-level cost ≤ 0.5 cents (well under budget)", async () => {
    mockCreate.mockImplementation(() =>
      Promise.resolve(
        mockResponseWithUsage({
          prompt_cache_hit_tokens: 3000,
          prompt_cache_miss_tokens: 0,
          completion_tokens: 150,
        }),
      ),
    );
    const events: StageEvent[] = [];
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext(), (e) =>
      events.push(e),
    );
    const waveEnd = events.find(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas",
    );
    const cost = (waveEnd as { cost_cents: number }).cost_cents;
    expect(cost).toBeLessThanOrEqual(0.5);
  });

  it("Test 3: all-cache-miss worst case still under 2.5-cent ceiling (D-16 reference math)", async () => {
    mockCreate.mockImplementation(() =>
      Promise.resolve(
        mockResponseWithUsage({
          prompt_cache_hit_tokens: 0,
          prompt_cache_miss_tokens: 3000,
          completion_tokens: 150,
        }),
      ),
    );
    const events: StageEvent[] = [];
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext(), (e) =>
      events.push(e),
    );
    const waveEnd = events.find(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas",
    );
    const cost = (waveEnd as { cost_cents: number }).cost_cents;
    // Per CONTEXT D-16 line 143-144: 10 calls all cache-miss ≈ $0.005 total = 0.5 cents
    expect(cost).toBeLessThanOrEqual(2.5);
  });

  it("Test 4 (D-18 telemetry invariant): per-call cost_cents sum to wave-level cost_cents", async () => {
    // Mix cache patterns across the 10 calls.
    let callIndex = 0;
    mockCreate.mockImplementation(() => {
      const i = callIndex++;
      return Promise.resolve(
        mockResponseWithUsage({
          prompt_cache_hit_tokens: 2500 + i * 50,
          prompt_cache_miss_tokens: 500 - i * 50,
          completion_tokens: 150,
        }),
      );
    });
    const events: StageEvent[] = [];
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext(), (e) =>
      events.push(e),
    );

    // wave3.ts emits per-persona stages as `wave_3_persona_${archetype}_${slot_type}`.
    // startsWith("wave_3_persona_") includes the trailing underscore, which excludes
    // the wave-level `wave_3_personas` event (no trailing underscore after "personas").
    const personaEndEvents = events.filter(
      (e) =>
        e.type === "stage_end" &&
        typeof (e as { stage?: string }).stage === "string" &&
        (e as { stage: string }).stage.startsWith("wave_3_persona_"),
    );
    expect(personaEndEvents.length).toBe(10);

    const perCallSum = personaEndEvents.reduce(
      (acc, e) => acc + ((e as { cost_cents?: number }).cost_cents ?? 0),
      0,
    );
    const waveEnd = events.find(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas",
    );
    const waveCost = (waveEnd as { cost_cents: number }).cost_cents;
    // wave-level rounded to 4 decimals; per-call rounded to 6 decimals. Allow generous epsilon.
    expect(Math.abs(perCallSum - waveCost)).toBeLessThan(0.001);
  });

  it("Test 5 (D-18): cache-hit pricing is APPLIED (not silently falling back to cache-miss)", async () => {
    // First run: all cache hit
    mockCreate.mockImplementation(() =>
      Promise.resolve(
        mockResponseWithUsage({
          prompt_cache_hit_tokens: 3000,
          prompt_cache_miss_tokens: 0,
          completion_tokens: 150,
        }),
      ),
    );
    const hitEvents: StageEvent[] = [];
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext(), (e) =>
      hitEvents.push(e),
    );
    const hitCost = (hitEvents.find(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas",
    ) as { cost_cents: number }).cost_cents;

    mockCreate.mockReset();
    mockCreate.mockImplementation(() =>
      Promise.resolve(
        mockResponseWithUsage({
          prompt_cache_hit_tokens: 0,
          prompt_cache_miss_tokens: 3000,
          completion_tokens: 150,
        }),
      ),
    );
    const missEvents: StageEvent[] = [];
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext(), (e) =>
      missEvents.push(e),
    );
    const missCost = (missEvents.find(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas",
    ) as { cost_cents: number }).cost_cents;

    // Cache-hit cost should be materially cheaper than cache-miss cost.
    // Cache-hit input is ~50× cheaper than cache-miss input (DeepSeek discount), but the
    // ~150 output tokens at $0.28/M flow through unchanged in both cases, so the wave-level
    // discount is ~9× rather than 50×. We assert hitCost × 5 < missCost as a safe lower
    // bound that still proves cache pricing is APPLIED (not silently falling back to miss).
    expect(hitCost).toBeLessThan(missCost);
    expect(hitCost * 5).toBeLessThan(missCost);
  });
});
