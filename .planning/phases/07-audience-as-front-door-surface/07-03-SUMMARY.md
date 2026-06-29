---
phase: 07-audience-as-front-door-surface
plan: 03
subsystem: audience
tags: [audience, clone, general-sim, build-chooser, security]
requires:
  - createAudience (audience-repo.ts, session-derived user_id CR-01)
  - GENERAL_TEMPLATES (template-analyst / template-hiring virtual constants)
  - WritableAudienceSchema (Zod boundary, name ≤ 80)
provides:
  - cloneTemplateAudience(supabase, templateId, name?) — the validated template Build path
affects:
  - 07-05 (Build chooser UI "From a template" path mounts this helper)
tech-stack:
  added: []
  patterns: [thin-wrapper-over-createAudience, sentinel-id-strip, session-derived-user_id]
key-files:
  created:
    - src/lib/audience/__tests__/build-clone.test.ts
  modified:
    - src/lib/audience/audience-repo.ts
decisions:
  - "cloneTemplateAudience adds NO new insert path — it reuses createAudience verbatim so user_id stays session-derived (CR-01) and the Zod cap applies."
  - "Sentinel test scans for template ids + '__virtual__' via strict-equality, NOT substring/SENTINEL_IDS — the 'general' sentinel id collides with the legitimate mode:'general' value."
metrics:
  duration: ~3 min
  completed: 2026-06-29
requirements: [UX-04]
---

# Phase 7 Plan 03: cloneTemplateAudience clone-and-edit helper Summary

`cloneTemplateAudience` turns a select-only `GENERAL_TEMPLATES` preset into an owned, editable General SIM (the moat object) by stripping its sentinel id + virtual user_id and saving through the existing `createAudience` — one validated, session-scoped save target for the Build chooser's "From a template" path (UX-04 / D-03), shipped as a lib leaf with no UI overlap.

## What Was Built

- **`cloneTemplateAudience(supabase, templateId, name?)` → `Promise<Audience>`** (audience-repo.ts): finds the `GENERAL_TEMPLATES` entry (throws on unknown), destructures off the non-writable/sentinel fields (`id`, `user_id`, `created_at`, `updated_at`), builds `{ ...cloneable, name: (name ?? tpl.name).slice(0, 80) }` (mode:'general' rides along in `cloneable`), and returns `createAudience(supabase, input)`. No new insert path — `createAudience` re-validates via `WritableAudienceSchema` and re-derives `user_id` from `supabase.auth.getUser()` (CR-01).
- **`build-clone.test.ts`** (8 tests, all mocked, zero live DB): clone → `mode:'general'` row via the audiences insert; sentinel `id` absent from the insert payload; default name = template name; 120-char name truncated to ≤ 80; unknown templateId throws without a DB call; session-derived user_id (`__virtual__` never persisted); recursive value-scan proving no template sentinel id lands in the row; template-hiring clones identically.

## TDD Gate Compliance

- RED: `test(07-03)` `b07866b7` — 5 failing tests (`cloneTemplateAudience is not a function`).
- GREEN: `feat(07-03)` `de35f041` — helper implemented, 5/5 pass, tsc clean on audience-repo.ts.
- Task 2 (security extension): `test(07-03)` `9dab5e6e` — +3 sentinel/virtual-user_id assertions.

## Verification

- `build-clone.test.ts` — 8/8 green.
- `audience-repo.test.ts` + `audience-repo-mode.test.ts` — green, no regression.
- Full `src/lib/audience/` suite — 14 files / 180 passed.
- `tsc --noEmit` — no new error on audience-repo.ts or the test file (baseline clean for these paths).
- Acceptance grep `export async function cloneTemplateAudience` === 1.

## Threat Model

- **T-07-03-01 (IDOR):** mitigated — `createAudience` derives `user_id` from session; helper accepts no `user_id`/`id`. Test asserts `__virtual__` never persisted.
- **T-07-03-02 (sentinel reuse):** mitigated — `id` + virtual `user_id` stripped before save; recursive value scan asserts no template sentinel id reaches the insert.
- **T-07-03-03 (stored-XSS/DoS caps):** mitigated — `WritableAudienceSchema` caps name ≤ 80 (asserted) + free-text fields downstream.

## Deviations from Plan

**1. [Rule 1 - Bug] Sentinel-scan assertion: substring/SENTINEL_IDS → strict-equality on template ids**
- **Found during:** Task 2 (sentinel never-persisted assertion).
- **Issue:** The `SENTINEL_IDS` set contains the string `'general'`, which is also the legitimate `mode: 'general'` value carried by every cloned template — both a substring scan (`'general'` in the serialized payload) and a strict-equality scan against the full `SENTINEL_IDS` set produced a false-positive failure.
- **Fix:** Narrowed the assertion to the actual leak risks — the template sentinel ids (`template-analyst` / `template-hiring`) and `'__virtual__'` — via strict-equality over a recursively-collected value list. Documented the `'general'` collision inline.
- **Files modified:** src/lib/audience/__tests__/build-clone.test.ts
- **Commit:** 9dab5e6e

## Known Stubs

None — this is a complete lib leaf. The Build chooser UI that mounts this helper is the Wave-3 plan 07-05 (out of scope here, by design).

## Self-Check: PASSED

- `src/lib/audience/__tests__/build-clone.test.ts` — FOUND
- `src/lib/audience/audience-repo.ts` (cloneTemplateAudience) — FOUND
- Commit b07866b7 (RED) — FOUND
- Commit de35f041 (GREEN feat) — FOUND
- Commit 9dab5e6e (Task 2 test) — FOUND
