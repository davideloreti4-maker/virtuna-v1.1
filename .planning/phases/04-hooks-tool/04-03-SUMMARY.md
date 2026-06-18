---
phase: 04-hooks-tool
plan: 03
subsystem: hooks-surface
tags: [hook-chip, sse-consumer, hooks-thread-view, test-handoff, rehydration, tdd, vitest, d-02, d-03, d-05, d-06, d-09, d-14, hooks-01, hooks-02, hooks-03, thread-07]

# Dependency graph
requires:
  - phase: 04-hooks-tool
    plan: 01
    provides: "HookCardBlock schema + HookCardRenderer + onTest seam + HookCardBlockSchema"
  - phase: 04-hooks-tool
    plan: 02
    provides: "POST /api/tools/hooks SSE route + runHooksPipeline + content-first event contract"
  - phase: 03-ideas-tool
    plan: 04
    provides: "IdeasThreadView pattern + useIdeasStream pattern + composer Idea routing + open-thread persistence"
provides:
  - "useHooksStream: fetch+getReader SSE consumer for POST /api/tools/hooks, content-first (ranked faces+tag+quote → band chip)"
  - "HooksThreadView: ranked hook-card render via MessageBlocks + PlatformContext + HookTestContext"
  - "HookTestContext: React context threading the Test-handoff callback to HookCardRenderer through MessageBlocks"
  - "hook-test-handoff: 'Test full →' carries chosen hook as brief into Test tool — no Max text run (D-05)"
  - "GET /api/threads/open: open-thread hydrated messages read-back — closes P3 rehydration debt"
  - "Composer: rehydration useEffect on mount + persistedBlocks wired to both IdeasThreadView + HooksThreadView"
affects: [04-hooks-tool phase UAT (Task 4 checkpoint), Phase 05 open-chat + Test reframe]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetch+getReader SSE consumer (BLOCKER-1 pattern): cloned from use-ideas-stream.ts, extended with rank + audienceArchetype partial fields"
    - "HookTestContext: createContext<OnTestHookFn | null>(null) — threads callback through MessageBlocks without prop drilling"
    - "Test handoff (D-05): lifted state in composer (handleTestHook → setActiveTool('test') + setTestBrief); visible brief banner above upload affordance"
    - "Rehydration useEffect (D-14/THREAD-07): mount-time fetch of GET /api/threads/open, flatten + split blocks by type"

key-files:
  created:
    - src/hooks/queries/use-hooks-stream.ts
    - src/components/thread/hooks-thread-view.tsx
    - src/lib/hook-test-context.tsx
    - src/app/api/threads/open/route.ts
    - src/components/thread/__tests__/hook-test-handoff.test.tsx
    - src/app/api/threads/open/__tests__/route.test.ts
  modified:
    - src/components/app/home/tool-chips.tsx
    - src/components/thread/hook-card-block.tsx
    - src/components/app/home/composer.tsx
    - src/components/app/home/__tests__/tool-chips.test.tsx

key-decisions:
  - "Test handoff seam: lifted state (default per plan) — handleTestHook in composer lifts setActiveTool + setTestBrief; callback threaded to HookCardRenderer via HookTestContext (avoids MessageBlocks prop drilling)"
  - "HookTestContext: React context with OnTestHookFn | null default — null = stub (Plan 01 state), non-null = wired handoff"
  - "HookCardRenderer: reads onTestHook from HookTestContext when no onTest prop override; callback signature (hookLine, audienceArchetype)"
  - "Test brief banner: coral hookLine + audienceArchetype tag + instructional copy ('shoot → upload → Max scores the real thing'); dismissible ✕"
  - "GET /api/threads/open: auth→getOpenThread→loadMessages; 200+{messages:[]} on no thread; 200+{threadId, messages} on hit; 401 unauth"
  - "Rehydration split: composer useEffect flattens all blocks across all messages → filter by type ('idea-card' → setPersistedIdeaBlocks; 'hook-card' → setPersistedHookBlocks)"
  - "Platform chip shows for both Idea + Hooks tool (showPlatformChip = activeTool === 'idea' || 'hooks')"
  - "Upload button hidden for Hooks tool (mirrors Idea tool — text-only path)"

# Metrics
duration: ~30min
completed: 2026-06-18
---

# Phase 04 Plan 03: Hooks Surface — Stream Consumer + Thread View + Test Handoff + Rehydration Summary

**Full Hooks surface: live Hook chip (D-09), content-first ranked hook-cards, "Test full →" deep-link handoff into Test tool with hook-as-brief (D-05/D-06, HOOKS-03), open-thread rehydration closing the P3 step-5 debt (D-14/THREAD-07). UAT checkpoint reached — human verification pending.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-18 (UAT pending)
- **Tasks:** 3 of 4 automated tasks complete; Task 4 = UAT checkpoint (human-verify)
- **Files created:** 6
- **Files modified:** 4

## Plan-05 Handoff (MANDATORY)

### 1. Test handoff seam shipped

"Test full →" handoff uses **lifted state** (the default seam):

```tsx
// In composer.tsx — the handleTestHook callback:
const handleTestHook = useCallback((hookLine: string, audienceArchetype: string) => {
  setActiveTool("test");
  setTestBrief({ hookLine, audienceArchetype });
}, []);

// Passed to HooksThreadView via onTestHook prop → HookTestContext → HookCardRenderer
```

The brief banner renders above the Test upload affordance:
```
"Shooting this hook — upload your video and SIM-1 Max will score the real thing"
[hookLine in coral] + [audienceArchetype tag]  [✕ dismiss]
```

Phase 05 Test Reframe (D-06) can rename this landing and extend the brief context — the seam is the `testBrief` state + the `handleTestHook` callback in `composer.tsx`.

### 2. GET /api/threads/open contract

```
GET /api/threads/open (authenticated)

200: { messages: [] }                           — no open thread
200: { threadId: string, messages: HydratedMessage[] }  — open thread + D-14 re-validated blocks
401: { error: "Unauthorized" }                  — no session
```

Closes the P3 `persistedBlocks={[]}` TODO — both `IdeasThreadView` and `HooksThreadView` now receive real persisted blocks on reload.

### 3. HookTestContext pattern

```tsx
import { HookTestContext } from '@/lib/hook-test-context';
// Provide from any parent wrapping MessageBlocks:
<HookTestContext.Provider value={(hookLine, audienceArchetype) => { /* handoff */ }}>
  <MessageBlocks body={blocks} />
</HookTestContext.Provider>
// HookCardRenderer reads it automatically — no prop threading needed
```

## Task Commits

| # | Phase | Commit | Description |
|---|-------|--------|-------------|
| 1 RED | TDD | b23bdefd | test(04-03): failing tool-chips tests — Hook chip live, only Chat disabled |
| 1 GREEN | TDD | 0592701c | feat(04-03): live Hook chip + hooks stream consumer + HooksThreadView + composer routing |
| 2 | TDD | a74b3a1a | feat(04-03): "Test full →" handoff — hook-as-brief into Test tool, no Max text run |
| 3 RED | TDD | 190735e3 | test(04-03): failing open-thread rehydration route tests (RED) |
| 3 GREEN | TDD | ab8c6597 | feat(04-03): GET /api/threads/open rehydration read-back — close P3 persistence debt |

## Files Created/Modified

- `src/hooks/queries/use-hooks-stream.ts` — NEW: fetch+getReader SSE consumer; PartialHookCard; toBlocks(); rank match via seedHook+rank
- `src/components/thread/hooks-thread-view.tsx` — NEW: ranked hook-card render; PlatformContext + HookTestContext providers; streaming + persisted sections
- `src/lib/hook-test-context.tsx` — NEW: HookTestContext (OnTestHookFn | null); useOnTestHook()
- `src/app/api/threads/open/route.ts` — NEW: GET /api/threads/open; auth→getOpenThread→loadMessages; D-14 re-validation
- `src/components/thread/__tests__/hook-test-handoff.test.tsx` — NEW: 5 tests for Test handoff context seam
- `src/app/api/threads/open/__tests__/route.test.ts` — NEW: 5 tests for rehydration route (401, empty, hydrated, loadMessages called)
- `src/components/app/home/tool-chips.tsx` — hooks chip enabled: true (only Chat disabled — P5)
- `src/components/thread/hook-card-block.tsx` — reads onTestHook from HookTestContext; onTest prop override preserved
- `src/components/app/home/composer.tsx` — hooks routing block; handleTestHook; testBrief state + banner; rehydration useEffect; showHooksView; persistedBlocks wired
- `src/components/app/home/__tests__/tool-chips.test.tsx` — updated: Hook chip fires onSelect; only Chat asserts disabled + 1 "coming soon"

## Decisions Made

- **Test handoff seam:** Lifted state (handleTestHook in composer) — preferred default. HookTestContext threads it down to HookCardRenderer without prop drilling through MessageBlocks. Query-param path (for persisted/rehydrated cards) deferred — the context seam covers both streaming and persisted cards (HooksThreadView provides context for both).
- **HookTestContext vs prop:** MessageBlocks only passes `block` to renderers — cannot thread arbitrary callbacks. Context is the correct seam (same pattern as PlatformContext for IdeaCardRenderer's "Develop this →").
- **Rehydration split strategy:** Flatten all blocks across all messages from the open thread → split by type at the composer level. Rationale: IdeasThreadView and HooksThreadView each receive only their block type; the unsupported sentinel pass-through is handled by MessageBlocks itself (D-14).
- **showPlatformChip extended:** Hooks tool shows the platform chip (mirrors Idea) — platform is the first-class param on the hooks request.
- **Upload button hidden for Hooks:** Same rule as Idea — text-only path, upload not applicable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] HookTestContext for MessageBlocks pass-through**
- **Found during:** Task 1 implementation
- **Issue:** The plan suggested either a `onTestHook` prop threaded through `HooksThreadView` OR a `PlatformContext`-style seam. `MessageBlocks` only passes `block` to renderers — prop threading is impossible without modifying `MessageBlocks` (architectural change).
- **Fix:** Created `HookTestContext` (mirror of `PlatformContext`) — `HooksThreadView` provides it, `HookCardRenderer` reads it via `useOnTestHook()`. Zero changes to `MessageBlocks`.
- **Files created:** `src/lib/hook-test-context.tsx`
- **Commit:** 0592701c

## Known Stubs

- **`persistedIdeaBlocks` / `persistedHookBlocks` typed as `any[]`:** These are typed loosely at the composer level for now — the MessageBlocks + validateBlock pipeline re-validates them on render (D-14). The types will tighten when the rehydration API response is typed end-to-end (P5 or post-UAT cleanup). Not a functional stub — data flows correctly.
- **UAT Task 4 pending:** The full 7-step flagship spine has not been human-verified yet. This SUMMARY is written at the checkpoint boundary.

## Threat Flags

No new threat surface beyond the plan's threat model:
- T-04-10 applied: `supabase.auth.getUser()` before any DB read in GET /api/threads/open; 401 on absent session; user_id from session only.
- T-04-11 applied: `loadMessages` + `validateBlock` re-validate each block on rehydration; invalid → unsupported sentinel.
- T-04-12 applied: "Test full →" is a UI handoff ONLY — no model API called, no navigation to /analyze, no Max result fabricated.
- T-04-13 applied: Hook composer path never sets `pendingNavRef` / calls `stream.start`.

## Self-Check

- `src/hooks/queries/use-hooks-stream.ts`: FOUND
- `src/components/thread/hooks-thread-view.tsx`: FOUND
- `src/lib/hook-test-context.tsx`: FOUND
- `src/app/api/threads/open/route.ts`: FOUND
- Commit b23bdefd (RED chips): FOUND
- Commit 0592701c (GREEN Task 1): FOUND
- Commit a74b3a1a (Task 2 handoff): FOUND
- Commit 190735e3 (RED rehydration): FOUND
- Commit ab8c6597 (GREEN Task 3): FOUND
- npx vitest run (full suite): 2419 PASS, 0 FAIL
- npm run build: Compiled successfully

---

## Gap-Closure: One-Open-Thread-Per-User Fix (2026-06-18)

### Root Cause

`createOpenThreadLazy(userId)` relied on a 23505 unique-violation to be
idempotent, but no unique constraint existed for open threads
(`type='open', reading_id IS NULL`). The only unique index
(`threads_reading_id_unique_idx`) only covers grounded threads
(`reading_id IS NOT NULL`). Result: every tool generation created a NEW open
thread → ideas, hooks, and /develop messages landed in different threads →
"Hooks queued — check the thread below" showed nothing. Additionally,
`getOpenThread` used bare `.maybeSingle()` which throws PGRST116 when >1 row
matches → GET /api/threads/open returned 500 on reload.

### Changes

**`src/lib/threads/threads.ts` — `getOpenThread` fix (commit 64ba2457)**
- Replaced `.maybeSingle()` with `.order("created_at", { ascending: true }).limit(1).maybeSingle()`
- Canonical open thread = oldest. Safe under both pre-migration (duplicates) and post-migration state.
- Never throws merely because duplicates exist.

**`supabase/migrations/20260618000000_threads_one_open_per_user.sql` (commit 64ba2457)**
- Step 1: Idempotent CTE consolidation — repoints messages from duplicate open threads to canonical (MIN created_at + id tiebreaker), deletes empty duplicates.
- Step 2: `CREATE UNIQUE INDEX IF NOT EXISTS threads_open_user_unique_idx ON public.threads (user_id) WHERE type = 'open' AND reading_id IS NULL`
- Consolidation runs before index creation (index would fail if dupes remain).
- Migration NOT applied — orchestrator applies via Supabase MCP.

**`src/lib/threads/__tests__/open-thread.test.ts` — regression tests (commit fd45cc47)**
- `buildChain()` updated to include `order` + `limit` (new query shape).
- New `describe("getOpenThread")` block: 4 tests — duplicate tolerance (does not throw, returns oldest), null on no thread, real-error throw, CR-01 user_id scope.

### Test Results

- Focused suite (open-thread + threads): 12 PASS, 0 FAIL
- Full suite: 2423 PASS, 0 FAIL (+4 new regression tests)

### Follow-on: rehydration render gate (commit 1d21d531)

The dedup migration + `getOpenThread` fix restored the rehydration fetch (`GET
/api/threads/open` → 200 with all consolidated messages), but a third defect
surfaced in live UAT: `showIdeasView`/`showHooksView` in `composer.tsx` gated
the thread views ONLY on live-stream activity (`isStreaming`/streaming blocks/
error), so persisted blocks fetched on mount never mounted their view.

- `src/components/app/home/composer.tsx`: added `persistedIdeaBlocks.length > 0`
  / `persistedHookBlocks.length > 0` to the respective view gates; hoisted the
  `persisted*Blocks` `useState` above the gates (TDZ-safe).
- Live re-verify: after reload, Idea chip renders all persisted idea-cards and
  Hooks chip renders all persisted hook-cards (incl. /develop output). No data loss.

### Live UAT outcome (orchestrator-run, @e2e_creator)

7/7 steps pass after fixes. Steps 1,2,3,5,7 passed first run; Steps 4 (develop
persistence) + 6 (reload rehydration) were fixed by the migration + getOpenThread
+ composer-gate changes above.

**Known UX nuance (non-blocking, follow-up candidate):** rehydration splits the
single chronological open thread into two tool-gated views (idea-cards under the
Idea chip, hook-cards under the Hooks chip); the default Test tool shows nothing
on reload, and in-session "Develop this →" shows "Hooks queued — check the thread
below" while the new hooks render under the Hooks chip rather than inline. Data is
fully persisted and viewable; a unified chronological thread view would polish this.

---

## Post-UAT UX Fix — Composer Bottom Pin on /home (commit 35367693)

**Issue:** On /home, a long ideas/hooks thread pushed the composer form off the bottom of the viewport. The `hasSimulation` signal (route `:id` param) only went true on `/analyze/[id]`, so `/home` always used the `centered` layout with a vertically-growing column.

**Fix (layout/markup only — no stream/submit/persistence logic changed):**

- `composer.tsx`: added `hasThread` signal (streaming or persisted idea/hook blocks exist). New `homeThreadMode = hasThread && !hasSimulation` flag. When true: renders a full-height shell (`data-layout="thread"`) with a `flex-1 min-h-0 overflow-y-auto` thread region and a `shrink-0` pinned form row. Added `onThreadChange` callback prop so the parent can react to thread presence.
- `home-page-layout.tsx` (new client component): manages `hasThread` state. Empty → original `min-h-full justify-center` centered hero. Thread → `h-full flex-col` with composer filling available height.
- `page.tsx`: delegates to `HomePageLayout` (server → client handoff).
- `composer-layout.test.tsx`: 5 new assertions for the thread-pin behavior (total 38 tests; full suite 2428/2428 green).

**Preserved:** empty-home centered hero, permalink pinned layout (`data-layout="pinned"`), all stream/submit/persistence paths, `shadow-float` whisper, 760px readable column.
