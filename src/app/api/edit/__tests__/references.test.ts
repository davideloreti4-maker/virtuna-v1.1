/**
 * references.test.ts — the references' routes (part 3, Task 11), in process: the real routes and schemas, the real style code
 * (the measures, the measured text, the sheet's frames, the judgement's reading and the style), the real R2 signing, supabase-js
 * and the worker's stills client. Stand-ins at the network only: Supabase's REST API, the bucket and the worker
 * (`stand-ins.ts`, with what a reference adds there: the bucket's PUT, list and DELETE, the REST API's DELETE, the worker's
 * `/stills`); the temporary copy a link is fetched into (here); the fetch of a link (`resolveAndRehost`: Apify and Supabase
 * storage); and Qwen (`askQwen`). Each is proved for real by `scripts/edit-reference-proof.ts`.
 *
 * The reference is made up: 30 s, two cuts with the face larger after each, white captions on a dark pill at 0.8 in inter at
 * 72 px, three words a page, and a title over its first two seconds.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/engine/remix/resolve-and-rehost", () => ({ resolveAndRehost: vi.fn() }));
vi.mock("@/lib/edit/agent/model", () => ({ askQwen: vi.fn() }));

import { readFileSync } from "node:fs";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAndRehost } from "@/lib/engine/remix/resolve-and-rehost";
import { askQwen, type Message } from "@/lib/edit/agent/model";
import { IngestError } from "@/lib/scraping/types";
import { TakeAnalysisSchema, type FaceSample, type TakeAnalysis, type TextLine, type TextSample } from "@/lib/edit/analysis";
import { measure } from "@/lib/edit/measure";
import { StyleProfileSchema } from "@/lib/edit/style";
import { JUDGE_TIMEOUT_MS, LEFT_OVER_MS, MAX_FETCHED_BYTES, ORPHANS, READING_ITS_LOOK, READ_CLAIM_MS, READ_STAGES, STAGES, UNREAD, UPLOAD_MARK, dropReference, stageOf } from "@/lib/edit/style/reference";
import { STALE_MS } from "@/lib/edit/worker/stale";
import { assetOf, firstEdit } from "@/lib/edit/worker/takes";
import { OTHER, TAKE, USER, jobRow, keyOf, takeRow, uploadingTake } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET, ENV, SHEET, standIns } from "@/lib/edit/worker/__tests__/stand-ins";
import type { JobRow } from "@/lib/edit/worker/jobs";
import type { TakeRow } from "@/lib/edit/worker/takes";
import { POST as create, maxDuration as createWaits } from "../references/route";
import { DELETE as stop, GET as read, POST as uploaded, maxDuration as readWaits } from "../references/[id]/route";
import { POST as render } from "../renders/route";
import { GET as getTake } from "../takes/[id]/route";
import { POST as takeUploaded } from "../takes/[id]/uploaded/route";
import { GET as listTakes } from "../takes/route";

/* ── the made-up reference ────────────────────────────────────────────────────────────────────── */

const MS = 30_000;
const CUTS = [10_000, 20_000];
const WHITE = { hex: "#ffffff", share: 0.3, from: 0.05, to: 0.95 };
const PILL = { hex: "#141210", share: 0.6, from: 0.02, to: 0.98 };
const VIDEO_RING = [{ hex: "#8a7a6a", share: 0.5 }, { hex: "#3a3028", share: 0.3 }, { hex: "#c8b8a8", share: 0.2 }];
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;
const line = (text: string, y: number, wide: number, over: Partial<TextLine> = {}, h = 0.04): TextLine => ({
  box: { x: round4(0.5 - wide / 2), y: round4(y - h / 2), w: round4(wide), h }, text, score: 0.98, colours: [PILL, WHITE], around: [{ hex: "#151311", share: 1 }], ...over,
});
/** A caption row's share of the picture's width as the kit sets it in inter at `size`, and the reader boxes it (11 px wider). */
const wideOf = (text: string, size: number) => {
  const words = text.split(" ");
  return (words.reduce((sum, word) => sum + measure(word, "inter", 800, size)!, 0) + 0.34 * size * (words.length - 1) + 11) / 1080;
};
const SAID = "make the first second count because people scroll past slow openings every single time so start with the point".split(" ");
/** The moments the worker reads a 30 s reference at (`moments` in worker/media/text.py). */
const MOMENTS = [...Array.from({ length: 16 }, (_, i) => 250 + i * 500), ...Array.from({ length: 24 }, (_, i) => 8000 + Math.floor(((i + 0.5) * (MS - 8000)) / 24))];
const TEXT: TextSample[] = MOMENTS.map((ms, i) => {
  const words = [0, 1, 2].map((k) => SAID[(i * 3 + k) % SAID.length]).join(" ");
  const title = ms < 2000 ? [line("Three things nobody tells you", 0.16, 0.8, { colours: [WHITE], around: VIDEO_RING }, 0.06)] : [];
  return { ms, lines: [...title, line(words, 0.8, wideOf(words, 72))] };
});
/** The face five times a second; a fifth larger in the shot after each cut, as a punch-in. */
const FACES: FaceSample[] = Array.from({ length: MS / 200 }, (_, i) => {
  const h = CUTS.some((cut) => i * 200 >= cut && i * 200 < cut + 4000) ? 0.36 : 0.3;
  return { ms: i * 200, face: { x: 0.3, y: 0.2, w: h * 0.6, h }, mouth: null };
});
const ANALYSIS: TakeAnalysis = TakeAnalysisSchema.parse({
  language: null,
  pauses: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26].map((s, i) => (i === 0 ? { startMs: 0, endMs: 300, cutMs: 150 } : { startMs: s * 1000, endMs: s * 1000 + 220, cutMs: s * 1000 + 110 })),
  faces: FACES,
  loudness: null,
  cuts: CUTS,
  picture: Array.from({ length: MS / 500 }, (_, i) => ({ ms: i * 500, luma: 0.48, sat: 0.07, warmth: 0.06 })),
  text: TEXT,
});
const probe = (w: number, h: number) => ({ videoMs: MS, audioMs: MS, ms: MS, w, h, fps: 30, codec: "h264", hdr: false, sound: true, rotation: 0 });
/** What R2 holds of a reference (Task 9c): its source as uploaded, and the sheet the worker made of it. No copy of it is kept. */
const FILES = ["source", "sheet.jpg"];
/** The twelve moments on its sheet, in cell order, as the worker chose them. */
const SHEET_MS = [500, 1500, 2500, 3500, 10_400, 20_400, 7600, 14_200, 17_000, 23_800, 26_600, 29_400];

/** A reference of the creator's, ready: its row as the worker writes it (Task 9c: its sheet, and no copies), its job done, its files in R2. */
function readyReference(world: ReturnType<typeof standIns>, id = TAKE, user = USER): { take: TakeRow; job: JobRow } {
  const take = takeRow({
    id, user_id: user, name: "reference.mp4", words: [],
    facts: { source: probe(1080, 1920), preview: probe(540, 960), ms: MS },
    analysis: { files: { sheet: keyOf("sheet.jpg", id, user) }, untimed: 0, apart: 0, gaveWay: 0, trimmed: 0, dropped: 0, fellBack: null, ...ANALYSIS, sheet: { file: "sheet.jpg", ms: SHEET_MS } },
    updated_at: new Date().toISOString(),
  });
  world.rest.put("edit_takes", take);
  const job = jobRow({ id: jobId(id), user_id: user, take_id: id, input: { reference: true }, status: "done", stage: null, progress: 1, result: { take: id, seconds: 20 }, updated_at: new Date().toISOString() });
  world.rest.put("edit_jobs", job);
  for (const name of FILES) world.bucket.objects.set(keyOf(name, id, user), 1000);
  const sheet = Buffer.from(SHEET, "base64");
  world.bucket.objects.set(keyOf("sheet.jpg", id, user), sheet.byteLength);
  world.bucket.contents.set(keyOf("sheet.jpg", id, user), sheet);
  return { take, job };
}
const jobId = (take: string) => `3333${take.slice(4)}`;

/* ── the temporary copy a link is fetched into ──────────────────────────────────────────────────── */

const COPY_URL = "https://storage.test/storage/v1/object/sign/videos/remix-temp/copy.mp4?token=t";
/** The temporary copy: its bytes, a status it answers with, or a response made as told. */
let copy: Uint8Array | number | (() => Response);
/** A PUT that R2 stores and whose answer is then lost (a 500 in its place). */
let losePutAnswer = false;
/** The network: the temporary copy here, the rest at the stand-ins. */
const network = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = input instanceof Request ? input.url : String(input);
  if (losePutAnswer && (init?.method ?? "GET") === "PUT") {
    await world.fetch(input, init);
    return new Response(null, { status: 500 });
  }
  if (url !== COPY_URL) return world.fetch(input, init);
  if (typeof copy === "function") return copy();
  return typeof copy === "number" ? new Response(null, { status: copy }) : new Response(Buffer.from(copy), { status: 200 });
};

/* ── the suite ────────────────────────────────────────────────────────────────────────────────── */

let world: ReturnType<typeof standIns>;
let signedIn: { id: string; is_anonymous?: boolean } | null;
let cleanup: Mock<() => Promise<void>>;
let logged: MockInstance<typeof console.error>;
let looked = 0;
const LINK = "https://www.tiktok.com/@someone/video/7000000000000000001";
const JUDGEMENT = { extras: [{ kind: "emoji", cells: [2, 7] }] };

beforeEach(() => {
  world = standIns();
  copy = new Uint8Array(4321).fill(7);
  losePutAnswer = false;
  signedIn = { id: USER, is_anonymous: false };
  vi.stubGlobal("fetch", network);
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.stubEnv("EDIT_CREATORS", USER);
  vi.mocked(createClient).mockImplementation(async () => world.session(signedIn) as never);
  vi.mocked(createServiceClient).mockImplementation(() => world.service() as never);
  cleanup = vi.fn<() => Promise<void>>(async () => undefined);
  vi.mocked(resolveAndRehost).mockImplementation(async () => ({ signedUrl: COPY_URL, cleanup, handle: "someone" }));
  vi.mocked(askQwen).mockImplementation(async () => ({ text: JSON.stringify(JUDGEMENT), usage: { input: 2000, output: 40 }, ms: 4500 }));
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  const unlooked = logged.mock.calls.length - looked;
  looked = 0;
  vi.restoreAllMocks();
  vi.mocked(resolveAndRehost).mockReset();
  vi.mocked(askQwen).mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(unlooked, "a route logged an error the test did not look at").toBe(0);
});
const errorsLogged = () => {
  looked = logged.mock.calls.length;
  return logged.mock.calls.map((args) => args.join(" ")).join("\n");
};

const post = (path: string, body: unknown = {}) => new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = (path: string) => new Request(`http://localhost:3000${path}`);
const by = (id: string) => ({ params: Promise.resolve({ id }) });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const poll = async (id = TAKE) => {
  const response = await read(get(`/api/edit/references/${id}`), by(id));
  return { status: response.status, body: await response.json() };
};
/** What is left of a reference: its objects in R2, its job rows, its take row. */
const leftOf = (id = TAKE, user = USER) => ({
  objects: [...world.bucket.objects.keys()].filter((key) => key.startsWith(`u/${user}/takes/${id}/`)),
  jobs: world.rest.tables.edit_jobs.filter((job) => job.take_id === id),
  takes: world.rest.tables.edit_takes.filter((take) => take.id === id),
});
const NOTHING = { objects: [], jobs: [], takes: [] };

describe("every reference route asks for a signed-in creator the edit tool is open to", () => {
  const calls = () => [create(post("/api/edit/references", { url: LINK })), read(get(`/api/edit/references/${TAKE}`), by(TAKE)), uploaded(post(`/api/edit/references/${TAKE}`), by(TAKE))];

  it("401s without a session and 403s a creator not in EDIT_CREATORS, before reading, fetching or writing anything", async () => {
    signedIn = null;
    for (const response of await Promise.all(calls())) expect(response.status).toBe(401);
    signedIn = { id: OTHER };
    for (const response of await Promise.all(calls())) expect(response.status).toBe(403);
    expect(world.rest.calls).toEqual([]);
    expect(resolveAndRehost).not.toHaveBeenCalled();
  });

  it("refuses a write from another origin", async () => {
    const forged = new Request("http://localhost:3000/api/edit/references", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ url: LINK }) });
    expect((await create(forged)).status).toBe(403);
    expect(resolveAndRehost).not.toHaveBeenCalled();
  });

  it("waits up to five minutes: the fetch waits on Apify, the read on the sheet and two judgements", () => {
    expect([createWaits, readWaits]).toEqual([300, 300]);
  });
});

describe("POST /api/edit/references with a link", () => {
  const call = (url: unknown = LINK) => create(post("/api/edit/references", { url }));

  it("fetches the link, puts it in R2 as the creator's take's source, and starts its analysis as a reference's", async () => {
    const response = await call();
    expect(response.status).toBe(202);
    const { id, ...rest } = await response.json();
    expect(rest).toEqual({});
    expect(resolveAndRehost).toHaveBeenCalledWith(LINK, expect.any(String));
    expect(world.bucket.objects.get(keyOf("source", id))).toBe(4321);
    expect(world.bucket.puts).toEqual([{ key: keyOf("source", id), type: "video/mp4", signedHeaders: "content-length;content-type;host" }]);
    expect(world.rest.row("edit_takes", id)).toMatchObject({ user_id: USER, name: "reference.mp4", bytes: 4321, source_path: keyOf("source", id), status: "analysing", analysis: UPLOAD_MARK });
    const [job] = world.rest.tables.edit_jobs;
    expect(job).toMatchObject({ user_id: USER, kind: "analyse", take_id: id, input: { reference: true }, status: "queued" });
    expect(world.worker.started).toEqual([job!.id]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("names a link's take after no one when the fetch names no creator", async () => {
    vi.mocked(resolveAndRehost).mockImplementation(async () => ({ signedUrl: COPY_URL, cleanup }));
    const { id } = await (await call()).json();
    expect(world.rest.row("edit_takes", id)).toMatchObject({ name: "reference.mp4" });
  });

  it("removes the temporary copy even when the put into R2 fails, and keeps nothing of it", async () => {
    world.bucket.failPut = 500;
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "something went wrong" });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(world.rest.tables.edit_takes).toEqual([]);
    expect(world.rest.tables.edit_jobs).toEqual([]);
    expect([...world.bucket.objects.keys()]).toEqual([]);
    expect(errorsLogged()).toContain("R2 answered 500 to the reference's upload");
  });

  it("removes the temporary copy when it cannot be read either", async () => {
    copy = 403;
    expect((await call()).status).toBe(500);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(world.bucket.puts).toEqual([]);
    expect(errorsLogged()).toContain("the reference's temporary copy answered 403");
  });

  it.each([
    ["an Instagram link", "https://www.instagram.com/reel/abc/"],
    ["a TikTok link over http", "http://www.tiktok.com/@someone/video/1"],
    ["a look-alike host", "https://www.tiktok.com.evil.example/@someone/video/1"],
    ["no link at all", "a video I liked"],
  ])("400s %s, and fetches nothing", async (_, url) => {
    const response = await call(url);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("a reference is a link to a TikTok video, or a file you upload");
    expect(resolveAndRehost).not.toHaveBeenCalled();
    expect(world.rest.calls.map((one) => [one.method, one.table]).sort()).toEqual([["GET", "edit_jobs"], ["GET", "edit_takes"]]); // the left-overs' reads only
  });

  it("takes the short and the bare TikTok addresses", async () => {
    for (const url of ["https://vm.tiktok.com/ZMabc123/", "https://tiktok.com/@someone/video/1"]) {
      expect((await call(url)).status).toBe(202);
      for (const job of world.rest.tables.edit_jobs) job.status = "done"; // one analysis at a time (A1): the last one has ended
    }
    expect(vi.mocked(resolveAndRehost).mock.calls.map(([url]) => url)).toEqual(["https://vm.tiktok.com/ZMabc123/", "https://tiktok.com/@someone/video/1"]);
  });

  it("400s a body that is neither a link nor a file, saying what it is", async () => {
    for (const body of [{}, { url: "" }, { link: LINK }, "x"]) {
      const response = await create(post("/api/edit/references", body));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/^the body is \{url\} or \{name, bytes, type\}/);
    }
    expect(resolveAndRehost).not.toHaveBeenCalled();
  });

  it("422s a video that is not there and 502s one that could not be fetched, in plain words, writing nothing", async () => {
    vi.mocked(resolveAndRehost).mockRejectedValueOnce(new IngestError("not_found", LINK));
    let response = await call();
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("that video could not be found: it may be private or taken down");
    vi.mocked(resolveAndRehost).mockRejectedValueOnce(new IngestError("scrape_failed", LINK, new Error("actor run failed")));
    response = await call();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("that video could not be fetched; try again, or upload it");
    expect(world.rest.tables.edit_takes).toEqual([]);
    expect(world.bucket.puts).toEqual([]);
  });

  it("409s while an analysis of the creator's is live, before anything is fetched (A1)", async () => {
    world.rest.put("edit_takes", takeRow({ id: "44444444-4444-4444-8444-444444444444", status: "analysing" }));
    world.rest.put("edit_jobs", jobRow({ take_id: "44444444-4444-4444-8444-444444444444", status: "running", updated_at: ago(5000) }));
    const response = await call();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("an analysis of yours is already running; try again when it ends");
    expect(resolveAndRehost).not.toHaveBeenCalled();
  });

  it("502s and drops it when the worker cannot start its analysis", async () => {
    world.worker.answer = 500;
    const response = await call();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "the worker could not start the job: it answered 500" });
    expect(world.rest.tables.edit_takes).toEqual([]);
    expect(world.rest.tables.edit_jobs).toEqual([]);
    expect([...world.bucket.objects.keys()]).toEqual([]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/edit/references with a file, then POST /api/edit/references/[id]", () => {
  it("signs an upload as a take's, and once it is in, starts its analysis as a reference's", async () => {
    const response = await create(post("/api/edit/references", { name: "liked.mp4", bytes: 4_893_635, type: "video/mp4" }));
    expect(response.status).toBe(202);
    const { id, upload } = await response.json();
    expect(world.rest.row("edit_takes", id)).toMatchObject({ user_id: USER, name: "reference.mp4", bytes: 4_893_635, status: "uploading", source_path: keyOf("source", id), analysis: UPLOAD_MARK });
    expect((await poll(id)).body).toEqual({ status: "analysing", stage: "getting the video", progress: 0 }); // signed for, not yet started
    expect(decodeURIComponent(new URL(upload).pathname)).toBe(`/${BUCKET}/${keyOf("source", id)}`);
    expect(new URL(upload).searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(world.rest.tables.edit_jobs).toEqual([]);
    expect(resolveAndRehost).not.toHaveBeenCalled();

    world.bucket.objects.set(keyOf("source", id), 4_893_635);
    const started = await uploaded(post(`/api/edit/references/${id}`), by(id));
    expect(started.status).toBe(202);
    expect(await started.json()).toEqual({ id });
    expect(world.rest.row("edit_takes", id)).toMatchObject({ status: "analysing" });
    expect(world.rest.tables.edit_jobs).toEqual([expect.objectContaining({ kind: "analyse", take_id: id, input: { reference: true }, status: "queued" })]);
    expect((await poll(id)).body).toEqual({ status: "analysing", stage: "getting the video", progress: 0 });
  });

  it("400s a file that is not a take's, as POST /api/edit/takes does", async () => {
    const response = await create(post("/api/edit/references", { name: "liked.webm", bytes: 10, type: "video/webm" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("a take is an MP4 or QuickTime video");
  });

  const signedFor = (over: Partial<TakeRow> = {}) => uploadingTake({ analysis: UPLOAD_MARK, ...over }); // as the upload's POST writes it
  const finish = (id = TAKE) => uploaded(post(`/api/edit/references/${id}`), by(id));

  it("409s an upload that has not arrived whole, and 404s another creator's take", async () => {
    world.rest.put("edit_takes", signedFor());
    world.bucket.objects.set(keyOf("source"), 10);
    let response = await finish();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("take.mp4 did not arrive whole: 10 of its 4893635 bytes are stored");
    world.rest.tables.edit_takes.length = 0;
    world.rest.put("edit_takes", signedFor({ user_id: OTHER }));
    response = await finish();
    expect(response.status).toBe(404);
    expect(world.rest.tables.edit_jobs).toEqual([]);
  });

  it("404s a creator's own upload, which was not signed for as a reference, and starts nothing", async () => {
    world.rest.put("edit_takes", uploadingTake()); // signed for at POST /api/edit/takes: no mark
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    expect(await (await finish()).json()).toEqual({ error: "no such reference" });
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading" });
    expect(world.rest.tables.edit_jobs).toEqual([]);
  });

  it("409s while an analysis of the creator's is live, at the sign and at the finish (A1)", async () => {
    world.rest.put("edit_takes", takeRow({ id: "44444444-4444-4444-8444-444444444444", status: "analysing" }));
    world.rest.put("edit_jobs", jobRow({ take_id: "44444444-4444-4444-8444-444444444444", status: "running", updated_at: ago(5000) }));
    const signing = await create(post("/api/edit/references", { name: "liked.mp4", bytes: 10, type: "video/mp4" }));
    expect(signing.status).toBe(409);
    expect(world.rest.tables.edit_takes).toHaveLength(1);
    world.rest.put("edit_takes", signedFor());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    const finished = await finish();
    expect(finished.status).toBe(409);
    expect((await finished.json()).error).toBe("an analysis of yours is already running; try again when it ends");
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading" });
  });

  it("502s and drops it when the worker cannot start its analysis", async () => {
    world.rest.put("edit_takes", signedFor());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    world.worker.answer = 500;
    const response = await finish();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "the worker could not start the job: it answered 500" });
    expect(leftOf()).toEqual(NOTHING);
  });

  it("puts it back to uploading when its job cannot be written, so a retry starts one", async () => {
    world.rest.put("edit_takes", signedFor());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    world.rest.failing = ({ method, table }) => method === "POST" && table === "edit_jobs";
    expect((await finish()).status).toBe(500);
    expect(errorsLogged()).toContain("the job could not be written");
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading", analysis: UPLOAD_MARK });
    world.rest.failing = null;
    expect((await finish()).status).toBe(202);
    expect(world.rest.tables.edit_jobs).toEqual([expect.objectContaining({ input: { reference: true } })]);
  });
});

describe("one analysis at a time holds across a link's fetch (A1)", () => {
  const SECOND = "https://www.tiktok.com/@someone/video/7000000000000000002";

  it("409s a link when a second link started its analysis during the first's fetch, and drops what the first fetched", async () => {
    let second: Response | undefined;
    vi.mocked(resolveAndRehost).mockImplementationOnce(async () => {
      second = await create(post("/api/edit/references", { url: SECOND })); // pasted again while the first was fetched
      return { signedUrl: COPY_URL, cleanup, handle: "someone" };
    });
    const first = await create(post("/api/edit/references", { url: LINK }));
    expect(second?.status).toBe(202);
    expect(first.status).toBe(409);
    expect((await first.json()).error).toBe("an analysis of yours is already running; try again when it ends");
    const { id } = (await second!.json()) as { id: string };
    expect(world.rest.tables.edit_takes.map((take) => take.id)).toEqual([id]);
    expect([...world.bucket.objects.keys()]).toEqual([keyOf("source", id)]); // the first's source dropped, the second's kept
    expect(world.rest.tables.edit_jobs).toEqual([expect.objectContaining({ take_id: id })]);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("409s a link when a take's upload finished during its fetch, and drops what was fetched", async () => {
    world.rest.put("edit_takes", uploadingTake());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    let finished: Response | undefined;
    vi.mocked(resolveAndRehost).mockImplementationOnce(async () => {
      finished = await takeUploaded(post(`/api/edit/takes/${TAKE}/uploaded`), by(TAKE));
      return { signedUrl: COPY_URL, cleanup, handle: "someone" };
    });
    const response = await create(post("/api/edit/references", { url: LINK }));
    expect(finished?.status).toBe(202);
    expect(response.status).toBe(409);
    expect(world.rest.tables.edit_takes.map((take) => [take.id, take.status])).toEqual([[TAKE, "analysing"]]);
    expect([...world.bucket.objects.keys()]).toEqual([keyOf("source")]);
  });
});

describe("a fetched video is held to its size before it is held in memory", () => {
  const call = () => create(post("/api/edit/references", { url: LINK }));

  it("422s a copy whose stated length is over the most, before a byte of it is read", async () => {
    let pulled = 0;
    copy = () => new Response(new ReadableStream({ pull: (controller) => (pulled++, controller.enqueue(new Uint8Array(10))) }), { headers: { "content-length": String(MAX_FETCHED_BYTES + 1) } });
    const response = await call();
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("that video is too large to read");
    expect(pulled).toBeLessThanOrEqual(1); // a stream may pull once on its own, before anything reads it
    expect(world.bucket.puts).toEqual([]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("422s a copy that runs past the most with no length stated, stopping at the chunk past it", async () => {
    const chunk = new Uint8Array(1024 ** 2); // one megabyte, given again and again
    let given = 0;
    copy = () => new Response(new ReadableStream({ pull: (controller) => (given++, controller.enqueue(chunk)) }));
    const response = await call();
    expect(response.status).toBe(422);
    expect(given).toBeLessThanOrEqual(MAX_FETCHED_BYTES / chunk.byteLength + 3);
    expect(world.bucket.puts).toEqual([]);
    expect(world.rest.tables.edit_takes).toEqual([]);
  });

  it("reads a copy of a stated length straight into its bytes, and refuses one that is not what it says", async () => {
    const bytes = new Uint8Array(5000).fill(3);
    copy = () => new Response(bytes, { headers: { "content-length": "5000" } });
    expect((await call()).status).toBe(202);
    expect(world.bucket.puts).toHaveLength(1);
    for (const job of world.rest.tables.edit_jobs) job.status = "done"; // one analysis at a time (A1): the last one has ended
    copy = () => new Response(bytes, { headers: { "content-length": "4000" } }); // says less than it holds
    expect((await call()).status).toBe(500);
    copy = () => new Response(bytes, { headers: { "content-length": "6000" } }); // says more than it holds
    expect((await call()).status).toBe(500);
    const log = errorsLogged();
    expect(log).toContain("the reference's temporary copy is longer than it says");
    expect(log).toContain("the reference's temporary copy is 5000 of the 6000 bytes it says");
    expect(world.bucket.puts).toHaveLength(1);
    expect(world.rest.tables.edit_takes).toHaveLength(1);
  });

  it("502s a copy that came back empty", async () => {
    copy = new Uint8Array(0);
    const response = await call();
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("that video came back empty; try again, or upload it");
    expect(world.bucket.puts).toEqual([]);
  });

  it("drops a source R2 stored though the PUT's answer was lost", async () => {
    losePutAnswer = true;
    expect((await call()).status).toBe(500);
    expect(errorsLogged()).toContain("R2 answered 500 to the reference's upload");
    expect(world.bucket.puts).toHaveLength(1);
    expect([...world.bucket.objects.keys()]).toEqual([]);
    expect(world.rest.tables.edit_takes).toEqual([]);
  });
});

describe("left-over references are dropped on the next POST /api/edit/references", () => {
  const old = new Date(Date.now() - LEFT_OVER_MS - 60_000).toISOString();
  const ids = { ready: TAKE, upload: "44444444-4444-4444-8444-444444444444", failed: "55555555-5555-4555-8555-555555555555", young: "66666666-6666-4666-8666-666666666666", own: "77777777-7777-4777-8777-777777777777", others: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

  it("drops this creator's references older than 90 minutes, in whatever state, and nothing else", async () => {
    readyReference(world, ids.ready); // made two days ago (rows.ts)
    world.rest.put("edit_takes", uploadingTake({ id: ids.upload, analysis: UPLOAD_MARK, created_at: old })); // an upload abandoned
    world.bucket.objects.set(keyOf("source", ids.upload), 10);
    world.rest.put("edit_takes", uploadingTake({ id: ids.failed, status: "failed", created_at: old }));
    world.rest.put("edit_jobs", jobRow({ id: "88888888-8888-4888-8888-888888888888", take_id: ids.failed, input: { reference: true }, status: "failed" }));
    readyReference(world, ids.young);
    Object.assign(world.rest.row("edit_takes", ids.young)!, { created_at: ago(LEFT_OVER_MS - 60_000) }); // under 90 minutes old: kept
    Object.assign(world.rest.row("edit_jobs", jobId(ids.young))!, { created_at: ago(LEFT_OVER_MS - 60_000) });
    world.rest.put("edit_takes", takeRow({ id: ids.own })); // the creator's own take, two days old: kept
    world.rest.put("edit_jobs", jobRow({ id: "99999999-9999-4999-8999-999999999999", take_id: ids.own, input: null, status: "done", stage: null }));
    world.bucket.objects.set(keyOf("source", ids.own), 10);
    readyReference(world, ids.others, OTHER); // another creator's: kept
    const late = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // signed for long ago, its upload finished late: touched under 90 minutes ago
    world.rest.put("edit_takes", uploadingTake({ id: late, status: "analysing", analysis: UPLOAD_MARK, created_at: old, updated_at: ago(LEFT_OVER_MS - 60_000) }));
    world.bucket.objects.set(keyOf("source", late), 10);

    expect((await create(post("/api/edit/references", { url: LINK }))).status).toBe(202);
    expect(leftOf(late)).toMatchObject({ takes: [expect.anything()], objects: [keyOf("source", late)] }); // kept: still being analysed
    for (const id of [ids.ready, ids.upload, ids.failed]) expect(leftOf(id)).toEqual(NOTHING);
    expect(leftOf(ids.young).takes).toHaveLength(1);
    expect(leftOf(ids.own)).toMatchObject({ takes: [expect.anything()], jobs: [expect.anything()], objects: [keyOf("source", ids.own)] });
    expect(leftOf(ids.others, OTHER)).toMatchObject({ objects: expect.arrayContaining([keyOf("source", ids.others, OTHER)]), jobs: [expect.anything()], takes: [expect.anything()] });
    const lines = vi.mocked(console.log).mock.calls.map((args) => args.join(" "));
    expect(lines.filter((line) => line.includes("left-over references dropped"))).toEqual([expect.stringContaining('"count":3')]);
  });

  it("drops them before anything else, even for a body it then refuses", async () => {
    readyReference(world);
    expect((await create(post("/api/edit/references", { url: "a video I liked" }))).status).toBe(400);
    expect(leftOf()).toEqual(NOTHING);
  });

  it("reads only what can be a reference: none of the creator's many ordinary takes, and no analysis", async () => {
    for (let i = 0; i < 300; i++) {
      const id = `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`;
      world.rest.put("edit_takes", takeRow({ id })); // two days old, ready, with its analysis
      world.rest.put("edit_jobs", jobRow({ id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`, take_id: id, input: null, status: "done", stage: null }));
    }
    readyReference(world, ids.upload);
    expect((await create(post("/api/edit/references", { url: LINK }))).status).toBe(202);
    expect(leftOf(ids.upload)).toEqual(NOTHING);
    const reads = world.rest.calls.filter((call) => call.method === "GET").map((call) => Object.fromEntries(call.query));
    expect(reads).toContainEqual(expect.objectContaining({ select: "take_id", kind: "eq.analyse", "input->>reference": "eq.true", user_id: `eq.${USER}` }));
    expect(reads).toContainEqual(expect.objectContaining({ select: "id", "analysis->>reference": "eq.true", status: "neq.ready", updated_at: expect.stringMatching(/^lt\./), user_id: `eq.${USER}` }));
    const sweep = reads.filter((query) => "input->>reference" in query || "analysis->>reference" in query);
    expect(sweep).toHaveLength(2);
    expect(sweep.map((query) => query.select)).toEqual(expect.arrayContaining(["take_id", "id"])); // no row read whole, no analysis
    expect(reads.filter((query) => (query.select ?? "*") === "*")).toEqual([]);
    expect(reads.filter((query) => [query.id, query.take_id].some((value) => String(value).startsWith("in.")))).toEqual([]); // no list of ids in a URL
    expect(world.rest.tables.edit_takes).toHaveLength(301); // the 300, and the new reference
  });

  it("never fails the request it runs in: a sweep whose read fails is logged by its kind, the other read still swept", async () => {
    readyReference(world, ids.upload);
    world.rest.put("edit_takes", uploadingTake({ id: ids.failed, analysis: UPLOAD_MARK, created_at: old })); // an upload abandoned
    world.rest.failingRead = ({ query }) => query.has("input->>reference"); // the sweep's read of reference jobs only
    expect((await create(post("/api/edit/references", { name: "liked.mp4", bytes: 10, type: "video/mp4" }))).status).toBe(202);
    const log = errorsLogged();
    expect(log).toContain("left-over references could not be read; the request goes on");
    expect(log).toContain('"kind":"reference jobs"');
    expect(leftOf(ids.failed)).toEqual(NOTHING); // the marked upload still swept
    expect(leftOf(ids.upload).takes).toHaveLength(1); // its reference job could not be read: kept for the next sweep
    world.rest.failingRead = ({ query }) => query.has("input->>reference") || query.has("analysis->>reference"); // both of the sweep's reads
    expect((await create(post("/api/edit/references", { name: "liked.mp4", bytes: 10, type: "video/mp4" }))).status).toBe(202);
    const both = errorsLogged();
    expect(both).toContain('"kind":"reference jobs"');
    expect(both).toContain('"kind":"marked uploads"');
  });
});

describe("DELETE /api/edit/references/[id]: the page stopped a read", () => {
  const del = (id = TAKE, origin?: string) =>
    stop(new Request(`http://localhost:3000/api/edit/references/${id}`, { method: "DELETE", headers: origin ? { origin } : {} }), by(id));

  it("drops the creator's reference now, whatever state it is in: analysing, signed for, or ready", async () => {
    world.rest.put("edit_takes", uploadingTake({ status: "analysing", analysis: UPLOAD_MARK }));
    world.rest.put("edit_jobs", jobRow({ input: { reference: true }, status: "running", stage: "text", updated_at: ago(1000) }));
    world.bucket.objects.set(keyOf("source"), 1000);
    const response = await del();
    expect(response.status).toBe(204);
    expect(leftOf()).toEqual(NOTHING);
    const upload = "44444444-4444-4444-8444-444444444444";
    world.rest.put("edit_takes", uploadingTake({ id: upload, analysis: UPLOAD_MARK })); // signed for, its upload never finished
    world.bucket.objects.set(keyOf("source", upload), 10);
    expect((await del(upload)).status).toBe(204);
    expect(leftOf(upload)).toEqual(NOTHING);
    readyReference(world, "55555555-5555-4555-8555-555555555555");
    expect((await del("55555555-5555-4555-8555-555555555555")).status).toBe(204);
    expect(leftOf("55555555-5555-4555-8555-555555555555")).toEqual(NOTHING);
    expect(askQwen).not.toHaveBeenCalled();
  });

  it("404s a real take's id, another creator's reference and an id that is no take's, and deletes nothing", async () => {
    world.rest.put("edit_takes", takeRow()); // the creator's own take
    world.rest.put("edit_jobs", jobRow({ input: null, status: "done", stage: null }));
    world.bucket.objects.set(keyOf("source"), 1000);
    readyReference(world, "55555555-5555-4555-8555-555555555555", OTHER);
    for (const id of [TAKE, "55555555-5555-4555-8555-555555555555", "../x"]) expect(await (await del(id)).json()).toEqual({ error: "no such reference" });
    expect(world.rest.calls.filter((call) => call.method !== "GET")).toEqual([]);
    expect(leftOf()).toMatchObject({ takes: [expect.anything()], jobs: [expect.anything()], objects: [keyOf("source")] });
    expect(leftOf("55555555-5555-4555-8555-555555555555", OTHER).objects).toHaveLength(2);
  });

  it("refuses a call from another origin, and one with no creator, deleting nothing", async () => {
    readyReference(world);
    expect((await del(TAKE, "https://evil.example")).status).toBe(403);
    signedIn = null;
    expect((await del()).status).toBe(401);
    expect(leftOf().takes).toHaveLength(1);
  });
});

describe("the sweep runs from GET /api/edit/takes too, and drops folders with no row", () => {
  const OLD = new Date(Date.now() - LEFT_OVER_MS - 60_000);
  const folder = (id: string, user = USER) => [keyOf("source", id, user), keyOf("sheet.jpg", id, user)];

  it("drops the creator's old references when the list is asked for, and lists none of them", async () => {
    readyReference(world); // analysed two days ago, never read: left over
    world.rest.put("edit_takes", takeRow({ id: "44444444-4444-4444-8444-444444444444" })); // the creator's own take
    const response = await listTakes();
    expect(response.status).toBe(200);
    expect((await response.json()).takes.map((take: { id: string }) => take.id)).toEqual(["44444444-4444-4444-8444-444444444444"]);
    expect(leftOf()).toEqual(NOTHING);
  });

  it("never fails the list: reads refused and R2 refusing to list still give the takes", async () => {
    world.rest.put("edit_takes", takeRow());
    world.rest.failingRead = ({ query }) => query.has("input->>reference") || query.has("analysis->>reference");
    world.bucket.failList = 500;
    const response = await listTakes();
    expect(response.status).toBe(200);
    expect((await response.json()).takes).toHaveLength(1);
    const log = errorsLogged();
    expect(log).toContain('"kind":"reference jobs"');
    expect(log).toContain('"kind":"folders with no row"');
  });

  it("drops a folder with no row once its files are older than 90 minutes, and no other", async () => {
    const [orphan, young, rowed, others] = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666", "77777777-7777-4777-8777-777777777777"];
    for (const key of [...folder(orphan), ...folder(rowed), ...folder(others, OTHER)]) {
      world.bucket.objects.set(key, 10);
      world.bucket.modified.set(key, OLD);
    }
    for (const key of folder(young)) world.bucket.objects.set(key, 10); // written just now: a link being fetched, say
    world.rest.put("edit_takes", takeRow({ id: rowed })); // the creator's own take, with its files
    world.bucket.objects.set(`u/${USER}/takes/not-a-take/x`, 10); // nothing the app would write: never touched
    world.bucket.modified.set(`u/${USER}/takes/not-a-take/x`, OLD);
    await listTakes();
    const left = [...world.bucket.objects.keys()];
    expect(left).not.toContain(keyOf("source", orphan));
    expect(left).toEqual(expect.arrayContaining([...folder(young), ...folder(rowed), ...folder(others, OTHER), `u/${USER}/takes/not-a-take/x`]));
    expect(world.rest.row("edit_takes", rowed)).toBeDefined();
  });

  it("fails closed: a folder whose row the creator's session cannot see is left alone, files and row", async () => {
    const hidden = "44444444-4444-4444-8444-444444444444";
    world.rest.put("edit_takes", takeRow({ id: hidden })); // its row exists
    for (const key of folder(hidden)) {
      world.bucket.objects.set(key, 10);
      world.bucket.modified.set(key, OLD);
    }
    // Rules that would hide it from the creator's own reads (a policy changed, say): their session no longer sees the row.
    const rest = world.rest.handle.bind(world.rest);
    vi.spyOn(world.rest, "handle").mockImplementation(async (url, init) => {
      const answer = await rest(url, init);
      const session = new Headers(init.headers).get("authorization")?.startsWith("Bearer user:");
      if (!session || url.pathname !== "/rest/v1/edit_takes" || (init.method ?? "GET") !== "GET") return answer;
      const rows = (await answer.json()) as { id: string }[];
      return new Response(JSON.stringify(Array.isArray(rows) ? rows.filter((row) => row.id !== hidden) : rows), { status: answer.status, headers: answer.headers });
    });
    await listTakes();
    expect(leftOf(hidden)).toMatchObject({ takes: [expect.anything()], objects: expect.arrayContaining(folder(hidden)) });
    expect(leftOf(hidden).objects).toHaveLength(2);
    expect(world.rest.calls.filter((call) => call.method === "DELETE")).toEqual([]);
  });

  it("drops at most ten such folders a sweep, logged by their count, and the rest at the next", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `${String(i).padStart(8, "0")}-4444-4444-8444-444444444444`);
    for (const id of ids) for (const key of folder(id)) {
      world.bucket.objects.set(key, 10);
      world.bucket.modified.set(key, OLD);
    }
    await listTakes();
    expect([...world.bucket.objects.keys()]).toHaveLength(2 * (12 - ORPHANS.folders));
    await listTakes();
    expect([...world.bucket.objects.keys()]).toEqual([]);
    const counts = vi.mocked(console.log).mock.calls.map((args) => args.join(" ")).filter((line) => line.includes("folders with no row dropped"));
    expect(counts).toEqual([expect.stringContaining('"count":10'), expect.stringContaining('"count":2')]);
  });
});

describe("a reference's maker and the creator's file are never named", () => {
  const HANDLE = "jane.creator";
  const PERSON = "Jane Doe dancing";
  /** Everything the routes wrote, logged or answered, as one text. */
  const said = (answers: unknown[]) =>
    JSON.stringify([world.rest.tables, answers, ...["log", "warn", "error"].map((level) => vi.mocked(console[level as "log"]).mock.calls)]);

  it("in the take row, the job, the profile, a log or an answer, from a link whose page names its maker", async () => {
    vi.mocked(resolveAndRehost).mockImplementation(async () => ({ signedUrl: COPY_URL, cleanup, handle: HANDLE }));
    const answers: unknown[] = [];
    const made = await create(post("/api/edit/references", { url: LINK }));
    const { id } = (await made.json()) as { id: string };
    answers.push(id);
    expect(world.rest.row("edit_takes", id)).toMatchObject({ name: "reference.mp4" });
    // The worker reads it (its row as the worker writes it), and the page reads its style.
    const ready = readyReference(world, "55555555-5555-4555-8555-555555555555");
    Object.assign(world.rest.row("edit_takes", id)!, { status: "ready", facts: ready.take.facts, analysis: ready.take.analysis, words: [] });
    Object.assign(world.rest.tables.edit_jobs.find((job) => job.take_id === id)!, { status: "done", stage: null, progress: 1 });
    const style = await poll(id);
    answers.push(style.body);
    expect(style.body).toMatchObject({ status: "ready", style: { source: { kind: "reference", name: null } } });
    expect(said(answers)).not.toContain(HANDLE);
    errorsLogged();
  });

  it("from an upload named after a person, to the worker's failure line", async () => {
    const signed = await create(post("/api/edit/references", { name: `${PERSON}.mov`, bytes: 10, type: "video/quicktime" }));
    const { id } = (await signed.json()) as { id: string };
    const row = world.rest.row("edit_takes", id)!;
    expect(row).toMatchObject({ name: "reference.mov" });
    world.bucket.objects.set(keyOf("source", id), 10);
    expect((await uploaded(post(`/api/edit/references/${id}`), by(id))).status).toBe(202);
    // The worker's lines name the file by the row's name (worker/media/analyse.py, `not_too_long`).
    const line = `${row.name} is longer than 3 minutes (it is 3:12)`;
    Object.assign(world.rest.tables.edit_jobs.find((job) => job.take_id === id)!, { status: "failed", error: line, stage: "copies" });
    const failed = await poll(id);
    expect(failed.body).toEqual({ status: "failed", error: "reference.mov is longer than 3 minutes (it is 3:12)" });
    expect(said([failed.body])).not.toContain("Jane");
  });
});

describe("a reference is never a take to the rest of the app", () => {
  it("404s a reference at GET /api/edit/takes/[id], ready or signed for, and writes nothing", async () => {
    readyReference(world);
    const take = await getTake(get(`/api/edit/takes/${TAKE}`), by(TAKE));
    expect([take.status, await take.json()]).toEqual([404, { error: "no such take" }]);
    world.rest.put("edit_takes", uploadingTake({ id: "44444444-4444-4444-8444-444444444444", analysis: UPLOAD_MARK }));
    expect((await getTake(get("/api/edit/takes/44444444-4444-4444-8444-444444444444"), by("44444444-4444-4444-8444-444444444444"))).status).toBe(404);
    expect(world.rest.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("404s an edit that uses a reference at POST /api/edit/renders, and starts nothing", async () => {
    const { take } = readyReference(world);
    const response = await render(post("/api/edit/renders", { edit: firstEdit(assetOf(takeRow({ id: take.id }), BUCKET)) })); // an edit of its id, as a take's would be
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "no such take", problems: [{ path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not one of your takes` }] });
    expect(world.rest.tables.edit_jobs.filter((job) => job.kind === "render")).toEqual([]);
    expect(world.worker.started).toEqual([]);
  });

  it("does not write a creator's own stale take job failed when its id is asked for as a reference", async () => {
    world.rest.put("edit_takes", uploadingTake({ status: "analysing" }));
    world.rest.put("edit_jobs", jobRow({ status: "running", updated_at: ago(STALE_MS + 1000) }));
    expect((await poll()).status).toBe(404);
    expect(world.rest.tables.edit_jobs).toEqual([expect.objectContaining({ status: "running" })]);
    expect(world.rest.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("404s an upload signed for as a reference at POST /api/edit/takes/[id]/uploaded, and starts nothing", async () => {
    world.rest.put("edit_takes", uploadingTake({ analysis: UPLOAD_MARK }));
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    const response = await takeUploaded(post(`/api/edit/takes/${TAKE}/uploaded`), by(TAKE));
    expect([response.status, await response.json()]).toEqual([404, { error: "no such take" }]);
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading", analysis: UPLOAD_MARK });
    expect(world.rest.tables.edit_jobs).toEqual([]);
    expect(world.worker.started).toEqual([]);
  });

  it("drops nothing for an id that is no take's", async () => {
    readyReference(world);
    await dropReference(world.service(), USER, "../x");
    expect(errorsLogged()).toContain("a reference's drop was asked for an id that is no take's; nothing was dropped");
    expect(leftOf().objects).toHaveLength(2);
    expect(world.rest.calls).toEqual([]);
  });
});

describe("GET /api/edit/references/[id] while it is analysed", () => {
  it("tells what is happening in a creator's words, with the worker's progress", async () => {
    world.rest.put("edit_takes", uploadingTake({ status: "analysing" }));
    const job = world.rest.put("edit_jobs", jobRow({ input: { reference: true }, status: "queued", stage: null, progress: 0, updated_at: ago(1000) }));
    expect((await poll()).body).toEqual({ status: "analysing", stage: "getting the video", progress: 0 });
    const seen: Record<string, string> = {};
    for (const stage of ["fetching", "copies", "words", "faces", "cuts", "picture", "text", "loudness", "storing"]) {
      Object.assign(job, { status: "running", stage, progress: 0.5, updated_at: new Date().toISOString() });
      const { body } = await poll();
      expect(body).toMatchObject({ status: "analysing", progress: 0.5 });
      seen[stage] = body.stage;
    }
    expect(seen).toEqual({
      fetching: "getting the video", copies: "getting the video", words: "reading its cuts", faces: "reading its cuts", cuts: "reading its cuts",
      picture: "reading its cuts", text: "reading its text", loudness: "reading its text", storing: "reading its text",
    });
    expect(askQwen).not.toHaveBeenCalled();
    expect(leftOf().takes).toHaveLength(1);
  });

  it("maps every stage the worker names, and nothing else, to the creator's words (worker/media/analyse.py, worker/store.py)", () => {
    const analyse = readFileSync("worker/media/analyse.py", "utf8");
    const store = readFileSync("worker/store.py", "utf8");
    const stages = [...(analyse.match(/^STAGES = \(([^)]*)\)/m)?.[1] ?? "").matchAll(/"(\w+)"/g)].map((match) => match[1]!);
    const job = store.slice(store.indexOf("def analyse_job"), store.indexOf("\ndef ", store.indexOf("def analyse_job") + 1));
    const told = [...job.matchAll(/progress\.tell\("(\w+)"/g)].map((match) => match[1]!);
    expect(stages).toEqual(["copies", "words", "faces", "cuts", "picture", "text", "loudness"]);
    expect(told).toEqual(["fetching", "storing"]);
    for (const stage of [...told, ...stages]) expect(STAGES).toContain(stageOf({ status: "running", stage }));
    expect(stageOf({ status: "running", stage: "a stage not yet named" })).toBe("reading its cuts");
    expect(stageOf({ status: "running", stage: "toString" })).toBe("reading its cuts"); // no name of an object's own
    expect(stageOf({ status: "done", stage: null })).toBe("done");
  });

  it("gives the worker's plain line for a reference over three minutes, as its analysis reports it, and drops it", async () => {
    const line = "@someone.mp4 is longer than 3 minutes (it is 3:12)";
    world.rest.put("edit_takes", uploadingTake({ status: "failed", error: line }));
    world.rest.put("edit_jobs", jobRow({ input: { reference: true }, status: "failed", error: line, stage: "copies", updated_at: ago(1000) }));
    world.bucket.objects.set(keyOf("source"), 1000);
    expect(await poll()).toEqual({ status: 200, body: { status: "failed", error: line } });
    expect(leftOf()).toEqual(NOTHING);
    expect((await poll()).status).toBe(404);
  });

  it("fails and drops a reference whose worker stopped (X41)", async () => {
    world.rest.put("edit_takes", uploadingTake({ status: "analysing" }));
    world.rest.put("edit_jobs", jobRow({ input: { reference: true }, status: "running", stage: "text", updated_at: ago(STALE_MS + 1000) }));
    expect((await poll()).body).toEqual({ status: "failed", error: "the worker stopped" });
    expect(leftOf()).toEqual(NOTHING);
  });
});

describe("GET /api/edit/references/[id] once it is ready", () => {
  it("reads the sheet the worker made, has Qwen judge it, gives the style, and drops every object, job row and take row of it", async () => {
    readyReference(world);
    const own = takeRow({ id: "55555555-5555-4555-8555-555555555555" }); // a take of the creator's own, which stays
    world.rest.put("edit_takes", own);
    world.bucket.objects.set(keyOf("source", own.id), 1000);
    let whenJudged: ReturnType<typeof leftOf> | null = null;
    vi.mocked(askQwen).mockImplementation(async () => {
      whenJudged = leftOf();
      return { text: JSON.stringify(JUDGEMENT), usage: { input: 2000, output: 40 }, ms: 4500 };
    });

    const { status, body } = await poll();
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ready", style: expect.any(Object), judged: true });
    const style = StyleProfileSchema.parse(body.style);
    expect(style.source).toEqual({ kind: "reference", name: null }); // never named (A-I2)
    expect(style.captions).toMatchObject({ on: true, look: "pill", font: "inter", maxWords: 3 });
    expect(style.captions.y).toBeCloseTo(0.8, 2);
    expect(Math.abs(style.captions.size - 72)).toBeLessThanOrEqual(3);
    expect(style.title).toMatchObject({ on: true });
    expect(style.title!.y).toBeCloseTo(0.16, 2);
    expect(style.pace.cutsPerMin).toBe(4);
    expect(style.punchIns).not.toBeNull();
    expect(style.look).toEqual({ preset: "natural" }); // mono by measure, else natural: the grade is not judged (Task 9c)
    expect(style.notMatched).toContain("emoji");

    // The sheet: the one the worker made and stored, read from R2; nothing drawn (no `/stills`), no copy of the reference asked for.
    expect(world.worker.stillsAsked).toEqual([]);
    // Its judgement (two calls whose extras must agree, Task 9c), of that sheet, told its moments and what was read already, held to its time.
    expect(askQwen).toHaveBeenCalledTimes(2);
    const [messages, options] = vi.mocked(askQwen).mock.calls[0]!;
    const content = (messages as Message[])[1]!.content as { type: string; text?: string; image_url?: { url: string } }[];
    expect(content.find((part) => part.type === "image_url")?.image_url?.url).toBe(`data:image/jpeg;base64,${SHEET}`);
    const told = content.map((part) => part.text ?? "").join(" ");
    expect(told).toContain("12 frames");
    expect(told).toContain("cell 0: 0.5 s, cell 1: 1.5 s");
    expect(told).toContain("cell 11: 29.4 s");
    expect(told).toContain('"Three things nobody tells you"');
    expect(options).toMatchObject({ thinking: false, signal: expect.any(AbortSignal) });
    expect(JUDGE_TIMEOUT_MS).toBe(30_000);

    // Dropped only after the style was made: whole while Qwen judged it, gone after.
    expect([whenJudged!.objects.length, whenJudged!.jobs.length, whenJudged!.takes.length]).toEqual([2, 1, 1]);
    expect(leftOf()).toEqual(NOTHING);
    expect(world.rest.row("edit_takes", own.id)).toBeDefined();
    expect(world.bucket.objects.has(keyOf("source", own.id))).toBe(true);
    expect((await poll()).status).toBe(404);
  });

  it("still gives the style when Qwen's judgement fails, from the measures alone, and says so", async () => {
    readyReference(world);
    vi.mocked(askQwen).mockRejectedValue(new Error("DashScope answered 503"));
    const { body } = await poll();
    expect(body).toMatchObject({ status: "ready", judged: false });
    expect(body.style.look).toEqual({ preset: "natural" });
    expect(body.style.notMatched).not.toContain("emoji");
    expect(body.style.captions).toMatchObject({ on: true, look: "pill" });
    expect(leftOf()).toEqual(NOTHING);
  });

  it.each([
    ["has no sheet (its stage failed, or it was made before the worker made sheets)", "its analysis has no sheet"],
    ["has a sheet R2 will not give", "R2 answered 500 to a read of its sheet"],
  ])("still gives the style when its analysis %s, and does not ask Qwen", async (_, why) => {
    const { take } = readyReference(world);
    if (why.startsWith("its analysis")) {
      const { sheet: _sheet, ...rest } = take.analysis as Record<string, unknown>;
      Object.assign(world.rest.row("edit_takes", take.id)!, { analysis: rest });
    } else world.bucket.failGet = 500;
    const { body } = await poll();
    expect(body).toMatchObject({ status: "ready", judged: false, style: { captions: { on: true }, look: { preset: "natural" } } });
    expect(askQwen).not.toHaveBeenCalled();
    // One log line for the read, why there was no sheet in it; no line of its own.
    const lines = [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.warn).mock.calls].map((args) => args.join(" "));
    expect(lines.filter((line) => line.includes("a reference was read"))).toEqual([expect.stringContaining(`"unsheeted":"${why}"`)]);
    expect(lines.filter((line) => line.includes("sheet") && !line.includes("a reference was read"))).toEqual([]);
    expect(leftOf()).toEqual(NOTHING);
  });

  it("reads it once when two polls come at once: the other is told it is reading its look", async () => {
    readyReference(world);
    const answers = (await Promise.all([poll(), poll()])).map((answer) => answer.body);
    expect(answers).toContainEqual({ status: "analysing", stage: "reading its look", progress: 1 });
    expect(answers).toContainEqual(expect.objectContaining({ status: "ready", judged: true }));
    expect(askQwen).toHaveBeenCalledTimes(2); // one judgement (its two calls), not two
    expect(leftOf()).toEqual(NOTHING);
  });

  it("waits on a read under way, and takes over a first read that died as the second", async () => {
    const { job } = readyReference(world);
    const row = world.rest.row("edit_jobs", job.id)!;
    Object.assign(row, { stage: READ_STAGES.first, updated_at: ago(60_000) });
    expect((await poll()).body).toEqual({ status: "analysing", stage: "reading its look", progress: 1 });
    expect(leftOf().takes).toHaveLength(1);
    Object.assign(row, { updated_at: ago(READ_CLAIM_MS + 1000) });
    expect((await poll()).body).toMatchObject({ status: "ready", judged: true });
    expect(leftOf()).toEqual(NOTHING);
  });

  it("gives a first read's claim back when it throws, keeping the reference, so the next poll reads it again at once", async () => {
    const { job, take } = readyReference(world);
    const row = world.rest.row("edit_takes", take.id)!;
    Object.assign(row, { facts: { ...(take.facts as object), ms: undefined } }); // a row it cannot read this once: no length
    const failed = await poll();
    expect(failed).toEqual({ status: 200, body: { status: "analysing", stage: READING_ITS_LOOK, progress: 1 } }); // so the page polls on
    const log = errorsLogged();
    expect(log).toContain("a reference's first read failed; the next poll reads it again");
    expect(log).toContain("its row holds no length");
    expect(world.rest.row("edit_jobs", job.id)).toMatchObject({ status: "done", stage: READ_STAGES.failed });
    const kept = leftOf();
    expect([kept.objects.length, kept.jobs.length, kept.takes.length]).toEqual([2, 1, 1]);
    Object.assign(row, { facts: take.facts });
    expect((await poll()).body).toMatchObject({ status: "ready", judged: true }); // at once: no three minutes' wait
    expect(leftOf()).toEqual(NOTHING);
  });

  it("drops it and answers failed when the second read throws too; a later GET is 404", async () => {
    const { take } = readyReference(world);
    const row = world.rest.row("edit_takes", take.id)!;
    Object.assign(row, { analysis: { ...(row.analysis as object), cuts: undefined } }); // an analysis the measures refuse, every time
    expect((await poll()).body).toEqual({ status: "analysing", stage: READING_ITS_LOOK, progress: 1 });
    expect(leftOf().takes).toHaveLength(1);
    expect(await poll()).toEqual({ status: 200, body: { status: "failed", error: UNREAD } });
    const log = errorsLogged();
    expect(log).toContain("the analysis has no cuts or picture");
    expect(log).toContain("a reference could not be read twice; it is dropped");
    expect(leftOf()).toEqual(NOTHING);
    expect((await poll()).status).toBe(404);
  });

  it("drops it and answers failed when the second read died", async () => {
    const { job } = readyReference(world);
    Object.assign(world.rest.row("edit_jobs", job.id)!, { stage: READ_STAGES.second, updated_at: ago(READ_CLAIM_MS + 1000) });
    expect((await poll()).body).toEqual({ status: "failed", error: UNREAD });
    expect(errorsLogged()).toContain("its second read did not end");
    expect(leftOf()).toEqual(NOTHING);
    expect(world.worker.stillsAsked).toEqual([]);
  });

  it("answers 404 for a real take's id, and deletes nothing", async () => {
    const own = takeRow(); // a creator's own ready take: its analysis asked as a take's (no input), not a reference's
    world.rest.put("edit_takes", own);
    world.rest.put("edit_jobs", jobRow({ take_id: own.id, input: null, status: "done", stage: null, progress: 1, updated_at: ago(1000) }));
    for (const name of FILES) world.bucket.objects.set(keyOf(name), 1000);
    expect(await poll()).toEqual({ status: 404, body: { error: "no such reference" } });
    expect(leftOf()).toMatchObject({ objects: FILES.map((name) => keyOf(name)), jobs: [expect.objectContaining({ status: "done", stage: null })], takes: [expect.objectContaining({ id: own.id, status: "ready" })] });
    expect(world.rest.calls.filter((call) => call.method !== "GET")).toEqual([]);
    expect(world.worker.stillsAsked).toEqual([]);
  });

  it("404s another creator's reference and an id that is no take's, and drops nothing", async () => {
    readyReference(world, TAKE, OTHER);
    expect(await poll()).toEqual({ status: 404, body: { error: "no such reference" } });
    expect(leftOf(TAKE, OTHER).takes).toHaveLength(1);
    expect(leftOf(TAKE, OTHER).objects).toHaveLength(2);
    expect((await poll("../x")).status).toBe(404);
    expect(world.worker.stillsAsked).toEqual([]);
    expect(world.rest.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("still deletes the rows when R2 will not delete its files, and logs what is left", async () => {
    readyReference(world);
    world.bucket.failDelete = 500;
    const { body } = await poll();
    expect(body).toMatchObject({ status: "ready", judged: true });
    const left = leftOf();
    expect(left.jobs).toEqual([]);
    expect(left.takes).toEqual([]);
    expect(left.objects).toHaveLength(2);
    expect(errorsLogged()).toContain("a reference's files could not be dropped");
    expect((await poll()).status).toBe(404);
    // The sweep's half: the files have no row now, and once they are older than 90 minutes the next sweep finds their folder.
    world.bucket.failDelete = null;
    await listTakes();
    expect(leftOf().objects).toHaveLength(2); // not yet: they could still be being written
    for (const key of left.objects) world.bucket.modified.set(key, new Date(Date.now() - LEFT_OVER_MS - 60_000));
    await listTakes();
    expect(leftOf()).toEqual(NOTHING);
    expect(vi.mocked(console.log).mock.calls.map((args) => args.join(" ")).filter((line) => line.includes("folders with no row dropped"))).toEqual([expect.stringContaining('"count":1')]);
  });

  it("still empties R2 when its take row will not go, and leaves it a reference: never a take of the creator's own", async () => {
    readyReference(world);
    world.rest.failing = ({ method }) => method === "DELETE";
    expect((await poll()).body).toMatchObject({ status: "ready" });
    expect(leftOf().objects).toEqual([]);
    expect(errorsLogged()).toContain("a reference's take could not be dropped");
    // The take and its job went, or stayed, together: it still reads as a reference everywhere.
    expect([leftOf().takes.length, leftOf().jobs.length]).toEqual([1, 1]);
    expect((await getTake(get(`/api/edit/takes/${TAKE}`), by(TAKE))).status).toBe(404);
  });

  it("drops the files, then the take row with its jobs in one statement, never the jobs alone", async () => {
    readyReference(world);
    const order: string[] = [];
    const rest = world.rest.handle.bind(world.rest);
    const bucket = world.bucket.handle.bind(world.bucket);
    vi.spyOn(world.rest, "handle").mockImplementation(async (url, init) => {
      if ((init.method ?? "GET").toUpperCase() === "DELETE") order.push(`delete ${url.pathname.replace("/rest/v1/", "")}`);
      return rest(url, init);
    });
    vi.spyOn(world.bucket, "handle").mockImplementation(async (url, init) => {
      if ((init.method ?? "GET").toUpperCase() === "DELETE") order.push(`delete ${url.pathname.split("/").at(-1)}`);
      return bucket(url, init);
    });
    await poll();
    // Files first: should the take's delete fail, its row (and its job) stay a reference the sweep finds by its age; should a
    // file's delete fail, the row goes all the same and the sweep finds the folder with no row (`dropOrphanFolders`).
    expect(order).toHaveLength(3);
    expect(order.slice(0, 2).sort()).toEqual(["delete sheet.jpg", "delete source"]); // its two files, side by side
    expect(order[2]).toBe("delete edit_takes");
    const steps = world.rest.calls.filter((call) => call.method === "DELETE").map((call) => [call.table, Object.fromEntries(call.query)]);
    expect(steps).toEqual([["edit_takes", { id: `eq.${TAKE}`, user_id: `eq.${USER}` }]]);
    expect(leftOf()).toEqual(NOTHING); // its jobs with it, as the key cascades
  });
});
