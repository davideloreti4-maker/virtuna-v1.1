/**
 * time.test.ts — the rounding rules everything else stands on.
 *
 * The measured failure these guard against (2026-11-11): cut times rounded to the millisecond put
 * 5 of 10 cuts one frame late, because frame 56 is at 1866.67 ms and a clip written to start at
 * 1867 is not yet on at that frame.
 */
import { describe, expect, it } from "vitest";
import { FPS, MAX_FRAMES, frameMs, minSourceMs, sec, sourceMs, spanMs } from "../time";

describe("frameMs", () => {
  it("is 1866 for frame 56, not 1867", () => {
    expect(frameMs(56)).toBe(1866);
  });

  it("is never after the frame it stands for, and never a whole millisecond before it", () => {
    for (let f = 0; f <= MAX_FRAMES; f++) {
      const exact = (f * 1000) / FPS;
      expect(frameMs(f)).toBeLessThanOrEqual(exact);
      expect(exact - frameMs(f)).toBeLessThan(1);
    }
  });
});

describe("spanMs", () => {
  it("makes consecutive clips touch: where one ends the next begins", () => {
    let at = 0;
    for (const len of [56, 47, 136, 40, 78, 71, 81, 25, 86, 220, 73]) {
      expect(frameMs(at) + spanMs(at, len)).toBe(frameMs(at + len));
      at += len;
    }
  });
});

describe("sourceMs", () => {
  it("never takes more source than the clip's time on the film allows, at any speed", () => {
    for (const speed of [0.25, 0.3, 0.5, 0.77, 1, 1.5, 2, 3.3, 4]) {
      for (let start = 0; start < 400; start += 7) {
        for (const len of [3, 10, 31, 100]) {
          expect(sourceMs(start, len, speed) / speed).toBeLessThanOrEqual(spanMs(start, len));
        }
      }
    }
  });
});

describe("minSourceMs", () => {
  it("is the least source a clip takes wherever it sits, and at most ⌈speed⌉ ms under the most", () => {
    for (const speed of [0.25, 0.3, 0.5, 0.77, 1, 1.5, 2, 3.3, 4]) {
      for (const len of [3, 4, 5, 7, 10, 31, 47, 100, 18_000]) {
        /* a frame's millisecond repeats every 3 frames (100 ms), so 30 starts cover every kind */
        const everywhere = Array.from({ length: 30 }, (_, start) => sourceMs(start, len, speed));
        expect(minSourceMs(len, speed)).toBe(Math.min(...everywhere));
        expect(Math.max(...everywhere) - minSourceMs(len, speed)).toBeLessThanOrEqual(Math.ceil(speed));
      }
    }
    expect(minSourceMs(4, 1)).toBe(133); // 4 frames are 133 ms from frame 0 and 134 from frame 5
  });
});

describe("sec", () => {
  it("writes seconds with at most three decimals and no trailing zeros", () => {
    expect(sec(1866)).toBe("1.866");
    expect(sec(9300)).toBe("9.3");
    expect(sec(0)).toBe("0");
    expect(sec(28000)).toBe("28");
  });
});
