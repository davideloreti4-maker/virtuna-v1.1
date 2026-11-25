/**
 * POST /api/posted (add a posted link) and GET /api/posted (one piece's link), plan 2026-11-24-after-posting,
 * Task 2, with ruling 12 (every write through the service client). Real: the handlers, what Maven said
 * (`pieceSaid`), the rules and the repository. Stood in for: the build-time flag, the session client's auth
 * call, the database behind the service client (`fake-db.ts` + `fake-tables.ts`) and the scraper (which these
 * two must never touch). Every id, handle and link is made up.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MEAL_PREP_HOOKS, population, runHeader } from "@/components/thread-next/__tests__/fixtures/answers";
import { LINKS_PER_DAY, toPosted, type PiecePostRow, type Posted } from "@/lib/posted/posted";
import { fakeDb } from "@/lib/posted/__tests__/fake-db";
import { fakeTables, withPosts } from "@/lib/posted/__tests__/fake-tables";
import { CHAT, CHAT_2, HOUR, OTHER, USER } from "@/lib/posted/__tests__/fixtures";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import noGroups from "@/lib/result/__tests__/fixtures/no-groups.json";
import { audienceOf } from "@/lib/result/curve";
import { headlineOf } from "@/lib/result/headline";
import type { ResultRow } from "@/lib/result/types";
import { sealHashOf } from "@/lib/thread-next/seal-hash";

vi.setConfig({ testTimeout: 30_000 });

const h = vi.hoisted(() => ({
  flag: true,
  user: null as null | { id: string; is_anonymous?: boolean },
  authCalls: 0,
  client: null as unknown,
  providersMade: 0,
  rate: { success: true, limit: 20, remaining: 19, reset: 0 } as { success: boolean; limit: number; remaining: number; reset: number },
  limitCalls: [] as string[],
  prefixes: [] as string[],
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
// The shared limiter's store (Upstash) is the boundary: its SDK is stood in, `rateLimitGuard` runs for real.
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    constructor(opts: { prefix: string }) {
      h.prefixes.push(opts.prefix);
    }
    async limit(id: string) {
      h.limitCalls.push(id);
      return h.rate;
    }
  },
}));
vi.mock("@/lib/scraping/apify-provider", () => ({
  ApifyScrapingProvider: class {
    constructor() {
      h.providersMade += 1;
    }
  },
}));

import { GET, POST } from "../route";

const STORE_ENV = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
const savedEnv: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const k of STORE_ENV) savedEnv[k] = process.env[k];
  process.env.UPSTASH_REDIS_REST_URL = "https://ratelimit.example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "made-up-token";
});
afterAll(() => {
  for (const k of STORE_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
const denied = () => {
  h.rate = { success: false, limit: 20, remaining: 0, reset: Date.now() + 30_000 };
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const AT = "2026-11-21T10:00:00.000Z";
const RUN_AT = "2026-11-21T10:30:00.123456+00:00";
const LINK = "https://vm.tiktok.com/ZMmadeup1/";
const [HOOK_1] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine) as [string];
const MIDDLE = middle as unknown as ResultRow & { id: string };
const NO_GROUPS = noGroups as unknown as ResultRow & { id: string };

let posts: ReturnType<typeof fakeDb>;
let tables: ReturnType<typeof fakeTables>;
let KEY = "";

const chatRow = (id: string, user = USER, seals: Record<string, unknown> = {}) => ({
  id,
  user_id: user,
  type: "open",
  reading_id: null,
  title: "A chat",
  created_at: "2026-11-20T09:00:00.000000+00:00",
  updated_at: "2026-11-21T12:00:00.000000+00:00",
  pinned_at: null,
  sim_seals: seals,
  active_audience_id: null,
});
const runRow = (row: ResultRow & { id: string }, user = USER) => ({
  id: row.id,
  user_id: user,
  deleted_at: null,
  created_at: RUN_AT,
  heatmap: row.heatmap ?? null,
  variants: null,
  personas: null,
  verbatim: null,
  overall_score: 61,
  engine_version: "3.25.0",
  input_mode: "video_upload",
  video_storage_path: null,
});
const textSeal = (stopPct: number) => ({ pct: 70, band: "Mixed", at: AT, population: population(stopPct) });
const videoSeal = (row: ResultRow & { id: string }) => ({ pct: 46, band: null, at: AT, video: { analysisId: row.id, stopPct: 46, craftScore: null, heatmap: row.heatmap, videoSignals: null, verbatim: null } });

beforeEach(async () => {
  h.flag = true;
  h.user = { id: USER };
  h.authCalls = 0;
  h.providersMade = 0;
  h.rate = { success: true, limit: 20, remaining: 19, reset: Date.now() + 60_000 };
  h.limitCalls = [];
  posts = fakeDb();
  posts.state.now = new Date();
  tables = fakeTables();
  h.client = withPosts(posts.client, tables);
  KEY = await sealHashOf(HOOK_1);
  tables.state.tables.threads = [chatRow(CHAT, USER, { [HOOK_1]: textSeal(30) })];
  tables.state.tables.messages = [{ id: "m1", thread_id: CHAT, role: "assistant", body: [runHeader("hooks"), ...MEAL_PREP_HOOKS], created_at: AT }];
  tables.state.tables.analysis_results = [runRow(MIDDLE), runRow(NO_GROUPS)];
});

afterEach(() => {
  vi.restoreAllMocks();
});

const json = { "Content-Type": "application/json" };
const add = (body: unknown, headers: Record<string, string> = json) =>
  POST(new Request("http://localhost/api/posted", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
const addText = (over: Record<string, unknown> = {}) => add({ kind: "text", threadId: CHAT, key: KEY, url: LINK, ...over });
const addVideo = (over: Record<string, unknown> = {}) => add({ kind: "video", analysisId: MIDDLE.id, url: LINK, ...over });
const get = (query: string) => GET(new Request(`http://localhost/api/posted${query}`));

const nothingRead = () => {
  expect(posts.state.calls).toEqual([]);
  expect(tables.state.calls).toEqual([]);
};
const storedRows = () => posts.state.rows as unknown as PiecePostRow[];

// ─── Who may ask ─────────────────────────────────────────────────────────────

describe("who may ask", () => {
  it("flag off: POST and GET answer 404 and read nothing, not even the session", async () => {
    h.flag = false;
    expect((await addText()).status).toBe(404);
    expect((await get(`?threadId=${CHAT}&key=${KEY}`)).status).toBe(404);
    nothingRead();
    expect(h.authCalls).toBe(0);
  });

  it("signed out: 401 Unauthorized, nothing read", async () => {
    h.user = null;
    const res = await addText();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect((await get(`?threadId=${CHAT}&key=${KEY}`)).status).toBe(401);
    nothingRead();
  });

  it("a funnel visitor: 404, nothing read", async () => {
    h.user = { id: USER, is_anonymous: true };
    expect((await addText()).status).toBe(404);
    expect((await get(`?threadId=${CHAT}&key=${KEY}`)).status).toBe(404);
    nothingRead();
  });

  it("a write that is not JSON (415) or from another origin (403) is refused before anything is read", async () => {
    expect((await add({ kind: "text", threadId: CHAT, key: KEY, url: LINK }, { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await add({ kind: "text", threadId: CHAT, key: KEY, url: LINK }, { ...json, Origin: "https://evil.example" })).status).toBe(403);
    nothingRead();
  });
});

// ─── The shared rate limit (ruling 28) ───────────────────────────────────────

describe("the shared rate limit", () => {
  it("asks the limiter for the caller under the route key posted, after the gates, and adds a link when it allows", async () => {
    expect((await addText()).status).toBe(201);
    expect(h.limitCalls).toEqual([USER]);
    expect(h.prefixes).toContain("rl:tools:posted");
  });

  it("a 429 from it is passed through, and nothing is read", async () => {
    denied();
    const res = await addText();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()) as { error: string }).toEqual({ error: expect.stringMatching(/rate limit/i) });
    nothingRead();
  });

  it("is not asked before the gates: flag off, signed out, a funnel visitor, not JSON, another origin", async () => {
    h.flag = false;
    await addText();
    h.flag = true;
    h.user = null;
    await addText();
    h.user = { id: USER, is_anonymous: true };
    await addText();
    h.user = { id: USER };
    await add({ kind: "text", threadId: CHAT, key: KEY, url: LINK }, { "Content-Type": "text/plain" });
    await add({ kind: "text", threadId: CHAT, key: KEY, url: LINK }, { ...json, Origin: "https://evil.example" });
    expect(h.limitCalls).toEqual([]);
  });

  it("GET is not limited", async () => {
    denied();
    expect((await get(`?threadId=${CHAT}&key=${KEY}`)).status).toBe(200);
    expect(h.limitCalls).toEqual([]);
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/posted", () => {
  it("a text piece: 201 with the posted piece; stored once, for the caller, with what Maven said; the post is not read", async () => {
    const res = await addText({ url: `  ${LINK} ` });
    expect(res.status).toBe(201);
    const text = await res.text();
    const { posted } = JSON.parse(text) as { posted: Posted };
    expect(storedRows()).toHaveLength(1);
    const row = storedRows()[0]!;
    expect(row).toMatchObject({
      user_id: USER,
      thread_id: CHAT,
      piece_key: KEY,
      piece_kind: "hooks",
      said_number: 30,
      said_measure: "stop",
      post_url: LINK, // trimmed
      views: null,
      removed_at: null,
    });
    expect(Date.parse(row.said_at!)).toBe(Date.parse(AT));
    expect(posted).toMatchObject({ id: row.id, threadId: CHAT, pieceKey: KEY, said: { number: 30, measure: "stop" }, state: "reading", numbers: null, handle: null, href: null, due: true });
    // The pasted link never leaves again: the link shown is built from a read handle and id.
    expect(text).not.toContain("ZMmadeup1");
    expect(h.providersMade).toBe(0);
    // Every table call went through the service client, scoped to the caller.
    for (const call of posts.state.calls) {
      if (call.action === "insert") expect(call.values).toMatchObject({ user_id: USER });
      else expect(call.filters).toContainEqual({ op: "eq", column: "user_id", value: USER });
    }
  });

  it("a video: 201; the number its result page shows, the run's time, and the chat that holds it", async () => {
    tables.state.tables.threads.push(chatRow(CHAT_2, USER, { [MIDDLE.id]: videoSeal(MIDDLE) }));
    const res = await addVideo();
    expect(res.status).toBe(201);
    const { posted } = (await res.json()) as { posted: Posted };
    expect(posted).toMatchObject({ threadId: CHAT_2, pieceKey: MIDDLE.id, said: { number: headlineOf(audienceOf(MIDDLE)!).value, measure: "end" } });
    expect(storedRows()[0]).toMatchObject({ piece_kind: "video", said_measure: "end", thread_id: CHAT_2 });
    expect(Date.parse(storedRows()[0]!.said_at!)).toBe(Date.parse(RUN_AT));
  });

  it.each([
    ["another site", "https://www.youtube.com/watch?v=madeup"],
    ["the bare apex", "https://tiktok.com/@nia.cooks/video/7301444403323456789"],
    ["plain http", "http://www.tiktok.com/@nia.cooks/video/7301444403323456789"],
    ["blank", "   "],
    ["a link with a space inside", "https://www.tiktok.com/@nia cooks/video/1"],
    ["501 characters", `https://www.tiktok.com/${"a".repeat(478)}`],
  ])("not a TikTok link (%s): 400 not_tiktok, nothing read", async (_case, url) => {
    const res = await addText({ url });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "not_tiktok" });
    nothingRead();
  });

  it.each([
    ["no body", "not json"],
    ["no kind", { threadId: CHAT, key: KEY, url: LINK }],
    ["a kind that is not one", { kind: "script", threadId: CHAT, key: KEY, url: LINK }],
    ["no link", { kind: "text", threadId: CHAT, key: KEY }],
    ["a link that is not text", { kind: "video", analysisId: MIDDLE.id, url: 5 }],
  ])("a body that is not one (%s): 400, nothing read", async (_case, body) => {
    expect((await add(body)).status).toBe(400);
    nothingRead();
  });

  it.each([
    ["another person's chat", () => ({ threadId: "99999999-9999-4999-8999-999999999999" }), () => tables.state.tables.threads.push(chatRow("99999999-9999-4999-8999-999999999999", OTHER, { [HOOK_1]: textSeal(30) }))],
    ["a key the chat never simulated", async () => ({ key: await sealHashOf("never simulated") }), () => {}],
    ["a chat id that is not one", () => ({ threadId: "not-a-chat" }), () => {}],
  ])("a text piece that is not the caller's (%s): 404 Not found, nothing written", async (_case, over, setup) => {
    setup();
    const res = await addText(await over());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(storedRows()).toEqual([]);
  });

  it("another person's video: 404; a video whose result page has no number: 422 no_number", async () => {
    tables.state.tables.analysis_results = [runRow(MIDDLE, OTHER), runRow(NO_GROUPS)];
    expect((await addVideo()).status).toBe(404);
    const res = await addVideo({ analysisId: NO_GROUPS.id });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "no_number" });
    expect(storedRows()).toEqual([]);
  });

  it("a piece that already has a live link: 409 already_linked; once removed it can be linked again", async () => {
    expect((await addText()).status).toBe(201);
    const again = await addText({ url: "https://vm.tiktok.com/ZMmadeup2/" });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "already_linked" });
    posts.state.rows[0]!.removed_at = new Date().toISOString();
    expect((await addText({ url: "https://vm.tiktok.com/ZMmadeup2/" })).status).toBe(201);
  });

  it("a video linked from one chat is already linked from any other", async () => {
    expect((await addVideo()).status).toBe(201); // no chat holds it yet
    tables.state.tables.threads.push(chatRow(CHAT_2, USER, { [MIDDLE.id]: videoSeal(MIDDLE) }));
    const res = await addVideo();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_linked" });
  });

  it(`the ${LINKS_PER_DAY + 1}st link in 24 hours: 429 too_many; removed links count; older ones do not`, async () => {
    const base = { user_id: USER, thread_id: CHAT_2, piece_kind: "hooks", said_number: 50, said_measure: "stop", post_url: LINK };
    const now = Date.now();
    for (let i = 0; i < LINKS_PER_DAY; i += 1) {
      posts.seed({ ...base, piece_key: `k${i}`, created_at: new Date(now - HOUR).toISOString(), removed_at: i % 2 === 0 ? new Date(now).toISOString() : null });
    }
    posts.seed({ ...base, user_id: OTHER, piece_key: "theirs" });
    const res = await addText();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too_many" });
    expect(storedRows()).toHaveLength(LINKS_PER_DAY + 1);

    // A day later the oldest have left the window.
    for (const row of posts.state.rows) if (row.user_id === USER) row.created_at = new Date(now - 25 * HOUR).toISOString();
    expect((await addText()).status).toBe(201);
  });

  it("a piece already linked says so, even at the day's limit", async () => {
    expect((await addText()).status).toBe(201);
    for (let i = 0; i < LINKS_PER_DAY; i += 1) posts.seed({ user_id: USER, thread_id: CHAT_2, piece_key: `k${i}`, piece_kind: "hooks", said_number: 50, said_measure: "stop", post_url: LINK });
    expect(await (await addText()).json()).toEqual({ error: "already_linked" });
  });

  it("a database error: 500 Server error; the log has the database's text and never the pasted link", async () => {
    tables.state.failOn = "threads";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await addText();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    const logged = log.mock.calls.flat().map(String).join(" ");
    expect(logged).toMatch(/^\[posted\]/);
    expect(logged).toContain("connection reset by peer");
    expect(logged).not.toContain("ZMmadeup");
  });
});

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/posted", () => {
  it("a text piece's live link, as it leaves the server; none: null; another person's: null", async () => {
    expect(await (await get(`?threadId=${CHAT}&key=${KEY}`)).json()).toEqual({ posted: null });
    await addText();
    const res = await get(`?threadId=${CHAT}&key=${KEY}`);
    expect(res.status).toBe(200);
    const { posted } = (await res.json()) as { posted: Posted };
    expect(posted).toEqual(toPosted(storedRows()[0]!, new Date(Date.parse(posted.linkedAt) + 1)));
    h.user = { id: OTHER };
    expect(await (await get(`?threadId=${CHAT}&key=${KEY}`)).json()).toEqual({ posted: null });
    expect(h.providersMade).toBe(0);
  });

  it("a video's live link, whichever chat it was linked from", async () => {
    tables.state.tables.threads.push(chatRow(CHAT_2, USER, { [MIDDLE.id]: videoSeal(MIDDLE) }));
    await addVideo();
    const { posted } = (await (await get(`?analysisId=${MIDDLE.id}`)).json()) as { posted: Posted };
    expect(posted).toMatchObject({ pieceKey: MIDDLE.id, threadId: CHAT_2 });
  });

  it("a removed link is no link", async () => {
    await addText();
    posts.state.rows[0]!.removed_at = new Date().toISOString();
    expect(await (await get(`?threadId=${CHAT}&key=${KEY}`)).json()).toEqual({ posted: null });
  });

  it.each([[""], ["?threadId=not-a-chat&key=VvK87Bp1dO"], [`?threadId=${CHAT}&key=short`], [`?threadId=${CHAT}`], ["?analysisId=a/b"], [`?threadId=${CHAT}&key=${"VvK87Bp1dO"}&analysisId=x`]])(
    "a query that names no piece (%s): 404, nothing read",
    async (query) => {
      expect((await get(query)).status).toBe(404);
      nothingRead();
    },
  );

  it("a database error: 500 Server error", async () => {
    posts.state.failNext = { code: "08006", message: "connection reset by peer" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get(`?threadId=${CHAT}&key=${KEY}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    expect(log).toHaveBeenCalled();
  });
});
