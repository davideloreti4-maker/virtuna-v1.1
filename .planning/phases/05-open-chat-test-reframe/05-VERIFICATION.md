---
phase: 05-open-chat-test-reframe
verified: 2026-06-18T13:22:00Z
status: human_needed
score: 18/18 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open chat live render — select Chat chip, send a message, watch the answer stream token-by-token into the open-thread column, then reload and confirm both turns rehydrate."
    expected: "Empty state ('Ask anything about your content.') on first open; streamed grounded markdown answer; both user + assistant turns persist and reappear after reload."
    why_human: "Real-time SSE token rendering + reload rehydration are runtime/visual behaviors grep cannot observe (server + DB required)."
  - test: "Perplexity-style progress checklist — run Ideas or Hooks and watch the stage rows (Generating → Self-judge → Simulating your audience → Ranking) flip to checkmarks."
    expected: "Stage rows reveal top-down with coral-free ✓ glyphs, calm motion, no fake-timer pacing; cards then stream content-first; a model follow-up turn appears after the cards."
    why_human: "Stage animation timing/appearance and content-first ordering are visual; only verifiable in a live run."
  - test: "Chat-to-refine core loop — type 'make hook 1 punchier' after generating hooks."
    expected: "A NEW hook card appears inline with its OWN fresh band chip (not the prior score) + a one-line model note; original card is not overwritten (append-only)."
    why_human: "Requires a live SIM-1 run to confirm the fresh band differs from the original; visual inline card placement."
  - test: "One-time cold-start nudge — chat on a thin/empty profile account."
    expected: "A single muted nudge line ('Heads up — your profile is light…') renders once, not on every subsequent turn."
    why_human: "Once-per-session gating + thin-profile path need a live thin-profile account."
  - test: "Test reframe hero — open any Reading."
    expected: "Hero label reads 'Test' with a subtle coral 'powered by SIM-1 Max' tag; the score gauge + stats render identically to before (score math unchanged)."
    why_human: "Visual appearance of the relabeled hero + tag treatment."
  - test: "Suggested chain CTA + failure retry — complete a pure-chat answer; force a skill-run failure."
    expected: "A tappable 'Turn this into hooks →' CTA appears and fires ONLY on tap; a failed run shows 'Couldn't finish that run.' with a tap-to-retry control."
    why_human: "Error-path triggering + tap-only CTA behavior need live interaction."
---

# Phase 5: Studio Conversation Layer — Verification Report

**Phase Goal:** Make the studio feel like ONE conversation: profile-grounded open chat (no anchoring Reading) + Reading reframed as "Test · powered by SIM-1 Max" + Perplexity-style progress, cards embedded in chat, chat-to-refine (scoped re-run → re-tested card), and the generic skill-to-skill chain plumbing.
**Verified:** 2026-06-18T13:22:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Open chat: grounded streamed markdown answer (not generic chatbot) | ✓ VERIFIED | `chat-runner.ts` calls `assembleBundle({mode:"chat"})` + `KC_CHAT_SYSTEM_PROMPT`, streams Qwen `QWEN_REASONING_MODEL` `stream:true` (lines 135-171) |
| 2 | Thin profile degrades + `coldStart` boolean on stream (D-08) | ✓ VERIFIED | `isColdStart` mirrors assembler `isProfileThin` (chat-runner 79-88); route emits `send("meta",{coldStart})` first (route 156) |
| 3 | Chat turns persist as markdown in single open thread (type:open, reading_id NULL) | ✓ VERIFIED | route persists user (132-137) + assistant (165-170) via `insertMessage` on `createOpenThreadLazy` thread |
| 4 | Chat chip live; composer routes chat sends to chat stream | ✓ VERIFIED | tool-chips `{id:"chat", enabled:true}` (45); composer `activeTool==="chat"` branch → `chat.start` (300-362) |
| 5 | No silent auto-fire; chat send never navigates | ✓ VERIFIED | chat branch never sets `pendingNavRef`/`stream.start` (297-298 comments + verified absent in branch); skill fires only on explicit send/tap |
| 6 | Persisted markdown chat turns rehydrate (THREAD-05) | ✓ VERIFIED | composer `loadPersistedBlocks` filters `b.type==='markdown'` → `setPersistedChatBlocks` (217-220) → ChatThreadView `persistedBlocks` (495) |
| 7 | Empty state copy renders | ✓ VERIFIED | chat-thread-view "Ask anything about your content." + "not a generic chatbot" (118-121) |
| 8 | One-time cold-start nudge gated on coldStart (D-08) | ✓ VERIFIED | chat-thread-view nudge string (136) gated on `coldStart` prop with once flag; never coral |
| 9 | Failed chat turn shows UI-SPEC error copy | ✓ VERIFIED | "That answer didn't come through." + "Send it again, or rephrase." (209-212) off `error` prop |
| 10 | TEST-01: hero "Test · powered by SIM-1 Max" (presentation only) | ✓ VERIFIED | reading-hero label="Test" + "powered by SIM-1 Max" tag (132-143); 0 engine imports; ScoreGauge/score props untouched |
| 11 | Test landing brief above upload (D-06 sub-line) | ✓ VERIFIED | composer testBrief "Shoot this hook → upload → SIM-1 Max scores the real thing" (566) |
| 12 | STUDIO-01: real pipeline-stage SSE progress, no fake timers | ✓ VERIFIED | hooks/ideas routes emit `send("stage",{name,status})` for Generating/Self-judge/Simulating your audience/Ranking; `setTimeout` count = 0 in both routes |
| 13 | ProgressChecklist transient UI | ✓ VERIFIED | progress-checklist.tsx pending/active/done rows, `aria-live="polite"`, coral-free ✓, reading-reveal motion |
| 14 | STUDIO-02: model-authored follow-up turn after cards | ✓ VERIFIED | hooks/ideas routes one-shot Qwen + `KC_CHAT_SYSTEM_PROMPT`, persist 2nd markdown msg, emit `event: followup` (routes ~233-260) |
| 15 | STUDIO-02 core loop: scoped re-run → NEW freshly-SIM-scored card, never untested rewrite | ✓ VERIFIED | refine route calls `runHooksPipeline`/`runIdeasPipeline` (fresh SIM by construction), takes top survivor, emits its own band/fraction, appends new card (159-262); test asserts fresh score |
| 16 | Refine intent detected by card reference; no false-positive fire | ✓ VERIFIED | refine.ts `detectRefineIntent` (verb+noun+ordinal); test: "what should I post this week?" → isRefine false |
| 17 | STUDIO-03: generic chain-handoff contract; P6 plugs in by appending | ✓ VERIFIED | chain-handoff.ts exports `CHAIN_HANDOFFS`/`ChainHandoff`/`handoffsFor`; idea→hooks + hooks→test live, script/remix placeholders (endpoint:null) |
| 18 | Tap-to-launch suggested CTA, never auto-fires | ✓ VERIFIED | chat-thread-view CTA from `handoffsFor`, fires on `onClick` only (183), no useEffect; composer `onSuggestChain` wired (503) |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/tools/runners/chat-runner.ts` | runChatPipeline + isColdStart | ✓ VERIFIED | 184 lines, both exported, Qwen-only, no engine scoring import |
| `src/app/api/tools/chat/route.ts` | POST SSE + persistence + coldStart | ✓ VERIFIED | 188 lines, auth gate, cap, meta/token/done/error, dual insertMessage |
| `src/hooks/queries/use-chat-stream.ts` | useChatStream (getReader, coldStart, error) | ✓ VERIFIED | 229 lines, fetch+getReader, exposes coldStart/error/toBlocks |
| `src/components/thread/chat-thread-view.tsx` | ChatThreadView (empty/nudge/error/CTA) | ✓ VERIFIED | 218 lines, all copy + tap-only CTA |
| `src/lib/tools/chain-handoff.ts` | CHAIN_HANDOFFS / ChainHandoff / handoffsFor | ✓ VERIFIED | 169 lines, pure module, no react/fetch |
| `src/components/thread/progress-checklist.tsx` | ProgressChecklist | ✓ VERIFIED | 147 lines, aria-live, coral-free ✓ |
| `src/lib/tools/refine.ts` | detectRefineIntent + buildRefineAnchor | ✓ VERIFIED | 220 lines, pure module |
| `src/app/api/tools/refine/route.ts` | POST scoped re-run | ✓ VERIFIED | 351 lines, real pipeline, append-only, error frame |
| `src/components/reading/reading-hero.tsx` | Hero Test + SIM-1 Max tag | ✓ VERIFIED | 191 lines, no engine import, gauge untouched |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| chat/route.ts | assembleBundle({mode:'chat'}) | chat-runner grounding | ✓ WIRED |
| chat/route.ts | insertMessage (user+assistant markdown) | post-stream persistence | ✓ WIRED |
| chat/route.ts | event: meta {coldStart} | D-08 signal | ✓ WIRED |
| tool-chips.tsx | Chat chip enabled:true | flip P5 chip | ✓ WIRED |
| composer handleSubmit | chat.start / startRefine | activeTool==='chat' branch | ✓ WIRED |
| composer loadPersistedBlocks | persistedChatBlocks | markdown rehydration | ✓ WIRED |
| refine/route.ts | runHooksPipeline/runIdeasPipeline | fresh SIM on refined card | ✓ WIRED |
| composer chat-send | detectRefineIntent → /api/tools/refine | refine routing | ✓ WIRED |
| chat-thread-view | handoffsFor → onSuggestChain | tap-only CTA | ✓ WIRED |
| hooks/ideas routes | event: stage / followup | progress + follow-up | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Refine intent detection | `vitest run refine.test.ts` | 8 passed | ✓ PASS |
| Chat route SSE (auth/cap/persist/coldStart) | `vitest run chat/route.test.ts` | 4 passed | ✓ PASS |
| Refine route (auth/persist/fresh-score/error) | `vitest run refine/route.test.ts` | 4 passed | ✓ PASS |
| No fake timers in skill routes | `grep -c setTimeout hooks/ideas route` | 0 / 0 | ✓ PASS |
| ENGINE_VERSION not bumped | `git diff --name-only` | version.ts absent | ✓ PASS |
| P5 production source tsc-clean | `tsc --noEmit` filtered to P5 files | 0 errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| THREAD-03 | 05-01, 05-03 | Open chat thread (profile-grounded, no anchoring Reading) | ✓ SATISFIED | chat-runner + route + useChatStream + ChatThreadView + chip + rehydration |
| TEST-01 | 05-02 | Reading reframed "Test · powered by SIM-1 Max" | ✓ SATISFIED | reading-hero relabel; engine path untouched |
| THREAD-05 | 05-05 (chain CTAs) | Chain CTAs move between tools / persisted markdown rehydration | ✓ SATISFIED | chain-handoff registry + suggested CTA + markdown rehydration |
| STUDIO-01 | 05-04 | Real pipeline-stage SSE progress, no fake timers | ✓ SATISFIED | stage events + ProgressChecklist, setTimeout=0 |
| STUDIO-02 | 05-04, 05-05 | Cards in chat + follow-up turn + chat-to-refine | ✓ SATISFIED | follow-up persist + refine scoped re-run fresh score |
| STUDIO-03 | 05-03, 05-04, 05-05 | Generic skill-to-skill chain plumbing | ✓ SATISFIED | CHAIN_HANDOFFS SSOT + handoffsFor + placeholders for P6 |

All 6 phase requirement IDs accounted for and satisfied. No orphaned requirements (REQUIREMENTS.md maps exactly THREAD-03, TEST-01, THREAD-05, STUDIO-01/02/03 to Phase 5).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| chain-handoff.ts | 122-145 | `endpoint: null` placeholders for script/remix | ℹ️ Info | Intentional P6 seams required by STUDIO-03 ("zero new plumbing"); not rendering-path stubs |
| (test files) | various | 42 pre-existing tsc strict-null/fixture errors | ℹ️ Info | All in `__tests__`, pre-date P5; vitest (esbuild) runs green (2444 passed per task note); not P5-introduced |

No blocker debt markers (TBD/FIXME/XXX) in any P5 production file.

### Human Verification Required

Six items (see frontmatter `human_verification`) cover runtime/visual behaviors that grep + unit tests cannot confirm: live SSE token rendering, reload rehydration, Perplexity checklist animation/ordering, fresh-band refine card, one-time nudge gating, hero visual treatment, tap-only CTA + error-retry. Automated code + test evidence supports all of these; human confirmation closes the visual/real-time gap.

### Gaps Summary

No blocking gaps. All 18 observable truths verified in code, all 9 artifacts substantive + wired, all 10 key links connected, all 16 P5 unit/route tests green, all 6 requirement IDs satisfied, engine path + ENGINE_VERSION untouched (presentation/text-path only as mandated). Status is `human_needed` solely because runtime/visual flows (streaming, rehydration, animation, fresh-score) warrant a live confirmation pass; nothing is missing or stubbed in the codebase.

---

_Verified: 2026-06-18T13:22:00Z_
_Verifier: Claude (gsd-verifier)_
