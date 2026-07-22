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
vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled script bundle"),
}));

// ─── Mock characterizeContent (Audience Sim v2 Stage 2 — the ONE content LLM call) ──
// New dependency; nothing else in this suite calls it, so mocking it is inert for the
// existing tests. The runner fires it (opener-only) when the signature carries v2 axes; mocked
// so the pure population math (population.ts, NOT mocked) runs on a deterministic ContentVector.
vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: vi.fn(),
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
    const [callSeed, callFraming, callPanel] = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls[0]!;
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

  it("wires ready-to-film fields: per-beat filming + topic/format + production flow to the card (owner 2026-07-22)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // A response that carries the new optional fields — the shape a wired live run now returns.
    const response = {
      ...makeScriptResponse(),
      topic: "Consistency systems",
      format: "Talking-head",
      production: {
        shots: "Static talking-head, one b-roll insert of a habit tracker",
        onScreenText: "'90% quit' stat card at 0s",
        setup: "Phone on tripod, window light",
        edit: "Hard cuts on each beat",
      },
    };
    (response.beats[0]! as Record<string, unknown>).filming = "Crash-zoom on face, deadpan delivery";

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({ ask: "Write a script", platform: "tiktok", profileRow: null });

    const card = result.blocks[0] as ScriptCardBlock;
    expect(card.props.topic).toBe("Consistency systems");
    expect(card.props.format).toBe("Talking-head");
    expect(card.props.production).toEqual(response.production);
    expect(card.props.beats[0]!.filming).toBe("Crash-zoom on face, deadpan delivery");
    // A beat the model gave no cue for stays cue-less (honest-absent, not a fabricated cue).
    expect(card.props.beats[1]!.filming).toBeUndefined();
  });

  it("drops a partial production block whole rather than shipping it half-formed (honesty)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    // Model returned only "shots" — schema needs shots+onScreenText+setup together, so the whole
    // block is dropped; the card omits production entirely (byte-identical to pre-wiring).
    const response = { ...makeScriptResponse(), production: { shots: "Static talking-head" } };
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({ ask: "Write a script", platform: "tiktok", profileRow: null });

    expect((result.blocks[0] as ScriptCardBlock).props.production).toBeUndefined();
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
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

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
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

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
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

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

// ─── Audience Sim v2 (Stage 2): population projection on the script card ───────

/**
 * A calibrated signature carrying the v2 axes the population math needs (mirrors the hooks/ideas
 * runner tests — same shape drives the SAME pure population.ts math). Two segments so the
 * aggregate has a real per-segment split. The audience keeps `personas: []` + `profile: null`
 * so the (real, unmocked) buildReactionPanel / buildFlashWeighting / buildAudienceGroundingLine
 * take their no-op paths — this test isolates the population wiring, not the steer/panel path.
 */
function calibratedAudienceWithAxes(): unknown {
  return {
    id: "aud-calibrated",
    user_id: "user-1",
    name: "Craft Editors",
    type: "target",
    platform: "tiktok",
    goal_label: "Grow reach",
    goal_intent: "grow",
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.4, niche: 0.3, loyalist: 0.2, cross_niche: 0.1 },
    personas: [],
    profile: null,
    calibration: null,
    signature: {
      creator_persona: { content_description: "x", context: "x", writing_style_sample: "x", format_signature: "x" },
      audience: {
        follower_tier: "10k-100k",
        maturity: "established",
        temperature_mix: { cold: 0.4, warm: 0.4, hot: 0.2 },
        interest_tags: ["craft"],
        what_resonates: "x",
        what_falls_flat: "x",
        persona_weights: { fyp: 0.4, niche: 0.3, loyalist: 0.2, cross_niche: 0.1 },
        topic_vocab: ["craft", "spectacle"],
        personas: [
          {
            archetype: "lurker", share: 0.6, temperature: "cold", disposition: "scanner",
            reaction_frame: "x", evidence: "x", display_name: "Dopamine Scrollers",
            reaction: { interests: {}, hookSensitivity: 0.2, noveltyBias: 0.5, skepticism: 0.2, attentionSpan: 0.1 },
          },
          {
            archetype: "niche_deep_buyer", share: 0.4, temperature: "hot", disposition: "collector",
            reaction_frame: "x", evidence: "x", display_name: "Frame-by-frame editors",
            reaction: { interests: { craft: 0.9 }, hookSensitivity: 0.8, noveltyBias: 0.3, skepticism: 0.5, attentionSpan: 0.9 },
          },
        ],
      },
      summary: "x",
      provenance: { handle: "@x", scraped_at: "2026-07-16", videos_analyzed: 8, videos_watched: 4, sub_coverage: "6/8" },
    },
    created_at: "2026-06-19T00:00:00Z",
    updated_at: "2026-06-19T00:00:00Z",
  };
}

/** An on-topic craft ContentVector — deterministic input for the (mocked) characterize call. */
const CRAFT_VECTOR = { topics: { craft: 0.9 }, hookStrength: 0.5, novelty: 0.3, hype: 0.1, slowness: 0.2 };

describe("runScriptPipeline — Audience Sim v2 population projection (Stage 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("characterizes the OPENER and attaches props.population (real per-segment split) with v2 axes", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { characterizeContent } = await import("@/lib/audience/characterize-content");

    const openingBeatSeed = "The one edit that keeps people watching past 3 seconds";
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeScriptResponse(openingBeatSeed)) } }],
          }),
        },
      },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });
    // The ONE content LLM call is mocked → the pure population math (population.ts) runs for real.
    (characterizeContent as ReturnType<typeof vi.fn>).mockResolvedValue(CRAFT_VECTOR);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
      anchor: openingBeatSeed,
      audience: calibratedAudienceWithAxes() as never,
    });

    // Characterized ONCE (one script → one card), on the SAME opener the SIM reacts to (opener-as-
    // hook), keyed to the signature's topic_vocab — never against the flash result.
    expect(characterizeContent).toHaveBeenCalledTimes(1);
    const [charText, charVocab] = (characterizeContent as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(charText).toBe(openingBeatSeed);
    expect(charVocab).toEqual(["craft", "spectacle"]);

    expect(result.blocks.length).toBe(1);
    const pop = result.blocks[0]!.props.population;
    expect(pop).toBeDefined();
    expect(pop!.total).toBeGreaterThan(0);
    expect(pop!.stop + pop!.scroll).toBe(pop!.total);
    expect(pop!.segments.length).toBe(2);
    const names = pop!.segments.map((s) => s.displayName).sort();
    expect(names).toEqual(["Dopamine Scrollers", "Frame-by-frame editors"]);
  });

  it("omits props.population (and makes NO characterize call) for an audience without v2 axes", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { characterizeContent } = await import("@/lib/audience/characterize-content");

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
      result: { personas: makePersonasMixed() },
      warnings: [],
    });
    (characterizeContent as ReturnType<typeof vi.fn>).mockResolvedValue(CRAFT_VECTOR);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    // No audience → no signature → the gate is closed → byte-identical pre-v2 shape.
    const result = await runScriptPipeline({
      ask: "Write a script",
      platform: "tiktok",
      profileRow: null,
      anchor: "Did you know 90% of people quit in the first 30 days?",
    });

    expect(characterizeContent).not.toHaveBeenCalled();
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0]!.props.population).toBeUndefined();
  });
});
