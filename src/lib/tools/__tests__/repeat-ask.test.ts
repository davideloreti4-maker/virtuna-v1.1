/**
 * repeat-ask.test.ts — the pin that stops the co-pilot claiming work it did not do.
 *
 * The single most important test in this file is the FALSE ALARM one. The first design of this
 * trigger ("the pre-router guessed a skill AND the thread already ran it") would have fired on
 * the pre-router's one measured harmful case — an ask that says "that hook", and therefore
 * necessarily sits in a thread with a prior hooks run — turning it into a forced, billed, wrong
 * paid run. Everything else here exists to keep the third condition honest.
 */

import { describe, it, expect } from "vitest";
import {
  detectRepeatAsk,
  askSimilarity,
  isRepeatAskPinEnabled,
  REPEAT_ASK_THRESHOLD,
} from "../repeat-ask";
import type { ChatAgentPriorTurn } from "../chat-agent-loop";

/** A thread whose last assistant turn ran hooks about "morning focus". */
const ranHooks = (topic: string): ChatAgentPriorTurn[] => [
  { role: "user", text: topic },
  {
    role: "assistant",
    text: "Five hooks are on screen.",
    toolRuns: [{ name: "generate_hooks", cards: 5, topic, lines: ["a", "b"] }],
  },
];

const HOOKS_THREAD = ranHooks("write me 5 hooks about morning focus");

describe("detectRepeatAsk — the measured defect", () => {
  it("pins when the creator asks for exactly the same thing again", () => {
    expect(detectRepeatAsk("write me 5 hooks about morning focus", HOOKS_THREAD)).toBe("hooks");
  });

  it("pins on a paraphrase of the same request", () => {
    expect(detectRepeatAsk("give me 5 more hooks on morning focus", HOOKS_THREAD)).toBe("hooks");
    expect(detectRepeatAsk("hooks about morning focus again", HOOKS_THREAD)).toBe("hooks");
  });
});

describe("detectRepeatAsk — what it must NOT do", () => {
  it("does NOT pin the pre-router's one measured false alarm", () => {
    // "Yes, run the simulate tool on that hook — I want the reaction card."
    // guessSkill says "hooks" (the word "hook" is in it), and "that hook" guarantees a prior
    // hooks run exists. Only the duplicate-subject condition saves this from a paid wrong run.
    const ask = "Yes, run the simulate tool on that hook — I want the reaction card.";
    expect(detectRepeatAsk(ask, HOOKS_THREAD)).toBeNull();
  });

  it("does NOT pin a FIRST ask — push-back-once behaviour is untouched", () => {
    expect(detectRepeatAsk("write me 5 hooks about morning focus", [])).toBeNull();
    expect(
      detectRepeatAsk("write me 5 hooks about morning focus", [{ role: "user", text: "hi" }]),
    ).toBeNull();
  });

  it("does NOT pin a question about the existing pack", () => {
    // The pre-router's QUESTION_OPENER guard carries this, and it must keep carrying it: these
    // are the shipped follow-up chips.
    expect(detectRepeatAsk("which of these hooks about morning focus is strongest?", HOOKS_THREAD)).toBeNull();
    expect(detectRepeatAsk("how do these morning focus hooks compare?", HOOKS_THREAD)).toBeNull();
  });

  it("does NOT pin a DIFFERENT subject", () => {
    expect(detectRepeatAsk("write me 5 hooks about sourdough baking", HOOKS_THREAD)).toBeNull();
  });

  it("does NOT pin across skills — a script ask never matches a hooks run", () => {
    // Same words, different artefact. The topic overlap is near-total and it must still not fire.
    expect(detectRepeatAsk("write me a script about morning focus", HOOKS_THREAD)).toBeNull();
  });

  it("does NOT pin on a run whose topic was never reconstructed", () => {
    const noTopic: ChatAgentPriorTurn[] = [
      { role: "assistant", text: "done", toolRuns: [{ name: "generate_hooks", cards: 5 }] },
    ];
    expect(detectRepeatAsk("write me 5 hooks about morning focus", noTopic)).toBeNull();
  });

  it("ignores a tool name that is not a known generator", () => {
    const unknown: ChatAgentPriorTurn[] = [
      {
        role: "assistant",
        text: "done",
        toolRuns: [{ name: "run_simulation", cards: 1, topic: "write me 5 hooks about morning focus" }],
      },
    ];
    expect(detectRepeatAsk("write me 5 hooks about morning focus", unknown)).toBeNull();
  });
});

describe("askSimilarity", () => {
  it("is 1 for the same ask and 0 for disjoint ones", () => {
    expect(askSimilarity("hooks about gym myths", "hooks about gym myths")).toBe(1);
    expect(askSimilarity("hooks about gym myths", "")).toBe(0);
  });

  it("ignores word order and request phrasing", () => {
    expect(
      askSimilarity("give me 5 more hooks on morning focus", "write me 5 hooks about morning focus"),
    ).toBeGreaterThanOrEqual(REPEAT_ASK_THRESHOLD);
  });

  it("treats singular and plural as the same token", () => {
    expect(askSimilarity("hooks for gym myths", "hook for gym myth")).toBe(1);
  });

  it("scores the measured false alarm near zero against the prior topic", () => {
    const s = askSimilarity(
      "Yes, run the simulate tool on that hook — I want the reaction card.",
      "write me 5 hooks about morning focus",
    );
    expect(s).toBeLessThan(0.2);
  });
});

describe("the flag", () => {
  it("is OFF unless the env var is exactly 'true'", () => {
    const original = process.env.ENGINE_REPEAT_ASK_PIN;
    try {
      delete process.env.ENGINE_REPEAT_ASK_PIN;
      expect(isRepeatAskPinEnabled()).toBe(false);
      process.env.ENGINE_REPEAT_ASK_PIN = "yes";
      expect(isRepeatAskPinEnabled()).toBe(false);
      process.env.ENGINE_REPEAT_ASK_PIN = "true";
      expect(isRepeatAskPinEnabled()).toBe(true);
    } finally {
      if (original === undefined) delete process.env.ENGINE_REPEAT_ASK_PIN;
      else process.env.ENGINE_REPEAT_ASK_PIN = original;
    }
  });
});
