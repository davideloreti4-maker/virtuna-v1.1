import { describe, expect, it } from "vitest";

import type { CardVideo } from "../hub-data";
import { hubLines } from "../hub-lines";

function video(id: string, handle: string | null): CardVideo {
  return {
    id,
    coverUrl: null,
    handle,
    spokenHook: `Line ${id}`,
    niche: "food",
    platform: "tiktok",
    views: 1000,
    postedAt: null,
    multiplier: 4,
    baselineLabel: "vs their average",
    proven: true,
    extreme: false,
    formats: [],
  };
}

const LIBRARY = [video("a", "nia.cooks"), video("b", "jay.makes"), video("c", "dev.lifts")];
const base = { library: LIBRARY, found: 3, q: "", niche: null, platform: null } as const;

describe("hubLines — the count line", () => {
  it("no filter, no search: the proven videos, nothing else", () => {
    expect(hubLines(base)).toEqual({ countLine: "3 proven videos", filtered: false, empty: null });
  });

  it("one video is said in the singular", () => {
    expect(hubLines({ ...base, found: 1 }).countLine).toBe("1 proven video");
  });

  it("a search with matches: the proven videos it found", () => {
    expect(hubLines({ ...base, q: "line", found: 2 })).toEqual({ countLine: "2 proven videos", filtered: false, empty: null });
  });

  it("a niche: its name and the count, filtered", () => {
    expect(hubLines({ ...base, niche: "comedy", found: 12 })).toEqual({ countLine: "Comedy · 12 videos", filtered: true, empty: null });
  });

  it("a platform: its name and the count", () => {
    expect(hubLines({ ...base, platform: "tiktok", found: 5 }).countLine).toBe("TikTok · 5 videos");
  });

  it("both: the niche first, then the platform", () => {
    expect(hubLines({ ...base, niche: "health-fitness", platform: "youtube", found: 1 }).countLine).toBe("Fitness · YouTube · 1 video");
  });

  it("a filter that leaves nothing, no search: the line says 0, and no sentence", () => {
    expect(hubLines({ ...base, niche: "food", platform: "instagram", found: 0 })).toEqual({
      countLine: "Food · Instagram · 0 videos",
      filtered: true,
      empty: null,
    });
  });
});

describe("hubLines — the sentence in place of the grid", () => {
  it("a search with no match: the sentence, and no count line above it", () => {
    expect(hubLines({ ...base, q: "zebra", found: 0 })).toEqual({ countLine: null, filtered: false, empty: "No video matches that." });
  });

  it("a search with no match under a filter: the sentence, and the filter's line (it carries its Clear)", () => {
    expect(hubLines({ ...base, q: "zebra", niche: "comedy", found: 0 })).toEqual({
      countLine: "Comedy · 0 videos",
      filtered: true,
      empty: "No video matches that.",
    });
  });

  it("a @handle the library holds nothing from", () => {
    expect(hubLines({ ...base, q: "@sam.bakes", found: 0 }).empty).toBe("Nothing from @sam.bakes in the library yet.");
  });

  it("a TikTok profile link the library holds nothing from: the same, by its handle", () => {
    expect(hubLines({ ...base, q: "https://www.tiktok.com/@Sam.Bakes", found: 0 }).empty).toBe("Nothing from @sam.bakes in the library yet.");
  });

  it("a @handle the library holds, hidden by the filter: the plain sentence", () => {
    expect(hubLines({ ...base, q: "@nia.cooks", platform: "youtube", found: 0 }).empty).toBe("No video matches that.");
  });

  it("a lone @ over an empty library: the plain sentence (no handle to name)", () => {
    expect(hubLines({ ...base, library: [], q: "@", found: 0 }).empty).toBe("No video matches that.");
  });

  it("nothing found with no search (an empty library): no sentence", () => {
    expect(hubLines({ ...base, library: [], found: 0 })).toEqual({ countLine: "0 proven videos", filtered: false, empty: null });
  });
});
