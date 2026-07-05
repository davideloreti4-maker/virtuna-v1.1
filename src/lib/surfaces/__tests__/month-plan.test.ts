import { describe, it, expect } from "vitest";
import { buildLivePlan, planToWidgetDays, planToList } from "../month-plan";
import type { LiveIdeaCard } from "../live-cards";
import type { ReactionPersona } from "@/lib/tools/blocks";

/** N personas: `stops` stop-verdicts then the rest scroll (mirrors live-cards.test). */
function personas(stops: number, total: number): ReactionPersona[] {
  return Array.from({ length: total }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < stops ? ("stop" as const) : ("scroll" as const),
    quote: i < stops ? `stop quote ${i}` : `scroll quote ${i}`,
  }));
}

function idea(id: string, stops: number): LiveIdeaCard {
  return { contentId: id, type: "Reel", title: `idea ${id}`, personas: personas(stops, 10) };
}

describe("buildLivePlan", () => {
  it("projects ranked ideas onto upcoming days at the default cadence (today+1, step 2)", () => {
    const plan = buildLivePlan([idea("idea-0", 9), idea("idea-1", 7), idea("idea-2", 3)], {
      today: 5,
      daysInMonth: 31,
    });
    expect(Object.keys(plan).map(Number).sort((a, b) => a - b)).toEqual([6, 8, 10]);
    expect(plan[6]!.contentId).toBe("idea-0"); // top idea lands soonest
    expect(plan[6]!.day).toBe(6);
  });

  it("derives the REAL face from each idea's personas (never fabricated)", () => {
    const plan = buildLivePlan([idea("idea-0", 9)], { today: 5, daysInMonth: 31 });
    const post = plan[6]!;
    expect(post.face.stop).toBe(9);
    expect(post.face.tone).toBe("loved");
    expect(post.face.lead).toBe("stop quote 0"); // a real stopper's verbatim quote
    expect(post.face.fraction).toBe("9/10 stop");
  });

  it("bands a low-stop idea to a risky (bounced) tone", () => {
    const plan = buildLivePlan([idea("idea-0", 3)], { today: 5, daysInMonth: 31 });
    expect(plan[6]!.face.tone).toBe("bounced");
  });

  it("drops slots that overflow the month (honest sparse, never wraps)", () => {
    const plan = buildLivePlan([idea("a", 9), idea("b", 9), idea("c", 9), idea("d", 9)], {
      today: 30,
      daysInMonth: 31,
    });
    // today+1=31 (fits), 33/35/37 overflow → only one placed
    expect(Object.keys(plan)).toEqual(["31"]);
    expect(plan[31]!.contentId).toBe("a");
  });

  it("empty ideas → empty plan (honest empty grid)", () => {
    expect(buildLivePlan([], { today: 5, daysInMonth: 31 })).toEqual({});
  });

  it("honors custom cadence + startOffset", () => {
    const plan = buildLivePlan([idea("a", 9), idea("b", 9)], {
      today: 1,
      daysInMonth: 31,
      cadence: 3,
      startOffset: 0,
    });
    expect(Object.keys(plan).map(Number).sort((a, b) => a - b)).toEqual([1, 4]);
  });
});

describe("planToWidgetDays", () => {
  it("emits a cell per day, carrying only planned days' tone", () => {
    const plan = buildLivePlan([idea("idea-0", 9)], { today: 5, daysInMonth: 7 });
    const days = planToWidgetDays(plan, 7);
    expect(days).toHaveLength(7);
    expect(days[5]).toEqual({ day: 6, tone: "loved" }); // day 6 planned
    expect(days[0]).toEqual({ day: 1 }); // empty → no tone
  });
});

describe("planToList", () => {
  it("returns posts sorted ascending by day", () => {
    const plan = buildLivePlan([idea("a", 9), idea("b", 7)], { today: 5, daysInMonth: 31 });
    expect(planToList(plan).map((p) => p.day)).toEqual([6, 8]);
  });
});
