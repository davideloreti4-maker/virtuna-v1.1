import { describe, expect, it } from "vitest";
import type { Analyses, FaceSample, ShareBox, TakeAnalysis } from "../../analysis";
import { DEFAULT_CAPTIONS, NEUTRAL, newEdit, newShot, type Asset, type Edit, type Word } from "../../doc";
import { applyOps, type Op } from "../../ops";
import { PAUSE_MS, punchIns, tighten } from "../../recipes";
import { CAPTIONS, review, textErrorFrames, type Finding } from "../../review";
import { titleBox, calloutBox } from "../../../../edit/film/layout";
import { layout } from "../../derive";
import { measure, type FontId } from "../../measure";
import { FONTS } from "../../parts";
import { CUT_NEAR_MS, NO_SOUND, ROOM_BUDGET, ROOM_PROBE, ROOM_STRETCH, ROOM_YS, ZOOM, captionsFit, captionsHint, captionsRule, captionsWorse, contextOf, effectOf, endsTrim, pauseBefore, roomFor, sameAs, timeCut, zoomFor } from "../context";
import { analysis, box, faces, pop, take, twoShots } from "./fixture";

const FINDINGS: Finding[] = [
  { code: "on-face", severity: "error", where: { frame: 72, mark: "m1" }, says: 'The call-out "m1" at 2.4 s covers the mouth: move it up.' },
  { code: "soft-zoom", severity: "warn", where: { frame: 66, shot: "s2" }, says: 'Shot "s2" at 2.2 s is enlarged past its pixels: zoom out.' },
];

/** A long take's whole context asks the review some hundreds of times: two to three seconds here, more on a busy machine. */
const LONG_TAKE_MS = 20_000;

describe("contextOf", () => {
  it("writes a two-shot edit, its words, pauses, faces and findings, line by line", () => {
    const context = contextOf(twoShots(), { t1: analysis() }, FINDINGS);
    expect(context.edit.split("\n")).toEqual([
      "film 156f",
      "asset t1 video 6000ms 720x1280 sound filmed",
      "asset pop audio 500ms kit",
      'shot s1 take=t1 [0,2400)ms speed=1 vol=1 film=[0,72)f look=- marks=[] out={"kind":"fade","frames":6}',
      'shot s2 take=t1 [3000,6000)ms speed=1 vol=1 film=[66,156)f look=mono marks=[m1:callout@3200+800,p1:sound@3200+400] framing={"from":{"zoom":1.2,"x":0,"y":0},"move":null}',
      'mark m1 film=[72,96)f props={"text":"works","font":"tiktok","look":"pop","x":0.5,"y":0.3,"size":120,"color":"#ffffff"}',
      'mark p1 film=[72,84)f asset=pop props={"startMs":0,"volume":0.8,"fadeInMs":0,"fadeOutMs":100}',
      'item bar progress anchor=start at=0 frames=null film=[0,156)f props={"edge":"top","color":"#ffffff"}',
      "captions on=true look=pill font=tiktok size=72 y=0.8 width=0.86 maxWords=3 highlight=#ffe14a",
      'look preset=warm adjust={"saturation":0.2}',
      "cover shot=s1 atMs=600 frame=18",
    ]);
    expect(context.words.split("\n")).toEqual([
      "take t1",
      "w0 Hi [300,500)",
      "w1 there [500,800)",
      "w2 so [1500,1700) (hidden)",
      "w3 this [1700,2100) (stressed)",
      "w4 works [3200,3600)",
      "w5 well [3600,4000) (hidden) (stressed)",
      // Where the speech listed begins and ends, said outright (Task 14).
      "first w0 starts 300; last w5 ends 4000",
    ]);
    expect(context.pauses.split("\n")).toEqual(["take t1", "[900,1500) cut@1200", "[2300,3100) cut@2700"]);
    // Through the cover fit (720x1280 fills the stage exactly) and each shot's framing: s2's 1.2 zoom
    // about the centre makes it a group of its own. s1's face holds still: its line alone. s2's moves
    // 0.12: its line, then its seconds, the last two merged.
    expect(context.faces.split("\n")).toEqual([
      "shot s1 take=t1 face y=[0.25,0.50] x=[0.25,0.75] mouth y=[0.42,0.47] x=[0.40,0.60]",
      "shot s2 take=t1 face y=[0.20,0.50] x=[0.20,0.92] mouth y=[0.40,0.47] x=[0.38,0.74]",
      "[3000,4000) face y=[0.20,0.50] x=[0.20,0.80] mouth y=[0.40,0.47] x=[0.38,0.62]",
      "[4000,6000) face y=[0.20,0.50] x=[0.32,0.92] mouth y=[0.40,0.47] x=[0.50,0.74]",
    ]);
    expect(context.findings.split("\n")).toEqual([
      'error on-face frame=72 The call-out "m1" at 2.4 s covers the mouth: move it up.',
      'warn soft-zoom frame=66 Shot "s2" at 2.2 s is enlarged past its pixels: zoom out.',
    ]);
  });

  it("writes an error with the way to fix it and a warning without (Task 14): a warning is a note, not work to do", () => {
    const findings: Finding[] = [
      { code: "on-face", severity: "error", where: { frame: 4 }, says: "the captions at 0.1 s cover the mouth; move them up or down" },
      { code: "on-face", severity: "warn", where: { frame: 4 }, says: "the captions at 0.1 s touch the chin; move them up or down" },
      { code: "under-buttons", severity: "warn", where: { frame: 0, item: "hook" }, says: 'the title "Wait; what" at 0.0 s touches Instagram\'s top bar; move it down' },
      { code: "unmeasured", severity: "warn", where: { frame: 9, item: "c" }, says: 'the call-out "a; b" at 0.3 s holds "x", which cannot be measured, so where it sits was not checked' },
    ];
    expect(contextOf(twoShots(), {}, findings).findings.split("\n")).toEqual([
      "error on-face frame=4 the captions at 0.1 s cover the mouth; move them up or down",
      "warn on-face frame=4 the captions at 0.1 s touch the chin",
      'warn under-buttons frame=0 the title "Wait; what" at 0.0 s touches Instagram\'s top bar',
      // No fix in it: nothing is cut, and a "; " inside what it quotes is not one.
      'warn unmeasured frame=9 the call-out "a; b" at 0.3 s holds "x", which cannot be measured, so where it sits was not checked',
    ]);
  });

  it("writes a fresh edit of a take in the plain shot line, and only what differs from plain after it", () => {
    const edit = newEdit(take());
    expect(contextOf(edit, {}, []).edit.split("\n")).toEqual([
      "film 180f",
      "asset t1 video 6000ms 720x1280 sound filmed",
      "shot s1 take=t1 [0,6000)ms speed=1 vol=1 film=[0,180)f look=- marks=[]",
      "captions on=true look=pill font=tiktok size=72 y=0.8 width=0.86 maxWords=3 highlight=#ffe14a",
      "look preset=natural adjust=-",
      "cover -",
    ]);
    const shot = edit.shots[0];
    if (!shot) throw new Error("newEdit gave no shot");
    shot.look = { preset: null, adjust: { ...NEUTRAL, warmth: 0.1 } };
    shot.speed = 1.5;
    expect(contextOf(edit, {}, []).edit.split("\n")[2]).toBe('shot s1 take=t1 [0,6000)ms speed=1.5 vol=1 film=[0,120)f look=- marks=[] adjust={"warmth":0.1}');
  });

  it("says when no sound is on offer, in the files' last line (Task 14)", () => {
    expect(NO_SOUND).toBe("no sound on offer");
    expect(contextOf(newEdit(take()), {}, []).files.split("\n")).toEqual(["t1 video 6000ms 720x1280 sound filmed in edit", NO_SOUND]);
    // A sound in the edit, or one to add: no such line.
    expect(contextOf(twoShots(), {}, []).files).not.toContain(NO_SOUND);
    expect(contextOf(newEdit(take()), {}, [], [pop]).files.split("\n")).toEqual(["t1 video 6000ms 720x1280 sound filmed in edit", "pop audio 500ms kit to add"]);
  });

  it("lists the files on offer: the edit's own, then the ones to add, each once", () => {
    const edit = twoShots();
    expect(contextOf(edit, {}, []).files.split("\n")).toEqual(["t1 video 6000ms 720x1280 sound filmed in edit", "pop audio 500ms kit in edit"]);
    const whoosh: Asset = { id: "whoosh", kind: "audio", origin: "kit", at: { kit: "sfx/whoosh.wav" }, ms: 677 };
    const logo: Asset = { id: "logo", kind: "image", origin: "uploaded", at: { bucket: "edit-media", path: "u1/logo.png" }, w: 512, h: 512 };
    // The library may hold the edit's own files too, as the route passes it to the door: they are listed once.
    const library = [structuredClone(pop), whoosh, logo, structuredClone(whoosh)];
    expect(contextOf(edit, {}, [], library).files.split("\n")).toEqual([
      "t1 video 6000ms 720x1280 sound filmed in edit",
      "pop audio 500ms kit in edit",
      "whoosh audio 677ms kit to add",
      "logo image 512x512 uploaded to add",
    ]);
  });

  it("keeps the files under 2,000 characters: the edit's own first, then the library's in order, and a last line for the rest", () => {
    const edit = twoShots();
    const library: Asset[] = Array.from({ length: 200 }, (_, i) => ({ id: `sfx${i}`, kind: "audio", origin: "kit", at: { kit: `sfx/s${i}.wav` }, ms: 500 + i }));
    const lines = contextOf(edit, {}, [], library).files.split("\n");
    expect(lines.join("\n").length).toBeLessThanOrEqual(2000);
    expect(lines.slice(0, 4)).toEqual(["t1 video 6000ms 720x1280 sound filmed in edit", "pop audio 500ms kit in edit", "sfx0 audio 500ms kit to add", "sfx1 audio 501ms kit to add"]);
    expect(lines.at(-1)).toBe("… (more files)");
    // In the library's order, none skipped before the cut.
    const kept = lines.slice(2, -1).map((line) => line.split(" ")[0]);
    expect(kept).toEqual(library.slice(0, kept.length).map((asset) => asset.id));
    expect(kept.length).toBeGreaterThan(50);
    // A small library is listed whole, with no last line.
    expect(contextOf(edit, {}, [], library.slice(0, 3)).files).not.toContain("more files");
  });

  it("leaves the words out of the edit, and says none where there is nothing", () => {
    const context = contextOf(twoShots(), {}, []);
    expect(context.edit).not.toContain("there");
    expect(context.findings).toBe("none");
    const silent = newEdit(take({ words: null }));
    expect(contextOf(silent, {}, []).words).toBe("none");
  });

  it("says not measured for a take with no analysis, and none for a measured take where none was found", () => {
    const context = contextOf(twoShots(), {}, []);
    expect(context.faces).toBe("shot s1,s2 take=t1 not measured");
    expect(context.pauses).toBe("take t1 not measured");
    const analysed = contextOf(twoShots(), { t1: analysis({ pauses: [], faces: [] }) }, []);
    expect(analysed.pauses).toBe("take t1 none");
    expect(analysed.faces).toBe("shot s1 take=t1 none\nshot s2 take=t1 none");
    // An edit of pictures shows no take.
    const still = newEdit({ id: "pic", kind: "image", origin: "uploaded", at: { bucket: "edit-media", path: "u1/pic.jpg" }, w: 1080, h: 1920 });
    expect(contextOf(still, {}, []).faces).toBe("no take shown");
    expect(contextOf(still, {}, []).pauses).toBe("no take shown");
    expect(contextOf(still, {}, []).words).toBe("none");
  });

  it("gives a face that moves no more than 0.10 its group's line alone, with mouth - where none was found", () => {
    const xs = [0.25, 0.27, 0.29, 0.24, 0.31, 0.3];
    const samples: FaceSample[] = xs.map((x, i) => ({ ms: i * 200, face: box(x, 0.2, 0.5, 0.3), mouth: null }));
    const edit = newEdit(take({ ms: 1200, words: [] }));
    const context = contextOf(edit, { t1: analysis({ pauses: [], faces: samples }) }, []);
    expect(context.faces).toBe("shot s1 take=t1 face y=[0.20,0.50] x=[0.24,0.81] mouth -");
  });

  it("gives a moving face its seconds, merged while they stay within 0.05 of the stretch's first", () => {
    // 0.2 for two seconds, 0.22 for one (within 0.05: merged), then 0.4 for three.
    const xAt = (ms: number) => (ms < 2000 ? 0.2 : ms < 3000 ? 0.22 : 0.4);
    const samples: FaceSample[] = Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face: box(xAt(i * 200), 0.2, 0.5, 0.3), mouth: box(xAt(i * 200) + 0.15, 0.4, 0.2, 0.05) }));
    const edit = newEdit(take({ words: [] }));
    const context = contextOf(edit, { t1: analysis({ pauses: [], faces: samples }) }, []);
    expect(context.faces.split("\n")).toEqual([
      "shot s1 take=t1 face y=[0.20,0.50] x=[0.20,0.90] mouth y=[0.40,0.45] x=[0.35,0.75]",
      "[0,3000) face y=[0.20,0.50] x=[0.20,0.72] mouth y=[0.40,0.45] x=[0.35,0.57]",
      "[3000,6000) face y=[0.20,0.50] x=[0.40,0.90] mouth y=[0.40,0.45] x=[0.55,0.75]",
    ]);
  });

  it("writes at most one line a second of the group's footage, however the face moves inside it", () => {
    // 0.012 further right at every sample: 0.06 a second, so no two seconds merge.
    const samples: FaceSample[] = Array.from({ length: 25 }, (_, i) => ({ ms: i * 200, face: box(0.1 + 0.012 * i, 0.2, 0.4, 0.3), mouth: null }));
    const edit = newEdit(take({ ms: 5000, words: [] }));
    const lines = contextOf(edit, { t1: analysis({ pauses: [], faces: samples }) }, []).faces.split("\n").slice(1);
    expect(lines.map((line) => line.split(" ")[0])).toEqual(["[0,1000)", "[1000,2000)", "[2000,3000)", "[3000,4000)", "[4000,5000)"]);
  });

  it("groups the shots of one take framed alike, each moving shot alone, with seconds over the group's own footage", () => {
    // The face is at x 0.2 to 0.7 until 3 s, then at 0.4 to 0.9. s1 and s3 are framed as the take
    // comes; s2 is punched in 1.2 times; s4 moves from the take's framing to 1.2 over its 2 s.
    const samples: FaceSample[] = Array.from({ length: 40 }, (_, i) => ({ ms: i * 200, face: box(i * 200 < 3000 ? 0.2 : 0.4, 0.2, 0.5, 0.3), mouth: null }));
    const punched = { from: { zoom: 1.2, x: 0, y: 0 }, move: null };
    const edit: Edit = {
      ...newEdit(take({ ms: 8000, words: [] })),
      shots: [
        newShot({ id: "s1", asset: "t1", endMs: 2000 }),
        { ...newShot({ id: "s2", asset: "t1", startMs: 2000, endMs: 4000 }), framing: punched },
        newShot({ id: "s3", asset: "t1", startMs: 4000, endMs: 6000 }),
        { ...newShot({ id: "s4", asset: "t1", startMs: 6000, endMs: 8000 }), framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "linear", part: [0, 1] } } },
      ],
    };
    expect(contextOf(edit, { t1: analysis({ pauses: [], faces: samples }) }, []).faces.split("\n")).toEqual([
      // s1 and s3: one place on the stage; s3 is the group's seconds 2 to 4.
      "shot s1,s3 take=t1 face y=[0.20,0.50] x=[0.20,0.90] mouth -",
      "[0,2000) face y=[0.20,0.50] x=[0.20,0.70] mouth -",
      "[4000,6000) face y=[0.20,0.50] x=[0.40,0.90] mouth -",
      "shot s2 take=t1 face y=[0.14,0.50] x=[0.14,0.98] mouth -",
      "[2000,3000) face y=[0.14,0.50] x=[0.14,0.74] mouth -",
      "[3000,4000) face y=[0.14,0.50] x=[0.38,0.98] mouth -",
      // The move takes the face no more than 0.10: its line alone, held to where the move ends, at zoom 1.2.
      "shot s4 take=t1 face y=[0.14,0.50] x=[0.38,0.98] mouth -",
    ]);
  });

  it("keeps a three-minute take's faces at or under 6,000 characters in 1 to 200 shots, however the face moves", () => {
    for (const moves of ["sways", "jitters", "sweeps"] as const) {
      for (const count of [1, 24, 60, 90, 200]) {
        const { edit, analyses } = longTake({ ms: 180_000, moves });
        const faces = contextOf(cutInto(edit, count), analyses, []).faces;
        const groups = faces.split("\n").filter((line) => line.startsWith("shot "));
        expect(faces.length, `${moves}, ${count} shots`).toBeLessThanOrEqual(6000);
        expect(faces, `${moves}, ${count} shots`).not.toContain("trimmed");
        // Plain, punched in, and two moving shots.
        expect(groups, `${moves}, ${count} shots`).toHaveLength(count === 1 ? 1 : 4);
      }
    }
  });

  it("keeps a three-minute take tightened and punched in by the recipes at or under 6,000 characters", () => {
    for (const moves of ["sways", "jitters", "sweeps"] as const) {
      const { edit, analyses } = longTake({ ms: 180_000, moves });
      const tight = through(edit, tighten(edit, analyses, { pauseMs: 200 }));
      const punchedIn = through(tight, punchIns(tight, analyses, { perMin: 10, zoom: 1.2 }));
      expect(punchedIn.shots.length, moves).toBeGreaterThan(40);
      const faces = contextOf(punchedIn, analyses, []).faces;
      expect(faces.length, moves).toBeLessThanOrEqual(6000);
      expect(faces, moves).not.toContain("trimmed");
    }
  }, 30_000);

  it("cuts the faces off with a last line that says so when even the groups do not fit", () => {
    // 200 shots, each panned differently: 200 groups.
    const { edit, analyses } = longTake({ ms: 180_000, moves: "sways" });
    const cut = cutInto(edit, 200, false);
    const panned = through(cut, cut.shots.map((shot, i) => ({ op: "shot.set" as const, id: shot.id, framing: { from: { zoom: 1.1, x: -1 + i / 100, y: 0 }, move: null } })));
    const faces = contextOf(panned, analyses, []).faces;
    expect(faces.length).toBeLessThanOrEqual(6000);
    expect(faces.endsWith("\n… (faces trimmed)")).toBe(true);
    expect(faces.split("\n")[0]).toMatch(/^shot s1 take=t1 face y=/);
  });

  it("holds a moving shot's face wherever its move takes it: each sample at the start and the end of its stretch", () => {
    // One sample for the whole shot, and a move from the take's framing to twice as close.
    const samples: FaceSample[] = [{ ms: 0, face: box(0.4, 0.4, 0.2, 0.2), mouth: null }];
    const edit = newEdit(take({ ms: 2000, words: [] }));
    edit.shots[0] = { ...newShot({ id: "s1", asset: "t1", endMs: 2000 }), framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 2, x: 0, y: 0 }, ease: "linear", part: [0, 1] } } };
    // At its start the face is at 0.4 to 0.6; at its end, twice as large about the centre, 0.3 to 0.7.
    expect(contextOf(edit, { t1: analysis({ pauses: [], faces: samples }) }, []).faces).toBe("shot s1 take=t1 face y=[0.30,0.70] x=[0.30,0.70] mouth -");
  });

  it("keeps a sample that found a mouth and no face, for its mouth", () => {
    const samples: FaceSample[] = [{ ms: 0, face: null, mouth: box(0.45, 0.55, 0.1, 0.05) }];
    const edit = newEdit(take({ ms: 1000, words: [] }));
    expect(contextOf(edit, { t1: analysis({ pauses: [], faces: samples }) }, []).faces).toBe("shot s1 take=t1 face - mouth y=[0.55,0.60] x=[0.45,0.55]");
  });

  it("rounds every box outward and writes a share below 0 plainly", () => {
    // A face reaching past the stage's left edge once the shot is enlarged: 0.5 + 1.5 × (0.0 − 0.5) = −0.25.
    const samples: FaceSample[] = [{ ms: 0, face: box(0, 0.333, 0.25, 0.2), mouth: null }];
    const edit = newEdit(take({ ms: 1000, words: [] }));
    edit.shots[0] = { ...newShot({ id: "s1", asset: "t1", endMs: 1000 }), framing: { from: { zoom: 1.5, x: 0, y: 0 }, move: null } };
    // y: 0.5 + 1.5 × (0.333 − 0.5) = 0.2495, down to 0.24; 0.5 + 1.5 × (0.533 − 0.5) = 0.5495, up to 0.55. x: −0.25 to 0.125, up to 0.13.
    expect(contextOf(edit, { t1: analysis({ pauses: [], faces: samples }) }, []).faces).toBe("shot s1 take=t1 face y=[0.24,0.55] x=[-0.25,0.13] mouth -");
  });

  it("groups shots at zoom 1 whatever their x and y, which do nothing there", () => {
    const edit: Edit = {
      ...newEdit(take({ words: [] })),
      shots: [
        newShot({ id: "s1", asset: "t1", endMs: 3000 }),
        { ...newShot({ id: "s2", asset: "t1", startMs: 3000, endMs: 6000 }), framing: { from: { zoom: 1, x: 0.5, y: -0.3 }, move: null } },
      ],
    };
    const faces = contextOf(edit, { t1: analysis({ pauses: [] }) }, []).faces.split("\n");
    expect(faces.filter((line) => line.startsWith("shot "))).toEqual(["shot s1,s2 take=t1 face y=[0.25,0.50] x=[0.25,0.85] mouth y=[0.42,0.47] x=[0.40,0.70]"]);
  });

  it("writes the same text for an edit stored with its keys in another order", () => {
    const reversed = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reversed);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, inner]) => [key, reversed(inner)]));
      return value;
    };
    const edit = twoShots();
    const shuffled = reversed(edit) as Edit;
    expect(JSON.stringify(shuffled)).not.toBe(JSON.stringify(edit));
    expect(contextOf(shuffled, { t1: analysis() }, FINDINGS)).toEqual(contextOf(edit, { t1: analysis() }, FINDINGS));
  });

  it("refuses an edit that is not valid", () => {
    const edit = twoShots();
    edit.captions.size = 10;
    expect(() => contextOf(edit, {}, [])).toThrow(/valid edit: captions\.size/);
  });

  it("writes a take's words and pauses only around what its shots show: a 10-minute take shown 60 s at a time stays well under the limit", () => {
    const { edit, analyses } = longTake({ ms: 600_000, moves: "sways", count: Infinity });
    const shown = through(edit, [{ op: "shot.trim", id: "s1", startMs: 120_000, endMs: 180_000 }]);
    const context = contextOf(shown, analyses, []);
    const said = context.words.split("\n");
    const words = said.slice(1, -1).map((line) => line.match(/^w(\d+) \S+ \[(\d+),(\d+)\)/));
    // The last line: where the speech listed begins and ends (Task 14).
    expect(said.at(-1)).toBe(`first w${words[0]?.[1]} starts ${words[0]?.[2]}; last w${words.at(-1)?.[1]} ends ${words.at(-1)?.[3]}`);
    expect(words.length).toBeGreaterThan(200);
    expect(words.length).toBeLessThan(300);
    for (const word of words) {
      expect(Number(word?.[3])).toBeGreaterThan(118_000);
      expect(Number(word?.[2])).toBeLessThan(182_000);
    }
    // Indexes stay the take's own, as word.set names them.
    expect(Number(words[0]?.[1])).toBeGreaterThan(400);
    // One pause every 3.4 s: about 19 of the take's 175 come within 2 s of the minute shown.
    const pauses = context.pauses.split("\n").slice(1).map((line) => line.match(/^\[(\d+),(\d+)\) cut@\d+$/));
    expect(analyses.t1?.pauses.length).toBeGreaterThan(150);
    expect(pauses.length).toBeGreaterThan(15);
    expect(pauses.length).toBeLessThan(25);
    for (const pause of pauses) {
      expect(Number(pause?.[2])).toBeGreaterThan(118_000);
      expect(Number(pause?.[1])).toBeLessThan(182_000);
    }
    const size = Object.values(context).reduce((sum, part) => sum + part.length, 0);
    // 13,000 since Task 14 (it was 10,000): the room is a section more, of at most 3,000 characters.
    expect(context.room.length).toBeLessThanOrEqual(ROOM_BUDGET);
    expect(size).toBeLessThan(13_000);
  });

  it("says none for a measured take with no pause near what is shown, and leaves out a take no shot shows", () => {
    // Pauses only at 4 s and 9 s of a 12 s take; the shot shows 0 to 1.5 s.
    const edit = through(newEdit(take({ ms: 12_000, words: [] })), [{ op: "shot.trim", id: "s1", endMs: 1500 }]);
    const pauses = [{ startMs: 4000, endMs: 4400, cutMs: 4200 }, { startMs: 9000, endMs: 9400, cutMs: 9200 }];
    expect(contextOf(edit, { t1: analysis({ pauses, faces: [] }) }, []).pauses).toBe("take t1 none");
    const near = through(edit, [{ op: "shot.trim", id: "s1", endMs: 2500 }]);
    expect(contextOf(near, { t1: analysis({ pauses, faces: [] }) }, []).pauses).toBe("take t1\n[4000,4400) cut@4200");
    // A second take that no shot shows: no words, no pauses.
    const unused = { ...take({ id: "t2" }), at: { bucket: "edit-media", path: "u1/t2.mp4" } };
    const both: Edit = { ...near, assets: [...near.assets, unused] };
    const context = contextOf(both, { t1: analysis({ pauses, faces: [] }), t2: analysis() }, []);
    expect(context.pauses).toBe("take t1\n[4000,4400) cut@4200");
    expect(context.words).toBe("none");
  });

  it("holds the jittery take's premise: its face moves more than 0.05 at every sample", () => {
    const faces = longTake({ ms: 180_000, moves: "jitters" }).analyses.t1?.faces ?? [];
    expect(faces).toHaveLength(900);
    for (let i = 1; i < faces.length; i++) expect(Math.abs((faces[i]?.face?.x ?? 0) - (faces[i - 1]?.face?.x ?? 0))).toBeGreaterThan(0.05);
  });

  it("writes review's own findings in the findings' format: an error whole, a warning up to its fix", () => {
    const [edit, analyses] = [twoShots(), { t1: analysis() }];
    // Its call-out for 300 ms: the review warns that it is too short to read, with what to do.
    const mark = edit.shots[1]?.marks[0];
    if (mark) mark.lenMs = 300;
    const found = review(edit, analyses);
    expect(found.some((finding) => finding.severity === "error")).toBe(true);
    expect(found.some((finding) => finding.severity === "warn")).toBe(true);
    const lines = contextOf(edit, analyses, found).findings.split("\n");
    expect(lines).toHaveLength(found.length);
    for (const [i, line] of lines.entries()) {
      const finding = found[i];
      if (!finding) throw new Error("a line with no finding");
      const head = `${finding.severity} ${finding.code} frame=${finding.where.frame} `;
      if (finding.severity === "error") expect(line).toBe(head + finding.says);
      else {
        expect(line.startsWith(head)).toBe(true);
        expect(finding.says.startsWith(line.slice(head.length))).toBe(true);
        expect(line).not.toMatch(/; (move|make|zoom|use|let) /);
      }
    }
  });

  it("changes nothing it is given", () => {
    const [edit, analyses] = [twoShots(), { t1: analysis() }];
    const [before, analysedBefore] = [structuredClone(edit), structuredClone(analyses)];
    contextOf(edit, analyses, FINDINGS);
    expect(edit).toEqual(before);
    expect(analyses).toEqual(analysedBefore);
  });

  it("keeps a 600-word take under 40,000 characters", () => {
    const { edit, analyses } = longTake({ ms: 173_000, moves: "sways" });
    const context = contextOf(edit, analyses, review(edit, analyses));
    expect(context.words.split("\n").filter((line) => line.startsWith("w"))).toHaveLength(600);
    const size = Object.values(context).reduce((sum, part) => sum + part.length, 0);
    expect(size).toBeLessThan(40_000);
  }, LONG_TAKE_MS);
});

/* ── the room (Task 14) ────────────────────────────────────────────────────────────────────────── */

/**
 * The take whole, one shot, 180 frames: the face at y 0.25 to 0.5 with its mouth at 0.42 to 0.47 (`faces`), the captions at 0.62,
 * under the chin and above the apps' bottom bars.
 */
function roomy(captions: Partial<Edit["captions"]> = {}, items: Edit["items"] = []): Edit {
  return { ...newEdit(take()), captions: { ...DEFAULT_CAPTIONS, look: "pop", y: 0.62, ...captions }, items };
}
const ROOMY: Analyses = { t1: analysis() };
/** A face so close that its upper half, where the eyes are, holds the stage from the apps' top bars to their bottom ones: no text has a place. */
const FILLED: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ...sample, face: box(0, 0.1, 1, 1.4), mouth: null })) }) };
const errorsOf = (edit: Edit) => review(edit, ROOMY).filter((finding) => finding.severity === "error");
/** The ranges a line of room names after `what`: "y=[0.18,0.24] or [0.58,0.60]" as [[0.18, 0.24], [0.58, 0.6]]; none as []. */
function rangesAfter(line: string, what: string): [number, number][] {
  const from = line.indexOf(what);
  if (from < 0) throw new Error(`"${line}" has no "${what}"`);
  const text = line.slice(from + what.length).split(";")[0] ?? "";
  return [...text.matchAll(/\[(\d\.\d\d),(\d\.\d\d)\]/g)].map((match) => [Number(match[1]), Number(match[2])]);
}
const inside = (ranges: [number, number][], y: number) => ranges.some(([from, to]) => y >= from - 1e-9 && y <= to + 1e-9);
/** The room's lines of the stretches a new text is tried over. */
const stretchesIn = (room: string): string[] => room.split("\n").filter((line) => line.startsWith("film="));
type TitleItem = Extract<Edit["items"][number], { part: "title" }>;
const titleItem = (id: string, at: number, frames: number, y: number, text: string = ROOM_PROBE.title): TitleItem => ({
  id, part: "title", anchor: "start", at, frames, props: { text, font: "tiktok", look: "bold", y, size: ROOM_PROBE.size, color: "#ffffff", accent: null },
});
const calloutItem = (id: string, at: number, frames: number, y: number): Edit["items"][number] => ({
  id, part: "callout", anchor: "start", at, frames, props: { text: ROOM_PROBE.line, font: "tiktok", look: "pop", x: 0.5, y, size: ROOM_PROBE.size, color: "#ffffff" },
});

describe("contextOf: the room", () => {
  it("tries a call-out of one line and a title of two, in every typeface", () => {
    const widthIn = (font: FontId) => (text: string, weight: number, size: number, tracking?: number) => measure(text, font, weight, size, tracking) ?? 0;
    for (const font of FONTS) {
      const title = titleBox({ text: ROOM_PROBE.title, font, look: "bold", y: 0.3, size: ROOM_PROBE.size, color: "#ffffff", accent: null }, widthIn(font));
      expect(title.size).toBe(ROOM_PROBE.size);
      expect(title.lines).toHaveLength(2);
      expect(calloutBox({ text: ROOM_PROBE.line, font, look: "pop", x: 0.5, y: 0.3, size: ROOM_PROBE.size, color: "#ffffff" }, widthIn(font)).size).toBe(ROOM_PROBE.size);
    }
  });

  /** The captions' line of an edit's room, read: where they have room as they are, and each larger setting it offers. */
  function captionsRoomOf(edit: Edit, analyses: Analyses) {
    const [line] = contextOf(edit, analyses, []).room.split("\n");
    const [own, ...rest] = (line ?? "").split(". ");
    return {
      line: line ?? "",
      own: rangesAfter(own ?? "", "room at "),
      /** The heights only a title or a call-out is in the way of. */
      freed: rest[0]?.startsWith("Without the ") ? rangesAfter(rest[0], "room at ") : [],
      bigger: [...(rest.at(-1) ?? "").matchAll(/\{[^}]+\}/g)].map((match) => JSON.parse(match[0]) as { size: number; maxWords: number; y: number }),
    };
  }
  /**
   * The captions' line holds: every height it names for them as they are is clear, and no other is; each larger setting is
   * clear as sent, larger than theirs, at a height tried, and 2 px more has no place at its words a page (unless it is the
   * largest looked for, `most`); the largest comes first, and a smaller one only for more words a page. The room is the
   * review's verdict at every height tried and nothing of its own (the final fix wave): the review holds the nose itself.
   */
  function expectCaptionsRoom(edit: Edit, analyses: Analyses, most: number) {
    const had = review(edit, analyses).filter((finding) => finding.severity === "error").length;
    const added = (captions: Partial<Edit["captions"]>) => review({ ...edit, captions: { ...edit.captions, ...captions } }, analyses).filter((finding) => finding.severity === "error").length - had;
    const room = captionsRoomOf(edit, analyses);
    for (const y of ROOM_YS) expect(added({ y }) <= 0, `as they are, y=${y}`).toBe(inside(room.own, y));
    for (const [i, setting] of room.bigger.entries()) {
      expect(setting.size).toBeGreaterThan(edit.captions.size);
      expect(ROOM_YS).toContain(setting.y);
      expect(added(setting), JSON.stringify(setting)).toBeLessThanOrEqual(0);
      if (setting.size < most) for (const y of ROOM_YS) expect(added({ ...setting, y, size: setting.size + 2 }), `${JSON.stringify(setting)} + 2 px at y=${y}`).toBeGreaterThan(0);
      const before = room.bigger[i - 1];
      if (before) expect(setting.size < before.size && setting.maxWords > before.maxWords).toBe(true);
    }
    return room;
  }

  it("names the captions as they are with where they have room, and the larger settings with a place, the largest first: each is clear as sent, and 2 px more is not", () => {
    const edit = roomy();
    expect(errorsOf(edit)).toEqual([]);
    const room = expectCaptionsRoom(edit, ROOMY, 114);
    // Room all round on this take: the largest looked for, 1.6 times their size, to 2 px, at their own three words a page and
    // their own height; fewer words have no more room, so they are not named.
    expect(room.line).toMatch(/^captions now size 72, 3 words a page, y=0\.62; as they are they have room at y=\[0\.\d\d,0\.\d\d\] or \[0\.\d\d,0\.\d\d\]\. Bigger, the largest with a place first: \{"size":114,"maxWords":3,"y":0\.62\}$/);
    // Above the face and under the chin, as they are.
    expect(inside(room.own, 0.18) && inside(room.own, 0.62) && !inside(room.own, 0.3)).toBe(true);
  });

  it("finds a largest size under the one looked for where the face leaves a narrow band, larger with fewer words a page, at the height nearest their own", () => {
    // The face from 0.2 to 0.77 with its mouth from 0.62 to 0.72: under the lip, a sliver before the apps' bottom bars.
    const tight: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ...sample, face: box(0.25, 0.2, 0.5, 0.57), mouth: box(0.4, 0.62, 0.2, 0.1) })) }) };
    const edit = roomy({ y: 0.76 });
    expect(review(edit, tight).filter((finding) => finding.severity === "error")).toEqual([]);
    // Between the eyes and the mouth the review itself refuses them now (it only warned: the room kept a band of its own).
    const onNose = review({ ...edit, captions: { ...edit.captions, size: 114, y: 0.56 } }, tight);
    expect(onNose.filter((finding) => finding.severity === "error").map((finding) => finding.says)).toContain("the captions at 0.3 s cover the nose; move them up or down");
    const room = expectCaptionsRoom(edit, tight, 114);
    expect(inside(room.own, 0.56)).toBe(false);
    expect(room.bigger.length).toBeGreaterThan(0);
    expect(room.bigger[0]?.size).toBeLessThan(114);
    expect(room.bigger[0]?.y).toBe(0.76);
  });

  it("gives the captions no place where they would cover a title, and does not count an error another text already has", () => {
    // A line held for the whole film under the captions: at its height the captions would cover it (the review tells it of the title).
    const held = roomy({}, [titleItem("held", 0, 180, 0.72, "Back at it")]);
    expect(errorsOf(held)).toEqual([]);
    expect(inside(captionsRoomOf(roomy(), ROOMY).own, 0.72)).toBe(true);
    const room = expectCaptionsRoom(held, ROOMY, 114);
    expect(inside(room.own, 0.72)).toBe(false);
    // And said so: without the title they would have room there too (Task 14, fix round 1).
    expect(room.line).toMatch(/\. Without the title they would also have room at y=\[/);
    expect(inside(room.freed, 0.72)).toBe(true);
    expect(captionsRoomOf(roomy(), ROOMY).line).not.toContain("Without the");
    expect(captionsRoomOf(roomy({}, [calloutItem("c2", 0, 180, 0.72)]), ROOMY).line).toContain("Without the call-out they would also have room at");
    // A call-out on the mouth is an error of its own: the captions still have their room, as without it.
    const onMouth = roomy({}, [calloutItem("c9", 0, 60, 0.44)]);
    expect(errorsOf(onMouth).map((finding) => [finding.code, finding.where.item])).toEqual([["on-face", "c9"]]);
    expect(expectCaptionsRoom(onMouth, ROOMY, 114).bigger[0]).toEqual({ size: 114, maxWords: 3, y: 0.62 });
  });

  it("says when the captions have no room at any height, when no larger size has a place, and that captions are off", () => {
    // Captions turned on over a face that fills the stage, where none stood: no height is clear, at any size.
    const turnedOn = roomy();
    const [onFace] = review(turnedOn, FILLED).filter((finding) => finding.severity === "error");
    if (!onFace) throw new Error("the captions were not refused");
    expect(roomFor(turnedOn, FILLED, onFace, roomy({ on: false }))).toBe("Room for the captions as these ops set them: size 72, 3 words a page, y=0.62; as they are they have room at no height. No size has a place.");
    // Where they stood on that face already, on every frame, the room is where the one rule finds it no worse (X118 counts the
    // frames covered): the review's verdict and nothing of the room's own, so it names what the loop takes.
    const filled = contextOf(turnedOn, FILLED, []).room.split("\n")[0] ?? "";
    expect(filled).toMatch(/^captions now size 72, 3 words a page, y=0\.62; as they are they have room at y=\[0\.\d+,0\.\d+\]\. They cover a face or sit under an app's bar on 69 frames of the film as it came, which a change may not make worse: the heights named are where it gets no worse, and it is least at y=0\.62 \(69 frames\)\./);
    const named = rangesAfter(filled.split(". ")[0] ?? "", "room at ");
    for (const y of ROOM_YS) expect(inside(named, y), `y=${y}`).toBe(!captionsWorse(turnedOn, roomy({ y }), FILLED));
    // The largest the schema takes already: nothing larger is looked for.
    expect(contextOf(roomy({ size: 200, maxWords: 1, y: 0.62 }), { t1: analysis({ faces: [] }) }, []).room.split("\n")[0]).toMatch(/^captions now size 200, 1 word a page, y=0\.62; as they are they have room at y=\[.*\]\. No larger size has a place\.$/);
    expect(contextOf(roomy({ on: false }), ROOMY, []).room.split("\n")[0]).toBe("captions off");
  });

  it("gives each stretch of the film its shot, its words, and where one line and two lines are clear: inside a range the review finds nothing on the text, outside it does", () => {
    const edit = roomy();
    const room = contextOf(edit, ROOMY, []).room;
    expect(room.split("\n")).toContain("new text, one line (a call-out) and two lines (a title), each at size 130, centred:");
    const stretches = stretchesIn(room);
    // 180 frames, the face 0.1 further right from 4 s: three stretches of two seconds; the first two say the same and are one line.
    expect(stretches.map((line) => line.split(":")[0])).toEqual(["film=[0,120)f shot s1 w0-w5", "film=[120,180)f shot s1"]);
    for (const line of stretches) {
      const [, from, to] = /film=\[(\d+),(\d+)\)f/.exec(line)?.map(Number) ?? [];
      if (from === undefined || to === undefined) throw new Error(`no frames in "${line}"`);
      // One line has a place above the face and under the chin in every stretch.
      expect(rangesAfter(line, "one line ").length).toBeGreaterThanOrEqual(2);
      for (const [what, item] of [["one line ", calloutItem], ["two lines ", titleItem]] as const) {
        const ranges = rangesAfter(line, what);
        for (const y of ROOM_YS) {
          const found = review({ ...edit, items: [item("x", from, to - from, y)] }, ROOMY).filter((finding) => finding.where.item === "x" && (finding.severity === "error" || finding.code === "on-face"));
          expect(found.length === 0).toBe(inside(ranges, y));
        }
      }
    }
  });

  it("keeps a new text off the whole face, where the review only warns: no place on the chin", () => {
    // A line just under the mouth lies on the chin: the review warns ("touches the chin") and lets it pass; the room has no place there.
    const edit = roomy();
    const onChin = ROOM_YS.filter((y) => {
      const found = review({ ...edit, items: [calloutItem("x", 0, 60, y)] }, ROOMY).filter((finding) => finding.where.item === "x");
      return found.length === 1 && found[0]?.code === "on-face" && found[0].severity === "warn";
    });
    expect(onChin.length).toBeGreaterThan(0);
    const ranges = rangesAfter(stretchesIn(contextOf(edit, ROOMY, []).room)[0] ?? "", "one line ");
    for (const y of onChin) expect(inside(ranges, y)).toBe(false);
  });

  it("starts a stretch where a title or a call-out starts and ends: no place for a second title while one shows, nor for a line where it is", () => {
    const hook = titleItem("hook", 0, 45, 0.2, "Back at it");
    const edit = roomy({}, [hook]);
    expect(errorsOf(edit)).toEqual([]);
    const stretches = stretchesIn(contextOf(edit, ROOMY, []).room);
    expect(stretches[0]?.split(":")[0]).toBe("film=[0,45)f shot s1 w0-w1");
    expect(stretches[1]).toMatch(/^film=\[45,\d+\)f shot s1 w2-w\d:/);
    expect(stretches[0]).toContain("two lines none");
    // While the hook shows, one line has no place at its height; once it is gone, it has.
    expect(inside(rangesAfter(stretches[0] ?? "", "one line "), 0.2)).toBe(false);
    expect(inside(rangesAfter(stretches[1] ?? "", "one line "), 0.2)).toBe(true);
  });

  it("has no place for a second title while one shows, where two lines would otherwise fit", () => {
    // From 4 s the face is further right and two lines fit under it; with a hook on from frame 120 to 165 they have no place then.
    const stretchAt = (edit: Edit, from: number) => stretchesIn(contextOf(edit, ROOMY, []).room).find((line) => line.startsWith(`film=[${from},`)) ?? "";
    expect(rangesAfter(stretchAt(roomy(), 120), "two lines ").length).toBeGreaterThan(0);
    const edit = roomy({}, [titleItem("hook", 120, 45, 0.2, "Back at it")]);
    expect(errorsOf(edit)).toEqual([]);
    expect(stretchAt(edit, 120)).toMatch(/^film=\[120,165\)f shot s1: one line .*; two lines none$/);
    expect(rangesAfter(stretchAt(edit, 165), "two lines ").length).toBeGreaterThan(0);
  });

  it("runs a stretch over the shots it shows, naming the first and the last, and their words when they show one take", () => {
    // Three shots of the take, cut in its pauses; the face holds still for the first four seconds.
    const edit = through(roomy(), [{ op: "shot.split", id: "s1", atMs: 1200, newId: "s2" }, { op: "shot.split", id: "s2", atMs: 2700, newId: "s3" }]);
    const stretches = stretchesIn(contextOf(edit, ROOMY, []).room);
    expect(stretches.map((line) => line.split(":")[0])).toEqual(["film=[0,120)f shot s1..s3 w0-w5", "film=[120,180)f shot s3"]);
  });

  it("stays within its budget on a three-minute take cut into 60 shots, with longer stretches, and never changes the edit", () => {
    const { edit, analyses } = longTake({ ms: 180_000, moves: "sweeps" });
    const cut = cutInto(edit, 60, false);
    const before = structuredClone(cut);
    const room = contextOf(cut, analyses, []).room;
    expect(room.length).toBeLessThanOrEqual(ROOM_BUDGET);
    expect(cut).toEqual(before);
    // Every line's stretch is inside the film, in order, and the last one ends with it: nothing was cut off.
    const frames = stretchesIn(room).map((line) => /film=\[(\d+),(\d+)\)f/.exec(line)?.slice(1).map(Number) ?? []);
    // Sixty shots are too many to frame one by one: one line says so.
    expect(room.split("\n")).toContain("zoom: 60 shots; shot.zoom frames the one it is asked for, or says why it cannot");
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)?.[1]).toBe(layout(cut).frames);
    for (const [from, to] of frames) expect((to ?? 0) - (from ?? 0)).toBeGreaterThan(0);
    expect(room).not.toContain("trimmed");
    expect(ROOM_STRETCH).toBe(60);
  }, LONG_TAKE_MS);

  it("is worked out only when it is read, once", () => {
    const context = contextOf(roomy(), ROOMY, []);
    expect(Object.getOwnPropertyDescriptor(context, "room")?.get).toBeTypeOf("function");
    expect(context.room).toBe(context.room);
    expect(Object.keys(context)).toEqual(["edit", "files", "words", "pauses", "faces", "room", "findings"]);
  });
});

describe("contextOf: the room for a cut and a zoom (Task 14, fix rounds 1 and 2)", () => {
  const lineOf = (room: string, start: string) => room.split("\n").find((line) => line.startsWith(start)) ?? "";
  /** A face close to the lens, from 0.3 to 0.7 of the height, its mouth from 0.61 to 0.69. */
  const CLOSE: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ms: sample.ms, face: box(0.2, 0.3, 0.6, 0.4), mouth: box(0.4, 0.61, 0.2, 0.08) })) }) };

  it("says how much pause the cuts keep, by their middle one, and when no cut lies in a pause", () => {
    expect(lineOf(contextOf(roomy(), ROOMY, []).room, "pauses:")).toBe("pauses: no cut in a pause");
    // Cut in both pauses ([900,1500) and [2300,3100)): 100 + 200 ms kept at the first cut, 300 + 100 at the second.
    const cut = through(roomy(), [
      { op: "shot.split", id: "s1", atMs: 1200, newId: "s2" }, { op: "shot.trim", id: "s1", endMs: 1000 }, { op: "shot.trim", id: "s2", startMs: 1300 },
      { op: "shot.split", id: "s2", atMs: 2700, newId: "s3" }, { op: "shot.trim", id: "s2", endMs: 2600 }, { op: "shot.trim", id: "s3", startMs: 3000 },
    ]);
    expect(lineOf(contextOf(cut, ROOMY, []).room, "pauses:")).toBe("pauses: the cuts keep about 400 ms of pause each");
    expect(lineOf(contextOf(through(cut, [{ op: "shot.trim", id: "s3", startMs: 3050 }]), ROOMY, []).room, "pauses:")).toBe("pauses: the cuts keep about 350 ms of pause each");
  });

  /** What the zoom's line says of a shot: how tight it may go, or that it may go no further. */
  const zoomOf = (edit: Edit, analyses: Analyses, id: string): string => {
    const line = lineOf(contextOf(edit, analyses, []).room, "zoom: shot.zoom may take ");
    return line.slice("zoom: shot.zoom may take ".length).split("; ").find((each) => each.startsWith(`${id} `)) ?? "";
  };
  const framedBy = (edit: Edit, id: string, framing: Edit["shots"][number]["framing"]): Edit => ({ ...edit, shots: edit.shots.map((shot) => (shot.id === id ? { ...shot, framing } : shot)) });

  it("zooms a shot to 1.3 with no text in the way, holding the mouth's bottom and the face's middle where they are", () => {
    // No captions, no title: nothing to keep clear. The face's middle is the stage's (x 0); its mouth ends at 0.47 of the height.
    const edit = roomy({ on: false });
    const still: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ms: sample.ms, face: box(0.25, 0.25, 0.5, 0.25), mouth: box(0.4, 0.42, 0.2, 0.05) })) }) };
    expect(ZOOM).toEqual({ most: 1.3, least: 1.08, step: 0.05 });
    expect(zoomFor(edit, still, "s1", 1.3, false)).toEqual({ framing: { from: { zoom: 1.3, x: 0, y: -0.06 }, move: null } });
    // Asked for less, it gets less; slow, it is a move over the whole shot from zoom 1 at the same pan, so the line stays held.
    expect(zoomFor(edit, still, "s1", 1.15, false)).toEqual({ framing: { from: { zoom: 1.15, x: 0, y: -0.06 }, move: null } });
    expect(zoomFor(edit, still, "s1", 1.3, true)).toEqual({ framing: { from: { zoom: 1, x: 0, y: -0.06 }, move: { to: { zoom: 1.3, x: 0, y: -0.06 }, ease: "linear", part: [0, 1] } } });
    expect(lineOf(contextOf(edit, still, []).room, "zoom:")).toBe("zoom: shot.zoom may take s1 to 1.3");
  });

  it("gives a framing only when it adds no error on any frame, and says in the room how tight each shot may go, with what it is now", () => {
    const edit = through(roomy(), [{ op: "shot.split", id: "s1", atMs: 2700, newId: "s2" }, { op: "shot.set", id: "s2", framing: { from: { zoom: 1.1, x: 0, y: 0 }, move: null } }]);
    const had = errorsOf(edit).length;
    expect(lineOf(contextOf(edit, ROOMY, []).room, "zoom:")).toMatch(/^zoom: shot\.zoom may take s1 to 1\.\d+; s2 \(now 1\.1\) to 1\.\d+$/);
    for (const id of ["s1", "s2"]) {
      for (const slow of [false, true]) {
        const found = zoomFor(edit, ROOMY, id, 1.3, slow);
        if (!("framing" in found)) throw new Error(`shot ${id} has no zoom: ${found.none}`);
        const to = found.framing.move?.to ?? found.framing.from;
        expect(to.zoom).toBeGreaterThan(id === "s2" ? 1.1 : 1);
        expect(to.zoom).toBeLessThanOrEqual(1.3);
        expect(errorsOf(framedBy(edit, id, found.framing)).length).toBe(had);
        // A slow zoom starts from the shot's own framing: its own when it is tighter than 1 already.
        if (slow && id === "s2") expect(found.framing.from).toEqual({ zoom: 1.1, x: 0, y: 0 });
        if (!slow) expect(zoomOf(edit, ROOMY, id)).toBe(`${id}${id === "s2" ? " (now 1.1)" : ""} to ${to.zoom}`);
      }
    }
  });

  it("says no further where a title is in the way, why when it is asked, and nothing of a shot that moves already", () => {
    // The face from 0.3 to 0.7, its mouth to 0.69: the captions just under it, a title just over it. Any zoom brings one of them onto the face.
    const tight = roomy({ y: 0.71 }, [titleItem("hook", 0, 180, 0.26, "Back at it")]);
    expect(review(tight, CLOSE).filter((finding) => finding.severity === "error")).toEqual([]);
    expect(zoomOf(tight, CLOSE, "s1")).toBe("s1 no further (a title or a call-out is in the way)");
    expect(zoomFor(tight, CLOSE, "s1", 1.3, false)).toEqual({ none: 'shot "s1" has no room to zoom in: a title or a call-out shows over it, and the face would run into it' });
    // Without the title a tighter framing fits: the face's top may rise.
    const free = zoomFor(roomy({ y: 0.71 }), CLOSE, "s1", 1.3, false);
    if (!("framing" in free)) throw new Error("no zoom without the title");
    expect(free.framing.from.zoom).toBeGreaterThanOrEqual(1.08);
    expect(review(framedBy(roomy({ y: 0.71 }), "s1", free.framing), CLOSE).filter((finding) => finding.severity === "error")).toEqual([]);
    // With no face found there is nothing to hold.
    expect(zoomOf(tight, { t1: analysis({ faces: [] }) }, "s1")).toBe("s1 no further");
    expect(zoomFor(tight, { t1: analysis({ faces: [] }) }, "s1", 1.3, false)).toEqual({ none: 'shot "s1" shows no face to hold while it zooms' });
    // Nor is a file too small to enlarge given another reason, nor a picture.
    const small = { ...tight, assets: tight.assets.map((asset) => (asset.kind === "video" ? { ...asset, w: 540, h: 960 } : asset)) };
    expect(zoomFor(small, CLOSE, "s1", 1.3, false)).toEqual({ none: 'shot "s1" cannot be enlarged further: its file is too small' });
    // A piece split off in speech: framed apart from its neighbour its start would be a cut, and that lies in no pause.
    const inSpeech = through(roomy(), [{ op: "shot.split", id: "s1", atMs: 1700, newId: "s2" }]);
    expect(zoomFor(inSpeech, ROOMY, "s2", 1.3, false)).toEqual({ none: 'shot "s2" has no room to zoom in: it starts or ends in speech, where a framing may not change: give shot.zoom the "word" to start at and let it split the shot in the pause before, or zoom a shot that starts and ends in pauses' });
    // The pause before a word: the last cut@ inside the shot at or before the word's start; none before the shot's first words.
    expect(pauseBefore(roomy(), ROOMY, "s1", 3)).toBe(1200); // "this" at 1700: the pause [900,1500)
    expect(pauseBefore(roomy(), ROOMY, "s1", 4)).toBe(2700); // "works" at 3200: the pause [2300,3100)
    expect(pauseBefore(roomy(), ROOMY, "s1", 0)).toBeNull();
    // A pause's cut under half a second into the shot is no place to split: the shot starts there as good as.
    expect(pauseBefore(through(roomy(), [{ op: "shot.trim", id: "s1", startMs: 1000 }]), ROOMY, "s1", 3)).toBeNull();
    expect(pauseBefore(roomy(), ROOMY, "s1", 99)).toBeNull();
    expect(pauseBefore(inSpeech, ROOMY, "s1", 4)).toBeNull(); // "works" is not said in s1 any more
    const moving = through(roomy(), [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "linear", part: [0, 1] } } }]);
    expect(lineOf(contextOf(moving, ROOMY, []).room, "zoom:")).toBe("");
    expect(zoomFor(moving, ROOMY, "s1", 1.3, false)).toEqual({ none: 'shot "s1" moves already: set its framing plain first, or leave it' });
    expect(zoomFor(roomy(), ROOMY, "nothing", 1.3, false)).toEqual({ none: 'there is no shot "nothing"' });
  });

  it("with a push (slice B, Task 3): moves from the framing given to the same tighter one, eased out over the part given, then holds", () => {
    const edit = roomy({ on: false });
    const still: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ms: sample.ms, face: box(0.25, 0.25, 0.5, 0.25), mouth: box(0.4, 0.42, 0.2, 0.05) })) }) };
    const from = { zoom: 1, x: 0, y: 0 };
    // The same search and the same held line as the punch-in, as a move from `from`: the still one's target, reached at 1/2 of the shot.
    expect(zoomFor(edit, still, "s1", 1.3, false, { from, part: 2 })).toEqual({ framing: { from, move: { to: { zoom: 1.3, x: 0, y: -0.06 }, ease: "out", part: [0, 2] } } });
    expect(zoomFor(edit, still, "s1", 1.15, false, { from, part: 2 })).toEqual({ framing: { from, move: { to: { zoom: 1.15, x: 0, y: -0.06 }, ease: "out", part: [0, 2] } } });
    // `slow` is the part the caller gives: a push over the whole shot is part [0, 1], eased out all the same.
    expect(zoomFor(edit, still, "s1", 1.3, true, { from, part: 1 })).toEqual({ framing: { from, move: { to: { zoom: 1.3, x: 0, y: -0.06 }, ease: "out", part: [0, 1] } } });
  });

  it("with a push: a piece split off in speech has room, since nothing jumps at its start; it adds no error", () => {
    const inSpeech = through(roomy(), [{ op: "shot.split", id: "s1", atMs: 1700, newId: "s2" }]);
    expect(zoomFor(inSpeech, ROOMY, "s2", 1.3, false)).toMatchObject({ none: expect.stringContaining("it starts or ends in speech") });
    const pushed = zoomFor(inSpeech, ROOMY, "s2", 1.3, false, { from: { zoom: 1, x: 0, y: 0 }, part: (6000 - 1700) / 400 });
    if (!("framing" in pushed)) throw new Error(`no push: ${pushed.none}`);
    expect(pushed.framing).toMatchObject({ from: { zoom: 1, x: 0, y: 0 }, move: { ease: "out", part: [0, (6000 - 1700) / 400] } });
    expect(pushed.framing.move?.to.zoom).toBeGreaterThanOrEqual(ZOOM.least);
    expect(errorsOf(framedBy(inSpeech, "s2", pushed.framing))).toEqual(errorsOf(inSpeech));
    // The piece before it ends in speech, on footage that runs on as it is: a push held to its end would jump there, a cut in
    // speech. Said so, not blamed on the captions.
    expect(zoomFor(inSpeech, ROOMY, "s1", 1.3, false, { from: { zoom: 1, x: 0, y: 0 }, part: 1700 / 400 })).toEqual({ none: 'shot "s1" has no room to zoom in: it ends in speech, where a framing held to its end would make a cut' });
  });

  it("with a push: from a framing tighter than the footage's own, the search starts above it; a push may be made again, any other move may not", () => {
    const inSpeech = through(roomy(), [{ op: "shot.split", id: "s1", atMs: 1700, newId: "s2" }]);
    const part = (6000 - 1700) / 400;
    // The whole take framed at 1.2: a push from there has only 1.25 and 1.3 above it; from 1.3 there is nothing tighter, and it
    // says so by the push's own zoom.
    const at12 = { from: { zoom: 1.2, x: 0, y: 0 }, move: null };
    const close = framedBy(framedBy(inSpeech, "s1", at12), "s2", at12);
    const tight = zoomFor(close, ROOMY, "s2", 1.3, false, { from: at12.from, part });
    if (!("framing" in tight)) throw new Error(`no push from 1.2: ${tight.none}`);
    expect(tight.framing.from).toEqual(at12.from);
    expect(tight.framing.move?.to.zoom).toBeGreaterThanOrEqual(1.25);
    expect(zoomFor(inSpeech, ROOMY, "s2", 1.3, false, { from: { zoom: 1.3, x: 0, y: 0 }, part })).toEqual({ none: 'shot "s2" is at 1.3 already: a zoom there asks for more than that, up to 1.3' });
    // A shot pushed already is pushed again, to less: the push replaces its own.
    const once = zoomFor(inSpeech, ROOMY, "s2", 1.3, false, { from: { zoom: 1, x: 0, y: 0 }, part });
    if (!("framing" in once)) throw new Error(`no push: ${once.none}`);
    const again = zoomFor(framedBy(inSpeech, "s2", once.framing), ROOMY, "s2", 1.1, false, { from: once.framing.from, part });
    expect(again).toMatchObject({ framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.1 }, ease: "out", part: [0, part] } } });
    // A slow zoom (a linear move) is no push: it moves already.
    const slow = zoomFor(roomy(), ROOMY, "s1", 1.3, true);
    if (!("framing" in slow)) throw new Error(`no slow zoom: ${slow.none}`);
    expect(zoomFor(framedBy(roomy(), "s1", slow.framing), ROOMY, "s1", 1.2, false, { from: { zoom: 1, x: 0, y: 0 }, part: 1 })).toEqual({ none: 'shot "s1" moves already: set its framing plain first, or leave it' });
  });

  it("with a push: texts over and under the face refuse it as they refuse the punch-in; captions just under the mouth refuse it by themselves", () => {
    const push = { from: { zoom: 1, x: 0, y: 0 }, part: 2 };
    // With the captions off, a title just over the face and a call-out just under it: every tighter framing brings one onto it.
    const boxed = roomy({ on: false }, [titleItem("hook", 0, 180, 0.26, "Back at it"), calloutItem("c", 0, 180, 0.74)]);
    expect(review(boxed, CLOSE).filter((finding) => finding.severity === "error")).toEqual([]);
    const blocked = { none: 'shot "s1" has no room to zoom in: a title or a call-out shows over it, and the face would run into it' };
    expect(zoomFor(boxed, CLOSE, "s1", 1.3, false)).toEqual(blocked);
    expect(zoomFor(boxed, CLOSE, "s1", 1.3, false, push)).toEqual(blocked);
    // The captions 0.02 under the mouth: the punch-in holds the mouth's bottom where it is; a push from zoom 1 gets there over 400
    // ms, and on the way the mouth dips into them, title or none. So it is the captions, and it says so.
    const captions = { none: 'shot "s1" has no room to zoom in: at every tighter framing its face would run into the captions' };
    expect(zoomFor(roomy({ y: 0.71 }), CLOSE, "s1", 1.3, false, push)).toEqual(captions);
    expect(zoomFor(roomy({ y: 0.71 }, [titleItem("hook", 0, 180, 0.26, "Back at it")]), CLOSE, "s1", 1.3, false, push)).toEqual(captions);
  });

  it("roomFor: answers a cut outside a pause with the clean cuts on either side of it and how far each is, and what the film's own start may do", () => {
    // The second shot starts on "this" (1700 ms), in speech: the pauses' cuts are at 1200 and 2700.
    const cut = through(roomy(), [{ op: "shot.split", id: "s1", atMs: 1200, newId: "s2" }, { op: "shot.trim", id: "s2", startMs: 1700 }]);
    const [finding] = review(cut, ROOMY).filter((each) => each.code === "cut-outside-pause");
    expect(finding?.says).toContain('shot "s2" starts at 1700 ms of its take');
    if (!finding) throw new Error("the cut was not refused");
    // Judged by the edit as it stood (one shot over the whole take): both cuts are in what the film shows, and one is half a second off.
    expect(roomFor(cut, ROOMY, finding, roomy())).toBe("The clean cuts of its take nearest 1700 ms, in what the film shows: 1200 ms (500 ms earlier, after w1 \"there\") and 2700 ms (1000 ms later, after w3 \"this\").");
    // The film's start, cut into its first words: the first word is within half a second, so the film may start up to it.
    const late = through(roomy(), [{ op: "shot.trim", id: "s1", startMs: 600 }]);
    const [start] = review(late, ROOMY).filter((each) => each.code === "cut-outside-pause");
    if (!start) throw new Error("the start was not refused");
    expect(roomFor(late, ROOMY, start, roomy())).toBe("The clean cuts of its take nearest 600 ms, in what the film shows: 1200 ms (600 ms later, after w1 \"there\"). The film may also start anywhere up to its first word, at 300 ms.");
    // A cut asked more than one second from any clean one cannot be made: said outright, with what to send (one place for the rule: `CUT_NEAR_MS`).
    expect(CUT_NEAR_MS).toBe(1000);
    const mid = through(roomy(), [{ op: "shot.trim", id: "s1", startMs: 3900 }]);
    const [far] = review(mid, ROOMY).filter((each) => each.code === "cut-outside-pause");
    if (!far) throw new Error("the cut was not refused");
    expect(roomFor(mid, ROOMY, far, roomy())).toBe('The clean cuts of its take nearest 3900 ms, in what the film shows: 2700 ms (1200 ms earlier, after w3 "this"). None lies within one second of 3900 ms: this cut cannot be made cleanly. Send "ops": [] and say so, with where the nearest clean cut is in the creator\'s own words (after which of their words or sentences), not in seconds.');
    // Within a second, the cut is the one asked: nothing more is said.
    const near = through(roomy(), [{ op: "shot.trim", id: "s1", startMs: 1900 }]);
    const [close] = review(near, ROOMY).filter((each) => each.code === "cut-outside-pause");
    if (!close) throw new Error("the cut was not refused");
    expect(roomFor(near, ROOMY, close, roomy())).toBe('The clean cuts of its take nearest 1900 ms, in what the film shows: 1200 ms (700 ms earlier, after w1 "there") and 2700 ms (800 ms later, after w3 "this").');
    // A cut outside what the film shows now is no cut: it would bring footage in. A film that starts at 2 s has none earlier.
    const shown = through(roomy(), [{ op: "shot.trim", id: "s1", startMs: 2700 }]);
    const earlier = through(shown, [{ op: "shot.trim", id: "s1", startMs: 3300 }]);
    const [inWord] = review(earlier, ROOMY).filter((each) => each.code === "cut-outside-pause");
    if (!inWord) throw new Error("the cut was not refused");
    expect(roomFor(earlier, ROOMY, inWord, shown)).toBe('Its take has no clean cut near 3300 ms in what the film shows. None lies within one second of 3300 ms: this cut cannot be made cleanly. Send "ops": [] and say so, with where the nearest clean cut is in the creator\'s own words (after which of their words or sentences), not in seconds.');
  });
});

describe("captionsFit: captions with no room as an answer set them (Task 14, fix round 2)", () => {
  /** The face from 0.2 to 0.77 with its mouth to 0.72: a sliver under the lip. */
  const TIGHT: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ...sample, face: box(0.25, 0.2, 0.5, 0.57), mouth: box(0.4, 0.62, 0.2, 0.1) })) }) };

  it("gives the largest setting that has a place, which the review passes, when they have room at no height as set", () => {
    const before = roomy({ y: 0.76 });
    const refused = roomy({ y: 0.76, look: "pill", size: 110 });
    const fit = captionsFit(refused, TIGHT, before);
    if (!fit) throw new Error("no setting fits");
    expect(Object.keys(fit).sort()).toEqual(["maxWords", "size", "y"]);
    expect(fit.size).toBeLessThan(110);
    expect(review({ ...refused, captions: { ...refused.captions, ...fit } }, TIGHT).filter((finding) => finding.severity === "error")).toEqual([]);
  });

  /** The larger settings an edit's room offers its captions, the largest first. */
  const offered = (edit: Edit, analyses: Analyses) => [...(contextOf(edit, analyses, []).room.split("\n")[0] ?? "").matchAll(/\{[^}]+\}/g)].map((match) => JSON.parse(match[0]) as { size: number; maxWords: number; y: number });

  it("never grows past what the answer asked: 120 px where the room offered 114 at three words is 114 at three words, not more at fewer (the final review)", () => {
    // The reviewer's case: ten words, a face from 0.3 to 0.7 with its mouth at 0.6, captions on a pill at 72 px at the top.
    const words = ["One", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"].map((text, i) => ({ text, startMs: 200 + i * 560, endMs: 200 + i * 560 + 450 }));
    const analyses: Analyses = { t1: analysis({ pauses: [], faces: Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face: box(0.2, 0.3, 0.6, 0.4), mouth: box(0.4, 0.6, 0.2, 0.05) })) }) };
    const base: Edit = { ...newEdit(take({ words })), captions: { ...DEFAULT_CAPTIONS, look: "pill", size: 72, y: 0.2, maxWords: 3 } };
    expect(offered(base, analyses)[0]).toMatchObject({ size: 114, maxWords: 3 });
    for (const size of [120, 150]) {
      const asked: Edit = { ...base, captions: { ...base.captions, size } };
      const fit = captionsFit(asked, analyses, base);
      if (!fit) throw new Error(`no fit for ${size}`);
      // Their own count of words and the room's own largest size for it: it came back as 192 px and 200 px at one word a page.
      expect(fit).toMatchObject({ size: 114, maxWords: 3 });
      expect(review({ ...asked, captions: { ...asked.captions, ...fit } }, analyses).filter((finding) => finding.severity === "error")).toEqual([]);
    }
  });

  /** A take of longer words, sixteen in 6 s, its face the same on every frame: `under`, captions under it at 0.76. */
  const wordy = ["so", "today", "I", "want", "to", "show", "you", "something", "about", "editing", "that", "creators", "really", "never", "talk", "about"].map((text, i) => ({ text, startMs: 200 + i * 350, endMs: 450 + i * 350 }));
  const seen = (face: ShareBox, mouth: ShareBox): Analyses => ({ t1: analysis({ pauses: [], faces: Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face, mouth })) }) });
  const under = (captions: Partial<Edit["captions"]> = {}): Edit => ({ ...newEdit(take({ words: wordy })), captions: { ...DEFAULT_CAPTIONS, look: "pop", size: 72, y: 0.76, maxWords: 3, ...captions } });

  it("takes its ceiling from the room of the edit as it stood: the same answer of 200 px is fitted at what the room offered each edit", () => {
    // Room all round: the room's largest is as far as it looks, 1.6 times their size, at their three words a page.
    const open = seen(box(0.25, 0.25, 0.5, 0.25), box(0.4, 0.42, 0.2, 0.05));
    const fitted = [72, 82].map((size) => {
      const before = under({ size });
      const [most] = offered(before, open);
      expect(most).toMatchObject({ size: 2 * Math.floor((size * 1.6) / 2), maxWords: 3 });
      const fit = captionsFit(under({ size: 200 }), open, before);
      expect(fit).toMatchObject({ size: most?.size, maxWords: 3 });
      return fit?.size;
    });
    expect(fitted).toEqual([114, 130]);
  });

  it("goes to fewer words a page only when the answer's count cannot be larger than they stood, and then to the most words that can, never above what was asked", () => {
    // A face from 0.2 to 0.77 with its lip at 0.72: under it three words a page have a largest size, and only two are larger.
    const tight = seen(box(0.25, 0.2, 0.5, 0.57), box(0.4, 0.62, 0.2, 0.1));
    const three = offered(under(), tight).find((setting) => setting.maxWords === 3);
    if (!three) throw new Error("the room offers three words a page no larger size");
    const before = under({ size: three.size });
    expect(review(before, tight).filter((finding) => finding.severity === "error")).toEqual([]);
    const [two, ...rest] = offered(before, tight);
    if (!two) throw new Error("the room offers no larger setting");
    expect(two.maxWords).toBe(2);
    expect(rest).toEqual([]);
    expect(two.size - three.size).toBeGreaterThan(4);
    // An answer a little larger, at three words a page: two words a page at the size asked, not at the room's largest.
    expect(captionsFit(under({ size: three.size + 4 }), tight, before)).toMatchObject({ size: three.size + 4, maxWords: 2 });
    // An answer far larger: the room's own largest at two words a page, not one word a page at more.
    expect(captionsFit(under({ size: 200 }), tight, before)).toMatchObject({ size: two.size, maxWords: 2 });
    // An answer that sets them larger where three words a page can be: three words a page, the room's largest.
    expect(captionsFit(under({ size: 200 }), tight, under())).toMatchObject({ size: three.size, maxWords: 3 });
    // An answer that only sets a look on a box keeps its three words a page, smaller.
    const pill = captionsFit(under({ size: three.size, look: "pill" }), tight, before);
    expect(pill?.maxWords).toBe(3);
    expect(pill?.size).toBeLessThan(three.size);
  });

  it("gives none when they have room as set at some height (where is the model's to say), and none when no size has any", () => {
    expect(captionsFit(roomy({ y: 0.4 }), ROOMY, roomy())).toBeNull();
    expect(captionsFit(roomy({ look: "pill", size: 110 }), FILLED, roomy())).toBeNull();
  });

  it("counts a title the new captions would cover as the captions' doing, by the edit as it stood", () => {
    // A line held over the whole film at 0.72: larger captions at 0.62 would cover it. The review tells that of the line.
    const before = roomy({}, [titleItem("held", 0, 180, 0.72, "Back at it")]);
    const refused = { ...before, captions: { ...before.captions, size: 200 } };
    expect(review(refused, ROOMY).filter((finding) => finding.severity === "error").map((finding) => [finding.code, finding.where.item])).toEqual([["on-text", "held"]]);
    // Judged by the answer's own edit the line's error would be an old one, and the captions would seem to have room where they are.
    const roomAt = (hint: string) => rangesAfter(hint.split(". ")[0] ?? "", "room at ");
    expect(inside(roomAt(captionsHint(refused, ROOMY, refused)), 0.62)).toBe(true);
    const hint = captionsHint(refused, ROOMY, before);
    expect(hint).toMatch(/^Room for the captions as these ops set them: size 200, 3 words a page, y=0\.62; as they are they have room at y=\[/);
    expect(inside(roomAt(hint), 0.62)).toBe(false);
    for (const y of ROOM_YS.filter((each) => inside(roomAt(hint), each))) expect(review({ ...refused, captions: { ...refused.captions, y } }, ROOMY).filter((finding) => finding.severity === "error")).toEqual([]);
    // They have room as set at another height: where is the model's to say, so the code places nothing.
    expect(captionsFit(refused, ROOMY, before)).toBeNull();
  });
});

describe("the captions' one rule: what the room offers is what the loop accepts (Task 14b)", () => {
  /** The take ends in a close-up: from 3 s, while "works" is said, the face fills the frame, its mouth at 0.6 to 0.65, where the captions sit. */
  const CLOSING: Analyses = { t1: analysis({ faces: faces().map((sample) => (sample.ms < 3000 ? sample : { ms: sample.ms, face: box(0.1, 0.3, 0.8, 0.6), mouth: box(0.4, 0.6, 0.2, 0.05) })) }) };
  const captionErrors = (edit: Edit) => review(edit, CLOSING).filter((finding) => finding.severity === "error" && finding.where.item === undefined && finding.where.mark === undefined && finding.code !== "cut-outside-pause");

  it("holds an edit with no captions error to none, and one that already has one to no worse: none that reads otherwise, no more frames", () => {
    // No error standing: any captions error is worse.
    expect(captionsWorse(roomy(), roomy(), ROOMY)).toBe(false);
    expect(captionsWorse(roomy(), roomy({ y: 0.44 }), ROOMY)).toBe(true);
    // One standing: the first cut found no place clear of the close-up.
    const standing = roomy();
    expect(captionErrors(standing).map((finding) => finding.code)).toEqual(["on-face"]);
    const rule = captionsRule(standing, CLOSING);
    expect(rule.frames).toBeGreaterThan(0);
    expect(rule.worse(standing)).toBe(false);
    // On the eyes of the first three seconds: an error that reads otherwise than the one they had (and on more frames).
    expect(rule.worse(roomy({ y: 0.36 }))).toBe(true);
    // Under an app's bar: a code they did not have.
    expect(review(roomy({ y: 0.9 }), CLOSING).some((finding) => finding.severity === "error" && finding.code === "under-buttons")).toBe(true);
    expect(rule.worse(roomy({ y: 0.9 }))).toBe(true);
    // Clear everywhere is never worse.
    const clear = ROOM_YS.find((y) => captionErrors(roomy({ y })).length === 0);
    if (clear !== undefined) expect(rule.worse(roomy({ y: clear }))).toBe(false);
  });

  it("holds an error that reads the same to no more frames: larger captions reach a mouth they were clear of", () => {
    // For three seconds a small face at the right edge, which three words a page at 72 px do not reach; then the close-up.
    const words = ["so", "today", "I", "want", "to", "show", "you", "something", "about", "editing", "that", "creators", "really", "never", "talk", "about"].map((text, i) => ({ text, startMs: 200 + i * 350, endMs: 450 + i * 350 }));
    const analyses: Analyses = { t1: analysis({ pauses: [], faces: Array.from({ length: 30 }, (_, i) => (i * 200 < 3000 ? { ms: i * 200, face: box(0.82, 0.5, 0.2, 0.2), mouth: box(0.86, 0.6, 0.12, 0.05) } : { ms: i * 200, face: box(0.1, 0.3, 0.8, 0.6), mouth: box(0.4, 0.6, 0.2, 0.05) })) }) };
    const set = (captions: Partial<Edit["captions"]> = {}): Edit => ({ ...newEdit(take({ words })), captions: { ...DEFAULT_CAPTIONS, look: "pop", size: 72, y: 0.62, maxWords: 3, ...captions } });
    const read = (edit: Edit) => [...new Set(review(edit, analyses).filter((finding) => finding.severity === "error" && finding.where.item === undefined && finding.where.mark === undefined).map(sameAs))];
    const frames = (edit: Edit) => textErrorFrames(edit, analyses).get(CAPTIONS)?.size ?? 0;
    const [standing, larger, fewer] = [set(), set({ size: 130 }), set({ maxWords: 2 })];
    expect(read(standing)).toEqual(["on-face|||the captions at # s cover the mouth; move them up or down"]);
    // Larger: the same sentence, on the frames of the first three seconds as well.
    expect(read(larger)).toEqual(read(standing));
    expect(frames(larger)).toBeGreaterThan(frames(standing));
    expect(captionsWorse(standing, larger, analyses)).toBe(true);
    // Two words a page: the same sentence on the same frames, which is no worse.
    expect(read(fewer)).toEqual(read(standing));
    expect(frames(fewer)).toBe(frames(standing));
    expect(captionsWorse(standing, fewer, analyses)).toBe(false);
  });

  it("the room says the error stands, where it gets no worse and where it is least; at every height tried it names the height just when the rule passes it", () => {
    const standing = roomy();
    const line = contextOf(standing, CLOSING, []).room.split("\n")[0] ?? "";
    expect(line).toMatch(/^captions now size 72, 3 words a page, y=0\.62; as they are they have room at y=\[.*?\]\. They cover a face or sit under an app's bar on \d+ frames of the film as it came, which a change may not make worse: the heights named are where it gets no worse, and it is least at y=0\.\d+ \(\d+ frames\)\./);
    const named = ROOM_YS.filter((y) => inside(rangesAfter(line.split(". ")[0] ?? "", "room at "), y));
    expect(named.length).toBeGreaterThan(0);
    for (const y of ROOM_YS) expect(named.includes(y), `y=${y}`).toBe(!captionsWorse(standing, roomy({ y }), CLOSING));
    // A height on the eyes of the open shots is left out, and the rule refuses it.
    expect(named).not.toContain(0.36);
    expect(captionsWorse(standing, roomy({ y: 0.36 }), CLOSING)).toBe(true);
    // The place named least covers no more frames than the captions do as they are.
    const least = Number(/least at y=(0\.\d+)/.exec(line)?.[1]);
    expect(captionsWorse(standing, roomy({ y: least }), CLOSING)).toBe(false);
    // An answer that set them too large gets a fit that is no worse than the edit was, or none.
    const fit = captionsFit(roomy({ size: 200 }), CLOSING, standing);
    if (fit) expect(captionsWorse(standing, roomy({ ...fit }), CLOSING)).toBe(false);
  });
});

describe("timeCut: a cut asked by time lands on the nearest clean cut within a second (Task 14b)", () => {
  // The take whole, one shot of 6 s; its pauses' cuts at 1200 and 2700 ms.
  const errors = (edit: Edit) => review(edit, ROOMY).filter((finding) => finding.severity === "error").map((finding) => finding.code);

  it("cuts the opening up to the pause nearest the moment asked, and says how much went when that is not what was asked", () => {
    const cut = timeCut(roomy(), ROOMY, 0, 1000);
    expect(cut).toEqual({ ops: [{ op: "shot.trim", id: "s1", startMs: 1200 }], says: "the first 1.2 s, up to the pause, so no word is clipped" });
    if ("none" in cut) throw new Error(cut.none);
    expect(errors(through(roomy(), cut.ops))).toEqual([]);
    // Asked for exactly what a clean cut gives: nothing to add.
    expect(timeCut(roomy(), ROOMY, 0, 1200)).toEqual({ ops: [{ op: "shot.trim", id: "s1", startMs: 1200 }], says: null });
  });

  it("cuts the end from the pause on, and a stretch in the middle from pause to pause, splitting the shot", () => {
    expect(timeCut(roomy(), ROOMY, 2500, 99_999)).toEqual({ ops: [{ op: "shot.trim", id: "s1", endMs: 2700 }], says: "the last 3.3 s, from the pause on, so no word is clipped" });
    const middle = timeCut(roomy(), ROOMY, 1000, 3000);
    expect(middle).toEqual({ ops: [{ op: "shot.split", id: "s1", atMs: 2700, newId: "s1-c" }, { op: "shot.trim", id: "s1", endMs: 1200 }], says: "1.5 s in all, from pause to pause, so no word is clipped" });
    if ("none" in middle) throw new Error(middle.none);
    const made = through(roomy(), middle.ops);
    expect(made.shots.map((shot) => [shot.id, shot.startMs, shot.endMs])).toEqual([["s1", 0, 1200], ["s1-c", 2700, 6000]]);
    expect(errors(made)).toEqual([]);
  });

  it("takes whole shots out between two cuts, and lands on a cut between shots as on a pause", () => {
    const two = through(roomy(), [{ op: "shot.split", id: "s1", atMs: 2700, newId: "s2" }]);
    expect(timeCut(two, ROOMY, 0, 2600)).toEqual({ ops: [{ op: "shot.remove", id: "s1" }], says: "the first 2.7 s, up to the pause, so no word is clipped" });
    expect(timeCut(two, ROOMY, 1000, 99_999)).toEqual({ ops: [{ op: "shot.trim", id: "s1", endMs: 1200 }, { op: "shot.remove", id: "s2" }], says: "the last 4.8 s, from the pause on, so no word is clipped" });
  });

  it("refuses an end with no clean cut within a second, with the nearest ones and the words they follow; and a cut of nothing or of everything", () => {
    expect(timeCut(roomy(), ROOMY, 0, 4500)).toEqual({ none: 'no clean cut lies within one second of 4.5 s of the film: the nearest are 2.7 s into the film, after w3 "this" and 6.0 s into the film, after w5 "well". Send "ops": [] and say that it cannot be cut there without clipping a word, and where the nearest clean cut is in the creator\'s own words (after which of their words or sentences), not in seconds' });
    // The far end never lands on the near end's own moment: from the film's start, the start itself is no place for the cut's other end.
    const sparse: Analyses = { t1: analysis({ pauses: [{ startMs: 2300, endMs: 3100, cutMs: 2700 }] }) };
    expect(timeCut(roomy(), sparse, 0, 1000)).toEqual({ none: 'no clean cut lies within one second of 1.0 s of the film: the nearest is 2.7 s into the film, after w3 "this". Send "ops": [] and say that it cannot be cut there without clipping a word, and where the nearest clean cut is in the creator\'s own words (after which of their words or sentences), not in seconds' });
    expect(timeCut(roomy(), ROOMY, 1100, 1300)).toMatchObject({ none: expect.stringContaining("no clean cut lies within one second of 1.3 s of the film: the nearest is 2.7 s into the film") });
    expect(timeCut(roomy(), ROOMY, 0, 99_999)).toEqual({ none: "that would take the whole film out" });
    expect(timeCut(roomy(), ROOMY, 2000, 1000)).toEqual({ none: 'time.cut takes "fromMs" before "toMs", both in the film\'s own time' });
  });
});

describe("endsTrim: the film's ends cut to its words by the recipe's own rule (Task 14b)", () => {
  it("cuts what comes before the first word, after the last, or both, keeping a breath; and says when the film already starts or ends on its words", () => {
    // The take whole: its first word starts at 300 ms, its last ends at 4,000 of 6,000.
    const both = endsTrim(roomy(), ROOMY, { start: true, end: true });
    if ("none" in both) throw new Error(both.none);
    const cut = through(roomy(), both.ops);
    const shot = cut.shots[0];
    if (!shot) throw new Error("no shot");
    // Half of the recipe's shortest pause is kept next to each word.
    expect(both.ops.every((op) => op.op === "shot.trim")).toBe(true);
    expect([300 - shot.startMs, shot.endMs - 4000]).toEqual([PAUSE_MS.min / 2, PAUSE_MS.min / 2]);
    expect(review(cut, ROOMY).filter((finding) => finding.severity === "error")).toEqual([]);
    // One end alone leaves the other as it was.
    const end = endsTrim(roomy(), ROOMY, { start: false, end: true });
    expect(end).toEqual({ ops: [{ op: "shot.trim", id: "s1", endMs: shot.endMs }] });
    // Cut already, there is nothing more to take: said, with what to answer.
    expect(endsTrim(cut, ROOMY, { start: true, end: true })).toEqual({ none: 'the film already starts on its first word and ends on its last: nothing is left to take off there. Send "ops": [] and say that it already does' });
    expect(endsTrim(cut, ROOMY, { start: false, end: true })).toEqual({ none: 'the film already ends on its last word: nothing is left to take off there. Send "ops": [] and say that it already does' });
  });
});

describe("effectOf: what a change did, measured (Task 14, fix round 2)", () => {
  it("says the film's new length and the words cut out, and that such a change is worth a look", () => {
    const cut = through(roomy(), [{ op: "shot.trim", id: "s1", startMs: 1200 }]);
    expect(effectOf(roomy(), cut)).toEqual({ lines: ["the film is now 4.8 s; it was 6.0 s (1.2 s shorter)", 'words cut out of the film: w0 to w1 (2 words: "Hi there")'], risky: true });
    // The other way round: longer, and the words are in the film that were not.
    expect(effectOf(cut, roomy())).toEqual({ lines: ["the film is now 6.0 s; it was 4.8 s (1.2 s longer)", 'words now in the film that were not: w0 to w1 (2 words: "Hi there")'], risky: true });
    // A trim of silence alone: shorter, and no word went.
    // A trim of silence alone: shorter, and no word went. Told when there is a look; not worth one of its own.
    expect(effectOf(roomy(), through(roomy(), [{ op: "shot.trim", id: "s1", endMs: 5000 }]))).toEqual({ lines: ["the film is now 5.0 s; it was 6.0 s (1.0 s shorter)", "no word was cut out or brought in"], risky: false });
  });

  it("says what was taken out, and how the captions and a text moved, each with its direction", () => {
    const before = roomy({}, [titleItem("hook", 0, 60, 0.2, "Back *at* it"), calloutItem("c1", 90, 30, 0.2)]);
    const after: Edit = { ...before, captions: { ...before.captions, size: 100, y: 0.66, maxWords: 2, highlight: null }, items: [{ ...titleItem("hook", 0, 60, 0.16, "Back *at* it"), props: { ...titleItem("hook", 0, 60, 0.16, "Back *at* it").props, size: 80 } }] };
    expect(effectOf(before, after)).toEqual({
      lines: [
        'taken out: the call-out "Two words"',
        "the captions: size 72 to 100 (bigger), y 0.62 to 0.66 (lower), maxWords 3 to 2 (fewer), highlight #ffe14a to null",
        'the title "Back at it": y 0.2 to 0.16 (higher), size 130 to 80 (smaller)',
      ],
      risky: true,
    });
    // The captions alone: told, and not worth a look of its own.
    expect(effectOf(roomy(), roomy({ y: 0.6 }))).toEqual({ lines: ["the captions: y 0.62 to 0.6 (higher)"], risky: false });
    expect(effectOf(roomy(), roomy())).toEqual({ lines: [], risky: false });
  });

  it("says a weight changed from the look's own, lighter or heavier (2026-11-24)", () => {
    expect(effectOf(roomy(), through(roomy(), [{ op: "captions.set", weight: 600 }]))).toEqual({ lines: ["the captions: weight 800 to 600 (lighter)"], risky: false });
    const label = { ...titleItem("hook", 0, 60, 0.2, "Back *at* it"), props: { ...titleItem("hook", 0, 60, 0.2, "Back *at* it").props, look: "label" as const } };
    const before = roomy({}, [label]);
    expect(effectOf(before, through(before, [{ op: "item.set", id: "hook", props: { weight: 600 } }]))).toEqual({ lines: ['the title "Back at it": weight 700 to 600 (lighter)'], risky: false });
    expect(effectOf(before, through(before, [{ op: "item.set", id: "hook", props: { weight: 900 } }])).lines).toEqual(['the title "Back at it": weight 700 to 900 (heavier)']);
  });

  it("says a call-out's weight changed from its own 800, and a call-out whose weight stays as before (fix round 1)", () => {
    const before = roomy({}, [{ id: "c1", part: "callout", anchor: "start", at: 90, frames: 45, props: { text: "Right here", font: "tiktok", look: "label", x: 0.5, y: 0.7, size: 84, color: "#111111" } }]);
    expect(effectOf(before, through(before, [{ op: "item.set", id: "c1", props: { weight: 600 } }]))).toEqual({ lines: ['the call-out "Right here": weight 800 to 600 (lighter)'], risky: false });
    // Its weight as it was, another setting changed: told as before, with no weight in it.
    expect(effectOf(before, through(before, [{ op: "item.set", id: "c1", props: { size: 96 } }]))).toEqual({ lines: ['the call-out "Right here": size 84 to 96 (bigger)'], risky: false });
    // As a title's: a first weight equal to the one it is drawn at changes nothing seen, and is not told.
    expect(effectOf(before, through(before, [{ op: "item.set", id: "c1", props: { weight: 800 } }])).lines).toEqual([]);
  });
});

describe("roomFor: where a refused text has room", () => {
  it("says where a call-out on the eyes is clear as it is: at each height named the review finds nothing on it", () => {
    const refused = roomy({}, [calloutItem("c1", 30, 36, 0.3)]);
    const [finding] = review(refused, ROOMY).filter((each) => each.where.item === "c1" && each.severity === "error");
    expect(finding?.code).toBe("on-face");
    if (!finding) throw new Error("the call-out was not refused");
    const hint = roomFor(refused, ROOMY, finding) ?? "";
    expect(hint).toMatch(/^Room for it as it is: y=\[.*\.$/);
    const ranges = rangesAfter(hint, "as it is: ");
    for (const y of ROOM_YS) {
      const found = review(roomy({}, [calloutItem("c1", 30, 36, y)]), ROOMY).filter((each) => each.where.item === "c1" && (each.severity === "error" || each.code === "on-face"));
      expect(found.length === 0).toBe(inside(ranges, y));
    }
  });

  it("looks for a smaller size when its own has no place, and says when none has", () => {
    // Three lines at 220 px have no room between the top bar, the face and the captions; smaller, they have.
    const big: TitleItem = { ...titleItem("t1", 0, 60, 0.3), props: { ...titleItem("t1", 0, 60, 0.3).props, size: 220 } };
    const refused = roomy({}, [big]);
    const [finding] = review(refused, ROOMY).filter((each) => each.where.item === "t1" && each.severity === "error");
    if (!finding) throw new Error("the title was not refused");
    const hint = roomFor(refused, ROOMY, finding) ?? "";
    const [, size] = /^It has no room at size 220 while it shows; at size (\d+): y=\[/.exec(hint) ?? [];
    expect(Number(size)).toBeLessThan(220);
    for (const y of ROOM_YS.filter((each) => inside(rangesAfter(hint, `at size ${size}: `), each))) {
      const tried: TitleItem = { ...big, props: { ...big.props, y, size: Number(size) } };
      expect(review(roomy({}, [tried]), ROOMY).filter((each) => each.where.item === "t1" && (each.severity === "error" || each.code === "on-face"))).toEqual([]);
    }
    // A face that fills the stage leaves no place at any size.
    const [covered] = review(refused, FILLED).filter((each) => each.where.item === "t1" && each.code === "on-face");
    if (!covered) throw new Error("the title was not on the face");
    expect(roomFor(refused, FILLED, covered)).toBe("It has no room at any size while it shows: put it at another moment (room), or leave it out and say so.");
  });

  it("answers the captions' errors with the room of the captions as the ops set them: where they would be clear, and says nothing of other findings", () => {
    // Moved onto the eyes at their own size: under the chin they have room as they are.
    const refused = roomy({ y: 0.4, size: 100 });
    const [finding] = review(refused, ROOMY).filter((each) => each.severity === "error");
    expect(finding?.code).toBe("on-face");
    if (!finding) throw new Error("the captions were not refused");
    const hint = roomFor(refused, ROOMY, finding, roomy()) ?? "";
    expect(hint).toMatch(/^Room for the captions as these ops set them: size 100, 3 words a page, y=0\.4; as they are they have room at y=\[.*\]\. (Bigger, the largest with a place first: \{.*\}|No larger size has a place\.)$/);
    const clear = ROOM_YS.filter((each) => inside(rangesAfter(hint.split(". ")[0] ?? "", "room at "), each));
    expect(clear).toContain(0.62);
    expect(clear).not.toContain(0.4);
    for (const y of clear) expect(errorsOf(roomy({ y, size: 100 }))).toEqual([]);
    expect(roomFor(refused, ROOMY, { code: "cut-outside-pause", severity: "error", where: { frame: 0, shot: "s1" }, says: "…" })).toBeNull();
    expect(roomFor(refused, ROOMY, { code: "two-titles", severity: "error", where: { frame: 0, item: "t1" }, says: "…" })).toBeNull();
  });

  it("answers captions with no room as the ops set them (a look on a box, set too large) with the largest settings that have a place, each clear as sent", () => {
    // The face from 0.2 to 0.77 with its mouth to 0.72: a sliver under the lip. On a pill at 110 px the captions have no place there.
    const tight: Analyses = { t1: analysis({ faces: faces().map((sample) => ({ ...sample, face: box(0.25, 0.2, 0.5, 0.57), mouth: box(0.4, 0.62, 0.2, 0.1) })) }) };
    const refused = roomy({ y: 0.76, look: "pill", size: 110 });
    const [finding] = review(refused, tight).filter((each) => each.severity === "error");
    if (!finding) throw new Error("the captions were not refused");
    const hint = roomFor(refused, tight, finding, roomy({ y: 0.76 })) ?? "";
    expect(hint).toMatch(/^Room for the captions as these ops set them: size 110, 3 words a page, y=0\.76; as they are they have room at no height\. The largest with a place first: \{"size":\d+,"maxWords":\d,"y":0\.\d+\}/);
    const settings = [...hint.matchAll(/\{[^}]+\}/g)].map((match) => JSON.parse(match[0]) as { size: number; maxWords: number; y: number });
    expect(settings.length).toBeGreaterThan(0);
    for (const [i, setting] of settings.entries()) {
      expect(setting.size).toBeLessThanOrEqual(110);
      expect(review({ ...refused, captions: { ...refused.captions, ...setting } }, tight).filter((each) => each.severity === "error"), JSON.stringify(setting)).toEqual([]);
      // 2 px more has no place at its words a page, at any height.
      if (setting.size < 110) for (const y of ROOM_YS) expect(review({ ...refused, captions: { ...refused.captions, ...setting, y, size: setting.size + 2 } }, tight).some((each) => each.severity === "error"), `${JSON.stringify(setting)} + 2 px at ${y}`).toBe(true);
      const before = settings[i - 1];
      if (before) expect(setting.size < before.size && setting.maxWords > before.maxWords).toBe(true);
    }
    // No size has a place on a face that fills the stage.
    expect(roomFor(refused, FILLED, finding, roomy({ y: 0.76, on: false }))).toBe("Room for the captions as these ops set them: size 110, 3 words a page, y=0.76; as they are they have room at no height. No size has a place.");
  });
});

/* ── a long made-up take ───────────────────────────────────────────────────────────────────────── */

const SAID = ["so", "today", "I", "want", "to", "show", "you", "something", "about", "editing", "that", "creators", "really", "never", "talk", "about"];

/**
 * A take `ms` long with a face sampled five times a second. Up to `count` words, each 220 ms with 30 ms
 * between, and a 430 ms pause after every twelfth. The face:
 * - sways: 0.06 to each side over 8 s and 0.02 up and down over 5 s, with a little noise;
 * - jitters: 0.06 from side to side at every sample, drifting 0.04 over 20 s;
 * - sweeps: from side to side across the stage every 10 s.
 */
function longTake({ ms, moves, count = 600 }: { ms: number; moves: "sways" | "jitters" | "sweeps"; count?: number }): { edit: Edit; analyses: Analyses } {
  const words: Word[] = [];
  const pauses: TakeAnalysis["pauses"] = [];
  let at = 400;
  for (let i = 0; i < count && at + 650 < ms; i++) {
    words.push({ text: SAID[i % SAID.length] ?? "so", startMs: at, endMs: at + 220 });
    at += 250;
    if (i % 12 === 11) {
      pauses.push({ startMs: at - 20, endMs: at + 400, cutMs: at + 190 });
      at += 430;
    }
  }
  const sideOf = (i: number, t: number): number => {
    const wave = (period: number) => Math.sin((2 * Math.PI * t) / period);
    if (moves === "jitters") return 0.3 + (i % 2) * 0.06 + 0.04 * wave(20_000);
    if (moves === "sweeps") return 0.3 + 0.25 * wave(10_000);
    return 0.3 + 0.06 * wave(8000) + (((i * 37) % 11) - 5) / 1000;
  };
  const samples: FaceSample[] = Array.from({ length: Math.floor(ms / 200) }, (_, i) => {
    const t = i * 200;
    const [x, y] = [sideOf(i, t), 0.22 + 0.02 * Math.sin((2 * Math.PI * t) / 5000)];
    return { ms: t, face: box(x, y, 0.4, 0.25), mouth: box(x + 0.12, y + 0.17, 0.16, 0.05) };
  });
  const edit = newEdit(take({ ms, words }));
  return { edit, analyses: { t1: { language: "en", pauses, faces: samples, loudness: null } } };
}

/**
 * The take's one shot cut into `count` equal shots. With `framed`, every third is punched in 1.2
 * times, and the shots a third and two thirds of the way move from the take's framing to 1.2.
 */
function cutInto(edit: Edit, count: number, framed = true): Edit {
  const ms = edit.shots[0]?.endMs ?? 0;
  const ids = Array.from({ length: count }, (_, i) => (i === 0 ? "s1" : `p${i}`));
  const splits: Op[] = ids.slice(1).map((id, i) => ({ op: "shot.split", id: ids[i] ?? "s1", atMs: Math.round(((i + 1) * ms) / count), newId: id }));
  if (!framed || count === 1) return through(edit, splits);
  const moving = new Set([Math.floor(count / 3), Math.floor((2 * count) / 3)]);
  const framings: Op[] = ids.flatMap((id, i): Op[] => {
    if (moving.has(i)) return [{ op: "shot.set", id, framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "in-out", part: [0, 1] } } }];
    return i % 3 === 2 ? [{ op: "shot.set", id, framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } }] : [];
  });
  return through(edit, [...splits, ...framings]);
}

/** The edit after the operations, through the door; throws when it refuses them. */
function through(edit: Edit, ops: Op[]): Edit {
  if (ops.length === 0) return edit;
  const made = applyOps(edit, ops, edit.assets);
  if (!made.ok) throw new Error(made.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
  return made.edit;
}
