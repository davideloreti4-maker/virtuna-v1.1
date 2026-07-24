/**
 * GENERAL_BASELINE_SIGNATURE — the generic baseline that lets an UNCALIBRATED (General) audience
 * flow the Audience Sim v2 population projection, so a new user lands on the same Population room a
 * calibrated audience shows. These tests prove it is (a) structurally valid for the population math,
 * (b) a sensible baseline (not degenerate/random), and (c) honest about being generic.
 */

import { describe, it, expect } from "vitest";
import {
  GENERAL_BASELINE_SIGNATURE,
  GENERAL_TOPIC_VOCAB,
} from "../general-baseline-signature";
import {
  signatureHasPopulationAxes,
  reactPopulation,
  type ContentVector,
} from "../population";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";

describe("GENERAL_BASELINE_SIGNATURE", () => {
  const sig = GENERAL_BASELINE_SIGNATURE;

  it("passes the population-axes guard (topic_vocab + ≥1 scored persona)", () => {
    // This is the exact gate the react route uses to decide General shows a Population room.
    expect(signatureHasPopulationAxes(sig)).toBe(true);
  });

  it("carries all 10 fixed archetypes, each with scored reaction axes, shares summing to 1", () => {
    const personas = sig.audience.personas;
    expect(personas).toHaveLength(10);
    expect(new Set(personas.map((p) => p.archetype)).size).toBe(10);
    for (const a of ARCHETYPES) {
      expect(personas.some((p) => p.archetype === a)).toBe(true);
    }
    for (const p of personas) {
      expect(p.reaction).toBeDefined();
      for (const v of [
        p.reaction!.hookSensitivity,
        p.reaction!.noveltyBias,
        p.reaction!.skepticism,
        p.reaction!.attentionSpan,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      // interests reference ONLY topic_vocab tags (the shared vocabulary contract).
      for (const k of Object.keys(p.reaction!.interests)) {
        expect(GENERAL_TOPIC_VOCAB).toContain(k);
      }
    }
    const shareSum = personas.reduce((s, p) => s + p.share, 0);
    expect(shareSum).toBeCloseTo(1, 2);
  });

  it("produces a real, differentiated population distribution (not degenerate)", () => {
    // A generic-but-strong hook: broadly appealing, arresting open, honest.
    const strong: ContentVector = {
      topics: { relatable: 0.7, humor: 0.6, story: 0.5 },
      hookStrength: 0.8,
      novelty: 0.5,
      hype: 0.1,
      slowness: 0.2,
    };
    // A weak, over-hyped, slow one.
    const weak: ContentVector = {
      topics: { educational: 0.2 },
      hookStrength: 0.2,
      novelty: 0.5,
      hype: 0.9,
      slowness: 0.9,
    };

    const strongAgg = reactPopulation(sig, strong);
    const weakAgg = reactPopulation(sig, weak);

    // Real per-individual distribution over ~1,000 sampled reactors.
    expect(strongAgg.total).toBeGreaterThan(500);
    expect(strongAgg.segments.length).toBe(10);
    // Not degenerate: neither everyone stops nor everyone scrolls.
    expect(strongAgg.stopPct).toBeGreaterThan(0);
    expect(strongAgg.stopPct).toBeLessThan(100);
    // The baseline discriminates content — a strong hook beats a weak/hyped/slow one.
    expect(strongAgg.stopPct).toBeGreaterThan(weakAgg.stopPct);
    // A determinstic "why" tally exists for the stoppers.
    expect(strongAgg.reasons.length).toBeGreaterThan(0);
  });

  it("is deterministic — same content ⇒ byte-identical aggregate", () => {
    const c: ContentVector = {
      topics: { satisfying: 0.6, novelty: 0.4 },
      hookStrength: 0.6,
      novelty: 0.5,
      hype: 0.3,
      slowness: 0.4,
    };
    expect(reactPopulation(sig, c)).toEqual(reactPopulation(sig, c));
  });

  it("stays HONEST that it is a generic, uncalibrated baseline (no fabricated provenance)", () => {
    expect(sig.provenance.videos_analyzed).toBe(0);
    expect(sig.provenance.videos_watched).toBe(0);
    expect(sig.summary.toLowerCase()).toContain("baseline");
    // No persona claims a real evidence quote — every one is the honest baseline marker.
    for (const p of sig.audience.personas) {
      expect(p.evidence.toLowerCase()).toContain("baseline");
    }
  });
});
