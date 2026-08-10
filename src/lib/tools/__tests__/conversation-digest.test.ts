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

  it("leaks no card line into the serialised digest, from any run in the thread", () => {
    const serialised = JSON.stringify(buildConversationDigest(thread));
    for (const line of ["hook A", "hook B", "hook C", "hook D"]) {
      expect(serialised).not.toContain(line);
    }
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
