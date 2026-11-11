/**
 * ops.test.ts — the operations, and the promise that they cannot break an edit.
 *
 * The second half is the one that matters most: 500 seeded random sequences of operations. Every
 * sequence either is refused, leaving the edit exactly as it was, or gives an edit that passes
 * the checks and compiles to a film OpenFilm's reader accepts. The chat and the auto-edit will
 * produce operations nobody has tried by hand; this is what stands between them and a broken film.
 */
import { readFilmFile } from "openfilm/film-doc";
import { describe, expect, it } from "vitest";
import { checkEditSpec } from "../check";
import { compile } from "../compile";
import { cuesOf } from "../compile/captions";
import { frameOf, total } from "../derive";
import { EditOpError, applyOps, parseOps, type Op } from "../ops";
import { newSegment, newText, parseEditSpec, type EditSpec } from "../spec";
import { minSourceMs, sourceMs } from "../time";
import { filmFaults } from "./film-rules";
import { file, fixture } from "./fixture";

const refusal = (fn: () => unknown): EditOpError => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EditOpError) return e;
    throw e;
  }
  throw new Error("the operation was not refused");
};

describe("segment operations", () => {
  it("trim changes where a segment starts in its source and how long it is", () => {
    const spec = applyOps(fixture(), [{ op: "segment.trim", id: "s1", inMs: 300, len: 40 }]);
    expect(spec.main[0]).toMatchObject({ inMs: 300, len: 40 });
    expect(total(spec)).toBe(282);
  });

  it("split makes two segments that play the same frames as before", () => {
    const spec = applyOps(fixture(), [{ op: "segment.split", id: "s2", at: 20, newId: "s2b" }]);
    expect(spec.main.map((s) => s.id)).toEqual(["s1", "s2", "s2b", "s3", "s4", "s5"]);
    expect(spec.main[1]).toMatchObject({ len: 20, inMs: 1866, cutOut: { kind: "cut" } });
    expect(spec.main[2]).toMatchObject({ len: 27, inMs: 1866 + 667, cutOut: { kind: "fade", style: "dissolve", len: 12 } });
    expect(total(spec)).toBe(298);
  });

  it("split hands what was pinned past it to the second half", () => {
    const base = applyOps(fixture(), [{ op: "text.add", item: newText({ id: "late", text: "x", at: 30, len: 10, pin: "s2" }) }]);
    const spec = applyOps(base, [{ op: "segment.split", id: "s2", at: 20, newId: "s2b" }]);
    expect(spec.texts.find((t) => t.id === "late")).toMatchObject({ pin: "s2b", at: 10 });
    expect(spec.sounds.find((s) => s.id === "k1")).toMatchObject({ pin: "s2", at: 0 });
    expect(frameOf(spec, spec.texts.find((t) => t.id === "late")!)).toBe(frameOf(base, base.texts.find((t) => t.id === "late")!));
  });

  it("split refuses to leave under three frames on a side", () => {
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.split", id: "s2", at: 45, newId: "x" }])).code).toBe("split-range");
  });

  it("remove takes what was pinned to the segment with it, and never the last segment", () => {
    const spec = applyOps(fixture(), [{ op: "segment.remove", id: "s1" }]);
    expect(spec.texts.map((t) => t.id)).toEqual(["t2"]);
    const one = applyOps(fixture(), ["s1", "s2", "s3", "s4"].map((id) => ({ op: "segment.remove", id }) as Op));
    expect(refusal(() => applyOps(one, [{ op: "segment.remove", id: "s5" }])).code).toBe("last-segment");
  });

  it("move reorders, and a pinned text travels with its segment", () => {
    const spec = applyOps(fixture(), [{ op: "segment.move", id: "s1", to: 4 }]);
    expect(spec.main.map((s) => s.id)).toEqual(["s2", "s3", "s4", "s5", "s1"]);
    expect(frameOf(spec, spec.texts[0]!)).toBe(298 - 56);
  });

  it("replace keeps the length when the new source is long enough and shortens it when not", () => {
    const kept = applyOps(fixture(), [{ op: "segment.replace", id: "s1", asset: "broll", inMs: 0 }]);
    expect(kept.main[0]).toMatchObject({ asset: "broll", len: 56 });
    const cut = applyOps(fixture(), [{ op: "segment.replace", id: "s5", asset: "broll", inMs: 6000 }]);
    expect(cut.main[4]).toMatchObject({ asset: "broll", inMs: 6000, len: 60 }); // 2 s left in an 8 s file
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.replace", id: "s5", asset: "broll", inMs: 7990 }])).code).toBe("source-too-short");
  });

  it("a speed change keeps the stretch of source and changes the length on the film", () => {
    const spec = applyOps(fixture(), [{ op: "segment.set", id: "s1", patch: { speed: 2 } }]);
    expect(spec.main[0]).toMatchObject({ speed: 2, len: 28 });
  });

  it("a speed change keeps the source window to within half a film frame, and never takes more than the file has", () => {
    /* s5: 90 frames at 1×; at another speed it is 90 / speed frames, to the nearest whole frame */
    for (const speed of [4, 2, 1.5, 0.5, 0.25]) {
      const s5 = applyOps(fixture(), [{ op: "segment.set", id: "s5", patch: { speed } }]).main[4]!;
      expect(Math.abs(s5.len - 90 / speed), `speed ${speed}`).toBeLessThanOrEqual(0.5);
    }
    expect(applyOps(fixture(), [{ op: "segment.set", id: "s5", patch: { speed: 4 } }]).main[4]).toMatchObject({ speed: 4, len: 23 }); // 22.5 frames
    /* a tie is not lost to floating point: 6 frames at 0.3× are 4.5 at 0.4×, so 5 (6 × 0.3 / 0.4 = 4.499999999999999) */
    const slow = applyOps(fixture(), [{ op: "segment.insert", index: 0, segment: { ...newSegment({ id: "n", asset: "take", len: 6 }), speed: 0.3 } }]);
    expect(applyOps(slow, [{ op: "segment.set", id: "n", patch: { speed: 0.4 } }]).main[0]).toMatchObject({ speed: 0.4, len: 5 });
    /* 134 frames that end on the take's last millisecond: 33.5 at 4× round to 34, which the file has no room for, so 33 */
    const ending = applyOps(fixture(), [{ op: "segment.trim", id: "s5", inMs: 12700 - minSourceMs(134, 1), len: 134 }]);
    expect(applyOps(ending, [{ op: "segment.set", id: "s5", patch: { speed: 4 } }]).main[4]).toMatchObject({ speed: 4, len: 33 });
    /* never under three frames: 5 frames at 4× round to 1; the 3 it gets take 12 frames of source, not 5 */
    const short = applyOps(fixture(), [{ op: "segment.trim", id: "s2", len: 5 }, { op: "segment.set", id: "s2", patch: { speed: 4 } }]);
    expect(short.main[1]).toMatchObject({ speed: 4, len: 3 });
    /* and where the file has no room for those three, the checks refuse it */
    const last = applyOps(fixture(), [{ op: "segment.trim", id: "s5", inMs: 12700 - minSourceMs(5, 1), len: 5 }]);
    expect(refusal(() => applyOps(last, [{ op: "segment.set", id: "s5", patch: { speed: 4 } }])).code).toBe("source-overrun");
  });

  it("repeated speed changes do not eat the segment: s5 from 1× to 4× and back in quarter steps", () => {
    const steps = [...Array.from({ length: 12 }, (_, i) => 1.25 + i * 0.25), ...Array.from({ length: 12 }, (_, i) => 3.75 - i * 0.25)];
    let spec = fixture();
    for (const speed of steps) spec = applyOps(spec, [{ op: "segment.set", id: "s5", patch: { speed } }]);
    expect(spec.main[4]!.speed).toBe(1);
    expect(spec.main[4]!.len).toBeGreaterThanOrEqual(87);
    expect(spec.main[4]!.len).toBe(93); // from 90: rounding wanders a little; flooring every step ended at 63
  });

  it("a speed change on a still leaves its length alone: it has no source to keep", () => {
    expect(applyOps(fixture(), [{ op: "segment.set", id: "s4", patch: { speed: 2 } }]).main[3]).toMatchObject({ speed: 2, len: 45 });
  });

  it("set changes framing, move, filter and the hand-over", () => {
    const spec = applyOps(fixture(), [{
      op: "segment.set", id: "s1",
      patch: { framing: { zoom: 2, x: 0.5, y: 0 }, move: { kind: "shake", amount: 1 }, filter: "warm", cutOut: { kind: "wipe", id: "glitch" } },
    }]);
    expect(spec.main[0]).toMatchObject({ framing: { zoom: 2, x: 0.5, y: 0 }, move: { kind: "shake", amount: 1 }, filter: "warm", cutOut: { kind: "wipe", id: "glitch" } });
  });

  it("insert adds a segment at an index", () => {
    const spec = applyOps(fixture(), [{ op: "segment.insert", index: 1, segment: newSegment({ id: "new", asset: "photo", len: 30 }) }]);
    expect(spec.main.map((s) => s.id)).toEqual(["s1", "new", "s2", "s3", "s4", "s5"]);
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.insert", index: 0, segment: newSegment({ id: "s1", asset: "photo", len: 30 }) }])).code).toBe("id-taken");
  });
});

describe("text, sound, layer and caption operations", () => {
  it("add, set and remove a text", () => {
    let spec = applyOps(fixture(), [{ op: "text.add", item: newText({ id: "t3", text: "new", at: 10, len: 20 }) }]);
    spec = applyOps(spec, [{ op: "text.set", id: "t3", patch: { text: "changed", box: { x: 0.2, y: 0.8, w: 0.5 } } }]);
    expect(spec.texts.find((t) => t.id === "t3")).toMatchObject({ text: "changed", box: { x: 0.2, y: 0.8, w: 0.5 }, at: 10 });
    spec = applyOps(spec, [{ op: "text.remove", id: "t3" }]);
    expect(spec.texts.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("set a sound's level and a layer's place", () => {
    const spec = applyOps(fixture(), [
      { op: "sound.set", id: "m1", patch: { volume: 0.2 } },
      { op: "layer.set", id: "l1", patch: { box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } } },
    ]);
    expect(spec.sounds[1]?.volume).toBe(0.2);
    expect(spec.layers[0]?.box).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  });

  it("change part of the caption style and leave the rest", () => {
    const spec = applyOps(fixture(), [{ op: "captions.set", patch: { style: { size: 120, highlight: null } } }]);
    expect(spec.captions.style).toMatchObject({ size: 120, highlight: null, weight: 800, uppercase: true });
  });

  it("correct a word, hide a word, and undo a correction", () => {
    let spec = applyOps(fixture(), [{ op: "captions.fix", asset: "take", word: 0, text: "Hey" }, { op: "captions.fix", asset: "take", word: 1, text: null }]);
    expect(cuesOf(spec)[0]?.words.map((w) => w.text)).toEqual(["Hey", "we", "are"]);
    spec = applyOps(spec, [{ op: "captions.fix", asset: "take", word: 0 }, { op: "captions.fix", asset: "take", word: 1 }]);
    expect(cuesOf(spec)[0]?.words.map((w) => w.text)).toEqual(["Hello", "guys,", "we"]);
    expect(refusal(() => applyOps(fixture(), [{ op: "captions.fix", asset: "take", word: 99, text: "x" }])).code).toBe("fix-missing");
  });

  it("add an asset and give it words later", () => {
    let spec = applyOps(fixture(), [{ op: "asset.add", asset: { id: "vo", kind: "audio", origin: "uploaded", at: { bucket: "takes", path: "u1/vo.m4a" }, ms: 2000, sound: true, words: null } }]);
    spec = applyOps(spec, [{ op: "asset.words", id: "vo", words: [{ t0: 0, t1: 500, text: "Hi" }] }]);
    expect(spec.assets.vo?.words).toEqual([{ t0: 0, t1: 500, text: "Hi" }]);
    expect(refusal(() => applyOps(spec, [{ op: "asset.add", asset: spec.assets.vo! }])).code).toBe("id-taken");
  });
});

describe("applyOps", () => {
  it("is all or nothing, and never touches the edit it was given", () => {
    const before = fixture();
    const given = fixture();
    const error = refusal(() => applyOps(given, [{ op: "segment.trim", id: "s1", len: 30 }, { op: "segment.remove", id: "nope" }]));
    expect(error).toMatchObject({ code: "not-found", index: 1 });
    expect(given).toEqual(before);
    applyOps(given, [{ op: "segment.trim", id: "s1", len: 30 }]);
    expect(given).toEqual(before);
  });

  it("refuses a result the checks reject, with the check's code", () => {
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.trim", id: "s5", inMs: 12000 }])).code).toBe("source-overrun");
    expect(refusal(() => applyOps(fixture(), [{ op: "text.set", id: "t1", patch: { pin: "gone" } }])).code).toBe("pin-missing");
  });

  it("refuses a value out of range as invalid", () => {
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.set", id: "s1", patch: { speed: 9 } as never }])).code).toBe("invalid");
  });

  it("says which operation was refused: its own index, or the last one's when the checks of the result refuse", () => {
    const mono: Op = { op: "look.set", filter: "mono" };
    expect(refusal(() => applyOps(fixture(), [mono, { op: "segment.remove", id: "nope" }, mono]))).toMatchObject({ code: "not-found", index: 1 });
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.set", id: "s1", patch: { speed: 9 } as never }, mono]))).toMatchObject({ code: "invalid", index: 0 });
    expect(refusal(() => applyOps(fixture(), [{ op: "segment.trim", id: "s5", inMs: 12000 }, mono]))).toMatchObject({ code: "source-overrun", index: 1 });
    /* the checks judge the whole list, so a list may pass through a state that is not valid */
    expect(applyOps(fixture(), [{ op: "segment.trim", id: "s5", inMs: 12000 }, { op: "segment.trim", id: "s5", inMs: 8000 }]).main[4]?.inMs).toBe(8000);
  });

  it("refuses an id every object already has, and leaves every object as it was", () => {
    const outside = [
      '[{"op":"asset.words","id":"__proto__","words":[{"t0":0,"t1":1,"text":"pwned"}]}]',
      '[{"op":"captions.fix","asset":"__proto__","word":3,"text":"pwned"}]',
    ];
    const anyObject = (): Record<string, unknown> => ({});
    try {
      for (const json of outside) {
        expect(() => parseOps(JSON.parse(json)), json).toThrow();
        expect(refusal(() => applyOps(fixture(), JSON.parse(json) as Op[])), json).toMatchObject({ code: "invalid", index: 0 });
      }
      expect(refusal(() => applyOps(fixture(), [{ op: "captions.fix", asset: "constructor", word: 0, text: "x" }]))).toMatchObject({ code: "invalid", index: 0 });
      expect(refusal(() => applyOps(fixture(), [{ op: "asset.words", id: "toString", words: null }]))).toMatchObject({ code: "invalid", index: 0 });
      expect(anyObject().words).toBeUndefined();
      expect(anyObject()["3"]).toBeUndefined();
      expect((Object as unknown as Record<string, unknown>)["0"]).toBeUndefined();
      expect(parseEditSpec(fixture())).toEqual(fixture());
    } finally {
      /* a red run must not poison the tests after it */
      const proto = Object.prototype as unknown as Record<string, unknown>;
      delete proto.words;
      delete proto["3"];
      delete (Object as unknown as Record<string, unknown>)["0"];
      delete (Object.prototype.toString as unknown as Record<string, unknown>).words;
    }
  });

  it("works on copies of the operations it is given, whether it applies them or refuses them", () => {
    const lists: Op[][] = [
      [{ op: "segment.insert", index: 0, segment: newSegment({ id: "n", asset: "broll", len: 20 }) }, { op: "segment.trim", id: "n", len: 10, inMs: 50 }],
      [{ op: "text.add", item: newText({ id: "t9", text: "x", at: 1, len: 3 }) }, { op: "text.set", id: "t9", patch: { text: "changed" } }, { op: "segment.remove", id: "nope" }],
      [{ op: "asset.add", asset: { id: "vo", kind: "audio", origin: "uploaded", at: { bucket: "takes", path: "u1/vo.m4a" }, ms: 2000, sound: true, words: null } }, { op: "asset.words", id: "vo", words: [{ t0: 0, t1: 500, text: "Hi" }] }],
    ];
    for (const ops of lists) {
      const copy = structuredClone(ops);
      try {
        applyOps(fixture(), ops);
      } catch (e) {
        if (!(e instanceof EditOpError)) throw e;
      }
      expect(ops).toEqual(copy);
    }
    const item = newText({ id: "t9", text: "x", at: 1, len: 3 });
    applyOps(fixture(), [{ op: "text.add", item }]).texts[2]!.style.size = 300;
    expect(item.style.size).toBe(62);
  });

  it("refuses a place outside the main sequence as invalid, at that operation", () => {
    const mono: Op = { op: "look.set", filter: "mono" };
    const n = newSegment({ id: "n", asset: "photo", len: 30 });
    expect(refusal(() => applyOps(fixture(), [mono, { op: "segment.move", id: "s1", to: -1 }]))).toMatchObject({ code: "invalid", index: 1 });
    expect(refusal(() => applyOps(fixture(), [mono, { op: "segment.insert", index: -2, segment: n }]))).toMatchObject({ code: "invalid", index: 1 });
    /* past the end: the schema cannot know the edit's length; applyOps can */
    expect(refusal(() => applyOps(fixture(), [mono, { op: "segment.move", id: "s1", to: 5 }]))).toMatchObject({ code: "invalid", index: 1 });
    expect(refusal(() => applyOps(fixture(), [mono, { op: "segment.insert", index: 6, segment: n }]))).toMatchObject({ code: "invalid", index: 1 });
    expect(applyOps(fixture(), [{ op: "segment.move", id: "s1", to: 4 }]).main.map((s) => s.id)).toEqual(["s2", "s3", "s4", "s5", "s1"]);
    expect(applyOps(fixture(), [{ op: "segment.insert", index: 5, segment: n }]).main.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "n"]);
  });
});

describe("a clip fits its file wherever it sits", () => {
  const filmed = (spec: EditSpec): string[] => filmFaults(spec, compile(spec, { file }));
  /** b, then a: the take's last 4 frames, ending on its last millisecond. 4 frames are 133 or 134 ms, by where they start. */
  const tight = (): EditSpec => applyOps(fixture(), [
    { op: "segment.insert", index: 0, segment: newSegment({ id: "b", asset: "take", len: 3 }) },
    { op: "segment.insert", index: 1, segment: newSegment({ id: "a", asset: "take", len: 4, inMs: 12567 }) },
  ]);

  it("lets the edit around a segment that ends on its file's last millisecond change", () => {
    const longer = applyOps(tight(), [{ op: "segment.trim", id: "b", len: 5 }]);
    const moved = applyOps(tight(), [{ op: "segment.move", id: "a", to: 2 }]);
    expect(longer.main.map((s) => s.id).slice(0, 2)).toEqual(["b", "a"]);
    expect(moved.main.map((s) => s.id).slice(0, 3)).toEqual(["b", "s1", "a"]);
    for (const spec of [tight(), longer, moved]) expect(filmed(spec)).toEqual([]);
  });

  it("splits a segment that ends on its file's last millisecond, both halves fitting", () => {
    /* 7 frames from frame 5 take the take's last 233 ms; split after 4, whose 134 ms leave the last 3 frames 99 */
    const spec = applyOps(fixture(), [
      { op: "segment.insert", index: 0, segment: newSegment({ id: "lead", asset: "photo", len: 5 }) },
      { op: "segment.insert", index: 1, segment: newSegment({ id: "a", asset: "take", len: 7, inMs: 12467 }) },
    ]);
    const split = applyOps(spec, [{ op: "segment.split", id: "a", at: 4, newId: "a2" }]);
    expect(split.main[1]).toMatchObject({ id: "a", inMs: 12467, len: 4 });
    expect(split.main[2]).toMatchObject({ id: "a2", inMs: 12600, len: 3 }); // 1 ms before the first half's source ends, at 12601
    expect(filmed(spec)).toEqual([]);
    expect(filmed(split)).toEqual([]);
    /* at every speed, length, place and split point, ending on the file's last millisecond */
    for (const speed of [0.25, 1, 1.5, 4]) {
      for (const len of [7, 10, 31]) {
        for (const lead of [0, 4, 5]) {
          const ending = applyOps(fixture(), [
            ...(lead ? [{ op: "segment.insert", index: 0, segment: newSegment({ id: "lead", asset: "photo", len: lead }) } as Op] : []),
            { op: "segment.insert", index: lead ? 1 : 0, segment: { ...newSegment({ id: "a", asset: "take", len, inMs: 12700 - minSourceMs(len, speed) }), speed } },
          ]);
          const first = ending.main[lead ? 1 : 0]!;
          for (const at of new Set([3, 4, 5, Math.floor(len / 2), len - 4, len - 3].filter((at) => at <= len - 3))) {
            const where = `speed ${speed}, ${len} frames from frame ${lead}, split at ${at}`;
            const halves = applyOps(ending, [{ op: "segment.split", id: "a", at, newId: "a2" }]);
            const ends = first.inMs + sourceMs(lead, at, speed); // where the first half's source ends
            const second = halves.main[lead ? 2 : 1]!;
            expect(second.inMs, where).toBeLessThanOrEqual(ends);
            expect(ends - second.inMs, where).toBeLessThanOrEqual(Math.ceil(speed));
            expect(filmed(halves), where).toEqual([]);
          }
        }
      }
    }
  });

  it("replaces a segment's source with the same length wherever it sits", () => {
    for (const lead of [0, 3, 4, 5]) {
      const spec = lead ? applyOps(fixture(), [{ op: "segment.insert", index: 0, segment: newSegment({ id: "lead", asset: "photo", len: lead }) }]) : fixture();
      const replaced = applyOps(spec, [{ op: "segment.replace", id: "s1", asset: "broll", inMs: 7734 }]); // 266 ms left of 8000
      expect(replaced.main[lead ? 1 : 0], `from frame ${lead}`).toMatchObject({ asset: "broll", len: 8 });
      expect(filmed(replaced)).toEqual([]);
    }
  });
});

describe("parseOps", () => {
  it("accepts operations and refuses unknown ones and unknown keys", () => {
    expect(parseOps([{ op: "segment.remove", id: "s1" }])).toEqual([{ op: "segment.remove", id: "s1" }]);
    expect(() => parseOps([{ op: "segment.explode", id: "s1" }])).toThrow();
    expect(() => parseOps([{ op: "segment.remove", id: "s1", force: true }])).toThrow();
  });
});

/* ── random sequences ────────────────────────────────────────────────────────────────────────── */

/** A small seeded generator (mulberry32): the same seed gives the same sequence on every machine. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomOp(spec: EditSpec, rnd: () => number, n: number): Op {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)] as T;
  const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const seg = pick(spec.main);
  const assets = Object.keys(spec.assets);
  switch (int(0, 15)) {
    case 0: return { op: "segment.trim", id: seg.id, len: int(3, 200) };
    case 1: return { op: "segment.trim", id: seg.id, inMs: int(0, 13000) };
    case 2: return { op: "segment.split", id: seg.id, at: int(3, 120), newId: `n${n}` };
    case 3: return { op: "segment.remove", id: seg.id };
    case 4: return { op: "segment.move", id: seg.id, to: int(0, 8) };
    case 5: return { op: "segment.replace", id: seg.id, asset: pick(assets), inMs: int(0, 9000) };
    case 6: return { op: "segment.set", id: seg.id, patch: { speed: pick([0.25, 0.5, 1, 1.5, 2, 4]) } };
    case 7: return { op: "segment.set", id: seg.id, patch: { cutOut: pick([{ kind: "cut" }, { kind: "fade", style: "dissolve", len: int(2, 60) }, { kind: "fade", style: "dip-black", len: int(2, 60) }, { kind: "wipe", id: pick(["swipe-blur", "glitch", "flare-whip", "shutter", "rgb-split", "datamosh"] as const) }] as const) } };
    case 8: return { op: "segment.set", id: seg.id, patch: { fit: pick(["cover", "blur"] as const), framing: { zoom: 1 + rnd() * 3, x: rnd() * 2 - 1, y: rnd() * 2 - 1 }, move: pick([null, { kind: "push-in", amount: rnd() }, { kind: "pan-left", amount: rnd() }, { kind: "shake", amount: rnd() }] as const), filter: pick([null, "vivid", "mono"] as const), volume: pick([0, 0.5, 1]) } };
    case 9: return { op: "segment.insert", index: int(0, 8), segment: newSegment({ id: `n${n}`, asset: pick(assets), len: int(3, 90), inMs: int(0, 5000) }) };
    case 10: return { op: "text.add", item: newText({ id: `x${n}`, text: `text ${n} & "more"`, at: int(0, 320), len: int(1, 200), pin: pick([null, seg.id]) }) };
    case 11: return { op: "text.remove", id: pick(spec.texts.length ? spec.texts.map((t) => t.id) : ["none"]) };
    case 12: return { op: "sound.add", item: { id: `y${n}`, pin: pick([null, seg.id]), at: int(0, 300), len: int(1, 200), role: pick(["music", "sfx", "voiceover"] as const), asset: pick(["kick", "song"]), inMs: int(0, 400), volume: rnd() * 2, fadeIn: int(0, 40), fadeOut: int(0, 40) } };
    case 13: return { op: "captions.set", patch: { on: rnd() > 0.3, style: { maxWords: int(1, 6), y: rnd(), dimAhead: rnd() } } };
    case 14: return { op: "captions.fix", asset: "take", word: int(0, 30), text: pick(["fixed", null, undefined]) };
    default: return { op: "layer.add", item: { id: `z${n}`, pin: pick([null, seg.id]), at: int(0, 300), len: int(1, 120), kind: "clip", asset: pick(["take", "broll", "photo"]), inMs: int(0, 3000), speed: pick([0.5, 1, 2]), volume: 1, box: { x: rnd(), y: rnd(), w: 0.1 + rnd(), h: 0.1 + rnd() }, rotate: rnd() * 40 - 20, opacity: rnd(), radius: int(0, 60), z: int(-3, 3) } };
  }
}

describe("500 random sequences of operations", () => {
  it("each either is refused and changes nothing, or leaves an edit that compiles to a film with no problems", () => {
    let applied = 0;
    let refused = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const rnd = random(seed);
      let spec = fixture();
      for (let step = 0; step < 12; step++) {
        const before = structuredClone(spec);
        const op = randomOp(spec, rnd, step);
        let next: EditSpec;
        try {
          next = applyOps(spec, [op]);
        } catch (e) {
          if (!(e instanceof EditOpError)) throw new Error(`seed ${seed}, step ${step}: ${JSON.stringify(op)} threw ${String(e)}`);
          expect(spec).toEqual(before);
          refused++;
          continue;
        }
        expect(spec).toEqual(before);
        expect(checkEditSpec(next), `seed ${seed}, step ${step}: ${JSON.stringify(op)}`).toEqual([]);
        const compiled = compile(next, { file });
        const film = compiled.files["film.html"];
        expect(readFilmFile(film).problems, `seed ${seed}, step ${step}: ${JSON.stringify(op)}`).toEqual([]);
        expect(filmFaults(next, compiled), `seed ${seed}, step ${step}: ${JSON.stringify(op)}`).toEqual([]);
        spec = next;
        applied++;
      }
    }
    /* the generator has to exercise both outcomes, or this test says nothing */
    expect(applied).toBeGreaterThan(1500);
    expect(refused).toBeGreaterThan(300);
  }, 30_000); // about 6 s with the film rules: over vitest's 5 s default
});
