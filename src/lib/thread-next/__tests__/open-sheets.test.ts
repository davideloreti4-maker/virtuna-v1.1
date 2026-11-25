import { afterEach, describe, expect, it, vi } from "vitest";
import { anySheetOpen, reportSheetOpen, subscribeOpenSheets } from "@/lib/thread-next/open-sheets";

// The store is the page's: every case puts back what it opened.
const releases: Array<() => void> = [];
const open = () => {
  const release = reportSheetOpen();
  releases.push(release);
  return release;
};
afterEach(() => {
  for (const release of releases.splice(0)) release();
});

describe("open sheets: whether any of the look's sheets is open (the thread's fold waits on it)", () => {
  it("none open: false", () => {
    expect(anySheetOpen()).toBe(false);
  });

  it("one opens: true; it closes: false; each change is told to a listener", () => {
    const heard = vi.fn();
    const stop = subscribeOpenSheets(heard);
    const close = open();
    expect(anySheetOpen()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    close();
    expect(anySheetOpen()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });

  it("two open at once: still true when the first closes, false once both have", () => {
    const first = open();
    const second = open();
    first();
    expect(anySheetOpen()).toBe(true);
    second();
    expect(anySheetOpen()).toBe(false);
  });

  it("a close told twice counts once: the other sheet still open stays open", () => {
    const first = open();
    open();
    first();
    first();
    expect(anySheetOpen()).toBe(true);
  });

  it("an unsubscribed listener hears nothing more", () => {
    const heard = vi.fn();
    const stop = subscribeOpenSheets(heard);
    stop();
    open();
    expect(heard).not.toHaveBeenCalled();
  });
});
