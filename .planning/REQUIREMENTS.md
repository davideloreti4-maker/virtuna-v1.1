# Requirements — Engine Hardening (M2-1b)

**Milestone:** Engine Hardening
**Branch:** `milestone/engine-hardening`
**Parallel sibling:** Result Surface (`~/virtuna-result-surface/`, branch `milestone/result-surface`)
**M1 carry-forward source:** `.planning/MILESTONES.md` (Engine Foundation closure block, dated 2026-05-24) + `.planning/STATE.md` of the Engine Foundation worktree

This document scopes ONLY the engine-side debt left open by M1 (Engine Foundation). UX-side work is owned by the Result Surface milestone — out of scope here.

---

## Active requirements (this milestone — checkbox = ships before merge)

### Category: CALIB — Calibration & threshold re-fit on Qwen

- [ ] **CALIB-01**: `platt_parameters` table has a fresh row with `engine_version = '3.0.0'`, `trained_at` post-2026-05-24, and `sample_count` matching the Qwen-scored corpus size. Old text-mode-trained row preserved as historical reference (not deleted).
- [ ] **CALIB-02**: M1 Plans 06/07 stratified validation rerun under the Qwen pipeline. Output written to `.planning/research/qwen-stratified-validation.md` and includes per-video diff, score-band stratification (low / mid / high confidence buckets), and the video-06 snapshot. Macro_f1 ≥ 0.338 OR an explicit decision logged about whether to retune thresholds, refit the model, or accept a lower bar with rationale.
- [ ] **CALIB-03**: Wave 3 persona threshold (`≥7/10 personas`) and Wave 4 numeric `platform_fit` threshold re-tuned for the Qwen score distribution. New threshold values committed to `src/lib/engine/aggregator.ts` (or wherever they live) with a comment citing the tuning report.
- [ ] **CALIB-04**: Smoke runner output (`scripts/run-smoke.ts` or equivalent) records a `cost_cents_actual` field sourced from the DashScope International billing endpoint, persisted alongside the existing `cost_cents_estimated`. Reads at end of run only (not mid-pipeline).
- [ ] **CALIB-05**: `is_calibrated = true` flows through aggregator output for new analyses post-deploy — verified by a single live `/api/analyze` E2E run with the calibrated row in place.

### Category: AUDIO — Audio-fingerprint + embedder re-enable

- [ ] **AUDIO-01**: `src/lib/engine/embedder.ts` is created (currently does not exist). Exports `embedQuery(text: string): Promise<number[]>` and `embedBatch(texts: string[]): Promise<number[][]>` against DashScope `text-embedding-v3` (768-dim, matches existing pgvector schema). No fallback to Gemini.
- [ ] **AUDIO-02**: `src/lib/engine/audio-fingerprint.ts` returns a real match result (not `null`). Uses the existing `match_trending_sound_by_audio` RPC + the new embedder. Live E2E `/api/analyze` run against a known video produces non-null `audio_fingerprint.match_id` and `similarity > 0`.
- [ ] **AUDIO-03**: Inline D-F4 cron embedding pipeline at `src/app/api/cron/calculate-trends/route.ts` re-enabled. Removes the "DEFERRED to M2" branch; trending sounds with `audio_embedding IS NULL` get embedded inline up to the per-tick cost ceiling (~$0.025/day). Idempotent against the existing `audio_embedding IS NOT NULL` predicate.
- [ ] **AUDIO-04**: Three `.skip` blocks unskipped: `embedder.test.ts` (`embedQuery deferred to M2`, `embedBatch deferred to M2`) and `calculate-trends/__tests__/route.test.ts` (`D-F4 inline embedding pipeline (Phase 6 Plan 06-06)`). All tests in those blocks pass.
- [ ] **AUDIO-05**: DashScope embedding API quota verified to handle the ongoing trending-sounds ingest rate (~50 sounds/day × 768-dim batch). Cost-budget alert raised in the smoke runner if a single tick exceeds the per-day ceiling.

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
| CALIB-01 | 15 | pending |
| CALIB-02 | 15 | pending |
| CALIB-03 | 15 | pending |
| CALIB-04 | 17 | pending |
| CALIB-05 | 15 | pending |
| AUDIO-01 | 16 | pending |
| AUDIO-02 | 16 | pending |
| AUDIO-03 | 16 | pending |
| AUDIO-04 | 16 | pending |
| AUDIO-05 | 16 | pending |
| TYPES-01 | 14 | Complete |
| TYPES-02 | 14 | Complete |
| TYPES-03 | 14 | Complete |
| TYPES-04 | 14 | Complete |
| TYPES-05 | 14 | Complete |
| VERIF-01 | 18 | pending |
| VERIF-02 | 18 | pending |
| VERIF-03 | 18 | pending |
| VERIF-04 | 16, 18 | pending |

**Note on VERIF-04:** Parent item splits across two phases by sub-item:
- Phase 16: IN-03 (sound_url SSRF allowlist — co-located with audio pipeline)
- Phase 18: WR-04, WR-05, IN-01, IN-02 (code-review follow-ups; sequenced last)

Roadmapper filled the Phase + Status columns when the milestone roadmap was drafted (2026-05-24).
