import { describe, expect, it } from "vitest";
import { getFollowerTier } from "../follower-tier";

describe("getFollowerTier", () => {
  it.each([
    [0, null],
    [-1, null],
    [-1000, null],
    [500, "nano"],
    [5_000, "nano"],
    [9_999, "nano"],
    [10_000, "micro"],
    [50_000, "micro"],
    [99_999, "micro"],
    [100_000, "mid"],
    [500_000, "mid"],
    [999_999, "mid"],
    [1_000_000, "large"],
    [2_000_000, "large"],
    [9_999_999, "large"],
    [10_000_000, "mega"],
    [20_000_000, "mega"],
    [100_000_000, "mega"],
  ])("getFollowerTier(%i) returns %s", (count, expected) => {
    expect(getFollowerTier(count)).toBe(expected);
  });

  it("returns null for null input", () => {
    expect(getFollowerTier(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getFollowerTier(undefined)).toBeNull();
  });
});
