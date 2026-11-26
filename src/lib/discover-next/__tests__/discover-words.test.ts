/**
 * Discover's words: the fixed
 * strings, the counted and named sentences, and the words never on screen. Pure.
 */
import { describe, expect, it } from "vitest";

import { badgeOf, cardMetaParts, cardName } from "../card";
import {
  DISCOVER_STRINGS,
  audienceBuilt,
  creatorLine,
  creatorMore,
  filterLine,
  followFailed,
  followNotSaved,
  followRefused,
  followers,
  followingToast,
  libraryHolds,
  nothingFromHandle,
  provenTally,
  provenVideos,
  pullFailed,
  pullLimit,
  pullLine,
  pullNone,
  pullRunning,
  pullTitle,
  pulledNumbers,
  readFailed,
  readingHandle,
  removeQuestion,
  removeRefused,
  seeAll,
  showVideos,
  videosCount,
  videosRead,
  viewsWords,
  type PullTopic,
} from "../discover-words";
import type { CardVideo } from "../hub-data";
import { nicheLabel } from "../niches";
import { multipleWords, platformName, videoMeta, watchLabel } from "../video-words";

const HANDLE: PullTopic = { kind: "handle", shown: "@jay.makes" };
const WORDS: PullTopic = { kind: "words", shown: "meal prep" };

describe("the fixed strings", () => {
  it("the hub", () => {
    expect(DISCOVER_STRINGS.hub).toEqual({
      title: "Discover",
      description: "Proven videos to make your own.",
      searchPlaceholder: "Search videos, or paste a @handle",
      searchName: "Search",
      clearSearch: "Clear search",
      filter: "Filter",
    });
    expect(DISCOVER_STRINGS.tabs).toEqual({ videos: "Videos", collections: "Collections", watchlist: "Watchlist" });
  });

  it("the Videos chip, its orders and the filter", () => {
    expect(DISCOVER_STRINGS.videos).toEqual({
      clear: "Clear",
      showMore: "Show more",
      noMatch: "No video matches that.",
      failed: "Couldn't load the videos.",
      tryAgain: "Try again",
    });
    expect(DISCOVER_STRINGS.orders).toEqual({ views: "Most viewed", jump: "Biggest jump", newest: "Newest" });
    expect(DISCOVER_STRINGS.filter).toEqual({ title: "Filter", niche: "Niche", platform: "Platform", order: "Order", all: "All" });
    expect(DISCOVER_STRINGS.platforms).toEqual({ tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" });
  });

  it("a video's page and the Remix sheet, the price said before the tap", () => {
    expect(DISCOVER_STRINGS.video).toEqual({
      title: "Video",
      shaky: "A small account makes this number shaky.",
      save: "Save",
      saveFailed: "Couldn't save this video.",
      removeFailed: "Couldn't remove this video.",
      newTab: ", opens in a new tab",
      why: "Why it works",
      more: "More",
      built: "How it's built",
      remix: "Remix this · 10 credits",
      remixLimit: "Remix works with TikTok videos for now.",
      gone: "This video isn't in the library any more.",
      back: "Back to Discover",
      failed: "Couldn't load this video.",
      tryAgain: "Try again",
    });
    expect(DISCOVER_STRINGS.remixSheet).toEqual({ title: "What do you want to make from this?", button: "Remix" });
  });

  it("Collections", () => {
    expect(DISCOVER_STRINGS.shelves).toEqual({
      formats: "Formats",
      visual_hooks: "Visual hooks",
      editing_styles: "Editing styles",
      signature_series: "Signature series",
    });
    expect(DISCOVER_STRINGS.collections).toEqual({
      noMatch: "No collection matches that.",
      title: "Collection",
      gone: "This collection isn't in the library any more.",
      back: "Back to Discover",
      failed: "Couldn't load this collection.",
      tryAgain: "Try again",
    });
  });

  it("the Watchlist and the Follow sheet; following is free", () => {
    expect(DISCOVER_STRINGS.watchlist).toEqual({
      held: "Couldn't be read",
      pull: "Pull their best videos · 5 credits",
      openOnTikTok: "Open on TikTok",
      remove: "Remove",
      cancel: "Cancel",
      followRow: "Follow a creator",
      followRowLine: "Paste a @handle",
      empty: "Nobody on your watchlist yet",
      follow: "Follow a creator",
      noMatch: "No creator matches that.",
      failed: "Couldn't load the watchlist.",
      tryAgain: "Try again",
    });
    expect(DISCOVER_STRINGS.follow).toEqual({
      title: "Follow a creator",
      fieldName: "TikTok @handle",
      placeholder: "@handle or link",
      button: "Follow",
      badInput: "Paste a TikTok @handle or link.",
    });
    expect(JSON.stringify(DISCOVER_STRINGS.follow)).not.toMatch(/credit/);
  });

  it("the creator's page", () => {
    expect(DISCOVER_STRINGS.creator).toEqual({
      title: "Creator",
      readAgain: "Read again",
      reading: "Reading…",
      readToday: "Read today. Maven reads a creator once a day.",
      held: "Couldn't be read",
      heldLine: "Maven couldn't read this account. Read again, or remove it.",
      build: "Build their audience",
      buildLine: "Then simulate your video for their viewers. About two minutes. Free.",
      simulate: "Simulate a video for their viewers",
      simulateFailed: "Couldn't switch the audience.",
      pull: "Pull their best videos · 5 credits",
      videos: "Their videos",
      order: "Biggest jump",
      noVideos: "No videos read yet. Read again to get their latest.",
      noVideosToday: "No videos read yet.",
      gone: "This creator isn't on your watchlist.",
      watchlist: "Watchlist",
      failed: "Couldn't load this creator.",
      tryAgain: "Try again",
    });
    // The words the row wrote before the page are the page's, unchanged.
    expect(DISCOVER_STRINGS.watchlist.held).toBe("Couldn't be read");
    expect(DISCOVER_STRINGS.watchlist.pull).toBe("Pull their best videos · 5 credits");
    expect(DISCOVER_STRINGS.creator.held).toBe(DISCOVER_STRINGS.watchlist.held);
    expect(DISCOVER_STRINGS.creator.pull).toBe(DISCOVER_STRINGS.watchlist.pull);
  });

  it("pulling", () => {
    expect(DISCOVER_STRINGS.pull).toEqual({
      button: "Pull",
      notTikTok: "Only TikTok can be read right now.",
      follow: "Follow",
      following: "Following",
      order: "Biggest jump",
      tryAgain: "Try again",
    });
  });
});

describe("counted words", () => {
  it("the count line", () => {
    expect(provenVideos(372)).toBe("372 proven videos");
    expect(provenVideos(1)).toBe("1 proven video");
    expect(provenVideos(0)).toBe("0 proven videos");
    expect(provenVideos(1200)).toBe("1,200 proven videos");
  });

  it("videos, and the filter's line", () => {
    expect(videosCount(15)).toBe("15 videos");
    expect(videosCount(1)).toBe("1 video");
    expect(filterLine(["Comedy"], 85)).toBe("Comedy · 85 videos");
    expect(filterLine(["TikTok"], 150)).toBe("TikTok · 150 videos");
    expect(filterLine(["Comedy", "TikTok"], 40)).toBe("Comedy · TikTok · 40 videos");
    expect(filterLine(["Comedy", "TikTok"], 1)).toBe("Comedy · TikTok · 1 video");
  });

  it("the filter's button and See all", () => {
    expect(showVideos(85)).toBe("Show 85 videos");
    expect(showVideos(1)).toBe("Show 1 video");
    expect(seeAll(22)).toBe("See all 22");
  });

  it("the watchlist's lines", () => {
    expect(followers(162_000_000)).toBe("162M followers");
    expect(followers(849_100)).toBe("849K followers");
    expect(followers(1)).toBe("1 follower");
    expect(provenTally(12)).toBe("12 proven");
    expect(libraryHolds(372)).toBe("372 proven videos are in the library");
    expect(libraryHolds(1)).toBe("1 proven video is in the library");
  });

  it("a pull's result", () => {
    expect(videosRead(30)).toBe("30 videos read");
    expect(videosRead(1)).toBe("1 video read");
    expect(pullLimit(20)).toBe("You've pulled 20 times today. Try again tomorrow.");
    expect(pullLimit(1)).toBe("You've pulled 1 time today. Try again tomorrow.");
  });

  it("the pulled sheet's numbers, a missing one left out with its dot", () => {
    expect(pulledNumbers({ views: 18_400_000, likes: 1_200_000, comments: 3_400 })).toBe("18.4M views · 1.2M likes · 3.4K comments");
    expect(pulledNumbers({ views: 1, likes: 1, comments: 1 })).toBe("1 view · 1 like · 1 comment");
    expect(pulledNumbers({ views: 849_100, likes: null, comments: undefined })).toBe("849K views");
    expect(pulledNumbers({ views: null, likes: Number.NaN, comments: 0 })).toBe("0 comments");
    expect(pulledNumbers({})).toBeNull();
  });
});

describe("named words: a handle written once with its @", () => {
  it.each(["jay.makes", "@jay.makes", " @@jay.makes "])("%j", (handle) => {
    expect(nothingFromHandle(handle)).toBe("Nothing from @jay.makes in the library yet.");
    expect(removeQuestion(handle)).toBe("Remove @jay.makes?");
    expect(removeRefused(handle)).toBe("Couldn't remove @jay.makes.");
    expect(readingHandle(handle)).toBe("Reading @jay.makes");
    expect(followingToast(handle)).toBe("Following @jay.makes");
    expect(followFailed(handle)).toBe("Couldn't follow @jay.makes. Check the handle and try again.");
    expect(followNotSaved(handle)).toBe("Couldn't follow @jay.makes. Try again.");
    expect(followRefused(handle)).toBe("Couldn't follow @jay.makes.");
  });
});

describe("the creator's sentences", () => {
  it("a card's foot: the views alone, as the card and the sheet count them", () => {
    expect(viewsWords(106_100)).toBe("106K views");
    expect(viewsWords(849_100)).toBe("849K views");
    expect(viewsWords(10_610)).toBe("10.6K views");
    expect(viewsWords(1)).toBe("1 view");
  });

  it("the card's line: a part not known is left out with its dot", () => {
    expect(creatorLine({ handle: "jay.makes", read: "read 13 Jul", videos: 12 })).toBe("@jay.makes · TikTok · read 13 Jul · 12 videos");
    expect(creatorLine({ handle: null, read: "Reading…", videos: 1 })).toBe("TikTok · Reading… · 1 video");
    expect(creatorLine({ handle: "jay.makes", read: null, videos: 0 })).toBe("@jay.makes · TikTok");
    expect(creatorLine({ handle: "@jay.makes", read: null, videos: 0 })).toBe("@jay.makes · TikTok");
  });

  it("the card's line breaks at its dots only: inside a part the spaces do not break", () => {
    const line = creatorLine({ handle: "jay.makes", read: "read 30 Dec 2025", videos: 1_200 });
    expect(line).toBe("@jay.makes · TikTok · read 30 Dec 2025 · 1,200 videos");
    // The dots keep their ordinary spaces; no part keeps one.
    const parts = line.split(" · ");
    expect(parts).toEqual(["@jay.makes", "TikTok", "read 30 Dec 2025", "1,200 videos"]);
    expect(parts.every((part) => !part.includes(" "))).toBe(true);
  });

  it("their audience's day, a failed read, and More's name", () => {
    expect(audienceBuilt("14 Nov")).toBe("Their audience was built 14 Nov.");
    expect(readFailed("@jay.makes")).toBe("Couldn't read @jay.makes. Try again later.");
    expect(readFailed("jay.makes")).toBe("Couldn't read @jay.makes. Try again later.");
    expect(creatorMore("jay.makes")).toBe("More: @jay.makes");
    expect(creatorMore("@jay.makes")).toBe("More: @jay.makes");
  });
});

describe("a pull's words, for a handle and for words", () => {
  it("the offer", () => {
    expect(pullTitle(HANDLE)).toBe("Pull @jay.makes's best videos");
    expect(pullLine(HANDLE)).toBe("Ranked against their own average. 5 credits.");
    expect(pullTitle(WORDS)).toBe("Pull videos about “meal prep”");
    expect(pullLine(WORDS)).toBe("5 credits");
  });

  it("running", () => {
    expect(pullRunning(HANDLE)).toBe("Reading @jay.makes's videos. This can take a few minutes.");
    expect(pullRunning(WORDS)).toBe("Reading videos about “meal prep”. This can take a few minutes.");
  });

  it("nothing found, and a failure", () => {
    expect(pullNone(HANDLE)).toBe("No standout videos for @jay.makes.");
    expect(pullNone(WORDS)).toBe("No standout videos about “meal prep”.");
    expect(pullFailed(HANDLE)).toBe("Couldn't read @jay.makes.");
    expect(pullFailed(WORDS)).toBe("Couldn't read videos about “meal prep”.");
  });

  it("a handle shown without its @ still gets one", () => {
    expect(pullTitle({ kind: "handle", shown: "jay.makes" })).toBe("Pull @jay.makes's best videos");
  });
});

describe("the words never on screen", () => {
  const BANNED = /\b(?:outlier|teardown|source|channel|scrap|track|usual|thread|test)\w*/i;

  function stringsOf(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (value && typeof value === "object") return Object.values(value).flatMap(stringsOf);
    return [];
  }

  const card: CardVideo = {
    id: "v1",
    coverUrl: null,
    handle: "dev.lifts",
    spokenHook: null,
    niche: "comedy-entertainment",
    platform: "tiktok",
    views: 39_800_000,
    postedAt: "2020-06-01T00:00:00Z",
    multiplier: 27,
    baselineLabel: "vs their usual views",
    proven: true,
    extreme: false,
    formats: [],
  };

  const results = [
    ...stringsOf(DISCOVER_STRINGS),
    provenVideos(372),
    provenVideos(1),
    videosCount(15),
    filterLine(["Comedy", "TikTok"], 40),
    showVideos(85),
    seeAll(22),
    followers(162_000_000),
    provenTally(12),
    libraryHolds(372),
    videosRead(30),
    pullLimit(20),
    pulledNumbers({ views: 18_400_000, likes: 1_200_000, comments: 3_400 }) ?? "",
    nothingFromHandle("jay.makes"),
    removeQuestion("jay.makes"),
    removeRefused("jay.makes"),
    readingHandle("jay.makes"),
    followingToast("jay.makes"),
    followFailed("jay.makes"),
    followNotSaved("jay.makes"),
    followRefused("jay.makes"),
    viewsWords(106_100),
    viewsWords(1),
    creatorLine({ handle: "jay.makes", read: "read 13 Jul", videos: 12 }),
    creatorLine({ handle: null, read: "Reading…", videos: 1 }),
    creatorLine({ handle: "jay.makes", read: null, videos: 0 }),
    audienceBuilt("14 Nov"),
    readFailed("jay.makes"),
    creatorMore("jay.makes"),
    ...[HANDLE, WORDS].flatMap((t) => [pullTitle(t), pullLine(t), pullRunning(t), pullNone(t), pullFailed(t)]),
    // The rules' words over their cases: the stored label says "usual", the words never do.
    ...[
      card,
      { ...card, baselineLabel: "vs followers" },
      { ...card, baselineLabel: "vs own" },
      { ...card, extreme: true, multiplier: 100 },
      { ...card, extreme: true, multiplier: 100, baselineLabel: "vs followers" },
    ].flatMap((v) => [multipleWords(v)?.text ?? "", badgeOf(v) ?? "", Object.values(cardMetaParts(v)).join(" "), cardName(v), videoMeta(v) ?? ""]),
    ...["tiktok", "instagram", "youtube", "other", null].flatMap((p) => [platformName(p) ?? "", watchLabel(p)]),
    ...["content-creation", "comedy", "self-improvement", "health-fitness", "beauty-fashion", "education-science", "relationships-family", "art-design", "other"].map(nicheLabel),
  ];

  it("has words to look at", () => {
    expect(results.filter(Boolean).length).toBeGreaterThan(80);
  });

  it.each(results.filter(Boolean))("%j holds none of them", (text) => {
    expect(text).not.toMatch(BANNED);
  });

  it("the check itself catches each of them", () => {
    for (const word of ["Outliers", "teardown", "Source", "channels", "scraped", "tracked", "usual", "thread", "Test"]) {
      expect(`a ${word} b`).toMatch(BANNED);
    }
    expect("Simulate the hook").not.toMatch(BANNED);
  });
});
