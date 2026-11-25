/**
 * The result page's reading of a video run, checked on RECORDED runs.
 *
 * The fixtures are stored simulations in the shape `GET /api/analysis/[id]` returns them (signed
 * addresses and ids removed). Nothing here stands in for our own code: every function runs on the
 * stored heatmap. The expected values were read off the same runs with the working draft of the
 * rule (`.scratch/next-look/part2/rule.cjs`) on 2026-11-19.
 *
 * Timing, as the engine stores it: a viewer's `swipe_predicted_at` is the START of the scene they
 * leave in. So the share still watching is known at the END of each scene, not in between.
 */
import { describe, expect, it } from "vitest";
import { retentionCurveOf } from "@/lib/surfaces/ambient-v2-drill";
import type { HeatmapPayload } from "@/lib/engine/types";
import { avgWatchSeconds } from "../avg-watch";
import { audienceOf, sceneEndShareAt, sceneIndexAt, watchingAt } from "../curve";
import { groupName, timecode } from "../format";
import { groupSections, groupWord, groupsAt } from "../group-state";
import { headlineOf } from "../headline";
import type { Audience, ResultRow } from "../types";
import { verdictOf } from "../verdict";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import ending from "./fixtures/ending.json";
import holds from "./fixtures/holds.json";
import leak from "./fixtures/leak.json";
import middle from "./fixtures/middle.json";
import noAudience from "./fixtures/no-audience.json";
import noGroups from "./fixtures/no-groups.json";
import opening from "./fixtures/opening.json";

const row = (r: unknown) => r as ResultRow;
const RUNS = { early, middle, opening, leak, holds, ending } as const;
type RunName = keyof typeof RUNS;
const NAMES = Object.keys(RUNS) as RunName[];
const audience = (name: RunName): Audience => {
  const a = audienceOf(row(RUNS[name]));
  if (!a) throw new Error(`fixture ${name} has no audience`);
  return a;
};

/** What the endpoint puts in place of a missing heatmap (`synthHeatmap` in api/analysis/[id]). */
const synthesized = (): HeatmapPayload => ({
  segments: Array.from({ length: 10 }, (_, idx) => ({
    idx,
    t_start: idx * 3,
    t_end: (idx + 1) * 3,
    is_hook_zone: idx < 1,
    keyframe_uri: null,
  })),
  personas: Array.from({ length: 10 }, (_, i) => ({
    id: `persona-${i}`,
    slot_type: "fyp" as const,
    attentions: Array.from({ length: 10 }, () => 0.5),
    swipe_predicted_at: i < 3 ? 6 : null,
    segment_reasons: {},
  })),
  weighted_curve: Array.from({ length: 10 }, () => 0.5),
  weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  weights_source: "default",
});

describe("audienceOf: the still-watching line", () => {
  it("starts at 100% and has one point at the end of each scene", () => {
    const a = audience("early");
    expect(a.clipS).toBe(29);
    expect(a.scenes.map((s) => [s.t0, s.t1])).toEqual([[0, 2], [2, 3], [3, 7], [7, 14], [14, 21], [21, 24], [24, 29]]);
    const expected = [[0, 100], [2, 100], [3, 70.8], [7, 56.2], [14, 46.1], [21, 46.1], [24, 46.1], [29, 46.1]];
    expect(a.points).toHaveLength(expected.length);
    a.points.forEach(([t, pct], i) => {
      expect(t).toBe(expected[i]![0]);
      expect(pct).toBeCloseTo(expected[i]![1]!, 1);
    });
  });

  it.each(NAMES)("agrees with the engine's own share per scene (%s)", (name) => {
    const a = audience(name);
    const engine = retentionCurveOf(row(RUNS[name]).heatmap as HeatmapPayload);
    expect(engine).not.toBeNull();
    expect(a.points.slice(1).map(([, pct]) => pct / 100)).toEqual(engine!.map((v) => expect.closeTo(v, 6)));
  });

  it("weighs viewers as the engine does: six heavy ones, four light ones", () => {
    const a = audience("early");
    expect(a.viewers).toHaveLength(10);
    expect(a.viewers.filter((v) => v.heavy)).toHaveLength(6);
    expect(a.viewers.find((v) => v.group === "tough_crowd")!.weight).toBeCloseTo(14.6, 1);
    expect(a.viewers.find((v) => v.group === "cross_niche_curiosity")!.weight).toBeCloseTo(1.1, 1);
    expect(a.viewers.reduce((sum, v) => sum + v.weight, 0)).toBeCloseTo(100, 6);
  });

  it("keeps a run with eight groups: four heavy viewers, one group three times", () => {
    const a = audience("leak");
    expect(a.viewers.filter((v) => v.heavy)).toHaveLength(4);
    expect(a.viewers.filter((v) => v.group === "loyalist")).toHaveLength(3);
    expect(new Set(a.viewers.map((v) => v.group)).size).toBe(8);
  });

  it("records the scene each viewer leaves in, or none", () => {
    const a = audience("early");
    const left = Object.fromEntries(a.viewers.map((v) => [v.group, v.leftScene]));
    expect(left).toMatchObject({ tough_crowd: 1, purposeful_viewer: 1, saver: 2, niche_deep_buyer: 3, lurker: null, loyalist: null });
  });

  it("carries each scene's description and has no frame when the address is gone", () => {
    const a = audience("early");
    expect(a.scenes[1]!.description).toMatch(/^Motorcycle drives into deep mud puddle/);
    expect(a.scenes.every((s) => s.frame === null)).toBe(true);
  });

  it("takes a scene's frame from the filmstrip when it has an address", () => {
    const withFrames = {
      ...row(early),
      variants: { filmstrip_segments: [{ idx: 1, keyframe_uri: "https://frames.test/1.jpg" }] },
    };
    const a = audienceOf(withFrames)!;
    expect(a.scenes[1]!.frame).toBe("https://frames.test/1.jpg");
    expect(a.scenes[0]!.frame).toBeNull();
  });
});

describe("audienceOf: runs without an audience the page can show", () => {
  it("is null for a run that came back without simulated viewers", () => {
    expect(audienceOf(row(noAudience))).toBeNull();
  });

  it("is null for the heatmap the endpoint makes up when none is stored", () => {
    expect(audienceOf({ id: "x", heatmap: synthesized() })).toBeNull();
  });

  it("is null for an old run whose viewers carry no group", () => {
    expect(audienceOf(row(noGroups))).toBeNull();
  });

  it("is null for nothing at all", () => {
    expect(audienceOf(null)).toBeNull();
    expect(audienceOf(undefined)).toBeNull();
  });
});

describe("reading the line at a time", () => {
  it("joins the points with straight lines", () => {
    const { points } = audience("early");
    expect(watchingAt(points, 0)).toBe(100);
    expect(watchingAt(points, 2.5)).toBeCloseTo(85.4, 1);
    expect(watchingAt(points, 29)).toBeCloseTo(46.1, 1);
    expect(watchingAt(points, 400)).toBeCloseTo(46.1, 1);
  });

  it("finds the scene under a time; the clip's end belongs to the last scene", () => {
    const { scenes } = audience("early");
    expect(sceneIndexAt(scenes, 0)).toBe(0);
    expect(sceneIndexAt(scenes, 2)).toBe(1);
    expect(sceneIndexAt(scenes, 2.5)).toBe(1);
    expect(sceneIndexAt(scenes, 29)).toBe(6);
    expect(sceneIndexAt(scenes, -3)).toBe(0);
  });

  it("gives the readout a stored value: the share at the end of the scene under the playhead", () => {
    const a = audience("early");
    expect(sceneEndShareAt(a, 2.5)).toEqual({ pct: 71, at: 3 });
    expect(sceneEndShareAt(a, 0.4)).toEqual({ pct: 100, at: 2 });
  });
});

describe("headlineOf: the one number", () => {
  it.each([["early", 46], ["middle", 46], ["opening", 71], ["leak", 48], ["holds", 84], ["ending", 0]] as const)(
    "%s: %i%% watch to the end",
    (name, value) => {
      const a = audience(name);
      expect(headlineOf(a)).toEqual({ value, label: "watch to the end" });
      expect(headlineOf(a).value).toBe(Math.round(a.points[a.points.length - 1]![1]));
    },
  );
});

describe("verdictOf: the sentence, counted in viewers", () => {
  it.each([
    ["early", "A third leave by 0:03.", "early", 1],
    ["middle", "Half leave by 0:17.", "middle", 2],
    ["opening", "A third leave in the first 3 seconds.", "opening", 0],
    ["ending", "Most leave by 0:29.", "ending", 4],
    ["leak", "They leave bit by bit.", "leak", null],
    ["holds", "Most watch to the end.", "holds", null],
  ] as const)("%s: %s", (name, sentence, kind, scene) => {
    expect(verdictOf(audience(name))).toEqual({ sentence, kind, scene });
  });

  it("says they watch to the end when nobody leaves", () => {
    const a = audience("holds");
    const nobodyLeaves: Audience = {
      ...a,
      viewers: a.viewers.map((v) => ({ ...v, leftScene: null })),
      points: a.points.map(([t]) => [t, 100] as const),
    };
    expect(verdictOf(nobodyLeaves)).toEqual({ sentence: "They watch to the end.", kind: "holds", scene: null });
  });

  it("does not name a scene that only one heavy viewer leaves in", () => {
    // holds: one heavy viewer leaves in scene 1 (15 points), nobody else heavy.
    expect(verdictOf(audience("holds")).scene).toBeNull();
  });
});

describe("avgWatchSeconds: a scene's loss is spread over that scene", () => {
  it.each([["early", 15.9], ["middle", 19.8], ["opening", 86.1], ["leak", 16.6], ["holds", 31.9], ["ending", 18.7]] as const)(
    "%s: %f s",
    (name, seconds) => {
      expect(avgWatchSeconds(audience(name))).toBeCloseTo(seconds, 1);
    },
  );
});

describe("groupsAt: ten groups, by weight", () => {
  it("lists the ten groups in the app's order with their names", () => {
    const a = audience("early");
    const rows = groupsAt(a, verdictOf(a), a.clipS);
    expect(rows.map((r) => r.name)).toEqual([
      "Commenters", "Savers", "Quiet watchers", "Sharers", "Tough crowd",
      "Purposeful viewers", "Deep fans", "Scouts", "Regulars", "Passers-by",
    ]);
  });

  it("at rest: who left (earliest first) and who stayed", () => {
    const a = audience("early");
    const { left, stayed, absent } = groupSections(groupsAt(a, verdictOf(a), a.clipS));
    expect(left.map((r) => [r.group, r.leftBy])).toEqual([
      ["tough_crowd", 3], ["purposeful_viewer", 3], ["saver", 7],
      ["niche_deep_buyer", 14], ["niche_deep_scout", 14], ["cross_niche_curiosity", 14],
    ]);
    expect(stayed.map((r) => r.group)).toEqual(["high_engager", "lurker", "sharer", "loyalist"]);
    expect(absent).toEqual([]);
    expect(left.every((r) => r.status === "left" && r.lit === 0)).toBe(true);
    expect(stayed.every((r) => r.status === "watching" && r.lit === 1)).toBe(true);
  });

  it("marks the groups that leave in the scene the sentence names", () => {
    const a = audience("early");
    const rows = groupsAt(a, verdictOf(a), a.clipS);
    expect(rows.filter((r) => r.named).map((r) => r.group)).toEqual(["tough_crowd", "purposeful_viewer"]);
  });

  it("empties a wedge when the playhead passes the END of the scene its viewer leaves in", () => {
    const a = audience("early");
    const v = verdictOf(a);
    const tough = (t: number) => groupsAt(a, v, t).find((r) => r.group === "tough_crowd")!;
    expect(tough(2.9)).toMatchObject({ status: "watching", lit: 1 });
    expect(tough(3)).toMatchObject({ status: "left", lit: 0 });
  });

  it("tells heavy groups from light ones and carries no head count", () => {
    const a = audience("early");
    const rows = groupsAt(a, verdictOf(a), a.clipS);
    expect(rows.filter((r) => r.heavy).map((r) => r.group)).toEqual([
      "high_engager", "saver", "lurker", "sharer", "tough_crowd", "purposeful_viewer",
    ]);
  });

  it("shows a group that is not in the run as absent", () => {
    const a = audience("leak");
    const { absent, stayed } = groupSections(groupsAt(a, verdictOf(a), a.clipS));
    expect(absent.map((r) => r.group)).toEqual(["sharer", "purposeful_viewer"]);
    expect(absent.every((r) => r.status === "absent" && !r.present)).toBe(true);
    // one group three times: its weight is the three viewers together
    expect(stayed.find((r) => r.group === "loyalist")!.weight).toBeCloseTo(9, 0);
  });

  it("is 'leaving' while only some of a group's viewers are gone", () => {
    const a = audience("leak");
    let seen = 0;
    const split: Audience = {
      ...a,
      viewers: a.viewers.map((v) => (v.group === "loyalist" && seen++ === 0 ? { ...v, leftScene: 0 } : v)),
    };
    const regulars = groupsAt(split, verdictOf(split), split.clipS).find((r) => r.group === "loyalist")!;
    expect(regulars.status).toBe("leaving");
    expect(regulars.lit).toBeCloseTo(2 / 3, 5);
    expect(regulars.leftBy).toBeNull();
    // Not "Watching" and not "To the end": one of its viewers is gone.
    expect(groupWord(regulars, 1, split.clipS)).toBe("Some left");
    expect(groupWord(regulars, split.clipS, split.clipS)).toBe("Some left");
  });

  it("words a row by where the playhead is", () => {
    const a = audience("early");
    const v = verdictOf(a);
    const word = (group: string, t: number) => groupWord(groupsAt(a, v, t).find((r) => r.group === group)!, t, a.clipS);
    expect(word("tough_crowd", 29)).toBe("Left by 0:03");
    expect(word("tough_crowd", 1)).toBe("Watching");
    expect(word("lurker", 10)).toBe("Watching");
    expect(word("lurker", 29)).toBe("To the end");
    const b = audience("leak");
    const out = groupsAt(b, verdictOf(b), 0).find((r) => r.group === "sharer")!;
    expect(groupWord(out, 0, b.clipS)).toBe("Not in this run");
  });
});

describe("videoStateOf: the one object the page renders from", () => {
  it("is 'loading' before the run has arrived", () => {
    expect(videoStateOf(undefined)).toEqual({ kind: "loading" });
  });

  it("is 'running' while the run is in flight", () => {
    expect(videoStateOf({ id: "x", processing: true, heatmap: null })).toEqual({
      kind: "running",
      id: "x",
      startedAt: null,
    });
  });

  it("is 'no-audience' for a finished run without simulated viewers, and carries no score", () => {
    const state = videoStateOf(row(noAudience));
    expect(state).toEqual({ kind: "no-audience", id: "fixture-no-audience", title: "Video", videoPath: null });
  });

  it("is 'no-audience' when the endpoint made the heatmap up", () => {
    expect(videoStateOf({ id: "x", heatmap: synthesized() }).kind).toBe("no-audience");
  });

  it("builds the result: title, number, sentence, the moment, average watch, what viewers do", () => {
    const state = videoStateOf(row(early));
    if (state.kind !== "result") throw new Error("expected a result");
    const m = state.model;
    expect(m.id).toBe("fixture-early");
    expect(m.title).toBe("Video · 0:29");
    expect(m.headline).toEqual({ value: 46, label: "watch to the end" });
    expect(m.verdict.sentence).toBe("A third leave by 0:03.");
    expect(m.moment?.index).toBe(1);
    expect(m.moment?.description).toMatch(/^Motorcycle drives into deep mud puddle/);
    expect(m.avgWatchS).toBeCloseTo(15.9, 1);
    expect(m.intents?.map((i) => [i.label, Math.round(i.value)])).toEqual([
      ["Share", 48], ["Comment", 30], ["Rewatch", 19], ["Save", 13],
    ]);
  });

  it("has no moment when the sentence names no scene", () => {
    const state = videoStateOf(row(leak));
    if (state.kind !== "result") throw new Error("expected a result");
    expect(state.model.moment).toBeNull();
  });

  it("has no intents when the run stored none", () => {
    const state = videoStateOf({ ...row(early), persona_behavioral_aggregate: null });
    if (state.kind !== "result") throw new Error("expected a result");
    expect(state.model.intents).toBeNull();
  });

  it("offers the stored video only for an uploaded or linked video", () => {
    const path = (r: Partial<ResultRow>) => {
      const s = videoStateOf({ ...row(early), ...r });
      return s.kind === "result" ? s.model.videoPath : undefined;
    };
    expect(path({ input_mode: "video_upload", video_storage_path: "u1/a.mp4" })).toBe("u1/a.mp4");
    expect(path({ input_mode: "tiktok_url", video_storage_path: "u1/b.mp4" })).toBe("u1/b.mp4");
    expect(path({ input_mode: "text", video_storage_path: "u1/c.mp4" })).toBeNull();
    expect(path({ input_mode: "video_upload", video_storage_path: null })).toBeNull();
  });

  it("drops a scene description that is not one", () => {
    const hm = row(early).heatmap as HeatmapPayload;
    const broken = { ...row(early), heatmap: { ...hm, segments: hm.segments.map((s) => (s.idx === 1 ? { ...s, label: "INSTRUCTION: describe the scene" } : s)) } };
    const state = videoStateOf(broken);
    if (state.kind !== "result") throw new Error("expected a result");
    expect(state.model.moment?.description).toBeNull();
  });
});

describe("format", () => {
  it("writes a time as m:ss", () => {
    expect(timecode(3)).toBe("0:03");
    expect(timecode(28.6)).toBe("0:29");
    expect(timecode(121)).toBe("2:01");
    expect(timecode(-4)).toBe("0:00");
  });

  it("writes group names in sentence case", () => {
    expect(groupName("tough_crowd")).toBe("Tough crowd");
    expect(groupName("lurker")).toBe("Quiet watchers");
    expect(groupName("cross_niche_curiosity")).toBe("Passers-by");
  });
});

describe("edge cases found in review (2026-11-20)", () => {
  it("draws a run that has a single scene", () => {
    const hm = row(early).heatmap as HeatmapPayload;
    const leavers = new Set(["tough_crowd", "purposeful_viewer"]);
    const oneScene = {
      ...row(early),
      heatmap: {
        ...hm,
        segments: hm.segments.slice(0, 1),
        personas: hm.personas.map((p) => ({
          ...p,
          attentions: p.attentions.slice(0, 1),
          swipe_predicted_at: leavers.has(p.archetype ?? "") ? 0 : null,
        })),
      },
    };
    const a = audienceOf(oneScene);
    expect(a).not.toBeNull();
    expect(a!.points.map(([t]) => t)).toEqual([0, 2]);
    expect(a!.points[1]![1]).toBeCloseTo(70.8, 1);
    expect(headlineOf(a!).value).toBe(71);
    expect(verdictOf(a!).sentence).toBe("A third leave in the first 2 seconds.");
  });

  it("a run still in flight after six minutes has stalled: the pipeline died", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    const startedAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
    // A run in flight carries its start, for the running screen's clock.
    expect(videoStateOf({ id: "x", processing: true, created_at: startedAgo(1) }, now)).toEqual({
      kind: "running",
      id: "x",
      startedAt: now - 60_000,
    });
    expect(videoStateOf({ id: "x", processing: true, created_at: startedAgo(7) }, now)).toEqual({ kind: "stalled", id: "x" });
    // Without a start time nothing can be said: it keeps running.
    expect(videoStateOf({ id: "x", processing: true }, now)).toEqual({ kind: "running", id: "x", startedAt: null });
  });

  it("a group whose viewers carry no weight still shows whether they watch", () => {
    const a = audience("early");
    const weightless: Audience = {
      ...a,
      viewers: a.viewers.map((v) => (v.group === "loyalist" ? { ...v, weight: 0, heavy: false } : v)),
    };
    const regulars = groupsAt(weightless, verdictOf(weightless), weightless.clipS).find((r) => r.group === "loyalist")!;
    expect(regulars).toMatchObject({ present: true, status: "watching", lit: 1, leftBy: null });
  });
});
