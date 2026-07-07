import { describe, it, expect } from "vitest";
import type { ReactionPersona } from "@/lib/tools/blocks";
import type { PlannedPostRow } from "@/lib/planned-posts/planned-posts-repo";
import {
  buildPlannedPlan,
  recommendedDays,
  cadenceNext7,
  nextPlanned,
  labelWhen,
  toISODate,
  plannedToWidgetDays,
  plannedToList,
} from "../planned-plan";

const personas = (stops: number, total = 10): ReactionPersona[] =>
  Array.from({ length: total }, (_, i) => ({
    archetype: `a${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i === 0 ? "loved it" : "",
  }));

const row = (id: string, date: string, stops = 8): PlannedPostRow => ({
  id,
  scheduled_date: date,
  content_id: `c-${id}`,
  title: `Post ${id}`,
  format: "Reel",
  personas: personas(stops),
});

describe("toISODate / labelWhen", () => {
  it("formats and pads parts", () => {
    expect(toISODate(2026, 6, 8)).toBe("2026-07-08"); // monthIndex 6 = July
    expect(toISODate(2026, 0, 1)).toBe("2026-01-01");
  });
  it("labels month/day + a deterministic weekday", () => {
    expect(labelWhen("2026-07-08")).toEqual({ md: "Jul 8", dow: "Wed" }); // Jul 8 2026 is a Wed
  });
});

describe("buildPlannedPlan", () => {
  it("maps only the viewed month, keyed by day, with a derived face", () => {
    const rows = [row("a", "2026-07-08", 8), row("b", "2026-08-01", 6), row("c", "2026-07-20", 2)];
    const plan = buildPlannedPlan(rows, 2026, 6); // July
    expect(Object.keys(plan).sort()).toEqual(["20", "8"]);
    expect(plan[8]!.title).toBe("Post a");
    expect(plan[8]!.face.tone).toBe("loved"); // 8/10 stop
    expect(plan[20]!.face.tone).toBe("bounced"); // 2/10 stop
  });
  it("is empty for a month with no rows", () => {
    expect(buildPlannedPlan([row("a", "2026-07-08")], 2026, 5)).toEqual({});
  });
});

describe("recommendedDays", () => {
  it("suggests upcoming empty days on a ~2-day cadence", () => {
    expect(recommendedDays(new Set(), 7, 31)).toEqual([8, 10, 12]);
  });
  it("skips occupied days", () => {
    expect(recommendedDays(new Set([8, 10]), 7, 31)).toEqual([9, 11, 13]);
  });
  it("returns fewer near the month's end", () => {
    expect(recommendedDays(new Set(), 29, 31)).toEqual([30]);
  });
});

describe("cadenceNext7", () => {
  it("counts posts in the next 7 days inclusive of today", () => {
    const plan = buildPlannedPlan(
      [row("a", "2026-07-07"), row("b", "2026-07-10"), row("c", "2026-07-20")],
      2026,
      6,
    );
    expect(cadenceNext7(plan, 7)).toBe(2); // 7 and 10 are in [7,13]; 20 is not
  });
  it("is 0 when today is null (non-base month)", () => {
    expect(cadenceNext7({}, null)).toBe(0);
  });
});

describe("plannedToWidgetDays / plannedToList (the /start widget bridge)", () => {
  const plan = buildPlannedPlan([row("a", "2026-07-08", 8), row("b", "2026-07-03", 2)], 2026, 6);

  it("maps every day cell, carrying tone only on planned days", () => {
    const days = plannedToWidgetDays(plan, 31);
    expect(days).toHaveLength(31);
    expect(days[7]).toEqual({ day: 8, tone: "loved" }); // Jul 8
    expect(days[2]).toEqual({ day: 3, tone: "bounced" }); // Jul 3
    expect(days[4]).toEqual({ day: 5 }); // empty day — no tone
  });

  it("lists planned posts day-sorted", () => {
    expect(plannedToList(plan).map((p) => p.day)).toEqual([3, 8]);
  });
});

describe("nextPlanned", () => {
  it("returns the soonest row on/after today", () => {
    const rows = [row("a", "2026-07-20"), row("b", "2026-07-08"), row("c", "2026-06-30")];
    expect(nextPlanned(rows, "2026-07-07")?.id).toBe("b"); // 06-30 past; soonest upcoming is 07-08
  });
  it("ignores past rows", () => {
    const rows = [row("past", "2026-07-01"), row("soon", "2026-07-09")];
    expect(nextPlanned(rows, "2026-07-07")?.id).toBe("soon");
  });
});
