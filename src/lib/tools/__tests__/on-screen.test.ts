/**
 * card-lines.test.ts — the identifying line of a card, and the caps on quoting a pack.
 *
 * The assertions worth keeping are the DEGRADATIONS. A card whose line is missing must be counted
 * and not quoted; the alternative — a placeholder — reads to the model as a card whose text is
 * literally "undefined", and it would then say so to the creator about a card on their screen.
 */

import { describe, it, expect } from "vitest";
import {
  cardLineOf,
  extractCardLines,
  describeRunOutput,
  isRecordedBlock,
  isChatCardsOnScreenEnabled,
  RECORDED_BLOCKS,
  MAX_LINES_PER_RUN,
  MAX_LINE_LENGTH,
} from "../on-screen";

const hook = (hookLine: unknown) => ({ type: "hook-card", props: { hookLine } });

describe("cardLineOf — one line per card type", () => {
  it("reads the line each generator card is identified by", () => {
    expect(cardLineOf("hook-card", { hookLine: "Day 47 of pretending I have rhythm." })).toBe(
      "Day 47 of pretending I have rhythm.",
    );
    expect(cardLineOf("idea-card", { title: "The ramen budget series" })).toBe(
      "The ramen budget series",
    );
    expect(cardLineOf("script-card", { title: "60s: the $47 problem" })).toBe("60s: the $47 problem");
  });

  it("returns null for a block that is NOT a generator card", () => {
    // A citation, a run capsule and an inline field are not cards the creator can be pointed at.
    expect(cardLineOf("corpus-references", { query: "x" })).toBeNull();
    expect(cardLineOf("run-header", { skill: "hooks" })).toBeNull();
    expect(cardLineOf("input-request", { action: "test" })).toBeNull();
    expect(cardLineOf("markdown", { text: "hello" })).toBeNull();
  });

  it("returns null — never a placeholder — when the line is missing or not a string", () => {
    expect(cardLineOf("hook-card", { hookLine: undefined })).toBeNull();
    expect(cardLineOf("hook-card", { hookLine: null })).toBeNull();
    expect(cardLineOf("hook-card", { hookLine: 42 })).toBeNull();
    expect(cardLineOf("hook-card", { hookLine: "   " })).toBeNull();
    expect(cardLineOf("hook-card", undefined)).toBeNull();
  });

  it("trims and clips to MAX_LINE_LENGTH", () => {
    expect(cardLineOf("hook-card", { hookLine: "  spaced  " })).toBe("spaced");
    const long = cardLineOf("hook-card", { hookLine: "z".repeat(MAX_LINE_LENGTH + 50) });
    expect(long).toHaveLength(MAX_LINE_LENGTH);
  });
});

describe("extractCardLines — a run's pack", () => {
  it("keeps card order", () => {
    expect(extractCardLines([hook("first"), hook("second"), hook("third")])).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("caps the number of lines — a reference, never a transcript", () => {
    const many = Array.from({ length: MAX_LINES_PER_RUN + 5 }, (_, i) => hook(`hook ${i}`));
    expect(extractCardLines(many)).toHaveLength(MAX_LINES_PER_RUN);
  });

  it("skips non-card blocks a run emits alongside its cards", () => {
    expect(
      extractCardLines([
        { type: "run-header", props: { skill: "hooks" } },
        hook("the only real card"),
        { type: "corpus-references", props: { query: "x" } },
      ]),
    ).toEqual(["the only real card"]);
  });

  it("returns EMPTY, not a placeholder, when no line is extractable", () => {
    // Both callers treat empty as "omit the field" — an empty card list is a claim, and it is the
    // wrong one. This is the degradation path for a card type that predates its line prop.
    expect(extractCardLines([hook(undefined), hook(null)])).toEqual([]);
    expect(extractCardLines([])).toEqual([]);
  });

  it("survives malformed blocks without throwing", () => {
    expect(extractCardLines([null, undefined, 42, {}, { type: 7 }, hook("survivor")])).toEqual([
      "survivor",
    ]);
  });
});

describe("describeRunOutput — any skill, not just the three generators", () => {
  const read = {
    type: "multi-audience-read",
    props: {
      audiences: [{ name: "Gen Z students", band: "Most keep watching", fraction: "6 in 10" }],
    },
  };
  const test = { type: "video-test-card", props: { craftScore: 61, dropLabel: "0:04" } };

  it("a generator pack comes back as `cards`", () => {
    expect(describeRunOutput([hook("first"), hook("second")])).toEqual({
      kind: "cards",
      lines: ["first", "second"],
    });
  });

  it("a Read comes back as `results` — the same line the replay path records", () => {
    const out = describeRunOutput([read]);
    expect(out?.kind).toBe("results");
    expect(out?.lines[0]).toContain("Audience Read — Gen Z students");
  });

  it("covers the other skills' result blocks too", () => {
    const out = describeRunOutput([test]);
    expect(out?.kind).toBe("results");
    expect(out?.lines[0]).toContain("Video Test — craft 61/100");
  });

  it("cards WIN a mixed run", () => {
    expect(describeRunOutput([read, hook("a card")])).toEqual({ kind: "cards", lines: ["a card"] });
  });

  it("null when nothing is describable — chrome and citations are not results", () => {
    expect(describeRunOutput([])).toBeNull();
    expect(
      describeRunOutput([
        { type: "run-header", props: { skill: "hooks" } },
        { type: "corpus-references", props: { query: "x" } },
        { type: "input-request", props: { action: "test" } },
      ]),
    ).toBeNull();
  });

  it("a describer that THROWS yields null, not an exception", () => {
    // Live, this runs AFTER the creator has been billed and the cards are on their screen.
    expect(
      describeRunOutput([
        { type: "video-test-card", get props(): unknown { throw new Error("shape drift"); } },
      ]),
    ).toBeNull();
  });

  it("every RECORDED_BLOCKS type is reachable through describeRunOutput", () => {
    // The set is the reachability test's SSOT. This asserts the LIVE path can see all of it —
    // the split that let the model narrate a verdict it had never read.
    for (const type of RECORDED_BLOCKS) {
      expect(isRecordedBlock(type), `${type} must be describable live`).toBe(true);
    }
  });
});

describe("the kill-switch", () => {
  it("is ON by default and only 'false' disables it", () => {
    const original = process.env.ENGINE_CHAT_CARDS_ON_SCREEN;
    try {
      delete process.env.ENGINE_CHAT_CARDS_ON_SCREEN;
      expect(isChatCardsOnScreenEnabled()).toBe(true);
      process.env.ENGINE_CHAT_CARDS_ON_SCREEN = "true";
      expect(isChatCardsOnScreenEnabled()).toBe(true);
      process.env.ENGINE_CHAT_CARDS_ON_SCREEN = "1";
      expect(isChatCardsOnScreenEnabled()).toBe(true);
      process.env.ENGINE_CHAT_CARDS_ON_SCREEN = "false";
      expect(isChatCardsOnScreenEnabled()).toBe(false);
    } finally {
      if (original === undefined) delete process.env.ENGINE_CHAT_CARDS_ON_SCREEN;
      else process.env.ENGINE_CHAT_CARDS_ON_SCREEN = original;
    }
  });
});
