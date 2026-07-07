/**
 * multiplatform-remap.test.ts — Instagram + YouTube profile remaps.
 *
 * Same "normalize at the scrape boundary" guard as apidojo-remap: each actor has its own
 * field names, remapped onto the SHARED ProfileData. The item fixtures below mirror the
 * REAL field shapes captured by the 2026-07-07 probe (apify/instagram-profile-scraper,
 * streamers/youtube-scraper), so a drift in either actor's output surfaces here.
 *
 * Honesty spine: neither platform exposes a profile-level total-likes → heartCount MUST be
 * 0 (never a fabricated engagement number). YouTube has no "following" → followingCount 0.
 */
import { describe, expect, it } from "vitest";
import { remapInstagramProfile, remapYouTubeChannel } from "../apify-provider";

// Trimmed to the fields the remap reads, from the real probe item for @nasa.
function igItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "528817151",
    username: "nasa",
    fullName: "NASA",
    biography: "Making the seemingly impossible, possible. ✨",
    verified: true,
    private: false,
    followersCount: 104_352_987,
    followsCount: 91,
    postsCount: 4200,
    profilePicUrl: "https://scontent.cdninstagram.com/pic.jpg",
    profilePicUrlHD: "https://scontent.cdninstagram.com/pic_hd.jpg",
    ...overrides,
  };
}

// Trimmed to the fields the remap reads, from the real probe item for @mkbhd.
function ytItem(overrides: Record<string, unknown> = {}) {
  return {
    channelUsername: "mkbhd",
    channelName: "Marques Brownlee",
    channelDescription: "MKBHD: Quality Tech Videos",
    isChannelVerified: true,
    numberOfSubscribers: 21_100_000,
    channelTotalVideos: 1834,
    channelTotalViews: 5_469_016_050,
    channelAvatarUrl: "https://yt3.googleusercontent.com/avatar.jpg",
    ...overrides,
  };
}

describe("remapInstagramProfile", () => {
  it("maps the IG field names onto ProfileData", () => {
    const p = remapInstagramProfile(igItem());
    expect(p.handle).toBe("nasa");
    expect(p.displayName).toBe("NASA");
    expect(p.bio).toBe("Making the seemingly impossible, possible. ✨");
    expect(p.verified).toBe(true);
    expect(p.followerCount).toBe(104_352_987);
    expect(p.followingCount).toBe(91);
    expect(p.videoCount).toBe(4200); // postsCount
    expect(p.avatarUrl).toBe("https://scontent.cdninstagram.com/pic_hd.jpg"); // HD preferred
  });

  it("has NO fabricated likes or view total (honest absence)", () => {
    const p = remapInstagramProfile(igItem());
    expect(p.heartCount).toBe(0); // IG exposes no profile-level total-likes
    expect(p.viewCount).toBeUndefined(); // no profile view total → Views tile omitted
  });

  it("falls back to username for a missing fullName", () => {
    expect(remapInstagramProfile(igItem({ fullName: "" })).displayName).toBe("nasa");
  });
});

describe("remapYouTubeChannel", () => {
  it("maps the channel block onto ProfileData (subscribers → followers, views → viewCount)", () => {
    const p = remapYouTubeChannel(ytItem(), "mkbhd");
    expect(p.handle).toBe("mkbhd");
    expect(p.displayName).toBe("Marques Brownlee");
    expect(p.bio).toBe("MKBHD: Quality Tech Videos");
    expect(p.verified).toBe(true);
    expect(p.followerCount).toBe(21_100_000); // numberOfSubscribers
    expect(p.videoCount).toBe(1834); // channelTotalVideos
    expect(p.viewCount).toBe(5_469_016_050); // channelTotalViews (lifetime → Views tile)
  });

  it("has NO fabricated likes and no 'following' (honest absences)", () => {
    const p = remapYouTubeChannel(ytItem(), "mkbhd");
    expect(p.heartCount).toBe(0);
    expect(p.followingCount).toBe(0);
  });

  it("falls back to the input handle when channelUsername is absent", () => {
    const p = remapYouTubeChannel(ytItem({ channelUsername: undefined }), "@MKBHD");
    expect(p.handle).toBe("mkbhd"); // normalized from the fallback
  });
});
