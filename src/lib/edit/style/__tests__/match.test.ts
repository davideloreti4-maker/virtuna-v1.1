/**
 * The match check (part 3, Task 9): an edit made from a made-up take with known settings, through the real recipes and the
 * door, read back field by field.
 */
import { describe, expect, it } from "vitest";
import type { Analyses, FaceSample, Pause } from "../../analysis";
import { DEFAULT_CAPTIONS, NO_LOOK, STAGE, newShot, type Asset, type Edit, type Word } from "../../doc";
import { applyOps, type Op } from "../../ops";
import { punchIns, tighten } from "../../recipes";
import { matchOf, profileOf, type Match } from "../match";
import type { StyleProfile } from "../profile";

/* ── a made-up take: 69.3 s, a 300 ms head, 21 phrases of 2.7 s with 600 ms pauses between them, a 300 ms tail ──────────── */

const pause = (startMs: number, endMs: number): Pause => ({ startMs, endMs, cutMs: Math.round((startMs + endMs) / 2) });
const PAUSES: Pause[] = [pause(0, 300)];
const WORDS: Word[] = [];
let at = 300;
for (let k = 0; k < 21; k++) {
  for (let w = 0; w < 6; w++) WORDS.push({ text: `w${k}-${w}`, startMs: at + w * 450, endMs: at + (w + 1) * 450 });
  at += 2700;
  const quiet = k < 20 ? 600 : 300;
  PAUSES.push(pause(at, at + quiet));
  at += quiet;
}
const TAKE: Asset = { id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" }, ms: at, w: 720, h: 1280, sound: true, words: WORDS };
/** A face a little left of centre, 0.30 to 0.55 of the height, five samples a second. */
const FACES: FaceSample[] = Array.from({ length: Math.ceil(at / 200) }, (_, i) => ({
  ms: i * 200, face: { x: 0.22, y: 0.3, w: 0.3, h: 0.25 }, mouth: { x: 0.32, y: 0.48, w: 0.1, h: 0.04 },
}));
const ANALYSES: Analyses = { take: { language: "en", pauses: PAUSES, faces: FACES, loudness: null } };

const through = (edit: Edit, ops: Op[]): Edit => {
  if (ops.length === 0) return edit;
  const made = applyOps(edit, ops, edit.assets);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};

/** The take tightened at 200 ms (60.9 s, 20 cuts), punched in at 6 a minute at 1.15, its captions, title and look set. */
function made(): Edit {
  const whole: Edit = { v: 1, kit: "1", stage: { ...STAGE }, assets: [TAKE], shots: [newShot({ id: "s1", asset: "take", endMs: TAKE.kind === "video" ? TAKE.ms : 0 })], items: [], captions: { ...DEFAULT_CAPTIONS, y: 0.72 }, look: structuredClone(NO_LOOK), cover: null };
  const cut = through(whole, tighten(whole, ANALYSES, { pauseMs: 200 }));
  const punched = through(cut, punchIns(cut, ANALYSES, { perMin: 6, zoom: 1.15 }));
  return through(punched, [
    { op: "captions.set", look: "highlight", font: "montserrat", size: 80, y: 0.7, maxWords: 2, highlight: "#ffe14a" },
    { op: "item.add", item: { id: "hook", part: "title", anchor: "start", at: 0, frames: 60, props: { text: "Three things", font: "tiktok", look: "label", y: 0.18, size: 110, color: "#ffffff", accent: null } } },
    { op: "look.set", preset: "warm" },
  ]);
}

const TARGET: StyleProfile = {
  source: { kind: "preset", name: "a test" },
  pace: { pauseMs: 200, cutsPerMin: 19.7 },
  captions: { on: true, look: "highlight", font: "montserrat", size: 80, y: 0.7, maxWords: 2, highlight: "#ffe14a" },
  title: { on: true, y: 0.18, frames: 60, look: "label", size: 110 },
  punchIns: { perMin: 6, zoom: 1.15 },
  look: { preset: "warm" },
  notMatched: ["emoji", "a whoosh"],
};
/** The made edit's quiet share: its 20 pauses kept at 200 ms over its spoken span (X104). */
const QUIET = Math.round((20 * 200 * 1000) / 60_700) / 1000;
const verdicts = (fields: Match[]) => Object.fromEntries(fields.map((field) => [field.field, field.verdict]));

describe("profileOf: an edit's own style, read back", () => {
  it("reads the pause it keeps, its cuts a minute, its captions, its opening title, its punch-ins and its look", () => {
    const edit = made();
    expect(edit.shots).toHaveLength(21);
    expect(profileOf(edit, ANALYSES)).toEqual({
      // 20 cuts in 60.9 s; 20 pauses of 200 ms quiet in the 60.7 s spoken, from the head's 100 ms to the tail's (X104).
      pace: { pauseMs: 200, cutsPerMin: 19.7, quiet: QUIET },
      captions: { on: true, look: "highlight", font: "montserrat", size: 80, y: 0.7, maxWords: 2, highlight: "#ffe14a" },
      title: { on: true, y: 0.18, frames: 60, look: "label", size: 110 },
      punchIns: { perMin: 5.91, zoom: 1.15 }, // 6 in 60.9 s
      look: { preset: "warm" },
    });
  });

  it("gives no title, no punch-ins and no cuts for the take whole, and its own pauses' median", () => {
    const whole: Edit = { v: 1, kit: "1", stage: { ...STAGE }, assets: [TAKE], shots: [newShot({ id: "s1", asset: "take", endMs: TAKE.kind === "video" ? TAKE.ms : 0 })], items: [], captions: { ...DEFAULT_CAPTIONS }, look: structuredClone(NO_LOOK), cover: null };
    expect(profileOf(whole, ANALYSES)).toMatchObject({ pace: { pauseMs: 400, cutsPerMin: 0 }, title: null, punchIns: null, look: { preset: "natural" } });
  });

  it("counts a title that starts after the opening's five seconds as no opening title", () => {
    const late = through(made(), [{ op: "item.set", id: "hook", at: 160 }]);
    expect(profileOf(late, ANALYSES).title).toBeNull();
  });

  it("reads a title held to the film's end as one that stays, its frames held to the profile's 600 (Task 9c)", () => {
    const held = through(made(), [{ op: "item.set", id: "hook", frames: null }]);
    expect(profileOf(held, ANALYSES).title).toEqual({ on: true, y: 0.18, frames: 600, look: "label", size: 110, stays: true });
    expect(profileOf(made(), ANALYSES).title).not.toHaveProperty("stays");
  });
});

describe("matchOf: an edit against a style, field by field", () => {
  it("finds every field of the edit made with known settings matched, and lists the style's notMatched", () => {
    const { fields, notMatched } = matchOf(TARGET, made(), ANALYSES);
    expect(fields.filter((field) => field.verdict !== "matched")).toEqual([]);
    expect(Object.keys(verdicts(fields))).toEqual([
      "pace.pauseMs", "captions.on", "captions.look", "captions.font", "captions.size", "captions.y", "captions.maxWords", "captions.highlight",
      "title", "title.y", "title.frames", "title.look", "title.size", "punchIns", "punchIns.perMin", "punchIns.zoom", "look.preset",
    ]);
    expect(notMatched).toEqual(["emoji", "a whoosh"]);
    // The cuts a minute are not compared (Task 14b): a single take cannot meet a reference's cuts between scenes. The profile keeps the number.
    expect(TARGET.pace.cutsPerMin).toBe(19.7);
    expect(matchOf({ ...TARGET, pace: { ...TARGET.pace, cutsPerMin: 60 } }, made(), ANALYSES).fields.map((field) => field.field)).not.toContain("pace.cutsPerMin");
    expect(profileOf(made(), ANALYSES).pace.cutsPerMin).not.toBeNull();
  });

  it("says not for a caption y off by 0.08, and near for one off by 0.03 (§7's 0.05)", () => {
    const off = (y: number) => matchOf({ ...TARGET, captions: { ...TARGET.captions, y } }, made(), ANALYSES).fields.find((field) => field.field === "captions.y");
    expect(off(0.78)).toEqual({ field: "captions.y", target: "0.78", actual: "0.7", verdict: "not" });
    expect(off(0.73)?.verdict).toBe("near");
  });

  it("compares the quiet share in place of the pause when the style has one (X104): matched within 10 % or 0.01, near within 20 % or 0.02", () => {
    const quiet = (share: number) => matchOf({ ...TARGET, pace: { ...TARGET.pace, quiet: share } }, made(), ANALYSES).fields;
    const keys = Object.keys(verdicts(quiet(QUIET)));
    expect(keys.slice(0, 2)).toEqual(["pace.quiet", "captions.on"]);
    expect(keys).not.toContain("pace.pauseMs");
    expect(quiet(QUIET).find((field) => field.field === "pace.quiet")).toEqual({ field: "pace.quiet", target: String(QUIET), actual: String(QUIET), verdict: "matched" });
    const verdict = (share: number) => verdicts(quiet(share))["pace.quiet"];
    // QUIET is 0.066: 10 % is under 0.01, so 0.01 and 0.02 hold.
    expect([verdict(QUIET + 0.009), verdict(QUIET + 0.015), verdict(QUIET + 0.025)]).toEqual(["matched", "near", "not"]);
    // Far off: not.
    expect(verdict(0.3)).toBe("not");
    // With quiet null, the pause as before.
    expect(Object.keys(verdicts(matchOf({ ...TARGET, pace: { ...TARGET.pace, quiet: null } }, made(), ANALYSES).fields))[0]).toBe("pace.pauseMs");
  });

  it("says near within §7's 15 % of the pace and 0.5 s of the title, and not past them", () => {
    const pace = (pauseMs: number) => verdicts(matchOf({ ...TARGET, pace: { ...TARGET.pace, pauseMs } }, made(), ANALYSES).fields)["pace.pauseMs"];
    expect([pace(200), pace(220), pace(240)]).toEqual(["matched", "near", "not"]);
    const title = (frames: number) => verdicts(matchOf({ ...TARGET, title: { ...TARGET.title!, frames } }, made(), ANALYSES).fields)["title.frames"];
    expect([title(62), title(75), title(76)]).toEqual(["matched", "near", "not"]);
  });

  it("calls a bold title against an outline one near, either way, and a label against either not (Task 9c, fix round 2)", () => {
    const look = (target: "bold" | "outline" | "label", drawn: "bold" | "outline" | "label") =>
      verdicts(matchOf({ ...TARGET, title: { ...TARGET.title!, look: target } }, through(made(), [{ op: "item.set", id: "hook", props: { look: drawn } }]), ANALYSES).fields)["title.look"];
    expect([look("bold", "outline"), look("outline", "bold"), look("bold", "bold")]).toEqual(["near", "near", "matched"]);
    expect([look("label", "bold"), look("outline", "label")]).toEqual(["not", "not"]);
  });

  it("compares whether the title stays when the style says, and then not its length (Task 9c)", () => {
    const stays = { ...TARGET, title: { ...TARGET.title!, frames: 600, stays: true } };
    const held = through(made(), [{ op: "item.set", id: "hook", frames: null }]);
    expect(verdicts(matchOf(stays, held, ANALYSES).fields)).toMatchObject({ "title.stays": "matched" });
    expect(verdicts(matchOf(stays, held, ANALYSES).fields)["title.frames"]).toBeUndefined();
    expect(verdicts(matchOf(stays, made(), ANALYSES).fields)["title.stays"]).toBe("not");
    const gone = { ...TARGET, title: { ...TARGET.title!, stays: false } };
    expect(verdicts(matchOf(gone, made(), ANALYSES).fields)).toMatchObject({ "title.stays": "matched", "title.frames": "matched" });
    expect(verdicts(matchOf(gone, held, ANALYSES).fields)["title.stays"]).toBe("not");
  });

  it("compares the title's and the punch-ins' presence, and leaves out the cuts when the style says nothing of them", () => {
    const fields = matchOf({ ...TARGET, pace: { ...TARGET.pace, cutsPerMin: null }, title: null, punchIns: null, look: { preset: "mono" } }, made(), ANALYSES).fields;
    const by = verdicts(fields);
    expect(by["pace.cutsPerMin"]).toBeUndefined();
    expect([by.title, by.punchIns, by["look.preset"]]).toEqual(["not", "not", "not"]);
    expect(by["title.y"]).toBeUndefined();
    expect(fields.find((field) => field.field === "title")).toMatchObject({ target: "none", actual: "2.0 s at 0.18" });
  });

  it("with the style's captions off, compares only whether they are on", () => {
    const by = verdicts(matchOf({ ...TARGET, captions: { ...TARGET.captions, on: false } }, made(), ANALYSES).fields);
    expect(by["captions.on"]).toBe("not");
    expect(by["captions.look"]).toBeUndefined();
  });

  it("says near for another highlight colour, and not for none", () => {
    const highlight = (colour: string | null) => verdicts(matchOf({ ...TARGET, captions: { ...TARGET.captions, highlight: colour } }, made(), ANALYSES).fields)["captions.highlight"];
    expect([highlight("#FFE14A"), highlight("#4ade80"), highlight(null)]).toEqual(["matched", "near", "not"]);
  });
});
