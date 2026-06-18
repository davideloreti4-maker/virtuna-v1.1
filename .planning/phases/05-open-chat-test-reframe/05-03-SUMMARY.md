---
phase: 05-open-chat-test-reframe
plan: "03"
subsystem: ui
tags: [chat, sse, stream, thread, empty-state, cold-start, error-state, rehydration]

requires:
  - phase: 05-open-chat-test-reframe
    plan: "01"
    provides: POST /api/tools/chat SSE route (meta{coldStart}→token→done/error)
  - phase: 05-open-chat-test-reframe
    plan: "02"
    provides: composer.tsx + tool-chips.tsx post-Test-reframe state

provides:
  - useChatStream — fetch+getReader SSE consumer for POST /api/tools/chat; exposes coldStart + nudgeShown + error
  - ChatThreadView — renders interleaved markdown chat turns (persisted + streaming) via MessageBlocks; one-time cold-start nudge (D-08); chat-turn error state (W2)
  - Live Chat chip (tool-chips.tsx enabled:true)
  - Composer chat-send branch (no pendingNavRef, no stream.start — D-05)
  - Markdown block rehydration from open thread

affects:
  - 05-04 (conversation layer: chat turns already in thread; ChatThreadView ready)

tech-stack:
  added: []
  patterns:
    - "useChatStream: fetch+getReader SSE loop (mirrors use-hooks-stream.ts) — NOT EventSource (BLOCKER-1)"
    - "nudgeShown as sticky session-level boolean in hook (not reset by reset()) — D-08 once-per-session gate"
    - "ChatThreadView: empty state + nudge + error as pure prop-driven render (no setState-in-effect)"
    - "persistedChatBlocks: markdown blocks filtered from GET /api/threads/open rehydration"

key-files:
  created:
    - src/hooks/queries/use-chat-stream.ts
    - src/components/thread/chat-thread-view.tsx
  modified:
    - src/components/app/home/tool-chips.tsx
    - src/components/app/home/composer.tsx

decisions:
  - "nudgeShown tracked in useChatStream (sticky, not reset by reset()) rather than in ChatThreadView — avoids react-hooks/set-state-in-effect lint error while preserving the D-08 once-per-session gate semantics"
  - "Chat chip enabled:true flipped; showPlatformChip includes chat; upload toggle hidden for chat (mirrors idea/hooks behavior)"
  - "showChatView = activeTool === 'chat' unconditionally (ChatThreadView owns its empty state — no isIdle short-circuit like HooksThreadView)"

metrics:
  duration: 10min
  completed: 2026-06-18
  tasks: 2
  files_created: 2
  files_modified: 2
---

# Phase 05 Plan 03: Open-Chat Frontend Summary

**Profile-grounded open-chat frontend (THREAD-03/STUDIO-03): `useChatStream` SSE hook + `ChatThreadView` with empty state, cold-start nudge, and error state + live Chat chip + composer chat-send branch + markdown rehydration**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-18T10:29:23Z
- **Completed:** 2026-06-18T10:39:00Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- `useChatStream`: fetch+getReader SSE loop (NOT EventSource — BLOCKER-1); parses `meta{coldStart}`, `token{delta}`, `done`, `error`; exposes `coldStart`, `nudgeShown` (sticky session-level flag for D-08 gate), `error`, `toBlocks()` (MarkdownBlock[] for MessageBlocks)
- `ChatThreadView`: empty state (verbatim UI-SPEC copy), one-time cold-start nudge (D-08 — muted cream, never coral), chat-turn error state (W2 — "That answer didn't come through." / "Send it again, or rephrase."), persisted + streaming turns via MessageBlocks, `max-w-[760px] THEME-06 flat-warm`
- `tool-chips.tsx`: Chat chip flipped to `enabled: true` (D-05 — live P5)
- `composer.tsx`: `persistedChatBlocks` state, markdown block filter in `loadPersistedBlocks`, `chat.start()` branch in `handleSubmit` (no `pendingNavRef`, no `stream.start` — D-05 no silent auto-fire), `canSubmit` gated on `trimmedUrl.length > 0` for chat, `hasThread` includes chat signals, `showPlatformChip` includes chat, upload toggle hidden for chat, `ChatThreadView` render with `nudgeShown` + `coldStart` + `error` props

## Task Commits

1. **Task 1: useChatStream** — `f80e94a8` (feat)
2. **Task 2: ChatThreadView + live Chat chip + composer wiring** — `437518d4` (feat)

## Files Created/Modified

- `/Users/davideloreti/virtuna-numen-tools/src/hooks/queries/use-chat-stream.ts` — `useChatStream` + `UseChatStreamReturn` exports
- `/Users/davideloreti/virtuna-numen-tools/src/components/thread/chat-thread-view.tsx` — `ChatThreadView` + `ChatThreadViewProps` exports
- `/Users/davideloreti/virtuna-numen-tools/src/components/app/home/tool-chips.tsx` — Chat chip enabled
- `/Users/davideloreti/virtuna-numen-tools/src/components/app/home/composer.tsx` — chat stream wiring + markdown rehydration

## Decisions Made

- `nudgeShown` tracked as a sticky boolean inside `useChatStream` (not in `ChatThreadView` via `useEffect`) — the `react-hooks/set-state-in-effect` ESLint rule (severity 2) prevents `setState` inside effects. Exposing `nudgeShown` from the hook as a session-level boolean that's set on the first `meta{coldStart:true}` frame and never reset achieves identical semantics without the lint violation.
- `showChatView = activeTool === "chat"` is unconditional (unlike `showHooksView`/`showIdeasView` which gate on content existence) — `ChatThreadView` owns its own empty state, so it should always render when the chip is active.
- Chat chip `showPlatformChip` includes `chat` since the platform is passed to `POST /api/tools/chat` for grounding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint react-hooks/refs + react-hooks/set-state-in-effect violations**
- **Found during:** Task 2 (post-write ESLint check)
- **Issue:** Plan specified a `useRef` gate for one-time nudge in `ChatThreadView`. The `react-hooks/refs` rule (severity 2) blocks reading `ref.current` during render; the `react-hooks/set-state-in-effect` rule (severity 2) blocks `setState` inside `useEffect`.
- **Fix:** Moved the `nudgeShown` sticky flag into `useChatStream` as session-level state (set in the SSE parse loop, not an effect). `ChatThreadView` receives it as a prop. Semantics identical to plan; ESLint clean.
- **Files modified:** `src/hooks/queries/use-chat-stream.ts` (added `nudgeShown` state + return value), `src/components/thread/chat-thread-view.tsx` (accepts `nudgeShown` prop instead of local gate)
- **Committed in:** 437518d4

**2. [Rule 1 - Bug] Stash merge conflict in `.planning/config.json`**
- **Found during:** Task 2 commit
- **Issue:** A prior `git stash` (auto-wip from 2026-06-14) had a conflicting config.json version. The commit was blocked by the unresolved merge.
- **Fix:** Resolved conflict by keeping the upstream (HEAD) balanced model profile config.
- **Files modified:** `.planning/config.json`
- **Committed in:** 437518d4

---

**Total deviations:** 2 auto-fixed (Rule 1 — ESLint + stash conflict)
**Impact on plan:** Minimal — semantics preserved. `nudgeShown` API slightly richer than plan spec; no behavior change.

## Known Stubs

None. `ChatThreadView` renders real data from the SSE stream and open-thread rehydration. The `niche` prop is currently passed as `undefined` from composer (creator niche not yet surfaced in the composer scope) — the view falls back to the literal "your niche" in the nudge copy. This is intentional; niche is in the profile and can be wired in a future plan without any API change.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. `ChatThreadView` is a pure render component; `useChatStream` consumes the existing `/api/tools/chat` route.

## Self-Check: PASSED

- use-chat-stream.ts: FOUND
- chat-thread-view.tsx: FOUND
- Commit f80e94a8: FOUND
- Commit 437518d4: FOUND
