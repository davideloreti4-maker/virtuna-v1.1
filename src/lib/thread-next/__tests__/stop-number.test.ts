import { describe, expect, it } from "vitest";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { MEAL_PREP_HOOKS, SEALS_DONE, population } from "@/components/thread-next/__tests__/fixtures/answers";

describe("stopNumberOf", () => {
  it("rounds population.stopPct, never pct", () => {
    expect(stopNumberOf({ pct: 70, population: { stopPct: 29.6 } })).toBe(30);
    expect(stopNumberOf({ pct: 70 })).toBeNull();
    expect(stopNumberOf({ sealed: true })).toBeNull();
  });
  it("reads the drawing's sealed pack: 30, 22, 45", () => {
    expect(MEAL_PREP_HOOKS.map((b) => stopNumberOf(SEALS_DONE[b.props.hookLine.trim()]))).toEqual([30, 22, 45]);
  });
  it("a sealed wire seal is null even if it somehow carries a population", () => {
    expect(stopNumberOf({ sealed: true, at: "", video: { analysisId: "vid-fixture-1", craftScore: 50 }, population: population(40) })).toBeNull();
  });
  it("keeps the bounds 0 and 100", () => {
    expect(stopNumberOf({ population: { stopPct: 0 } })).toBe(0);
    expect(stopNumberOf({ population: { stopPct: 100 } })).toBe(100);
    expect(stopNumberOf({ population: { stopPct: 0.4 } })).toBe(0);
  });
  it.each([
    undefined,
    null,
    30,
    "30",
    [],
    { population: null },
    { population: {} },
    { population: { stopPct: "30" } },
    { population: { stopPct: Number.NaN } },
    { population: { stopPct: Number.POSITIVE_INFINITY } },
    { population: { stopPct: -0.1 } },
    { population: { stopPct: 100.2 } },
  ])("%j is null", (seal) => {
    expect(stopNumberOf(seal)).toBeNull();
  });
});
