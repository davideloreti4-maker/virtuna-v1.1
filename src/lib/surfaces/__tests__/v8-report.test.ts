import { describe, it, expect } from "vitest";
import { personasToReportRead, buildPersonaReportTemplate } from "../v8-report";
import type { ReactionPersona } from "@/lib/tools/blocks";

function p(archetype: string, verdict: "stop" | "scroll", quote = ""): ReactionPersona {
  return { archetype, verdict, quote };
}

const TEN: ReactionPersona[] = [
  p("builders", "stop", "ok that's me. fine."),
  p("learners", "stop", "the specificity reads true"),
  p("skeptics", "scroll", "heard this one before"),
  p("drive_by", "stop", ""),
  p("builders", "stop", "first-person beats advice"),
  p("learners", "scroll", "wants the alternative sooner"),
  p("skeptics", "stop", "fair enough"),
  p("drive_by", "stop", ""),
  p("builders", "stop", ""),
  p("learners", "scroll", ""),
];

describe("personasToReportRead", () => {
  it("counts the real verdicts — never rounds a fraction into a claim", () => {
    const read = personasToReportRead(TEN);
    expect(read.stop).toBe(7);
    expect(read.total).toBe(10);
    expect(read.stopPct).toBe(70);
  });

  it("groups only REAL quotes; a persona that said nothing contributes no voice", () => {
    const read = personasToReportRead(TEN);
    expect(read.stopped.map((v) => v.quote)).toEqual([
      "ok that's me. fine.",
      "the specificity reads true",
      "first-person beats advice",
      "fair enough",
    ]);
    expect(read.scrolled.map((v) => v.quote)).toEqual([
      "heard this one before",
      "wants the alternative sooner",
    ]);
  });

  it("humanises the archetype into the voice's name", () => {
    const read = personasToReportRead([p("drive_by", "stop", "sure")]);
    expect(read.stopped[0]!.who).toBe("Drive By");
  });

  it("leads with a stopper's voice on a stopped-majority read", () => {
    const read = personasToReportRead(TEN);
    expect(read.lead?.quote).toBe("ok that's me. fine.");
  });

  it("leads with a scroller's voice when the room bounced", () => {
    const read = personasToReportRead([
      p("a", "scroll", "nope"),
      p("b", "scroll", "boring"),
      p("c", "stop", "kept me"),
    ]);
    expect(read.lead?.quote).toBe("nope");
  });

  it("returns no lead at all when nobody said anything (never invents one)", () => {
    const read = personasToReportRead([p("a", "stop"), p("b", "scroll")]);
    expect(read.lead).toBeNull();
    expect(read.stopped).toEqual([]);
  });

  it("is total on an empty persona list", () => {
    const read = personasToReportRead([]);
    expect(read).toEqual({ stop: 0, total: 0, stopPct: 0, stopped: [], scrolled: [], lead: null });
  });
});

describe("buildPersonaReportTemplate", () => {
  const read = personasToReportRead(TEN);
  const t = buildPersonaReportTemplate({
    read,
    title: "I sit 10 hours a day. Stretching didn't fix me — this did.",
    audienceName: "Your people",
    calibratedFrom: "TikTok",
  });

  it("states the verdict in the surface's own unit", () => {
    expect(t.verdict).toEqual({ value: "7/10", label: "stopped scrolling" });
  });

  it("carries NO population, NO brain and NO engagement — a pre-run read has none of the three", () => {
    expect(t.population).toBeNull();
    expect(t.brain).toBeUndefined();
    expect(t.engagement).toBeUndefined();
  });

  it("renders no pager and no back label — the report is not the drill's pager", () => {
    expect(t.pager).toBe("");
    expect(t.backLabel).toBe("");
  });

  it("discloses the sample honestly, with no multiplier and no donor niche", () => {
    expect(t.simline).toBe("10 simulated · calibrated on TikTok");
    expect(JSON.stringify(t)).not.toMatch(/\d+(\.\d+)?x/i);
  });
});
