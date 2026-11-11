/**
 * ops.ts — the closed list of changes anyone can make to an EditSpec.
 *
 * Buttons, the chat and the auto-edit all change an edit the same way: a list of operations
 * through `applyOps`. It is pure and all-or-nothing. The result has to be a valid EditSpec that
 * passes `checkEditSpec`; otherwise it throws `EditOpError` and the document it was given is
 * untouched. Undo is a snapshot of the document kept by the caller, so there are no inverse
 * operations (spec F4).
 *
 * `parseOps` is the door for operations that come from outside the type system (a model's
 * output, a request body): unknown operations and unknown keys are refused.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §6.
 */
import { z } from "zod";
import { checkEditSpec } from "./check";
import { starts } from "./derive";
import { FILTER_IDS } from "./kit";
import {
  AssetSchema, CaptionStyleSchema, CaptionsSchema, EditSpecSchema, IdSchema, LayerSchema, RefSchema,
  SegmentSchema, SoundSchema, TextItemSchema, WordSchema, type EditSpec, type Segment,
} from "./spec";
import { FPS, MAX_FRAMES, MIN_LEN, minSourceMs, sourceMs } from "./time";

const Ms = z.number().int().min(0);
const Index = z.number().int().min(0);

export const OpSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("segment.trim"), id: IdSchema, inMs: Ms.optional(), len: z.number().int().min(MIN_LEN).max(MAX_FRAMES).optional() }),
  z.strictObject({ op: z.literal("segment.split"), id: IdSchema, at: z.number().int().min(MIN_LEN), newId: IdSchema }),
  z.strictObject({ op: z.literal("segment.remove"), id: IdSchema }),
  z.strictObject({ op: z.literal("segment.move"), id: IdSchema, to: Index }),
  z.strictObject({ op: z.literal("segment.insert"), segment: SegmentSchema, index: Index }),
  z.strictObject({ op: z.literal("segment.replace"), id: IdSchema, asset: IdSchema, inMs: Ms }),
  z.strictObject({
    op: z.literal("segment.set"),
    id: IdSchema,
    patch: SegmentSchema.pick({ speed: true, volume: true, fit: true, framing: true, move: true, filter: true, cutOut: true, beat: true }).partial(),
  }),
  z.strictObject({ op: z.literal("text.add"), item: TextItemSchema }),
  z.strictObject({ op: z.literal("text.set"), id: IdSchema, patch: TextItemSchema.omit({ id: true }).partial() }),
  z.strictObject({ op: z.literal("text.remove"), id: IdSchema }),
  z.strictObject({ op: z.literal("layer.add"), item: LayerSchema }),
  z.strictObject({ op: z.literal("layer.set"), id: IdSchema, patch: LayerSchema.omit({ id: true }).partial() }),
  z.strictObject({ op: z.literal("layer.remove"), id: IdSchema }),
  z.strictObject({ op: z.literal("sound.add"), item: SoundSchema }),
  z.strictObject({ op: z.literal("sound.set"), id: IdSchema, patch: SoundSchema.omit({ id: true }).partial() }),
  z.strictObject({ op: z.literal("sound.remove"), id: IdSchema }),
  z.strictObject({
    op: z.literal("captions.set"),
    patch: z.strictObject({ on: z.boolean().optional(), lang: CaptionsSchema.shape.lang.optional(), style: CaptionStyleSchema.partial().optional() }),
  }),
  /** `text`: the corrected word; null hides the word; left out, the correction is undone. */
  z.strictObject({ op: z.literal("captions.fix"), asset: IdSchema, word: Index, text: z.string().min(1).max(80).nullable().optional() }),
  z.strictObject({ op: z.literal("asset.add"), asset: AssetSchema }),
  z.strictObject({ op: z.literal("asset.words"), id: IdSchema, words: z.array(WordSchema).nullable() }),
  z.strictObject({ op: z.literal("look.set"), filter: z.enum(FILTER_IDS).nullable() }),
  z.strictObject({ op: z.literal("cover.set"), frame: z.number().int().min(0).max(MAX_FRAMES).nullable() }),
  z.strictObject({ op: z.literal("ref.set"), ref: RefSchema.nullable() }),
]);
export type Op = z.infer<typeof OpSchema>;

/** Operations from outside the type system, validated. Throws a ZodError when one is not an operation. */
export function parseOps(json: unknown): Op[] {
  return z.array(OpSchema).parse(json);
}

/**
 * Why `applyOps` refused. `code`: a refusal's own code, or a `checkEditSpec` code, or `invalid`.
 * `index`: which operation. An operation's own refusals and `invalid` carry that operation's index.
 * A refusal from the checks of the result carries the LAST operation's index: the checks judge the
 * result of the whole list, which may pass through a state that is not valid on its way to one that is.
 */
export class EditOpError extends Error {
  constructor(readonly code: string, readonly index: number, message: string) {
    super(message);
    this.name = "EditOpError";
  }
}

class Refusal extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function segmentAt(spec: EditSpec, id: string): { seg: Segment; index: number } {
  const index = spec.main.findIndex((seg) => seg.id === id);
  const seg = spec.main[index];
  if (!seg) throw new Refusal("not-found", `there is no segment "${id}"`);
  return { seg, index };
}

function itemAt<T extends { id: string }>(list: T[], id: string, what: string): { item: T; index: number } {
  const index = list.findIndex((item) => item.id === id);
  const item = list[index];
  if (!item) throw new Refusal("not-found", `there is no ${what} "${id}"`);
  return { item, index };
}

function addItem<T extends { id: string }>(list: T[], item: T, what: string): void {
  if (list.some((other) => other.id === item.id)) throw new Refusal("id-taken", `the id "${item.id}" is already a ${what}`);
  list.push(item);
}

/** The given fields onto the target; a field left undefined is left alone. */
function patch<T extends object>(target: T, values: Partial<T>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) (target as Record<string, unknown>)[key] = value;
  }
}

/**
 * The longest a segment can be, up to its own length, with `ms` of source from its in-point. Judged as
 * check.ts judges it (`minSourceMs`), so the answer is the same wherever the segment sits.
 */
function fitLen(seg: Segment, ms: number): number {
  let len = Math.min(seg.len, Math.floor((ms - seg.inMs) / ((1000 / FPS) * seg.speed)) + 1);
  while (len > 0 && seg.inMs + minSourceMs(len, seg.speed) > ms) len--;
  return Math.max(0, len);
}

function applyOne(spec: EditSpec, op: Op): void {
  switch (op.op) {
    case "segment.trim": {
      const { seg } = segmentAt(spec, op.id);
      if (op.inMs !== undefined) seg.inMs = op.inMs;
      if (op.len !== undefined) seg.len = op.len;
      return;
    }
    case "segment.split": {
      const { seg, index } = segmentAt(spec, op.id);
      if (op.at < MIN_LEN || op.at > seg.len - MIN_LEN) throw new Refusal("split-range", `a split leaves at least ${MIN_LEN} frames on each side`);
      if (spec.main.some((other) => other.id === op.newId)) throw new Refusal("id-taken", `the id "${op.newId}" is already a segment`);
      const asset = spec.assets[seg.asset];
      const ends = seg.inMs + sourceMs(starts(spec)[index] ?? 0, op.at, seg.speed); // where the first half's source ends
      /*
       * Judged as check.ts judges it (`minSourceMs`), the second half may need up to ⌈speed⌉ ms more
       * than the file has left after that. It then starts that much earlier, replaying a fraction of a
       * frame, and never more than ⌈speed⌉ ms: of a segment that fitted, both halves always fit so.
       */
      const latest = asset?.kind === "video" ? (asset.ms ?? 0) - minSourceMs(seg.len - op.at, seg.speed) : ends;
      const second: Segment = {
        ...structuredClone(seg),
        id: op.newId,
        len: seg.len - op.at,
        inMs: asset?.kind === "image" ? 0 : Math.min(ends, Math.max(latest, ends - Math.ceil(seg.speed))),
      };
      seg.len = op.at;
      seg.cutOut = { kind: "cut" };
      spec.main.splice(index + 1, 0, second);
      /* what was pinned past the split now belongs to the second half */
      for (const item of [...spec.texts, ...spec.layers, ...spec.sounds]) {
        if (item.pin === op.id && item.at >= op.at) {
          item.pin = op.newId;
          item.at -= op.at;
        }
      }
      return;
    }
    case "segment.remove": {
      const { index } = segmentAt(spec, op.id);
      if (spec.main.length === 1) throw new Refusal("last-segment", "an edit keeps at least one segment");
      spec.main.splice(index, 1);
      spec.texts = spec.texts.filter((item) => item.pin !== op.id);
      spec.layers = spec.layers.filter((item) => item.pin !== op.id);
      spec.sounds = spec.sounds.filter((item) => item.pin !== op.id);
      return;
    }
    case "segment.move": {
      const { seg, index } = segmentAt(spec, op.id);
      if (op.to >= spec.main.length) throw new Refusal("invalid", `to: ${op.to} is past the last place, ${spec.main.length - 1}`);
      spec.main.splice(index, 1);
      spec.main.splice(op.to, 0, seg);
      return;
    }
    case "segment.insert": {
      if (op.index > spec.main.length) throw new Refusal("invalid", `index: ${op.index} is past the end, ${spec.main.length}`);
      if (spec.main.some((other) => other.id === op.segment.id)) throw new Refusal("id-taken", `the id "${op.segment.id}" is already a segment`);
      spec.main.splice(op.index, 0, op.segment);
      return;
    }
    case "segment.replace": {
      const { seg } = segmentAt(spec, op.id);
      const asset = spec.assets[op.asset];
      if (!asset) throw new Refusal("asset-missing", `the asset "${op.asset}" is not in the edit`);
      seg.asset = op.asset;
      seg.inMs = asset.kind === "image" ? 0 : op.inMs;
      if (asset.kind === "video") {
        const len = fitLen(seg, asset.ms ?? 0);
        if (len < MIN_LEN) throw new Refusal("source-too-short", `"${op.asset}" has under ${MIN_LEN} frames after ${op.inMs} ms`);
        seg.len = len;
      }
      return;
    }
    case "segment.set": {
      const { seg } = segmentAt(spec, op.id);
      const { speed } = op.patch;
      const asset = spec.assets[seg.asset];
      if (speed !== undefined && speed !== seg.speed && asset?.kind === "video") {
        /*
         * The same stretch of source at another speed: its length on the film changes. Rounded down, so it
         * never takes more source frames (`1e-9`: an exact length is not lost to floating point), then
         * shortened if the file has no room for it as check.ts judges. Never under MIN_LEN frames; if the
         * file has no room for those, the checks refuse the edit. A still has no source: its length stays.
         */
        seg.len = Math.min(MAX_FRAMES, Math.floor((seg.len * seg.speed) / speed + 1e-9));
        seg.speed = speed;
        seg.len = Math.max(MIN_LEN, fitLen(seg, asset.ms ?? 0));
      }
      patch(seg, op.patch);
      return;
    }
    case "text.add": addItem(spec.texts, op.item, "text"); return;
    case "text.set": patch(itemAt(spec.texts, op.id, "text").item, op.patch); return;
    case "text.remove": spec.texts.splice(itemAt(spec.texts, op.id, "text").index, 1); return;
    case "layer.add": addItem(spec.layers, op.item, "layer"); return;
    case "layer.set": patch(itemAt(spec.layers, op.id, "layer").item, op.patch); return;
    case "layer.remove": spec.layers.splice(itemAt(spec.layers, op.id, "layer").index, 1); return;
    case "sound.add": addItem(spec.sounds, op.item, "sound"); return;
    case "sound.set": patch(itemAt(spec.sounds, op.id, "sound").item, op.patch); return;
    case "sound.remove": spec.sounds.splice(itemAt(spec.sounds, op.id, "sound").index, 1); return;
    case "captions.set": {
      const { style, ...rest } = op.patch;
      patch(spec.captions, rest);
      if (style) patch(spec.captions.style, style);
      return;
    }
    case "captions.fix": {
      const fixes = (spec.captions.fixes[op.asset] ??= {});
      if (op.text === undefined) delete fixes[String(op.word)];
      else fixes[String(op.word)] = op.text;
      if (Object.keys(fixes).length === 0) delete spec.captions.fixes[op.asset];
      return;
    }
    case "asset.add": {
      if (spec.assets[op.asset.id]) throw new Refusal("id-taken", `the id "${op.asset.id}" is already an asset`);
      spec.assets[op.asset.id] = op.asset;
      return;
    }
    case "asset.words": {
      const asset = spec.assets[op.id];
      if (!asset) throw new Refusal("not-found", `there is no asset "${op.id}"`);
      asset.words = op.words;
      return;
    }
    case "look.set": spec.look.filter = op.filter; return;
    case "cover.set": spec.cover = op.frame == null ? null : { frame: op.frame }; return;
    case "ref.set": spec.ref = op.ref; return;
  }
}

const firstIssue = (error: z.ZodError, otherwise: string): string => {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".")}: ${issue.message}` : otherwise;
};

/**
 * The edit after the operations, in order. All of them, or none: on a refusal the edit given is
 * untouched. Every operation is validated first, typed or not, so no unchecked value reaches a
 * lookup, and the edit is built from the parsed copies, never from the caller's objects.
 * `EditOpError.index` says which operation was refused.
 */
export function applyOps(spec: EditSpec, ops: Op[]): EditSpec {
  const valid = ops.map((op, index) => {
    const parsed = OpSchema.safeParse(op);
    if (!parsed.success) throw new EditOpError("invalid", index, firstIssue(parsed.error, "not an operation"));
    return parsed.data;
  });
  const next = structuredClone(spec);
  valid.forEach((op, index) => {
    try {
      applyOne(next, op);
    } catch (e) {
      if (e instanceof Refusal) throw new EditOpError(e.code, index, e.message);
      throw e;
    }
  });
  const last = Math.max(0, ops.length - 1);
  const parsed = EditSpecSchema.safeParse(next);
  if (!parsed.success) throw new EditOpError("invalid", last, firstIssue(parsed.error, "the result is not an EditSpec"));
  const problem = checkEditSpec(parsed.data)[0];
  if (problem) throw new EditOpError(problem.code, last, `${problem.at}: ${problem.message}`);
  return parsed.data;
}
