/**
 * chat-prior-turns.test.ts — the open-chat context anchor.
 *
 * REGRESSION SUITE for the thread that poisoned its own later turns. Once a thread contained the
 * assistant line "Five hooks are on screen.", a later generation ask in that same thread made the
 * model reproduce the sentence and call nothing — zero cards under a UI insisting five existed
 * (confirmed live 2026-08-04, and 0/3 on a replay of the real thread). The cards were filtered out of
 * the anchor, so the sentence was the only precedent the model had and it read as a template.
 *
 * These lock the half that makes the transcript truthful: a turn that ran skills is handed back WITH
 * them. `chat-agent-loop.test.ts` locks the other half — that the loop replays them as tool calls.
 */

import { describe, it, expect } from "vitest";
import { openChatPriorTurns, MAX_PRIOR_TURNS } from "@/lib/threads/chat-prior-turns";
import type { HydratedMessage } from "@/lib/threads/messages";

let seq = 0;
function msg(role: HydratedMessage["role"], blocks: Array<{ type: string; props: unknown }>): HydratedMessage {
  seq++;
  return {
    id: `m${seq}`,
    thread_id: "t1",
    role,
    created_at: new Date(seq * 1000).toISOString(),
    blocks: blocks as HydratedMessage["blocks"],
  };
}
const text = (t: string, origin?: string) => ({
  type: "markdown",
  props: origin ? { text: t, origin } : { text: t },
});
const cards = (type: string, n: number) => Array.from({ length: n }, (_, i) => ({ type, props: { i } }));

describe("openChatPriorTurns", () => {
  it("plain chat is unchanged — role + text, no runs attached", () => {
    const turns = openChatPriorTurns([
      msg("user", [text("why do my videos flop?")]),
      msg("assistant", [text("because the first beat has no stakes")]),
    ]);
    expect(turns).toEqual([
      { role: "user", text: "why do my videos flop?" },
      { role: "assistant", text: "because the first beat has no stakes" },
    ]);
  });

  it("THE FIX: a dispatching turn carries the run that produced its cards", () => {
    // The exact live shape: cards in their own assistant row, then the closing line stamped
    // origin:"chat-agent" in the next.
    const turns = openChatPriorTurns([
      msg("user", [text("i launched a budgeting app for students. give me hooks for it")]),
      msg("assistant", cards("hook-card", 5)),
      msg("assistant", [text("Five hooks are on screen.", "chat-agent")]),
    ]);
    expect(turns).toHaveLength(2); // the card row is not a turn of its own
    expect(turns.at(-1)).toEqual({
      role: "assistant",
      text: "Five hooks are on screen.",
      toolRuns: [
        {
          name: "generate_hooks",
          cards: 5,
          topic: "i launched a budgeting app for students. give me hooks for it",
        },
      ],
    });
  });

  it("counts each card and maps every generator to its own tool name", () => {
    const ideas = openChatPriorTurns([
      msg("user", [text("ideas for my app")]),
      msg("assistant", cards("idea-card", 3)),
      msg("assistant", [text("Three ideas are on screen.", "chat-agent")]),
    ]);
    expect(ideas.at(-1)!.toolRuns).toEqual([{ name: "generate_ideas", cards: 3, topic: "ideas for my app" }]);

    const script = openChatPriorTurns([
      msg("user", [text("script the second one")]),
      msg("assistant", cards("script-card", 1)),
      msg("assistant", [text("Script is on screen.", "chat-agent")]),
    ]);
    expect(script.at(-1)!.toolRuns).toEqual([
      { name: "write_script", cards: 1, topic: "script the second one" },
    ]);
  });

  it("keeps two runs in one turn separate and in run order (the per-turn leash allows two)", () => {
    const turns = openChatPriorTurns([
      msg("user", [text("ideas and then hooks")]),
      msg("assistant", cards("idea-card", 3)),
      msg("assistant", cards("hook-card", 5)),
      msg("assistant", [text("Ideas and hooks are on screen.", "chat-agent")]),
    ]);
    expect(turns.at(-1)!.toolRuns).toEqual([
      { name: "generate_ideas", cards: 3, topic: "ideas and then hooks" },
      { name: "generate_hooks", cards: 5, topic: "ideas and then hooks" },
    ]);
  });

  it("a run-header alongside the cards does not become a run of its own", () => {
    const turns = openChatPriorTurns([
      msg("user", [text("hooks please")]),
      msg("assistant", [{ type: "run-header", props: {} }, ...cards("hook-card", 5)]),
      msg("assistant", [text("Five hooks are on screen.", "chat-agent")]),
    ]);
    expect(turns.at(-1)!.toolRuns).toEqual([{ name: "generate_hooks", cards: 5, topic: "hooks please" }]);
  });

  it("an input-request turn is NOT a skill run — origin:'chat-agent' alone never fabricates one", () => {
    // This turn is stamped chat-agent (it produced a UI block) but nothing generative ran. Replaying
    // it as a tool call would teach the model that asking for a link produces cards.
    const turns = openChatPriorTurns([
      msg("user", [text("can you remix this video for me")]),
      msg("assistant", [{ type: "input-request", props: { kind: "link", action: "remix" } }]),
      msg("assistant", [text("Paste the link to the video you want to remix.", "chat-agent")]),
    ]);
    expect(turns.at(-1)).toEqual({ role: "assistant", text: "Paste the link to the video you want to remix." });
  });

  it("a corpus citation is not a skill run either", () => {
    const turns = openChatPriorTurns([
      msg("user", [text("what actually works here?")]),
      msg("assistant", [{ type: "corpus-references", props: { query: "x", warrant: "topical", sources: [] } }]),
      msg("assistant", [text("Three proven examples say the stakes come first.", "chat-agent")]),
    ]);
    expect(turns.at(-1)!.toolRuns).toBeUndefined();
  });

  it("cards never leak forward onto a LATER turn", () => {
    // Attribution is 'the cards just before this text', so a subsequent pure-chat turn must come
    // back clean — otherwise every turn after a hooks run would claim to have run hooks.
    const turns = openChatPriorTurns([
      msg("user", [text("hooks please")]),
      msg("assistant", cards("hook-card", 5)),
      msg("assistant", [text("Five hooks are on screen.", "chat-agent")]),
      msg("user", [text("which is strongest?")]),
      msg("assistant", [text("the second — it names a number")]),
    ]);
    expect(turns.filter((t) => t.toolRuns)).toHaveLength(1);
    expect(turns.at(-1)).toEqual({ role: "assistant", text: "the second — it names a number" });
  });

  // ── The card LINES: the model has to be able to talk about its own output ────────────────────
  //
  // REGRESSION (live 2026-08-04). The replay carried a COUNT and nothing else, which proved a tool
  // ran but left the model blind to what it made. Asked the shipped chip "Which of these hooks is
  // strongest for my audience, and why?" it answered "I don't have the specific hook lines you're
  // referring to in front of me. Paste the 2–3 options you're debating" — about cards the app had
  // just rendered.
  const titled = (type: string, key: string, values: string[]) =>
    values.map((v) => ({ type, props: { [key]: v } }));

  it("carries each card's identifying line, in order", () => {
    const turns = openChatPriorTurns([
      msg("user", [text("hooks for my budgeting app")]),
      msg("assistant", titled("hook-card", "hookLine", ["Everyone lied about 5am", "Your £4 coffee is a £1,400 habit"])),
      msg("assistant", [text("Two hooks are on screen.", "chat-agent")]),
    ]);
    expect(turns.at(-1)!.toolRuns).toEqual([
      {
        name: "generate_hooks",
        cards: 2,
        topic: "hooks for my budgeting app",
        lines: ["Everyone lied about 5am", "Your £4 coffee is a £1,400 habit"],
      },
    ]);
  });

  it("reads the right prop per card type — hookLine for hooks, title for ideas and scripts", () => {
    const ideas = openChatPriorTurns([
      msg("user", [text("ideas")]),
      msg("assistant", titled("idea-card", "title", ["The 5am myth"])),
      msg("assistant", [text("One idea is on screen.", "chat-agent")]),
    ]);
    expect(ideas.at(-1)!.toolRuns![0]!.lines).toEqual(["The 5am myth"]);

    const script = openChatPriorTurns([
      msg("user", [text("script it")]),
      msg("assistant", titled("script-card", "title", ["The 5am myth — script"])),
      msg("assistant", [text("Script is on screen.", "chat-agent")]),
    ]);
    expect(script.at(-1)!.toolRuns![0]!.lines).toEqual(["The 5am myth — script"]);
  });

  it("OMITS lines entirely when none are extractable — never an empty list", () => {
    // A pre-existing thread, or a card shape whose prop differs, must degrade to exactly the tool
    // result this replay always produced. An empty `cards_on_screen` would tell the model the pack
    // has no contents, which is worse than telling it nothing.
    const turns = openChatPriorTurns([
      msg("user", [text("hooks")]),
      msg("assistant", cards("hook-card", 3)), // props `{i}` — no hookLine
      msg("assistant", [text("Three hooks are on screen.", "chat-agent")]),
    ]);
    expect(turns.at(-1)!.toolRuns).toEqual([{ name: "generate_hooks", cards: 3, topic: "hooks" }]);
    expect(turns.at(-1)!.toolRuns![0]).not.toHaveProperty("lines");
  });

  it("caps the line COUNT and each line's LENGTH — a reference, not the whole pack", () => {
    // Every later turn in the thread pays for these tokens, and the cards are on screen anyway.
    const turns = openChatPriorTurns([
      msg("user", [text("lots of hooks")]),
      msg("assistant", titled("hook-card", "hookLine", Array.from({ length: 12 }, (_, i) => `hook ${i} ${"x".repeat(400)}`))),
      msg("assistant", [text("Twelve hooks are on screen.", "chat-agent")]),
    ]);
    const run = turns.at(-1)!.toolRuns![0]!;
    expect(run.cards).toBe(12); // the COUNT is still honest…
    expect(run.lines).toHaveLength(6); // …while the quoted lines are bounded
    for (const l of run.lines!) expect(l.length).toBeLessThanOrEqual(200);
  });

  it("drops a blank or non-string line without leaving a placeholder", () => {
    // "undefined" quoted back at the model reads as a card whose text is literally that.
    const turns = openChatPriorTurns([
      msg("user", [text("hooks")]),
      msg("assistant", [
        { type: "hook-card", props: { hookLine: "a real line" } },
        { type: "hook-card", props: { hookLine: "   " } },
        { type: "hook-card", props: { hookLine: 42 } },
      ]),
      msg("assistant", [text("Three hooks are on screen.", "chat-agent")]),
    ]);
    const run = turns.at(-1)!.toolRuns![0]!;
    expect(run.cards).toBe(3);
    expect(run.lines).toEqual(["a real line"]);
  });

  it("caps at MAX_PRIOR_TURNS, keeping the newest", () => {
    const many = Array.from({ length: MAX_PRIOR_TURNS + 6 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", [text(`turn ${i}`)]),
    );
    const turns = openChatPriorTurns(many);
    expect(turns).toHaveLength(MAX_PRIOR_TURNS);
    expect(turns.at(-1)!.text).toBe(`turn ${MAX_PRIOR_TURNS + 5}`);
  });
});

/**
 * THE CONTEXT RECORDS — the second half of the 2026-08-04 defect, and until 2026-08-11 the
 * completely untested half.
 *
 * Every non-generator skill (a Test, a Read, an Explore, a Remix, an account read) persists its
 * card into the SAME open thread, and none of them is `markdown` or a generator card. They were
 * skipped entirely: 107 of 982 persisted blocks (11%) invisible, and precisely the blocks holding
 * the creator's actual work. Run a Test, ask "so what should I fix first?", and the co-pilot has
 * never heard of it.
 *
 * `SKILL_BLOCK_RECORD` fixed that and then shipped for a week with NO test asserting a record line
 * is produced at all — found by mutation (replacing the describer call with a constant failed
 * nothing). The same describers now also feed the LIVE tool result, so a silent regression here
 * would blind both seams at once.
 */
describe("openChatPriorTurns — non-generator skill results ride as context records", () => {
  it("a Video Test the creator ran from the pill becomes a record line", () => {
    // A pill run persists ONLY its card — no text row follows — so the record IS the whole turn.
    const turns = openChatPriorTurns([
      msg("assistant", [
        { type: "video-test-card", props: { craftScore: 61, dropLabel: "0:04" } },
      ]),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.skillRecords?.[0]).toContain("Video Test — craft 61/100");
    expect(turns[0]!.skillRecords?.[0]).toContain("weak beat at 0:04");
  });

  it("an audience Read records the band and the lever, not just that it happened", () => {
    const turns = openChatPriorTurns([
      msg("assistant", [
        {
          type: "multi-audience-read",
          props: {
            audiences: [
              { name: "Gen Z students", band: "Most keep watching", fraction: "6 in 10", lever: "cut the setup" },
            ],
          },
        },
      ]),
      msg("user", [text("so what should i fix first?")]),
    ]);
    // Records belong BEFORE the turn that follows them — they describe work already on screen.
    expect(turns[0]!.skillRecords?.[0]).toBe(
      "Audience Read — Gen Z students: Most keep watching (6 in 10) — lever: cut the setup",
    );
    expect(turns[1]).toMatchObject({ role: "user", text: "so what should i fix first?" });
  });

  it("a record block whose props are malformed is SKIPPED, never emitted as a placeholder", () => {
    // A thread predating a field must not take the anchor down, and must not tell the model a
    // Test exists whose score is literally "undefined".
    const turns = openChatPriorTurns([
      msg("assistant", [{ type: "multi-audience-read", props: { audiences: [] } }]),
      msg("assistant", [text("anything")]),
    ]);
    expect(turns.every((t) => (t.skillRecords ?? []).length === 0)).toBe(true);
  });

  it("a record block is NOT replayed as a tool run — the agent never called it", () => {
    // Naming it as a tool would advertise a door that does not exist.
    const turns = openChatPriorTurns([
      msg("assistant", [{ type: "video-test-card", props: { craftScore: 61 } }]),
    ]);
    expect(turns[0]!.toolRuns).toBeUndefined();
  });
});
