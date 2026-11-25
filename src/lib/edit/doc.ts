/**
 * doc.ts — the edit: one JSON document per video. It is the stored truth; the kit draws it and
 * only operations change it.
 *
 * Every object is strict: an unknown key is refused, so a typo in a stored document or in an
 * operation is an error and is never silently dropped. No field has a default but one: a `weight`
 * left out (the captions', a title's) is the look's own, so that no edit stored before the weights
 * came changes. What a new thing starts with is in the factories at the bottom.
 *
 * Time inside a source file is whole milliseconds, stored exactly as asked: a shot is a stretch of
 * its file. The film is counted in whole frames at 30 a second, and a shot's frames are worked
 * out (`derive.ts`), never stored, so no change to a shot has to round what the document says.
 *
 * Spec: docs/superpowers/specs/2026-11-19-edit-design.md §5.
 */
import { z } from "zod";
import { Hex, Ms, Unit, Weight, text } from "./atoms";
import { FONTS, PARTS } from "./parts";
import { FPS, MAX_FRAMES, MIN_FRAMES, MIN_MARK_MS, frameAt, msOf } from "./time";

/** Short, and safe as a key, an HTML id and a file name; long enough for a UUID. Never a name every object already has. */
export const IdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/)
  .refine((id) => !Object.hasOwn(Object.prototype, id), "is a name every object already has");

const FrameNo = z.number().int().min(0).max(MAX_FRAMES);
const Frames = z.number().int().min(MIN_FRAMES).max(MAX_FRAMES);

/* ── files ────────────────────────────────────────────────────────────────────────────────────── */

export const WordShape = z.strictObject({
  text: text(80),
  startMs: Ms,
  endMs: Ms,
  /** Present and true when the creator hid the word from the captions. */
  hidden: z.literal(true).optional(),
  /** Present and true when the captions are to stress the word. */
  stress: z.literal(true).optional(),
});
export const WordSchema = WordShape.refine((word) => word.startMs <= word.endMs, { path: ["endMs"], message: "ends before it starts" });

/** What is said in a file: each word starts no earlier than the one before it. */
export const WordsSchema = z.array(WordSchema).superRefine((words, ctx) => {
  words.forEach((word, i) => {
    const before = words[i - 1];
    if (before && word.startMs < before.startMs) ctx.addIssue({ code: "custom", path: [i, "startMs"], message: "starts before the word before it" });
  });
});

/** A path inside a storage bucket: parts split by "/", none empty, "." or "..", and no backslash. */
const StoragePath = z.string().min(1).max(400).refine(
  (path) => !path.includes("\\") && path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
  "is not a plain path",
);
/** A path inside the kit: lower-case letters, digits, "_", "." and "-", parts split by "/". */
const KitPath = z.string().max(80).regex(/^[a-z0-9][a-z0-9_.-]*(?:\/[a-z0-9][a-z0-9_.-]*)*$/);

/** What every file has: its id, where it came from and where it is kept. */
const file = {
  id: IdSchema,
  origin: z.enum(["filmed", "uploaded", "generated", "kit"]),
  at: z.union([z.strictObject({ bucket: z.string().min(1).max(60), path: StoragePath }), z.strictObject({ kit: KitPath })]),
};
const Pixels = z.number().int().min(1);
const Length = z.number().int().min(1);

/**
 * A file the edit uses, with the facts its kind has. The facts are measured on the server and
 * come into an edit only from there, never from a browser or a model.
 */
export const AssetSchema = z
  .discriminatedUnion("kind", [
    /** A clip: `ms` long, `w` by `h` pixels, with or without sound. `words` is what is said in it, timed on the file; null when nothing is, or nobody listened. */
    z.strictObject({ ...file, kind: z.literal("video"), ms: Length, w: Pixels, h: Pixels, sound: z.boolean(), words: WordsSchema.nullable() }),
    /** A picture: it has a size and no length. */
    z.strictObject({ ...file, kind: z.literal("image"), w: Pixels, h: Pixels }),
    /** A sound: it has a length and no size. */
    z.strictObject({ ...file, kind: z.literal("audio"), ms: Length }),
  ])
  .superRefine((asset, ctx) => {
    if (asset.kind !== "video") return;
    asset.words?.forEach((word, i) => {
      if (word.endMs > asset.ms) ctx.addIssue({ code: "custom", path: ["words", i, "endMs"], message: `ends after the file does, at ${asset.ms} ms` });
    });
  });

/* ── shots ────────────────────────────────────────────────────────────────────────────────────── */

/** How a picture is cropped: `zoom` enlarges it; `x` and `y`, -1 to 1, say which part shows once it is larger than the stage. */
export const FrameSchema = z.strictObject({ zoom: z.number().min(1).max(3), x: z.number().min(-1).max(1), y: z.number().min(-1).max(1) });

/** A place along a move: 0 is its start and 1 its end. Before 0 the framing holds where the move starts, after 1 where it ends. */
const Along = z.number().min(-1000).max(1000);
/**
 * A move of the framing: where it ends and how it eases there. `part` is the stretch of the move
 * this shot shows, from its first moment to its last: [0, 1] is all of it. Splitting or trimming
 * a shot changes its part and nothing else, so the move keeps its pace across the pieces, and a
 * shot made longer than the move holds still before or after it.
 */
export const MoveSchema = z
  .strictObject({ to: FrameSchema, ease: z.enum(["linear", "in", "out", "in-out"]), part: z.tuple([Along, Along]) })
  .refine((move) => move.part[0] <= move.part[1], { path: ["part"], message: "ends before it starts" });

/** A shot's framing: where it is, or where its move starts, and the move if it moves. */
export const FramingSchema = z.strictObject({ from: FrameSchema, move: MoveSchema.nullable() });

const CutFrames = z.number().int().min(2).max(30);
/** The side of the stage the next shot comes in from. */
const Side = z.enum(["left", "right", "top", "bottom"]);
export const CUT_KINDS = ["cut", "fade", "push", "wipe", "punch", "iris", "clock"] as const;
/**
 * How a shot hands over to the next. A plain cut, or one of six transitions the kit can draw on a
 * phone, each overlapping the two shots by `frames`: a cross-fade; the next shot pushing this one
 * out, or wiping over it, from a side; a punch (a hard cut with a quick push in); an iris; a clock
 * wipe. The last shot hands over to nothing, so its cut does nothing until a shot follows it.
 */
export const CutSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("cut") }),
  z.strictObject({ kind: z.literal("fade"), frames: CutFrames }),
  z.strictObject({ kind: z.literal("push"), frames: CutFrames, from: Side }),
  z.strictObject({ kind: z.literal("wipe"), frames: CutFrames, from: Side }),
  z.strictObject({ kind: z.literal("punch"), frames: CutFrames }),
  z.strictObject({ kind: z.literal("iris"), frames: CutFrames }),
  z.strictObject({ kind: z.literal("clock"), frames: CutFrames }),
]);

const Level = z.number().min(-1).max(1);
/** Adjustments on top of a preset. Each runs from -1 to 1, and 0 changes nothing. */
export const AdjustSchema = z.strictObject({
  exposure: Level, warmth: Level, tint: Level, shadows: Level, highlights: Level, contrast: Level, saturation: Level, vibrance: Level,
});

export const LOOK_IDS = ["natural", "vivid", "warm", "cool", "mono", "soft"] as const;
/** A colour look: a preset of the kit and adjustments on top of it. One pass over the footage. "natural" with nothing adjusted changes nothing. */
export const LookSchema = z.strictObject({ preset: z.enum(LOOK_IDS), adjust: AdjustSchema });
/**
 * What a shot changes of the film's look: a preset of its own, or null for the film's, and
 * adjustments added to the film's. So a look set on the film reaches every shot, tweaked or not.
 */
export const ShotLookSchema = z.strictObject({ preset: z.enum(LOOK_IDS).nullable(), adjust: AdjustSchema });

/* ── marks and items ──────────────────────────────────────────────────────────────────────────── */

/**
 * When a mark shows: from a moment of its shot's file, `atMs`, for `lenMs` of film. Its start
 * follows what is said through every trim, split and move; its length is what a viewer sees,
 * whatever the shot's speed.
 */
export const MARK_TIMING = { atMs: Ms, lenMs: z.number().int().min(MIN_MARK_MS).max(180_000) };
/**
 * When an item shows: from frame `at` for `frames`. With `anchor` "start", `at` counts from the
 * film's first frame; with "end", it is how many frames before the film's end the item starts, so
 * an end card stays at the end whatever is cut before it. `frames` null lasts to the film's end,
 * or to the end of the file it plays.
 */
export const ITEM_TIMING = { anchor: z.enum(["start", "end"]), at: FrameNo, frames: Frames.nullable() };

const mark = { id: IdSchema, ...MARK_TIMING };
/** A kit part on a shot. A part that plays a file names it in `asset`. */
export const MarkSchema = z.discriminatedUnion("part", [
  z.strictObject({ ...mark, part: z.literal("title"), props: PARTS.title.props }),
  z.strictObject({ ...mark, part: z.literal("callout"), props: PARTS.callout.props }),
  z.strictObject({ ...mark, part: z.literal("cutaway"), asset: IdSchema, props: PARTS.cutaway.props }),
  z.strictObject({ ...mark, part: z.literal("sound"), asset: IdSchema, props: PARTS.sound.props }),
]);
export const MARK_PARTS = ["title", "callout", "cutaway", "sound"] as const;

const item = { id: IdSchema, ...ITEM_TIMING };
/** A kit part on the film as a whole. */
export const ItemSchema = z.discriminatedUnion("part", [
  z.strictObject({ ...item, part: z.literal("title"), props: PARTS.title.props }),
  z.strictObject({ ...item, part: z.literal("callout"), props: PARTS.callout.props }),
  z.strictObject({ ...item, part: z.literal("progress"), props: PARTS.progress.props }),
  z.strictObject({ ...item, part: z.literal("cutaway"), asset: IdSchema, props: PARTS.cutaway.props }),
  z.strictObject({ ...item, part: z.literal("sound"), asset: IdSchema, props: PARTS.sound.props }),
]);
export const ITEM_PARTS = ["title", "callout", "progress", "cutaway", "sound"] as const;

/* ── the edit ─────────────────────────────────────────────────────────────────────────────────── */

export const CAPTION_LOOKS = ["pill", "pop", "highlight", "plain"] as const;
export const CaptionsSchema = z.strictObject({
  on: z.boolean(),
  look: z.enum(CAPTION_LOOKS),
  font: z.enum(FONTS),
  /** Pixels on the 1080-wide stage. */
  size: z.number().min(44).max(200),
  /** The caption line's centre, as a fraction of the stage's height. */
  y: Unit,
  /** Its widest, as a fraction of the stage's width. */
  width: z.number().gt(0).max(1),
  /** The most words on one page: up to a whole short sentence (16), set in rows by the kit's own line breaking (Task K1). */
  maxWords: z.number().int().min(1).max(16),
  /** The colour of the word being said; null for none. */
  highlight: Hex.nullable(),
  /** How heavy the letters are; left out, the look's own: 800, a stressed word 900 (X122). Every edit made before 2026-11-24 has none. */
  weight: Weight.optional(),
});

/** A shot before the rule that it ends after it starts, for `.pick()`. */
export const ShotShape = z.strictObject({
  id: IdSchema,
  asset: IdSchema,
  /** The stretch of its file it shows: from `startMs` up to `endMs`. For a picture, of its own clock. */
  startMs: Ms,
  endMs: Ms,
  speed: z.number().min(0.25).max(4),
  volume: z.number().min(0).max(2),
  framing: FramingSchema,
  /** What it changes of the film's look; null for nothing. */
  look: ShotLookSchema.nullable(),
  out: CutSchema,
  marks: z.array(MarkSchema),
});
export const ShotSchema = ShotShape.refine((shot) => shot.startMs < shot.endMs, { path: ["endMs"], message: "is not after its start" });

/** The picture that stands for the video: a moment of a shot, timed on the shot's file. */
export const CoverSchema = z.strictObject({ shot: IdSchema, atMs: Ms });

export const EditSchema = z.strictObject({
  v: z.literal(1),
  /** The kit the edit was made with. */
  kit: z.literal("1"),
  stage: z.strictObject({ w: z.literal(1080), h: z.literal(1920), fps: z.literal(FPS) }),
  assets: z.array(AssetSchema),
  /** The main sequence: played in order, with no gaps. */
  shots: z.array(ShotSchema).min(1),
  /** What sits on the film as a whole. */
  items: z.array(ItemSchema),
  captions: CaptionsSchema,
  /** The whole film's look. */
  look: LookSchema,
  cover: CoverSchema.nullable(),
});

export type Word = z.infer<typeof WordSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Frame = z.infer<typeof FrameSchema>;
export type Move = z.infer<typeof MoveSchema>;
export type Framing = z.infer<typeof FramingSchema>;
export type Cut = z.infer<typeof CutSchema>;
export type Adjust = z.infer<typeof AdjustSchema>;
export type Look = z.infer<typeof LookSchema>;
export type ShotLook = z.infer<typeof ShotLookSchema>;
export type Mark = z.infer<typeof MarkSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Captions = z.infer<typeof CaptionsSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Cover = z.infer<typeof CoverSchema>;
export type Edit = z.infer<typeof EditSchema>;

/** A stored document, validated. Throws a ZodError when it is not an edit. */
export function parseEdit(json: unknown): Edit {
  return EditSchema.parse(json);
}

/* ── what a new thing starts with ─────────────────────────────────────────────────────────────── */

export const STAGE = { w: 1080, h: 1920, fps: FPS } as const;

export const DEFAULT_CAPTIONS: Captions = Object.freeze({ on: true, look: "pill", font: "tiktok", size: 72, y: 0.8, width: 0.86, maxWords: 3, highlight: "#ffe14a" });

/** Adjustments that change nothing. Frozen: copy it to change it. */
export const NEUTRAL: Adjust = Object.freeze({ exposure: 0, warmth: 0, tint: 0, shadows: 0, highlights: 0, contrast: 0, saturation: 0, vibrance: 0 });
/** The look that changes nothing. Frozen: copy it to change it. */
export const NO_LOOK: Look = Object.freeze({ preset: "natural", adjust: NEUTRAL });

export function newShot(a: { id: string; asset: string; endMs: number; startMs?: number }): Shot {
  return {
    id: a.id, asset: a.asset, startMs: a.startMs ?? 0, endMs: a.endMs, speed: 1, volume: 1,
    framing: { from: { zoom: 1, x: 0, y: 0 }, move: null },
    look: null, out: { kind: "cut" }, marks: [],
  };
}

/**
 * A new edit of one take: one shot over all of it (three seconds for a picture, three minutes of
 * a longer clip), captions on. Throws for a file that cannot be a shot: a sound, or a clip
 * shorter than the shortest shot.
 */
export function newEdit(asset: Asset): Edit {
  if (asset.kind === "audio") throw new Error(`"${asset.id}" is a sound; an edit starts from a clip or a picture`);
  const endMs = asset.kind === "image" ? 3000 : Math.min(asset.ms, msOf(MAX_FRAMES, 1));
  if (frameAt(endMs, 1) < MIN_FRAMES) throw new Error(`"${asset.id}" is ${endMs} ms long; the shortest shot is ${MIN_FRAMES} frames`);
  return {
    v: 1, kit: "1", stage: { ...STAGE },
    assets: [asset],
    shots: [newShot({ id: asset.id === "s1" ? "s2" : "s1", asset: asset.id, endMs })],
    items: [],
    captions: { ...DEFAULT_CAPTIONS },
    look: structuredClone(NO_LOOK),
    cover: null,
  };
}
