/**
 * hooks-runner.test.ts — runHooksPipeline unit tests (NEW QWEN CALL SYSTEM, 2026-07-22).
 *
 * The pipeline collapsed from 2 calls to 1: the persona SIM (runFlashTextModeBatch) is GONE from
 * the generation path. The single generation call now self-estimates each hook's stop-count
 * (`personaStops` /10) + a `stopQuote`; the runner derives the PROJECTED band/fraction from that,
 * ranks best→worst by the /10, and labels every card provenance:"projected". The persona cast +
 * population projection are MEASURED artefacts that moved to the user-fired simulation.
 *
 * Contract under test:
 *   - generate exactly HOOK_COUNT (5), ONE Qwen call, NO SIM / characterize / pin call on this path
 *   - band/fraction derived from personaStops (8→Strong 8/10, 5→Mixed 5/10, 2→Weak 2/10)
 *   - RANK: best→worst by personaStops desc, tie-break generation order
 *   - provenance:"projected" on every card; scrollQuote = the gen call's stopQuote
 *   - personas + population ABSENT (they belong to the fired sim now)
 *   - visualHook wiring preserved; schema validation holds
 *   - per-persona ASSIGNMENT (the measured win #299) preserved; the target's reaction half is now
 *     null (verdict/quote), because no SIM ran — it arrives when the room is fired
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

// ─── Mock the REMOVED SIM-path modules — asserted NEVER called (contract lock) ──
// The whole point of the new call system: the generation path makes ONE call and never touches the
// persona SIM, the content-characterizer, or the flywheel pin. Mocking them lets each test PROVE
// that — if a future edit re-introduces a second call on this path, these assertions go red.

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextModeBatch: vi.fn(),
  runFlashTextMode: vi.fn(),
}));

vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: vi.fn(),
}));

vi.mock("@/lib/tools/runners/predicted-pin", () => ({
  pinPredictedSignature: vi.fn().mockResolvedValue(true),
}));

// ─── Mock assembleBundle ──────────────────────────────────────────────────────

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: vi.fn(() => "mock assembled hooks bundle"),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Structured JSON generation response with `count` hooks. The single gen call now emits the
 * projection fields too — `personaStops` (/10) + `stopQuote`. `stopsFn` sets the per-hook stop
 * estimate (defaults to 8 → Strong), so a test can drive the band + rank precisely.
 */
function makeStructuredHookResponse(count = 5, stopsFn?: (i: number) => number) {
  return {
    hooks: Array.from({ length: count }, (_, i) => ({
      hookLine: `Executable hook line ${i + 1} — the verbatim text`,
      mechanism: `Attention mechanism for hook ${i + 1} — plain prose, no craft slug`,
      seedHook: `Seed hook text ${i + 1}`,
      channel: i % 3 === 0 ? "spoken" : i % 3 === 1 ? "visual" : null,
      needsTake: i % 2 === 0,
      personaStops: stopsFn ? stopsFn(i) : 8, // default Strong
      stopQuote: `Stop quote from hook ${i + 1}`,
    })),
  };
}

/** Mock the Qwen client to return a given structured-hooks response from ONE create() call. */
function mockQwen(response: unknown) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(response) } }],
  });
  return { client: { chat: { completions: { create } } }, create };
}

/** Assert none of the removed second-call machinery ran (the "one call" contract). */
async function expectNoSecondCall() {
  const { runFlashTextModeBatch } = await import("@/lib/engine/flash/run-flash-text-mode");
  const { characterizeContent } = await import("@/lib/audience/characterize-content");
  const { pinPredictedSignature } = await import("@/lib/tools/runners/predicted-pin");
  expect(runFlashTextModeBatch).not.toHaveBeenCalled();
  expect(characterizeContent).not.toHaveBeenCalled();
  expect(pinPredictedSignature).not.toHaveBeenCalled();
}

// ─── Core pipeline ──────────────────────────────────────────────────────────────

describe("runHooksPipeline (new call system — generate-and-project)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates 5 hooks in ONE Qwen call, makes NO SIM/characterize/pin call, returns ≤5 cards", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { create, client } = mockQwen(makeStructuredHookResponse(5));
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

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

    // Exactly ONE generation call, and nothing else.
    expect(create).toHaveBeenCalledTimes(1);
    await expectNoSecondCall();

    expect(result.blocks.length).toBeLessThanOrEqual(5);
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.seedHookPath).toBe("structured");
    for (const block of result.blocks) {
      expect(block.type).toBe("hook-card");
    }
  });

  it("every card is provenance:\"projected\" and carries NO personas / population (measured artefacts move to the fired sim)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredHookResponse(3)).client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const card = block as HookCardBlock;
      expect(card.props.provenance).toBe("projected");
      expect(card.props.personas).toBeUndefined();
      expect(card.props.population).toBeUndefined();
      expect(card.props.model).toBe("sim1-flash"); // provenance:"projected" is the honesty discriminator, not model
    }
  });

  it("derives band/fraction from personaStops: 8→Strong 8/10, 5→Mixed 5/10, 2→Weak 2/10", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    // hook0=8 (Strong), hook1=5 (Mixed), hook2=2 (Weak)
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredHookResponse(3, (i) => [8, 5, 2][i]!)).client,
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    const byFraction = new Map(blocks.map((b) => [b.props.fraction, b.props.band]));
    expect(byFraction.get("8/10 stop")).toBe("Strong");
    expect(byFraction.get("5/10 stop")).toBe("Mixed");
    expect(byFraction.get("2/10 stop")).toBe("Weak");
  });

  it("RANK: best→worst by the projected /10; rank 1 first, bands non-increasing, Weak kept last", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    // gen order 0..3 with stops [5,8,5,2] → sorted desc: 8(Strong), 5, 5, 2(Weak)
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredHookResponse(4, (i) => [5, 8, 5, 2][i]!)).client,
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(4);
    expect(blocks[0]!.props.rank).toBe(1);
    expect(blocks[0]!.props.band).toBe("Strong");
    expect(blocks[3]!.props.band).toBe("Weak");
    // Ranks consecutive from 1; stop-counts non-increasing down the list.
    const stops = blocks.map((b) => Number(/^(\d+)\//.exec(b.props.fraction)![1]));
    for (let i = 0; i < blocks.length; i++) {
      expect(blocks[i]!.props.rank).toBe(i + 1);
      if (i > 0) expect(stops[i]!).toBeLessThanOrEqual(stops[i - 1]!);
    }
  });

  it("tie-break: equal /10 preserves generation order", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    // gen order [4,5,4] → 5 ranks first; the two 4s keep generation order (i0 before i2)
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredHookResponse(3, (i) => [4, 5, 4][i]!)).client,
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    expect(blocks[0]!.props.fraction).toBe("5/10 stop");
    expect(blocks[0]!.props.rank).toBe(1);
    // Both 4/10 hooks survive; the earlier-generated (hookLine 1) ranks above the later (hookLine 3).
    expect(blocks[1]!.props.hookLine).toContain("hook line 1");
    expect(blocks[2]!.props.hookLine).toContain("hook line 3");
  });

  it("keep-all: all-Weak input → 5 cards ranked, none dropped, ONE call", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { create } = mockQwen(makeStructuredHookResponse(5, () => 2)); // all 2/10 → Weak
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({ chat: { completions: { create } } });

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(5);
    for (const b of blocks) expect(b.props.band).toBe("Weak");
    for (let i = 0; i < blocks.length; i++) expect(blocks[i]!.props.rank).toBe(i + 1);
    expect(create).toHaveBeenCalledTimes(1);
    await expectNoSecondCall();
  });

  it("empty generation ({hooks:[]}) → 0 cards, no throw", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen({ hooks: [] }).client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const result = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });
    expect(result.blocks.length).toBe(0);
  });

  it("caps at HOOK_COUNT (5) even if the model over-emits (safety bound)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredHookResponse(7)).client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });
    expect(blocks.length).toBe(5);
  });

  it("LEAD-QUOTE INVARIANT: scrollQuote is the gen call's stopQuote, on every card face", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredHookResponse(3)).client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    for (const b of blocks) {
      expect(typeof b.props.scrollQuote).toBe("string");
      expect(b.props.scrollQuote.length).toBeGreaterThan(0);
      expect(b.props.scrollQuote).toMatch(/Stop quote from hook/);
    }
  });

  it("cold-start (null profile) / anchor-only still produces ranked hooks", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredHookResponse(3, (i) => [8, 5, 5][i]!)).client,
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "", platform: "tiktok", profileRow: null, anchor: "5 fitness myths" });

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]!.props.rank).toBe(1);
    // Uncalibrated run has no audience to tag → the audience-archetype is honestly empty.
    for (const b of blocks) {
      expect(typeof b.props.audienceArchetype).toBe("string");
      expect(b.props.audienceArchetype).toBe("");
      const craftSlugs = ["BOLD", "GAP", "CONTRARIAN", "RESEARCH", "NARRATIVE", "QUESTION"];
      for (const slug of craftSlugs) expect(b.props.mechanism).not.toContain(slug);
    }
  });

  it("wires visualHook: a well-formed {technique,onScreen} flows to the card; null/absent stays spoken-only", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const response = makeStructuredHookResponse(3);
    (response.hooks[0]! as Record<string, unknown>).visualHook = { technique: "crash-zoom", onScreen: "Deadpan face, no text" };
    (response.hooks[1]! as Record<string, unknown>).visualHook = null;
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(response).client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    const withVisual = blocks.find((b) => b.props.hookLine === response.hooks[0]!.hookLine);
    const spokenOnly = blocks.find((b) => b.props.hookLine === response.hooks[1]!.hookLine);
    expect(withVisual!.props.visualHook).toEqual({ technique: "crash-zoom", onScreen: "Deadpan face, no text" });
    expect(spokenOnly!.props.visualHook).toBeUndefined();
  });

  it("each block passes HookCardBlockSchema validation (belt-and-suspenders)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredHookResponse(3)).client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { HookCardBlockSchema } = await import("@/lib/tools/blocks");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    for (const block of blocks) {
      expect(HookCardBlockSchema.safeParse(block).success).toBe(true);
    }
  });

  it("coerces a malformed personaStops to 0 (Weak, ranked last) — never a fabricated high", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const response = makeStructuredHookResponse(2, (i) => [8, 8][i]!);
    (response.hooks[1]! as Record<string, unknown>).personaStops = "not a number";
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(response).client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    // The good hook ranks first (Strong 8/10); the malformed one degrades to 0/10 Weak, ranked last.
    expect(blocks[0]!.props.fraction).toBe("8/10 stop");
    expect(blocks[1]!.props.fraction).toBe("0/10 stop");
    expect(blocks[1]!.props.band).toBe("Weak");
  });
});

// ─── PER-PERSONA GENERATION (target binding) ──────────────────────────────────
//
// The audience was MEASURED not to steer the WRITING (handoff §4c: 20 runs, two independent
// methods, both at chance). So the persona stops being ambient CONTEXT and becomes an explicit
// ASSIGNMENT the model must name back — the measured win (#299, blind judge 60% vs 13.3%). That
// binding is UNCHANGED by the call-system collapse; what changes is the reaction HALF of the
// target — with no SIM on this path, verdict/quote are null (they arrive when the room is fired).

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
    personaStops: 8,
    stopQuote: `Stop ${i + 1}`,
    targetArchetype,
  }));
}

describe("runHooksPipeline — per-persona generation (binding preserved)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 🔴 THE LIVE BUG, PINNED. The assignment list renders each person as `1. [lurker] …` and the
   * contract said "use the exact bracketed slug" — so the model returned `"[lurker]"`, brackets
   * and all, the lookup missed, and EVERY card silently lost its target line. Revert
   * normalizeTargetArchetype and this goes red.
   */
  it("binds a BRACKETED slug — the model returns \"[lurker]\", not \"lurker\" (live-caught)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedHooks(["[lurker]", "[loyalist]", "[niche_deep_buyer]", "[cross_niche_curiosity]", "[saver]"])),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({
      ask: "a levitation illusion",
      platform: "tiktok",
      profileRow: null,
      audience: targetedAudience,
    });

    expect(blocks).toHaveLength(5);
    for (const b of blocks) {
      expect(b.props.target).toBeDefined();
      expect(b.props.target!.archetype).not.toMatch(/[[\]]/); // brackets never reach the card
    }
    expect(new Set(blocks.map((b) => b.props.target!.archetype))).toEqual(
      new Set(["lurker", "loyalist", "niche_deep_buyer", "cross_niche_curiosity", "saver"]),
    );
    // The audience tag now comes from the assignment (was deriveAudienceArchetype(SIM)).
    for (const b of blocks) expect(b.props.audienceArchetype).toBe(b.props.target!.archetype);
  });

  it("tolerates the other decorations a model reasonably adds (quotes, case, spaces)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedHooks(['"lurker"', "  LOYALIST  ", "niche deep buyer", "`cross_niche_curiosity`", "Saver"])),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "Hooks", platform: "tiktok", profileRow: null, audience: targetedAudience });

    expect(blocks.every((b) => b.props.target !== undefined)).toBe(true);
  });

  /**
   * THE HONEST FAILURE. A writer that ignores its assignment must produce a card with NO target
   * line — never a generic hook wearing a personalised label.
   */
  it("drops the target line — never mislabels — when the model names a slug we never assigned", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedHooks(["tough_crowd", "", "not_a_real_slug", "lurker", "saver"])),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks, warnings } = await runHooksPipeline({ ask: "Hooks", platform: "tiktok", profileRow: null, audience: targetedAudience });

    const targeted = blocks.filter((b) => b.props.target);
    // `tough_crowd` is a real archetype but was never ASSIGNED — so it must not bind.
    expect(new Set(targeted.map((b) => b.props.target!.archetype))).toEqual(new Set(["lurker", "saver"]));
    expect(warnings.some((w) => /never assigned|named no target/.test(w))).toBe(true);
  });

  /**
   * THE REACTION HALF IS NOW DEFERRED. With no SIM on the generation path, a bound target names
   * WHO the hook was written for, but its verdict + quote are NULL — the honest "not measured yet".
   * The receipt arrives only when the creator fires the room.
   */
  it("a bound target carries the assignment but a NULL reaction (verdict/quote) — no SIM ran", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedHooks(["niche_deep_buyer", "saver", "lurker", "loyalist", "cross_niche_curiosity"])),
    );

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "Hooks", platform: "tiktok", profileRow: null, audience: targetedAudience });

    const buyer = blocks.find((b) => b.props.target?.archetype === "niche_deep_buyer");
    expect(buyer!.props.target!.archetype).toBe("niche_deep_buyer");
    expect(buyer!.props.target!.verdict).toBeNull();
    expect(buyer!.props.target!.quote).toBeNull();
    await expectNoSecondCall();
  });

  /** THE REGRESSION GATE. General has no real people — no assignment block, no target on any card. */
  it("General: no assignment block in the prompt, and no target on any card", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const client = mockQwenReturning(targetedHooks(["lurker", "saver", "lurker", "saver", "lurker"]));
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "Hooks", platform: "tiktok", profileRow: null, audience: generalAudience });

    expect(blocks.every((b) => b.props.target === undefined)).toBe(true);

    const { assembleBundle } = await import("@/lib/kc/assembler");
    const overrides = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0].overrides;
    expect(overrides ?? "").not.toContain("WRITE FOR ONE NAMED PERSON");

    const system = client.chat.completions.create.mock.calls[0]![0].messages[0].content;
    expect(system).not.toContain("targetArchetype");
  });

  /** F7: the persona's display name must NEVER reach the model — only archetype + repaint. */
  it("F7: the prompt carries archetype + repaint, and NEVER the persona's display label", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
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

    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "Hooks", platform: "tiktok", profileRow: null, audience: labelled });

    const { assembleBundle } = await import("@/lib/kc/assembler");
    const overrides: string = (assembleBundle as ReturnType<typeof vi.fn>).mock.calls[0]![0].overrides ?? "";

    expect(overrides).toContain("Saves to rewatch frame-by-frame."); // the repaint DOES reach the model
    expect(overrides).toContain("[saver]");                          // the binding key DOES
    expect(overrides).not.toContain("The Frame Detectives");         // 🔴 the LABEL never does (F7)

    // …and the label still reaches the CARD, where it is a display string, not prompt input.
    expect(blocks[0]!.props.target!.label).toBe("The Frame Detectives");
  });
});
