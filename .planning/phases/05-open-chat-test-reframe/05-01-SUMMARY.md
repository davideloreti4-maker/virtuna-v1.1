---
phase: 05-open-chat-test-reframe
plan: "01"
subsystem: api
tags: [qwen, sse, chat, threads, supabase, tdd]

requires:
  - phase: 02-knowledge-core-generative-rebuild
    provides: KC_CHAT_SYSTEM_PROMPT + assembleBundle({mode:"chat"}) + chat stance-slice
  - phase: 01-engine-thread-foundation
    provides: insertMessage, createOpenThreadLazy, loadMessages, open thread model (type:"open")

provides:
  - runChatPipeline — async function streaming grounded Qwen markdown answer via KC_CHAT_SYSTEM_PROMPT + assembleBundle(mode:chat)
  - isColdStart — exported pure helper mirroring assembler.ts isProfileThin predicate
  - POST /api/tools/chat — SSE route persisting both turns to the open thread + coldStart meta frame

affects:
  - 05-03 (chat frontend: useChatStream hooks this SSE route)
  - 05-04 (conversation layer: chat turns in the open thread)

tech-stack:
  added: []
  patterns:
    - "Chat runner callback pattern: runChatPipeline(input, onToken) — route drives SSE, runner yields tokens via callback"
    - "coldStart meta frame leads SSE stream so Plan 05-03 can gate nudge before first token"
    - "Persist-user-first ordering: user turn inserted before streaming starts (mirrors grounded chat route)"
    - "isColdStart mirrors assembler.ts isProfileThin field-null check — single predicate, no divergence"

key-files:
  created:
    - src/lib/tools/runners/chat-runner.ts
    - src/app/api/tools/chat/route.ts
    - src/app/api/tools/chat/__tests__/route.test.ts
  modified: []

key-decisions:
  - "isColdStart mirrors assembler.ts isProfileThin exactly — same field-null checks, not a second divergent predicate (D-08 conformance)"
  - "coldStart computed route-side before stream starts so meta frame leads the SSE stream (D-08 nudge signal available to Plan 05-03 before first token)"
  - "Callback-based runner interface: runChatPipeline(input, onToken) rather than async generator — simpler for the route to drive SSE inline"
  - "MAX_PRIOR_TURNS=20 soft context cap per D-01a — full running context default, bounded for cost"

patterns-established:
  - "Chat route: meta(coldStart) → token(delta)... → done() SSE event sequence"
  - "Markdown block persistence: both user and assistant turns as {type:markdown,props:{text}} blocks with kcGenVersion stamp"

requirements-completed: [THREAD-03]

duration: 5min
completed: 2026-06-18
---

# Phase 05 Plan 01: Open-Chat Backend Summary

**Profile-grounded open-chat SSE backend (THREAD-03): `runChatPipeline` + `isColdStart` runner + `POST /api/tools/chat` persisting both turns as markdown blocks with a structured `coldStart` meta frame**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-18T10:15:01Z
- **Completed:** 2026-06-18T10:20:00Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- `runChatPipeline`: callback-driven Qwen stream grounded via `assembleBundle({mode:"chat"})` + `KC_CHAT_SYSTEM_PROMPT`, returns `{fullContent, coldStart}`
- `isColdStart`: exported pure helper mirroring `assembler.ts:isProfileThin` — same field-null predicate, no divergence (D-08)
- `POST /api/tools/chat`: SSE route — auth gate, ask cap (2000), `createOpenThreadLazy`, prior-turns anchor, user-first persist, `meta{coldStart}` leads stream, `token` per delta, assistant markdown block persisted, `done`
- TDD: 4 behavior tests red → green (auth 401, cap 400, token stream + markdown persist, coldStart meta frame)

## Task Commits

1. **Task 1: Chat runner** - `eda0ddc6` (feat)
2. **Task 2 RED: Failing tests** - `cd0630a2` (test)
3. **Task 2 GREEN: Route implementation + TS fix** - `5ce97720` (feat)

## Files Created/Modified

- `/Users/davideloreti/virtuna-numen-tools/src/lib/tools/runners/chat-runner.ts` — `runChatPipeline` + `isColdStart` exports
- `/Users/davideloreti/virtuna-numen-tools/src/app/api/tools/chat/route.ts` — `POST /api/tools/chat` SSE route
- `/Users/davideloreti/virtuna-numen-tools/src/app/api/tools/chat/__tests__/route.test.ts` — 4 behavior tests (TDD)

## Decisions Made

- `isColdStart` mirrors `assembler.ts:isProfileThin` exactly (same 6-field null check) — not a new divergent definition. If assembler's thin rule changes, both update in lockstep.
- `coldStart` computed route-side (before stream starts) using the exported `isColdStart`, so the `meta` frame can lead the SSE stream — Plan 05-03 gets the nudge signal before any token arrives.
- Callback pattern (`onToken`) chosen over async generator — cleaner for the route to drive SSE inline without pulling from a generator.
- `MAX_PRIOR_TURNS = 20` soft cap (D-01a) on prior turns serialized into the assembleBundle anchor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in test file**
- **Found during:** Task 2 (after GREEN implementation)
- **Issue:** `npx tsc --noEmit` flagged 3 TS errors in the test file: destructure type mismatch, possibly-undefined array access
- **Fix:** Typed `insertCalls` as `Array<[string, string, unknown[], string?]>` and used non-null assertion on known-defined `assistantCall`
- **Files modified:** `src/app/api/tools/chat/__tests__/route.test.ts`
- **Verification:** `npx tsc --noEmit` reports no errors for chat files; all 4 tests still green
- **Committed in:** 5ce97720

---

**Total deviations:** 1 auto-fixed (Rule 1 — TS bug in test)
**Impact on plan:** Minimal — test file type correction only. No behavior change.

## Issues Encountered

None — plan followed exactly. Pre-existing TS errors in hooks tests, engine tests, and component tests are out-of-scope (not introduced by this plan).

## Next Phase Readiness

- `POST /api/tools/chat` ready for Plan 05-03 (chat frontend: `useChatStream`, Chat chip, composer routing, markdown rehydration)
- `coldStart` meta frame ready — Plan 05-03 gates the one-time nudge render on it (D-08)
- Open thread persistence wired — Plan 05-04 (conversation layer) can read the full thread context

---
*Phase: 05-open-chat-test-reframe*
*Completed: 2026-06-18*
