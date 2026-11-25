/**
 * The dev preview's fixtures: made-up audiences that go through the real model (`audiencePageOf`), so the
 * preview and the screen's tests show what the page would show for such rows. PURE test (`node`).
 *
 * The repository is public: no real person's handle may reach a fixture, nor anything that could tell one
 * (a list of real handles, or a fingerprint of one, would). So the scan is the other way round: every handle
 * the fixtures hold, as an `@`-mention in a text or as a `handle` value, is one of the made-up set.
 */
import { describe, expect, it } from "vitest";

import * as fixtures from "../fixtures";
import { DEV_PAGE_NAMES, DEV_PAGES } from "../fixtures";

/** The handles the fixtures may hold: invented, and taken by no one this test knows of. */
const MADE_UP: ReadonlySet<string> = new Set(["nia.tests", "leo.makes", "made.up.handle"]);
/** A TikTok handle's shape. */
const HANDLE_SHAPED = /^[a-z0-9._]{1,50}$/;

/** Every string a value holds, however deep (objects, arrays; keys too). */
function stringsIn(value: unknown, out: string[] = [], seen = new Set<unknown>()): string[] {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const [key, inner] of Object.entries(value)) {
      out.push(key);
      stringsIn(inner, out, seen);
    }
  }
  return out;
}

/** Every handle-shaped value held under a key named `handle`, however deep, lower case, without its "@" (a
 *  description stores its own name there, which is no handle). */
function handleValues(value: unknown, out: string[] = [], seen = new Set<unknown>()): string[] {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const [key, inner] of Object.entries(value)) {
      if (key === "handle" && typeof inner === "string") {
        const handle = inner.trim().replace(/^@+/, "").toLowerCase();
        if (HANDLE_SHAPED.test(handle)) out.push(handle);
      } else handleValues(inner, out, seen);
    }
  }
  return out;
}

/** The handles a text names with an "@", lower case, without a closing dot. */
const mentionsIn = (text: string): string[] =>
  [...text.matchAll(/@([A-Za-z0-9._]+)/g)].map((m) => m[1]!.toLowerCase().replace(/\.+$/, ""));

/** Every handle the fixtures hold, by either form. */
const handlesHeld = (value: unknown): string[] => [...stringsIn(value).flatMap(mentionsIn), ...handleValues(value)];

describe("the scan itself", () => {
  it("finds an @-mention in any case, without its closing dot", () => {
    expect(mentionsIn("Made by @Made.Up.Handle, again.")).toEqual(["made.up.handle"]);
    expect(mentionsIn("Ends with @nia.tests.")).toEqual(["nia.tests"]);
    expect(mentionsIn("no mention here")).toEqual([]);
  });

  it("finds a handle value however deep, with or without its @", () => {
    expect(handleValues({ a: [{ b: { handle: "@Someone.Else" } }], handle: "" })).toEqual(["someone.else"]);
    // A description's own name, stored where a handle goes, is no handle.
    expect(handleValues({ provenance: { handle: "busy parents who meal-prep" } })).toEqual([]);
  });

  it("refuses a handle outside the made-up set", () => {
    const held = handlesHeld({ name: "@someone.else", calibration: { handle: "leo.makes" } });
    expect(held.filter((h) => !MADE_UP.has(h))).toEqual(["someone.else"]);
  });

  it("finds the fixtures' strings and handles (not vacuous)", () => {
    const all = stringsIn(fixtures);
    expect(all.length).toBeGreaterThan(100);
    expect(all).toContain("Busy parents who meal-prep");
    expect(new Set(handlesHeld(fixtures))).toEqual(new Set(["nia.tests", "leo.makes"]));
  });
});

describe("the fixtures", () => {
  it("the own page's groups are the model's: largest share first, counts from the ring", () => {
    const [first, second] = DEV_PAGES.own.page.groups;
    expect(first).toMatchObject({ group: "lurker", name: "Quiet watchers", count: 130, percent: 13 });
    expect(first!.line).toBe("I'll watch the whole thing and never say a word.");
    expect(second).toMatchObject({ name: "Commenters", count: 110, percent: 11 });
    expect(DEV_PAGES.own.page.source.line).toBe("TikTok · read 14 Aug · 12 videos");
  });

  it("every page's ten groups count 1,000 viewers between them", () => {
    for (const name of DEV_PAGE_NAMES) {
      const { groups } = DEV_PAGES[name].page;
      expect(groups, name).toHaveLength(10);
      expect(groups.reduce((sum, g) => sum + g.count, 0), name).toBe(1000);
    }
  });

  it("are the kinds the preview names", () => {
    expect(DEV_PAGES.own.page.kind).toBe("own");
    expect(DEV_PAGES.other.page.kind).toBe("other");
    expect(DEV_PAGES.described.page.kind).toBe("described");
    expect(DEV_PAGES.bare.page.kind).toBe("own");
    expect(DEV_PAGES.few.page.kind).toBe("own");
    expect(DEV_PAGES["not-default"].page.kind).toBe("own");
  });

  it("own: the default, every block filled, twelve posts read, the usual from them", () => {
    const { page, pushed } = DEV_PAGES.own;
    expect(pushed).toBe(false);
    expect(page.isDefault).toBe(true);
    expect(page.figures.map((f) => f.key)).toEqual(["followers", "likes", "posts", "usual"]);
    expect(page.videos?.rows).toHaveLength(3);
    expect(page.videos?.rows.some((r) => r.text === "No caption")).toBe(false); // the hashtags-only caption is not in the top three
    expect(page.texts.works?.rest).not.toBeNull();
    expect(page.texts.flat?.rest).not.toBeNull();
    expect(page.groups.every((g) => g.line && g.judge && g.seen)).toBe(true);
    expect(page.videos?.topics).toHaveLength(3);
    expect(page.readAgain).not.toBeNull();
  });

  it("one post's caption is hashtags only", () => {
    const captions = DEV_PAGES.own.input.posts.map((p) => p.caption);
    expect(captions).toHaveLength(12);
    expect(captions.filter((c) => c.trim().split(/\s+/).every((w) => w.startsWith("#")))).toHaveLength(1);
  });

  it("few: two posts, so no usual", () => {
    const { page } = DEV_PAGES.few;
    expect(page.videos?.rows).toHaveLength(2);
    expect(page.figures.map((f) => f.key)).toEqual(["followers", "likes", "posts"]);
    expect(page.videos?.rows.every((r) => r.times === null)).toBe(true);
  });

  it("bare: the legacy groups only, nothing else read", () => {
    const { page } = DEV_PAGES.bare;
    expect(page.groups.every((g) => g.line === null && g.judge === null && g.seen === null)).toBe(true);
    expect(page.figures).toEqual([]);
    expect(page.videos).toBeNull();
    expect(page.texts).toEqual({ works: null, flat: null });
  });

  it("described: a description longer than three lines on a phone", () => {
    const description = DEV_PAGES.described.page.source.description;
    expect(description).not.toBeNull();
    expect(description!.length).toBeGreaterThan(150);
  });

  it("not-default: pushed, and not the audience new chats use", () => {
    expect(DEV_PAGES["not-default"].pushed).toBe(true);
    expect(DEV_PAGES["not-default"].page.isDefault).toBe(false);
  });

  it("every handle they hold is one of the made-up set", () => {
    expect(handlesHeld(fixtures).filter((handle) => !MADE_UP.has(handle))).toEqual([]);
  });
});
