import { describe, expect, it } from "vitest";
import type { Analyses, FaceSample, TakeAnalysis } from "../analysis";
import { captionPages, titleBox } from "../../../edit/film/layout";
import { pagesFor } from "../../../edit/film/pages";
import { checkEdit } from "../check";
import { layout, momentAt, runWords } from "../derive";
import { DEFAULT_CAPTIONS, NO_LOOK, STAGE, newShot, type Asset, type Edit, type Item, type Mark, type Shot } from "../doc";
import { measure } from "../measure";
import { applyOps } from "../ops";
import { CAPTIONS, SHORTEST_READ_MS, review, textErrorFrames, zoomLimit, type Finding, type FindingCode } from "../review";
import { WEIGHTS } from "../atoms";
import { FONTS } from "../parts";
import { fixture } from "./fixture";

/* ── a made-up take: 6 s, 720x1280, ten words, four pauses ─────────────────────────────────────── */

const TAKE_MS = 6000;
const WORDS = [
  { text: "One", startMs: 200, endMs: 500 },
  { text: "two", startMs: 520, endMs: 980 },
  { text: "three", startMs: 1200, endMs: 1500 },
  { text: "four", startMs: 1520, endMs: 1980 },
  { text: "five", startMs: 2400, endMs: 2800 },
  { text: "six", startMs: 2820, endMs: 3300 },
  { text: "seven", startMs: 3320, endMs: 3900 },
  { text: "eight", startMs: 3920, endMs: 4500 },
  { text: "nine", startMs: 4520, endMs: 5100 },
  { text: "ten", startMs: 5120, endMs: 5800 },
];
const PAUSES = [
  { startMs: 0, endMs: 200, cutMs: 100 },
  { startMs: 1000, endMs: 1200, cutMs: 1100 },
  { startMs: 2000, endMs: 2400, cutMs: 2200 },
  { startMs: 5800, endMs: 6000, cutMs: 5900 },
];
/** The face from 0.6 to 0.9 of the picture's height, its mouth from 0.8 to 0.85: low in the frame. */
const FACE = { x: 0.2, y: 0.6, w: 0.6, h: 0.3 };
const MOUTH = { x: 0.4, y: 0.8, w: 0.2, h: 0.05 };
/** Five samples a second over the take; none finds a face from 3 s up to 4 s. */
const FACES: FaceSample[] = Array.from({ length: TAKE_MS / 200 }, (_, i) => {
  const ms = i * 200;
  return ms >= 3000 && ms < 4000 ? { ms, face: null, mouth: null } : { ms, face: { ...FACE }, mouth: { ...MOUTH } };
});

const take = (over: Partial<Extract<Asset, { kind: "video" }>> = {}): Asset => ({
  id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" },
  ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS.map((word) => ({ ...word })), ...over,
});
const analysis = (over: Partial<TakeAnalysis> = {}): TakeAnalysis => ({ language: "en", pauses: PAUSES.map((p) => ({ ...p })), faces: FACES.map((s) => structuredClone(s)), loudness: null, ...over });
const analyses = (over: Partial<TakeAnalysis> = {}): Analyses => ({ take: analysis(over) });

/** A call-out; 900 ms unless told, long enough to read (`short-text`). */
const callout = (id: string, atMs: number, props: Partial<Extract<Mark, { part: "callout" }>["props"]> = {}, lenMs = 900): Mark => ({
  id, part: "callout", atMs, lenMs, props: { text: "SAVE", font: "tiktok", look: "pop", x: 0.4, y: 0.5, size: 96, color: "#ffffff", ...props },
});
const titleProps = { text: "Stop scrolling", font: "inter" as const, look: "bold" as const, y: 0.2, size: 96, color: "#ffffff", accent: null };

/**
 * An edit with nothing wrong: two shots cut in pauses (1100 ms and 2200 ms), captions at 0.3 of the
 * height (above the face, below the apps' top bars), a title over the first second and a call-out
 * on the second shot, both clear of the face and the apps.
 */
function cleanEdit(): Edit {
  return {
    v: 1, kit: "1", stage: { ...STAGE },
    assets: [take()],
    shots: [
      newShot({ id: "s1", asset: "take", endMs: 1100 }),
      { ...newShot({ id: "s2", asset: "take", startMs: 2200, endMs: TAKE_MS }), marks: [callout("c1", 3400)] },
    ],
    items: [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 30, props: { ...titleProps } }],
    captions: { ...DEFAULT_CAPTIONS, y: 0.3 },
    look: structuredClone(NO_LOOK),
    cover: null,
  };
}
/** One shot over the whole take, captions where asked, nothing else. */
function oneShot(captions: Partial<Edit["captions"]> = {}, shot: Partial<Shot> = {}): Edit {
  return { ...cleanEdit(), shots: [{ ...newShot({ id: "s1", asset: "take", endMs: TAKE_MS }), ...shot }], items: [], captions: { ...DEFAULT_CAPTIONS, y: 0.3, ...captions } };
}
const only = (findings: Finding[], code: FindingCode) => findings.filter((finding) => finding.code === code);
const through = (edit: Edit, ops: unknown[], files: Asset[] = edit.assets): Edit => {
  const made = applyOps(edit, ops, files);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};

describe("review: an edit with nothing wrong", () => {
  it("finds nothing, and the edit passes the door's checks too", () => {
    expect(checkEdit(cleanEdit())).toEqual([]);
    expect(review(cleanEdit(), analyses())).toEqual([]);
  });

  it("gives the same findings, in the same order, every time", () => {
    const busy = fixture(); // default captions low on the stage, a progress bar, a call-out: several findings
    const first = review(busy, { take: analysis() });
    expect(first.length).toBeGreaterThan(1);
    expect(review(busy, { take: analysis() })).toEqual(first);
    expect(review(structuredClone(busy), { take: analysis() })).toEqual(first);
    const frames = first.map((finding) => finding.where.frame);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
  });
});

describe("review: on-face", () => {
  it("finds captions over the mouth, at the first moment, and moving them up clears it", () => {
    const low = only(review(oneShot({ y: 0.8 }), analyses()), "on-face");
    expect(low).toEqual([{ code: "on-face", severity: "error", where: { frame: 6, shot: "s1" }, says: "the captions at 0.2 s cover the mouth; move them up or down" }]);
    expect(only(review(oneShot({ y: 0.3 }), analyses()), "on-face")).toEqual([]);
  });

  it("finds a call-out over the mouth at its moment, and not at a moment where no face was found", () => {
    const at = (atMs: number) => oneShot({ on: false }, { marks: [callout("c1", atMs, { x: 0.5, y: 0.825 }, 500)] });
    const seen = only(review(at(1000), analyses()), "on-face");
    expect(seen).toEqual([{ code: "on-face", severity: "error", where: { frame: 30, shot: "s1", mark: "c1" }, says: 'the call-out "SAVE" at 1.0 s covers the mouth; move it up or down' }]);
    expect(only(review(at(3200), analyses()), "on-face")).toEqual([]);
  });

  it("finds a part over the face's upper half, where the eyes are, an error, and none when the face is elsewhere", () => {
    // The face runs from 1152 to 1728 px: its upper half to 1440. The call-out sits at 1214 to 1320.
    const edit = oneShot({ on: false }, { marks: [callout("c1", 1000, { x: 0.5, y: 0.66 }, 500)] });
    expect(only(review(edit, analyses()), "on-face").map((finding) => [finding.severity, finding.says])).toEqual([["error", 'the call-out "SAVE" at 1.0 s covers the eyes; move it up or down']]);
    const high = { x: 0.3, y: 0.05, w: 0.4, h: 0.2 };
    const elsewhere = analyses({ faces: FACES.map((sample) => ({ ...sample, face: sample.face && high, mouth: sample.mouth && { x: 0.45, y: 0.2, w: 0.1, h: 0.03 } })) });
    expect(only(review(edit, elsewhere), "on-face")).toEqual([]);
  });

  it("finds captions only over the chin, below the mouth, a warning", () => {
    // One row centred at 1698 px sits at 1640 to 1756: under the mouth (to 1632), over the face's last 88 px (to 1728).
    expect(only(review(oneShot({ y: 1698 / 1920 }), analyses()), "on-face")).toEqual([
      { code: "on-face", severity: "warn", where: { frame: 6, shot: "s1" }, says: "the captions at 0.2 s touch the chin; move them up or down" },
    ]);
  });

  it("names the mouth from 25 % of its own area; a text that covers less of it, above the lip, is on the nose (final fix wave)", () => {
    // A 106 px call-out over the mouth (1536 to 1632 px, 96 tall) from above: its bottom 19 px in covers 20 %, 29 px in 30 %.
    const over = (centre: number) => oneShot({ on: false }, { marks: [callout("c1", 1000, { x: 0.5, y: centre / 1920 }, 500)] });
    expect(only(review(over(1502), analyses()), "on-face").map((finding) => [finding.severity, finding.says])).toEqual([["error", 'the call-out "SAVE" at 1.0 s covers the nose; move it up or down']]);
    expect(only(review(over(1512), analyses()), "on-face").map((finding) => [finding.severity, finding.says])).toEqual([["error", 'the call-out "SAVE" at 1.0 s covers the mouth; move it up or down']]);
  });

  it("finds a text from the brow to the lower lip an error: between the eyes and the lip it is on the nose; below the lip, the chin, a warning (final fix wave)", () => {
    // The face runs from 1152 to 1728 px, its upper half to 1440, the mouth 1536 to 1632: the nose's band is 1440 to 1632.
    const at = (centre: number, given = analyses()) => only(review(oneShot({ on: false }, { marks: [callout("c1", 1000, { x: 0.5, y: centre / 1920 }, 500)] }), given), "on-face").map((finding) => [finding.severity, finding.says]);
    // 1442 to 1548: under the eyes' half, 12 px into the mouth (12 % of it): on the nose.
    expect(at(1495)).toEqual([["error", 'the call-out "SAVE" at 1.0 s covers the nose; move it up or down']]);
    // 1637 to 1743: under the lip, over the face's last 91 px: the chin.
    expect(at(1690)).toEqual([["warn", 'the call-out "SAVE" at 1.0 s touches the chin; move it up or down']]);
    // With no mouth found, the lip is taken 0.9 down the face (1670 px), as the agent's room takes it: the same call-out is on the nose.
    const noMouth = analyses({ faces: FACES.map((sample) => ({ ...sample, mouth: null })) });
    expect(at(1690, noMouth)).toEqual([["error", 'the call-out "SAVE" at 1.0 s covers the nose; move it up or down']]);
    // Captions are judged alike: a row over the nose is an error, as review and the recipes read it.
    expect(only(review(oneShot({ y: 1495 / 1920 }), analyses()), "on-face").map((finding) => [finding.severity, finding.says])).toEqual([["error", "the captions at 0.2 s cover the nose; move them up or down"]]);
    expect(textErrorFrames(oneShot({ y: 1495 / 1920 }), analyses()).get(CAPTIONS)?.size ?? 0).toBeGreaterThan(0);
  });

  it("counts an overlap only when it is at least 4 % of the text's box", () => {
    // The face's top edge moved just under the call-out's bottom: a sliver of overlap is not on the face.
    const edit = oneShot({ on: false }, { marks: [callout("c1", 1000, { x: 0.5, y: 0.5 }, 500)] });
    const box = { top: 0.5 * 1920 - 53, bottom: 0.5 * 1920 + 53 }; // a 96 px pop call-out is even(96 × 1.1) = 106 tall
    const faceFrom = (top: number) => analyses({ faces: FACES.map((sample) => ({ ...sample, face: sample.face && { x: 0.2, y: top / 1920, w: 0.6, h: 0.3 }, mouth: null })) });
    expect(only(review(edit, faceFrom(box.bottom - 3)), "on-face")).toEqual([]); // 3 of 106 px: under 4 %
    expect(only(review(edit, faceFrom(box.bottom - 5)), "on-face").map((finding) => finding.severity)).toEqual(["error"]); // 5 of 106 px: over 4 %, in the eyes' half
  });

  it("judges a text shorter than the samples' spacing against the sample standing for its frames", () => {
    // Samples fall on frames 30 and 36; a call-out over the mouth on frames 32 to 35 is judged by the sample of frame 30.
    const brief = oneShot({ on: false }, { marks: [callout("c1", 1067, { x: 0.5, y: 0.825 }, 133)] });
    expect(only(review(brief, analyses()), "on-face")).toEqual([
      { code: "on-face", severity: "error", where: { frame: 32, shot: "s1", mark: "c1" }, says: 'the call-out "SAVE" at 1.1 s covers the mouth; move it up or down' },
    ]);
  });

  it("judges a text in a slow shot, where the samples fall 12 frames apart, the same way", () => {
    // At half speed the samples fall on frames 60 and 72; the call-out shows on frames 63 to 71.
    const slow = oneShot({ on: false }, { speed: 0.5, marks: [callout("c1", 1050, { x: 0.5, y: 0.825 }, 300)] });
    expect(only(review(slow, analyses()), "on-face").map((finding) => [finding.severity, finding.where.frame])).toEqual([["error", 63]]);
  });

  it("does not look for the face on the shared frames of a push or a punch, which move the footage; a mask keeps both runs' faces", () => {
    // Two runs share frames 21 to 32; a call-out over the mouth shows on just those frames.
    const across = (out: Shot["out"]): Edit => ({
      ...cleanEdit(), captions: { ...DEFAULT_CAPTIONS, on: false },
      shots: [{ ...newShot({ id: "s1", asset: "take", endMs: 1100 }), out }, newShot({ id: "s2", asset: "take", startMs: 2200, endMs: TAKE_MS })],
      items: [{ id: "c9", part: "callout", anchor: "start", at: 21, frames: 12, props: { text: "SAVE", font: "tiktok", look: "pop", x: 0.5, y: 0.825, size: 96, color: "#ffffff" } }],
    });
    // A fade blends, and a wipe, an iris and a clock clip with a mask: the face stays where its framing puts it.
    for (const out of [{ kind: "fade", frames: 12 }, { kind: "wipe", frames: 12, from: "left" }, { kind: "iris", frames: 12 }, { kind: "clock", frames: 12 }] as const) {
      expect(only(review(across(out), analyses()), "on-face").map((finding) => [finding.severity, finding.where])).toEqual([["error", { frame: 21, item: "c9" }]]);
    }
    // A push slides the footage and a punch scales it: the face is not where its framing puts it.
    for (const out of [{ kind: "push", frames: 12, from: "right" }, { kind: "punch", frames: 12 }] as const) {
      expect(only(review(across(out), analyses()), "on-face")).toEqual([]);
    }
  });

  it("judges a run's first frames, before its first own sample, against the sample before its start", () => {
    // The second run starts at 1130 ms: the sample at 1000 ms falls 4 frames before it, the one at 1200 on its third frame.
    // That one finds no face, so only the sample before the start can find the mouth under the call-out on the run's first 3 frames.
    const faces = FACES.map((sample) => (sample.ms === 1200 ? { ms: 1200, face: null, mouth: null } : sample));
    const edit: Edit = {
      ...cleanEdit(), items: [], captions: { ...DEFAULT_CAPTIONS, on: false },
      shots: [newShot({ id: "s1", asset: "take", endMs: 1000 }), { ...newShot({ id: "s2", asset: "take", startMs: 1130, endMs: TAKE_MS }), marks: [callout("c1", 1130, { x: 0.5, y: 0.825 }, 100)] }],
    };
    expect(only(review(edit, analyses({ faces })), "on-face")).toEqual([
      { code: "on-face", severity: "error", where: { frame: 30, shot: "s2", mark: "c1" }, says: 'the call-out "SAVE" at 1.0 s covers the mouth; move it up or down' },
    ]);
  });

  it("ends a sample's frames at the next sample, even one that finds no face", () => {
    // The sample at 1000 ms (frame 30) finds the face; the one at 1200 ms (frame 36) finds none.
    const faces = FACES.map((sample) => (sample.ms === 1200 ? { ms: 1200, face: null, mouth: null } : sample));
    const at = (atMs: number) => oneShot({ on: false }, { marks: [callout("c1", atMs, { x: 0.5, y: 0.825 }, 100)] });
    expect(only(review(at(1200), analyses({ faces })), "on-face")).toEqual([]); // frames 36 to 38
    expect(only(review(at(1100), analyses({ faces })), "on-face").map((finding) => [finding.severity, finding.where.frame])).toEqual([["error", 33]]); // frames 33 to 35
  });

  it("finds a face of the take coming in during a fade, where the take going out shows none", () => {
    // The take going out finds no face from 600 ms on (frames 18 to 32); the second take, coming in at frame 21, finds the mouth at once.
    const outgoing = FACES.map((sample) => (sample.ms >= 600 ? { ms: sample.ms, face: null, mouth: null } : sample));
    const incoming = Array.from({ length: 20 }, (_, i) => ({ ms: i * 200, face: { ...FACE }, mouth: { ...MOUTH } }));
    const edit: Edit = {
      ...cleanEdit(), assets: [take(), take2()], captions: { ...DEFAULT_CAPTIONS, on: false },
      shots: [{ ...newShot({ id: "s1", asset: "take", endMs: 1100 }), out: { kind: "fade", frames: 12 } }, newShot({ id: "s2", asset: "take2", startMs: 1600, endMs: 4000 })],
      items: [{ id: "c9", part: "callout", anchor: "start", at: 21, frames: 12, props: { text: "SAVE", font: "tiktok", look: "pop", x: 0.5, y: 0.825, size: 96, color: "#ffffff" } }],
    };
    const given: Analyses = { take: analysis({ faces: outgoing }), take2: analysis({ pauses: PAUSES2.map((p) => ({ ...p })), faces: incoming }) };
    expect(only(review(edit, given), "on-face").map((finding) => [finding.severity, finding.where])).toEqual([["error", { frame: 21, item: "c9" }]]);
    expect(only(review(edit, { ...given, take2: analysis({ pauses: PAUSES2.map((p) => ({ ...p })), faces: [] }) }), "on-face")).toEqual([]);
  });

  it("follows the shot's framing: a zoom that pushes the face off the captions clears them", () => {
    // Zoomed 1.3 and showing the picture's top, the face (0.6 to 0.9 of the picture) is pushed below 0.8 of the stage.
    const framed = oneShot({ y: 0.6 }, { framing: { from: { zoom: 1.3, x: 0, y: -1 }, move: null } });
    expect(only(review(oneShot({ y: 0.6 }), analyses()), "on-face")).toHaveLength(1);
    expect(only(review(framed, analyses()), "on-face")).toEqual([]);
  });

  it("does not look for the face under a cutaway, which hides the footage", () => {
    const broll: Asset = { id: "broll", kind: "video", origin: "uploaded", at: { bucket: "edit-media", path: "u1/broll.mp4" }, ms: 8000, w: 1080, h: 1920, sound: false, words: null };
    const covered = { ...oneShot({ y: 0.8 }), assets: [take(), broll] };
    covered.items = [{ id: "cover-up", part: "cutaway", asset: "broll", anchor: "start", at: 0, frames: null, props: { fit: "cover", startMs: 0, volume: 0 } }];
    expect(only(review(covered, analyses()), "on-face")).toEqual([]);
  });

  it("has nothing to check against for a take with no analysis", () => {
    expect(only(review(oneShot({ y: 0.8 }), {}), "on-face")).toEqual([]);
  });
});

describe("review: under-buttons", () => {
  it("finds a call-out under the apps' right-side buttons, naming the app and the zone", () => {
    const edit = oneShot({ on: false }, { marks: [callout("c1", 1000, { text: "Hi", x: 0.95, y: 0.6 })] });
    const found = only(review(edit, analyses({ faces: [] })), "under-buttons");
    expect(found.map((finding) => finding.says)).toEqual([
      'the call-out "Hi" at 1.0 s sits under TikTok\'s right-side buttons; move it left',
      'the call-out "Hi" at 1.0 s sits under Instagram\'s right-side buttons; move it left',
    ]);
    expect(found.every((finding) => finding.severity === "error" && finding.where.mark === "c1" && finding.where.frame === 30)).toBe(true);
  });

  it("finds captions low on the stage under both apps' bottom bars, and none at 0.3", () => {
    const says = only(review(oneShot({ y: 0.8 }), analyses({ faces: [] })), "under-buttons").map((finding) => finding.says);
    expect(says).toEqual(expect.arrayContaining([
      "the captions at 0.2 s sit under TikTok's bottom caption and sound bar; move them up",
      "the captions at 0.2 s sit under Instagram's bottom caption and audio bar; move them up",
    ]));
    expect(only(review(oneShot({ y: 0.3 }), analyses({ faces: [] })), "under-buttons")).toEqual([]);
  });

  it("finds a title under the top bars", () => {
    const edit = { ...oneShot({ on: false }), items: [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 30, props: { ...titleProps, y: 0.05 } } satisfies Item] };
    expect(only(review(edit, analyses({ faces: [] })), "under-buttons").map((finding) => finding.says)).toEqual([
      'the title "Stop scrolling" at 0.0 s sits under TikTok\'s top bar; move it down',
      'the title "Stop scrolling" at 0.0 s sits under Instagram\'s top bar; move it down',
    ]);
  });

  it("grades by how much a zone covers: from 4 % a warning that the text touches it, from 15 % an error", () => {
    // One row of captions centred at 1490 px reaches 1548: 8 of its 116 px into TikTok's bottom bar (from 1540), 48 into Instagram's (from 1500).
    const touching = only(review(oneShot({ y: 1490 / 1920 }), analyses({ faces: [] })), "under-buttons");
    expect(touching.map((finding) => [finding.severity, finding.says])).toEqual([
      ["warn", "the captions at 0.2 s touch TikTok's bottom caption and sound bar; move them up"],
      ["error", "the captions at 0.2 s sit under Instagram's bottom caption and audio bar; move them up"],
    ]);
  });

  it("keeps, for each text and zone, the worst finding over the film, then the earliest", () => {
    // The first page is one row and touches TikTok's bottom bar; a later page of two rows, held at the same centre, goes under it.
    const words = [
      { text: "Hi", startMs: 200, endMs: 500 }, { text: "there", startMs: 520, endMs: 800 }, { text: "now.", startMs: 820, endMs: 980 },
      { text: "Extraordinary", startMs: 1200, endMs: 1800 }, { text: "unbelievable", startMs: 1820, endMs: 2400 }, { text: "phenomenal", startMs: 2420, endMs: 3000 },
    ];
    const edit = { ...oneShot({ y: 1490 / 1920 }), assets: [take({ words })] };
    const tiktok = only(review(edit, analyses({ faces: [] })), "under-buttons").filter((finding) => finding.says.includes("TikTok's bottom"));
    expect(tiktok.map((finding) => [finding.severity, finding.where.frame])).toEqual([["error", 36]]);
  });

  it("lets a progress bar sit under the apps' bars at either edge: a thin edge with no words is exempt (ruling P)", () => {
    const bar = (edge: "top" | "bottom"): Item => ({ id: "bar", part: "progress", anchor: "start", at: 0, frames: null, props: { edge, color: "#ffffff" } });
    expect(only(review({ ...oneShot({ on: false }), items: [bar("top")] }, analyses({ faces: [] })), "under-buttons")).toEqual([]);
    expect(only(review({ ...oneShot({ on: false }), items: [bar("bottom")] }, analyses({ faces: [] })), "under-buttons")).toEqual([]);
  });
});

describe("review: text-fits", () => {
  const long = "W".repeat(40);

  it("finds a call-out too long to be set at its part's smallest size", () => {
    expect(measure(long, "tiktok", 800, 44)!).toBeGreaterThan(1080); // wider than the stage at 44 px
    const edit = oneShot({ on: false }, { marks: [callout("c1", 1000, { text: long })] });
    const found = only(review(edit, analyses({ faces: [] })), "text-fits");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: "error", where: { frame: 30, shot: "s1", mark: "c1" } });
    expect(found[0]?.says).toMatch(/^the call-out "WWWW.*" at 1\.0 s is set at \d+ px to fit the stage, under the 44 px it may be; shorten it$/);
    expect(only(review(oneShot({ on: false }, { marks: [callout("c1", 1000)] }), analyses({ faces: [] })), "text-fits")).toEqual([]);
  });

  it("finds a title set smaller than a title may be: under 48 px (Task K1), and not one set at 48", () => {
    const titled = (text: string, size = titleProps.size) => ({ ...oneShot({ on: false }), items: [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 30, props: { ...titleProps, text, size } } satisfies Item] });
    const long = "Rindfleischetikettierungsüberwachungsaufgaben";
    expect(titleBox({ ...titleProps, text: long }, (text, weight, size, tracking) => measure(text, "inter", weight, size, tracking)!).size).toBeLessThan(48);
    const found = only(review(titled(long), analyses({ faces: [] })), "text-fits");
    expect(found.map((finding) => finding.where)).toEqual([{ frame: 0, item: "t1" }]);
    expect(found[0]?.says).toMatch(/under the 48 px it may be; shorten it$/);
    // A hook as small as two of five references set theirs: 48 px, as asked, and nothing to find.
    const small = titled("Stop scrolling for one second", 48);
    expect(titleBox(small.items[0]!.props, (text, weight, size, tracking) => measure(text, "inter", weight, size, tracking)!).size).toBe(48);
    expect(only(review(small, analyses({ faces: [] })), "text-fits")).toEqual([]);
  });

  it("finds captions whose word is too wide for their row at their smallest size", () => {
    const words = [{ text: "Incomprehensibilities", startMs: 200, endMs: 900 }];
    const edit = { ...oneShot({ width: 0.3, size: 72 }), assets: [take({ words })] };
    const found = only(review(edit, analyses({ faces: [] })), "text-fits");
    expect(found).toHaveLength(1);
    expect(found[0]?.says).toMatch(/^the captions at 0\.2 s are set at \d+ px to fit their row, under the 44 px they may be; widen them or retell the word shorter$/);
  });
});

describe("review: caption-rows (Task K1)", () => {
  /** Made-up words in one breath, 300 ms apart from 200 ms: no pause and no sentence's end, so a page holds as many as it may. */
  const BREATH = "so here is the thing nobody tells you about making short videos that people watch right".split(" ");
  const breath = (texts: readonly string[], fromMs = 200) => texts.map((text, i) => ({ text, startMs: fromMs + i * 300, endMs: fromMs + i * 300 + 280 }));
  const spoken = (captions: Partial<Edit["captions"]>, words = breath(BREATH)) => ({ ...oneShot({ maxWords: 16, ...captions }), assets: [take({ words })] });
  const tables = (text: string, weight: number, size: number) => measure(text, "tiktok", weight, size)!;
  const rowsOf = (edit: Edit) => {
    const run = layout(edit).runs[0]!;
    const pages = pagesFor(edit.captions, runWords(edit, run), run.frames);
    return captionPages(edit.captions, pages.map((page) => page.words), tables).map((page) => page.rows.length);
  };

  it("warns once when a page is set in more than three rows, at its first frame, saying how many and what to do", () => {
    const edit = spoken({ size: 64 });
    expect(rowsOf(edit)).toEqual([4]);
    const found = only(review(edit, analyses({ faces: [] })), "caption-rows");
    expect(found).toEqual([{ code: "caption-rows", severity: "warn", where: { frame: 6, shot: "s1" }, says: "the captions at 0.2 s run to four rows; use fewer words a page or smaller type" }]);
  });

  it("finds nothing at three rows or fewer: 16 words at 52 px, or 8 words a page at 64", () => {
    for (const captions of [{ size: 52 }, { size: 64, maxWords: 8 }, { size: 44 }]) {
      const edit = spoken(captions);
      expect(Math.max(...rowsOf(edit)), JSON.stringify(captions)).toBeLessThanOrEqual(3);
      expect(only(review(edit, analyses({ faces: [] })), "caption-rows"), JSON.stringify(captions)).toEqual([]);
    }
  });

  it("names the first page over three rows, once for the film, with its own count", () => {
    // Three words, a pause of 600 ms, then thirteen: at 100 px the first page is one row and the second many.
    const words = [...breath(BREATH.slice(0, 3)), ...breath(BREATH.slice(3), 200 + 2 * 300 + 280 + 600)];
    const edit = spoken({ size: 100 }, words);
    const rows = rowsOf(edit);
    expect(rows[0]).toBeLessThanOrEqual(3);
    expect(rows[1]).toBeGreaterThan(3);
    const found = only(review(edit, analyses({ faces: [] })), "caption-rows");
    expect(found).toHaveLength(1);
    const second = Math.round((words[3]!.startMs * 30) / 1000);
    expect(found[0]?.where).toEqual({ frame: second, shot: "s1" });
    const named = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"][rows[1]!];
    expect(found[0]?.says).toBe(`the captions at ${(second / 30).toFixed(1)} s run to ${named} rows; use fewer words a page or smaller type`);
  });

  it("does not warn with the captions off; a page holding a character the tables lack is counted too (final fix wave)", () => {
    expect(only(review(spoken({ size: 64, on: false }), analyses({ faces: [] })), "caption-rows")).toEqual([]);
    const emoji = breath([...BREATH.slice(0, 15), "👋"]);
    const found = review(spoken({ size: 64 }, emoji), analyses({ faces: [] }));
    expect(only(found, "caption-rows").map((finding) => finding.says)).toEqual(["the captions at 0.2 s run to four rows; use fewer words a page or smaller type"]);
    expect(only(found, "unmeasured")).toHaveLength(1);
  });

  it("judges a sentence's pages as they are drawn, evened out: 3 + 3 words in three rows each, not 5 + 1 in five (S1, S2)", () => {
    // Made-up words of ten letters in one breath: plain with a weight is set as a sentence; at 100 px a row holds two of them.
    const edit = spoken({ look: "plain", weight: 600, maxWords: 5, size: 100 }, breath(["brintolvar", "quessimarn", "dorvaltine", "plimorquat", "zentravilo", "morquelind"]));
    expect(rowsOf(edit)).toEqual([3, 3]);
    // The same words filled five to a page, as before 2026-11-24: the first page runs to five rows.
    const said = runWords(edit, layout(edit).runs[0]!);
    expect(captionPages(edit.captions, [said.slice(0, 5), said.slice(5)], tables).map((page) => page.rows.length)).toEqual([5, 1]);
    expect(only(review(edit, analyses({ faces: [] })), "caption-rows")).toEqual([]);
  });
});

describe("review: one finding per thing and per check", () => {
  it("keeps the captions and a call-out whose id is \"captions\" apart", () => {
    const edit = oneShot({ y: 0.8 }, { marks: [callout("captions", 1000, { text: "Hi", x: 0.5, y: 0.825 })] });
    const onFace = only(review(edit, analyses()), "on-face");
    expect(onFace.map((finding) => finding.where)).toEqual([{ frame: 6, shot: "s1" }, { frame: 30, shot: "s1", mark: "captions" }]);
  });
});

describe("review: two-titles", () => {
  it("finds a film title and a shot title on screen at once", () => {
    const edit = oneShot({ on: false }, { marks: [{ id: "t2", part: "title", atMs: 1000, lenMs: 1000, props: { ...titleProps, text: "Wait for it" } }] });
    edit.items = [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 45, props: { ...titleProps } }];
    expect(only(review(edit, analyses({ faces: [] })), "two-titles")).toEqual([{
      code: "two-titles", severity: "error", where: { frame: 30, shot: "s1", mark: "t2" },
      says: 'the title "Stop scrolling" and the title "Wait for it" are both on screen at 1.0 s; end the first before the second starts',
    }]);
    edit.shots[0]!.marks[0]!.atMs = 1500; // starts on frame 45, as the first ends
    expect(only(review(edit, analyses({ faces: [] })), "two-titles")).toEqual([]);
  });
});

describe("review: on-text (Task 10b)", () => {
  const noFace = () => analyses({ faces: [] });

  it("finds a title over the captions on the frames both show, and names the title, never the captions", () => {
    const edit = oneShot({ y: 0.3 });
    edit.items = [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 30, props: { ...titleProps, y: 0.3 } }];
    const found = only(review(edit, noFace()), "on-text");
    // The first page shows from the first word, 0.2 s in (frame 6).
    expect(found).toEqual([{ code: "on-text", severity: "error", where: { frame: 6, item: "t1" }, says: 'the title "Stop scrolling" at 0.2 s covers the captions; move it up or down' }]);
  });

  it("finds a call-out over a title, and the title under it, each from its own box", () => {
    const edit = oneShot({ on: false }, { marks: [callout("c1", 200, { text: "STOP", x: 0.5, y: 0.2 })] });
    edit.items = [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 30, props: { ...titleProps } }];
    const found = only(review(edit, noFace()), "on-text");
    expect(found.map((finding) => [finding.where, finding.says])).toEqual([
      [{ frame: 6, shot: "s1", mark: "c1" }, 'the call-out "STOP" at 0.2 s covers the title "Stop scrolling"; move it up or down'],
      [{ frame: 6, item: "t1" }, 'the title "Stop scrolling" at 0.2 s covers the call-out "STOP"; move it up or down'],
    ]);
  });

  it("finds nothing where the two never show on one frame, or sit apart", () => {
    // The title ends on frame 6, as the first caption page comes in.
    const before = oneShot({ y: 0.3 });
    before.items = [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 6, props: { ...titleProps, y: 0.3 } }];
    expect(only(review(before, noFace()), "on-text")).toEqual([]);
    expect(only(review(cleanEdit(), noFace()), "on-text")).toEqual([]);
  });

  it("holds a gap of 0.012 of the stage's height (23 px): a title 20 px over the captions is on-text, one 26 px over is not (fix rounds 3 and 5)", () => {
    // The first caption page's box at 0.3, as the kit sets it, and a title moved so its box ends `gap` px above it.
    const base = oneShot({ y: 0.3 });
    const lay = layout(base);
    const run = lay.runs[0]!;
    const pages = pagesFor(base.captions, runWords(base, run), run.frames);
    const measuring = (font: "inter" | "montserrat" | "tiktok") => (text: string, weight: number, size: number, tracking?: number) => measure(text, font, weight, size, tracking) ?? 0;
    const page = captionPages(base.captions, pages.map((each) => each.words), measuring(base.captions.font))[0]!;
    const at = (gap: number) => {
      const box = titleBox({ ...titleProps, y: 0.2 }, measuring(titleProps.font));
      const y = 0.2 + (page.y - gap - (box.y + box.h)) / 1920;
      const edit = oneShot({ y: 0.3 });
      edit.items = [{ id: "t1", part: "title", anchor: "start", at: 0, frames: 30, props: { ...titleProps, y } }];
      return only(review(edit, noFace()), "on-text");
    };
    // Any overlap of the title's box, grown by 23 px above and below, with the page's box: no 4 % allowance for this finding.
    expect(at(20).map((finding) => finding.where.item)).toEqual(["t1"]);
    expect(at(26)).toEqual([]);
  });

  it("leaves a progress bar out: it carries no words", () => {
    const edit = oneShot({ y: 0.99 });
    edit.items = [{ id: "bar", part: "progress", anchor: "start", at: 0, frames: null, props: { edge: "bottom", color: "#ffffff" } }];
    expect(only(review(edit, noFace()), "on-text")).toEqual([]);
  });
});

/** A second made-up take: 4 s, 1080x1920, three words. */
const PAUSES2 = [{ startMs: 0, endMs: 300, cutMs: 150 }, { startMs: 1300, endMs: 1900, cutMs: 1600 }, { startMs: 2600, endMs: 4000, cutMs: 3300 }];
const take2 = (): Asset => ({
  id: "take2", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take2.mp4" }, ms: 4000, w: 1080, h: 1920, sound: true,
  words: [{ text: "Hey", startMs: 300, endMs: 700 }, { text: "there", startMs: 720, endMs: 1300 }, { text: "friend", startMs: 1900, endMs: 2600 }],
});
const broll: Asset = { id: "broll", kind: "video", origin: "uploaded", at: { bucket: "edit-media", path: "u1/broll.mp4" }, ms: 4000, w: 1080, h: 1920, sound: false, words: null };
const bothTakes = (): Analyses => ({ take: analysis(), take2: analysis({ pauses: PAUSES2.map((p) => ({ ...p })), faces: [] }) });

describe("review: cut-outside-pause", () => {
  /** Two shots of the take: the first up to `endMs`, the second from `startMs`, the second as `next` says. */
  const twoShots = (endMs: number, startMs: number, next: Partial<Shot> = {}): Edit => ({
    ...cleanEdit(), items: [],
    shots: [newShot({ id: "s1", asset: "take", endMs }), { ...newShot({ id: "s2", asset: "take", startMs, endMs: TAKE_MS }), ...next }],
  });
  /** The take up to `endMs`, then the second take from `startMs` to its end. */
  const twoTakes = (endMs: number, startMs: number): Edit => ({
    ...cleanEdit(), items: [], assets: [take(), take2()],
    shots: [newShot({ id: "s1", asset: "take", endMs }), newShot({ id: "s2", asset: "take2", startMs, endMs: 4000 })],
  });
  const cuts = (edit: Edit, given: Analyses = analyses()) => only(review(edit, given), "cut-outside-pause");

  it("finds a jump cut whose first shot ends in speech, naming the nearest pause's cut", () => {
    expect(cuts(twoShots(1500, 2200))).toEqual([{
      code: "cut-outside-pause", severity: "error", where: { frame: 45, shot: "s2" },
      says: 'the cut into shot "s2" at 1.5 s is outside a pause: shot "s1" ends at 1500 ms of its take, in speech (the nearest pause\'s cut is at 1100 ms)',
    }]);
    expect(cuts(twoShots(1100, 2200))).toEqual([]);
  });

  it("finds a second shot that starts in speech, and a pause's end, where a word starts, is not in it", () => {
    expect(cuts(twoShots(1100, 2600)).map((finding) => finding.says)).toEqual([
      'the cut into shot "s2" at 1.1 s is outside a pause: shot "s2" starts at 2600 ms of its take, in speech (the nearest pause\'s cut is at 2200 ms)',
    ]);
    expect(cuts(twoShots(1100, 2400))).toHaveLength(1);
    expect(cuts(twoShots(1100, 2000))).toEqual([]);
  });

  it("finds a punch-in joined at 1500 ms, and not one joined at 1100 ms", () => {
    const punch = { framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } };
    expect(cuts(twoShots(1500, 1500, punch)).map((finding) => finding.says)).toEqual([
      'the cut into shot "s2" at 1.5 s is outside a pause: shot "s1" ends and shot "s2" starts at 1500 ms of its take, in speech (the nearest pause\'s cut is at 1100 ms)',
    ]);
    expect(cuts(twoShots(1100, 1100, punch))).toEqual([]);
  });

  it("sees no cut where a shot was split and nothing changed: the footage runs on", () => {
    expect(cuts(twoShots(1500, 1500))).toEqual([]);
    expect(cuts(twoShots(1500, 1500, { look: { preset: "warm", adjust: { ...NO_LOOK.adjust } } }))).toHaveLength(1);
    expect(cuts(twoShots(1500, 1500, { volume: 0.5 }))).toHaveLength(1);
    expect(cuts(twoShots(1500, 1500, { speed: 1.5 }))).toHaveLength(1);
  });

  it("finds a transition between two shots of the take out of speech", () => {
    const edit = twoShots(1500, 1500);
    edit.shots[0]!.out = { kind: "fade", frames: 8 };
    expect(cuts(edit)).toHaveLength(1);
  });

  it("finds the film's start in speech; at the file's start or in a pause it is clean", () => {
    const from = (startMs: number) => ({ ...oneShot({ on: false }), shots: [newShot({ id: "s1", asset: "take", startMs, endMs: TAKE_MS })] });
    expect(cuts(from(700))).toEqual([{
      code: "cut-outside-pause", severity: "error", where: { frame: 0, shot: "s1" },
      says: 'the film\'s start is outside a pause: shot "s1" starts at 700 ms of its take, in speech (the nearest pause\'s cut is at 1100 ms)',
    }]);
    expect(cuts(from(0))).toEqual([]);
    expect(cuts(from(1100))).toEqual([]);
  });

  it("finds the film's end in speech; at the file's end or in a pause it is clean", () => {
    const to = (endMs: number) => ({ ...oneShot({ on: false }), shots: [newShot({ id: "s1", asset: "take", endMs })] });
    expect(cuts(to(5000))).toEqual([{
      code: "cut-outside-pause", severity: "error", where: { frame: 149, shot: "s1" },
      says: 'the film\'s end at 5.0 s is outside a pause: shot "s1" ends at 5000 ms of its take, in speech (the nearest pause\'s cut is at 5900 ms)',
    }]);
    expect(cuts(to(TAKE_MS))).toEqual([]);
    expect(cuts(to(5900))).toEqual([]);
  });

  it("passes the film's start at or before the take's first word, and its end at or after its last, in a pause or not (round 0 of Task 4)", () => {
    // No head or tail pause: the take's first word starts at 200 ms, its last ends at 5800; nothing is said before or after.
    const inner = analyses({ pauses: PAUSES.slice(1, 3).map((p) => ({ ...p })) });
    const cut = (startMs: number, endMs: number) => ({ ...oneShot({ on: false }), shots: [newShot({ id: "s1", asset: "take", startMs, endMs })] });
    expect(cuts(cut(100, 5900), inner)).toEqual([]);
    expect(cuts(cut(200, 5800), inner)).toEqual([]);
    expect(cuts(cut(201, 5799), inner).map((finding) => finding.says)).toEqual([
      'the film\'s start is outside a pause: shot "s1" starts at 201 ms of its take, in speech (the nearest pause\'s cut is at 1100 ms)',
      'the film\'s end at 5.6 s is outside a pause: shot "s1" ends at 5799 ms of its take, in speech (the nearest pause\'s cut is at 2200 ms)',
    ]);
    // Only the film's ends: a cut between shots before the first word or after the last is judged on the pauses alone.
    const twoAfter = { ...oneShot({ on: false }), shots: [newShot({ id: "s1", asset: "take", endMs: 5850 }), newShot({ id: "s2", asset: "take", startMs: 5900, endMs: 5950 })] };
    expect(cuts(twoAfter, inner)).toHaveLength(1);
  });

  it("judges a cut between two takes, each side on its own take's pauses", () => {
    expect(cuts(twoTakes(1100, 1600), bothTakes())).toEqual([]);
    expect(cuts(twoTakes(1500, 1600), bothTakes()).map((finding) => finding.says)).toEqual([
      'the cut into shot "s2" at 1.5 s is outside a pause: shot "s1" ends at 1500 ms of its take, in speech (the nearest pause\'s cut is at 1100 ms)',
    ]);
    expect(cuts(twoTakes(1100, 1000), bothTakes()).map((finding) => finding.says)).toEqual([
      'the cut into shot "s2" at 1.1 s is outside a pause: shot "s2" starts at 1000 ms of its take, in speech (the nearest pause\'s cut is at 1600 ms)',
    ]);
    expect(cuts(twoTakes(1500, 1000), bothTakes()).map((finding) => finding.says)).toEqual([
      'the cut into shot "s2" at 1.5 s is outside a pause: shot "s1" ends at 1500 ms of its take, in speech (the nearest pause\'s cut is at 1100 ms), and shot "s2" starts at 1000 ms of its take, in speech (the nearest pause\'s cut is at 1600 ms)',
    ]);
  });

  it("fails every side in a take with words and no measured pauses, and passes every side in a clip with no words", () => {
    expect(cuts(twoShots(1100, 2200), {}).map((finding) => finding.says)).toEqual([
      'the cut into shot "s2" at 1.1 s is outside a pause: shot "s1" ends at 1100 ms of its take, which has no measured pause, and shot "s2" starts at 2200 ms of its take, which has no measured pause',
    ]);
    expect(cuts(twoTakes(1100, 1600), { take: analysis() }).map((finding) => finding.says)).toEqual([
      'the cut into shot "s2" at 1.1 s is outside a pause: shot "s2" starts at 1600 ms of its take, which has no measured pause',
    ]);
    const silent = { ...twoShots(1500, 2600), assets: [{ ...take(), words: null, sound: false }] };
    expect(cuts(silent, analyses({ pauses: [] }))).toEqual([]);
    // Silent B-roll between two cuts of the take: its sides pass anywhere; the take's sides are in pauses.
    const cutaway: Edit = {
      ...cleanEdit(), items: [], assets: [take(), broll],
      shots: [newShot({ id: "s1", asset: "take", endMs: 1100 }), newShot({ id: "b1", asset: "broll", startMs: 500, endMs: 2500 }), newShot({ id: "s2", asset: "take", startMs: 2200, endMs: TAKE_MS })],
    };
    expect(cuts(cutaway)).toEqual([]);
  });
});

describe("review: no-analysis", () => {
  it("warns once for each clip a shot shows that has no analysis, at its first shot, and never for a picture", () => {
    const picture: Asset = { id: "pic", kind: "image", origin: "uploaded", at: { bucket: "edit-media", path: "u1/pic.jpg" }, w: 1080, h: 1920 };
    const edit: Edit = {
      ...cleanEdit(), items: [], assets: [take(), take2(), picture],
      shots: [
        newShot({ id: "s1", asset: "take", endMs: 1100 }), newShot({ id: "s2", asset: "take2", startMs: 1600, endMs: 4000 }),
        newShot({ id: "p1", asset: "pic", endMs: 1000 }), newShot({ id: "s3", asset: "take", startMs: 2200, endMs: TAKE_MS }),
      ],
    };
    expect(only(review(edit, { take2: bothTakes().take2! }), "no-analysis")).toEqual([
      { code: "no-analysis", severity: "warn", where: { frame: 0, shot: "s1" }, says: 'the clip "take" has no analysis; its faces and pauses were not checked' },
    ]);
    expect(only(review(edit, bothTakes()), "no-analysis")).toEqual([]);
    expect(review(edit, bothTakes())).toEqual([]);
  });
});

describe("review: empty-start", () => {
  const picture: Asset = { id: "pic", kind: "image", origin: "uploaded", at: { bucket: "edit-media", path: "u1/pic.jpg" }, w: 1080, h: 1920 };
  const voice: Asset = { id: "voice", kind: "audio", origin: "uploaded", at: { bucket: "edit-media", path: "u1/voice.m4a" }, ms: 3000 };

  it("finds a film whose first shot, a picture shown for 10 ms, fills no frame", () => {
    // The derive functions allow it (the schema does; the door's check refuses a shot under three frames): the film then has no frame 0.
    const edit: Edit = { ...cleanEdit(), assets: [picture], shots: [newShot({ id: "s1", asset: "pic", endMs: 10 })], items: [] };
    expect(momentAt(edit, 0)).toBeNull();
    expect(only(review(edit, {}), "empty-start")).toEqual([{ code: "empty-start", severity: "error", where: { frame: 0 }, says: "the film shows nothing on its first frame: its first shot fills no frame; make it longer" }]);
    expect(checkEdit(edit).length).toBeGreaterThan(0);
  });

  it("finds a first shot that shows a sound, or a file not in the edit", () => {
    const sound: Edit = { ...cleanEdit(), assets: [take(), voice], shots: [newShot({ id: "s1", asset: "voice", endMs: 2000 }), newShot({ id: "s2", asset: "take", endMs: 2000 })], items: [] };
    expect(only(review(sound, analyses()), "empty-start")).toEqual([{ code: "empty-start", severity: "error", where: { frame: 0, shot: "s1" }, says: 'the film shows nothing on its first frame: shot "s1" shows "voice", a sound; start it with a clip or a picture' }]);
    const gone: Edit = { ...cleanEdit(), assets: [take()], shots: [newShot({ id: "s1", asset: "ghost", endMs: 2000 })], items: [] };
    expect(only(review(gone, analyses()), "empty-start").map((finding) => finding.says)).toEqual(['the film shows nothing on its first frame: shot "s1" shows "ghost", which is not in the edit; start it with a clip or a picture']);
    expect(checkEdit(sound).length).toBeGreaterThan(0);
    expect(checkEdit(gone).length).toBeGreaterThan(0);
  });

  it("finds footage on frame 0 of every edit the door lets through", () => {
    for (const edit of [fixture(), cleanEdit(), through(fixture(), [{ op: "shot.remove", id: "s1" }]), through(cleanEdit(), [{ op: "shot.move", id: "s2", after: null }])]) {
      expect(checkEdit(edit)).toEqual([]);
      expect(only(review(edit, analyses()), "empty-start")).toEqual([]);
    }
  });
});

describe("review: short-text (Task 14)", () => {
  const clear = { x: 0.5, y: 0.2 };

  it("warns of a call-out on screen for less than 0.8 s, once, with how long it shows and what to do", () => {
    const edit = oneShot({ on: false }, { marks: [callout("c1", 1000, clear, 300)] });
    expect(only(review(edit, analyses()), "short-text")).toEqual([{
      code: "short-text", severity: "warn", where: { frame: 30, shot: "s1", mark: "c1" },
      says: 'the call-out "SAVE" at 1.0 s shows for 0.3 s, too short to read; let it stay 0.8 s or longer',
    }]);
  });

  it("lets one of 0.8 s pass, and warns one frame under it", () => {
    expect(SHORTEST_READ_MS).toBe(800);
    const lasting = (lenMs: number) => only(review(oneShot({ on: false }, { marks: [callout("c1", 1000, clear, lenMs)] }), analyses()), "short-text");
    expect(lasting(800)).toEqual([]);
    expect(lasting(767)).toHaveLength(1); // 23 frames
  });

  it("warns of a call-out its shot's end cuts short, by the frames it shows", () => {
    // Asked for 1.2 s, 400 ms before its shot ends: a call-out ends with its footage.
    const edit: Edit = {
      ...oneShot({ on: false }),
      shots: [{ ...newShot({ id: "s1", asset: "take", endMs: 1100 }), marks: [callout("c1", 700, clear, 1200)] }, newShot({ id: "s2", asset: "take", startMs: 2200, endMs: TAKE_MS })],
    };
    expect(only(review(edit, analyses()), "short-text").map((finding) => finding.says)).toEqual(['the call-out "SAVE" at 0.7 s shows for 0.4 s, too short to read; let it stay 0.8 s or longer']);
  });

  it("warns of a title too, and of nothing else: not a progress bar, not the captions", () => {
    const item = (id: string, part: "title" | "progress", frames: number): Item =>
      part === "title" ? { id, part, anchor: "start", at: 30, frames, props: { ...titleProps } } : { id, part, anchor: "start", at: 30, frames, props: { edge: "top", color: "#ffffff" } };
    const edit: Edit = { ...oneShot({ y: 0.3 }), items: [item("t1", "title", 12), item("bar", "progress", 12)] };
    expect(only(review(edit, analyses()), "short-text").map((finding) => finding.where)).toEqual([{ frame: 30, item: "t1" }]);
  });
});

describe("review: mark-hidden", () => {
  it("warns of a mark whose moment a later trim cut away", () => {
    expect(only(review(fixture(), {}), "mark-hidden")).toEqual([]);
    const trimmed = through(fixture(), [{ op: "shot.trim", id: "s2", startMs: 9000 }]);
    // The whoosh at the shot's old start goes with it.
    expect(only(review(trimmed, {}), "mark-hidden")).toEqual([
      {
        code: "mark-hidden", severity: "warn", where: { frame: 150, shot: "s2", mark: "m1" },
        says: 'the call-out "Virtuna" is at 8.9 s of its take, which shot "s2" no longer shows (it shows 9.0 to 12.0 s); move it into the shot or show that moment again',
      },
      {
        code: "mark-hidden", severity: "warn", where: { frame: 150, shot: "s2", mark: "w1" },
        says: 'the sound "w1" is at 8.0 s of its take, which shot "s2" no longer shows (it shows 9.0 to 12.0 s); move it into the shot or show that moment again',
      },
    ]);
  });

  it("warns of a mark past its shot's end, which does not show at all", () => {
    const trimmed = through(fixture(), [{ op: "shot.trim", id: "s2", endMs: 8500 }]);
    expect(only(review(trimmed, {}), "mark-hidden").map((finding) => [finding.where.mark, finding.where.frame])).toEqual([["m1", 150]]);
  });
});

describe("review: fade-both", () => {
  const faded = (middleMs: number): Edit => ({
    ...cleanEdit(), items: [],
    shots: [
      { ...newShot({ id: "s1", asset: "take", endMs: 1100 }), out: { kind: "fade", frames: 12 } },
      { ...newShot({ id: "s2", asset: "take", startMs: 2200, endMs: 2200 + middleMs }), out: { kind: "push", frames: 12, from: "right" } },
      newShot({ id: "s3", asset: "take", startMs: 4000, endMs: TAKE_MS }),
    ],
  });

  it("warns of a shot shorter than its transitions in and out together", () => {
    const edit = faded(600); // 18 frames, with 12 in and 12 out
    expect(checkEdit(edit)).toEqual([]);
    expect(only(review(edit, analyses()), "fade-both")).toEqual([{
      code: "fade-both", severity: "warn", where: { frame: 21, shot: "s2" },
      says: 'shot "s2" at 0.7 s is 18 frames long, shorter than its transitions in (12) and out (12) together, so it fades in and out at once; make it longer or its transitions shorter',
    }]);
    expect(only(review(faded(800), analyses()), "fade-both")).toEqual([]); // 24 frames: the two meet and do not overlap
  });
});

describe("review: soft-zoom", () => {
  it("warns of a 720x1280 take zoomed past 1.33, twice its own pixels", () => {
    const at = (zoom: number) => oneShot({ on: false }, { framing: { from: { zoom, x: 0, y: 0 }, move: null } });
    expect(only(review(at(1.5), analyses()), "soft-zoom")).toEqual([{
      code: "soft-zoom", severity: "warn", where: { frame: 0, shot: "s1" },
      says: 'shot "s1" at 0.0 s is zoomed to 1.50, more than twice its take\'s own pixels; zoom out to 1.33 or less',
    }]);
    expect(only(review(at(1.3), analyses()), "soft-zoom")).toEqual([]);
  });

  it("warns from the frame a slow zoom passes the limit", () => {
    const moving = oneShot({ on: false }, { framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 2, x: 0, y: 0 }, ease: "linear", part: [0, 1] } } });
    // Linear from 1 at 0 ms to 2 at 6000 ms: past 1.333 after 2000 ms, so from frame 61.
    expect(only(review(moving, analyses()), "soft-zoom").map((finding) => [finding.where.frame, finding.says])).toEqual([[61, 'shot "s1" at 2.0 s is zoomed to 1.99, more than twice its take\'s own pixels; zoom out to 1.33 or less']]);
  });

  it("allows a 1080x1920 take twice the zoom, and a landscape take less", () => {
    const tall = { ...oneShot({ on: false }, { framing: { from: { zoom: 1.9, x: 0, y: 0 }, move: null } }), assets: [take({ w: 1080, h: 1920 })] };
    expect(only(review(tall, analyses()), "soft-zoom")).toEqual([]);
    const wide = { ...oneShot({ on: false }, { framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } }), assets: [take({ w: 1920, h: 1080 })] };
    expect(only(review(wide, analyses()), "soft-zoom").map((finding) => finding.says)).toEqual(['shot "s1" at 0.0 s is zoomed to 1.20, more than twice its take\'s own pixels; zoom out to 1.12 or less']);
  });
});

describe("review: text the server cannot measure exactly (final fix wave)", () => {
  it("judges a call-out with an emoji at the widest letter's width, and notes the character once", () => {
    const edit = oneShot({ on: false }, { marks: [callout("c1", 1000, { text: "Wow 👋", x: 0.95, y: 0.6 })] });
    const findings = review(edit, analyses({ faces: [] }));
    expect(only(findings, "unmeasured")).toEqual([{
      code: "unmeasured", severity: "warn", where: { frame: 30, shot: "s1", mark: "c1" },
      says: 'the call-out "Wow 👋" at 1.0 s holds "👋", which the width tables lack; it was judged as wide as the widest letter',
    }]);
    // Judged as any other: held by its x of 0.95 against the right edge, it sits under TikTok's right-side buttons.
    expect(only(findings, "under-buttons").map((finding) => finding.where)).toContainEqual({ frame: 30, shot: "s1", mark: "c1" });
  });

  it("judges captions with an emoji word, every run, and notes the character once", () => {
    const words = [...WORDS.slice(0, 2), { text: "👋", startMs: 1200, endMs: 1500 }, ...WORDS.slice(3)];
    const edit: Edit = {
      ...oneShot({ y: 0.8 }), assets: [take({ words })],
      shots: [newShot({ id: "s1", asset: "take", endMs: 1500 }), newShot({ id: "s2", asset: "take", startMs: 2000, endMs: TAKE_MS })],
    };
    const findings = review(edit, analyses());
    expect(only(findings, "unmeasured")).toEqual([{ code: "unmeasured", severity: "warn", where: { frame: 6, shot: "s1" }, says: 'the captions at 0.2 s hold "👋", which the width tables lack; they were judged as wide as the widest letter' }]);
    // The first run's captions, with the emoji, are judged too: on the mouth at 0.8, from the run's first page.
    expect(only(findings, "on-face").map((finding) => [finding.severity, finding.where])).toEqual([["error", { frame: 6, shot: "s1" }]]);
  });

  it("finds captions on the mouth whatever their words: Brand, Brand™, Brașov and a decomposed naïve alike", () => {
    for (const text of ["Brand", "Brand™", "Brașov", "nai\u0308ve"]) {
      const words = WORDS.map((word, i) => (i === 1 ? { ...word, text } : { ...word }));
      const found = only(review({ ...oneShot({ y: 0.8 }), assets: [take({ words })] }, analyses()), "on-face");
      expect(found.map((finding) => finding.severity), text).toEqual(["error"]);
    }
  });
});

describe("textErrorFrames: the frames of each text's on-face and under-buttons errors (for the recipes)", () => {
  const frames = (map: Map<string, Set<number>>, key: string) => [...(map.get(key) ?? [])];

  it("gives a call-out over the eyes every frame a face stands for, and none where the sample found no face", () => {
    // Frames 84 to 98, at 1214 to 1320 px: in the face's upper half (1152 to 1440), clear of every zone.
    // The sample at 2800 ms (frame 84) finds the face; the one at 3000 ms (frame 90) finds none.
    const edit = oneShot({ on: false }, { marks: [callout("c1", 2800, { x: 0.5, y: 0.66 }, 500)] });
    expect(frames(textErrorFrames(edit, analyses()), "c1")).toEqual([84, 85, 86, 87, 88, 89]);
  });

  it("counts every frame of captions under an app's zone, and none for a chin touch or a clear place", () => {
    // Under both bottom bars, with no face: every frame a caption page shows on, and no other.
    const edit = oneShot({ y: 0.8 });
    const run = layout(edit).runs[0]!;
    const shownOn = pagesFor(edit.captions, runWords(edit, run), run.frames).flatMap((page) => Array.from({ length: page.to - page.from }, (_, i) => run.at + page.from + i));
    expect(frames(textErrorFrames(edit, analyses({ faces: [] })), CAPTIONS).sort((a, b) => a - b)).toEqual([...new Set(shownOn)].sort((a, b) => a - b));
    // A face higher up (576 to 1152 px, its mouth 960 to 1056): one row centred at 1110 px touches the chin only, clear of every zone.
    const high = analyses({ faces: FACES.map((sample) => ({ ...sample, face: sample.face && { x: 0.2, y: 0.3, w: 0.6, h: 0.3 }, mouth: sample.mouth && { x: 0.4, y: 0.5, w: 0.2, h: 0.05 } })) });
    const chin = oneShot({ y: 1110 / 1920 });
    expect(only(review(chin, high), "on-face").map((finding) => finding.severity)).toEqual(["warn"]);
    expect(only(review(chin, high), "under-buttons")).toEqual([]);
    expect(textErrorFrames(chin, high).get(CAPTIONS)).toBeUndefined();
    expect(textErrorFrames(oneShot({ y: 0.3 }), analyses()).get(CAPTIONS)).toBeUndefined();
  });

  it("agrees with review: the captions have error frames exactly when review gives them an on-face or under-buttons error", () => {
    for (let i = 1; i < 20; i++) {
      const edit = oneShot({ y: i / 20 });
      const errors = review(edit, analyses()).filter((finding) => finding.severity === "error" && (finding.code === "on-face" || finding.code === "under-buttons") && !finding.where.mark && !finding.where.item);
      const counted = frames(textErrorFrames(edit, analyses()), CAPTIONS);
      expect([i / 20, counted.length > 0]).toEqual([i / 20, errors.length > 0]);
      // review names the first error frame of each of its findings; each is one of the counted frames
      for (const finding of errors) expect(counted).toContain(finding.where.frame);
    }
  });

  it("leaves the progress bar out, as review does", () => {
    const edit = { ...oneShot({ on: false }), items: [{ id: "bar", part: "progress", anchor: "start", at: 0, frames: null, props: { edge: "bottom", color: "#ffffff" } } satisfies Item] };
    expect(textErrorFrames(edit, analyses()).get("bar")).toBeUndefined();
  });
});

describe("zoomLimit: review's soft-zoom limit, for the recipes", () => {
  it("is 2 over the cover fit's scale", () => {
    expect(zoomLimit({ w: 720, h: 1280 })).toBeCloseTo(4 / 3, 12);
    expect(zoomLimit({ w: 1080, h: 1920 })).toBe(2);
    expect(zoomLimit({ w: 1920, h: 1080 })).toBeCloseTo(1.125, 12);
  });
});

describe("review: the weights (2026-11-24)", () => {
  it("judges captions and titles at every weight the schema allows, in every typeface", () => {
    for (const font of FONTS) {
      for (const weight of WEIGHTS) {
        const edit = cleanEdit();
        edit.captions = { ...edit.captions, font, weight };
        edit.items = edit.items.map((item) => (item.part === "title" ? { ...item, props: { ...item.props, font, weight } } : item));
        const at = `${font} ${weight}`;
        expect(checkEdit(edit), at).toEqual([]);
        expect(only(review(edit, analyses()), "unmeasured"), at).toEqual([]);
      }
    }
  });
});
