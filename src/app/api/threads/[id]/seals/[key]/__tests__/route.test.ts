/**
 * GET /api/threads/[id]/seals/[key] — one text simulation's result, for its page (thread answers
 * step 2, spec §4). Real: the route, `readSimSeals`, the key (`sealHashOf`), `stopNumberOf`, the funnel
 * wall. Stood in for: the Supabase server client (the I/O boundary) and the build-time flag.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HOOK_1_POPULATION, MEAL_PREP_HOOKS, population } from "@/components/thread-next/__tests__/fixtures/answers";
import { sealHashOf } from "@/lib/thread-next/seal-hash";

vi.setConfig({ testTimeout: 30_000 });

const db = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  row: null as unknown,
  error: null as null | { message: string },
  from: [] as string[],
  eqs: [] as [string, unknown][],
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user }, error: null }) },
    from: (table: string) => {
      db.from.push(table);
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          db.eqs.push([column, value]);
          return query;
        },
        maybeSingle: async () => ({ data: db.row, error: db.error }),
      };
      return query;
    },
  }),
}));

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../route")).GET;
}

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "00000000-0000-4000-8000-0000000000bb";
const HOOK_1 = MEAL_PREP_HOOKS[0]!.props.hookLine;
const HOOK_2 = MEAL_PREP_HOOKS[1]!.props.hookLine;
const AT = "2026-11-21T00:00:00.000Z";
let KEY_1 = "";
let KEY_2 = "";

beforeAll(async () => {
  KEY_1 = await sealHashOf(HOOK_1);
  KEY_2 = await sealHashOf(HOOK_2);
});

beforeEach(() => {
  db.user = { id: USER };
  db.row = null;
  db.error = null;
  db.from = [];
  db.eqs = [];
});

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

type Get = Awaited<ReturnType<typeof load>>;
const call = (GET: Get, id = THREAD, key = KEY_1) =>
  GET(new Request(`http://localhost/api/threads/${id}/seals/${key}`), { params: Promise.resolve({ id, key }) });

const sealed = (seals: Record<string, unknown>) => ({ id: THREAD, type: "open", sim_seals: seals });
const textSeal = (pop: unknown) => ({ pct: 70, band: null, at: AT, population: pop });

describe("GET /api/threads/[id]/seals/[key]", () => {
  it("flag off: not found, and nothing is read", async () => {
    const GET = await load(false);
    expect((await call(GET)).status).toBe(404);
    expect(db.from).toEqual([]);
  });

  it("signed out: 401", async () => {
    const GET = await load(true);
    db.user = null;
    expect((await call(GET)).status).toBe(401);
  });

  it("a funnel visitor (anonymous): not found, nothing read", async () => {
    const GET = await load(true);
    db.user = { id: USER, is_anonymous: true };
    expect((await call(GET)).status).toBe(404);
    expect(db.from).toEqual([]);
  });

  it.each([
    ["a malformed id", "not-a-uuid", "VvK87Bp1dO"],
    ["a short key", THREAD, "short"],
    ["a key with a slash", THREAD, "VvK87Bp1d/"],
  ])("%s: not found, nothing read", async (_case, id, key) => {
    const GET = await load(true);
    expect((await call(GET, id, key)).status).toBe(404);
    expect(db.from).toEqual([]);
  });

  it("a thread that is not the caller's (or not there): not found; owner-checked, any status", async () => {
    const GET = await load(true);
    db.row = null;
    expect((await call(GET)).status).toBe(404);
    expect(db.from).toEqual(["threads"]);
    expect(db.eqs).toEqual([["id", THREAD], ["user_id", USER]]);
  });

  it("the key of a text seal with a population: its text, time and population", async () => {
    const GET = await load(true);
    db.row = sealed({ [HOOK_1]: textSeal(HOOK_1_POPULATION), [HOOK_2]: textSeal(population(22)) });
    const res = await call(GET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: HOOK_1, at: AT, population: HOOK_1_POPULATION, open: true });
    const second = await call(GET, THREAD, KEY_2);
    expect((await second.json()).population.stopPct).toBe(22);
  });

  it("an archived thread's seal is still its creator's", async () => {
    const GET = await load(true);
    db.row = { ...sealed({ [HOOK_1]: textSeal(HOOK_1_POPULATION) }), type: "archived" };
    const res = await call(GET);
    expect(res.status).toBe(200);
    // …but it cannot take a new turn: the page shows no "Script this one".
    expect((await res.json()).open).toBe(false);
  });

  it("an unknown key: not found", async () => {
    const GET = await load(true);
    db.row = sealed({ [HOOK_1]: textSeal(HOOK_1_POPULATION) });
    expect((await call(GET, THREAD, await sealHashOf("a text this thread never simulated"))).status).toBe(404);
  });

  it("a seal without a population, or without a number: not found", async () => {
    const GET = await load(true);
    db.row = sealed({ [HOOK_1]: { pct: 60, band: null, at: AT } });
    expect((await call(GET)).status).toBe(404);
    db.row = sealed({ [HOOK_1]: textSeal({ total: 1000, segments: [], reasons: [] }) });
    expect((await call(GET)).status).toBe(404);
  });

  it("a video seal never matches, even with a population", async () => {
    const GET = await load(true);
    db.row = sealed({
      [HOOK_1]: { ...textSeal(HOOK_1_POPULATION), video: { analysisId: "a1", stopPct: 46, heatmap: { weighted_curve: [1, 0.5] } } },
    });
    expect((await call(GET)).status).toBe(404);
  });

  it("a database error: 500; the database's text goes to the log, never on the wire", async () => {
    const GET = await load(true);
    db.error = { message: "connection reset" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await call(GET);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Server error" });
      expect(log).toHaveBeenCalledWith("[threads/seals] thread read failed:", "connection reset");
    } finally {
      log.mockRestore();
    }
  });
});
