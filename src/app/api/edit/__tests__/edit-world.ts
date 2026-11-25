/**
 * edit-world.ts — what the editor's route suites share (plan 2026-11-24-editor-screens-a, Tasks 6 to 8): the stand-ins wired as
 * `routes.test.ts` and `agent-route.test.ts` wire them (Supabase's REST API with the tables' grants, the bucket, the worker),
 * the agent's two boundaries replaced where the routes read them (`agentDeps`), the made-up take of `agent-route.test.ts`
 * (8 s, 720x1280, twelve words, five pauses, a face in the middle; repeated here because a test file cannot be imported), an
 * edit seeded with turns, the first cut and a change made with no route (what a route is to answer), and requests.
 *
 * Each suite still declares the two module mocks itself (`vi.mock` is hoisted per file):
 *   vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
 *   vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
 */
import { afterEach, beforeEach, expect, vi, type MockInstance } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { analysisOf, applyOps, type Edit, type FaceSample, type Op, type TakeAnalysis } from "@/lib/edit";
import { agentDeps } from "@/lib/edit/agent/deps";
import { firstCut } from "@/lib/edit/agent/first-cut";
import { AGENT_LIMITS, change } from "@/lib/edit/agent/loop";
import type { Ask, Message } from "@/lib/edit/agent/model";
import { systemPrompt } from "@/lib/edit/agent/prompt";
import type { Finding } from "@/lib/edit/review";
import type { StyleProfile } from "@/lib/edit/style/profile";
import { wordsPrompt } from "@/lib/edit/style/words";
import type { TurnKind } from "@/lib/edit/turns";
import type { stillsOf } from "@/lib/edit/worker/stills";
import { assetOf, firstEdit, type TakeRow } from "@/lib/edit/worker/takes";
import { TAKE, USER, keyOf, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET, ENV, standIns } from "@/lib/edit/worker/__tests__/stand-ins";

/* ── the made-up take ── */

const MS = 8000;
const WORDS = [
  { text: "Stop", startMs: 300, endMs: 600 },
  { text: "scrolling", startMs: 620, endMs: 1000 },
  { text: "this", startMs: 1500, endMs: 1800 },
  { text: "changes", startMs: 1820, endMs: 2300 },
  { text: "everything", startMs: 2320, endMs: 2900 },
  { text: "you", startMs: 3400, endMs: 3700 },
  { text: "know", startMs: 3720, endMs: 4100 },
  { text: "about", startMs: 4120, endMs: 4600 },
  { text: "editing", startMs: 5100, endMs: 5700 },
  { text: "your", startMs: 5720, endMs: 6000 },
  { text: "videos", startMs: 6020, endMs: 6600 },
  { text: "today", startMs: 6620, endMs: 7500 },
];
const PAUSES = [
  { startMs: 0, endMs: 300, cutMs: 150 },
  { startMs: 1000, endMs: 1500, cutMs: 1250 },
  { startMs: 2900, endMs: 3400, cutMs: 3150 },
  { startMs: 4600, endMs: 5100, cutMs: 4850 },
  { startMs: 7500, endMs: 8000, cutMs: 7750 },
];
const FACES: FaceSample[] = Array.from({ length: MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }, mouth: { x: 0.42, y: 0.43, w: 0.16, h: 0.024 } }));
const LOUDNESS: TakeAnalysis["loudness"] = {
  lufs: -24, truePeak: -3,
  levels: Array.from({ length: MS / 100 }, (_, i) => ({ ms: i * 100, lufs: PAUSES.some((pause) => pause.startMs <= i * 100 && i * 100 < pause.endMs) ? -70 : -24 })),
};
const probe = (w: number, h: number) => ({ videoMs: MS, audioMs: MS, ms: MS, w, h, fps: 30, codec: "h264", hdr: false, sound: true, rotation: 0 });

/** The take's row as the worker writes it once it is ready; the creator's unless told. */
export function readyTake(over: Partial<TakeRow> = {}): TakeRow {
  const id = over.id ?? TAKE;
  const user = over.user_id ?? USER;
  return takeRow({
    name: "IMG_0042.MOV",
    facts: { source: probe(720, 1280), full: probe(720, 1280), preview: probe(540, 960), ms: MS },
    words: WORDS,
    analysis: {
      files: { full: keyOf("full.mp4", id, user), preview: keyOf("preview.mp4", id, user), poster: keyOf("poster.jpg", id, user) },
      untimed: 0, apart: 0, gaveWay: 0, language: "en", pauses: PAUSES, faces: FACES, loudness: LOUDNESS,
    } as TakeRow["analysis"],
    ...over,
  });
}
export const TAKE_ASSET = assetOf(readyTake(), BUCKET);
export const TAKE_FIRST = firstEdit(TAKE_ASSET);
export function through(edit: Edit, ops: Op[]): Edit {
  const made = applyOps(edit, ops, [TAKE_ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
}

/* ── the agent's two boundaries ── */

type Role = "cut" | "words" | "change";
function roleOf(messages: Message[]): Role {
  const system = messages[0]?.content;
  if (system === wordsPrompt()) return "words";
  if (system === systemPrompt()) return "change";
  if (typeof system === "string" && system.startsWith("You make the first cut")) return "cut";
  throw new Error("asked with none of the agent's prompts");
}
/** One canned answer: its text, and optionally a gate it waits on and a call told it has been asked; or an Error. */
export type Canned = string | { text: string; gate?: Promise<void>; asked?: () => void } | Error;
const USAGE = { input: 3000, output: 80 };

export const chose = (over: Record<string, unknown> = {}): string => JSON.stringify({ title: "Edit *smarter*", short: "*Smarter*", stress: [1, 4], look: "vivid", pauseMs: 200, ...over });
export const answer = (say: string, ops: unknown[]): string => JSON.stringify({ say, ops });
export const NO_CHANGE = answer("I left the video as it is.", []);
export const BIGGER: Op[] = [{ op: "captions.set", size: 110 }];

/** Qwen, as canned answers by role: a first cut's choices default to `chose()`, a change's to no ops. */
export function qwen(script: Partial<Record<Role, Canned[]>> = {}) {
  const calls: Role[] = [];
  const ask: Ask = async (messages) => {
    const role = roleOf(messages);
    calls.push(role);
    const next = script[role]?.shift() ?? (role === "cut" ? chose() : role === "change" ? NO_CHANGE : new Error("the script has no answer of words left"));
    if (next instanceof Error) throw next;
    const canned = typeof next === "string" ? { text: next } : next;
    canned.asked?.();
    if (canned.gate) await canned.gate;
    return { text: canned.text, usage: USAGE, ms: 400 };
  };
  return { ask, calls };
}

/** The worker's stills: each frame as a stand-in JPEG. */
export function drawer() {
  const calls: number[][] = [];
  const stills: typeof stillsOf = async (_user, _edit, frames) => {
    calls.push([...frames]);
    return frames.map((frame) => ({ frame, jpeg: Buffer.from(`jpeg ${frame}`).toString("base64") }));
  };
  return { stills, calls };
}

/** The first cut as the agent makes it on the take, with the same canned answers and no route. */
export function cutOf(style?: StyleProfile) {
  const row = readyTake();
  return firstCut({ asset: assetOf(row, BUCKET), analysis: analysisOf(row), user: USER, deadlineMs: Date.now() + AGENT_LIMITS.firstCutMs, style }, { ask: qwen().ask, stills: drawer().stills });
}
/** A change as the agent makes it on `edit`, with the same canned answers and no route. */
export function changeOf(edit: Edit, request: string, script: Partial<Record<Role, Canned[]>> = {}) {
  const row = readyTake();
  return change({ edit, analyses: { [row.id]: analysisOf(row) }, request, library: [assetOf(row, BUCKET)], user: USER, deadlineMs: Date.now() + AGENT_LIMITS.changeMs }, { ask: qwen(script).ask, stills: drawer().stills });
}

/* ── the world ── */

export interface EditWorld {
  world: ReturnType<typeof standIns>;
  signedIn: { id: string; is_anonymous?: boolean } | null;
  /** What the routes logged as errors, joined; the test has looked at it. */
  errorsLogged(): string;
  /** The agent's two boundaries for this test. */
  boundaries(script?: Partial<Record<Role, Canned[]>>): { model: ReturnType<typeof qwen>; worker: ReturnType<typeof drawer> };
}

/** Wires the world before each test of the suite, and after each one fails it on an error logged that it did not look at. */
export function wireEditWorld(): EditWorld {
  const original = { ...agentDeps };
  let logged: MockInstance<typeof console.error> | null = null;
  let looked = 0;
  const state: EditWorld = {
    world: standIns(),
    signedIn: null,
    errorsLogged: () => {
      looked = logged?.mock.calls.length ?? 0;
      return (logged?.mock.calls ?? []).map((args) => args.join(" ")).join("\n");
    },
    boundaries: (script = {}) => {
      const model = qwen(script);
      const worker = drawer();
      agentDeps.ask = model.ask;
      agentDeps.stills = worker.stills;
      return { model, worker };
    },
  };
  beforeEach(() => {
    state.world = standIns();
    state.signedIn = { id: USER, is_anonymous: false };
    looked = 0;
    vi.stubGlobal("fetch", state.world.fetch);
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    vi.stubEnv("EDIT_CREATORS", USER);
    vi.mocked(createClient).mockImplementation(async () => state.world.session(state.signedIn) as never);
    vi.mocked(createServiceClient).mockImplementation(() => state.world.service() as never);
    logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    const unlooked = (logged?.mock.calls.length ?? 0) - looked;
    Object.assign(agentDeps, original);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    expect(unlooked, "a route logged an error the test did not look at").toBe(0);
  });
  return state;
}

/** A turn to seed: its kind and its edit (null for `said`); words made up unless given; nothing found or put away unless given. */
export interface Seeded {
  kind: TurnKind;
  doc: Edit | null;
  request?: string | null;
  say?: string;
  findings?: Finding[];
  kept?: string[];
}

/**
 * An edit of `take` (the ready take unless told; put once) with its chat and these turns, numbered from 1; its head at the last
 * turn unless told; its look `house` once it has a turn. Gives the edit's and the chat's ids.
 */
export function seedEdit(
  world: ReturnType<typeof standIns>,
  { take = readyTake(), turns = [], head, look, exportJob = null, exportTurn = null }: { take?: TakeRow; turns?: Seeded[]; head?: number | null; look?: string | null; exportJob?: string | null; exportTurn?: number | null } = {},
): { id: string; threadId: string } {
  if (!world.rest.row("edit_takes", take.id)) world.rest.put("edit_takes", take); // one row a take, however many edits are seeded of it
  const thread = world.rest.put("threads", { user_id: take.user_id, type: "open" });
  const edit = world.rest.put("edits", {
    user_id: take.user_id, thread_id: thread.id, take_id: take.id, title: "IMG_0042",
    look: look ?? (turns.length > 0 ? "house" : null), head: head === undefined ? (turns.length > 0 ? turns.length : null) : head,
    export_job: exportJob, export_turn: exportTurn,
  });
  turns.forEach((turn, i) =>
    world.rest.put("edit_turns", { edit_id: edit.id, n: i + 1, kind: turn.kind, request: turn.request ?? null, say: turn.say ?? `turn ${i + 1}`, findings: turn.findings ?? [], kept: turn.kept ?? [], doc: turn.doc }),
  );
  return { id: String(edit.id), threadId: String(thread.id) };
}

/* ── requests ── */

export const post = (path: string, body: unknown = {}, type = "application/json") =>
  new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
export const get = (path: string) => new Request(`http://localhost:3000${path}`);
export const del = (path: string) => new Request(`http://localhost:3000${path}`, { method: "DELETE" });
export const by = (id: string) => ({ params: Promise.resolve({ id }) });
