import { describe, it, expect } from "vitest";
import { stripWrappingQuotes } from "@/lib/utils";

/**
 * The verbatim-quoting boundary.
 *
 * Every surface that shows something a person "said" — an audience quote, a behavioral tell's
 * evidence, a persona's reasoning — wraps the value in typographic quotes the COMPONENT owns,
 * so the mark matches the design system. A model that ALSO quotes its own string produced
 * ""doubled quotes like this"", seen live on Profile Read's evidence lines: it reads as a
 * rendering fault, and a verbatim that looks broken stops sounding like a real person.
 *
 * This strips at most ONE matched wrapping pair, so the component can always add exactly one
 * back. What it must NOT do is corrupt the sentence: an internal quotation and a lone
 * apostrophe are part of what the person said.
 */
describe("stripWrappingQuotes", () => {
  it("strips the wrapping pair a model added — the doubled-quote bug", () => {
    expect(stripWrappingQuotes('"I\'d need to double-check before I could sign off on that."'))
      .toBe("I'd need to double-check before I could sign off on that.");
  });

  it("strips curly quotes too (models emit typographic marks, not just straight ones)", () => {
    expect(stripWrappingQuotes("“Fast and to the point.”")).toBe("Fast and to the point.");
  });

  it("leaves an unquoted string alone — the common case must be a no-op", () => {
    expect(stripWrappingQuotes("Warms to low-risk, reversible pilots.")).toBe(
      "Warms to low-risk, reversible pilots.",
    );
  });

  it("preserves an INTERNAL quotation — that is part of what they said", () => {
    expect(stripWrappingQuotes('He said "no" and left.')).toBe('He said "no" and left.');
  });

  it("preserves a one-sided quote rather than eating a real character", () => {
    expect(stripWrappingQuotes('"Wait, is that true?')).toBe('"Wait, is that true?');
    expect(stripWrappingQuotes("It's fine.")).toBe("It's fine.");
  });

  it("does not mangle a mismatched pair (opens curly, closes straight)", () => {
    expect(stripWrappingQuotes("“momentum stalls\"")).toBe("“momentum stalls\"");
  });

  it("strips only ONE layer — the component adds exactly one back", () => {
    expect(stripWrappingQuotes('""double wrapped""')).toBe('"double wrapped"');
  });

  it("tolerates nullish and empty input (optional quote fields render as nothing)", () => {
    expect(stripWrappingQuotes(undefined)).toBe("");
    expect(stripWrappingQuotes(null)).toBe("");
    expect(stripWrappingQuotes('"')).toBe('"');
  });
});
