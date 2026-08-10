import { describe, expect, it, vi, beforeEach } from "vitest";

const mockState = {
  lastInput: null as unknown,
  listItemsResult: { items: [] as unknown[] },
};

vi.mock("apify-client", () => {
  class ApifyClient {
    actor() {
      return {
        call: async (input: unknown) => {
          mockState.lastInput = input;
          return { defaultDatasetId: "ds-1" };
        },
      };
    }
    dataset() {
      return { listItems: async () => mockState.listItemsResult };
    }
  }
  return { ApifyClient };
});

import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";

describe("searchCreators (stage 1 of D12)", () => {
  beforeEach(() => {
    mockState.lastInput = null;
    mockState.listItemsResult = { items: [] };
  });

  it("searches the /user section so results are PEOPLE, not caption matches", async () => {
    mockState.listItemsResult = {
      items: [{ authorMeta: { name: "founderone" } }, { authorMeta: { name: "foundertwo" } }],
    };
    await new ApifyScrapingProvider("test-token").searchCreators("startup founder", 5);
    expect(mockState.lastInput).toMatchObject({
      searchQueries: ["startup founder"],
      searchSection: "/user",
      maxProfilesPerQuery: 5,
    });
  });

  it("returns de-duplicated bare handles", async () => {
    mockState.listItemsResult = {
      items: [
        { authorMeta: { name: "founderone", fans: 900 } },
        { authorMeta: { name: "founderone", fans: 900 } },
        { authorMeta: { name: "foundertwo", fans: 100 } },
      ],
    };
    const out = await new ApifyScrapingProvider("test-token").searchCreators("startup founder");
    expect(out).toEqual(["founderone", "foundertwo"]);
  });

  it("orders by audience size, NOT the actor's dataset order", async () => {
    // The real 2026-08-10 "startup founder" payload, in the order Apify returned it.
    mockState.listItemsResult = {
      items: [
        { authorMeta: { name: "jessicaelawson.__", fans: 18 } },
        { authorMeta: { name: "hani.anis2", fans: 336 } },
        { authorMeta: { name: "startupfounderceo", fans: 2306 } },
      ],
    };
    const out = await new ApifyScrapingProvider("test-token").searchCreators("startup founder", 3);
    // A caller taking handles[0] must get the real creator, not the 18-follower account.
    expect(out).toEqual(["startupfounderceo", "hani.anis2", "jessicaelawson.__"]);
  });

  it("keeps the largest fan count when one creator appears on several items", async () => {
    mockState.listItemsResult = {
      items: [
        { authorMeta: { name: "big", fans: 0 } },
        { authorMeta: { name: "small", fans: 50 } },
        { authorMeta: { name: "big", fans: 9000 } },
      ],
    };
    const out = await new ApifyScrapingProvider("test-token").searchCreators("q");
    expect(out).toEqual(["big", "small"]);
  });

  it("still returns a handle whose item carries no fan count", async () => {
    mockState.listItemsResult = {
      items: [{ authorMeta: { name: "known", fans: 5 } }, { authorMeta: { name: "unknown" } }],
    };
    const out = await new ApifyScrapingProvider("test-token").searchCreators("q");
    expect(out).toEqual(["known", "unknown"]);
  });

  it("returns an empty array when the search finds nobody (caller degrades visibly)", async () => {
    const out = await new ApifyScrapingProvider("test-token").searchCreators("zzzz");
    expect(out).toEqual([]);
  });

  it("never requests a CHARGED transcription option", async () => {
    await new ApifyScrapingProvider("test-token").searchCreators("startup founder");
    const input = mockState.lastInput as Record<string, unknown>;
    expect(input.downloadSubtitlesOptions).not.toBe("TRANSCRIBE_ALL_VIDEOS");
    expect(input.downloadSubtitlesOptions).not.toBe(
      "DOWNLOAD_AND_TRANSCRIBE_VIDEOS_WITHOUT_SUBTITLES",
    );
  });
});

describe("scrapeVideos — stage 2 of D12 (the creator's own posts)", () => {
  beforeEach(() => {
    mockState.lastInput = null;
    mockState.listItemsResult = { items: [] };
  });

  it("asks for FREE native subtitles and excludes pinned posts on a profile pull", async () => {
    await new ApifyScrapingProvider("test-token").scrapeVideos("founderone", 6, "profile");
    expect(mockState.lastInput).toMatchObject({
      profiles: ["founderone"],
      resultsPerPage: 6,
      excludePinnedPosts: true,
      profileSorting: "latest",
      downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
    });
  });

  it("leaves the search-mode input alone (no charged options, no profile-only keys)", async () => {
    await new ApifyScrapingProvider("test-token").scrapeVideos("startup founder", 6, "search");
    const input = mockState.lastInput as Record<string, unknown>;
    expect(input.searchQueries).toEqual(["startup founder"]);
    expect(input.profileSorting).toBeUndefined();
    expect(input.downloadSubtitlesOptions).not.toBe("TRANSCRIBE_ALL_VIDEOS");
  });
});
