/**
 * net.test.ts — the editor page's side of its routes (plan 2026-11-24-editor-screens-a, Task 9): a call that always answers,
 * the two things added to the dev page's (a DELETE, and a PUT sent as the type it was signed for), and a refusal as one plain
 * sentence; and (Task 10's fix round) a call's deadline: one that never answers ends as a failed call with its own sentence,
 * its request aborted. The network is stood in (`fetch`, `XMLHttpRequest`); what is asked of it is read as it was asked.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { CALL_MS, NOT_IN_TIME, Refused, UNREACHABLE, WENT_WRONG, call, problemOf, put, sentence, stageLine } from "../net";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** `fetch`, answering every call the same, and keeping what was asked. */
function network(answer: () => Response): { path: string; init: RequestInit | undefined }[] {
  const asked: { path: string; init: RequestInit | undefined }[] = [];
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    asked.push({ path, init });
    return answer();
  });
  return asked;
}
const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status });

describe("call", () => {
  it("reads with no body, never from a cache", async () => {
    const asked = network(json(200, { takes: [] }));
    expect(await call<{ takes: unknown[] }>("/api/edit/takes")).toEqual({ ok: true, status: 200, body: { takes: [] } });
    expect(asked).toEqual([{ path: "/api/edit/takes", init: { cache: "no-store", signal: expect.any(AbortSignal) } }]);
  });

  it("posts a body as JSON", async () => {
    const asked = network(json(201, { take: { id: "t" } }));
    expect(await call("/api/edit/takes", { name: "take.mp4" })).toMatchObject({ ok: true, status: 201 });
    expect(asked[0]?.init).toEqual({ method: "POST", headers: { "Content-Type": "application/json" }, body: '{"name":"take.mp4"}', signal: expect.any(AbortSignal) });
  });

  it("deletes with no body, and is ok when the route answers 204 with none: no body is no error", async () => {
    const asked = network(() => new Response(null, { status: 204 }));
    expect(await call("/api/edit/takes/t", undefined, "DELETE")).toEqual({ ok: true, status: 204, body: {} });
    expect(asked[0]?.init).toEqual({ method: "DELETE", headers: { "Content-Type": "application/json" }, signal: expect.any(AbortSignal) });
  });

  it("answers a refusal with the route's line, never throwing", async () => {
    network(json(409, { error: "an analysis of yours is already running; try again when it ends" }));
    const answer = await call("/api/edit/takes/t/uploaded", {});
    expect(answer).toEqual({ ok: false, status: 409, body: { error: "an analysis of yours is already running; try again when it ends" } });
    expect(problemOf(answer)).toBe("An analysis of yours is already running; try again when it ends.");
  });

  it("answers a call that never got there as status 0, and a page that is no JSON by its status: each a plain line", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const down = await call("/api/edit/takes");
    expect(down).toMatchObject({ ok: false, status: 0 });
    expect(problemOf(down)).toBe(UNREACHABLE);
    network(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    const gateway = await call("/api/edit/takes");
    expect(gateway).toEqual({ ok: false, status: 502, body: { error: "it answered 502" } });
    expect(problemOf(gateway)).toBe(WENT_WRONG);
  });
});

describe("a call's deadline", () => {
  type Answered = Awaited<ReturnType<typeof call>>;
  const stopped = () => new DOMException("The operation was aborted.", "AbortError");
  /** `fetch` that never answers: a call to it ends only when its request is aborted, as the browser's does. Keeps each signal. */
  function silent(): AbortSignal[] {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", (_path: string, init?: RequestInit) =>
      new Promise<Response>((_answer, fail) => {
        signals.push(init!.signal!);
        init!.signal!.addEventListener("abort", () => fail(stopped()));
      }));
    return signals;
  }
  /** A call made, and its answer once it has one. */
  const made = (asking: Promise<Answered>): { answer: Answered | null } => {
    const got: { answer: Answered | null } = { answer: null };
    void asking.then((answer) => (got.answer = answer));
    return got;
  };
  const fakeTime = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  it("ends a call that never answers at half a minute: a failed call with its own sentence, its request aborted", async () => {
    fakeTime();
    const signals = silent();
    const got = made(call("/api/edit/takes", { name: "take.mp4" }));
    await vi.advanceTimersByTimeAsync(CALL_MS - 1);
    expect(got.answer).toBeNull();
    expect(signals[0]!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(got.answer).toEqual({ ok: false, status: 0, body: { error: NOT_IN_TIME } });
    expect(signals[0]!.aborted).toBe(true);
    expect(problemOf(got.answer!)).toBe("The editor did not answer in time.");
    expect(CALL_MS).toBe(30_000);
  });

  it("gives a call the time it is told to: a route that may take three minutes is not cut off at half a minute", async () => {
    fakeTime();
    const signals = silent();
    const got = made(call("/api/edit/edits/e/cut", {}, undefined, 185_000));
    await vi.advanceTimersByTimeAsync(184_999);
    expect(got.answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(got.answer).toMatchObject({ ok: false, status: 0, body: { error: NOT_IN_TIME } });
    expect(signals[0]!.aborted).toBe(true);
    // A read is told its time the same way, with no body and no method.
    const read = made(call("/api/edit/references/r", undefined, undefined, 1000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(read.answer).toMatchObject({ ok: false, status: 0, body: { error: NOT_IN_TIME } });
  });

  it("ends a call whose answer began and then stopped coming", async () => {
    fakeTime();
    vi.stubGlobal("fetch", async (_path: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_body, fail) => init!.signal!.addEventListener("abort", () => fail(stopped()))),
    }));
    const got = made(call("/api/edit/takes"));
    await vi.advanceTimersByTimeAsync(CALL_MS);
    expect(got.answer).toEqual({ ok: false, status: 0, body: { error: NOT_IN_TIME } });
  });

  it("leaves nothing running once a call has ended in time: no wait armed, no request aborted", async () => {
    fakeTime();
    const signals: AbortSignal[] = [];
    const answers: (() => Promise<Response>)[] = [
      async () => new Response(JSON.stringify({ takes: [] }), { status: 200 }),
      async () => new Response(JSON.stringify({ error: "no such take" }), { status: 404 }),
      async () => Promise.reject(new TypeError("Failed to fetch")),
    ];
    vi.stubGlobal("fetch", (_path: string, init?: RequestInit) => {
      signals.push(init!.signal!);
      return answers.shift()!();
    });
    expect(await call("/api/edit/takes")).toMatchObject({ ok: true, status: 200 });
    expect(await call("/api/edit/takes/t")).toMatchObject({ ok: false, status: 404 });
    const down = await call("/api/edit/takes");
    expect(down).toMatchObject({ ok: false, status: 0 });
    // Not reached is not the same as not answered in time.
    expect(problemOf(down)).toBe(UNREACHABLE);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10 * CALL_MS);
    expect(signals.map((signal) => signal.aborted)).toEqual([false, false, false]);
  });
});

describe("put", () => {
  /** The browser's request, stood in: what was opened, set and sent is kept, and the test ends it as R2 would. */
  class StandIn {
    static made: StandIn[] = [];
    upload = { onprogress: null as ((event: { loaded: number }) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 0;
    asked: unknown[] = [];
    constructor() {
      StandIn.made.push(this);
    }
    open(method: string, url: string) {
      this.asked.push(`${method} ${url}`);
    }
    setRequestHeader(name: string, value: string) {
      this.asked.push(`${name}: ${value}`);
    }
    send(body: unknown) {
      this.asked.push(body);
    }
    abort() {
      this.asked.push("abort");
      this.onabort?.();
    }
    answer(status: number) {
      this.status = status;
      this.onload?.();
    }
  }
  const sending = () => {
    StandIn.made = [];
    vi.stubGlobal("XMLHttpRequest", StandIn);
  };
  const file = (type: string) => new File([new Uint8Array(10)], "IMG_0042.MOV", { type });

  it("puts the file at its address as the type it was signed for, whatever the device called it", async () => {
    sending();
    const nameless = file("");
    const done = put("https://r2.test/put", nameless, () => {}, "video/quicktime");
    StandIn.made[0]!.answer(200);
    await done;
    expect(StandIn.made[0]!.asked).toEqual(["PUT https://r2.test/put", "Content-Type: video/quicktime", nameless]);
  });

  it("puts it as the file's own type when none is given", async () => {
    sending();
    const done = put("https://r2.test/put", file("video/mp4"), () => {});
    StandIn.made[0]!.answer(200);
    await done;
    expect(StandIn.made[0]!.asked[1]).toBe("Content-Type: video/mp4");
  });

  it("tells how many bytes have gone", async () => {
    sending();
    const told: number[] = [];
    const done = put("https://r2.test/put", file("video/mp4"), (bytes) => told.push(bytes));
    StandIn.made[0]!.upload.onprogress?.({ loaded: 4 });
    StandIn.made[0]!.upload.onprogress?.({ loaded: 10 });
    StandIn.made[0]!.answer(200);
    await done;
    expect(told).toEqual([4, 10]);
  });

  it("fails when R2 refuses the file, and when R2 is not reached", async () => {
    sending();
    const refused = put("https://r2.test/put", file("video/mp4"), () => {});
    StandIn.made[0]!.answer(403);
    await expect(refused).rejects.toThrow("R2 answered 403 to the upload");
    const unreached = put("https://r2.test/put", file("video/mp4"), () => {});
    StandIn.made[1]!.onerror?.();
    await expect(unreached).rejects.toThrow("the upload did not reach R2");
  });

  it("stops when its signal says so: the browser's request is aborted, and it ends as stopped, neither refused nor unreached", async () => {
    sending();
    const stop = new AbortController();
    const mov = file("video/mp4");
    const going = put("https://r2.test/put", mov, () => {}, "video/mp4", stop.signal).catch((error: unknown) => error);
    expect(StandIn.made[0]!.asked).toEqual(["PUT https://r2.test/put", "Content-Type: video/mp4", mov]);
    stop.abort();
    expect(StandIn.made[0]!.asked.at(-1)).toBe("abort");
    const ended = await going;
    expect(ended).toMatchObject({ name: "AbortError", message: "the upload was stopped" });
    expect(ended).not.toBeInstanceOf(Refused);
  });

  it("sends nothing for a signal that has said so already", async () => {
    sending();
    const stop = new AbortController();
    stop.abort();
    await expect(put("https://r2.test/put", file("video/mp4"), () => {}, "video/mp4", stop.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(StandIn.made).toEqual([]);
  });

  it("says a refusal by the address (a 4xx) as one: the same PUT cannot pass again; no answer, or storage failing, is not one", async () => {
    sending();
    const failures = [403, 400, 503, null].map((status, at) => {
      const going = put("https://r2.test/put", file("video/mp4"), () => {}).catch((error: unknown) => error);
      if (status === null) StandIn.made[at]!.onerror?.();
      else StandIn.made[at]!.answer(status);
      return going;
    });
    const [expired, mismatched, failing, unreached] = await Promise.all(failures);
    expect(expired).toBeInstanceOf(Refused);
    expect(mismatched).toBeInstanceOf(Refused);
    expect(failing).toBeInstanceOf(Error);
    expect(failing).not.toBeInstanceOf(Refused);
    expect((failing as Error).message).toBe("R2 answered 503 to the upload");
    expect(unreached).not.toBeInstanceOf(Refused);
  });
});

describe("a route's line, as a creator reads it", () => {
  it("is a sentence: a capital first, a full stop last unless it ends already", () => {
    expect(sentence("  the take is not ready ")).toBe("The take is not ready.");
    expect(sentence("Is it a video?")).toBe("Is it a video?");
    expect(sentence("reading its cuts…")).toBe("Reading its cuts…");
    expect(sentence("   ")).toBe("");
  });

  it("is the route's own sentence; a plain line when it never got there or gave none", () => {
    expect(problemOf({ status: 400, body: { error: "a take is at most 2 GB" } })).toBe("A take is at most 2 GB.");
    expect(problemOf({ status: 0, body: { error: "TypeError: Failed to fetch" } })).toBe(UNREACHABLE);
    expect(problemOf({ status: 500, body: {} })).toBe(WENT_WRONG);
    expect(problemOf({ status: 502, body: { error: "it answered 502" } })).toBe(WENT_WRONG);
  });

  it("gives a stage as a line of progress", () => {
    expect(stageLine("reading its cuts")).toBe("Reading its cuts…");
    expect(stageLine("")).toBe("…");
  });
});
