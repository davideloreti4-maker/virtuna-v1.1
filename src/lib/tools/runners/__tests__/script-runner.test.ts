/**
 * script-runner.test.ts — runScriptPipeline unit tests (Task 1, plan 06-03).
 *
 * Tests:
 *   - runScriptPipeline returns exactly ONE script-card block (D-02: one-card, not N)
 *   - Flash gate called with openingBeatSeed + "hook" framing ONCE (D-01 opener-only gate)
 *   - each returned beat carries label + content + timing + retentionMarker (D-02 card anatomy)
 *   - band/fraction on the card come from aggregateFlash of the opener SIM (Pitfall 5 opener-scoped honesty)
 *   - a card failing ScriptCardBlockSchema.safeParse is dropped with a warning (D-14 belt-and-suspenders)
 *   - cold-start (null profile) produces a script card
 *   - anchor (hookLine from Hooks→Script) flows through to assembleBundle
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScriptCardBlock } from "@/lib/tools/blocks";

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
vi.mock("@/lib/tools/runners/flash-runner", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled script bundle"),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10 personas: 8 stop → Strong band */
function makePersonasStrong() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "tough_crowd" : `arch_${i}`,
    verdict: i < 8 ? "stop" : "scroll",
    quote: `Strong quote from persona ${i}`,
  }));
}

/** 10 personas: 5 stop → Mixed band */
function makePersonasMixed() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "niche_deep_buyer" : `arch_${i}`,
    verdict: i < 5 ? "stop" : "scroll",
    quote: `Mixed quote from persona ${i}`,
  }));
}

/** A valid structured script JSON response */
function makeScriptResponse(openingBeatSeed = "Did you know 90% of people quit in the first 30 days?") {
  return {
    beats: [
      { label: "Hook", content: openingBeatSeed, timing: "0–3s", retentionMarker: "Pattern interrupt — unexpected statistic forces mental re-evaluation." },
      { label: "Setup", content: "Here's what no one tells you about consistency.", timing: "3–15s", retentionMarker: "Frames the payoff — creates a curiosity gap the viewer needs resolved." },
      { label: "Turn", content: "The real problem isn't willpower. It's system design.", timing: "15–30s", retentionMarker: "Reframes the viewer's mental model — they feel understood." },
      { label: "Payoff", content: "Do this one thing every morning for 7 days.", timing: "30–50s", retentionMarker: "Concrete CTA — specific enough to feel achievable." },
      { label: "CTA", content: "Save this for next Monday morning.", timing: "50–60s", retentionMarker: "Save-triggers are evergreen hooks — timing specificity boosts replay." },
    ],
    openingBeatSeed,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runScriptPipeline (runner)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns exactly ONE script-card block on a successful generate (D-02 one-card)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script about consistency",
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
      anchor: "Did you know 90% of people quit in the first 30 days?",
    });

    // D-02: exactly ONE block
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0]!.type).toBe("script-card");
  });

  it("Flash gate called with openingBeatSeed + 'hook' framing exactly ONCE (D-01 opener-only)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const openingBeatSeed = "Did you know 90% of people quit in the first 30 days?";
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse(openingBeatSeed)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
      anchor: undefined,
    });

    // Flash must be called ONCE, with the opener seed + "hook" framing
    expect(runFlashTextMode).toHaveBeenCalledTimes(1);
    const [callSeed, callFraming, callPanel] = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callSeed).toBe(openingBeatSeed);
    expect(callFraming).toBe("hook");
    expect(callPanel).toMatchObject({ contentType: null });
  });

  it("each beat carries label + content + timing + retentionMarker (D-02 card anatomy)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(1);
    const card = result.blocks[0] as ScriptCardBlock;
    expect(Array.isArray(card.props.beats)).toBe(true);
    expect(card.props.beats.length).toBeGreaterThan(0);

    for (const beat of card.props.beats) {
      expect(typeof beat.label).toBe("string");
      expect(beat.label.length).toBeGreaterThan(0);
      expect(typeof beat.content).toBe("string");
      expect(beat.content.length).toBeGreaterThan(0);
      expect(typeof beat.timing).toBe("string");
      expect(beat.timing.length).toBeGreaterThan(0);
      expect(typeof beat.retentionMarker).toBe("string");
      expect(beat.retentionMarker.length).toBeGreaterThan(0);
    }
  });

  it("band/fraction come from aggregateFlash of the opener SIM (Pitfall 5 opener-scoped honesty)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    // Strong personas: 8 stop → band "Strong", fraction "8/10 stop"
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(1);
    const card = result.blocks[0] as ScriptCardBlock;
    expect(card.props.band).toBe("Strong");
    expect(card.props.fraction).toBe("8/10 stop");
    expect(card.props.model).toBe("sim1-flash");
  });

  it("SIM failure pushes a warning and returns 0 blocks (mirror hooks null-handling)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("SIM call failed"));

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("SIM failed");
  });

  it("card failing ScriptCardBlockSchema.safeParse is dropped with a warning (D-14)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // Return a script with EMPTY beats array — will fail ScriptCardBlockSchema (beats is required non-empty)
    const badScript = { beats: [], openingBeatSeed: "hook seed" };
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(badScript) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
    });

    // Card dropped (schema failure) — 0 blocks, warning present
    expect(result.blocks.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("validation failed") || w.includes("dropped"))).toBe(true);
  });

  it("cold-start (null profile) produces a script card (niche falls back to null)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(1);
    // Flash must be called with niche: null (cold-start)
    const calls = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]![2]).toMatchObject({ niche: null, contentType: null });
  });

  it("scrollQuote on the card comes from the opener SIM personas (D-04 face texture)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // Make the first persona a "stop" verdict — lead quote should come from them
    const personas = makePersonasStrong();
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(1);
    const card = result.blocks[0] as ScriptCardBlock;
    expect(typeof card.props.scrollQuote).toBe("string");
    expect(card.props.scrollQuote.length).toBeGreaterThan(0);
    // The lead quote should come from the first stop-verdict persona
    const firstStopPersona = personas.find((p) => p.verdict === "stop");
    expect(card.props.scrollQuote).toBe(firstStopPersona?.quote);
  });

  it("each block passes ScriptCardBlockSchema validation (D-14 belt-and-suspenders)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { ScriptCardBlockSchema } = await import("@/lib/tools/blocks");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
    });

    for (const block of result.blocks) {
      const validation = ScriptCardBlockSchema.safeParse(block);
      expect(validation.success).toBe(true);
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

describe("runScriptPipeline — FLYWHEEL-02 predicted pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pins the opener's personas with the run's audience_id + analysis_id", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/flash-runner");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
          }),
        },
      },
    });
    const openerPersonas = makePersonasStrong();
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: openerPersonas },
      warnings: [],
    });

    const supabase = {} as never;
    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    await runScriptPipeline({
      ask: "Script",
      platform: "tiktok",
      profileRow: null,
      audience: calibratedAudience,
      pin: { supabase, analysisId: "an-1" },
    });

    expect(pinPredictedSignature).toHaveBeenCalledTimes(1);
    expect(pinPredictedSignature).toHaveBeenCalledWith(supabase, openerPersonas, {
      audienceId: "aud-calibrated",
      analysisId: "an-1",
    });
  });

  it("pins audience_id null for a General audience", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/flash-runner");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
          }),
        },
      },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    await runScriptPipeline({
      ask: "Script",
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
    const { pinPredictedSignature } = await import("@/lib/tools/runners/flash-runner");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeScriptResponse()) } }],
          }),
        },
      },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    await runScriptPipeline({ ask: "Script", platform: "tiktok", profileRow: null });

    expect(pinPredictedSignature).not.toHaveBeenCalled();
  });
});
