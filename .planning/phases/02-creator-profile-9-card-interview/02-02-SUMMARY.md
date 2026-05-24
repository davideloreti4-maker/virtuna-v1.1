---
phase: 02-creator-profile-9-card-interview
plan: 02
subsystem: data-model
tags: [taxonomy, niches, typescript, vitest, tdd, pure-module]

requires:
  - phase: 01-training-corpus-eval-foundation
    provides: 5-niche corpus (beauty, fitness, education, comedy, lifestyle) used as the anchor for the primary niche list
provides:
  - "Hardcoded NICHE_TREE const (10 primaries × 8-12 sub-niches = 87 sub-niches)"
  - "Three lookup helpers: getNicheBranches, getPrimaryLabel, getSubLabel"
  - "Three exported types: NicheSubItem, NichePrimary, NicheTree"
  - "12 active Vitest assertions on tree shape + lookup + miss behavior"
affects:
  - 02-03 (Card 1 NichePicker — imports NICHE_TREE + getNicheBranches)
  - Phase 4 niche detector (CONTENT-02 — imports getNicheBranches)

tech-stack:
  added: []
  patterns:
    - "Pure TS const tree (no I/O, no fetch, no process.env, no Supabase import) shareable by client + server"
    - "Slug rule: /^[a-z0-9]+(-[a-z0-9]+)*$/ (lowercase + hyphen, no underscores, no uppercase)"
    - "Type-only assertion (`const _typeCheck: NicheTree = NICHE_TREE; void _typeCheck`) catches shape drift at compile time"

key-files:
  created:
    - src/lib/niches/taxonomy.ts
    - src/lib/niches/__tests__/taxonomy.test.ts
  modified: []

key-decisions:
  - "Slash labels (Coding/Programming, Nutrition/Diet, etc.) become spaced in display (`Coding / Programming`) but hyphen-compressed in slugs (`coding-programming`)"
  - "Fashion & Style rounded from 7 to 8 with 'Outfit Inspiration' (planner spec)"
  - "Music & Performance rounded from 6 to 8 with 'Live Performance' + 'Music Tutorials' (planner spec)"
  - "Sub-niche 'tutorials' and 'hauls' intentionally repeat across primaries (Beauty/Tech-Gadgets share 'tutorials'; Beauty/Lifestyle share 'hauls') — sub-slugs are scoped to their primary, not globally unique"
  - "Pure module: zero runtime side effects — safe to import in both client cards and Phase 4 server-side niche detector"

patterns-established:
  - "NICHE_TREE shape — every primary is { slug, label, subs[] } where each sub is { slug, label }; downstream consumers (Card 1 NichePicker, Phase 4 detector) destructure via getNicheBranches(primarySlug)"
  - "Slug derivation — lowercase + hyphen-separated for storage/equality checks; human label preserves punctuation (with spaces around `/`)"

requirements-completed:
  - PROFILE-04

duration: ~4min
completed: 2026-05-17
---

# Phase 02 Plan 02: Niche Taxonomy Module Summary

**Hardcoded 2-level niche tree (10 primaries × 8-12 sub-niches) shared by Card 1 NichePicker and the future Phase 4 niche detector, with 12 active Vitest assertions on shape and lookup behavior.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-17T19:55:00Z
- **Completed:** 2026-05-17T19:59:45Z
- **Tasks:** 1 (TDD: RED → GREEN, no REFACTOR needed)
- **Files modified:** 2 (both created)

## Accomplishments

- `src/lib/niches/taxonomy.ts` — pure TS const tree exporting `NICHE_TREE`, three helper functions, and three types
- `src/lib/niches/__tests__/taxonomy.test.ts` — 12 active assertions (Wave 0 scaffold had `it.skip` placeholders; this plan was authored to create both files net-new since Plan 02-01 ran in parallel)
- Verification block satisfied: 12/12 tests green, 97 slug occurrences (≥ 90 required), all four required exports present, zero runtime side effects

## Task Commits

Each task was committed atomically (TDD: RED then GREEN, no REFACTOR needed):

1. **Task 1 RED** — `2434613` (test): add failing tests for niche taxonomy module
2. **Task 1 GREEN** — `d9990ff` (feat): implement hardcoded niche taxonomy module

_Plan metadata commit will be added with this SUMMARY.md (next commit in the chain)._

## Niche Tree Inventory

**10 primary slugs (locked):**

| # | Slug | Label | Sub-niche count |
|---|------|-------|-----------------|
| 1 | `beauty` | Beauty | 9 |
| 2 | `fitness` | Fitness | 10 |
| 3 | `education` | Education | 8 |
| 4 | `comedy` | Comedy | 9 |
| 5 | `lifestyle` | Lifestyle | 8 |
| 6 | `food-cooking` | Food & Cooking | 8 |
| 7 | `tech-gadgets` | Tech & Gadgets | 8 |
| 8 | `gaming` | Gaming | 8 |
| 9 | `fashion-style` | Fashion & Style | 8 |
| 10 | `music-performance` | Music & Performance | 8 |

**Total sub-niches: 87** (planner approved range: 80-120 across 10 primaries).

**All slugs pass `/^[a-z0-9]+(-[a-z0-9]+)*$/`** — asserted by `NICHE_TREE shape > all slugs are lowercase and hyphen-separated` test.

## Helper Signatures

```typescript
export function getNicheBranches(primarySlug: string): NicheSubItem[]
export function getPrimaryLabel(slug: string): string | null
export function getSubLabel(primarySlug: string, subSlug: string): string | null
```

Miss behavior:
- `getNicheBranches("nonexistent")` returns `[]`
- `getPrimaryLabel("nope")` returns `null`
- `getSubLabel("nope", "yoga")` returns `null` (unknown primary → guaranteed null, even if `yoga` exists under another primary)
- `getSubLabel("fitness", "nope")` returns `null`

## Slug Normalization Decisions

Per the planner-provided slug rule examples:

| Source label | Slug | Display label |
|--------------|------|---------------|
| "Skincare Reviews" | `skincare-reviews` | "Skincare Reviews" |
| "Get Ready With Me" | `get-ready-with-me` | "Get Ready With Me" |
| "Coding/Programming" | `coding-programming` | "Coding / Programming" |
| "Nutrition/Diet" | `nutrition-diet` | "Nutrition / Diet" |
| "Stand-Up Clips" | `stand-up-clips` | "Stand-Up Clips" |
| "Character/Persona" | `character-persona` | "Character / Persona" |
| "Tips/Tutorials" | `tips-tutorials` | "Tips / Tutorials" |
| "Drink/Cocktails" | `drink-cocktails` | "Drink / Cocktails" |
| "Food & Cooking" (primary) | `food-cooking` | "Food & Cooking" |
| "Tech & Gadgets" (primary) | `tech-gadgets` | "Tech & Gadgets" |
| "Fashion & Style" (primary) | `fashion-style` | "Fashion & Style" |
| "Music & Performance" (primary) | `music-performance` | "Music & Performance" |

Rule: forward slashes (`/`) become hyphens in slugs and become ` / ` (spaced) in labels. Ampersands (`&`) and hyphens (`-`) are preserved in labels but stripped from slugs (replaced with hyphen).

## Decisions Made

- **Sub-slug reuse across primaries** — `tutorials` and `hauls` intentionally appear under more than one primary. Sub-slugs are scoped by their primary; helper lookups always take `(primarySlug, subSlug)`. No collision risk because Card 1 NichePicker stores both `primary_niche_slug` and `sub_niche_slug` columns separately.
- **Padding decisions match planner spec** — Fashion & Style starts at 7 subs per RESEARCH.md seed (OOTD, Thrifting, Sustainable Fashion, Streetwear, Vintage, Capsule Wardrobes, Style Tips) and is padded with "Outfit Inspiration" to reach the 8-minimum. Music & Performance starts at 6 and gets "Live Performance" + "Music Tutorials".
- **No `it.skip` blocks remain** — Plan 02-02 ran in parallel to Plan 02-01 (which creates the migration). The Wave 0 scaffold mentioned in the plan's `<read_first>` lived in Plan 02-01's path; this worktree was net-new so both files were authored from scratch. All assertions are active.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules in worktree**
- **Found during:** Task 1 RED phase verification (`pnpm test` failed with `vitest: command not found`)
- **Issue:** Fresh worktree had `package.json` but no `node_modules/` — Vitest could not run
- **Fix:** Ran `pnpm install --prefer-offline --frozen-lockfile`
- **Files modified:** None tracked (node_modules is gitignored)
- **Verification:** `pnpm test --run src/lib/niches/__tests__/taxonomy.test.ts` then ran and produced the expected RED failure ("Cannot find package '@/lib/niches/taxonomy'")
- **Committed in:** N/A (no tracked files changed)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency install)
**Impact on plan:** None — install was a worktree-setup prerequisite, not a plan-content change. All planner-specified content (NICHE_TREE seed, helper signatures, test assertions) shipped verbatim.

## Issues Encountered

- None. RED test failed as expected (missing module). GREEN implementation passed all 12 assertions on first run. No fix iterations needed.

## TDD Gate Compliance

- **RED gate:** `2434613` (test: add failing tests for niche taxonomy module) — verified failing before implementation: 0 tests run, 1 suite failed with `Cannot find package '@/lib/niches/taxonomy'`
- **GREEN gate:** `d9990ff` (feat: implement hardcoded niche taxonomy module) — verified passing: 12/12 tests passed, 0 skipped
- **REFACTOR gate:** Skipped — implementation was minimal and already clean (data-only const tree + three trivial `find().X ?? null` helpers); nothing to extract or simplify
- Gate sequence asserted by `git log --oneline`: test commit precedes feat commit on this branch

## User Setup Required

None — this is a pure data module with no external service configuration.

## Threat Surface

Per the plan's `<threat_model>`:
- **T-02-01b (Tampering — slug shape):** mitigated by the slug regex test (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) in `src/lib/niches/__tests__/taxonomy.test.ts`. Any drift where a future contributor types a human label like "Stand-Up Clips" into a slug field will fail the test suite before merge.

No new threat surface introduced beyond the registered threat. Module performs no I/O.

## Known Stubs

None — all data is hardcoded and complete. No placeholder values, no TODO/FIXME, no empty arrays/objects awaiting wiring. Card 1 NichePicker (Plan 02-03) will consume `NICHE_TREE` directly.

## Next Phase Readiness

- **Plan 02-03 (Card 1 NichePicker, Wave 2)** can `import { NICHE_TREE, getNicheBranches, getPrimaryLabel, getSubLabel } from "@/lib/niches/taxonomy"` and compile against the locked shape.
- **Phase 4 niche detector (CONTENT-02, future phase)** can reuse the same module without modification — pure TS, no runtime dependencies.
- No blockers. No pending follow-ups.

## Self-Check: PASSED

- `src/lib/niches/taxonomy.ts` — FOUND
- `src/lib/niches/__tests__/taxonomy.test.ts` — FOUND
- Commit `2434613` (test RED) — FOUND in git log
- Commit `d9990ff` (feat GREEN) — FOUND in git log
- `pnpm test --run src/lib/niches/__tests__/taxonomy.test.ts` — PASSED (12/12, 0 skipped)
- Verification grep block — PASSED (97 slug occurrences ≥ 90, all required exports present, zero side-effects)

---
*Phase: 02-creator-profile-9-card-interview*
*Plan: 02 — Niche Taxonomy Module*
*Completed: 2026-05-17*
