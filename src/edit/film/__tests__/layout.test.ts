import { describe, expect, it } from "vitest";
import { CAPTION_LOOKS, DEFAULT_CAPTIONS, STAGE, type Captions } from "../../../lib/edit";
import { measure } from "../../../lib/edit/measure";
import * as layout from "../layout";
import { PLAIN_EDGE, calloutBox, calloutWeight, captionPages, captionWeights, edgeOf, progressBox, sentenceSet, spaceEm, titleBox, titleWeight, type CalloutProps, type CaptionWord, type Measure, type TitleProps } from "../layout";
import { fitLines, markedWords } from "../lines";
import { even } from "../parts/types";

/**
 * A measure whose numbers are easy to follow by hand: every character is half the type size
 * wide, whatever the weight and tracking. The kit's components measure in the browser and
 * `review` with the server's table; the box math is the same for both.
 */
const fixed: Measure = (text, _weight, size) => text.length * size * 0.5;
const words = (...texts: string[]) => texts.map((text) => ({ text }));

/** A page set as the only page of its run. */
function alone(captions: Captions, page: readonly CaptionWord[], measure: Measure = fixed) {
  const [box] = captionPages(captions, [page], measure);
  if (!box) throw new Error("no page laid out");
  return box;
}

const callout = (props: Partial<CalloutProps> = {}): CalloutProps => ({ text: "Look here", font: "tiktok", look: "pop", x: 0.5, y: 0.3, size: 150, color: "#ffffff", ...props });
const title = (props: Partial<TitleProps> = {}): TitleProps => ({ text: "Make it *count*", font: "tiktok", look: "bold", y: 0.5, size: 120, color: "#ffffff", accent: null, ...props });

describe("a caption page's box", () => {
  it("sets three short words on one row, centred on the captions' line, one row's pitch plus the pill's padding tall", () => {
    // At 72 px: "we" and "go" are 72 wide, "now" 108; the gap is round(0.34 × 72) = 24, so the row is 300.
    // The pill keeps round(0.46 × 72) = 33 at each side and round(0.24 × 72) = 17 above and below.
    // A row's pitch is even(72 × 1.15) = 82, so the page is 82 + 2 × 17 = 116 tall and 300 + 2 × 33 = 366 wide.
    const box = alone(DEFAULT_CAPTIONS, words("we", "go", "now"));
    expect(box).toMatchObject({ size: 72, breaks: [0], w: 366, h: 116 });
    expect(box.y + box.h / 2).toBe(0.8 * 1920);
    expect(box.x + box.w / 2).toBe(540);
    expect(box).toMatchObject({ x: 357, y: 1478 });
  });

  it("breaks words too wide for the captions' width into two rows, and never into more rows than it has words", () => {
    // The room is even(0.86 × 1080) − 2 × 33 = 862. Three words of 360 with gaps of 24 are 1128 wide:
    // two rows, the first of two words (744) and the second of one, as `rowsWithin` fills the earlier row.
    const wide = words("everything", "absolutely", "remarkable");
    const box = alone(DEFAULT_CAPTIONS, wide);
    expect(box.breaks).toEqual([0, 2]);
    // Two rows of 82, the gap between rows even(0.12 × 72) = 8, and the pill's 17 above and below.
    expect(box).toMatchObject({ size: 72, w: 744 + 66, h: 2 * 82 + 8 + 2 * 17, x: 540 - 405, y: 1536 - 103 });
    expect(box.breaks.length).toBeLessThanOrEqual(Math.min(wide.length, DEFAULT_CAPTIONS.maxWords));
  });

  it("sets a page smaller when one word is wider than the room, each word then on its own row", () => {
    // A word of 30 letters is 1080 wide at 72, over the room of 862: the type is set at floor(72 × 862 / 1080) = 57.
    const long = "a".repeat(30);
    const box = alone(DEFAULT_CAPTIONS, words(long, long, long));
    expect(box.size).toBe(57);
    expect(box.breaks).toEqual([0, 1, 2]);
  });

  it("measures a stressed word at its own weight", () => {
    const byWeight: Measure = (text, weight, size) => text.length * size * (weight === 900 ? 0.6 : 0.5);
    const plain = alone(DEFAULT_CAPTIONS, [{ text: "now" }], byWeight);
    const stressed = alone(DEFAULT_CAPTIONS, [{ text: "now", stress: true }], byWeight);
    // 3 × 72 × 0.5 = 108, and 3 × 72 × 0.6 = 129.6, which is 130 in whole pixels.
    expect(stressed.w - plain.w).toBe(130 - 108);
  });

  it("holds every page of a run inside the stage by its tallest page, at the bottom and at the top, so pages of fewer rows do not jump", () => {
    const one = words("we", "go", "now"); // one row, 116 tall
    const two = words("everything", "absolutely", "remarkable"); // two rows, 206 tall
    // At the bottom. Alone, the page of one row is held at 1920 − (58 + 0.02 × 1920) = 1823.6, so centred on 1824.
    const low = { ...DEFAULT_CAPTIONS, y: 1 };
    expect(alone(low, one).y).toBe(1824 - 58);
    // In a run with the page of two rows, both are held at 1920 − (103 + 38.4) = 1778.6, so centred on 1779: the shorter one 45 higher.
    const [lowOne, lowTwo] = captionPages(low, [one, two], fixed);
    expect([lowOne?.y, lowTwo?.y]).toEqual([1779 - 58, 1779 - 103]);
    // At the top. Alone, it is held at 58 + 38.4 = 96.4, so centred on 96; in the run, at 103 + 38.4 = 141.4, so on 141.
    const high = { ...DEFAULT_CAPTIONS, y: 0 };
    expect(alone(high, one).y).toBe(96 - 58);
    const [highTwo, highOne] = captionPages(high, [two, one], fixed);
    expect([highOne?.y, highTwo?.y]).toEqual([141 - 58, 141 - 103]);
  });

  it("gives a page's box only with its run's other pages: no box of a page alone is offered", () => {
    // A page by itself is placed as if it were its run's tallest; on the demo edit that put one 94 px from where it is drawn.
    // `captionWeights` (2026-11-24) gives the weights the words are set in, not a box.
    expect(Object.keys(layout).filter((name) => /^caption/.test(name)).sort()).toEqual(["captionPages", "captionWeights"]);
  });

  it("sets caption words at the captions' weight, a stressed word one step heavier, at most 900", () => {
    expect(captionWeights(DEFAULT_CAPTIONS)).toEqual({ plain: 800, stressed: 900 });
    expect(captionWeights({ ...DEFAULT_CAPTIONS, weight: 600 })).toEqual({ plain: 600, stressed: 700 });
    expect(captionWeights({ ...DEFAULT_CAPTIONS, weight: 900 })).toEqual({ plain: 900, stressed: 900 });
    // A measure that grows with the weight: at 600 every word is narrower than at the look's own 800, so the page is too.
    const heavier: Measure = (text, weight, size) => text.length * size * 0.5 * (weight / 800);
    const page = words("we", "go", "now");
    expect(alone({ ...DEFAULT_CAPTIONS, weight: 600 }, page, heavier).w).toBeLessThan(alone(DEFAULT_CAPTIONS, page, heavier).w);
  });

  it("sets every word of a plain page with a weight and no highlight colour at the captions' weight (ruled 2026-11-24)", () => {
    const even600: Captions = { ...DEFAULT_CAPTIONS, look: "plain", weight: 600, highlight: null };
    expect(captionWeights(even600)).toEqual({ plain: 600, stressed: 600 });
    // Every other case as before: a highlight colour set keeps the step; the other looks keep it; no weight is 800 and 900.
    expect(captionWeights({ ...even600, highlight: "#ffe14a" })).toEqual({ plain: 600, stressed: 700 });
    for (const look of ["pill", "pop", "highlight"] as const) expect(captionWeights({ ...even600, look }), look).toEqual({ plain: 600, stressed: 700 });
    expect(captionWeights({ ...DEFAULT_CAPTIONS, look: "plain", highlight: null })).toEqual({ plain: 800, stressed: 900 });
    // The page is measured at that weight: a stressed word is as wide as the same word unstressed.
    const byWeight: Measure = (text, weight, size) => text.length * size * 0.5 * (weight / 600);
    expect(alone(even600, [{ text: "now", stress: true }], byWeight).w).toBe(alone(even600, [{ text: "now" }], byWeight).w);
    expect(alone({ ...even600, highlight: "#ffe14a" }, [{ text: "now", stress: true }], byWeight).w).toBeGreaterThan(alone(even600, [{ text: "now" }], byWeight).w);
  });

  it("sets plain captions with a weight as a sentence: the typeface's own space between words", () => {
    const tiktok: Measure = (text, weight, size, trackingEm) => measure(text, "tiktok", weight, size, trackingEm) ?? Number.NaN;
    const sentence: Captions = { ...DEFAULT_CAPTIONS, look: "plain", font: "tiktok", size: 64, maxWords: 5, weight: 600 };
    expect(sentenceSet(sentence)).toBe(true);
    const five = words("keep", "it", "short", "and", "clear"); // made up
    const box = alone(sentence, five, tiktok);
    const gap = Math.round(spaceEm("tiktok", 600) * 64);
    expect(gap).toBeLessThan(Math.round(0.34 * 64)); // the typeface's space is narrower than 0.34 em, 22 at 64
    expect(box).toMatchObject({ size: 64, gap, breaks: [0] });
    expect(box.widths).toEqual(five.map((word) => Math.ceil(tiktok(word.text, 600, 64))));
    expect(box.rows).toEqual([{ from: 0, to: 5, width: even(box.widths.reduce((sum, width) => sum + width, 0) + 4 * gap) }]);
    // A word too long for the row sets the page smaller, and its gap is the space at that smaller size.
    const long = alone(sentence, words("a".repeat(40), "it"), tiktok);
    expect(long.size).toBeLessThan(64);
    expect(long.gap).toBe(Math.round(spaceEm("tiktok", 600) * long.size));
    expect(() => spaceEm("tiktok", 650)).toThrow(/tiktok.*650/);
  });

  it("keeps the 0.34 em gap for plain with no weight, and for pill, pop and highlight with or without one", () => {
    for (const look of CAPTION_LOOKS) {
      for (const weight of [undefined, 600] as const) {
        if (look === "plain" && weight !== undefined) continue;
        const captions: Captions = { ...DEFAULT_CAPTIONS, look, size: 64, ...(weight === undefined ? {} : { weight }) };
        expect(sentenceSet(captions), `${look} ${weight}`).toBe(false);
        expect(alone(captions, words("we", "go", "now")).gap, `${look} ${weight}`).toBe(Math.round(0.34 * 64));
      }
    }
  });

  it("gives a sentence a thinner edge than the bold looks", () => {
    expect(PLAIN_EDGE).toBe(0.05); // ruled by eye from 0.05, 0.06 and 0.07 (2026-11-24)
    expect(edgeOf({ look: "plain", weight: 600 }, 64)).toBe(PLAIN_EDGE * 64);
    expect(edgeOf({ look: "plain", weight: 600 }, 64)).toBeLessThan(0.09 * 64);
    expect(edgeOf({ look: "plain" }, 64)).toBe(0.09 * 64);
    for (const look of ["pop", "highlight"] as const) {
      expect(edgeOf({ look }, 64), look).toBe(0.09 * 64);
      expect(edgeOf({ look, weight: 600 }, 64), look).toBe(0.09 * 64);
    }
    expect(edgeOf({ look: "pill" }, 64)).toBe(0);
    expect(edgeOf({ look: "pill", weight: 600 }, 64)).toBe(0);
  });
});

describe("a title's box", () => {
  it("shrinks a long title from 220 to the size fitLines gives, on at most three lines", () => {
    // 9 words, 54 characters. On three lines the most even breaking is "Seven small habits" | "that make every" |
    // "single video better": its longest line is 19 characters, 9.5 px for each px of type, so the type is
    // floor(928 / 9.5) = 97 in a box of even(0.86 × 1080) = 928.
    const props = title({ text: "Seven small habits that make every single video better", size: 220 });
    const box = titleBox(props, fixed);
    const all = markedWords(props.text);
    const widthOf = (from: number, to: number) => fixed(all.slice(from, to).map((word) => word.text).join(" "), 800, 100) / 100;
    expect(fitLines(all.length, 3, 928, 220, 0, widthOf)).toEqual({ size: 97, breaks: [0, 3, 6] });
    expect(box).toMatchObject({ size: 97, breaks: [0, 3, 6] });
    // Its widest line, 19 × 48.5 = 921.5, is 922 in whole even pixels; three lines of even(97 × 1.12) = 108.
    expect(box).toMatchObject({ w: 922, h: 3 * 108, x: 540 - 461, y: 960 - 162 });
  });

  it("keeps the type as asked when it fits, and a label's padding inside its box", () => {
    // A label is 700 and measured in a box of even(0.78 × 1080) = 842. "A label" at 150 is 525, 526 in even
    // pixels, with round(0.4 × 150) = 60 at each end; a label's line is even(150 × 1.4) = 210.
    const box = titleBox(title({ text: "A *label*", look: "label", size: 150, y: 0.3 }), fixed);
    expect(box).toMatchObject({ size: 150, breaks: [0], w: 526 + 120, h: 210, x: 540 - 323, y: 576 - 105 });
  });

  it("starts a label line wider than its box at the box's left, as the browser sets a block too wide for its room", () => {
    // 10 letters at 0.3042 of the size: they fit 842 at floor(842 / (3.042 + 0.8)) = 219, where they are 666.2, so
    // 668 in even pixels, and the padding is round(0.4 × 219) = 88 at each end: 844, two more than the box of 842.
    // A browser does not centre that line: it starts at the box's left, 540 − 842 / 2 = 119 (Chromium and WebKit, 2026-11-21).
    const tight: Measure = (text, _weight, size) => text.length * size * 0.3042;
    const box = titleBox(title({ text: "abcdefghij", look: "label", size: 220 }), tight);
    expect(box).toMatchObject({ size: 219, room: 842, side: 88, w: 844, x: 119 });
  });

  it("is held inside the stage near its top", () => {
    // One line of even(120 × 1.12) = 134 at y 0 is held at 67 + 0.02 × 1920 = 105.4 from the top, so centred on 105.
    const box = titleBox(title({ text: "Up top", y: 0 }), fixed);
    expect(box).toMatchObject({ h: 134, y: 105 - 67 });
  });

  it("sets a title at its own weight, and with none at 700 for a label and 800 for the others", () => {
    for (const look of ["bold", "label", "outline"] as const) expect(titleBox(title({ look, weight: 600 }), fixed).weight, look).toBe(600);
    expect(titleWeight({ look: "label" })).toBe(700);
    expect(titleWeight({ look: "bold" })).toBe(800);
    expect(titleWeight({ look: "outline" })).toBe(800);
    // The weight it is measured at is the one it is set in.
    const at: number[] = [];
    titleBox(title({ look: "label", weight: 500 }), (text, weight, size) => (at.push(weight), fixed(text, weight, size)));
    expect(new Set(at)).toEqual(new Set([500]));
  });
});

describe("a call-out's box", () => {
  it("is centred where it is put", () => {
    // "Look here" at 150: 675, 676 in even pixels, one line of even(150 × 1.1) = 166.
    const box = calloutBox(callout(), fixed);
    expect(box).toMatchObject({ size: 150, w: 676, h: 166 });
    expect([box.x + box.w / 2, box.y + box.h / 2]).toEqual([540, 576]);
  });

  it("is fitted to the stage's width, its padding counted", () => {
    // 40 characters are 2000 wide at 100, so they fit 0.9 × 1080 at 48.6; a label keeps 0.36 of its size at each
    // side, so it is set at floor(48.6 / 1.72) = 28.
    expect(calloutBox(callout({ text: "x".repeat(40), look: "label", size: 200 }), fixed).size).toBe(28);
  });

  it("is held inside the stage near its right edge", () => {
    // Half of it is 338 + 0.06 × 150 for the outline; its centre may come no nearer the edge than 0.97 × 1080 − 347 = 700.6.
    const box = calloutBox(callout({ x: 1 }), fixed);
    expect(box.x + box.w / 2).toBe(701);
  });

  it("sets a call-out at its own weight, and with none at 800, as before", () => {
    expect(calloutWeight({})).toBe(800);
    expect(calloutWeight({ weight: 600 })).toBe(600);
    // With no weight, the box it gave before (2026-11-24): "Look here" at 100 is 450 wide, even 450, with round(0.36 × 100)
    // = 36 at each side; even(100 × 1.42) = 142 tall; centred on 540 and round(0.3 × 1920) = 576.
    const label = callout({ look: "label", size: 100 });
    expect(calloutBox(label, fixed)).toEqual({ size: 100, weight: 800, side: 36, x: 279, y: 505, w: 522, h: 142 });
    // A measure that grows with the weight: lighter letters are narrower, so the box is.
    const heavier: Measure = (text, weight, size) => text.length * size * 0.5 * (weight / 800);
    const at600 = calloutBox({ ...label, weight: 600 }, heavier);
    expect(at600.weight).toBe(600);
    expect(at600.size).toBe(100);
    expect(at600.w).toBeLessThan(calloutBox({ ...label, weight: 800 }, heavier).w);
    expect(calloutBox({ ...label, weight: 800 }, heavier)).toEqual(calloutBox(label, heavier));
    // The weight it is measured at is the one it is set in.
    const at: number[] = [];
    calloutBox({ ...label, weight: 600 }, (text, weight, size) => (at.push(weight), fixed(text, weight, size)));
    expect(new Set(at)).toEqual(new Set([600]));
  });
});

describe("the progress bar's box", () => {
  it("sits at the top or the bottom of the stage, the stage's width wide", () => {
    expect(progressBox({ edge: "top", color: "#ffffff" })).toEqual({ x: 0, y: 0, w: STAGE.w, h: 12 });
    expect(progressBox({ edge: "bottom", color: "#ffffff" })).toEqual({ x: 0, y: STAGE.h - 12, w: STAGE.w, h: 12 });
  });
});
