/**
 * What Maven said about a piece (`pieceSaid`, plan 2026-11-24-after-posting, Task 2). Real: the function,
 * the seal lookup the hook result page uses (`textSealOfKey`), `stopNumberOf`, the thread's pieces
 * (`piecesOf`) and the video page's number (`audienceOf`, `headlineOf`) over RECORDED runs. Stood in for:
 * the database (`fake-tables.ts`). Every id is made up.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  IDEAS_4,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  broughtCard,
  md,
  population,
  runHeader,
} from "@/components/thread-next/__tests__/fixtures/answers";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import noGroups from "@/lib/result/__tests__/fixtures/no-groups.json";
import { audienceOf } from "@/lib/result/curve";
import { headlineOf } from "@/lib/result/headline";
import type { ResultRow } from "@/lib/result/types";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { pieceSaid } from "../piece-said";
import { fakeTables } from "./fake-tables";
import { CHAT, CHAT_2, OTHER, USER } from "./fixtures";

const AT = "2026-11-21T10:00:00.000Z";
const RUN_AT = "2026-11-21T10:30:00.123456+00:00";
const [HOOK_1, HOOK_2] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine) as [string, string];
const IDEA = IDEAS_4[1]!.props.title;
const OPENER = SCRIPT_AI.props.openingBeatSeed!;
const ADAPTED = REMIX_CAMERA.props.adaptedHook;
const BROUGHT = "My own hook about cheap lunches, made up for this test";

const textSeal = (stopPct: number, at = AT) => ({ pct: 70, band: "Mixed", at, population: population(stopPct) });

let db: ReturnType<typeof fakeTables>;
let n = 0;
const thread = (p: { id: string; user?: string; updated?: string; seals?: Record<string, unknown>; type?: string }) => ({
  id: p.id,
  user_id: p.user ?? USER,
  type: p.type ?? "open",
  reading_id: null,
  title: "A chat",
  created_at: "2026-11-20T09:00:00.000000+00:00",
  updated_at: p.updated ?? "2026-11-21T12:00:00.000000+00:00",
  pinned_at: null,
  sim_seals: p.seals ?? {},
  active_audience_id: null,
});
const messages = (threadId: string, ...bodies: unknown[]) =>
  bodies.map((body, i) => ({
    id: `00000000-0000-4000-8000-${(n += 1).toString(16).padStart(12, "0")}`,
    thread_id: threadId,
    role: i % 2 === 0 ? "user" : "assistant",
    body,
    created_at: new Date(Date.parse("2026-11-21T09:00:00Z") + n * 60_000).toISOString(),
  }));

type RecordedRow = ResultRow & { id: string };
const run = (row: RecordedRow, p: { user?: string; deleted?: string | null; created?: string; heatmap?: unknown; engine?: string; score?: number | null } = {}) => ({
  id: row.id,
  user_id: p.user ?? USER,
  deleted_at: p.deleted ?? null,
  created_at: p.created ?? RUN_AT,
  heatmap: p.heatmap === undefined ? (row.heatmap ?? null) : p.heatmap,
  variants: row.variants ?? null,
  personas: [{ id: "p1", reasoning: "PERSONA REASONING SECRET" }],
  verbatim: { transcript: "RUN TRANSCRIPT SECRET" },
  overall_score: p.score === undefined ? 61 : p.score,
  engine_version: p.engine ?? "3.25.0",
  input_mode: "video_upload",
  video_storage_path: null,
});
const MIDDLE = middle as unknown as RecordedRow;
const NO_GROUPS = noGroups as unknown as RecordedRow;
const videoSeal = (row: RecordedRow) => ({ pct: 46, band: null, at: AT, video: { analysisId: row.id, stopPct: 46, craftScore: null, heatmap: row.heatmap, videoSignals: null, verbatim: null } });

const callsTo = (table: string) => db.state.calls.filter((c) => c.table === table);
const filtersOf = (table: string, i = 0) => callsTo(table)[i]!.filters.map((f) => [f.op, f.column, f.value]);

beforeEach(() => {
  db = fakeTables();
});

// ─── Text ────────────────────────────────────────────────────────────────────

describe("a text piece", () => {
  it("is what its result page shows: the seal's would-stop number and time, the chat, the key, the card's kind", async () => {
    const seals = { [HOOK_1]: textSeal(30), [HOOK_2]: textSeal(22, "2026-11-21T11:00:00.000Z") };
    db.state.tables.threads = [thread({ id: CHAT, seals })];
    db.state.tables.messages = messages(CHAT, [md("3 hooks please")], [runHeader("hooks"), ...MEAL_PREP_HOOKS]);
    const key = await sealHashOf(HOOK_2);

    expect(await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key })).toEqual({
      found: true,
      piece: { threadId: CHAT, pieceKey: key, pieceKind: "hooks", said: { number: stopNumberOf(seals[HOOK_2]), measure: "stop", at: "2026-11-21T11:00:00.000Z" } },
    });
    expect(stopNumberOf(seals[HOOK_2])).toBe(22);
  });

  it.each([
    ["an idea", IDEA, [...IDEAS_4], "ideas"],
    ["a script's opening line", OPENER, [SCRIPT_AI], "script"],
    ["a remix's adapted hook", ADAPTED, [REMIX_CAMERA], "remix"],
    ["brought text", BROUGHT, [broughtCard({ stimulus: `  ${BROUGHT} ` })], "text"],
  ])("%s has its card's kind", async (_case, text, blocks, kind) => {
    db.state.tables.threads = [thread({ id: CHAT, seals: { [text]: textSeal(41) } })];
    db.state.tables.messages = messages(CHAT, blocks);
    const result = await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(text) });
    expect(result).toMatchObject({ found: true, piece: { pieceKind: kind, said: { number: 41, measure: "stop" } } });
  });

  it("a seal no card of the chat holds is brought text", async () => {
    db.state.tables.threads = [thread({ id: CHAT, seals: { [BROUGHT]: textSeal(41) } })];
    const result = await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(BROUGHT) });
    expect(result).toMatchObject({ found: true, piece: { pieceKind: "text" } });
  });

  it("an archived chat's piece is still its creator's (as its result page)", async () => {
    db.state.tables.threads = [thread({ id: CHAT, type: "archived", seals: { [HOOK_1]: textSeal(30) } })];
    db.state.tables.messages = messages(CHAT, [runHeader("hooks"), ...MEAL_PREP_HOOKS]);
    expect(await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(HOOK_1) })).toMatchObject({ found: true });
  });

  it("another person's chat is not found, and none of its messages is read", async () => {
    db.state.tables.threads = [thread({ id: CHAT, user: OTHER, seals: { [HOOK_1]: textSeal(30) } })];
    db.state.tables.messages = messages(CHAT, [runHeader("hooks"), ...MEAL_PREP_HOOKS]);
    expect(await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(HOOK_1) })).toEqual({ found: false, why: "not_found" });
    expect(filtersOf("threads")).toEqual(expect.arrayContaining([["eq", "id", CHAT], ["eq", "user_id", USER]]));
    expect(callsTo("messages")).toEqual([]);
  });

  it("the messages are read only for the chat the owned read returned", async () => {
    db.state.tables.threads = [thread({ id: CHAT, seals: { [HOOK_1]: textSeal(30) } })];
    db.state.tables.messages = messages(CHAT, [runHeader("hooks"), ...MEAL_PREP_HOOKS]);
    await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(HOOK_1) });
    expect(filtersOf("messages")).toEqual([["eq", "thread_id", CHAT]]);
  });

  it("an unknown key, a seal without a number and a video seal are not found, as on the result page", async () => {
    db.state.tables.threads = [
      thread({ id: CHAT, seals: { [HOOK_1]: { pct: 60, band: null, at: AT }, [MIDDLE.id]: videoSeal(MIDDLE), [HOOK_2]: textSeal(22) } }),
    ];
    for (const text of [HOOK_1, MIDDLE.id, "never simulated"]) {
      expect(await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(text) })).toEqual({ found: false, why: "not_found" });
    }
  });

  it.each([
    ["a chat id that is not one", "not-a-chat", "VvK87Bp1dO"],
    ["a key that is not one", CHAT, "short"],
  ])("%s: not found, nothing read", async (_case, threadId, key) => {
    expect(await pieceSaid(db.client, USER, { kind: "text", threadId, key })).toEqual({ found: false, why: "not_found" });
    expect(db.state.calls).toEqual([]);
  });

  it("a seal time that is not a time is stored as no time", async () => {
    db.state.tables.threads = [thread({ id: CHAT, seals: { [HOOK_1]: textSeal(30, "yesterday") } })];
    const result = await pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(HOOK_1) });
    expect(result).toMatchObject({ found: true, piece: { said: { at: null } } });
  });

  it.each([["threads"], ["messages"]])("a database error on %s throws, with the database's text", async (table) => {
    db.state.tables.threads = [thread({ id: CHAT, seals: { [HOOK_1]: textSeal(30) } })];
    db.state.failOn = table;
    await expect(pieceSaid(db.client, USER, { kind: "text", threadId: CHAT, key: await sealHashOf(HOOK_1) })).rejects.toThrow("connection reset by peer");
  });
});

// ─── Video ───────────────────────────────────────────────────────────────────

describe("a video", () => {
  it("is the number its result page shows (watch to the end), the run's time, and the chat that holds it", async () => {
    db.state.tables.analysis_results = [run(MIDDLE)];
    db.state.tables.threads = [thread({ id: CHAT, seals: { [MIDDLE.id]: videoSeal(MIDDLE) } }), thread({ id: CHAT_2 })];
    const result = await pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id });
    expect(result).toEqual({
      found: true,
      piece: { threadId: CHAT, pieceKey: MIDDLE.id, pieceKind: "video", said: { number: headlineOf(audienceOf(MIDDLE)!).value, measure: "end", at: RUN_AT } },
    });
  });

  it("held by no chat: no chat", async () => {
    db.state.tables.analysis_results = [run(MIDDLE)];
    db.state.tables.threads = [thread({ id: CHAT, seals: { [HOOK_1]: textSeal(30) } })];
    expect(await pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id })).toMatchObject({ found: true, piece: { threadId: null } });
  });

  it("held by two of the caller's chats: the one written to last; another person's chat is never it", async () => {
    db.state.tables.analysis_results = [run(MIDDLE)];
    db.state.tables.threads = [
      thread({ id: CHAT, updated: "2026-11-21T12:00:00.000000+00:00", seals: { [MIDDLE.id]: videoSeal(MIDDLE) } }),
      thread({ id: CHAT_2, updated: "2026-11-22T12:00:00.000000+00:00", seals: { [MIDDLE.id]: videoSeal(MIDDLE) } }),
      thread({ id: "99999999-9999-4999-8999-999999999999", user: OTHER, updated: "2026-11-23T12:00:00.000000+00:00", seals: { [MIDDLE.id]: videoSeal(MIDDLE) } }),
    ];
    expect(await pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id })).toMatchObject({ found: true, piece: { threadId: CHAT_2 } });
    const q = callsTo("threads")[0]!;
    expect(q.filters).toEqual([
      { op: "eq", column: "user_id", value: USER },
      { op: "contains", column: "sim_seals", value: { [MIDDLE.id]: {} } },
    ]);
    expect(q.order).toEqual([["updated_at", false], ["id", false]]);
    expect(q.limit).toBe(1);
  });

  it("with no audience the page can draw, or still running: no number, and no chat is looked for", async () => {
    db.state.tables.analysis_results = [run(NO_GROUPS), run(MIDDLE, { heatmap: null, score: null, engine: "pending" })];
    expect(await pieceSaid(db.client, USER, { kind: "video", analysisId: NO_GROUPS.id })).toEqual({ found: false, why: "no_number" });
    expect(await pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id })).toEqual({ found: false, why: "no_number" });
    expect(callsTo("threads")).toEqual([]);
  });

  it("an in-flight run that already carries a heatmap still has no number", async () => {
    db.state.tables.analysis_results = [run(MIDDLE, { score: null, engine: "pending" })];
    expect(await pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id })).toEqual({ found: false, why: "no_number" });
  });

  it.each([
    ["another person's", () => [run(MIDDLE, { user: OTHER })]],
    ["deleted", () => [run(MIDDLE, { deleted: "2026-11-22T00:00:00.000000+00:00" })]],
    ["not there", () => []],
  ])("a run that is %s: not found", async (_case, rows) => {
    db.state.tables.analysis_results = rows();
    expect(await pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id })).toEqual({ found: false, why: "not_found" });
    expect(filtersOf("analysis_results")).toEqual([
      ["eq", "id", MIDDLE.id],
      ["eq", "user_id", USER],
      ["is", "deleted_at", null],
    ]);
  });

  it("reads only what the number needs, never the heavy columns", async () => {
    db.state.tables.analysis_results = [run(MIDDLE)];
    await pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id });
    expect(callsTo("analysis_results")[0]!.columns.split(",").map((s) => s.trim())).toEqual(["id", "created_at", "heatmap", "overall_score", "engine_version"]);
  });

  it.each([[""], ["a/b"], ["x".repeat(65)]])("an id that cannot be one (%j): not found, nothing read", async (analysisId) => {
    expect(await pieceSaid(db.client, USER, { kind: "video", analysisId })).toEqual({ found: false, why: "not_found" });
    expect(db.state.calls).toEqual([]);
  });

  it.each([["analysis_results"], ["threads"]])("a database error on %s throws", async (table) => {
    db.state.tables.analysis_results = [run(MIDDLE)];
    db.state.failOn = table;
    await expect(pieceSaid(db.client, USER, { kind: "video", analysisId: MIDDLE.id })).rejects.toThrow("connection reset by peer");
  });
});
