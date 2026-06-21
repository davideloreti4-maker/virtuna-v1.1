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
});
