/**
 * POST /api/posted/refresh — read what is owed (plan 2026-11-24-after-posting, Task 2). Real: the handler, the
 * reader (`readDue`), the rules and the repository. Stood in for: the build-time flag, the session client's
 * auth call, the database (`fake-db.ts`) and the scraper (`ApifyScrapingProvider`, a recording stand-in).
 * Every id, handle and link is made up.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Posted } from "@/lib/posted/posted";
import { fakeDb } from "@/lib/posted/__tests__/fake-db";
import { CHAT, HOUR, OTHER, USER, idAt } from "@/lib/posted/__tests__/fixtures";
import type { VideoData } from "@/lib/scraping/types";

vi.setConfig({ testTimeout: 30_000 });

const h = vi.hoisted(() => ({
  flag: true,
  user: null as null | { id: string; is_anonymous?: boolean },
  authCalls: 0,
  client: null as unknown,
  noToken: false,
  made: 0,
  calls: [] as string[],
  single: {} as Record<string, unknown>,
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
      if (h.noToken) throw new Error("ApifyScrapingProvider: no Apify token");
      h.made += 1;
    }
    async scrapeSinglePostMetrics(url: string) {
      h.calls.push(`single ${url}`);
      const answer = h.single[url];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) throw new Error("stand-in: no answer scripted");
      return answer;
    }
    async scrapeVideos(handle: string, limit: number, mode: string) {
      h.calls.push(`account ${handle} ${limit} ${mode}`);
      return [];
    }
  },
}));

import * as route from "../route";

const { POST } = route;

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

let db: ReturnType<typeof fakeDb>;
const LINK = (n: number) => `https://vm.tiktok.com/ZMmadeup${n}/`;
const base = (n: number) => ({ thread_id: CHAT, piece_key: `k${n}`, piece_kind: "hooks", said_number: 67, said_measure: "stop", post_url: LINK(n) });
const POST_ID = idAt(new Date(Date.now() - 30 * HOUR));
const video = (views: number): VideoData => ({
  platformVideoId: POST_ID,
  videoUrl: `https://www.tiktok.com/@nia.cooks/video/${POST_ID}`,
  caption: "A CAPTION FROM OUTSIDE THE APP",
  views,
  likes: 2_100,
  comments: 84,
  shares: 310,
  saves: 420,
  hashtags: [],
  durationSeconds: 21,
  postedAt: new Date(),
  author: { handle: "nia.cooks", fans: 1, heart: 1, videoCount: 1 },
});

beforeEach(() => {
  h.flag = true;
  h.user = { id: USER };
  h.authCalls = 0;
  h.noToken = false;
  h.made = 0;
  h.calls = [];
  h.single = {};
  h.rate = { success: true, limit: 20, remaining: 19, reset: Date.now() + 60_000 };
  h.limitCalls = [];
  db = fakeDb();
  db.state.now = new Date();
  h.client = db.client;
});
afterEach(() => {
  vi.restoreAllMocks();
});

const json = { "Content-Type": "application/json" };
const refresh = (body: unknown = {}, headers: Record<string, string> = json) =>
  POST(new Request("http://localhost/api/posted/refresh", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
const idOf = (key: string) => String(db.state.rows.find((r) => r.piece_key === key)!.id);
const answerOf = async (res: Response) => (await res.json()) as { posted: Posted[] };

describe("who may ask", () => {
  it("flag off: 404, nothing read, not even the session, no scraper made", async () => {
    h.flag = false;
    db.seed({ ...base(1), user_id: USER });
    expect((await refresh()).status).toBe(404);
    expect(db.state.calls).toEqual([]);
    expect(h.authCalls).toBe(0);
    expect(h.made).toBe(0);
  });

  it("signed out: 401; a funnel visitor: 404; not JSON: 415; another origin: 403; nothing read", async () => {
    h.user = null;
    expect((await refresh()).status).toBe(401);
    h.user = { id: USER, is_anonymous: true };
    expect((await refresh()).status).toBe(404);
    h.user = { id: USER };
    expect((await refresh({}, { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await refresh({}, { ...json, Origin: "https://evil.example" })).status).toBe(403);
    expect(db.state.calls).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it("gives itself five minutes", () => {
    expect(route.maxDuration).toBe(300);
  });
});

describe("the shared rate limit (ruling 28)", () => {
  it("asks the limiter for the caller under the route key posted, after the gates", async () => {
    expect((await refresh({})).status).toBe(200);
    expect(h.limitCalls).toEqual([USER]);
    expect(h.prefixes).toContain("rl:tools:posted");
    h.user = null;
    await refresh({});
    h.user = { id: USER };
    await refresh({}, { "Content-Type": "text/plain" });
    expect(h.limitCalls).toEqual([USER]);
  });

  it("a 429 from it is passed through: nothing is read, no scraper is made", async () => {
    db.seed({ ...base(1), user_id: USER });
    h.single[LINK(1)] = video(900);
    denied();
    const res = await refresh({ id: idOf("k1") });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(db.state.calls).toEqual([]);
    expect(h.made).toBe(0);
    expect(h.calls).toEqual([]);
  });
});

describe("POST /api/posted/refresh", () => {
  it("{ id }: reads that post and answers it as it leaves the server; no caption, no pasted link", async () => {
    db.seed({ ...base(1), user_id: USER }, { ...base(2), user_id: USER });
    h.single[LINK(2)] = video(12_400);
    const res = await refresh({ id: idOf("k2") });
    expect(res.status).toBe(200);
    const text = await res.text();
    const { posted } = JSON.parse(text) as { posted: Posted[] };
    expect(h.calls).toEqual([`single ${LINK(2)}`]);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      id: idOf("k2"),
      state: "so-far",
      numbers: { views: 12_400, likes: 2_100, comments: 84, shares: 310, saves: 420 },
      handle: "nia.cooks",
      href: `https://www.tiktok.com/@nia.cooks/video/${POST_ID}`,
      due: false,
    });
    expect(text).not.toContain("CAPTION");
    expect(text).not.toContain("ZMmadeup");
  });

  it("{}: reads every post of the caller's that is owed, never another person's", async () => {
    db.seed({ ...base(1), user_id: USER }, { ...base(2), user_id: OTHER });
    h.single[LINK(1)] = video(900);
    const { posted } = await answerOf(await refresh({}));
    expect(posted.map((p) => p.pieceKey)).toEqual(["k1"]);
    expect(h.calls).toEqual([`single ${LINK(1)}`]);
    expect(db.state.rows.find((r) => r.piece_key === "k2")!.views).toBeNull();
  });

  it("an empty body is a plain refresh", async () => {
    const res = await refresh("");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ posted: [] });
  });

  it("{ id, retry: true }: Try again of an unread post reads it now, from no failures", async () => {
    db.seed({ ...base(1), user_id: USER, read_error: "gone", attempts: 1, last_attempt_at: new Date(Date.now() - 2 * 60_000).toISOString() });
    h.single[LINK(1)] = video(700);
    const { posted } = await answerOf(await refresh({ id: idOf("k1"), retry: true }));
    expect(posted[0]).toMatchObject({ state: "so-far", numbers: { views: 700 } });
    expect(db.state.rows[0]).toMatchObject({ read_error: null, attempts: 0 });
  });

  it("Try again right after a failed read reads at once (ruling 22)", async () => {
    db.seed({ ...base(1), user_id: USER, read_error: "gone", attempts: 1, last_attempt_at: new Date().toISOString() });
    h.single[LINK(1)] = video(700);
    const { posted } = await answerOf(await refresh({ id: idOf("k1"), retry: true }));
    expect(h.calls).toEqual([`single ${LINK(1)}`]);
    expect(posted[0]).toMatchObject({ state: "so-far", numbers: { views: 700 } });
  });

  it("nothing to read, and no scraper token: 200 with nothing, and no scraper is made (ruling 23)", async () => {
    h.noToken = true;
    db.seed({ ...base(1), user_id: USER, views: 1, likes: 1, comments: 1, shares: 1, saves: 1, read_at: new Date().toISOString(), last_attempt_at: new Date().toISOString() });
    const res = await refresh({});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ posted: [] });
    expect(await (await refresh({ id: idOf("k1") })).json()).toEqual({ posted: [] });
    expect(h.made).toBe(0);
  });

  it("another person's id: 200 with nothing, and no read", async () => {
    db.seed({ ...base(1), user_id: OTHER });
    expect(await (await refresh({ id: idOf("k1") })).json()).toEqual({ posted: [] });
    expect(h.calls).toEqual([]);
  });

  it.each([
    ["not JSON", "{ not json"],
    ["retry without an id", { retry: true }],
    ["an id that is not text", { id: 5 }],
    ["retry that is not true or false", { id: "x", retry: "yes" }],
  ])("a body that is not one (%s): 400, nothing read", async (_case, body) => {
    expect((await refresh(body)).status).toBe(400);
    expect(db.state.calls).toEqual([]);
  });

  it("a failed read is stored as one and logged without the link", async () => {
    db.seed({ ...base(1), user_id: USER });
    h.single[LINK(1)] = new Error(`actor crashed reading ${LINK(1)}`);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { posted } = await answerOf(await refresh({ id: idOf("k1") }));
    // Ruling 19a: one failed first read is enough for "Couldn't read this post" and its Try again.
    expect(posted[0]).toMatchObject({ state: "unread", due: false });
    expect(db.state.rows[0]).toMatchObject({ read_error: "failed", attempts: 1 });
    expect(warn.mock.calls.flat().map(String).join(" ")).not.toContain("ZMmadeup");
  });

  it("without a scraper token: 500 Server error, and nothing is written", async () => {
    db.seed({ ...base(1), user_id: USER });
    h.noToken = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await refresh({ id: idOf("k1") });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    expect(db.state.calls.filter((c) => c.action !== "select")).toEqual([]);
    expect(String(log.mock.calls[0]![0])).toMatch(/^\[posted\]/);
  });

  it("a database error: 500 Server error", async () => {
    db.state.failNext = { code: "08006", message: "connection reset by peer" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await refresh({});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
  });
});
