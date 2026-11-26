/**
 * /settings' loading file under each build of the flag (as /audience's loading test does). Flag on: the
 * new page's own outline. Flag off: the old skeleton, exactly as before.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return {
    Loading: (await import("../loading")).default,
    SettingsNextLoading: (await import("@/components/settings-next/settings-next")).SettingsNextLoading,
  };
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("/settings loading", () => {
  it("flag on: the new page's outline", async () => {
    const { Loading, SettingsNextLoading } = await load(true);
    const element = Loading() as ReactElement;
    expect(isValidElement(element) && element.type).toBe(SettingsNextLoading);
  });

  it("flag off: the old skeleton", async () => {
    const { Loading, SettingsNextLoading } = await load(false);
    const element = Loading() as ReactElement<{ className?: string }>;
    expect(element.type).toBe("div");
    expect(element.type).not.toBe(SettingsNextLoading);
    expect(element.props.className).toBe("mx-auto max-w-4xl space-y-8 p-6");
  });
});
