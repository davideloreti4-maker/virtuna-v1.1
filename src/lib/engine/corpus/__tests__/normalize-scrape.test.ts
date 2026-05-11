import { describe, expect, it } from "vitest";
import { normalizeScrapedItem } from "../normalize-scrape";
import { normalizeHandle } from "@/lib/schemas/competitor";

const NICHE = "beauty" as const;
const CORPUS = "pilot.2026-05-12";

const TEN_DAYS_AGO_SEC = Math.floor((Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000);
const TEN_DAYS_AGO_MS = Date.now() - 10 * 24 * 60 * 60 * 1000;
const TWO_DAYS_AGO_SEC = Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000);

// ─── Fixtures ──────────────────────────────────────────────────────

function clockworksFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "tk_video_abc123",
    webVideoUrl: "https://www.tiktok.com/@DaviDe/video/abc123",
    text: "this is a caption #beauty #glowup",
    createTime: TEN_DAYS_AGO_SEC,
    playCount: 250_000,
    diggCount: 5_000,
    shareCount: 300,
    commentCount: 800,
    collectCount: 1_200,
    hashtags: [{ name: "beauty" }, { name: "glowup" }],
    videoMeta: { duration: 28 },
    authorMeta: { name: "@DaviDe ", fans: 50_000 },
    musicMeta: { musicName: "Original sound — DaviDe" },
    ...overrides,
  };
}

function apidojoFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "tk_video_abc123",
    postPage: "https://www.tiktok.com/@DaviDe/video/abc123",
    views: 250_000,
    likes: 5_000,
    comments: 800,
    shares: 300,
    bookmarks: 1_200,
    title: "this is a caption #beauty #glowup",
    hashtags: ["beauty", "glowup"],
    uploadedAt: TEN_DAYS_AGO_MS, // apidojo uses ms
    channel: { username: "@DaviDe ", followers: 50_000 },
    video: { duration: 28 },
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("normalizeScrapedItem — clockworks format", () => {
  it("returns a fully-populated row with normalized handle and derived follower_tier", () => {
    const row = normalizeScrapedItem(clockworksFixture(), NICHE, CORPUS, "trending");
    expect(row).not.toBeNull();
    expect(row!.platform).toBe("tiktok");
    expect(row!.platform_video_id).toBe("tk_video_abc123");
    expect(row!.video_url).toBe("https://www.tiktok.com/@DaviDe/video/abc123");
    expect(row!.creator_handle).toBe(normalizeHandle("@DaviDe "));
    expect(row!.niche).toBe("beauty");
    expect(row!.corpus_version).toBe(CORPUS);
    expect(row!.scrape_kind).toBe("trending");
    expect(row!.views).toBe(250_000);
    expect(row!.likes).toBe(5_000);
    expect(row!.comments).toBe(800);
    expect(row!.shares).toBe(300);
    expect(row!.saves).toBe(1_200);
    expect(row!.duration_seconds).toBe(28);
    expect(row!.completion_pct).toBeNull();
    expect(row!.follower_count).toBe(50_000);
    expect(row!.follower_tier).toBe("micro"); // 50k → micro
    expect(row!.caption).toBe("this is a caption #beauty #glowup");
    expect(row!.hashtags).toEqual(["beauty", "glowup"]);
    expect(row!.sound_name).toBe("Original sound — DaviDe");
    expect(row!.posted_at).toBeInstanceOf(Date);
    expect(row!.scraped_at).toBeInstanceOf(Date);
  });

  it("returns null when views = 0 (CORPUS-08 quality rule)", () => {
    const row = normalizeScrapedItem(
      clockworksFixture({ playCount: 0 }),
      NICHE,
      CORPUS,
      "trending"
    );
    expect(row).toBeNull();
  });

  it("returns null when createTime is within last 7 days (Pitfall 1)", () => {
    const row = normalizeScrapedItem(
      clockworksFixture({ createTime: TWO_DAYS_AGO_SEC }),
      NICHE,
      CORPUS,
      "trending"
    );
    expect(row).toBeNull();
  });

  it("returns null when id is missing", () => {
    const fixture = clockworksFixture();
    delete (fixture as { id?: unknown }).id;
    const row = normalizeScrapedItem(fixture, NICHE, CORPUS, "trending");
    expect(row).toBeNull();
  });

  it("sets follower_count and follower_tier to null when fans missing", () => {
    const fixture = clockworksFixture({
      authorMeta: { name: "@DaviDe " }, // no fans
    });
    const row = normalizeScrapedItem(fixture, NICHE, CORPUS, "trending");
    expect(row).not.toBeNull();
    expect(row!.follower_count).toBeNull();
    expect(row!.follower_tier).toBeNull();
  });

  it("sets sound_name to null when musicMeta is missing", () => {
    const fixture = clockworksFixture();
    delete (fixture as { musicMeta?: unknown }).musicMeta;
    const row = normalizeScrapedItem(fixture, NICHE, CORPUS, "average");
    expect(row).not.toBeNull();
    expect(row!.sound_name).toBeNull();
  });
});

describe("normalizeScrapedItem — apidojo format", () => {
  it("returns a fully-populated row identical in shape to clockworks", () => {
    const row = normalizeScrapedItem(apidojoFixture(), NICHE, CORPUS, "trending");
    expect(row).not.toBeNull();
    expect(row!.platform).toBe("tiktok");
    expect(row!.platform_video_id).toBe("tk_video_abc123");
    expect(row!.video_url).toBe("https://www.tiktok.com/@DaviDe/video/abc123");
    expect(row!.creator_handle).toBe(normalizeHandle("@DaviDe "));
    expect(row!.niche).toBe("beauty");
    expect(row!.corpus_version).toBe(CORPUS);
    expect(row!.scrape_kind).toBe("trending");
    expect(row!.views).toBe(250_000);
    expect(row!.likes).toBe(5_000);
    expect(row!.comments).toBe(800);
    expect(row!.shares).toBe(300);
    expect(row!.saves).toBe(1_200);
    expect(row!.duration_seconds).toBe(28);
    expect(row!.completion_pct).toBeNull();
    expect(row!.follower_count).toBe(50_000);
    expect(row!.follower_tier).toBe("micro");
    expect(row!.caption).toBe("this is a caption #beauty #glowup");
    expect(row!.hashtags).toEqual(["beauty", "glowup"]);
    expect(row!.sound_name).toBeNull(); // apidojo doesn't expose sound name
    expect(row!.posted_at).toBeInstanceOf(Date);
    expect(row!.scraped_at).toBeInstanceOf(Date);
  });

  it("returns null when views = 0", () => {
    const row = normalizeScrapedItem(
      apidojoFixture({ views: 0 }),
      NICHE,
      CORPUS,
      "trending"
    );
    expect(row).toBeNull();
  });

  it("returns null when uploadedAt is within last 7 days", () => {
    const twoDaysAgoMs = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const row = normalizeScrapedItem(
      apidojoFixture({ uploadedAt: twoDaysAgoMs }),
      NICHE,
      CORPUS,
      "trending"
    );
    expect(row).toBeNull();
  });

  it("handles apidojo follower_count missing → null", () => {
    const row = normalizeScrapedItem(
      apidojoFixture({ channel: { username: "@daviDe" } }),
      NICHE,
      CORPUS,
      "under"
    );
    expect(row).not.toBeNull();
    expect(row!.follower_count).toBeNull();
    expect(row!.follower_tier).toBeNull();
  });
});

describe("normalizeScrapedItem — cross-format equivalence", () => {
  it("clockworks and apidojo fixtures produce identical platform_video_id, views, niche, corpus_version", () => {
    const fromClockworks = normalizeScrapedItem(
      clockworksFixture(),
      NICHE,
      CORPUS,
      "trending"
    );
    const fromApidojo = normalizeScrapedItem(
      apidojoFixture(),
      NICHE,
      CORPUS,
      "trending"
    );
    expect(fromClockworks).not.toBeNull();
    expect(fromApidojo).not.toBeNull();
    expect(fromClockworks!.platform_video_id).toBe(fromApidojo!.platform_video_id);
    expect(fromClockworks!.views).toBe(fromApidojo!.views);
    expect(fromClockworks!.niche).toBe(fromApidojo!.niche);
    expect(fromClockworks!.corpus_version).toBe(fromApidojo!.corpus_version);
    expect(fromClockworks!.creator_handle).toBe(fromApidojo!.creator_handle);
    expect(fromClockworks!.follower_tier).toBe(fromApidojo!.follower_tier);
  });
});

describe("normalizeScrapedItem — schema dispatch", () => {
  it("returns null when shape matches neither schema", () => {
    const row = normalizeScrapedItem(
      { totally: "unknown", payload: 42 },
      NICHE,
      CORPUS,
      "trending"
    );
    expect(row).toBeNull();
  });

  it("returns null for non-object input (string)", () => {
    const row = normalizeScrapedItem("not an item", NICHE, CORPUS, "trending");
    expect(row).toBeNull();
  });

  it("returns null for null input", () => {
    const row = normalizeScrapedItem(null, NICHE, CORPUS, "trending");
    expect(row).toBeNull();
  });
});

describe("normalizeScrapedItem — W6 scrape_kind propagation", () => {
  it("echoes scrapeKind=trending onto the resulting row", () => {
    const row = normalizeScrapedItem(clockworksFixture(), NICHE, CORPUS, "trending");
    expect(row?.scrape_kind).toBe("trending");
  });

  it("echoes scrapeKind=average onto the resulting row", () => {
    const row = normalizeScrapedItem(clockworksFixture(), NICHE, CORPUS, "average");
    expect(row?.scrape_kind).toBe("average");
  });

  it("echoes scrapeKind=under onto the resulting row", () => {
    const row = normalizeScrapedItem(clockworksFixture(), NICHE, CORPUS, "under");
    expect(row?.scrape_kind).toBe("under");
  });

  it("the same item normalized with different scrapeKinds yields rows that differ only in scrape_kind", () => {
    const fixture = clockworksFixture();
    const trendingRow = normalizeScrapedItem(fixture, NICHE, CORPUS, "trending")!;
    const underRow = normalizeScrapedItem(fixture, NICHE, CORPUS, "under")!;
    expect(trendingRow.scrape_kind).toBe("trending");
    expect(underRow.scrape_kind).toBe("under");
    // Identity check on all other fields (excluding scrape_kind + scraped_at)
    expect(trendingRow.platform_video_id).toBe(underRow.platform_video_id);
    expect(trendingRow.views).toBe(underRow.views);
    expect(trendingRow.likes).toBe(underRow.likes);
    expect(trendingRow.posted_at.getTime()).toBe(underRow.posted_at.getTime());
    expect(trendingRow.follower_count).toBe(underRow.follower_count);
    expect(trendingRow.follower_tier).toBe(underRow.follower_tier);
  });
});
