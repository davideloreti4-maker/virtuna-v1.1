/**
 * signal-timeline — Sapient's "ACTIVATION PER SECOND" heatmap, honest.
 *
 * Sapient's heatmap is ten "decoded systems" per second. We do not model ten systems — we model seven
 * networks and derive NINE signals from them (see brain-signals.ts). So our heatmap is OUR nine
 * signals per second, honestly labelled, not faked into their ten. Each cell is that signal's raw
 * activation (0..100) at that second — the same `from` mapping the grid uses, sampled over time instead
 * of at the peak.
 *
 * ⚠️ GROUNDED ONLY. A per-second timeline is only real when there is a real clip; the simulated concept
 * has no seconds (its drive is a looping envelope). Returns empty rows otherwise.
 */

import { predictedBold, type DriveInput } from './cortex-sim';
import { SIGNAL_DEFS } from './brain-signals';

export interface SignalTimeline {
  /** the second (clip time) each column stands for */
  seconds: number[];
  rows: { key: string; label: string; values: number[] }[];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Per-second activation (0..100) of each of the nine signals across the clip. Pure, deterministic. */
export function signalTimeline(drive: DriveInput, durationS: number, maxCols = 90): SignalTimeline {
  if (drive.mode !== 'grounded') return { seconds: [], rows: [] };
  const duration = durationS > 0 ? durationS : 1;
  const cols = Math.max(1, Math.min(maxCols, Math.round(duration)));
  const seconds = Array.from({ length: cols }, (_, i) => Math.round((i * duration) / cols));
  const bolds = seconds.map((sec) => predictedBold(drive, sec));
  const rows = SIGNAL_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    values: bolds.map((b) => Math.round(clamp01(def.from(b)) * 100)),
  }));
  return { seconds, rows };
}
