# Phase 6 Discussion Log

**Mode:** Claude's-discretion across all gray areas (user explicit instruction: "analyze, optimize and verify in detail all grey areas and discussion topics step by step and choose your thought-through recommendation").

No AskUserQuestion turns. All decisions made by Claude after deep codebase scout + prior-phase context load. Each decision below is a recommendation; researcher/planner may override with codebase evidence.

---

## Gray areas identified

1. **Script transformation algorithm** — how `/api/analyze/[id]/script` derives the 4-section schema (`opening_line`, `scene_order[]`, `voiceover`, `captions[]`) purely from `counterfactuals` + `factors` + `reasoning` + `hook_decomposition` + `dropoff_segment_indices` — no new LLM call. Heuristic mapping rules, sparse-data fallback, A/B variants source.
2. **Script UI: layout + empty state** — fitting 4 sections + per-section copy + Copy-all in two presentations: 360×160 anti-virality hero (col-span-2) vs 170×88 default slot. Whether default uses Inspector route. R5.3 high-confidence empty state visual + A/B variant rendering.
3. **Script caching shape** — where the transformed script lives (JSONB column on `analysis_results` vs separate table vs stateless edge cache). Invalidation rules when engine re-runs. Read latency vs storage/migration cost.
4. **Post-time card: edit, TZ, niche reasoning** — engine emits UTC; auto-detect creator TZ; let user edit day/time and persist where (creator profile, localStorage, analysis-scoped); where Plan 6.6 "niche-level reasoning" surfaces (inline reasoning string, expand-on-tap, separate card).

---

## Decisions made (summary — full rationale in 06-CONTEXT.md)

### Gray area 1 — Script transformation algorithm
- **Endpoint:** `GET /api/analyze/[id]/script` mirroring `/api/analyze/[id]/comparisons/route.ts` line-by-line (Zod id validator + auth gate + RLS + `nodejs` runtime).
- **Deterministic mapping** from `PredictionResult` fields — no LLM call, no randomness.
- **`opening_line`** — primary source: `counterfactuals.suggestions[]` where `type === 'fix'` AND `signal_anchor` matches hook regex; pick suggestion whose anchor matches `hook_decomposition.weakest_modality`. Fallbacks: hook-matching `factors[].improvement_tip` → deterministic constant.
- **`scene_order[]`** — `counterfactuals.suggestions[]` where `type === 'fix' && timestamp_ms > 0`, prioritized by overlap with `dropoff_segment_indices`. Format: `"0:08 — {headline}"`. Cap 6.
- **`voiceover`** — `reasoning` + top 3 improvement_tips from low-scoring factors. Cap 1200 chars.
- **`captions[]`** — `counterfactuals.suggestions[]` where `signal_anchor` matches text/hashtag/CTA + always include one A/B alternative from `detail`. Cap 5.
- **Empty-state branch** — `is_empty_state: true` returned when `confidence_label === 'HIGH' && !anti_virality_gated && (counterfactuals?.band === 'high' || confidence >= 0.7)`. Maps `type === 'stretch'` hook suggestions to `opening_variants[]`.
- **Latency budget validation:** single Supabase SELECT (~10-30ms) + JSON transform (~5ms) + optional write-through (~20-40ms) = well under 200ms p95 target.

### Gray area 2 — Script UI layout + empty state
- **Two presentations driven by `isAV`:** AV grown-state renders full 4-section `<ScriptBody>` inside `ActionsReshootHeroSlot` (col-span-2, 360×160). Default state renders compact teaser (first ~50 chars of opening + "Open script →") → tap opens `<Sheet>` with same `<ScriptBody>`.
- **One canonical component, two parents** — `ScriptBody.tsx` rendered directly in AV hero OR inside Sheet content area when triggered by compact teaser.
- **Section headers verbatim from R5.2:** "New Opening", "Scene Order", "Voiceover", "Captions". Per-section copy buttons + sticky "Copy all" pill.
- **Copy-all format = plain markdown** with H2 section headers (creators paste into Notion/Docs/Notes seamlessly). Includes header `REWRITE SCRIPT (analysis {{id}})` for traceability.
- **Empty state (R5.3)** — same component (`<ScriptEmptyState>`) regardless of host. "✓ Your video is solid. Optional tweaks below." + 2-3 A/B opening variants from `opening_variants[]`. Top check icon in `text-emerald-300/70`. No Inspector route — nothing more to show.
- **AV headline copy** = `"Try this instead"` + sub `"4-section rewrite based on what dropped"` (Verdict already screams "Don't post yet" — Reshoot is the constructive sibling).
- **Streaming + skeleton** — TanStack Query gated on `phase === 'complete'`. Subtle pulsing on section labels during fetch (~10-30ms typical).

### Gray area 3 — Script caching shape
- **JSONB column on `analysis_results`** — additive migration `20260530000000_script_result.sql` adding `script_result JSONB` (nullable, no index, no CHECK). Mirrors `analysis_override` + `optimal_post_window` patterns already on the table.
- **No invalidation.** Cache lifetime == row lifetime. Re-running engine produces a new `analysis_id` (per `prediction-cache.ts:74` content-addressed contract), so the new row has `script_result IS NULL` and the endpoint populates on first request.
- **Lazy fill, write-through via service-client** — first request computes, writes back via service client (bypasses RLS-write cleanly per `prediction-cache.ts:populatePredictionCache` precedent). Write failure does NOT fail the response; subsequent request recomputes.
- **TanStack Query client cache** — `['script', analysisId]`, `staleTime: Infinity`, `gcTime: 5min`.
- **No backfill** — older rows compute on first request transparently.
- **Engine-version skew defensive check** — if `script_result.engine_version !== analysis_results.engine_version`, force recompute.

### Gray area 4 — Post-time card: edit, TZ, niche reasoning
- **TZ conversion = pure client-side** via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Engine always emits UTC. New util `src/lib/optimal-post-time.ts` (~40 lines + unit tests across multiple TZs including midnight-crossers).
- **Hour-range format = 12-hour with AM/PM** (creator consumer audience). Use `Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: true })` — respects locale. `formatRange` for the start-end pair where supported.
- **Edit affordance** — tap day/time chip opens a `<Sheet>` with two compact pickers: day (7 pill buttons, `role="radiogroup"`), hour range (two `<select>` elements, end > start). Save button persists, Reset link clears override.
- **Persistence = analysis-scoped only** (Phase 6) — new JSONB column `analysis_results.optimal_post_override`. New endpoint `POST /api/analyze/[id]/optimal-post-override` mirrors `analyze/[id]/override/route.ts` shape (Zod, auth, RLS, generic error codes).
- **Creator-profile-wide preference deferred to M2-II** — separate column on `creator_profiles` + UX checkbox in edit Sheet. Deferred to avoid coupling Phase 6 to creator-profile schema migrations.
- **Niche reasoning (Plan 6.6)** = inline `reasoning` string already shaped by Phase 1 `optimal-post.ts:98` ("Your fitness niche peaks Tue 18:00-21:00 UTC (n=12 videos)") + small source provenance pill ("from your niche" / "default" / "yours"). Tap pill → tooltip with `niche_primary` + sample size + CTA to add niche when source = `'fallback'`.
- **No new endpoint, no new aggregate, no new table for plan 6.6** — engine output already carries everything; Phase 6 just renders + provenance-explains.

---

## Cross-cutting decisions made

- **Phase 5 slot wrappers untouched** (`ActionsReshootHeroSlot`, `ActionsOptimalPostSlot`) — Phase 6 swaps inner JSX only. `data-testid` for outer wrapper preserved; inner `data-testid` renamed from `*-placeholder` to `*-body` / `*-card`.
- **Folder structure:** `src/components/board/actions/{script,optimal-post}/` per Phase 5 convention. ~9 new component files + 2 new constants/types files.
- **Two new Supabase migrations** (both additive, idempotent IF NOT EXISTS): `script_result` JSONB + `optimal_post_override` JSONB on `analysis_results`.
- **Two new API endpoints:** `GET /script` + `POST /optimal-post-override`. Both mirror existing route precedents line-by-line.
- **Telemetry** — 9 new structured-logger events extending `actions-constants.ts:TELEMETRY`.
- **Cross-coherence guarantee** — fixes appearing as Verdict's top-3 (Phase 5 D-08) MUST appear in Phase 6's `scene_order[]` — both filter `counterfactuals.suggestions[]` where `type === 'fix'`. Naturally satisfied by D-04.

---

## Deferred ideas captured

(See 06-CONTEXT.md `<deferred>` block for full list — 10 items including Notion import URL, calendar integration, creator-profile-wide post-time preference, engine `reasoning_sections` field, multi-language, per-section regeneration with LLM, etc.)

---

## Scope creep redirected

None — all decisions stayed within R5 + R6.2 + plans 6.1-6.6. Deferred items above were not raised as scope-creep candidates; they're inherent extensions ROADMAP.md already pushes to M2-II or later milestones.

---

## Claude's Discretion items (researcher locks during planning)

See 06-CONTEXT.md `<decisions>` `### Claude's Discretion` block — 16 items including hook-related `signal_anchor` regex precision validation, segment-idx → timestamp_ms mapping, time formatter location, markdown handling in reasoning, day-picker UI primitive existence check, override TTL semantics, test fixtures cataloguing, etc. These are starting recommendations researcher refines with codebase evidence.
