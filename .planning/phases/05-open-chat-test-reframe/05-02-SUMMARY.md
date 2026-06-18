---
phase: 05-open-chat-test-reframe
plan: "02"
subsystem: reading-ui
tags: [test-reframe, presentation, d-06, sim-1-max]
dependency_graph:
  requires: []
  provides: [test-hero-relabel, sim-1-max-tag, test-brief-copy]
  affects: [reading-hero, reading-section, composer]
tech_stack:
  added: []
  patterns: [THEME-06 tokens, labelSuffix prop pattern]
key_files:
  created: []
  modified:
    - src/components/reading/reading-hero.tsx
    - src/components/reading/reading-section.tsx
    - src/components/app/home/composer.tsx
decisions:
  - "D-06a bounded rename: hero label + tag + brief copy only; reading_id / routes / ENGINE_VERSION / ScoreGauge untouched"
  - "ReadingSection.labelSuffix: ReactElement optional prop rather than inlining JSX into label string"
  - "Inline hex #FF7F50 replaced with var(--color-accent) for THEME-06 token-consistency"
metrics:
  duration: 3m
  completed: "2026-06-18"
  tasks: 2
  files: 3
---

# Phase 05 Plan 02: Test Reframe (D-06) Summary

**One-liner:** Reading hero relabeled "Test · powered by SIM-1 Max" via THEME-06 accent tag + D-06 brief copy, with zero change to video-scoring path or ENGINE_VERSION.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Relabel Reading hero → Test + powered-by-SIM-1-Max tag | f21d70ea | reading-hero.tsx, reading-section.tsx |
| 2 | Align Test brief copy + token-consistency | 6967de40 | composer.tsx |

## Changes Made

### Task 1 — Reading hero relabel (D-06)

**reading-hero.tsx:**
- `label="The read"` → `label="Test"` on the `ReadingSection` invocation
- Added `labelSuffix` JSX: a small `<span>` badge reading "powered by SIM-1 Max" using `borderColor: var(--color-accent)`, `color: var(--color-accent)`, `opacity: 0.75` — subtle coral per UI-SPEC
- Updated file comment header to reflect the D-06 bounded rename

**reading-section.tsx:**
- Added optional `labelSuffix?: ReactElement` prop to `ReadingSectionProps`
- Render it inline after the label text in the `<p>` element (flex row, items-center)
- No behavioral change for existing callers (labelSuffix defaults to undefined → renders nothing)

### Task 2 — Brief copy + token-consistency (D-06)

**composer.tsx:**
- Sub-line copy: `"Shooting this hook — upload your video and SIM-1 Max will score the real thing"` → `"Shoot this hook → upload → SIM-1 Max scores the real thing"` (UI-SPEC verbatim)
- Hook line inline style: `color: '#FF7F50'` → `color: 'var(--color-accent)'` (THEME-06 token-consistency)

**tool-chips.tsx (read-only):**
- Confirmed `MODEL_LABEL.test = "SIM-1 Max"` (unchanged) and no "Reading" string in any chip label/title — no edit needed.

## Verifications

- `git diff --name-only` (HEAD~2..HEAD): `composer.tsx`, `reading-hero.tsx`, `reading-section.tsx` — NO file under `src/lib/engine/`
- `src/lib/engine/version.ts` NOT in diff (no ENGINE_VERSION bump)
- `npx tsc --noEmit` clean for all 3 source files (pre-existing test-file errors unchanged)
- Engine suite: `npx vitest run src/lib/engine` → PASS (1066 tests, 0 failures)
- ScoreGauge invocation byte-identical: `<ScoreGauge score={score} size={128} />`
- No `from "@/lib/engine"` import added to reading-hero.tsx

## Deviations from Plan

### Auto-additions (Rule 2)

**1. [Rule 2 - Missing support] ReadingSection.labelSuffix prop**
- **Found during:** Task 1
- **Issue:** `ReadingSection` only accepted `label: string`; the "powered by SIM-1 Max" tag required an inline ReactElement next to the label text.
- **Fix:** Added optional `labelSuffix?: ReactElement` prop to `ReadingSectionProps` + render inline in the label `<p>`. Non-breaking — all existing callers unaffected (prop is optional, defaults to nothing).
- **Files modified:** `src/components/reading/reading-section.tsx`
- **Commit:** f21d70ea

**2. [Rule 2 - Token-consistency] Replace hardcoded hex with THEME-06 token**
- **Found during:** Task 2
- **Issue:** Existing brief banner rendered the hook line with `style={{ color: '#FF7F50' }}` — a hardcoded hex bypassing the THEME-06 token layer. Task 2 was updating this element; aligning to the token is a correctness requirement (CLAUDE.md + THEME-06 SSOT).
- **Fix:** `color: '#FF7F50'` → `color: 'var(--color-accent)'`
- **Files modified:** `src/components/app/home/composer.tsx`
- **Commit:** 6967de40

## Known Stubs

None — the "powered by SIM-1 Max" tag and brief copy are fully wired to the live UI.

## Threat Flags

None — presentation/copy-only changes, no new network endpoints, no auth paths, no schema changes.

## Self-Check: PASSED

- `src/components/reading/reading-hero.tsx` — exists, modified ✓
- `src/components/reading/reading-section.tsx` — exists, modified ✓
- `src/components/app/home/composer.tsx` — exists, modified ✓
- Commit f21d70ea — confirmed in git log ✓
- Commit 6967de40 — confirmed in git log ✓
