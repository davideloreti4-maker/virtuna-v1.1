/**
 * build-request.ts — what `/audience/new` sends to read an audience: the door an old address chooses, the
 * request a door and its field make (or none), the request Read again makes, and the name a description
 * gives (the old screen's rule, copied with its tests). Pure; no stand-ins.
 */
import { describe, expect, it } from "vitest";

import { DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";

import { buildRequestOf, doorOf, nameFromDescription, readAgainRequestOf } from "../build-request";

describe("doorOf: the old addresses keep choosing a row", () => {
  it.each([
    [{}, "own"],
    [{ door: "connect" }, "own"],
    [{ door: "handle" }, "other"],
    [{ door: "describe" }, "describe"],
    [{ source: "account", handle: "nia.tests" }, "own"],
    [{ mode: "general" }, "describe"],
    [{ door: "nope" }, "own"],
    [{ door: "handle", mode: "general" }, "other"],
    [{ door: "nope", mode: "general" }, "describe"],
    [{ source: "account", mode: "general" }, "own"],
  ] as const)("%o → %s", (params, door) => {
    expect(doorOf(params)).toBe(door);
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"])("an inherited name is no door: ?door=%s", (name) => {
    expect(doorOf({ door: name })).toBe("own");
    expect(doorOf({ door: name, mode: "general" })).toBe("describe");
  });
});

describe("buildRequestOf: a handle", () => {
  it("your own account: personal, TikTok, grow, named by the handle", () => {
    expect(buildRequestOf("own", "@Nia.Tests")).toEqual({
      handle: "nia.tests",
      type: "personal",
      platform: "tiktok",
      goalIntent: "grow",
      name: "@nia.tests",
    });
  });

  it("another creator: target", () => {
    expect(buildRequestOf("other", "leo.makes")).toEqual({
      handle: "leo.makes",
      type: "target",
      platform: "tiktok",
      goalIntent: "grow",
      name: "@leo.makes",
    });
  });

  it.each([
    "https://www.tiktok.com/@leo.makes",
    "https://www.tiktok.com/@leo.makes?lang=en",
    "https://www.tiktok.com/@leo.makes/video/1234567890",
    "tiktok.com/@Leo.Makes",
    "  @leo.makes  ",
  ])("a pasted link or a padded handle: %s", (field) => {
    expect(buildRequestOf("other", field)).toMatchObject({ handle: "leo.makes", name: "@leo.makes" });
  });

  it.each(["", "   ", "@", "@@leo", "leo makes", "leo-makes", "léo", "a".repeat(51), "https://example.test/@leo"])(
    "no request for %j",
    (field) => {
      expect(buildRequestOf("own", field)).toBeNull();
      expect(buildRequestOf("other", field)).toBeNull();
    },
  );

  it("fifty characters is the longest handle", () => {
    expect(buildRequestOf("own", "a".repeat(50))).toMatchObject({ handle: "a".repeat(50) });
  });
});

describe("buildRequestOf: a description", () => {
  it("target, custom, grow; the text's spaces collapsed; named from the text", () => {
    expect(buildRequestOf("describe", "  Busy parents\n who   meal-prep  ")).toEqual({
      description: "Busy parents who meal-prep",
      type: "target",
      platform: "custom",
      goalIntent: "grow",
      name: "Busy parents who meal-prep",
    });
  });

  it("1 to 500 characters once collapsed", () => {
    expect(buildRequestOf("describe", "")).toBeNull();
    expect(buildRequestOf("describe", " \n\t ")).toBeNull();
    expect(buildRequestOf("describe", "a")).toMatchObject({ description: "a" });
    expect(buildRequestOf("describe", "a".repeat(500))).toMatchObject({ description: "a".repeat(500) });
    expect(buildRequestOf("describe", "a".repeat(501))).toBeNull();
    // Spaces that collapse bring a long text back under the cap.
    expect(buildRequestOf("describe", `${"a".repeat(250)}${" ".repeat(40)}${"b".repeat(249)}`)).not.toBeNull();
  });

  it("the name stays within the 80 characters the route takes", () => {
    const request = buildRequestOf("describe", "word ".repeat(100));
    expect(request && request.name.length).toBeLessThanOrEqual(60);
  });
});

describe("readAgainRequestOf", () => {
  it("reads the audience's own account again into the same audience", () => {
    const readAgain = DEV_PAGES.own.page.readAgain!;
    expect(readAgainRequestOf(readAgain)).toEqual({
      handle: readAgain.handle,
      type: readAgain.type,
      platform: "tiktok",
      goalIntent: readAgain.goalIntent,
      name: readAgain.name,
      audienceId: readAgain.audienceId,
    });
  });

  it("another creator's audience stays a target", () => {
    const readAgain = DEV_PAGES.other.page.readAgain!;
    expect(readAgainRequestOf(readAgain)).toMatchObject({ type: "target", handle: "leo.makes", audienceId: readAgain.audienceId });
  });
});

describe("nameFromDescription (the old screen's rule)", () => {
  it("passes a short description through, collapsed to one line", () => {
    expect(nameFromDescription("Women 25–40 into  home training")).toBe("Women 25–40 into home training");
  });

  it("cuts a long description at a word boundary under 60 chars", () => {
    const name = nameFromDescription(
      "Women 25–40 into home strength training. Skeptical of fitness influencers, respond to form breakdowns.",
    );
    expect(name).toBe("Women 25–40 into home strength training. Skeptical of");
    expect(name.length).toBeLessThanOrEqual(60);
  });

  it("a long first word with no space after character 20 is cut at 60", () => {
    expect(nameFromDescription(`${"a".repeat(10)} ${"b".repeat(80)}`)).toBe(`${"a".repeat(10)} ${"b".repeat(49)}`);
  });

  it("exactly 60 characters stay whole", () => {
    expect(nameFromDescription("a".repeat(60))).toBe("a".repeat(60));
  });

  it("an empty description makes no request, so it never needs a name: it gives none", () => {
    expect(buildRequestOf("describe", "   ")).toBeNull();
    expect(nameFromDescription("   ")).toBe("");
  });
});
