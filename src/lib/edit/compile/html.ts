/**
 * html.ts — writing film.html text, and packing clips onto tracks.
 *
 * Escaping mirrors OpenFilm's own writer (`filmHtml` in its film-doc module): `&` and `"` in a
 * double-quoted attribute; `&` and `'` in the single-quoted `overrides` JSON. Its strict reader
 * reads both back exactly (checked 2026-11-11 with quotes, angle brackets and a line break).
 */

/** The stage, fixed in v1 (spec F5). */
export const W = 1080;
export const H = 1920;

/** Text inside a double-quoted attribute. */
export const attr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** JSON inside a single-quoted attribute (a clip's `overrides`). */
export const jsonAttr = (value: unknown): string => JSON.stringify(value).replace(/&/g, "&amp;").replace(/'/g, "&#39;");

/** A number as CSS writes it: at most four decimals, no trailing zeros. */
export const num = (value: number): string => String(Number(value.toFixed(4)));

/** A clip ready to be written, with the film milliseconds it covers. */
export interface Placed {
  from: number;
  to: number;
  html: string;
}

/** Order by start, then by end: the order `pack` is given for items that have no order of their own. */
export const byStart = (a: Placed, b: Placed): number => a.from - b.from || a.to - b.to;

/**
 * First-fit packing, in the order given: an item goes on the first track where it overlaps
 * nothing. A film's track may not hold overlapping clips, and the same input always gives the
 * same tracks.
 */
export function pack(items: Placed[]): Placed[][] {
  const tracks: Placed[][] = [];
  for (const item of items) {
    const free = tracks.find((track) => track.every((other) => other.to <= item.from || item.to <= other.from));
    if (free) free.push(item);
    else tracks.push([item]);
  }
  for (const track of tracks) track.sort(byStart);
  return tracks;
}

/**
 * Stacking, in the order given, the first on top: an item goes on the track just below the lowest
 * one holding an item it overlaps (a track with no overlap, by construction). So of two items that
 * overlap, the one given first is always on the track nearer the top. Same input, same tracks.
 */
export function stack(items: Placed[]): Placed[][] {
  const tracks: Placed[][] = [];
  for (const item of items) {
    let lowest = -1;
    tracks.forEach((track, i) => {
      if (track.some((other) => other.from < item.to && item.from < other.to)) lowest = i;
    });
    (tracks[lowest + 1] ??= []).push(item);
  }
  for (const track of tracks) track.sort(byStart);
  return tracks;
}

export function section(items: Placed[]): string {
  return `<section>\n${items.map((item) => `  ${item.html}`).join("\n")}\n</section>`;
}

/**
 * The film's head. Identical for every edit except the keyframes block (spec R5): the in-page
 * player applies a changed film in place only when everything else in the head is unchanged.
 */
export function head(keyframes: string[]): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8">',
    `<meta name="viewport" content="width=${W}, height=${H}">`,
    "<style>",
    ...keyframes,
    "</style>",
    "</head>",
  ].join("\n");
}
