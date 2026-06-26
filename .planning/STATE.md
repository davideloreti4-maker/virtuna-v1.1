---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: milestone
status: executing
stopped_at: 02-02-PLAN.md COMPLETE (live probe ran); next 02-03-PLAN.md (spike verdict + teardown)
last_updated: "2026-06-26T15:20:00.000Z"
last_activity: 2026-06-26 -- 02-02 COMPLETE: live probe ran (khaby.lame); determinism=NON-DETERMINISTIC (genuine), provenance+tiering GREEN; 2 prod bugs fixed
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 9
  completed_plans: 8
  percent: 19
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-26)

**Core value:** A calibrated, interrogable synthetic population you can run any stimulus through and get back a grounded, honest (Validated vs Directional) read.
**Current focus:** Phase 02 — trustworthy-sim-spike

## Current Position

Phase: 02 (trustworthy-sim-spike) — EXECUTING
Plan: 3 of 3 (01 + 02 complete; 02-03 NEXT — spike verdict + throwaway teardown)
Status: Executing Phase 02 — 02-02 live probe COMPLETE; ready for 02-03 verdict
Last activity: 2026-06-26 -- 02-02 live probe RAN on khaby.lame (human-approved): DETERMINISM=NON-DETERMINISTIC (genuine, matched watch counts), PROVENANCE+TIERING GREEN; evidence in 02-02-SUMMARY.md; 2 prod bugs fixed (dbbcf46c, aa783456)

Progress: [██░░░░░░░░] 19%

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | - | - |

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
- [Phase 02]: 02-02: LIVE make-or-break probe RAN (khaby.lame, human-approved ~$0.50). **DETERMINISM = NON-DETERMINISTIC** — thinking-mode synth (qwen-3.7-plus, temp0+seed) produced different load-bearing fields across two bakes of the IDENTICAL frozen input; matched watch counts (A=3 B=3) rule out the Pitfall-2 transport/INCONCLUSIVE escape, so this is a GENUINE finding; `signatureEqual:false`. PROVENANCE GREEN (10/10 reactors grounded all 4 bakes, source=user note surfaced, ungrounded distinguishable). TIERING GREEN (no-calibration→Directional). Material for 02-03: prod bakes ONCE + freezes (never re-bakes same input) → cross-bake non-determinism may be theoretical not operational; verdict (NO-GO vs accept-with-mitigation: bake-once-freeze / disable thinking / field-tolerance) is 02-03's. 2 LATENT PROD BUGS fixed en route: (a) `apifyVideoSchema.subtitleLinks` now `.nullable()` — clockworks returns null for wordless videos (khaby.lame) and was silently dropping ALL videos of subtitle-less profiles during calibration (`dbbcf46c`); (b) `SYNTH_TIMEOUT_MS` 60→120s — thinking-mode synth runs ~60-90s and was aborting systematically (`aa783456`). Throwaway scaffolding LEFT INTACT for 02-03 teardown.
- [Phase 02]: 02-01: KEEP determinism gate landed — signature-equality.ts (normalizeSignature/signatureEqual/stableStringify, one-field strip of provenance.scraped_at) + zero-network replay test (proves byte-identical assembly post-normalization + scraped_at is the SOLE volatile field via fake-timers double-bake, Assumption A1) + local Directional-by-rule tiering predicate keyed off DomainPack.calibration (Socials→Validated, no-calibration→Directional). No src/ resolver (D-05 scope). Audience suite green 10 files/135 tests. This is P3's free-by-construction regression foundation (TRUST-01). Live LLM-determinism probe is 02-02.

### Pending Todos

None yet.

### Blockers/Concerns

- PACK-04 byte-identical regression lock (Phase 1) is the load-bearing safety gate — must verify creator output unchanged against pre-seam fixtures before proceeding.
- Phase 2 spike must return a go/no-go verdict; a negative verdict reshapes Phases 3–7. **02-02 evidence is in: determinism leg is RED (live thinking-mode synth non-deterministic across bakes), provenance + tiering GREEN. 02-03 must decide NO-GO vs accept-with-mitigation — note prod bakes-once-and-freezes, so cross-bake non-determinism may not bite operationally.**

## Deferred Items

v2 scope (tracked, not in this roadmap): SIM marketplace + rev-share flywheel (MKT-*), Anchor Pack #2 / Marketing (PACK2-01), self-calibration Directional→Validated (CAL-01).

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Marketplace | Share/sell SIMs + outcome flywheel | Deferred to v2 | Roadmap creation |
| Anchor Pack | Pack #2 (Marketing) | Deferred to v2 | Roadmap creation |
| Calibration | Self-calibration promotion | Deferred to v2 | Roadmap creation |

## Session Continuity

Last session: 2026-06-26T15:20:00.000Z
Stopped at: Completed 02-02-PLAN.md (live probe ran — determinism RED, provenance/tiering GREEN)
Resume file: .planning/phases/02-trustworthy-sim-spike/02-03-PLAN.md
