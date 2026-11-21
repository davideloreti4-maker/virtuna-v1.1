/**
 * Where a stored video simulation opens. The flag is a build-time constant, so each case loads the
 * module fresh with the flag set the way that build would have it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return import("../href");
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("resultHref", () => {
  it("flag off: the board it has always opened", async () => {
    const { resultHref } = await load(false);
    expect(resultHref("abc")).toBe("/analyze/abc");
  });

  it("flag on: the new result page", async () => {
    const { resultHref } = await load(true);
    expect(resultHref("abc")).toBe("/simulation/abc");
  });
});
