/**
 * Ambient Audience v2 surface adapters — pure view-model derivation, honesty spine.
 *
 * The load-bearing guarantees:
 *  - a projected card ranks by its personaStops and reads `queued` (measured % withheld = 0) until a
 *    real sim seals it — never a fabricated measurement;
 *  - a sealed row outranks every queued row (a run beats a projection);
 *  - every displayed fact is REAL (audience/projection) or STATIC config — nothing invented here.
 */

import { describe, expect, it } from "vitest";
import {
  buildOverviewData,
  buildSimulateData,
  buildStartData,
  parsePersonaStops,
  rankKindOf,
  type AudienceMeta,
} from "../ambient-v2-adapters";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

const audience: AudienceMeta = {
  name: "Your audience",
  calibrationBadge: "calibrated · 3d",
  calibratedFrom: "TikTok",
  tier: "flash",
  scene: "TikTok",
  sceneOptions: ["TikTok", "Instagram", "No feed"],
  segments: [
    { label: "Builders", share: 0.41 },
    { label: "Scrollers", share: 0.26 },
    { label: "Drop-ins", share: 0.14 },
    { label: "Skeptics", share: 0.12 },
    { label: "Lurkers", share: 0.08 },
  ],
};

function desc(over: Partial<AmbientCardDescriptor> & { id: string }): AmbientCardDescriptor {
  return {
    conceptText: "a hook",
    fraction: "5/10 stop",
    scrollQuote: "",
    ...over,
  };
}

describe("parsePersonaStops", () => {
  it("reads the numerator, clamps 0–10, degrades malformed to 0", () => {
    expect(parsePersonaStops("8/10 stop")).toBe(8);
    expect(parsePersonaStops("0/10 stop")).toBe(0);
    expect(parsePersonaStops("13/10")).toBe(10); // clamp
    expect(parsePersonaStops("no fraction")).toBe(0);
    expect(parsePersonaStops("")).toBe(0);
  });
});

describe("rankKindOf", () => {
  it("passes known kinds, falls back unknown/absent to concept", () => {
    expect(rankKindOf("hook")).toBe("hook");
    expect(rankKindOf("remix")).toBe("remix");
    expect(rankKindOf("mystery")).toBe("concept");
    expect(rankKindOf(undefined)).toBe("concept");
  });
});

describe("buildOverviewData", () => {
  const descriptors = [
    desc({ id: "hook-0", conceptText: "low", fraction: "3/10 stop", kind: "hook" }),
    desc({ id: "idea-1", conceptText: "high", fraction: "9/10 stop", kind: "idea" }),
    desc({ id: "script-2", conceptText: "mid", fraction: "6/10 stop", kind: "script" }),
  ];

  it("with no fired sim: every row is queued, its % withheld, ranked by personaStops desc", () => {
    const vm = buildOverviewData({ audience, descriptors });
    expect(vm.ranked.map((r) => r.id)).toEqual(["idea-1", "script-2", "hook-0"]);
    expect(vm.ranked.every((r) => r.state === "queued")).toBe(true);
    expect(vm.ranked.every((r) => r.stopPct === 0)).toBe(true); // sealed-verdict law: withheld until run
    expect(vm.ranked[0]).toMatchObject({ personaStops: 9, kind: "idea" });
  });

  it("a fired sim seals its row, outranks every queued row, and sorts sealed by measured stopPct", () => {
    const vm = buildOverviewData({
      audience,
      descriptors,
      measured: { "hook-0": 41.9, "script-2": 20.0 }, // the LOW-projection hook actually measured highest
    });
    // sealed (by stopPct desc) above queued (by personaStops)
    expect(vm.ranked.map((r) => r.id)).toEqual(["hook-0", "script-2", "idea-1"]);
    expect(vm.ranked[0]).toMatchObject({ id: "hook-0", stopPct: 41.9, state: "simulated" });
    expect(vm.ranked[2]).toMatchObject({ id: "idea-1", state: "queued", stopPct: 0 });
  });

  it("passes a sim-in-flight through, and defaults watching to null at rest", () => {
    const rest = buildOverviewData({ audience, descriptors });
    expect(rest.watching).toBeNull();
    const live = buildOverviewData({
      audience,
      descriptors,
      watching: { stimulus: "x", verdictPct: 31.7 },
    });
    expect(live.watching).toEqual({ stimulus: "x", verdictPct: 31.7 });
  });

  it("derives cast + overflow from the real signature segments", () => {
    const vm = buildOverviewData({ audience, descriptors });
    expect(vm.cast.map((c) => c.initial)).toEqual(["B", "S", "D", "S"]);
    expect(vm.castOverflow).toBe(1); // 5 segments − 4 shown
    expect(vm.audienceName).toBe("Your audience");
    expect(vm.provenance).toBe("calibrated · 3d");
  });
});

describe("buildSimulateData", () => {
  it("binds the real room/scene/tier, prefixes the whole-room segment, carries develop", () => {
    const vm = buildSimulateData({
      audience,
      stimulus: { text: "Nobody tells you…", kind: "hook" },
      develop: { band: "Strong", value: "8/10", lensLabel: "stopped" },
    });
    expect(vm.room).toBe("Your audience");
    expect(vm.provenance).toBe("TikTok"); // calibratedFrom, NOT the recency badge
    expect(vm.scene).toBe("TikTok");
    expect(vm.fidelity).toBe("flash");
    expect(vm.segments[0]).toEqual({ label: "Everyone", share: 1 });
    expect(vm.segments).toHaveLength(audience.segments.length + 1);
    expect(vm.lenses.map((l) => l.key)).toEqual(["stop", "finish", "share", "follow", "buy"]);
    expect(vm.intake.some((i) => i.family === "screen" && i.status === "active")).toBe(true);
    expect(vm.develop).toMatchObject({ value: "8/10" });
  });

  it("omits develop on a cold entry", () => {
    const vm = buildSimulateData({ audience, stimulus: { text: "x", kind: "draft" } });
    expect(vm.develop).toBeUndefined();
  });
});

describe("buildStartData", () => {
  it("binds real name/audience/scene/tier and the static skill menu", () => {
    const vm = buildStartData({ name: "Davide", audience });
    expect(vm.name).toBe("Davide");
    expect(vm.conditions.audience).toBe("Your audience");
    expect(vm.conditions.scene).toBe("TikTok");
    expect(vm.conditions.fidelity).toBe("SIM-1 Flash");
    const ids = vm.skillGroups.flatMap((g) => g.skills.map((s) => s.id));
    expect(ids).toContain("hooks");
    expect(ids).toContain("explore");
    expect(vm.skillGroups.map((g) => g.label)).toEqual(["Make", "Analyze", "Discover"]);
  });
});
