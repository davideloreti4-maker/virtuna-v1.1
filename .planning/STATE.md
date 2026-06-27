---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: milestone
status: executing
stopped_at: Wave 2 COMPLETE (03-04) — repo seam + GENERAL_TEMPLATES landed; Wave 3 (03-05 + 03-06) next
last_updated: "2026-06-27T16:27:00.000Z"
last_activity: 2026-06-27 -- 03-04 repo seam (mode/success_criterion/custom_context) + GENERAL_TEMPLATES (analyst/hiring) shipped; audience suite 12 files/157 passed
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 16
  completed_plans: 12
  percent: 36
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-26)

**Core value:** A calibrated, interrogable synthetic population you can run any stimulus through and get back a grounded, honest (Validated vs Directional) read.
**Current focus:** Phase 03 — general-population-honesty-layer

## Current Position

Phase: 03 (general-population-honesty-layer) — EXECUTING
Plan: Wave 2 COMPLETE (03-04) — 4 of 7 phase-03 plans done; Wave 3 (03-05 + 03-06) next
Status: 03-04 wired the audience repo seam over the live 03-03 columns. `AudienceRow`/`rowToAudience`/`audienceToRow` carry `mode`/`success_criterion`/`custom_context` losslessly; `WritableAudienceSchema` validates them (mode enum, `.max(2000)` caps on success_criterion + custom_context.note → T-03-08; `user_id` stays session-derived → T-03-07). `GENERAL_AUDIENCE` + both presets stamped `mode='socials'` (Pitfall 1 collision trap). `GENERAL_TEMPLATES` = analyst + hiring (ids `template-analyst`/`template-hiring`): `mode='general'`, `signature:null`, evidence-free CalibratedPersona panels (Σ=1.0) — ungrounded-by-design (D-05/Pitfall 5), wired into SENTINEL_IDS/VIRTUAL_BY_ID/listAudiences-prepend, refused on delete (T-03-09). POP-03 data layer proven: a `mode='general'` audience creates/lists/renames through the existing CRUD (no front-door picker — that is P7). `rowToAudience`/`audienceToRow`/`WritableAudienceSchema` exported for the gate. Next: Wave 3 = 03-05 (TrustBadge + card honesty) + 03-06 (route schemas + author/edit form).
Last activity: 2026-06-27 -- 03-04 repo seam + GENERAL_TEMPLATES shipped; audience suite 12 files/157 passed; tsc clean on touched file

Progress: [████░░░░░░] 36%

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | - | - |
| 02 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P02 | 7 min | 2 tasks | 2 files |
| Phase 01 P03 | 4min | 2 tasks | 4 files |
| Phase 01 P04 | 3min | 1 tasks | 1 files |
| Phase 01 P05 | 5min | 2 tasks | 1 files |
| Phase 01 P06 | 4min | 2 tasks | 2 files |
| Phase 02 P01 | 5min | 2 tasks | 4 files |
| Phase 02 P02 | ~40min | 3 tasks | 6 files |
| Phase 02 P03 | ~6min | 2 tasks | 4 files |
| Phase 03 P02 | ~8min | 2 tasks | 3 files |
| Phase 03 P04 | ~10min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- Phase 0 (engine-rework, on `main`): signature substrate (AudienceSignature, 2-model stack, fold↔calibrated-audience unify) is DONE — do NOT `git merge rework/engine-core` (content already landed; merge replays as conflicts/dupes).
- Roadmap: *wrap* the frozen Apollo/virality math as Pack #1's scorer — never refactor it (deep-surgery risk).
- Roadmap: creator (Socials) experience stays byte-identical; generality lives behind the Audience picker.
- Roadmap: the trustworthy-SIM-without-calibration question (vision §7) is sequenced as an early de-risk spike (Phase 2) before the General surface is built.
- Plan 01-01: `package-lock.json` is gitignored + was absent in this worktree → deps resolved fresh from the main-vetted `package.json` ranges (NOT a tracked-lockfile restore). Pre-seam engine baseline GREEN (91 files / 1151 passed + 20 skipped, ~13s); ENGINE_VERSION confirmed pinned 3.20.0. Run engine tests ONLY via `node ./node_modules/vitest/vitest.mjs run` (npm test/npx vitest emit fake PASS(0)).
- [Phase 01]: Plan 01-02: DomainPack 7-field contract in sibling domain-pack.ts (pure types, import-type only); scoring.run mirrors aggregateScores verbatim; Cut Line A scope lock (no pipeline threading this phase) in header; Task-2 compile-time binding guards contract drift (T-01-RR).
- [Phase ?]: 01-03: Socials = Pack #1 (SOCIALS_PACK satisfies DomainPack); scoring.run = aggregateScores wrapped whole (D-06/D-07); resolvePack holds zero scoring logic; in-place cut D-01, ENGINE_VERSION 3.20.0 untouched.
- [Phase 01]: 01-04: pack-seam-smoke.test.ts is the phase BLOCKING D-03 gate — structural smoke (keys + sane-band overall_score + engine_version 3.20.0) over SOCIALS_PACK.scoring.run for text+video fixtures, plus a static PACK-01 no-aggregateScores check on packs/index.ts; D-04 byte-identical superseded, no golden-master rig.
- [Phase 01]: 01-05: production /api/analyze dispatches BOTH branches (JSON + SSE) via resolvePack(socials).run + .scoring.run; direct runPredictionPipeline/aggregateScores imports removed (PACK-01 on live route). Identity wraps — opts + aggregateMs timing + onStageEvent preserved; smoke gate + route tests green, tsc clean.
- [Phase ?]: [Phase 01]: 01-06: both non-route harnesses (corpus/eval-runner + learning/predict) dispatch via resolvePack(socials).run + .scoring.run; direct aggregateScores import dropped, ENGINE_VERSION retained, behavioralSource conditional preserved verbatim. PACK-01 closed across ALL 4 call sites. Full engine suite green (95 files/1170 passed).
- [Phase 02]: 02-03: SPIKE CLOSED — `SPIKE-VERDICT.md` renders the hard D-04 3-gate: **Determinism FAIL** (genuine; matched watch counts rule out Pitfall-2 transport → real thinking-mode synth non-determinism), **Provenance PASS** (40/40 reactors grounded, source=user surfaced first-class), **Tiering PASS** (no-calibration→Directional by rule). **OVERALL VERDICT = NO-GO (conditional)** — honest to D-04 (a failed leg is a NO-GO) but framed NO-GO-pending-one-mitigation since provenance+tiering are GREEN and prod **bakes-once-and-freezes** (cross-bake non-determinism is theoretical not operational; re-bake/drift is v2 CAL-01). **Fallback to GO** = drop thinking-mode (`enable_thinking:false`) on the synth bake (Pitfall-3 jitter source; temp:0 greedy decoding is the real lever), then re-run double-bake to confirm `signatureEqual:true`. P3 carry-forward: promote probe-local `provenance.custom_context` (source=user) to a real SIM-scoped field (Open Q3); KEEP `signature-equality.ts`+`signature-determinism.test.ts` = P3 regression foundation (TRUST-01); 2 prod fixes retained. Threw away `scripts/spike/*` (D-05); KEEP gate green post-teardown (135 tests). Commits a14af4b9 (docs), 362ef8df (chore).
- [Phase 02]: 02-02: LIVE make-or-break probe RAN (khaby.lame, human-approved ~$0.50). **DETERMINISM = NON-DETERMINISTIC** — thinking-mode synth (qwen-3.7-plus, temp0+seed) produced different load-bearing fields across two bakes of the IDENTICAL frozen input; matched watch counts (A=3 B=3) rule out the Pitfall-2 transport/INCONCLUSIVE escape, so this is a GENUINE finding; `signatureEqual:false`. PROVENANCE GREEN (10/10 reactors grounded all 4 bakes, source=user note surfaced, ungrounded distinguishable). TIERING GREEN (no-calibration→Directional). Material for 02-03: prod bakes ONCE + freezes (never re-bakes same input) → cross-bake non-determinism may be theoretical not operational; verdict (NO-GO vs accept-with-mitigation: bake-once-freeze / disable thinking / field-tolerance) is 02-03's. 2 LATENT PROD BUGS fixed en route: (a) `apifyVideoSchema.subtitleLinks` now `.nullable()` — clockworks returns null for wordless videos (khaby.lame) and was silently dropping ALL videos of subtitle-less profiles during calibration (`dbbcf46c`); (b) `SYNTH_TIMEOUT_MS` 60→120s — thinking-mode synth runs ~60-90s and was aborting systematically (`aa783456`). Throwaway scaffolding LEFT INTACT for 02-03 teardown.
- [Phase 03]: 03-04: Repo seam over the live 03-03 columns. `AudienceRow`/`rowToAudience`/`audienceToRow` round-trip `mode`/`success_criterion`/`custom_context` losslessly; `WritableAudienceSchema` caps the free-text at `.max(2000)` (T-03-08) and keeps `user_id` session-derived (T-03-07). `GENERAL_AUDIENCE` + presets are `mode='socials'` (Pitfall 1 — only analyst/hiring templates are 'general'). `GENERAL_TEMPLATES` (ids `template-analyst`/`template-hiring`): `mode='general'`, `signature:null`, evidence-free `CalibratedPersona[]` panels Σ=1.0 (ungrounded-by-design, D-05/Pitfall 5) → SENTINEL_IDS/VIRTUAL_BY_ID/listAudiences-prepend, refused on delete (T-03-09). POP-03 data layer: General audience creates/lists/renames through existing CRUD (no front-door picker — P7). Exported `rowToAudience`/`audienceToRow`/`WritableAudienceSchema` for the gate. Audience suite 12 files/157 passed (+18); tsc clean on touched file; ENGINE_VERSION untouched. Requirements POP-01/POP-03/POP-04 closed.
- [Phase 03]: 03-02: Domain foundation (interface-first). `Audience` gains a REQUIRED first-class `mode: "socials" | "general"` axis (D-04 — explicitly NOT derived from `is_general`), plus additive-optional `success_criterion?: string | null` (D-03, flows into `DomainPack.scoring` for P5/P6) and top-level `custom_context?: CustomContext[] | null` (D-07 — stored top-level NOT in `SignatureProvenance` so it survives `signature:null`, Pitfall 2); `CustomContext` = `{source:"user", note, persona_evidence_link?}`. New `src/lib/audience/resolve-tier.ts` exports `resolveTier(Pick<Audience,"mode">)` + `tierFromCalibration({baselineRef?})` + `type TrustTier`, productionizing the spike-locked rule: keys off `SOCIALS_PACK.calibration` (the PACK, never `Audience.calibration`/scrape provenance), socials→Validated, every other mode→Directional directly (no General pack in P3 — D-02, do NOT widen `DomainPack`). Truth-table test (4/4) locks never-Validated-for-general. Audience suite 11 files/139 passed (+4, determinism gate kept green); no new tsc errors on touched paths; ENGINE_VERSION untouched. Downstream (03-03 repo/migration, UI, run-badge) now import these contracts without a scavenger hunt.
- [Phase 03]: 03-01: D-01 determinism close-out. Dropped thinking-mode on the qwen-3.7-plus synth (`enable_thinking:false`, `thinking_budget` removed; c4c7b5c9) + re-created the paid double-bake harness (6d5854a2). **Live gate (~$0.15, "test it cheaper") = signatureEqual:FALSE even SYNTH-ISOLATED** (watch+subtitle stubbed → identical input, 2 real synth calls): structural drift in persona_weights (loyalist 0.15↔0.10, niche 0.05↔0.10) + persona shares + prose; STABLE on follower_tier/maturity/interest_tags/temperature_mix/archetypes/writing_style. Root cause = MoE batch-routing non-determinism (temp:0+seed insufficient), NOT a config bug — reproduces 02-02 independently; Option 3 (prose-tolerance) ruled OUT by structural drift. **Operator adopted Fallback Option 2 (bake-once-freeze):** determinism contracted on the FROZEN persisted signature (prod bakes-once-never-rebakes) + green zero-network replay gate (signature-determinism.test.ts 5/5); cross-bake reproducibility → v2 (CAL-01); `scripts/rebake-determinism.ts` retained as the v2/CAL-01 drift tool (header reframed). Thinking-off change KEPT (strict jitter reduction). ENGINE_VERSION untouched. Honesty layer unaffected (no-cal→Directional already GREEN).
- [Phase 02]: 02-01: KEEP determinism gate landed — signature-equality.ts (normalizeSignature/signatureEqual/stableStringify, one-field strip of provenance.scraped_at) + zero-network replay test (proves byte-identical assembly post-normalization + scraped_at is the SOLE volatile field via fake-timers double-bake, Assumption A1) + local Directional-by-rule tiering predicate keyed off DomainPack.calibration (Socials→Validated, no-calibration→Directional). No src/ resolver (D-05 scope). Audience suite green 10 files/135 tests. This is P3's free-by-construction regression foundation (TRUST-01). Live LLM-determinism probe is 02-02.

### Pending Todos

None yet.

### Blockers/Concerns

- PACK-04 byte-identical regression lock (Phase 1) is the load-bearing safety gate — must verify creator output unchanged against pre-seam fixtures before proceeding.
- ~~Phase 2 spike verdict NO-GO (conditional) — determinism leg RED~~ **RESOLVED in 03-01 (2026-06-27).** Live gate confirmed the synth is non-deterministic even isolated (structural drift; MoE batch-routing, not fixable by config) — Option 1 (thinking-off) reduced but did not remove it. Operator adopted **Fallback Option 2 (bake-once-freeze)**: determinism is now contracted on the frozen persisted signature + the green replay gate; cross-bake reproducibility deferred to v2 (CAL-01). Provenance + tiering remain GREEN. Phase 3 build is CLEARED.

## Deferred Items

v2 scope (tracked, not in this roadmap): SIM marketplace + rev-share flywheel (MKT-*), Anchor Pack #2 / Marketing (PACK2-01), self-calibration Directional→Validated (CAL-01).

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Marketplace | Share/sell SIMs + outcome flywheel | Deferred to v2 | Roadmap creation |
| Anchor Pack | Pack #2 (Marketing) | Deferred to v2 | Roadmap creation |
| Calibration | Self-calibration promotion | Deferred to v2 | Roadmap creation |

## Session Continuity

Last session: 2026-06-27T16:27:00.000Z
Stopped at: Completed 03-04-PLAN.md (repo seam + GENERAL_TEMPLATES)
Resume file: .planning/phases/03-general-population-honesty-layer/03-05-PLAN.md
