// @vitest-environment happy-dom
/**
 * Plan 01-02 T2 — assertions filled in for D-03 reconnect ladder + Pitfall #8 visibility.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { COMPLETED_PREDICTION } from "@/test/fixtures/completed-prediction";
import React from "react";

class MockEventSource {
  static instances: MockEventSource[] = [];
  readyState = 1;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(cb);
    this.listeners.set(type, arr);
  }
  removeEventListener() {}
  close() {
    this.readyState = MockEventSource.CLOSED;
  }
  emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    for (const cb of this.listeners.get(type) ?? []) cb(event);
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAnalysisStream reconnect", () => {
  it("reconnect() without analysisId is a no-op (no EventSource opened)", async () => {
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      result.current.reconnect();
    });
    expect(MockEventSource.instances.length).toBe(0);
  });

  it("reconnect() with analysisId opens EventSource pointing at /api/analyze/[id]/stream", async () => {
    const { result } = renderHook(
      (opts: { initialData?: { id: string; overall_score: null } }) =>
        useAnalysisStream(opts),
      {
        wrapper,
        initialProps: { initialData: { id: "the-id", overall_score: null } },
      },
    );
    await act(async () => {
      result.current.reconnect();
    });
    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0]!.url).toBe("/api/analyze/the-id/stream");
    expect(result.current.phase).toBe("reconnecting");
  });

  it("EventSource event:complete sets result + phase=complete and closes stream", async () => {
    const { result } = renderHook(
      (opts: { initialData?: { id: string; overall_score: null } }) =>
        useAnalysisStream(opts),
      {
        wrapper,
        initialProps: { initialData: { id: "the-id", overall_score: null } },
      },
    );
    await act(async () => {
      result.current.reconnect();
    });
    const es = MockEventSource.instances[0]!;
    await act(async () => {
      es.emit("complete", COMPLETED_PREDICTION);
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(es.readyState).toBe(MockEventSource.CLOSED);
  });

  it("EventSource closed without complete switches phase to 'polling'", async () => {
    const { result } = renderHook(
      (opts: { initialData?: { id: string; overall_score: null } }) =>
        useAnalysisStream(opts),
      {
        wrapper,
        initialProps: { initialData: { id: "the-id", overall_score: null } },
      },
    );
    await act(async () => {
      result.current.reconnect();
    });
    const es = MockEventSource.instances[0]!;
    await act(async () => {
      es.readyState = MockEventSource.CLOSED;
      es.emit("error", {});
    });
    await waitFor(() => expect(result.current.phase).toBe("polling"));
  });

  it("polling stops when row.overall_score !== null", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ...COMPLETED_PREDICTION, overall_score: 0.81 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const { result } = renderHook(
      (opts: { initialData?: { id: string; overall_score: null } }) =>
        useAnalysisStream(opts),
      {
        wrapper,
        initialProps: { initialData: { id: "the-id", overall_score: null } },
      },
    );
    await act(async () => {
      result.current.reconnect();
    });
    const es = MockEventSource.instances[0]!;
    await act(async () => {
      es.readyState = MockEventSource.CLOSED;
      es.emit("error", {});
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"), {
      timeout: 5000,
    });
  });

  it("visibilitychange='hidden' keeps phase=polling without crashing the poll loop", async () => {
    const { result } = renderHook(
      (opts: { initialData?: { id: string; overall_score: null } }) =>
        useAnalysisStream(opts),
      {
        wrapper,
        initialProps: { initialData: { id: "the-id", overall_score: null } },
      },
    );
    await act(async () => {
      result.current.reconnect();
    });
    const es = MockEventSource.instances[0]!;
    await act(async () => {
      es.readyState = MockEventSource.CLOSED;
      es.emit("error", {});
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Phase stays in 'polling' — visibility just toggles enabled flag.
    expect(result.current.phase).toBe("polling");
  });
});
