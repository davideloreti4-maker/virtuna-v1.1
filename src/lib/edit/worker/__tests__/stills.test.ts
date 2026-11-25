import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newEdit, type Asset, type Edit } from "@/lib/edit";
import { sheetOf, stillsOf } from "../stills";
import { USER } from "./rows";
import { ENV, PROXY_KEY, PROXY_SECRET, WORKER_SECRET, WORKER_URL } from "./stand-ins";

const ASSET: Asset = {
  id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: `u/${USER}/takes/take/full.mp4` },
  ms: 12_700, w: 1080, h: 1920, sound: true, words: null,
};
const EDIT: Edit = newEdit(ASSET);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const base64 = (text: string) => Buffer.from(text).toString("base64");

/**
 * The worker's `POST /stills` (part 3, Task 6) at `fetch`, as it answers: Modal's proxy refuses a call without the workspace's
 * proxy token (401, in its own words, not JSON); then the worker's 401 without the secret; else as told: the stills asked
 * (each a stand-in JPEG naming its frame), one sheet, its 400, 422 or 500 with the line it says, an answer of other frames,
 * no answer at all, or none in time.
 */
class StillsWorker {
  readonly asked: { url: string; headers: Headers; body: unknown; signal: AbortSignal | null }[] = [];

  /** The one call it was given. */
  only() {
    expect(this.asked).toHaveLength(1);
    return this.asked[0]!;
  }

  /** "hangs": no answer until the call's signal is aborted, which fails it with the signal's reason, as `fetch` does. */
  answer: "ok" | 400 | 422 | 500 | "other frames" | "not json" | "down" | "timeout" | "hangs" = "ok";

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    if (url.host !== new URL(WORKER_URL).host) throw new Error(`nothing stands in for ${url.origin}`);
    const headers = new Headers(init.headers);
    this.asked.push({ url: url.href, headers, body: JSON.parse(String(init.body)), signal: init.signal ?? null });
    if (this.answer === "down") throw new TypeError("fetch failed", { cause: new Error(`getaddrinfo ENOTFOUND ${url.host}`) });
    if (this.answer === "timeout") throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    if (this.answer === "hangs") {
      const signal = init.signal;
      if (!signal) throw new Error("a call with no signal would hang for ever");
      signal.throwIfAborted();
      return new Promise((_, fail) => signal.addEventListener("abort", () => fail(signal.reason), { once: true }));
    }
    if (headers.get("modal-key") !== PROXY_KEY || headers.get("modal-secret") !== PROXY_SECRET) {
      return new Response("modal-http: missing credentials for proxy authorization", { status: 401 });
    }
    if (url.pathname !== "/stills" || init.method !== "POST") return json(405, { detail: "Method Not Allowed" });
    if (headers.get("authorization") !== `Bearer ${WORKER_SECRET}`) return json(401, { error: "not allowed" });
    if (this.answer === 400) return json(400, { error: "frames are 1 to 6 whole numbers from 0, or 1 to 12 on a sheet" });
    if (this.answer === 422) return json(422, { error: "frame 300 is past the film's end: it has 280 frames" });
    if (this.answer === 500) return json(500, { error: "the stills failed on our side; try again" });
    if (this.answer === "not json") return new Response("<html>bad gateway</html>", { status: 200 });
    const { frames, sheet } = JSON.parse(String(init.body)) as { frames: number[]; sheet?: boolean };
    if (sheet) return json(200, { sheet: base64(`sheet of ${frames.join(",")}`) });
    const given = this.answer === "other frames" ? frames.map((frame) => frame + 1) : frames;
    return json(200, { stills: given.map((frame) => ({ frame, jpeg: base64(`jpeg ${frame}`) })) });
  };
}

describe("the worker's stills (part 3, Task 6)", () => {
  let worker: StillsWorker;
  beforeEach(() => {
    worker = new StillsWorker();
    vi.stubGlobal("fetch", worker.fetch);
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks the worker's address for the frames with the secret and the proxy token, and gives back each still", async () => {
    const stills = await stillsOf(USER, EDIT, [0, 45, 300]);
    expect(stills).toEqual([0, 45, 300].map((frame) => ({ frame, jpeg: base64(`jpeg ${frame}`) })));
    const call = worker.only();
    expect(call.url).toBe(`${WORKER_URL}/stills`);
    expect(call.headers.get("authorization")).toBe(`Bearer ${WORKER_SECRET}`);
    expect(call.headers.get("modal-key")).toBe(PROXY_KEY);
    expect(call.headers.get("modal-secret")).toBe(PROXY_SECRET);
    expect(call.headers.get("content-type")).toBe("application/json");
    expect(call.body).toEqual({ user: USER, edit: EDIT, frames: [0, 45, 300] });
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it("asks for a sheet and gives back its one JPEG", async () => {
    expect(await sheetOf(USER, EDIT, [0, 30, 60, 90, 120])).toBe(base64("sheet of 0,30,60,90,120"));
    expect(worker.only().body).toEqual({ user: USER, edit: EDIT, frames: [0, 30, 60, 90, 120], sheet: true });
  });

  it.each([
    [422, "frame 300 is past the film's end: it has 280 frames"],
    [400, "frames are 1 to 6 whole numbers from 0, or 1 to 12 on a sheet"],
    [500, "the stills failed on our side; try again"],
  ] as const)("throws the worker's own line when it answers %s", async (status, line) => {
    worker.answer = status;
    await expect(stillsOf(USER, EDIT, [0, 45, 300])).rejects.toThrow(new Error(line));
    await expect(sheetOf(USER, EDIT, [0])).rejects.toThrow(new Error(line));
  });

  it("says only that the worker could not be reached when the call fails outright; its address goes to the log alone", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    worker.answer = "down";
    const failure = await stillsOf(USER, EDIT, [0]).catch((error: unknown) => error);
    expect(failure).toEqual(new Error("the worker could not be reached"));
    expect(String((failure as Error).message)).not.toContain(new URL(WORKER_URL).host);
    expect(logged.mock.calls.flat().join(" ")).toContain("ENOTFOUND");
    logged.mockRestore();
  });

  it("gives up after 75 s, after the worker's own 60 s, saying so", async () => {
    worker.answer = "timeout";
    await expect(stillsOf(USER, EDIT, [0])).rejects.toThrow(new Error("the worker gave no stills in 75 s"));
  });

  describe("a signal of the caller's (the agent's own deadline, Task 7)", () => {
    it.each([
      ["stills", (signal: AbortSignal) => stillsOf(USER, EDIT, [0, 45], { signal })],
      ["a sheet", (signal: AbortSignal) => sheetOf(USER, EDIT, [0, 45], { signal })],
    ] as const)("stops the call for %s when it is aborted, saying so, and not as the 75 s timeout", async (_, call) => {
      worker.answer = "hangs";
      const caller = new AbortController();
      const asked = call(caller.signal);
      await vi.waitFor(() => expect(worker.asked).toHaveLength(1));
      const sent = worker.only().signal;
      expect(sent?.aborted).toBe(false);
      caller.abort(new DOMException("the agent's time is up", "TimeoutError"));
      await expect(asked).rejects.toThrow(new Error("the stills were stopped before the worker answered"));
      expect(sent?.aborted).toBe(true);
    });

    it.each([
      ["stills", (signal: AbortSignal) => stillsOf(USER, EDIT, [0], { signal })],
      ["a sheet", (signal: AbortSignal) => sheetOf(USER, EDIT, [0], { signal })],
    ] as const)("asks nothing of the worker's answer for %s when the signal is aborted already", async (_, call) => {
      worker.answer = "hangs";
      await expect(call(AbortSignal.abort())).rejects.toThrow(new Error("the stills were stopped before the worker answered"));
    });

    it.each([
      ["stills", (signal: AbortSignal) => stillsOf(USER, EDIT, [0, 45], { signal })],
      ["a sheet", (signal: AbortSignal) => sheetOf(USER, EDIT, [0, 45], { signal })],
    ] as const)("answers as before for %s while the caller's signal is not aborted, on a signal that is not the caller's alone", async (_, call) => {
      const caller = new AbortController();
      await expect(call(caller.signal)).resolves.toBeTruthy();
      // The call's signal is neither the caller's nor the timeout alone: it is the two combined, so either one stops it.
      const sent = worker.only().signal;
      expect(sent).not.toBe(caller.signal);
      expect(sent?.aborted).toBe(false);
    });

    it.each([
      ["stills", (signal: AbortSignal) => stillsOf(USER, EDIT, [0], { signal })],
      ["a sheet", (signal: AbortSignal) => sheetOf(USER, EDIT, [0], { signal })],
    ] as const)("keeps the 75 s timeout beside it for %s: the combined signal fires at 75 s, the caller's never having fired", async (_, call) => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        worker.answer = "hangs";
        const caller = new AbortController();
        const asked = call(caller.signal);
        const failed = expect(asked).rejects.toThrow(new Error("the worker gave no stills in 75 s"));
        // Asked at once, with no time passed (`vi.waitFor` would move the fake clock on).
        await vi.advanceTimersByTimeAsync(0);
        const sent = worker.only().signal;
        await vi.advanceTimersByTimeAsync(74_999);
        expect(sent?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await failed;
        expect(sent?.aborted).toBe(true);
        expect(caller.signal.aborted).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("says what Modal's proxy answered when it refuses the call, not its words", async () => {
    vi.stubEnv("EDIT_WORKER_PROXY_SECRET", "not-the-token");
    await expect(stillsOf(USER, EDIT, [0])).rejects.toThrow(new Error("the worker answered 401"));
  });

  it("refuses an answer that is not the stills asked", async () => {
    worker.answer = "other frames";
    await expect(stillsOf(USER, EDIT, [0, 45])).rejects.toThrow(new Error("the worker's answer is not the stills asked"));
    worker.answer = "not json";
    await expect(stillsOf(USER, EDIT, [0])).rejects.toThrow(new Error("the worker's answer is not the stills asked"));
    await expect(sheetOf(USER, EDIT, [0])).rejects.toThrow(new Error("the worker's answer is not the sheet asked"));
  });

  it("calls nothing without the worker's settings, and names the one missing", async () => {
    vi.stubEnv("EDIT_WORKER_URL", "");
    await expect(stillsOf(USER, EDIT, [0])).rejects.toThrow(new Error("EDIT_WORKER_URL is not set"));
    expect(worker.asked).toEqual([]);
  });
});
