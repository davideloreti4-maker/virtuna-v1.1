/**
 * first-build.ts (plan 01-start-and-profile, Task 4): /start holds the first build for the building screen,
 * which takes it once. Whatever is held is read through the build request's own rules, so a changed or broken
 * value starts nothing. The storage stand-in is a Map.
 */
import { describe, expect, it } from "vitest";

import { buildRequestOf } from "@/lib/audience-next/build-request";

import { FIRST_BUILD_KEY, holdFirstBuild, takeFirstBuild } from "../first-build";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const own = buildRequestOf("own", "niacooks")!;
const described = buildRequestOf("describe", "budget meals for students")!;

describe("the first build's hand-off", () => {
  it.each([["an account read", own], ["a description", described]])("%s is taken once", (_, request) => {
    const storage = memoryStorage();
    holdFirstBuild(storage, request);
    expect(takeFirstBuild(storage)).toEqual(request);
    expect(storage.items.has(FIRST_BUILD_KEY)).toBe(false);
    expect(takeFirstBuild(storage)).toBeNull();
  });

  it.each([
    ["not JSON", "{nope"],
    ["another creator's account", JSON.stringify({ handle: "niacooks", type: "target" })],
    ["a handle that cannot be one", JSON.stringify({ handle: "nia cooks", type: "personal" })],
    ["an empty description", JSON.stringify({ description: "  " })],
  ])("%s starts nothing, and is removed", (_, raw) => {
    const storage = memoryStorage();
    storage.setItem(FIRST_BUILD_KEY, raw);
    expect(takeFirstBuild(storage)).toBeNull();
    expect(storage.items.has(FIRST_BUILD_KEY)).toBe(false);
  });

  it("no storage, or one that refuses: nothing, and no throw", () => {
    const refusing = {
      getItem: (): string | null => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => holdFirstBuild(refusing, own)).not.toThrow();
    expect(takeFirstBuild(refusing)).toBeNull();
    expect(takeFirstBuild(null)).toBeNull();
  });
});
