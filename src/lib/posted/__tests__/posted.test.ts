/**
 * The posted rules (plan 2026-11-24-after-posting, "Constants and contracts" and Task 1). Pure: no stand-in
 * at all, except that the pasted-link table is also fed to the scraper's own check, which is real.
 */
import { describe, expect, it } from "vitest";

import { isAllowedPostUrl } from "@/lib/scraping/apify-provider";
import {
  CLAIM_SECONDS,
  LINKS_PER_DAY,
  MAX_ATTEMPTS,
  READS_KEPT,
  REFRESH_HOURS,
  RETRY_MAX,
  RETRY_MINUTES,
  SETTLE_HOURS,
  USUAL_ABOVE,
  USUAL_BELOW,
  USUAL_MIN_POSTS,
  finalAtOf,
  handleOf,
  isBeingRead,
  isDue,
  parsePostLink,
  postHref,
  postIdTime,
  postedAtOf,
  roundRatio,
  stateOf,
  toPosted,
  toneOf,
  usualOf,
  type UsualVideo,
} from "../posted";
import { HOUR, MINUTE, NOW, ROW_ID, CHAT, ago, idAt, readRow, rowOf } from "./fixtures";

describe("the constants", () => {
  it("are the plan's", () => {
    expect({
      SETTLE_HOURS,
      REFRESH_HOURS,
      USUAL_MIN_POSTS,
      USUAL_ABOVE,
      USUAL_BELOW,
      MAX_ATTEMPTS,
      RETRY_MINUTES,
      LINKS_PER_DAY,
      READS_KEPT,
    }).toEqual({
      SETTLE_HOURS: 72,
      REFRESH_HOURS: 12,
      USUAL_MIN_POSTS: 5,
      USUAL_ABOVE: 1.5,
      USUAL_BELOW: 0.6,
      MAX_ATTEMPTS: 3,
      RETRY_MINUTES: 10,
      LINKS_PER_DAY: 20,
      READS_KEPT: 12,
    });
  });
});

// ─── The pasted link ────────────────────────────────────────────────────────

/** Links both checks must answer alike: `parsePostLink` is "the same rule as `isAllowedPostUrl`". */
const AGREE: Array<[string, boolean]> = [
  ["https://www.tiktok.com/@nia.cooks/video/7301444403323456789", true],
  ["https://vm.tiktok.com/ZMmadeup1/", true],
  ["https://vt.tiktok.com/ZSmadeup2/", true],
  ["https://m.tiktok.com/v/7301444403323456789.html", true],
  ["https://www.tiktokv.com/share/video/7301444403323456789/", true],
  ["https://WWW.TIKTOK.COM/@nia.cooks/video/7301444403323456789", true],
  ["  https://www.tiktok.com/@nia.cooks/video/7301444403323456789  ", true],
  ["http://www.tiktok.com/@nia.cooks/video/7301444403323456789", false],
  ["https://tiktok.com/@nia.cooks/video/7301444403323456789", false],
  ["https://tiktokv.com/share/video/7301444403323456789/", false],
  ["https://eviltiktok.com/@nia.cooks/video/7301444403323456789", false],
  ["https://www.tiktok.com.example.net/@nia.cooks/video/7301444403323456789", false],
  ["https://www.tiktok.com./@nia.cooks/video/7301444403323456789", false],
  ["https://127.0.0.1.tiktok.com/@nia.cooks/video/7301444403323456789", false],
  ["https://www.instagram.com/reel/madeup/", false],
  ["javascript:alert(1)", false],
  ["javascript://www.tiktok.com/%0Aalert(1)", false],
  ["data:text/html,https://www.tiktok.com/", false],
  ["ftp://www.tiktok.com/@nia.cooks/video/7301444403323456789", false],
  ["www.tiktok.com/@nia.cooks/video/7301444403323456789", false],
  ["not a link", false],
  ["", false],
];

describe("parsePostLink", () => {
  it.each(AGREE)("answers %j as the scraper's own check does (%s)", (text, ok) => {
    expect(isAllowedPostUrl(text)).toBe(ok);
    expect(parsePostLink(text) !== null).toBe(ok);
  });

  it("returns the link trimmed", () => {
    expect(parsePostLink("  https://vm.tiktok.com/ZMmadeup1/ \n")).toBe("https://vm.tiktok.com/ZMmadeup1/");
  });

  it("takes 500 characters and refuses 501 (the scraper's check has no length limit)", () => {
    const base = "https://www.tiktok.com/@nia.cooks/video/7301444403323456789?q=";
    const at500 = base + "a".repeat(500 - base.length);
    const at501 = at500 + "a";
    expect(at500).toHaveLength(500);
    expect(parsePostLink(at500)).toBe(at500);
    expect(parsePostLink(at501)).toBeNull();
    expect(isAllowedPostUrl(at501)).toBe(true);
  });

  it("counts characters as the database does, not UTF-16 units", () => {
    const base = "https://www.tiktok.com/@nia.cooks/video/7301444403323456789?q=";
    const link = base + "😀".repeat(500 - base.length);
    expect(link.length).toBeGreaterThan(500);
    expect(parsePostLink(link)).toBe(link);
  });

  it("refuses a link with a space or a line break inside (the URL parser drops line breaks silently)", () => {
    expect(parsePostLink("https://www.tiktok.com/@nia cooks/video/7301444403323456789")).toBeNull();
    expect(parsePostLink("https://www.tik\ntok.com/@nia.cooks/video/7301444403323456789")).toBeNull();
    expect(parsePostLink("https://www.tiktok.com/@nia.cooks/video/7301444403323456789\tx")).toBeNull();
    // What the scraper's check makes of the second one: the line break is gone, the host is tiktok.com.
    expect(isAllowedPostUrl("https://www.tik\ntok.com/@nia.cooks/video/7301444403323456789")).toBe(true);
  });

  it("refuses blank text and what is not text", () => {
    expect(parsePostLink("   ")).toBeNull();
    expect(parsePostLink(undefined as unknown as string)).toBeNull();
    expect(parsePostLink(42 as unknown as string)).toBeNull();
  });
});

// ─── A post's time ──────────────────────────────────────────────────────────

describe("postIdTime", () => {
  it("reads the creation time from the id's top 32 bits (hand-computed)", () => {
    // Made-up id. Its top 32 bits are 1,700,000,000 and its low bits 123,456,789:
    //   1,700,000,000 × 2^32 = 1,700,000,000 × 4,294,967,296 = 7,301,444,403,200,000,000
    //   + 123,456,789 (< 2^32, so it stays in the low bits)  = 7,301,444,403,323,456,789 (19 digits)
    // 1,700,000,000 s = 19,675 days + 80,000 s. Day 19,358 is 2023-01-01 (53 years × 365 + 13 leap days);
    // 19,675 − 19,358 = 317 days later is 14 Nov (Jan..Oct hold 304 days, + 13); 80,000 s = 22:13:20.
    expect(postIdTime("7301444403323456789", NOW)?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("takes a time from 2016-01-01 to one day after now", () => {
    const start = new Date("2016-01-01T00:00:00.000Z");
    expect(postIdTime(idAt(start), NOW)?.toISOString()).toBe(start.toISOString());
    expect(postIdTime(idAt(new Date(start.getTime() - 1000)), NOW)).toBeNull();
    const dayAfter = new Date(NOW.getTime() + 24 * HOUR);
    expect(postIdTime(idAt(dayAfter), NOW)?.toISOString()).toBe(dayAfter.toISOString());
    expect(postIdTime(idAt(new Date(dayAfter.getTime() + 1000)), NOW)).toBeNull();
  });

  it.each([
    ["", "empty"],
    ["1234", "4 digits"],
    ["12345", "5 digits, but its time is 1970"],
    ["1".repeat(26), "26 digits"],
    ["9".repeat(25), "25 digits, but its time is far in the future"],
    ["73014444033234567a9", "a letter"],
    [" 7301444403323456789", "a space"],
    ["-7301444403323456789", "a sign"],
    ["7301444403323456789.0", "a decimal"],
    ["0x1956af6b", "hex"],
  ])("refuses %j (%s)", (id) => {
    expect(postIdTime(id, NOW)).toBeNull();
  });
});

describe("postedAtOf", () => {
  const fromId = ago(30 * HOUR);

  it("takes the id's time over the scraper's", () => {
    expect(postedAtOf(idAt(fromId), ago(2 * HOUR), NOW)?.toISOString()).toBe(fromId.toISOString());
  });

  it("without an id time, takes the scraper's time only when it is more than five minutes before the read", () => {
    expect(postedAtOf("madeup", ago(6 * MINUTE), NOW)?.toISOString()).toBe(ago(6 * MINUTE).toISOString());
    expect(postedAtOf(null, ago(5 * MINUTE + 1), NOW)?.toISOString()).toBe(ago(5 * MINUTE + 1).toISOString());
    expect(postedAtOf(null, ago(5 * MINUTE), NOW)).toBeNull();
    // The scraper fills a missing time with "now".
    expect(postedAtOf(null, NOW, NOW)).toBeNull();
    expect(postedAtOf(null, new Date(Number.NaN), NOW)).toBeNull();
    expect(postedAtOf(null, null, NOW)).toBeNull();
    expect(postedAtOf(null, new Date("2015-12-31T23:59:59.000Z"), NOW)).toBeNull();
  });
});

// ─── The link shown, and the account ────────────────────────────────────────

describe("postHref", () => {
  it("builds the link from a valid handle and id", () => {
    expect(postHref("nia.cooks", "7301444403323456789")).toBe("https://www.tiktok.com/@nia.cooks/video/7301444403323456789");
    expect(postHref("a".repeat(50), "12345")).toBe(`https://www.tiktok.com/@${"a".repeat(50)}/video/12345`);
  });

  it.each([
    ["Nia.Cooks", "7301444403323456789"],
    ["@nia.cooks", "7301444403323456789"],
    ["nia cooks", "7301444403323456789"],
    ["nia/../x", "7301444403323456789"],
    ["", "7301444403323456789"],
    ["a".repeat(51), "7301444403323456789"],
    ["nia.cooks", "1234"],
    ["nia.cooks", "1".repeat(26)],
    ["nia.cooks", "73014444033234567a9"],
    [null, "7301444403323456789"],
    ["nia.cooks", null],
  ])("is null for %j and %j", (handle, id) => {
    expect(postHref(handle, id)).toBeNull();
  });
});

describe("handleOf", () => {
  it("reads the handle from the canonical link, in lower case", () => {
    expect(handleOf({ videoUrl: "https://www.tiktok.com/@Nia.Cooks/video/7301444403323456789", author: { handle: "someone.else" } })).toBe(
      "nia.cooks",
    );
  });

  it("falls back to the author's handle, without the @", () => {
    expect(handleOf({ videoUrl: "", author: { handle: "@Nia.Cooks" } })).toBe("nia.cooks");
    expect(handleOf({ videoUrl: "https://vm.tiktok.com/ZMmadeup1/", author: { handle: "nia.cooks" } })).toBe("nia.cooks");
    expect(handleOf({ videoUrl: "https://www.tiktok.com/@nia%20cooks/video/7301444403323456789", author: { handle: "nia.cooks" } })).toBe(
      "nia.cooks",
    );
    expect(handleOf({ videoUrl: "https://example.net/@nia.fake/video/7301444403323456789", author: { handle: "nia.cooks" } })).toBe(
      "nia.cooks",
    );
  });

  it("is null when neither validates", () => {
    expect(handleOf({ videoUrl: "" })).toBeNull();
    expect(handleOf({ videoUrl: "not a link", author: { handle: "nia cooks" } })).toBeNull();
    expect(handleOf({ videoUrl: "https://www.tiktok.com/@/video/7301444403323456789", author: { handle: "" } })).toBeNull();
  });
});

// ─── States ─────────────────────────────────────────────────────────────────

describe("stateOf", () => {
  it("is unread when the post is gone, read or not", () => {
    expect(stateOf(rowOf({ read_error: "gone" }))).toBe("unread");
    expect(stateOf(readRow({ read_error: "gone" }))).toBe("unread");
  });

  it("is unread as soon as the first read of a post never read failed (ruling 19a)", () => {
    expect(stateOf(rowOf({ read_error: "failed", attempts: 1 }))).toBe("unread");
    expect(stateOf(rowOf({ read_error: "failed", attempts: 2 }))).toBe("unread");
    expect(stateOf(rowOf({ read_error: "failed", attempts: 3 }))).toBe("unread");
    // Not yet tried, or tried again from no failures ("Try again"): reading.
    expect(stateOf(rowOf({ read_error: null, attempts: 0 }))).toBe("reading");
    expect(stateOf(readRow({ read_error: "failed", attempts: 2 }))).toBe("so-far");
  });

  it("a failed read never hides numbers already read (ruling 14)", () => {
    expect(stateOf(readRow({ read_error: "failed", attempts: 3 }))).toBe("so-far");
    expect(stateOf(readRow({ read_error: "failed", attempts: 7 }))).toBe("so-far");
    expect(stateOf(readRow({ read_error: "failed", attempts: 3, settled_at: NOW.toISOString() }))).toBe("final");
    // Gone is gone, numbers or not.
    expect(stateOf(readRow({ read_error: "gone", attempts: 1 }))).toBe("unread");
  });

  it("is reading until numbers were read", () => {
    expect(stateOf(rowOf())).toBe("reading");
    expect(stateOf(rowOf({ settled_at: NOW.toISOString() }))).toBe("reading");
  });

  it("is final once settled, else so far", () => {
    expect(stateOf(readRow({ settled_at: NOW.toISOString() }))).toBe("final");
    expect(stateOf(readRow())).toBe("so-far");
  });
});

// ─── The usual ──────────────────────────────────────────────────────────────

const video = (n: number, views: number, age = 80 * HOUR, over: Partial<UsualVideo> = {}): UsualVideo => {
  const at = ago(age);
  return { platformVideoId: idAt(at, n), views, postedAt: at, ...over };
};

describe("usualOf", () => {
  it("is the median of an odd count, with how many posts it rests on", () => {
    const list = [500, 100, 900, 300, 700].map((v, i) => video(i, v));
    expect(usualOf(list, null, NOW)).toEqual({ views: 500, posts: 5 });
  });

  it("is the middle two's mean for an even count", () => {
    const list = [600, 100, 900, 300, 700, 200].map((v, i) => video(i, v));
    expect(usualOf(list, null, NOW)).toEqual({ views: 450, posts: 6 });
  });

  it("is null under five posts", () => {
    expect(usualOf([100, 200, 300, 400].map((v, i) => video(i, v)), null, NOW)).toBeNull();
  });

  it("leaves out a pinned post", () => {
    const list = [100, 200, 300, 400, 500].map((v, i) => video(i, v));
    expect(usualOf([...list, video(9, 1_000_000, 80 * HOUR, { isPinned: true })], null, NOW)).toEqual({ views: 300, posts: 5 });
    expect(usualOf([...list.slice(0, 4), video(9, 500, 80 * HOUR, { isPinned: true })], null, NOW)).toBeNull();
  });

  it("leaves out the post it is the usual for", () => {
    const list = [100, 200, 300, 400, 500].map((v, i) => video(i, v));
    expect(usualOf(list, list[4]!.platformVideoId, NOW)).toBeNull();
    expect(usualOf([...list, video(9, 600)], list[4]!.platformVideoId, NOW)).toEqual({ views: 300, posts: 5 });
  });

  it("counts a post from 72 hours and not at 71 h 59 min", () => {
    const four = [100, 200, 300, 400].map((v, i) => video(i, v));
    expect(usualOf([...four, video(9, 500, 72 * HOUR)], null, NOW)).toEqual({ views: 300, posts: 5 });
    expect(usualOf([...four, video(9, 500, 72 * HOUR - MINUTE)], null, NOW)).toBeNull();
  });

  it("ages a post by its id when the scraper filled its time with now", () => {
    const list = [100, 200, 300, 400].map((v, i) => video(i, v));
    const old = ago(5 * 24 * HOUR);
    expect(usualOf([...list, { platformVideoId: idAt(old, 9), views: 500, postedAt: NOW }], null, NOW)).toEqual({ views: 300, posts: 5 });
  });

  it("counts a post once", () => {
    const list = [100, 200, 300, 400].map((v, i) => video(i, v));
    expect(usualOf([...list, list[0]!], null, NOW)).toBeNull();
  });

  it("is null when the median is 0", () => {
    expect(usualOf([0, 0, 0, 10, 20].map((v, i) => video(i, v)), null, NOW)).toBeNull();
  });
});

describe("toneOf", () => {
  // Decided on the ratio as shown (ruling 7): toneOf rounds what it is given with roundRatio (half up at the
  // first decimal), so a raw ratio cannot be toned by mistake. Green from a shown 1.5, coral up to a shown 0.6.
  it.each([
    [1.5, "above"],
    [1.45, "above"], // shown 1.5
    [1.449, "around"], // shown 1.4
    [12, "above"],
    [1, "around"],
    [0.67, "around"], // shown 0.7
    [0.65, "around"], // shown 0.7
    [0.649, "below"], // shown 0.6
    [0.6, "below"],
    [0.1, "below"],
    [0.04, "below"], // shown "under 0.1×"
    [0, "below"],
  ] as const)("%s is %s", (ratio, tone) => {
    expect(toneOf(ratio)).toBe(tone);
  });

  it("gives a ratio the tone of its shown value", () => {
    for (const raw of [0.05, 0.55, 0.649, 0.65, 0.66, 0.95, 1.449, 1.45, 1.46, 3.33, 9.96, 14.2]) {
      expect(toneOf(raw)).toBe(toneOf(roundRatio(raw)));
    }
  });
});

describe("roundRatio", () => {
  it("rounds as the words show it: one decimal below 10, whole from 10, nothing under 0.1", () => {
    expect(roundRatio(1.84)).toBe(1.8);
    expect(roundRatio(1.46)).toBe(1.5);
    expect(roundRatio(1.45)).toBe(1.5);
    expect(roundRatio(1.449)).toBe(1.4);
    expect(roundRatio(0.65)).toBe(0.7);
    expect(roundRatio(0.649)).toBe(0.6);
    expect(roundRatio(14_500 / 10_000)).toBe(1.5);
    expect(roundRatio(9.94)).toBe(9.9);
    expect(roundRatio(9.96)).toBe(10);
    expect(roundRatio(12.4)).toBe(12);
    expect(roundRatio(0.14)).toBe(0.1);
    expect(roundRatio(0.04)).toBe(0.04);
  });
});

// ─── A read owed ────────────────────────────────────────────────────────────

describe("isDue", () => {
  it("is false once settled, and for an unread post", () => {
    expect(isDue(readRow({ settled_at: ago(HOUR).toISOString(), read_at: ago(30 * HOUR).toISOString() }), NOW)).toBe(false);
    expect(isDue(rowOf({ read_error: "gone" }), NOW)).toBe(false);
    expect(isDue(readRow({ read_error: "gone", read_at: ago(30 * HOUR).toISOString() }), NOW)).toBe(false);
    expect(isDue(rowOf({ read_error: "failed", attempts: 3, last_attempt_at: ago(HOUR).toISOString() }), NOW)).toBe(false);
    expect(isDue(rowOf({ read_error: "failed", attempts: 3, last_attempt_at: ago(30 * HOUR).toISOString() }), NOW)).toBe(false);
  });

  it("after three failures in a row, tries a post with numbers again every 12 hours from the last attempt (ruling 14)", () => {
    const spent = (sinceAttempt: number, over = {}) =>
      readRow({ read_error: "failed", attempts: 3, read_at: ago(40 * HOUR).toISOString(), last_attempt_at: ago(sinceAttempt).toISOString(), ...over });
    expect(isDue(spent(12 * HOUR - 1), NOW)).toBe(false);
    expect(isDue(spent(12 * HOUR), NOW)).toBe(true);
    // Past its 72 hours too: the 12-hour wait still holds.
    expect(isDue(spent(11 * HOUR, { posted_at: ago(100 * HOUR).toISOString() }), NOW)).toBe(false);
    expect(isDue(spent(12 * HOUR, { posted_at: ago(100 * HOUR).toISOString() }), NOW)).toBe(true);
    // Before the third failure, only the ten-minute wait.
    expect(isDue(spent(11 * MINUTE, { attempts: 2 }), NOW)).toBe(true);
    expect(isDue(spent(9 * MINUTE, { attempts: 2 }), NOW)).toBe(false);
  });

  it("waits ten minutes after a failed read of a post with numbers", () => {
    const failed = (sinceAttempt: number) =>
      readRow({ read_error: "failed", attempts: 1, read_at: ago(13 * HOUR).toISOString(), last_attempt_at: ago(sinceAttempt).toISOString() });
    expect(isDue(failed(10 * MINUTE - 1), NOW)).toBe(false); // 9 min 59.999 s
    expect(isDue(failed(10 * MINUTE), NOW)).toBe(true);
  });

  it("is false for a post never read whose first read failed: only Try again reads it (ruling 19a)", () => {
    expect(isDue(rowOf({ read_error: "failed", attempts: 1, last_attempt_at: ago(10 * HOUR).toISOString() }), NOW)).toBe(false);
  });

  it("is true when nothing was read yet", () => {
    expect(isDue(rowOf(), NOW)).toBe(true);
  });

  it("is true from 72 hours after the post, however recent the last read", () => {
    const read = ago(MINUTE).toISOString();
    expect(isDue(readRow({ posted_at: ago(72 * HOUR).toISOString(), read_at: read }), NOW)).toBe(true);
    expect(isDue(readRow({ posted_at: ago(72 * HOUR - MINUTE).toISOString(), read_at: read }), NOW)).toBe(false);
  });

  it("is true when the last read is 12 hours old", () => {
    expect(isDue(readRow({ read_at: ago(12 * HOUR).toISOString() }), NOW)).toBe(true);
    expect(isDue(readRow({ read_at: ago(12 * HOUR - MINUTE).toISOString() }), NOW)).toBe(false);
    expect(isDue(readRow({ posted_at: null, read_at: ago(13 * HOUR).toISOString() }), NOW)).toBe(true);
  });

  it("without a post time, counts the 72 hours from the link (ruling 6)", () => {
    const read = ago(MINUTE).toISOString();
    expect(isDue(readRow({ posted_at: null, read_at: read, created_at: ago(72 * HOUR).toISOString() }), NOW)).toBe(true);
    expect(isDue(readRow({ posted_at: null, read_at: read, created_at: ago(72 * HOUR - MINUTE).toISOString() }), NOW)).toBe(false);
  });
});

describe("a post that can no longer be read (ruling 34)", () => {
  it("is never due once its failures in a row reach RETRY_MAX, with numbers or without", () => {
    const later = new Date(NOW.getTime() + 30 * HOUR);
    const spent = (attempts: number) =>
      readRow({ read_error: "failed", attempts, read_at: ago(40 * HOUR).toISOString(), last_attempt_at: ago(13 * HOUR).toISOString() });
    expect(isDue(spent(RETRY_MAX - 1), NOW)).toBe(true);
    expect(isDue(spent(RETRY_MAX), NOW)).toBe(false);
    expect(isDue(spent(RETRY_MAX), later)).toBe(false);
    // A post never read whose reads were reset (no error) but whose count is spent: not due either.
    expect(isDue(rowOf({ read_error: null, attempts: RETRY_MAX, last_attempt_at: ago(HOUR).toISOString() }), later)).toBe(false);
  });

  it("settled with numbers is final, also when its last read found it gone", () => {
    expect(stateOf(readRow({ read_error: "gone", attempts: RETRY_MAX, settled_at: NOW.toISOString() }))).toBe("final");
    expect(stateOf(readRow({ read_error: "failed", attempts: RETRY_MAX, settled_at: NOW.toISOString() }))).toBe("final");
    // Without numbers, a settled row is still not final.
    expect(stateOf(rowOf({ read_error: "gone", settled_at: NOW.toISOString() }))).toBe("unread");
  });
});

describe("isBeingRead (rulings 22 and 26)", () => {
  const attempt = (sinceAttempt: number, over = {}) => rowOf({ last_attempt_at: ago(sinceAttempt).toISOString(), ...over });
  it("is true while the last attempt is under 240 seconds old (the longest read) and has not ended", () => {
    expect(CLAIM_SECONDS).toBe(240);
    expect(RETRY_MAX).toBe(8);
    expect(isBeingRead(attempt(0), NOW)).toBe(true);
    expect(isBeingRead(attempt(60_000), NOW)).toBe(true);
    expect(isBeingRead(attempt(200_000), NOW)).toBe(true);
    expect(isBeingRead(attempt(239_999), NOW)).toBe(true);
    // A read that worked before this attempt has not ended it.
    expect(isBeingRead(attempt(10_000, { read_at: ago(HOUR).toISOString() }), NOW)).toBe(true);
  });

  it("is false from 240 seconds on, with no attempt, or once the attempt ended (failed, or worked at or after it)", () => {
    expect(isBeingRead(attempt(240_000), NOW)).toBe(false);
    expect(isBeingRead(attempt(241_000), NOW)).toBe(false);
    expect(isBeingRead(rowOf({ last_attempt_at: null }), NOW)).toBe(false);
    expect(isBeingRead(attempt(10_000, { read_error: "failed" }), NOW)).toBe(false);
    expect(isBeingRead(attempt(10_000, { read_error: "gone" }), NOW)).toBe(false);
    expect(isBeingRead(attempt(10_000, { read_at: ago(10_000).toISOString() }), NOW)).toBe(false);
    expect(isBeingRead(attempt(10_000, { read_at: ago(5_000).toISOString() }), NOW)).toBe(false);
  });
});

describe("finalAtOf", () => {
  it("is 72 hours after the post, or after the link when the post's time is unknown", () => {
    expect(finalAtOf({ posted_at: "2026-11-20T09:30:00+00:00", created_at: "2026-11-21T10:00:00+00:00" })?.toISOString()).toBe(
      "2026-11-23T09:30:00.000Z",
    );
    expect(finalAtOf({ posted_at: null, created_at: "2026-11-21T10:00:00.123456+00:00" })?.toISOString()).toBe("2026-11-24T10:00:00.123Z");
  });
});

// ─── What leaves the server ─────────────────────────────────────────────────

describe("toPosted", () => {
  it("turns a final row into the shape that leaves the server", () => {
    const postedAt = new Date("2026-11-20T09:30:00.000Z");
    const id = idAt(postedAt);
    const row = readRow({
      piece_kind: "video",
      piece_key: "vid_madeup01",
      said_number: 41,
      said_measure: "end",
      post_id: id,
      posted_at: "2026-11-20T09:30:00+00:00",
      post_url: "https://www.tiktok.com/@nia.cooks/video/" + id,
      views: 31_000,
      settled_at: "2026-11-23T10:00:00.5+00:00",
      read_at: "2026-11-23T10:00:00.5+00:00",
      usual_views: 17_200,
      usual_posts: 9,
    });
    expect(toPosted(row, NOW)).toEqual({
      id: ROW_ID,
      threadId: CHAT,
      pieceKey: "vid_madeup01",
      said: { number: 41, measure: "end" },
      state: "final",
      linkedAt: "2026-11-20T10:00:00.123Z",
      postedAt: "2026-11-20T09:30:00.000Z",
      finalAt: "2026-11-23T09:30:00.000Z",
      numbers: { views: 31_000, likes: 2_100, comments: 84, shares: 310, saves: 420 },
      usual: { ratio: 1.8, tone: "above" },
      handle: "nia.cooks",
      href: `https://www.tiktok.com/@nia.cooks/video/${id}`,
      due: false,
    });
  });

  it("without a post time: postedAt stays null, finalAt counts from the link", () => {
    const posted = toPosted(readRow({ posted_at: null, created_at: "2026-11-22T10:00:00.123456+00:00" }), NOW);
    expect(posted.postedAt).toBeNull();
    expect(posted.finalAt).toBe("2026-11-25T10:00:00.123Z");
    expect(posted.state).toBe("so-far");
  });

  it("a row just linked: no numbers, no post time, no link, a read owed", () => {
    const posted = toPosted(rowOf(), NOW);
    expect(posted).toMatchObject({
      state: "reading",
      said: { number: 67, measure: "stop" },
      postedAt: null,
      finalAt: "2026-11-23T10:00:00.123Z", // 72 h after the link

      numbers: null,
      usual: null,
      handle: null,
      href: null,
      due: true,
    });
  });

  it("gives no usual before the numbers are final, nor without one", () => {
    expect(toPosted(readRow({ usual_views: 10_000, usual_posts: 5 }), NOW).usual).toBeNull();
    expect(toPosted(readRow({ settled_at: NOW.toISOString() }), NOW).usual).toBeNull();
  });

  it("tones the ratio as it is shown, so a shown 1.5× is always green and a shown 0.7× never coral", () => {
    const final = (views: number) => toPosted(readRow({ views, settled_at: NOW.toISOString(), usual_views: 10_000, usual_posts: 5 }), NOW).usual;
    expect(final(14_600)).toEqual({ ratio: 1.5, tone: "above" });
    expect(final(14_400)).toEqual({ ratio: 1.4, tone: "around" });
    expect(final(6_600)).toEqual({ ratio: 0.7, tone: "around" });
    expect(final(6_400)).toEqual({ ratio: 0.6, tone: "below" });
    expect(final(500)).toEqual({ ratio: 0.05, tone: "below" });
  });

  it("never builds a link from stored text that does not validate", () => {
    const posted = toPosted(readRow({ handle: "Nia.Cooks" }), NOW);
    expect(posted.handle).toBeNull();
    expect(posted.href).toBeNull();
    expect(JSON.stringify(posted)).not.toContain("vm.tiktok.com");
  });

  it("holds no part of the row that is not in the contract", () => {
    expect(Object.keys(toPosted(readRow(), NOW)).sort()).toEqual(
      ["id", "threadId", "pieceKey", "said", "state", "linkedAt", "postedAt", "finalAt", "numbers", "usual", "handle", "href", "due"].sort(),
    );
  });
});
