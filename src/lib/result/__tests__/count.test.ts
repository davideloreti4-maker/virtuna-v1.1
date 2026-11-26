import { describe, expect, it } from "vitest";
import {
  COUNT_WORDS,
  OF_VIEWERS,
  OPENING_S,
  ROLL_MS,
  VIEWERS,
  countAt,
  endCount,
  formatCount,
  pastOpening,
  rolledAt,
  toCount,
} from "../count";
import { watchingAt } from "../curve";
import type { Audience, ResultRow, VideoModel } from "../types";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import ending from "./fixtures/ending.json";
import holds from "./fixtures/holds.json";
import opening from "./fixtures/opening.json";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}

describe("the count's words", () => {
  it("counts the simulated audience as 1,000 viewers", () => {
    expect(VIEWERS).toBe(1000);
    expect(OF_VIEWERS).toBe("of 1,000");
    expect(OF_VIEWERS).toBe(`of ${formatCount(VIEWERS)}`);
    expect(COUNT_WORDS).toEqual({ end: "watched to the end", now: "still watching" });
    expect(OPENING_S).toBe(3);
  });
});

describe("toCount", () => {
  it("is a stored share times ten, rounded", () => {
    expect(toCount(100)).toBe(1000);
    expect(toCount(0)).toBe(0);
    expect(toCount(46.0674)).toBe(461);
    expect(toCount(45.96)).toBe(460);
    expect(toCount(70.7865)).toBe(708);
  });
});

describe("formatCount", () => {
  it("writes the thousands with a comma", () => {
    expect(formatCount(1000)).toBe("1,000");
    expect(formatCount(461)).toBe("461");
    expect(formatCount(0)).toBe("0");
  });
});

describe("countAt", () => {
  const { audience, clipS, headline } = modelOf(early);

  it("at rest: the share stored at the end of the last scene, watched to the end", () => {
    expect(countAt(audience, clipS, true)).toEqual({ n: 461, words: "watched to the end" });
    expect(endCount(audience)).toBe(461);
  });

  it("never the headline's rounded percent times ten (46% would say 460)", () => {
    expect(headline.value).toBe(46);
    expect(endCount(audience)).not.toBe(headline.value * 10);
  });

  it("at any other moment: the line's value there, still watching", () => {
    expect(countAt(audience, 0, false)).toEqual({ n: 1000, words: "still watching" });
    expect(countAt(audience, 2.5, false)).toEqual({ n: 854, words: "still watching" });
    expect(countAt(audience, 7, false)).toEqual({ n: 562, words: "still watching" });
    // Stopped at the clip's end without being at rest is still a moment of the line.
    expect(countAt(audience, 29, false)).toEqual({ n: 461, words: "still watching" });
  });

  it("is the line at the moment, everywhere", () => {
    for (const t of [0, 1, 2.4, 3, 6.9, 13.2, 20, 28.7]) {
      expect(countAt(audience, t, false).n).toBe(Math.round(watchingAt(audience.points, t) * 10));
    }
  });

  it("reads other runs: holds ends at 843, ending at 0", () => {
    expect(endCount(modelOf(holds).audience)).toBe(843);
    expect(endCount(modelOf(ending).audience)).toBe(0);
  });
});

describe("pastOpening", () => {
  it("is the count at 0:03", () => {
    expect(pastOpening(modelOf(early).audience)).toBe(708);
    expect(pastOpening(modelOf(holds).audience)).toBe(1000);
    expect(pastOpening(modelOf(opening).audience)).toBe(708);
  });

  it("is the count at the clip's end for a clip shorter than 3 seconds", () => {
    const short: Audience = {
      clipS: 2,
      scenes: [{ index: 0, t0: 0, t1: 2, frame: null, description: null }],
      viewers: [],
      points: [
        [0, 100],
        [2, 40],
      ],
    };
    expect(pastOpening(short)).toBe(400);
  });
});

describe("rolledAt", () => {
  it("rolls from 1,000 to the count in 1.5 s, whole numbers", () => {
    expect(ROLL_MS).toBe(1500);
    expect(rolledAt(1000, 461, 0)).toBe(1000);
    expect(rolledAt(1000, 461, 750)).toBe(528);
    expect(rolledAt(1000, 461, 1500)).toBe(461);
    expect(rolledAt(1000, 461, 9000)).toBe(461);
    expect(rolledAt(1000, 461, -5)).toBe(1000);
  });

  it("eases out: past half the way at a third of the time", () => {
    expect(rolledAt(1000, 0, 500)).toBe(296);
  });
});
