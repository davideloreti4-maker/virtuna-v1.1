---
phase: 05
plan: 01
subsystem: board/cross-group-state + test-scaffolding
tags: [phase-5, foundation, cross-group-state, test-scaffolding, deps, wave-0]
dependency_graph:
  requires: []
  provides:
    - react-markdown@^10.1.0 + rehype-sanitize@^6.0.0 (runtime deps for Plan 5.2)
    - src/components/board/cross-group-state.ts (useAntiViralityAffectedFrames + getFrameAntiViralityState)
    - src/components/board/verdict/__tests__/fixtures/prediction-result.ts (8 PredictionResult fixtures)
    - Wave 0 test stubs for all Phase 5 downstream plans (13 files)
  affects:
    - src/components/board/Board.tsx (deriveFrameVisual delegated to cross-group-state)
tech_stack:
  added:
    - react-markdown: ^10.1.0
    - rehype-sanitize: ^6.0.0
  patterns:
    - AFFECTED_FRAMES Record<CrossGroupSignal, Set<GroupId>> extendable pattern (D-24)
    - FrameVisualState imported from GroupFrame.tsx (not board-types.ts — see deviation note)
key_files:
  created:
    - src/components/board/cross-group-state.ts
    - src/components/board/__tests__/cross-group-state.test.ts
    - src/components/board/__tests__/Board.cross-group.test.tsx
    - src/components/board/verdict/__tests__/fixtures/prediction-result.ts
    - src/components/board/verdict/__tests__/VerdictNode.test.tsx
    - src/components/board/verdict/__tests__/PercentileChip.test.tsx
    - src/components/board/verdict/__tests__/AntiViralityHeader.test.tsx
    - src/components/board/verdict/__tests__/AntiViralityHeader.override.test.tsx
    - src/components/board/verdict/__tests__/assembleReasoningBuckets.test.ts
    - src/components/board/verdict/__tests__/VsHistoryCollapsible.test.tsx
    - src/components/board/verdict/__tests__/use-comparisons.test.ts
    - src/components/board/actions/__tests__/ActionsNode.test.tsx
    - src/components/board/actions/__tests__/PlaceholderCard.test.tsx
    - src/components/board/actions/__tests__/SimilarVideosCard.test.tsx
    - src/components/board/actions/__tests__/SimilarVideosCard.empty.test.tsx
    - src/components/board/content-analysis/__tests__/HookDecompNode.test.tsx
    - src/components/board/content-analysis/__tests__/EmotionArcNode.test.tsx
  modified:
    - src/components/board/Board.tsx (deriveFrameVisual refactored to delegate to getFrameAntiViralityState)
    - package.json (react-markdown + rehype-sanitize added to dependencies)
    - pnpm-lock.yaml (lockfile updated)
decisions:
  - "FrameVisualState imported from ./GroupFrame (not ./board-types as plan specified — actual export location)"
  - "npm install failed (pnpm node_modules structure); used pnpm add instead"
  - "anti_virality_reason fixture value corrected from 'low_confidence' to 'confidence' (actual type discriminant)"
metrics:
  completed: "2026-05-28"
  tasks: 4
  commits: 4
  files_created: 17
  files_modified: 3
---

# Phase 5 Plan 1: Wave 0 Foundation Summary

Wave 0 foundation: markdown deps installed, Board.tsx anti-virality hard-coded frame check extracted into reusable cross-group-state.ts selector module, Wave 0 test stubs + PredictionResult fixtures created for all downstream Phase 5 plans.

## What Was Built

### Task 1: Install react-markdown + rehype-sanitize
- **Installed:** `react-markdown@10.1.0` + `rehype-sanitize@6.0.0` via `pnpm add`
- **Note:** Project uses pnpm (pnpm-lock.yaml present, node_modules/.pnpm structure). `npm install` failed with arborist crash on pnpm-managed node_modules. Used `pnpm add` per CLAUDE.md preference "pnpm or npm".
- Both added to `dependencies` (not devDependencies — runtime client-side render).

### Task 2: cross-group-state.ts
- `useAntiViralityAffectedFrames()` — Zustand selector, returns `Set<GroupId>(['verdict', 'audience', 'actions'])` when boardState is `'anti-virality'`, empty Set otherwise.
- `getFrameAntiViralityState(frameId, boardState)` — pure function resolving `FrameVisualState` via `AFFECTED_FRAMES` record (D-24 extendable pattern).
- **FrameVisualState source:** Imported from `./GroupFrame` (not `./board-types` as plan specified). Actual export location confirmed by grep. No deviation needed — same type, different module.
- **14 unit tests pass** (all board states × all frame ids).

### Task 3: Board.tsx refactor
- `deriveFrameVisual` now a thin pass-through: `return getFrameAntiViralityState(frameId, boardMachineState);`
- Import added: `import { getFrameAntiViralityState } from './cross-group-state';`
- Inline `frameId === 'verdict' || frameId === 'audience'` check removed.
- **3 Board.cross-group integration tests pass:**
  - AV propagates to verdict + audience + actions
  - Non-affected frames (input/engine/content-analysis) return 'complete' during AV
  - Board.tsx source assertion: inline literal check absent
- TypeScript: 0 errors in modified files.

### Task 4: PredictionResult fixture + 13 Wave 0 stubs
- **Fixture** `src/components/board/verdict/__tests__/fixtures/prediction-result.ts`:
  - 8 named variants: `complete`, `antiVirality`, `lowConfidence`, `emptyHookDecomp`, `emptyEmotionArc`, `emptyRetrievalEvidence`, `historyEmpty`, `historyFull`
  - `comparisonsFixtures`: `empty`, `partial`, `full`, `fullWithNiche`
  - Typechecks clean against actual `PredictionResult` interface
  - Additional required fields populated beyond plan spec: `behavioral_predictions`, `feature_vector`, `predicted_engagement`, `suggestions`, `rule_score`, `trend_score`, `gemini_score`, `behavioral_score`, `ml_score`, `score_weights`, `latency_ms`, `cost_cents`, `engine_version`, `gemini_model`, `deepseek_model`, `input_mode`, `has_video`, `persona_behavioral_aggregate`, `persona_simulation_results`, `heatmap`, full `RetrievalEvidenceItem` shape (source_pool, source_id, likes, shares, comments, saves, hashtags, posted_at, bucket_label, bucket_source, relaxed_to)
- **13 stub files** created (all with `it.todo()`): verdict (7) + actions (4) + content-analysis (2)
- All stubs run as pending (0 failures)

## Deviations from Plan

### [Rule 1 - Bug] FrameVisualState export location mismatch
- **Found during:** Task 2
- **Issue:** Plan specified `import type { FrameVisualState } from './board-types'` but `FrameVisualState` is not exported from `board-types.ts` — it lives in `GroupFrame.tsx`.
- **Fix:** Import from `./GroupFrame` instead. Same type, correct source.
- **Files modified:** `src/components/board/cross-group-state.ts`

### [Rule 1 - Bug] npm install incompatible with pnpm node_modules
- **Found during:** Task 1
- **Issue:** `npm install` crashed with arborist null-reference error on pnpm-managed `node_modules/.pnpm` structure.
- **Fix:** Used `pnpm add` (project's active package manager, per pnpm-lock.yaml).
- **Files modified:** `package.json`, `pnpm-lock.yaml` (not `package-lock.json` — none exists)

### [Rule 1 - Bug] anti_virality_reason fixture value incorrect
- **Found during:** Task 4 TypeScript check
- **Issue:** Plan template used `'low_confidence'` which is not in the actual discriminant union `"confidence" | "timeline_pattern" | "both" | null`.
- **Fix:** Changed to `'confidence'` (correct discriminant for the low-confidence AV trigger case).
- **Files modified:** `src/components/board/verdict/__tests__/fixtures/prediction-result.ts`

## Output Spec Answers (for SUMMARY)

1. **Exact versions installed:** `react-markdown@10.1.0`, `rehype-sanitize@6.0.0`
2. **FrameVisualState source:** Already exported from `GroupFrame.tsx` (not from `board-types.ts`). Import adjusted.
3. **useBoardStore reset in tests:** `useBoardStore.setState({ boardState: 'idle' })` — direct setState (Zustand supports this for testing; no dedicated reset action was needed).
4. **Additional PredictionResult fields populated:** behavioral_predictions, feature_vector, predicted_engagement, suggestions, rule_score, trend_score, gemini_score, behavioral_score, ml_score, score_weights (all required by interface); also full RetrievalEvidenceItem shape (source_pool, source_id, likes, shares, comments, saves, hashtags, posted_at, bucket_label, bucket_source, relaxed_to).
5. **Refactor verification:** `grep -v "^[[:space:]]*//" src/components/board/Board.tsx | grep -c "frameId === 'verdict'"` → **0** (confirmed).

## Known Stubs

All 13 stub files are intentional Wave 0 placeholders. Each contains `it.todo()`. They will be filled by downstream Phase 5 plans (5.2-5.8) when their respective components land.

## Tests Passing

- cross-group-state.test.ts: **14/14** pass
- Board.cross-group.test.tsx: **3/3** pass
- Wave 0 stubs: **13 files, 0 failures** (all `todo`)
- TypeScript: **0 errors** in all created/modified files

## Self-Check: PASSED

All created files verified to exist. All commits verified in git log.
