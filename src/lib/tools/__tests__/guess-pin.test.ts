/**
 * guess-pin.test.ts — the round-1 pin that fixes the measured dispatch defect.
 *
 * ─── WHAT IS BEING PROTECTED ─────────────────────────────────────────────────────────────────
 *
 * Session 10 measured, over 183 real generations: an ask whose SUBJECT is a product, app, show or
 * format — *"give me hooks for my student budgeting app"* — dispatches **7/31 (23%)**, while the
 * same ask shape with a scenario subject dispatches **30/30**. Fisher exact p = 5.4e-11. Pinned,
 * the product asks dispatch 6/6 with quality unchanged. Four separate prompt-only fixes failed to
 * move it. So the pin is structural, and this file is the guard on its trigger.
 *
 * ─── THE ONE THING THAT CAN GO WRONG ─────────────────────────────────────────────────────────
 *
 * A pin is a BILLED run. Every fire on an ask that did not want one spends a credit on something
 * the creator did not request. Measured on the app's own history (147 unique asks, 58 fires), that
 * risk is ~2 asks — and the FIRST of them is why the narrowing below exists:
 *
 *     "Yes, run the simulate tool on that hook — I want the reaction card."
 *
 * `guessSkill` says `hooks` (the word "hook" is in it). The creator wants the SIM. Pinning hooks
 * would force a wrong billed run on an ask that works correctly today.
 *
 * ⚠️ The obvious narrowing — "stand down if the ask mentions another tool" — was MEASURED and is a
 * losing trade: it suppresses 3 confirmed-correct runs to kill that 1 false positive, because this
 * product's own creators describe their subject in tool vocabulary (*"an app that lets you simulate
 * your audience"*). POSITION is what separates them, and the `namesOtherToolFirst` tests below are
 * the record of that: tool-before-artefact is an instruction, tool-after-artefact is a subject.
 */

import { describe, it, expect, afterEach } from "vitest";
import { detectGuessPin, isGuessPinEnabled } from "../guess-pin";

describe("detectGuessPin — the measured defect it exists to fix", () => {
  it("pins a PRODUCT-shaped subject, the 23% cell", () => {
    expect(detectGuessPin("give me 5 hooks for my student budgeting app")).toBe("hooks");
  });

  it("pins a FORMAT-shaped subject, the 0% cell that no wording fixed", () => {
    // V1's clause named "show, newsletter, course or format" explicitly and still moved this
    // cell only 0/10 → 1/10 (p = 1.0). It is the half of the defect that requires structure.
    expect(detectGuessPin("give me hooks for my new stand-up comedy podcast")).toBe("hooks");
  });

  it("pins the other generators, not just hooks", () => {
    expect(detectGuessPin("write a script about my meal prep service")).toBe("script");
    expect(detectGuessPin("give me ideas for my budgeting app")).toBe("ideas");
  });

  it("pins the DESTINATION of a handoff ask, not the noun it starts from", () => {
    // Measured on real traffic: this ask guessed `script`, and the model ran ideas first and the
    // script second — two billed runs for the one artefact the creator named.
    expect(detectGuessPin("Turn the strongest idea into a full script.")).toBe("script");
  });
});

describe("detectGuessPin — what it must NOT pin", () => {
  it("does NOT pin the one measured false positive: another tool named as the ACTION", () => {
    const ask = "Yes, run the simulate tool on that hook — I want the reaction card.";
    expect(detectGuessPin(ask)).toBeNull();
  });

  it("DOES pin when the tool word sits inside the SUBJECT — all three measured true positives", () => {
    // ⚠️ These are the asks the naive "mentions another tool" narrowing would have suppressed.
    // All three confirmed-correct on real traffic: a run followed and it was the right one.
    expect(
      detectGuessPin(
        "3 hooks for my saas software that lets creators simulate how their audience reacts to their video before they post",
      ),
    ).toBe("hooks");
    expect(
      detectGuessPin(
        "give me 3 hooks for my new app which lets you simulate your tiktok and instagram audience to know what will go viral",
      ),
    ).toBe("hooks");
    expect(
      detectGuessPin(
        "hooks for videos about maven my startup which has a software and app letting social media creators and brands simulate their audience",
      ),
    ).toBe("hooks");
  });

  it("does NOT pin a question ABOUT existing work", () => {
    // The pre-router's own QUESTION_OPENER guard, and it must keep carrying this: pinning here
    // would run a paid generator at someone asking how the last one went.
    expect(detectGuessPin("how do my hooks compare to the outliers?")).toBeNull();
    expect(detectGuessPin("what should I write, hooks or a script?")).toBeNull();
  });

  it("does NOT pin plain conversation", () => {
    expect(detectGuessPin("thanks, that's helpful")).toBeNull();
    expect(detectGuessPin("who is my audience again?")).toBeNull();
  });

  it("does NOT pin a remix or predict instruction", () => {
    expect(detectGuessPin("remix the hooks from earlier")).toBeNull();
    expect(detectGuessPin("predict which of these hooks will land")).toBeNull();
  });
});

describe("isGuessPinEnabled — ships dark", () => {
  const original = process.env.ENGINE_GUESS_PIN;
  afterEach(() => {
    if (original === undefined) delete process.env.ENGINE_GUESS_PIN;
    else process.env.ENGINE_GUESS_PIN = original;
  });

  it("is OFF when the flag is unset", () => {
    delete process.env.ENGINE_GUESS_PIN;
    expect(isGuessPinEnabled()).toBe(false);
  });

  it("is OFF for any value other than the exact string 'true'", () => {
    process.env.ENGINE_GUESS_PIN = "1";
    expect(isGuessPinEnabled()).toBe(false);
    process.env.ENGINE_GUESS_PIN = "TRUE";
    expect(isGuessPinEnabled()).toBe(false);
  });

  it("is ON only for 'true'", () => {
    process.env.ENGINE_GUESS_PIN = "true";
    expect(isGuessPinEnabled()).toBe(true);
  });
});
