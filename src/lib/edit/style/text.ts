/**
 * text.ts — what a reference's measured text says of its captions, its title and the rest (part 3, Task 9b, X101). Pure: the
 * worker reads the text on up to 40 frames and the colours in and around each line (`worker/media/text.py`); this reads the
 * style from those measures. Qwen judges only what cannot be measured (`read.ts`).
 *
 * The rules, each number in `TEXT_RULES` with what it was measured on:
 * 1. **Rows and pages.** Lines the reader scores under `minScore` are not read. It sometimes gives one row in pieces (a
 *    coloured word cut off from the rest): lines of a moment that share most of their height and lie close across are one
 *    row, left to right. A **page** is the rows of a moment stacked together: each overlapping the one above across, no
 *    further below it than `pageGap` of a row's height, and held (rule 3) as it is or changing as it is. A two-row caption is
 *    one page; a two-row title one block.
 * 2. **The caption band.** Each page's centre is binned in steps of `bin`; the band (a bin and its two neighbours) holding the
 *    most pages whose text is not what that band showed at the moment before is where the captions are. Fewer than
 *    `leastPages` such pages: no captions.
 * 3. **Held text**, outside the caption band: the same letters and digits (case folded) at the same place (centre within
 *    `samePlace`) at consecutive moments, spanning at least `heldMs`. The **title** is held text on by `titleByMs` and gone
 *    before `titleGoneBy` of the reference (the tallest, if several); the rest is `other`, in the order it comes on.
 * 4. **The captions, measured.** `y` the median page centre. **Font and size from widths:** for each kit font, the rows of
 *    at least `fontLetters` letters are fitted as `box width = size × the row's width at size 1, as the kit sets it + the
 *    reader's padding`; the font is the one the fit suits best, the size its fit's (with fewer than `fontRows` rows, inter).
 *    **Colours:** a row's letter colours are its colours that are not its background (near a ring colour of every piece of
 *    the row) and are light or strong. The ink is white when white letters are common, else the commonest largest; an accent
 *    is another colour far from the ink, large enough and narrow enough, said by a `box` when it fills its stretch of the
 *    row, else by its `letters`. Over the rows: the commonest accent when enough pages have one; a backing when most rows'
 *    rings are one flat colour; an edge when, on the rows over a light picture, the dark holds enough of the light. The words
 *    a page are the most seen on two pages or more.
 * 5. **The title, measured** as the captions are, in the title's own font and weight.
 */
import type { TakeAnalysis, TextLine } from "../analysis";
import { CAPTION_WEIGHTS, TITLE_TRACKING_EM } from "../../../edit/film/layout";
import { measure } from "../measure";
import { FONTS } from "../parts";
import { clamp, medianOf } from "./measures";

type Font = (typeof FONTS)[number];

export interface TextRead {
  captions: null | {
    y: number;
    size: number;
    font: Font;
    /**
     * Whether the letters are like the kit's (Task 9c): "kit", sized and set in the font their widths fit; "unlike", no kit font
     * fits them (a condensed serif, say), sized by their height and set in inter; "script", letters the kit's width tables lack
     * (Chinese, say), sized by their height.
     */
    typeface: "kit" | "unlike" | "script";
    maxWords: number;
    upper: boolean;
    /** The letters' colour; null where none could be read (Task 9c: never white by default). */
    ink: string | null;
    /** The colour that sets the word being said apart. */
    highlight: string | null;
    /** How: its letters coloured, or a box behind it. */
    said: "letters" | "box" | null;
    /** A flat box behind the whole line. */
    backing: boolean;
    /** A dark edge on the letters. */
    edge: boolean;
    /** How many caption pages were seen. */
    pages: number;
  };
  /** `stays`: on to the reference's end (Task 9c: a hook label held for the whole video); `ink`, its letters' colour. */
  title: null | { y: number; size: number; fromMs: number; toMs: number; stays: boolean; backing: boolean; edge: boolean; ink: string | null; text: string };
  /** Other text on screen, a few words each. */
  other: string[];
}

/** The stage the reference is read onto: a box's shares are of a 9:16 picture, its pixels the kit's stage's. */
const STAGE = { w: 1080, h: 1920 } as const;

/**
 * The numbers of the rules above. The brief's starting values, tuned on the six ground-truth films and the made-up cases of
 * `__tests__/text.test.ts` where said; see the report of part 3, Task 9b, for each film's numbers.
 */
export const TEXT_RULES = {
  /**
   * A line the reader scores under this is not read. The worker keeps lines from 0.5 (`MIN_SCORE`); on the six films its lines
   * under 0.7 were a shadow under a caption read as digits (0.57) and a laptop's screen (0.58), and its real lines, pieces of a
   * row cut at a coloured word among them, scored 0.73 and up: 0.65 lies between (review, Minor 2: 0.7 sat 0.03 under the
   * real lines, and a stylised real caption may score lower).
   */
  minScore: 0.65,
  /**
   * Two readings of held text are the same with at most one edit (a letter added, dropped or changed) in this many letters of
   * the longer, at the same place (Task 9c, review Minor 6: one misread letter broke a held run).
   */
  lettersAnEdit: 5,
  /** A row of the caption band is a caption's only when its height is within this share of the band's median row (Task 9c). */
  bandHeight: 0.35,
  /**
   * A held text on from the start that stays past `titleGoneBy` is a title that stays (Task 9c) when its rows are at least
   * `height` of the picture's and its middle within `across` of it; else other text (a handle, a watermark).
   */
  stays: { height: 0.02, across: [0.25, 0.75] },
  /** One row: pieces sharing at least this much of the shorter one's height, no further apart across than this many row heights. */
  sameRow: { overlap: 0.5, gap: 1 },
  /** A row joins the page above when it is no further below it than this share of a row's height (rule 1). */
  pageGap: 0.6,
  bin: 0.05,
  leastPages: 3,
  samePlace: 0.03,
  heldMs: 1500,
  titleByMs: 750,
  titleGoneBy: 0.6,
  otherLetters: 40,
  fontLetters: 4,
  fontRows: 5,
  /**
   * How much wider the reader's box is than the letters in it, where too few rows are seen to fit the padding (a title, or
   * captions of fewer than `fontRows` rows): the reader's box over the kit's own row width, median per film 1.02 to 1.04 on
   * the six films' caption rows (the report of part 3, Task 9b).
   */
  boxOverLetters: 1.03,
  /** The width fit's padding is held to this, in stage pixels (Task 9c, review Minor 3): the reader's own is 8 to 31. */
  pad: { least: 0, most: 40 },
  /**
   * A row's box height over the type size: 1.144, 1.116, 1.203, 1.165, 1.169, 1.167 on the six kit films (median row height
   * over the size made), median 1.166 (Task 9c). Sizes letters the width tables cannot.
   */
  heightOverSize: 1.17,
  /**
   * The same for a row whose cased letters are all capitals (fix round 1 of 9c): capitals have no descenders. Measured on the
   * kit's own captions in capitals (plain look, over the owner's take, drawn by the kit's renderer and read by the deployed
   * stage): 25 rows, the three fonts at 56, 72 and 96 px, 0.81 to 1.02, median 0.875 (inter 0.882, montserrat 0.875, tiktok
   * 0.875). Rows of the same draw in mixed case read 0.86 to 1.30 (0.9 without a descender, 1.15 to 1.30 with one).
   */
  heightOverSizeUpper: 0.88,
  /**
   * The letters are unlike the kit's when the best font's fit leaves more than `left` of the mean row width, or its size is
   * more than `apart` (the brief's 30 %) from the height's (Task 9c). Measured with the band as it now keeps rows: the six kit
   * films leave 0.012 to 0.024 (their sizes 0.1 to 5 % from the height's); Task 11's references 0.018 (ref 4), 0.028 (2), 0.056
   * (3, TikTok's own sans: a kit font), 0.063 (5, a condensed serif, its width size 82 against 117 by height: 29.98 % apart, a
   * hair under `apart`) and 0.097 (1, a geometric sans the kit lacks). 0.06 lies between 3 and 5: a thin margin, measured on one
   * reference each side.
   */
  unlike: { left: 0.06, apart: 0.3 },
  /** A colour within `near` of a ring colour holding at least `share` of the ring is the background. */
  background: { near: 48, share: 0.15 },
  /** Letters are light (luma at least this, 0-255) or strong (HSV saturation and value at least these). */
  light: 170,
  strong: { sat: 0.45, value: 0.5 },
  /** An accent: at least `far` from the ink, at least `share` of the ink's share, over at most `span` of the row; a box at `box` and up. */
  accent: { far: 80, share: 0.15, span: 0.7, box: 0.45 },
  /**
   * A said word's box is a colour meant to be seen (fix round 2 of 9c): saturation (HSV) at least `sat`, or luma at least
   * `luma`. A dark, dull block behind one word is the scene: on Task 11's reference 2 (second run) a dark top under white words
   * (#1e1d23, saturation 0.17, luma 30) was read as the said word's box.
   */
  saidBox: { sat: 0.35, luma: 170 },
  /**
   * On a light box or wall (fix round 2 of 9c): a colour at least `luma` lighter than it, at `share` or more of a piece, is the
   * letters' (the dark is their edge); with none, the darkest colour at `share` or more is the ink. Measured on the 234
   * light-ring lines of Task 11's second run and films 1 and 3 re-analysed: white letters 7.3 to 75 lighter than the ring
   * (7.3 to 16.7 over reference 4's pale sweater), at shares 0.18 to 0.69; dark letters on labels and pale surfaces have
   * nothing more than 2.6 lighter (the title labels 2.2 and 1.8), their letters at 0.10 to 0.21 (one line of interface text at
   * 0.07) and the edge's blends (#d9d9d9 and the like) at 0.03 to 0.07. 5 lies between, with room on both sides.
   */
  onLight: { luma: 5, share: 0.08 },
  /** The highlight when at least this share of the pages has an accent. */
  highlightPages: 0.3,
  /** A backing when at least `rows` of the rows have a flat ring: its largest colour at least `flat` of it. */
  backing: { rows: 0.6, flat: 0.8 },
  /**
   * A thick dark edge on the letters (the kit's outline, 0.1 of the size): the median, over the rows whose ring is less than
   * `ringDark` dark, of the box's dark colours (luma under `luma`) over its light ones (luma over `light`), at least `ratio`.
   * Every row counts when every ring is dark. A bold title's thin edge (0.05) and shadow are no edge. Measured on the titles'
   * rows of light ring: film 1's bold 0.39, 0.45, 0.56 and 0.82 (median 0.51), film 4's outline 0.62 to 1.52 (median 0.65),
   * so 0.58 between them. The brief's "a dark colour of 0.08 on most rows" read film 1's bold title as edged: its rows over
   * the speaker's dark hair hold 0.28 to 0.53 dark, its rows over the wall 0.12 to 0.19.
   */
  edge: { luma: 60, light: 200, ringDark: 0.5, ratio: 0.58 },
  /** Inks or accents within this of each other are one colour, counted together. */
  sameColour: 48,
  /**
   * Near black, "the same flat colour" round the words and beyond them is stricter (fix round 1 of 9c): `same` when both
   * rings' luma are under `luma`. Measured on Task 11's saved frames, both rings of a flat scene: a dark curtain (luma 16 to 17)
   * 4 to 7 apart, dark screens (28 to 41) 3 to 18; skin, a desk and white pages 2 to 26 (so 48 stays there). A near-black box
   * over a dark scene is 38 (#0a0a0a on #202020) to 40 (the kit's pill, #151311, on #2c2a28) apart.
   */
  dark: { luma: 64, same: 24 },
  /** White: every channel at least this (0-255). */
  white: 0xe0,
  /** White is the ink when it is among the letter colours of at least this share of the caption rows (`inkOf`). */
  whiteInk: 1 / 3,
} as const;

/** The room between two words of a caption row, in its type size (`src/edit/film/layout.ts`, `setPage`'s gap). */
const CAPTION_GAP_EM = 0.34;
/** The font a title is set in: the first cut's (`agent/first-cut.ts`, `TITLE.font`), as the ground truth's titles were made. */
const TITLE_FONT: Font = "tiktok";
/** A title's weights (`src/edit/film/layout.ts`, `titleBox`): a label's 700, the others' 800. */
const TITLE_WEIGHT = { label: 700, other: 800 } as const;

/* ── rows and pages ───────────────────────────────────────────────────────────────────────────── */

interface Row {
  /** Pixels of the stage. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  text: string;
  pieces: TextLine[];
}
interface Page {
  ms: number;
  rows: Row[];
  /** The block's middle, as a share of the stage's height. */
  y: number;
  text: string;
  key: string;
}

const heightOf = (row: { top: number; bottom: number }): number => row.bottom - row.top;

/** The lines of one moment as rows: pieces of one row joined, left to right (rule 1). */
function rowsOf(lines: readonly TextLine[]): Row[] {
  const pieces = lines
    .map((line) => ({ left: line.box.x * STAGE.w, top: line.box.y * STAGE.h, right: (line.box.x + line.box.w) * STAGE.w, bottom: (line.box.y + line.box.h) * STAGE.h, text: line.text, pieces: [line] }))
    .sort((a, b) => a.left - b.left);
  const rows: Row[] = [];
  for (const piece of pieces) {
    const row = rows.find((each) => {
      const shared = Math.min(each.bottom, piece.bottom) - Math.max(each.top, piece.top);
      const gap = piece.left - each.right;
      return shared >= TEXT_RULES.sameRow.overlap * Math.min(heightOf(each), heightOf(piece)) && gap <= TEXT_RULES.sameRow.gap * Math.max(heightOf(each), heightOf(piece));
    });
    if (row) Object.assign(row, { top: Math.min(row.top, piece.top), bottom: Math.max(row.bottom, piece.bottom), right: Math.max(row.right, piece.right), text: `${row.text} ${piece.text}`, pieces: [...row.pieces, ...piece.pieces] });
    else rows.push({ ...piece });
  }
  return rows.sort((a, b) => a.top - b.top);
}

/**
 * The pages of one moment: rows stacked together (rule 1). A row that is held (`held`) and one that is not are never one page:
 * on film 3 the captions sat just under the title's last row, and stacked with it they made the title change at every moment.
 */
function pagesOf(ms: number, rows: readonly Row[], held: (row: Row) => boolean): Page[] {
  const blocks: Row[][] = [];
  for (const row of rows) {
    const block = blocks.find((each) => {
      const above = each.at(-1)!;
      const across = Math.min(above.right, row.right) > Math.max(above.left, row.left);
      return across && held(above) === held(row) && row.top - above.bottom <= TEXT_RULES.pageGap * (heightOf(above) + heightOf(row)) / 2;
    });
    if (block) block.push(row);
    else blocks.push([row]);
  }
  return blocks.map((stacked) => {
    const text = stacked.map((row) => row.text).join(" ");
    return { ms, rows: stacked, y: (stacked[0]!.top + stacked.at(-1)!.bottom) / 2 / STAGE.h, text, key: keyOf(text) };
  });
}

/** The rows of every moment that are held: the same letters at the same place at consecutive moments spanning `heldMs` (rule 3). */
function heldRows(moments: readonly { ms: number; rows: Row[] }[]): Set<Row> {
  const runs: { rows: Row[]; ms: number[]; last: number }[] = [];
  moments.forEach(({ ms, rows }, i) => {
    for (const row of rows) {
      const key = keyOf(row.text);
      const run = runs.find((each) => each.last === i - 1 && sameText(keyOf(each.rows.at(-1)!.text), key) && Math.abs(middleOf(each.rows.at(-1)!) - middleOf(row)) <= TEXT_RULES.samePlace + 1e-9);
      if (run) [run.rows, run.ms, run.last] = [[...run.rows, row], [...run.ms, ms], i];
      else runs.push({ rows: [row], ms: [ms], last: i });
    }
  });
  return new Set(runs.filter((run) => run.ms.at(-1)! - run.ms[0]! >= TEXT_RULES.heldMs).flatMap((run) => run.rows));
}
const middleOf = (row: Row): number => (row.top + row.bottom) / 2 / STAGE.h;

/** The letters and digits of a text, case folded: what two readings of one text share. */
const keyOf = (text: string): string => (text.match(/[\p{L}\p{N}]/gu) ?? []).join("").toLowerCase();

/** Two keys of one held text: at most one edit in `lettersAnEdit` letters of the longer apart (Task 9c). */
function sameText(a: string, b: string): boolean {
  if (a === b) return true;
  const most = Math.floor(Math.max(a.length, b.length) / TEXT_RULES.lettersAnEdit);
  return most > 0 && Math.abs(a.length - b.length) <= most && editsBetween(a, b) <= most;
}

/** The fewest letters added, dropped or changed to make `a` into `b` (Levenshtein's distance). */
function editsBetween(a: string, b: string): number {
  const [x, y] = [[...a], [...b]];
  let before = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row.push(Math.min(before[j]! + 1, row[j - 1]! + 1, before[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1)));
    before = row;
  }
  return before[y.length]!;
}
const binOf = (y: number): number => Math.floor(y / TEXT_RULES.bin);

/* ── textOf ───────────────────────────────────────────────────────────────────────────────────── */

/** What the measured text of a reference `ms` long says of its captions, its title and the rest. Pure. */
export function textOf(analysis: TakeAnalysis, ms: number): TextRead {
  const { samples, pages, title, held } = partsOf(analysis, ms);
  const other = held
    .filter((run) => run !== title?.run)
    .sort((a, b) => a.first - b.first || a.pages[0]!.y - b.pages[0]!.y)
    .map((run) => run.pages[0]!.text.slice(0, TEXT_RULES.otherLetters));
  return {
    captions: pages === null ? null : captionsOf(pages),
    title: title && titleOf(title.run, samples, ms, title.stays),
    other: [...new Set(other)],
  };
}

/**
 * What Qwen is told was read already (`judgeSheet`), so it does not list it: the caption pages' words, each once, in the order
 * they were seen, and the title's; none of either when none was read.
 */
export function seenOf(analysis: TakeAnalysis, ms: number): { captions: string[]; title: string | null } {
  const { pages, title } = partsOf(analysis, ms);
  return { captions: [...new Set((pages ?? []).map((page) => page.text))], title: title?.run.pages[0]!.text ?? null };
}

/**
 * The caption pages (rule 2; null for no captions), each holding only the band's rows of about its median height (Task 9c);
 * the held text outside their band and the title among it (rule 3), and whether it stays. Throws for a reference analysed
 * before its text was measured (part 3, Task 9b), as `measuresOf` does for one analysed before part 3.
 */
function partsOf(analysis: TakeAnalysis, ms: number): { samples: readonly { ms: number }[]; pages: Page[] | null; title: { run: Run; stays: boolean } | null; held: Run[] } {
  if (!analysis.text) throw new Error("the reference was analysed before its text was measured: analyse it again");
  const samples = analysis.text;
  const rows = samples.map((sample) => ({ ms: sample.ms, rows: rowsOf(sample.lines.filter((line) => line.score >= TEXT_RULES.minScore)) }));
  const heldAlone = heldRows(rows);
  const moments = rows.map((each) => pagesOf(each.ms, each.rows, (row) => heldAlone.has(row)));
  const band = captionBand(moments);
  const inBand = (page: Page) => band !== null && Math.abs(binOf(page.y) - band) <= 1;
  const held = heldText(moments.map((each) => each.filter((page) => !inBand(page))));
  const onFirst = held.filter((run) => run.pages[0]!.ms <= TEXT_RULES.titleByMs);
  const gone = onFirst.filter((run) => toMsOf(run, samples) < TEXT_RULES.titleGoneBy * ms);
  const staying = onFirst.filter((run) => !gone.includes(run) && looksLikeATitle(run));
  const title = [...gone, ...staying].sort((a, b) => tallness(b) - tallness(a))[0] ?? null;
  return { samples, pages: band === null ? null : captionPages(moments.flat().filter(inBand), band), title: title && { run: title, stays: staying.includes(title) }, held };
}

/**
 * The band's pages, each with only its pieces of about the band's median height (within `bandHeight`, Task 9c) and its rows
 * whose own middle is in the band: B-roll's own text (a screenshot's lines beside a caption, or stacked above it) is not a
 * caption's, though the reader puts it on the caption's row or page. A page with none left is left out; when no page keeps
 * any, the pages as they were.
 */
function captionPages(pages: readonly Page[], band: number): Page[] {
  const median = medianOf(pages.flatMap((page) => page.rows.flatMap((row) => row.pieces.map((piece) => piece.box.h * STAGE.h))));
  if (median === null) return [];
  const kept = pages.flatMap((page) => {
    const pieces = page.rows.flatMap((row) => row.pieces).filter((piece) => Math.abs(piece.box.h * STAGE.h - median) <= TEXT_RULES.bandHeight * median);
    const rows = rowsOf(pieces).filter((row) => Math.abs(binOf(middleOf(row)) - band) <= 1);
    if (rows.length === 0) return [];
    const text = rows.map((row) => row.text).join(" ");
    return [{ ...page, rows, y: (rows[0]!.top + rows.at(-1)!.bottom) / 2 / STAGE.h, text, key: keyOf(text) }];
  });
  return kept.length > 0 ? kept : [...pages];
}

/** Held text large enough and in the middle across to be a title that stays (Task 9c), not a handle or a watermark. */
function looksLikeATitle(run: Run): boolean {
  const rows = run.pages.flatMap((page) => page.rows);
  const middle = medianOf(rows.map((row) => (row.left + row.right) / 2 / STAGE.w))!;
  const [from, to] = TEXT_RULES.stays.across;
  return tallness(run) / STAGE.h >= TEXT_RULES.stays.height && middle >= from! && middle <= to!;
}

/** The band's middle bin (rule 2), or null when no band holds `leastPages` pages that change. */
function captionBand(moments: readonly Page[][]): number | null {
  let [best, most] = [null as number | null, 0];
  const bins = [...new Set(moments.flat().map((page) => binOf(page.y)))].sort((a, b) => a - b);
  for (const middle of bins) {
    let [changes, before] = [0, new Set<string>()];
    for (const pages of moments) {
      const here = pages.filter((page) => Math.abs(binOf(page.y) - middle) <= 1);
      changes += here.filter((page) => !before.has(page.key)).length;
      before = new Set(here.map((page) => page.key));
    }
    if (changes > most) [best, most] = [middle, changes];
  }
  return most >= TEXT_RULES.leastPages ? best : null;
}

interface Run {
  pages: Page[];
  /** The index of its first moment and of its last. */
  first: number;
  last: number;
}

/** Text held at one place over consecutive moments for at least `heldMs` (rule 3), in the order found. */
function heldText(moments: readonly Page[][]): Run[] {
  const runs: Run[] = [];
  moments.forEach((pages, i) => {
    for (const page of pages) {
      const run = runs.find((each) => each.last === i - 1 && sameText(each.pages.at(-1)!.key, page.key) && Math.abs(each.pages.at(-1)!.y - page.y) <= TEXT_RULES.samePlace + 1e-9);
      if (run) [run.pages, run.last] = [[...run.pages, page], i];
      else runs.push({ pages: [page], first: i, last: i });
    }
  });
  return runs.filter((run) => run.pages.at(-1)!.ms - run.pages[0]!.ms >= TEXT_RULES.heldMs && run.pages[0]!.key !== "");
}

const tallness = (run: Run): number => medianOf(run.pages.map((page) => Math.max(...page.rows.map(heightOf))))!;
/** Halfway between a run's last moment and the next; the reference's end (never "gone") when it is on at the last. */
const toMsOf = (run: Run, samples: readonly { ms: number }[]): number => {
  const next = samples[run.last + 1];
  return next ? Math.round((run.pages.at(-1)!.ms + next.ms) / 2) : Number.POSITIVE_INFINITY;
};

/* ── measured ─────────────────────────────────────────────────────────────────────────────────── */

function captionsOf(pages: readonly Page[]): NonNullable<TextRead["captions"]> {
  const rows = pages.flatMap((page) => page.rows);
  const { font, size, typeface } = captionFontAndSize(rows);
  const colours = rows.map(lettersIn);
  const ink = inkOf(colours);
  const accents = new Map(rows.map((row, i) => [row, accentOf(colours[i]!, ink)]));
  const withAccent = pages.filter((page) => page.rows.some((row) => accents.get(row)));
  const found = [...accents.values()].flatMap((accent) => (accent ? [accent] : []));
  const highlight = withAccent.length >= TEXT_RULES.highlightPages * pages.length ? commonest(found.map((accent) => accent.hex)) : null;
  const said = highlight === null ? null : commonestOf(found.filter((accent) => distance(accent.hex, highlight) <= TEXT_RULES.sameColour).map((accent) => accent.said));
  const { backing, edge } = backingAndEdge(rows);
  return {
    y: round3(medianOf(pages.map((page) => page.y))!),
    size: Math.round(size),
    font,
    typeface,
    maxWords: mostWords(pages),
    upper: upperIn(pages.map((page) => page.text)),
    ink,
    highlight,
    said,
    backing,
    edge,
    pages: pages.length,
  };
}

function titleOf(run: Run, samples: readonly { ms: number }[], ms: number, stays: boolean): NonNullable<TextRead["title"]> {
  const rows = run.pages.flatMap((page) => page.rows);
  const { backing, edge } = backingAndEdge(rows);
  const weight = backing ? TITLE_WEIGHT.label : TITLE_WEIGHT.other;
  const sizes = rows.flatMap((row) => {
    const wide = measure(row.text, TITLE_FONT, weight, 1, TITLE_TRACKING_EM);
    return wide ? [sizeOf(row, wide)] : [];
  });
  const before = samples[run.first - 1];
  const toMs = toMsOf(run, samples);
  return {
    y: round3(medianOf(run.pages.map((page) => page.y))!),
    // Letters the tables lack: the rows' height says the size (Task 9c), never 0.
    size: Math.round(medianOf(sizes) ?? medianOf(rows.map(sizeByHeight))!),
    fromMs: before ? Math.round((before.ms + run.pages[0]!.ms) / 2) : 0,
    toMs: Number.isFinite(toMs) ? toMs : ms,
    stays,
    backing,
    edge,
    ink: inkOf(rows.map(lettersIn)),
    text: run.pages[0]!.text,
  };
}

/** A row's type size as its height says (`heightOverSize`, or `heightOverSizeUpper` for a row in capitals). */
function sizeByHeight(row: Row): number {
  const upper = /\p{Lu}/u.test(row.text) && !/\p{Ll}/u.test(row.text);
  return heightOf(row) / (upper ? TEXT_RULES.heightOverSizeUpper : TEXT_RULES.heightOverSize);
}

/** A row's type size in a font whose width at size 1 is `wide`: its letters' width in stage pixels (`boxOverLetters`) over it. */
const sizeOf = (row: Row, wide: number): number => (row.right - row.left) / TEXT_RULES.boxOverLetters / wide;

/** A caption row's width at size 1 in `font`, as the kit sets one: each word measured, `CAPTION_GAP_EM` between two (`layout.ts`). */
function captionWidthAt1(text: string, font: Font): number | null {
  const words = text.split(/\s+/).filter(Boolean);
  let sum = 0;
  for (const word of words) {
    const wide = measure(word, font, CAPTION_WEIGHTS.plain, 1);
    if (wide === null) return null;
    sum += wide;
  }
  return sum + CAPTION_GAP_EM * Math.max(0, words.length - 1);
}

/**
 * The captions' font and size (rule 4, as measured on the six films): for each kit font, the rows of `fontLetters` letters or
 * more are fitted by least squares as `box width = size × width at size 1 + padding`, the padding being the reader's (its
 * box is wider than the letters by about the same pixels whatever their width) held to `pad`; the font is the one whose fit
 * leaves the least, and the size its fit's. With fewer than `fontRows` rows, inter, sized by `boxOverLetters`.
 *
 * Why not the brief's spread of sizes, each row's width over `boxOverLetters` over its text's width: a padding that does not
 * grow with the row makes the short rows' sizes spread most in the narrowest font, so the widest won. On the six films it chose
 * montserrat for three of the four that were not (3 of 6 right); fitted with the padding it is 5 of 6 (the report of Task 9b).
 *
 * Letters unlike the kit's (Task 9c): when the best fit leaves more than `unlike.left` of the mean width, or its size is more
 * than `unlike.apart` from the height's (the rows' sizes by their height, `sizeByHeight`), the size is the height's and the font
 * inter ("unlike"). Rows the width tables cannot measure (a script they lack) are sized by their height too ("script").
 */
function captionFontAndSize(rows: readonly Row[]): { font: Font; size: number; typeface: "kit" | "unlike" | "script" } {
  const byHeight = medianOf(rows.map(sizeByHeight))!;
  const counted = rows.filter((row) => keyOf(row.text).length >= TEXT_RULES.fontLetters);
  const measured = counted.filter((row) => captionWidthAt1(row.text, "inter") !== null);
  if (measured.length < TEXT_RULES.fontRows) {
    const sizes = rows.flatMap((row) => {
      const wide = captionWidthAt1(row.text, "inter");
      return wide ? [sizeOf(row, wide)] : [];
    });
    const script = counted.length - measured.length > measured.length || sizes.length === 0;
    return script ? { font: "inter", size: byHeight, typeface: "script" } : { font: "inter", size: medianOf(sizes)!, typeface: "kit" };
  }
  const fits = FONTS.flatMap((font) => {
    const points = counted.flatMap((row) => {
      const wide = captionWidthAt1(row.text, font);
      return wide ? [{ x: wide, y: row.right - row.left }] : [];
    });
    const fit = points.length >= TEXT_RULES.fontRows ? lineThrough(points) : null;
    return fit && fit.slope > 0 ? [{ font, size: fit.slope, left: fit.left / (points.reduce((sum, point) => sum + point.y, 0) / points.length) }] : [];
  });
  const best = fits.reduce<(typeof fits)[number] | null>((a, b) => (a === null || b.left < a.left ? b : a), null);
  if (best === null || best.left > TEXT_RULES.unlike.left || Math.abs(best.size - byHeight) > TEXT_RULES.unlike.apart * byHeight) {
    return { font: "inter", size: byHeight, typeface: "unlike" };
  }
  return { font: best.font, size: best.size, typeface: "kit" };
}

/**
 * The least-squares line through `points` whose height at 0 (the padding) is held to `pad`, and the spread of what it leaves
 * (the residuals' standard deviation). Null for fewer than three points or all at one x.
 */
function lineThrough(points: readonly { x: number; y: number }[]): { slope: number; left: number } | null {
  const n = points.length;
  const [mx, my] = [points.reduce((sum, p) => sum + p.x, 0) / n, points.reduce((sum, p) => sum + p.y, 0) / n];
  const sxx = points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0);
  if (n < 3 || sxx === 0) return null;
  let slope = points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / sxx;
  let pad = my - slope * mx;
  if (pad < TEXT_RULES.pad.least || pad > TEXT_RULES.pad.most) {
    pad = clamp(pad, TEXT_RULES.pad.least, TEXT_RULES.pad.most);
    slope = points.reduce((sum, p) => sum + p.x * (p.y - pad), 0) / points.reduce((sum, p) => sum + p.x * p.x, 0);
  }
  const left = Math.sqrt(points.reduce((sum, p) => sum + (p.y - (slope * p.x + pad)) ** 2, 0) / (n - 2));
  return { slope, left };
}

/**
 * The most words on a page, among the counts seen on at least two pages (or the most there is, when no count is seen twice): a
 * single misread page does not add a word. On film 2 a word's box, its left edge read as an "I", gave one page of three words
 * where every other had at most two.
 */
function mostWords(pages: readonly Page[]): number {
  const counts = pages.map((page) => wordsIn(page.text));
  const twice = counts.filter((count, i) => counts.indexOf(count) !== i);
  return Math.max(...(twice.length > 0 ? twice : counts));
}

/* ── colours ──────────────────────────────────────────────────────────────────────────────────── */

type Colour = TextLine["colours"][number];
type Accent = Colour & { said: "letters" | "box" };

/**
 * A row's letter colours (rule 4): its pieces' colours that are not its background and are light or strong, each re-measured
 * across the whole row. The background is a ring colour holding `background.share` of the ring of every piece of the row: on
 * film 2 the reader boxed the said word alone, inside its yellow box, so that piece's ring was yellow, and the yellow was taken
 * for the background, though the row's other piece was ringed by the picture.
 */
function lettersIn(row: Row): Colour[] {
  const wide = row.right - row.left;
  const rings = row.pieces.map((piece) => piece.around.filter((ring) => ring.share >= TEXT_RULES.background.share));
  const background = rings[0]!.filter((ring) => rings.every((each) => each.some((other) => distance(other.hex, ring.hex) <= TEXT_RULES.background.near)));
  const across = (piece: TextLine, colour: Colour): Colour => {
    const share = (piece.box.w * STAGE.w) / wide;
    const start = (piece.box.x * STAGE.w - row.left) / wide;
    return { hex: colour.hex, share: colour.share * share, from: start + colour.from * share, to: start + colour.to * share };
  };
  const unseen = (colour: Colour) => !background.some((ring) => distance(colour.hex, ring.hex) <= TEXT_RULES.background.near);
  const lightBox = (piece: TextLine) => boxed(piece) && lumaOf(piece.around[0]!.hex) >= TEXT_RULES.light;
  if (row.pieces.every(lightBox)) {
    // On a real light box or a light wall that reads as one (fix rounds 1 and 2 of 9c): what is lighter than it, at a real
    // share, is the letters, and the dark their edge; with nothing lighter, the letters are the darkest colour at a real share
    // (review Important 1 of 9b: dark letters read as white by default before), and the box's blended edge (#d9d9d9 between
    // white and black on Task 11's references 3 and 4) is neither. A strong colour is a said word's either way.
    const { luma, share } = TEXT_RULES.onLight;
    const real = (colour: Colour) => colour.share >= share && !isStrong(colour.hex);
    const lighter = row.pieces.flatMap((piece) => piece.colours.filter((colour) => real(colour) && lumaOf(colour.hex) >= lumaOf(piece.around[0]!.hex) + luma).map((colour) => across(piece, colour)));
    const strong = row.pieces.flatMap((piece) => piece.colours.filter((colour) => unseen(colour) && isStrong(colour.hex)).map((colour) => across(piece, colour)));
    if (lighter.length > 0) return [...lighter, ...strong];
    return [
      ...row.pieces.flatMap((piece) => {
        const darkest = piece.colours.filter((colour) => unseen(colour) && real(colour)).sort((a, b) => lumaOf(a.hex) - lumaOf(b.hex))[0];
        return darkest && lumaOf(darkest.hex) < TEXT_RULES.light ? [across(piece, darkest)] : [];
      }),
      ...strong,
    ];
  }
  return row.pieces.flatMap((piece) => piece.colours.filter((colour) => unseen(colour) && (lumaOf(colour.hex) >= TEXT_RULES.light || isStrong(colour.hex))).map((colour) => across(piece, colour)));
}

/**
 * The captions' ink: white when a white colour (every channel `white` or more) is among the letter colours of at least
 * `whiteInk` of the rows; else the commonest of each row's largest letter colour. Counting alone is not enough: on pages of
 * two words the said word's colour holds half the letters, and with pages of one word more (film 6 read its yellow as the ink).
 * White is the kit's only ink, and most captions'.
 */
function inkOf(rows: readonly Colour[][]): string | null {
  const white = rows.filter((colours) => colours.some((colour) => isWhite(colour.hex))).length;
  if (rows.length > 0 && white >= TEXT_RULES.whiteInk * rows.length) return commonest(rows.flatMap((colours) => colours.filter((colour) => isWhite(colour.hex)).map((colour) => colour.hex)));
  return commonest(rows.flatMap((colours) => ([...colours].sort((a, b) => b.share - a.share)[0] ? [[...colours].sort((a, b) => b.share - a.share)[0]!.hex] : [])));
}

/**
 * A row's accent against the captions' ink: another letter colour at least `far` from it, holding at least `share` of the
 * ink's share in the row (any, in a row with no ink), over at most `span` of the row; said by a `box` when it fills at least
 * `box` of its stretch, else by its `letters` (on the six films: a word's box 0.39 to 0.77, median 0.6; letters 0.17 to 0.48).
 */
function accentOf(colours: readonly Colour[], ink: string | null): Accent | null {
  if (ink === null) return null;
  const inked = colours.filter((colour) => distance(colour.hex, ink) <= TEXT_RULES.sameColour).reduce((sum, colour) => sum + colour.share, 0);
  const fills = (colour: Colour) => colour.share / Math.max(colour.to - colour.from, 1e-6);
  const seen = (colour: Colour) => fills(colour) < TEXT_RULES.accent.box || saturationOf(colour.hex) >= TEXT_RULES.saidBox.sat || lumaOf(colour.hex) >= TEXT_RULES.saidBox.luma;
  const accent = colours
    .filter((colour) => distance(colour.hex, ink) >= TEXT_RULES.accent.far && colour.share >= TEXT_RULES.accent.share * inked && colour.to - colour.from <= TEXT_RULES.accent.span && seen(colour))
    .sort((a, b) => b.share - a.share)[0];
  return accent ? { ...accent, said: fills(accent) >= TEXT_RULES.accent.box ? "box" : "letters" } : null;
}

/**
 * A backing when most rows have a box behind them; an edge as `TEXT_RULES.edge` says, over the rows with no box. A row has a box
 * behind it when every piece's ring is one flat colour and its ring beyond (Task 9c) is not that same flat colour: a flat
 * scene (a curtain, skin, a desk) has the same colour beyond, where a box ends. A piece with no ring beyond (an analysis from
 * before Task 9c) keeps the rule of the ring alone.
 */
function backingAndEdge(rows: readonly Row[]): { backing: boolean; edge: boolean } {
  const withBox = rows.filter((row) => row.pieces.every(boxed));
  const backing = rows.length > 0 && withBox.length >= TEXT_RULES.backing.rows * rows.length;
  const { luma, light, ringDark, ratio } = TEXT_RULES.edge;
  const share = (colours: readonly { hex: string; share: number }[], keep: (luma: number) => boolean) => colours.filter((colour) => keep(lumaOf(colour.hex))).reduce((sum, colour) => sum + colour.share, 0);
  const pieces = rows.filter((row) => !withBox.includes(row)).flatMap((row) => row.pieces);
  const lightRing = pieces.filter((piece) => share(piece.around, (each) => each < luma) < ringDark);
  const ratios = (lightRing.length > 0 ? lightRing : pieces).map((piece) => share(piece.colours, (each) => each < luma) / Math.max(share(piece.colours, (each) => each > light), 1e-6));
  return { backing, edge: !backing && ratios.length > 0 && medianOf(ratios)! >= ratio };
}

/**
 * Whether a piece has a box behind it (B.1): its ring one flat colour, and its ring beyond not that same flat colour; with no
 * ring beyond (an analysis from before Task 9c), the ring alone.
 */
function boxed(piece: TextLine): boolean {
  const ring = piece.around[0];
  if (!ring || ring.share < TEXT_RULES.backing.flat) return false;
  if (piece.beyond === undefined) return true;
  const beyond = piece.beyond[0];
  return !(beyond && beyond.share >= TEXT_RULES.backing.flat && sameFlat(beyond.hex, ring.hex));
}

/** Two rings' colours are one flat colour: within `sameColour`, or `dark.same` near black. */
function sameFlat(a: string, b: string): boolean {
  const near = Math.max(lumaOf(a), lumaOf(b)) < TEXT_RULES.dark.luma ? TEXT_RULES.dark.same : TEXT_RULES.sameColour;
  return distance(a, b) <= near;
}

/** A colour each of whose channels is at least `TEXT_RULES.white`: the kit's white, as the reader's colours give it. */
export const isWhite = (hex: string): boolean => rgbOf(hex).every((channel) => channel >= TEXT_RULES.white);

const rgbOf = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 0xff, value & 0xff];
};
const hexOf = ([r, g, b]: readonly number[]): string => `#${[r, g, b].map((channel) => Math.round(channel!).toString(16).padStart(2, "0")).join("")}`;
export const distance = (a: string, b: string): number => Math.hypot(...rgbOf(a).map((channel, i) => channel - rgbOf(b)[i]!));
/** Rec. 709 luma, 0 to 255. */
const lumaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function isStrong(hex: string): boolean {
  const most = Math.max(...rgbOf(hex));
  return saturationOf(hex) >= TEXT_RULES.strong.sat && most / 255 >= TEXT_RULES.strong.value;
}

/** A colour's saturation, as HSV has it: 0 for a grey, 1 for a pure hue. */
function saturationOf(hex: string): number {
  const [most, least] = [Math.max(...rgbOf(hex)), Math.min(...rgbOf(hex))];
  return most > 0 ? (most - least) / most : 0;
}

/** The commonest colour of `hexes`, colours within `sameColour` of each other counted as one; their mean. Null for none. */
function commonest(hexes: readonly string[]): string | null {
  const groups: string[][] = [];
  for (const hex of hexes) {
    const group = groups.find((each) => distance(each[0]!, hex) <= TEXT_RULES.sameColour);
    if (group) group.push(hex);
    else groups.push([hex]);
  }
  const most = groups.reduce<string[] | null>((best, group) => (best === null || group.length > best.length ? group : best), null);
  if (!most) return null;
  const rgbs = most.map(rgbOf);
  return hexOf([0, 1, 2].map((i) => rgbs.reduce((sum, rgb) => sum + rgb[i]!, 0) / rgbs.length));
}

function commonestOf<T>(values: readonly T[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/* ── words ────────────────────────────────────────────────────────────────────────────────────── */

/** Words, as a viewer counts them: runs with a letter or a digit. */
export const wordsIn = (text: string): number => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
/** True when the texts have letters with a case and every one is a capital. */
function upperIn(texts: readonly string[]): boolean {
  const cased = texts.join(" ").match(/\p{L}/gu)?.filter((letter) => letter.toLowerCase() !== letter.toUpperCase()) ?? [];
  return cased.length > 0 && cased.every((letter) => letter === letter.toUpperCase());
}
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
