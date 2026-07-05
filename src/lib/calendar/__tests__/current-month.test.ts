import { describe, it, expect } from "vitest";
import { currentMonth } from "../current-month";

describe("currentMonth", () => {
  it("resolves year / 0-based monthIndex / today / daysInMonth from a Date", () => {
    // 2026-07-05 (local) — the seam-vertical milestone's "today".
    const cm = currentMonth(new Date(2026, 6, 5));
    expect(cm).toEqual({ year: 2026, monthIndex: 6, today: 5, daysInMonth: 31 });
  });

  it("handles a 30-day month", () => {
    expect(currentMonth(new Date(2026, 3, 15))).toEqual({
      year: 2026,
      monthIndex: 3,
      today: 15,
      daysInMonth: 30,
    });
  });

  it("handles a leap-year February", () => {
    expect(currentMonth(new Date(2028, 1, 29)).daysInMonth).toBe(29);
  });

  it("handles a non-leap February", () => {
    expect(currentMonth(new Date(2026, 1, 28)).daysInMonth).toBe(28);
  });
});
