import { describe, expect, it } from "vitest";
import { FOCUS_LEVEL, LEVEL_STEP, SIGNAL_MEANING, focusSentence, momentLine, restWord } from "../brain-read";
import { brainTrackOf } from "../brain-track";
import type { ResultRow, Scene, VideoModel } from "../types";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import ending from "./fixtures/ending.json";
import holds from "./fixtures/holds.json";
import leak from "./fixtures/leak.json";
import middle from "./fixtures/middle.json";
import opening from "./fixtures/opening.json";

/** Scenes starting at these seconds (the first at 0:00), each ending where the next starts. */
const scenesAt = (...starts: number[]): Scene[] =>
  starts.map((t0, index) => ({ index, t0, t1: starts[index + 1] ?? t0 + 5, frame: null, description: null }));

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}
const focusOf = (model: VideoModel) => brainTrackOf(model).signals.find((s) => s.id === "dorsal_attention")!.perSecond;

describe("restWord", () => {
  it("more than 3 points over the resting level is above rest, more than 3 under below rest, else at rest", () => {
    expect(LEVEL_STEP).toBe(3);
    expect(restWord(54, 10)).toBe("above rest");
    expect(restWord(13.1, 10)).toBe("above rest");
    expect(restWord(13, 10)).toBe("at rest");
    expect(restWord(10, 10)).toBe("at rest");
    expect(restWord(7, 10)).toBe("at rest");
    expect(restWord(6.9, 10)).toBe("below rest");
  });
});

describe("SIGNAL_MEANING", () => {
  it("says what each of the four signals stands for", () => {
    expect(SIGNAL_MEANING).toEqual({
      visual: "what there is to look at",
      dorsal_attention: "how closely they follow",
      limbic: "how much it moves them",
      default: "how far the mind drifts",
    });
  });
});

describe("momentLine", () => {
  it("names the moment the rows are read at", () => {
    expect(momentLine(7)).toBe("At 0:07 · the dashed line is at rest");
    expect(momentLine(7.25)).toBe("At 0:07 · the dashed line is at rest");
    expect(momentLine(29)).toBe("At 0:29 · the dashed line is at rest");
  });
});

describe("focusSentence", () => {
  it("level: highest minus lowest under 3 points", () => {
    expect(FOCUS_LEVEL).toBe("Focus stays level through the video.");
    expect(focusSentence([40, 41, 42.9, 41], scenesAt(0, 2))).toBe(FOCUS_LEVEL);
    expect(focusSentence([], [])).toBe(FOCUS_LEVEL);
  });

  it("a fall of 3 or more after the peak that lands on a scene change: falls when the scene changes", () => {
    // Highest at 0:02 (60); the largest fall after it, 60 to 40, lands on 0:03, where a scene starts.
    expect(focusSentence([20, 50, 60, 40, 38, 37], scenesAt(0, 3))).toBe(
      "Focus is highest at 0:02 and falls when the scene changes at 0:03.",
    );
  });

  it("at the scene's start or within the second after it; the nearest such start", () => {
    // The fall (55 to 30) lands on 0:04: the scene that started at 0:03 is a second old.
    expect(focusSentence([10, 50, 60, 55, 30, 29], scenesAt(0, 3, 5))).toBe(
      "Focus is highest at 0:02 and falls when the scene changes at 0:03.",
    );
    // Starts at 0:03 and 0:04: the fall lands on the one at 0:04.
    expect(focusSentence([10, 50, 60, 55, 30, 29], scenesAt(0, 3, 4))).toBe(
      "Focus is highest at 0:02 and falls when the scene changes at 0:04.",
    );
  });

  it("a fall that ends before the cut is not that cut's", () => {
    // The fall (60 to 40) lands on 0:02; the scene changes at 0:03, a second later: not named.
    expect(focusSentence([10, 60, 40, 39, 38], scenesAt(0, 3))).toBe("Focus is highest at 0:01 and lowest at 0:02.");
    // Two seconds after a cut is not that cut's either.
    expect(focusSentence([10, 60, 59, 39, 38], scenesAt(0, 1))).toBe("Focus is highest at 0:01 and lowest at 0:03.");
  });

  it("the first scene's start is not a scene change", () => {
    // Highest at 0:00; the fall lands on 0:01, the second after the first scene's start: no scene is
    // named, and Focus is down at its low (25, within 3 of 24) at 0:02.
    expect(focusSentence([60, 30, 25, 24], scenesAt(0, 3))).toBe("Focus is highest at 0:00 and lowest at 0:02.");
  });

  it("the lowest is the second Focus got down there, not one of the flat seconds after it", () => {
    // Down to 26 at 0:04, then flat within a point to the end (the exact minimum is at 0:08).
    expect(focusSentence([0, 80, 60, 40, 26, 26.2, 25.9, 25.5, 25.4], scenesAt(0, 9))).toBe(
      "Focus is highest at 0:01 and lowest at 0:04.",
    );
    // 3 points above the low is not down there yet.
    expect(focusSentence([0, 80, 28.4, 25.5, 25.4], scenesAt(0, 9))).toBe("Focus is highest at 0:01 and lowest at 0:03.");
    expect(focusSentence([0, 80, 28.3, 25.5, 25.4], scenesAt(0, 9))).toBe("Focus is highest at 0:01 and lowest at 0:02.");
  });

  it("a fall under 3 points: lowest, read from the highest second on", () => {
    // The whole clip's lowest (10 at 0:00) comes before the peak and is not read.
    expect(focusSentence([10, 40, 41, 39.5, 38, 37], scenesAt(0, 3))).toBe("Focus is highest at 0:02 and lowest at 0:03.");
  });

  it("a large fall far from any scene change: lowest, from the highest second on", () => {
    expect(focusSentence([10, 60, 59, 58, 30, 29, 28], scenesAt(0, 1))).toBe("Focus is highest at 0:01 and lowest at 0:04.");
  });

  it("neither a fall nor a low before the peak is read", () => {
    // 50 to 10 lands on 0:01, a second from the scene at 0:02, and 10 is the clip's lowest: both come
    // before the peak at 0:03, so the lowest from the peak on is 50 at 0:04.
    expect(focusSentence([50, 10, 20, 60, 50], scenesAt(0, 2))).toBe("Focus is highest at 0:03 and lowest at 0:04.");
  });

  it("a level that holds from its highest second on: no lowest is named", () => {
    // Flat from the peak: the lowest from the peak on is the peak itself.
    expect(focusSentence([0, 5, 5, 5], scenesAt(0, 2))).toBe("Focus is highest at 0:01.");
    // Under 3 points below the highest is not a low.
    expect(focusSentence([0, 50, 50.5, 50, 49.9, 50], scenesAt(0, 3))).toBe("Focus is highest at 0:02.");
    expect(focusSentence([0, 50, 47.1, 48], scenesAt(0, 3))).toBe("Focus is highest at 0:01.");
    // Exactly 3 below is named.
    expect(focusSentence([0, 50, 47, 48], scenesAt(0, 5))).toBe("Focus is highest at 0:01 and lowest at 0:02.");
  });

  it("the first highest second, and the first lowest second at or after it", () => {
    expect(focusSentence([10, 60, 10, 60, 10], scenesAt(0, 5))).toBe("Focus is highest at 0:01 and lowest at 0:02.");
  });

  it("highest at the clip's last second: the lowest is read over the whole clip", () => {
    expect(focusSentence([30, 20, 25, 60], scenesAt(0, 2))).toBe("Focus is highest at 0:03 and lowest at 0:01.");
  });

  it("reads the recorded runs", () => {
    const read = (fixture: unknown) => {
      const model = modelOf(fixture);
      return focusSentence(focusOf(model), model.audience.scenes);
    };
    expect(read(early)).toBe("Focus is highest at 0:07 and lowest at 0:16.");
    // Its steepest second ends at 0:16, a second BEFORE the scene changes at 0:17: no scene is named.
    expect(read(middle)).toBe("Focus is highest at 0:10 and lowest at 0:23.");
    expect(read(opening)).toBe("Focus is highest at 0:09 and lowest at 0:16.");
    expect(read(leak)).toBe("Focus is highest at 0:08 and lowest at 0:23.");
    expect(read(holds)).toBe("Focus is highest at 0:09 and lowest at 0:15.");
    expect(read(ending)).toBe("Focus is highest at 0:09 and lowest at 0:29.");
  });
});
