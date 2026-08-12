/**
 * count-hint.test.ts — the count that removes the pushback instead of overriding it.
 *
 * ─── WHAT IS BEING PROTECTED ─────────────────────────────────────────────────────────────────
 *
 * Session 11, 32 unpinned runs across both failing subject shapes:
 *
 *     the creator's words, unchanged    2/12 · 17%    9 pushbacks
 *     the route injects a count        16/20 · 80%    0 pushbacks
 *
 * Nine to zero. The model stops arguing that a named product or format *"is the product, not the
 * hook"* — the defect four sessions and four prompt-only fixes could not move. Unlike the pin
 * (`guess-pin.ts`), this forces nothing: the model still decides, so there is no wrong-run exposure
 * to trade against, which is why it ships first and the pin stays dark behind it.
 *
 * ─── THE TWO RULES THAT KEEP IT HONEST ───────────────────────────────────────────────────────
 *
 * 1. It only ever changes what the MODEL reads. `currentAsk` — the creator's real words, which feed
 *    the conversation digest and the persisted transcript — must be untouched. The route test is
 *    what pins that.
 * 2. It inserts the count the measurement used, in the position the measurement used: before a
 *    PLURAL artefact noun. Nothing else was measured, and this lane has four recorded failures of
 *    untested wording. A singular artefact ("write a script") takes no count — "write a 5 script"
 *    is not a sentence, and a script run produces one script regardless.
 */

import { describe, it, expect, afterEach } from "vitest";
import { addCountHint, isCountHintEnabled } from "../count-hint";

describe("addCountHint — the measured stimulus, reproduced exactly", () => {
  it("adds a count to the product subject, session 11's 2/6 cell", () => {
    expect(addCountHint("give me hooks for my student budgeting app")).toBe(
      "give me 5 hooks for my student budgeting app",
    );
  });

  it("adds a count to the format subject, the 0/6 cell", () => {
    expect(addCountHint("give me hooks for my new stand-up comedy podcast")).toBe(
      "give me 5 hooks for my new stand-up comedy podcast",
    );
  });

  it("works for ideas as well as hooks", () => {
    expect(addCountHint("give me ideas for my budgeting app")).toBe("give me 5 ideas for my budgeting app");
  });

  it("attaches to the artefact the creator asked for, not the first noun in the sentence", () => {
    // The pre-router's "into" rule: the DESTINATION is what gets made. A count in front of "ideas"
    // here would describe the INPUT — work that already exists — which is not what is being asked
    // for. ⚠️ Both nouns must be PLURAL for this to discriminate: an earlier version of this test
    // used "the best idea", which the plural-only regex never matches, so it passed against a
    // first-match implementation too. Mutation 3 in `.scratch/mutate-count-hint.sh` caught that.
    expect(addCountHint("turn the best ideas into hooks")).toBe("turn the best ideas into 5 hooks");
  });
});

describe("addCountHint — what it must leave alone", () => {
  it("does not touch an ask that already carries a count", () => {
    for (const ask of [
      "give me 3 hooks for my budgeting app",
      "give me a few hooks for my budgeting app",
      "give me some hooks for my budgeting app",
      "give me ten hooks for my budgeting app",
    ]) {
      expect(addCountHint(ask)).toBe(ask);
    }
  });

  it("does not touch a SINGULAR artefact — 'write a 5 script' is not a sentence", () => {
    expect(addCountHint("write a script about my meal prep service")).toBe(
      "write a script about my meal prep service",
    );
    expect(addCountHint("Turn the strongest idea into a full script.")).toBe(
      "Turn the strongest idea into a full script.",
    );
  });

  it("does not touch a question about existing work", () => {
    expect(addCountHint("how do my hooks compare to the outliers?")).toBe(
      "how do my hooks compare to the outliers?",
    );
  });

  it("does not touch plain conversation", () => {
    expect(addCountHint("thanks, that's helpful")).toBe("thanks, that's helpful");
    expect(addCountHint("who is my audience again?")).toBe("who is my audience again?");
  });

  it("does not touch an ask that names a different tool as the action", () => {
    const ask = "Yes, run the simulate tool on that hook — I want the reaction card.";
    expect(addCountHint(ask)).toBe(ask);
  });
});

describe("isCountHintEnabled — ships dark", () => {
  const original = process.env.ENGINE_COUNT_HINT;
  afterEach(() => {
    if (original === undefined) delete process.env.ENGINE_COUNT_HINT;
    else process.env.ENGINE_COUNT_HINT = original;
  });

  it("is OFF when unset", () => {
    delete process.env.ENGINE_COUNT_HINT;
    expect(isCountHintEnabled()).toBe(false);
  });

  it("is OFF for any value other than the exact string 'true'", () => {
    process.env.ENGINE_COUNT_HINT = "1";
    expect(isCountHintEnabled()).toBe(false);
  });

  it("is ON only for 'true'", () => {
    process.env.ENGINE_COUNT_HINT = "true";
    expect(isCountHintEnabled()).toBe(true);
  });
});
