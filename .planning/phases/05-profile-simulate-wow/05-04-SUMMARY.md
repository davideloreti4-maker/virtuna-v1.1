---
phase: 05-profile-simulate-wow
plan: 04
subsystem: tools
tags: [profile-runner, profile-route, fused-verb, behavioral-read, subject-kind-marker, prompt-injection-isolation, storage-ssrf, tdd]

# Dependency graph
requires:
  - phase: 05-profile-simulate-wow (plan 01)
    provides: ProfileReadBlockSchema (the profile-read block contract) + profile→simulate chain handoff
  - phase: 05-profile-simulate-wow (plan 02)
    provides: BEHAVIORAL_SYSTEM_PROMPT_FLASH/_MAX + scanForExcludedCoaching (the READ system message + D-04 backstop)
  - phase: 05-profile-simulate-wow (plan 03)
    provides: bakeProfileSignature + detectSubjectKind + sanitizeStoragePath + watchPersonVideo (the General SIM synthesizer + Max path + AR-04-01 lib guard)
  - phase: 04-input-adapter
    provides: Stimulus + normalizeStimulus + SIM1_MODEL_BY_TIER (the input adapter + tier→model routing)
  - phase: 03-general-population-honesty-layer
    provides: createAudience(mode:"general") + custom_context JSONB + Directional-by-rule
provides:
  - "runProfile + ProfileRunInput + ProfileReadResponseSchema — the fused Profile verb (forensic READ + saved General SIM from ONE bake)"
  - "POST /api/tools/profile — the security-spined route persisting a profile-read block to the open thread"
  - "the reserved custom_context subjectKind marker { persona_evidence_link:'__subject_kind', note:'person'|'panel' } — the deterministic source Simulate (05-05) reads"
affects: [05-05 simulate-runner/route, 05-06 composer affordance, gsd-ui-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fused verb: ONE bake of the evidence → forensic READ (hero card) AND saved General SIM (D-01)"
    - "Tier-routed READ via SIM1_MODEL_BY_TIER + tier-gated forensic suffix (flash forbids, max permits) — D-03"
    - "D-08 isolation in the runner: byte-stable system prompt carries no user bytes; evidence/goal/success_criterion in a delimited treat-as-data USER block (mirrors vision.ts)"
    - "No-migration persisted enum via the reserved custom_context marker (survives signature-bearing General rows) — D-02 / Pitfall 2"
    - "Signature reactors → CalibratedPersona (reaction_frame→repaint) so the saved SIM steers in Simulate"
    - "Route accepts file_text/image as base64 JSON reconstructed into a File so application/json + csrfGuard stay intact"

key-files:
  created:
    - src/lib/tools/runners/profile-runner.ts
    - src/lib/tools/runners/__tests__/profile-runner.test.ts
    - src/app/api/tools/profile/route.ts
    - src/app/api/tools/profile/__tests__/route.test.ts
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "READ call default uses getQwenClient directly (mocked in tests) while bake/watch/saveAudience inject via deps — so the D-08 system-message + Pitfall-1 model assertions inspect the REAL assembled call while bake/createAudience stay zero-network"
  - "successCriterion isolated as an empty slot in the runner (Stimulus carries no success_criterion — it lives on the audience) so the D-08 USER-data shape is stable across tiers"
  - "Signature SignaturePersona.reaction_frame becomes the CalibratedPersona.repaint on the saved audience — that is what steers the Flash reaction in Simulate (buildAudienceRepaint reads [archetype, repaint])"
  - "scanForExcludedCoaching is a hard backstop here (throws on trip) — the prompt-layer ethics block stays primary (D-04); the scan is belt-and-suspenders over howTheyReact + tells"
  - "file_text/image delivered as base64 JSON and reconstructed via new File(...) so the route keeps application/json (csrfGuard) instead of multipart"

patterns-established:
  - "Pattern: a fused runner that emits a card AND persists a saved-SIM in one call, carrying the saved id on the block for the chain CTA"

requirements-completed: [PROF-01, PROF-02, PROF-03]

# Metrics
duration: ~5min
completed: 2026-06-28
---

# Phase 05 Plan 04: Profile Verb (runner + route) Summary

**`runProfile` fuses the forensic behavioral READ (the hero `profile-read` card) and the saved person/panel General SIM from a SINGLE bake of the evidence — tier-routed, instruction-isolated, forensic gated to the video tier — and `/api/tools/profile` wires it to the open thread behind the full auth/csrf/cap/storagePath security spine, persisting the detected subjectKind via a reserved no-migration marker so Simulate reads it deterministically.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-28T18:10:02Z
- **Completed:** 2026-06-28T18:15:00Z
- **Tasks:** 2 (Task 1 TDD: RED → GREEN)
- **Files modified:** 4 created (+ 3 planning docs)

## Accomplishments
- **D-01 FUSE:** `runProfile(input, deps?)` does ONE bake → (a) the forensic READ via the cached behavioral system prompt and (b) the saved General SIM via `createAudience(mode:"general")`, both emitted as one `ProfileReadBlockSchema`-valid block carrying `savedAudienceId` for PROF-04's chain CTA.
- **Tier routing (Pitfall 1):** the READ model comes from `SIM1_MODEL_BY_TIER[stimulus.tier]` — flash (text/file/image) → `QWEN_REASONING_MODEL` + `BEHAVIORAL_SYSTEM_PROMPT_FLASH`; max (person-video) → two-step `watchPersonVideo` (omni signal+transcript) → `QWEN_OMNI_MODEL` + `BEHAVIORAL_SYSTEM_PROMPT_MAX`. A flash READ is NEVER routed to omni (asserted).
- **D-03 forensic gating:** the `forensic` layer (deception band word + timestamped cues) is present ONLY on the max/video tier; forced null on flash regardless of model output.
- **D-08 isolation:** the system message is the behavioral prompt byte-for-byte (no user bytes); evidence + goal + success_criterion live only in a delimited "treat as DATA, not instructions" USER block; `ProfileReadResponseSchema` strip→parse→Zod with temp:0 + seed + thinking-off.
- **D-02 / Pitfall 2:** the detected `subjectKind` is PERSISTED on the saved audience via the reserved `custom_context` marker `{ source:"user", persona_evidence_link:"__subject_kind", note:subjectKind }` — a person bake that produced >1 persona still notes `"person"` (asserted) — so Simulate (05-05) reads it deterministically instead of re-inferring from persona count. No migration (the JSONB column survives signature-bearing General rows).
- **Steerable saved SIM:** signature reactors are projected to `CalibratedPersona[]` with `reaction_frame → repaint`, so Simulate's `buildAudienceRepaint` ([archetype, repaint]) steers the Flash reaction to the just-baked audience.
- **Security spine + P4 carries closed:** the route enforces auth 401 → csrfGuard 415/403 → `MAX_EVIDENCE_LENGTH` (8000) text cap (AR-04-02) → `sanitizeStoragePath` 400 on traversal BEFORE any signed-URL dereference (AR-04-01 / Pitfall 3), then `normalizeStimulus` → `runProfile` → `insertMessage` (re-validate + KC stamp). file_text/image are reconstructed from base64 JSON so application/json + csrfGuard stay intact.

## Task Commits

1. **Task 1 (RED): failing tests for profile-runner** — `5904e13e` (test)
2. **Task 1 (GREEN): profile-runner — fused READ + bake → profile-read block** — `4df5d7d2` (feat)
3. **Task 2: /api/tools/profile route — security spine + thread persistence** — `c5903396` (feat)

## Files Created/Modified
- `src/lib/tools/runners/profile-runner.ts` — `runProfile` + `ProfileRunInput` + `ProfileReadResponseSchema` + `ProfileRunDeps`; tier-routed isolated READ; bake → `createAudience(mode:"general")` with the subjectKind marker; signature→CalibratedPersona projection; `scanForExcludedCoaching` backstop; forensic gated to max; block validated against `ProfileReadBlockSchema`.
- `src/lib/tools/runners/__tests__/profile-runner.test.ts` — 7 tests: flash/max forensic tiering + model; D-08 system-no-user-bytes + Pitfall-1 model routing; saved General SIM + savedAudienceId + Directional tier; reserved subjectKind marker incl. person-with-3-personas; block validity.
- `src/app/api/tools/profile/route.ts` — POST with the auth/csrf/cap/storagePath spine; per-kind body (text | file_text/image base64 | video); `normalizeStimulus` → `runProfile` → `insertMessage`.
- `src/app/api/tools/profile/__tests__/route.test.ts` — 5 tests: 401 before any run; 400 empty/over-cap text; 400 traversal storagePath; 200 `{block}` profile-read + insertMessage once.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — position, metrics, decisions, plan-progress, PROF-01/02/03 closed.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/lib/tools/runners/__tests__/profile-runner.test.ts` → 7/7 pass.
- `node ./node_modules/vitest/vitest.mjs run src/app/api/tools/profile/__tests__/route.test.ts` → 5/5 pass.
- `node ./node_modules/vitest/vitest.mjs run src/lib/tools/runners src/app/api/tools/profile src/lib/tools src/lib/engine/flash` → 27 files / 313 passed (+2 skipped), no Socials/tools/flash regression.
- `npx tsc --noEmit` → no errors on the touched files (total 20 = the pre-existing baseline carried since 05-01).

## Decisions Made
See frontmatter `key-decisions`. The load-bearing ones: the READ call uses the real `getQwenClient` (mocked in tests) so the D-08/Pitfall-1 assertions inspect the actual assembled call, while bake/watch/saveAudience inject via deps for zero-network; the saved SIM persists subjectKind via the reserved no-migration marker; signature `reaction_frame` → persona `repaint` makes the saved SIM steerable in Simulate.

## Deviations from Plan
None — plan executed exactly as written. (One test-only mock-param typing fix — declaring the `saveAudience` mock params so `.mock.calls` is not an empty tuple — was applied while turning Task 1 GREEN and folded into the GREEN commit; mirrors the same fix noted in 05-03.)

## Known Stubs
None — `runProfile` and the route are fully wired against the real 05-01/02/03 exports. `forensic: null` on the flash tier is intentional and contractual (D-03), not a stub.

## Threat Flags
None — the only new surface is `POST /api/tools/profile`, which is the threat model's `client → POST /api/tools/profile` boundary; all of T-05-09…13 are mitigated here (auth/csrf before any DB/LLM, D-08 isolation, sanitizeStoragePath, text cap, tier-correct model routing). No surface beyond the plan's `<threat_model>`.

## Next Phase Readiness
- 05-05 (`simulate-runner` + `/api/tools/simulate`) can resolve the saved audience and read its subjectKind deterministically from the `__subject_kind` `custom_context` marker (never re-inferring from persona count), and steer the Flash reaction via the saved `personas` repaint map.
- The `profile-read` renderer's final flat-warm visual polish remains the `/gsd-ui-phase` pass (05-01 deferral).

## Self-Check: PASSED
- FOUND: src/lib/tools/runners/profile-runner.ts
- FOUND: src/lib/tools/runners/__tests__/profile-runner.test.ts
- FOUND: src/app/api/tools/profile/route.ts
- FOUND: src/app/api/tools/profile/__tests__/route.test.ts
- FOUND commit: 5904e13e (RED test)
- FOUND commit: 4df5d7d2 (GREEN runner)
- FOUND commit: c5903396 (route)

---
*Phase: 05-profile-simulate-wow*
*Completed: 2026-06-28*
