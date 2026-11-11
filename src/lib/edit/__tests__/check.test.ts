/**
 * check.test.ts — what follows from an EditSpec, and the rules zod cannot say.
 *
 * Every `checkEditSpec` rule gets a document that breaks exactly that rule, so a rule that stops
 * firing is seen here and not as a film that renders wrong.
 */
import { describe, expect, it } from "vitest";
import { checkEditSpec } from "../check";
import { compile } from "../compile";
import { frameOf, starts, total, windowOf } from "../derive";
import { newSegment } from "../spec";
import { minSourceMs } from "../time";
import { filmFaults } from "./film-rules";
import { file, fixture } from "./fixture";

describe("derive", () => {
  it("places segments end to end", () => {
    expect(starts(fixture())).toEqual([0, 56, 103, 163, 208, 298]);
    expect(total(fixture())).toBe(298);
  });

  it("gives a segment its place on the film and in its source", () => {
    expect(windowOf(fixture(), 1)).toEqual({ start: 56, atMs: 1866, lenMs: 1567, inMs: 1866, usedMs: 1567 });
    expect(windowOf(fixture(), 3)).toEqual({ start: 163, atMs: 5433, lenMs: 1500, inMs: 0, usedMs: 0 });
  });

  it("never gives a source window longer than its file", () => {
    /* 4 frames from frame 5 last 134 ms; from 12567 they fit the take's 12700 ms by minSourceMs (133) */
    const spec = fixture();
    spec.main = [newSegment({ id: "lead", asset: "photo", len: 5 }), newSegment({ id: "a", asset: "take", len: 4, inMs: 12567 }), ...spec.main];
    expect(checkEditSpec(spec)).toEqual([]);
    const tight = windowOf(spec, 1);
    expect(tight.inMs + tight.usedMs).toBeLessThanOrEqual(spec.assets.take!.ms!);
    expect(tight).toEqual({ start: 5, atMs: 166, lenMs: 134, inMs: 12567, usedMs: 133 });
    /* with room to spare, the window is the clip's span */
    spec.main[1]!.inMs = 12500;
    expect(windowOf(spec, 1)).toEqual({ start: 5, atMs: 166, lenMs: 134, inMs: 12500, usedMs: 134 });
  });

  it("counts a pinned item from its segment and an unpinned one from the film's start", () => {
    const spec = fixture();
    expect(frameOf(spec, { pin: "s2", at: 0 })).toBe(56);
    expect(frameOf(spec, { pin: null, at: 250 })).toBe(250);
    expect(frameOf(spec, { pin: "gone", at: 0 })).toBeNull();
  });
});

describe("checkEditSpec", () => {
  const codes = (spec: ReturnType<typeof fixture>): string[] => checkEditSpec(spec).map((p) => p.code);

  it("passes the fixture", () => {
    expect(checkEditSpec(fixture())).toEqual([]);
  });

  it("asset-key: an asset stored under another id", () => {
    const spec = fixture();
    spec.assets.take!.id = "other";
    expect(codes(spec)).toContain("asset-key");
  });

  it("generator-missing: a generated asset that names no generator", () => {
    const spec = fixture();
    spec.assets.take!.origin = "generated";
    expect(codes(spec)).toEqual(["generator-missing"]);
    spec.assets.take!.generator = "heygen";
    expect(codes(spec)).toEqual([]);
  });

  it("asset-facts: a picture with no size, a video with no length", () => {
    const size = fixture();
    delete size.assets.photo!.w;
    expect(codes(size)).toEqual(["asset-facts"]);
    const length = fixture();
    delete length.assets.broll!.ms;
    expect(codes(length)).toContain("asset-facts");
  });

  it("asset-missing and asset-kind: a segment that names nothing, or a sound", () => {
    const missing = fixture();
    missing.main[0]!.asset = "nope";
    expect(codes(missing)).toEqual(["asset-missing"]);
    const kind = fixture();
    kind.main[0]!.asset = "song";
    expect(codes(kind)).toEqual(["asset-kind"]);
    const sound = fixture();
    sound.sounds[0]!.asset = "take";
    expect(codes(sound)).toEqual(["asset-kind"]);
  });

  it("source-overrun: a segment that takes more than its file holds", () => {
    const spec = fixture();
    spec.main[4]!.inMs = 9800; // 90 frames = 3000 ms from 9800 runs past 12700
    expect(codes(spec)).toEqual(["source-overrun"]);
    const exact = fixture();
    exact.main[4]!.inMs = 9700; // ends on the file's last millisecond
    expect(codes(exact)).toEqual([]);
  });

  it("source-overrun: whether a clip fits its file does not depend on where it sits", () => {
    const take = fixture().assets.take!.ms!;
    for (const speed of [0.25, 0.5, 1, 1.5, 2, 4]) {
      for (const len of [3, 4, 5, 7, 10, 47]) {
        const latest = take - minSourceMs(len, speed); // the latest in-point of the take that fits
        /* a segment starts at 0 or after a lead of 3 frames or more: 3 to 8 hold every kind of start (a frame's millisecond repeats every 3 frames) */
        for (const lead of [0, 3, 4, 5, 6, 7, 8]) {
          const placed = (inMs: number): ReturnType<typeof fixture> => {
            const spec = fixture();
            const leading = lead ? [newSegment({ id: "lead", asset: "photo", len: lead })] : [];
            spec.main = [...leading, { ...newSegment({ id: "a", asset: "take", len, inMs }), speed }, ...spec.main];
            return spec;
          };
          const where = `segment, speed ${speed}, ${len} frames from frame ${lead}`;
          expect(codes(placed(latest)), where).toEqual([]);
          expect(codes(placed(latest + 1)), where).toEqual(["source-overrun"]);
          expect(filmFaults(placed(latest), compile(placed(latest), { file })), where).toEqual([]);
        }
        /* a layer may sit on any frame */
        for (let at = 0; at <= 5; at++) {
          const layered = (inMs: number): ReturnType<typeof fixture> => {
            const spec = fixture();
            spec.layers.push({ ...spec.layers[0]!, id: "v", kind: "clip", asset: "take", at, len, inMs, speed });
            return spec;
          };
          const where = `layer, speed ${speed}, ${len} frames from frame ${at}`;
          expect(codes(layered(latest)), where).toEqual([]);
          expect(codes(layered(latest + 1)), where).toEqual(["source-overrun"]);
          expect(filmFaults(layered(latest), compile(layered(latest), { file })), where).toEqual([]);
        }
      }
    }
  });

  it("pin-missing: a text pinned to a segment that is not there", () => {
    const spec = fixture();
    spec.texts[0]!.pin = "gone";
    expect(codes(spec)).toEqual(["pin-missing"]);
  });

  it("fix-missing: a correction for a word the asset does not have", () => {
    const spec = fixture();
    spec.captions.fixes.take!["99"] = "x";
    expect(codes(spec)).toEqual(["fix-missing"]);
    const silent = fixture();
    silent.captions.fixes.broll = { "0": "x" };
    expect(codes(silent)).toEqual(["fix-missing"]);
  });

  it("dup-id: two segments with one id", () => {
    const spec = fixture();
    spec.main[1]!.id = "s1";
    expect(codes(spec)).toContain("dup-id");
  });

  it("too-long: a film past ten minutes", () => {
    const spec = fixture();
    spec.main[3]!.len = 18_000; // the still: no source to overrun
    expect(codes(spec)).toEqual(["too-long"]);
  });
});
