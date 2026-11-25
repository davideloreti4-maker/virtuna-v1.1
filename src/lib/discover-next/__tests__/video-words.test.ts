/**
 * A video's words: the multiple and what it is
 * measured against, the platform, the meta line, why it works in two parts, and a web address. Pure.
 */
import { describe, expect, it } from "vitest";

import type { CardVideo } from "../hub-data";
import { multipleWords, platformName, splitWhy, videoMeta, watchLabel, webAddress } from "../video-words";

function card(over: Partial<CardVideo> = {}): CardVideo {
  return {
    id: "v1",
    coverUrl: null,
    handle: "nia.cooks",
    spokenHook: "Meal prep in ten minutes",
    niche: "food",
    platform: "tiktok",
    views: 25_000_000,
    postedAt: "2020-06-01T12:00:00Z",
    multiplier: 16,
    baselineLabel: "vs their usual views",
    proven: true,
    extreme: false,
    formats: [],
    ...over,
  };
}

describe("multipleWords", () => {
  it("not proven: nothing", () => {
    expect(multipleWords(card({ proven: false, multiplier: 1.5 }))).toBeNull();
  });

  it("an average baseline: their average", () => {
    expect(multipleWords(card())).toEqual({ text: "16× their average", shaky: false });
    expect(multipleWords(card({ multiplier: 5.2, baselineLabel: "vs median views" }))).toEqual({ text: "5.2× their average", shaky: false });
  });

  it("a follower baseline: their followers", () => {
    expect(multipleWords(card({ multiplier: 8, baselineLabel: "vs followers" }))).toEqual({ text: "8× their followers", shaky: false });
  });

  it("any other baseline: the multiple alone", () => {
    expect(multipleWords(card({ baselineLabel: "vs own" }))).toEqual({ text: "16×", shaky: false });
  });

  it("extreme: more than 100×, and shaky", () => {
    expect(multipleWords(card({ multiplier: 100, extreme: true }))).toEqual({ text: "more than 100× their average", shaky: true });
    expect(multipleWords(card({ multiplier: 100, extreme: true, baselineLabel: "vs followers" }))).toEqual({
      text: "more than 100× their followers",
      shaky: true,
    });
    expect(multipleWords(card({ multiplier: 100, extreme: true, baselineLabel: "vs own" }))).toEqual({ text: "more than 100×", shaky: true });
  });

  it("proven with no number: nothing", () => {
    expect(multipleWords(card({ multiplier: null }))).toBeNull();
  });
});

describe("platformName and watchLabel", () => {
  it.each([
    ["tiktok", "TikTok"],
    ["instagram", "Instagram"],
    ["youtube", "YouTube"],
    ["TikTok", "TikTok"],
  ])("%s is %s", (platform, name) => {
    expect(platformName(platform)).toBe(name);
    expect(watchLabel(platform)).toBe(`Watch on ${name}`);
  });

  it("any other platform, or none: no name, and Watch the original", () => {
    for (const p of ["vimeo", "", null, undefined, "constructor"]) {
      expect(platformName(p)).toBeNull();
      expect(watchLabel(p)).toBe("Watch the original");
    }
  });
});

describe("videoMeta", () => {
  it("@handle · views · platform · year", () => {
    expect(videoMeta(card())).toBe("@nia.cooks · 25M views · TikTok · 2020");
  });

  it("the year is read in UTC", () => {
    expect(videoMeta(card({ postedAt: "2020-12-31T23:30:00-05:00" }))).toBe("@nia.cooks · 25M views · TikTok · 2021");
    expect(videoMeta(card({ postedAt: "2021-01-01T00:30:00+05:00" }))).toBe("@nia.cooks · 25M views · TikTok · 2020");
  });

  it("a missing part is left out with its dot", () => {
    expect(videoMeta(card({ handle: null }))).toBe("25M views · TikTok · 2020");
    expect(videoMeta(card({ views: 0 }))).toBe("@nia.cooks · TikTok · 2020");
    expect(videoMeta(card({ platform: "vimeo" }))).toBe("@nia.cooks · 25M views · 2020");
    expect(videoMeta(card({ postedAt: null }))).toBe("@nia.cooks · 25M views · TikTok");
    expect(videoMeta(card({ postedAt: "soon" }))).toBe("@nia.cooks · 25M views · TikTok");
    expect(videoMeta(card({ handle: null, views: 0, platform: null, postedAt: null }))).toBeNull();
  });

  it("views as the cards write them", () => {
    expect(videoMeta(card({ views: 849_100, handle: "@nia.cooks" }))).toBe("@nia.cooks · 849K views · TikTok · 2020");
  });
});

describe("splitWhy: the first two sentences, and the rest", () => {
  it("an empty text: nothing", () => {
    expect(splitWhy("")).toBeNull();
    expect(splitWhy("   ")).toBeNull();
    expect(splitWhy(null)).toBeNull();
  });

  it("one sentence: all of it, no rest", () => {
    expect(splitWhy("It opens on the result.")).toEqual({ lead: "It opens on the result.", rest: null });
  });

  it("two sentences: both, no rest", () => {
    expect(splitWhy("It opens on the result. Then it explains how!")).toEqual({
      lead: "It opens on the result. Then it explains how!",
      rest: null,
    });
  });

  it("three sentences: two, then the rest", () => {
    expect(splitWhy("It opens on the result. Then it explains how? A loop closes it.")).toEqual({
      lead: "It opens on the result. Then it explains how?",
      rest: "A loop closes it.",
    });
  });

  it("a sentence may start with an opening quote", () => {
    expect(splitWhy("It works. “Stop” is the first word. The rest follows.")).toEqual({
      lead: "It works. “Stop” is the first word.",
      rest: "The rest follows.",
    });
  });

  it("a closing quote after the stop still ends the sentence", () => {
    expect(splitWhy("The hook says “wait.” Viewers do. Then it pays off.")).toEqual({
      lead: "The hook says “wait.” Viewers do.",
      rest: "Then it pays off.",
    });
  });

  it("a stop followed by a small letter or a number does not end a sentence", () => {
    expect(splitWhy("It hit 2.5 million views. e.g. this one. And more. Last.")).toEqual({
      lead: "It hit 2.5 million views. e.g. this one. And more.",
      rest: "Last.",
    });
  });

  it("“Dr. ” inside a sentence: the rule splits there (a stop, a space, a capital)", () => {
    expect(splitWhy("Dr. Lee explains it. Then a demo. Then the ask.")).toEqual({
      lead: "Dr. Lee explains it.",
      rest: "Then a demo. Then the ask.",
    });
  });

  it("trims the text and keeps its inner spacing", () => {
    expect(splitWhy("  One.  Two.\nThree.  ")).toEqual({ lead: "One.  Two.", rest: "Three." });
  });
});

describe("splitWhy: a long opening is one sentence", () => {
  const sentence = (n: number, end = ".") => `${"A".padEnd(n - 1, "a")}${end}`;

  it("two sentences of 220 characters together (the space between counted): both", () => {
    const one = sentence(100);
    const two = sentence(119);
    expect(`${one} ${two}`).toHaveLength(220);
    expect(splitWhy(`${one} ${two} Then more.`)).toEqual({ lead: `${one} ${two}`, rest: "Then more." });
  });

  it("two sentences of more than 220 characters together: the first alone, then the rest", () => {
    const one = sentence(100);
    const two = sentence(120);
    expect(splitWhy(`${one} ${two} Then more.`)).toEqual({ lead: one, rest: `${two} Then more.` });
  });

  it("only two sentences, too long together: the first, and the second as the rest", () => {
    const one = sentence(150);
    const two = sentence(150);
    expect(splitWhy(`${one} ${two}`)).toEqual({ lead: one, rest: two });
  });

  it("one sentence longer than 220: all of it", () => {
    const one = sentence(300);
    expect(splitWhy(one)).toEqual({ lead: one, rest: null });
  });

  it("a first sentence longer than 220: that sentence alone, then the rest", () => {
    const one = sentence(260);
    expect(splitWhy(`${one} Short. Shorter.`)).toEqual({ lead: one, rest: "Short. Shorter." });
  });

  it("counts whole characters", () => {
    const one = `${"🍞".repeat(99)}.`;
    const two = sentence(119);
    // 100 + 1 + 119 = 220 whole characters (the emoji are two units each in UTF-16).
    expect(splitWhy(`${one} ${two} Then.`)?.lead).toBe(`${one} ${two}`);
  });
});

describe("webAddress: http(s) only", () => {
  it("an http or https address, as the URL writes it", () => {
    expect(webAddress("https://www.tiktok.com/@nia.cooks/video/1")).toBe("https://www.tiktok.com/@nia.cooks/video/1");
    expect(webAddress("http://example.com")).toBe("http://example.com/");
  });

  it("anything else: null", () => {
    expect(webAddress("javascript:alert(1)")).toBeNull();
    expect(webAddress("data:text/html,hi")).toBeNull();
    expect(webAddress("ftp://example.com/x")).toBeNull();
    expect(webAddress("not a link")).toBeNull();
    expect(webAddress("")).toBeNull();
    expect(webAddress(null)).toBeNull();
    expect(webAddress(42)).toBeNull();
  });
});
