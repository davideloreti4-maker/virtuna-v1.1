# Phase 13 — Cross-Phase Code Review (Phases 9-12)

**Reviewed:** 2026-05-22
**Scope:** Wave wiring correctness, signal fallback paths, silent degradations across phases 9, 10, 11, 12.
**Note:** Read-only artifact. Findings tagged severity → action.

## Legend
- ✅ Passes review — no concerns
- ⚠️ Concern with workaround — fix recommended in follow-up
- ❌ Blocker — must fix before Plan 05 (1-video E2E)
- 📦 Archival note — for superseded artifacts (Phase 12)

## Severity → Action Mapping
- BLOCKER (❌) → Create a Task 4.5 follow-up in this plan
- WARNING (⚠️) → Add to STATE.md "Phase 13 follow-ups"
- INFO (ℹ️) → Acknowledge inline; no action

---

## Phase 9 — Platform-Algo-Fit + Self-Critique + Counterfactuals

### ✅ Wave Wiring — Wave 3 → Wave 4 (platform-fit) transition

**Finding:** Wave 4 (`platform-fit`) runs sequentially AFTER Wave 3 completes and correctly receives `deepseekRaw.reasoning` from Wave 2, not from Wave 3 persona aggregate. There is no direct persona-output-to-platform-fit wiring, which is correct: the platform-fit prompt uses content context + Wave 2 DeepSeek analysis, not Wave 3 persona scores.
**File:line:** `src/lib/engine/pipeline.ts:756-798`
**Severity:** INFO
**Action:** Accept
**Notes:** `runWave3()` is called at line 756; Wave 3 outcome captured at lines 763-768; `runPlatformFit()` called at line 784 using `deepseekRaw?.reasoning ?? null`. The design decision (Wave 2 feeds Wave 4, Wave 3 runs in parallel positioning) is intentional and consistent with D-07. Platform-fit does not need persona detail — it needs DeepSeek's hook/retention/shareability component scores to inform per-platform judgement.

---

### ⚠️ Signal Fallback — platform_fit null handling in aggregator

**Finding:** When `runPlatformFit()` returns null (DeepSeek error or circuit-breaker open), the aggregator correctly sets `platform_fit: false` in `SignalAvailability` and `selectWeights` redistributes the 0.05 share to the remaining signals. However the redistribution path for `platform_fit` depends on `platformFitInInput` being set in the `selectWeights` call — it uses `Object.prototype.hasOwnProperty.call(availability, "platform_fit")` to detect whether the key was passed. If the aggregator were ever called with a legacy `availability` object that LACKS the `platform_fit` key (pre-Phase-9 callers), the 0.05 weight would silently vanish from the base sum.
**File:line:** `src/lib/engine/aggregator.ts:177-182` (hasOwnProperty detection), `aggregator.ts:725-728` (platform_fit availability assignment)
**Severity:** WARNING
**Action:** Defer to STATE.md — platform_fit key is always present in the live aggregator path (line 725 always sets it); legacy eval-harness callers from Phase 1 bypass aggregator directly via eval-runner shape. Risk is low for Phase 13 E2E but should be documented.
**Notes:** The `selectWeights` back-compat mechanism requires callers to include all new keys in the `availability` object. The live `aggregateScores` path (line 725) always sets `platform_fit: (...)`. Eval-harness callers that construct a manual `availability` object without `platform_fit` will silently lose the 0.05 weight slot. No known eval-harness call site currently does this (Phase 10 aggregator-phase10.test.ts constructs full objects), but the fragility warrants tracking.

---

### ✅ Stage 10 critique — confidence-only, overall_score not mutated

**Finding:** `applyCritiqueAdjustment` adjusts only `result.confidence` (clamped to [-0.20, 0]). `result.overall_score` is never touched after the critique call. The critique result is attached to `result.critique` but does not flow back into the score computation.
**File:line:** `src/lib/engine/aggregator.ts:1055-1059`, `src/lib/engine/stage10-critique.ts:39-45`
**Severity:** INFO
**Action:** Accept
**Notes:** `applyCritiqueAdjustment` at stage10-critique.ts:39 takes `currentConfidence` and a `CritiqueResult`; it clamps `confidence_adjustment` to [-0.20, 0] and applies it only to the confidence value. aggregator.ts:1057 reassigns `result.confidence` only. `result.overall_score` is set at line 850 (`applyPlattScaling(raw_overall_score, plattParams)`) and never modified after that.

---

### ⚠️ Watermark detection — consumed by platform-fit but not persisted or surfaced in PredictionResult

**Finding:** The `watermark_detected` flag from `geminiResult.analysis.hook_decomposition?.watermark_detected` is read at pipeline.ts:782-783 and passed to `runPlatformFit()` to inform `watermark_penalty` scoring. However `watermark_detected` (the raw boolean) is not exposed in `PredictionResult` — only `PlatformFitResult.watermark_penalty` is persisted (inside `platform_fit` field). The upstream detection signal itself is invisible to downstream consumers and the UI. Additionally, `hook_decomposition?.watermark_detected` is the source, but this is a platform-generic flag (not per-platform), while platform-fit returns per-platform `watermark_penalty` booleans — the mapping from one generic flag to per-platform penalties is delegated entirely to the LLM prompt without any structural enforcement.
**File:line:** `src/lib/engine/pipeline.ts:782-783`, `src/lib/engine/wave4/platform-fit.ts:115-128`, `src/lib/engine/wave4/platform-fit-prompts.ts:116`
**Severity:** WARNING
**Action:** Defer to STATE.md — the watermark flag is functionally consumed by platform-fit. The missing persistence of the raw flag in PredictionResult is an M2 UI gap (watermark detection UI is explicitly out-of-scope per PROJECT.md). Acceptable for Phase 13 E2E.
**Notes:** The `STABLE_PLATFORM_FIT_SYSTEM_PROMPT` (platform-fit-prompts.ts:83) instructs the model to set `watermark_penalty: true` when cross-platform watermarks are visible. The `watermarkDetected` parameter in `buildPlatformFitUserMessage` (line 116) provides the context. The LLM is trusted to apply the logic per-platform — no TypeScript guard enforces that `watermarkDetected.tiktok === true` maps to `watermark_penalty=true` for TikTok. This is an acceptable design choice given the LLM-boundary pattern but is worth monitoring in E2E.

---

### ✅ Counterfactuals legacy — no stale Phase 9 Stage 11 references

**Finding:** Phase 9's original Stage 11 (`stage11-counterfactuals.ts`) uses `DEEPSEEK_COUNTERFACTUALS_MODEL ?? "deepseek-v4-flash"` (line 16 of stage11-counterfactuals.ts). Plan 02 of Phase 13 rebuilds Stage 11 (Gemini migration per D-02). The `13-PHASE12-CLEANUP.md` correctly flags `DEEPSEEK_COUNTERFACTUALS_MODEL` as obsolete-after-Plan-02. Tests (`stage11-counterfactuals.test.ts`) still reference the DeepSeek contract, consistent with the pre-Plan-02 state. No stale cross-references found in unrelated files.
**File:line:** `src/lib/engine/stage11-counterfactuals.ts:16`, `.planning/phases/13-real-pipeline-validation-production-hardening/13-PHASE12-CLEANUP.md:42`
**Severity:** INFO
**Action:** Accept — Plan 02 owns the migration; this plan is pre-Plan-02
**Notes:** The Stage 11 counterfactuals test at `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` correctly tests the current DeepSeek-based contract (still active). Plan 02 will migrate the module; the test file will need updating at that time. The `13-PHASE12-CLEANUP.md` obsolete-env table correctly documents the upcoming deletion.

---

### ✅ Caption-less behavior — wave4/platform-fit-prompts.ts:133

**Finding:** `buildPlatformFitUserMessage` at platform-fit-prompts.ts:133 uses `payload.content_text || "(no caption)"`. For video-mode (caption-less) submissions, `content_text` will be `""` (empty string) or null, and the fallback `"(no caption)"` will be used. The LLM system prompt does not require caption text for scoring — it uses `Duration`, `Content type`, `Creator Profile`, and `DeepSeek Analysis` (if available). The `"(no caption)"` string is semantically correct and will not degrade scoring in video-mode.
**File:line:** `src/lib/engine/wave4/platform-fit-prompts.ts:133`
**Severity:** INFO
**Action:** Accept
**Notes:** The `buildPlatformFitUserMessage` function (line 133) follows the same `|| "(no caption)"` pattern as other prompt builders in the engine (e.g., Wave 3 persona prompts follow the same convention per `13-AUDIT-CAPTION-LESS.md` Wave 4 row). The model is instructed via the system prompt to evaluate hook, format-fit, retention structure, shareability, and creator-fit — caption is one input among five scoring axes and its absence is a valid state for video-mode.

---

**Phase 9 summary:** 2 WARNINGs (platform_fit back-compat fragility ⚠️, watermark not persisted in PredictionResult ⚠️), 3 INFOs. No BLOCKERs. Wave wiring confirmed correct. Critique adjustment confirmed confidence-only.

---

## Phase 10 — ML Audit + Calibration + Aggregator Extension

### ✅ ML disable correctness — SCORE_WEIGHTS.ml === 0 and re-enable path preserved

**Finding:** `SCORE_WEIGHTS.ml` is set to `0` at aggregator.ts:57 with comment `// D-05: disabled after Phase 10 audit`. The `ml: false` availability flag is hardcoded at line 689: `ml: false, // D-05: disabled after Phase 10 audit`. `predictWithML` is still imported and called at line 678 (`const mlScore = await predictWithML(mlFeatures)`); the mlScore result flows into `raw_overall_score * weights.ml` at line 825 but `weights.ml` = 0 (when ml=false, selectWeights sets it to 0). Re-enabling is a 2-step change: set `SCORE_WEIGHTS.ml = 0.15` (original) and `ml: mlScore !== null` in availability.
**File:line:** `src/lib/engine/aggregator.ts:57` (SCORE_WEIGHTS.ml=0), `aggregator.ts:689` (ml: false), `aggregator.ts:678` (predictWithML still called), `aggregator.ts:825` (ml term in weighted sum)
**Severity:** INFO
**Action:** Accept
**Notes:** The ML disable is correctly implemented via the weight+availability double-gate. `predictWithML` still executes on every request (wasted CPU, ~0.1ms for in-memory inference) but is a no-op effect-wise since `weights.ml = 0`. Phase 10's D-05 decision was to keep the wiring intact for easy re-enable. This is the intended state.

---

### ⚠️ Platt calibration — text-mode-trained parameters applied unconditionally in video-mode

**Finding:** `getPlattParameters()` reads from the `platt_parameters` DB table (trained on the text-mode corpus per D-29). `applyPlattScaling(raw_overall_score, plattParams)` is called unconditionally at aggregator.ts:850 regardless of whether the current prediction is video-mode. The Platt parameters fitted on text-mode scores are being applied to video-mode raw scores (which have a different distribution due to Wave 1 Gemini video segments contributing to raw_overall_score). This means video-mode predictions are calibrated by a curve trained on a different signal distribution.
**File:line:** `src/lib/engine/aggregator.ts:843-851`, `src/lib/engine/calibration.ts:323-348`
**Severity:** WARNING
**Action:** Defer to STATE.md — D-29 documents this as "text-mode-trained, video-mode re-train pending". The fix (separate Platt params by input_mode, or retrain on video-mode predictions) requires a corpus of video-mode outcome data that doesn't exist yet. Plan 08 owns re-training after E2E establishes video-mode baselines.
**Notes:** `applyPlattScaling` returns `rawScore` unchanged when `params === null` (calibration.ts:279-281). If the platt_parameters row in DB matches text-mode training, video predictions will be systematically miscalibrated. Concretely: the sigmoid curve may compress high-confidence video predictions or amplify low-confidence ones relative to their true calibration. Severity is WARNING (not BLOCKER) because (a) Phase 13 is validating pipeline correctness not calibration accuracy, (b) uncalibrated mode (`params === null`) is the fallback if text-mode params are deleted, and (c) D-29 explicitly accepted this state.

---

### ✅ SignalAvailability redistribution — correct on 5-signal subset after retrieval=0, rules=0

**Finding:** After Plan 02's changes (retrieval=0, rules=0 per 13-CONTEXT.md D-15/D-14 — these are Phase 13 weights, not current), the current codebase does NOT have retrieval=0 or rules=0. Looking at the current weights: `retrieval=0.05`, `rules=0.15`. The redistribution in `selectWeights` correctly handles any signal becoming unavailable by proportionally redistributing to available signals. Walkthrough: if `audio=unavailable` (audio=false in availability), the 0.07 weight is redistributed proportionally to behavioral(0.35), gemini(0.25), ml(0, excluded), rules(0.15), trends(0.10), retrieval(0.05), platform_fit(0.05). The `availableWeight` denominator correctly excludes ml because `SCORE_WEIGHTS.ml=0` makes its share=0 but `ml=false` means it participates in `filtered` — checking: `filtered.filter([,v] => !v)` includes ml (false), so `missingWeight += SCORE_WEIGHTS.ml = 0`. This is correct — redistributing 0 weight is a no-op.
**File:line:** `src/lib/engine/aggregator.ts:184-259` (selectWeights redistribution logic)
**Severity:** INFO
**Action:** Accept
**Notes:** The key edge case (ml=false with SCORE_WEIGHTS.ml=0) is handled correctly — the ml slot adds 0 to missingWeight and 0 to availableWeight, leaving the redistribution math unchanged. Confirmed by aggregator-phase10.test.ts assertions at lines 40/56/89/113/128 which all assert `weights.ml === 0`.

---

### ✅ ENGINE_VERSION — correctly at "3.0.0-dev" pre-gate

**Finding:** `ENGINE_VERSION = "3.0.0-dev"` at version.ts:7. This is correct — the flip to `"3.0.0"` is gated on Plan 08 after 10/10 E2E acceptance (D-27/D-28). No code path in Phase 13 Plans 01-07 changes this value.
**File:line:** `src/lib/engine/version.ts:7`
**Severity:** INFO
**Action:** Accept
**Notes:** Phase 10 D-06 says "ENGINE_VERSION bumped to 3.0.0-dev". The current value `"3.0.0-dev"` matches. Plan 08 task owns the final flip to `"3.0.0"`.

---

### ⚠️ Aggregator test coverage — platform_fit assertions exist but are stub-level only

**Finding:** `aggregator-platform-fit.test.ts` (Phase 9 stub) contains assertions for `platform_fit` weight presence and zero-when-unavailable. However these are `selectWeights`-only assertions — no test verifies the full `aggregateScores` path with a real `platformFitResult` array flowing into `raw_overall_score`. The aggregator-phase10.test.ts tests confirm ml=0 behavior but do not exercise the platform_fit scoring term in the weighted sum.
**File:line:** `src/lib/engine/__tests__/aggregator-platform-fit.test.ts:9-75`, `src/lib/engine/__tests__/aggregator-phase10.test.ts:2-10`
**Severity:** WARNING
**Action:** Defer to STATE.md — the weight-math unit tests cover the critical redistribution path; full integration coverage requires a mocked `runPlatformFit` which is appropriate for Phase 13 Plan 05 E2E to validate end-to-end.
**Notes:** The stub tests (aggregator-platform-fit.test.ts) verify that `selectWeights` correctly handles `platform_fit: true/false` in the availability object. The `aggregateScores` path for platform_fit is covered by the integration-level flow (pipeline → aggregator) which Plan 05's 1-video E2E will exercise. Adding a `aggregateScores` unit test with a mock `platformFitResult` array would close this gap.

---

**Phase 10 summary:** 2 WARNINGs (Platt text-mode staleness ⚠️, platform_fit aggregateScores integration test gap ⚠️), 2 INFOs. No BLOCKERs. ML disable confirmed correct. ENGINE_VERSION confirmed correct.

---

## Phase 11 — Existing UI Integration + Privacy Policy

### ✅ /api/analyze engine-v3 wiring — correct pipeline + aggregator imports

**Finding:** `src/app/api/analyze/route.ts` imports `runPredictionPipeline` from `@/lib/engine/pipeline` (line 6) and `aggregateScores` from `@/lib/engine/aggregator` (line 7). Both are the current Phase 13 versions (pipeline.ts with Wave 0/3/4 + retrieval, aggregator.ts with all Phase 9/10/11 extensions). No stale `engine-v2.1` or legacy module path imports.
**File:line:** `src/app/api/analyze/route.ts:6-7`
**Severity:** INFO
**Action:** Accept
**Notes:** The route uses the two-step pattern: `runPredictionPipeline(validated, opts)` then `aggregateScores(pipelineResult)`. Both are imported from the canonical engine modules. No legacy `v2.1` or old import path detected.

---

### ⚠️ analysis_count increment — usage_tracking upsert is NOT idempotent on concurrent retry

**Finding:** `currentCount` is read ONCE at route entry (line 160). The `usage_tracking.upsert` at lines 347-353 (JSON path) and 452-459 (SSE path) sets `analysis_count: currentCount + 1` — a raw SET, not an atomic increment. On concurrent requests from the same user (e.g., double-submit), both would read `currentCount = N`, then both SET `N+1`, resulting in a net increment of 1 instead of 2. The `increment_creator_analysis_count` RPC (lines 376/480) IS atomic (DB function), but this applies to the lifetime counter in `creator_profiles`, not the daily `usage_tracking` count that enforces the tier limit.
**File:line:** `src/app/api/analyze/route.ts:160` (read), `route.ts:347-353` (JSON upsert), `route.ts:452-459` (SSE upsert)
**Severity:** WARNING
**Action:** Defer to STATE.md — concurrent requests from the same user are rare in the current single-user E2E context. The issue is a pre-existing architectural pattern (same pattern used in pre-Phase-11 code). Fix requires replacing the upsert SET with a DB-level increment RPC or a check-and-increment transaction.
**Notes:** The `onConflict: "user_id,period_start,period_type"` on the upsert prevents duplicate rows but does not make the increment atomic. For Phase 13 E2E (single sequential analysis), this is not a practical concern. Worth fixing before high-traffic launch.

---

### ✅ Storage retention cron — correctly filters by storage_retention_opted_in = false

**Finding:** The cron at `src/app/api/cron/delete-retained-videos/route.ts:40-44` uses `creator_profiles!inner(storage_retention_opted_in)` (inner join) and `.eq("creator_profiles.storage_retention_opted_in", false)`. The inner join correctly excludes users without a `creator_profiles` row (treated as not opted-in, per the comment at line 36). The 30-day window uses `thirtyDaysAgo = now - 30*24*60*60*1000` (line 31). Only `video_storage_path IS NOT NULL` rows are processed (line 43).
**File:line:** `src/app/api/cron/delete-retained-videos/route.ts:30-44`
**Severity:** INFO
**Action:** Accept
**Notes:** The `creator_profiles!inner` join is the correct Supabase PostgREST syntax for an inner join filter. Users without a profile row will have their videos deleted (inner join excludes them from the query entirely, meaning their rows with `video_storage_path` ARE selected when the `.eq("creator_profiles.storage_retention_opted_in", false)` filter is applied — wait: actually `!inner` means only rows with a matching creator_profiles row are returned. Users WITHOUT a profile row get EXCLUDED from the result set entirely, meaning their expired videos are NOT deleted by this cron. This is a gap: users who never completed the 9-card interview have no creator_profiles row, so their uploaded videos are never auto-deleted. The cron comment says "treated as non-opted-in (default off)" but the query behavior is the opposite — no profile = no deletion.

---

### ⚠️ REVISED — Storage retention cron — users without creator_profiles row are EXCLUDED from deletion (BLOCKER candidate)

**Finding:** On closer inspection of `creator_profiles!inner`: Supabase's `!inner` filter in PostgREST selects ONLY rows where the join produces a match. Users who have uploaded a video but never completed the 9-card profile (no `creator_profiles` row) will have `analysis_results.video_storage_path IS NOT NULL` but NO matching `creator_profiles` row — the inner join excludes them from the result entirely. Their videos accumulate indefinitely in Storage, bypassing the 30-day auto-delete.
**File:line:** `src/app/api/cron/delete-retained-videos/route.ts:40-44`
**Severity:** WARNING
**Action:** Defer to STATE.md — the fix requires a LEFT JOIN approach: query `analysis_results` where `created_at < 30d` and `video_storage_path IS NOT NULL`, then separately check if a `creator_profiles` row with `storage_retention_opted_in = true` exists. OR use a subquery exclusion: delete all expired-path rows UNLESS `storage_retention_opted_in = true`. For Phase 13 E2E with a complete profile, this path won't trigger, but it is a data retention risk for production.
**Notes:** The comment on line 36 states "Users without a profile row are treated as non-opted-in (default off per D-04)" — this is the INTENDED behavior but the inner join implements the OPPOSITE. This is a logic error in the query. Not escalating to BLOCKER because Phase 13 E2E users will have a creator_profiles row (required by the 9-card interview gate), and the privacy risk is that videos are retained longer than intended (not deleted earlier than intended).

---

### ✅ 9-card profile modal interception — fires on first submit attempt

**Finding:** `content-form.tsx` uses `usePendingProfileGate()` hook (line 8, line 66). On form submit (line 149), `interceptOrProceed()` gates the submit: if the profile is incomplete/unseen, it returns `{ intercepted: true }` and sets `modalOpen = true` (line 153), opening `ProfileInterviewModal`. The actual `onSubmit(formData)` is deferred until the modal completes. This correctly gates the first upload attempt.
**File:line:** `src/components/app/content-form.tsx:8` (import), `content-form.tsx:149-153` (gate trigger), `content-form.tsx:261-265` (modal render)
**Severity:** INFO
**Action:** Accept
**Notes:** The `usePendingProfileGate` hook (from `@/hooks/use-pending-profile-gate`) drives the gate logic. The `interceptOrProceed` function is the intercept mechanism. This is the Phase 2 / Plan 04 integration that gates first upload on profile completion. Correctly placed at submit time rather than mount time.

---

### ⚠️ Dashboard render — ResultsPanel has SignalAvailabilityChips + GoalRecheckBanner but Phase 13 Plan 02 weight changes will break existing chip labels

**Finding:** `results-panel.tsx` imports and renders both `SignalAvailabilityChips` (line 16) and `GoalRecheckBanner` (line 17). These are present in the post-Phase-11 codebase. However, Plan 02 of Phase 13 will set `rules=0` and `retrieval=0` in the aggregator weights, which means the `SignalAvailabilityChips` will show `rules: false` and `retrieval: false` even when those signals actually fired — because the weight=0 treatment and the availability flag are separate. The chips display `signal_availability` (boolean flags), not weights, so the display itself is unaffected. However `rules` availability at `aggregator.ts:689-692` checks `ruleResult.matched_rules.length > 0` — this will still be true when rules score, so the chip will show `rules: true` even after Plan 02's weight=0 change. This is a minor UI truth issue (chip says "available" but weight=0 means it contributes nothing).
**File:line:** `src/components/app/simulation/results-panel.tsx:16-17` (imports), `src/lib/engine/aggregator.ts:689-692` (rules availability computation)
**Severity:** WARNING
**Action:** Defer to STATE.md — after Plan 02 ships with rules=0 weight, the signal availability chips will show `rules: true` (misleading) because availability reflects "did the signal fire" not "does it affect the score". This is a UX clarification issue for Plan 06/07 polish, not a correctness blocker.
**Notes:** The chip rendering code reads `result.signal_availability` which is set from the `availability` object in the aggregator. After Plan 02, `rules` will remain `true` in availability (matched rules still fire) but `SCORE_WEIGHTS.rules = 0` (D-14). The chip says "rules: present" but the weight contribution is zero. A future fix would either (a) add a "weight-bearing" sub-property to SignalAvailability, or (b) rename the chip to "signals detected" vs "signals weighted".

---

### ✅ SC#5 deferred Phase 11 Plan 05 smoke checkpoint — correctly staged as deferred

**Finding:** Phase 11 only has one SUMMARY (11-01-SUMMARY.md). Plans 02-05 have no SUMMARY files, indicating they were planned but not executed. Per the plan structure, Phase 11 Plan 05 was a smoke checkpoint. This is consistent with Phase 13 being the real-pipeline validation phase that replaces it. The deferred status is intentional — Phase 13 Plans 05-07 are the E2E validation that Phase 11 Plan 05 intended.
**File:line:** `.planning/phases/11-existing-ui-integration-privacy-policy/` (directory listing)
**Severity:** INFO
**Action:** Accept — Phase 13 Plans 05-07 own the E2E validation
**Notes:** Phase 11 Plans 02-05 have no SUMMARY.md files, confirming they were not executed in the Phase 11 execution window. Phase 13 CONTEXT.md explicitly supersedes Phase 11's smoke checkpoint with real-video E2E validation.

---

**Phase 11 summary:** 3 WARNINGs (analysis_count concurrent-write race ⚠️, retention cron inner-join gap for profile-less users ⚠️, SignalAvailabilityChips rules-chip post-Plan-02 misleading display ⚠️), 3 INFOs. No BLOCKERs. Engine wiring confirmed correct. Profile gate confirmed present. SignalAvailabilityChips and GoalRecheckBanner confirmed present.

---

## Phase 12 — Accuracy Benchmark (Superseded)

📦 **Archival note:** Phase 12 (Accuracy Benchmark + Acceptance Gate) ran in text-only mode against the 225-row corpus. Per `13-CONTEXT.md` and `13-PHASE12-CLEANUP.md`, Phase 12 is superseded by Phase 13's real-video validation approach (Plans 05-07). Reference `13-PHASE12-CLEANUP.md` for the complete obsolete env inventory and kept/discard/update tables.

### Kept artifacts (do NOT delete in this phase)

| Artifact | Location | Reason |
|----------|----------|--------|
| `--max-rows` flag | `src/lib/engine/corpus/eval-runner.ts:97-98`, `src/lib/engine/corpus/eval-harness.ts:57,71`, `scripts/run-persona-ab-eval.ts:50,83` | Utility for capped evaluation runs; used regularly for fast smoke checks |
| `platt_parameters` DB row | `src/lib/engine/calibration.ts:323-348` (`getPlattParameters`) | Text-mode-trained; flagged "text-mode-trained, video-mode re-train pending". Do NOT delete — re-train in Plan 08 or M2 after real-video corpus built |
| All `12-*.md` planning artifacts | `.planning/phases/12-accuracy-benchmark-acceptance-gate/` | Historical record — never delete |

### Discard list (Plan 08 owns deletion)

| Artifact | Reason |
|----------|--------|
| `.planning/research/smoke-v3.json` | Invalid — force-disabled DeepSeek + text-mode. Not representative of v3 engine. Plan 08 owns `git rm` |

### Update list (Plan 08 owns edit)

| File | Required update |
|------|----------------|
| `12-HANDOFF.md` | Add closing note pointing forward to Phase 13 real-video validation as the actual acceptance gate |
| `ROADMAP.md` | Mark Phase 12 status = "Superseded by Phase 13" |

### Remnant audit — smoke-v3 references

```
grep -rn "smoke-v3" .planning/ src/
```

Results:
- `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-02-PLAN.md` (lines 29, 211, 220, 243, 244, 254, 261, 268) — plan artifact; expected; do not delete
- `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-03-PLAN.md` (line 88) — plan artifact; expected; do not delete
- `.planning/phases/13-real-pipeline-validation-production-hardening/13-CONTEXT.md` (line 152) — archival reference; expected
- `.planning/phases/13-real-pipeline-validation-production-hardening/13-DISCUSSION-LOG.md` (line 207) — archival decision log; expected
- `.planning/phases/13-real-pipeline-validation-production-hardening/13-08-PLAN.md` (multiple lines) — Plan 08 deletion instructions; expected
- **No references in `src/`** — smoke-v3.json has zero active code references

📦 All smoke-v3 references are in docs and plan artifacts only. No active import or call site in `src/` depends on the smoke-v3 output file. Plan 08 deletion is safe.

---

## Bug Triage

| Finding | Source phase | File:line | Severity | Action | Owner Plan |
|---------|-------------|-----------|----------|--------|------------|
| platform_fit back-compat: `selectWeights` relies on `hasOwnProperty` for new keys; legacy eval callers without `platform_fit` key silently lose 0.05 weight | 9 | `src/lib/engine/aggregator.ts:177-182` | ⚠️ | Defer to STATE.md | Post-Phase-13 follow-up |
| watermark_detected not persisted in PredictionResult; raw boolean invisible to downstream consumers and UI | 9 | `src/lib/engine/pipeline.ts:782-783` | ⚠️ | Defer to STATE.md | M2 "Watermark detection UI" |
| Platt calibration: text-mode-trained parameters applied unconditionally to video-mode predictions (different signal distribution) | 10 | `src/lib/engine/aggregator.ts:843-851` | ⚠️ | Defer to STATE.md | Plan 08 or M2 re-train |
| aggregateScores integration test for platform_fit weighted-sum term missing (only selectWeights unit tested) | 10 | `src/lib/engine/__tests__/aggregator-platform-fit.test.ts:9-75` | ⚠️ | Defer to STATE.md | Phase 13 Plan 05/06 test harness |
| analysis_count: usage_tracking upsert uses raw SET not atomic increment; concurrent requests would under-count | 11 | `src/app/api/analyze/route.ts:347-353` | ⚠️ | Defer to STATE.md | Pre-launch hardening |
| Storage retention cron: inner join excludes users without creator_profiles row; their expired videos accumulate | 11 | `src/app/api/cron/delete-retained-videos/route.ts:40-44` | ⚠️ | Defer to STATE.md | Pre-launch hardening |
| SignalAvailabilityChips: rules chip will show `true` post-Plan-02 when rules weight=0; misleading UX | 11 | `src/components/app/simulation/results-panel.tsx:16`, `aggregator.ts:689-692` | ⚠️ | Defer to STATE.md | Plan 06/07 UI polish |
| smoke-v3.json exists only in docs; active src/ code has zero references; safe for Plan 08 deletion | 12 | `.planning/research/smoke-v3.json` | 📦 | Archival — Plan 08 owns deletion | 13-08 cleanup |

**No BLOCKERS found — Plan 05 unblocked.**

---

## Cross-cutting Observations

Most error-swallowing in Phase 9-11 follows a consistent pattern: LLM-boundary `catch` blocks return `null` and emit a `warning` into the pipeline's `warnings` array, delegating weight redistribution to `selectWeights`. This pattern is structurally sound — `null`-returning stages degrade gracefully via signal availability flags. The concern is not the pattern itself but the downstream observability: the `warnings` array is persisted to `analysis_results` but is currently not surfaced in the UI, making silent-degradation scenarios visible only via DB queries. Phase 13 Plans 05-07 E2E should specifically watch for `warnings.length > 0` in the analysis result to catch unintended signal drops.

The back-compat mechanism in `selectWeights` (using `Object.prototype.hasOwnProperty` to detect Phase 6/8/9 optional keys) has accumulated three layered conditions (audio, retrieval, platform_fit). Each new weight-bearing signal from future phases will require adding a fourth `hasOwnProperty` check. The current implementation is correct but fragile — a future refactor should move to a type-safe signal registry (e.g., an array of `{key, weight, available}` tuples) that eliminates the per-key instanceof checks. This is a non-blocking architectural hygiene issue for post-Phase-13 work.

The storage retention cron's inner-join gap (Phase 11 Finding 3) and the analysis_count non-atomic increment (Phase 11 Finding 2) are both in the category of "works correctly for single-user sequential use but breaks under concurrent or edge-case conditions." Both should be addressed before enabling high-volume production traffic. The retention gap is the more privacy-significant of the two since it can result in video files accumulating beyond the user's expectation of 30-day auto-deletion. Recommend adding both to a pre-launch hardening task list distinct from the Phase 13 E2E validation track.
