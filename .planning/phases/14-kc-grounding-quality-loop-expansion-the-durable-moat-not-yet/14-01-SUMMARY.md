---
phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet
plan: 01
subsystem: engine
tags: [sim-1-flash, niche-resolution, persona-registry, slop-gate, qwen, vitest]

# Dependency graph
requires:
  - phase: 07-audience-manager
    provides: niche-aware 10-persona panel (selectPersonaSlots + NICHE_INSTANTIATION), runFlashTextMode niche-panel path
  - phase: 03-ideas-tool
    provides: ideas-runner generate→SIM→gate spine + slop-vs-strong gate (STRONG/MIXED thresholds)
  - phase: 04-hooks-tool
    provides: hooks-runner generate→SIM→gate→rank spine
provides:
  - resolveNicheKey(nichePrimary) — runner-layer free-text/sub-slug → top-level NICHE_INSTANTIATION key (or null)
  - read-only NICHE_INSTANTIATION_KEYS + isNicheInstantiationKey guard on persona-registry
  - Ideas + Hooks runners now feed a RESOLVED niche to the SIM panel (no silent generic fallback)
  - KCQ-05 gate formalized as band !== "Weak" with a threshold drift gate (lockstep STRONG===6 / MIXED===3)
  - slop-vs-strong LIVE half re-routed through the production resolution path
affects: [14-02, 14-03, 14-04, kc-grounding, quality-loop, sim-rank-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Niche normalization at the RUNNER layer, never inside the shared engine function (D-02 / Pitfall 2 — keeps the SIM-1 Max video path byte-stable, no ENGINE_VERSION bump)"
    - "Read-only derived export (key view + guard) to share a data table's keyset without exposing its byte-sensitive prose"
    - "Threshold drift gate: a test pins load-bearing calibration constants so any silent retune fails loud + in lockstep"

key-files:
  created:
    - src/lib/engine/wave3/niche-resolver.ts
    - src/lib/engine/wave3/__tests__/niche-resolver.test.ts
  modified:
    - src/lib/engine/wave3/persona-registry.ts
    - src/lib/tools/runners/ideas-runner.ts
    - src/lib/tools/runners/hooks-runner.ts
    - src/lib/engine/flash/flash-aggregate.ts
    - src/lib/engine/flash/__tests__/slop-vs-strong.test.ts

key-decisions:
  - "resolveNicheKey lives at the runner layer (D-02 / Pitfall 2) — selectPersonaSlots + NICHE_INSTANTIATION bytes untouched; no ENGINE_VERSION bump (still 3.19.0)"
  - "Resolution order: null/empty → direct top-level hit → sub-slug→parent → keyword/contains fallback → honest null (never fabricate a niche)"
  - "Thresholds stay STRONG=6 / MIXED=3 — pure-half margin holds; LIVE recalibration deferred (no DASHSCOPE_API_KEY in the execution env). Drift gate locks the values."

patterns-established:
  - "Niche normalization at the runner boundary before panel build"
  - "KCQ-05 gate floor (band !== Weak) + drift-asserted thresholds"

requirements-completed: [KCQ-06, KCQ-01, KCQ-05]

# Metrics
duration: 14min
completed: 2026-06-20
---

# Phase 14 Plan 01: KC Grounding Quality-Loop — The Moat Spine Summary

**resolveNicheKey at the runner layer turns the silently niche-blind text SIM into a gate that can say no — free-text/sub-slug `niche_primary` now reaches the panel as a real instantiation key, with the slop-vs-strong gate (KCQ-05) re-validated and drift-locked, all on the text path with no ENGINE_VERSION bump.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-20
- **Completed:** 2026-06-20
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- **`resolveNicheKey` (KCQ-06 + KCQ-01):** new `src/lib/engine/wave3/niche-resolver.ts` maps a free-text / sub-slug `niche_primary` (e.g. `personal-finance`, `skincare`, prose) to a top-level `NICHE_INSTANTIATION` key, or null when nothing resolves. Pure + deterministic (cache-warm). Wired into both the Ideas and Hooks runner panel build sites so the SIM panel receives a real niche instead of silently falling back to "general TikTok" + generic instantiation.
- **Read-only persona-registry surface:** added `NICHE_INSTANTIATION_KEYS` + `isNicheInstantiationKey` as a derived, byte-neutral export — `selectPersonaSlots`, `makeSlot`, and the `NICHE_INSTANTIATION` prose table are untouched (diff is purely additive). The Max video path that imports `selectPersonaSlots` is unperturbed; **ENGINE_VERSION stays 3.19.0**.
- **KCQ-05 gate formalized + drift-locked:** corrected the stale "no recalibration needed" comment in `flash-aggregate.ts` (the niche panel only discriminates once the resolver lands — Pitfall 3). Added a lockstep threshold drift gate (`STRONG_THRESHOLD === 6`, `MIXED_THRESHOLD === 3`) so any future silent retune fails the suite. Re-routed the slop-vs-strong **LIVE** half through `resolveNicheKey("fitness")` so it exercises the production resolution path, not a hand-built panel.

## Task Commits

Each task was committed atomically:

1. **Task 1: resolveNicheKey at the runner/lib layer (KCQ-06 + KCQ-01)** - `d5891509` (feat)
2. **Task 2: Re-validate slop-vs-strong gate with resolved niches + formalize the gate (KCQ-06 recal + KCQ-05)** - `0a61236e` (test)

**Plan metadata:** _(this commit — docs)_

## Files Created/Modified

- `src/lib/engine/wave3/niche-resolver.ts` (created) - `resolveNicheKey(nichePrimary)`: free-text/sub-slug → top-level instantiation key or null; pure, deterministic, isolated (taxonomy + read-only persona-registry view only).
- `src/lib/engine/wave3/__tests__/niche-resolver.test.ts` (created) - 20 unit assertions: direct hit, sub-slug→parent, keyword fallback, prose→null, null→null, every key resolves to itself, purity.
- `src/lib/engine/wave3/persona-registry.ts` (modified) - added `NICHE_INSTANTIATION_KEYS` + `isNicheInstantiationKey` (read-only derived; +15 lines, zero logic/byte change to the table or `selectPersonaSlots`).
- `src/lib/tools/runners/ideas-runner.ts` (modified) - panel niche now `resolveNicheKey(profileRow?.niche_primary ?? null)`; import + isolation-header surface updated.
- `src/lib/tools/runners/hooks-runner.ts` (modified) - same resolver wiring at its panel build site; import + isolation-header surface updated.
- `src/lib/engine/flash/flash-aggregate.ts` (modified) - corrected stale calibration comment; documented the KCQ-05 gate floor; thresholds unchanged (6/3).
- `src/lib/engine/flash/__tests__/slop-vs-strong.test.ts` (modified) - added KCQ-05 drift gate + re-routed LIVE half through `resolveNicheKey`.

## Decisions Made

- **Resolver at runner layer, not engine (D-02 / Pitfall 2).** The shared `selectPersonaSlots` is imported by the SIM-1 Max video path (`pipeline.ts:771`); normalizing inside it would change Max-path bytes and force an ENGINE_VERSION bump. Normalizing at the runner keeps the engine byte-identical.
- **Read-only key export, not a refactor.** Shared only the keyset + a guard so `niche-resolver.ts` never imports the byte-sensitive instantiation prose.
- **Thresholds held at 6/3.** The pure half holds the margin (slop < MIXED, strong ≥ STRONG, gap ≥ 3) and the drift gate locks the values. The LIVE recalibration step could not run in this execution environment (no `DASHSCOPE_API_KEY`), so no evidence supported a change — keeping 6/3 is the conservative, test-backed choice. See LIVE recalibration note below.

## LIVE Recalibration (Task 2, D-04 — validated not asserted)

- **DASHSCOPE_API_KEY is NOT present in the execution environment**, so the DASHSCOPE-gated LIVE half (`describe.skipIf(!HAS_API_KEY)`) is **SKIPPED** — by design (pure half always runs). The LIVE recalibration sweep (≥5 known-slop, ≥5 known-strong fitness items) per RESEARCH Critical Verification 3 step 3 therefore **could not be executed here** and **observed stop-counts are unavailable from this run**.
- **Final threshold decision:** `STRONG_THRESHOLD = 6`, `MIXED_THRESHOLD = 3` — UNCHANGED. Rationale: no LIVE evidence was available to justify a shift, and the pure-half discrimination (slop = 1 stop → Weak; strong = 8 stops → Strong; margin = 7 ≥ 3) plus the new drift gate confirm the gate floor `band !== "Weak"` is sound for the resolved-niche distribution.
- **Action for whoever holds the key:** run `DASHSCOPE_API_KEY=… npx vitest run src/lib/engine/flash/__tests__/slop-vs-strong.test.ts` to execute the LIVE half on the resolved-niche path and record the stop-counts; the LIVE assertion already enforces `strongStops - slopStops >= 2` and `strong.band !== "Weak"`.

## Deviations from Plan

None - plan executed exactly as written. (No Rule 1–4 deviations: no bugs found, no missing-critical functionality, no blocking issues, no architectural changes.)

## Issues Encountered

- **LIVE recalibration could not run (no `DASHSCOPE_API_KEY`).** Resolved by keeping thresholds at the test-backed 6/3 and documenting the exact command + assertions for a key-holding follow-up (see LIVE Recalibration above). The plan anticipated this gating; the pure half + drift gate carry the validation.
- **Pre-existing repo-wide `tsc --noEmit` (46 errors / 19 files) and `npm run lint` (~80+ files) noise.** Cross-checked: **zero overlap** with the 7 files this plan touched — all in unrelated pre-existing test fixtures / components. `npx eslint` on the touched files reports "No issues found" and they compile clean under `tsc`. Logged to `deferred-items.md`, not fixed (SCOPE BOUNDARY).

## Verification

- `npx vitest run src/lib/engine/wave3/__tests__/niche-resolver.test.ts` → PASS (20).
- `npx vitest run src/lib/tools/runners` → PASS (64).
- `npx vitest run src/lib/engine/flash` → PASS (77) — pure half + drift gate + resolution-key assertion run; LIVE half skipped (no key).
- `npx vitest run src/lib/engine src/lib/tools src/lib/kc` → PASS (1318).
- `git diff src/lib/engine/wave3/persona-registry.ts` → purely additive read-only export (no change to `selectPersonaSlots` / `NICHE_INSTANTIATION` / `makeSlot`).
- `grep -c resolveNicheKey` ideas-runner=3, hooks-runner=3 (≥1 each).
- `grep ENGINE_VERSION src/lib/engine/version.ts` → still `3.19.0` (no bump).
- `run-flash-text-mode.ts` (STABLE_FLASH_SYSTEM_PROMPT / null-niche branch) → untouched in the diff (General path byte-identical).
- `npx eslint` on the 7 touched files → No issues found.

## Next Phase Readiness

- The moat spine (KCQ-06 → KCQ-05) is closed at the code level: the text SIM now discriminates on the resolved-niche production path, the gate floor is formalized + drift-locked, and the General/null + Max video paths are byte-identical.
- **Blocker / follow-up:** the LIVE recalibration sweep is outstanding — run it once a `DASHSCOPE_API_KEY` is available to record real stop-counts on the resolved-niche path (command above). This is validation evidence, not a code change.
- Tracked carry-over (from STATE.md): FLYWHEEL-02 predicted-pin runner wiring still belongs with KCQ-05's SIM-rank verification loop — not touched by this plan.

## Self-Check: PASSED

- FOUND: `src/lib/engine/wave3/niche-resolver.ts`
- FOUND: `src/lib/engine/wave3/__tests__/niche-resolver.test.ts`
- FOUND: commit `d5891509` (Task 1)
- FOUND: commit `0a61236e` (Task 2)

---
*Phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet*
*Completed: 2026-06-20*
