/**
 * ops.ts — the closed list of changes to an edit, and the one door they pass.
 *
 * `applyOps` parses the edit and the operations, applies them in order to a copy, and gives the
 * copy back only if it is still a valid edit that holds together and everything the operations
 * asked to show does show. Anything else changes nothing and says why. A button, the agent and
 * the first cut all come through here, so undo is simply the edit before.
 *
 * An operation sets what it is given, exactly, and rounds nothing: a shot is a stretch of its file
 * in milliseconds, and its frames are worked out. No operation removes anything it was not asked
 * to remove. Cutting a shot down leaves its marks, the film's items and the cover as they are:
 * what the film no longer reaches does not show, and is back when the footage is. So the same
 * operations in another order give the same film, and nothing far away can stop a trim.
 *
 * Spec: docs/superpowers/specs/2026-11-19-edit-design.md §5.1.
 */
import { z } from "zod";
import { Ms } from "./atoms";
import { checkEdit, type Problem } from "./check";
import { assetOf, coverFrame, layout, placed } from "./derive";
import {
  AdjustSchema, CUT_KINDS, CaptionsSchema, CoverSchema, EditSchema, ITEM_PARTS, ITEM_TIMING, IdSchema, ItemSchema, LOOK_IDS, MARK_PARTS, MARK_TIMING,
  MarkSchema, NEUTRAL, NO_LOOK, ShotShape, WordShape, newShot, type Asset, type Edit, type Framing, type Shot,
} from "./doc";
import { PARTS } from "./parts";

/** What `shot.set` may change, each optional. */
const ShotSettings = ShotShape.pick({ speed: true, volume: true, framing: true, out: true }).partial();
/** Some of one part's settings, to lay over the ones a mark or an item has. The result is checked against its part. */
const SomeProps = z.union([PARTS.title.props.partial(), PARTS.callout.props.partial(), PARTS.progress.props.partial(), PARTS.cutaway.props.partial(), PARTS.sound.props.partial()]);

export const OpSchema = z.discriminatedUnion("op", [
  /** A new shot after the named one, or first when `after` is null: a stretch of a file. What it does not say starts as in `newShot`. */
  z.strictObject({
    op: z.literal("shot.insert"),
    after: IdSchema.nullable(),
    shot: z.strictObject({ id: IdSchema, asset: IdSchema, startMs: Ms, endMs: Ms, ...ShotSettings.shape }),
  }),
  /** Two shots from one, cut at `atMs` of its file. Nothing on the film changes; the second piece gets `newId`. */
  z.strictObject({ op: z.literal("shot.split"), id: IdSchema, atMs: Ms, newId: IdSchema }),
  /** The stretch of its file a shot shows: a new start, a new end, or both. An end not given stays where it is. */
  z.strictObject({ op: z.literal("shot.trim"), id: IdSchema, startMs: Ms.optional(), endMs: Ms.optional() }),
  /** Takes a shot out, with its marks. */
  z.strictObject({ op: z.literal("shot.remove"), id: IdSchema }),
  /** The shot goes after the named one, or first when `after` is null. */
  z.strictObject({ op: z.literal("shot.move"), id: IdSchema, after: IdSchema.nullable() }),
  /** A shot's speed, volume, framing or cut. A new speed keeps the stretch of file, so the shot fills fewer or more frames. */
  z.strictObject({ op: z.literal("shot.set"), id: IdSchema, ...ShotSettings.shape }),

  /** A kit part on a shot, at a moment its footage shows. */
  z.strictObject({ op: z.literal("mark.add"), shot: IdSchema, mark: MarkSchema }),
  /** A mark's file, moment, length or settings. The settings given are laid over the ones it has. */
  z.strictObject({ op: z.literal("mark.set"), id: IdSchema, asset: IdSchema.optional(), atMs: MARK_TIMING.atMs.optional(), lenMs: MARK_TIMING.lenMs.optional(), props: SomeProps.optional() }),
  z.strictObject({ op: z.literal("mark.remove"), id: IdSchema }),

  /** A kit part on the film, starting inside it. */
  z.strictObject({ op: z.literal("item.add"), item: ItemSchema }),
  /** An item's file, place, length or settings. The settings given are laid over the ones it has. */
  z.strictObject({
    op: z.literal("item.set"), id: IdSchema, asset: IdSchema.optional(),
    anchor: ITEM_TIMING.anchor.optional(), at: ITEM_TIMING.at.optional(), frames: ITEM_TIMING.frames.optional(), props: SomeProps.optional(),
  }),
  z.strictObject({ op: z.literal("item.remove"), id: IdSchema }),

  /** A word's text, whether the captions show it, or whether they stress it. The word is named by its file and its place in it. */
  z.strictObject({
    op: z.literal("word.set"), asset: IdSchema, index: z.number().int().min(0),
    text: WordShape.shape.text.optional(), hidden: z.boolean().optional(), stress: z.boolean().optional(),
  }),
  z.strictObject({ op: z.literal("captions.set"), ...CaptionsSchema.partial().shape }),

  /** Puts one of the files on offer into the edit, with the facts it was measured with. */
  z.strictObject({ op: z.literal("asset.add"), id: IdSchema }),
  /** Takes a file out that nothing uses. */
  z.strictObject({ op: z.literal("asset.remove"), id: IdSchema }),

  /**
   * The film's look, or with `shot` what that shot changes of it. What is given is laid over what
   * is there. A shot's preset may be null: the film's.
   */
  z.strictObject({ op: z.literal("look.set"), shot: IdSchema.optional(), preset: z.enum(LOOK_IDS).nullable().optional(), adjust: AdjustSchema.partial().optional() }),
  /** Back to no look for the film, or with `shot` back to the film's look for that shot. */
  z.strictObject({ op: z.literal("look.clear"), shot: IdSchema.optional() }),
  /** The cover: a moment that shows, or null for none. */
  z.strictObject({ op: z.literal("cover.set"), cover: CoverSchema.nullable() }),
]);

export const OP_NAMES = [
  "shot.insert", "shot.split", "shot.trim", "shot.remove", "shot.move", "shot.set",
  "mark.add", "mark.set", "mark.remove", "item.add", "item.set", "item.remove",
  "word.set", "captions.set", "asset.add", "asset.remove", "look.set", "look.clear", "cover.set",
] as const;

export const OpsSchema = z.array(OpSchema).min(1).max(2000);
export type Op = z.infer<typeof OpSchema>;

/** A list of operations, validated. Throws a ZodError when it is not one. */
export function parseOps(json: unknown): Op[] {
  return OpsSchema.parse(json);
}

export type Applied = { ok: true; edit: Edit } | { ok: false; problems: Problem[] };

/** Something an operation asks to show: a mark or an item, by its id, or the cover. */
type Ask = { what: "mark" | "item"; id: string } | { what: "cover" };
/** An ask, with the place in the list of the operation that made it. */
type Asked = Ask & { op: number };

/**
 * The one door. Applies all the operations or none: the result is the changed edit, or the reasons
 * nothing changed. Nothing it is given is ever touched.
 *
 * `library` is the files this edit may use, with the facts the server measured. `asset.add` takes
 * a file from there and from nowhere else, so no caller can give a file a length or a place of
 * its own invention.
 */
export function applyOps(edit: Edit, ops: unknown, library: readonly Asset[] = []): Applied {
  const given = EditSchema.safeParse(edit);
  if (!given.success) return { ok: false, problems: given.error.issues.map((issue) => toProblem(["edit", ...issue.path], issue, null)) };
  const parsed = OpsSchema.safeParse(ops);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.flatMap((issue) => settingsProblems(given.data, ops, issue.path) ?? [toProblem(["ops", ...issue.path], issue, null)]) };

  const draft = structuredClone(given.data);
  const asked: Asked[] = [];
  for (const [i, op] of parsed.data.entries()) {
    const refusal = applyOne(draft, op, library, (what) => asked.push({ op: i, ...what }));
    if (refusal) return { ok: false, problems: [{ path: `ops.${i}`, id: aboutOf(op), message: refusal }] };
  }

  const shaped = EditSchema.safeParse(draft);
  if (!shaped.success) return { ok: false, problems: shaped.error.issues.map((issue) => toProblem(issue.path, issue, draft)) };
  const problems = checkEdit(shaped.data);
  if (problems.length === 0) problems.push(...notShowing(shaped.data, asked));
  return problems.length > 0 ? { ok: false, problems } : { ok: true, edit: shaped.data };
}

/**
 * Settings that fit no part, said exactly: when the refusal is of the `props` of a `mark.set` or
 * an `item.set` whose mark or item is in the edit, the settings are held against that thing's own
 * part, and each setting it refuses is named. Null when the refusal is of anything else.
 */
function settingsProblems(edit: Edit, ops: unknown, path: PropertyKey[]): Problem[] | null {
  const [index, key] = path;
  const op: unknown = Array.isArray(ops) && typeof index === "number" ? ops[index] : null;
  if (path.length !== 2 || key !== "props" || typeof op !== "object" || op === null || !("id" in op) || !("props" in op)) return null;
  const things = "op" in op && op.op === "mark.set" ? edit.shots.flatMap((shot) => shot.marks) : edit.items;
  const thing = things.find((candidate) => candidate.id === op.id);
  if (!thing) return null;
  const refused = PARTS[thing.part].props.partial().safeParse(op.props);
  if (refused.success) return null;
  return refused.error.issues.map((issue) => ({ path: ["ops", index, "props", ...issue.path].map(String).join("."), id: thing.id, message: `${issue.message}, for a ${thing.part}` }));
}

/** A schema's refusal as a problem. A field that picks between shapes is told which there are. */
function toProblem(path: PropertyKey[], issue: { code?: string; message: string }, draft: Edit | null): Problem {
  const keys = path.map(String);
  const choices = issue.code === "invalid_union" ? choicesAt(keys) : null;
  return { path: keys.join("."), id: draft ? idAt(draft, keys) : null, message: choices ? `is not one of: ${choices.join(", ")}` : issue.message };
}

/** The names a field that picks between shapes may take, by where the field is. */
function choicesAt(keys: string[]): readonly string[] | null {
  const last = keys[keys.length - 1];
  if (last === "op") return OP_NAMES;
  if (last === "kind" && keys.includes("out")) return CUT_KINDS;
  if (last === "part") return keys.includes("mark") || keys.includes("marks") ? MARK_PARTS : ITEM_PARTS;
  return null;
}

/** The id of the shot, mark, item or file a place in the document belongs to; null for a place in none. */
function idAt(edit: Edit, keys: string[]): string | null {
  const [list, index, inner, innerIndex] = keys;
  if (list === "shots") {
    const shot = edit.shots[Number(index)];
    const mark = inner === "marks" ? shot?.marks[Number(innerIndex)] : undefined;
    return mark?.id ?? shot?.id ?? null;
  }
  if (list === "items") return edit.items[Number(index)]?.id ?? null;
  if (list === "assets") return edit.assets[Number(index)]?.id ?? null;
  return null;
}

/** The id of the thing an operation is about, for a refusal to name; null when it is about the film. */
function aboutOf(op: Op): string | null {
  switch (op.op) {
    case "shot.insert":
      return op.shot.id;
    case "mark.add":
      return op.mark.id;
    case "item.add":
      return op.item.id;
    case "word.set":
      return op.asset;
    case "look.set":
    case "look.clear":
      return op.shot ?? null;
    case "cover.set":
      return op.cover?.shot ?? null;
    case "captions.set":
      return null;
    default:
      return op.id;
  }
}

/**
 * What the operations asked to show and the film they leave does not: a mark at a moment its
 * footage does not show, an item that starts past the film's end, a cover on a moment that is
 * not there. Judged at the end, so the order of the operations does not matter; what a later
 * operation took out again is not judged.
 */
function notShowing(edit: Edit, asked: Asked[]): Problem[] {
  const lay = layout(edit);
  const showing = new Set(placed(edit).map((place) => place.thing.id));
  const problems: Problem[] = [];
  const told = new Set<string>();
  for (const ask of asked) {
    const key = ask.what === "cover" ? "the cover" : ask.id;
    if (told.has(key)) continue;
    if (ask.what === "cover") {
      const i = edit.shots.findIndex((shot) => shot.id === edit.cover?.shot);
      const run = lay.runs[lay.shots[i]?.run ?? -1];
      if (!edit.cover || !run || coverFrame(edit) !== null) continue;
      problems.push({ path: `ops.${ask.op}`, id: edit.cover.shot, message: `the cover would not show: the footage of shot "${edit.cover.shot}" shows ${run.fromMs} to ${run.toMs} ms of its file, and ${edit.cover.atMs} ms is not in that` });
    } else if (ask.what === "mark") {
      const i = edit.shots.findIndex((shot) => shot.marks.some((mark) => mark.id === ask.id));
      const mark = edit.shots[i]?.marks.find((candidate) => candidate.id === ask.id);
      const run = lay.runs[lay.shots[i]?.run ?? -1];
      if (!mark || !run || showing.has(ask.id)) continue;
      problems.push({ path: `ops.${ask.op}`, id: ask.id, message: `${mark.part} "${mark.id}" would not show: its footage shows ${run.fromMs} to ${run.toMs} ms of its file, and ${mark.atMs} ms is not in that` });
    } else {
      const item = edit.items.find((candidate) => candidate.id === ask.id);
      if (!item || showing.has(ask.id)) continue;
      const where = item.anchor === "start" ? `it starts on frame ${item.at}, and the film is ${lay.frames} frames long` : `it starts ${item.at} frames before the film's end`;
      problems.push({ path: `ops.${ask.op}`, id: ask.id, message: `${item.part} "${item.id}" would not show: ${where}` });
    }
    told.add(key);
  }
  return problems;
}

/** Applies one operation to the draft. Returns why it cannot be applied, or null when it was. `ask` notes what it asks to show. */
function applyOne(edit: Edit, op: Op, library: readonly Asset[], ask: (what: Ask) => void): string | null {
  switch (op.op) {
    case "shot.insert": {
      const at = op.after === null ? 0 : shotIndex(edit, op.after) + 1;
      if (op.after !== null && at === 0) return noShot(op.after);
      const { id, asset, startMs, endMs, ...rest } = op.shot;
      if (endMs <= startMs) return noStretch(startMs, endMs);
      edit.shots.splice(at, 0, { ...newShot({ id, asset, startMs, endMs }), ...only(rest) });
      return null;
    }
    case "shot.split": {
      const i = shotIndex(edit, op.id);
      const shot = edit.shots[i];
      if (!shot) return noShot(op.id);
      if (op.atMs <= shot.startMs || op.atMs >= shot.endMs) return `shot "${shot.id}" shows ${shot.startMs} to ${shot.endMs} ms of its file, and a cut at ${op.atMs} ms is not inside that`;
      // The first piece ends in a plain cut and the second keeps the shot's own, so the second runs on from the first and the film is what it was.
      const head: Shot = { ...shot, endMs: op.atMs, out: { kind: "cut" }, framing: over(shot, shot.startMs, op.atMs), marks: shot.marks.filter((mark) => mark.atMs < op.atMs) };
      const tail: Shot = { ...shot, id: op.newId, startMs: op.atMs, framing: over(shot, op.atMs, shot.endMs), marks: shot.marks.filter((mark) => mark.atMs >= op.atMs) };
      edit.shots.splice(i, 1, head, tail);
      if (edit.cover?.shot === shot.id && edit.cover.atMs >= op.atMs) edit.cover.shot = tail.id;
      return null;
    }
    case "shot.trim": {
      const shot = edit.shots[shotIndex(edit, op.id)];
      if (!shot) return noShot(op.id);
      if (op.startMs === undefined && op.endMs === undefined) return "it names neither a start nor an end";
      const [startMs, endMs] = [op.startMs ?? shot.startMs, op.endMs ?? shot.endMs];
      if (endMs <= startMs) return noStretch(startMs, endMs);
      Object.assign(shot, { framing: over(shot, startMs, endMs), startMs, endMs });
      return null;
    }
    case "shot.remove": {
      const i = shotIndex(edit, op.id);
      if (i < 0) return noShot(op.id);
      if (edit.shots.length === 1) return "an edit keeps at least one shot";
      edit.shots.splice(i, 1);
      if (edit.cover?.shot === op.id) edit.cover = null;
      return null;
    }
    case "shot.move": {
      const from = shotIndex(edit, op.id);
      const shot = edit.shots[from];
      if (!shot) return noShot(op.id);
      if (op.after === op.id) return `"${op.id}" cannot follow itself`;
      edit.shots.splice(from, 1);
      const to = op.after === null ? 0 : shotIndex(edit, op.after) + 1;
      if (op.after !== null && to === 0) return noShot(op.after);
      edit.shots.splice(to, 0, shot);
      return null;
    }
    case "shot.set": {
      const shot = edit.shots[shotIndex(edit, op.id)];
      if (!shot) return noShot(op.id);
      const { op: _op, id: _id, ...rest } = op;
      const settings = only(rest);
      if (Object.keys(settings).length === 0) return "it sets nothing";
      Object.assign(shot, settings);
      return null;
    }

    case "mark.add": {
      const shot = edit.shots[shotIndex(edit, op.shot)];
      if (!shot) return noShot(op.shot);
      shot.marks.push(op.mark);
      ask({ what: "mark", id: op.mark.id });
      return null;
    }
    case "mark.set": {
      const mark = edit.shots.flatMap((shot) => shot.marks).find((candidate) => candidate.id === op.id);
      if (!mark) return `there is no mark "${op.id}"`;
      const { op: _op, id: _id, props, ...rest } = op;
      const [settings, some] = [only(rest), only(props ?? {})];
      if (Object.keys(settings).length + Object.keys(some).length === 0) return "it sets nothing";
      Object.assign(mark, settings, { props: { ...mark.props, ...some } });
      if (settings.atMs !== undefined) ask({ what: "mark", id: mark.id });
      return null;
    }
    case "mark.remove": {
      const shot = edit.shots.find((candidate) => candidate.marks.some((mark) => mark.id === op.id));
      if (!shot) return `there is no mark "${op.id}"`;
      shot.marks = shot.marks.filter((mark) => mark.id !== op.id);
      return null;
    }

    case "item.add":
      edit.items.push(op.item);
      ask({ what: "item", id: op.item.id });
      return null;
    case "item.set": {
      const item = edit.items.find((candidate) => candidate.id === op.id);
      if (!item) return `there is no item "${op.id}"`;
      const { op: _op, id: _id, props, ...rest } = op;
      const [settings, some] = [only(rest), only(props ?? {})];
      if (Object.keys(settings).length + Object.keys(some).length === 0) return "it sets nothing";
      Object.assign(item, settings, { props: { ...item.props, ...some } });
      if (settings.at !== undefined || settings.anchor !== undefined) ask({ what: "item", id: item.id });
      return null;
    }
    case "item.remove": {
      if (!edit.items.some((item) => item.id === op.id)) return `there is no item "${op.id}"`;
      edit.items = edit.items.filter((item) => item.id !== op.id);
      return null;
    }

    case "word.set": {
      const asset = assetOf(edit, op.asset);
      if (!asset) return `there is no file "${op.asset}" in the edit`;
      const word = asset.kind === "video" ? asset.words?.[op.index] : undefined;
      if (!word) return `"${op.asset}" has no word ${op.index}`;
      if (op.text === undefined && op.hidden === undefined && op.stress === undefined) return "it sets nothing";
      if (op.text !== undefined) word.text = op.text.normalize("NFC"); // as NFC: a letter typed as a base and a combining mark is the letter, as the width tables hold it
      for (const flag of ["hidden", "stress"] as const) {
        if (op[flag] === true) word[flag] = true;
        if (op[flag] === false) delete word[flag];
      }
      return null;
    }
    case "captions.set": {
      const { op: _op, ...rest } = op;
      const settings = only(rest);
      if (Object.keys(settings).length === 0) return "it sets nothing";
      Object.assign(edit.captions, settings);
      return null;
    }

    case "asset.add": {
      if (assetOf(edit, op.id)) return `a file "${op.id}" is already in the edit`;
      const asset = library.find((candidate) => candidate.id === op.id);
      const offer = library.length === 0 ? "no files are on offer" : `the files on offer are: ${library.slice(0, 30).map((candidate) => candidate.id).join(", ")}`;
      if (!asset) return `there is no file "${op.id}" to add; ${offer}`;
      edit.assets.push(structuredClone(asset));
      return null;
    }
    case "asset.remove": {
      if (!assetOf(edit, op.id)) return `there is no file "${op.id}" in the edit`;
      const user = userOf(edit, op.id);
      if (user) return `${user} still uses "${op.id}"`;
      edit.assets = edit.assets.filter((asset) => asset.id !== op.id);
      return null;
    }

    case "look.set": {
      const adjust = only(op.adjust ?? {});
      if (op.preset === undefined && Object.keys(adjust).length === 0) return "it sets nothing";
      if (op.shot === undefined) {
        if (op.preset === null) return "the film's look needs a preset; only a shot can take the film's";
        edit.look = { preset: op.preset ?? edit.look.preset, adjust: { ...edit.look.adjust, ...adjust } };
        return null;
      }
      const shot = edit.shots[shotIndex(edit, op.shot)];
      if (!shot) return noShot(op.shot);
      const has = shot.look ?? { preset: null, adjust: NEUTRAL };
      shot.look = { preset: op.preset === undefined ? has.preset : op.preset, adjust: { ...has.adjust, ...adjust } };
      return null;
    }
    case "look.clear": {
      if (op.shot === undefined) {
        edit.look = structuredClone(NO_LOOK);
        return null;
      }
      const shot = edit.shots[shotIndex(edit, op.shot)];
      if (!shot) return noShot(op.shot);
      shot.look = null;
      return null;
    }
    case "cover.set":
      edit.cover = op.cover;
      if (op.cover) ask({ what: "cover" });
      return null;
  }
}

const shotIndex = (edit: Edit, id: string): number => edit.shots.findIndex((shot) => shot.id === id);
const noShot = (id: string): string => `there is no shot "${id}"`;
const noStretch = (startMs: number, endMs: number): string => `its end, ${endMs} ms, is not after its start, ${startMs} ms`;

/** The settings an operation really gives: a key set to undefined is a key not given. */
function only<T extends object>(settings: T): Partial<T> {
  return Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** What still uses a file: the first shot, mark or item that names it, in words; null when nothing does. */
function userOf(edit: Edit, id: string): string | null {
  for (const shot of edit.shots) {
    if (shot.asset === id) return `shot "${shot.id}"`;
    const mark = shot.marks.find((candidate) => "asset" in candidate && candidate.asset === id);
    if (mark) return `${mark.part} "${mark.id}"`;
  }
  const item = edit.items.find((candidate) => "asset" in candidate && candidate.asset === id);
  return item ? `${item.part} "${item.id}"` : null;
}

/**
 * A shot's framing for another stretch of its file. A move keeps its pace: the stretch shows the
 * part of the move that those moments show, which may reach before the move's start or past its
 * end, where the framing holds. A part is kept to nine decimals.
 */
function over(shot: Shot, fromMs: number, toMs: number): Framing {
  const move = shot.framing.move;
  if (!move) return structuredClone(shot.framing);
  const [from, to] = move.part;
  const partAt = (ms: number) => Math.round((from + ((to - from) * (ms - shot.startMs)) / (shot.endMs - shot.startMs)) * 1e9) / 1e9;
  return { from: { ...shot.framing.from }, move: { to: { ...move.to }, ease: move.ease, part: [partAt(fromMs), partAt(toMs)] } };
}
