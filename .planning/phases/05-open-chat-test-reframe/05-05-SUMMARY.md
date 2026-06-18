---
phase: 05-open-chat-test-reframe
plan: "05"
subsystem: studio-core-loop
tags: [refine, nlp-intent, scoped-rerun, sse, sim1-flash, chain-handoff, tdd]

requires:
  - phase: 05-open-chat-test-reframe
    plan: "03"
    provides: useChatStream + ChatThreadView + composer chat-send path
  - phase: 05-open-chat-test-reframe
    plan: "04"
    provides: chain-handoff SSOT + SkillRunError pattern + followup SSE events

provides:
  - detectRefineIntent (src/lib/tools/refine.ts) — bounded NL heuristic: refine verb + card noun + ordinal → scoped re-run signal
  - buildRefineAnchor (src/lib/tools/refine.ts) — compact fenced anchor for hook or idea card + instruction
  - POST /api/tools/refine (src/app/api/tools/refine/route.ts) — scoped skill re-run: fresh SIM-scored card inline + chat note
  - useHooksStream.startRefine — refine SSE consumer into hooks streaming state
  - useIdeasStream.startRefine — refine SSE consumer into ideas streaming state
  - ChatThreadView.onSuggestChain + suggestedCTAs — tappable chain-step CTA block

affects:
  - 06 (Script/Remix: can register refine support by appending CHAIN_HANDOFFS; no plumbing changes)

tech-stack:
  added: []
  patterns:
    - "Bounded NL detection pattern: refine verb + card noun + ordinal ALL required — plain questions never trigger skill fire (D-05)"
    - "Scoped re-run pattern: instruction + original card anchor → fresh runHooksPipeline/runIdeasPipeline → new freshly-SIM-scored card (moat holds on refined output)"
    - "startRefine pattern: dedicated SSE consumer method on stream hooks — same event format as start(), consumes into same state, error surfaces through hooks.error → SkillRunError (no bespoke error surface)"
    - "Tappable CTA pattern: onSuggestChain callback, onClick only — never useEffect, never auto-fires on render (D-05 hard constraint)"

key-files:
  created:
    - src/lib/tools/refine.ts
    - src/lib/tools/__tests__/refine.test.ts
    - src/app/api/tools/refine/route.ts
    - src/app/api/tools/refine/__tests__/route.test.ts
  modified:
    - src/components/app/home/composer.tsx
    - src/components/thread/chat-thread-view.tsx
    - src/hooks/queries/use-hooks-stream.ts
    - src/hooks/queries/use-ideas-stream.ts

key-decisions:
  - "startRefine method on stream hooks (not a standalone SSE reader in composer) — error routes through hooks.error/ideas.error → Plan-04 SkillRunError with zero new error UI"
  - "Refine path switches activeTool to 'hooks'/'idea' so the new card renders in the correct thread view (not in chat view)"
  - "buildRefineAnchor: compact fenced block carrying hookLine/audienceArchetype (hooks) or title/angle (ideas) + instruction — minimal but sufficient for the runner to scope the re-run"
  - "suggestedCTAs sourced from handoffsFor('idea') — idea→hooks is the most relevant next step from a chat answer about content"
  - "composer.tsx already exceeded 500-line limit (was 647 before this plan); added ~73 lines for refine path (pre-existing debt, not introduced by this plan)"

metrics:
  duration: ~28min
  completed: 2026-06-18
  tasks: 3
  files_created: 4
  files_modified: 4

requirements-completed: [STUDIO-02, STUDIO-03, THREAD-05]
---

# Phase 05 Plan 05: Core Loop Summary

**Refine-intent NL detection (D-05) + scoped SIM-scored re-run inline (D-04) + tappable suggested chain-step CTA (D-05/STUDIO-03). Every refined output is freshly SIM-1-scored; no skill ever fires without an explicit send or tap.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-06-18
- **Completed:** 2026-06-18
- **Tasks:** 3 (2 TDD + 1 wiring)
- **Files created:** 4
- **Files modified:** 4

## Accomplishments

### Task 1: refine.ts — detectRefineIntent + buildRefineAnchor (TDD RED → GREEN)

- `detectRefineIntent(text)`: bounded heuristic requiring ALL three signals: (1) refine verb (make/tighten/sharpen/rewrite/redo/…), (2) card noun (hook/idea), (3) ordinal/number reference (1/2/first/second). A plain question ("what should I post this week?") returns `isRefine: false` — no false positive, no silent skill fire (D-05).
- `buildRefineAnchor(cardProps, instruction)`: compact fenced anchor embedding original hook or idea content + the user's instruction — carries `hookLine + audienceArchetype + band` (hooks) or `title + angle + seedHook + band` (ideas) into the scoped re-run pipeline call.
- Pure module: no React import, no `fetch(`. Tree-shakeable.
- 8 behavior tests green (4 spec + 4 additional edge cases).

### Task 2: POST /api/tools/refine — scoped re-run SSE route (TDD RED → GREEN)

- Auth gate (401), instruction cap (2000 chars), anchor cap (5000 chars) — all server-side.
- Calls `runHooksPipeline` or `runIdeasPipeline` with the instruction + anchor — **fresh Flash SIM run always** (moat honesty D-04 — band never copied from request body).
- Emits `stage / content / score / followup / done` SSE events (same shape as hooks/ideas routes — client already understands this format).
- Persists ONE new card via `insertMessage` (STACK / append-only — D-04; original card never overwritten).
- Persists a one-line Qwen chat note as a second markdown message (Numen co-pilot voice D-08).
- On pipeline failure: emits `event: error { message }` → client renders Plan-04 `SkillRunError` retry surface — no new bespoke error UI.
- 4 behavior tests green.

### Task 3: Wire refine-detect into chat send + suggested chain-step CTA

- `useHooksStream.startRefine()`: new method POSTing to `/api/tools/refine` with the refine body, consuming the SSE into the same streaming state as `start()`. Refine failures flow through `hooks.error` → Plan-04 `SkillRunError` (zero duplicate error surface).
- `useIdeasStream.startRefine()`: identical pattern for idea refine.
- `composer.tsx` chat send: before `chat.start()`, calls `detectRefineIntent(ask)`. If `isRefine`, looks up the original card by `cardRef` from persisted+streaming blocks, builds anchor, switches `activeTool` to the relevant skill, calls `hooks.startRefine()` or `ideas.startRefine()`. Falls through to `chat.start()` on `isRefine: false`.
- CRITICAL: refine fires because the user **explicitly** sent a refine-phrased message — never auto-fires (D-05).
- `ChatThreadView`: new `onSuggestChain` prop + `suggestedCTAs` from `handoffsFor('idea')`. Renders tappable coral CTA buttons after a completed chat turn. Fires **only on `onClick`** — no `useEffect` involvement.
- `composer.tsx` `onSuggestChain`: tapping "Develop this →" switches to ideas tool + runs Auto mode; tapping a hooks CTA switches to hooks + runs Auto mode.

## Task Commits

1. **Task 1 RED: Failing refine.ts tests** — `ccf8a2c3` (test)
2. **Task 1 GREEN: detectRefineIntent + buildRefineAnchor** — `ef28f5b7` (feat)
3. **Task 2 RED: Failing refine route tests** — `54de33a2` (test)
4. **Task 2 GREEN: POST /api/tools/refine route** — `5e1b3d09` (feat)
5. **Task 3: Wire refine + CTA** — `3777be75` (feat)

## Files Created/Modified

- `/Users/davideloreti/virtuna-numen-tools/src/lib/tools/refine.ts` — detectRefineIntent + buildRefineAnchor (created)
- `/Users/davideloreti/virtuna-numen-tools/src/lib/tools/__tests__/refine.test.ts` — 8 behavior tests (created)
- `/Users/davideloreti/virtuna-numen-tools/src/app/api/tools/refine/route.ts` — POST /api/tools/refine SSE route (created)
- `/Users/davideloreti/virtuna-numen-tools/src/app/api/tools/refine/__tests__/route.test.ts` — 4 behavior tests (created)
- `/Users/davideloreti/virtuna-numen-tools/src/components/app/home/composer.tsx` — refine-detect in chat send path (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/components/thread/chat-thread-view.tsx` — onSuggestChain + suggestedCTAs (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/hooks/queries/use-hooks-stream.ts` — startRefine method (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/hooks/queries/use-ideas-stream.ts` — startRefine method (modified)

## Decisions Made

- `startRefine` added as a method on `useHooksStream` + `useIdeasStream` rather than a standalone SSE reader in composer — this routes refine errors through the existing Plan-04 `SkillRunError` surface with zero new error UI (error state is owned by the stream hook, not the composer).
- Refine path switches `activeTool` to `"hooks"` / `"idea"` so the new card renders inline in the correct thread view alongside existing cards (not in the chat view which only renders markdown).
- `suggestedCTAs` sourced from `handoffsFor('idea')` — `idea → hooks` ("Develop this →") is the most immediately useful next step from a chat answer; it is the only wired entry (endpoint not null) in the current registry.
- `buildRefineAnchor` uses a compact fenced block format — enough context for the runner to understand the specific card and instruction without over-loading the ask (cost awareness D-01a).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed destructuring type errors in refine route tests**
- **Found during:** Task 2 (after GREEN implementation, `npx tsc --noEmit` check)
- **Issue:** `mock.calls.find(([, role, blocks]: [string, string, unknown[]]) => ...)` — TS2769 because `mock.calls` is `any[][]` (TypeScript cannot prove it has 3 elements)
- **Fix:** Cast to `(insertCalls as Array<[string, string, unknown[]]>).find(...)` — type-safe, correct
- **Files modified:** `src/app/api/tools/refine/__tests__/route.test.ts`
- **Committed in:** `5e1b3d09`

---

**2. [Rule 3 - Note] composer.tsx already exceeded 500-line limit pre-existing**
- **Found during:** Task 3 (file size check)
- **Issue:** `composer.tsx` was 647 lines before this plan (pre-existing from Plans 01–04 accumulation). This plan added ~73 lines for the refine path, bringing it to 720. The 500-line guideline was violated before this plan started.
- **Fix:** Not fixed — splitting composer.tsx requires an architectural refactor (Rule 4 scope). Tracked as deferred.
- **Files modified:** N/A (noted only)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TS type error in test), 1 noted pre-existing (composer size).
**Impact on plan:** Minimal — test file type correction only; no behavior change.

## Known Stubs

None — all data flows from real pipeline runs. The refine route calls `runHooksPipeline` / `runIdeasPipeline` which always run Flash SIM. Band/fraction come from the runner, never the request body. Chat notes are model-generated.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-api-endpoint | src/app/api/tools/refine/route.ts | New POST endpoint at /api/tools/refine. Auth gate enforced before any DB read (T-04-03). User ID from session only (T-04-04/CR-01). Instruction cap 2000 + anchor cap 5000 server-side (WARNING-5). insertMessage re-validates blocks at write boundary (T-04-07). |

## Self-Check: PASSED

Files created:
- `src/lib/tools/refine.ts` — FOUND
- `src/lib/tools/__tests__/refine.test.ts` — FOUND
- `src/app/api/tools/refine/route.ts` — FOUND
- `src/app/api/tools/refine/__tests__/route.test.ts` — FOUND

Commits:
- ccf8a2c3 — FOUND
- ef28f5b7 — FOUND
- 54de33a2 — FOUND
- 5e1b3d09 — FOUND
- 3777be75 — FOUND

Tests: PASS (12/12)
TypeScript: clean (no errors in source files)
