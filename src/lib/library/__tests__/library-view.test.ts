/**
 * The Library's view in its address (plan 2026-11-23-library):
 * `/library?filter=simulated&q=meal`, `filter` left out for All and `q` when empty; anything the
 * page does not know reads as All. Pure.
 */
import { describe, expect, it } from "vitest";

import { LIBRARY_PATH, LIBRARY_Q_MAX, libraryHref, librarySearchText, libraryViewOf } from "../library-view";

// The server cuts a search at 80 characters (`LIBRARY_SEARCH_MAX`); the address does
// too, so a very long paste cannot make an address too long to load.
const LONG = "meal prep ".repeat(12); // 120 characters
const CUT = Array.from(LONG).slice(0, 80).join("").trim();

describe("the search text in the address: at most 80 characters", () => {
  it("is 80, the server's cut", () => {
    expect(LIBRARY_Q_MAX).toBe(80);
  });

  it("librarySearchText trims and cuts at 80 whole characters", () => {
    expect(librarySearchText("  meal  ")).toBe("meal");
    expect(librarySearchText(LONG)).toBe(CUT);
    expect(librarySearchText(LONG).length).toBeLessThanOrEqual(80);
    // Whole characters: an emoji is never cut in half.
    const emoji = "😀".repeat(100);
    expect(Array.from(librarySearchText(emoji))).toHaveLength(80);
    expect(librarySearchText(emoji)).toBe("😀".repeat(80));
  });

  it("libraryViewOf reads at most 80", () => {
    expect(libraryViewOf({ q: LONG }).q).toBe(CUT);
  });

  it("libraryHref writes at most 80", () => {
    const href = libraryHref({ filter: "drafts", q: LONG });
    expect(new URL(href, "http://localhost").searchParams.get("q")).toBe(CUT);
    expect(libraryViewOf(Object.fromEntries(new URL(href, "http://localhost").searchParams))).toEqual({ filter: "drafts", q: CUT });
  });
});

describe("libraryViewOf", () => {
  it("no parameters: All, no search", () => {
    expect(libraryViewOf({})).toEqual({ filter: "all", q: "" });
    expect(libraryViewOf(undefined)).toEqual({ filter: "all", q: "" });
  });

  // After posting (plan 2026-11-24-after-posting, Task 4): a fifth chip, Posted.
  it.each(["all", "drafts", "simulated", "posted", "saved"] as const)("reads the chip %s", (filter) => {
    expect(libraryViewOf({ filter })).toEqual({ filter, q: "" });
  });

  it.each(["", "SIMULATED", "Posted", "post", "constructor", "__proto__"])("an unknown chip %j reads as All", (filter) => {
    expect(libraryViewOf({ filter }).filter).toBe("all");
  });

  it("reads the search text, trimmed", () => {
    expect(libraryViewOf({ filter: "simulated", q: "  meal prep " })).toEqual({ filter: "simulated", q: "meal prep" });
  });

  it("a repeated parameter counts once: its first value", () => {
    expect(libraryViewOf({ filter: ["drafts", "simulated"], q: ["meal", "gym"] })).toEqual({ filter: "drafts", q: "meal" });
  });
});

describe("libraryHref", () => {
  it("All and no search is the bare address", () => {
    expect(LIBRARY_PATH).toBe("/library");
    expect(libraryHref({ filter: "all", q: "" })).toBe("/library");
  });

  it("carries the chip, then the search", () => {
    expect(libraryHref({ filter: "simulated", q: "" })).toBe("/library?filter=simulated");
    expect(libraryHref({ filter: "all", q: "meal" })).toBe("/library?q=meal");
    expect(libraryHref({ filter: "drafts", q: "meal prep & more" })).toBe("/library?filter=drafts&q=meal+prep+%26+more");
  });

  it("carries the Posted chip and reads it back", () => {
    expect(libraryHref({ filter: "posted", q: "" })).toBe("/library?filter=posted");
    expect(libraryViewOf(Object.fromEntries(new URL(libraryHref({ filter: "posted", q: "meal" }), "http://localhost").searchParams))).toEqual({
      filter: "posted",
      q: "meal",
    });
  });

  it("a blank search is left out", () => {
    expect(libraryHref({ filter: "saved", q: "   " })).toBe("/library?filter=saved");
  });

  it("reads back what it writes", () => {
    const view = { filter: "simulated", q: "100% real?" } as const;
    const params = Object.fromEntries(new URL(libraryHref(view), "http://localhost").searchParams);
    expect(libraryViewOf(params)).toEqual(view);
  });
});
