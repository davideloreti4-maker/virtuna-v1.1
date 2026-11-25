import { describe, expect, it } from "vitest";

import { stripUserContentMarkers } from "../user-content-markers";

const OPEN = "<<<USER_CONTENT>>>";
const CLOSE = "<<<END_USER_CONTENT>>>";
const MARKERS = [OPEN, CLOSE] as const;
const hasMarker = (text: string) => /<<<(?:END_)?USER_CONTENT>>>/i.test(text);

/** Texts in which markers and parts of markers stand next to each other in every arrangement of two. */
function arrangements(): string[] {
  const out: string[] = [];
  for (const outer of MARKERS) {
    for (const inner of MARKERS) {
      for (let at = 0; at <= outer.length; at++) out.push(outer.slice(0, at) + inner + outer.slice(at));
    }
  }
  return out;
}

describe("stripUserContentMarkers", () => {
  it("removes each marker, in any letter case", () => {
    expect(stripUserContentMarkers(`a${OPEN}b`)).toBe("ab");
    expect(stripUserContentMarkers(`a${CLOSE}b`)).toBe("ab");
    expect(stripUserContentMarkers(`a${OPEN.toLowerCase()}b${CLOSE.toLowerCase()}c`)).toBe("abc");
  });

  it("leaves ordinary text as it is", () => {
    for (const text of ["", "plain words", "a < b << c >>> d", "USER_CONTENT", "<<<USER CONTENT>>>", "<<USER_CONTENT>>"]) {
      expect(stripUserContentMarkers(text)).toBe(text);
    }
  });

  it("leaves no marker behind, however the text is put together", () => {
    for (const text of arrangements()) {
      const cleaned = stripUserContentMarkers(`before ${text} after`);
      expect(hasMarker(cleaned), text).toBe(false);
    }
  });

  it("leaves no marker behind in a long text of repeated arrangements", () => {
    const text = arrangements().join(" x ").repeat(20);
    expect(hasMarker(stripUserContentMarkers(text))).toBe(false);
  });

  it("is settled: cleaning its own result changes nothing", () => {
    for (const text of arrangements()) {
      const once = stripUserContentMarkers(text);
      expect(stripUserContentMarkers(once)).toBe(once);
    }
  });
});
