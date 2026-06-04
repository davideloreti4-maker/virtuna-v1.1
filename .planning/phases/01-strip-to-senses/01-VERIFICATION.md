---
phase: 01-strip-to-senses
verified: 2026-06-04T13:20:00Z
status: human_needed
score: 24/24 code-verifiable must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run scripts/measure-pipeline.ts against a real video in a live env (DashScope/Qwen + Supabase + network) and read TOTAL_LATENCY_MS"
    expected: "E2E completes under the 300s cap (SUMMARY records 95–96s, ~40% under the 154–159s baseline)"
    why_human: "Offline verification env has no live Qwen/Supabase/network; latency cannot be re-measured by grep/build. Instrument exists and logs the number; only the runtime value needs live confirmation (R6)."
  - test: "Run the same fixed video twice in a live env; compare OVERALL_SCORE across runs"
    expected: "Scores land within the locked provider tolerance band (SUMMARY records 74 vs 77 = ±3); NOT byte-identity (R8 amended, STATE.md 2026-06-04)"
    why_human: "Determinism is a runtime provider-noise property of the wave3 pass2 thinking-mode Qwen calls; cannot be reproduced offline. R8 was deliberately amended to a tolerance band, so this is a band-check not an exactness check."
  - test: "POST mode:'remix' to /api/remix/adapt (or run a decode) against a live TikTok URL on a running authed server"
    expected: "Remix decode/adapt completes end-to-end post-strip (R12). NOTE: watch the rehost-cleanup race — see CR-01 below (pre-existing, tracked follow-up; not a Phase-01 regression)"
    why_human: "Live smoke requires a running authed Next.js server + outbound network to fetch a TikTok URL; deferred in SUMMARY as offline-env limitation. Structurally test-covered (24 remix tests green)."
---

# Phase 01: Strip to Senses Verification Report

**Phase Goal:** Delete the fabrication + dead machinery so the engine is honest and under the latency cap, WITHOUT breaking the live product. SUBTRACTIVE only. Score stays, derivation UNCHANGED — keeps computing off the existing live signals (behavioral + gemini); just remove the dead terms from the blend.
**Verified:** 2026-06-04T13:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The goal is achieved in the codebase. Every code-verifiable truth passed against the actual source (not SUMMARY claims): the fabrication is deleted, dead machinery is dormanted with zero active importers, the blend is cut to two live signals, the score + confidence path is intact, build is clean and the full suite is green (1747 pass / 0 fail / 26 dormant-excluded). Status is `human_needed` (not `passed`) ONLY because three runtime properties — E2E latency (R6), determinism band (R8), and live remix smoke (R12) — cannot be re-measured in this offline environment. Their instruments exist and their values are documented in 01-06-SUMMARY; they need live-env confirmation.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | predicted-engagement.ts hard-deleted; no fabricated sine-jitter engagement in live path | ✓ VERIFIED | `ls` → No such file. `computePredictedEngagement`/`rescalePersonaIntentToViewRate` grep: none in active tree. All `Math.sin` hits are UI animations (orb/graph/hive-demo), not engagement. `aggregator.ts:906 predicted_engagement: null` |
| 2 | deepseek "top X%" percentile-label framing removed (keep calibration JSON) | ✓ VERIFIED | `deepseek.ts:387` "percentile benchmark block removed"; no "top X%"/"outperform"/"better than" prompt label. Remaining `percentiles` are calibration p50/p75/p90 structure (kept). `loadCalibrationData` still reads calibration-baseline.json |
| 3 | SCORE_WEIGHT_KEYS reduced to [behavioral, gemini]; dead keys removed | ✓ VERIFIED | `aggregator.ts:79 export const SCORE_WEIGHT_KEYS = ["behavioral", "gemini"]` |
| 4 | Scoring math = behavioral·w + gemini·w; selectWeights handles 2-key path | ✓ VERIFIED | `aggregator.ts:725 raw_overall_score`, `:739 overall_score`, behavioral+gemini renorm path present |
| 5 | ml/audio-fingerprint/trends/fuzzy/rules/stage11(+prompts)/platform-fit(+prompts) moved to _dormant/ | ✓ VERIFIED | `find src/lib/engine/_dormant/engine` lists all 9 modules + their tests |
| 6 | ZERO active-tree importers of dormant/dead modules (grep proof) | ✓ VERIFIED | `from .*(ml|audio-fingerprint|trends|fuzzy|rules|platform-fit|stage11)` → none in active tree. All `_dormant` hits in active files are comments only |
| 7 | retrain-ml cron route dormanted + removed from vercel.json | ✓ VERIFIED | `src/app/api/cron/retrain-ml` gone; moved to `_dormant/cron/retrain-ml/route.ts`; `retrain-ml` absent from vercel.json crons (8 remaining, none retrain-ml) |
| 8 | aggregator no longer imports/calls runStage11Counterfactuals (counterfactuals null) | ✓ VERIFIED | `aggregator.ts:998` "counterfactuals stays null. stage11... moves to _dormant"; no runStage11Counterfactuals call |
| 9 | aggregator no longer imports/calls predictWithML / featureVectorToMLInput | ✓ VERIFIED | `aggregator.ts:614` "ml call removed (Plan 02)"; no ../ml import |
| 10 | analyze/route.ts deferred stage11 re-run removed; remix branch untouched | ✓ VERIFIED | No deferred stage11 re-run; `route.ts:22` imports runDecode, `:201` "decode path for mode:'remix'" present |
| 11 | pipeline.ts removed audio/trends/rules/platform_fit call sites; Omni+deepseek+wave3+creator intact | ✓ VERIFIED | No matchAudioFingerprint/enrichWithTrends/runPlatformFit/loadActiveRules imports in active pipeline.ts; analyzeVideoWithOmni + filmstrip + retrieval-empty intact |
| 12 | stage10 vestigial flags removed; confidence_adjustment KEPT (R5) | ✓ VERIFIED | `stage10-critique.ts:59` "confidence_adjustment is KEPT (D1.4/R5)"; `:102` returns clamped adjustment |
| 13 | CTA penalty preserved (modifies live gemini term) | ✓ VERIFIED | `aggregator.ts:130 applyCtaPenalty`, `:699 ctaPenaltyApplied_gemini_score` feeds raw_overall_score |
| 14 | score + confidence still render; derivation structurally unchanged | ✓ VERIFIED | `aggregator.ts:193 calculateConfidence`, `:745 conf=calculateConfidence`, `:739 overall_score`; measure-pipeline logs both |
| 15 | WR-01 fix: confidence does NOT penalize deliberately-deleted rules/trends | ✓ VERIFIED | `aggregator.ts:213` penalty lines removed; `availability.rules/.trends` are provenance flags only. Fix commit `eebacbcc` |
| 16 | *_percentile schema fields made optional (schema regression fix) | ✓ VERIFIED | `types.ts:625-636` all `_percentile` fields `.string().optional()` |
| 17 | FALLBACK_ITEM removed — empty suggestions renders null (D4.1) | ✓ VERIFIED | `insights-section.tsx:55 if (suggestions.length === 0) return null`; FALLBACK_ITEM const gone |
| 18 | ENGINE_VERSION bumped to 3.1.0 (cache invalidation) | ✓ VERIFIED | `version.ts:9 export const ENGINE_VERSION = "3.1.0"` |
| 19 | CR-02 in-scope fix: hero degrades to '—' not orphan "Top %" | ✓ VERIFIED | `InputResultCard.tsx:181-188` leadValue null → renders '—' with CR-02 comment |
| 20 | null-degrade tests exist (platform-fit-null, predicted-engagement-null) | ✓ VERIFIED | both test files present and pass in suite run |
| 21 | measure-pipeline.ts logs overall_score + latency (R6/R8 instrument) | ✓ VERIFIED | `:122 TOTAL_LATENCY_MS`, `:126 OVERALL_SCORE=...CONFIDENCE=...`, `:130 behavioral/gemini` |
| 22 | Full suite + build green (minus dormant-excluded tests) | ✓ VERIFIED | `npm test`: 166 files / 1747 pass / 0 fail / 26 skipped. `npx tsc --noEmit`: exit 0. `npm run build`: compiled, manifest generated |
| 23 | dormant glob excludes the moved tree | ✓ VERIFIED | no `_dormant/` test ran; 26 skipped matches dormant exclusion |
| 24 | All summary commits exist in git history | ✓ VERIFIED | 1f5b9877, 05e2918c, 2c728151 all `git cat-file -t` = commit |
| R6 | E2E under 300s cap (runtime value) | ? UNCERTAIN | Instrument verified (truth 21); SUMMARY records 95–96s. Live re-measure needed → human |
| R8 | Determinism within tolerance band (runtime value) | ? UNCERTAIN | R8 amended to band (STATE.md); SUMMARY records ±3. Live re-run needed → human |
| R12 | Remix live smoke (runtime) | ? UNCERTAIN | 24 remix tests green (structural); live POST deferred offline → human |

**Score:** 24/24 code-verifiable truths verified. 3 runtime truths (R6/R8/R12 live) routed to human.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/predicted-engagement.ts` | hard-deleted | ✓ DELETED | absent (correct) |
| `src/lib/engine/aggregator.ts` | behavioral+gemini blend, stage11/ml/jitter removed, confidence intact | ✓ VERIFIED | SCORE_WEIGHT_KEYS 2-key; predicted_engagement null; confidence_adjustment + CTA penalty kept; WR-01 penalty removed |
| `src/lib/engine/pipeline.ts` | audio/trends/rules/platform_fit removed; Omni+deepseek+wave3 intact | ✓ VERIFIED | dead imports gone; Omni/filmstrip/retrieval-empty intact (CR-01 race pre-existing, see info) |
| `src/lib/engine/deepseek.ts` | reasoning intact, percentile-label framing removed, calibration kept | ✓ VERIFIED | label block removed; calibration loader kept |
| `src/lib/engine/stage10-critique.ts` | flags-only; confidence_adjustment kept | ✓ VERIFIED | line 59/102 |
| `src/lib/engine/_dormant/engine/*` | 9 dead modules + tests moved | ✓ VERIFIED | all present under _dormant |
| `src/app/api/analyze/route.ts` | deferred stage11 removed; remix branch preserved | ✓ VERIFIED | decode/remix branch present |
| `vercel.json` | retrain-ml schedule removed | ✓ VERIFIED | absent |
| `src/lib/engine/version.ts` | ENGINE_VERSION = 3.1.0 | ✓ VERIFIED | line 9 |
| `src/components/app/simulation/insights-section.tsx` | no FALLBACK_ITEM, null on empty | ✓ VERIFIED | line 55 |
| `src/lib/engine/types.ts` | *_percentile optional | ✓ VERIFIED | lines 625-636 |
| `scripts/measure-pipeline.ts` | overall_score + latency logging | ✓ VERIFIED | lines 122/126/130 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| aggregator.ts | result.predicted_engagement | field null (jitter deleted) | ✓ WIRED | `:906 predicted_engagement: null` |
| analyze/route.ts | remix branch | mode:'remix' untouched | ✓ WIRED | runDecode imported + decode path present |
| pipeline.ts | Wave1/Wave2 Promise.all | reduced awaited set | ✓ WIRED | dead slots removed; build+tests green |
| aggregator.ts | result.confidence | stage10 confidence_adjustment preserved | ✓ WIRED | calculateConfidence + adjustment kept |
| deepseek.ts | calibration-baseline.json | differentiators + duration still read | ✓ WIRED | loadCalibrationData kept |
| version.ts | cache/prediction-cache.ts | ENGINE_VERSION key bump | ✓ WIRED | 3.1.0 invalidates L1+L2 (version.ts:6 cache invariant) |
| active engine tree | _dormant/ modules | zero imports | ✓ WIRED | grep: only comments, no actual imports |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R5 | 01-04, 01-06 | Honest expert score + confidence still render | ✓ SATISFIED | overall_score + confidence derived from behavioral+gemini; CTA penalty + stage10 adjustment kept; no "top X%" claim (truths 3,12,13,14) |
| R6 | 01-01, 01-03, 01-05, 01-06 | E2E under 300s cap | ? NEEDS HUMAN | Instrument verified; SUMMARY 95–96s. Live re-measure required |
| R8 | 01-01, 01-06 | Determinism preserved (amended to tolerance band) | ? NEEDS HUMAN | Band-check; SUMMARY ±3 within band. Live re-run required |
| R9 | 01-02, 01-03, 01-04, 01-05 | Honest by deletion (no fabricated/dead signal) | ✓ SATISFIED | predicted-engagement deleted; 9 modules dormant w/ zero importers; blend cut; percentile labels removed (truths 1-11) |
| R12 | 01-02, 01-06 | One brain across modes (remix path intact) | ✓ SATISFIED (structural) | remix branch untouched; 24 remix tests green. Live smoke → human |

All 5 declared requirement IDs accounted for. No orphaned requirements (REQUIREMENTS.md maps R5/R6/R9 to P1; R8 is "all phases"; R12 to P3 but Phase-01 plans claim it for the untouched-branch guarantee — consistent).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite | `npm test` | 1747 pass / 0 fail / 26 skipped | ✓ PASS |
| Production build | `npm run build` | compiled, 53 routes generated | ✓ PASS |
| Dormant exclusion | suite run | no _dormant test executed | ✓ PASS |
| Remix regression (R12 structural) | remix test dirs in suite | green | ✓ PASS |
| E2E latency (R6) | needs live Qwen/Supabase | offline | ? SKIP → human |
| Determinism (R8) | needs live run x2 | offline | ? SKIP → human |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX in any phase-modified live file | — | No blocker debt markers |

### Human Verification Required

See frontmatter `human_verification`. Three runtime properties (R6 latency, R8 determinism band, R12 live remix smoke) cannot be re-measured offline. Instruments and structural tests verified; only live values need confirmation. These are the documented offline-env limitations from 01-06-SUMMARY, consistent with the locked STATE.md determinism-tolerance-band decision.

### Notable (Info)

- **CR-01 (pre-existing, tracked follow-up — NOT a Phase-01 regression):** `pipeline.ts:569` fires the rehost-temp `.remove([pathToDelete])` BEFORE `analyzeVideoWithOmni` (`:590`) and `triggerFilmstripGeneration` (`:613`) in the tiktok_url/remix path. This race can invalidate the signed URL mid-stream. It pre-dates this phase (the strip did not touch the rehost logic) and is flagged in 01-REVIEW.md as a tracked follow-up. The derive-and-drop tests pass because they mock storage and do not simulate the streaming-read race. Do NOT block Phase 01 on this; surface for the remix/ingestion follow-up.
- **Minor cosmetic:** `InputResultCard.tsx:205` still passes `unit='%'` when not gated, so the CR-02 fallback renders "— %" rather than a bare "—". The orphan "Top %" blank-number bug the review flagged is gone; this residue is cosmetic, non-blocking.
- **Score delta (78–79 → 74–77)** is documented in 01-06-SUMMARY as an honesty correction (provider noise envelope wider than the 2-sample baseline + Plan-04 behavioral-weight renorm pulling a behavioral-weak clip down), NOT a bug. Derivation structurally unchanged.
- **Active corpus/retrieval modules remain** (`corpus/orchestrator.ts`, `retrieval/embedder.ts`, `retrieval/bucket-derivation.ts`, `retrieval-empty.ts`) — these are NOT in Phase 01's cut list (R9 targeted ml/audio/trends/fuzzy/rules/stage11/platform-fit, all confirmed dormant). The pgvector retrieval-stage IS in _dormant. Not a gap.

### Gaps Summary

No blocking gaps. The phase goal — an honest engine (fabrication + dead machinery deleted), under the latency cap, shippable and green, without breaking the live product — is achieved in the code. Every subtractive deliverable is verified against source: deletions confirmed, dormant tree has zero active importers, blend cut to two live signals, score/confidence/CTA/stage10-adjustment preserved, build clean, 1747 tests green. The phase is held at `human_needed` solely to confirm three runtime values (R6/R8/R12 live) that cannot be measured in an offline env; their instruments and structural coverage are verified.

---

_Verified: 2026-06-04T13:20:00Z_
_Verifier: Claude (gsd-verifier)_
