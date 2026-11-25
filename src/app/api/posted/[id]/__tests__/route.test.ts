/**
 * DELETE /api/posted/[id] — remove a posted link (plan 2026-11-24-after-posting, Task 2; rulings 5 and 12: the
 * row is kept with `removed_at`, written through the service client). Real: the handler and the repository.
 * Stood in for: the build-time flag, the session client's auth call and the database (`fake-db.ts`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb } from "@/lib/posted/__tests__/fake-db";
import { CHAT, OTHER, USER } from "@/lib/posted/__tests__/fixtures";

vi.setConfig({ testTimeout: 30_000 });

const h = vi.hoisted(() => ({
  flag: true,
  user: null as null | { id: string; is_anonymous?: boolean },
  authCalls: 0,
  client: null as unknown,
}));

vi.mock("@/lib/flags/new-look", () => ({
  get NEW_LOOK_ENABLED() {
    return h.flag;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        h.authCalls += 1;
        return { data: { user: h.user }, error: null };
      },
    },
    from: () => {
      throw new Error("stand-in: the session client reads no table here (ruling 12)");
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => h.client }));

import { DELETE } from "../route";

let db: ReturnType<typeof fakeDb>;
const base = { thread_id: CHAT, piece_kind: "hooks", said_number: 67, said_measure: "stop", post_url: "https://vm.tiktok.com/ZMmadeup1/" };

beforeEach(() => {
  h.flag = true;
  h.user = { id: USER };
  h.authCalls = 0;
  db = fakeDb();
  h.client = db.client;
  db.seed({ ...base, user_id: USER, piece_key: "mine" }, { ...base, user_id: OTHER, piece_key: "theirs" });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const idOf = (key: string) => String(db.state.rows.find((r) => r.piece_key === key)!.id);
const remove = (id: string, headers: Record<string, string> = {}) =>
  DELETE(new Request(`http://localhost/api/posted/${id}`, { method: "DELETE", headers }), { params: Promise.resolve({ id }) });

describe("DELETE /api/posted/[id]", () => {
  it("flag off: 404, nothing read, not even the session", async () => {
    h.flag = false;
    expect((await remove(idOf("mine"))).status).toBe(404);
    expect(db.state.calls).toEqual([]);
    expect(h.authCalls).toBe(0);
  });

  it("signed out: 401; a funnel visitor: 404; another origin: 403; nothing written", async () => {
    h.user = null;
    expect((await remove(idOf("mine"))).status).toBe(401);
    h.user = { id: USER, is_anonymous: true };
    expect((await remove(idOf("mine"))).status).toBe(404);
    h.user = { id: USER };
    expect((await remove(idOf("mine"), { Origin: "https://evil.example" })).status).toBe(403);
    expect(db.state.calls).toEqual([]);
  });

  it("the caller's live link: 204, and the row is kept with its removal time", async () => {
    const res = await remove(idOf("mine"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    const row = db.state.rows.find((r) => r.piece_key === "mine")!;
    expect(row.removed_at).not.toBeNull();
    expect(db.state.rows).toHaveLength(2);
    expect(db.state.calls.every((c) => c.filters.some((f) => f.column === "user_id" && f.value === USER))).toBe(true);
  });

  it("another person's link, one already removed, and an id that is not one: 404 Not found", async () => {
    const theirs = await remove(idOf("theirs"));
    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual({ error: "Not found" });
    expect(db.state.rows.find((r) => r.piece_key === "theirs")!.removed_at).toBeNull();
    expect((await remove(idOf("mine"))).status).toBe(204);
    expect((await remove(idOf("mine"))).status).toBe(404);
    expect((await remove("not-an-id")).status).toBe(404);
  });

  it("a database error: 500 Server error, logged under the route's prefix", async () => {
    db.state.failNext = { code: "08006", message: "connection reset by peer" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await remove(idOf("mine"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    expect(String(log.mock.calls[0]![0])).toMatch(/^\[posted\]/);
  });
});
