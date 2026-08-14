/**
 * source-diversity.test.ts — F-7: one proven video must not become the receipt on every card.
 *
 * The audit finding was "the same source backs 3 of 5 cards". `createSourceDiversityCap`
 * (output-guards.ts) is the fix and `hooks-runner` has called it since `7d4bc133` — but NOTHING
 * asserted it, in either runner, so the cap could be deleted and every suite would stay green.
 *
 * These tests are RUNNER-LEVEL for the reason `citation-guard-adapt.test.ts` states about itself:
 * the cap lives in the card-assembly loop, where the whole set is known. A unit test of the counter
 * proves the counter counts; it cannot see a runner that never calls it — which is exactly the
 * state `ideas-runner` was found in.
 *
 * ⚠️ The constraint CANNOT live in `build-proof.ts`. That is a pure per-card `sourceIndex →
 * example` lookup with no view of the other cards, which is why re-deriving F-7 by reading that
 * file correctly finds nothing and wrongly concludes the defect is unfixed everywhere.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievedExample } from "@/lib/grounding/types";
import type { GatherCorpusResult } from "@/lib/grounding/gather-for-run";
import { MAX_CITATIONS_PER_SOURCE } from "@/lib/tools/runners/output-guards";

// ─── Same mock topology as the other runner-composition tests ─────────────────

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

// The bundle must carry the REAL corpus fence — trimExamplesToBundle resolves sourceIndex against
// what survived assembly, and a fence-less bundle drops every example before the cap is reached.
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

/** ONE proven video. Every generated card below cites it, which is the F-7 situation exactly. */
function theOneExample(): RetrievedExample {
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
    ...{},
  };
}

/** An adapt-brief corpus naming example 1 — `adapted: true` keeps the N-1 lexical guard out of
 *  the way, so what these tests measure is the diversity cap alone. */
const CORPUS = `GROUNDING — proven short-form structures, ALREADY FITTED to your ask.

1. [angle] Cortisol spikes before sunrise wreck your energy levels
   why it fits: transfers the fixed-my-problem tension to sleep science.
   proven by @braedan.health · 90.7× vs followers · 621K views`;

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F-7 · one source may not be the receipt on every card", () => {
  it("ideas: four ideas all citing source 1 keep only MAX_CITATIONS_PER_SOURCE receipts", async () => {
    await mockGather(gatherResult({ corpus: CORPUS, examples: [theOneExample()], adapted: true }));
    await mockQwen({
      ideas: Array.from({ length: 4 }, (_, i) => ({
        title: `Idea title ${i + 1}`,
        angle: `Angle for idea ${i + 1}`,
        mechanism: `Mechanism for idea ${i + 1} — plain prose, no craft slug`,
        seedHook: `Seed hook text ${i + 1}`,
        needsTake: false,
        topic: `Topic ${i + 1}`,
        take: `Take ${i + 1}`,
        format: null,
        personaStops: 8,
        stopQuote: `Stop quote ${i + 1}`,
        sourceIndex: 1, // every idea attributes the SAME video
      })),
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    const withProof = blocks.filter((b) => b.props.proof);
    expect(blocks.length).toBeGreaterThan(MAX_CITATIONS_PER_SOURCE);
    expect(withProof).toHaveLength(MAX_CITATIONS_PER_SOURCE);
    // The cards beyond the cap still render — they simply carry no receipt. Dropping the CARD
    // would punish the creator for the model's over-attribution.
    expect(blocks.every((b) => b.props.grounded)).toBe(true);
  });

  it("hooks: three hooks all citing source 1 keep only MAX_CITATIONS_PER_SOURCE receipts", async () => {
    await mockGather(gatherResult({ corpus: CORPUS, examples: [theOneExample()], adapted: true }));
    await mockQwen({
      hooks: Array.from({ length: 3 }, (_, i) => ({
        hookLine: `Cortisol spikes before sunrise wreck your energy, take ${i + 1}`,
        mechanism: "Physiological stakes before the ask lands",
        seedHook: `Cortisol is sabotaging you before breakfast ${i + 1}`,
        channel: "spoken",
        needsTake: false,
        personaStops: 8,
        stopQuote: "Wait, before sunrise?",
        sourceIndex: 1, // every hook attributes the SAME video
      })),
    });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    const withProof = blocks.filter((b) => b.props.proof);
    expect(blocks.length).toBeGreaterThan(MAX_CITATIONS_PER_SOURCE);
    expect(withProof).toHaveLength(MAX_CITATIONS_PER_SOURCE);
  });
});
