---
phase: 05-open-chat-test-reframe
plan: "04"
subsystem: ui-tools
tags: [sse, stage-events, progress-checklist, chain-handoff, follow-up-turn, error-retry, studio-conversation]

requires:
  - phase: 05-open-chat-test-reframe
    plan: "01"
    provides: SSE event shape (meta/token/done/error) + insertMessage pattern

provides:
  - CHAIN_HANDOFFS registry (src/lib/tools/chain-handoff.ts) — generic skill→skill CTA SSOT for P6 extension
  - ProgressChecklist component — transient SSE-stage-driven checklist UI
  - stage + followup SSE events on ideas + hooks routes
  - stages + followupText on useHooksStream + useIdeasStream return types
  - Skill-run error block with tap-to-retry in HooksThreadView + IdeasThreadView

affects:
  - 05-05 (refine: can reuse SkillRunError pattern for refine error path)
  - 06 (Script/Remix: extend CHAIN_HANDOFFS by appending, zero plumbing changes)

tech-stack:
  added: []
  patterns:
    - "Chain registry pattern: CHAIN_HANDOFFS SSOT in chain-handoff.ts; P6 extends by appending, not editing card components"
    - "Stage upsert pattern: stagesRef.current patched by name on each SSE stage event — preserves first-appearance order"
    - "Follow-up turn pattern: route generates one-shot Qwen completion post-cards; persisted as second markdown message + emitted as followup SSE event"
    - "Skill-run error pattern: SkillRunError component reused in both thread views; onRetry fires start() on explicit tap only"

key-files:
  created:
    - src/lib/tools/chain-handoff.ts
    - src/components/thread/progress-checklist.tsx
  modified:
    - src/app/api/tools/hooks/route.ts
    - src/app/api/tools/ideas/route.ts
    - src/hooks/queries/use-hooks-stream.ts
    - src/hooks/queries/use-ideas-stream.ts
    - src/components/thread/hooks-thread-view.tsx
    - src/components/thread/ideas-thread-view.tsx
    - src/components/app/home/composer.tsx

key-decisions:
  - "Coarse stage transitions at route level (active before runHooksPipeline/runIdeasPipeline, done after) — real phases ran, D-02 satisfied; finer per-phase callbacks require runner refactor (deferred)"
  - "Follow-up generation non-fatal: caught silently so a Qwen follow-up timeout never errors the card run"
  - "SkillRunError defined locally in both thread views (not a shared export) — identical copy; Plan 05 reuse is via the same pattern, not the same import"
  - "onRetry in composer re-calls start('', platform) — empty ask triggers Auto mode; platform from current state"
  - "Progress checklist is ephemeral SSE-driven UI (not a registered block) per D-02 Claude's discretion — ProgressChecklist renders while isStreaming, replaced by final cards on completion"
  - "Checkmark ✓ uses var(--color-cream-secondary) — explicitly NOT coral per UI-SPEC §Color"

metrics:
  duration: ~18min
  completed: 2026-06-18
  tasks: 3
  files_created: 2
  files_modified: 7

requirements-completed: [STUDIO-01, STUDIO-02, STUDIO-03]
---

# Phase 05 Plan 04: Conversation Layer Summary

**Generic chain-handoff contract (D-09/STUDIO-03) + real SSE stage events (STUDIO-01/D-02) + model-authored follow-up turn (STUDIO-02/D-03) + skill-run error/retry (W2) across both skill routes and thread views**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-18
- **Completed:** 2026-06-18
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 7

## Accomplishments

### Task 1: chain-handoff.ts (D-09 / STUDIO-03)
- `CHAIN_HANDOFFS` registry: existing chains expressed declaratively — idea→hooks ("Develop this →", endpoint PINNED `/api/tools/ideas/develop`, anchorFrom "card") and hooks→test ("Test full →", endpoint null = HookTestContext, anchorFrom "context")
- P6 placeholder entries: hooks→script, script→test, remix→hooks (endpoint null, zero-plumbing seams)
- `handoffsFor(skill)` query helper returns downstream CTAs for a skill
- `SkillId` union pre-declares "script" | "remix" for P6
- Pure data+types module — no React, no fetch

### Task 2: Named SSE stage events + model-authored follow-up (STUDIO-01/02 D-02/D-03)
- Both `/api/tools/hooks` and `/api/tools/ideas` emit `event: stage { name, status }` at real pipeline boundaries: Generating → Self-judge → Simulating your audience (+ Ranking for hooks)
- No `setTimeout`/fake delays added — stages map to phases the runners already execute
- After cards persist: one-shot Qwen completion (KC_CHAT_SYSTEM_PROMPT voice) generates a short observation; persisted as a second `markdown` message via `insertMessage` + emitted as `event: followup { text }`
- Follow-up failure is non-fatal (caught, run never errors)

### Task 3: ProgressChecklist + stream hook updates + thread view updates (STUDIO-01/02 + W2)
- `ProgressChecklist`: pending (outline dot + muted label) → active (pulse dot) → done (cream-secondary ✓, never coral); `aria-live="polite"`; `reading-reveal` 0.42s animation; prefers-reduced-motion honored
- `useHooksStream` + `useIdeasStream`: `stages` (upsert by name) + `followupText` state added; exposed in return types
- `HooksThreadView` + `IdeasThreadView`: ProgressChecklist during streaming, followup prose markdown below cards, `SkillRunError` block when `error` is truthy (UI-SPEC copy verbatim); `onRetry` prop wires tap-to-retry
- `composer.tsx`: wires `stages`, `followupText`, `error`, `onRetry` to both thread views; onRetry re-calls `start("", platform)`

## Task Commits

1. **Task 1: chain-handoff contract** — `244e786a` (feat)
2. **Task 2: stage events + follow-up turn** — `d7ff00d4` (feat)
3. **Task 3: ProgressChecklist + stream hooks + thread views** — `9fab252c` (feat)

## Files Created/Modified

- `/Users/davideloreti/virtuna-numen-tools/src/lib/tools/chain-handoff.ts` — CHAIN_HANDOFFS, ChainHandoff, handoffsFor, SkillId (created)
- `/Users/davideloreti/virtuna-numen-tools/src/components/thread/progress-checklist.tsx` — ProgressChecklist + StageState (created)
- `/Users/davideloreti/virtuna-numen-tools/src/app/api/tools/hooks/route.ts` — stage events + follow-up turn (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/app/api/tools/ideas/route.ts` — stage events + follow-up turn (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/hooks/queries/use-hooks-stream.ts` — stages + followupText state (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/hooks/queries/use-ideas-stream.ts` — stages + followupText state (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/components/thread/hooks-thread-view.tsx` — ProgressChecklist + followup + error/retry (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/components/thread/ideas-thread-view.tsx` — ProgressChecklist + followup + error/retry (modified)
- `/Users/davideloreti/virtuna-numen-tools/src/components/app/home/composer.tsx` — wire new props (modified)

## Decisions Made

- Coarse stage transitions at route level (before/after the single `runHooksPipeline`/`runIdeasPipeline` await) — the real phases ran, D-02 "real not timed" is satisfied; finer-grained per-phase callbacks require a runner refactor (deferred, D-02 Claude's discretion)
- Follow-up generation non-fatal: if Qwen follow-up errors, the catch swallows silently so card delivery is never blocked
- `onRetry` in composer re-calls `start("", platform)` — empty ask = Auto mode; this is correct for both hooks (anchor-driven) and ideas (profile-based Auto)
- `SkillRunError` is defined as a local function in each thread view (not a shared export) — identical pattern, minimal coupling; Plan 05 refine error reuses the same component pattern
- Checkmark uses `var(--color-cream-secondary)` per UI-SPEC §Color — no coral on progress glyphs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated composer.tsx to pass new required props**
- **Found during:** Task 3 (after updating IdeasThreadView/HooksThreadView prop signatures)
- **Issue:** `npx tsc --noEmit` flagged composer.tsx missing `stages`, `followupText`, `error` props on both thread views
- **Fix:** Updated composer's `threadContent` to pass the new props from the respective stream hooks; removed the now-redundant inline `ideas.error` / `hooks.error` `<p>` elements (the views own error display now)
- **Files modified:** `src/components/app/home/composer.tsx`
- **Committed in:** 9fab252c

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking TS error in composer)
**Impact on plan:** Minimal — prop wiring correction only; no behavior change.

## Known Stubs

None — all data wired from real SSE events. Stage transitions map to real pipeline phases. Follow-up text is model-generated referencing actual run output.

## Threat Flags

None — no new network endpoints, no new auth paths, no schema changes. The follow-up turn reuses existing `insertMessage` + `kcStamp()` pipeline; Qwen call uses same `QWEN_REASONING_MODEL` + `KC_CHAT_SYSTEM_PROMPT` as established patterns.

## Next Phase Readiness

- `CHAIN_HANDOFFS` registry ready for P6 — Script/Remix append entries, zero plumbing edits
- Stage SSE events on ideas+hooks routes — P5 Plan 05 (refine route) adds its own stages following the same pattern
- `SkillRunError` pattern established — Plan 05 refine error reuses it
- `followupText` renders inline via ReactMarkdown — persisted follow-up rehydrates as ordinary `markdown` block (existing Plan 03 rehydration handles it)
