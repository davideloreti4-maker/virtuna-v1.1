---
phase: 10-account-read-saved-shelf-recalibration-flywheel
plan: 06
subsystem: flywheel-recalibration-propose
tags: [flywheel, recalibration, propose, confirm, drift, cron, regression-gate, human-in-the-loop]

# Dependency graph
requires:
  - phase: 10
    plan: 01
    provides: "evaluateGate (confidence gate) + buildOverride (bounded delta) + reconcile (calibration/craft split)"
  - phase: 10
    plan: 02
    provides: "reconciliation-repo (listReconciliations, updateProposalState) + outcome_signatures/reconciliations tables (unpushed)"
  - phase: 10
    plan: 03
    provides: "reconcile-on-capture path that writes the logged reconciliation rows the gate consumes"
  - phase: 07-audience
    provides: "audience-repo (getAudience/updateAudience, GENERAL_AUDIENCE/PRESET_AUDIENCES), calibrateFromScrape, persona disposition shares"
provides:
  - "propose.ts: getPendingProposals/confirmProposal/declineProposal (gate→override write, General/preset refused)"
  - "GET/POST /api/flywheel/proposals: auth-first pending-proposal read + confirm/decline write"
  - "recalibration-nudge.tsx: one propose→confirm component, source 'outcome'|'drift' selects copy, shared confirm path"
  - "use-recalibration-proposals.ts: query pending + confirm/decline mutations (disabled for General/preset)"
  - "GET /api/cron/audience-drift: weekly own-account re-scrape → drift_scrape outcome row → SAME reconcile/gate/propose path"
  - "vercel.json: /api/cron/audience-drift '0 5 * * 1' cron entry"
affects: [10-07-db-push-regen, account-read-surface, audience-manager-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proposal identity = the gate-passing CALIBRATION disposition (no separate proposal rows); confirm/decline transition the contributing reconciliation rows' proposal_state"
    - "Regression-gate guard centralised in propose.ts isRecalibratableAudience() — General/preset refused on BOTH read (null) and write (throw)"
    - "Drift folds into the SAME path (D-01): drift_scrape outcome row → reconcile → reconciliations insert, identical to outcome capture"
    - "Cron uses createServiceClient (RLS-bypass) + reads user_id from the audience row — the session-deriving repos are bypassed for the background job (direct table insert with the audience's user_id)"
    - "Nudge never renders speculatively: render gated on the server-evaluated proposal (use-recalibration-proposals), below-gate = null = nothing"

key-files:
  created:
    - src/lib/flywheel/propose.ts
    - src/app/api/flywheel/proposals/route.ts
    - src/lib/flywheel/__tests__/propose.test.ts
    - src/components/flywheel/recalibration-nudge.tsx
    - src/hooks/queries/use-recalibration-proposals.ts
    - src/app/api/cron/audience-drift/route.ts
  modified:
    - vercel.json
    - src/lib/queries/query-keys.ts

key-decisions:
  - "Proposal id = disposition string (no DB proposal row). A proposal is one gate-passing calibration disposition; confirm/decline mark the contributing reconciliation rows (those carrying a divergence for it, still pending) confirmed/declined — so a declined proposal's rows are excluded from the next gate pass (no re-nag)."
  - "Cron writes outcome_signatures/reconciliations rows DIRECTLY (service client, audience.user_id), not via the session-deriving repos — insertOutcomeSignature/insertReconciliation call getUser() which has no session in a cron context. Same column shape, source='drift_scrape', proposal_state='logged'."
  - "Drift composition vector = aggregate of CalibratedPersona.share by disposition (fresh re-scrape personas = realized, stored audience personas = predicted). No shift / no stored mix / thin re-scrape → no drift row (honesty spine, mirrors P7 thin gate)."
  - "Nudge disposition copy maps collector→savers / connector→sharers / converter→buyers for the human-readable body; the outcome headline stays verbatim ('Your buyers ran warmer than we modeled.')."
  - "query-keys.recalibration.proposals(audienceId) added; the hook is disabled for 'general'/'preset-*' ids so the regression-gate audiences never even round-trip."

requirements-completed: [FLYWHEEL-04, FLYWHEEL-05, FLYWHEEL-06]

# Metrics
duration: ~7min
completed: 2026-06-19
---

# Phase 10 Plan 06: Recalibration Flywheel — Propose → Confirm → Drift Summary

**Closes the moat loop (predict→post→measure→reconcile→correct→compound): a confidence-gated PROPOSE surfaces only past the ≥N consistent-posts gate, a creator CONFIRM writes a bounded, normalized override onto the active non-general audience's persona_weights (never General/preset/DEFAULT/ENGINE_VERSION), a DECLINE logs without re-nagging, and the weekly drift cron re-scrapes each personal account and folds a composition shift into the SAME reconcile/gate/propose path — human-in-the-loop and regression-gate intact, zero new packages.**

## Performance

- **Duration:** ~7 min
- **Started / Completed:** 2026-06-19
- **Tasks:** 3 (Task 1 TDD)
- **Files created:** 6 · **Files modified:** 2

## Accomplishments

- **Task 1 — Propose + confirm/decline (gate → override write, regression-safe):** `propose.ts` orchestrates Plan 01's pure core (`evaluateGate` + `buildOverride`) against the Plan 02 repos + the audience object. `getPendingProposals` short-circuits to `null` for General/preset (no query), lists reconciliations, filters to PENDING rows only (logged/proposed), runs the gate, and returns a `PendingProposalSet` enriched with `proposalId` (= disposition) + human-readable `direction`. `confirmProposal` HARD-GUARDS General/preset (throws), re-evaluates the gate to recover the signed mean, builds the bounded override against the audience's CURRENT weights, writes ONLY `persona_weights` via `updateAudience`, and marks the contributing rows `confirmed`. `declineProposal` marks those rows `declined` (no re-nag). `GET/POST /api/flywheel/proposals` is auth-first (`getUser()` 401 gate), user_id session-derived, regression-gate refusals surfaced as 400. **TDD:** `propose.test.ts` — gate-pass→proposal, below-gate→null, General/preset→null, confirm writes a normalized override + marks confirmed, **General-unchanged regression anchor** (confirm rejected, `updateAudience` never called, General weights still the DEFAULT mix), decline→declined + not re-surfaced (8 tests, all green).
- **Task 2 — Recalibration / Drift nudge (one component, two triggers, FLYWHEEL-04):** `recalibration-nudge.tsx` — a single propose→confirm component taking `source: 'outcome' | 'drift'`. Verbatim UI-SPEC copy: outcome headline "Your buyers ran warmer than we modeled." / drift "Your audience has shifted."; bodies interpolate `{N}`/disposition/`{audienceName}`; Confirm "Recalibrate" (accent primary), Decline "Not now" (secondary), honesty footnote always present, post-confirm "Recalibrated. Future Reads use the updated audience." It renders ONLY when `use-recalibration-proposals` returns a pending proposal (gate passed server-side) — below-gate = `null` = nothing; never speculative. `use-recalibration-proposals.ts` exposes the query (disabled for 'general'/'preset-*') + a confirm/decline mutation that invalidates on settle. Keyboard-operable (native `<button>`s via the Button primitive). Flat-warm SSOT; accent ONLY on the Recalibrate CTA.
- **Task 3 — Drift cron (folds into the propose path, FLYWHEEL-06):** `GET /api/cron/audience-drift` mirrors `cron/scrape-trending` — `verifyCronAuth(request)` first, `createServiceClient()`. For each PERSONAL audience with a `calibration.handle`: `calibrateFromScrape` re-scrapes the own account → fresh `CalibratedPersona[]` → `compositionVector()` aggregates persona shares by disposition (realized = fresh, predicted = stored mix). On a shift (and a non-thin re-scrape with a stored mix), it inserts an `outcome_signatures` row `source='drift_scrape'` then runs the SAME `reconcile` + `reconciliations` insert (`proposal_state='logged'`) — identical to outcome capture (D-01). Thin/failed re-scrape or no shift → no drift row (honesty spine). Skips is_general/preset. `vercel.json` gains `/api/cron/audience-drift` `"0 5 * * 1"` ([ASSUMED] A4 marked in the route comment); the 8 existing crons are preserved.

## Task Commits

1. **Task 1: propose/confirm/decline — gate→override write, regression-safe** — `9cbb6c67` (feat, TDD test+impl)
2. **Task 2: recalibration/drift nudge — one component, two triggers** — `b2c186f0` (feat)
3. **Task 3: drift cron — scheduled re-scrape folds into propose path** — `d7ebaa35` (feat)

## Files Created/Modified

- `src/lib/flywheel/propose.ts` — propose→confirm→decline orchestration; `isRecalibratableAudience` guard; writes ONLY persona_weights.
- `src/app/api/flywheel/proposals/route.ts` — auth-first GET (pending proposal) + POST (confirm/decline); regression refusal → 400.
- `src/lib/flywheel/__tests__/propose.test.ts` — 8 tests incl. the General-unchanged regression anchor.
- `src/components/flywheel/recalibration-nudge.tsx` — one nudge, two `source` triggers, verbatim copy, honesty footnote, no auto-apply.
- `src/hooks/queries/use-recalibration-proposals.ts` — query + confirm/decline mutations, disabled for General/preset.
- `src/app/api/cron/audience-drift/route.ts` — cron-authed weekly drift re-scrape → drift_scrape outcome → same reconcile/gate path.
- `vercel.json` — appended the drift cron (8 existing preserved).
- `src/lib/queries/query-keys.ts` — added `recalibration.proposals(audienceId)`.

## Decisions Made

- **Proposal identity is the disposition, not a DB row.** The gate produces per-disposition proposals from the reconciliation rows; there is no separate proposal table. `proposalId` = the disposition string, and confirm/decline transition the contributing reconciliation rows' `proposal_state`. This keeps the data model exactly what Plan 02 shipped and makes "don't re-nag a decline" fall out for free (declined rows are excluded from the next gate evaluation).
- **The cron inserts the rows directly (service client + audience.user_id), bypassing the session-deriving repos.** `insertOutcomeSignature`/`insertReconciliation` derive `user_id` from `supabase.auth.getUser()`, which has no session inside a cron. The cron uses `createServiceClient()` (RLS-bypass for background jobs, the established `cron/scrape-trending` idiom) and reads `user_id` off each audience row — never from request input. Same column shape, `source='drift_scrape'`, `proposal_state='logged'`.
- **Drift composition vector = aggregate of `CalibratedPersona.share` by disposition.** Fresh re-scrape personas = realized; stored audience personas = predicted. This is the honest v1 signal the current calibration math exposes (see Deferred Issues for the engine-side sensitivity caveat). No stored mix / no shift / thin re-scrape → no drift row.
- **Disposition→label map for the human copy** (collector→savers, connector→sharers, converter→buyers) keeps the outcome body readable while the headline stays the verbatim UI-SPEC string.

## Deviations from Plan

None — the plan executed as written. The two structural choices the plan left open (proposal identity model; how the cron writes under no session) are documented as Decisions above, not deviations: both stay strictly inside the plan's contract (same tables, same reconcile/gate path, regression gate intact).

## Authentication Gates

None. `/api/flywheel/proposals` is auth-first (`getUser()` 401 before any work); `/api/cron/audience-drift` is `verifyCronAuth` + `CRON_SECRET` gated. No interactive login/2FA in the build path.

## Issues Encountered

None beyond the cron-no-session insert path (resolved via the service-client direct insert, Decision 2) and the removal of the unused `insertOutcomeSignature`/`insertReconciliation` imports once the direct-insert path was chosen.

## User Setup Required

None — zero new packages (RESEARCH Package Legitimacy Audit; T-10-SC). **DB push remains deferred to Plan 07** (BLOCKING gate): `propose.ts`, the proposals route, and the drift cron run against the unpushed migrations via the `(supabase as any)` interim casts (the repos carry `TODO(10-07)`; the cron's direct inserts use the same cast). Live behavior of confirm/decline and the drift cron is exercisable only after the Plan-07 `supabase db push`. The drift cron also requires `CRON_SECRET` + `APIFY_TOKEN` set in the Vercel environment.

## Deferred Issues

- **Composition-shift sensitivity is an engine-side concern (out of scope, Plan 07+ / calibration refinement).** `deriveAudienceProfile` currently derives dispositions profile-agnostically (from the goal-intent weight bias, not the scraped composition), so a fresh re-scrape with the same `goal_intent` produces the same persona disposition shares as the stored mix — meaning the drift `hasShift` check will, in practice, rarely fire until the calibration engine derives real composition from scraped signals. The drift PATH is complete and correct (it writes a drift_scrape row and folds into the same reconcile/gate/propose path the moment a shift exists); making the shift *detectable* is a calibration-math change, not a flywheel-wiring change, and is deferred. Logged here so the verifier and Plan 07 see it.

## Known Stubs

None that block the plan's goal. `propose.ts`, the proposals route, the nudge, the hook, and the drift cron are fully wired against the real repos / audience-repo / calibration path. The only deferred dependencies are (a) the DB push (Plan 07, by design) and (b) the engine-side composition sensitivity above (out of scope).

## Threat Flags

None. The plan's `<threat_model>` is fully covered: T-10-15 (silent recalibration) — confirm refuses General/preset + writes only persona_weights + the General-unchanged regression anchor test; T-10-16 (confirming another user's proposal) — auth-first `getUser()` + RLS + session user_id; T-10-17 (unauthorized drift cron) — `verifyCronAuth` + `CRON_SECRET`; T-10-18 (single-post / silent) — gate ≥N_MIN + always propose→confirm + no auto-apply; T-10-SC — zero new packages. No new trust boundary introduced beyond those enumerated.

## Verification

- `npx vitest run src/lib/flywheel/` → **49 passed / 0 failed** (41 prior + 8 new propose tests), INCLUDING the General-unchanged regression anchor.
- `npm run build` → **Compiled successfully**; `/api/flywheel/proposals` + `/api/cron/audience-drift` both registered as ƒ (dynamic) routes.
- `grep getUser src/app/api/flywheel/proposals/route.ts` → present (auth-first).
- `grep verifyCronAuth` + `grep drift_scrape` on the cron route + `grep audience-drift vercel.json` → all present.
- `vercel.json` → valid JSON, 9 crons (8 preserved + 1 new); the new entry is `/api/cron/audience-drift` `"0 5 * * 1"`.
- `npx eslint` on all 6 created files + the 2 modified → clean (exit 0). (Repo-wide pre-existing lint debt in unrelated files is out of scope per the executor SCOPE BOUNDARY.)
- key_links: propose→`updateAudience` (persona_weights) ✓; cron→drift_scrape outcome row→same reconcile/insert path ✓; nudge→`/api/flywheel/proposals` confirm/decline ✓.

## Next Phase Readiness

- **Plan 07 must:** run `supabase db push`, regenerate `database.types.ts`, remove the `(supabase as any)` casts (incl. the drift cron's direct inserts + the TODO(10-07) repo casts), and UAT the live drift cron against a real `APIFY_TOKEN` + `CRON_SECRET`.
- **Surface wiring (Account Read / Audience Manager):** `RecalibrationNudge` is ready to mount with `source='outcome'` after an outcome divergence and `source='drift'` on the audience surface; it self-gates on the server proposal so it can be mounted unconditionally where an audience is in scope.
- **Composition-shift sensitivity** (Deferred Issues) is the one open thread for the drift trigger to fire in practice — a calibration-engine change, tracked for Plan 07+ / the owner's calibration refinement run.

## Self-Check: PASSED

- All 6 created files + 2 modified files verified on disk.
- All 3 task commits verified in git history (9cbb6c67, b2c186f0, d7ebaa35).
- Build + 49 flywheel tests (incl. regression anchor) + targeted eslint all green; vercel.json valid with the new cron appended.

---
*Phase: 10-account-read-saved-shelf-recalibration-flywheel*
*Completed: 2026-06-19*
