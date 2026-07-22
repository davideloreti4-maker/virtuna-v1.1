/**
 * remix-runner.test.ts — runRemixPipeline unit tests (NEW QWEN CALL SYSTEM, 2026-07-22).
 *
 * The persona SIM is GONE from the remix path (fan-out from hooks-runner). The ADAPT call
 * (generateAdaptConcepts) is the generation call — it now self-estimates each adapted hook's
 * stop-count (`personaStops` /10) + a `stopQuote`. The runner derives the PROJECTED band/fraction
 * from that, ranks best→worst by the /10 (keep-all), and labels every card provenance:"projected".
 * The per-persona cast + population projection are MEASURED artefacts that moved to the fired sim.
 *
 * Contract under test:
 *   - full chain in order: resolveAndRehost → analyzeVideoWithOmni → omniOutputToStructuralInput
 *     → runDecode → decodeResultToAdaptInput → generateAdaptConcepts
 *   - NO SIM (runFlashTextModeBatch) / characterize / pin call on this path
 *   - band/fraction derived from the adapt call's personaStops; RANK best→worst by the /10
 *   - provenance:"projected"; scrollQuote = the concept's stopQuote; NO personas / population
 *   - cleanup() in finally on every path (T-03-02); graceful decode_failed / adapt_failed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RemixCardBlock } from "@/lib/tools/blocks";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCleanup = vi.fn().mockResolvedValue(undefined);
const mockResolveAndRehost = vi.fn();
const mockAnalyzeVideoWithOmni = vi.fn();
const mockOmniOutputToStructuralInput = vi.fn();
const mockRunDecode = vi.fn();
const mockGenerateAdaptConcepts = vi.fn();
const mockRunFlashTextModeBatch = vi.fn();
const mockCharacterizeContent = vi.fn();
const mockPinPredictedSignature = vi.fn().mockResolvedValue(true);

vi.mock("@/lib/engine/remix/resolve-and-rehost", () => ({
  resolveAndRehost: (...args: unknown[]) => mockResolveAndRehost(...args),
}));

vi.mock("@/lib/engine/qwen/omni-analysis", () => ({
  analyzeVideoWithOmni: (...args: unknown[]) => mockAnalyzeVideoWithOmni(...args),
}));

vi.mock("@/lib/engine/remix/decode", () => ({
  omniOutputToStructuralInput: (...args: unknown[]) => mockOmniOutputToStructuralInput(...args),
  runDecode: (...args: unknown[]) => mockRunDecode(...args),
}));

vi.mock("@/lib/engine/remix/decode-types", () => ({
  decodeResultToAdaptInput: vi.fn((_decode: unknown, niche: string) => ({
    hook_pattern: "hook pattern body",
    structure: "structure body",
    the_turn: "the turn body",
    emotional_beat: "emotional beat body",
    repeatable: [{ label: "open-loop cold open", why_repeatable: "" }],
    niche,
  })),
}));

vi.mock("@/lib/engine/remix/adapt", () => ({
  generateAdaptConcepts: (...args: unknown[]) => mockGenerateAdaptConcepts(...args),
}));

// The SIM-path modules — asserted NEVER called (the "no SIM on the generation path" contract lock).
vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextModeBatch: (...args: unknown[]) => mockRunFlashTextModeBatch(...args),
}));

vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: (...args: unknown[]) => mockCharacterizeContent(...args),
}));

vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: (...args: unknown[]) => mockPinPredictedSignature(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOmniOutput() {
  return { geminiResult: { analysis: {}, cost_cents: 0.01 }, wave0Result: {} };
}

function makeStructuralInput() {
  return {
    hook_decomposition: { visual_stop_power: 8 },
    factors: [],
    video_signals: { visual_production_quality: 7, pacing_score: 6, transition_quality: 5 },
    content_summary: "Test content",
    overall_impression: "Good",
    content_type: "talking_head",
    niche_primary_slug: "fitness",
  };
}

function makeDecodeResult() {
  return {
    beats: [
      { id: "hook_pattern",       body: "A pattern interrupt", verdict: "present" },
      { id: "structure_pacing",   body: "Fast setup",         verdict: "present" },
      { id: "the_turn",           body: "Unexpected pivot",   verdict: "present" },
      { id: "emotional_beat",     body: "Hope and resolve",   verdict: "present" },
    ],
    repeatable: ["open-loop cold open"],
    luck: [{ category: "algorithmic_outlier", note: "Distribution spike" }],
  };
}

/**
 * 3 adapt concepts. The adapt call now self-estimates each hook's stop-count. `stopsPerConcept`
 * sets the per-concept /10 (defaults to 8,8,8 → all Strong), so a test can drive band + rank.
 */
function makeAdaptConcepts(stopsPerConcept: number[] = [8, 8, 8]) {
  const base = [
    { hook: "The real reason 90% of fitness beginners quit (and the fix)", angle: "Cold-open pattern interrupt reveals hidden truth", who_its_for: "Beginner fitness creators", format_borrowed: "open-loop cold open" },
    { hook: "What no nutrition coach tells you about sustainable eating", angle: "Authority-challenge structure reframed for niche", who_its_for: "Nutrition-focused audience", format_borrowed: "authority-challenge opener" },
    { hook: "This workout mistake is costing you 2 hours a week", angle: "Loss-aversion hook for time-conscious creators", who_its_for: "Busy professionals in fitness niche", format_borrowed: "loss-aversion hook" },
  ];
  return base.map((c, i) => ({ ...c, personaStops: stopsPerConcept[i] ?? 8, stopQuote: `Stop quote ${i + 1}` }));
}

function makeProfileRow() {
  return {
    user_id: "user-123",
    niche_primary: "fitness",
    niche_sub: null,
    target_audience: { age_range: "18-25", gender_skew: null, geo: null, language: null },
    primary_goal: null,
    past_wins: null,
    past_flops: null,
    target_platforms: ["tiktok"],
  };
}

/** Default happy path — resolve + omni + decode + 3 adapt concepts (all Strong /10). */
function setupHappyPath(stopsPerConcept: number[] = [8, 8, 8]) {
  mockResolveAndRehost.mockResolvedValue({
    signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
    cleanup: mockCleanup,
    coverUrl: "https://cdn.example.com/cover.jpg",
    handle: "creator_handle",
    views: 120000,
    sourceUrl: "https://tiktok.com/@creator_handle/video/123",
  });
  mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
  mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
  mockRunDecode.mockResolvedValue(makeDecodeResult());
  mockGenerateAdaptConcepts.mockResolvedValue(makeAdaptConcepts(stopsPerConcept));
}

async function expectNoSim() {
  expect(mockRunFlashTextModeBatch).not.toHaveBeenCalled();
  expect(mockCharacterizeContent).not.toHaveBeenCalled();
  expect(mockPinPredictedSignature).not.toHaveBeenCalled();
}

const baseInput = {
  url: "https://tiktok.com/@creator/video/123",
  platform: "tiktok" as const,
  requestId: "req-abc",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runRemixPipeline (new call system — generate-and-project)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCleanup.mockResolvedValue(undefined);
    mockPinPredictedSignature.mockResolvedValue(true);
  });

  it("calls the full chain in order and makes NO SIM/characterize/pin call", async () => {
    setupHappyPath();
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });

    expect(mockResolveAndRehost).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeVideoWithOmni).toHaveBeenCalledTimes(1);
    expect(mockRunDecode).toHaveBeenCalledTimes(1);
    expect(mockGenerateAdaptConcepts).toHaveBeenCalledTimes(1);
    await expectNoSim();

    expect(result.blocks.length).toBe(3);
    for (const b of result.blocks) expect(b.type).toBe("remix-card");
  });

  it("every card is provenance:\"projected\" and carries NO personas / population", async () => {
    setupHappyPath();
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { blocks } = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });

    for (const block of blocks) {
      const card = block as RemixCardBlock;
      expect(card.props.provenance).toBe("projected");
      expect(card.props.personas).toBeUndefined();
      expect(card.props.population).toBeUndefined();
      expect(card.props.model).toBe("sim1-flash");
    }
  });

  it("derives band/fraction from the adapt call's personaStops (8→Strong, 5→Mixed, 2→Weak)", async () => {
    setupHappyPath([8, 5, 2]);
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { blocks } = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });

    const byFraction = new Map(blocks.map((b) => [b.props.fraction, b.props.band]));
    expect(byFraction.get("8/10 stop")).toBe("Strong");
    expect(byFraction.get("5/10 stop")).toBe("Mixed");
    expect(byFraction.get("2/10 stop")).toBe("Weak");
  });

  it("RANK: best→worst by the projected /10 (keep-all — Weak kept last)", async () => {
    setupHappyPath([5, 8, 2]); // gen order → sorted desc: 8, 5, 2
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { blocks } = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });

    expect(blocks.length).toBe(3);
    expect(blocks[0]!.props.band).toBe("Strong");
    expect(blocks[2]!.props.band).toBe("Weak");
    const stops = blocks.map((b) => Number(/^(\d+)\//.exec(b.props.fraction)![1]));
    for (let i = 1; i < blocks.length; i++) expect(stops[i]!).toBeLessThanOrEqual(stops[i - 1]!);
  });

  it("LEAD-QUOTE INVARIANT: scrollQuote is the adapt call's stopQuote; sourceDecode is the shared 4-beat anatomy", async () => {
    setupHappyPath();
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { blocks } = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });

    for (const b of blocks) {
      expect(b.props.scrollQuote).toMatch(/Stop quote/);
      expect(b.props.sourceDecode.hookPattern).toBe("A pattern interrupt");
      expect(b.props.sourceDecode.emotionalBeat).toBe("Hope and resolve");
    }
  });

  it("coerces a malformed personaStops to 0 (Weak) — never a fabricated high", async () => {
    setupHappyPath();
    const bad = makeAdaptConcepts([8, 8, 8]);
    (bad[1]! as Record<string, unknown>).personaStops = "not a number";
    mockGenerateAdaptConcepts.mockResolvedValue(bad);

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { blocks } = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });

    const weak = blocks.find((b) => b.props.fraction === "0/10 stop");
    expect(weak).toBeDefined();
    expect(weak!.props.band).toBe("Weak");
  });

  it("each block passes RemixCardBlockSchema validation (belt-and-suspenders)", async () => {
    setupHappyPath();
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const { RemixCardBlockSchema } = await import("@/lib/tools/blocks");
    const { blocks } = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });
    for (const block of blocks) {
      expect(RemixCardBlockSchema.safeParse(block).success).toBe(true);
    }
  });

  it("cleanup() runs in finally on the happy path", async () => {
    setupHappyPath();
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("cleanup() runs in finally even when adapt throws (T-03-02)", async () => {
    setupHappyPath();
    mockGenerateAdaptConcepts.mockRejectedValue(new Error("adapt boom"));
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });
    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(result.error).toBe("adapt_failed");
  });

  it("a null decode returns error:\"decode_failed\" and still runs cleanup (Pitfall 6 graceful)", async () => {
    setupHappyPath();
    mockRunDecode.mockResolvedValue(null);
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });
    expect(result.blocks.length).toBe(0);
    expect(result.error).toBe("decode_failed");
    expect(mockCleanup).toHaveBeenCalledTimes(1);
    await expectNoSim();
  });

  it("null/empty adapt concepts → error:\"adapt_failed\"", async () => {
    setupHappyPath();
    mockGenerateAdaptConcepts.mockResolvedValue(null);
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });
    expect(result.blocks.length).toBe(0);
    expect(result.error).toBe("adapt_failed");
  });

  it("a failed resolve returns error:\"resolve_failed\" without touching the SIM", async () => {
    mockResolveAndRehost.mockRejectedValue(new Error("resolve boom"));
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({ ...baseInput, profileRow: makeProfileRow() });
    expect(result.error).toBe("resolve_failed");
    await expectNoSim();
  });
});
