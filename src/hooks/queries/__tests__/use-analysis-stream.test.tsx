// @vitest-environment happy-dom
/**
 * Plan 01-02 T2 — assertions filled in for D-01/D-02/D-05/D-07 contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { STAGE_EVENT_SEQUENCE, encodeSSE } from "@/test/fixtures/stage-events";
import { COMPLETED_PREDICTION } from "@/test/fixtures/completed-prediction";
import { PANEL_IDS } from "@/lib/engine/panel-mapping";
import React from "react";

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
});
