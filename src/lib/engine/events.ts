/**
 * StageEvent discriminated union — emitted at every pipeline `timed()` boundary.
 * Per CONTEXT.md D-02 (locked shape). Consumed by /api/analyze SSE forwarder.
 */

export type StageEventWave = 0 | 1 | 2 | 3 | 4 | "aggregator" | "post";

export type StageEvent =
  | { type: "stage_start"; stage: string; wave: StageEventWave; timestamp_ms: number }
  | { type: "stage_end"; stage: string; wave: StageEventWave; duration_ms: number; cost_cents: number; ok: boolean; warning?: string }
  | { type: "pipeline_warning"; message: string; stage?: string };

export type StageEventCallback = (event: StageEvent) => void;

/**
 * Helper to emit a stage_start event safely when callback may be undefined.
 * Uses performance.now — never wall-clock time — per RESEARCH Anti-Pattern (drift).
 */
export function emitStageStart(
  onEvent: StageEventCallback | undefined,
  stage: string,
  wave: StageEventWave,
): number {
  const timestamp_ms = performance.now();
  onEvent?.({ type: "stage_start", stage, wave, timestamp_ms });
  return timestamp_ms;
}

/**
 * Helper to emit a stage_end event with computed duration.
 */
export function emitStageEnd(
  onEvent: StageEventCallback | undefined,
  stage: string,
  wave: StageEventWave,
  startTs: number,
  opts: { cost_cents?: number; ok?: boolean; warning?: string } = {},
): void {
  const duration_ms = Math.round(performance.now() - startTs);
  onEvent?.({
    type: "stage_end",
    stage,
    wave,
    duration_ms,
    cost_cents: opts.cost_cents ?? 0,
    ok: opts.ok ?? true,
    warning: opts.warning,
  });
}
