/**
 * The `/ambient-v2` LIVE template must stand for the real mount, not a thinner cousin of it.
 *
 * It was thinner: the fixture built its population with no `actionIntent`, so the review page hid
 * "Projected reaction" — a card `AmbientOverviewRail` renders on every sealed video. Every judgement
 * made from that page (including the owner's parity review, 2026-08-04) was made against a surface
 * missing a card production ships. These tests pin the two things that let that happen:
 *   1. the fold panel reaches `buildPopulationFrameData`, and
 *   2. the hand-carried behavioral aggregate is still what the REAL aggregator emits for the cast.
 * (2) matters because the aggregator is deliberately not imported by the fixture — it drags the niche
 * taxonomy into a client bundle — so this file is the only thing standing between those five numbers
 * and quiet drift into invention.
 */

import { describe, expect, it } from "vitest";
import {
  CREATOR_LIVE_TEMPLATE,
  CREATOR_LIVE_TEXT_TEMPLATE,
  LIVE_BEHAVIORAL,
  LIVE_BRAIN_INPUT,
  LIVE_FOLD_CAST,
} from "../detail-live-fixture";
import { aggregatePersonaResults } from "@/lib/engine/wave3/aggregator";

describe("the LIVE dev fixture stands for the real mount", () => {
  it("carries the fold's action intents, so Engagement shows the card production shows", () => {
    const intent = CREATOR_LIVE_TEMPLATE.population?.actionIntent;
    expect(intent).toBeTruthy();
    // four verbs, each a 0–100 index — the section the seal's `intents` unlock
    expect(intent!.rows.map((r) => r.label).sort()).toEqual(["comment", "rewatch", "save", "share"]);
    expect(intent!.rows.every((r) => r.value >= 0 && r.value <= 100)).toBe(true);
    // headcounts are off the real cast, never rounded up out of it
    expect(intent!.total).toBe(LIVE_FOLD_CAST.length);
    expect(intent!.actors + intent!.inert).toBe(LIVE_FOLD_CAST.length);
  });

  it("keeps the behavioral aggregate equal to what the real aggregator emits for the cast", () => {
    const { aggregate } = aggregatePersonaResults(LIVE_FOLD_CAST);
    expect(aggregate).toBeTruthy();
    expect(aggregate!.completion_pct).toBeCloseTo(LIVE_BEHAVIORAL.completion_pct, 6);
    expect(aggregate!.share_pct).toBeCloseTo(LIVE_BEHAVIORAL.share_pct, 6);
    expect(aggregate!.save_pct).toBeCloseTo(LIVE_BEHAVIORAL.save_pct, 6);
    expect(aggregate!.comment_pct).toBeCloseTo(LIVE_BEHAVIORAL.comment_pct, 6);
    expect(aggregate!.loop_pct).toBeCloseTo(LIVE_BEHAVIORAL.loop_pct!, 6);
  });

  it("describes ONE room — the fold cast's bail times are the heatmap's swipe times", () => {
    const swipes = LIVE_BRAIN_INPUT.heatmap!.personas!.map((p) => p.swipe_predicted_at ?? 0);
    expect(LIVE_FOLD_CAST.map((p) => p.scroll_past_second)).toEqual(swipes);
    // and a stayer watched it through, while a bailer's watch-through is its bail second over 12s
    for (const [i, p] of LIVE_FOLD_CAST.entries()) {
      const expected = swipes[i] === 0 ? 100 : Math.round((swipes[i]! / 12) * 100);
      expect(p.watch_through_pct).toBe(expected);
    }
  });

  it("leaves the TEXT sim without an action axis — a binary verdict has no verbs to report", () => {
    // §3.3: text is an inverse instrument, not a video screen with empty slots. Absence is the answer.
    expect(CREATOR_LIVE_TEXT_TEMPLATE.population?.actionIntent).toBeUndefined();
  });
});
