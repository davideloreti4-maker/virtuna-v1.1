/** waits.test.ts — how long a wait is said to be (plan 2026-11-24-editor-screens-a, Task 3; spec E21; ruling R3 for the upload line). */
import { describe, expect, it } from "vitest";
import { MOST_EXPORT_S, analysisSeconds, exportSeconds, leftWords, uploadSecondsLeft, waitWords } from "../waits";

describe("the estimates", () => {
  it("guesses the analysis from the take's length and the export from the film's", () => {
    expect(analysisSeconds(12.7)).toBe(38);
    expect(analysisSeconds(600)).toBe(420);
    expect(exportSeconds(11.3)).toBe(49);
    expect(exportSeconds(180)).toBe(MOST_EXPORT_S);
  });

  it("says a wait in words, never in a percentage", () => {
    expect(waitWords(38)).toBe("Under a minute");
    expect(waitWords(64)).toBe("About a minute");
    expect(waitWords(91)).toBe("About 2 minutes");
    expect(waitWords(200)).toBe("About 3 minutes");
  });
});

describe("the upload's time left", () => {
  it("is what is left at the rate measured over the last seconds", () => {
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 2000, sent: 4_000_000 }, { at: 4000, sent: 8_000_000 }], 48_000_000)).toBe(20);
  });

  it("is unknown before a second has been measured, and nothing once all is sent", () => {
    expect(uploadSecondsLeft([], 10)).toBeNull();
    expect(uploadSecondsLeft([{ at: 0, sent: 5 }], 10)).toBeNull();
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 400, sent: 5 }], 10)).toBeNull();
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 3000, sent: 10 }], 10)).toBe(0);
  });

  it("follows the rate of the last eight seconds, not of the whole upload", () => {
    const slowThenFast = [{ at: 0, sent: 0 }, { at: 10_000, sent: 1_000_000 }, { at: 12_000, sent: 5_000_000 }, { at: 18_000, sent: 17_000_000 }];
    expect(uploadSecondsLeft(slowThenFast, 21_000_000)).toBe(2);
  });

  it("measures from the sample before the window when the newest one is alone in it", () => {
    // Two reports ten seconds apart: the one before gives the rate (0.5 MB a second, 5 MB left).
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 10_000, sent: 5_000_000 }], 10_000_000)).toBe(10);
    // The sample just before the window, not the first of the upload: 9 MB in the last nine seconds, 18 MB left.
    expect(uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 9000, sent: 1_000_000 }, { at: 18_000, sent: 10_000_000 }], 28_000_000)).toBe(18);
  });
});

describe("the upload line's words", () => {
  it("says seconds under a minute, to the nearest five", () => {
    expect(leftWords(20)).toBe("20 seconds left");
    expect(leftWords(22)).toBe("20 seconds left");
    expect(leftWords(23)).toBe("25 seconds left");
    expect(leftWords(47.4)).toBe("45 seconds left");
    expect(leftWords(52)).toBe("50 seconds left");
    expect(leftWords(54)).toBe("55 seconds left");
    expect(leftWords(54.9)).toBe("55 seconds left");
  });

  it("never says fewer than five seconds", () => {
    expect(leftWords(7)).toBe("5 seconds left");
    expect(leftWords(2)).toBe("5 seconds left");
    expect(leftWords(0)).toBe("5 seconds left");
  });

  it("says about a minute from 55 seconds to under 90", () => {
    expect(leftWords(55)).toBe("About a minute left");
    expect(leftWords(60)).toBe("About a minute left");
    expect(leftWords(89.9)).toBe("About a minute left");
  });

  it("says minutes from 90 seconds, never fewer than two", () => {
    expect(leftWords(90)).toBe("About 2 minutes left");
    expect(leftWords(149)).toBe("About 2 minutes left");
    expect(leftWords(150)).toBe("About 3 minutes left");
    expect(leftWords(600)).toBe("About 10 minutes left");
  });

  it("says the upload's measured time left", () => {
    const left = uploadSecondsLeft([{ at: 0, sent: 0 }, { at: 2000, sent: 4_000_000 }, { at: 4000, sent: 8_000_000 }], 48_000_000);
    expect(left === null ? null : leftWords(left)).toBe("20 seconds left");
  });
});
