/**
 * The playhead's rules, on a recorded run (`early`: scenes start at 0, 2, 3, 7, 14, 21, 24; the
 * clip ends at 29). At rest the playhead sits at the clip's end; the arrow keys step by scene.
 */
import { describe, expect, it } from "vitest";
import { audienceOf } from "../curve";
import { isResting, restingAt, stepScene } from "../playhead";
import type { ResultRow } from "../types";
import early from "./fixtures/early.json";

const audience = audienceOf(early as unknown as ResultRow)!;
const { scenes, clipS } = audience;

describe("the playhead at rest", () => {
  it("rests at the clip's end, not playing", () => {
    expect(clipS).toBe(29);
    expect(restingAt(clipS)).toEqual({ t: 29, playing: false });
    expect(isResting(restingAt(clipS), clipS)).toBe(true);
  });

  it("is not resting while it plays, or before the end", () => {
    expect(isResting({ t: 29, playing: true }, clipS)).toBe(false);
    expect(isResting({ t: 5, playing: false }, clipS)).toBe(false);
    expect(isResting({ t: 0, playing: false }, clipS)).toBe(false);
  });
});

describe("stepping right", () => {
  it("goes to the start of the next scene", () => {
    expect(stepScene(scenes, 0, 1, clipS)).toBe(2);
    expect(stepScene(scenes, 2.5, 1, clipS)).toBe(3);
  });

  it("from a border, goes to the start of the scene after the one that starts there", () => {
    expect(stepScene(scenes, 2, 1, clipS)).toBe(3);
    expect(stepScene(scenes, 7, 1, clipS)).toBe(14);
  });

  it("from the last scene, goes to the clip's end (rest)", () => {
    expect(stepScene(scenes, 24, 1, clipS)).toBe(29);
    expect(stepScene(scenes, 26.4, 1, clipS)).toBe(29);
  });

  it("from rest, stays at rest", () => {
    expect(stepScene(scenes, 29, 1, clipS)).toBe(29);
  });
});

describe("stepping left", () => {
  it("inside a scene, goes to that scene's start", () => {
    expect(stepScene(scenes, 2.5, -1, clipS)).toBe(2);
    expect(stepScene(scenes, 10, -1, clipS)).toBe(7);
  });

  it("at a scene's start, goes to the start of the scene before", () => {
    expect(stepScene(scenes, 2, -1, clipS)).toBe(0);
    expect(stepScene(scenes, 14, -1, clipS)).toBe(7);
  });

  it("at 0:00, stays at 0:00", () => {
    expect(stepScene(scenes, 0, -1, clipS)).toBe(0);
  });

  it("from rest, goes to the start of the last scene", () => {
    expect(stepScene(scenes, 29, -1, clipS)).toBe(24);
  });
});

describe("a scene of no length (found in review, 2026-11-20)", () => {
  const odd = [
    { index: 0, t0: 0, t1: 3, frame: null, description: null },
    { index: 1, t0: 3, t1: 3, frame: null, description: null },
    { index: 2, t0: 3, t1: 6, frame: null, description: null },
  ];

  it("left does not get stuck on it", () => {
    expect(stepScene(odd, 3, -1, 6)).toBe(0);
    expect(stepScene(odd, 6, -1, 6)).toBe(3);
  });

  it("right steps past it", () => {
    expect(stepScene(odd, 0, 1, 6)).toBe(3);
    expect(stepScene(odd, 3, 1, 6)).toBe(6);
  });
});
