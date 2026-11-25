/**
 * The loading files of /audience and /audience/[id] under each build of the flag. The flag is a build-time
 * constant, so each case loads them fresh with it set the way that build would have it (as Library's page
 * test does).
 *
 * - Flag on: the new screen's own loading state; pushed for /audience/[id] (the shell's Back and title),
 *   not for /audience.
 * - Flag off: the old skeletons, exactly as before.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return {
    Index: (await import("../loading")).default,
    Pushed: (await import("../[id]/loading")).default,
    AudienceNextLoading: (await import("@/components/audience-next/audience-screen")).AudienceNextLoading,
    PageShell: (await import("@/components/surfaces/surface-header")).PageShell,
  };
}

type Element = ReactElement<{ pushed?: boolean; children?: unknown }>;

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("/audience loading", () => {
  it("flag on: the new screen's loading state, not pushed", async () => {
    const { Index, AudienceNextLoading } = await load(true);
    const element = Index() as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AudienceNextLoading);
    expect(element.props.pushed).toBe(false);
  });

  it("flag off: the old skeleton in its column", async () => {
    const { Index, PageShell, AudienceNextLoading } = await load(false);
    const element = Index() as Element;
    expect(element.type).toBe(PageShell);
    expect(element.type).not.toBe(AudienceNextLoading);
  });
});

describe("/audience/[id] loading", () => {
  it("flag on: the new screen's loading state, pushed", async () => {
    const { Pushed, AudienceNextLoading } = await load(true);
    const element = Pushed() as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AudienceNextLoading);
    expect(element.props.pushed).toBe(true);
  });

  it("flag off: the old skeleton in its column", async () => {
    const { Pushed, PageShell } = await load(false);
    expect((Pushed() as Element).type).toBe(PageShell);
  });
});
