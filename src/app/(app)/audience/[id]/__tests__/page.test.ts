/**
 * /audience/[id] under each build of the flag. The flag is a build-time constant, so each case loads the page
 * fresh with it set the way that build would have it (as Library's page test does). Stand-ins: the session
 * client (`@/lib/supabase/server`: it knows the user and nothing else, so any table read fails) and the new
 * page's one server read (`readAudiencePage`), whose answer each case sets.
 *
 * - Flag off: exactly as before: with no audience found, the old shell's "Audience not found."; the new read
 *   is never called.
 * - Flag on: the read's answer for this id goes to the new screen as it is (keyed by the audience shown); a
 *   redirect is Next's; `?edit=1` is not read.
 * - Signed out: nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

import { DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";
import type { AudienceRead } from "@/lib/audience-next/audience-model";

vi.setConfig({ testTimeout: 60_000 });

let user: { id: string } | null = { id: "u-1" };
let served: AudienceRead = { kind: "none", pushed: true };
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
  };
}

/** The address's parameters, as a promise that tells whether the page awaited it. */
function props(id: string, query: Record<string, string> = {}) {
  const seen = { search: false };
  const searchParams = {
    then(resolve: (value: Record<string, string>) => unknown) {
      seen.search = true;
      return Promise.resolve(query).then(resolve);
    },
  } as unknown as Promise<{ edit?: string }>;
  return { props: { params: Promise.resolve({ id }), searchParams }, seen };
}

type Element = ReactElement<{ read?: unknown; children?: unknown; className?: string }>;
const childOf = (element: Element) => element.props.children as Element;

/** What Next throws for redirect(): an error whose digest names the address. */
async function thrown(run: () => unknown): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

const OWN: AudienceRead = { kind: "audience", pushed: true, page: DEV_PAGES.own.page, choices: DEV_PAGES.own.choices };

beforeEach(() => {
  user = { id: "u-1" };
  served = { kind: "none", pushed: true };
  readAudiencePage.mockClear();
});

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/audience-next/read-audience-page");
  vi.resetModules();
});

describe("/audience/[id], flag off: as before", () => {
  it.each([
    ["signed out", null],
    ["signed in, no audience found", { id: "u-1" }],
  ])("%s: the old shell's Audience not found.; the new read is never called", async (_label, who) => {
    user = who;
    const { Page } = await load(false);
    const element = (await Page(props("aud-1").props)) as Element;
    expect(isValidElement(element)).toBe(true);
    const line = childOf(element);
    expect(line.type).toBe("p");
    expect(line.props.className).toBe("text-sm text-error");
    expect(line.props.children).toBe("Audience not found.");
    expect(readAudiencePage).not.toHaveBeenCalled();
  });

  it("keeps its title", async () => {
    const { metadata } = await load(false);
    expect(metadata.title).toBe("Audience | Maven");
  });
});

describe("/audience/[id], flag on: the new Audience, pushed", () => {
  it.each([
    ["an audience", OWN, DEV_PAGES.own.page.id],
    ["none (General or a preset)", { kind: "none", pushed: true } as AudienceRead, "none"],
    ["a failed read", { kind: "failed", pushed: true } as AudienceRead, "failed"],
  ])("%s: the new screen with the read as it is, keyed by what it shows", async (_label, read, key) => {
    served = read;
    const { Page, AudienceNext } = await load(true);
    const element = (await Page(props("aud-1").props)) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AudienceNext);
    expect(element.props.read).toBe(read);
    expect(element.key).toBe(key);
  });

  it("reads this id once for the signed-in user, through the session client", async () => {
    const { Page } = await load(true);
    await Page(props("aud-1").props);
    expect(readAudiencePage).toHaveBeenCalledTimes(1);
    expect(readAudiencePage).toHaveBeenCalledWith(client, "u-1", { route: "id", id: "aud-1" }, expect.any(Date));
  });

  it("a redirect from the read (an account's id, an unknown id) is Next's redirect to that address", async () => {
    served = { kind: "redirect", to: "/audience/aud-7" };
    const { Page } = await load(true);
    expect(await thrown(() => Page(props("acc-9").props))).toMatch(/^NEXT_REDIRECT;[a-z]+;\/audience\/aud-7;/);
  });

  it("?edit=1 is not read: the same screen, and the address's parameters are never awaited", async () => {
    served = OWN;
    const { Page, AudienceNext } = await load(true);
    const { props: p, seen } = props("aud-1", { edit: "1" });
    const element = (await Page(p)) as Element;
    expect(element.type).toBe(AudienceNext);
    expect(seen.search).toBe(false);
  });

  it("keeps the title Audience", async () => {
    const { metadata } = await load(true);
    expect(metadata.title).toBe("Audience | Maven");
  });

  it("signed out: nothing, and nothing read", async () => {
    user = null;
    const { Page } = await load(true);
    expect(await Page(props("aud-1").props)).toBeNull();
    expect(readAudiencePage).not.toHaveBeenCalled();
  });
});
