---
phase: 01-foundation-sse-consumer-engine-signal-extensions
verified: 2026-05-24T11:10:35Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
must_haves:
  truths:
    - "Result page subscribes to SSE; all stage events update local state"
    - "`optimal_post_window` returned by `/api/analyze` (R6.1)"
    - "Emotion arc data confirmed in pipeline output (R1.7)"
    - "Anti-virality threshold locked with rationale documented (R1.9)"
    - "Page renders skeleton on submit, transitions through stage states"
  artifacts:
    - path: "src/hooks/queries/use-analysis-stream.ts"
      provides: "D-02 9-key SSE consumer hook; POST+body-reader → reconnect EventSource → polling"
    - path: "src/lib/engine/panel-mapping.ts"
      provides: "D-06 PANEL_IDS + STAGE_TO_PANEL + panelReadyFromStages reducer"
    - path: "src/app/api/analyze/route.ts"
      provides: "POST emits event:started, placeholder INSERT, UPSERT-by-id (Pitfall #6 Option A)"
    - path: "src/app/api/analyze/[id]/stream/route.ts"
      provides: "D-04 GET EventSource endpoint (terminal-state replay + in-flight 2s short-poll + 15s heartbeat)"
    - path: "src/lib/engine/qwen/schemas.ts + omni-analysis.ts"
      provides: "EmotionArcPointSchema + emotion_arc field on OmniAnalysisZodSchema + system prompt"
    - path: "src/lib/engine/optimal-post.ts"
      provides: "OptimalPostWindow type + FALLBACK_POST_WINDOW + computeOptimalPostWindow helper"
    - path: "src/lib/engine/anti-virality.ts"
      provides: "ANTI_VIRALITY_THRESHOLD = 0.4 + isAntiViralityGated helper + Variant B PROVENANCE block"
    - path: "src/lib/engine/aggregator.ts"
      provides: "Wires all 3 new fields onto PredictionResult before Stage 10/11 (Pitfall #5 ordering)"
    - path: "src/lib/engine/types.ts"
      provides: "PredictionResult widened with emotion_arc, optimal_post_window, anti_virality_gated"
    - path: "supabase/migrations/20260524000000_niche_post_windows.sql"
      provides: "niche_post_windows table + RLS + SECURITY DEFINER refresh + pg_cron @ 06:15 UTC"
    - path: "src/types/database.types.ts"
      provides: "Regenerated from live qyxvxleheckijapurisj; niche_post_windows Row/Insert/Update"
    - path: "src/app/(app)/analyze/page.tsx + analyze-client.tsx"
      provides: "D-09 + D-10 — /analyze form route; ContentForm → start() → router.push(/analyze/[id])"
    - path: "src/app/(app)/analyze/[id]/page.tsx + result-card.tsx + result-card-skeleton.tsx"
      provides: "D-11 — SSR shell + client ResultCard with 10 panels, panelReady gating, B3 wiring"
    - path: "e2e/result-surface-stream.spec.ts"
      provides: "Playwright e2e spec: 1 real test (W7 satisfied) + 2 test.fixme (P7 deferrals)"
  key_links:
    - from: "ResultCard.tsx"
      to: "useAnalysisStream"
      via: "import { useAnalysisStream } from \"@/hooks/queries/use-analysis-stream\""
    - from: "useAnalysisStream"
      to: "panelReadyFromStages"
      via: "import + invocation in useMemo for panelReady"
    - from: "AnalyzeClient"
      to: "POST /api/analyze"
      via: "useAnalysisStream.start() → fetch(\"/api/analyze\")"
    - from: "useAnalysisStream.reconnect"
      to: "GET /api/analyze/[id]/stream"
      via: "new EventSource(`/api/analyze/${id}/stream`)"
    - from: "aggregator.ts"
      to: "computeOptimalPostWindow"
      via: "non-fatal pluck BEFORE result assembly, result.optimal_post_window field"
    - from: "aggregator.ts"
      to: "isAntiViralityGated"
      via: "two-phase compute: initial assign + post-Stage-10 re-evaluation"
    - from: "computeOptimalPostWindow"
      to: "niche_post_windows table"
      via: "supabase.from(\"niche_post_windows\").select(...).eq(\"niche\", niche).single()"
---

# Phase 1: Foundation — SSE Consumer + Engine Signal Extensions Verification Report

**Phase Goal:** Wire the result page to consume the engine's existing SSE stream and add the two new engine signals (optimal post time, emotion arc verification). Calibrate the anti-virality confidence threshold.

**Verified:** 2026-05-24T11:10:35Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Result page subscribes to SSE, all stage events update local state | VERIFIED | `result-card.tsx:56` calls `useAnalysisStream({ initialData })`; hook dispatcher (`use-analysis-stream.ts:149-176`) handles 5 event types (started/phase/stage/complete/error); `panelReady` derived via `panelReadyFromStages(stages)` (line 138-146); stages drive panel transitions through STAGE_TO_PANEL mapping. |
| 2 | `optimal_post_window` returned by `/api/analyze` | VERIFIED | `aggregator.ts:696-706` calls `computeOptimalPostWindow(serviceClient, niche, null)` BEFORE result assembly; `aggregator.ts:1077` includes `optimal_post_window` in the PredictionResult; `types.ts:212` declares `optimal_post_window?: OptimalPostWindow \| null`; live niche_post_windows table confirmed on Supabase project qyxvxleheckijapurisj. |
| 3 | Emotion arc data confirmed in pipeline output | VERIFIED | `qwen/schemas.ts:56,139` declares `EmotionArcPointSchema` + `emotion_arc: z.array(...).optional()` on OmniAnalysisZodSchema; `omni-analysis.ts:108,119,121` extends system prompt with emotion_arc example + 3-8 points rule; `aggregator.ts:678-686,1067` plucks the field non-fatally; `types.ts:195` widens PredictionResult. |
| 4 | Anti-virality threshold locked with rationale documented | VERIFIED | `anti-virality.ts:32` `ANTI_VIRALITY_THRESHOLD = 0.4`; full PROVENANCE JSDoc block (lines 10-30) documents Variant B fallback rationale, calibration script reference, M2-II revisit trigger; `aggregator.ts:1073,1119` two-phase wiring (initial + post-Stage-10 re-evaluation); `types.ts:202` `anti_virality_gated: boolean` (REQUIRED, not optional). |
| 5 | Page renders skeleton on submit, transitions through stage states | VERIFIED | `result-card.tsx:78-124` iterates PANEL_IDS, renders `<PanelSkeleton ready={panelReady[id]} />` for non-ready panels; `result-card-skeleton.tsx:23-40` renders idle (opacity-50), loading (animate-pulse), error (red border) variants; `data-stream-phase`, `data-panel-id`, `data-panel-ready` E2E hooks present (line 65, 84-85). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/queries/use-analysis-stream.ts` | D-02 9-key hook | VERIFIED | 343 lines, exports `useAnalysisStream` with locked 9-key return type; reconnect→poll ladder; visibility-change gate. |
| `src/lib/engine/panel-mapping.ts` | D-06 source of truth | VERIFIED | PANEL_IDS (10), STAGE_TO_PANEL (4 stages), `panelReadyFromStages` pure reducer. |
| `src/app/api/analyze/route.ts` | POST event:started | VERIFIED | `send("started", { id: analysisId })` at line 446; placeholder INSERT at 406; UPSERT-by-id at 492-497. |
| `src/app/api/analyze/[id]/stream/route.ts` | D-04 GET endpoint | VERIFIED | 141 lines, runtime=nodejs, maxDuration=300, dual-mode (terminal + in-flight), IDOR via `.eq("user_id", user.id)`, heartbeat + abort cleanup. |
| `src/lib/engine/qwen/schemas.ts` | EmotionArcPoint Zod | VERIFIED | EmotionArcPointSchema with bounded ranges; `.optional()` on Omni schema for backward compat. |
| `src/lib/engine/qwen/omni-analysis.ts` | System prompt extension | VERIFIED | `buildSystemPrompt` exported; emotion_arc 3-8 points instruction present. |
| `src/lib/engine/optimal-post.ts` | computeOptimalPostWindow | VERIFIED | OptimalPostWindow + FALLBACK_POST_WINDOW + 4-branch helper (null/found/PGRST116/error); uses generated `NichePostWindowRow` type (no `as never` cast). |
| `src/lib/engine/anti-virality.ts` | Threshold + helper | VERIFIED | 0.4 constant + `isAntiViralityGated` + PROVENANCE block. |
| `src/lib/engine/aggregator.ts` | Wires all 3 fields | VERIFIED | imports all 3 helpers; non-fatal plucks BEFORE result assembly; two-phase anti-virality compute (post-Stage-10 re-eval). |
| `src/lib/engine/types.ts` | PredictionResult shape | VERIFIED | `emotion_arc?: EmotionArcPoint[] \| null`, `anti_virality_gated: boolean`, `optimal_post_window?: OptimalPostWindow \| null`. |
| `supabase/migrations/20260524000000_niche_post_windows.sql` | Table + RLS + cron | VERIFIED | 125 lines, plain TABLE (not MV), 2 RLS policies, SECURITY DEFINER refresh, pg_cron 06:15 UTC. Live in qyxvxleheckijapurisj. |
| `src/types/database.types.ts` | niche_post_windows entry | VERIFIED | Row/Insert/Update entries at line 827; refresh_niche_post_windows function entry at 1719. |
| `src/app/(app)/analyze/page.tsx` | D-09 form route | VERIFIED | Server shell + Suspense + AnalyzeClient. |
| `src/app/(app)/analyze/analyze-client.tsx` | D-10 form wiring | VERIFIED | ContentForm onSubmit → start() → router.push on (analysisId, phase=analyzing). |
| `src/app/(app)/analyze/[id]/page.tsx` | D-11 SSR shell | VERIFIED | Server fetch scoped by `.eq("user_id", user.id)` (IDOR); passes initialData to client. |
| `src/app/(app)/analyze/[id]/result-card.tsx` | D-11 client wrapper | VERIFIED | 10 GlassPanel slots, panelReady gating, B3 real-data wiring for optimal_post + emotion_arc. |
| `src/app/(app)/analyze/[id]/result-card-skeleton.tsx` | PanelSkeleton | VERIFIED | 3 visual states (idle/loading/error). |
| `e2e/result-surface-stream.spec.ts` | E2E spec | VERIFIED | 1 real test() (W7 ceiling) + 2 test.fixme deferred to P7. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| result-card.tsx | useAnalysisStream | `import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream"` | WIRED | Destructured: panelReady, phase, result, error, reconnect. |
| useAnalysisStream | panelReadyFromStages | `import + useMemo` | WIRED | Hook computes panelReady from stages[]. |
| AnalyzeClient | POST /api/analyze | `stream.start()` → `fetch("/api/analyze", { method: "POST" })` | WIRED | mutation.mutateAsync → POST body-reader SSE parse loop. |
| useAnalysisStream.reconnect | GET /api/analyze/[id]/stream | `new EventSource(`/api/analyze/${id}/stream`)` | WIRED | Triggered on POST error with analysisId present. |
| aggregator.ts | computeOptimalPostWindow | non-fatal pluck (line 696-706) | WIRED | Result.optimal_post_window set BEFORE Stage 10/11. |
| aggregator.ts | isAntiViralityGated | initial assign + Stage 10 re-eval | WIRED | Two-phase computation aligns POST-CRITIQUE confidence with UI flag. |
| computeOptimalPostWindow | niche_post_windows table | `.from("niche_post_windows").select(...).eq("niche", niche).single()` | WIRED | Typed via `Pick<NichePostWindowRow, ...>`; cast-through-unknown removed in Plan 07. |
| analyze/[id]/page.tsx | analysis_results table | `.from("analysis_results").select("*").eq("id", id).eq("user_id", user.id)` | WIRED | SSR fast-path; IDOR-mitigated. |
| stream route | analysis_results table | identical `.eq` chain + 2s short-poll | WIRED | Defense-in-depth IDOR filter on every read. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| result-card.tsx | `result.optimal_post_window` | aggregator.ts pluck via computeOptimalPostWindow → niche_post_windows table | Yes (live table, RLS, cron-refreshed; FALLBACK when empty) | FLOWING |
| result-card.tsx | `result.emotion_arc` | aggregator.ts pluck from `pipelineResult.geminiResult.analysis.emotion_arc` (Omni Plus payload) | Yes (Zod-validated, .optional() backward compat) | FLOWING |
| result-card.tsx | `result.anti_virality_gated` | aggregator.ts two-phase isAntiViralityGated(result.confidence) | Yes (REQUIRED boolean, post-Stage-10 confidence) | FLOWING |
| result-card.tsx | `panelReady[id]` | useAnalysisStream → panelReadyFromStages(stages[]) | Yes (driven by SSE stage events from POST stream OR initialData short-circuit) | FLOWING |
| analyze-client.tsx | `stream.analysisId` | dispatcher captures from event:started frame | Yes (POST emits at route.ts:446 BEFORE pipeline runs) | FLOWING |
| result-card.tsx | initial render placeholder copy on 8 panels | hardcoded "Panel content placeholder — implemented in Phase 3-5" | N/A (intentional per Plan 08; B3 wiring proves data path works for the 2 verified panels) | INTENTIONAL_PLACEHOLDER |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Hook + panel-mapping + Phase 1 engine tests pass | `vitest run` on 6 phase 1 engine specs | 36 passed, 0 failed | PASS |
| Hook + route + result-card tests pass | `vitest run` on 5 phase 1 client/api specs | 30 passed, 0 failed | PASS |
| Full vitest suite passes (excluding @google/genai baseline) | `vitest run` (whole repo) | 996 passed, 17 skipped; 8 file failures all `@google/genai` baseline (D-01-DEF-01) | PASS |
| TypeScript clean | `tsc --noEmit -p tsconfig.json` | 2 pre-existing errors (D-01-DEF-01); 0 NEW errors | PASS |
| ESLint clean on Phase 1 files | `eslint <11 phase 1 files>` | 0 errors, 2 informational warnings on intentional `_creator` / `_ruleContributions` unused-prefix args | PASS |
| Playwright spec collected | `playwright test --list e2e/result-surface-stream.spec.ts` | 3 tests collected (1 real + 2 fixme) | PASS |
| `event: started` in POST route | grep `send("started"` route.ts | 1 match (line 446) | PASS |
| `event: started` emitted FIRST before phase/stage/complete | grep ordering in route.ts | started @446 < phase @450 < stage @459 < complete @519 | PASS |
| Pitfall #5 ordering (plucks BEFORE Stage 10/11) | grep `runStage10Critique` line vs pluck lines in aggregator.ts | emotion_arc @678, optimal_post_window @696, runStage10Critique > 1066 | PASS |

### Probe Execution

No formal probe scripts declared in PLAN or SUMMARY files for Phase 1. Phase relies on vitest + Playwright (executed above as Behavioral Spot-Checks).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R2.1 | 01-01, 01-02, 01-03, 01-07, 01-08 | Result page subscribes to SSE; stage events drive UI state | SATISFIED | useAnalysisStream consumes POST stream (body-reader) + GET reconnect (EventSource) + polling fallback; stages drive panelReady; result-card.tsx renders 10 panels gated by panelReady; visibility-change gate; 90s ceiling. |
| R6.1 | 01-01, 01-05, 01-07 | `optimal_post_window` in aggregator output | SATISFIED | OptimalPostWindow type locked per D-13; computeOptimalPostWindow with 4-branch behavior; niche_post_windows live in qyxvxleheckijapurisj; aggregator pluck → result.optimal_post_window. |
| R1.7 | 01-01, 01-04 | emotion_arc verified/added | SATISFIED | EmotionArcPointSchema + .optional() on OmniAnalysisZodSchema; system prompt extension; aggregator pluck → result.emotion_arc; empty array degrades to null. |
| R1.9 | 01-01, 01-06 | Anti-virality threshold locked + wired | SATISFIED | ANTI_VIRALITY_THRESHOLD = 0.4 (Variant B insufficient-data fallback) + isAntiViralityGated + REQUIRED `anti_virality_gated: boolean` on PredictionResult + two-phase aggregator wiring; PROVENANCE block + M2-II revisit trigger documented. |

No orphaned requirements detected for Phase 1.

### Locked Decisions Compliance (D-01 through D-15)

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 — New dedicated hook, `useAnalyze` untouched | PASS | use-analysis-stream.ts at line 1 says "Existing useAnalyze hook is NOT modified (D-01 clean separation)"; grep on use-analyze.ts shows no event:started handling. |
| D-02 — 9-key return shape | PASS | AnalysisStreamReturn declares exactly 9 keys per CONTEXT iter-1 lock (use-analysis-stream.ts:84-96). |
| D-03 — Single reconnect then poll | PASS | mutation.onError checks `phaseRef.current !== "reconnecting"` to enforce single retry; pollQuery refetchInterval=2000; 90s ceiling timeout. |
| D-04 — GET /api/analyze/[id]/stream | PASS | Endpoint exists at canonical path; EventSource-compatible; mirrors POST route config (runtime/dynamic/maxDuration). |
| D-05 — panelReady record | PASS | `panelReady: Record<PanelId, PanelReadyState>` returned by hook. |
| D-06 — panel-mapping.ts single source of truth | PASS | PANEL_IDS + STAGE_TO_PANEL + panelReadyFromStages co-located with events.ts; imported by hook + ResultCard. |
| D-07 — Three layers (stages + partial + result) | PASS | All three exported from hook return. |
| D-08 — Wave 3 per-persona shape | PASS | PartialStreamState.personas typed with status/verdict/reasoning; partial seeded on wave_3_personas start. |
| D-09 — New (app)/analyze routes | PASS | /analyze + /analyze/[id] both under (app) auth group. |
| D-10 — Form moves to /analyze, ContentForm reused | PASS | analyze-client.tsx wraps ContentForm via onSubmit prop. |
| D-11 — Server shell + client ResultCard with initialData | PASS | page.tsx fetches row server-side; ResultCard accepts analysisId + initialData. |
| D-12 — Niche-only corpus median for P1 | PASS | `_creator` accepted but unused; computeOptimalPostWindow only reads niche_post_windows. |
| D-13 — OptimalPostWindow schema | PASS | Interface in optimal-post.ts:18 matches CONTEXT verbatim. |
| D-14 — Materialized niche_post_windows table | PASS | Plain TABLE (not MV) + pg_cron refresh @ 06:15 UTC daily. |
| D-15 — optimal-post.ts helper, non-fatal | PASS | Aggregator try/catch around call; helper returns null on Supabase error. |

### Anti-Patterns Scan

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| anti-virality.ts | 24 | `TODO(M2-II): Revisit once outcome data accumulates...` | Info | Referenced M2-II milestone follow-up; PROVENANCE block documents revisit trigger (outcomes row count ≥ 50). Not an unreferenced debt marker. |
| result-card.tsx | 116 | `Panel content placeholder — implemented in Phase 3-5` | Info | Intentional placeholder copy for 8 of 10 panels per Plan 08 explicit scope. B3 wiring proves the 2 data-bearing panels (optimal_post, emotion_arc) work. |

No `TBD`, `FIXME`, or `XXX` debt markers in Phase 1 modified files. All `TODO` references point to scoped M2-II/Phase 3-5 follow-ups, none unreferenced.

### Phase Salvage / Wave Parallelism Note (01-08 cherry-pick)

Plan 01-08 SUMMARY notes that upstream Plan 02 files (panel-mapping.ts, use-analysis-stream.ts, fixtures) had to be brought into the worktree via `git show` because the wave orchestrator hadn't merged them at the time. The verifier confirmed that the final tree (commit 00f2d87) contains the correct content for ALL upstream-provided files:

- `src/lib/engine/panel-mapping.ts` — 69 lines, exports match Plan 02 SUMMARY
- `src/hooks/queries/use-analysis-stream.ts` — 343 lines, D-02 9-key contract intact
- `src/test/fixtures/stage-events.ts`, `src/test/fixtures/completed-prediction.ts` — Plan 01 deliverables present

No content drift, no missing exports. The salvage operation succeeded.

---

## Gaps Summary

No gaps identified.

All 5 ROADMAP Success Criteria are observably true in the codebase:

1. **SSE consumer wired** — POST body-reader + GET EventSource reconnect + polling fallback all flow into `panelReady` state read by ResultCard.
2. **optimal_post_window in `/api/analyze`** — aggregator plucks from niche_post_windows live table (verified on qyxvxleheckijapurisj); fallback handles unknown niches.
3. **emotion_arc in pipeline output** — Omni Plus schema + prompt + aggregator pluck end-to-end; ResultCard B3 panel renders first/last point summary when populated.
4. **Anti-virality threshold locked** — 0.4 (Variant B insufficient-data fallback) with full PROVENANCE block citing calibration script + M2-II revisit trigger + alignment rationale with `calculateConfidence()` LOW band.
5. **Skeleton transitions through stage states** — PanelSkeleton renders 3 visual states (idle/loading/error); panelReadyFromStages drives transitions; `data-stream-phase` + `data-panel-id` + `data-panel-ready` E2E hooks present.

All 15 locked decisions D-01 through D-15 are honored. Quality gates pass: tsc clean (only D-01-DEF-01 baseline), full vitest suite 996 passing (8 baseline failures only), ESLint clean. The known `@google/genai` baseline and `strip.ts` prefer-const issue (D-01-DEF-01, D-01-DEF-02) are pre-existing, documented in `deferred-items.md`, and do NOT block Phase 1 verification.

---

*Verified: 2026-05-24T11:10:35Z*
*Verifier: Claude (gsd-verifier)*
