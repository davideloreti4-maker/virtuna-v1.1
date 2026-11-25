/**
 * /you under each build of the flag (plan 2026-11-24-you, Task 5). The flag is a build-time
 * constant, so each case loads the page fresh with it set (as Library's page test does). The session
 * read is the one stand-in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string; is_anonymous?: boolean } | null = { id: "u-1" };

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
  const page = await import("../page");
  return {
    Page: page.default,
    metadata: page.metadata,
    YouNext: (await import("@/components/you-next/you-next")).YouNext,
    YouSignUp: (await import("@/components/you-next/you-sign-up")).YouSignUp,
  };
}

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
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.resetModules();
});

describe("/you", () => {
  it("does not exist with the flag off", async () => {
    const { Page } = await load(false);
    expect(await thrown(() => Page())).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("signed in: the page with its data", async () => {
    const { Page, YouNext, metadata } = await load(true);
    const element = (await Page()) as ReactElement;
    expect(isValidElement(element) && element.type).toBe(YouNext);
    expect(metadata.title).toBe("You | Maven");
  });

  it("a /go visitor (anonymous): the card asking for an account, nothing that reads or saves", async () => {
    user = { id: "u-1", is_anonymous: true };
    const { Page, YouSignUp } = await load(true);
    expect(((await Page()) as ReactElement).type).toBe(YouSignUp);
  });

  it("signed out: nothing (the layout and the middleware send the visitor to log in)", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await Page()).toBeNull();
  });
});
