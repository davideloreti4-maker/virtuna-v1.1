/**
 * Phase 7 Plan 01 — Temperature×Disposition label lens tests (D-02).
 *
 * RED phase: these tests will fail until temperature-disposition.ts is implemented.
 * Assertions:
 *  - TEMPERATURE_DISPOSITION covers all 10 ARCHETYPES (regression guard if 11th added)
 *  - temperature ∈ {'cold','warm','hot'}
 *  - disposition ∈ {'scanner','skeptic','collector','connector','converter','lurker'}
 *  - Each archetype maps to the locked table from RESEARCH.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { TEMPERATURE_DISPOSITION, labelForArchetype } from "../temperature-disposition";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";

const TEMP_DISPOSITION_SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../temperature-disposition.ts"),
  "utf8",
);

/** Low-intent / "scrolls past" dispositions — feed who-it's-NOT-for (D-10). */
const LOW_DISPOSITIONS = new Set(["skeptic", "lurker", "scanner"]);
/** Hot / "stopped the scroll" dispositions — feed verbatim grouping (D-11). */
const HOT_DISPOSITIONS = new Set(["converter", "connector", "collector"]);

const VALID_TEMPERATURES = new Set(["cold", "warm", "hot"]);
const VALID_DISPOSITIONS = new Set(["scanner", "skeptic", "collector", "connector", "converter", "lurker"]);

describe("TEMPERATURE_DISPOSITION — label lens covers all 10 archetypes", () => {
  it("no archetype is unmapped (regression guard)", () => {
    for (const archetype of ARCHETYPES) {
      const label = TEMPERATURE_DISPOSITION[archetype];
      expect(label, `archetype '${archetype}' is not mapped`).toBeDefined();
    }
  });

  it("temperature values are constrained to cold/warm/hot", () => {
    for (const archetype of ARCHETYPES) {
      const { temperature } = TEMPERATURE_DISPOSITION[archetype];
      expect(
        VALID_TEMPERATURES.has(temperature),
        `archetype '${archetype}' temperature '${temperature}' is invalid`,
      ).toBe(true);
    }
  });

  it("disposition values are constrained to allowed set", () => {
    for (const archetype of ARCHETYPES) {
      const { disposition } = TEMPERATURE_DISPOSITION[archetype];
      expect(
        VALID_DISPOSITIONS.has(disposition),
        `archetype '${archetype}' disposition '${disposition}' is invalid`,
      ).toBe(true);
    }
  });

  it("exactly 10 archetypes mapped (no extras)", () => {
    expect(Object.keys(TEMPERATURE_DISPOSITION)).toHaveLength(ARCHETYPES.length);
  });
});

// W0 (08-01) — the lens must be MEANINGFUL: a real spread so who-it's-NOT-for (D-10)
// can name a "scrolls past" segment and verbatim grouping (D-11) has a hot cluster.
describe("TEMPERATURE_DISPOSITION — meaningful spread (W0 / D-10 + D-11)", () => {
  const labels = ARCHETYPES.map((a) => TEMPERATURE_DISPOSITION[a]);

  it("at least 2 archetypes carry a low/negative disposition (who-it's-NOT-for, D-10)", () => {
    const lowCount = labels.filter((l) => LOW_DISPOSITIONS.has(l.disposition)).length;
    expect(lowCount).toBeGreaterThanOrEqual(2);
  });

  it("at least 2 archetypes carry a hot/positive disposition (verbatim cluster, D-11)", () => {
    const hotCount = labels.filter(
      (l) => l.temperature === "hot" && HOT_DISPOSITIONS.has(l.disposition),
    ).length;
    expect(hotCount).toBeGreaterThanOrEqual(2);
  });

  it("source carries NO [ASSUMED] marker — W0 locked the lens values", () => {
    expect(TEMP_DISPOSITION_SOURCE).not.toMatch(/\[ASSUMED\]/i);
  });
});

describe("TEMPERATURE_DISPOSITION — locked mapping from RESEARCH.md", () => {
  it("tough_crowd → cold / skeptic", () => {
    expect(TEMPERATURE_DISPOSITION.tough_crowd).toEqual({ temperature: "cold", disposition: "skeptic" });
  });

  it("lurker → cold / lurker", () => {
    expect(TEMPERATURE_DISPOSITION.lurker).toEqual({ temperature: "cold", disposition: "lurker" });
  });

  it("high_engager → warm / connector", () => {
    expect(TEMPERATURE_DISPOSITION.high_engager).toEqual({ temperature: "warm", disposition: "connector" });
  });

  it("saver → warm / collector", () => {
    expect(TEMPERATURE_DISPOSITION.saver).toEqual({ temperature: "warm", disposition: "collector" });
  });

  it("sharer → warm / connector", () => {
    expect(TEMPERATURE_DISPOSITION.sharer).toEqual({ temperature: "warm", disposition: "connector" });
  });

  it("purposeful_viewer → warm / scanner", () => {
    expect(TEMPERATURE_DISPOSITION.purposeful_viewer).toEqual({ temperature: "warm", disposition: "scanner" });
  });

  it("niche_deep_buyer → hot / converter", () => {
    expect(TEMPERATURE_DISPOSITION.niche_deep_buyer).toEqual({ temperature: "hot", disposition: "converter" });
  });

  it("niche_deep_scout → hot / skeptic", () => {
    expect(TEMPERATURE_DISPOSITION.niche_deep_scout).toEqual({ temperature: "hot", disposition: "skeptic" });
  });

  it("loyalist → hot / connector", () => {
    expect(TEMPERATURE_DISPOSITION.loyalist).toEqual({ temperature: "hot", disposition: "connector" });
  });

  it("cross_niche_curiosity → cold / scanner", () => {
    expect(TEMPERATURE_DISPOSITION.cross_niche_curiosity).toEqual({ temperature: "cold", disposition: "scanner" });
  });
});

describe("labelForArchetype — convenience accessor", () => {
  it("returns defined object for every archetype", () => {
    for (const archetype of ARCHETYPES) {
      const label = labelForArchetype(archetype);
      expect(label).toBeDefined();
      expect(label.temperature).toBeDefined();
      expect(label.disposition).toBeDefined();
    }
  });

  it("labelForArchetype delegates to TEMPERATURE_DISPOSITION (same reference)", () => {
    for (const archetype of ARCHETYPES) {
      expect(labelForArchetype(archetype)).toBe(TEMPERATURE_DISPOSITION[archetype]);
    }
  });
});
