/**
 * CONCEPT_V8_ENABLED — the parallel-run switch for the platform-concept v8 surfaces
 * (Phase 1: the composer v8 — skill pill + skills panel, attached sub-bar, audience
 * sheet + platform lens, chips row, greeting-only arrival. Later phases: the shelf,
 * the report, the audience surface.)
 *
 * OFF by default → /home renders exactly as before. Set NEXT_PUBLIC_CONCEPT_V8=true
 * (dev-server env) to render the v8 composer. ⚠️ Layers ON TOP of AMBIENT_V2_ENABLED:
 * the v8 arrival swap lives inside the v2 mounts, so both flags must be on. The live
 * environment already runs v2.
 *
 * (Mirrors the AMBIENT_V2_ENABLED convention — env-gated so a review needs no code edit.)
 *
 * SSOT: docs/HANDOFF-2026-08-08-concept-v8-implementation.md
 */
export const CONCEPT_V8_ENABLED = process.env.NEXT_PUBLIC_CONCEPT_V8 === "true";
