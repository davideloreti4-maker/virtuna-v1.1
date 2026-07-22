/**
 * script-runner.test.ts — runScriptPipeline unit tests (NEW QWEN CALL SYSTEM, 2026-07-22).
 *
 * The pipeline collapsed (fan-out from hooks-runner): the opener persona SIM (runFlashTextMode) is
 * GONE from the generation path. The single generation call now self-estimates the OPENER's
 * stop-count (`personaStops` /10) + a `stopQuote`; the runner derives the PROJECTED opener band/
 * fraction from that (Pitfall 5: opener-only) and labels the ONE card provenance:"projected". The
 * opener's per-persona cast + population projection are MEASURED artefacts that moved to the fired sim.
 *
 * Contract under test:
 *   - generate ONE script, ONE Qwen call, NO SIM / characterize / pin call on this path
 *   - band/fraction derived from the opener personaStops (8→Strong 8/10, 5→Mixed 5/10, 2→Weak 2/10)
 *   - provenance:"projected"; scrollQuote = the gen call's stopQuote
 *   - personas + population ABSENT; ready-to-film (beats.filming / production / topic / format) preserved
 *   - sub-floor generation (empty beats) → 0 cards, no throw
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

// ─── Mock the REMOVED SIM-path modules — asserted NEVER called (contract lock) ──

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
  runFlashTextModeBatch: vi.fn(),
}));

vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: vi.fn(),
}));

vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled script bundle"),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * ONE structured script response. The single gen call now emits the projection fields — the OPENER's
 * `personaStops` (/10) + `stopQuote`. `stops` drives the opener band/fraction.
 */
function makeStructuredScriptResponse(stops = 8, overrides: Record<string, unknown> = {}) {
  return {
    beats: [
      { label: "Hook", content: "I stopped editing my videos and my views tripled.", timing: "0–3s", retentionMarker: "Outcome-first claim.", filming: "Close-up, handheld." },
      { label: "Setup", content: "Here is what I changed.", timing: "3–15s", retentionMarker: "Open loop." },
      { label: "Payoff", content: "The result was clear.", timing: "15–30s", retentionMarker: "Delivers." },
    ],
    openingBeatSeed: "I stopped editing my videos and my views tripled.",
    personaStops: stops,
    stopQuote: "Okay I need to hear the rest.",
    ...overrides,
  };
}

/** Mock the Qwen client to return a given structured-script response from ONE create() call. */
function mockQwen(response: unknown) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(response) } }],
  });
  return { client: { chat: { completions: { create } } }, create };
}

/** Assert none of the removed second-call machinery ran (the "one call" contract). */
async function expectNoSecondCall() {
  const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");
  const { characterizeContent } = await import("@/lib/audience/characterize-content");
  const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");
  expect(runFlashTextMode).not.toHaveBeenCalled();
  expect(characterizeContent).not.toHaveBeenCalled();
  expect(pinPredictedSignature).not.toHaveBeenCalled();
}

// ─── Core pipeline ──────────────────────────────────────────────────────────────

describe("runScriptPipeline (new call system — generate-and-project)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates ONE script in ONE Qwen call, makes NO SIM/characterize/pin call, returns exactly 1 card", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { create, client } = mockQwen(makeStructuredScriptResponse(8));
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({ ask: "Write a script", platform: "tiktok", profileRow: null });

    expect(create).toHaveBeenCalledTimes(1);
    await expectNoSecondCall();
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0]!.type).toBe("script-card");
  });

  it("the card is provenance:\"projected\" and carries NO personas / population", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredScriptResponse(8)).client);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks } = await runScriptPipeline({ ask: "s", platform: "tiktok", profileRow: null });

    const card = blocks[0] as ScriptCardBlock;
    expect(card.props.provenance).toBe("projected");
    expect(card.props.personas).toBeUndefined();
    expect(card.props.population).toBeUndefined();
    expect(card.props.model).toBe("sim1-flash");
  });

  it("derives the OPENER band/fraction from personaStops: 8→Strong, 5→Mixed, 2→Weak", async () => {
    const cases: Array<[number, string, "Strong" | "Mixed" | "Weak"]> = [
      [8, "8/10 stop", "Strong"],
      [5, "5/10 stop", "Mixed"],
      [2, "2/10 stop", "Weak"],
    ];
    for (const [stops, fraction, band] of cases) {
      vi.clearAllMocks();
      const { getQwenClient } = await import("@/lib/engine/qwen/client");
      (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredScriptResponse(stops)).client);
      const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
      const { blocks } = await runScriptPipeline({ ask: "s", platform: "tiktok", profileRow: null });
      expect(blocks[0]!.props.fraction).toBe(fraction);
      expect(blocks[0]!.props.band).toBe(band);
    }
  });

  it("LEAD-QUOTE INVARIANT: scrollQuote is the gen call's stopQuote", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredScriptResponse(8)).client);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks } = await runScriptPipeline({ ask: "s", platform: "tiktok", profileRow: null });
    expect(blocks[0]!.props.scrollQuote).toBe("Okay I need to hear the rest.");
  });

  it("preserves ready-to-film fields: per-beat filming + production + topic/format ride the card", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(
        makeStructuredScriptResponse(8, {
          topic: "Creator growth",
          format: "Talking-head",
          production: { shots: "1 talking-head", onScreenText: "Hook caption", setup: "Phone at eye level", edit: "Hard cuts" },
        }),
      ).client,
    );

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks } = await runScriptPipeline({ ask: "s", platform: "tiktok", profileRow: null });
    const props = blocks[0]!.props;
    expect(props.topic).toBe("Creator growth");
    expect(props.format).toBe("Talking-head");
    expect(props.production?.shots).toBe("1 talking-head");
    expect(props.beats[0]!.filming).toBe("Close-up, handheld.");
  });

  it("sub-floor generation (empty beats) → 0 cards, no throw", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen({ beats: [], openingBeatSeed: "" }).client);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const result = await runScriptPipeline({ ask: "s", platform: "tiktok", profileRow: null });
    expect(result.blocks.length).toBe(0);
  });

  it("coerces a malformed personaStops to 0 (Weak) — never a fabricated high", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredScriptResponse(8, { personaStops: "not a number" })).client,
    );

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks } = await runScriptPipeline({ ask: "s", platform: "tiktok", profileRow: null });
    expect(blocks[0]!.props.fraction).toBe("0/10 stop");
    expect(blocks[0]!.props.band).toBe("Weak");
  });

  it("each block passes ScriptCardBlockSchema validation (belt-and-suspenders)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredScriptResponse(8)).client);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { ScriptCardBlockSchema } = await import("@/lib/tools/blocks");
    const { blocks } = await runScriptPipeline({ ask: "s", platform: "tiktok", profileRow: null });
    for (const block of blocks) {
      expect(ScriptCardBlockSchema.safeParse(block).success).toBe(true);
    }
  });
});
