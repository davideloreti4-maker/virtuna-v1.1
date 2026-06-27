---
phase: 03-general-population-honesty-layer
plan: 05
subsystem: audience
tags: [react, ui, audience, honesty-layer, trust-badge, flat-warm, tdd]

# Dependency graph
requires:
  - phase: 03-general-population-honesty-layer
    plan: 02
    provides: "Audience.mode + resolveTier/TrustTier (the tier the badge renders)"
  - phase: 03-general-population-honesty-layer
    plan: 04
    provides: "GENERAL_TEMPLATES (analyst/hiring, mode='general', evidence-free) the manager surfaces"
provides:
  - "isPersonaGrounded predicate + generalTemplates grouping bucket + getTemplateProvenanceLabel in audience-display.ts"
  - "TrustBadge (Validated/Directional) over the flat-warm Badge primitive"
  - "audience-card honesty render: tier badge in header + inline persona evidence + muted ungrounded affordance + general-template provenance subline"
  - "'General templates' browseable section in the audience manager (POP-03 surface)"
  - "in-phase honesty-render.test.tsx locking badge-tier + grounded/ungrounded behavior (no downstream /gsd-ui-phase exists)"
affects: [03-06, 05-simulate, 07-audience-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TrustBadge mirrors AudienceStatusChip — wraps Badge with a variant-record map, presentation-only (caller passes resolveTier output → single source of truth, T-03-11)"
    - "Honesty render: one ungrounded affordance per card (not per persona); grounded quotes inline; general-template provenance replaces the generic ungrounded line"
    - "Persona evidence rendered as plain React text children (auto-escaped) — never dangerouslySetInnerHTML (T-03-10)"

key-files:
  created:
    - src/components/audience/trust-badge.tsx
    - src/components/audience/__tests__/honesty-render.test.tsx
  modified:
    - src/components/audience/audience-display.ts
    - src/components/audience/audience-card.tsx
    - src/components/audience/audience-manager.tsx
    - src/components/audience/__tests__/audience-display.test.ts
    - src/components/audience/__tests__/persona-edit.test.tsx

key-decisions:
  - "groundedPersonas filter casts the roster entry to { evidence?: string } — CalibratedPersona shares no property with the plan-mandated weak-type predicate signature, so the cast is required while keeping isPersonaGrounded's signature verbatim (acceptance grep)"
  - "Branch precedence on the card: grounded quotes → general-template provenance subline → generic 'no evidence — Directional' line. General templates show 'Authored template — Directional', not the generic ungrounded line"
  - "Backfilled mode='socials' on two pre-existing audience test fixtures (03-02 made mode required) to keep the audience-path tsc gate genuinely clean"

requirements-completed: [TRUST-01, TRUST-02, POP-03]

# Metrics
duration: ~7min
completed: 2026-06-27
---

# Phase 3 Plan 05: TrustBadge + Card Honesty Render Summary

**Made the honesty layer read at a glance on the audience surface — a flat-warm Validated/Directional `TrustBadge` derived strictly from `resolveTier`, inline persona evidence with a distinct muted ungrounded affordance, and the analyst/hiring General templates surfaced as a browseable manager section — all locked by an in-phase render test (the only honesty-render gate this skip-UI phase has).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-27T14:32:27Z
- **Completed:** 2026-06-27T14:39:33Z
- **Tasks:** 3 (Task 3 TDD: RED → GREEN)
- **Files modified:** 7 (2 created source/test, 3 modified source, 2 modified test fixtures)

## Accomplishments
- `isPersonaGrounded(p: { evidence?: string })` returns true only for a non-empty trimmed evidence string — `CalibratedPersona` (no evidence field) is ungrounded-by-construction, only scrape-derived `SignaturePersona` carries the receipt.
- `groupAudiences` gained a `generalTemplates` bucket, routing `mode==='general'` audiences there BEFORE the `is_preset` check (A6) so the authored templates never mix into the socials `templates` bucket; `baseline`/`templates`/`yours` semantics for socials constants unchanged.
- `getTemplateProvenanceLabel` returns "Authored template — Directional" for `mode==='general'` templates (the card subline).
- `TrustBadge` wraps the flat-warm `Badge` primitive (`size="sm"`): Validated→`default`, Directional→`secondary`. Presentation-only — the caller passes the resolved `TrustTier`, so `resolveTier` is the single source of truth for the never-Validated-for-general rule (T-03-11). No coral/glass.
- `audience-card`: `resolveTier(audience)` → `<TrustBadge>` rides beside `<AudienceStatusChip>` in the header; below the temp bar the provenance block shows grounded evidence quotes inline, else the general-template provenance subline, else one muted "no evidence — Directional" line.
- `audience-manager`: a new "General templates" `<section>` (between Templates and Yours) maps the `generalTemplates` bucket through the existing `renderAudienceCard`.
- `honesty-render.test.tsx` (happy-dom + @testing-library/react, mirroring `persona-edit.test.tsx`) locks: (a) Validated for socials / Directional for general by `resolveTier`, (b) inline evidence quote for a grounded persona, (c) muted ungrounded affordance + NO quote for an evidence-free card, (d) general-template provenance subline (POP-04).

## Task Commits

1. **Task 1: isPersonaGrounded predicate + generalTemplates bucket + getTemplateProvenanceLabel** — `d33f2ba4` (feat)
2. **Task 2: TrustBadge component (Validated/Directional) over Badge primitive** — `f49225d7` (feat)
3. **Task 3 (RED): failing honesty-render lock** — `420de059` (test)
4. **Task 3 (GREEN): mount badge + inline evidence + ungrounded state on card; General templates manager section** — `33d30681` (feat)

_Task 3 ran TDD: RED landed with 2 pass (pure TrustBadge tier) / 4 fail (card badge mount + evidence quote + ungrounded line + template provenance); GREEN implemented the card + manager and reached 6/6._

## Files Created/Modified
- `src/components/audience/trust-badge.tsx` — NEW: `TrustBadge` over `Badge`, tier→variant map, type-only `TrustTier` import.
- `src/components/audience/audience-display.ts` — `isPersonaGrounded`, `getTemplateProvenanceLabel`, `generalTemplates` bucket on `groupAudiences`.
- `src/components/audience/audience-card.tsx` — `TrustBadge` in header (via `resolveTier`); persona provenance block (grounded quotes / template subline / muted ungrounded line).
- `src/components/audience/audience-manager.tsx` — destructure `generalTemplates`; render the "General templates" section.
- `src/components/audience/__tests__/honesty-render.test.tsx` — NEW: the in-phase honesty render lock.
- `src/components/audience/__tests__/audience-display.test.ts` — `mode='socials'` fixture backfill + a `generalTemplates`-routing assertion (A6).
- `src/components/audience/__tests__/persona-edit.test.tsx` — `mode='socials'` fixture backfill.

## Decisions Made
- The `groundedPersonas` filter casts the roster entry to `{ evidence?: string }`: `CalibratedPersona` shares no property with the plan-mandated weak-type predicate signature, so a direct `.filter(isPersonaGrounded)` fails TS weak-type assignability. The cast keeps `isPersonaGrounded`'s signature verbatim (acceptance grep) while satisfying tsc.
- Card branch precedence: grounded evidence quotes → general-template provenance subline → generic "no evidence — Directional". This makes a `mode='general'` template read "Authored template — Directional" rather than the generic ungrounded line, while a thin socials audience reads the generic line.
- The ungrounded fixture is `mode='socials'` (not general) so it exercises the generic line; a separate `mode='general'` fixture exercises the template-provenance branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backfilled mode='socials' on two pre-existing audience test fixtures**
- **Found during:** Task 1 (tsc gate on touched audience paths)
- **Issue:** `audience-display.test.ts` and `persona-edit.test.tsx` fixtures omitted `mode`, which 03-02 made a required `Audience` field — 2 pre-existing tsc errors polluting the audience-path gate (confirmed pre-existing by reverting the Task-1 edit: same 2 errors).
- **Fix:** Added `mode: "socials"` to both creator/personal fixtures; extended the `groupAudiences` test with a `generalTemplates`-routing assertion (A6).
- **Files modified:** `src/components/audience/__tests__/audience-display.test.ts`, `src/components/audience/__tests__/persona-edit.test.tsx`
- **Commit:** `d33f2ba4`

## Issues Encountered
None blocking. Two tsc iterations on Task 3 GREEN resolved the weak-type predicate assignability (`PersonaRosterEntry` → `{ evidence?: string }`) and the `p.evidence` access on the union — both fixed with a localized cast, no signature change.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/components/audience/__tests__/honesty-render.test.tsx` → **6 passed** (the in-phase headline-deliverable gate).
- `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` → green (no coral/glass regression).
- `node ./node_modules/vitest/vitest.mjs run src/components/audience` → **9 files / 67 passed** (no regression).
- `! npx tsc --noEmit | grep -E 'src/components/audience/'` → exits 0 (no new errors on touched paths; pre-existing fixture errors cleared by the deviation).
- grep gates: `isPersonaGrounded` ×1 exported; `groupAudiences` returns `generalTemplates`; `trust-badge.tsx` imports `Badge` from `@/components/ui/badge`, renders literal "Validated"/"Directional", no `#FF7F50`/coral/glass; `resolveTier` called in `audience-card.tsx`; manager renders the "General templates" section.

## Threat Model
- **T-03-10** (stored XSS via persona `evidence` / template free-text) — MITIGATED: rendered as plain React text children (auto-escaped); no `dangerouslySetInnerHTML`; length capped at the 03-04 zod boundary.
- **T-03-11** (mis-badging a general audience as Validated) — MITIGATED: `TrustBadge` is presentation-only; the card passes `resolveTier(audience)` with no override; the render test asserts `mode='general'` → Directional and never Validated.
- **T-03-SC** (package installs) — N/A: zero package installs this plan.
- No new trust boundaries (renders existing stored strings on the existing audience surface).

## Known Stubs
None. The general templates are intentionally evidence-free (ungrounded-by-design, D-05/Pitfall 5) and now render the honest "Authored template — Directional" affordance — the honest Directional contract, not a stub.

## Next Phase Readiness
- The audience card + manager now wear the honesty layer; 03-06 (route schemas + author/edit form) and P5/P7 can build the front-door mode-creation UI over the same `resolveTier`/`isPersonaGrounded`/`generalTemplates` primitives.

## Self-Check: PASSED

- `src/components/audience/trust-badge.tsx`, `src/components/audience/__tests__/honesty-render.test.tsx`, and the 3 modified source files + 2 modified fixtures all exist on disk.
- All 4 task commits (d33f2ba4, f49225d7, 420de059, 33d30681) present in git history.

---
*Phase: 03-general-population-honesty-layer*
*Completed: 2026-06-27*
