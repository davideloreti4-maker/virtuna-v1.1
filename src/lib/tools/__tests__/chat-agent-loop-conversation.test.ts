/**
 * chat-agent-loop-conversation.test.ts — the loop hands the thread DOWN to a skill.
 *
 * The wiring half of the 2026-08-10 thread-context work. What is asserted is the seam, not the
 * digest's contents (conversation-digest.test.ts owns those): a skill's `ctx` must arrive carrying
 * the conversation when the flag is on, and must arrive UNCHANGED when it is off.
 *
 * "Unchanged" is asserted by REFERENCE (`toBe`), not by value. A structural clone that happens to
 * be equal today is exactly how an off-by-default path drifts into shipping something.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  runChatAgentStream,
  type StreamChunk,
  type StreamingChatComplete,
  type ChatAgentPriorTurn,
} from "@/lib/tools/chat-agent-loop";
import type { SkillTool, SkillRunContext } from "@/lib/tools/skill-dispatch";

const CTX = { platform: "tiktok" as const, profileRow: null, audience: null };

const toolName = (index: number, id: string, name: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, id, function: { name } }] } }],
});
const toolArgs = (index: number, args: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, function: { arguments: args } }] } }],
});

function mockStream(rounds: StreamChunk[][]): StreamingChatComplete {
  let i = 0;
  return vi.fn(async () => {
    const chunks = rounds[Math.min(i++, rounds.length - 1)] ?? [];
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }) as unknown as StreamingChatComplete;
}

/** The thread the digest is built from: two creator turns and a hooks run that left two cards. */
const PRIOR: ChatAgentPriorTurn[] = [
  { role: "user", text: "i make comedy story-times, handheld, no b-roll" },
  { role: "assistant", text: "Got it." },
  { role: "user", text: "keep it under 30s, i lose people after that" },
  {
    role: "assistant",
    text: "Five hooks are on screen.",
    toolRuns: [
      { name: "generate_hooks", cards: 2, topic: "morning focus", lines: ["hook A", "hook B"] },
    ],
  },
];

/** Runs one turn in which the model calls `generate_hooks`, and returns the ctx the skill saw. */
async function runAndCaptureCtx(args: Record<string, unknown>): Promise<SkillRunContext> {
  let seen: SkillRunContext | null = null;
  const skill: SkillTool = {
    name: "generate_hooks",
    skillKey: "hooks",
    billable: "hooks",
    schema: { type: "function", function: { name: "generate_hooks", parameters: { type: "object", properties: {} } } },
    run: async (_a, ctx) => {
      seen = ctx;
      return { blocks: [], warnings: [] };
    },
  };
  await runChatAgentStream(
    { ask: "more hooks", context: CTX, systemPrompt: "sys", priorTurns: PRIOR, onToken: vi.fn(), onBlock: vi.fn() },
    {
      streamComplete: mockStream([
        [toolName(0, "c1", "generate_hooks"), toolArgs(0, JSON.stringify(args))],
        [],
      ]),
      skills: [skill],
      model: "test-model",
      seed: 1,
      billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
    },
  );
  if (!seen) throw new Error("the skill never ran — the fixture, not the feature, is broken");
  return seen;
}

const original = process.env.ENGINE_GEN_CONVERSATION;
afterEach(() => {
  if (original === undefined) delete process.env.ENGINE_GEN_CONVERSATION;
  else process.env.ENGINE_GEN_CONVERSATION = original;
});

describe("the loop hands the conversation to a skill", () => {
  it("flag OFF → the skill receives the caller's ctx OBJECT ITSELF, unchanged", async () => {
    delete process.env.ENGINE_GEN_CONVERSATION;
    const ctx = await runAndCaptureCtx({ topic: "morning focus" });
    expect(ctx).toBe(CTX); // by reference — no clone, no added key
    expect(ctx.conversation).toBeUndefined();
  });

  it("flag ON → the creator's turns and the cards on screen arrive on the ctx", async () => {
    process.env.ENGINE_GEN_CONVERSATION = "true";
    const ctx = await runAndCaptureCtx({ topic: "morning focus" });
    expect(ctx.conversation?.turns).toEqual([
      "i make comedy story-times, handheld, no b-roll",
      "keep it under 30s, i lose people after that",
    ]);
    expect(ctx.conversation?.cardsOnScreen).toEqual(["hook A", "hook B"]);
    // The assistant's own prose is not smuggled in anywhere on the ctx.
    expect(JSON.stringify(ctx.conversation)).not.toContain("Five hooks are on screen");
  });

  it("flag ON + a rewrite pack → cardsOnScreen is withheld, turns still ride", async () => {
    // "Rewrite each of these" and "do not reproduce these" cannot both be true of one list.
    process.env.ENGINE_GEN_CONVERSATION = "true";
    const ctx = await runAndCaptureCtx({ topic: "morning focus", cards: ["hook A", "hook B"] });
    expect(ctx.conversation?.cardsOnScreen).toBeUndefined();
    expect(ctx.conversation?.turns).toHaveLength(2);
  });

  it("flag ON with an empty thread → ctx is still the caller's object, not an empty digest", async () => {
    process.env.ENGINE_GEN_CONVERSATION = "true";
    let seen: SkillRunContext | null = null;
    const skill: SkillTool = {
      name: "generate_hooks",
      skillKey: "hooks",
      billable: "hooks",
      schema: { type: "function", function: { name: "generate_hooks", parameters: { type: "object", properties: {} } } },
      run: async (_a, ctx) => {
        seen = ctx;
        return { blocks: [], warnings: [] };
      },
    };
    await runChatAgentStream(
      { ask: "hooks about x", context: CTX, systemPrompt: "sys", onToken: vi.fn(), onBlock: vi.fn() },
      {
        streamComplete: mockStream([
          [toolName(0, "c1", "generate_hooks"), toolArgs(0, JSON.stringify({ topic: "x" }))],
          [],
        ]),
        skills: [skill],
        model: "test-model",
        seed: 1,
        billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
      },
    );
    expect(seen).toBe(CTX);
  });
});
