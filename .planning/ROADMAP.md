# Roadmap: Engine Hardening (M2-1b)

**Branch:** `milestone/engine-hardening`
**Worktree:** `~/virtuna-engine-hardening/`
**Phase range:** 14-18 (continues from M1 Engine Foundation Phase 13)
**Parallel sibling:** Result Surface (`~/virtuna-result-surface/`, branch `milestone/result-surface`)

## Overview

Close the engine debt left open by M1 (Engine Foundation) so the v3.0.0 pipeline can stand behind a polished UX without quiet bypasses. Five surgical, additive-only phases — no engine architecture rewrites. Three phases (14, 15, 16, 17) are parallelizable as sub-worktrees; Phase 18 sequences last because it depends on the prior four landing and includes live-deploy smoke tests.

The Qwen-only migration is **locked**. The M1 pipeline is treated as locked; phases touch only what M1 left explicitly open (calibration params, threshold values, audio re-enable, type hygiene, verification debt).

## Parallelization Plan

```
       main (post-M1 merge)
            │
   ┌────────┴────────┐
   ▼                 ▼
Phase 14           Phase 17
TYPES              CALIB-04
hygiene            smoke billing
            │
            └────────┐
                     ▼
                 Phase 18
                 VERIF debt + IN-03 SSRF
                 (sequenced last;
                  live-deploy + code review)

Phase 15: DROPPED 2026-05-24
Phase 16: DEFERRED 2026-05-25 (audio feature; not critical path)
```

- **Phase 14 (TYPES)** can fork immediately. Touches `src/app/api/{profile,settings,team}/*` + `database.types.ts` — no overlap with engine code.
- **Phase 15 (CALIB refit)** — **DROPPED 2026-05-24.** Premise unsound: corpus-based eval calibrated text-on-captions but production runs video-mode Omni-Plus; corpus carries post-publication engagement metrics that production never sees at inference. Calibration removed entirely; `applyPlattScaling` and `platt_parameters` table deleted. See `phases/15-.../15-DISCUSSION-LOG.md` tail. CALIB-01/02/03/05 cancelled; CALIB-04 stays in Phase 17.
- **Phase 16 (AUDIO re-enable)** — **DEFERRED 2026-05-25.** Audio fingerprint matching is not a primary viral signal for the current use case (sound-driven trend-riding is secondary to caption/visual signals). AUDIO-01–05 deferred to a future milestone. IN-03 (SSRF allowlist on `sound_url`) extracted and moved to Phase 18 alongside its VERIF-04 siblings.
- **Phase 17 (CALIB-04 smoke billing)** can fork immediately. Touches `scripts/run-smoke.ts` + DashScope billing fetch — fully independent.
- **Phase 18 (VERIF closure)** runs **after** 14/17 merge to milestone branch. Contains live-deploy smoke tests, UAT runs, code-review follow-ups (WR-04/WR-05/IN-01/IN-02), and IN-03 SSRF allowlist (moved from deferred Phase 16) — sequenced last to avoid merge churn.

## Milestones

- ✅ **v3.1 Engine Hardening** — Phases 14-18 (shipped 2026-05-25)

## Phases

<details>
<summary>✅ v3.1 Engine Hardening (Phases 14-18) — SHIPPED 2026-05-25</summary>

- [x] Phase 14: Type Hygiene & user_settings Resolution — 2/2 plans — completed 2026-05-24
- [~] Phase 15: Calibration Refit on Qwen Corpus — DROPPED 2026-05-24 (Platt removed entirely)
- [~] Phase 16: Audio Fingerprint + Embedder Re-enable — DEFERRED 2026-05-25 (future milestone)
- [x] Phase 17: Smoke Runner Live Billing Wiring — completed 2026-05-25
- [x] Phase 18: M1 Verification Debt Closure — 4/4 plans — completed 2026-05-25

</details>

## Phase Details

### Phase 14: Type Hygiene & user_settings Resolution
**Goal**: `pnpm exec tsc --noEmit` returns 0 errors across the entire app (not just engine paths). Decision logged on whether `user_settings` is a real table or a dead consumer.
**Depends on**: Nothing (forks from main alongside 15/16/17)
**Requirements**: TYPES-01, TYPES-02, TYPES-03, TYPES-04, TYPES-05
**Success Criteria** (what must be TRUE):
  1. `.planning/research/user-settings-audit.md` exists with all 9 grep hits enumerated, reachability-from-deployed-UI marked per call site, and decision logged (path a: migrate, path b: rip out)
  2. Either the `user_settings` migration is applied to `qyxvxleheckijapurisj` with RLS policies OR the dead routes are deleted with imports cleaned
  3. `database.types.ts` regenerated from live schema; hand-patched types removed
  4. `pnpm exec tsc --noEmit` returns 0 errors across the entire app (baseline was 966 errors in `src/app/api/{profile,settings,team}/*`)
  5. `pnpm build` green
**Plans**: 2 plans
  - [x] 14-01-PLAN.md — Produce user-settings-audit.md (TYPES-01, TYPES-02, baseline TYPES-05)
  - [x] 14-02-PLAN.md — Regenerate database.types.ts from live schema (TYPES-03, TYPES-04 vacuous, TYPES-05 gate)

### Phase 15: Calibration Refit on Qwen Corpus — **DROPPED 2026-05-24**

**Status**: Cancelled mid-execution. Calibration removed from the engine entirely.

**Why dropped** (see `phases/15-calibration-refit-on-qwen-corpus/15-DISCUSSION-LOG.md` tail for the full audit):
1. **Path mismatch.** `eval-runner.ts` builds `input_mode: "text"` and sends only `row.caption` to Qwen reasoning. Production `/api/analyze` runs `input_mode: "video_upload"` through Qwen-Omni-Plus on video bytes. Calibrating one path then applying parameters to the other is a category error.
2. **Shape mismatch.** `training_corpus` carries post-publication engagement metrics (views, likes, completion_pct) and a derived `bucket` label baked in at scrape time. Production inference sees a fresh upload with none of those features. Calibration input distribution ≠ inference input distribution.
3. **Dead code path.** `aggregator.ts` had `is_calibrated = false` hardcoded since the Qwen migration; the entire Platt apparatus was unused in production.

**What landed before drop**: 15-01 (engine_version discriminator on `platt_parameters` + types regen + CLI flag) — reverted via the same `DROP TABLE platt_parameters CASCADE` migration that removed the table.

**Resolution**: `calibration.ts`, its test, and `corpus/cli/train-platt.ts` deleted; aggregator passes the raw weighted-sum score through unchanged; `is_calibrated` removed from `PredictionResult`. CALIB-01/02/03/05 cancelled (see REQUIREMENTS.md). CALIB-04 unaffected — it lives in Phase 17 (smoke billing) and doesn't depend on Platt.

**If calibration is ever revisited**, it must be on production-aligned data: capture `/api/analyze` predictions in production, join with engagement outcomes after a 7-30d window, refit on those. This is a multi-week effort gated on production data infrastructure; out of scope for the Engine Hardening milestone.

### Phase 16: Audio Fingerprint + Embedder Re-enable — **DEFERRED 2026-05-25**

**Status**: Deferred to a future milestone. Audio fingerprint matching is not a primary viral signal for the current use case.

**Why deferred**: Sound-driven trend-riding is secondary to caption/visual signals for the target creator profile. AUDIO-01–05 are not blocking milestone closure. The 17 `.skip`'d tests remain deferred alongside.

**IN-03 extracted**: `sound_url` SSRF allowlist (VERIF-04 sub-item IN-03) moved to Phase 18, alongside WR-04/WR-05/IN-01/IN-02, so it lands before milestone merge without requiring the full audio pipeline.

**If audio is ever re-enabled**, resume from this phase: build `embedder.ts` → wire `audio-fingerprint.ts` → re-enable D-F4 cron → unskip 17 tests.

### Phase 17: Smoke Runner Live Billing Wiring
**Goal**: Smoke runner output records actual DashScope International cost (not just estimated) by reading the billing endpoint at end of run.
**Depends on**: Nothing (forks from main alongside 14). Smallest phase — single REQ, ~one plan.
**Requirements**: CALIB-04
**Success Criteria** (what must be TRUE):
  1. Smoke runner output JSON includes a `cost_cents_actual` field alongside the existing `cost_cents_estimated`
  2. `cost_cents_actual` is sourced from a single DashScope billing endpoint call at end of run (not mid-pipeline polling)
  3. Smoke run completes successfully against the live DashScope International account with billing field populated
**Plans**: TBD

### Phase 18: M1 Verification Debt Closure
**Goal**: All M1 verification debt (Phases 2/3/4/6 deferrals) is either resolved with passing UAT/smoke or moved to an explicit "permanently deferred" list with rationale. Code-review follow-ups WR-04, WR-05, IN-01, IN-02, and IN-03 SSRF allowlist land.
**Depends on**: Phases 14, 17 (sequenced last — code-review items touch files modified by earlier phases. Phase 15 dropped; Phase 16 deferred; no embedder/audio dependency.)
**Requirements**: VERIF-01, VERIF-02, VERIF-03, VERIF-04 (WR-04, WR-05, IN-01, IN-02, IN-03 sub-items — IN-03 moved here from deferred Phase 16)
**Success Criteria** (what must be TRUE):
  1. `.planning/research/verif-phase2-uat.md` records Phase 2 creator-profile 9-card interview UAT pass/fail end-to-end against the deployed app
  2. Phase 3 SC#4 + SC#5 (post-deploy `/api/analyze` SSE + cache hit smoke) flipped from DEFERRED-PENDING-LIVE-DEPLOY to MET (or explicit defer-permanently decision logged)
  3. Phase 4 HUMAN-UAT pending live-API tests (Wave 0 content-type via `/api/analyze`; niche-detector `cost_cents > 0` with cache breakdown absent) executed and recorded
  4. Phase 6 follow-ups land: cron N+1 refactored to bulk pre-fetch (WR-04), `audio_description` bounds nesting flattened (WR-05), `analyzeVideoWithGemini` video-analysis path uses try/finally for `clearTimeout` (IN-01), `vector as unknown as string` cast centralized into `src/lib/supabase/pgvector.ts` (IN-02), `sound_url` SSRF allowlist landed (IN-03, T-06-13)
  5. `pnpm vitest run` and `pnpm exec tsc --noEmit` still green after all changes; no new regressions introduced
**Plans**: 4 plans
  - [x] 18-01-PLAN.md — Verify WR-04 + WR-05 (read-only) and centralize IN-02 (create src/lib/supabase/pgvector.ts, replace 2 call sites)
  - [x] 18-02-PLAN.md — IN-01 timer-leak fix in src/lib/engine/deepseek.ts + src/lib/engine/rules.ts (add clearTimeout to catch blocks)
  - [x] 18-03-PLAN.md — IN-03 SSRF guard in processSoundEmbedding (closes Phase 12 T-06-13) + phase-final tsc/vitest gate
  - [ ] 18-04-PLAN.md — VERIF-01/02/03 manual UAT/smoke checklists + human checkpoint to record outcomes

## Progress

**Execution Order:**
Phases 14, 16, 17 may fork in parallel from the milestone branch base. Phase 15 dropped 2026-05-24. Phase 18 sequences last after 14/16/17 land.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Type Hygiene & user_settings Resolution | 2/2 | Complete    | 2026-05-24 |
| 15. Calibration Refit on Qwen Corpus | — | DROPPED | 2026-05-24 |
| 16. Audio Fingerprint + Embedder Re-enable | — | DEFERRED | 2026-05-25 |
| 17. Smoke Runner Live Billing Wiring | 1/1 | Complete | 2026-05-25 |
| 18. M1 Verification Debt Closure | 4/4 | Complete | 2026-05-25 |

## Coverage

All 19 REQ-IDs from REQUIREMENTS.md mapped to exactly one phase. VERIF-04 sub-items all land in Phase 18: IN-03 moved here from deferred Phase 16; WR-04, WR-05, IN-01, IN-02 were always Phase 18.

| REQ-ID | Category | Phase | Notes |
|--------|----------|-------|-------|
| CALIB-01 | Calibration | ~~15~~ | **Cancelled 2026-05-24** — Platt calibration dropped from engine; framing mismatch (text-vs-video, corpus-vs-production). |
| CALIB-02 | Calibration | ~~15~~ | **Cancelled 2026-05-24** — was contingent on CALIB-01 refit landing. |
| CALIB-03 | Calibration | ~~15~~ | **Cancelled 2026-05-24** — Wave 3/4 thresholds remain at current values; no calibration-driven retune. |
| CALIB-04 | Calibration | 17 | Smoke runner DashScope billing (independent of calibration chain — still active). |
| CALIB-05 | Calibration | ~~15~~ | **Cancelled 2026-05-24** — `is_calibrated` field removed from PredictionResult; verification moot. |
| AUDIO-01 | Audio | ~~16~~ | **Deferred 2026-05-25** |
| AUDIO-02 | Audio | ~~16~~ | **Deferred 2026-05-25** |
| AUDIO-03 | Audio | ~~16~~ | **Deferred 2026-05-25** |
| AUDIO-04 | Audio | ~~16~~ | **Deferred 2026-05-25** |
| AUDIO-05 | Audio | ~~16~~ | **Deferred 2026-05-25** |
| TYPES-01 | Types | 14 | user_settings consumer audit |
| TYPES-02 | Types | 14 | Migrate-vs-rip decision |
| TYPES-03 | Types | 14 | Path a: migration + RLS (if chosen) |
| TYPES-04 | Types | 14 | Path b: rip-out (if chosen) |
| TYPES-05 | Types | 14 | tsc --noEmit clean app-wide |
| VERIF-01 | Verification | 18 | Phase 2 UAT |
| VERIF-02 | Verification | 18 | Phase 3 SC#4 + SC#5 live-deploy smoke |
| VERIF-03 | Verification | 18 | Phase 4 HUMAN-UAT live-API tests |
| VERIF-04 | Verification | 18 | All sub-items → 18: IN-03 (moved from deferred Phase 16) + WR-04/05 + IN-01/02 |

**Coverage:** 19/19 REQ-IDs mapped. No orphans. No duplicates.
