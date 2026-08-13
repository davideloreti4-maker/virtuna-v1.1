import { describe, it, expect, afterEach } from "vitest";
import { addCompareHint, isCompareHintEnabled, COMPARE_HINT } from "@/lib/tools/compare-hint";

const ORIGINAL = process.env.ENGINE_COMPARE_HINT;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ENGINE_COMPARE_HINT;
  else process.env.ENGINE_COMPARE_HINT = ORIGINAL;
});

// The three asks measured at 1/18 clean, and at 15/18 with the cue appended (2026-08-13).
const MEASURED_COMPARISON_ASKS = [
  "compare posting daily against posting three times a week for a brand new account",
  "confession opening versus question opening — which holds attention longer, and why?",
  "greenscreen vs talking head for explaining a technical product — which works better?",
];

describe("addCompareHint — the asks the measurement moved", () => {
  it.each(MEASURED_COMPARISON_ASKS)("appends the cue to: %s", (ask) => {
    const out = addCompareHint(ask);
    expect(out).not.toBe(ask);
    expect(out).toBe(ask + COMPARE_HINT);
  });

  it("appends the EXACT string the measurement used — a reworded cue is a different stimulus", () => {
    expect(COMPARE_HINT).toBe(" — lay out the structure side by side.");
  });
});

describe("addCompareHint — what it must NOT touch", () => {
  it("leaves an ask that already announces structure alone (it already cards 6/6)", () => {
    const ask = "explain the structure of a story-time video, start to finish";
    expect(addCompareHint(ask)).toBe(ask);
  });

  it("leaves a non-comparison ask alone", () => {
    const ask = "what makes an ending actually land on a short video?";
    expect(addCompareHint(ask)).toBe(ask);
  });

  it("leaves a generation request alone — that is the count hint's territory", () => {
    const ask = "give me hooks for my new video";
    expect(addCompareHint(ask)).toBe(ask);
  });

  // ISOLATES THE guessSkill GUARD. The ask above carries no comparison shape, so
  // COMPARISON_SHAPE alone rejects it and the guard is never exercised — a mutation
  // that deleted `if (guessSkill(...))` SURVIVED the first draft of this file.
  // These asks are BOTH a generation request AND comparison-shaped (guessSkill → "hooks"),
  // and a paid generator must outrank a card: the directive's own
  // "This never replaces a generator."
  it.each([
    "give me 5 hooks for greenscreen vs talking head",
    "write me hooks comparing daily posting versus weekly",
  ])("leaves a comparison-shaped GENERATION request alone: %s", (ask) => {
    expect(addCompareHint(ask)).toBe(ask);
  });

  it("does not double-append when the cue is already present", () => {
    const once = addCompareHint(MEASURED_COMPARISON_ASKS[0]!);
    expect(addCompareHint(once)).toBe(once);
  });

  it("does not fire on the substring 'vs' inside a word", () => {
    const ask = "how do I improve my cvs and resume content?";
    expect(addCompareHint(ask)).toBe(ask);
  });
});

describe("isCompareHintEnabled — house convention", () => {
  it("is ON by default", () => {
    delete process.env.ENGINE_COMPARE_HINT;
    expect(isCompareHintEnabled()).toBe(true);
  });

  it("is killed by the exact string 'false'", () => {
    process.env.ENGINE_COMPARE_HINT = "false";
    expect(isCompareHintEnabled()).toBe(false);
  });

  it("stays ON for a half-set flag", () => {
    process.env.ENGINE_COMPARE_HINT = "";
    expect(isCompareHintEnabled()).toBe(true);
    process.env.ENGINE_COMPARE_HINT = "true";
    expect(isCompareHintEnabled()).toBe(true);
  });
});
