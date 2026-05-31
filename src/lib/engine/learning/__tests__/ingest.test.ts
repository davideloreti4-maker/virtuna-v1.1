import { describe, it, expect } from "vitest";
import {
  extractDownloadUrl,
  trainingVideoStorageKey,
  buildTrainingVideoInsert,
} from "../ingest";
import type { NormalizedCorpusRow } from "../../corpus/normalize-scrape";

describe("trainingVideoStorageKey", () => {
  it("puts videos under training/ in the shared videos bucket, sanitized", () => {
    expect(trainingVideoStorageKey("7234567890")).toBe("training/7234567890.mp4");
    expect(trainingVideoStorageKey("../etc/passwd")).toBe("training/etcpasswd.mp4");
  });
});

describe("extractDownloadUrl", () => {
  it("prefers mediaUrls[0]", () => {
    expect(
      extractDownloadUrl({ mediaUrls: ["https://cdn.tiktok/v1.mp4", "https://x"] }),
    ).toBe("https://cdn.tiktok/v1.mp4");
  });

  it("falls back to videoMeta.downloadAddr then playAddr", () => {
    expect(extractDownloadUrl({ videoMeta: { downloadAddr: "https://cdn/dl.mp4" } })).toBe(
      "https://cdn/dl.mp4",
    );
    expect(extractDownloadUrl({ videoMeta: { playAddr: "https://cdn/play.mp4" } })).toBe(
      "https://cdn/play.mp4",
    );
  });

  it("returns null when no usable url", () => {
    expect(extractDownloadUrl({ mediaUrls: [] })).toBeNull();
    expect(extractDownloadUrl({ videoMeta: { downloadAddr: "not-a-url" } })).toBeNull();
    expect(extractDownloadUrl(null)).toBeNull();
    expect(extractDownloadUrl("nope")).toBeNull();
  });
});

describe("buildTrainingVideoInsert", () => {
  const normalized: NormalizedCorpusRow = {
    platform: "tiktok",
    platform_video_id: "7234567890",
    video_url: "https://www.tiktok.com/@x/video/7234567890",
    creator_handle: "creatorx",
    niche: "fitness",
    corpus_version: "v.test",
    scrape_kind: "trending",
    views: 50000,
    likes: 4000,
    comments: 120,
    shares: 300,
    saves: 200,
    duration_seconds: 28,
    completion_pct: null,
    follower_count: 12000,
    follower_tier: "micro",
    caption: "big workout",
    hashtags: ["fitness", "gym"],
    sound_name: "original sound",
    posted_at: new Date("2026-05-01T00:00:00.000Z"),
    scraped_at: new Date("2026-05-31T00:00:00.000Z"),
  };

  it("maps real metrics as ground truth + sets status=scraped", () => {
    const row = buildTrainingVideoInsert(normalized, "training/7234567890.mp4");
    expect(row.status).toBe("scraped");
    expect(row.real_views).toBe(50000);
    expect(row.real_likes).toBe(4000);
    expect(row.real_saves).toBe(200);
    expect(row.video_storage_path).toBe("training/7234567890.mp4");
    expect(row.posted_at).toBe("2026-05-01T00:00:00.000Z");
    expect(row.niche).toBe("fitness");
    expect(row.society_id).toBe("fitness"); // defaults to niche
  });

  it("does NOT carry any engine prediction fields (filled later, leak-free)", () => {
    const row = buildTrainingVideoInsert(normalized, "training/x.mp4") as unknown as Record<string, unknown>;
    expect(row.engine_feature_vector).toBeUndefined();
    expect(row.engine_predicted_bucket).toBeUndefined();
    expect(row.real_bucket).toBeUndefined(); // label assigned at the cohort label pass
  });

  it("honors an explicit societyId override", () => {
    const row = buildTrainingVideoInsert(normalized, "training/x.mp4", "fitness_us");
    expect(row.society_id).toBe("fitness_us");
  });
});
