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
import type { SkillTool, SkillToolArgs } from "@/lib/tools/skill-dispatch";

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

function mkSkill(name: string, opts: { paid?: boolean; primaryArg?: "topic" | "draft"; run?: SkillTool["run"]; skillKey?: string } = {}): SkillTool {
  return {
    name,
    // Display key (the run-capsule seam) — mirrors the real registry's mapping shape.
    skillKey: opts.skillKey ?? name.replace(/^generate_|^write_/, ""),
    // `paid` in the fixture opts means "declares a price" — the real registry names WHICH price.
    ...((opts.paid ?? true) ? { billable: "ideas" as const } : {}),
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

/**
 * A recording gate + till. Allows by default; `allowed: false` makes it the out-of-credits case.
 * Every test that RUNS a billable skill must pass one — the loop refuses a priced skill it has no
 * way to charge for (see the fail-closed test below), which is why DEPS supplies one by default.
 */
function mkBilling(opts: { allowed?: boolean; reason?: string } = {}) {
  const gate = vi.fn(async () => ({
    allowed: opts.allowed ?? true,
    ...(opts.reason ? { reason: opts.reason } : {}),
    tier: "pro" as const,
  }));
  const bill = vi.fn(async () => {});
  return { gate, bill };
}

const DEPS = (streamComplete: StreamingChatComplete, over: Partial<ChatAgentStreamDeps> = {}): ChatAgentStreamDeps => ({
  streamComplete,
  model: "test-model",
  seed: 1,
  billing: mkBilling(),
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

  it("announces the dispatch (onDispatch with the skill KEY) BEFORE the skill runs — the run-capsule seam", async () => {
    // The client's labeled progress capsule hangs off this: the dispatch event names WHICH skill
    // the agent chose the moment it chooses it, so the spine can seed the right plan + label
    // before the first stage event arrives. Key = the tool's display key ('ideas'), not the tool
    // name ('generate_ideas').
    const order: string[] = [];
    const ideas = mkSkill("generate_ideas", {
      run: vi.fn(async () => {
        order.push("run");
        return { blocks: [], warnings: [] };
      }),
    });
    const onDispatch = vi.fn((skill: string) => order.push(`dispatch:${skill}`));
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "x"}')],
      [textChunk("done")],
    ]);

    await runChatAgentStream(baseInput({ onDispatch }), DEPS(stream, { skills: [ideas] }));

    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onDispatch).toHaveBeenCalledWith("ideas");
    expect(order).toEqual(["dispatch:ideas", "run"]);
  });

  it("does NOT announce a dispatch for request_input or search_corpus (free tools, no run)", async () => {
    const onDispatch = vi.fn();
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "explore"}')],
      [textChunk("fill the field")],
    ]);

    await runChatAgentStream(baseInput({ onDispatch }), DEPS(stream, { skills: [] }));

    expect(onDispatch).not.toHaveBeenCalled();
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

  it("runs MULTIPLE search_corpus calls in one round CONCURRENTLY, results in call order", async () => {
    // The streaming spike observed four corpus calls emitted in a single round. Each is an embed + an
    // RPC (~10s), so serialising them cost the sum before a token could resume streaming. They are
    // read-only and independent — there is no reason for the second to wait on the first.
    let inFlight = 0;
    let maxInFlight = 0;
    const executeCorpus = vi.fn(async (args: Record<string, unknown>) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return {
        content: JSON.stringify({ query: args.query, count: 0, grounded: false }),
        examples: [],
        citable: [],
        record: { round: 1, query: String(args.query), axis: "topical" as const, rows: 0 },
      };
    });
    const stream = mockStream([
      [
        toolName(0, "s1", "search_corpus"), toolArgs(0, '{"query": "a"}'),
        toolName(1, "s2", "search_corpus"), toolArgs(1, '{"query": "b"}'),
        toolName(2, "s3", "search_corpus"), toolArgs(2, '{"query": "c"}'),
      ],
      [textChunk("done")],
    ]);

    const res = await runChatAgentStream(
      baseInput({ grounding: true }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")], executeCorpus: executeCorpus as never }),
    );

    expect(executeCorpus).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(3); // genuinely concurrent, not sequential
    expect(res.toolCalls.filter((t) => t.name === "search_corpus")).toHaveLength(3);
    // Order still matches the model's own call order so every tool_call_id lines up with its result.
    expect(executeCorpus.mock.calls.map((c) => (c[0] as { query: string }).query)).toEqual(["a", "b", "c"]);
  });

  // ── The citation as DATA (corpus-references) ──────────────────────────────
  // The rule: a source card is itself an assertion that these rows are relevant, so it renders only
  // when the tool granted a warrant. Prose degrades; cards do not get to.

  const corpusRow = {
    teardownId: "t1",
    handle: "creator1",
    videoUrl: "https://tiktok.com/@creator1/video/1",
    coverUrl: null,
    platform: "tiktok",
    multiplier: 12,
    views: 900_000,
    baselineLabel: "vs their usual views",
    fitLabel: "adjacent" as const,
    hookArchetype: "contrarian",
    format: "breakdowns-explainers",
    visualSetting: "greenscreen",
    editingStyle: "visual-greenscreen",
    niche: "content-creation",
    spokenHook: "You've been lied to about X.",
    hookTemplate: "You've been lied to about [X].",
    template: null,
    idea: null,
    whyItWorks: null,
    sourcePool: "curated" as const,
    trustWeight: 1,
    fromPersonal: false,
    similarity: 0.7,
  };

  const corpusResult = (over: Record<string, unknown> = {}) => ({
    content: JSON.stringify({ count: 1, grounded: true }),
    examples: [corpusRow],
    citable: [corpusRow],
    record: { round: 1, query: "hooks about X", axis: "topical" as const, rows: 1, grounded: true, warrant: "topical" as const },
    ...over,
  });

  it("emits a corpus-references block built from the TOOL's rows, and persists it", async () => {
    const executeCorpus = vi.fn(async () => corpusResult());
    const stream = mockStream([
      [toolName(0, "s1", "search_corpus"), toolArgs(0, '{"query": "hooks about X"}')],
      [textChunk("Here's what actually worked.")],
    ]);
    const onBlock = vi.fn();

    const res = await runChatAgentStream(
      baseInput({ grounding: true, onBlock }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")], executeCorpus: executeCorpus as never }),
    );

    const emitted = onBlock.mock.calls.map((c) => c[0]).find((b) => b?.type === "corpus-references");
    expect(emitted).toBeTruthy();
    expect(emitted.props.warrant).toBe("topical");
    // The numbers on the card come from the ROW, not from anything the model wrote.
    expect(emitted.props.sources[0]).toMatchObject({
      handle: "creator1",
      multiplier: 12,
      views: 900_000,
      baselineLabel: "vs their usual views",
      visualSetting: "greenscreen",
    });
    // Persisted too — otherwise the citation vanishes on reload while the prose citing it stays.
    expect(res.uiBlocks).toContainEqual(expect.objectContaining({ type: "corpus-references" }));
  });

  it("emits NO card when the search was not grounded (warrant 'none')", async () => {
    const executeCorpus = vi.fn(async () =>
      corpusResult({
        citable: [], // nothing cleared the warrant floor
        record: { round: 1, query: "absurd", axis: "topical" as const, rows: 5, grounded: false, warrant: "none" as const },
      }),
    );
    const stream = mockStream([
      [toolName(0, "s1", "search_corpus"), toolArgs(0, '{"query": "absurd"}')],
      [textChunk("I don't have proven examples for that.")],
    ]);
    const onBlock = vi.fn();

    const res = await runChatAgentStream(
      baseInput({ grounding: true, onBlock }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")], executeCorpus: executeCorpus as never }),
    );

    expect(onBlock.mock.calls.map((c) => c[0]).some((b) => b?.type === "corpus-references")).toBe(false);
    expect(res.uiBlocks).toHaveLength(0);
  });

  it("carries the applied FILTERS onto the card so a narrowed answer says it was narrowed", async () => {
    const executeCorpus = vi.fn(async () =>
      corpusResult({
        record: {
          round: 1, query: "greenscreen explainers", axis: "topical" as const, rows: 1, grounded: true,
          warrant: "topical" as const, facets: { visualSetting: "greenscreen" },
        },
      }),
    );
    const stream = mockStream([
      [toolName(0, "s1", "search_corpus"), toolArgs(0, '{"query": "greenscreen explainers", "visual_setting": "greenscreen"}')],
      [textChunk("ok")],
    ]);
    const onBlock = vi.fn();

    await runChatAgentStream(
      baseInput({ grounding: true, onBlock }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")], executeCorpus: executeCorpus as never }),
    );

    const emitted = onBlock.mock.calls.map((c) => c[0]).find((b) => b?.type === "corpus-references");
    expect(emitted.props.filters).toEqual({ visualSetting: "greenscreen" });
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

  it("names ONLY the generators actually bound — an unbound skill is never advertised", async () => {
    // REGRESSION (the free-content leak). An anonymous /go visitor is bound `skills: FREE_SKILL_TOOLS`,
    // which is EMPTY because every generator is billable — but the directive advertised all three
    // regardless. The model called generate_hooks, got "unknown skill", and wrote the hooks out in prose:
    // the paid product delivered free through the one door that is free by design. Same rule the corpus
    // tool already follows — never name a tool that is not bound.
    const capture: Array<Record<string, unknown>> = [];
    const spy = (stream: ReturnType<typeof mockStream>) =>
      (async (params: Record<string, unknown>) => {
        capture.push(params);
        return stream(params as never);
      }) as never;

    // Only ideas is bound → hooks/script must not be named.
    await runChatAgentStream(
      baseInput(),
      DEPS(spy(mockStream([[textChunk("ok")]])), { skills: [mkSkill("generate_ideas")] }),
    );
    const partial = (capture[0]!.messages as Array<{ role: string; content: string }>)[0]!.content;
    expect(partial).toContain("generate_ideas");
    expect(partial, "an unbound skill must never be advertised").not.toContain("generate_hooks");
    expect(partial).not.toContain("write_script");

    // Nothing bound (the anonymous case) → no generator named, and an explicit ban on writing it in prose.
    capture.length = 0;
    await runChatAgentStream(baseInput(), DEPS(spy(mockStream([[textChunk("ok")]])), { skills: [] }));
    const none = (capture[0]!.messages as Array<{ role: string; content: string }>)[0]!.content;
    expect(none).not.toContain("generate_ideas");
    expect(none).not.toContain("generate_hooks");
    expect(none).toContain("NO content-generation tools");
  });

  it("an unavailable skill tells the model NOT to answer in prose instead", async () => {
    // The unknown-skill branch used to hand back a bare {"error":"unknown skill"} — the only refusal
    // path with no do-not-fake instruction, which is what the model read as licence to write the pack.
    const inner = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic": "x"}')],
      [textChunk("ok")],
    ]);
    const seen: Array<Record<string, unknown>> = [];
    const stream = ((params: Record<string, unknown>) => {
      seen.push(params);
      return (inner as (p: never) => unknown)(params as never);
    }) as unknown as StreamingChatComplete;
    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [] }));

    expect(res.toolCalls[0]!.note).toBe("unknown skill");
    expect(res.skillRuns).toHaveLength(0);
    const toolResult = seen.at(-1) as unknown as { messages: Array<{ role: string; content?: string }> };
    const relayed = toolResult.messages.filter((m) => m.role === "tool").map((m) => m.content).join(" ");
    expect(relayed).toContain("not available on this account");
    expect(relayed, "the model must be told not to substitute prose").toContain("do NOT write");
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

  it("request_input(remix) emits a LINK input-request FIELD (onBlock + persisted uiBlocks), runs no paid skill", async () => {
    const ideas = mkSkill("generate_ideas");
    const onBlock = vi.fn();
    const stream = mockStream([
      // The model asks for a link instead of guessing a URL.
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "remix"}')],
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
    expect(res.uiBlocks[0]).toMatchObject({ type: "input-request", props: { kind: "link", action: "remix" } });
    // No paid skill ran; the closing line carries the turn.
    expect(res.skillRuns).toHaveLength(0);
    expect(ideas.run).not.toHaveBeenCalled();
    expect(res.toolCalls.find((t) => t.name === "request_input")?.ran).toBe(true);
    expect(res.text).toBe("Drop the link and I'll adapt it.");
  });

  it("request_input(account) emits a NONE field (a confirm button — no typed input)", async () => {
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "account"}')],
      [textChunk("Press the button and I'll read your account.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.uiBlocks[0]).toMatchObject({ type: "input-request", props: { kind: "none", action: "account" } });
    // A `none` field carries no placeholder/prefill (nothing to type).
    expect((res.uiBlocks[0] as { props: { placeholder?: string; prefill?: string } }).props.placeholder).toBeUndefined();
    expect((res.uiBlocks[0] as { props: { prefill?: string } }).props.prefill).toBeUndefined();
  });

  it("request_input(read) carries a model-extracted PREFILL for the text field (editable, user-submitted)", async () => {
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "read", "value": "a video on cold plunges"}')],
      [textChunk("Here's a field — tweak it and hit read.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.uiBlocks[0]).toMatchObject({
      type: "input-request",
      props: { kind: "text", action: "read", prefill: "a video on cold plunges" },
    });
  });

  it("request_input(test) emits an UPLOAD field (a video drop — the /test heavy input)", async () => {
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "test"}')],
      [textChunk("Drop the video and I'll test it.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.uiBlocks[0]).toMatchObject({
      type: "input-request",
      props: { kind: "upload", action: "test", label: expect.any(String) },
    });
    // No `value` supplied → nothing to seed the URL half with; the field opens empty.
    expect((res.uiBlocks[0] as { props: { prefill?: string } }).props.prefill).toBeUndefined();
    expect(res.toolCalls.find((t) => t.name === "request_input")?.ran).toBe(true);
  });

  it("request_input(test) DROPS a prefill that is not a TikTok URL (the field would reject it)", async () => {
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "test", "value": "some text"}')],
      [textChunk("Drop the video.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect((res.uiBlocks[0] as { props: { prefill?: string } }).props.prefill).toBeUndefined();
  });

  // ── The pasted link is not typed twice ────────────────────────────────────────
  // A creator who pastes a link and says "test this" gave us the value already. Before these,
  // `test`/`remix` surfaced an EMPTY field and asked for it a second time.

  it("request_input(test) carries a pasted TikTok link through as the field's prefill", async () => {
    const stream = mockStream([
      [
        toolName(0, "c1", "request_input"),
        toolArgs(0, '{"action": "test", "value": "https://www.tiktok.com/@a/video/123"}'),
      ],
      [textChunk("Testing that one.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.uiBlocks[0]).toMatchObject({
      type: "input-request",
      props: { kind: "upload", action: "test", prefill: "https://www.tiktok.com/@a/video/123" },
    });
  });

  it("request_input(remix) carries a pasted link through as the field's prefill", async () => {
    const stream = mockStream([
      [
        toolName(0, "c1", "request_input"),
        toolArgs(0, '{"action": "remix", "value": "https://www.instagram.com/reel/xyz/"}'),
      ],
      [textChunk("Adapting that one.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    // Remix takes any public video link — its route classifies it, so the loop only checks http(s).
    expect(res.uiBlocks[0]).toMatchObject({
      type: "input-request",
      props: { kind: "link", action: "remix", prefill: "https://www.instagram.com/reel/xyz/" },
    });
  });

  it("request_input(remix) DROPS a prefill that is not a URL", async () => {
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "remix", "value": "that dance video"}')],
      [textChunk("Paste the link.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect((res.uiBlocks[0] as { props: { prefill?: string } }).props.prefill).toBeUndefined();
  });

  it("request_input(account) never takes a prefill — a `none` field has nothing to fill", async () => {
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "account", "value": "https://tiktok.com/@me"}')],
      [textChunk("Press the button.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect((res.uiBlocks[0] as { props: { prefill?: string } }).props.prefill).toBeUndefined();
  });

  it("request_input with an unknown action is refused (no field emitted)", async () => {
    const onBlock = vi.fn();
    const stream = mockStream([
      [toolName(0, "c1", "request_input"), toolArgs(0, '{"action": "simulate"}')],
      [textChunk("ok")],
    ]);

    const res = await runChatAgentStream(baseInput({ onBlock }), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.uiBlocks).toHaveLength(0);
    expect(onBlock).not.toHaveBeenCalled();
    expect(res.toolCalls.find((t) => t.name === "request_input")?.ran).toBe(false);
    expect(res.toolCalls.find((t) => t.name === "request_input")?.note).toBe("unknown action");
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

// ── THE MONEY SEAM ────────────────────────────────────────────────────────────
// A skill reached through the pill went to its own gated, billed route; the same skill reached
// through the agent came through this loop, which charged nothing. These lock the two doors to the
// same price — and lock the failure direction, which is the part that actually protects the money.

describe("runChatAgentStream [billing]", () => {
  it("gates a billable skill BEFORE the engine runs, then bills it on delivery", async () => {
    const billing = mkBilling();
    const ideas = mkSkill("generate_ideas");
    const order: string[] = [];
    billing.gate.mockImplementation(async () => {
      order.push("gate");
      return { allowed: true, tier: "pro" as const };
    });
    billing.bill.mockImplementation(async () => {
      order.push("bill");
    });
    (ideas.run as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push("run");
      return { blocks: [{ type: "idea-card", props: {} }], warnings: [] };
    });
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("made them")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [ideas], billing }));

    // Admission first — a refused run must cost nothing, so the gate cannot follow the engine.
    expect(order).toEqual(["gate", "run", "bill"]);
    expect(billing.gate).toHaveBeenCalledWith("ideas");
    // The bill is stamped with the tier the GATE resolved, not one re-read afterwards.
    expect(billing.bill).toHaveBeenCalledWith("ideas", "pro");
    expect(res.skillRuns).toHaveLength(1);
  });

  it("a REFUSED gate does not run the engine, and hands the model the wall's own sentence", async () => {
    const billing = mkBilling({ allowed: false, reason: "You've used all 500 credits on your plan this month." });
    const ideas = mkSkill("generate_ideas");
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("You're out of credits this month.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [ideas], billing }));

    expect(ideas.run).not.toHaveBeenCalled();
    expect(billing.bill).not.toHaveBeenCalled();
    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]).toMatchObject({ ran: false, note: "credit gate refused" });
    expect(res.text).toBe("You're out of credits this month.");

    // The refusal copy is the SERVER's, not the model's invention. A streaming turn cannot BE a
    // 402, so the wall's own sentence has to reach the model as a tool result for it to relay —
    // assert it actually landed in the next round's messages rather than trusting the shape.
    const secondRound = (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[1]![0] as {
      messages: Array<{ role: string; content?: string }>;
    };
    const toolResult = secondRound.messages.find((m) => m.role === "tool");
    expect(toolResult?.content).toContain("You've used all 500 credits on your plan this month.");
  });

  it("a REFUSED gate raises the credit wall, so chat is not a dead end at the paywall", async () => {
    // Without this the creator hits the wall as a sentence in the thread with no upgrade door —
    // and once the skill pill is gone, that is EVERY generator refusal. The dedicated routes all
    // answer 402 → dialog; a streaming turn can't, so the body rides its own frame instead.
    const quotaBody = { error: "credit_quota_exceeded", message: "out of credits", cost: 1 };
    const billing = mkBilling({ allowed: false, reason: "out of credits" });
    billing.gate.mockImplementation(async () => ({
      allowed: false,
      reason: "out of credits",
      tier: "pro" as const,
      quota: quotaBody,
    }));
    const onCreditWall = vi.fn();
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("you're out of credits")],
    ]);

    await runChatAgentStream(
      baseInput({ onCreditWall }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")], billing }),
    );

    expect(onCreditWall).toHaveBeenCalledTimes(1);
    expect(onCreditWall).toHaveBeenCalledWith(quotaBody);
  });

  it("an ALLOWED run never raises the wall", async () => {
    const onCreditWall = vi.fn();
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("made them")],
    ]);

    await runChatAgentStream(baseInput({ onCreditWall }), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(onCreditWall).not.toHaveBeenCalled();
  });

  it("FAILS CLOSED: a billable skill with no billing seam is refused, never run for free", async () => {
    // The whole defect this seam closes was an ungated path nobody noticed. If a future caller
    // forgets to wire the till, the run must STOP — a silent free fallback would rebuild the bug.
    const ideas = mkSkill("generate_ideas");
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("can't do that right now")],
    ]);

    const res = await runChatAgentStream(
      baseInput(),
      DEPS(stream, { skills: [ideas], billing: undefined }),
    );

    expect(ideas.run).not.toHaveBeenCalled();
    expect(res.skillRuns).toHaveLength(0);
    expect(res.toolCalls[0]).toMatchObject({ ran: false, note: "no billing seam" });
  });

  it("a FREE skill (no declared price) runs with no gate and no bill", async () => {
    const free = mkSkill("free_tool", { paid: false });
    const billing = mkBilling();
    const stream = mockStream([
      [toolName(0, "c1", "free_tool"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("done")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [free], billing }));

    expect(free.run).toHaveBeenCalled();
    expect(billing.gate).not.toHaveBeenCalled();
    expect(billing.bill).not.toHaveBeenCalled();
    expect(res.skillRuns).toHaveLength(1);
  });

  it("a run that THROWS is never billed — the till follows delivery, not intent", async () => {
    const billing = mkBilling();
    const ideas = mkSkill("generate_ideas", {
      run: vi.fn(async () => {
        throw new Error("engine down");
      }),
    });
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("that failed")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [ideas], billing }));

    expect(billing.gate).toHaveBeenCalledTimes(1);
    expect(billing.bill).not.toHaveBeenCalled();
    expect(res.skillRuns).toHaveLength(0);
  });
  // ── Prior turns: a thread must not poison its own later turns ──────────────
  //
  // REGRESSION. A dispatching turn persists as cards + a closing line ("Five hooks are on screen.");
  // only the line crosses into the anchor. With no trace of the tool call anywhere in the transcript,
  // the model asked for hooks again reproduced the sentence and called NOTHING — zero cards under a
  // UI insisting five existed (confirmed live 2026-08-04; a replay of the real thread measured 0/3
  // shipped → 3/3 with the runs replayed). A prompt clause was tried first and failed.

  it("replays a prior tool-producing turn as the tool-call exchange it actually was", async () => {
    const stream = mockStream([[textChunk("ok")]]);
    const ideas = mkSkill("generate_ideas");

    await runChatAgentStream(
      baseInput({
        priorTurns: [
          { role: "user", text: "hooks for my budgeting app" },
          {
            role: "assistant",
            text: "Five hooks are on screen.",
            toolRuns: [{ name: "generate_ideas", cards: 5, topic: "hooks for my budgeting app" }],
          },
        ],
      }),
      DEPS(stream, { skills: [ideas] }),
    );

    const { messages } = (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<Record<string, unknown>>;
    };
    // system, user, [assistant+tool_calls, tool, assistant], user-ask. NB the loop pushes its own
    // round message onto this same array afterwards, so assert POSITIONS, never the length.
    expect(messages[1]).toEqual({ role: "user", content: "hooks for my budgeting app" });
    const call = messages[2] as { role: string; content: unknown; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
    expect(call.role).toBe("assistant");
    expect(call.tool_calls?.[0]?.function.name).toBe("generate_ideas");
    expect(JSON.parse(call.tool_calls![0]!.function.arguments)).toEqual({ topic: "hooks for my budgeting app" });
    const result = messages[3] as { role: string; tool_call_id: string; content: string };
    expect(result.role).toBe("tool");
    expect(result.tool_call_id).toBe(call.tool_calls![0]!.id);
    expect(JSON.parse(result.content)).toMatchObject({ ran: "generate_ideas", produced: "5 card(s)" });
    // …and only THEN the sentence, so it reads as what follows a tool call, not as a template.
    expect(messages[4]).toEqual({ role: "assistant", content: "Five hooks are on screen." });
    expect(messages[5]).toEqual({ role: "user", content: "x" }); // then this turn's ask
  });

  it("replays the card LINES so the model can discuss what it made", async () => {
    // REGRESSION (live). With only a count in the tool result, "Which of these hooks is strongest?"
    // — a shipped chip — answered "I don't have the specific hook lines in front of me. Paste the
    // 2–3 options you're debating", about cards the app had just rendered.
    const stream = mockStream([[textChunk("ok")]]);
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });

    await runChatAgentStream(
      baseInput({
        priorTurns: [
          {
            role: "assistant",
            text: "Two hooks are on screen.",
            toolRuns: [{ name: "generate_hooks", cards: 2, lines: ["Everyone lied about 5am", "Your £4 coffee"] }],
          },
        ],
      }),
      DEPS(stream, { skills: [hooks] }),
    );

    const { messages } = (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<Record<string, unknown>>;
    };
    const result = JSON.parse((messages[2] as { content: string }).content);
    expect(result.cards_on_screen).toEqual(["Everyone lied about 5am", "Your £4 coffee"]);
    expect(result.produced).toBe("2 card(s)");
    // …and told NOT to re-list them, or the answer becomes a second copy of the pack in prose.
    expect(result.note).toMatch(/never re-list/i);
  });

  it("a run with no lines keeps the ORIGINAL tool-result shape", async () => {
    // Pre-existing threads carry no extractable lines. They must replay exactly as before rather
    // than announcing an empty card list, which would read as "the pack has no contents".
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(
      baseInput({
        priorTurns: [
          { role: "assistant", text: "Five hooks are on screen.", toolRuns: [{ name: "generate_hooks", cards: 5 }] },
        ],
      }),
      DEPS(stream, { skills: [mkSkill("generate_hooks", { skillKey: "hooks" })] }),
    );

    const { messages } = (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<Record<string, unknown>>;
    };
    const result = JSON.parse((messages[2] as { content: string }).content);
    expect(result).toEqual({
      ran: "generate_hooks",
      produced: "5 card(s)",
      note: "cards are shown to the creator",
    });
  });

  it("an ANONYMOUS visitor never receives the lines of a pack they did not pay for", async () => {
    // The unbound-run fallback below already drops the whole run to plain text. This pins the
    // consequence that matters for money: the hook lines must not ride along in the transcript of
    // a session that binds no generators — that would hand over the paid artefact for free, which
    // is the same leak the tool-use directive exists to close.
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(
      baseInput({
        priorTurns: [
          {
            role: "assistant",
            text: "Five hooks are on screen.",
            toolRuns: [{ name: "generate_hooks", cards: 5, lines: ["Everyone lied about 5am"] }],
          },
        ],
      }),
      DEPS(stream, { skills: [] }),
    );

    const { messages } = (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<Record<string, unknown>>;
    };
    expect(JSON.stringify(messages)).not.toContain("Everyone lied about 5am");
    expect(JSON.stringify(messages)).not.toContain("cards_on_screen");
  });

  it("a prior run whose tool is NOT bound replays as plain text — never a dangling tool name", async () => {
    // An anonymous visitor binds no generators. Naming one in the replayed transcript would advertise
    // a tool the model cannot call — the same rule the tool-use directive follows.
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(
      baseInput({
        priorTurns: [
          { role: "assistant", text: "Five hooks are on screen.", toolRuns: [{ name: "generate_hooks", cards: 5 }] },
        ],
      }),
      DEPS(stream, { skills: [] }),
    );

    const { messages } = (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<Record<string, unknown>>;
    };
    expect(messages[1]).toEqual({ role: "assistant", content: "Five hooks are on screen." });
    expect(messages[2]).toEqual({ role: "user", content: "x" }); // the ask follows immediately
    expect(JSON.stringify(messages)).not.toContain("tool_calls");
  });

  it("a prior turn with no runs is one plain message, exactly as before", async () => {
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(
      baseInput({
        priorTurns: [
          { role: "user", text: "why do my videos flop?" },
          { role: "assistant", text: "no stakes in the first beat" },
        ],
      }),
      DEPS(stream, { skills: [mkSkill("generate_ideas")] }),
    );

    const { messages } = (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: Array<Record<string, unknown>>;
    };
    expect(messages.slice(1, 3)).toEqual([
      { role: "user", content: "why do my videos flop?" },
      { role: "assistant", content: "no stakes in the first beat" },
    ]);
  });
});

// ── forceSkill: the creator already chose, so the model does not get to re-decide ──────────────
//
// REGRESSION. A tapped follow-up chip sends a sentence that reads as subject-less on its own
// ("Give me a few more hook options."), so the loop's own directive classed it "too vague or too
// generic" and pushed back for a sharper angle instead of running: 0/3, unchanged by the prior-turn
// fix above, and NOT fixable in prompt text (a continuation clause reached 1/3 and destabilised
// sibling chips). The chip therefore declares its generator and the loop pins tool_choice to it.
//
// Every test here also pins the BLAST RADIUS: the pin is round-1 only, it is dropped when the skill
// is not bound, and it does not exist for a turn that did not ask for it.
describe("runChatAgentStream [forceSkill]", () => {
  /** The `tool_choice` the loop sent on each model round, in order. */
  const choices = (stream: StreamingChatComplete): unknown[] =>
    (stream as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { tool_choice: unknown }).tool_choice,
    );

  it("pins round 1 to the declared skill, then hands `auto` back for the closing line", async () => {
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic": "budgeting app"}')],
      [textChunk("Five more hooks are on screen.")],
    ]);

    const res = await runChatAgentStream(
      baseInput({ forceSkill: "hooks" }),
      DEPS(stream, { skills: [hooks] }),
    );

    expect(choices(stream)).toEqual([
      { type: "function", function: { name: "generate_hooks" } },
      // Round 2 MUST be auto — a pin left in place makes the model call the same tool forever
      // instead of writing the line that tells the creator what it made.
      "auto",
    ]);
    expect(res.skillRuns).toHaveLength(1);
    expect(res.text).toBe("Five more hooks are on screen.");
  });

  it("resolves the DISPLAY key, not the tool name — the two namespaces differ", async () => {
    // The chip speaks ChatTurnKind ('hooks'); the tool is `generate_hooks`. Passing the tool name
    // through unresolved would silently produce a tool_choice the API rejects.
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(baseInput({ forceSkill: "hooks" }), DEPS(stream, { skills: [hooks] }));

    expect(choices(stream)[0]).toEqual({ type: "function", function: { name: "generate_hooks" } });
  });

  it("IGNORES a skill that is not bound — an anonymous visitor is never forced into a paid run", async () => {
    // `skills: []` is what a sealed /go visitor gets (every generator is billable). A pin naming a
    // tool absent from `tools` would be rejected by the API outright; worse, honouring it would aim
    // the free door straight at the paid engine. It degrades to the ordinary unpinned turn.
    const stream = mockStream([[textChunk("Making that needs an account with credits.")]]);

    const res = await runChatAgentStream(baseInput({ forceSkill: "hooks" }), DEPS(stream, { skills: [] }));

    expect(choices(stream)).toEqual(["auto"]);
    expect(res.skillRuns).toHaveLength(0);
  });

  it("IGNORES an unknown key rather than failing the turn", async () => {
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(
      baseInput({ forceSkill: "nonsense" }),
      DEPS(stream, { skills: [mkSkill("generate_ideas", { skillKey: "ideas" })] }),
    );

    expect(choices(stream)).toEqual(["auto"]);
  });

  it("no forceSkill → `auto` on every round, byte-identical to a typed ask", async () => {
    // THE CONTROL. A typed message never carries a skill, so this change cannot reach it. That is
    // what makes the fix a targeting change rather than a blanket "dispatch more".
    const stream = mockStream([
      [toolName(0, "c1", "generate_ideas"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("done")],
    ]);

    await runChatAgentStream(
      baseInput(),
      DEPS(stream, { skills: [mkSkill("generate_ideas", { skillKey: "ideas" })] }),
    );

    expect(choices(stream)).toEqual(["auto", "auto"]);
  });

  it("a pinned run is still GATED and BILLED — the pin picks the tool, never the price", async () => {
    const billing = mkBilling({ allowed: false, reason: "You're out of credits." });
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic": "a"}')],
      [textChunk("You're out of credits.")],
    ]);

    const res = await runChatAgentStream(
      baseInput({ forceSkill: "hooks" }),
      DEPS(stream, { skills: [hooks], billing }),
    );

    expect(billing.gate).toHaveBeenCalledWith("ideas"); // mkSkill's fixture price
    expect(hooks.run).not.toHaveBeenCalled();
    expect(res.skillRuns).toHaveLength(0);
  });
});

// ── Stage B: the data riders (B1 anchor · B2 cards) and the `cards` schema slot ────────────────
//
// `forceSkill` fixed WHICH tool a tapped chip runs. These fix what it runs ON. Two measured gaps:
//
//   B1  A card CTA ("Write the script from #1 →") carries an exact line. Routed through the loop,
//       the model writes the anchor itself from the transcript — so the run opens from a paraphrase
//       of the hook the creator clicked, which is a different hook.
//   B2  "Rewrite these hooks tighter" dispatched a fresh run with no way to SEE "these", and
//       returned five strangers. The pack now rides as data, or through a declared schema slot.
//
// Both riders are scoped exactly like the pin that carries them — round 1, the pinned tool, nothing
// else — so a typed ask and every later round stay byte-identical. That scope is what these lock.
describe("runChatAgentStream [Stage B riders]", () => {
  /** The args the skill's `run` actually received (what the pipeline will be handed). */
  const ranWith = (skill: SkillTool): SkillToolArgs | undefined =>
    (skill.run as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

  it("forceAnchor OVERRIDES the anchor the model wrote — the clicked line, not a paraphrase", async () => {
    const script = mkSkill("write_script", { skillKey: "script" });
    const stream = mockStream([
      // The model paraphrases the hook it saw in the transcript. It is close, and it is wrong.
      [toolName(0, "c1", "write_script"), toolArgs(0, '{"topic":"budgeting","anchor":"a hook about saving money"}')],
      [textChunk("Script is on screen.")],
    ]);

    await runChatAgentStream(
      baseInput({ forceSkill: "script", forceAnchor: "I saved $4,000 in 6 weeks by cancelling one thing" }),
      DEPS(stream, { skills: [script] }),
    );

    expect(ranWith(script)).toMatchObject({
      topic: "budgeting",
      anchor: "I saved $4,000 in 6 weeks by cancelling one thing",
    });
  });

  it("forceAnchor stands in as the topic when the model wrote none — a CTA must not die on 'no topic'", async () => {
    // The loop refuses a call whose primary arg is empty. A pinned CTA run has a subject — the line
    // the creator clicked — so falling back to the refusal would fail a turn the creator explicitly
    // asked for, on a technicality about which field the model chose to fill.
    const script = mkSkill("write_script", { skillKey: "script" });
    const stream = mockStream([
      [toolName(0, "c1", "write_script"), toolArgs(0, "{}")],
      [textChunk("done")],
    ]);

    const res = await runChatAgentStream(
      baseInput({ forceSkill: "script", forceAnchor: "The 6-week rule that fixed my savings" }),
      DEPS(stream, { skills: [script] }),
    );

    expect(res.skillRuns).toHaveLength(1);
    expect(ranWith(script)).toMatchObject({
      topic: "The 6-week rule that fixed my savings",
      anchor: "The 6-week rule that fixed my savings",
    });
  });

  it("forceCards OVERRIDES a model-written pack — the chip names the cards, not the transcript", async () => {
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"a","cards":["something it half-remembered"]}')],
      [textChunk("done")],
    ]);

    await runChatAgentStream(
      baseInput({ forceSkill: "hooks", forceCards: ["Hook one, verbatim", "Hook two, verbatim"] }),
      DEPS(stream, { skills: [hooks] }),
    );

    expect(ranWith(hooks)!.cards).toEqual(["Hook one, verbatim", "Hook two, verbatim"]);
  });

  it("a JUNK forced pack degrades to an ordinary un-packed run — never a crashed dispatch", async () => {
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"a"}')],
      [textChunk("done")],
    ]);

    const res = await runChatAgentStream(
      // Every entry unusable: wrong type, and a blank that trims to nothing.
      baseInput({ forceSkill: "hooks", forceCards: [42 as unknown as string, "   "] }),
      DEPS(stream, { skills: [hooks] }),
    );

    expect(res.skillRuns).toHaveLength(1);
    expect(ranWith(hooks)!.cards).toBeUndefined();
  });

  it("IGNORES the riders on a typed ask — no pin, no override", async () => {
    // THE CONTROL, same shape as forceSkill's. The riders exist to honour a click; a message the
    // creator typed has no click behind it, so nothing here may reach it.
    const script = mkSkill("write_script", { skillKey: "script" });
    const stream = mockStream([
      [toolName(0, "c1", "write_script"), toolArgs(0, '{"topic":"t","anchor":"the model\'s own anchor"}')],
      [textChunk("done")],
    ]);

    await runChatAgentStream(
      baseInput({ forceAnchor: "a line nobody clicked", forceCards: ["nobody's pack"] }),
      DEPS(stream, { skills: [script] }),
    );

    expect(ranWith(script)).toMatchObject({ anchor: "the model's own anchor" });
    expect(ranWith(script)!.cards).toBeUndefined();
  });

  it("IGNORES the riders on round 2 — the click is spent on the call it pinned", async () => {
    // The pin is round-1 only, and so is what it carries. A second call to the same tool later in
    // the turn is the model's own decision about a new subject; re-forcing the clicked line onto it
    // would silently rewrite that decision.
    const script = mkSkill("write_script", { skillKey: "script" });
    const stream = mockStream([
      [toolName(0, "c1", "write_script"), toolArgs(0, '{"topic":"first"}')],
      [toolName(0, "c2", "write_script"), toolArgs(0, '{"topic":"second","anchor":"a second, different hook"}')],
      [textChunk("done")],
    ]);

    await runChatAgentStream(
      baseInput({ forceSkill: "script", forceAnchor: "the clicked line" }),
      DEPS(stream, { skills: [script] }),
    );

    const calls = (script.run as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]![0]).toMatchObject({ anchor: "the clicked line" });
    expect(calls[1]![0]).toMatchObject({ anchor: "a second, different hook" });
  });

  it("a model-written `cards` pack reaches the runner (sanitized) with no rider at all", async () => {
    // The typed door: "rewrite these" with the slot bound. The model copies the lines out of
    // cards_on_screen into the argument, and they must survive the parse.
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"a","cards":["  Line one  ","","Line two"]}')],
      [textChunk("done")],
    ]);

    await runChatAgentStream(baseInput(), DEPS(stream, { skills: [hooks] }));

    expect(ranWith(hooks)!.cards).toEqual(["Line one", "Line two"]);
  });

  it("caps the pack at 6 lines and each line at 500 chars — the assembler's fence budget", async () => {
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const many = JSON.stringify({ topic: "a", cards: [...Array(9)].map((_, i) => `card ${i}`.padEnd(700, "x")) });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, many)],
      [textChunk("done")],
    ]);

    await runChatAgentStream(baseInput(), DEPS(stream, { skills: [hooks] }));

    const cards = ranWith(hooks)!.cards!;
    expect(cards).toHaveLength(6);
    expect(cards.every((c) => c.length === 500)).toBe(true);
  });
});

// ── Stage B (B2): the `cards` slot on the generator schemas ────────────────────────────────────
//
// The slot is bound PER REQUEST by the loop, never baked into the registry, so a dark build sends
// the schemas it always sent. These lock both halves of that: on, the generators declare it; off,
// nothing about the request mentions it.
describe("runChatAgentStream [cardsSlot]", () => {
  /** The tool schemas the loop actually sent, by tool name. */
  const sentTools = (stream: StreamingChatComplete) =>
    new Map(
      (
        (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
          tools: Array<{ function: { name: string; parameters?: { properties?: Record<string, unknown> } } }>;
        }
      ).tools.map((t) => [t.function.name, t.function.parameters?.properties ?? {}]),
    );

  const system = (stream: StreamingChatComplete) =>
    String(
      (
        (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
          messages: Array<{ role: string; content: string }>;
        }
      ).messages.find((m) => m.role === "system")!.content,
    );

  it("binds `cards` on the GENERATORS only — an analysis skill scores a draft, it never rewrites a pack", async () => {
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const read = mkSkill("read_draft", { skillKey: "read", primaryArg: "draft" });
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(baseInput({ cardsSlot: true }), DEPS(stream, { skills: [hooks, read] }));

    expect(sentTools(stream).get("generate_hooks")).toHaveProperty("cards");
    expect(sentTools(stream).get("read_draft")).not.toHaveProperty("cards");
  });

  it("off ⇒ no schema carries the slot and the directive never mentions it", async () => {
    // Naming an argument the tool does not declare invites a malformed call — the same rule that
    // stops the directive advertising an unbound tool.
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(baseInput(), DEPS(stream, { skills: [hooks] }));

    expect(sentTools(stream).get("generate_hooks")).not.toHaveProperty("cards");
    expect(system(stream)).not.toContain("cards_on_screen");
  });

  it("on ⇒ the directive tells the model where the pack goes", async () => {
    const hooks = mkSkill("generate_hooks", { skillKey: "hooks" });
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(baseInput({ cardsSlot: true }), DEPS(stream, { skills: [hooks] }));

    expect(system(stream)).toContain("cards_on_screen");
  });

  it("leaves a schema with no `properties` alone rather than inventing one", async () => {
    // Defensive: withCardsSlot is handed whatever a skill declares. A shape it cannot extend must
    // pass through untouched — a half-built `parameters` object would break the call for a skill
    // that was working fine.
    const odd: SkillTool = { ...mkSkill("odd_tool"), schema: { type: "function", function: { name: "odd_tool" } } };
    const stream = mockStream([[textChunk("ok")]]);

    await runChatAgentStream(baseInput({ cardsSlot: true }), DEPS(stream, { skills: [odd] }));

    const sent = (
      (stream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { tools: unknown[] }
    ).tools[0];
    expect(sent).toEqual({ type: "function", function: { name: "odd_tool" } });
  });
});

/**
 * The artefact guard's STRUCTURE rule (2026-08-05).
 *
 * The guard was quote-scoped and the pack does not arrive quoted — it arrives as an enumerated list
 * of content units. Measured live, that gap leaked 6/6 on flash and was being covered by holding
 * this one path on a ~10x more expensive model. These lock the fix so the holdout stays retired:
 * the model constant is no longer what makes an anonymous visitor safe, this is.
 */
describe("the unbound artefact guard — structure, not just quotation", () => {
  /** Stream `text` through a fully unbound session (skills: []) and return what the visitor sees. */
  const seen = async (text: string, chunk = 5) => {
    const chunks: StreamChunk[] = [];
    for (let i = 0; i < text.length; i += chunk) chunks.push(textChunk(text.slice(i, i + chunk)));
    let out = "";
    await runChatAgentStream(
      baseInput({ onToken: (d: string) => { out += d; } }),
      DEPS(mockStream([chunks]), { skills: [] }),
    );
    return out;
  };

  /** The same stream for a SIGNED-IN creator, who has generators bound and is never guarded. */
  const seenSignedIn = async (text: string, chunk = 5) => {
    const chunks: StreamChunk[] = [];
    for (let i = 0; i < text.length; i += chunk) chunks.push(textChunk(text.slice(i, i + chunk)));
    let out = "";
    await runChatAgentStream(
      baseInput({ onToken: (d: string) => { out += d; } }),
      DEPS(mockStream([chunks]), { skills: [mkSkill("generate_hooks")] }),
    );
    return out;
  };

  const PACK = [
    "Here are 5 video concepts for a student budgeting app.",
    "",
    '### 1. The "Subscription Vampire" Audit',
    "*   **Concept:** A screen-recording walkthrough showing how to find and cancel hidden charges.",
    "*   **Mechanism:** Utility & Fear of Loss. People hate losing money they did not know about.",
    "*   **CTA:** Save this for your next bank statement check.",
    "",
    "That is the structure that works.",
  ].join("\n");

  it("redacts an enumerated pack that carries NO quotation marks — the live 6/6 leak shape", async () => {
    const out = await seen(PACK);
    // The bodies are the artefact. None of them may reach an anonymous visitor.
    expect(out).not.toContain("screen-recording walkthrough");
    expect(out).not.toContain("Fear of Loss");
    expect(out).not.toContain("next bank statement check");
    // The surrounding prose is NOT the artefact and must survive, or the answer stops being one.
    expect(out).toContain("Here are 5 video concepts");
    expect(out).toContain("That is the structure that works.");
  });

  it("collapses a run of redacted items into ONE marker — five stacked reads as a malfunction", async () => {
    const out = await seen(PACK);
    expect(out.match(/needs an account with credits/g) ?? []).toHaveLength(1);
  });

  it("leaves SHORT list items alone — a label is not a pack", async () => {
    const benign = "What this does:\n- Hooks\n- Scripts\n- Audience reads\n\nSign up to run it.";
    expect(await seen(benign)).toBe(benign);
  });

  it("does not mistake **bold** or a --- rule at line start for a list marker", async () => {
    const prose = "**Bold lead.** Then a sentence that runs on for a good while to be safe.\n---\nMore.";
    expect(await seen(prose)).toBe(prose);
  });

  it("judges a structured line left unterminated at end-of-stream, rather than releasing it", async () => {
    // The last item of a pack often arrives with no trailing newline. Releasing it unjudged would
    // reopen the leak on exactly the line the model was building toward.
    const out = await seen("Options:\n*   **Hook:** Everyone lied to you about waking up at 5am daily");
    expect(out).not.toContain("Everyone lied to you about waking up at 5am");
  });

  it("keeps the ORIGINAL quote rule — a long quoted line is still redacted", async () => {
    const out = await seen('Lead with a specific cost ("the $47 I lost every month without noticing").');
    expect(out).not.toContain("the $47 I lost every month without noticing");
  });

  it("still releases a SHORT quotation — a term of art is not the artefact", async () => {
    const s = 'Do not lead with "save money" — it is generic.';
    expect(await seen(s)).toBe(s);
  });

  it("a SIGNED-IN creator's stream is byte-for-byte untouched — they paid for the lines", async () => {
    expect(await seenSignedIn(PACK)).toBe(PACK);
  });
});

/**
 * The guard's ON switch (2026-08-05).
 *
 * It used to arm from `generators.length === 0`, i.e. from the CONSEQUENCE of being anonymous.
 * That holds only while FREE_SKILL_TOOLS is empty — and it is DERIVED from `billable`, so it is
 * empty by accident of pricing. One non-billable skill (which is exactly what a free tier is) makes
 * it non-empty, and the guard would have switched off for every anonymous visitor with nothing
 * failing. These pin the fact-based switch instead.
 */
describe("the artefact guard arms on WHO the visitor is, not on what happens to be bound", () => {
  const QUOTED = 'Try ("the $47 I lost every month without noticing") as the opener.';

  const streamAs = async (over: Partial<ChatAgentStreamDeps>) => {
    let out = "";
    await runChatAgentStream(
      baseInput({ onToken: (d: string) => { out += d; } }),
      DEPS(mockStream([[textChunk(QUOTED)]]), over),
    );
    return out;
  };

  it("stays ON for a sealed visitor even when a FREE generator is bound", async () => {
    // The regression a free tier would have introduced: a non-billable skill lands in
    // FREE_SKILL_TOOLS, `unbound` goes false, and the old switch disarmed itself.
    const out = await streamAs({ sealedVisitor: true, skills: [mkSkill("free_thing")] });
    expect(out).not.toContain("the $47 I lost every month without noticing");
  });

  it("still arms with nothing bound at all, even if the caller forgets to say so", async () => {
    const out = await streamAs({ skills: [] });
    expect(out).not.toContain("the $47 I lost every month without noticing");
  });

  it("stays OFF for a paying creator — their stream is byte-for-byte their own product", async () => {
    const out = await streamAs({ sealedVisitor: false, skills: [mkSkill("generate_hooks")] });
    expect(out).toBe(QUOTED);
  });
});

// ─── Stage A (2026-08-10): warnings, arg caps, post-tool text containment ─────────

describe("runChatAgentStream [Stage A guards]", () => {
  it("passes the runner's REAL warnings + skillKey through (the [] hardcode is gone)", async () => {
    const skill = mkSkill("generate_hooks", {
      run: vi.fn(async () => ({
        blocks: [{ type: "hook-card", props: {} }],
        warnings: ["grounding failed (degraded to ungrounded): boom"],
      })),
    });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"coffee"}')],
      [textChunk("Done.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [skill] }));

    expect(res.skillRuns[0]!.warnings).toEqual(["grounding failed (degraded to ungrounded): boom"]);
    expect(res.skillRuns[0]!.skillKey).toBe("hooks");
  });

  it("caps the model-written topic (2000) and anchor (5000) like the dedicated routes", async () => {
    const run = vi.fn(async (_args: import("@/lib/tools/skill-dispatch").SkillToolArgs) => ({ blocks: [], warnings: [] }));
    const skill = mkSkill("generate_hooks", { run });
    const bigTopic = "t".repeat(3000);
    const bigAnchor = "a".repeat(6000);
    const stream = mockStream([
      [
        toolName(0, "c1", "generate_hooks"),
        toolArgs(0, JSON.stringify({ topic: bigTopic, anchor: bigAnchor })),
      ],
      [textChunk("ok")],
    ]);

    await runChatAgentStream(baseInput(), DEPS(stream, { skills: [skill] }));

    const args = run.mock.calls[0]![0]!;
    expect(args.topic!.length).toBe(2000);
    expect(args.anchor!.length).toBe(5000);
  });

  it("drops a non-string anchor instead of coercing it to '[object Object]'", async () => {
    const run = vi.fn(async (_args: import("@/lib/tools/skill-dispatch").SkillToolArgs) => ({ blocks: [], warnings: [] }));
    const skill = mkSkill("generate_hooks", { run });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"x","anchor":{"a":1}}')],
      [textChunk("ok")],
    ]);

    await runChatAgentStream(baseInput(), DEPS(stream, { skills: [skill] }));
    expect(run.mock.calls[0]![0]!.anchor).toBeUndefined();
  });

  it("carries a numeric count through to the skill (N-4 — '3 hooks' survives the router rewrite)", async () => {
    const run = vi.fn(async (_args: import("@/lib/tools/skill-dispatch").SkillToolArgs) => ({ blocks: [], warnings: [] }));
    const skill = mkSkill("generate_hooks", { run });
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"sugar-free month","count":3}')],
      [textChunk("ok")],
    ]);

    await runChatAgentStream(baseInput(), DEPS(stream, { skills: [skill] }));
    expect(run.mock.calls[0]![0]!.count).toBe(3);
  });

  it("F-1 containment: post-tool text is capped, pre-tool text is not", async () => {
    const skill = mkSkill("generate_hooks", {
      run: vi.fn(async () => ({ blocks: [{ type: "hook-card", props: {} }], warnings: [] })),
    });
    const reAnswer = "All ten hooks again in markdown! ".repeat(60); // ~1,900 chars
    let streamed = "";
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"coffee"}')],
      [textChunk(reAnswer)],
    ]);

    const res = await runChatAgentStream(
      baseInput({ onToken: (d: string) => { streamed += d; } }),
      DEPS(stream, { skills: [skill] }),
    );

    expect(res.text.length).toBeLessThanOrEqual(600);
    expect(streamed.length).toBeLessThanOrEqual(600);
  });

  it("a turn whose skill produced NO cards keeps its prose uncapped (refusals need words)", async () => {
    const skill = mkSkill("generate_hooks", {
      run: vi.fn(async () => ({ blocks: [], warnings: ["sub-floored"] })),
    });
    const longExplain = "Here is why that could not be generated and what to try. ".repeat(20);
    const stream = mockStream([
      [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"x"}')],
      [textChunk(longExplain)],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [skill] }));
    expect(res.text.length).toBeGreaterThan(600);
  });
});
