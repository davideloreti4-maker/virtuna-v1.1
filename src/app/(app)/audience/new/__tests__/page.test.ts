/**
 * /audience/new and its loading file under each build of the flag. The flag is a build-time constant, so
 * each case loads the files fresh with it set the way that build would have it (as /audience's page test
 * does). The new page reads one thing, whether the creator has an audience of their own in use: the session
 * client (`@/lib/supabase/server`) and that read (`resolveUserAudience`) are the stand-ins.
 *
 * - Flag off: exactly as before: the old page (the old create flow inside, with the door its address picks
 *   and the handle), its title, the old skeleton.
 * - Flag on: the new page, with the row each old address form chooses and the handle; its loading outline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

import { GENERAL_AUDIENCE, PRESET_AUDIENCES } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import * as A from "@/lib/audience-next/__tests__/audiences";

let user: { id: string } | null;
let used: () => Promise<Audience>;
const resolveUserAudience = vi.fn(async () => used());
beforeEach(() => {
  user = { id: "u-1" };
  used = async () => GENERAL_AUDIENCE;
  resolveUserAudience.mockClear();
});

vi.setConfig({ testTimeout: 60_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
  vi.doMock("@/lib/audience/resolve-user-audience", () => ({ resolveUserAudience }));
  const page = await import("../page");
  return {
    Page: page.default,
    metadata: page.metadata,
    Loading: (await import("../loading")).default,
    NewAudienceNext: (await import("@/components/audience-next/new-audience-next")).NewAudienceNext,
    NewAudienceLoading: (await import("@/components/audience-next/new-audience-screen")).NewAudienceLoading,
    AudienceCreate: (await import("@/components/audience/audience-create")).AudienceCreate,
  };
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/audience/resolve-user-audience");
  vi.resetModules();
});

type Params = { door?: string; source?: string; handle?: string; mode?: string };
const search = (params: Params = {}) => ({ searchParams: Promise.resolve(params) });
type Element = ReactElement<{ initialDoor?: unknown; prefill?: unknown; prefillHandle?: unknown; inUse?: unknown; children?: ReactNode }>;

/** Every element under `node`, depth first (the old page's tree is plain elements). */
function elementsIn(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elementsIn);
  if (!isValidElement(node)) return [];
  const el = node as Element;
  return [el, ...elementsIn(el.props.children)];
}

describe("/audience/new, flag off: as before", () => {
  it.each([
    [{}, undefined],
    [{ door: "connect" }, "connect"],
    [{ door: "handle" }, "handle"],
    [{ door: "describe" }, "describe"],
    [{ source: "account", handle: "nia.tests" }, "connect"],
    [{ mode: "general" }, "describe"],
  ] as const)("%o: the old page with the old create flow, door %s", async (params, door) => {
    const { Page, AudienceCreate, NewAudienceNext } = await load(false);
    const element = (await Page(search(params))) as Element;
    const all = elementsIn(element);
    const create = all.find((e) => e.type === AudienceCreate);
    expect(create).toBeDefined();
    expect(create!.props.initialDoor).toBe(door);
    expect(create!.props.prefillHandle).toBe((params as Params).handle);
    expect(all.some((e) => e.type === NewAudienceNext)).toBe(false);
  });

  it("reads nothing", async () => {
    const { Page } = await load(false);
    await Page(search());
    expect(resolveUserAudience).not.toHaveBeenCalled();
  });

  it("keeps its title", async () => {
    const { metadata } = await load(false);
    expect(metadata.title).toBe("New audience | Maven");
  });

  it("loading: the old skeleton", async () => {
    const { Loading, NewAudienceLoading } = await load(false);
    const element = Loading() as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe("div");
    expect(elementsIn(element).some((e) => e.type === NewAudienceLoading)).toBe(false);
  });
});

describe("/audience/new, flag on: the new page", () => {
  it.each([
    [{}, "own", ""],
    [{ door: "connect" }, "own", ""],
    [{ door: "handle" }, "other", ""],
    [{ door: "describe" }, "describe", ""],
    [{ source: "account", handle: "nia.tests" }, "own", "nia.tests"],
    [{ mode: "general" }, "describe", ""],
    [{ door: "handle", handle: "leo.makes" }, "other", "leo.makes"],
  ] as const)("%o: door %s, prefill %j", async (params, door, prefill) => {
    const { Page, NewAudienceNext } = await load(true);
    const element = (await Page(search(params))) as Element;
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(NewAudienceNext);
    expect(element.props.initialDoor).toBe(door);
    expect(element.props.prefill).toBe(prefill);
  });

  it("a repeated handle in the address (an array at run time) is no handle; a repeated door chooses no row", async () => {
    const { Page, NewAudienceNext } = await load(true);
    const repeated = { door: "handle", handle: ["nia.tests", "leo.makes"] } as unknown as Params;
    const element = (await Page(search(repeated))) as Element;
    expect(element.type).toBe(NewAudienceNext);
    expect(element.props.initialDoor).toBe("other");
    expect(element.props.prefill).toBe("");
    const doors = (await Page(search({ door: ["handle", "describe"] } as unknown as Params))) as Element;
    expect(doors.props.initialDoor).toBe("own");
  });

  it("a creator with an audience of their own in use: inUse (too little to read then offers only another try)", async () => {
    used = async () => A.own();
    const { Page } = await load(true);
    expect(((await Page(search())) as Element).props).toMatchObject({ inUse: true });
    expect(resolveUserAudience).toHaveBeenCalledWith(expect.anything(), "u-1");
  });

  it.each([
    ["on general viewers", () => {
      used = async () => GENERAL_AUDIENCE;
    }],
    ["on a preset", () => {
      used = async () => PRESET_AUDIENCES[0]!;
    }],
    ["signed out", () => {
      user = null;
    }],
    ["the read fails", () => {
      used = async () => {
        throw new Error("no settings");
      };
    }],
  ] as const)("%s: not inUse", async (_case, given) => {
    given();
    const { Page } = await load(true);
    expect(((await Page(search())) as Element).props).toMatchObject({ inUse: false });
  });

  it("keeps the same title", async () => {
    const { metadata } = await load(true);
    expect(metadata.title).toBe("New audience | Maven");
  });

  it("loading: the new page's outline", async () => {
    const { Loading, NewAudienceLoading } = await load(true);
    const element = Loading() as Element;
    expect(element.type).toBe(NewAudienceLoading);
  });
});
