/** @vitest-environment happy-dom */
/**
 * use-edit.test.tsx — the editor page's calls (plan 2026-11-24-editor-screens-a, Task 10): the edit read and read again while it
 * waits, the first cut asked for by the page in the look picked meanwhile, a change and its failure, Undo, one call at a time,
 * and a video's style read in the background and used. Then what keeps the page true and never stuck: a waiting edit read on
 * with a growing wait after a read that failed, until the gate refuses or the page is left; an edit that could not be read at
 * all; no read taken that was asked before a call went out; the edit read again after a call that was refused; a first cut
 * the editor was too busy for asked again by the page, and one that failed left to Try again; another take put in place of the
 * one shown; a video's style given up. Last, every order of an upload failing, a video picked again, Try again and a cut
 * failing, each ending on the cut. The network is stood in with the routes' own answers (views of real edits), and so is the
 * PUT into R2; the reducer, the hook, the holder of uploads and the style reader are real.
 */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditView } from "@/lib/edit/edit-view";
import { MOST_HELD_ASKS } from "../edit-session";
import { Refused } from "../net";
import { forgetUpload, startUpload, uploadOf, type UploadDeps } from "../uploads";
import { useEdit } from "../use-edit";
import { ASSET, EDIT_ID, viewOf } from "./views";

/** A route's answer; or none: the call did not get through ("offline"), or got through and is never answered ("never"). */
type Answer = { status: number; body: unknown } | "offline" | "never";
interface Asked {
  call: string;
  body: unknown;
}

function network(answers: Record<string, Answer[]>, keep: Record<string, Answer> = {}): Asked[] {
  const asked: Asked[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = `${init?.method ?? "GET"} ${String(input)}`;
    asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = answers[call]?.shift() ?? keep[call];
    if (!next) throw new Error(`no answer for ${call}`);
    if (next === "offline") throw new TypeError("Failed to fetch");
    // Never answered: the call ends only when its request is aborted, as the browser's does.
    if (next === "never") return new Promise<Response>((_answer, fail) => init?.signal?.addEventListener("abort", () => fail(new DOMException("The operation was aborted.", "AbortError"))));
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  }));
  return asked;
}
const base = `/api/edit/edits/${EDIT_ID}`;
const ok = (view: EditView): Answer => ({ status: 200, body: view });
const noCut = (status = "ready") => viewOf({ take: { ...viewOf().take, status }, head: null, shown: null, edit: null, turns: [] });

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const exporting = (progress: number) => viewOf({ export: { job: "j", turn: 1, status: "running", stage: "drawing", progress, error: null, filmUrl: null, ms: null } });
const calls = (asked: Asked[], call: string) => asked.filter((one) => one.call === call);
const wrong = { status: 500, body: { error: "something went wrong" } };
const BUSY = "The editor is already working on a call of yours; try again when it is done.";
const busy = { status: 409, body: { error: BUSY } };

/**
 * Time stood in, for the tests that count waits: only the page's timers; the network answers as it does. What the page does
 * about a timer that fired (a read asked, a wait armed) happens as `pass` ends, so one `pass` crosses one wait of the page's:
 * a test that says "nothing more is read" passes a long time once, which fires any wait still armed.
 */
const fakeTime = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
const pass = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});

/** The take the edit shows, and the one picked in its place. */
const TAKE = ASSET.id;
const NEXT_TAKE = "33333333-3333-4333-8333-333333333333";
const video = () => new File([new Uint8Array(10)], "take.mp4", { type: "video/mp4" });
/** The edit while a take of its is not ready: nothing of the take is known yet. */
const taking = (id = TAKE, status = "uploading") => viewOf({ take: { ...viewOf().take, id, status, ms: null, posterUrl: null, previewUrl: null, asset: null }, head: null, shown: null, edit: null, turns: [] });

/** An upload of the edit's take in the holder, its PUT into R2 stood in: the test ends each try. */
function heldUpload() {
  const puts: { done: () => void; fail: () => void; refuse: () => void }[] = [];
  const revoke = vi.fn();
  const deps: UploadDeps = {
    objectUrl: () => "blob:local/1",
    revoke,
    put: () =>
      new Promise<void>((done, fail) => puts.push({ done, fail: () => fail(new Error("the upload did not reach R2")), refuse: () => fail(new Refused("R2 answered 403 to the upload")) })),
  };
  startUpload({ id: TAKE, uploadUrl: "https://r2.test/put", type: "video/mp4" }, video(), deps);
  return { puts, revoke };
}

/** The browser's request, stood in, for a PUT the page's own `put` makes: the test ends it as R2 would, and it sees an abort. */
class Sending {
  static made: Sending[] = [];
  /** The PUT that is going, if one is. */
  static going = () => Sending.made.findLast((one) => !one.ended);
  upload = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  aborted = false;
  ended = false;
  constructor() {
    Sending.made.push(this);
  }
  open() {}
  setRequestHeader() {}
  send() {}
  abort() {
    this.aborted = true;
    this.ended = true;
    this.onabort?.();
  }
  answer(status: number) {
    this.status = status;
    this.ended = true;
    this.onload?.();
  }
  fail() {
    this.ended = true;
    this.onerror?.();
  }
}
/** The browser's side of a take the page signs for itself (`sendTake`): its PUT and the address of the device's copy. */
const browser = () => {
  Sending.made = [];
  vi.stubGlobal("XMLHttpRequest", Sending);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local/2");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
};

afterEach(() => {
  cleanup();
  forgetUpload(TAKE);
  forgetUpload(NEXT_TAKE);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useEdit", () => {
  it("reads the edit while its take is analysed, then asks for the first cut itself, in the look picked meanwhile", async () => {
    // The second read waits until the look is picked, so the test does not race the poll.
    let ready!: () => void;
    const gate = new Promise<void>((resolve) => (ready = resolve));
    let reads = 0;
    const cuts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      if (call === `GET ${base}`) {
        reads += 1;
        if (reads > 1) await gate;
        return new Response(JSON.stringify(reads === 1 ? noCut("analysing") : noCut("ready")), { status: 200 });
      }
      if (call === `POST ${base}/cut`) {
        cuts.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify(viewOf({ look: "clean" })), { status: 200 });
      }
      throw new Error(`no answer for ${call}`);
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("getting ready"));
    act(() => result.current.setWaitLook({ kind: "preset", id: "clean" }));
    ready();
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(cuts).toEqual([{ style: { preset: "clean" } }]);
  });

  it("keeps a failed change's request, and Try again asks it again", async () => {
    const asked = network({
      [`GET ${base}`]: [ok(viewOf())],
      [`POST ${base}/change`]: [{ status: 500, body: { error: "something went wrong" } }, ok(viewOf({ head: 2 }))],
    });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      expect(await result.current.ask("Shorter")).toBe(false);
    });
    expect(result.current.session.problem).toEqual({ text: "Something went wrong.", request: "Shorter" });
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.session.view?.head).toBe(2));
    expect(asked.filter((one) => one.call === `POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Shorter" }, { request: "Shorter" }]);
  });

  it("sends the moment a request is about with it, and no moment at all for a request about none (E15)", async () => {
    const asked = network({ [`GET ${base}`]: [ok(viewOf())], [`POST ${base}/change`]: [ok(viewOf({ head: 2 })), ok(viewOf({ head: 3 })), ok(viewOf({ head: 4 }))] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    let out!: Promise<boolean>;
    act(() => {
      out = result.current.ask("Zoom in here", 186);
    });
    expect(result.current.session.working).toEqual({ what: "change", request: "Zoom in here", at: 186 });
    await act(async () => {
      expect(await out).toBe(true);
    });
    await act(async () => {
      expect(await result.current.ask("Zoom in here")).toBe(true);
    });
    await act(async () => {
      expect(await result.current.ask("Zoom in here", null)).toBe(true);
    });
    const bodies = calls(asked, `POST ${base}/change`).map((one) => one.body);
    expect(bodies).toEqual([{ request: "Zoom in here", at: 186 }, { request: "Zoom in here" }, { request: "Zoom in here" }]);
    // No `at` key at all: a request about no moment is the body it was before (no null sent).
    for (const body of bodies.slice(1)) expect(body).not.toHaveProperty("at");
  });

  it("keeps the moment of a change that failed, and Try again sends it again (E15)", async () => {
    const asked = network({ [`GET ${base}`]: [ok(viewOf())], [`POST ${base}/change`]: [wrong, ok(viewOf({ head: 2 }))] }, { [`GET ${base}`]: ok(viewOf()) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      expect(await result.current.ask("Zoom in here", 186)).toBe(false);
    });
    expect(result.current.session.problem).toEqual({ text: "Something went wrong.", request: "Zoom in here", at: 186 });
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.session.view?.head).toBe(2));
    expect(calls(asked, `POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Zoom in here", at: 186 }, { request: "Zoom in here", at: 186 }]);
  });

  it("sends one call at a time, and moves the head for Undo", async () => {
    let answerChange!: () => void;
    const held = new Promise<void>((resolve) => (answerChange = resolve));
    const asked: Asked[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (call === `POST ${base}/change`) await held;
      const view = call === `POST ${base}/head` ? viewOf({ head: 1, undo: null, redo: 2 }) : viewOf({ head: 2, undo: 1 });
      return new Response(JSON.stringify(view), { status: 200 });
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    let first!: Promise<boolean>;
    act(() => {
      first = result.current.ask("Shorter");
    });
    await act(async () => {
      expect(await result.current.ops([{ op: "captions.set", on: false }])).toBe(false);
    });
    answerChange();
    await act(async () => {
      await first;
    });
    await act(async () => {
      await result.current.move(1);
    });
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/change`, `POST ${base}/head`]);
    expect(result.current.session).toMatchObject({ moved: "move", view: { head: 1, redo: 2 } });
  });

  it("puts a finding away as a call like the others: one at a time, the view answered, a refusal said and the edit read again (slice B, Task 9)", async () => {
    const NOT_TO_CHECK = "That is not among the things to check.";
    const kept = viewOf({ turns: [{ ...viewOf().turns[0]!, kept: ["soft-zoom s1"] }] });
    const asked = network({ [`GET ${base}`]: [ok(viewOf())], [`POST ${base}/kept`]: [ok(kept), { status: 400, body: { error: NOT_TO_CHECK } }] }, { [`GET ${base}`]: ok(kept) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    let out!: Promise<boolean>;
    act(() => {
      out = result.current.keep("soft-zoom s1");
    });
    expect(result.current.session.working).toEqual({ what: "keep" });
    expect(result.current.controls).toMatchObject({ ask: false, tools: false, undo: false });
    // One call at a time: nothing else goes out while it is.
    await act(async () => {
      expect(await result.current.ask("Shorter")).toBe(false);
    });
    await act(async () => {
      expect(await out).toBe(true);
    });
    expect(result.current.session).toMatchObject({ working: null, problem: null, view: { turns: [{ kept: ["soft-zoom s1"] }] } });
    // Refused: the route's sentence, no request to put back, and the edit read again.
    await act(async () => {
      expect(await result.current.keep("on-face")).toBe(false);
    });
    expect(result.current.session.problem).toEqual({ text: NOT_TO_CHECK, request: null });
    await waitFor(() => expect(calls(asked, `GET ${base}`)).toHaveLength(2));
    expect(calls(asked, `POST ${base}/kept`).map((one) => one.body)).toEqual([{ finding: "soft-zoom s1" }, { finding: "on-face" }]);
    expect(calls(asked, `POST ${base}/change`)).toEqual([]);
  });

  it("reads a video's style in the background and cuts in it when asked", async () => {
    const STYLE = { source: { kind: "reference", name: null } };
    const REF = "77777777-7777-4777-8777-777777777777";
    const asked = network({
      [`GET ${base}`]: [ok(viewOf())],
      ["POST /api/edit/references"]: [{ status: 202, body: { id: REF } }],
      [`GET /api/edit/references/${REF}`]: [{ status: 200, body: { status: "ready", style: STYLE, judged: true } }],
      [`POST ${base}/cut`]: [ok(viewOf({ head: 2, look: "video" }))],
    });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    act(() => result.current.readVideo({ link: "https://www.tiktok.com/@someone/video/7300000000000000000" }));
    expect(result.current.reading.status).toBe("reading");
    expect(result.current.controls.ask).toBe(true);
    await waitFor(() => expect(result.current.reading.status).toBe("ready"));
    await act(async () => result.current.applyVideoStyle());
    expect(asked.find((one) => one.call === `POST ${base}/cut`)?.body).toEqual({ style: STYLE });
    expect(result.current.reading.status).toBe("idle");
  });

  it("reads a refusal as not here, or closed", async () => {
    network({ [`GET ${base}`]: [{ status: 404, body: { error: "no such edit" } }] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("not here"));
  });
});

describe("useEdit, while the edit waits", () => {
  it("keeps reading a waiting edit after a read that failed", async () => {
    const asked = network({
      [`GET ${base}`]: [ok(noCut("analysing")), wrong, ok(noCut("ready"))],
      [`POST ${base}/cut`]: [ok(viewOf())],
    });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `GET ${base}`, `GET ${base}`, `POST ${base}/cut`]);
  });

  it("waits twice as long after each read that failed, and at its pace again after one that came back", async () => {
    fakeTime();
    const asked = network({ [`GET ${base}`]: [ok(exporting(0.1)), wrong, "offline", ok(exporting(0.4)), ok(viewOf())] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    // The reads go out at 0 s, 1 s, 3 s (after one that failed), 7 s (after two), 8 s (after one that came back).
    const reads: number[] = [];
    for (const ms of [0, 999, 1, 1999, 1, 3999, 1, 999, 1]) {
      await pass(ms);
      reads.push(asked.length);
    }
    expect(reads).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    // The export is made: the edit is waited on no longer.
    expect(result.current.state).toBe("ready");
    await pass(120_000);
    expect(asked).toHaveLength(5);
  });

  it("keeps what it shows through a read that failed", async () => {
    fakeTime();
    network({ [`GET ${base}`]: [ok(exporting(0.1)), wrong] }, { [`GET ${base}`]: ok(exporting(0.2)) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    await pass(1000);
    expect(result.current).toMatchObject({ state: "exporting", session: { unread: "failed", view: { export: { progress: 0.1 } } } });
    await pass(2000);
    expect(result.current).toMatchObject({ state: "exporting", session: { unread: null, view: { export: { progress: 0.2 } } } });
  });

  it("says an edit that could not be read, reads on with a growing wait, and at once on Try again", async () => {
    fakeTime();
    const asked = network({ [`GET ${base}`]: [{ status: 503, body: { error: "the sign-in service could not be reached; try again" } }, "offline", ok(viewOf())] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current).toMatchObject({ state: "not read", session: { unread: "failed", view: null } });
    await pass(1999);
    expect(asked).toHaveLength(1);
    await pass(1);
    expect(asked).toHaveLength(2);
    expect(result.current.state).toBe("not read");
    // The next read is four seconds off; Try again reads now.
    await pass(1000);
    act(() => result.current.retry());
    await pass(0);
    expect(asked).toHaveLength(3);
    expect(result.current).toMatchObject({ state: "ready", session: { unread: null } });
  });

  it("stops reading when the gate refuses, and says the gate's sentence", async () => {
    fakeTime();
    const asked = network({ [`GET ${base}`]: [ok(noCut("analysing")), { status: 401, body: { error: "sign in to use the edit tool" } }] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current.state).toBe("getting ready");
    await pass(1000);
    expect(result.current).toMatchObject({ state: "closed", session: { unread: "closed", gate: "Sign in to use the edit tool." } });
    await pass(120_000);
    expect(asked).toHaveLength(2);
  });

  it("reads an account the editor is not open to as closed, with the gate's sentence, and reads no more", async () => {
    fakeTime();
    const asked = network({ [`GET ${base}`]: [{ status: 403, body: { error: "the edit tool is not open to this account yet" } }] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current).toMatchObject({ state: "closed", session: { gate: "The edit tool is not open to this account yet." } });
    await pass(120_000);
    expect(asked).toHaveLength(1);
  });

  it("stops reading when the page is left", async () => {
    fakeTime();
    const asked = network({}, { [`GET ${base}`]: ok(noCut("analysing")) });
    const { unmount } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    for (const ms of [0, 1000, 1000]) await pass(ms);
    expect(asked).toHaveLength(3);
    unmount();
    await pass(120_000);
    expect(asked).toHaveLength(3);
  });

  it("does not read while the upload is sending: the holder tells when it is sent, and then the edit is read", async () => {
    fakeTime();
    const upload = heldUpload();
    const asked = network({ [`GET ${base}`]: [ok(taking())] }, { [`GET ${base}`]: ok(taking(TAKE, "analysing")), [`POST /api/edit/takes/${TAKE}/uploaded`]: { status: 202, body: { job: { id: "j" } } } });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current.state).toBe("getting ready");
    await pass(60_000);
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`]);
    await act(async () => {
      upload.puts[0]!.done();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.upload?.status).toBe("sent");
    await pass(1000);
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST /api/edit/takes/${TAKE}/uploaded`, `GET ${base}`]);
    expect(result.current.session.view?.take.status).toBe("analysing");
  });

  it("does not read while the finish waits for another analysis of the creator's to end, and reads once it is taken (R31)", async () => {
    fakeTime();
    const upload = heldUpload();
    const finishOf = `POST /api/edit/takes/${TAKE}/uploaded`;
    const asked = network(
      { [`GET ${base}`]: [ok(taking())], [finishOf]: [{ status: 409, body: { error: "an analysis of yours is already running; try again when it ends" } }] },
      { [`GET ${base}`]: ok(taking(TAKE, "analysing")), [finishOf]: { status: 202, body: { job: { id: "j" } } } },
    );
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    await act(async () => {
      upload.puts[0]!.done();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toMatchObject({ state: "getting ready", upload: { status: "waiting" } });
    await pass(9_000);
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, finishOf]);
    await pass(1000);
    expect(result.current.upload?.status).toBe("sent");
    await pass(1000);
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, finishOf, finishOf, `GET ${base}`]);
    expect(result.current.session.view?.take.status).toBe("analysing");
  });

  it("reads on once every byte is sent, while the finish is told: its answer may never come, and the take is analysed all the same", async () => {
    fakeTime();
    const upload = heldUpload();
    let told = false;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      if (call === `POST /api/edit/takes/${TAKE}/uploaded`) {
        // The finish reaches the server, which starts the analysis; its answer never comes back.
        told = true;
        return new Promise<Response>(() => undefined);
      }
      if (call !== `GET ${base}`) return Promise.reject(new Error(`no answer for ${call}`));
      return Promise.resolve(new Response(JSON.stringify(taking(TAKE, told ? "analysing" : "uploading")), { status: 200 }));
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    await act(async () => {
      upload.puts[0]!.done();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toMatchObject({ state: "getting ready", upload: { status: "finishing" }, session: { view: { take: { status: "uploading" } } } });
    await pass(1000);
    expect(result.current).toMatchObject({ state: "getting ready", session: { view: { take: { status: "analysing" } } } });
  });

  it("keeps reading while the export runs after a read that was not taken and a cancel that failed", async () => {
    // The second read comes back while the cancel is out, so it is not taken; then the cancel fails, and the export still runs.
    let readBack!: () => void;
    const reading = new Promise<void>((resolve) => (readBack = resolve));
    let cancelBack!: () => void;
    const cancelling = new Promise<void>((resolve) => (cancelBack = resolve));
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      if (call === `DELETE ${base}/export`) {
        await cancelling;
        return new Response(JSON.stringify({ error: "something went wrong" }), { status: 500 });
      }
      if (call !== `GET ${base}`) throw new Error(`no answer for ${call}`);
      reads += 1;
      if (reads === 2) await reading;
      return new Response(JSON.stringify(reads < 4 ? exporting(reads / 10) : viewOf()), { status: 200 });
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(reads).toBe(2));
    let cancel!: Promise<boolean>;
    act(() => {
      cancel = result.current.cancelExport();
    });
    await act(async () => {
      readBack();
      await settle();
    });
    // No read is asked while a call is out, since none would be taken.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(reads).toBe(2);
    await act(async () => {
      cancelBack();
      expect(await cancel).toBe(false);
    });
    expect(result.current).toMatchObject({ state: "exporting", session: { problem: { text: "Something went wrong.", request: null } } });
    await waitFor(() => expect(result.current.state).toBe("ready"));
  });

  it("does not take a read that was asked before a call went out", async () => {
    // The second read is asked while the export runs and comes back after the cancel's answer: what it read is older.
    let readBack!: () => void;
    const reading = new Promise<void>((resolve) => (readBack = resolve));
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      if (call === `DELETE ${base}/export`) return new Response(JSON.stringify(viewOf()), { status: 200 });
      if (call !== `GET ${base}`) throw new Error(`no answer for ${call}`);
      reads += 1;
      if (reads === 2) await reading;
      return new Response(JSON.stringify(exporting(reads / 10)), { status: 200 });
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(reads).toBe(2));
    await act(async () => {
      expect(await result.current.cancelExport()).toBe(true);
    });
    expect(result.current.state).toBe("ready");
    await act(async () => {
      readBack();
      await settle();
    });
    expect(result.current.state).toBe("ready");
    // The edit holds still and is no longer waited on: nothing reads it again.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(reads).toBe(2);
  });
});

describe("useEdit, the first cut", () => {
  it("asks again by itself for a cut the editor was too busy for, every three seconds, and shows no problem meanwhile", async () => {
    fakeTime();
    const asked = network({ [`POST ${base}/cut`]: [busy, busy, ok(viewOf())] }, { [`GET ${base}`]: ok(noCut("ready")) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    // The page asked for the cut itself, was refused, and read the edit again at once: still no cut.
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/cut`, `GET ${base}`]);
    expect(result.current).toMatchObject({ state: "cutting", session: { problem: null, busy: 1, working: null } });
    await pass(2999);
    expect(asked).toHaveLength(3);
    // It reads first, since the call that holds the editor may be making this very cut; then asks.
    await pass(1);
    expect(asked.slice(3).map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/cut`, `GET ${base}`]);
    expect(result.current).toMatchObject({ state: "cutting", session: { problem: null, busy: 2 } });
    await pass(3000);
    expect(asked.slice(6).map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/cut`]);
    expect(result.current).toMatchObject({ state: "ready", session: { problem: null, busy: 0 } });
    await pass(120_000);
    expect(asked).toHaveLength(8);
  });

  it("does not ask again for a cut that is there: the call that held the editor made it", async () => {
    fakeTime();
    const asked = network({ [`GET ${base}`]: [ok(noCut("ready")), ok(noCut("ready")), ok(viewOf())], [`POST ${base}/cut`]: [busy] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current).toMatchObject({ state: "cutting", session: { busy: 1 } });
    await pass(3000);
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/cut`, `GET ${base}`, `GET ${base}`]);
    expect(result.current).toMatchObject({ state: "ready", session: { problem: null, busy: 0, view: { shown: 1 } } });
  });

  it("does not ask for the cut once the page is left, though it had read the edit to ask again", async () => {
    fakeTime();
    // The read before the asking again (the third read) comes back only after the page is left.
    let readBack!: () => void;
    const reading = new Promise<void>((resolve) => (readBack = resolve));
    let reads = 0;
    let cuts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      if (call === `POST ${base}/cut`) {
        cuts += 1;
        return new Response(JSON.stringify(busy.body), { status: 409 });
      }
      if (call !== `GET ${base}`) throw new Error(`no answer for ${call}`);
      reads += 1;
      if (reads === 3) await reading;
      return new Response(JSON.stringify(noCut("ready")), { status: 200 });
    }));
    const { result, unmount } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current.session.busy).toBe(1);
    await pass(3000);
    expect([reads, cuts]).toEqual([3, 1]);
    unmount();
    readBack();
    await vi.advanceTimersByTimeAsync(0);
    expect(cuts).toBe(1);
  });

  it("gives up asking after the most times and says the editor's sentence; Try again starts over", async () => {
    fakeTime();
    const asked = network({}, { [`GET ${base}`]: ok(noCut("ready")), [`POST ${base}/cut`]: busy });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    for (let n = 0; n <= MOST_HELD_ASKS; n++) await pass(3000);
    expect(calls(asked, `POST ${base}/cut`)).toHaveLength(1 + MOST_HELD_ASKS);
    expect(result.current).toMatchObject({ state: "cutting", session: { problem: { text: BUSY, request: null }, busy: 0 } });
    const then = asked.length;
    await pass(120_000);
    expect(asked).toHaveLength(then);
    act(() => result.current.retry());
    await pass(0);
    expect(calls(asked, `POST ${base}/cut`)).toHaveLength(2 + MOST_HELD_ASKS);
    expect(result.current.session).toMatchObject({ problem: null, busy: 1 });
  });

  it("leaves a cut that failed another way to Try again, which asks in the look picked; it is not read on meanwhile", async () => {
    fakeTime();
    const asked = network({ [`POST ${base}/cut`]: [wrong, ok(viewOf({ look: "clean" }))] }, { [`GET ${base}`]: ok(noCut("ready")) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current).toMatchObject({ state: "cutting", session: { problem: { text: "Something went wrong.", request: null }, busy: 0 } });
    await pass(120_000);
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/cut`, `GET ${base}`]);
    act(() => result.current.setWaitLook({ kind: "preset", id: "clean" }));
    act(() => result.current.retry());
    await pass(0);
    expect(result.current.state).toBe("ready");
    expect(calls(asked, `POST ${base}/cut`).map((one) => one.body)).toEqual([{}, { style: { preset: "clean" } }]);
  });

  it("asks for the cut again when its problem is put away", async () => {
    fakeTime();
    const asked = network({ [`POST ${base}/cut`]: [wrong, ok(viewOf())] }, { [`GET ${base}`]: ok(noCut("ready")) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current.session.problem).not.toBeNull();
    act(() => result.current.dismiss());
    await pass(0);
    expect(result.current.state).toBe("ready");
    expect(calls(asked, `POST ${base}/cut`)).toHaveLength(2);
  });

  it("takes a cut answered with an edit that has no cut as a failed call, so it is not asked for without end", async () => {
    fakeTime();
    const asked = network({}, { [`GET ${base}`]: ok(noCut("ready")), [`POST ${base}/cut`]: ok(noCut("ready")) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    await pass(120_000);
    expect(calls(asked, `POST ${base}/cut`)).toHaveLength(1);
    expect(result.current).toMatchObject({ state: "cutting", session: { problem: { text: "Something went wrong.", request: null } } });
  });

  it("takes a cut answered with an edit that still owes its first cut by its head as a failed call too", async () => {
    fakeTime();
    // The page wants a first cut while the head is none: an answer that leaves it none would be asked for again without end.
    const asked = network({}, { [`GET ${base}`]: ok(noCut("ready")), [`POST ${base}/cut`]: ok(viewOf({ head: null })) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    await pass(120_000);
    expect(calls(asked, `POST ${base}/cut`)).toHaveLength(1);
    expect(result.current).toMatchObject({ state: "cutting", session: { problem: { text: "Something went wrong.", request: null } } });
  }, 3000);
});

describe("useEdit, after a call that was refused", () => {
  it("reads the edit again and shows what is there, and keeps the request", async () => {
    const changedSince = "The edit changed while this was being made. Try again.";
    const asked = network({
      [`GET ${base}`]: [ok(viewOf()), ok(viewOf({ head: 2, shown: 2, undo: 1 }))],
      [`POST ${base}/change`]: [{ status: 409, body: { error: changedSince } }],
    });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      expect(await result.current.ask("Shorter")).toBe(false);
    });
    await waitFor(() => expect(result.current.session.view?.head).toBe(2));
    expect(result.current.session.problem).toEqual({ text: changedSince, request: "Shorter" });
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/change`, `GET ${base}`]);
  });

  it("does not put the request back when the read after it shows the change was made", async () => {
    const made = viewOf({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, { n: 2, kind: "change", request: "Shorter", at: null, say: "Done.", doc: true, findings: [], kept: [] }] });
    network({ [`GET ${base}`]: [ok(viewOf()), ok(made)], [`POST ${base}/change`]: ["offline"] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      expect(await result.current.ask("Shorter")).toBe(false);
    });
    await waitFor(() => expect(result.current.session.view?.head).toBe(2));
    expect(result.current.session).toMatchObject({ problem: null, moved: "turn" });
  });

  it("takes an answer that is ok and is no edit as a failed call, and a read of that kind as no read", async () => {
    network({ [`GET ${base}`]: [ok(viewOf({ undo: 1 }))], [`POST ${base}/head`]: [{ status: 200, body: {} }] }, { [`GET ${base}`]: { status: 200, body: {} } });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => {
      expect(await result.current.move(1)).toBe(false);
    });
    expect(result.current.session).toMatchObject({ problem: { text: "Something went wrong.", request: null }, working: null, view: { head: 1 } });
    await waitFor(() => expect(result.current.session.unread).toBe("failed"));
    expect(result.current).toMatchObject({ state: "ready", session: { view: { head: 1 } } });
  });

  it("gives the controls back when what makes a call throws, and says it went wrong", async () => {
    browser();
    const thrown = new Error("the device gave no address for the file");
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw thrown;
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    network({ [`POST ${base}/change`]: [ok(viewOf({ head: 2 }))] }, {
      [`GET ${base}`]: ok(viewOf()),
      ["POST /api/edit/takes"]: { status: 201, body: { take: { id: NEXT_TAKE }, uploadUrl: "https://r2.test/put" } },
    });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await act(async () => result.current.replaceTake(video()));
    expect(result.current).toMatchObject({ controls: { ask: true }, session: { working: null, problem: { text: "Something went wrong.", request: null } } });
    expect(logged).toHaveBeenCalledWith(expect.any(String), thrown);
    await act(async () => {
      expect(await result.current.ask("Shorter")).toBe(true);
    });
  });
});

describe("useEdit, a call that is never answered", () => {
  const LATE = "The editor did not answer in time.";

  it("gives a cut just over the three minutes its route may take, then says it was not answered and gives the page back", async () => {
    fakeTime();
    const asked = network({ [`POST ${base}/cut`]: ["never"] }, { [`GET ${base}`]: ok(noCut("ready")) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    expect(result.current.session.working).toEqual({ what: "cut", look: { kind: "house" } });
    await pass(180_000);
    expect(result.current.session.working).toEqual({ what: "cut", look: { kind: "house" } });
    await pass(5000);
    expect(result.current).toMatchObject({ state: "cutting", session: { working: null, problem: { text: LATE, request: null }, busy: 0 } });
    // The edit is read again, as after any call that failed; the cut waits for Try again.
    expect(asked.map((one) => one.call)).toEqual([`GET ${base}`, `POST ${base}/cut`, `GET ${base}`]);
  });

  it("gives a change just over the minute its route may take, and puts its request back", async () => {
    fakeTime();
    network({ [`POST ${base}/change`]: ["never"] }, { [`GET ${base}`]: ok(viewOf()) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    act(() => void result.current.ask("Shorter"));
    await pass(60_000);
    expect(result.current).toMatchObject({ controls: { ask: false }, session: { working: { what: "change", request: "Shorter" } } });
    await pass(5000);
    expect(result.current).toMatchObject({ controls: { ask: true }, session: { working: null, problem: { text: LATE, request: "Shorter" } } });
  });

  it("gives an export, and giving it up, just over the minute their route may take", async () => {
    fakeTime();
    network({ [`POST ${base}/export`]: ["never"], [`DELETE ${base}/export`]: ["never"] }, { [`GET ${base}`]: ok(viewOf()) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    for (const [what, asks] of [["export", () => result.current.startExport()], ["cancel", () => result.current.cancelExport()]] as const) {
      act(() => void asks());
      await pass(60_000);
      expect(result.current.session.working).toEqual({ what });
      await pass(5000);
      expect(result.current.session).toMatchObject({ working: null, problem: { text: LATE, request: null } });
    }
  });

  it("gives every other call half a minute: Undo, a word by hand, and a finding put away", async () => {
    fakeTime();
    network({ [`POST ${base}/head`]: ["never"], [`POST ${base}/ops`]: ["never"], [`POST ${base}/kept`]: ["never"] }, { [`GET ${base}`]: ok(viewOf({ undo: 1 })) });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    for (const asks of [() => result.current.move(1), () => result.current.ops([{ op: "captions.set", on: false }]), () => result.current.keep("soft-zoom s1")]) {
      act(() => void asks());
      await pass(29_999);
      expect(result.current.session.working).not.toBeNull();
      await pass(1);
      expect(result.current.session).toMatchObject({ working: null, problem: { text: LATE, request: null } });
    }
  });

  it("says an edit could not be read when its first read is never answered, and reads on", async () => {
    fakeTime();
    const asked = network({ [`GET ${base}`]: ["never", ok(viewOf())] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(29_999);
    expect(result.current.state).toBe("loading");
    await pass(1);
    expect(result.current).toMatchObject({ state: "not read", session: { unread: "failed" } });
    await pass(2000);
    expect(asked).toHaveLength(2);
    expect(result.current.state).toBe("ready");
  });
});

describe("useEdit, the take", () => {
  /** The routes of a take picked again: signed for as `NEXT_TAKE`, then put to the edit, which takes it, or answers `put`. */
  const picking = (put?: Exclude<Answer, "never"> | "offline but taken"): Asked[] => {
    const asked: Asked[] = [];
    let take = TAKE;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const answer = (one: { status: number; body: unknown }) => new Response(JSON.stringify(one.body), { status: one.status });
      if (call === "POST /api/edit/takes") return answer({ status: 201, body: { take: { id: NEXT_TAKE }, uploadUrl: "https://r2.test/put" } });
      if (call === `POST ${base}/take`) {
        if (put === "offline") throw new TypeError("Failed to fetch");
        if (put !== undefined && put !== "offline but taken") return answer(put);
        take = NEXT_TAKE;
        if (put === "offline but taken") throw new TypeError("Failed to fetch");
      } else if (call !== `GET ${base}`) throw new Error(`no answer for ${call}`);
      return answer({ status: 200, body: taking(take) });
    }));
    return asked;
  };
  /** The page on an edit whose take's upload has stopped. */
  const stopped = async (how: "fail" | "refuse" = "fail") => {
    const upload = heldUpload();
    const page = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(page.result.current.state).toBe("getting ready"));
    await act(async () => {
      upload.puts[0]![how]();
      await settle();
    });
    expect(page.result.current.state).toBe("upload stopped");
    return { upload, result: page.result };
  };

  it("says an upload that stopped, and Try again sends it again", async () => {
    network({}, { [`GET ${base}`]: ok(taking()) });
    const { upload, result } = await stopped();
    expect(result.current.upload).toMatchObject({ status: "failed", again: true });
    act(() => result.current.retry());
    expect(upload.puts).toHaveLength(2);
    expect(result.current).toMatchObject({ state: "getting ready", upload: { status: "sending" } });
  });

  it("puts an earlier problem away when the upload is tried again", async () => {
    browser();
    picking({ status: 400, body: { error: "a take is an MP4 or QuickTime video" } });
    const { result } = await stopped();
    await act(async () => result.current.replaceTake(video()));
    expect(result.current.session.problem).toEqual({ text: "A take is an MP4 or QuickTime video.", request: null });
    act(() => result.current.retry());
    expect(result.current).toMatchObject({ state: "getting ready", session: { problem: null } });
  });

  it("does not send again an upload that trying again cannot help; the video is picked again", async () => {
    browser();
    picking();
    const { upload, result } = await stopped("refuse");
    expect(result.current.upload).toMatchObject({ status: "failed", again: false });
    act(() => result.current.retry());
    expect(upload.puts).toHaveLength(1);
    expect(result.current.state).toBe("upload stopped");
    await act(async () => result.current.replaceTake(video()));
    expect(result.current).toMatchObject({ state: "getting ready", upload: { takeId: NEXT_TAKE, status: "sending" } });
  });

  it("puts another take in place of the one shown, and the holder forgets the one replaced", async () => {
    browser();
    const asked = picking();
    const { upload, result } = await stopped();
    await act(async () => result.current.replaceTake(video()));
    expect(asked.find((one) => one.call === `POST ${base}/take`)?.body).toEqual({ take: NEXT_TAKE });
    expect(result.current).toMatchObject({ state: "getting ready", upload: { takeId: NEXT_TAKE, status: "sending" }, session: { view: { take: { id: NEXT_TAKE } }, problem: null } });
    expect(uploadOf(TAKE)).toBeNull();
    expect(upload.revoke).toHaveBeenCalledWith("blob:local/1");
    expect(Sending.made.map((one) => one.aborted)).toEqual([false]);
  });

  it("gives up a take the edit did not take: its upload is stopped, and the take shown stays", async () => {
    browser();
    const hasCut = "This edit already has a cut; start a new edit for another video.";
    picking({ status: 409, body: { error: hasCut } });
    const { upload, result } = await stopped();
    await act(async () => result.current.replaceTake(video()));
    expect(result.current).toMatchObject({ state: "upload stopped", upload: { takeId: TAKE, status: "failed" }, session: { problem: { text: hasCut, request: null } } });
    expect(uploadOf(NEXT_TAKE)).toBeNull();
    expect(Sending.made.map((one) => one.aborted)).toEqual([true]);
    expect(upload.revoke).not.toHaveBeenCalled();
  });

  it("stands on the upload stopped, with Try again, when the finish fails after the worker's half minute: never on getting ready with nothing to tap", async () => {
    fakeTime();
    const upload = heldUpload();
    // The route as it is with a worker that does not start: the first telling is answered after 31 s, failed, the take put
    // back to waiting for its upload. The second starts the analysis.
    const server = { status: "uploading", told: 0 };
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      if (call === `GET ${base}`) return Promise.resolve(new Response(JSON.stringify(taking(TAKE, server.status)), { status: 200 }));
      if (call !== `POST /api/edit/takes/${TAKE}/uploaded`) return Promise.reject(new Error(`no answer for ${call}`));
      server.told += 1;
      if (server.told > 1) {
        server.status = "analysing";
        return Promise.resolve(new Response(JSON.stringify({ job: { id: "j" } }), { status: 202 }));
      }
      return new Promise<Response>((answer, fail) => {
        setTimeout(() => answer(new Response(JSON.stringify({ error: "something went wrong" }), { status: 500 })), 31_000);
        init?.signal?.addEventListener("abort", () => fail(new DOMException("The operation was aborted.", "AbortError")));
      });
    }));
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    await act(async () => {
      upload.puts[0]!.done();
      await vi.advanceTimersByTimeAsync(0);
    });
    // For the worker's half minute and past it the finish is being told: nothing is offered to try again meanwhile.
    for (let second = 1; second <= 30; second++) await pass(1000);
    await pass(500);
    expect(result.current).toMatchObject({ state: "getting ready", upload: { status: "finishing", again: false } });
    await pass(500);
    expect(result.current).toMatchObject({ state: "upload stopped", upload: { status: "failed", again: true, error: "Something went wrong." } });
    // Try again tells the finish once more, and the take is analysed.
    act(() => result.current.retry());
    await pass(0);
    expect(result.current.upload?.status).toBe("sent");
    await pass(1000);
    expect(result.current).toMatchObject({ state: "getting ready", session: { view: { take: { status: "analysing" } } } });
    expect(server.told).toBe(2);
  });

  describe("sent by the holder's word, and still read as uploading", () => {
    // How it comes about: the connection drops while the finish is told, Try again is tapped while that first telling still
    // waits on the worker, and is answered "the take is analysing", which the holder reads as told; then the first telling
    // fails and the route puts the take back to waiting for its upload. Stood in here from the second telling on.
    const NOT_WAITING = { status: 409, body: { error: "the take is analysing: it is not waiting for its upload" } };
    /** The routes: the edit as the server has it, and each telling of the finish answered by `tellings` in turn (the last, for any more). */
    function server(tellings: ((at: { status: string }) => { status: number; body: unknown })[], reads: { fail: boolean } = { fail: false }) {
      const at = { status: "uploading", told: 0, read: 0 };
      vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = `${init?.method ?? "GET"} ${String(input)}`;
        const answer = (one: { status: number; body: unknown }) => new Response(JSON.stringify(one.body), { status: one.status });
        if (call === `GET ${base}`) {
          at.read += 1;
          return reads.fail ? answer(wrong) : answer({ status: 200, body: taking(TAKE, at.status) });
        }
        if (call !== `POST /api/edit/takes/${TAKE}/uploaded`) throw new Error(`no answer for ${call}`);
        at.told += 1;
        return answer(tellings[Math.min(at.told, tellings.length) - 1]!(at));
      }));
      return at;
    }
    /** The page on the edit, its take's bytes sent and the finish told once, taken by the holder as told. */
    async function sent(at: ReturnType<typeof server>) {
      const upload = heldUpload();
      const page = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
      await pass(0);
      await act(async () => {
        upload.puts[0]!.done();
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(page.result.current).toMatchObject({ state: "getting ready", upload: { status: "sent" }, session: { view: { take: { status: "uploading" } } } });
      expect(at.told).toBe(1);
      return { upload, result: page.result };
    }
    const seconds = async (n: number) => {
      for (let second = 0; second < n; second++) await pass(1000);
    };
    const starts = (at: { status: string }) => {
      at.status = "analysing";
      return { status: 202, body: { job: { id: "j" } } };
    };

    it("tells the finish once more after 65 s, and the take is analysed", async () => {
      fakeTime();
      const at = server([() => NOT_WAITING, starts]);
      const { result } = await sent(at);
      await seconds(64);
      expect(at.told).toBe(1);
      expect(result.current.state).toBe("getting ready");
      await seconds(1);
      expect(at.told).toBe(2);
      await seconds(1);
      expect(result.current).toMatchObject({ state: "getting ready", upload: { status: "sent" }, session: { view: { take: { status: "analysing" } } } });
      // And that is the end of it: nothing more is told, and the upload is kept.
      await seconds(140);
      expect(at.told).toBe(2);
      expect(uploadOf(TAKE)).not.toBeNull();
    });

    it("shows the upload stopped, with the video to pick again, when the take still reads uploading 65 s after that", async () => {
      fakeTime();
      // The page's own telling fails too: the worker does not start.
      const at = server([() => NOT_WAITING, () => wrong]);
      const { upload, result } = await sent(at);
      await seconds(65);
      expect(at.told).toBe(2);
      await seconds(64);
      expect(result.current).toMatchObject({ state: "getting ready", upload: { status: "sent" } });
      await seconds(1);
      // The holder lets the upload go: the page says the upload stopped, and offers only to pick the video again.
      expect(result.current).toMatchObject({ state: "upload stopped", upload: null });
      expect(uploadOf(TAKE)).toBeNull();
      expect(upload.revoke).toHaveBeenCalledWith("blob:local/1");
      // Nothing more is told or read.
      const then = { told: at.told, read: at.read };
      await seconds(140);
      expect({ told: at.told, read: at.read }).toEqual(then);
      expect(at.told).toBe(2);
    });

    it("counts only while the edit is read: reads that fail tell nothing of the take, so nothing is told again and nothing given up", async () => {
      fakeTime();
      const reads = { fail: false };
      const at = server([() => NOT_WAITING, starts], reads);
      const { result } = await sent(at);
      await seconds(30);
      reads.fail = true;
      // Over two of the page's waits with no read that got through.
      for (let step = 0; step < 20; step++) await pass(30_000);
      expect(at.told).toBe(1);
      expect(result.current).toMatchObject({ state: "getting ready", upload: { status: "sent" }, session: { unread: "failed" } });
      // Read again, the take still uploading: the 65 s count from here.
      reads.fail = false;
      await pass(30_000);
      expect(result.current.session.unread).toBeNull();
      await seconds(64);
      expect(at.told).toBe(1);
      await seconds(1);
      expect(at.told).toBe(2);
    });
  });

  it("keeps a take the edit took though its answer was lost: the edit says which take it has", async () => {
    browser();
    const asked = picking("offline but taken");
    const { result } = await stopped();
    await act(async () => result.current.replaceTake(video()));
    expect(asked.slice(-3).map((one) => one.call)).toEqual(["POST /api/edit/takes", `POST ${base}/take`, `GET ${base}`]);
    expect(result.current).toMatchObject({ state: "getting ready", upload: { takeId: NEXT_TAKE, status: "sending" }, session: { view: { take: { id: NEXT_TAKE } }, problem: null } });
    expect(uploadOf(TAKE)).toBeNull();
    expect(Sending.made.map((one) => one.aborted)).toEqual([false]);
  });

  it("gives up a take whose put got no answer when the edit still has the one before", async () => {
    browser();
    picking("offline");
    const { result } = await stopped();
    await act(async () => result.current.replaceTake(video()));
    expect(result.current).toMatchObject({ state: "upload stopped", upload: { takeId: TAKE }, session: { problem: { text: "The editor could not be reached. Check your connection.", request: null } } });
    expect(uploadOf(NEXT_TAKE)).toBeNull();
    expect(Sending.made.map((one) => one.aborted)).toEqual([true]);
  });
});

describe("useEdit, a video's style", () => {
  const REF = "77777777-7777-4777-8777-777777777777";
  const LINK = "https://www.tiktok.com/@someone/video/7300000000000000000";
  /** A reference that is never read to its end. */
  const neverRead = () => network({ ["POST /api/edit/references"]: [{ status: 202, body: { id: REF } }] }, {
    [`GET ${base}`]: ok(viewOf()),
    [`GET /api/edit/references/${REF}`]: { status: 200, body: { status: "analysing", stage: "reading its cuts", progress: 0.3 } },
    [`DELETE /api/edit/references/${REF}`]: { status: 200, body: {} },
  });

  it("stops reading one when the creator closes it, and has the reference dropped", async () => {
    fakeTime();
    const asked = neverRead();
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    await pass(0);
    act(() => result.current.readVideo({ link: LINK }));
    await pass(4000);
    expect(result.current.reading).toMatchObject({ status: "reading", line: "Reading its cuts…" });
    act(() => result.current.stopReading());
    expect(result.current.reading).toEqual({ status: "idle", line: null, share: null, problem: null, style: null });
    await pass(0);
    expect(calls(asked, `DELETE /api/edit/references/${REF}`)).toHaveLength(1);
    const then = asked.length;
    await pass(120_000);
    expect(asked).toHaveLength(then);
    expect(result.current.reading.status).toBe("idle");
  });

  it("gives one up that is not read in time, says so, and has the reference dropped", async () => {
    fakeTime();
    const asked = neverRead();
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000, styleMs: 60_000 }));
    await pass(0);
    act(() => result.current.readVideo({ link: LINK }));
    await pass(59_999);
    expect(result.current.reading.status).toBe("reading");
    await pass(1);
    expect(result.current.reading).toEqual({ status: "failed", line: null, share: null, problem: "The video's style could not be read. Try it again, or another video.", style: null });
    expect(calls(asked, `DELETE /api/edit/references/${REF}`)).toHaveLength(1);
    const then = asked.length;
    await pass(120_000);
    expect(asked).toHaveLength(then);
    // Closed, it is put away.
    act(() => result.current.stopReading());
    expect(result.current.reading.status).toBe("idle");
  });
});

describe("useEdit, what it hands the screens", () => {
  it("keeps the same functions from one render to the next where nothing they read has changed", async () => {
    network({}, { [`GET ${base}`]: ok(viewOf()) });
    const { result, rerender } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    const was = result.current;
    rerender();
    for (const name of ["setWaitLook", "dismiss", "cut", "ask", "ops", "move", "startExport", "cancelExport", "replaceTake", "retry", "read", "readVideo", "stopReading", "applyVideoStyle"] as const) {
      expect(result.current[name], name).toBe(was[name]);
    }
  });

  it("reads the edit again when the page asks, though nothing waits: its addresses come fresh", async () => {
    const fresh = viewOf({ take: { ...viewOf().take, previewUrl: "https://media.test/preview.mp4?signed=again" } });
    const asked = network({ [`GET ${base}`]: [ok(viewOf()), ok(fresh)] });
    const { result } = renderHook(() => useEdit(EDIT_ID, { pollMs: 5 }));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    // An edit with its cut waits on nothing, and is not read on by itself.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(calls(asked, `GET ${base}`)).toHaveLength(1);
    act(() => result.current.read());
    await waitFor(() => expect(result.current.session.view?.take.previewUrl).toBe("https://media.test/preview.mp4?signed=again"));
    expect(calls(asked, `GET ${base}`)).toHaveLength(2);
    expect(result.current.state).toBe("ready");
  });
});

describe("useEdit, from a take to its first cut", () => {
  const takeNo = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  /** Long enough for a read or two of a waiting edit (one a second here), and for one asking again for a busy cut (three). */
  const SETTLE_MS = 3500;

  /** The edit's routes, R2 and the take's analysis, as one small world a test steers. */
  function world() {
    const w = {
      take: { id: TAKE, status: "uploading" },
      takes: [TAKE],
      cut: false,
      /** What the next cuts answer before one is made: 500, or 409 (the editor is busy). */
      cuts: [] as number[],
      /** The next take signed for is refused. */
      refuse: false,
      /** The take a cut failed for with a sentence to show (a 500): only that leaves its cut to a tap. */
      failedFor: null as string | null,
    };
    const view = () => {
      const take = { ...viewOf().take, id: w.take.id, status: w.take.status };
      return w.cut ? viewOf({ take }) : viewOf({ take, head: null, shown: null, edit: null, turns: [] });
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = `${init?.method ?? "GET"} ${String(input)}`;
      const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
      if (call === `GET ${base}`) return answer(200, view());
      if (call === `POST ${base}/cut`) {
        const status = w.cuts.shift();
        if (status === 409) return answer(409, { error: BUSY });
        if (status !== undefined) {
          w.failedFor = w.take.id;
          return answer(status, { error: "something went wrong" });
        }
        w.cut = true;
        return answer(200, view());
      }
      if (call === "POST /api/edit/takes") {
        if (w.refuse) {
          w.refuse = false;
          return answer(500, { error: "something went wrong" });
        }
        w.takes.push(takeNo(w.takes.length));
        return answer(201, { take: { id: w.takes.at(-1) }, uploadUrl: "https://r2.test/put" });
      }
      if (call === `POST ${base}/take`) {
        if (w.cut) return answer(409, { error: "This edit already has a cut; start a new edit for another video." });
        w.take = { id: (JSON.parse(String(init?.body)) as { take: string }).take, status: "uploading" };
        return answer(200, view());
      }
      const told = /^POST \/api\/edit\/takes\/([^/]+)\/uploaded$/.exec(call);
      if (!told) throw new Error(`no answer for ${call}`);
      if (told[1] === w.take.id && w.take.status === "uploading") w.take.status = "analysing";
      return answer(202, { job: { id: "j" } });
    }));
    return w;
  }
  type World = ReturnType<typeof world>;
  type Page = ReturnType<typeof useEdit>;

  const idle = (page: Page) => page.session.working === null && page.session.view !== null;
  /** The take gets on: its PUT ends and its finish is told, then it is analysed. */
  const getsOn = async (w: World) => {
    Sending.going()?.answer(200);
    for (let n = 0; n < 5 && w.take.status === "uploading"; n++) await vi.advanceTimersByTimeAsync(0);
    if (w.take.status === "analysing") w.take.status = "ready";
  };
  /** What can happen, and when it can. */
  const STEPS: Record<string, { can(w: World, page: Page): boolean; does(w: World, page: Page): void | Promise<void> }> = {
    "the upload fails": { can: () => Sending.going() !== undefined, does: () => Sending.going()!.fail() },
    "the take gets ready": { can: (w) => Sending.going() !== undefined || w.take.status === "analysing", does: getsOn },
    "the next cut fails": { can: (w) => !w.cut && w.cuts.length === 0, does: (w) => void w.cuts.push(500) },
    "the editor is busy for the next two cuts": { can: (w) => !w.cut && w.cuts.length === 0, does: (w) => void w.cuts.push(409, 409) },
    "another video is picked": { can: (w, page) => !w.cut && idle(page), does: (_w, page) => void page.replaceTake(video()) },
    "another video is picked, and refused": {
      can: (w, page) => !w.cut && idle(page),
      does: (w, page) => {
        w.refuse = true;
        void page.replaceTake(video());
      },
    },
    "Try again": { can: (_w, page) => idle(page) && (page.session.problem !== null || (page.state === "upload stopped" && page.upload?.again === true)), does: (_w, page) => page.retry() },
    "the problem is put away": { can: (_w, page) => page.session.problem !== null, does: (_w, page) => page.dismiss() },
  };

  /** "Making the first cut" with no call out, none to come, and nothing to tap. */
  const stuck = (page: Page) => page.state === "cutting" && page.session.working === null && page.session.problem === null && page.session.busy === 0;

  /**
   * One order of events from an edit whose take is uploading, then the world mends and the creator taps only what the page
   * offers. Gives what was wrong with it, if anything, and what could have happened next.
   */
  async function run(steps: readonly string[]): Promise<{ wrong: string | null; next: string[] }> {
    Sending.made = [];
    const w = world();
    startUpload({ id: TAKE, uploadUrl: "https://r2.test/put", type: "video/mp4" }, video(), { objectUrl: () => "blob:local/1", revoke: () => undefined });
    const { result, unmount } = renderHook(() => useEdit(EDIT_ID, { pollMs: 1000 }));
    const then = async (does: () => void | Promise<void>) => act(async () => {
      await does();
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    let wrong: string | null = null;
    await then(() => undefined);
    for (const step of steps) {
      await then(() => STEPS[step]!.does(w, result.current));
      if (stuck(result.current)) wrong ??= `stuck after "${step}"`;
    }
    const next = Object.keys(STEPS).filter((step) => STEPS[step]!.can(w, result.current));

    w.cuts = [];
    w.refuse = false;
    for (let round = 0; round < 8 && result.current.state !== "ready"; round++) {
      const page = result.current;
      await then(async () => {
        if (page.state === "upload stopped") {
          if (page.upload?.again) page.retry();
          else void page.replaceTake(video());
        } else if (page.state === "cutting" && page.session.problem !== null && page.session.busy === 0 && idle(page)) {
          // A ready take is cut with no tap, unless its cut failed with a sentence shown: then Try again is the tap. (A
          // problem shown while the page asks again by itself, `busy` over 0, holds nothing back: no tap is made for it.)
          if (w.failedFor !== w.take.id) wrong ??= `waits for a tap to cut a take no cut failed for, saying "${page.session.problem.text}"`;
          page.retry();
        }
        await vi.advanceTimersByTimeAsync(0);
        await getsOn(w);
      });
      if (stuck(result.current)) wrong ??= "stuck once the world mended";
    }
    if (result.current.state !== "ready") wrong ??= `ended on "${result.current.state}"`;
    unmount();
    for (const id of w.takes) forgetUpload(id);
    return { wrong, next };
  }

  it.each([
    ["a video picked again fails, then the upload is tried again (the old sentence must not hold the cut back)", ["the upload fails", "another video is picked, and refused", "Try again"]],
    ["the cut fails, then another video is picked (the first cut is asked for a take, not once a page)", ["the next cut fails", "the take gets ready", "another video is picked"]],
    ["the cut fails and its problem is put away", ["the next cut fails", "the take gets ready", "the problem is put away"]],
    ["the editor is busy, and a video picked meanwhile is refused", ["the editor is busy for the next two cuts", "the take gets ready", "another video is picked, and refused"]],
  ])("gets to the cut when %s", async (_name, steps) => {
    fakeTime();
    browser();
    expect((await run(steps)).wrong).toBeNull();
  });

  it("gets to the cut after every order of an upload failing, a video picked again, Try again and a cut failing, five deep", async () => {
    fakeTime();
    browser();
    const wrong: string[] = [];
    let orders = 0;
    const explore = async (steps: readonly string[]): Promise<void> => {
      const ran = await run(steps);
      orders += 1;
      if (ran.wrong !== null) wrong.push(`${steps.join(" → ") || "(nothing happens)"}: ${ran.wrong}`);
      if (steps.length < 5) for (const step of ran.next) await explore([...steps, step]);
    };
    await explore([]);
    expect(wrong).toEqual([]);
    expect(orders).toBeGreaterThan(1000);
  }, 120_000);
});
