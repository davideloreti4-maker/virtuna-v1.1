/**
 * chat-agent-loop.test.ts — the single STREAMING agent loop (chat-agent-loop.ts). Hermetic: the
 * streaming completion, the skills, and the corpus executor are all injected, so nothing hits the model
 * or the paid engine. Locks the behaviours the spike proved: text streams token-by-token, tool-call
 * fragments accumulate by index, a skill call streams its cards + continues, grounding feeds back, and
 * the paid-engine leash + error absorption hold.
 */

import { describe, it, expect, vi } from "vitest";
import {
  runChatAgentStream,
  type StreamChunk,
  type StreamingChatComplete,
  type ChatAgentStreamInput,
  type ChatAgentStreamDeps,
} from "@/lib/tools/chat-agent-loop";
import type { SkillTool } from "@/lib/tools/skill-dispatch";

const CTX = { platform: "tiktok" as const, profileRow: null, audience: null };

// ── Chunk builders (mirror the real DashScope streaming shape the spike observed) ──
const textChunk = (s: string): StreamChunk => ({ choices: [{ delta: { content: s } }] });
const toolName = (index: number, id: string, name: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, id, function: { name } }] } }],
});
const toolArgs = (index: number, args: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, function: { arguments: args } }] } }],
});

/** A scripted streaming completion: rounds[i] is the chunk list for the i-th model call. */
function mockStream(rounds: StreamChunk[][]): StreamingChatComplete {
  let i = 0;
  return vi.fn(async () => {
    const chunks = rounds[Math.min(i++, rounds.length - 1)] ?? [];
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }) as unknown as StreamingChatComplete;
}

function mkSkill(name: string, opts: { paid?: boolean; primaryArg?: "topic" | "draft"; run?: SkillTool["run"] } = {}): SkillTool {
  return {
    name,
    paid: opts.paid ?? true,
    primaryArg: opts.primaryArg,
    schema: { type: "function", function: { name, parameters: { type: "object", properties: {} } } },
    run:
      opts.run ??
      vi.fn(async (args) => ({ blocks: [{ type: "idea-card", props: { topic: args.topic } }], warnings: [] })),
  };
}

const baseInput = (over: Partial<ChatAgentStreamInput> = {}): ChatAgentStreamInput => ({
  ask: "x",
  context: CTX,
  systemPrompt: "sys",
  onToken: vi.fn(),
  onBlock: vi.fn(),
  ...over,
});

const DEPS = (streamComplete: StreamingChatComplete, over: Partial<ChatAgentStreamDeps> = {}): ChatAgentStreamDeps => ({
  streamComplete,
  model: "test-model",
  seed: 1,
  ...over,
});

describe("runChatAgentStream [tools]", () => {
  it("streams a pure-chat answer token-by-token with no tool call", async () => {
    const onToken = vi.fn();
    const stream = mockStream([[textChunk("Post "), textChunk("three "), textChunk("times.")]]);

    const res = await runChatAgentStream(baseInput({ onToken }), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.text).toBe("Post three times.");
    expect(res.skillRuns).toHaveLength(0);
    expect(onToken).toHaveBeenCalledTimes(3);
    expect(onToken).toHaveBeenNthCalledWith(1, "Post ");
  });

  it("accumulates fragmented tool-call deltas, runs the skill, streams its card, then continues", async () => {
    const ideas = mkSkill("generate_ideas");
    const onBlock = vi.fn();
    const stream = mockStream([
      // round 1: a fragmented generate_ideas tool call (name, then argument pieces)
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic":'), toolArgs(0, ' "morning routines"}')],
      // round 2: the model's closing line after the cards
      [textChunk("Made you 1 angle — want hooks?")],
    ]);

    const res = await runChatAgentStream(baseInput({ onBlock }), DEPS(stream, { skills: [ideas] }));

    expect(res.skillRuns).toHaveLength(1);
    expect(res.skillRuns[0]!.name).toBe("generate_ideas");
    expect(onBlock).toHaveBeenCalledWith({ type: "idea-card", props: { topic: "morning routines" } });
    expect(res.text).toBe("Made you 1 angle — want hooks?");
    expect(ideas.run).toHaveBeenCalledWith({ topic: "morning routines", anchor: undefined, draft: undefined }, CTX);
  });

  it("feeds a search_corpus result back to the model (grounding-as-a-tool)", async () => {
    const executeCorpus = vi.fn(async () => ({
      content: JSON.stringify({ count: 1, results: [{ creator: "@x" }] }),
      examples: [],
      record: { round: 1, query: "budgeting", axis: "topical" as const, rows: 1 },
    }));
    const stream = mockStream([
      [toolName(0, "s1", "search_corpus"), toolArgs(0, '{"query": "budgeting"}')],
      [textChunk("Real creators do this: …")],
    ]);

    const res = await runChatAgentStream(
      baseInput({ grounding: true }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")], executeCorpus: executeCorpus as never }),
    );

    expect(executeCorpus).toHaveBeenCalledTimes(1);
    expect(res.toolCalls.find((t) => t.name === "search_corpus")?.ran).toBe(true);
    expect(res.text).toBe("Real creators do this: …");
  });

  it("does NOT bind search_corpus when grounding is off", async () => {
    const executeCorpus = vi.fn();
    // The model 'tries' to call search_corpus, but with grounding off it is an unknown tool → refused.
    const stream = mockStream([
      [toolName(0, "s1", "search_corpus"), toolArgs(0, '{"query": "x"}')],
      [textChunk("ok")],
    ]);

    const res = await runChatAgentStream(
      baseInput({ grounding: false }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")], executeCorpus: executeCorpus as never }),
    );

    expect(executeCorpus).not.toHaveBeenCalled();
    expect(res.toolCalls[0]!.note).toBe("unknown skill");
  });

  it("enforces the paid-engine LEASH — a second paid run in one turn is refused", async () => {
    const ideas = mkSkill("generate_ideas");
    const hooks = mkSkill("generate_hooks");
    const stream = mockStream([
      [
        toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}'),
        toolName(1, "c2", "generate_hooks"), toolArgs(1, '{"topic": "b"}'),
      ],
      [textChunk("done")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [ideas, hooks], maxSkillRuns: 1 }));

    expect(res.skillRuns).toHaveLength(1); // only the first paid run executed
    expect(res.toolCalls.find((t) => !t.ran)?.note).toContain("leash");
    expect(hooks.run).not.toHaveBeenCalled();
  });

  it("refuses a skill call missing its declared primary arg (generic draft-shape seam)", async () => {
    const draftSkill = mkSkill("needs_draft", { primaryArg: "draft" });
    const stream = mockStream([[toolName(0, "c1", "needs_draft"), toolArgs(0, "{}")], [textChunk("ok")]]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [draftSkill] }));

    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]!.note).toBe("no draft");
    expect(draftSkill.run).not.toHaveBeenCalled();
  });

  it("request_link emits an input-request FIELD (onBlock + persisted uiBlocks), runs no paid skill", async () => {
    const ideas = mkSkill("generate_ideas");
    const onBlock = vi.fn();
    const stream = mockStream([
      // The model asks for a link instead of guessing a URL.
      [toolName(0, "c1", "request_link"), toolArgs(0, '{"action": "remix"}')],
      [textChunk("Drop the link and I'll adapt it.")],
    ]);

    const res = await runChatAgentStream(baseInput({ onBlock }), DEPS(stream, { skills: [ideas] }));

    // The field streamed live…
    const field = {
      type: "input-request",
      props: { kind: "link", action: "remix", label: expect.any(String), placeholder: "https://…", platform: "tiktok" },
    };
    expect(onBlock).toHaveBeenCalledWith(expect.objectContaining({ type: "input-request" }));
    expect(onBlock).toHaveBeenCalledWith(expect.objectContaining(field));
    // …and is returned for persistence (else it would vanish on the post-turn reload).
    expect(res.uiBlocks).toHaveLength(1);
    expect(res.uiBlocks[0]).toMatchObject({ type: "input-request", props: { action: "remix" } });
    // No paid skill ran; the closing line carries the turn.
    expect(res.skillRuns).toHaveLength(0);
    expect(ideas.run).not.toHaveBeenCalled();
    expect(res.toolCalls.find((t) => t.name === "request_link")?.ran).toBe(true);
    expect(res.text).toBe("Drop the link and I'll adapt it.");
  });

  it("absorbs a skill run error without throwing", async () => {
    const ideas = mkSkill("generate_ideas", { run: vi.fn(async () => { throw new Error("engine down"); }) });
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("sorry, that failed")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [ideas] }));

    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]!.ran).toBe(false);
    expect(res.toolCalls[0]!.note).toBe("error");
    expect(res.text).toBe("sorry, that failed");
  });
});
