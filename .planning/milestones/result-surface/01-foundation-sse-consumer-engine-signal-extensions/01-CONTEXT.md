# Phase 1: Foundation — SSE consumer + engine signal extensions - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the result surface to the engine's existing SSE stream and add two new engine signals (`optimal_post_window`, emotion arc verification). Lock the SSE consumer contract, the stage→panel readiness mapping, the route shape for the result card, and the data source for the post-time signal. Calibrate the anti-virality confidence threshold against the training corpus. Ship the result page skeleton scaffold.

This is the **foundation** every subsequent phase (P2-P7) consumes — the hook signature, the panel-ready API, and the route structure get reused across the live viz, every result panel, the script generator, the share/export flow, and the mobile pass.

In scope: SSE consumer hook + new GET stream-by-id endpoint, panel-ready mapping module, `/analyze` + `/analyze/[id]` route scaffold, `optimal_post_window` aggregator extension + materialized `niche_post_windows` table, emotion arc verification (research + add if missing), anti-virality threshold calibration, skeleton placeholder panels.

Out of scope: actual panel implementations (P3, P4, P5), live persona hive viz (P2), share/export (P6), mobile-specific layouts (P7), the public `/r/<slug>` permalink route (P6).

</domain>

<decisions>
## Implementation Decisions

### SSE consumer hook
- **D-01:** Build a new dedicated hook `src/hooks/queries/use-analysis-stream.ts`. Keep existing `useAnalyze` (src/hooks/queries/use-analyze.ts) untouched for the dashboard's simple flow. Clean separation, no production risk.
- **D-02:** Hook returns `{ start, result, stages, partial, panelReady, phase, error, reconnect, analysisId }`. `start(input)` triggers POST. `panelReady` is the typed record panels read. `partial.personas[]` exposes per-persona streaming state for P2 hive. `stages[]` is raw event log for telemetry + dev debug overlay. `analysisId: string | null` exposes the server-issued id (from the `event: started` frame per pitfall #6) so callers can navigate to `/analyze/[id]`, key polling fallback queries, and seed P6 permalink replay. Additive in revision after plan-check iteration 1; no breaking change to original 8 keys.
- **D-03:** Reconnect policy: single reconnect using last event ID, then fall back to polling `/api/analysis/[id]` every 2s until terminal state. Simple and matches the engine's 60s SLA — exponential backoff is overkill at this duration.
- **D-04:** Add new `GET /api/analyze/[id]/stream` endpoint (EventSource-compatible). `POST /api/analyze` returns the analysis ID immediately; client then opens the GET stream. Enables reconnect-with-same-id, simpler client, reuses ID for polling fallback and future permalink replay. POST+body-reader path stays for backwards compat with `useAnalyze`.

### Stage → panel readiness mapping
- **D-05:** Expose `panelReady: Record<PanelId, 'idle' | 'loading' | 'ready' | 'error'>`. Panels stay dumb — each reads its own slot. The stage→panel mapping table lives in one place.
- **D-06:** Single source of truth: `src/lib/engine/panel-mapping.ts`. Co-located with `events.ts`. Hook builds `panelReady` from this. Panels in P3-P5 import the same constants for tests.
- **D-07:** Hook exposes three layers: `stages[]` (raw event log) + `partial` (in-flight per-wave data, e.g., `partial.personas[]`) + `result` (final `PredictionResult`). All three are needed: hive consumes `partial`, panels consume `result`, telemetry/debug consumes `stages`.
- **D-08:** Wave 3 per-persona shape: `partial.personas: Array<{ id, status: 'pending'|'streaming'|'complete', verdict?, reasoning? }>`. Order matches engine's persona array order. P2 hive subscribes here. P3 persona breakdown panels read `result.personas` once complete.

### Result page route
- **D-09:** New routes inside `(app)` group: `/analyze` (form page) and `/analyze/[id]` (result page). Both require auth via existing `(app)/layout.tsx` middleware. Public read-only permalink `/r/<slug>` is a separate concern owned by P6.
- **D-10:** Form moves to `/analyze`. Existing `ContentForm` component reused at the new route. `/dashboard` becomes history/overview only — no analyze form there. Submit on `/analyze` POSTs, navigates to `/analyze/[id]`.
- **D-11:** `/analyze/[id]/page.tsx` = server component shell that fetches the analysis record server-side (if exists). Renders client `<ResultCard initialData={...}>` which uses `useAnalysisStream` for live updates on fresh analyses. SSR enables fast first paint, OG metadata, and clean fallback for completed analyses.

### `optimal_post_window` signal
- **D-12:** Niche-only corpus median for P1. Schema is future-proofed for creator-aware override (M2-II). Creator history weighting deferred — quality unproven, needs outcome data still being collected.
- **D-13:** Output schema:
  ```ts
  optimal_post_window: {
    day_of_week: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
    hour_range: [number, number]; // 0-23, half-open
    timezone: 'UTC'; // normalized; UI converts to creator-local
    reasoning: string; // for panel one-liner copy
    source: 'niche' | 'creator' | 'fallback';
  }
  ```
- **D-14:** Source table: aggregate `competitor_videos` by niche tag. Materialize to a new `niche_post_windows` table via SQL VIEW or cron job for <50ms lookup. Live aggregation per analysis rejected (>200ms hit on 60s SLA budget).
- **D-15:** New helper `src/lib/engine/optimal-post.ts` exposing `computeOptimalPostWindow(niche, creator)`. Called in the aggregator's final stage. Non-fatal — failure returns `null` and the panel shows generic copy. No new LLM call.

### Claude's Discretion
- **Skeleton scaffold pattern (plan 1.6):** No explicit decision locked. Default to per-panel `<Skeleton when={panelReady[id] !== 'ready'}>` reading from the same `panel-mapping.ts` constants. If the planner finds a better pattern during research, free to revise.
- **Reconnect implementation details:** AbortController wiring, visibility-change pause/resume on mobile, last-event-id semantics — all planner discretion within the policy locked in D-03.
- **Anti-virality threshold calibration method (plan 1.5):** Approach not locked. Researcher to evaluate three options against existing calibration code: (a) sweep on training corpus to find the confidence cutoff where prediction error inverts, (b) ROC-style cutoff, (c) reuse Platt calibration output via `is_calibrated` metadata. Pick whichever yields a defensible cutoff with documented rationale.
- **Emotion arc verification (plan 1.3):** No fallback locked. Researcher verifies whether segmentation output already emits the data. If yes, surface it. If no, add a small engine extension as a non-fatal stage in the same wave as segmentation. Schema TBD by researcher.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + roadmap
- `.planning/MILESTONE.md` — Result Surface milestone scope, stack decisions locked, success criteria
- `.planning/ROADMAP.md` §Phase 1 — phase goal, plan list, success criteria, dependencies
- `.planning/REQUIREMENTS.md` §R1, §R2.1, §R6, §R7 — requirements traceability (R2.1, R6.1, R1.7, R1.9 covered by this phase)
- `.planning/PROJECT.md` §Key Decisions — locked architecture conventions (server-first, TanStack Query, Zustand, Canvas 2D, React.useId)

### Codebase intel
- `.planning/codebase/STACK.md` — Next.js 16, React 19, TanStack Query, Zustand, Recharts, Vitest stack
- `.planning/codebase/ARCHITECTURE.md` — route groups, data flow, prediction pipeline, Supabase client trio
- `.planning/codebase/INTEGRATIONS.md` — Supabase tables, Sentry, env vars, webhook contracts
- `.planning/codebase/STRUCTURE.md` — file-layout conventions for hooks/, components/, lib/engine/, app/

### Existing engine + hook surfaces (must read before modifying)
- `src/lib/engine/events.ts` — `StageEvent` discriminated union, `StageEventCallback` contract
- `src/lib/engine/pipeline.ts` — pipeline orchestration, `onStageEvent` wiring through waves 0-4
- `src/lib/engine/aggregator.ts` — final score aggregation, where `optimal_post_window` plugs in
- `src/lib/engine/types.ts` — `PredictionResult` schema (extend here for `optimal_post_window`)
- `src/app/api/analyze/route.ts` — current SSE response writer, POST+body-reader contract, cache-hit branch
- `src/hooks/queries/use-analyze.ts` — current hook (keep untouched, model new hook on its patterns)
- `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts` — server-side Supabase clients for the new GET endpoint
- `src/middleware.ts` + `src/lib/supabase/middleware.ts` — auth gating for new `(app)/analyze` routes

### Brand + design
- `BRAND-BIBLE.md` — Raycast design language reference (GlassPanel, 6% borders, 12px radius, coral #FF7F50)
- `CLAUDE.md` §Raycast Design Language Rules — verified token values, anti-patterns to avoid

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useAnalyze` hook (`src/hooks/queries/use-analyze.ts`) — proven POST+SSE body-reader pattern. Reuse the SSE line-parsing logic (lines 67-99) in the new hook; don't reinvent.
- `StageEvent` types (`src/lib/engine/events.ts`) — discriminated union already covers `stage_start` / `stage_end` per wave (0, 1, 2, 3, 4, "aggregator", "post"). Hook builds `panelReady` from these events.
- `ContentForm` component (`src/components/app/content-form.tsx`) — submit form. Reuse on new `/analyze` page.
- `GlassPanel` primitive — Raycast-styled container for every result panel (zero-config: 4 props).
- Recharts (already a dep) — for retention curve + emotion arc + comparative baseline panels in P3.
- TanStack Query — server state. Query keys factory at `src/lib/queries/query-keys.ts`.
- Supabase service client (`src/lib/supabase/service.ts`) — for the GET stream endpoint's cross-cutting reads.

### Established Patterns
- **Server components by default**, client only when interactive (`"use client"`). Result page = server shell + client ResultCard.
- **TanStack Query for server state**; Zustand for ephemeral client UI state. New hook fits the queries/ convention.
- **Three-layer auth**: middleware → server layout check → AuthGuard. New `(app)/analyze` routes inherit this for free.
- **Pipeline graceful degradation**: every non-critical stage try/catches with fallback values + warnings array. `optimal_post_window` follows this pattern — null on failure, never fatal.
- **Structured logger** (`src/lib/logger.ts`) — instrument new endpoints with `requestId`, `duration_ms`, `cost_cents` per NF4.

### Integration Points
- New route group: `src/app/(app)/analyze/page.tsx` + `src/app/(app)/analyze/[id]/page.tsx` + client `result-card.tsx`.
- New hook: `src/hooks/queries/use-analysis-stream.ts`.
- New engine module: `src/lib/engine/panel-mapping.ts` (panel IDs + stage→panel table) and `src/lib/engine/optimal-post.ts` (post-window helper).
- New API route: `src/app/api/analyze/[id]/stream/route.ts` (GET, EventSource-compatible).
- New Supabase migration: `niche_post_windows` materialized table (pre-aggregated from `competitor_videos`).
- Aggregator extension: add `optimal_post_window` to `PredictionResult` schema (`src/lib/engine/types.ts`) + call site in `src/lib/engine/aggregator.ts` final stage.

</code_context>

<specifics>
## Specific Ideas

- **No new design tokens** (NF3) — reuse Raycast scale already in BRAND-BIBLE.md.
- **Hook return shape mirrors POST+body-reader semantics** of the existing `useAnalyze` so the dashboard's existing pattern stays familiar to anyone reading both hooks.
- **`panel-mapping.ts` constants are the contract** between this phase and P2-P5; treat changes as breaking.
- **GET stream endpoint is the unlock** for permalink replay in P6 — design it now with that downstream consumer in mind (idempotent, supports `Last-Event-ID` header).
- **`niche_post_windows` materialization** should refresh on the existing `refresh-competitors` daily cron (no new cron needed).

</specifics>

<deferred>
## Deferred Ideas

- **Creator-aware `optimal_post_window` weighting** — defer to M2-II once outcome data accumulates. Schema is already future-proofed via the `source: 'creator'` enum value.
- **Calendar integration for post-time recommendation** — explicitly deferred per R6.2 ("No calendar integration in this milestone").
- **Migrating dashboard to the new richer hook** — keep both hooks for now. Revisit after P3-P5 ship to evaluate whether dashboard benefits from richer state.
- **Per-panel Suspense boundaries** (idiomatic React 19) — rejected in P1 for explicit `panelReady` state. Re-evaluate post-milestone if streaming + Suspense composition matures.
- **Live SQL post-window aggregation** — rejected for latency. If `niche_post_windows` becomes a hotspot, revisit with cached query layer.
- **Multi-window ranked recommendations** (`Array<{ day, hour_range, score }>`) — rejected for single-window R6.2 spec. Revisit if M2-III adds a posting-schedule planner.
- **Notion-importable script export** (R5.2) — flagged for M2-II per requirement.

</deferred>

---

*Phase: 1-Foundation-SSE-consumer-engine-signal-extensions*
*Context gathered: 2026-05-24*
