import { describe, expect, it } from "vitest";

import {
  accountCardOf,
  accountWhoOf,
  captionTitle,
  fixSentence,
  fixSentencesOf,
  habitsLineOf,
  ideasAskOf,
  initialsOf,
  topVideosOf,
} from "@/lib/thread-next/account-card";
import { viewsLabel } from "@/lib/multiple-words";
import { ACCOUNT_READ_BARE, ACCOUNT_READ_FULL, accountRead } from "@/components/thread-next/__tests__/fixtures/answers";
import type { AccountReadBlock } from "@/lib/tools/blocks";

type Props = AccountReadBlock["props"];
type Video = NonNullable<Props["analyzedVideos"]>[number];
type Patterns = NonNullable<Props["patterns"]>;

const v = (caption: string, views: number, coverUrl?: string): Video => ({
  caption,
  views,
  videoUrl: `/fixtures/v-${views}`,
  ...(coverUrl ? { coverUrl } : {}),
});

const patterns = (p: Partial<Patterns>): Patterns => ({ recurringHooks: [], formatMix: [], dropPoints: [], working: [], fix: [], ...p });

// The runner's three fixed lines (`account-read.ts`, `extractFix`).
const SCANNER = "scanner: hooks aren't surviving the first beat — sharpen your openers";
const LURKER = "lurker: retention drops mid-video — tighten the middle and cut dead air";
const SKEPTIC = "skeptic: viewers aren't convinced — add proof/specifics earlier";

describe("who was read", () => {
  it("the handle without its '@', the initials and '12.4K followers · 86 videos'", () => {
    expect(accountWhoOf(ACCOUNT_READ_FULL.props)).toEqual({
      handle: "creator_one",
      initials: "CO",
      avatar: "/avatars/creator-one.jpg",
      counts: "12.4K followers · 86 videos",
    });
  });

  it("a handle stored with an '@' (or several) is not doubled; spaces are trimmed", () => {
    expect(accountWhoOf(accountRead({ handle: " @@creator_one ", profile: undefined }).props).handle).toBe("creator_one");
  });

  it("the counts through the look's one short-number format (the hook row's '854K views')", () => {
    const profile = { ...ACCOUNT_READ_FULL.props.profile!, followerCount: 854_300, videoCount: 1_240 };
    expect(accountWhoOf(accountRead({ handle: "creator_one", profile }).props).counts).toBe(
      `${viewsLabel(854_300)} followers · ${viewsLabel(1_240)} videos`,
    );
    expect(viewsLabel(854_300)).toBe("854K");
  });

  it("each half only when its number is there; one of each is singular", () => {
    const base = ACCOUNT_READ_FULL.props.profile!;
    const counts = (followerCount: number, videoCount: number) =>
      accountWhoOf(accountRead({ handle: "creator_one", profile: { ...base, followerCount, videoCount } }).props).counts;
    expect(counts(0, 86)).toBe("86 videos");
    expect(counts(12_400, 0)).toBe("12.4K followers");
    expect(counts(0, 0)).toBeNull();
    expect(counts(Number.NaN, Number.NaN)).toBeNull();
    expect(counts(1, 1)).toBe("1 follower · 1 video");
  });

  it("no profile: the handle alone, no counts, no picture, the initials from the handle", () => {
    expect(accountWhoOf(accountRead({ handle: "creator_one", profile: undefined }).props)).toEqual({
      handle: "creator_one",
      initials: "CR",
      avatar: null,
      counts: null,
    });
  });

  it("an empty picture address is no picture", () => {
    expect(accountWhoOf(ACCOUNT_READ_BARE.props).avatar).toBeNull();
    const profile = { ...ACCOUNT_READ_FULL.props.profile!, avatarUrl: "   " };
    expect(accountWhoOf(accountRead({ handle: "creator_one", profile }).props).avatar).toBeNull();
  });
});

describe("initialsOf", () => {
  it("two words: their first letters; one word: its first two letters; upper case", () => {
    expect(initialsOf("Creator One", "creator_one")).toBe("CO");
    expect(initialsOf("nia", "creator_one")).toBe("NI");
    expect(initialsOf("  maya   lee  rose ", "creator_one")).toBe("ML");
  });

  it("marks that are not letters or figures are skipped", () => {
    expect(initialsOf("✨ Nia Tests ✨", "creator_one")).toBe("NT");
    expect(initialsOf("", "@creator.one")).toBe("CR");
  });

  it("no name to read: the handle's; nothing at all: empty", () => {
    expect(initialsOf("  ", "creator_one")).toBe("CR");
    expect(initialsOf("✨", "✨")).toBe("");
  });
});

describe("captionTitle", () => {
  it("drops the hashtags at its end and collapses the whitespace", () => {
    expect(captionTitle("How I meal prep a week for $12 #mealprep #budget")).toBe("How I meal prep a week for $12");
    expect(captionTitle("  Stop buying   protein bars,\nmake these  #protein  ")).toBe("Stop buying protein bars, make these");
  });

  it("a hashtag in the middle stays", () => {
    expect(captionTitle("My #1 lunch for finals #fyp")).toBe("My #1 lunch for finals");
  });

  it("a caption that is only hashtags is shown whole", () => {
    expect(captionTitle("#mealprep   #budget #fyp")).toBe("#mealprep #budget #fyp");
  });

  it("an empty caption is empty", () => {
    expect(captionTitle("   ")).toBe("");
  });
});

describe("the two most viewed videos", () => {
  it("sorted by views whatever the stored order, each with its title, '854K views' and its cover", () => {
    const videos = [v("Third #x", 21_000), v("First #a #b", 854_000, "/covers/c8.jpg"), v("Second", 146_000)];
    expect(topVideosOf(videos)).toEqual([
      { title: "First", views: "854K views", cover: "/covers/c8.jpg" },
      { title: "Second", views: "146K views", cover: null },
    ]);
  });

  it("views through the look's one formatter", () => {
    for (const views of [950, 21_000, 154_400, 999_600, 2_000_000]) {
      expect(topVideosOf([v("A video", views)])[0]?.views).toBe(`${viewsLabel(views)} views`);
    }
  });

  it("a video with no words to show is passed over; a blank cover is no cover", () => {
    const videos = [v("  ", 2_000_000, "/covers/c1.jpg"), v("Kept", 50_000, "  "), v("Also kept", 40_000), v("Third", 30_000)];
    expect(topVideosOf(videos)).toEqual([
      { title: "Kept", views: "50K views", cover: null },
      { title: "Also kept", views: "40K views", cover: null },
    ]);
  });

  it("none, one, or a count that is not a number", () => {
    expect(topVideosOf(undefined)).toEqual([]);
    expect(topVideosOf([])).toEqual([]);
    expect(topVideosOf([v("Only one", 1_200)])).toHaveLength(1);
    expect(topVideosOf([v("Broken", Number.NaN), v("Fine", 10)]).map((x) => x.title)).toEqual(["Fine"]);
  });
});

describe("To fix", () => {
  it("a line led by a word that names something every object has is read as any other line", () => {
    expect(fixSentence("constructor: the ending drags")).toBe("The ending drags.");
    expect(fixSentence("toString: cut the intro")).toBe("Cut the intro.");
  });

  it("the runner's three lines are the spec's sentences", () => {
    expect(fixSentence(SCANNER)).toBe("Your openings lose people in the first seconds. Sharpen the first line.");
    expect(fixSentence(LURKER)).toBe("The middle loses people. Tighten it and cut the dead air.");
    expect(fixSentence(SKEPTIC)).toBe("Viewers are not convinced. Show proof or specifics earlier.");
  });

  it("a known line is known by its leading word, whatever follows", () => {
    expect(fixSentence("Scanner: something new the runner says")).toBe("Your openings lose people in the first seconds. Sharpen the first line.");
  });

  it("any other line: its leading 'word:' dropped, ' — ' a full stop, each sentence capitalised and ended", () => {
    expect(fixSentence("collector: craft gap detected")).toBe("Craft gap detected.");
    expect(fixSentence("pacer: the cut is slow — trim the pauses")).toBe("The cut is slow. Trim the pauses.");
    expect(fixSentence("open with the result — show it first.")).toBe("Open with the result. Show it first.");
    expect(fixSentence("pacer: too long;")).toBe("Too long.");
  });

  it("a line with nothing left is no sentence", () => {
    expect(fixSentence("pacer:")).toBeNull();
    expect(fixSentence("   ")).toBeNull();
  });

  it("every line in order, the empty ones dropped; none: none", () => {
    expect(fixSentencesOf([LURKER, "  ", SCANNER])).toEqual([
      "The middle loses people. Tighten it and cut the dead air.",
      "Your openings lose people in the first seconds. Sharpen the first line.",
    ]);
    expect(fixSentencesOf([])).toEqual([]);
    expect(fixSentencesOf(undefined)).toEqual([]);
  });
});

describe("the habits line", () => {
  const SHORT = (count: number) => ({ label: "Short-form (≤30s)", count, pct: 0 });
  const LONG = (count: number) => ({ label: "Long-form (>30s)", count, pct: 0 });
  const HOW_I = '"How I…" (3 posts)';

  it("both halves", () => {
    expect(habitsLineOf(patterns({ formatMix: [SHORT(21), LONG(9)], recurringHooks: [HOW_I, '"Stop buying…" (2 posts)'] }))).toBe(
      "21 of 30 videos are 30 s or shorter. Three videos open with “How I…”.",
    );
  });

  it("the longer ones when they are the larger part, whatever the stored order; the seconds from the label", () => {
    expect(habitsLineOf(patterns({ formatMix: [SHORT(4), LONG(6)] }))).toBe("6 of 10 videos are longer than 30 s.");
    expect(habitsLineOf(patterns({ formatMix: [{ label: "Long-form (>45s)", count: 6, pct: 60 }, { label: "Short-form (≤45s)", count: 4, pct: 40 }] }))).toBe(
      "6 of 10 videos are longer than 45 s.",
    );
  });

  it("an even split, or one kind only", () => {
    expect(habitsLineOf(patterns({ formatMix: [LONG(5), SHORT(5)] }))).toBe("5 of 10 videos are 30 s or shorter.");
    expect(habitsLineOf(patterns({ formatMix: [SHORT(12)] }))).toBe("12 of 12 videos are 30 s or shorter.");
    expect(habitsLineOf(patterns({ formatMix: [LONG(3)] }))).toBe("3 of 3 videos are longer than 30 s.");
  });

  it("the opening alone; two to nine as words, 10 and up as figures", () => {
    expect(habitsLineOf(patterns({ recurringHooks: [HOW_I] }))).toBe("Three videos open with “How I…”.");
    expect(habitsLineOf(patterns({ recurringHooks: ['"Day in…" (2 posts)'] }))).toBe("Two videos open with “Day in…”.");
    expect(habitsLineOf(patterns({ recurringHooks: ['"Day in…" (9 posts)'] }))).toBe("Nine videos open with “Day in…”.");
    expect(habitsLineOf(patterns({ recurringHooks: ['"Day in…" (12 posts)'] }))).toBe("12 videos open with “Day in…”.");
  });

  // Fix round 1 (review M2): one video says nothing about a habit.
  it("one video read: no short or long half; the opening still speaks", () => {
    expect(habitsLineOf(patterns({ formatMix: [SHORT(1)] }))).toBeNull();
    expect(habitsLineOf(patterns({ formatMix: [LONG(1)] }))).toBeNull();
    expect(habitsLineOf(patterns({ formatMix: [SHORT(1), LONG(0)], recurringHooks: [HOW_I] }))).toBe("Three videos open with “How I…”.");
    expect(habitsLineOf(patterns({ formatMix: [SHORT(1), LONG(1)] }))).toBe("1 of 2 videos are 30 s or shorter.");
  });

  it("neither: no line; a line it cannot read is no half", () => {
    expect(habitsLineOf(patterns({}))).toBeNull();
    expect(habitsLineOf(undefined)).toBeNull();
    expect(habitsLineOf(patterns({ formatMix: [{ label: "Other", count: 3, pct: 100 }], recurringHooks: ["How I"] }))).toBeNull();
    expect(habitsLineOf(patterns({ formatMix: [SHORT(0), LONG(0)] }))).toBeNull();
    expect(habitsLineOf(patterns({ recurringHooks: ['"Day in…" (1 post)'] }))).toBeNull();
  });
});

describe("the follow-up the button sends", () => {
  it("the ask, then one line per video: '- caption (854K views)'", () => {
    expect(ideasAskOf(topVideosOf(ACCOUNT_READ_FULL.props.analyzedVideos))).toBe(
      "Give me ideas built on what already works on my account:\n" +
        "- How I meal prep a week for $12 (854K views)\n" +
        "- Stop buying protein bars, make these (146K views)",
    );
  });

  it("one video: one line; none: nothing to send", () => {
    expect(ideasAskOf([{ title: "Only one", views: "1.2K views", cover: null }])).toBe(
      "Give me ideas built on what already works on my account:\n- Only one (1.2K views)",
    );
    expect(ideasAskOf([])).toBeNull();
  });
});

describe("accountCardOf", () => {
  it("a real run's read, whole", () => {
    expect(accountCardOf(ACCOUNT_READ_FULL.props)).toEqual({
      who: { handle: "creator_one", initials: "CO", avatar: "/avatars/creator-one.jpg", counts: "12.4K followers · 86 videos" },
      videos: [
        { title: "How I meal prep a week for $12", views: "854K views", cover: "/covers/c8.jpg" },
        { title: "Stop buying protein bars, make these", views: "146K views", cover: "/covers/c9.jpg" },
      ],
      fixes: [
        "The middle loses people. Tighten it and cut the dead air.",
        "Your openings lose people in the first seconds. Sharpen the first line.",
      ],
      habits: "21 of 30 videos are 30 s or shorter. Three videos open with “How I…”.",
      ask:
        "Give me ideas built on what already works on my account:\n" +
        "- How I meal prep a week for $12 (854K views)\n" +
        "- Stop buying protein bars, make these (146K views)",
    });
  });

  it("the thin read (no profile, videos or patterns): who alone", () => {
    expect(accountCardOf(accountRead({ handle: "creator_one", fallback: "thin", profile: undefined, analyzedVideos: undefined, patterns: undefined }).props)).toEqual({
      who: { handle: "creator_one", initials: "CR", avatar: null, counts: null },
      videos: [],
      fixes: [],
      habits: null,
      ask: null,
    });
  });
});

// Fix round 1 (review M1): a read stored months ago may lack fields the type calls required. In the
// thread `validateBlock` turns such a block away (the plain fallback card); the card's own reading
// must not throw on one either, and draws what it can read.
describe("a stored read with fields missing", () => {
  const OLD = {
    handle: "creator_one",
    profile: { displayName: "Nia Lee", followerCount: "12400" },
    analyzedVideos: [
      { views: 854_000, videoUrl: "/fixtures/a" },
      { caption: "How I meal prep #mealprep", videoUrl: "/fixtures/b" },
      null,
      { caption: "Stop buying protein bars", views: 146_000, coverUrl: 7 },
    ],
    patterns: { fix: ["lurker: retention drops mid-video — tighten the middle and cut dead air", 3, null] },
  } as unknown as Props;

  it("draws what it can read: the handle, the initials, one video, one fix, the ask", () => {
    expect(accountCardOf(OLD)).toEqual({
      who: { handle: "creator_one", initials: "NL", avatar: null, counts: null },
      videos: [{ title: "Stop buying protein bars", views: "146K views", cover: null }],
      fixes: ["The middle loses people. Tighten it and cut the dead air."],
      habits: null,
      ask: "Give me ideas built on what already works on my account:\n- Stop buying protein bars (146K views)",
    });
  });

  it("a profile with nothing in it, or not an object", () => {
    expect(accountWhoOf({ handle: "creator_one", profile: {} } as unknown as Props)).toEqual({
      handle: "creator_one",
      initials: "CR",
      avatar: null,
      counts: null,
    });
    expect(accountWhoOf({ handle: "creator_one", profile: null } as unknown as Props).avatar).toBeNull();
    expect(accountWhoOf({ profile: { avatarUrl: 5 } } as unknown as Props)).toEqual({ handle: "", initials: "", avatar: null, counts: null });
  });

  it("videos that are not a list, or items with odd fields", () => {
    expect(topVideosOf({} as unknown as Video[])).toEqual([]);
    expect(topVideosOf([{}, { caption: 4, views: 10 }, "x"] as unknown as Video[])).toEqual([]);
  });

  it("patterns missing any of their keys, or holding odd entries", () => {
    expect(habitsLineOf({} as unknown as Patterns)).toBeNull();
    expect(fixSentencesOf("scanner: x" as unknown as string[])).toEqual([]);
    expect(
      habitsLineOf({ formatMix: [{ count: 20 }, { label: "Short-form (≤30s)" }, null], recurringHooks: [3, null] } as unknown as Patterns),
    ).toBeNull();
    expect(habitsLineOf({ formatMix: [{ label: "Short-form (≤30s)", count: 21 }, { label: "Long-form (>30s)", count: "9" }] } as unknown as Patterns)).toBe(
      "21 of 21 videos are 30 s or shorter.",
    );
    expect(accountCardOf({ handle: "creator_one", patterns: { working: [] } } as unknown as Props).fixes).toEqual([]);
  });
});
