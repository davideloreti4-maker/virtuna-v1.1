/**
 * routes.test.ts — the edit tool's five routes (worker plan, Task 7), in process, with the real edit code
 * (`EditSchema`, `checkEdit`, `applyOps`), the real R2 signing and the real supabase-js. The boundaries stand
 * in at `fetch` (Supabase's REST API with the tables' grants, the bucket, the worker's `/start`; see
 * `stand-ins.ts`); each is proved for real by `scripts/edit-worker-proof.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkEdit, coverFrame, type Edit } from "@/lib/edit";
import { UPLOAD_MARK } from "@/lib/edit/style/reference";
import { STALE_MS } from "@/lib/edit/worker/stale";
import { assetOf, copiesOf, firstEdit } from "@/lib/edit/worker/takes";
import { OTHER, TAKE, USER, WORDS, jobRow, keyOf, takeRow, uploadingTake } from "@/lib/edit/worker/__tests__/rows";
import { BUCKET, ENV, R2_ACCOUNT, standIns } from "@/lib/edit/worker/__tests__/stand-ins";
import { GET as getJob } from "../jobs/[id]/route";
import { POST as render, maxDuration as renderWaits } from "../renders/route";
import { GET as getTake } from "../takes/[id]/route";
import { POST as uploaded, maxDuration as uploadedWaits } from "../takes/[id]/uploaded/route";
import { GET as listTakes, POST as createTake } from "../takes/route";

let world: ReturnType<typeof standIns>;
let signedIn: { id: string; is_anonymous?: boolean } | null;
/** The routes' error log: quiet in the suite, and read by the tests of what is logged. */
let logged: MockInstance<typeof console.error>;
/** How many of the logged errors a test has looked at: any other one fails it. */
let looked = 0;

beforeEach(() => {
  world = standIns();
  signedIn = { id: USER, is_anonymous: false };
  vi.stubGlobal("fetch", world.fetch);
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.stubEnv("EDIT_CREATORS", USER); // the edit tool is open to this creator (A1)
  vi.mocked(createClient).mockImplementation(async () => world.session(signedIn) as never);
  vi.mocked(createServiceClient).mockImplementation(() => world.service() as never);
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  const unlooked = logged.mock.calls.length - looked;
  looked = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(unlooked, "a route logged an error the test did not look at").toBe(0); // after the clean-up, so one test's failure stays its own
});
/** What the routes logged as errors, joined; the test has looked at it. */
const errorsLogged = () => {
  looked = logged.mock.calls.length;
  return logged.mock.calls.map((args) => args.join(" ")).join("\n");
};

const post = (path: string, body: unknown = {}, type = "application/json") =>
  new Request(`http://localhost:3000${path}`, { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (path: string) => new Request(`http://localhost:3000${path}`);
const by = (id: string) => ({ params: Promise.resolve({ id }) });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const r2Path = (url: string) => decodeURIComponent(new URL(url).pathname);

describe("every route asks for a signed-in creator", () => {
  const calls = () => [
    createTake(post("/api/edit/takes", { name: "take.mp4", bytes: 10, type: "video/mp4" })),
    uploaded(post(`/api/edit/takes/${TAKE}/uploaded`), by(TAKE)),
    getTake(get(`/api/edit/takes/${TAKE}`), by(TAKE)),
    getJob(get("/api/edit/jobs/x"), by("x")),
    render(post("/api/edit/renders", { edit: {} })),
  ];

  it("401s without a session, before reading or writing anything", async () => {
    signedIn = null;
    for (const response of await Promise.all(calls())) expect(response.status).toBe(401);
    expect(world.rest.calls).toEqual([]);
  });

  it("503s when the sign-in service cannot be asked, and 401s a session it refused", async () => {
    const answer = (error: Error) => vi.mocked(createClient).mockImplementation(async () => Object.assign(world.session(null), { auth: { getUser: async () => ({ data: { user: null }, error }) } }) as never);
    answer(new AuthRetryableFetchError("fetch failed", 0));
    for (const response of await Promise.all(calls())) expect(response.status).toBe(503);
    expect(errorsLogged()).toContain("the sign-in service could not be asked");
    answer(new AuthApiError("too many requests", 429, "over_request_rate_limit")); // 143: the service, not the session
    for (const response of await Promise.all(calls())) expect(response.status).toBe(503);
    expect(errorsLogged()).toContain("the sign-in service could not be asked");
    answer(new AuthApiError("invalid JWT", 403, "bad_jwt"));
    for (const response of await Promise.all(calls())) expect(response.status).toBe(401);
    expect(world.rest.calls).toEqual([]);
  });

  it("401s an anonymous visitor's session", async () => {
    signedIn = { id: USER, is_anonymous: true };
    for (const response of await Promise.all(calls())) expect(response.status).toBe(401);
    expect(world.rest.calls).toEqual([]);
  });

  it.each([
    ["not set", undefined],
    ["empty", " , "],
    ["naming others only", `${OTHER},22222222-0000-4000-8000-000000000000`],
  ])("403s a signed-in creator the edit tool is not open to, when EDIT_CREATORS is %s, before reading or writing anything (A1)", async (_, creators) => {
    if (creators === undefined) delete process.env.EDIT_CREATORS;
    else vi.stubEnv("EDIT_CREATORS", creators);
    for (const response of await Promise.all(calls())) {
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "the edit tool is not open to this account yet" });
    }
    expect(world.rest.calls).toEqual([]);
  });

  it("lets a creator named in EDIT_CREATORS through, among others and with spaces (A1)", async () => {
    vi.stubEnv("EDIT_CREATORS", ` ${OTHER} , ${USER} `);
    for (const response of await Promise.all(calls())) expect([401, 403]).not.toContain(response.status);
  });

  it("refuses a write that is not JSON, or from another origin", async () => {
    expect((await createTake(post("/api/edit/takes", "name=x", "application/x-www-form-urlencoded"))).status).toBe(415);
    const forged = new Request("http://localhost:3000/api/edit/renders", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: "{}" });
    expect((await render(forged)).status).toBe(403);
    expect(world.rest.calls).toEqual([]);
  });
});

describe("POST /api/edit/takes", () => {
  it("writes the take uploading and gives a signed PUT for its source", async () => {
    const response = await createTake(post("/api/edit/takes", { name: "IMG_0001.MOV", bytes: 4_893_635, type: "video/quicktime" }));
    expect(response.status).toBe(201);
    const { take, uploadUrl } = await response.json();
    expect(take).toEqual({ id: expect.any(String), name: "IMG_0001.MOV", bytes: 4_893_635, status: "uploading", error: null });
    expect(world.rest.row("edit_takes", take.id)).toMatchObject({ user_id: USER, status: "uploading", bytes: 4_893_635, source_path: keyOf("source", take.id) });
    expect(new URL(uploadUrl).host).toBe(`${R2_ACCOUNT}.eu.r2.cloudflarestorage.com`);
    expect(r2Path(uploadUrl)).toBe(`/${BUCKET}/${keyOf("source", take.id)}`);
    expect(new URL(uploadUrl).searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host"); // the size and type bound (I1)
    expect(world.rest.calls.map((call) => [call.method, call.role])).toEqual([["POST", "service"]]);
  });

  it("signs before it writes: a signing that fails leaves no row (M6), and the client is told nothing of why (M3)", async () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    const response = await createTake(post("/api/edit/takes", { name: "take.mp4", bytes: 10, type: "video/mp4" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "something went wrong" });
    expect(world.rest.tables.edit_takes).toEqual([]);
    const log = errorsLogged();
    expect(log).toContain("R2_SECRET_ACCESS_KEY is not set");
    expect(log).toContain("at "); // its stack
  });

  it.each([
    [{ name: "take.webm", bytes: 10, type: "video/webm" }, "a take is an MP4 or QuickTime video"],
    [{ name: "take.mp4", bytes: 3 * 1024 ** 3, type: "video/mp4" }, "a take is at most 2 GB"],
    [{ name: "take.mp4", type: "video/mp4" }, "Invalid input: expected number, received undefined"],
    ["not json", "the body is {name, bytes, type}"],
  ])("400s %j, saying why, and writes nothing", async (body, message) => {
    const response = await createTake(post("/api/edit/takes", body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(message);
    expect(world.rest.tables.edit_takes).toEqual([]);
  });
});

describe("GET /api/edit/takes", () => {
  const list = async () => {
    const response = await listTakes();
    return { status: response.status, body: await response.json() };
  };
  const at = (minute: number) => `2026-11-21T10:${String(minute).padStart(2, "0")}:00.000Z`;
  const [OLDER, STOPPED, NEWER, REFERENCE] = ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666", "77777777-7777-4777-8777-777777777777"];

  it("gives the creator's own takes newest first, each as GET /api/edit/takes/[id] has it, and never a reference", async () => {
    world.rest.put("edit_takes", takeRow({ id: OLDER, name: "first.mov", created_at: at(1) }));
    world.rest.put("edit_takes", uploadingTake({ id: STOPPED, name: "stopped.mov", status: "analysing", created_at: at(2) }));
    world.rest.put("edit_jobs", jobRow({ id: "88888888-8888-4888-8888-888888888888", take_id: STOPPED, updated_at: ago(STALE_MS + 1000) })); // its worker stopped
    world.rest.put("edit_takes", uploadingTake({ id: NEWER, name: "newest.mov", status: "analysing", created_at: at(3) }));
    world.rest.put("edit_jobs", jobRow({ id: "99999999-9999-4999-8999-999999999999", take_id: NEWER, updated_at: ago(1000) }));
    world.rest.put("edit_takes", takeRow({ id: REFERENCE, name: "reference.mp4", created_at: at(4) })); // a reference, ready to be read
    world.rest.put("edit_jobs", jobRow({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", take_id: REFERENCE, input: { reference: true }, status: "done", stage: null, progress: 1, created_at: ago(1000) })); // analysed just now: not yet a left-over
    world.rest.put("edit_takes", takeRow({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: OTHER, created_at: at(5) })); // another creator's

    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.takes.map((take: { id: string }) => take.id)).toEqual([NEWER, STOPPED, OLDER]);
    const [newer, stopped, older] = body.takes;
    expect(newer).toEqual({ id: NEWER, name: "newest.mov", status: "analysing", ms: null, posterUrl: null });
    expect(stopped).toEqual({ id: STOPPED, name: "stopped.mov", status: "failed", ms: null, posterUrl: null });
    expect(older).toMatchObject({ id: OLDER, name: "first.mov", status: "ready", ms: 12700 });
    expect(r2Path(older.posterUrl)).toBe(`/${BUCKET}/${keyOf("poster.jpg", OLDER)}`);
    expect(new URL(older.posterUrl).searchParams.get("X-Amz-Expires")).toBe("7200");
    expect(world.rest.calls.filter((call) => call.method !== "GET").map((call) => [call.method, call.table])).toEqual([["PATCH", "edit_jobs"]]); // only the stopped job written failed (X41)
    // Only the columns it answers with: of an analysis, its files and the upload's mark; never a take whole, nor its words.
    const read = world.rest.calls.find((call) => call.method === "GET" && call.table === "edit_takes" && call.query.has("order")); // the list's, after the sweep's
    expect(read?.query.get("select")).toBe("id,name,status,error,facts,created_at,updated_at,files:analysis->files,mark:analysis->reference");
  });

  it("never lists a reference still uploading, known only by its mark, under the list's narrow select", async () => {
    const MARKED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    world.rest.put("edit_takes", takeRow({ id: OLDER, created_at: at(1) })); // the creator's own take
    world.rest.put("edit_takes", uploadingTake({ id: MARKED, name: "liked.mp4", analysis: UPLOAD_MARK, created_at: at(2) })); // no job yet: the mark is all it has
    const { body } = await list();
    expect(body.takes.map((take: { id: string }) => take.id)).toEqual([OLDER]);
    expect(world.rest.tables.edit_jobs).toEqual([]); // known as a reference by the mark alone, read through the select's `mark`
  });

  it("gives a creator with no takes an empty list", async () => {
    expect(await list()).toEqual({ status: 200, body: { takes: [] } });
  });

  it("401s without a session and 403s a creator the edit tool is not open to, reading nothing", async () => {
    signedIn = null;
    expect((await list()).status).toBe(401);
    signedIn = { id: OTHER, is_anonymous: false };
    expect(await list()).toEqual({ status: 403, body: { error: "the edit tool is not open to this account yet" } });
    expect(world.rest.calls).toEqual([]);
  });

  it("reads on to a second page when the first holds only references", async () => {
    const second = (n: number) => `2026-11-21T09:${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}.000Z`;
    for (let i = 0; i < 5; i++) world.rest.put("edit_takes", takeRow({ id: `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`, created_at: second(i) }));
    for (let i = 0; i < 45; i++) {
      const id = `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`;
      world.rest.put("edit_takes", takeRow({ id, created_at: second(100 + i) })); // 45 references, all newer than the takes
      world.rest.put("edit_jobs", jobRow({ id: `${String(i).padStart(8, "0")}-2222-4222-8222-222222222222`, take_id: id, input: { reference: true }, status: "done", stage: null, created_at: ago(1000) })); // young: not swept
    }
    const { body } = await list();
    expect(body.takes.map((take: { id: string }) => take.id)).toEqual([4, 3, 2, 1, 0].map((i) => `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`));
    const pages = world.rest.calls.filter((call) => call.method === "GET" && call.table === "edit_takes" && call.query.has("order")); // the list's pages, not the sweep's read
    expect(pages.map((call) => call.query.get("created_at"))).toEqual([null, `lt.${second(105)}`]); // the second after the first's oldest
  });

  it("gives at most twenty, the newest, with references left out of the count", async () => {
    for (let i = 0; i < 25; i++) world.rest.put("edit_takes", takeRow({ id: `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`, created_at: at(10 + i) }));
    for (let i = 0; i < 3; i++) {
      const id = `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`;
      world.rest.put("edit_takes", takeRow({ id, created_at: at(40 + i) })); // three references, the newest of all
      world.rest.put("edit_jobs", jobRow({ id: `${String(i).padStart(8, "0")}-2222-4222-8222-222222222222`, take_id: id, input: { reference: true }, status: "done", stage: null, created_at: ago(1000) })); // young: not swept
    }
    const { body } = await list();
    expect(body.takes).toHaveLength(20);
    expect(body.takes[0].id).toBe("00000024-0000-4000-8000-000000000000");
    expect(body.takes.every((take: { id: string }) => take.id.endsWith("-0000-4000-8000-000000000000"))).toBe(true);
  });
});

describe("POST /api/edit/takes/[id]/uploaded", () => {
  const call = (id = TAKE) => uploaded(post(`/api/edit/takes/${id}/uploaded`), by(id));

  it("checks the upload is in R2, moves the take to analysing and starts its analysis", async () => {
    world.rest.put("edit_takes", uploadingTake());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    const response = await call();
    expect(response.status).toBe(202);
    const { job } = await response.json();
    expect(job).toEqual({ id: expect.any(String), status: "queued", stage: null, progress: 0, error: null });
    expect(world.rest.row("edit_jobs", job.id)).toMatchObject({ user_id: USER, kind: "analyse", take_id: TAKE, status: "queued" });
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "analysing" });
    expect(world.worker.started).toEqual([job.id]);
  });

  it("409s while the upload has not arrived, or not whole, and starts nothing", async () => {
    world.rest.put("edit_takes", uploadingTake());
    let response = await call();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("take.mp4 is not in storage: its upload did not arrive");
    world.bucket.objects.set(keyOf("source"), 4_000_000);
    response = await call();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("take.mp4 did not arrive whole: 4000000 of its 4893635 bytes are stored");
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading" });
    expect(world.rest.tables.edit_jobs).toEqual([]);
  });

  it("409s a take that is not waiting for its upload, so one upload starts one analysis", async () => {
    world.rest.put("edit_takes", uploadingTake());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    expect((await call()).status).toBe(202);
    const again = await call();
    expect(again.status).toBe(409);
    expect((await again.json()).error).toBe("the take is analysing: it is not waiting for its upload");
    expect(world.rest.tables.edit_jobs).toHaveLength(1);
  });

  it("409s while an analysis of the creator's is live, and starts nothing; a stale one or a render does not count (A1)", async () => {
    const other = "44444444-4444-4444-8444-444444444444";
    world.rest.put("edit_takes", takeRow({ id: other, status: "analysing" }));
    world.rest.put("edit_jobs", jobRow({ id: "55555555-5555-4555-8555-555555555555", take_id: other, status: "running", updated_at: ago(10_000) }));
    world.rest.put("edit_takes", uploadingTake());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    const response = await call();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("an analysis of yours is already running; try again when it ends");
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading" });
    expect(world.rest.tables.edit_jobs).toHaveLength(1);
    expect(world.worker.started).toEqual([]);
    Object.assign(world.rest.row("edit_jobs", "55555555-5555-4555-8555-555555555555") ?? {}, { updated_at: ago(STALE_MS + 1000) }); // stale under X41
    world.rest.put("edit_jobs", jobRow({ id: "66666666-6666-4666-8666-666666666666", kind: "render", take_id: null, status: "queued", updated_at: ago(1000) }));
    expect((await call()).status).toBe(202);
  });

  it("404s another creator's take, and an id that is no take's", async () => {
    world.rest.put("edit_takes", uploadingTake({ user_id: OTHER }));
    world.bucket.objects.set(keyOf("source", TAKE, OTHER), 4_893_635);
    expect((await call()).status).toBe(404);
    expect((await call("../../x")).status).toBe(404);
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading" });
  });

  it("puts the take back to uploading when its job cannot be written, and answers a plain 500", async () => {
    world.rest.put("edit_takes", uploadingTake());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    world.rest.failing = ({ method, table }) => method === "POST" && table === "edit_jobs";
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "something went wrong" });
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "uploading" });
    expect(world.worker.started).toEqual([]);
    expect(errorsLogged()).toContain("the job could not be written");
  });

  it("logs a take it could not put back, which then reads failed two minutes on, never started (I2)", async () => {
    world.rest.put("edit_takes", uploadingTake());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    world.rest.failing = ({ method, table, body }) => (method === "POST" && table === "edit_jobs") || (method === "PATCH" && table === "edit_takes" && body.status === "uploading");
    expect((await call()).status).toBe(500);
    expect(errorsLogged()).toContain("a take with no job could not be put back to uploading");
    world.rest.failing = null;
    const read = async () => (await (await getTake(get(`/api/edit/takes/${TAKE}`), by(TAKE))).json()).take;
    expect(await read()).toMatchObject({ status: "analysing", error: null }); // inside two minutes: left alone
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "analysing" });
    Object.assign(world.rest.row("edit_takes", TAKE) ?? {}, { updated_at: ago(STALE_MS + 1000) });
    expect(await read()).toMatchObject({ status: "failed", error: "its analysis was never started" });
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "failed", error: "its analysis was never started" });
    const write = world.rest.calls.filter((one) => one.method === "PATCH" && one.table === "edit_takes").at(-1);
    expect(Object.fromEntries(write?.query ?? [])).toMatchObject({ id: `eq.${TAKE}`, user_id: `eq.${USER}`, status: "eq.analysing", updated_at: expect.stringMatching(/^lte\./) }); // only if untouched since read
  });

  it("waits up to a minute for the worker's web address (M7)", () => {
    expect([uploadedWaits, renderWaits]).toEqual([60, 60]);
  });

  it("502s when the worker cannot start the job, which is failed, and so then is the take", async () => {
    world.rest.put("edit_takes", uploadingTake());
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    world.worker.answer = 500;
    const response = await call();
    expect(response.status).toBe(502);
    const { job, error } = await response.json();
    expect(error).toBe("the worker could not start the job: it answered 500");
    expect(job).toMatchObject({ status: "failed", error });
    const take = await (await getTake(get(`/api/edit/takes/${TAKE}`), by(TAKE))).json();
    expect(take.take).toMatchObject({ status: "failed", error });
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "failed", error });
  });
});

describe("GET /api/edit/takes/[id]", () => {
  const call = (id = TAKE) => getTake(get(`/api/edit/takes/${id}`), by(id));

  it("gives a ready take as its file, and a signed read of its preview copy for the Player", async () => {
    world.rest.put("edit_takes", takeRow());
    const response = await call();
    expect(response.status).toBe(200);
    const { take, asset, previewUrl } = await response.json();
    expect(take).toEqual({ id: TAKE, name: "take.mp4", bytes: 4_893_635, status: "ready", error: null });
    expect(asset).toEqual({ id: TAKE, kind: "video", origin: "filmed", at: { bucket: BUCKET, path: keyOf("full.mp4") }, ms: 12700, w: 720, h: 1280, sound: true, words: WORDS });
    expect(r2Path(previewUrl)).toBe(`/${BUCKET}/${keyOf("preview.mp4")}`);
    expect(new URL(previewUrl).searchParams.get("X-Amz-Expires")).toBe("7200");
  });

  it("gives a take that is not ready without a file", async () => {
    world.rest.put("edit_takes", uploadingTake());
    expect(await (await call()).json()).toEqual({ take: { id: TAKE, name: "take.mp4", bytes: 4_893_635, status: "uploading", error: null }, asset: null, previewUrl: null });
  });

  it("reads an analysing take whose analysis stopped as failed, and writes both rows so", async () => {
    world.rest.put("edit_takes", uploadingTake({ status: "analysing" }));
    const job = world.rest.put("edit_jobs", jobRow({ updated_at: ago(STALE_MS + 1000) }));
    const { take } = await (await call()).json();
    expect(take).toMatchObject({ status: "failed", error: "the worker stopped" });
    expect(world.rest.row("edit_jobs", String(job.id))).toMatchObject({ status: "failed", error: "the worker stopped" });
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "failed", error: "the worker stopped" });
    const write = world.rest.calls.find((call) => call.method === "PATCH" && call.table === "edit_takes");
    expect(Object.fromEntries(write?.query ?? [])).toMatchObject({ id: `eq.${TAKE}`, user_id: `eq.${USER}`, status: "eq.analysing" });
  });

  it("keeps a ready take ready when an analysis of it failed again (X71)", async () => {
    world.rest.put("edit_takes", takeRow());
    world.rest.put("edit_jobs", jobRow({ status: "failed", error: "the worker stopped", updated_at: ago(1000) }));
    expect((await (await call()).json()).take).toMatchObject({ status: "ready", error: null });
  });

  it("fails a take the worker measured at over ten minutes (X56), and writes it so", async () => {
    world.rest.put("edit_takes", takeRow({ facts: { ...(takeRow().facts as object), ms: 630_000 } }));
    const body = await (await call()).json();
    expect(body).toMatchObject({ take: { status: "failed", error: "take.mp4 is 10.5 minutes long; a take is at most 10 minutes" }, asset: null, previewUrl: null });
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "failed" });
  });

  it("404s another creator's take", async () => {
    world.rest.put("edit_takes", takeRow({ user_id: OTHER }));
    expect((await call()).status).toBe(404);
    expect((await call("nope")).status).toBe(404);
  });

  it("does not write back a take touched since it was read", async () => {
    world.rest.put("edit_takes", uploadingTake({ status: "analysing", updated_at: ago(STALE_MS + 1000) }));
    const service = world.service();
    vi.mocked(createServiceClient).mockImplementation(() => new Proxy(service, {
      get(target, key, receiver) {
        if (key === "from") Object.assign(world.rest.row("edit_takes", TAKE) ?? {}, { updated_at: new Date().toISOString() }); // touched between the read and the write
        return Reflect.get(target, key, receiver);
      },
    }) as never);
    await call();
    expect(world.rest.row("edit_takes", TAKE)).toMatchObject({ status: "analysing", error: null });
  });

  it("500s, and signs nothing, when a take's preview copy is kept outside its folder (M5)", async () => {
    const take = takeRow();
    world.rest.put("edit_takes", { ...take, analysis: { ...(take.analysis as object), files: { ...copiesOf(take), preview: keyOf("preview.mp4", TAKE, OTHER) } } });
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "something went wrong" });
    expect(errorsLogged()).toContain("its preview copy is kept outside its folder");
  });
});

describe("GET /api/edit/jobs/[id]", () => {
  const call = (id: string) => getJob(get(`/api/edit/jobs/${id}`), by(id));

  it("gives a job's status, stage, progress and error", async () => {
    const job = world.rest.put("edit_jobs", jobRow({ kind: "render", take_id: null, stage: "drawing", progress: 0.42, updated_at: ago(1000) }));
    expect(await (await call(String(job.id))).json()).toEqual({ status: "running", stage: "drawing", progress: 0.42, error: null });
  });

  it("reads a running job not touched for two minutes as failed, and writes it so (X41)", async () => {
    const job = world.rest.put("edit_jobs", jobRow({ kind: "render", take_id: null, stage: "drawing", progress: 0.42, updated_at: ago(STALE_MS + 1000) }));
    expect(await (await call(String(job.id))).json()).toEqual({ status: "failed", stage: "drawing", progress: 0.42, error: "the worker stopped" });
    expect(world.rest.row("edit_jobs", String(job.id))).toMatchObject({ status: "failed", error: "the worker stopped" });
  });

  it("gives a rendered film as a signed read a browser saves", async () => {
    const path = `u/${USER}/films/job.mp4`;
    const job = world.rest.put("edit_jobs", jobRow({ kind: "render", take_id: null, status: "done", stage: null, progress: 1, result: { path, cover: `u/${USER}/films/job.jpg`, ms: 12700, lufs: -14.8, truePeak: -1.4 } }));
    const body = await (await call(String(job.id))).json();
    expect(body).toMatchObject({ status: "done", progress: 1, error: null });
    expect(r2Path(body.filmUrl)).toBe(`/${BUCKET}/${path}`);
    expect(new URL(body.filmUrl).searchParams.get("response-content-disposition")).toBe('attachment; filename="film.mp4"');
  });

  it("500s, and signs nothing, when a film is kept outside the creator's films (M5)", async () => {
    const job = world.rest.put("edit_jobs", jobRow({ kind: "render", take_id: null, status: "done", stage: null, progress: 1, result: { path: `u/${OTHER}/films/job.mp4` } }));
    const response = await call(String(job.id));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "something went wrong" });
    expect(errorsLogged()).toContain("its film is kept outside the creator's films");
  });

  it("gives a finished analysis no film", async () => {
    const job = world.rest.put("edit_jobs", jobRow({ status: "done", stage: null, progress: 1, result: { take: TAKE, seconds: 20 } }));
    expect(await (await call(String(job.id))).json()).toEqual({ status: "done", stage: null, progress: 1, error: null });
  });

  it("404s another creator's job", async () => {
    const job = world.rest.put("edit_jobs", jobRow({ user_id: OTHER, kind: "render", take_id: null }));
    expect((await call(String(job.id))).status).toBe(404);
  });
});

describe("POST /api/edit/renders", () => {
  const call = (edit: unknown) => render(post("/api/edit/renders", { edit }));
  const first = (): Edit => firstEdit(assetOf(takeRow(), BUCKET));

  it("starts a render of an edit of the creator's ready take, with the edit and its cover frame", async () => {
    world.rest.put("edit_takes", takeRow());
    const response = await call(first());
    expect(response.status).toBe(202);
    const { job } = await response.json();
    expect(job).toEqual({ id: expect.any(String), status: "queued", stage: null, progress: 0, error: null });
    expect(world.rest.row("edit_jobs", job.id)).toMatchObject({ user_id: USER, kind: "render", take_id: null, input: { edit: first(), cover: null } });
    expect(world.worker.started).toEqual([job.id]);
  });

  it("gives the worker the cover as a film frame (X63)", async () => {
    world.rest.put("edit_takes", takeRow());
    const edit = { ...first(), cover: { shot: first().shots[0]!.id, atMs: 1500 } };
    const { job } = await (await call(edit)).json();
    expect((world.rest.row("edit_jobs", job.id)?.input as { cover: number }).cover).toBe(coverFrame(edit));
    expect(coverFrame(edit)).toBe(45);
  });

  it("400s what is not an edit, naming where", async () => {
    world.rest.put("edit_takes", takeRow());
    const response = await call({ ...first(), v: 2 });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "this is not an edit", problems: [{ path: "v", id: null, message: expect.any(String) }] });
    expect(world.rest.tables.edit_jobs).toEqual([]);
  });

  it("400s an edit that does not hold together, with checkEdit's problems", async () => {
    world.rest.put("edit_takes", takeRow());
    const edit = first();
    edit.shots[0]!.endMs = 13_000; // past the take's end
    const response = await call(edit);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "the edit does not hold together", problems: checkEdit(edit) });
    expect(world.worker.started).toEqual([]);
  });

  it("400s a file that is not the creator's ready take as measured", async () => {
    world.rest.put("edit_takes", takeRow({ user_id: OTHER }));
    let response = await call(first());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "a file of the edit is not yours to render", problems: [{ path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not one of your takes` }] });
    world.rest.tables.edit_takes.length = 0;
    world.rest.put("edit_takes", takeRow());
    const edit = first();
    edit.assets[0] = { ...edit.assets[0]!, at: { bucket: BUCKET, path: keyOf("source") } };
    response = await call(edit);
    expect((await response.json()).problems).toEqual([{ path: "assets.0", id: TAKE, message: `the file "${TAKE}" is not as its take was measured: where it is kept is not the take's` }]);
    expect(world.rest.tables.edit_jobs).toEqual([]);
  });

  it("refuses a file id that cannot be a take's without asking the database", async () => {
    const edit = first();
    edit.assets[0] = { ...edit.assets[0]!, id: "take" };
    edit.shots[0]!.asset = "take";
    const response = await call(edit);
    expect((await response.json()).problems).toEqual([{ path: "assets.0", id: "take", message: 'the file "take" is not one of your takes' }]);
    expect(world.rest.calls).toEqual([]);
  });

  it("409s while a render of the creator's is live, and starts nothing; a stale one does not count (A1)", async () => {
    world.rest.put("edit_takes", takeRow());
    world.rest.put("edit_jobs", jobRow({ id: "55555555-5555-4555-8555-555555555555", kind: "render", take_id: null, status: "queued", updated_at: ago(30_000) }));
    const response = await call(first());
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("a render of yours is already running; try again when it ends");
    expect(world.rest.tables.edit_jobs).toHaveLength(1);
    expect(world.worker.started).toEqual([]);
    Object.assign(world.rest.row("edit_jobs", "55555555-5555-4555-8555-555555555555") ?? {}, { updated_at: ago(STALE_MS + 1000) }); // never claimed (X75)
    expect((await call(first())).status).toBe(202);
  });

  it("502s when the worker cannot start the render, saying only that it could not be reached (143)", async () => {
    world.rest.put("edit_takes", takeRow());
    world.worker.answer = "down";
    const response = await call(first());
    expect(response.status).toBe(502);
    expect((await response.json()).job).toMatchObject({ status: "failed", error: "the worker could not start the job: it could not be reached" });
    expect(errorsLogged()).toContain("fetch failed");
  });
});
