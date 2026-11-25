/**
 * The posted words (plan 2026-11-24-after-posting, "Words" and "Fixed strings"). Pure. A `Posted` here is
 * plain data in the contract's shape; the dates are built in local time, so the day words hold in any
 * time zone the suite runs in.
 */
import { describe, expect, it } from "vitest";

import type { Posted } from "../posted";
import { POSTED_STRINGS, cellWords, countsLine, footWords, gotWords, rowLine, usualWord, viewsWord } from "../posted-words";

const HOUR = 3_600_000;
/** Tue 24 Nov 2026, 12:00 local. */
const NOW = new Date(2026, 10, 24, 12, 0, 0);
const local = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0);

const numbers = { views: 31_000, likes: 2_100, comments: 84, shares: 310, saves: 420 };

function posted(over: Partial<Posted> = {}): Posted {
  const postedAt = local(20, 15); // Fri 20 Nov
  return {
    id: "33333333-3333-4333-8333-333333333333",
    threadId: "11111111-1111-4111-8111-111111111111",
    pieceKey: "Ab3_k9-Zx0",
    said: { number: 67, measure: "stop" },
    state: "final",
    linkedAt: local(20, 16).toISOString(),
    postedAt: postedAt.toISOString(),
    finalAt: new Date(postedAt.getTime() + 72 * HOUR).toISOString(),
    numbers,
    usual: { ratio: 1.8, tone: "above" },
    handle: "nia.cooks",
    href: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789",
    due: false,
    ...over,
  };
}

const soFar = (postedAt: Date, over: Partial<Posted> = {}) =>
  posted({
    state: "so-far",
    postedAt: postedAt.toISOString(),
    finalAt: new Date(postedAt.getTime() + 72 * HOUR).toISOString(),
    numbers: { ...numbers, views: 12_400 },
    usual: null,
    ...over,
  });
const reading = posted({ state: "reading", postedAt: null, finalAt: null, numbers: null, usual: null, handle: null, href: null, due: true });
const unread = posted({ state: "unread", numbers: null, usual: null });

describe("viewsWord", () => {
  it.each([
    [0, "0"],
    [940, "940"],
    [999, "999"],
    [1_000, "1K"],
    [2_100, "2.1K"],
    [12_400, "12.4K"],
    [31_000, "31K"],
    [999_949, "999.9K"],
    [999_950, "1M"],
    [1_200_000, "1.2M"],
  ])("%s is %s", (n, word) => {
    expect(viewsWord(n)).toBe(word);
  });

  it("never prints a number that is not one", () => {
    expect(viewsWord(Number.NaN)).toBe("0");
    expect(viewsWord(-5)).toBe("0");
  });
});

describe("usualWord", () => {
  it.each([
    [1.8, "1.8× your usual"],
    [1.84, "1.8× your usual"],
    [2, "2× your usual"],
    [0.1, "0.1× your usual"],
    [9.94, "9.9× your usual"],
    [9.96, "10× your usual"],
    [10, "10× your usual"],
    [12.4, "12× your usual"],
    [0.09, "under 0.1× your usual"],
    [0, "under 0.1× your usual"],
  ])("%s is %j", (ratio, word) => {
    expect(usualWord(ratio)).toBe(word);
  });
});

describe("gotWords", () => {
  it("final: the views, and the usual when there is one", () => {
    expect(gotWords(posted())).toEqual({ number: "31K", unit: "views", usual: "1.8× your usual" });
    expect(gotWords(posted({ usual: null }))).toEqual({ number: "31K", unit: "views", usual: null });
  });

  it("so far: the views so far, never a usual", () => {
    expect(gotWords(soFar(local(23, 10)))).toEqual({ number: "12.4K", unit: "views so far", usual: null });
  });

  it("one view is a view", () => {
    expect(gotWords(soFar(local(23, 10), { numbers: { ...numbers, views: 1 } }))?.unit).toBe("view so far");
    expect(gotWords(posted({ numbers: { ...numbers, views: 1 }, usual: null }))?.unit).toBe("view");
  });

  it("is null without numbers to show (reading, not read)", () => {
    expect(gotWords(reading)).toBeNull();
    expect(gotWords(unread)).toBeNull();
    expect(gotWords(posted({ state: "unread" }))).toBeNull();
  });
});

describe("countsLine", () => {
  it("joins the four counts", () => {
    expect(countsLine(numbers)).toBe("2.1K likes · 84 comments · 310 shares · 420 saves");
    expect(countsLine({ views: 0, likes: 0, comments: 0, shares: 0, saves: 0 })).toBe("0 likes · 0 comments · 0 shares · 0 saves");
  });

  it("says one of each in the singular", () => {
    expect(countsLine({ views: 9, likes: 1, comments: 1, shares: 1, saves: 1 })).toBe("1 like · 1 comment · 1 share · 1 save");
  });
});

describe("footWords", () => {
  it("final: the day, the platform, the handle and 'final numbers'", () => {
    expect(footWords(posted(), NOW)).toEqual({
      lead: "Posted Fri 20 Nov on TikTok",
      handle: "@nia.cooks",
      tail: " · final numbers",
      text: "Posted Fri 20 Nov on TikTok, @nia.cooks · final numbers",
    });
  });

  it("so far: the day the numbers will be final", () => {
    // Posted Mon 23 Nov 10:00 → final Thu 26 Nov.
    expect(footWords(soFar(local(23, 10)), NOW).text).toBe("Posted Mon 23 Nov on TikTok, @nia.cooks · final numbers Thursday");
    // Posted Sun 22 Nov 15:00 → final Wed 25 Nov, tomorrow.
    expect(footWords(soFar(local(22, 15)), NOW).tail).toBe(" · final numbers tomorrow");
    // Posted Sat 21 Nov 18:00 → final Tue 24 Nov 18:00, later today.
    expect(footWords(soFar(local(21, 18)), NOW).tail).toBe(" · final numbers today");
    // Past 72 hours and not read yet: final on this read.
    expect(footWords(soFar(local(19, 9)), NOW).tail).toBe(" · final numbers today");
  });

  it("says 'Posted' with no day when the post's time is unknown, the final day counted from the link", () => {
    // Linked Mon 23 Nov 10:00 with no post time → final Thu 26 Nov.
    const noTime = soFar(local(23, 10), { postedAt: null });
    expect(footWords(noTime, NOW).text).toBe("Posted on TikTok, @nia.cooks · final numbers Thursday");
    expect(footWords(posted({ postedAt: null }), NOW).text).toBe("Posted on TikTok, @nia.cooks · final numbers");
  });

  it("leaves out what it does not know", () => {
    expect(footWords(posted({ handle: null, href: null }), NOW).text).toBe("Posted Fri 20 Nov on TikTok · final numbers");
    expect(footWords(reading, NOW)).toEqual({ lead: "Posted on TikTok", handle: null, tail: "", text: "Posted on TikTok" });
    expect(footWords(unread, NOW).text).toBe("Posted Fri 20 Nov on TikTok, @nia.cooks");
  });
});

describe("rowLine", () => {
  // Its parts (ruling 30): the phone draws the numbers as one unbroken piece and the mark on its own
  // line; `text` is the two halves joined, the line's words whole.
  it("final: the views, and the usual as its own mark with its tone", () => {
    expect(rowLine(posted(), "4d ago")).toEqual({
      text: "Posted 4d ago · 31K views",
      lead: "Posted 4d ago",
      rest: "31K views",
      numbers: true,
      mark: { text: "1.8× your usual", tone: "above" },
    });
    expect(rowLine(posted({ usual: { ratio: 0.5, tone: "below" } }), "4d ago").mark).toEqual({ text: "0.5× your usual", tone: "below" });
    expect(rowLine(posted({ usual: null }), "4d ago")).toEqual({ text: "Posted 4d ago · 31K views", lead: "Posted 4d ago", rest: "31K views", numbers: true, mark: null });
  });

  it("so far", () => {
    expect(rowLine(soFar(local(23, 10)), "1d ago")).toEqual({
      text: "Posted 1d ago · 12.4K views so far",
      lead: "Posted 1d ago",
      rest: "12.4K views so far",
      numbers: true,
      mark: null,
    });
  });

  it("reading and not read: the state's words, not numbers", () => {
    expect(rowLine(reading, null)).toEqual({ text: "Posted · reading the post", lead: "Posted", rest: "reading the post", numbers: false, mark: null });
    expect(rowLine(unread, "4d ago")).toEqual({ text: "Posted · couldn't read the post", lead: "Posted", rest: "couldn't read the post", numbers: false, mark: null });
  });

  it("without a time word", () => {
    expect(rowLine(posted({ usual: null }), null)).toMatchObject({ text: "Posted · 31K views", lead: "Posted", rest: "31K views" });
  });

  it("says 'Posted' with no day when the post's time is unknown, whatever word it is given", () => {
    expect(rowLine(posted({ postedAt: null, usual: null }), "4d ago")).toMatchObject({ text: "Posted · 31K views", lead: "Posted" });
    expect(rowLine(soFar(local(23, 10), { postedAt: null }), "1d ago")).toMatchObject({ text: "Posted · 12.4K views so far", lead: "Posted" });
  });

  it("text is always lead · rest", () => {
    for (const line of [rowLine(posted(), "4d ago"), rowLine(soFar(local(23, 10)), null), rowLine(reading, null), rowLine(unread, null)]) {
      expect(line.text).toBe(`${line.lead} · ${line.rest}`);
    }
  });
});


describe("cellWords", () => {
  it("final, so far, reading, not read", () => {
    expect(cellWords(posted())).toEqual({ top: "31K views", under: "1.8× your usual" });
    expect(cellWords(posted({ usual: null }))).toEqual({ top: "31K views", under: null });
    expect(cellWords(soFar(local(23, 10)))).toEqual({ top: "12.4K views", under: "so far" });
    expect(cellWords(reading)).toEqual({ top: "Reading", under: null });
    expect(cellWords(unread)).toEqual({ top: "Not read", under: null });
  });

  it("names no day, with or without the post's time", () => {
    expect(cellWords(posted({ postedAt: null }))).toEqual({ top: "31K views", under: "1.8× your usual" });
    expect(cellWords(soFar(local(23, 10), { postedAt: null }))).toEqual({ top: "12.4K views", under: "so far" });
  });
});

describe("the fixed strings", () => {
  it("are the plan's, word for word", () => {
    expect(POSTED_STRINGS).toEqual({
      stage: "Posted",
      column: "After posting",
      emptyFilter: "Nothing posted yet. Add a posted video's link to a piece you simulated.",
      addItem: "Add posted link",
      removeItem: "Remove posted link",
      removeConfirm: "Remove the posted link?",
      remove: "Remove",
      cancel: "Cancel",
      askTitle: "Posted it?",
      askText: "Add the link and see what it did.",
      sheetTitle: "Posted it?",
      sheetText: "Paste the TikTok link. Maven reads the public numbers and shows them next to what it said.",
      field: "TikTok link",
      placeholder: "https://www.tiktok.com/@you/video/…",
      submit: "Add link",
      notTiktok: "That's not a TikTok link.",
      alreadyLinked: "This piece already has a posted link.",
      tooMany: "That's 20 links today. Add more tomorrow.",
      addFailed: "Couldn't add the link. Try again.",
      cardTitle: "After posting",
      said: "Maven said",
      got: "It got",
      reading: "Reading the post",
      readingText: "This takes about a minute.",
      unread: "Couldn't read this post. It may be private or deleted.",
      tryAgain: "Try again",
      menu: "More: posted link",
      removeFailed: "Couldn't remove the link.",
    });
  });
});
