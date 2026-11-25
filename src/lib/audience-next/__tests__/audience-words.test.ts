/**
 * The Audience page's words (spec 2026-11-25-audience, section 6, and the building view's `keepOpen`):
 * every fixed string word for word, every function's examples, and none of the words the part never says.
 */
import { describe, expect, it } from "vitest";
import {
  AUDIENCE_STRINGS,
  allGroups,
  choiceLine,
  deleteQuestion,
  disconnectFailed,
  disconnectItem,
  disconnectQuestion,
  fromVideos,
  groupCount,
  moreLabel,
  newChatsUse,
  pillLabel,
  postsAbout,
  readAgainLine,
  readCount,
  readOn,
  renameLabel,
  seenIn,
  shareOf,
  sourceLine,
  stillReading,
  thinWhy,
  timesUsual,
  topicChip,
  videosTitle,
  viewsLabel,
} from "../audience-words";

const NOW = new Date("2026-11-25T12:00:00Z");

const TABLE = {
  title: "Audience",
  ringTotal: "1,000",
  ringUnit: "viewers",
  simulate: "Simulate a video for them",
  useForNewChats: "Use for new chats",
  readAgain: "Read again",
  describedBy: "Described by you",
  anotherCreator: "Another creator",
  groups: "Groups",
  more: "More",
  works: "What works with them",
  flat: "What falls flat",
  judge: "How they judge a video",
  followers: "Followers",
  likes: "Likes",
  posts: "Posts",
  usualViews: "Usual views",
  noCaption: "No caption",
  loading: "Loading your audience",
  loadFailed: "Couldn't load your audience.",
  tryAgain: "Try again",
  noneTitle: "These are general viewers",
  noneText: "Read your TikTok account and Maven simulates for the people who watch you. About two minutes, free.",
  buildMine: "Build my audience",
  describeInstead: "Describe one instead",
  switcherTitle: "Audience",
  switcherLine: "Whose viewers Maven simulates",
  newAudience: "New audience",
  newAudienceLine: "From an account or a description",
  rename: "Rename",
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  deleteAudience: "Delete audience",
  delete: "Delete",
  disconnect: "Disconnect",
  removeLine: "Chats that use this audience go back to general viewers. This can't be undone.",
  renameFailed: "Couldn't rename that audience.",
  deleteFailed: "Couldn't delete that audience.",
  switchFailed: "Couldn't switch the audience.",
  doorOwn: "Your TikTok account",
  doorOwnLine: "Built from your own videos",
  doorOther: "Another creator",
  doorOtherLine: "Any public TikTok account",
  doorDescribe: "Describe them",
  doorDescribeLine: "Write who they are",
  ownPlaceholder: "@yourhandle",
  otherPlaceholder: "@handle",
  describePlaceholder: "Who are they, and what makes them stop scrolling?",
  ownField: "Your TikTok handle",
  otherField: "Their TikTok handle",
  describeField: "Who they are",
  build: "Build audience",
  buildLine: "About two minutes. Free.",
  onlyTikTok: "Instagram and YouTube can't be read into an audience yet.",
  connectOnYou: "Connect them on You",
  building: "Building your audience",
  slow: "Taking longer than usual.",
  thinTitle: "Couldn't read enough yet",
  useGeneral: "Use general viewers",
  tryAnother: "Try another account",
  changeDescription: "Change the description",
  accountNotFound: "Account not found. Check the handle. Private accounts can't be read.",
  describeFailed: "Couldn't build from that description. Try again.",
  keptAsWas: "The groups stay as they were.",
  stepDone: "done",
  stepNow: "now",
  stepNext: "next",
  keepOpen: "Keep this page open.",
  back: "Back",
  stillBuilding: "Maven is still building that audience.",
};

describe("AUDIENCE_STRINGS", () => {
  it("is the table word for word, and nothing else", () => {
    expect(AUDIENCE_STRINGS).toEqual(TABLE);
  });
});

describe("the words made from parts", () => {
  it("whose viewers, groups, numbers, videos", () => {
    expect(shareOf("your")).toBe("share of your viewers");
    expect(shareOf("their")).toBe("share of their viewers");
    expect(shareOf("the")).toBe("share of the viewers");
    expect(allGroups(10)).toBe("All 10");
    expect(groupCount(114)).toBe("114 of 1,000 viewers");
    expect(groupCount(1000)).toBe("1,000 of 1,000 viewers");
    expect(seenIn("your")).toBe("Seen in your numbers");
    expect(seenIn("their")).toBe("Seen in their numbers");
    expect(seenIn("the")).toBe("Seen in the numbers");
    expect(videosTitle("your")).toBe("Your videos Maven read");
    expect(videosTitle("their")).toBe("Their videos Maven read");
    expect(fromVideos("your")).toBe("From your videos");
    expect(fromVideos("their")).toBe("From their videos");
    expect(readCount(12)).toBe("12 read");
    expect(postsAbout("your")).toBe("What you post about");
    expect(postsAbout("their")).toBe("What they post about");
    expect(postsAbout("the")).toBe("What they post about");
    expect(topicChip("Future tech", 6)).toBe("Future tech · 6");
    expect(viewsLabel("259K")).toBe("259K views");
    expect(viewsLabel("1")).toBe("1 view");
  });

  it("the multiple, as After posting rounds it", () => {
    expect(timesUsual(20, "your")).toBe("20× your usual");
    expect(timesUsual(1.9, "their")).toBe("1.9× their usual");
    expect(timesUsual(1.45, "your")).toBe("1.5× your usual");
    expect(timesUsual(12.4, "your")).toBe("12× your usual");
    expect(timesUsual(1, "your")).toBe("1× your usual");
    expect(timesUsual(0.05, "your")).toBe("under 0.1× your usual");
    expect(timesUsual(0, "their")).toBe("under 0.1× their usual");
  });

  it("the read date: day and month, the year only when it is another one, never Sept", () => {
    expect(readOn("2026-08-14T10:00:00Z", NOW)).toBe("read 14 Aug");
    expect(readOn("2025-08-14T10:00:00Z", NOW)).toBe("read 14 Aug 2025");
    expect(readOn("2026-09-14T10:00:00Z", NOW)).toBe("read 14 Sep");
    expect(readOn("2026-08-14T23:30:00-05:00", NOW)).toBe("read 15 Aug"); // the day in UTC
    expect(readOn("not a date", NOW)).toBeNull();
    expect(readOn("", NOW)).toBeNull();
    expect(readOn(null, NOW)).toBeNull();
    expect(readOn(undefined, NOW)).toBeNull();
  });

  it("the source line, an unknown part left out", () => {
    expect(sourceLine("own", "tiktok", "read 14 Aug", 12)).toBe("TikTok · read 14 Aug · 12 videos");
    expect(sourceLine("other", "tiktok", "read 14 Aug", 1)).toBe("Another creator · TikTok · read 14 Aug · 1 video");
    expect(sourceLine("own", "tiktok", null, 12)).toBe("TikTok · 12 videos");
    expect(sourceLine("own", "tiktok", "read 14 Aug", 0)).toBe("TikTok · read 14 Aug");
    expect(sourceLine("own", "tiktok", "read 14 Aug", null)).toBe("TikTok · read 14 Aug");
    expect(sourceLine("other", "tiktok", null, null)).toBe("Another creator · TikTok");
    expect(sourceLine("own", "custom", "read 14 Aug", 12)).toBe("read 14 Aug · 12 videos");
    expect(sourceLine("own", "tiktok", "read 14 Aug", 1200)).toBe("TikTok · read 14 Aug · 1,200 videos");
    expect(sourceLine("described", null, null, null)).toBe("Described by you");
    // Nothing known: an empty line, which the screen does not draw (a decision, not an accident).
    expect(sourceLine("own", "custom", null, null)).toBe("");
  });

  it("the switcher's line", () => {
    expect(choiceLine("own", "tiktok", 12)).toBe("TikTok · 12 videos read");
    expect(choiceLine("own", "tiktok", 1)).toBe("TikTok · 1 video read");
    expect(choiceLine("own", "tiktok", 0)).toBe("TikTok");
    expect(choiceLine("own", "tiktok", null)).toBe("TikTok");
    expect(choiceLine("own", "instagram", null)).toBe("Instagram");
    expect(choiceLine("other", "tiktok", 12)).toBe("Another creator · TikTok");
    expect(choiceLine("described", "custom", 12)).toBe("Described by you");
  });

  it("the toasts, the menu, the questions, Read again, the thin read", () => {
    expect(newChatsUse("@nia.tests")).toBe("New chats use @nia.tests");
    expect(disconnectItem("nia.tests")).toBe("Disconnect @nia.tests");
    expect(disconnectItem("@nia.tests")).toBe("Disconnect @nia.tests");
    expect(disconnectQuestion("nia.tests")).toBe("Disconnect @nia.tests?");
    expect(deleteQuestion("Busy parents who meal-prep")).toBe("Delete Busy parents who meal-prep?");
    expect(disconnectFailed("nia.tests")).toBe("Couldn't disconnect @nia.tests.");
    expect(renameLabel("@nia.tests")).toBe("Rename @nia.tests");
    expect(moreLabel("@nia.tests")).toBe("More: @nia.tests");
    expect(pillLabel("@nia.tests")).toBe("Audience: @nia.tests");
    expect(stillReading("nia.tests")).toBe("Maven is still reading @nia.tests.");
    expect(stillReading("@nia.tests")).toBe("Maven is still reading @nia.tests.");
    expect(readAgainLine("nia.tests")).toBe("Maven reads @nia.tests again and rebuilds the groups. About two minutes.");
    expect(thinWhy("nia.tests")).toBe("@nia.tests doesn't have enough public videos to read yet.");
    expect(thinWhy(null)).toBe("There weren't enough videos for that description yet.");
  });
});

/**
 * The words the part never says (spec section 6). The scan runs on every fixed string and on each function's
 * output; the functions are given a made-up handle without a word of the list in it (`nia.tests` would hold
 * "tests"). `General` is checked with its capital only, so "general viewers" passes.
 */
const NEVER = /\b(?:tests?|thread\w*|calibrat\w*|persona\w*|sync\w*|source|simulated|Audiences)\b/i;
const NEVER_CASED = /\bGeneral\b/;
const refused = (s: string) => NEVER.test(s) || NEVER_CASED.test(s);

describe("the words never said", () => {
  it("the scan refuses samples and passes the part's own words", () => {
    for (const bad of ["Test it", "a thread", "Calibrating", "personas", "Sync now", "source", "Simulated", "Audiences", "General"]) {
      expect(refused(bad), bad).toBe(true);
    }
    for (const good of ["general viewers", "Simulate a video for them", "Maven simulates", "Audience"]) {
      expect(refused(good), good).toBe(false);
    }
  });

  it("no fixed string holds one", () => {
    for (const [key, value] of Object.entries(AUDIENCE_STRINGS)) expect(refused(value), key).toBe(false);
  });

  it("no function's output holds one", () => {
    const outputs = [
      ...(["your", "their", "the"] as const).flatMap((w) => [shareOf(w), seenIn(w), videosTitle(w), fromVideos(w), postsAbout(w), timesUsual(1.9, w), timesUsual(0.01, w)]),
      allGroups(10),
      groupCount(114),
      topicChip("Future tech", 6),
      readOn("2026-08-14T10:00:00Z", NOW)!,
      readOn("2025-09-14T10:00:00Z", NOW)!,
      sourceLine("own", "tiktok", "read 14 Aug", 12),
      sourceLine("other", "tiktok", "read 14 Aug", 1),
      sourceLine("described", null, null, null),
      choiceLine("own", "tiktok", 12),
      choiceLine("other", "tiktok", null),
      choiceLine("described", null, null),
      newChatsUse("@leo.makes"),
      disconnectItem("leo.makes"),
      disconnectQuestion("leo.makes"),
      deleteQuestion("Busy parents who meal-prep"),
      disconnectFailed("leo.makes"),
      renameLabel("@leo.makes"),
      moreLabel("@leo.makes"),
      pillLabel("@leo.makes"),
      stillReading("leo.makes"),
      readAgainLine("leo.makes"),
      readCount(12),
      thinWhy("leo.makes"),
      thinWhy(null),
      viewsLabel("259K"),
    ];
    for (const out of outputs) expect(refused(out), out).toBe(false);
  });
});
