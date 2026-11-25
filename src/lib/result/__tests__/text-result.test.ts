import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import { HOOK_1_POPULATION, population, segmentsPopulation } from "@/components/thread-next/__tests__/fixtures/answers";
import { RING_DOTS, ringDots, type RingDot } from "../ring-layout";
import {
  TEXT_RESULT_TITLE,
  TEXT_RING,
  sweepOrdered,
  textResultAsOf,
  textResultHref,
  textResultOf,
  textRingLooks,
  wedgeAreas,
} from "../text-result";

const model = () => textResultOf(HOOK_1_POPULATION)!;

describe("textResultOf", () => {
  it("the number is the population's stopPct, rounded", () => {
    expect(model().value).toBe(30);
    expect(textResultOf(population(25.8))?.value).toBe(26);
  });

  it("ten groups by their display names, highest percent first, as the drawing lists them", () => {
    expect(model().groups.map((g) => [g.name, g.share, g.percent])).toEqual([
      ["Savers", 9, 100],
      ["Quiet watchers", 14, 52],
      ["Scouts", 6, 42],
      ["Passers-by", 8, 38],
      ["Sharers", 12, 36],
      ["Tough crowd", 9, 27],
      ["Commenters", 12, 6],
      ["Purposeful viewers", 6, 5],
      ["Deep fans", 6, 3],
      ["Regulars", 18, 1],
    ]);
    expect(model().groups.map((g) => g.name)).not.toContain("Quiet Watchers");
  });

  it("a tie in percent: the larger share first, then the video ring's order", () => {
    const m = textResultOf(segmentsPopulation([["sharer", 0.2, 40], ["saver", 0.3, 40], ["lurker", 0.3, 40]]))!;
    expect(m.groups.map((g) => g.group)).toEqual(["saver", "lurker", "sharer"]);
  });

  it("wedges in the video ring's order (ARCHETYPES), each as wide as its share", () => {
    const { wedges } = model();
    expect(wedges.map((w) => w.group)).toEqual([...ARCHETYPES]);
    const loyalist = wedges.find((w) => w.group === "loyalist")!;
    expect(loyalist.present).toBe(true);
    expect(loyalist.weight).toBeCloseTo(18);
  });

  it("an unknown slug is dropped; a group with no segment is an absent wedge", () => {
    const m = textResultOf(segmentsPopulation([["saver", 0.6, 50], ["the_tech_trend_hunter", 0.4, 90]]))!;
    expect(m.groups.map((g) => g.group)).toEqual(["saver"]);
    expect(m.wedges.filter((w) => w.present).map((w) => w.group)).toEqual(["saver"]);
    expect(m.wedges.find((w) => w.group === "lurker")).toEqual({ group: "lurker", weight: 0, present: false });
  });

  it("no number, no model", () => {
    expect(textResultOf(null)).toBeNull();
    expect(textResultOf({ total: 1000, segments: [], reasons: [] })).toBeNull();
    expect(textResultOf({ ...population(30), stopPct: 130 })).toBeNull();
  });
});

describe("textRingLooks", () => {
  it("each wedge lit to its group's percent, ink only; 1,000 dots in all", () => {
    const m = model();
    const layout = ringDots(m.wedges, TEXT_RING);
    const looks = textRingLooks(m, layout);
    expect(layout.wedges.reduce((n, w) => n + w.dots.length, 0)).toBe(RING_DOTS);
    const at = (group: string) => layout.wedges.findIndex((w) => w.group === group);
    expect(looks[at("saver")]).toEqual({ on: layout.wedges[at("saver")]!.dots.length, coral: false, outline: false });
    expect(looks[at("loyalist")]!.on).toBe(Math.round(0.01 * layout.wedges[at("loyalist")]!.dots.length));
    expect(looks.every((l) => !l.coral && !l.outline)).toBe(true);
  });

  it("a group with no segment is outlines", () => {
    const m = textResultOf(segmentsPopulation([["saver", 1, 50]]))!;
    const layout = ringDots(m.wedges, TEXT_RING);
    const looks = textRingLooks(m, layout);
    expect(looks[layout.wedges.findIndex((w) => w.group === "lurker")]).toEqual({ on: 0, coral: false, outline: true });
  });
});

describe("sweepOrdered", () => {
  it("orders each wedge clockwise from its leading edge, so a lit part is a slice across every row", () => {
    const base = ringDots(model().wedges, TEXT_RING);
    const swept = sweepOrdered(base);
    const c = swept.size / 2;
    const angle = (d: RingDot) => (Math.atan2(d.y - c, d.x - c) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    swept.wedges.forEach((wedge, i) => {
      const before = base.wedges[i]!.dots;
      expect(new Set(wedge.dots.map((d) => `${d.x},${d.y}`))).toEqual(new Set(before.map((d) => `${d.x},${d.y}`)));
      for (let k = 1; k < wedge.dots.length; k++) expect(angle(wedge.dots[k]!)).toBeGreaterThanOrEqual(angle(wedge.dots[k - 1]!));
    });
    const lurker = swept.wedges.find((w) => w.group === "lurker")!;
    const lit = lurker.dots.slice(0, Math.round(0.52 * lurker.dots.length));
    expect(new Set(lit.map((d) => d.row))).toEqual(new Set(lurker.dots.map((d) => d.row)));
  });
});

describe("the address", () => {
  it("titles and the as parameter", () => {
    expect(TEXT_RESULT_TITLE).toEqual({ hook: "Hook", idea: "Idea", opening: "Opening line" });
    expect(textResultAsOf("idea")).toBe("idea");
    expect(textResultAsOf("opening")).toBe("opening");
    expect(textResultAsOf(undefined)).toBe("hook");
    expect(textResultAsOf("video")).toBe("hook");
  });

  it("hook has no parameter; idea and opening say what they are", () => {
    expect(textResultHref("t-1", "ungWv48Bz-")).toBe("/simulation/hook/t-1/ungWv48Bz-");
    expect(textResultHref("t-1", "ungWv48Bz-", "idea")).toBe("/simulation/hook/t-1/ungWv48Bz-?as=idea");
    expect(textResultHref("t-1", "ungWv48Bz-", "opening")).toBe("/simulation/hook/t-1/ungWv48Bz-?as=opening");
  });
});

describe("wedgeAreas", () => {
  const clockwiseOf = (size: number) => (d: RingDot) => {
    const c = size / 2;
    return (Math.atan2(d.y - c, d.x - c) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  };

  it("one area per group in the run, in the ring's order, each holding all of its own dots", () => {
    const layout = sweepOrdered(ringDots(model().wedges, TEXT_RING));
    const areas = wedgeAreas(layout, TEXT_RING);
    expect(areas.map((a) => a.group)).toEqual(layout.wedges.map((w) => w.group));
    const angle = clockwiseOf(layout.size);
    areas.forEach((area, i) => {
      for (const dot of layout.wedges[i]!.dots) {
        expect(angle(dot)).toBeGreaterThan(area.a0);
        expect(angle(dot)).toBeLessThan(area.a1);
      }
      expect(area.d).toMatch(/^M[\d.]+ [\d.]+A141 141 0 [01] 1 [\d.]+ [\d.]+L[\d.]+ [\d.]+A59 59 0 [01] 0 [\d.]+ [\d.]+Z$/);
    });
  });

  it("neighbouring areas never overlap, and none crosses 12 o'clock", () => {
    const areas = wedgeAreas(ringDots(model().wedges, TEXT_RING), TEXT_RING);
    expect(areas[0]!.a0).toBeGreaterThan(0);
    expect(areas[areas.length - 1]!.a1).toBeLessThan(2 * Math.PI);
    for (let i = 1; i < areas.length; i++) expect(areas[i]!.a0).toBeGreaterThan(areas[i - 1]!.a1);
  });

  it("a group that is not in the run has no area", () => {
    const m = textResultOf(segmentsPopulation([["saver", 0.6, 50], ["lurker", 0.4, 20]]))!;
    const areas = wedgeAreas(ringDots(m.wedges, TEXT_RING), TEXT_RING);
    expect(areas.map((a) => a.group).sort()).toEqual(["lurker", "saver"]);
  });
});
