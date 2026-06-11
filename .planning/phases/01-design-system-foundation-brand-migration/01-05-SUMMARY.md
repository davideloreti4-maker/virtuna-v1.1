---
phase: 01-design-system-foundation-brand-migration
plan: 05
subsystem: brand-migration
tags: [migration, audit, grep-inventory, ds-06, boundary-doc]
requires: []
provides: ["docs/numen-migration-boundary.md", "DS-06 migration boundary"]
affects: ["Phase 4 (Reading rebuild)", "Phase 5 (shell rebuild)", "each surface rebuild phase"]
tech-stack:
  added: []
  patterns: ["parallel namespaced kit coexists with live app (D-01)", "per-surface retirement deferred (D-04)"]
key-files:
  created:
    - docs/numen-migration-boundary.md
  modified: []
decisions:
  - "Chat dock FOUND via widened grep: src/components/command-bar/CommandBar.tsx (self-described 'bottom-pinned dock' / 'unified expert chat panel') + ExpertChatThread/Input + use-expert-chat hook — Q8 'absent' caveat resolved."
  - "All counts re-measured 2026-06-11; matched pre-measured Research Q8 file counts exactly (5/17/10/7/4/5 + dock now 4)."
metrics:
  duration: 10 min
  completed: 2026-06-11
---

# Phase 01 Plan 05: DS-06 Migration Boundary Summary

Grep inventory of 7 old Raycast/coral/glass costume targets (re-measured 2026-06-11) plus a written boundary doc stating each target's v5.0 replace/defer disposition and owning phase — delete nothing live (D-04).

## What Was Built

Single audit-only artifact: `docs/numen-migration-boundary.md`. It contains:
- The explicit D-04 rule header (Phase 1 deletes nothing live; per-surface retirement deferred).
- An inventory table — one row per costume target — with columns `Target | Files/Count (measured 2026-06-11) | Surface(s) | v5.0 Disposition (replace/defer) | Owning Phase`.
- The widened-grep chat-dock finding (resolves Research Q8 caveat).
- A "what v5.0 replaces vs defers" prose summary (parallel kit built now vs per-surface retirements deferred).
- The forbidden carry-overs the new kit must never adopt (OLD `--animate-shimmer`/`gradient-x` keyframes, the `--ease-spring` 1.56 bounce token — D-07).

## Measured Inventory (2026-06-11, `src/`)

| Target | Files | Refs | Disposition | Owning phase |
|--------|-------|------|-------------|--------------|
| `#07080a` cold base | 5 | 6 | Replace → `--numen-bg` | each surface rebuild |
| `#FF7F50` coral | 17 | 35 | Replace → `--numen-accent` | each surface rebuild |
| `GlassPanel` | 10 | — | Replace → rare Glass primitive | each surface rebuild |
| `coral-` / `--color-coral` | 7 | — | Map → `--numen-accent` | each surface rebuild |
| `framer-motion` | 4 | — | Defer (`motion` for new code) | later surface rebuild (D-10) |
| `TrafficLights` | 5 | 33 | Retire | Phase 5 (shell) |
| chat dock | 4 | — | Absorb into thread | Phase 4/5 |

Counts matched Research Q8 pre-measured file counts exactly — no drift in file counts (line-ref totals reported alongside).

## Key Finding — chat dock located (Q8 caveat resolved)

Research Q8's narrow grep returned **0 hits** for `chat-dock`/`ChatDock` and flagged it for widening. The widened grep (`chat.*dock\|ChatDock\|chat-dock\|chat.*drawer\|chat.*panel`) **found it**:
- `src/components/command-bar/CommandBar.tsx` — header comment self-describes as **"bottom-pinned dock"** rendering a **"unified expert chat panel"**.
- `src/components/command-bar/ExpertChatThread.tsx`, `ExpertChatInput.tsx`.
- `src/hooks/queries/use-expert-chat.ts`.
- Mounted in `src/components/board/Board.tsx`.

Recorded as 4 files with disposition "absorb into the thread, Phase 4/5" — no "flag-to-locate" placeholder needed.

## Deviations from Plan

None — plan executed exactly as written. Counts re-run (not copied); chat-dock grep widened before recording. Nothing live deleted; `git status --porcelain src/` empty for this plan.

## Verification

- `test -f docs/numen-migration-boundary.md && grep Disposition && grep "delete nothing" && grep TrafficLights && grep GlassPanel` → "boundary doc ok"
- All 7 targets present in doc (07080a, FF7F50, GlassPanel, coral-, framer-motion, TrafficLights, chat dock).
- `git status --porcelain src/` → 0 changes (D-04 audit-only confirmed).

## Self-Check: PASSED
- FOUND: docs/numen-migration-boundary.md
- FOUND: commit 7c36b82e
