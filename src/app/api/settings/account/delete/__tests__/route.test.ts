/**
 * POST /api/settings/account/delete (spec 2026-11-26-settings, 3.2). The flag is a build-time constant, so
 * each case loads the route fresh with it set. Stand-ins only at the boundaries: the flag, the two Supabase
 * clients and `fetch` to Whop. `deleteAccount`, the Whop helper and the route are the real code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000 });

const ID = "mem-test-1";

type Err = { message: string } | null;

let user: { id: string; is_anonymous?: boolean } | null;
let subRow: Record<string, unknown> | null;
let subError: Err;
let ledgerCount: number;
let objects: Record<string, Array<{ name: string; id: string | null }>>;
let removeError: Err;
let deleteError: Err;
let calls: string[];
let whop: () => Promise<Response>;

function serviceClient() {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              if (table === "user_subscriptions") {
                return {
                  maybeSingle: async () => {
                    calls.push(`read ${table}`);
                    return { data: subError ? null : subRow, error: subError };
                  },
                };
              }
              if (table === "wallet_transactions") {
                calls.push(`count ${table}`);
                return Promise.resolve({ data: null, count: ledgerCount, error: null });
              }
              calls.push(`ids ${table}`);
              return Promise.resolve({ data: table === "remix_blueprints" ? [{ id: "bp-1" }] : [], error: null });
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          list: async (prefix: string, opts: { limit: number; offset: number }) => {
            calls.push(`list ${bucket}`);
            return { data: (objects[`${bucket}:${prefix}`] ?? []).slice(opts.offset, opts.offset + opts.limit), error: null };
          },
          remove: async (paths: string[]) => {
            calls.push(`remove ${bucket} ${paths.length}`);
            return removeError ? { data: null, error: removeError } : { data: [], error: null };
          },
        };
      },
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          calls.push(`deleteUser ${id}`);
          return { data: null, error: deleteError };
        },
      },
    },
  };
}

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  vi.doMock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
  vi.doMock("@/lib/supabase/service", () => ({ createServiceClient: () => serviceClient() }));
  return (await import("../route")).POST;
}

const NO_BODY = Symbol("no body");

async function call(body: unknown = { confirm: "DELETE" }, flag = true) {
  const POST = await load(flag);
  const init: RequestInit = { method: "POST", headers: { "content-type": "application/json" } };
  if (body !== NO_BODY) init.body = typeof body === "string" ? body : JSON.stringify(body);
  const res = await POST(new Request("http://localhost/api/settings/account/delete", init));
  return { status: res.status, body: await res.json() };
}

const membership = (m: Record<string, unknown>) => async () =>
  new Response(JSON.stringify({ id: ID, status: "active", cancel_at_period_end: false, renewal_period_end: "2026-12-14T10:00:00.000Z", ...m }), {
    status: 200,
  });

const fetchSpy = vi.fn(async () => whop());

beforeEach(() => {
  user = { id: "u-test-1", is_anonymous: false };
  subRow = { whop_membership_id: ID };
  subError = null;
  ledgerCount = 0;
  objects = { "avatars:u-test-1": [{ name: "avatar.png", id: "obj-1" }], "clips:bp-1": [{ name: "0.mp4", id: "obj-2" }] };
  removeError = null;
  deleteError = null;
  calls = [];
  whop = membership({ status: "canceled" });
  fetchSpy.mockClear();
  vi.stubEnv("WHOP_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/flags/new-look");
  vi.doUnmock("@/lib/supabase/server");
  vi.doUnmock("@/lib/supabase/service");
  vi.resetModules();
});

const nothingTouched = () => expect(calls.filter((c) => /^(list|remove|deleteUser)/.test(c))).toEqual([]);

describe("POST /api/settings/account/delete", () => {
  it("flag off: 404, nothing read", async () => {
    const { status } = await call(undefined, false);
    expect(status).toBe(404);
    expect(calls).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("signed out: 401, nothing read", async () => {
    user = null;
    expect((await call()).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("an anonymous visitor: 403 visitor, nothing read", async () => {
    user = { id: "u-test-anon", is_anonymous: true };
    const { status, body } = await call();
    expect(status).toBe(403);
    expect(body).toEqual({ error: "visitor" });
    expect(calls).toEqual([]);
  });

  it.each([
    ["no body", NO_BODY],
    ["not JSON", "not json"],
    ["an empty object", {}],
    ["lower case", { confirm: "delete" }],
    ["with spaces", { confirm: " DELETE " }],
  ])("%s: 400 confirm, nothing read", async (_name, body) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "confirm" });
    expect(calls).toEqual([]);
  });

  it("a cancelled plan: 200 { deleted: true }; the files go, then the user", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body).toEqual({ deleted: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0] as unknown[])[0]).toBe(`https://api.whop.com/api/v1/memberships/${ID}`);
    expect(calls).toContain("remove avatars 1");
    expect(calls).toContain("remove clips 1");
    expect(calls.at(-1)).toBe("deleteUser u-test-1");
  });

  it("no plan row: 200, Whop not asked", async () => {
    subRow = null;
    expect((await call()).body).toEqual({ deleted: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Whop has no such membership (404): 200", async () => {
    whop = async () => new Response("{}", { status: 404 });
    expect((await call()).status).toBe(200);
  });

  it("a renewing plan: 409 plan_renews with renewsAt, nothing deleted", async () => {
    whop = membership({ status: "active" });
    const { status, body } = await call();
    expect(status).toBe(409);
    expect(body).toEqual({ error: "plan_renews", renewsAt: "2026-12-14T10:00:00.000Z" });
    nothingTouched();
  });

  it("Whop answers 503: 503 whop_unreachable, nothing deleted", async () => {
    whop = async () => new Response("{}", { status: 503 });
    const { status, body } = await call();
    expect(status).toBe(503);
    expect(body).toEqual({ error: "whop_unreachable" });
    nothingTouched();
  });

  it("Whop cannot be reached: 503 whop_unreachable", async () => {
    whop = async () => {
      throw new TypeError("fetch failed");
    };
    expect((await call()).body).toEqual({ error: "whop_unreachable" });
    nothingTouched();
  });

  it("a ledger row: 409 ledger, nothing deleted", async () => {
    ledgerCount = 1;
    const { status, body } = await call();
    expect(status).toBe(409);
    expect(body).toEqual({ error: "ledger" });
    nothingTouched();
  });

  it("a removal fails: 500 files_failed, the user is not deleted", async () => {
    removeError = { message: "storage down" };
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "files_failed" });
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("the user delete fails: 500 delete_failed", async () => {
    deleteError = { message: "database error" };
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "delete_failed" });
  });

  it("the plan row read fails: 500 delete_failed, Whop not asked", async () => {
    subError = { message: "connection failure" };
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body).toEqual({ error: "delete_failed" });
    expect(fetchSpy).not.toHaveBeenCalled();
    nothingTouched();
  });

  it("the log lines never carry the user id", async () => {
    const lines = vi.spyOn(console, "log").mockImplementation(() => {});
    await call();
    expect(lines).toHaveBeenCalled();
    const text = lines.mock.calls.map((c) => String(c[0])).join("\n");
    expect(text).toContain("delete: account deleted");
    expect(text).not.toContain("u-test-1");
    expect(text).not.toContain(ID);
  });
});
