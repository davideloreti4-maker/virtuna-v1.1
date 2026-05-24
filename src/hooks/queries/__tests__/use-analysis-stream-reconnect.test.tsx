// @vitest-environment happy-dom
/**
 * Stub test file for the Phase 1 useAnalysisStream reconnect + polling fallback
 * surface (D-03 — single reconnect via last-event-id → TanStack polling fallback).
 *
 * Plan 01-01 ships placeholders; Plan 01-02 (Wave 1) fills in the assertions.
 */
import { describe, it } from "vitest";

describe("useAnalysisStream — reconnect + polling fallback", () => {
  it.todo("on EventSource.onerror, closes and opens single reconnect via GET /api/analyze/[id]/stream");
  it.todo("after second connection drop, switches to TanStack polling against /api/analysis/[id]");
  it.todo("polling stops when row.overall_score !== null");
  it.todo("polling stops after 90s ceiling regardless of state");
  it.todo("visibilitychange='hidden' pauses polling; 'visible' resumes");
  it.todo("Last-Event-ID header included on EventSource reconnect (browser-native — assert via mocked EventSource)");
});
