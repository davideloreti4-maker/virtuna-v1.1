/**
 * currentMonth — resolve the calendar's "today" month from a Date (server-side only).
 *
 * The month grid is deterministic off explicit (year, monthIndex) — see `month-layout.ts` —
 * so the ONE non-deterministic read (`new Date()`) is isolated here and called from the
 * server routes (/start, /calendar), which pass the resolved parts down as props. Client
 * components never call this (they'd hydrate-mismatch); they render off the passed parts.
 *
 * Uses LOCAL date parts to match `monthLayout` (also local), so "today" and the grid agree.
 */

export interface CurrentMonth {
  year: number;
  monthIndex: number; // 0-based (January = 0) — matches monthLayout
  today: number; // day-of-month (1..31)
  daysInMonth: number;
}

/** Resolve the current month's parts. `now` is injectable for tests (default: real clock). */
export function currentMonth(now: Date = new Date()): CurrentMonth {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, today, daysInMonth };
}
