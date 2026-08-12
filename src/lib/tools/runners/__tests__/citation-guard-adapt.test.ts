/**
 * citation-guard-adapt.test.ts — the Stage A citation-honesty guard is CORPUS-KIND aware (C0).
 *
 * templateInstantiated() verifies the RAW-SLICE contract: the model was shown the madlib and
 * told to instantiate it, so a citation whose line shares no skeleton is decorative (N-1).
 * Under GROUNDING_*_ADAPT the model never sees the madlib — it consumes the briefer's FITTED
 * line, re-voiced twice by design ("borrow the engineering, never the words"). Measured on the
 * 2026-07-15 briefer A/B raw output: the madlib check strips 23/28 honest citations (clone 3/4,
 * swap 10/14, angle 10/10), and every strip renders a false "Original — not drawn from a
 * retrieved video" note. No lexical check can verify a remix chain (honest citations share zero
 * words with what the model consumed), so the lexical guard binds to the slice path ONLY; the
 * brief path keeps provenance-by-chain — the receipt semantics the 07-15 A/B was promoted on.
 *
 * These tests exercise the RUNNER-LEVEL composition (gather → generate → guard → card), the seam
 * the pure output-guards tests cannot see — a green unit suite sat over an 82% receipt kill.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievedExample } from "@/lib/grounding/types";
import type { GatherCorpusResult } from "@/lib/grounding/gather-for-run";

// ─── Mock Qwen client + the removed second-call machinery (same topology as runner tests) ──

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

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

// The bundle must carry the REAL corpus fence: trimExamplesToBundle() resolves sourceIndex
// against what survived assembly, and a fence-less mock bundle would drop every example
// (the model "saw none of it") before the guard under test ever ran.
vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(
    (input: { corpus?: string }) =>
      `PROFILE\n\nGrounded examples:\n<<<USER_CONTENT>>>\n${input.corpus ?? ""}\n<<<END_USER_CONTENT>>>\n\nASK`,
  ),
}));

vi.mock("@/lib/grounding/gather-for-run", () => ({
  gatherCorpusForRun: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A real-shaped grounding example whose madlib the generated line will NOT instantiate. */
function makeExample(over: Partial<RetrievedExample> = {}): RetrievedExample {
  return {
    teardownId: "t-1",
    handle: "braedan.health",
    videoUrl: "https://www.tiktok.com/@braedan.health/video/7300000000000000000",
    coverUrl: "https://cdn.example/cover.jpg",
    platform: "tiktok",
    multiplier: 90.7,
    views: 621000,
    baselineLabel: "vs followers",
    fitLabel: "adjacent",
    hookArchetype: "secret-reveal-breakdown",
    format: "breakdowns-explainers",
    visualSetting: "studio_set",
    editingStyle: "office-room-yap",
    hookTechniques: [],
    niche: "health-fitness",
    similarity: 0.71,
    spokenHook: "The one breakfast that fixed my energy",
    hookTemplate: "The one [thing] that fixed my [problem]",
    template: null,
    idea: null,
    whyItWorks: "Concrete outcome + curiosity gap",
    sourcePool: "scraped",
    trustWeight: 1,
    fromPersonal: false,
    ...over,
  };
}

/** A line sharing ZERO skeleton words with the fixture madlib — the guard, applied, strips it. */
const REVOICED_LINE = "Cortisol spikes before sunrise wreck your energy levels";

/** An adapt-brief corpus for the fixture example (format contract: "N. [dosage] fitted"). */
const BRIEF_CORPUS = `GROUNDING — proven short-form hook structures, each ALREADY FITTED to your ask.\n\n1. [angle] ${REVOICED_LINE}\n   why it fits: transfers the fixed-my-problem tension to sleep science.\n   proven by @braedan.health · 90.7× vs followers · 621K views`;

/** A raw-slice corpus for the same example (what ships today). */
const SLICE_CORPUS = `GROUNDING — proven structures.\n\n1. MADLIB: The one [thing] that fixed my [problem]\n   why: Concrete outcome + curiosity gap`;

function gatherResult(over: Partial<GatherCorpusResult>): GatherCorpusResult {
  return {
    corpus: undefined,
    examples: [],
    scrapeAvailable: false,
    warrant: "structural",
    grounded: true,
    adapted: false,
    ...over,
  };
}

async function mockGather(result: GatherCorpusResult) {
  const { gatherCorpusForRun } = await import("@/lib/grounding/gather-for-run");
  (gatherCorpusForRun as ReturnType<typeof vi.fn>).mockResolvedValue(result);
}

async function mockQwen(response: unknown) {
  const { getQwenClient } = await import("@/lib/engine/qwen/client");
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(response) } }],
  });
  (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
    chat: { completions: { create } },
  });
}

const hookResponse = {
  hooks: [
    {
      hookLine: REVOICED_LINE,
      mechanism: "Physiological stakes before the ask lands",
      seedHook: "Cortisol is sabotaging you before breakfast",
      channel: "spoken",
      needsTake: false,
      personaStops: 8,
      stopQuote: "Wait, before sunrise?",
      sourceIndex: 1,
    },
  ],
};

const scriptResponse = {
  beats: [
    {
      label: "Hook",
      content: REVOICED_LINE,
      timing: "0–3s",
      retentionMarker: "Stakes-first claim.",
      filming: "Close-up, handheld.",
    },
    { label: "Setup", content: "Here is what I changed.", timing: "3–15s", retentionMarker: "Open loop." },
    { label: "Payoff", content: "The result was clear.", timing: "15–30s", retentionMarker: "Delivers." },
  ],
  openingBeatSeed: REVOICED_LINE,
  personaStops: 8,
  stopQuote: "Okay I need the rest.",
  sourceIndex: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Hooks runner ─────────────────────────────────────────────────────────────

describe("runHooksPipeline citation guard × corpus kind", () => {
  it("adapt brief shipped (adapted: true) → the receipt SURVIVES a fully re-voiced line", async () => {
    await mockGather(
      gatherResult({ corpus: BRIEF_CORPUS, examples: [makeExample()], adapted: true }),
    );
    await mockQwen(hookResponse);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(1);
    expect(blocks[0]!.props.proof?.handle).toBe("braedan.health");
  });

  it("raw slice shipped (adapted: false) → the same re-voiced line LOSES its citation (N-1)", async () => {
    await mockGather(
      gatherResult({ corpus: SLICE_CORPUS, examples: [makeExample()], adapted: false }),
    );
    await mockQwen(hookResponse);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(1);
    expect(blocks[0]!.props.proof).toBeUndefined();
    // The RUN is still grounded — only this card's decorative citation drops.
    expect(blocks[0]!.props.grounded).toBe(true);
  });
});

// ─── Script runner ────────────────────────────────────────────────────────────

describe("runScriptPipeline citation guard × corpus kind", () => {
  it("adapt brief shipped (adapted: true) → the receipt SURVIVES a re-voiced opening seed", async () => {
    await mockGather(
      gatherResult({ corpus: BRIEF_CORPUS, examples: [makeExample()], adapted: true }),
    );
    await mockQwen(scriptResponse);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks } = await runScriptPipeline({ ask: "script it", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(1);
    expect(blocks[0]!.props.proof?.handle).toBe("braedan.health");
  });

  it("raw slice shipped (adapted: false) → the same opening seed LOSES its citation (N-1)", async () => {
    await mockGather(
      gatherResult({ corpus: SLICE_CORPUS, examples: [makeExample()], adapted: false }),
    );
    await mockQwen(scriptResponse);

    const { runScriptPipeline } = await import("@/lib/tools/runners/script-runner");
    const { blocks } = await runScriptPipeline({ ask: "script it", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(1);
    expect(blocks[0]!.props.proof).toBeUndefined();
  });
});
