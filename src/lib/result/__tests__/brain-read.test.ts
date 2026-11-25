import { describe, expect, it } from "vitest";
import { LEVEL_STEP, SIGNAL_MEANING, momentLine, restWord } from "../brain-read";

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
