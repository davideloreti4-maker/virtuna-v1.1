# Phase 01 — Deferred Items

Items discovered during execution that are out-of-scope for the current plan but should be addressed in a future phase or maintenance pass.

## TypeScript / Test Runner Infrastructure (pre-existing, unrelated to Plan 01-01)

**Discovered during:** Plan 01-01 Task 1 baseline tsc run.

**Issue:** `pnpm exec tsc --noEmit` reports 743 errors across 12 test files in `src/lib/engine/__tests__/`. All errors are `TS2304` ("Cannot find name 'expect'") and `TS2582` ("Cannot find name 'describe'/'it'") — vitest globals are not exposed to the TypeScript compiler.

**Verified:** Errors exist BEFORE the framer-motion alias was added. The Plan 01-01 changes (override + 4-file framer-motion → motion/react migration) added ZERO new tsc errors.

**Root cause:** `tsconfig.json` does not include `"types": ["vitest/globals"]` (or equivalent triple-slash directive in test files). Plan 01-01's `pnpm exec tsc --noEmit` acceptance gate is unsatisfiable from baseline.

**Suggested fix (future phase):** Add `"types": ["vitest/globals"]` to `tsconfig.json` compilerOptions, OR add `import { describe, it, expect, vi, beforeEach } from "vitest"` to each affected test file, OR add a separate `tsconfig.test.json` and exclude `__tests__/` from main tsconfig.

**Affected files (12):**
- src/lib/engine/__tests__/calibration.test.ts
- src/lib/engine/__tests__/cost-benchmark.test.ts
- src/lib/engine/__tests__/cost-calculation.test.ts
- src/lib/engine/__tests__/creator.test.ts
- src/lib/engine/__tests__/deepseek.test.ts
- src/lib/engine/__tests__/fuzzy.test.ts
- src/lib/engine/__tests__/gemini.test.ts
- src/lib/engine/__tests__/pipeline.test.ts
- src/lib/engine/__tests__/rules.test.ts
- src/lib/engine/__tests__/setup.test.ts
- src/lib/engine/__tests__/trends.test.ts
- src/lib/engine/__tests__/video-e2e.test.ts

**Disposition:** Out of scope for Phase 01 (Foundation Scaffold) — this is a test-infrastructure cleanup unrelated to the landing page build. Defer to a maintenance pass or include in a later phase's cleanup task.
