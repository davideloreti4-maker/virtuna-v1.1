/**
 * chat-agent-loop-cards-on-screen.test.ts — what the model is told about the pack it just made.
 *
 * THE DEFECT. A live run reported `produced: "5 card(s)"` and nothing else, while `replayPriorTurn`
 * handed the model the LINES of every past run. The model could therefore discuss the pack it made
 * last turn and not the one it had just made — and, asked for hooks while holding a receipt it
 * could not read, it wrote a fresh pack in prose. Measured live 2026-08-11, 2 of 2 walks: 10 then 5
 * enumerated hooks with ZERO overlap with the cards rendered beside them.
 *
 * These assert the TOOL RESULT, not the model's reply: what the model does with the lines is what
 * the A/B measures (`.scratch/probe-cards-on-screen.ts`). What a test can pin is that the lines
 * reach it at all, in order, capped — and that with the flag off the result is byte-identical to
 * what shipped before.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  runChatAgentStream,
  type StreamChunk,
  type StreamingChatComplete,
} from "@/lib/tools/chat-agent-loop";
import type { SkillTool } from "@/lib/tools/skill-dispatch";
import { MAX_LINES_PER_RUN } from "@/lib/tools/card-lines";

const CTX = { platform: "tiktok" as const, profileRow: null, audience: null };

const toolName = (index: number, id: string, name: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, id, function: { name } }] } }],
});
const toolArgs = (index: number, args: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, function: { arguments: args } }] } }],
});

const HOOKS = [
  "Day 47 of pretending I have rhythm.",
  "I spent four hours learning this dance.",
  "Watch me try to look cool for three seconds.",
];

/**
 * Runs one turn where the model calls `generate_hooks` and the skill returns `blocks`.
 * Returns the parsed TOOL RESULT the loop fed back to the model for that call.
 */
async function runAndCaptureToolResult(
  blocks: unknown[],
): Promise<Record<string, unknown>> {
  const rounds: StreamChunk[][] = [
    [toolName(0, "c1", "generate_hooks"), toolArgs(0, JSON.stringify({ topic: "morning focus" }))],
    [],
  ];
  let i = 0;
  const seenMessages: Array<Array<Record<string, unknown>>> = [];
  const streamComplete = vi.fn(async (params: Record<string, unknown>) => {
    seenMessages.push(params.messages as Array<Record<string, unknown>>);
    const chunks = rounds[Math.min(i++, rounds.length - 1)] ?? [];
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }) as unknown as StreamingChatComplete;

  const skill: SkillTool = {
    name: "generate_hooks",
    skillKey: "hooks",
    billable: "hooks",
    schema: { type: "function", function: { name: "generate_hooks", parameters: { type: "object", properties: {} } } },
    run: async () => ({ blocks, warnings: [] }),
  };

  await runChatAgentStream(
    { ask: "hooks about morning focus", context: CTX, systemPrompt: "sys", onToken: vi.fn(), onBlock: vi.fn() },
    {
      streamComplete,
      skills: [skill],
      model: "test-model",
      seed: 1,
      billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
    },
  );

  // Round 2's messages carry the tool result round 1 produced.
  const round2 = seenMessages[1];
  if (!round2) throw new Error("the loop never ran a second round — the fixture is broken");
  const toolMsg = round2.find((m) => m.role === "tool");
  if (!toolMsg) throw new Error("no tool result was fed back — the fixture is broken");
  return JSON.parse(toolMsg.content as string) as Record<string, unknown>;
}

const hookBlocks = (lines: string[]) =>
  lines.map((hookLine) => ({ type: "hook-card", props: { hookLine } }));

const original = process.env.ENGINE_CHAT_CARDS_ON_SCREEN;
afterEach(() => {
  if (original === undefined) delete process.env.ENGINE_CHAT_CARDS_ON_SCREEN;
  else process.env.ENGINE_CHAT_CARDS_ON_SCREEN = original;
});

describe("the LIVE tool result", () => {
  it("flag OFF → the count only, byte-identical to what shipped before", async () => {
    delete process.env.ENGINE_CHAT_CARDS_ON_SCREEN;
    const result = await runAndCaptureToolResult(hookBlocks(HOOKS));
    expect(result).toEqual({
      ran: "generate_hooks",
      produced: "3 card(s)",
      note:
        "cards are shown to the creator; reply with ONE short closing line and do NOT " +
        "restate or rewrite the cards' content in prose",
    });
    // The absence is the point: with the flag off the model cannot see its own pack.
    expect(result.cards_on_screen).toBeUndefined();
  });

  it("flag ON → the model is handed the lines it just produced, in card order", async () => {
    process.env.ENGINE_CHAT_CARDS_ON_SCREEN = "true";
    const result = await runAndCaptureToolResult(hookBlocks(HOOKS));
    expect(result.cards_on_screen).toEqual(HOOKS);
    expect(result.produced).toBe("3 card(s)");
  });

  it("flag ON → the note tells it to REFER to them, not to re-list them", async () => {
    process.env.ENGINE_CHAT_CARDS_ON_SCREEN = "true";
    const result = await runAndCaptureToolResult(hookBlocks(HOOKS));
    const note = String(result.note);
    expect(note).toContain("NOW SEE");
    expect(note).toContain("never re-list them");
  });

  it("flag ON → the pack is capped, so a big run cannot become a transcript", async () => {
    process.env.ENGINE_CHAT_CARDS_ON_SCREEN = "true";
    const many = Array.from({ length: MAX_LINES_PER_RUN + 4 }, (_, i) => `hook number ${i}`);
    const result = await runAndCaptureToolResult(hookBlocks(many));
    expect(result.cards_on_screen).toHaveLength(MAX_LINES_PER_RUN);
    // The COUNT still tells the truth about how many the creator can see.
    expect(result.produced).toBe(`${many.length} card(s)`);
  });

  it("flag ON but nothing extractable → falls back to the old shape, never an empty list", async () => {
    // A card type that predates its line prop must degrade to "counted, not quoted". Sending
    // `cards_on_screen: []` would tell the model a pack exists with no lines in it.
    process.env.ENGINE_CHAT_CARDS_ON_SCREEN = "true";
    const result = await runAndCaptureToolResult([
      { type: "hook-card", props: {} },
      { type: "corpus-references", props: { query: "x" } },
    ]);
    expect(result.cards_on_screen).toBeUndefined();
    expect(result.note).toContain("do NOT");
  });
});
