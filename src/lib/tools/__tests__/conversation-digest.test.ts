/**
 * conversation-digest.test.ts — the digest the generators finally get.
 *
 * The assertions that matter most here are the EXCLUSIONS, because each one is a defect this
 * project has already paid for once:
 *
 *   · assistant prose never enters the digest — chat-prior-turns.ts documents the model learning
 *     to reproduce its own "Five hooks are on screen." instead of calling a tool;
 *   · a rewrite pack and "cards already on screen" are never both present — opposite instructions
 *     over the same list;
 *   · a record-only turn (a skill run from the pill persists no text row) is not a creator turn.
 */

import { describe, it, expect } from "vitest";
import {
  buildConversationDigest,
  isConversationDigestEnabled,
  MAX_DIGEST_TURNS,
} from "../conversation-digest";
import { CONVERSATION_CHAR_BUDGET } from "@/lib/kc/assembler";
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

describe("buildConversationDigest — cards already on screen", () => {
  const thread = [
    user("hooks about morning focus"),
    ranHooks("Five hooks are on screen.", ["hook A", "hook B"]),
    user("now some about evenings"),
    ranHooks("Done.", ["hook C", "hook D"]),
  ];

  it("carries the LAST run's lines, not every run's", () => {
    const digest = buildConversationDigest(thread);
    expect(digest?.cardsOnScreen).toEqual(["hook C", "hook D"]);
  });

  it("is OMITTED when the run carries a rewrite pack — never both instructions", () => {
    const digest = buildConversationDigest(thread, { includeCards: false });
    expect(digest?.cardsOnScreen).toBeUndefined();
    expect(digest?.turns).toBeDefined();
  });

  it("is omitted when no run left any lines (an unbound generator replays as plain text)", () => {
    const digest = buildConversationDigest([user("hi"), assistant("hello")]);
    expect(digest?.cardsOnScreen).toBeUndefined();
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
