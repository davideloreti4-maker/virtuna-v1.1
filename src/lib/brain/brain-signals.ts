/**
 * brain-signals — the honest fill for Sapient's "nine breakdown signals" grid.
 *
 * ⚠️ READ `room-readout.ts` §5 FIRST. A prior author measured this exact idea and rejected the naive
 * form: scoring cortical networks 0–100 with a "what good is" THRESHOLD needs a benchmark we do not
 * have, and inventing one is the dishonesty this whole card has been burned by. Owner's call
 * (2026-07-15) is to build the grid anyway — "1:1 with Sapient, honest equivalents, CLEARLY MARKED
 * modeled" — so this threads the needle two ways:
 *
 *  1. The MODELED network cells carry a DESCRIPTIVE LEVEL word (quiet / holding / surging), never a
 *     good/bad verdict. A level is an honest thing to say about a model's output; "WEAKNESS" is not,
 *     because it asserts a benchmark. Each cell also states what the number is NOT.
 *  2. The REAL-VOTE cells (attention hold, reach) DO get a verdict, because a low stop-count is
 *     unambiguously a weakness with no benchmark required — it is a count, not a score.
 *
 * The number itself: for a network it is the PEAK modeled BOLD over the encounter (0..1 → 0..100),
 * i.e. the strongest this system engaged. Downstream of the drive model; re-measure if it changes.
 */

import { NETWORK_IDS, predictedBold, type DriveInput, type NetworkId } from './cortex-sim';

export type SignalTone = 'weak' | 'okay' | 'strong' | 'level';

export interface BrainSignal {
  key: string;
  /** creator-facing, rendered mono ALL-CAPS in the grid */
  label: string;
  /** 0..100 — peak modeled activation for networks, real vote share for the vote cells */
  score: number;
  /** the word under the number: a LEVEL for modeled networks, a VERDICT for real votes */
  word: string;
  /** drives the word's colour. 'level' is the neutral modeled band; the rest are real verdicts. */
  tone: SignalTone;
  /** the honesty clarifier under the number — what this is NOT */
  notMeasured: string;
  /** true = a real vote count; false = a modeled cortical signal */
  real: boolean;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Sapient's creator-facing name ← our Yeo network. The `bands` are plain-language LEVELS (four steps),
 * deliberately not good/bad. `invert` marks the default-mode network: a HIGH default-mode signal means
 * mind-wandering, so its level word runs the other way.
 */
const NETWORK_SIGNALS: {
  key: string;
  net: NetworkId;
  label: string;
  bands: [string, string, string, string];
  notMeasured: string;
  invert?: boolean;
}[] = [
  { key: 'visual', net: 'visual', label: 'Visual pull', bands: ['faint', 'building', 'strong', 'commanding'], notMeasured: 'Modeled visual-cortex drive — not eye-tracking.' },
  { key: 'attention', net: 'dorsal_attention', label: 'Attention', bands: ['quiet', 'gathering', 'holding', 'locked in'], notMeasured: 'Modeled attention-network drive — not measured watch-time.' },
  { key: 'salience', net: 'salience', label: 'Stopping power', bands: ['flat', 'pricked', 'charged', 'seized'], notMeasured: 'Modeled salience drive — not a scroll-stop count.' },
  { key: 'emotion', net: 'limbic', label: 'Emotional hit', bands: ['cold', 'warming', 'moved', 'surging'], notMeasured: 'Modeled limbic drive — not self-reported feeling.' },
  { key: 'grip', net: 'control', label: 'Cognitive grip', bands: ['loose', 'engaging', 'focused', 'gripped'], notMeasured: 'Modeled control-network load — not a comprehension test.' },
  { key: 'urge', net: 'somatomotor', label: 'Urge to act', bands: ['still', 'stirring', 'leaning', 'driven'], notMeasured: 'Modeled motor-network drive — not a click.' },
  { key: 'drift', net: 'default', label: 'Drift', bands: ['low', 'creeping', 'rising', 'taking over'], notMeasured: 'Modeled default-mode drive — high means mind-wandering.', invert: true },
];

/**
 * The seven MODELED network signals, scored from the peak modeled BOLD over the whole encounter.
 * Pure and deterministic (samples the drive model), so it is SSR-safe and testable without a DOM.
 */
export function modeledSignals(drive: DriveInput, durationS: number, samples = 40): BrainSignal[] {
  const duration = durationS > 0 ? durationS : 1;
  const peak = Object.fromEntries(NETWORK_IDS.map((n) => [n, 0])) as Record<NetworkId, number>;
  for (let i = 0; i < samples; i++) {
    const t = (i / Math.max(1, samples - 1)) * duration;
    const b = predictedBold(drive, t);
    for (const n of NETWORK_IDS) if (b[n] > peak[n]!) peak[n] = b[n];
  }
  return NETWORK_SIGNALS.map((s) => {
    const score = Math.round(clamp01(peak[s.net]!) * 100);
    const bi = score < 25 ? 0 : score < 50 ? 1 : score < 72 ? 2 : 3;
    return {
      key: s.key,
      label: s.label,
      score,
      word: s.bands[bi]!,
      tone: 'level',
      notMeasured: s.notMeasured,
      real: false,
    };
  });
}

/** Build a real-vote signal cell — a count, so it may carry an honest verdict. */
export function voteSignal(
  key: string,
  label: string,
  pct: number,
  opts: { word: string; weak: boolean; notMeasured: string },
): BrainSignal {
  return {
    key,
    label,
    score: pct,
    word: opts.word,
    tone: opts.weak ? 'weak' : pct >= 66 ? 'strong' : 'okay',
    notMeasured: opts.notMeasured,
    real: true,
  };
}
