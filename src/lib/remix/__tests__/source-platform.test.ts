/**
 * Real URL shapes only — every string here is a form the corpus or a creator actually produces.
 * No mocks: the unit under test is pure.
 */
import { describe, it, expect } from "vitest";
import { parseSourceUrl } from "../source-platform";

describe("parseSourceUrl — TikTok", () => {
  it("embeds a canonical @user/video/{id} permalink", () => {
    expect(parseSourceUrl("https://www.tiktok.com/@elsaspeak/video/7386776370245815560")).toEqual({
      platform: "tiktok",
      videoId: "7386776370245815560",
      embedUrl: "https://www.tiktok.com/embed/v2/7386776370245815560",
    });
  });

  it("ignores query strings and trailing slashes", () => {
    const parsed = parseSourceUrl(
      "https://www.tiktok.com/@a.b_c/video/7386776370245815560/?is_from_webapp=1&sender_device=pc",
    );
    expect(parsed?.embedUrl).toBe("https://www.tiktok.com/embed/v2/7386776370245815560");
  });

  it("accepts the host without www", () => {
    expect(parseSourceUrl("https://tiktok.com/@x/video/123456789")?.videoId).toBe("123456789");
  });

  it("does NOT embed a vm.tiktok.com shortlink — the id is not in the URL", () => {
    // Resolving it needs a network round trip, and guessing an embed id we do not have would
    // render a player for the wrong video. No embed is the honest answer; the card's
    // "Watch the original" link still works.
    const parsed = parseSourceUrl("https://vm.tiktok.com/ZMhKQwPqR/");
    expect(parsed).toEqual({ platform: "tiktok", videoId: null, embedUrl: null });
  });

  it("does NOT embed a /t/ shortlink either", () => {
    expect(parseSourceUrl("https://www.tiktok.com/t/ZTRxxxxxx/")?.embedUrl).toBeNull();
  });

  it("rejects a non-numeric video segment", () => {
    expect(parseSourceUrl("https://www.tiktok.com/@x/video/not-an-id")?.embedUrl).toBeNull();
  });
});

describe("parseSourceUrl — Instagram", () => {
  it("embeds a /reel/ permalink", () => {
    expect(parseSourceUrl("https://www.instagram.com/reel/DZK33LctVEo/")).toEqual({
      platform: "instagram",
      videoId: "DZK33LctVEo",
      embedUrl: "https://www.instagram.com/reel/DZK33LctVEo/embed",
    });
  });

  it("embeds a /p/ permalink under its own path form", () => {
    expect(parseSourceUrl("https://www.instagram.com/p/C1a2B3c4D5e/")?.embedUrl).toBe(
      "https://www.instagram.com/p/C1a2B3c4D5e/embed",
    );
  });

  it("normalises /reels/ (plural) to the embeddable /reel/ form", () => {
    expect(parseSourceUrl("https://www.instagram.com/reels/DZK33LctVEo/")?.embedUrl).toBe(
      "https://www.instagram.com/reel/DZK33LctVEo/embed",
    );
  });

  it("survives a username-prefixed reel URL", () => {
    expect(parseSourceUrl("https://www.instagram.com/someone/reel/DZK33LctVEo/")?.videoId).toBe(
      "DZK33LctVEo",
    );
  });

  it("does not embed a bare profile URL", () => {
    expect(parseSourceUrl("https://www.instagram.com/elsaspeak/")?.embedUrl).toBeNull();
  });
});

describe("parseSourceUrl — YouTube is recognised but never embedded", () => {
  // Owner ruling 2026-08-14: TikTok and Instagram embed. YouTube (22 corpus rows) keeps the
  // existing link-out, so it must parse as a known platform with no embed rather than as junk.
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ])("recognises %s without offering an embed", (url) => {
    const parsed = parseSourceUrl(url);
    expect(parsed?.platform).toBe("youtube");
    expect(parsed?.embedUrl).toBeNull();
  });
});

describe("parseSourceUrl — junk", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["not a url", "elsaspeak video"],
    ["no protocol", "tiktok.com/@x/video/123"],
    ["unknown host", "https://vimeo.com/12345"],
    ["javascript scheme", "javascript:alert(1)"],
  ])("returns null for %s", (_label, input) => {
    expect(parseSourceUrl(input as string | null | undefined)).toBeNull();
  });

  it("refuses a lookalike host that merely ends in the brand name", () => {
    // evil-tiktok.com must not be treated as TikTok — a naive `includes("tiktok.com")` would.
    expect(parseSourceUrl("https://evil-tiktok.com/@x/video/123")).toBeNull();
  });
});
