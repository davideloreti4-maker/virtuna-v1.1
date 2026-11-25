import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Problem } from "../check";
import { coverFrame, filmFrames, framingAt, layout, lookOf, momentAt, momentOf, placed, runWords } from "../derive";
import { DEFAULT_CAPTIONS, NEUTRAL, NO_LOOK, newEdit, newShot, type Edit, type Item, type Mark, type Shot } from "../doc";
import { OP_NAMES, OpSchema, applyOps, parseOps } from "../ops";
import { fixture, library, picture, voice } from "./fixture";

/** The edit after the operations; fails the test when they are refused. */
const done = (ops: unknown, edit: Edit = fixture()): Edit => {
  const result = applyOps(edit, ops, library());
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.problems)}`);
  return result.edit;
};
/** Why the operations were refused; fails the test when they are applied. */
const refusal = (ops: unknown, edit: Edit = fixture()): Problem[] => {
  const result = applyOps(edit, ops, library());
  if (result.ok) throw new Error("applied, and it should have been refused");
  return result.problems;
};
const paths = (ops: unknown, edit: Edit = fixture()): string[] => refusal(ops, edit).map((problem) => problem.path);
/** A refusal by an operation: which one, what it was about, and why. */
const stopped = (op: number, id: string | null, message: string): Problem[] => [{ path: `ops.${op}`, id, message }];
/** The fixture with a change. */
const withEdit = (mutate: (edit: Edit) => void): Edit => {
  const edit = fixture();
  mutate(edit);
  return edit;
};

const titleProps = { text: "The hook", font: "inter" as const, look: "bold" as const, y: 0.2, size: 96, color: "#ffffff", accent: null };
const title = (id: string, at: number, frames: number | null, anchor: "start" | "end" = "start"): Item => ({ id, part: "title", anchor, at, frames, props: titleProps });
const sound = (atMs: number, lenMs = 660, id = "w2"): Mark => ({ id, part: "sound", asset: "whoosh", atMs, lenMs, props: { startMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0 } });
const callout = (atMs: number, lenMs = 660, id = "c2"): Mark => ({ id, part: "callout", atMs, lenMs, props: { text: "Now", font: "inter", look: "pop", x: 0.5, y: 0.3, size: 96, color: "#ffffff" } });
const moving = (ease: "linear" | "in" | "out" | "in-out" = "in-out"): Shot["framing"] => ({ from: { zoom: 1, x: -0.5, y: 0 }, move: { to: { zoom: 1.6, x: 0.5, y: 0 }, ease, part: [0, 1] } });
const ids = (edit: Edit) => edit.shots.map((shot) => shot.id);
const stretches = (edit: Edit) => edit.shots.map((shot) => [shot.id, shot.startMs, shot.endMs]);
const shown = (edit: Edit) => placed(edit).map((p) => [p.thing.id, p.at, p.frames, p.skip]);

/**
 * Everything a viewer would see and hear of an edit that the document decides: the film's length,
 * what shows when, the words, the cover, and for every frame the file, the moment of it, its
 * speed, volume and look. In no order: which shot holds a mark says nothing about what is drawn
 * over what.
 */
const film = (edit: Edit) => {
  const lay = layout(edit);
  return {
    frames: lay.frames,
    shown: shown(edit).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    words: lay.runs.map((run) => [run.at, run.frames, runWords(edit, run)]),
    cover: coverFrame(edit),
    footage: edit.shots.flatMap((shot, i) =>
      Array.from({ length: lay.shots[i]!.frames }, (_, frame) => [shot.asset, shot.speed, shot.volume, momentAt(edit, lay.shots[i]!.at + frame)?.ms, JSON.stringify(lookOf(edit, shot))]),
    ),
  };
};
/** How every frame of the film is framed, shot after shot. */
const framings = (edit: Edit) => {
  const lay = layout(edit);
  return edit.shots.flatMap((shot, i) => Array.from({ length: lay.shots[i]!.frames }, (_, frame) => framingAt(shot, momentOf(lay.runs[lay.shots[i]!.run]!, lay.shots[i]!.at + frame))));
};
/** The most two films differ in framing on any frame; infinite when they are not the same length. A stored move keeps nine decimals, so alike means under a ten-millionth. */
const framingGap = (got: Edit, want: Edit): number => {
  const [a, b] = [framings(got), framings(want)];
  if (a.length !== b.length) return Infinity;
  return Math.max(0, ...a.flatMap((frame, i) => (["zoom", "x", "y"] as const).map((key) => Math.abs(frame[key] - b[i]![key]))));
};
/** Fails unless two edits are the same film. */
const expectSameFilm = (got: Edit, want: Edit, where: string) => {
  expect(film(got), where).toEqual(film(want));
  expect(framingGap(got, want), where).toBeLessThan(1e-7);
};
/** Numbers that look random and are the same on every run. */
const dice = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("the door", () => {
  it("refuses what is not a list of operations, an empty list and a list of more than two thousand", () => {
    expect(paths({ op: "shot.remove", id: "s1" })).toEqual(["ops"]);
    expect(paths("shot.remove")).toEqual(["ops"]);
    expect(paths([])).toEqual(["ops"]);
    expect(paths(Array.from({ length: 2001 }, () => ({ op: "look.clear" })))).toEqual(["ops"]);
  });

  it("refuses an edit that is not one, and says where, sooner than work on it", () => {
    const broken = fixture() as unknown as { shots: { marks?: unknown }[] };
    delete broken.shots[0]!.marks;
    expect(applyOps(broken as never, [{ op: "shot.remove", id: "s2" }])).toEqual({ ok: false, problems: [{ path: "edit.shots.0.marks", id: null, message: expect.stringContaining("expected array") }] });
  });

  it("refuses an operation it does not know, and names the ones it does", () => {
    expect(refusal([{ op: "shot.explode", id: "s1" }])).toEqual([{ path: "ops.0.op", id: null, message: `is not one of: ${OP_NAMES.join(", ")}` }]);
  });

  it("names every operation it knows, and knows every one it names", () => {
    expect(OpSchema.options.map((option) => option.shape.op.value).sort()).toEqual([...OP_NAMES].sort());
  });

  it("says which parts and which cuts there are when it is given one there is not", () => {
    expect(refusal([{ op: "mark.add", shot: "s1", mark: { ...callout(0), part: "sticker" } }])).toEqual([{ path: "ops.0.mark.part", id: null, message: "is not one of: title, callout, cutaway, sound" }]);
    expect(refusal([{ op: "item.add", item: { ...title("t1", 0, 60), part: "sticker" } }])).toEqual([{ path: "ops.0.item.part", id: null, message: "is not one of: title, callout, progress, cutaway, sound" }]);
    expect(refusal([{ op: "shot.set", id: "s1", out: { kind: "zoom-blur", frames: 10 } }])).toEqual([{ path: "ops.0.out.kind", id: null, message: "is not one of: cut, fade, push, wipe, punch, iris, clock" }]);
  });

  it("refuses a key an operation does not have", () => {
    expect(paths([{ op: "shot.remove", id: "s1", force: true }])).toEqual(["ops.0"]);
    expect(paths([{ op: "shot.insert", after: null, shot: { id: "s3", asset: "broll", startMs: 0, endMs: 2000, frames: 60 } }])).toEqual(["ops.0.shot"]);
  });

  it("applies all the operations or none, and says which one stopped it and what it was about", () => {
    expect(refusal([{ op: "look.set", preset: "warm" }, { op: "shot.remove", id: "ghost" }])).toEqual(stopped(1, "ghost", 'there is no shot "ghost"'));
  });

  it("never touches the edit, the operations or the files it was given, applied or refused", () => {
    const [before, ops, offered] = [fixture(), [{ op: "shot.remove", id: "s1" }, { op: "asset.add", id: "pic" }], library()];
    expect(applyOps(before, ops, offered).ok).toBe(true);
    expect(applyOps(before, [{ op: "shot.trim", id: "s1", endMs: 99999 }], offered).ok).toBe(false);
    expect([before, ops, offered]).toEqual([fixture(), [{ op: "shot.remove", id: "s1" }, { op: "asset.add", id: "pic" }], library()]);
  });

  it("refuses a setting its part refuses, naming the setting, the thing and the part", () => {
    expect(refusal([{ op: "mark.set", id: "m1", props: { size: 10, y: 0.3 } }])).toEqual([{ path: "ops.0.props.size", id: "m1", message: "Too small: expected number to be >=44, for a callout" }]);
    expect(refusal([{ op: "item.set", id: "bar", props: { edge: "left" } }]).map((problem) => [problem.path, problem.id])).toEqual([["ops.0.props.edge", "bar"]]);
    expect(refusal([{ op: "mark.set", id: "m1", props: { glow: 1 } }])).toEqual([{ path: "ops.0.props", id: "m1", message: 'Unrecognized key: "glow", for a callout' }]);
    expect(paths([{ op: "mark.set", id: "ghost", props: { glow: 1 } }])).toEqual(["ops.0.props"]);
  });

  it("refuses a result that is not a valid edit, naming the place and the thing", () => {
    expect(refusal([{ op: "mark.set", id: "m1", props: { fit: "cover" } }]).map((problem) => [problem.path, problem.id])).toEqual([["shots.1.marks.0.props", "m1"]]); // a cutaway's setting on a call-out
  });

  it("refuses a result that does not hold together, naming the place and the thing", () => {
    expect(refusal([{ op: "shot.trim", id: "s2", endMs: 13000 }])).toEqual([{ path: "shots.1.endMs", id: "s2", message: 'shot "s2" shows 8000 to 13000 ms of "take", which is 12700 ms long' }]);
  });

  it("names a thing by its id, which is still right when an operation before has moved it", () => {
    const [problem] = refusal([{ op: "shot.remove", id: "s1" }, { op: "shot.trim", id: "s2", endMs: 13000 }]);
    expect([problem!.path, problem!.id]).toEqual(["shots.0.endMs", "s2"]);
  });

  it("parses a list of operations for a caller that wants them typed", () => {
    expect(parseOps([{ op: "shot.remove", id: "s1" }])).toEqual([{ op: "shot.remove", id: "s1" }]);
    expect(() => parseOps([{ op: "shot.remove" }])).toThrow();
  });

  it("can describe its operations to a model, down to each part's settings, with no setting left open", () => {
    const schema = JSON.stringify(z.toJSONSchema(OpSchema));
    for (const name of OP_NAMES) expect(schema).toContain(`"${name}"`);
    for (const setting of ["accent", "edge", "fit", "fadeOutMs"]) expect(schema).toContain(`"${setting}"`);
    expect(schema).not.toContain('"additionalProperties":{}');
  });
});

describe("what is asked to show must show at the end", () => {
  const hook: Mark = { id: "t1", part: "title", atMs: 0, lenMs: 2000, props: titleProps };

  it("refuses a mark at a moment its footage does not show", () => {
    expect(refusal([{ op: "mark.add", shot: "s1", mark: { ...hook, atMs: 6000 } }])).toEqual(stopped(0, "t1", 'title "t1" would not show: its footage shows 0 to 5000 ms of its file, and 6000 ms is not in that'));
    expect(refusal([{ op: "mark.add", shot: "s1", mark: { ...hook, atMs: 5000 } }])).toEqual(stopped(0, "t1", 'title "t1" would not show: its footage shows 0 to 5000 ms of its file, and 5000 ms is not in that')); // where footage ends is not in it
    expect(done([{ op: "mark.add", shot: "s1", mark: { ...hook, atMs: 4999 } }]).shots[0]!.marks).toHaveLength(1);
    expect(refusal([{ op: "mark.set", id: "m1", atMs: 7000 }])).toEqual(stopped(0, "m1", 'callout "m1" would not show: its footage shows 8000 to 12000 ms of its file, and 7000 ms is not in that'));
  });

  it("refuses an item that starts past the film's end, and a cover at a moment that does not show", () => {
    expect(refusal([{ op: "item.add", item: title("t1", 270, 60) }])).toEqual(stopped(0, "t1", 'title "t1" would not show: it starts on frame 270, and the film is 270 frames long'));
    expect(refusal([{ op: "item.set", id: "bar", at: 300 }])).toEqual(stopped(0, "bar", 'progress "bar" would not show: it starts on frame 300, and the film is 270 frames long'));
    expect(refusal([{ op: "cover.set", cover: { shot: "s2", atMs: 100 } }])).toEqual(stopped(0, "s2", 'the cover would not show: the footage of shot "s2" shows 8000 to 12000 ms of its file, and 100 ms is not in that'));
    expect(refusal([{ op: "item.add", item: title("t1", 0, null, "end") }])).toEqual(stopped(0, "t1", 'title "t1" would not show: it starts 0 frames before the film\'s end'));
  });

  it("judges by the film the operations leave, in whatever order they come", () => {
    const longer = { op: "shot.trim", id: "s1", endMs: 7000 };
    const mark = { op: "mark.add", shot: "s1", mark: { ...hook, atMs: 6000 } };
    expect(done([mark, longer])).toEqual(done([longer, mark]));
    const item = { op: "item.add", item: title("t1", 300, 30) };
    const more = { op: "shot.insert", after: "s2", shot: { id: "s3", asset: "broll", startMs: 0, endMs: 3000 } };
    expect(done([item, more])).toEqual(done([more, item]));
    expect(refusal([item, more, { op: "shot.remove", id: "s3" }])).toEqual(stopped(0, "t1", 'title "t1" would not show: it starts on frame 300, and the film is 270 frames long'));
  });

  it("says it once when several operations ask the same thing to show", () => {
    expect(refusal([{ op: "mark.add", shot: "s1", mark: { ...hook, atMs: 6000 } }, { op: "mark.set", id: "t1", atMs: 7000 }, { op: "mark.set", id: "t1", atMs: 8000 }]))
      .toEqual(stopped(0, "t1", 'title "t1" would not show: its footage shows 0 to 5000 ms of its file, and 8000 ms is not in that'));
    expect(refusal([{ op: "cover.set", cover: { shot: "s2", atMs: 100 } }, { op: "cover.set", cover: { shot: "s2", atMs: 200 } }])).toHaveLength(1);
  });

  it("says nothing of what an operation did not touch, or took out again", () => {
    const hidden = withEdit((e) => { e.shots[1]!.marks[0]!.atMs = 100; e.items.push(title("t9", 900, 30)); });
    expect(done([{ op: "look.set", preset: "warm" }], hidden).look.preset).toBe("warm");
    expect(done([{ op: "mark.add", shot: "s1", mark: { ...hook, atMs: 6000 } }, { op: "mark.remove", id: "t1" }])).toEqual(fixture());
  });
});

describe("shot.insert", () => {
  const shot = { id: "s3", asset: "broll", startMs: 0, endMs: 2000 };

  it("puts a new shot after the named one, started as a new shot starts", () => {
    const edit = done([{ op: "shot.insert", after: "s1", shot }]);
    expect(ids(edit)).toEqual(["s1", "s3", "s2"]);
    expect(edit.shots[1]).toEqual(newShot(shot));
    expect(filmFrames(edit)).toBe(330);
  });

  it("puts it first when it follows nothing, with the settings it was given", () => {
    const edit = done([{ op: "shot.insert", after: null, shot: { ...shot, volume: 0, speed: 2, out: { kind: "fade", frames: 10 } } }]);
    expect(ids(edit)).toEqual(["s3", "s1", "s2"]);
    expect(edit.shots[0]).toEqual({ ...newShot(shot), volume: 0, speed: 2, out: { kind: "fade", frames: 10 } });
    expect(filmFrames(edit)).toBe(290);
  });

  it("takes any stretch its file has, up to the file's last instant, and any stretch of a picture's clock", () => {
    expect(done([{ op: "shot.insert", after: "s2", shot: { id: "s3", asset: "take", startMs: 8010, endMs: 12700 } }]).shots[2]).toMatchObject({ startMs: 8010, endMs: 12700 });
    expect(done([{ op: "asset.add", id: "pic" }, { op: "shot.insert", after: "s2", shot: { id: "s3", asset: "pic", startMs: 0, endMs: 3000 } }]).shots[2]!.endMs).toBe(3000);
  });

  it("does not mind coming before the operation that adds its file", () => {
    const put = { op: "shot.insert", after: "s2", shot: { id: "s3", asset: "voice2", startMs: 0, endMs: 2990 } };
    const clip = { ...fixture().assets[1]!, id: "voice2", ms: 2990 };
    const offered = [...library(), clip];
    const [a, b] = [applyOps(fixture(), [put, { op: "asset.add", id: "voice2" }], offered), applyOps(fixture(), [{ op: "asset.add", id: "voice2" }, put], offered)];
    expect(a.ok && b.ok && a.edit.shots).toEqual(b.ok && b.edit.shots);
  });

  it("refuses to follow a shot that is not there, a stretch that is none, and a file that is not in the edit", () => {
    expect(refusal([{ op: "shot.insert", after: "ghost", shot }])).toEqual(stopped(0, "s3", 'there is no shot "ghost"'));
    expect(refusal([{ op: "shot.insert", after: null, shot: { ...shot, startMs: 2000 } }])).toEqual(stopped(0, "s3", "its end, 2000 ms, is not after its start, 2000 ms"));
    expect(refusal([{ op: "shot.insert", after: null, shot: { ...shot, endMs: 50 } }])).toEqual([{ path: "shots.0", id: "s3", message: 'shot "s3" fills 2 frames; the shortest shot is 3' }]);
    expect(refusal([{ op: "shot.insert", after: null, shot: { ...shot, asset: "ghost" } }])).toEqual([{ path: "shots.0.asset", id: "s3", message: 'shot "s3" shows "ghost", and there is no such file in the edit' }]);
  });
});

describe("shot.split", () => {
  const split = (atMs: number, edit: Edit = fixture(), id = "s2") => done([{ op: "shot.split", id, atMs, newId: `${id}b` }], edit);

  it("makes two shots at the moment asked, and the second runs on from the first", () => {
    expect(stretches(split(9510))).toEqual([["s1", 0, 5000], ["s2", 8000, 9510], ["s2b", 9510, 12000]]);
    expect(layout(split(9510)).runs).toHaveLength(2);
  });

  it("gives each mark, whole, to the piece that shows its moment", () => {
    const [m1, w1] = fixture().shots[1]!.marks;
    expect(split(9500).shots.slice(1).map((shot) => shot.marks)).toEqual([[m1, w1], []]);
    expect(split(8500).shots.slice(1).map((shot) => shot.marks)).toEqual([[w1], [m1]]);
    expect(split(8920).shots.slice(1).map((shot) => shot.marks)).toEqual([[w1], [m1]]); // a mark on the cut goes with what follows
  });

  it("ends the first piece in a plain cut and keeps the shot's own cut on the second", () => {
    const edit = withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 10 }; });
    const after = split(2000, edit, "s1");
    expect(after.shots.map((shot) => shot.out)).toEqual([{ kind: "cut" }, { kind: "fade", frames: 10 }, { kind: "cut" }]);
    expect(filmFrames(after)).toBe(260);
  });

  it("gives each piece its part of a move", () => {
    const edit = withEdit((e) => { e.shots[0]!.framing = moving(); });
    const after = split(2000, edit, "s1");
    expect(after.shots[0]!.framing).toEqual({ ...moving(), move: { ...moving().move!, part: [0, 0.4] } });
    expect(after.shots[1]!.framing).toEqual({ ...moving(), move: { ...moving().move!, part: [0.4, 1] } });
  });

  it("moves the cover to the second piece when its moment is there", () => {
    const coverAfter = (atMs: number) => split(9500, withEdit((e) => { e.cover = { shot: "s2", atMs }; })).cover;
    expect(coverAfter(10000)).toEqual({ shot: "s2b", atMs: 10000 });
    expect(coverAfter(9500)).toEqual({ shot: "s2b", atMs: 9500 });
    expect(coverAfter(9000)).toEqual({ shot: "s2", atMs: 9000 });
  });

  it("changes nothing a viewer sees or hears, wherever the cut is, at any speed, with any ease", () => {
    const eases = ["linear", "in", "out", "in-out"] as const;
    let n = 0;
    for (const speed of [1, 0.5, 1.37, 4]) {
      for (const length of [300, 334, 1000, 1667]) {
        for (let cut = 97; cut < length - 96; cut += 53) {
          for (const near of [cut - 1, cut, cut + 1, 40, cut + 60]) {
            const edit = withEdit((e) => {
              e.shots[0] = { ...newShot({ id: "s1", asset: "take", startMs: 580, endMs: 580 + length }), speed, framing: moving(eases[n++ % 4]), marks: [callout(580 + near, 100), sound(580 + near, 100), callout(600, 660, "c3")] };
              e.cover = { shot: "s1", atMs: 580 + Math.min(near, length - 1) };
            });
            const where = `speed ${speed}, ${length} ms cut at ${cut}, marks ${near} ms in`;
            const result = applyOps(edit, [{ op: "shot.split", id: "s1", atMs: 580 + cut, newId: "s1b" }]);
            if (!result.ok) {
              expect(result.problems.map((problem) => problem.message).join(), where).toMatch(/shortest shot/); // a piece under three frames at this speed
              continue;
            }
            expectSameFilm(result.edit, edit, where);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(900);
  });

  it("changes nothing however often a film is cut: clips and pictures, speeds, transitions, marks before, on and after what shows", () => {
    const roll = dice(20261119);
    const pick = <T,>(of: readonly T[]): T => of[Math.floor(roll() * of.length)]!;
    let cutsMade = 0;
    for (let round = 0; round < 60; round++) {
      let edit = withEdit((e) => {
        e.assets.push(picture);
        e.shots = Array.from({ length: 3 }, (_, i): Shot => {
          const asset = pick(["take", "take", "pic"]);
          const startMs = Math.floor(roll() * 6000);
          return {
            ...newShot({ id: `s${i}`, asset, startMs, endMs: startMs + 400 + Math.floor(roll() * 3000) }),
            speed: pick([0.25, 0.5, 1, 1, 1.1, 1.37, 2, 4]),
            framing: roll() < 0.5 ? moving(pick(["linear", "in", "out", "in-out"])) : newShot({ id: "x", asset, endMs: 1 }).framing,
            out: i < 2 && roll() < 0.4 ? { kind: "fade", frames: 2 + Math.floor(roll() * 4) } : { kind: "cut" },
            marks: [callout(startMs - 300 + Math.floor(roll() * 4000), 100 + Math.floor(roll() * 3000), `c${i}`), sound(startMs + Math.floor(roll() * 3000), 100 + Math.floor(roll() * 500), `w${i}`)],
          };
        });
        e.cover = { shot: "s1", atMs: e.shots[1]!.startMs + 200 };
      });
      const whole = edit;
      for (let again = 0; again < 4; again++) {
        const shot = pick(edit.shots);
        const atMs = shot.startMs + 1 + Math.floor(roll() * (shot.endMs - shot.startMs - 1));
        const result = applyOps(edit, [{ op: "shot.split", id: shot.id, atMs, newId: `r${round}n${again}` }]);
        if (!result.ok) continue; // a piece under three frames, or more cut than a shot with transitions around it can give
        cutsMade++;
        edit = result.edit;
        expectSameFilm(edit, whole, `round ${round}, cut ${again} of "${shot.id}" at ${atMs} ms`);
      }
    }
    expect(cutsMade).toBeGreaterThan(150);
  });

  it("splits a held picture like any other shot", () => {
    const edit = withEdit((e) => { e.assets.push(picture); e.shots[0] = newShot({ id: "s1", asset: "pic", endMs: 5000 }); });
    expect(stretches(split(2000, edit, "s1")).slice(0, 2)).toEqual([["s1", 0, 2000], ["s1b", 2000, 5000]]);
  });

  it("refuses a cut outside the shot, a piece under three frames, a second piece whose id is taken, and a shot that is not there", () => {
    for (const atMs of [7000, 8000, 12000, 12500]) expect(refusal([{ op: "shot.split", id: "s2", atMs, newId: "s2b" }])).toEqual(stopped(0, "s2", `shot "s2" shows 8000 to 12000 ms of its file, and a cut at ${atMs} ms is not inside that`));
    expect(refusal([{ op: "shot.split", id: "s2", atMs: 8050, newId: "s2b" }])).toEqual([{ path: "shots.1", id: "s2", message: 'shot "s2" fills 2 frames; the shortest shot is 3' }]);
    expect(refusal([{ op: "shot.split", id: "s2", atMs: 11940, newId: "s2b" }])).toEqual([{ path: "shots.2", id: "s2b", message: 'shot "s2b" fills 2 frames; the shortest shot is 3' }]);
    expect(refusal([{ op: "shot.split", id: "s2", atMs: 9500, newId: "s1" }]).map((problem) => [problem.path, problem.id])).toEqual([["shots.2.id", "s1"]]);
    expect(refusal([{ op: "shot.split", id: "ghost", atMs: 9500, newId: "s2b" }])).toEqual(stopped(0, "ghost", 'there is no shot "ghost"'));
  });
});

describe("shot.trim", () => {
  it("sets the stretch of its file a shot shows, exactly as asked, and leaves an end it was not given where it was", () => {
    expect(stretches(done([{ op: "shot.trim", id: "s1", startMs: 610, endMs: 1310 }]))[0]).toEqual(["s1", 610, 1310]);
    expect(stretches(done([{ op: "shot.trim", id: "s1", startMs: 610 }]))[0]).toEqual(["s1", 610, 5000]);
    expect(stretches(done([{ op: "shot.trim", id: "s1", endMs: 3017 }]))[0]).toEqual(["s1", 0, 3017]);
    expect(filmFrames(done([{ op: "shot.trim", id: "s1", startMs: 610 }]))).toBe(132 + 120); // 4390 ms are 131.7 frames
    expect(done([{ op: "shot.trim", id: "s2", startMs: 8000, endMs: 12000 }])).toEqual(fixture());
  });

  it("gives the same film whether a shot is trimmed and then cut, or cut and then trimmed", () => {
    const [trim, cut] = [{ op: "shot.trim", id: "s1", startMs: 610 }, { op: "shot.split", id: "s1", atMs: 3000, newId: "s1b" }];
    expect(done([trim, cut])).toEqual(done([cut, trim]));
    expect(layout(done([cut, trim])).runs[0]).toMatchObject({ first: 0, last: 1, fromMs: 610, toMs: 5000 });
  });

  it("leaves the shot's marks as they are: what the footage no longer shows does not show, and comes back with the footage", () => {
    const cut = done([{ op: "shot.trim", id: "s2", startMs: 9000 }]);
    expect(cut.shots[1]!.marks).toEqual(fixture().shots[1]!.marks);
    expect(shown(cut)).toEqual([["m1", 150, 20, 2], ["bar", 0, 240, 0]]); // the call-out is already running; the whoosh is over
    expect(done([{ op: "shot.trim", id: "s2", startMs: 8000 }], cut)).toEqual(fixture());
  });

  it("brings a mark back when the cut between two pieces of a run is moved over its moment, either way", () => {
    const pieces = done([{ op: "shot.split", id: "s1", atMs: 2000, newId: "s1b" }, { op: "mark.add", shot: "s1", mark: callout(1500) }, { op: "mark.add", shot: "s1b", mark: callout(2500, 660, "c3") }]);
    const earlier = done([{ op: "shot.trim", id: "s1", endMs: 1000 }, { op: "shot.trim", id: "s1b", startMs: 1000 }], pieces);
    const later = done([{ op: "shot.trim", id: "s1b", startMs: 3000 }, { op: "shot.trim", id: "s1", endMs: 3000 }], pieces);
    expectSameFilm(earlier, pieces, "the cut moved to 1000 ms");
    expectSameFilm(later, pieces, "the cut moved to 3000 ms");
    expect(shown(later).slice(0, 2)).toEqual([["c2", 45, 20, 0], ["c3", 75, 20, 0]]);
  });

  it("keeps a move at its pace: the shot shows the part of it that its stretch showed, and holds still beyond it", () => {
    const edit = withEdit((e) => { e.shots[0]!.framing = moving("linear"); e.shots[1]!.framing = moving("linear"); });
    const shorter = done([{ op: "shot.trim", id: "s1", startMs: 1000, endMs: 3000 }], edit);
    expect(shorter.shots[0]!.framing.move!.part).toEqual([0.2, 0.6]);
    for (const ms of [1000, 1500, 2999]) expect(framingAt(shorter.shots[0]!, ms)).toEqual(framingAt(edit.shots[0]!, ms));
    const longer = done([{ op: "shot.trim", id: "s2", startMs: 7000, endMs: 12700 }], edit);
    expect(longer.shots[1]!.framing.move!.part).toEqual([-0.25, 1.175]);
    for (const ms of [8000, 9000, 11999]) expect(framingAt(longer.shots[1]!, ms).zoom).toBeCloseTo(framingAt(edit.shots[1]!, ms).zoom, 9);
    expect([framingAt(longer.shots[1]!, 7000).zoom, framingAt(longer.shots[1]!, 12500).zoom]).toEqual([1, 1.6]); // before the move and after it
    expect(done([{ op: "shot.trim", id: "s2", startMs: 8000, endMs: 12000 }], longer)).toEqual(edit); // and back
    expect(done([{ op: "shot.trim", id: "s1", startMs: 0, endMs: 5000 }], shorter)).toEqual(edit);
  });

  it("is never stopped by something far away: an item and a cover the film no longer reaches stay in the edit and do not show", () => {
    const edit = withEdit((e) => {
      e.items.push(title("t1", 210, 30), title("t2", 90, 60), title("end", 60, null, "end"));
      e.shots[1]!.marks.push({ id: "t3", part: "title", atMs: 8500, lenMs: 1000, props: titleProps });
      e.cover = { shot: "s2", atMs: 11000 };
    });
    const after = done([{ op: "shot.trim", id: "s2", endMs: 9700 }, { op: "shot.trim", id: "s1", endMs: 4000 }], edit);
    expect(filmFrames(after)).toBe(171);
    expect([after.items, after.cover, after.shots[1]!.marks]).toEqual([edit.items, edit.cover, edit.shots[1]!.marks]);
    expect(shown(after).map(([id]) => id)).toEqual(["m1", "w1", "t3", "bar", "t2", "end"]);
    expect(shown(after)[5]).toEqual(["end", 111, 60, 0]); // still the film's last two seconds
    expect(coverFrame(after)).toBeNull();
    expectSameFilm(done([{ op: "shot.trim", id: "s2", endMs: 12000 }, { op: "shot.trim", id: "s1", endMs: 5000 }], after), edit, "trimmed back");
  });

  it("refuses a stretch that is none, one under three frames, and a trim that names neither end", () => {
    expect(refusal([{ op: "shot.trim", id: "s2", startMs: 9000, endMs: 8000 }])).toEqual(stopped(0, "s2", "its end, 8000 ms, is not after its start, 9000 ms"));
    expect(refusal([{ op: "shot.trim", id: "s2", endMs: 8050 }])).toEqual([{ path: "shots.1", id: "s2", message: 'shot "s2" fills 2 frames; the shortest shot is 3' }]);
    expect(refusal([{ op: "shot.trim", id: "s2" }])).toEqual(stopped(0, "s2", "it names neither a start nor an end"));
    expect(refusal([{ op: "shot.trim", id: "ghost", endMs: 100 }])).toEqual(stopped(0, "ghost", 'there is no shot "ghost"'));
  });
});

describe("shot.remove", () => {
  it("takes a shot out, with the marks that rode on it and a cover that was on it", () => {
    const edit = done([{ op: "shot.remove", id: "s2" }], withEdit((e) => { e.cover = { shot: "s2", atMs: 9000 }; }));
    expect(ids(edit)).toEqual(["s1"]);
    expect(shown(edit)).toEqual([["bar", 0, 150, 0]]);
    expect(edit.cover).toBeNull();
  });

  it("gives the same film whatever the order of the operations: taking a shot out and putting one in loses nothing", () => {
    const edit = withEdit((e) => { e.items.push(title("t1", 200, 30)); });
    const put = { op: "shot.insert", after: "s1", shot: { id: "s3", asset: "take", startMs: 8000, endMs: 12000 } };
    const outThenIn = done([{ op: "shot.remove", id: "s2" }, put], edit);
    expect(outThenIn).toEqual(done([put, { op: "shot.remove", id: "s2" }], edit));
    expect(shown(outThenIn)).toEqual([["bar", 0, 270, 0], ["t1", 200, 30, 0]]);
  });

  it("refuses to take out the only shot, or one that is not there", () => {
    expect(refusal([{ op: "shot.remove", id: "s1" }, { op: "shot.remove", id: "s2" }])).toEqual(stopped(1, "s2", "an edit keeps at least one shot"));
    expect(refusal([{ op: "shot.remove", id: "ghost" }])).toEqual(stopped(0, "ghost", 'there is no shot "ghost"'));
  });
});

describe("shot.move", () => {
  it("puts a shot first, or after another, and carries its marks with it", () => {
    expect(ids(done([{ op: "shot.move", id: "s1", after: "s2" }]))).toEqual(["s2", "s1"]);
    const edit = done([{ op: "shot.move", id: "s2", after: null }]);
    expect(ids(edit)).toEqual(["s2", "s1"]);
    expect(edit.shots[0]!.marks).toEqual(fixture().shots[1]!.marks);
    expect(shown(edit)).toEqual([["m1", 28, 22, 0], ["w1", 0, 20, 0], ["bar", 0, 270, 0]]);
  });

  it("leaves a cut alone that now hands over to nothing, so it is back when a shot follows again", () => {
    const edit = withEdit((e) => { e.shots[0]!.out = { kind: "fade", frames: 10 }; });
    const last = done([{ op: "shot.move", id: "s1", after: "s2" }], edit);
    expect(last.shots.map((shot) => shot.out)).toEqual([{ kind: "cut" }, { kind: "fade", frames: 10 }]);
    expect(filmFrames(last)).toBe(270);
    expect(done([{ op: "shot.move", id: "s1", after: null }], last)).toEqual(edit);
  });

  it("says whose cut it is when a move puts a short shot behind one", () => {
    const edit = withEdit((e) => { e.shots[1]!.out = { kind: "fade", frames: 30 }; e.shots[0]!.endMs = 667; });
    expect(refusal([{ op: "shot.move", id: "s1", after: "s2" }], edit)).toEqual([{ path: "shots.1", id: "s1", message: 'shot "s1" fills 20 frames, and the fade of 30 frames out of "s2" that leads into it is longer' }]);
  });

  it("refuses to put a shot after itself, or after one that is not there, or to move one that is not there", () => {
    expect(refusal([{ op: "shot.move", id: "s1", after: "s1" }])).toEqual(stopped(0, "s1", '"s1" cannot follow itself'));
    expect(refusal([{ op: "shot.move", id: "s1", after: "ghost" }])).toEqual(stopped(0, "s1", 'there is no shot "ghost"'));
    expect(refusal([{ op: "shot.move", id: "ghost", after: null }])).toEqual(stopped(0, "ghost", 'there is no shot "ghost"'));
  });
});

describe("shot.set", () => {
  it("sets a shot's volume, framing and cut", () => {
    const edit = done([{ op: "shot.set", id: "s1", volume: 0.5, framing: moving(), out: { kind: "fade", frames: 10 } }]);
    expect(edit.shots[0]).toEqual({ ...fixture().shots[0]!, volume: 0.5, framing: moving(), out: { kind: "fade", frames: 10 } });
    expect(filmFrames(edit)).toBe(260);
  });

  it("keeps the stretch of file when the speed changes, so the shot fills fewer or more frames, and gives the shot back when the speed does", () => {
    const fast = done([{ op: "shot.set", id: "s2", speed: 1.37 }]);
    expect(stretches(fast)).toEqual(stretches(fixture()));
    expect(filmFrames(fast)).toBe(150 + 88); // 4000 ms at 1.37 are 87.6 frames
    expect(done([{ op: "shot.set", id: "s2", speed: 1 }], fast)).toEqual(fixture());
    expect(done([{ op: "shot.set", id: "s2", speed: 1 }], done([{ op: "shot.set", id: "s2", speed: 4 }]))).toEqual(fixture());
  });

  it("keeps what rides on the shot at its moment and at its length, at any speed", () => {
    const fast = done([{ op: "shot.set", id: "s2", speed: 2 }]);
    expect(fast.shots[1]!.marks).toEqual(fixture().shots[1]!.marks);
    expect(shown(fast)).toEqual([["m1", 164, 22, 0], ["w1", 150, 20, 0], ["bar", 0, 210, 0]]);
  });

  it("gives the same film whether the speed is set on a shot and the shot then cut, or on each piece", () => {
    const cut = { op: "shot.split", id: "s1", atMs: 2000, newId: "s1b" };
    for (const speed of [1.1, 1.37, 0.5, 4]) {
      const whole = done([{ op: "shot.set", id: "s1", speed }, cut]);
      const pieces = done([cut, { op: "shot.set", id: "s1", speed }, { op: "shot.set", id: "s1b", speed }]);
      expect(pieces, `speed ${speed}`).toEqual(whole);
      expect(layout(pieces).runs, `speed ${speed}`).toHaveLength(2);
    }
  });

  it("treats a setting given as undefined as not given", () => {
    expect(refusal([{ op: "shot.set", id: "s1", speed: undefined }])).toEqual(stopped(0, "s1", "it sets nothing"));
    expect(done([{ op: "shot.set", id: "s1", speed: undefined, volume: 0.5 }]).shots[0]).toEqual({ ...fixture().shots[0]!, volume: 0.5 });
    expect(done([{ op: "shot.insert", after: null, shot: { id: "s3", asset: "broll", startMs: 0, endMs: 2000, speed: undefined, volume: undefined } }]).shots[0]).toEqual(newShot({ id: "s3", asset: "broll", endMs: 2000 }));
    expect(done([{ op: "mark.set", id: "m1", props: { size: undefined, y: 0.3 } }]).shots[1]!.marks[0]!.props).toMatchObject({ size: 120, y: 0.3 });
  });

  it("refuses a speed that leaves less than three frames, a change that sets nothing, and a shot that is not there", () => {
    expect(refusal([{ op: "shot.trim", id: "s1", endMs: 167 }, { op: "shot.set", id: "s1", speed: 4 }])).toEqual([{ path: "shots.0", id: "s1", message: 'shot "s1" fills 1 frames; the shortest shot is 3' }]);
    expect(refusal([{ op: "shot.set", id: "s1" }])).toEqual(stopped(0, "s1", "it sets nothing"));
    expect(refusal([{ op: "shot.set", id: "ghost", volume: 1 }])).toEqual(stopped(0, "ghost", 'there is no shot "ghost"'));
  });
});

describe("marks", () => {
  const hook: Mark = { id: "t1", part: "title", atMs: 0, lenMs: 2000, props: titleProps };

  it("adds a mark to a shot", () => {
    expect(done([{ op: "mark.add", shot: "s1", mark: hook }]).shots[0]!.marks).toEqual([hook]);
  });

  it("refuses a mark whose settings its part refuses, before anything is applied", () => {
    expect(paths([{ op: "mark.add", shot: "s1", mark: { ...hook, props: { ...titleProps, size: 20 } } }])).toEqual(["ops.0.mark.props.size"]);
  });

  it("moves a mark, changes its length and lays new settings over the ones it has", () => {
    const m1 = fixture().shots[1]!.marks[0]!;
    const edit = done([{ op: "mark.set", id: "m1", atMs: 9000, lenMs: 500, props: { y: 0.3 } }]);
    expect(edit.shots[1]!.marks[0]).toEqual({ ...m1, atMs: 9000, lenMs: 500, props: { ...m1.props, y: 0.3 } });
  });

  it("gives a mark another file to play, and refuses a file for a part that plays none", () => {
    const edit = done([{ op: "asset.add", id: "voice" }, { op: "mark.set", id: "w1", asset: "voice" }]);
    expect(edit.shots[1]!.marks[1]).toEqual({ ...fixture().shots[1]!.marks[1]!, asset: "voice" });
    expect(refusal([{ op: "mark.set", id: "m1", asset: "whoosh" }]).map((problem) => [problem.path, problem.id])).toEqual([["shots.1.marks.0", "m1"]]);
  });

  it("removes a mark", () => {
    expect(done([{ op: "mark.remove", id: "w1" }]).shots[1]!.marks.map((mark) => mark.id)).toEqual(["m1"]);
  });

  it("refuses a mark or a shot that is not there, and a change that sets nothing", () => {
    expect(refusal([{ op: "mark.add", shot: "ghost", mark: hook }])).toEqual(stopped(0, "t1", 'there is no shot "ghost"'));
    expect(refusal([{ op: "mark.set", id: "ghost", atMs: 0 }])).toEqual(stopped(0, "ghost", 'there is no mark "ghost"'));
    expect(refusal([{ op: "mark.remove", id: "ghost" }])).toEqual(stopped(0, "ghost", 'there is no mark "ghost"'));
    expect(refusal([{ op: "mark.set", id: "m1" }])).toEqual(stopped(0, "m1", "it sets nothing"));
    expect(refusal([{ op: "mark.set", id: "m1", lenMs: undefined, props: {} }])).toEqual(stopped(0, "m1", "it sets nothing"));
  });
});

describe("items", () => {
  it("adds an item to the film, counted from its start or back from its end", () => {
    expect(done([{ op: "item.add", item: title("t1", 0, 60) }]).items).toEqual([fixture().items[0], title("t1", 0, 60)]);
    expect(shown(done([{ op: "item.add", item: title("end", 60, null, "end") }]))[3]).toEqual(["end", 210, 60, 0]);
  });

  it("moves an item, lets it last to the film's end, and lays new settings over the ones it has", () => {
    const edit = done([{ op: "item.add", item: title("t1", 0, 60) }, { op: "item.set", id: "t1", at: 30, frames: null, props: { text: "New hook" } }]);
    expect(edit.items[1]).toEqual({ ...title("t1", 30, null), props: { ...titleProps, text: "New hook" } });
    expect(done([{ op: "item.set", id: "t1", anchor: "end", at: 45 }], edit).items[1]).toMatchObject({ anchor: "end", at: 45, frames: null });
  });

  it("gives an item another file to play", () => {
    const cutaway: Item = { id: "c1", part: "cutaway", asset: "broll", anchor: "start", at: 0, frames: 60, props: { fit: "cover", startMs: 0, volume: 0 } };
    const edit = done([{ op: "asset.add", id: "pic" }, { op: "item.add", item: cutaway }, { op: "item.set", id: "c1", asset: "pic" }]);
    expect(edit.items[1]).toEqual({ ...cutaway, asset: "pic" });
  });

  it("removes an item", () => {
    expect(done([{ op: "item.remove", id: "bar" }]).items).toEqual([]);
  });

  it("refuses an item that is not there, and a change that sets nothing", () => {
    expect(refusal([{ op: "item.set", id: "ghost", at: 0 }])).toEqual(stopped(0, "ghost", 'there is no item "ghost"'));
    expect(refusal([{ op: "item.remove", id: "ghost" }])).toEqual(stopped(0, "ghost", 'there is no item "ghost"'));
    expect(refusal([{ op: "item.set", id: "bar" }])).toEqual(stopped(0, "bar", "it sets nothing"));
  });
});

describe("words and captions", () => {
  const words = (edit: Edit) => (edit.assets[0]!.kind === "video" ? edit.assets[0]!.words! : []);

  it("fixes a word's text", () => {
    expect(words(done([{ op: "word.set", asset: "take", index: 2, text: "Maven" }]))[2]).toEqual({ text: "Maven", startMs: 8920, endMs: 9400 });
    // A word is stored as NFC: a letter typed as a base and a combining mark becomes the one letter (final fix wave).
    expect(words(done([{ op: "word.set", asset: "take", index: 2, text: "nai\u0308ve" }]))[2]?.text).toBe("naïve");
  });

  it("hides a word or stresses it, and takes either back", () => {
    const changed = done([{ op: "word.set", asset: "take", index: 0, hidden: true }, { op: "word.set", asset: "take", index: 1, stress: true }]);
    expect(words(changed).slice(0, 2)).toEqual([{ text: "Hello", startMs: 600, endMs: 900, hidden: true }, { text: "guys,", startMs: 900, endMs: 1300, stress: true }]);
    expect(done([{ op: "word.set", asset: "take", index: 0, hidden: false }, { op: "word.set", asset: "take", index: 1, stress: false }], changed)).toEqual(fixture());
  });

  it("refuses a word that is not there, and a change that sets nothing", () => {
    expect(refusal([{ op: "word.set", asset: "take", index: 4, text: "x" }])).toEqual(stopped(0, "take", '"take" has no word 4'));
    expect(refusal([{ op: "word.set", asset: "broll", index: 0, text: "x" }])).toEqual(stopped(0, "broll", '"broll" has no word 0'));
    expect(refusal([{ op: "word.set", asset: "whoosh", index: 0, text: "x" }])).toEqual(stopped(0, "whoosh", '"whoosh" has no word 0'));
    expect(refusal([{ op: "word.set", asset: "ghost", index: 0, text: "x" }])).toEqual(stopped(0, "ghost", 'there is no file "ghost" in the edit'));
    expect(refusal([{ op: "word.set", asset: "take", index: 0 }])).toEqual(stopped(0, "take", "it sets nothing"));
  });

  it("sets what it is given of the captions and leaves the rest", () => {
    expect(done([{ op: "captions.set", look: "pop", size: 84, font: "montserrat" }]).captions).toEqual({ ...DEFAULT_CAPTIONS, look: "pop", size: 84, font: "montserrat" });
    expect(done([{ op: "captions.set", on: false, highlight: null }]).captions).toEqual({ ...DEFAULT_CAPTIONS, on: false, highlight: null });
    expect(done([{ op: "captions.set", size: undefined, look: "pop" }]).captions).toEqual({ ...DEFAULT_CAPTIONS, look: "pop" });
  });

  it("sets a weight with captions.set and item.set, and keeps it when another setting changes", () => {
    const light = done([{ op: "captions.set", weight: 600 }]);
    expect(light.captions).toEqual({ ...DEFAULT_CAPTIONS, weight: 600 });
    expect(done([{ op: "captions.set", size: 70 }], light).captions).toEqual({ ...DEFAULT_CAPTIONS, size: 70, weight: 600 });
    const titled = done([{ op: "item.add", item: title("t1", 0, 60) }, { op: "item.set", id: "t1", props: { weight: 500 } }]);
    expect(titled.items.find((item) => item.id === "t1")?.props).toEqual({ ...titleProps, weight: 500 });
    expect(paths([{ op: "captions.set", weight: 650 }])).toEqual(["ops.0.weight"]);
  });

  it("refuses captions too small to read, and a change that sets nothing", () => {
    expect(paths([{ op: "captions.set", size: 20 }])).toEqual(["ops.0.size"]);
    expect(refusal([{ op: "captions.set" }])).toEqual(stopped(0, null, "it sets nothing"));
    expect(refusal([{ op: "captions.set", size: undefined }])).toEqual(stopped(0, null, "it sets nothing"));
  });
});

describe("files", () => {
  it("adds a file from the ones on offer, with the facts they were measured with", () => {
    expect(done([{ op: "asset.add", id: "pic" }]).assets).toEqual([...fixture().assets, picture]);
  });

  it("copies the file, so nothing done to it in the edit reaches the files on offer", () => {
    const offered = library();
    const result = applyOps(newEdit(picture), [{ op: "asset.add", id: "take" }, { op: "word.set", asset: "take", index: 0, text: "Changed" }], offered);
    expect(result.ok && result.edit.assets[1]).toMatchObject({ id: "take", words: [{ text: "Changed" }, {}, {}, {}] });
    expect(offered).toEqual(library());
  });

  it("refuses a file that is not on offer, and says which are", () => {
    expect(refusal([{ op: "asset.add", id: "ghost" }])).toEqual(stopped(0, "ghost", 'there is no file "ghost" to add; the files on offer are: take, broll, whoosh, pic, voice'));
    expect(applyOps(fixture(), [{ op: "asset.add", id: "pic" }])).toEqual({ ok: false, problems: stopped(0, "pic", 'there is no file "pic" to add; no files are on offer') });
  });

  it("has no way to add a file with facts of the caller's own", () => {
    expect(paths([{ op: "asset.add", id: "mine", asset: { ...voice, id: "mine", ms: 999999 } }])).toEqual(["ops.0"]);
    expect(paths([{ op: "asset.add", asset: voice }])).toEqual(["ops.0.id", "ops.0"]);
  });

  it("refuses a file that is already in the edit", () => {
    expect(refusal([{ op: "asset.add", id: "take" }])).toEqual(stopped(0, "take", 'a file "take" is already in the edit'));
  });

  it("removes a file nothing uses, and refuses one a shot, a mark or an item still uses", () => {
    expect(done([{ op: "asset.remove", id: "broll" }]).assets.map((asset) => asset.id)).toEqual(["take", "whoosh"]);
    expect(refusal([{ op: "asset.remove", id: "take" }])).toEqual(stopped(0, "take", 'shot "s1" still uses "take"'));
    expect(refusal([{ op: "asset.remove", id: "whoosh" }])).toEqual(stopped(0, "whoosh", 'sound "w1" still uses "whoosh"'));
    const used = withEdit((e) => { e.items.push({ id: "c1", part: "cutaway", asset: "broll", anchor: "start", at: 0, frames: 60, props: { fit: "cover", startMs: 0, volume: 0 } }); });
    expect(refusal([{ op: "asset.remove", id: "broll" }], used)).toEqual(stopped(0, "broll", 'cutaway "c1" still uses "broll"'));
    expect(refusal([{ op: "asset.remove", id: "ghost" }])).toEqual(stopped(0, "ghost", 'there is no file "ghost" in the edit'));
  });
});

describe("the look", () => {
  it("sets the film's preset and keeps its adjustments, and the other way round", () => {
    const warm = done([{ op: "look.set", preset: "warm" }]);
    expect(warm.look).toEqual({ preset: "warm", adjust: NEUTRAL });
    const brighter = done([{ op: "look.set", adjust: { exposure: 0.2 } }], warm);
    expect(brighter.look).toEqual({ preset: "warm", adjust: { ...NEUTRAL, exposure: 0.2 } });
    expect(done([{ op: "look.set", preset: "cool", adjust: { contrast: -0.1 } }], brighter).look).toEqual({ preset: "cool", adjust: { ...NEUTRAL, exposure: 0.2, contrast: -0.1 } });
  });

  it("lets a shot change the film's look: adjustments on top of it, a preset of its own, or the film's again", () => {
    const edit = done([{ op: "look.set", shot: "s1", adjust: { exposure: 0.2 } }]);
    expect(edit.shots[0]!.look).toEqual({ preset: null, adjust: { ...NEUTRAL, exposure: 0.2 } });
    expect(edit.shots[1]!.look).toBeNull();
    const mono = done([{ op: "look.set", shot: "s1", preset: "mono" }], edit);
    expect(mono.shots[0]!.look).toEqual({ preset: "mono", adjust: { ...NEUTRAL, exposure: 0.2 } });
    expect(done([{ op: "look.set", shot: "s1", preset: null }], mono).shots[0]!.look).toEqual(edit.shots[0]!.look);
  });

  it("reaches every shot when it is set on the film, tweaked or not, in whatever order", () => {
    const [tweak, warm] = [{ op: "look.set", shot: "s1", adjust: { exposure: 0.2 } }, { op: "look.set", preset: "warm", adjust: { contrast: 0.1 } }];
    expect(done([tweak, warm])).toEqual(done([warm, tweak]));
    const edit = done([tweak, warm]);
    expect(lookOf(edit, edit.shots[0]!)).toEqual({ preset: "warm", adjust: { ...NEUTRAL, exposure: 0.2, contrast: 0.1 } });
    expect(lookOf(edit, edit.shots[1]!)).toEqual({ preset: "warm", adjust: { ...NEUTRAL, contrast: 0.1 } });
  });

  it("clears what a shot changes, and clears the film's look to none", () => {
    const edit = done([{ op: "look.set", preset: "warm" }, { op: "look.set", shot: "s1", preset: "mono" }]);
    expect(done([{ op: "look.clear", shot: "s1" }], edit).shots[0]!.look).toBeNull();
    expect(done([{ op: "look.clear" }], edit).look).toEqual(NO_LOOK);
    expect(done([{ op: "look.clear" }], edit).shots[0]!.look).toEqual({ preset: "mono", adjust: NEUTRAL });
  });

  it("refuses an adjustment out of range, a look that sets nothing, no preset for the film, and a shot that is not there", () => {
    expect(paths([{ op: "look.set", adjust: { exposure: 3 } }])).toEqual(["ops.0.adjust.exposure"]);
    expect(paths([{ op: "look.set", adjust: { glow: 1 } }])).toEqual(["ops.0.adjust"]);
    expect(refusal([{ op: "look.set" }])).toEqual(stopped(0, null, "it sets nothing"));
    expect(refusal([{ op: "look.set", adjust: {} }])).toEqual(stopped(0, null, "it sets nothing"));
    expect(refusal([{ op: "look.set", preset: null }])).toEqual(stopped(0, null, "the film's look needs a preset; only a shot can take the film's"));
    expect(refusal([{ op: "look.set", shot: "ghost", preset: "warm" }])).toEqual(stopped(0, "ghost", 'there is no shot "ghost"'));
    expect(refusal([{ op: "look.clear", shot: "ghost" }])).toEqual(stopped(0, "ghost", 'there is no shot "ghost"'));
  });
});

describe("the cover", () => {
  it("sets and clears the cover", () => {
    const covered = done([{ op: "cover.set", cover: { shot: "s2", atMs: 9000 } }]);
    expect(covered.cover).toEqual({ shot: "s2", atMs: 9000 });
    expect(done([{ op: "cover.set", cover: null }], covered)).toEqual(fixture());
  });

  it("refuses a cover on a shot that is not there", () => {
    expect(refusal([{ op: "cover.set", cover: { shot: "ghost", atMs: 0 } }])).toEqual([{ path: "cover.shot", id: "ghost", message: 'the cover is on shot "ghost", and there is no such shot' }]);
  });
});
