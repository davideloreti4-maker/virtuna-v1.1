/**
 * brain-signals — Sapient's "nine breakdown signals", 1:1 on the SET and the DIRECTION, mapped
 * honestly from our seven Yeo networks.
 *
 * Owner's call (2026-07-15): copy their nine. Sapient's grid is nine BRAIN signals (no vote cells),
 * and the live panel shows their grade is PER-SIGNAL DIRECTIONAL, not a flat monotonic band — e.g.
 * `28 · Hesitation/Risk · STRONG`, because LOW hesitation is good. We reproduce that:
 *
 *  • The number is the peak modeled activation of the signal's source over the encounter (0..1 → 0..100),
 *    shown RAW. Some signals are composites of two networks (a disclosed index), because nine signals
 *    cannot come from seven networks without deriving two of them — those say so in `whyScore`.
 *  • The GRADE is a fixed band of the number IN THE SIGNAL'S OWN DIRECTION: higher-is-better signals
 *    band `weakness <40 · okay 40–64 · strong ≥65` (Sapient's own cut: 38→WEAKNESS, 61→OKAY, 65→STRONG);
 *    a lower-is-better signal (Hesitation/Risk) bands on `100 − score`, so a low number earns STRONG.
 *  • The band is a cutoff on a MODELED signal, NOT a benchmark against real outcomes — there is no such
 *    corpus (`outlier_teardowns` carries no retention, 19 Reads carry a curve, engine_training_videos is
 *    empty). Every cell says so behind WHY THIS SCORE, and `Buy Signal` / `Hesitation/Risk` additionally
 *    disclose they are PROXIES — we do not measure purchase intent or a real drop-off.
 *
 * Why not map Memorability ← Default Mode the way Sapient does: in OUR model the default-mode drive
 * RISES with disengagement (it tracks 1−retention), so calling it "memory, high = good" would be
 * backwards. Memorability is derived instead from an honest encoding proxy (limbic arousal × attention);
 * raw Default Mode stays for the σ bars, where it means what it means.
 */

import { NETWORK_IDS, predictedBold, type DriveInput, type NetworkId } from './cortex-sim';

export type SignalTone = 'weak' | 'okay' | 'strong';
export type SignalDirection = 'higher' | 'lower';

export interface BrainSignal {
  key: string;
  /** creator-facing, rendered mono ALL-CAPS in the grid */
  label: string;
  /** 0..100 — the raw peak activation of the signal's source */
  score: number;
  /** the coloured verdict under the number: WEAKNESS / OKAY / STRONG, in the signal's own direction */
  word: string;
  tone: SignalTone;
  /** the honesty clarifier — what this number is NOT (surfaced behind WHY THIS SCORE) */
  notMeasured: string;
  /** the full "why this grade" disclosure: derivation + banding + not-a-benchmark (WHY THIS SCORE) */
  whyScore: string;
  /** all nine are modeled; kept so the UI/tests can assert nothing here is a claimed measurement */
  real: false;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** The disclosed band — Sapient's own cut. Applied to the number in the signal's own direction. */
const WEAK_MAX = 40;
const STRONG_MIN = 65;
function gradeDirectional(score: number, dir: SignalDirection): { word: string; tone: SignalTone } {
  const g = dir === 'lower' ? 100 - score : score;
  if (g < WEAK_MAX) return { word: 'Weakness', tone: 'weak' };
  if (g < STRONG_MIN) return { word: 'Okay', tone: 'okay' };
  return { word: 'Strong', tone: 'strong' };
}

/**
 * Sapient's nine ← our seven networks. `from` reads the peak-activation record and returns the
 * signal's 0..1 level (a raw network, or a disclosed composite). `basis` is the derivation line shown
 * in WHY THIS SCORE. `proxy` cells additionally say they are not the real thing.
 */
const SIGNALS: {
  key: string;
  label: string;
  dir: SignalDirection;
  from: (p: Record<NetworkId, number>) => number;
  notMeasured: string;
  basis: string;
}[] = [
  { key: 'visual', label: 'Visual Pull', dir: 'higher', from: (p) => p.visual, basis: 'peak visual-cortex activation', notMeasured: 'Modeled visual-cortex drive — not eye-tracking.' },
  { key: 'voice', label: 'Voice Impact', dir: 'higher', from: (p) => p.somatomotor, basis: 'peak somatomotor (auditory-motor) activation, read as a voice-impact proxy', notMeasured: 'A somatomotor/auditory proxy — not audio analysis.' },
  { key: 'grip', label: 'Cognitive Grip', dir: 'higher', from: (p) => p.control, basis: 'peak frontoparietal (control-network) engagement', notMeasured: 'Modeled control-network engagement — not a comprehension test.' },
  { key: 'emotion', label: 'Emotional Hit', dir: 'higher', from: (p) => p.limbic, basis: 'peak limbic activation', notMeasured: 'Modeled limbic drive — not self-reported feeling.' },
  { key: 'memory', label: 'Memorability', dir: 'higher', from: (p) => 0.6 * p.limbic + 0.4 * p.dorsal_attention, basis: 'a composite of limbic arousal × attention (an encoding proxy)', notMeasured: 'A composite encoding proxy — not measured recall.' },
  { key: 'attention', label: 'Attention', dir: 'higher', from: (p) => p.dorsal_attention, basis: 'peak dorsal-attention activation', notMeasured: 'Modeled attention-network drive — not measured watch-time.' },
  { key: 'buy', label: 'Buy Signal', dir: 'higher', from: (p) => 0.6 * p.limbic + 0.4 * p.salience, basis: 'a composite of limbic reward × salience approach (a reward proxy)', notMeasured: 'A disclosed reward proxy — we do NOT measure purchase intent.' },
  { key: 'risk', label: 'Hesitation / Risk', dir: 'lower', from: (p) => p.salience, basis: 'peak salience (conflict) activation, read as hesitation — so LOW is strong', notMeasured: 'A salience/conflict proxy — LOW is good; not a measured drop-off.' },
  { key: 'effort', label: 'Mental Effort', dir: 'higher', from: (p) => 0.5 * p.control + 0.5 * p.dorsal_attention, basis: 'a composite of control + attention load', notMeasured: 'A composite cognitive-load index — not a difficulty test.' },
];

/** The banding disclosure, worded for the stimulus we actually had and the signal's direction. */
function whyFor(basis: string, dir: SignalDirection, notMeasured: string, grounded: boolean): string {
  const source = grounded
    ? "modeled from the clip's measured retention curve"
    : "modeled from your concept and the room's real stop-rate";
  const band =
    dir === 'lower'
      ? 'Low is strong: banded strong ≤35 · okay 36–60 · weakness >60'
      : 'Banded weakness <40 · okay 40–64 · strong ≥65';
  return `${basis[0]!.toUpperCase()}${basis.slice(1)} (0–100), ${source}. ${band} — a cutoff on the modeled signal, NOT a benchmark against real outcomes (no such corpus exists). ${notMeasured}`;
}

/**
 * The nine modeled signals, graded from the peak modeled BOLD over the whole encounter, each in its
 * own direction. Pure and deterministic (samples the drive model), so it is SSR-safe and testable.
 */
export function modeledSignals(drive: DriveInput, durationS: number, samples = 40): BrainSignal[] {
  const duration = durationS > 0 ? durationS : 1;
  const grounded = drive.mode === 'grounded';
  const peak = Object.fromEntries(NETWORK_IDS.map((n) => [n, 0])) as Record<NetworkId, number>;
  for (let i = 0; i < samples; i++) {
    const t = (i / Math.max(1, samples - 1)) * duration;
    const b = predictedBold(drive, t);
    for (const n of NETWORK_IDS) if (b[n] > peak[n]!) peak[n] = b[n];
  }
  return SIGNALS.map((s) => {
    const score = Math.round(clamp01(s.from(peak)) * 100);
    const g = gradeDirectional(score, s.dir);
    return {
      key: s.key,
      label: s.label,
      score,
      word: g.word,
      tone: g.tone,
      notMeasured: s.notMeasured,
      whyScore: whyFor(s.basis, s.dir, s.notMeasured, grounded),
      real: false,
    };
  });
}
