/**
 * Generative KC content version.
 *
 * DECOUPLED from the video-scoring engine version (see src/lib/engine/version.ts —
 * do not import that file here). The two version namespaces are intentionally
 * independent: KC_GEN_VERSION tracks authored knowledge-core content changes;
 * the engine version tracks video-scoring behavior changes. Never mix them.
 *
 * Bump KC_GEN_VERSION on any deliberate change to .planning/corpus/base.md or
 * any SLICE .md (ideas.md, hooks.md, chat.md). This gives:
 *   — Reproducible pilot comparison (blind-gate outputs attributed to a KC version)
 *   — Output provenance (which KC authored a given generation)
 *   — Safe iteration: content churn stays off the protected video-scoring boundary
 *
 * DEFERRED — persistence/output-stamping wiring:
 * Where this stamp lands on a persisted message or block is DEFERRED to Phase 3,
 * where generated outputs are first persisted in the product (see RESEARCH Open Q1 / A3).
 * Phase 2 only defines the constant. The stamping integration point (message-level field,
 * block metadata, or output provenance header) will be determined in Phase 3.
 *
 * Version format: "gen.MAJOR.MINOR.PATCH"
 *   MAJOR: breaking change to KC structure or base philosophy (re-derive from scratch)
 *   MINOR: meaningful authoring update to base or any slice (content curation pass)
 *   PATCH: minor wording / typo correction
 */
export const KC_GEN_VERSION = "gen.1.1.0";
