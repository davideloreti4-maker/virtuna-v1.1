/**
 * competitors-utils — the SECOND formatCount in the codebase.
 *
 * `account-metrics.ts` carries its own `formatCount`, and its test already pins the billions
 * case with the note "(regression: was '1300M')". That fix never reached this copy, which is
 * the one eight surfaces import — competitor cards + table, the compare view, the discover
 * outlier tile, the watchlist, the feed card, saved-item-vm and the viral-detection card.
 * Measured live on /competitors (2026-08-16): @mrbeast's 1.3B likes printed as "1300.0M" and
 * @khaby.lame's 2.6B as "2600.0M".
 *
 * The `.0` was the other half of it: this copy hard-codes `toFixed(1)`, so a round number
 * wore a decimal that claimed a precision it did not have ("5.0M" for exactly 5,000,000).
 */

import { describe, it, expect } from "vitest";
import { formatCount, isStale } from "../competitors-utils";

describe("formatCount", () => {
  it("rolls over into billions instead of printing four-digit millions", () => {
    expect(formatCount(1_300_000_000)).toBe("1.3B");
    expect(formatCount(2_600_000_000)).toBe("2.6B");
  });

  it("drops a trailing .0 rather than claiming a decimal it does not have", () => {
    expect(formatCount(5_000_000)).toBe("5M");
    expect(formatCount(1_000)).toBe("1K");
    expect(formatCount(2_000_000_000)).toBe("2B");
  });

  it("keeps the existing scale behaviour", () => {
    expect(formatCount(null)).toBe("--");
    expect(formatCount(892)).toBe("892");
    expect(formatCount(45_300)).toBe("45.3K");
    expect(formatCount(1_200_000)).toBe("1.2M");
    expect(formatCount(129_100_000)).toBe("129.1M");
  });
});

describe("isStale", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const DAY = 24 * 60 * 60 * 1000;

  it("does not flag a scrape that is merely a few days old", () => {
    // 48h flagged every tracked competitor amber within two days of a scrape, which made the
    // warning the resting state. Same ruling the /audience sync stamp got (2026-08-16).
    expect(isStale(ago(3 * DAY))).toBe(false);
    expect(isStale(ago(13 * DAY))).toBe(false);
  });

  it("flags a scrape old enough to actually be worth acting on", () => {
    expect(isStale(ago(15 * DAY))).toBe(true);
    expect(isStale(null)).toBe(true);
  });
});
