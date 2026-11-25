import { afterEach, describe, expect, it } from "vitest";
import {
  LANDING_WINDOW_MS,
  afterRows,
  landStyle,
  landedAgo,
  landingGrew,
  landingKeyOf,
  markLanded,
  resetLanding,
  rowLand,
} from "@/lib/thread-next/landing";

afterEach(resetLanding);

const T = 1_000_000;

describe("markLanded and landedAgo", () => {
  it("the window is 1,600 ms", () => {
    expect(LANDING_WINDOW_MS).toBe(1600);
  });

  it("the first mark returns 0; a later mark of the same key the ms since the first", () => {
    expect(markLanded("Hook one", T)).toBe(0);
    expect(markLanded("Hook one", T + 250)).toBe(250);
    // Still counted from the first moment, not the last mark.
    expect(markLanded("Hook one", T + 900)).toBe(900);
  });

  it("landedAgo: the ms since inside the window, null outside it and for a key never marked", () => {
    expect(landedAgo("Hook one", T)).toBeNull();
    markLanded("Hook one", T);
    expect(landedAgo("Hook one", T + 300)).toBe(300);
    expect(landedAgo("Hook one", T + 1600)).toBe(1600);
    expect(landedAgo("Hook one", T + 1601)).toBeNull();
    expect(landedAgo("Another hook", T + 300)).toBeNull();
  });

  it("a second key replaces the first", () => {
    markLanded("Hook one", T);
    expect(markLanded("Hook two", T + 100)).toBe(0);
    expect(landedAgo("Hook one", T + 200)).toBeNull();
    expect(landedAgo("Hook two", T + 200)).toBe(100);
  });

  it("without a clock given, it reads the time itself", () => {
    expect(markLanded("Hook one")).toBe(0);
    const ago = landedAgo("Hook one");
    expect(ago).not.toBeNull();
    expect(ago!).toBeGreaterThanOrEqual(0);
    expect(ago!).toBeLessThan(LANDING_WINDOW_MS);
  });

  it("an answer that grew in place (its cards arriving one by one): the memory answers to the whole answer, from the first moment", () => {
    markLanded("Hook one|1", T);
    landingGrew("Hook one|1", "Hook one|3");
    expect(landedAgo("Hook one|3", T + 300)).toBe(300);
    expect(landedAgo("Hook one|1", T + 300)).toBeNull();
    expect(markLanded("Hook one|3", T + 400)).toBe(400);
  });

  it("an answer that grew, where the memory holds another: nothing carried", () => {
    markLanded("Another hook|3", T);
    landingGrew("Hook one|1", "Hook one|3");
    expect(landedAgo("Hook one|3", T + 300)).toBeNull();
    expect(landedAgo("Another hook|3", T + 300)).toBe(300);
  });

  it("resetLanding forgets", () => {
    markLanded("Hook one", T);
    resetLanding();
    expect(landedAgo("Hook one", T + 10)).toBeNull();
  });
});

describe("a row's place in the landing", () => {
  it("rows one after another, the rest with the tenth; the button after the last staggered row", () => {
    expect([0, 1, 2, 9, 10, 14].map(rowLand)).toEqual([0, 1, 2, 9, 9, 9]);
    expect(afterRows(3)).toBe(3);
    expect(afterRows(10)).toBe(10);
    expect(afterRows(14)).toBe(10);
    expect(afterRows(0)).toBe(0);
  });

  it("the index rides as the `--i` property", () => {
    expect(landStyle(4)).toEqual({ "--i": 4 });
  });
});

describe("landingKeyOf: the answer as it stands, its first card line (or the fallback) and how many result blocks it holds", () => {
  it("a hooks turn: its first card line, trimmed, and its two cards", () => {
    const blocks = [
      { type: "run-header", props: { skill: "hooks" } },
      { type: "markdown", props: { text: "On it." } },
      { type: "hook-card", props: { hookLine: "  The first hook.  " } },
      { type: "hook-card", props: { hookLine: "The second hook." } },
    ];
    expect(landingKeyOf(blocks)).toBe("The first hook.|2");
  });

  // Fix round 1: a turn with a result card but no card line still lands once, so it needs a key.
  it("a remix turn: its first result block's type and its adapted hook, trimmed, and its two cards", () => {
    const blocks = [
      { type: "run-header", props: { skill: "remix" } },
      { type: "remix-card", props: { adaptedHook: "  The cheapest camera move.  " } },
      { type: "remix-card", props: { adaptedHook: "A second remix." } },
    ];
    expect(landingKeyOf(blocks)).toBe("remix-card:The cheapest camera move.|2");
  });

  it("a video turn: the card's type and its run's id", () => {
    expect(landingKeyOf([{ type: "run-header", props: { skill: "test" } }, { type: "video-test-card", props: { analysisId: "an-1" } }])).toBe(
      "video-test-card:an-1|1",
    );
  });

  it("an account read, which has no text of its own to key on: its type alone", () => {
    expect(landingKeyOf([{ type: "run-header", props: { skill: "account" } }, { type: "account-read", props: { summary: "x" } }])).toBe(
      "account-read|1",
    );
  });

  it("a card line wins over the fallback, so hooks, ideas and a script keep their key", () => {
    const blocks = [
      { type: "remix-card", props: { adaptedHook: "A remix first." } },
      { type: "hook-card", props: { hookLine: "The hook line." } },
    ];
    expect(landingKeyOf(blocks)).toBe("The hook line.|2");
  });

  it("a second pack in the same turn is another answer; the persisted copy of the turn (its run headers, its closing line) is the same one", () => {
    const first = [
      { type: "run-header", props: { skill: "hooks" } },
      { type: "hook-card", props: { hookLine: "The first hook." } },
      { type: "hook-card", props: { hookLine: "The second hook." } },
    ];
    const both = [...first, { type: "run-header", props: { skill: "hooks" } }, { type: "hook-card", props: { hookLine: "One more hook." } }];
    expect(landingKeyOf(both)).not.toBe(landingKeyOf(first));
    const persisted = [...both, { type: "markdown", props: { text: "Hook 1 is the one to film." } }];
    expect(landingKeyOf(persisted)).toBe(landingKeyOf(both));
  });

  it("a text-only turn and an empty turn have none", () => {
    expect(landingKeyOf([{ type: "markdown", props: { text: "Post three times a week." } }])).toBeNull();
    expect(landingKeyOf([])).toBeNull();
  });
});
