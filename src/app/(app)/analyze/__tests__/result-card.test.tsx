// @vitest-environment happy-dom
/**
 * ResultCard unit tests — Plan 01-08 (D-09, D-10, D-11).
 *
 * Tests the client component that renders 10 GlassPanel slots, each gated by
 * panelReady from useAnalysisStream. Pitfall #3 guard (completed initialData
 * never opens stream) is the most critical path.
 *
 * B3 wiring proofs:
 *  - Test 7: optimal_post panel renders result.optimal_post_window value
 *  - Test 8: emotion_arc panel renders first/last data point summary
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResultCard } from "@/app/(app)/analyze/[id]/result-card";
import { COMPLETED_PREDICTION, IN_FLIGHT_ROW } from "@/test/fixtures/completed-prediction";
import { PANEL_IDS } from "@/lib/engine/panel-mapping";
import * as useAnalysisStreamModule from "@/hooks/queries/use-analysis-stream";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function renderResultCard(
  analysisId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any,
) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <ResultCard analysisId={analysisId} initialData={initialData} />
    </Wrapper>,
  );
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResultCard", () => {
  it("renders one slot per PANEL_IDS", () => {
    // Mock fetch to never resolve (stream open stalls)
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    renderResultCard("test-id-001", null);

    const slots = document.querySelectorAll("[data-panel-id]");
    expect(slots.length).toBe(PANEL_IDS.length);
  });

  it("every panel starts data-panel-ready 'idle' when initialData=null and no stream events received yet", () => {
    // Fetch never resolves — stream stays pending, no events arrive
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    renderResultCard("test-id-002", null);

    const slots = document.querySelectorAll("[data-panel-id]");
    slots.forEach((slot) => {
      const state = slot.getAttribute("data-panel-ready");
      // Panel starts idle; may transition to loading once stream opens — both valid
      expect(["idle", "loading"]).toContain(state);
    });
  });

  it("Pitfall 3 — initialData with overall_score non-null renders all panels ready, no fetch called", async () => {
    const fetchMock = vi.fn(() => new Promise(() => {})) as typeof fetch;
    global.fetch = fetchMock;

    renderResultCard("test-id-003", COMPLETED_PREDICTION);

    await waitFor(() => {
      const slots = document.querySelectorAll("[data-panel-id]");
      slots.forEach((slot) => {
        expect(slot.getAttribute("data-panel-ready")).toBe("ready");
      });
    });

    // Completed initialData — stream MUST NOT be opened (Pitfall #3)
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("initialData with overall_score=null DOES NOT short-circuit (stream opens)", () => {
    // overall_score=null = in-flight row — must NOT trigger Pitfall #3 gate
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    renderResultCard("test-id-004", { id: IN_FLIGHT_ROW.id, overall_score: null });

    // Phase indicator must NOT be 'complete' (stream opened or is pending)
    const phaseEl = document.querySelector("[data-stream-phase]");
    expect(phaseEl).not.toBeNull();
    expect(phaseEl!.getAttribute("data-stream-phase")).not.toBe("complete");
  });

  it("phase=error shows alert + Retry button", async () => {
    // Mock useAnalysisStream to return error phase directly.
    // ResultCard doesn't call start() itself — it renders based on phase.
    // This tests the error UI branch (role="alert" + Retry button).
    const reconnectSpy = vi.fn();
    vi.spyOn(useAnalysisStreamModule, "useAnalysisStream").mockReturnValue({
      start: vi.fn(),
      result: null,
      stages: [],
      partial: { personas: [] },
      panelReady: Object.fromEntries(PANEL_IDS.map((id) => [id, "idle"])) as Record<
        (typeof PANEL_IDS)[number],
        "idle" | "loading" | "ready" | "error"
      >,
      phase: "error",
      error: "Analysis failed — test error",
      // A genuine engine failure, NOT a spent allowance: quotaError stays null, so this stays
      // the retryable error UI and never the paywall.
      quotaError: null,
      clearQuotaError: vi.fn(),
      reconnect: reconnectSpy,
      analysisId: null,
      filmstrips: {},
      abort: vi.fn(),
      reset: vi.fn(),
    });

    renderResultCard("test-id-005", null);

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeNull();
    });

    const retryBtn = screen.queryByRole("button", { name: /retry/i });
    expect(retryBtn).not.toBeNull();
  });

  it("data-stream-phase attribute reflects useAnalysisStream phase", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    renderResultCard("test-id-006", null);

    const phaseEl = document.querySelector("[data-stream-phase]");
    expect(phaseEl).not.toBeNull();
  });

  it("B3: optimal_post panel renders result.optimal_post_window value when ready", async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    renderResultCard("test-id-007", COMPLETED_PREDICTION);

    await waitFor(() => {
      const slot = document.querySelector('[data-panel-id="optimal_post"]');
      expect(slot).not.toBeNull();
      expect(slot!.getAttribute("data-panel-ready")).toBe("ready");
    });

    const slot = document.querySelector('[data-panel-id="optimal_post"]')!;
    // Fixture has optimal_post_window.day_of_week = "Tue"
    // JSON.stringify renders "day_of_week" key and "Tue" value
    expect(slot.textContent).toContain("day_of_week");
    expect(slot.textContent).toContain("Tue");
  });

  it("B3: emotion_arc panel renders first/last result.emotion_arc data points when ready", async () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as typeof fetch;

    renderResultCard("test-id-008", COMPLETED_PREDICTION);

    await waitFor(() => {
      const slot = document.querySelector('[data-panel-id="emotion_arc"]');
      expect(slot).not.toBeNull();
      expect(slot!.getAttribute("data-panel-ready")).toBe("ready");
    });

    const slot = document.querySelector('[data-panel-id="emotion_arc"]')!;
    // Fixture emotion_arc: [{ timestamp_ms: 0, ... }, ..., { timestamp_ms: 9500, ... }]
    expect(slot.textContent).toMatch(/First: t=0ms/);
    expect(slot.textContent).toMatch(/Last: t=9500ms/);
  });
});
