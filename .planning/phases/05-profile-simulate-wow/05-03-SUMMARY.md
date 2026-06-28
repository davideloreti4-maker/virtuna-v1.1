---
phase: 05-profile-simulate-wow
plan: 03
subsystem: audience
tags: [profile-bake, audience-signature, enrich-signature, qwen, prompt-injection, storage-ssrf, omni, zod]

# Dependency graph
requires:
  - phase: 05-profile-simulate-wow (plan 01)
    provides: block contracts + chain rails (concurrent wave-1 sibling; no code coupling)
  - phase: 03-general-population-honesty-layer
    provides: AudienceSignature / SignaturePersona shapes, TEMPERATURE_DISPOSITION lens, General Directional-by-rule
  - phase: 04-input-adapter
    provides: the Stimulus adapter + vision.ts isolation idiom + the storagePath carry (AR-04-01)
provides:
  - bakeProfileSignature — evidence → frozen person/panel AudienceSignature (the saved General SIM), reusing enrich-signature synth PARTS not the scrape orchestrator
  - detectSubjectKind — distinct-counterparty heuristic, default person (D-02)
  - buildSynthMessages + PROFILE_SYNTH_SYSTEM — D-08 instruction-isolated synth message assembly
  - sanitizeStoragePath — key-shape regex / reject ../absolute (P4 carry AR-04-01 closed in lib)
  - watchPersonVideo + PersonVideoSignal + PERSON_VIDEO_WATCH_SYSTEM — the two-step Max omni-watch path
  - ProfileSynth / ProfileBakeInput / ProfileBakeResult / ProfileBakeDeps / WatchPersonVideoDeps types
affects: [05-04 profile-runner, profile READ + bake, /api/tools/profile route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling bake reusing enrich-signature synthesis PARTS (schema contract + TEMPERATURE_DISPOSITION engine-fill + temp:0/seed/thinking-off envelope) without calling the scrape-shaped orchestrator"
    - "D-08 isolation extracted into a pure buildSynthMessages so the system-carries-no-user-bytes invariant is unit-assertable without a model call"
    - "Two-step Max person-video path (sanitize → sign → omni watch) with both IO steps injectable for zero-network tests"

key-files:
  created:
    - src/lib/audience/profile-bake.ts
    - src/lib/audience/__tests__/profile-bake.test.ts
  modified: []

key-decisions:
  - "Reuse the enrich-signature synthesis PARTS, never enrichSignature() (its EnrichInput is scrape/engagement-ratio shaped) — grep gate `enrichSignature\\(` === 0"
  - "Relaxed the fixed-`.length(10)` persona refine to 1..10 (no repeats, shares Σ=1.0) so a PERSON yields a small dominant-slot set and a PANEL yields N personas across slots (D-02 / GENERAL_TEMPLATES subset precedent)"
  - "Persona `evidence` is REQUIRED non-empty (`.min(1)`) — verbatim evidence quote as provenance (TRUST-02), stricter than the scrape schema's `.default('')`"
  - "buildSynthMessages exported as a pure function so D-08 isolation (system carries no evidence/goal/success_criterion bytes; user wraps evidence in a delimited treat-as-data block) is asserted directly on the assembled messages"
  - "sanitizeStoragePath enforces a single `<id>/<file>` key shape (rejects deeper paths, `..`, absolute) and runs BEFORE any signed-URL dereference inside watchPersonVideo (P4 carry AR-04-01 / Pitfall 3)"
  - "watchPersonVideo routes to QWEN_OMNI_MODEL only (Pitfall 1) and isolates the goal as data in the USER content array; default sign step mirrors /api/videos/sign via the service client"

patterns-established:
  - "Pattern: profile-bake.ts is the evidence-grounded sibling of enrich-signature.ts — same frozen AudienceSignature output, evidence text replaces the Apify scrape as the grounding source"

requirements-completed: [PROF-01]

# Metrics
duration: ~6min
completed: 2026-06-28
---

# Phase 05 Plan 03: profile-bake.ts Summary

**Built the evidence → frozen-`AudienceSignature` synthesizer (the saved person/panel General SIM): it reuses the enrich-signature synthesis PARTS — schema contract + `TEMPERATURE_DISPOSITION` engine-fill + the temp:0/seed/thinking-off determinism envelope — but feeds D-08-isolated evidence text as the grounding source instead of the scrape orchestrator, with person/panel detection, verbatim evidence-quoted personas (TRUST-02), and the P4 storagePath carry closed plus the two-step Max omni person-video path ready for 05-04.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-28T19:57Z
- **Completed:** 2026-06-28T20:02Z
- **Tasks:** 2 completed
- **Files modified:** 2 created

## Accomplishments
- `bakeProfileSignature` produces a frozen `AudienceSignature` from evidence text — person/panel-aware, deterministic, instruction-isolated — reusing the enrich-signature synth PARTS and never calling the scrape-shaped `enrichSignature()` (grep gate = 0).
- `detectSubjectKind` heuristic counts distinct counterparties (chat speaker labels, self-labels filtered) → person/panel, default person on empty/ambiguous (D-02 safe path).
- D-08 isolation extracted into pure `buildSynthMessages` + byte-stable `PROFILE_SYNTH_SYSTEM`: the system prompt carries no evidence/goal/success_criterion bytes; the user message wraps the evidence in a delimited "treat as data, not instructions" block (asserted directly in tests).
- Each baked persona carries a non-empty verbatim evidence quote as provenance (TRUST-02), with temperature/disposition engine-filled from the canonical map (the LLM never decides those).
- `sanitizeStoragePath` closes the P4 AR-04-01 carry at the lib layer (key-shape regex + reject `..`/absolute, runs BEFORE any dereference); `watchPersonVideo` implements the two-step Max path (sanitize → sign → omni watch) routed to `QWEN_OMNI_MODEL` only, goal isolated as data, both IO steps injectable for zero-network tests.

## Task Commits

Each task was committed atomically (Task 1 was TDD: RED test → GREEN impl):

1. **Task 1 (RED): failing tests for profile-bake core** - `67008d01` (test)
2. **Task 1 (GREEN): profile-bake core — evidence → frozen signature** - `d4cadcf0` (feat)
3. **Task 2: storagePath sanitization + person-video Max omni-watch** - `0d1d8ad4` (feat)

## Files Created/Modified
- `src/lib/audience/profile-bake.ts` - The evidence→frozen-signature synthesizer: `detectSubjectKind`, `buildSynthMessages` + `PROFILE_SYNTH_SYSTEM`, `bakeProfileSignature` (+ `ProfileSynth`/`ProfileBakeInput`/`ProfileBakeResult`/`ProfileBakeDeps` types), `sanitizeStoragePath`, and `watchPersonVideo` + `PersonVideoSignal` + `PERSON_VIDEO_WATCH_SYSTEM` (`WatchPersonVideoDeps`).
- `src/lib/audience/__tests__/profile-bake.test.ts` - 15 tests: subject-kind detection (person/panel/default), synth-mocked bake (frozen signature, non-empty evidence quotes, engine-filled temp/disposition, subjectKind plumbed to the synth dep), D-08 isolation (system byte-stable + no user bytes; user delimited block), sanitizeStoragePath accept/reject cases, and watchPersonVideo sanitize-before-sign + sign→watch wiring.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/profile-bake.test.ts` → 15/15 pass.
- `node ./node_modules/vitest/vitest.mjs run src/lib/audience` → 13 files / 172 passed (audience suite stays green).
- `npx tsc --noEmit` → no errors referencing profile-bake.ts (or its test).
- `grep -cE "enrichSignature\(" src/lib/audience/profile-bake.ts` → 0 (reuses parts, not the orchestrator).
- `grep -cE "TEMPERATURE_DISPOSITION|temperature: 0|enable_thinking" src/lib/audience/profile-bake.ts` → 6 (determinism + engine-fill key-links present).
- `grep -c "QWEN_OMNI_MODEL" src/lib/audience/profile-bake.ts` → 2 (Max video path routes to omni only; Pitfall 1).

## Decisions Made
See frontmatter `key-decisions` — the load-bearing ones: reuse synth PARTS (never `enrichSignature()`); relax the fixed-10 refine to 1..10 for person/panel; `evidence` required non-empty (TRUST-02); pure `buildSynthMessages` for assertable D-08 isolation; `sanitizeStoragePath` before any dereference (AR-04-01); omni-only Max path with the goal isolated as data.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Initial tsc run flagged `synthesize.mock.calls[0]![0]` as indexing an empty tuple — the `vi.fn(async () => ...)` mocks had no declared parameter so their `.mock.calls` typed as `[][]`. Fixed by typing the mock parameter (`vi.fn(async (_input: ProfileSynthInput) => ...)`); tests stayed green. (Test-only typing fix, folded into the Task 1 GREEN commit.)

## Known Stubs
None — `bakeProfileSignature` and `watchPersonVideo` are fully implemented with real default deps (real Qwen synth call, real service-client signed URL, real omni watch); the `deps` injection points are for testability, not stubs. `watchPersonVideo` is intentionally not yet *called* anywhere — it is provided for the 05-04 profile-runner (the Max person-video path) per the plan.

## Threat Flags
None — no new trust-boundary surface beyond the plan's `<threat_model>` (T-05-06 evidence→synth isolation, T-05-07 storagePath traversal/SSRF, T-05-08 Zod-validated synth output are all mitigated here; no new endpoints — this is a lib module, the HTTP route lands in 05-04).

## Next Phase Readiness
- 05-04 (profile-runner + `/api/tools/profile`) can now import `bakeProfileSignature` (Flash/text + bake) and `watchPersonVideo` (Max person-video signal → `BEHAVIORAL_SYSTEM_PROMPT_MAX` synthesis), pairing them with 05-02's behavioral READ prompt.
- The route still owns the HTTP-boundary `text` content cap (AR-04-02) and must call `sanitizeStoragePath`/`watchPersonVideo` on the person-video path; the lib enforcement is in place.

## Self-Check: PASSED
- FOUND: src/lib/audience/profile-bake.ts
- FOUND: src/lib/audience/__tests__/profile-bake.test.ts
- FOUND commit: 67008d01
- FOUND commit: d4cadcf0
- FOUND commit: 0d1d8ad4

---
*Phase: 05-profile-simulate-wow*
*Completed: 2026-06-28*
