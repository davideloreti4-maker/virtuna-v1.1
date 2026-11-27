/**
 * answers.ts (plan 01-start-and-profile, Task 2): the handles and the niche as /start keeps them, what is kept
 * of a stored or sent value, the strict check the server runs, and local storage that may refuse.
 * The storage stand-in is a Map: the browser's storage, as far as these three calls use it.
 */
import { describe, expect, it } from "vitest";

import {
  answersOf,
  cleanHandle,
  cleanNiche,
  clearStart,
  completeAnswersOf,
  nicheAnswered,
  readStart,
  START_STORAGE_KEY,
  storedStartOf,
  writeStart,
  type StartAnswers,
} from "../answers";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}
const refusing = {
  getItem: (): string | null => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("full");
  },
  removeItem: () => {
    throw new Error("denied");
  },
};

const TYPED: StartAnswers = { platforms: ["tiktok"], tiktokHandle: "niacooks", niche: "budget meals for students", nicheSource: "typed", goal: "growth" };

describe("cleanHandle", () => {
  it.each([
    ["tiktok", "@NiaCooks", "niacooks"],
    ["tiktok", "  nia.cooks_ ", "nia.cooks_"],
    ["tiktok", "https://www.tiktok.com/@nia.cooks?lang=en", "nia.cooks"],
    ["instagram", "@Nia.Cooks", "nia.cooks"],
    ["instagram", "https://instagram.com/nia_cooks/", "nia_cooks"],
  ] as const)("%s %j is %j", (platform, raw, want) => {
    expect(cleanHandle(platform, raw)).toBe(want);
  });

  it.each([
    ["tiktok", "nia cooks"],
    ["tiktok", "nia!"],
    ["tiktok", ""],
    ["instagram", "a".repeat(31)],
    ["instagram", "nia-cooks"],
  ] as const)("%s %j is no handle", (platform, raw) => {
    expect(cleanHandle(platform, raw)).toBeNull();
  });
});

describe("cleanNiche", () => {
  it("collapses spaces and trims", () => {
    expect(cleanNiche("  budget   meals\nfor students ")).toBe("budget meals for students");
  });
  it.each(["ab", "x".repeat(60)])("keeps %j (2 to 60 characters)", (raw) => {
    expect(cleanNiche(raw)).toBe(raw);
  });
  it.each(["", "   ", "a", "x".repeat(61)])("refuses %j", (raw) => {
    expect(cleanNiche(raw)).toBeNull();
  });
});

describe("answersOf (lenient)", () => {
  it("anything but an object is the empty answers", () => {
    for (const value of [null, "x", 3, []]) expect(answersOf(value)).toEqual({ platforms: [], nicheSource: "typed" });
  });

  it("keeps known platforms once, in a fixed order", () => {
    expect(answersOf({ platforms: ["instagram", "x", "tiktok", "tiktok"] }).platforms).toEqual(["tiktok", "instagram"]);
  });

  it("keeps a handle only when it is valid and its platform is picked", () => {
    expect(answersOf({ platforms: ["instagram"], tiktokHandle: "nia", instagramHandle: "@Nia" })).toEqual({
      platforms: ["instagram"],
      instagramHandle: "nia",
      nicheSource: "typed",
    });
    expect(answersOf({ platforms: ["tiktok"], tiktokHandle: "nia cooks" }).tiktokHandle).toBeUndefined();
  });

  it("'account' needs a TikTok handle, and carries no niche", () => {
    expect(answersOf({ platforms: ["instagram"], nicheSource: "account" }).nicheSource).toBe("typed");
    expect(answersOf({ platforms: ["tiktok"], tiktokHandle: "nia", nicheSource: "account", niche: "food" })).toEqual({
      platforms: ["tiktok"],
      tiktokHandle: "nia",
      nicheSource: "account",
    });
  });

  it("drops a niche or a goal it cannot keep", () => {
    const a = answersOf({ platforms: ["tiktok"], niche: "a", goal: "fame" });
    expect(a.niche).toBeUndefined();
    expect(a.goal).toBeUndefined();
  });
});

describe("nicheAnswered", () => {
  it("typed: a niche of 2 to 60; account: a TikTok handle", () => {
    expect(nicheAnswered({ platforms: ["tiktok"], nicheSource: "typed", niche: "food" })).toBe(true);
    expect(nicheAnswered({ platforms: ["tiktok"], nicheSource: "typed" })).toBe(false);
    expect(nicheAnswered({ platforms: ["tiktok"], nicheSource: "account", tiktokHandle: "nia" })).toBe(true);
    expect(nicheAnswered({ platforms: ["tiktok"], nicheSource: "account" })).toBe(false);
  });
});

describe("completeAnswersOf (strict, the server's check)", () => {
  it("takes full typed answers", () => {
    expect(completeAnswersOf(TYPED)).toEqual(TYPED);
  });

  it("takes account answers", () => {
    const account = { platforms: ["tiktok"], tiktokHandle: "niacooks", nicheSource: "account", goal: "brand_deals" };
    expect(completeAnswersOf(account)).toEqual(account);
  });

  it("an empty handle is no handle", () => {
    expect(completeAnswersOf({ ...TYPED, platforms: ["instagram"], tiktokHandle: undefined, instagramHandle: "" })).toEqual({
      platforms: ["instagram"],
      niche: "budget meals for students",
      nicheSource: "typed",
      goal: "growth",
    });
  });

  it.each([
    ["no goal", { ...TYPED, goal: undefined }],
    ["no platform", { ...TYPED, platforms: [] }],
    ["a niche too short", { ...TYPED, niche: "a" }],
    ["a handle it cannot keep", { ...TYPED, tiktokHandle: "nia cooks" }],
    ["a handle for a platform not picked", { ...TYPED, platforms: ["instagram"] }],
    ["'account' without a TikTok handle", { platforms: ["instagram"], nicheSource: "account", goal: "growth" }],
    ["not an object", "x"],
  ])("refuses %s", (_, value) => {
    expect(completeAnswersOf(value)).toBeNull();
  });
});

describe("local storage", () => {
  it("nothing stored: the empty answers on the first step", () => {
    expect(readStart(memoryStorage())).toEqual({ platforms: [], nicheSource: "typed", step: "platform" });
  });

  it("writes and reads back under maven.start.v1", () => {
    const storage = memoryStorage();
    writeStart(storage, { ...TYPED, step: "goal" });
    expect(JSON.parse(storage.items.get(START_STORAGE_KEY)!)).toEqual({ ...TYPED, step: "goal" });
    expect(readStart(storage)).toEqual({ ...TYPED, step: "goal" });
  });

  it("bad JSON or an unknown step: what can be kept, on the first step", () => {
    expect(storedStartOf("{nope")).toEqual({ platforms: [], nicheSource: "typed", step: "platform" });
    expect(storedStartOf(JSON.stringify({ ...TYPED, step: "pay" }))).toEqual({ ...TYPED, step: "platform" });
  });

  it("clears", () => {
    const storage = memoryStorage({ [START_STORAGE_KEY]: JSON.stringify(TYPED) });
    clearStart(storage);
    expect(storage.items.has(START_STORAGE_KEY)).toBe(false);
  });

  it("a storage that refuses, or none, never throws", () => {
    expect(readStart(refusing)).toEqual({ platforms: [], nicheSource: "typed", step: "platform" });
    expect(() => writeStart(refusing, { platforms: [], nicheSource: "typed", step: "platform" })).not.toThrow();
    expect(() => clearStart(refusing)).not.toThrow();
    expect(readStart(null).step).toBe("platform");
  });
});
