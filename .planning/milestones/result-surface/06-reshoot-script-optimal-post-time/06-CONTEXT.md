# Phase 6: Reshoot script + optimal post time — Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Mode:** Claude's-discretion across all gray areas (per user request: "analyze, optimize and verify in detail all grey areas and discussion topics step by step and choose your thought-through recommendation"). Every decision below is a starting point researcher/planner can override with codebase evidence.

<domain>
## Phase Boundary

Swap the Phase 5 placeholders for real surfaces that turn already-emitted engine signals into actionable creator-facing UI:

- **Reshoot script panel** (R5.1, R5.2, R5.3) — server-side transformation of `PredictionResult.counterfactuals` + `factors` + `reasoning` + `hook_decomposition` + `dropoff_segment_indices` into a 4-section script (`opening_line` / `scene_order[]` / `voiceover` / `captions[]`). Rendered inside the Phase-5-reserved `ActionsReshootHeroSlot` in two presentations: (a) **grown hero** when `anti_virality_gated === true` (360×160 top row, col-span-2) and (b) **compact teaser → Inspector** when not gated (170×88 default slot). Per-section copy buttons + "Copy all" with section headers.
- **Script empty/high-confidence state** (R5.3) — when `confidence_label === 'HIGH'` AND `anti_virality_gated === false`, panel shows "Your video is solid. Optional tweaks below." + 2-3 A/B opening variants drawn from `counterfactuals.suggestions[]` where `type === 'stretch' && signal_anchor matches /hook|opening/`. Full reshoot script suppressed.
- **Optimal post-time panel** (R6.2) — render `PredictionResult.optimal_post_window` (already populated by Phase 1's `computeOptimalPostWindow`) inside the Phase-5-reserved `ActionsOptimalPostSlot` (170×88). Auto-convert UTC to creator's `Intl.DateTimeFormat().resolvedOptions().timeZone`. Day + hour-range chip. Inline reasoning string. Editable (analysis-scoped override persisted to a new `analysis_results.optimal_post_override` JSONB column).
- **Niche-level reasoning surface** (Plan 6.6) — surface the niche identity + sample size that drove the post-time recommendation. Source: `optimal_post_window.reasoning` (already shaped like "Your fitness niche peaks Tue 18:00-21:00 UTC (n=12 videos)") + a small `source: 'niche'|'fallback'|'creator'` provenance pill that on tap reveals "Recommendation based on {N} videos in {niche_primary}" (or fallback copy).
- **Script transformation endpoint** (R5.1) — `GET /api/analyze/[id]/script` mirroring `/api/analyze/[id]/comparisons` route shape (Zod id validator + auth gate + RLS, defensive in depth). Pure transformation, no new LLM call. p95 < 200ms (mostly Supabase round-trip).
- **Script result caching** (Plan 6.2) — additive JSONB column `analysis_results.script_result` populated on first request via service-client write-through; subsequent reads hit the column directly. Invalidation is content-addressed: script is keyed to `analysis_id` which is immutable per `engine_version` + `content_hash` (prediction-cache contract). Re-runs produce new analysis IDs, so the cache never goes stale.
- **Post-time override endpoint** (new, derived from R6.2 "editable") — `POST /api/analyze/[id]/optimal-post-override` mirroring `/api/analyze/[id]/override/route.ts` shape. Writes JSONB to `analysis_results.optimal_post_override`. Analysis-scoped only; creator-profile-wide preference deferred (see Out-of-scope).
- **Telemetry** — `script_section_copied`, `script_copy_all`, `script_inspector_opened`, `script_empty_state_shown`, `optimal_post_tz_converted`, `optimal_post_edited`, `optimal_post_source_explained`.

**Out of scope (other phases):**
- Engine schema changes (Phase 6 is pure consumption — `counterfactuals`, `factors`, `optimal_post_window`, `reasoning`, `confidence_label`, `confidence`, `anti_virality_gated`, `dropoff_segment_indices`, `hook_decomposition` already shipped by Phases 1, 3, 9, 13)
- New LLM calls inside the script endpoint (R5.1 explicit: "pure transformation, no new LLM calls")
- Notion import URL (R5.2 explicit defer to M2-II)
- Calendar integration / Google Calendar export (R6.2 explicit defer)
- Creator-profile-wide post-time default (e.g., "always Saturdays") — Phase 6 ships analysis-scoped override only; creator-default is M2-II
- Niche-specific aggregate counts beyond what `optimal_post_window.reasoning` already encodes (no new query, no new endpoint, no new table)
- Share & export (Phase 7 fills `ActionsShareSlot`)
- Mobile polish + WOW onboarding + tutorial overlays (Phase 8)
- Audience node (Phase 4 — shipped), Engine group + Input drawer (Phase 2 — shipped), Verdict + Content Analysis nodes + Similar Videos card (Phase 5 — shipped)
- Anti-virality "Post anyway" override (Phase 5 D-04 / R1.3 — Phase 6 inherits and does NOT modify)

</domain>

<decisions>
## Implementation Decisions

### Architectural optimizations (cross-cutting)

- **O-1: Phase 5 slot wrappers are stable APIs — Phase 6 swaps inner content only.** `ActionsReshootHeroSlot.tsx` and `ActionsOptimalPostSlot.tsx` already exist with `data-testid`s wired. Phase 6 keeps the wrapper component name + filename + testid and swaps the child from `<PlaceholderCard />` to real content. This preserves Phase 5's `Board.tsx` integration, telemetry hook (`actions_reshoot_placeholder_visible`), and grid choreography (`ACTIONS_GRID_AV_ROWS = '160px 1fr'`) untouched. Researcher confirms `ActionsNode.tsx:48,56,68,75` import paths stay unchanged.
- **O-2: Server-first transformation, no client computation of script.** R5.1 mandates `<200ms` server endpoint. Doing the heuristic mapping on the client would (a) duplicate logic across `/analyze` and any future export surface, (b) leak engine internals into the bundle, (c) lose cacheability. Endpoint owns the truth; React just renders strings.
- **O-3: Reuse `useCopyToClipboard` (already exists at `src/hooks/useCopyToClipboard.ts`).** Already returns `{ copied, copy }` with reset timer. Per-section + Copy-all buttons share one hook instance per panel — researcher confirms the hook handles concurrent calls (likely fine — last-write-wins on the `copied` boolean is acceptable).
- **O-4: Reuse Phase 4 `<Sheet>` inspector primitive (`src/components/ui/sheet`) for the non-AV "tap to open script" route.** `PersonaInspector.tsx` shows the pattern — Sheet wraps the same body component the AV hero renders. No new inspector primitive needed. Defer the Claude's-Discretion item from Phase 5 ("extract base `<Inspector />` primitive") unless researcher finds 3+ concrete reuse sites in Phase 6 (likely 2 max — script + post-time edit picker). Keep `PersonaInspector` separate.
- **O-5: One canonical script body component, two parent wrappers.** Build `src/components/board/actions/script/ScriptBody.tsx` (the 4 sections + copy buttons). It's rendered (a) directly inside `ActionsReshootHeroSlot` in AV state and (b) inside a `<Sheet>` content area when triggered from the compact teaser. Same component, different chrome. Avoids divergent rendering paths.
- **O-6: Optimal-post panel reuses the same compact-card pattern as `SimilarVideoCardCompact`** (~80 lines, single-purpose card). Build `src/components/board/actions/optimal-post/OptimalPostCard.tsx`. Edit affordance (when user taps day/time chip) opens a small Sheet — same `<Sheet>` primitive as O-4. No native `<select>` (mobile UX is atrocious for hour ranges).
- **O-7: Content-addressed caching means no TTL, no stale-while-revalidate complexity.** Phase 6's script is derived from `PredictionResult`; PredictionResult is immutable per analysis_id; analysis_id is fresh on every engine run (per `prediction-cache.ts:74` L2 contract). So once `script_result` is written, it never needs refresh. This collapses the caching question to "compute lazily, write through, never invalidate." Researcher confirms `analysis_results.id` is immutable (it is — `ON DELETE` is the only mutation path).
- **O-8: Folder structure mirrors Phase 5 conventions** (per 05-CONTEXT.md §file-layout):
  ```
  src/components/board/actions/
    script/
      ScriptBody.tsx                 # 4-section renderer + copy buttons
      ScriptInspectorTrigger.tsx     # compact teaser → Sheet
      ScriptEmptyState.tsx           # R5.3 high-confidence variant
      script-constants.ts            # section labels + telemetry events
      script-types.ts                # ScriptResult type re-export
    optimal-post/
      OptimalPostCard.tsx            # day/time/reasoning + edit affordance
      OptimalPostEditSheet.tsx       # edit picker
      OptimalPostSourcePill.tsx      # niche/fallback/creator provenance
      optimal-post-constants.ts      # telemetry + copy
  ```

### Script transformation endpoint (R5.1, plans 6.1 + 6.2)

- **D-01: Endpoint = `GET /api/analyze/[id]/script`**. GET (not POST) — pure read-side compute, idempotent, safely cacheable. Mirrors `/api/analyze/[id]/comparisons/route.ts` line-by-line where possible:
  - Zod `ParamsSchema` validating url-safe id (8-64 chars, `^[A-Za-z0-9_-]+$`) per comparisons:34
  - `auth.getUser()` gate (T-05-16 pattern)
  - `.eq('user_id', user.id)` + RLS on `analysis_results` (defense-in-depth)
  - Returns 404 for both missing-row AND wrong-owner (indistinguishable per stream/route.ts:78 pattern — prevents enumeration)
  - `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 30` (not 300 — pure DB lookup, no streaming)
- **D-02: Response shape (Zod-validated server-side, type-shared with client):**
  ```ts
  type ScriptResult =
    | { is_empty_state: false; script: { opening_line: string; scene_order: string[]; voiceover: string; captions: string[] }; engine_version: string; generated_at: string }
    | { is_empty_state: true; opening_variants: string[]; engine_version: string; generated_at: string };
  ```
  `is_empty_state` discriminator drives client-side render branching cleanly. `engine_version` echoed so client can sanity-check against `result.engine_version`. `generated_at` is the cache-write timestamp (or NOW() on first compute).
- **D-03: Transformation algorithm — deterministic, no randomness, no LLM.**

  **Step 1: Load `PredictionResult` from `analysis_results.id = ${id} AND user_id = ${user.id}`.** Read columns: `counterfactuals` (JSONB), `factors` (JSONB), `reasoning` (TEXT), `confidence_label` (TEXT), `confidence` (NUMERIC), `anti_virality_gated` (BOOLEAN), `dropoff_segment_indices` (INT[]), `hook_decomposition` (JSONB), `engine_version` (TEXT), `script_result` (JSONB — cache check).

  **Step 2: Cache hit?** If `script_result IS NOT NULL`, parse + return. Done.

  **Step 3: Empty-state branch (R5.3).** If `confidence_label === 'HIGH'` AND `anti_virality_gated === false` AND `(counterfactuals?.band === 'high' || confidence >= 0.7)`:
  - Filter `counterfactuals.suggestions[]` where `type === 'stretch'` AND `signal_anchor` matches `/^hook_decomposition\.|gemini_factor\.Hook|first_words|opening/i`
  - Take top 2-3 by occurrence order (engine emits them in importance order per stage11-counterfactuals-prompts.ts)
  - Map to `opening_variants[]` = `suggestion.headline` (≤80 chars per `CounterfactualSuggestionItem`)
  - If fewer than 2 stretch-hook suggestions found, supplement with `factors[]` where `name` matches /hook|opening/i AND `score >= max_score * 0.7` → derive variant from `improvement_tip`
  - Return `{ is_empty_state: true, opening_variants, ... }`. Skip Steps 4-7.

  **Step 4: `opening_line` derivation.**
  - **Primary source:** `counterfactuals.suggestions[]` filtered by `type === 'fix'` AND `signal_anchor` matches `/^hook_decomposition\.visual_stop_power$|^hook_decomposition\.audio_hook_quality$|^hook_decomposition\.first_words_speech_score$|^hook_decomposition\.text_overlay_score$|gemini_factor\.Hook|opening/i`. Pick the suggestion whose `signal_anchor` corresponds to `hook_decomposition.weakest_modality` (greedy: fix the weakest first). If multiple, pick lowest `timestamp_ms` (earliest in video).
  - **Fallback 1:** Any `factor` whose `name` matches /hook|first|opening/i AND `score < max_score * 0.5` → use `improvement_tip` verbatim.
  - **Fallback 2:** `"Lead with the strongest visual moment in the first 1 second — see Hook breakdown for which modality needs the biggest lift."` (deterministic constant).
  - Output = a single string (1-2 sentences, ≤200 chars). Construction: `"${suggestion.headline}. ${suggestion.detail.slice(0, 140)}"` — trim to keep total ≤200.

- **D-04: `scene_order[]` derivation.**
  - Start with all `counterfactuals.suggestions[]` where `type === 'fix'` AND `timestamp_ms > 0`.
  - If `dropoff_segment_indices.length > 0`, prioritize suggestions whose `timestamp_ms` falls within dropoff-segment time bounds (need segment→ms mapping — researcher locks via `heatmap.segments[].t_start` lookup; fallback: order by raw `timestamp_ms` ASC and call it a day).
  - Map each to: `"${formatTime(timestamp_ms)} — ${headline}"` where `formatTime` produces `"0:08"` style (reuse existing `src/lib/utils.ts` or `src/lib/time.ts` helper — researcher confirms; if absent, inline a 4-line formatter).
  - Cap at 6 items (R5.1's schema doesn't bound, but creator UX collapses past ~6 scenes).
  - If empty after filtering: `["Keep the existing scene order — no major reshoots needed below the hook."]` (single string array — graceful degrade).

- **D-05: `voiceover` derivation.**
  - **Primary:** Concatenate `reasoning` (the DeepSeek narrative — already prose) with the top 3 `improvement_tip`s from `factors[]` (where `score < max_score * 0.6`, sorted by `score` ASC).
  - Construction template:
    ```
    "${reasoning}

    Three tightenings while you record: ${tip1} ${tip2} ${tip3}"
    ```
  - Strip markdown if `reasoning` contains any (use a lightweight regex; researcher checks if `reasoning` is ever non-plain — Phase 13 reasoning is plain prose per stage11-counterfactuals tests).
  - Cap at 1200 chars (TikTok creators copy-paste into voice memos / teleprompters; longer = useless).
  - Fallback if `reasoning` is null/empty: just the 3 tips bulleted.

- **D-06: `captions[]` derivation.**
  - **Primary source:** `counterfactuals.suggestions[]` where `signal_anchor` matches `/text_overlay|hashtag|caption|cta/i` AND `type === 'fix'`. Take `headline` field directly (already ≤80 chars).
  - **Supplement:** `factors[]` where `name` matches /text|overlay|caption/i AND `score < max_score * 0.5` → derive a caption variant from `improvement_tip` (truncate to 80 chars).
  - **Always include** a single A/B alternative: pick the highest-impact text-overlay suggestion and emit both the headline and a 80-char-trimmed variant of `detail`.
  - Cap at 5 captions total (creator UX collapses past ~5; matches `retrieval_evidence` cap pattern).
  - Empty fallback: `["Add a 2-3 word text overlay at the hook moment matching your spoken first words."]` (single-item array — never empty, never null).

- **D-07: Latency budget validation.** Endpoint should consistently land under 200ms p95 because:
  - Single Supabase `analysis_results` SELECT (PRIMARY KEY lookup, ~10-30ms)
  - Pure JS transformation on JSON already in memory (~5ms)
  - Cache-miss write is a single UPDATE (~20-40ms, fire-and-forget OK)
  - Subsequent hits: SELECT-only (cache populated) ~10-30ms
  - Cold function init in Fluid Compute may add ~100ms occasionally — acceptable per R5.1 "<200ms" (assume p95 not p100).

- **D-08: Service-client cache write.** First-request flow writes `script_result` via service-client (not user-client) to bypass RLS WRITE restrictions cleanly. Mirrors `prediction-cache.ts:populatePredictionCache` pattern. Failure to write does NOT fail the response — log via `createLogger({ module: 'analyze.script' })`, return computed result, accept the cache miss on next request.

### Script caching (plan 6.2)

- **D-09: New JSONB column on `analysis_results`** — additive migration `20260530000000_script_result.sql`:
  ```sql
  ALTER TABLE analysis_results
    ADD COLUMN IF NOT EXISTS script_result JSONB;
  -- No NOT NULL constraint; legacy rows + first-fetch-pending rows have NULL.
  -- No index — only ever queried by primary key (analysis id).
  -- No CHECK on schema — Zod parses on read; future schema evolution stays cheap.
  ```
- **D-10: No invalidation.** Per O-7. Cache lifetime == row lifetime. Re-running engine produces a new row (new id), so the new row has `script_result = NULL` and gets populated on first request. Researcher validates by reading `prediction-cache.ts:populatePredictionCache` — confirm L2 cache (`analysis_results`-keyed) doesn't update an existing row, it creates a new one on cache miss.
- **D-11: TanStack Query client cache.** Key: `['script', analysisId]`. `staleTime: Infinity` (server cache is source of truth, never stale). `gcTime: 5 * 60 * 1000` (5min — drop from memory if tab inactive). Mirrors `useComparisons` Phase 5 pattern (researcher confirms file path).
- **D-12: Backfill not required.** Older rows render with `script_result === null` → endpoint computes on first request. No need to run a one-shot job. The PR ships migration + endpoint + UI in one wave.

### Script UI: hero state + default teaser (R5.2)

- **D-13: AV grown-state layout (when `boardState === 'anti-virality'`).** `ActionsReshootHeroSlot` becomes `col-span-2` and renders ~360×160:
  ```
  ┌──────────────────────────────────────────────────────┐
  │ Reshoot script               [Copy all] ←sticky pill │
  │ ─ New Opening ──────────────────────────  [Copy]    │
  │   {opening_line}                                     │
  │ ─ Scene Order ──────────────────────────  [Copy]    │
  │   0:00 — Hook with motion frame                      │
  │   0:08 — Cut to face reveal                          │
  │   ... up to 6 lines, internal scroll if overflow    │
  │ ─ Voiceover ────────────────────────────  [Copy]    │
  │   {voiceover, line-clamp-3, "more" expands inline}   │
  │ ─ Captions ─────────────────────────────  [Copy]    │
  │   • Add "POV:" overlay at 0:01                       │
  │   • A/B: "Wait until 0:08 ↓"                         │
  └──────────────────────────────────────────────────────┘
  ```
  Density: `text-[10px] uppercase tracking-wide text-white/55` for section labels, `text-xs text-white/85` for body, dashed `border-white/[0.06]` between sections (1px). Section header includes a small per-section copy button (`<CopyButton variant="ghost" size="xs" target={section} />`). Sticky `Copy all` pill top-right uses `<GlassPill>` from `src/components/ui/GlassPill`.
- **D-14: Default (non-AV) compact teaser at 170×88.** First-line preview + Inspector trigger:
  ```
  ┌─────────────────────────────┐
  │ ✿ Reshoot script            │
  │   Lead with motion frame…   │
  │              Open script →  │
  └─────────────────────────────┘
  ```
  Card body: top label "Reshoot script" (small chip), middle row = `opening_line` truncated to ~50 chars with ellipsis, bottom row = "Open script →" affordance (white/55, hover white/80). Tap opens Sheet with the same `<ScriptBody />` component used in AV state. Reuses Phase 4 `<Sheet>` primitive — no new modal infra.
- **D-15: `ScriptBody` is one component used in two places** (per O-5). Renders unconditionally regardless of host. Receives `script: ScriptResult` + `onCopySection: (section: string) => void` + `onCopyAll: () => void` callbacks. Hosts pass copy callbacks that wire up `useCopyToClipboard` + telemetry.
- **D-16: Per-section copy buttons fire `script_section_copied` telemetry** with `{ analysis_id, section: 'opening'|'scenes'|'voiceover'|'captions' }`. Copy-all fires `script_copy_all` with `{ analysis_id, total_chars }`. Reuse `logger.info(...)` pattern from `actions-constants.ts:TELEMETRY`.
- **D-17: Copy-all format with headers** (R5.2 explicit "Whole script has a 'Copy all' button that includes section headers"):
  ```
  REWRITE SCRIPT (analysis {{id}})

  ## New Opening
  {opening_line}

  ## Scene Order
  - 0:00 — Hook with motion frame
  - 0:08 — Cut to face reveal

  ## Voiceover
  {voiceover}

  ## Captions
  - {caption1}
  - {caption2}
  ```
  Plain markdown headings + bullets (creators paste into Notion/Notes/Docs — all render this cleanly). Header copy `REWRITE SCRIPT (analysis {{id}})` lets creators trace which analysis a script came from when juggling drafts.
- **D-18: Streaming + skeleton states.** Phase 5 already wires `ActionsNode` against `useAnalysisStream`. Phase 6:
  - While `phase !== 'complete' && phase !== 'reconnecting'`: render placeholder card (current Phase 5 behavior — keep dashed border). Don't try to render partial script — engine emits counterfactuals only at terminal.
  - On `complete`: TanStack Query fires `useScript(analysisId)` automatically (query enabled when `analysisId && phase === 'complete'`). Skeleton during fetch (~10-30ms typical) = subtle pulsing on the section labels. Avoid full-card shimmer — too jumpy after the engine SSE finally settles.
  - On error: render `<ScriptEmptyState variant="error" />` with `"Couldn't generate script — retry"` + retry button (refetch via TanStack Query).
- **D-19: Anti-virality hero state copy hierarchy.** Inside AV state, the Verdict node already screams "Don't post yet". The reshoot hero is the CONSTRUCTIVE next step. Headline = `"Try this instead"` (NOT "Reshoot script" — that's the default-state label). Subhead = `"4-section rewrite based on what dropped"`. Subtler than competing with Verdict's orange band. Coordinates with Phase 5 D-15 quiet anti-virality treatment.

### Script empty/high-confidence state (R5.3)

- **D-20: Empty-state trigger** = endpoint returns `is_empty_state: true`. Client detects discriminator and renders `<ScriptEmptyState />` regardless of host (AV hero or default slot). **Both states get the same component** — empty state in AV is unusual (AV implies low confidence, so empty implies high confidence — they conflict) but the render is graceful: empty wins, AV chrome gets the empty body. Researcher confirms the AV-AND-empty combination should never occur per `isAntiViralityGated` logic but the empty body is the safe render.
- **D-21: Empty state copy + layout** (default 170×88 slot):
  ```
  ┌─────────────────────────────┐
  │ ✓ Your video is solid       │
  │   Optional tweaks below     │
  │   ─── A/B opening ───       │
  │   • Lead with X        [Copy]│
  │   • Lead with Y        [Copy]│
  └─────────────────────────────┘
  ```
  Top row = green-ish check (use `text-emerald-300/70` — Raycast doesn't ban green for confirmation states, only avoids it for accents). Mid = "Optional tweaks below" (white/55). Bottom = 2 (max 3) A/B opening variants from `opening_variants[]` as small chips with copy buttons. No Inspector route — there's nothing more to show.
- **D-22: AV-state empty render** (defensive). Same component, scaled. Since AV state grants col-span-2 grown space, the body just stretches and centers. No need to special-case.
- **D-23: Empty-state telemetry** — `script_empty_state_shown` fires once per analysis with `{ analysis_id, variant_count: opening_variants.length }`. Helps validate the R5.3 threshold (confidence ≥ 0.7) is set right — if 90% of analyses hit empty state, threshold is too generous.

### Optimal post-time card (R6.2 + plan 6.5 + plan 6.6)

- **D-24: Compact card in 170×88 slot** — same dimensions both in AV (bottom row, three-column subgrid per Phase 5 D-10) and default. Layout:
  ```
  ┌─────────────────────────────┐
  │ ⏰ When to post              │
  │   Tue · 6-9 PM   [Edit]     │
  │   Your fitness niche peaks  │
  │   Tue evenings (n=12) [ⓘ]   │
  └─────────────────────────────┘
  ```
  - Top label: "When to post" + clock icon (`@phosphor-icons/react/Clock` — already imported by `ActionsOptimalPostSlot.tsx`).
  - Day + time chip: bold inline pill — `<GlassPill>{day} · {hourRangeFormatted}</GlassPill>` (tappable → opens edit Sheet).
  - Reasoning row (text-[11px] white/65): truncate `optimal_post_window.reasoning` to ~70 chars, tooltip on hover for full text on desktop.
  - Source pill (`source: 'niche'|'fallback'|'creator'`): small `<GlassPill size="xs">` rendering "niche" / "default" / "yours". Tap → tooltip explaining provenance (plan 6.6 surface).
- **D-25: Timezone conversion** — purely client-side, no server changes. Engine always emits UTC. Client uses `Intl.DateTimeFormat().resolvedOptions().timeZone` to detect user TZ + `Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: userTz })` to format the hour range. Day-of-week conversion: derive a synthetic Date at `next ${day_of_week} ${hour_start}:00 UTC`, format in user TZ, extract day name from result. Edge case: TZ shift crosses midnight (e.g., Tue 23-24 UTC becomes Wed 00-01 in user TZ) → use the post-conversion day name. Encapsulate in `src/lib/optimal-post-time.ts` (new util, ~40 lines) with unit tests against multiple TZs.
- **D-26: Hour-range formatting.** UTC `[18, 21]` → user-TZ → "6-9 PM" (12-hour) or "18:00-21:00" (24-hour). Recommendation: **12-hour with AM/PM** — TikTok creators are consumer-grade audience. Use `Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: true })` (respects locale; falls back to 24h in locales that prefer it). Edge case: range spanning AM/PM boundary (e.g., 11-13 UTC = "5-7 AM" → "11 AM - 1 PM" in a US TZ): use `formatRange` if both have same period, full pattern otherwise. Researcher confirms `Intl.DateTimeFormat.formatRange` availability — broadly supported.
- **D-27: Edit Sheet.** Tap day/time chip opens a `<Sheet>` (Phase 4 primitive). Body: two compact picker rows.
  - **Day picker:** 7 small pill buttons (Mon-Sun), highlighted = current selection. Tap = select. Single-state, no save button.
  - **Time picker:** Two `<select>` elements (start hour, end hour, 0-23 in 1-hour granularity OR 12-hour formatted — match D-26 choice). End must be > start. Validation inline.
  - **Save**: bottom-pinned button "Save for this analysis". Closes Sheet, fires `POST /api/analyze/[id]/optimal-post-override`, updates TanStack Query cache optimistically.
  - **Reset to recommendation**: small text link "Reset to {original_day} {original_hours}" — clears override.
- **D-28: Override persistence — analysis-scoped only (Phase 6).**
  - New JSONB column `analysis_results.optimal_post_override` (migration `20260530000001_optimal_post_override.sql`). Default NULL.
  - Shape: `{ day_of_week: 'Mon'..'Sun', hour_range: [number, number], saved_at: string }` (no timezone — stored UTC; client converts).
  - New endpoint `POST /api/analyze/[id]/optimal-post-override` mirrors `/api/analyze/[id]/override/route.ts` (Zod validation, auth.getUser, RLS, generic error codes).
  - Client renders override value if `optimal_post_override !== null`; otherwise renders `optimal_post_window`. Source pill reflects: if override present, source = `'creator'`; else server-emitted source.
  - **Why analysis-scoped not creator-profile-wide:** creator-wide preference is M2-II (deferred). Analysis-scoped covers "let me tweak this specific recommendation" without coupling Phase 6 to creator-profile schema migrations. If user wants creator-wide later, it's a follow-up phase that adds a `creator_profiles.preferred_post_window` column + an "Apply to all future analyses" checkbox in the same Sheet.
- **D-29: Niche reasoning surface (plan 6.6)** = the reasoning row + source pill. NO new endpoint, NO new aggregate. The engine already shapes `optimal_post_window.reasoning` as `"Your fitness niche peaks Tue 18:00-21:00 UTC (n=12 videos)"` (per `optimal-post.ts:98`). Phase 6 just renders it.
  - **Source pill states:**
    - `source === 'niche'` → pill text "from your niche", tooltip "Recommendation based on {N} videos in {niche_primary}. Niche detected from your creator profile."
    - `source === 'fallback'` → pill text "default", tooltip "Niche data unavailable for your profile yet — using the default Tue evening window. Add your niche to your creator profile for tailored timing."
    - `source === 'creator'` → pill text "yours", tooltip "Edited for this analysis. Reset to use the niche recommendation."
  - **Extracting `n=` count from reasoning**: regex `/n=(\d+)/`. If extraction fails, tooltip omits the count. Cheap, no schema change.
  - **Extracting `niche_primary`**: read from creator_profiles or from analysis input — researcher locks the cheapest source. Likely already available via the existing analysis API; if not, omit from tooltip.
  - Fallback copy is INVITATION not apology — "Add your niche to your creator profile" is a CTA, not a "sorry we don't know you."

### Telemetry (NF4)

- **D-30: Structured logger events** (extend `actions-constants.ts:TELEMETRY`):
  - `script_section_copied` — `{ analysis_id, section: 'opening'|'scenes'|'voiceover'|'captions', char_count }`
  - `script_copy_all` — `{ analysis_id, total_chars, has_empty_state: false }`
  - `script_inspector_opened` — `{ analysis_id, trigger: 'compact_teaser_tap' }`
  - `script_empty_state_shown` — `{ analysis_id, variant_count }` (fire once per analysis render)
  - `script_endpoint_cache_hit` / `script_endpoint_cache_miss` (server-side, structured logger)
  - `optimal_post_tz_converted` — `{ analysis_id, source_tz: 'UTC', user_tz, crossed_midnight: boolean }` (fire on first render per analysis)
  - `optimal_post_edited` — `{ analysis_id, old: {day, hours}, new: {day, hours}, edit_count }`
  - `optimal_post_source_explained` — `{ analysis_id, source: 'niche'|'fallback'|'creator' }` (fire when tooltip opens)
  - `optimal_post_reset_to_recommendation` — `{ analysis_id }`

### Accessibility + perf-tier respect

- **D-31: `prefers-reduced-motion`** — Sheet open/close uses existing primitive's reduced-motion support. Per-section copy button "copied!" toast = simple opacity transition, no spring. AV-grown row transition (160px → height grow) inherits Phase 5's `transition: grid-template-rows 200ms ease-out` and respects the existing `prefersReducedMotion ? 'none' : ...` (already wired in `ActionsNode.tsx:43`).
- **D-32: Keyboard navigation** — Per-section copy buttons reachable via Tab. Enter copies + flashes "Copied!" inline pill. Edit Sheet trap-focus + Esc-closes (Sheet primitive owns this). Day-picker pills navigable with arrow keys (`role="radiogroup"`).
- **D-33: `aria-live="polite"` announcements** — `<ActionsNode>` already has `aria-live="polite"` (Phase 5). Phase 6 adds:
  - Script-ready announcement: `"Reshoot script ready — 4 sections."` on first render.
  - Empty-state announcement: `"Your video is solid. {N} optional opening variants available."`.
  - Copy confirmation: `"Copied {section} to clipboard."` (live-region update, debounced 500ms to avoid spam).
- **D-34: Perf-tier** (`src/lib/perf-tier.ts`) — Phase 6's UI is plain DOM (no Konva, no Recharts, no canvas). No perf-tier branching needed. Sheet primitive's animation respects the tier (researcher confirms Phase 4 wired it).

### Streaming + state handling

- **D-35: Script endpoint NOT called during streaming.** TanStack Query enabled flag: `enabled: !!analysisId && phase === 'complete'`. Avoids hitting `/script` while engine is still computing (would return 404 or incomplete data — `counterfactuals` may be null pre-terminal). Cleaner than racing the stream.
- **D-36: Optimal-post panel renders as soon as `partial.optimal_post_window` exists** (no need to wait for `complete`). Engine emits `optimal_post_window` early in pipeline (Phase 1 `aggregator.ts`). Treat undefined → render skeleton (1 line dim placeholder).
- **D-37: Anti-virality transition mid-render** — Phase 5 wires the `complete → anti-virality` transition. Phase 6's hero state subscribes to `getFrameAntiViralityState('actions', boardState)` (already imported by `ActionsNode.tsx:6`). On flip, grid grows + hero swaps from compact teaser to full body via CSS transition. No additional state logic.

### Cross-phase coordination

- **D-38: Phase 5 `ActionsShareSlot` left untouched.** Still placeholder until Phase 7 fills. Phase 6 changes don't touch it.
- **D-39: Phase 5 `ActionsReshootHeroSlot` wrapper API unchanged.** Phase 6 modifies only the JSX inside the wrapper (per O-1). The `data-testid="actions-reshoot-hero-slot"` stays. The `data-testid="actions-reshoot-placeholder"` is removed (placeholder gone), replaced with `data-testid="actions-reshoot-body"`. Researcher checks `actions/__tests__/` for tests referencing the placeholder testid — they'll need updating to expect the body testid post-Phase-6.
- **D-40: Verdict's anti-virality "Top-3 fixes" (Phase 5 D-08) and Reshoot hero state coordinate.** Verdict's top-3 fixes are short-form (`headline ≤80 chars` + `detail` 1-2 sentences) per `counterfactuals.suggestions[].type === 'fix'`. Phase 6's reshoot script is long-form, fully structured. They share the same source data (`counterfactuals.suggestions[]`). Cross-coherence rule: **a fix that appears as a Verdict top-3 item MUST appear in Phase 6's `scene_order[]`** (same suggestion, surfaced in two places at different abstraction levels). The transformation algorithm (D-04) ensures this naturally — both filter `type === 'fix'`. Researcher verifies no divergence (e.g., Verdict using `band` to filter while Phase 6 doesn't).

### Claude's Discretion (researcher locks during planning)

- **Hook-related `signal_anchor` regex precision** (D-03, D-04) — confirm against Stage 11 prompt's emitted enum: known anchors include `hook_decomposition.visual_stop_power`, `hook_decomposition.audio_hook_quality`, `hook_decomposition.first_words_speech_score`, `hook_decomposition.text_overlay_score`, `gemini_factor.Hook ${name}`, `audio_signals.music_ratio`, `audio_signals.voice_clarity`, `persona_dissent`. Phase 6 regex should match the union, not invent anchors. Update the regex in `D-03 Step 3` + `D-03 Step 4` if researcher finds additional anchors. If anchors evolve in M2-II, the script endpoint's filter degrades gracefully (suggestions whose anchors don't match the hook regex flow into `scene_order[]` instead — harmless).
- **`segment idx → timestamp_ms` mapping** for D-04 dropoff prioritization. Need `heatmap.segments[].t_start` or equivalent. If `dropoff_segment_indices` isn't easily mappable to timestamps in the row's JSONB, drop the prioritization heuristic and fall back to plain `timestamp_ms` ASC sort. Don't block on it.
- **Time formatter location** (`formatTime(ms)` in D-04) — likely `src/lib/utils.ts` or `src/lib/time.ts`. If absent, inline a 4-line `formatTime` in `script-utils.ts` colocated with the endpoint. Don't create a new `src/lib/time/` package for one helper.
- **Markdown handling in `reasoning`** (D-05) — empirically `reasoning` is plain prose per Phase 13 tests. If researcher finds a counter-example, strip markdown with a 3-line regex: `.replace(/(\*\*|__|`)/g, '')` etc. Don't add `react-markdown` server-side just for one string.
- **`use-script` hook location** — colocate with other TanStack Query hooks at `src/hooks/queries/use-script.ts` (Phase 5 convention).
- **Sheet vs Drawer for the script Inspector route** — `PersonaInspector.tsx` uses `Sheet`. Reuse. If mobile breakpoint requires bottom-sheet variant, the Sheet primitive already supports it via `side="bottom"` — no new primitive.
- **Copy button visual** — small ghost icon button using `Copy` from `@phosphor-icons/react`, white/55 → white/80 on hover. Inline "Copied!" pill replaces icon for 1.5s post-copy. Researcher confirms no existing `<CopyButton>` primitive — if one exists, reuse; else inline a 30-line component.
- **Empty-state threshold tuning** — current trigger: `confidence_label === 'HIGH' && anti_virality_gated === false && (counterfactuals?.band === 'high' || confidence >= 0.7)`. If researcher finds `counterfactuals.band` is the more reliable signal, simplify to `band === 'high' && !anti_virality_gated`. Telemetry (D-23) will confirm rates post-launch.
- **`OptimalPostWindow.timezone === "UTC"` literal constraint** — the type narrows to `"UTC"`. Don't try to be clever about server-side TZ conversion. Always render UTC → client TZ in the React layer.
- **Day picker UI primitive** — if Raycast has a built-in day picker (likely no), inline 7 pills with `role="radiogroup"`. Researcher checks `src/components/ui/` for any week-day component before building.
- **Override TTL** — overrides are forever (per-analysis). No automatic expiry. If user re-runs analysis (new id), override doesn't carry over (creator-wide preference is M2-II). Researcher confirms this matches user mental model — probably yes.
- **Test fixtures** — `__tests__` for the script endpoint need fixtures with various `band` × `confidence` × `anti_virality_gated` × signal-anchor combinations. Researcher catalogues these from existing `stage11-counterfactuals.test.ts` fixtures and reuses where possible.
- **Engine-version skew** — if `script_result.engine_version !== analysis_results.engine_version` (somehow), force recompute on read. Cheap defensive check. Probably never triggers in practice (engine version baked into analysis_id derivation).
- **Copy-all character count cap** — total markdown output should comfortably fit in iOS Notes (~250KB). Realistic script outputs: ~1500-3000 chars. No cap needed.
- **Mobile compact card density** — at 170×88, 4 rows of text may feel cramped on mobile. Researcher prototypes; if too dense, drop the source-pill tooltip target and surface it only on the edit Sheet.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + roadmap
- `.planning/MILESTONE.md` — Result Surface milestone scope + board-model amendment (2026-05-25) + magic-moment framing
- `.planning/ROADMAP.md` §Phase 6 — phase goal, plans 6.1-6.6, success criteria, dependencies (Phase 5 Actions group scaffold)
- `.planning/REQUIREMENTS.md` §R5.1 (script endpoint contract, <200ms p95, schema), §R5.2 (4 sections + per-section copy + Copy-all + section headers + Notion deferred), §R5.3 (empty state at confidence ≥0.7), §R6.2 (When-to-post panel — auto-detected timezone + reasoning one-liner + editable + no calendar), §NF1 (perf tiers), §NF2 (accessibility WCAG AA), §NF4 (telemetry instrumentation)
- `.planning/PROJECT.md` §Key Decisions — server-first, TanStack Query, Zustand, Konva, Raycast design language (12px radius, 6% borders, 10% hover, Inter font)

### Prior phase context (still applies — Konva/DOM split, anti-virality coordination, Inspector pattern inherited)
- `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/01-CONTEXT.md` — Phase 1 SSE consumer + `useAnalysisStream` (`partial`, `result`, `stages`, `panelReady`, `phase`) + D-13 (OptimalPostWindow shape, niche-aware lookup)
- `.planning/phases/02-board-substrate-navigation/02-CONTEXT.md` — D-04 (Konva + DOM overlay), D-18 (board state machine — anti-virality is cross-group state), D-19 (cross-group ripple), D-20 (perf tiers), D-23 (reduced-motion), D-24 (accessibility)
- `.planning/phases/03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc/03-CONTEXT.md` — D-13 (HeatmapPayload schema — segments with `t_start` map for D-04 dropoff prioritization), D-16/D-17 (anti-virality dual-trigger + `anti_virality_reason` + `dropoff_segment_indices`)
- `.planning/phases/04-live-audience-node-the-killer-feature/04-CONTEXT.md` — O-1 (Konva/DOM split), D-15 (anti-virality QUIET treatment — Reshoot hero must coordinate), Inspector pattern (`PersonaInspector.tsx` as template for `ScriptBody` host)
- `.planning/phases/05-other-group-nodes-verdict-actions-content-analysis-populated/05-CONTEXT.md` — **MUST READ**: D-10 (Actions frame grid: default 2×2 vs AV `'160px 1fr'` with col-span-2 reshoot hero), D-11 (placeholder card pattern Phase 6 REPLACES), D-22 (ActionsReshootHeroSlot + ActionsOptimalPostSlot APIs Phase 6 swaps inside), D-23 (cross-group ripple — Reshoot subscribes to existing selector, NO new state), D-08 (Verdict top-3 fixes share `counterfactuals.suggestions[]` source — coordinate per Phase 6 D-40)

### Codebase intel
- `.planning/codebase/STACK.md` — Next.js 16, React 19, TanStack Query, Zustand, Konva, Recharts, Supabase, Vitest
- `.planning/codebase/ARCHITECTURE.md` — route groups, data flow, prediction pipeline, SSE
- `.planning/codebase/STRUCTURE.md` — file layout (Phase 6 follows `src/components/board/actions/{script,optimal-post}/` per Phase 5 precedent)
- `.planning/codebase/INTEGRATIONS.md` — Supabase tables, env vars, Sentry, signed URL pattern

### Engine surfaces consumed (Phase 6 reads — no engine schema changes in Phase 6)
- `src/lib/engine/types.ts:210` — `PredictionResult` interface — Phase 6 reads: `counterfactuals`, `factors`, `reasoning`, `confidence`, `confidence_label`, `anti_virality_gated`, `dropoff_segment_indices`, `hook_decomposition`, `optimal_post_window`, `engine_version`
- `src/lib/engine/types.ts:402` — `CounterfactualSuggestionItem` — `type: "fix"|"stretch"|"reinforcement"`, `headline ≤80 chars`, `detail`, `timestamp_ms`, `signal_anchor` (the routing key for D-03 + D-04 + D-06)
- `src/lib/engine/types.ts:416` — `CounterfactualResult` — `band: "low"|"mid"|"high"` + `suggestions[]` (band drives D-20 empty-state branch)
- `src/lib/engine/types.ts:175` — `Factor` interface — `name`, `score`, `max_score`, `rationale`, `improvement_tip` (consumed in D-05 voiceover assembly + D-03 fallback)
- `src/lib/engine/optimal-post.ts:18` — `OptimalPostWindow` shape (`day_of_week`, `hour_range`, `timezone: 'UTC'`, `reasoning`, `source: 'niche'|'creator'|'fallback'`)
- `src/lib/engine/optimal-post.ts:38` — `FALLBACK_POST_WINDOW` (Tue 18-21 UTC; reasoning copy already written)
- `src/lib/engine/optimal-post.ts:78` — `computeOptimalPostWindow` (Phase 1, already shipped — Phase 6 just consumes the output)
- `src/lib/engine/stage11-counterfactuals-prompts.ts:45,183` — counterfactual schema (signal_anchor enum reference)
- `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` — signal_anchor examples (`hook_decomposition.visual_stop_power`, `hook_decomposition.audio_hook_quality`, `gemini_factor.*`, `audio_signals.*`, `persona_dissent`) for D-03 regex validation

### Database (Phase 6 adds 2 additive migrations)
- `supabase/migrations/20260524000000_niche_post_windows.sql` — niche_post_windows table (Phase 1 — Phase 6 reads via existing engine path, NO direct query)
- `src/types/database.types.ts:599` — `creator_profiles` schema (read `niche_primary` for D-29 source-pill tooltip)
- **NEW** `supabase/migrations/20260530000000_script_result.sql` — adds `analysis_results.script_result JSONB` column (D-09)
- **NEW** `supabase/migrations/20260530000001_optimal_post_override.sql` — adds `analysis_results.optimal_post_override JSONB` column (D-28)

### API route precedents (Phase 6 mirrors)
- `src/app/api/analyze/[id]/comparisons/route.ts` — GET endpoint template (Zod id validator, auth.getUser, RLS, runtime/dynamic/maxDuration). Phase 6 `/script` endpoint mirrors this line-by-line where possible.
- `src/app/api/analyze/[id]/override/route.ts` — POST endpoint template with JSONB write to `analysis_results.analysis_override`. Phase 6 `/optimal-post-override` endpoint mirrors this shape.
- `src/lib/engine/cache/prediction-cache.ts:74` — L2 cache pattern (content-addressed, service-client write). D-08 + D-10 cache write-through mirrors the spirit.

### Board substrate consumed (Phase 2 + Phase 5 shipped)
- `src/components/board/Board.tsx:47` — refactored in Phase 5 D-21 to `useAntiViralityAffectedFrames()` selector — Phase 6 inherits, no change
- `src/components/board/cross-group-state.ts` — `getFrameAntiViralityState('actions', boardState)` already used by `ActionsNode.tsx:18` (Phase 5)
- `src/components/board/board-constants.ts:26-31` — `GROUP_FRAMES` bounds: actions 360×200 default, grows to 360×360 in AV
- `src/components/board/actions/ActionsNode.tsx` — top-level Actions node Phase 5 ships — Phase 6 changes only the JSX inside `ActionsReshootHeroSlot` + `ActionsOptimalPostSlot`
- `src/components/board/actions/actions-constants.ts` — `ACTIONS_GRID_DEFAULT_ROWS`, `ACTIONS_GRID_AV_ROWS`, `TELEMETRY` — Phase 6 extends TELEMETRY (per D-30); grid constants stay
- `src/components/board/actions/ActionsReshootHeroSlot.tsx` — wrapper Phase 6 modifies (inner JSX) per O-1
- `src/components/board/actions/ActionsOptimalPostSlot.tsx` — wrapper Phase 6 modifies (inner JSX) per O-1
- `src/components/board/actions/PlaceholderCard.tsx` — Phase 5 placeholder primitive — Phase 6 stops rendering it inside `ActionsReshootHeroSlot` + `ActionsOptimalPostSlot` (but keeps it for `ActionsShareSlot` until Phase 7)
- `src/components/board/actions/SimilarVideoCardCompact.tsx` — Phase 5 compact-card precedent (~80 lines) for `OptimalPostCard` density (D-24)
- `src/hooks/queries/use-analysis-stream.ts` — Phase 1 SSE hook; `phase === 'complete'` gates Phase 6's script-endpoint TanStack Query enable flag (D-35)
- `src/stores/board-store.ts` — `boardState` selector — Phase 6 subscribes via `useBoardStore` (no new state)

### Primitives to reuse (Raycast design system, Phase 4 + Phase 5 patterns)
- `src/components/ui/sheet.tsx` — Sheet primitive for script Inspector route (D-14) + post-time edit Sheet (D-27)
- `src/components/ui/GlassPill` — chip primitive for day/time chip + source pill (D-24)
- `src/hooks/useCopyToClipboard.ts:25` — copy hook (D-16, returns `{ copied, copy }` with reset)
- `@phosphor-icons/react` — `Clock` (already imported by ActionsOptimalPostSlot), `FilmScript` (already imported by ActionsReshootHeroSlot), add `Copy` for per-section + Copy-all buttons
- `src/lib/logger.ts:logger.info` — telemetry sink for D-30 events
- `src/hooks/usePrefersReducedMotion.ts` — Phase 4 reduced-motion hook (D-31)
- `src/lib/perf-tier.ts` — perf-tier subscription (no branching needed per D-34, but stays available)

### Phase 5 components to study + reuse (engineering patterns to inherit)
- `src/components/board/actions/SimilarVideosCard.tsx` — card-inside-Actions-slot precedent: hooks, empty-state handling, signal-availability gating. Phase 6's `OptimalPostCard` mirrors structure.
- `src/components/board/audience/PersonaInspector.tsx` — Sheet-based inspector pattern; D-14 Phase 6 script Inspector mirrors

### Spec/contract documents
- `.planning/phases/05-other-group-nodes-verdict-actions-content-analysis-populated/05-UI-SPEC.md` (if present) — copy contract referenced by Phase 5 (`actions-constants.ts` COPY block). Phase 6 adds new copy strings; researcher locks copy in a Phase 6 UI-SPEC or extends Phase 5's.

</canonical_refs>

<deferred>
## Noted for Later (not Phase 6)

- **Notion import URL for script** (R5.2 explicit defer to M2-II) — `"Open in Notion"` button alongside Copy-all. Generates a `https://www.notion.so/import?...` deep-link with the script markdown pre-encoded. Held for M2-II.
- **Calendar integration for post-time** (R6.2 explicit defer) — "Add to Google Calendar" button. Held to M2-II at earliest.
- **Creator-profile-wide preferred-post-window** — "Apply to all my future analyses" checkbox in the edit Sheet. Adds `creator_profiles.preferred_post_window JSONB` column + analysis-override fallback chain (analysis → creator → niche → fallback). Held until user telemetry confirms enough creators edit (D-30 `optimal_post_edited` event).
- **Engine `reasoning_sections` field** — if the script endpoint's heuristic `reasoning`-splitting (D-05 voiceover) fails QA, propose an engine extension exposing structured sections. Phase 6 ships without it.
- **Script export formats beyond markdown** — `.txt`, `.docx`, raw JSON download. Held until creator request signals.
- **Per-section regeneration** — "Regenerate just the captions" with constrained LLM call. Held; would violate R5.1 "no new LLM calls" principle for v1.
- **Audio voice-over generation** — TTS the voiceover string. Out of scope; product expansion question.
- **Multi-language script output** — current is English-only (reasoning string + tips are English). i18n is M3.
- **Niche peer comparison** beyond reasoning string — e.g., "Other creators in your niche post at this time" with creator avatars. Would need new aggregate + privacy review. Held.
- **Post-time "best 3 windows" instead of single window** — show top-3 windows ranked. Engine returns 1 window per `OptimalPostWindow` shape; expansion needs engine schema change. Held.
- **A/B variant testing** — track which opening variants creators actually use + outcome → close the loop. Telemetry foundation (`script_section_copied` per-variant tag) covered in D-30; full outcome attribution = M2-II.

</deferred>

<scope_creep_caught>
None during this discussion. The phase boundary from ROADMAP.md (plans 6.1-6.6, R5 all + R6.2) was scoped tightly. The decisions above clarify HOW to implement what's already scoped, never WHETHER to add new capabilities. Deferred items above were not raised as "should we add this in Phase 6" — they're inherent extensions of the surface area that ROADMAP.md already pushes to M2-II.

</scope_creep_caught>

<code_context>
## Reusable Assets + Patterns Discovered

### Phase 5 wrappers ready for content swap (O-1)
- `src/components/board/actions/ActionsReshootHeroSlot.tsx` (738B) — keeps `data-testid="actions-reshoot-hero-slot"`, accepts `className` for grid spanning
- `src/components/board/actions/ActionsOptimalPostSlot.tsx` (319B) — keeps `data-testid="actions-optimal-post-placeholder"` (rename in Phase 6 to `actions-optimal-post-card`)

### Hooks ready to reuse
- `src/hooks/useCopyToClipboard.ts:25` — `useCopyToClipboard(): { copied, copy }`
- `src/hooks/queries/use-analysis-stream.ts` — `useAnalysisStream()` returns `{ phase, result, partial, stages, panelReady }`
- `src/hooks/usePrefersReducedMotion.ts` — `usePrefersReducedMotion(): boolean`

### Primitives ready to reuse
- `src/components/ui/sheet` — Sheet primitive (script Inspector + edit Sheet)
- `src/components/ui/GlassPill` (or wherever Phase 5 imports — researcher confirms path) — chip rendering
- `@phosphor-icons/react` — `Clock`, `FilmScript` already imported; add `Copy`, `CheckCircle`

### API route precedents (mirror line-by-line)
- `src/app/api/analyze/[id]/comparisons/route.ts` — GET pattern (D-01)
- `src/app/api/analyze/[id]/override/route.ts` — POST + JSONB write pattern (D-28)
- `src/lib/engine/cache/prediction-cache.ts` — L2 cache write-through pattern (D-08)

### Engine data ready to consume (no schema changes)
- `PredictionResult.counterfactuals.suggestions[]` — primary script source (D-03, D-04, D-06)
- `PredictionResult.factors[]` — secondary source (D-03 fallback, D-05 voiceover tips)
- `PredictionResult.reasoning` — primary voiceover body (D-05)
- `PredictionResult.optimal_post_window` — already populated (D-24, D-29)
- `PredictionResult.dropoff_segment_indices` — Phase 6 D-04 scene-order prioritization
- `PredictionResult.hook_decomposition.weakest_modality` — Phase 6 D-03 opening-line targeting

### Database (Phase 6 additions, both idempotent)
- `analysis_results.script_result JSONB` (NEW — D-09)
- `analysis_results.optimal_post_override JSONB` (NEW — D-28)

### Test fixtures available
- `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` — counterfactual suggestion fixtures across band × type × signal_anchor permutations. Reuse for Phase 6 endpoint tests.

</code_context>

---

**Next:** `/clear` then `/gsd-plan-phase 6` to generate executable plans 6.1-6.6 from these decisions.
