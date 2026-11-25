/** @vitest-environment happy-dom */
/**
 * The running screen listens to the run's own stream. The browser's EventSource is the boundary
 * that is stood in for (a small working one that hands out named events and can fail a connect
 * the way a browser reports it: `readyState` CLOSED, then an `error` event); the hook and the
 * reading of the events are real. The clock is stood in for where the hook waits to reopen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { NO_PROGRESS } from "@/lib/result/run-progress";
import { useRunStream } from "../use-run-stream";

type Listener = (event: MessageEvent) => void;

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly CLOSED = 2;
  static opened: FakeEventSource[] = [];
  readyState = 1;
  private listeners = new Map<string, Set<Listener>>();
  constructor(public url: string) {
    FakeEventSource.opened.push(this);
  }
  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  /**
   * The connect failed (any answer but 200, e.g. a passing 401 or a 502): the browser gives up on
   * this source for good, CLOSED, and fires `error`.
   */
  failConnect() {
    this.readyState = FakeEventSource.CLOSED;
    for (const listener of this.listeners.get("error") ?? []) listener({} as MessageEvent);
  }
  /** A dropped connection the browser retries by itself: CONNECTING, then `error`. */
  dropAndRetry() {
    this.readyState = FakeEventSource.CONNECTING;
    for (const listener of this.listeners.get("error") ?? []) listener({} as MessageEvent);
  }
  /** The server sends one named event; `raw` sends the text as it is. */
  send(type: string, data?: unknown, { raw = false }: { raw?: boolean } = {}) {
    const text = raw ? (data as string) : JSON.stringify(data ?? {});
    for (const listener of this.listeners.get(type) ?? []) listener({ data: text } as MessageEvent);
  }
}

const stream = () => FakeEventSource.opened.at(-1)!;
const roster = { personas: Array.from({ length: 10 }, (_, i) => ({ archetype: `group-${i}`, label: `Group ${i}` })) };

beforeEach(() => {
  FakeEventSource.opened = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useRunStream", () => {
  it("opens the stream of this run and starts knowing nothing", () => {
    const { result } = renderHook(() => useRunStream("run-1", () => {}));

    expect(stream().url).toBe("/api/analyze/run-1/stream");
    expect(result.current).toEqual(NO_PROGRESS);
  });

  it("learns the groups and the frames as the stream sends them", () => {
    const { result } = renderHook(() => useRunStream("run-1", () => {}));

    act(() => stream().send("roster", roster));
    expect(result.current.groups).toHaveLength(10);

    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 1, keyframe_uri: "https://f/1.jpg" }));
    expect(result.current.frames).toEqual([null, "https://f/1.jpg"]);
  });

  it("tells the page once when the run is finished, and closes the stream", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRunStream("run-1", onDone));

    // The finish carries the whole stored row; the hook does not need to read it.
    act(() => stream().send("complete", "{ not even json", { raw: true }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.done).toBe(true);
    expect(stream().readyState).toBe(FakeEventSource.CLOSED);
  });

  it("ignores an event it cannot read", () => {
    const { result } = renderHook(() => useRunStream("run-1", () => {}));

    act(() => stream().send("roster", "<html>bad gateway</html>", { raw: true }));

    expect(result.current).toEqual(NO_PROGRESS);
  });

  it("keeps what it has across a reopened stream, and the replayed roster changes nothing", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRunStream("run-1", () => {}));
    act(() => stream().send("roster", roster));
    const before = result.current;

    act(() => stream().failConnect());
    act(() => vi.advanceTimersByTime(5000));
    expect(FakeEventSource.opened).toHaveLength(2);
    act(() => stream().send("roster", roster));

    expect(result.current).toBe(before);
  });

  it("reopens the stream 5 s after a failed connect, and then learns the groups", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRunStream("run-1", () => {}));

    act(() => stream().failConnect());
    act(() => vi.advanceTimersByTime(4999));
    expect(FakeEventSource.opened).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeEventSource.opened).toHaveLength(2);
    expect(stream().url).toBe("/api/analyze/run-1/stream");

    act(() => stream().send("roster", roster));
    expect(result.current.groups).toHaveLength(10);
  });

  it("leaves a dropped connection the browser retries by itself to the browser", () => {
    vi.useFakeTimers();
    renderHook(() => useRunStream("run-1", () => {}));

    act(() => stream().dropAndRetry());
    act(() => vi.advanceTimersByTime(10_000));

    expect(FakeEventSource.opened).toHaveLength(1);
  });

  it("gives up after 5 reopened streams have failed too", () => {
    vi.useFakeTimers();
    renderHook(() => useRunStream("run-1", () => {}));

    for (let i = 0; i < 6; i++) {
      act(() => stream().failConnect());
      act(() => vi.advanceTimersByTime(5000));
    }

    expect(FakeEventSource.opened).toHaveLength(6);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reopen a stream that said the run is finished", () => {
    vi.useFakeTimers();
    renderHook(() => useRunStream("run-1", () => {}));
    act(() => stream().send("complete"));

    act(() => stream().failConnect());
    act(() => vi.advanceTimersByTime(5000));

    expect(FakeEventSource.opened).toHaveLength(1);
  });

  it("leaving the screen cancels a pending reopen", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useRunStream("run-1", () => {}));
    act(() => stream().failConnect());

    unmount();
    act(() => vi.advanceTimersByTime(5000));

    expect(FakeEventSource.opened).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("another run cancels the reopen of the one before", () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ id }) => useRunStream(id, () => {}), { initialProps: { id: "run-1" } });
    act(() => stream().failConnect());

    rerender({ id: "run-2" });
    act(() => vi.advanceTimersByTime(5000));

    expect(FakeEventSource.opened.map((s) => s.url)).toEqual(["/api/analyze/run-1/stream", "/api/analyze/run-2/stream"]);
  });

  it("closes the stream when the screen goes away", () => {
    const { unmount } = renderHook(() => useRunStream("run-1", () => {}));
    const opened = stream();

    unmount();

    expect(opened.readyState).toBe(FakeEventSource.CLOSED);
  });

  it("starts over for another run", () => {
    const { result, rerender } = renderHook(({ id }) => useRunStream(id, () => {}), { initialProps: { id: "run-1" } });
    act(() => stream().send("roster", roster));
    const first = stream();

    rerender({ id: "run-2" });

    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    expect(stream().url).toBe("/api/analyze/run-2/stream");
    expect(result.current).toEqual(NO_PROGRESS);
  });

  it("does nothing where the browser has no EventSource", () => {
    vi.stubGlobal("EventSource", undefined);

    const { result } = renderHook(() => useRunStream("run-1", () => {}));

    expect(result.current).toEqual(NO_PROGRESS);
  });
});
