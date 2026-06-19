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

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ARCHETYPE_DEFINITIONS,
  ARCHETYPE_TRIGGERS,
} from "@/lib/engine/wave3/persona-registry";
import { KC_CHAT_SYSTEM_PROMPT } from "@/lib/kc/compiled";

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
