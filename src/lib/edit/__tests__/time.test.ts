import { describe, expect, it } from "vitest";
import { FPS, MAX_FRAMES, MIN_FRAMES, MIN_MARK_MS, frameAt, msOf } from "../time";

describe("time", () => {
  it("counts 30 frames a second, shots of at least 3 frames, films of at most three minutes, marks of at least a tenth of a second", () => {
    expect(FPS).toBe(30);
    expect(MIN_FRAMES).toBe(3);
    expect(MAX_FRAMES).toBe(3 * 60 * 30);
    expect(MIN_MARK_MS).toBe(100);
  });

  it("finds the frame a moment falls on, to the nearest, before the start as well as after it", () => {
    expect(frameAt(1000, 1)).toBe(30);
    expect(frameAt(920, 1)).toBe(28); // 27.6
    expect(frameAt(920, 2)).toBe(14); // 13.8
    expect(frameAt(1000, 0.5)).toBe(60);
    expect(frameAt(0, 1)).toBe(0);
    expect(frameAt(-100, 1)).toBe(-3);
    expect(frameAt(-400, 2)).toBe(-6);
  });

  it("measures how much of a file a stretch of film covers at a speed, unrounded", () => {
    expect(msOf(30, 1)).toBe(1000);
    expect(msOf(30, 2)).toBe(2000);
    expect(msOf(1, 1)).toBeCloseTo(33.3333, 4);
  });

  it("puts the start of every frame back on that frame, at any allowed speed", () => {
    for (const speed of [0.25, 0.3, 0.5, 1, 1.1, 1.37, 1.5, 2, 4]) {
      for (let frame = 0; frame <= 600; frame++) expect(frameAt(msOf(frame, speed), speed)).toBe(frame);
    }
  });
});
