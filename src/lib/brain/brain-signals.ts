/**
 * brain-signals — the honest fill for Sapient's "nine breakdown signals" grid.
 *
 * ⚠️ READ `room-readout.ts` §5 FIRST — but note it is now PARTLY STALE. The prior author rejected a
 * scored-and-graded grid on two grounds: (1) the simulated drive was a seeded function of the card's
 * id HASH, so the number was arbitrary; (2) no corpus exists to ground a ">70 STRONG" percentile.
 * Ground (1) is GONE: `cortex-sim` deleted the hash (`neuralDrive` line 148, "THERE IS NO HASH … AND
 * THERE MUST NEVER BE ONE AGAIN"). The response is now a pure, deterministic function of the REAL
 * signal — the room's stop-ratio, and in grounded mode its measured retention curve. Same room →
 * same brain. Ground (2) still stands, and it is why the grade is DISCLOSED, not silent:
 *
 * Owner's call (2026-07-15): the grid reads 1:1 with Sapient — a graded WEAKNESS / OKAY / STRONG
 * word, coloured. We are allowed to grade because we disclose exactly HOW:
 *
 *  • The number is the PEAK modeled activation over the encounter (0..1 → 0..100).
 *  • The grade is a fixed BAND of that number — WEAKNESS < 40 · OKAY 40–69 · STRONG ≥ 70 — the same
 *    cut Sapient's own cells imply (38 → WEAKNESS, 47/61 → OKAY). It is a threshold on MODELED
 *    activation, NOT a percentile against real outcomes; there is no such corpus (`outlier_teardowns`
 *    carries no retention, 19 Reads carry a curve, engine_training_videos is empty).
 *  • Every modeled cell carries `whyScore` (the banding + what the number is NOT), surfaced behind the
 *    grid's WHY-THIS-SCORE affordance, and is `real:false` so the UI can mark it MODELED. The grade is
 *    never allowed to read as a measurement.
 *  • The REAL-VOTE cells (Core hold, Reach) are graded too — but there a low count is unambiguously a
 *    weakness with no benchmark required, because it is a count, not a score.
 *
 * `invert` (the default-mode network) is presented POSITIVELY as "Immersion": score = 100 − peak, so
 * every one of the nine reads "higher = better" like Sapient's, with no confusing back-to-front grade.
 */

import { NETWORK_IDS, predictedBold, type DriveInput, type NetworkId } from './cortex-sim';

/** weak/okay/strong are graded verdicts; 'absent' is a vote cell with too little of its segment to read. */
export type SignalTone = 'weak' | 'okay' | 'strong' | 'absent';

export interface BrainSignal {
  key: string;
  /** creator-facing, rendered mono ALL-CAPS in the grid */
  label: string;
  /** 0..100 — peak modeled activation for networks, real vote share for the vote cells; null when absent */
  score: number | null;
  /** the coloured verdict under the number: WEAKNESS / OKAY / STRONG (or an absent note) */
  word: string;
  /** drives the word's colour and the bar */
  tone: SignalTone;
  /** the honesty clarifier — what this number is NOT (surfaced behind WHY THIS SCORE) */
  notMeasured: string;
  /** the full "why this grade" disclosure: how the number is derived and banded (WHY THIS SCORE panel) */
  whyScore: string;
  /** true = a real vote count; false = a modeled cortical signal */
  real: boolean;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** The disclosed band: a threshold on the 0..100 number, identical for modeled and real cells. */
const WEAK_MAX = 40;
const STRONG_MIN = 70;
function grade(score: number): { word: string; tone: 'weak' | 'okay' | 'strong' } {
  if (score < WEAK_MAX) return { word: 'Weakness', tone: 'weak' };
  if (score < STRONG_MIN) return { word: 'Okay', tone: 'okay' };
  return { word: 'Strong', tone: 'strong' };
}

/**
 * Sapient's creator-facing name ← our Yeo network. `invert` marks the default-mode network, which we
 * present as its positive complement "Immersion" (100 − peak) so its grade runs the same way as the rest.
 */
const NETWORK_SIGNALS: {
  key: string;
  net: NetworkId;
  label: string;
  notMeasured: string;
  invert?: boolean;
}[] = [
  { key: 'visual', net: 'visual', label: 'Visual pull', notMeasured: 'Modeled visual-cortex drive — not eye-tracking.' },
  { key: 'attention', net: 'dorsal_attention', label: 'Attention', notMeasured: 'Modeled attention-network drive — not measured watch-time.' },
  { key: 'salience', net: 'salience', label: 'Stopping power', notMeasured: 'Modeled salience drive — not a scroll-stop count.' },
  { key: 'emotion', net: 'limbic', label: 'Emotional hit', notMeasured: 'Modeled limbic drive — not self-reported feeling.' },
  { key: 'grip', net: 'control', label: 'Cognitive grip', notMeasured: 'Modeled control-network load — not a comprehension test.' },
  { key: 'urge', net: 'somatomotor', label: 'Urge to act', notMeasured: 'Modeled motor-network drive — not a click.' },
  { key: 'drift', net: 'default', label: 'Immersion', notMeasured: 'Modeled default-mode suppression — high means immersed, not mind-wandering; not a measured attention span.', invert: true },
];

/** The one-line banding disclosure, worded for the stimulus we actually had. */
function bandingWhy(grounded: boolean): string {
  const source = grounded
    ? "modeled from the clip's measured retention curve"
    : "modeled from your concept and the room's real stop-rate";
  return `Peak modeled cortical activation (0–100), ${source}. Banded weakness <40 · okay 40–69 · strong ≥70 — a cutoff on the modeled signal, NOT a benchmark against real outcomes (no such corpus exists).`;
}

/**
 * The seven MODELED network signals, graded from the peak modeled BOLD over the whole encounter.
 * Pure and deterministic (samples the drive model), so it is SSR-safe and testable without a DOM.
 */
export function modeledSignals(drive: DriveInput, durationS: number, samples = 40): BrainSignal[] {
  const duration = durationS > 0 ? durationS : 1;
  const grounded = drive.mode === 'grounded';
  const why = bandingWhy(grounded);
  const peak = Object.fromEntries(NETWORK_IDS.map((n) => [n, 0])) as Record<NetworkId, number>;
  for (let i = 0; i < samples; i++) {
    const t = (i / Math.max(1, samples - 1)) * duration;
    const b = predictedBold(drive, t);
    for (const n of NETWORK_IDS) if (b[n] > peak[n]!) peak[n] = b[n];
  }
  return NETWORK_SIGNALS.map((s) => {
    const raw = Math.round(clamp01(peak[s.net]!) * 100);
    const score = s.invert ? 100 - raw : raw;
    const g = grade(score);
    return {
      key: s.key,
      label: s.label,
      score,
      word: g.word,
      tone: g.tone,
      notMeasured: s.notMeasured,
      whyScore: why,
      real: false,
    };
  });
}

/**
 * Build a real-vote signal cell — a count, so it carries an honest verdict with no benchmark needed.
 * Graded on the SAME flat band as the modeled cells, so the nine read as ONE grid: one number → one
 * verdict, monotonic, the way Sapient's is legible. room-readout's asymmetric segment verdict
 * ("Wavering" for a core below 70, "Mixed" for a middling reach) is RICHER than a flat band, but it is
 * already surfaced three other ways on the card (the SPLITS chip, the segment splits, the divergence),
 * and forcing it into the grade here would make the grid non-monotonic — a 67 reading worse than a 57 —
 * which is exactly what makes a grid look arbitrary. So the chip's nuance is preserved in whyScore
 * (behind WHY THIS SCORE), and the surface grade follows the number.
 */
export function voteSignal(
  key: string,
  label: string,
  pct: number,
  opts: { chip: string; notMeasured: string },
): BrainSignal {
  const g = grade(pct);
  return {
    key,
    label,
    score: pct,
    word: g.word,
    tone: g.tone,
    notMeasured: opts.notMeasured,
    whyScore: `${opts.chip} — ${pct}% is a real share of the ten personas' votes, a count not a modeled score, so it needs no benchmark. ${opts.notMeasured}`,
    real: true,
  };
}

/** A vote cell we cannot fill — too few of that segment to read. Absent, never a fabricated zero (D-13). */
export function absentSignal(key: string, label: string, reason: string): BrainSignal {
  return {
    key,
    label,
    score: null,
    word: 'No data',
    tone: 'absent',
    notMeasured: reason,
    whyScore: reason,
    real: true,
  };
}
