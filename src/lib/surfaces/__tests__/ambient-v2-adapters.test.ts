/**
 * Ambient Audience v2 surface adapters — pure view-model derivation, honesty spine.
 *
 * The load-bearing guarantees:
 *  - a projected card reads `queued` (measured % withheld = 0) until a real sim seals it — never a
 *    fabricated measurement;
 *  - a sealed row outranks every queued row (a run beats a projection);
 *  - queued rows hold LEDGER ORDER. They used to sort by `personaStops` (and a video by its viral
 *    score scaled onto the same axis). That rank is dead — the engine stopped measuring it — so
 *    there is no signal left to order un-run work by, and a sort is as capable of fabricating a
 *    ranking as a printed number is;
 *  - every displayed fact is REAL (audience/projection) or STATIC config — nothing invented here.
 */

import { describe, expect, it } from "vitest";
import {
  buildOverviewData,
  buildSimulateData,
  buildStartData,
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
  sceneOptions: ["TikTok", "No feed"],
  segments: [
    { archetype: "niche_buyer", label: "Builders", share: 0.41 },
    { archetype: "casual_scroller", label: "Scrollers", share: 0.26 },
    { archetype: "cross_niche_curiosity", label: "Drop-ins", share: 0.14 },
    { archetype: "tough_crowd", label: "Skeptics", share: 0.12 },
    { archetype: "lurker", label: "Lurkers", share: 0.08 },
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

  it("with no fired sim: every row is queued, its % withheld, and the order is the LEDGER's", () => {
    const vm = buildOverviewData({ audience, descriptors });
    // Descriptor order, untouched. The dead persona rank produced ["idea-1", "script-2", "hook-0"]
    // from these same three fractions (9 → 6 → 3), so a re-introduced personaStops sort fails here
    // immediately rather than quietly re-ordering the board.
    expect(vm.ranked.map((r) => r.id)).toEqual(["hook-0", "idea-1", "script-2"]);
    expect(vm.ranked.every((r) => r.state === "queued")).toBe(true);
    expect(vm.ranked.every((r) => r.stopPct === 0)).toBe(true); // sealed-verdict law: withheld until run
    expect(vm.ranked[0]).toMatchObject({ id: "hook-0", kind: "hook" });
    // No row carries a score of its own. `personaStops` is off the type; this catches it coming
    // back through an `as never` or a widened object literal.
    for (const r of vm.ranked) expect(r).not.toHaveProperty("personaStops");
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

  // ── noDepth — the sealed row that has nothing behind it ────────────────────────
  // A run's % (flash reaction) and its depth (population projection) fail INDEPENDENTLY, so a row
  // can carry a perfectly real verdict and still have no drill. That combination used to render as
  // an ordinary door whose tap hit an empty `else` — no error, no log, no UI state — which is the
  // defect this flag exists to make impossible.
  it("marks a sealed row with no population as noDepth, so the board can stop dressing it as a door", () => {
    const vm = buildOverviewData({
      audience,
      descriptors,
      measured: { "hook-0": 41.9, "script-2": 20.0 },
      depthless: { "hook-0": true },
    });
    expect(vm.ranked.find((r) => r.id === "hook-0")).toMatchObject({
      state: "simulated",
      stopPct: 41.9, // the verdict is REAL — it is only the depth that is missing
      noDepth: true,
    });
    // A sealed row that DID project keeps its drill: the flag is per-row, never a board-wide mode.
    expect(vm.ranked.find((r) => r.id === "script-2")).not.toHaveProperty("noDepth");
  });

  it("never marks a QUEUED row noDepth — un-run work has no depth yet by definition", () => {
    // Guards the ordering inside the adapter: `depthless` is consulted only once a row is sealed.
    // Without the `sealed &&` guard a stale/over-broad map would brand every un-run row a dead end.
    const vm = buildOverviewData({
      audience,
      descriptors,
      depthless: { "hook-0": true, "idea-1": true },
    });
    expect(vm.ranked.every((r) => r.state === "queued")).toBe(true);
    for (const r of vm.ranked) expect(r).not.toHaveProperty("noDepth");
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

  it("derives the room's segments from the real signature, biggest slice first", () => {
    const vm = buildOverviewData({ audience, descriptors });
    expect(vm.segments).toEqual([
      { archetype: "niche_buyer", label: "Builders", sharePct: 41 },
      { archetype: "casual_scroller", label: "Scrollers", sharePct: 26 },
      { archetype: "cross_niche_curiosity", label: "Drop-ins", sharePct: 14 },
      { archetype: "tough_crowd", label: "Skeptics", sharePct: 12 },
      { archetype: "lurker", label: "Lurkers", sharePct: 8 },
    ]);
    expect(vm.audienceName).toBe("Your audience");
    expect(vm.provenance).toBe("calibrated · 3d");
  });

  it("apportions segment percentages so the printed column adds up", () => {
    // Three equal thirds. Rounded independently each is 33 and the column reads 99 — the kind of
    // detail that makes a real number look invented. Largest remainder hands the spare point out.
    const vm = buildOverviewData({
      audience: {
        ...audience,
        segments: [
          { archetype: "a", label: "A", share: 1 / 3 },
          { archetype: "b", label: "B", share: 1 / 3 },
          { archetype: "c", label: "C", share: 1 / 3 },
        ],
      },
      descriptors,
    });
    expect(vm.segments.map((s) => s.sharePct)).toEqual([34, 33, 33]);
    expect(vm.segments.reduce((sum, s) => sum + s.sharePct, 0)).toBe(100);
  });

  it("never invents the points a partial signature is missing", () => {
    // Shares summing to 0.9 print 90, not 100 — the apportionment targets the REAL sum. Inflating
    // to a full room would be the adapter fabricating coverage the calibration never claimed.
    const vm = buildOverviewData({
      audience: {
        ...audience,
        segments: [
          { archetype: "a", label: "A", share: 0.55 },
          { archetype: "b", label: "B", share: 0.35 },
        ],
      },
      descriptors,
    });
    expect(vm.segments.reduce((sum, s) => sum + s.sharePct, 0)).toBe(90);
  });

  it("survives an audience with no named slices (General / uncalibrated)", () => {
    const vm = buildOverviewData({ audience: { ...audience, segments: [] }, descriptors });
    expect(vm.segments).toEqual([]);
  });

  it("carries the SCENE so the board can state where the room reads", () => {
    // The header facts line ("1,000 minds · calibrated · reads on TikTok") needs the scene, and it
    // must be the SAME chosen scene ⑤ arms a run with — one fact, one source, never a second
    // hardcoded default drifting beside the first.
    const vm = buildOverviewData({ audience, descriptors });
    expect(vm.scene).toBe(audience.scene);
  });

  it("an UNREVEALED tested video ranks queued (viral score shown, attention % withheld)", () => {
    const vm = buildOverviewData({
      audience,
      descriptors,
      videos: [{ id: "vid-a", label: "my video", viralScore: 84, stopPct: 71, revealed: false }],
    });
    const row = vm.ranked.find((r) => r.id === "vid-a")!;
    expect(row).toMatchObject({ kind: "video", state: "queued", viralScore: 84, stopPct: 0 });
    // Ledger order: the concepts as generated, then the videos. The viral score is SHOWN on the
    // row (it is a real reading of the file) but it does not rank anything — it used to be scaled
    // to /10 and interleaved with the persona estimates, which ranked a craft score against an
    // attention projection as if they measured the same thing.
    expect(vm.ranked.map((r) => r.id)).toEqual(["hook-0", "idea-1", "script-2", "vid-a"]);
  });

  it("a REVEALED tested video seals by its measured attention %, ranked among the sealed rows", () => {
    const vm = buildOverviewData({
      audience,
      descriptors,
      measured: { "script-2": 55 }, // a concept sealed at 55%
      videos: [{ id: "vid-a", label: "my video", viralScore: 84, stopPct: 71, revealed: true }],
    });
    // both sealed rows sort above every queued row, by measured % desc (video 71 > concept 55)
    expect(vm.ranked.slice(0, 2).map((r) => r.id)).toEqual(["vid-a", "script-2"]);
    expect(vm.ranked[0]).toMatchObject({ id: "vid-a", state: "simulated", stopPct: 71, viralScore: 84 });
  });
});

describe("buildSimulateData", () => {
  it("binds the real room/scene/tier, prefixes the whole-room segment, carries develop", () => {
    const vm = buildSimulateData({
      audience,
      stimulus: { text: "Nobody tells you…", kind: "hook" },
      develop: { sourceLabel: "Hooks run" },
    });
    expect(vm.room).toBe("Your audience");
    expect(vm.provenance).toBe("TikTok"); // calibratedFrom, NOT the recency badge
    expect(vm.scene).toBe("TikTok");
    expect(vm.fidelity).toBe("flash");
    // "Everyone" carries a NULL archetype — that absence is what the route reads to tell a
    // whole-room run from a sliced one, so it is asserted rather than merely tolerated.
    expect(vm.segments[0]).toEqual({ archetype: null, label: "Everyone", share: 1 });
    expect(vm.segments[1]).toMatchObject({ archetype: "niche_buyer", label: "Builders" });
    expect(vm.segments).toHaveLength(audience.segments.length + 1);
    expect(vm.lenses.map((l) => l.key)).toEqual(["stop", "finish", "share", "follow", "buy"]);
    expect(vm.intake.some((i) => i.family === "screen" && i.status === "active")).toBe(true);
    // The tie-back names its SOURCE. It carried a band + an "8/10" until 2026-08-02 — a score the
    // engine no longer produces, rendered directly above the spend button.
    expect(vm.develop).toEqual({ sourceLabel: "Hooks run" });
  });

  it("omits develop on a cold entry", () => {
    const vm = buildSimulateData({ audience, stimulus: { text: "x", kind: "draft" } });
    expect(vm.develop).toBeUndefined();
  });

  // The two SCREEN doors are resolved by `kind` with a non-null assertion at MODULE scope
  // (`dev/cards/page.tsx`: `INTAKE_DOORS.find((o) => o.kind === "draft")!`). Rename either kind and
  // tsc stays perfectly happy while those become `undefined` at import time — which throws the
  // whole `/dev/cards` page, not just the section that uses them. Nothing held this until now.
  it("keeps the two SCREEN doors resolvable by kind, active, and carrying a stimulusKind", () => {
    const vm = buildSimulateData({ audience, stimulus: { text: "x", kind: "draft" } });
    const draft = vm.intake.find((o) => o.kind === "draft");
    const video = vm.intake.find((o) => o.kind === "video");

    expect(draft, "the `draft` door is gone from the intake").toBeDefined();
    expect(video, "the `video` door is gone from the intake").toBeDefined();
    expect(draft?.status).toBe("active");
    expect(video?.status).toBe("active");
    // `SimulateIntake` branches on `opt.stimulusKind === "video"` and otherwise falls back to
    // `"draft"` (SimulateIntake.tsx:278,299), so a video door that loses its `stimulusKind` does
    // not fail — it quietly collects a textarea and arms a DRAFT run.
    expect(draft?.stimulusKind).toBe("draft");
    expect(video?.stimulusKind).toBe("video");
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
    // Grouped by what you came to DO. "Content · Intel" named the output class and shipped a piece
    // of operator-speak ("Intel") on the first screen a creator sees.
    expect(vm.skillGroups.map((g) => g.label)).toEqual(["Create", "Research"]);
  });

  it("gives every tile a lens line, and marks unwired artifacts `soon`", () => {
    const vm = buildStartData({ name: "Davide", audience });
    const skills = vm.skillGroups.flatMap((g) => g.skills);
    // The lens IS the disambiguation (a label alone can't separate Video test from Draft read).
    for (const s of skills) expect(s.lens.trim().length, `${s.id} needs a lens`).toBeGreaterThan(0);
    // Neither `ad` nor `compare` has a runner in SKILL_TOOLS/SKILL_RUN_META — both must stay inert
    // until one exists, or a pick arms a tool the composer can't run.
    expect(skills.find((s) => s.id === "ad")?.status).toBe("soon");
    expect(skills.find((s) => s.id === "compare")?.status).toBe("soon");
  });
});
