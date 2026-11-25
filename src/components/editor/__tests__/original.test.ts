/**
 * original.test.ts — the take as it was shot (spec 2026-11-24-editor-screens-design.md E16; plan 2026-11-25-editor-screens-b,
 * Task 5): the take with nothing on it, the take's moment a film frame shows, and the frames of each that show a moment of the
 * other. Every edit here is a real one, made by the door (`applyOps`) from the suite's take (12.7 s, 381 frames).
 */
import { describe, expect, it } from "vitest";
import { NO_LOOK, filmFrames, newEdit, type Asset, type Edit } from "@/lib/edit";
import { filmFrameAt, plainEdit, plainFrameAt, takeMomentAt } from "../original";
import { ASSET, FIRST, changed } from "./views";

const TAKE = ASSET.id;
/** The suite's take, which is a video. */
const CLIP = ASSET as Extract<Asset, { kind: "video" }>;
/** The first cut with its start trimmed off a frame's edge (1234 ms is 37.02 frames in). */
const TRIMMED = changed(FIRST, [{ op: "shot.trim", id: "s1", startMs: 1234 }]);
/**
 * Two stretches of the take with a gap cut out between them: 0.5 s to 3 s (frames 0 to 74), then 4 s to 10 s (75 to 254). What
 * is before the first, between the two, and after the second is shown nowhere.
 */
const GAPPED = changed(FIRST, [
  { op: "shot.split", id: "s1", atMs: 4000, newId: "s2" },
  { op: "shot.trim", id: "s1", startMs: 500, endMs: 3000 },
  { op: "shot.trim", id: "s2", endMs: 10_000 },
]);

describe("plainEdit: the take with nothing on it", () => {
  it("is one shot of the whole take, framed as shot, with no marks, no items, no captions, no look and no cover", () => {
    const plain = plainEdit(FIRST)!;
    expect(plain.assets).toEqual([ASSET]);
    expect(plain.shots).toHaveLength(1);
    const [shot] = plain.shots;
    expect(CLIP.kind).toBe("video");
    expect(shot).toMatchObject({ asset: TAKE, startMs: 0, endMs: Math.min(CLIP.ms, 180_000), speed: 1, marks: [], framing: { from: { zoom: 1, x: 0, y: 0 }, move: null }, look: null });
    expect(plain.items).toEqual([]);
    expect(plain.captions.on).toBe(false);
    expect(plain.look).toEqual(NO_LOOK);
    expect(plain.cover).toBeNull();
    expect(filmFrames(plain)).toBe(381);
  });

  it("is the same whatever was done to the cut: trimmed, cut apart, its captions on", () => {
    expect(plainEdit(TRIMMED)).toEqual(plainEdit(FIRST));
    expect(plainEdit(GAPPED)).toEqual(plainEdit(FIRST));
  });

  it("is the first three minutes of a longer take", () => {
    const long: Asset = { ...CLIP, ms: 200_000, words: null };
    const plain = plainEdit(newEdit(long))!;
    expect(plain.shots[0]).toMatchObject({ startMs: 0, endMs: 180_000 });
    expect(filmFrames(plain)).toBe(5400);
  });

  it("is none when the edit's first shot shows no video", () => {
    const picture: Asset = { id: "p1", origin: "uploaded", at: { bucket: "takes", path: "p1.jpg" }, kind: "image", w: 1080, h: 1920 };
    const still: Edit = { ...FIRST, assets: [picture], shots: [{ ...FIRST.shots[0]!, asset: picture.id, startMs: 0, endMs: 3000 }] };
    expect(plainEdit(still)).toBeNull();
  });
});

describe("the frames of the film and of the take, each for the other", () => {
  it("finds, for every frame of a cut with its start trimmed, that same frame again from the take's moment it shows", () => {
    const frames = filmFrames(TRIMMED);
    expect(frames).toBe(344);
    for (let f = 0; f < frames; f++) {
      const moment = takeMomentAt(TRIMMED, f)!;
      expect(moment.asset).toBe(TAKE);
      expect(filmFrameAt(TRIMMED, TAKE, moment.ms)).toEqual({ frame: f, exact: true });
    }
  });

  it("finds every frame of a cut with a gap cut out the same way, on both sides of the gap", () => {
    const frames = filmFrames(GAPPED);
    expect(frames).toBe(255);
    for (let f = 0; f < frames; f++) expect(filmFrameAt(GAPPED, TAKE, takeMomentAt(GAPPED, f)!.ms)).toEqual({ frame: f, exact: true });
  });

  it("reads the take's moment a frame shows, and none past the film's end", () => {
    expect(takeMomentAt(TRIMMED, 0)).toEqual({ asset: TAKE, ms: 1234 });
    expect(takeMomentAt(GAPPED, 75)).toEqual({ asset: TAKE, ms: 4000 });
    expect(takeMomentAt(GAPPED, 255)).toBeNull();
  });

  it("goes for a moment shown nowhere to the first frame of the shot that starts soonest after it, and past every shot to the last frame", () => {
    expect(filmFrameAt(GAPPED, TAKE, 3500)).toEqual({ frame: 75, exact: false }); // cut out between the two
    expect(filmFrameAt(GAPPED, TAKE, 200)).toEqual({ frame: 0, exact: false }); // before the first
    expect(filmFrameAt(GAPPED, TAKE, 11_000)).toEqual({ frame: 254, exact: false }); // after every shot
    expect(filmFrameAt(GAPPED, TAKE, 12_699)).toEqual({ frame: 254, exact: false });
    expect(filmFrameAt(GAPPED, "another-take", 5000)).toEqual({ frame: 254, exact: false }); // a file the film does not show
  });

  it("goes to the first frame that shows a moment shown twice", () => {
    // 8 s to 9 s of the take first, then the two stretches: 8.5 s shows at frame 15, and again in the second stretch.
    const twice = changed(GAPPED, [{ op: "shot.insert", after: null, shot: { id: "s3", asset: TAKE, startMs: 8000, endMs: 9000 } }]);
    expect(filmFrameAt(twice, TAKE, 8500)).toEqual({ frame: 15, exact: true });
    expect(takeMomentAt(twice, 30 + 75 + 135)).toEqual({ asset: TAKE, ms: 8500 });
  });

  it("finds the frame of the take with nothing on it that shows a moment, held inside it", () => {
    const plain = plainEdit(FIRST)!;
    expect(plainFrameAt(plain, 0)).toBe(0);
    expect(plainFrameAt(plain, 1234)).toBe(37);
    expect(plainFrameAt(plain, 6000)).toBe(180);
    expect(plainFrameAt(plain, -40)).toBe(0);
    expect(plainFrameAt(plain, 12_700)).toBe(380);
    expect(plainFrameAt(plain, 99_000)).toBe(380);
  });
});
