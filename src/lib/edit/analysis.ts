/**
 * analysis.ts — what the worker measured of a take, as `review` and the recipes read it: its
 * pauses, its face and mouth five times a second, its loudness and its language (X62; the worker's
 * `worker/media/analyse.py` `Analysis`), and since part 3 its cuts and its picture every 500 ms (X97),
 * which a take analysed before has not, and for a reference its text on screen (X101). The take row's `analysis` holds these beside its copies'
 * keys and the words' counts, which are left out here.
 *
 * Every time is in milliseconds of the take's file. A box is a share of the take's picture as it is
 * shown (upright), from 0 to 1: its left, its top, its width and its height (X48).
 */
import { z } from "zod";
import type { TakeRow } from "./worker/takes";

/** How far past the picture's edge a box may reach: the worker rounds each edge to four places, so its sum may be a hair over 1. */
const ROUNDING = 1e-6;

const Ms = z.number().int().min(0);

/** A silence a cut may land in (X54): from `startMs` up to `endMs`, and `cutMs`, its quietest moment, where a recipe cuts. */
export const PauseSchema = z
  .object({ startMs: Ms, endMs: Ms, cutMs: Ms })
  .refine((pause) => pause.startMs < pause.endMs, { path: ["endMs"], message: "is not after its start" })
  .refine((pause) => pause.startMs <= pause.cutMs && pause.cutMs <= pause.endMs, { path: ["cutMs"], message: "is outside its pause" });

const Share = z.number().min(0).max(1);
/** A box as shares of the take's picture as shown: inside it. */
export const ShareBoxSchema = z
  .object({ x: Share, y: Share, w: Share, h: Share })
  .refine((box) => box.x + box.w <= 1 + ROUNDING, { path: ["w"], message: "reaches past the picture's right edge" })
  .refine((box) => box.y + box.h <= 1 + ROUNDING, { path: ["h"], message: "reaches past the picture's bottom edge" });

/** The face and the mouth at a moment of the take; null where none was found. */
export const FaceSampleSchema = z.object({ ms: Ms, face: ShareBoxSchema.nullable(), mouth: ShareBoxSchema.nullable() });

const LoudnessSchema = z.object({ lufs: z.number(), truePeak: z.number(), levels: z.array(z.object({ ms: Ms, lufs: z.number() })) });

/**
 * How the picture looks at a moment of the take (`worker/media/picture.py`): its brightness (YAVG / 255, so 0.063 to
 * 0.922 in the copies' limited range), its saturation (0 is grey) and its warmth (above 0 warm, below cool).
 */
export const PictureSampleSchema = z.object({ ms: Ms, luma: Share, sat: Share, warmth: z.number().min(-1).max(1) });

const Hex = z.string().regex(/^#[0-9a-f]{6}$/);
/**
 * A line of text a reference shows at a moment (`worker/media/text.py`, X101): the reader's box round its letters, what it
 * read and how sure it is (0 to 1), the box's colours, each with its share of the box's pixels and where its pixels lie
 * across the box (the 5th and 95th percentile of their x, as shares of the box's width), the colours of a ring just outside
 * the box, and of a ring beyond it. Colours are those holding at least 0.03, largest first.
 */
export const TextLineSchema = z.object({
  box: ShareBoxSchema,
  text: z.string().max(200),
  score: Share,
  colours: z.array(z.object({ hex: Hex, share: Share, from: Share, to: Share })),
  around: z.array(z.object({ hex: Hex, share: Share })),
  /** A second ring, as thick, one box height further out (Task 9c): a box behind the words ends before it. None before Task 9c. */
  beyond: z.array(z.object({ hex: Hex, share: Share })).optional(),
});
/** The lines on screen at a moment of a reference, top to bottom as the reader gave them; none for a moment without text. */
export const TextSampleSchema = z.object({ ms: Ms, lines: z.array(TextLineSchema) });

export const TakeAnalysisSchema = z.object({
  /** ISO 639-1; null when nothing was said and none was given, and for a reference, which is never heard (X103): it has no words, only its pauses. */
  language: z.string().nullable(),
  /** In order, none overlapping. A take with no speech has none. */
  pauses: z.array(PauseSchema).superRefine((pauses, ctx) => {
    pauses.forEach((pause, i) => {
      const before = pauses[i - 1];
      if (before && pause.startMs < before.endMs) ctx.addIssue({ code: "custom", path: [i, "startMs"], message: "starts before the pause before it ends" });
    });
  }),
  /** Five a second, in order. */
  faces: z.array(FaceSampleSchema).superRefine((faces, ctx) => {
    faces.forEach((sample, i) => {
      const before = faces[i - 1];
      if (before && sample.ms <= before.ms) ctx.addIssue({ code: "custom", path: [i, "ms"], message: "is not after the sample before it" });
    });
  }),
  /** Null for a take with no sound. */
  loudness: LoudnessSchema.nullable(),
  /** Where the picture changes from one shot to the next: each scene change's first frame, in ms, in order; none for one shot. Not measured before part 3. */
  cuts: z
    .array(Ms)
    .superRefine((cuts, ctx) => {
      cuts.forEach((ms, i) => {
        const before = cuts[i - 1];
        if (before !== undefined && ms <= before) ctx.addIssue({ code: "custom", path: [i], message: "is not after the cut before it" });
      });
    })
    .optional(),
  /** Every 500 ms from 0, in order. Not measured before part 3. */
  picture: z
    .array(PictureSampleSchema)
    .superRefine((picture, ctx) => {
      picture.forEach((sample, i) => {
        const before = picture[i - 1];
        if (before && sample.ms <= before.ms) ctx.addIssue({ code: "custom", path: [i, "ms"], message: "is not after the sample before it" });
      });
    })
    .optional(),
  /** A reference's sheet, the frames Qwen judges, stored beside its analysis (Task 9c): its file and the moments on it, in cell order. */
  sheet: z.object({ file: z.string().min(1), ms: z.array(Ms).max(12) }).optional(),
  /** A reference's text on screen at up to 40 moments, in order (X101). A creator's own take has none, nor a reference analysed before Task 9b. */
  text: z
    .array(TextSampleSchema)
    .superRefine((text, ctx) => {
      text.forEach((sample, i) => {
        const before = text[i - 1];
        if (before && sample.ms <= before.ms) ctx.addIssue({ code: "custom", path: [i, "ms"], message: "is not after the sample before it" });
      });
    })
    .optional(),
});

export type TakeAnalysis = z.infer<typeof TakeAnalysisSchema>;
export type TextLine = z.infer<typeof TextLineSchema>;
export type TextSample = z.infer<typeof TextSampleSchema>;
export type Pause = z.infer<typeof PauseSchema>;
export type ShareBox = z.infer<typeof ShareBoxSchema>;
export type FaceSample = z.infer<typeof FaceSampleSchema>;
export type PictureSample = z.infer<typeof PictureSampleSchema>;
/** By asset id. */
export type Analyses = Readonly<Record<string, TakeAnalysis>>;

/** What the worker measured of a take, from its row. Throws for a row with no analysis, or one that is not valid, naming the field. */
export function analysisOf(take: TakeRow): TakeAnalysis {
  if (take.analysis === null) throw new Error(`take ${take.id} has no analysis: it is ${take.status}`);
  const read = TakeAnalysisSchema.safeParse(take.analysis);
  if (!read.success) {
    const where = read.error.issues.map((issue) => `${issue.path.join(".") || "analysis"}: ${issue.message}`).join("; ");
    throw new Error(`take ${take.id}: its analysis is not valid (${where})`);
  }
  return read.data;
}
