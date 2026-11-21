import { describe, expect, it } from "vitest";
import {
  NO_PROGRESS,
  applyRunEvent,
  arrivedFrames,
  elapsedSeconds,
  frameOnScreen,
  type RunProgress,
} from "../run-progress";

const roster = (n: number) => ({
  type: "roster" as const,
  data: { personas: Array.from({ length: n }, (_, i) => ({ archetype: `group-${i}`, label: `Group ${i}` })) },
});

describe("applyRunEvent", () => {
  it("starts knowing nothing", () => {
    expect(NO_PROGRESS).toEqual({ groups: null, frames: [], done: false });
  });

  it("learns the viewer groups from the roster, in the stream's order", () => {
    const next = applyRunEvent(NO_PROGRESS, roster(10));
    expect(next.groups).toHaveLength(10);
    expect(next.groups?.[0]).toBe("group-0");
    expect(next.groups?.[9]).toBe("group-9");
  });

  it("keeps what it has when the roster comes again (the stream sends it on every reconnect)", () => {
    const once = applyRunEvent(NO_PROGRESS, roster(10));
    expect(applyRunEvent(once, roster(10))).toBe(once);
  });

  it("ignores a roster it cannot read", () => {
    expect(applyRunEvent(NO_PROGRESS, { type: "roster", data: { personas: "ten" } })).toBe(NO_PROGRESS);
    expect(applyRunEvent(NO_PROGRESS, { type: "roster", data: null })).toBe(NO_PROGRESS);
    expect(applyRunEvent(NO_PROGRESS, { type: "roster", data: { personas: [] } })).toBe(NO_PROGRESS);
  });

  it("takes a roster of up to 24 groups and ignores a longer one as unreadable", () => {
    expect(applyRunEvent(NO_PROGRESS, roster(24)).groups).toHaveLength(24);
    expect(applyRunEvent(NO_PROGRESS, roster(25))).toBe(NO_PROGRESS);
  });

  it("places each frame at its scene, in whatever order they land", () => {
    let state: RunProgress = applyRunEvent(NO_PROGRESS, {
      type: "filmstrip_segment_ready",
      data: { segment_idx: 2, keyframe_uri: "https://f/2.jpg" },
    });
    state = applyRunEvent(state, { type: "filmstrip_segment_ready", data: { segment_idx: 0, keyframe_uri: "https://f/0.jpg" } });
    expect(state.frames).toEqual(["https://f/0.jpg", null, "https://f/2.jpg"]);
    expect(arrivedFrames(state)).toEqual(["https://f/0.jpg", "https://f/2.jpg"]);
  });

  it("keeps the same state when a frame comes again (every reconnect replays the frames)", () => {
    const frame = { type: "filmstrip_segment_ready" as const, data: { segment_idx: 1, keyframe_uri: "https://f/1.jpg" } };
    const once = applyRunEvent(NO_PROGRESS, frame);
    expect(applyRunEvent(once, frame)).toBe(once);
  });

  it("takes only https frame addresses", () => {
    for (const keyframe_uri of ["http://f/1.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "blob:x", "/f/1.jpg", "not a url"]) {
      expect(applyRunEvent(NO_PROGRESS, { type: "filmstrip_segment_ready", data: { segment_idx: 1, keyframe_uri } })).toBe(NO_PROGRESS);
    }
  });

  it("ignores a frame without a place or without a picture", () => {
    const bad = [
      { segment_idx: -1, keyframe_uri: "https://f/x.jpg" },
      { segment_idx: 1.5, keyframe_uri: "https://f/x.jpg" },
      { segment_idx: 900, keyframe_uri: "https://f/x.jpg" },
      { segment_idx: 1, keyframe_uri: "" },
      { segment_idx: 1 },
      null,
    ];
    for (const data of bad) {
      expect(applyRunEvent(NO_PROGRESS, { type: "filmstrip_segment_ready", data })).toBe(NO_PROGRESS);
    }
  });

  it("marks the run done when the stream says so, and keeps the rest", () => {
    const state = applyRunEvent(applyRunEvent(NO_PROGRESS, roster(10)), { type: "complete" });
    expect(state.done).toBe(true);
    expect(state.groups).toHaveLength(10);
  });
});

describe("elapsedSeconds", () => {
  const started = Date.parse("2026-11-20T10:00:00Z");

  it("counts whole seconds since the run started", () => {
    expect(elapsedSeconds(started, started + 42_900)).toBe(42);
  });

  it("is 0 before the start (a clock that runs ahead of the server) and without a start", () => {
    expect(elapsedSeconds(started, started - 5_000)).toBe(0);
    expect(elapsedSeconds(null, started)).toBe(0);
  });
});

describe("frameOnScreen", () => {
  const frames = ["a", "b", "c"];

  it("shows no frame before one has arrived", () => {
    expect(frameOnScreen([], 12)).toBeNull();
  });

  it("moves to the next frame every 3 seconds and starts over after the last", () => {
    expect(frameOnScreen(frames, 0)).toBe("a");
    expect(frameOnScreen(frames, 2)).toBe("a");
    expect(frameOnScreen(frames, 3)).toBe("b");
    expect(frameOnScreen(frames, 8)).toBe("c");
    expect(frameOnScreen(frames, 9)).toBe("a");
  });

  it("stays on the first frame for a visitor who asked for less motion", () => {
    expect(frameOnScreen(frames, 8, { still: true })).toBe("a");
  });
});
