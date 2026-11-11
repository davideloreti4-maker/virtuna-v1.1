/**
 * check.test.ts — what follows from an EditSpec, and the rules zod cannot say.
 *
 * Every `checkEditSpec` rule gets a document that breaks exactly that rule, so a rule that stops
 * firing is seen here and not as a film that renders wrong.
 */
import { describe, expect, it } from "vitest";
import { checkEditSpec } from "../check";
import { frameOf, starts, total, windowOf } from "../derive";
import { fixture } from "./fixture";

describe("derive", () => {
  it("places segments end to end", () => {
    expect(starts(fixture())).toEqual([0, 56, 103, 163, 208, 298]);
    expect(total(fixture())).toBe(298);
  });

  it("gives a segment its place on the film and in its source", () => {
    expect(windowOf(fixture(), 1)).toEqual({ start: 56, atMs: 1866, lenMs: 1567, inMs: 1866, usedMs: 1567 });
    expect(windowOf(fixture(), 3)).toEqual({ start: 163, atMs: 5433, lenMs: 1500, inMs: 0, usedMs: 0 });
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
