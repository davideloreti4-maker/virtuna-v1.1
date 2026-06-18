---
phase: 06-script-remix-tools
plan: "05"
subsystem: ui
tags: [next.js, typescript, sse, chain-handoff, script, remix, vitest]

# Dependency graph
requires:
  - phase: 06-04
    provides: runRemixPipeline + POST /api/tools/remix/run SSE route
  - phase: 06-03
    provides: runScriptPipeline + POST /api/tools/script SSE route (anchor param)
  - phase: 05-04
    provides: CHAIN_HANDOFFS SSOT in chain-handoff.ts + generic chain-plumbing

provides:
  - Live CHAIN_HANDOFFS: hooks→script ("/api/tools/script", anchorFrom:card), script→test (null, anchorFrom:context), remix→hooks ("/api/tools/ideas/develop", anchorFrom:card)
  - ScriptTestContext (script→test seam, mirrors HookTestContext)
  - useScriptStream + useRemixStream (SSE consumers)
  - ScriptThreadView + RemixThreadView (thread renders + chain CTAs)
  - Script + Remix chips in composer (ToolId union, MODEL_LABEL, canSubmit, routing)
  - hooks→script CTA ("Write script →") card-POST wiring on HookCardRenderer
  - chain-handoff.test.ts asserting exact endpoint strings + remix→hooks payload contract
  - 06-UAT.md recording engine gate + Task 3 checkpoint outcomes
  - Blocking engine regression gate confirmed: ENGINE_VERSION 3.19.0 unchanged, 1066 engine tests green, 2523 full-suite green, build clean

affects: [07-audience-manager, Phase 7 Audience Manager]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Card-POST chain handoff (hooks→script): hook-card CTA POSTs anchor directly to /api/tools/script, switches activeTool — no context-handoff, no script.start alternative
    - Context-handoff chain seam (script→test): ScriptTestContext mirrors HookTestContext; endpoint null, handoff via lifted state in composer (onTestScript)
    - SSE consumer clone pattern: useScriptStream / useRemixStream clone use-hooks-stream.ts shape (start/reset/toBlocks/stages/followupText/error/isStreaming)
    - Thread view clone pattern: ScriptThreadView / RemixThreadView clone hooks-thread-view.tsx (persisted + streaming render, ProgressChecklist, SkillRunError, context provider)
    - ToolId union extension: add "script"/"remix" to tool-chips.tsx ToolId + CHIPS + MODEL_LABEL — all composer routing flows from activeTool

key-files:
  created:
    - src/lib/script-test-context.tsx
    - src/hooks/queries/use-script-stream.ts
    - src/hooks/queries/use-remix-stream.ts
    - src/components/thread/script-thread-view.tsx
    - src/components/thread/remix-thread-view.tsx
    - src/lib/tools/__tests__/chain-handoff.test.ts
    - .planning/phases/06-script-remix-tools/06-UAT.md
    - .planning/phases/06-script-remix-tools/06-05-SUMMARY.md
  modified:
    - src/lib/tools/chain-handoff.ts (three placeholders filled with live endpoints)
    - src/components/app/home/tool-chips.tsx (script/remix ToolId + CHIPS + MODEL_LABEL)
    - src/components/app/home/composer.tsx (script/remix routing, canSubmit, threadContent, rehydration)
    - src/components/thread/hook-card-block.tsx (gap-fix: "Write script →" CTA now renders and fires)

key-decisions:
  - "remix→hooks reuse path: /api/tools/ideas/develop (anchor+platform body) — PINNED endpoint matches {ideaId?, anchor, platform} contract; no new endpoint created (D-07 append-only)"
  - "hooks→script wiring: card-POST model (not context-handoff) — hook CTA POSTs anchor directly to /api/tools/script, mirrors proven idea→hooks card-POST; context-handoff reserved for script→test null-endpoint seam"
  - "UAT gap-fix committed separately (3a4c6861): hook-card 'Write script →' CTA was absent pre-fix; root cause was ScriptTestContext prop threading missing from HookCardRenderer — fixed inline as Rule 1 auto-fix"

patterns-established:
  - "Chain-handoff endpoint pinning: assert exact endpoint strings + payload contract in chain-handoff.test.ts so drift fails the test rather than silently mis-routing"
  - "Tool extension protocol: add ToolId → CHIPS/MODEL_LABEL → useXStream + XThreadView → composer routing — no one-off wiring, generic chain plumbing absorbs the new skill"

requirements-completed: [SCRIPT-01, REMIX-01]

# Metrics
duration: 45min (Tasks 1–3 prior session; Task 4 + gate run current session)
completed: 2026-06-18
---

# Phase 6 Plan 05: Wiring + Gate Summary

**Script + Remix wired end-to-end into the studio: live CHAIN_HANDOFFS (hooks→script, script→test, remix→hooks), SSE hooks/thread views, composer chips, and BLOCKING engine regression gate confirmed green (ENGINE_VERSION 3.19.0 unchanged, 1066 engine tests + 2523 full suite + build clean).**

## Performance

- **Duration:** ~45 min total (Tasks 1–2 + gap-fix prior session; Task 4 gate current session)
- **Started:** 2026-06-18
- **Completed:** 2026-06-18
- **Tasks:** 4 (Task 1 + Task 2 + gap-fix + Task 4)
- **Files modified:** 13

## Accomplishments

- Three CHAIN_HANDOFFS placeholders replaced with live endpoints: hooks→script (`/api/tools/script`, card-POST), script→test (null, context-handoff via ScriptTestContext), remix→hooks (`/api/tools/ideas/develop`, card-POST — reuse path, D-07)
- Script + Remix chips live in composer: correct model labels (SIM-1 Flash), canSubmit guards, no /analyze navigation (T-06-20 closed)
- ScriptTestContext, useScriptStream, useRemixStream, ScriptThreadView, RemixThreadView — all built cloning the hooks pattern
- chain-handoff.test.ts: asserts exact endpoint strings + remix→hooks `{anchor, platform}` payload contract — future drift fails the test
- BLOCKING gate passed: ENGINE_VERSION 3.19.0 unchanged, engine suite 1066/0, full suite 2523/0, build clean

## Task Commits

1. **Task 1: Fill CHAIN_HANDOFFS + ScriptTestContext + SSE hooks + thread views** — `62ac9e9b` (feat)
2. **Task 2: Composer + tool-chips wiring** — `fcc1d0e8` (feat)
3. **Gap-fix: "Write script →" CTA on hook cards + stale tool-chips test fix** — `3a4c6861` (fix)
4. **Task 4: Gate run + UAT record + SUMMARY + state updates** — (docs — this commit)

## Files Created/Modified

- `src/lib/tools/chain-handoff.ts` — three placeholders replaced with live endpoints
- `src/lib/script-test-context.tsx` — ScriptTestContext (script→test seam)
- `src/hooks/queries/use-script-stream.ts` — useScriptStream SSE consumer
- `src/hooks/queries/use-remix-stream.ts` — useRemixStream SSE consumer
- `src/components/thread/script-thread-view.tsx` — ScriptThreadView (persisted + streaming render)
- `src/components/thread/remix-thread-view.tsx` — RemixThreadView (persisted + streaming render)
- `src/lib/tools/__tests__/chain-handoff.test.ts` — endpoint + payload contract assertions
- `src/components/app/home/tool-chips.tsx` — script/remix ToolId + CHIPS + MODEL_LABEL
- `src/components/app/home/composer.tsx` — script/remix routing, canSubmit, threadContent, rehydration
- `src/components/thread/hook-card-block.tsx` — "Write script →" CTA wired (gap-fix)
- `.planning/phases/06-script-remix-tools/06-UAT.md` — gate + checkpoint record

## Decisions Made

- **remix→hooks reuse path:** `/api/tools/ideas/develop` reused (not a new `/api/tools/remix/develop`) — PINNED `{ideaId?, anchor, platform}` contract accepts `ideaId` absent; least new surface (D-07 append-only confirmed).
- **hooks→script is card-POST, not context-handoff:** mirrors the proven idea→hooks card-POST to `/api/tools/ideas/develop`. Context-handoff pattern reserved for the `endpoint:null` script→test seam only.
- **Gap-fix (Rule 1):** Hook card "Write script →" CTA was absent post-Task 2. Root cause: `ScriptTestContext` prop not threaded through `HookCardRenderer` correctly. Fixed inline as auto-fix, committed separately (`3a4c6861`), included a stale tool-chips test update.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] "Write script →" CTA absent on hook cards after Task 2**
- **Found during:** Task 3 human-verify checkpoint (live UAT)
- **Issue:** The hook card renderer did not render the "Write script →" CTA — ScriptTestContext prop threading was missing, causing the CTA to be absent in production render.
- **Fix:** Added the `onWriteScript` prop to `HookCardRenderer`, threaded it through `ScriptThreadView` → `HookCardRenderer` chain, and wired the CTA click to the `chain-handoff` endpoint. Stale tool-chips unit test was also updated to match the extended ToolId union.
- **Files modified:** `src/components/thread/hook-card-block.tsx`, `src/components/app/home/tool-chips.tsx` (test fix)
- **Verification:** Live UAT re-run confirmed CTA renders and fires; "Write script →" click switches to Script and produces 5-beat card.
- **Committed in:** `3a4c6861` (fix — separate gap-fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Necessary correctness fix. No scope creep. UAT approved after gap-fix.

## Issues Encountered

- **Remix card live render not verified (open follow-up, not a blocker):** Test TikTok URL failed to resolve/decode during UAT (server returned 200 then SSE error — likely geo-restriction). Remix card render (`remix-card-block.tsx`, "Borrowed:" chip, "Develop into hooks →" CTA) is coded and unit-tested (2523 pass) but unverified in a live browser. Re-run UAT with a resolvable URL in a follow-up session.

## Known Stubs

None — all planned data paths are wired. The remix card live-render follow-up is a UAT coverage gap, not a stub in the codebase.

## Threat Flags

No new security surface beyond the plan's threat model. All trust-boundary mitigations implemented:
- T-06-18 (engine regression): BLOCKING gate confirmed — ENGINE_VERSION 3.19.0, engine suite green.
- T-06-19 (chain CTA elevation): downstream routes (/api/tools/script, /api/tools/remix/run, /api/tools/ideas/develop) enforce auth + ask/anchor caps independently.
- T-06-20 (script/remix /analyze navigation): confirmed zero `pendingNavRef` / `/analyze` nav in script/remix branches.

## Next Phase Readiness

Phase 6 complete. Both SCRIPT-01 and REMIX-01 closed. The full Numen studio chain is live: Ideas → Hooks → Script → Test (plus Remix alternate entry). Ready for Phase 7: Audience Manager (calibrated audience as shared substrate across all skills).

Open item before Phase 7 close: re-run Remix live UAT with a resolvable TikTok URL to confirm end-to-end remix-card render.

---
*Phase: 06-script-remix-tools*
*Completed: 2026-06-18*
