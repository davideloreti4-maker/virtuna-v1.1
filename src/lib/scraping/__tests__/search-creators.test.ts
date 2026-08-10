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
        { authorMeta: { name: "founderone" } },
        { authorMeta: { name: "founderone" } },
        { authorMeta: { name: "foundertwo" } },
      ],
    };
    const out = await new ApifyScrapingProvider("test-token").searchCreators("startup founder");
    expect(out).toEqual(["founderone", "foundertwo"]);
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
