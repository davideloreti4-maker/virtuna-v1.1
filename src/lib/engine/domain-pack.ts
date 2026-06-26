/**
 * DomainPack — the engine/pack seam contract (PACK-03, D-05).
 *
 * This file is PURE TYPES (no runtime values). It defines the full 7-field
 * `DomainPack` shape NOW so that `SOCIALS_PACK satisfies DomainPack` can be
 * proven at compile time in Plan 03 — and so P3 (General) / P6 (Predict) packs
 * mount the SAME contract without a mid-milestone re-cut (D-05: the contract is
 * the expensive, hard-to-re-cut part — get it precise once).
 *
 * Two structural members carry the run path:
 *   - `run`            = `runPredictionPipeline` (orchestration; ROADMAP SC#1
 *                        "the core run path runs pack[mode].run(...)").
 *   - `scoring.run`     = `aggregateScores` (THE NEW SEAM, D-06) — mirrored
 *                        VERBATIM from aggregator.ts so the Plan-03 wrap type-checks.
 *
 * Plus the 7 D-05 domain-spec fields: `populations / grounding / stimulusTypes /
 * reactionFrame / scoring / outputSchema / calibration`. The genuinely
 * socials-specific scoring lives ONLY in `scoring` (= `aggregateScores`, Plan 03).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CUT LINE A SCOPE LOCK (the #1 planner lock — RESEARCH §"The Wrap Boundary",
 * Assumption A1): `grounding` / `reactionFrame` / `populations` / `calibration`
 * are populated by REFERENCE this phase (declarative descriptors). They are read
 * live by the pipeline only in Plan 03 — do NOT thread the pack into
 * `pipeline.ts` / `deepseek.ts` here. Threading would break ~60 existing test
 * callers and breach D-08's reviewable-diff bar. This phase defines the contract;
 * it does not wire it.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Idiom: plain `export interface` + `export type` (mirrors types.ts), NOT a
 * class / DI container (over-engineered for 1 pack — D-08 + PATTERNS
 * §"Typed-object-not-class"). All cross-module references use `import type` so
 * this file adds ZERO runtime coupling.
 */

import type { PipelineResult, PipelineOptions } from "./pipeline";
import type { AggregateScoresOptions } from "./aggregator";
import type { AnalysisInput, PredictionResult } from "./types";
import type { StageEventCallback } from "./events";
// type-only imports of the REAL reaction-frame functions — `typeof` (type
// position only) proves the pack references the real ones, not under-typed stubs.
import type { selectPersonaSlots } from "./wave3/persona-registry";
import type { buildAudienceRepaint } from "./flash/build-reaction-panel";

/**
 * The STIMULUS axis = `input_mode` enum (types.ts:157). Orthogonal to the
 * pack/domain key (D-08 + RESEARCH anti-pattern "Collapsing input_mode into the
 * pack key"). `DomainPack.stimulusTypes` *describes* this enum; it never moves
 * the pipeline's `input_mode` branching.
 */
export type StimulusType = "text" | "tiktok_url" | "video_upload";

/**
 * THE NEW SEAM (D-06). `run` mirrors `aggregateScores` (aggregator.ts:520)
 * VERBATIM — same arity + option shape — so the Plan-03 wrap `run: aggregateScores`
 * type-checks. `systemPrompt` is the referenced `APOLLO_SYSTEM_PROMPT`
 * (byte-unchanged DashScope cache prefix).
 */
export interface DomainPackScoring {
  systemPrompt: string;
  run(
    pipelineResult: PipelineResult,
    onStageEvent?: StageEventCallback,
    options?: AggregateScoresOptions,
  ): Promise<PredictionResult>;
}

/**
 * Population spec — the synthetic population the pack simulates over. References
 * the Audience substrate + persona archetypes conceptually; fully consumed in
 * Plan 03 (Socials = the calibrated reactor panel). Thin-but-precise.
 */
export interface PopulationsSpec {
  kind: "socials";
  description: string;
}

/**
 * Grounding spec — the knowledge the pack grounds inference against. For Socials:
 * `systemPrompt` → APOLLO_SYSTEM_PROMPT, `knowledgeCore` → KNOWLEDGE_CORE
 * (apollo-core.ts). Referenced (declarative) this phase; read live in Plan 03.
 */
export interface GroundingSpec {
  systemPrompt: string;
  knowledgeCore: string;
}

/**
 * Reaction-frame spec — HOW the population reacts to a stimulus. Both members
 * are typed via `typeof` of the REAL functions so `tsc` proves the pack
 * references them (D-05 "do not under-type"):
 *   - `selectPersonaSlots` (wave3/persona-registry) — picks the reactor slots.
 *   - `buildAudienceRepaint` (flash/build-reaction-panel) — projects the active
 *     audience to the per-archetype repaint map the fold consumes.
 */
export interface ReactionFrameSpec {
  selectPersonaSlots: typeof selectPersonaSlots;
  buildAudienceRepaint: typeof buildAudienceRepaint;
}

/**
 * Calibration spec — how the pack's read is calibrated (Validated vs Directional).
 * For Socials: `baselineRef` → calibration-baseline.json + realized-signature.
 * Populated P3+. Thin-but-precise.
 */
export interface CalibrationSpec {
  kind: "socials";
  baselineRef: string;
}

/**
 * Output-schema spec — the shape the pack's scoring returns. For Socials the
 * scorer returns `PredictionResult` (types.ts:300); `requiredKeys` enumerates the
 * keys the D-03 smoke asserts present.
 */
export interface OutputSchemaSpec {
  name: "PredictionResult";
  requiredKeys: readonly string[];
}

/**
 * The full 7-field `DomainPack` contract (D-05) + the `id` (domain axis key) and
 * `run` (orchestration) dispatch members. Socials is Pack #1 (`id: "socials"`);
 * `SOCIALS_PACK` populates this in Plan 03.
 *
 * `run` mirrors `runPredictionPipeline` (pipeline.ts:332) VERBATIM so
 * `pack.run(...)` is a drop-in for the existing two-call call sites.
 */
export interface DomainPack {
  /** Domain axis key — orthogonal to `stimulusTypes` (the input_mode axis). */
  id: "socials";
  /** Orchestration — = `runPredictionPipeline` (pipeline.ts:332), verbatim shape. */
  run(input: AnalysisInput, opts?: PipelineOptions): Promise<PipelineResult>;
  populations: PopulationsSpec;
  grounding: GroundingSpec;
  stimulusTypes: readonly StimulusType[];
  reactionFrame: ReactionFrameSpec;
  scoring: DomainPackScoring;
  outputSchema: OutputSchemaSpec;
  calibration: CalibrationSpec;
}
