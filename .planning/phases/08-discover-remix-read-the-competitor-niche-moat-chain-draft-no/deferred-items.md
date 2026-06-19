# Deferred Items — Phase 08

Out-of-scope discoveries logged during execution (not fixed — outside the current task's change surface).

## Pre-existing tsc errors in test files (discovered during 08-04)

`pnpm exec tsc --noEmit` reports ~43 errors confined to TEST files that predate this plan and are unrelated to the 08-04 steer-closure change surface. Runtime tests pass (vitest does not typecheck). Not fixed (scope boundary — only the 2 errors introduced in the new 08-04 test file were corrected).

Representative pre-existing offenders:
- `src/lib/tools/runners/__tests__/hooks-runner.test.ts` — `user_id` not on `ProfileRow` (2)
- `src/lib/tools/runners/__tests__/script-runner.test.ts` — `user_id` not on `ProfileRow` (1)
- `src/lib/tools/runners/__tests__/ideas-runner.test.ts` — `user_id` not on `ProfileRow` (1)
- `src/lib/threads/__tests__/messages.test.ts` (12)
- `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` (5)
- `src/lib/engine/flash/__tests__/flash-aggregate.test.ts` (5)
- assorted flash/fold-schema + component test fixtures (remainder)

Recommendation: a dedicated test-types cleanup pass (align test `ProfileRow` fixtures with the current interface). Does not block phase 08.
