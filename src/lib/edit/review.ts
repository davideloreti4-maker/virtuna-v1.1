/**
 * review.ts — what would look wrong in an edit, read against what the worker measured of its takes
 * (the part-3 design, §4). Pure: an edit and its takes' analyses in, findings out, the same every
 * time, in the order of the frames they are on. The agent must clear every error and tries to clear
 * the warnings; the editor's strip shows them as marks.
 *
 * Every text is judged by the box the kit draws it in (`src/edit/film/layout.ts`, X91), measured
 * with the server's width tables (`measure.ts`, X90): every caption page of a run together, as
 * Film.tsx builds them, each title, call-out and progress bar. A box is at rest: it leaves out
 * outline strokes, shadows and the parts' motion, and two boxes count as overlapping only when they
 * share at least 4 % of the text's box, which absorbs them (`under-buttons` is graded, below). Text is measured as NFC, and a
 * character the tables do not have (an emoji, "™") is taken as wide as the font's widest letter (`measureWide`), so the box
 * errs wide and the text is judged as any other; it also gets one `unmeasured` warning, a note (the final fix wave: one such
 * character used to leave a whole run of captions unjudged, on the mouth and unsaid).
 *
 * The rules, as built:
 * - on-face: a text's box over the face (X48) on any frame the text shows on. Each face sample
 *   stands for the frames from its own up to the next sample's (the last one before a run's start
 *   for the run's first frames), so a text shorter than the samples' spacing, or in a slow shot, is
 *   judged too. The face is placed through the cover fit and the framing shown on each frame
 *   (`stage.ts`), and graded by what the text covers (round-0c
 *   ruling, and the final fix wave): an error anywhere from the brow to the lower lip. It "covers the
 *   mouth" when it covers 25 % or more of the mouth's box; it "covers the eyes" when 4 % or more of
 *   its own box lies in the face's upper half; it "covers the nose" when 4 % or more of its box lies
 *   between that half and the lower lip (the mouth's box's bottom; `LIP` down a face with no mouth
 *   found, as the agent's room takes it). A warning for any other overlap of 4 % of its box with the
 *   face: below the lip, the chin ("touches the chin"). Creators set captions over the chin and the
 *   neck; the eyes, the nose and the mouth are never to be covered. Footage under a cutaway is hidden, so its faces are
 *   not looked at; nor on the shared frames of a transition that moves the footage itself: a push
 *   (it slides) and a punch (it scales), where the face is not where the framing puts it. A fade
 *   blends and a wipe, an iris or a clock clips with a mask: the face stays where the framing puts
 *   it, so both runs' faces count there. A take with no analysis has no faces.
 * - under-buttons: a text's box under one of TikTok's or Instagram's zones (`zones.ts`), graded
 *   (round-0b ruling Z3): an error when the zone covers 15 % or more of the box, a warning that the
 *   text touches it from 4 %. Creators' captions often touch the description's top or the icons'
 *   side and are still read; a caption hidden under them is the fault. A progress bar is exempt: a
 *   thin edge with no words, made to sit under the apps' bars (round-0 ruling P).
 * - on-text (error; Task 10b): a title or a call-out that another text shown on the same frame (a caption page, or another
 *   title or call-out) comes within 0.012 of the stage's height (23 px) of, above or below: any overlap at all between its box,
 *   grown by that much above and below, and the other's box; no 4 % allowance for this finding (Task 10's fix rounds 3 and 5:
 *   texts do not touch). Captions are never the one reported: the part is, at the first frame it happens on. A progress bar
 *   carries no words and is left out.
 * - text-fits (error): a text the kit had to set smaller than its schema's smallest size (captions
 *   and call-outs 44 px, titles 48) to fit it in: its box, its row or its three lines.
 * - caption-rows (warn; Task K1): a caption page set in more than three rows (`MOST_ROWS`): a page may hold a whole short
 *   sentence in two or three; past that it covers too much of the picture. Once for the film, at the first such page.
 * - two-titles (error): two titles showing on one frame.
 * - cut-outside-pause (error): a side of a cut outside a measured pause [start, end) of its own
 *   clip (X54): a pause's end is where a word starts, which is never a cut point. The sides are the
 *   film's start (the first shot's start), its end (the last shot's end), and both sides of every cut
 *   between two shots, of one clip or of two (round-0 ruling C). A cut between shots of one clip is a
 *   join where the footage does not run on, or runs on with another framing, look or volume; a shot
 *   split in two and left alone is not one. A side passes at its clip's very start (0) or end, and
 *   in a clip with no words (a picture, silent B-roll); a clip with words and no measured pauses
 *   (no analysis) has every side fail (N3). The film's start also passes at or before its clip's
 *   first word, and its end at or after its clip's last: there is no speech there to cut through,
 *   pause or not (Task 4's round 0, ruling 2). A cut between shots does not.
 * - empty-start (error): no footage on frame 0: the film has no frame (its first shot fills none),
 *   or the shot there shows a sound, a file not in the edit, or a moment past its clip's end. The
 *   door refuses all of these (`checkEdit`), so it finds them only in an edit that did not pass it.
 * - short-text (warn; Task 14): a title or a call-out on screen for less than 0.8 s (`SHORTEST_READ_MS`): a part takes
 *   0.4 s to come in, so under that it is gone before it is read. The agent set call-outs for 0.3 s and they passed.
 * - mark-hidden (warn): a mark at a moment its shot's footage no longer shows (`frameOf` is null).
 * - fade-both (warn): footage shorter than its transitions in and out together.
 * - soft-zoom (warn): a shot enlarging its file more than twice its own pixels: a zoom past
 *   2 ÷ the cover fit's scale (part 1's measure, 2 × 720 / 1080 = 1.33 for a 720×1280 take).
 * - unmeasured (warn): see above.
 * - no-analysis (warn): a clip a shot shows that `analyses` lacks: its faces and pauses were not
 *   checked (round-0 ruling A). Pictures have no analysis and are not named.
 *
 * One finding per thing and per check, at the first frame it happens on: per mark or item, and for
 * the captions, which are one setting for the whole film, once for the film. A finding's `says` is
 * one sentence: the thing, the moment in seconds on the film, and the way to fix it.
 */
import { calloutBox, captionPages, progressBox, titleBox, type Box, type Measure } from "../../edit/film/layout";
import { pagesFor } from "../../edit/film/pages";
import type { Analyses, TakeAnalysis } from "./analysis";
import { assetOf, captionFrames, frameOf, framingAt, layout, lookOf, momentAt, momentOf, overlapOf, placed, runWords, runsOn, sharedAfter, shotOn, type Layout, type Placed, type Run } from "./derive";
import { CaptionsSchema, STAGE, type Edit, type Item, type Look, type Mark, type Shot } from "./doc";
import { measureWide, type FontId } from "./measure";
import { PARTS } from "./parts";
import { faceOnStage } from "./stage";
import { FPS, frameAt } from "./time";
import { ZONES, type Zone } from "./zones";

export type FindingCode =
  | "on-face" | "under-buttons" | "on-text" | "text-fits" | "two-titles" | "cut-outside-pause" | "empty-start"
  | "short-text" | "mark-hidden" | "fade-both" | "soft-zoom" | "caption-rows" | "unmeasured" | "no-analysis";

export interface Finding {
  code: FindingCode;
  severity: "error" | "warn";
  where: { frame: number; shot?: string; mark?: string; item?: string };
  says: string;
}

const SEVERITY: Record<FindingCode, Finding["severity"]> = {
  "on-face": "error", "under-buttons": "error", "on-text": "error", "text-fits": "error", "two-titles": "error", "cut-outside-pause": "error", "empty-start": "error",
  "short-text": "warn", "mark-hidden": "warn", "fade-both": "warn", "soft-zoom": "warn", "caption-rows": "warn", unmeasured: "warn", "no-analysis": "warn",
};
/** Within a frame, findings come in this order: SEVERITY's. */
const CODES = Object.keys(SEVERITY) as FindingCode[];

/** How much of a text's box another box must cover to count: 4 %. */
const OVERLAP = 0.04;
/** How much of a text's box an app's zone must cover for the text to be hidden, not touching: 15 %. */
const HIDDEN = 0.15;
/** How much of the mouth's box a text must cover for the mouth to be named: 25 %. */
const MOUTH = 0.25;
/** Where the lower lip is down a face whose mouth was not found: nine tenths of the way, as the agent's room takes it. */
const LIP = 0.9;
/** What two framings may differ by and still be one. */
const SAME = 1e-9;
/** The most rows a caption page may be set in before `caption-rows` warns: a whole short sentence takes two or three. */
export const MOST_ROWS = 3;
/** The shortest a title or a call-out may show before `short-text` warns: it comes in over 0.4 s and is read in the rest. */
export const SHORTEST_READ_MS = 800;
/** A count of rows as `says` writes it. */
const COUNTS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];

const smallest = (size: number | null): number => {
  if (size === null) throw new Error("a text's size has no smallest value in its schema");
  return size;
};
/** The smallest size each text may be set in, from the schemas: what stays readable on a phone. */
const SMALLEST = {
  captions: smallest(CaptionsSchema.shape.size.minValue),
  title: smallest(PARTS.title.props.shape.size.minValue),
  callout: smallest(PARTS.callout.props.shape.size.minValue),
};
const APP: Record<Zone["app"], string> = { tiktok: "TikTok", instagram: "Instagram" };

type Where = Omit<Finding["where"], "frame">;
/** The captions' key among the findings and in `textErrorFrames`: no id can be it (`IdSchema` allows no brackets), so a mark named "captions" is a thing of its own. */
export const CAPTIONS = "(captions)";

/** The findings so far: one per key, the worst, then the earliest. */
class Findings {
  private readonly kept = new Map<string, Finding>();

  /** `severity` is the code's own unless given (`under-buttons` is graded). */
  add(key: string, code: FindingCode, where: Finding["where"], says: string, severity = SEVERITY[code]): void {
    const held = this.kept.get(key);
    const worse = held && held.severity === "warn" && severity === "error";
    const earlier = held && held.severity === severity && where.frame < held.where.frame;
    if (!held || worse || earlier) this.kept.set(key, { code, severity, where, says });
  }

  /** By frame, then by code; otherwise in the order they were found. */
  list(): Finding[] {
    return [...this.kept.values()].sort((a, b) => a.where.frame - b.where.frame || CODES.indexOf(a.code) - CODES.indexOf(b.code));
  }
}

/** Everything that would look wrong in the edit, against its takes' analyses (by asset id). */
export function review(edit: Edit, analyses: Analyses): Finding[] {
  const lay = layout(edit);
  const things = placed(edit);
  const found = new Findings();
  const texts = textsOf(edit, lay, things, found);
  const faces = facesByFrame(edit, lay, things, analyses);
  for (const text of texts) {
    onFace(text, faces, found);
    underButtons(text, found);
  }
  onText(texts, found);
  shortTexts(things, found);
  twoTitles(things, found);
  emptyStart(edit, found);
  cutsOutsidePauses(edit, lay, analyses, found);
  noAnalysis(edit, lay, analyses, found);
  hiddenMarks(edit, lay, things, found);
  fadesBoth(edit, lay, found);
  softZooms(edit, lay, found);
  return found.list();
}

/**
 * The frames on which each text has an error of `on-face` (its box covers the mouth or the eyes) or
 * of `under-buttons` (an app's zone hides it), by the text's key: `CAPTIONS` for the captions, else
 * its mark's or its item's id. A text with none is not in the map. `review` keeps one finding per
 * text and check; a recipe weighing places for a text counts these frames (`placeCaptions`), or
 * checks that a change adds none (`punchIns`). Judged exactly as `review` judges them.
 */
export function textErrorFrames(edit: Edit, analyses: Analyses): Map<string, Set<number>> {
  const lay = layout(edit);
  const things = placed(edit);
  const texts = textsOf(edit, lay, things, new Findings());
  const faces = facesByFrame(edit, lay, things, analyses);
  const frames = new Map<string, Set<number>>();
  for (const text of texts) {
    const hidden = text.part !== "progress" && ZONES.some((zone) => coverOf(text.box, zoneBox(zone)) >= HIDDEN);
    for (let frame = Math.max(0, text.from); frame < Math.min(text.to, lay.frames); frame++) {
      if (!hidden && !(faces[frame] ?? []).some((seen) => faceError(coveredOf(text.box, seen)))) continue;
      const set = frames.get(text.key) ?? new Set<number>();
      frames.set(text.key, set.add(frame));
    }
  }
  return frames;
}

/**
 * The most a shot may enlarge a file before it shows each of the file's pixels over more than two:
 * 2 ÷ the cover fit's scale (part 1's measure; 2 × 720 / 1080 = 1.33 for a 720×1280 take). Past it,
 * `soft-zoom` warns.
 */
export function zoomLimit(asset: { w: number; h: number }): number {
  return 2 / Math.max(STAGE.w / asset.w, STAGE.h / asset.h);
}

/* ── the texts on the film ────────────────────────────────────────────────────────────────────── */

/** A text or a bar on the film, set and placed as the kit draws it, and the frames it shows on. */
interface Shown {
  /** One finding per thing and per check: `CAPTIONS`, or the mark's or the item's id. */
  key: string;
  /** How `says` names it. */
  name: string;
  part: "captions" | "title" | "callout" | "progress";
  box: Box;
  /** Its frames: from `from` up to, not including, `to`. */
  from: number;
  to: number;
  /** The shot, mark or item a finding about it on that frame names. */
  whereAt: (frame: number) => Where;
}

/** The server's measure for one typeface, as layout.ts takes it: a character the tables lack is taken as the widest letter, and `lacked` is told it. */
const measureIn = (font: FontId, lacked: Set<string>): Measure => (text, weight, size, trackingEm) => {
  const { width, unknown } = measureWide(text, font, weight, size, trackingEm);
  for (const character of unknown) lacked.add(character);
  return width;
};

const secondsOf = (frame: number): string => `${(frame / FPS).toFixed(1)} s`;
const fileSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
/** A text as `says` quotes it: at most 40 characters. */
const quoted = (text: string): string => {
  const characters = [...text.replaceAll("*", "")];
  return `"${characters.length > 40 ? `${characters.slice(0, 39).join("")}…` : characters.join("")}"`;
};

function nameOf(thing: Mark | Item): string {
  switch (thing.part) {
    case "title":
      return `the title ${quoted(thing.props.text)}`;
    case "callout":
      return `the call-out ${quoted(thing.props.text)}`;
    case "progress":
      return "the progress bar";
    case "cutaway":
      return `the cutaway "${thing.id}"`;
    case "sound":
      return `the sound "${thing.id}"`;
  }
}

const whereOf = (place: Placed): Where => (place.shot === null ? { item: place.thing.id } : { shot: place.shot, mark: place.thing.id });

/** The id of the shot of a run on a film frame. */
function shotIdOn(edit: Edit, lay: Layout, run: Run, frame: number): string {
  const shot = edit.shots[shotOn(lay, run, frame)];
  if (!shot) throw new Error(`no shot of the run from frame ${run.at} on frame ${frame}`);
  return shot.id;
}

/**
 * Every caption page, title, call-out and progress bar on the film, with its box, as the kit sets
 * and places it. A text that does not fit at its smallest size, or cannot be measured, is found here.
 */
function textsOf(edit: Edit, lay: Layout, things: Placed[], found: Findings): Shown[] {
  const shown: Shown[] = [];

  if (edit.captions.on) {
    lay.runs.forEach((run, r) => {
      // The run's pages exactly as Film.tsx builds them, set together: each is held by the run's tallest page.
      const pages = pagesFor(edit.captions, runWords(edit, run), run.frames);
      if (pages.length === 0) return;
      const whereAt = (frame: number): Where => ({ shot: shotIdOn(edit, lay, run, frame) });
      const lacked = new Set<string>();
      const set = captionPages(edit.captions, pages.map((page) => page.words), measureIn(edit.captions.font, lacked));
      const [character] = lacked;
      if (character !== undefined) {
        const page = pages.find((each) => each.words.some((word) => word.text.normalize("NFC").includes(character))) ?? pages[0];
        const frame = run.at + (page?.from ?? 0);
        found.add(`unmeasured ${CAPTIONS}`, "unmeasured", { frame, ...whereAt(frame) }, `the captions at ${secondsOf(frame)} hold "${character}", which the width tables lack; they were judged as wide as the widest letter`);
      }
      // Where the kit shows the run's captions: up to where a transition out of it begins (`captionFrames`, as Film.tsx).
      const onScreen = captionFrames(edit, lay, r);
      const end = onScreen.at + onScreen.frames;
      pages.forEach((page, i) => {
        const laid = set[i];
        const [from, to] = [run.at + page.from, Math.min(end, run.at + page.to)];
        if (!laid || to <= from) return;
        shown.push({ key: CAPTIONS, name: "the captions", part: "captions", box: laid, from, to, whereAt });
        if (laid.size < SMALLEST.captions) {
          found.add(`text-fits ${CAPTIONS}`, "text-fits", { frame: from, ...whereAt(from) },
            `the captions at ${secondsOf(from)} are set at ${laid.size} px to fit their row, under the ${SMALLEST.captions} px they may be; widen them or retell the word shorter`);
        }
        if (laid.rows.length > MOST_ROWS) {
          found.add(`caption-rows ${CAPTIONS}`, "caption-rows", { frame: from, ...whereAt(from) },
            `the captions at ${secondsOf(from)} run to ${COUNTS[laid.rows.length] ?? laid.rows.length} rows; use fewer words a page or smaller type`);
        }
      });
    });
  }

  for (const place of things) {
    const { thing } = place;
    const [from, to] = [place.at, place.at + place.frames];
    const where = whereOf(place);
    const text = { key: thing.id, name: nameOf(thing), from, to, whereAt: () => where };
    const lacked = new Set<string>();
    const noted = () => {
      const [character] = lacked;
      if (character !== undefined) found.add(`unmeasured ${thing.id}`, "unmeasured", { frame: from, ...where }, `${text.name} at ${secondsOf(from)} holds "${character}", which the width tables lack; it was judged as wide as the widest letter`);
    };
    const tooSmall = (size: number, least: number) => {
      if (size < least) found.add(`text-fits ${thing.id}`, "text-fits", { frame: from, ...where }, `${text.name} at ${secondsOf(from)} is set at ${size} px to fit the stage, under the ${least} px it may be; shorten it`);
    };
    if (thing.part === "title") {
      const laid = titleBox(thing.props, measureIn(thing.props.font, lacked));
      noted();
      shown.push({ ...text, part: "title", box: laid });
      tooSmall(laid.size, SMALLEST.title);
    } else if (thing.part === "callout") {
      const laid = calloutBox(thing.props, measureIn(thing.props.font, lacked));
      noted();
      shown.push({ ...text, part: "callout", box: laid });
      tooSmall(laid.size, SMALLEST.callout);
    } else if (thing.part === "progress") {
      shown.push({ ...text, part: "progress", box: progressBox(thing.props) });
    }
  }
  return shown;
}

/** How much of a text's box `other` covers, from 0 to 1. */
function coverOf(text: Box, other: Box | null): number {
  if (!other || text.w <= 0 || text.h <= 0) return 0;
  const w = Math.min(text.x + text.w, other.x + other.w) - Math.max(text.x, other.x);
  const h = Math.min(text.y + text.h, other.y + other.h) - Math.max(text.y, other.y);
  return w > 0 && h > 0 ? (w * h) / (text.w * text.h) : 0;
}
/** Whether `other` covers at least 4 % of a text's box. */
const covers = (text: Box, other: Box | null): boolean => coverOf(text, other) >= OVERLAP;

/* ── faces ─────────────────────────────────────────────────────────────────────────────────────── */

/** A face as it is shown on a frame: its face and mouth in stage pixels. */
interface FaceOnStage {
  face: Box | null;
  mouth: Box | null;
}

function analysisFor(analyses: Analyses, asset: string): TakeAnalysis | undefined {
  return Object.hasOwn(analyses, asset) ? analyses[asset] : undefined;
}

/**
 * Whether a transition moves the footage itself over the frames two runs share: a push slides it
 * (the engine's `slide`) and a punch scales it (`pushCut`). A fade blends, and a wipe, an iris or a
 * clock clips with a mask: the footage stays where its framing puts it.
 */
const moves = (cut: Shot["out"]): boolean => cut.kind === "push" || cut.kind === "punch";

/**
 * The faces on each film frame (index = frame). On each frame of a run, the face sample standing for
 * it: the last whose own frame is at or before it, so each stands for the frames up to the next
 * sample's, and the last one before the run's start stands for its first frames. Placed through the
 * framing shown on that frame. None under a cutaway, which hides the footage, and none on the shared
 * frames of a push or a punch, which move the footage itself. Two runs in a fade, a wipe, an iris or
 * a clock both count.
 */
function facesByFrame(edit: Edit, lay: Layout, things: Placed[], analyses: Analyses): FaceOnStage[][] {
  const faces: FaceOnStage[][] = Array.from({ length: lay.frames }, () => []);
  const hidden = new Set<number>();
  for (const place of things) if (place.thing.part === "cutaway") for (let f = place.at; f < place.at + place.frames; f++) hidden.add(f);
  lay.runs.forEach((run, r) => {
    const next = lay.runs[r + 1];
    const out = edit.shots[run.last]?.out;
    if (next && out && moves(out)) for (let f = next.at; f < next.at + sharedAfter(edit, lay, r); f++) hidden.add(f);
  });
  for (const run of lay.runs) {
    const asset = assetOf(edit, run.asset);
    const samples = (analysisFor(analyses, run.asset)?.faces ?? []).filter((sample) => sample.ms < run.toMs);
    if (!asset || asset.kind === "audio" || samples.length === 0) continue;
    const frameOfSample = (ms: number) => run.at + frameAt(ms - run.fromMs, run.speed);
    let standing = -1; // the index of the sample standing for the frame
    for (let frame = run.at; frame < run.at + run.frames; frame++) {
      while (standing + 1 < samples.length && frameOfSample(samples[standing + 1]!.ms) <= frame) standing++;
      const sample = samples[standing];
      const shot = edit.shots[shotOn(lay, run, frame)];
      if (!sample || !shot || hidden.has(frame) || (!sample.face && !sample.mouth)) continue;
      faces[frame]?.push(faceOnStage(sample, asset, framingAt(shot, momentOf(run, frame))));
    }
  }
  return faces;
}

/** Whether what a text covers of a face is an error: anything from the brow to the lower lip. The chin is a warning. */
const faceError = (covered: ReturnType<typeof coveredOf>): boolean => covered === "mouth" || covered === "eyes" || covered === "nose";

/** What a text covers of a face sample: the mouth, the eyes or the nose (an error), the chin below the lower lip (a warning), or nothing. */
function coveredOf(text: Box, seen: FaceOnStage): "mouth" | "eyes" | "nose" | "chin" | null {
  const { face, mouth } = seen;
  if (mouth && coverOf(mouth, text) >= MOUTH) return "mouth"; // the share of the mouth's own box
  if (!face) return null;
  const middle = face.y + face.h / 2;
  if (covers(text, { ...face, h: middle - face.y })) return "eyes";
  const lip = mouth ? mouth.y + mouth.h : face.y + LIP * face.h;
  if (lip > middle && covers(text, { ...face, y: middle, h: lip - middle })) return "nose";
  return covers(text, face) ? "chin" : null;
}

function onFace(text: Shown, faces: FaceOnStage[][], found: Findings): void {
  const many = text.part === "captions";
  for (let frame = Math.max(0, text.from); frame < Math.min(text.to, faces.length); frame++) {
    for (const seen of faces[frame] ?? []) {
      const covered = coveredOf(text.box, seen);
      if (!covered) continue;
      const what = covered === "chin" ? `${many ? "touch" : "touches"} the chin` : `${many ? "cover" : "covers"} the ${covered}`;
      // One per text: the worst over the film, then the earliest (Findings keeps them).
      found.add(`on-face ${text.key}`, "on-face", { frame, ...text.whereAt(frame) },
        `${text.name} at ${secondsOf(frame)} ${what}; move ${many ? "them" : "it"} up or down`, faceError(covered) ? "error" : "warn");
    }
  }
}

/* ── the apps' buttons ─────────────────────────────────────────────────────────────────────────── */

/** A zone in stage pixels. */
const zoneBox = (zone: Zone): Box => ({ x: zone.x * STAGE.w, y: zone.y * STAGE.h, w: zone.w * STAGE.w, h: zone.h * STAGE.h });

function underButtons(text: Shown, found: Findings): void {
  if (text.part === "progress") return; // a thin edge with no words, made to sit under the apps' bars: exempt (ruling P)
  ZONES.forEach((zone, z) => {
    const share = coverOf(text.box, zoneBox(zone));
    if (share < OVERLAP) return;
    const hidden = share >= HIDDEN;
    const verb = hidden ? (text.part === "captions" ? "sit under" : "sits under") : text.part === "captions" ? "touch" : "touches";
    found.add(`under-buttons ${text.key} ${z}`, "under-buttons", { frame: text.from, ...text.whereAt(text.from) },
      `${text.name} at ${secondsOf(text.from)} ${verb} ${APP[zone.app]}'s ${zone.what}; ${awayFrom(text, zone)}`, hidden ? "error" : "warn");
  });
}

/** Which way a text goes to leave a zone. */
function awayFrom(text: Shown, zone: Zone): string {
  const it = text.part === "captions" ? "them" : "it";
  if (zone.y === 0) return `move ${it} down`;
  if (zone.x === 0) return `move ${it} up`;
  // The right-side buttons: a call-out moves sideways; the captions and a title are centred.
  if (text.part === "callout") return "move it left";
  return text.part === "captions" ? "make them narrower or move them up" : "move it up";
}

/* ── text over text ────────────────────────────────────────────────────────────────────────────── */

/** How far above and below a title's or a call-out's box another text must keep, as a share of the stage's height. */
const TEXT_GAP = 0.012;

/**
 * Each title and call-out that another text (a caption page, a title, a call-out) shown on one frame with it comes within
 * `TEXT_GAP` of: any overlap of its box, grown by that much above and below, with the other's box. Once, at the first such frame.
 */
function onText(texts: Shown[], found: Findings): void {
  const gap = TEXT_GAP * STAGE.h;
  for (const text of texts) {
    if (text.part !== "title" && text.part !== "callout") continue;
    const grown = { ...text.box, y: text.box.y - gap, h: text.box.h + 2 * gap };
    for (const other of texts) {
      if (other === text || other.key === text.key || other.part === "progress") continue;
      const frame = Math.max(text.from, other.from);
      if (frame >= Math.min(text.to, other.to) || coverOf(grown, other.box) <= 0) continue;
      found.add(`on-text ${text.key}`, "on-text", { frame, ...text.whereAt(frame) }, `${text.name} at ${secondsOf(frame)} covers ${other.name}; move it up or down`);
    }
  }
}

/* ── texts too short to read ───────────────────────────────────────────────────────────────────── */

/** Each title and call-out that shows for less than `SHORTEST_READ_MS` of film, whatever cut it short: its own length, or its shot's end. */
function shortTexts(things: Placed[], found: Findings): void {
  for (const place of things) {
    const { thing } = place;
    if ((thing.part !== "title" && thing.part !== "callout") || (place.frames * 1000) / FPS >= SHORTEST_READ_MS) continue;
    found.add(`short-text ${thing.id}`, "short-text", { frame: place.at, ...whereOf(place) },
      `${nameOf(thing)} at ${secondsOf(place.at)} shows for ${(place.frames / FPS).toFixed(1)} s, too short to read; let it stay ${SHORTEST_READ_MS / 1000} s or longer`);
  }
}

/* ── titles ────────────────────────────────────────────────────────────────────────────────────── */

function twoTitles(things: Placed[], found: Findings): void {
  const titles = things.filter((place) => place.thing.part === "title");
  titles.forEach((one, i) => {
    for (const other of titles.slice(i + 1)) {
      const frame = Math.max(one.at, other.at);
      if (frame >= Math.min(one.at + one.frames, other.at + other.frames)) continue;
      const [first, second] = other.at < one.at ? [other, one] : [one, other];
      found.add(`two-titles ${first.thing.id} ${second.thing.id}`, "two-titles", { frame, ...whereOf(second) },
        `${nameOf(first.thing)} and ${nameOf(second.thing)} are both on screen at ${secondsOf(frame)}; end the first before the second starts`);
    }
  });
}

/* ── the footage ───────────────────────────────────────────────────────────────────────────────── */

function emptyStart(edit: Edit, found: Findings): void {
  const say = (where: Finding["where"], why: string) => found.add("empty-start", "empty-start", where, `the film shows nothing on its first frame: ${why}`);
  const first = momentAt(edit, 0);
  if (!first) return say({ frame: 0 }, "its first shot fills no frame; make it longer");
  const shot = edit.shots.find((each) => each.id === first.shot);
  if (!shot) return;
  const asset = assetOf(edit, shot.asset);
  const where = { frame: 0, shot: shot.id };
  if (!asset) say(where, `shot "${shot.id}" shows "${shot.asset}", which is not in the edit; start it with a clip or a picture`);
  else if (asset.kind === "audio") say(where, `shot "${shot.id}" shows "${asset.id}", a sound; start it with a clip or a picture`);
  else if (asset.kind === "video" && first.ms >= asset.ms) say(where, `shot "${shot.id}" starts at ${first.ms} ms of "${asset.id}", which is ${asset.ms} ms long; start it inside the clip`);
}

const sameLook = (a: Look, b: Look): boolean => a.preset === b.preset && (Object.keys(a.adjust) as (keyof Look["adjust"])[]).every((key) => a.adjust[key] === b.adjust[key]);

/** Whether the join of two shots of one file is seen or heard: the footage jumps, or runs on with another framing, look or volume. */
function cutBetween(edit: Edit, shot: Shot, next: Shot): boolean {
  if (!runsOn(shot, next)) return true;
  const [out, into] = [framingAt(shot, shot.endMs), framingAt(next, next.startMs)];
  const moved = Math.abs(out.zoom - into.zoom) > SAME || Math.abs(out.x - into.x) > SAME || Math.abs(out.y - into.y) > SAME;
  return moved || shot.volume !== next.volume || !sameLook(lookOf(edit, shot), lookOf(edit, next));
}

/**
 * Every side of a cut outside a measured pause of its own clip: the film's start, its end, and both
 * sides of every cut between shots.
 */
function cutsOutsidePauses(edit: Edit, lay: Layout, analyses: Analyses, found: Findings): void {
  /**
   * What is wrong with one side of a cut, or null: a moment of a shot's clip, as the shot `starts` or
   * `ends` there. `film` when the side is the film's own start or end, which passes outside the speech.
   */
  const wrong = (shot: Shot, verb: "starts" | "ends", ms: number, film = false): string | null => {
    const asset = assetOf(edit, shot.asset);
    if (asset?.kind !== "video" || !asset.words?.length || ms === 0 || ms === asset.ms) return null; // nothing said in it, or its very start or end
    if (film && (verb === "starts" ? ms <= asset.words[0]!.startMs : ms >= Math.max(...asset.words.map((word) => word.endMs)))) return null; // before or after all its speech
    const pauses = analysisFor(analyses, asset.id)?.pauses ?? [];
    if (pauses.some((pause) => pause.startMs <= ms && ms < pause.endMs)) return null;
    const at = `shot "${shot.id}" ${verb} at ${ms} ms of its take`;
    if (pauses.length === 0) return `${at}, which has no measured pause`;
    const nearest = pauses.reduce((best, pause) => (Math.abs(pause.cutMs - ms) < Math.abs(best - ms) ? pause.cutMs : best), pauses[0]?.cutMs ?? 0);
    return `${at}, in speech (the nearest pause's cut is at ${nearest} ms)`;
  };
  const say = (key: string, where: Finding["where"], what: string, why: string) => found.add(`cut-outside-pause ${key}`, "cut-outside-pause", where, `${what} is outside a pause: ${why}`);

  const first = edit.shots[0];
  const start = first && wrong(first, "starts", first.startMs, true);
  if (first && start) say("(start)", { frame: 0, shot: first.id }, "the film's start", start);

  edit.shots.forEach((shot, i) => {
    const next = edit.shots[i + 1];
    if (!next || (next.asset === shot.asset && !cutBetween(edit, shot, next))) return;
    const [out, into] = [wrong(shot, "ends", shot.endMs), wrong(next, "starts", next.startMs)];
    if (!out && !into) return;
    const frame = lay.shots[i + 1]?.at ?? 0;
    // A cut where the footage runs on (a punch-in) has one moment for both sides: said once.
    const why = out && into && next.asset === shot.asset && shot.endMs === next.startMs
      ? out.replace(`shot "${shot.id}" ends`, `shot "${shot.id}" ends and shot "${next.id}" starts`)
      : [out, into].filter((side) => side !== null).join(", and ");
    say(`${shot.id} ${next.id}`, { frame, shot: next.id }, `the cut into shot "${next.id}" at ${secondsOf(frame)}`, why);
  });

  const last = edit.shots[edit.shots.length - 1];
  const end = last && wrong(last, "ends", last.endMs, true);
  if (last && end) say("(end)", { frame: Math.max(0, lay.frames - 1), shot: last.id }, `the film's end at ${secondsOf(lay.frames)}`, end);
}

/** Each clip a shot shows that has no analysis, once, at the first shot showing it. */
function noAnalysis(edit: Edit, lay: Layout, analyses: Analyses, found: Findings): void {
  edit.shots.forEach((shot, i) => {
    const asset = assetOf(edit, shot.asset);
    if (asset?.kind !== "video" || analysisFor(analyses, asset.id)) return;
    found.add(`no-analysis ${asset.id}`, "no-analysis", { frame: lay.shots[i]?.at ?? 0, shot: shot.id }, `the clip "${asset.id}" has no analysis; its faces and pauses were not checked`);
  });
}

function hiddenMarks(edit: Edit, lay: Layout, things: Placed[], found: Findings): void {
  edit.shots.forEach((shot, i) => {
    const run = lay.runs[lay.shots[i]?.run ?? -1];
    if (!run) return;
    for (const mark of shot.marks) {
      if (frameOf(edit, shot.id, mark.atMs) !== null) continue;
      // Already running when its footage starts, if it reaches into it; else where its shot starts.
      const frame = things.find((place) => place.thing === mark)?.at ?? lay.shots[i]?.at ?? 0;
      found.add(`mark-hidden ${mark.id}`, "mark-hidden", { frame, shot: shot.id, mark: mark.id },
        `${nameOf(mark)} is at ${fileSeconds(mark.atMs)} of its take, which shot "${shot.id}" no longer shows (it shows ${(run.fromMs / 1000).toFixed(1)} to ${fileSeconds(run.toMs)}); move it into the shot or show that moment again`);
    }
  });
}

function fadesBoth(edit: Edit, lay: Layout, found: Findings): void {
  lay.runs.forEach((run, r) => {
    const [before, first, last] = [edit.shots[run.first - 1], edit.shots[run.first], edit.shots[run.last]];
    if (!before || !first || !last || r === lay.runs.length - 1) return;
    const [into, outOf] = [overlapOf(before.out), overlapOf(last.out)];
    if (into === 0 || outOf === 0 || into + outOf <= run.frames) return;
    const what = run.first === run.last ? `shot "${first.id}"` : `the footage from shot "${first.id}" to "${last.id}"`;
    found.add(`fade-both ${first.id}`, "fade-both", { frame: run.at, shot: first.id },
      `${what} at ${secondsOf(run.at)} is ${run.frames} frames long, shorter than its transitions in (${into}) and out (${outOf}) together, so it fades in and out at once; make it longer or its transitions shorter`);
  });
}

function softZooms(edit: Edit, lay: Layout, found: Findings): void {
  edit.shots.forEach((shot, i) => {
    const asset = assetOf(edit, shot.asset);
    const place = lay.shots[i];
    const run = place && lay.runs[place.run];
    if (!asset || asset.kind === "audio" || !place || !run) return;
    // The cover fit enlarges the file `cover` times and the framing `zoom` times: past 2 in all, it shows each pixel of the file over more than two.
    const limit = zoomLimit(asset);
    let first: number | null = null;
    let most = 0;
    for (let frame = place.at; frame < place.at + place.frames; frame++) {
      const zoom = framingAt(shot, momentOf(run, frame)).zoom;
      if (zoom <= limit + SAME) continue;
      first ??= frame;
      most = Math.max(most, zoom);
    }
    if (first === null) return;
    found.add(`soft-zoom ${shot.id}`, "soft-zoom", { frame: first, shot: shot.id },
      `shot "${shot.id}" at ${secondsOf(first)} is zoomed to ${most.toFixed(2)}, more than twice its take's own pixels; zoom out to ${(Math.floor(limit * 100) / 100).toFixed(2)} or less`);
  });
}
