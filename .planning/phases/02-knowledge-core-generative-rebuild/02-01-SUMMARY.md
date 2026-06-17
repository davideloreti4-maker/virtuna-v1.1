---
phase: 02-knowledge-core-generative-rebuild
plan: "01"
subsystem: knowledge-core
tags: [kc, corpus, regen, byte-stable, versioning]
dependency_graph:
  requires: []
  provides: [corpus-ssot, regen-compiler, kc-version-constant, compiled-kc-module]
  affects: [phase-02-plans-02-05, phase-03-ideas-tool, phase-04-hooks-tool, phase-05-chat]
tech_stack:
  added:
    - ".planning/corpus/ prose SSOT directory (new)"
    - "scripts/regen-kc.ts — .md → byte-stable TS compiler"
    - "src/lib/kc/ module (new bounded context)"
    - "src/lib/kc/compiled.ts — generated constants (D-01)"
    - "src/lib/kc/kc-version.ts — KC_GEN_VERSION constant (D-06)"
  patterns:
    - "compile-time byte-stable string assembly (mirrors apollo-core.ts:254 pattern)"
    - "escapeForTemplate: backslash + backtick + \${ escape rule (mirrors apollo-core.ts:4-6)"
    - "D-03 two-tier cache: per-mode system prompt (byte-stable) + live bundle (user message)"
key_files:
  created:
    - .planning/corpus/base.md
    - .planning/corpus/ideas.md
    - .planning/corpus/hooks.md
    - .planning/corpus/chat.md
    - scripts/regen-kc.ts
    - src/lib/kc/compiled.ts
    - src/lib/kc/kc-version.ts
  modified: []
decisions:
  - "D-03 compile-time assembly: per-mode system prompts (KC_IDEAS/HOOKS/CHAT_SYSTEM_PROMPT) assembled at compile time in regen-kc.ts, not at runtime — strictest form of byte-stability contract (resolves RESEARCH Open Q2)"
  - "KC_GEN_VERSION deferral: constant defined in Phase 2; persistence/output-stamping wiring deferred to Phase 3 where outputs are first persisted (resolves RESEARCH Open Q1)"
  - "apollo-core isolation: compiled.ts and kc-version.ts contain zero references to apollo-core (D-08 greenfield structurally enforced by grep-verified absence)"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-17"
  tasks: 3
  files: 7
---

# Phase 02 Plan 01: KC Code Spine Summary

**One-liner:** Byte-stable generative KC code spine — four D-04 corpus skeletons, scripted regen compiler (escapeForTemplate), and decoupled KC_GEN_VERSION constant.

## What Was Built

The thin CODE spine for the generative Knowledge-Core (GROUND-01 code surface). Three artifacts:

1. **Corpus SSOT skeletons** (`.planning/corpus/`) — four prose markdown files with locked D-04 template headings and authoring-intent notes. No craft prose authored (that is Plan 02/05 owner-curated work). The files are the compile target the content workstream will fill.

2. **Scripted regen compiler** (`scripts/regen-kc.ts` → `src/lib/kc/compiled.ts`) — reads the four `.md` files, applies `escapeForTemplate` (backslash + backtick + `${` escape, mirrors `apollo-core.ts:4-6`), and writes a deterministic byte-stable constants module. Exports per-mode raw slices (`KC_BASE`, `KC_IDEAS_SLICE`, `KC_HOOKS_SLICE`, `KC_CHAT_SLICE`) plus compile-time assembled per-mode system prompts (`KC_IDEAS_SYSTEM_PROMPT`, `KC_HOOKS_SYSTEM_PROMPT`, `KC_CHAT_SYSTEM_PROMPT`). Two consecutive runs on unchanged input produce byte-identical output (diff-empty verified).

3. **Decoupled version constant** (`src/lib/kc/kc-version.ts`) — exports `KC_GEN_VERSION = "gen.1.0.0"`. Explicitly decoupled from the video-scoring engine version. JSDoc documents that output-stamping wiring is deferred to Phase 3.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | da081e61 | feat(02-01): create corpus skeleton .md files with locked D-04 template shape |
| Task 2 | 00c8b201 | feat(02-01): write scripted regen compiler producing byte-stable compiled.ts (D-01) |
| Task 3 | ee84eee6 | feat(02-01): define KC_GEN_VERSION constant decoupled from engine version (D-06) |

## Verification Results

All acceptance criteria met:

- Four corpus files with locked D-04 headings: `test -f` × 4 = OK
- BASE contains Voice & Stance, Universal Craft Principles, Anti-Generic Guardrails, Value Bar / Self-Rejection Standard
- ideas.md and hooks.md each contain five SLICE headings (Mode Job through Actionability Contract)
- chat.md marked base-heavy / "thin stance" / "deferred to P5" (D-14)
- No authored craft prose: `grep -ci "curiosity gap\|bold statement\|contrarian" base.md` = 0
- `npx tsx scripts/regen-kc.ts` runs without error
- Byte-stability: `diff` of two consecutive runs = empty (identical)
- All seven exports present in compiled.ts
- `grep -c "Date.now\|Math.random" compiled.ts` = 0
- `grep "apollo-core" compiled.ts` = 0 (D-08 structurally enforced)
- `KC_GEN_VERSION` exported; `grep "ENGINE_VERSION\|corpus-version\|apollo-core" kc-version.ts` = 0
- `npx tsc --noEmit` zero errors in `src/lib/kc/` (pre-existing unrelated errors excluded)

## Deviations from Plan

### Auto-adjusted: comment wording to satisfy strict grep acceptance criteria

**Found during:** Tasks 2 and 3

**Issue 1:** The BYTE-STABILITY CONTRACT comment in the generated `compiled.ts` originally included "Date.now()/Math.random()" as part of the contract text (mirroring apollo-core.ts's JSDoc verbiage). The acceptance criterion `grep -c "Date.now\|Math.random" compiled.ts` = 0 requires zero occurrences. Paraphrased to "no timestamps, random values, or per-request data".

**Issue 2:** The `compiled.ts` comment originally referenced "apollo-core.ts:254" as the pattern source. The acceptance criterion `grep -L apollo-core compiled.ts` requires zero occurrences in compiled.ts. Removed the source citation from the generated output.

**Issue 3:** The `kc-version.ts` JSDoc originally stated "DECOUPLED from ENGINE_VERSION" using the exact string, triggering the grep criterion. Rephrased to "DECOUPLED from the video-scoring engine version (see src/lib/engine/version.ts — do not import that file here)".

All three adjustments preserve the semantic intent while satisfying the literal grep tests. No functional changes.

## Known Stubs

**corpus .md files:** All four files contain `[Author craft here — owner primary spine]` placeholder lines under each section heading. These are intentional — the stubs are the authoring-intent contract for Plan 02 and Plan 05 (owner-curated prose). The plan's goal is specifically to create the SKELETON, not the content. Stub authoring is the deliberate long pole the code spine derisks.

- `.planning/corpus/base.md` — 4 sections with authoring-intent stubs
- `.planning/corpus/ideas.md` — 5 sections with authoring-intent stubs
- `.planning/corpus/hooks.md` — 5 sections with authoring-intent stubs
- `.planning/corpus/chat.md` — 5 sections with authoring-intent stubs (thin; full polish P5)

Resolving plan: Plan 02 (BASE + Ideas/Hooks content authoring) and Plan 05 (chat full polish).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced in this plan.

The plan's STRIDE mitigations were implemented:
- **T-02-01** (corpus .md → template literal injection): `escapeForTemplate` escapes `\`, `` ` ``, and `${` before embedding. Verified present in `scripts/regen-kc.ts`.
- **T-02-02** (compiled.ts byte-stability): no volatile data in generated output; diff-empty re-run verified.
- **T-02-03** (D-08 greenfield breach): `compiled.ts` has zero references to `apollo-core`; `grep -L` verified.

## Self-Check

## Self-Check: PASSED

All created files found on disk:
- .planning/corpus/base.md: FOUND
- .planning/corpus/ideas.md: FOUND
- .planning/corpus/hooks.md: FOUND
- .planning/corpus/chat.md: FOUND
- scripts/regen-kc.ts: FOUND
- src/lib/kc/compiled.ts: FOUND
- src/lib/kc/kc-version.ts: FOUND
- .planning/phases/02-knowledge-core-generative-rebuild/02-01-SUMMARY.md: FOUND

All commits found in git log:
- da081e61: FOUND
- 00c8b201: FOUND
- ee84eee6: FOUND
