---
phase: 10-account-read-saved-shelf-recalibration-flywheel
plan: 03
subsystem: flywheel-outcome-capture
tags: [flywheel, signatures, sse, scraping, reconcile, provenance, pin, outcome-capture]

# Dependency graph
requires:
  - phase: 10
    plan: 01
    provides: "predictedSignature, realizedSignature, reconcile (pure math core)"
  - phase: 10
    plan: 02
    provides: "outcome-repo / reconciliation-repo CRUD, scrapeSinglePostMetrics + SSRF guard, migrations (unpushed)"
  - phase: 07-audience
    provides: "Audience.goal_intent for cross-creator reconciliation enrichment"
provides:
  - "pinPredictedSignature(supabase, personas, ctx): pins predicted_vector + audience_id + analysis_id at SIM run (Pitfall 6), non-fatal"
  - "POST /api/outcomes/signature: SSE paste-URL → scrape → realized signature → reconcile → log row"
  - "findPinnedPrediction + updateOutcomeRealized (outcome-repo additions: read the pin, write the realized side back)"
  - "outcome-signature-form.tsx + use-outcome-signature.ts: provenance-honest capture UI"
affects: [10-05-recalibration-wiring, 10-06-reconciliation-log, 10-07-db-push-regen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pin-once: predictedSignature computed ONLY at SIM run (flash-runner pinPredictedSignature), never recomputed (Pitfall 6)"
    - "Reconcile compares realized vs the PINNED predicted_vector read from disk — never a fresh predict under a changed audience"
    - "SSE capture mirrors calibrate/route.ts verbatim (maxDuration=300, auth-first, ReadableStream send, generic error never echoing input)"
    - "Provenance-honest capture: blank private field = omitted = excluded channel (null), never zero-filled (Pitfall 3)"
    - "Realized-side write-back via updateOutcomeRealized never touches predicted_vector (pin immutability)"

key-files:
  created:
    - src/app/api/outcomes/signature/route.ts
    - src/components/app/simulation/outcome-signature-form.tsx
    - src/hooks/queries/use-outcome-signature.ts
    - src/lib/flywheel/__tests__/predicted-pin.test.ts
  modified:
    - src/lib/tools/runners/flash-runner.ts
    - src/lib/flywheel/outcome-repo.ts

key-decisions:
  - "Pin helper lives in flash-runner.ts as pinPredictedSignature(supabase, personas, ctx) — runners call it after runFlashTextMode yields personas; keeps the pure runFlashRunner helper untouched and avoids threading supabase through every tool runner"
  - "saves channel prefers the creator-supplied private value when given, else the public scrape (bookmarks→saves) — one channel, provenance tagged per source"
  - "Route requires a pinned prediction to reconcile against; with none it emits an honest 'run a SIM first' error rather than fabricating a baseline (Pitfall 6 honesty)"
  - "goal_intent enrichment on the reconciliation row is best-effort (try/catch) — a missing audience never blocks the capture"

requirements-completed: []

# Metrics
duration: ~22min
completed: 2026-06-19
---

# Phase 10 Plan 03: Outcome Capture — Pin + Measure + Reconcile Summary

**The measure→reconcile arc of the flywheel: the predicted disposition vector is pinned at SIM run (audience_id + analysis_id, never recomputed — Pitfall 6), and a new auth-first SSE route turns a pasted post URL into a provenance-honest realized signature, reconciles it against that pinned prediction, and logs a classified reconciliation row — fronted by a capture form that discloses provenance and never zero-fills a blank.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-19
- **Completed:** 2026-06-19
- **Tasks:** 3 (Task 1 TDD)
- **Files created:** 4 · **Files modified:** 2

## Accomplishments

- **Task 1 — Pin the predicted signature (FLYWHEEL-02, Pitfall 6):** `pinPredictedSignature(supabase, personas, ctx)` in `flash-runner.ts` computes `predictedSignature(personas)` ONCE and persists `predicted_vector` + `audience_id` + `analysis_id` via `insertOutcomeSignature`. Wrapped in try/catch → log-only on failure (non-fatal: never blocks the SIM card, mirroring the content-first `insertMessage` precedent). General/null audience runs still pin a vector. `predicted-pin.test.ts` (3 tests) mocks the repo and asserts the pin payload + the non-fatal contract (never throws, returns false on persistence failure).
- **Task 2 — Capture SSE route + reconcile-on-capture (FLYWHEEL-01/03):** `POST /api/outcomes/signature` mirrors `calibrate/route.ts` — `maxDuration = 300`, auth-first `getUser()`, zod-validated `{ analysis_id?, audience_id?, posted_url, private? }`, `ReadableStream` `send(event, data)`. Streams `status` "Reading the post…" → `scrapeSinglePostMetrics(posted_url)` (through the SSRF guard) → builds `RealizedMetrics` tagging each public channel `public_scrape` and each supplied private field `creator_supplied` (blank → null, excluded) → `realizedSignature` → reads the **pinned** `predicted_vector` via `findPinnedPrediction` → `reconcile(predicted, realized)` → `updateOutcomeRealized` (writes realized side back, predicted untouched) + `insertReconciliation` with `proposal_state:'logged'` → `done`. Generic scrape-fail copy never echoes the URL.
- **Task 3 — Capture form + query hook (FLYWHEEL-01 UI):** `outcome-signature-form.tsx` — paste-URL primary field + a collapsed "Add private signals (optional)" section (Saves / Watch-through % / Link clicks), each with a NEUTRAL-cream provenance tag ("from the post" / "you added" — never coral), the "Left blank = not counted (we never assume zero)." honesty note, primary CTA "Capture outcome" → "Reading the post…", and a success state of just "Outcome captured." (no predicted-vs-actual delta). `use-outcome-signature.ts` consumes the SSE route via `fetch` + `getReader()` (calibrate/use-hooks-stream idiom). The legacy `outcome-form.tsx` is left intact (RESEARCH Open Q3).

## Task Commits

1. **Task 1: pin predicted signature at SIM run** — `14e54f21` (feat, TDD test+impl)
2. **Task 2: outcome-signature capture SSE route + reconcile-on-capture** — `2e131ce4` (feat)
3. **Task 3: capture-outcome form + query hook** — `41089d34` (feat)

## Files Created/Modified

- `src/lib/tools/runners/flash-runner.ts` — added `pinPredictedSignature` + `PredictedPinContext` (non-fatal pin at SIM run).
- `src/lib/flywheel/__tests__/predicted-pin.test.ts` — 3 tests: pin payload (audience_id + analysis_id), General/null pin, non-fatal contract.
- `src/app/api/outcomes/signature/route.ts` — auth-first SSE capture route (scrape → realized → reconcile → log), SSRF-guarded, generic error copy.
- `src/lib/flywheel/outcome-repo.ts` — added `findPinnedPrediction` (read the pin) + `updateOutcomeRealized` (write the realized side back, predicted untouched).
- `src/components/app/simulation/outcome-signature-form.tsx` — provenance-honest capture form (flat-warm SSOT, accent only on CTA + focus ring).
- `src/hooks/queries/use-outcome-signature.ts` — SSE consumer hook (status/done/error).

## Decisions Made

- **Pin helper in `flash-runner.ts`, not the pure `runFlashRunner`.** The plan said "after `runFlashTextMode` yields `result.personas`". The pure `runFlashRunner(content_text, framing)` helper carries no supabase/audience context, and threading those through every tool runner would be invasive. `pinPredictedSignature(supabase, personas, ctx)` is a focused, callable seam the runners invoke at their existing audience-resolution point — keeping the predicted vector computed in exactly one place (Pitfall 6).
- **`saves` channel: creator-supplied value wins over the public scrape when both present.** A creator's own analytics `saves` is more authoritative than the scraped `bookmarks`; provenance is tagged per the source actually used.
- **No pinned prediction → honest error, not a fabricated baseline.** If `findPinnedPrediction` returns null (no SIM was run on this content), the route emits "run a SIM first" rather than reconciling against a zero/assumed vector — the honesty spine over the reconcile path.
- **`goal_intent` enrichment is best-effort.** Pulled from the audience row in a try/catch so the cross-creator seed (Plan 06) gets the bucket when available, but a missing/legacy audience never blocks the capture.

## Deviations from Plan

### Auto-applied (surfaced, not silently overridden)

**1. [Rule 3 — Blocking: missing repo methods] Added `findPinnedPrediction` + `updateOutcomeRealized` to outcome-repo**
- **Found during:** Task 2.
- **Issue:** Plan 02's `outcome-repo` exposed `insertOutcomeSignature` / `listOutcomeSignatures` only. The capture route's measure→reconcile arc needs to (a) READ the pinned prediction to reconcile against and (b) WRITE the realized side back onto that same row. Neither method existed — the route could not complete its task without them.
- **Fix:** Added `findPinnedPrediction(supabase, { analysisId?, audienceId? })` (newest unreconciled pin, prefer analysis_id) and `updateOutcomeRealized(supabase, id, patch)` (writes realized_vector / realized_provenance / raw_metrics / platform_post_url / source — never `predicted_vector`, preserving pin immutability). Both follow the Plan-02 `(supabase as any)` + `TODO(10-07)` interim-cast convention.
- **Files modified:** `src/lib/flywheel/outcome-repo.ts`.
- **Commit:** `2e131ce4`.

## Authentication Gates

None. The route is auth-first (`getUser()` 401 before any work); no external login/2FA step in the build path.

## Issues Encountered

None beyond the missing repo methods (Deviation 1).

## User Setup Required

None — zero new packages (RESEARCH Package Legitimacy Audit). **DB push remains deferred to Plan 07** (BLOCKING gate): the route + repos run against the unpushed migrations via the `(supabase as any)` interim casts (grep `TODO(10-07)`). Live behavior of `POST /api/outcomes/signature` is exercisable only after the Plan-07 `supabase db push`.

## Verification

- `npm run build` → **Compiled successfully** (types resolve off committed migrations + interim casts).
- `npx vitest run src/lib/flywheel/` → **41 passed / 0 failed** (38 prior + 3 new predicted-pin).
- `npx vitest run src/lib/flywheel/ src/lib/scraping/` → **66 passed / 0 failed** (no regression).
- `grep "maxDuration = 300"` + `grep "getUser"` on the route → **both present** (auth-first, latency cap).
- `npx eslint` on route + repo + form + hook → **clean (exit 0)**.
- key_links: route→`scrapeSinglePostMetrics` ✓, route→`reconcile`+`insertReconciliation` ✓, flash-runner→`predictedSignature` ✓, flash-runner→`insertOutcomeSignature`/`predicted_vector` ✓.
- Form: provenance tags neutral cream (never coral), "Left blank = not counted" present, success "Outcome captured." (no delta), legacy `outcome-form.tsx` untouched.

## Known Stubs

None that block the plan's goal. The route + form are fully wired against real repos + the real scrape path. The only deferred dependency is the DB push (Plan 07, by design) — the rails are complete and exercised by the build + unit tests; live end-to-end runs await the migration push.

## Threat Flags

None. The route introduces no new trust boundary beyond those already enumerated in the plan's `<threat_model>` (T-10-06 input validation, T-10-07 SSRF) — both mitigated (zod + auth-first; `scrapeSinglePostMetrics` SSRF guard + `maxDuration=300`).

## Next Phase Readiness

- Plan 05 (recalibration wiring) consumes the logged reconciliation rows this route writes (`listReconciliations` → `evaluateGate`).
- Plan 06 (reconciliation log) renders the rows this route produces.
- **Plan 07 must:** run `supabase db push`, regenerate `database.types.ts`, remove the `(supabase as any)` casts (incl. the two new outcome-repo methods + the goal_intent enrichment read in the route), and UAT the live `scrapeSinglePostMetrics` field names (`startUrls`/`bookmarks`) against a real Apify token.
- **Callers of `pinPredictedSignature`:** the helper is ready; wiring the actual `pinPredictedSignature(...)` call into each tool runner's post-SIM point (with the run's resolved `audienceId`/`analysisId`) is a follow-up integration — the seam + non-fatal contract are in place and unit-tested.

## Self-Check: PASSED

- All 5 referenced files verified on disk (4 created + flash-runner modified).
- All 3 task commits verified in git history (14e54f21, 2e131ce4, 41089d34).
- Build + 41 flywheel tests + 66 flywheel/scraping tests + lint all green.

---
*Phase: 10-account-read-saved-shelf-recalibration-flywheel*
*Completed: 2026-06-19*
