import { describe, expect, it } from "vitest";
import type { FaceSample, Pause, PictureSample, TakeAnalysis } from "../../analysis";
import { MONO_SAT, QUIET_READ, measuresOf, pauseFor } from "../measures";

/* ── made-up analyses ──────────────────────────────────────────────────────────────────────────── */

const pause = (startMs: number, endMs: number): Pause => ({ startMs, endMs, cutMs: Math.round((startMs + endMs) / 2) });
/** A picture every 500 ms over `ms`, each sample as `at` gives it. */
const pictureOf = (ms: number, at: (t: number, i: number) => Omit<PictureSample, "ms">): PictureSample[] =>
  Array.from({ length: Math.floor(ms / 500) + 1 }, (_, i) => ({ ms: i * 500, ...at(i * 500, i) }));
const NATURAL = pictureOf(30_000, () => ({ luma: 0.48, sat: 0.068, warmth: 0.066 }));
/** Five face samples a second over `ms`, the face `h` high at each moment. */
const facesOf = (ms: number, h: (t: number) => number | null): FaceSample[] =>
  Array.from({ length: ms / 200 }, (_, i) => {
    const height = h(i * 200);
    return { ms: i * 200, face: height === null ? null : { x: 0.3, y: 0.3, w: 0.4, h: height }, mouth: null };
  });
const analysis = (over: Partial<TakeAnalysis> = {}): TakeAnalysis => ({ language: "en", pauses: [], faces: [], loudness: null, cuts: [], picture: NATURAL, ...over });

describe("measuresOf: the pace", () => {
  it("takes the median of the pauses between words, [300, 500, 200], as 300, leaving out the head and the tail", () => {
    const pauses = [pause(0, 900), pause(2000, 2300), pause(5000, 5500), pause(8000, 8200), pause(9600, 10_012)];
    expect(measuresOf(analysis({ pauses }), 10_000).pauseMs).toBe(300);
  });

  it("averages the two middle pauses of an even count, and clamps to tighten's 120 to 400", () => {
    expect(measuresOf(analysis({ pauses: [pause(1000, 1200), pause(3000, 3300)] }), 10_000).pauseMs).toBe(250);
    expect(measuresOf(analysis({ pauses: [pause(1000, 1700), pause(3000, 3900)] }), 10_000).pauseMs).toBe(400);
    expect(measuresOf(analysis({ pauses: [pause(1000, 1121), pause(3000, 3121)] }), 10_000).pauseMs).toBe(121);
  });

  it("without words heard, leaves out a pause beside a stretch of speech that holds a cut", () => {
    // Speech 0-2000, pause 2000-2600 (600), speech 2600-5000 holding a cut at 4000, pause 5000-5200 (200), speech 5200-7000,
    // pause 7000-7300 (300), speech to the end. Only the last pause has cut-free speech on both sides.
    const pauses = [pause(2000, 2600), pause(5000, 5200), pause(7000, 7300)];
    expect(measuresOf(analysis({ language: null, pauses, cuts: [4000] }), 10_000).pauseMs).toBe(300);
    // With words, every pause between them counts: the median of 600, 200 and 300.
    expect(measuresOf(analysis({ language: "en", pauses, cuts: [4000] }), 10_000).pauseMs).toBe(300);
    expect(measuresOf(analysis({ language: "en", pauses: [pause(2000, 2600), pause(5000, 5200)], cuts: [4000] }), 10_000).pauseMs).toBe(400);
    expect(measuresOf(analysis({ language: null, pauses: [pause(2000, 2600), pause(5000, 5200)], cuts: [4000] }), 10_000).pauseMs).toBe(400);
  });

  it("gives the default style's pause when there is none between phrases", () => {
    expect(measuresOf(analysis({ pauses: [pause(0, 500)] }), 10_000).pauseMs).toBe(250);
  });

  it("counts 10 cuts in 30 s as 20 a minute", () => {
    const cuts = Array.from({ length: 10 }, (_, i) => 1500 + i * 3000);
    expect(measuresOf(analysis({ cuts }), 30_000).cutsPerMin).toBe(20);
  });

  it("refuses an analysis made before part 3, with no cuts or picture", () => {
    expect(() => measuresOf({ language: "en", pauses: [], faces: [], loudness: null }, 10_000)).toThrow(/no cuts or picture/);
  });
});

describe("measuresOf: the quiet share (X104)", () => {
  const read = (share: number) => Math.round(Math.min(0.6, share * QUIET_READ) * 1000) / 1000;

  it("is the inner pauses' total over the spoken span, from the head's end to the tail's start, read up by QUIET_READ, 3 places", () => {
    // Head 0-900, inner 300 + 500 + 200, tail 9600 to the end: 1000 ms quiet in 8700 ms spoken.
    const pauses = [pause(0, 900), pause(2000, 2300), pause(5000, 5500), pause(8000, 8200), pause(9600, 10_012)];
    expect(measuresOf(analysis({ pauses }), 10_000).quiet).toBe(read(1000 / 8700));
    // No head and no tail: the span is the whole reference.
    expect(measuresOf(analysis({ pauses: [pause(2000, 2300), pause(5000, 5500)] }), 10_000).quiet).toBe(read(0.08));
  });

  it("counts every inner pause, with or without words, and is null with no pause at all", () => {
    const pauses = [pause(2000, 2600), pause(5000, 5200), pause(7000, 7300)];
    expect(measuresOf(analysis({ language: null, pauses, cuts: [4000] }), 10_000).quiet).toBe(read(0.11));
    expect(measuresOf(analysis({ pauses: [] }), 10_000).quiet).toBeNull();
  });

  it("reads a finished film's sound up by the median of the six ground-truth films' ratios, 1.47, and holds it to 0.6", () => {
    expect(QUIET_READ).toBe(1.47);
    // 5000 ms of pause in 8000 spoken (0.625) would read 0.92: held to the profile's 0.6.
    expect(measuresOf(analysis({ pauses: [pause(1000, 3500), pause(5000, 7500)] }), 8000).quiet).toBe(0.6);
  });
});

describe("pauseFor: the cap that brings a take to a quiet share", () => {
  const span = { fromMs: 0, toMs: 10_000 };
  it("finds the cap whose cut brings the share nearest: two 1000 ms pauses in 10 s to 0.05 is 210", () => {
    // After the cut at c: 2c / (10 000 − 2 (1000 − c)); 210 gives 0.0499, 220 gives 0.0521.
    expect(pauseFor([pause(2000, 3000), pause(6000, 7000)], span, 0.05)).toBe(210);
  });

  it("gives 400 for a take already tighter than the target (every cap ties, the larger wins), and 120 where it cannot get as tight", () => {
    expect(pauseFor([pause(2000, 2150), pause(6000, 6130)], span, 0.1)).toBe(400);
    expect(pauseFor([pause(1000, 3000), pause(4000, 6000), pause(7000, 9000)], span, 0.01)).toBe(120);
  });

  it("cuts only the pauses inside the span: a head before it is not counted", () => {
    expect(pauseFor([pause(0, 2000), pause(4000, 5000), pause(7000, 8000)], { fromMs: 2000, toMs: 10_000 }, 0.05)).toBe(pauseFor([pause(4000, 5000), pause(7000, 8000)], { fromMs: 2000, toMs: 10_000 }, 0.05));
    expect(pauseFor([pause(4000, 5000), pause(7000, 8000)], { fromMs: 2000, toMs: 10_000 }, 0.05)).toBe(160);
  });
});

describe("measuresOf: the punch-ins", () => {
  it("finds one punch-in at zoom 1.2 where the face's height goes from 0.30 to 0.36 across a cut", () => {
    const faces = facesOf(30_000, (t) => (t < 6000 ? 0.3 : 0.36));
    expect(measuresOf(analysis({ faces, cuts: [6000] }), 30_000).punchIns).toEqual({ perMin: 2, zoom: 1.2 });
  });

  it("reads the face 100 ms after the cut against 100 ms before it, so a face still settling at the cut is not read", () => {
    // The face grows only from 6000; the samples at 5800 (before 5900) and 6200 (from 6100) are what is compared.
    const faces = facesOf(30_000, (t) => (t < 5900 ? 0.3 : t < 6100 ? 0.5 : 0.36));
    expect(measuresOf(analysis({ faces, cuts: [6000] }), 30_000).punchIns).toEqual({ perMin: 2, zoom: 1.2 });
  });

  it("counts ratios of 1.12 and up only, takes their median, held to the kit's 1.05 to 1.3", () => {
    // Cuts at 5, 10, 15 and 20 s: a ratio of 1.1 (not one), 1.5 (one, held to 1.3) and back out, then 1.15 (one).
    const h = (t: number) => (t < 5000 ? 0.3 : t < 10_000 ? 0.33 : t < 15_000 ? 0.495 : t < 20_000 ? 0.3 : 0.345);
    expect(measuresOf(analysis({ faces: facesOf(30_000, h), cuts: [5000, 10_000, 15_000, 20_000] }), 30_000).punchIns).toEqual({ perMin: 4, zoom: 1.3 });
  });

  it("compares with the last face before the cut, at most 8 s back, where the shot before has none (a cutaway)", () => {
    // No face from 4 s to the cut at 6 s: the face at 3.8 s (0.30) against the one after (0.36).
    const gap = facesOf(30_000, (t) => (t < 4000 ? 0.3 : t < 6000 ? null : 0.36));
    expect(measuresOf(analysis({ faces: gap, cuts: [6000] }), 30_000).punchIns).toEqual({ perMin: 2, zoom: 1.2 });
    // The last face 9.2 s before the cut: too far back.
    const far = facesOf(30_000, (t) => (t < 1000 ? 0.3 : t < 10_000 ? null : 0.36));
    expect(measuresOf(analysis({ faces: far, cuts: [10_000] }), 30_000).punchIns).toBeNull();
  });

  it("takes the first face inside the shot after the cut, at most 2 s in, where the shot opens on something else", () => {
    // Films 2 and 5: the punched shot opens on a laptop, and the face comes 0.8 s in.
    const late = (comesAt: number) => facesOf(30_000, (t) => (t < 4000 ? 0.3 : t < comesAt ? null : 0.36));
    expect(measuresOf(analysis({ faces: late(6800), cuts: [6000, 12_000] }), 30_000).punchIns).toEqual({ perMin: 2, zoom: 1.2 });
    // 2.4 s in: too late to be the shot's opening framing.
    expect(measuresOf(analysis({ faces: late(8400), cuts: [6000, 12_000] }), 30_000).punchIns).toBeNull();
    // A face only after the next cut is that shot's: counted at its own cut, once, not at the cut before (else 4 a minute).
    expect(measuresOf(analysis({ faces: late(7000), cuts: [6000, 6500] }), 30_000).punchIns).toEqual({ perMin: 2, zoom: 1.2 });
  });

  it("reads a cut as a punch-in only within one scene: the picture alike on both sides, the face at most 1.5 larger (Task 9c)", () => {
    const faces = facesOf(30_000, (t) => (t < 6000 ? 0.3 : 0.36));
    const across = (after: Omit<PictureSample, "ms">) => pictureOf(30_000, (t) => (t < 6000 ? { luma: 0.48, sat: 0.068, warmth: 0.066 } : after));
    // Alike (luma within 0.06, saturation and warmth within 0.03): one punch-in.
    expect(measuresOf(analysis({ faces, cuts: [6000], picture: across({ luma: 0.53, sat: 0.09, warmth: 0.08 }) }), 30_000).punchIns).toEqual({ perMin: 2, zoom: 1.2 });
    // Another scene: brighter, more saturated or warmer by more than that.
    expect(measuresOf(analysis({ faces, cuts: [6000], picture: across({ luma: 0.55, sat: 0.068, warmth: 0.066 }) }), 30_000).punchIns).toBeNull();
    expect(measuresOf(analysis({ faces, cuts: [6000], picture: across({ luma: 0.48, sat: 0.11, warmth: 0.066 }) }), 30_000).punchIns).toBeNull();
    expect(measuresOf(analysis({ faces, cuts: [6000], picture: across({ luma: 0.48, sat: 0.068, warmth: 0.1 }) }), 30_000).punchIns).toBeNull();
    // A face 1.6 times larger: another shot (Task 11's reference 5, B-roll of other people).
    expect(measuresOf(analysis({ faces: facesOf(30_000, (t) => (t < 6000 ? 0.2 : 0.32)), cuts: [6000] }), 30_000).punchIns).toBeNull();
  });

  it("is null with no face found, and with none punched in", () => {
    expect(measuresOf(analysis({ faces: facesOf(30_000, () => null), cuts: [6000] }), 30_000).punchIns).toBeNull();
    expect(measuresOf(analysis({ faces: facesOf(30_000, () => 0.3), cuts: [6000] }), 30_000).punchIns).toBeNull();
    // A cut where the face is missing on one side is not read.
    expect(measuresOf(analysis({ faces: facesOf(30_000, (t) => (t < 6000 ? null : 0.36)), cuts: [6000] }), 30_000).punchIns).toBeNull();
  });
});

describe("measuresOf: the look", () => {
  const lookOf = (picture: PictureSample[]) => measuresOf(analysis({ picture }), 30_000).look;

  it("reads a picture whose mean saturation is under 0.012 as mono, and any other as nothing (Task 9c)", () => {
    expect(MONO_SAT).toBe(0.012);
    expect(lookOf(pictureOf(30_000, () => ({ luma: 0.5, sat: 0.004, warmth: -0.002 })))).toBe("mono");
    // Task 11's reference 1, a dim colour video: mean saturation 0.024, read mono under 0.03.
    expect(lookOf(pictureOf(30_000, () => ({ luma: 0.3, sat: 0.024, warmth: 0.01 })))).toBeNull();
    // The mean over the film: a grey film with one coloured second is still mono.
    expect(lookOf(pictureOf(30_000, (t) => ({ luma: 0.5, sat: t < 1000 ? 0.2 : 0.005, warmth: 0 })))).toBe("mono");
  });

  it("reads the kit's six looks, at their measured saturations, as mono for mono only", () => {
    const at = (sat: number) => pictureOf(30_000, () => ({ luma: 0.478, sat, warmth: 0 }));
    expect([0.068, 0.0979, 0.0836, 0.0615, 0.0051, 0.0565].map((sat) => lookOf(at(sat)))).toEqual([null, null, null, null, "mono", null]);
  });

  it("reads no look from a picture with no sample", () => {
    expect(lookOf([])).toBeNull();
  });

  it("gives the reference's length back", () => {
    expect(measuresOf(analysis(), 30_000).ms).toBe(30_000);
  });
});
