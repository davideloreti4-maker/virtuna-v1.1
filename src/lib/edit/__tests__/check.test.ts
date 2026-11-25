import { describe, expect, it } from "vitest";
import { checkEdit } from "../check";
import { placed } from "../derive";
import { newShot, type Edit, type Item, type Mark } from "../doc";
import { fixture, picture, voice } from "./fixture";

/** The fixture with a change, and what the check then finds wrong. */
const found = (mutate: (edit: Edit) => void) => {
  const edit = fixture();
  mutate(edit);
  return checkEdit(edit);
};
const wrong = (mutate: (edit: Edit) => void): string[] => found(mutate).map((problem) => problem.path);

const titleProps = { text: "The hook", font: "inter" as const, look: "bold" as const, y: 0.2, size: 96, color: "#ffffff", accent: null };
const title = (id: string, at: number, frames: number | null): Item => ({ id, part: "title", anchor: "start", at, frames, props: titleProps });
const cutaway = (asset: string, frames: number | null, startMs = 0): Item => ({ id: "c1", part: "cutaway", asset, anchor: "start", at: 30, frames, props: { fit: "cover", startMs, volume: 0 } });
const sound = (id: string, atMs: number, lenMs = 660, startMs = 0): Extract<Mark, { part: "sound" }> => ({ id, part: "sound", asset: "whoosh", atMs, lenMs, props: { startMs, volume: 1, fadeInMs: 0, fadeOutMs: 0 } });
const fade = { kind: "fade", frames: 30 } as const;

describe("checkEdit", () => {
  it("finds nothing wrong with the fixture", () => {
    expect(checkEdit(fixture())).toEqual([]);
  });

  describe("ids", () => {
    it("refuses an id used twice, whatever the two things are, and says where the first is", () => {
      expect(found((e) => { e.items[0]!.id = "s1"; })).toEqual([{ path: "items.0.id", id: "s1", message: '"s1" is already the id of shots.0; an id names one thing' }]);
      expect(wrong((e) => { e.shots[0]!.marks.push(sound("m1", 100)); })).toEqual(["shots.1.marks.0.id"]);
      expect(wrong((e) => { e.shots[1]!.id = "take"; })).toEqual(["shots.1.id"]);
    });
  });

  describe("shots", () => {
    it("refuses a shot whose file is not in the edit, and a shot that shows a sound", () => {
      expect(found((e) => { e.shots[0]!.asset = "ghost"; })).toEqual([{ path: "shots.0.asset", id: "s1", message: 'shot "s1" shows "ghost", and there is no such file in the edit' }]);
      expect(found((e) => { e.shots[0]!.asset = "whoosh"; e.shots[0]!.endMs = 600; })).toEqual([{ path: "shots.0.asset", id: "s1", message: 'shot "s1" shows "whoosh", which is a sound; a shot shows a clip or a picture' }]);
    });

    it("refuses a shot that reaches past the end of its file, and says by how much", () => {
      expect(found((e) => { e.shots[1]!.endMs = 13000; })).toEqual([{ path: "shots.1.endMs", id: "s2", message: 'shot "s2" shows 8000 to 13000 ms of "take", which is 12700 ms long' }]);
      expect(wrong((e) => { e.shots[1]!.endMs = 12700; })).toEqual([]); // its last instant
      expect(wrong((e) => { e.shots[1]!.endMs = 12701; })).toEqual(["shots.1.endMs"]); // one millisecond past
    });

    it("lets a picture be held for any stretch of its own clock, at any speed", () => {
      expect(wrong((e) => {
        e.assets.push(picture);
        e.shots[0] = { ...newShot({ id: "s1", asset: "pic", startMs: 60000, endMs: 90000 }), speed: 2 };
      })).toEqual([]);
    });

    it("refuses a shot that fills fewer than three frames, alone or as a piece of a run", () => {
      expect(found((e) => { e.shots[0]!.endMs = 67; })).toEqual([{ path: "shots.0", id: "s1", message: 'shot "s1" fills 2 frames; the shortest shot is 3' }]);
      expect(wrong((e) => { e.shots[0]!.endMs = 100; })).toEqual([]);
      expect(wrong((e) => { e.shots[0]!.speed = 4; e.shots[0]!.endMs = 330; })).toEqual(["shots.0"]); // 2.5 frames at that speed, so 2
      expect(wrong((e) => { e.shots[0]!.speed = 4; e.shots[0]!.endMs = 340; })).toEqual([]); // 2.55, so 3
      const pieces = (cut: number) => (e: Edit) => { e.shots.splice(0, 1, newShot({ id: "s1", asset: "take", endMs: cut }), newShot({ id: "s1b", asset: "take", startMs: cut, endMs: 5000 })); };
      expect(wrong(pieces(4940))).toEqual(["shots.1"]); // 60 ms are 2 frames
      expect(wrong(pieces(4900))).toEqual([]);
    });

    it("refuses a cut that is longer than the footage on either side of it, and says whose cut it is", () => {
      const three = (endMs: number) => (e: Edit) => {
        e.shots[0]!.out = fade;
        e.shots[1] = { ...newShot({ id: "s2", asset: "take", startMs: 8000, endMs }), out: fade };
        e.shots.push(newShot({ id: "s3", asset: "take", endMs: 2000 }));
      };
      expect(found(three(8967))).toEqual([
        { path: "shots.1", id: "s2", message: 'shot "s2" fills 29 frames, and the fade of 30 frames out of "s1" that leads into it is longer' },
        { path: "shots.1", id: "s2", message: 'shot "s2" fills 29 frames, and its own fade of 30 frames is longer' },
      ]);
      expect(wrong(three(9000))).toEqual([]); // 30 frames, fading in and out at once: it can be drawn, and whether it should be is the review's to say
    });

    it("counts nothing for the last shot's cut, which hands over to nothing", () => {
      expect(wrong((e) => { e.shots[1]!.out = fade; })).toEqual([]);
      expect(found((e) => { e.shots[0]!.out = fade; Object.assign(e.shots[1]!, { endMs: 8967, out: fade, marks: [] }); })).toEqual([
        { path: "shots.1", id: "s2", message: 'shot "s2" fills 29 frames, and the fade of 30 frames out of "s1" that leads into it is longer' },
      ]);
    });

    it("measures a cut against the whole run of footage beside it, not against one piece of it", () => {
      const pieces = (endMs: number) => (e: Edit) => {
        e.shots[0]!.out = fade;
        e.shots.splice(1, 1, newShot({ id: "s2", asset: "take", startMs: 8000, endMs: 8334 }), { ...newShot({ id: "s2b", asset: "take", startMs: 8334, endMs }), out: fade }, newShot({ id: "s3", asset: "take", endMs: 2000 }));
      };
      expect(wrong(pieces(12000))).toEqual([]); // a 10-frame piece at the head of 120 frames of footage
      expect(found(pieces(8667))).toEqual([
        { path: "shots.1", id: "s2", message: 'the footage from "s2" to "s2b" fills 20 frames, and the fade of 30 frames out of "s1" that leads into it is longer' },
        { path: "shots.2", id: "s2b", message: 'the footage from "s2" to "s2b" fills 20 frames, and the fade of 30 frames out of "s2b" is longer' },
      ]);
    });

    it("refuses a film longer than three minutes", () => {
      expect(found((e) => {
        e.assets.push(picture);
        e.shots = [newShot({ id: "p1", asset: "pic", endMs: 100000 }), newShot({ id: "p2", asset: "pic", endMs: 80034 })];
      })).toEqual([{ path: "shots", id: null, message: "the film is 5401 frames long; the longest allowed is 5400" }]);
    });
  });

  describe("parts that play a file", () => {
    it("refuses a part whose file is not in the edit", () => {
      expect(found((e) => { e.items.push(cutaway("ghost", 60)); })).toEqual([{ path: "items.1.asset", id: "c1", message: 'cutaway "c1" plays "ghost", and there is no such file in the edit' }]);
    });

    it("refuses a file of the wrong kind, and says which kinds the part plays", () => {
      expect(found((e) => { e.items.push(cutaway("whoosh", 60)); })).toEqual([{ path: "items.1.asset", id: "c1", message: 'cutaway "c1" plays "whoosh", which is a sound; a cutaway plays a clip or a picture' }]);
      expect(found((e) => { e.shots[1]!.marks[1] = { ...sound("w1", 8000), asset: "broll" }; })).toEqual([{ path: "shots.1.marks.1.asset", id: "w1", message: 'sound "w1" plays "broll", which is a clip; a sound plays a sound' }]);
    });

    it("refuses a part that starts at or past the end of its file", () => {
      expect(found((e) => { e.shots[1]!.marks[1] = sound("w1", 8000, 100, 677); })).toEqual([{ path: "shots.1.marks.1.props.startMs", id: "w1", message: 'sound "w1" starts 677 ms into "whoosh", which is 677 ms long' }]);
    });

    it("refuses a mark that asks for more of its file than there is", () => {
      expect(found((e) => { e.shots[1]!.marks[1] = sound("w1", 8000, 678); })).toEqual([{ path: "shots.1.marks.1.lenMs", id: "w1", message: 'sound "w1" plays 0 to 678 ms of "whoosh", which is 677 ms long' }]);
      expect(wrong((e) => { e.shots[1]!.marks[1] = sound("w1", 8000, 677); })).toEqual([]);
      expect(wrong((e) => { e.shots[1]!.marks[1] = sound("w1", 8000, 578, 100); })).toEqual(["shots.1.marks.1.lenMs"]);
    });

    it("refuses an item that asks for more of its file than there is, and lets one that lasts to the end stop with its file", () => {
      expect(found((e) => { e.items.push(cutaway("broll", 60, 2001)); })).toEqual([{ path: "items.1.frames", id: "c1", message: 'cutaway "c1" plays 2001 to 4001 ms of "broll", which is 4000 ms long' }]);
      expect(wrong((e) => { e.items.push(cutaway("broll", 60, 2000)); })).toEqual([]);
      expect(wrong((e) => { e.items.push(cutaway("broll", null, 2001)); })).toEqual([]);
    });

    it("lets a part hold a picture for any length", () => {
      expect(wrong((e) => { e.assets.push(picture); e.items.push(cutaway("pic", null), { ...cutaway("pic", 5000, 9999), id: "c2" }); })).toEqual([]);
    });

    it("does not mind the speed of the shot a sound rides on", () => {
      expect(wrong((e) => { e.shots[1]!.speed = 0.5; })).toEqual([]);
      expect(wrong((e) => { e.shots[1]!.speed = 2; })).toEqual([]);
    });

    it("lets through only what then shows in full: the check and the film agree on how much of a file a part may play", () => {
      let passed = 0;
      for (let startMs = 0; startMs < 4000; startMs += 37) {
        for (const frames of [3, 30, 61, 90, 119, 120]) {
          const edit = fixture();
          edit.items = [{ ...cutaway("broll", frames, startMs), at: 0 }];
          if (checkEdit(edit).length > 0) continue;
          passed++;
          expect(placed(edit)[2]!.frames, `a cutaway of ${frames} frames from ${startMs} ms`).toBe(frames);
        }
      }
      for (let lenMs = 100; lenMs <= 677; lenMs += 1) {
        for (const startMs of [0, 1, 77, 340]) {
          const edit = fixture();
          edit.shots[1]!.marks = [sound("w1", 8000, lenMs, startMs)];
          if (checkEdit(edit).length > 0) continue;
          passed++;
          expect(placed(edit)[0]!.frames, `a sound of ${lenMs} ms from ${startMs} ms`).toBe(Math.max(1, Math.round((lenMs * 30) / 1000)));
        }
      }
      expect(passed).toBeGreaterThan(1500);
    });
  });

  describe("what is not its business", () => {
    it("lets a mark sit at a moment its footage does not show, and an item start past the film's end: they do not show, and a trim may bring them back", () => {
      expect(wrong((e) => { e.shots[1]!.marks[0]!.atMs = 100; })).toEqual([]);
      expect(wrong((e) => { e.shots[1]!.marks[0]!.atMs = 12500; })).toEqual([]);
      expect(wrong((e) => { e.items.push(title("t1", 5000, 30)); })).toEqual([]);
    });

    it("lets two titles show at once: how a film looks is the review's work", () => {
      expect(wrong((e) => { e.items.push(title("t1", 0, 60), title("t2", 30, 60)); })).toEqual([]);
    });
  });

  describe("the cover", () => {
    it("refuses a cover on a shot that is not there, and lets it name a moment its shot does not show", () => {
      expect(found((e) => { e.cover = { shot: "ghost", atMs: 0 }; })).toEqual([{ path: "cover.shot", id: "ghost", message: 'the cover is on shot "ghost", and there is no such shot' }]);
      expect(wrong((e) => { e.cover = { shot: "s2", atMs: 100 }; })).toEqual([]);
      expect(wrong((e) => { e.cover = { shot: "s2", atMs: 9000 }; })).toEqual([]);
    });
  });

  it("finds everything that is wrong at once, each named by its id", () => {
    expect(found((e) => {
      e.assets.push(voice);
      e.shots[0]!.asset = "voice";
      e.shots[0]!.endMs = 3000;
      e.shots[1]!.endMs = 13000;
      e.items.push(cutaway("ghost", 60));
      e.cover = { shot: "ghost", atMs: 0 };
    }).map((problem) => [problem.path, problem.id])).toEqual([["shots.0.asset", "s1"], ["shots.1.endMs", "s2"], ["items.1.asset", "c1"], ["cover.shot", "ghost"]]);
  });
});
