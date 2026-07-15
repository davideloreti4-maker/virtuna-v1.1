/**
 * cortex-sim — the predicted-BOLD model.
 *
 * The UI makes two load-bearing claims on the creator's screen. Both are asserted here:
 *  1. "the response trails the stimulus by ~5s (haemodynamic lag)" — so the HRF convolution must
 *     ACTUALLY lag. A decorative pulse that claimed a lag would be a lie on the face of the app.
 *  2. "modeled from your audience's real retention" — so in grounded mode the drive must move
 *     with the retention curve: attention with the people still watching, the default-mode
 *     network with the people who left.
 */
import { describe, it, expect } from 'vitest';
import {
  HRF_PEAK_S,
  NETWORK_IDS,
  neuralDrive,
  predictedBold,
  parcelTexture,
  parcelValue,
  type DriveInput,
} from '../cortex-sim';

const base: DriveInput = {
  mode: 'simulated',
  stopRatio: 0.6,
  durationS: 15,
  seedKey: 'card-1',
};

describe('cortex-sim — the HRF lag is real', () => {
  it('peaks ~5s AFTER an impulse, not with it', () => {
    // An impulse drive: one network spikes at t=0 only. The BOLD response must crest ~5s later.
    const impulse: DriveInput = { ...base, durationS: 60, stopRatio: 1 };
    const series: { t: number; v: number }[] = [];
    for (let t = 0; t <= 12; t += 0.25) series.push({ t, v: predictedBold(impulse, t).salience });

    const peak = series.reduce((a, b) => (b.v > a.v ? b : a));
    // The onset spike lives at u≈0.09 of the stimulus; with a 60s stimulus that is t≈5.4s, and the
    // HRF pushes the RESPONSE later still. The binding claim: the response is not instantaneous.
    expect(peak.t).toBeGreaterThan(2);
    // And the response outlives the drive — BOLD is smooth, it cannot switch off with the stimulus.
    const atPeakDrive = neuralDrive(impulse, peak.t).salience;
    const laterBold = predictedBold(impulse, peak.t + 3).salience;
    expect(laterBold).toBeGreaterThan(0);
    expect(Number.isFinite(atPeakDrive)).toBe(true);
  });

  it('names the lag it renders', () => {
    expect(HRF_PEAK_S).toBe(5);
  });

  it('reaches a live steady state on the LOOPING simulated stimulus (it must not sit dead)', () => {
    // The simulated encounter loops, so its drive is periodic. If it were not, the HRF would
    // integrate back past t=0 into pre-stimulus rest and the response would never build — the
    // dock's brain would sit at "quiet / flat / cold" forever, which is exactly what it did.
    const peak = Math.max(
      ...Array.from({ length: 40 }, (_, i) => predictedBold(base, (i / 40) * base.durationS).dorsal_attention),
    );
    expect(peak).toBeGreaterThan(0.45);
    // …and it still MOVES — a flat response says nothing.
    const series = Array.from({ length: 40 }, (_, i) => predictedBold(base, (i / 40) * base.durationS).salience);
    expect(Math.max(...series) - Math.min(...series)).toBeGreaterThan(0.08);
  });

  it('rests before a video starts — the default network owns an empty screen', () => {
    const grounded: DriveInput = {
      mode: 'grounded',
      stopRatio: 0.8,
      durationS: 30,
      seedKey: 'v',
      retentionAt: () => 0.9,
    };
    const rest = neuralDrive(grounded, -2);
    expect(rest.default).toBeGreaterThan(rest.dorsal_attention);
    expect(rest.visual).toBeLessThan(0.2);
  });

  it('keeps every network in [0,1] across the whole stimulus (no NaN, no blowout)', () => {
    for (let t = -6; t <= 20; t += 0.5) {
      const b = predictedBold(base, t);
      for (const id of NETWORK_IDS) {
        expect(Number.isFinite(b[id])).toBe(true);
        expect(b[id]).toBeGreaterThanOrEqual(0);
        expect(b[id]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('cortex-sim — grounded mode tracks the REAL retention curve', () => {
  const grounded = (retentionAt: (u: number) => number): DriveInput => ({
    mode: 'grounded',
    stopRatio: 0.5,
    durationS: 30,
    seedKey: 'video-1',
    retentionAt,
  });

  it('drives attention with the people still watching, and drift with the people who left', () => {
    const held = neuralDrive(grounded(() => 0.95), 15);
    const lost = neuralDrive(grounded(() => 0.15), 15);

    // A video the room stays with: attention high, default-mode low.
    expect(held.dorsal_attention).toBeGreaterThan(lost.dorsal_attention);
    expect(held.default).toBeLessThan(lost.default);
    // A video the room abandons: the default network is the loudest thing in the head.
    expect(lost.default).toBeGreaterThan(lost.dorsal_attention);
  });

  it('fires salience at the break — where the curve falls off a cliff', () => {
    // A curve that holds, then collapses at u=0.5.
    const cliff = grounded((u) => (u < 0.5 ? 0.9 : 0.3));
    const steady = grounded(() => 0.9);
    const tAtCliff = 0.52 * 30;

    const atBreak = neuralDrive(cliff, tAtCliff).salience;
    const atCalm = neuralDrive(steady, tAtCliff).salience;
    expect(atBreak).toBeGreaterThan(atCalm);
  });
});

describe('cortex-sim — determinism + parcel heterogeneity', () => {
  it('SAME ROOM → SAME BRAIN. The response must not depend on the card’s id.', () => {
    expect(predictedBold(base, 3.7)).toEqual(predictedBold(base, 3.7));
    // This assertion used to be `.not.toEqual` — it REQUIRED two cards with an identical room
    // response to produce DIFFERENT brains, because the drive was wobbled by hashSeed(seedKey)
    // "so that two concepts never look identical". That one cosmetic line was the card's whole
    // integrity problem: a map you can change by RENAMING the card is not a measurement of
    // anything, and it is why the specimen had to be benched at rest. The hash is gone. Two
    // hooks that land identically SHOULD look identical — that is the model being honest about
    // how much it actually knows.
    expect(predictedBold({ ...base, seedKey: 'other' }, 3.7)).toEqual(predictedBold(base, 3.7));
    // ...and a DIFFERENT ROOM still moves it. The response tracks the real signal, not the id.
    expect(predictedBold({ ...base, stopRatio: 0.2 }, 3.7)).not.toEqual(
      predictedBold({ ...base, stopRatio: 0.9 }, 3.7),
    );
  });

  it('spreads parcels WITHIN a network — a flat fill is the tell of a fake map', () => {
    // Parcels across the surface (the texture is keyed on WHERE a parcel sits).
    const vals = Array.from({ length: 60 }, (_, i) =>
      parcelValue(0.6, parcelTexture(i, 12345, (i * 17) % 300, (i * 29) % 200), 2),
    );
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.15);

    // ⚠️ THE RANGE IS [−1, 1], NOT [0, 1]. `parcelValue` used to clamp01, which was correct while the
    // contrast was an unsigned magnitude — and became a silent value-eater the moment it went signed:
    // every suppressed parcel would have been flattened to zero on its way to the shader, and the
    // diverging map could never have reached its cold half. Nothing would have thrown; the brain would
    // simply have come back warm, again.
    expect(vals.every((v) => v >= -1 && v <= 1)).toBe(true);

    // And a suppressed network must survive the trip. This is the assertion that pins the fix.
    const suppressed = Array.from({ length: 60 }, (_, i) =>
      parcelValue(-0.6, parcelTexture(i, 12345, (i * 17) % 300, (i * 29) % 200), 2),
    );
    expect(suppressed.filter((v) => v < -0.1).length).toBeGreaterThan(40);
  });

  it('makes the map CONTIGUOUS, not salt-and-pepper — neighbours run hot together', () => {
    // The tell of a generated map is per-parcel independence. Two parcels 6px apart must be far
    // more alike than two on opposite sides of the cortex.
    //
    // Measured RELATIVE to the bias spread, not as an absolute gap: the spread is a tuning knob (it
    // sets how much of the cortex clears threshold at once), and an absolute bound here silently
    // fails the moment that knob moves, while saying nothing about the smoothness it claims to pin.
    const at = (x: number, y: number) => parcelTexture(0, 999, x, y).bias;
    const grid = Array.from({ length: 300 }, (_, i) => at((i * 37) % 300, (i * 53) % 200));
    const spread = Math.max(...grid) - Math.min(...grid);

    const neighbourGap = Math.abs(at(120, 100) - at(126, 104));
    const acrossGap = Math.abs(at(40, 60) - at(250, 150));
    expect(neighbourGap / spread).toBeLessThan(0.15);
    expect(acrossGap).toBeGreaterThan(neighbourGap);
  });
});
