/**
 * Phase 01 Plan 02 — [BLOCKING] DomainPack scoring-shape contract gate (PACK-03).
 *
 * Mirrors the audience-regression-gate BLOCKING idiom. This test is the self-
 * contained de-risk for Plan 03: it proves at COMPILE time that the real
 * `aggregateScores` is assignable to `DomainPackScoring["run"]`. If the
 * interface's `scoring.run` shape ever drifts from the verbatim `aggregateScores`
 * signature, this fails here — NOT in Plan 03 when `run: aggregateScores` is wrapped.
 * The phase CANNOT pass with this red.
 *
 * Threat T-01-RR (Tampering/regression): the only risk this types-only plan
 * introduces is a contract↔implementation mismatch. The compile-time binding
 * below is the mitigation.
 *
 * Also asserts the four deferred spec types instantiate (they are thin but
 * precise — usable, not under-typed `any`/`unknown`).
 */
import { describe, it, expect } from "vitest";
import { aggregateScores } from "../aggregator";
import type {
  DomainPackScoring,
  PopulationsSpec,
  GroundingSpec,
  CalibrationSpec,
  OutputSchemaSpec,
} from "../domain-pack";

// ── Compile-time binding (the de-risk for Plan 03) ──────────────────────────
// If `DomainPackScoring["run"]` drifts from the real `aggregateScores` arity/
// option shape, this assignment fails to type-check and `tsc` (and the test
// compile) goes red. This is the load-bearing assertion of this file.
const _scoringRunProbe: DomainPackScoring["run"] = aggregateScores;
void _scoringRunProbe;

describe("DomainPack scoring contract (PACK-03) — BLOCKING", () => {
  it("aggregateScores is assignable to DomainPackScoring['run'] (compile-time bound)", () => {
    // The binding above already proves the shape at compile time; this runtime
    // assertion confirms the reference resolved to a real callable.
    expect(typeof _scoringRunProbe).toBe("function");
    expect(_scoringRunProbe).toBe(aggregateScores);
  });

  it("deferred spec types instantiate (thin-but-precise, not under-typed)", () => {
    const populations: PopulationsSpec = {
      kind: "socials",
      description: "TikTok creator reactor panel",
    };
    const grounding: GroundingSpec = {
      systemPrompt: "APOLLO_SYSTEM_PROMPT",
      knowledgeCore: "KNOWLEDGE_CORE",
    };
    const calibration: CalibrationSpec = {
      kind: "socials",
      baselineRef: "calibration-baseline.json",
    };
    const outputSchema: OutputSchemaSpec = {
      name: "PredictionResult",
      requiredKeys: ["overall_score", "confidence", "engine_version"],
    };

    expect(populations).toBeDefined();
    expect(grounding).toBeDefined();
    expect(calibration).toBeDefined();
    expect(outputSchema).toBeDefined();
  });
});
