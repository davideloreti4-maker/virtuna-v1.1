/**
 * `moneyWord` (plan 2026-11-24-earn, step C; ruling 18): the one function that turns whole cents into
 * words. No ".00", two places otherwise, thousands separated. Pure: no stand-ins.
 */
import { describe, expect, it } from "vitest";

import { moneyWord } from "../earn-words";

describe("moneyWord", () => {
  it.each([
    [0, "$0"],
    [5, "$0.05"],
    [50, "$0.50"],
    [100, "$1"],
    [2450, "$24.50"],
    [5880, "$58.80"],
    [124_000, "$1,240"],
    [124_050, "$1,240.50"],
    [124_001, "$1,240.01"],
    [123_456_789, "$1,234,567.89"],
  ])("moneyWord(%i) is %s", (cents, words) => {
    expect(moneyWord(cents)).toBe(words);
  });

  it("counts in whole cents: a part of a cent is rounded, never shown", () => {
    expect(moneyWord(2449.6)).toBe("$24.50");
    expect(moneyWord(99.5)).toBe("$1");
  });

  it("a negative amount keeps its sign before the dollar", () => {
    expect(moneyWord(-2450)).toBe("-$24.50");
  });

  it("a number that is not one (NaN, Infinity) says $0, never \"$NaN\"", () => {
    expect(moneyWord(Number.NaN)).toBe("$0");
    expect(moneyWord(Number.POSITIVE_INFINITY)).toBe("$0");
  });
});
