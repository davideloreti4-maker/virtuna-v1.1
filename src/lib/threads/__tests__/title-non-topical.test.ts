import { describe, it, expect } from "vitest";
import { cleanThreadTitle, isNonTopical } from "../title";

// ─────────────────────────────────────────────────────────────────────────────
// Thread titles refuse filenames and bare links.
//
// The title write is WRITE-ONCE (`title IS NULL` guard in setThreadTitleIfEmpty),
// so whatever claims the slot first keeps it forever. When someone drops a video
// instead of typing an ask, the first signal handed over is the upload's
// filename — so real threads were landing in the sidebar as
// "TikTok Video Downloader (1).mp4" and could never be corrected automatically.
//
// Refusing at cleanThreadTitle (the single choke point every writer passes
// through) leaves the guard OPEN so the next candidate — the skill subject, or a
// derived card headline — takes the slot instead.
//
// The interesting half of this test is the NEGATIVE half: the rule has to stay
// narrow enough that a real ask which merely mentions a file or a link survives.
// ─────────────────────────────────────────────────────────────────────────────

describe("isNonTopical", () => {
  it("rejects upload filenames", () => {
    for (const s of [
      "TikTok Video Downloader (1).mp4", // the one seen live
      "IMG_4821.MOV",
      "final-cut-v3.mp4",
      "screenshot 2026-07-28.png",
      "deck.pdf",
    ]) {
      expect(isNonTopical(s), s).toBe(true);
    }
  });

  it("rejects a bare URL", () => {
    expect(isNonTopical("https://www.tiktok.com/@someone/video/12345")).toBe(true);
    expect(isNonTopical("http://example.com")).toBe(true);
  });

  it("keeps a real ask that merely CONTAINS a link or a filename", () => {
    // This is the half that matters. Over-broad matching here would silently
    // strip legitimate titles and leave threads permanently called "New chat".
    for (const s of [
      "react to https://tiktok.com/@x/video/1 as a skeptic",
      "why did final-cut-v3.mp4 flop with founders?",
      "compare deck.pdf against the winning pitch",
      "hooks for a law firm scaling past 15M",
      "Rewrite the opening so it lands in 2 seconds.",
    ]) {
      expect(isNonTopical(s), s).toBe(false);
    }
  });
});

describe("cleanThreadTitle", () => {
  it("returns null for a filename so the write-once guard stays open", () => {
    expect(cleanThreadTitle("TikTok Video Downloader (1).mp4")).toBeNull();
  });

  it("still cleans and keeps a real title", () => {
    expect(cleanThreadTitle('  "hooks   for a law firm"  ')).toBe("hooks for a law firm");
  });

  it("clips to the max length", () => {
    const long = "a".repeat(120);
    expect(cleanThreadTitle(long)?.length).toBe(48);
  });
});
