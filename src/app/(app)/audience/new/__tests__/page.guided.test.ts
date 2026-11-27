/**
 * /audience/new?guide=1 under the new look (plan 01-start-and-profile, Task 9): the page hands `guided` to the
 * new screen; without the parameter it is false. Same stand-ins as page.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";

vi.setConfig({ testTimeout: 60_000 });

async function load() {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) } }) }));
  vi.doMock("@/lib/audience/resolve-user-audience", () => ({ resolveUserAudience: async () => GENERAL_AUDIENCE }));
  const page = await import("../page");
  const { NewAudienceNext } = await import("@/components/audience-next/new-audience-next");
  return { Page: page.default, NewAudienceNext };
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/audience/resolve-user-audience");
  vi.resetModules();
});

type El = ReactElement<{ guided?: boolean }>;
const search = (params: Record<string, string>) => ({ searchParams: Promise.resolve(params) });

describe("/audience/new, guided", () => {
  it("?guide=1: guided", async () => {
    const { Page, NewAudienceNext } = await load();
    const el = (await Page(search({ guide: "1" }))) as El;
    expect(el.type).toBe(NewAudienceNext);
    expect(el.props.guided).toBe(true);
  });

  it.each<Record<string, string>>([{}, { guide: "0" }, { guide: "yes" }])("%j: not guided", async (params) => {
    const { Page } = await load();
    expect(((await Page(search(params))) as El).props.guided).toBe(false);
  });
});
