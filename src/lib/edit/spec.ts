/**
 * spec.ts — EditSpec, the saved edit.
 *
 * One JSON document per edit: zod-validated, versioned, counted in frames. It is the stored truth;
 * OpenFilm's film.html is compiled from it and never edited by hand. Unknown keys are an error
 * everywhere (strict objects), so a typo in a stored document or in an operation's payload is
 * refused instead of silently dropped.
 *
 * No field has a schema default: a stored document says everything. The defaults a NEW item
 * starts with are the factories at the bottom.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §3 and §4.
 */
import { z } from "zod";
import { FILTER_IDS, FONT_IDS, MOTION_IDS, WIPE_IDS } from "./kit";
import { MAX_FRAMES, MIN_LEN } from "./time";

/**
 * Ids are short and safe to use as an HTML id and in a file name. Never a name every object already
 * has (`__proto__`, `constructor`, `toString`, ...): ids are keys of plain objects (`assets`,
 * `captions.fixes`), where such a name reads or writes `Object.prototype` instead of the edit.
 */
export const IdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,24}$/)
  .refine((id) => !Object.hasOwn(Object.prototype, id), "is a name every object already has");

/**
 * zod skips an own "__proto__" key of a record without a word (zod 4.3.6), so a stored document or a
 * request body carrying one would lose it silently. Records are read through this first: refused.
 */
function noProtoKey(input: unknown, ctx: z.RefinementCtx): unknown {
  if (typeof input === "object" && input !== null && Object.hasOwn(input, "__proto__")) {
    ctx.addIssue({ code: "custom", path: ["__proto__"], message: "is a name every object already has" });
  }
  return input;
}

/** Colours are six-digit hex only, so they can be written into CSS and JSON as they are. */
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Frame = z.number().int().min(0).max(MAX_FRAMES);
const Len = z.number().int().min(1).max(MAX_FRAMES);
const Ms = z.number().int().min(0);
const Unit = z.number().min(0).max(1);

export const WordSchema = z.strictObject({ t0: Ms, t1: Ms, text: z.string().min(1).max(80) });

export const AssetSchema = z.strictObject({
  id: IdSchema,
  kind: z.enum(["video", "image", "audio"]),
  origin: z.enum(["filmed", "uploaded", "generated", "kit"]),
  generator: z.string().min(1).max(80).optional(),
  at: z.union([
    z.strictObject({ bucket: z.string().min(1).max(60), path: z.string().min(1).max(400) }),
    z.strictObject({ kit: z.string().max(81).regex(/^[a-z0-9][a-z0-9_.-]*(?:\/[a-z0-9][a-z0-9_.-]*)*$/) }),
  ]),
  ms: Ms.optional(),
  w: z.number().int().positive().optional(),
  h: z.number().int().positive().optional(),
  sound: z.boolean(),
  words: z.array(WordSchema).nullable(),
});

export const FramingSchema = z.strictObject({
  zoom: z.number().min(1).max(4),
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
});

export const MoveSchema = z.strictObject({
  kind: z.enum(["push-in", "push-out", "pan-left", "pan-right", "shake"]),
  amount: Unit,
});

export const CutOutSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("cut") }),
  z.strictObject({ kind: z.literal("fade"), style: z.enum(["dissolve", "dip-black"]), len: z.number().int().min(2).max(60) }),
  z.strictObject({ kind: z.literal("wipe"), id: z.enum(WIPE_IDS), color: Hex.optional() }),
]);

export const SegmentSchema = z.strictObject({
  id: IdSchema,
  beat: z.number().int().min(0).nullable(),
  asset: IdSchema,
  inMs: Ms,
  len: z.number().int().min(MIN_LEN).max(MAX_FRAMES),
  speed: z.number().min(0.25).max(4),
  volume: z.number().min(0).max(2),
  fit: z.enum(["cover", "blur"]),
  framing: FramingSchema,
  move: MoveSchema.nullable(),
  filter: z.enum(FILTER_IDS).nullable(),
  cutOut: CutOutSchema,
});

/** What every item placed on the film by time carries. `pin`: the segment its `at` counts from. */
const timed = { id: IdSchema, pin: IdSchema.nullable(), at: Frame, len: Len };

export const LayerSchema = z.strictObject({
  ...timed,
  kind: z.enum(["clip", "sticker"]),
  asset: IdSchema,
  inMs: Ms,
  speed: z.number().min(0.25).max(4),
  volume: z.number().min(0).max(2),
  box: z.strictObject({
    x: z.number().min(-2).max(3),
    y: z.number().min(-2).max(3),
    w: z.number().gt(0).max(4),
    h: z.number().gt(0).max(4),
  }),
  rotate: z.number().min(-180).max(180),
  opacity: Unit,
  radius: z.number().min(0).max(960),
  z: z.number().int(),
});

export const TextStyleSchema = z.strictObject({
  preset: z.enum(["label", "outline", "plain"]),
  font: z.enum(FONT_IDS),
  weight: z.number().int().min(100).max(900),
  size: z.number().min(12).max(400),
  color: Hex,
  fill: Hex.nullable(),
  stroke: z.strictObject({ color: Hex, w: z.number().min(0).max(40) }).nullable(),
  align: z.enum(["left", "center", "right"]),
  uppercase: z.boolean(),
});

export const TextItemSchema = z.strictObject({
  ...timed,
  text: z.string().min(1).max(280),
  style: TextStyleSchema,
  box: z.strictObject({ x: Unit, y: Unit, w: z.number().gt(0).max(1) }),
  rotate: z.number().min(-180).max(180),
  in: z.enum(MOTION_IDS).nullable(),
  out: z.enum(MOTION_IDS).nullable(),
});

export const SoundSchema = z.strictObject({
  ...timed,
  role: z.enum(["music", "sfx", "voiceover"]),
  asset: IdSchema,
  inMs: Ms,
  volume: z.number().min(0).max(2),
  fadeIn: Frame,
  fadeOut: Frame,
});

export const CaptionStyleSchema = z.strictObject({
  font: z.enum(FONT_IDS),
  weight: z.number().int().min(100).max(900),
  size: z.number().min(12).max(400),
  color: Hex,
  highlight: Hex.nullable(),
  dimAhead: Unit,
  stroke: z.strictObject({ color: Hex, w: z.number().min(0).max(40) }).nullable(),
  fill: Hex.nullable(),
  uppercase: z.boolean(),
  maxWords: z.number().int().min(1).max(6),
  y: Unit,
  width: z.number().gt(0).max(1),
});

export const CaptionsSchema = z.strictObject({
  on: z.boolean(),
  lang: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/),
  style: CaptionStyleSchema,
  /** asset id → word index → the corrected word, or null to hide it */
  fixes: z.preprocess(noProtoKey, z.record(IdSchema, z.preprocess(noProtoKey, z.record(z.string().regex(/^\d{1,6}$/), z.string().min(1).max(80).nullable())))),
});

export const RefSchema = z.strictObject({
  blueprintId: z.string().min(1).max(40),
  cuts: z.array(Frame),
  beats: z.array(Frame),
});

export const EditSpecSchema = z.strictObject({
  v: z.literal(1),
  stage: z.strictObject({ w: z.literal(1080), h: z.literal(1920), fps: z.literal(30) }),
  assets: z.preprocess(noProtoKey, z.record(IdSchema, AssetSchema)),
  main: z.array(SegmentSchema).min(1),
  layers: z.array(LayerSchema),
  texts: z.array(TextItemSchema),
  captions: CaptionsSchema,
  sounds: z.array(SoundSchema),
  look: z.strictObject({ filter: z.enum(FILTER_IDS).nullable() }),
  cover: z.strictObject({ frame: Frame }).nullable(),
  ref: RefSchema.nullable(),
});

export type Word = z.infer<typeof WordSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Framing = z.infer<typeof FramingSchema>;
export type Move = z.infer<typeof MoveSchema>;
export type CutOut = z.infer<typeof CutOutSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type TextStyle = z.infer<typeof TextStyleSchema>;
export type TextItem = z.infer<typeof TextItemSchema>;
export type Sound = z.infer<typeof SoundSchema>;
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;
export type Captions = z.infer<typeof CaptionsSchema>;
export type EditSpec = z.infer<typeof EditSpecSchema>;

/**
 * An older document brought forward to this version. v1 has nothing to migrate; the function is
 * here so a stored document never needs a breaking change.
 */
export function migrate(json: unknown): unknown {
  const v = typeof json === "object" && json !== null ? (json as { v?: unknown }).v : undefined;
  if (v === 1) return json;
  throw new Error(`EditSpec version ${String(v)} is not one this code can read`);
}

/** A stored document, migrated and validated. Throws a ZodError when it is not an EditSpec. */
export function parseEditSpec(json: unknown): EditSpec {
  return EditSpecSchema.parse(migrate(json));
}

/* ── what a new item starts with ─────────────────────────────────────────────────────────────── */

export const STAGE = { w: 1080, h: 1920, fps: 30 } as const;

export function newSegment(a: { id: string; asset: string; len: number; inMs?: number; beat?: number | null }): Segment {
  return {
    id: a.id, beat: a.beat ?? null, asset: a.asset, inMs: a.inMs ?? 0, len: a.len,
    speed: 1, volume: 1, fit: "cover", framing: { zoom: 1, x: 0, y: 0 }, move: null, filter: null,
    cutOut: { kind: "cut" },
  };
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  font: "inter", weight: 800, size: 84, color: "#ffffff", highlight: "#ffe14a", dimAhead: 0.65,
  stroke: { color: "#000000", w: 10 }, fill: null, uppercase: true, maxWords: 3, y: 0.66, width: 0.86,
};

export const DEFAULT_TEXT_STYLE: TextStyle = {
  preset: "label", font: "inter", weight: 800, size: 62, color: "#111111", fill: "#ffffff",
  stroke: null, align: "center", uppercase: false,
};

export function newText(a: { id: string; text: string; at: number; len: number; pin?: string | null }): TextItem {
  return {
    id: a.id, pin: a.pin ?? null, at: a.at, len: a.len, text: a.text, style: { ...DEFAULT_TEXT_STYLE },
    box: { x: 0.5, y: 0.14, w: 0.8 }, rotate: 0, in: "pop", out: "fade",
  };
}
