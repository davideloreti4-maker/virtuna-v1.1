/**
 * GET /api/threads/library — one page of the creator's chats, for the Library (plan 2026-11-23-library,
 * Task 2 with its extras A, B and C).
 *
 * Real: the route, `readLibraryPage`, `chatSummaryOf`, `readSimSeals`, and the result page's number
 * (`audienceOf`, `headlineOf`, `videoStateOf`) the video tests compare with. Stood in for: the build-time
 * flag, the session client's auth call, and the database behind both Supabase clients. The database
 * stand-in is a small in-memory PostgREST: it filters, orders, pages, caps (`max_rows`) and projects
 * rows the way the real one does for the calls this route makes, compares times to the microsecond as
 * Postgres compares `timestamptz`, refuses a column the table does not have, and records every call.
 *
 * Fixture ids are made up; message bodies are the thread's real block fixtures; video runs are the
 * RECORDED rows of `lib/result/__tests__/fixtures`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IDEAS_4,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  broughtCard,
  md,
  population,
  runHeader,
  video,
} from "@/components/thread-next/__tests__/fixtures/answers";
import type { HeatmapPayload } from "@/lib/engine/types";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { chatSummaryOf, type ChatSummary } from "@/lib/library/chat-summary";
import type { LibraryPage } from "@/lib/library/library-page";
import { migrationColumns } from "@/lib/posted/__tests__/fake-db";
import { PIECE_POST_SELECT } from "@/lib/posted/posted-repo";
import { toPosted, type PiecePostRow } from "@/lib/posted/posted";
import early from "@/lib/result/__tests__/fixtures/early.json";
import ending from "@/lib/result/__tests__/fixtures/ending.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import noGroups from "@/lib/result/__tests__/fixtures/no-groups.json";
import { audienceOf } from "@/lib/result/curve";
import { headlineOf } from "@/lib/result/headline";
import type { ResultRow } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import { readSimSeals, type SimSealMap } from "@/lib/threads/sim-seals";

vi.setConfig({ testTimeout: 30_000 });

// ─── The database stand-in ───────────────────────────────────────────────────

const fake = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { op: string; column: string; value: unknown };
  type Cond = { kind: "and" | "or"; parts: Cond[] } | { kind: "op"; column: string; op: string; value: string };
  interface Recorded {
    client: "session" | "service";
    table: string;
    columns: string;
    count: string | null;
    filters: Filter[];
    or: string[];
    order: Array<[string, boolean]>;
    limit: number | null;
    range: [number, number] | null;
  }

  /** The columns of the tables read here (`src/types/database.types.ts`, abridged; `piece_posts` is read
   *  from its migration below). */
  const SCHEMA: Record<string, readonly string[]> = {
    threads: ["id", "user_id", "type", "reading_id", "title", "created_at", "updated_at", "pinned_at", "sim_seals", "active_audience_id"],
    messages: ["id", "thread_id", "role", "body", "created_at"],
    analysis_results: [
      "id",
      "user_id",
      "deleted_at",
      "created_at",
      "heatmap",
      "variants",
      "personas",
      "verbatim",
      "overall_score",
      "engine_version",
      "input_mode",
      "video_storage_path",
    ],
  };

  const state = {
    user: null as null | { id: string; is_anonymous?: boolean },
    authCalls: 0,
    tables: {} as Record<string, Row[]>,
    failOn: null as string | null,
    maxRows: 1000,
    queries: [] as Recorded[],
  };

  const TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;
  /** A stored time in microseconds, the precision Postgres compares `timestamptz` at (a Date keeps ms). */
  const microsOf = (v: string): number | null => {
    const m = TIME.exec(v);
    return m ? Date.parse(`${m[1]}${m[3]}`) * 1000 + Number((m[2] ?? "").padEnd(6, "0")) : null;
  };
  const compare = (a: unknown, b: unknown): number => {
    if (typeof a === "string" && typeof b === "string") {
      const ta = microsOf(a);
      const tb = microsOf(b);
      if (ta !== null && tb !== null) return ta - tb;
      return a < b ? -1 : a > b ? 1 : 0;
    }
    return Number(a) - Number(b);
  };

  /** Split a PostgREST logic tree's items on top-level commas (not inside quotes or parentheses). */
  const splitTop = (s: string): string[] => {
    const out: string[] = [];
    let depth = 0;
    let quoted = false;
    let cur = "";
    for (const ch of s) {
      if (ch === '"') quoted = !quoted;
      if (!quoted && ch === "(") depth += 1;
      if (!quoted && ch === ")") depth -= 1;
      if (!quoted && depth === 0 && ch === ",") {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const parseCond = (term: string): Cond => {
    const group = /^(and|or)\(([\s\S]*)\)$/.exec(term);
    if (group) return { kind: group[1] as "and" | "or", parts: splitTop(group[2]!).map(parseCond) };
    const m = /^(\w+)\.(eq|neq|lt|lte|gt|gte)\.([\s\S]*)$/.exec(term);
    if (!m) throw new Error(`stand-in: PostgREST cannot parse "${term}"`);
    const raw = m[3]!;
    const value = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    return { kind: "op", column: m[1]!, op: m[2]!, value };
  };
  const columnsOfCond = (c: Cond): string[] => (c.kind === "op" ? [c.column] : c.parts.flatMap(columnsOfCond));
  const holds = (row: Row, c: Cond): boolean => {
    if (c.kind !== "op") return c.kind === "and" ? c.parts.every((p) => holds(row, p)) : c.parts.some((p) => holds(row, p));
    const v = row[c.column];
    if (v == null) return false; // SQL: a comparison with NULL is never true
    const d = compare(v, c.value);
    return { eq: d === 0, neq: d !== 0, lt: d < 0, lte: d <= 0, gt: d > 0, gte: d >= 0 }[c.op as "eq"];
  };
  const passes = (row: Row, f: Filter): boolean => {
    const v = row[f.column];
    switch (f.op) {
      case "eq":
        return v != null && compare(v, f.value) === 0;
      case "is":
        return f.value === null ? v == null : v === f.value;
      case "not.is":
        return f.value === null ? v != null : v !== f.value;
      case "in":
        return (f.value as unknown[]).includes(v);
      case "match":
        return typeof v === "string" && new RegExp(f.value as string).test(v);
      case "imatch":
        return typeof v === "string" && new RegExp(f.value as string, "i").test(v);
      default:
        throw new Error(`stand-in: no filter "${f.op}"`);
    }
  };

  const run = (q: Recorded) => {
    if (state.failOn === q.table) return { data: null, error: { message: "connection reset by peer" }, count: null };
    const fields = q.columns
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => {
        const m = /^(?:(\w+):)?(\w+)(?:->(\w+))?$/.exec(item);
        if (!m) throw new Error(`stand-in: cannot read select item "${item}"`);
        return { key: m[1] ?? m[3] ?? m[2]!, column: m[2]!, path: m[3] ?? null };
      });
    const conds = q.or.map((s) => ({ kind: "or" as const, parts: splitTop(s).map(parseCond) }));
    const used = [
      ...fields.map((f) => f.column),
      ...q.filters.map((f) => f.column),
      ...q.order.map(([c]) => c),
      ...conds.flatMap(columnsOfCond),
    ];
    const unknown = used.find((c) => !(SCHEMA[q.table] ?? []).includes(c));
    if (unknown) return { data: null, error: { message: `column ${q.table}.${unknown} does not exist` }, count: null };

    const matching = (state.tables[q.table] ?? []).filter(
      (row) => q.filters.every((f) => passes(row, f)) && conds.every((c) => holds(row, c)),
    );
    const sorted = [...matching].sort((a, b) => {
      for (const [column, ascending] of q.order) {
        const av = a[column];
        const bv = b[column];
        if (av == null || bv == null) {
          if (av == null && bv == null) continue;
          // Postgres: NULLS LAST ascending, NULLS FIRST descending.
          return (av == null ? 1 : -1) * (ascending ? 1 : -1);
        }
        const d = compare(av, bv);
        if (d !== 0) return ascending ? d : -d;
      }
      return 0;
    });
    const [from, to] = q.range ?? [0, (q.limit ?? Number.MAX_SAFE_INTEGER) - 1];
    const rows = sorted.slice(from, to + 1).slice(0, state.maxRows);
    const data = rows.map((row) =>
      Object.fromEntries(
        fields.map(({ key, column, path }) => {
          const value = row[column] ?? null;
          const picked = path === null ? value : value && typeof value === "object" ? ((value as Row)[path] ?? null) : null;
          return [key, structuredClone(picked)];
        }),
      ),
    );
    return { data, error: null, count: q.count ? matching.length : null };
  };

  const from = (client: Recorded["client"], table: string) => {
    const q: Recorded = { client, table, columns: "", count: null, filters: [], or: [], order: [], limit: null, range: null };
    state.queries.push(q);
    const add = (op: string, column: string, value: unknown) => {
      q.filters.push({ op, column, value });
      return builder;
    };
    const builder = {
      select(columns: string, opts?: { count?: string }) {
        q.columns = columns;
        q.count = opts?.count ?? null;
        return builder;
      },
      eq: (column: string, value: unknown) => add("eq", column, value),
      is: (column: string, value: unknown) => add("is", column, value),
      not: (column: string, op: string, value: unknown) => add(`not.${op}`, column, value),
      in: (column: string, values: readonly unknown[]) => add("in", column, [...values]),
      regexMatch: (column: string, pattern: string) => add("match", column, pattern),
      regexIMatch: (column: string, pattern: string) => add("imatch", column, pattern),
      or(filters: string) {
        q.or.push(filters);
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        q.order.push([column, opts?.ascending ?? true]);
        return builder;
      },
      limit(n: number) {
        q.limit = n;
        return builder;
      },
      range(a: number, b: number) {
        q.range = [a, b];
        return builder;
      },
      then<A, B>(onFulfilled?: (v: ReturnType<typeof run>) => A, onRejected?: (e: unknown) => B) {
        return new Promise<ReturnType<typeof run>>((resolve) => resolve(run(q))).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  return { state, from, SCHEMA };
});
fake.SCHEMA.piece_posts = migrationColumns();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        fake.state.authCalls += 1;
        return { data: { user: fake.state.user }, error: null };
      },
    },
    from: (table: string) => fake.from("session", table),
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (table: string) => fake.from("service", table) }),
}));

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../route")).GET;
}
type Get = Awaited<ReturnType<typeof load>>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const BASE = Date.UTC(2026, 10, 21, 12, 0, 0);
/** A time as PostgREST returns a `timestamptz`: microseconds and an offset. */
const stamp = (minutesAgo: number, micros = 0) =>
  `${new Date(BASE - minutesAgo * 60_000).toISOString().slice(0, 19)}.${String(micros).padStart(6, "0")}+00:00`;

const T10 = "2026-11-21T10:00:00.000Z";
const T11 = "2026-11-21T11:00:00.000Z";
const RUN_AT = "2026-11-21T10:30:00.123456+00:00";

const bare = (...blocks: unknown[]): unknown => blocks;
const stamped = (...blocks: unknown[]): unknown => ({ kcGenVersion: kcStamp().kcGenVersion, blocks });

const [HOOK_1, HOOK_2, HOOK_3] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine) as [string, string, string];
const HOOKS_BODY = stamped(runHeader("hooks"), ...MEAL_PREP_HOOKS, md("Hook one is your strongest opener."));

/** A text seal as `/api/tools/react` writes it (`pct` is a decoy: never the number). */
const textSeal = (stopPct: number, at = T10) => ({ pct: 70, band: "Mixed", at, population: population(stopPct) });

type RecordedRow = ResultRow & { id: string; heatmap: HeatmapPayload };
const recorded = (r: unknown) => r as RecordedRow;

/** The seal `/api/tools/test/card` writes for a finished run (step 9b), keyed by the analysis id. */
function videoSealOf(row: RecordedRow, at = T11) {
  const hold = row.heatmap.weighted_hook_score ?? row.heatmap.weighted_completion_pct ?? 0;
  const pct = Math.max(0, Math.min(100, Math.round(hold * 100)));
  return {
    pct,
    band: null,
    at,
    population: population(12),
    video: { analysisId: row.id, stopPct: pct, craftScore: null, heatmap: row.heatmap, videoSignals: null, verbatim: null },
  };
}

interface ThreadFixture {
  id: string;
  title?: string | null;
  updated?: string;
  pinned?: string | null;
  seals?: Record<string, unknown>;
  user?: string;
  type?: string;
  reading?: string | null;
}
function thread(p: ThreadFixture) {
  return {
    id: p.id,
    user_id: p.user ?? USER,
    type: p.type ?? "open",
    reading_id: p.reading ?? null,
    title: p.title === undefined ? `Chat ${p.id.slice(-4)}` : p.title,
    created_at: stamp(5000),
    updated_at: p.updated ?? stamp(0),
    pinned_at: p.pinned ?? null,
    sim_seals: p.seals ?? {},
    active_audience_id: null,
  };
}
type ThreadRow = ReturnType<typeof thread>;

let messageN = 0;
/** One stored message per body, `minutesAgo` apart from each other in the given order. */
function messagesOf(threadId: string, bodies: readonly unknown[], startMinutesAgo = 600) {
  return bodies.map((body, i) => ({
    id: uuid(0x100000 + (messageN += 1)),
    thread_id: threadId,
    role: i === 0 ? "user" : "assistant",
    body,
    created_at: stamp(startMinutesAgo - i),
  }));
}

/** A run's stored row: the recorded run, plus the heavy columns the endpoint must never read. */
function runRow(
  row: RecordedRow,
  p: {
    user?: string;
    deleted?: string | null;
    created?: string;
    frames?: Array<{ idx: number; keyframe_uri: string | null }>;
    path?: string | null;
  } = {},
) {
  return {
    id: row.id,
    user_id: p.user ?? USER,
    deleted_at: p.deleted ?? null,
    created_at: p.created ?? RUN_AT,
    input_mode: "video_upload",
    video_storage_path: p.path ?? null,
    heatmap: row.heatmap as HeatmapPayload | null,
    variants: { ...(row.variants ?? {}), ...(p.frames ? { filmstrip_segments: p.frames } : {}), craft: { video_signals: { pacing: 7 } } },
    personas: [{ id: "p1", reasoning: "PERSONA REASONING SECRET" }],
    verbatim: { transcript: "RUN TRANSCRIPT SECRET" },
    overall_score: 61 as number | null,
    engine_version: row.engine_version ?? "3.25.0",
  };
}

function seed(parts: {
  threads?: ThreadRow[];
  messages?: ReturnType<typeof messagesOf>;
  runs?: ReturnType<typeof runRow>[];
  posts?: PiecePostRow[];
}) {
  fake.state.tables.threads = parts.threads ?? [];
  fake.state.tables.messages = parts.messages ?? [];
  fake.state.tables.analysis_results = parts.runs ?? [];
  fake.state.tables.piece_posts = (parts.posts ?? []) as unknown as Record<string, unknown>[];
}

/**
 * A `ChatSummary` as the endpoint sends it: a text's link carries its result page's key (the one
 * function every link uses, `sealHashOf`), never the text; the stored path of the row's video; and no
 * posted piece.
 */
async function wire(s: ChatSummary, videoPath: string | null = null) {
  const sim =
    s.sim && s.sim.link.type === "text"
      ? { ...s.sim, link: { type: "text" as const, key: await sealHashOf(s.sim.link.text), as: s.sim.link.as } }
      : s.sim;
  return { ...s, sim, videoPath, posted: null };
}

/** What one chat's row must be: its fields and the real `chatSummaryOf` over its stored data. */
async function expected(
  t: ThreadRow,
  bodies: readonly unknown[],
  seals: SimSealMap = readSimSeals({ sim_seals: t.sim_seals as never }),
  videoPath: string | null = null,
) {
  return {
    id: t.id,
    title: t.title,
    updatedAt: t.updated_at,
    pinned: t.pinned_at !== null,
    summary: await wire(chatSummaryOf(bodies, seals), videoPath),
  };
}

const reads = (table: string) => fake.state.queries.filter((q) => q.table === table);
const filtersOf = (table: string, i = 0) => reads(table)[i]!.filters.map((f) => [f.op, f.column, f.value]);
const call = (GET: Get, query = "") => GET(new Request(`http://localhost/api/threads/library${query}`));
const pageOf = async (res: Response) => (await res.json()) as LibraryPage;
const cursorText = (next: string) => Buffer.from(next, "base64url").toString("utf8");

beforeEach(() => {
  fake.state.user = { id: USER };
  fake.state.authCalls = 0;
  fake.state.failOn = null;
  fake.state.maxRows = 1000;
  fake.state.queries = [];
  seed({});
});

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
  vi.restoreAllMocks();
});

// ─── 1. Who may ask ──────────────────────────────────────────────────────────

describe("GET /api/threads/library: who may ask", () => {
  it("flag off: not found, and nothing is read, not even the session", async () => {
    const GET = await load(false);
    seed({ threads: [thread({ id: uuid(1) })] });
    expect((await call(GET)).status).toBe(404);
    expect(fake.state.queries).toEqual([]);
    expect(fake.state.authCalls).toBe(0);
  });

  it("signed out: 401, nothing read", async () => {
    const GET = await load(true);
    fake.state.user = null;
    expect((await call(GET)).status).toBe(401);
    expect(fake.state.queries).toEqual([]);
  });

  it("a funnel visitor (anonymous): not found, nothing read (simulation numbers never reach a /go visitor)", async () => {
    const GET = await load(true);
    fake.state.user = { id: USER, is_anonymous: true };
    seed({ threads: [thread({ id: uuid(1) })] });
    expect((await call(GET)).status).toBe(404);
    expect(fake.state.queries).toEqual([]);
  });
});

// ─── 2–4. A page ─────────────────────────────────────────────────────────────

describe("a page of chats", () => {
  it("the creator's open chats with a title, pinned first, then newest first, each with its id, title, time, pin and summary", async () => {
    const GET = await load(true);
    const hooks = thread({ id: uuid(1), title: "Meal prep hooks", updated: stamp(1), seals: { [HOOK_1]: textSeal(30) } });
    const scriptT = thread({ id: uuid(2), title: "The AI script", updated: stamp(2), seals: { [SCRIPT_AI.props.openingBeatSeed!]: textSeal(41, T11) } });
    const talk = thread({ id: uuid(3), title: "Just talking", updated: stamp(3) });
    const ideas = thread({ id: uuid(4), title: "Study ideas", updated: stamp(5), pinned: stamp(900) });
    const empty = thread({ id: uuid(5), title: "Nothing yet", updated: stamp(8) });
    const bodies = {
      hooks: [bare(md("3 hooks for meal prep")), HOOKS_BODY],
      script: [bare(md("Write me a script")), stamped(runHeader("script"), SCRIPT_AI)],
      talk: [bare(md("How do I start a cooking channel?")), stamped(md("Start with one dish you make every week."))],
      ideas: [stamped(runHeader("ideas"), ...IDEAS_4)],
    };
    seed({
      threads: [ideas, empty, hooks, talk, scriptT],
      messages: [
        ...messagesOf(hooks.id, bodies.hooks),
        ...messagesOf(scriptT.id, bodies.script),
        ...messagesOf(talk.id, bodies.talk),
        ...messagesOf(ideas.id, bodies.ideas),
      ],
    });

    const res = await call(GET);
    expect(res.status).toBe(200);
    const page = await pageOf(res);
    expect(page).toEqual({
      chats: [
        // Pinned: first. The rest by last message.
        await expected(ideas, bodies.ideas),
        await expected(hooks, bodies.hooks),
        await expected(scriptT, bodies.script),
        await expected(talk, bodies.talk),
        await expected(empty, []),
      ],
      next: null,
    });
    // The summaries say what they should, so the equality above is not two empty objects agreeing.
    expect(page.chats[1]!.summary).toMatchObject({ stage: "simulated", lead: "hooks", sim: { number: 30, measure: "stop" } });
    expect(page.chats[0]!).toMatchObject({ pinned: true, summary: { stage: "draft", lead: "ideas", counts: { ideas: 4 } } });
    expect(page.chats[4]!.summary).toMatchObject({ stage: "chat", lead: "chat", sim: null });
  });

  it("only the caller's own open chats: the selects are scoped to them", async () => {
    const GET = await load(true);
    const mine = thread({ id: uuid(1), title: "Mine", updated: stamp(9) });
    seed({
      threads: [
        mine,
        thread({ id: uuid(2), title: "Mine", user: OTHER, updated: stamp(1) }),
        thread({ id: uuid(3), type: "archived", updated: stamp(2) }),
        thread({ id: uuid(4), reading: "reading-1", updated: stamp(3) }),
      ],
      messages: [
        ...messagesOf(mine.id, [HOOKS_BODY]),
        ...messagesOf(uuid(2), [HOOKS_BODY]),
        ...messagesOf(uuid(3), [HOOKS_BODY]),
        ...messagesOf(uuid(4), [HOOKS_BODY]),
      ],
    });

    const page = await pageOf(await call(GET));
    expect(page.chats.map((c) => c.id)).toEqual([mine.id]);

    // The first page reads twice: its chats by last message, and the pinned ones. Both are scoped.
    expect(reads("threads")).toHaveLength(2);
    for (const i of [0, 1]) {
      expect(filtersOf("threads", i)).toEqual(
        expect.arrayContaining([
          ["eq", "user_id", USER],
          ["eq", "type", "open"],
          ["is", "reading_id", null],
        ]),
      );
      // Without a search the title is not filtered on (untitled chats that hold something are listed).
      expect(filtersOf("threads", i).some(([, column]) => column === "title")).toBe(false);
    }
    // Messages carry no user column: they are read only for the thread ids the scoped select returned.
    expect(filtersOf("messages")).toEqual(expect.arrayContaining([["in", "thread_id", [mine.id]]]));
    // Every table read goes through the server's service client, as `listOpenThreads` reads.
    expect(fake.state.queries.every((q) => q.client === "service")).toBe(true);
  });

  it("the answer holds no stored audience, transcript, frames data or message text", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const unsealed = recorded(early);
    const MD = "Here is the markdown answer nobody else should read.";
    const hookSeal = {
      ...textSeal(30),
      personas: [{ archetype: "lurker", quote: "A PERSONA QUOTE SECRET" }],
      scrollQuote: "A SCROLL QUOTE SECRET",
    };
    const vSeal = videoSealOf(row);
    const videoSeal = { ...vSeal, video: { ...vSeal.video, verbatim: { segments: [{ idx: 0, spoken_text: "A VERBATIM LINE SECRET" }] } } };
    const hooks = thread({ id: uuid(1), title: "Meal prep", updated: stamp(1), seals: { [HOOK_1]: hookSeal } });
    const vid = thread({ id: uuid(2), title: "My take", updated: stamp(2), seals: { [row.id]: videoSeal } });
    const draftVid = thread({ id: uuid(3), title: "Second take", updated: stamp(3) });
    seed({
      threads: [hooks, vid, draftVid],
      messages: [
        ...messagesOf(hooks.id, [bare(md(MD)), HOOKS_BODY]),
        ...messagesOf(vid.id, [bare(md("take.mp4")), stamped(runHeader("test"), video(row.id))]),
        ...messagesOf(draftVid.id, [stamped(runHeader("test"), video(unsealed.id))]),
      ],
      runs: [runRow(row, { frames: [{ idx: 0, keyframe_uri: "/frames/a.jpg" }] }), runRow(unsealed)],
    });

    const res = await call(GET);
    expect(res.status).toBe(200);
    const text = await res.text();
    for (const heavy of ["population", "personas", "heatmap", "verbatim", "variants", "filmstrip", "segments", "weighted_curve"]) {
      expect(text).not.toContain(heavy);
    }
    for (const secret of [
      MD,
      "A PERSONA QUOTE SECRET",
      "A SCROLL QUOTE SECRET",
      "A VERBATIM LINE SECRET",
      "PERSONA REASONING SECRET",
      "RUN TRANSCRIPT SECRET",
      "Hook one is your strongest opener.",
      MEAL_PREP_HOOKS[0]!.props.mechanism,
      HOOK_1, // the simulated one too: its link carries the result page's key instead
      HOOK_2,
      HOOK_3,
    ]) {
      expect(text).not.toContain(secret);
    }
    expect((JSON.parse(text) as LibraryPage).chats[0]!.summary.sim?.link).toEqual({
      type: "text",
      key: await sealHashOf(HOOK_1),
      as: "hook",
    });
  });

  it("a text's link is its result page's key, as the page computes it: hook, idea, opening line, brought text", async () => {
    const GET = await load(true);
    const IDEA = IDEAS_4[1]!.props.title;
    const OPENER = SCRIPT_AI.props.openingBeatSeed!;
    const PASTED = "My whole pasted script about cheap lunches, line one. Line two, still mine. Line three.";
    const chats = [
      { t: thread({ id: uuid(1), updated: stamp(1), seals: { [HOOK_2]: textSeal(22) } }), body: HOOKS_BODY, text: HOOK_2, as: "hook" },
      { t: thread({ id: uuid(2), updated: stamp(2), seals: { [IDEA]: textSeal(44) } }), body: bare(...IDEAS_4), text: IDEA, as: "idea" },
      { t: thread({ id: uuid(3), updated: stamp(3), seals: { [OPENER]: textSeal(41) } }), body: bare(SCRIPT_AI), text: OPENER, as: "opening" },
      {
        t: thread({ id: uuid(4), updated: stamp(4), seals: { [PASTED]: textSeal(58) } }),
        body: stamped(broughtCard({ stimulus: `  ${PASTED} ` })),
        text: PASTED,
        as: "hook",
      },
    ];
    seed({ threads: chats.map((c) => c.t), messages: chats.flatMap((c) => messagesOf(c.t.id, [c.body])) });

    const res = await call(GET);
    const text = await res.text();
    const page = JSON.parse(text) as LibraryPage;
    for (const [i, c] of chats.entries()) {
      expect(page.chats[i]!.summary.sim?.link).toEqual({ type: "text", key: await sealHashOf(c.text), as: c.as });
      expect(text).not.toContain(c.text);
    }
    expect(text).not.toContain("pasted script");
  });
});

// ─── 5–6. Paging ─────────────────────────────────────────────────────────────

describe("paging", () => {
  it("31 chats: 30 and a next; the next page is the 31st; chats at the same time across the boundary are neither skipped nor repeated", async () => {
    const GET = await load(true);
    // 28 chats a minute apart, then three at one time on both sides of the boundary (id DESC: 700, 650, 600).
    const tie = stamp(40, 123456);
    const rows = [
      ...Array.from({ length: 28 }, (_, i) => thread({ id: uuid(i + 1), updated: stamp(i) })),
      thread({ id: uuid(600), updated: tie }),
      thread({ id: uuid(700), updated: tie }),
      thread({ id: uuid(650), updated: tie }),
    ];
    seed({ threads: [...rows].reverse() });

    const first = await pageOf(await call(GET));
    expect(first.chats).toHaveLength(30);
    expect(first.chats.slice(27).map((c) => c.id)).toEqual([uuid(28), uuid(700), uuid(650)]);
    expect(first.next).not.toBeNull();
    // The cursor carries the last row's stored time and id, as stored.
    expect(cursorText(first.next!)).toBe(`${tie}|${uuid(650)}`);
    expect(reads("threads")[0]!.limit).toBe(31);
    expect(reads("threads")[0]!.order).toEqual([
      ["updated_at", false],
      ["id", false],
    ]);

    const second = await pageOf(await call(GET, `?cursor=${first.next}`));
    expect(second.chats.map((c) => c.id)).toEqual([uuid(600)]);
    expect(second.next).toBeNull();

    const all = [...first.chats, ...second.chats].map((c) => c.id);
    expect(new Set(all).size).toBe(31);
    expect([...all].sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it("the cursor keeps the stored time to the microsecond (a millisecond time would skip the next chat)", async () => {
    const GET = await load(true);
    const rows = [
      ...Array.from({ length: 29 }, (_, i) => thread({ id: uuid(i + 1), updated: stamp(i) })),
      thread({ id: uuid(100), updated: stamp(60, 123457) }),
      thread({ id: uuid(200), updated: stamp(60, 123456) }),
    ];
    seed({ threads: rows });

    const first = await pageOf(await call(GET));
    expect(first.chats.at(-1)!.id).toBe(uuid(100));
    const second = await pageOf(await call(GET, `?cursor=${first.next}`));
    expect(second.chats.map((c) => c.id)).toEqual([uuid(200)]);
  });

  const enc = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  const T = stamp(3, 42);
  it.each([
    ["not base64url", "!!not-a-cursor!!"],
    ["base64url of anything", enc("garbage")],
    ["an id that is not a uuid", enc(`${T}|not-a-uuid`)],
    ["a time that is not a time", enc(`yesterday|${uuid(1)}`)],
    ["a month that does not exist", enc(`2026-13-01T10:00:00+00:00|${uuid(1)}`)],
    ["three parts", enc(`${T}|${uuid(1)}|${uuid(2)}`)],
    ["filter syntax in the time", enc(`${T}",id.gt."0|${uuid(1)}`)],
    ["a padded encoding", `${enc(`${T}|${uuid(1)}`)}==`],
    ["characters outside the alphabet", `${enc(`${T}|${uuid(1)}`)}$`],
  ])("a malformed cursor (%s): 400, and no chat is read", async (_case, cursor) => {
    const GET = await load(true);
    seed({ threads: [thread({ id: uuid(1) })] });
    const res = await call(GET, `?cursor=${encodeURIComponent(cursor)}`);
    expect(res.status).toBe(400);
    expect(reads("threads")).toEqual([]);
  });
});

// ─── 7. Search ───────────────────────────────────────────────────────────────

describe("search", () => {
  const titled = (...titles: string[]) => titles.map((title, i) => thread({ id: uuid(i + 1), title, updated: stamp(i) }));
  const titlesOf = (page: LibraryPage) => page.chats.map((c) => c.title);

  it("asks for titles containing the text, case-blind", async () => {
    const GET = await load(true);
    seed({ threads: titled("Meal prep on $5", "CHEAP MEALS", "Morning routine") });
    const page = await pageOf(await call(GET, "?q=meal"));
    expect(titlesOf(page)).toEqual(["Meal prep on $5", "CHEAP MEALS"]);
    expect(filtersOf("threads")).toContainEqual(["imatch", "title", "meal"]);
  });

  it.each([
    ["100%", "Is 100% worth it", "1000 ways to save"],
    ["a_b", "Plan a_b today", "Plan axb today"],
    ["c\\d", "Path c\\d here", "Path cd here"],
    ["5*3", "Is 5*3 fifteen", "Is 553 fifteen"],
    ["a.b", "Try a.b now", "Try axb now"],
    ["$5", "Meal prep on $5", "Meal prep on 5"],
    ["a|b", "Choose a|b", "Choose a"],
    ["(why", "Ask (why) twice", "Ask why twice"],
    ["[x]+", "Box [x]+ done", "Box xx done"],
  ])("%s is matched literally", async (q, hit, miss) => {
    const GET = await load(true);
    seed({ threads: titled(hit, miss) });
    const res = await call(GET, `?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
    expect(titlesOf(await pageOf(res))).toEqual([hit]);
  });

  it("a text longer than 80 characters is cut to 80 (by characters, not halves of one)", async () => {
    const GET = await load(true);
    const x80 = "x".repeat(80);
    seed({ threads: titled(x80, "x".repeat(79)) });
    const page = await pageOf(await call(GET, `?q=${x80}yz`));
    expect(titlesOf(page)).toEqual([x80]);
    expect(filtersOf("threads")).toContainEqual(["imatch", "title", x80]);

    fake.state.queries = [];
    await call(GET, `?q=${encodeURIComponent("🍝".repeat(81))}`);
    expect(filtersOf("threads")).toContainEqual(["imatch", "title", "🍝".repeat(80)]);
  });

  it.each([["?q="], ["?q=%20%20%09"], [""]])("a blank text (%s) is no filter", async (query) => {
    const GET = await load(true);
    seed({ threads: titled("Meal prep", "Morning routine") });
    const page = await pageOf(await call(GET, query));
    expect(titlesOf(page)).toEqual(["Meal prep", "Morning routine"]);
    expect(filtersOf("threads").some(([op]) => op === "imatch")).toBe(false);
  });
});

// ─── 8. Messages ─────────────────────────────────────────────────────────────

describe("the messages", () => {
  it("are read in one select for the page's chat ids, oldest first; a chat with no message is an empty chat", async () => {
    const GET = await load(true);
    const both = thread({ id: uuid(1), updated: stamp(1) });
    const none = thread({ id: uuid(2), updated: stamp(2) });
    const foreign = thread({ id: uuid(3), user: OTHER, updated: stamp(0) });
    const ordered = [bare(SCRIPT_AI), bare(md("Nice, and a remix?")), bare(REMIX_CAMERA)];
    // Stored out of order: the server must put them in time order (the last piece is the row's lead).
    seed({ threads: [both, none, foreign], messages: [...messagesOf(both.id, ordered)].reverse().concat(messagesOf(foreign.id, [HOOKS_BODY])) });

    const page = await pageOf(await call(GET));
    expect(page.chats).toEqual([await expected(both, ordered), await expected(none, [])]);
    expect(page.chats[0]!.summary.lead).toBe("remix");
    expect(page.chats[1]!.summary).toEqual(await wire(chatSummaryOf([], {})));

    expect(reads("messages")).toHaveLength(1);
    const q = reads("messages")[0]!;
    expect(q.columns.split(",").map((s) => s.trim())).toEqual(["thread_id", "body", "created_at"]);
    expect(q.filters).toEqual([{ op: "in", column: "thread_id", value: [both.id, none.id] }]);
    expect(q.order[0]).toEqual(["created_at", true]);
  });

  it("past the server's row cap the rest are still read (Supabase answers at most max_rows rows)", async () => {
    const GET = await load(true);
    fake.state.maxRows = 2;
    const chat = thread({ id: uuid(1) });
    const bodies = [bare(md("Hooks please")), HOOKS_BODY, bare(md("And a script")), bare(SCRIPT_AI), bare(REMIX_CAMERA)];
    seed({ threads: [chat], messages: messagesOf(chat.id, bodies) });

    const page = await pageOf(await call(GET));
    expect(page.chats).toEqual([await expected(chat, bodies)]);
    expect(page.chats[0]!.summary.counts).toMatchObject({ hooks: 3, scripts: 1, remixes: 1 });
    expect(reads("messages")).toHaveLength(3);
  });

  it("a page with no chat reads no message", async () => {
    const GET = await load(true);
    expect(await pageOf(await call(GET))).toEqual({ chats: [], next: null });
    expect(reads("messages")).toEqual([]);
    expect(reads("analysis_results")).toEqual([]);
    expect(reads("piece_posts")).toEqual([]);
  });
});

// ─── 9. Errors ───────────────────────────────────────────────────────────────

describe("a database error", () => {
  it.each([["threads"], ["messages"], ["analysis_results"], ["piece_posts"]])(
    "on %s: 500, the database's text in the log only, under the route's prefix",
    async (table) => {
      const GET = await load(true);
      const row = recorded(middle);
      const chat = thread({ id: uuid(1), seals: { [row.id]: videoSealOf(row) } });
      seed({ threads: [chat], messages: messagesOf(chat.id, [bare(video(row.id))]), runs: [runRow(row)] });
      fake.state.failOn = table;
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      const res = await call(GET);
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: "Server error" });
      expect(text).not.toContain("connection reset");
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]![0])).toMatch(/^\[threads\/library\]/);
      expect(log.mock.calls[0]!.join(" ")).toContain("connection reset by peer");
    },
  );
});

// ─── Extras A, B, C: the videos ──────────────────────────────────────────────

describe("a video's picture (extra A)", () => {
  it("is the first stored frame of the simulated video's run", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const chat = thread({ id: uuid(1), seals: { [row.id]: videoSealOf(row) } });
    const bodies = [bare(md("take.mp4")), stamped(runHeader("test"), video(row.id))];
    seed({
      threads: [chat],
      messages: messagesOf(chat.id, bodies),
      runs: [
        runRow(row, {
          frames: [
            { idx: 0, keyframe_uri: null },
            { idx: 2, keyframe_uri: "/frames/scene-3.jpg" },
            { idx: 1, keyframe_uri: "/frames/scene-2.jpg" },
          ],
        }),
      ],
    });

    const [only] = (await pageOf(await call(GET))).chats;
    const plain = (await expected(chat, bodies)).summary;
    expect(only!.summary).toEqual({ ...plain, frame: "/frames/scene-2.jpg" });
    expect(only!.summary.sim).toMatchObject({ kind: "video", measure: "end", number: headlineOf(audienceOf(row)!).value });
  });

  it("is none when the run stores no frame; the number is still shown", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const chat = thread({ id: uuid(1), seals: { [row.id]: videoSealOf(row) } });
    const bodies = [bare(video(row.id))];
    seed({ threads: [chat], messages: messagesOf(chat.id, bodies), runs: [runRow(row)] });

    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary).toEqual((await expected(chat, bodies)).summary);
    expect(only!.summary.frame).toBeNull();
    expect(only!.summary.sim?.number).toBe(headlineOf(audienceOf(row)!).value);
  });

  it("with nothing simulated, is the last video's stored frame", async () => {
    const GET = await load(true);
    const row = recorded(noGroups); // no audience the page can draw: no number
    const chat = thread({ id: uuid(1) });
    seed({
      threads: [chat],
      messages: messagesOf(chat.id, [bare(video(row.id))]),
      runs: [runRow(row, { frames: [{ idx: 0, keyframe_uri: "/frames/first.jpg" }] })],
    });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary).toMatchObject({ stage: "draft", lead: "video", sim: null, frame: "/frames/first.jpg" });
  });

  it("is none when the piece simulated last is a text", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const chat = thread({ id: uuid(1), seals: { [row.id]: videoSealOf(row, T10), [HOOK_1]: textSeal(30, T11) } });
    seed({
      threads: [chat],
      messages: messagesOf(chat.id, [bare(video(row.id)), HOOKS_BODY]),
      runs: [runRow(row, { frames: [{ idx: 0, keyframe_uri: "/frames/a.jpg" }] })],
    });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary).toMatchObject({ sim: { kind: "hooks" }, frame: null });
  });
});

describe("a deleted video (extra B)", () => {
  const row = recorded(middle);

  it("does not count: the hooks simulated earlier are the row's", async () => {
    const GET = await load(true);
    const seals = { [HOOK_1]: textSeal(30, T10), [row.id]: videoSealOf(row, T11) };
    const chat = thread({ id: uuid(1), seals });
    const bodies = [HOOKS_BODY, bare(md("take.mp4")), stamped(runHeader("test"), video(row.id))];
    seed({
      threads: [chat],
      messages: messagesOf(chat.id, bodies),
      runs: [runRow(row, { deleted: stamp(1), frames: [{ idx: 0, keyframe_uri: "/frames/a.jpg" }] })],
    });

    const [only] = (await pageOf(await call(GET))).chats;
    const withoutVideo = readSimSeals({ sim_seals: { [HOOK_1]: seals[HOOK_1] } as never });
    expect(only!.summary).toEqual(await wire(chatSummaryOf(bodies, withoutVideo)));
    expect(only!.summary).toMatchObject({ stage: "simulated", sim: { kind: "hooks", number: 30 }, frame: null });
  });

  it("with nothing else simulated, the chat is a draft", async () => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1), seals: { [row.id]: videoSealOf(row) } });
    seed({
      threads: [chat],
      messages: messagesOf(chat.id, [bare(video(row.id))]),
      runs: [runRow(row, { deleted: stamp(1), frames: [{ idx: 0, keyframe_uri: "/frames/a.jpg" }] })],
    });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary).toMatchObject({ stage: "draft", lead: "video", sim: null, frame: null });
  });

  it.each([
    // The foreign run has a stored video and frames of its own: neither may reach this caller.
    ["another creator's", () => [runRow(row, { user: OTHER, path: "other-user/clip.mp4", frames: [{ idx: 0, keyframe_uri: "frames/other-0.jpg" }] })]],
    ["not there at all", () => []],
  ])("a run that is %s counts as deleted", async (_case, runs) => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1), seals: { [row.id]: videoSealOf(row) } });
    seed({ threads: [chat], messages: messagesOf(chat.id, [bare(video(row.id))]), runs: runs() });
    const res = await call(GET);
    const [only] = (await pageOf(res.clone())).chats;
    expect(only!.summary).toMatchObject({ stage: "draft", sim: null, frame: null, videoPath: null });
    const text = await res.text();
    expect(text).not.toContain("other-user/clip.mp4");
    expect(text).not.toContain("frames/other-0.jpg");
    expect(filtersOf("analysis_results")).toEqual(expect.arrayContaining([["eq", "user_id", USER], ["in", "id", [row.id]]]));
  });
});

describe("a video with no seal (extra C)", () => {
  for (const [name, fixture] of Object.entries({ early, middle, holds, ending })) {
    it(`${name}: simulated, with the number its result page shows, at the run's time`, async () => {
      const GET = await load(true);
      const row = recorded(fixture);
      const chat = thread({ id: uuid(1) });
      seed({
        threads: [chat],
        messages: messagesOf(chat.id, [bare(md("take.mp4")), stamped(runHeader("test"), video(row.id))]),
        runs: [runRow(row, { created: RUN_AT })],
      });

      const [only] = (await pageOf(await call(GET))).chats;
      const page = videoStateOf(row);
      if (page.kind !== "result") throw new Error(`${name} has no result`);
      expect(only!.summary.stage).toBe("simulated");
      expect(only!.summary.lead).toBe("video");
      expect(only!.summary.sim).toEqual({
        number: headlineOf(audienceOf(row)!).value,
        measure: "end",
        at: RUN_AT,
        kind: "video",
        link: { type: "video", analysisId: row.id },
      });
      expect(only!.summary.sim!.number).toBe(page.model.headline.value);
    });
  }

  it.each([
    ["soft-deleted", () => [runRow(recorded(middle), { deleted: stamp(1) })]],
    ["another creator's", () => [runRow(recorded(middle), { user: OTHER })]],
    ["not there at all", () => []],
  ])("a run that is %s: a draft with no number", async (_case, runs) => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1) });
    seed({ threads: [chat], messages: messagesOf(chat.id, [bare(video(recorded(middle).id))]), runs: runs() });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary).toMatchObject({ stage: "draft", lead: "video", sim: null });
  });

  it("a run with no audience the page can draw, or still in flight without a heatmap: a draft", async () => {
    const GET = await load(true);
    const inFlight = { ...runRow(recorded(middle)), id: "run-in-flight", heatmap: null, overall_score: null, engine_version: "pending" };
    const a = thread({ id: uuid(1), updated: stamp(1) });
    const b = thread({ id: uuid(2), updated: stamp(2) });
    seed({
      threads: [a, b],
      messages: [...messagesOf(a.id, [bare(video(recorded(noGroups).id))]), ...messagesOf(b.id, [bare(video("run-in-flight"))])],
      runs: [runRow(recorded(noGroups)), inFlight],
    });
    const page = await pageOf(await call(GET));
    for (const chat of page.chats) expect(chat.summary).toMatchObject({ stage: "draft", lead: "video", sim: null });
  });

  it("is weighed against the chat's other simulations by time, like a sealed one", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const before = thread({ id: uuid(1), updated: stamp(1), seals: { [HOOK_1]: textSeal(30, "2026-11-21T10:00:00.000Z") } });
    const after = thread({ id: uuid(2), updated: stamp(2), seals: { [HOOK_1]: textSeal(30, "2026-11-21T11:00:00.000Z") } });
    seed({
      threads: [before, after],
      messages: [
        ...messagesOf(before.id, [HOOKS_BODY, bare(video(row.id))]),
        ...messagesOf(after.id, [HOOKS_BODY, bare(video(row.id))]),
      ],
      runs: [runRow(row, { created: RUN_AT })], // 10:30
    });
    const page = await pageOf(await call(GET));
    expect(page.chats[0]!.summary.sim?.kind).toBe("video");
    expect(page.chats[1]!.summary.sim?.kind).toBe("hooks");
  });
});

describe("the runs read (extras A to C)", () => {
  it("is one select for the whole page, scoped to the caller, and not made when the page has no video", async () => {
    const GET = await load(true);
    const sealedRow = recorded(middle);
    const unsealedRow = recorded(early);
    const a = thread({ id: uuid(1), updated: stamp(1), seals: { [sealedRow.id]: videoSealOf(sealedRow) } });
    const b = thread({ id: uuid(2), updated: stamp(2) });
    const c = thread({ id: uuid(3), updated: stamp(3) });
    seed({
      threads: [a, b, c],
      messages: [
        ...messagesOf(a.id, [bare(video(sealedRow.id))]),
        ...messagesOf(b.id, [bare(video(unsealedRow.id)), bare(video(sealedRow.id))]),
        ...messagesOf(c.id, [HOOKS_BODY]),
      ],
      runs: [runRow(sealedRow), runRow(unsealedRow)],
    });
    await call(GET);
    expect(reads("analysis_results")).toHaveLength(1);
    const q = reads("analysis_results")[0]!;
    expect(q.client).toBe("service");
    expect(q.filters).toHaveLength(2);
    expect(q.filters[0]).toEqual({ op: "eq", column: "user_id", value: USER });
    expect(q.filters[1]!.op).toBe("in");
    expect([...(q.filters[1]!.value as string[])].sort()).toEqual([sealedRow.id, unsealedRow.id].sort());

    fake.state.queries = [];
    const hooksOnly = thread({ id: uuid(4), seals: { [HOOK_1]: textSeal(30) } });
    seed({ threads: [hooksOnly], messages: messagesOf(hooksOnly.id, [HOOKS_BODY]) });
    await call(GET);
    expect(reads("analysis_results")).toEqual([]);
  });

  const columnsOf = () => reads("analysis_results")[0]!.columns.split(",").map((s) => s.trim());

  it("reads only whether a sealed video's run exists, its stored video path and its stored frames", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const chat = thread({ id: uuid(1), seals: { [row.id]: videoSealOf(row) } });
    seed({ threads: [chat], messages: messagesOf(chat.id, [bare(video(row.id))]), runs: [runRow(row)] });
    await call(GET);
    expect(columnsOf()).toEqual(["id", "deleted_at", "video_storage_path", "frames:variants->filmstrip_segments"]);
  });

  it("adds the run's time and heatmap only when a video on the page has no seal", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const chat = thread({ id: uuid(1) });
    seed({ threads: [chat], messages: messagesOf(chat.id, [bare(video(row.id))]), runs: [runRow(row)] });
    await call(GET);
    expect(columnsOf()).toEqual([
      "id",
      "deleted_at",
      "video_storage_path",
      "created_at",
      "heatmap",
      "frames:variants->filmstrip_segments",
    ]);
  });
});

// ─── Fix round 1: untitled chats ─────────────────────────────────────────────

describe("untitled chats (fix round 1, item 2)", () => {
  it("one that holds something is listed with no title: a simulated video, a blank title with draft hooks", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const videoOnly = thread({ id: uuid(1), title: null, updated: stamp(1) });
    const blank = thread({ id: uuid(2), title: "   ", updated: stamp(2) });
    seed({
      threads: [videoOnly, blank],
      messages: [...messagesOf(videoOnly.id, [bare(video(row.id))]), ...messagesOf(blank.id, [HOOKS_BODY])],
      runs: [runRow(row)],
    });
    const page = await pageOf(await call(GET));
    expect(page.chats.map((c) => [c.id, c.title, c.summary.stage])).toEqual([
      [videoOnly.id, null, "simulated"],
      [blank.id, null, "draft"],
    ]);
    expect(page.chats[0]!.summary.sim).toMatchObject({ kind: "video", measure: "end", number: headlineOf(audienceOf(row)!).value });
  });

  it("one that is a plain chat, or holds no message at all, is left out; a titled plain chat stays", async () => {
    const GET = await load(true);
    const talk = thread({ id: uuid(1), title: null, updated: stamp(1) });
    const empty = thread({ id: uuid(2), title: "", updated: stamp(2) });
    const titled = thread({ id: uuid(3), title: "Just talking", updated: stamp(3) });
    seed({
      threads: [talk, empty, titled],
      messages: [...messagesOf(talk.id, [bare(md("hi")), bare(md("Hello!"))]), ...messagesOf(titled.id, [bare(md("hi"))])],
    });
    const page = await pageOf(await call(GET));
    expect(page.chats.map((c) => c.id)).toEqual([titled.id]);
  });

  it("a page whose rows are all left out answers no chats, and its next", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const rows = Array.from({ length: 31 }, (_, i) => thread({ id: uuid(i + 1), title: null, updated: stamp(i) }));
    seed({ threads: rows, messages: messagesOf(rows[30]!.id, [bare(video(row.id))]), runs: [runRow(row)] });

    const first = await pageOf(await call(GET));
    expect(first.chats).toEqual([]);
    expect(first.next).not.toBeNull();
    expect(cursorText(first.next!)).toBe(`${rows[29]!.updated_at}|${rows[29]!.id}`);

    const second = await pageOf(await call(GET, `?cursor=${first.next}`));
    expect(second.chats.map((c) => [c.id, c.title])).toEqual([[rows[30]!.id, null]]);
    expect(second.next).toBeNull();
  });

  it("with a search the title must match as before, so an untitled chat cannot", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const untitled = thread({ id: uuid(1), title: null, updated: stamp(1) });
    const titled = thread({ id: uuid(2), title: "My take", updated: stamp(2) });
    seed({
      threads: [untitled, titled],
      messages: [...messagesOf(untitled.id, [bare(video(row.id))]), ...messagesOf(titled.id, [bare(video(row.id))])],
      runs: [runRow(row)],
    });
    const page = await pageOf(await call(GET, "?q=take"));
    expect(page.chats.map((c) => c.id)).toEqual([titled.id]);
    expect(filtersOf("threads")).toEqual(
      expect.arrayContaining([
        ["not.is", "title", null],
        ["match", "title", "\\S"],
        ["imatch", "title", "take"],
      ]),
    );
  });
});

// ─── Fix round 1: the video's stored path ────────────────────────────────────

describe("videoPath (fix round 1, item 3)", () => {
  const row = recorded(middle);
  const PATH = "uploads/nia-tests/take-1.mp4";
  const only = async (GET: Get) => (await pageOf(await call(GET))).chats[0]!;

  it("is the simulated video's stored path (sealed or not)", async () => {
    const GET = await load(true);
    const sealed = thread({ id: uuid(1), updated: stamp(1), seals: { [row.id]: videoSealOf(row) } });
    seed({ threads: [sealed], messages: messagesOf(sealed.id, [bare(video(row.id))]), runs: [runRow(row, { path: PATH })] });
    expect((await only(GET)).summary).toMatchObject({ stage: "simulated", videoPath: PATH });

    const unsealed = thread({ id: uuid(2), updated: stamp(1) });
    seed({ threads: [unsealed], messages: messagesOf(unsealed.id, [bare(video(row.id))]), runs: [runRow(row, { path: PATH })] });
    expect((await only(GET)).summary).toMatchObject({ stage: "simulated", videoPath: PATH });
  });

  it("with nothing simulated, is the chat's last video's path", async () => {
    const GET = await load(true);
    const first = { ...recorded(noGroups), id: "fixture-no-groups-a" };
    const last = { ...recorded(noGroups), id: "fixture-no-groups-b" };
    const chat = thread({ id: uuid(1) });
    seed({
      threads: [chat],
      messages: messagesOf(chat.id, [bare(video(first.id)), bare(video(last.id))]),
      runs: [runRow(first, { path: "uploads/nia-tests/first.mp4" }), runRow(last, { path: "uploads/nia-tests/last.mp4" })],
    });
    expect((await only(GET)).summary).toMatchObject({ stage: "draft", sim: null, videoPath: "uploads/nia-tests/last.mp4" });
  });

  it("is none without a video, for a deleted run, for a path the retention sweep nulled, and when a text was simulated last", async () => {
    const GET = await load(true);
    const noVideo = thread({ id: uuid(1), updated: stamp(1), seals: { [HOOK_1]: textSeal(30) } });
    const deleted = thread({ id: uuid(2), updated: stamp(2), seals: { [row.id]: videoSealOf(row) } });
    const swept = { ...recorded(early) };
    const sweptChat = thread({ id: uuid(3), updated: stamp(3), seals: { [swept.id]: videoSealOf(swept) } });
    const other = { ...recorded(holds) };
    const textLast = thread({ id: uuid(4), updated: stamp(4), seals: { [other.id]: videoSealOf(other, T10), [HOOK_1]: textSeal(30, T11) } });
    seed({
      threads: [noVideo, deleted, sweptChat, textLast],
      messages: [
        ...messagesOf(noVideo.id, [HOOKS_BODY]),
        ...messagesOf(deleted.id, [bare(video(row.id))]),
        ...messagesOf(sweptChat.id, [bare(video(swept.id))]),
        ...messagesOf(textLast.id, [bare(video(other.id)), HOOKS_BODY]),
      ],
      runs: [
        runRow(row, { path: PATH, deleted: stamp(1) }),
        runRow(swept, { path: null }),
        runRow(other, { path: "uploads/nia-tests/other.mp4" }),
      ],
    });
    const page = await pageOf(await call(GET));
    expect(page.chats.map((c) => [c.summary.stage, c.summary.videoPath])).toEqual([
      ["simulated", null],
      ["draft", null],
      ["simulated", null], // the number stays: only the file is gone
      ["simulated", null], // the row is the hooks'
    ]);
    expect(page.chats[2]!.summary.sim?.kind).toBe("video");
    expect(page.chats[3]!.summary.sim?.kind).toBe("hooks");
  });

  it("the answer still holds no heavy key with a path in it", async () => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1) });
    seed({ threads: [chat], messages: messagesOf(chat.id, [bare(video(row.id))]), runs: [runRow(row, { path: PATH })] });
    const text = await (await call(GET)).text();
    expect(text).toContain(PATH);
    for (const heavy of ["heatmap", "variants", "filmstrip", "personas", "verbatim", "population", "input_mode", "storage"]) {
      expect(text).not.toContain(heavy);
    }
  });
});

// ─── Pinned chats first ──────────────────────────────────────────────────────

describe("pinned chats first", () => {
  const MINUTE = 1;
  const DAY = 24 * 60 * MINUTE;
  const idsOf = (page: LibraryPage) => page.chats.map((c) => c.id);
  /** The pinned chats' read: the threads read that asks for `pinned_at` not null. */
  const pinnedReads = () => reads("threads").filter((q) => q.filters.some((f) => f.op === "not.is" && f.column === "pinned_at"));

  it("head the first page, most recently pinned first; then every other chat by last message, as before", async () => {
    const GET = await load(true);
    const newest = thread({ id: uuid(1), title: "Newest", updated: stamp(1) });
    const lastWeek = thread({ id: uuid(2), title: "Pinned last week", updated: stamp(2), pinned: stamp(7 * DAY) });
    const today = thread({ id: uuid(3), title: "Pinned today", updated: stamp(3), pinned: stamp(10) });
    const old = thread({ id: uuid(4), title: "Old, pinned yesterday", updated: stamp(90 * DAY), pinned: stamp(DAY) });
    const older = thread({ id: uuid(5), title: "Older", updated: stamp(4) });
    const bodies = { old: [HOOKS_BODY], newest: [bare(md("hi")), stamped(md("Hello!"))] };
    seed({
      threads: [newest, lastWeek, today, old, older],
      messages: [...messagesOf(old.id, bodies.old), ...messagesOf(newest.id, bodies.newest)],
    });

    const page = await pageOf(await call(GET));
    expect(page).toEqual({
      chats: [
        await expected(today, []),
        await expected(old, bodies.old),
        await expected(lastWeek, []),
        await expected(newest, bodies.newest),
        await expected(older, []),
      ],
      next: null,
    });
    // No heading, no divider: only each chat's own `pinned`.
    expect(page.chats.map((c) => c.pinned)).toEqual([true, true, true, false, false]);
    expect(page.chats[1]!.summary).toMatchObject({ stage: "draft", lead: "hooks", counts: { hooks: 3 } });

    // The pinned chats' read: the page's scope, `pinned_at` set, most recently pinned first, at most 30.
    const [pinned] = pinnedReads();
    expect(pinned).toMatchObject({ client: "service", columns: reads("threads")[0]!.columns, limit: 30 });
    expect(pinned!.filters.map((f) => [f.op, f.column, f.value])).toEqual([
      ["eq", "user_id", USER],
      ["eq", "type", "open"],
      ["is", "reading_id", null],
      ["not.is", "pinned_at", null],
    ]);
    expect(pinned!.order).toEqual([
      ["pinned_at", false],
      ["id", false],
    ]);
    // The read by last message is the page's own, unchanged.
    expect(reads("threads")[0]).toMatchObject({ limit: 31, order: [["updated_at", false], ["id", false]] });
  });

  it("a pinned chat older than the page's thirty is read and summarised with them: one read of the messages, one of the runs", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const recent = Array.from({ length: 31 }, (_, i) => thread({ id: uuid(i + 1), updated: stamp(i) }));
    const pinnedOld = thread({ id: uuid(900), title: "Last spring's take", updated: stamp(200 * DAY), pinned: stamp(5), seals: { [row.id]: videoSealOf(row) } });
    const bodies = [bare(md("take.mp4")), stamped(runHeader("test"), video(row.id))];
    seed({
      threads: [...recent, pinnedOld],
      messages: [...messagesOf(pinnedOld.id, bodies), ...messagesOf(recent[0]!.id, [HOOKS_BODY])],
      runs: [runRow(row, { frames: [{ idx: 0, keyframe_uri: "/frames/spring.jpg" }] })],
    });

    const page = await pageOf(await call(GET));
    expect(idsOf(page)).toEqual([pinnedOld.id, ...recent.slice(0, 30).map((t) => t.id)]);
    expect(page.chats[0]!.summary).toEqual({ ...(await expected(pinnedOld, bodies)).summary, frame: "/frames/spring.jpg" });
    expect(page.chats[0]!.summary.sim).toMatchObject({ kind: "video", number: headlineOf(audienceOf(row)!).value });
    // `next` is the page's own: its thirtieth chat by last message.
    expect(cursorText(page.next!)).toBe(`${recent[29]!.updated_at}|${recent[29]!.id}`);

    expect(reads("messages")).toHaveLength(1);
    expect(filtersOf("messages")).toEqual([["in", "thread_id", [pinnedOld.id, ...recent.slice(0, 30).map((t) => t.id)]]]);
    expect(reads("analysis_results")).toHaveLength(1);
    expect(filtersOf("analysis_results")).toEqual([
      ["eq", "user_id", USER],
      ["in", "id", [row.id]],
    ]);
  });

  it("a pinned chat that is also among the newest thirty is listed once, at the head; its messages and runs are read once", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    // Among the newest thirty, written to after b: by last message it would be second.
    const a = thread({ id: uuid(1), title: "Pinned, among the newest", updated: stamp(2), pinned: stamp(60), seals: { [row.id]: videoSealOf(row) } });
    const b = thread({ id: uuid(2), title: "Newest", updated: stamp(1) });
    const c = thread({ id: uuid(3), title: "Third", updated: stamp(3), seals: { [row.id]: videoSealOf(row) } });
    seed({
      threads: [a, b, c],
      messages: [...messagesOf(a.id, [bare(video(row.id))]), ...messagesOf(c.id, [bare(video(row.id))])],
      runs: [runRow(row)],
    });

    const page = await pageOf(await call(GET));
    expect(idsOf(page)).toEqual([a.id, b.id, c.id]);
    expect(page.chats.map((chat) => chat.pinned)).toEqual([true, false, false]);
    expect(filtersOf("messages")).toEqual([["in", "thread_id", [a.id, b.id, c.id]]]);
    expect(reads("messages")).toHaveLength(1);
    expect(reads("analysis_results")).toHaveLength(1);
    expect(filtersOf("analysis_results")).toEqual([
      ["eq", "user_id", USER],
      ["in", "id", [row.id]],
    ]);
  });

  it("the search applies to the pinned chats as to the others", async () => {
    const GET = await load(true);
    const mealPinned = thread({ id: uuid(1), title: "Meal prep on $5", updated: stamp(400 * DAY), pinned: stamp(10) });
    const morningPinned = thread({ id: uuid(2), title: "Morning routine", updated: stamp(2), pinned: stamp(5) });
    const untitledPinned = thread({ id: uuid(3), title: null, updated: stamp(3), pinned: stamp(1) });
    const cheap = thread({ id: uuid(4), title: "CHEAP MEALS", updated: stamp(4) });
    const row = recorded(middle);
    seed({ threads: [mealPinned, morningPinned, untitledPinned, cheap], messages: messagesOf(untitledPinned.id, [bare(video(row.id))]), runs: [runRow(row)] });

    const page = await pageOf(await call(GET, "?q=meal"));
    expect(page.chats.map((c) => [c.title, c.pinned])).toEqual([
      ["Meal prep on $5", true],
      ["CHEAP MEALS", false],
    ]);
    expect(pinnedReads()).toHaveLength(1);
    expect(pinnedReads()[0]!.filters.map((f) => [f.op, f.column, f.value])).toEqual(
      expect.arrayContaining([
        ["not.is", "title", null],
        ["match", "title", "\\S"],
        ["imatch", "title", "meal"],
        ["not.is", "pinned_at", null],
      ]),
    );
  });

  it("another creator's pinned chat, an archived one and a reading's are never read", async () => {
    const GET = await load(true);
    const mine = thread({ id: uuid(1), title: "Mine", updated: stamp(9) });
    seed({
      threads: [
        mine,
        thread({ id: uuid(2), title: "Mine", user: OTHER, updated: stamp(1), pinned: stamp(1) }),
        thread({ id: uuid(3), type: "archived", updated: stamp(2), pinned: stamp(2) }),
        thread({ id: uuid(4), reading: "reading-1", updated: stamp(3), pinned: stamp(3) }),
      ],
      messages: [...messagesOf(uuid(2), [HOOKS_BODY]), ...messagesOf(uuid(3), [HOOKS_BODY]), ...messagesOf(uuid(4), [HOOKS_BODY])],
    });

    const res = await call(GET);
    const page = await pageOf(res);
    expect(idsOf(page)).toEqual([mine.id]);
    expect(pinnedReads()).toHaveLength(1);
    for (const q of reads("threads")) {
      expect(q.client).toBe("service");
      expect(q.filters.map((f) => [f.op, f.column, f.value])).toEqual(
        expect.arrayContaining([
          ["eq", "user_id", USER],
          ["eq", "type", "open"],
          ["is", "reading_id", null],
        ]),
      );
    }
    // Nothing of theirs is read: their messages are never asked for.
    expect(filtersOf("messages")).toEqual([["in", "thread_id", [mine.id]]]);
  });

  it("more pins than the cap: the thirty pinned last head the first page, the others keep their place by last message; no chat is lost over the pages", async () => {
    const GET = await load(true);
    // Forty chats, a minute apart (1 newest). 6 to 40 pinned, 40 most recently: 40..11 make the
    // first page's pinned thirty; 6..10 are pinned past the cap.
    const rows = Array.from({ length: 40 }, (_, i) =>
      thread({ id: uuid(i + 1), updated: stamp(i + 1), pinned: i + 1 >= 6 ? stamp(200 - (i + 1)) : null }),
    );
    const id = (n: number) => uuid(n);
    const range = (from: number, to: number) =>
      from <= to ? Array.from({ length: to - from + 1 }, (_, i) => id(from + i)) : Array.from({ length: from - to + 1 }, (_, i) => id(from - i));
    seed({ threads: rows });

    const first = await pageOf(await call(GET));
    expect(idsOf(first)).toEqual([...range(40, 11), ...range(1, 10)]);
    expect(first.chats.map((c) => c.pinned)).toEqual([...Array(30).fill(true), ...Array(5).fill(false), ...Array(5).fill(true)]);
    expect(pinnedReads()[0]!.limit).toBe(30);
    // Its `next` is its thirtieth chat by last message, though that chat heads the page as pinned.
    expect(cursorText(first.next!)).toBe(`${rows[29]!.updated_at}|${rows[29]!.id}`);

    fake.state.queries = [];
    const second = await pageOf(await call(GET, `?cursor=${first.next}`));
    // A later page is the page it always was: one read, by last message, a pinned chat in its place.
    expect(reads("threads")).toHaveLength(1);
    expect(pinnedReads()).toEqual([]);
    expect(idsOf(second)).toEqual(range(31, 40));
    expect(second.chats.every((c) => c.pinned)).toBe(true);
    expect(second.next).toBeNull();

    // The screen drops repeats: every chat, once.
    const seen = new Set([...idsOf(first), ...idsOf(second)]);
    expect([...seen].sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it("next is unchanged: the thirtieth chat by last message, also when it heads the page as pinned; the next page goes on from it", async () => {
    const GET = await load(true);
    const rows = Array.from({ length: 31 }, (_, i) => thread({ id: uuid(i + 1), updated: stamp(i + 1), pinned: i === 29 ? stamp(1) : null }));
    seed({ threads: rows });

    const first = await pageOf(await call(GET));
    expect(idsOf(first)).toEqual([rows[29]!.id, ...rows.slice(0, 29).map((r) => r.id)]);
    expect(cursorText(first.next!)).toBe(`${rows[29]!.updated_at}|${rows[29]!.id}`);
    const second = await pageOf(await call(GET, `?cursor=${first.next}`));
    expect(idsOf(second)).toEqual([rows[30]!.id]);
    expect(second.next).toBeNull();
  });

  it("an untitled pinned chat with nothing in it is still left out; one that holds something heads the page", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const talk = thread({ id: uuid(1), title: null, updated: stamp(1), pinned: stamp(1) });
    const take = thread({ id: uuid(2), title: null, updated: stamp(50 * DAY), pinned: stamp(2) });
    const titled = thread({ id: uuid(3), title: "Just talking", updated: stamp(3) });
    seed({
      threads: [talk, take, titled],
      messages: [...messagesOf(talk.id, [bare(md("hi")), bare(md("Hello!"))]), ...messagesOf(take.id, [bare(video(row.id))])],
      runs: [runRow(row)],
    });
    const page = await pageOf(await call(GET));
    expect(page.chats.map((c) => [c.id, c.title, c.pinned])).toEqual([
      [take.id, null, true],
      [titled.id, "Just talking", false],
    ]);
  });
});

// ─── After posting (plan 2026-11-24-after-posting, Task 2) ───────────────────

describe("posted pieces", () => {
  const NOW = new Date(BASE);
  const PASTED = "https://vm.tiktok.com/ZMmadeupLibrary/";
  /** A stored `piece_posts` row, read once (12.4K views so far), times as PostgREST writes them. */
  const postRow = (n: number, over: Partial<PiecePostRow> = {}): PiecePostRow => ({
    id: uuid(0x900 + n),
    user_id: USER,
    thread_id: uuid(1),
    piece_key: "VvK87Bp1dO",
    piece_kind: "hooks",
    said_number: 30,
    said_measure: "stop",
    said_at: stamp(24 * 60),
    platform: "tiktok",
    post_url: PASTED,
    post_id: "7301444403323456789",
    handle: "nia.cooks",
    posted_at: stamp(30 * 60),
    views: 12_400,
    likes: 2_100,
    comments: 84,
    shares: 310,
    saves: 420,
    read_at: stamp(60),
    reads: [{ at: stamp(60), views: 12_400, likes: 2_100, comments: 84, shares: 310, saves: 420 }],
    settled_at: null,
    usual_views: null,
    usual_posts: null,
    attempts: 0,
    read_error: null,
    last_attempt_at: stamp(60),
    removed_at: null,
    created_at: stamp(20 * 60),
    updated_at: stamp(60),
    ...over,
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a chat with a posted piece: stage posted and its posted piece as it leaves the server; the gauge is that piece, as Maven said it", async () => {
    const GET = await load(true);
    const hooks = thread({ id: uuid(1), title: "Meal prep hooks", updated: stamp(1), seals: { [HOOK_1]: textSeal(30) } });
    const talk = thread({ id: uuid(2), title: "Just talking", updated: stamp(2) });
    const bodies = [HOOKS_BODY];
    const post = postRow(1, { piece_key: await sealHashOf(HOOK_1) });
    seed({ threads: [hooks, talk], messages: messagesOf(hooks.id, bodies), posts: [post] });

    const page = await pageOf(await call(GET));
    const plain = await expected(hooks, bodies);
    expect(page.chats[0]).toEqual({
      ...plain,
      summary: {
        ...plain.summary,
        stage: "posted",
        sim: { number: 30, measure: "stop", at: post.said_at, kind: "hooks", link: { type: "text", key: post.piece_key, as: "hook" } },
        posted: toPosted(post, NOW),
      },
    });
    expect(page.chats[0]!.summary.posted).toMatchObject({ state: "so-far", numbers: { views: 12_400 }, href: "https://www.tiktok.com/@nia.cooks/video/7301444403323456789" });
    expect(page.chats[1]).toEqual(await expected(talk, []));
    expect(page.chats[1]!.summary.posted).toBeNull();
  });

  it("three simulated hooks and the first one posted: the row's number and link are the posted hook's (ruling 31)", async () => {
    const GET = await load(true);
    const seals = { [HOOK_1]: textSeal(30, T10), [HOOK_2]: textSeal(22, T10), [HOOK_3]: textSeal(67, T11) };
    const chat = thread({ id: uuid(1), title: "Meal prep hooks", seals });
    const key = await sealHashOf(HOOK_1);
    const post = postRow(1, { piece_key: key, said_number: 30 });
    seed({ threads: [chat], messages: messagesOf(chat.id, [HOOKS_BODY]), posts: [post] });

    const [only] = (await pageOf(await call(GET))).chats;
    // Without the post the row would be hook 3's (simulated last).
    expect(chatSummaryOf([HOOKS_BODY], readSimSeals({ sim_seals: seals as never })).sim?.number).toBe(67);
    expect(only!.summary.sim).toEqual({ number: 30, measure: "stop", at: post.said_at, kind: "hooks", link: { type: "text", key, as: "hook" } });
    expect(only!.summary.sim?.link).toMatchObject({ key: only!.summary.posted!.pieceKey });
    // The chat's own counts and lead stay.
    expect(only!.summary).toMatchObject({ counts: { hooks: 3 }, lead: "hooks", stage: "posted" });
  });

  it("a posted piece simulated again later keeps the number Maven said when the link was added", async () => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1), seals: { [HOOK_1]: textSeal(55, T11) } });
    const post = postRow(1, { piece_key: await sealHashOf(HOOK_1), said_number: 30, said_at: stamp(24 * 60) });
    seed({ threads: [chat], messages: messagesOf(chat.id, [HOOKS_BODY]), posts: [post] });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary.sim).toMatchObject({ number: 30, at: post.said_at });
  });

  it("a posted idea links to its result page as an idea; without a said time, the link's time", async () => {
    const GET = await load(true);
    const IDEA = IDEAS_4[1]!.props.title;
    const chat = thread({ id: uuid(1), seals: { [IDEA]: textSeal(44) } });
    const post = postRow(1, { piece_key: await sealHashOf(IDEA), piece_kind: "ideas", said_number: 44, said_at: null });
    seed({ threads: [chat], messages: messagesOf(chat.id, [bare(...IDEAS_4)]), posts: [post] });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary.sim).toEqual({ number: 44, measure: "stop", at: post.created_at, kind: "ideas", link: { type: "text", key: post.piece_key, as: "idea" } });
  });

  it("a posted video is the row's video: watch to the end, its analysis id", async () => {
    const GET = await load(true);
    const row = recorded(middle);
    const chat = thread({ id: uuid(1), seals: { [HOOK_1]: textSeal(30, T11), [row.id]: videoSealOf(row, T10) } });
    const post = postRow(1, { piece_key: row.id, piece_kind: "video", said_number: 41, said_measure: "end" });
    seed({ threads: [chat], messages: messagesOf(chat.id, [bare(video(row.id)), HOOKS_BODY]), runs: [runRow(row)], posts: [post] });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary.sim).toEqual({ number: 41, measure: "end", at: post.said_at, kind: "video", link: { type: "video", analysisId: row.id } });
  });

  it("a chat with no post is byte for byte as before", async () => {
    const GET = await load(true);
    const seals = { [HOOK_1]: textSeal(30, T10), [HOOK_3]: textSeal(67, T11) };
    const posted = thread({ id: uuid(1), updated: stamp(1), seals });
    const plain = thread({ id: uuid(2), updated: stamp(2), seals });
    seed({
      threads: [posted, plain],
      messages: [...messagesOf(posted.id, [HOOKS_BODY]), ...messagesOf(plain.id, [HOOKS_BODY])],
      posts: [postRow(1, { thread_id: posted.id, piece_key: await sealHashOf(HOOK_1) })],
    });
    const text = await (await call(GET)).text();
    const page = JSON.parse(text) as LibraryPage;
    expect(JSON.stringify(page.chats[1])).toBe(JSON.stringify(await expected(plain, [HOOKS_BODY])));
  });

  it("is read in one select for the page's chats, scoped to the caller, through the service client", async () => {
    const GET = await load(true);
    const pinned = thread({ id: uuid(3), updated: stamp(9), pinned: stamp(5) });
    const a = thread({ id: uuid(1), updated: stamp(1) });
    const b = thread({ id: uuid(2), updated: stamp(2) });
    seed({ threads: [a, b, pinned], posts: [postRow(1, { thread_id: a.id })] });
    await call(GET);
    expect(reads("piece_posts")).toHaveLength(1);
    const q = reads("piece_posts")[0]!;
    expect(q.client).toBe("service");
    expect(q.columns).toBe(PIECE_POST_SELECT);
    expect(q.filters.map((f) => [f.op, f.column, f.value])).toEqual([
      ["eq", "user_id", USER],
      ["is", "removed_at", null],
      ["in", "thread_id", [pinned.id, a.id, b.id]],
    ]);
  });

  it("two posted pieces in one chat: the one linked last, with its own number and link", async () => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1), seals: { [HOOK_1]: textSeal(30, T10), [HOOK_2]: textSeal(22, T11) } });
    // Hook 2 linked first, hook 1 last: the row is hook 1's, though hook 2 was simulated last.
    const older = postRow(1, { created_at: stamp(50 * 60), piece_key: await sealHashOf(HOOK_2), said_number: 22, views: 100 });
    const newer = postRow(2, { created_at: stamp(5 * 60), piece_key: await sealHashOf(HOOK_1), said_number: 30, views: 200 });
    seed({ threads: [chat], messages: messagesOf(chat.id, [HOOKS_BODY]), posts: [older, newer] });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary.posted).toEqual(toPosted(newer, NOW));
    expect(only!.summary.stage).toBe("posted");
    // The pairing: the gauge, its link and the post are one piece.
    expect(only!.summary.sim).toMatchObject({ number: 30, link: { type: "text", key: newer.piece_key, as: "hook" } });
    expect(only!.summary.sim?.link).toMatchObject({ key: only!.summary.posted!.pieceKey });
  });

  it("a removed link, and another person's row under the caller's chat id, make no chat posted", async () => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1), seals: { [HOOK_1]: textSeal(30) } });
    seed({
      threads: [chat],
      messages: messagesOf(chat.id, [HOOKS_BODY]),
      posts: [postRow(1, { removed_at: stamp(10) }), postRow(2, { user_id: OTHER })],
    });
    const [only] = (await pageOf(await call(GET))).chats;
    expect(only!.summary).toMatchObject({ stage: "simulated", posted: null });
  });

  it("every state of a posted piece makes the chat posted: reading, so far, final, not read", async () => {
    const GET = await load(true);
    const rows = [
      postRow(1, { thread_id: uuid(1), views: null, likes: null, comments: null, shares: null, saves: null, read_at: null, post_id: null, handle: null, posted_at: null, reads: [] }),
      postRow(2, { thread_id: uuid(2) }),
      postRow(3, { thread_id: uuid(3), settled_at: stamp(10), usual_views: 6_000, usual_posts: 9 }),
      postRow(4, { thread_id: uuid(4), read_error: "gone", attempts: 1 }),
    ];
    seed({ threads: [1, 2, 3, 4].map((n) => thread({ id: uuid(n), updated: stamp(n) })), posts: rows });
    const page = await pageOf(await call(GET));
    expect(page.chats.map((c) => [c.summary.stage, c.summary.posted?.state])).toEqual([
      ["posted", "reading"],
      ["posted", "so-far"],
      ["posted", "final"],
      ["posted", "unread"],
    ]);
    expect(page.chats[2]!.summary.posted?.usual).toEqual({ ratio: 2.1, tone: "above" });
  });

  it("the answer never holds the pasted link, the kept reads or the stored row's other columns", async () => {
    const GET = await load(true);
    const chat = thread({ id: uuid(1), seals: { [HOOK_1]: textSeal(30) } });
    seed({ threads: [chat], messages: messagesOf(chat.id, [HOOKS_BODY]), posts: [postRow(1)] });
    const text = await (await call(GET)).text();
    for (const stored of ["ZMmadeupLibrary", "vm.tiktok.com", "reads", "post_url", "user_id", "usual_views", "read_error"]) {
      expect(text).not.toContain(stored);
    }
  });
});
