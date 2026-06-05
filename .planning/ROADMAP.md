## Phase 4: Audience-Sim Fold (Brain 2) — THE BET

**Goal:** fold 20 persona calls (Pass-1 ×10 + Pass-2 ×10) into one grounded reasoning call that emits the per-archetype × per-segment matrix → heatmap + behavioral aggregate, A/B-proven before it replaces the live 10-pass.
**Does:** one `qwen3.6-plus` thinking call using `persona-registry.ts` knowledge, fed verbatim + segments + keyframes + emotion arc, emitting all 10 archetypes each carrying BOTH behavioral intents AND segment_reactions; two pure adapters split it back into the existing `PersonaSimulationResult[]` + `Pass2PersonaResult[]` shapes (aggregator + board byte-untouched, D-11/D-12); a new `behavioralSource:"fold"` branch + a default-OFF pipeline flag; a NEW `scripts/ab-fold-referee.ts` (modeled on `measure-pipeline.ts`, NOT the corpus harness) running the D-03 3-metric composite; the production flip gated on the A/B + human sign-off.
**Gate:** R10 — the 3-metric composite (behavioral parity ±5, diversity ≥0.8×, drop-point agreement ±1 for ≥6/10) on 6 fixed videos × 2 runs each (R8 band), advisory per D-05.
**Harness deviation (RESEARCH-overrides-CONTEXT):** CONTEXT D-04 said "revive `corpus/eval-harness.ts`"; research found it is a corpus bucket-classifier benchmark (macro-F1 over `training_corpus` → `benchmark_results`), structurally wrong for a retention-curve A/B. Build a NEW referee on the `measure-pipeline.ts` scaffold; leave the corpus harness dormant.
**Success:** R3, R7, R10. Heatmap from one call; 1-vs-20 call count; fold proven.
**Risk:** medium-high — homogenization (one call flattening 10 curves); mitigated by the D-06 in-call divergence requirement, the D-07 post-parse guard, and the A/B gate (with the D-02 ~5-core fallback + D-10 shadow contingency).
**Plans:** 2/5 plans executed
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Wave 0: 3 vitest scaffolds (schema/adapter/diversity-guard) + ab-fold-referee skeleton + stage/confirm the 6 referee videos (checkpoint)
- [x] 04-02-PLAN.md — Fold LLM layer: byte-stable STABLE_FOLD_SYSTEM_PROMPT + FoldResponseSchema + runFold (one bounded temp0+seed thinking call, both intent+reaction families)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-03-PLAN.md — Lossless adapters + D-07 diversity guard + aggregator "fold" branch (behavioral + heatmap) + pipeline foldOutcome wiring (default OFF, 10-pass dormant-not-deleted)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-04-PLAN.md — A/B referee composite: 3-metric (parity/diversity/drop-point) + R7 1-vs-20 call-count assertion + cost cap (advisory exit)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 04-05-PLAN.md — Run the A/B, advisory human sign-off (D-05), separately-revertable production flip (FLIP/SHADOW/FALLBACK-5; D-09 one-flag rollback)

## Phase 5: Wire + Surface
