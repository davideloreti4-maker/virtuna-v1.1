/**
 * GET /api/settings/plan-state (spec 2026-11-26-settings, 3.1). The flag is a build-time constant, so each
 * case loads the route fresh with it set. Stand-ins only at the boundaries: the flag, the two Supabase
 * clients, and `fetch` to Whop; the helper and the route are the real code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000 });

const ID = "mem_test_1";

let user: { id: string } | null = { id: "u-test-1" };
let row: Record<string, unknown> | null = null;
let reads: Array<{ table: string; columns: string; filter: [string, unknown] }> = [];
let updates: Array<{ table: string; values: Record<string, unknown>; filter: [string, unknown] }> = [];
let whop: () => Promise<Response>;

function serviceClient() {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              return {
                maybeSingle: async () => {
                  reads.push({ table, columns, filter: [column, value] });
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq: async (column: string, value: unknown) => {
              updates.push({ table, values, filter: [column, value] });
              return { error: null };
            },
          };
        },
      };
    },
  };
}

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
  vi.doMock("@/lib/supabase/service", () => ({ createServiceClient: () => serviceClient() }));
  return (await import("../route")).GET;
}

async function call(flag = true) {
  const GET = await load(flag);
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

const fetchSpy = vi.fn(async () => whop());

beforeEach(() => {
  user = { id: "u-test-1" };
  row = { whop_membership_id: ID, cancel_at_period_end: false, current_period_end: "2026-12-14T10:00:00+00:00" };
  reads = [];
  updates = [];
  whop = async () =>
    new Response(JSON.stringify({ id: ID, status: "active", cancel_at_period_end: false, renewal_period_end: "2026-12-14T10:00:00.000Z" }), {
      status: 200,
    });
  fetchSpy.mockClear();
  vi.stubEnv("WHOP_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service");
  vi.resetModules();
});

describe("GET /api/settings/plan-state", () => {
  it("flag off: 404, nothing read", async () => {
    const { status } = await call(false);
    expect(status).toBe(404);
    expect(reads).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("signed out: 401, nothing read", async () => {
    user = null;
    const { status } = await call();
    expect(status).toBe(401);
    expect(reads).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads the caller's row only", async () => {
    await call();
    expect(reads).toEqual([
      { table: "user_subscriptions", columns: "whop_membership_id, cancel_at_period_end, current_period_end", filter: ["user_id", "u-test-1"] },
    ]);
  });

  it("no row: { membership: null }, Whop not asked", async () => {
    row = null;
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body).toEqual({ membership: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a row with no membership id: { membership: null }, Whop not asked", async () => {
    row = { whop_membership_id: null, cancel_at_period_end: false, current_period_end: null };
    expect((await call()).body).toEqual({ membership: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Whop has no such membership (404): { membership: null }, no update", async () => {
    whop = async () => new Response("{}", { status: 404 });
    expect((await call()).body).toEqual({ membership: null });
    expect(updates).toHaveLength(0);
  });

  it("Whop fails: { unknown: true }, no update", async () => {
    whop = async () => new Response("{}", { status: 503 });
    expect((await call()).body).toEqual({ unknown: true });
    expect(updates).toHaveLength(0);
  });

  it("Whop unreachable: { unknown: true }, no update", async () => {
    whop = async () => {
      throw new TypeError("fetch failed");
    };
    expect((await call()).body).toEqual({ unknown: true });
    expect(updates).toHaveLength(0);
  });

  it("asks Whop for the row's membership", async () => {
    await call();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe(`https://api.whop.com/api/v1/memberships/${ID}`);
  });

  it("same values as the row (the time written another way): the membership, no update", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body).toEqual({ membership: { status: "active", cancelAtPeriodEnd: false, renewsAt: "2026-12-14T10:00:00.000Z" } });
    expect(updates).toHaveLength(0);
  });

  it("the cancel flag differs: one update of the caller's row with Whop's values", async () => {
    whop = async () =>
      new Response(JSON.stringify({ id: ID, status: "active", cancel_at_period_end: true, renewal_period_end: "2026-12-14T10:00:00.000Z" }), {
        status: 200,
      });
    const { body } = await call();
    expect(body).toEqual({ membership: { status: "active", cancelAtPeriodEnd: true, renewsAt: "2026-12-14T10:00:00.000Z" } });
    expect(updates).toEqual([
      {
        table: "user_subscriptions",
        values: { cancel_at_period_end: true, current_period_end: "2026-12-14T10:00:00.000Z" },
        filter: ["user_id", "u-test-1"],
      },
    ]);
  });

  it("the period end differs: one update with the new end", async () => {
    const seconds = Date.UTC(2027, 0, 14, 10, 0, 0) / 1000;
    whop = async () =>
      new Response(JSON.stringify({ id: ID, status: "active", cancel_at_period_end: false, renewal_period_end: seconds }), { status: 200 });
    await call();
    expect(updates).toEqual([
      {
        table: "user_subscriptions",
        values: { cancel_at_period_end: false, current_period_end: "2027-01-14T10:00:00.000Z" },
        filter: ["user_id", "u-test-1"],
      },
    ]);
  });

  it("the stored flag is null and Whop says false: no update", async () => {
    row = { whop_membership_id: ID, cancel_at_period_end: null, current_period_end: "2026-12-14T10:00:00.000Z" };
    await call();
    expect(updates).toHaveLength(0);
  });

  it("Whop sends no period end: the stored one is kept (not written null)", async () => {
    whop = async () =>
      new Response(JSON.stringify({ id: ID, status: "active", cancel_at_period_end: true, renewal_period_end: null }), { status: 200 });
    await call();
    expect(updates).toEqual([{ table: "user_subscriptions", values: { cancel_at_period_end: true }, filter: ["user_id", "u-test-1"] }]);
  });
});
