# Phase 15: Calibration Refit on Qwen Corpus - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 15-calibration-refit-on-qwen-corpus
**Areas discussed:** Approach selection, Wave 3/4 threshold semantics

---

## Approach Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Delegate to Claude (Phase 14 pattern) | Live-state research + Claude decisions + objection-surface; discuss inline so user can follow | ✓ |
| Discuss key gray areas | Walk 3-4 implementation decisions with user driving | |
| Skip discuss — go straight to plan | Phase well-scoped by REQUIREMENTS/ROADMAP alone | |

**User's choice:** "option 1 and then discuss with me so I can follow properly"
**Notes:** Hybrid mode — Claude decides, narrates findings + recommendations inline, asks only on genuine ambiguity.

---

## Wave 3 Threshold Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 7/10; validate empirically only | SUCCESS_THRESHOLD=7 is parse-success gate, not score-distribution. Validate empirically, leave constant | |
| Re-interpret as VIRAL_SCORE_CUT/UNDER_SCORE_CUT tune | Real score-distribution knob lives in eval-config.ts. Re-tune those, document REQ misread | |
| Both — validate 7/10 AND tune score-cuts | Validate parse-rate AND re-derive score-cuts from Qwen distribution | ✓ |

**User's choice:** "Yes, lock all three (Recommended)" (composite answer covering both Wave 3 and Wave 4)
**Notes:** User initially uncertain about the distinction. Claude explained:
- `SUCCESS_THRESHOLD=7` in `wave3.ts:38` is a parse-success gate (how many of 10 LLM calls returned valid JSON), unrelated to score distribution
- Real score-distribution knobs are `VIRAL_SCORE_CUT=70` and `UNDER_SCORE_CUT=30` in `eval-config.ts`
- "Re-tune for Qwen score distribution" only makes semantic sense for the score-cuts
- Recommendation: tune the score-cuts (real knob), empirically validate SUCCESS_THRESHOLD (cheap check), document REQ wording mismatch

User locked the recommended composite.

---

## Wave 4 Threshold Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Re-tune the weight (currently 0.05) | Sensitivity sweep on SCORE_WEIGHTS.platform_fit | ✓ |
| Introduce fit_score floor | Add numeric cutoff so platform_fit only contributes when ≥N | |
| Both — floor + weight sweep | Floor + sweep, more thorough but doubles tuning surface | |
| Skip Wave 4 tune — mark CALIB-03 partial | Defer to future phase, only Wave 3 in this phase | |

**User's choice:** "what do you think?"
**Notes:** Claude's recommendation accepted via composite "lock all three" answer above:
- Aggregator has NO numeric platform_fit threshold today — only a weight (`SCORE_WEIGHTS.platform_fit = 0.05`) on `mean(fit_scores)`
- The only numeric knob present is the weight
- Re-tune the weight via 0.03/0.05/0.07/0.10 sweep — same calibration pattern as score-cuts
- Document "threshold = weight" interpretation in CONTEXT.md so audit trail is clean

---

## Claude's Discretion

- Exact wording / structure of `qwen-stratified-validation.md` beyond required content checklist
- Whether to split migration into one plan or fold into 15-02
- Default rate-limit delay for Qwen rerun (M1 used 2s; Qwen may tolerate less)
- Persona success-count log format (Sentry breadcrumb vs. new logger.info line)

## Deferred Ideas

- Re-scrape corpus / new corpus_version (defer to future "Corpus Refresh" phase)
- Cron `calibration-audit` retraining path verification (defer to Phase 18 VERIF)
- Per-niche Platt parameters (structural change; defer)
- fit_score floor as availability gate (rejected — capture as tech-debt if needed)
- Persona success-rate auto-tune of SUCCESS_THRESHOLD (rejected — deliberate constant change is its own phase)
- VIRAL_SCORE_CUT/UNDER_SCORE_CUT per-niche (structural change; defer)
