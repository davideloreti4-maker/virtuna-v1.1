/**
 * /audience under each build of the flag. The flag is a build-time constant, so each case loads the page
 * fresh with it set the way that build would have it (as Library's page test does). Stand-ins: the session
 * client (`@/lib/supabase/server`: it knows the user and nothing else, so any table read fails) and the new
 * page's one server read (`readAudiencePage`), whose answer each case sets.
 *
 * - Flag off: exactly as before: the old list page, its title, the old `?tab=account` redirect; the new read
 *   is never called.
 * - Flag on: the read's answer goes to the new screen as it is (keyed by the audience shown, so another
 *   audience is a fresh screen); a redirect is Next's; the address's `tab` and `account` reach the read.
 * - Signed out: nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

import { DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";
import type { AudienceRead } from "@/lib/audience-next/audience-model";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string } | null = { id: "u-1" };
let served: AudienceRead = { kind: "none", pushed: false };
const readAudiencePage = vi.fn(async (..._args: unknown[]) => served);
/** The session client the page makes: the read must be handed this one. */
const client = { auth: { getUser: async () => ({ data: { user } }) } };

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => client }));
  vi.doMock("@/lib/audience-next/read-audience-page", () => ({ readAudiencePage }));
  const page = await import("../page");
  return {
    Page: page.default,
    metadata: page.metadata,
    AudienceNext: (await import("@/components/audience-next/audience-next")).AudienceNext,
    AudienceManager: (await import("@/components/audience/audience-manager")).AudienceManager,
  };
}

type Params = { tab?: string; account?: string };
const search = (params: Params = {}) => ({ searchParams: Promise.resolve(params) });
type Element = ReactElement<{ read?: unknown; accounts?: unknown }>;

/** What Next throws for redirect(): an error whose digest names the address. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

const OWN: AudienceRead = { kind: "audience", pushed: false, page: DEV_PAGES.own.page, choices: DEV_PAGES.own.choices };

beforeEach(() => {
  user = { id: "u-1" };
  served = { kind: "none", pushed: false };
  readAudiencePage.mockClear();
});

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/audience-next/read-audience-page");
  vi.resetModules();
});

describe("/audience, flag off: as before", () => {
  it("renders the old list page; the new read is never called", async () => {
    const { Page, AudienceManager } = await load(false);
    const element = (await Page(search())) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AudienceManager);
    // The stand-in client reads no table: the accounts degrade to none, as before.
    expect(element.props.accounts).toEqual([]);
    expect(readAudiencePage).not.toHaveBeenCalled();
  });

  it("keeps the old ?tab=account redirect (no account: back to /audience); the new read is never called", async () => {
    const { Page } = await load(false);
    expect(await thrown(() => Page(search({ tab: "account", account: "acc-9" })))).toMatch(/^NEXT_REDIRECT;[a-z]+;\/audience;/);
    expect(readAudiencePage).not.toHaveBeenCalled();
  });

  it("keeps its title", async () => {
    const { metadata } = await load(false);
    expect(metadata.title).toBe("Your audiences | Maven");
  });
});

describe("/audience, flag on: the new Audience", () => {
  it.each([
    ["an audience", OWN, DEV_PAGES.own.page.id],
    ["none yet", { kind: "none", pushed: false } as AudienceRead, "none"],
    ["a failed read", { kind: "failed", pushed: false } as AudienceRead, "failed"],
  ])("%s: the new screen with the read as it is, keyed by what it shows", async (_label, read, key) => {
    served = read;
    const { Page, AudienceNext } = await load(true);
    const element = (await Page(search())) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AudienceNext);
    expect(element.props.read).toBe(read);
    expect(element.key).toBe(key);
  });

  it("reads the page once for the signed-in user, through the session client, as the index route", async () => {
    const { Page } = await load(true);
    await Page(search());
    expect(readAudiencePage).toHaveBeenCalledTimes(1);
    expect(readAudiencePage).toHaveBeenCalledWith(client, "u-1", { route: "index" }, expect.any(Date));
  });

  it("the old ?tab=account address and its account reach the read", async () => {
    const { Page } = await load(true);
    await Page(search({ tab: "account", account: "acc-9" }));
    expect(readAudiencePage).toHaveBeenCalledWith(client, "u-1", { route: "index", tab: "account", account: "acc-9" }, expect.any(Date));
  });

  it("a redirect from the read is Next's redirect to that address", async () => {
    served = { kind: "redirect", to: "/audience/aud-7" };
    const { Page } = await load(true);
    expect(await thrown(() => Page(search({ tab: "account" })))).toMatch(/^NEXT_REDIRECT;[a-z]+;\/audience\/aud-7;/);
  });

  it("is titled Audience", async () => {
    const { metadata } = await load(true);
    expect(metadata.title).toBe("Audience | Maven");
  });

  it("signed out: nothing, and nothing read", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await Page(search())).toBeNull();
    expect(readAudiencePage).not.toHaveBeenCalled();
  });
});
