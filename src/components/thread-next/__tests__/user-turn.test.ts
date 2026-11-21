import { describe, expect, it } from "vitest";

import { videoOfTurn } from "../user-turn";

/**
 * `videoOfTurn` — the video a reloaded turn was about, read off the turn's own
 * `video-test-card` block (its first frame and its length). The user turn is persisted as plain
 * text, so the card is the only record of the video. PURE (default `node` env).
 */

const card = (filmstrip: Array<{ keyframeUrl: string | null }>, durationLabel: string | null) => ({
  type: "video-test-card",
  props: {
    filmstrip: filmstrip.map((f, idx) => ({ idx, label: `Beat ${idx + 1}`, atMs: idx * 1000, mark: null, ...f })),
    durationLabel,
  },
});

describe("videoOfTurn", () => {
  it("the first frame and the length of the turn's video card", () => {
    expect(videoOfTurn([card([{ keyframeUrl: "https://f/1.jpg" }, { keyframeUrl: "https://f/2.jpg" }], "0:29")])).toEqual({
      posterUrl: "https://f/1.jpg",
      durationLabel: "0:29",
    });
  });

  it("the first frame only, never a later one standing in for it", () => {
    expect(videoOfTurn([card([{ keyframeUrl: null }, { keyframeUrl: "https://f/2.jpg" }], "0:29")])).toEqual({
      posterUrl: null,
      durationLabel: "0:29",
    });
  });

  it("a length with no frames, or a frame with no length", () => {
    expect(videoOfTurn([card([], "0:12")])).toEqual({ posterUrl: null, durationLabel: "0:12" });
    expect(videoOfTurn([card([{ keyframeUrl: "https://f/1.jpg" }], null)])).toEqual({
      posterUrl: "https://f/1.jpg",
      durationLabel: null,
    });
  });

  it("neither, no card, or a card of another kind: no video", () => {
    expect(videoOfTurn([card([{ keyframeUrl: null }], null)])).toBeNull();
    expect(videoOfTurn([])).toBeNull();
    expect(videoOfTurn([{ type: "hook-card", props: { hookLine: "x" } }, null, "junk"])).toBeNull();
  });

  it("the first video card of the turn", () => {
    expect(
      videoOfTurn([
        { type: "markdown", props: { text: "Here is the read." } },
        card([{ keyframeUrl: "https://f/a.jpg" }], "0:10"),
        card([{ keyframeUrl: "https://f/b.jpg" }], "0:20"),
      ]),
    ).toEqual({ posterUrl: "https://f/a.jpg", durationLabel: "0:10" });
  });

  it("ignores loose shapes (a string length, a non-array filmstrip)", () => {
    expect(videoOfTurn([{ type: "video-test-card", props: { filmstrip: "x", durationLabel: 29 } }])).toBeNull();
  });
});
