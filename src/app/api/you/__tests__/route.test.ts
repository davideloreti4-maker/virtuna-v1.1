/**
 * GET /api/you (plan 2026-11-24-you, Task 2). Real: the route and `readYouPage`. Stood in for: the
 * build-time flag, and the Supabase session client: a small in-memory PostgREST that filters,
 * orders, limits, projects `alias:column->>key` the way the real one does, refuses a column the
 * table does not have (the live tables' columns, rulings 8), and records every call. Ids, handles
 * and texts are made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  interface Query { table: string; columns: string; filters: Array<[string, string, unknown]>; order: Array<[string, boolean]>; limit: number | null }
  /** The live tables' columns (rulings 8; `account_snapshots` and `audiences` as `database.types.ts` has them). */
  const SCHEMA: Record<string, readonly string[]> = {
    connected_accounts: ["id", "user_id", "platform", "handle", "display_name", "is_primary", "connection_method", "created_at", "last_synced_at", "avatar_url"],
    account_snapshots: [
      "id", "account_id", "user_id", "platform", "handle", "follower_count", "following_count", "heart_count", "video_count",
      "recent_views", "snapshot_date", "created_at",
    ],
    audiences: [
      "id", "user_id", "name", "type", "mode", "platform", "is_general", "is_preset", "source_account_id", "calibration",
      "creator_persona", "signature", "profile", "personas", "custom_context", "goal_label", "goal_intent", "success_criterion",
      "fyp", "niche", "loyalist", "cross_niche", "created_at", "updated_at",
    ],
  };
  const state = {
    user: null as null | { id: string; is_anonymous?: boolean },
    authCalls: 0,
    tables: {} as Record<string, Row[]>,
    failOn: null as string | null,
    queries: [] as Query[],
  };
  const columnOf = (path: string) => path.split("->>")[0]!;
  const valueAt = (row: Row, path: string): unknown => {
    const [column, key] = path.split("->>");
    const value = row[column!];
    if (key === undefined) return value ?? null;
    return value && typeof value === "object" ? ((value as Row)[key] ?? null) : null;
  };
  const run = (q: Query) => {
    if (state.failOn === q.table) return { data: null, error: { message: "connection reset by peer" } };
    const items = q.columns.split(",").map((s) => s.trim()).filter(Boolean).map((item) => {
      const m = /^(?:(\w+):)?(\w+)(?:->>(\w+))?$/.exec(item);
      if (!m) throw new Error(`stand-in: cannot read select item "${item}"`);
      return { key: m[1] ?? m[3] ?? m[2]!, path: m[3] ? `${m[2]}->>${m[3]}` : m[2]! };
    });
    const used = [...items.map((i) => columnOf(i.path)), ...q.filters.map(([, c]) => columnOf(c)), ...q.order.map(([c]) => c)];
    const unknown = used.find((c) => !(SCHEMA[q.table] ?? []).includes(c));
    if (unknown) return { data: null, error: { message: `column ${q.table}.${unknown} does not exist` } };
    let rows = (state.tables[q.table] ?? []).filter((row) =>
      q.filters.every(([op, path, value]) => {
        const v = valueAt(row, path);
        if (op === "eq") return v !== null && v === value;
        if (op === "not.is") return value === null ? v !== null : v !== value;
        throw new Error(`stand-in: no filter ${op}`);
      }),
    );
    rows = [...rows].sort((a, b) => {
      for (const [column, ascending] of q.order) {
        const av = a[column] as string | boolean;
        const bv = b[column] as string | boolean;
        if (av === bv) continue;
        return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
      }
      return 0;
    });
    if (q.limit !== null) rows = rows.slice(0, q.limit);
    return { data: rows.map((row) => Object.fromEntries(items.map((i) => [i.key, structuredClone(valueAt(row, i.path))]))), error: null };
  };
  const from = (table: string) => {
    const q: Query = { table, columns: "", filters: [], order: [], limit: null };
    state.queries.push(q);
    const builder = {
      select(columns: string) { q.columns = columns; return builder; },
      eq(column: string, value: unknown) { q.filters.push(["eq", column, value]); return builder; },
      not(column: string, op: string, value: unknown) { q.filters.push([`not.${op}`, column, value]); return builder; },
      order(column: string, opts?: { ascending?: boolean }) { q.order.push([column, opts?.ascending ?? true]); return builder; },
      limit(n: number) { q.limit = n; return builder; },
      then<A, B>(onFulfilled?: (v: ReturnType<typeof run>) => A, onRejected?: (e: unknown) => B) {
        return new Promise<ReturnType<typeof run>>((resolve) => resolve(run(q))).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };
  return { state, from };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        fake.state.authCalls += 1;
        return { data: { user: fake.state.user }, error: null };
      },
    },
    from: (table: string) => fake.from(table),
  }),
}));

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../route")).GET;
}

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const CAPTION = "Btw this verbatim caption must never leave the database";
const SYNCED = "2026-11-20T10:00:00.000Z";

const account = (n: number, over: Record<string, unknown> = {}) => ({
  id: id(n), user_id: ME, platform: "tiktok", handle: `nia.tests${n}`, display_name: null, is_primary: false,
  connection_method: "scrape", created_at: `2026-11-0${n}T10:00:00.000Z`, last_synced_at: SYNCED, avatar_url: null, ...over,
});
const audience = (n: number, over: Record<string, unknown> = {}) => ({
  id: id(100 + n), user_id: ME, type: "personal", is_general: false, source_account_id: null, name: `A${n}`,
  calibration: { source: "scrape", handle: "nia.tests", scraped_at: "2026-11-21T09:00:00.000Z", thin: false },
  creator_persona: { content_description: `Makes thing ${n}.`, context: `Sounds like ${n}.`, writing_style_sample: CAPTION, format_signature: "talking head" },
  created_at: "2026-11-01T00:00:00.000Z", updated_at: `2026-11-1${n}T00:00:00.000Z`, ...over,
});
const snapshot = (n: number, accountId: string, followers: number, date: string, user = ME) => ({
  id: id(50 + n), account_id: accountId, user_id: user, platform: "tiktok", handle: "nia.tests", follower_count: followers,
  following_count: null, heart_count: 0, video_count: 0, recent_views: null, snapshot_date: date, created_at: `${date}T06:00:00.000Z`,
});

beforeEach(() => {
  fake.state.user = { id: ME };
  fake.state.authCalls = 0;
  fake.state.tables = { connected_accounts: [], account_snapshots: [], audiences: [] };
  fake.state.failOn = null;
  fake.state.queries = [];
});
afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.restoreAllMocks();
});

describe("GET /api/you", () => {
  it("does not exist with the flag off, and reads nothing, not even the session", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    const GET = await load(false);
    expect((await GET()).status).toBe(404);
    expect(fake.state.queries).toHaveLength(0);
    expect(fake.state.authCalls).toBe(0);
  });

  it("is 401 signed out, and reads nothing", async () => {
    fake.state.user = null;
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    expect((await (await load(true))()).status).toBe(401);
    expect(fake.state.queries).toHaveLength(0);
  });

  it("lists the caller's accounts, primary first then oldest, and no one else's; no sync time (rulings 4)", async () => {
    fake.state.tables.connected_accounts = [
      account(3, { platform: "instagram" }),
      account(1),
      account(2, { is_primary: true, last_synced_at: null }),
      account(4, { user_id: OTHER, is_primary: true }),
    ];
    const res = await (await load(true))();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text).accounts).toEqual([
      { id: id(2), platform: "tiktok", handle: "nia.tests2", primary: true },
      { id: id(1), platform: "tiktok", handle: "nia.tests1", primary: false },
      { id: id(3), platform: "instagram", handle: "nia.tests3", primary: false },
    ]);
    expect(text).not.toContain(SYNCED);
    expect(text).not.toContain("nia.tests4");
  });

  it("every query is scoped to the caller", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    await (await load(true))();
    // The accounts, the snapshot, the linked read and the fallback read.
    expect(fake.state.queries.map((q) => q.table)).toEqual(["connected_accounts", "account_snapshots", "audiences", "audiences"]);
    for (const q of fake.state.queries) expect(q.filters).toContainEqual(["eq", "user_id", ME]);
  });

  it("followers: the newest snapshot of the primary account; none without one", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true }), account(2)];
    fake.state.tables.account_snapshots = [
      snapshot(0, id(1), 12000, "2026-11-19"),
      snapshot(1, id(1), 12400, "2026-11-21"),
      snapshot(2, id(2), 99999, "2026-11-22"),
    ];
    expect((await (await (await load(true))()).json()).followers).toBe(12400);
    fake.state.tables.account_snapshots = [];
    expect((await (await (await load(true))()).json()).followers).toBeNull();
  });

  it("followers are never another creator's: not their primary's, not a row of theirs under the caller's account", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true }), account(9, { user_id: OTHER, is_primary: true })];
    fake.state.tables.account_snapshots = [
      snapshot(0, id(1), 12400, "2026-11-21"),
      snapshot(1, id(1), 77777, "2026-11-23", OTHER),
      snapshot(2, id(9), 88888, "2026-11-23", OTHER),
    ];
    const text = await (await (await load(true))()).text();
    expect(JSON.parse(text).followers).toBe(12400);
    expect(text).not.toMatch(/77777|88888/);
  });

  it("with no account: no followers, no snapshot read", async () => {
    const body = await (await (await load(true))()).json();
    expect(body).toMatchObject({ accounts: [], followers: null });
    expect(fake.state.queries.some((q) => q.table === "account_snapshots")).toBe(false);
  });

  it("a connected account Maven has not read yet is told apart from no account (rulings 5)", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    fake.state.tables.account_snapshots = [snapshot(0, id(1), 12400, "2026-11-21")];
    // A General audience and a target one without a persona: neither is a read.
    fake.state.tables.audiences = [
      audience(1, { source_account_id: id(1), creator_persona: null }),
      audience(2, { is_general: true, type: "target", calibration: null }),
    ];
    const connected = await (await (await load(true))()).json();
    expect(connected).toEqual({
      accounts: [{ id: id(1), platform: "tiktok", handle: "nia.tests1", primary: true }],
      followers: 12400,
      read: null,
    });

    fake.state.tables.connected_accounts = [];
    fake.state.tables.account_snapshots = [];
    expect(await (await (await load(true))()).json()).toEqual({ accounts: [], followers: null, read: null });
  });

  it("what Maven read: the newest audience linked to the primary account that has a persona", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    fake.state.tables.audiences = [
      audience(1, { source_account_id: id(1), type: "target" }),
      audience(2, { source_account_id: id(1), type: "target" }),
      audience(3, { source_account_id: id(1), creator_persona: null }),
      audience(4),
      // Newer, linked to the caller's account id, but a General one, and another creator's row.
      audience(5, { source_account_id: id(1), is_general: true, type: "target" }),
      audience(6, { source_account_id: id(1), user_id: OTHER }),
    ];
    const body = await (await (await load(true))()).json();
    expect(body.read).toEqual({ contentDescription: "Makes thing 2.", context: "Sounds like 2.", handle: "nia.tests", readAt: "2026-11-21T09:00:00.000Z" });
  });

  it("without a linked one: the newest calibrated personal audience; never a General one, never another creator's", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    fake.state.tables.audiences = [
      audience(1),
      audience(2, { calibration: null }),
      audience(3, { is_general: true }),
      audience(4, { user_id: OTHER }),
      audience(5, { type: "target" }),
    ];
    const text = await (await (await load(true))()).text();
    expect(JSON.parse(text).read.contentDescription).toBe("Makes thing 1.");
    for (const n of [2, 3, 4, 5]) expect(text).not.toContain(`thing ${n}`);
  });

  it("a read without a handle of its own names the primary account; without a scrape time, the row's", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    fake.state.tables.audiences = [audience(1, { source_account_id: id(1), calibration: null })];
    const body = await (await (await load(true))()).json();
    expect(body.read).toMatchObject({ handle: "nia.tests1", readAt: "2026-11-11T00:00:00.000Z" });
  });

  it("a persona with nothing to say is no read", async () => {
    fake.state.tables.audiences = [audience(1, { creator_persona: { content_description: " ", context: "", writing_style_sample: CAPTION } })];
    expect((await (await (await load(true))()).json()).read).toBeNull();
  });

  it("never selects or returns the verbatim caption", async () => {
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    fake.state.tables.audiences = [audience(1, { source_account_id: id(1) }), audience(2)];
    const text = await (await (await load(true))()).text();
    expect(text).not.toContain(CAPTION);
    expect(fake.state.queries.some((q) => q.table === "audiences")).toBe(true);
    for (const q of fake.state.queries) {
      expect(q.columns).not.toMatch(/writing_style_sample/);
      // Only paths into the persona, never the whole object.
      expect(q.columns.split(",").map((s) => s.trim())).not.toContain("creator_persona");
    }
  });

  it("a funnel visitor (anonymous) is answered from their own rows, as the profile routes do", async () => {
    fake.state.user = { id: ME, is_anonymous: true };
    const res = await (await load(true))();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accounts: [], followers: null, read: null });
  });

  it.each(["connected_accounts", "account_snapshots", "audiences"])("a database error on %s is a 500, logged with a prefix", async (table) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fake.state.tables.connected_accounts = [account(1, { is_primary: true })];
    fake.state.failOn = table;
    const res = await (await load(true))();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "Server error" });
    expect(text).not.toContain("connection reset");
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[you\]/), expect.stringContaining("connection reset by peer"));
  });
});
