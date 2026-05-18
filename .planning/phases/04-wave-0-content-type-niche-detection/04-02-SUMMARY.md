---
phase: 04-wave-0-content-type-niche-detection
plan: 02
subsystem: engine
tags: [gemini-3-flash, deepseek-v4-flash, wave0, content-type-detector, niche-detector, dual-env, prompts]

# Dependency graph
requires:
  - phase: 04-wave-0-content-type-niche-detection/04-01
    provides: Wave0ContentTypeResult + Wave0NicheResult schemas, NICHE_TREE with personas/benchmark_filters, ContentTypeSlug enum
provides:
  - detectContentType() — Gemini 3 Flash on video[0..5s] with responseSchema + graceful degradation
  - detectNiche() — DeepSeek V4 Flash hierarchical niche classifier with Card 1 fallback + drift detection
  - NICHE_SYSTEM_PROMPT (STABLE module-level const) + buildNicheUserMessage (VOLATILE per-call) in wave0/prompts.ts
  - GEMINI_WAVE0_MODEL env (separate from GEMINI_MODEL — Wave 1 untouched)
  - DEEPSEEK_NICHE_MODEL env (separate from DEEPSEEK_MODEL — Wave 2 thinking-mode untouched until 2026-07-24)
affects: [04-03-orchestration, 07-personas, 08-retrieval, 10-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-env D-03 deviation: NEW DEEPSEEK_NICHE_MODEL alongside existing DEEPSEEK_MODEL — avoids silently dropping Wave 2 thinking-mode reasoning quality"
    - "STABLE/VOLATILE prompt split for DeepSeek input cache: NICHE_TREE.map at module load (byte-identical prefix), all dynamic creator context in user message"
    - "Two-stage LLM response validation: (1) Zod safeParse on shape; (2) NICHE_TREE slug existence check (Pitfall 3 mitigation)"
    - "Graceful degradation pattern (D-16): every error path returns null + emits stage_end with ok:false — NEVER throws to caller"
    - "Pitfall 4 — Card-1 self-validity: Card 1 niche_primary/sub must themselves be valid NICHE_TREE slugs before being used as fallback (handles taxonomy drift after creator filled their profile)"
    - "PROFILE-16 host-only mitigation inherited from Phase 2: past_wins/past_flops URLs surfaced as new URL(u).host only — never full URLs in LLM prompt"

key-files:
  created:
    - src/lib/engine/wave0/prompts.ts
    - src/lib/engine/wave0/content-type-detector.ts
    - src/lib/engine/wave0/niche-detector.ts
    - src/lib/engine/__tests__/wave0-content-type.test.ts
    - src/lib/engine/__tests__/wave0-niche-detector.test.ts
  modified: []

key-decisions:
  - "D-03 deviation documented (per RESEARCH Topic #12): introduced new DEEPSEEK_NICHE_MODEL env defaulting to 'deepseek-v4-flash' instead of flipping shared DEEPSEEK_MODEL. The shared env still resolves to 'deepseek-reasoner' which routes to V4 Flash thinking-mode through 2026-07-24 — flipping it would silently degrade Wave 2 reasoning. Wave 2 V4 explicit migration must land before 2026-07-24 in a future phase (Phase 5/9/10 caller's choice)."
  - "GEMINI_WAVE0_MODEL default = 'gemini-3-flash-preview' (NOT bare 'gemini-3-flash' — bare alias not GA as of 2026-05-18 per RESEARCH Topic #1 + Anti-Pattern). Track Gemini API changelog and flip to bare when GA."
  - "videoMetadata uses STRING durations ('0s'/'5s') — Gemini API rejects integers (RESEARCH Anti-Pattern)."
  - "Wave 0 video upload is independent (Pattern 2 option A) — simpler than coupling to Wave 1 upload ordering. Adds ~1.5MB network + 1-2s latency. Phase 5 may unify uploads."
  - "No circuit breaker for niche detector: shared DeepSeek breaker in deepseek.ts is tied to Wave 2 critical-path; niche detector uses one-shot try/catch with timeout — graceful degradation via null return is sufficient (PATTERNS §Retry+Timeout)."

patterns-established:
  - "Wave 0 module dir convention: src/lib/engine/wave0/ — detectors + prompts + helpers as separate files (continued from Plan 04-01)"
  - "Detector test scaffold: env vars BEFORE import, vi.mock hoisted with function-style MockClass, beforeEach resets mock state — works for both Gemini Files API and DeepSeek chat.completions"
  - "Sub-slug test data: use real NICHE_TREE sub-slugs in test mocks (e.g., 'strength-training' for fitness, not 'gym') — otherwise sub-slug validation throws before fallback/drift logic can execute"

requirements-completed: [CONTENT-01, CONTENT-02]

# Metrics
duration: ~7min
completed: 2026-05-18
---

# Phase 04 Plan 02: Wave 0 Detector Implementations Summary

**Two LLM-driven Wave 0 detectors built atomically with TDD: Gemini 3 Flash content-type classifier on video[0..5s] (10 tests) + DeepSeek V4 Flash hierarchical niche classifier with Card 1 fallback + drift detection (14 tests) — both with graceful degradation (D-16), explicit threat mitigations, and the D-03 dual-env deviation documented inline.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-18T01:56:49Z
- **Completed:** 2026-05-18T02:03:57Z
- **Tasks:** 3 (all type=auto, all tdd=true)
- **Files created:** 5 (909 total LOC: 513 source + 396 test)

## Accomplishments

- **Wave 0 detectors shipped in isolation BEFORE Plan 04-03 orchestrator wiring** — both detectors emit their own stage_start/stage_end pairs (event-emission ownership moves DOWN from wave0.ts per PATTERNS Critical Cross-File Constraint #7).
- **D-03 deviation honored** — introduced `DEEPSEEK_NICHE_MODEL` (default `"deepseek-v4-flash"`) without modifying `DEEPSEEK_MODEL`. Wave 2's `reasonWithDeepSeek` keeps `DEEPSEEK_MODEL=deepseek-reasoner` → routes to V4 Flash thinking-mode automatically until 2026-07-24. Migration deadline carried forward.
- **GEMINI_WAVE0_MODEL introduced** with explicit default `"gemini-3-flash-preview"` (not bare alias). Wave 1's `GEMINI_MODEL` UNCHANGED.
- **Two-stage validation per RESEARCH Topic #8** — Zod safeParse on shape + NICHE_TREE slug existence check. Out-of-tree hallucinations (e.g., "interior-design") rejected with null return + ok:false stage_end.
- **Card 1 fallback / drift detection (D-05, D-06) + Pitfall 4 (invalid Card 1 slug)** — three-branch decision tree exercised by Tests 2, 4, 5, 12 of niche detector.
- **PROFILE-16 mitigation inherited** — `buildNicheUserMessage` extracts hosts only from past_wins URLs via `new URL(u).host`; reference creator handles via `/@([a-zA-Z0-9._]+)/` regex.

## Task Commits

Each task was committed atomically (RED → GREEN cycle for TDD tasks):

1. **Task 1: Build prompts.ts with STABLE NICHE_SYSTEM_PROMPT + buildNicheUserMessage** — `8e38faf` (feat)
   - No separate RED commit — pure transform consumed by niche detector tests in Task 3
2. **Task 2: Build content-type-detector.ts (Gemini 3 Flash) + 10 unit tests**
   - RED — `4acd9e6` (test: failing tests, module missing)
   - GREEN — `0c1fde2` (feat: detector created, 10/10 passing)
3. **Task 3: Build niche-detector.ts (DeepSeek V4 Flash dual-env) + 14 unit tests**
   - RED — `57ffbf2` (test: failing tests, module missing)
   - GREEN — `00f4db2` (feat: detector created, 14/14 passing)

## Files Created/Modified

**Created (5 files, 909 total LOC):**
- `src/lib/engine/wave0/prompts.ts` (116 LOC) — `NICHE_SYSTEM_PROMPT` STABLE const + `buildNicheUserMessage()` VOLATILE builder with PROFILE-16 helpers
- `src/lib/engine/wave0/content-type-detector.ts` (210 LOC) — `detectContentType()` Gemini 3 Flash on video[0..5s] with responseSchema + Zod + graceful degradation + best-effort file cleanup
- `src/lib/engine/wave0/niche-detector.ts` (187 LOC) — `detectNiche()` DeepSeek V4 Flash with two-stage validation + Card 1 fallback + drift detection + micro null + dual-env
- `src/lib/engine/__tests__/wave0-content-type.test.ts` (178 LOC) — 10 test cases covering happy path, video_upload guard, upload failure, FAILED state, Zod validation, stage events, cost cap, low_confidence warning, mixed warning
- `src/lib/engine/__tests__/wave0-niche-detector.test.ts` (218 LOC) — 14 test cases covering happy path, Card 1 fallback (D-05), AI source, drift detection (D-06), no-fallback warning, micro null (D-07), confidence boundaries 0.59/0.60, unknown primary/sub slugs (Pitfall 3), Card 1 invalid slug (Pitfall 4), stage events, cost telemetry

**Modified:** None. Plan 04-01 already widened types.ts + taxonomy.ts; this plan only consumes those exports.

## Test Results

| Suite | Existing | New | Total | Status |
| --- | --- | --- | --- | --- |
| `wave0-content-type.test.ts` | 0 | 10 | 10 | green |
| `wave0-niche-detector.test.ts` | 0 | 14 | 14 | green |
| `stubs.test.ts` (regression — Wave 0 stub contract unchanged) | 9 | 0 | 9 | green |
| `content-type-weights.test.ts` (regression — Plan 04-01) | 12 | 0 | 12 | green |
| `deepseek.test.ts` (regression — Wave 2 untouched, dual-env not flip) | 21 | 0 | 21 | green |
| `gemini.test.ts` (regression — Wave 1 model untouched) | 23 | 0 | 23 | green |
| **Total (Wave 0 + Wave 1 + Wave 2 + stubs)** | **65** | **24** | **89** | **green** |

24 new tests across detectors. Zero regressions in Wave 1/Wave 2/Phase 3 stubs.

## Decisions Made

- **D-03 dual-env over flip** (per RESEARCH Topic #12 + PATTERNS Critical Cross-File Constraint #4): Introduced `DEEPSEEK_NICHE_MODEL` defaulting to `"deepseek-v4-flash"` for the new Wave 0 niche detector, used EXCLUSIVELY here. The shared `DEEPSEEK_MODEL` env is UNCHANGED — still resolves to `"deepseek-reasoner"` which routes to V4 Flash thinking-mode through 2026-07-24 deadline. Wave 2's `reasonWithDeepSeek` reasoning quality preserved; explicit Wave 2 V4 migration must land in a future phase (Phase 5/9/10 — caller's choice) before 2026-07-24 15:59 UTC.
- **Gemini 3 Flash model ID hardcoded explicit preview tag** (`"gemini-3-flash-preview"`): Per RESEARCH Topic #1 + Anti-Pattern, bare `"gemini-3-flash"` is NOT a valid alias as of 2026-05-18. Track Gemini API changelog and flip to bare when GA.
- **videoMetadata STRING durations** (`startOffset: "0s"`, `endOffset: "5s"`): Gemini API rejects integers per RESEARCH Pitfall + Anti-Pattern. D-01 5s window enforced.
- **Independent Wave 0 video upload** (Pattern 2 option A): Adds ~1.5MB network + 1-2s latency per analysis vs coupling to Wave 1 upload ordering. Phase 5 may unify uploads when adding 3 segment calls. Per RESEARCH Open Question #2.
- **No circuit breaker for niche detector**: The shared DeepSeek breaker in `deepseek.ts` is tied to Wave 2's critical-path; the new niche detector uses one-shot try/catch with 15s timeout. Graceful degradation via null return is sufficient (PATTERNS §Retry+Timeout). If a Wave 0 niche failure storm becomes a real problem, a dedicated breaker can be added later without touching Wave 2.
- **Sub-slug test data substitution** (Rule 1 deviation): plan's literal test data used `sub: "gym"` for the fitness primary in 4 places (Tests 2, 4, 8, 9 of niche detector), but `"gym"` is NOT in `NICHE_TREE["fitness"].subs` — would have tripped sub-slug validation (Pitfall 3) BEFORE the fallback/drift code paths could run. Substituted with `"strength-training"` (a real fitness sub-slug) so disagreement-with-Card-1 scenarios exercise the intended code paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan test data] Substituted `sub: "gym"` → `sub: "strength-training"` in 4 niche detector test cases**

- **Found during:** Task 3 (test authoring)
- **Issue:** Plan's verbatim test data for `OTHER_VALID_PRIMARY = "fitness"` paired with `sub: "gym"` — but `"gym"` is NOT in `NICHE_TREE["fitness"].subs` (the actual fitness sub-slugs are `strength-training`, `calisthenics`, `yoga`, `running`, `home-workouts`, `nutrition-diet`, `mobility`, `crossfit`, `powerlifting`, `bodybuilding`). The plan's implementation throws on unknown sub-slugs (Pitfall 3, Test 11) BEFORE the fallback/drift logic runs, so Tests 2, 4, 8, 9 would have failed because they expect `card1_fallback`/AI/drift outcomes, not null.
- **Fix:** Replaced `sub: "gym"` with `sub: "strength-training"` (a real fitness sub-slug) in Tests 2, 4, 8, 9. Introduced a named constant `OTHER_VALID_SUB = "strength-training"` near `OTHER_VALID_PRIMARY` for symmetry and clarity. Added inline comment explaining the substitution.
- **Files modified:** `src/lib/engine/__tests__/wave0-niche-detector.test.ts`
- **Commit:** `57ffbf2` (RED) — substitution is part of the initial test write
- **Risk:** None. The test intent (disagreement with Card 1 / non-card1 primary) is preserved; only the sub-slug is changed from a hallucination to a real taxonomy entry. Test 11 still exercises the unknown-sub-slug path (uses `"invented-sub-slug"`).

### Other Deviations

None. All other code is verbatim per the plan body, including:
- `GEMINI_WAVE0_MODEL`, `DEEPSEEK_NICHE_MODEL`, `NICHE_CONFIDENCE_THRESHOLD`, `NICHE_MICRO_CONFIDENCE_THRESHOLD` env var names + defaults
- Pricing constants (Gemini 3 Flash $0.50/$3 per M tokens; DeepSeek V4 cache hit/miss $0.0028/$0.14 per M)
- Timeout constants (Gemini 20s API + 60s poll; DeepSeek 15s)
- `RESPONSE_SCHEMA` for Gemini (Type enum literals)
- `NICHE_SYSTEM_PROMPT` body text (researcher-locked)
- Two-stage validation order (Zod → slug check)
- Three-branch fallback decision tree (D-05/D-06/Pitfall 4)

## Authentication Gates

None. Both detectors mock their LLM clients in tests; runtime calls would use the existing `GEMINI_API_KEY` + `DEEPSEEK_API_KEY` env vars present since Phase 2/3.

## Threat Mitigations Implemented

| Threat ID | Mitigation in code | Test coverage |
|-----------|---------------------|---------------|
| T-04-V5-02 (Tampering — out-of-tree niche slug hallucination) | Two-layer check: Zod `Wave0NicheResultSchema.safeParse` validates shape; `isPrimarySlugValid(result.primary)` + `getNicheBranches(...)` validate against `NICHE_TREE`. Mismatch → throw → caught → null return + ok:false stage_end. | Tests 10 ("interior-design" unknown primary), 11 (unknown sub for valid primary), 12 (Card 1 invalid slug → no_fallback warning) |
| T-04-V5-03 (Tampering — Gemini content_type hallucination) | Native `responseSchema.enum` at Gemini API + Zod `Wave0ContentTypeResultSchema.safeParse` parses against `ContentTypeEnumSchema`. Two-layer rejection of out-of-enum values. | Test 5 (`{type: "INVALID"}` → null return) |
| T-04-V5-04 (Prompt injection via past_wins/past_flops URLs — PROFILE-16 inheritance) | `buildNicheUserMessage` calls `tryUrlHost(u.url)` per item; `extractHandleOrHost` for reference_creators. Full URLs NEVER passed to LLM prompt. | Behavior tested implicitly via niche detector test mocks (no URL strings reach the prompt) — explicit unit tests for prompt builder deferred to Plan 04-03 if needed |
| T-04-V14-05 (Sensitive content leaking into Sentry/logs) | `log.info` calls only carry structured fields (stage, confidence, cost_cents, slug names); `content_text` and raw user-supplied strings NEVER logged. `Sentry.captureException` uses tags-only metadata. | Verified via grep against detector files (no `content_text` in `log.info` args) |

## Known Stubs

None. Both detectors are fully wired — no placeholder values reach UI/output. The wave0 stub (`runWave0`) in `src/lib/engine/wave0.ts` is unchanged and still returns `{content_type: null, niche: null}` — that's by design; Plan 04-03 (orchestration) will wire the new detectors into `runWave0`.

## Issues Encountered

- Fresh worktree had no `node_modules` — resolved with `pnpm install` (~7s). Not a code issue; expected for any worktree spawn.
- Single-file `pnpm tsc --noEmit src/lib/engine/wave0/prompts.ts` invocation bypasses tsconfig (no `esModuleInterop`) and produces 100+ false-positive locale-import errors from `zod/v4/locales/index.d.cts`. Workaround: ran project-wide `pnpm tsc --noEmit` and filtered for wave0/prompts errors — none found.

## User Setup Required

None. No new env vars are *required* at runtime — both `GEMINI_WAVE0_MODEL` and `DEEPSEEK_NICHE_MODEL` have sane defaults baked in:
- `GEMINI_WAVE0_MODEL` defaults to `"gemini-3-flash-preview"` — only set when bare `"gemini-3-flash"` flips to GA
- `DEEPSEEK_NICHE_MODEL` defaults to `"deepseek-v4-flash"` — already-correct setting
- `NICHE_CONFIDENCE_THRESHOLD` / `NICHE_MICRO_CONFIDENCE_THRESHOLD` default to `0.6` per D-05/D-07 — env-overridable for eval tuning if Phase 10 calibration recommends a different cutoff

Existing `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` from Phase 1/2/3 cover both detectors.

## Next Plan Readiness

**Ready for Plan 04-03 (orchestration):**
- Import `detectContentType` from `@/lib/engine/wave0/content-type-detector`
- Import `detectNiche` from `@/lib/engine/wave0/niche-detector`
- `runWave0` in `src/lib/engine/wave0.ts` can replace its stub no-ops with parallel `Promise.all([detectContentType(payload, onEvent), detectNiche(payload, creatorContext, onEvent)])`. Both detectors already emit their own `wave_0_content_type` / `wave_0_niche_detector` stage events, so `wave0.ts` should STOP emitting those event names itself (event-emission ownership moves DOWN per PATTERNS CCC #7).
- Aggregator integration: `SignalAvailability.content_type` and `.niche` fields (added in Plan 04-01) are wired by Plan 04-03 from `wave0Result.content_type !== null` and `wave0Result.niche !== null`.

**Carry-forward reminder (CRITICAL DEADLINE):**
- **2026-07-24 15:59 UTC** — `deepseek-reasoner` alias stops routing to V4 Flash thinking-mode. A future phase MUST explicitly migrate `DEEPSEEK_MODEL` from `"deepseek-reasoner"` to either `"deepseek-v4-pro"` (preserves reasoning quality) OR `"deepseek-v4-flash"` with thinking mode parameter (cost-positive if quality holds). This was deferred from Phase 4 D-03 to a follow-up phase per RESEARCH Topic #12.

**No blockers.**

## Self-Check: PASSED

- **Created files (all 5 confirmed present):**
  - `src/lib/engine/wave0/prompts.ts` ✓ FOUND (116 LOC)
  - `src/lib/engine/wave0/content-type-detector.ts` ✓ FOUND (210 LOC)
  - `src/lib/engine/wave0/niche-detector.ts` ✓ FOUND (187 LOC)
  - `src/lib/engine/__tests__/wave0-content-type.test.ts` ✓ FOUND (178 LOC)
  - `src/lib/engine/__tests__/wave0-niche-detector.test.ts` ✓ FOUND (218 LOC)
- **Modified files:** None (verified via git log)
- **Commits (5 confirmed in git log):**
  - `8e38faf` (feat — prompts.ts) ✓
  - `4acd9e6` (test RED — content-type) ✓
  - `0c1fde2` (feat GREEN — content-type) ✓
  - `57ffbf2` (test RED — niche) ✓
  - `00f4db2` (feat GREEN — niche) ✓
- **Tests:** 24/24 new (10 content-type + 14 niche) + 65/65 regression (9 stubs + 12 content-type-weights + 21 deepseek + 23 gemini) = 89/89 total green
- **Acceptance criteria grep results:** all met (`GEMINI_WAVE0_MODEL` count=2, `DEEPSEEK_NICHE_MODEL` count=3, `DEEPSEEK_MODEL` in deepseek.ts UNCHANGED=1, `card1_fallback`=1, `niche_drift_detected`=1, `niche_low_confidence_no_fallback`=2, `isPrimarySlugValid`+`NICHE_TREE.some`=5, `MICRO_THRESHOLD`+`micro_confidence`=4, `NICHE_SYSTEM_PROMPT`=2 in niche-detector)
- **D-03 dual-env verified:** `deepseek.ts` line 19 still reads `DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner"` (unchanged); Wave 2 reasoning untouched
- **PROFILE-16 mitigation wired:** `buildNicheUserMessage` uses `tryUrlHost(w.url)` for past_wins, `extractHandleOrHost(r.handle_or_url)` for reference_creators — never passes full URLs

---
*Phase: 04-wave-0-content-type-niche-detection*
*Completed: 2026-05-18*
