/**
 * agent-route.test.ts — the agent's route (part 3, Task 13a): `POST /api/edit/agent`, a change to an edit or a first cut of a
 * take, in the house style, a preset, a style from words or a profile. In process, with the real route, gate, door
 * (`EditSchema`, `checkEdit`, `applyOps`), review, loop, first cut and styles, and the real supabase-js. Stand-ins at the network
 * only: Supabase's REST API (`stand-ins.ts`), and the agent's two boundaries, replaced where the route reads them
 * (`agentDeps`, `src/lib/edit/agent/deps.ts`): Qwen's `ask` (canned answers, by which of the agent's prompts asks) and the
 * worker's `stills` (stand-in JPEGs). Each is proved for real by `scripts/edit-agent-route-proof.ts`.
 *
 * The take is made up: 8 s, 720x1280, twelve words, five pauses (three of 500 ms inside), the face in the middle of the picture.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { calculateCost } from "@/lib/engine/qwen/cost";
import { analysisOf, applyOps, type Edit, type FaceSample, type Op, type TakeAnalysis } from "@/lib/edit";
import { agentDeps } from "@/lib/edit/agent/deps";
import { FIX_REQUEST, firstCut } from "@/lib/edit/agent/first-cut";
import { AGENT_LIMITS } from "@/lib/edit/agent/loop";
import type { Ask, Message } from "@/lib/edit/agent/model";
import { systemPrompt } from "@/lib/edit/agent/prompt";
import { HOUSE_STYLE } from "@/lib/edit/style/house";
import { presetOf } from "@/lib/edit/style/presets";
import type { StyleProfile } from "@/lib/edit/style/profile";
import { styleOfWords, wordsPrompt } from "@/lib/edit/style/words";
import type { stillsOf } from "@/lib/edit/worker/stills";
import { assetOf, type TakeRow } from "@/lib/edit/worker/takes";
import { UPLOAD_MARK } from "@/lib/edit/style/reference";
import { OTHER, TAKE, USER, jobRow, keyOf, takeRow, uploadingTake } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET, ENV, standIns } from "@/lib/edit/worker/__tests__/stand-ins";
import { POST as agent, maxDuration } from "../agent/route";
import { AGENT_HOLD_MS, holdAgent } from "../creator";

/* ── the made-up take ─────────────────────────────────────────────────────────────────────────────────────────────────── */

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
/** The face from 0.3 to 0.5 of the height, five times a second: clear of captions low in the picture and of a title up top. */
const FACES: FaceSample[] = Array.from({ length: MS / 200 }, (_, i) => ({ ms: i * 200, face: { x: 0.3, y: 0.3, w: 0.4, h: 0.2 }, mouth: { x: 0.42, y: 0.43, w: 0.16, h: 0.024 } }));
const LOUDNESS: TakeAnalysis["loudness"] = {
  lufs: -24, truePeak: -3,
  levels: Array.from({ length: MS / 100 }, (_, i) => ({ ms: i * 100, lufs: PAUSES.some((pause) => pause.startMs <= i * 100 && i * 100 < pause.endMs) ? -70 : -24 })),
};
const probe = (w: number, h: number) => ({ videoMs: MS, audioMs: MS, ms: MS, w, h, fps: 30, codec: "h264", hdr: false, sound: true, rotation: 0 });

/** The take's row as the worker writes it once it is ready; the creator's unless told. */
function ready(over: Partial<TakeRow> = {}): TakeRow {
  const id = over.id ?? TAKE;
  const user = over.user_id ?? USER;
  return takeRow({
    facts: { source: probe(720, 1280), full: probe(720, 1280), preview: probe(540, 960), ms: MS },
    words: WORDS,
    analysis: {
      files: { full: keyOf("full.mp4", id, user), preview: keyOf("preview.mp4", id, user), poster: keyOf("poster.jpg", id, user) },
      untimed: 0, apart: 0, gaveWay: 0, language: "en", pauses: PAUSES, faces: FACES, loudness: LOUDNESS,
    } as TakeRow["analysis"],
    ...over,
  });
}
const SECOND = "44444444-4444-4444-8444-444444444444";

/** A style as a reference's read gives one: highlight captions at 0.62, a label title at 0.18 for two seconds, six punch-ins a minute. */
const PROFILE: StyleProfile = {
  source: { kind: "reference", name: "@someone" },
  pace: { pauseMs: 180, cutsPerMin: null },
  captions: { on: true, look: "highlight", font: "tiktok", size: 72, y: 0.62, maxWords: 3, highlight: "#ffe14a" },
  title: { on: true, y: 0.18, frames: 60, look: "label", size: 110 },
  punchIns: { perMin: 6, zoom: 1.2 },
  look: { preset: "warm" },
  notMatched: ["emoji"],
};

/* ── the agent's two boundaries ───────────────────────────────────────────────────────────────────────────────────────── */

/** Which of the agent's prompts a call is asked with: the first cut's choices, a style from words, or a change. */
type Role = "cut" | "words" | "change";
function roleOf(messages: Message[]): Role {
  const system = messages[0]?.content;
  if (system === wordsPrompt()) return "words";
  if (system === systemPrompt()) return "change";
  if (typeof system === "string" && system.startsWith("You make the first cut")) return "cut";
  throw new Error("asked with none of the agent's prompts");
}

/**
 * One canned answer: its text, and optionally a gate it waits on before answering, a call told it has been asked, how far it
 * moves the clock (`Date.now`, when the test has made it the test's own), or `broken`: an answer whose text cannot be read off
 * it at all; or an Error, a call failed.
 */
type Canned = string | { text: string; gate?: Promise<void>; asked?: () => void; clockMs?: number; broken?: boolean } | Error;
const USAGE = { input: 3000, output: 80 };
/** What one canned call costs, in cents. */
const ONE = calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: USAGE.input, completion_tokens: USAGE.output });

const chose = (over: Record<string, unknown> = {}): string => JSON.stringify({ title: "Edit *smarter*", short: "*Smarter*", stress: [1, 4], look: "vivid", pauseMs: 200, ...over });
const answer = (say: string, ops: unknown[]): string => JSON.stringify({ say, ops });
const NO_CHANGE = answer("I left the video as it is.", []);
const BIGGER: Op[] = [{ op: "captions.set", size: 110 }];
/** `words.ts`'s answer at HEAD: the preset, the change, `named`; code writes the say. */
const FAST_WITH_ZOOMS = JSON.stringify({ preset: "bold-pop", change: { zooms: "many", pace: "fast" }, named: false });

/** Clock skips: `Date.now` moves by what an answer says it took. */
let skipped = 0;
const realNow = Date.now.bind(Date);
const ownClock = () => {
  skipped = 0;
  vi.spyOn(Date, "now").mockImplementation(() => realNow() + skipped);
};

/** Qwen, as canned answers by role: a first cut's choices default to `chose()`, a change's to no ops; words have no default. */
function qwen(script: Partial<Record<Role, Canned[]>> = {}) {
  const calls: { role: Role; messages: Message[] }[] = [];
  const ask: Ask = async (messages) => {
    const role = roleOf(messages);
    calls.push({ role, messages: structuredClone(messages) });
    const next = script[role]?.shift() ?? (role === "cut" ? chose() : role === "change" ? NO_CHANGE : new Error("the script has no answer of words left"));
    if (next instanceof Error) throw next;
    const canned = typeof next === "string" ? { text: next } : next;
    canned.asked?.();
    if (canned.gate) await canned.gate;
    skipped += canned.clockMs ?? 0;
    if (canned.broken) {
      return { get text(): string { throw new Error("the answer's text could not be read"); }, usage: USAGE, ms: 400 };
    }
    return { text: canned.text, usage: USAGE, ms: 400 };
  };
  return { ask, calls, roles: () => calls.map((call) => call.role) };
}

/** The worker's stills: each frame as a stand-in JPEG, for the creator asked. */
function drawer() {
  const calls: { user: string; frames: number[] }[] = [];
  const stills: typeof stillsOf = async (user, _edit, frames) => {
    calls.push({ user, frames: [...frames] });
    return frames.map((frame) => ({ frame, jpeg: Buffer.from(`jpeg ${frame}`).toString("base64") }));
  };
  return { stills, calls };
}

/** The first cut as the loop makes it on the take, with the same canned answers and no route: what the route is to answer. */
async function cutOf(style?: StyleProfile, script: Partial<Record<Role, Canned[]>> = {}) {
  const row = ready();
  return firstCut({ asset: assetOf(row, BUCKET), analysis: analysisOf(row), user: USER, deadlineMs: Date.now() + AGENT_LIMITS.firstCutMs, style }, { ask: qwen(script).ask, stills: drawer().stills });
}
const through = (edit: Edit, ops: Op[]): Edit => {
  const made = applyOps(edit, ops, [assetOf(ready(), BUCKET)]);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};

/* ── the suite ────────────────────────────────────────────────────────────────────────────────────────────────────────── */

let world: ReturnType<typeof standIns>;
let signedIn: { id: string; is_anonymous?: boolean } | null;
let logged: MockInstance<typeof console.error>;
let looked = 0;
const ORIGINAL = { ...agentDeps };

beforeEach(() => {
  world = standIns();
  signedIn = { id: USER, is_anonymous: false };
  vi.stubGlobal("fetch", world.fetch);
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.stubEnv("EDIT_CREATORS", `${USER},${OTHER}`);
  vi.mocked(createClient).mockImplementation(async () => world.session(signedIn) as never);
  vi.mocked(createServiceClient).mockImplementation(() => world.service() as never);
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  const unlooked = logged.mock.calls.length - looked;
  looked = 0;
  Object.assign(agentDeps, ORIGINAL);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(unlooked, "the route logged an error the test did not look at").toBe(0);
});
const errorsLogged = () => {
  looked = logged.mock.calls.length;
  return logged.mock.calls.map((args) => args.join(" ")).join("\n");
};

/** The two boundaries for this test. */
function boundaries(script: Partial<Record<Role, Canned[]>> = {}) {
  const model = qwen(script);
  const worker = drawer();
  agentDeps.ask = model.ask;
  agentDeps.stills = worker.stills;
  return { model, worker };
}

const post = (body: unknown, type = "application/json") =>
  agent(new Request("http://localhost:3000/api/edit/agent", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const cut = (style?: unknown, takes: unknown = [TAKE]) => post(style === undefined ? { takes, firstCut: true } : { takes, firstCut: true, style });
const changeOf = (edit: unknown, request = "make the captions bigger", takes: unknown = [TAKE]) => post({ takes, edit, request });
/** The answer's body, and that it is an answer of the route's own shape. */
async function body(response: Response) {
  const json = await response.json();
  return json as { say: string; ops: Op[]; edit: Edit; findings: unknown[]; rounds: number; ms: number; cost: number; changed: boolean; match: unknown; style: StyleProfile | null; styleSay: string | null; error?: string };
}
const KEYS = ["say", "ops", "edit", "findings", "rounds", "ms", "cost", "changed", "match", "style", "styleSay"].sort();

const BUSY = "The editor is already working on a call of yours; try again when it is done.";
const WORDS_FAILED = "The style could not be read from those words. Try other words or pick a preset.";

describe("POST /api/edit/agent: the gate", () => {
  it("401s without a session and 403s a creator the edit tool is not open to, before reading anything or asking Qwen", async () => {
    const { model } = boundaries();
    signedIn = null;
    expect((await cut()).status).toBe(401);
    signedIn = { id: USER };
    vi.stubEnv("EDIT_CREATORS", OTHER);
    const response = await cut();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "the edit tool is not open to this account yet" });
    expect(world.rest.calls).toEqual([]);
    expect(model.calls).toEqual([]);
  });

  it("refuses a body that is not JSON, or a call from another origin", async () => {
    boundaries();
    expect((await post("takes=x", "application/x-www-form-urlencoded")).status).toBe(415);
    const forged = new Request("http://localhost:3000/api/edit/agent", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    expect((await agent(forged)).status).toBe(403);
  });

  it("waits up to three minutes: a first cut stops at 170 s, a change at 50 s (X89)", () => {
    expect(maxDuration).toBe(180);
    expect([AGENT_LIMITS.changeMs, AGENT_LIMITS.firstCutMs]).toEqual([50_000, 170_000]);
  });
});

describe("POST /api/edit/agent: what is refused, each with one plain sentence", () => {
  it("404s another creator's take, and an id that is no take's", async () => {
    const { model } = boundaries();
    world.rest.put("edit_takes", ready({ user_id: OTHER }));
    for (const takes of [[TAKE], ["../../x"]]) {
      const response = await cut(undefined, takes);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "no such take" });
    }
    expect(model.calls).toEqual([]);
  });

  it("404s a reference as no take of the creator's: ready, analysing or uploaded, alone or among their takes, asking Qwen nothing and letting the hold go (Task 11)", async () => {
    // A reference: another's video read for its style, stored as a take of the creator's while it is read. Ready (its job asked
    // as a reference's), analysing (the same), and uploaded and not yet started (`UPLOAD_MARK`).
    const [read, reading, uploaded] = ["66666666-6666-4666-8666-666666666666", "77777777-7777-4777-8777-777777777777", "88888888-8888-4888-8888-888888888888"];
    world.rest.put("edit_takes", ready());
    world.rest.put("edit_takes", ready({ id: read, name: "@someone.mp4" }));
    world.rest.put("edit_jobs", jobRow({ id: "36666666-6666-4666-8666-666666666666", take_id: read, input: { reference: true }, status: "done", stage: null, progress: 1 }));
    world.rest.put("edit_takes", uploadingTake({ id: reading, status: "analysing" }));
    world.rest.put("edit_jobs", jobRow({ id: "37777777-7777-4777-8777-777777777777", take_id: reading, input: { reference: true } }));
    world.rest.put("edit_takes", uploadingTake({ id: uploaded, analysis: UPLOAD_MARK }));
    const { edit } = await cutOf();
    const { model } = boundaries();
    for (const id of [read, reading, uploaded]) {
      for (const response of [await cut(undefined, [id]), await changeOf(edit, "make the captions bigger", [TAKE, id])]) {
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: "no such take" });
      }
    }
    expect(model.calls).toEqual([]);
    expect((await cut()).status).toBe(200); // the hold was let go after each 404; and their own take, with a reference's job in the table, is theirs
  });

  it("409s a take that is not ready, saying what it is waiting for", async () => {
    const { model } = boundaries();
    world.rest.put("edit_takes", uploadingTake({ status: "analysing" }));
    let response = await cut();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "That take is still being analysed; try again when it is ready." });
    world.rest.tables.edit_takes.length = 0;
    world.rest.put("edit_takes", uploadingTake());
    response = await cut();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "That take has not finished uploading." });
    // Ready as the worker wrote it, and over ten minutes long (X56): failed for its length, and told so, not to upload it again.
    world.rest.tables.edit_takes.length = 0;
    world.rest.put("edit_takes", ready({ facts: { ...(ready().facts as object), ms: 630_000 } }));
    response = await cut();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "That take is longer than 10 minutes; use a shorter take." });
    expect(model.calls).toEqual([]);
  });

  it("422s an edit whose take facts differ from the row (a changed ms), or that holds a take not handed in, and asks Qwen nothing", async () => {
    world.rest.put("edit_takes", ready());
    world.rest.put("edit_takes", ready({ id: SECOND }));
    const { edit } = await cutOf();
    const { model } = boundaries();
    const longer = structuredClone(edit);
    const take = longer.assets[0]!;
    if (take.kind !== "video") throw new Error("the take is a video");
    take.ms = 9000;
    let response = await changeOf(longer);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "A video in this edit is not one of your takes as it was measured. Start again from the take." });
    response = await changeOf(edit, "make the captions bigger", [SECOND]);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "A video in this edit is not one of your takes as it was measured. Start again from the take." });
    expect(model.calls).toEqual([]);
  });

  it.each([
    ["not JSON", "{", "The editor could not read this call."],
    ["neither call", {}, "The editor could not read this call."],
    ["a first cut not asked as one", { takes: [TAKE], firstCut: false }, "The editor could not read this call."],
    ["a first cut of two takes", { takes: [TAKE, SECOND], firstCut: true }, "The editor could not read this call."],
    ["a change with no takes", { takes: [], edit: {}, request: "x" }, "The editor could not read this call."],
    ["a call that is both", { takes: [TAKE], firstCut: true, edit: {}, request: "x" }, "The editor could not read this call."],
    ["a change with no edit", { takes: [TAKE], request: "make it pop" }, "This edit could not be read."],
    ["a request over 500 characters", "long", "A request is at most 500 characters."],
    ["a blank request", "blank", "Say what to change."],
    ["an edit that is not one", "not an edit", "This edit could not be read."],
    ["an edit that does not hold together", "apart", "This edit does not hold together."],
    ["an unknown preset", { takes: [TAKE], firstCut: true, style: { preset: "neon" } }, "There is no preset of that name."],
    ["words over 300 characters", { takes: [TAKE], firstCut: true, style: { words: "w".repeat(301) } }, "A style in words is at most 300 characters."],
    ["no words", { takes: [TAKE], firstCut: true, style: { words: "  " } }, "Say in a few words what style you want."],
    ["a profile with a field no profile has", { takes: [TAKE], firstCut: true, style: { ...PROFILE, sparkle: true } }, "This style could not be read."],
    ["a profile out of range", { takes: [TAKE], firstCut: true, style: { ...PROFILE, captions: { ...PROFILE.captions, size: 900 } } }, "This style could not be read."],
    ["words and a preset at once", { takes: [TAKE], firstCut: true, style: { words: "calm", preset: "clean" } }, "This style could not be read."],
  ])("400s %s, before reading anything or asking Qwen", async (_, given, error) => {
    const { model } = boundaries();
    world.rest.put("edit_takes", ready());
    const { edit } = await cutOf();
    const apart = structuredClone(edit);
    apart.shots[0]!.endMs = 9000; // past the take's end
    const bodies: Record<string, unknown> = {
      long: { takes: [TAKE], edit, request: "x".repeat(501) },
      blank: { takes: [TAKE], edit, request: " \n " },
      "not an edit": { takes: [TAKE], edit: { ...edit, v: 2 }, request: "make it pop" },
      apart: { takes: [TAKE], edit: apart, request: "make it pop" },
    };
    const calls = world.rest.calls.length;
    const response = await post(typeof given === "string" && given in bodies ? bodies[given] : given);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(world.rest.calls).toHaveLength(calls);
    expect(model.calls).toEqual([]);
  });

  it("takes a request of exactly 500 characters", async () => {
    world.rest.put("edit_takes", ready());
    const { edit } = await cutOf();
    boundaries();
    expect((await changeOf(edit, "x".repeat(500))).status).toBe(200);
  });
});

describe("POST /api/edit/agent: a change", () => {
  it("makes the request on the edit through the door: 200 with the new edit, in one call, with no stills asked of the worker (X115: the model's look is off)", async () => {
    world.rest.put("edit_takes", ready());
    const { edit } = await cutOf();
    const { model, worker } = boundaries({ change: [answer("The captions are bigger now.", BIGGER)] });
    const response = await changeOf(edit);
    expect(response.status).toBe(200);
    const got = await body(response);
    expect(Object.keys(got).sort()).toEqual(KEYS);
    expect(got.edit).toEqual(through(edit, BIGGER));
    expect(got.edit.captions.size).toBe(110);
    expect(got).toMatchObject({ say: "The captions are bigger now.", ops: BIGGER, rounds: 1, changed: true, match: null, style: null, styleSay: null });
    expect(got.cost).toBeCloseTo(ONE, 10);
    expect(got.ms).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(got.findings)).toBe(true);
    expect(model.roles()).toEqual(["change"]);
    expect(JSON.stringify(model.calls[0]?.messages.at(-1))).toContain("make the captions bigger");
    expect(worker.calls).toHaveLength(0);
  });

  it("offers the creator's other takes handed in as files, and reads each take's analysis from its row", async () => {
    world.rest.put("edit_takes", ready());
    world.rest.put("edit_takes", ready({ id: SECOND, name: "second.mp4" }));
    const { edit } = await cutOf();
    const { model } = boundaries();
    expect((await changeOf(edit, "add my second take at the end", [TAKE, SECOND, TAKE])).status).toBe(200);
    const asked = JSON.stringify(model.calls[0]?.messages.at(-1));
    expect(asked).toContain(SECOND);
    expect(asked).toContain("w1 scrolling [620,1000)");
  });

  it("answers a change it could not make with the edit as it was, and why", async () => {
    world.rest.put("edit_takes", ready());
    const { edit } = await cutOf();
    boundaries({ change: ["not json", "still not json", "nor this"] });
    const got = await body(await changeOf(edit));
    expect(got).toMatchObject({ edit, ops: [], changed: false, rounds: 3, say: "I couldn't make that change: something went wrong on my side." });
  });

  it("stops a change at 50 s from the call's start: an answer that takes past it is the last asked (X89)", async () => {
    world.rest.put("edit_takes", ready());
    const { edit } = await cutOf();
    ownClock();
    const { model } = boundaries({ change: [{ text: "not json", clockMs: AGENT_LIMITS.changeMs + 1 }] });
    const got = await body(await changeOf(edit));
    expect(model.roles()).toEqual(["change"]);
    expect(got).toMatchObject({ rounds: 1, changed: false, say: "I couldn't make that change: something went wrong on my side." });
    expect(got.ms).toBeGreaterThan(AGENT_LIMITS.changeMs);
  });
});

describe("POST /api/edit/agent: a first cut", () => {
  it("with no style cuts in the house style: its captions, Qwen's pace, the natural look, no match, and the house's profile as the style", async () => {
    world.rest.put("edit_takes", ready());
    const expected = await cutOf();
    const { model } = boundaries();
    const response = await cut();
    expect(response.status).toBe(200);
    const got = await body(response);
    expect(Object.keys(got).sort()).toEqual(KEYS);
    expect(got.edit).toEqual(expected.edit);
    expect(got.edit.captions).toMatchObject(HOUSE_STYLE.captions);
    expect(got.edit.look.preset).toBe("natural");
    expect(got.edit.shots.length).toBeGreaterThan(1); // tightened: cut in its pauses
    expect(got).toMatchObject({ say: expected.say, ops: expected.ops, findings: expected.findings, rounds: expected.rounds.length, changed: true, match: null, style: HOUSE_STYLE, styleSay: null });
    expect(got.cost).toBeCloseTo(expected.cost, 10);
    expect(model.roles()).toEqual(["cut"]);
  });

  it("takes `style: null` as no style", async () => {
    world.rest.put("edit_takes", ready());
    boundaries();
    const got = await body(await post({ takes: [TAKE], firstCut: true, style: null }));
    expect(got).toMatchObject({ match: null, style: HOUSE_STYLE });
  });

  it("with a preset's id cuts in the preset: its settings, its match, and the preset's profile as the style", async () => {
    world.rest.put("edit_takes", ready());
    const clean = presetOf("clean")!.profile;
    const expected = await cutOf(clean);
    const { model } = boundaries();
    const got = await body(await cut({ preset: "clean" }));
    expect(got.edit).toEqual(expected.edit);
    expect(got.edit.captions).toMatchObject({ look: "pill", font: "inter", maxWords: 4, highlight: null });
    expect(got.match).toEqual(expected.match);
    expect(got.match).not.toBeNull();
    expect(got).toMatchObject({ say: expected.say, style: clean, styleSay: null, rounds: expected.rounds.length });
    expect(model.calls[0]?.messages.at(-1)?.content).toContain(`"pauseMs":${clean.pace.pauseMs}`);
  });

  it("with words reads the style from them first: its settings, its match, the style and what was said of it; both calls in the cost", async () => {
    world.rest.put("edit_takes", ready());
    const words = "fast with zooms";
    const { style, say } = await styleOfWords(words, qwen({ words: [FAST_WITH_ZOOMS] }).ask);
    const expected = await cutOf(style);
    const { model } = boundaries({ words: [FAST_WITH_ZOOMS] });
    const got = await body(await cut({ words }));
    expect(style).toMatchObject({ source: { kind: "words", name: words }, pace: { pauseMs: 150 }, punchIns: { perMin: 14, zoom: 1.2 } });
    expect(got.edit).toEqual(expected.edit);
    expect(got.match).toEqual(expected.match);
    expect(got).toMatchObject({ say: expected.say, style, styleSay: say });
    expect(got.styleSay).toMatch(/^I used Bold pop/);
    expect(model.roles()[0]).toBe("words");
    expect(got.cost).toBeCloseTo(ONE + expected.cost, 10);
  });

  it("with a full profile cuts in it as it is: its settings, its match with what the kit cannot draw, and the profile as the style", async () => {
    world.rest.put("edit_takes", ready());
    const expected = await cutOf(PROFILE);
    boundaries();
    const got = await body(await cut(PROFILE));
    expect(got.edit).toEqual(expected.edit);
    expect(got.edit.captions).toMatchObject({ look: "highlight", font: "tiktok", maxWords: 3 });
    expect(got.edit.look.preset).toBe("warm");
    expect(got.match).toEqual(expected.match);
    expect((got.match as { notMatched: string[] }).notMatched).toEqual(["emoji"]);
    expect(got).toMatchObject({ say: expected.say, style: PROFILE, styleSay: null });
  });

  it("502s when no style can be read from the words, answer and repair both unreadable or the call failed; the hold is let go", async () => {
    world.rest.put("edit_takes", ready());
    const { model } = boundaries({ words: ["not json", "still not json", new Error("503 the model is busy")] });
    let response = await cut({ words: "fast with zooms" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: WORDS_FAILED });
    response = await cut({ words: "fast with zooms" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: WORDS_FAILED });
    expect(model.roles()).toEqual(["words", "words", "words"]);
    expect((await cut()).status).toBe(200);
  });

  it("counts the words' time in the first cut's 170 s: words that take it all leave no time to ask for the choices (X89)", async () => {
    world.rest.put("edit_takes", ready());
    ownClock();
    const { model } = boundaries({ words: [{ text: FAST_WITH_ZOOMS, clockMs: AGENT_LIMITS.firstCutMs + 1 }] });
    const got = await body(await cut({ words: "fast with zooms" }));
    expect(model.roles()).toEqual(["words"]);
    expect(got.say).toContain("I couldn't choose a title or the words to stress this time");
    expect(got.ms).toBeGreaterThan(AGENT_LIMITS.firstCutMs);
  });

  it("gives a first cut longer than a change's 50 s: an answer that takes 50 s is still repaired", async () => {
    world.rest.put("edit_takes", ready());
    ownClock();
    const { model } = boundaries({ cut: [{ text: "not json", clockMs: AGENT_LIMITS.changeMs + 1 }, chose()] });
    const got = await body(await cut());
    expect(model.roles().slice(0, 2)).toEqual(["cut", "cut"]);
    expect(got.edit.items.some((item) => item.part === "title")).toBe(true);
  });

  it("asks the last resort with FIX_REQUEST when the cut leaves an error, as the first cut does, and answers what it left out", async () => {
    // As first-cut.test.ts makes one: a hook of 28 Ws (and a short one of 18) in a label title, which the kit sets under the
    // least size at every place and size, so the title keeps a text-fits error to the end and is left out. The house's title
    // is a label already (Task 8); the profile is passed as a style, as before.
    world.rest.put("edit_takes", ready());
    const label: StyleProfile = { ...HOUSE_STYLE, title: { ...HOUSE_STYLE.title!, look: "label" } };
    const wide = chose({ title: "W".repeat(28), short: "W".repeat(18) });
    const expected = await cutOf(label, { cut: [wide] });
    const { model } = boundaries({ cut: [wide] });
    const got = await body(await cut(label));
    const asked = model.calls.filter((call) => call.role === "change").map((call) => JSON.stringify(call.messages.at(-1)));
    expect(asked.length).toBeGreaterThan(0);
    for (const each of asked) expect(each).toContain(JSON.stringify(`request:\n${FIX_REQUEST}`).slice(1, -1));
    expect(got.edit).toEqual(expected.edit);
    expect(got.edit.items.some((item) => item.part === "title")).toBe(false);
    expect(got.say).toContain("I left the title out: it would not fit on the screen.");
    expect(got.rounds).toBe(expected.rounds.length);
  });
});

describe("POST /api/edit/agent: one call of a creator's at a time (X92)", () => {
  it("409s a second call while one is live, holds no other creator, and lets a call through once the first has ended", async () => {
    world.rest.put("edit_takes", ready());
    world.rest.put("edit_takes", ready({ id: SECOND, user_id: OTHER }));
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    let reached!: () => void;
    const asked = new Promise<void>((resolve) => (reached = resolve));
    boundaries({ cut: [{ text: chose(), gate, asked: reached }] });

    const first = cut();
    try {
      await asked;
      const second = await cut();
      expect(second.status).toBe(409);
      expect(await second.json()).toEqual({ error: BUSY });
      const { edit } = await cutOf();
      expect((await changeOf(edit)).status).toBe(409); // a change is held as a first cut is
      signedIn = { id: OTHER };
      expect((await cut(undefined, [SECOND])).status).toBe(200);
      signedIn = { id: USER };
    } finally {
      open(); // a failed assert above still lets the first call end, and its hold go, before the next test
      await first.catch(() => undefined);
    }
    expect((await first).status).toBe(200);
    expect((await cut()).status).toBe(200);
  });

  it("counts a hold older than AGENT_HOLD_MS (200 s, past the longest call) as let go; its late release leaves the next hold", () => {
    const at = 1_000_000;
    const hung = holdAgent("someone", at);
    expect(hung).not.toBeNull();
    expect(AGENT_HOLD_MS).toBe(200_000);
    expect(AGENT_HOLD_MS).toBeGreaterThan(maxDuration * 1000);
    expect(holdAgent("someone", at + AGENT_HOLD_MS - 1)).toBeNull();
    const next = holdAgent("someone", at + AGENT_HOLD_MS);
    expect(next).not.toBeNull();
    hung!(); // the killed call's release, should it come after all
    expect(holdAgent("someone", at + AGENT_HOLD_MS + 1)).toBeNull();
    next!();
    const again = holdAgent("someone", at + AGENT_HOLD_MS + 2);
    expect(again).not.toBeNull();
    again!();
  });

  it("answers a creator held by a call that never let go with 409 until the hold is 200 s old, then lets them through", async () => {
    world.rest.put("edit_takes", ready());
    boundaries();
    const at = realNow();
    skipped = 0;
    vi.spyOn(Date, "now").mockImplementation(() => at + skipped); // the clock stands still but for the skips
    const hung = holdAgent(USER); // a call the platform killed before its finally ran
    try {
      expect((await cut()).status).toBe(409);
      skipped = AGENT_HOLD_MS - 1;
      expect((await cut()).status).toBe(409);
      skipped = AGENT_HOLD_MS;
      expect((await cut()).status).toBe(200);
    } finally {
      hung?.();
    }
    const after = holdAgent(USER); // the 200's own hold was let go, and the hung one's late release did not matter
    expect(after).not.toBeNull();
    after?.();
  });

  it("lets the hold go when the loop throws: a 500 in plain words, and the next call passes", async () => {
    world.rest.put("edit_takes", ready());
    const { edit } = await cutOf();
    boundaries({ change: [{ text: "", broken: true }] }); // the loop reads the answer's text outside any try: it throws
    const response = await changeOf(edit);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "something went wrong" });
    expect(errorsLogged()).toContain("POST /api/edit/agent failed");
    expect((await changeOf(edit)).status).toBe(200);
  });

  it("lets the hold go after every refusal past it: a 404, a 409 and a 422 leave the next call free", async () => {
    world.rest.put("edit_takes", ready());
    world.rest.put("edit_takes", ready({ id: SECOND, user_id: OTHER }));
    const { edit } = await cutOf();
    boundaries();
    expect((await cut(undefined, [SECOND])).status).toBe(404);
    world.rest.put("edit_takes", uploadingTake({ id: "55555555-5555-4555-8555-555555555555", status: "analysing" }));
    expect((await cut(undefined, ["55555555-5555-4555-8555-555555555555"])).status).toBe(409);
    expect((await changeOf({ ...edit, assets: edit.assets.map((asset) => ({ ...asset, ms: 9000 })) })).status).toBe(422);
    expect((await changeOf(edit)).status).toBe(200);
  });
});
