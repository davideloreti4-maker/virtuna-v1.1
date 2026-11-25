/**
 * reference.test.ts — a style read from a video (Task 13b): the page's side of `/api/edit/references`, from the link or the file
 * to the style, with what it tells on the way. The network is stood in (`fetch`, and the upload's PUT): the answers are the
 * routes' own shapes (`src/app/api/edit/references/route.ts`, `[id]/route.ts`), and the routes are tested apart.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStyle, type Progress } from "../reference";

const STYLE = { source: { kind: "reference", name: null }, notMatched: ["emoji"] };
const LINK = "https://www.tiktok.com/@someone/video/7300000000000000000";
const ID = "22222222-2222-4222-8222-222222222222";

type Answer = { status: number; body: unknown } | "down";
interface Asked {
  method: string;
  path: string;
  body: unknown;
  keepalive?: boolean;
}

/** `fetch`, answering each call from the list in order, and keeping what was asked. A DELETE is answered 204, from no list. */
function network(answers: Answer[]): Asked[] {
  const asked: Asked[] = [];
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    asked.push({ method: init?.method ?? "GET", path, body: init?.body ? JSON.parse(String(init.body)) : undefined, ...(init?.keepalive ? { keepalive: true } : {}) });
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    const answer = answers.shift();
    if (answer === undefined) throw new Error(`nothing left to answer ${path} with`);
    if (answer === "down") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "Content-Type": "application/json" } });
  });
  return asked;
}

const analysing = (stage: string, progress: number): Answer => ({ status: 200, body: { status: "analysing", stage, progress } });
const READY: Answer = { status: 200, body: { status: "ready", style: STYLE, judged: true } };
const quick = { wait: async () => {} };

async function read(source: Parameters<typeof readStyle>[0], deps: Parameters<typeof readStyle>[2] = quick) {
  const told: Progress[] = [];
  const result = await readStyle(source, (progress) => told.push(progress), deps);
  return { result, told };
}

afterEach(() => vi.unstubAllGlobals());

describe("a link", () => {
  it("is sent, watched stage by stage, and comes back as a style", async () => {
    const asked = network([{ status: 202, body: { id: ID } }, analysing("getting the video", 0), analysing("reading its cuts", 0.5), analysing("reading its text", 0.8), analysing("reading its look", 1), READY]);
    const { result, told } = await read({ link: `  ${LINK} ` });
    expect(result).toEqual({ ok: true, style: STYLE, judged: true });
    expect(asked[0]).toEqual({ method: "POST", path: "/api/edit/references", body: { url: LINK } });
    expect(asked.slice(1).map((one) => `${one.method} ${one.path}`)).toEqual(Array(5).fill(`GET /api/edit/references/${ID}`));
    expect(told.map((one) => one.stage)).toEqual(["Getting the video…", "Getting the video…", "Reading its cuts…", "Reading its text…", "Reading its look…"]);
  });

  it("shows no share while the video is fetched, then a share that only grows and leaves room for the cut", async () => {
    network([{ status: 202, body: { id: ID } }, analysing("getting the video", 0), analysing("reading its cuts", 0.5), analysing("reading its cuts", 0.4), analysing("reading its look", 1), READY]);
    const { told } = await read({ link: LINK });
    expect(told[0]?.share).toBeNull();
    const shares = told.slice(1).map((one) => one.share ?? -1);
    expect(shares).toEqual([...shares].sort((a, b) => a - b));
    expect(shares[0]).toBeGreaterThan(0);
    expect(shares.at(-1)).toBeLessThan(1);
  });

  it("that the route refuses gives the route's sentence, and nothing is watched", async () => {
    const asked = network([{ status: 409, body: { error: "an analysis of yours is already running; try again when it ends" } }]);
    const { result } = await read({ link: LINK });
    expect(result).toEqual({ ok: false, problem: "An analysis of yours is already running; try again when it ends." });
    expect(asked).toHaveLength(1);
  });

  it("whose analysis fails gives the worker's own words as a sentence", async () => {
    network([{ status: 202, body: { id: ID } }, analysing("reading its cuts", 0.3), { status: 200, body: { status: "failed", error: "the video is longer than three minutes" } }]);
    expect((await read({ link: LINK })).result).toEqual({ ok: false, problem: "The video is longer than three minutes." });
  });

  it("that is gone when it is read again (404) says it could not be read", async () => {
    network([{ status: 202, body: { id: ID } }, { status: 404, body: { error: "no such reference" } }]);
    expect((await read({ link: LINK })).result).toEqual({ ok: false, problem: "The video could not be read into a style. Try it again, or another video." });
  });

  it("goes on through a read or two that do not get there, and gives up after three in a row, the reference then dropped", async () => {
    let asked = network([{ status: 202, body: { id: ID } }, "down", { status: 500, body: { error: "something went wrong" } }, analysing("reading its look", 1), READY]);
    expect((await read({ link: LINK })).result).toMatchObject({ ok: true });
    expect(asked.filter((one) => one.method === "DELETE")).toEqual([]); // read to its style: the route dropped it
    asked = network([{ status: 202, body: { id: ID } }, analysing("reading its cuts", 0.2), "down", "down", "down"]);
    expect((await read({ link: LINK })).result).toEqual({ ok: false, problem: "The editor could not be reached. Check your connection." });
    expect(asked.at(-1)).toEqual({ method: "DELETE", path: `/api/edit/references/${ID}`, body: undefined });
  });

  it("asks for no drop when the route has dropped it itself: a failed read, or one gone", async () => {
    let asked = network([{ status: 202, body: { id: ID } }, { status: 200, body: { status: "failed", error: "the video is longer than three minutes" } }]);
    await read({ link: LINK });
    expect(asked.map((one) => one.method)).toEqual(["POST", "GET"]);
    asked = network([{ status: 202, body: { id: ID } }, { status: 404, body: { error: "no such reference" } }]);
    await read({ link: LINK });
    expect(asked.map((one) => one.method)).toEqual(["POST", "GET"]);
  });

  it("waits between two reads, and not before the first", async () => {
    network([{ status: 202, body: { id: ID } }, analysing("reading its cuts", 0.2), READY]);
    const waits: number[] = [];
    await read({ link: LINK }, { wait: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([1500]);
  });
});

describe("a read that is stopped", () => {
  it("asks nothing more of the route, tells nothing more, and gives neither a style nor a problem", async () => {
    const stop = new AbortController();
    const asked = network([{ status: 202, body: { id: ID } }, analysing("reading its cuts", 0.3), analysing("reading its text", 0.8), READY]);
    const told: Progress[] = [];
    const result = await readStyle({ link: LINK }, (progress) => {
      told.push(progress);
      if (progress.stage === "Reading its cuts…") stop.abort(); // the creator picks another row at this moment
    }, { ...quick, signal: stop.signal });
    expect(result).toEqual({ ok: false, stopped: true });
    // The link, the one read that was out, and the reference dropped at once (X96), once.
    expect(asked.map((one) => `${one.method} ${one.path}`)).toEqual(["POST /api/edit/references", `GET /api/edit/references/${ID}`, `DELETE /api/edit/references/${ID}`]);
    expect(told.map((one) => one.stage)).toEqual(["Getting the video…", "Reading its cuts…"]);
  });

  it("stopped while a read is out: its answer, a style even, is left aside", async () => {
    const stop = new AbortController();
    const asked = network([{ status: 202, body: { id: ID } }, READY]);
    const result = await readStyle({ link: LINK }, (progress) => {
      if (progress.share === null) stop.abort(); // stopped while the link is still being sent
    }, { ...quick, signal: stop.signal });
    expect(result).toEqual({ ok: false, stopped: true });
    expect(asked.map((one) => one.method)).toEqual(["POST", "DELETE"]); // the route made it all the same: it is dropped
  });

  it("stopped during an upload: nothing is started", async () => {
    const stop = new AbortController();
    const asked = network([{ status: 202, body: { id: ID, upload: "https://bucket.example/put" } }, { status: 202, body: { id: ID } }, READY]);
    const result = await readStyle({ file: new File([new Uint8Array(10)], "clip.mp4", { type: "video/mp4" }) }, () => {}, { ...quick, signal: stop.signal, put: async () => stop.abort() });
    expect(result).toEqual({ ok: false, stopped: true });
    expect(asked.map((one) => one.method)).toEqual(["POST", "DELETE"]); // signed for, then dropped
  });

  it("when the page is left mid-read, drops it with a request that outlives the page, and only once", async () => {
    const page = new EventTarget();
    vi.stubGlobal("window", page);
    const asked = network([{ status: 202, body: { id: ID } }, analysing("reading its cuts", 0.3), READY]);
    await readStyle({ link: LINK }, (progress) => {
      if (progress.stage === "Reading its cuts…") {
        page.dispatchEvent(new Event("pagehide"));
        page.dispatchEvent(new Event("pagehide"));
      }
    }, quick);
    expect(asked.filter((one) => one.method === "DELETE")).toEqual([{ method: "DELETE", path: `/api/edit/references/${ID}`, body: undefined, keepalive: true }]);
    page.dispatchEvent(new Event("pagehide")); // after the read: no longer listened for
    expect(asked.filter((one) => one.method === "DELETE")).toHaveLength(1);
  });
});

describe("a file", () => {
  const file = new File([new Uint8Array(1000)], "clip.mp4", { type: "video/mp4" });

  it("is signed for, put, started and watched, its upload shown as it goes", async () => {
    const asked = network([{ status: 202, body: { id: ID, upload: "https://bucket.example/put" } }, { status: 202, body: { id: ID } }, analysing("reading its cuts", 0.5), READY]);
    const puts: [string, File][] = [];
    const { result, told } = await read({ file }, {
      ...quick,
      put: async (url, sent, onSent) => {
        puts.push([url, sent]);
        onSent(500);
        onSent(1000);
      },
    });
    expect(result).toEqual({ ok: true, style: STYLE, judged: true });
    expect(asked.map((one) => `${one.method} ${one.path}`)).toEqual(["POST /api/edit/references", `POST /api/edit/references/${ID}`, `GET /api/edit/references/${ID}`, `GET /api/edit/references/${ID}`]);
    expect(asked[0]?.body).toEqual({ name: "clip.mp4", bytes: 1000, type: "video/mp4" });
    expect(puts).toEqual([["https://bucket.example/put", file]]);
    expect(told.map((one) => one.stage)).toEqual(["Getting the video…", "Getting the video…", "Getting the video…", "Reading its cuts…"]);
    const shares = told.map((one) => one.share ?? -1);
    expect(shares).toEqual([...shares].sort((a, b) => a - b));
    expect(shares[0]).toBe(0);
  });

  it("that does not reach the bucket says so, starts nothing, and drops what was signed for", async () => {
    const asked = network([{ status: 202, body: { id: ID, upload: "https://bucket.example/put" } }]);
    const { result } = await read({ file }, { ...quick, put: async () => Promise.reject(new Error("the upload did not reach R2")) });
    expect(result).toEqual({ ok: false, problem: "The video did not upload. Check your connection." });
    expect(asked.map((one) => `${one.method} ${one.path}`)).toEqual(["POST /api/edit/references", `DELETE /api/edit/references/${ID}`]);
  });

  it("whose analysis cannot be started gives the route's sentence, and drops it", async () => {
    const asked = network([{ status: 202, body: { id: ID, upload: "https://bucket.example/put" } }, { status: 409, body: { error: "an analysis of yours is already running; try again when it ends" } }]);
    const { result } = await read({ file }, { ...quick, put: async () => {} });
    expect(result).toEqual({ ok: false, problem: "An analysis of yours is already running; try again when it ends." });
    expect(asked.at(-1)?.method).toBe("DELETE");
  });
});
