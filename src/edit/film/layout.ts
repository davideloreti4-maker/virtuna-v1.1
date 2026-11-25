/**
 * layout.ts — where the kit puts its words and its bar: each caption page's, title's, call-out's
 * and progress bar's box on the stage (X91). Pure: settings and a measure in, boxes out.
 *
 * The parts draw from these, measuring in the browser (`measuredIn` in fonts.ts: `measureText` with
 * `MEASURED_AS`, the call they have always made). `review` judges from them on the server,
 * measuring with the width tables (`src/lib/edit/measure.ts`). So what is judged is what is drawn.
 *
 * A box is in stage pixels: its left, top, width and height. It is the part's box at rest, as the
 * page lays it out: it leaves out what is drawn past it (an outline's stroke, a shadow) and what
 * moves (a part coming in or going out, the pop of the word being said).
 *
 * The rules, as the components set them when they were moved here (2026-11-21):
 *
 * Captions (Captions.tsx): one page of a run's words at a time.
 * - Weights (`captionWeights`): the captions' own `weight`, a stressed word `STRESS_STEP` heavier, at most 900, but
 *   on a plain page with no highlight colour every word at that weight (ruled 2026-11-24); with none (every edit made
 *   before 2026-11-24), 800 and a stressed word 900. Measured at the captions' size.
 * - Colour (`wordLight`): in pill, pop and highlight only the word being said; in plain the stressed words.
 * - The room for a row: even(stage width × width), less the look's side at the asked size at each
 *   side. The side is round(0.46 × size) for the pill (its padding), round(0.16 × size) for the
 *   highlight (how far the highlighted word's box reaches past its letters), else 0.
 * - The size: when the widest word is wider than the room, floor(size × room / widest); else the
 *   size asked.
 * - Each word: ceil(its width at that size), at most the room. Between words: for a sentence (`sentenceSet`: plain
 *   with a weight set, X124) round(the typeface's own space at the captions' weight × size), the space read from
 *   `spaces.json` (`spaceEm`, X125); else round(0.34 × size).
 * - The dark edge round the letters (`edgeOf`, drawn past the box): none on the pill, `PLAIN_EDGE` × size for a
 *   sentence, else 0.09 × size.
 * - The rows: `rowsWithin` (lines.ts), the fewest rows each no wider than the room, evened out.
 *   Each row is even(its words and gaps) wide.
 * - The page: its widest row plus the side at the page's own size at each side, wide. Its rows at
 *   a pitch of even(size × 1.15), even(0.12 × size) between rows, and the pill's padding,
 *   round(0.24 × size), above and below, tall.
 * - Its place: centred across the stage. Its centre is at round(y × stage height), held so that
 *   the run's tallest page keeps 0.02 of the stage's height from the top and from the bottom.
 *   Every page of a run is held alike, so that a page of fewer rows does not jump. So a page's
 *   box is had only with its run's other pages (`captionPages`).
 *
 * Title (parts/Title.tsx)
 * - Weight (`titleWeight`): its own `weight`; with none, 700 for a label, else 800. Letters 0.01 em closer than the
 *   typeface sets them.
 * - Its box: even(stage width × 0.78) for a label, else even(stage width × 0.86).
 * - The size and the lines: `fitLines` (lines.ts) on at most three lines, from widths measured at
 *   100 px and taken per px of type, a label keeping 0.4 of its size free at each end of a line.
 *   As large as asked when it fits.
 * - Each line: even(ceil(its width at that size)), plus a label's padding, round(0.4 × size), at
 *   each end. It is centred in the title's box; one wider than the box starts at the box's left,
 *   as a browser sets a block wider than its room with auto margins.
 * - Its lines: a pitch of even(size × 1.4) for a label, else even(size × 1.12), one under another.
 * - Its place: centred across the stage. Its centre is at round(y × stage height), held so that
 *   its lines keep 0.02 of the stage's height from the top and from the bottom.
 * - Its box here is its lines' box: the widest line's left to right, the first line's top to the
 *   last line's bottom. That is where its letters and its labels are.
 *
 * Call-out (parts/Callout.tsx): one line.
 * - Weight (`calloutWeight`): its own; with none, 800.
 * - The room beside its letters, of its size, at each side: 0.36 for a label, 0.06
 *   (the outline's) for the other looks.
 * - The size: floor(min(size, fitted / (1 + 2 × room))), where `fitted` is what `fitText` gives
 *   for 0.9 of the stage's width: 0.9 × width / (its width at 100 px) × 100.
 * - The box: even(ceil(its width at that size)), plus a label's padding, round(0.36 × size), at
 *   each side, wide. even(size × 1.42) for a label, else even(size × 1.1), tall.
 * - Its place: its centre at round(x × stage width), held so that half of it (and, but for a
 *   label, the outline's room) keeps 0.03 of the stage's width from each side; and at
 *   round(y × stage height), held a type size from the top and from the bottom.
 *
 * Progress (parts/Progress.tsx)
 * - The stage's width, round(0.006 × stage height) thick, at its top or its bottom edge.
 *
 * A label's box (the title's and the call-out's, `labelFill`; Task K1): dark under light letters (0.78 for a title, 0.8 for a
 * call-out) and near-white under dark ones, stronger (0.92). The letters are light when their colour's luma is at least
 * `LIGHT_LETTERS`. A title's accent on a label (`accentFill`, fix round 2): coloured letters when it holds 3 to 1 against
 * its box where the box is weakest (the light box over black, the dark box over white), else a marker, a block of the
 * accent behind the word with the word in the label's letter colour, reaching a little past it and taking no room. A box's
 * colour and a marker move no box.
 */
import type { z } from "zod";
import { STAGE, type Captions } from "../../lib/edit/doc";
import type { PARTS } from "../../lib/edit/parts";
import { fitLines, markedWords, rowsWithin, type MarkedWord } from "./lines";
import { even, hold } from "./parts/types";
import spaces from "./spaces.json";

/** The width in px of a line of text in one typeface, unkerned, as the kit measures it. */
export type Measure = (text: string, weight: number, size: number, trackingEm?: number) => number;
/** Stage pixels: left, top, width, height. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** The stage's size in pixels. Every edit's is `STAGE`'s. */
export interface Stage {
  w: number;
  h: number;
}

export type TitleProps = z.infer<(typeof PARTS)["title"]["props"]>;
export type CalloutProps = z.infer<(typeof PARTS)["callout"]["props"]>;
export type ProgressProps = z.infer<(typeof PARTS)["progress"]["props"]>;

/** How near the stage's top and bottom the captions and a title may come, as a share of the stage's height. */
const EDGE = 0.02;

/* ── captions ─────────────────────────────────────────────────────────────────────────────────── */

/** A word on a caption page: its letters, and whether it is stressed. */
export interface CaptionWord {
  text: string;
  stress?: boolean;
}

/** The weights caption words are set in when the captions carry none: every edit made before 2026-11-24. */
export const CAPTION_WEIGHTS = { plain: 800, stressed: 900 } as const;
/** How much heavier a stressed word is than the captions' own weight (X123), up to 900. The one place that step is set. */
export const STRESS_STEP = 100;
/** The heaviest a caption word is set: the closed set's last weight (X122). */
const HEAVIEST = 900;

/**
 * The weights a page's words are set in: the captions' own and a stressed word's; with none, `CAPTION_WEIGHTS`. A plain
 * page with a weight and no highlight colour sets every word at its weight (ruled 2026-11-24: an even line).
 */
export function captionWeights(captions: Pick<Captions, "look" | "weight" | "highlight">): { plain: number; stressed: number } {
  if (captions.weight === undefined) return CAPTION_WEIGHTS;
  return { plain: captions.weight, stressed: sentenceSet(captions) && captions.highlight === null ? captions.weight : Math.min(HEAVIEST, captions.weight + STRESS_STEP) };
}

/**
 * How a caption word is coloured (Task 10b, D): `lit` takes the highlight colour, `onBox` sits on a box of it. In the looks
 * that follow the voice (pill, pop, highlight) only the word being said is, so a page never shows two coloured words; a
 * stressed word keeps its heavier weight and is coloured only while it is said. In plain, which does not follow the voice,
 * the stressed words are coloured.
 */
export function wordLight(look: Captions["look"], said: boolean, stressed: boolean): { lit: boolean; onBox: boolean } {
  if (look === "plain") return { lit: stressed, onBox: false };
  return { lit: said, onBox: look === "highlight" && said };
}

/** A caption page as it is set and placed. */
export interface CaptionLayout extends Box {
  /** Its type size. */
  size: number;
  /** The word each row starts with. */
  breaks: number[];
  /** Each word's width in whole pixels. */
  widths: number[];
  /** The room between two words of a row. */
  gap: number;
  /** Its rows: the words from `from` up to, not including, `to`, and the row's width. */
  rows: { from: number; to: number; width: number }[];
  /** The room beside the words inside the page's box, at each side. */
  side: number;
  /** The pill's padding above and below the rows. */
  pad: number;
  /** A row's height. */
  pitch: number;
  /** The room between two rows. */
  rowGap: number;
}

/** True for captions set as a sentence: plain, with a weight set (X124). */
export const sentenceSet = (captions: Pick<Captions, "look" | "weight">): boolean => captions.look === "plain" && captions.weight !== undefined;

const SPACES: Record<Captions["font"], Record<string, number>> = spaces;

/** A typeface's own space at a weight, in ems (`spaces.json`, beside the width tables, X125). Throws for a weight it does not hold. */
export function spaceEm(font: Captions["font"], weight: number): number {
  const em = Object.hasOwn(SPACES, font) && Object.hasOwn(SPACES[font], String(weight)) ? SPACES[font][String(weight)] : undefined;
  if (em === undefined) throw new Error(`no space for ${font} at weight ${weight}`);
  return em;
}

/** The plain sentence's dark edge, as a share of the size: 0.05, ruled by eye from 0.05, 0.06 and 0.07 (2026-11-24). */
export const PLAIN_EDGE = 0.05;

/** The dark edge round caption letters, in px: 0 for the pill (its box), PLAIN_EDGE of the size for a sentence, else 0.09 of it. */
export function edgeOf(captions: Pick<Captions, "look" | "weight">, size: number): number {
  if (captions.look === "pill") return 0;
  return (sentenceSet(captions) ? PLAIN_EDGE : 0.09) * size;
}

const sideOf = (look: Captions["look"], size: number) => (look === "pill" ? Math.round(0.46 * size) : look === "highlight" ? Math.round(0.16 * size) : 0);
const padOf = (look: Captions["look"], size: number) => (look === "pill" ? Math.round(0.24 * size) : 0);

/** A page set by itself: everything but its place, which its run decides. */
function setPage(captions: Captions, words: readonly CaptionWord[], measure: Measure, stage: Stage): Omit<CaptionLayout, "x" | "y"> {
  const weights = captionWeights(captions);
  const wideAt = (word: CaptionWord, size: number) => measure(word.text, word.stress ? weights.stressed : weights.plain, size);
  const room = even(stage.w * captions.width) - 2 * sideOf(captions.look, captions.size);
  const widest = Math.max(...words.map((word) => wideAt(word, captions.size)));
  const size = widest > room ? Math.floor((captions.size * room) / widest) : captions.size; // a word too long for the row: this page's type is set smaller
  const widths = words.map((word) => Math.min(room, Math.ceil(wideAt(word, size))));
  const gap = sentenceSet(captions) ? Math.round(spaceEm(captions.font, weights.plain) * size) : Math.round(0.34 * size);
  const across = (from: number, to: number) => widths.slice(from, to).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, to - from - 1);
  const breaks = rowsWithin(widths.length, room, across);
  const rows = breaks.map((from, i) => {
    const to = breaks[i + 1] ?? widths.length;
    return { from, to, width: even(across(from, to)) };
  });
  const [side, pad, pitch, rowGap] = [sideOf(captions.look, size), padOf(captions.look, size), even(size * 1.15), even(0.12 * size)];
  return {
    size, breaks, widths, gap, rows, side, pad, pitch, rowGap,
    w: Math.max(0, ...rows.map((row) => row.width)) + 2 * side,
    h: rows.length * pitch + Math.max(0, rows.length - 1) * rowGap + 2 * pad,
  };
}

/**
 * Every caption page of one run, set and placed as the kit draws them: each page is held inside
 * the stage by the run's tallest page. The only way to a page's box: a page set by itself would
 * be placed as if it were its run's tallest, which near the stage's edges it often is not (94 px
 * off on the demo edit). `review` gives it all the pages of a run.
 */
export function captionPages(captions: Captions, pages: readonly (readonly CaptionWord[])[], measure: Measure, stage: Stage = STAGE): CaptionLayout[] {
  const set = pages.map((words) => setPage(captions, words, measure, stage));
  // Every page is held by the tallest: centred on one line, kept 0.02 of the height from the edges.
  const half = Math.max(...set.map((page) => page.h)) / 2 + EDGE * stage.h;
  const top = Math.round(hold(captions.y * stage.h, half, stage.h - half));
  return set.map((page) => ({ ...page, x: stage.w / 2 - page.w / 2, y: top - page.h / 2 }));
}

/* ── the title ────────────────────────────────────────────────────────────────────────────────── */

/** A title's letter-spacing, in ems: a little closer than the typeface sets them. */
export const TITLE_TRACKING_EM = -0.01;
/** The type size a title's words are measured at, to find the size it is then set in. */
const MEASURED_AT = 100;
/** A label's padding at each end of a line, in type sizes. */
const SIDE = 0.4;

/** A title as it is set and placed. Its box is its lines' box. */
export interface TitleLayout extends Box {
  /** Its type size. */
  size: number;
  /** The word each line starts with. */
  breaks: number[];
  /** Its words, with their marked stretches. */
  words: MarkedWord[];
  weight: number;
  /** The width of the title's own box, which its lines are centred in. */
  room: number;
  /** A label's padding at each end of a line. */
  side: number;
  /** A line's height. */
  pitch: number;
  /** Its lines: the words from `from` up to, not including, `to`, and the width of their letters. */
  lines: { from: number; to: number; width: number }[];
}

/** The weight a title is set in: its own; with none, 700 for a label and 800 for the other looks. */
export const titleWeight = (props: Pick<TitleProps, "look" | "weight">): number => props.weight ?? (props.look === "label" ? 700 : 800);

export function titleBox(props: TitleProps, measure: Measure, stage: Stage = STAGE): TitleLayout {
  const label = props.look === "label";
  const weight = titleWeight(props);
  const room = even(stage.w * (label ? 0.78 : 0.86));
  const words = markedWords(props.text);
  const wide = (from: number, to: number, size: number) => measure(words.slice(from, to).map((word) => word.text).join(" "), weight, size, TITLE_TRACKING_EM);
  const fit = fitLines(words.length, 3, room, props.size, label ? 2 * SIDE : 0, (from, to) => wide(from, to, MEASURED_AT) / MEASURED_AT);
  const size = fit.size;
  const lines = fit.breaks.map((from, i) => {
    const to = fit.breaks[i + 1] ?? words.length;
    return { from, to, width: even(Math.ceil(wide(from, to, size))) };
  });
  const side = label ? Math.round(SIDE * size) : 0;
  const pitch = even(size * (label ? 1.4 : 1.12)); // from one line to the next; a label's line is its box
  const half = (lines.length * pitch) / 2 + EDGE * stage.h;
  const top = Math.round(hold(props.y * stage.h, half, stage.h - half)); // held inside the stage, whatever place it is given
  // Each line is centred in the title's box (`lineSpans`), which is centred on the stage.
  const left = stage.w / 2 - room / 2;
  const spans = lineSpans(lines, side, room);
  const x = spans.length === 0 ? stage.w / 2 : left + Math.min(...spans.map((span) => span.left));
  const h = lines.length * pitch;
  return {
    size, breaks: fit.breaks, words, weight, room, side, pitch, lines,
    x, y: top - h / 2, w: spans.length === 0 ? 0 : left + Math.max(...spans.map((span) => span.right)) - x, h,
  };
}

/**
 * Each line's span inside a title's box `room` wide, its left and its right: its letters' width and a label's padding at each
 * end, centred, or from the box's left when wider than the room, as a browser sets a block with `margin: 0 auto`. The one rule
 * for the box the review reads (`titleBox`) and the label's drawn shape (`Title.tsx`), so the two cannot part.
 */
export function lineSpans(lines: readonly { width: number }[], side: number, room: number): { left: number; right: number }[] {
  return lines.map((line) => {
    const wide = line.width + 2 * side;
    const left = Math.max(0, (room - wide) / 2);
    return { left, right: left + wide };
  });
}

/* ── the call-out ─────────────────────────────────────────────────────────────────────────────── */

/** A call-out as it is set and placed. */
export interface CalloutLayout extends Box {
  /** Its type size. */
  size: number;
  weight: number;
  /** A label's padding at each side. */
  side: number;
}

/** The weight a call-out is set in: its own; with none, 800. */
export const calloutWeight = (props: Pick<CalloutProps, "weight">): number => props.weight ?? 800;

export function calloutBox(props: CalloutProps, measure: Measure, stage: Stage = STAGE): CalloutLayout {
  const weight = calloutWeight(props);
  const label = props.look === "label";
  const pad = label ? 0.36 : 0.06; // the room beside its letters, of the type size, each side
  const fitted = ((stage.w * 0.9) / measure(props.text, weight, 100)) * 100; // what `fitText` gives: the width it fits in over its width at 100 px, times 100
  const size = Math.floor(Math.min(props.size, fitted / (1 + 2 * pad)));
  const side = label ? Math.round(pad * size) : 0;
  const pitch = even(size * (label ? 1.42 : 1.1));
  // Its box in whole, even pixels, so that it is centred on whole pixels and its letters start on one.
  const w = even(Math.ceil(measure(props.text, weight, size))) + 2 * side;
  const half = w / 2 + (label ? 0 : pad * size);
  const left = Math.round(hold(props.x * stage.w, stage.w * 0.03 + half, stage.w * 0.97 - half));
  const top = Math.round(hold(props.y * stage.h, size, stage.h - size));
  return { size, weight, side, x: left - w / 2, y: top - pitch / 2, w, h: pitch };
}

/* ── a label's box ────────────────────────────────────────────────────────────────────────────── */

/** The luma at or above which a label's letters are light, and its box dark: half of white's. */
export const LIGHT_LETTERS = 0.5;
/** The light box's grey, and its strength: stronger than the dark box, which showed grey over dark hair at 0.78 (fix round 2). */
const LIGHT_BOX = 250;
export const LIGHT_STRENGTH = 0.92;

/** A colour's red, green and blue, each 0 to 1. Throws for anything but "#rrggbb", which is all the schemas let through. */
function channelsOf(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`${JSON.stringify(hex)} is not a colour as #rrggbb`);
  return [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
}

/** A colour's luma, 0 for black to 1 for white: Rec. 709's weights (the sRGB primaries') on its values as written, "#rrggbb". */
export function lumaOf(hex: string): number {
  const [r, g, b] = channelsOf(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The box a label's letters sit on: dark under light letters, as it always was, at `strength` (its opacity, the part's own),
 * and near-white under dark ones at `LIGHT_STRENGTH`, so that a label reads on any picture whatever colour the creator, a
 * style or the agent gives its letters.
 */
export function labelFill(color: string, strength: number): string {
  return lumaOf(color) >= LIGHT_LETTERS ? `rgba(0, 0, 0, ${strength})` : `rgba(${LIGHT_BOX}, ${LIGHT_BOX}, ${LIGHT_BOX}, ${LIGHT_STRENGTH})`;
}

/** The least contrast (WCAG's ratio) an accent drawn as letters holds against its label's box: 3 to 1, what large type needs. */
export const ACCENT_CONTRAST = 3;

/** A colour's relative luminance, WCAG's: its channels made linear, then Rec. 709's weights. */
function luminanceOf([r, g, b]: readonly number[]): number {
  const linear = (c = 0) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
/** WCAG's contrast between two relative luminances. */
const contrastOf = (one: number, other: number): number => (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);

/**
 * How a label's accent words are drawn (Task K1, fix rounds 1 and 2): as `letters` of the accent's colour when the accent
 * holds 3 to 1 against the label's box where the box is weakest, the light box over a black picture (250 at 0.92) and the
 * dark box over a white one (black at `strength`); else as a `block`, a marker of the accent's colour behind the word, its
 * letters in the label's own colour. One rule for both boxes: the captions' yellow on the light box, a deep red on the dark.
 * A block only where the letters stand out on it more than the accent does on the box, so letters never sit on a block of
 * their own colour (no accent: the letters' colour). No setting: the colours decide.
 */
export function accentFill(accent: string, letters: string, strength: number): "letters" | "block" {
  const own = luminanceOf(channelsOf(accent));
  const dark = lumaOf(letters) >= LIGHT_LETTERS;
  const box = luminanceOf(Array(3).fill(dark ? 1 - strength : (LIGHT_BOX * LIGHT_STRENGTH) / 255));
  const onBox = contrastOf(own, box);
  if (onBox >= ACCENT_CONTRAST) return "letters";
  return contrastOf(luminanceOf(channelsOf(letters)), own) > onBox ? "block" : "letters";
}

/* ── the progress bar ─────────────────────────────────────────────────────────────────────────── */

export function progressBox(props: ProgressProps, stage: Stage = STAGE): Box {
  const h = Math.round(stage.h * 0.006);
  return { x: 0, y: props.edge === "top" ? 0 : stage.h - h, w: stage.w, h };
}
