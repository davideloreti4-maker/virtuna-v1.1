import { describe, expect, it } from "vitest";
import { leadOf, leadSentence } from "@/lib/thread-next/pack-lead";

describe("leadOf", () => {
  it("marks best only with a 10-point lead and all rows done", () => {
    expect(leadOf([30, 22, 45])).toEqual({ allDone: true, top: 2, best: 2, lead: 15 });
    expect(leadOf([30, 22, 38])).toEqual({ allDone: true, top: 2, best: null, lead: 8 });
    expect(leadOf([30, null, 45])).toEqual({ allDone: false, top: 2, best: null, lead: null });
    expect(leadOf([null, null])).toEqual({ allDone: false, top: null, best: null, lead: null });
    expect(leadOf([40, 40])).toEqual({ allDone: true, top: 0, best: null, lead: 0 });
  });
  it("a lead of exactly 10 is a best", () => {
    expect(leadOf([20, 30])).toEqual({ allDone: true, top: 1, best: 1, lead: 10 });
  });
  it("takes the first row on a tie for the top", () => {
    expect(leadOf([10, 50, 50, 5])).toEqual({ allDone: true, top: 1, best: null, lead: 0 });
  });
  it("one row has a top but never a best or a lead", () => {
    expect(leadOf([30])).toEqual({ allDone: true, top: 0, best: null, lead: null });
  });
  it("an empty pack has nothing", () => {
    expect(leadOf([])).toEqual({ allDone: true, top: null, best: null, lead: null });
  });
  it("a non-finite value counts as not simulated", () => {
    expect(leadOf([30, Number.NaN])).toEqual({ allDone: false, top: 0, best: null, lead: null });
  });
});

describe("leadSentence", () => {
  it("writes the sentence", () => {
    expect(leadSentence("hook", leadOf([30, 22, 45]))).toBe("Hook 3 leads by 15 points.");
    expect(leadSentence("idea", leadOf([50, 30]))).toBe("Idea 1 leads by 20 points.");
    expect(leadSentence("hook", leadOf([30, 22, 38]))).toBe("It's close. Hook 3 is ahead by 8 points.");
    expect(leadSentence("idea", leadOf([41, 40]))).toBe("It's close. Idea 1 is ahead by 1 point.");
    expect(leadSentence("hook", leadOf([30, null]))).toBeNull();
    expect(leadSentence("hook", leadOf([30]))).toBeNull();
  });
  it("the top two level is a tie", () => {
    expect(leadSentence("idea", leadOf([40, 40]))).toBe("It's a tie.");
    expect(leadSentence("hook", leadOf([12, 40, 40]))).toBe("It's a tie.");
  });
});
