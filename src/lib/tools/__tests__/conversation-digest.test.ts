/**
 * conversation-digest.test.ts — the digest the generators finally get.
 *
 * The assertions that matter most here are the EXCLUSIONS, because each one is a defect this
 * project has already paid for once:
 *
 *   · assistant prose never enters the digest — chat-prior-turns.ts documents the model learning
 *     to reproduce its own "Five hooks are on screen." instead of calling a tool;
 *   · card LINES never enter the digest either — carrying them under a "do not reproduce these"
 *     instruction made the model reproduce them, one verbatim (measured, 2026-08-10);
 *   · a record-only turn (a skill run from the pill persists no text row) is not a creator turn.
 */

import { describe, it, expect } from "vitest";
import {
  buildConversationDigest,
  isConversationDigestEnabled,
  MAX_DIGEST_TURNS,
} from "../conversation-digest";
import {
  CONVERSATION_CHAR_BUDGET,
  CONVERSATION_BLOCK_OVERHEAD,
  assembleBundle,
} from "@/lib/kc/assembler";
import type { ChatAgentPriorTurn } from "../chat-agent-loop";

const user = (text: string): ChatAgentPriorTurn => ({ role: "user", text });
const assistant = (text: string): ChatAgentPriorTurn => ({ role: "assistant", text });
const ranHooks = (text: string, lines: string[]): ChatAgentPriorTurn => ({
  role: "assistant",
  text,
  toolRuns: [{ name: "generate_hooks", cards: lines.length, topic: "morning focus", lines }],
});

describe("buildConversationDigest — what gets in", () => {
  it("carries the creator's turns, oldest first", () => {
    const digest = buildConversationDigest([
      user("i make comedy story-times, handheld, no b-roll"),
      assistant("Got it — what's the subject?"),
      user("keep it under 30s, i lose people after that"),
    ]);
    expect(digest?.turns).toEqual([
      "i make comedy story-times, handheld, no b-roll",
      "keep it under 30s, i lose people after that",
    ]);
  });

  it("NEVER carries assistant prose — the precedent defect", () => {
    const digest = buildConversationDigest([
      user("give me hooks about morning focus"),
      assistant("Here are 5 hooks for 'morning focus' tailored to your comedy storytelling niche…"),
    ]);
    expect(digest?.turns).toEqual(["give me hooks about morning focus"]);
    expect(JSON.stringify(digest)).not.toContain("Here are 5 hooks");
  });

  it("keeps the NEWEST turns when there are more than the cap", () => {
    const turns = Array.from({ length: MAX_DIGEST_TURNS + 4 }, (_, i) => user(`turn ${i}`));
    const digest = buildConversationDigest(turns);
    expect(digest?.turns).toHaveLength(MAX_DIGEST_TURNS);
    // Newest kept, and still emitted oldest-first.
    expect(digest?.turns?.[digest.turns.length - 1]).toBe(`turn ${MAX_DIGEST_TURNS + 3}`);
    expect(digest?.turns?.[0]).toBe(`turn ${4}`);
  });

  it("stays inside the character budget", () => {
    const fat = Array.from({ length: MAX_DIGEST_TURNS }, () => user("z".repeat(400)));
    const digest = buildConversationDigest(fat);
    const total = (digest?.turns ?? []).join("").length;
    expect(total).toBeLessThanOrEqual(CONVERSATION_CHAR_BUDGET);
  });

  it("flattens a pasted multi-line turn into ONE line", () => {
    const digest = buildConversationDigest([user("line one\n\nline two\n   line three")]);
    expect(digest?.turns).toEqual(["line one line two line three"]);
  });

  it("skips a record-only turn (a pill skill run persists no text row)", () => {
    const digest = buildConversationDigest([
      { role: "assistant", text: "", skillRecords: ["Video Test — craft 61/100"] },
      user("so what should i fix first?"),
    ]);
    expect(digest?.turns).toEqual(["so what should i fix first?"]);
  });

  it("returns null when there is nothing worth sending", () => {
    expect(buildConversationDigest([])).toBeNull();
    expect(buildConversationDigest([assistant("hello")])).toBeNull();
  });
});

describe("buildConversationDigest — card lines NEVER enter the digest", () => {
  const thread = [
    user("hooks about morning focus"),
    ranHooks("Five hooks are on screen.", ["hook A", "hook B"]),
    user("now some about evenings"),
    ranHooks("Done.", ["hook C", "hook D"]),
  ];

  /**
   * The digest carried these until 2026-08-10, under "do NOT reproduce, rephrase or re-deliver
   * these". Measured through the real hooks pipeline it did the opposite — 3/10 hooks overlapped
   * the list, one of them word for word — while its unbudgeted size evicted the corpus. See
   * conversation-digest.ts's header for the three arms.
   *
   * These assert the ABSENCE, by value and by serialisation, because a re-added field would
   * otherwise fail silently: the digest would still typecheck and still look right.
   */
  it("does not carry the last run's card lines", () => {
    const digest = buildConversationDigest(thread);
    expect(digest).toEqual({ turns: ["hooks about morning focus", "now some about evenings"] });
  });

  it("emits ONLY a `turns` key — a future sub-block must be budgeted deliberately", () => {
    // CONVERSATION_CHAR_BUDGET bounds `turns`. It silently bounded only HALF the block while
    // cardsOnScreen existed, which is how 700 became 1,844 on the wire. Any new key here must
    // come with a re-measured worst case.
    expect(Object.keys(buildConversationDigest(thread) ?? {})).toEqual(["turns"]);
  });

  it("returns null for a thread whose only content is card lines", () => {
    // Previously this returned a cards-only digest. With turns as the whole digest, a thread the
    // creator has not typed into carries nothing, and null is the byte-identical no-op.
    expect(buildConversationDigest([ranHooks("Five hooks are on screen.", ["hook A"])])).toBeNull();
  });
});

describe("the creator's CURRENT turn — the one that is not in priorTurns", () => {
  /**
   * `/api/tools/chat` loads prior turns at step (6) and persists the message being answered at
   * step (7). Built from `priorTurns` alone the digest was therefore always one turn behind: the
   * constraint a creator states while asking ("…but keep them under 30s") reached the generator
   * only if the chat agent chose to fold it into `topic`, and a thread's first generating turn
   * produced no digest at all. Handoff §14.2, fixed 2026-08-11.
   */
  const thread: ChatAgentPriorTurn[] = [
    user("i make comedy story-times, handheld, no b-roll"),
    assistant("Got it — what's the subject?"),
    user("morning focus, for founders"),
  ];

  it("carries it as the NEWEST line", () => {
    const digest = buildConversationDigest(thread, "give me hooks, but keep them under 30s");
    expect(digest?.turns).toEqual([
      "i make comedy story-times, handheld, no b-roll",
      "morning focus, for founders",
      "give me hooks, but keep them under 30s",
    ]);
  });

  it("makes a thread's FIRST generating turn carry something — it used to be a total no-op", () => {
    expect(buildConversationDigest([])).toBeNull();
    expect(buildConversationDigest([], "hooks for my app, none of them questions")).toEqual({
      turns: ["hooks for my app, none of them questions"],
    });
  });

  it("is bought FIRST from the budget, so a long thread can never evict it", () => {
    // Budget is spent newest-first; the current turn is the newest. Every older turn here is
    // budget-max, so all of them but one are evicted — and the survivor must be this one.
    const fat = Array.from({ length: MAX_DIGEST_TURNS }, (_, i) => user(`old ${i} `.padEnd(400, "z")));
    const digest = buildConversationDigest(fat, "under 30s, not the 5am angle");
    expect(digest?.turns?.at(-1)).toBe("under 30s, not the 5am angle");
  });

  it("counts against MAX_DIGEST_TURNS — it is a turn, not an extra slot", () => {
    const turns = Array.from({ length: MAX_DIGEST_TURNS + 4 }, (_, i) => user(`turn ${i}`));
    const digest = buildConversationDigest(turns, "and now this");
    expect(digest?.turns).toHaveLength(MAX_DIGEST_TURNS);
    expect(digest?.turns?.at(-1)).toBe("and now this");
  });

  it("is normalised and clipped like any other turn", () => {
    const digest = buildConversationDigest([], "line one\n\n  line two");
    expect(digest?.turns).toEqual(["line one line two"]);
  });

  it("an absent or blank ask changes nothing", () => {
    const base = buildConversationDigest(thread);
    expect(buildConversationDigest(thread, undefined)).toEqual(base);
    expect(buildConversationDigest(thread, "   \n ")).toEqual(base);
    expect(buildConversationDigest([], "   ")).toBeNull();
  });

  it("is not doubled if the caller ALREADY put it in priorTurns", () => {
    // Order-independence against the route: today (6) loads before (7) persists, so this cannot
    // happen — but it is one line's difference from happening, and the cost would be paid at the
    // newest, most valuable end of the budget.
    const withIt = [...thread, user("give me hooks, but keep them under 30s")];
    expect(buildConversationDigest(withIt, "give me hooks, but keep them under 30s")).toEqual(
      buildConversationDigest(withIt),
    );
  });

  it("…but a genuine repeat, with a turn in between, is carried twice", () => {
    // The creator saying the same thing again IS signal — the dedupe above is about the caller
    // handing over the same turn twice, not about a creator repeating themselves.
    const digest = buildConversationDigest(
      [user("give me a few more hook options"), assistant("Five hooks are on screen.")],
      "give me a few more hook options",
    );
    expect(digest?.turns).toEqual([
      "give me a few more hook options",
      "give me a few more hook options",
    ]);
  });

  it("the emitted BLOCK still fits the budget at the worst case", () => {
    // The §14 defect, from the new direction: an extra turn must be charged against the BLOCK,
    // not the text. Measures what the assembler actually emits, exactly as the cap will pay for it.
    const fat = Array.from({ length: MAX_DIGEST_TURNS }, () => user("z".repeat(400)));
    const digest = buildConversationDigest(fat, "w".repeat(400));
    const withDigest = assembleBundle(
      { ask: "X", platform: "tiktok", mode: "hooks", conversation: digest! },
      null,
    );
    const without = assembleBundle({ ask: "X", platform: "tiktok", mode: "hooks" }, null);
    expect(withDigest.length - without.length).toBeLessThanOrEqual(CONVERSATION_CHAR_BUDGET);
    // …and the overhead is genuinely being charged: a text-only budget would fit strictly more.
    expect(CONVERSATION_BLOCK_OVERHEAD).toBeGreaterThan(0);
  });
});

describe("the flag", () => {
  it("is OFF unless the env var is exactly 'true'", () => {
    const original = process.env.ENGINE_GEN_CONVERSATION;
    try {
      delete process.env.ENGINE_GEN_CONVERSATION;
      expect(isConversationDigestEnabled()).toBe(false);
      process.env.ENGINE_GEN_CONVERSATION = "1";
      expect(isConversationDigestEnabled()).toBe(false);
      process.env.ENGINE_GEN_CONVERSATION = "true";
      expect(isConversationDigestEnabled()).toBe(true);
    } finally {
      if (original === undefined) delete process.env.ENGINE_GEN_CONVERSATION;
      else process.env.ENGINE_GEN_CONVERSATION = original;
    }
  });
});
