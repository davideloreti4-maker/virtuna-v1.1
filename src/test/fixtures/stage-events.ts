/**
 * Canonical stage-event + SSE fixture set.
 *
 * Source of truth for every Wave 1+ hook + SSE-route test in Phase 1 (per Plan
 * 01-01). Downstream tests import these symbols verbatim — DO NOT rename without
 * updating dependent plans (01-02, 01-03, 01-06, 01-07, 01-08).
 */
import type { StageEvent } from "@/lib/engine/events";

export interface StartedEvent {
  id: string;
}

export const STARTED_EVENT: StartedEvent = { id: "test-analysis-id-12chars" };

export const STAGE_EVENT_SEQUENCE: StageEvent[] = [
  { type: "stage_start", stage: "wave_1", wave: 1, timestamp_ms: 100 },
  { type: "stage_end", stage: "wave_1", wave: 1, duration_ms: 850, cost_cents: 4, ok: true },
  { type: "stage_start", stage: "wave_2", wave: 2, timestamp_ms: 950 },
  { type: "stage_end", stage: "wave_2", wave: 2, duration_ms: 1200, cost_cents: 7, ok: true },
  { type: "stage_start", stage: "wave_3_personas", wave: 3, timestamp_ms: 2150 },
  { type: "stage_end", stage: "wave_3_personas", wave: 3, duration_ms: 4500, cost_cents: 22, ok: true },
  { type: "stage_start", stage: "aggregator", wave: "aggregator", timestamp_ms: 6650 },
  { type: "stage_end", stage: "aggregator", wave: "aggregator", duration_ms: 350, cost_cents: 0, ok: true },
];

/** Encoded SSE frame for use in hook test mocks (TextEncoder-friendly). */
export function encodeSSE(eventType: string, data: unknown, id?: string): string {
  const prefix = id ? `id: ${id}\n` : "";
  return `${prefix}event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const COMPLETE_EVENT_TYPE = "complete" as const;
export const STARTED_EVENT_TYPE = "started" as const;
export const STAGE_EVENT_TYPE = "stage" as const;
export const PHASE_EVENT_TYPE = "phase" as const;

/**
 * Alias re-exported for ergonomic destructuring in downstream tests.
 *   import { COMPLETE_EVENT } from "@/test/fixtures/stage-events";
 * Matches the `exports` list declared in 01-01-PLAN.md (must_haves.artifacts).
 */
export const COMPLETE_EVENT = COMPLETE_EVENT_TYPE;
