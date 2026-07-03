import { describe, it, expect } from "vitest";
import { monthLayout } from "../month-layout";

describe("monthLayout", () => {
  it("lays out July 2026 (Wed-start, 31 days) Mon-first — matches the /start widget", () => {
    const l = monthLayout(2026, 6);
    expect(l.label).toBe("July 2026");
    expect(l.daysInMonth).toBe(31);
    expect(l.lead).toEqual([29, 30]); // Jun 29/30 fill Mon/Tue
    expect(l.trail).toEqual([1, 2]); // Aug 1/2 complete the last week
  });

  it("has no lead for a Monday-start month (June 2026)", () => {
    const l = monthLayout(2026, 5); // June 1 2026 = Monday
    expect(l.lead).toEqual([]);
    expect(l.daysInMonth).toBe(30);
  });

  it("always completes full weeks", () => {
    for (let m = 0; m < 12; m++) {
      const l = monthLayout(2026, m);
      expect((l.lead.length + l.daysInMonth + l.trail.length) % 7).toBe(0);
    }
  });
});
