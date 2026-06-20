---
id: thread-lifecycle-new-simulation-clear
title: "New Simulation does not start a fresh thread — open thread is a never-closed singleton"
type: bug
severity: high
created: 2026-06-20
source: Phase 14 live UAT (user-reported)
resolves_phase: null
area: threads / composer / IA
---

## Symptom

Starting a "new" thread (or switching skill in the composer, or hitting **New Simulation ⌘N**)
does **not** clear prior content — old idea/hook/chat cards from earlier runs rehydrate and
persist. Affects **all text skills** (ideas, hooks, script, chat, refine), because they all
share one thread.

## Root cause

- There is exactly **one "open thread" per user** — a DB singleton enforced by
  `threads_open_user_unique_idx` (migration `20260618000000`), `type='open' AND reading_id IS NULL`.
- Every text-skill route calls `createOpenThreadLazy(user.id)` and writes into **that same thread**
  (`src/lib/threads/threads.ts:134`; callers in `src/app/api/tools/{ideas,hooks,script,chat,read,refine}/route.ts`).
- **"New Simulation"** (`src/components/sidebar/Sidebar.tsx:312`) calls
  `triggerNewAnalysis()` → `board-store.ts:239`, which only resets the **client** zustand store to
  `DEFAULT_STATE` + bumps `newAnalysisSignal`. It never tells the server to close the open thread.
- There is **no close/archive mechanism** anywhere (no `closeThread`, no `closed_at`, no status col
  on `threads`). So `/home` re-hydrates the same accumulated open thread forever.

Net: "New Simulation" is a client-only reset; the server keeps serving the one growing open thread.

## Proposed fix (dedicated — needs a schema migration)

1. **Migration:** add `threads.closed_at TIMESTAMPTZ NULL`. Change the partial unique index to
   `WHERE type='open' AND reading_id IS NULL AND closed_at IS NULL` so a fresh open thread can exist
   after the prior one is closed.
2. **Query:** `getOpenThread` / `createOpenThreadLazy` filter `closed_at IS NULL`.
3. **Close route:** `POST /api/threads/close-open` → sets `closed_at = now()` on the user's open thread
   (idempotent; no-op if none). Closed open-threads become history.
4. **Wire:** "New Simulation" (and `triggerNewAnalysis`) calls the close route before `router.push("/home")`.
   Decide product behavior for empty open threads (discard vs keep) and whether closed text-threads
   surface in the sidebar history (currently only grounded/video Readings show).

## Scope note

Pre-existing — **not** introduced by Phase 14 (14-04 only changed card *rendering*). Surfaced during
the Phase 14 UAT. Kept out of Phase 14 to avoid folding a thread-lifecycle + migration change into a
KC-grounding phase.
