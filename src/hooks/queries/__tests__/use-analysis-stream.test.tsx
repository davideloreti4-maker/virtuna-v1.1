// @vitest-environment happy-dom
/**
 * Plan 01-02 T2 — assertions filled in for D-01/D-02/D-05/D-07 contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { queryKeys } from "@/lib/queries/query-keys";
import { STAGE_EVENT_SEQUENCE, encodeSSE } from "@/test/fixtures/stage-events";
import { COMPLETED_PREDICTION } from "@/test/fixtures/completed-prediction";
import { PANEL_IDS } from "@/lib/engine/panel-mapping";
import { useBoardStore } from "@/stores/board-store";
import React from "react";

// Controllable route params so we can simulate /analyze/[id] → /analyze nav.
let mockParams: Record<string, string> = {};
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

function mockSSEResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockParams = {};
});

describe("useAnalysisStream", () => {
  it("panelReady starts as all 'idle' for fresh hook", () => {
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    for (const id of PANEL_IDS) expect(result.current.panelReady[id]).toBe("idle");
  });

  it("parses event:started → captures analysisId", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "abc123" }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start({
        input_mode: "text",
        content_type: "tiktok",
        content_text: "hi",
      });
    });
    await waitFor(() => expect(result.current.analysisId).toBe("abc123"));
  });

  it("parses event:stage → appends to stages[] and flips panelReady", async () => {
    const frames = STAGE_EVENT_SEQUENCE.map((ev) => encodeSSE("stage", ev));
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "abc" }),
        ...frames,
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start({
        input_mode: "text",
        content_type: "tiktok",
        content_text: "hi",
      });
    });
    await waitFor(() => expect(result.current.stages.length).toBeGreaterThan(0));
    expect(result.current.panelReady.hook_decomp).toBe("ready");
    expect(result.current.panelReady.verdict).toBe("ready");
  });

  it("parses event:complete → sets phase='complete' and result=payload", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([encodeSSE("complete", COMPLETED_PREDICTION)]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start({
        input_mode: "text",
        content_type: "tiktok",
        content_text: "hi",
      });
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(result.current.result?.overall_score).toBe(0.72);
  });

  it("parses event:error → sets phase='error' and surfaces message", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([encodeSSE("error", { error: "oops" })]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      try {
        await result.current.start({
          input_mode: "text",
          content_type: "tiktok",
          content_text: "hi",
        });
      } catch {
        // expected
      }
    });
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error).toBe("oops");
  });

  it("unknown event types are silently ignored", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("never_heard_of_it", { foo: "bar" }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start({
        input_mode: "text",
        content_type: "tiktok",
        content_text: "hi",
      });
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(result.current.error).toBeNull();
  });

  it("event:complete writes the finalized result into the shared detail cache (sibling-node hydration)", async () => {
    // Regression: board nodes that never opened the stream hydrate off
    // queryKeys.analysis.detail(id). Before this fix they sat on the null-score
    // placeholder cached at /analyze/[id] nav time and never updated.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const localWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "cache-me" }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper: localWrapper });
    await act(async () => {
      await result.current.start({
        input_mode: "text",
        content_type: "tiktok",
        content_text: "hi",
      });
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"));

    const cached = qc.getQueryData(queryKeys.analysis.detail("cache-me")) as
      | { overall_score?: number }
      | undefined;
    expect(cached).toBeDefined();
    expect(cached?.overall_score).toBe(0.72);
  });

  it("New analysis nav (permalink → /analyze base) wipes completed state to empty", async () => {
    // Regression: each board node mounts its own useAnalysisStream instance.
    // Clicking "New analysis" must reset EVERY instance to the empty board, not
    // just Board's. Simulated here by a route param transition id → none.
    mockParams = { id: "abc" };
    const { result, rerender } = renderHook(
      () =>
        useAnalysisStream({
          initialData: COMPLETED_PREDICTION as unknown as { overall_score: number },
        }),
      { wrapper },
    );

    // Permalink-complete starting point.
    expect(result.current.phase).toBe("complete");
    expect(result.current.result?.overall_score).toBe(0.72);

    // Navigate to /analyze base — no id.
    mockParams = {};
    rerender();

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    expect(result.current.result).toBeNull();
    expect(result.current.analysisId).toBeNull();
    expect(result.current.stages).toHaveLength(0);
  });

  it("triggerNewAnalysis() wipes a completed run even when the URL never changed", async () => {
    // The run→complete→New-analysis flow: a fresh analysis sets its URL via
    // history.replaceState (bypasses Next's router), so useParams never reports
    // the id. The reset must therefore key off the board store's
    // newAnalysisSignal, not the route. mockParams stays empty throughout.
    mockParams = {};
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "run-1" }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start({
        input_mode: "text",
        content_type: "tiktok",
        content_text: "hi",
      });
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(result.current.analysisId).toBe("run-1");

    // Click "New analysis" — bumps the store signal; URL stays /analyze.
    act(() => {
      useBoardStore.getState().triggerNewAnalysis();
    });

    await waitFor(() => expect(result.current.phase).toBe("idle"));
    expect(result.current.result).toBeNull();
    expect(result.current.analysisId).toBeNull();
  });

  it("initialData with overall_score!=null skips stream open (Pitfall #3)", () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const { result } = renderHook(
      () =>
        useAnalysisStream({
          initialData: COMPLETED_PREDICTION as unknown as { overall_score: number },
        }),
      { wrapper },
    );
    expect(result.current.phase).toBe("complete");
    expect(result.current.result?.overall_score).toBe(0.72);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Regression: starting a NEW analysis from a board hydrated with a completed
  // permalink must still POST. The mutation previously short-circuited on
  // `completedFromInitial`, silently swallowing every command-bar submit made
  // while viewing a finished /analyze/[id]. start() is user-only, so it must
  // always supersede the hydrated-complete state.
  it("start() POSTs a new analysis even when hydrated from completed initialData", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "fresh-id" }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    global.fetch = fetchSpy;
    const { result } = renderHook(
      () =>
        useAnalysisStream({
          initialData: {
            id: "old-id",
            ...COMPLETED_PREDICTION,
          } as unknown as { id: string; overall_score: number },
        }),
      { wrapper },
    );
    // Mounts short-circuited to 'complete' (Pitfall #3 — no auto-open).
    expect(result.current.phase).toBe("complete");
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.start({
        input_mode: "text",
        content_type: "tiktok",
        content_text: "a brand new caption",
      });
    });

    // The explicit submit fired a real POST and adopted the fresh analysisId.
    expect(fetchSpy).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(result.current.analysisId).toBe("fresh-id"));
  });
});
