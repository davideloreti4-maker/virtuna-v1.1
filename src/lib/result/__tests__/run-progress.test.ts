import { describe, expect, it } from "vitest";
import {
  NO_PROGRESS,
  applyRunEvent,
  arrivedFrames,
  elapsedSeconds,
  type RunProgress,
} from "../run-progress";

const roster = (n: number) => ({
  type: "roster" as const,
  data: { personas: Array.from({ length: n }, (_, i) => ({ archetype: `group-${i}`, label: `Group ${i}` })) },
});

describe("applyRunEvent", () => {
  it("starts knowing nothing", () => {
    expect(NO_PROGRESS).toEqual({ groups: null, frames: [], cover: null, done: false });
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

  it("learns the post's cover from the source event; the first one stands", () => {
    const once = applyRunEvent(NO_PROGRESS, {
      type: "source",
      data: { cover_url: "https://p.test/cover.jpg", handle: "nia.tests", views: 1200, video_url: null },
    });
    expect(once.cover).toBe("https://p.test/cover.jpg");
    expect(applyRunEvent(once, { type: "source", data: { cover_url: "https://p.test/other.jpg" } })).toBe(once);
  });

  it("takes only an https cover, and ignores a source without one", () => {
    for (const cover_url of ["http://p.test/c.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "blob:x", "/c.jpg", "", null, 7]) {
      expect(applyRunEvent(NO_PROGRESS, { type: "source", data: { cover_url, handle: "nia.tests" } })).toBe(NO_PROGRESS);
    }
    expect(applyRunEvent(NO_PROGRESS, { type: "source", data: null })).toBe(NO_PROGRESS);
  });

  it("a cover changes nothing else it knows", () => {
    const withGroups = applyRunEvent(NO_PROGRESS, roster(10));
    const next = applyRunEvent(withGroups, { type: "source", data: { cover_url: "https://p.test/cover.jpg" } });
    expect(next.groups).toBe(withGroups.groups);
    expect(next.frames).toBe(withGroups.frames);
    expect(next.done).toBe(false);
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
