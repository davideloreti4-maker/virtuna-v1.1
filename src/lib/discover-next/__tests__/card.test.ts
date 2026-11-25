/**
 * A video's card (the placeholders measured on the live
 * library 2026-11-25): the spoken line it shows (or none), its badge, its meta and its name. Pure.
 */
import { describe, expect, it } from "vitest";

import { badgeOf, cardLine, cardMetaParts, cardName, lineOf } from "../card";
import type { CardVideo } from "../hub-data";

function card(over: Partial<CardVideo> = {}): CardVideo {
  return {
    id: "v1",
    coverUrl: null,
    handle: "dev.lifts",
    spokenHook: "I lifted every day for a year",
    niche: "health-fitness",
    platform: "tiktok",
    views: 39_800_000,
    postedAt: null,
    multiplier: 27,
    baselineLabel: "vs their usual views",
    proven: true,
    extreme: false,
    formats: [],
    ...over,
  };
}

describe("cardLine: the spoken line, or none", () => {
  it("a normal line, with its period, whitespace collapsed and trimmed", () => {
    expect(cardLine("This changed how I cook.")).toBe("This changed how I cook.");
    expect(cardLine("  Stop   scrolling,\n read this. ")).toBe("Stop scrolling, read this.");
  });

  it("empty, blank or missing: none", () => {
    expect(cardLine("")).toBeNull();
    expect(cardLine("   ")).toBeNull();
    expect(cardLine(null)).toBeNull();
    expect(cardLine(undefined)).toBeNull();
  });

  it("a line with no letter: none", () => {
    expect(cardLine("🔥🔥")).toBeNull();
    expect(cardLine("...")).toBeNull();
    expect(cardLine("100%!!")).toBeNull();
  });

  it("a line with a letter in any script is kept", () => {
    expect(cardLine("¿Qué pasó?")).toBe("¿Qué pasó?");
    expect(cardLine("🔥 wow")).toBe("🔥 wow");
  });

  it("any [...], {...} or <...> part: none (fill-in slots and notes)", () => {
    expect(cardLine("[Product] changed my life")).toBeNull();
    expect(cardLine("This [thing] is wild")).toBeNull();
    expect(cardLine("[No speech; music only]")).toBeNull();
    expect(cardLine("Here is my {product}")).toBeNull();
    expect(cardLine("Try <brand> today")).toBeNull();
    expect(cardLine("[]")).toBeNull();
  });

  it("a bracket that never closes is not a slot", () => {
    expect(cardLine("I <3 you")).toBe("I <3 you");
  });

  it.each(["null", "NULL", "Null", "none", "None", "NONE", "n/a", "N/A", "  n/a  "])("the whole line %j: none", (line) => {
    expect(cardLine(line)).toBeNull();
  });

  it("those words inside a real line are kept", () => {
    expect(cardLine("None of this matters")).toBe("None of this matters");
    expect(cardLine("Null and void, they said")).toBe("Null and void, they said");
  });

  it.each([
    "(None - the video opens on text)",
    "(none — infer from the caption)",
    "(No spoken audio; the hook is visual)",
    "(Inferred): you need this",
    "(INFERRED) a line",
    "(no speech)",
  ])("a note in round brackets at the start (%j): none", (line) => {
    expect(cardLine(line)).toBeNull();
  });

  it("a line that starts with another bracketed word is kept", () => {
    expect(cardLine("(coughs) Was that a cough?")).toBe("(coughs) Was that a cough?");
    expect(cardLine("(Nope) not today")).toBe("(Nope) not today");
    expect(cardLine("(Nonetheless) I tried")).toBe("(Nonetheless) I tried");
  });
});

describe("badgeOf", () => {
  it("not proven: no badge", () => {
    expect(badgeOf(card({ proven: false, multiplier: 1.5 }))).toBeNull();
    expect(badgeOf(card({ proven: false, multiplier: null }))).toBeNull();
  });

  it("proven: the multiple", () => {
    expect(badgeOf(card({ multiplier: 5.2 }))).toBe("5.2×");
    expect(badgeOf(card({ multiplier: 27 }))).toBe("27×");
  });

  it("a video that is not extreme at 99.6: 100× (the multiple rounded), not 100×+", () => {
    expect(badgeOf(card({ multiplier: 99.6, extreme: false }))).toBe("100×");
  });

  it("extreme: 100×+", () => {
    expect(badgeOf(card({ multiplier: 100, extreme: true }))).toBe("100×+");
  });

  it("proven with no number (never stored so): no badge", () => {
    expect(badgeOf(card({ multiplier: null }))).toBeNull();
  });
});

describe("cardMetaParts: the handle and the count", () => {
  it("@handle and the views (no decimal from 100K)", () => {
    expect(cardMetaParts(card({ views: 849_100 }))).toEqual({ handle: "@dev.lifts", views: "849K" });
  });

  it("a blank handle is none; a handle stored with its @ is not doubled", () => {
    expect(cardMetaParts(card({ handle: "  " }))).toEqual({ handle: null, views: "39.8M" });
    expect(cardMetaParts(card({ handle: "@dev.lifts" }))).toEqual({ handle: "@dev.lifts", views: "39.8M" });
  });
});

describe("cardName: the accessible name of a card", () => {
  it("the line it shows", () => {
    expect(cardName(card())).toBe("I lifted every day for a year");
  });

  it("no line: Video by @handle", () => {
    expect(cardName(card({ spokenHook: "[Product] changed my life" }))).toBe("Video by @dev.lifts");
    expect(cardName(card({ spokenHook: null, handle: "@dev.lifts" }))).toBe("Video by @dev.lifts");
  });

  it("no line and no handle: Video", () => {
    expect(cardName(card({ spokenHook: "N/A", handle: null }))).toBe("Video");
  });
});

describe("cardMetaParts: the meta in two parts, so the count is never the part cut", () => {
  it("the handle with its @, and the views", () => {
    expect(cardMetaParts(card())).toEqual({ handle: "@dev.lifts", views: "39.8M" });
  });

  it("a missing part is null", () => {
    expect(cardMetaParts(card({ handle: null }))).toEqual({ handle: null, views: "39.8M" });
    expect(cardMetaParts(card({ views: 0 }))).toEqual({ handle: "@dev.lifts", views: null });
    expect(cardMetaParts(card({ handle: " ", views: 0 }))).toEqual({ handle: null, views: null });
  });

});

describe("lineOf: a spoken line by the placeholder rules, a caption as written", () => {
  it("a spoken line goes through the rules", () => {
    expect(lineOf(card({ spokenHook: "[Product] changed my life" }))).toBeNull();
    expect(lineOf(card({ spokenHook: "(No spoken audio; music)" }))).toBeNull();
    expect(lineOf(card({ spokenHook: "  I lifted  every day " }))).toBe("I lifted every day");
  });

  it.each(["[part 2] the reveal", "{day 3} still going", "(no way) this worked", "none of this was planned", "🔥🔥🔥"])(
    "a caption is a creator's own words, kept: %j",
    (caption) => {
      expect(lineOf(card({ spokenHook: caption, captioned: true }))).toBe(caption);
      expect(cardName(card({ spokenHook: caption, captioned: true }))).toBe(caption);
    },
  );

  it("a caption with nothing in it: none", () => {
    expect(lineOf(card({ spokenHook: "   ", captioned: true }))).toBeNull();
    expect(lineOf(card({ spokenHook: null, captioned: true }))).toBeNull();
    expect(cardName(card({ spokenHook: null, captioned: true }))).toBe("Video by @dev.lifts");
  });
});
