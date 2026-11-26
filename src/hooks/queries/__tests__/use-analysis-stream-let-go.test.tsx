// @vitest-environment happy-dom
/**
 * use-analysis-stream-let-go.test.tsx — leaving the page mid-Test lets the run go on.
 *
 * The POST this hook reads IS the analyze run: the SSE branch of `/api/analyze` does the work inside
 * the request. Aborting it on unmount was a client disconnect from the function running a 10-credit
 * run (and, since "Server adds the card", the one that adds the result card to its chat). Like the
 * other streams (`detach`, let-go-runs.ts): on unmount the request is let go, read to its end in the
 * background, nothing is set or cached after, and its end is told. An explicit cancel the creator
 * asks for (`abort` / `reset`) still aborts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { holdLetGo, subscribeLetGoRunsEnded } from "@/lib/thread-next/let-go-runs";
import { encodeSSE } from "@/test/fixtures/stage-events";
import { useBoardStore } from "@/stores/board-store";
import { COMPLETED_PREDICTION } from "@/test/fixtures/completed-prediction";

vi.mock("next/navigation", () => ({ useParams: () => ({}) }));

let qc: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

type Call = { init?: RequestInit };
let calls: Call[] = [];
/** One analyze request whose body the test feeds and ends (it errors if aborted, with `abortError`). */
function analyzeRequest(abortError: () => Error = () => new DOMException("aborted", "AbortError")) {
  const enc = new TextEncoder();
  let push: (frame: string) => void = () => {};
  let end: () => void = () => {};
  global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ init });
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        push = (f) => c.enqueue(enc.encode(f));
        end = () => c.close();
        init?.signal?.addEventListener("abort", () => c.error(abortError()));
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }) as typeof fetch;
  return { push: (f: string) => push(f), end: () => end() };
}

const INPUT = { input_mode: "tiktok_url" as const, content_type: "video", tiktok_url: "https://www.tiktok.com/@c/video/1" };

beforeEach(() => {
  calls = [];
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

/** EventSource (the reconnect reader): counted, never connected. */
let eventSources = 0;
beforeEach(() => {
  eventSources = 0;
  (globalThis as unknown as { EventSource: unknown }).EventSource = class {
    static CLOSED = 2;
    readyState = 0;
    constructor() {
      eventSources++;
    }
    addEventListener() {}
    close() {}
  };
});

describe("useAnalysisStream: the creator's own cancel, and a cache hit", () => {
  it("no reconnect after the creator's cancel, even when the abort surfaces as another error", async () => {
    const req = analyzeRequest(() => new TypeError("network error"));
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      req.push(encodeSSE("started", { id: "run-1" }));
      await new Promise((r) => setTimeout(r, 10));
    });
    act(() => result.current.abort());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(eventSources).toBe(0);
    expect(result.current.phase).toBe("idle");
  });

  it("a cache hit (one `complete`, no `started`) still names its analysis, so its card can be sealed", async () => {
    const req = analyzeRequest();
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      req.push(encodeSSE("complete", { ...COMPLETED_PREDICTION, id: "an-cached" }));
      req.end();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.phase).toBe("complete");
    expect(result.current.analysisId).toBe("an-cached");
  });
});

describe("useAnalysisStream: the creator leaves the chat mid-run (New chat, or another chat)", () => {
  it("a thread switch lets the run go on: the POST is not aborted, the next chat's state is clean, nothing is set after", async () => {
    const req = analyzeRequest();
    const heard = vi.fn();
    const stopHearing = subscribeLetGoRunsEnded(heard);
    const setQueryData = vi.spyOn(qc, "setQueryData");
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      req.push(encodeSSE("started", { id: "run-1" }));
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.analysisId).toBe("run-1");

    act(() => useBoardStore.getState().switchThread()); // menu → New chat, or another chat
    expect(calls[0]!.init?.signal?.aborted).toBe(false);
    expect(result.current.phase).toBe("idle");
    expect(result.current.analysisId).toBeNull();

    await act(async () => {
      req.push(encodeSSE("complete", COMPLETED_PREDICTION));
      req.end();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(calls[0]!.init?.signal?.aborted).toBe(false);
    expect(result.current.phase).toBe("idle"); // the run's complete is not drawn in the next chat
    expect(result.current.analysisId).toBeNull();
    expect(setQueryData).not.toHaveBeenCalled();
    expect(eventSources).toBe(0);
    expect(heard).toHaveBeenCalledTimes(1);
    stopHearing();
  });

  it("an explicit New analysis (the board's own reset) still cancels", async () => {
    analyzeRequest();
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => useBoardStore.getState().triggerNewAnalysis());
    expect(calls[0]!.init?.signal?.aborted).toBe(true);
  });
});

describe("useAnalysisStream: unmounted mid-run", () => {
  it("held as a paid run: three other runs let go do not end it", async () => {
    analyzeRequest();
    const { result, unmount } = renderHook(() => useAnalysisStream(), { wrapper });
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    unmount();
    const others = [0, 1, 2, 3].map(() => new AbortController());
    const releases = others.map((c) => holdLetGo(c));
    expect(calls[0]!.init?.signal?.aborted).toBe(false);
    releases.forEach((r) => r());
  });

  it("the request is not aborted, is read to its end, nothing is set or cached after, and its end is told", async () => {
    const req = analyzeRequest();
    const heard = vi.fn();
    const stopHearing = subscribeLetGoRunsEnded(heard);
    const errors = vi.spyOn(console, "error");
    const setQueryData = vi.spyOn(qc, "setQueryData");

    const { result, unmount } = renderHook(() => useAnalysisStream(), { wrapper });
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      req.push(encodeSSE("started", { id: "run-1" }));
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.analysisId).toBe("run-1");

    unmount(); // the creator leaves the page
    expect(calls[0]!.init?.signal?.aborted).toBe(false);
    expect(heard).not.toHaveBeenCalled();

    await act(async () => {
      req.push(encodeSSE("complete", COMPLETED_PREDICTION));
      req.end();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(calls[0]!.init?.signal?.aborted).toBe(false);
    expect(setQueryData).not.toHaveBeenCalled(); // the complete frame was read and dropped
    expect(heard).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    stopHearing();
  });

  it("a run that ends on screen says nothing; an explicit abort still aborts", async () => {
    const req = analyzeRequest();
    const heard = vi.fn();
    const stopHearing = subscribeLetGoRunsEnded(heard);
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.abort());
    expect(calls[0]!.init?.signal?.aborted).toBe(true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    analyzeRequest();
    act(() => {
      void result.current.start(INPUT).catch(() => {});
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    void req;
    expect(heard).not.toHaveBeenCalled();
    stopHearing();
  });
});
