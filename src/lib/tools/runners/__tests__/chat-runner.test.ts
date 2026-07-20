/**
 * chat-runner.test.ts — runChatPipeline personaGrounding unit tests (Plan 09-03, Task 1).
 *
 * Tests (tagged "runner"):
 *   - Test 1 (additive no-op): WITHOUT personaGrounding the assembled bundle + system
 *     prompt are byte-identical to the pre-change open-chat path (existing chat unaffected).
 *   - Test 2 (in-voice grounding): WITH personaGrounding the system prompt PREPENDS the
 *     registry persona definition; the concept text + quote flow through the assembleBundle
 *     `<<<USER_CONTENT>>>` fence (overrides) — never raw into the system prompt.
 *   - Test 3 (registry immutability): after a grounded run, ARCHETYPE_DEFINITIONS is
 *     byte-identical to a pre-run snapshot (the runner reads, never writes — Pitfall 5).
 *
 * The registry (persona-registry.ts) and the compiled system prompt (KC_CHAT_SYSTEM_PROMPT)
 * are NOT mocked — Test 3 must observe the real module, and Test 1 must compare against the
 * real prompt constant. assembleBundle IS mocked so we can observe the exact input it receives
 * (the fenced overrides) without exercising the full grounding assembler in this unit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ARCHETYPE_DEFINITIONS,
  ARCHETYPE_TRIGGERS,
} from "@/lib/engine/wave3/persona-registry";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";
import type { RetrievedExample } from "@/lib/grounding/types";

// ─── Mock Qwen client — capture the create() args + emit two tokens ────────────

const createMock = vi.fn();

vi.mock("@/lib/engine/qwen/client", () => ({
  getQwenClient: () => ({
    chat: { completions: { create: createMock } },
  }),
  QWEN_REASONING_MODEL: "qwen3.7-plus",
}));

// ─── Mock assembleBundle — record its input, return a deterministic string ─────

const assembleBundleMock = vi.fn((_input: unknown, _profile: unknown) => "MOCK_ASSEMBLED_BUNDLE");

vi.mock("@/lib/kc/assembler", () => ({
  assembleBundle: (input: unknown, profile: unknown) => assembleBundleMock(input, profile),
}));

// ─── Mock audience grounding (General-only path; no calibrated steer) ──────────

vi.mock("@/lib/audience/audience-grounding", () => ({
  buildAudienceGroundingLine: () => ({ line: "general line", coldStart: false }),
}));

vi.mock("@/lib/audience/resolve-audience-weights", () => ({
  resolveAudienceWeights: () => ({ weights: {} }),
}));

import { runChatPipeline, type ChatPipelineInput } from "../chat-runner";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** An async-iterable stream that yields two content deltas (mirrors the Qwen SDK shape). */
function makeStream(deltas: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const d of deltas) {
        yield { choices: [{ delta: { content: d } }] };
      }
    },
  };
}

const BASE_INPUT: ChatPipelineInput = {
  ask: "Why did you scroll past this?",
  platform: "tiktok",
  profileRow: null,
  priorTurns: [],
  audience: null,
};

beforeEach(() => {
  createMock.mockReset();
  assembleBundleMock.mockClear();
  createMock.mockResolvedValue(makeStream(["Hello", " world"]));
});

describe("runChatPipeline personaGrounding [runner]", () => {
  it("Test 1 — additive no-op: byte-identical system prompt + overrides absent without personaGrounding", async () => {
    const tokens: string[] = [];
    const result = await runChatPipeline(BASE_INPUT, (d) => tokens.push(d));

    expect(result.fullContent).toBe("Hello world");

    // System prompt is the unmodified compiled chat prompt (no persona prefix).
    const createArgs = createMock.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMsg = createArgs.messages.find((m) => m.role === "system")!;
    expect(systemMsg.content).toBe(KC_CHAT_SYSTEM_PROMPT);

    // assembleBundle received NO overrides for the General/no-persona path (byte-identical).
    const assemblerInput = assembleBundleMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(assemblerInput.overrides).toBeUndefined();
    expect(assemblerInput.mode).toBe("chat");
  });

  it("Test 2 — in-voice grounding: persona prefix prepended; concept/quote ride the fenced overrides", async () => {
    const conceptText = "A 3-second hook that opens on a confused face.";
    const quote = "I'd keep scrolling — seen this a hundred times.";
    const groundedInput: ChatPipelineInput = {
      ...BASE_INPUT,
      personaGrounding: {
        archetype: "tough_crowd",
        reactionToConcept: { verdict: "scroll", quote },
        conceptText,
      },
    };

    await runChatPipeline(groundedInput, () => {});

    const createArgs = createMock.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMsg = createArgs.messages.find((m) => m.role === "system")!;

    // The system prompt PREPENDS the registry persona definition (in-voice), then the
    // unmodified compiled chat prompt follows.
    expect(systemMsg.content).toContain(ARCHETYPE_DEFINITIONS.tough_crowd);
    expect(systemMsg.content).toContain(KC_CHAT_SYSTEM_PROMPT);
    expect(systemMsg.content.indexOf(ARCHETYPE_DEFINITIONS.tough_crowd)).toBeLessThan(
      systemMsg.content.indexOf(KC_CHAT_SYSTEM_PROMPT),
    );
    // A trigger phrase from the registry is woven in (in-voice instruction).
    expect(systemMsg.content).toContain(ARCHETYPE_TRIGGERS.tough_crowd.stop[0]!);

    // The concept text + reaction quote do NOT leak into the system prompt — they ride the
    // fenced assembleBundle.overrides (Security Domain — injection-safe).
    expect(systemMsg.content).not.toContain(conceptText);
    expect(systemMsg.content).not.toContain(quote);

    const assemblerInput = assembleBundleMock.mock.calls[0]![0] as { overrides?: string };
    expect(assemblerInput.overrides).toContain(conceptText);
    expect(assemblerInput.overrides).toContain(quote);
  });

  it("Test 4 — MEET-MODE (no reaction): meet framing in the prefix, no reaction anchor fenced", async () => {
    await runChatPipeline(
      {
        ...BASE_INPUT,
        // Meet-mode grounding: archetype + name only — the idle "Meet your room" introduction.
        personaGrounding: { archetype: "tough_crowd", personaName: "Maya" },
      },
      () => {},
    );

    const createArgs = createMock.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemMsg = createArgs.messages.find((m) => m.role === "system")!;

    // In-voice as the named person, with the meet framing instead of a reaction line.
    expect(systemMsg.content).toContain(ARCHETYPE_DEFINITIONS.tough_crowd);
    expect(systemMsg.content).toContain("You are Maya");
    expect(systemMsg.content).toContain("they're meeting you");
    expect(systemMsg.content).not.toContain("On the concept below");

    // No reaction → nothing to fence: assembleBundle receives NO overrides (General audience).
    const assemblerInput = assembleBundleMock.mock.calls[0]![0] as { overrides?: string };
    expect(assemblerInput.overrides).toBeUndefined();
  });

  it("Test 3 — registry immutability: ARCHETYPE_DEFINITIONS byte-identical after a grounded run", async () => {
    const snapshot = JSON.parse(JSON.stringify(ARCHETYPE_DEFINITIONS));
    const triggersSnapshot = JSON.parse(JSON.stringify(ARCHETYPE_TRIGGERS));

    await runChatPipeline(
      {
        ...BASE_INPUT,
        personaGrounding: {
          archetype: "loyalist",
          reactionToConcept: { verdict: "stop", quote: "Love this creator." },
          conceptText: "A behind-the-scenes vlog.",
        },
      },
      () => {},
    );

    expect(ARCHETYPE_DEFINITIONS).toEqual(snapshot);
    expect(ARCHETYPE_TRIGGERS).toEqual(triggersSnapshot);
  });
});

// ─── Reference-mode corpus PRE-FLIGHT pull (GROUNDING_CHAT_PREFLIGHT) ─────────

/**
 * The flag-gated pre-flight pull: OPEN chat lets the model search the corpus and grounds the streamed
 * answer on what it pulls. Locks the no-op guarantee (flag off OR persona chat → byte-identical), the
 * block injection (flag on), and degrade-safety (a failing pull streams ungrounded, never throws).
 * `gatherReferences` is INJECTED so these stay network-free; buildReferenceBlock runs for real.
 *
 * SUPERSEDED by the streaming agent loop (`chat-agent-loop.ts`) and now gated on its OWN var. It used
 * to read `GROUNDING_CHAT_TOOL` — the same var the live loop treats as default-ON — so setting that
 * to "true" revived this blocking pre-flight ON TOP of the loop: two pulls, one answer. The tests
 * below still pass either way, which is precisely why the collision needed finding by reading.
 */
describe("runChatPipeline corpus PULL [runner]", () => {
  const pulled: RetrievedExample = {
    teardownId: "pull1",
    handle: "pulledcreator",
    videoUrl: null,
    coverUrl: null,
    platform: "tiktok",
    multiplier: 44,
    views: 2_000_000,
    baselineLabel: "vs followers",
    fitLabel: "structural",
    hookArchetype: "contrarian",
    format: "breakdowns-explainers",
    visualSetting: "studio_set",
    editingStyle: "office-room-yap",
    hookTechniques: [],
    niche: "health-fitness",
    similarity: 0.71,
    spokenHook: "You've been lied to about protein.",
    hookTemplate: "You've been lied to about [X].",
    template: null,
    idea: null,
    whyItWorks: null,
    sourcePool: "curated",
    trustWeight: 1,
    fromPersonal: false,
  };
  const gatherSpy = vi.fn(async () => ({ references: [pulled], toolCalls: [] }));

  beforeEach(() => gatherSpy.mockClear());
  afterEach(() => {
    delete process.env.GROUNDING_CHAT_PREFLIGHT;
  });

  const systemOf = () => {
    const args = createMock.mock.calls[0]![0] as { messages: Array<{ role: string; content: string }> };
    return args.messages.find((m) => m.role === "system")!.content;
  };

  it("flag OFF (default): the pull never runs — system prompt byte-identical", async () => {
    await runChatPipeline(BASE_INPUT, () => {}, { gatherReferences: gatherSpy as never });
    expect(gatherSpy).not.toHaveBeenCalled();
    expect(systemOf()).toBe(KC_CHAT_SYSTEM_PROMPT);
  });

  it("flag ON + open chat: the model's pulled reference is injected AFTER the chat prompt", async () => {
    process.env.GROUNDING_CHAT_PREFLIGHT = "true";
    await runChatPipeline(BASE_INPUT, () => {}, { gatherReferences: gatherSpy as never });

    expect(gatherSpy).toHaveBeenCalledTimes(1);
    const system = systemOf();
    expect(system).toContain(KC_CHAT_SYSTEM_PROMPT);
    expect(system).toContain("PROVEN REFERENCE MATERIAL");
    expect(system).toContain("proven by @pulledcreator");
    // The block is appended — the chat prompt stays primary.
    expect(system.indexOf(KC_CHAT_SYSTEM_PROMPT)).toBeLessThan(system.indexOf("PROVEN REFERENCE MATERIAL"));
  });

  it("flag ON + PERSONA chat: the pull is excluded (a viewer reacts in-voice, not from a strategy corpus)", async () => {
    process.env.GROUNDING_CHAT_PREFLIGHT = "true";
    await runChatPipeline(
      { ...BASE_INPUT, personaGrounding: { archetype: "tough_crowd", personaName: "Maya" } },
      () => {},
      { gatherReferences: gatherSpy as never },
    );
    expect(gatherSpy).not.toHaveBeenCalled();
    expect(systemOf()).not.toContain("PROVEN REFERENCE MATERIAL");
  });

  it("flag ON but the pull THROWS: degrades to ungrounded — no block, stream still completes", async () => {
    process.env.GROUNDING_CHAT_PREFLIGHT = "true";
    const throwing = vi.fn(async () => {
      throw new Error("corpus down");
    });
    const result = await runChatPipeline(BASE_INPUT, () => {}, { gatherReferences: throwing as never });

    expect(result.fullContent).toBe("Hello world");
    expect(systemOf()).toBe(KC_CHAT_SYSTEM_PROMPT); // no block — byte-identical fallback
  });
});
