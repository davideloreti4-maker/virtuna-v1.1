import { describe, expect, it } from "vitest";
import { barLength, mostLikely } from "../most-likely";
import type { Intent, ResultRow } from "../types";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import holds from "./fixtures/holds.json";

const LABEL = { share: "Share", comment: "Comment", rewatch: "Rewatch", save: "Save" } as const;
const intent = (id: Intent["id"], value: number): Intent => ({ id, label: LABEL[id], value });
const intentsOf = (fixture: unknown) => {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error("not a result");
  return state.model.intents;
};

describe("mostLikely", () => {
  it("names the one action with the highest value", () => {
    expect(mostLikely([intent("share", 47.9), intent("comment", 29.6), intent("rewatch", 19.4), intent("save", 12.5)])).toBe("share");
  });

  it("follows the run: early Share, holds Save", () => {
    expect(mostLikely(intentsOf(early))).toBe("share");
    expect(mostLikely(intentsOf(holds))).toBe("save");
  });

  it("names none on a tie for the highest", () => {
    expect(mostLikely([intent("share", 40), intent("comment", 40), intent("rewatch", 10), intent("save", 5)])).toBeNull();
  });

  it("names none when every value is zero", () => {
    expect(mostLikely([intent("share", 0), intent("comment", 0), intent("rewatch", 0), intent("save", 0)])).toBeNull();
  });

  it("a tie further down does not matter", () => {
    expect(mostLikely([intent("share", 50), intent("comment", 20), intent("rewatch", 20), intent("save", 1)])).toBe("share");
  });

  it("is decided on the bars as drawn: two bars of one length are not told apart by the tag", () => {
    expect(barLength(47.857)).toBe(48);
    expect(barLength(0)).toBe(4);
    expect(barLength(3.2)).toBe(4);
    // 40.4 and 39.6 both draw 40.
    expect(mostLikely([intent("share", 40.4), intent("comment", 39.6), intent("rewatch", 10), intent("save", 5)])).toBeNull();
    // Four values near zero draw four equal stubs: none stands out.
    expect(mostLikely([intent("share", 1.2), intent("comment", 0.3), intent("rewatch", 0), intent("save", 0)])).toBeNull();
    // One whole percent longer is longer.
    expect(mostLikely([intent("share", 40.5), intent("comment", 40.4), intent("rewatch", 10), intent("save", 5)])).toBe("share");
  });

  it("names none without intents", () => {
    expect(mostLikely(null)).toBeNull();
    expect(mostLikely([])).toBeNull();
  });
});
