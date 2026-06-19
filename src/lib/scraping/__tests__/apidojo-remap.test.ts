/**
 * apidojo-remap.test.ts — Phase 08, Plan 02, Task 1.
 *
 * Pitfall 1 guard: apidojo's field names (views/likes/comments/shares/bookmarks/
 * uploadedAt/channel.followers) differ from clockworks. A blind reuse of the
 * clockworks apifyVideoSchema would parse "successfully" and SILENTLY ZERO every
 * metric (each metric has `.default(0)`). These tests assert the apidojo remap
 * yields NON-ZERO views/saves/shares and a real Date postedAt — the failure
 * signature of the bug is all-zero metrics, so we assert against zero explicitly.
 */
import { describe, expect, it } from "vitest";
import {
  remapApidojoVideo,
  remapApidojoProfile,
} from "../apify-provider";
import { apifyVideoSchema } from "@/lib/schemas/competitor";

// A realistic captured apidojo/tiktok-scraper dataset item (field shape per
// [CITED: apify.com/apidojo/tiktok-scraper] — views/likes/comments/shares/bookmarks/
// uploadedAt/channel.followers).
function apidojoItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "7412345678901234567",
    postPage: "https://www.tiktok.com/@creator/video/7412345678901234567",
    title: "POV: you finally understand zod transforms",
    uploadedAt: "2026-05-20T14:30:00.000Z",
    views: 1_240_000,
    likes: 98_000,
    comments: 4_200,
    shares: 12_500,
    bookmarks: 31_000,
    hashtags: ["fyp", "coding"],
    video: { duration: 42 },
    channel: { followers: 250_000 },
    ...overrides,
  };
}

describe("remapApidojoVideo", () => {
  it("maps apidojo fields onto VideoData with NON-ZERO metrics (Pitfall 1)", () => {
    const v = remapApidojoVideo(apidojoItem());
    expect(v).not.toBeNull();
    // The bug signature is every metric defaulting to 0 — assert against that.
    expect(v!.views).toBe(1_240_000);
    expect(v!.views).not.toBe(0);
    expect(v!.likes).toBe(98_000);
    expect(v!.comments).toBe(4_200);
    expect(v!.shares).toBe(12_500);
    expect(v!.shares).not.toBe(0);
    // apidojo `bookmarks` is the save metric.
    expect(v!.saves).toBe(31_000);
    expect(v!.saves).not.toBe(0);
  });

  it("coerces uploadedAt (ISO string) into a real Date for postedAt", () => {
    const v = remapApidojoVideo(apidojoItem());
    expect(v!.postedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(v!.postedAt.getTime())).toBe(false);
    expect(v!.postedAt.getTime()).toBe(
      new Date("2026-05-20T14:30:00.000Z").getTime(),
    );
  });

  it("maps id/url/caption/hashtags/duration", () => {
    const v = remapApidojoVideo(apidojoItem());
    expect(v!.platformVideoId).toBe("7412345678901234567");
    expect(v!.videoUrl).toContain("tiktok.com");
    expect(v!.caption).toContain("zod");
    expect(v!.hashtags).toEqual(["fyp", "coding"]);
    expect(v!.durationSeconds).toBe(42);
  });

  it("falls back to now (never NaN) when uploadedAt is missing", () => {
    const v = remapApidojoVideo(apidojoItem({ uploadedAt: undefined }));
    expect(v!.postedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(v!.postedAt.getTime())).toBe(false);
  });

  it("skips (returns null) an item with no usable id", () => {
    const v = remapApidojoVideo({ views: 10 });
    expect(v).toBeNull();
  });

  it("a clockworks-shaped item does NOT populate metrics through the apidojo schema", () => {
    // The schemas are distinct: clockworks keys (playCount/diggCount/…) carry no
    // apidojo metric keys, so the apidojo remap zeros them. This documents WHY a
    // single shared schema is wrong (Pitfall 1) — the inverse must also be true.
    const clockworksShape = {
      id: "999",
      playCount: 5_000_000,
      diggCount: 100_000,
      shareCount: 9_000,
      collectCount: 7_000,
    };
    const v = remapApidojoVideo(clockworksShape);
    // id parses, but the metric keys don't exist on the apidojo schema → all zero.
    expect(v!.views).toBe(0);
    expect(v!.saves).toBe(0);
    // And the clockworks schema itself still parses the clockworks shape (untouched).
    const clock = apifyVideoSchema.safeParse(clockworksShape);
    expect(clock.success).toBe(true);
    if (clock.success) expect(clock.data.playCount).toBe(5_000_000);
  });
});

describe("remapApidojoProfile", () => {
  it("maps apidojo channel.* onto ProfileData with normalized handle + follower count", () => {
    const p = remapApidojoProfile({
      channel: {
        username: "@Creator",
        name: "The Creator",
        bio: "I teach zod",
        avatar: "https://example.com/a.png",
        verified: true,
        followers: 250_000,
        following: 120,
        hearts: 9_800_000,
        videos: 412,
      },
    });
    expect(p.handle).toBe("creator"); // normalizeHandle: strip @, lowercase
    expect(p.displayName).toBe("The Creator");
    expect(p.followerCount).toBe(250_000);
    expect(p.followerCount).not.toBe(0);
    expect(p.heartCount).toBe(9_800_000);
    expect(p.videoCount).toBe(412);
    expect(p.verified).toBe(true);
  });
});
