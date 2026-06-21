/**
 * reconcile.test.ts — TDD RED/GREEN for reconcile() + calibration-vs-craft classifier (10-01 Task 2).
 *
 * Pure, deterministic (FLYWHEEL-03). Computes the divergence vector over the intersection
 * of present dispositions and routes each diverging disposition to calibration OR craft
 * per the locked A1 split (D-03):
 *   collector / connector / converter → CALIBRATION (the WHO — feeds the audience object)
 *   scanner / lurker / skeptic        → CRAFT      (the HOW-WELL — Account Read only)
 *
 * Covers:
 *  - divergence computed only over dispositions present in BOTH vectors
 *  - a disposition present in predicted but absent in realized is EXCLUDED
 *  - calibration-only divergence routes only to calibration
 *  - craft-only divergence routes only to craft
 *  - both-diverge logs both sides (not mutually exclusive)
 *  - craft divergence NEVER appears in the calibration set (D-03 protection)
 *  - the CALIBRATION/CRAFT disposition consts are exactly the A1 split
 *  - determinism
 */

import { describe, it, expect } from "vitest";
import {
  reconcile,
  CALIBRATION_DISPOSITIONS,
  CRAFT_DISPOSITIONS,
} from "../reconcile";
import type { Disposition } from "@/lib/audience/audience-types";

describe("A1 disposition split consts", () => {
  it("CALIBRATION = collector/connector/converter (the WHO)", () => {
    expect([...CALIBRATION_DISPOSITIONS].sort()).toEqual([
      "collector",
      "connector",
      "converter",
    ]);
  });
  it("CRAFT = scanner/lurker/skeptic (the HOW-WELL)", () => {
    expect([...CRAFT_DISPOSITIONS].sort()).toEqual([
      "lurker",
      "scanner",
      "skeptic",
    ]);
  });
  it("calibration and craft are disjoint", () => {
    const overlap = CALIBRATION_DISPOSITIONS.filter((d) =>
      (CRAFT_DISPOSITIONS as readonly Disposition[]).includes(d),
    );
    expect(overlap).toHaveLength(0);
  });
});

describe("reconcile", () => {
  it("computes divergence ONLY over dispositions present in both vectors", () => {
    const predicted = { collector: 0.5, connector: 0.5 } as Partial<
      Record<Disposition, number>
    >;
    // realized has collector + a converter not in predicted
    const realized = { collector: 0.7, converter: 0.3 } as Partial<
      Record<Disposition, number>
    >;
    const { divergenceVector } = reconcile(predicted, realized);
    // only collector is in BOTH
    expect(Object.keys(divergenceVector)).toEqual(["collector"]);
    expect(divergenceVector.collector).toBeCloseTo(0.7 - 0.5, 10);
    expect(divergenceVector.connector).toBeUndefined();
    expect(divergenceVector.converter).toBeUndefined();
  });

  it("routes a calibration-only divergence to calibration", () => {
    const predicted = { collector: 0.4, connector: 0.6 } as Partial<
      Record<Disposition, number>
    >;
    const realized = { collector: 0.6, connector: 0.4 } as Partial<
      Record<Disposition, number>
    >;
    const { classification } = reconcile(predicted, realized);
    expect(classification.collector).toBe("calibration");
    expect(classification.connector).toBe("calibration");
    expect(classification.scanner).toBeUndefined();
  });

  it("routes a craft-only divergence to craft", () => {
    const predicted = { scanner: 0.5, lurker: 0.5 } as Partial<
      Record<Disposition, number>
    >;
    const realized = { scanner: 0.3, lurker: 0.7 } as Partial<
      Record<Disposition, number>
    >;
    const { classification } = reconcile(predicted, realized);
    expect(classification.scanner).toBe("craft");
    expect(classification.lurker).toBe("craft");
  });

  it("logs BOTH sides when calibration and craft both diverge on one post", () => {
    const predicted = { collector: 0.5, scanner: 0.5 } as Partial<
      Record<Disposition, number>
    >;
    const realized = { collector: 0.7, scanner: 0.3 } as Partial<
      Record<Disposition, number>
    >;
    const { classification, divergenceVector } = reconcile(predicted, realized);
    expect(classification.collector).toBe("calibration");
    expect(classification.scanner).toBe("craft");
    expect(divergenceVector.collector).toBeCloseTo(0.2, 10);
    expect(divergenceVector.scanner).toBeCloseTo(-0.2, 10);
  });

  it("never places a craft divergence in the calibration set (D-03 protection)", () => {
    const predicted = { skeptic: 0.5, collector: 0.5 } as Partial<
      Record<Disposition, number>
    >;
    const realized = { skeptic: 0.8, collector: 0.2 } as Partial<
      Record<Disposition, number>
    >;
    const { classification } = reconcile(predicted, realized);
    const calibrationSet = (Object.keys(classification) as Disposition[]).filter(
      (d) => classification[d] === "calibration",
    );
    expect(calibrationSet).not.toContain("skeptic");
    expect(calibrationSet).toContain("collector");
  });

  it("is deterministic — identical input yields identical output", () => {
    const predicted = { collector: 0.4, converter: 0.6 } as Partial<
      Record<Disposition, number>
    >;
    const realized = { collector: 0.6, converter: 0.4 } as Partial<
      Record<Disposition, number>
    >;
    expect(reconcile(predicted, realized)).toEqual(
      reconcile(predicted, realized),
    );
  });
});
