/**
 * title.ts — a title put where review finds no error for it (part 3, Task 10b, A; N8). Pure, and judged by `review` itself,
 * as `placeCaptions` judges the captions (it shares their sizes and their judging: captions.ts).
 *
 * The rule, as built:
 * - A title with no error stays where it is, warnings and all: so a second run returns `[]`.
 * - Otherwise its places are 0.10 to 0.90 of the stage's height every 0.02, and its own, nearest its own first (equally near:
 *   the one nearer the middle of the stage). The first with no error is taken; but a place with no warning either, within
 *   0.12 of its own, is taken over a nearer one with a warning.
 * - When no place is free of errors at its size, the same at 0.85 and then 0.72 of it, never under the part's least (48, its schema's).
 * - When none is free at any of these, nothing changes, and review reports it.
 * The one operation (`item.set` or `mark.set`) sets the title's `y`, and its `size` when it is made smaller.
 */
import type { Analyses } from "../analysis";
import type { Edit, Item, Mark } from "../doc";
import type { Op } from "../ops";
import { PARTS } from "../parts";
import type { Finding } from "../review";
import { judged, sizesFrom } from "./captions";

/** Where a title may be put: 0.10 to 0.90 of the stage's height, every 0.02. */
const TITLE_YS: readonly number[] = Array.from({ length: 41 }, (_, k) => Math.round((0.1 + 0.02 * k) * 100) / 100);
/** How far from its own place a clear place is taken over a nearer one with a warning. */
const NEAR = 0.12;
/** The title's least size: what stays readable on a phone. */
const LEAST = PARTS.title.props.shape.size.minValue ?? 48;
const EPSILON = 1e-9;

type Title = Extract<Item | Mark, { part: "title" }>;

/** `[]`, or the one operation that moves the title `id` (an item or a mark) where review finds no error for it, and last, makes it smaller. */
export function placeTitle(edit: Edit, analyses: Analyses, id: string): Op[] {
  const found = findTitle(edit, id);
  const own = found.title.props;
  const of = (finding: Finding) => finding.where.item === id || finding.where.mark === id;
  if (!judged(edit, analyses, of).error) return [];

  const at = (y: number, size: number): Edit => {
    const props = { ...own, y, size };
    return found.where === "item"
      ? { ...edit, items: edit.items.map((item) => (item.id === id ? ({ ...item, props } as Item) : item)) }
      : { ...edit, shots: edit.shots.map((shot) => ({ ...shot, marks: shot.marks.map((mark) => (mark.id === id ? ({ ...mark, props } as Mark) : mark)) })) };
  };
  const places = [...new Set([...TITLE_YS, own.y])].sort((a, b) => Math.abs(a - own.y) - Math.abs(b - own.y) || Math.abs(a - 0.5) - Math.abs(b - 0.5));
  for (const size of sizesFrom(own.size, LEAST)) {
    const y = placeAt(places, own.y, (place) => judged(at(place, size), analyses, of));
    if (y === null) continue;
    const props = { ...(y !== own.y && { y }), ...(size !== own.size && { size }) };
    return [found.where === "item" ? { op: "item.set", id, props } : { op: "mark.set", id, props }];
  }
  return [];
}

/**
 * The place taken among `places` (nearest the title's own first): the first with no error, unless one with no warning either
 * lies within `NEAR` of its own. Null when every place has an error.
 */
function placeAt(places: readonly number[], own: number, judge: (y: number) => { error: boolean; warn: boolean }): number | null {
  let nearest: number | null = null;
  for (const y of places) {
    const near = Math.abs(y - own) <= NEAR + EPSILON;
    if (!near && nearest !== null) return nearest;
    const { error, warn } = judge(y);
    if (error) continue;
    if (!near || !warn) return y;
    nearest ??= y;
  }
  return nearest;
}

/** The title of that id: an item on the film or a mark on a shot. Throws when the edit has none. */
function findTitle(edit: Edit, id: string): { where: "item" | "mark"; title: Title } {
  const item = edit.items.find((each) => each.id === id);
  if (item?.part === "title") return { where: "item", title: item };
  const mark = edit.shots.flatMap((shot) => shot.marks).find((each) => each.id === id);
  if (mark?.part === "title") return { where: "mark", title: mark };
  throw new Error(`the edit has no title "${id}"`);
}
