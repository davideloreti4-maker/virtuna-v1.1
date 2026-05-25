# Requirements — Engine Hardening (M2-1b)

**Milestone:** Engine Hardening
**Branch:** `milestone/engine-hardening`
**Parallel sibling:** Result Surface (`~/virtuna-result-surface/`, branch `milestone/result-surface`)
**M1 carry-forward source:** `.planning/MILESTONES.md` (Engine Foundation closure block, dated 2026-05-24) + `.planning/STATE.md` of the Engine Foundation worktree

This document scopes ONLY the engine-side debt left open by M1 (Engine Foundation). UX-side work is owned by the Result Surface milestone — out of scope here.

---

## Active requirements (this milestone — checkbox = ships before merge)

### Category: CALIB — Calibration & threshold re-fit on Qwen

**CALIB-01, CALIB-02, CALIB-03, CALIB-05 cancelled 2026-05-24.** Platt calibration removed from the engine entirely after the corpus-vs-production framing mismatch surfaced during Phase 15 execution. The `platt_parameters` table was dropped (`supabase/migrations/20260524130014_drop_platt_parameters.sql`), `calibration.ts` deleted, `is_calibrated` removed from `PredictionResult`. See `.planning/phases/15-calibration-refit-on-qwen-corpus/15-DISCUSSION-LOG.md` for the audit.

**CALIB-04 closed 2026-05-25** — scoped down during Phase 17 discussion: `qwen3.5-omni-plus` is free during preview, making billing-API ground truth $0 for the heaviest wave. Existing `cost_cents` field is already token-usage-based (`calculateCost(model, response.usage)`). Resolution: renamed `cost_cents` → `cost_cents_estimated` in `scripts/smoke-tiktok-pipeline.ts` output schema. Billing API deferred until omni exits free preview.

- [~] ~~**CALIB-01**: `platt_parameters` table has a fresh row with `engine_version = '3.0.0'`...~~ **CANCELLED 2026-05-24** — table dropped; calibration removed.
- [~] ~~**CALIB-02**: M1 Plans 06/07 stratified validation rerun under the Qwen pipeline...~~ **CANCELLED 2026-05-24** — was contingent on CALIB-01.
- [~] ~~**CALIB-03**: Wave 3 persona threshold and Wave 4 numeric platform_fit threshold re-tuned...~~ **CANCELLED 2026-05-24** — thresholds remain at current values.
- [x] ~~**CALIB-04**: Smoke runner output records a `cost_cents_actual` field sourced from DashScope billing...~~ **CLOSED 2026-05-25** — renamed `cost_cents` → `cost_cents_estimated` in smoke runner; billing API deferred (see Phase 17 CONTEXT.md).
- [~] ~~**CALIB-05**: `is_calibrated = true` flows through aggregator output...~~ **CANCELLED 2026-05-24** — `is_calibrated` field removed from PredictionResult.

### Category: AUDIO — Audio-fingerprint + embedder re-enable — **DEFERRED 2026-05-25**

Audio fingerprint matching is not a primary viral signal for the current use case. All AUDIO REQs deferred to a future milestone. The 17 `.skip`'d tests remain deferred alongside. IN-03 (SSRF allowlist, originally co-located here) moved to VERIF-04 in Phase 18.

- [~] ~~**AUDIO-01**~~: embedder.ts create — **Deferred**
- [~] ~~**AUDIO-02**~~: audio-fingerprint.ts real match — **Deferred**
- [~] ~~**AUDIO-03**~~: D-F4 cron re-enable — **Deferred**
- [~] ~~**AUDIO-04**~~: Unskip 17 tests — **Deferred**
- [~] ~~**AUDIO-05**~~: Quota + per-tick ceiling alert — **Deferred**

### Category: TYPES — Type hygiene + user_settings resolution

- [x] **TYPES-01**: `user_settings` consumer audit complete. Audit identifies all live call sites in `src/app/api/{profile,settings,team}/*` (current count: 9 grep hits across profile, profile/avatar, settings/notifications, plus team paths). Audit output checked in to `.planning/research/user-settings-audit.md` and includes for each call site: is the route reachable from the deployed UI, what fields does it touch, and what breaks if the table never lands.
- [x] **TYPES-02**: Decision logged: write the `user_settings` migration (path a) OR rip out the consumers (path b). Default per MILESTONE.md is path a; choose path b only if the audit shows the routes are dead.
- [x] **TYPES-03**: If path a: `user_settings` table migration applied to live Supabase (`qyxvxleheckijapurisj`) with RLS policies. `database.types.ts` regenerated. Hand-patched types removed.
- [x] **TYPES-04**: If path b: dead API routes deleted, imports cleaned up, `database.types.ts` regenerated.
- [x] **TYPES-05**: `pnpm exec tsc --noEmit` returns 0 errors across the entire app — not just `src/lib/engine/`. (Current baseline: 966 errors in `src/app/api/{profile,settings,team}/*`.)

### Category: VERIF — M1 verification-debt closure

- [ ] **VERIF-01**: Phase 2 (Creator Profile) UAT executed end-to-end against the deployed app. The 9-card interview modal completes on first upload, fields persist to `creator_profiles`, reference-creator side effect fires. Pass/fail recorded in `.planning/research/verif-phase2-uat.md`.
- [ ] **VERIF-02**: Phase 3 SC#4 + SC#5 (post-deploy smoke tests on `/api/analyze` SSE + cache hit) executed against the live Vercel deploy. Both flip from DEFERRED-PENDING-LIVE-DEPLOY to MET (or an explicit defer-permanently decision is logged with rationale).
- [ ] **VERIF-03**: Phase 4 HUMAN-UAT — the 2 pending live-API tests run: (1) end-to-end Wave 0 content-type via `/api/analyze`, (2) niche-detector `cost_cents > 0` with `cache breakdown absent`. Results recorded.
- [ ] **VERIF-04**: Phase 6 code-review follow-ups closed:
  - **WR-04** — cron `route.ts` N+1 idempotency check refactored to a single bulk pre-fetch of already-embedded `sound_names`.
  - **WR-05** — `audio_description` bounds nesting flattened.
  - **IN-01** — `analyzeVideoWithGemini` video-analysis path (gemini.ts ~lines 515-535) restructured to try/finally so `clearTimeout` fires on both success and failure paths (matches the text-analysis fix in commit `5dec5a3`).
  - **IN-02** — `vector as unknown as string` cast centralized into `src/lib/supabase/pgvector.ts`.
  - **IN-03** — `sound_url` SSRF allowlist landed (Phase 12 threat-model item T-06-13).

---

## Out of scope (deferred to other milestones or explicitly excluded)

- All UX/UI surface work — owned by **Result Surface (M2-1a)** in `~/virtuna-result-surface/`
- New engine signals (`optimal_post_window`, emotion arc data) — owned by Result Surface (small additions there)
- Hook archetype library, trend velocity, outcome feedback loop, wins/flops trend — owned by **Compounding Intelligence (M2-III)** (not yet drafted)
- Concept mode, A/B variant flow, watermark detection — owned by **Iteration & Niche Intelligence (M2-II)** (not yet drafted)
- iOS Capacitor wrapper (M1.5 fast-follow, separate work)
- Switching engine provider away from Qwen/DashScope — Qwen-only is intentional and locked at the M1 closure
- Refactoring `pipeline.ts` or `aggregator.ts` beyond what calibration/threshold re-tune requires — additive-only rule from M1 still applies
- Removing the M1 backup `platt_parameters` row — historical preservation rule

---

## Traceability (filled by roadmap)

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CALIB-01 | ~~15~~ | **cancelled** 2026-05-24 |
| CALIB-02 | ~~15~~ | **cancelled** 2026-05-24 |
| CALIB-03 | ~~15~~ | **cancelled** 2026-05-24 |
| CALIB-04 | 17 | pending |
| CALIB-05 | ~~15~~ | **cancelled** 2026-05-24 |
| AUDIO-01 | ~~16~~ | **deferred** 2026-05-25 |
| AUDIO-02 | ~~16~~ | **deferred** 2026-05-25 |
| AUDIO-03 | ~~16~~ | **deferred** 2026-05-25 |
| AUDIO-04 | ~~16~~ | **deferred** 2026-05-25 |
| AUDIO-05 | ~~16~~ | **deferred** 2026-05-25 |
| TYPES-01 | 14 | Complete |
| TYPES-02 | 14 | Complete |
| TYPES-03 | 14 | Complete |
| TYPES-04 | 14 | Complete |
| TYPES-05 | 14 | Complete |
| VERIF-01 | 18 | pending |
| VERIF-02 | 18 | pending |
| VERIF-03 | 18 | pending |
| VERIF-04 | 18 | pending (all sub-items including IN-03 now in Phase 18) |

**Note on VERIF-04:** All sub-items land in Phase 18:
- IN-03 (sound_url SSRF allowlist) — moved from deferred Phase 16; T-06-13 security item lands before milestone merge
- WR-04, WR-05, IN-01, IN-02 (code-review follow-ups; sequenced last)

Roadmapper filled the Phase + Status columns when the milestone roadmap was drafted (2026-05-24).
