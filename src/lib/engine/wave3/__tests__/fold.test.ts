/**
 * runFold robustness — F18 bounded retry + F20 salvage + F19 diversity nudge (plan 01-05).
 *
 * Before 01-05 the fold was a SINGLE attempt: any transient parse/timeout hiccup → fold_success=false
 * → the audience half silently dropped; one bad persona killed all 10 (all-or-nothing); a homogenized
 * curve only warned. These tests lock the bounded retry, the salvage, and the diversity retry-nudge.
 * The 90s PER_CALL_TIMEOUT_MS ceiling is never raised (asserted by the version/grep gate, not here).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DASHSCOPE_API_KEY = "test-key";

import { runFold } from "../fold";
import type { FoldResponse } from "../fold-prompts";

// ---------------------------------------------------------------------------
// Fixtures (mirror fold-adapter.test.ts — archetype is z.string(), any set valid)
// ---------------------------------------------------------------------------
const ARCHETYPES = [
  "high_engager", "saver", "skeptic", "loyalist", "casual_scroller",
  "niche_expert", "tough_crowd", "trend_chaser", "educator_seeker", "cross_niche_curious",
] as const;
const SLOT_TYPES = ["fyp", "niche", "loyalist", "cross_niche"] as const;

function makeSegments() {
  return [
    { t_start: 0, t_end: 5, is_hook_zone: true, visual_event: "" },
    { t_start: 5, t_end: 10, is_hook_zone: false, visual_event: "" },
    { t_start: 10, t_end: 15, is_hook_zone: false, visual_event: "" },
  ];
}

/** Diverse fold (per-persona attention range ≈ 0.4 ≥ DIVERSITY_FLOOR → no diversity nudge). */
function makeFoldResponse(): FoldResponse {
  return {
    personas: ARCHETYPES.map((archetype, i) => ({
      archetype,
      persona_id: `${archetype}_01`,
      watch_through_pct: 80 - i * 2,
      share_intent: 60,
      comment_intent: 40,
      save_intent: 30,
      rewatch_intent: 20,
      scroll_past_second: 0,
      segment_reactions: [
        { attention: 0.9 - i * 0.05, swipe_predicted: false },
        { attention: 0.6 - i * 0.04, swipe_predicted: false },
        { attention: 0.4 - i * 0.03, swipe_predicted: false },
      ],
    })),
  };
}

function makeSlots() {
  return ARCHETYPES.map((archetype, i) => ({
    archetype,
    persona_id: `${archetype}_01`,
    slot_type: SLOT_TYPES[i % SLOT_TYPES.length],
    weight: 1 / ARCHETYPES.length,
  }));
}

function mockResp(fold: FoldResponse, completion = 500) {
  return {
    choices: [{ message: { content: JSON.stringify(fold) } }],
    usage: { prompt_tokens: 1000, completion_tokens: completion },
  };
}

const RUN = () => runFold(makeSlots() as never, makeSegments() as never, "hook verbatim", [], null);

describe("runFold — F18 bounded retry", () => {
  beforeEach(() => mockCreate.mockReset());

  it("one transient failure → retries once → fold_success=true", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("transient network error"))
      .mockResolvedValueOnce(mockResp(makeFoldResponse()));
    const outcome = await RUN();
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(outcome.fold_success).toBe(true);
  });

  it("two consecutive failures → graceful fold_success=false (no audience half)", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("transient failure 1"))
      .mockRejectedValueOnce(new Error("transient failure 2"));
    const outcome = await RUN();
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(outcome.fold_success).toBe(false);
    expect(outcome.personaSimResults).toHaveLength(0);
  });
});

describe("runFold — F20 salvage valid personas", () => {
  beforeEach(() => mockCreate.mockReset());

  it("salvages the valid personas when one has a segment-count mismatch (not all-or-nothing)", async () => {
    const fold = makeFoldResponse();
    fold.personas[0]!.segment_reactions = fold.personas[0]!.segment_reactions.slice(0, 2); // mismatch (2 != 3)
    mockCreate.mockResolvedValueOnce(mockResp(fold));
    const outcome = await RUN();
    expect(outcome.fold_success).toBe(true); // 9 valid ≥ MIN_VALID_PERSONAS(6) → salvaged
    expect(outcome.personaSimResults).toHaveLength(9); // the mismatched persona dropped
    expect(outcome.warnings.some((w) => w.includes("dropped") && w.includes("mismatch"))).toBe(true);
  });

  it("fails when too few valid personas remain (below the salvage floor)", async () => {
    const fold = makeFoldResponse();
    // break 6 of 10 → only 4 valid (< MIN_VALID_PERSONAS=6)
    for (let i = 0; i < 6; i++) fold.personas[i]!.segment_reactions = fold.personas[i]!.segment_reactions.slice(0, 2);
    mockCreate.mockResolvedValue(mockResp(fold)); // both attempts identical → still too few
    const outcome = await RUN();
    expect(outcome.fold_success).toBe(false);
  });
});

describe("runFold — F19 diversity retry-nudge", () => {
  beforeEach(() => mockCreate.mockReset());

  it("sub-floor diversity triggers one retry-nudge, then accepts on the final attempt", async () => {
    const flat = makeFoldResponse();
    // homogenize every curve → per-persona range 0 < DIVERSITY_FLOOR
    flat.personas.forEach((p) => p.segment_reactions.forEach((r) => (r.attention = 0.5)));
    mockCreate.mockResolvedValue(mockResp(flat)); // both attempts homogenized
    const outcome = await RUN();
    expect(mockCreate).toHaveBeenCalledTimes(2); // nudged one retry
    expect(outcome.fold_success).toBe(true); // accepted on the final attempt (warn-only fallback)
    expect(outcome.warnings.some((w) => w.includes("retry-nudge"))).toBe(true);
  });

  it("a diverse fold succeeds on the first attempt (no nudge)", async () => {
    mockCreate.mockResolvedValueOnce(mockResp(makeFoldResponse()));
    const outcome = await RUN();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(outcome.fold_success).toBe(true);
  });
});
