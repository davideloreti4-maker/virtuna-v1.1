---
phase: 6
slug: audio-analysis-fingerprint-matching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run --changed` |
| **Full suite command** | `pnpm vitest run --coverage` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --changed`
- **After every plan wave:** Run `pnpm vitest run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-XX-XX | TBD | TBD | AUDIO-01..06, HOOK-02 | TBD | populated by planner — see <validation_strategy> below | unit / integration | `pnpm vitest run` | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner MUST replace this row with one row per task once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] **Live Gemini Flash audio reliability smoke test** — fixture: 3 real videos (talking_head, slideshow, music-heavy). Must confirm Gemini reliably emits `voice_clarity_0_10`, `audio_hook_first_2s_0_10`, ratio fields per content type before Phase 6 perceptual scoring is wired to production. Gates SC#1. (Open Question #3 from RESEARCH.md.)
- [ ] `tests/lib/engine/audio-fingerprint.test.ts` — stubs for AUDIO-05, AUDIO-06 (pgvector match + velocity)
- [ ] `tests/lib/engine/gemini-audio-fields.test.ts` — stubs for AUDIO-01..04, HOOK-02 (extended response schema extraction + content-type gating per D-A2)
- [ ] `tests/lib/engine/aggregator-audio.test.ts` — stubs for D-G1..G4 (audio signal weight, perceptual formula, fingerprint boost, audioTrendingMatch swap)
- [ ] `tests/scripts/backfill-trending-sound-embeddings.test.ts` — stubs for D-F4 (idempotency, batch resumability)
- [ ] `tests/app/api/cron/calculate-trends.test.ts` — extended for D-F4 (inline embedding computation + failure tolerance)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gemini Flash audio field reliability across content types | AUDIO-02..04, HOOK-02 | Real Gemini API behavior on real video; cannot be mocked meaningfully | Run Wave 0 smoke test fixture against live Gemini Flash; record voice_clarity / audio_hook / ratio emissions for each of 3 sample videos (talking_head, slideshow, music-heavy). Pass criterion: ≥9/9 fields emit valid values within expected ranges across the 3 fixtures. |
| pgvector cosine match precision against real trending sounds | AUDIO-05, AUDIO-06 | Quality of Gemini-description embeddings is empirically unknown for audio descriptions | After backfill completes, run 5 known-match probes (videos with known trending-sound usage) through audio_fingerprint stage. Pass criterion: ≥4/5 return correct matched_sound_id with similarity ≥ 0.80. |
| Cron embedding computation respects Gemini rate limits | AUDIO-05 | Production rate-limit behavior not testable in unit tests | After one full cron cycle, verify `trending_sounds.audio_embedding IS NOT NULL` for all newly-upserted rows AND no Gemini 429s in logs. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (live Gemini smoke + test scaffolds)
- [ ] No watch-mode flags (vitest run, not vitest --watch)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Critical Sample Points (from RESEARCH.md Validation Architecture)

1. **Perceptual score boundaries** — voice_clarity_0_10, audio_hook_first_2s_0_10 at 0, 5, 10. Ratios at exact 0/0/1.0, 1.0/0/0, 0/1.0/0, mid-range 0.33/0.33/0.34. Sum-to-1.0 invariant enforced.
2. **Fingerprint threshold boundary** — similarity at 0.79 (no match), 0.80 (boundary), 0.85 (clear match), 0.95 (high confidence). Threshold parameterized; test both above-threshold and below-threshold paths.
3. **Content-type gating edge cases** — per D-A2:
   - talking_head + null voice_clarity → graceful degradation path
   - slideshow + emitted voice_clarity → ignored per D-A2 (null expected, but Gemini may emit anyway)
   - other → full passthrough
4. **Velocity / trend_phase coverage** — emerging (+15), rising (+10), peak (+5), declining (-5), no match (0). All 5 paths exercised.
5. **audio_perceptual_score formula coverage** — formula switch per content type. All 7 content types: talking_head, b_roll, slideshow, action, tutorial, vlog, other.
6. **Aggregator weight redistribution** — audio absent → existing signals re-normalize; audio present without fingerprint → audio_perceptual_score only; audio present with fingerprint → audio_perceptual_score + audio_fingerprint_boost.
7. **FeatureVector.audioTrendingMatch field swap** — fingerprint cosine (0-1) when available, Jaro-Winkler score (0-1) when fingerprint unavailable. Field semantics unchanged.

## Failure-Mode Coverage

| Failure path | Trigger condition | Expected behavior | Test command |
|--------------|-------------------|-------------------|--------------|
| Gemini omits audio fields | Mock Gemini response with video fields only | `signal_availability.audio = false`, warning emitted, audio weight redistributes | `pnpm vitest run aggregator-audio.test.ts -t "audio absent"` |
| audio_description too short for embedding | Mock Gemini emits 5-char description | Embedding skipped, `signal_availability.audio_fingerprint = false`, falls back to Jaro-Winkler | `pnpm vitest run audio-fingerprint.test.ts -t "description too short"` |
| Gemini text embedding API fails | Mock embedContent throws | Fingerprint stage returns null, fallback engages | `pnpm vitest run audio-fingerprint.test.ts -t "embedding api fails"` |
| pgvector no match above threshold | Mock RPC returns empty array | `signal_availability.audio_fingerprint = false`, Jaro-Winkler runs | `pnpm vitest run audio-fingerprint.test.ts -t "no match"` |
| pgvector match below 0.80 | Mock RPC returns similarity 0.78 | Treated as no match | `pnpm vitest run audio-fingerprint.test.ts -t "below threshold"` |
| Backfill script crashes mid-batch | Kill on row N | Resumable on next run (idempotent ON CONFLICT) | `pnpm vitest run backfill-trending-sound-embeddings.test.ts -t "resumable"` |
| Cron embedding failure on one row | Mock embedContent throws on row 3 of 5 | Row 3 upserts without embedding; rows 1,2,4,5 succeed; warn logged | `pnpm vitest run calculate-trends.test.ts -t "embedding failure tolerance"` |

## Confidence Intervals

- **Similarity threshold (0.80 baseline)** — validated against Phase 12 benchmark with the Phase 6 corpus. Acceptable recall range: ≥0.70 on known-match probes; precision ≥0.85 (avoid false positives boosting non-matching sounds). Adjust threshold in Phase 10 ML audit if benchmark shows mis-calibration.
- **audio_perceptual_score formula coefficients** — Phase 6 ships reasonable starting weights per D-G3; Phase 10 ML audit refines against corpus accuracy contribution.
- **Audio signal weight (0.05-0.10 placeholder)** — planner picks specific value in this range; Phase 10 retunes after corpus benchmark measures audio's accuracy delta.
