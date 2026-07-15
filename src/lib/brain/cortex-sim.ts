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

/**
 * ── THE RESTING STATE ─────────────────────────────────────────────────────────────────────────────
 *
 * The brain is never off. Left alone it runs a characteristic idle: the sensory systems tick over,
 * and the DEFAULT-MODE network — mind-wandering, self-talk, the inner monologue — is the loudest
 * thing in the head. That is why it is called the default mode.
 *
 * This is the drive when there is no stimulus, and it is now the BASELINE the map is painted against
 * (see `contrastBold`). Before, the map painted raw predicted BOLD, which lit ~57% of the cortex the
 * moment anything happened — six of our seven networks are task-positive, so "engaged" meant "almost
 * everything is on". Honest to the model, but it does not look like an fMRI, because an fMRI does not
 * show you activity: it shows you a CONTRAST — this condition minus that one — and the reason a real
 * statistical map is mostly grey is that most of the cortex is doing about what it always does.
 */
export const RESTING_DRIVE: Record<NetworkId, number> = {
  visual: 0.10,
  somatomotor: 0.08,
  dorsal_attention: 0.08,
  salience: 0.10,
  limbic: 0.10,
  control: 0.10,
  default: 0.42,
};

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
  /**
   * ⚠️ THERE IS NO HASH IN THE RESPONSE, AND THERE MUST NEVER BE ONE AGAIN.
   *
   * This used to seed a per-network "texture" off hashSeed(seedKey) — a phase and rate per network,
   * wobbling the drive — so that "two concepts never look identical". The cost of that one cosmetic
   * line was the card's integrity: two hooks with the SAME room response produced DIFFERENT brains,
   * because the difference came from the card's id hash. A map you can change by renaming the card
   * is not a measurement of anything, and it is the reason the specimen had to be benched at rest.
   *
   * The response is now a pure function of the REAL signal (the stop-ratio, and in grounded mode the
   * audience's measured retention curve). Same room → same brain. Two hooks that land identically
   * SHOULD look identical: that is the model being honest about how much it actually knows.
   *
   * The `seed` prop on CortexCanvas survives and is fine — it drifts the parcel BOUNDARIES (spatial
   * texture, so the same map does not tile identically). It does not touch a single network value.
   */
  const wob = (_i: number) => 0;

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
    if (t < 0) return { ...RESTING_DRIVE };
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
 * The predicted BOLD at REST — the baseline every map is now painted against.
 *
 * A sustained drive `c` comes out of the convolution as `c · Σw` (the kernel is area-normalised over
 * |w|, and the undershoot is negative, so Σw < 1), then takes the same gain `predictedBold` applies.
 * Computed rather than asserted, so it cannot drift out of step with the kernel above it.
 */
const KERNEL_SUM = HRF_KERNEL.reduce((s, { w }) => s + w, 0);

export const RESTING_BOLD: Record<NetworkId, number> = (() => {
  const out = {} as Record<NetworkId, number>;
  for (const id of NETWORK_IDS) out[id] = clamp01(RESTING_DRIVE[id] * KERNEL_SUM * 1.12);
  return out;
})();

/**
 * ── THE CONTRAST. What an fMRI figure actually shows. ─────────────────────────────────────────────
 *
 * Not "activity" — a DIFFERENCE. Every statistical map you have ever seen is one condition minus
 * another (task minus rest, faces minus houses), thresholded, and it is mostly grey precisely because
 * most of the cortex is doing roughly what it always does. We were painting raw predicted BOLD, and
 * six of our seven networks are task-positive, so anything engaging lit 57% of the surface. That is a
 * true statement about the model and a false-looking picture of a brain.
 *
 * So: each network's response is expressed as the fraction of its OWN HEADROOM above its OWN resting
 * level. Normalising per network matters — the default-mode system idles at 0.42 while attention
 * idles at 0.08, so a raw subtraction would make attention look dramatic and the DMN look inert for
 * reasons that have nothing to do with the stimulus.
 *
 * ⚠️ IT IS SIGNED, AND THAT IS THE 2026-07-14 FIX. Below-rest values used to come back ZERO, on this
 * reasoning: "an activation map shows activations. Suppression is real (the DMN genuinely goes quiet
 * when you concentrate) but painting it would put a second meaning on the same colour, and the
 * accent-dosage rule is LOCKED."
 *
 * That was the design system overruling the physiology, and it cost us the entire cold half of the
 * map. A SUPPRESSED DEFAULT-MODE NETWORK IS THE SIGNATURE OF AN ENGAGED BRAIN — it is the most
 * reliable thing in the whole task-vs-rest literature, and clamping it to zero meant a diverging
 * colormap could only ever produce one sign. Measured before the fix: 100% of the specimen's coloured
 * pixels were warm, against 74%/26% warm/cool on the reference. The reference paints both signs and
 * says exactly what they mean — "negative is below its usual level for this clip; positive is above".
 * So do we now.
 */
export function contrastBold(bold: Record<NetworkId, number>): Record<NetworkId, number> {
  const out = {} as Record<NetworkId, number>;
  for (const id of NETWORK_IDS) {
    const rest = RESTING_BOLD[id];
    // Signed headroom: above rest normalises against the room left ABOVE it, below rest against the
    // room left BELOW it. Without the asymmetry a network that idles high (the DMN rests at 0.42)
    // would show a huge negative swing and a tiny positive one for the same physiological move.
    const d = bold[id] - rest;
    const headroom = d >= 0 ? d / Math.max(1e-6, 1 - rest) : d / Math.max(1e-6, rest);
    // Each tail is divided by the range THAT TAIL actually reaches. A network with no measured
    // suppression falls back to its positive scale, so a rare dip reads proportionally instead of
    // being amplified to full blue by a near-zero divisor.
    const denom =
      d >= 0 ? RESPONSE_P95[id] : Math.max(SUPPRESSION_P95[id], RESPONSE_P95[id]);
    const scaled = headroom / Math.max(1e-6, denom);
    out[id] = scaled < -1 ? -1 : scaled > 1 ? 1 : scaled;
  }
  return out;
}

/**
 * ── AND WHY THE CONTRAST IS THEN SCALED PER NETWORK. This is the part that took a measurement.
 *
 * A statistical map is not painted in raw signal — it is painted in a NORMALISED statistic (a z- or
 * t-map), where each unit is expressed relative to the variation that unit actually shows. Ours was
 * not, and the networks turn out to have wildly different reachable ranges. Measured, over every drive
 * the model produces (7 stop-ratios × 5 seeds × simulated + 3 retention slopes, sampled 25× each):
 *
 *      network            p95 contrast
 *      dorsal_attention        0.739
 *      visual                  0.724
 *      limbic                  0.603
 *      salience                0.509
 *      control                 0.386
 *      somatomotor             0.296
 *      default                 0.270   ← the one that matters most
 *
 * One threshold across those units is not one threshold at all: attention clears it easily while the
 * DEFAULT-MODE system — whose whole job on this card is to say "you are losing them" — mathematically
 * CANNOT, because its ceiling sits below the cut. That is exactly what happened: measured on a real
 * encounter where the audience visibly walks out, the map went 0.0% coral. The finding the card exists
 * to deliver had been silently removed, and every test still passed, because the tests asserted against
 * hand-written vectors far hotter than the model's real output.
 *
 * So each network's response is divided by the strongest response THAT network produces. A reading of
 * 1.0 now means the same thing everywhere: "this system is running about as hard as it ever runs."
 *
 * ⚠️ These are MEASURED CONSTANTS, not knobs. If the drive model in `neuralDrive` changes, they are
 * stale — re-measure them (the probe is trivial: sample contrastBold over a grid of drives and take
 * the p95). Do not hand-tune them to make the picture nicer.
 */
export const RESPONSE_P95: Record<NetworkId, number> = {
  visual: 0.724,
  somatomotor: 0.296,
  dorsal_attention: 0.739,
  salience: 0.509,
  limbic: 0.603,
  control: 0.386,
  default: 0.270,
};

/**
 * The SAME statistic for the other tail — how far below its own resting level each network actually
 * falls. It exists because the contrast became signed and the negative half had no scale of its own.
 *
 * ⚠️ THE TWO TAILS ARE NOT SYMMETRIC, and using RESPONSE_P95 for both is what pegged the default-mode
 * system at exactly −1.000 on every frame: full deep blue, permanently, with no dynamic range left to
 * report anything with. Measured over the same grid the positive constants come from (2 modes × 5
 * seeds × 7 stop-ratios × 4 retention curves × 25 timepoints):
 *
 *      network             p95 below rest
 *      default                  0.857   ← the only network that meaningfully suppresses
 *      control                  0.047
 *      everything else          0.000   ← never drops below rest at all
 *
 * That asymmetry is not a modelling artefact, it is the physiology: task-positive systems idle near
 * the floor and have nowhere to fall, while the default-mode system idles HIGH (rest 0.42) and its
 * suppression under load is the single most reliable effect in the task-vs-rest literature.
 */
export const SUPPRESSION_P95: Record<NetworkId, number> = {
  visual: 0.0,
  somatomotor: 0.0,
  dorsal_attention: 0.0,
  salience: 0.0,
  limbic: 0.0,
  control: 0.047,
  default: 0.857,
};

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
  const p4 = prng() * Math.PI * 2;
  const p5 = prng() * Math.PI * 2;
  // ── FIVE OCTAVES of smooth spatial noise → coherent hot/cold territories (the 2026-07-15 rebuild).
  //
  // Three octaves painted CONTINENTS — broad, low-frequency blobs. The reference
  // (thesapientcompany.com/intelligence) is fine-grained and mottled: small hot specks inside a warm
  // field, cool threads running through it. That grain is HIGH SPATIAL FREQUENCY, and the earlier
  // "smooth = real, everything else is fake" rule threw it away — which is the whole reason theirs
  // reads as a scan and ours read as gouache.
  //
  // ⚠️ THE FIX IS FREQUENCY, NOT RANDOMNESS. Per-parcel white noise (an independent draw per parcel)
  // hits the SAME grain but with hard borders — adjacent parcels jump, `maxSlopePerSpacing` blows past
  // the mosaic guard (measured 2.85 vs 1.0), and a mosaic is a different fake, not the reference. The
  // reference is high-frequency AND smooth: many small features, each transition gradual. So the two
  // added octaves (`× PARCEL_MOTTLE`) are FINER sinusoids over the parcel centroid — coherent, so a
  // speck is a real cluster, and low-slope, so no border hardens. They only resolve because
  // PARCEL_COUNT is high enough to sample them (at 400 they aliased into the very salt-and-pepper
  // this avoids); the blend radius stays SMOOTH (cortex-field `BLEND_R_IN_SPACINGS`), grain comes
  // from the parcel count, not from squeezing the kernel.
  const n =
    (Math.sin(cx * 0.042 + cy * 0.019 + p1) +
      0.8 * Math.sin(cx * -0.021 + cy * 0.048 + p2) +
      0.5 * Math.sin(cx * 0.075 + cy * 0.066 + p3) +
      PARCEL_MOTTLE * Math.sin(cx * 0.168 + cy * 0.142 + p4) +
      PARCEL_MOTTLE * 0.7 * Math.sin(cx * -0.246 + cy * 0.205 + p5)) /
    2.6; // → about −1..1
  return {
    // ── TUNING, and why it is a POWER curve rather than a flat band.
    //
    // `bias` is how strongly this parcel answers to its network. It used to be a flat 0.35…1.40, i.e.
    // the average parcel responded at about full strength — so when a network fired, most of the
    // cortex it owns lit up, and the map came out as broad continents of colour. Real cortex is not
    // like that: a given stimulus is carried by a MINORITY of parcels, because most of them are not
    // tuned to it. That selectivity — not the threshold — is what makes a real map sparse.
    //
    // Raising the smooth spatial noise to a power keeps the field smooth and contiguous (the same
    // sinusoids, so neighbours still agree — no salt-and-pepper speckle, which is the tell of a fake
    // map) while pushing the BULK of the distribution down: most parcels answer weakly, a few answer
    // hard, and the hot ones form clusters because the noise underneath them is spatial.
    //
    // ⚠️ Do not "fix" sparsity by raising ACTIVATION_THRESHOLD. That hides the response instead of
    // modelling it, and it was explicitly ruled out (handoff §14.5).
    bias: BIAS_MAX * Math.pow(clamp01(n * 0.5 + 0.5), SELECTIVITY),
    phase: rng() * Math.PI * 2,
    rate: 0.25 + rng() * 0.5,
    curv: rng(),
  };
}

/**
 * How selectively parcels answer their network. 1 = the old flat band (everything responds, the map
 * is continents); higher = fewer, hotter, more clustered parcels. MEASURED against the lit fraction
 * of the surface, which is the number that actually matters — see `cortex-field.test.ts`.
 */
const SELECTIVITY = 1.8;
const BIAS_MAX = 1.30;

/**
 * Amplitude of the two FINER octaves in `parcelTexture` — the map's fine grain. 0 = three-octave
 * continents; higher = more high-frequency territory, closer to the reference's mottled scan texture.
 *
 * ⚠️ THESE ARE SINUSOIDS, NOT RANDOM. Independent per-parcel draws hit the same grain but with hard
 * borders (`maxSlopePerSpacing` blew to 2.85 vs the 1.0 guard) — a mosaic, a different fake. Smooth
 * higher-frequency octaves add the frequency while keeping every transition gradual, so a speck is a
 * real cluster and no border hardens. They are only well-sampled because PARCEL_COUNT is high enough;
 * at 400 they aliased. Re-measure the render (dev-shot-brain) and the guard (cortex-field.test) after
 * any change to this or to the octave frequencies in `parcelTexture`.
 */
const PARCEL_MOTTLE = 0.5;

/**
 * The activation THRESHOLD. A real statistical map is thresholded — most of the cortex sits at
 * baseline gray and only the parcels that clear the threshold are painted. Colouring every parcel
 * is what makes a generated map look like stained glass instead of an fMRI.
 */
// 0.45 → 0.30. At 0.45 a typical hook cleared threshold on a single speck of cortex, which is the
// "no regions getting activated" the owner saw. TRIBE's clusters are LARGE and unmistakable; a
// statistical map is mostly grey, but where it fires it FIRES. Re-measure the lit-area % after any
// change to this (the map must not creep back toward painting the whole cortex — that was §9's bug).
export const ACTIVATION_THRESHOLD = 0.42;

/**
 * How far above the threshold a parcel must run to be painted at FULL colour.
 *
 * This is not cosmetic, and the rule is: THE RAMP MUST SPAN THE VALUES THAT ACTUALLY OCCUR.
 *
 * It was 0.3 against the old procedural surface, then 0.5 when the field ran to 0.97 — and 0.5 is now
 * WRONG again, for the third time, because the painted quantity changed underneath it. The map is a
 * normalised contrast now (`contrastBold`) and the field tops out around 0.8, so a 0.5 span meant that
 * a vertex which had just cleared the threshold painted at an alpha of about 0.004. It was "lit" in
 * every measurement and INVISIBLE on screen: 8% of the surface over threshold, 0.2% of the pixels
 * showing any colour at all. A map you can only see in a histogram is not a map.
 *
 * Measured against the values the field actually produces now (0.45 → ~0.80), so the supra-threshold
 * range gets the whole ramp rather than the first tenth of it.
 *
 * ⚠️ THIS CONSTANT IS DOWNSTREAM OF THE MODEL. If the response scale changes again, it is stale again
 * — and it goes stale SILENTLY, by making the map fade out rather than by making anything fail.
 */
// 0.3 → 0.6. The map came out ONE COLOUR (all yellow): s = (a − threshold) / span, so with a narrow
// span every voxel that cleared threshold clamped to s = 1 and took the TOP of the ramp. The
// red→orange→yellow gradient existed and was never reachable. Widen the span and the cluster gets a
// hot core and cooler shoulders — which is what an fMRI cluster actually looks like.
export const ACTIVATION_SPAN = 0.6;

/**
 * One parcel's predicted BOLD at time `t`, from its network's response and its own texture.
 *
 * ⚠️ IT CLAMPS TO [−1, 1], NOT [0, 1]. `contrastBold` is signed now (a network can run BELOW its own
 * resting level, and the default-mode system routinely does), and a `clamp01` here would silently
 * eat every one of those values — the diverging map would come back one-sided and nothing would
 * throw. That is precisely how this map spent seven rounds unable to reach its cold half.
 */
export function parcelValue(networkValue: number, tex: ParcelTexture, t: number): number {
  const v = networkValue * tex.bias + 0.05 * Math.sin(t * tex.rate + tex.phase);
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** Band a 0..1 value into one of four plain-language words. */
export const bandWord = (v: number, words: [string, string, string, string]) =>
  v < 0.25 ? words[0] : v < 0.5 ? words[1] : v < 0.72 ? words[2] : words[3];
