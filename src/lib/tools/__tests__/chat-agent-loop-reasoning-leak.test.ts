/**
 * chat-agent-loop-reasoning-leak.test.ts — the model's planning voice must never be the answer.
 *
 * ─── THE DEFECT ──────────────────────────────────────────────────────────────────────────────
 *
 * `enable_thinking: composing` (1050d7a9) turned reasoning on for composed-card turns. Its comment
 * claims reasoning "arrives as `delta.reasoning_content`, which this loop never reads". Three
 * production rows say otherwise — thread b13d63f4, 2026-08-12, one ask asked four times:
 *
 *     249848cb   33,165 chars   pure monologue, no answer at all, no tag (hit the token ceiling)
 *     291591a8   20,742 chars   monologue + a literal `</think>` + the real closing line
 *     ae09c4df   18,484 chars   monologue + the emit_card JSON in a fence + a closing question
 *
 * The loop only ever accumulates `delta.content` (`:1178`), so that text came through the CONTENT
 * channel. The orphaned `</think>` is the proof: a closing tag with no opening one, persisted as
 * the creator's answer.
 *
 * This is not novel provider behaviour — `src/lib/engine/utils/strip.ts` exists because Qwen
 * thinking-mode emits `<think>…</think>` inside `content`, and every JSON call site strips it. The
 * one path that streams to a HUMAN never did.
 *
 * ⚠️ MEASURED 2026-08-16: 0 of 21 live runs reproduced it (scripts/probe-thinking-content-channel.ts)
 * — bare, tools bound, the shipped 25,268-char prompt, and the prompt with thread history. Neither
 * tools nor prompt size nor thread depth is the variable. The trigger is provider-side and rare
 * (3 of 4 asks one day, 0 of 6 the next), which is why the remedy is a boundary guard and these
 * tests drive the real loop with the exact round shapes those rows recorded.
 *
 * ⚠️ TWO of the three rows delivered NO cards, so `cardsDelivered` is false and `:1648` persists
 * `fullText` with no budget at all. #514 (F-1) governs only the card-bearing branch and does not
 * touch them.
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

function mockStream(rounds: StreamChunk[][]): StreamingChatComplete {
  let i = 0;
  return vi.fn(async () => {
    const chunks = rounds[Math.min(i++, rounds.length - 1)] ?? [];
    return (async function* () {
      for (const c of chunks) yield c;
    })();
  }) as unknown as StreamingChatComplete;
}

const baseInput = (over: Partial<ChatAgentStreamInput> = {}): ChatAgentStreamInput => ({
  ask: "explain the structure of a story-time video, start to finish",
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

const mkSkill = (name: string): SkillTool => ({
  name,
  skillKey: name.replace(/^generate_/, ""),
  billable: "ideas" as const,
  schema: { type: "function", function: { name, parameters: { type: "object", properties: {} } } },
  run: vi.fn(async () => ({ blocks: [{ type: "idea-card", props: {} }], warnings: [] })),
});

/** The real opening of all three rows, verbatim. */
const MONOLOGUE_HEAD =
  "The user wants an explanation of the structure of a story-time video, start to finish.\n" +
  "This is a request for information/education on a specific content format.\n" +
  "I need to break down the anatomy of a successful TikTok story-time video.\n\n";

/** The degeneration the rows end in — this is what runs the token budget out. */
const DEGENERATION = 'One last check on the "Thread state" note.\nOkay.\n\n'.repeat(120);

describe("reasoning must not become the creator's answer", () => {
  it("drops an orphaned </think> block and keeps only the real answer (row 291591a8)", async () => {
    // The exact observed shape: monologue, a closing tag with NO opening tag, then the answer.
    const leaked = MONOLOGUE_HEAD + DEGENERATION + "\n\n</think>\n\n";
    const answer = "Do any of your current story ideas fit this arc?";
    const stream = mockStream([[textChunk(leaked), textChunk(answer)]]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.text).toBe(answer);
    expect(res.text).not.toContain("</think>");
    expect(res.text).not.toContain("The user wants");
  });

  it("drops a well-formed <think>…</think> block wherever it sits", async () => {
    const stream = mockStream([
      [textChunk("<think>" + MONOLOGUE_HEAD + "</think>"), textChunk("Open on the mundane, then escalate.")],
    ]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.text).toBe("Open on the mundane, then escalate.");
  });

  it("persists nothing when a no-card turn is pure monologue that never closed (row 249848cb)", async () => {
    // 33,165 chars, no tag at all, no answer — the model burned the budget deliberating.
    const stream = mockStream([[textChunk(MONOLOGUE_HEAD + DEGENERATION.repeat(6))]]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(res.text.length).toBeLessThan(1000);
    expect(res.text).not.toContain("The user wants");
  });

  it("caps the same monologue on the UNBOUND exit — the anonymous visitor's door (row 249848cb)", async () => {
    // 🔴 `:1671` returns `guard.flush()` when `unbound`, short-circuiting `answer` entirely, so the
    // cap the test above proves never applied to this exit. It is not a dead branch: `FREE_SKILL_TOOLS`
    // is EMPTY (every generator is billable), so every sealed `/go` visitor binds no generator and
    // takes it — and `composedCards` is `process.env.COMPOSED_CARDS !== "false"`, a global default-ON
    // read with no visitor check, so `enable_thinking` is on for them exactly as it is for a signed-in
    // turn. `textCap` is `Infinity` there too, since only a skill run that produced blocks lowers it
    // and an unbound session runs no skills.
    //
    // The tagless shape is what makes this bite: `stripLeakedReasoning` returns a monologue with no
    // tag BYTE-IDENTICAL by design, so the strip alone is not a ceiling. Measured before the fix —
    // 36,236 chars in, 36,236 out, against 0 out for the identical stream on the bound path.
    const stream = mockStream([[textChunk(MONOLOGUE_HEAD + DEGENERATION.repeat(6))]]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [] }));

    expect(res.text.length).toBeLessThan(1000);
    expect(res.text).not.toContain("The user wants");
  });

  it("🔴 does NOT cap a real answer on the unbound exit either — same threshold, same population", async () => {
    // The control for the test above. A visitor turn is all prose and has no card pack, so it is the
    // SAME population `RUNAWAY_PROSE_CAP` was measured against; the ceiling must sit above the real
    // answers there for the same reason it does on the bound branch.
    const realAnswer = "Open on the mundane, then escalate. ".repeat(110);
    const stream = mockStream([[textChunk(realAnswer)]]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [] }));

    expect(realAnswer.length).toBeGreaterThan(3_500);
    expect(res.text).toBe(realAnswer);
  });

  it("🔴 does NOT touch a long search-and-answer turn — its prose IS the answer", async () => {
    // 25 of 34 over-cap no-card turns are these. The largest real answer measured in the whole
    // production table is 3,791 chars; the smallest leak is 18,484. Nothing lives in between, and
    // capping this shape is the one thing the lane brief forbids outright.
    const realAnswer =
      "Confession wins. By a lot. Here's why it beats observational for your account.\n\n" +
      "The escalation section should carry the weight of the video. ".repeat(70);
    const stream = mockStream([[textChunk(realAnswer)]]);

    const res = await runChatAgentStream(baseInput(), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(realAnswer.length).toBeGreaterThan(3_500);
    expect(res.text).toBe(realAnswer);
  });

  it("leaves the STREAM untouched — the guard is at assembly, nothing is buffered", async () => {
    // The owner's ruling: fix persistence, do not withhold tokens. `onToken` must still see every
    // token in order, exactly as it does today, or this became the buffering change it is not.
    const onToken = vi.fn();
    const leaked = MONOLOGUE_HEAD + "</think>\n\n";
    const stream = mockStream([[textChunk(leaked), textChunk("Short answer.")]]);

    const res = await runChatAgentStream(baseInput({ onToken }), DEPS(stream, { skills: [mkSkill("generate_ideas")] }));

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, leaked);
    expect(onToken).toHaveBeenNthCalledWith(2, "Short answer.");
    expect(res.text).toBe("Short answer.");
  });
});
