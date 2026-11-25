/**
 * Pulling a creator or words live (spec 3.6): what a search or an address asks to pull, when the hub
 * offers it, what a refused pull says, and how a pulled video becomes a card. Pure; made-up creators
 * only.
 */
import { describe, expect, it } from "vitest";

import { DISCOVER_DAILY_CAP } from "@/lib/discover/discover-cache";

import { badgeOf, cardLine, cardName, lineOf } from "../card";
import { PULL_INPUT_MAX, offerFor, pullFailureOf, pullSubjectOf, pulledCardOf, pulledCardsOf, type PullSubject, type PullTile } from "../pull";

const JAY: PullSubject = { kind: "handle", input: "@jay.makes", handle: "jay.makes", shown: "@jay.makes" };
const MEAL: PullSubject = { kind: "words", input: "meal prep", handle: null, shown: "meal prep" };

function tile(over: Partial<PullTile> = {}): PullTile {
  return {
    platformVideoId: "7300000000000000001",
    videoUrl: "https://www.tiktok.com/@jay.makes/video/7300000000000000001",
    caption: "I tried to build a desk with no tools #diy #fyp",
    views: 18_400_000,
    likes: 1_200_000,
    comments: 3_400,
    postedAt: "2026-07-30T10:00:00.000Z",
    multiplier: 16,
    baselineLabel: "vs their usual views",
    coverUrl: "https://covers.example/jay.makes/1.jpg",
    author: { handle: "jay.makes" },
    ...over,
  };
}

describe("pullSubjectOf: what an input asks to pull", () => {
  it("a @handle: the creator, written with its @", () => {
    expect(pullSubjectOf("@jay.makes")).toEqual(JAY);
  });

  it("a handle is read as TikTok writes it: trimmed, lower case", () => {
    expect(pullSubjectOf("  @Jay.Makes ")).toEqual(JAY);
  });

  it("a TikTok profile link: its creator", () => {
    expect(pullSubjectOf("https://www.tiktok.com/@jay.makes")).toEqual(JAY);
    expect(pullSubjectOf("tiktok.com/@jay.makes?lang=en")).toEqual(JAY);
  });

  it.each(["@", " @ ", "@j", "@jay makes", "@jay!makes", `@${"j".repeat(25)}`, "https://www.tiktok.com/t/ZT8abc"])(
    "a handle that is empty or not one Maven can read offers nothing: %j",
    (raw) => {
      expect(pullSubjectOf(raw)).toBeNull();
    },
  );

  it("a link to another platform: the not-TikTok row, with the input as typed", () => {
    expect(pullSubjectOf("instagram.com/jay.makes")).toEqual({ kind: "not-tiktok", input: "instagram.com/jay.makes", shown: "instagram.com/jay.makes" });
    expect(pullSubjectOf(" https://youtube.com/@jay.makes ")).toEqual({
      kind: "not-tiktok",
      input: "https://youtube.com/@jay.makes",
      shown: "https://youtube.com/@jay.makes",
    });
  });

  it("words of three characters or more: those words, trimmed", () => {
    expect(pullSubjectOf("  meal prep ")).toEqual(MEAL);
    expect(pullSubjectOf("abc")).toEqual({ kind: "words", input: "abc", handle: null, shown: "abc" });
  });

  it("words shorter than three characters offer nothing", () => {
    expect(pullSubjectOf("ab")).toBeNull();
    expect(pullSubjectOf(" a ")).toBeNull();
  });

  it("nothing, or only spaces: nothing", () => {
    expect(pullSubjectOf("")).toBeNull();
    expect(pullSubjectOf("   ")).toBeNull();
    expect(pullSubjectOf(null)).toBeNull();
    expect(pullSubjectOf(undefined)).toBeNull();
  });

  it("at most 200 characters, as the server counts them", () => {
    expect(PULL_INPUT_MAX).toBe(200);
    expect(pullSubjectOf("a".repeat(200))).toEqual({ kind: "words", input: "a".repeat(200), handle: null, shown: "a".repeat(200) });
    expect(pullSubjectOf("a".repeat(201))).toBeNull();
    // 100 emoji are 200 UTF-16 units: the server takes them; 101 it refuses.
    expect(pullSubjectOf("🍞".repeat(100))).not.toBeNull();
    expect(pullSubjectOf("🍞".repeat(101))).toBeNull();
  });
});

describe("offerFor: the pull row the hub shows for a search", () => {
  const nobody = () => false;

  it("a @handle not followed: its creator, whatever the library holds", () => {
    expect(offerFor("@jay.makes", { libraryMatches: 0, followed: nobody })).toEqual(JAY);
    expect(offerFor("@jay.makes", { libraryMatches: 12, followed: nobody })).toEqual(JAY);
  });

  it("a creator already followed: no row (asked by the bare handle)", () => {
    const asked: string[] = [];
    const followed = (handle: string) => {
      asked.push(handle);
      return handle === "jay.makes";
    };
    expect(offerFor("https://www.tiktok.com/@jay.makes", { libraryMatches: 0, followed })).toBeNull();
    expect(asked).toEqual(["jay.makes"]);
  });

  it("a link to another platform: the not-TikTok row", () => {
    expect(offerFor("instagram.com/jay.makes", { libraryMatches: 0, followed: nobody })).toMatchObject({ kind: "not-tiktok" });
  });

  it("words the library has no video for: those words", () => {
    expect(offerFor("meal prep", { libraryMatches: 0, followed: nobody })).toEqual(MEAL);
  });

  it("words the library has videos for: no row", () => {
    expect(offerFor("meal prep", { libraryMatches: 3, followed: nobody })).toBeNull();
  });

  it.each(["", "  ", "@", "@ ", "ab", "@jay makes"])("nothing to pull: no row (%j)", (q) => {
    expect(offerFor(q, { libraryMatches: 0, followed: nobody })).toBeNull();
  });
});

describe("pullFailureOf: what a refused pull says (after the app's walls)", () => {
  it("the daily limit, with the number from the answer", () => {
    expect(pullFailureOf(429, { error: "daily_cap_reached", used: 20, limit: 20 }, JAY)).toEqual({
      kind: "limit",
      sentence: "You've pulled 20 times today. Try again tomorrow.",
    });
    expect(pullFailureOf(429, { limit: 5 }, MEAL).sentence).toBe("You've pulled 5 times today. Try again tomorrow.");
    expect(pullFailureOf(429, { limit: 1 }, JAY).sentence).toBe("You've pulled 1 time today. Try again tomorrow.");
  });

  it.each([[null], [{}], [{ limit: "20" }], [{ limit: 0 }], [{ limit: -3 }], [{ limit: 2.5 }], [{ limit: Number.NaN }], ["text"]])(
    "the daily limit without a usable number says the app's own cap (%j)",
    (body) => {
      expect(pullFailureOf(429, body, JAY)).toEqual({
        kind: "limit",
        sentence: `You've pulled ${DISCOVER_DAILY_CAP} times today. Try again tomorrow.`,
      });
    },
  );

  it("a link the server cannot read: Only TikTok", () => {
    expect(pullFailureOf(400, { error: "unsupported_input", message: "anything" }, MEAL)).toEqual({
      kind: "not-tiktok",
      sentence: "Only TikTok can be read right now.",
    });
  });

  it.each([
    [400, { error: "input is required" }],
    [400, null],
    [500, null],
    [502, { error: "scrape_failed", message: "Scrape failed (timeout)" }],
    [0, null],
  ])("anything else (%i): Couldn't read, for a creator or for words", (status, body) => {
    expect(pullFailureOf(status, body, JAY)).toEqual({ kind: "read", sentence: "Couldn't read @jay.makes." });
    expect(pullFailureOf(status, body, MEAL)).toEqual({ kind: "read", sentence: "Couldn't read videos about “meal prep”." });
  });
});

describe("pullFailureOf: refusals a retry cannot change", () => {
  it.each([
    [403, { error: "verdict_sealed" }],
    [403, null],
    [415, null],
  ])("%i: the sentence, with no Try again (a refusal, not a failed read)", (status, body) => {
    expect(pullFailureOf(status, body, JAY)).toEqual({ kind: "refused", sentence: "Couldn't read @jay.makes." });
    expect(pullFailureOf(status, body, MEAL)).toEqual({ kind: "refused", sentence: "Couldn't read videos about “meal prep”." });
  });
});

describe("pulledCardOf: a pulled video as a card", () => {
  it("the card's fields: the platform's id, TikTok, the caption as the line, the creator, the numbers", () => {
    expect(pulledCardOf(tile(), JAY)).toEqual({
      id: "7300000000000000001",
      coverUrl: "https://covers.example/jay.makes/1.jpg",
      handle: "jay.makes",
      spokenHook: "I tried to build a desk with no tools",
      captioned: true,
      niche: null,
      platform: "tiktok",
      views: 18_400_000,
      postedAt: "2026-07-30T10:00:00.000Z",
      multiplier: 16,
      baselineLabel: "vs their usual views",
      proven: true,
      extreme: false,
      formats: [],
      likes: 1_200_000,
      comments: 3_400,
      videoUrl: "https://www.tiktok.com/@jay.makes/video/7300000000000000001",
    });
  });

  it("the line is the caption without its hashtags; a number after # is kept", () => {
    expect(pulledCardOf(tile({ caption: "#diy Desk   build,\nday 3 #fyp #foryoupage" }), JAY).spokenHook).toBe("Desk build, day 3");
    expect(pulledCardOf(tile({ caption: "My #1 tip for bread #bread" }), JAY).spokenHook).toBe("My #1 tip for bread");
    expect(pulledCardOf(tile({ caption: "Café run #café #día_1" }), JAY).spokenHook).toBe("Café run");
  });

  it("the line is marked as a caption, and shown as written: a caption is not held to the spoken line's placeholder rules", () => {
    const card = pulledCardOf(tile({ caption: "[part 2] the reveal #diy" }), JAY);
    expect(card).toMatchObject({ spokenHook: "[part 2] the reveal", captioned: true });
    expect(lineOf(card)).toBe("[part 2] the reveal");
    expect(cardName(card)).toBe("[part 2] the reveal");
    expect(lineOf(pulledCardOf(tile({ caption: "(no way) it worked" }), JAY))).toBe("(no way) it worked");
  });

  it("a caption of hashtags only, or none: no line (the card is named by its creator)", () => {
    expect(pulledCardOf(tile({ caption: "#diy #fyp" }), JAY).spokenHook).toBeNull();
    expect(pulledCardOf(tile({ caption: "" }), JAY).spokenHook).toBeNull();
    expect(pulledCardOf(tile({ caption: undefined as unknown as string }), JAY).spokenHook).toBeNull();
    expect(cardLine(pulledCardOf(tile({ caption: "#diy" }), JAY).spokenHook)).toBeNull();
  });

  it("the creator: the video's author, else the pulled handle; words with no author: none", () => {
    expect(pulledCardOf(tile({ author: { handle: "nia.cooks" } }), JAY).handle).toBe("nia.cooks");
    expect(pulledCardOf(tile({ author: { handle: "@Nia.Cooks " } }), JAY).handle).toBe("Nia.Cooks");
    expect(pulledCardOf(tile({ author: undefined }), JAY).handle).toBe("jay.makes");
    expect(pulledCardOf(tile({ author: undefined }), MEAL).handle).toBeNull();
    expect(pulledCardOf(tile({ author: { handle: "dev.lifts" } }), MEAL).handle).toBe("dev.lifts");
  });

  it("proven only with a basis and 3× or more", () => {
    expect(pulledCardOf(tile({ multiplier: 3 }), JAY).proven).toBe(true);
    expect(pulledCardOf(tile({ multiplier: 2.9 }), JAY).proven).toBe(false);
    expect(pulledCardOf(tile({ multiplier: null }), JAY)).toMatchObject({ proven: false, multiplier: null });
    expect(pulledCardOf(tile({ baselineLabel: null }), JAY)).toMatchObject({ proven: false, baselineLabel: null });
    expect(pulledCardOf(tile({ multiplier: Number.NaN }), JAY)).toMatchObject({ proven: false, multiplier: null });
    expect(badgeOf(pulledCardOf(tile({ multiplier: 2.9 }), JAY))).toBeNull();
  });

  it("past 100: clamped at 100 and marked, so the badge reads 100×+", () => {
    const card = pulledCardOf(tile({ multiplier: 412.7 }), JAY);
    expect(card).toMatchObject({ multiplier: 100, extreme: true, proven: true });
    expect(badgeOf(card)).toBe("100×+");
    expect(pulledCardOf(tile({ multiplier: 99.9 }), JAY).extreme).toBe(false);
  });

  it("no cover: none; the original only as a web address", () => {
    expect(pulledCardOf(tile({ coverUrl: undefined }), JAY).coverUrl).toBeNull();
    expect(pulledCardOf(tile({ coverUrl: "  " }), JAY).coverUrl).toBeNull();
    expect(pulledCardOf(tile({ videoUrl: "javascript:alert(1)" }), JAY).videoUrl).toBeNull();
    expect(pulledCardOf(tile({ videoUrl: "" }), JAY).videoUrl).toBeNull();
  });

  it("numbers that are not counts are left out: views 0, likes and comments none", () => {
    expect(pulledCardOf(tile({ views: Number.NaN, likes: -1, comments: undefined as unknown as number }), JAY)).toMatchObject({
      views: 0,
      likes: null,
      comments: null,
    });
  });

  it("a date that is not a string: none", () => {
    expect(pulledCardOf(tile({ postedAt: 12 as unknown as string }), JAY).postedAt).toBeNull();
  });
});

describe("pulledCardsOf: the answer's videos as cards", () => {
  it("keeps the server's order", () => {
    const cards = pulledCardsOf([tile({ platformVideoId: "b" }), tile({ platformVideoId: "a" }), tile({ platformVideoId: "c" })], JAY);
    expect(cards?.map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("skips an entry with no id, and keeps a repeated id once, in its first place", () => {
    const cards = pulledCardsOf(
      [tile({ platformVideoId: "a" }), null, { caption: "no id" }, tile({ platformVideoId: "" }), tile({ platformVideoId: "b" }), tile({ platformVideoId: "a", views: 1 })],
      JAY,
    );
    expect(cards?.map((c) => [c.id, c.views])).toEqual([
      ["a", 18_400_000],
      ["b", 18_400_000],
    ]);
  });

  it("an answer without a list of videos: null", () => {
    expect(pulledCardsOf(undefined, JAY)).toBeNull();
    expect(pulledCardsOf({ tiles: [] }, JAY)).toBeNull();
    expect(pulledCardsOf([], JAY)).toEqual([]);
  });
});
