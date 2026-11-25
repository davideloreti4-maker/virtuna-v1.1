/**
 * picking.test.ts — "How should it look?" (Task 13b): what each of the four rows needs before the first cut can be made, what
 * is said when a row has something it cannot use, the style the route is sent, and the routes' sentences as a creator reads them.
 */
import { describe, expect, it } from "vitest";
import { FIRST, hintOf, isTikTokLink, problemOf, ready, sentence, stageLine, styleOf, type Picking } from "../picking";

const picking = (more: Partial<Picking>): Picking => ({ ...FIRST, ...more });
const file = (type: string, size = 9_000_000) => ({ name: "clip.mp4", size, type });

describe("ready", () => {
  it("is so as the page opens: our pick is chosen, and needs nothing more", () => {
    expect(FIRST.choice).toBe("pick");
    expect(ready(FIRST)).toBe(true);
  });

  it("needs a TikTok link or a video file for a video", () => {
    expect(ready(picking({ choice: "video" }))).toBe(false);
    expect(ready(picking({ choice: "video", link: "tiktok" }))).toBe(false);
    expect(ready(picking({ choice: "video", link: "  https://www.tiktok.com/@someone/video/7300000000000000000  " }))).toBe(true);
    expect(ready(picking({ choice: "video", file: file("video/mp4") }))).toBe(true);
    expect(ready(picking({ choice: "video", file: file("video/x-matroska") }))).toBe(false);
    expect(ready(picking({ choice: "video", file: file("video/mp4", 3 * 1024 ** 3) }))).toBe(false);
  });

  it("needs a preset chosen, and one there is", () => {
    expect(ready(picking({ choice: "preset" }))).toBe(false);
    expect(ready(picking({ choice: "preset", preset: "clean" }))).toBe(true);
    expect(ready(picking({ choice: "preset", preset: "no-such" }))).toBe(false);
  });

  it("needs words, at most the route's 300 characters", () => {
    expect(ready(picking({ choice: "words", words: "   " }))).toBe(false);
    expect(ready(picking({ choice: "words", words: "fast with zooms" }))).toBe(true);
    expect(ready(picking({ choice: "words", words: "a".repeat(301) }))).toBe(false);
  });

  it("looks at the chosen row only", () => {
    expect(ready(picking({ choice: "pick", link: "nonsense", words: "" }))).toBe(true);
    expect(ready(picking({ choice: "words", preset: "clean", words: "" }))).toBe(false);
  });
});

describe("hintOf", () => {
  it("says nothing while a row is empty or has what it needs", () => {
    expect(hintOf(FIRST)).toBeNull();
    expect(hintOf(picking({ choice: "video" }))).toBeNull();
    expect(hintOf(picking({ choice: "video", link: "https://vm.tiktok.com/ZM123/" }))).toBeNull();
    expect(hintOf(picking({ choice: "words", words: "fast" }))).toBeNull();
  });

  it("says why a link, a file or the words cannot be used", () => {
    expect(hintOf(picking({ choice: "video", link: "https://youtube.com/watch?v=1" }))).toBe("That is not a link to a TikTok video.");
    expect(hintOf(picking({ choice: "video", file: file("video/x-matroska") }))).toBe("A video is an MP4 or a QuickTime file.");
    expect(hintOf(picking({ choice: "video", file: file("video/mp4", 3 * 1024 ** 3) }))).toBe("A video is at most 2 GB.");
    expect(hintOf(picking({ choice: "words", words: "a".repeat(301) }))).toBe("Say it in at most 300 characters.");
  });

  it("goes by the file when both a file and a link are there", () => {
    expect(hintOf(picking({ choice: "video", link: "nonsense", file: file("video/mp4") }))).toBeNull();
  });
});

describe("isTikTokLink", () => {
  it("takes https links on tiktok.com and its subdomains, and nothing else", () => {
    for (const good of ["https://www.tiktok.com/@a/video/1", "https://vm.tiktok.com/ZM1/", "https://tiktok.com/t/ZT1/"]) expect(isTikTokLink(good)).toBe(true);
    for (const bad of ["http://www.tiktok.com/@a/video/1", "https://nottiktok.com/x", "https://tiktok.com.evil.example/x", "tiktok.com/@a", ""]) expect(isTikTokLink(bad)).toBe(false);
  });
});

describe("styleOf", () => {
  it("sends no style for our pick, the preset's id, or the words trimmed", () => {
    expect(styleOf(FIRST)).toBeUndefined();
    expect(styleOf(picking({ choice: "preset", preset: "clean" }))).toEqual({ preset: "clean" });
    expect(styleOf(picking({ choice: "words", words: "  fast with zooms " }))).toEqual({ words: "fast with zooms" });
  });
});

describe("sentence", () => {
  it("gives a route's line a capital and a full stop, and leaves a sentence as it is", () => {
    expect(sentence("an analysis of yours is already running; try again when it ends")).toBe("An analysis of yours is already running; try again when it ends.");
    expect(sentence("Say what to change.")).toBe("Say what to change.");
    expect(sentence("  no such take ")).toBe("No such take.");
    expect(sentence("Is it there?")).toBe("Is it there?");
  });
});

describe("problemOf", () => {
  it("shows a route's own sentence", () => {
    expect(problemOf({ status: 409, body: { error: "The editor is already working on a call of yours; try again when it is done." } })).toBe("The editor is already working on a call of yours; try again when it is done.");
    expect(problemOf({ status: 400, body: { error: "a reference is a link to a TikTok video, or a file you upload" } })).toBe("A reference is a link to a TikTok video, or a file you upload.");
  });

  it("never shows a code or an error's name: a call that did not get there, an answer that is no sentence", () => {
    expect(problemOf({ status: 0, body: { error: "TypeError: Failed to fetch" } })).toBe("The editor could not be reached. Check your connection.");
    expect(problemOf({ status: 504, body: { error: "it answered 504" } })).toBe("Something went wrong.");
    expect(problemOf({ status: 500, body: {} })).toBe("Something went wrong.");
    expect(problemOf({ status: 500, body: { error: "something went wrong" } })).toBe("Something went wrong.");
  });
});

describe("stageLine", () => {
  it("says a reference's stage as a line of progress", () => {
    expect(stageLine("getting the video")).toBe("Getting the video…");
    expect(stageLine("reading its look")).toBe("Reading its look…");
  });
});
