/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCRIPT_FROM_KEY, SCRIPT_FROM_MAX_AGE_MS, leaveScriptFrom, takeScriptFrom } from "@/lib/thread-next/script-from";

const HOOK = "I spent $40 on meal prep & it tasted like regret. 100% #real, y’all + more";

beforeEach(() => sessionStorage.clear());

describe("the script-from hand-off", () => {
  it("leaves the trimmed text for a thread; that thread takes it once", () => {
    expect(leaveScriptFrom("t-1", `  ${HOOK} `)).toBe(true);
    expect(takeScriptFrom("t-1")).toBe(HOOK);
    expect(takeScriptFrom("t-1")).toBeNull();
    expect(sessionStorage.getItem(SCRIPT_FROM_KEY)).toBeNull();
  });

  it("another thread gets nothing, and the entry is gone", () => {
    leaveScriptFrom("t-1", HOOK);
    expect(takeScriptFrom("t-2")).toBeNull();
    expect(takeScriptFrom("t-1")).toBeNull();
  });

  it("a blank text or no thread leaves nothing", () => {
    expect(leaveScriptFrom("t-1", "   ")).toBe(false);
    expect(leaveScriptFrom("", HOOK)).toBe(false);
    expect(sessionStorage.getItem(SCRIPT_FROM_KEY)).toBeNull();
  });

  it("an entry that is not ours is removed and ignored", () => {
    sessionStorage.setItem(SCRIPT_FROM_KEY, "not json");
    expect(takeScriptFrom("t-1")).toBeNull();
    expect(sessionStorage.getItem(SCRIPT_FROM_KEY)).toBeNull();
    sessionStorage.setItem(SCRIPT_FROM_KEY, JSON.stringify({ threadId: "t-1", text: 7 }));
    expect(takeScriptFrom("t-1")).toBeNull();
  });
});

describe("the hand-off expires (fix round 1)", () => {
  const T0 = new Date("2026-11-23T10:00:00.000Z").getTime();
  const put = (entry: Record<string, unknown>) => sessionStorage.setItem(SCRIPT_FROM_KEY, JSON.stringify(entry));
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("the window is a minute", () => {
    expect(SCRIPT_FROM_MAX_AGE_MS).toBe(60_000);
  });

  it("the stored entry holds the moment it was left", () => {
    leaveScriptFrom("t-1", HOOK);
    expect(JSON.parse(sessionStorage.getItem(SCRIPT_FROM_KEY)!)).toEqual({ threadId: "t-1", text: HOOK, at: T0 });
  });

  it("an entry left 59 s ago is taken, and so is one left exactly a minute ago", () => {
    leaveScriptFrom("t-1", HOOK);
    vi.setSystemTime(T0 + 59_000);
    expect(takeScriptFrom("t-1")).toBe(HOOK);
    vi.setSystemTime(T0);
    leaveScriptFrom("t-1", HOOK);
    vi.setSystemTime(T0 + 60_000);
    expect(takeScriptFrom("t-1")).toBe(HOOK);
  });

  it("one left 61 s ago is not taken, and it is removed", () => {
    leaveScriptFrom("t-1", HOOK);
    vi.setSystemTime(T0 + 61_000);
    expect(takeScriptFrom("t-1")).toBeNull();
    expect(sessionStorage.getItem(SCRIPT_FROM_KEY)).toBeNull();
  });

  it("no `at`, a non-number `at`, or an `at` more than a second in the future: not taken, and removed", () => {
    for (const entry of [
      { threadId: "t-1", text: HOOK },
      { threadId: "t-1", text: HOOK, at: String(T0) },
      { threadId: "t-1", text: HOOK, at: null },
      { threadId: "t-1", text: HOOK, at: T0 + 1_001 },
    ]) {
      put(entry);
      expect(takeScriptFrom("t-1")).toBeNull();
      expect(sessionStorage.getItem(SCRIPT_FROM_KEY)).toBeNull();
    }
  });

  it("an `at` up to a second ahead (clock skew) is still taken", () => {
    put({ threadId: "t-1", text: HOOK, at: T0 + 1_000 });
    expect(takeScriptFrom("t-1")).toBe(HOOK);
  });
});
