/**
 * GET /api/profile — the picture and name fallbacks, and the creator's own account.
 *
 * Supabase is I/O this suite cannot run: the session client is stood in at `createClient`, answering
 * each table from fixed rows. The route and `listConnectedAccounts` run for real against it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Rows = Record<string, Record<string, unknown>[]>;
let tables: Rows = {};
const user = { id: "u-1", email: "nia@example.com", user_metadata: {} as Record<string, unknown> };

function builder(table: string) {
  let rows = [...(tables[table] ?? [])];
  // Compound order, as Postgres applies it: the first .order() is the first key.
  const keys: Array<{ col: string; ascending: boolean }> = [];
  const sorted = () =>
    [...rows].sort((x, y) => {
      for (const { col, ascending } of keys) {
        const a = x[col] as never;
        const c = y[col] as never;
        if (a !== c) return (a < c ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    });
  const b = {
    select: () => b,
    eq: (col: string, value: unknown) => ((rows = rows.filter((r) => r[col] === value)), b),
    order: (col: string, opts: { ascending: boolean }) => (keys.push({ col, ascending: opts.ascending }), b),
    maybeSingle: async () => ({ data: sorted()[0] ?? null, error: null }),
    then: (resolve: (v: { data: unknown; error: null }) => unknown) => resolve({ data: sorted(), error: null }),
  };
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table: string) => builder(table),
  }),
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/scraping", () => ({ createScrapingProvider: () => ({}) }));

const AVATAR = "https://proj.supabase.co/storage/v1/object/public/avatars/account/tiktok/nia.tests.jpg";
const account = (over: Record<string, unknown> = {}) => ({
  id: "a-1",
  user_id: "u-1",
  platform: "tiktok",
  handle: "nia.tests",
  display_name: "Nia Tests",
  avatar_url: AVATAR,
  is_primary: true,
  connection_method: "scrape",
  last_synced_at: null,
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

async function get() {
  const { GET } = await import("../route");
  const res = await GET();
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
  tables = {};
  user.user_metadata = {};
});

describe("GET /api/profile", () => {
  it("no account, no photo: avatar null, account null", async () => {
    const body = await get();
    expect(body.avatar).toBeNull();
    expect(body.account).toBeNull();
  });

  it("the primary account: its picture is the avatar, its display name the name, and it is returned as account", async () => {
    tables.connected_accounts = [account({ id: "a-2", is_primary: false, handle: "other", avatar_url: null, created_at: "2026-09-01T00:00:00Z" }), account()];
    const body = await get();
    expect(body.avatar).toBe(AVATAR);
    expect(body.name).toBe("Nia Tests");
    expect(body.account).toEqual({ platform: "tiktok", handle: "nia.tests", displayName: "Nia Tests", avatar: AVATAR });
  });

  it("no primary: the oldest account", async () => {
    tables.connected_accounts = [
      account({ id: "a-2", is_primary: false, handle: "newer", created_at: "2026-11-01T00:00:00Z" }),
      account({ id: "a-3", is_primary: false, handle: "older", platform: "instagram", created_at: "2026-09-01T00:00:00Z" }),
    ];
    expect(((await get()).account as { handle: string }).handle).toBe("older");
  });

  it("the uploaded photo wins over the account's picture; the account's over creator_profiles'", async () => {
    tables.connected_accounts = [account()];
    tables.creator_profiles = [{ user_id: "u-1", display_name: null, tiktok_handle: "nia.tests", avatar_url: "https://creator.test/p.jpg" }];
    expect((await get()).avatar).toBe(AVATAR);
    tables.user_settings = [{ user_id: "u-1", avatar_url: "https://uploaded.test/me.jpg" }];
    expect((await get()).avatar).toBe("https://uploaded.test/me.jpg");
  });

  it("no account picture: creator_profiles' avatar, then the auth metadata's", async () => {
    tables.connected_accounts = [account({ avatar_url: null })];
    user.user_metadata = { avatar_url: "https://meta.test/a.jpg" };
    expect((await get()).avatar).toBe("https://meta.test/a.jpg");
    tables.creator_profiles = [{ user_id: "u-1", display_name: null, tiktok_handle: null, avatar_url: "https://creator.test/p.jpg" }];
    expect((await get()).avatar).toBe("https://creator.test/p.jpg");
  });

  it("a name set in settings or creator_profiles still comes before the account's", async () => {
    tables.connected_accounts = [account()];
    tables.creator_profiles = [{ user_id: "u-1", display_name: "Creator Name", tiktok_handle: null, avatar_url: null }];
    expect((await get()).name).toBe("Creator Name");
  });
});
