---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: milestone
status: executing
stopped_at: Completed 11-07-PLAN.md (Explore wired into composer — pill enabled + ExploreThreadView mounted + Pitfall-1-guarded submit + in-place reload)
last_updated: "2026-06-20T03:05:50.866Z"
last_activity: "2026-06-20 -- 11-07 complete (Explore wired into composer: pill enabled + ExploreThreadView mounted + Pitfall-1-guarded submit + in-place reload)"
progress:
  total_phases: 16
  completed_phases: 11
  total_plans: 62
  completed_plans: 62
  percent: 69
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Discuss input (EXPLORATORY): .planning/NUMEN-TOOLS-VISION.md · Worktree identity: .planning/MILESTONE.md

**Core value:** AI-powered content intelligence for TikTok creators — now extended from "analyze a recorded video" to a creator studio where every generated idea/hook/script is tested on a synthetic audience (SIM-1) before the creator acts.
**Current focus:** Phase 11 — explore-audience-curated-discovery-expansion-not-yet-discuss

## Current Position

Phase: 11 (explore-audience-curated-discovery-expansion-not-yet-discuss) — EXECUTING
Plan: 8 of 8
Status: Ready to execute
Last activity: 2026-06-20 -- 11-07 complete (Explore wired into composer: pill enabled + ExploreThreadView mounted + Pitfall-1-guarded submit + in-place reload)

### ⚠ Tracked follow-up (owner-accepted 2026-06-19) — FLYWHEEL-02 predicted-pin runner wiring

`pinPredictedSignature()` is built/exported/unit-tested and the capture route reads the pinned row, but **no SIM runner calls it** (`runFlashRunner` returns without pinning). The capture→reconcile loop stays dormant in the live flow until the seam is wired into each runner's post-SIM point (+ a runner-level test). Wire it next; naturally belongs with **KCQ-05 (SIM-rank verification loop, P13)**. Until then the reconcile log can't fire end-to-end. See 10-VERIFICATION.md + 10-UAT.md Gaps.

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
| 4 | Hooks Tool | HOOKS-01, HOOKS-02, HOOKS-03 | Complete ✓ |
| 5 | Studio Conversation Layer | THREAD-03, TEST-01, THREAD-05, STUDIO-01/02/03 | Complete ✓ |
| 6 | Script & Remix Tools | SCRIPT-01, REMIX-01 | Complete ✓ |
| 7 | Audience Manager | AUD-01..08 | Complete ✓ |
| 8 | Discover & Remix→Read | DISC-*, REMIX/AUD-STEER, READ-* | Complete ✓ |
| 9 | Living Audience | LIVE-01..07 | Complete ✓ |
| 10 | Account Read, Saved Shelf & Flywheel | SELF-*, SAVE-*, FLYWHEEL-* | Complete ✓ |
| 11 | Explore (Audience-Curated Discovery) | EXPLORE-01..06 | Planned (expansion) — not discussed |
| 12 | Library & Acts/State IA | IA-01, LIB-01..03, AUD-EDIT-01..04 | Planned (expansion) — not discussed |
| 13 | Proactive Numen (Ambient + Initiated) | AMBIENT-01, PROACTIVE-01..02 | Planned (expansion) — not discussed |
| 14 | KC Grounding & Quality-Loop | KCQ-01..09 | Complete ✓ |
| 15 | Marketing Intent (mode-switch) | INTENT-01, REACT-01, BLOCK-01 | Planned (expansion) — not discussed |
| 16 | Commerce Skills | OFFER-01, ADCREATIVE-01, COMMERCE-01 | Planned (expansion) — not discussed |
| — | Pre-launch hardening gate | HARDEN-01 | Planned — before public traffic |

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
- [Phase 10 / 10-02]: A1 calibration/craft split OWNER-CONFIRMED — calibration={collector,connector,converter}, craft={scanner,lurker,skeptic}; [ASSUMED] markers removed from reconcile.ts.
- [Phase 10 / 10-02]: Single-URL outcome scrape = apidojo/tiktok-scraper-api Single Post Query tier (startUrls:[url]) — the SEPARATE single-post-capable apidojo actor (not the all-in-one apidojo/tiktok-scraper, which forbids single posts). clockworks retired for single-URL metrics, kept only for Remix mp4 resolution. Plan-07 UAT: verify live startUrls/bookmarks fields.
- [Phase 10 / 10-02]: 3 sibling tables (outcome_signatures, reconciliations, saved_items) added; the contested `outcomes` table untouched (Pitfall 1). DB push deferred to Plan 07.
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
- [Phase 06-01]: Script mode mirrors Hooks role set: ['niche','audience','platform','wins','flops'] — GROUND-02 anti-dilution
- [Phase 06-01]: ScriptCardBlockSchema band/fraction describe OPENER ONLY (Pitfall 5 honesty spine) — comment enforced on schema
- [Phase 06-01]: ScriptCardRenderer 'Test full →' CTA stub with onTest? prop — wired in 06-05 (mirrors HookCardRenderer plan-01 pattern)
- [Phase 06-01]: KC_SCRIPT_SYSTEM_PROMPT assembled at compile time via regen-kc.ts (D-03) — same pattern as hooks/chat
- [Phase 06-02]: D-05a GREEN confirmed against live code — decode/adapt path never calls runPredictionPipeline/aggregateScores/ENGINE_VERSION; regression gate in 06-05
- [Phase 06-02]: Route decision D-06/A1 — new SSE route /api/tools/remix/run (not /api/remix/adapt — wrong ownership model for open thread flow)
- [Phase 06-02]: Cardinality A3 — 1 remix-card per run (concepts[0]); studio one-card aesthetic; 3-concept overgenerate is internal
- [Phase 06-02]: RemixCardBlockSchema band/fraction describe ADAPTED HOOK scroll-stop ONLY (Pitfall 5 honesty spine)
- [Phase 06-02]: sourceDecode in RemixCardBlock carries REAL 4-beat decode anatomy (D-05 moat) — NOT a metadata guess
- [Phase 06-04]: runRemixPipeline revives 5 decode/adapt reuse seams as-is (resolveAndRehost, analyzeVideoWithOmni, omniOutputToStructuralInput, runDecode, decodeResultToAdaptInput, generateAdaptConcepts) — D-05a isolation maintained
- [Phase 06-04]: cleanup() in finally unconditional — resolve_failed caught before finally scope (cleanup not available yet); decode_failed/adapt_failed caught inside finally scope; T-03-02 satisfied on all paths
- [Phase 06-04]: POST /api/tools/remix/run: content-first SSE (content event face before score band chip); error event on runRemixPipeline error field; insertMessage persist non-fatal
- [Phase ?]: remix→hooks reuse path: /api/tools/ideas/develop PINNED contract
- [Phase ?]: [Phase 06-05]: hooks→script is card-POST model (not context-handoff) — mirrors idea→hooks; context-handoff reserved for script→test null-endpoint seam
- [Phase ?]: [Phase 06-05]: chain-handoff.test.ts asserts exact endpoint strings + remix→hooks payload contract — drift fails the test
- [Phase 07-01]: GOAL_INTENT_BIAS locked: grow→new_creator, sell/authority→niche_heavy, nurture→established (D-05, seeded from WEIGHT_PRESETS; [ASSUMED] values tune in refinement)
- [Phase 07-01]: resolveAudienceWeights accepts Audience[] — array-shaped, multi-select-ready; v1 single-resolution semantics (Pitfall 5 compliant)
- [Phase 07-01]: General→DEFAULT free by construction: no analysis_override injected for is_general=true; AUD-03 regression gate anchor in persona-weights.test.ts
- [Phase 07-02]: Virtual constants (Open Q2 RESOLVED): General + 2 presets are in-memory constants; absence of active_audience_id = General; no seed migration; regression gate trivially true
- [Phase 07-02]: Sentinel ids: GENERAL_AUDIENCE.id='general', PRESET_AUDIENCES[0].id='preset-growth' (grow), PRESET_AUDIENCES[1].id='preset-conversion' (sell) — stable, referenced by 07-04 + 07-05
- [Phase 07-02]: database.types.ts regeneration DEFERRED to 07-05 post-push; (supabase as any) casts hold type surface in interim
- [Phase ?]: D-17 cache discipline; Pitfall 2 compliance
- [Phase ?]: undefined = byte-identical no-op (D-17 cache safe, Pitfall 2); stored text = deterministic repaint fold (calibrated audience)
- [Phase ?]: delegates to buildGroundingLine for General/null (zero behavior change); blast radius confined to ideas-runner (AUD-08, D-01)
- [Phase 07-05]: Audience routes MUST live under src/app/(app)/ route group to inherit AppShell (sidebar, AuthGuard, providers, content offset) — outside it pages render bare with no auth; route group does not change URLs
- [Phase 07-05]: In-shell pages render a plain content <div> (max-w mx-auto px-4 py-6 sm:p-6) — AppShell owns the page <main>; nesting a second <main> is invalid HTML
- [Phase 07-05]: PATCH /api/threads/[id] created (no prior threads/[id] route) to persist per-thread audience pin; auth-first + RLS + explicit user_id ownership guard; NULL active_audience_id = General
- [Phase 07-05]: openThreadId captured from the existing GET /api/threads/open mount fetch (already returns threadId) — no extra request for the composer AudienceChip
- [Phase 07-05]: Calibration fallback uses --color-warning (never coral, never error) and NEVER fabricates personas (D-06 honesty spine)
- [Phase ?]: [Phase 08-01]: W0 LOCKS persona-bias values not structure — P7 key mappings already correct; change = remove [ASSUMED] markers + add source-marker/spread/preset test guards
- [Phase ?]: [Phase 08-01]: sell + authority share WEIGHT_PRESETS.niche_heavy by design — both depth plays, audience in-niche; per-intent flavour from repaint prose not weight mix
- [Phase ?]: [Phase 08-01]: flash-aggregate STRONG/MIXED_THRESHOLD untouched (Pitfall 4) — calibrated not [ASSUMED]; changing shifts every skill gate
- [Phase ?]: Discover Remix→Read CTA launches the chain via CHAIN_HANDOFFS /api/tools/remix/run then routes to /home (open-thread rehydrate) — no composer/card edit
- [Phase ?]: OutlierTile reuses VideoCard verbatim (video_url:null → plain div); multiplier badge always carries baselineLabel (vs own/vs niche), never a SIM score (Pitfall 5/D-05)
- [Phase ?]: [Phase 08-04]: chat/script steer via assembleBundle.overrides (no Flash path); remix/hooks/script feed audienceRepaint into runFlashTextMode
- [Phase ?]: [Phase 08-04]: General/null = byte-identical no-op (no analysis_override, no audienceRepaint arg); ENGINE_VERSION 3.19.0 unchanged
- [Phase ?]: [Phase 08-04]: REMIX-01 adapt niche = profileNiche · audience.name (goal_label); remix-card audienceName prop optional, omitted for General
- [Phase ?]: 08-05: multi-audience-read block (the Read) ships single-audience static card — bands only (.strict() rejects numeric score), who-not-for from low-disposition personas (no model call), audiences array W4-ready for 08-06
- [Phase ?]: 10-03: predicted vector pinned once at SIM run (pinPredictedSignature), never recomputed (Pitfall 6); outcome capture reconciles realized only against the pin
- [Phase ?]: Plan 10-04: Saved shelf flat/typed (D-07); remix output saves as item_type 'hook'; shelf items launch via CHAIN_HANDOFFS SSOT
- [Phase ?]: 10-05: Account Read own-handle resolved from personal audience calibration.handle (T-10-12 ownership, no new OAuth); fix from CRAFT-disposition reconciliations only (D-03); track record withheld below 3 rows (SELF-03)
- [Phase 10 / 10-06]: Proposal identity = the gate-passing CALIBRATION disposition string (no separate proposal rows); confirm/decline transition the contributing reconciliation rows' proposal_state → a declined proposal's rows are excluded from the next gate pass (no re-nag). propose.ts isRecalibratableAudience refuses General/preset on BOTH read (null) and write (throw); confirm writes ONLY persona_weights via updateAudience. General-unchanged regression anchor green.
- [Phase 10 / 10-06]: Drift cron uses createServiceClient (no session) + reads user_id off the audience row → inserts outcome_signatures source='drift_scrape' + reconciliations DIRECTLY (the session-deriving repos call getUser() and can't run in cron). Same reconcile/gate/propose path as outcome capture (D-01). vercel.json drift cron '0 5 * * 1' [ASSUMED A4].
- [Phase 10 / 10-06]: DEFERRED — drift composition-shift sensitivity is engine-side: deriveAudienceProfile derives dispositions profile-agnostically (from goal-intent bias, not scraped composition), so hasShift rarely fires until calibration derives real composition from scraped signals. Drift PATH complete + correct; making the shift detectable is a calibration-math change (Plan 07+ / owner calibration refinement).
- [Phase ?]: [Phase 14 / 14-01]: resolveNicheKey lives at the RUNNER layer (D-02/Pitfall 2) — free-text/sub-slug niche_primary normalized to a top-level NICHE_INSTANTIATION key before the SIM panel; selectPersonaSlots + NICHE_INSTANTIATION bytes untouched, no ENGINE_VERSION bump (still 3.19.0)
- [Phase ?]: [Phase 14 / 14-01]: KCQ-05 gate floor = band !== Weak (stops >= MIXED_THRESHOLD); thresholds held STRONG=6/MIXED=3 with drift gate; LIVE recalibration deferred (no DASHSCOPE_API_KEY in exec env)
- [Phase 14 / 14-03]: KCQ-08 — voice moved out of MODE_ROLES tail for idea/hooks/script/remix (chat unchanged) so a BUNDLE_CHAR_CAP drop sheds wins/flops/platform before voice; formatVoice carries explicit 'Write in this voice' directive; volatile path only (compiled.ts/system prompt byte-unchanged)
- [Phase 14 / 14-03]: D-18 map-before-merge delegated to executor (owner supplied 26 raw-labeled templates); mapped by dominant mechanism to BOLDx8/GAPx5/CONTRARIANx5/NARRATIVEx6/RESEARCHx1/QUESTIONx2; folded under hooks.md archetype table as private-reasoning-only exemplars; KC_GEN_VERSION gen.1.0.0->gen.1.1.0, ENGINE_VERSION unchanged
- [Phase 14 / 14-03]: HONESTY-01 — fake §N citation pills deleted from ExpertChatThread (CORPUS_SECTIONS + insertCitationMarkers + §cite branch), render {content} directly; no re-light (D-14); board-frame pills + real-code render intact
- [Phase 14 / 14-04]: KCQ-09/04 surface lane — idea card's existing whyItFits reframed into inline "Made for you — {whyItFits}" micro-copy (personalization-trust + steering lever, NOT citation, no pills, D-04/D-14); predictedFailureMode (from 14-02) rendered as a TWO-stage opt-in drill INSIDE the disclosure on BOTH idea+hook renderers (off the face + text gated behind a second drill = never always-visible AND never silent-only, D-10); warning-toned (--color-warning, never coral/error-red); `!= null` covers absent/legacy cards; hooks get the flop reveal but NO rationale (no whyItFits prop); pure client render, no ENGINE_VERSION bump (3.19.0)
- [Phase 14 / 14-02]: KCQ-02/04/07 — parallel Flash rubric-critic (critiqueAgainstRubric) executes the BASE Value Bar (Test A/B/C + Prohibition 6) at runtime in Ideas+Hooks; combined gate = band !== Weak AND verdict.pass; SIM+critic run as a Promise.all pair (~1x latency, D-05/D-08 independent judge); critic fail-safe (error → pass:false, never throws); conditional single regen on all-fail (D-06, bounded); predictedFailureMode (KCQ-04) optional-nullable on both card schemas (no migration, for 14-04 drill-reveal); no ENGINE_VERSION bump
- [Phase 11-01]: rankWithAudienceFit is pure runner/route-layer math (no engine/SIM/network) — ENGINE_VERSION stays 3.19.0 (Pitfall 6); fit-score constants STRONG=0.66/FAIR=0.4/α=0.5 are [ASSUMED A2] UAT tunables — D-01/D-02/D-03: the eager per-tile fit signal is honest re-ranked math, never a SIM call or fabricated quote; constants tune in UAT like the Flash thresholds
- [Phase 11-01]: OutlierGridBlockSchema extended with fit/trackable/trackHandle as nullable-optional (mirrors predictedFailureMode) — zero migration, zero block-registry edit; degrade gate returns fit:null (never empty/zero bar) — EXPLORE-03/05 producer-half plumbing; existing persisted outlier-grid blocks stay valid; honesty spine keeps no-band/no-model/no-score on the MEASURED tile (Pitfall 5)
- [Phase 11-02]: tracked_accounts is a NEW dedicated flat table (not a saved_items overload) — a tracked account is an input HANDLE not a block snapshot; idempotent via UNIQUE(user_id,platform,handle); RLS own-rows (tracked_all_own mirrors saved_all_own); WRITTEN only, live push + types regen deferred to BLOCKING wave 11-08; EXPLORE-06 comment-seeding stays deferred (D-09)
- [Phase 11-04]: /api/tools/explore clones the hooks SSE route but delegates the WHOLE pipeline to runExplorePipeline (no Flash/gate loop); stages "Pulling outliers" → "Scoring for your audience", content-first, NO fake % (UI-SPEC honesty — the apidojo pull is genuinely minutes); active audience ALWAYS from openThread.active_audience_id (CR-01), never body; General/preset/thin degrades every tile to fit:null
- [Phase 11-04]: runExplorePipeline returns { block, ranked } (additive to the locked signature) so the in-memory Discover cache fills from the SAME pull — eliminates a double scrape (Rule 1 fix). Cache stores audience-independent measured RankedOutlier[]; a cache HIT re-runs rankWithAudienceFit per active audience before building the block (fit depends on the audience, not the pull). Zero SIM/Flash/@/lib/engine import — ENGINE_VERSION 3.19.0 untouched (D-02/D-03, Pitfall 6)
- [Phase 11-04]: timeWindow param accepted into the route contract but NOT yet threaded into the pull (rankOutliers already applies WINDOW_DAYS=90 + half-life); honest no-op (void body.timeWindow) — narrowing by today/week/month is a follow-up, never faked. Profile-mode tiles trackable:true + trackHandle (pull-input handle, no @, lowercased); niche-mode trackable:false (VideoData exposes no author handle — RESEARCH Q3)
- [Phase 11-05]: useExploreStream clones use-hooks-stream but SIMPLER — one outlier-grid block in the content event (no per-tile score events, no followup); fetch+getReader (NOT the GET-only SSE client, BLOCKER-1); start/stop/reset/toBlocks/stages + WR-05 isMountedRef guard. OutlierTile fit bar = 3-level (Strong 100%/Fair 66%/Weak 33%) success/warning/muted, NEVER coral (DATA not action, one-accent law); omitted ENTIRELY when fit==null (honest degrade D-02 — no empty/zero bar). "+ Track account" non-accent text-button (trackable only) → "Tracking ✓". OutlierGridBlockRenderer upgraded LIVE (Pitfall 2): imports OutlierGridBlock from blocks.ts (single source of truth, schema tile structurally = OutlierTileData), forwards onRemix/onTrack/remixPendingId/trackPendingId/trackedIds → DiscoverGrid → tile; callbacks optional → static-reference fallback preserved for the Discover page; message-blocks/block-registry unchanged. tracked keys off trackHandle∈trackedIds, trackPending off platformVideoId. The on-tap real reaction stays lazy (reused remix-card LensTrigger downstream) — no reaction UI on the grid
- [Phase 11-06]: ExploreThreadView owns its idle state (clone of ChatThreadView idle-ownership) — heading + 3 LOCKED-copy quick-action cards (niche/competitors/serendipity); cards run a preset ONLY on tap, never auto-fire (D-07/EXPLORE-04). Card-2 "What competitors shipped" degrades to a DISABLED "Track an account first" sub-state when hasTrackedAccounts=false (onClick omitted + disabled → no pull can fire; real sub-copy asserted absent) — never a fabricated competitor feed (honesty D-02). Renders the streaming+persisted grid via OutlierGridBlockRenderer DIRECTLY, not MessageBlocks (MessageBlocks forwards only `block`, never onRemix/onTrack — direct mount is the only way to wire the live handlers this view owns). handleRemix = VERBATIM discover→remix (handoffsFor("discover").find(h=>h.to==="remix") → POST {url,platform}) + onThreadReload on success (in-place thread reload, RESEARCH Q2 — NO useRouter import at all, structurally cannot router.push); on-tap real reaction rides the reused remix-card LensTrigger downstream → NO reaction UI on the grid (D-02/D-04/D-05, no new chain entry). handleTrack POSTs /api/tracked-accounts. trackedIds keyed by trackHandle, remix/track pending keyed by platformVideoId (11-05 renderer contract). 9-test happy-dom lock; EXPLORE-01/02/04/05
- [Phase ?]: [Phase 11-07] Explore wired into composer: showExploreView unconditional (activeTool==='explore', mirrors chat D-07) so idle quick-actions show; handleSubmit explore branch calls explore.start({niche})+return, NEVER pendingNavRef/stream.start and no router.push('/analyze') in composer.tsx (Pitfall 1 structurally guarded — navigate-on-id effect stays Test-exclusive)
- [Phase ?]: [Phase 11-07] Explore params Search popover lives INSIDE ComposerControls (reuses Popover shell + ctl + Ico 'search' beside audience control; onRunExplore prop → explore.start); shown only when activeTool==='explore'. Field-send maps textarea→niche (empty=un-niched); canSubmit gates only on !explore.isStreaming. reloadOpenThread re-filters outlier-grid+remix-card from GET /api/threads/open to surface the Read after a tile Remix in place (RESEARCH Q2, no router.push); hasTrackedAccounts mount fetch drives card-2 honest degrade
- [Phase ?]: [Phase 11-07] Stale composer-controls test fixed (Rule 1): 'not-yet-shipped disabled' case asserted Explore disabled — split into Explore-enabled+fires-onSelectTool('explore') and Offer/Ad-disabled; EXPLORE-01/02/04 now live + selectable in /home; build ✓, composer+explore suites green

### Roadmap Evolution

- Phase 7 added (2026-06-18): **Audience Manager** — calibrated audience as shared substrate across all skills (the moat). Designed in discussion; full locked scope in ROADMAP Phase 7 + memory `audience-manager-phase7.md`. Depends on Phase 6. Followed by owner's KC/slice/live-context refinement run.

### Pending Todos

[From .planning/todos/pending/]

None yet.

### Blockers/Concerns

- **Spike gate dropped (2026-06-16):** owner resolved both de-risk bets from experience — text-only Flash predicts relative pull (improves with the right data/context/framing); KC goes general-use unconditionally. Residual work relocated: winning-framing discovery → ENGINE-01; authored KC slice → GROUND-01. Phases renumbered 6→5.
- **Long pole:** generation-grade Knowledge-Core rebuild is a content/curation workstream first — author + eval the slices early (Phase 2 can run parallel to Phase 1).
- **Pre-existing main hygiene debt:** v5.0 Numen Rework + Landing v2 shipped to main but were never archived to `.planning/milestones/`; main's `.planning/` is mixed. Recommend a `/gsd-complete-milestone` pass on `main` (does not block this milestone).
- Phase 8 plans reference requirement IDs READ-01/READ-03 not enumerated in milestone REQUIREMENTS.md — mark-complete reports not_found. Planning-time gap; reconcile REQUIREMENTS.md before phase verify.

## Deferred Items

Deferred to v6.1+: in-thread monetization, brand-profile entity, RAG over creator history, desktop dense-instrument, compact-onboarding redesign + link-social prefill, Script Diagnose mode + script/concept text pre-flight. *(Scripts + Remix tools moved INTO v6.0 Phase 6 on 2026-06-18 — no longer deferred.)*

## Session Continuity

Last session: 2026-06-20T03:05:50.857Z
Stopped at: Completed 11-07-PLAN.md (Explore wired into composer — pill enabled + ExploreThreadView mounted + Pitfall-1-guarded submit + in-place reload)
Next: 11-08 (BLOCKING: live tracked_accounts migration push + database.types.ts regen + engine regression gate) — closes Phase 11; until it runs, the "+ Track account" write + hasTrackedAccounts read hit a table that exists only in the migration file (degrades safely to false)
Resume file: None

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
| Phase 06-script-remix-tools P01 | 20min | 2 tasks | 8 files |
| Phase 06-script-remix-tools P03 | 6min | 2 tasks | 4 files |
| Phase 06-script-remix-tools P04 | 7min | 2 tasks | 4 files |
| Phase 06-script-remix-tools P06-05 | 45min | 4 tasks | 11 files |
| Phase 07-audience-manager P01 | 5min | 2 tasks | 8 files |
| Phase 07-audience-manager P02 | 6min | 3 tasks | 3 files |
| Phase 07-audience-manager P03 | 8m | 2 tasks | 7 files |
| Phase 07-audience-manager-calibrated-audience-as-shared-substrate-acr P04 | 5m | 2 tasks | 6 files |
| Phase 07-audience-manager-calibrated-audience-as-shared-substrate-acr P05 | 75m | 2 tasks + checkpoint | 11 files (UI + shell fix) |
| Phase 08-discover-remix-read-the-competitor-niche-moat-chain-draft-no P01 | 8min | 2 tasks | 4 files |
| Phase 08 P02 | 11min | 3 tasks | 10 files |
| Phase 08 P03 | 10min | 3 tasks | 12 files |
| Phase 08 P04 | 10min | 3 tasks | 11 files |
| Phase 08 P05 | 5min | 2 tasks | 8 files |
| Phase 08 P06 | 6min | 2 tasks | 5 files |
| Phase 09 P01 | 5m | 2 tasks | 3 files |
| Phase 09 P02 | 7m | 3 tasks | 7 files |
| Phase 09 P03 | 9m | 3 tasks | 12 files |
| Phase 09 P05 | 3m | 2 tasks | 3 files |
| Phase 10 P01 | 18 | 3 tasks | 9 files |
| Phase 10 P02 | 25min | 3 tasks (1 checkpoint) | 10 files |
| Phase 10 P03 | 22 | 3 tasks | 6 files |
| Phase 10 P04 | 25min | 3 tasks | 12 files |
| Phase 10 P05 | 6 | 3 tasks | 7 files |
| Phase 10 P06 | 7min | 3 tasks (1 TDD) | 8 files |
| Phase 14-kc-grounding-quality-loop P01 | 14min | 2 tasks | 7 files |
| Phase 14-kc-grounding-quality-loop P03 | 20min | 3 tasks | 6 files |
| Phase 14-kc-grounding-quality-loop P02 | 12min | 2 tasks (1 TDD) | 8 files |
| Phase 14-kc-grounding-quality-loop P04 | 8min | 2 tasks | 3 files |
| Phase 11-explore-audience-curated-discovery P01 | 22min | 2 tasks | 3 files |
| Phase 11-explore-audience-curated-discovery P02 | 8min | 1 tasks | 1 files |
| Phase 11 P03 | 7min | 2 tasks | 3 files |
| Phase 11 P04 | 10min | 2 tasks | 3 files |
| Phase 11 P05 | 6min | 3 tasks | 4 files |
| Phase 11 P06 | 14min | 1 task | 2 files |
| Phase 11 P07 | 20min | 2 tasks | 3 files |
