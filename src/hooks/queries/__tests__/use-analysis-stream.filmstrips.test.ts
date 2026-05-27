// @vitest-environment happy-dom
/**
 * Plan 04-03 T1 — filmstrip_segment_ready dispatch + filmstrips return key.
 *
 * Tests that useAnalysisStream correctly:
 *   1. Initialises filmstrips to {}
 *   2. Populates filmstrips[n] when filmstrip_segment_ready arrives
 *   3. Accumulates multiple filmstrip_segment_ready events (different segment_idx)
 *   4. Resets filmstrips to {} on start() of a new analysis
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { encodeSSE } from "@/test/fixtures/stage-events";
import { COMPLETED_PREDICTION } from "@/test/fixtures/completed-prediction";
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

const START_INPUT = {
  input_mode: "text" as const,
  content_type: "tiktok",
  content_text: "test hook video",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useAnalysisStream — filmstrips", () => {
  it("initial filmstrips is {}", () => {
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    expect(result.current.filmstrips).toEqual({});
  });

  it("single filmstrip_segment_ready event populates filmstrips[segment_idx]", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "fs-test-001" }),
        encodeSSE("stage", {
          type: "filmstrip_segment_ready",
          segment_idx: 3,
          keyframe_uri: "https://example.com/k3.jpg",
        }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start(START_INPUT);
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(result.current.filmstrips[3]).toBe("https://example.com/k3.jpg");
  });

  it("multiple filmstrip_segment_ready events accumulate into filmstrips map", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "fs-test-002" }),
        encodeSSE("stage", {
          type: "filmstrip_segment_ready",
          segment_idx: 3,
          keyframe_uri: "https://example.com/k3.jpg",
        }),
        encodeSSE("stage", {
          type: "filmstrip_segment_ready",
          segment_idx: 5,
          keyframe_uri: "https://example.com/k5.jpg",
        }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start(START_INPUT);
    });
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(result.current.filmstrips[3]).toBe("https://example.com/k3.jpg");
    expect(result.current.filmstrips[5]).toBe("https://example.com/k5.jpg");
    // Other indices untouched
    expect(result.current.filmstrips[0]).toBeUndefined();
    expect(result.current.filmstrips[1]).toBeUndefined();
  });

  it("start('new_id') resets filmstrips to {}", async () => {
    // First analysis populates a filmstrip entry
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "fs-test-003a" }),
        encodeSSE("stage", {
          type: "filmstrip_segment_ready",
          segment_idx: 2,
          keyframe_uri: "https://example.com/k2.jpg",
        }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    const { result } = renderHook(() => useAnalysisStream(), { wrapper });
    await act(async () => {
      await result.current.start(START_INPUT);
    });
    await waitFor(() => expect(result.current.filmstrips[2]).toBe("https://example.com/k2.jpg"));

    // Second analysis start — filmstrips must reset to {}
    global.fetch = vi.fn().mockResolvedValue(
      mockSSEResponse([
        encodeSSE("started", { id: "fs-test-003b" }),
        encodeSSE("complete", COMPLETED_PREDICTION),
      ]),
    );
    await act(async () => {
      await result.current.start(START_INPUT);
    });
    // After reset, segment 2 from prior analysis must no longer be present
    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(result.current.filmstrips[2]).toBeUndefined();
    expect(result.current.filmstrips).toEqual({});
  });
});
