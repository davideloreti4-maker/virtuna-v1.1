---
phase: 05-profile-simulate-wow
plan: 02
subsystem: engine
tags: [behavioral-core, system-prompt, qwen-cache, ethics-gate, profile-read, forensic-tiering]

# Dependency graph
requires:
  - phase: 05-profile-simulate-wow (plan 01)
    provides: block contracts + chain rails (concurrent wave-1 sibling; no code coupling)
provides:
  - BEHAVIORAL_SYSTEM_PROMPT_FLASH / _MAX — byte-stable tier-gated behavioral system prompts the 05-04 profile-runner imports
  - BEHAVIORAL_CORE — the harvested cognition brain (constant)
  - BEHAVIORAL_ETHICS_BLOCK — D-04 light prompt-layer guardrail
  - FORENSIC_FLASH_DIRECTIVE / FORENSIC_MAX_DIRECTIVE — D-03 tier-gating
  - scanForExcludedCoaching + EXCLUDE_REGISTRY — pure no-cost coaching backstop for the runner
affects: [05-04 profile-runner, 05-03/05-05 simulate, profile READ call]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Byte-stable cached behavioral system prompt mirroring apollo-core.ts (zero per-request interpolation → Qwen input-cache fires)"
    - "Shared CORE+ethics prefix, tier-only suffix divergence (Flash/Max) so the cache fires on the common prefix"
    - "Read-only corpus harvest from a parked branch via git show (branch never merged; no engine/streaming code ported)"

key-files:
  created:
    - src/lib/engine/behavioral-core.ts
    - src/lib/engine/__tests__/behavioral-core.test.ts
  modified: []

key-decisions:
  - "D-05: harvested BEHAVIORAL_CORE corpus + ethics-gate data read-only via `git show`; feat/chat-ethics-gate never merged and no engine/streaming logic reused"
  - "D-04: ethics is a LIGHT prompt-layer guardrail (read-for-YOUR-decision, refuse manipulate/coerce/stalk/dox, directional caveat) — no heavy classifier; scanForExcludedCoaching is a discretionary belt-and-suspenders backstop only"
  - "D-03: forensic depth is tier-gated in the prompt — FLASH (text) forbids micro-expression/deception-timestamp reads; MAX (video) permits a Low/Med/High deception band WORD never a number"
  - "Dropped the branch-only STATUS 'NOT WIRED' banner (corpus line 1) when embedding — it is stale now that the corpus ships; documented in the regeneration JSDoc"
  - "Kept scanForExcludedCoaching returning the richer GateResult ({tripped,item,sentence}) rather than a bare boolean — faithful port + gives the runner the matched item; tests assert .tripped"

patterns-established:
  - "Pattern: behavioral-core.ts is the cognition sibling of apollo-core.ts's craft core — same three-export byte-stable assembly shape (CORE → block → SYSTEM_PROMPT)"

requirements-completed: [PROF-02]

# Metrics
duration: ~10min
completed: 2026-06-28
---

# Phase 05 Plan 02: Behavioral Reasoning Core Summary

**Built the byte-stable, tier-gated behavioral system prompt (the cognition brain that grounds the Profile READ) by harvesting the parked behavioral corpus read-only and embedding it the way apollo-core.ts embeds the craft knowledge core — with a D-04 light ethics guardrail and D-03 forensic tier-gating baked in.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-28T19:47Z
- **Completed:** 2026-06-28T19:51Z
- **Tasks:** 2 completed
- **Files modified:** 2 created

## Accomplishments
- `BEHAVIORAL_CORE` + the two assembled `BEHAVIORAL_SYSTEM_PROMPT_FLASH/_MAX` prompts exist as byte-stable constants (zero `Date.now`/`Math.random`/`new Date` interpolation — grep gate = 0), so Qwen's automatic input-cache fires across Profiles; Flash and Max share the CORE+ethics prefix and differ only in the tier-gated forensic suffix.
- D-04 light ethics guardrail (`BEHAVIORAL_ETHICS_BLOCK`) and D-03 tier-gating (`FORENSIC_FLASH_DIRECTIVE`/`FORENSIC_MAX_DIRECTIVE`) embedded at the prompt layer — text tier forbids micro-expression/deception reads; video tier permits a Low/Med/High band word, never a number.
- Discretionary pure backstop `scanForExcludedCoaching` + `EXCLUDE_REGISTRY` (14 never-coach tactics) ported as data + pure regex only — no stream-buffer tripwire, no model call (grep gate = 0).
- Corpus + ethics-gate harvested read-only via `git show feat/chat-ethics-gate:...`; the branch was never merged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Harvest the behavioral corpus + assemble the byte-stable system prompts** - `985825a2` (feat)
2. **Task 2: Add the discretionary non-model coaching backstop (EXCLUDE_REGISTRY + scanForExcludedCoaching)** - `7dc8d0e4` (feat)

## Files Created/Modified
- `src/lib/engine/behavioral-core.ts` - The behavioral cognition core: `BEHAVIORAL_CORE` (harvested corpus, embedded verbatim minus the stale branch STATUS banner), `BEHAVIORAL_ETHICS_BLOCK`, `FORENSIC_FLASH/_MAX_DIRECTIVE`, `BEHAVIORAL_SYSTEM_PROMPT_FLASH/_MAX`, and the pure `EXCLUDE_REGISTRY` + `scanForExcludedCoaching` backstop.
- `src/lib/engine/__tests__/behavioral-core.test.ts` - 13 tests: prompt presence, shared-prefix byte-stability, never-coach + directional-caveat lines on both tiers, FLASH/MAX directive gating, corpus markers, source byte-stability scan, and the backstop trip/pass + audit-non-trip cases.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/behavioral-core.test.ts` → 13/13 pass.
- `grep -cE "Date\.now\(|Math\.random\(|new Date\(" src/lib/engine/behavioral-core.ts` → 0 (byte-stable, cache-safe).
- `grep -cE "gateStreamBuffer|gateAsyncDeltas|chat\.completions" src/lib/engine/behavioral-core.ts` → 0 (no branch engine/streaming code ported).
- `npx tsc --noEmit` → no errors referencing behavioral-core.ts.
- No `git merge` of `feat/chat-ethics-gate` occurred — harvest was read-only via `git show` (HEAD advanced only because wave-1 sibling 05-01 landed concurrently; no merge commit from the parked branch).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Byte-stability + no-streaming grep gates tripped on the file's own JSDoc**
- **Found during:** Task 1 (then again Task 2)
- **Issue:** The acceptance grep gates scan the whole file source, including comments. The initial JSDoc literally contained `Date.now()`/`Math.random()`/`new Date()` (Task 1) and `gateStreamBuffer`/`gateAsyncDeltas` (Task 2), tripping the gates to 1 instead of 0.
- **Fix:** Reworded the comments to describe the prohibitions without the literal tokens (e.g. "no Date-now / Math-random / new-Date calls"; "the realtime stream-buffer tripwire ... NOT ported").
- **Files modified:** src/lib/engine/behavioral-core.ts
- **Commits:** 985825a2 (Task 1), 7dc8d0e4 (Task 2)

## Known Stubs
None — both exports are fully implemented; `scanForExcludedCoaching` is a real working regex backstop, not a placeholder. (`scanForExcludedCoaching` is intentionally not yet *called* anywhere — it is provided for the 05-04 profile-runner to invoke, per the plan.)

## Self-Check: PASSED
- FOUND: src/lib/engine/behavioral-core.ts
- FOUND: src/lib/engine/__tests__/behavioral-core.test.ts
- FOUND commit: 985825a2
- FOUND commit: 7dc8d0e4
