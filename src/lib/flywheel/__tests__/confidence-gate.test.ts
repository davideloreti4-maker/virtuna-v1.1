/**
 * confidence-gate.test.ts — TDD RED/GREEN for evaluateGate (10-01 Task 3, FLYWHEEL-04).
 *
 * Pure aggregate over a creator's last K reconciliation rows for ONE audience. Per
 * CALIBRATION disposition computes n / mean / agree and PROPOSES iff:
 *   n[d] >= N_MIN  AND  |mean[d]| >= DIV_THRESHOLD  AND  agree[d] >= AGREE_THRESHOLD
 *   AND d is a calibration disposition.
 *
 * Covers:
 *  - holds (null) below N_MIN
 *  - fires at exactly N_MIN with consistent same-direction divergence
 *  - holds when agreement < AGREE_THRESHOLD
 *  - holds when |mean| < DIV_THRESHOLD
 *  - NEVER fires for a craft disposition (D-03)
 *  - gate constants are the locked [ASSUMED] A2 values
 */

import { describe, it, expect } from "vitest";
import {
  evaluateGate,
  N_MIN,
  DIV_THRESHOLD,
  AGREE_THRESHOLD,
  type ReconciliationRow,
} from "../confidence-gate";
import type { Disposition } from "@/lib/audience/audience-types";

describe("gate constants ([ASSUMED] A2)", () => {
  it("locks the noise-resistant thresholds", () => {
    expect(N_MIN).toBe(5);
    expect(DIV_THRESHOLD).toBeCloseTo(0.12, 10);
    expect(AGREE_THRESHOLD).toBeCloseTo(0.7, 10);
  });
});

/** Build K rows where disposition d diverges by `div` each. */
const rows = (
  d: Disposition,
  divs: number[],
): ReconciliationRow[] =>
  divs.map((v) => ({ divergenceVector: { [d]: v } }));

describe("evaluateGate", () => {
  it("holds (returns null) below N_MIN consistent posts", () => {
    // N_MIN-1 = 4 strong consistent collector divergences
    const result = evaluateGate(rows("collector", [0.2, 0.2, 0.2, 0.2]));
    expect(result).toBeNull();
  });

  it("fires at exactly N_MIN with consistent same-direction divergence", () => {
    const result = evaluateGate(rows("collector", [0.2, 0.2, 0.2, 0.2, 0.2]));
    expect(result).not.toBeNull();
    const proposal = result!.proposals.find((p) => p.disposition === "collector");
    expect(proposal).toBeDefined();
    expect(proposal!.mean).toBeCloseTo(0.2, 10);
    expect(proposal!.n).toBe(5);
    expect(proposal!.agree).toBeCloseTo(1.0, 10);
  });

  it("holds when directional agreement is below AGREE_THRESHOLD", () => {
    // 5 posts, mixed direction: 3 up, 2 down → agree = 3/5 = 0.6 < 0.70
    const result = evaluateGate(
      rows("collector", [0.2, 0.2, 0.2, -0.2, -0.2]),
    );
    expect(result).toBeNull();
  });

  it("holds when |mean| is below DIV_THRESHOLD", () => {
    // 5 consistent but small divergences (0.05 < 0.12)
    const result = evaluateGate(
      rows("collector", [0.05, 0.05, 0.05, 0.05, 0.05]),
    );
    expect(result).toBeNull();
  });

  it("NEVER fires for a craft disposition even with strong consistent divergence", () => {
    // scanner is a craft disposition — must never propose
    const result = evaluateGate(rows("scanner", [0.3, 0.3, 0.3, 0.3, 0.3]));
    expect(result).toBeNull();
  });

  it("only counts rows where the disposition had a realized signal (presence)", () => {
    // 5 collector rows + 3 rows with no collector signal → n[collector] should be 5
    const present = rows("collector", [0.2, 0.2, 0.2, 0.2, 0.2]);
    const absent: ReconciliationRow[] = [
      { divergenceVector: { connector: 0.1 } },
      { divergenceVector: { connector: 0.1 } },
      { divergenceVector: {} },
    ];
    const result = evaluateGate([...present, ...absent]);
    const proposal = result!.proposals.find((p) => p.disposition === "collector");
    expect(proposal!.n).toBe(5);
  });

  it("is deterministic", () => {
    const r = rows("converter", [0.15, 0.15, 0.15, 0.15, 0.15]);
    expect(evaluateGate(r)).toEqual(evaluateGate(r));
  });
});
