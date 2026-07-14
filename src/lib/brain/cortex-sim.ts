/**
 * cortex-sim — the predicted-BOLD model behind the Room's brain view. Pure + deterministic
 * (no wall-clock, no PRNG at call time), so it is testable without a DOM and safe for SSR.
 *
 * Reference: TRIBE v2 (Meta FAIR, Algonauts 2025) predicts fMRI responses to video/audio/text.
 * We do NOT use their model — it is CC-BY-NC-4.0 — we reproduce the *shape* of the problem:
 *
 *   stimulus → per-network neural drive → HRF convolution → predicted BOLD per parcel
 *
 * The HRF (haemodynamic response function) is the real one: a canonical double-gamma that peaks
 * ~5s after the event and undershoots after. That is why the brain visibly LAGS the video — a
 * true property of BOLD, and the detail that separates this from a decorative pulse.
 *
 * HONESTY (binding):
 *  - `mode: 'grounded'` — a real video Read. The drive is derived from the audience's REAL
 *    retention curve: attention tracks who is still watching, salience spikes where the curve
 *    breaks, and the default-mode network rises with the people who checked out. Modeled from
 *    measured audience behaviour — NOT a measurement of anyone's brain.
 *  - `mode: 'simulated'` — a text concept (no video). A seeded encounter envelope shaped by the
 *    one real aggregate we have (the stop ratio). Labeled as a simulation on the surface.
 *
 * Neither mode ever claims to have scanned a person. The UI must keep saying so.
 */

export type NetworkId =
  | 'visual'
  | 'somatomotor'
  | 'dorsal_attention'
  | 'salience'
  | 'limbic'
  | 'control'
  | 'default';

export const NETWORK_IDS: NetworkId[] = [
  'visual',
  'somatomotor',
  'dorsal_attention',
  'salience',
  'limbic',
  'control',
  'default',
];

/** The four networks the readout speaks about in plain language (the rest still render). */
export const SPOKEN_NETWORKS: { id: NetworkId; label: string; words: [string, string, string, string] }[] = [
  { id: 'dorsal_attention', label: 'Attention', words: ['quiet', 'gathering', 'holding', 'locked in'] },
  { id: 'salience', label: 'Salience', words: ['flat', 'pricked', 'charged', 'seized'] },
  { id: 'limbic', label: 'Emotion', words: ['cold', 'warming', 'moved', 'surging'] },
  { id: 'default', label: 'Drift', words: ['low', 'creeping', 'rising', 'taking over'] },
];

/** fMRI repetition time, seconds — TRIBE's fMRI is sampled at TR = 1.49s. */
export const TR_S = 1.49;
/** The canonical HRF peaks ~5s after the neural event; we show this as the response lag. */
export const HRF_PEAK_S = 5;
/** Convolution window — the canonical HRF is all but spent by ~16s (peak 5s, undershoot ~12s). */
const HRF_WINDOW_S = 16;
const HRF_STEP_S = 0.5;

export type SimMode = 'grounded' | 'simulated';

export interface DriveInput {
  mode: SimMode;
  /** The ONE real aggregate: the fraction of the room that stops/stays (0..1). */
  stopRatio: number;
  /** Stimulus length in seconds (the video's duration, or the simulated encounter's). */
  durationS: number;
  /** GROUNDED only: the audience's real retention at a normalized stimulus time u∈[0,1] → 0..1. */
  retentionAt?: (u: number) => number;
  /** Seeds the per-network texture (a stable string — the focus id / card id). */
  seedKey: string;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const gauss = (x: number, c: number, w: number) => Math.exp(-((x - c) * (x - c)) / w);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/**
 * Canonical double-gamma HRF (the SPM shape): a positive gamma peaking ~5s, minus a smaller,
 * later gamma that produces the post-stimulus undershoot. Normalized to unit area so a convolved
 * drive keeps its scale.
 */
function hrf(t: number): number {
  if (t < 0) return 0;
  const peak = Math.pow(t, 5) * Math.exp(-t) / 120; // gamma(6,1) → peaks at t=5
  const under = Math.pow(t, 15) * Math.exp(-t) / 1307674368000; // gamma(16,1)
  return peak - under / 6;
}

const HRF_KERNEL: { tau: number; w: number }[] = (() => {
  const k: { tau: number; w: number }[] = [];
  let sum = 0;
  for (let tau = 0; tau <= HRF_WINDOW_S; tau += HRF_STEP_S) {
    const w = hrf(tau);
    k.push({ tau, w });
    sum += Math.abs(w);
  }
  return k.map(({ tau, w }) => ({ tau, w: w / sum }));
})();

/** The instantaneous NEURAL drive per network at stimulus-time `t` seconds (pre-HRF). */
export function neuralDrive(input: DriveInput, t: number): Record<NetworkId, number> {
  const { mode, stopRatio: sR, durationS } = input;
  const rng = mulberry32(hashSeed(input.seedKey));
  // A stable per-network texture (phase + rate), so two concepts never look identical.
  const tex = NETWORK_IDS.map(() => ({ p: rng() * Math.PI * 2, w: 0.7 + rng() * 0.8 }));
  const wob = (i: number) => 0.04 * Math.sin(t * tex[i]!.w + tex[i]!.p);

  const dur = durationS > 0 ? durationS : 1;
  // Where we are in the stimulus, normalized.
  //  • grounded (a video): it plays ONCE. Before it starts there is only rest, so the HRF
  //    integrating backwards past t=0 correctly finds baseline.
  //  • simulated (a text concept): the encounter LOOPS, so the drive is PERIODIC. Without this the
  //    convolution reaches back before the first loop, finds rest, and the response never builds —
  //    the brain sits dead at "quiet / flat / cold" forever.
  const u =
    mode === 'grounded' ? clamp01(t / dur) : (((t % dur) + dur) % dur) / dur;

  if (mode === 'grounded' && input.retentionAt) {
    // Before the video starts there is no stimulus — only resting-state, where the default
    // network is (correctly) the loudest thing in the head. The HRF window reaches back here.
    if (t < 0) {
      return {
        visual: 0.10, somatomotor: 0.08, dorsal_attention: 0.08,
        salience: 0.10, limbic: 0.10, control: 0.10, default: 0.42,
      } as Record<NetworkId, number>;
    }
    // GROUNDED — the drive comes from the audience's REAL retention curve.
    const r = clamp01(input.retentionAt(u));
    const dU = 0.04;
    const rPrev = clamp01(input.retentionAt(clamp01(u - dU)));
    // Retention only falls; a steep fall is a break — the moment the room comes apart.
    const fall = clamp01((rPrev - r) / 0.12); // 0..1, 1 = a hard break
    const onset = gauss(u, 0.02, 0.0015);

    return {
      // The video is on screen the whole time: visual/somatomotor track the stimulus itself,
      // modulated by how much of the room is still there to watch it.
      visual: clamp01(0.34 + 0.42 * r + 0.16 * onset + wob(0)),
      somatomotor: clamp01(0.14 + 0.20 * r + 0.10 * fall + wob(1)),
      // Attention IS retention: the people still watching are the people still attending.
      dorsal_attention: clamp01(0.10 + 0.72 * r * r + 0.20 * onset + wob(2)),
      // Salience fires at the breaks — the cut, the claim, the moment they bail.
      salience: clamp01(0.12 + 0.30 * r + 0.62 * fall + 0.34 * onset + wob(3)),
      // Feeling rides the held audience, and spikes where the story turns.
      limbic: clamp01(0.10 + 0.44 * r * (0.5 + 0.5 * u) + 0.22 * fall + wob(4)),
      control: clamp01(0.12 + 0.40 * r * smooth(0.1, 0.6, u) + wob(5)),
      // The default network is the audience you already lost — it rises as retention falls.
      default: clamp01(0.06 + 0.80 * (1 - r) + 0.20 * fall + wob(6)),
    } as Record<NetworkId, number>;
  }

  // SIMULATED — a seeded encounter with a text concept: Onset → Hold → Decision, shaped by the
  // one real number we have (how much of the room stopped).
  const onset = gauss(u, 0.09, 0.004);
  const hold = smooth(0.10, 0.30, u);
  const decide = gauss(u, 0.86, 0.008);
  const late = smooth(0.5, 0.95, u);

  // The amplitudes run hot on purpose: the HRF is a low-pass filter, so a drive tuned to look
  // right RAW comes out of the convolution flattened into a dead, unmoving map.
  return {
    visual: clamp01(0.26 + 0.46 * onset + 0.34 * hold + wob(0)),
    somatomotor: clamp01(0.12 + 0.36 * sR * decide + 0.16 * hold + wob(1)),
    dorsal_attention: clamp01(
      0.12 + 0.80 * onset + (0.28 + 0.42 * sR) * hold * (1 - (1 - sR) * 0.8 * late) + 0.34 * sR * decide + wob(2),
    ),
    salience: clamp01(0.14 + 0.86 * onset + 0.40 * sR * decide + wob(3)),
    limbic: clamp01(0.10 + (0.26 + 0.48 * sR) * smooth(0.16, 0.6, u) + 0.44 * sR * decide + wob(4)),
    control: clamp01(0.10 + 0.22 * onset + 0.56 * sR * smooth(0.3, 0.85, u) + wob(5)),
    default: clamp01(0.06 + 0.26 * (1 - sR) * smooth(0.2, 0.5, u) + 0.86 * (1 - sR) * late + wob(6)),
  } as Record<NetworkId, number>;
}

/**
 * Predicted BOLD per network at scan-time `t`: the neural drive convolved with the HRF. The BOLD
 * at time t therefore reflects the stimulus mostly ~5s EARLIER — the lag is not an effect, it is
 * the physiology.
 */
export function predictedBold(input: DriveInput, t: number): Record<NetworkId, number> {
  const out = {} as Record<NetworkId, number>;
  for (const id of NETWORK_IDS) out[id] = 0;
  for (const { tau, w } of HRF_KERNEL) {
    const drive = neuralDrive(input, t - tau);
    for (const id of NETWORK_IDS) out[id] += drive[id] * w;
  }
  // The kernel is area-normalized over |w|, so a sustained drive lands a little under its own
  // amplitude; a modest gain restores it WITHOUT pegging the meters at 1.00 (a permanently
  // saturated network says nothing — the whole value is in the movement).
  for (const id of NETWORK_IDS) out[id] = clamp01(out[id] * 1.12);
  return out;
}

/**
 * A parcel's stable texture — how hot it runs relative to its network, and its own slow drift.
 * Real parcel maps are heterogeneous WITHIN a network; a flat network fill is the tell of a fake
 * map. Computed ONCE per surface (not per frame) — the caller memoizes.
 */
export interface ParcelTexture {
  bias: number;
  phase: number;
  rate: number;
  /** Cortical curvature (0 = sulcus/deep, 1 = gyrus/crown) — the gray the surface shows at rest. */
  curv: number;
}

/**
 * A parcel's texture, keyed on WHERE it sits on the surface.
 *
 * `bias` is spatially SMOOTH (a sum of seeded sinusoids over the parcel's centroid), not random
 * per parcel. That matters: real activation appears as contiguous clusters, and an independent
 * random draw per parcel produces salt-and-pepper speckle — the single clearest tell of a fake
 * map. Neighbouring parcels therefore run hot or cool together, exactly as a smoothed statistical
 * map does. `curv` stays per-parcel (cortical folding IS high-frequency).
 */
export function parcelTexture(parcelIndex: number, seed: number, cx = 0, cy = 0): ParcelTexture {
  const rng = mulberry32((seed ^ (parcelIndex * 0x9e3779b1)) >>> 0);
  const prng = mulberry32(seed);
  const p1 = prng() * Math.PI * 2;
  const p2 = prng() * Math.PI * 2;
  const p3 = prng() * Math.PI * 2;
  // Three octaves of smooth spatial noise → coherent hot/cold territories across the surface.
  const n =
    (Math.sin(cx * 0.042 + cy * 0.019 + p1) +
      0.8 * Math.sin(cx * -0.021 + cy * 0.048 + p2) +
      0.5 * Math.sin(cx * 0.075 + cy * 0.066 + p3)) /
    2.3; // → about −1..1
  return {
    // 0.35 … 1.40, smooth across neighbours. The RANGE matters as much as the smoothness: a narrow
    // band (the old 0.78–1.28) puts every parcel on the same side of the threshold at the same
    // moment, so the whole cortex washes one colour instead of forming clusters — a uniform tint
    // reads as a filter over a picture of a brain, not as a measurement of one.
    bias: 0.35 + (n * 0.5 + 0.5) * 1.05,
    phase: rng() * Math.PI * 2,
    rate: 0.25 + rng() * 0.5,
    curv: rng(),
  };
}

/**
 * The activation THRESHOLD. A real statistical map is thresholded — most of the cortex sits at
 * baseline gray and only the parcels that clear the threshold are painted. Colouring every parcel
 * is what makes a generated map look like stained glass instead of an fMRI.
 */
export const ACTIVATION_THRESHOLD = 0.45;

/**
 * How far above the threshold a parcel must run to be painted at FULL colour.
 *
 * This is not cosmetic, and the rule is: THE RAMP MUST SPAN THE VALUES THAT ACTUALLY OCCUR.
 *
 * It was 0.3, measured against the old procedural surface. On the real mesh the field runs to 0.97
 * (measured), so a 0.3 span saturated at 0.75 and PINNED roughly half the cortex at the deepest end of
 * the ramp — the specimen came out as one dark green mass instead of a map. 0.5 spans 0.45→0.95, which
 * is the range the values genuinely occupy, so only the hottest cores reach full colour.
 */
export const ACTIVATION_SPAN = 0.5;

/** One parcel's predicted BOLD at time `t`, from its network's response and its own texture. */
export function parcelValue(networkValue: number, tex: ParcelTexture, t: number): number {
  return clamp01(networkValue * tex.bias + 0.05 * Math.sin(t * tex.rate + tex.phase));
}

/** Band a 0..1 value into one of four plain-language words. */
export const bandWord = (v: number, words: [string, string, string, string]) =>
  v < 0.25 ? words[0] : v < 0.5 ? words[1] : v < 0.72 ? words[2] : words[3];
