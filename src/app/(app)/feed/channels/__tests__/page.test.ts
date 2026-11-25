/**
 * /feed/channels under each build of the flag. The flag is a build-time constant, so each case loads
 * the page fresh with the flag set the way that build would have it (as /feed's page test does).
 * Stand-ins: the session read, and the old client screen (stubbed, so the element can be read off).
 *
 * - Flag off: exactly as before: the old screen for a signed-in creator, nothing signed out, the same
 *   title and description.
 * - Flag on: the address opens the Watchlist chip of Discover, before anything is read.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string } | null = { id: "u-1" };
let sessionReads = 0;

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => {
      sessionReads += 1;
      return { auth: { getUser: async () => ({ data: { user } }) } };
    },
  }));
  vi.doMock("../channels-client", () => ({ ChannelsClient: () => null }));
  const page = await import("../page");
  const { ChannelsClient } = await import("../channels-client");
  return { Page: page.default as () => Promise<unknown>, metadata: page.metadata, ChannelsClient };
}

/** What Next throws for redirect(): an error whose digest names the outcome and the address. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  user = { id: "u-1" };
  sessionReads = 0;
  for (const name of ["@/lib/flags/new-look", "@/lib/supabase/server", "../channels-client"]) vi.doUnmock(name);
  vi.resetModules();
});

describe("/feed/channels, flag off: as before", () => {
  it("renders the old screen for a signed-in creator", async () => {
    const { Page, ChannelsClient } = await load(false);
    const element = (await Page()) as ReactElement;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(ChannelsClient);
    expect(element.props).toEqual({});
  });

  it("renders nothing signed out", async () => {
    user = null;
    const { Page } = await load(false);
    expect(await Page()).toBeNull();
  });

  it("keeps its title and description", async () => {
    const { metadata } = await load(false);
    expect(metadata.title).toBe("Channels | Maven");
    expect(metadata.description).toBe("Watch TikTok creators to build your persistent Videos feed.");
  });
});

describe("/feed/channels, flag on: the Watchlist chip", () => {
  it("redirects to /feed?tab=watchlist, before anything is read", async () => {
    const { Page } = await load(true);
    expect(await thrown(() => Page())).toMatch(/^NEXT_REDIRECT;[a-z]+;\/feed\?tab=watchlist;/);
    expect(sessionReads).toBe(0);
  });

  it("signed out too (the app's own guard handles the session)", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await thrown(() => Page())).toMatch(/\/feed\?tab=watchlist/);
  });
});
