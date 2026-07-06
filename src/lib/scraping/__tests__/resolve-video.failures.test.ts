/**
 * resolve-video.failures.test.ts — failure taxonomy + SSRF tests for resolveVideoUrl
 *
 * Covers every IngestErrorKind plus the vm-link happy case.
 * Asserts on err.kind, NOT message strings.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IngestError } from "../types";

// ─── ApifyClient mock (same mutable-state pattern as resolve-video.test.ts) ──

const fMockState = {
  actorCallResult: { defaultDatasetId: "dataset-xyz" } as unknown,
  listItemsResult: { items: [] as unknown[] },
  actorCallShouldThrow: false,
  actorCallError: new Error("Apify timeout"),
};

vi.mock("apify-client", () => {
  class ApifyClient {
    actor(actorId: string) {
      void actorId;
      return {
        call: async (input: unknown, opts: unknown) => {
          void input;
          void opts;
          if (fMockState.actorCallShouldThrow) throw fMockState.actorCallError;
          return fMockState.actorCallResult;
        },
      };
    }
    dataset(datasetId: string) {
      void datasetId;
      return {
        listItems: async () => fMockState.listItemsResult,
      };
    }
  }
  return { ApifyClient };
});

import { ApifyScrapingProvider } from "../apify-provider";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const VALID_MP4_URL =
  "https://api.apify.com/v2/key-value-stores/store123/records/video.mp4";

function makeBaseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "vid_001",
    webVideoUrl: "https://www.tiktok.com/@user/video/vid_001",
    text: "caption",
    createTime: 1717000000,
    playCount: 50_000,
    diggCount: 1_000,
    shareCount: 100,
    commentCount: 200,
    collectCount: 300,
    hashtags: [],
    videoMeta: { duration: 20 },
    mediaUrls: [VALID_MP4_URL],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("resolveVideoUrl — failure taxonomy", () => {
  let provider: ApifyScrapingProvider;

  beforeEach(() => {
    fMockState.actorCallShouldThrow = false;
    fMockState.actorCallResult = { defaultDatasetId: "dataset-xyz" };
    fMockState.listItemsResult = { items: [] };
    provider = new ApifyScrapingProvider("test-token");
  });

  // ── empty_dataset ──────────────────────────────────────────────────────

  it("throws IngestError{ kind: 'empty_dataset' } when dataset returns 0 items", async () => {
    fMockState.listItemsResult = { items: [] };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/vid_001")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "empty_dataset"
    );
  });

  // ── not_found (spike-confirmed: deleted/private = count=1 with error key) ──

  it("throws IngestError{ kind: 'not_found' } when item has error key (deleted/private post)", async () => {
    fMockState.listItemsResult = {
      items: [
        {
          error: "Post not found or private.",
          errorCode: "NOT_FOUND",
          url: "https://www.tiktok.com/@tiktok/video/1111111111111111111",
        },
      ],
    };

    await expect(
      provider.resolveVideoUrl(
        "https://www.tiktok.com/@tiktok/video/1111111111111111111"
      )
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "not_found"
    );
  });

  it("throws IngestError{ kind: 'not_found' } when item has only errorCode (without error string)", async () => {
    fMockState.listItemsResult = {
      items: [{ errorCode: "PRIVATE_POST", url: "https://www.tiktok.com/@x/video/2" }],
    };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@x/video/2")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "not_found"
    );
  });

  // ── no_media_url ───────────────────────────────────────────────────────

  it("throws IngestError{ kind: 'no_media_url' } when item has no mediaUrls (carousel/photo post)", async () => {
    const item = makeBaseItem();
    delete (item as { mediaUrls?: unknown }).mediaUrls;
    fMockState.listItemsResult = { items: [item] };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/carousel")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "no_media_url"
    );
  });

  it("throws IngestError{ kind: 'no_media_url' } when mediaUrls is an empty array", async () => {
    fMockState.listItemsResult = { items: [makeBaseItem({ mediaUrls: [] })] };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/empty")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "no_media_url"
    );
  });

  // ── scrape_failed ──────────────────────────────────────────────────────

  it("throws IngestError{ kind: 'scrape_failed' } when actor call throws (network/timeout)", async () => {
    fMockState.actorCallShouldThrow = true;
    fMockState.actorCallError = new Error("Apify timeout");

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/vid_001")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "scrape_failed"
    );
  });

  // ── ssrf_rejected ──────────────────────────────────────────────────────

  it("throws IngestError{ kind: 'ssrf_rejected' } when resolved mp4 has a non-allowlisted host", async () => {
    fMockState.listItemsResult = {
      items: [makeBaseItem({ mediaUrls: ["https://evil.example.com/video.mp4"] })],
    };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/vid_001")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "ssrf_rejected"
    );
  });

  it("throws IngestError{ kind: 'ssrf_rejected' } for the bare apex host (#9 — apex is not a labeled subdomain)", async () => {
    // #9: the old `host === suffix.slice(1)` clause allowed the bare apex `apify.com`.
    // Resolved mp4 hosts are always labeled subdomains (api.apify.com); reject the apex.
    fMockState.listItemsResult = {
      items: [makeBaseItem({ mediaUrls: ["https://apify.com/records/video.mp4"] })],
    };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/vid_001")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "ssrf_rejected"
    );
  });

  it("throws IngestError{ kind: 'ssrf_rejected' } for internal IP addresses", async () => {
    fMockState.listItemsResult = {
      items: [makeBaseItem({ mediaUrls: ["https://192.168.1.1/video.mp4"] })],
    };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/vid_001")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "ssrf_rejected"
    );
  });

  it("throws IngestError{ kind: 'ssrf_rejected' } for 127.x.x.x loopback", async () => {
    fMockState.listItemsResult = {
      items: [makeBaseItem({ mediaUrls: ["https://127.0.0.1/video.mp4"] })],
    };

    await expect(
      provider.resolveVideoUrl("https://www.tiktok.com/@user/video/vid_001")
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof IngestError && e.kind === "ssrf_rejected"
    );
  });

  // ── vm. short link (happy case — Clockworks resolves redirects) ────────

  it("resolves successfully for a vm.tiktok.com short link (Clockworks follows redirects)", async () => {
    fMockState.listItemsResult = { items: [makeBaseItem()] };

    const result = await provider.resolveVideoUrl("https://vm.tiktok.com/ZM8abc/");

    expect(result.mp4Url).toBe(VALID_MP4_URL);
    expect(result.durationSeconds).toBe(20);
  });
});
