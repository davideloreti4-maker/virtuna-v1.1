/**
 * Phase 01 Plan 03 — SOCIALS_PACK behaviour gate (PACK-02 / PACK-03).
 *
 * Proves Socials is populated as Pack #1 by REFERENCE (Cut Line A, D-06/D-07):
 *  - `scoring.run` IS the real `aggregateScores` (the overall_score virality fold
 *    wrapped WHOLE — reference identity, not a re-implementation).
 *  - `run` IS `runPredictionPipeline` (domain-blind orchestration).
 *  - `grounding`/`reactionFrame` bind the REAL functions (not under-typed stubs).
 *  - `SOCIALS_PACK satisfies DomainPack` (asserted at compile time by the typed const).
 *
 * Behaviour-preserving by construction: if any of these reference identities
 * regress to a re-derivation, this gate goes red (T-01-RR).
 */
import { describe, it, expect } from "vitest";
import { SOCIALS_PACK } from "../packs/socials";
import type { DomainPack } from "../domain-pack";
import { aggregateScores } from "../aggregator";
import { runPredictionPipeline } from "../pipeline";
import { APOLLO_SYSTEM_PROMPT, KNOWLEDGE_CORE } from "../apollo-core";
import { selectPersonaSlots } from "../wave3/persona-registry";
import { buildAudienceRepaint } from "../flash/build-reaction-panel";

// Compile-time: a typed alias proves the const conforms to the contract.
const _packProbe: DomainPack = SOCIALS_PACK;
void _packProbe;

describe("SOCIALS_PACK — Pack #1 (PACK-02/PACK-03)", () => {
  it("id is the socials domain key", () => {
    expect(SOCIALS_PACK.id).toBe("socials");
  });

  it("scoring.run IS aggregateScores wrapped whole (reference identity, D-07)", () => {
    expect(SOCIALS_PACK.scoring.run).toBe(aggregateScores);
  });

  it("run IS runPredictionPipeline (domain-blind orchestration)", () => {
    expect(SOCIALS_PACK.run).toBe(runPredictionPipeline);
  });

  it("scoring.systemPrompt IS APOLLO_SYSTEM_PROMPT (byte-stable cache prefix)", () => {
    expect(SOCIALS_PACK.scoring.systemPrompt).toBe(APOLLO_SYSTEM_PROMPT);
  });

  it("grounding references the real Apollo prompt + knowledge core", () => {
    expect(SOCIALS_PACK.grounding.systemPrompt).toBe(APOLLO_SYSTEM_PROMPT);
    expect(SOCIALS_PACK.grounding.knowledgeCore).toBe(KNOWLEDGE_CORE);
  });

  it("reactionFrame binds the real persona/repaint functions (not stubs)", () => {
    expect(SOCIALS_PACK.reactionFrame.selectPersonaSlots).toBe(selectPersonaSlots);
    expect(SOCIALS_PACK.reactionFrame.buildAudienceRepaint).toBe(buildAudienceRepaint);
  });

  it("stimulusTypes deep-equals the input_mode enum", () => {
    expect(SOCIALS_PACK.stimulusTypes).toEqual([
      "text",
      "tiktok_url",
      "video_upload",
    ]);
  });

  it("outputSchema names PredictionResult + lists the D-03 smoke keys", () => {
    expect(SOCIALS_PACK.outputSchema.name).toBe("PredictionResult");
    expect(SOCIALS_PACK.outputSchema.requiredKeys).toEqual(
      expect.arrayContaining([
        "overall_score",
        "confidence",
        "confidence_label",
        "behavioral_predictions",
        "factors",
        "signal_availability",
        "engine_version",
        "input_mode",
      ]),
    );
  });

  it("populations + calibration are thin socials descriptors", () => {
    expect(SOCIALS_PACK.populations.kind).toBe("socials");
    expect(SOCIALS_PACK.calibration.kind).toBe("socials");
    expect(typeof SOCIALS_PACK.calibration.baselineRef).toBe("string");
  });
});
