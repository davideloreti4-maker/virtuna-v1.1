---
phase: 02-knowledge-core-generative-rebuild
plan: "02"
subsystem: knowledge-core
tags: [assembler, profile-role-map, grounding, injection-fence, cold-start, tdd]
dependency_graph:
  requires: [02-01-SUMMARY.md]
  provides: [PROFILE_ROLE_MAP, AssemblerInput, MODE_ROLES, assembleBundle, BUNDLE_CHAR_CAP]
  affects: [src/lib/kc/assembler.ts, src/lib/kc/profile-role-map.ts, src/lib/kc/assembler.test.ts]
tech_stack:
  added: []
  patterns: [semantic-role-map, injection-fence, cold-start-degradation, per-mode-field-filter, hard-length-cap]
key_files:
  created:
    - src/lib/kc/profile-role-map.ts
    - src/lib/kc/assembler.ts
    - src/lib/kc/assembler.test.ts
  modified: []
decisions:
  - "BUNDLE_CHAR_CAP=4000 chars (placeholder) — tune post-authoring after BASE+Ideas slice exist (Plan 03), sized so live tier < warm cached prefix"
  - "A4 resolved: runner knowledgeBundle = static slice-binding; assembleBundle output = per-request volatile user message (never mutate module-level runner const)"
  - "Wins/flops surfaced as creator-reported/directional in v1 — no scraped content, no fabricated mechanism (honesty spine, RESEARCH 4B)"
  - "Injection fence applied to ask/overrides/anchor via <<<USER_CONTENT>>> + sentinel-strip on input"
metrics:
  duration: "5m"
  completed: "2026-06-17"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 02 Plan 02: Live-Tier Assembler (GROUND-02) Summary

**One-liner:** Per-request live-tier assembler with per-mode role filtering, hard char cap, cold-start honest degradation, and injection fence over six semantic roles isolated in a profile-role-map lookup.

## What Was Built

### Task 1: PROFILE_ROLE_MAP — semantic-role profile lookup (D-05)

`src/lib/kc/profile-role-map.ts` exports:
- `Role` union type: `"niche" | "audience" | "goals" | "wins" | "flops" | "platform"`
- `ProfileRow` interface — narrow type covering only the columns the map reads
- `PROFILE_ROLE_MAP: Record<Role, (row: ProfileRow) => string | null>` — six null-guarded formatting functions

Column knowledge isolation: niche = `niche_primary + niche_sub`; audience = `target_audience` JSON formatted as age/gender/geo/language parts; goals = `primary_goal + creator_stage`; wins/flops = `past_wins`/`past_flops` count with "creator-reported, directional" caveat; platform = `target_platforms[0]` (per-request param wins, applied by the assembler per D-07).

All six roles emit `null` when the relevant columns are absent — omits silently per `creator.ts:299-353` precedent.

### Task 2: assembler.ts + assembler.test.ts — TDD (RED → GREEN)

`src/lib/kc/assembler.ts` exports:
- `AssemblerInput` (zod-inferred type) — `{ask, platform, mode, overrides?, anchor?}` (D-05 input shape, D-07 forward-wire)
- `assemblerInputSchema` — zod validator applied at the `assembleBundle` function boundary
- `MODE_ROLES: Record<mode, Role[]>` — per-mode role declarations:
  - `idea`: `[niche, audience, goals, wins, flops, platform]`
  - `hooks`: `[niche, audience, platform, wins, flops]`
  - `chat`: `[niche, audience, platform]`
- `BUNDLE_CHAR_CAP = 4000` — named hard cap constant with tuned-post-authoring comment
- `assembleBundle(input, profileRow)` — main function returning the volatile user message string

`src/lib/kc/assembler.test.ts` — 25 tests across six behavior groups:
1. `MODE_ROLES` structure — correct role lists per mode
2. Per-mode role filtering — mode output contains/excludes declared roles
3. Role-leak guard — chat mode never emits goals/wins/flops
4. Hard length cap — bundle ≤ `BUNDLE_CHAR_CAP`; no mid-field truncation
5. Cold-start degradation — null/thin profile → honest `"using {platform} baseline"` flag
6. Injection fence — ask/overrides/anchor always inside `<<<USER_CONTENT>>>` delimiters
7. Wins/flops honesty spine — "creator-reported, directional" language present

## Architectural Split (RESEARCH A4 Resolved)

Per the module doc comment:

- `ToolRunner.knowledgeBundle` (static runner const) = **static slice-binding** — which compiled KC slice this tool uses. Module-level constant. Never mutated per-request.
- `assembleBundle(input, profileRow)` output = **per-request live grounding** — the volatile USER MESSAGE for the Qwen call alongside the byte-stable `KC_<MODE>_SYSTEM_PROMPT`.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `BUNDLE_CHAR_CAP = 4000` (tuned post-authoring) | Placeholder sized conservatively; resize after BASE+Ideas slice authored in Plan 03 so live bundle stays << warm prefix size (D-03) |
| Profile roles drop tail-first past cap (not truncated mid-field) | Complete fields are less confusing to the model than a half-formatted role entry |
| `ProfileRow` narrow interface (not full `Database["public"]["Tables"]["creator_profiles"]["Row"]`) | Keeps the surface isolated; avoids importing database types into the kc module |
| Zod validation at `assembleBundle` function boundary | CLAUDE.md: "validate input at system boundaries"; catches bad mode/platform enum values early |
| `assemblerInputSchema` exported (not just the type) | Allows callers (P3 tool routes) to reuse the validator; D-07 forward-wire |

## Deviations from Plan

None — plan executed exactly as written. The one inline fix: test heuristic for "no mid-field truncation" was refined from "no line ending in colon" (incorrect — label lines end in colon) to "no bare role-label line without value". This is a test correctness adjustment, not a deviation from plan behavior.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `BUNDLE_CHAR_CAP = 4000` | `src/lib/kc/assembler.ts` | ~34 | Placeholder value; must be tuned post-authoring after BASE+Ideas slice sizes are known (Plan 03 pilot). The constant is named and documented with a tuned-post-authoring comment — not a hidden assumption. |
| Wins/flops: count + directional caveat only | `src/lib/kc/profile-role-map.ts` | ~86, ~102 | v1 stores only URLs, no scraped content. Full enrichment deferred to v6.1 (PROFILE-01 / RAG). Honesty spine preserved — no fabricated mechanism. |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — failing tests | `23a10f4d` | PASS — suite failed (module not found) |
| GREEN — all tests pass | `ac56904e` | PASS — 25/25 tests pass |
| REFACTOR | N/A | Code was clean on GREEN; no refactor needed |

## Self-Check

Verified before writing summary:

| Check | Result |
|-------|--------|
| `src/lib/kc/profile-role-map.ts` exists | FOUND |
| `src/lib/kc/assembler.ts` exists | FOUND |
| `src/lib/kc/assembler.test.ts` exists | FOUND |
| commit `acaa3b5c` (Task 1) | FOUND |
| commit `23a10f4d` (RED) | FOUND |
| commit `ac56904e` (GREEN) | FOUND |
| 25 assembler tests pass | PASS |
| Engine suite (1043 tests) green | PASS |

## Self-Check: PASSED
