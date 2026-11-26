/**
 * A followed creator's page as pure rules: a read's videos as the cards and the sheet draw them (the last
 * read only, biggest jump first), the figures, when Read again may be pressed, the read's date, their
 * audience among the caller's, and the page of a creator whose read failed. Pure; every handle, id and
 * address here is made up.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { described, other, own, uuid } from "@/lib/audience-next/__tests__/audiences";
import { AUDIENCE_STRINGS } from "@/lib/audience-next/audience-words";
import type { Audience } from "@/lib/audience/audience-types";

import {
  OWN_AVERAGE_LABEL,
  OWN_LABEL,
  READ_GATE_MS,
  builtOn,
  canReadAgainAt,
  creatorFiguresOf,
  creatorPageOf,
  creatorVideoOf,
  creatorVideosOf,
  lastReadOf,
  theirAudience,
  type CreatorInput,
  type CreatorProfileRow,
  type CreatorVideoRow,
} from "../creator";
import { pulledCardOf } from "../pull";
import { multipleWords } from "../video-words";
import { removalOf } from "../watchlist";

const NOW = new Date("2026-11-25T12:00:00Z");
const READ_AT = "2026-07-13T09:00:00Z";
const OLDER_READ_AT = "2026-06-01T09:00:00Z";
const COVER = "https://proj.supabase.co/storage/v1/object/public/covers/tiktok/v1.jpg";
const PICTURE = "https://proj.supabase.co/storage/v1/object/public/avatars/tiktok/jay.jpg";

function row(over: Partial<CreatorVideoRow> = {}): CreatorVideoRow {
  return {
    platform_video_id: "v1",
    video_url: "https://videos.example/jay.makes/v1",
    description: "Desk build, day 3 #diy #fyp",
    views: 106_100,
    likes: 8_200,
    comments: 310,
    posted_at: "2026-07-01T10:00:00Z",
    outlier_multiplier: 12,
    baseline_label: "vs own",
    cover_url: COVER,
    ingested_at: READ_AT,
    baseline_views: 8_600,
    ...over,
  };
}

function profile(over: Partial<CreatorProfileRow> = {}): CreatorProfileRow {
  return {
    id: uuid(500),
    tiktok_handle: "jay.makes",
    display_name: "Jay Makes",
    bio: "Furniture from offcuts.",
    avatar_url: PICTURE,
    follower_count: 15_400_000,
    heart_count: 369_100_000,
    video_count: 6_364,
    last_scraped_at: READ_AT,
    scrape_status: "success",
    ...over,
  };
}

const SOURCE: CreatorInput["source"] = { held: false, mergedFrom: null, trackedIds: [uuid(600)], competitorId: uuid(500) };

const input = (over: Partial<CreatorInput> = {}): CreatorInput => ({
  source: SOURCE,
  profile: profile(),
  videos: [row()],
  audiences: [],
  now: NOW,
  ...over,
});

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);

/** Another creator's audience read from `handle` on `scrapedAt` (none: an undated read). */
function theirs(id: number, handle: string, scrapedAt: string | null, over: Partial<Audience> = {}): Audience {
  return other(
    {
      id: uuid(id),
      calibration: { source: "scrape", handle, ...(scrapedAt ? { scraped_at: scrapedAt } : {}), thin: false },
      ...over,
    },
    { handle, scrapedAt: scrapedAt ?? "" },
  );
}

describe("a video of a read as a card", () => {
  it("a video row becomes the pulled video the sheet draws", () => {
    expect(creatorVideoOf(row(), "jay.makes")).toStrictEqual({
      id: "v1",
      coverUrl: COVER,
      handle: "jay.makes",
      spokenHook: "Desk build, day 3",
      niche: null,
      platform: "tiktok",
      views: 106_100,
      postedAt: "2026-07-01T10:00:00Z",
      multiplier: 12,
      baselineLabel: "vs their average",
      proven: true,
      beat: false,
      extreme: false,
      formats: [],
      captioned: true,
      likes: 8_200,
      comments: 310,
      videoUrl: "https://videos.example/jay.makes/v1",
      // No clock given: no day worded.
      posted: null,
    });
  });

  it("the day it was posted, worded from the given clock; another year says its year; none for no date", () => {
    expect(creatorVideoOf(row(), "jay.makes", NOW)!.posted).toBe("Posted 1 Jul");
    expect(creatorVideoOf(row({ posted_at: "2025-12-30T10:00:00Z" }), "jay.makes", NOW)!.posted).toBe("Posted 30 Dec 2025");
    expect(creatorVideoOf(row({ posted_at: null }), "jay.makes", NOW)!.posted).toBeNull();
    expect(creatorVideoOf(row({ posted_at: "not a date" }), "jay.makes", NOW)!.posted).toBeNull();
  });

  it("beat their average from 1.5× up to 3×, with the basis: the multiple shows, not as proven", () => {
    expect(creatorVideoOf(row({ outlier_multiplier: 1.8 }), "jay.makes")).toMatchObject({ proven: false, beat: true, multiplier: 1.8 });
    expect(creatorVideoOf(row({ outlier_multiplier: "2.4" }), "jay.makes")!.beat).toBe(true);
    expect(creatorVideoOf(row({ outlier_multiplier: 1.4 }), "jay.makes")!.beat).toBe(false);
    expect(creatorVideoOf(row({ outlier_multiplier: 3 }), "jay.makes")).toMatchObject({ proven: true, beat: false });
    expect(creatorVideoOf(row({ outlier_multiplier: 2, baseline_label: null }), "jay.makes")!.beat).toBe(false);
  });

  it("has exactly the fields a pulled video's card has, so the two kinds of card cannot drift", () => {
    const pulled = pulledCardOf(
      {
        platformVideoId: "v1",
        videoUrl: "https://videos.example/jay.makes/v1",
        caption: "Desk build",
        views: 1,
        likes: 1,
        comments: 1,
        postedAt: READ_AT,
        multiplier: 3,
        baselineLabel: "vs their usual views",
      },
      { kind: "handle", input: "@jay.makes", handle: "jay.makes", shown: "@jay.makes" },
    );
    expect(Object.keys(creatorVideoOf(row(), "jay.makes")!).sort()).toEqual(Object.keys(pulled).sort());
  });

  it("the original only as a web address", () => {
    expect(creatorVideoOf(row({ video_url: "javascript:alert(1)" }), "jay.makes")?.videoUrl).toBeNull();
    expect(creatorVideoOf(row({ video_url: null }), "jay.makes")?.videoUrl).toBeNull();
  });

  it("a caption of hashtags only, or none: no line", () => {
    expect(creatorVideoOf(row({ description: "#diy #fyp" }), "jay.makes")?.spokenHook).toBeNull();
    expect(creatorVideoOf(row({ description: null }), "jay.makes")?.spokenHook).toBeNull();
  });

  it("a cover only when Maven stores it", () => {
    expect(creatorVideoOf(row(), "jay.makes")?.coverUrl).toBe(COVER);
    expect(creatorVideoOf(row({ cover_url: "https://p16-sign.tiktokcdn.example/obj/v1.jpg?x-expires=1" }), "jay.makes")?.coverUrl).toBeNull();
    expect(creatorVideoOf(row({ cover_url: null }), "jay.makes")?.coverUrl).toBeNull();
  });

  it('"vs own" is handed on as their average; another label as stored', () => {
    expect(OWN_LABEL).toBe("vs own");
    expect(OWN_AVERAGE_LABEL).toBe("vs their average");
    const video = creatorVideoOf(row(), "jay.makes")!;
    expect(video.baselineLabel).toBe("vs their average");
    expect(multipleWords(video)?.text).toBe("12× their average");
    expect(creatorVideoOf(row({ baseline_label: " VS Own " }), "jay.makes")?.baselineLabel).toBe("vs their average");
    expect(creatorVideoOf(row({ baseline_label: "vs niche" }), "jay.makes")?.baselineLabel).toBe("vs niche");
    expect(creatorVideoOf(row({ baseline_label: null }), "jay.makes")?.baselineLabel).toBeNull();
    expect(creatorVideoOf(row({ baseline_label: "  " }), "jay.makes")?.baselineLabel).toBeNull();
  });

  it("proven from 3× with a label; clamped at 100; past 100 is extreme", () => {
    expect(creatorVideoOf(row({ outlier_multiplier: 2.9 }), "jay.makes")).toMatchObject({ proven: false, multiplier: 2.9 });
    expect(creatorVideoOf(row({ outlier_multiplier: 3 }), "jay.makes")).toMatchObject({ proven: true, multiplier: 3 });
    expect(creatorVideoOf(row({ outlier_multiplier: 4.2, baseline_label: null }), "jay.makes")).toMatchObject({ proven: false, multiplier: 4.2 });
    expect(creatorVideoOf(row({ outlier_multiplier: "4.2" }), "jay.makes")).toMatchObject({ proven: true, multiplier: 4.2 });
    expect(creatorVideoOf(row({ outlier_multiplier: 412 }), "jay.makes")).toMatchObject({ proven: true, multiplier: 100, extreme: true });
    expect(creatorVideoOf(row({ outlier_multiplier: 99.9 }), "jay.makes")).toMatchObject({ extreme: false, multiplier: 99.9 });
    expect(creatorVideoOf(row({ outlier_multiplier: null }), "jay.makes")).toMatchObject({ proven: false, extreme: false, multiplier: null });
    expect(creatorVideoOf(row({ outlier_multiplier: "many" }), "jay.makes")).toMatchObject({ proven: false, multiplier: null });
  });

  it("a row with no id is left out; missing counts", () => {
    expect(creatorVideoOf(row({ platform_video_id: null }), "jay.makes")).toBeNull();
    expect(creatorVideoOf(row({ platform_video_id: "  " }), "jay.makes")).toBeNull();
    expect(creatorVideoOf(row({ views: null, likes: null, comments: null }), "jay.makes")).toMatchObject({ views: 0, likes: null, comments: null });
    expect(creatorVideoOf(row({ views: -4, likes: -1 }), "jay.makes")).toMatchObject({ views: 0, likes: null });
    expect(creatorVideoOf(row({ posted_at: null }), "jay.makes")?.postedAt).toBeNull();
  });
});

describe("the videos of the last read", () => {
  it("the last read only", () => {
    const rows = [
      row({ platform_video_id: "old1", ingested_at: OLDER_READ_AT }),
      row({ platform_video_id: "new1" }),
      row({ platform_video_id: "old2", ingested_at: OLDER_READ_AT }),
      row({ platform_video_id: "new2", ingested_at: "2026-07-13T09:00:00.000Z" }),
    ];
    expect(lastReadOf(rows).map((r) => r.platform_video_id)).toEqual(["new1", "new2"]);
    expect(ids(creatorVideosOf(rows, "jay.makes").videos).sort()).toEqual(["new1", "new2"]);
  });

  it("a row without a readable read time is left out", () => {
    const rows = [row({ platform_video_id: "a" }), row({ platform_video_id: "b", ingested_at: null }), row({ platform_video_id: "c", ingested_at: "soon" })];
    expect(lastReadOf(rows).map((r) => r.platform_video_id)).toEqual(["a"]);
  });

  it("none readable: no videos and no usual views", () => {
    const rows = [row({ ingested_at: null }), row({ ingested_at: "" })];
    expect(lastReadOf(rows)).toEqual([]);
    expect(creatorVideosOf(rows, "jay.makes")).toEqual({ videos: [], usual: null });
    expect(creatorVideosOf([], "jay.makes")).toEqual({ videos: [], usual: null });
  });

  it("biggest jump first, then views; each id once", () => {
    const rows = [
      row({ platform_video_id: "c", outlier_multiplier: 12, views: 9 }),
      row({ platform_video_id: "next", outlier_multiplier: 150 }),
      row({ platform_video_id: "c", outlier_multiplier: 12, views: 90 }),
      row({ platform_video_id: "top", outlier_multiplier: 412 }),
    ];
    const { videos } = creatorVideosOf(rows, "jay.makes");
    expect(ids(videos)).toEqual(["top", "next", "c"]);
    expect(videos[2]!.views).toBe(90);
    // Ordered by the raw multiple: 412 and 150 both show as clamped (equal views, and "next" sorts before
    // "top" by id), and still stand in their order.
    expect(videos.map((v) => v.multiplier)).toEqual([100, 100, 12]);
  });

  it("equal multiples: more views first; no multiple: last", () => {
    const rows = [
      row({ platform_video_id: "none", outlier_multiplier: null, views: 1_000_000 }),
      row({ platform_video_id: "few", outlier_multiplier: 12, views: 9 }),
      row({ platform_video_id: "many", outlier_multiplier: "12", views: 90 }),
    ];
    expect(ids(creatorVideosOf(rows, "jay.makes").videos)).toEqual(["many", "few", "none"]);
  });

  it("usual views: the last read's stored baseline, the first finite one above zero", () => {
    expect(creatorVideosOf([row({ platform_video_id: "a", baseline_views: 0 }), row({ platform_video_id: "b", baseline_views: "8600" })], "jay.makes").usual).toBe(8_600);
    expect(creatorVideosOf([row({ baseline_views: null }), row({ baseline_views: "" }), row({ baseline_views: "lots" })], "jay.makes").usual).toBeNull();
    // An older read's median is not this read's.
    expect(creatorVideosOf([row({ baseline_views: null }), row({ ingested_at: OLDER_READ_AT, baseline_views: 5_000 })], "jay.makes").usual).toBeNull();
  });

  it("no usual views: no Usual views figure", () => {
    const page = creatorPageOf(input({ videos: [row({ baseline_views: 0 })] }));
    expect(page.figures.map((f) => f.key)).toEqual(["followers", "likes", "posts"]);
  });
});

describe("the figures", () => {
  it("the figures, those known, in order", () => {
    expect(creatorFiguresOf(profile(), 8_600)).toEqual([
      { key: "followers", label: "Followers", value: "15.4M" },
      { key: "likes", label: "Likes", value: "369.1M" },
      { key: "posts", label: "Posts", value: "6.4K" },
      { key: "usual", label: "Usual views", value: "8.6K" },
    ]);
    expect(creatorFiguresOf(profile(), 8_600).map((f) => f.label)).toEqual([
      AUDIENCE_STRINGS.followers,
      AUDIENCE_STRINGS.likes,
      AUDIENCE_STRINGS.posts,
      AUDIENCE_STRINGS.usualViews,
    ]);
  });

  it("a null or 0 count is left out (a 0 is a read that found none)", () => {
    expect(creatorFiguresOf(profile({ follower_count: 0, heart_count: null }), null).map((f) => f.key)).toEqual(["posts"]);
    expect(creatorFiguresOf(profile({ follower_count: null, heart_count: 0, video_count: null }), 0)).toEqual([]);
  });
});

describe("Read again", () => {
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  it("the page's day is the server's: READ_GATE_MS is the ingest's CHANNEL_RESCRAPE_HOURS", () => {
    // Read from the source text, as the guards read sources: the ingest is a server module.
    const ingest = readFileSync(join(__dirname, "..", "..", "channels", "ingest.ts"), "utf8");
    const hours = /export const CHANNEL_RESCRAPE_HOURS\s*=\s*(\d+(?:\.\d+)?)\s*;/.exec(ingest);
    expect(hours, "CHANNEL_RESCRAPE_HOURS in src/lib/channels/ingest.ts").not.toBeNull();
    expect(READ_GATE_MS).toBe(Number(hours![1]) * 60 * 60 * 1000);
  });

  it("Read again: never read, or 24 hours old", () => {
    expect(canReadAgainAt(null, NOW)).toBe(true);
    expect(canReadAgainAt("not a date", NOW)).toBe(true);
    expect(canReadAgainAt(ago(23 * 3_600_000 + 59 * 60_000), NOW)).toBe(false);
    expect(canReadAgainAt(ago(24 * 3_600_000), NOW)).toBe(true);
  });

  it("the page carries the server's answer", () => {
    expect(creatorPageOf(input({ profile: profile({ last_scraped_at: ago(60_000) }) })).canReadAgain).toBe(false);
    expect(creatorPageOf(input()).canReadAgain).toBe(true);
    expect(creatorPageOf(input({ profile: profile({ last_scraped_at: null }) })).canReadAgain).toBe(true);
  });
});

describe("the read's date in words", () => {
  it("this year, another year, never", () => {
    expect(creatorPageOf(input()).read).toBe("read 13 Jul");
    expect(creatorPageOf(input({ profile: profile({ last_scraped_at: "2025-07-13T09:00:00Z" }) })).read).toBe("read 13 Jul 2025");
    expect(creatorPageOf(input({ profile: profile({ last_scraped_at: null }) })).read).toBeNull();
  });

  it("their audience's day, without the read's word", () => {
    expect(builtOn("2026-11-14T10:00:00Z", NOW)).toBe("14 Nov");
    expect(builtOn("2025-11-14T10:00:00Z", NOW)).toBe("14 Nov 2025");
    expect(builtOn(null, NOW)).toBeNull();
    expect(builtOn(undefined, NOW)).toBeNull();
    expect(builtOn("someday", NOW)).toBeNull();
  });
});

describe("their audience", () => {
  const NOV = "2026-11-14T10:00:00Z";

  it("another creator's audience read from this handle is found, with its day", () => {
    const a = other({ id: uuid(10), calibration: { source: "scrape", handle: "jay.makes", scraped_at: NOV, thin: false } }, { scrapedAt: NOV });
    expect(theirAudience([a], ["jay.makes"], NOW)).toEqual({ id: uuid(10), builtOn: "14 Nov" });
  });

  it("by the read's own handle when the calibration has none", () => {
    const a = other({ id: uuid(11), calibration: { source: "scrape", scraped_at: NOV, thin: false } }, { handle: "@Jay.Makes", scrapedAt: NOV });
    expect(theirAudience([a], ["jay.makes"], NOW)).toEqual({ id: uuid(11), builtOn: "14 Nov" });
  });

  it("a thin read of the handle counts", () => {
    const a = other({ id: uuid(12), goal_label: null, calibration: { source: "description", handle: "jay.makes", scraped_at: NOV, thin: true } }, { scrapedAt: NOV });
    expect(theirAudience([a], ["jay.makes"], NOW)?.id).toBe(uuid(12));
  });

  it("the creator's own, a described one with the handle as its name, another creator's: none", () => {
    const mine = own({ calibration: { source: "scrape", handle: "jay.makes", scraped_at: NOV, thin: false } }, { handle: "jay.makes" });
    const words = described({}, { handle: "jay.makes" });
    const leo = other();
    expect(theirAudience([mine, words, leo], ["jay.makes"], NOW)).toBeNull();
  });

  it("the folded spelling matches", () => {
    const a = theirs(13, "jay_makes", NOV);
    expect(theirAudience([a], ["jay.makes", "jay_makes"], NOW)?.id).toBe(uuid(13));
    expect(theirAudience([a], ["jay.makes", ""], NOW)).toBeNull();
    expect(creatorPageOf(input({ source: { ...SOURCE, mergedFrom: "@Jay_Makes" }, audiences: [a] })).audience?.id).toBe(uuid(13));
    expect(creatorPageOf(input({ audiences: [a] })).audience).toBeNull();
  });

  it("two of them: the newer read, in either order", () => {
    const newer = theirs(14, "jay.makes", NOV);
    const older = theirs(15, "jay.makes", "2026-10-02T10:00:00Z", { created_at: "2026-11-20T00:00:00Z" });
    expect(theirAudience([older, newer], ["jay.makes"], NOW)).toEqual({ id: uuid(14), builtOn: "14 Nov" });
    expect(theirAudience([newer, older], ["jay.makes"], NOW)).toEqual({ id: uuid(14), builtOn: "14 Nov" });
  });

  it("an undated one only when no dated one", () => {
    const undated = theirs(16, "jay.makes", null, { created_at: "2026-11-24T00:00:00Z" });
    const dated = theirs(17, "jay.makes", "2025-11-14T10:00:00Z");
    expect(theirAudience([undated, dated], ["jay.makes"], NOW)).toEqual({ id: uuid(17), builtOn: "14 Nov 2025" });
    expect(theirAudience([undated], ["jay.makes"], NOW)).toEqual({ id: uuid(16), builtOn: null });
  });

  it("none: null", () => {
    expect(theirAudience([], ["jay.makes"], NOW)).toBeNull();
    expect(creatorPageOf(input()).audience).toBeNull();
  });
});

describe("the page", () => {
  it("held: a failed read with nothing kept", () => {
    const page = creatorPageOf(
      input({ source: { ...SOURCE, held: true }, profile: profile({ scrape_status: "failed" }), videos: [row(), row({ platform_video_id: "v2" })] }),
    );
    expect(page).toMatchObject({
      handle: "jay.makes",
      held: true,
      name: null,
      bio: null,
      avatarUrl: null,
      figures: [],
      videos: [],
      read: "read 13 Jul",
      canReadAgain: true,
    });
    expect(page.removal).toEqual(removalOf(SOURCE));
    expect(page.removal).not.toBeNull();
    // Their audience is worked out as for any page: none here.
    expect(page.audience).toBeNull();
  });

  it("held, with an audience of theirs: the audience is worked out as for any page", () => {
    const page = creatorPageOf(input({ source: { ...SOURCE, held: true }, audiences: [theirs(30, "jay.makes", "2026-11-14T10:00:00Z")] }));
    expect(page.held).toBe(true);
    expect(page.audience).toEqual({ id: uuid(30), builtOn: "14 Nov" });
  });

  it("the page: who they are, their numbers, the last read's videos, Remove's records", () => {
    const page = creatorPageOf(input({ videos: [row({ platform_video_id: "a", outlier_multiplier: 3 }), row({ platform_video_id: "b", outlier_multiplier: 40 })] }));
    expect(page).toStrictEqual({
      handle: "jay.makes",
      name: "Jay Makes",
      bio: "Furniture from offcuts.",
      avatarUrl: PICTURE,
      held: false,
      read: "read 13 Jul",
      canReadAgain: true,
      figures: creatorFiguresOf(profile(), 8_600),
      videos: creatorVideosOf([row({ platform_video_id: "b", outlier_multiplier: 40 }), row({ platform_video_id: "a", outlier_multiplier: 3 })], "jay.makes", NOW).videos,
      audience: null,
      removal: { trackedIds: [uuid(600)], competitorId: uuid(500) },
    });
    expect(ids(page.videos)).toEqual(["b", "a"]);
  });

  it("the handle from the profile, bare and lower case; the cards carry it", () => {
    const page = creatorPageOf(input({ profile: profile({ tiktok_handle: " @Jay.Makes " }) }));
    expect(page.handle).toBe("jay.makes");
    expect(page.videos[0]!.handle).toBe("jay.makes");
  });

  it("name and bio trimmed; blank or none is null; no picture is null", () => {
    const page = creatorPageOf(input({ profile: profile({ display_name: "  Jay Makes  ", bio: "  Offcuts, mostly.\n " }) }));
    expect(page).toMatchObject({ name: "Jay Makes", bio: "Offcuts, mostly." });
    expect(creatorPageOf(input({ profile: profile({ display_name: "   ", bio: "", avatar_url: "  " }) }))).toMatchObject({ name: null, bio: null, avatarUrl: null });
    expect(creatorPageOf(input({ profile: profile({ display_name: null, bio: null, avatar_url: null }) }))).toMatchObject({ name: null, bio: null, avatarUrl: null });
  });

  it("Remove: the records the source rests on; none: no Remove", () => {
    const source = { ...SOURCE, trackedIds: [uuid(601), uuid(602)], competitorId: null };
    expect(creatorPageOf(input({ source })).removal).toEqual({ trackedIds: [uuid(601), uuid(602)], competitorId: null });
    expect(creatorPageOf(input({ source: { held: false, mergedFrom: null } })).removal).toBeNull();
  });

  it("the page survives a JSON round trip unchanged (the server hands it to the client)", () => {
    const page = creatorPageOf(
      input({
        videos: [row({ platform_video_id: "a" }), row({ platform_video_id: "b", outlier_multiplier: 412, cover_url: null })],
        audiences: [theirs(20, "jay.makes", "2026-11-14T10:00:00Z")],
      }),
    );
    expect(page.audience).toEqual({ id: uuid(20), builtOn: "14 Nov" });
    expect(JSON.parse(JSON.stringify(page))).toStrictEqual(page);
    const held = creatorPageOf(input({ source: { ...SOURCE, held: true } }));
    expect(JSON.parse(JSON.stringify(held))).toStrictEqual(held);
  });
});
