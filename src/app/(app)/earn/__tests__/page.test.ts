/**
 * /earn under each build of the flag (plan 2026-11-24-earn, step A). The flag is a build-time constant, so
 * each case loads the page fresh with it set (as You's page test does). The session read is the one
 * stand-in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string; is_anonymous?: boolean } | null = { id: "acct-nia" };

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
  const page = await import("../page");
  return { Page: page.default, metadata: page.metadata, EarnNext: (await import("@/components/earn-next/earn-next")).EarnNext };
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
  user = { id: "acct-nia" };
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.resetModules();
});

describe("/earn", () => {
  it("does not exist with the flag off", async () => {
    const { Page } = await load(false);
    expect(await thrown(() => Page())).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("signed in: the page with its data", async () => {
    const { Page, EarnNext, metadata } = await load(true);
    const element = (await Page()) as ReactElement;
    expect(isValidElement(element) && element.type).toBe(EarnNext);
    expect(metadata.title).toBe("Earn | Maven");
  });

  it("a /go visitor (anonymous): to You, whose card asks for an account (no link without one)", async () => {
    user = { id: "acct-nia", is_anonymous: true };
    const { Page } = await load(true);
    expect(await thrown(() => Page())).toMatch(/^NEXT_REDIRECT;[a-z]+;\/you;/);
  });

  it("signed out: nothing (the layout and the middleware send the visitor to log in)", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await Page()).toBeNull();
  });
});
