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
});
