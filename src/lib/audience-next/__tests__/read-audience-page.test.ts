/**
 * The Audience page's server read (spec 2026-11-25-audience, section 4; no picture is read). The
 * repository functions are the boundary: they are stand-ins here (`vi.fn`), recording their calls; the model
 * underneath is the real one.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getAccountSnapshots } from "@/lib/account-metrics/account-metrics-repo";
import { listAllPosts } from "@/lib/account-metrics/account-posts-repo";
import { GENERAL_AUDIENCE, GENERAL_TEMPLATES, listAudiences, PRESET_AUDIENCES } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import { resolveUserAudience } from "@/lib/audience/resolve-user-audience";
import { listConnectedAccounts, type ConnectedAccount } from "@/lib/connected-accounts/connected-accounts-repo";
import { buildContentPillars } from "@/lib/content-pillars/build-pillars";
import { AUDIENCE_READ_DEPS, readAudiencePage, type AudienceReadDeps, type AudienceTarget } from "../read-audience-page";
import type { AudienceRead } from "../audience-model";
import * as A from "./audiences";

const NOW = new Date("2026-11-25T12:00:00Z");
const CLIENT = { stand: "in" } as unknown as SupabaseClient;
const USER = "u-1";

const connected = (over: Partial<ConnectedAccount> = {}): ConnectedAccount => ({
  id: A.uuid(100),
  user_id: USER,
  platform: "tiktok",
  handle: "nia.tests",
  display_name: null,
  avatar_url: null,
  is_primary: true,
  connection_method: "scrape",
  last_synced_at: null,
  ...over,
});

const MINE = A.own({ created_at: "2026-10-01T00:00:00Z" });
const LEO = A.other({ created_at: "2026-11-02T00:00:00Z" });
const PARENTS = A.described({ created_at: "2026-11-03T00:00:00Z" });
const SECOND = A.own({
  id: A.uuid(4),
  name: "@nia.second",
  source_account_id: A.uuid(101),
  calibration: { source: "scrape", handle: "nia.second" },
  created_at: "2026-11-04T00:00:00Z",
});
const OWN_GENERAL_MODE = A.audience({ id: A.uuid(5), name: "Hiring panel", mode: "general" });
const VIRTUAL = [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...GENERAL_TEMPLATES];
const LIST: Audience[] = [...VIRTUAL, MINE, LEO, PARENTS, SECOND, OWN_GENERAL_MODE];
const NIA = connected();
const NIA_SECOND = connected({ id: A.uuid(101), handle: "nia.second", is_primary: false });
const NO_AUDIENCE = connected({ id: A.uuid(102), handle: "nia.photos", platform: "instagram", is_primary: false });
const ACCOUNTS = [NIA, NIA_SECOND, NO_AUDIENCE];

function depsOf(over: Partial<AudienceReadDeps> = {}) {
  return {
    listAudiences: vi.fn<AudienceReadDeps["listAudiences"]>(async () => LIST),
    listConnectedAccounts: vi.fn<AudienceReadDeps["listConnectedAccounts"]>(async () => ACCOUNTS),
    resolveUserAudience: vi.fn<AudienceReadDeps["resolveUserAudience"]>(async () => GENERAL_AUDIENCE),
    getAccountSnapshots: vi.fn<AudienceReadDeps["getAccountSnapshots"]>(async () => [A.snapshot()]),
    listAllPosts: vi.fn<AudienceReadDeps["listAllPosts"]>(async () => A.posts([12_000, 12_800, 13_000])),
    buildContentPillars: vi.fn<AudienceReadDeps["buildContentPillars"]>(async () => [{ name: "Future tech", count: 6 }]),
    ...over,
  } satisfies AudienceReadDeps;
}
type Deps = ReturnType<typeof depsOf>;

const read = (target: AudienceTarget, deps: AudienceReadDeps) => readAudiencePage(CLIENT, USER, target, NOW, deps);
const index = (over: Omit<Extract<AudienceTarget, { route: "index" }>, "route"> = {}): AudienceTarget => ({ route: "index", ...over });
const byId = (id: string): AudienceTarget => ({ route: "id", id });

const pageOf = (r: AudienceRead) => {
  if (r.kind !== "audience") throw new Error(`read is ${r.kind}`);
  return r;
};
const noCalls = (deps: Deps) => {
  for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled();
};

describe("the address alone", () => {
  it.each(["general", "preset-growth", "preset-conversion", "template-analyst", "template-hiring"])(
    "%s: General and the presets have no page (spec 3.1): none, pushed, nothing read",
    async (id) => {
      const deps = depsOf();
      expect(await read(byId(id), deps)).toEqual({ kind: "none", pushed: true });
      noCalls(deps);
    },
  );

  it.each(["abc", "123", "00000000-0000-4000-8000-00000000000Z", "'; drop table audiences;--"])(
    "%j is no audience's id: back to /audience, nothing read",
    async (id) => {
      const deps = depsOf();
      expect(await read(byId(id), deps)).toEqual({ kind: "redirect", to: "/audience" });
      noCalls(deps);
    },
  );
});

describe("the reads that fail", () => {
  it("the audiences cannot be listed: failed, pushed as the address is", async () => {
    const boom = async () => {
      throw new Error("audiences list failed");
    };
    expect(await read(index(), depsOf({ listAudiences: vi.fn(boom) }))).toEqual({ kind: "failed", pushed: false });
    expect(await read(byId(MINE.id), depsOf({ listAudiences: vi.fn(boom) }))).toEqual({ kind: "failed", pushed: true });
  });

  it("a stand-in that throws at once is read as a failure too", async () => {
    const deps = depsOf({
      listAudiences: vi.fn(() => {
        throw new Error("sync");
      }),
    });
    expect(await read(index(), deps)).toEqual({ kind: "failed", pushed: false });
  });

  it("the accounts cannot be listed: read as no accounts (as the old page)", async () => {
    const deps = depsOf({
      listConnectedAccounts: vi.fn(async () => {
        throw new Error("down");
      }),
      resolveUserAudience: vi.fn(async () => MINE),
    });
    const r = pageOf(await read(index(), deps));
    expect(r.page.id).toBe(MINE.id);
    expect(r.page.removal).toEqual({ kind: "delete" });
    expect(deps.getAccountSnapshots).not.toHaveBeenCalled();
  });

  it("the default cannot be read: no default", async () => {
    const deps = depsOf({
      resolveUserAudience: vi.fn(async () => {
        throw new Error("down");
      }),
    });
    const r = pageOf(await read(byId(MINE.id), deps));
    expect(r.page.isDefault).toBe(false);
    expect(r.choices.every((c) => !c.selected)).toBe(true);
  });

  it("a failing snapshot, posts or topics read still gives the page, without what failed", async () => {
    const down = async () => {
      throw new Error("down");
    };
    const r = pageOf(
      await read(
        byId(MINE.id),
        depsOf({ getAccountSnapshots: vi.fn(down), listAllPosts: vi.fn(down), buildContentPillars: vi.fn(down) }),
      ),
    );
    expect(r.page.figures).toEqual([]);
    expect(r.page.videos).toBeNull();
    expect(r.page.groups).toHaveLength(10);
  });
});

describe("the old address /audience?tab=account (the /analytics and /grow redirects)", () => {
  it("the account it names → its audience's page", async () => {
    const deps = depsOf();
    expect(await read(index({ tab: "account", account: NIA_SECOND.id }), deps)).toEqual({ kind: "redirect", to: `/audience/${SECOND.id}` });
    expect(deps.resolveUserAudience).not.toHaveBeenCalled();
    expect(deps.getAccountSnapshots).not.toHaveBeenCalled();
  });

  it("else the primary, else the first", async () => {
    expect(await read(index({ tab: "account" }), depsOf())).toEqual({ kind: "redirect", to: `/audience/${MINE.id}` });
    expect(await read(index({ tab: "account", account: "not-an-account" }), depsOf())).toEqual({
      kind: "redirect",
      to: `/audience/${MINE.id}`,
    });
    const noPrimary = depsOf({ listConnectedAccounts: vi.fn(async () => [{ ...NIA_SECOND }, { ...NIA, is_primary: false }]) });
    expect(await read(index({ tab: "account" }), noPrimary)).toEqual({ kind: "redirect", to: `/audience/${SECOND.id}` });
  });

  it("an account with no audience, or no account: /audience", async () => {
    expect(await read(index({ tab: "account", account: NO_AUDIENCE.id }), depsOf())).toEqual({ kind: "redirect", to: "/audience" });
    expect(await read(index({ tab: "account" }), depsOf({ listConnectedAccounts: vi.fn(async () => []) }))).toEqual({
      kind: "redirect",
      to: "/audience",
    });
  });

  it("another tab is ignored", async () => {
    expect((await read(index({ tab: "other" }), depsOf())).kind).toBe("audience");
  });
});

describe("/audience/[id]", () => {
  it("an audience in the list: its page, pushed, found without a second round trip", async () => {
    const deps = depsOf();
    const r = pageOf(await read(byId(LEO.id), deps));
    expect(r.pushed).toBe(true);
    expect(r.page.id).toBe(LEO.id);
    expect(r.page.kind).toBe("other");
    expect(deps.listAudiences).toHaveBeenCalledTimes(1);
    expect(deps.listAudiences).toHaveBeenCalledWith(CLIENT);
  });

  it("a connected account's id → its audience's page; one with no audience → /audience", async () => {
    expect(await read(byId(NIA_SECOND.id), depsOf())).toEqual({ kind: "redirect", to: `/audience/${SECOND.id}` });
    expect(await read(byId(NO_AUDIENCE.id), depsOf())).toEqual({ kind: "redirect", to: "/audience" });
  });

  it("an id that is neither: /audience", async () => {
    expect(await read(byId(A.uuid(999)), depsOf())).toEqual({ kind: "redirect", to: "/audience" });
  });

  it("an audience that is not one of the creator's own (general mode): none, pushed", async () => {
    expect(await read(byId(OWN_GENERAL_MODE.id), depsOf())).toEqual({ kind: "none", pushed: true });
  });

  it("an address with the id in capitals finds the audience stored in lower case (as the old page's uuid match did)", async () => {
    const stored = A.own({ id: "abcdef00-0000-4000-8000-000000000001" });
    const r = await read(byId(stored.id.toUpperCase()), depsOf({ listAudiences: vi.fn(async () => [...VIRTUAL, stored]) }));
    expect(pageOf(r).page.id).toBe(stored.id);
  });

  it("an account's id in capitals still leads to its audience", async () => {
    const account = connected({ id: "abcdef00-0000-4000-8000-0000000001aa", handle: "nia.third", is_primary: false });
    const third = A.own({ id: A.uuid(6), source_account_id: account.id, calibration: { source: "scrape", handle: "nia.third" } });
    const deps = depsOf({ listAudiences: vi.fn(async () => [...LIST, third]), listConnectedAccounts: vi.fn(async () => [...ACCOUNTS, account]) });
    expect(await read(byId(account.id.toUpperCase()), deps)).toEqual({ kind: "redirect", to: `/audience/${third.id}` });
  });
});

describe("/audience", () => {
  it("the audience new chats use, not pushed", async () => {
    const r = pageOf(await read(index(), depsOf({ resolveUserAudience: vi.fn(async () => PARENTS) })));
    expect(r.pushed).toBe(false);
    expect(r.page.id).toBe(PARENTS.id);
    expect(r.page.isDefault).toBe(true);
  });

  it("on General: the newest own-account audience with groups", async () => {
    const r = pageOf(await read(index(), depsOf()));
    expect(r.page.id).toBe(SECOND.id);
    expect(r.page.isDefault).toBe(false);
  });

  it("no audience of their own: none, not pushed, and nothing more is read", async () => {
    const deps = depsOf({ listAudiences: vi.fn(async () => [...VIRTUAL, OWN_GENERAL_MODE]) });
    expect(await read(index(), deps)).toEqual({ kind: "none", pushed: false });
    expect(deps.getAccountSnapshots).not.toHaveBeenCalled();
    expect(deps.listAllPosts).not.toHaveBeenCalled();
    expect(deps.buildContentPillars).not.toHaveBeenCalled();
  });
});

describe("what is read for the page", () => {
  it("the account behind it: the newest snapshot (a limit of 1), its posts (the default cap), its topics (the user and the account)", async () => {
    const deps = depsOf({ resolveUserAudience: vi.fn(async () => MINE) });
    const r = pageOf(await read(index(), deps));
    expect(deps.resolveUserAudience).toHaveBeenCalledWith(CLIENT, USER);
    expect(deps.listConnectedAccounts).toHaveBeenCalledWith(CLIENT, USER);
    expect(deps.getAccountSnapshots).toHaveBeenCalledTimes(1);
    expect(deps.getAccountSnapshots).toHaveBeenCalledWith(CLIENT, NIA.id, 1);
    expect(deps.listAllPosts).toHaveBeenCalledTimes(1);
    expect(deps.listAllPosts).toHaveBeenCalledWith(CLIENT, NIA.id);
    expect(deps.buildContentPillars).toHaveBeenCalledTimes(1);
    expect(deps.buildContentPillars).toHaveBeenCalledWith(CLIENT, USER, NIA.id);
    expect(r.page.figures.map((f) => [f.label, f.value])).toEqual([
      ["Followers", "424K"],
      ["Likes", "20.6M"],
      ["Posts", "613"],
      ["Usual views", "12.8K"],
    ]);
    expect(r.page.videos?.rows).toHaveLength(3);
    expect(r.page.videos?.topics).toEqual(["Future tech · 6"]);
    expect(r.page.removal).toEqual({ kind: "disconnect", accountId: NIA.id, handle: "nia.tests" });
    expect(r.page.isDefault).toBe(true);
  });

  it("the account's stored avatar_url is the face's picture, on the page and its switcher row; each post's cover_url its row's cover", async () => {
    const avatar = "https://proj.supabase.co/storage/v1/object/public/avatars/account/tiktok/nia.tests.jpg";
    const cover = "https://proj.supabase.co/storage/v1/object/public/covers/account/tiktok/7300000000000000012.jpg";
    const [p1, p2, p3] = A.posts([12_000, 13_000, 12_800]);
    const deps = depsOf({
      resolveUserAudience: vi.fn(async () => MINE),
      listConnectedAccounts: vi.fn(async () => [{ ...NIA, avatar_url: avatar }, NIA_SECOND, NO_AUDIENCE]),
      listAllPosts: vi.fn(async () => [p1!, { ...p2!, cover_url: cover }, p3!]),
    });
    const r = pageOf(await read(index(), deps));
    expect(r.page.face).toEqual({ initial: "N", picture: avatar, platform: "tiktok" });
    expect(r.choices.find((c) => c.id === MINE.id)!.face.picture).toBe(avatar);
    // The second account stores none: its audience's row keeps the initial.
    expect(r.choices.find((c) => c.id === SECOND.id)!.face.picture).toBeNull();
    // Most viewed first: 13K (the one with the cover), 12.8K, 12K.
    expect(r.page.videos!.rows.map((row) => row.cover)).toEqual([cover, null, null]);
  });

  it("the snapshot read is the newest: the first row given", async () => {
    const deps = depsOf({
      getAccountSnapshots: vi.fn(async () => [A.snapshot({ follower_count: 5_000 }), A.snapshot({ follower_count: 1 })]),
    });
    const r = pageOf(await read(byId(MINE.id), deps));
    expect(r.page.figures[0]).toEqual({ key: "followers", label: "Followers", value: "5K" });
  });

  it("no account behind it: no snapshot, posts or topics are read", async () => {
    const deps = depsOf();
    const r = pageOf(await read(byId(PARENTS.id), deps));
    expect(r.page.kind).toBe("described");
    expect(deps.getAccountSnapshots).not.toHaveBeenCalled();
    expect(deps.listAllPosts).not.toHaveBeenCalled();
    expect(deps.buildContentPillars).not.toHaveBeenCalled();
    expect(r.page.figures).toEqual([]);
    expect(r.page.videos).toBeNull();
  });

  it("the switcher's rows: the creator's own audiences, own-account ones first, the check on the default", async () => {
    const r = pageOf(await read(byId(LEO.id), depsOf({ resolveUserAudience: vi.fn(async () => SECOND) })));
    expect(r.choices.map((c) => [c.id, c.selected])).toEqual([
      [MINE.id, false],
      [SECOND.id, true],
      [LEO.id, false],
      [PARENTS.id, false],
    ]);
  });

  it("what it hands the client survives JSON as it is", async () => {
    const r = await read(byId(MINE.id), depsOf({ resolveUserAudience: vi.fn(async () => MINE) }));
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});

describe("a redirect only ever names an id from the list or the accounts", () => {
  it("over every address form the tests use", async () => {
    const known = new Set([...LIST.map((a) => a.id), ...ACCOUNTS.map((a) => a.id)]);
    const targets: AudienceTarget[] = [
      index({ tab: "account" }),
      index({ tab: "account", account: NIA.id }),
      index({ tab: "account", account: NIA_SECOND.id }),
      index({ tab: "account", account: NO_AUDIENCE.id }),
      index({ tab: "account", account: "../../api/tools" }),
      byId(NIA.id),
      byId(NIA_SECOND.id),
      byId(NO_AUDIENCE.id),
      byId(A.uuid(999)),
      byId("not-an-id"),
      byId("../../api/tools"),
    ];
    for (const target of targets) {
      const r = await read(target, depsOf());
      if (r.kind !== "redirect") continue;
      if (r.to === "/audience") continue;
      const id = /^\/audience\/([^/?#]+)$/.exec(r.to)?.[1];
      expect(id, r.to).toBeDefined();
      expect(known.has(id!), r.to).toBe(true);
    }
  });
});

describe("AUDIENCE_READ_DEPS", () => {
  it("are the repository's own functions", () => {
    expect(AUDIENCE_READ_DEPS).toEqual({
      listAudiences,
      listConnectedAccounts,
      resolveUserAudience,
      getAccountSnapshots,
      listAllPosts,
      buildContentPillars,
    });
  });
});

describe("what the model cannot read", () => {
  /** A stored read whose groups are not a list: the model cannot walk it. */
  const broken = (over: Partial<Audience> = {}): Audience => {
    const signature = A.signature();
    return A.own({ ...over, signature: { ...signature, audience: { ...signature.audience, personas: { length: 1 } as unknown as never } } });
  };

  it("/audience/[id]: the screen's own failure, pushed, not the route's error page", async () => {
    const bad = broken();
    expect(await read(byId(bad.id), depsOf({ listAudiences: vi.fn(async () => [...VIRTUAL, bad]) }))).toEqual({ kind: "failed", pushed: true });
  });

  it("/audience: the same, not pushed", async () => {
    const bad = broken();
    expect(await read(index(), depsOf({ listAudiences: vi.fn(async () => [...VIRTUAL, bad]) }))).toEqual({ kind: "failed", pushed: false });
  });
});

describe("only the creator's own rows (a second lock beside row level security)", () => {
  const FOREIGN = A.own({ id: A.uuid(900), user_id: "u-2", created_at: "2026-11-20T00:00:00Z" });

  it("another creator's row, were it listed: its address goes back to /audience", async () => {
    expect(await read(byId(FOREIGN.id), depsOf({ listAudiences: vi.fn(async () => [...LIST, FOREIGN]) }))).toEqual({ kind: "redirect", to: "/audience" });
  });

  it("/audience never picks it, and the switcher never lists it", async () => {
    const r = pageOf(await read(index(), depsOf({ listAudiences: vi.fn(async () => [...LIST, FOREIGN]) })));
    expect(r.page.id).not.toBe(FOREIGN.id);
    expect(r.choices.map((c) => c.id)).not.toContain(FOREIGN.id);
  });
});
