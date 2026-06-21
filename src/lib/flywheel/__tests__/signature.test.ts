/**
 * signature.test.ts — TDD RED/GREEN for predictedSignature + realizedSignature (10-01 Task 1).
 *
 * The flywheel's deterministic signature core (FLYWHEEL-02). Both functions are pure:
 * same input → byte-identical output, no Date/random, no I/O.
 *
 * Covers:
 *  - predictedSignature: fixed personas → exact predicted vector
 *  - predictedSignature: all-scroll → all-zero, no NaN
 *  - predictedSignature: unknown archetype skipped (never fabricated)
 *  - predictedSignature: determinism (same input twice → identical)
 *  - realizedSignature: a missing channel is EXCLUDED (not zero-filled — Pitfall 3)
 *  - realizedSignature: normalizes across PRESENT channels only
 *  - realizedSignature: per-channel provenance preserved
 *  - realizedSignature: all-null channels → empty vector, no NaN
 */

import { describe, it, expect } from "vitest";
import { DISPOSITIONS, predictedSignature } from "../signature";
import { realizedSignature, type RealizedMetrics } from "../realized-signature";
import type { FlashPersona } from "@/lib/engine/flash/flash-schema";
import type { Disposition } from "@/lib/audience/audience-types";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const persona = (archetype: string, verdict: "stop" | "scroll"): FlashPersona => ({
  archetype,
  verdict,
  quote: "x",
});

// ─── predictedSignature ──────────────────────────────────────────────────────────

describe("DISPOSITIONS", () => {
  it("is the 6-element ordered disposition array", () => {
    expect(DISPOSITIONS).toEqual([
      "scanner",
      "skeptic",
      "collector",
      "connector",
      "converter",
      "lurker",
    ]);
  });
});

describe("predictedSignature", () => {
  it("derives an exact normalized share vector from STOP verdicts via the lens", () => {
    // saver→collector(stop), sharer→connector(stop), high_engager→connector(stop),
    // tough_crowd→skeptic(scroll, ignored), niche_deep_buyer→converter(stop)
    const personas: FlashPersona[] = [
      persona("saver", "stop"), // collector
      persona("sharer", "stop"), // connector
      persona("high_engager", "stop"), // connector
      persona("niche_deep_buyer", "stop"), // converter
      persona("tough_crowd", "scroll"), // skeptic — scroll, excluded
    ];
    const sig = predictedSignature(personas);
    // 4 stops total: collector 1/4, connector 2/4, converter 1/4
    expect(sig.collector).toBeCloseTo(0.25, 10);
    expect(sig.connector).toBeCloseTo(0.5, 10);
    expect(sig.converter).toBeCloseTo(0.25, 10);
    expect(sig.scanner).toBe(0);
    expect(sig.skeptic).toBe(0);
    expect(sig.lurker).toBe(0);
    // shares sum to 1.0
    const sum = DISPOSITIONS.reduce((a, d) => a + sig[d], 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("returns an all-zero vector with NO NaN when every persona scrolls", () => {
    const personas: FlashPersona[] = [
      persona("saver", "scroll"),
      persona("sharer", "scroll"),
    ];
    const sig = predictedSignature(personas);
    for (const d of DISPOSITIONS) {
      expect(sig[d]).toBe(0);
      expect(Number.isNaN(sig[d])).toBe(false);
    }
  });

  it("skips an unknown archetype rather than fabricating a disposition", () => {
    const personas: FlashPersona[] = [
      persona("saver", "stop"), // collector — counted
      persona("not_a_real_archetype", "stop"), // unknown — skipped, never fabricated
    ];
    const sig = predictedSignature(personas);
    // only the collector stop counts → collector share is 1.0
    expect(sig.collector).toBe(1);
    const sum = DISPOSITIONS.reduce((a, d) => a + sig[d], 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("is deterministic — identical input yields identical output", () => {
    const personas: FlashPersona[] = [
      persona("saver", "stop"),
      persona("loyalist", "stop"),
    ];
    expect(predictedSignature(personas)).toEqual(predictedSignature(personas));
  });

  it("returns all-zero (no NaN) for an empty persona array", () => {
    const sig = predictedSignature([]);
    for (const d of DISPOSITIONS) expect(sig[d]).toBe(0);
  });
});

// ─── realizedSignature ───────────────────────────────────────────────────────────

const ch = (
  value: number,
  source: "public_scrape" | "creator_supplied",
): { value: number; source: "public_scrape" | "creator_supplied" } => ({ value, source });

describe("realizedSignature", () => {
  it("excludes a null channel entirely — absent is NOT zero (Pitfall 3)", () => {
    const metrics: RealizedMetrics = {
      views: 1000,
      saves: ch(100, "public_scrape"), // collector present
      shares: ch(50, "public_scrape"), // connector present
      comments: null,
      watch_through_pct: null, // scanner/lurker absent
      link_clicks: null, // converter absent
    };
    const { vector } = realizedSignature(metrics);
    // only collector + connector are present
    expect(Object.keys(vector).sort()).toEqual(["collector", "connector"]);
    // absent channels are UNDEFINED, never 0
    expect(vector.converter).toBeUndefined();
    expect(vector.scanner).toBeUndefined();
    expect(vector.lurker).toBeUndefined();
  });

  it("normalizes across PRESENT channels only (shares sum to 1.0)", () => {
    const metrics: RealizedMetrics = {
      views: 1000,
      saves: ch(100, "public_scrape"), // rate 0.1
      shares: ch(100, "public_scrape"), // rate 0.1
      comments: null,
      watch_through_pct: null,
      link_clicks: null,
    };
    const { vector } = realizedSignature(metrics);
    // equal rates → equal shares across the 2 present channels
    expect(vector.collector).toBeCloseTo(0.5, 10);
    expect(vector.connector).toBeCloseTo(0.5, 10);
    const sum = (Object.values(vector) as number[]).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("preserves per-channel provenance", () => {
    const metrics: RealizedMetrics = {
      views: 1000,
      saves: ch(100, "public_scrape"),
      shares: null,
      comments: null,
      watch_through_pct: ch(70, "creator_supplied"),
      link_clicks: ch(20, "creator_supplied"),
    };
    const { provenance } = realizedSignature(metrics);
    expect(provenance.collector).toBe("public_scrape");
    expect(provenance.converter).toBe("creator_supplied");
    // watch_through maps to scanner + lurker (both creator_supplied)
    expect(provenance.scanner).toBe("creator_supplied");
    expect(provenance.lurker).toBe("creator_supplied");
  });

  it("returns an empty vector (no NaN) when all channels are null", () => {
    const metrics: RealizedMetrics = {
      views: 1000,
      saves: null,
      shares: null,
      comments: null,
      watch_through_pct: null,
      link_clicks: null,
    };
    const { vector, provenance } = realizedSignature(metrics);
    expect(Object.keys(vector)).toHaveLength(0);
    expect(Object.keys(provenance)).toHaveLength(0);
  });

  it("returns an empty vector when views is null or zero (no division by zero)", () => {
    const metrics: RealizedMetrics = {
      views: null,
      saves: ch(100, "public_scrape"),
      shares: null,
      comments: null,
      watch_through_pct: null,
      link_clicks: null,
    };
    const { vector } = realizedSignature(metrics);
    expect(Object.keys(vector)).toHaveLength(0);
    for (const k of Object.keys(vector) as Disposition[]) {
      expect(Number.isNaN(vector[k]!)).toBe(false);
    }
  });

  it("is deterministic — identical metrics yield identical output", () => {
    const metrics: RealizedMetrics = {
      views: 1000,
      saves: ch(100, "public_scrape"),
      shares: ch(40, "public_scrape"),
      comments: ch(30, "public_scrape"),
      watch_through_pct: ch(60, "creator_supplied"),
      link_clicks: ch(10, "creator_supplied"),
    };
    expect(realizedSignature(metrics)).toEqual(realizedSignature(metrics));
  });
});
