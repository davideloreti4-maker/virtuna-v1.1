/**
 * ideas-runner.test.ts — runIdeasPipeline unit tests (Task 1, plan 03-03).
 *
 * Tests (tagged "runner"):
 *   - over-generate → gate → ≤3 idea-card blocks
 *   - D-04 lead-quote-on-face invariant (scrollQuote on every card)
 *   - cold-start behavior (null profile → honest baseline grounding line)
 *   - sub-floor (Weak band) cards dropped; all-fail → exactly ONE bounded regen (14-02 D-06)
 *   - cap at 3 survivors even when all 5 pass
 *   - mixed results (only survivors above gate floor returned)
 *   - band/fraction/model embedded in each card block (D-04/D-10)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IdeaCardBlock } from "@/lib/tools/blocks";

// ─── Mock Qwen client ─────────────────────────────────────────────────────────

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

// ─── Mock runFlashTextMode ────────────────────────────────────────────────────

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
}));

// ─── Mock pinPredictedSignature (FLYWHEEL-02) ─────────────────────────────────
// The runner imports it from predicted-pin; mock the leaf so we assert the call
// (personas + ctx) without touching the outcome repo. The module's only other
// exports are the pin-context types, so a partial mock is safe.
vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled bundle"),
}));

// ─── Mock buildGroundingLine ──────────────────────────────────────────────────

vi.mock("@/lib/kc/grounding-line", () => ({
  buildGroundingLine: vi.fn(() => ({
    line: "Because: fitness · 18-25",
    coldStart: false,
  })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10 personas: 6 stop → Mixed band (above gate floor) */
function makePersonasMixed() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 6 ? "stop" : "scroll",
    quote: `Quote from persona ${i}`,
  }));
}

/** 10 personas: 2 stop → Weak band (sub-floor, dropped) */
function makePersonasWeak() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 2 ? "stop" : "scroll",
    quote: `Weak persona quote ${i}`,
  }));
}

/** 10 personas: 8 stop → Strong band */
function makePersonasStrong() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 8 ? "stop" : "scroll",
    quote: `Strong persona quote ${i}`,
  }));
}

/** Structured JSON generation response with `count` ideas */
function makeStructuredIdeaResponse(count = 5) {
  return {
    ideas: Array.from({ length: count }, (_, i) => ({
      title: `Idea ${i + 1}`,
      angle: `Angle for idea ${i + 1}`,
      mechanism: `Mechanism ${i + 1}`,
      seedHook: `Seed hook for idea ${i + 1}`,
      needsTake: i % 2 === 0,
      topic: `Topic ${i + 1}`,
      take: `Take ${i + 1}`,
      format: i % 3 === 0 ? null : `Format ${i + 1}`,
    })),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runIdeasPipeline (runner)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("over-generates ~5 concepts, SIMs in parallel, returns ≤3 cards above gate floor", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Give me fitness ideas",
      platform: "tiktok",
      profileRow: {
        niche_primary: "fitness",
        niche_sub: null,
        target_audience: { age_range: "18-25", gender_skew: null, geo: null, language: null },
        primary_goal: null,
        past_wins: null,
        past_flops: null,
        target_platforms: ["tiktok"],
      },
    });

    expect(result.blocks.length).toBeLessThanOrEqual(3);
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.seedHookPath).toBe("structured");
    for (const block of result.blocks) {
      expect(block.type).toBe("idea-card");
    }
  });

  it("D-04 LEAD-QUOTE INVARIANT: every returned idea-card has scrollQuote populated on the block", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

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

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas for fitness",
      platform: "tiktok",
      profileRow: null,
    });

    for (const block of result.blocks) {
      const card = block as IdeaCardBlock;
      expect(typeof card.props.scrollQuote).toBe("string");
      expect(card.props.scrollQuote.length).toBeGreaterThan(0);
    }
  });

  it("drops Weak-band candidates (sub-floor); all-fail triggers exactly ONE bounded regen (14-02 D-06)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasWeak() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    // All dropped → 0 blocks (0 survivors is valid — never an unbounded loop)
    expect(result.blocks.length).toBe(0);
    // 14-02 D-06: zero passers triggers ONE conditional regen → two over-generate
    // batches of 5 SIM calls each (10), then STOP. Bounded — never unbounded serial.
    expect(runFlashTextMode).toHaveBeenCalledTimes(10);
    // Exactly two generation calls (initial + one regen).
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("cold-start (null profile) produces cards with honest baseline grounding line", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { buildGroundingLine } = await import("@/lib/kc/grounding-line");

    (buildGroundingLine as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      line: "Based on TikTok baselines — add your profile for tailored ideas",
      coldStart: true,
    });

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBeGreaterThan(0);
    const firstCard = result.blocks[0] as IdeaCardBlock;
    expect(firstCard.props.whyItFits).toContain("baselines");
  });

  it("caps at 3 survivors even if more than 3 pass the gate", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

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

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(3);
  });

  it("mixed results: returns only survivors (≥3 stops) up to 3", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ result: { personas: makePersonasStrong() }, warnings: [] })
      .mockResolvedValueOnce({ result: { personas: makePersonasWeak() }, warnings: [] })
      .mockResolvedValueOnce({ result: { personas: makePersonasStrong() }, warnings: [] })
      .mockResolvedValueOnce({ result: { personas: makePersonasWeak() }, warnings: [] })
      .mockResolvedValueOnce({ result: { personas: makePersonasWeak() }, warnings: [] });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(2);
  });

  it("band, fraction, and model are embedded in each card block (D-04/D-10)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    for (const block of result.blocks) {
      const card = block as IdeaCardBlock;
      expect(["Strong", "Mixed", "Weak"]).toContain(card.props.band);
      expect(card.props.fraction).toMatch(/\d+\/10 stop/);
      expect(card.props.model).toBe("sim1-flash");
    }
  });
});

// ─── FLYWHEEL-02: predicted-signature pin wiring ──────────────────────────────

const calibratedAudience = {
  id: "aud-calibrated",
  user_id: "user-1",
  name: "Skincare Buyers",
  type: "target",
  platform: "instagram",
  goal_label: "Drive sales",
  goal_intent: "sell",
  is_general: false,
  is_preset: false,
  persona_weights: { fyp: 0.4, niche: 0.4, loyalist: 0.15, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-06-19T00:00:00Z",
  updated_at: "2026-06-19T00:00:00Z",
} as never;

const generalAudience = { ...(calibratedAudience as object), id: "general", is_general: true, personas: [] } as never;

describe("runIdeasPipeline — FLYWHEEL-02 predicted pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pins the lead idea's personas with the run's audience_id + analysis_id", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
          }),
        },
      },
    });
    const leadPersonas = makePersonasStrong();
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: leadPersonas },
      warnings: [],
    });

    const supabase = {} as never;
    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
      audience: calibratedAudience,
      pin: { supabase, analysisId: "an-1" },
    });

    expect(pinPredictedSignature).toHaveBeenCalledTimes(1);
    expect(pinPredictedSignature).toHaveBeenCalledWith(supabase, leadPersonas, {
      audienceId: "aud-calibrated",
      analysisId: "an-1",
    });
  });

  it("pins audience_id null for a General audience", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
          }),
        },
      },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
      audience: generalAudience,
      pin: { supabase: {} as never, analysisId: null },
    });

    expect(pinPredictedSignature).toHaveBeenCalledTimes(1);
    expect((pinPredictedSignature as ReturnType<typeof vi.fn>).mock.calls[0]![2]).toEqual({
      audienceId: null,
      analysisId: null,
    });
  });

  it("does NOT pin when no pin context is passed", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
          }),
        },
      },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    await runIdeasPipeline({ ask: "Ideas", platform: "tiktok", profileRow: null });

    expect(pinPredictedSignature).not.toHaveBeenCalled();
  });
});
