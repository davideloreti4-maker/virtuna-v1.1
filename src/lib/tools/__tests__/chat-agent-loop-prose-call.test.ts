/**
 * chat-agent-loop-prose-call.test.ts — the prose-call pin, inside the loop.
 *
 * `prose-call.test.ts` covers the detector and the guard in isolation. This covers what only the
 * loop can show: that a written call becomes ONE more pinned round, that the pin is consumed rather
 * than left standing, that it cannot loop, and that every path it does not own is byte-identical.
 *
 * ⚠️ Every assertion was verified RED against the unfixed loop before being kept — the same rule the
 * unit file carries, for the same reason (session 11 mutation 3, session 12's three green
 * assertions against a fully-present defect). Battery: `.scratch/mutate-prose-call-loop.sh`.
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

const textChunk = (s: string): StreamChunk => ({ choices: [{ delta: { content: s } }] });
const toolName = (index: number, id: string, name: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, id, function: { name } }] } }],
});
const toolArgs = (index: number, args: string): StreamChunk => ({
  choices: [{ delta: { tool_calls: [{ index, function: { arguments: args } }] } }],
});

/** Records the `tool_choice` of every model call so the pin can be asserted per round. */
function mockStream(rounds: StreamChunk[][]) {
  const choices: unknown[] = [];
  let i = 0;
  const fn = vi.fn(async (params: Record<string, unknown>) => {
    choices.push(params.tool_choice);
    const chunks = rounds[Math.min(i++, rounds.length - 1)] ?? [];
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }) as unknown as StreamingChatComplete;
  return { fn, choices, calls: () => i };
}

function mkSkill(name: string, skillKey: string): SkillTool {
  return {
    name,
    skillKey,
    billable: "ideas" as const,
    schema: { type: "function", function: { name, parameters: { type: "object", properties: {} } } },
    run: vi.fn(async (args) => ({ blocks: [{ type: "idea-card", props: { topic: args.topic } }], warnings: [] })),
  };
}

const HOOKS = () => mkSkill("generate_hooks", "hooks");
const IDEAS = () => mkSkill("generate_ideas", "ideas");

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
  billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
  ...over,
});

/** Round 1 writes the call instead of making it; round 2 dispatches for real. */
const WROTE_THE_CALL = [textChunk("Sure — for a comedy podcast:\n"), textChunk(`generate_ideas(topic="podcast")`)];
const REAL_DISPATCH = [toolName(0, "c1", "generate_hooks"), toolArgs(0, '{"topic":"podcast"}')];

describe("the prose-call pin", () => {
  it("takes ONE more round, pinned to the GUESS and not the name the model wrote", async () => {
    // 🔴 The load-bearing assertion. The prose said `generate_ideas`; the ask says hooks, so
    // `proseCallPin` is "hooks". In 3 of the 8 recorded fires the model named the wrong tool, so a
    // pin to its own name would produce the wrong artefact 38% of the time.
    const stream = mockStream([WROTE_THE_CALL, REAL_DISPATCH, [textChunk("Done.")]]);

    const res = await runChatAgentStream(
      baseInput({ proseCallPin: "hooks" }),
      DEPS(stream.fn, { skills: [HOOKS(), IDEAS()] }),
    );

    expect(stream.choices[0]).toBe("auto");
    expect(stream.choices[1]).toEqual({ type: "function", function: { name: "generate_hooks" } });
    expect(res.skillRuns.map((r) => r.name)).toEqual(["generate_hooks"]);
  });

  it("never shows the creator the malformed call", async () => {
    const onToken = vi.fn();
    const stream = mockStream([WROTE_THE_CALL, REAL_DISPATCH, [textChunk("Done.")]]);

    const res = await runChatAgentStream(
      baseInput({ onToken, proseCallPin: "hooks" }),
      DEPS(stream.fn, { skills: [HOOKS(), IDEAS()] }),
    );

    const streamed = onToken.mock.calls.map((c) => c[0]).join("");
    expect(streamed).not.toContain("generate_ideas");
    expect(streamed).toContain("Sure — for a comedy podcast:");
    // …and it is absent from what gets persisted, too — a malformed call in the transcript is
    // precedent for writing another one.
    expect(res.text).not.toContain("generate_ideas");
  });

  it("CONSUMES the pin — the round after it is back to auto", async () => {
    // A pin left standing would force the same tool every remaining round, which is exactly what
    // `forceSkill`'s "round 1 ONLY" rule exists to prevent.
    const stream = mockStream([WROTE_THE_CALL, REAL_DISPATCH, [textChunk("Done.")]]);

    await runChatAgentStream(baseInput({ proseCallPin: "hooks" }), DEPS(stream.fn, { skills: [HOOKS(), IDEAS()] }));

    expect(stream.choices[2]).toBe("auto");
  });

  it("fires at most ONCE per turn, so it cannot loop", async () => {
    // Every round writes a call and never dispatches. Without the latch this spins to maxRounds.
    const stream = mockStream([WROTE_THE_CALL]);

    const res = await runChatAgentStream(
      baseInput({ proseCallPin: "hooks" }),
      DEPS(stream.fn, { skills: [HOOKS(), IDEAS()] }),
    );

    expect(stream.calls()).toBe(2); // round 1, one pinned retry, then stop
    expect(res.skillRuns).toHaveLength(0);
    // The second round's call was released rather than eaten — the pin did not fire for it.
    expect(res.text).toContain("generate_ideas");
  });

  it("does NOT fire on a turn that dispatched normally", async () => {
    // The property that gives this trigger its precision: 0 of 8 fires on a dispatching run. Here
    // the model both writes a call in prose AND makes a real one.
    const onToken = vi.fn();
    const stream = mockStream([[...WROTE_THE_CALL, ...REAL_DISPATCH], [textChunk("Done.")]]);

    const res = await runChatAgentStream(
      baseInput({ onToken, proseCallPin: "hooks" }),
      DEPS(stream.fn, { skills: [HOOKS(), IDEAS()] }),
    );

    expect(stream.calls()).toBe(2);
    expect(stream.choices[1]).toBe("auto");
    expect(res.skillRuns.map((r) => r.name)).toEqual(["generate_hooks"]);
    // Nothing was withheld, so the written call survives verbatim — asserted on what the guard
    // RELEASED, which is the property this test is about. It deliberately does not read `res.text`:
    // this round also dispatched cards, so F-1 drops its pre-card text from the persisted answer,
    // and passing through that would make a guard test fail for a reason that has nothing to do
    // with the guard.
    expect(onToken.mock.calls.map((c) => c[0]).join("")).toContain("generate_ideas");
  });

  it("is byte-identical when the pin is absent", async () => {
    // The flag-off path. `proseCallPin` unset ⇒ no guard is constructed at all.
    const onToken = vi.fn();
    const stream = mockStream([WROTE_THE_CALL]);

    const res = await runChatAgentStream(baseInput({ onToken }), DEPS(stream.fn, { skills: [HOOKS(), IDEAS()] }));

    expect(stream.calls()).toBe(1);
    expect(res.text).toBe(`Sure — for a comedy podcast:\ngenerate_ideas(topic="podcast")`);
    expect(onToken.mock.calls.map((c) => c[0]).join("")).toBe(res.text);
  });

  it("stands down when the turn is already pinned by a chip", async () => {
    // `forceSkill` is the creator's own choice and owns round 1; this must never contend with it.
    const stream = mockStream([WROTE_THE_CALL, [textChunk("Done.")]]);

    await runChatAgentStream(
      baseInput({ forceSkill: "ideas", proseCallPin: "hooks" }),
      DEPS(stream.fn, { skills: [HOOKS(), IDEAS()] }),
    );

    expect(stream.choices[0]).toEqual({ type: "function", function: { name: "generate_ideas" } });
    expect(stream.calls()).toBe(1); // round 1 produced no call and the prose pin stood down
  });

  it("stands down when the guessed skill is not bound this turn", async () => {
    // An anonymous visitor binds no generators. Resolving to a name absent from `tools` would make
    // the API reject the request outright.
    const stream = mockStream([WROTE_THE_CALL]);

    await runChatAgentStream(baseInput({ proseCallPin: "hooks" }), DEPS(stream.fn, { skills: [IDEAS()] }));

    expect(stream.calls()).toBe(1);
  });
});
