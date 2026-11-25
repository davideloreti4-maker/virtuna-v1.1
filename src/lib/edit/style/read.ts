/**
 * read.ts — a reference's style (spec §12.2, as part 3 Task 9b remade it, X101): the measures (`measures.ts`) and its measured
 * text (`text.ts`) give everything that can be measured; Qwen judges only what cannot be, on one sheet of its frames
 * (`judgeSheet`); `styleOfReference` makes the profile in the kit's terms.
 *
 * The sheet: 12 frames of the reference as one shot, captions off and the natural look, drawn by the worker's `/stills` (`sheetOf`):
 * four across, each 270 × 480 (`worker/store.py`, `CELL`). `sheetFrames` chooses them: four over the opening, a second apart, and
 * the rest just after its cuts and spread over the rest of it.
 *
 * Why Qwen no longer reads the text: on ground-truth film 1 (captions 72 px in tiktok, highlight #ffe14a, a title of 120 px at
 * 0.16) its boxes on the sheet gave a caption size of 200 px, no highlight, inter, and a title of 220 px at 0.21, and on a second
 * run its boxes came in pixels instead of 0 to 1000. A plain text reader on the full frames read every caption's words exactly
 * and their middle within 0.004 (Task 9b's brief). So Qwen is told what was measured and asked only for the extras; since Task 9c
 * not for the grade either (it called a blue screen "cool" and bright B-roll "vivid"): the look is mono by measure, else natural.
 *
 * Since Task 9c the worker makes the sheet itself, from the text stage's frames (`analysis.sheet`, `worker/media/text.py`);
 * the app's read path moves to it after the deploy (the controller's part), until then `sheetOf` draws it.
 */
import { z } from "zod";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import type { TakeAnalysis } from "../analysis";
import type { Ask, Message } from "../agent/model";
import { createLogger } from "@/lib/logger";
import { CaptionsSchema } from "../doc";
import { PARTS } from "../parts";
import { FPS, frameAt } from "../time";
import { clamp, type Measures } from "./measures";
import { DEFAULT_STYLE, StyleProfileSchema, type StyleProfile } from "./profile";
import { isWhite, type TextRead } from "./text";
import { colourName } from "./words";

const log = createLogger({ module: "edit.style" });

/**
 * The sheet's frames:
 * - `openingMs`: four over the first five seconds, a second apart, so a title's end, taken halfway between the last of them it
 *   is on and the next, is within half a second (§7's gate) for a title ending by 3.5 s; the first half a second in, once the
 *   kit's title has come in (10 frames).
 * - `afterCutMs`: a frame just after each cut, 400 ms (12 frames) past it, so a transition has finished: Task 8 found a
 *   10-frame push 1 frame into its slide and a punch 3 frames in, which leaves at most 9 frames of it.
 * - `mostAtCuts`: after the opening, at most four frames at cuts (half the eight left), chosen evenly among the cuts, so the
 *   rest still spread over the whole reference.
 */
export const SHEET = { frames: 12, openingMs: [500, 1500, 2500, 3500], openingEndMs: 5000, afterCutMs: 400, mostAtCuts: 4 } as const;

/** A frame on a sheet (`worker/store.py`): four across, each a quarter of the stage. */
const CELL = { w: 270, h: 480, across: 4 } as const;

/* ── the judgement ────────────────────────────────────────────────────────────────────────────── */

/**
 * What else a reference may show, a closed list (Task 9b, round 2): asked for free words, Qwen called the take's own laptop shot
 * a cut-in and saw a split screen on ground-truth film 5 that is not there. Each kind it names must come with the cells it is
 * in. Task 9c took out "box or shape" (it caught the titles' own labels on two of Task 11's five references).
 */
export const EXTRA_KINDS = ["emoji", "sticker", "arrow", "progress bar", "clip or picture cut in", "split screen"] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];
/**
 * What Qwen may answer: the kinds, and "other text", dropped (text on screen is measured, as `other`). It gives the words a
 * place to go: without it Qwen named a false extra on the six kit films in 26 of 54 judgements, with it in 6 of 18 (Task 9c).
 */
const ANSWER_KINDS = [...EXTRA_KINDS, "other text"] as const;
/** How each kind reads in `notMatched`, one plain line a kind. */
const EXTRA_LINES: Record<ExtraKind, string> = {
  emoji: "emoji", sticker: "stickers", arrow: "arrows", "progress bar": "a progress bar", "clip or picture cut in": "clips or pictures cut in",
  "split screen": "a split screen",
};

/**
 * What Qwen judges of a sheet: what else is drawn or cut in, each kind with its cells. The grade is no longer judged (Task 9c,
 * X102 as amended): it called a blue screen "cool" and bright B-roll "vivid", and a wrong grade on a creator's face is worse
 * than none.
 */
export interface Judgement {
  extras: { kind: ExtraKind; cells: number[] }[];
}

/** One answer. Other keys (a grade it was not asked for) are passed over. */
const AnswerSchema = z.object({
  extras: z.array(z.strictObject({ kind: z.enum(ANSWER_KINDS), cells: z.array(z.number().int()).max(SHEET.frames) })).max(20),
});
type Answer = z.infer<typeof AnswerSchema>;

/** The tokens one judgement may use: a few extras with their cells, about 40 measured, with room. */
const JUDGE_TOKENS = 400;

const SYSTEM = [
  "You look at a sheet of frames from a short vertical video. Each frame is one cell of the sheet; the cells are numbered from 0, left to right and then down, four to a row.",
  "",
  `Answer with one JSON object only: {"extras": [{"kind": ${ANSWER_KINDS.map((kind) => `"${kind}"`).join(" | ")}, "cells": [int]}]}`,
  "",
  "- extras: each kind of thing, from the list only, that an editor drew over the video or cut into it, with the numbers of the",
  "  cells you see it in:",
  '  "emoji": an emoji drawn over the picture; "sticker": a cut-out image or a graphic drawn over the picture (not words);',
  '  "arrow": a drawn arrow pointing at something; "progress bar": a bar along an edge that fills as the video plays;',
  '  "clip or picture cut in": a whole cell of footage or an image from elsewhere (a screenshot, a photo, stock footage) in place',
  "  of the speaker's own camera; \"split screen\": two pictures side by side or one above the other in the same cell.",
  "  The speaker's own camera turned to their desk, their screen or their room is the same video, not a clip cut in, even where",
  '  no face is in the cell. "other text": words on screen other than the captions and the title. List a',
  '  kind only where it is plainly there; when unsure, leave it out. Most videos have none: then answer {"extras": []}.',
].join("\n");

/** The user's message: where each cell is in the video, what was read already, and the sheet. */
function sheetMessage(sheetJpeg: string, frames: readonly number[], seen: { captions: string[]; title: string | null }): Message {
  const rows = Math.ceil(frames.length / CELL.across);
  const times = frames.map((frame, cell) => `cell ${cell}: ${(frame / FPS).toFixed(1)} s`).join(", ");
  return {
    role: "user",
    content: [
      { type: "text", text: `The sheet: ${frames.length} frames, ${Math.min(CELL.across, frames.length)} across and ${rows} down. Where each is in the video: ${times}.` },
      { type: "text", text: readAlready(seen) },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${sheetJpeg}` } },
    ],
  };
}

/** What was read already, so that it is not listed: some of the captions' words and the title's, quoted. */
function readAlready(seen: { captions: string[]; title: string | null }): string {
  const quoted = (texts: readonly string[]) => texts.map((text) => JSON.stringify(text)).join(", ");
  const captions = seen.captions.length > 0 ? `The captions, read already: ${quoted(seen.captions.slice(0, SEEN_CAPTIONS))}.` : "There are no captions.";
  const title = seen.title === null ? "There is no title." : `The title, read already: ${quoted([seen.title])}.`;
  return `${captions} ${title}`;
}
/** How many of the captions' pages are quoted to Qwen: enough to know them by. */
const SEEN_CAPTIONS = 6;

/** The answer read, or what is wrong with it in a line. */
function answerOf(text: string): { ok: true; answer: Answer } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripModelOutput(text));
  } catch (error) {
    return { ok: false, error: `it is not JSON (${error instanceof Error ? error.message : String(error)})` };
  }
  const read = AnswerSchema.safeParse(json);
  if (read.success) return { ok: true, answer: read.data };
  return { ok: false, error: read.error.issues.map((issue) => `${issue.path.join(".") || "the answer"}: ${issue.message}`).join("; ") };
}

/**
 * Qwen's judgement of the sheet `sheetJpeg` (a JPEG in base64, as `sheetOf` gives it) of the reference's `frames`, in cell
 * order, told what was measured (`seen`): asked twice at once (the controller's ruling after Task 9c: one answer named false
 * extras on half the kit films), each a sighted call, thinking off, with one repair when its answer is outside its shape.
 * Kept: the kinds both answers name, on the cells both name. One answer stands alone when the other call fails; null when
 * both do: the profile is then made from the measures alone. Never throws.
 */
export async function judgeSheet(sheetJpeg: string, frames: number[], seen: { captions: string[]; title: string | null }, ask: Ask): Promise<Judgement | null> {
  const [one, two] = await Promise.all([judgeOnce(sheetJpeg, frames, seen, ask), judgeOnce(sheetJpeg, frames, seen, ask)]);
  if (one === null || two === null) return one ?? two;
  return {
    extras: one.extras.flatMap(({ kind, cells }) => {
      const also = new Set(two.extras.find((extra) => extra.kind === kind)?.cells ?? []);
      const both = cells.filter((cell) => also.has(cell));
      return both.length > 0 ? [{ kind, cells: both }] : [];
    }),
  };
}

/**
 * One judgement: its kinds in the list's order, each once with all the cells named for it, all on the sheet; "other text"
 * dropped. Null, said in the log in no words of the reference, when its answer cannot be read twice or a call fails.
 */
async function judgeOnce(sheetJpeg: string, frames: number[], seen: { captions: string[]; title: string | null }, ask: Ask): Promise<Judgement | null> {
  const messages: Message[] = [{ role: "system", content: SYSTEM }, sheetMessage(sheetJpeg, frames, seen)];
  try {
    let said = await ask(messages, { maxTokens: JUDGE_TOKENS, thinking: false });
    let read = answerOf(said.text);
    if (!read.ok) {
      const cut = said.truncated ? " It stopped at the token limit before it ended: keep it shorter." : "";
      messages.push({ role: "assistant", content: said.text }, { role: "user", content: `Your answer could not be read: ${read.error}.${cut} Answer again with one JSON object only, in the shape asked.` });
      said = await ask(messages, { maxTokens: JUDGE_TOKENS, thinking: false });
      read = answerOf(said.text);
    }
    if (!read.ok) {
      log.warn("a reference's sheet was judged, but the answer could not be read twice; it is read from its measures alone", { error: read.error.slice(0, 300) });
      return null;
    }
    const onSheet = (cell: number) => cell >= 0 && cell < frames.length;
    const extras = read.answer.extras.filter((extra) => extra.cells.length > 0 && extra.cells.every(onSheet));
    return {
      extras: EXTRA_KINDS.flatMap((kind) => {
        const cells = [...new Set(extras.filter((extra) => extra.kind === kind).flatMap((extra) => extra.cells))].sort((a, b) => a - b);
        return cells.length > 0 ? [{ kind, cells }] : [];
      }),
    };
  } catch (error) {
    log.warn("a reference's sheet could not be judged; it is read from its measures alone", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/* ── the sheet's frames ───────────────────────────────────────────────────────────────────────── */

/**
 * The 12 frames of a reference `ms` long to draw on its sheet, in order (`SHEET`): four over its opening, a second apart, where
 * a cut in the opening takes the place of the opening frame nearest it; one just after each cut after the opening (at most four,
 * chosen evenly); and the rest spread evenly over what follows the opening (over all of a reference no longer than it).
 */
export function sheetFrames(analysis: TakeAnalysis, ms: number): number[] {
  const last = Math.max(0, frameAt(ms, 1) - 1);
  const afterCuts = (analysis.cuts ?? []).map((cut) => cut + SHEET.afterCutMs).filter((at) => at < ms);
  const opening: number[] = SHEET.openingMs.filter((at) => at < ms);
  const taken = new Set<number>();
  for (const at of afterCuts.filter((each) => each < SHEET.openingEndMs)) {
    const free = opening.map((each, i) => ({ i, off: Math.abs(each - at) })).filter(({ i }) => !taken.has(i));
    const nearest = free.sort((a, b) => a.off - b.off)[0];
    if (!nearest) break;
    opening[nearest.i] = at;
    taken.add(nearest.i);
  }
  const atCuts = evenly(afterCuts.filter((at) => at >= SHEET.openingEndMs), SHEET.mostAtCuts);
  const left = SHEET.frames - opening.length - atCuts.length;
  const from = ms > SHEET.openingEndMs ? SHEET.openingEndMs : 0;
  const spread = Array.from({ length: left }, (_, i) => from + ((i + 0.5) * (ms - from)) / left);
  const frames = [...new Set([...opening, ...atCuts, ...spread].map((at) => clamp(frameAt(at, 1), 0, last)))].sort((a, b) => a - b);
  // Two moments on one frame: the widest gap left between frames is halved until there are 12, or no frame is left free.
  while (frames.length < SHEET.frames) {
    const bounds = [-1, ...frames, last + 1];
    let [gap, at] = [1, -1];
    for (let i = 1; i < bounds.length; i++) if (bounds[i]! - bounds[i - 1]! > gap) [gap, at] = [bounds[i]! - bounds[i - 1]!, i];
    if (at < 0) break;
    frames.splice(at - 1, 0, Math.floor((bounds[at - 1]! + bounds[at]!) / 2));
  }
  return frames;
}

/** At most `most` of `values`, chosen evenly through them, in order. */
function evenly<T>(values: readonly T[], most: number): T[] {
  if (values.length <= most) return [...values];
  return Array.from({ length: most }, (_, i) => values[Math.floor(((i + 0.5) * values.length) / most)]!);
}

/* ── the profile ──────────────────────────────────────────────────────────────────────────────── */

/** The kit's sizes: the captions' 44 to 200, the title's 84 to 220 (their schemas'). */
const CAPTION_SIZE = { min: CaptionsSchema.shape.size.minValue!, max: CaptionsSchema.shape.size.maxValue! };
const TITLE_SIZE = { min: PARTS.title.props.shape.size.minValue!, max: PARTS.title.props.shape.size.maxValue! };
const TITLE_FRAMES = { min: 15, max: 600 } as const;
const MOST_WORDS = 16;
/** The longest item of `notMatched` (the profile's). */
const NOTE = 60;

/**
 * The style of a reference (`name`, or null), in the kit's terms (the brief, part 3 Task 9b), from its measures, its measured
 * text and Qwen's judgement of its sheet (null: the measures alone):
 * - captions: a backing gives `pill`; the said word on a box behind it `highlight`; in coloured letters `pop`; else `plain`.
 *   The font, the size (held to the kit's 44 to 200), the place, the words a page (1 to 6) and the highlight as measured.
 *   No captions measured: off.
 * - title: as measured: from its start to its end in frames (half a second to five), `label` for a backing, `outline` for an
 *   edge, else `bold`, its size held to the kit's 84 to 220.
 * - look: mono when the measures say so; else the judgement's grade (but mono, which the measures did not find); else natural.
 * - pace: the measures' pause, cuts a minute and quiet share (X104).
 * - notMatched: capitals, an ink that is not white, more than 6 words a page, a size past the kit's range, each other text on
 *   screen, and one plain line for each kind of extra the judgement found, each once, at most 60 letters.
 */
export function styleOfReference(measures: Measures, text: TextRead, judgement: Judgement | null, name: string | null): StyleProfile {
  const notMatched: string[] = [];
  const read = text.captions;
  let captions: StyleProfile["captions"] = { ...DEFAULT_STYLE.captions, on: false };
  if (read) {
    const look = read.backing ? "pill" : read.said === "box" ? "highlight" : read.said === "letters" ? "pop" : "plain";
    captions = { on: true, look, font: read.font, size: Math.round(clamp(read.size, CAPTION_SIZE.min, CAPTION_SIZE.max)), y: read.y, maxWords: clamp(read.maxWords, 1, MOST_WORDS), highlight: read.highlight };
    if (read.upper) notMatched.push("captions in capitals");
    if (read.ink !== null && !isWhite(read.ink)) notMatched.push(`${colourName(read.ink)} caption text`); // a word, never a hex (A-I3)
    if (read.maxWords > MOST_WORDS) notMatched.push(`captions of ${read.maxWords} words a page`);
    if (read.typeface === "unlike") notMatched.push("captions in a typeface unlike the kit's");
    if (read.typeface === "script") notMatched.push("captions in a script the kit has no letters for");
    if (read.size > CAPTION_SIZE.max) notMatched.push("captions larger than the kit draws");
    if (read.size < CAPTION_SIZE.min) notMatched.push("captions smaller than the kit draws");
  }
  let title: StyleProfile["title"] = null;
  if (text.title) {
    const { y, size, fromMs, toMs, stays, backing, edge, ink } = text.title;
    title = {
      on: true, y, frames: Math.round(clamp(((toMs - fromMs) * FPS) / 1000, TITLE_FRAMES.min, TITLE_FRAMES.max)),
      look: backing ? "label" : edge ? "outline" : "bold", size: Math.round(clamp(size, TITLE_SIZE.min, TITLE_SIZE.max)),
      ...(stays ? { stays: true } : {}),
      ...(ink !== null && !isWhite(ink) ? { ink } : {}),
    };
    if (size > TITLE_SIZE.max) notMatched.push("a title larger than the kit draws");
    if (size < TITLE_SIZE.min) notMatched.push("a title smaller than the kit draws");
  }
  const kinds = new Set((judgement?.extras ?? []).map((extra) => extra.kind));
  // Other text is named once, in no words of it: a profile never quotes a reference (X96, Task 9c).
  const extras = [...(text.other.length > 0 ? ["other text on screen"] : []), ...EXTRA_KINDS.flatMap((kind) => (kinds.has(kind) ? [EXTRA_LINES[kind]] : []))];
  return StyleProfileSchema.parse({
    source: { kind: "reference", name },
    pace: { pauseMs: measures.pauseMs, cutsPerMin: clamp(measures.cutsPerMin, 0, 60), quiet: measures.quiet },
    captions,
    title,
    punchIns: measures.punchIns && { perMin: clamp(measures.punchIns.perMin, 0, 30), zoom: measures.punchIns.zoom },
    look: { preset: measures.look === "mono" ? "mono" : "natural" },
    notMatched: [...new Set([...notMatched, ...extras].map((note) => note.trim().slice(0, NOTE)))].filter(Boolean).slice(0, 20),
  });
}
