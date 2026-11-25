/**
 * A chat of the Library endpoint as its row (plan 2026-11-23-library): the one
 * mapping Library's list and Home's Recent both draw from. Pure, so nothing is stood in for but the
 * clock (the line's "2h ago") and the build's flag (a video's result address).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryChat, LibrarySim, LibrarySummary } from "@/lib/library/library-page";
import { THREAD_TITLE_MAX } from "@/lib/threads/title";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { rowOf, titleOf } from "../chat-row-data";
import { postedPiece, readingPiece, soFarPiece, unreadPiece } from "./posted-chats";

const NOW = Date.parse("2026-11-23T12:00:00Z");
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString();
const NONE: LibrarySummary["counts"] = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

type Over = Partial<Omit<LibraryChat, "summary">> & { summary?: Partial<LibrarySummary> };
function chat(over: Over = {}): LibraryChat {
  const { summary, ...rest } = over;
  return {
    id: "c1",
    title: "Meal prep for busy students",
    updatedAt: ago(3),
    pinned: false,
    ...rest,
    summary: { counts: NONE, lead: "chat", stage: "chat", sim: null, frame: null, videoPath: null, posted: null, ...summary },
  };
}

const textSim = (as: "hook" | "idea" | "opening" = "hook"): LibrarySim => ({
  number: 66,
  measure: "stop",
  at: ago(2),
  kind: "hooks",
  link: { type: "text", key: "k 1", as },
});
const videoSim: LibrarySim = { number: 38, measure: "end", at: ago(5), kind: "video", link: { type: "video", analysisId: "a1" } };

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("titleOf", () => {
  it("is the stored title, trimmed", () => {
    expect(titleOf(chat({ title: "  Meal prep  " }))).toBe("Meal prep");
  });

  it("a cap-long title is cut at a word, as the headers show it", () => {
    const long = "word ".repeat(40).slice(0, THREAD_TITLE_MAX);
    const title = titleOf(chat({ title: long }));
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(THREAD_TITLE_MAX);
  });

  it("an untitled (or blank) chat is named for what it holds", () => {
    expect(titleOf(chat({ title: null, summary: { lead: "video" } }))).toBe("Video simulation");
    expect(titleOf(chat({ title: "   ", summary: { lead: "hooks" } }))).toBe("Hooks");
  });
});

describe("rowOf", () => {
  it("a simulated text: its line, its stage, and its gauge linked to the text's result", () => {
    const row = rowOf(chat({ summary: { counts: { ...NONE, hooks: 3 }, lead: "hooks", stage: "simulated", sim: textSim() } }));
    expect(row).toEqual({
      id: "c1",
      title: "Meal prep for busy students",
      pinned: false,
      line: "3 hooks · simulated 2h ago",
      lead: "hooks",
      stageWord: "Simulated",
      frame: null,
      still: null,
      gauge: { number: 66, describes: "66% would stop to watch", href: "/simulation/hook/c1/k%201" },
      // After posting (plan 2026-11-24-after-posting): nothing posted, no posted part.
      posted: null,
    });
  });

  it("an idea or an opening line opens its result as that", () => {
    const idea = rowOf(chat({ summary: { lead: "ideas", stage: "simulated", sim: textSim("idea") } }));
    expect(idea.gauge?.href).toBe("/simulation/hook/c1/k%201?as=idea");
    const opening = rowOf(chat({ summary: { lead: "script", stage: "simulated", sim: textSim("opening") } }));
    expect(opening.gauge?.href).toBe("/simulation/hook/c1/k%201?as=opening");
  });

  it("a simulated video: its picture, its stored file, and a gauge that says what it measures", () => {
    const row = rowOf(
      chat({
        summary: { counts: { ...NONE, videos: 1 }, lead: "video", stage: "simulated", sim: videoSim, frame: "/frames/0.jpg", videoPath: "u1/take.mp4" },
      }),
    );
    expect(row.line).toBe("Video · simulated 5h ago");
    expect(row.frame).toBe("/frames/0.jpg");
    expect(row.still).toBe("u1/take.mp4");
    expect(row.gauge).toEqual({ number: 38, describes: "38% watch to the end", href: "/simulation/a1" });
  });

  it("a draft: the chat's last message in the line, no gauge", () => {
    const row = rowOf(chat({ updatedAt: ago(24), summary: { counts: { ...NONE, scripts: 1 }, lead: "script", stage: "draft" } }));
    expect(row.line).toBe("Script · 1d ago");
    expect(row.stageWord).toBe("Draft");
    expect(row.gauge).toBeNull();
  });

  it("a plain chat has no stage word; a pinned one says so", () => {
    const row = rowOf(chat({ pinned: true }));
    expect(row.line).toBe("Chat · 3h ago");
    expect(row.stageWord).toBeNull();
    expect(row.pinned).toBe(true);
  });
});

describe("rowOf — a posted chat (plan 2026-11-24-after-posting)", () => {
  const posted = (piece: LibrarySummary["posted"], summary: Partial<LibrarySummary> = {}) =>
    rowOf(chat({ summary: { counts: { ...NONE, hooks: 3 }, lead: "hooks", stage: "posted", sim: textSim(), posted: piece, ...summary } }));
  const phone = (lead: string, rest: string, numbers: boolean, mark: { text: string; tone: "above" | "around" | "below" } | null = null) => ({
    lead,
    rest,
    numbers,
    mark,
  });

  // Ruling 30: from 768 the column carries the numbers, so the line is what the row said before with
  // "posted" for "simulated"; the phone's line (and Home's) is the posted words in parts.
  it("final, with a usual: the stage Posted; the desk line; the phone's parts with the mark apart; the column; the gauge is still what Maven said", () => {
    const row = posted(postedPiece(ago(4 * 24)));
    expect(row.stageWord).toBe("Posted");
    expect(row.line).toBe("3 hooks · posted 4d ago");
    expect(row.posted).toEqual({
      phone: phone("Posted 4d ago", "31K views", true, { text: "1.8× your usual", tone: "above" }),
      cell: { top: "31K views", under: "1.8× your usual", tone: "above" },
    });
    expect(row.gauge).toEqual({ number: 66, describes: "66% would stop to watch", href: "/simulation/hook/c1/k%201" });
  });

  it("the mark and the column's under line carry the usual's tone: below, around", () => {
    const below = posted(postedPiece(ago(4 * 24), { numbers: { views: 3_100, likes: 1, comments: 1, shares: 1, saves: 1 }, usual: { ratio: 0.4, tone: "below" } }));
    expect(below.posted).toEqual({
      phone: phone("Posted 4d ago", "3.1K views", true, { text: "0.4× your usual", tone: "below" }),
      cell: { top: "3.1K views", under: "0.4× your usual", tone: "below" },
    });
    const around = posted(postedPiece(ago(4 * 24), { usual: { ratio: 1, tone: "around" } }));
    expect(around.posted?.phone.mark).toEqual({ text: "1× your usual", tone: "around" });
    expect(around.posted?.cell.tone).toBe("around");
  });

  it("final, no usual: the views alone, no mark, nothing under them", () => {
    const row = posted(postedPiece(ago(4 * 24), { usual: null }));
    expect(row.line).toBe("3 hooks · posted 4d ago");
    expect(row.posted).toEqual({ phone: phone("Posted 4d ago", "31K views", true), cell: { top: "31K views", under: null, tone: null } });
  });

  it("so far: the views so far, one piece; the column says so far, uncoloured", () => {
    const row = posted(soFarPiece(ago(26)));
    expect(row.line).toBe("3 hooks · posted 1d ago");
    expect(row.posted).toEqual({ phone: phone("Posted 1d ago", "12.4K views so far", true), cell: { top: "12.4K views", under: "so far", tone: null } });
  });

  it("reading: no post time yet, so the desk line is \"3 hooks · posted\"; the phone's says reading the post; the column Reading", () => {
    const row = posted(readingPiece());
    expect(row.stageWord).toBe("Posted");
    expect(row.line).toBe("3 hooks · posted");
    expect(row.posted).toEqual({ phone: phone("Posted", "reading the post", false), cell: { top: "Reading", under: null, tone: null } });
  });

  it("not read: the phone's says couldn't read the post; the column Not read", () => {
    const row = posted(unreadPiece());
    expect(row.line).toBe("3 hooks · posted");
    expect(row.posted).toEqual({ phone: phone("Posted", "couldn't read the post", false), cell: { top: "Not read", under: null, tone: null } });
  });

  it("the time word is the row's own (whenLabel) on the post's time: minutes, and a week on, its date", () => {
    expect(posted(postedPiece(ago(11 * 24))).line).toBe("3 hooks · posted Nov 12");
    expect(posted(postedPiece(ago(11 * 24))).posted?.phone.lead).toBe("Posted Nov 12");
    expect(posted(soFarPiece(ago(0.5))).line).toBe("3 hooks · posted 30m ago");
    expect(posted(soFarPiece(ago(0.5))).posted?.phone.lead).toBe("Posted 30m ago");
  });

  it("what is inside, as every row says it: a video, four ideas", () => {
    const video = posted(postedPiece(ago(11 * 24)), { counts: { ...NONE, videos: 1 }, lead: "video" });
    expect(video.line).toBe("Video · posted Nov 12");
    const ideas = posted(soFarPiece(ago(5)), { counts: { ...NONE, ideas: 4 }, lead: "ideas" });
    expect(ideas.line).toBe("4 ideas · posted 5h ago");
  });

  it("a post whose time is unknown: posted with no day (ruling 6)", () => {
    const row = posted(postedPiece(null));
    expect(row.line).toBe("3 hooks · posted");
    expect(row.posted?.phone.lead).toBe("Posted");
  });

  it("a post time the clock has not reached yet (a skewed phone) gives no day either", () => {
    const row = posted(soFarPiece(new Date(NOW + HOUR).toISOString()));
    expect(row.line).toBe("3 hooks · posted");
    expect(row.posted?.phone.lead).toBe("Posted");
  });

  it("no posted piece (or a summary from before the field): no posted part, the line as before", () => {
    const row = rowOf(chat({ summary: { counts: { ...NONE, hooks: 3 }, lead: "hooks", stage: "simulated", sim: textSim(), posted: undefined } }));
    expect(row.posted).toBeNull();
    expect(row.line).toBe("3 hooks · simulated 2h ago");
    expect(row.stageWord).toBe("Simulated");
  });
});
