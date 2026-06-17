---
phase: 01-engine-thread-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, rls, threads, messages, jsonb, typescript, database-types]

# Dependency graph
requires:
  - phase: 01-engine-thread-foundation/01-01
    provides: block-registry with validateBlock used by messages.ts rehydration guard
provides:
  - threads table (type discriminator, nullable reading_id text FK → analysis_results, partial UNIQUE index on reading_id)
  - messages table (body = typed-blocks JSONB array, thread_id FK, role constraint)
  - RLS on both tables mirroring analysis_chats pattern
  - createGroundedThreadLazy — idempotent upsert via onConflict reading_id
  - insertMessage — validate blocks at write boundary via validateBlock
  - loadMessages — rehydrate with per-block re-validation (UnsupportedBlock sentinel)
  - ThreadRow / MessageRow types derived from regenerated database.types.ts
affects: [01-03-flash-runner, 01-04-composer, all plans that persist messages to threads]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thread/message persistence: one JSONB row per message, blocks validated on write AND rehydration"
    - "Idempotent lazy grounded-thread create via upsert onConflict + ignoreDuplicates (D-15)"
    - "RLS messages policy: EXISTS subquery on threads (analysis_chats pattern)"
    - "Row types derived from Database['public']['Tables'][name]['Row'] — not hand-authored"

key-files:
  created:
    - supabase/migrations/20260617000000_threads_messages.sql
    - src/lib/threads/threads.ts
    - src/lib/threads/messages.ts
    - src/lib/threads/__tests__/messages.test.ts
  modified:
    - src/types/database.types.ts (regenerated from live DB by orchestrator — Task 3)

key-decisions:
  - "reading_id FK is text (not uuid) — analysis_results.id is text on the live DB; plan's Pitfall #3 was wrong; uuid→text corrected at apply time"
  - "D-14 double-validation: validateBlock called at write boundary (insertMessage) AND on rehydration (loadMessages) — belt-and-suspenders"
  - "loadMessages maps invalid blocks to UnsupportedBlock sentinel, never drops the message — partial rehydration correct"
  - "ThreadRow/MessageRow derive from Database['public']['Tables'] not hand-authored interfaces"
  - "body stored as Json[] (JSONB); cast from unknown[] at insert boundary after validateBlock passes"

patterns-established:
  - "Pattern: derive DB row types from Database['public']['Tables'][name]['Row'] after type regen"
  - "Pattern: role/type columns typed as string in generated types — narrow to union at app layer with cast"
  - "Pattern: Json body — use Array.isArray guard before mapping on rehydration"

requirements-completed: [THREAD-01, THREAD-07]

# Metrics
duration: ~35min (continuation execution; Tasks 1+2 completed earlier, Task 3 gate resolved by orchestrator)
completed: 2026-06-17
---

# Phase 01 Plan 02: Thread + Message Persistence Summary

**threads + messages tables with RLS, idempotent grounded-thread create, and per-block rehydration re-validation; DB types derived from live schema after migration apply**

## Performance

- **Duration:** ~35 min total (Tasks 1+2 in prior session; Task 3 + reconciliation in this continuation)
- **Started:** 2026-06-17T00:00:00Z
- **Completed:** 2026-06-17
- **Tasks:** 3 (including 1 blocking checkpoint resolved by orchestrator)
- **Files modified:** 5 (migration, threads.ts, messages.ts, tests, database.types.ts)

## Accomplishments

- Migration `20260617000000_threads_messages.sql` applied to live Supabase project `virtuna-v1.1`; `threads` + `messages` tables exist with RLS enabled
- `createGroundedThreadLazy` idempotent upsert — concurrent first-opens collide on UNIQUE(reading_id) partial index rather than racing to two rows (D-15)
- `insertMessage` + `loadMessages` with double validateBlock guard: blocks validated at write boundary AND on rehydration; invalid blocks become `UnsupportedBlock` sentinel, message never dropped (D-14 / Pitfall #4)
- Helper DB row types now derived from regenerated `database.types.ts` — no hand-authored shims; types come from the live DB schema

## Task Commits

1. **Task 1: threads + messages migration** — `193363e3` (feat)
2. **Task 2: thread + message persistence helpers + tests** — `c2ea284f` (feat)
3. **Task 3: apply migration to live DB** — `ae98b748` (fix — corrected reading_id uuid→text, applied migration, regenerated types)
4. **Task 3 continuation: derive row types from regenerated DB types** — `94683523` (refactor)

## Files Created/Modified

- `supabase/migrations/20260617000000_threads_messages.sql` — threads + messages DDL, partial UNIQUE index, RLS (analysis_chats pattern); reading_id corrected to text
- `src/lib/threads/threads.ts` — ThreadRow derived from Database type; createGroundedThreadLazy, getThread, getOpenThread
- `src/lib/threads/messages.ts` — MessageRow derived from Database type; insertMessage with validateBlock boundary check, loadMessages with per-block rehydration re-validation
- `src/lib/threads/__tests__/messages.test.ts` — 8 tests covering insert, load, mixed valid/invalid blocks, error paths
- `src/types/database.types.ts` — regenerated from live DB by orchestrator (ae98b748); now contains threads + messages Row/Insert/Update

## Decisions Made

- **reading_id as text not uuid:** Live DB ground truth overrode Pitfall #3. `analysis_results.id` is `text` on the live Supabase project (stores UUID-format strings). The plan's DDL used `uuid` FK which was rejected at apply time. Corrected to `text NULL REFERENCES analysis_results(id) ON DELETE SET NULL`. Plan intent fully preserved: nullable FK, ON DELETE SET NULL, D-15 partial UNIQUE on reading_id.
- **Double validateBlock:** D-14 requires validation at both write (insertMessage) and rehydration (loadMessages). This is the structural guarantee that model-generated UI blocks cannot persist silently — any block outside the registry is caught at the write boundary.
- **Row types from generated file:** Post-Task 3, `ThreadRow = Database["public"]["Tables"]["threads"]["Row"]` and `MessageRow = Database["public"]["Tables"]["messages"]["Row"]`. The generated `role`/`type` columns are `string` (Supabase gen types don't emit literal unions); these are narrowed to their union types at the app-layer boundary (HydratedMessage.role cast).

## Deviations from Plan

### Critical Deviation — reading_id uuid→text (Task 3 apply)

**1. [Rule 1 - Bug] reading_id FK type corrected from uuid to text**
- **Found during:** Task 3 (live migration apply)
- **Issue:** The plan (and Pitfall #3 guidance) stated `analysis_results.id` is `uuid`. On the live Supabase project `virtuna-v1.1`, `analysis_results.id` is `text` (stores UUID-format strings but typed as text, mirroring `analysis_chats.analysis_id text`). The DDL with `reading_id uuid REFERENCES analysis_results(id)` was rejected by the live DB with a FK type mismatch error.
- **Fix:** DDL corrected to `reading_id text NULL REFERENCES analysis_results(id) ON DELETE SET NULL`. The generated types surface `reading_id: string | null` which is correct and assignable to the helpers.
- **Files modified:** `supabase/migrations/20260617000000_threads_messages.sql`, `src/types/database.types.ts` (regen)
- **Verification:** Migration applied successfully; `grep -n "reading_id" src/types/database.types.ts` shows `reading_id: string | null`
- **Committed in:** `ae98b748` (Task 3 orchestrator commit)
- **Plan intent preserved:** Nullable FK, ON DELETE SET NULL, D-15 partial UNIQUE on reading_id — all intact.

### Type Reconciliation — generated types vs hand-written shims (Task 3 continuation)

**2. [Rule 1 - Bug] Replace hand-written ThreadRow/MessageRow interfaces with derived DB types**
- **Found during:** Task 3 continuation (this session)
- **Issue:** After type regen, `messages.ts` `body` was `unknown[]` but the generated `Insert` type expects `Json | undefined`. The `as ThreadRow`/`as MessageRow` casts were stale shims from before regen.
- **Fix:** Replaced interfaces with type aliases derived from `Database["public"]["Tables"]`; cast `blocks as Json[]` at insert boundary; used `Array.isArray(row.body)` guard on rehydration; narrowed `row.role` to union with cast.
- **Files modified:** `src/lib/threads/threads.ts`, `src/lib/threads/messages.ts`
- **Verification:** `npx tsc --noEmit` clean for src/lib/threads/ source files; `npx vitest run src/lib/threads/` — 8/8 pass
- **Committed in:** `94683523`

---

**Total deviations:** 2 (1 live-DB ground truth correction, 1 type shim reconciliation)
**Impact on plan:** Both deviations were necessary corrections — the uuid→text is a factual fix against live DB reality; the shim swap is the exact point of Task 3. No scope creep.

## Issues Encountered

- Pre-existing TypeScript strict errors in `src/lib/threads/__tests__/messages.test.ts` (TS2532 array access possibly undefined, TS6133 unused `buildQueryMock`). These are not caused by this plan's changes and did not affect test runtime — all 8 vitest tests pass. Logged to deferred-items.

## User Setup Required

None — migration applied to live DB by orchestrator. No additional env vars or dashboard steps required.

## Next Phase Readiness

- Thread + message persistence substrate complete — Plans 03 (Flash runner) and 04 (Composer) can persist Flash output and user messages through this layer
- `createGroundedThreadLazy(readingId, userId)` ready to call from the Reading page on first open
- `insertMessage` + `loadMessages` ready to call from the Flash tool runner and Composer
- `ThreadRow.reading_id` is `string | null` (text) — callers using `analysis_results.id` values should pass them as strings directly

---
*Phase: 01-engine-thread-foundation*
*Completed: 2026-06-17*
