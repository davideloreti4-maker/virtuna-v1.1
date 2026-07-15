/**
 * attention-curve — Sapient's "PREDICTED ATTENTION · SMOOTHED" section, honest.
 *
 * Attention over the clip IS the dorsal-attention network's predicted BOLD, which in grounded mode is
 * driven by the audience's REAL retention curve (cortex-sim: "attention IS retention — the people still
 * watching are the people still attending"). So this curve is modeled from a real signal, and its
 * peaks mark the moments the model says attention crested. GROUNDED ONLY — there is no per-second
 * attention curve for a text concept with no clip.
 *
 * The `hold` number is the MODELED mean attention (0..100) and is clearly distinct from the room's REAL
 * "N of 10 stopped" — the UI labels it modeled so the two never read as the same claim.
 */

import { predictedBold, type DriveInput } from './cortex-sim';

export interface AttentionCurve {
  /** 0..100 modeled attention per sample */
  points: number[];
  /** clip time (s) per sample */
  times: number[];
  /** the marked crests, sorted by time */
  peaks: { t: number; v: number; i: number }[];
  /** modeled mean attention 0..100 */
  hold: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const EMPTY: AttentionCurve = { points: [], times: [], peaks: [], hold: 0 };

export function attentionCurve(drive: DriveInput, durationS: number, samples = 64): AttentionCurve {
  if (drive.mode !== 'grounded') return EMPTY;
  const duration = durationS > 0 ? durationS : 1;

  const points: number[] = [];
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * duration;
    points.push(Math.round(clamp01(predictedBold(drive, t).dorsal_attention) * 100));
    times.push(t);
  }
  const hold = Math.round(points.reduce((a, b) => a + b, 0) / points.length);

  // Local maxima above the mean; keep the strongest few, with a minimum time separation so two
  // samples on the same crest do not both get a dot.
  const minSep = duration / 8;
  const candidates: { t: number; v: number; i: number }[] = [];
  for (let i = 1; i < samples - 1; i++) {
    if (points[i]! > points[i - 1]! && points[i]! >= points[i + 1]! && points[i]! > hold) {
      candidates.push({ t: times[i]!, v: points[i]!, i });
    }
  }
  candidates.sort((a, b) => b.v - a.v);
  const peaks: { t: number; v: number; i: number }[] = [];
  for (const c of candidates) {
    if (peaks.length >= 4) break;
    if (peaks.every((p) => Math.abs(p.t - c.t) >= minSep)) peaks.push(c);
  }
  peaks.sort((a, b) => a.t - b.t);

  return { points, times, peaks, hold };
}
