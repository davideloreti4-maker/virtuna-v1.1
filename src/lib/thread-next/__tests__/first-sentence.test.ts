import { describe, expect, it } from "vitest";

import { FOLD_MAX, firstSentence, foldLead } from "../first-sentence";

/**
 * `foldLead` — what a folded text shows before "More" (the details sheet's "Why it works" and "Why
 * it fits"). `firstSentence` itself is exercised through the idea and fallback lines' tests; one
 * case here pins what `foldLead` builds on. PURE (default `node` env).
 */

describe("firstSentence", () => {
  it("ends at the first real sentence end, and gives the whole text when there is only one", () => {
    expect(firstSentence("It opens on a failure. Then it pays off.")).toBe("It opens on a failure.");
    expect(firstSentence("It opens on a failure.")).toBe("It opens on a failure.");
  });
});

describe("foldLead", () => {
  const LONG =
    "The contrarian prediction error contradicts the mundane expectation of 'meal prep' by introducing an absurd, high-production spectacle (a cooking robot), leveraging the cross-niche curiosity viewer's attraction to scale and weirdness before pivoting to the actual student context.";

  it("a short first sentence, when the text goes on: that sentence", () => {
    expect(foldLead("It breaks the idea that meal prep means expensive wellness culture. Students expect the opposite.")).toBe(
      "It breaks the idea that meal prep means expensive wellness culture.",
    );
  });

  it("one short sentence, or nothing, needs no fold", () => {
    expect(foldLead("It opens on a failure.")).toBeNull();
    expect(foldLead("   ")).toBeNull();
  });

  it("one long sentence is cut at a whole word inside the limit and ends on …", () => {
    const lead = foldLead(LONG)!;
    expect(lead.endsWith("…")).toBe(true);
    expect(lead.length).toBeLessThanOrEqual(FOLD_MAX + 1);
    const words = lead.slice(0, -1);
    expect(LONG.startsWith(words)).toBe(true);
    // Never mid-word: the whole text goes on with a space, or with punctuation that was trimmed.
    expect(LONG.slice(words.length)).toMatch(/^[\s,;:.!?(-]/);
    // Never ends on punctuation or an open bracket before the ….
    expect(words).not.toMatch(/[\s,;:.!?(-]$/);
  });

  it("a long first sentence followed by more is cut the same way", () => {
    const lead = foldLead(`${LONG} And a second sentence.`)!;
    expect(lead.endsWith("…")).toBe(true);
    expect(lead.length).toBeLessThanOrEqual(FOLD_MAX + 1);
  });

  it("a text exactly at the limit is whole; a word over is cut back to it", () => {
    const at = `${"word ".repeat(23)}words`;
    expect(at).toHaveLength(FOLD_MAX);
    expect(foldLead(at)).toBeNull();
    expect(foldLead(`${at} more`)).toBe(`${at}…`);
  });

  it("one long token is cut at the limit", () => {
    expect(foldLead("a".repeat(200))).toBe(`${"a".repeat(FOLD_MAX)}…`);
  });
});
