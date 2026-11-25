import { describe, expect, it } from "vitest";
import { evenBreaks, fitLines, longest, markedWords, rowsWithin } from "../lines";

/** Words of the given widths set on a line with one unit between them. */
const widths = (...each: number[]) => (from: number, to: number) => each.slice(from, to).reduce((sum, w) => sum + w, 0) + Math.max(0, to - from - 1);

describe("breaking words into lines that are as even as can be", () => {
  it("puts everything on one line when one is asked for", () => {
    expect(evenBreaks(4, 1, widths(4, 2, 3, 5))).toEqual([0]);
  });

  it("breaks where the longest line comes out shortest", () => {
    // 4 2 | 3 5 gives 7 and 9; 4 | 2 3 5 gives 4 and 12; 4 2 3 | 5 gives 11 and 5.
    expect(evenBreaks(4, 2, widths(4, 2, 3, 5))).toEqual([0, 2]);
    // Three lines of six words: 5 5 | 5 5 | 5 5 is 11 each; anything else has a line of 17.
    expect(evenBreaks(6, 3, widths(5, 5, 5, 5, 5, 5))).toEqual([0, 2, 4]);
    // A long word stands alone: 9 | 2 2 2 gives 9 and 8.
    expect(evenBreaks(4, 2, widths(9, 2, 2, 2))).toEqual([0, 1]);
  });

  it("gives every word a line of its own when as many lines as words are asked for, and no more lines than words", () => {
    expect(evenBreaks(3, 3, widths(1, 2, 3))).toEqual([0, 1, 2]);
    expect(evenBreaks(2, 5, widths(1, 2))).toEqual([0, 1]);
    expect(evenBreaks(0, 2, widths())).toEqual([]);
  });

  it("evens out the other lines too when one long word decides the longest line whatever is done", () => {
    // "It is so very much unbelievable": the last word is 76 wide and stands alone. Before it,
    // 10 8 10 | 20 23 gives 30 and 44; 10 8 10 20 | 23 would give 51 and 23, with a word left by itself.
    expect(evenBreaks(6, 3, widths(10, 8, 10, 20, 23, 76))).toEqual([0, 3, 5]);
  });

  it("fills the earlier line when two ways are equally good", () => {
    // 3 3 | 3 and 3 | 3 3 both have a longest line of 7.
    expect(evenBreaks(3, 2, widths(3, 3, 3))).toEqual([0, 2]);
  });

  it("is not swayed by a difference too small to see: two browsers measure the same word a hair apart, and must still break alike", () => {
    // 3 3 | 3.02 has a longest line of 7; 3 | 3 3.02 one of 7.02. And the other way round.
    expect(evenBreaks(3, 2, widths(3, 3, 3.02))).toEqual([0, 2]);
    expect(evenBreaks(3, 2, widths(3.02, 3, 3))).toEqual([0, 2]);
    // A difference one can see does decide: 3 | 3 2 is 6 at most, 3 3 | 2 is 7.
    expect(evenBreaks(3, 2, widths(3, 3, 2))).toEqual([0, 1]);
  });

  it("says how long the longest line of a breaking is", () => {
    expect(longest([0, 2], 4, widths(4, 2, 3, 5))).toBe(9);
    expect(longest([0], 4, widths(4, 2, 3, 5))).toBe(17);
    expect(longest([], 0, widths())).toBe(0);
  });
});

describe("the fewest rows words fit in", () => {
  it("keeps to one row while the words fit, and takes another when they do not", () => {
    expect(rowsWithin(3, 20, widths(5, 5, 5))).toEqual([0]);
    expect(rowsWithin(3, 17, widths(5, 5, 5))).toEqual([0]);
    expect(rowsWithin(3, 16, widths(5, 5, 5))).toEqual([0, 2]);
    expect(rowsWithin(4, 11, widths(5, 5, 5, 5))).toEqual([0, 2]);
    expect(rowsWithin(4, 10, widths(5, 5, 5, 5))).toEqual([0, 1, 2, 3]);
  });

  it("gives a word wider than the room a row of its own, and says nothing more: making it fit is the caller's", () => {
    expect(rowsWithin(3, 6, widths(9, 2, 2))).toEqual([0, 1]);
    expect(rowsWithin(1, 6, widths(9))).toEqual([0]);
    expect(rowsWithin(0, 6, widths())).toEqual([]);
  });
});

describe("setting a block of words as large as the room allows", () => {
  // Widths for one pixel of type size of four made-up words, "Grab a pen today", with a quarter of the size between words.
  const hook = (from: number, to: number) => [2.2, 0.9, 1.5, 2.6].slice(from, to).reduce((sum, w) => sum + w, 0) + 0.25 * Math.max(0, to - from - 1);

  it("takes the fewest lines that let the type be as large as asked", () => {
    // One line is 7.95 wide: at 120 it would need 954 of the 928 there are. Two lines, "Grab a" and "pen today", need 522.
    expect(fitLines(4, 3, 928, 120, 0, hook)).toEqual({ size: 120, breaks: [0, 2] });
    // In a wider room one line does.
    expect(fitLines(4, 3, 1000, 120, 0, hook)).toEqual({ size: 120, breaks: [0] });
  });

  it("uses every line it may and sets the type smaller when the words are too many for the size asked, in whole pixels", () => {
    // Nine words of 3 with a quarter between them: three lines of three are 9.5 wide, so 928 / 9.5 = 97.68.
    const nine = (from: number, to: number) => 3 * (to - from) + 0.25 * Math.max(0, to - from - 1);
    expect(fitLines(9, 3, 928, 120, 0, nine)).toEqual({ size: 97, breaks: [0, 3, 6] });
    // With room kept free at both ends of every line (0.4 of the size each): 928 / (9.5 + 0.8) = 90.09.
    expect(fitLines(9, 3, 928, 120, 0.8, nine)).toEqual({ size: 90, breaks: [0, 3, 6] });
  });

  it("sets one long word that cannot be broken as large as fits", () => {
    expect(fitLines(1, 3, 928, 120, 0, () => 30)).toEqual({ size: 30, breaks: [0] });
  });

  it("gives nothing to set for no words", () => {
    expect(fitLines(0, 3, 928, 120, 0, () => 0)).toEqual({ size: 120, breaks: [] });
  });
});

describe("the words of a title, and which of them are marked", () => {
  it("splits at spaces and marks what stands between asterisks", () => {
    expect(markedWords("Grab a pen *today*")).toEqual([
      { text: "Grab", bits: [{ text: "Grab", marked: false }] },
      { text: "a", bits: [{ text: "a", marked: false }] },
      { text: "pen", bits: [{ text: "pen", marked: false }] },
      { text: "today", bits: [{ text: "today", marked: true }] },
    ]);
  });

  it("carries a mark over several words, and over a part of one", () => {
    expect(markedWords("so *very much* more").map((word) => [word.text, word.bits.map((bit) => bit.marked)])).toEqual([["so", [false]], ["very", [true]], ["much", [true]], ["more", [false]]]);
    expect(markedWords("un*believ*able")).toEqual([{ text: "unbelievable", bits: [{ text: "un", marked: false }, { text: "believ", marked: true }, { text: "able", marked: false }] }]);
  });

  it("takes any run of spaces as one, and has no word for none", () => {
    expect(markedWords("  two   words ").map((word) => word.text)).toEqual(["two", "words"]);
    expect(markedWords("* *")).toEqual([]);
  });
});
