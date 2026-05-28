---
phase: 18-m1-verification-debt-closure
plan: "02"
subsystem: engine
tags:
  - verification
  - timer-leak
  - code-review-followup
  - in-01
  - verif-04
dependency_graph:
  requires: []
  provides:
    - VERIF-04/IN-01 closed
    - Leak-free timer handling in deepseek.ts and rules.ts
  affects:
    - src/lib/engine/deepseek.ts
    - src/lib/engine/rules.ts
tech_stack:
  added: []
  patterns:
    - clearTimeout in both try and catch paths of AbortController+setTimeout guard
key_files:
  modified:
    - src/lib/engine/deepseek.ts
    - src/lib/engine/rules.ts
decisions:
  - Kept getQwenClient() inside the try block in rules.ts so missing-API-key error remains catchable (preserves test coverage for semantic-eval fallback path)
  - Hoisted only controller+timeout above try in rules.ts (not ai) — matching test expectations
  - deepseek.ts hoists controller+timeout+ai above try (ai was already outside try in that file's original structure after hoist)
metrics:
  duration: 138s
  completed: "2026-05-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 18 Plan 02: Timer Leak Fix (VERIF-04/IN-01) Summary

Fix timer leaks in `deepseek.ts` and `rules.ts` — `clearTimeout(timeout)` now runs in both the try path (already present) and the catch path (was missing). VERIF-04 sub-item IN-01 closed.

## Note on Dead gemini.ts Reference

The original IN-01 reference pointed to `analyzeVideoWithGemini` in `gemini.ts`. That file was deleted during the M1 Qwen migration — `analyzeVideoWithGemini` was replaced by `analyzeVideoWithOmni` in `qwen/omni-analysis.ts`, which already handles timers correctly (lines 129-225 of that file use the correct hoisted pattern). This reference is resolved by migration, not by code change.

## Task 1: deepseek.ts Timer Fix

**Commit:** 26d1697

### Before

```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    // ...
    clearTimeout(timeout);  // only in try path
    return { reasoning, cost_cents };
  } catch (error) {
    // clearTimeout MISSING — timer leaked on every throw
    lastError = error instanceof Error ? error : new Error(String(error));
```

### After

```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // ...
    clearTimeout(timeout);  // in try path (unchanged)
    return { reasoning, cost_cents };
  } catch (error) {
    clearTimeout(timeout);  // NEW: first statement in catch
    lastError = error instanceof Error ? error : new Error(String(error));
```

## Task 2: rules.ts Timer Fix

**Commit:** 26d1697 (same commit)

### Before

```typescript
try {
  const ai = getQwenClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEMANTIC_TIMEOUT_MS);
  // ...
  clearTimeout(timeout);  // only in try path
  return result.data.evaluations;
} catch (error) {
  // clearTimeout MISSING — timer leaked on every throw
  log.warn("Semantic evaluation failed, falling back to regex-only", {
```

### After

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), SEMANTIC_TIMEOUT_MS);

try {
  const ai = getQwenClient();  // kept inside try so missing-key error is caught
  // ...
  clearTimeout(timeout);  // in try path (unchanged)
  return result.data.evaluations;
} catch (error) {
  clearTimeout(timeout);  // NEW: first statement in catch
  log.warn("Semantic evaluation failed, falling back to regex-only", {
```

## Verification Output

### Acceptance Criteria

| Check | Result |
|-------|--------|
| `grep -cE 'clearTimeout\(timeout\)' src/lib/engine/deepseek.ts` | 2 |
| `grep -cE 'clearTimeout\(timeout\)' src/lib/engine/rules.ts` | 2 |
| deepseek.ts catch first statement is `clearTimeout(timeout)` | PASS |
| rules.ts catch first statement is `clearTimeout(timeout)` | PASS |
| `pnpm exec tsc --noEmit` | 0 errors |
| `pnpm vitest run` | 966 passed, 0 failed |

### tsc Output

```
TypeScript: No errors found
```

### vitest Output

```
PASS (966) FAIL (0)
```

## Deviations from Plan

**1. [Rule 1 - Bug] Kept getQwenClient() inside try block in rules.ts**

- **Found during:** Task 2 verification
- **Issue:** Plan's structural example hoisted `const ai = getQwenClient()` above try. When applied literally, the missing-API-key test (`scoreContentAgainstRules — scoring handles semantic tier rules (without API, defaults to empty)`) failed because the thrown error escaped the catch block.
- **Fix:** Hoisted only `controller` and `timeout` above try; kept `ai = getQwenClient()` as first statement inside try. This preserves the existing catch-all behavior for initialization errors and keeps the test green.
- **Files modified:** `src/lib/engine/rules.ts`
- **Commit:** 26d1697

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Changes are purely structural (variable scope within existing functions).

## Self-Check: PASSED

- `src/lib/engine/deepseek.ts` exists with 2x `clearTimeout(timeout)`: FOUND
- `src/lib/engine/rules.ts` exists with 2x `clearTimeout(timeout)`: FOUND
- Commit 26d1697 exists: FOUND
- tsc: no errors
- vitest: 966 passed, 0 failed
