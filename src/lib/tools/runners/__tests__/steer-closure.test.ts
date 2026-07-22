/**
 * steer-closure.test.ts — W2 steer-everywhere closure gate (Plan 08-04, Task 1).
 *
 * Asserts, per runner (remix / hooks / script / chat), the TWO invariants that close
 * the position-1 STEER debt while preserving the General no-op (regression gate green):
 *
 *  1. NO-OP (General / null audience): the runner grounds via buildAudienceGroundingLine
 *     which DELEGATES to buildGroundingLine, and resolveAudienceWeights([]) returns the
 *     DEFAULT mix at source 'default'. No analysis_override is injected, and
 *     runFlashTextMode is called WITHOUT an audienceRepaint arg (byte-identical to today).
 *
 *  2. STEER (calibrated, non-general audience): buildAudienceGroundingLine grounds on the
 *     audience (audience-facing line, not the profile delegate), resolveAudienceWeights
 *     ([audience]) yields source 'analysis_override', and where the runner scores
 *     (remix / hooks / script) runFlashTextMode receives a per-archetype audienceRepaint map.
 *
 * This mirrors the shipped 07-04 ideas-runner shape replicated across the four runners.
 * The General path MUST stay deterministic + weighting-free (ENGINE_VERSION 3.21.0 — see
 * audience-regression-gate.test.ts).
 *
 * S3′ rebaseline: hooks/remix now SIM via the batched runFlashTextModeBatch (script stays
 * N=1 runFlashTextMode). The steer invariant is PRESERVED — repaint is still the 4th
 * positional arg of the flash call (candidates, framing, panel, audienceRepaint, intent),
 * so the General no-op (arg[3] === undefined) vs calibrated (arg[3] = repaint map) gate is
 * unchanged; only the call mechanism (batch vs N=1) differs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Audience } from "@/lib/audience/audience-types";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";

// ─── Mocks (shared across all runner suites) ────────────────────────────────────

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

// Both exports mocked: hooks/remix use the batched fn; script keeps the N=1 fn.
vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
  runFlashTextModeBatch: vi.fn(),
}));

// assembleBundle is spied so we can assert the steer is folded in (script/chat path)
vi.mock("@/lib/kc/assembler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kc/assembler")>();
  return {
    ...actual,
    assembleBundle: vi.fn(() => "mock assembled bundle"),
  };
});

// buildGroundingLine is the delegate target for the General/null no-op.
vi.mock("@/lib/kc/grounding-line", () => ({
  buildGroundingLine: vi.fn(() => ({
    line: "Because: fitness · 18-25",
    coldStart: false,
  })),
}));

// remix-runner heavy decode/adapt deps — mocked so we can exercise the steer wiring
vi.mock("@/lib/engine/remix/resolve-and-rehost", () => ({
  resolveAndRehost: vi.fn(async () => ({
    signedUrl: "https://signed.example/video.mp4",
    cleanup: vi.fn(async () => {}),
  })),
}));
vi.mock("@/lib/engine/qwen/omni-analysis", () => ({
  analyzeVideoWithOmni: vi.fn(async () => ({ omni: true })),
}));
vi.mock("@/lib/engine/remix/decode", () => ({
  omniOutputToStructuralInput: vi.fn(() => ({ structural: true })),
  runDecode: vi.fn(async () => ({
    beats: [
      { id: "hook_pattern", body: "hp" },
      { id: "structure_pacing", body: "sp" },
      { id: "the_turn", body: "tt" },
      { id: "emotional_beat", body: "eb" },
    ],
  })),
}));
vi.mock("@/lib/engine/remix/decode-types", () => ({
  decodeResultToAdaptInput: vi.fn((_decode: unknown, niche: string) => ({ niche })),
}));
vi.mock("@/lib/engine/remix/adapt", () => ({
  // New call system: the adapt call self-estimates the /10 + stop-quote (the removed SIM's job).
  generateAdaptConcepts: vi.fn(async () => [
    {
      hook: "Adapted hook line",
      angle: "Borrowed angle",
      who_its_for: "fitness beginners",
      format_borrowed: "before/after",
      personaStops: 8,
      stopQuote: "Okay that got me.",
    },
  ]),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────────

/** 10 personas, 8 stop → Strong band (above gate floor for every runner). */
function makePersonasStrong() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 8 ? "stop" : "scroll",
    quote: `Persona ${i} quote`,
  }));
}

/** A calibrated (non-general) audience with stored personas (repaint) + profile. */
const calibratedAudience: Audience = {
  id: "aud-calibrated",
  user_id: "user-1",
  name: "Skincare Buyers",
  type: "target",
  platform: "instagram",
  goal_label: "Drive sales",
  goal_intent: "sell",
  is_general: false,
  mode: "socials",
  is_preset: false,
  // Non-default weights — proves analysis_override is injected (source 'analysis_override')
  persona_weights: { fyp: 0.4, niche: 0.4, loyalist: 0.15, cross_niche: 0.05 },
  personas: [
    { archetype: "tough_crowd", repaint: "Doubts every claim", temperature: "cold", disposition: "skeptic", share: 0.5 },
    { archetype: "niche_deep_buyer", repaint: "Ready to buy", temperature: "hot", disposition: "converter", share: 0.5 },
  ],
  profile: {
    temperature_mix: { cold: 0.2, warm: 0.3, hot: 0.5 },
    top_dispositions: ["converter", "skeptic"],
    follower_tier: null,
  },
  calibration: null,
  created_at: "2026-06-19T00:00:00Z",
  updated_at: "2026-06-19T00:00:00Z",
};

const generalAudience: Audience = {
  id: "general",
  user_id: "__virtual__",
  name: "General",
  type: "target",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: true,
  mode: "general",
  is_preset: false,
  persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-06-19T00:00:00Z",
  updated_at: "2026-06-19T00:00:00Z",
};

const DEFAULT_MIX = { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 };

function mockFlashReturn() {
  return { result: { personas: makePersonasStrong() }, warnings: [] };
}

// Batched flash mock impl: every candidate gets a Strong reaction, keyed by its id
// (the runner builds ids = String(generationIndex)). Mirrors runFlashTextModeBatch's
// Promise<{ results: Map<id, { personas }>, warnings }> contract — async because the
// runners call `.catch()` on the returned promise before awaiting.
async function mockFlashBatchImpl(candidates: { id: string; text: string }[]) {
  return {
    results: new Map(candidates.map((c) => [c.id, { personas: makePersonasStrong() }])),
    warnings: [] as string[],
  };
}

function mockQwenStructured(content: unknown) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(content) } }],
        }),
      },
    },
  };
}

// ─── Weight-resolver invariants (the source-of-truth no-op anchor) ──────────────

describe("steer-closure: resolveAudienceWeights invariants", () => {
  it("null/empty → DEFAULT mix, source 'default' (no override)", () => {
    const { weights, source } = resolveAudienceWeights([]);
    expect(source).toBe("default");
    expect(weights).toEqual(DEFAULT_MIX);
  });

  it("General audience → DEFAULT mix, source 'default' (no override)", () => {
    const { weights, source } = resolveAudienceWeights([generalAudience]);
    expect(source).toBe("default");
    expect(weights).toEqual(DEFAULT_MIX);
  });

  it("calibrated audience → source 'analysis_override' (steer engaged)", () => {
    const { source } = resolveAudienceWeights([calibratedAudience]);
    expect(source).toBe("analysis_override");
  });
});

// ─── HOOKS runner ───────────────────────────────────────────────────────────────

describe("steer-closure: hooks-runner", () => {
  beforeEach(() => vi.clearAllMocks());

  async function run(audience?: Audience | null) {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { assembleBundle } = await import("@/lib/kc/assembler");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenStructured({
        hooks: Array.from({ length: 3 }, (_, i) => ({
          hookLine: `Hook ${i}`,
          mechanism: `Mechanism ${i}`,
          seedHook: `Seed ${i}`,
          channel: null,
          needsTake: false,
          personaStops: 8,
          stopQuote: `Stop ${i}`,
        })),
      }),
    );
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(mockFlashBatchImpl);
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "Hooks",
      platform: "tiktok",
      profileRow: { niche_primary: "fitness" } as never,
      audience,
    });
    return { result, runFlashTextModeBatch, assembleBundle };
  }

  // NEW QWEN CALL SYSTEM (2026-07-22): the persona SIM is GONE from the generation path, so the
  // steer no longer reaches a SIM — it now reaches ONLY the generation PROMPT (assembleBundle
  // overrides). The invariant is preserved at the prompt boundary; the SIM is asserted NOT called.
  it("General/null no-op: NO SIM call, and assembleBundle gets no audience-steer override", async () => {
    const { runFlashTextModeBatch, assembleBundle } = await run(generalAudience);
    expect((runFlashTextModeBatch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    const input = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { overrides?: string };
    expect(input.overrides).toBeUndefined();
  });

  it("calibrated steer: NO SIM call, and assembleBundle receives the audience grounding line as an override", async () => {
    const { runFlashTextModeBatch, assembleBundle } = await run(calibratedAudience);
    expect((runFlashTextModeBatch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    const input = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { overrides?: string };
    expect(input.overrides).toBeDefined();
    expect(input.overrides!.toLowerCase()).toContain("audience");
  });
});

// ─── SCRIPT runner ─────────────────────────────────────────────────────────────

describe("steer-closure: script-runner", () => {
  beforeEach(() => vi.clearAllMocks());

  async function run(audience?: Audience | null) {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { assembleBundle } = await import("@/lib/kc/assembler");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenStructured({
        beats: [
          { label: "Hook", content: "Opening line", timing: "0–3s", retentionMarker: "why" },
          { label: "Payoff", content: "Payoff line", timing: "3–15s", retentionMarker: "why2" },
        ],
        openingBeatSeed: "Opening line",
        personaStops: 8,
        stopQuote: "Stop",
      }),
    );
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue(mockFlashReturn());
    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({
      ask: "Script",
      platform: "tiktok",
      profileRow: { niche_primary: "fitness" } as never,
      audience,
    });
    return { result, runFlashTextMode, assembleBundle };
  }

  // NEW QWEN CALL SYSTEM: no opener SIM on the generation path — the steer reaches the PROMPT only.
  it("General/null no-op: NO opener SIM, and assembleBundle gets no audience-steer override", async () => {
    const { runFlashTextMode, assembleBundle } = await run(null);
    expect((runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    const input = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { overrides?: string };
    expect(input.overrides).toBeUndefined();
  });

  it("calibrated steer: NO opener SIM, and assembleBundle receives the audience grounding line as an override", async () => {
    const { runFlashTextMode, assembleBundle } = await run(calibratedAudience);
    expect((runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    const input = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { overrides?: string };
    expect(input.overrides).toBeDefined();
    expect(input.overrides!.toLowerCase()).toContain("audience");
  });
});

// ─── CHAT runner ───────────────────────────────────────────────────────────────

describe("steer-closure: chat-runner", () => {
  beforeEach(() => vi.clearAllMocks());

  function mockChatStream() {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(
            (async function* () {
              yield { choices: [{ delta: { content: "Hi" } }] };
            })(),
          ),
        },
      },
    };
  }

  async function run(audience?: Audience | null) {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { assembleBundle } = await import("@/lib/kc/assembler");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockChatStream());
    const { runChatPipeline } = await import("@/lib/tools/runners/chat-runner");
    await runChatPipeline(
      {
        ask: "How do I grow?",
        platform: "tiktok",
        profileRow: { niche_primary: "fitness" } as never,
        audience,
      },
      () => {},
    );
    return { assembleBundle };
  }

  it("General/null no-op: assembleBundle called WITHOUT an audience-steer override", async () => {
    const { assembleBundle } = await run(generalAudience);
    const call = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const input = call[0] as { overrides?: string };
    // No audience override folded in for General (byte-identical to today)
    expect(input.overrides).toBeUndefined();
  });

  it("calibrated steer: assembleBundle receives the audience grounding line as an override", async () => {
    const { assembleBundle } = await run(calibratedAudience);
    const call = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const input = call[0] as { overrides?: string };
    expect(input.overrides).toBeDefined();
    expect(input.overrides!.toLowerCase()).toContain("audience");
  });
});

// ─── REMIX runner ──────────────────────────────────────────────────────────────

describe("steer-closure: remix-runner", () => {
  beforeEach(() => vi.clearAllMocks());

  async function run(audience?: Audience | null) {
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(mockFlashBatchImpl);
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://tiktok.com/@x/video/1",
      platform: "tiktok",
      profileRow: { niche_primary: "fitness" } as never,
      requestId: "req-1",
      audience,
    });
    return { result, runFlashTextModeBatch };
  }

  // NEW QWEN CALL SYSTEM: no persona SIM on the remix path — the adapt call self-estimates the /10.
  // The steer reaches the adapt NICHE + the card's audienceName tag, never a SIM.
  it("General/null no-op: NO SIM call; no audienceName on card", async () => {
    const { result, runFlashTextModeBatch } = await run(generalAudience);
    expect((runFlashTextModeBatch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    // adapt mock returns 1 concept → 1 ranked card (keep-all ships all rated concepts)
    expect(result.blocks.length).toBe(1);
    // General → no steer tag on the card (regression-safe no-op)
    expect(
      (result.blocks[0]!.props as { audienceName?: string }).audienceName,
    ).toBeUndefined();
  });

  it("calibrated steer: NO SIM call; card carries audienceName", async () => {
    const { result, runFlashTextModeBatch } = await run(calibratedAudience);
    expect((runFlashTextModeBatch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect(result.blocks.length).toBe(1);
    expect((result.blocks[0]!.props as { audienceName?: string }).audienceName).toBe(
      "Skincare Buyers",
    );
  });
});
