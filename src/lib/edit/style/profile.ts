/**
 * profile.ts — a style, in the kit's own terms (X95): one `StyleProfile`, whatever its source (a reference video, a preset, the
 * creator's words, or the default). The first cut applies it (Task 10) and the match check reads an edit against it (`match.ts`).
 * Spec: docs/superpowers/specs/2026-11-21-edit-agent-design.md §12.1.
 *
 * - `pace`: the pause `tighten` keeps between phrases (120 to 400 ms, its own range), and the cuts a minute; null when the style
 *   says nothing of its cuts (a preset or words may not); and, from a reference, the quiet share of its spoken span (X104).
 * - `captions`: the kit's caption settings, less their width, which `placeCaptions` sets.
 * - `title`: the hook over the opening: where it sits, how long it stays (or that it stays to the end), how it looks, how
 *   large and in what colour; null for none.
 * - `punchIns`: the shot after a cut framed tighter, how often and by how much (`punchIns`, X100); null for none.
 * - `look`: one of the kit's presets.
 * - `notMatched`: what the style does that the kit cannot draw (emoji, stickers, sound effects…), each in a few words.
 */
import { z } from "zod";
import { CaptionsSchema, DEFAULT_CAPTIONS, LOOK_IDS } from "../doc";
import { PARTS } from "../parts";

const Title = PARTS.title.props.shape;

export const StyleProfileSchema = z.strictObject({
  source: z.strictObject({ kind: z.enum(["reference", "preset", "words", "default"]), name: z.string().max(80).nullable() }),
  /**
   * `quiet` (X104): the share of the spoken span (first speech to last) that is pause, which a reference's pace is matched by
   * when it has one (`matchOf`); `pauseMs` is then what the first cut starts from (`pauseFor`). Optional: a style without it is
   * matched by `pauseMs`.
   */
  pace: z.strictObject({ pauseMs: z.number().int().min(120).max(400), cutsPerMin: z.number().min(0).max(60).nullable(), quiet: z.number().min(0).max(0.6).nullable().optional() }),
  /** The kit's captions, `maxWords` up to 16 as the kit sets them (Task K1; real references set pages of up to 15, Task 9c). */
  captions: CaptionsSchema.pick({ on: true, look: true, font: true, size: true, y: true, maxWords: true, highlight: true, weight: true }),
  /**
   * The title part's own `y`, `look` and `size`; `frames` from half a second to twenty (Task 9c: a hook held long);
   * `stays`, it holds to the film's end (a hook label held for the whole video); `ink`, its letters' colour (absent: white);
   * `weight`, the title part's own (absent: the look's).
   */
  title: z
    .strictObject({
      on: z.boolean(), y: Title.y, frames: z.number().int().min(15).max(600), look: Title.look, size: Title.size,
      stays: z.boolean().optional(), ink: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), weight: Title.weight,
    })
    .nullable(),
  punchIns: z.strictObject({ perMin: z.number().min(0).max(30), zoom: z.number().min(1.05).max(1.3) }).nullable(),
  look: z.strictObject({ preset: z.enum(LOOK_IDS) }),
  notMatched: z.array(z.string().max(60)).max(20),
});

export type StyleProfile = z.infer<typeof StyleProfileSchema>;

/** The kit's own captions, as a style holds them: all but their width. */
const { width: _width, ...KIT_CAPTIONS } = DEFAULT_CAPTIONS;

/**
 * The style when none is asked for: the kit's own captions, no title and no punch-ins, the natural look, and a pause of 250 ms,
 * about the middle of `tighten`'s 120 to 400. Without a style the first cut has Qwen choose the pace and the look (spec §5);
 * this is what stands for them until it has.
 */
export const DEFAULT_STYLE: StyleProfile = Object.freeze({
  source: { kind: "default", name: null },
  pace: { pauseMs: 250, cutsPerMin: null },
  captions: KIT_CAPTIONS,
  title: null,
  punchIns: null,
  look: { preset: "natural" },
  notMatched: [],
});
