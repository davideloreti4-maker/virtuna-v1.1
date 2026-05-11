---
phase: 01-foundation-route-scaffolding
plan: 03
subsystem: marketing-route-shell
tags:
  - cleanup
  - brand-spine-neutral
  - documentation
dependency_graph:
  requires:
    - 01-01 (Wave 0 invariant tests — marketing-shell.test.ts authored)
  provides:
    - clean-marketing-route-shell (intentionally-empty <main> for Phases 2-7)
    - external-library-vetting-checklist (single canonical gate)
    - virtuna-wordmark-header (replaces AS plagiarized header)
  affects:
    - src/app/(marketing)/page.tsx (rewritten)
    - src/app/(marketing)/layout.tsx (metadata neutralized)
    - src/app/(marketing)/pricing/page.tsx (FAQSection detached)
    - src/components/layout/header.tsx (wordmark + CTA stubbed)
    - src/components/landing/ (deleted in entirety)
    - BRAND-BIBLE.md (vetting checklist appended)
tech_stack:
  added: []
  patterns:
    - "Pure-insertion docs edits (no rewrites)"
    - "Sequenced cleanup (detach import -> delete dir) to keep build green at every step"
key_files:
  created:
    - .planning/phases/01-foundation-route-scaffolding/01-03-SUMMARY.md
  modified:
    - src/app/(marketing)/page.tsx
    - src/app/(marketing)/layout.tsx
    - src/app/(marketing)/pricing/page.tsx
    - src/components/layout/header.tsx
    - BRAND-BIBLE.md
  deleted:
    - src/components/landing/backers-section.tsx
    - src/components/landing/case-study-section.tsx
    - src/components/landing/comparison-chart.tsx
    - src/components/landing/cta-section.tsx
    - src/components/landing/faq-section.tsx
    - src/components/landing/feature-card.tsx
    - src/components/landing/features-section.tsx
    - src/components/landing/hero-section.tsx
    - src/components/landing/index.ts
    - src/components/landing/partnership-section.tsx
    - src/components/landing/persona-card.tsx
    - src/components/landing/social-proof-section.tsx
    - src/components/landing/stats-section.tsx
    - src/components/landing/testimonial-quote.tsx
decisions:
  - "D-06 honored: vetting checklist landed in BRAND-BIBLE.md (NOT a new file in .planning/) between 'Do's and Don'ts' and 'Accessibility'"
  - "Task ordering invariant respected: FAQSection detach from /pricing (Task 1) BEFORE landing/ delete (Task 4)"
  - "Marketing description left brand-spine-neutral ('Virtuna — TikTok creator intelligence.') — Phase 8 COPY-02 finalizes"
  - "JSDoc comment block in header.tsx updated as part of Task 5 to satisfy strict grep acceptance (deviated from plan's 'do not touch JSDoc' guidance — see Deviations)"
metrics:
  duration_minutes: 5
  completed: 2026-05-11
  tasks_completed: 6
  files_changed: 19
  commits: 6
requirements:
  - SC-1
  - SC-3
---

# Phase 01 Plan 03: Marketing Route Scaffolding Cleanup Summary

One-liner: Marketing `/` route stripped to an empty Virtuna shell, `/pricing` FAQSection landmine defused, plagiarized `src/components/landing/` directory deleted entirely, header rebranded to Virtuna + `/signup` CTA, and a 9-gate External Library Vetting Checklist committed to BRAND-BIBLE.md — Wave-0 marketing-shell invariant test went from RED (failing on 4 of 6 assertions) to GREEN (6/6).

## What Was Built

Plan 03 is the **cleanup pass** in Phase 1's "scaffold dark canvas" arc. It removes the Artificial Societies plagiarism from the live marketing surfaces (route shell, layout metadata, header chrome, cross-route imports) and lands the single source of truth — `## External Library Vetting Checklist` — that every future Magic UI / Aceternity / Origin UI / Cult UI import must pass before commit.

### Cleanup Ordering (Why It Mattered)

The plan's task order was **invariant** and the executor followed it verbatim:

1. **Task 1 first** — Detach `FAQSection` import + usage from `src/app/(marketing)/pricing/page.tsx`.
2. **Task 2 second** — Rewrite `src/app/(marketing)/page.tsx` to drop the 7 AS section imports.
3. **Task 3 third** — Neutralize `src/app/(marketing)/layout.tsx` metadata.
4. **Task 4 fourth** — Only NOW delete `src/components/landing/` (14 files).
5. **Task 5 fifth** — Stub the header.
6. **Task 6 last** — Append the vetting checklist to BRAND-BIBLE.md.

If Task 4 had run before Task 1, the `/pricing` build would have 500ed on missing `@/components/landing` module resolution. By detaching the import sites first, the deletion in Task 4 was a no-op for the type-checker and bundler.

### Build Health Across the Plan

`pnpm run build` was clean after Task 4 immediately — no cache flush needed. The node_modules in the worktree was installed once (after the worktree was spawned without dependencies) and persisted for subsequent builds. All 65 routes compiled, including `/` (static, intentionally empty `<main>`) and `/pricing` (server-rendered without the FAQ section).

### Wave-0 marketing-shell.test.ts: RED -> GREEN

The Wave-0 invariant test authored in Plan 01-01 has 6 assertions:

1. `src/app/(marketing)/page.tsx` has NO import from `@/components/landing` — turned GREEN by Task 2
2. `src/app/(marketing)/page.tsx` renders `<main>` with `min-h-screen` + `bg-background` — turned GREEN by Task 2
3. `src/app/(marketing)/page.tsx` contains no AS-plagiarized section names — turned GREEN by Task 2
4. Marketing layout metadata title is `'Virtuna'` — turned GREEN by Task 3
5. Pricing page no longer imports `FAQSection` from `@/components/landing` — turned GREEN by Task 1
6. `src/components/landing/` directory has been deleted — turned GREEN by Task 4

Final test run: **6 passed (6)** in 117ms.

## Commits

| Task | Commit  | Title                                                                   |
|------|---------|-------------------------------------------------------------------------|
| 1    | 98a371f | fix(01-03): detach FAQSection from /pricing to defuse landing/ landmine |
| 2    | 0bef80a | refactor(01-03): replace marketing / with empty Virtuna shell           |
| 3    | f432fcd | refactor(01-03): neutralize marketing layout metadata to Virtuna        |
| 4    | 59eb5af | chore(01-03): delete plagiarized src/components/landing/ directory      |
| 5    | 6dabbc0 | refactor(01-03): stub marketing header with Virtuna wordmark + /signup CTA |
| 6    | 16e1115 | docs(01-03): add External Library Vetting Checklist to BRAND-BIBLE.md   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Updated JSDoc comment block in header.tsx**

- **Found during:** Task 5
- **Issue:** The plan body said "DO NOT replace the existing JSDoc comment at line 12-18 that mentions 'societies.io' ... Phase 8 (COPY-01 audit) catches it later." However, the **acceptance criteria for the same task** required `grep -c "Artificial Societies" src/components/layout/header.tsx` to return 0 and `grep -c "Book a Meeting" ...` to return 0. The JSDoc at lines 14-15 contained both of those strings, making the two requirements **mutually contradictory**.
- **Fix:** Rewrote the JSDoc block (6 lines) to describe the Virtuna chrome accurately ("Virtuna marketing chrome (floating pill)", "wordmark", "primary CTA routing to /signup"). The replacement avoids the exact strings `"Sign up free"` and `"Virtuna"` in surrounding quotes to keep `grep -c "Sign up free"` at exactly 2 (the two CTAs) and `grep -c "Virtuna"` at >= 1 (per the acceptance criteria table).
- **Files modified:** `src/components/layout/header.tsx` (lines 12-18, JSDoc block)
- **Commit:** `6dabbc0` (folded into Task 5's commit)
- **Rationale:** The strict grep gates are the authoritative contract — the prose guidance was an optimization hint that turned out to be unsatisfiable. Updating the JSDoc is also strictly better: it now accurately describes the current chrome instead of carrying a stale societies.io comment forward.

### Other Notes

- **No deviations on Tasks 1-4 or Task 6.** All six tasks executed in plan order, with only Task 5 requiring the contradiction reconciliation noted above.
- **No architectural rule (Rule 4) triggers.** All cleanups were structural file edits and a documentation append.

## Authentication Gates

None encountered.

## Hidden Regressions Surface Check

A repo-wide grep was run after Task 4 for `components/landing` across `src/`, `tests/`, `e2e/`, and `extraction/`:

```
src/components/magic-ui/__tests__/marketing-shell.test.ts:7:  ... @/components/landing (AS-plagiarized).
src/components/magic-ui/__tests__/marketing-shell.test.ts:14: ... src/components/landing/ directory is deleted.
src/components/magic-ui/__tests__/marketing-shell.test.ts:24: it("src/app/(marketing)/page.tsx has NO import from @/components/landing", () => {
src/components/magic-ui/__tests__/marketing-shell.test.ts:54: it("pricing page no longer imports FAQSection from @/components/landing", () => {
src/components/magic-ui/__tests__/marketing-shell.test.ts:59: it("src/components/landing/ directory has been deleted", () => {
```

These 5 matches are all **descriptive strings / test titles inside the Wave-0 invariant test file** — they are the assertions that PROVE the deletion happened, not consumers. No `import` or `require` statement references the deleted path anywhere else in the repo. No stale tests, no stale e2e fixtures, no stale extraction scripts.

## BRAND-BIBLE.md Vetting Checklist Placement

Pre-plan section heading line numbers:

```
289:## Do's and Don'ts
312:## Accessibility
```

Post-plan section heading line numbers:

```
289:## Do's and Don'ts
312:## External Library Vetting Checklist
383:## Accessibility
```

The new section starts at line 312 (immediately after the closing `---` separator that follows "Do's and Don'ts") and runs through line 381. Section line 383 is the unchanged `## Accessibility` heading. Diff stats: **+71 insertions, 0 deletions** — pure insertion as planned.

## Known Stubs

None introduced. The empty `<main>` is an intentional Phase 1 contract (per UI-SPEC §"Marketing Route Shell Contract") with 6 phase-stub COMMENTS marking the future composition slots — those are documentation markers, not rendered placeholders. Per CONTEXT.md decision: "no placeholder text, no 'coming soon', no centered spinner."

## Threat Flags

None new. All threat-register dispositions from the plan's `<threat_model>` are honored:

- **T-03-01 (Information disclosure on indexed metadata)** — mitigated: description is brand-spine-neutral.
- **T-03-02 (Header /signup link)** — accepted: `/signup` route confirmed extant.
- **T-03-03 (Stale imports after landing/ delete)** — mitigated: repo-wide grep clean.
- **T-03-04 (Internal hook path in BRAND-BIBLE.md)** — accepted: private repo.
- **T-03-05 (Sign up phishing surface)** — accepted: same-origin internal route.

## Success Criteria Status

| Criterion                                                                            | Status |
| ------------------------------------------------------------------------------------ | ------ |
| SC-1: Visitor at `/` sees a clean dark canvas (header + empty <main>)                | PASS   |
| SC-3: 9-gate vetting checklist exists in `BRAND-BIBLE.md` as its own section         | PASS   |
| All 6 Wave-0 marketing-shell.test.ts assertions GREEN                                | PASS   |
| `/pricing` still renders (without the AS FAQ — explicitly per UI-SPEC)               | PASS   |
| `pnpm run build` exits 0 across all routes                                           | PASS   |
| No file modifications outside the listed `files_modified` paths                      | PASS   |

## Self-Check: PASSED

- `.planning/phases/01-foundation-route-scaffolding/01-03-SUMMARY.md` — will be present after this Write
- Commit `98a371f` (Task 1) — verified in git log
- Commit `0bef80a` (Task 2) — verified in git log
- Commit `f432fcd` (Task 3) — verified in git log
- Commit `59eb5af` (Task 4) — verified in git log
- Commit `6dabbc0` (Task 5) — verified in git log
- Commit `16e1115` (Task 6) — verified in git log
