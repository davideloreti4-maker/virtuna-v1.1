import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jobState, jobView, latestJob, liveJob, readJob, startJob } from "../jobs";
import { STALE_MS } from "../stale";
import { OTHER, TAKE, USER, jobRow, takeRow } from "./rows";
import { ENV, PROXY_SECRET, standIns, WORKER_SECRET } from "./stand-ins";

const NOW = Date.parse("2026-11-21T10:10:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("a job as it stands (X41)", () => {
  it("has stopped when it is running and nothing has touched it for two minutes", () => {
    const stale = jobState(jobRow({ status: "running", updated_at: ago(STALE_MS + 1) }), NOW);
    expect(stale).toMatchObject({ status: "failed", error: "the worker stopped", stage: "words", progress: 0.31 });
    expect(jobState(jobRow({ status: "running", updated_at: ago(STALE_MS - 1000) }), NOW).status).toBe("running");
  });

  it("was never started when it is queued and no worker has claimed it for two minutes", () => {
    expect(jobState(jobRow({ status: "queued", updated_at: ago(STALE_MS + 1) }), NOW)).toMatchObject({ status: "failed", error: "the worker did not start the job" });
    expect(jobState(jobRow({ status: "queued", updated_at: ago(5000) }), NOW).status).toBe("queued");
  });

  it("was never started either when it was spawned but waits in Modal's queue, unclaimed, two minutes on (A2, X75)", () => {
    // The worker's web address writes the call into a queued row; a call that then waits past the functions' caps is no claim.
    const spawned = jobRow({ status: "queued", call_id: "fc-01ABC", started_at: null, updated_at: ago(STALE_MS + 1) });
    expect(jobState(spawned, NOW)).toMatchObject({ status: "failed", error: "the worker did not start the job" });
  });

  it("is what its row says once it has ended", () => {
    const done = jobRow({ status: "done", stage: null, progress: 1, updated_at: ago(STALE_MS * 10) });
    expect(jobState(done, NOW)).toEqual(done);
  });

  it("shows its status, stage, progress and error, and nothing else", () => {
    expect(jobView(jobRow())).toEqual({ status: "running", stage: "words", progress: 0.31, error: null });
  });
});

describe("jobs against the stand-ins", () => {
  let world: ReturnType<typeof standIns>;
  beforeEach(() => {
    world = standIns();
    vi.stubGlobal("fetch", world.fetch);
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("starting one", () => {
    it("writes the row first, then has the worker start it with the shared secret", async () => {
      world.rest.put("edit_takes", takeRow({ status: "analysing" }));
      const job = await startJob(world.service(), { user: USER, kind: "analyse", takeId: TAKE });
      expect(job).toMatchObject({ user_id: USER, kind: "analyse", take_id: TAKE, status: "queued", input: null });
      expect(world.rest.row("edit_jobs", job.id)).toMatchObject({ status: "queued", kind: "analyse" });
      expect(world.worker.started).toEqual([job.id]);
    });

    it("keeps a render's edit and cover in its input", async () => {
      const input = { edit: { v: 1 }, cover: 45 };
      const job = await startJob(world.service(), { user: USER, kind: "render", input });
      expect(world.rest.row("edit_jobs", job.id)).toMatchObject({ kind: "render", take_id: null, input });
    });

    it.each([
      [500, "the worker could not start the job: it answered 500"],
      ["down", "the worker could not start the job: it could not be reached"],
    ] as const)("fails the job with a plain message when the worker answers %s", async (answer, message) => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      world.worker.answer = answer;
      const job = await startJob(world.service(), { user: USER, kind: "render", input: { edit: {}, cover: null } });
      expect(job).toMatchObject({ status: "failed", error: message });
      expect(world.rest.row("edit_jobs", job.id)).toMatchObject({ status: "failed", error: message });
      expect(world.rest.row("edit_jobs", job.id)?.finished_at).toEqual(expect.any(String));
      // 143: what the call threw is in the log only; it may hold the worker's address.
      if (answer === "down") expect(logged.mock.calls.flat().join(" ")).toContain("fetch failed");
      logged.mockRestore();
    });

    it("sends the workspace's proxy token, without which Modal's proxy refuses the call (X81)", async () => {
      vi.stubEnv("EDIT_WORKER_PROXY_SECRET", `${PROXY_SECRET}-not`);
      const job = await startJob(world.service(), { user: USER, kind: "render", input: {} });
      expect(job).toMatchObject({ status: "failed", error: "the worker could not start the job: it answered 401" });
      expect(world.worker.started).toEqual([]);
    });

    it.each(["EDIT_WORKER_PROXY_KEY", "EDIT_WORKER_PROXY_SECRET"])("fails fast, writing nothing, when %s is not set", async (name) => {
      vi.stubEnv(name, "");
      await expect(startJob(world.service(), { user: USER, kind: "render", input: {} })).rejects.toThrow(`${name} is not set`);
      expect(world.rest.tables.edit_jobs).toEqual([]);
    });

    it("refuses a worker's address that is not https outside development, or no address at all, writing nothing (M5)", async () => {
      for (const address of ["http://worker.test", "https://worker test.example", "worker.test"]) {
        vi.stubEnv("EDIT_WORKER_URL", address);
        await expect(startJob(world.service(), { user: USER, kind: "render", input: {} })).rejects.toThrow("EDIT_WORKER_URL is not an https address");
      }
      expect(world.rest.tables.edit_jobs).toEqual([]);
      vi.stubEnv("EDIT_WORKER_URL", "http://worker.test");
      vi.stubEnv("NODE_ENV", "development"); // a worker served on this machine, say
      const job = await startJob(world.service(), { user: USER, kind: "render", input: {} });
      expect(job.status).toBe("queued");
      expect(world.worker.started).toEqual([job.id]);
    });

    it("says so plainly when the worker gives no answer in time", async () => {
      world.worker.answer = "timeout";
      const job = await startJob(world.service(), { user: USER, kind: "render", input: {} });
      expect(job).toMatchObject({ status: "failed", error: "the worker could not start the job: it gave no answer in 30 s" });
    });

    it("leaves a job the worker took after all to the worker, though its answer failed", async () => {
      world.worker.answer = "took it, then 500";
      const job = await startJob(world.service(), { user: USER, kind: "render", input: {} });
      expect(job.status).not.toBe("failed");
      expect(world.rest.row("edit_jobs", job.id)).toMatchObject({ status: "running", error: null, finished_at: null });
    });

    it("fails the job when the app's secret is not the worker's", async () => {
      vi.stubEnv("EDIT_WORKER_SECRET", `${WORKER_SECRET}-not`);
      const job = await startJob(world.service(), { user: USER, kind: "render", input: {} });
      expect(job).toMatchObject({ status: "failed", error: "the worker could not start the job: it answered 401" });
    });

    it("is refused by the database for another creator's take (X70)", async () => {
      world.rest.put("edit_takes", takeRow({ user_id: OTHER }));
      await expect(startJob(world.service(), { user: USER, kind: "analyse", takeId: TAKE })).rejects.toThrow("edit_jobs_take_owner_fkey");
      expect(world.worker.started).toEqual([]);
    });

    it("fails fast when the worker's address is not set", async () => {
      vi.stubEnv("EDIT_WORKER_URL", "");
      await expect(startJob(world.service(), { user: USER, kind: "render", input: {} })).rejects.toThrow("EDIT_WORKER_URL is not set");
      expect(world.rest.tables.edit_jobs).toEqual([]);
    });
  });

  describe("a creator's live job of a kind (A1)", () => {
    const session = () => world.session({ id: USER });

    it("is one queued or running and touched in the last two minutes, of that kind and creator", async () => {
      world.rest.put("edit_takes", takeRow());
      world.rest.put("edit_jobs", jobRow({ id: "44444444-4444-4444-8444-444444444444", status: "queued", updated_at: new Date(Date.now() - 5000).toISOString() }));
      expect(await liveJob(session(), USER, "analyse")).toBe(true);
      expect(await liveJob(session(), USER, "render")).toBe(false); // another kind
      expect(await liveJob(world.session({ id: OTHER }), OTHER, "analyse")).toBe(false); // another creator
    });

    it("is not one that has ended, or one stale under X41 (untouched two minutes)", async () => {
      world.rest.put("edit_takes", takeRow());
      world.rest.put("edit_jobs", jobRow({ id: "44444444-4444-4444-8444-444444444444", status: "running", updated_at: new Date(Date.now() - STALE_MS - 1000).toISOString() }));
      world.rest.put("edit_jobs", jobRow({ id: "55555555-5555-4555-8555-555555555555", status: "done", updated_at: new Date().toISOString() }));
      world.rest.put("edit_jobs", jobRow({ id: "66666666-6666-4666-8666-666666666666", status: "failed", updated_at: new Date().toISOString() }));
      expect(await liveJob(session(), USER, "analyse")).toBe(false);
    });
  });

  describe("reading one back", () => {
    it("reads only the creator's own job, through the session", async () => {
      const mine = world.rest.put("edit_jobs", jobRow({ updated_at: ago(1000) }));
      const theirs = world.rest.put("edit_jobs", jobRow({ id: "44444444-4444-4444-8444-444444444444", user_id: OTHER, take_id: null, kind: "render" }));
      const session = world.session({ id: USER });
      expect(await readJob(session, world.service(), USER, String(mine.id), NOW)).toMatchObject({ id: mine.id, status: "running" });
      expect(await readJob(session, world.service(), USER, String(theirs.id), NOW)).toBeNull();
      expect(world.rest.calls.filter((call) => call.method === "GET").every((call) => call.role === `user:${USER}`)).toBe(true);
    });

    it("is null for an id that is no job's", async () => {
      expect(await readJob(world.session({ id: USER }), world.service(), USER, "not-a-uuid", NOW)).toBeNull();
      expect(world.rest.calls).toEqual([]);
    });

    it("writes a stopped job failed into its row, filtered on the creator and the state it was read in", async () => {
      const job = world.rest.put("edit_jobs", jobRow({ updated_at: ago(STALE_MS + 5000) }));
      const read = await readJob(world.session({ id: USER }), world.service(), USER, String(job.id), NOW);
      expect(read).toMatchObject({ status: "failed", error: "the worker stopped" });
      expect(world.rest.row("edit_jobs", String(job.id))).toMatchObject({ status: "failed", error: "the worker stopped", finished_at: expect.any(String) });
      const write = world.rest.calls.find((call) => call.method === "PATCH");
      expect(write?.role).toBe("service");
      expect(Object.fromEntries(write?.query ?? [])).toMatchObject({ id: `eq.${job.id}`, user_id: `eq.${USER}`, status: "eq.running", updated_at: `lt.${ago(STALE_MS)}` });
    });

    it("leaves a job alone that the worker touched after it was read", async () => {
      const job = world.rest.put("edit_jobs", jobRow({ updated_at: ago(STALE_MS + 5000) }));
      const service = world.service();
      // The worker's heartbeat lands between the read and the write: the write must not take.
      const touched = new Proxy(service, {
        get(target, key, receiver) {
          if (key === "from") Object.assign(world.rest.row("edit_jobs", String(job.id)) ?? {}, { updated_at: new Date(NOW).toISOString() });
          return Reflect.get(target, key, receiver);
        },
      });
      const read = await readJob(world.session({ id: USER }), touched, USER, String(job.id), NOW);
      expect(read).toMatchObject({ status: "running" });
      expect(world.rest.row("edit_jobs", String(job.id))).toMatchObject({ status: "running", error: null });
    });

    it("finds a take's latest job", async () => {
      world.rest.put("edit_takes", takeRow({ status: "analysing" }));
      world.rest.put("edit_jobs", jobRow({ id: "55555555-5555-4555-8555-555555555555", status: "failed", error: "first", created_at: "2026-11-21T10:00:00.000Z", updated_at: ago(1000) }));
      world.rest.put("edit_jobs", jobRow({ id: "66666666-6666-4666-8666-666666666666", status: "running", created_at: "2026-11-21T10:05:00.000Z", updated_at: ago(1000) }));
      expect(await latestJob(world.session({ id: USER }), world.service(), USER, TAKE, NOW)).toMatchObject({ id: "66666666-6666-4666-8666-666666666666" });
      expect(await latestJob(world.session({ id: OTHER }), world.service(), OTHER, TAKE, NOW)).toBeNull();
    });
  });
});
