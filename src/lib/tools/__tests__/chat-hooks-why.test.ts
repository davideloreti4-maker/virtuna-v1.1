/**
 * chat-hooks-why.test.ts — Maven's pick through the CHAT AGENT's own path to a hooks run (spec
 * 2026-11-25-maven-pick-design.md): the agent calls `generate_hooks`, the real skill runs the real
 * hooks runner, and the cards the loop streams (`onBlock`, what the chat route sends as `block`) and
 * returns (`skillRuns`, what the route persists) keep each hook's `why`. A field dropped anywhere on
 * this path would leave a chat-dispatched pack without its line.
 *
 * Stand-ins, all I/O: the chat model's stream (injected), the hooks writer's Qwen client, the
 * grounding gather (a scrape and a database read). The loop, the skill and the runner are real.
 */

import { describe, expect, it, vi } from "vitest";
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

import { runChatAgentStream, type StreamChunk, type StreamingChatComplete } from "@/lib/tools/chat-agent-loop";
import { SKILL_TOOLS } from "@/lib/tools/skill-dispatch";
import { getQwenClient } from "@/lib/engine/qwen/client";
import { gatherCorpusForRun } from "@/lib/grounding/gather-for-run";
import type { HookCardBlock } from "@/lib/tools/blocks";

const REASON = "It dares a friend by name, so you wait to hear why.";

/** The chat model: round 1 calls generate_hooks, round 2 writes its closing line. */
function chatModel(): StreamingChatComplete {
  const rounds: StreamChunk[][] = [
    [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "generate_hooks" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"topic": "meal prep for students", "count": 2}' } }] } }] },
    ],
    [{ choices: [{ delta: { content: "Two hooks are up." } }] }],
  ];
  let i = 0;
  return vi.fn(async () => {
    const chunks = rounds[Math.min(i++, rounds.length - 1)] ?? [];
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }) as unknown as StreamingChatComplete;
}

describe("the chat agent's own hooks run keeps why", () => {
  it("the streamed and the returned cards carry each hook's reason; a hook without one has no key", async () => {
    (gatherCorpusForRun as ReturnType<typeof vi.fn>).mockResolvedValue({
      corpus: undefined,
      examples: [],
      scrapeAvailable: false,
      warrant: "none",
      grounded: false,
      adapted: false,
    } as unknown as GatherCorpusResult);
    const hooks = [
      { hookLine: "Hook line 1", mechanism: "M1", seedHook: "Hook line 1", channel: null, needsTake: false, personaStops: 8, stopQuote: "S1", why: REASON },
      { hookLine: "Hook line 2", mechanism: "M2", seedHook: "Hook line 2", channel: null, needsTake: false, personaStops: 6, stopQuote: "S2" },
    ];
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ hooks }) } }] });
    (getQwenClient as ReturnType<typeof vi.fn>).mockReturnValue({ chat: { completions: { create } } });

    const onBlock = vi.fn();
    const res = await runChatAgentStream(
      { ask: "2 hooks for meal prep for students", context: { platform: "tiktok", profileRow: null, audience: null }, systemPrompt: "sys", onToken: vi.fn(), onBlock },
      {
        streamComplete: chatModel(),
        model: "test-model",
        seed: 1,
        skills: SKILL_TOOLS.filter((s) => s.name === "generate_hooks"),
        billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
      },
    );

    // The writer's one call ran (the real runner, not a stand-in for it).
    expect(create).toHaveBeenCalledTimes(1);

    const streamed = onBlock.mock.calls.map(([b]) => b as HookCardBlock).filter((b) => b.type === "hook-card");
    expect(streamed.map((b) => [b.props.hookLine, b.props.why])).toEqual([
      ["Hook line 1", REASON],
      ["Hook line 2", undefined],
    ]);
    expect("why" in streamed[1]!.props).toBe(false);

    const run = res.skillRuns.find((r) => r.name === "generate_hooks")!;
    expect((run.blocks as HookCardBlock[]).map((b) => b.props.why)).toEqual([REASON, undefined]);
  });
});
