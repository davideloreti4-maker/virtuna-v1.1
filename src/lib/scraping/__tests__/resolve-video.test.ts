/**
 * resolve-video.test.ts — happy-path tests for ApifyScrapingProvider.resolveVideoUrl
 *
 * Mocks the ApifyClient to avoid live Apify calls.
 * The mp4 URL returned by the mock mirrors the spike-confirmed shape:
 * a private api.apify.com KV-store record URL.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── ApifyClient mock ──────────────────────────────────────────────────────
// vi.mock is hoisted before imports. To reference module-scope variables inside
// the factory, we use a mutable proxy object captured in the mock class closure.

const mockState = {
  actorCallResult: { defaultDatasetId: "dataset-abc" } as unknown,
  listItemsResult: { items: [] as unknown[] },
  actorCallShouldThrow: false,
  actorCallError: new Error("actor error"),
};

vi.mock("apify-client", () => {
  class ApifyClient {
    actor(actorId: string) {
      void actorId;
      return {
        call: async (input: unknown, opts: unknown) => {
          void input;
          void opts;
          if (mockState.actorCallShouldThrow) throw mockState.actorCallError;
          return mockState.actorCallResult;
        },
      };
    }
    dataset(datasetId: string) {
      void datasetId;
      return {
        listItems: async () => mockState.listItemsResult,
      };
    }
  }
  return { ApifyClient };
});

// ─── Track calls for assertion ─────────────────────────────────────────────
// We need to spy on actor() and dataset() calls. Use a wrapper approach.
const calls = {
  actor: [] as string[],
  actorCall: [] as Array<{ input: unknown; opts: unknown }>,
  dataset: [] as string[],
};

vi.mock("apify-client", () => {
  class ApifyClient {
    actor(actorId: string) {
      calls.actor.push(actorId);
      return {
        call: async (input: unknown, opts: unknown) => {
          calls.actorCall.push({ input, opts });
          if (mockState.actorCallShouldThrow) throw mockState.actorCallError;
          return mockState.actorCallResult;
        },
      };
    }
    dataset(datasetId: string) {
      calls.dataset.push(datasetId);
      return {
        listItems: async () => mockState.listItemsResult,
      };
    }
  }
  return { ApifyClient };
});

import { ApifyScrapingProvider } from "../apify-provider";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const MP4_URL =
  "https://api.apify.com/v2/key-value-stores/store123/records/video-user-20260601-abc.mp4";

function makeVideoItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "vid_canonical_001",
    webVideoUrl: "https://www.tiktok.com/@user/video/vid_canonical_001",
    text: "caption text",
    createTime: 1717000000,
    playCount: 100_000,
    diggCount: 5_000,
    shareCount: 200,
    commentCount: 500,
    collectCount: 800,
    hashtags: [{ name: "test" }],
    videoMeta: { duration: 28 },
    mediaUrls: [MP4_URL],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("ApifyScrapingProvider.resolveVideoUrl — happy path", () => {
  let provider: ApifyScrapingProvider;

  beforeEach(() => {
    // Reset call tracking
    calls.actor.length = 0;
    calls.actorCall.length = 0;
    calls.dataset.length = 0;
    // Reset mock state
    mockState.actorCallShouldThrow = false;
    mockState.actorCallResult = { defaultDatasetId: "dataset-abc" };
    mockState.listItemsResult = { items: [makeVideoItem()] };

    provider = new ApifyScrapingProvider("test-token");
  });

  it("returns { mp4Url, durationSeconds } for a canonical TikTok URL", async () => {
    const result = await provider.resolveVideoUrl(
      "https://www.tiktok.com/@user/video/vid_canonical_001"
    );

    expect(result.mp4Url).toBe(MP4_URL);
    expect(result.durationSeconds).toBe(28);
  });

  it("calls the actor with the spike-confirmed single-URL input shape", async () => {
    const url = "https://www.tiktok.com/@user/video/vid_canonical_001";

    await provider.resolveVideoUrl(url);

    expect(calls.actor).toContain("clockworks/tiktok-scraper");
    const callArgs = calls.actorCall[0] as { input: Record<string, unknown>; opts: Record<string, unknown> };
    expect(callArgs.input).toMatchObject({
      postURLs: [url],
      resultsPerPage: 1,
      shouldDownloadVideos: true,
    });
    expect(callArgs.opts).toMatchObject({ waitSecs: 180 });
  });

  it("reads from the dataset returned by the actor run", async () => {
    await provider.resolveVideoUrl("https://www.tiktok.com/@user/video/vid_001");

    expect(calls.dataset).toContain("dataset-abc");
  });

  it("handles a vm.tiktok.com short link (Clockworks resolves redirects)", async () => {
    const result = await provider.resolveVideoUrl("https://vm.tiktok.com/ZM8abc/");

    expect(result.mp4Url).toBe(MP4_URL);
    expect(result.durationSeconds).toBe(28);
  });

  it("returns durationSeconds=0 when videoMeta is absent", async () => {
    const item = makeVideoItem();
    delete (item as { videoMeta?: unknown }).videoMeta;
    mockState.listItemsResult = { items: [item] };

    const result = await provider.resolveVideoUrl(
      "https://www.tiktok.com/@user/video/vid_001"
    );

    expect(result.mp4Url).toBe(MP4_URL);
    expect(result.durationSeconds).toBe(0);
  });
});
