import { describe, expect, it } from "vitest";
import type { SaidWord } from "../../../lib/edit";
import { evenGroups, pagesFor, pagesOf } from "../pages";

const word = (text: string, from: number, to: number): SaidWord => ({ text, from, to, stress: false });
const texts = (words: SaidWord[], maxWords = 3, runFrames = 600) => pagesOf(words, maxWords, runFrames, false).map((page) => page.words.map((w) => w.text).join(" "));

describe("caption pages", () => {
  const speech = [word("Right", 0, 10), word("then,", 10, 20), word("you", 20, 26), word("start", 26, 32), word("building", 32, 48), word("it", 48, 54), word("now.", 54, 66)];

  it("puts at most so many words on a page", () => {
    expect(texts(speech, 3)).toEqual(["Right then, you", "start building it", "now."]);
    expect(texts(speech, 2)).toEqual(["Right then,", "you start", "building it", "now."]);
    expect(texts(speech, 6)).toEqual(["Right then, you start building it", "now."]);
  });

  it("starts a new page after a pause of four tenths of a second, and after the end of a sentence", () => {
    expect(texts([word("One", 0, 10), word("two", 10, 20), word("three", 32, 40)])).toEqual(["One two", "three"]); // 12 frames of silence
    expect(texts([word("One", 0, 10), word("two", 10, 20), word("three", 31, 40)])).toEqual(["One two three"]); // 11 frames
    expect(texts([word("Done.", 0, 10), word("Next", 10, 20), word("one!", 20, 30), word("Then", 30, 40)])).toEqual(["Done.", "Next one!", "Then"]);
  });

  it("shows a page from its first word until the next page starts, or a third of a second after its last word", () => {
    const pages = pagesOf([word("One", 5, 10), word("two", 10, 20), word("three", 40, 50)], 3, 600, false);
    expect(pages.map((page) => [page.from, page.to])).toEqual([[5, 30], [40, 60]]);
    const close = pagesOf([word("One.", 5, 10), word("Two", 12, 20)], 3, 600, false);
    expect(close.map((page) => [page.from, page.to])).toEqual([[5, 12], [12, 30]]);
  });

  it("never shows a page past the end of its run, and makes none of no words", () => {
    expect(pagesOf([word("Last", 95, 100)], 3, 100, false).map((page) => [page.from, page.to])).toEqual([[95, 100]]);
    expect(pagesOf([], 3, 100, false)).toEqual([]);
  });

  it("keeps the words as they were given, stress and all", () => {
    const stressed = { ...word("now", 0, 10), stress: true };
    expect(pagesOf([stressed], 3, 100, false)[0]!.words).toEqual([stressed]);
  });
});

/** The words said back to back, ten frames each, from frame 0; `gaps` puts a silence of so many frames before a word. */
const said = (texts: string[], gaps: Record<number, number> = {}): SaidWord[] => {
  let at = 0;
  return texts.map((text, i) => {
    at += gaps[i] ?? 0;
    const made = word(text, at, at + 10);
    at += 10;
    return made;
  });
};
const even = (words: SaidWord[], maxWords: number) => pagesOf(words, maxWords, 6000, true).map((page) => page.words.map((w) => w.text).join(" "));

describe("caption pages, evened out", () => {
  it("sets a stretch on the fewest pages and leaves no page of one word beside a full one", () => {
    expect(even(said(["Your", "plan", "is", "ready", "this", "week."]), 5)).toEqual(["Your plan is", "ready this week."]);
    expect(even(said(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]), 5)).toEqual(["a b c d e", "f g h i j"]);
    expect(even(said(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"]), 5)).toEqual(["a b c", "d e f g", "h i j k"]);
    expect(even(said(["a", "b", "c"]), 5)).toEqual(["a b c"]);
  });

  it("takes the earlier break when two cuts are as even", () => {
    expect(even(said(["a", "b", "c", "d", "e", "f", "g"]), 5)).toEqual(["a b c", "d e f g"]);
  });

  it("prefers a break after a comma, a semicolon or a colon, but never for a page of one word", () => {
    expect(even(said(["a", "b", "c,", "d", "e", "f", "g", "h"]), 5)).toEqual(["a b c,", "d e f g h"]);
    expect(even(said(["a", "b;", "c", "d", "e", "f"]), 5)).toEqual(["a b;", "c d e f"]);
    expect(even(said(["a:", "b", "c", "d", "e", "f"]), 5)).toEqual(["a: b c", "d e f"]);
    expect(even(said(["a", "b", "c", "d,", "e", "f", "g", "h", "i", "j"]), 5)).toEqual(["a b c d, e", "f g h i j"]); // the cap comes first
  });

  it("prefers the break in the longer silence between two cuts as even", () => {
    expect(even(said(["a", "b", "c", "d", "e", "f", "g"], { 4: 8 }), 5)).toEqual(["a b c d", "e f g"]); // 8 frames before the fifth word
  });

  it("takes the break after a clause's end over a break in a silence when the two pull different ways", () => {
    expect(even(said(["a", "b", "c,", "d", "e", "f", "g"], { 4: 8 }), 5)).toEqual(["a b c,", "d e f g"]); // the comma is worth more than 8 frames
  });

  it("takes the earlier break on a later page too when two cuts are as even", () => {
    expect(even(said(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]), 4)).toEqual(["a b c", "d e f", "g h i j"]); // not "d e f g", "h i j"
  });

  it("still starts a page after a pause of four tenths of a second and after the end of a sentence", () => {
    expect(even(said(["a", "b", "c", "d", "e", "f"], { 4: 12 }), 5)).toEqual(["a b c d", "e f"]);
    expect(even(said(["a", "b.", "c", "d", "e", "f", "g", "h"]), 5)).toEqual(["a b.", "c d e", "f g h"]);
  });

  it("times an evened page as every page is timed", () => {
    const pages = pagesOf(said(["a", "b", "c", "d", "e", "f"]), 5, 6000, true);
    expect(pages.map((page) => [page.from, page.to])).toEqual([[0, 30], [30, 70]]); // the second holds a third of a second after its last word
  });

  it("pages as before with `false`", () => {
    expect(pagesOf(said(["a", "b", "c", "d", "e", "f"]), 5, 6000, false).map((page) => page.words.length)).toEqual([5, 1]);
  });

  it("leaves no word alone on a page where a cut without one exists, at three a page a comma notwithstanding (the fix wave, F5)", () => {
    // Seven words back to back, a comma after the sixth: the comma's break would leave the seventh alone (3 + 3 + 1). Of the
    // cuts with no page of one word, 2 + 2 + 3, 2 + 3 + 2 and 3 + 2 + 2 are as even; the earlier break stands.
    expect(even(said(["Fold", "the", "map", "along", "the", "edge,", "slowly"]), 3)).toEqual(["Fold the", "map along", "the edge, slowly"]);
    expect(even(said(["Fold", "the", "map", "along", "the", "edge", "slowly"]), 3)).toEqual(["Fold the", "map along", "the edge slowly"]);
    // Where one cannot be avoided (five words at two a page), every word is still paged: one alone, then two and two.
    expect(even(said(["a", "b", "c", "d", "e"]), 2)).toEqual(["a", "b c", "d e"]);
  });

  it("sets each word on its own page at one a page without building its tables: 4,000 words in well under 50 ms (the fix wave, F6)", () => {
    const words = Array.from({ length: 4000 }, (_, i) => word(`w${i}`, i * 10, i * 10 + 10));
    const started = performance.now();
    const groups = evenGroups(words, 1);
    expect(performance.now() - started).toBeLessThan(50);
    expect(groups).toEqual(words.map((each) => [each]));
  });
});

describe("pagesFor", () => {
  const words = said(["a", "b", "c", "d", "e", "f"]);
  const lengths = (captions: Parameters<typeof pagesFor>[0]) => pagesFor(captions, words, 6000).map((page) => page.words.length);

  it("evens the pages of captions set as a sentence, and of no others", () => {
    expect(lengths({ look: "plain", weight: 600, maxWords: 5 })).toEqual([3, 3]);
    expect(lengths({ look: "plain", weight: undefined, maxWords: 5 })).toEqual([5, 1]);
    expect(lengths({ look: "pill", weight: 600, maxWords: 5 })).toEqual([5, 1]);
    expect(lengths({ look: "pop", weight: 800, maxWords: 5 })).toEqual([5, 1]);
  });
});
