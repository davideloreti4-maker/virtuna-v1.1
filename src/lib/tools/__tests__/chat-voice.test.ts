/**
 * chat-voice.test.ts — every prompt that writes text the creator reads in the chat thread ends
 * with the one voice rule (chat-voice.ts), and the closing-line prompts carry the cards' own words.
 *
 * The loop is real. Its one stand-in is `streamComplete`, the model call (I/O), so the test can
 * read the system message the loop actually sent.
 */

import { describe, expect, it, vi } from "vitest";
import {
  CHAT_VOICE_RULE,
  VIEWER_VOICE_RULE,
  withChatVoice,
  ideasClosingPrompt,
  hooksClosingPrompt,
  scriptClosingPrompt,
} from "@/lib/tools/chat-voice";
import { runChatAgentStream, type StreamChunk, type StreamingChatComplete } from "@/lib/tools/chat-agent-loop";
import type { SkillTool } from "@/lib/tools/skill-dispatch";

/**
 * The rule, word for word as written after the measured runs: it is the prompt.
 * No example sentence, on purpose: the first version carried one marked "never reuse its words",
 * and a real hooks closing line pasted its second sentence verbatim ("People see the number
 * first and stay to find out how."). Same lesson as WHY_RULE: an example is a template.
 */
const RULE = `HOW YOU WRITE (this overrides every earlier line about style, bold labels or naming mechanisms, for every word the creator reads):
- Plain, short sentences a creator would say out loud. Lead with the answer.
- No em dashes or en dashes as punctuation: use a period or a comma. Write a range with "to" ("3 to 5 times a week").
- The craft notes above use theory terms so you can think. Never write them: not "curiosity gap", "pattern interrupt", "prediction error", "open loop", "dopamine", "mechanism", "retention hack", "scroll-stopper", "value prop", "leverage". Say what the viewer sees or does instead.
- No openers or filler: not "Here's the real talk", "Great question", "Honestly", "The real answer", "The real answer though", "Here's the thing".
- No slang performance: not "your vibe", "spin up", "hits hardest".
- Refer to a hook or an idea by quoting its own words, with no number or position in front: never "Card 1", "Hook 2", "#3", "Number two", "the second one", "the third one" or "option 2".
- A prose answer is most often two to five sentences. Go longer only when they ask for steps or a plan. No bold headings in a short prose answer.
- Name Maven's own actions by what the creator taps: "Simulate", "Remix", "Script", "Hooks", "Ideas". Never an internal name like "SIM-1 Max" or "SIM-1".
- Your prose under cards that just landed: one or two sentences in one paragraph, no more. The offer of a next step is part of the last sentence, not a line of its own.
- The length lines are about your prose answers. A card you compose keeps the slots its recipe asks for, in the same plain words.
Shape: the answer first, then one reason told as what the viewer sees, hears or does.`;

const DASH = /[–—]/;

/** A viewer's rule, word for word (persona chat). Their own voice; a viewer never says "curiosity gap". */
const VIEWER_RULE = `HOW YOU TALK (you are a viewer, not a strategist: this overrides every earlier line about naming mechanisms, frameworks, structure or style):
- Talk like a person who just watched it, in first person and in your own words: what you saw or heard, how it felt, and what you did (kept watching, scrolled, saved it, sent it to someone).
- A viewer does not know creator or marketing terms. Never use them: not "curiosity gap", "pattern interrupt", "prediction error", "open loop", "mechanism", "dopamine", "retention", "engagement", "algorithm", "value prop", "CTA", "cognitive dissonance". Say what you saw and what you did instead.
- No em dashes or en dashes: use a period or a comma.
- No openers or filler: not "Great question", "Honestly", "Here's the thing", "The real answer", "The bottom line".
- Short, like a reply in a chat: a few sentences. No lists, no bold, no headings.
- Do not coach the creator or write their hooks for them. If they ask what would make you stay, say what you would want to see, as a viewer.`;

describe("the rule", () => {
  it("is word for word, and itself has no dash to copy", () => {
    expect(CHAT_VOICE_RULE).toBe(RULE);
    expect(CHAT_VOICE_RULE).not.toMatch(DASH);
  });

  it("withChatVoice appends it last, once", () => {
    const out = withChatVoice("SYSTEM");
    expect(out.startsWith("SYSTEM\n\n")).toBe(true);
    expect(out.endsWith(CHAT_VOICE_RULE)).toBe(true);
    expect(out.split(CHAT_VOICE_RULE)).toHaveLength(2);
  });
});

describe("the viewer's rule (persona chat)", () => {
  it("is word for word, and has no dash to copy", () => {
    expect(VIEWER_VOICE_RULE).toBe(VIEWER_RULE);
    expect(VIEWER_VOICE_RULE).not.toMatch(DASH);
  });
});

describe("the closing-line prompts", () => {
  const cases = [
    {
      name: "ideas",
      prompt: ideasClosingPrompt(4, [
        { title: "I fed myself for a week on twenty dollars", angle: "the receipt is the proof" },
        { title: "The one pot I never wash", angle: "laziness as a method" },
      ]),
      words: ['"I fed myself for a week on twenty dollars"', '"The one pot I never wash"'],
    },
    {
      name: "hooks",
      prompt: hooksClosingPrompt(5, ["This week of dinners cost me twenty dollars.", "My landlord asked what I was cooking."]),
      words: ['"This week of dinners cost me twenty dollars."', '"My landlord asked what I was cooking."'],
    },
    {
      name: "script",
      prompt: scriptClosingPrompt([
        { label: "Hook", content: "Twenty dollars. Seven dinners." },
        { label: "Setup", content: "Here is the list I took to the store." },
      ]),
      words: ['Hook: "Twenty dollars. Seven dinners."', 'Setup: "Here is the list I took to the store."'],
    },
  ];

  it.each(cases)("$name: carries the cards' own words, no numbers to read back, no dash, no internal names", ({ prompt, words }) => {
    for (const w of words) expect(prompt).toContain(w);
    expect(prompt).not.toMatch(/#\d|Card \d|Hook \d|Idea \d/);
    expect(prompt).not.toMatch(DASH);
    expect(prompt).toContain("one or two short sentences in ONE paragraph");
    // Maven's actions by what the creator taps, never the internal model name.
    expect(prompt).not.toContain("SIM-1");
  });
});

// ─── The agent loop ──────────────────────────────────────────────────────────

const CTX = { platform: "tiktok" as const, profileRow: null, audience: null };
const text = (s: string): StreamChunk => ({ choices: [{ delta: { content: s } }] });

function capture(rounds: StreamChunk[][]) {
  const seen: Array<Array<{ role: string; content: unknown }>> = [];
  let i = 0;
  const streamComplete = vi.fn(async (params: Record<string, unknown>) => {
    seen.push(params.messages as Array<{ role: string; content: unknown }>);
    const chunks = rounds[Math.min(i++, rounds.length - 1)] ?? [];
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }) as unknown as StreamingChatComplete;
  return { streamComplete, seen };
}

const hooksSkill: SkillTool = {
  name: "generate_hooks",
  skillKey: "hooks",
  billable: "hooks" as const,
  schema: { type: "function", function: { name: "generate_hooks", parameters: { type: "object", properties: {} } } },
  run: vi.fn(async () => ({ blocks: [{ type: "hook-card", props: { hookLine: "Twenty dollars. Seven dinners." } }], warnings: [] })),
};

async function systemFor(skills: SkillTool[], rounds: StreamChunk[][] = [[text("Post at 7 pm.")]]) {
  const { streamComplete, seen } = capture(rounds);
  await runChatAgentStream(
    { ask: "when should I post?", context: CTX, systemPrompt: "CALLER SYSTEM", onToken: vi.fn(), onBlock: vi.fn() },
    {
      streamComplete,
      model: "test-model",
      seed: 1,
      skills,
      billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
    },
  );
  return { system: seen[0]!.find((m) => m.role === "system")!.content as string, seen };
}

describe("the chat agent's system message", () => {
  it("signed in (generators bound): the caller's prompt first, the rule last, once", async () => {
    const { system } = await systemFor([hooksSkill]);
    expect(system.startsWith("CALLER SYSTEM\n\n")).toBe(true);
    expect(system.endsWith(CHAT_VOICE_RULE)).toBe(true);
    expect(system.split(CHAT_VOICE_RULE)).toHaveLength(2);
  });

  it("an anonymous visitor (nothing bound): the rule last too, and no ask to name the mechanism", async () => {
    const { system } = await systemFor([]);
    expect(system.endsWith(CHAT_VOICE_RULE)).toBe(true);
    expect(system).not.toContain("name the mechanism");
  });

  it.each([
    { name: "signed in", skills: [hooksSkill] },
    { name: "anonymous (the artefact guard is on)", skills: [] as SkillTool[] },
  ])("$name: no dash reaches the creator, split mid-dash, and what is stored is what streamed", async ({ skills }) => {
    const answer = ["Post three to five times a week ", "—", " not daily. Aim for 45", "–90 seconds ", "— it keeps them."];
    const onToken = vi.fn();
    const { streamComplete, seen } = capture([answer.map(text), [text("unused")]]);
    const res = await runChatAgentStream(
      { ask: "how often?", context: CTX, systemPrompt: "S", onToken, onBlock: vi.fn() },
      {
        streamComplete,
        model: "test-model",
        seed: 1,
        skills,
        billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
      },
    );
    const streamed = onToken.mock.calls.map((c) => c[0]).join("");
    expect(streamed).toBe("Post three to five times a week. Not daily. Aim for 45 to 90 seconds. It keeps them.");
    expect(res.text).toBe(streamed);
    expect(seen).toHaveLength(1);
  });

  it("bound path with the artefact guard on (a sealed visitor), across a round boundary: stream == stored, no dash", async () => {
    const unknownCall: StreamChunk = {
      choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "generate_nothing", arguments: "{}" } }] } }],
    };
    const onToken = vi.fn();
    const { streamComplete } = capture([
      [text("Let me check "), text("—"), text(" one sec. "), unknownCall],
      [text('Here is the plan — "Twenty dollars" first'), text(" — then the rest.")],
    ]);
    const res = await runChatAgentStream(
      { ask: "plan?", context: CTX, systemPrompt: "S", onToken, onBlock: vi.fn() },
      {
        streamComplete,
        model: "test-model",
        seed: 1,
        skills: [hooksSkill],
        sealedVisitor: true,
        billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
      },
    );
    const streamed = onToken.mock.calls.map((c) => c[0]).join("");
    expect(streamed).toBe('Let me check. One sec. Here is the plan, "Twenty dollars" first, then the rest.');
    expect(res.text).toBe(streamed);
  });

  it("a round that throws mid-stream still releases what the dash guard held", async () => {
    const onToken = vi.fn();
    const streamComplete = vi.fn(async () =>
      (async function* () {
        yield text("Hold on — one");
        throw new Error("stream dropped");
      })(),
    ) as unknown as StreamingChatComplete;
    await expect(
      runChatAgentStream(
        { ask: "x", context: CTX, systemPrompt: "S", onToken, onBlock: vi.fn() },
        {
          streamComplete,
          model: "test-model",
          seed: 1,
          skills: [hooksSkill],
          billing: { gate: vi.fn(async () => ({ allowed: true, tier: "pro" as const })), bill: vi.fn(async () => {}) },
        },
      ),
    ).rejects.toThrow("stream dropped");
    expect(onToken.mock.calls.map((c) => c[0]).join("")).toBe("Hold on. One");
  });

  it("a later round's history carries the plain text, not the model's dashes", async () => {
    const call: StreamChunk = {
      choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "generate_hooks", arguments: '{"topic":"x"}' } }] } }],
    };
    const { seen } = await systemFor([hooksSkill], [[text("On it — one sec."), call], [text("Done.")]]);
    const assistant = seen[1]!.find((m) => m.role === "assistant")!;
    expect(assistant.content).toBe("On it. One sec.");
  });

  it("after a skill runs, the note asks for the cards by their own words, with no dash to copy", async () => {
    const call: StreamChunk = {
      choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "generate_hooks", arguments: '{"topic":"cheap dinners"}' } }] } }],
    };
    const { seen } = await systemFor([hooksSkill], [[call], [text("Open with the twenty dollars one.")]]);
    const tool = seen[1]!.find((m) => m.role === "tool")!;
    const note = (JSON.parse(tool.content as string) as { note: string }).note;
    expect(note).toContain("by their own words");
    expect(note).toContain("never by number");
    expect(note).not.toMatch(DASH);
  });
});
