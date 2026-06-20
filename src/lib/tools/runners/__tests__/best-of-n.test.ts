/**
 * best-of-n.test.ts — 14-02 best-of-N + flop pass wiring (KCQ-02 / KCQ-04 / KCQ-07).
 *
 * These tests target the NEW 14-02 behavior layered on top of the runners' existing
 * over-generate → SIM → gate spine:
 *
 *   1. COMBINED GATE (KCQ-02 + KCQ-05): a candidate ships ONLY if
 *        band !== "Weak" AND critiqueAgainstRubric(...).pass === true.
 *      A Strong-band candidate that FAILS the rubric is dropped.
 *   2. predictedFailureMode (KCQ-04): the rubric verdict's failure mode rides onto
 *      the built card block; null when the candidate passes cleanly.
 *   3. CONDITIONAL SINGLE REGEN (D-06): when EVERY first-batch candidate fails the
 *      combined gate, the runner regenerates ONCE (one extra parallel over-generate
 *      + critique pass) — never an unbounded serial loop.
 *
 * Both runners share the exact same wiring; these tests exercise it via the Ideas
 * runner (mechanism-level proof) plus one Hooks assertion for the failure-mode field.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IdeaCardBlock, HookCardBlock } from "@/lib/tools/blocks";

// ─── Mock Qwen client ─────────────────────────────────────────────────────────

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

// ─── Mock runFlashTextMode (the SIM band) ──────────────────────────────────────

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
}));

// ─── Mock the rubric-critic (the independent judge) ─────────────────────────────

vi.mock("@/lib/engine/flash/rubric-critic", () => ({
  critiqueAgainstRubric: vi.fn(),
}));

// ─── Mock pinPredictedSignature (FLYWHEEL-02) ─────────────────────────────────

vi.mock("@/lib/tools/runners/flash-runner", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled bundle"),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10 personas: 8 stop → Strong band (well above gate floor). */
function makePersonasStrong() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "tough_crowd" : `arch_${i}`,
    verdict: i < 8 ? "stop" : "scroll",
    quote: `Strong quote ${i}`,
  }));
}

function makeStructuredIdeaResponse(count: number) {
  return {
    ideas: Array.from({ length: count }, (_, i) => ({
      title: `Idea ${i + 1}`,
      angle: `Angle ${i + 1}`,
      mechanism: `Mechanism ${i + 1}`,
      seedHook: `Seed hook ${i + 1}`,
      needsTake: false,
      topic: `Topic ${i + 1}`,
      take: `Take ${i + 1}`,
      format: null,
    })),
  };
}

function makeStructuredHookResponse(count: number) {
  return {
    hooks: Array.from({ length: count }, (_, i) => ({
      hookLine: `Hook line ${i + 1}`,
      mechanism: `Mechanism ${i + 1}`,
      seedHook: `Seed hook ${i + 1}`,
      channel: null,
      needsTake: false,
    })),
  };
}

describe("best-of-N + flop pass (14-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("COMBINED GATE: a Strong-band candidate that FAILS the rubric is dropped (KCQ-02)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { critiqueAgainstRubric } = await import("@/lib/engine/flash/rubric-critic");

    // Generate 5 ideas — every SIM is Strong (band gate would PASS all).
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });
    // But the rubric FAILS every candidate → combined gate drops all of them.
    (critiqueAgainstRubric as ReturnType<typeof vi.fn>).mockResolvedValue({
      pass: false,
      predictedFailureMode: "Generic trope — audience has seen this a hundred times.",
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    // Strong band but rubric-fail → ZERO survivors (band alone is NOT enough — KCQ-02).
    expect(result.blocks.length).toBe(0);
    // The rubric critic ran in parallel for each candidate (5 first batch + 5 regen = 10).
    expect((critiqueAgainstRubric as ReturnType<typeof vi.fn>).mock.calls.length).toBe(10);
  });

  it("carries predictedFailureMode onto a surviving card (KCQ-04, null on clean pass)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { critiqueAgainstRubric } = await import("@/lib/engine/flash/rubric-critic");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });
    // Passing verdict → predictedFailureMode null → the field must be null on the card.
    (critiqueAgainstRubric as ReturnType<typeof vi.fn>).mockResolvedValue({
      pass: true,
      predictedFailureMode: null,
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    for (const block of result.blocks) {
      const card = block as IdeaCardBlock;
      // Field present and explicitly null on clean pass (validated by the schema).
      expect(card.props.predictedFailureMode).toBeNull();
    }
  });

  it("CONDITIONAL REGEN: all-fail first batch → exactly ONE regen, then survivors ship (D-06)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { critiqueAgainstRubric } = await import("@/lib/engine/flash/rubric-critic");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    // First batch (5 candidates): rubric FAILS all → zero survivors → regen.
    // Second batch (5 candidates): rubric PASSES all → survivors ship.
    const critic = critiqueAgainstRubric as ReturnType<typeof vi.fn>;
    let call = 0;
    critic.mockImplementation(async () => {
      call += 1;
      return call <= 5
        ? { pass: false, predictedFailureMode: "first-batch slop" }
        : { pass: true, predictedFailureMode: null };
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    // After one regen the second batch passes → survivors ship (capped at MAX_SURVIVORS=3).
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.blocks.length).toBeLessThanOrEqual(3);
    // Exactly TWO generation calls (initial + one regen) — never a third (bounded D-06).
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Each batch was 5 critic calls → 10 total; never unbounded.
    expect(critic.mock.calls.length).toBe(10);
  });

  it("Hooks: a surviving hook-card carries the rubric predictedFailureMode field", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { critiqueAgainstRubric } = await import("@/lib/engine/flash/rubric-critic");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(8)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });
    (critiqueAgainstRubric as ReturnType<typeof vi.fn>).mockResolvedValue({
      pass: true,
      predictedFailureMode: null,
    });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    for (const block of result.blocks) {
      const card = block as HookCardBlock;
      expect(card.props.predictedFailureMode).toBeNull();
    }
  });

  it("Hooks COMBINED GATE: Strong band + rubric-fail → dropped", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { critiqueAgainstRubric } = await import("@/lib/engine/flash/rubric-critic");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(8)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });
    (critiqueAgainstRubric as ReturnType<typeof vi.fn>).mockResolvedValue({
      pass: false,
      predictedFailureMode: "trope",
    });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    // Strong band but rubric-fail on all → 0 blocks (+ exactly one regen attempt).
    expect(result.blocks.length).toBe(0);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  // ── WR-01: critic ABSTENTION (infra failure) degrades gracefully, never silently zeros ──

  it("WR-01 Ideas: critic ABSTAINED (infra failure) on Strong candidates → kept band-only + warning (not dropped)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { critiqueAgainstRubric } = await import("@/lib/engine/flash/rubric-critic");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });
    // Critic OUTAGE: every verdict is an abstention (pass:false BUT abstained:true).
    // Before WR-01 this was indistinguishable from a fail → silent zero-out.
    (critiqueAgainstRubric as ReturnType<typeof vi.fn>).mockResolvedValue({
      pass: false,
      predictedFailureMode: null,
      abstained: true,
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    // Graceful degrade: Strong candidates survive on band-only (NOT a silent empty thread).
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    // Observability: exactly the degraded-critic warning is surfaced.
    expect(result.warnings.some((w) => /critic unavailable/i.test(w))).toBe(true);
    // No regen needed (survivors exist on first batch) → one generation call.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    // predictedFailureMode is null on a band-only survivor (critic produced no verdict).
    for (const block of result.blocks) {
      expect((block as IdeaCardBlock).props.predictedFailureMode).toBeNull();
    }
  });

  it("WR-01 Hooks: critic ABSTAINED on Strong candidates → kept band-only + warning (not dropped)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { critiqueAgainstRubric } = await import("@/lib/engine/flash/rubric-critic");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(8)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });
    (critiqueAgainstRubric as ReturnType<typeof vi.fn>).mockResolvedValue({
      pass: false,
      predictedFailureMode: null,
      abstained: true,
    });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => /critic unavailable/i.test(w))).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
