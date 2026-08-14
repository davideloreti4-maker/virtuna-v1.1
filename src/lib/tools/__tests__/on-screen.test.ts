/**
 * on-screen.test.ts — what a run put on the creator's screen, for a pack AND for a result.
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
  recordLineOf,
  RECORDED_BLOCKS,
  MAX_LINES_PER_RUN,
  MAX_LINE_LENGTH,
  MAX_RECORD_LENGTH,
  MAX_GRID_TILES,
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

/**
 * An Explore run puts TWELVE videos on the creator's screen, and the record described exactly one
 * of them (`tiles[0]`). So "find me 3 viral formats" — an ask the grid on screen fully answers —
 * was unanswerable for a mechanical reason: the agent had never been told the other eleven exist
 * in any form it could quote. This fires on the manual Explore button, on every thread, today.
 *
 * The grid is the ONE record type that summarises a set rather than a single result, which is why
 * it is also the one the module's "one line each" rule reads wrong. It still ships one line — that
 * line just has to name more than one video.
 */
const gridTile = (caption: string, multiplier: number) => ({
  platformVideoId: "7291822011",
  videoUrl: "https://www.tiktok.com/@demo/video/7291822011",
  caption,
  views: 2_400_000,
  multiplier,
  baselineLabel: "vs own",
  fit: { level: "Strong" },
});

/** Twelve tiles with distinct, realistically long captions — a real Explore pull's shape. */
const twelveTiles = Array.from({ length: 12 }, (_, i) =>
  gridTile(`Format ${i + 1}: the one habit that changed my mornings and why nobody talks about it`, 12.4 - i),
);

describe("recordLineOf — the outlier grid describes the SET, not tiles[0]", () => {
  it("names several videos, not only the first", () => {
    const line = recordLineOf("outlier-grid", { mode: "profile", tiles: twelveTiles })!;

    expect(line).toContain("Format 1:");
    expect(line).toContain("Format 2:");
    expect(line).toContain("Format 3:"); // "find me 3 viral formats" is answerable from this alone
  });

  it("states both counts, so the model cannot imply it read all twelve", () => {
    const line = recordLineOf("outlier-grid", { mode: "profile", tiles: twelveTiles })!;

    expect(line).toContain("12"); // what the creator is looking at
    expect(line).toContain(String(MAX_GRID_TILES)); // what this line actually quotes
  });

  it("carries each quoted video's multiplier — the reason it is IN the grid", () => {
    const line = recordLineOf("outlier-grid", { mode: "profile", tiles: twelveTiles })!;

    expect(line).toContain("12.4×");
    expect(line).toContain("11.4×");
  });

  /**
   * The other half of the defect. A cap that clips the line mid-caption hands the model a truncated
   * quote it will happily read back to the creator, so the budget has to fit the line the describer
   * intends to emit — the tile count and the cap are one decision, not two.
   */
  it("fits the whole multi-tile line inside the cap, unclipped", () => {
    const line = recordLineOf("outlier-grid", { mode: "profile", tiles: twelveTiles })!;

    expect(line.length).toBeLessThanOrEqual(MAX_RECORD_LENGTH);
    // The LAST quoted tile survives — proof the cap did not eat the tail of the list.
    expect(line).toContain(`Format ${MAX_GRID_TILES}:`);
  });

  it("still degrades rather than inventing: no tiles → no record", () => {
    expect(recordLineOf("outlier-grid", { mode: "profile", tiles: [] })).toBeNull();
    expect(recordLineOf("outlier-grid", {})).toBeNull();
  });

  it("quotes a grid SHORTER than the cap without padding or a phantom tile", () => {
    const line = recordLineOf("outlier-grid", { mode: "profile", tiles: twelveTiles.slice(0, 2) })!;

    expect(line).toContain("Format 1:");
    expect(line).toContain("Format 2:");
    expect(line).not.toContain("Format 3:");
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
