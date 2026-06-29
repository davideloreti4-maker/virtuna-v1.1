---
phase: 03-general-population-honesty-layer
plan: 04
subsystem: audience
tags: [typescript, audience, repo, zod, virtual-constants, honesty-layer]

# Dependency graph
requires:
  - phase: 03-general-population-honesty-layer
    plan: 02
    provides: "Audience.mode / success_criterion / custom_context + CustomContext contracts"
  - phase: 03-general-population-honesty-layer
    plan: 03
    provides: "live mode/success_criterion/custom_context columns + mode-gated CHECK on audiences (applied to virtuna-v1.1 DB)"
provides:
  - "audience-repo row seam (AudienceRow + rowToAudience + audienceToRow) carrying mode/success_criterion/custom_context"
  - "WritableAudienceSchema validation for the 3 new fields (capped free-text; mode enum; user_id never writable)"
  - "GENERAL_TEMPLATES — ANALYST_/HIRING virtual constants (ids template-analyst, template-hiring), mode='general', signature null, evidence-free personas"
  - "existing GENERAL_AUDIENCE + PRESET_AUDIENCES stamped mode='socials' (Pitfall 1 collision trap)"
  - "POP-03 data-layer: a mode='general' audience creates/lists/renames through the existing CRUD"
affects: [03-ui, 03-run-badge, 05-simulate, 07-audience-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Virtual-constant templates mirror PRESET_AUDIENCES → never touch DB (zero-setup, regression-gate-free)"
    - "Template personas are CalibratedPersona[] with NO evidence field → ungrounded-by-design (D-05/Pitfall 5)"
    - "WritableAudienceSchema is the allowlist; user_id stays session-derived (mass-assignment guard, T-03-07)"

key-files:
  created:
    - src/lib/audience/__tests__/audience-repo-mode.test.ts
  modified:
    - src/lib/audience/audience-repo.ts
    - src/lib/audience/__tests__/audience-repo.test.ts

key-decisions:
  - "rowToAudience/audienceToRow/WritableAudienceSchema exported (were module-private) so the repo-mode gate can assert the round-trip + caps directly — minimal, additive surface widening"
  - "GENERAL_AUDIENCE + presets are mode='socials' (run the Socials pack); ONLY analyst/hiring templates are mode='general' (Pitfall 1)"
  - "Template personas authored as evidence-free CalibratedPersona panels (shares Σ=1.0) with null signature — honest Directional SIMs with no scrape behind them"

requirements-completed: [POP-01, POP-03, POP-04]

# Metrics
duration: ~10min
completed: 2026-06-27
---

# Phase 3 Plan 04: Audience Repo Seam + General Templates Summary

**Wired `mode` / `success_criterion` / `custom_context` losslessly through the audience repo row seam with capped Zod validation, stamped the existing virtual constants `mode='socials'`, and shipped the two zero-setup General template panels (analyst + hiring) as `mode='general'`, signature-null, evidence-free virtual constants refused on write/delete.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-27T16:23:00Z
- **Completed:** 2026-06-27T16:27:00Z
- **Tasks:** 3 (Task 1 + Task 3 TDD; Task 2 additive)
- **Files modified:** 3 (1 modified source, 1 created test, 1 modified test)

## Accomplishments
- `AudienceRow` + `rowToAudience` + `audienceToRow` now carry `mode` / `success_criterion` / `custom_context` — round-trip is lossless (test (a)).
- `WritableAudienceSchema` validates the 3 new fields: `mode` enum, `success_criterion` `.max(2000).nullable()`, `custom_context` array with `source: z.literal("user")` + `note.max(2000)` (T-03-08 stored-XSS cap). `user_id` is NOT on the writable surface (T-03-07).
- `GENERAL_AUDIENCE` + both `PRESET_AUDIENCES` stamped `mode: "socials"` with an asserting Pitfall-1 comment — they run the Socials pack, not General.
- `GENERAL_TEMPLATES = [ANALYST_AUDIENCE, HIRING_AUDIENCE]` (ids `template-analyst` / `template-hiring`): `mode='general'`, `signature: null`, `custom_context: []`, a representative `success_criterion`, and a runnable evidence-free `CalibratedPersona[]` panel (shares Σ=1.0). Wired into `SENTINEL_IDS`, `VIRTUAL_BY_ID`, and the `listAudiences` prepend.
- POP-03 data-layer proven: a `mode='general'` audience creates (mode reaches the insert payload), lists (prepended templates), and renames (name reaches the update payload) through the existing CRUD — no front-door picker (that is P7).

## Task Commits

1. **Task 3 (RED): failing repo-mode round-trip + GENERAL_TEMPLATES + sentinel + POP-03 save/name gate** - `97c74ea6` (test)
2. **Task 1 (GREEN): map mode/success_criterion/custom_context through the repo + stamp constants mode='socials'** - `b28e493a` (feat)
3. **Task 2: add GENERAL_TEMPLATES (analyst + hiring) virtual constants (D-08)** - `98f65169` (feat)
4. **Task 3 fixup: update listAudiences ordering for the GENERAL_TEMPLATES prepend** - `b6a802c3` (test)

_Plan-level TDD: test (RED) → repo + templates (GREEN). The repo-mode test was authored first and failed (17/18) before implementation; the existing repo test's hardcoded ordering was updated last to land the suite green._

## Files Created/Modified
- `src/lib/audience/audience-repo.ts` — 3 new fields on `AudienceRow`/`rowToAudience`/`audienceToRow`; `WritableAudienceSchema` extended; `mode:'socials'` on GENERAL_AUDIENCE + presets; `GENERAL_TEMPLATES` added; SENTINEL_IDS / VIRTUAL_BY_ID / listAudiences prepend wired; `rowToAudience`/`audienceToRow`/`WritableAudienceSchema` exported for the gate.
- `src/lib/audience/__tests__/audience-repo-mode.test.ts` — NEW: cases (a) round-trip, (b) zod caps, (c) constants socials, (d) GENERAL_TEMPLATES presence/null-signature/evidence-free, (e) sentinel delete-refuse without DB call, (f) POP-03 General create+rename through CRUD.
- `src/lib/audience/__tests__/audience-repo.test.ts` — updated 2 listAudiences ordering cases (4→6 / 3→5 entries) for the template prepend.

## Decisions Made
- Exported `rowToAudience`, `audienceToRow`, `WritableAudienceSchema` (previously module-private) so the round-trip + cap assertions test the seam directly instead of only via public CRUD — minimal additive surface widening, no behavior change.
- Authored 4-persona panels per template (analyst: skeptic / strategist / contrarian / researcher; hiring: hiring-manager / future-peer / bar-raiser / domain-expert), shares Σ=1.0, no `evidence` field — `CalibratedPersona` carries no evidence field at all, so ungrounded-by-design is satisfied by construction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale listAudiences ordering assertions in the existing repo test**
- **Found during:** Task 2 (full audience suite run after adding GENERAL_TEMPLATES)
- **Issue:** `audience-repo.test.ts` hard-coded `listAudiences` length as 4 (with one user row) and 3 (empty DB); the new template prepend makes them 6 and 5, failing 2 cases.
- **Fix:** Updated both cases to expect `[GENERAL, ...PRESETS, ...GENERAL_TEMPLATES, ...userRows]` (template-analyst at index 3, template-hiring at index 4) — the plan's intended new ordering.
- **Files modified:** `src/lib/audience/__tests__/audience-repo.test.ts`
- **Commit:** `b6a802c3`

## Issues Encountered
None blocking. RED failed as expected (17/18 before implementation); GREEN reached 18/18; the 2 pre-existing ordering assertions were the only regression and were the plan's intended behavior change.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/audience-repo-mode.test.ts` → 18 passed.
- `node ./node_modules/vitest/vitest.mjs run src/lib/audience` → **12 files / 157 passed** (was 11 files / 139 pre-Wave-2; +18 new repo-mode tests, signature-determinism gate kept green).
- `npx tsc --noEmit | grep src/lib/audience/audience-repo.ts` → no match (no new errors on the touched file; repo tsc baseline is non-zero by design).
- grep gates: `mode: "socials"` ×3 (GENERAL_AUDIENCE + both presets); `GENERAL_TEMPLATES` exported with ids `template-analyst` / `template-hiring`; schema has `mode: z.enum`, `success_criterion: z.string().max(2000)`, `source: z.literal("user")`; no `evidence:` field on any template persona (the 3 `evidence` text hits are a doc comment, prose in a repaint string, and the `persona_evidence_link` zod field name).
- ENGINE_VERSION untouched (no bump — not called for).

## Threat Model
- **T-03-07** (mass-assignment of `user_id`/`mode`) — MITIGATED: `audienceToRow` keeps `user_id` session-derived (never from input); `mode` validated against the zod enum; test (f) asserts the insert payload's `user_id` is the session id and the update payload omits `user_id`.
- **T-03-08** (stored XSS via free-text) — MITIGATED: `success_criterion` + `custom_context[].note` capped at `.max(2000)`; test (b) asserts a 2001-char note/criterion is rejected.
- **T-03-09** (writing to a virtual constant) — MITIGATED: SENTINEL_IDS now covers `template-analyst`/`template-hiring`; `deleteAudience` throws before any DB call (test (e) asserts `sb.from` is never called).
- **T-03-SC** (package installs) — N/A: zero package installs this plan.
- No new trust boundaries (repo seam already existed; this widens its validated field set).

## Known Stubs
None. The templates are intentionally signature-null + evidence-free (ungrounded-by-design per D-05/Pitfall 5) — this is the honest Directional contract, not a stub. P5 (Profile) wires net-new General-from-scratch; P7 adds the front-door mode picker.

## Next Phase Readiness
- The repo seam now reads/writes the live 03-03 columns — UI plans and the run-badge can persist/round-trip `mode` / `success_criterion` / `custom_context` without further repo work.
- GENERAL_TEMPLATES are runnable-ready zero-setup constants; the P5/P7 surfaces can list + clone them.

## Self-Check: PASSED

- `src/lib/audience/audience-repo.ts`, `src/lib/audience/__tests__/audience-repo-mode.test.ts`, `src/lib/audience/__tests__/audience-repo.test.ts`, and this SUMMARY all exist on disk.
- All 4 task commits (97c74ea6, b28e493a, 98f65169, b6a802c3) present in git history.

---
*Phase: 03-general-population-honesty-layer*
*Completed: 2026-06-27*
