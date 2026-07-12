/**
 * title.test.ts — thread-title derivation units.
 *
 * The sidebar bug these guard against: hooks Auto threads all titled from the
 * model follow-up ("Hook #1 wins by…" × N identical). Derivation must prefer
 * the block-type headline (hook-card → hookLine, idea-card → title, …) over
 * generic text-ish props, and normalise candidates into short clipped labels.
 */

import { describe, it, expect } from "vitest";
import { cleanThreadTitle, deriveTitleFromBlocks, THREAD_TITLE_MAX } from "../title";

describe("cleanThreadTitle", () => {
  it("collapses whitespace runs (incl. newlines) and trims", () => {
    expect(cleanThreadTitle("  hooks   for\n\nmy   launch ")).toBe("hooks for my launch");
  });

  it("strips one layer of wrapping quotes (hook lines are often quoted)", () => {
    expect(cleanThreadTitle('"You\'re losing views at second 2"')).toBe(
      "You're losing views at second 2",
    );
    expect(cleanThreadTitle("“smart quotes too”")).toBe("smart quotes too");
  });

  it("clips to THREAD_TITLE_MAX without trailing whitespace", () => {
    const long = "a".repeat(40) + " " + "b".repeat(40);
    const title = cleanThreadTitle(long)!;
    expect(title.length).toBeLessThanOrEqual(THREAD_TITLE_MAX);
    expect(title).toBe(title.trimEnd());
  });

  it("returns null for non-strings and whitespace-only input", () => {
    expect(cleanThreadTitle(undefined)).toBeNull();
    expect(cleanThreadTitle(42)).toBeNull();
    expect(cleanThreadTitle("   \n ")).toBeNull();
  });
});

describe("deriveTitleFromBlocks", () => {
  it("hook-card → hookLine (NOT scrollQuote or any other prop)", () => {
    expect(
      deriveTitleFromBlocks([
        {
          type: "hook-card",
          props: { hookLine: "Stop posting at 9am", scrollQuote: "meh, seen it", rank: 1 },
        },
      ]),
    ).toBe("Stop posting at 9am");
  });

  it("idea-card → title; script-card → openingBeatSeed; remix-card → adaptedHook", () => {
    expect(
      deriveTitleFromBlocks([{ type: "idea-card", props: { title: "The 3-second pattern" } }]),
    ).toBe("The 3-second pattern");
    expect(
      deriveTitleFromBlocks([{ type: "script-card", props: { openingBeatSeed: "POV: your first 1k" } }]),
    ).toBe("POV: your first 1k");
    expect(
      deriveTitleFromBlocks([{ type: "remix-card", props: { adaptedHook: "Nobody tells new bakers this" } }]),
    ).toBe("Nobody tells new bakers this");
  });

  it("falls back to generic text-ish keys for unknown block types", () => {
    expect(deriveTitleFromBlocks([{ type: "mystery", props: { query: "best posting time" } }])).toBe(
      "best posting time",
    );
  });

  it("skips prop-less/empty blocks and takes the first usable one", () => {
    expect(
      deriveTitleFromBlocks([
        { type: "band", props: { band: "Strong" } },
        null,
        { type: "markdown", props: { text: "   " } },
        { type: "markdown", props: { text: "real content" } },
      ]),
    ).toBe("real content");
  });

  it("returns null when no block yields a usable string", () => {
    expect(deriveTitleFromBlocks([])).toBeNull();
    expect(deriveTitleFromBlocks([{ type: "band", props: { fraction: 7 } }])).toBeNull();
  });
});
