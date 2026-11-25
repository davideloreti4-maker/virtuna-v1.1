/**
 * hooks-why.test.ts — Maven's pick (spec 2026-11-25-maven-pick-design.md §2): the hooks writer asks
 * for one plain reason per hook (`why`) in the same call, and the runner carries it onto the card.
 *
 * The runner is real. The stand-ins are its I/O: the Qwen client (the one model call), and the
 * grounding gather (a scrape and a database read), so a test can pick which of the three contracts
 * the run sends (plain, grounded with `sourceIndex`, targeted with `targetArchetype`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatherCorpusResult } from "@/lib/grounding/gather-for-run";

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: vi.fn(),
  QWEN_SEED: 7,
  QWEN_REASONING_MODEL: "qwen3.7-plus",
  QWEN_FAST_MODEL: "qwen3.6-flash",
}));

vi.mock("@/lib/grounding/gather-for-run", () => ({
  gatherCorpusForRun: vi.fn(),
}));

/** The rule, word for word as given (after two rounds of real runs), with its leading space: it is the prompt. */
const WHY_RULE =
  ` "why" is ONE plain sentence, at most 14 words, saying why a person scrolling stops on this hook. Write it from that person's seat: "you" is the viewer, never the creator, and never "I", "me", "they" or "them". Use short, everyday words a friend would use. It must be about THIS hook: name the thing in it that does the work. Never use theory terms (not "cognitive dissonance", "curiosity gap", "pattern interrupt", "prediction error", "mechanism", "archetype"), never name a kind of viewer (not "lurker", "loyalist", "scanner", "skeptic"), never mention the creator's brand or earlier videos, do not quote or repeat the hook, no dash. Shape: "<what this hook does>, so you <what you do>." One example of the shape, never reuse its words: "It dares a friend by name, so you wait to hear why."`;

const CORPUS = `GROUNDING — proven short-form structures.

1. The one breakfast that fixed my energy
   proven by @creator_one · 12× vs followers · 40K views`;

function gathered(over: Partial<GatherCorpusResult> = {}): GatherCorpusResult {
  return { corpus: undefined, examples: [], scrapeAvailable: false, warrant: "none", grounded: false, adapted: false, ...over } as GatherCorpusResult;
}

const targetedAudience = {
  id: "aud-targeted",
  user_id: "user-1",
  name: "Students",
  type: "target",
  platform: "tiktok",
  goal_label: "Grow",
  goal_intent: "grow",
  is_general: false,
  is_preset: false,
  persona_weights: { fyp: 0.4, niche: 0.4, loyalist: 0.15, cross_niche: 0.05 },
  personas: [
    { archetype: "lurker", repaint: "Watches quietly.", temperature: "cold", disposition: "scanner", share: 0.3 },
    { archetype: "saver", repaint: "Saves to try later.", temperature: "warm", disposition: "collector", share: 0.3 },
    { archetype: "loyalist", repaint: "Comes back for the creator.", temperature: "hot", disposition: "connector", share: 0.2 },
  ],
  profile: null,
  calibration: null,
  created_at: "2026-11-25T00:00:00Z",
  updated_at: "2026-11-25T00:00:00Z",
} as never;

type RawHook = Record<string, unknown>;

const rawHook = (i: number, over: RawHook = {}): RawHook => ({
  hookLine: `Hook line ${i + 1}`,
  mechanism: `Mechanism ${i + 1}`,
  seedHook: `Hook line ${i + 1}`,
  channel: null,
  needsTake: false,
  personaStops: 8 - i, // a fixed order: hook 1 ranks first
  stopQuote: `Stop ${i + 1}`,
  ...over,
});

async function answer(hooks: RawHook[]) {
  const { getQwenClient } = await import("@/lib/engine/qwen/client");
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ hooks }) } }] });
  (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({ chat: { completions: { create } } });
  return create;
}

async function gather(result: GatherCorpusResult) {
  const { gatherCorpusForRun } = await import("@/lib/grounding/gather-for-run");
  (gatherCorpusForRun as ReturnType<typeof vi.fn>).mockResolvedValue(result);
}

/** The system message the one call sent. */
const systemOf = (create: ReturnType<typeof vi.fn>): string =>
  (create.mock.calls[0]![0] as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === "system")!.content;

const shapeLineOf = (system: string): string => system.split("\n").find((l) => l.startsWith("Shape: "))!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the writer asks for why in every contract", () => {
  const cases = [
    { name: "plain", grounded: false, audience: null, marker: null },
    { name: "grounded", grounded: true, audience: null, marker: '"sourceIndex": number' },
    { name: "targeted", grounded: false, audience: targetedAudience, marker: '"targetArchetype": string' },
    { name: "targeted and grounded", grounded: true, audience: targetedAudience, marker: '"targetArchetype": string' },
  ];

  it.each(cases)("$name: the shape names why as a string, and the rule is there word for word", async ({ grounded, audience, marker }) => {
    await gather(grounded ? gathered({ corpus: CORPUS, grounded: true, warrant: "structural" } as Partial<GatherCorpusResult>) : gathered());
    const create = await answer([0, 1, 2].map((i) => rawHook(i)));
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    await runHooksPipeline({ ask: "3 hooks for meal prep", platform: "tiktok", profileRow: null, audience });

    const system = systemOf(create);
    const shape = shapeLineOf(system);
    expect(shape).toContain('"why": string');
    if (marker) expect(shape).toContain(marker);
    else {
      expect(shape).not.toContain("sourceIndex");
      expect(shape).not.toContain("targetArchetype");
    }
    expect(system).toContain(WHY_RULE);
    // One rule, once: not repeated by two interpolations.
    expect(system.split(WHY_RULE)).toHaveLength(2);
  });
});

describe("the runner carries why onto the card", () => {
  beforeEach(async () => {
    await gather(gathered());
  });

  it("a hook's why rides its own block, trimmed", async () => {
    await answer([
      rawHook(0, { why: "  It dares a friend by name, so you wait to hear why.  " }),
      rawHook(1, { why: "Everyone has wasted money on food." }),
    ]);
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks } = await runHooksPipeline({ ask: "hooks", platform: "tiktok", profileRow: null });

    expect(blocks.map((b) => [b.props.hookLine, b.props.why])).toEqual([
      ["Hook line 1", "It dares a friend by name, so you wait to hear why."],
      ["Hook line 2", "Everyone has wasted money on food."],
    ]);
  });

  it("a missing why, a number or only spaces: the block has no key, and every hook still ships", async () => {
    await answer([
      rawHook(0),
      rawHook(1, { why: 7 }),
      rawHook(2, { why: "   " }),
      rawHook(3, { why: "A real reason." }),
    ]);
    const { runHooksPipeline } = await import("@/lib/tools/runners/hooks-runner");
    const { blocks, warnings } = await runHooksPipeline({ ask: "4 hooks", platform: "tiktok", profileRow: null });

    expect(blocks).toHaveLength(4);
    expect(warnings).toEqual([]);
    expect(blocks.map((b) => "why" in b.props)).toEqual([false, false, false, true]);
    expect(blocks[3]!.props.why).toBe("A real reason.");
  });
});
