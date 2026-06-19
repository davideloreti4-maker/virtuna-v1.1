---
phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet
plan: 02
subsystem: engine
tags: [sim-1-flash, rubric-critic, value-bar, best-of-n, flop-pass, quality-loop, vitest, tdd]

# Dependency graph
requires:
  - phase: 14-kc-grounding-quality-loop (plan 01)
    provides: resolveNicheKey wired into Ideas+Hooks panel build; KCQ-05 gate formalized (band !== "Weak") + drift-locked thresholds
  - phase: 03-ideas-tool
    provides: ideas-runner over-generate → parallel SIM → gate spine
  - phase: 04-hooks-tool
    provides: hooks-runner over-generate → parallel SIM → gate → rank spine
provides:
  - critiqueAgainstRubric(item, framing, panel) → { pass, predictedFailureMode } — the independent Flash rubric-critic (BASE Value Bar Test A/B/C + Prohibition 6 trope test)
  - RubricVerdict type (rubric-critic.ts)
  - predictedFailureMode optional field on IdeaCardBlockSchema + HookCardBlockSchema (no migration)
  - combined runtime gate in both runners: keep iff band !== "Weak" AND verdict.pass
  - conditional single regeneration (D-06): regenerate ONCE only when zero candidates pass
affects: [14-04, kc-grounding, quality-loop, opt-in-drill-reveal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent parallel critic: a SEPARATE Flash json_object call run in the SAME Promise.all pair as the SIM band (D-05/D-08 — independent judge, ~1x wall-clock)"
    - "Shared-call flop pass: ONE critic call returns both the gate signal (pass) and the KCQ-04 texture (predictedFailureMode) — cheapest"
    - "Fail-safe judge: transport/parse error resolves to pass:false, never throws into Promise.all (a judge that can't judge abstains as a fail, never silently passes slop)"
    - "Conditional single regeneration on all-fail (D-06) — bounded, never unbounded serial; 0 survivors stays valid"

key-files:
  created:
    - src/lib/engine/flash/rubric-critic.ts
    - src/lib/engine/flash/__tests__/rubric-critic.test.ts
    - src/lib/tools/runners/__tests__/best-of-n.test.ts
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/runners/ideas-runner.ts
    - src/lib/tools/runners/hooks-runner.ts
    - src/lib/tools/runners/__tests__/ideas-runner.test.ts
    - src/lib/tools/runners/__tests__/hooks-runner.test.ts

key-decisions:
  - "SEPARATE parallel critic call (not an extended SIM call) — preserves D-08 independent-judge property (RESEARCH Open Q2). SIM + critic run as a Promise.all pair per candidate inside the existing candidate Promise.all → wall-clock stays ~1x."
  - "Critic errs strict: anything that is not an unambiguous pass:true coerces to pass:false. A failing/unparseable verdict NEVER upgrades to pass — the gate cannot be bypassed by model sloppiness."
  - "predictedFailureMode is OPTIONAL nullable on both card schemas → existing persisted blocks + rehydration stay valid with no migration (absent ≡ null for older cards)."
  - "Conditional regen runs ONCE on zero survivors, then proceeds with whatever survives (may be 0). Preserves the existing '0 blocks is valid' contract while giving the all-fail case one more parallel shot (D-06)."

patterns-established:
  - "Runtime execution of the BASE Value Bar (rightness over discipline) — the rubric is now applied at generate-time, not just authored"
  - "Combined gate = SIM band (KCQ-05) AND rubric verdict (KCQ-02) in both Ideas + Hooks runners"

requirements-completed: [KCQ-02, KCQ-04, KCQ-07]

# Metrics
duration: 12min
completed: 2026-06-20
---

# Phase 14 Plan 02: Quality Loop — Parallel Rubric-Critic Summary

**A parallel Flash rubric-critic (the independent judge) now executes the BASE Value Bar — Test A named mechanism / Test B non-fakeable concrete / Test C fit + Prohibition 6 trope test — at runtime against every Ideas + Hooks candidate; the combined gate ships only candidates that pass the rubric AND clear the SIM band, with one bounded regen on all-fail and a `predictedFailureMode` flop texture riding onto each card — all parallel (~1x latency), text path only, no ENGINE_VERSION bump.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-20
- **Completed:** 2026-06-20
- **Tasks:** 2 (Task 1 TDD: RED → GREEN)
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- **`critiqueAgainstRubric` — the independent judge (KCQ-02 + KCQ-04 + KCQ-07):** new `src/lib/engine/flash/rubric-critic.ts` makes ONE bounded Qwen `json_object` Flash call (own FLASH_MODEL seam, `temperature:0` + `seed:QWEN_SEED`, AbortController timeout) returning `{ pass, predictedFailureMode }`. The system prompt encodes the corpus BASE Value Bar verbatim-in-spirit (Test A named mechanism / Test B non-fakeable concrete with the find-and-replace test / Test C fit) plus Prohibition 6's "obvious list" trope check (`base.md:260-303`). The trope clause covers KCQ-07's thin runtime reject; the shared `predictedFailureMode` field is KCQ-04's flop pass (one call, two uses — RESEARCH Pattern 3). **HARD ISOLATION:** imports only `qwen/client`, `utils/strip`, and the `flash-prompts` TYPES — no pipeline/aggregator/version/wave3 internals (mirrors `run-flash-text-mode.ts:8-13`), so the SIM-1 Max video path stays byte-stable.
- **Fail-safe resilience (D-08):** transport / timeout / parse / shape errors all RESOLVE to a fail-safe verdict (`pass:false`) — the critic NEVER throws into the runner's `Promise.all`, mirroring the existing `runFlashTextMode(...).catch(() => null)`. A judge that can't judge abstains as a fail; it never silently passes slop.
- **Combined gate wired into both runners (KCQ-02 + KCQ-05):** in `ideas-runner.ts` and `hooks-runner.ts`, each candidate now fires the SIM band and `critiqueAgainstRubric` as a `Promise.all` PAIR inside the existing candidate `Promise.all` — parallel, never serial (D-05; the "2-4× latency" objection only applies to serial regeneration). The gate keeps a candidate iff `band !== "Weak"` AND `verdict.pass`. Hooks preserves its gate-then-rank flow (D-01); Ideas keeps MAX_SURVIVORS=3, Hooks keeps MAX_HOOKS=5.
- **Conditional single regeneration (D-06):** when ZERO candidates clear the combined gate, each runner regenerates ONCE (one extra parallel over-generate + critique pass), then proceeds with whatever survives (may still be 0). Bounded — never an unbounded serial loop; the "0 blocks is valid" contract is preserved.
- **`predictedFailureMode` on the cards (KCQ-04):** added `z.string().nullable().optional()` to both `IdeaCardBlockSchema` and `HookCardBlockSchema`. The critic's failure-mode texture rides onto each surviving card (null on clean pass) for the opt-in drill-reveal built in 14-04. Optional → no migration; existing persisted blocks + rehydration stay valid.

## Task Commits

Each task committed atomically:

1. **Task 1 (TDD RED): failing test for the Flash rubric-critic** — `06c2ec19` (test)
2. **Task 1 (TDD GREEN): implement the Flash rubric-critic** — `91922a02` (feat)
3. **Task 2: wire best-of-N + flop pass into both runners + card schema** — `e3f82e94` (feat)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified

- `src/lib/engine/flash/rubric-critic.ts` (created) — `critiqueAgainstRubric(item, framing, panel) → { pass, predictedFailureMode }`; one bounded Flash json_object call executing the BASE Value Bar + Prohibition 6; HARD ISOLATION; fail-safe (never throws); strict coercion (only unambiguous pass:true → pass).
- `src/lib/engine/flash/__tests__/rubric-critic.test.ts` (created) — 5 assertions: pass→null failureMode, trope-fail→non-empty failureMode, transport error→fail-safe, malformed JSON→fail-safe, null-niche panel still verdicts.
- `src/lib/tools/runners/__tests__/best-of-n.test.ts` (created) — 5 assertions: combined gate drops Strong+rubric-fail (Ideas & Hooks), predictedFailureMode carried onto Ideas & Hooks cards, conditional single regen on all-fail (exactly 2 generation calls + 10 critic calls, bounded).
- `src/lib/tools/blocks.ts` (modified) — `predictedFailureMode` optional nullable field on IdeaCardBlockSchema + HookCardBlockSchema (no migration).
- `src/lib/tools/runners/ideas-runner.ts` (modified) — extracted `gatePass(batch)` helper running the SIM+critic Promise.all pair + combined gate; first batch then conditional single regen; predictedFailureMode onto the card; isolation-header updated.
- `src/lib/tools/runners/hooks-runner.ts` (modified) — same wiring via `gateHooks(batch)`; survivors now carry their personas (FLYWHEEL pin no longer keyed off a parallel simResults array); rank+trim preserved; conditional single regen; predictedFailureMode onto the card; isolation-header updated.
- `src/lib/tools/runners/__tests__/ideas-runner.test.ts` (modified) — mock `critiqueAgainstRubric` (default pass:true); the all-Weak test now asserts the bounded-regen contract (10 SIM calls + 2 generation calls).
- `src/lib/tools/runners/__tests__/hooks-runner.test.ts` (modified) — mock `critiqueAgainstRubric` (default pass:true); the all-Weak test now asserts the bounded-regen contract (16 SIM calls + 2 generation calls).

## Decisions Made

- **Separate parallel critic call, not an extended SIM call (RESEARCH Open Q2 / D-08).** Independence is the point: the rubric judge is a distinct call from the SIM band, run in the same `Promise.all` pair so wall-clock stays ~1x. This preserves the independent-judge property at the cost of one extra (cheap, parallel) Flash call per candidate.
- **Critic errs strict (gate cannot be bypassed).** `coerceVerdict` upgrades to `pass:true` ONLY on an unambiguous boolean `true` (or the strings true/pass/yes). Any other shape, a missing field, malformed JSON, or a transport error → `pass:false`. Model sloppiness can never sneak slop past the gate.
- **predictedFailureMode optional → no migration.** Older persisted Idea/Hook cards validate unchanged (absent ≡ null); the field is populated going forward for 14-04's drill-reveal.
- **Conditional regen runs once, then stops.** All-fail gets one more parallel shot (D-06); after that the runner returns whatever survives (possibly 0). No unbounded serial loop — the latency objection (D-05) is structurally avoided.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS `never`-narrowing on the Ideas FLYWHEEL pin**
- **Found during:** Task 2 (tsc verification).
- **Issue:** Moving the survivor loop into the `gatePass` closure meant the outer `leadPersonas` / `firstSimPersonas` `let`s are mutated only inside a closure. TS control-flow analysis narrows them to their `null` initializer (it does not track closure assignments), so `leadPersonas ?? firstSimPersonas` inferred `never` and `.length` failed to compile (`ideas-runner.ts` TS2339).
- **Fix:** Re-widen explicitly at the read site: `const pinnedPersonas = (leadPersonas ?? firstSimPersonas) as FlashPersona[] | null;` before the runtime null-check. Runtime behavior unchanged.
- **Files modified:** `src/lib/tools/runners/ideas-runner.ts`
- **Commit:** `e3f82e94`

**2. [Rule 3 - Blocking] Existing runner tests assumed no critic + no regen**
- **Found during:** Task 2.
- **Issue:** The runners now call `critiqueAgainstRubric` unconditionally; the pre-14-02 `ideas-runner.test.ts` / `hooks-runner.test.ts` did not mock it, so the real critic ran against a client mocked to return idea/hook JSON (no `pass:true`) → strict coercion failed every candidate → all gate tests broke. Separately, the "all-Weak → no regen, Flash called N times" assertions are now legitimately N×2 (one D-06 regen).
- **Fix:** Added a default `critiqueAgainstRubric` mock (`pass:true`) to both existing test files so the SIM band stays the sole discriminator in those pre-14-02 gate/rank tests; updated the two all-fail assertions to the bounded-regen contract (exactly 2 generation calls, 2× the SIM count) — verifying the regen is bounded, not unbounded. This is required-to-pass test maintenance for changed behavior, not a feature change.
- **Files modified:** `src/lib/tools/runners/__tests__/ideas-runner.test.ts`, `src/lib/tools/runners/__tests__/hooks-runner.test.ts`
- **Commit:** `e3f82e94`

## Issues Encountered

- **Pre-existing test-file tsc noise (5 errors, unchanged by this plan).** `tsc --noEmit` reports 5 errors in `ideas-runner.test.ts` / `hooks-runner.test.ts` — `user_id` not on `ProfileRow` (test fixtures) + two `Object possibly undefined`. Verified via `git stash` that all 5 exist on HEAD before this plan's changes (5 before, 5 after). My new test files (`rubric-critic.test.ts`, `best-of-n.test.ts`) add ZERO new tsc errors. Out of scope (SCOPE BOUNDARY) — pre-existing, already tracked.

## Verification

- `npx vitest run src/lib/engine/flash/__tests__/rubric-critic.test.ts` → PASS (5).
- `npx vitest run src/lib/tools/runners/__tests__/best-of-n.test.ts` → PASS (5).
- `npx vitest run src/lib/engine/flash` → PASS (82).
- `npx vitest run src/lib/tools/runners src/app/api/tools src/lib/tools` → PASS (207).
- `npx vitest run src/lib/engine src/lib/tools src/lib/kc` → PASS (1342) (1318 at 14-01 + new/adjusted).
- **Latency posture:** `grep "await critiqueAgainstRubric"` → 0 matches (no awaited critic inside a per-candidate `for` loop). Critic runs inside the candidate `Promise.all` as a pair with the SIM call — parallel, ~1x.
- **Acceptance greps:** `grep -c predictedFailureMode blocks.ts` = 2; `grep -c critiqueAgainstRubric ideas-runner.ts` = 3, `hooks-runner.ts` = 3; isolation grep on rubric-critic.ts → only qwen/client + utils/strip + flash-prompts type (no `@/lib/engine` deep import).
- **No engine bump:** `run-flash-text-mode.ts`, `flash-prompts.ts`, `persona-registry.ts`, `version.ts` — NONE in `git status`. ENGINE_VERSION untouched (3.19.0). No Max video-path file touched.
- `npx eslint` on all 8 touched files → No issues found.
- `npx tsc --noEmit` on touched SOURCE files (rubric-critic.ts, ideas-runner.ts, hooks-runner.ts, blocks.ts) → CLEAN.
- `npm run build` → succeeded (full route table compiled).
- Post-commit deletion check → no deletions.

## Next Phase Readiness

- The quality loop is closed at the code level: Ideas + Hooks now execute the BASE Value Bar at RUNTIME (KCQ-02), carry a flop texture per card (KCQ-04), and reject niche tropes (KCQ-07) — on top of 14-01's resolved-niche SIM band (KCQ-05/06).
- **14-04 handoff:** each surviving card carries `predictedFailureMode` (null on clean pass) — ready for the opt-in drill-reveal. The field is schema-validated and rehydration-safe.
- **Carry-over (validation, not code):** as with 14-01, the LIVE quality of the rubric verdict on real DashScope output is not exercised in this env (no `DASHSCOPE_API_KEY`). The unit tests prove the wiring, gate logic, fail-safe, and bounded-regen; a key-holding follow-up can spot-check real critic verdicts on known-slop vs known-strong items.

## Self-Check: PASSED

- FOUND: `src/lib/engine/flash/rubric-critic.ts`
- FOUND: `src/lib/engine/flash/__tests__/rubric-critic.test.ts`
- FOUND: `src/lib/tools/runners/__tests__/best-of-n.test.ts`
- FOUND: commit `06c2ec19` (Task 1 RED)
- FOUND: commit `91922a02` (Task 1 GREEN)
- FOUND: commit `e3f82e94` (Task 2)

---
*Phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet*
*Completed: 2026-06-20*
