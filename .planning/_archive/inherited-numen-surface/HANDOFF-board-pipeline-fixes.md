# Handoff — Engine Pipeline E2E + Board Rendering Fixes

**Date:** 2026-05-29
**Branch:** `feat/actions-frame-inline-redesign`
**Verification run:** analysis id `z05dIjbz4v4W` (Supabase project `qyxvxleheckijapurisj`, table `analysis_results`)

## Goal
The prediction pipeline produces rich output but the board rendered ~30% of it, plus several real engine bugs. This effort fixed correctness + surfaced data + made the watch-time curve real. **Hard constraint: the pipeline is Qwen-only — no Gemini, no DeepSeek** (already true; legacy names are cosmetic).

## Commits on this branch (mine, newest first)
- `91790ea` wip(audience): taller filmstrip (h-14→h-28) + world-space curve canvas (offsetWidth) + stale-metric guard — *Davide's WIP, committed on his behalf*
- `c0af11c` docs(engine): correct stale Gemini/DeepSeek comments — pipeline is Qwen-only
- `819dd30` fix(wave3): emit real persona drop points so the watch-time curve decays
- `6b6bc81` perf(engine): parallelize Stage 10/11 + raise Stage 11 timeout 30→60s
- `16fb973` fix(audience): restore per-segment variation in persona heatmap cells (alpha clamp)
- `b4d81c8` fix(board): verdict reasoning open by default + content-analysis chips not clipped
- `da85f02` fix(actions): render completed analyses by gating on data, not stream phase
- `81d2a03` fix(audience): map niche_deep→niche bucket in persona weight normalization
- (`9a6b24c` filmstrip temp-file extraction — Davide's own earlier commit)

## VERIFIED WORKING (DB run z05dIjbz4v4W + board screenshots)
- **Watch-time curve decays.** All 10 personas have `swipe_predicted_at` (3s–21s); `heatmap.weighted_curve` = [0.82,0.80,0.75,0.66,0.35]. Board shows real 100%→cliff-at-21s curve.
- **niche bug fixed.** `heatmap.weights = {fyp:0.65, niche:0.20, loyalist:0.10, cross_niche:0.05}` (niche no longer 0); `vs_niche_diff_pct = +0.19` (19%); no more `normalizeWeights: all-zero input` warning.
- **Actions render** (was 100% "Coming in Phase 6"): "What to fix" (4 prioritized fixes + SCORE BREAKDOWN), "When to post → Tue 7–10 PM".
- **Verdict** reasoning open by default; **Content Analysis** chips no longer clipped; **persona heatmap** cell alpha now varies per segment.

## SESSION UPDATE 2026-05-29 (continuation — commit `66edb29`)
Landed all concrete, no-run-needed items. What changed:
- **#3 Video 404 — FIXED (code).** `buildInsertRow` now persists `video_storage_path = null` when retention is NOT opted in (the video is deleted right after analysis), so `/api/videos/sign` no longer 404s on reload. `route.ts`. (Filmstrip-blank-on-reload is still the separate env-var issue — unchanged.)
- **#4 Persona scroll — FIXED (code).** `AudienceNode` root flex-col now `min-h-0 overflow-y-auto` — all 10 rows reachable when the drawer expands.
- **#1 Latency — INSTRUMENTED (awaiting a run).** Per-stage `performance.now()` logs added: aggregator emits `stage_timing` for `optimal_post_window`, `predict_with_ml`, `stage10_critique`, `stage11_counterfactuals` (each individual) + `stage10_11_wall`; route emits `aggregate_scores_total` + `db_writes_total`. **Next run: grep logs for `stage_timing`.** If `stage10 + stage11 ≈ wall` → the two LLM calls are serialized at DashScope despite `Promise.all`; if `wall ≈ max(...)` → truly concurrent.
- **#2 Counterfactuals null — INSTRUMENTED (awaiting a run).** On schema-validation failure, `stage11-counterfactuals.ts` now logs `counterfactuals_validation_failed` with `expected_band`, `overall_score`, the zod `error`, and `raw_output` (first 2000 chars). **Next run: grep that line, compare raw shape to the per-band union, then loosen schema or strengthen prompt.**
- **Known-failing tests — FIXED.** `board-constants.test.ts` (BOARD_BOUNDS → {0,0,1224,1104}, gutter 96→32) and `RetentionCurve.test.tsx` DPR (canvas now sized from `offsetWidth`, stubbed in `beforeEach`). All green.
- **CORRECTION:** `engine/gemini/` is **NOT** dead code — `src/lib/engine/types.ts:8` imports `./gemini/schemas`. Do NOT delete. (`engine/gemini/cost.ts` may be unused but lives beside the imported schema; leave the dir.)

Still needs Davide to run an analysis: read #1 + #2 timing/raw logs; filmstrip env vars (#3 second half); deferred #5 (emotion_arc prompt, trends seeding).

## REMAINING WORK (prioritized) — open the GSD task notes too

### 1. Latency still ~5.6 min (regressed; task #6)
- Pipeline 211s + post-pipeline tail ~121s (logs: "Pipeline complete" 11:13:52 → "cache populated" 11:15:53).
- Stage 10/11 are now `Promise.all` in `src/lib/engine/aggregator.ts` (~line 1180) but net latency did NOT improve. Need **stage-level timing logs** to find the real cost: `runStage10Critique` (`stage10-critique.ts`, thinking_budget 4000, 60s), `runStage11Counterfactuals` (`stage11-counterfactuals.ts`, 60s), `predictWithML` (ML cold start), `computeOptimalPostWindow` (Supabase), and the 3 serial DB writes in `src/app/api/analyze/route.ts` (~591 upsert, ~608 usage, ~625 safety-net UPDATE).
- Open question: are the two LLM calls actually concurrent at the DashScope network layer, or queued? Add per-stage `performance.now()` logging and re-run.
- NOTE: route fire-and-forget for the post-`send("complete")` writes is UNSAFE on serverless (work frozen after response) unless using Vercel `waitUntil`/`after()`.

### 2. counterfactuals still null (task #8)
- `has_cf=false` in z05dIjbz4v4W despite the 30→60s timeout raise. Stage 11 does NOT enable thinking, so it's not slow → the failure is almost certainly **schema validation**: `CounterfactualsResponseSchema` in `src/lib/engine/stage11-counterfactuals-prompts.ts` is a strict per-band discriminated union (low=3 fix / mid=2+1 / high=1+2-3). Model output likely doesn't match → `safeParse` fails → retry → null (`stage11-counterfactuals.ts:104-115`).
- **Board "What to fix" works anyway** via the top-level `suggestions` advice-fallback added in `ActionsFixesSlot.tsx` (AdviceRow) — so this is lower urgency.
- To fix: log the raw `text` (`stage11-counterfactuals.ts:100`) on validation failure, compare to the band schema, then loosen/repair the schema or strengthen the prompt. Needs a run to capture raw output.

### 3. Video 404 + filmstrip blank on reload
- `createSignedUrl_failed … Object not found` for the input `.mp4` → input video + filmstrip blank on refresh (board image #12). Video is deleted post-analysis (`cleanupUploadedStorage` in `route.ts`) but `analysis_results.video_storage_path` is NOT nulled → stale path 404s in `/api/videos/sign` (`src/app/api/videos/sign/route.ts`).
  - **Quick fix:** null `video_storage_path` (and persisted) when the video is deleted, so the board degrades cleanly instead of requesting a dead path.
- Filmstrip keyframes blank on reload is a SEPARATE, known config issue — see memory `filmstrip-persistence-reload`: needs `FILMSTRIP_EXTRACT_SECRET` + `NEXT_PUBLIC_APP_URL` env vars set.

### 4. Persona-area scroll (task #3 remainder)
- Only ~2 of 10 persona rows visible when expanded; the Audience frame is fixed-height/overflow-hidden. Add `overflow-y-auto` to the AudienceNode root flex-col (`src/components/board/audience/AudienceNode.tsx`, the `relative flex h-full w-full flex-col gap-3` wrapper ~line 319). Drop markers already wired in `PersonaRow.tsx` (white line at swipeSegIdx + "drops Xs") and now have real data.

### 5. Deferred (per Davide)
- **emotion_arc** = null ("isn't available"). Optional in the omni prompt (`src/lib/engine/qwen/omni-analysis.ts` ~line 135 "emotion_arc is OPTIONAL"). Make it required/strongly-encouraged for video mode to light up the panel. Cheap.
- **Trends** all-zero: `trending_sounds` table unseeded (no Apify scrape / cron). Feature complete, data-dependent.
- **Dead code:** `src/lib/engine/gemini/` (cost.ts + schemas.ts) is unimported — safe to delete (confirm first). `src/lib/ai/gemini` is a SEPARATE non-pipeline feature; leave it.

## KNOWN-FAILING TESTS (pre-existing — NOT from this work)
- `src/components/board/__tests__/board-constants.test.ts` (6 fails) — from the actions-frame redesign (`76d3a17`) changing GROUP_FRAMES/BOARD_BOUNDS; the UAT-regression test still asserts old dims `{0,0,1352,872}` / ≥96px gaps. **Update the expected values to current `board-constants.ts`.**
- `src/components/board/audience/__tests__/RetentionCurve.test.tsx` (1 fail: "DPR-aware … rect.width × dpr") — from the WIP `getBoundingClientRect → offsetWidth` change (`91790ea`). **Reconcile the test to the offsetWidth sizing.**
- Everything in the changed areas otherwise passes (1252 tests). `tsc --noEmit` = 0 errors.

## How to verify (Davide runs analyses; "rely on tests + DB")
- Trigger: Davide uploads a video + runs analysis (needs his auth). Dev server logs + board screenshots come back.
- Inspect: `mcp__supabase__execute_sql` on project `qyxvxleheckijapurisj`, `analysis_results` row by `id` — check `heatmap.weights`, `heatmap.weighted_curve`, persona `swipe_predicted_at`, `counterfactuals`, `optimal_post_window`.

## Key reference (data → UI map)
- Pipeline: `src/lib/engine/pipeline.ts` → `aggregator.ts` (`aggregateScores`) → cache/persist in `src/app/api/analyze/route.ts`.
- Output type: `src/lib/engine/types.ts` (`PredictionResult`).
- Board panels read via `useAnalysisStream` + `usePermalinkAnalysis`; GET enrich/shim in `src/app/api/analysis/[id]/route.ts`.
- Models: `src/lib/engine/qwen/client.ts` (QWEN_OMNI_MODEL / QWEN_REASONING_MODEL=qwen3.6-plus / QWEN_FAST_MODEL).
