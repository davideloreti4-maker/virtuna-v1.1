/**
 * classify-input.test.ts — Phase 08, Plan 02, Task 2 (D-14).
 *
 * @handle and a tiktok.com URL classify as profile (normalized handle);
 * free text classifies as niche (trimmed/lowercased).
 */
import { describe, expect, it } from "vitest";
import { classifyDiscoverInput } from "../classify-input";

describe("classifyDiscoverInput", () => {
  it("@handle → profile mode, normalized (no @, lowercased)", () => {
    const r = classifyDiscoverInput("@Creator");
    expect(r.mode).toBe("profile");
    expect(r.normalized).toBe("creator");
  });

  it("a tiktok.com/@user URL → profile mode with the extracted handle", () => {
    const r = classifyDiscoverInput("https://www.tiktok.com/@TheChef");
    expect(r.mode).toBe("profile");
    expect(r.normalized).toBe("thechef");
  });

  it("a bare tiktok.com/user URL (no @) → profile mode", () => {
    const r = classifyDiscoverInput("tiktok.com/cooking_guy");
    expect(r.mode).toBe("profile");
    expect(r.normalized).toBe("cooking_guy");
  });

  it("free text → niche mode, trimmed + lowercased", () => {
    const r = classifyDiscoverInput("  Cooking Tips  ");
    expect(r.mode).toBe("niche");
    expect(r.normalized).toBe("cooking tips");
  });

  it("a multi-word niche query is not mistaken for a profile", () => {
    const r = classifyDiscoverInput("budget travel europe");
    expect(r.mode).toBe("niche");
    expect(r.normalized).toBe("budget travel europe");
  });

  it("an instagram.com URL → unsupported (honest reject, not a garbage niche search)", () => {
    const r = classifyDiscoverInput("instagram.com/thecreator");
    expect(r.mode).toBe("unsupported");
    expect(r.reason).toMatch(/only tiktok/i);
  });

  it("a full https instagram URL → unsupported", () => {
    const r = classifyDiscoverInput("https://www.instagram.com/reel/abc123/");
    expect(r.mode).toBe("unsupported");
    expect(r.reason).toMatch(/only tiktok/i);
  });

  it("a bare instagram.com host (no path) → unsupported", () => {
    expect(classifyDiscoverInput("instagram.com").mode).toBe("unsupported");
  });

  it("other non-TikTok platforms (youtube, x) → unsupported", () => {
    expect(classifyDiscoverInput("youtube.com/watch?v=xyz").mode).toBe("unsupported");
    expect(classifyDiscoverInput("https://x.com/someone").mode).toBe("unsupported");
  });

  it("a niche with a dot is NOT mistaken for a link (no false reject)", () => {
    expect(classifyDiscoverInput("node.js tutorials").mode).toBe("niche");
    expect(classifyDiscoverInput("web3.0 trends").mode).toBe("niche");
  });

  it("a TikTok URL is still profile, never unsupported", () => {
    expect(classifyDiscoverInput("https://www.tiktok.com/@chef").mode).toBe("profile");
  });
});
