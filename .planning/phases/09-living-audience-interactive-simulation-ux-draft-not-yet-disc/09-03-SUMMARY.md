---
phase: 09-living-audience-interactive-simulation-ux
plan: 03
subsystem: audience-lens
tags: [audience-lens, chat-with-persona, persona-grounding, sub-thread, typed-block, theme-06, live-03]
requires:
  - "ChatPipelineInput/runChatPipeline from lib/tools/runners/chat-runner (P5 — extended additively)"
  - "assembleBundle <<<USER_CONTENT>>> fence from lib/kc/assembler (overrides ride the fence)"
  - "ARCHETYPE_DEFINITIONS + ARCHETYPE_TRIGGERS from lib/engine/wave3/persona-registry (READ ONLY)"
  - "insertMessage/loadMessages + BLOCK_REGISTRY/validateBlock (typed-block JSONB persistence, D-14)"
  - "AudienceLens shell + PersonaNode kit from 09-02 (the drawer mounts over the cloud)"
  - "/api/tools/chat SSE route (P5 — extended to accept personaGrounding)"
provides:
  - "ChatPipelineInput.personaGrounding — additive optional in-voice grounding param (byte-identical for non-persona chat)"
  - "persona-chat-turn typed block — sub-thread persistence in the existing grounded thread (NO migration)"
  - "PersonaChatDrawer — in-context chat-with-persona drawer, one persona at a time, scoped to the Read"
  - "GET /api/tools/chat?archetype — sub-thread rehydration endpoint (prior persona-chat turns)"
  - "PersonaNode.archetype — additive registry-enum field powering the Ask-them-why grounding"
  - "AudienceLens.conceptText/platform — additive props that mount the drawer + per-node CTA"
affects:
  - "W4 Population·1,000 swarm (the drawer pattern + sub-thread model are reusable at scale)"
  - "Future custom-persona chat (the persona-chat-turn block is the SSOT shape, v6.1+ D-05)"
tech-stack:
  added: []
  patterns:
    - "Additive optional param on a shipped runner (personaGrounding) — non-persona path stays byte-identical"
    - "System-prompt PREFIX from registry-derived (non-user) text; user concept/quote routed through the existing fenced overrides — never raw into the system prompt (Security Domain)"
    - "Sub-thread = subset of an existing thread's messages with a discriminated typed block (no new table, no parent_message_id)"
    - "SSE-frame parsing in a client drawer reusing the shipped chat route (no new streaming machinery)"
key-files:
  created:
    - "src/components/audience-lens/PersonaChatDrawer.tsx"
    - "src/components/thread/persona-chat-turn-block.tsx"
    - "src/lib/tools/runners/__tests__/chat-runner.test.ts"
  modified:
    - "src/lib/tools/runners/chat-runner.ts"
    - "src/lib/tools/blocks.ts"
    - "src/lib/tools/block-registry.ts"
    - "src/components/thread/message-blocks.tsx"
    - "src/app/api/tools/chat/route.ts"
    - "src/components/audience-lens/AudienceLens.tsx"
    - "src/components/board/_kit/PersonaGraph.tsx"
    - "src/components/board/audience/audience-derive.ts"
decisions:
  - "personaGrounding is additive + optional → the non-persona open-chat path is byte-identical (Test 1 green); zero fork of the chat runner"
  - "Persona DEFINITION (registry text, non-user) becomes the system-prompt prefix; conceptText + the persona's own reaction quote ride assembleBundle.overrides (the <<<USER_CONTENT>>> fence) — never raw into the system prompt (Security Domain / injection-safe)"
  - "ARCHETYPE_DEFINITIONS/ARCHETYPE_TRIGGERS are read field-by-field, never mutated — Test 3 asserts deep-equal on a pre-run snapshot (Pitfall 5 / landmine 4, cache byte-stability preserved)"
  - "NO migration required: persona-chat turns persist as persona-chat-turn typed blocks in the EXISTING thread (messages.body is a typed-block JSONB array; no parent_message_id column). The Read is already a thread (threads.reading_id)"
  - "Sub-thread rehydration via a new GET /api/tools/chat?archetype handler (auth-gated, archetype validated) — the open thread carries the turns; the drawer filters to the asked archetype"
  - "verdict for the persona reaction is derived from the node watch-through (≥0.5 → stop, else scroll) since PersonaNode carries no explicit verdict on the video surface"
  - "chat stays OUT of the SkillId union (landmine 8) — this is an in-context Read sub-thread, not a top-level skill"
metrics:
  duration: 9m
  completed: "2026-06-19T12:30:00Z"
  tasks: 3
  files: 12
---

# Phase 9 Plan 03: Chat-with-persona — in-voice grounded answers persisted within the Read Summary

Extended the shipped `chat-runner` with an **additive optional** `personaGrounding` param so a
tapped persona answers IN-VOICE about THIS concept — grounded on its persona-registry definition
(read-only) plus its reaction, with the concept/quote routed through the existing `<<<USER_CONTENT>>>`
fence. Added a `persona-chat-turn` typed block (NO migration) that persists the Q&A as a sub-thread
within the Read, built the in-context `PersonaChatDrawer` over the cloud (one persona at a time,
rehydrates on reopen), and mounted it in `AudienceLens` behind a per-node "Ask them why →" CTA.
The flagship cheatcode (D-03) works without forking the chat runner or mutating the persona registry.

## What Was Built

### Task 1 — chat-runner personaGrounding + tests (commit 9930abc5)
- `chat-runner.ts`: `ChatPipelineInput.personaGrounding?: { archetype; reactionToConcept:{verdict,quote}; conceptText }`.
  When present, `buildPersonaSystemPrefix(archetype, verdict)` READS `ARCHETYPE_DEFINITIONS` +
  `ARCHETYPE_TRIGGERS` (field-by-field, never mutated) and PREPENDS an in-voice persona instruction to
  `KC_CHAT_SYSTEM_PROMPT`. `serializePersonaReaction(...)` packs the concept + the persona's own quote
  into the FENCED `overrides` field of `assembleBundle` (Security Domain — never raw into the system
  prompt). Both anchors length-capped server-side (`PERSONA_ANCHOR_CAP`, WARNING-5). The stream / timeout /
  abort path (L168-205) and `isColdStart` are untouched.
- `chat-runner.test.ts`: 3 tests — (1) additive no-op: system prompt === `KC_CHAT_SYSTEM_PROMPT` and
  `overrides` undefined without grounding; (2) in-voice: persona definition prepended before the compiled
  prompt, concept/quote present in `overrides` and ABSENT from the system prompt; (3) immutability:
  `ARCHETYPE_DEFINITIONS`/`ARCHETYPE_TRIGGERS` deep-equal a pre-run snapshot. Registry + compiled prompt
  are NOT mocked (Test 3 observes the real module).

### Task 2 — persona-chat-turn typed block, NO migration (commit 81700b41)
- `blocks.ts`: `PersonaChatTurnBlockSchema { archetype, role: user|assistant, text }` + added to the union.
- `block-registry.ts`: registered `persona-chat-turn` (round-trips `loadMessages` validation, D-14).
- `persona-chat-turn-block.tsx` + `message-blocks.tsx`: a flat-warm renderer wired into the component map
  (TypeScript enforces registry/component completeness).
- **Migration disposition (researcher A1 flag):** **NO migration required.** Verified
  `supabase/migrations/20260617000000_threads_messages.sql`: `messages.body` is a typed-block JSONB array
  and there is NO `parent_message_id` column anywhere. The Read is ALREADY a thread (`threads.reading_id`);
  persona-chat turns persist as ordinary `messages` rows carrying `persona-chat-turn` blocks. The
  "sub-thread" is simply the subset of a thread's messages whose blocks are `persona-chat-turn` for a given
  archetype. No DDL change, no new column.

### Task 3 — PersonaChatDrawer + route wiring + AudienceLens mount (commit 58294eb6)
- `api/tools/chat/route.ts`: `parsePersonaGrounding(...)` validates + length-caps the body param (archetype
  ∈ registry enum, verdict ∈ stop|scroll, concept/quote capped). When present, prior turns load filters
  `persona-chat-turn` blocks SCOPED to the archetype, and BOTH turns persist as `persona-chat-turn` blocks
  (open chat path unchanged: markdown blocks). New `GET ?archetype` handler rehydrates the sub-thread
  (auth-gated, archetype validated).
- `PersonaChatDrawer.tsx` (`'use client'`): in-context bottom-sheet over the cloud, one persona at a time.
  POSTs `{ ask, personaGrounding }`, parses the SSE frames token-by-token, GET-loads prior turns on open,
  appends new turns. Error path reuses the shipped `SkillRunError` look with the verbatim UI-SPEC copy
  ("Couldn't reach the audience right now. Your concept is saved — try again in a moment."). Empty prompt
  copy "Ask {archetype} why they reacted this way." Flat-matte THEME-06, never coral.
- `AudienceLens.tsx`: additive `conceptText` / `platform` props. When `conceptText` is present, a per-node
  "Ask them why →" CTA list opens the drawer with `{ archetype, reactionToConcept }`; the drawer mounts
  alongside the sheet. One persona at a time (`chatTarget` single-state).
- `PersonaGraph.tsx` + `audience-derive.ts`: additive `PersonaNode.archetype` (default-undefined) sourced
  from the heatmap persona's `archetype` — existing call sites compile byte-identical.

## Verification

- `npx vitest run src/lib/tools/runners/__tests__/chat-runner.test.ts` → 3 passed / 0 failed (additive
  no-op + in-voice grounding + registry immutability).
- `ARCHETYPE_DEFINITIONS`/`ARCHETYPE_TRIGGERS` byte-identical after grounded runs (Test 3 — no cache
  invalidation, landmine 4).
- Related suites (`persona-cloud.test.tsx`, `kit.test.tsx`) → 40 passed / 0 failed — the additive
  PersonaNode/buildPersonaNodes change broke nothing.
- `grep personaGrounding src/lib/tools/runners/chat-runner.ts` + `…/route.ts` → present.
- `grep persona-chat-turn src/lib/tools/blocks.ts` → present + registered.
- `chat` absent from the `SkillId` union (`grep "'chat'" src/lib/tools/chain-handoff.ts` → none; landmine 8).
- Concept/quote fenced via `assembleBundle.overrides`; never in the system prompt (Test 2 asserts both).
- `npm run build` → compiled successfully (exit 0). Lint clean on all created/modified source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PersonaNode carried no archetype enum needed for grounding**
- **Found during:** Task 3
- **Issue:** The "Ask them why →" CTA needs the persona-registry archetype enum to ground the chat, but
  `PersonaNode` (from 09-02) only carried a display `label` + the `persona_id` (e.g. `fyp-1-tough_crowd-beauty`),
  not the clean `Archetype` enum the runner + route validate against.
- **Fix:** Added an additive, default-undefined `PersonaNode.archetype?: string` and sourced it from the
  heatmap persona's `archetype` in `buildPersonaNodes`. Existing call sites compile byte-identical.
- **Files modified:** src/components/board/_kit/PersonaGraph.tsx, src/components/board/audience/audience-derive.ts
- **Commit:** 58294eb6

**2. [Rule 2 - Missing critical functionality] Sub-thread rehydration needed a read endpoint**
- **Found during:** Task 3
- **Issue:** The plan requires the drawer to rehydrate prior persona-chat turns on reopen, but `/api/tools/chat`
  only had a POST (stream) handler — there was no auth-gated read path to fetch the existing sub-thread.
- **Fix:** Added a `GET /api/tools/chat?archetype=…` handler (auth gate, archetype validated against the
  registry enum, read-only) returning the open thread's `persona-chat-turn` turns for that archetype.
- **Files modified:** src/app/api/tools/chat/route.ts
- **Commit:** 58294eb6

### Out of scope (not fixed — pre-existing)

- `npx tsc --noEmit` reports ~46 errors in pre-existing test files (`messages.test.ts`, `hooks-runner.test.ts`,
  `ideas-runner.test.ts`, `script-runner.test.ts`, `open-thread.test.ts`) that this plan did not touch. These
  pre-date this work (the files are unchanged in this plan's diff) and vitest tolerates them; the Next
  production build excludes test files and compiles clean. My own `chat-runner.test.ts` is tsc-clean.

## Notes for Downstream

- **verdict heuristic:** on the video Reading surface `PersonaNode` has no explicit stop/scroll verdict, so the
  CTA derives it from watch-through (≥0.5 → stop). When a surface carries a real verdict (skill Read cards via
  `MultiAudienceReadBlock.personas[].verdict`), pass it through instead of the heuristic.
- **conceptText source:** AudienceLens omits the drawer when `conceptText` is absent (the video surface mounts
  AudienceLens without it today). Skill surfaces (Ideas/Hooks Reads) should pass the concept text so the cheatcode
  lights up there — wire `conceptText` at those mount sites.
- **persona-chat-turn is the SSOT shape** for future custom-persona chat (v6.1+ D-05).

## Self-Check: PASSED

- FOUND: src/components/audience-lens/PersonaChatDrawer.tsx
- FOUND: src/components/thread/persona-chat-turn-block.tsx
- FOUND: src/lib/tools/runners/__tests__/chat-runner.test.ts
- Commits FOUND: 9930abc5, 81700b41, 58294eb6
