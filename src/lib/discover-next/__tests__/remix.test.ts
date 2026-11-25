/** @vitest-environment happy-dom */

/**
 * Remix and the prices: where Remix is offered, the brief's cap
 * (the dialog's own, imported here only to pin it), and the prices in words as the thread's cards
 * write them. happy-dom only because the two components imported to pin their values are client
 * modules; nothing is rendered.
 */
import { describe, expect, it } from "vitest";

import { MAX_BRIEF } from "@/components/discover/remix-brief-dialog";
import { creditsLabel } from "@/components/thread-next/answer-card";
import { creditCost } from "@/lib/pricing";

import { PULL_PRICE, REMIX_BRIEF_MAX, REMIX_PLATFORMS, REMIX_PRICE, creditsWords, remixOffered } from "../remix";

describe("REMIX_PLATFORMS", () => {
  it("holds TikTok alone: the remix route fetches the source video with the TikTok scraper, whatever platform it is sent", () => {
    expect([...REMIX_PLATFORMS]).toEqual(["tiktok"]);
  });
});

describe("remixOffered", () => {
  it("a platform in the set with a web address", () => {
    expect(remixOffered("tiktok", "https://www.tiktok.com/@jay.makes/video/1")).toBe(true);
  });

  it("Instagram and YouTube: not offered (their remix returned nothing)", () => {
    expect(remixOffered("instagram", "https://www.instagram.com/reel/abc/")).toBe(false);
    expect(remixOffered("youtube", "https://www.youtube.com/shorts/abc")).toBe(false);
  });

  it("the platform as stored in another case", () => {
    expect(remixOffered("TikTok", "https://www.tiktok.com/@jay.makes/video/1")).toBe(true);
  });

  it("another platform, or none: not offered", () => {
    expect(remixOffered("vimeo", "https://vimeo.com/1")).toBe(false);
    expect(remixOffered(null, "https://www.tiktok.com/@jay.makes/video/1")).toBe(false);
  });

  it("no web address: not offered", () => {
    expect(remixOffered("tiktok", null)).toBe(false);
    expect(remixOffered("tiktok", "")).toBe(false);
    expect(remixOffered("tiktok", "javascript:alert(1)")).toBe(false);
    expect(remixOffered("tiktok", "not a link")).toBe(false);
  });
});

describe("the brief's cap", () => {
  it("is the Remix dialog's", () => {
    expect(REMIX_BRIEF_MAX).toBe(200);
    expect(REMIX_BRIEF_MAX).toBe(MAX_BRIEF);
  });
});

describe("prices", () => {
  it("come from the price table", () => {
    expect(REMIX_PRICE).toBe(creditCost("remix"));
    expect(PULL_PRICE).toBe(creditCost("discover"));
  });

  it("are written as the thread's cards write them", () => {
    for (const n of [0, 1, 2, 5, 10, 100]) expect(creditsWords(n)).toBe(creditsLabel(n));
    expect(creditsWords(1)).toBe("1 credit");
    expect(creditsWords(10)).toBe("10 credits");
  });
});
