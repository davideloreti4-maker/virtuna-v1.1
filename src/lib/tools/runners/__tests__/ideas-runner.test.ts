/**
 * ideas-runner.test.ts — runIdeasPipeline unit tests (S3′ generate-rate-rank rebaseline).
 *
 * Contract changes from previous version:
 *   - runFlashTextMode (N=1 per candidate) → runFlashTextModeBatch (single batch call)
 *   - IDEA_COUNT = 4 (was over-gen 5 → keep-3)
 *   - GATE REMOVED → KEEP-ALL: Weak ideas kept, ranked last (band desc → fraction desc → gen order)
 *   - D-06 conditional regen REMOVED: batch fail → 0 cards + warning, no second generate call
 *   - Each idea-card block carries `props.personas` (10-persona array)
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

// ─── Mock runFlashTextModeBatch ───────────────────────────────────────────────
// S3′: runner calls runFlashTextModeBatch, NOT the old per-candidate runFlashTextMode.

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextModeBatch: vi.fn(),
}));

// ─── Mock predicted-pin (FLYWHEEL-02) ────────────────────────────────────────

vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled bundle"),
}));

// ─── Mock audience-grounding (replaces old grounding-line mock) ───────────────
// Runner now calls buildAudienceGroundingLine (not buildGroundingLine directly).

vi.mock("@/lib/audience/audience-grounding", () => ({
  buildAudienceGroundingLine: vi.fn(() => ({
    line: "Because: fitness · 18-25",
    coldStart: false,
  })),
}));

// ─── Mock apply-creator-persona ───────────────────────────────────────────────

vi.mock("@/lib/audience/apply-creator-persona", () => ({
  applyCreatorPersona: vi.fn((profileRow: unknown) => ({
    profileRow,
    creatorSteer: null,
  })),
}));

// ─── Mock build-reaction-panel ────────────────────────────────────────────────

vi.mock("@/lib/engine/flash/build-reaction-panel", () => ({
  buildReactionPanel: vi.fn(() => ({ panel: undefined, audienceRepaint: undefined })),
}));

// ─── Mock persona-weighting ───────────────────────────────────────────────────

vi.mock("@/lib/engine/flash/persona-weighting", () => ({
  buildFlashWeighting: vi.fn(() => undefined),
}));

// ─── Mock characterizeContent (Audience Sim v2 Stage 2 — the ONE content LLM call) ──
// The runner fires this per candidate when the signature carries v2 axes. Mocked so the
// pure population math (population.ts, NOT mocked) runs on a deterministic ContentVector —
// the wiring under test is "does the runner characterize + reactPopulation + attach it".
vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10 personas: 6 stop → Mixed band */
function makePersonasMixed() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 6 ? "stop" : "scroll",
    quote: `Quote from persona ${i}`,
  }));
}

/** 10 personas: 2 stop → Weak band (ranked last under keep-all) */
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

/**
 * Build a batch mock resolved value from a per-candidate personas array.
 * candidates: [{id, text}, ...] (mirror of what ratePass builds: id=String(i)).
 * personasPerCandidate: array indexed by generation position.
 * Returns a Promise (runner calls .catch() on the result).
 */
function makeBatchResult(personasPerCandidate: ReturnType<typeof makePersonasStrong>[]) {
  const results = new Map(
    personasPerCandidate.map((personas, i) => [String(i), { personas }]),
  );
  return Promise.resolve({ results, warnings: [] });
}

/** Structured JSON generation response with `count` ideas */
function makeStructuredIdeaResponse(count = 4) {
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

  it("generates IDEA_COUNT=4 concepts, ONE batched SIM call, returns ≤4 cards (keep-all)", async () => {
    // OLD: "over-generates ~5 concepts, SIMs in parallel, returns ≤3 cards above gate floor"
    // NEW: generates exactly 4, single batch call, all rated ideas kept (no gate), capped at IDEA_COUNT=4
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(4)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    // All 4 ideas rated Mixed — all kept
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasMixed())),
    );

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

    // S3′: keep-all, up to IDEA_COUNT=4
    expect(result.blocks.length).toBeLessThanOrEqual(4);
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.seedHookPath).toBe("structured");
    for (const block of result.blocks) {
      expect(block.type).toBe("idea-card");
    }
    // ONE batched SIM call (not N per-candidate calls)
    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    // ONE generation call (no regen)
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("batched SIM called with correct candidates (id=String(i), text=seedHook) + framing args", async () => {
    // NEW: asserts the batch call shape — candidates indexed by generation position
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasStrong())),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    await runIdeasPipeline({ ask: "Ideas", platform: "tiktok", profileRow: null });

    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    const [candidates, framing] = (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    // Candidates: id = "0", "1", ...; text = seedHook
    expect(candidates).toEqual([
      { id: "0", text: "Seed hook for idea 1" },
      { id: "1", text: "Seed hook for idea 2" },
    ]);
    // Framing = "idea"
    expect(framing).toBe("idea");
  });

  it("D-04 LEAD-QUOTE INVARIANT: every returned idea-card has scrollQuote populated on the block", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasStrong())),
    );

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

  it("Weak-band ideas KEPT, ranked last (keep-all); all-Weak → 4 Weak cards, no regen", async () => {
    // OLD: "drops Weak-band candidates; all-fail triggers exactly ONE bounded regen (14-02 D-06)"
    // NEW: D-06 removed; Weak ideas are kept, ranked last. All-Weak → 4 Weak cards (still shown).
    //      No regen — batch fail is the ONLY path to 0 cards.
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(4)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    // All ideas rate Weak — keep-all means all 4 come back ranked last
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasWeak())),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    // Keep-all: 4 Weak cards returned (no gate drop)
    expect(result.blocks.length).toBe(4);
    for (const block of result.blocks) {
      expect((block as IdeaCardBlock).props.band).toBe("Weak");
    }
    // ONE batched call — no regen
    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    // ONE generation call — no regen
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("batch SIM hard failure → 0 cards + warning, no regen (D-06 removed)", async () => {
    // NEW: replaces the regen test's "all-fail" path. Hard SIM failure → 0 cards, not a retry.
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(4)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("SIM timeout"),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    // Hard failure → 0 cards
    expect(result.blocks.length).toBe(0);
    // Warning forwarded
    expect(result.warnings.some((w) => w.includes("SIM timeout"))).toBe(true);
    // ONE batch call — no regen
    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    // ONE generation call — no regen
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("cold-start (null profile) produces cards with honest baseline grounding line", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { buildAudienceGroundingLine } = await import("@/lib/audience/audience-grounding");

    (buildAudienceGroundingLine as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      line: "Based on TikTok baselines — add your profile for tailored ideas",
      coldStart: true,
    });

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasMixed())),
    );

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

  it("caps at IDEA_COUNT=4 even when model over-emits", async () => {
    // OLD: "caps at 3 survivors even if more than 3 pass the gate"
    // NEW: IDEA_COUNT=4; slice(IDEA_COUNT) is a safety bound; 5 ideas generated → 4 returned
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      // Model over-emits 5; runner caps at IDEA_COUNT=4 via slice
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    // generateIdeasStructured itself caps the parse loop at IDEA_COUNT=4, so batch receives 4 candidates
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasStrong())),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    expect(result.blocks.length).toBe(4);
  });

  it("mixed bands: Strong cards ranked before Weak; all kept (keep-all)", async () => {
    // OLD: "mixed results: returns only survivors (≥3 stops) up to 3"
    // NEW: no gate — Strong + Weak all kept, ranked by band (Strong first). 4 candidates, 4 cards.
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(4)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // ideas 0,2 → Strong; ideas 1,3 → Weak — batch result keyed by String(i)
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) => {
      const results = new Map(
        candidates.map(
          (c: { id: string; text: string }, idx: number) => [
            c.id,
            { personas: idx % 2 === 0 ? makePersonasStrong() : makePersonasWeak() },
          ],
        ),
      );
      return Promise.resolve({ results, warnings: [] });
    });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
    });

    // All 4 kept (keep-all)
    expect(result.blocks.length).toBe(4);
    // Strong cards ranked before Weak
    const bands = result.blocks.map((b) => (b as IdeaCardBlock).props.band);
    const strongIdx = bands.indexOf("Strong");
    const weakIdx = bands.indexOf("Weak");
    expect(strongIdx).toBeLessThan(weakIdx);
  });

  it("band, fraction, model, and personas[10] embedded in each card block (D-04/D-10 + S3′ PR-2)", async () => {
    // NEW: adds `personas` length assertion (S3′ PR-2 — per-card reaction for ambient modal)
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasStrong())),
    );

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
      // S3′ PR-2: personas travel on the card
      expect(Array.isArray(card.props.personas)).toBe(true);
      expect(card.props.personas!.length).toBe(10);
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
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
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
    // All candidates return the same personas; rank-1 = idea "0" (Strong, gen 0)
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => leadPersonas)),
    );

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
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
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
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasStrong())),
    );

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
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
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
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasStrong())),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    await runIdeasPipeline({ ask: "Ideas", platform: "tiktok", profileRow: null });

    expect(pinPredictedSignature).not.toHaveBeenCalled();
  });
});

// ─── Audience Sim v2 (Stage 2): population projection on the idea card ─────────

/**
 * A calibrated signature carrying the v2 axes the population math needs: a non-empty
 * `topic_vocab` and personas with scored `reaction` axes (mirrors population.test.ts). Two
 * segments so the aggregate has a real per-segment split to assert on. Mirrors the hooks-runner
 * population test — same signature shape drives the SAME pure population.ts math.
 */
function signatureWithAxes(): unknown {
  return {
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
  };
}

/** An on-topic craft ContentVector — deterministic input for the (mocked) characterize call. */
const CRAFT_VECTOR = { topics: { craft: 0.9 }, hookStrength: 0.5, novelty: 0.3, hype: 0.1, slowness: 0.2 };

describe("runIdeasPipeline — Audience Sim v2 population projection (Stage 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches props.population (real per-segment split) when the signature carries v2 axes", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { characterizeContent } = await import("@/lib/audience/characterize-content");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(4)) } }],
          }),
        },
      },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasMixed())),
    );
    // The ONE content LLM call is mocked → the pure population math (population.ts) runs for real.
    (characterizeContent as ReturnType<typeof vi.fn>).mockResolvedValue(CRAFT_VECTOR);

    const audience = { ...(calibratedAudience as object), signature: signatureWithAxes() } as never;

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
      audience,
    });

    // The characterize call fired once per generated candidate (concurrent with the SIM), keyed
    // to the signature's topic_vocab — the idea's seedHook is the text scored, never the SIM result.
    expect(characterizeContent).toHaveBeenCalledTimes(4);
    expect((characterizeContent as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toEqual(["craft", "spectacle"]);

    // Every card carries the REAL projection: total ≈ N, a genuine stop/scroll split summing to
    // total, and both named segments present (the rollup of the 10 could not produce this).
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    for (const b of blocks) {
      const pop = b.props.population;
      expect(pop).toBeDefined();
      expect(pop!.total).toBeGreaterThan(0);
      expect(pop!.stop + pop!.scroll).toBe(pop!.total);
      expect(pop!.segments.length).toBe(2);
      const names = pop!.segments.map((s) => s.displayName).sort();
      expect(names).toEqual(["Dopamine Scrollers", "Frame-by-frame editors"]);
      expect(pop!.segments.every((s) => typeof s.stopPct === "number")).toBe(true);
    }
  });

  it("omits props.population (and makes NO characterize call) for an audience without v2 axes", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { characterizeContent } = await import("@/lib/audience/characterize-content");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeStructuredIdeaResponse(4)) } }],
          }),
        },
      },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation((candidates) =>
      makeBatchResult(candidates.map(() => makePersonasMixed())),
    );
    (characterizeContent as ReturnType<typeof vi.fn>).mockResolvedValue(CRAFT_VECTOR);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    // calibratedAudience has NO signature → the gate is closed → byte-identical pre-v2 shape.
    const { blocks } = await runIdeasPipeline({
      ask: "Ideas",
      platform: "tiktok",
      profileRow: null,
      audience: calibratedAudience,
    });

    expect(characterizeContent).not.toHaveBeenCalled();
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    for (const b of blocks) {
      expect(b.props.population).toBeUndefined();
    }
  });
});
