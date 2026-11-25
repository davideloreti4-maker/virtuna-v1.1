import { describe, expect, it } from "vitest";

import type { WatchlistSource } from "@/lib/discover/watchlist-reads";

import {
  HANDLE_PATTERN,
  ROW_COVERS,
  filterRows,
  followInput,
  initialOf,
  isFollowed,
  profileHref,
  pullInput,
  removalOf,
  rowCovers,
  rowKey,
  rowKeys,
  rowLine,
} from "../watchlist";

// Made-up creators only.
function source(over: Partial<WatchlistSource> = {}): WatchlistSource {
  return {
    key: "p-1",
    handle: "jay.makes",
    name: "Jay Makes",
    avatarUrl: null,
    followerCount: null,
    outlierCount: 0,
    bestMultiplier: null,
    videosHeld: 0,
    newestPostAt: null,
    mergedFrom: null,
    held: false,
    profileHandle: "jay.makes",
    trackedIds: ["t-1"],
    competitorId: null,
    covers: [],
    provenCount: 0,
    ...over,
  };
}

describe("rowLine", () => {
  it("says the followers in the multiple's words", () => {
    expect(rowLine(source({ followerCount: 162_000_000 }))).toBe("162M followers");
    expect(rowLine(source({ followerCount: 15_400_000 }))).toBe("15.4M followers");
    expect(rowLine(source({ followerCount: 1 }))).toBe("1 follower");
  });

  it("adds the proven count when Maven holds proven videos of the creator", () => {
    expect(rowLine(source({ followerCount: 86_000_000, provenCount: 13 }))).toBe("86M followers · 13 proven");
  });

  it("the proven count alone when there is no follower count", () => {
    expect(rowLine(source({ followerCount: null, provenCount: 2 }))).toBe("2 proven");
  });

  it("no proven count at zero, nor when the read did not give one", () => {
    expect(rowLine(source({ followerCount: 5_000_000, provenCount: 0 }))).toBe("5M followers");
    expect(rowLine(source({ followerCount: 5_000_000, provenCount: undefined }))).toBe("5M followers");
  });

  it("no follower count at zero (a read that found none)", () => {
    expect(rowLine(source({ followerCount: 0, provenCount: 0 }))).toBeNull();
  });

  it("a creator that could not be read says so, and nothing else", () => {
    expect(rowLine(source({ held: true, followerCount: null, provenCount: 4 }))).toBe("Couldn't be read");
  });

  it("null when there is nothing to say", () => {
    expect(rowLine(source())).toBeNull();
  });
});

describe("filterRows", () => {
  const rows = [
    source({ key: "a", handle: "jay.makes", name: "Jay Makes" }),
    source({ key: "b", handle: "nia.cooks", name: "Nia in the kitchen" }),
    source({ key: "c", handle: "dev.lifts", name: "dev.lifts" }),
  ];
  const keys = (q: string) => filterRows(rows, q).map((r) => r.key);

  it("an empty search keeps every row, in order, as a new array", () => {
    expect(keys("")).toEqual(["a", "b", "c"]);
    expect(keys("   ")).toEqual(["a", "b", "c"]);
    expect(filterRows(rows, "")).not.toBe(rows);
  });

  it("by handle, case-insensitive", () => {
    expect(keys("JAY")).toEqual(["a"]);
    expect(keys(".lifts")).toEqual(["c"]);
  });

  it("by name", () => {
    expect(keys("kitchen")).toEqual(["b"]);
  });

  it("the @ is ignored", () => {
    expect(keys("@nia")).toEqual(["b"]);
    expect(keys("@")).toEqual(["a", "b", "c"]);
  });

  it("a TikTok profile link finds its creator", () => {
    expect(keys("https://www.tiktok.com/@dev.lifts")).toEqual(["c"]);
  });

  it("nothing matches: an empty list", () => {
    expect(keys("zzz")).toEqual([]);
  });
});

describe("followInput", () => {
  it.each([
    ["@jay.makes", "jay.makes"],
    ["  @Jay.Makes  ", "jay.makes"],
    ["@nia_cooks", "nia_cooks"],
    ["https://www.tiktok.com/@dev.lifts", "dev.lifts"],
    ["tiktok.com/@dev.lifts?lang=en", "dev.lifts"],
    ["@ab", "ab"],
    [`@${"a".repeat(24)}`, "a".repeat(24)],
  ])("%s is the handle %s", (text, handle) => {
    expect(followInput(text)).toBe(handle);
  });

  it.each([
    ["", "empty"],
    ["   ", "blank"],
    ["@", "a lone @"],
    ["@a", "one character"],
    [`@${"a".repeat(25)}`, "25 characters"],
    ["@jay makes", "a space inside"],
    ["@jay-makes", "a hyphen"],
    ["jay.makes", "no @ and no link: read as words"],
    ["meal prep", "words"],
    ["https://www.instagram.com/jay.makes", "a link that is not TikTok"],
  ])("%j is refused (%s)", (text) => {
    expect(followInput(text)).toBeNull();
  });

  it("the pattern is the one it says", () => {
    expect(HANDLE_PATTERN.test("jay.makes")).toBe(true);
    expect(HANDLE_PATTERN.test("Jay.Makes")).toBe(false);
  });
});

describe("isFollowed", () => {
  const rows = [
    source({ handle: "jay.makes", mergedFrom: null }),
    source({ key: "p-2", handle: "cbum.real", mergedFrom: "chris.lifts" }),
  ];

  it("a row's handle, in any case, with or without @", () => {
    expect(isFollowed(rows, "jay.makes")).toBe(true);
    expect(isFollowed(rows, "@Jay.Makes")).toBe(true);
    expect(isFollowed(rows, " @jay.makes ")).toBe(true);
  });

  it("the spelling that folded into a row", () => {
    expect(isFollowed(rows, "chris.lifts")).toBe(true);
  });

  it("anyone else, or nothing, is not followed", () => {
    expect(isFollowed(rows, "nia.cooks")).toBe(false);
    expect(isFollowed(rows, "jaymakes")).toBe(false);
    expect(isFollowed(rows, "")).toBe(false);
    expect(isFollowed(rows, "@")).toBe(false);
    expect(isFollowed([], "jay.makes")).toBe(false);
  });
});

describe("profileHref", () => {
  it("a valid handle's TikTok profile", () => {
    expect(profileHref("jay.makes")).toBe("https://www.tiktok.com/@jay.makes");
    expect(profileHref("@Jay.Makes")).toBe("https://www.tiktok.com/@jay.makes");
  });

  it.each(["", "@", "a", "jay makes", "jay/../x", "a".repeat(25), "Chris Bumstead"])("null for %j", (handle) => {
    expect(profileHref(handle)).toBeNull();
  });
});

describe("pullInput", () => {
  it("what a row's Pull sends to the pull page: the handle with its @, for a handle Maven can read", () => {
    expect(pullInput("jay.makes")).toBe("@jay.makes");
    expect(pullInput("@Jay.Makes")).toBe("@jay.makes");
  });

  it.each(["", "@", "a", "jay makes", "Chris Bumstead"])("null for %j: no Pull is offered", (handle) => {
    expect(pullInput(handle)).toBeNull();
  });
});

describe("removalOf", () => {
  it("a followed-only row: its records, no link", () => {
    expect(removalOf(source({ trackedIds: ["t-1"], competitorId: null }))).toEqual({ trackedIds: ["t-1"], competitorId: null });
  });

  it("a linked-only row: the link", () => {
    expect(removalOf(source({ trackedIds: [], competitorId: "p-1" }))).toEqual({ trackedIds: [], competitorId: "p-1" });
  });

  it("a merged row: every record and the link", () => {
    expect(removalOf(source({ trackedIds: ["t-tt", "t-ig"], competitorId: "p-1" }))).toEqual({
      trackedIds: ["t-tt", "t-ig"],
      competitorId: "p-1",
    });
  });

  it("a row resting on nothing it can name has no Remove (also when the read gave no ids)", () => {
    expect(removalOf(source({ trackedIds: [], competitorId: null }))).toBeNull();
    expect(removalOf(source({ trackedIds: undefined, competitorId: undefined }))).toBeNull();
  });
});

describe("rowKey", () => {
  it("is the read's key with the records it rests on, so two rows of one handle on two platforms differ", () => {
    const tiktok = source({ key: "jay.makes", trackedIds: ["t-tt"] });
    const instagram = source({ key: "jay.makes", trackedIds: ["t-ig"] });
    expect(rowKey(tiktok)).not.toBe(rowKey(instagram));
    expect(rowKey(tiktok)).toBe(rowKey({ ...tiktok }));
  });

  it("a row without ids still has a key", () => {
    expect(rowKey(source({ key: "p-9", trackedIds: undefined }))).toContain("p-9");
  });
});

describe("rowCovers", () => {
  it("at most three, in the read's order", () => {
    expect(ROW_COVERS).toBe(3);
    expect(rowCovers(source({ covers: ["a", "b", "c", "d"] }))).toEqual(["a", "b", "c"]);
    expect(rowCovers(source({ covers: ["a"] }))).toEqual(["a"]);
  });

  it("none when the read gave none", () => {
    expect(rowCovers(source({ covers: undefined }))).toEqual([]);
  });
});

describe("initialOf", () => {
  it("the handle's first letter or digit, upper case", () => {
    expect(initialOf("jay.makes")).toBe("J");
    expect(initialOf("_nia")).toBe("N");
    expect(initialOf("9lives")).toBe("9");
  });

  it("a handle with none: a placeholder mark", () => {
    expect(initialOf("._")).toBe("@");
    expect(initialOf("")).toBe("@");
  });
});

describe("rowKeys: one key per row on screen, unique even when the read repeats one", () => {
  it("the rows' own keys when they differ", () => {
    const rows = [source({ key: "p-1", trackedIds: ["t-1"] }), source({ key: "p-2", trackedIds: ["t-2"] })];
    expect(rowKeys(rows)).toEqual(rows.map(rowKey));
  });

  it("a key that repeats is told apart by its place among its namesakes", () => {
    const twin = source({ key: "jay.makes", trackedIds: [] });
    const keys = rowKeys([twin, source({ key: "p-2", trackedIds: ["t-2"] }), { ...twin }, { ...twin }]);
    expect(new Set(keys).size).toBe(4);
    expect(keys[0]).toBe(rowKey(twin));
    expect(keys[1]).toBe(rowKey(source({ key: "p-2", trackedIds: ["t-2"] })));
  });

  it("the same rows give the same keys", () => {
    const twin = source({ key: "jay.makes" });
    expect(rowKeys([twin, twin])).toEqual(rowKeys([twin, twin]));
  });
});

describe("rowCovers: each cover once", () => {
  it("a cover the read repeats is drawn once", () => {
    expect(rowCovers(source({ covers: ["a", "a", "b", "b", "c"] }))).toEqual(["a", "b", "c"]);
  });
});
