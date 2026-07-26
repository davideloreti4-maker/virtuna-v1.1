/**
 * verdict-seal.test.ts — the funnel wall's server-side seal (ONBOARDING-FUNNEL-DESIGN.md §0b②).
 *
 * The seal's contract: an anonymous session's responses carry NO reception read — the
 * attention curve (which contains the would-stop % itself), the fold cast, the action
 * intents, the engagement forecast, and the thread seals' verdict halves. The free craft
 * half survives untouched. Keying is strict `is_anonymous === true`: a missing claim reads
 * as a REAL user (sealing a legacy customer is the failure that matters).
 */

import { describe, it, expect } from "vitest";
import {
  isSealedVisitor,
  isSealedSimSeal,
  sealAnalysisPayload,
  sealSimSeals,
} from "@/lib/onboarding/verdict-seal";
import type { SimSealMap } from "@/lib/threads/sim-seals";
import type { HeatmapPayload } from "@/lib/engine/types";

// ─── isSealedVisitor — keying polarity ────────────────────────────────────────

describe("isSealedVisitor", () => {
  it("seals only an explicit is_anonymous: true", () => {
    expect(isSealedVisitor({ is_anonymous: true })).toBe(true);
  });

  it("a missing claim reads as a REAL user — never sealed", () => {
    // Legacy sessions carry no is_anonymous claim at all; sealing them would withhold
    // the product from every existing signed-up user.
    expect(isSealedVisitor({})).toBe(false);
    expect(isSealedVisitor({ is_anonymous: false })).toBe(false);
    expect(isSealedVisitor(null)).toBe(false);
    expect(isSealedVisitor(undefined)).toBe(false);
  });
});

// ─── sealAnalysisPayload — the reception read is stripped, the craft read survives ──

const HEATMAP: HeatmapPayload = {
  segments: [
    { idx: 0, t_start: 0, t_end: 2, label: "cold open", is_hook_zone: true, keyframe_uri: null },
    { idx: 1, t_start: 2, t_end: 4, label: "the claim", is_hook_zone: false, keyframe_uri: null },
  ],
  personas: [],
  weighted_curve: [0.82, 0.4],
  weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  weights_source: "default",
  weighted_completion_pct: 0.58,
  weighted_hook_score: 0.61,
};

function makeAnalysisPayload() {
  return {
    id: "an-1",
    overall_score: 74,
    confidence: 0.8,
    suggestions: [{ category: "hook_structure", priority: "high", text: "front-load the contrast" }],
    verbatim: { hook: { spoken_words: "I quit my 9-5", on_screen_text: null }, segments: [] },
    heatmap: HEATMAP,
    personas: [{ archetype: "skeptic", verdict: "scroll", quote: "gone before the point lands" }],
    persona_behavioral_aggregate: { share_pct: 30, save_pct: 20 },
    behavioral_predictions: { completion_pct: 55, share_pct: 12, comment_pct: 4, save_pct: 9 },
    predicted_engagement: { lo: 1000, hi: 4000, confidence: "medium", basis: "baseline" },
  };
}

describe("sealAnalysisPayload", () => {
  it("nulls every reception field — the verdict's entire derivation surface", () => {
    const sealed = sealAnalysisPayload(makeAnalysisPayload());
    // The attention curve carries weighted_hook_score — the would-stop % itself. It must
    // be ABSENT from the wire, not merely unrendered.
    expect(sealed.heatmap).toBeNull();
    expect(sealed.personas).toBeNull();
    expect(sealed.persona_behavioral_aggregate).toBeNull();
    expect(sealed.behavioral_predictions).toBeNull();
    expect(sealed.predicted_engagement).toBeNull();
  });

  it("stamps verdict_sealed so a sealed response is distinguishable from a degraded run", () => {
    const sealed = sealAnalysisPayload(makeAnalysisPayload());
    expect(sealed.verdict_sealed).toBe(true);
  });

  it("keeps the free craft half untouched", () => {
    const payload = makeAnalysisPayload();
    const sealed = sealAnalysisPayload(payload);
    expect(sealed.id).toBe("an-1");
    expect(sealed.overall_score).toBe(74);
    expect(sealed.suggestions).toEqual(payload.suggestions);
    expect(sealed.verbatim).toEqual(payload.verbatim);
  });

  it("returns a copy — the persisted/in-memory original is never mutated", () => {
    const payload = makeAnalysisPayload();
    sealAnalysisPayload(payload);
    expect(payload.heatmap).toEqual(HEATMAP);
    expect(payload.personas).toHaveLength(1);
  });
});

// ─── sealSimSeals — the thread store's wire form for an anonymous session ─────

function makeSeals(): SimSealMap {
  return {
    "an-1": {
      pct: 61,
      band: "Strong",
      at: "2026-07-26T12:00:00Z",
      population: {
        total: 1000,
        stop: 380,
        scroll: 620,
        stopPct: 38,
        segments: [],
        reasons: [{ reason: "too-slow", count: 253 }],
      },
      video: {
        analysisId: "an-1",
        stopPct: 61,
        craftScore: 74,
        heatmap: HEATMAP,
        videoSignals: { hook_visual_impact: 8, visual_production_quality: 7, pacing_score: 4, transition_quality: 3 },
        verbatim: { hook: { spoken_words: "I quit my 9-5", on_screen_text: null }, segments: [] },
        skimmedPct: 12,
        intents: {
          share: 38, save: 21, comment: 9, rewatch: 14, watchThroughPct: 55,
          total: 10, actors: 7, inert: 3, watchedButInert: 1,
        },
      },
    },
    "a concept someone typed": {
      pct: 44,
      band: "Mixed",
      at: "2026-07-26T12:05:00Z",
      population: { total: 1000, stop: 440, scroll: 560, stopPct: 44, segments: [], reasons: [] },
      personas: [{ archetype: "builder", verdict: "stop", quote: "pulled me in" }],
      scrollQuote: "took too long",
    },
  };
}

describe("sealSimSeals", () => {
  it("a video seal keeps exactly the free half: analysisId + craftScore", () => {
    const wire = sealSimSeals(makeSeals());
    expect(wire["an-1"]).toEqual({
      sealed: true,
      at: "2026-07-26T12:00:00Z",
      video: { analysisId: "an-1", craftScore: 74 },
    });
  });

  it("transmits NO verdict field on any entry — pct, population, curve, intents all absent", () => {
    const wire = sealSimSeals(makeSeals());
    for (const entry of Object.values(wire)) {
      const raw = JSON.stringify(entry);
      expect(raw).not.toContain("pct");
      expect(raw).not.toContain("population");
      expect(raw).not.toContain("weighted_curve");
      expect(raw).not.toContain("stopPct");
      expect(raw).not.toContain("intents");
      expect(raw).not.toContain("scrollQuote");
    }
  });

  it("omits concept seals entirely — a text verdict has no free half", () => {
    const wire = sealSimSeals(makeSeals());
    expect(wire["a concept someone typed"]).toBeUndefined();
    expect(Object.keys(wire)).toEqual(["an-1"]);
  });

  it("isSealedSimSeal narrows the wire union", () => {
    const wire = sealSimSeals(makeSeals());
    expect(isSealedSimSeal(wire["an-1"])).toBe(true);
    expect(isSealedSimSeal(makeSeals()["an-1"])).toBe(false);
    expect(isSealedSimSeal(undefined)).toBe(false);
  });
});
