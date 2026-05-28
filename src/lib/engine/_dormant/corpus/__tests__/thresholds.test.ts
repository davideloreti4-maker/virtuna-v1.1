import { describe, it, expect } from "vitest";
import { getThresholds, listKnownVersions } from "../thresholds";
import { NICHES } from "../eval-config";

describe("thresholds / getThresholds", () => {
  it("returns the pilot.2026-05-12 snapshot with all 5 niche keys", () => {
    const snap = getThresholds("pilot.2026-05-12");
    for (const niche of NICHES) {
      expect(snap[niche]).toBeDefined();
      expect(snap[niche].viralFloor).toBeGreaterThan(snap[niche].underCeiling);
    }
  });

  it("throws on an unknown corpus_version (no silent default)", () => {
    expect(() => getThresholds("nonexistent.version")).toThrow(
      /Unknown corpus_version/,
    );
  });

  it("throws with a helpful message containing the unknown version", () => {
    expect(() => getThresholds("full.9999-12-31")).toThrow(/full\.9999-12-31/);
  });
});

describe("thresholds / listKnownVersions", () => {
  it("includes the pilot version", () => {
    const versions = listKnownVersions();
    expect(versions).toContain("pilot.2026-05-12");
  });

  it("returns at least one version", () => {
    const versions = listKnownVersions();
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });
});
