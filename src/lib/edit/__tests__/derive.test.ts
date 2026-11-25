import { describe, expect, it } from "vitest";
import { assetOf, captionFrames, coverFrame, easeAt, filmFrames, fontsOf, frameOf, framingAt, layout, lengthOf, lookOf, momentAt, momentOf, overlapOf, placed, runWords, runsOn, sharedAfter, shotOn } from "../derive";
import { NEUTRAL, newShot, type Edit, type Item, type Mark } from "../doc";
import { fixture, picture, voice } from "./fixture";

const sound = (atMs: number, lenMs = 660): Mark => ({ id: "w2", part: "sound", asset: "whoosh", atMs, lenMs, props: { startMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0 } });
const callout = (atMs: number, lenMs = 660): Mark => ({ id: "c2", part: "callout", atMs, lenMs, props: { text: "Now", font: "inter", look: "pop", x: 0.5, y: 0.3, size: 96, color: "#ffffff" } });
const titleProps = { text: "The end", font: "inter" as const, look: "bold" as const, y: 0.2, size: 96, color: "#ffffff", accent: null };
const hook = (atMs: number, lenMs = 660): Mark => ({ id: "t2", part: "title", atMs, lenMs, props: titleProps });
const title = (anchor: "start" | "end", at: number, frames: number | null): Extract<Item, { part: "title" }> => ({ id: "t1", part: "title", anchor, at, frames, props: titleProps });

/** The fixture with a change. */
const withEdit = (mutate: (edit: Edit) => void): Edit => {
  const edit = fixture();
  mutate(edit);
  return edit;
};
/** The fixture with its first shot cut in two at a moment of its file, so the second piece runs on from the first. */
const inPieces = (cutMs = 2000): Edit =>
  withEdit((e) => { e.shots.splice(0, 1, newShot({ id: "s1", asset: "take", endMs: cutMs }), newShot({ id: "s1b", asset: "take", startMs: cutMs, endMs: 5000 })); });
/** Where each placed thing shows: its id, first frame, frames and frames skipped. */
const shown = (edit: Edit) => placed(edit).map((p) => [p.thing.id, p.at, p.frames, p.skip]);
/** Moments to cut a five-second shot at: on frames, between them, and near both ends. */
const cuts = [100, 133, 134, 150, 167, 1000, 1010, 1017, 2000, 2530, 3333, 4800, 4867, 4900];

describe("where a run's captions show", () => {
  it("shows a run's captions up to where a transition out of it begins, and the last run's to its end", () => {
    const edit = withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 10 }; });
    const lay = layout(edit);
    expect([sharedAfter(edit, lay, 0), sharedAfter(edit, lay, 1)]).toEqual([10, 0]);
    expect([captionFrames(edit, lay, 0), captionFrames(edit, lay, 1)]).toEqual([{ at: 0, frames: 140 }, { at: 140, frames: 120 }]);
    expect(captionFrames(fixture(), layout(fixture()), 0)).toEqual({ at: 0, frames: 150 }); // a plain cut shares nothing
  });

  it("shows them on one frame at least, even when the transition is as long as the run", () => {
    const edit = withEdit((e) => {
      e.shots.splice(1, 0, { ...newShot({ id: "mid", asset: "take", startMs: 6000, endMs: 6400 }), out: { kind: "push", frames: 12, from: "left" } });
    });
    const lay = layout(edit);
    expect(lay.runs[1]?.frames).toBe(12);
    expect(captionFrames(edit, lay, 1)).toEqual({ at: lay.runs[1]!.at, frames: 1 });
  });
});

describe("where shots are on the film", () => {
  it("finds a file by id, and knows a clip's and a sound's length but none for a picture", () => {
    const edit = fixture();
    expect(assetOf(edit, "ghost")).toBeUndefined();
    expect(lengthOf(assetOf(edit, "take")!)).toBe(12700);
    expect(lengthOf(assetOf(edit, "whoosh")!)).toBe(677);
    expect(lengthOf(picture)).toBeNull();
  });

  it("lays the shots out one after another, each as many frames as its stretch of file fills", () => {
    expect(layout(fixture())).toEqual({
      frames: 270,
      shots: [{ at: 0, frames: 150, run: 0 }, { at: 150, frames: 120, run: 1 }],
      runs: [
        { first: 0, last: 0, at: 0, frames: 150, asset: "take", speed: 1, fromMs: 0, toMs: 5000 },
        { first: 1, last: 1, at: 150, frames: 120, asset: "take", speed: 1, fromMs: 8000, toMs: 12000 },
      ],
    });
    expect(filmFrames(fixture())).toBe(270);
  });

  it("fills fewer frames at a higher speed and more at a lower one", () => {
    expect(layout(withEdit((e) => { e.shots[0]!.speed = 2; })).shots[0]).toEqual({ at: 0, frames: 75, run: 0 });
    expect(layout(withEdit((e) => { e.shots[0]!.speed = 0.5; })).shots[0]).toEqual({ at: 0, frames: 300, run: 0 });
    expect(layout(withEdit((e) => { e.shots[0]!.speed = 1.37; })).shots[0]).toEqual({ at: 0, frames: 109, run: 0 }); // 109.49
  });

  it("starts the next shot early by a transition's length, and the film is shorter by it", () => {
    const edit = withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 10 }; });
    expect(overlapOf(edit.shots[0]!.out)).toBe(10);
    expect(layout(edit).shots.map((shot) => shot.at)).toEqual([0, 140]);
    expect(filmFrames(edit)).toBe(260);
  });

  it("takes nothing off the film for the last shot's cut", () => {
    expect(filmFrames(withEdit((e) => { e.shots[1]!.out = { kind: "fade", frames: 10 }; }))).toBe(270);
  });
});

describe("footage that runs on", () => {
  const head = newShot({ id: "a", asset: "take", endMs: 2000 });
  const next = (change: Partial<ReturnType<typeof newShot>> = {}) => ({ ...newShot({ id: "b", asset: "take", startMs: 2000, endMs: 5000 }), ...change });

  it("runs on when the next shot starts exactly where this one stops, in the same file at the same speed, after a plain cut", () => {
    expect(runsOn(head, next())).toBe(true);
    expect(runsOn(head, next({ startMs: 2001 }))).toBe(false);
    expect(runsOn(head, next({ startMs: 1999 }))).toBe(false);
    expect(runsOn(head, next({ asset: "broll" }))).toBe(false);
    expect(runsOn(head, next({ speed: 2 }))).toBe(false);
    expect(runsOn({ ...head, out: { kind: "fade", frames: 10 } }, next())).toBe(false);
  });

  it("makes one run of pieces that run on, and their frames add up to the frames of the whole wherever the cut is", () => {
    expect(layout(inPieces())).toEqual({
      frames: 270,
      shots: [{ at: 0, frames: 60, run: 0 }, { at: 60, frames: 90, run: 0 }, { at: 150, frames: 120, run: 1 }],
      runs: [
        { first: 0, last: 1, at: 0, frames: 150, asset: "take", speed: 1, fromMs: 0, toMs: 5000 },
        { first: 2, last: 2, at: 150, frames: 120, asset: "take", speed: 1, fromMs: 8000, toMs: 12000 },
      ],
    });
    for (const cut of cuts) {
      const lay = layout(inPieces(cut));
      expect([lay.frames, lay.runs[0]!.frames, lay.shots[0]!.frames + lay.shots[1]!.frames], `cut at ${cut} ms`).toEqual([270, 150, 150]);
      expect(lay.shots[1]!.at, `cut at ${cut} ms`).toBe(Math.round((cut * 30) / 1000));
    }
  });

  it("keeps pieces one run at another speed, as many frames as the whole would fill", () => {
    for (const speed of [0.5, 1.1, 1.37, 2, 4]) {
      for (const cut of cuts) {
        const pieces = inPieces(cut);
        pieces.shots[0]!.speed = speed;
        pieces.shots[1]!.speed = speed;
        const whole = withEdit((e) => { e.shots[0]!.speed = speed; });
        expect(layout(pieces).runs[0], `speed ${speed}, cut at ${cut} ms`).toEqual({ ...layout(whole).runs[0]!, last: 1 });
      }
    }
  });

  it("finds the shot of a run that a film frame belongs to", () => {
    const lay = layout(inPieces()); // the first run: frames 0 to 59, then 60 to 149
    const run = lay.runs[0]!;
    expect([0, 59, 60, 149].map((frame) => shotOn(lay, run, frame))).toEqual([0, 0, 1, 1]);
    expect([-5, 400].map((frame) => shotOn(lay, run, frame))).toEqual([0, 1]);
    expect(shotOn(lay, lay.runs[1]!, 200)).toBe(2);
  });

  it("starts a run early with its first shot when a transition leads into it", () => {
    const edit = withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 10 }; });
    expect(layout(edit).runs.map((run) => [run.at, run.frames])).toEqual([[0, 150], [140, 120]]);
  });
});

describe("where a mark shows", () => {
  it("lists every mark and item with its place on the film", () => {
    const edit = fixture();
    const [m1, w1] = edit.shots[1]!.marks;
    expect(placed(edit)).toEqual([
      { path: "shots.1.marks.0", thing: m1, shot: "s2", at: 178, frames: 22, skip: 0, fileMs: null }, // 920 ms into the shot, for 740 ms
      { path: "shots.1.marks.1", thing: w1, shot: "s2", at: 150, frames: 20, skip: 0, fileMs: 0 },
      { path: "items.0", thing: edit.items[0], shot: null, at: 0, frames: 270, skip: 0, fileMs: null },
    ]);
  });

  it("starts a mark by its footage's speed and lasts its length of film whatever the speed", () => {
    expect(shown(withEdit((e) => { e.shots[1]!.speed = 2; }))).toEqual([["m1", 164, 22, 0], ["w1", 150, 20, 0], ["bar", 0, 210, 0]]);
    expect(shown(withEdit((e) => { e.shots[1]!.speed = 0.5; }))).toEqual([["m1", 205, 22, 0], ["w1", 150, 20, 0], ["bar", 0, 390, 0]]);
  });

  it("ends a call-out when its footage does, and lets a sound, a cutaway and a title run on over the cut", () => {
    const cutaway: Mark = { id: "b2", part: "cutaway", asset: "broll", atMs: 4800, lenMs: 660, props: { fit: "cover", startMs: 0, volume: 0 } };
    const edit = withEdit((e) => { e.shots[0]!.marks = [callout(4800), sound(4800), cutaway, hook(4800)]; });
    expect(shown(edit).slice(0, 4)).toEqual([["c2", 144, 6, 0], ["w2", 144, 20, 0], ["b2", 144, 20, 0], ["t2", 144, 20, 0]]);
  });

  it("lets a call-out run on through a cut where its footage runs on", () => {
    const edit = inPieces();
    edit.shots[0]!.marks = [callout(1800)];
    expect(shown(edit)[0]).toEqual(["c2", 54, 20, 0]);
  });

  it("shows a mark when its run shows its moment, whichever piece of the run holds it", () => {
    const early = inPieces();
    early.shots[1]!.marks = [callout(1500)]; // held by the second piece, said in the first
    expect(shown(early)[0]).toEqual(["c2", 45, 20, 0]);
    const late = inPieces();
    late.shots[0]!.marks = [callout(2500)]; // held by the first piece, said in the second
    expect(shown(late)[0]).toEqual(["c2", 75, 20, 0]);
  });

  it("is already running when its moment is before what its footage shows, and gone when it would be over", () => {
    const edit = withEdit((e) => { e.shots[1]!.startMs = 9000; });
    expect(shown(edit)).toEqual([["m1", 150, 20, 2], ["bar", 0, 240, 0]]); // m1 began 80 ms before; the whoosh ended long before
  });

  it("counts what is already gone in film time, at the footage's speed", () => {
    const edit = withEdit((e) => { Object.assign(e.shots[1]!, { startMs: 9000, speed: 2 }); });
    expect(shown(edit)[0]).toEqual(["m1", 150, 21, 1]); // 80 ms of file at double speed are one frame of film
  });

  it("does not show when its moment comes after what its footage shows", () => {
    const edit = withEdit((e) => { e.shots[1]!.endMs = 8667; });
    expect(shown(edit)).toEqual([["w1", 150, 20, 0], ["bar", 0, 170, 0]]);
  });

  it("stops at the film's end, and keeps a mark in the footage's last instant on its last frame", () => {
    const edit = withEdit((e) => { e.shots[1]!.marks = [sound(11800), callout(11990, 100)]; });
    expect(shown(edit).slice(0, 2)).toEqual([["w2", 264, 6, 0], ["c2", 269, 1, 0]]);
  });

  it("is that much further into its file when a sound is already running, and stops when the file does", () => {
    const edit = withEdit((e) => {
      e.assets.push({ id: "tick", kind: "audio", origin: "kit", at: { kit: "sfx/tick.wav" }, ms: 690 });
      e.shots[1]!.startMs = 8167; // the shot now starts 5 frames into the sound
      e.shots[1]!.marks = [{ id: "k1", part: "sound", asset: "tick", atMs: 8000, lenMs: 690, props: { startMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0 } }];
    });
    expect(placed(edit)[0]).toMatchObject({ at: 150, frames: 16, skip: 5, fileMs: 167 }); // 690 ms reach into 21 frames, and 5 are gone
  });

  it("stays inside the film and inside its file even in an edit the check would refuse", () => {
    const short = withEdit((e) => { // a 30-frame fade into a 10-frame last shot: the film ends before the first run does
      e.shots[0]!.out = { kind: "fade", frames: 30 };
      e.shots[0]!.marks = [callout(4700)];
      e.shots[1] = newShot({ id: "s2", asset: "take", startMs: 8000, endMs: 8334 });
    });
    expect(filmFrames(short)).toBe(130);
    expect(shown(short)).toEqual([["bar", 0, 130, 0]]);
    expect(shown(withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 30 }; e.shots[0]!.marks = [callout(3600)]; e.shots[1] = newShot({ id: "s2", asset: "take", startMs: 8000, endMs: 8334 }); }))[0]).toEqual(["c2", 108, 20, 0]);
    const long = withEdit((e) => { e.shots[1]!.marks = [sound(8000, 1000)]; }); // a second of a 677 ms sound
    expect(shown(long)[0]).toEqual(["w2", 150, 21, 0]);
  });

  it("moves a mark with its shot when a transition starts the shot early", () => {
    const edit = withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 10 }; });
    expect(shown(edit)).toEqual([["m1", 168, 22, 0], ["w1", 140, 20, 0], ["bar", 0, 260, 0]]);
  });

  it("places a mark on the same frames whether its footage is in one piece or two, at any speed", () => {
    for (const speed of [1, 0.5, 1.37]) {
      for (const cut of cuts) {
        for (const atMs of [0, 1000, 1017, 2530, 4800, 4990, cut - 1, cut, cut + 1]) {
          const marks = [callout(atMs), sound(atMs)];
          const whole = withEdit((e) => { Object.assign(e.shots[0]!, { speed, marks }); });
          const pieces = inPieces(cut);
          pieces.shots[0]!.speed = speed;
          pieces.shots[1]!.speed = speed;
          pieces.shots[atMs < cut ? 0 : 1]!.marks = marks;
          expect(shown(pieces), `speed ${speed}, cut at ${cut} ms, mark at ${atMs} ms`).toEqual(shown(whole));
        }
      }
    }
  });
});

describe("where an item shows", () => {
  it("counts from the film's start: cut at the film's end, and left out when it starts past it", () => {
    expect(shown(withEdit((e) => { e.items = [title("start", 260, 60)]; }))[2]).toEqual(["t1", 260, 10, 0]);
    expect(shown(withEdit((e) => { e.items = [title("start", 270, 60)]; }))).toHaveLength(2);
  });

  it("counts back from the film's end, so it stays at the end whatever is cut before it", () => {
    const card = title("end", 60, null);
    expect(shown(withEdit((e) => { e.items = [card]; }))[2]).toEqual(["t1", 210, 60, 0]);
    expect(shown(withEdit((e) => { e.items = [card]; e.shots[0]!.endMs = 2000; }))[2]).toEqual(["t1", 120, 60, 0]);
    expect(shown(withEdit((e) => { e.items = [title("end", 60, 30)]; }))[2]).toEqual(["t1", 210, 30, 0]);
    expect(shown(withEdit((e) => { e.items = [title("end", 400, null)]; }))[2]).toEqual(["t1", 0, 270, 0]); // a film shorter than that: from its start
  });

  it("stops an item that lasts to the end when the file it plays does", () => {
    const over = (at: number, startMs: number): Edit => withEdit((e) => {
      e.assets.push(voice); // 3000 ms
      e.items = [{ id: "v1", part: "sound", asset: "voice", anchor: "start", at, frames: null, props: { startMs, volume: 1, fadeInMs: 0, fadeOutMs: 0 } }];
    });
    expect(placed(over(0, 0))[2]).toMatchObject({ at: 0, frames: 90, fileMs: 0 });
    expect(placed(over(0, 1000))[2]).toMatchObject({ at: 0, frames: 60, fileMs: 1000 });
    expect(placed(over(200, 0))[2]).toMatchObject({ at: 200, frames: 70 }); // the film ends first
  });

  it("never plays a clip or a sound past the end of its file, and holds a picture as long as asked", () => {
    const cutaway = (asset: string): Item => ({ id: "b1", part: "cutaway", asset, anchor: "start", at: 0, frames: 200, props: { fit: "cover", startMs: 1000, volume: 0 } });
    expect(shown(withEdit((e) => { e.items = [cutaway("broll")]; }))[2]).toEqual(["b1", 0, 90, 0]); // 1000 to 4000 ms
    expect(shown(withEdit((e) => { e.assets.push(picture); e.items = [cutaway("pic")]; }))[2]).toEqual(["b1", 0, 200, 0]);
  });
});

describe("the words said in a run", () => {
  const said = (edit: Edit, run = 0) => runWords(edit, layout(edit).runs[run]!);

  it("gives the frames each is said on, counted from the run's first frame", () => {
    expect(said(fixture())).toEqual([{ text: "Hello", from: 18, to: 27, stress: false }, { text: "guys,", from: 27, to: 39, stress: false }]);
    expect(said(fixture(), 1)).toEqual([{ text: "Virtuna", from: 28, to: 42, stress: false }, { text: "App", from: 42, to: 50, stress: false }]);
  });

  it("leaves out a hidden word and marks a stressed one", () => {
    const edit = withEdit((e) => {
      if (e.assets[0]!.kind !== "video") return;
      e.assets[0]!.words![0]!.hidden = true;
      e.assets[0]!.words![1]!.stress = true;
    });
    expect(said(edit)).toEqual([{ text: "guys,", from: 27, to: 39, stress: true }]);
  });

  it("keeps a word whose middle the run shows, held inside the run, and drops one whose middle is cut", () => {
    expect(said(withEdit((e) => { e.shots[0]!.startMs = 700; }))[0]).toEqual({ text: "Hello", from: 0, to: 6, stress: false });
    expect(said(withEdit((e) => { e.shots[0]!.startMs = 800; })).map((word) => word.text)).toEqual(["guys,"]);
    expect(said(withEdit((e) => { e.shots[0]!.endMs = 1200; }))[1]).toEqual({ text: "guys,", from: 27, to: 36, stress: false });
    expect(said(withEdit((e) => { e.shots[0]!.endMs = 1100; })).map((word) => word.text)).toEqual(["Hello"]);
  });

  it("says each word once, on the same frames, whether the footage is in one piece or many", () => {
    for (const speed of [1, 0.5, 1.37]) {
      for (const cut of cuts) {
        const pieces = inPieces(cut);
        pieces.shots[0]!.speed = speed;
        pieces.shots[1]!.speed = speed;
        expect(said(pieces), `speed ${speed}, cut at ${cut} ms`).toEqual(said(withEdit((e) => { e.shots[0]!.speed = speed; })));
      }
    }
  });

  it("gives every word it counts at least one frame, also in the run's last instant and when it has no length", () => {
    const edit = withEdit((e) => {
      if (e.assets[0]!.kind === "video") e.assets[0]!.words = [{ text: "tick", startMs: 2000, endMs: 2000 }, { text: "end", startMs: 4990, endMs: 5000 }];
      e.shots[0]!.marks = [callout(4990, 100)];
    });
    expect(said(edit)).toEqual([{ text: "tick", from: 60, to: 61, stress: false }, { text: "end", from: 149, to: 150, stress: false }]);
    expect(placed(edit)[0]!.at).toBe(149); // the mark at the same moment
  });

  it("puts a word and a mark on the same moment on the same frame, at any speed", () => {
    for (const speed of [0.25, 0.5, 1, 1.1, 1.37, 2, 3, 4]) {
      for (let startMs = 601; startMs < 1300; startMs += 7) {
        const edit = withEdit((e) => {
          if (e.assets[0]!.kind === "video") e.assets[0]!.words = [{ text: "Now", startMs, endMs: startMs + 300 }];
          Object.assign(e.shots[0]!, { startMs: 580, speed, marks: [callout(startMs)] });
        });
        expect(said(edit)[0]!.from, `speed ${speed}, at ${startMs} ms`).toBe(placed(edit)[0]!.at);
      }
    }
  });

  it("finds none in a file nobody listened to, or in a picture", () => {
    expect(said(withEdit((e) => { e.shots[0] = newShot({ id: "s1", asset: "broll", endMs: 2000 }); }))).toEqual([]);
    expect(said(withEdit((e) => { e.assets.push(picture); e.shots[0] = newShot({ id: "s1", asset: "pic", endMs: 2000 }); }))).toEqual([]);
  });
});

describe("how a moment is framed", () => {
  const moving = (part: [number, number], ease: "linear" | "in" | "out" | "in-out" = "linear") =>
    ({ startMs: 1000, endMs: 3000, framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 2, x: 0.5, y: -1 }, ease, part } } });

  it("holds its framing when the shot does not move", () => {
    const s1 = fixture().shots[0]!;
    expect(framingAt(s1, 0)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(framingAt(s1, 4999)).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it("moves at an even pace from where the move starts, at the shot's first moment, to where it ends, at its last", () => {
    expect(framingAt(moving([0, 1]), 1000)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(framingAt(moving([0, 1]), 2000)).toEqual({ zoom: 1.5, x: 0.25, y: -0.5 });
    expect(framingAt(moving([0, 1]), 3000)).toEqual({ zoom: 2, x: 0.5, y: -1 });
  });

  it("shows only its part of a move, and holds still where the part reaches before the move or past it", () => {
    expect(framingAt(moving([0.5, 1]), 1000).zoom).toBe(1.5);
    expect(framingAt(moving([0, 0.5]), 3000).zoom).toBe(1.5);
    expect(framingAt(moving([0.25, 0.75], "in-out"), 2000).zoom).toBe(1.5); // the middle of the move
    expect(framingAt(moving([0.25, 0.75], "in-out"), 1000).zoom).toBe(1.0625);
    expect([1000, 1500, 2000, 2500, 3000].map((ms) => framingAt(moving([-1, 1]), ms).zoom)).toEqual([1, 1, 1, 1.5, 2]);
    expect([1000, 2000, 3000].map((ms) => framingAt(moving([0, 2]), ms).zoom)).toEqual([1, 2, 2]);
  });

  it("eases in, out and both ways, from 0 to 1 and no further", () => {
    expect(easeAt("linear", 0.5)).toBe(0.5);
    expect(easeAt("in", 0.5)).toBe(0.125);
    expect(easeAt("out", 0.5)).toBe(0.875);
    expect(easeAt("in-out", 0.25)).toBe(0.0625);
    expect(easeAt("in-out", 0.5)).toBe(0.5);
    expect(easeAt("in-out", 0.75)).toBe(0.9375);
    for (const ease of ["linear", "in", "out", "in-out"] as const) {
      expect([easeAt(ease, 0), easeAt(ease, 1), easeAt(ease, -2), easeAt(ease, 3)]).toEqual([0, 1, 0, 1]);
    }
  });
});

describe("moments and frames", () => {
  it("finds the film frame of a moment of a shot, and none for a moment that does not show", () => {
    expect(frameOf(fixture(), "s2", 9000)).toBe(180);
    expect(frameOf(fixture(), "s2", 11999)).toBe(269); // the footage's last instant is its last frame
    expect(frameOf(fixture(), "s2", 7999)).toBeNull();
    expect(frameOf(fixture(), "s2", 12000)).toBeNull();
    expect(frameOf(fixture(), "ghost", 9000)).toBeNull();
  });

  it("finds it by the run: any piece may be named for a moment the run shows", () => {
    expect(frameOf(inPieces(), "s1", 2500)).toBe(75);
    expect(frameOf(inPieces(), "s1b", 1500)).toBe(45);
    expect(frameOf(inPieces(), "s1b", 5000)).toBeNull();
  });

  it("finds the shot and the moment on a film frame, and the moment a run shows on a frame", () => {
    expect(momentAt(fixture(), 180)).toEqual({ shot: "s2", ms: 9000 });
    expect(momentAt(fixture(), 149)).toEqual({ shot: "s1", ms: 4967 });
    expect(momentAt(fixture(), 270)).toBeNull();
    expect(momentAt(inPieces(), 60)).toEqual({ shot: "s1b", ms: 2000 });
    expect(momentOf(layout(fixture()).runs[1]!, 180)).toBe(9000);
    for (let frame = 0; frame < 270; frame++) {
      const found = momentAt(fixture(), frame)!;
      expect(frameOf(fixture(), found.shot, found.ms), `frame ${frame}`).toBe(frame);
    }
  });

  it("gives the shot coming in where two share a frame in a transition", () => {
    const edit = withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 10 }; });
    expect(momentAt(edit, 139)!.shot).toBe("s1");
    expect(momentAt(edit, 140)).toEqual({ shot: "s2", ms: 8000 });
  });

  it("puts the cover on the frame of its moment, and nowhere when there is none or its moment does not show", () => {
    expect(coverFrame(fixture())).toBeNull();
    expect(coverFrame({ ...fixture(), cover: { shot: "s2", atMs: 9000 } })).toBe(180);
    expect(coverFrame({ ...fixture(), cover: { shot: "s2", atMs: 100 } })).toBeNull();
    expect(coverFrame({ ...fixture(), cover: { shot: "ghost", atMs: 9000 } })).toBeNull();
  });
});

describe("the typefaces an edit uses", () => {
  it("lists the captions' and every text part's, each once", () => {
    expect(fontsOf(fixture())).toEqual(["tiktok"]); // the captions and the call-out share one
    const edit = withEdit((e) => {
      e.captions.font = "inter";
      e.items.push(title("start", 0, 60), { ...title("start", 60, 60), id: "t9", props: { ...titleProps, font: "montserrat" } });
    });
    expect(fontsOf(edit)).toEqual(["inter", "tiktok", "montserrat"]);
  });
});

describe("the look a shot is drawn with", () => {
  const warm = { preset: "warm" as const, adjust: { ...NEUTRAL, exposure: 0.3, contrast: -0.2 } };

  it("is the film's when the shot changes nothing", () => {
    const edit = withEdit((e) => { e.look = warm; });
    expect(lookOf(edit, edit.shots[0]!)).toEqual(warm);
  });

  it("takes the shot's own preset, or the film's, and adds the shot's adjustments to the film's", () => {
    const edit = withEdit((e) => { e.look = warm; });
    expect(lookOf(edit, { look: { preset: null, adjust: { ...NEUTRAL, exposure: 0.2 } } })).toEqual({ preset: "warm", adjust: { ...NEUTRAL, exposure: 0.5, contrast: -0.2 } });
    expect(lookOf(edit, { look: { preset: "mono", adjust: NEUTRAL } })).toEqual({ preset: "mono", adjust: warm.adjust });
    expect(lookOf(edit, { look: { preset: null, adjust: { ...NEUTRAL, exposure: 0.9, contrast: -0.9 } } }).adjust).toMatchObject({ exposure: 1, contrast: -1 });
    expect(edit.look).toEqual(warm);
  });
});
