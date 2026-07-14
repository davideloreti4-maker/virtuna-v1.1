/**
 * SOCIALS_PACK — Socials populated as Pack #1 (PACK-02 / PACK-03, the in-place
 * cut D-01).
 *
 * Cut Line A (RESOLVED — do not re-open): every field is populated by REFERENCE
 * to the existing, tested engine modules. The genuinely socials-specific scoring
 * — the `overall_score` virality fold, anti-virality, CTA-penalty math — lives
 * inside `aggregateScores` and is wrapped WHOLE (opaque, D-06/D-07): `scoring.run`
 * is a REFERENCE assignment, never a re-derivation. Behaviour is preserved by
 * construction, so ENGINE_VERSION stays in step with version.ts (now `3.21.0`) and the prediction cache stays
 * valid (T-01-RR / T-01-CP).
 *
 * ANTI-PATTERNS (do NOT): move apollo-core/deepseek/fold modules into `packs/`
 * (reference by import only — moving breaks ~20 importers + inflates the diff);
 * parameterize/refactor `aggregator.ts` (D-07); bump ENGINE_VERSION. The diff
 * touches only the 2 new pack files.
 */
import type { DomainPack } from "../domain-pack";
import { SOCIALS_CALIBRATION } from "./socials-calibration";
import { runPredictionPipeline } from "../pipeline";
import { aggregateScores } from "../aggregator";
import { APOLLO_SYSTEM_PROMPT, KNOWLEDGE_CORE } from "../apollo-core";
import { selectPersonaSlots } from "../wave3/persona-registry";
import { buildAudienceRepaint } from "../flash/build-reaction-panel";

/**
 * Pack #1. Typed `: DomainPack` so `tsc` enforces the full 7-field contract +
 * `id`/`run`/`scoring`. Const-object idiom (PATTERNS §"Typed-object-not-class"),
 * NOT a class.
 */
export const SOCIALS_PACK: DomainPack = {
  // Domain axis key — orthogonal to `stimulusTypes` (the input_mode axis).
  id: "socials",

  // Orchestration: the shared, domain-blind pipeline entrypoint (ROADMAP SC#1
  // "pack[mode].run(...)"). Reference identity — domain-blind, unchanged.
  run: runPredictionPipeline,

  // THE NEW SEAM (D-06). `run` = `aggregateScores` by REFERENCE — the whole
  // overall_score virality fold runs unchanged inside it (D-07, opaque).
  // `systemPrompt` = APOLLO_SYSTEM_PROMPT, byte-stable (DashScope prefix cache).
  scoring: {
    systemPrompt: APOLLO_SYSTEM_PROMPT,
    run: aggregateScores,
  },

  // Knowledge the pack grounds inference against (referenced, byte-unchanged).
  grounding: {
    systemPrompt: APOLLO_SYSTEM_PROMPT,
    knowledgeCore: KNOWLEDGE_CORE,
  },

  // HOW the population reacts — the REAL functions (type-matched to Plan 02's
  // ReactionFrameSpec via `typeof`).
  reactionFrame: {
    selectPersonaSlots,
    buildAudienceRepaint,
  },

  // The synthetic population the pack simulates over — thin Socials descriptor.
  populations: {
    kind: "socials",
    description:
      "TikTok creator reactor panel — the calibrated audience substrate (10 reactor personas).",
  },

  // How the read is calibrated (Socials = Validated anchor) — thin descriptor.
  // Byte-identical to the former inline literal — extracted to a leaf module so
  // presentation code can read it without importing this pipeline-bearing barrel
  // (BUILD-01). ENGINE_VERSION unchanged.
  calibration: SOCIALS_CALIBRATION,

  // The stimulus axis = the input_mode enum (orthogonal to the pack key).
  stimulusTypes: ["text", "tiktok_url", "video_upload"] as const,

  // The shape `scoring.run` returns — PredictionResult; `requiredKeys` enumerates
  // the top-level keys the D-03 smoke (Plan 04) asserts present.
  outputSchema: {
    name: "PredictionResult",
    requiredKeys: [
      "overall_score",
      "confidence",
      "confidence_label",
      "behavioral_predictions",
      "factors",
      "signal_availability",
      "engine_version",
      "input_mode",
    ],
  },
};
