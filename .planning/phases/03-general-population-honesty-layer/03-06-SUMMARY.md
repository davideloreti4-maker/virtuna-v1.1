---
phase: 03-general-population-honesty-layer
plan: 06
subsystem: audience
tags: [typescript, react, zod, audience, honesty-layer, route-validation, custom-context, flat-warm]

# Dependency graph
requires:
  - phase: 03-general-population-honesty-layer
    plan: 02
    provides: "Audience.mode / success_criterion / custom_context + CustomContext contracts"
  - phase: 03-general-population-honesty-layer
    plan: 04
    provides: "WritableAudienceSchema caps (.max(2000) free-text; mode enum; user_id never writable) + repo seam that persists the 3 fields"
provides:
  - "CreateAudienceSchema + PatchAudienceSchema accept + sanitize + cap mode / success_criterion / custom_context at the API boundary"
  - "audience-form success-criterion Textarea (POP-05) + user-added-grounding (custom_context) add/edit/remove affordance (TRUST-02/D-07)"
  - "form POST/PATCH payload carries success_criterion + custom_context (empty notes filtered)"
  - "route test coverage: sanitize round-trip + over-cap (.max(50) array / .max(2000) note) rejection"
affects: [05-simulate, 07-audience-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route Zod schemas are a separate allowlist from the repo WritableAudienceSchema — both must carry a field or the form payload is silently dropped at the API boundary"
    - "Route caps are stricter than the repo schema: .max(50) array cap + .max(120) persona_evidence_link cap (T-03-14 DoS bound) added at the untrusted browser→route boundary"
    - "User-added grounding rendered as plain React children (auto-escaped), tagged 'user-added', visually distinct from scraped evidence — strengthens provenance, never fakes it"

key-files:
  created: []
  modified:
    - src/app/api/audiences/route.ts
    - src/app/api/audiences/[id]/route.ts
    - src/app/api/audiences/__tests__/route.test.ts
    - src/components/audience/audience-form.tsx

key-decisions:
  - "Route schemas mirror the repo WritableAudienceSchema field set but apply each file's existing sanitizeText transform (control-char strip + trim) AND a stricter .max(50) array cap + .max(120) persona_evidence_link cap — the route is the untrusted boundary, so DoS/XSS caps live here (T-03-12/T-03-14)"
  - "No mode toggle in the form (CONTEXT — front-door mode-creation picker is P7); the form gains only success_criterion + custom_context fields. mode is accepted at the schema for the P5/P7 surfaces"
  - "custom_context empty notes filtered client-side before submit so blank 'Add grounding' rows never persist"

requirements-completed: [POP-05, POP-02, TRUST-02]

# Metrics
duration: ~5min
completed: 2026-06-27
---

# Phase 3 Plan 06: Route-Schema Validation + Author/Edit Form Affordances Summary

**Extended the two audiences route Zod schemas (`CreateAudienceSchema` / `PatchAudienceSchema`) to accept, sanitize, and cap `mode` / `success_criterion` / `custom_context` — closing the silent-drop seam between the form payload and the repo — then added a success-criterion Textarea and a tagged, distinct user-added-grounding add/edit/remove list to `audience-form.tsx`, both wired into the existing POST/PATCH path and rendered as plain escaped React text.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-27T14:43:39Z
- **Completed:** 2026-06-27T14:48:00Z
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 4 (3 source/route + 1 route test)

## Accomplishments
- Both `CreateAudienceSchema` (route.ts) and `PatchAudienceSchema` ([id]/route.ts) now carry: `mode: z.enum(["socials","general"]).optional()`; `success_criterion: z.string().max(2000).transform(sanitizeText).nullable().optional()`; `custom_context` array `.max(50)` with `source: z.literal("user")`, `note: .max(2000).transform(sanitizeText)`, `persona_evidence_link: z.string().max(120).optional()`. Each file reuses its own existing `sanitizeText` (control-char strip + trim).
- The scorer is untouched (D-02) — grep confirms no `DomainPackScoring`/`scoring`/`resolvePack`/`aggregateScores` import added to either route.
- Route tests extended (+5 cases): POST accepts + sanitizes the new fields into the create payload (NUL byte stripped from `success_criterion`); POST rejects a 51-entry `custom_context` (T-03-14) and a 2001-char `success_criterion` (T-03-12); PATCH accepts + sanitizes the fields into the update payload + rejects the over-cap array.
- `audience-form.tsx`: `successCriterion` + `customContext` state (seeded from `existing`), a labelled success-criterion `Textarea` (maxLength 2000, minRows 3), and a "User-added grounding" sub-section — a list of editable/removable notes each tagged `user-added` (terracotta accent chip) plus an "Add grounding" button; both folded into the submit `payload` as `success_criterion: successCriterion.trim() || null` and `custom_context: customContext.filter(c => c.note.trim().length > 0)`.
- All free text rendered as plain React children — zero `dangerouslySetInnerHTML` in the file (T-03-12 / D-07 XSS).

## Task Commits

1. **Task 1: accept + sanitize + cap mode/success_criterion/custom_context at the audiences API boundary** — `fae6d676` (feat)
2. **Task 2: success-criterion + user-added-grounding author/edit affordances in audience-form** — `d2d200ef` (feat)

## Files Created/Modified
- `src/app/api/audiences/route.ts` — `CreateAudienceSchema` gains `mode` / `success_criterion` / `custom_context` (sanitized + capped).
- `src/app/api/audiences/[id]/route.ts` — `PatchAudienceSchema` gains the same three fields.
- `src/app/api/audiences/__tests__/route.test.ts` — +5 cases covering sanitize round-trip + over-cap rejection on POST and PATCH.
- `src/components/audience/audience-form.tsx` — success-criterion Textarea + user-added-grounding add/edit/remove list + payload wiring + `CustomContext`/`Textarea` imports.

## Decisions Made
- The route caps are intentionally stricter than the repo `WritableAudienceSchema`: the route is the untrusted browser→persistence boundary, so the `.max(50)` array cap and `.max(120)` `persona_evidence_link` cap live there (the repo schema is the second, defense-in-depth allowlist). The `mode` enum + per-note `.max(2000)` are mirrored on both.
- No `mode` toggle in the form (CONTEXT: the front-door mode-creation picker is P7, net-new General-from-scratch is Profile/P5). The form gains only the two new fields; `mode` is accepted at the schema for the downstream surfaces.
- Empty grounding notes are filtered client-side before submit so a blank "Add grounding" row never persists.

## Deviations from Plan

None — plan executed exactly as written. (Two self-introduced test-assertion fixes during authoring: one test input string had to lose a stray interior double-space, and a deliberate NUL byte in a note literal was retained as a control-char-stripping assertion — neither is a plan deviation.)

## Issues Encountered
None blocking. One initial test expectation mismatched `sanitizeText`'s behavior (it trims + strips control chars but does NOT collapse interior whitespace); the input literal was normalized to a single interior space and the suite went green at 25/25.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/app/api/audiences/__tests__/route.test.ts` → **25 passed** (was 20; +5 new-field cases) — the primary behavioral gate.
- `node ./node_modules/vitest/vitest.mjs run src/components/audience src/app/api/audiences` → **10 files / 92 passed** (no regression).
- `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` → **6 passed** (no coral/glass regression — guard green).
- `! npx tsc --noEmit | grep -E 'src/components/audience/audience-form\.tsx'` → exits 0 (no new tsc errors on the touched form; repo baseline is non-zero by design).
- grep gates: `successCriterion` present (state + textarea + payload); `success_criterion` + `custom_context` in the submit payload; `dangerouslySetInnerHTML` count = 0; no scorer import in either route (D-02).

## Threat Model
- **T-03-12** (stored XSS via free-text `success_criterion` / `custom_context.note`) — MITIGATED: route zod caps length (`.max(2000)`) + `sanitizeText` strips control chars; the form renders all free text as plain React children (auto-escaped); zero `dangerouslySetInnerHTML`. Test asserts a NUL byte is stripped and a 2001-char criterion is rejected.
- **T-03-13** (mass-assignment of `user_id`/`mode`) — MITIGATED: route schema is an allowlist (unknown keys dropped); `user_id` stays session-derived inside `createAudience`/`updateAudience` (never body); `mode` constrained by the zod enum.
- **T-03-14** (unbounded `custom_context` array) — MITIGATED: `.max(50)` array cap + `.max(2000)` per-note cap; test asserts a 51-entry array is rejected on both POST and PATCH.
- **T-03-SC** (package installs) — N/A: zero package installs this plan.

## Known Stubs
None. `mode` is accepted at the schema but intentionally has no form toggle (the front-door picker is P7) — this is the planned scope boundary, not a stub.

## Next Phase Readiness
- The full author/edit path round-trips `success_criterion` + `custom_context` browser→route→repo→DB; P5 (Profile) and P7 (front-door mode picker) can build the General-from-scratch surface over the same validated schema fields.
- `success_criterion` is stored + surfaced only — no scorer consumes it yet (D-02); the P5/P6 General scorers read it from the `DomainPack.scoring` input contract.

## Self-Check: PASSED

- `src/app/api/audiences/route.ts`, `src/app/api/audiences/[id]/route.ts`, `src/components/audience/audience-form.tsx`, `src/app/api/audiences/__tests__/route.test.ts`, and this SUMMARY all exist on disk.
- Both task commits (`fae6d676`, `d2d200ef`) present in git history.

---
*Phase: 03-general-population-honesty-layer*
*Completed: 2026-06-27*
