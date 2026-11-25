/**
 * The hub's return point: where the grid was when a card
 * opened, so Back lands on the same cards at the same scroll. The address keeps the view; this keeps
 * how many cards were shown and how far `<main>` was scrolled, which the address does not.
 *
 * A module memory, as `lib/onboarding/pending-upload.ts` stages a file: a client navigation keeps the
 * module, a reload does not, and that is fine (the grid then opens at its top). Taken once: the slot
 * is cleared on every take, so a later visit can never land on a stale point.
 */

/** How long a point stays good. */
export const RETURN_POINT_MS = 30 * 60 * 1000;

export interface ReturnPoint {
  /** The hub's address when the card opened (`discoverHref` of its view). */
  href: string;
  /** Cards shown. */
  shown: number;
  /** `<main>`'s scroll. */
  top: number;
}

let held: (ReturnPoint & { at: number }) | null = null;

/** A card on the hub opens: keep the point. A second one replaces the first. */
export function leaveGrid(point: ReturnPoint, now: number = Date.now()): void {
  held = { ...point, at: now };
}

/** The hub mounts on `href`: the point, once, when it was left on that address within 30 minutes; else null. */
export function takeGrid(href: string, now: number = Date.now()): { shown: number; top: number } | null {
  const point = held;
  held = null;
  if (!point || point.href !== href || now - point.at > RETURN_POINT_MS) return null;
  return { shown: point.shown, top: point.top };
}
