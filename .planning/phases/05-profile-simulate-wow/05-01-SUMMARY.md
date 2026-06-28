---
phase: 05-profile-simulate-wow
plan: 01
subsystem: api
tags: [zod, typed-blocks, block-registry, chain-handoff, react, vitest, honesty-spine]

# Dependency graph
requires:
  - phase: 03-general-population-honesty-layer
    provides: bands-only honesty spine (.strict() schemas), Directional-by-rule tier, General library, BLOCK_REGISTRY + validateBlock
  - phase: 04-input-adapter
    provides: Stimulus adapter + the P4-carried SIM-1 Flash/Max tier (the model badge these blocks surface)
provides:
  - "ProfileReadBlockSchema + ReactionDistributionBlockSchema (.strict() bands-only) in a sibling profile-blocks.ts"
  - "Both block types registered across all three rails: BlockUnionSchema, BLOCK_REGISTRY, BLOCK_COMPONENTS"
  - "ProfileReadBlockRenderer + ReactionDistributionBlockRenderer (functional-but-plain; visual = /gsd-ui-phase)"
  - "buildSimulateRequest seam helper: savedAudienceId → simulate body audienceId (unit-tested)"
  - "profile→simulate chain handoff (PROF-04) + SkillId extended with profile|simulate"
  - "SIMU-03 persistence proof: both blocks round-trip insertMessage→loadMessages"
affects: [05-04 profile-runner, 05-05 simulate-runner, 05-04/05-05 routes, gsd-ui-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Co-located sibling schema module (profile-blocks.ts) to keep blocks.ts under the 500-line project limit"
    - "Register-in-three-places-together discipline (BlockUnionSchema + BLOCK_REGISTRY + BLOCK_COMPONENTS) to close Pitfall 4"
    - "Pure exported seam helper (buildSimulateRequest) so the load-bearing chain hop is unit-testable without a React render"
    - "Whole-layout branch on subjectKind (person single-read vs panel distribution) — the D-02 honesty line"

key-files:
  created:
    - src/lib/tools/profile-blocks.ts
    - src/components/thread/profile-read-block.tsx
    - src/components/thread/reaction-distribution-block.tsx
    - src/components/thread/__tests__/profile-read-block.test.ts
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/lib/tools/chain-handoff.ts
    - src/components/thread/message-blocks.tsx
    - src/lib/tools/__tests__/blocks.test.ts
    - src/lib/tools/__tests__/block-registry.test.ts
    - src/lib/tools/__tests__/chain-handoff.test.ts
    - src/lib/threads/__tests__/messages.test.ts

key-decisions:
  - "Schemas live in a sibling profile-blocks.ts (not appended to blocks.ts) — blocks.ts was at 434 non-empty lines and two ~50-line schemas would breach the 500-line project limit; blocks.ts re-exports the types so existing import sites keep working"
  - "Executed Task 3 (chain-handoff SkillId extension) before committing Task 2 (renderers) because the profile-read renderer's handoffsFor('profile') call requires SkillId to carry 'profile' — keeps each atomic commit self-compiling (Rule 3 sequencing)"
  - "profile-read renderer ships a minimal drafted-message textarea so the Simulate CTA can exercise the real buildSimulateRequest seam (functional-but-plain); final visual is a /gsd-ui-phase pass"

patterns-established:
  - "Sibling schema module under file-size pressure (re-export to preserve import surface)"
  - "Unit-tested pure seam helper for cross-card chain hops (Warning-1 enforcement)"

requirements-completed: [PROF-02, PROF-04, SIMU-02, SIMU-03]

# Metrics
duration: ~12min
completed: 2026-06-28
---

# Phase 5 Plan 01: Block Contracts + Chain Rails Summary

**Two new `.strict()` bands-only typed blocks (`profile-read`, `reaction-distribution`) defined in a sibling `profile-blocks.ts`, registered across all three rendering rails, with the `savedAudienceId→audienceId` chain seam unit-tested via a pure `buildSimulateRequest` helper and the `profile→simulate` forward-chain handoff wired.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-28T17:28:00Z (approx)
- **Completed:** 2026-06-28T17:40:29Z
- **Tasks:** 3
- **Files modified:** 12 (4 created, 8 modified)

## Accomplishments
- Defined both Phase-5 block contracts (`ProfileReadBlockSchema`, `ReactionDistributionBlockSchema`) in a co-located sibling module, keeping `blocks.ts` at 434 non-empty lines (well under the 500 limit).
- Closed Pitfall 4: both block types registered together in `BlockUnionSchema`, `BLOCK_REGISTRY`, and `BLOCK_COMPONENTS` — no silent `__unsupported__` degrade on reload.
- Structurally enforced D-06 bands-only honesty: `.strict()` on both `props` rejects any smuggled `score`/`overall_score`/0-100 key (asserted in tests).
- Test-enforced the load-bearing chain seam (Warning-1): `buildSimulateRequest(props, message)` maps `savedAudienceId → audienceId`, proven by a pure-helper unit test rather than left to the manual UAT.
- Wired PROF-04: `handoffsFor("profile")` returns the single `Simulate a message to them →` CTA (endpoint `/api/tools/simulate`, anchorFrom `card`); `SkillId` extended with `profile|simulate`.
- Proved SIMU-03 persistence: both new blocks round-trip `insertMessage`→`loadMessages` re-validation.
- `reaction-distribution` renderer branches the whole layout on `subjectKind` (person → single read with NO fraction; panel → band+fraction+themes+drill) — the D-02 honesty line.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the two block schemas (sibling module) + register + prove persistence** - `472b3d48` (feat)
2. **Task 3: Extend SkillId + add the profile→simulate chain handoff** - `118e2cba` (feat)
3. **Task 2: Build the two renderers + seam helper + wire BLOCK_COMPONENTS** - `ee7fd657` (feat)

_Note: Task 3 was committed before Task 2 (see Deviations) so each commit compiles independently._

## Files Created/Modified
- `src/lib/tools/profile-blocks.ts` - Both `.strict()` bands-only schemas + `z.infer` types (sibling to blocks.ts).
- `src/lib/tools/blocks.ts` - Imports both schemas, appends them to `BlockUnionSchema`, re-exports the types.
- `src/lib/tools/block-registry.ts` - `profile-read` + `reaction-distribution` entries on `BLOCK_REGISTRY`.
- `src/lib/tools/chain-handoff.ts` - `SkillId` += `profile|simulate`; `profile→simulate` `CHAIN_HANDOFFS` entry.
- `src/components/thread/profile-read-block.tsx` - `ProfileReadBlockRenderer` + exported pure `buildSimulateRequest` seam helper.
- `src/components/thread/reaction-distribution-block.tsx` - `ReactionDistributionBlockRenderer` (person/panel branch).
- `src/components/thread/message-blocks.tsx` - Imports both renderers, adds both to `BLOCK_COMPONENTS`.
- `src/lib/tools/__tests__/blocks.test.ts` - Validates both blocks (person/panel variants) + asserts numeric `score`/`overall_score` rejection.
- `src/lib/tools/__tests__/block-registry.test.ts` - Asserts `validateBlock` accepts both + rejects a smuggled score.
- `src/lib/tools/__tests__/chain-handoff.test.ts` - Asserts `handoffsFor("profile")` returns exactly one simulate CTA with pinned endpoint/anchor.
- `src/lib/threads/__tests__/messages.test.ts` - Round-trip persistence proof for both blocks (SIMU-03).
- `src/components/thread/__tests__/profile-read-block.test.ts` - Seam test: `buildSimulateRequest` maps `savedAudienceId → audienceId`.

## Decisions Made
- **Sibling schema module:** `blocks.ts` was at 434 non-empty lines; appending the two rich ~50-line schemas would breach the 500-line project limit. Schemas live in `profile-blocks.ts`; `blocks.ts` re-exports both schemas + types so existing `@/lib/tools/blocks` import sites keep working.
- **Functional-but-plain renderers:** Per the pattern map + UI-SPEC, final flat-warm visual polish is a separate `/gsd-ui-phase` pass. Renderers ship the validated-props layout with neutral tokens and zero coral literals (reskin-matte guard stays green).
- **Minimal drafted-message textarea** in the profile-read footer so the Simulate CTA exercises the real `buildSimulateRequest` seam end-to-end (the user drafts a reply → simulate how the subject reacts).

## Deviations from Plan

### Sequencing adjustment (not an auto-fix)

**1. [Rule 3 - Blocking] Executed Task 3 before committing Task 2**
- **Found during:** Task 2 (renderer build)
- **Issue:** `ProfileReadBlockRenderer` calls `handoffsFor("profile")`, which requires `SkillId` to carry `"profile"`. `SkillId` is extended in Task 3. Committing Task 2 first would have produced a non-compiling commit (2 `tsc` errors: `"profile"` not assignable to `SkillId`).
- **Fix:** Implemented Task 3's `chain-handoff.ts` edit + test first, committed it (`118e2cba`), then committed Task 2 (`ee7fd657`). No code changed beyond what each task specifies — only the commit order was swapped so each atomic commit compiles independently.
- **Files modified:** none beyond the planned task files
- **Verification:** `tsc --noEmit` returns to the 20-error pre-existing baseline (zero new errors on touched files); full `src/lib/tools src/lib/threads` suites green (203 tests).
- **Committed in:** `118e2cba` (Task 3), `ee7fd657` (Task 2)

---

**Total deviations:** 1 sequencing adjustment (Rule 3 — task commit order swapped to keep each commit self-compiling). No scope change, no extra code.
**Impact on plan:** None on deliverables — all three tasks landed exactly as specified; only the commit order was 1→3→2.

## Issues Encountered
None beyond the sequencing dependency documented above. The full `src/lib/tools` + `src/lib/threads` suites pass (203 tests); `tsc` shows zero new errors on touched files; the reskin-matte guard stays green (6 tests).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The two block contracts are a stable, registered target for the downstream runners: 05-04 (`profile-runner.ts` emits `profile-read`) and 05-05 (`simulate-runner.ts` emits `reaction-distribution`).
- The `/api/tools/simulate` endpoint referenced by the chain handoff + `buildSimulateRequest` does not yet exist — it is built in 05-05. The CTA POST is wired against that pinned contract (`{ audienceId, message }`).
- Final flat-warm visual polish for both renderers is deferred to the `/gsd-ui-phase` pass per UI-SPEC.

## Self-Check: PASSED

All 4 created files exist on disk; all 3 task commits (`472b3d48`, `118e2cba`, `ee7fd657`) present in git history.

---
*Phase: 05-profile-simulate-wow*
*Completed: 2026-06-28*
