/**
 * shape.ts — the apps' own text box: the lines of a label drawn as one shape, each line its own width, the joins rounded
 * (ruled 2026-11-24, S3; the snap at two radii, amended the same day). Pure geometry: the lines' edges in, an SVG path out.
 * Nothing here measures or draws.
 */

/** A line's box across: its left and right edge in px, inside the label's own block. */
export interface LineSpan {
  left: number;
  right: number;
}

/** A number as a path names it: to a hundredth of a pixel. */
const named = (value: number): string => String(Math.round(value * 100) / 100);

/**
 * The lines as they are drawn: where two neighbours' edges on a side are closer than two radii, both take the outer one. So
 * every step left is at least two radii, and both its corners are full arcs: no small notch beside near-equal lines.
 */
export function snapped(lines: readonly LineSpan[], radius: number): LineSpan[] {
  const spans = lines.map((line) => ({ ...line }));
  for (let moved = true; moved; ) {
    moved = false;
    for (let i = 0; i + 1 < spans.length; i++) {
      const [upper, lower] = [spans[i]!, spans[i + 1]!];
      if (upper.left !== lower.left && Math.abs(upper.left - lower.left) < 2 * radius) {
        upper.left = lower.left = Math.min(upper.left, lower.left);
        moved = true;
      }
      if (upper.right !== lower.right && Math.abs(upper.right - lower.right) < 2 * radius) {
        upper.right = lower.right = Math.max(upper.right, lower.right);
        moved = true;
      }
    }
  }
  return spans;
}

/**
 * The outline of a label's lines as one SVG path: line `i` runs from `i × pitch` down to `(i + 1) × pitch`, between its
 * own edges (`snapped`). Every corner is an arc of `radius`, or of half its shorter side where that is less: a line
 * narrower, or a pitch shorter, than two radii. "" for no lines.
 */
export function labelShape(lines: readonly LineSpan[], pitch: number, radius: number): string {
  const spans = snapped(lines, radius);
  if (spans.length === 0) return "";
  const last = spans.length - 1;
  // The outline's corners, clockwise from the first line's top left (y grows downward).
  const corners: [number, number][] = [[spans[0]!.left, 0], [spans[0]!.right, 0]];
  for (let i = 0; i < last; i++) {
    if (spans[i]!.right !== spans[i + 1]!.right) corners.push([spans[i]!.right, (i + 1) * pitch], [spans[i + 1]!.right, (i + 1) * pitch]);
  }
  corners.push([spans[last]!.right, (last + 1) * pitch], [spans[last]!.left, (last + 1) * pitch]);
  for (let i = last; i > 0; i--) {
    if (spans[i]!.left !== spans[i - 1]!.left) corners.push([spans[i]!.left, i * pitch], [spans[i - 1]!.left, i * pitch]);
  }
  const drawn = corners.map(([x, y], at) => {
    const [beforeX, beforeY] = corners[(at + corners.length - 1) % corners.length]!;
    const [afterX, afterY] = corners[(at + 1) % corners.length]!;
    const [into, out] = [Math.hypot(x - beforeX, y - beforeY), Math.hypot(afterX - x, afterY - y)];
    const r = Math.min(radius, into / 2, out / 2);
    const from = [x + ((beforeX - x) / into) * r, y + ((beforeY - y) / into) * r] as const;
    const to = [x + ((afterX - x) / out) * r, y + ((afterY - y) / out) * r] as const;
    const outward = (x - beforeX) * (afterY - y) - (y - beforeY) * (afterX - x) > 0; // a right turn, going clockwise with y downward
    return `${at === 0 ? "M" : "L"}${named(from[0])} ${named(from[1])}A${named(r)} ${named(r)} 0 0 ${outward ? 1 : 0} ${named(to[0])} ${named(to[1])}`;
  });
  return `${drawn.join("")}Z`;
}
