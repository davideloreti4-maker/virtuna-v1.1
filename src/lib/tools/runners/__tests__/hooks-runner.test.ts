/**
 * hooks-runner.test.ts — runHooksPipeline unit tests (S3′ generate-rate-rank rebaseline).
 *
 * Contract under test (S3′):
 *   - generate exactly HOOK_COUNT (5) hooks, ONE batched SIM call, KEEP-ALL (rank), ≤5 cards
 *   - RANK INVARIANT (D-01/D-02): block[0].rank===1, bands non-increasing (Strong>Mixed>Weak)
 *   - fraction tie-break within same band tier
 *   - D-04 LEAD-QUOTE INVARIANT: every returned hook-card has scrollQuote on the face
 *   - audience-archetype tag present (D-03) and never a craft slug (D-04)
 *   - Weak-band hooks are KEPT and ranked last (keep-all); NOT dropped
 *   - all-Weak input → still returns 5 cards ranked by fraction (keep-all, no regen)
 *   - hard batch failure (throws) → 0 cards + warning (no regen — D-06 removed)
 *   - caps at 5 survivors even if model over-emits (D-08 safety bound)
 *   - cold-start (null profile) / anchor-only produces ranked hooks
 *   - runFlashTextModeBatch called ONCE per pipeline run (not N parallel calls)
 *   - batch receives candidates ids "0","1",... and correct framing/panel/intent
 *   - each card carries props.personas (length 10) — S3′ per-card reaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HookCardBlock } from "@/lib/tools/blocks";

// ─── Mock Qwen client ─────────────────────────────────────────────────────────

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

// ─── Mock runFlashTextModeBatch (S3′ — batch SIM) ────────────────────────────

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextModeBatch: vi.fn(),
}));

// ─── Mock pinPredictedSignature (FLYWHEEL-02) ─────────────────────────────────
vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled hooks bundle"),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10 personas: 8 stop → Strong band (8/10 stop) */
function makePersonasStrong() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "tough_crowd" : `arch_${i}`,
    verdict: i < 8 ? "stop" : "scroll",
    quote: `Strong quote from persona ${i}`,
  }));
}

/** 10 personas: 5 stop → Mixed band (5/10 stop) */
function makePersonasMixed() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "niche_deep_buyer" : `arch_${i}`,
    verdict: i < 5 ? "stop" : "scroll",
    quote: `Mixed quote from persona ${i}`,
  }));
}

/** 10 personas: 4 stop → Mixed band (4/10 stop, just above MIXED_THRESHOLD=3) */
function makePersonasMixedLow() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 4 ? "stop" : "scroll",
    quote: `Mixed-low quote from persona ${i}`,
  }));
}

/** 10 personas: 2 stop → Weak band (2/10 stop, sub-floor) */
function makePersonasWeak() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 2 ? "stop" : "scroll",
    quote: `Weak persona quote ${i}`,
  }));
}

/**
 * Structured JSON generation response with `count` hooks.
 * S3′: generate exactly HOOK_COUNT (5) by default.
 */
function makeStructuredHookResponse(count = 5) {
  return {
    hooks: Array.from({ length: count }, (_, i) => ({
      hookLine: `Executable hook line ${i + 1} — the verbatim text`,
      mechanism: `Attention mechanism for hook ${i + 1} — plain prose, no craft slug`,
      seedHook: `Seed hook text ${i + 1}`,
      channel: i % 3 === 0 ? "spoken" : i % 3 === 1 ? "visual" : null,
      needsTake: i % 2 === 0,
    })),
  };
}

/**
 * Build a batch result Map where every candidate gets the same personas.
 * candidates is the array passed to runFlashTextModeBatch by the runner.
 */
function makeBatchResult(
  candidates: { id: string; text: string }[],
  personas: ReturnType<typeof makePersonasStrong>,
) {
  return {
    results: new Map(candidates.map((c) => [c.id, { personas }])),
    warnings: [] as string[],
  };
}

/**
 * Build a batch result Map with per-candidate personas arrays.
 * personasForIndex maps index (number) → personas array.
 */
function makeBatchResultPerCandidate(
  candidates: { id: string; text: string }[],
  personasForIndex: (idx: number) => ReturnType<typeof makePersonasStrong>,
) {
  return {
    results: new Map(candidates.map((c, i) => [c.id, { personas: personasForIndex(i) }])),
    warnings: [] as string[],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runHooksPipeline (runner — S3′ generate-rate-rank)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates 5 hooks, calls runFlashTextModeBatch ONCE, returns ≤5 ranked cards", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasMixed())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "Generate hooks for my fitness idea",
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
      anchor: "5 fitness myths that sabotage your gains",
    });

    // ONE batched SIM call per pipeline run (not N parallel calls)
    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    // Exactly one generation call
    expect(mockCreate).toHaveBeenCalledTimes(1);

    expect(result.blocks.length).toBeLessThanOrEqual(5);
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.seedHookPath).toBe("structured");
    for (const block of result.blocks) {
      expect(block.type).toBe("hook-card");
    }
  });

  it("runFlashTextModeBatch receives 'hook' framing, correct panel, and candidate ids '0','1',... (HOOKS-02)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasMixed())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: {
        niche_primary: "fitness",
        niche_sub: null,
        target_audience: null,
        primary_goal: null,
        past_wins: null,
        past_flops: null,
        target_platforms: null,
      },
      anchor: "an idea",
    });

    // Exactly ONE batch call
    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    const [candidates, framing, panel] = (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mock.calls[0]!;

    // framing arg = "hook"
    expect(framing).toBe("hook");
    // panel must carry contentType: null
    expect(panel).toMatchObject({ contentType: null });
    // candidate ids must be "0", "1", "2" (generation-index strings)
    expect(candidates).toHaveLength(3);
    expect(candidates[0].id).toBe("0");
    expect(candidates[1].id).toBe("1");
    expect(candidates[2].id).toBe("2");
  });

  it("RANK INVARIANT (D-01/D-02): rank 1 first, Strong ranks above Mixed, Weak kept and ranked last", async () => {
    // S3′ KEEP-ALL: Weak is no longer dropped — it stays in the result, ranked last.
    // Old behavior: 4 hooks → 3 survivors (Weak dropped) → 3 cards.
    // New behavior: 4 hooks → 4 survivors (Weak kept, ranked after Mixed) → 4 cards.
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(4)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // hook 0: Mixed, hook 1: Strong, hook 2: Mixed, hook 3: Weak (kept, ranked last)
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(
          makeBatchResultPerCandidate(candidates, (i) => {
            if (i === 0) return makePersonasMixed();   // Mixed 5/10
            if (i === 1) return makePersonasStrong();  // Strong 8/10
            if (i === 2) return makePersonasMixed();   // Mixed 5/10
            return makePersonasWeak();                  // Weak 2/10 — kept, ranked last
          }),
        ),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "fitness idea",
    });

    // 4 survivors (all kept — keep-all): rank 1=Strong, rank 2+3=Mixed, rank 4=Weak
    expect(result.blocks.length).toBe(4);
    expect(result.blocks[0]!.props.rank).toBe(1);
    expect(result.blocks[0]!.props.band).toBe("Strong");
    expect(result.blocks[1]!.props.rank).toBe(2);
    expect(result.blocks[1]!.props.band).toBe("Mixed");
    expect(result.blocks[2]!.props.rank).toBe(3);
    expect(result.blocks[2]!.props.band).toBe("Mixed");
    expect(result.blocks[3]!.props.rank).toBe(4);
    expect(result.blocks[3]!.props.band).toBe("Weak");

    // Ranks consecutive starting at 1
    for (let i = 0; i < result.blocks.length; i++) {
      expect(result.blocks[i]!.props.rank).toBe(i + 1);
    }
  });

  it("fraction tie-break: higher stop-count ranks first within same band tier", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // All Mixed, different stop counts: hook0=4 stops, hook1=5 stops, hook2=4 stops
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(
          makeBatchResultPerCandidate(candidates, (i) => {
            if (i === 1) return makePersonasMixed();    // 5/10
            return makePersonasMixedLow();               // 4/10
          }),
        ),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "idea",
    });

    // hook1 (5 stops) ranks #1, 4-stop ones rank #2 and #3
    expect(result.blocks.length).toBe(3);
    expect(result.blocks[0]!.props.fraction).toBe("5/10 stop");
    expect(result.blocks[0]!.props.rank).toBe(1);
  });

  it("D-04 LEAD-QUOTE INVARIANT: every returned hook-card has scrollQuote populated on the face", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasStrong())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    for (const block of result.blocks) {
      const card = block as HookCardBlock;
      expect(typeof card.props.scrollQuote).toBe("string");
      expect(card.props.scrollQuote.length).toBeGreaterThan(0);
    }
  });

  it("audience-archetype tag present (D-03), never a craft slug (D-04)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasMixed())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "idea",
    });

    for (const block of result.blocks) {
      const card = block as HookCardBlock;
      // Audience archetype must be present and non-empty
      expect(typeof card.props.audienceArchetype).toBe("string");
      expect(card.props.audienceArchetype.length).toBeGreaterThan(0);
      // Must NOT be a craft slug (D-04)
      const craftSlugs = ["BOLD", "GAP", "CONTRARIAN", "RESEARCH", "NARRATIVE", "QUESTION"];
      for (const slug of craftSlugs) {
        expect(card.props.audienceArchetype).not.toContain(slug);
      }
      // mechanism must also not be a craft slug
      for (const slug of craftSlugs) {
        expect(card.props.mechanism).not.toContain(slug);
      }
    }
  });

  it("keep-all: all-Weak input → 5 cards ranked by fraction (Weak kept, no regen)", async () => {
    // S3′ behavior: Weak is no longer dropped. All 5 candidates rate Weak → 5 Weak cards returned.
    // No regen (D-06 removed). ONE batch call total.
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasWeak())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    // All 5 Weak hooks kept — 5 cards returned (keep-all, no regen)
    expect(result.blocks.length).toBe(5);
    for (const block of result.blocks) {
      expect(block.props.band).toBe("Weak");
    }
    // Ranks still consecutive 1-5
    for (let i = 0; i < result.blocks.length; i++) {
      expect(result.blocks[i]!.props.rank).toBe(i + 1);
    }
    // Exactly ONE batch call, ONE generation call — no regen
    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("hard batch failure (throws) → 0 cards + warning in result (no regen — D-06 removed)", async () => {
    // When runFlashTextModeBatch throws, the runner catches → returns [] with a warning.
    // No second generation call, no retry loop.
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(5)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DashScope timeout"),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    // Hard failure → 0 cards
    expect(result.blocks.length).toBe(0);
    // Warning must mention the failure
    expect(result.warnings.some((w) => w.includes("Batched SIM failed"))).toBe(true);
    // ONE batch attempt only — no retry
    expect(runFlashTextModeBatch).toHaveBeenCalledTimes(1);
    // ONE generation call — no regen
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("caps at MAX_HOOKS (5) even if model over-emits (D-08 safety bound)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    // Model returns 7 hooks (over-emit)
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(7)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasStrong())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    // Safety bound: never more than 5 cards
    expect(result.blocks.length).toBe(5);
    // All 5 must be Strong (best ranked taken first)
    for (const block of result.blocks) {
      expect(block.props.band).toBe("Strong");
    }
  });

  it("cold-start (null profile) / anchor-only still produces ranked hooks (D-09)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasMixed())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "",
      platform: "tiktok",
      profileRow: null,
      anchor: "5 fitness myths",
    });

    expect(result.blocks.length).toBeGreaterThan(0);
    // First block must have rank 1
    expect(result.blocks[0]!.props.rank).toBe(1);
    // Panel passed to batch must carry niche: null (cold-start niche falls back)
    const [, , panel] = (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(panel).toMatchObject({ niche: null, contentType: null });
  });

  it("band/fraction/model embedded in each hook-card block (D-02/D-04/D-10)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasMixed())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    for (const block of result.blocks) {
      const card = block as HookCardBlock;
      expect(["Strong", "Mixed", "Weak"]).toContain(card.props.band);
      expect(card.props.fraction).toMatch(/\d+\/10 stop/);
      expect(card.props.model).toBe("sim1-flash");
    }
  });

  it("each block passes HookCardBlockSchema validation (D-14 belt-and-suspenders)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasStrong())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { HookCardBlockSchema } = await import("@/lib/tools/blocks");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "fitness idea",
    });

    for (const block of result.blocks) {
      const validation = HookCardBlockSchema.safeParse(block);
      expect(validation.success).toBe(true);
    }
  });

  it("S3′: each hook-card carries props.personas (length 10) — per-card reaction modal", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasMixed())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      const card = block as HookCardBlock;
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

describe("runHooksPipeline — FLYWHEEL-02 predicted pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pins the rank-1 hook's personas with the run's audience_id + analysis_id", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
    const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(5)) } }],
          }),
        },
      },
    });
    const leadPersonas = makePersonasStrong();
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, leadPersonas)),
    );

    const supabase = {} as never;
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    await runHooksPipeline({
      ask: "Hooks",
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
            choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(5)) } }],
          }),
        },
      },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasStrong())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    await runHooksPipeline({
      ask: "Hooks",
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
            choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(5)) } }],
          }),
        },
      },
    });
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makePersonasStrong())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    await runHooksPipeline({ ask: "Hooks", platform: "tiktok", profileRow: null });

    expect(pinPredictedSignature).not.toHaveBeenCalled();
  });
});

// ─── PER-PERSONA GENERATION (target binding) ──────────────────────────────────
//
// The audience was MEASURED not to steer the WRITING (handoff §4c: 20 runs, two independent
// methods, both at chance). So the persona stops being ambient CONTEXT and becomes an explicit
// ASSIGNMENT the model must name back. These tests guard the binding — which is precisely the
// part that broke on the first live run while every one of the 3,600 tests stayed green.

const targetedAudience = {
  ...(calibratedAudience as object),
  id: "aud-targeted",
  is_general: false,
  personas: [
    { archetype: "lurker", repaint: "Passively consumes the spectacle.", temperature: "cold", disposition: "scanner", share: 0.2 },
    { archetype: "saver", repaint: "Saves to rewatch frame-by-frame.", temperature: "warm", disposition: "collector", share: 0.15 },
    { archetype: "loyalist", repaint: "Defends the creator against critics.", temperature: "hot", disposition: "connector", share: 0.1 },
    { archetype: "niche_deep_buyer", repaint: "Deeply invested; buys the course.", temperature: "hot", disposition: "converter", share: 0.05 },
    { archetype: "cross_niche_curiosity", repaint: "Here for the trend, not the creator.", temperature: "cold", disposition: "scanner", share: 0.05 },
  ],
} as never;

/** A SIM panel that contains the real archetypes, so a target can find its own reaction. */
function makeTargetedPanel() {
  return [
    { archetype: "lurker", verdict: "stop", quote: "Had to check if that was real." },
    { archetype: "saver", verdict: "stop", quote: "Pausing this frame by frame." },
    { archetype: "loyalist", verdict: "stop", quote: "He always delivers." },
    { archetype: "niche_deep_buyer", verdict: "scroll", quote: "Seen this technique already." },
    { archetype: "cross_niche_curiosity", verdict: "stop", quote: "The trend brought me here." },
    { archetype: "high_engager", verdict: "stop", quote: "Commenting now." },
    { archetype: "sharer", verdict: "stop", quote: "Sending to my group chat." },
    { archetype: "tough_crowd", verdict: "scroll", quote: "Seen better." },
    { archetype: "purposeful_viewer", verdict: "stop", quote: "Useful." },
    { archetype: "niche_deep_scout", verdict: "scroll", quote: "Not deep enough." },
  ];
}

function mockQwenReturning(hooks: unknown[]) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ hooks }) } }],
        }),
      },
    },
  };
}

function targetedHooks(targetArchetypes: string[]) {
  return targetArchetypes.map((targetArchetype, i) => ({
    hookLine: `Hook line ${i + 1}`,
    mechanism: `Mechanism ${i + 1}`,
    seedHook: `Seed ${i + 1}`,
    channel: null,
    needsTake: false,
    targetArchetype,
  }));
}

describe("runHooksPipeline — per-persona generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 🔴 THE LIVE BUG, PINNED. The assignment list renders each person as `1. [lurker] …` and the
   * contract said "use the exact bracketed slug" — so the model returned `"[lurker]"`, brackets
   * and all. The assignment map is keyed on the bare slug, every lookup missed, and EVERY card
   * silently lost its target line. The writer had complied perfectly; the BINDING broke.
   *
   * tsc, eslint and 3,600 unit tests were green. One live run caught it in two minutes.
   *
   * Revert normalizeTargetArchetype and this test goes red — and the feature is dead again.
   */
  it("binds a BRACKETED slug — the model returns \"[lurker]\", not \"lurker\" (live-caught)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(
        targetedHooks(["[lurker]", "[loyalist]", "[niche_deep_buyer]", "[cross_niche_curiosity]", "[saver]"]),
      ),
    );
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makeTargetedPanel())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({
      ask: "a levitation illusion",
      platform: "tiktok",
      profileRow: null,
      audience: targetedAudience,
    });

    expect(blocks).toHaveLength(5);
    // EVERY card names its reader. Before the fix: zero did.
    for (const b of blocks) {
      expect(b.props.target).toBeDefined();
      expect(b.props.target!.archetype).not.toMatch(/[[\]]/); // brackets never reach the card
    }
    expect(new Set(blocks.map((b) => b.props.target!.archetype))).toEqual(
      new Set(["lurker", "loyalist", "niche_deep_buyer", "cross_niche_curiosity", "saver"]),
    );
  });

  it("tolerates the other decorations a model reasonably adds (quotes, case, spaces)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(
        targetedHooks(['"lurker"', "  LOYALIST  ", "niche deep buyer", "`cross_niche_curiosity`", "Saver"]),
      ),
    );
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makeTargetedPanel())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({
      ask: "Hooks",
      platform: "tiktok",
      profileRow: null,
      audience: targetedAudience,
    });

    expect(blocks.every((b) => b.props.target !== undefined)).toBe(true);
  });

  /**
   * THE HONEST FAILURE. A writer that ignores its assignment must produce a card with NO target
   * line — never a generic hook wearing a personalised label. This is the runtime tripwire for
   * the §4c failure mode, and it is the assertion that keeps the feature honest if a future model
   * stops complying.
   */
  it("drops the target line — never mislabels — when the model names a slug we never assigned", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedHooks(["tough_crowd", "", "not_a_real_slug", "lurker", "saver"])),
    );
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makeTargetedPanel())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks, warnings } = await runHooksPipeline({
      ask: "Hooks",
      platform: "tiktok",
      profileRow: null,
      audience: targetedAudience,
    });

    const targeted = blocks.filter((b) => b.props.target);
    // `tough_crowd` is a REAL archetype but was never ASSIGNED (it is not on this audience) —
    // so it must not bind. Only the two genuinely-assigned slugs survive.
    expect(new Set(targeted.map((b) => b.props.target!.archetype))).toEqual(
      new Set(["lurker", "saver"]),
    );
    expect(warnings.some((w) => /never assigned|named no target/.test(w))).toBe(true);
  });

  /** The receipt: the aimed-at reader's OWN verdict + OWN words, looked up — never invented. */
  it("carries the TARGET's own SIM reaction, not the lead quote", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedHooks(["niche_deep_buyer", "saver", "lurker", "loyalist", "cross_niche_curiosity"])),
    );
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makeTargetedPanel())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({
      ask: "Hooks",
      platform: "tiktok",
      profileRow: null,
      audience: targetedAudience,
    });

    const buyer = blocks.find((b) => b.props.target?.archetype === "niche_deep_buyer");
    // A MISS is reported as plainly as a hit — the buyer scrolled past the hook aimed at them,
    // and that is the single most useful thing this card can say. Hiding it makes it decorative.
    expect(buyer!.props.target!.verdict).toBe("scroll");
    expect(buyer!.props.target!.quote).toBe("Seen this technique already.");

    const saver = blocks.find((b) => b.props.target?.archetype === "saver");
    expect(saver!.props.target!.verdict).toBe("stop");
    expect(saver!.props.target!.quote).toBe("Pausing this frame by frame.");
  });

  /** THE REGRESSION GATE. General has no real people — it must be byte-identical to before. */
  it("General: no assignment block in the prompt, and no target on any card", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const client = mockQwenReturning(targetedHooks(["lurker", "saver", "lurker", "saver", "lurker"]));
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makeTargetedPanel())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({
      ask: "Hooks",
      platform: "tiktok",
      profileRow: null,
      audience: generalAudience,
    });

    // Even though the model volunteered targetArchetypes, an uncalibrated run names NOBODY.
    expect(blocks.every((b) => b.props.target === undefined)).toBe(true);

    // `assembleBundle` is mocked to a constant here, so the assignment block must be asserted on
    // the OVERRIDES handed to it — asserting the returned user message would pass trivially and
    // prove nothing (the mock could not contain the block either way).
    const { assembleBundle } = await import("@/lib/kc/assembler");
    const overrides = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0].overrides;
    expect(overrides ?? "").not.toContain("WRITE FOR ONE NAMED PERSON");

    // The SYSTEM prompt is real (not mocked), so the output contract IS assertable there: an
    // uncalibrated run must never even ask for a target.
    const system = client.chat.completions.create.mock.calls[0]![0].messages[0].content;
    expect(system).not.toContain("targetArchetype");
  });

  /** F7: the persona's display name must NEVER reach the model — only archetype + repaint. */
  it("F7: the prompt carries archetype + repaint, and NEVER the persona's display label", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");

    const labelled = {
      ...(targetedAudience as object),
      personas: [
        {
          archetype: "saver",
          repaint: "Saves to rewatch frame-by-frame.",
          temperature: "warm",
          disposition: "collector",
          share: 0.6,
          label: "The Frame Detectives",
        },
      ],
    } as never;

    const client = mockQwenReturning(targetedHooks(["saver", "saver", "saver", "saver", "saver"]));
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
    (runFlashTextModeBatch as ReturnType<typeof vi.fn>).mockImplementation(
      (candidates: { id: string; text: string }[]) =>
        Promise.resolve(makeBatchResult(candidates, makeTargetedPanel())),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({
      ask: "Hooks",
      platform: "tiktok",
      profileRow: null,
      audience: labelled,
    });

    // The assignment block travels as `overrides` into assembleBundle (mocked to a constant here),
    // so THAT is where F7 is assertable — the mocked return value would prove nothing.
    const { assembleBundle } = await import("@/lib/kc/assembler");
    const overrides: string =
      (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0].overrides ?? "";

    expect(overrides).toContain("Saves to rewatch frame-by-frame."); // the repaint DOES reach the model
    expect(overrides).toContain("[saver]");                          // the binding key DOES
    expect(overrides).not.toContain("The Frame Detectives");         // 🔴 the LABEL never does (F7)

    // …and the label still reaches the CARD, where it is a display string, not prompt input.
    expect(blocks[0]!.props.target!.label).toBe("The Frame Detectives");
  });
});
