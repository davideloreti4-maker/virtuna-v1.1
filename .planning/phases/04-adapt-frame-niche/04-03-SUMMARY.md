---
phase: 04-adapt-frame-niche
plan: "03"
subsystem: ui/adapt-card
tags: [ui, component, raycast, adapt, tdd, wave-2]
dependency_graph:
  requires:
    - src/lib/engine/remix/decode-types.ts
    - src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx
  provides:
    - src/components/board/adapt/AdaptConceptCard.tsx
  affects:
    - Plan 04-04 (AdaptFrameBody stacks 3x AdaptConceptCard)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN (Wave 0 todo → Wave 1 real tests → component)
    - Raycast card language (bg-transparent + 6% border + 12px radius + 2% hover)
    - Coral accent reserved-for rule (chip only, zero other occurrences)
key_files:
  created:
    - src/components/board/adapt/AdaptConceptCard.tsx
  modified:
    - src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx
decisions:
  - "AdaptConceptCard root is <article> not <div> for correct DOM reading order (D-09 + UI-SPEC accessibility)"
  - "Coral accent used only on the Borrowed chip — zero other occurrences enforce the reserved-for rule visually"
  - "hover:bg-white/[0.02] only — no translate-y, no border change (Raycast card rule per CLAUDE.md)"
  - "No dangerouslySetInnerHTML anywhere — React text children escape is sufficient XSS mitigation (T-04-09)"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-02T09:10:00Z"
  tasks_completed: 1
  files_created: 1
  files_modified: 1
---

# Phase 04 Plan 03: AdaptConceptCard Raycast Card Component Summary

Hook-first Raycast card rendering a single AdaptConcept with coral Borrowed chip, Angle row, and Who it's for row as a DOM `<article>` element — pure presentational leaf, fully tested via TDD.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Wave 1 test scaffold — failing tests | 57a265a1 | AdaptConceptCard.test.tsx |
| 1 (GREEN) | AdaptConceptCard component implementation | bfe82f5e | AdaptConceptCard.tsx |

## What Was Built

**`AdaptConceptCard.tsx`** — Pure presentational component. Exports `AdaptConceptCard({ concept }: { concept: AdaptConcept })`.

Internal anatomy (top-to-bottom, D-09):
1. Hook headline — `text-base font-semibold text-foreground`
2. `format_borrowed` chip — `text-xs font-medium text-accent bg-accent/[0.12] rounded-full px-2 py-0.5`, prefix "Borrowed:"
3. Divider — `border-t border-white/[0.04]`
4. Angle muted row — uppercase `text-white/45 tracking-widest` label + `text-foreground-secondary` value
5. Who it's for muted row — same pattern

Raycast card chrome: `bg-transparent border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.02]` + inline `boxShadow: rgba(255,255,255,0.05) 0px 1px 0px 0px inset`.

**`AdaptConceptCard.test.tsx`** — Wave 0 `it.todo` stubs replaced with 8 real tests (6 Wave 1 + 2 Wave 0 smoke preserved). All green.

## Verification

- `npx vitest run src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx` → 8/8 PASS
- `npx tsc --noEmit` → 0 errors
- `grep -E 'article|rounded-xl|border-white/\[0.06\]'` → all three present on root element
- `grep -c 'text-accent|bg-accent'` → 1 (chip line only)
- No `dangerouslySetInnerHTML` in component (T-04-09 mitigation confirmed)
- No `translate-y` or `hover:border` class (Raycast hover rule confirmed)

## Deviations from Plan

None — plan executed exactly as written. TDD RED/GREEN flow followed per plan `tdd="true"` annotation.

## Known Stubs

None. Pure presentational component — all four `AdaptConcept` fields rendered directly from prop; no empty values, no placeholder text, no unconnected data sources.

## Threat Flags

None. Pure DOM component, no network/auth/DB/file-system surface. T-04-09 (XSS) mitigated by React text children escaping — no `dangerouslySetInnerHTML` present.

## TDD Gate Compliance

- RED gate commit: `57a265a1` — `test(04-03): add failing tests for AdaptConceptCard Wave 1`
- GREEN gate commit: `bfe82f5e` — `feat(04-03): implement AdaptConceptCard Raycast card component`
- REFACTOR gate: not needed (no structural cleanup required)

## Self-Check: PASSED

- [x] `src/components/board/adapt/AdaptConceptCard.tsx` — FOUND
- [x] `src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx` — FOUND (modified)
- [x] Commit 57a265a1 (RED) — FOUND in git log
- [x] Commit bfe82f5e (GREEN) — FOUND in git log
- [x] vitest 8/8 green
- [x] tsc --noEmit clean
