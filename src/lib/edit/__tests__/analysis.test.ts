import { describe, expect, it } from "vitest";
import { analysisOf } from "../analysis";
import { takeRow } from "../worker/__tests__/rows";

/** A take row's analysis as the worker writes it (X62): its copies, its counts, and what review reads. Made up. */
const analysed = (over: Record<string, unknown> = {}) => ({
  files: { full: "u/a/takes/b/full.mp4", preview: "u/a/takes/b/preview.mp4", poster: "u/a/takes/b/poster.jpg" },
  language: "de",
  untimed: 0, apart: 1, gaveWay: 0, trimmed: 0, dropped: 0, fellBack: null,
  pauses: [{ startMs: 0, endMs: 400, cutMs: 210 }, { startMs: 2100, endMs: 2500, cutMs: 2330 }],
  faces: [
    { ms: 0, face: { x: 0.2, y: 0.3, w: 0.55, h: 0.4 }, mouth: { x: 0.38, y: 0.6, w: 0.2, h: 0.05 } },
    { ms: 200, face: null, mouth: null },
  ],
  loudness: { lufs: -19.4, truePeak: -2.1, levels: [{ ms: 0, lufs: -70 }, { ms: 500, lufs: -18.2 }] },
  ...over,
});

describe("a take's analysis, read from its row", () => {
  it("reads the pauses, the faces, the loudness and the language, and leaves the rest of the row", () => {
    expect(analysisOf(takeRow({ analysis: analysed() }))).toEqual({
      language: "de",
      pauses: [{ startMs: 0, endMs: 400, cutMs: 210 }, { startMs: 2100, endMs: 2500, cutMs: 2330 }],
      faces: [
        { ms: 0, face: { x: 0.2, y: 0.3, w: 0.55, h: 0.4 }, mouth: { x: 0.38, y: 0.6, w: 0.2, h: 0.05 } },
        { ms: 200, face: null, mouth: null },
      ],
      loudness: { lufs: -19.4, truePeak: -2.1, levels: [{ ms: 0, lufs: -70 }, { ms: 500, lufs: -18.2 }] },
    });
  });

  it("reads a take with no sound: no language, no pauses, no loudness", () => {
    expect(analysisOf(takeRow({ analysis: analysed({ language: null, pauses: [], faces: [], loudness: null }) }))).toEqual({ language: null, pauses: [], faces: [], loudness: null });
  });

  it("refuses a row with no analysis, naming the take", () => {
    expect(() => analysisOf(takeRow({ id: "t-none", analysis: null }))).toThrow(/take t-none.*no analysis/);
  });

  it("refuses a face box outside the picture, naming the field", () => {
    const faces = [{ ms: 0, face: { x: 1.2, y: 0.3, w: 0.5, h: 0.4 }, mouth: null }];
    expect(() => analysisOf(takeRow({ analysis: analysed({ faces }) }))).toThrow(/faces\.0\.face\.x/);
  });

  it("refuses a box that reaches past the picture's edge", () => {
    const faces = [{ ms: 0, face: null, mouth: { x: 0.5, y: 0.9, w: 0.2, h: 0.2 } }];
    expect(() => analysisOf(takeRow({ analysis: analysed({ faces }) }))).toThrow(/faces\.0\.mouth/);
  });

  it("holds a box the worker rounded to four places at the edge", () => {
    const faces = [{ ms: 0, face: { x: 0.3334, y: 0.0001, w: 0.6666, h: 0.9999 }, mouth: null }];
    expect(analysisOf(takeRow({ analysis: analysed({ faces }) })).faces).toEqual(faces);
  });

  it("refuses a pause whose cut is outside it, and pauses or samples out of order, naming the field", () => {
    expect(() => analysisOf(takeRow({ analysis: analysed({ pauses: [{ startMs: 100, endMs: 400, cutMs: 500 }] }) }))).toThrow(/pauses\.0\.cutMs/);
    expect(() => analysisOf(takeRow({ analysis: analysed({ pauses: [{ startMs: 900, endMs: 1000, cutMs: 950 }, { startMs: 100, endMs: 400, cutMs: 200 }] }) }))).toThrow(/pauses\.1/);
    expect(() => analysisOf(takeRow({ analysis: analysed({ faces: [{ ms: 200, face: null, mouth: null }, { ms: 200, face: null, mouth: null }] }) }))).toThrow(/faces\.1\.ms/);
  });

  it("reads the cuts and the picture where the worker measured them (part 3, X97)", () => {
    const picture = [{ ms: 0, luma: 0.42, sat: 0.31, warmth: 0.12 }, { ms: 500, luma: 0.063, sat: 0, warmth: -0.51 }];
    const read = analysisOf(takeRow({ analysis: analysed({ cuts: [1033, 2500], picture }) }));
    expect(read.cuts).toEqual([1033, 2500]);
    expect(read.picture).toEqual(picture);
  });

  it("reads a take analysed before the cuts and the picture were measured, with neither", () => {
    const read = analysisOf(takeRow({ analysis: analysed() }));
    expect(read).not.toHaveProperty("cuts");
    expect(read).not.toHaveProperty("picture");
  });

  it("reads a take of one shot: no cuts", () => {
    expect(analysisOf(takeRow({ analysis: analysed({ cuts: [], picture: [] }) }))).toMatchObject({ cuts: [], picture: [] });
  });

  it("refuses cuts out of order or not in whole ms, naming the field", () => {
    expect(() => analysisOf(takeRow({ analysis: analysed({ cuts: [2500, 1033] }) }))).toThrow(/cuts\.1/);
    expect(() => analysisOf(takeRow({ analysis: analysed({ cuts: [1033, 1033] }) }))).toThrow(/cuts\.1/);
    expect(() => analysisOf(takeRow({ analysis: analysed({ cuts: [10.5] }) }))).toThrow(/cuts\.0/);
  });

  it("refuses a picture sample out of its range or out of order, naming the field", () => {
    const at = (over: Record<string, number>) => ({ ms: 0, luma: 0.5, sat: 0.5, warmth: 0, ...over });
    expect(() => analysisOf(takeRow({ analysis: analysed({ picture: [at({ luma: 1.2 })] }) }))).toThrow(/picture\.0\.luma/);
    expect(() => analysisOf(takeRow({ analysis: analysed({ picture: [at({ sat: -0.1 })] }) }))).toThrow(/picture\.0\.sat/);
    expect(() => analysisOf(takeRow({ analysis: analysed({ picture: [at({ warmth: -1.5 })] }) }))).toThrow(/picture\.0\.warmth/);
    expect(() => analysisOf(takeRow({ analysis: analysed({ picture: [at({ ms: 500 }), at({ ms: 500 })] }) }))).toThrow(/picture\.1\.ms/);
  });

  it("refuses a row whose analysis lacks what review reads", () => {
    const { faces: _faces, ...rest } = analysed();
    expect(() => analysisOf(takeRow({ analysis: rest }))).toThrow(/faces/);
  });
});
