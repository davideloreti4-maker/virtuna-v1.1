import { describe, expect, it } from "vitest";
import type { Analyses } from "../../analysis";
import { framingAt, layout, placed } from "../../derive";
import type { Edit, Item, Mark } from "../../doc";
import { applyOps, type Op } from "../../ops";
import { MIN_FRAMES, MIN_MARK_MS } from "../../time";
import { review } from "../../review";
import { ROOM_PROBE, ZOOM, cleanCuts, sameAs, zoomFor } from "../context";
import { JUST_SAID_MS, NEAR, ON, PUSH_MS, isPush, landed, momentAgain, momentBlock, endsAsked, momentFor, namesAnotherPlace, offTheStart, pointsAt, snapToMoment, startedSay, stayedPut, stayedWhole, zoomHere, READABLE_END, type Moment } from "../moment";
import { analysis, box, faces, twoShots } from "./fixture";

/*
 * The fixture (`twoShots`): s1 = take ms [0,2400) on frames [0,72), a 6-frame fade into s2 = [3000,6000) on frames [66,156),
 * zoom 1.2, mono; words w0 [300,500), w1 [500,800), w2 [1500,1700) hidden, w3 [1700,2100) stressed, w4 [3200,3600),
 * w5 [3600,4000) hidden and stressed; pauses cut@ 1200 and 2700; no punctuation. A call-out m1 and a sound p1 on w4, a bar.
 */
const A: Analyses = { t1: analysis() };

/** The edit `ops` make of `edit`, through the door; throws when the door refuses, so a test never measures a refused edit. */
function through(edit: Edit, ops: Op[]): Edit {
  const made = applyOps(edit, ops);
  if (!made.ok) throw new Error(`refused: ${JSON.stringify(made.problems)}`);
  return made.edit;
}

/** The moment, or a failed test: every frame asked here is a frame of the film. */
function at(edit: Edit, frame: number): Moment {
  const moment = momentFor(edit, A, frame);
  if (!moment) throw new Error(`no moment at frame ${frame}`);
  return moment;
}

const title = (id: string, start: number, frames: number | null): Item => ({
  id, part: "title", anchor: "start", at: start, frames, props: { text: "Go", font: "tiktok", look: "bold", y: 0.2, size: 96, color: "#ffffff", accent: null },
});

describe("the moment's constants", () => {
  it("are a second, three frames and a fifth of a second", () => {
    expect([NEAR, ON, JUST_SAID_MS]).toEqual([30, 3, 200]);
  });
});

describe("momentFor: the paused frame, resolved into named things", () => {
  it("case 1: on a word being said, its sentence, its caption page and the part between clean cuts", () => {
    const moment = at(twoShots(), 55);
    expect(moment).toMatchObject({ frame: 55, frames: 156, shot: "s1", take: "t1", ms: 1833 });
    expect(moment.word).toEqual({ index: 3, startMs: 1700, endMs: 2100, from: 51, to: 63, how: "saying" });
    expect([moment.start, moment.startMs, moment.startShot]).toEqual([51, 1700, "s1"]);
    // The 700 ms silence after w1 breaks the sentence; the hidden w2 is said, so it is in it.
    expect(moment.sentence).toEqual({ first: 2, last: 3, from: 45, to: 63 });
    expect(moment.part).toEqual({ from: 36, to: 66, fromMs: 1200, toMs: 2200, words: { first: 2, last: 3 }, sentences: 1 });
    // The captions show w0 and w1 on one page and w3 alone on the next; w2 is hidden, so it is on none.
    expect(moment.page).toEqual({ first: 3, last: 3, from: 51, to: 72 });
  });

  it("case 2: a word that ended 200 ms ago is just said; 233 ms ago, the next word is named and the start is the frame", () => {
    const just = at(twoShots(), 30);
    expect(just.ms).toBe(1000);
    expect(just.word).toEqual({ index: 1, startMs: 500, endMs: 800, from: 15, to: 24, how: "just said" });
    expect(just.start).toBe(30);
    const next = at(twoShots(), 31);
    expect(next.ms).toBe(1033);
    expect(next.word).toMatchObject({ index: 2, from: 45, how: "next" });
    expect([next.start, next.startMs, next.startShot]).toEqual([31, 1033, "s1"]);
  });

  it("case 3: after the run's last word, with none to come, that word is the last", () => {
    const moment = at(twoShots(), 140);
    expect(moment.shot).toBe("s2");
    expect(moment.word).toEqual({ index: 5, startMs: 3600, endMs: 4000, from: 84, to: 96, how: "last" });
    expect(moment.start).toBe(140);
    expect(moment.sentence).toEqual({ first: 4, last: 5, from: 72, to: 96 });
  });

  it("case 4: in a fade the shot coming in; no moment off the film", () => {
    expect(at(twoShots(), 68)).toMatchObject({ shot: "s2", ms: 3067, take: "t1" });
    expect(momentFor(twoShots(), A, 156)).toBeNull();
    expect(momentFor(twoShots(), A, -1)).toBeNull();
    expect(momentFor(twoShots(), A, 55.5)).toBeNull();
  });

  it("case 5: what is showing is every mark and item placed on the frame, in placed order", () => {
    expect(at(twoShots(), 75).showing).toEqual([
      { id: "m1", part: "callout", kind: "mark", shot: "s2", from: 72, to: 96 },
      { id: "p1", part: "sound", kind: "mark", shot: "s2", from: 72, to: 84 },
      { id: "bar", part: "progress", kind: "item", shot: null, from: 0, to: 156 },
    ]);
    expect(at(twoShots(), 20).showing).toEqual([{ id: "bar", part: "progress", kind: "item", shot: null, from: 0, to: 156 }]);
  });

  it("case 6: with the captions off there is no page, and the block says so", () => {
    const off = through(twoShots(), [{ op: "captions.set", on: false }]);
    const moment = at(off, 55);
    expect(moment.page).toBeNull();
    expect(momentBlock(moment, off, A, true).split("\n")[4]).toBe("page: no captions on screen");
  });

  it("names no word, sentence or page where a picture is shown", () => {
    const logo = { id: "logo", kind: "image", origin: "uploaded", at: { bucket: "edit-media", path: "u1/logo.png" }, w: 1080, h: 1920 } as const;
    const edit = through({ ...twoShots(), assets: [...twoShots().assets, logo] }, [{ op: "shot.insert", after: "s2", shot: { id: "s3", asset: "logo", startMs: 0, endMs: 1000 } }]);
    const moment = at(edit, 170);
    expect(moment).toMatchObject({ shot: "s3", take: "logo", word: null, sentence: null, page: null, start: 170 });
    expect(moment.part.words).toBeNull();
    expect(momentBlock(moment, edit, A, true).split("\n")[2]).toMatch(/^word: none; nothing is said here\. New here as a mark: "shot":"s3","atMs":\d+; as an item: "anchor":"start","at":170\.$/);
  });
});

describe("pointsAt: the request points at the paused frame (H0)", () => {
  it("case 7: here, now and this point; this video, a quoted word and a word inside another do not", () => {
    expect(pointsAt("Zoom in here.")).toBe(true);
    expect(pointsAt("Cut this part")).toBe(true);
    expect(pointsAt("Start now")).toBe(true);
    expect(pointsAt("Make this video warmer")).toBe(false);
    expect(pointsAt("Make it warmer")).toBe(false);
    expect(pointsAt('Add the word "here" as a title')).toBe(false);
    expect(pointsAt("Nowhere to go")).toBe(false);
    expect(pointsAt("this whole clip faster")).toBe(false);
  });
});

describe("momentBlock: the lines under moment:", () => {
  it("case 8: the moment at 55, written out, after the line that says in plain words what it is for (S13 a), with what a zoom here does (Task 3)", () => {
    const edit = twoShots();
    expect(momentBlock(at(edit, 55), edit, A, true)).toBe(
      [
        "The creator paused the video here, and the request is about this moment: a title, call-out, cutaway or sound added, a zoom or a cut that names no other place goes here; a change to the whole film (how the captions look, the film's look, its length, its pace) stays a change to the whole film.",
        'paused frame=55 of film 156f: shot s1 at 1833 ms of take t1. In the request, "here", "now" and "this" are this frame; "this word", "this sentence", "this part" and what is "showing" are the lines below. say tells it as "here" or by what is said there, never as a frame or a time.',
        'word w3 this [1700,2100) film=[51,63)f, being said. New here as a mark: "shot":"s1","atMs":1700; as an item: "anchor":"start","at":51.',
        "sentence w2-w3 film=[45,63)f",
        "page w3-w3 film=[51,72)f",
        'part film=[36,66)f w2-w3: the least that cuts cleanly around this frame; for time.cut "fromMs":1200,"toMs":2200',
        "zoom: shot.zoom on s1 starts on this frame; the code splits the shot here and pushes in until frame 66, the next cut; up to 1.3",
        'showing: item bar progress film=[0,156)f, to end it on this frame "frames":55',
      ].join("\n"),
    );
  });

  it("writes a word just said, a next word and a last word, a part of two sentences, and marks with their lenMs", () => {
    const edit = twoShots();
    const line = (frame: number, n: number, points = true) => momentBlock(at(edit, frame), edit, A, points).split("\n")[n];
    expect(line(30, 2)).toBe('word w1 there [500,800) film=[15,24)f, just said; none is being said. New here as a mark: "shot":"s1","atMs":1000; as an item: "anchor":"start","at":30.');
    expect(line(31, 2)).toBe('word: none is being said; the next is w2 so [1500,1700), from frame 45. New here as a mark: "shot":"s1","atMs":1033; as an item: "anchor":"start","at":31.');
    expect(line(140, 2)).toBe('word: none is being said; the last before it is w5 well [3600,4000). New here as a mark: "shot":"s2","atMs":5467; as an item: "anchor":"start","at":140.');
    // From s1's start to the pause's cut@: w0 and w1, one sentence. With the cut@ gone from the analysis, the part runs to s2's start and holds two.
    expect(line(20, 5)).toBe('part film=[0,36)f w0-w1: the least that cuts cleanly around this frame; for time.cut "fromMs":0,"toMs":1200');
    const unpaused = momentFor(edit, { t1: analysis({ pauses: [] }) }, 20);
    expect(unpaused && momentBlock(unpaused, edit, { t1: analysis({ pauses: [] }) }, true).split("\n")[5]).toBe('part film=[0,66)f w0-w3: the least that cuts cleanly around this frame; it holds 2 sentences; for time.cut "fromMs":0,"toMs":2200');
    expect(line(75, 7)).toBe('showing: mark m1 callout film=[72,96)f, to end it on this frame "lenMs":100; mark p1 sound film=[72,84)f, to end it on this frame "lenMs":100; item bar progress film=[0,156)f, to end it on this frame "frames":75');
    // A request that does not point is not offered the numbers that end what is showing (S17 (4)): unasked, the model ended the
    // first cut's title on the moment in 4 of 6 runs.
    expect(line(75, 7, false)).toBe("showing: mark m1 callout film=[72,96)f; mark p1 sound film=[72,84)f; item bar progress film=[0,156)f");
    // In s2's silence after its last word: s2 has no cut@ of its own, so its part runs from its start to the film's end, w4 and w5.
    expect(line(140, 5)).toBe('part film=[66,156)f w4-w5: the least that cuts cleanly around this frame; for time.cut "fromMs":2200,"toMs":5200');
  });

  it("writes a part with no words, and nothing showing", () => {
    const edit = through(twoShots(), [{ op: "item.remove", id: "bar" }, { op: "shot.trim", id: "s2", endMs: 5000 }, { op: "shot.insert", after: "s2", shot: { id: "s3", asset: "t1", startMs: 4500, endMs: 6000 } }]);
    const block = momentBlock(at(edit, 150), edit, A, true).split("\n");
    expect(block[5]).toMatch(/^part film=\[\d+,\d+\)f, no words: the least that cuts cleanly around this frame; for time\.cut "fromMs":\d+,"toMs":\d+$/);
    expect(block[7]).toBe("showing: nothing but the footage and the captions");
  });
});

describe("snapToMoment: a start or an end the answer set near the moment, put on it (H1, H2)", () => {
  // At 55: "this" (w3) is being said from frame 51, 1700 ms of the take on s1. At 75: "works" (w4) from frame 72, 3200 ms on s2.
  const go = (id: string, atMs: number): Mark => ({ id, part: "callout", atMs, lenMs: 1000, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } });
  /** The hold on the edit `ops` make of `before`, against the moment of `before` on `frame`. */
  const snapped = (frame: number, ops: Op[], before = twoShots()) => snapToMoment(before, through(before, ops), at(before, frame), A);
  const firstFrame = (edit: Edit, id: string) => placed(edit).find((place) => place.thing.id === id)?.at;

  it("starts: a new mark on the shot under the moment's start gets that start, one on another shot moves there with its id, an item starts on its frame", () => {
    expect(snapped(55, [{ op: "mark.add", shot: "s1", mark: go("c1", 1500) }])).toEqual({ ops: [{ op: "mark.set", id: "c1", atMs: 1700 }], says: [] });
    expect(snapped(75, [{ op: "mark.add", shot: "s1", mark: go("c1", 2200) }])).toEqual({
      ops: [{ op: "mark.remove", id: "c1" }, { op: "mark.add", shot: "s2", mark: { ...go("c1", 2200), atMs: 3200 } }],
      says: [],
    });
    expect(snapped(55, [{ op: "item.add", item: title("t", 70, 60) }])).toEqual({ ops: [{ op: "item.set", id: "t", anchor: "start", at: 51 }], says: [] });
    // A sound is held as a call-out is.
    const sound: Mark = { id: "p2", part: "sound", asset: "pop", atMs: 1500, lenMs: 400, props: { startMs: 0, volume: 0.8, fadeInMs: 0, fadeOutMs: 100 } };
    expect(snapped(55, [{ op: "mark.add", shot: "s1", mark: sound }]).ops).toEqual([{ op: "mark.set", id: "p2", atMs: 1700 }]);
  });

  it("starts: an item counted back from the film's end is counted from its start once held", () => {
    const fromEnd: Item = { ...title("e", 71, 20), anchor: "end" };
    const before = twoShots();
    expect(firstFrame(through(before, [{ op: "item.add", item: fromEnd }]), "e")).toBe(85);
    expect(snapped(55, [{ op: "item.add", item: fromEnd }]).ops).toEqual([{ op: "item.set", id: "e", anchor: "start", at: 51 }]);
  });

  it("starts: on the moment (its start less ON to its frame plus ON) is left as it is; within NEAR of it is held; further off is left", () => {
    const cases: [number, boolean][] = [[48, false], [51, false], [55, false], [58, false], [47, true], [59, true], [21, true], [85, true], [20, false], [86, false]];
    for (const [from, held] of cases) expect(snapped(55, [{ op: "item.add", item: title("t", from, 20) }]).ops.length > 0, `a title from frame ${from}`).toBe(held);
  });

  it("starts: only what the answer made appear; a thing the edit had, moved by the answer, is left where it was put", () => {
    expect(snapped(75, [{ op: "mark.set", id: "m1", atMs: 3000 }]).ops).toEqual([]);
  });

  it("ends: an item's end set near the moment ends on it, never under MIN_FRAMES (S9)", () => {
    expect(snapped(55, [{ op: "item.set", id: "bar", frames: 50 }])).toEqual({ ops: [{ op: "item.set", id: "bar", frames: 55 }], says: [] });
    expect(snapped(55, [{ op: "item.set", id: "bar", frames: 85 }]).ops).toEqual([{ op: "item.set", id: "bar", frames: 55 }]);
    // A title from frame 54: ended on 55 it would show one frame, so it shows the least the door takes.
    const late = through(twoShots(), [{ op: "item.add", item: title("t", 54, null) }]);
    expect(snapToMoment(late, through(late, [{ op: "item.set", id: "t", frames: 20 }]), at(late, 55), A).ops).toEqual([{ op: "item.set", id: "t", frames: MIN_FRAMES }]);
  });

  it("ends: a mark's length is the film time from its first frame to the moment, never under MIN_MARK_MS", () => {
    // m1 shows from frame 72: set 1100 ms long it would end on 105; on 85 it ends 13 frames in.
    expect(snapped(85, [{ op: "mark.set", id: "m1", lenMs: 1100 }]).ops).toEqual([{ op: "mark.set", id: "m1", lenMs: 433 }]);
    expect(snapped(73, [{ op: "mark.set", id: "m1", lenMs: 600 }]).ops).toEqual([{ op: "mark.set", id: "m1", lenMs: MIN_MARK_MS }]);
  });

  it("ends only when asked to: with `ends` false the starts are held and no end is (S17 (2): the ends part stays on a request that points)", () => {
    expect(snapToMoment(twoShots(), through(twoShots(), [{ op: "item.set", id: "bar", frames: 50 }]), at(twoShots(), 55), A, false).ops).toEqual([]);
    expect(snapToMoment(twoShots(), through(twoShots(), [{ op: "item.add", item: title("t", 70, 60) }]), at(twoShots(), 55), A, false).ops).toEqual([{ op: "item.set", id: "t", anchor: "start", at: 51 }]);
  });

  it("ends: one within ON of the frame or further than NEAR is left; a length only a cut changed is not the answer's to hold", () => {
    for (const frames of [52, 57, 24, 86]) expect(snapped(55, [{ op: "item.set", id: "bar", frames }]).ops, `the bar set to ${frames} frames`).toEqual([]);
    // A call-out on the frame, its shot cut shorter: it now ends on 66, near the moment, but its own length is as it was.
    const shown = through(twoShots(), [{ op: "mark.add", shot: "s1", mark: go("c1", 1700) }]);
    const cut = through(shown, [{ op: "shot.trim", id: "s1", endMs: 2200 }]);
    expect(placed(cut).find((place) => place.thing.id === "c1")).toMatchObject({ at: 51, frames: 15 });
    expect(snapToMoment(shown, cut, at(shown, 55), A).ops).toEqual([]);
  });

  it("holds against the moment as the answer's own film shows it, when the answer also cut before it (S11)", () => {
    // The opening cut to 1200 ms: the moment is on frame 19 of the shorter film, "this" from frame 15.
    const opening: Op = { op: "shot.trim", id: "s1", startMs: 1200 };
    // A call-out on 1500 ms is on frame 9 there, 6 before the moment's start: held to 1700 ms. Against the film as handed in it
    // would be 42 frames off, and left.
    expect(snapped(55, [opening, { op: "mark.add", shot: "s1", mark: go("c1", 1500) }]).ops).toEqual([{ op: "mark.set", id: "c1", atMs: 1700 }]);
    // A title on frame 45 of the shorter film, 26 after the moment there: held to its start, 15 (not to 51, the old film's).
    expect(snapped(55, [opening, { op: "item.add", item: title("t", 45, 20) }]).ops).toEqual([{ op: "item.set", id: "t", anchor: "start", at: 15 }]);
    // On the moment there (frame 17), it is left.
    expect(snapped(55, [opening, { op: "item.add", item: title("t", 17, 20) }]).ops).toEqual([]);
    // An end: the title that stays, set to end on 30 of the shorter film, 11 after the moment there, ends on 19.
    const hooked = through(twoShots(), [{ op: "item.add", item: title("hook", 0, null) }]);
    expect(snapped(55, [opening, { op: "item.set", id: "hook", frames: 30 }], hooked).ops).toEqual([{ op: "item.set", id: "hook", frames: 19 }]);
    // The pause before it cut: the moment on s1-b, frame 49; a call-out there on 1500 ms (frame 39) is held on s1-b.
    const pause: Op[] = [{ op: "shot.split", id: "s1", atMs: 1200, newId: "s1-b" }, { op: "shot.trim", id: "s1", endMs: 1100 }, { op: "shot.trim", id: "s1-b", startMs: 1300 }];
    expect(snapped(55, [...pause, { op: "mark.add", shot: "s1-b", mark: go("c1", 1500) }]).ops).toEqual([{ op: "mark.set", id: "c1", atMs: 1700 }]);
  });

  it("holds nothing on a moment the answer itself cut out (S11)", () => {
    // s1 cut to 1200 ms takes "this" out with the moment's 1833 ms: a title 11 frames from where the moment was is left.
    expect(snapped(55, [{ op: "shot.trim", id: "s1", endMs: 1200 }, { op: "item.add", item: title("t", 40, 20) }]).ops).toEqual([]);
  });
});

describe("momentAgain: the moment found again in another edit by its take moment, the file and its ms (S11)", () => {
  it("is the moment itself on the edit it was taken on", () => {
    const edit = twoShots();
    for (const frame of [0, 30, 55, 68, 140, 155]) expect(momentAgain(edit, A, at(edit, frame)), `frame ${frame}`).toEqual(at(edit, frame));
  });

  it("follows a cut before it, and the pause before it cut, onto the frames of the shorter film", () => {
    const moment = at(twoShots(), 55);
    const opened = through(twoShots(), [{ op: "shot.trim", id: "s1", startMs: 1200 }]);
    expect(momentAgain(opened, A, moment)).toMatchObject({ frame: 19, shot: "s1", take: "t1", ms: 1833, start: 15, startMs: 1700, startShot: "s1" });
    const paused = through(twoShots(), [{ op: "shot.split", id: "s1", atMs: 1200, newId: "s1-b" }, { op: "shot.trim", id: "s1", endMs: 1100 }, { op: "shot.trim", id: "s1-b", startMs: 1300 }]);
    expect(momentAgain(paused, A, moment)).toMatchObject({ frame: 49, shot: "s1-b", ms: 1833, start: 45, startMs: 1700, startShot: "s1-b" });
  });

  it("is none where the edit no longer shows that moment", () => {
    expect(momentAgain(through(twoShots(), [{ op: "shot.trim", id: "s1", endMs: 1200 }]), A, at(twoShots(), 55))).toBeNull();
  });

  it("stays on its frame through a split on the moment and a push from there (Task 3's zoom here)", () => {
    const pushed = through(twoShots(), [
      { op: "shot.split", id: "s1", atMs: 1833, newId: "s1-z" },
      { op: "shot.set", id: "s1-z", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "out", part: [0, 0.7] } } },
    ]);
    expect(momentAgain(pushed, A, at(twoShots(), 55))).toMatchObject({ frame: 55, shot: "s1-z", ms: 1833, start: 51, startMs: 1700, startShot: "s1" });
  });
});

describe("cleanCuts: every moment a cut may land on, in film order (the list timeCut lands on)", () => {
  it("case 9: gives each shot's start, each pause's cut@ inside a shot, and the film's end", () => {
    const cuts = cleanCuts(twoShots(), A);
    expect(cuts.map((cut) => cut.film)).toEqual([0, 1200, 2200, 5200]);
    expect(cuts).toEqual([
      { film: 0, index: 0, ms: 0 },
      { film: 1200, index: 0, ms: 1200 },
      { film: 2200, index: 1, ms: 3000 },
      { film: 5200, index: 1, ms: 6000 },
    ]);
  });
});

describe("landed and stayedWhole: the proof's measures (case 10, on the moment at 55)", () => {
  it("starts: one new thing whose first frame lies from the moment's start, less ON, to the frame, plus ON", () => {
    const before = twoShots();
    const moment = at(before, 55);
    expect(landed("starts", moment, before, through(before, [{ op: "item.add", item: title("go", 53, 75) }]))).toBe(true);
    expect(landed("starts", moment, before, through(before, [{ op: "item.add", item: title("go", 60, 75) }]))).toBe(false);
    // Two new things are not the one asked.
    expect(landed("starts", moment, before, through(before, [{ op: "item.add", item: title("go", 53, 75) }, { op: "item.add", item: title("go2", 53, 75) }]))).toBe(false);
  });

  it("ends: the one title showing on the frame now ends on it, its start as it was, no other length changed", () => {
    const before = through(twoShots(), [{ op: "item.add", item: title("hook", 0, null) }]);
    const moment = at(before, 55);
    expect(landed("ends", moment, before, through(before, [{ op: "item.set", id: "hook", frames: 55 }]))).toBe(true);
    expect(landed("ends", moment, before, through(before, [{ op: "item.set", id: "hook", frames: 50 }]))).toBe(false);
    expect(landed("ends", moment, before, through(before, [{ op: "item.set", id: "hook", frames: 55 }, { op: "item.set", id: "bar", frames: 55 }]))).toBe(false);
  });

  it("word: the words whose stress changed are exactly the word under the frame", () => {
    // The fixture's w3 is stressed already: the moment is taken on the edit with that stress off, so that stressing it is a change.
    const before = through(twoShots(), [{ op: "word.set", asset: "t1", index: 3, stress: false }]);
    const moment = at(before, 55);
    expect(landed("word", moment, before, through(before, [{ op: "word.set", asset: "t1", index: 3, stress: true }]))).toBe(true);
    expect(landed("word", moment, before, through(before, [{ op: "word.set", asset: "t1", index: 2, stress: true }, { op: "word.set", asset: "t1", index: 3, stress: true }]))).toBe(false);
  });

  it("cut: shorter, the word under the frame gone, and every word gone of its sentence", () => {
    const before = twoShots();
    const moment = at(before, 55);
    expect(landed("cut", moment, before, through(before, [{ op: "shot.trim", id: "s1", endMs: 1200 }]))).toBe(true);
    expect(landed("cut", moment, before, through(before, [{ op: "shot.trim", id: "s1", endMs: 1200 }, { op: "shot.trim", id: "s2", startMs: 3700 }]))).toBe(false);
  });

  it("zoom: tighter from the frame, within ON, by 0.05 half a second on, and nowhere outside the shot under it", () => {
    const before = twoShots();
    const moment = at(before, 55);
    const push = through(before, [
      { op: "shot.split", id: "s1", atMs: 1833, newId: "s1-z" },
      { op: "shot.set", id: "s1-z", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "out", part: [0, (2400 - 1833) / 400] } } },
    ]);
    expect(landed("zoom", moment, before, push)).toBe(true);
    const whole = through(before, [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } }]);
    expect(landed("zoom", moment, before, whole)).toBe(false);
    // The push, and s2 zoomed further too: a frame outside the shot under the moment differs.
    expect(landed("zoom", moment, before, through(push, [{ op: "shot.set", id: "s2", framing: { from: { zoom: 1.3, x: 0, y: 0 }, move: null } }]))).toBe(false);
  });

  it("stayedWhole pauses: at least two of the take's pauses show fewer ms", () => {
    const before = twoShots();
    const both = through(before, [
      { op: "shot.split", id: "s1", atMs: 1200, newId: "s1-b" },
      { op: "shot.trim", id: "s1", endMs: 1100 },
      { op: "shot.trim", id: "s1-b", startMs: 1300, endMs: 2350 },
    ]);
    expect(stayedWhole("pauses", before, both, A)).toBe(true);
    expect(stayedWhole("pauses", before, through(before, [{ op: "shot.trim", id: "s1", endMs: 2350 }]), A)).toBe(false);
  });

  it("stayedWhole look: the film's look changed and no shot's own", () => {
    const before = twoShots();
    expect(stayedWhole("look", before, through(before, [{ op: "look.set", preset: "cool" }]), A)).toBe(true);
    expect(stayedWhole("look", before, through(before, [{ op: "look.set", shot: "s1", preset: "cool" }]), A)).toBe(false);
    expect(stayedWhole("look", before, through(before, [{ op: "look.set", preset: "cool" }, { op: "look.clear", shot: "s2" }]), A)).toBe(false);
  });

  it("stayedWhole title-out: no title is placed", () => {
    const before = through(twoShots(), [{ op: "item.add", item: title("hook", 0, null) }]);
    expect(stayedWhole("title-out", before, through(before, [{ op: "item.remove", id: "hook" }]), A)).toBe(true);
    expect(stayedWhole("title-out", before, through(before, [{ op: "item.set", id: "hook", frames: 30 }]), A)).toBe(false);
  });

  it("stayedWhole faster: every shot plays at 1.25", () => {
    const before = twoShots();
    expect(stayedWhole("faster", before, through(before, [{ op: "shot.set", id: "s1", speed: 1.25 }, { op: "shot.set", id: "s2", speed: 1.25 }]), A)).toBe(true);
    expect(stayedWhole("faster", before, through(before, [{ op: "shot.set", id: "s1", speed: 1.25 }]), A)).toBe(false);
  });

  it("stayedPut start: every new thing starts within ON of the film's first frame; at least one is new", () => {
    const before = twoShots();
    const moment = at(before, 55);
    expect(stayedPut("start", moment, before, through(before, [{ op: "item.add", item: title("go", 0, 45) }]))).toBe(true);
    expect(stayedPut("start", moment, before, through(before, [{ op: "item.add", item: title("go", 3, 45) }]))).toBe(true);
    expect(stayedPut("start", moment, before, through(before, [{ op: "item.add", item: title("go", 4, 45) }]))).toBe(false);
    // Put on the moment, as the tag would pull it: not where the request named.
    expect(stayedPut("start", moment, before, through(before, [{ op: "item.add", item: title("go", 51, 45) }]))).toBe(false);
    expect(stayedPut("start", moment, before, through(before, [{ op: "item.add", item: title("go", 0, 45) }, { op: "item.add", item: title("go2", 60, 30) }]))).toBe(false);
    expect(stayedPut("start", moment, before, through(before, [{ op: "captions.set", size: 80 }]))).toBe(false);
  });

  it("stayedPut end: every new thing shows on the film's last frame, within ON, and starts after the moment", () => {
    const before = twoShots();
    const moment = at(before, 55);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 120, 36) }]))).toBe(true);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 120, 33) }]))).toBe(true);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 120, 32) }]))).toBe(false);
    // Counted back from the end, to the end: an end card.
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: { ...title("go", 60, null), anchor: "end" } }]))).toBe(true);
    // From the moment to the end, or from the film's start: not an end card.
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 58, null) }]))).toBe(false);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 59, null) }]))).toBe(true);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 0, 45) }]))).toBe(false);
    expect(stayedPut("end", moment, before, before)).toBe(false);
  });

  it("stayedPut end: an end card that shows for fewer than READABLE_END frames cannot be read, and does not count", () => {
    const before = twoShots();
    const moment = at(before, 55);
    expect(READABLE_END).toBe(24);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 132, 24) }]))).toBe(true);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: title("go", 133, 23) }]))).toBe(false);
    // Counted back from the end 3 frames, for 90: it shows for the 3 frames the film has left (seen twice on the real model).
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: { ...title("go", 3, 90), anchor: "end" } }]))).toBe(false);
    expect(stayedPut("end", moment, before, through(before, [{ op: "item.add", item: { ...title("go", 90, 90), anchor: "end" } }]))).toBe(true);
  });
});

describe("zoomHere: the zoom starts on the moment, a split there and a push (slice B, Task 3)", () => {
  /** The errors of an edit, as the loop tells them apart (`sameAs`). */
  const errorsOf = (edit: Edit, analyses: Analyses = A) => new Set(review(edit, analyses).filter((finding) => finding.severity === "error").map(sameAs));
  /** The errors `after` has that `before` did not. */
  const fresh = (before: Edit, after: Edit, analyses: Analyses = A) => [...errorsOf(after, analyses)].filter((key) => !errorsOf(before, analyses).has(key));
  const zoomed = (edit: Edit, frame: number, zoom: number = ZOOM.most, slow = false, analyses: Analyses = A) => {
    const moment = momentFor(edit, analyses, frame);
    if (!moment) throw new Error(`no moment at frame ${frame}`);
    return zoomHere(edit, analyses, moment, zoom, slow, []);
  };
  function made(edit: Edit, frame: number, zoom: number = ZOOM.most, slow = false, analyses: Analyses = A) {
    const found = zoomed(edit, frame, zoom, slow, analyses);
    if ("none" in found) throw new Error(`no zoom at frame ${frame}: ${found.none}`);
    return found;
  }
  const framingOf = (edit: Edit, id: string) => edit.shots.find((shot) => shot.id === id)?.framing;
  /** The fixture's face closer to the lens (0.3 to 0.7, its mouth 0.61 to 0.69), the pauses as they are. */
  const CLOSE: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ms: sample.ms, face: box(0.2, 0.3, 0.6, 0.4), mouth: box(0.4, 0.61, 0.2, 0.08) })) }) };
  /** That face boxed in on s1's own frames, with the captions off: a title just over it, a call-out just under it. */
  const boxedIn = (): Edit => through(twoShots(), [
    { op: "captions.set", on: false },
    { op: "item.add", item: { id: "hook", part: "title", anchor: "start", at: 0, frames: 66, props: { text: "Back at it", font: "tiktok", look: "bold", y: 0.26, size: ROOM_PROBE.size, color: "#ffffff", accent: null } } },
    { op: "item.add", item: { id: "low", part: "callout", anchor: "start", at: 0, frames: 66, props: { text: ROOM_PROBE.line, font: "tiktok", look: "pop", x: 0.5, y: 0.74, size: ROOM_PROBE.size, color: "#ffffff" } } },
  ]);

  it("is 400 ms", () => {
    expect(PUSH_MS).toBe(400);
  });

  it("case 1: at 40, in a pause 4 frames from its cut@, splits the shot on the moment and pushes in from the footage's framing to the next cut", () => {
    const e = twoShots();
    const zoom = made(e, 40);
    expect(zoom.ops).toEqual([
      { op: "shot.split", id: "s1", atMs: 1333, newId: "s1-z" },
      // The punch-in's own target (the mouth's bottom held), reached in 400 ms of the piece's 1067.
      { op: "shot.set", id: "s1-z", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.3, x: 0, y: -0.06 }, ease: "out", part: [0, 1067 / 400] } } },
    ]);
    expect(zoom.to).toBe(1.3);
    // The sentence w2-w3 ends at 2100; its pause's cut@, 2700, is past s1's end: the piece runs to the cut into s2, which owns 66 on.
    expect(zoom).toMatchObject({ says: "from here to the next cut", first: 40, last: 65 });
    const after = through(e, zoom.ops);
    expect(fresh(e, after)).toEqual([]);
    expect(landed("zoom", at(e, 40), e, after)).toBe(true);
    // A split that removes nothing: the footage runs on, one run as before (so one sound), and the film is as long.
    expect(layout(after).runs.length).toBe(layout(e).runs.length);
    expect(layout(after).frames).toBe(layout(e).frames);
    // Nothing jumps where the push starts.
    const [head, piece] = [after.shots[0], after.shots[1]];
    if (!head || !piece) throw new Error("no pieces");
    expect(framingAt(head, head.endMs)).toEqual(framingAt(piece, piece.startMs));
  });

  it("case 2: at 37, one frame from the pause's cut@ at 36: split there, and a still punch-in, the house's own look", () => {
    const e = twoShots();
    const zoom = made(e, 37);
    expect(zoom.ops[0]).toEqual({ op: "shot.split", id: "s1", atMs: 1200, newId: "s1-z" });
    expect(zoom.ops).toHaveLength(2);
    expect(zoom.ops[1]).toEqual({ op: "shot.set", id: "s1-z", framing: { from: { zoom: 1.3, x: 0, y: -0.06 }, move: null } });
    expect(zoom).toMatchObject({ first: 36, last: 65, says: "from here to the next cut" });
    expect(fresh(e, through(e, zoom.ops))).toEqual([]);
  });

  it("case 3: at 2, two frames from s1's start: no split on the moment; the zoom covers s1 from its start, to the pause after its sentence", () => {
    const e = twoShots();
    const zoom = made(e, 2);
    // The sentence w0-w1 ends at 800; the pause's cut@ at 1200 lies in s1 with room before and after: the zoom ends there.
    expect(zoom.ops[0]).toEqual({ op: "shot.split", id: "s1", atMs: 1200, newId: "s1-b" });
    // From the film's start a still punch-in passes: the cut back out at 1200 lies in the pause.
    expect(zoom.ops[1]).toEqual({ op: "shot.set", id: "s1", framing: { from: { zoom: 1.3, x: 0, y: -0.06 }, move: null } });
    expect(zoom.ops).toHaveLength(2);
    expect(zoom).toMatchObject({ first: 0, last: 35, says: "from here to the end of the sentence" });
    expect(fresh(e, through(e, zoom.ops))).toEqual([]);
  });

  it("case 4: with no framing that keeps the texts clear of the face, says why, and makes no op (the shot is not split)", () => {
    const e = boxedIn();
    expect([...errorsOf(e, CLOSE)].filter((key) => !errorsOf(through(twoShots(), [{ op: "captions.set", on: false }]), CLOSE).has(key))).toEqual([]);
    expect(zoomed(e, 40, ZOOM.most, false, CLOSE)).toEqual({ none: 'shot "s1" has no room to zoom in: a title or a call-out shows over it, and the face would run into it' });
  });

  it("case 5: at 100, in s2 at 1.2 already: split on the moment, the push from 1.2, and nothing jumps at the join", () => {
    const e = twoShots();
    const zoom = made(e, 100);
    expect(zoom.ops[0]).toEqual({ op: "shot.split", id: "s2", atMs: 4133, newId: "s2-z" });
    expect(zoom.ops[1]).toEqual({ op: "shot.set", id: "s2-z", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: { to: { zoom: 1.3, x: 0.07, y: -0.02 }, ease: "out", part: [0, (6000 - 4133) / 400] } } });
    // The sentence w4-w5 ends at 4000, and no pause of the take comes after it: to the film's end.
    expect(zoom).toMatchObject({ first: 100, last: 155, says: "from here to the end" });
    const after = through(e, zoom.ops);
    const [before, piece] = [after.shots.find((shot) => shot.id === "s2"), after.shots.find((shot) => shot.id === "s2-z")];
    if (!before || !piece) throw new Error("no pieces");
    expect(framingAt(before, before.endMs)).toEqual(piece.framing.from);
    expect(fresh(e, after)).toEqual([]);
  });

  it("case 6: a push made here before is made again from where it started, to less, with no split", () => {
    const e = twoShots();
    const first = made(e, 40);
    const pushed = through(e, first.ops);
    const again = made(pushed, 50, 1.1);
    expect(again.ops).toEqual([
      { op: "shot.set", id: "s1-z", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.1, x: 0, y: -0.06 }, ease: "out", part: [0, 1067 / 400] } } },
    ]);
    expect(again).toMatchObject({ says: "from where it started", first: 40, last: 65, to: 1.1 });
    expect(again.to).toBeLessThan(first.to);
  });

  it("ends at the pause after the sentence when it lies in the piece, the push and a tenth of a second before it", () => {
    // At 20 "there" (w1) is being said; its sentence w0-w1 ends at 800 and the pause's cut@ is 1200: 533 ms after the split.
    const e = twoShots();
    const zoom = made(e, 20);
    expect(zoom.ops.slice(0, 2)).toEqual([
      { op: "shot.split", id: "s1", atMs: 667, newId: "s1-z" },
      { op: "shot.split", id: "s1-z", atMs: 1200, newId: "s1-z-b" },
    ]);
    expect(zoom.ops[2]).toEqual({ op: "shot.set", id: "s1-z", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.3, x: 0, y: -0.06 }, ease: "out", part: [0, (1200 - 667) / 400] } } });
    expect(zoom).toMatchObject({ first: 20, last: 35, says: "from here to the end of the sentence" });
    const after = through(e, zoom.ops);
    expect(fresh(e, after)).toEqual([]);
    // After the piece the footage's own framing again: the cut back lies in the pause.
    expect(framingOf(after, "s1-z-b")).toEqual(framingOf(e, "s1"));
  });

  it("within ON frames of the shot's end, where no clean cut of its own is: the shot whole from its own start, a clean cut, and its say tells it", () => {
    const zoom = made(twoShots(), 64);
    expect(zoom.ops).toEqual([{ op: "shot.set", id: "s1", framing: { from: { zoom: 1.3, x: 0, y: -0.06 }, move: null } }]);
    expect(zoom).toMatchObject({ first: 0, last: 65, says: "from the start of this shot to the next cut" });
  });

  it("on a shot's own start in speech, a clean cut by the list but no place for a cut: the still punch-in is refused, so it pushes", () => {
    // s1 split on "this" (1700 ms, frame 51) with nothing else changed: the footage runs on, so the split is no cut.
    const e = through(twoShots(), [{ op: "shot.split", id: "s1", atMs: 1700, newId: "s1-x" }]);
    expect(zoomFor(e, A, "s1-x", 1.3, false)).toMatchObject({ none: expect.stringContaining("in speech") });
    const zoom = made(e, 52);
    expect(zoom.ops).toEqual([{ op: "shot.set", id: "s1-x", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.3, x: 0, y: -0.06 }, ease: "out", part: [0, 700 / 400] } } }]);
    expect(zoom).toMatchObject({ first: 51, says: "from here to the next cut" });
    expect(fresh(e, through(e, zoom.ops))).toEqual([]);
  });

  it("a piece shorter than the push (4 to 11 frames before the shot's end): the push takes the whole piece and gets to its zoom; it can be made again", () => {
    // At 150, six frames before the film's end: s2 split at 5800 leaves 200 ms, half the push.
    const e = twoShots();
    const zoom = made(e, 150);
    expect(zoom.ops[0]).toEqual({ op: "shot.split", id: "s2", atMs: 5800, newId: "s2-z" });
    expect(zoom.ops[1]).toMatchObject({ op: "shot.set", id: "s2-z", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: { ease: "out", part: [0, 1] } } });
    const after = through(e, zoom.ops);
    const piece = after.shots.find((shot) => shot.id === "s2-z");
    if (!piece) throw new Error("no piece");
    expect(isPush(piece.framing)).toBe(true);
    // At the piece's end it is at the zoom the block and the say tell, not part way up its ease.
    expect(framingAt(piece, piece.endMs).zoom).toBeCloseTo(zoom.to, 9);
    expect(landed("zoom", at(e, 150), e, after)).toBe(true);
    // Asked again, it is the push made again, not "moves already".
    const again = made(after, 152, 1.25);
    expect(again.ops).toEqual([{ op: "shot.set", id: "s2-z", framing: expect.objectContaining({ from: { zoom: 1.2, x: 0, y: 0 }, move: expect.objectContaining({ to: expect.objectContaining({ zoom: 1.25 }), part: [0, 1] }) }) }]);
    // The longest such piece, 11 frames (367 ms): the same.
    const eleven = made(e, 145).ops[1];
    expect(eleven).toMatchObject({ op: "shot.set", id: "s2-z", framing: { move: { part: [0, 1] } } });
  });

  it("slow: the push takes the whole piece", () => {
    const zoom = made(twoShots(), 40, ZOOM.most, true);
    expect(zoom.ops[1]).toMatchObject({ op: "shot.set", id: "s1-z", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { ease: "out", part: [0, 1] } } });
  });

  it("refuses a shot that moves already in another way, and one whose file is too small to enlarge, naming the creator's shot", () => {
    const slow = zoomFor(twoShots(), A, "s1", 1.3, true);
    if (!("framing" in slow)) throw new Error(`no slow zoom: ${slow.none}`);
    const moving = through(twoShots(), [{ op: "shot.set", id: "s1", framing: slow.framing }]);
    expect(zoomed(moving, 40)).toEqual({ none: 'shot "s1" moves already: set its framing plain first, or leave it' });
    // A 540x960 take may not be enlarged at all (2 x 540 / 1080 = 1).
    const small = { ...twoShots(), assets: twoShots().assets.map((asset) => (asset.kind === "video" ? { ...asset, w: 540, h: 960 } : asset)) };
    expect(zoomed(small, 40)).toEqual({ none: 'shot "s1" cannot be enlarged further: its file is too small' });
  });

  it("changes nothing it is given", () => {
    const e = twoShots();
    const [edit, analyses] = [structuredClone(e), structuredClone(A)];
    made(edit, 40);
    expect(edit).toEqual(e);
    expect(analyses).toEqual(A);
  });

  it("case 9: isPush is a move eased out from 0 that gets to its end within the shot; not a slow zoom, not a still one", () => {
    const pushed = made(twoShots(), 40).ops[1];
    if (pushed?.op !== "shot.set" || !pushed.framing) throw new Error("no push");
    expect(isPush(pushed.framing)).toBe(true);
    const slow = zoomFor(twoShots(), A, "s1", 1.3, true);
    const still = zoomFor(twoShots(), A, "s1", 1.3, false);
    if (!("framing" in slow) || !("framing" in still)) throw new Error("no zoom");
    expect(slow.framing.move?.ease).toBe("linear");
    expect(isPush(slow.framing)).toBe(false);
    expect(isPush(still.framing)).toBe(false);
  });

  it("case 8: the block's zoom line tells what shot.zoom does here, or why it cannot", () => {
    const e = twoShots();
    expect(momentBlock(at(e, 40), e, A, true)).toMatch(/^zoom: shot\.zoom on s1 starts on this frame; the code splits the shot here and pushes in until frame \d+, the next cut; up to 1\.\d+$/m);
    expect(momentBlock(at(e, 20), e, A, true).split("\n")[6]).toMatch(/^zoom: shot\.zoom on s1 starts on this frame; the code splits the shot here and pushes in until frame 36, the end of the sentence; up to 1\.\d+$/);
    expect(momentBlock(at(e, 37), e, A, true).split("\n")[6]).toMatch(/^zoom: shot\.zoom on s1 starts on this frame; the code splits the shot here and punches in until frame 66, the next cut; up to 1\.\d+$/);
    expect(momentBlock(at(e, 64), e, A, true).split("\n")[6]).toMatch(/^zoom: shot\.zoom on s1 starts at frame 0, where the shot starts; the code punches in until frame 66, the next cut; up to 1\.\d+$/);
    expect(momentBlock(at(e, 100), e, A, true).split("\n")[6]).toMatch(/^zoom: shot\.zoom on s2 starts on this frame; the code splits the shot here and pushes in until frame 156, the film's end; up to 1\.\d+$/);
    const boxed = boxedIn();
    const moment = momentFor(boxed, CLOSE, 40);
    if (!moment) throw new Error("no moment");
    expect(momentBlock(moment, boxed, CLOSE, true).split("\n")[6]).toBe('zoom: none here: shot "s1" has no room to zoom in: a title or a call-out shows over it, and the face would run into it');
  });
});

describe("offTheStart: a thing added with a moment does not fall back to the film's start (S15, S16)", () => {
  const go = (id: string, atMs: number, lenMs = 1000): Mark => ({ id, part: "callout", atMs, lenMs, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } });
  const pop = (id: string, frames: number | null): Item => ({ id, part: "sound", anchor: "start", at: 0, frames, asset: "pop", props: { startMs: 0, volume: 0.8, fadeInMs: 0, fadeOutMs: 100 } });
  /** The answer's ops with the code's move, on the moment of the fixture at `frame`, for a request that names no start. */
  const lifted = (frame: number, ops: Op[], request = "Add a title: Go", before = twoShots()) => offTheStart(before, ops, at(before, frame), A, request, []);

  it("names another place by its words (the start, the end, the whole film) or by a time, whole and in any case (S17 (1))", () => {
    const start = ["Put it at the start", "BEGINNING", "begin with a title", "an opening title", "the intro", "a hook title", "the first second", "an Opener", "at the top"];
    const end = ["Add an end card", "at the END", "the ending", "an outro", "the last word", "a final title", "at the finish"];
    const whole = ["Zoom in on the whole video", "the entire clip", "all of it", "every shot", "Add zooms everywhere", "throughout", "on each cut", "always on"];
    // A time is a place as a clock's, or after at, from, to or until (I2).
    const times = ["Add a call-out at 0:07: Go", "Add a title at 0:07: New drop", "at 7s", "at 1.5s", "at 7 sec", "at 7 seconds", "from second 7", "until 7s", "to second 7"];
    // The proof's two controls name their place before the text to be written.
    const controls = ["Add a hook title at the start: New drop", "Add an end card that says Follow for more"];
    for (const request of [...start, ...end, ...whole, ...times, ...controls]) expect(namesAnotherPlace(request), request).toBe(true);
    const none = ["Add a title: Go", "Zoom in", "Zoom in here", "Add a call-out: Link in bio", "it starts here", 'Add the word "start" as a title', 'Add a title "The end"', "a firstly odd one", "hooked", "openers", "stop", "ended", "allow it", "everything", "a second look", "7 frames"];
    // The text to be written is not read for a place (I2): after the first colon that is no clock's, after says, saying, reads,
    // reading, called, titled. Nor is a length a place: "for 3 seconds", "3 seconds long".
    const written = ["Add a title: Top 3 tips", "Add a title that says My first vlog", "Add a call-out: Every creator needs this", "Add a title for 3 seconds: New drop", "a title 3 seconds long", "a title reading The end of it", "a call-out saying All in", "a title called Last call", "a card titled Final words", "a title that reads Always on", "for 7 seconds"];
    for (const request of [...none, ...written]) expect(namesAnotherPlace(request), request).toBe(false);
  });

  it("an item added at frame 0 with a length of its own starts on the moment, its length kept", () => {
    // At 55 "this" (w3) is being said from frame 51: the moment's start, as the hold's.
    expect(lifted(55, [{ op: "item.add", item: title("t", 0, 60) }])).toEqual({ ops: [{ op: "item.add", item: title("t", 0, 60) }, { op: "item.set", id: "t", at: 51 }], moved: ["t"] });
    // A sound of its file's length (the pop is 500 ms: the door takes no longer).
    expect(lifted(55, [{ op: "item.add", item: pop("p", 15) }])).toEqual({ ops: [{ op: "item.add", item: pop("p", 15) }, { op: "item.set", id: "p", at: 51 }], moved: ["p"] });
  });

  it("a thing meant for the whole film, with no length of its own (to the film's end), is left on frame 0 (S16)", () => {
    for (const item of [pop("bed", null), title("t", 0, null)]) expect(lifted(55, [{ op: "item.add", item }])).toEqual({ ops: [{ op: "item.add", item }], moved: [] });
  });

  it("its length is cut at the film's end; closer to the end than the least the door takes, it starts that much before the end (S16)", () => {
    // At 150 (0:05), six frames before the film's end: 60 frames are cut to 6; a mark's 1000 ms to 200, moved to s2.
    expect(lifted(150, [{ op: "item.add", item: title("t", 0, 60) }]).ops.at(-1)).toEqual({ op: "item.set", id: "t", at: 150, frames: 6 });
    expect(lifted(150, [{ op: "mark.add", shot: "s1", mark: go("c", 0) }]).ops.slice(1)).toEqual([{ op: "mark.remove", id: "c" }, { op: "mark.add", shot: "s2", mark: { ...go("c", 0), atMs: 5800, lenMs: 200 } }]);
    // The film's last frame (155) and the one before: it starts on 153, three frames (MIN_FRAMES) before the end, and fills them.
    for (const frame of [155, 154]) {
      expect(lifted(frame, [{ op: "item.add", item: title("t", 0, 60) }]).ops.at(-1), `paused on ${frame}`).toEqual({ op: "item.set", id: "t", at: 156 - MIN_FRAMES, frames: MIN_FRAMES });
      // A mark: on the moment the film shows on 153, for the least a mark takes.
      expect(lifted(frame, [{ op: "mark.add", shot: "s1", mark: go("c", 0) }]).ops.slice(1), `paused on ${frame}`).toEqual([{ op: "mark.remove", id: "c" }, { op: "mark.add", shot: "s2", mark: { ...go("c", 0), atMs: 5900, lenMs: MIN_MARK_MS } }]);
    }
    const ending = through(twoShots(), [{ op: "item.add", item: title("t", 0, 60) }, { op: "item.set", id: "t", at: 153, frames: MIN_FRAMES }]);
    expect(placed(ending).find((place) => place.thing.id === "t")).toMatchObject({ at: 153, frames: 3 });
  });

  it("a mark at the first moment of the film's first shot: onto the moment's shot and moment, with its id", () => {
    expect(lifted(55, [{ op: "mark.add", shot: "s1", mark: go("c", 0) }])).toEqual({ ops: [{ op: "mark.add", shot: "s1", mark: go("c", 0) }, { op: "mark.set", id: "c", atMs: 1700 }], moved: ["c"] });
    // At 100 the moment is on s2 at 4133 ms: the mark moves there.
    expect(lifted(100, [{ op: "mark.add", shot: "s1", mark: go("c", 0) }]).ops.slice(1)).toEqual([{ op: "mark.remove", id: "c" }, { op: "mark.add", shot: "s2", mark: { ...go("c", 0), atMs: 4133 } }]);
  });

  it("leaves what the model put anywhere else, a thing the edit had, an item counted from the end, a bar, and a request that names the start", () => {
    const left = (frame: number, ops: Op[], request?: string, before?: Edit) => expect(lifted(frame, ops, request, before)).toEqual({ ops, moved: [] });
    left(55, [{ op: "item.add", item: title("t", 20, 60) }]);
    left(55, [{ op: "mark.add", shot: "s1", mark: go("c", 300) }]);
    left(55, [{ op: "item.add", item: { ...title("t", 0, 60), anchor: "end" } }]);
    left(55, [{ op: "item.add", item: { id: "bar2", part: "progress", anchor: "start", at: 0, frames: null, props: { edge: "bottom", color: "#ffffff" } } }]);
    left(55, [{ op: "item.add", item: title("t", 0, 60) }], "Put a title at the start");
    left(55, [{ op: "item.add", item: title("t", 0, 60) }], "A title for the opener");
    // Any other place the request names, by S17's one test: the end, the whole film, a time.
    left(55, [{ op: "item.add", item: title("t", 0, 60) }], "Add a title at the end");
    left(55, [{ op: "item.add", item: title("t", 0, 60) }], "Add a title over the whole video");
    left(55, [{ op: "item.add", item: title("t", 0, 60) }], "Add a title at 0:03");
    // The fixture's own title, moved to frame 0 by the answer: the model's to place.
    const hooked = through(twoShots(), [{ op: "item.add", item: title("hook", 30, 60) }]);
    left(55, [{ op: "item.set", id: "hook", at: 0 }], undefined, hooked);
  });

  it("moves nothing when the moment is at the film's start, when the answer cut the moment out, or when the door would refuse the answer", () => {
    expect(lifted(2, [{ op: "item.add", item: title("t", 0, 60) }])).toEqual({ ops: [{ op: "item.add", item: title("t", 0, 60) }], moved: [] });
    const cut: Op[] = [{ op: "shot.trim", id: "s1", endMs: 1200 }, { op: "item.add", item: title("t", 0, 60) }];
    expect(lifted(55, cut)).toEqual({ ops: cut, moved: [] });
    const refused = [{ op: "item.add", item: title("t", 0, 60) }, { op: "item.set", id: "nothing", at: 3 }];
    expect(lifted(55, refused as Op[])).toEqual({ ops: refused, moved: [] });
  });

  it("follows the moment onto the film the answer made, when it also cut before it (S11)", () => {
    // The opening cut to 1200 ms: the moment is on frame 19, "this" from 15.
    expect(lifted(55, [{ op: "shot.trim", id: "s1", startMs: 1200 }, { op: "item.add", item: title("t", 0, 60) }]).ops.at(-1)).toEqual({ op: "item.set", id: "t", at: 15 });
  });

  it("changes nothing it is given", () => {
    const [edit, ops] = [twoShots(), [{ op: "item.add", item: title("t", 0, 60) }] as Op[]];
    const [editBefore, opsBefore] = [structuredClone(edit), structuredClone(ops)];
    offTheStart(edit, ops, at(edit, 55), A, "Add a title: Go", []);
    expect([edit, ops]).toEqual([editBefore, opsBefore]);
  });
});

describe("endsAsked: the block offers the numbers that end what is showing only to a request that points and names an ending (I3)", () => {
  it("points and names an ending: end, ends, ending, stop, stops, until, hide, remove, off; whole words, any case, not in the text to be written", () => {
    for (const request of ["End the title here.", "Stop the music here", "the bar ENDS now", "until here", "hide this", "remove it here", "turn this off", "Keep it until now", "Let the call-out stop here"]) expect(endsAsked(request), request).toBe(true);
    // Pointing with no ending (the page's own buttons), an ending with no pointing, and an ending only in the text to be written.
    for (const request of ["Zoom in less here.", "Keep only one title here.", "Make the captions bigger now", "End the title.", "Add a title here: Stop scrolling", 'Add "the end" here', "Add a title here that says Off we go", "endless here"]) expect(endsAsked(request), request).toBe(false);
  });
});

describe("startedSay: the code's sentence for an answer whose added thing it put on the moment (S15, S16)", () => {
  /** The fixture as the door writes it (a stored edit is), so that what is compared is what changed. */
  const stored = (): Edit => through(twoShots(), [{ op: "captions.set", on: true }]);
  const go = (id: string): Mark => ({ id, part: "callout", atMs: 1700, lenMs: 1000, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } });

  it("tells where the thing starts, read back from the film: the said word's first frame, not the paused frame", () => {
    // Paused on 61 (0:02), "this" said from 51 (0:01): the title starts on 51.
    const was = stored();
    const edit = through(was, offTheStart(was, [{ op: "item.add", item: title("t", 0, 60) }], at(was, 61), A, "Add a title: Go", []).ops as Op[]);
    const start = placed(edit).find((place) => place.thing.id === "t")?.at;
    expect(start).toBe(51);
    expect(startedSay(was, edit, ["t"])).toBe("The title is on at 0:01.");
  });

  it("alone when the moved thing is the only change; then the code's own words for the rest, as one answer", () => {
    const was = stored();
    // Low, clear of the face when the picture is pushed in.
    const low: Item = { ...title("t", 51, 60), props: { text: "Go", font: "tiktok", look: "bold", y: 0.6, size: 96, color: "#ffffff", accent: null } } as Item;
    const titled = through(was, [{ op: "item.add", item: low }]);
    expect(startedSay(was, titled, ["t"])).toBe("The title is on at 0:01.");
    expect(startedSay(was, through(titled, [{ op: "captions.set", size: 80 }]), ["t"])).toBe("The title is on at 0:01; the captions are bigger.");
    const pushed = zoomHere(titled, A, at(titled, 40), 1.3, false, []);
    if ("none" in pushed) throw new Error(pushed.none);
    expect(startedSay(was, through(titled, pushed.ops), ["t"])).toBe("The title is on at 0:01; the picture is closer in part of the video.");
  });

  it("names several things in one line where they start together, and each where they do not", () => {
    const was = stored();
    const both = through(was, [{ op: "item.add", item: title("t", 51, 60) }, { op: "mark.add", shot: "s1", mark: go("c") }]);
    expect(startedSay(was, both, ["t", "c"])).toBe("The call-out and the title are on at 0:01.");
    const apart = through(was, [{ op: "item.add", item: title("t", 100, 30) }, { op: "mark.add", shot: "s1", mark: go("c") }]);
    expect(startedSay(was, apart, ["t", "c"])).toBe("The call-out is on at 0:01; the title is on at 0:03.");
  });
});
