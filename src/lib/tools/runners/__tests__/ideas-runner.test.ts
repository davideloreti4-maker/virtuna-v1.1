/**
 * ideas-runner.test.ts — runIdeasPipeline unit tests (NEW QWEN CALL SYSTEM, 2026-07-22).
 *
 * The pipeline collapsed from 2 calls to 1 (fan-out from hooks-runner): the persona SIM
 * (runFlashTextModeBatch) is GONE from the generation path. The single generation call now
 * self-estimates each idea's stop-count (`personaStops` /10, on its SEED HOOK) + a `stopQuote`; the
 * runner derives the PROJECTED band/fraction from that, ranks best→worst by the /10 (keep-all), and
 * labels every card provenance:"projected". The per-persona cast + population projection are MEASURED
 * artefacts that moved to the user-fired simulation.
 *
 * Contract under test:
 *   - generate exactly IDEA_COUNT (4), ONE Qwen call, NO SIM / characterize / pin call on this path
 *   - band/fraction derived from personaStops (8→Strong 8/10, 5→Mixed 5/10, 2→Weak 2/10)
 *   - RANK: best→worst by personaStops desc, tie-break generation order (keep-all — Weak kept last)
 *   - provenance:"projected" on every card; scrollQuote = the gen call's stopQuote
 *   - personas + population ABSENT (they belong to the fired sim now)
 *   - per-persona ASSIGNMENT (#299) preserved; the target's reaction half is now null (no SIM ran)
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
  assembleBundle: vi.fn(() => "mock assembled ideas bundle"),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Structured JSON generation response with `count` ideas. The single gen call now emits the
 * projection fields too — `personaStops` (/10) + `stopQuote`. `stopsFn` sets the per-idea stop
 * estimate (defaults to 8 → Strong), so a test can drive the band + rank precisely.
 */
function makeStructuredIdeaResponse(count = 4, stopsFn?: (i: number) => number) {
  return {
    ideas: Array.from({ length: count }, (_, i) => ({
      title: `Idea title ${i + 1}`,
      angle: `Angle for idea ${i + 1}`,
      mechanism: `Mechanism for idea ${i + 1} — plain prose, no craft slug`,
      seedHook: `Seed hook text ${i + 1}`,
      needsTake: i % 2 === 0,
      topic: `Topic ${i + 1}`,
      take: `Take ${i + 1}`,
      format: i % 3 === 0 ? "Talking-head" : null,
      personaStops: stopsFn ? stopsFn(i) : 8, // default Strong
      stopQuote: `Stop quote from idea ${i + 1}`,
    })),
  };
}

/** Mock the Qwen client to return a given structured-ideas response from ONE create() call. */
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

describe("runIdeasPipeline (new call system — generate-and-project)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates 4 ideas in ONE Qwen call, makes NO SIM/characterize/pin call, returns ≤4 cards", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { create, client } = mockQwen(makeStructuredIdeaResponse(4));
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({
      ask: "Generate ideas for my fitness profile",
      platform: "tiktok",
      profileRow: null,
    });

    expect(create).toHaveBeenCalledTimes(1);
    await expectNoSecondCall();

    expect(result.blocks.length).toBeLessThanOrEqual(4);
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    expect(result.seedHookPath).toBe("structured");
    for (const block of result.blocks) {
      expect(block.type).toBe("idea-card");
    }
  });

  it("every card is provenance:\"projected\" and carries NO personas / population (measured artefacts move to the fired sim)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredIdeaResponse(3)).client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const card = block as IdeaCardBlock;
      expect(card.props.provenance).toBe("projected");
      expect(card.props.personas).toBeUndefined();
      expect(card.props.population).toBeUndefined();
      expect(card.props.model).toBe("sim1-flash"); // provenance:"projected" is the honesty discriminator, not model
    }
  });

  it("derives band/fraction from personaStops: 8→Strong 8/10, 5→Mixed 5/10, 2→Weak 2/10", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredIdeaResponse(3, (i) => [8, 5, 2][i]!)).client,
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    const byFraction = new Map(blocks.map((b) => [b.props.fraction, b.props.band]));
    expect(byFraction.get("8/10 stop")).toBe("Strong");
    expect(byFraction.get("5/10 stop")).toBe("Mixed");
    expect(byFraction.get("2/10 stop")).toBe("Weak");
  });

  it("RANK: best→worst by the projected /10 (keep-all — Weak kept last, none dropped)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    // gen order 0..3 with stops [5,8,5,2] → sorted desc: 8(Strong), 5, 5, 2(Weak)
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredIdeaResponse(4, (i) => [5, 8, 5, 2][i]!)).client,
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(4);
    expect(blocks[0]!.props.band).toBe("Strong");
    expect(blocks[3]!.props.band).toBe("Weak");
    // Stop-counts non-increasing down the list.
    const stops = blocks.map((b) => Number(/^(\d+)\//.exec(b.props.fraction)![1]));
    for (let i = 1; i < blocks.length; i++) {
      expect(stops[i]!).toBeLessThanOrEqual(stops[i - 1]!);
    }
  });

  it("tie-break: equal /10 preserves generation order", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    // gen order [4,5,4] → 5 ranks first; the two 4s keep generation order (idea 1 before idea 3)
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwen(makeStructuredIdeaResponse(3, (i) => [4, 5, 4][i]!)).client,
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    expect(blocks[0]!.props.fraction).toBe("5/10 stop");
    expect(blocks[1]!.props.title).toContain("title 1");
    expect(blocks[2]!.props.title).toContain("title 3");
  });

  it("keep-all: all-Weak input → 4 cards, none dropped, ONE call", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const { create } = mockQwen(makeStructuredIdeaResponse(4, () => 2)); // all 2/10 → Weak
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({ chat: { completions: { create } } });

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    expect(blocks.length).toBe(4);
    for (const b of blocks) expect(b.props.band).toBe("Weak");
    expect(create).toHaveBeenCalledTimes(1);
    await expectNoSecondCall();
  });

  it("empty generation ({ideas:[]}) → 0 cards, no throw", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen({ ideas: [] }).client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const result = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });
    expect(result.blocks.length).toBe(0);
  });

  it("caps at IDEA_COUNT (4) even if the model over-emits (safety bound)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredIdeaResponse(7)).client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });
    expect(blocks.length).toBe(4);
  });

  it("LEAD-QUOTE INVARIANT: scrollQuote is the gen call's stopQuote, on every card face", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredIdeaResponse(3)).client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    for (const b of blocks) {
      expect(typeof b.props.scrollQuote).toBe("string");
      expect(b.props.scrollQuote).toMatch(/Stop quote from idea/);
    }
  });

  it("each block passes IdeaCardBlockSchema validation (belt-and-suspenders)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(makeStructuredIdeaResponse(3)).client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { IdeaCardBlockSchema } = await import("@/lib/tools/blocks");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    for (const block of blocks) {
      expect(IdeaCardBlockSchema.safeParse(block).success).toBe(true);
    }
  });

  it("coerces a malformed personaStops to 0 (Weak, ranked last) — never a fabricated high", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const response = makeStructuredIdeaResponse(2, (i) => [8, 8][i]!);
    (response.ideas[1]! as Record<string, unknown>).personaStops = "not a number";
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(mockQwen(response).client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "ideas", platform: "tiktok", profileRow: null });

    expect(blocks[0]!.props.fraction).toBe("8/10 stop");
    expect(blocks[1]!.props.fraction).toBe("0/10 stop");
    expect(blocks[1]!.props.band).toBe("Weak");
  });
});

// ─── PER-PERSONA GENERATION (target binding) ──────────────────────────────────
//
// The audience was MEASURED not to steer the WRITING as prompt context (handoff §4c). So the persona
// becomes an explicit ASSIGNMENT the model must name back — the measured win (#299). That binding is
// UNCHANGED by the call-system collapse; what changes is the reaction HALF of the target — with no
// SIM on this path, verdict/quote are null (they arrive when the room is fired).

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

// Exactly IDEA_COUNT (4) personas, one per weight slot (fyp / niche / loyalist / cross_niche), so
// selectPersonaTargets(4) selects ALL of them — the assignment set is exactly these four archetypes.
const targetedAudience = {
  ...(calibratedAudience as object),
  id: "aud-targeted",
  is_general: false,
  personas: [
    { archetype: "lurker", repaint: "Passively consumes the spectacle.", temperature: "cold", disposition: "scanner", share: 0.4 },
    { archetype: "niche_deep_buyer", repaint: "Deeply invested; buys the course.", temperature: "hot", disposition: "converter", share: 0.3 },
    { archetype: "loyalist", repaint: "Defends the creator against critics.", temperature: "hot", disposition: "connector", share: 0.2 },
    { archetype: "cross_niche_curiosity", repaint: "Here for the trend, not the creator.", temperature: "cold", disposition: "scanner", share: 0.1 },
  ],
} as never;

function mockQwenReturning(ideas: unknown[]) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ ideas }) } }],
        }),
      },
    },
  };
}

function targetedIdeas(targetArchetypes: string[]) {
  return targetArchetypes.map((targetArchetype, i) => ({
    title: `Idea ${i + 1}`,
    angle: `Angle ${i + 1}`,
    mechanism: `Mechanism ${i + 1}`,
    seedHook: `Seed ${i + 1}`,
    needsTake: false,
    topic: `Topic ${i + 1}`,
    take: `Take ${i + 1}`,
    format: null,
    personaStops: 8,
    stopQuote: `Stop ${i + 1}`,
    targetArchetype,
  }));
}

describe("runIdeasPipeline — per-persona generation (binding preserved)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binds a BRACKETED slug — the model returns \"[lurker]\", not \"lurker\" (live-caught)", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedIdeas(["[lurker]", "[loyalist]", "[niche_deep_buyer]", "[cross_niche_curiosity]"])),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({
      ask: "a levitation illusion",
      platform: "tiktok",
      profileRow: null,
      audience: targetedAudience,
    });

    expect(blocks).toHaveLength(4);
    for (const b of blocks) {
      expect(b.props.target).toBeDefined();
      expect(b.props.target!.archetype).not.toMatch(/[[\]]/); // brackets never reach the card
    }
    expect(new Set(blocks.map((b) => b.props.target!.archetype))).toEqual(
      new Set(["lurker", "loyalist", "niche_deep_buyer", "cross_niche_curiosity"]),
    );
  });

  it("drops the target line — never mislabels — when the model names a slug we never assigned", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedIdeas(["tough_crowd", "", "not_a_real_slug", "lurker"])),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks, warnings } = await runIdeasPipeline({ ask: "Ideas", platform: "tiktok", profileRow: null, audience: targetedAudience });

    const targeted = blocks.filter((b) => b.props.target);
    expect(new Set(targeted.map((b) => b.props.target!.archetype))).toEqual(new Set(["lurker"]));
    expect(warnings.some((w) => /never assigned|named no target/.test(w))).toBe(true);
  });

  it("a bound target carries the assignment but a NULL reaction (verdict/quote) — no SIM ran", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(
      mockQwenReturning(targetedIdeas(["niche_deep_buyer", "saver", "lurker", "loyalist"])),
    );

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "Ideas", platform: "tiktok", profileRow: null, audience: targetedAudience });

    const buyer = blocks.find((b) => b.props.target?.archetype === "niche_deep_buyer");
    expect(buyer!.props.target!.archetype).toBe("niche_deep_buyer");
    expect(buyer!.props.target!.verdict).toBeNull();
    expect(buyer!.props.target!.quote).toBeNull();
    await expectNoSecondCall();
  });

  it("General: no assignment block in the prompt, and no target on any card", async () => {
    const { getQwenClient } = await import("@/lib/engine/qwen/client");
    const client = mockQwenReturning(targetedIdeas(["lurker", "saver", "lurker", "saver"]));
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { runIdeasPipeline } = await import("@/lib/tools/runners/ideas-runner");
    const { blocks } = await runIdeasPipeline({ ask: "Ideas", platform: "tiktok", profileRow: null, audience: generalAudience });

    expect(blocks.every((b) => b.props.target === undefined)).toBe(true);

    const system = client.chat.completions.create.mock.calls[0]![0].messages[0].content;
    expect(system).not.toContain("targetArchetype");
  });
});
