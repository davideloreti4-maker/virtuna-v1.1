/**
 * The Remix hand-off from Discover to a new chat: left in module memory by "Remix this", taken once by
 * Home's composer within a minute. Never an address. PURE (`node`); the clock is given.
 */
import { afterEach, describe, expect, it } from "vitest";

import { REMIX_FROM_MS, leaveRemixFrom, takeRemixFrom } from "../remix-from";

const LINK = "https://www.tiktok.com/@nia.tests/video/7300000000000000001";
const AT = 1_000_000;

afterEach(() => {
  takeRemixFrom(AT); // nothing a test left reaches the next
});

describe("remix-from", () => {
  it("left, then taken: the link, its platform and the brief, once", () => {
    expect(leaveRemixFrom({ url: LINK, platform: "tiktok", brief: "for my bakery" }, AT)).toBe(true);
    expect(takeRemixFrom(AT + 1_000)).toEqual({ url: LINK, platform: "tiktok", brief: "for my bakery" });
    expect(takeRemixFrom(AT + 1_000)).toBeNull();
  });

  it("the link and the brief trimmed, the platform in lower case; a blank brief is none", () => {
    leaveRemixFrom({ url: `  ${LINK}  `, platform: " TikTok ", brief: "   " }, AT);
    expect(takeRemixFrom(AT)).toEqual({ url: LINK, platform: "tiktok", brief: null });
    leaveRemixFrom({ url: LINK, platform: "tiktok" }, AT);
    expect(takeRemixFrom(AT)?.brief).toBeNull();
  });

  it("within a minute it is taken; after that it is gone (and taken away all the same)", () => {
    leaveRemixFrom({ url: LINK, platform: "tiktok" }, AT);
    expect(takeRemixFrom(AT + REMIX_FROM_MS)).not.toBeNull();
    leaveRemixFrom({ url: LINK, platform: "tiktok" }, AT);
    expect(takeRemixFrom(AT + REMIX_FROM_MS + 1)).toBeNull();
    expect(takeRemixFrom(AT)).toBeNull();
  });

  it("a clock that jumped back does not keep it alive: left more than a second ahead of now is not ours", () => {
    leaveRemixFrom({ url: LINK, platform: "tiktok" }, AT + 5_000);
    expect(takeRemixFrom(AT)).toBeNull();
  });

  it("a second leave replaces the first", () => {
    leaveRemixFrom({ url: LINK, platform: "tiktok", brief: "first" }, AT);
    leaveRemixFrom({ url: `${LINK}2`, platform: "tiktok", brief: "second" }, AT);
    expect(takeRemixFrom(AT)).toEqual({ url: `${LINK}2`, platform: "tiktok", brief: "second" });
  });

  it.each([
    ["no link", ""],
    ["not a link", "not a link"],
    ["a script address", "javascript:alert(1)"],
    ["an address that is not the web", "ftp://example.test/video"],
  ])("%s: nothing is left (and an earlier hand-off is dropped)", (_case, url) => {
    leaveRemixFrom({ url: LINK, platform: "tiktok" }, AT);
    expect(leaveRemixFrom({ url, platform: "tiktok" }, AT)).toBe(false);
    expect(takeRemixFrom(AT)).toBeNull();
  });

  it("no platform: nothing is left", () => {
    expect(leaveRemixFrom({ url: LINK, platform: null }, AT)).toBe(false);
    expect(leaveRemixFrom({ url: LINK, platform: "  " }, AT)).toBe(false);
    expect(takeRemixFrom(AT)).toBeNull();
  });

  it("nothing left: nothing taken", () => {
    expect(takeRemixFrom(AT)).toBeNull();
  });
});
