/** @vitest-environment happy-dom */
/**
 * uploads.test.ts — the uploads in flight, held outside any page (plan 2026-11-24-editor-screens-a, Task 9; spec §5.2, E21): the
 * file put at its signed address with the type it was signed for, how far it is and the time left from what it measured, the
 * finish told, a failure said and tried again, and a holder anyone can listen to. The PUT into R2 and the network are stood in;
 * the holder is real, and so is the page that listens to it (`useUpload`, rendered).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Refused } from "../net";
import { NOT_ACCEPTED, NOT_SENT, forgetUpload, retryUpload, startUpload, subscribeUploads, uploadOf, useUpload, type UploadDeps } from "../uploads";

let n = 0;
const ids: string[] = [];
const takeId = () => {
  const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  ids.push(id);
  return id;
};
const file = (bytes: number) => new File([new Uint8Array(bytes)], "IMG_0042.MOV", { type: "video/quicktime" });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

interface Put {
  url: string;
  type: string | undefined;
  onSent: (bytes: number) => void;
  done: () => void;
  /** No connection: the PUT never got an answer. */
  fail: () => void;
  /** The address answered and refused the file, as the page's `put` says it (`Refused`). */
  refuse: () => void;
  /** What the holder stops this PUT with. */
  signal: AbortSignal | undefined;
}

/** The browser's request, stood in, for the tests that run the page's own `put`: it is ended as R2 would, and sees an abort. */
class Sending {
  static made: Sending[] = [];
  upload = { onprogress: null as ((event: { loaded: number }) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  aborted = false;
  constructor() {
    Sending.made.push(this);
  }
  open() {}
  setRequestHeader() {}
  send() {}
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  answer(status: number) {
    this.status = status;
    this.onload?.();
  }
}

function wire(finish: { status: number; body: unknown } = { status: 202, body: { job: { id: "j" } } }) {
  let clock = 0;
  const puts: Put[] = [];
  const finishes: string[] = [];
  const answer = { ...finish };
  const deps: UploadDeps = {
    now: () => clock,
    objectUrl: () => "blob:local/1",
    revoke: vi.fn(),
    put: (url, _file, onSent, type, signal) =>
      new Promise<void>((done, fail) => puts.push({ url, type, onSent, done, fail: () => fail(new Error("the upload did not reach R2")), refuse: () => fail(new Refused("R2 answered 403 to the upload")), signal })),
  };
  /** The same, but the page's own `put` over the stood-in browser's request (`Sending`). */
  const own = (): UploadDeps => {
    Sending.made = [];
    vi.stubGlobal("XMLHttpRequest", Sending);
    return { now: deps.now, objectUrl: deps.objectUrl, revoke: deps.revoke };
  };
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    finishes.push(`${init?.method ?? "GET"} ${String(path)}`);
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }));
  return { deps, own, puts, finishes, answer, tick: (ms: number) => (clock += ms) };
}

afterEach(() => {
  for (const id of ids.splice(0)) forgetUpload(id);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("an upload held outside the page", () => {
  it("puts the file at its signed address with the type it was signed for, says how far it is, then tells its finish", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(4800), net.deps);
    expect(uploadOf(id)).toMatchObject({ status: "sending", sent: 0, total: 4800, localUrl: "blob:local/1", secondsLeft: null });
    expect(net.puts[0]).toMatchObject({ url: "https://r2.test/put", type: "video/quicktime" });
    net.tick(2000);
    net.puts[0]!.onSent(400);
    expect(uploadOf(id)).toMatchObject({ sent: 400, secondsLeft: 22 });
    net.puts[0]!.done();
    await settle();
    await settle();
    expect(net.finishes).toEqual([`POST /api/edit/takes/${id}/uploaded`]);
    expect(uploadOf(id)?.status).toBe("sent");
  });

  it("says when the upload stopped, and Try again sends it again", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.fail();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: NOT_SENT });
    retryUpload(id);
    expect(net.puts).toHaveLength(2);
    net.puts[1]!.done();
    await settle();
    await settle();
    expect(uploadOf(id)?.status).toBe("sent");
  });

  it("takes a finish told twice as told, says a refused one in the route's words, and tries only the finish again", async () => {
    const id = takeId();
    const net = wire({ status: 409, body: { error: "IMG_0042.MOV did not arrive whole: 4 of its 10 bytes are stored" } });
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.done();
    await settle();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: "IMG_0042.MOV did not arrive whole: 4 of its 10 bytes are stored." });
    net.answer.body = { error: "the take is analysing: it is not waiting for its upload" };
    retryUpload(id);
    await settle();
    await settle();
    expect(net.puts).toHaveLength(1);
    expect(uploadOf(id)?.status).toBe("sent");
  });

  it("tells whoever listens, and forgets with its local copy", async () => {
    const id = takeId();
    const net = wire();
    const heard = vi.fn();
    const stop = subscribeUploads(heard);
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    expect(heard).toHaveBeenCalled();
    forgetUpload(id);
    expect(uploadOf(id)).toBeNull();
    expect(net.deps.revoke).toHaveBeenCalledWith("blob:local/1");
    stop();
  });

  it("tells every step to whoever listens, and nothing to one who stopped", async () => {
    const id = takeId();
    const net = wire();
    const steps: string[] = [];
    const gone = vi.fn();
    subscribeUploads(gone)();
    const stop = subscribeUploads(() => steps.push(`${uploadOf(id)?.status} ${uploadOf(id)?.sent}`));
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.onSent(4);
    net.puts[0]!.done();
    await settle();
    await settle();
    stop();
    expect([...new Set(steps)]).toEqual(["sending 0", "sending 4", "finishing 10", "sent 10"]);
    expect(gone).not.toHaveBeenCalled();
  });
});

describe("the time left", () => {
  it("is none once all of it has gone: not while R2 answers, not while its finish is told, not once it is sent", async () => {
    const id = takeId();
    const net = wire();
    // The finish, held until it is answered here: the upload is seen while it is told.
    let answer = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((answered) => (answer = () => answered(new Response(JSON.stringify({ job: { id: "j" } }), { status: 202 }))))));
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(4800), net.deps);
    net.tick(2000);
    net.puts[0]!.onSent(2400);
    expect(uploadOf(id)).toMatchObject({ status: "sending", secondsLeft: 2 });
    net.tick(2000);
    net.puts[0]!.onSent(4800); // every byte has gone; R2 has not answered yet
    expect(uploadOf(id)).toMatchObject({ status: "sending", sent: 4800, secondsLeft: null });
    net.puts[0]!.done();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "finishing", sent: 4800, secondsLeft: null });
    answer();
    await settle();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "sent", sent: 4800, secondsLeft: null });
  });

  it("is measured over the whole window, at the fastest a browser tells (every 50 ms)", () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(69_600), net.deps);
    // Ten seconds, told every 50 ms: 1000 bytes a second for four seconds, then 100 a second.
    let sent = 0;
    for (let ms = 50; ms <= 10_000; ms += 50) {
      net.tick(50);
      sent += ms <= 4000 ? 50 : 5;
      net.puts[0]!.onSent(sent);
    }
    // The last 8 s (`RATE_WINDOW_MS`) took 2600 bytes, 325 a second: the 65,000 left take 200 s. Were only the last 6 s
    // kept, the rate would read 100 a second, and the time left 650 s.
    expect(uploadOf(id)).toMatchObject({ sent: 4600, secondsLeft: 200 });
  });
});

describe("a failed upload tried again", () => {
  it("starts its measure anew, and says nothing of the failure while it goes", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(4800), net.deps);
    net.tick(2000);
    net.puts[0]!.onSent(2400);
    expect(uploadOf(id)?.secondsLeft).toBe(2);
    net.puts[0]!.fail();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: NOT_SENT, sent: 2400, secondsLeft: null }); // stopped: no time left is said
    net.tick(1000); // Try again, tapped a second later: what the first try measured is still within the window
    retryUpload(id);
    expect(uploadOf(id)).toMatchObject({ status: "sending", sent: 0, secondsLeft: null, error: null });
    net.tick(2000);
    net.puts[1]!.onSent(400);
    expect(uploadOf(id)).toMatchObject({ sent: 400, secondsLeft: 22 }); // from the second try's own two seconds: the file goes from its first byte again
  });

  it("is left alone while it is going: Try again is for one that failed", () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    retryUpload(id);
    retryUpload("00000000-0000-4000-8000-999999999999"); // no such upload: nothing
    expect(net.puts).toHaveLength(1);
  });

  it("whose finish never got there says the editor could not be reached, and tells only the finish again", async () => {
    const id = takeId();
    const net = wire();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.done();
    await settle();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: "The editor could not be reached. Check your connection." });
    const finishes: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (path: string) => {
      finishes.push(String(path));
      return new Response(JSON.stringify({ job: { id: "j" } }), { status: 202 });
    }));
    retryUpload(id);
    await settle();
    await settle();
    expect(net.puts).toHaveLength(1);
    expect(finishes).toEqual([`/api/edit/takes/${id}/uploaded`]);
    expect(uploadOf(id)?.status).toBe("sent");
  });
});

/** An upload whose PUT ended well and whose finish the route answered so. */
async function finished(status: number, body: unknown) {
  const id = takeId();
  const net = wire({ status, body });
  startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
  net.puts[0]!.done();
  await settle();
  await settle();
  return { id, net };
}

describe("whether trying again can work (R17)", () => {
  it("can, when the PUT got no answer: the connection is named", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    expect(uploadOf(id)).toMatchObject({ status: "sending", again: false }); // nothing has failed: nothing to try again
    net.puts[0]!.fail();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: NOT_SENT, again: true });
    retryUpload(id);
    expect(uploadOf(id)).toMatchObject({ status: "sending", again: false, error: null });
    net.puts[1]!.done();
    await settle();
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "sent", again: false });
  });

  it("cannot, when the address refused the file: the connection is not blamed, and nothing is put there again", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.onSent(4);
    net.puts[0]!.refuse(); // a signed address lasts an hour
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: NOT_ACCEPTED, again: false, secondsLeft: null });
    expect(NOT_ACCEPTED).toBe("The upload was not accepted. Pick the video again.");
    expect(NOT_ACCEPTED).not.toMatch(/connection/i);
    retryUpload(id);
    await settle();
    expect(net.puts).toHaveLength(1);
    expect(uploadOf(id)).toMatchObject({ status: "failed", again: false });
  });

  it("is told apart by the browser's own request: a refusal by the address, no answer at all, storage failing", async () => {
    // The page's own `put`, over a stood-in XMLHttpRequest: what the holder reads is what `put` really says.
    const own = wire().own();
    const [refused, unreached, failing] = [takeId(), takeId(), takeId()];
    for (const id of [refused, unreached, failing]) startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), own);
    Sending.made[0]!.answer(403);
    Sending.made[1]!.onerror?.();
    Sending.made[2]!.answer(503);
    await settle();
    expect(uploadOf(refused)).toMatchObject({ status: "failed", error: NOT_ACCEPTED, again: false });
    expect(uploadOf(unreached)).toMatchObject({ status: "failed", error: NOT_SENT, again: true });
    expect(uploadOf(failing)).toMatchObject({ status: "failed", error: NOT_SENT, again: true }); // storage's own failure may pass on another try
  });

  it("cannot, when the take is past its upload another way or is not there: the finish is not told again", async () => {
    for (const [status, error] of [[409, "the take is failed: it is not waiting for its upload"], [404, "no such take"]] as const) {
      const { id, net } = await finished(status, { error });
      expect(uploadOf(id)).toMatchObject({ status: "failed", error: NOT_ACCEPTED, again: false });
      retryUpload(id);
      await settle();
      expect(net.finishes).toHaveLength(1);
    }
  });

});

describe("a finish refused while another analysis of the creator's runs (R31)", () => {
  /** The route's sentence for it, read from the route's own file: the holder matches these words, so a route that says it another way turns this red. */
  const BEHIND = (() => {
    const source = readFileSync(join(process.cwd(), "src/app/api/edit/upload.ts"), "utf8");
    const found = [...source.matchAll(/refuse\(409, "(an analysis of yours[^"]*)"\)/g)].map((one) => one[1]!);
    expect(found).toEqual(["an analysis of yours is already running; try again when it ends"]); // src/app/api/edit/upload.ts:25
    return found[0]!;
  })();
  const refusedBehind = { status: 409, body: { error: BEHIND } };
  const started = { status: 202, body: { job: { id: "j" } } };
  /** An upload whose PUT ended well and whose finish is answered, at each telling, by the next of `answers` (the last one kept), with time stood in. */
  async function behind(answers: { status: number; body: unknown }[]) {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const id = takeId();
    const net = wire();
    vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
      net.finishes.push(`${init?.method ?? "GET"} ${String(path)}`);
      const next = answers.length > 1 ? answers.shift()! : answers[0]!;
      return new Response(JSON.stringify(next.body), { status: next.status });
    }));
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.done();
    await vi.advanceTimersByTimeAsync(0);
    return { id, net };
  }

  it("is kept as sent and waiting, its finish told again every 10 s until it is taken: nothing is put twice", async () => {
    const { id, net } = await behind([refusedBehind, refusedBehind, started]);
    expect(uploadOf(id)).toMatchObject({ status: "waiting", sent: 10, error: null, again: false, waitedOut: false });
    expect(net.finishes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(net.finishes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(net.finishes).toHaveLength(2);
    // Told again, and refused again: still waiting, never "finishing" meanwhile, and nothing to try again.
    expect(uploadOf(id)).toMatchObject({ status: "waiting", error: null, again: false });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(net.finishes).toEqual(Array(3).fill(`POST /api/edit/takes/${id}/uploaded`));
    expect(uploadOf(id)).toMatchObject({ status: "sent", error: null, again: false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(net.finishes).toHaveLength(3);
    expect(net.puts).toHaveLength(1);
  });

  it("is told every step of it only once it changes: the wait is one step, not one every ten seconds", async () => {
    const { id } = await behind([refusedBehind]);
    expect(uploadOf(id)?.status).toBe("waiting");
    const steps: string[] = [];
    const stop = subscribeUploads(() => steps.push(String(uploadOf(id)?.status)));
    await vi.advanceTimersByTimeAsync(30_000);
    stop();
    expect(steps).toEqual([]);
  });

  it("says the route's sentence with Try again after five minutes of it; Try again tells the finish and waits anew", async () => {
    const { id, net } = await behind([refusedBehind]);
    await vi.advanceTimersByTimeAsync(299_999);
    expect(uploadOf(id)?.status).toBe("waiting");
    expect(net.finishes).toHaveLength(30);
    await vi.advanceTimersByTimeAsync(1);
    // Thirty tellings again, one every ten seconds: five minutes. Then it stops, and says so in the route's words.
    expect(net.finishes).toHaveLength(31);
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: "An analysis of yours is already running; try again when it ends.", again: true, waitedOut: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(net.finishes).toHaveLength(31);
    retryUpload(id);
    await vi.advanceTimersByTimeAsync(0);
    expect(net.finishes).toHaveLength(32);
    expect(uploadOf(id)).toMatchObject({ status: "waiting", error: null, again: false, waitedOut: false });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(net.finishes).toHaveLength(33);
    expect(net.puts).toHaveLength(1);
  });

  it("tells no more once it is forgotten: its next telling is not made", async () => {
    const { id, net } = await behind([refusedBehind]);
    expect(uploadOf(id)?.status).toBe("waiting");
    forgetUpload(id);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(net.finishes).toHaveLength(1);
    expect(uploadOf(id)).toBeNull();
  });

  it("is any other failure when a telling again gets no answer: Try again, as after a first finish", async () => {
    const { id, net } = await behind([refusedBehind, wrongly]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(net.finishes).toHaveLength(2);
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: "Something went wrong.", again: true, waitedOut: false });
  });
});

const wrongly = { status: 500, body: { error: "something went wrong" } };

describe("a finish the route says was told already", () => {
  /**
   * The route's refusals of a take that is not waiting for its upload, read from the route's own file and filled as the route
   * fills them: the holder matches these words, so a route that says it another way turns this red.
   */
  function routeSays(status: string): string[] {
    const source = readFileSync(join(process.cwd(), "src/app/api/edit/upload.ts"), "utf8");
    const found = [...source.matchAll(/refuse\(409, `([^`]*waiting for its upload)`\)/g)].map((one) => one[1]!);
    return found.map((said) => said.replaceAll("${noun}", "take").replaceAll("${take.status}", status));
  }

  it("is taken as told, in both of the route's sentences (read from the route's file, so the two cannot drift apart)", async () => {
    expect(routeSays("analysing")).toEqual([
      "the take is analysing: it is not waiting for its upload", // src/app/api/edit/upload.ts:24
      "the take is no longer waiting for its upload", // src/app/api/edit/upload.ts:40: another finish moved it first
    ]);
    for (const error of [...routeSays("analysing"), ...routeSays("ready")]) {
      const { id } = await finished(409, { error });
      expect(uploadOf(id), error).toMatchObject({ status: "sent", error: null, again: false });
    }
  });

  it("is a failure for a take the route calls failed: the same sentence, another state", async () => {
    const { id } = await finished(409, { error: routeSays("failed")[0] });
    expect(uploadOf(id)).toMatchObject({ status: "failed", again: false });
  });
});

describe("an upload that is forgotten", () => {
  it("while it is sending tells nothing more: no step, no finish, no analysis started", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.onSent(4);
    forgetUpload(id);
    const heard = vi.fn();
    const stop = subscribeUploads(heard);
    net.puts[0]!.onSent(8); // the browser's request goes on
    net.puts[0]!.done();
    await settle();
    await settle();
    stop();
    expect(net.finishes).toEqual([]);
    expect(heard).not.toHaveBeenCalled();
    expect(uploadOf(id)).toBeNull();
  });

  it("whose PUT then stops says nothing of it", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    forgetUpload(id);
    const heard = vi.fn();
    const stop = subscribeUploads(heard);
    net.puts[0]!.fail();
    await settle();
    stop();
    expect(heard).not.toHaveBeenCalled();
    expect(uploadOf(id)).toBeNull();
  });

  it("while its finish is told leaves the answer aside", async () => {
    const id = takeId();
    const net = wire();
    let answer = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((answered) => (answer = () => answered(new Response(JSON.stringify({ job: { id: "j" } }), { status: 202 }))))));
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.done();
    await settle();
    expect(uploadOf(id)?.status).toBe("finishing");
    forgetUpload(id);
    const heard = vi.fn();
    const stop = subscribeUploads(heard);
    answer();
    await settle();
    await settle();
    stop();
    expect(heard).not.toHaveBeenCalled();
    expect(uploadOf(id)).toBeNull();
  });

  it("stops its PUT in flight: the browser's request is aborted, no finish is told, and no error is set", async () => {
    const id = takeId();
    const net = wire();
    const seen: (string | null | undefined)[] = [];
    const stop = subscribeUploads(() => seen.push(uploadOf(id)?.error, uploadOf(id)?.status));
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.own());
    Sending.made[0]!.upload.onprogress?.({ loaded: 4 });
    expect(Sending.made[0]!.aborted).toBe(false);
    forgetUpload(id);
    expect(Sending.made[0]!.aborted).toBe(true);
    await settle();
    await settle();
    stop();
    expect(net.finishes).toEqual([]);
    expect(uploadOf(id)).toBeNull();
    // Every step that was told: sending with no error, then nothing (the forget itself). A stopped PUT is no failure.
    expect([...new Set(seen)]).toEqual([null, "sending", undefined]);
  });

  it("stops the first PUT of a take that is started again, and not the second", async () => {
    const id = takeId();
    const net = wire();
    const own = net.own();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), own);
    startUpload({ id, uploadUrl: "https://r2.test/put-2", type: "video/quicktime" }, file(20), own);
    expect(Sending.made.map((one) => one.aborted)).toEqual([true, false]);
    await settle();
    expect(uploadOf(id)).toMatchObject({ status: "sending", total: 20, error: null });
    Sending.made[1]!.answer(200);
    await settle();
    await settle();
    expect(net.finishes).toEqual([`POST /api/edit/takes/${id}/uploaded`]);
    expect(uploadOf(id)).toMatchObject({ status: "sent", error: null });
  });

  it("stops the try that is going: each try has its own signal, and one that ended by itself is left as it ended", async () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.fail();
    await settle();
    retryUpload(id);
    expect(net.puts.map((one) => one.signal?.aborted)).toEqual([false, false]); // a second try is not born stopped
    forgetUpload(id);
    expect(net.puts.map((one) => one.signal?.aborted)).toEqual([false, true]);
  });

  it("is what a take started again does to its first upload: the first gives its copy back and tells no finish", async () => {
    const id = takeId();
    const net = wire();
    let copies = 0;
    net.deps.objectUrl = () => `blob:local/${++copies}`;
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    startUpload({ id, uploadUrl: "https://r2.test/put-2", type: "video/quicktime" }, file(20), net.deps);
    expect(net.deps.revoke).toHaveBeenCalledWith("blob:local/1");
    expect(net.deps.revoke).not.toHaveBeenCalledWith("blob:local/2");
    net.puts[0]!.onSent(10);
    net.puts[0]!.done(); // the first one's request ends: nothing of it
    await settle();
    await settle();
    expect(net.finishes).toEqual([]);
    expect(uploadOf(id)).toMatchObject({ status: "sending", sent: 0, total: 20, localUrl: "blob:local/2" });
    net.puts[1]!.done();
    await settle();
    await settle();
    expect(net.finishes).toEqual([`POST /api/edit/takes/${id}/uploaded`]);
    expect(uploadOf(id)).toMatchObject({ status: "sent", total: 20 });
  });
});

describe("the finish, told in the time its route may take", () => {
  // Task 10's fix round: a call has a deadline, half a minute unless told otherwise. The finish's route may run a minute and
  // waits up to half of one on the worker's start, so the finish is given just over the route's minute.
  /** `fetch` for the finish: each telling is answered by the next of `answers` after its `ms` (never, for none), unless the call is given up first. */
  function slowly(answers: { ms: number | null; status: number; body: unknown }[]): string[] {
    const told: string[] = [];
    vi.stubGlobal("fetch", (path: string, init?: RequestInit) => {
      told.push(`${init?.method ?? "GET"} ${String(path)}`);
      const next = answers.shift()!;
      return new Promise<Response>((answer, fail) => {
        if (next.ms !== null) setTimeout(() => answer(new Response(JSON.stringify(next.body), { status: next.status })), next.ms);
        init?.signal?.addEventListener("abort", () => fail(new DOMException("The operation was aborted.", "AbortError")));
      });
    });
    return told;
  }
  const started = { status: 202, body: { job: { id: "j" } } };
  /** A take whose bytes are all sent, its finish being told, with time stood in. */
  function finishing(answers: Parameters<typeof slowly>[0]) {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const id = takeId();
    const net = wire();
    const told = slowly(answers);
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(10), net.deps);
    net.puts[0]!.done();
    return { id, told };
  }

  it("takes a finish answered after half a minute as sent", async () => {
    const { id, told } = finishing([{ ms: 45_000, ...started }]);
    await vi.advanceTimersByTimeAsync(44_999);
    expect(uploadOf(id)).toMatchObject({ status: "finishing", error: null, again: false });
    await vi.advanceTimersByTimeAsync(1);
    expect(uploadOf(id)).toMatchObject({ status: "sent", error: null });
    expect(told).toEqual([`POST /api/edit/takes/${id}/uploaded`]);
  });

  it("offers no Try again while the finish is told, however long the worker takes to start: only once the route has said it failed", async () => {
    // The worker did not start in its half minute: the route puts the take back to waiting for its upload and answers so.
    const { id, told } = finishing([{ ms: 31_000, status: 500, body: { error: "something went wrong" } }, { ms: 0, ...started }]);
    await vi.advanceTimersByTimeAsync(30_999);
    expect(uploadOf(id)).toMatchObject({ status: "finishing", again: false });
    // Nothing to try again yet, so a second telling cannot cross the first: asking does nothing.
    retryUpload(id);
    expect(told).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: "Something went wrong.", again: true });
    retryUpload(id);
    await vi.advanceTimersByTimeAsync(0);
    expect(uploadOf(id)?.status).toBe("sent");
    expect(told).toHaveLength(2);
  });

  it("gives a finish that is never answered up just over its route's minute, to be tried again", async () => {
    const { id } = finishing([{ ms: null, ...started }]);
    await vi.advanceTimersByTimeAsync(64_999);
    expect(uploadOf(id)).toMatchObject({ status: "finishing", error: null });
    await vi.advanceTimersByTimeAsync(1);
    expect(uploadOf(id)).toMatchObject({ status: "failed", error: "The editor did not answer in time.", again: true });
  });
});

describe("a page that listens (useUpload)", () => {
  it("opened after the upload began, shows it as it goes, and nothing once it is forgotten", () => {
    const id = takeId();
    const net = wire();
    startUpload({ id, uploadUrl: "https://r2.test/put", type: "video/quicktime" }, file(4800), net.deps); // on Home, before the editor is there
    const page = renderHook(() => useUpload(id));
    expect(page.result.current).toMatchObject({ takeId: id, status: "sending", sent: 0, localUrl: "blob:local/1" });
    net.tick(2000);
    act(() => net.puts[0]!.onSent(400));
    expect(page.result.current).toMatchObject({ sent: 400, secondsLeft: 22 });
    act(() => forgetUpload(id));
    expect(page.result.current).toBeNull();
  });

  it("shows nothing for no take, or a take with no upload held (a reload, another device)", () => {
    expect(renderHook(() => useUpload(null)).result.current).toBeNull();
    expect(renderHook(() => useUpload("00000000-0000-4000-8000-999999999999")).result.current).toBeNull();
  });
});
