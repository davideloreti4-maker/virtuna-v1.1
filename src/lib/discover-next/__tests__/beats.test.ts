/**
 * "How it's built": the stored beats numbered, and, when every
 * beat is timed, the length and one bar cut at the beats in proportion. Pure.
 */
import { describe, expect, it } from "vitest";

import { beatsView, clockWord } from "../beats";

describe("clockWord: whole seconds as m:ss", () => {
  it.each([
    [0, "0:00"],
    [51, "0:51"],
    [65, "1:05"],
    [723, "12:03"],
    [51.9, "0:51"],
    [3600, "60:00"],
  ])("%d is %s", (sec, word) => {
    expect(clockWord(sec)).toBe(word);
  });

  it("a negative or broken number reads as 0:00", () => {
    expect(clockWord(-3)).toBe("0:00");
    expect(clockWord(Number.NaN)).toBe("0:00");
  });
});

describe("beatsView", () => {
  it("timed: the length, a share per beat adding up to 1, and each start", () => {
    const view = beatsView([
      { name: "Hook", startSec: 0, endSec: 3 },
      { name: "Setup", startSec: 3, endSec: 12 },
      { name: "Payoff", startSec: 12, endSec: 20 },
    ]);
    expect(view).not.toBeNull();
    expect(view!.length).toBe("0:20");
    expect(view!.bar).toEqual([3 / 20, 9 / 20, 8 / 20]);
    expect(view!.bar!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(view!.rows).toEqual([
      { n: 1, name: "Hook", at: "0:00" },
      { n: 2, name: "Setup", at: "0:03" },
      { n: 3, name: "Payoff", at: "0:12" },
    ]);
  });

  it("a share runs to the next start, not to the beat's own end", () => {
    const view = beatsView([
      { name: "Hook", startSec: 2, endSec: 4 },
      { name: "Body", startSec: 6, endSec: 9 },
      { name: "Close", startSec: 9, endSec: 12 },
    ]);
    // The bar spans the first start to the last end: 2 to 12.
    expect(view!.bar).toEqual([4 / 10, 3 / 10, 3 / 10]);
    expect(view!.length).toBe("0:12");
    expect(view!.rows.map((r) => r.at)).toEqual(["0:02", "0:06", "0:09"]);
  });

  it("one timed beat: the whole bar", () => {
    const view = beatsView([{ name: "The whole thing", startSec: 0, endSec: 51 }]);
    expect(view).toEqual({ length: "0:51", bar: [1], rows: [{ n: 1, name: "The whole thing", at: "0:00" }] });
  });

  it("two beats that start together: the first has no width", () => {
    const view = beatsView([
      { name: "Text on screen", startSec: 0, endSec: 2 },
      { name: "Voice", startSec: 0, endSec: 10 },
    ]);
    expect(view!.bar).toEqual([0, 1]);
  });

  it("a beat without times: listed, with no bar, no length and no starts", () => {
    const view = beatsView([
      { name: "Hook", startSec: 0, endSec: 3 },
      { name: "Setup" },
      { name: "Payoff", startSec: 12, endSec: 20 },
    ]);
    expect(view).toEqual({
      length: null,
      bar: null,
      rows: [
        { n: 1, name: "Hook", at: null },
        { n: 2, name: "Setup", at: null },
        { n: 3, name: "Payoff", at: null },
      ],
    });
  });

  it("a null or broken start is no time", () => {
    expect(beatsView([{ name: "A", startSec: null, endSec: 3 }])!.bar).toBeNull();
    expect(beatsView([{ name: "A", startSec: Number.NaN, endSec: 3 }])!.bar).toBeNull();
    expect(beatsView([{ name: "A", startSec: -1, endSec: 3 }])!.bar).toBeNull();
  });

  it("starts going down: not timed", () => {
    const view = beatsView([
      { name: "Hook", startSec: 0, endSec: 3 },
      { name: "Setup", startSec: 8, endSec: 12 },
      { name: "Payoff", startSec: 5, endSec: 20 },
    ]);
    expect(view!.bar).toBeNull();
    expect(view!.length).toBeNull();
    expect(view!.rows.every((r) => r.at === null)).toBe(true);
  });

  it("a last beat without an end, or an end not past its start: not timed", () => {
    expect(beatsView([{ name: "Hook", startSec: 0, endSec: 3 }, { name: "Payoff", startSec: 3 }])!.bar).toBeNull();
    expect(beatsView([{ name: "Hook", startSec: 0, endSec: 3 }, { name: "Payoff", startSec: 3, endSec: null }])!.length).toBeNull();
    expect(beatsView([{ name: "Hook", startSec: 0, endSec: 3 }, { name: "Payoff", startSec: 3, endSec: 3 }])!.bar).toBeNull();
    expect(beatsView([{ name: "Hook", startSec: 0, endSec: 3 }, { name: "Payoff", startSec: 3, endSec: Infinity }])!.bar).toBeNull();
  });

  it("an end missing on a beat that is not the last does not matter", () => {
    const view = beatsView([
      { name: "Hook", startSec: 0 },
      { name: "Payoff", startSec: 5, endSec: 10 },
    ]);
    expect(view!.bar).toEqual([0.5, 0.5]);
  });

  it("a beat with an empty name is dropped, the rest numbered from 1 and judged without it", () => {
    const view = beatsView([
      { name: "  ", startSec: 0, endSec: 2 },
      { name: "Hook", startSec: 2, endSec: 4 },
      { name: "", startSec: 1 },
      { name: " Payoff  now ", startSec: 4, endSec: 10 },
    ]);
    expect(view!.rows).toEqual([
      { n: 1, name: "Hook", at: "0:02" },
      { n: 2, name: "Payoff now", at: "0:04" },
    ]);
    expect(view!.bar).toEqual([2 / 8, 6 / 8]);
    expect(view!.length).toBe("0:10");
  });

  it("no beat with a name: nothing", () => {
    expect(beatsView([])).toBeNull();
    expect(beatsView([{ name: "", startSec: 0, endSec: 3 }, { name: "   " }])).toBeNull();
  });
});
