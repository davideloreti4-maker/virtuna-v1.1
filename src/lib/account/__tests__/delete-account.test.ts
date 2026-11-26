/**
 * deleteAccount (spec 2026-11-26-settings, 3.2). The real steps run against a stand-in service client that
 * answers configured rows, pages and errors and records every call, so order and refusals are asserted from
 * what was asked of Supabase.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAccount, type DeleteDeps } from "../delete-account";
import type { LiveMembership } from "@/lib/whop/membership";

const USER = "u-test-1";

type Entry = { name: string; id: string | null };
type Err = { message: string } | null;

interface World {
  subRow: Record<string, unknown> | null;
  subError: Err;
  ledgerCount: number | null;
  ledgerError: Err;
  ids: Record<string, string[]>;
  idsError: Record<string, Err>;
  /** `${bucket}:${prefix}` → every entry under it (the stand-in pages it). */
  objects: Record<string, Entry[]>;
  listError: Set<string>;
  /** bucket → the 1-based remove call that fails. */
  removeFailsAt: Record<string, number>;
  deleteError: Err;
}

let world: World;
let calls: string[];
let removed: Record<string, string[]>;

function files(prefix: string, n: number, start = 0): Entry[] {
  return Array.from({ length: n }, (_, i) => ({ name: `f${start + i}.bin`, id: `obj-${prefix}-${start + i}` }));
}

function standInService() {
  const removeCalls: Record<string, number> = {};
  return {
    from(table: string) {
      return {
        select(columns: string, opts?: { count?: string; head?: boolean }) {
          return {
            eq(column: string, value: unknown) {
              if (table === "user_subscriptions") {
                return {
                  maybeSingle: async () => {
                    calls.push(`read ${table} ${columns} ${column}=${String(value)}`);
                    return { data: world.subError ? null : world.subRow, error: world.subError };
                  },
                };
              }
              if (table === "wallet_transactions") {
                calls.push(`count ${table} ${opts?.count}/${String(opts?.head)} ${column}=${String(value)}`);
                return Promise.resolve({ data: null, count: world.ledgerError ? null : world.ledgerCount, error: world.ledgerError });
              }
              calls.push(`ids ${table} ${columns} ${column}=${String(value)}`);
              const error = world.idsError[table] ?? null;
              return Promise.resolve({ data: error ? null : (world.ids[table] ?? []).map((id) => ({ id })), error });
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          list: async (prefix: string, opts: { limit: number; offset: number }) => {
            calls.push(`list ${bucket} ${prefix} ${opts.offset}`);
            const key = `${bucket}:${prefix}`;
            if (world.listError.has(key)) return { data: null, error: { message: "list failed" } };
            const all = world.objects[key] ?? [];
            return { data: all.slice(opts.offset, opts.offset + opts.limit), error: null };
          },
          remove: async (paths: string[]) => {
            removeCalls[bucket] = (removeCalls[bucket] ?? 0) + 1;
            calls.push(`remove ${bucket} ${paths.length}`);
            if (world.removeFailsAt[bucket] === removeCalls[bucket]) return { data: null, error: { message: "remove failed" } };
            (removed[bucket] ??= []).push(...paths);
            return { data: paths.map((name) => ({ name })), error: null };
          },
        };
      },
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          calls.push(`deleteUser ${id}`);
          return { data: world.deleteError ? null : { user: null }, error: world.deleteError };
        },
      },
    },
  };
}

let membership: () => Promise<LiveMembership | null>;
let asked: string[];
let logs: Array<{ event: string; fields: Record<string, number | string | boolean> }>;

function deps(): DeleteDeps {
  return {
    service: standInService() as unknown as SupabaseClient,
    fetchMembership: async (id) => {
      asked.push(id);
      return membership();
    },
    log: (event, fields) => logs.push({ event, fields }),
  };
}

const live = (m: Partial<LiveMembership>): LiveMembership => ({ status: "active", cancelAtPeriodEnd: false, renewsAt: "2026-12-14T10:00:00.000Z", ...m });

const touched = () => calls.filter((c) => /^(list|remove|ids|deleteUser)/.test(c));

beforeEach(() => {
  world = {
    subRow: { whop_membership_id: "mem-test-1" },
    subError: null,
    ledgerCount: 0,
    ledgerError: null,
    ids: {},
    idsError: {},
    objects: {},
    listError: new Set(),
    removeFailsAt: {},
    deleteError: null,
  };
  calls = [];
  removed = {};
  asked = [];
  logs = [];
  membership = async () => live({ status: "canceled" });
});

describe("deleteAccount: the plan", () => {
  it("a renewing membership: plan_renews with its renewsAt; nothing listed, removed or deleted", async () => {
    membership = async () => live({ status: "active" });
    const outcome = await deleteAccount(USER, deps());
    expect(outcome).toEqual({ ok: false, reason: "plan_renews", renewsAt: "2026-12-14T10:00:00.000Z" });
    expect(asked).toEqual(["mem-test-1"]);
    expect(calls).toEqual([`read user_subscriptions whop_membership_id user_id=${USER}`]);
  });

  it("a trialing membership renews too", async () => {
    membership = async () => live({ status: "trialing", renewsAt: null });
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "plan_renews", renewsAt: null });
    expect(touched()).toEqual([]);
  });

  it("past_due and not cancelled: plan_renews", async () => {
    membership = async () => live({ status: "past_due" });
    expect(await deleteAccount(USER, deps())).toMatchObject({ ok: false, reason: "plan_renews" });
    expect(touched()).toEqual([]);
  });

  it("Whop throws: whop_unreachable, nothing touched (not even the ledger)", async () => {
    membership = async () => {
      throw new Error("Whop API returned 503");
    };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "whop_unreachable" });
    expect(calls).toEqual([`read user_subscriptions whop_membership_id user_id=${USER}`]);
  });

  it("active but cancelled at the period's end: proceeds", async () => {
    membership = async () => live({ status: "active", cancelAtPeriodEnd: true });
    expect(await deleteAccount(USER, deps())).toEqual({ ok: true, removedFiles: 0 });
    expect(calls.at(-1)).toBe(`deleteUser ${USER}`);
  });

  it("a cancelled membership: proceeds", async () => {
    expect(await deleteAccount(USER, deps())).toEqual({ ok: true, removedFiles: 0 });
  });

  it("no subscription row: proceeds, Whop not asked", async () => {
    world.subRow = null;
    expect(await deleteAccount(USER, deps())).toEqual({ ok: true, removedFiles: 0 });
    expect(asked).toEqual([]);
  });

  it("a row without a membership id: proceeds, Whop not asked", async () => {
    world.subRow = { whop_membership_id: null };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: true, removedFiles: 0 });
    expect(asked).toEqual([]);
  });

  it("Whop has no such membership (null): proceeds", async () => {
    membership = async () => null;
    expect(await deleteAccount(USER, deps())).toEqual({ ok: true, removedFiles: 0 });
  });

  it("the subscription read fails: delete_failed before anything else, Whop not asked", async () => {
    world.subError = { message: "connection failure" };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "delete_failed" });
    expect(asked).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe("deleteAccount: the ledger", () => {
  it("one ledger row: ledger, nothing listed or removed", async () => {
    world.ledgerCount = 1;
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "ledger" });
    expect(calls).toEqual([
      `read user_subscriptions whop_membership_id user_id=${USER}`,
      `count wallet_transactions exact/true user_id=${USER}`,
    ]);
  });

  it("the ledger read fails: delete_failed, nothing listed or removed", async () => {
    world.ledgerError = { message: "timeout" };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "delete_failed" });
    expect(touched()).toEqual([]);
  });
});

describe("deleteAccount: the files", () => {
  beforeEach(() => {
    world.ids = { remix_blueprints: ["bp-1", "bp-2"], analysis_results: ["an-1"] };
    world.objects = {
      // A full page of 1000 and then a short page of 5.
      [`avatars:${USER}`]: files("av", 1005),
      [`videos:${USER}`]: files("vid", 3),
      "clips:bp-1": files("c1", 2),
      "clips:bp-2": files("c2", 1),
      "filmstrips:an-1": files("fa", 4),
      // A blueprint's beat frames, with the scrub/ folder (an entry without an id) listed inside.
      "filmstrips:bp-1": [...files("fb", 2), { name: "scrub", id: null }],
      "filmstrips:bp-1/scrub": files("sc", 3),
    };
  });

  it("lists every prefix, removes in chunks of 100, counts removedFiles, then deletes the user", async () => {
    const outcome = await deleteAccount(USER, deps());
    expect(outcome).toEqual({ ok: true, removedFiles: 1005 + 3 + 3 + 4 + 5 });

    // avatars paged: offset 0 (a full page) then offset 1000 (short).
    expect(calls).toContain(`list avatars ${USER} 0`);
    expect(calls).toContain(`list avatars ${USER} 1000`);
    expect(calls.filter((c) => c.startsWith("list avatars"))).toHaveLength(2);
    expect(calls).toContain(`list videos ${USER} 0`);
    for (const p of ["clips bp-1", "clips bp-2", "filmstrips an-1", "filmstrips bp-1", "filmstrips bp-2", "filmstrips bp-1/scrub"]) {
      expect(calls).toContain(`list ${p} 0`);
    }

    // Chunks of 100: 1005 avatars are 11 removes, the last of 5.
    const avatarRemoves = calls.filter((c) => c.startsWith("remove avatars"));
    expect(avatarRemoves).toHaveLength(11);
    expect(avatarRemoves.at(-1)).toBe("remove avatars 5");
    expect(avatarRemoves.slice(0, 10).every((c) => c === "remove avatars 100")).toBe(true);

    expect(removed.avatars).toHaveLength(1005);
    expect(removed.avatars?.[0]).toBe(`${USER}/f0.bin`);
    expect(removed.videos).toEqual([`${USER}/f0.bin`, `${USER}/f1.bin`, `${USER}/f2.bin`]);
    expect([...(removed.clips ?? [])].sort()).toEqual(["bp-1/f0.bin", "bp-1/f1.bin", "bp-2/f0.bin"]);
    expect([...(removed.filmstrips ?? [])].sort()).toEqual(
      ["an-1/f0.bin", "an-1/f1.bin", "an-1/f2.bin", "an-1/f3.bin", "bp-1/f0.bin", "bp-1/f1.bin", "bp-1/scrub/f0.bin", "bp-1/scrub/f1.bin", "bp-1/scrub/f2.bin"].sort(),
    );
    // A folder entry is never removed as if it were a file.
    expect(removed.filmstrips).not.toContain("bp-1/scrub");
  });

  it("the order: subscription, ledger, lists, removes, deleteUser", async () => {
    await deleteAccount(USER, deps());
    const kind = (c: string) => c.split(" ")[0]!;
    const kinds = calls.map(kind);
    const first = (k: string) => kinds.indexOf(k);
    const last = (k: string) => kinds.lastIndexOf(k);
    expect(kinds[0]).toBe("read");
    expect(kinds[1]).toBe("count");
    expect(last("count")).toBeLessThan(first("list"));
    expect(last("list")).toBeLessThan(first("remove"));
    expect(last("ids")).toBeLessThan(first("remove"));
    expect(last("remove")).toBeLessThan(first("deleteUser"));
    expect(kinds.at(-1)).toBe("deleteUser");
    expect(kinds.filter((k) => k === "deleteUser")).toHaveLength(1);
  });

  it("asks for the caller's blueprints and analyses by user id", async () => {
    await deleteAccount(USER, deps());
    expect(calls).toContain(`ids remix_blueprints id user_id=${USER}`);
    expect(calls).toContain(`ids analysis_results id user_id=${USER}`);
  });

  it("a remove error: files_failed, deleteUser never called, the log says which bucket and how many before", async () => {
    world.removeFailsAt = { videos: 1 };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "files_failed" });
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
    expect(logs).toContainEqual({ event: "delete: file removal failed", fields: { step: "files", bucket: "videos", removedBefore: 1005 } });
  });

  it("a remove error mid-bucket: stops there, nothing more removed", async () => {
    world.removeFailsAt = { avatars: 3 };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "files_failed" });
    expect(removed.avatars).toHaveLength(200);
    expect(calls.filter((c) => c.startsWith("remove"))).toHaveLength(3);
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("a listing error: files_failed before any removal", async () => {
    world.listError.add("filmstrips:bp-1/scrub");
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "files_failed" });
    expect(calls.some((c) => c.startsWith("remove"))).toBe(false);
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("an id read error: files_failed before any removal", async () => {
    world.idsError = { analysis_results: { message: "timeout" } };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "files_failed" });
    expect(calls.some((c) => c.startsWith("remove"))).toBe(false);
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("deleteUser fails: delete_failed, and the log says the files were removed", async () => {
    world.deleteError = { message: "database error" };
    expect(await deleteAccount(USER, deps())).toEqual({ ok: false, reason: "delete_failed" });
    expect(logs).toContainEqual({ event: "delete: user delete failed after files were removed", fields: { step: "account", removedFiles: 1020 } });
  });

  it("the log never carries the user id, an object path or a row id", async () => {
    await deleteAccount(USER, deps());
    world.removeFailsAt = { clips: 1 };
    await deleteAccount(USER, deps());
    world.removeFailsAt = {};
    world.deleteError = { message: "x" };
    await deleteAccount(USER, deps());
    expect(logs.length).toBeGreaterThan(0);
    const text = JSON.stringify(logs);
    for (const secret of [USER, "mem-test-1", "bp-1", "an-1", "f0.bin"]) expect(text).not.toContain(secret);
  });
});
