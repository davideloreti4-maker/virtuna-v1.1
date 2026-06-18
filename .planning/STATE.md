---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: milestone
status: completed
stopped_at: Phase 6 context gathered
last_updated: "2026-06-18T11:55:52.370Z"
last_activity: 2026-06-18
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 21
  completed_plans: 21
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Discuss input (EXPLORATORY): .planning/NUMEN-TOOLS-VISION.md · Worktree identity: .planning/MILESTONE.md

**Core value:** AI-powered content intelligence for TikTok creators — now extended from "analyze a recorded video" to a creator studio where every generated idea/hook/script is tested on a synthetic audience (SIM-1) before the creator acts.
**Current focus:** Phase 05 — open-chat-test-reframe

## Current Position

Phase: 6
Plan: Not started
Status: Phase 05 complete — ready for Phase 06 (Script & Remix Tools)
Last activity: 2026-06-18

## Hard Constraints (this milestone)

- **Engine OPEN for v6.0; validated behavior PROTECTED by a regression gate (not frozen).** Text-mode, generation, KC, and fold refactors permitted. Keep the engine suite green, preserve same-video score-identity/determinism on the SIM-1 Max (video) path, and bump `ENGINE_VERSION` on any deliberate change to video-scoring output. No silent regressions.
- **Qwen-only** pipeline (no Gemini/DeepSeek).
- **Rich tool output via the fixed numen-rework typed-renderer library** — NOT model-generated UI (craft trap), NOT plain text (loses the moat).
- **Flat-warm visual system (THEME-06, v5.0)** is the design SSOT.
- **Inline-scoring committed (no spike gate):** text-only Flash predicts relative pull (owner-confirmed); the winning persona framing is calibrated inside ENGINE-01. KC general-use rebuild is committed unconditionally.
- **Scripts + Remix un-deferred into v6.0 Phase 6 (2026-06-18)** — combined into one phase (SCRIPT-01/REMIX-01); both run the same Qwen pipeline as Test and plug into P5's chain plumbing. Remix revives `milestone/viral-remix` + `src/app/api/remix/adapt/` prior art — **scout before any rebuild**. (Was deferred to v6.1; owner re-scoped during P5 discuss — see `phases/05-open-chat-test-reframe/05-CONTEXT.md` D-00.)

## Phases

| # | Phase | Requirements | Status |
|---|-------|--------------|--------|
| 1 | Engine & Thread Foundation | ENGINE-01, ENGINE-03, THREAD-01, THREAD-02, THREAD-04, THREAD-06, THREAD-07 | Complete ✓ |
| 2 | Knowledge-Core Generative Rebuild | GROUND-01, GROUND-02 | Complete ✓ |
| 3 | Ideas Tool | IDEAS-01, IDEAS-02, IDEAS-03, ENGINE-02, GROUND-03, PROFILE-01, THREAD-05 | Complete ✓ (rehydration → P4) |
| 4 | Hooks Tool | HOOKS-01, HOOKS-02, HOOKS-03 | Complete ✓ (gap-closure applied 2026-06-18) |
| 5 | Studio Conversation Layer | THREAD-03, TEST-01, THREAD-05, STUDIO-01/02/03 | Context gathered → UI/plan next |
| 6 | Script & Remix Tools | SCRIPT-01, REMIX-01 | Not started (un-deferred from v6.1) |

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions. Launch decisions (2026-06-16):

- v6.0: Open Numen into a creator studio — generation tools + SIM-1-on-everything as the moat.
- v6.0: v1 scope = Foundation + Ideas→Hooks moat chain + open chat; Scripts + Remix deferred to v6.1.
- v6.0: Engine OPEN; SIM-1 Max video-scoring protected by a regression gate (suite green + same-video score-identity; `ENGINE_VERSION` bump on deliberate scoring change) — the v5.0 "frozen" rule was a presentation-milestone scope device, retired for this engine-touching milestone.
- v6.0: Knowledge-Core ground-up generative rebuild is the foundation (THE value, the long pole).
- v6.0: Launched in a dedicated worktree (`milestone/numen-tools`) off main; trunk stays on main.
- v6.0 (2026-06-16): Spike-gate phase removed — both de-risk bets resolved by owner experience (text-only Flash works; KC rebuild committed general-use). 6 phases → 5; SPIKE-01/02 dropped; ENGINE-02/IDEAS-02/HOOKS-02 unconditional.
- [Phase ?]: Renderer registry split into .ts (server schema) + .tsx (client components) to avoid TypeScript module resolution ambiguity
- [Phase ?]: dispatchToolOutput: schema root must expose blocks[] array field
- [Phase ?]: BandBlock: qualitative only (band word + fraction + model tag), no numeric score (D-11 honesty spine)
- [Phase ?]: Flash aggregate thresholds
- [Phase ?]: Flash model routing
- [Phase ?]: reading_id FK is text not uuid — analysis_results.id is text on live DB; plan Pitfall #3 was incorrect; all FK semantics preserved
- [Phase ?]: ThreadRow/MessageRow derive from Database public Tables post-regen; role narrowed to union at app layer
- [Phase ?]: D-14 double-validation: validateBlock at write boundary AND on rehydration; invalid blocks become UnsupportedBlock sentinel
- [Phase 02-01]: D-03 compile-time assembly — per-mode system prompts assembled at compile time in regen-kc.ts, not at runtime (resolves RESEARCH Open Q2)
- [Phase 02-01]: KC_GEN_VERSION stamping deferred to Phase 3 where outputs are first persisted (resolves RESEARCH Open Q1)
- [Phase 02-02]: A4 resolved — runner knowledgeBundle = static slice-binding; assembleBundle output = per-request volatile user message (never mutate module-level runner const)
- [Phase 02-02]: BUNDLE_CHAR_CAP=4000 chars placeholder — tune post-authoring after BASE+Ideas slice sizes known (Plan 03 pilot)
- [Phase 02-02]: Wins/flops v1 = count + "creator-reported, directional" caveat only; no scraped content, no fabricated mechanism (honesty spine)
- [Phase 03-03]: Open Q1 resolved — structured json_object seed-hook extraction (seedHookPath='structured'); no brittle prose delimiter
- [Phase 03-03]: Open Q2 resolved — parallel Promise.all SIMs + content-first SSE (face+scrollQuote before band chip)
- [Phase 03-03]: Open Q3 resolved — ideas append to open thread (type:'open', reading_id:null); chain in same thread
- [Phase 03-03]: /develop PINNED endpoint: POST /api/tools/ideas/develop, payload {ideaId?, anchor, platform} → {threadId, messageId, fencedHooksBundle}
- [Phase 03-03]: Rate limit deferred to v2 (no ideas message count table; auth+ask-cap are v1 boundary)
- [Phase ?]: band-tier-rank-comparator
- [Phase ?]: Test handoff seam: lifted state (handleTestHook) + HookTestContext for MessageBlocks pass-through (mirrors PlatformContext)
- [Phase ?]: GET /api/threads/open: open-thread rehydration read-back closes P3 persistedBlocks={[]} debt
- [Phase 05-01]: isColdStart mirrors assembler.ts isProfileThin exactly — single predicate, no divergence; update both in lockstep (D-08)
- [Phase 05-01]: coldStart computed route-side before stream starts so meta frame leads SSE (Plan 05-03 gates nudge on this)
- [Phase 05-01]: Callback-based runner (runChatPipeline onToken) rather than async generator — simpler route-driven SSE
- [Phase 05-01]: MAX_PRIOR_TURNS=20 soft context cap on prior turns in anchor (D-01a)
- [Phase 05-02]: D-06a bounded rename: hero label "Test" + "powered by SIM-1 Max" tag only; reading_id/routes/ENGINE_VERSION/ScoreGauge unchanged
- [Phase 05-02]: ReadingSection.labelSuffix ReactElement prop added (optional, non-breaking) to support inline tag adjacent to section label
- [Phase 05-03]: nudgeShown tracked in useChatStream (sticky session-level boolean, not reset by reset()) rather than local ref in ChatThreadView — avoids react-hooks lint errors while preserving D-08 once-per-session gate semantics
- [Phase 05-03]: showChatView = activeTool === 'chat' unconditionally (ChatThreadView owns its own empty state, unlike HooksThreadView/IdeasThreadView which gate on content existence)
- [Phase 05-04]: CHAIN_HANDOFFS SSOT in chain-handoff.ts — P6 extends by appending entries, no card-component edits
- [Phase 05-04]: Coarse stage transitions at route level (before/after single runHooksPipeline await) — real phases ran, D-02 satisfied; finer callbacks require runner refactor (deferred)
- [Phase 05-04]: Follow-up Qwen generation non-fatal — caught silently so card delivery never blocks on follow-up timeout
- [Phase 05-04]: ProgressChecklist is ephemeral SSE-driven UI (not a registered block) per D-02 Claude's discretion
- [Phase 05-04]: Checkmark ✓ uses var(--color-cream-secondary) — never coral per UI-SPEC §Color
- [Phase 05-05]: startRefine on stream hooks routes refine errors through hooks.error/ideas.error → Plan-04 SkillRunError (zero new error UI)
- [Phase 05-05]: Refine path switches activeTool to 'hooks'/'idea' so new card renders in correct thread view
- [Phase 05-05]: suggestedCTAs from handoffsFor('idea') — idea→hooks is the most immediately relevant chat next step

### Roadmap Evolution

- Phase 7 added (2026-06-18): **Audience Manager** — calibrated audience as shared substrate across all skills (the moat). Designed in discussion; full locked scope in ROADMAP Phase 7 + memory `audience-manager-phase7.md`. Depends on Phase 6. Followed by owner's KC/slice/live-context refinement run.

### Pending Todos

[From .planning/todos/pending/]

None yet.

### Blockers/Concerns

- **Spike gate dropped (2026-06-16):** owner resolved both de-risk bets from experience — text-only Flash predicts relative pull (improves with the right data/context/framing); KC goes general-use unconditionally. Residual work relocated: winning-framing discovery → ENGINE-01; authored KC slice → GROUND-01. Phases renumbered 6→5.
- **Long pole:** generation-grade Knowledge-Core rebuild is a content/curation workstream first — author + eval the slices early (Phase 2 can run parallel to Phase 1).
- **Pre-existing main hygiene debt:** v5.0 Numen Rework + Landing v2 shipped to main but were never archived to `.planning/milestones/`; main's `.planning/` is mixed. Recommend a `/gsd-complete-milestone` pass on `main` (does not block this milestone).

## Deferred Items

Deferred to v6.1+: in-thread monetization, brand-profile entity, RAG over creator history, desktop dense-instrument, compact-onboarding redesign + link-social prefill, Script Diagnose mode + script/concept text pre-flight. *(Scripts + Remix tools moved INTO v6.0 Phase 6 on 2026-06-18 — no longer deferred.)*

## Session Continuity

Last session: 2026-06-18T11:55:52.367Z
Stopped at: Phase 6 context gathered
Next: Phase 06 (Script & Remix Tools — un-deferred from v6.1; run /gsd-discuss-phase 6)
Resume file: .planning/phases/06-script-remix-tools/06-CONTEXT.md

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 01-engine-thread-foundation P01 | 17m | 3 tasks | 11 files |
| Phase 01-engine-thread-foundation P03 | 7m | 3 tasks | 7 files |
| Phase 01-engine-thread-foundation P04 | 6m | 2 tasks | 4 files |
| Phase 01-engine-thread-foundation P02 | 35min | 3 tasks | 5 files |
| Phase 02-knowledge-core-generative-rebuild P01 | 20min | 3 tasks | 7 files |
| Phase 02-knowledge-core-generative-rebuild P02 | 5min | 2 tasks | 3 files |
| Phase 03-ideas-tool P01 | 45min | 3 tasks | 4 files |
| Phase 03-ideas-tool P02 | 40min | 3 tasks | 9 files |
| Phase 03-ideas-tool P03 | 15min | 2 tasks | 7 files |
| Phase 04-hooks-tool PP01 | 4min | 2 tasks | 7 files |
| Phase 04-hooks-tool P02 | 8min | 2 tasks | 6 files |
| Phase 04-hooks-tool P03 | 30min | 4 tasks | 10 files |
| Phase 04-hooks-tool P03 gap-closure | 15min | 2 tasks | 3 files (threads.ts, migration, tests) |
| Phase 05-open-chat-test-reframe P01 | 5min | 2 tasks | 3 files |
| Phase 05-open-chat-test-reframe P02 | 3min | 2 tasks | 3 files |
| Phase 05-open-chat-test-reframe P03 | 10min | 2 tasks | 4 files |
| Phase 05-open-chat-test-reframe P04 | 18min | 3 tasks | 9 files |
| Phase 05-open-chat-test-reframe P05 | 28min | 3 tasks | 8 files |
