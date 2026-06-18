/**
 * hooks-runner.test.ts — runHooksPipeline unit tests (Task 1, plan 04-02).
 *
 * Tests:
 *   - over-generate (~8) → parallel niche SIM → gate (band !== "Weak") → rank → ≤5 hook-card blocks
 *   - RANK INVARIANT (D-01/D-02): block[0].rank===1, bands non-increasing (Strong before Mixed)
 *   - fraction tie-break within same band tier
 *   - D-04 LEAD-QUOTE INVARIANT: every returned hook-card has scrollQuote populated on the face
 *   - audience-archetype tag present (D-03) and never a craft slug (D-04)
 *   - drops Weak-band hooks (sub-floor); zero survivors is valid (no regen — D-03)
 *   - caps at 5 survivors (D-08) even if more than 5 pass
 *   - cold-start (null profile) / anchor-only produces ranked hooks (niche falls back to null)
 *   - SIM called with "hook" framing + { niche, contentType: null } panel
 *   - no regen loop: Flash called exactly once per candidate (D-03)
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

// ─── Mock runFlashTextMode ────────────────────────────────────────────────────

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: vi.fn(),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled hooks bundle"),
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

/** 10 personas: 5 stop → Mixed band (above gate floor) */
function makePersonasMixed() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "niche_deep_buyer" : `arch_${i}`,
    verdict: i < 5 ? "stop" : "scroll",
    quote: `Mixed quote from persona ${i}`,
  }));
}

/** 10 personas: 4 stop → Mixed band (just above gate floor: MIXED_THRESHOLD=3) */
function makePersonasMixedLow() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 4 ? "stop" : "scroll",
    quote: `Mixed-low quote from persona ${i}`,
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

/** Structured JSON generation response with `count` hooks */
function makeStructuredHookResponse(count = 8) {
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runHooksPipeline (runner)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("over-generates ~8 hooks, SIMs in parallel with 'hook' framing, returns ≤5 ranked cards", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(8)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

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
        user_id: "user-123",
      },
      anchor: "5 fitness myths that sabotage your gains",
    });

    expect(result.blocks.length).toBeLessThanOrEqual(5);
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.seedHookPath).toBe("structured");
    for (const block of result.blocks) {
      expect(block.type).toBe("hook-card");
    }
  });

  it("SIM is called with 'hook' framing and { niche, contentType: null } panel (HOOKS-02)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: { niche_primary: "fitness", niche_sub: null, target_audience: null, primary_goal: null, past_wins: null, past_flops: null, target_platforms: null, user_id: "u1" },
      anchor: "an idea",
    });

    // Each SIM call must use the "hook" framing
    const calls = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of calls) {
      expect(call[1]).toBe("hook"); // framing arg
      expect(call[2]).toMatchObject({ contentType: null });
    }
  });

  it("RANK INVARIANT (D-01/D-02): rank 1 first, bands non-increasing, Strong ranks above Mixed", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(4)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // hook 0: Mixed, hook 1: Strong, hook 2: Mixed, hook 3: Weak (dropped)
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ result: { personas: makePersonasMixed() }, warnings: [] })  // Mixed 5/10
      .mockResolvedValueOnce({ result: { personas: makePersonasStrong() }, warnings: [] }) // Strong 8/10
      .mockResolvedValueOnce({ result: { personas: makePersonasMixed() }, warnings: [] })  // Mixed 5/10
      .mockResolvedValueOnce({ result: { personas: makePersonasWeak() }, warnings: [] });  // Weak → dropped

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "fitness idea",
    });

    // 3 survivors (1 Weak dropped): rank 1 = Strong, rank 2 + 3 = Mixed
    expect(result.blocks.length).toBe(3);
    expect(result.blocks[0]!.props.rank).toBe(1);
    expect(result.blocks[0]!.props.band).toBe("Strong");
    expect(result.blocks[1]!.props.rank).toBe(2);
    expect(result.blocks[1]!.props.band).toBe("Mixed");
    expect(result.blocks[2]!.props.rank).toBe(3);
    expect(result.blocks[2]!.props.band).toBe("Mixed");

    // Ranks must be consecutive starting at 1
    for (let i = 0; i < result.blocks.length; i++) {
      expect(result.blocks[i]!.props.rank).toBe(i + 1);
    }
  });

  it("fraction tie-break: higher stop-count ranks first within same band tier", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    // All Mixed, but different stop counts: hook1=4 stops, hook2=5 stops, hook3=4 stops
    (runFlashTextMode as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ result: { personas: makePersonasMixedLow() }, warnings: [] }) // 4/10
      .mockResolvedValueOnce({ result: { personas: makePersonasMixed() }, warnings: [] })    // 5/10
      .mockResolvedValueOnce({ result: { personas: makePersonasMixedLow() }, warnings: [] }); // 4/10

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "idea",
    });

    // hook2 (5 stops) ranks #1, the 4-stop ones rank #2 and #3
    expect(result.blocks.length).toBe(3);
    expect(result.blocks[0]!.props.fraction).toBe("5/10 stop");
    expect(result.blocks[0]!.props.rank).toBe(1);
  });

  it("D-04 LEAD-QUOTE INVARIANT: every returned hook-card has scrollQuote populated on the face", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

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
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

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

  it("drops all Weak-band hooks and returns 0 blocks (no regen loop — D-03)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(8)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasWeak() },
      warnings: [],
    });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    expect(result.blocks.length).toBe(0);
    // Flash called exactly once per hook candidate — no regen
    expect(runFlashTextMode).toHaveBeenCalledTimes(8);
  });

  it("caps at MAX_HOOKS (5) even if more than 5 pass the gate (D-08)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(8)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({
      ask: "hooks",
      platform: "tiktok",
      profileRow: null,
      anchor: "an idea",
    });

    expect(result.blocks.length).toBe(5);
    // All 5 must be Strong (best ranked are taken first)
    for (const block of result.blocks) {
      expect(block.props.band).toBe("Strong");
    }
  });

  it("cold-start (null profile) / anchor-only still produces ranked hooks (D-09)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

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
    // SIM must be called with niche: null (cold-start niche falls back)
    const calls = (runFlashTextMode as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of calls) {
      expect(call[2]).toMatchObject({ niche: null, contentType: null });
    }
  });

  it("band/fraction/model embedded in each hook-card block (D-02/D-04/D-10)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(2)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasMixed() },
      warnings: [],
    });

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
    const { runFlashTextMode } = await import("@/lib/engine/flash/run-flash-text-mode");

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(makeStructuredHookResponse(3)) } }],
    });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });
    (runFlashTextMode as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { personas: makePersonasStrong() },
      warnings: [],
    });

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
});
