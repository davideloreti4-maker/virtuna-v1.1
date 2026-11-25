/**
 * The multiple's words, shared by the remix card (`thread-next/remix-answer.tsx`) and Discover
 * (plan 2026-11-25-discover, Task 1): what a multiple is measured against ("their average" /
 * "their followers", never the stored label's "usual"), the multiple itself, and a view count.
 */
import { describe, expect, it } from "vitest";

import { basisOf, timesLabel, viewsLabel } from "../multiple-words";

describe("basisOf: the stored label read for its meaning, never printed", () => {
  it.each([
    ["vs their usual views", "their average"],
    ["vs their average", "their average"],
    ["vs median views", "their average"],
    ["vs typical views", "their average"],
    ["VS THEIR USUAL VIEWS", "their average"],
  ])("%j is their average", (label, basis) => {
    expect(basisOf(label)).toBe(basis);
  });

  it("a follower baseline is their followers", () => {
    expect(basisOf("vs followers")).toBe("their followers");
    expect(basisOf("vs their follower count")).toBe("their followers");
  });

  it("anything else, or nothing, has no basis", () => {
    expect(basisOf("vs own")).toBeNull();
    expect(basisOf("")).toBeNull();
    expect(basisOf(null)).toBeNull();
    expect(basisOf(undefined)).toBeNull();
  });
});

describe("timesLabel: one decimal under ten, whole from ten", () => {
  it("under ten keeps one decimal, and drops a zero one", () => {
    expect(timesLabel(5.2)).toBe("5.2×");
    expect(timesLabel(3)).toBe("3×");
    expect(timesLabel(3.04)).toBe("3×");
  });

  it("9.95 stays under ten: its one decimal is 9.9 (the float is 9.9499…)", () => {
    expect(timesLabel(9.95)).toBe("9.9×");
  });

  it("from ten, whole", () => {
    expect(timesLabel(10)).toBe("10×");
    expect(timesLabel(27.4)).toBe("27×");
    expect(timesLabel(27.5)).toBe("28×");
    expect(timesLabel(100)).toBe("100×");
  });

  it("99.6 rounds to 100×", () => {
    expect(timesLabel(99.6)).toBe("100×");
  });
});

describe("viewsLabel: no decimal from 100K to a million", () => {
  it("below 100K as formatCount has it", () => {
    expect(viewsLabel(950)).toBe("950");
    expect(viewsLabel(21_400)).toBe("21.4K");
    // 99.999K rounds up to one decimal: formatCount's own rule.
    expect(viewsLabel(99_999)).toBe("100K");
  });

  it("from 100K, whole thousands", () => {
    expect(viewsLabel(100_000)).toBe("100K");
    expect(viewsLabel(849_100)).toBe("849K");
    expect(viewsLabel(999_499)).toBe("999K");
  });

  it("whole thousands that round to a thousand are a million, never 1000K", () => {
    // The last count under the boundary, and the first and last over it.
    expect(viewsLabel(999_499)).toBe("999K");
    expect(viewsLabel(999_500)).toBe("1M");
    expect(viewsLabel(999_999)).toBe("1M");
  });

  it("millions with one decimal when it says something", () => {
    expect(viewsLabel(1_000_000)).toBe("1M");
    expect(viewsLabel(39_800_000)).toBe("39.8M");
    expect(viewsLabel(1_300_000_000)).toBe("1.3B");
  });
});
