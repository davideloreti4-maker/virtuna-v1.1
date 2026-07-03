/**
 * Pure month-grid geometry for a Monday-first calendar. Deterministic — takes an
 * explicit (year, monthIndex) so it never reads `Date.now()`; the /start widget and
 * the /calendar workspace both render off this so their grids line up exactly.
 */

/** Monday-first weekday heads (the grid's column order). */
export const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface MonthLayout {
  /** "July 2026" */
  label: string;
  daysInMonth: number;
  /** Trailing days of the previous month that fill the first row (Mon-first). */
  lead: number[];
  /** Leading days of the next month that complete the last row. */
  trail: number[];
}

/** Grid layout for a month. `monthIndex` is 0-based (January = 0). */
export function monthLayout(year: number, monthIndex: number): MonthLayout {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // JS weekday: Sun=0..Sat=6 → Mon-first column 0..6.
  const firstCol = (first.getDay() + 6) % 7;
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();
  const lead = Array.from({ length: firstCol }, (_, i) => prevMonthDays - firstCol + 1 + i);
  const trailCount = (7 - ((firstCol + daysInMonth) % 7)) % 7;
  const trail = Array.from({ length: trailCount }, (_, i) => i + 1);
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { label, daysInMonth, lead, trail };
}
