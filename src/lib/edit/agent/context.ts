/**
 * context.ts — one request's edit as the model reads it, beside the catalogue: the edit itself in
 * compact lines, each take's words, its measured pauses, where the face and the mouth are on the
 * stage while the shots show, where a text has room (Task 14), and what `review` finds wrong now.
 * The catalogue's CONTEXT section says how to read these; the two change together.
 *
 * The files section lists every file the model may use: the edit's own, and the ones the caller
 * offers (`library`: the kit's sounds and pictures, the creator's other takes), which `asset.add`
 * puts into the edit, the same list the door is given.
 *
 * Compact because Qwen's input is paid per token:
 * - a take's words are written once, in the words, never in the edit, and its words and pauses
 *   only around what its shots show;
 * - the face and the mouth, sampled five times a second, are one line for each group of shots
 *   framed alike, with stretches of a second or more only where the face moves, and never more than
 *   6,000 characters;
 * - a shot's framing, cut and adjustments are written only when they are not plain.
 *
 * Every time is in milliseconds of a file, as the operations take them; film frames are written as
 * such ("f"). Every range is written [a,b] (both ends in) or [a,b) (b left out), as the catalogue's
 * RANGES says. The edit is read through `EditSchema` first, so its settings come in the schema's
 * order however it was stored; an edit that is not valid is refused.
 *
 * Pure: the same text for the same edit, and nothing it is given is changed.
 */
import type { Analyses, FaceSample, ShareBox, TakeAnalysis } from "../analysis";
import { coverFrame, framingAt, layout, placed, type Placed } from "../derive";
import { CaptionsSchema, EditSchema, STAGE, type Adjust, type Asset, type Captions, type Edit, type Frame, type Item, type Mark, type Shot } from "../doc";
import { applyOps, type Op } from "../ops";
import { PAUSE_MS, tighten } from "../recipes";
import { PARTS } from "../parts";
import { CAPTIONS, review, textErrorFrames, zoomLimit, type Finding } from "../review";
import { faceOnStage } from "../stage";
import { FPS, msOf } from "../time";
import { calloutWeight, captionWeights, sentenceSet, titleWeight, type Box } from "../../../edit/film/layout";

/** The colour a preset's or a words style's title marks its key word in when its captions have none: the yellow the house's
 *  captions had until the native default (X127). The house and a reference's style get no colour their captions do not have.
 *  An asked stress on captions that draw every word alike takes it too (`stressShows`, Task 9b). */
export const MARKED = "#ffe14a";

export interface Context {
  edit: string;
  files: string;
  words: string;
  pauses: string;
  faces: string;
  /** Where a text has room (`roomText`). Worked out when it is first read: it asks the review a few hundred times. */
  room: string;
  findings: string;
}

/**
 * The edit, the files it may use, the takes' words, pauses and faces, and the findings, each as
 * lines of text. `library` is the files on offer besides the edit's own, as `applyOps` is given
 * them. Throws for an edit that is not valid.
 */
export function contextOf(given: Edit, analyses: Analyses, findings: readonly Finding[], library: readonly Asset[] = []): Context {
  const read = EditSchema.safeParse(given);
  if (!read.success) throw new Error(`the context needs a valid edit: ${read.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const edit = read.data;
  let room: string | null = null;
  return {
    edit: editText(edit), files: filesText(edit, library), words: wordsText(edit), pauses: pausesText(edit, analyses), faces: facesText(edit, analyses),
    // Only a change reads it (the first cut's choices read the words and the pauses alone), so it is worked out when asked for, once.
    get room() {
      return (room ??= roomText(edit, analyses));
    },
    findings: findingsText(findings),
  };
}

/* ── the edit ─────────────────────────────────────────────────────────────────────────────────── */

/** A stretch of film frames, from `at` up to `at + frames`. */
const filmOf = (at: number, frames: number): string => `[${at},${at + frames})f`;

function editText(edit: Edit): string {
  const lay = layout(edit);
  const shows = new Map(placed(edit).map((place) => [place.path, filmOf(place.at, place.frames)]));
  const lines = [`film ${lay.frames}f`, ...edit.assets.map(assetLine)];
  edit.shots.forEach((shot, i) => {
    const place = lay.shots[i];
    const marks = shot.marks.map((mark) => `${mark.id}:${mark.part}@${mark.atMs}+${mark.lenMs}`).join(",");
    const line = `shot ${shot.id} take=${shot.asset} [${shot.startMs},${shot.endMs})ms speed=${shot.speed} vol=${shot.volume} film=${place ? filmOf(place.at, place.frames) : "-"} look=${shot.look?.preset ?? "-"} marks=[${marks}]`;
    lines.push(line + notPlain(shot));
  });
  edit.shots.forEach((shot, i) =>
    shot.marks.forEach((mark, j) => {
      const asset = "asset" in mark ? ` asset=${mark.asset}` : "";
      lines.push(`mark ${mark.id} film=${shows.get(`shots.${i}.marks.${j}`) ?? "-"}${asset} props=${JSON.stringify(mark.props)}`);
    }),
  );
  edit.items.forEach((item, i) => {
    const asset = "asset" in item ? ` asset=${item.asset}` : "";
    lines.push(`item ${item.id} ${item.part} anchor=${item.anchor} at=${item.at} frames=${item.frames ?? "null"} film=${shows.get(`items.${i}`) ?? "-"}${asset} props=${JSON.stringify(item.props)}`);
  });
  lines.push(`captions ${Object.entries(edit.captions).map(([key, value]) => `${key}=${value ?? "null"}`).join(" ")}`);
  lines.push(`look preset=${edit.look.preset} adjust=${adjustments(edit.look.adjust) ?? "-"}`);
  const cover = edit.cover;
  lines.push(cover ? `cover shot=${cover.shot} atMs=${cover.atMs} frame=${coverFrame(edit) ?? "-"}` : "cover -");
  return lines.join("\n");
}

const assetLine = (asset: Asset): string => `asset ${fileOf(asset)}`;

/** A file, without its words: its id, its kind, its length and size, whether it has sound, where it came from. */
function fileOf(asset: Asset): string {
  switch (asset.kind) {
    case "video":
      return `${asset.id} video ${asset.ms}ms ${asset.w}x${asset.h} ${asset.sound ? "sound" : "silent"} ${asset.origin}`;
    case "image":
      return `${asset.id} image ${asset.w}x${asset.h} ${asset.origin}`;
    case "audio":
      return `${asset.id} audio ${asset.ms}ms ${asset.origin}`;
  }
}

/* ── the files ────────────────────────────────────────────────────────────────────────────────── */

/** The most characters the files may take. */
const FILES_BUDGET = 2000;
/** The last line of files when more are on offer than `FILES_BUDGET` holds. */
const MORE_FILES = "… (more files)";

/**
 * Every file on offer, each once: the edit's own ("in edit"), then the library's others in its
 * order ("to add", by `asset.add`). Within `FILES_BUDGET` characters: past it, the lines stop and a
 * last line says more are on offer (`MORE_FILES`).
 */
function filesText(edit: Edit, library: readonly Asset[]): string {
  const listed = new Set(edit.assets.map((asset) => asset.id));
  const offered = library.filter((asset) => !listed.has(asset.id) && listed.add(asset.id));
  const lines = [...edit.assets.map((asset) => `${fileOf(asset)} in edit`), ...offered.map((asset) => `${fileOf(asset)} to add`)];
  // Asked for a whoosh with none on offer, the model named a file of its own making, three times in three (Task 14): said plainly.
  if (![...edit.assets, ...offered].some((asset) => asset.kind === "audio")) lines.push(NO_SOUND);
  const text = joined(lines);
  return text.length <= FILES_BUDGET ? text : within(lines, FILES_BUDGET, MORE_FILES);
}

/** The files' last line when none of them is a sound. */
export const NO_SOUND = "no sound on offer";

/** The first lines that fit in `budget` characters with a last line that says the rest were left out. */
function within(lines: readonly string[], budget: number, last: string): string {
  const kept: string[] = [];
  let size = last.length;
  for (const line of lines) {
    if (size + line.length + 1 > budget) break;
    kept.push(line);
    size += line.length + 1;
  }
  return [...kept, last].join("\n");
}

/** What a shot has that a plain one does not, after its line: a framing other than the whole picture, still; a transition; adjustments of its own. */
function notPlain(shot: Shot): string {
  const { from, move } = shot.framing;
  const framed = move !== null || from.zoom !== 1 || from.x !== 0 || from.y !== 0;
  const adjust = shot.look ? adjustments(shot.look.adjust) : null;
  return [framed ? ` framing=${JSON.stringify(shot.framing)}` : "", shot.out.kind === "cut" ? "" : ` out=${JSON.stringify(shot.out)}`, adjust ? ` adjust=${adjust}` : ""].join("");
}

/** The adjustments that change something, as JSON; null when none does. */
function adjustments(adjust: Adjust): string | null {
  const set = Object.entries(adjust).filter(([, value]) => value !== 0);
  return set.length > 0 ? JSON.stringify(Object.fromEntries(set)) : null;
}

/* ── the takes ────────────────────────────────────────────────────────────────────────────────── */

type Clip = Extract<Asset, { kind: "video" }>;
const clipsOf = (edit: Edit): Clip[] => edit.assets.filter((asset): asset is Clip => asset.kind === "video");
/** A take's analysis, by its id; null when there is none. */
export const analysisOf = (analyses: Analyses, id: string): TakeAnalysis | null => (Object.hasOwn(analyses, id) ? (analyses[id] ?? null) : null);
/** Lines, or `empty` ("none" unless said) when there are none. */
const joined = (lines: string[], empty = "none"): string => (lines.length > 0 ? lines.join("\n") : empty);
/** What the pauses and the faces say when no shot shows a take (an edit of pictures). */
const NO_TAKE = "no take shown";

/** How far either side of what the shots show a take's words and pauses are written. */
export const AROUND_MS = 2000;

/**
 * Whether a stretch [startMs, endMs) of a take comes within `AROUND_MS` of a stretch one of the
 * take's shots shows; null when no shot shows the take.
 */
function nearShown(edit: Edit, clip: string): ((startMs: number, endMs: number) => boolean) | null {
  const shown = edit.shots.filter((shot) => shot.asset === clip).map((shot) => [shot.startMs - AROUND_MS, shot.endMs + AROUND_MS] as const);
  return shown.length > 0 ? (startMs, endMs) => shown.some(([from, to]) => endMs > from && startMs < to) : null;
}

/**
 * Each take's words, by their index in the take, as `word.set` names them: only those near what
 * the take's shots show (`nearShown`). A take no shot shows has none written.
 */
function wordsText(edit: Edit): string {
  return joined(
    clipsOf(edit).flatMap((clip) => {
      const near = nearShown(edit, clip.id);
      const lines = (clip.words ?? []).flatMap((word, i) => {
        if (!near?.(word.startMs, word.endMs)) return [];
        return [`w${i} ${word.text} [${word.startMs},${word.endMs})${word.hidden ? " (hidden)" : ""}${word.stress ? " (stressed)" : ""}`];
      });
      if (lines.length === 0) return [];
      // Where the speech listed begins and ends, said outright: asked to cut "after the last word", the model took the end of
      // another word in two runs of three (Task 14).
      const listed = (clip.words ?? []).flatMap((word, i) => (near?.(word.startMs, word.endMs) ? [{ i, word }] : []));
      const [first, last] = [listed[0], listed.at(-1)];
      return [`take ${clip.id}`, ...lines, ...(first && last ? [`first w${first.i} starts ${first.word.startMs}; last w${last.i} ends ${last.word.endMs}`] : [])];
    }),
  );
}

/**
 * Each shown take's pauses, only those near what its shots show (`nearShown`): "none" for a
 * measured take with none there, "not measured" for one with no analysis. A take no shot shows is
 * left out.
 */
function pausesText(edit: Edit, analyses: Analyses): string {
  return joined(
    clipsOf(edit).flatMap((clip) => {
      const near = nearShown(edit, clip.id);
      if (!near) return [];
      const analysis = analysisOf(analyses, clip.id);
      if (!analysis) return [`take ${clip.id} not measured`];
      const pauses = analysis.pauses.filter((pause) => near(pause.startMs, pause.endMs));
      if (pauses.length === 0) return [`take ${clip.id} none`];
      return [`take ${clip.id}`, ...pauses.map((pause) => `[${pause.startMs},${pause.endMs}) cut@${pause.cutMs}`)];
    }),
    NO_TAKE,
  );
}

/* ── the faces ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Where the face and the mouth are on the stage, as shares of it, each box rounded outward to two
 * places (round 0's ruling 3, round 0b's and fix round 1's; this replaces the brief's one face line
 * per stretch):
 *
 *   shot <id>,<id>,… take=<asset> face y=[<top>,<bottom>] x=[<left>,<right>] mouth y=[<top>,<bottom>] x=[<left>,<right>]
 *   [<fromMs>,<toMs>) face y=[<top>,<bottom>] x=[<left>,<right>] mouth y=[<top>,<bottom>] x=[<left>,<right>]
 *
 * - The shots of one take framed alike (the same zoom, x and y, and no move; at zoom 1, x and y do
 *   nothing and count as 0) show the face in the same place on the stage, so they are one group,
 *   on one line: the box that holds the face over all of them and the one that holds the mouth.
 *   "face -" or "mouth -" where none was found; "none" in place of both where neither was. A shot
 *   with a move is a group of its own. The shots of a take with no analysis are one group,
 *   "not measured". Groups come in the order of their first shots.
 * - Lines with a time come only when the group's face moves more than `STILL`: the group's footage
 *   in film order, one second of it at a time in one box, and seconds merged while every edge of
 *   the face stays less than `MOVES` from where it was in the stretch's first second and the file
 *   runs forward. So at most one line a second. A single stretch would say the group's line again,
 *   and is left out. A stretch's times are of the file and run from its first second to its last:
 *   between this group's shots, another group's shots, or none, may show part of them (accepted,
 *   round 0b).
 * - With no shot showing a take (an edit of pictures), the section is "no take shown".
 * - The whole stays at or under `BUDGET` characters: the seconds are widened to two, four, … of
 *   them; then only the groups' lines are written; at the last, lines are cut off and a last line
 *   says so (`TRIMMED`).
 *
 * Each sample stands for its take from its own moment up to the next sample's (the last one up to
 * the take's end), as `review` reads them, cut to what the shot shows. It is placed through the cover
 * fit and the shot's framing (`faceOnStage`) at the start and at the end of that stretch, and the
 * two are held in one box, so a moving shot's face is held wherever the move takes it. A sample with
 * a mouth and no face is kept for its mouth.
 */
function facesText(edit: Edit, analyses: Analyses): string {
  const groups = groupsOf(edit, analyses);
  if (groups.length === 0) return NO_TAKE;
  const write = (width: number | null) => groups.map((group) => groupText(group, width)).join("\n");
  const longest = Math.max(...groups.map((group) => group.filmMs));
  for (let width = SECOND; width < 2 * longest; width *= 2) {
    const text = write(width);
    if (text.length <= BUDGET) return text;
  }
  const lines = write(null);
  return lines.length <= BUDGET ? lines : within(lines.split("\n"), BUDGET, TRIMMED);
}

/** How far a face's edge may move, as a share of the stage, and still be one stretch. */
const MOVES = 0.05;
/** How far a face's edges may range over a group with only the group's line written. */
const STILL = 0.1;
/** The most characters the faces may take. */
const BUDGET = 6000;
/** The last line of faces that were cut off to keep within `BUDGET`. */
const TRIMMED = "… (faces trimmed)";
const SECOND = 1000;

type Edges = { top: number; bottom: number; left: number; right: number };
const EDGES = ["top", "bottom", "left", "right"] as const;
/** What a sample found on the stage over a stretch of a file: a face, a mouth, or both; null where it found none. */
interface Seen {
  fromMs: number;
  toMs: number;
  face: Edges | null;
  mouth: Edges | null;
}
/** Shots of one take framed alike, and what their samples found, each with where it falls on the group's own footage, in film milliseconds. */
interface Group {
  ids: string[];
  clip: string;
  /** False for the shots of a take with no analysis. */
  measured: boolean;
  seen: { at: number; seen: Seen }[];
  /** How long the group's footage plays. */
  filmMs: number;
}

/** The shots of video takes, in groups of one take and one still framing; a moving shot alone; a take with no analysis in one group. */
function groupsOf(edit: Edit, analyses: Analyses): Group[] {
  const clips = new Map(clipsOf(edit).map((clip) => [clip.id, clip]));
  const groups = new Map<string, Group>();
  for (const shot of edit.shots) {
    const clip = clips.get(shot.asset);
    if (!clip) continue;
    const analysis = analysisOf(analyses, shot.asset);
    const { from, move } = shot.framing;
    const still = from.zoom === 1 ? [1, 0, 0] : [from.zoom, from.x, from.y];
    const key = !analysis ? `${shot.asset} not measured` : move ? `${shot.id} moves` : JSON.stringify([shot.asset, ...still]);
    const group = groups.get(key) ?? { ids: [], clip: clip.id, measured: analysis !== null, seen: [], filmMs: 0 };
    groups.set(key, group);
    for (const seen of analysis ? seenOf(shot, clip, analysis) : []) group.seen.push({ at: group.filmMs + (seen.fromMs - shot.startMs) / shot.speed, seen });
    group.ids.push(shot.id);
    group.filmMs += (shot.endMs - shot.startMs) / shot.speed;
  }
  return [...groups.values()];
}

/** Each sample that found a face or a mouth, as its stretch of what the shot shows, placed at that stretch's first and last framing. */
function seenOf(shot: Shot, clip: Clip, analysis: TakeAnalysis): Seen[] {
  return analysis.faces.flatMap((sample, i) => {
    const [fromMs, toMs] = [Math.max(sample.ms, shot.startMs), Math.min(analysis.faces[i + 1]?.ms ?? clip.ms, shot.endMs)];
    if (fromMs >= toMs) return [];
    const [first, last] = [faceOnStage(sample, clip, framingAt(shot, fromMs)), faceOnStage(sample, clip, framingAt(shot, toMs))];
    const held = (a: Box | null, b: Box | null) => joinEdges(a && edgesOf(a), b && edgesOf(b));
    const [face, mouth] = [held(first.face, last.face), held(first.mouth, last.mouth)];
    return face || mouth ? [{ fromMs, toMs, face, mouth }] : [];
  });
}

/** A group's line, then, when its face moves and `width` is given, its stretches of seconds `width` long. */
function groupText(group: Group, width: number | null): string {
  const head = `shot ${group.ids.join(",")} take=${group.clip}`;
  if (!group.measured) return `${head} not measured`;
  const [first, ...rest] = group.seen.map((each) => each.seen);
  if (!first) return `${head} none`;
  const lines = [`${head} ${boxesOf(rest.reduce(joinSeen, first))}`];
  const faces = [first, ...rest].flatMap((each) => (each.face ? [each.face] : []));
  const range = faces.length === 0 ? 0 : Math.max(...EDGES.map((edge) => Math.max(...faces.map((face) => face[edge])) - Math.min(...faces.map((face) => face[edge]))));
  const stretches = width !== null && range > STILL ? stretchesOf(group.seen, width) : [];
  if (stretches.length > 1) lines.push(...stretches.map((seen) => `[${seen.fromMs},${seen.toMs}) ${boxesOf(seen)}`));
  return lines.join("\n");
}

/**
 * The group's samples held a second (`width`) of its footage at a time, then the seconds merged
 * while every edge of the face stays less than `MOVES` from where it was in the stretch's first
 * second with a face. A second with a mouth and no face goes with the stretch it falls in. A
 * stretch only runs forward in its file: a shot moved before an earlier part of the take starts a
 * new one.
 */
function stretchesOf(seen: Group["seen"], width: number): Seen[] {
  const seconds: { index: number; seen: Seen }[] = [];
  for (const each of seen) {
    const [index, held] = [Math.floor(each.at / width), seconds[seconds.length - 1]];
    if (held && held.index === index && each.seen.fromMs >= held.seen.toMs) held.seen = joinSeen(held.seen, each.seen);
    else seconds.push({ index, seen: each.seen });
  }
  const stretches: { first: Edges | null; seen: Seen }[] = [];
  for (const { seen: second } of seconds) {
    const open = stretches[stretches.length - 1];
    const near = (first: Edges | null, face: Edges | null) => !first || !face || EDGES.every((edge) => Math.abs(face[edge] - first[edge]) < MOVES);
    if (open && second.fromMs >= open.seen.toMs && near(open.first, second.face)) {
      open.seen = joinSeen(open.seen, second);
      open.first ??= second.face;
    } else stretches.push({ first: second.face, seen: second });
  }
  return stretches.map((stretch) => stretch.seen);
}

/** Two stretches as one: from the first's start to the second's end, each box holding both. */
function joinSeen(a: Seen, b: Seen): Seen {
  return { fromMs: Math.min(a.fromMs, b.fromMs), toMs: Math.max(a.toMs, b.toMs), face: joinEdges(a.face, b.face), mouth: joinEdges(a.mouth, b.mouth) };
}

/** The box that holds both; either one when the other is null. */
function joinEdges(a: Edges | null, b: Edges | null): Edges | null {
  if (!a || !b) return a ?? b;
  return { top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom), left: Math.min(a.left, b.left), right: Math.max(a.right, b.right) };
}

/** A share of the stage rounded outward to two places: down for a box's top or left, up for its bottom or right. */
export const shareDown = (value: number): string => (Math.floor(value * 100 + 1e-9) / 100).toFixed(2);
export const shareUp = (value: number): string => (Math.ceil(value * 100 - 1e-9) / 100).toFixed(2);

const edgesOf = (box: Box): Edges => ({ top: box.y / STAGE.h, bottom: (box.y + box.h) / STAGE.h, left: box.x / STAGE.w, right: (box.x + box.w) / STAGE.w });

/** A face and a mouth, each box rounded outward. */
function boxesOf(seen: Seen): string {
  const box = (edges: Edges | null) => (edges ? `y=[${shareDown(edges.top)},${shareUp(edges.bottom)}] x=[${shareDown(edges.left)},${shareUp(edges.right)}]` : "-");
  return `face ${box(seen.face)} mouth ${box(seen.mouth)}`;
}

/* ── the room ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * Where a text has room, as the review judges it (Task 14, Step 0). The model placed text blind: asked for a call-out on the
 * owner's close-up take it tried y 0.4 (the eyes), 0.65 (the mouth) and 0.75 (the captions) and gave up, 0 of 3; asked for bigger
 * captions it tried three places with no room and gave up, 0 of 3. The face's box alone did not tell it where to go. So the
 * places are worked out here, by asking the review itself about a text tried at each height (N8: the craft is in code).
 *
 *   captions now <size>px, <n> words a page, y=<y>; as they are they have room at y=[<from>,<to>]. Bigger, the largest with a
 *   place first: {"size":<size>,"maxWords":<n>,"y":<y>}; …
 *   pauses: the cuts keep about <n> ms of pause each                                   (`pausesRoom`)
 *   zoom: shot.zoom may take <id> to <zoom>; <id> (now <zoom>) to <zoom>; <id> no further   (`zoomRoom`)
 *   new text, one line (a call-out) and two lines (a title), each at 130px, centred:
 *   film=[<first>,<end>)f shot <id>..<id> w<i>-w<j>: one line y=[<from>,<to>] or [<from>,<to>]; two lines none
 *
 * - y is a text's centre, tried every 0.02 of the stage's height from 0.10 to 0.90 (`ROOM_YS`); a range is the heights next to
 *   one another that are clear, "none" when no height is.
 * - The captions are one setting for the whole film. First, the heights they are clear at as they are: no error on them, and
 *   none made on another text. The chin may be touched, as the first cut sets them (the review warns and lets it pass); from
 *   the brow to the lower lip the review itself finds an error (the final fix wave: the eyes, the nose, the mouth), so the
 *   room is the review's verdict at every height and nothing of its own, and what it names is what the loop takes. Then, for their count of words a page and the two counts below it, the
 *   largest size with a place, up to `CAPTIONS_GROW` times theirs: only sizes larger than theirs, the largest first, a count
 *   named only when no larger count has room at its size or more, each written as the settings `captions.set` takes, at the
 *   clear height nearest their own. (Given ranges to combine, the model sent a size without its words a page or its height,
 *   and took the first size it read: 90 px, a tenth, where two words a page had room at 100.) "No larger size has a place."
 *   when none has. With no room as they are (a look on a box set where bare words fitted), the largest settings with a place
 *   at any size down to the smallest, the same way; "No size has a place." when none has. "captions off" when they are.
 *   Where only a title or a call-out is in the way of a height, a sentence says so ("Without the title they would also have
 *   room at …"): asked for captions higher with no room higher, the model moved them 0.01 lower and said it had moved them up.
 * - A new text is tried over each stretch of the film: from its start, or a title's or a call-out's first or last frame, to
 *   the next, in equal pieces never longer than `ROOM_STRETCH`. One line is a call-out (`ROOM_PROBE.line`), two lines a title
 *   (`ROOM_PROBE.title`), both at `ROOM_PROBE.size`. A height is clear when the review finds no error on the text and does not
 *   find it on the face at all: a new title or call-out goes clear of the whole face, where the review only warns of the chin
 *   and the cheeks (a call-out on the nose passes the review and looks wrong). Touching an app's zone, which the review warns
 *   of, is let pass. A second title while one shows has no place; but a title that stays to the end is not counted over a
 *   stretch that starts after its first frame (an edge), as the room would be with it ended where the new text starts (Task
 *   9b; it gives way only to a later text), and a line under the head says so. A line names the
 *   shot the stretch shows, or its first and its last, and w<i>-w<j>, the words that start in it, when those shots show one
 *   take. Stretches next to one another with the same places are one line.
 * - Within `ROOM_BUDGET` characters: a film of more than a minute starts with stretches of a thirtieth of it; past the budget
 *   the stretches are made twice as long, then four times, …; at the last, lines are cut off and a last line says so
 *   (`ROOM_TRIMMED`).
 */
function roomText(edit: Edit, analyses: Analyses): string {
  const before = [captionsRoom(edit, analyses), pausesRoom(edit, analyses), ...zoomRoom(edit, analyses)];
  // A title that stays to the end is not counted (Task 9b, ruling 1a): it gives way to a new text (`labelGivesWay`), and is said to.
  const staying = placed(edit).flatMap((place) => (staysToEnd(place.thing) ? [place.thing] : []));
  const head = [
    `new text, one line (a call-out) and two lines (a title), each at size ${ROOM_PROBE.size}, centred:`,
    ...staying.map((thing) => `${textName(thing)} stays to the end: a new text that starts after it ends it where that text starts (with under ${LABEL_LEAST / FPS} s of it left, it is taken out), so it is not counted where a stretch starts after it`),
  ].join("\n");
  const frames = layout(edit).frames;
  // A long film starts with longer stretches, about thirty in all: each pass asks the review 82 times.
  for (let longest = Math.max(ROOM_STRETCH, Math.ceil(frames / ROOM_LINES)); ; longest *= 2) {
    const lines = [...before, head, ...stretchLines(edit, analyses, longest)];
    const text = lines.join("\n");
    if (text.length <= ROOM_BUDGET) return text;
    if (longest >= frames) return within(lines, ROOM_BUDGET, ROOM_TRIMMED);
  }
}

/** The centres a text is tried at: every 0.02 of the stage's height from 0.10 to 0.90. */
export const ROOM_YS: readonly number[] = Array.from({ length: 41 }, (_, i) => Math.round((0.1 + i * 0.02) * 100) / 100);
/** The longest stretch of film one line of room speaks for: two seconds. */
export const ROOM_STRETCH = 2 * FPS;
/** The most characters the room may take. */
export const ROOM_BUDGET = 3000;
/** About how many stretches a long film is first tried in. */
const ROOM_LINES = 30;
const ROOM_TRIMMED = "… (room trimmed)";
/** What stands for a new text: a call-out of two words, a title of five on two lines, at the size the craft asks for. */
export const ROOM_PROBE = { size: 130, line: "Two words", title: "Bread that never fails" } as const;
/** How far past their own size larger captions are looked for. */
const CAPTIONS_GROW = 1.6;
/** The ids of the texts tried: none of an edit's own starts so. */
const PROBE_ID = "room-probe-";

const isError = (finding: Finding): boolean => finding.severity === "error";
/** A finding about the captions' place or size: it names no mark and no item. */
const ofCaptions = (finding: Finding): boolean =>
  finding.where.mark === undefined && finding.where.item === undefined && (finding.code === "on-face" || finding.code === "under-buttons" || finding.code === "text-fits");
/**
 * A finding the same before and after a change, as the loop tells an error an edit came with from one a change brings: its
 * code, its mark or item, and its words with every number outside quotes blanked (a moment moves with the film). The room
 * and the zoom's search tell another text's standing error by it too (they went by the code and the thing alone, and named
 * heights at which a title's error turned into another sentence, which the loop refused).
 */
export const sameAs = (finding: Finding): string =>
  [finding.code, finding.where.mark ?? "", finding.where.item ?? "", finding.says.split('"').map((part, i) => (i % 2 ? part : part.replace(/\d+(?:\.\d+)?/g, "#"))).join('"')].join("|");
/** What keeps a new text from a place: an error, or the face touched at all. */
const blocks = (finding: Finding): boolean => isError(finding) || finding.code === "on-face";

/**
 * The one rule for what a change may do to the captions' own errors, which the room offers by and the loop accepts by (Task
 * 14b; the review of Task 14 found them apart: with a captions error standing, the room said "no size has a place" and the
 * loop took any setting). On an edit whose captions carry no error, they may get none. On one whose captions already carry one
 * (a first cut that found no place clear of every shot), it may not get worse: no error that reads otherwise than one they
 * had (`sameAs`: the eyes for the mouth, an app's bar for a face; the loop's own test of an error an edit came with, which
 * the room did not ask until the final review, and so named heights the loop then refused), and no more frames covered
 * (`textErrorFrames`). `frames` is how many frames the captions' errors cover in `before`; `had`, what the review finds in
 * `before`, when the caller has it already (the room asks many times).
 */
export function captionsRule(before: Edit, analyses: Analyses, had: readonly Finding[] = review(before, analyses)): { frames: number; worse: (after: Edit, found?: readonly Finding[]) => boolean } {
  const own = (found: readonly Finding[]): Finding[] => found.filter((finding) => isError(finding) && ofCaptions(finding));
  const read = new Set(own(had).map(sameAs));
  const covered = (edit: Edit): number => textErrorFrames(edit, analyses).get(CAPTIONS)?.size ?? 0;
  const frames = read.size > 0 ? covered(before) : 0;
  const worse = (after: Edit, found: readonly Finding[] = review(after, analyses)): boolean => {
    const now = own(found);
    if (now.length === 0) return false;
    return now.some((finding) => !read.has(sameAs(finding))) || covered(after) > frames;
  };
  return { frames, worse };
}

/** True when the captions' own errors are worse in `after` than in `before`: see `captionsRule`. */
export const captionsWorse = (before: Edit, after: Edit, analyses: Analyses): boolean => captionsRule(before, analyses).worse(after);

/** Heights next to one another as ranges: "y=[0.18,0.24] or [0.58,0.60]"; "none" for none. */
function rangesOf(ys: readonly number[]): string {
  const runs: [number, number][] = [];
  for (const y of ys) {
    const last = runs.at(-1);
    if (last && y - last[1] < 0.03) last[1] = y;
    else runs.push([y, y]);
  }
  return runs.length > 0 ? `y=${runs.map(([from, to]) => `[${from.toFixed(2)},${to.toFixed(2)}]`).join(" or ")}` : "none";
}

/** The captions' line (see `roomText`), and the setting that fits when they have no room as they are. */
function captionsPlaces(edit: Edit, analyses: Analyses, before: Edit = edit, asFit = false): { line: string; fit: Pick<Captions, "size" | "maxWords" | "y"> | null } {
  const now = edit.captions;
  if (!now.on) return { line: "captions off", fit: null };
  // An error the edit had on another thing (`before`: the edit as it stood, when `edit` is an answer's) is not the captions'
  // doing: only one they make counts, on themselves or on a title or a call-out they would cover.
  const stood = review(before, analyses);
  const had = new Set(stood.filter((finding) => isError(finding) && !ofCaptions(finding)).map(sameAs));
  // Their own errors by the one rule (`captionsRule`): none where they had none, no worse where they had one.
  const rule = captionsRule(before, analyses, stood);
  const clear = (captions: Captions): boolean => {
    const tried = { ...edit, captions };
    const found = review(tried, analyses);
    return found.every((finding) => !isError(finding) || ofCaptions(finding) || had.has(sameAs(finding))) && !rule.worse(tried, found);
  };
  /** How large the room looks for captions that stand at `size`. */
  const upTo = (size: number): number => Math.min(CaptionsSchema.shape.size.maxValue ?? size, 2 * Math.floor((size * CAPTIONS_GROW) / 2));
  const most = upTo(now.size);
  // An answer's fit has its ceiling from the room of the edit as it stood, and never above what the answer asked (the final
  // review: the search ran from the answer's size up, and an answer of 120 px came back as 192 px at one word a page).
  const top = asFit ? Math.min(now.size, upTo(before.captions.size)) : now.size;
  // The room is the review's own verdict at every height and nothing else (the final fix wave): the review holds the face from
  // the brow to the lower lip itself now, and a band of the room's own left out heights the loop then took.
  const least = CaptionsSchema.shape.size.minValue ?? now.size;
  /** The largest size from `from` up to, not including, `past` with a place among `ys`, to 2 px, and its heights: a height with no room at one size has none at a larger one. */
  const largest = (words: number, from: number, past: number, ys: number[]): { size: number; ys: number[] } => {
    let [size, larger] = [from, past];
    while (larger - size > 2) {
      const tried = 2 * Math.round((size + larger) / 4);
      const at = ys.filter((y) => clear({ ...now, maxWords: words, y, size: tried }));
      if (at.length > 0) [size, ys] = [tried, at];
      else larger = tried;
    }
    return { size, ys };
  };
  const places: { words: number; size: number; ys: number[] }[] = [];
  let own: number[] = [];
  for (let words = now.maxWords; words >= Math.max(1, now.maxWords - 2); words--) {
    const ys = ROOM_YS.filter((y) => clear({ ...now, maxWords: words, y }));
    if (words === now.maxWords) own = ys;
    // The room grows from their size up; an answer's fit stops at its ceiling.
    const at = !asFit || top === now.size ? ys : ROOM_YS.filter((y) => clear({ ...now, maxWords: words, y, size: top }));
    if (at.length > 0) places.push({ words, ...(asFit ? { size: top, ys: at } : largest(words, now.size, most + 2, at)) });
    else {
      // No room at that size: the largest smaller one with a place, from the smallest the captions may be.
      const small = ROOM_YS.filter((y) => clear({ ...now, maxWords: words, y, size: least }));
      if (small.length > 0) places.push({ words, ...largest(words, least, top, small) });
    }
  }
  // The largest first; a count of words is named only when no larger count has room at its size or more. Each as the settings
  // to send, at the height nearest the captions' own. With room as they are, only the larger sizes.
  const worth = places.filter((place) => (own.length === 0 || place.size > now.size) && !places.some((other) => other.words > place.words && other.size >= place.size)).sort((a, b) => b.size - a.size);
  const nearest = (ys: readonly number[]): number => ys.reduce((best, y) => (Math.abs(y - now.y) < Math.abs(best - now.y) - 1e-9 ? y : best), ys[0] ?? now.y);
  const settings = worth.map((place) => JSON.stringify({ size: place.size, maxWords: place.words, y: nearest(place.ys) })).join("; ");
  // Where a title or a call-out is all that is in the way: so that "above your head, once the title is gone" can be said.
  const texts = [...edit.shots.flatMap((shot) => shot.marks), ...edit.items].filter((thing) => thing.part === "title" || thing.part === "callout");
  const bare = withoutTexts(edit);
  const freed = texts.length === 0 ? [] : ROOM_YS.filter((y) => !own.includes(y) && review({ ...bare, captions: { ...now, y } }, analyses).every((finding) => !isError(finding) || !ofCaptions(finding)));
  const kinds = [texts.some((thing) => thing.part === "title") ? "title" : null, texts.some((thing) => thing.part === "callout") ? "call-out" : null].filter((kind) => kind !== null).join(" and ");
  const without = freed.length > 0 ? ` Without the ${kinds} they would also have room at ${rangesOf(freed)}.` : "";
  // With an error standing on them (`rule.frames`), "room" is where it gets no worse, and the place where it is least is named.
  const lightest = rule.frames === 0 ? null : own.map((y) => ({ y, frames: textErrorFrames({ ...edit, captions: { ...now, y } }, analyses).get(CAPTIONS)?.size ?? 0 })).sort((a, b) => a.frames - b.frames || Math.abs(a.y - now.y) - Math.abs(b.y - now.y))[0];
  const standing = rule.frames === 0 ? "" : ` They cover a face or sit under an app's bar on ${rule.frames} frames of the film as it came, which a change may not make worse${lightest ? `: the heights named are where it gets no worse, and it is least at y=${lightest.y} (${lightest.frames} frames)` : ""}.`;
  const head = `captions now size ${now.size}, ${wordsOf(now.maxWords)} a page, y=${now.y}; as they are they have room at ${own.length > 0 ? rangesOf(own) : "no height"}.${standing}${without}`;
  // The fit keeps the answer's own count of words, and goes to fewer only for an answer that set the captions larger, when
  // that count cannot be larger than they stood: then the most words a page that can.
  const grew = now.size > before.captions.size;
  const chosen = !asFit ? worth[0] : (places.find((place) => !grew || place.size > before.captions.size) ?? places[0]);
  const fit = own.length === 0 ? (chosen ? { size: chosen.size, maxWords: chosen.words, y: nearest(chosen.ys) } : null) : null;
  if (own.length === 0) return { line: `${head} ${settings ? `The largest with a place first: ${settings}` : "No size has a place."}`, fit };
  return { line: `${head} ${settings ? `Bigger, the largest with a place first: ${settings}` : "No larger size has a place."}`, fit };
}

/** The captions' line: see `roomText`. */
function captionsRoom(edit: Edit, analyses: Analyses): string {
  return captionsPlaces(edit, analyses).line;
}

/**
 * For captions that have no room anywhere as an answer set them (a look on a box, a size too large): the setting that has a
 * place, never larger than the answer asked nor than the room looks for the edit as it stood, at the answer's count of words
 * (fewer only when the answer set them larger and that count cannot be), at the height nearest the one asked; null when they
 * have room as set at some height (then where is the
 * question, and that is the model's to answer), or no size has any. The loop sets them so itself (N8: where captions sit is
 * computed from the analysis; the model chooses what and why).
 */
export function captionsFit(refused: Edit, analyses: Analyses, before: Edit): Pick<Captions, "size" | "maxWords" | "y"> | null {
  return captionsPlaces(refused, analyses, before, true).fit;
}

/** True for a finding about the captions' place or size (it names no mark and no item). */
export const aboutCaptions = (finding: Finding): boolean => ofCaptions(finding);

const wordsOf = (count: number): string => `${count} ${count === 1 ? "word" : "words"}`;

/** The edit with no title and no call-out on it. */
function withoutTexts(edit: Edit): Edit {
  const text = (part: string): boolean => part === "title" || part === "callout";
  return { ...edit, shots: edit.shots.map((shot) => ({ ...shot, marks: shot.marks.filter((mark) => !text(mark.part)) })), items: edit.items.filter((item) => !text(item.part)) };
}

/* ── the room for a cut and a framing ──────────────────────────────────────────────────────────── */

/**
 * The pauses' line (Task 14): how much pause the cuts between shots of one take keep, as its middle value, so that "snappier"
 * can be asked of `pauses.tighten` with a number under it. A cut keeps what its two sides hold of the measured pauses they lie
 * in. "pauses: no cut in a pause" when the edit has none.
 */
function pausesRoom(edit: Edit, analyses: Analyses): string {
  const kept: number[] = [];
  edit.shots.forEach((shot, i) => {
    const next = edit.shots[i + 1];
    const pauses = analysisOf(analyses, shot.asset)?.pauses ?? [];
    if (!next || next.asset !== shot.asset || next.startMs < shot.endMs) return;
    const out = pauses.find((pause) => shot.endMs >= pause.startMs && shot.endMs < pause.endMs);
    const into = pauses.find((pause) => next.startMs >= pause.startMs && next.startMs < pause.endMs);
    if (out || into) kept.push((out ? shot.endMs - out.startMs : 0) + (into ? into.endMs - next.startMs : 0));
  });
  if (kept.length === 0) return "pauses: no cut in a pause";
  const sorted = [...kept].sort((a, b) => a - b);
  return `pauses: the cuts keep about ${Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0)} ms of pause each`;
}

/** How tight a zoom may be asked, the least worth one (the punch-in recipe's own), and the step the code tries down by. */
export const ZOOM = { most: 1.3, least: 1.08, step: 0.05 } as const;
/** The most shots the room says a zoom for. */
const ZOOMED_SHOTS = 16;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * A push (slice B, Task 3): the framing moves from `from`, the footage's own where the shot starts, so that nothing jumps there
 * and no cut is made, to the tighter one, eased out; it gets there at `part` of the shot (the shot's length over the push's) and
 * holds. A still punch-in on a moment in speech is a cut in speech, which the review refuses.
 */
export interface Push {
  from: Frame;
  part: number;
}

/** A framing made by a zoom "here" (`zoomHere`): a move eased out that starts at 0 of its part and reaches its end within the shot. */
export const isPush = (framing: Shot["framing"]): boolean =>
  framing.move !== null && framing.move.ease === "out" && framing.move.part[0] === 0 && framing.move.part[1] >= 1;

/** True when a shot may be framed again by a zoom: it is still, or it is a push and a push is asked. */
const zoomable = (shot: Shot, push: Push | undefined): boolean => shot.framing.move === null || (push !== undefined && isPush(shot.framing));

/**
 * A shot framed tighter, at up to `most`, so that no error comes that the edit does not have: a text that clears the face now
 * clears it still, on every frame (Task 14: asked to punch in or to zoom slowly, the model wrote a framing and the first cut's
 * title covered the eyes, or copied another shot's framing; 0 of 9 as asked). The pan holds a line of the face where it is, as
 * the punch-in recipe does: the mouth's bottom (what sits under the face stays clear), else the face's top (what sits over it),
 * else its middle; and its middle across. The face is the box that holds every sample of it the shot shows. From `most` down in
 * steps of 0.05 to 1.08, or to just over the shot's own zoom. `slow`: a move over the whole shot, from the shot's own framing
 * (at zoom 1, with the tighter framing's pan, so the held line stays held all the way) to the tighter one. With `push`, each
 * tighter framing is the push to it from `push.from`, which is also the zoom the search stays above and where the face is
 * held from; `slow` is then the push's part, the caller's. Null when there is none, when the shot moves already (a push may be
 * made again by a push), or when it shows no face.
 */
function tighter(edit: Edit, analyses: Analyses, index: number, most: number, slow: boolean, push?: Push): Shot["framing"] | null {
  const shot = edit.shots[index];
  const clip = shot && edit.assets.find((asset) => asset.id === shot.asset);
  const analysis = shot && analysisOf(analyses, shot.asset);
  if (!shot || !clip || clip.kind !== "video" || !analysis || !zoomable(shot, push)) return null;
  const shown = analysis.faces.filter((sample, i) => sample.ms < shot.endMs && (analysis.faces[i + 1]?.ms ?? clip.ms) > shot.startMs);
  const holding = (boxes: readonly ShareBox[]): ShareBox | null => {
    if (boxes.length === 0) return null;
    const [left, top] = [Math.min(...boxes.map((box) => box.x)), Math.min(...boxes.map((box) => box.y))];
    return { x: left, y: top, w: Math.max(...boxes.map((box) => box.x + box.w)) - left, h: Math.max(...boxes.map((box) => box.y + box.h)) - top };
  };
  const sample: FaceSample = { ms: shot.startMs, face: holding(shown.flatMap((each) => (each.face ? [each.face] : []))), mouth: holding(shown.flatMap((each) => (each.mouth ? [each.mouth] : []))) };
  const own = push ? push.from : shot.framing.from;
  const now = faceOnStage(sample, clip, own);
  if (!now.face) return null;
  const stood = review(edit, analyses);
  const had = new Set(stood.filter(isError).map(sameAs));
  // An error the captions already carry may not get worse under a tighter framing (`captionsRule`: the room's rule and the loop's).
  const rule = captionsRule(edit, analyses, stood);
  const limit = Math.min(most, ZOOM.most, Math.floor(zoomLimit(clip) * 100) / 100);
  for (let zoom = limit; zoom >= Math.max(ZOOM.least, own.zoom + ZOOM.step) - 1e-9; zoom = round2(zoom - ZOOM.step)) {
    const unpanned = faceOnStage(sample, clip, { zoom, x: 0, y: 0 });
    if (!unpanned.face) return null;
    // A pan of 1 moves the picture by half of what the zoom added to the stage: the pan that brings a point back to where it was.
    const hold = (was: number, is: number, stage: number) => round2(Math.min(1, Math.max(-1, (is - was) / (((zoom - 1) * stage) / 2))));
    const x = hold(now.face.x + now.face.w / 2, unpanned.face.x + unpanned.face.w / 2, STAGE.w);
    const lines: [number, number][] = [
      ...(now.mouth && unpanned.mouth ? [[now.mouth.y + now.mouth.h, unpanned.mouth.y + unpanned.mouth.h] as [number, number]] : []),
      [now.face.y, unpanned.face.y],
      [now.face.y + now.face.h / 2, unpanned.face.y + unpanned.face.h / 2],
    ];
    for (const [was, is] of lines) {
      const to: Frame = { zoom, x, y: hold(was, is, STAGE.h) };
      const framing: Shot["framing"] = push
        ? { from: push.from, move: { to, ease: "out", part: [0, push.part] } }
        : slow ? { from: own.zoom > 1 ? own : { zoom: 1, x: to.x, y: to.y }, move: { to, ease: "linear", part: [0, 1] } } : { from: to, move: null };
      const tried: Edit = { ...edit, shots: edit.shots.map((each, i) => (i === index ? { ...each, framing } : each)) };
      const found = review(tried, analyses);
      if (found.every((finding) => !isError(finding) || had.has(sameAs(finding))) && !rule.worse(tried, found)) return framing;
    }
  }
  return null;
}

/**
 * The framing a `shot.zoom` asks for (the loop's move): the shot `id` at up to `zoom`, still or `slow`, or with `push` the push to
 * it (`zoomHere`); or why it has none, in words the model can pass on: the shot moves already, a title or a call-out is in the
 * way (a tighter framing fits once they are gone), or nothing fits. A push starts on the footage's own framing, so its start is
 * no cut; only its end can be one, where the footage runs on.
 */
export function zoomFor(edit: Edit, analyses: Analyses, id: string, zoom: number, slow: boolean, push?: Push): { framing: Shot["framing"] } | { none: string } {
  const index = edit.shots.findIndex((shot) => shot.id === id);
  const shot = edit.shots[index];
  if (!shot) return { none: `there is no shot "${id}"` };
  if (!zoomable(shot, push)) return { none: `shot "${id}" moves already: set its framing plain first, or leave it` };
  const framing = tighter(edit, analyses, index, zoom, slow, push);
  if (framing) return { framing };
  const own = push ? push.from : shot.framing.from;
  if (own.zoom + ZOOM.step > Math.min(zoom, ZOOM.most) + 1e-9) return { none: `shot "${id}" is at ${own.zoom} already: a zoom there asks for more than that, up to ${ZOOM.most}` };
  // Why nothing fits, as it is: a file too small to enlarge, no face to hold, a text in the way, a cut in speech, or the captions.
  const clip = edit.assets.find((asset) => asset.id === shot.asset);
  if (clip?.kind !== "video") return { none: `shot "${id}" shows a picture, not a take: there is no face to hold while it zooms` };
  if (Math.floor(zoomLimit(clip) * 100) / 100 < Math.max(ZOOM.least, own.zoom + ZOOM.step) - 1e-9) return { none: `shot "${id}" cannot be enlarged further: its file is too small` };
  const samples = analysisOf(analyses, shot.asset)?.faces ?? [];
  if (!samples.some((sample, i) => sample.face !== null && sample.ms < shot.endMs && (samples[i + 1]?.ms ?? clip.ms) > shot.startMs)) return { none: `shot "${id}" shows no face to hold while it zooms` };
  const bare = withoutTexts(edit);
  const blocked = (bare.items.length < edit.items.length || bare.shots.some((each, i) => each.marks.length < (edit.shots[i]?.marks.length ?? 0))) && tighter(bare, analyses, index, zoom, slow, push) !== null;
  if (blocked) return { none: `shot "${id}" has no room to zoom in: a title or a call-out shows over it, and the face would run into it` };
  // Framed apart from its neighbour, a shot's start and end are cuts, and a cut lies in a pause: a piece split off in speech cannot be zoomed.
  const to: Frame = { ...own, zoom: round2(own.zoom + ZOOM.step) };
  const least: Shot["framing"] = push ? { from: push.from, move: { to, ease: "out", part: [0, push.part] } } : { from: to, move: null };
  const had = new Set(review(edit, analyses).filter(isError).map(sameAs));
  const inSpeech = review({ ...edit, shots: edit.shots.map((each, i) => (i === index ? { ...each, framing: least } : each)) }, analyses).some((finding) => finding.code === "cut-outside-pause" && !had.has(sameAs(finding)));
  const cut = push ? "it ends in speech, where a framing held to its end would make a cut" : 'it starts or ends in speech, where a framing may not change: give shot.zoom the "word" to start at and let it split the shot in the pause before, or zoom a shot that starts and ends in pauses';
  return { none: `shot "${id}" has no room to zoom in: ${inSpeech ? cut : "at every tighter framing its face would run into the captions"}` };
}

/**
 * Where a zoom that is to start at a word begins (Task 14, fix round 3): the cut@ of the last measured pause of the shot's take
 * that lies inside the shot, half a second or more after its start and at or before the word's start; null when the word is
 * not said in the shot or no such pause is (the shot itself then starts as near the word as a clean cut gets). Asked to punch in "when I say" a word,
 * the model split the shot at the word, in speech, 6 runs of 6.
 */
export function pauseBefore(edit: Edit, analyses: Analyses, id: string, word: number): number | null {
  const shot = edit.shots.find((each) => each.id === id);
  const clip = shot && edit.assets.find((asset) => asset.id === shot.asset);
  const said = clip?.kind === "video" ? clip.words?.[word] : undefined;
  if (!shot || !said || said.startMs < shot.startMs || said.startMs >= shot.endMs) return null;
  // Not within half a second of the shot's own start: the shot starts there as good as the piece would.
  const cuts = (analysisOf(analyses, shot.asset)?.pauses ?? []).map((pause) => pause.cutMs).filter((cut) => cut >= shot.startMs + PIECE_MS && cut <= said.startMs && cut < shot.endMs);
  return cuts.length > 0 ? Math.max(...cuts) : null;
}

/** The least a split for a zoom leaves before it: under it the shot is zoomed whole. */
const PIECE_MS = 500;

/**
 * The id of a piece split off shot `id` for a zoom: `<id>-<tag>`, then `<id>-<tag>2`, … until one no shot, mark, item or file of
 * the edit has. An id is at most 40 characters: a long one is cut short before its piece's mark.
 */
export function pieceId(edit: Edit, id: string, tag: string): string {
  const used = new Set([...edit.shots.flatMap((shot) => [shot.id, ...shot.marks.map((mark) => mark.id)]), ...edit.items.map((item) => item.id), ...edit.assets.map((asset) => asset.id)]);
  const stem = `${id.slice(0, 36)}-${tag}`;
  let piece = stem;
  for (let k = 2; used.has(piece); k++) piece = `${stem}${k}`;
  return piece;
}

/**
 * The zoom's line (Task 14): for each shot of a take that does not move already, how tight `shot.zoom` may take it with every
 * text still clear of the face, as a punch-in:
 *
 *   zoom: shot.zoom may take s1 to 1.1; s2 to 1.3; s3 (now 1.15) to 1.3; s4 no further (a title or a call-out is in the way)
 *
 * Past `ZOOMED_SHOTS` shots it says only that the move says what fits.
 */
function zoomRoom(edit: Edit, analyses: Analyses): string[] {
  const shots = edit.shots.flatMap((shot, i) => (edit.assets.some((asset) => asset.id === shot.asset && asset.kind === "video") && shot.framing.move === null ? [i] : []));
  if (shots.length === 0) return [];
  if (shots.length > ZOOMED_SHOTS) return [`zoom: ${shots.length} shots; shot.zoom frames the one it is asked for, or says why it cannot`];
  const said = shots.map((i) => {
    const shot = edit.shots[i];
    if (!shot) return "";
    const now = shot.framing.from.zoom > 1 ? ` (now ${shot.framing.from.zoom})` : "";
    const framing = tighter(edit, analyses, i, ZOOM.most, false);
    if (framing) return `${shot.id}${now} to ${framing.from.zoom}`;
    const found = zoomFor(edit, analyses, shot.id, ZOOM.most, false);
    return `${shot.id}${now} no further${"none" in found && found.none.includes("a title or a call-out") ? " (a title or a call-out is in the way)" : ""}`;
  });
  return [`zoom: shot.zoom may take ${said.join("; ")}`];
}

/** A stretch of the film a new text is tried over: its frames, from `from` up to `to`. */
interface Stretch {
  from: number;
  to: number;
}

/** The film from its start, and from each title's or call-out's first and last frame, to the next, in equal pieces no longer than `longest`. */
function roomStretches(edit: Edit, longest: number): Stretch[] {
  const frames = layout(edit).frames;
  const texts = placed(edit).filter((place) => place.thing.part === "title" || place.thing.part === "callout");
  const edges = [0, frames, ...texts.flatMap((place) => [place.at, place.at + place.frames])];
  const cuts = [...new Set(edges.filter((frame) => frame >= 0 && frame <= frames))].sort((a, b) => a - b);
  const stretches: Stretch[] = [];
  cuts.slice(0, -1).forEach((from, i) => {
    const to = cuts[i + 1] ?? from;
    const pieces = Math.ceil((to - from) / longest);
    for (let piece = 0; piece < pieces; piece++) {
      const [a, b] = [from + Math.round((piece * (to - from)) / pieces), from + Math.round(((piece + 1) * (to - from)) / pieces)];
      if (b > a) stretches.push({ from: a, to: b });
    }
  });
  return stretches;
}

/** The text tried over a stretch at one height: a call-out for one line, a title for two. */
function probe(kind: "line" | "title", stretch: Stretch, index: number, y: number, font: Captions["font"]): Item {
  const item = { id: `${PROBE_ID}${index}`, anchor: "start" as const, at: stretch.from, frames: stretch.to - stretch.from };
  return kind === "line"
    ? { ...item, part: "callout", props: { text: ROOM_PROBE.line, font, look: "pop", x: 0.5, y, size: ROOM_PROBE.size, color: "#ffffff" } }
    : { ...item, part: "title", props: { text: ROOM_PROBE.title, font, look: "bold", y, size: ROOM_PROBE.size, color: "#ffffff", accent: null } };
}

/** For each stretch, the heights a new text of `kind` is clear at: one review a height, with a text tried over every stretch at once. */
function clearHeights(edit: Edit, analyses: Analyses, stretches: readonly Stretch[], kind: "line" | "title"): number[][] {
  const clear: number[][] = stretches.map(() => []);
  for (const y of ROOM_YS) {
    const tried: Edit = { ...edit, items: [...edit.items, ...stretches.map((stretch, i) => probe(kind, stretch, i, y, edit.captions.font))] };
    const blocked = new Set<number>();
    for (const finding of review(tried, analyses)) {
      const id = finding.where.item;
      if (id?.startsWith(PROBE_ID) && blocks(finding)) blocked.add(Number(id.slice(PROBE_ID.length)));
      // Two titles at once are told at the later one, which may be the edit's own: the stretch that frame is in has no place.
      if (finding.code === "two-titles") stretches.forEach((stretch, i) => finding.where.frame >= stretch.from && finding.where.frame < stretch.to && blocked.add(i));
    }
    stretches.forEach((_, i) => blocked.has(i) || clear[i]?.push(y));
  }
  return clear;
}

/** The lines of the stretches: see `roomText`. */
function stretchLines(edit: Edit, analyses: Analyses, longest: number): string[] {
  const lay = layout(edit);
  // Each title that stays starts a stretch (its first frame is an edge). Over a stretch that starts after it, it is not counted,
  // as the room would be with it ended where the new text starts; over one that starts before it or on its frame, it is, as the
  // move gives way only to a later text (the final fix wave). One pass of probes for each set of titles left out.
  const stretches = roomStretches(edit, longest);
  const line: number[][] = stretches.map(() => []);
  const title: number[][] = stretches.map(() => []);
  const groups = new Map<string, number[]>();
  stretches.forEach((stretch, i) => {
    const key = withoutStaying(edit, stretch.from).items.map((item) => item.id).join(" ");
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  for (const indices of groups.values()) {
    const first = stretches[indices[0] ?? 0];
    const open = first ? withoutStaying(edit, first.from) : edit;
    const these = indices.flatMap((i) => stretches[i] ?? []);
    const [ones, twos] = [clearHeights(open, analyses, these, "line"), clearHeights(open, analyses, these, "title")];
    indices.forEach((index, k) => {
      line[index] = ones[k] ?? [];
      title[index] = twos[k] ?? [];
    });
  }
  const lines: (Stretch & { places: string })[] = [];
  stretches.forEach((stretch, i) => {
    const places = `one line ${rangesOf(line[i] ?? [])}; two lines ${rangesOf(title[i] ?? [])}`;
    const last = lines.at(-1);
    if (last && last.to === stretch.from && last.places === places) last.to = stretch.to;
    else lines.push({ ...stretch, places });
  });
  return lines.map(({ from, to, places }) => {
    // The shots that show in the stretch, and the words that start while they do, by the file time of each one's frames in it.
    const shown = edit.shots.flatMap((shot, i) => {
      const place = lay.shots[i];
      if (!place || place.at >= to || place.at + place.frames <= from) return [];
      const msAt = (frame: number) => shot.startMs + msOf(frame - place.at, shot.speed);
      return [{ shot, fromMs: msAt(Math.max(from, place.at)), toMs: msAt(Math.min(to, place.at + place.frames)) }];
    });
    const [first, last] = [shown[0], shown.at(-1)];
    if (!first || !last) return `film=${filmOf(from, to - from)}: ${places}`;
    const clip = edit.assets.find((asset) => asset.id === first.shot.asset);
    // Words are counted per take: named only when the stretch shows one take.
    const oneTake = shown.every((each) => each.shot.asset === first.shot.asset);
    const said = (oneTake && clip?.kind === "video" ? (clip.words ?? []) : []).flatMap((word, w) => (shown.some((each) => word.startMs >= each.fromMs && word.startMs < each.toMs) ? [w] : []));
    const words = said.length === 0 ? "" : said.length === 1 ? ` w${said[0]}` : ` w${said[0]}-w${said.at(-1)}`;
    return `film=${filmOf(from, to - from)} shot ${first.shot.id}${last === first ? "" : `..${last.shot.id}`}${words}: ${places}`;
  });
}

/**
 * Where a text the review refused for its place has room, as one sentence for the repair message; null when the finding is not
 * about a title's, a call-out's or the captions' place. `refused` is the edit the answer would have made, `before` the edit as
 * it stood (whose errors on other texts are not the answer's).
 * - A title or a call-out (`on-face`, `under-buttons`, `on-text`): tried at each height as it is, over its own frames, with its
 *   own words; when its size has no place, at each smaller size down to the smallest, 15 % at a time.
 * - The captions (`on-face`, `under-buttons`, `text-fits`): their room as the answer set them (`captionsRoom` of the refused
 *   edit): where they would be clear in that look, at that size and count of words; or, with no room so, the largest settings
 *   that have a place. (Asked for the pill look on the owner's first cut, the model set it at the size bare words fitted at,
 *   three times, and gave up: a box takes more room, and the room of the edit as it stood did not say how much.)
 */
export function roomFor(refused: Edit, analyses: Analyses, finding: Finding, before: Edit = refused): string | null {
  if (ofCaptions(finding)) return captionsHint(refused, analyses, before);
  if (finding.code === "cut-outside-pause") return cutsNear(refused, analyses, finding, before);
  if (finding.code !== "on-face" && finding.code !== "under-buttons" && finding.code !== "on-text") return null;
  const id = finding.where.mark ?? finding.where.item;
  const thing = id === undefined ? undefined : [...refused.shots.flatMap((shot) => shot.marks), ...refused.items].find((each) => each.id === id);
  if (!thing || (thing.part !== "title" && thing.part !== "callout")) return null;
  const placedAt = (y: number, size: number): Edit => {
    const moved = <T extends Mark | Item>(each: T): T => (each.id === id && (each.part === "title" || each.part === "callout") ? { ...each, props: { ...each.props, y, size } } : each);
    return { ...refused, shots: refused.shots.map((shot) => ({ ...shot, marks: shot.marks.map(moved) })), items: refused.items.map(moved) };
  };
  // A title that stays to the end and starts before this one gives way to it (`labelGivesWay`): it is not counted, as in the
  // room; one that starts on its frame or after it is (the final fix wave: the move and the room agree).
  const startsAt = placed(refused).find((place) => place.thing.id === id)?.at ?? 0;
  const clearAt = (size: number): number[] =>
    ROOM_YS.filter((y) => review(withoutStaying(placedAt(y, size), startsAt, id), analyses).every((found) => !((found.where.mark ?? found.where.item) === id && blocks(found)) && found.code !== "two-titles"));
  const least = PARTS[thing.part].props.shape.size.minValue ?? thing.props.size;
  for (let size = thing.props.size; size >= least; size = size === least ? least - 1 : Math.max(least, Math.round(size * 0.85))) {
    const ys = clearAt(size);
    if (ys.length === 0) continue;
    return size === thing.props.size ? `Room for it as it is: ${rangesOf(ys)}.` : `It has no room at size ${thing.props.size} while it shows; at size ${size}: ${rangesOf(ys)}.`;
  }
  return "It has no room at any size while it shows: put it at another moment (room), or leave it out and say so.";
}

/** Where the captions have room as an answer set them, for the repair message: for an error of theirs, or of a text they would cover. */
export function captionsHint(refused: Edit, analyses: Analyses, before: Edit = refused): string {
  return `Room for the captions as these ops set them: ${captionsPlaces(refused, analyses, before).line.replace(/^captions now /, "")}`;
}

/**
 * Where a cut the review found outside a pause may land (Task 14): for each side its sentence names (`shot "<id>" starts at
 * <ms> ms`, as review writes it), the clean cuts of its take on either side of that moment, each with how far off it is; and
 * for the film's own start or end, that it may also lie anywhere before the first word or after the last. Asked to cut "the
 * first second", the model was told only the nearest pause, which lay before its shot, took the next one it found, three
 * seconds on, and said it had cut one.
 */
function cutsNear(refused: Edit, analyses: Analyses, finding: Finding, edit: Edit): string | null {
  const sides = [...finding.says.matchAll(/shot "([^"]+)" (?:starts|ends)(?: and shot "[^"]+" starts)? at (\d+) ms/g)];
  const said = sides.flatMap(([, id, at]) => {
    const shot = refused.shots.find((each) => each.id === id);
    const clip = shot && refused.assets.find((asset) => asset.id === shot.asset);
    // Only cuts in footage the film shows as it stands: one outside it would bring footage in, which is no cut.
    const shown = edit.shots.filter((each) => each.asset === shot?.asset);
    const cuts = (shot ? (analysisOf(analyses, shot.asset)?.pauses ?? []) : []).map((pause) => pause.cutMs).filter((cut) => shown.some((each) => cut > each.startMs && cut < each.endMs)).sort((a, b) => a - b);
    const ms = Number(at);
    if (!shot) return [];
    const [earlier, later] = [cuts.filter((cut) => cut <= ms).at(-1), cuts.find((cut) => cut > ms)];
    const words = clip?.kind === "video" ? (clip.words ?? []) : [];
    const near = [earlier === undefined ? null : `${earlier} ms (${ms - earlier} ms earlier${afterWord(words, earlier)})`, later === undefined ? null : `${later} ms (${later - ms} ms later${afterWord(words, later)})`].filter((each) => each !== null);
    const [first, last] = [words[0], words.at(-1)];
    // The film's own end may also lie after its last word, and its start before its first: said when that is the cut asked.
    const edge = finding.says.startsWith("the film's end") && last ? last.endMs : finding.says.startsWith("the film's start") && first ? first.startMs : null;
    const film = edge === null || Math.abs(edge - ms) > CUT_NEAR_MS ? "" : finding.says.startsWith("the film's end") ? ` The film may also end anywhere from its last word's end, ${edge} ms, on.` : ` The film may also start anywhere up to its first word, at ${edge} ms.`;
    const within = [earlier, later].some((cut) => cut !== undefined && Math.abs(cut - ms) <= CUT_NEAR_MS) || film !== "";
    const where = near.length > 0 ? `The clean cuts of its take nearest ${ms} ms, in what the film shows: ${near.join(" and ")}.` : `Its take has no clean cut near ${ms} ms in what the film shows.`;
    return [`${where}${film}${within ? "" : ` None lies within ${CUT_NEAR_SAYS} of ${ms} ms: this cut cannot be made cleanly. Send "ops": [] and say so, with where the nearest clean cut is in the creator's own words (after which of their words or sentences), not in seconds.`}`];
  });
  return said.length > 0 ? said.join(" ") : null;
}

/** How far from the moment asked a clean cut may lie and still be the cut asked (Task 14b: one second; said in one place). */
export const CUT_NEAR_MS = 1000;
/** `CUT_NEAR_MS` in words, for the prompt and the hints. */
export const CUT_NEAR_SAYS = "one second";

/** ", after w<i> "<text>"" for the last word of a take that ends at or before a moment; "" when none does. With the sentence it closes, when it closes one. */
function afterWord(words: readonly { text: string; endMs: number }[], ms: number): string {
  const index = words.findLastIndex((word) => word.endMs <= ms);
  const word = words[index];
  if (!word) return "";
  const closes = /[.!?]["”’']?$/.test(word.text);
  const sentence = words.slice(0, index + 1).filter((each) => /[.!?]["”’']?$/.test(each.text)).length;
  return `, after w${index} "${word.text}"${closes ? `, the end of sentence ${sentence}` : ""}`;
}

/* ── the film's ends ──────────────────────────────────────────────────────────────────────────── */

/**
 * The trims that cut off what the film shows before its first word, after its last, or both (the loop's move `ends.trim`,
 * Task 14b): by the rule the tighten recipe cuts the film's own ends by, at its shortest pause, so a breath stays next to the
 * word. Asked to remove what comes after the last word, the model was right in 1, 2, 2, 1, 3 and 0 of 3 runs over six
 * wordings of the prompt, and on a second take it took the whole last shot out with its words; so the model says only which
 * end. Or why not: the film already starts or ends on its words (less than a frame could go).
 */
export function endsTrim(edit: Edit, analyses: Analyses, which: { start: boolean; end: boolean }): { ops: Op[] } | { none: string } {
  const [first, last] = [edit.shots[0], edit.shots.at(-1)];
  const tight = applyOps(edit, tighten(edit, analyses, { pauseMs: PAUSE_MS.min }), []);
  const [head, tail] = tight.ok ? [tight.edit.shots[0], tight.edit.shots.at(-1)] : [undefined, undefined];
  const ops: Op[] = [];
  if (which.start && first && head && head.id === first.id && head.startMs - first.startMs >= msOf(1, first.speed)) ops.push({ op: "shot.trim", id: first.id, startMs: head.startMs });
  if (which.end && last && tail && tail.asset === last.asset && last.endMs - tail.endMs >= msOf(1, last.speed)) ops.push({ op: "shot.trim", id: last.id, endMs: tail.endMs });
  if (ops.length > 0) return { ops };
  const where = which.start && which.end ? "starts on its first word and ends on its last" : which.start ? "starts on its first word" : "ends on its last word";
  return { none: `the film already ${where}: nothing is left to take off there. Send "ops": [] and say that it already does` };
}

/* ── a cut by time ────────────────────────────────────────────────────────────────────────────── */

/** A moment of the film a cut may land on: its film time in milliseconds, the shot it lies in or starts (by its place in the edit), and the moment of that shot's file. */
export interface CutPoint {
  film: number;
  index: number;
  ms: number;
}

/** The film's end as a cut point, on its last shot: `frames` is the film's length. */
function filmEnd(edit: Edit, frames: number): CutPoint {
  const last = edit.shots.length - 1;
  return { film: msOf(frames, 1), index: last, ms: edit.shots[last]?.endMs ?? 0 };
}

/** Every moment a cut may land on, in film order: each shot's start, each pause's cut@ inside a shot, and the film's end. */
export function cleanCuts(edit: Edit, analyses: Analyses): CutPoint[] {
  const lay = layout(edit);
  const startOf = (i: number): number => msOf(lay.shots[i]?.at ?? 0, 1);
  const points: CutPoint[] = edit.shots.flatMap((shot, i) => {
    const cuts = (analysisOf(analyses, shot.asset)?.pauses ?? []).map((pause) => pause.cutMs).filter((cut) => cut > shot.startMs && cut < shot.endMs);
    return [{ film: startOf(i), index: i, ms: shot.startMs }, ...cuts.map((cut) => ({ film: startOf(i) + (cut - shot.startMs) / shot.speed, index: i, ms: cut }))];
  });
  return [...points, filmEnd(edit, lay.frames)].sort((a, b) => a.film - b.film);
}

/**
 * The ops that take the film's time from `fromMs` up to `toMs` out (the loop's move `time.cut`, Task 14b), each end landed on
 * the nearest clean cut within `CUT_NEAR_MS`: the film's own start or end, a cut between shots, or the cut@ of a measured pause
 * in what a shot shows. Asked to cut "the first second" the model trimmed by hand: into a word, or to the next pause three
 * seconds on, or by a tenth of a second, and said one second each time; told to refuse where no cut lay within half a second,
 * it refused 3 of 3. A creator who asks for a second wants the opening shorter, not a clipped word (the controller's ruling):
 * so the code lands the cut and says how much went (`says`, the end of the say's sentence; null when it is what was asked).
 * Or why not, with the nearest clean cuts and the words they follow, when an end has none within reach.
 */
export function timeCut(edit: Edit, analyses: Analyses, fromMs: number, toMs: number): { ops: Op[]; says: string | null } | { none: string } {
  const lay = layout(edit);
  const total = msOf(lay.frames, 1);
  const all = cleanCuts(edit, analyses);
  const end = filmEnd(edit, lay.frames);
  const wordsOfShot = (index: number) => {
    const clip = edit.assets.find((asset) => asset.id === edit.shots[index]?.asset);
    return clip?.kind === "video" ? (clip.words ?? []) : [];
  };
  /**
   * The point a moment lands on, among those after `after` and before `before` (the other end's own moment is no place for
   * this one: a cut from the film's start that found its nearest clean cut in that same start took nothing out, and named no
   * place); or why none is in reach, with the nearest on either side and the words they follow.
   */
  const land = (at: number, after = -1, before = Infinity): CutPoint | string => {
    if (at <= 0) return all[0] ?? end;
    if (at >= total - msOf(1, 1)) return end;
    const open = all.filter((point) => point.film > after + msOf(1, 1) && point.film < before - msOf(1, 1));
    const nearest = open.reduce<CutPoint | null>((best, point) => (best === null || Math.abs(point.film - at) < Math.abs(best.film - at) ? point : best), null);
    if (nearest && Math.abs(nearest.film - at) <= CUT_NEAR_MS) return nearest;
    const told = (point: CutPoint | undefined): string | null => (point ? `${(point.film / 1000).toFixed(1)} s into the film${afterWord(wordsOfShot(point.index), point.ms)}` : null);
    const near = [told(open.filter((point) => point.film <= at).at(-1)), told(open.find((point) => point.film > at))].filter((each) => each !== null);
    return `no clean cut lies within ${CUT_NEAR_SAYS} of ${(at / 1000).toFixed(1)} s of the film${near.length > 0 ? `: the nearest ${near.length === 1 ? "is" : "are"} ${near.join(" and ")}` : ""}`;
  };
  if (!(fromMs < toMs)) return { none: 'time.cut takes "fromMs" before "toMs", both in the film\'s own time' };
  // The end that is the film's own (its start, its end) stands; the other is looked for on its side of it.
  const fromStart = fromMs <= 0;
  const a = fromStart ? land(fromMs) : land(fromMs, -1, toMs >= total - msOf(1, 1) ? total : Infinity);
  const b = land(toMs, typeof a === "string" ? -1 : a.film);
  const unreachable = [a, b].filter((each) => typeof each === "string");
  if (typeof a === "string" || typeof b === "string") return { none: `${unreachable.join("; ")}. Send "ops": [] and say that it cannot be cut there without clipping a word, and where the nearest clean cut is in the creator's own words (after which of their words or sentences), not in seconds` };
  if (b.film - a.film < msOf(1, 1)) return { none: "the nearest clean cuts to both ends are one and the same moment: there is nothing to take out between them" };
  if (a.film <= 0 && b.film >= total) return { none: "that would take the whole film out" };
  // The shots between the two points go; the one each lies in is trimmed to it, or split when both lie in one.
  const used = new Set([...edit.shots.flatMap((shot) => [shot.id, ...shot.marks.map((mark) => mark.id)]), ...edit.items.map((item) => item.id), ...edit.assets.map((asset) => asset.id)]);
  const ops: Op[] = [];
  const [first, second] = [edit.shots[a.index], edit.shots[b.index]];
  if (!first || !second) return { none: "the film has no shot there" };
  const atStart = a.ms <= first.startMs;
  const atEnd = b.ms >= second.endMs;
  if (a.index === b.index) {
    if (atStart && atEnd) ops.push({ op: "shot.remove", id: first.id });
    else if (atStart) ops.push({ op: "shot.trim", id: first.id, startMs: b.ms });
    else if (atEnd) ops.push({ op: "shot.trim", id: first.id, endMs: a.ms });
    else {
      let piece = `${first.id.slice(0, 36)}-c`;
      for (let k = 2; used.has(piece); k++) piece = `${first.id.slice(0, 36)}-c${k}`;
      ops.push({ op: "shot.split", id: first.id, atMs: b.ms, newId: piece }, { op: "shot.trim", id: first.id, endMs: a.ms });
    }
  } else {
    ops.push(atStart ? { op: "shot.remove", id: first.id } : { op: "shot.trim", id: first.id, endMs: a.ms });
    for (let i = a.index + 1; i < b.index; i++) ops.push({ op: "shot.remove", id: edit.shots[i]?.id ?? "" });
    // A point at a shot's own start cuts nothing of that shot.
    if (b.ms > second.startMs) ops.push(atEnd ? { op: "shot.remove", id: second.id } : { op: "shot.trim", id: second.id, startMs: b.ms });
  }
  const [asked, made] = [Math.min(toMs, total) - Math.max(0, fromMs), b.film - a.film];
  const seconds = `${(made / 1000).toFixed(1)} s`;
  const says = Math.abs(made - asked) < 50 ? null : a.film <= 0 ? `the first ${seconds}, up to the pause, so no word is clipped` : b.film >= total ? `the last ${seconds}, from the pause on, so no word is clipped` : `${seconds} in all, from pause to pause, so no word is clipped`;
  return { ops, says };
}

/* ── the label that stays gives way, and an asked stress shows (Task 9b) ──────────────────────── */

/** How many frames before the first text in its way a title that stays to the end is ended (ruling 1b). */
export const LABEL_GAP = 6;
/** The fewest frames a title that stays keeps when it gives way, 1.5 s: with fewer left, it is taken out (ruling 1b). */
export const LABEL_LEAST = 45;

/** A title that stays to the film's end: an item whose length is left open, as the house's hook is. */
export const staysToEnd = (thing: Mark | Item): thing is Extract<Item, { part: "title" }> => thing.part === "title" && "anchor" in thing && thing.frames === null;

/**
 * The edit without the titles that stay to the end which give way to a new text starting at frame `from`: those that start
 * before it (`labelGivesWay` gives way only to a later text), but `keep`, the new text itself when it is one.
 */
function withoutStaying(edit: Edit, from: number, keep?: string): Edit {
  const gone = new Set(placed(edit).flatMap((place) => (staysToEnd(place.thing) && place.thing.id !== keep && place.at < from ? [place.thing.id] : [])));
  return gone.size > 0 ? { ...edit, items: edit.items.filter((item) => !gone.has(item.id)) } : edit;
}

/** The edit with only `ids` of its titles and call-outs, and its captions off: what the review finds between those texts alone. */
function onlyTexts(edit: Edit, ids: readonly string[]): Edit {
  const kept = (thing: Mark | Item): boolean => (thing.part !== "title" && thing.part !== "callout") || ids.includes(thing.id);
  return { ...edit, captions: { ...edit.captions, on: false }, shots: edit.shots.map((shot) => ({ ...shot, marks: shot.marks.filter(kept) })), items: edit.items.filter(kept) };
}

/** A text's words as the creator reads them: no asterisks, no closing punctuation. */
const bareText = (text: string): string => text.replaceAll("*", "").replace(/[.,!?:;…]+$/, "");
/** A title or a call-out, named as the creator reads it. */
const textName = (thing: Mark | Item): string => (thing.part === "title" || thing.part === "callout" ? `the ${thing.part === "title" ? "title" : "call-out"} "${bareText(thing.props.text)}"` : `the ${thing.part}`);

/** What `labelGivesWay` did to a title it ended: its id, the length it set, and the text it gave way to, named as the creator reads it. */
export interface GaveWay {
  id: string;
  frames: number;
  to: string;
}

/** True when `thing`, a title that stayed to the end in `before`, now has its length set. */
const endedLabel = (old: Mark | Item, thing: Mark | Item): boolean => staysToEnd(old) && "anchor" in thing && thing.frames !== null;

/** The move that ended `thing` there, if the move did: its length is still the one the move set (fix round 1: not inferred). */
const endedBy = (gave: readonly GaveWay[], thing: Mark | Item): GaveWay | undefined =>
  gave.find((each) => each.id === thing.id && "anchor" in thing && thing.frames === each.frames);

/**
 * The label that stays gives way (ruling 1b), a move the code makes on every answer that passed the door, before the review:
 * each title that stays to the end, the earliest first, against every other title and call-out. Where another title shows
 * with it (the review's `two-titles`), or a call-out's box comes near its box on a frame they share (the review's `on-text`,
 * judged by the review on the two texts alone), it is ended `LABEL_GAP` frames before the first such text starts; with under
 * `LABEL_LEAST` frames of it left, it is taken out instead. Only to a text that starts after it (fix round 1): one that starts
 * before it or on its frame is left to the review, as any two texts are, so a creator's own closing line that stays is not
 * taken out for a call-out already showing. It does not come back after that text (1c).
 *
 * A label that gave way keeps giving way to that text (the final fix wave, widening 1d by this case): a title whose end in
 * `was`, the edit before the change, sat exactly `LABEL_GAP` frames before a later title's or call-out's start gave way to it;
 * when the change makes the two meet (a cut before that text moves it earlier), it is ended again `LABEL_GAP` before it, by the
 * same rule and told the same way. It never grows back. Every other title with its length set, and every other part, is left
 * as it is (1d). `says` is the code's part of the say for each title that gave way (1e); `gave`, each title it ended, for the
 * facts and the code's own sentence (`effectOf`, `saidOf`), which tell only what the move did.
 */
export function labelGivesWay(edit: Edit, analyses: Analyses, library: readonly Asset[] = [], was: Edit = edit): { ops: Op[]; says: string[]; gave: GaveWay[] } {
  const ops: Op[] = [];
  const says: string[] = [];
  const gave: GaveWay[] = [];
  const isText = (place: Placed): boolean => place.thing.part === "title" || place.thing.part === "callout";
  // The text each title with its length set gave way to in `was`: the one starting `LABEL_GAP` after its end.
  const then = placed(was);
  const gaveTo = (id: string): string | null => {
    const own = then.find((place) => place.thing.id === id);
    if (!own || own.thing.part !== "title" || !("anchor" in own.thing) || own.thing.frames === null) return null;
    return then.find((place) => isText(place) && place.thing.id !== id && place.at === own.at + own.frames + LABEL_GAP)?.thing.id ?? null;
  };
  // The titles that give way, the earliest first: each that stays to the end, to any later text; each that gave way, to its text.
  const soft = placed(edit)
    .flatMap((place) => (staysToEnd(place.thing) ? [{ place, to: null }] : place.thing.part === "title" && "anchor" in place.thing ? [{ place, to: gaveTo(place.thing.id) }].filter((each) => each.to !== null) : []))
    .sort((a, b) => a.place.at - b.place.at);
  let on = edit;
  for (const { place: { thing }, to } of soft) {
    const now = placed(on);
    const label = now.find((place) => place.thing.id === thing.id);
    if (!label) continue;
    const [first] = now
      .filter((other) => isText(other) && other.thing.id !== thing.id && (to === null || other.thing.id === to)
        && other.at > label.at && other.at < label.at + label.frames
        && review(onlyTexts(on, [thing.id, other.thing.id]), analyses).some((found) => found.code === "two-titles" || found.code === "on-text"))
      .sort((a, b) => a.at - b.at);
    if (!first) continue;
    const frames = first.at - LABEL_GAP - label.at;
    const op: Op = frames < LABEL_LEAST ? { op: "item.remove", id: thing.id } : { op: "item.set", id: thing.id, frames };
    const made = applyOps(on, [op], library);
    if (!made.ok) continue;
    on = made.edit;
    ops.push(op);
    says.push(frames < LABEL_LEAST ? `so ${textName(thing)} is taken out: too little of it would show before ${textName(first.thing)}` : `so ${textName(thing)} now ends where ${textName(first.thing)} starts`);
    if (frames >= LABEL_LEAST) gave.push({ id: thing.id, frames, to: textName(first.thing) });
  }
  return { ops, says, gave };
}

/** Captions that draw every word alike: plain, with a weight and no highlight colour (Task 3's even line), where a stress shows nothing. */
export const evenLine = (captions: Pick<Captions, "look" | "weight" | "highlight">): boolean => sentenceSet(captions) && captions.highlight === null;

/** The stressed words an edit's captions draw in colour (plain captions, on, with a highlight colour), by take and index, with their text. */
function standingOut(edit: Edit): Map<string, { index: number; text: string }> {
  const { on, look, highlight } = edit.captions;
  if (!on || look !== "plain" || highlight === null) return new Map();
  return new Map(edit.assets.flatMap((asset) => (asset.kind === "video" ? (asset.words ?? []).flatMap((word, index) => (word.stress ? [[`${asset.id} ${index}`, { index, text: word.text }] as const] : [])) : [])));
}

/** The words that stand out in colour in `after` and did not in `before`: newly stressed, or stressed when the colour came on. */
function newlyOut(before: Edit, after: Edit): { index: number; text: string }[] {
  const had = standingOut(before);
  return [...standingOut(after)].flatMap(([key, word]) => (had.has(key) ? [] : [word]));
}

/** A highlight colour in a creator's words: `MARKED` is yellow; any other is "colour". */
const hueOf = (highlight: string | null): string => (highlight === MARKED ? "yellow" : "colour");

/**
 * An asked stress shows (ruling 2b), a move the code makes on every answer that passed the door: where its ops stress a word
 * (`word.set` with `stress` true, and the word stressed in `after`) and the captions are on and draw every word alike
 * (`evenLine`), their highlight colour is set to `MARKED`, so the stressed words are drawn in it and a step heavier
 * (`captionWeights`). Keyed on the ops, not on what differs: a word already marked (a first cut's) and asked for again is a
 * stress asked. A stress taken off leaves the colour as it is (2c). `says` is the code's part of the say.
 */
export function stressShows(before: Edit, after: Edit, ops: readonly unknown[]): { ops: Op[]; says: string[] } {
  const stressed = (asset: unknown, index: unknown): boolean => {
    const clip = after.assets.find((each) => each.id === asset);
    return clip?.kind === "video" && typeof index === "number" && clip.words?.[index]?.stress === true;
  };
  const asked = ops.some((op) => {
    const sent = typeof op === "object" && op !== null ? (op as { op?: unknown; asset?: unknown; index?: unknown; stress?: unknown }) : null;
    return sent?.op === "word.set" && sent.stress === true && stressed(sent.asset, sent.index);
  });
  if (!asked || !after.captions.on || !evenLine(after.captions)) return { ops: [], says: [] };
  const out = newlyOut(before, { ...after, captions: { ...after.captions, highlight: MARKED } });
  const [word] = out;
  return { ops: [{ op: "captions.set", highlight: MARKED }], says: [out.length === 1 && word ? `so "${bareText(word.text)}" now stands out in yellow` : "so the stressed words now stand out in yellow"] };
}

/** A label call-out where the captions draw every word alike (`calloutVoice`): its sizes, and its letters with no label title. Here, not in `prompt.ts`'s `CRAFT`, which reads them: `prompt.ts` imports this file. */
export const CALLOUT_LABEL = { px: [72, 96], ink: "#111111" } as const;

type CalloutWeight = NonNullable<Extract<Mark, { part: "callout" }>["props"]["weight"]>;

/** A text without what it quotes (a title's words, a call-out's): the creator's own text is not a say's wording, nor a request's naming. */
export const unquoted = (text: string): string => text.replace(/"[^"]*"|“[^”]*”|‘[^’]*’|(?<![\p{L}])'[^']*'(?![\p{L}])/gu, " ");

/**
 * What a creator names of a text's look in a request (the fix wave, F1): a colour, a look, a weight. Read on the request with its
 * quoted words taken out, since a call-out's own words are not the creator naming a look. Whole words, any case. A creator who
 * names one of them for another reason gets the call-out as the model sent it, as before this slice.
 */
export const NAMED = {
  colour: /#[0-9a-f]{3,8}\b|\b(?:white|black|yellow|red|blue|green|orange|pink|purple|grey|gray|gold|colou?r)\b/i,
  look: /\b(?:pop|label|box|outline|outlined)\b/i,
  weight: /\b(?:bold|heavy|thick|thin|light)\b/i,
} as const;
const requestNames = (request: string, ...what: (keyof typeof NAMED)[]): boolean => what.some((each) => NAMED[each].test(unquoted(request)));

/** The plain captions' letters: the kit's `WHITE` (`src/edit/film/Captions.tsx`). A highlight in it shows nothing on them. */
const PLAIN_LETTERS = "#ffffff";

/**
 * A highlight in the plain letters' own colour is no highlight (the fix wave, F3), the first move the code makes on every answer
 * that passed the door: in one live run of three the model sent `captions.set highlight #ffffff` beside its white call-out,
 * unasked. Nothing shows on plain white words, but the captions then no longer draw every word alike and the plain film's moves
 * step aside. Where the captions are set as a sentence (`sentenceSet`) and their highlight is now `PLAIN_LETTERS` (any case),
 * was not before the answer, and the request names no colour, it is set back to none. No say of its own.
 */
export function plainHighlight(before: Edit, after: Edit, request: string): { ops: Op[]; says: string[] } {
  const white = (highlight: string | null): boolean => highlight?.toLowerCase() === PLAIN_LETTERS;
  if (!sentenceSet(after.captions) || !white(after.captions.highlight) || white(before.captions.highlight) || requestNames(request, "colour")) return { ops: [], says: [] };
  return { ops: [{ op: "captions.set", highlight: null }], says: [] };
}

/**
 * A new call-out speaks in the film's voice (ruling S6, amended 2026-11-24), a move the code makes on every answer that passed
 * the door: told so in the craft lines, the model sent the template call-out (pop, white, 800) three times of three, and once
 * the title's ink on the pop look (dark letters over dark hair). Where the captions draw every word alike (`evenLine`), each
 * call-out the answer added (in `after`, not in `before`, by id), whatever colour the model gave it, is set as a label in the
 * colour and weight of the film's first label title, or `CALLOUT_LABEL.ink` at the captions' weight with none, its size held
 * inside `CALLOUT_LABEL.px`. Left as sent: one only moved or changed, one whose words a call-out the answer took out carried
 * (moved by remove and add, F2), and every one where the request names a colour, a look or a weight (`NAMED`, F1): the
 * request, not the call-out's colour, tells what the creator named. No say of its own: the creator asked for a call-out and
 * sees one.
 */
export function calloutVoice(before: Edit, after: Edit, request: string): { ops: Op[]; says: string[] } {
  if (!evenLine(after.captions) || requestNames(request, "colour", "look", "weight")) return { ops: [], says: [] };
  const things = (edit: Edit): (Mark | Item)[] => [...edit.shots.flatMap((shot) => shot.marks), ...edit.items];
  const [had, kept] = [new Set(things(before).map((thing) => thing.id)), new Set(things(after).map((thing) => thing.id))];
  const gone = new Set(things(before).flatMap((thing) => (thing.part === "callout" && !kept.has(thing.id) ? [thing.props.text] : [])));
  const [title] = placed(after).flatMap((place) => (place.thing.part === "title" && place.thing.props.look === "label" ? [{ at: place.at, props: place.thing.props }] : [])).sort((a, b) => a.at - b.at);
  const color = title?.props.color ?? CALLOUT_LABEL.ink;
  const weight = (title ? titleWeight(title.props) : captionWeights(after.captions).plain) as CalloutWeight;
  const voiced = (props: Extract<Mark, { part: "callout" }>["props"]) => ({ look: "label" as const, color, weight, size: Math.min(CALLOUT_LABEL.px[1], Math.max(CALLOUT_LABEL.px[0], props.size)) });
  const isNew = <T extends Mark | Item>(thing: T): thing is Extract<T, { part: "callout" }> => thing.part === "callout" && !had.has(thing.id) && !gone.has(thing.props.text);
  const ops: Op[] = [
    ...after.shots.flatMap((shot) => shot.marks).filter(isNew).map((mark): Op => ({ op: "mark.set", id: mark.id, props: voiced(mark.props) })),
    ...after.items.filter(isNew).map((item): Op => ({ op: "item.set", id: item.id, props: voiced(item.props) })),
  ];
  return { ops, says: [] };
}

/* ── what a change did ────────────────────────────────────────────────────────────────────────── */

/** What a change did to an edit, as code measures it, for the model to hold against the request; and whether it is worth a look. */
export interface Effect {
  /** A line a fact: the film's length, the words cut out or brought back, what was taken out, how the captions and the texts moved. */
  lines: string[];
  /** True when it cut or brought back words, or took a title, a call-out or another part out. */
  risky: boolean;
}

/**
 * What a change did, measured (Task 14, fix round 2). The model's say and its ops did not always agree: asked for the first
 * second out, it cut three seconds (or a tenth of one) and said one; asked for captions higher, it set them 0.01 lower and said
 * higher; asked for the silence after the last word out, it took the last shot out, words and all. So after such a change the
 * loop tells it what the ops did, and it may take them back. `gave` is what the code's own move did to a title that stays
 * (`labelGivesWay`), which the two edits alone cannot tell from a length the model set.
 */
export function effectOf(before: Edit, after: Edit, gave: readonly GaveWay[] = []): Effect {
  const lines: string[] = [];
  const seconds = (edit: Edit) => layout(edit).frames / FPS;
  const [was, is] = [seconds(before), seconds(after)];
  const length = Math.abs(is - was) >= 0.05;
  if (length) lines.push(`the film is now ${is.toFixed(1)} s; it was ${was.toFixed(1)} s (${Math.abs(is - was).toFixed(1)} s ${is < was ? "shorter" : "longer"})`);
  // The words a film shows: those that start while a shot shows their take.
  const shownIn = (edit: Edit) => new Set(edit.shots.flatMap((shot) => {
    const clip = edit.assets.find((asset) => asset.id === shot.asset);
    return (clip?.kind === "video" ? (clip.words ?? []) : []).flatMap((word, i) => (word.startMs >= shot.startMs && word.startMs < shot.endMs ? [`${shot.asset} w${i}`] : []));
  }));
  const [shownBefore, shownAfter] = [shownIn(before), shownIn(after)];
  const textOf = (edit: Edit, key: string): string => {
    const [asset, index] = key.split(" w");
    const clip = edit.assets.find((each) => each.id === asset);
    return (clip?.kind === "video" ? clip.words?.[Number(index)]?.text : undefined) ?? "";
  };
  const listed = (keys: string[], edit: Edit): string => {
    const names = keys.map((key) => `w${key.split(" w")[1]}`);
    const quoted = keys.length <= 8 ? keys.map((key) => textOf(edit, key)).join(" ") : `${keys.slice(0, 4).map((key) => textOf(edit, key)).join(" ")} … ${keys.slice(-2).map((key) => textOf(edit, key)).join(" ")}`;
    return `${names.length === 1 ? names[0] : `${names[0]} to ${names.at(-1)}`} (${keys.length} ${keys.length === 1 ? "word" : "words"}: "${quoted}")`;
  };
  const cut = [...shownBefore].filter((key) => !shownAfter.has(key));
  const back = [...shownAfter].filter((key) => !shownBefore.has(key));
  if (cut.length > 0) lines.push(`words cut out of the film: ${listed(cut, before)}`);
  if (back.length > 0) lines.push(`words now in the film that were not: ${listed(back, after)}`);
  if (length && cut.length === 0 && back.length === 0) lines.push("no word was cut out or brought in");
  const things = (edit: Edit) => new Map([...edit.shots.flatMap((shot) => shot.marks), ...edit.items].map((thing) => [thing.id, thing] as const));
  const [had, has] = [things(before), things(after)];
  const named = (thing: Mark | Item): string => (thing.part === "title" || thing.part === "callout" ? `the ${thing.part === "title" ? "title" : "call-out"} "${thing.props.text.replaceAll("*", "")}"` : `the ${thing.part} "${thing.id}"`);
  const gone = [...had.values()].filter((thing) => !has.has(thing.id));
  if (gone.length > 0) lines.push(`taken out: ${gone.map(named).join(", ")}`);
  const way = (key: string, from: number, to: number): string => {
    if (key === "y") return to < from ? "higher" : "lower";
    if (key === "weight") return to > from ? "heavier" : "lighter";
    if (key === "maxWords") return to > from ? "more" : "fewer";
    return to > from ? "bigger" : "smaller";
  };
  const moved = (from: Record<string, unknown>, to: Record<string, unknown>, keys: readonly string[]): string[] =>
    keys.flatMap((key) => {
      const [a, b] = [from[key], to[key]];
      if (a === b) return [];
      return [typeof a === "number" && typeof b === "number" ? `${key} ${a} to ${b} (${way(key, a, b)})` : `${key} ${String(a)} to ${String(b)}`];
    });
  // A weight left out is the look's own, so it is told as that: 800 to 600, not undefined to 600.
  const weighed = (captions: Captions) => ({ ...captions, weight: captionWeights(captions).plain });
  const captions = moved(weighed(before.captions), weighed(after.captions), ["on", "look", "font", "size", "y", "maxWords", "highlight", "weight"]);
  // A weight left out is the one it is drawn at: a title's look's own, a call-out's 800.
  const textWeighed = (thing: Mark | Item): Record<string, unknown> => ({ ...thing.props, weight: thing.part === "title" ? titleWeight(thing.props) : thing.part === "callout" ? calloutWeight(thing.props) : null });
  if (captions.length > 0) lines.push(`the captions: ${captions.join(", ")}`);
  // A stressed word the plain look now draws in colour (Task 9b: where the code turned the colour on for it, the say tells it).
  for (const word of newlyOut(before, after)) lines.push(`the stressed word w${word.index} "${bareText(word.text)}" now stands out in ${hueOf(after.captions.highlight)}`);
  for (const [id, thing] of has) {
    const old = had.get(id);
    if (!old || (thing.part !== "title" && thing.part !== "callout") || old.part !== thing.part) continue;
    const changes = moved(textWeighed(old), textWeighed(thing), ["text", "y", "x", "size", "look", "color", "weight"]);
    // A title the move ended (Task 9b), or ended again (the final fix wave): where, said so only where the move did (`gave`);
    // else a title that stayed to the end and now ends, as for any length, where it ends.
    const by = endedBy(gave, thing);
    const stayed = staysToEnd(old) ? "; it stayed to the end" : "";
    if (by && "anchor" in old && "anchor" in thing && old.frames !== thing.frames) changes.push(`now ends where ${by.to} starts${stayed}`);
    else if (endedLabel(old, thing)) {
      const end = placed(after).find((place) => place.thing.id === id);
      changes.push(`now ends at ${(((end?.at ?? 0) + (end?.frames ?? 0)) / FPS).toFixed(1)} s${stayed}`);
    }
    if (changes.length > 0) lines.push(`${named(thing)}: ${changes.join(", ")}`);
  }
  // A length that changed with no word cut (shorter pauses, another speed) is told when there is a look, and is not worth one
  // of its own: shown one, the model took a right trim back and said it had made it.
  return { lines, risky: cut.length > 0 || back.length > 0 || gone.length > 0 };
}

/* ── the findings ─────────────────────────────────────────────────────────────────────────────── */

/**
 * What the review finds, a line each. An error is written whole, with the way to fix it. A warning is written without its fix
 * (Task 14: shown "move it down", the model moved the first cut's title and captions in answers that asked for neither, and
 * the review then refused the whole answer): it is a note the creator may live with, not work to do.
 */
function findingsText(findings: readonly Finding[]): string {
  return findings.length > 0 ? findings.map((finding) => `${finding.severity} ${finding.code} frame=${finding.where.frame} ${finding.severity === "warn" ? unfixed(finding.says) : finding.says}`).join("\n") : "none";
}

/** A finding's sentence without its last clause, the way to fix it ("…; move it up"): cut at the last "; " outside what it quotes. */
function unfixed(says: string): string {
  const at = says.lastIndexOf("; ");
  return at > says.lastIndexOf('"') ? says.slice(0, at) : says;
}

/* ── what a change did, in the creator's words ────────────────────────────────────────────────── */

/** The captions' look, in plain words: what the look draws, colour aside. */
export const LOOK_WORDS: Record<Captions["look"], string> = {
  pill: "white words on a dark box",
  pop: "bold white words",
  highlight: "words that light up on a block of colour",
  plain: "plain white words",
};
/** A count of words a page, as a creator says it. */
const COUNT_SAID = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"];
/** The film's looks, as a creator sees them. */
const LOOK_SAID: Record<Edit["look"]["preset"], string> = {
  natural: "the colours are as filmed",
  vivid: "the colours are more vivid",
  warm: "the colours are warmer",
  cool: "the colours are cooler",
  mono: "the video is in black and white",
  soft: "the colours are softer",
};
/** The most the code's sentence tells of at once. */
const SAID_MOST = 3;

/**
 * What a change did, as one short sentence for the creator, written by the code from the two edits (the last correction,
 * 2026-11-24). It is what the creator reads when the model's own sentence cannot be shown, twice: not English, more than one
 * sentence, the kit's words, or a claim the ops do not bear out. It need not be elegant; it is true: each part is read off
 * what differs between `before` and `after`, in a creator's words, with no number but a count of words a page. Up to three
 * things, the captions first; "The edit is changed." when it can name none of what differs, and "Your video looks as it
 * did." when nothing does. `gave`, as for `effectOf`: a title the code's move ended is told where it ends, and only that one.
 */
export function saidOf(before: Edit, after: Edit, gave: readonly GaveWay[] = []): string {
  const told = toldOf(before, after, gave);
  // Nothing to name. Where the two edits are the same (an answer that set what the edit already had), no change is claimed.
  if (told.length === 0) return JSON.stringify(before) === JSON.stringify(after) ? "Your video looks as it did." : "The edit is changed.";
  return toldSentence(told);
}

/** Clauses as the code's one sentence: up to `SAID_MOST`, joined by semicolons, the first capitalised, and a word for the rest. */
export function toldSentence(told: readonly string[]): string {
  const shown = told.slice(0, SAID_MOST).join("; ");
  return `${shown.charAt(0).toUpperCase()}${shown.slice(1)}${told.length > SAID_MOST ? "; other things are changed too" : ""}.`;
}

/** What `saidOf` tells of a change, as its clauses in its order ("the captions are bigger"); none when it can name nothing. */
export function toldOf(before: Edit, after: Edit, gave: readonly GaveWay[] = []): string[] {
  const told: string[] = [];
  const bare = (text: string): string => text.replaceAll("*", "").replace(/[.,!?:;…]+$/, "");

  // The captions.
  const [was, is] = [before.captions, after.captions];
  // A stressed word the plain look now draws in colour is told as that; where the colour came on for it, the words tell the
  // colour (Task 9b).
  const out = newlyOut(before, after);
  const lit = is.on && is.look === "plain" && is.highlight !== null;
  const litForStress = lit && was.highlight === null && out.length > 0;
  if (was.on !== is.on) told.push(is.on ? "the captions are on" : "the captions are off");
  else if (is.on) {
    const words = is.maxWords !== was.maxWords ? `${COUNT_SAID[is.maxWords] ?? is.maxWords} ${is.maxWords === 1 ? "word" : "words"} at a time` : null;
    const how = [
      is.look !== was.look ? `${LOOK_WORDS[is.look]} now` : null,
      is.size !== was.size ? (is.size > was.size ? "bigger" : "smaller") : null,
      is.y !== was.y ? (is.y < was.y ? "higher" : "lower") : null,
      captionWeights(is).plain !== captionWeights(was).plain ? (captionWeights(is).plain > captionWeights(was).plain ? "heavier" : "lighter") : null,
    ].filter((each) => each !== null);
    if (how.length > 0) told.push(`the captions are ${[...how, ...(words ? [words] : [])].join(", ")}`);
    else if (words) told.push(`the captions show ${words}`);
    else if (is.highlight !== was.highlight && !litForStress) told.push("the captions have another colour");
    else if (is.font !== was.font) told.push("the captions are in another typeface");
    else if (is.width !== was.width) told.push("the captions have another width");
  }

  // The words the captions write.
  const written = (edit: Edit) => new Map(edit.assets.flatMap((asset) => (asset.kind === "video" ? (asset.words ?? []).map((word, i) => [`${asset.id} ${i}`, word] as const) : [])));
  const had = written(before);
  const pairs = [...written(after)].flatMap(([key, word]) => {
    const old = had.get(key);
    return old ? [{ old, word }] : [];
  });
  const one = (list: { old: { text: string }; word: { text: string } }[], each: (pair: { old: { text: string }; word: { text: string } }) => string, many: string): void => {
    if (list.length === 1 && list[0]) told.push(each(list[0]));
    else if (list.length > 1) told.push(many);
  };
  one(pairs.filter(({ old, word }) => old.text !== word.text), ({ old, word }) => `the captions read "${bare(word.text)}" where they read "${bare(old.text)}"`, "some words of the captions read differently");
  // Where the plain look draws them in colour, every newly stressed word is among those that now stand out.
  const [first] = out;
  if (out.length === 1 && first) told.push(`the word "${bare(first.text)}" now stands out in ${hueOf(is.highlight)}`);
  else if (out.length > 1) told.push(`some words now stand out in ${hueOf(is.highlight)}`);
  one(pairs.filter(({ old, word }) => word.stress === true && old.stress !== true && !lit), ({ word }) => `the word "${bare(word.text)}" is stressed in the captions`, "some words are stressed in the captions");
  one(pairs.filter(({ old, word }) => word.stress !== true && old.stress === true), ({ word }) => `the word "${bare(word.text)}" is no longer stressed in the captions`, "some words are no longer stressed in the captions");
  one(pairs.filter(({ old, word }) => word.hidden === true && old.hidden !== true), ({ word }) => `the word "${bare(word.text)}" is left out of the captions`, "some words are left out of the captions");
  one(pairs.filter(({ old, word }) => word.hidden !== true && old.hidden === true), ({ word }) => `the word "${bare(word.text)}" is in the captions again`, "some words are in the captions again");

  // What sits on the film: titles, call-outs, the bar, cutaways, sounds.
  const things = (edit: Edit) => new Map([...edit.shots.flatMap((shot) => shot.marks), ...edit.items].map((thing) => [thing.id, thing] as const));
  const [held, holds] = [things(before), things(after)];
  const kind = (thing: Mark | Item): string => (thing.part === "title" ? "title" : thing.part === "callout" ? "call-out" : thing.part === "progress" ? "progress bar" : thing.part);
  const named = (thing: Mark | Item): string => (thing.part === "title" || thing.part === "callout" ? `the ${kind(thing)} "${bare(thing.props.text)}"` : `the ${kind(thing)}`);
  for (const [id, thing] of holds) {
    const old = held.get(id);
    if (!old) told.push(thing.part === "title" || thing.part === "callout" ? `a ${kind(thing)} "${bare(thing.props.text)}" is added` : `a ${kind(thing)} is added`);
    else if (JSON.stringify(old) !== JSON.stringify(thing)) {
      if ((thing.part === "title" || thing.part === "callout") && old.part === thing.part) {
        const [a, b] = [old.props, thing.props];
        if (a.text !== b.text) told.push(`the ${kind(thing)} now reads "${bare(b.text)}"`);
        else if (a.y !== b.y) told.push(`${named(thing)} sits ${b.y < a.y ? "higher" : "lower"}`);
        else if (a.size !== b.size) told.push(`${named(thing)} is ${b.size > a.size ? "bigger" : "smaller"}`);
        else if (endedBy(gave, thing) && "anchor" in old && "anchor" in thing && old.frames !== thing.frames) {
          // A title the move ended, or ended again (Task 9b, the final fix wave): where, said so only where the move did (`gave`).
          told.push(`${named(thing)} now ends where ${endedBy(gave, thing)?.to ?? ""} starts`);
        } else if (endedLabel(old, thing)) told.push(`${named(thing)} now ends earlier`);
        else told.push(`${named(thing)} is changed`);
      } else told.push(`${named(thing)} is changed`);
    }
  }
  for (const [id, thing] of held) if (!holds.has(id)) told.push(`${named(thing)} is gone`);

  // The film: its speed, its length, the words it shows.
  const seconds = (edit: Edit) => layout(edit).frames / FPS;
  const speedOf = (edit: Edit) => new Map(edit.shots.map((shot) => [shot.id, shot.speed] as const));
  const sped = [...speedOf(after)].flatMap(([id, speed]) => {
    const old = speedOf(before).get(id);
    return old === undefined || old === speed ? [] : [Math.sign(speed - old)];
  });
  const shownIn = (edit: Edit) => new Set(edit.shots.flatMap((shot) => {
    const clip = edit.assets.find((asset) => asset.id === shot.asset);
    return (clip?.kind === "video" ? (clip.words ?? []) : []).flatMap((word, i) => (word.startMs >= shot.startMs && word.startMs < shot.endMs ? [`${shot.asset} ${i}`] : []));
  }));
  const [shownBefore, shownAfter] = [shownIn(before), shownIn(after)];
  const cut = [...shownBefore].some((key) => !shownAfter.has(key));
  const back = [...shownAfter].some((key) => !shownBefore.has(key));
  const longer = seconds(after) - seconds(before);
  if (sped.length > 0) told.push(sped.every((way) => way > 0) ? "the video plays faster" : sped.every((way) => way < 0) ? "the video plays slower" : "parts of the video play at another speed");
  else if (Math.abs(longer) >= 0.05) told.push(`the video is ${Math.abs(longer) < 1 ? "a little " : ""}${longer < 0 ? "shorter" : "longer"}${cut ? ", with some of your words cut" : ""}${back ? ", with words in it that were cut" : ""}`);
  else if (cut || back) told.push(cut ? "some of your words are cut out" : "words that were cut are in the video again");

  // The picture: how each stretch of a take is framed, against the shot that showed it before, as the picture shows it at
  // the stretch's first moment and its last (`framingAt`). Not by the framings as written: a cut of a shot that moves keeps
  // the move and re-bases its part, and the picture at every moment is as it was (the last re-review: "framed differently").
  // What a frame shows: its zoom, and how far the picture is shifted, which is `x` and `y` times what the zoom leaves over
  // (at zoom 1 they shift nothing: `stage.ts`).
  const pictured = (frame: Frame): number[] => [frame.zoom, frame.x * (frame.zoom - 1), frame.y * (frame.zoom - 1)];
  const same = (a: Frame, b: Frame): boolean => pictured(a).every((value, i) => Math.abs(value - (pictured(b)[i] ?? 0)) < 1e-6);
  const framed = after.shots.flatMap((shot) => {
    const old = before.shots.find((each) => each.asset === shot.asset && each.startMs <= shot.startMs && shot.startMs < each.endMs);
    if (!old) return [];
    const end = Math.min(shot.endMs, old.endMs);
    const [is, was] = [[framingAt(shot, shot.startMs), framingAt(shot, end)] as const, [framingAt(old, shot.startMs), framingAt(old, end)] as const];
    if (same(is[0], was[0]) && same(is[1], was[1])) return [];
    // A push that gets to its zoom before the piece ends (a zoom here, in 400 ms) is closer, then holds: not a slow move.
    const pushed = isPush(shot.framing) && (shot.framing.move?.part[1] ?? 0) > 1;
    return [{ slow: !pushed && !same(is[0], is[1]) && same(was[0], was[1]), way: Math.sign(is[1].zoom - was[1].zoom) }];
  });
  if (framed.length > 0) {
    const where = framed.length < after.shots.length ? " in part of the video" : "";
    if (framed.some((each) => each.slow && each.way > 0)) told.push(`the picture moves in slowly${where}`);
    else if (framed.some((each) => each.way > 0)) told.push(`the picture is closer${where}`);
    else if (framed.some((each) => each.way < 0)) told.push(`the picture is wider${where}`);
    else told.push(`the picture is framed differently${where}`);
  }

  // The colours, the sound, the cuts.
  if (JSON.stringify(before.look) !== JSON.stringify(after.look)) {
    const [a, b] = [before.look.adjust, after.look.adjust];
    if (before.look.preset !== after.look.preset) told.push(after.look.preset === "natural" && before.look.preset === "mono" ? "the video is in colour again" : LOOK_SAID[after.look.preset]);
    else if (a.warmth !== b.warmth) told.push(b.warmth > a.warmth ? "the colours are warmer" : "the colours are cooler");
    else if (a.exposure !== b.exposure) told.push(b.exposure > a.exposure ? "the picture is brighter" : "the picture is darker");
    else if (a.saturation !== b.saturation || a.vibrance !== b.vibrance) told.push(b.saturation + b.vibrance > a.saturation + a.vibrance ? "the colours are stronger" : "the colours are weaker");
    else told.push("the colours are changed");
  } else if (after.shots.some((shot) => JSON.stringify(before.shots.find((each) => each.id === shot.id)?.look ?? shot.look) !== JSON.stringify(shot.look))) told.push("the colours are changed in part of the video");
  const heard = (edit: Edit) => JSON.stringify(edit.shots.map((shot) => [shot.id, shot.volume]));
  if (heard(before) !== heard(after) && before.shots.length === after.shots.length) told.push("the sound is set to another level");
  return told;
}
