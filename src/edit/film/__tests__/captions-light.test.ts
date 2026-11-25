/**
 * Which caption words take the highlight colour (Task 10b, D): in the looks that follow the voice only the word being said, so
 * a page never shows two coloured words; in `plain`, which does not follow it, the stressed words.
 */
import { describe, expect, it } from "vitest";
import { CAPTION_LOOKS } from "../../../lib/edit/doc";
import { wordLight } from "../layout";

/** A page of three words, the middle one stressed, with the word being said at `said`: which are coloured, and which on a box. */
function page(look: (typeof CAPTION_LOOKS)[number], said: number) {
  const words = [false, true, false].map((stressed, i) => wordLight(look, i === said, stressed));
  return { lit: words.flatMap((word, i) => (word.lit ? [i] : [])), boxed: words.flatMap((word, i) => (word.onBox ? [i] : [])) };
}

describe("wordLight: one coloured word on a page that follows the voice", () => {
  it.each(["pill", "pop", "highlight"] as const)("in %s, only the word being said, never the stressed one beside it", (look) => {
    expect(page(look, 0).lit).toEqual([0]);
    expect(page(look, 2).lit).toEqual([2]);
    // The stressed word takes the colour only while it is said.
    expect(page(look, 1).lit).toEqual([1]);
  });

  it("puts only the said word on the box in highlight, and none in the other looks", () => {
    expect(page("highlight", 0).boxed).toEqual([0]);
    for (const look of ["pill", "pop", "plain"] as const) expect(page(look, 0).boxed).toEqual([]);
  });

  it("colours the stressed words in plain, said or not, and no other", () => {
    expect(page("plain", 0).lit).toEqual([1]);
    expect(page("plain", 1).lit).toEqual([1]);
  });

  it("has a rule for every look", () => {
    for (const look of CAPTION_LOOKS) expect(() => wordLight(look, true, true)).not.toThrow();
  });
});
