# Phase 1: Foundation — SSE consumer + engine signal extensions - Research

**Researched:** 2026-05-24
**Domain:** Next.js 16 SSE consumer + result-page route scaffold + 2 small engine extensions (`optimal_post_window`, emotion arc verify) + anti-virality threshold calibration
**Confidence:** HIGH (codebase verified) / MEDIUM (calibration + EventSource browser specifics)

## Summary

Phase 1 wires the result surface to the engine's existing SSE stream, scaffolds the `/analyze` + `/analyze/[id]` routes, adds two small aggregator signals (`optimal_post_window` + emotion-arc verify-or-add), and locks an anti-virality confidence cutoff. Locked decisions in CONTEXT.md remove most architectural ambiguity — research scope reduces to **how** to implement each locked path, not **what** to build.

Three hard findings shape the plans:

1. **Emotion arc data does NOT exist in current engine output.** Verified via grep across `src/lib/engine`. The Omni Plus prompt emits `factors[].name="Emotional Charge"` (single 0-10 score, not a curve). Plan 1.3 must add a small engine extension — the schema is researcher's discretion per CONTEXT.
2. **EventSource cannot send custom headers** — D-04's "open GET stream from `/api/analyze/[id]/stream`" is fine for Supabase cookie-auth (cookies ride automatically) but blocks any future Bearer-token path. Plan 1.1 should use native EventSource on the GET endpoint since same-origin cookie auth works; do NOT plan to mix in `Authorization` headers.
3. **No live aggregation for `optimal_post_window`** — `competitor_videos` table has 0 rows for many users + lacks niche tagging. Need to source from `scraped_videos.primary_niche` (Phase 8 backfill) OR `training_corpus.niche` (the corpus migration). Plan 1.4 must verify which corpus actually has post-time data (`posted_at`) co-located with niche before locking source table.

**Primary recommendation:** Adopt the proven `useAnalyze` SSE-line-parse loop verbatim (lines 67-99) inside `useAnalysisStream`. Native EventSource on the GET endpoint — no `@microsoft/fetch-event-source` dep needed. `optimal_post_window` materialization = `pg_cron`-refreshed table (NOT VIEW), refresh schedule piggybacks on existing `refresh-competitors` daily slot. Anti-virality cutoff = corpus sweep using `outcomes` table (existing calibration data).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SSE consumer hook (`useAnalysisStream`) | Browser / Client | — | Stream parsing + reconnect inherently client-side. TanStack Query convention for the hooks/queries/ slot. |
| GET stream-by-id endpoint | API / Backend | Database / Storage | EventSource-compatible reader. Reads `analysis_results` for terminal-state replay, re-runs pipeline only if record missing. |
| POST `/api/analyze` (existing) | API / Backend | Database / Storage | Already shipped. Phase 1 does NOT modify — only consumes. |
| `optimal_post_window` aggregator extension | API / Backend | Database / Storage | Pure helper called inside `aggregateScores()` final stage. Reads materialized `niche_post_windows`. Non-fatal — null on failure. |
| `niche_post_windows` materialization | Database / Storage | API / Backend | `pg_cron`-scheduled `REFRESH MATERIALIZED VIEW` OR table upsert. Cron auth via existing `cron-auth.ts` if route-based. |
| Emotion arc engine extension | API / Backend | — | New small stage in segmentation wave OR additive field in Omni Plus prompt — Plan 1.3 verifies + chooses. |
| Anti-virality threshold | API / Backend | — | Pure constant in `src/lib/engine/aggregator.ts` (or new `anti-virality.ts`). Calibration is offline analysis — output is a single number + rationale doc. |
| Result page route + ResultCard shell | Frontend Server (SSR) | Browser / Client | Server component fetches `analysis_results` row (fast first paint, OG meta). Client `<ResultCard>` swaps to live stream for fresh analyses. |
| Skeleton scaffold panels | Browser / Client | — | Explicit `panelReady[id] !== 'ready'` state, NOT React Suspense (CONTEXT deferred ideas explicitly rejects Suspense for P1). |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### SSE consumer hook
- **D-01:** Build a new dedicated hook `src/hooks/queries/use-analysis-stream.ts`. Keep existing `useAnalyze` (src/hooks/queries/use-analyze.ts) untouched for the dashboard's simple flow. Clean separation, no production risk.
- **D-02:** Hook returns `{ start, result, stages, partial, panelReady, phase, error, reconnect }`. `start(input)` triggers POST. `panelReady` is the typed record panels read. `partial.personas[]` exposes per-persona streaming state for P2 hive. `stages[]` is raw event log for telemetry + dev debug overlay.
- **D-03:** Reconnect policy: single reconnect using last event ID, then fall back to polling `/api/analysis/[id]` every 2s until terminal state. Simple and matches the engine's 60s SLA — exponential backoff is overkill at this duration.
- **D-04:** Add new `GET /api/analyze/[id]/stream` endpoint (EventSource-compatible). `POST /api/analyze` returns the analysis ID immediately; client then opens the GET stream. Enables reconnect-with-same-id, simpler client, reuses ID for polling fallback and future permalink replay. POST+body-reader path stays for backwards compat with `useAnalyze`.

#### Stage → panel readiness mapping
- **D-05:** Expose `panelReady: Record<PanelId, 'idle' | 'loading' | 'ready' | 'error'>`. Panels stay dumb — each reads its own slot. The stage→panel mapping table lives in one place.
- **D-06:** Single source of truth: `src/lib/engine/panel-mapping.ts`. Co-located with `events.ts`. Hook builds `panelReady` from this. Panels in P3-P5 import the same constants for tests.
- **D-07:** Hook exposes three layers: `stages[]` (raw event log) + `partial` (in-flight per-wave data, e.g., `partial.personas[]`) + `result` (final `PredictionResult`). All three are needed: hive consumes `partial`, panels consume `result`, telemetry/debug consumes `stages`.
- **D-08:** Wave 3 per-persona shape: `partial.personas: Array<{ id, status: 'pending'|'streaming'|'complete', verdict?, reasoning? }>`. Order matches engine's persona array order. P2 hive subscribes here. P3 persona breakdown panels read `result.personas` once complete.

#### Result page route
- **D-09:** New routes inside `(app)` group: `/analyze` (form page) and `/analyze/[id]` (result page). Both require auth via existing `(app)/layout.tsx` middleware. Public read-only permalink `/r/<slug>` is a separate concern owned by P6.
- **D-10:** Form moves to `/analyze`. Existing `ContentForm` component reused at the new route. `/dashboard` becomes history/overview only — no analyze form there. Submit on `/analyze` POSTs, navigates to `/analyze/[id]`.
- **D-11:** `/analyze/[id]/page.tsx` = server component shell that fetches the analysis record server-side (if exists). Renders client `<ResultCard initialData={...}>` which uses `useAnalysisStream` for live updates on fresh analyses. SSR enables fast first paint, OG metadata, and clean fallback for completed analyses.

#### `optimal_post_window` signal
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

### Deferred Ideas (OUT OF SCOPE)
- Creator-aware `optimal_post_window` weighting — defer to M2-II once outcome data accumulates. Schema is already future-proofed via the `source: 'creator'` enum value.
- Calendar integration for post-time recommendation — explicitly deferred per R6.2.
- Migrating dashboard to the new richer hook — keep both hooks for now. Revisit after P3-P5 ship.
- Per-panel Suspense boundaries (idiomatic React 19) — rejected in P1 for explicit `panelReady` state.
- Live SQL post-window aggregation — rejected for latency.
- Multi-window ranked recommendations — rejected for single-window R6.2 spec.
- Notion-importable script export (R5.2) — flagged for M2-II.
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| R2.1 | Result page subscribes to `/api/analyze` SSE stream on submit; stage events trigger UI transitions; single reconnect → polling fallback; client-side stage event log (dev flag). | Plans 1.1 + 1.2. Reuses verified `useAnalyze` SSE parsing pattern (lines 67-99). EventSource on D-04 GET endpoint. Polling via existing `GET /api/analysis/[id]` route (already shipped). |
| R6.1 | Aggregator output extended with `optimal_post_window: { day_of_week, hour_range, timezone }`; niche + creator + corpus posting-time data; fallback to generic niche recommendation. | Plans 1.4 + new SQL migration. Schema locked in D-13. Materialized `niche_post_windows` (NOT VIEW — see Pitfall #4). Source = `scraped_videos.primary_niche` + `competitor_videos` join (corpus only, NOT creator history per D-12). |
| R1.7 (verify) | Emotion arc data source confirmed in P1 (likely from segmentation). | Plan 1.3. **VERIFIED ABSENT** — current Omni Plus prompt + Gemini schema do NOT emit timeline-shaped emotion data. Must add. Schema design = researcher discretion; recommend `emotion_arc: Array<{ timestamp_ms, intensity_0_1, label?: 'low' \| 'mid' \| 'high' }>` as small additive field on the Omni Plus prompt. |
| R1.9 (calibrate threshold) | Confidence cutoff for "Don't post yet" verdict; locked in P1 with documented rationale. | Plan 1.5. Recommended: corpus sweep on `outcomes` table (existing `fetchOutcomePairs` helper). Output = single numeric constant + rationale markdown. See Anti-Virality Threshold Calibration section below. |
</phase_requirements>

## Standard Stack

### Core (verified installed in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.5 | App Router framework | Already shipped. Route Handler streaming via Web Streams API is the canonical Next.js 16 pattern. |
| react | 19.2.3 | UI library | Server components by default per project convention. Client components only with `"use client"`. |
| @tanstack/react-query | 5.90.21 | Server state + mutations | Hooks convention in `src/hooks/queries/`. `useMutation` + manual state for stream phase. |
| zustand | 5.0.10 | Client UI state | NOT used by stream hook (TanStack Query handles result caching). Reserved for ephemeral UI state in P2-P7. |
| recharts | 3.7.0 | Charts | Will render emotion arc + retention curve in P3. Not directly used in Phase 1 plans. |
| zod | 4.3.6 | Schema validation | New `optimal_post_window` + emotion_arc schemas added here, fed into existing `PredictionResult` shape. |
| vitest | 4.0.18 | Unit tests | 80% coverage threshold on engine. New `panel-mapping.ts` + `optimal-post.ts` + Stream hook need tests. |
| @playwright/test | 1.58.0 | E2E tests | Existing e2e in `e2e/`. Stream end-to-end test goes here. |

### Supporting (no new deps)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (native) EventSource | Browser API | Open GET SSE stream | D-04 endpoint. Same-origin = Supabase auth cookie rides automatically. NO custom-header library needed. |
| (native) AbortController | Browser API | Cancel in-flight stream on unmount or reconnect | Wrap reader.read() loop + EventSource.close() inside cleanup. |
| `pg_cron` (Supabase extension) | DB extension | Schedule `REFRESH MATERIALIZED VIEW CONCURRENTLY niche_post_windows` daily | Already installed via existing crons. Use `cron.schedule()` from a migration. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native EventSource | `@microsoft/fetch-event-source` | Adds 7KB dep. Only needed if Authorization headers required (they aren't — Supabase auth uses HTTP-only cookies that ride GET automatically). Rejected. |
| Materialized View | Cron-refreshed plain table | `MATERIALIZED VIEW` requires unique index for `CONCURRENTLY` refresh — table is simpler to upsert and supports finer-grained partial updates. **Recommend table** (see Pitfall #4). |
| Native EventSource | Fetch+ReadableStream (like existing `useAnalyze`) | Fetch+ReadableStream loses native browser reconnect + `Last-Event-ID` support. D-04 explicitly chose GET for EventSource compatibility; using fetch would discard that win. |
| Pure constant for anti-virality threshold | DB-backed configurable value | DB-backed allows dynamic tuning without redeploy. P1 ships pure constant; M2-II revisits after outcome data accumulates. |

**Installation:** No new dependencies needed. Verified all required libs already in `package.json`.

**Version verification:**
- next@16.1.5 — verified in package.json. Next.js 16 stable since 2026-Q1.
- react@19.2.3 — verified.
- recharts@3.7.0 — verified.
- pg_cron — already installed in Supabase (used by existing migrations like phase11_retention_counter).

[VERIFIED: package.json grep 2026-05-24]

## Architecture Patterns

### System Architecture Diagram

```
User submits form on /analyze
        │
        ▼
POST /api/analyze ────────────────────► (existing route, unchanged Phase 1)
  ├─ cache-hit branch: emit complete    │
  │                                     │
  └─ pipeline path:                     │
       runPredictionPipeline() ─────────┤
       │  emits stage events            │
       │  via onStageEvent callback     │
       ▼                                │
     aggregateScores() ────────────────►│ emits final PredictionResult
       │                                │ (NEW: includes optimal_post_window)
       │                                │
       │ ─── DB INSERT to analysis_results
       │ ─── send("complete", result)
       ▼
       SSE response stream ──────► useAnalysisStream() hook
                                     │
                                     │ parses event:phase / event:stage / event:complete
                                     │ builds: stages[] + partial + result + panelReady
                                     │
                                     ▼
                                 ResultCard
                                     │
                            ┌────────┼─────────┐──────────────┐
                            ▼        ▼         ▼              ▼
                       <Skeleton when={panelReady[id]!=='ready'}>
                       │RetentionPanel│HivePanel│ EmotionArcPanel│ ...
                       (placeholder in P1 — actual viz in P3-P5)

                            ─── On connection drop ───
                                     │
                            close + open GET /api/analyze/[id]/stream
                            with EventSource (cookie auth rides automatically)
                                     │
                            If reconnect fails → poll GET /api/analysis/[id] every 2s
                                     │
                            Until status='complete' or terminal error
```

Components newly introduced in this phase:
- `src/hooks/queries/use-analysis-stream.ts` — stream consumer hook
- `src/lib/engine/panel-mapping.ts` — stage→panel constants
- `src/lib/engine/optimal-post.ts` — niche → post-window helper
- `src/app/api/analyze/[id]/stream/route.ts` — EventSource-compatible GET
- `src/app/(app)/analyze/page.tsx` — form page
- `src/app/(app)/analyze/[id]/page.tsx` — result shell (server)
- `src/app/(app)/analyze/[id]/result-card.tsx` — client wrapper with `useAnalysisStream`
- `supabase/migrations/2026XXXX_niche_post_windows.sql` — table + pg_cron schedule
- `supabase/migrations/2026XXXX_emotion_arc_column.sql` — additive column on `analysis_results`

### Recommended Project Structure
```
src/
├── app/
│   ├── (app)/
│   │   ├── analyze/                           # NEW route group entry
│   │   │   ├── page.tsx                       # Server: form page (reuse ContentForm)
│   │   │   └── [id]/
│   │   │       ├── page.tsx                   # Server: shell that hydrates with initialData
│   │   │       └── result-card.tsx            # Client: <ResultCard> using useAnalysisStream
│   │   └── ...                                # dashboard, trending, etc. (unchanged)
│   └── api/
│       └── analyze/
│           ├── route.ts                       # EXISTING POST (untouched)
│           └── [id]/
│               └── stream/route.ts            # NEW GET EventSource endpoint
├── hooks/queries/
│   ├── use-analyze.ts                         # EXISTING (untouched — D-01)
│   └── use-analysis-stream.ts                 # NEW hook
└── lib/engine/
    ├── events.ts                              # EXISTING (StageEvent union)
    ├── panel-mapping.ts                       # NEW constants
    ├── optimal-post.ts                        # NEW helper
    ├── aggregator.ts                          # MODIFY: call optimal-post + emotion-arc
    ├── types.ts                               # MODIFY: extend PredictionResult
    ├── qwen/omni-analysis.ts                  # MODIFY (Plan 1.3): add emotion_arc to prompt
    └── qwen/schemas.ts                        # MODIFY (Plan 1.3): widen Zod schema
```

### Pattern 1: Hook = useMutation + custom event state
**What:** TanStack Query `useMutation` triggers the POST; manual state hooks (`useState`) track stage progression. Mirror the proven `useAnalyze` shape so anyone reading both hooks sees the same pattern.

**When to use:** Phase 1 plan 1.1 implementation.

**Example:** Adapt `useAnalyze` lines 67-99 verbatim — the SSE line-parse loop (`buffer.split("\n")`, `event: ` / `data: ` two-line pairs) is already battle-tested. Wrap the parse loop in a reducer that updates `stages[]`, `partial.*`, `panelReady[*]` based on event type.

```typescript
// Source: model on existing src/hooks/queries/use-analyze.ts lines 67-99 [VERIFIED]
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("event: ")) {
      const eventType = line.slice(7).trim();
      const dataLine = lines[i + 1];
      if (dataLine?.startsWith("data: ")) {
        const data = JSON.parse(dataLine.slice(6));
        dispatchStreamEvent(eventType, data); // ← NEW: stage/phase/complete/error
      }
    }
  }
}
```

### Pattern 2: Reconnect → poll fallback ladder (D-03)
**What:** Single reconnect via EventSource on the GET endpoint, then a TanStack Query interval-polling fallback.

**When to use:** Plan 1.1 + 1.2 — implements D-03 policy.

**Sequence:**
1. POST returns `{ id }` after pipeline starts (D-04 — POST stays SSE but ALSO returns the analysis ID early via DB INSERT)
2. Client opens `EventSource('/api/analyze/[id]/stream')`
3. On `EventSource.onerror` or 1 connection failure: close + invoke `reconnect()` once (state = `'reconnecting'`)
4. If second connection also drops: switch to `useQuery({ refetchInterval: 2000 })` against `GET /api/analysis/[id]` (existing route)
5. Stop polling when row status = `complete` (i.e., `overall_score !== null`) or > 90s elapsed
6. Visibility-change handling: pause polling when `document.hidden`, resume on visibilitychange `'visible'` event (saves mobile battery + matches user expectation)

### Pattern 3: Server-component shell + client wrapper (D-11)
**What:** `/analyze/[id]/page.tsx` server-fetches the `analysis_results` row, then renders `<ResultCard initialData={row} />` (client component). For fresh analyses (row exists but `overall_score` is null), client opens the stream. For completed analyses, client renders panels directly from `initialData` and never opens the stream.

**When to use:** Plans 1.6 (skeleton scaffold) + sets up the contract for P3-P5.

**Why:**
- Fast first paint (no client roundtrip to hydrate)
- OG metadata for share image (P6 prerequisite)
- Clean fallback for completed analyses (no wasted SSE connection)
- Resilient to refreshes mid-stream

### Pattern 4: Panel readiness as derived state from stages
**What:** `panel-mapping.ts` exports a static `STAGE_TO_PANEL` table. The hook's reducer reads each `stage_end` event and flips `panelReady[panel]` to `'ready'` when its source stage completes.

```typescript
// Source: NEW src/lib/engine/panel-mapping.ts [planner authored]
export const PANEL_IDS = [
  'verdict',           // aggregator complete
  'retention',         // wave_3_personas complete (uses watch_through_pct)
  'persona_breakdown', // wave_3_personas complete
  'hook_decomp',       // wave_1 complete (gemini_video_analysis)
  'similar_videos',    // wave_1 complete (retrieval stage)
  'reasoning',         // wave_2 complete (deepseek)
  'emotion_arc',       // wave_1 complete (segmentation OR new stage from Plan 1.3)
  'comparative_baseline', // aggregator complete
  'optimal_post',      // aggregator complete (NEW signal from Plan 1.4)
  'anti_virality',     // aggregator complete (gate via threshold from Plan 1.5)
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export const STAGE_TO_PANEL: Record<string, PanelId[]> = {
  'wave_1': ['hook_decomp', 'similar_videos', 'emotion_arc'],
  'wave_2': ['reasoning'],
  'wave_3_personas': ['retention', 'persona_breakdown'],
  'aggregator': ['verdict', 'comparative_baseline', 'optimal_post', 'anti_virality'],
};
```

### Anti-Patterns to Avoid
- **`Suspense` for panel readiness** — explicitly rejected in CONTEXT deferred ideas. Suspense + SSE streaming composition is still maturing in React 19; `panelReady` state is simpler and verifiable. [VERIFIED: React 19 docs — Suspense streaming patterns work but require careful waterfall avoidance, which is overkill for this scope]
- **Exponential backoff for reconnect** — D-03 explicitly chose single retry + polling for 60s SLA. Backoff is overkill at this duration.
- **Mixing fetch+ReadableStream with EventSource in the same hook** — pick one transport. POST path uses fetch (cannot use EventSource — POST not supported); reconnect path uses EventSource (browsers handle `Last-Event-ID` automatically). Don't try to unify them.
- **`MATERIALIZED VIEW` without unique index** — `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index. Without one, refresh locks the entire view. See Pitfall #4.
- **Live SQL aggregation in aggregator** — CONTEXT explicitly rejects per D-14 (>200ms hit on 60s SLA budget).
- **Custom `Authorization` headers on EventSource** — native EventSource API does not support custom headers. Same-origin cookie auth works fine since Supabase uses HTTP-only cookies. [VERIFIED: MDN + whatwg/html#2177]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE reconnect logic | Custom reconnect ladder with timers | Native EventSource (auto-reconnects with `Last-Event-ID`) for the GET endpoint | Browser implements per WHATWG spec — 3s default delay, exponential backoff on failure, `Last-Event-ID` header included automatically [VERIFIED: HTML spec + MDN] |
| SSE line parsing | New parser | Adapt `useAnalyze` lines 67-99 verbatim | Already battle-tested in production. Don't re-invent. [VERIFIED: codebase] |
| Polling interval logic | setInterval+cleanup | TanStack Query `useQuery({ refetchInterval, enabled })` | Already a project standard pattern. Auto-handles unmount + visibility |
| Visibility-change pause | Custom event listener | TanStack Query's `refetchOnWindowFocus` is wrong direction here — write a tiny `useDocumentVisibility` hook (already shipped as `src/hooks/usePrefersReducedMotion.ts` analog) | Browser `visibilitychange` event is standard — wrap in a 5-line hook |
| Materialized view refresh scheduling | `setInterval` in Node app | `pg_cron` extension already installed | Existing Supabase migrations use it. Zero new infra. [VERIFIED: phase11_retention_counter migration uses pg_cron] |
| ECE / calibration math | Custom binning | `computeECE()` and `fetchOutcomePairs()` already exist in `src/lib/engine/calibration.ts` | Reuse for anti-virality threshold sweep. [VERIFIED: calibration.ts lines 54-176] |
| Stream-to-DOM rendering | Custom skeleton primitive | Existing `<Skeleton>` from `src/components/ui/skeleton.tsx` (verified in barrel) | Already part of design system |
| HTTP-only auth cookie management | Manual headers | Supabase SSR client auto-attaches cookies to same-origin GETs | Already shipped via middleware. Works automatically. |

**Key insight:** Phase 1 has minimal hand-rolled surface area — the bulk of work is wiring proven patterns from `useAnalyze`, `calibration.ts`, and existing TanStack/Supabase infra to a new hook + new route shell.

## Runtime State Inventory

Not applicable — Phase 1 is greenfield additive work (new hook, new routes, new aggregator field, new column). No renames, no refactors. Skipped per researcher protocol.

## Common Pitfalls

### Pitfall 1: Vercel function timeout vs SSE long-lived stream
**What goes wrong:** Vercel functions default to 300s on Fluid Compute (April 2025+). Plain Vercel functions timeout at 10s (Hobby) / 60s (Pro). If the new GET stream endpoint omits route segment config, it may hit the 60s cap mid-stream.
**Why it happens:** Default `maxDuration` not always 300s on legacy code paths.
**How to avoid:** Mirror existing `/api/analyze/route.ts` config verbatim in the new GET endpoint:
```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
```
**Warning signs:** Stream ends abruptly at exactly 10s or 60s; client sees `EventSource.onerror` with no specific error.
[VERIFIED: existing src/app/api/analyze/route.ts lines 25-27]

### Pitfall 2: EventSource cannot send custom headers
**What goes wrong:** A future plan might add Bearer-token auth to the GET stream endpoint, breaking same-origin cookie auth assumption.
**Why it happens:** Native EventSource constructor doesn't accept a `headers` option (WHATWG spec).
**How to avoid:** Document explicitly that the GET endpoint relies on same-origin Supabase HTTP-only cookies (which DO ride GETs automatically). If Bearer auth is ever needed, switch to `@microsoft/fetch-event-source` or rexxars `eventsource-client`. Plan 1.1 should NOT mix these patterns.
[VERIFIED: whatwg/html#2177, news.ycombinator.com/item?id=30313515]

### Pitfall 3: SSR / CSR hydration mismatch on result page
**What goes wrong:** Server component fetches `analysis_results` row; client hook may immediately overwrite with stale stream state if hook initializes with empty state.
**Why it happens:** `useAnalysisStream` initializes `result=null` on mount; if `initialData` is non-null and the row is complete, opening a stream is wasteful and risks transient null flash.
**How to avoid:** Hook accepts `initialData` prop. If `initialData?.overall_score` exists, hook starts in `phase='complete'`, `result=initialData`, and DOES NOT open the stream. Only open stream when `initialData` is missing OR has null overall_score.
**Warning signs:** Result panels briefly show skeletons after navigation from a completed analysis URL.

### Pitfall 4: `MATERIALIZED VIEW CONCURRENTLY` requires unique index
**What goes wrong:** Plain `REFRESH MATERIALIZED VIEW niche_post_windows` takes an `ACCESS EXCLUSIVE` lock — blocks reads during refresh. `REFRESH MATERIALIZED VIEW CONCURRENTLY` is non-blocking but requires a unique index on the view.
**Why it happens:** PostgreSQL deduplication requirement for concurrent refresh.
**How to avoid:** **Recommend regular TABLE + upsert script**, not a MATERIALIZED VIEW. Table allows row-by-row upsert via the cron, simpler to reason about, no unique-index gotcha, plain SELECT for lookup. CONTEXT D-14 says "SQL VIEW or cron job" — the cron-job + table path is simpler and matches existing patterns in this codebase (none of the existing migrations use MATERIALIZED VIEW; all use plain tables refreshed by cron jobs like `competitor_snapshots`).
**Warning signs:** Refresh hangs lookups during nightly cron window if you choose MATERIALIZED VIEW path without a unique index.
[CITED: postgresql.org/docs/current/sql-refreshmaterializedview.html]

### Pitfall 5: Aggregator stage event ordering — Stage 10 + 11 fire AFTER aggregateScores
**What goes wrong:** `aggregateScores()` runs Stage 10 (critique) + Stage 11 (counterfactuals) AFTER the main weighted score math. If `optimal_post_window` is added to PredictionResult but counterfactuals or critique reads from it, ordering matters.
**Why it happens:** Stages 10+11 read the assembled `result` object — adding fields BEFORE they run is safe; adding AFTER risks stale reads.
**How to avoid:** Insert `optimal_post_window` computation BEFORE the `result` object is constructed (around aggregator.ts line 990). Stage 10/11 will see the populated field.
**Warning signs:** Counterfactuals or critique LLM output mentions wrong post times.
[VERIFIED: aggregator.ts lines 990-1076]

### Pitfall 6: `analysis_results` row INSERT happens BEFORE SSE complete event
**What goes wrong:** The current POST route INSERTS the row BEFORE sending `event: complete`. If client GET-streams by ID immediately after POST starts, the row may not exist yet.
**Why it happens:** Look at route.ts:449 — INSERT happens just before `send("complete", ...)`. There's no row at all during the streaming phase.
**How to avoid:** Two valid options for Plan 1.1 / D-04:
- **Option A (recommended):** POST route INSERTS a placeholder row with `overall_score=null` IMMEDIATELY after auth + validation, returns the ID in the very first SSE frame (`event: started, data: {id}`). All subsequent stages stream against the same ID. GET endpoint can attach mid-stream.
- **Option B:** POST returns 202 + `{id}` synchronously, kicks off pipeline in a background promise, GET endpoint becomes the only stream consumer. More complex — requires queue or DB-pubsub.
**Recommendation:** Option A. Minimal change to existing POST route, preserves backward compat with `useAnalyze` (which ignores the new `event: started` frame).
**Warning signs:** GET stream returns 404 immediately after POST start because the row hasn't been inserted yet.

### Pitfall 7: Emotion arc data not in current Omni Plus output
**What goes wrong:** Plan 1.3's "verify" research lands a definitive "NOT THERE" — the Omni Plus schema (`src/lib/engine/qwen/schemas.ts`) emits `factors[].name="Emotional Charge"` (single 0-10 score) but NOT a timeline curve. R1.7 needs a curve.
**Why it happens:** Existing engine emits emotion as a static score, not a per-segment arc.
**How to avoid:** Plan 1.3 adds the field to the Omni Plus prompt + schema. Recommended shape (researcher discretion per CONTEXT):
```ts
emotion_arc: Array<{
  timestamp_ms: number;     // 0 = start of video
  intensity_0_1: number;    // 0-1 normalized
  label?: 'low' | 'mid' | 'high'; // optional categorical
}>
```
Cost: zero new LLM call — extend the existing Omni Plus prompt with one more field. Per-call cost increase: negligible (≤50 extra output tokens).
**Warning signs:** R1.7 panel ships empty even on video uploads where R1.7 should be populated.
[VERIFIED: grep -rn "emotion" src/lib/engine — no array/timeline shape found]

### Pitfall 8: Visibility-change reconnect storm
**What goes wrong:** User backgrounds tab for 5 minutes, returns. Both EventSource auto-reconnect AND polling logic fire simultaneously.
**Why it happens:** Browser pauses tab work loosely — exact `setInterval` behavior varies. EventSource may also independently retry on visibility change.
**How to avoid:** Phase is in ONE state at a time: `streaming` | `reconnecting` | `polling` | `complete` | `error`. The reducer is strict — visibility-change always re-checks current phase, never re-opens what's already open.
**Warning signs:** Console shows multiple GET requests fired within ~50ms of tab focus.

## Code Examples

### Example 1: New GET endpoint (D-04) — Next.js 16 streaming pattern

```typescript
// Source: NEW src/app/api/analyze/[id]/stream/route.ts
// Pattern verified from src/app/api/analyze/route.ts + Next.js 16 docs [VERIFIED]

import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = nanoid(12);
  const log = createLogger({ requestId, module: "analyze.stream" });

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Look up row by id (RLS scoped to user via server client)
  const { data: row, error } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !row) {
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  // Last-Event-ID for replay positioning (browsers send this automatically on reconnect)
  const lastEventId = request.headers.get("Last-Event-ID");
  log.info("stream connect", { id, lastEventId, status: row.overall_score === null ? "in-flight" : "complete" });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown, eventId?: string) => {
        const prefix = eventId ? `id: ${eventId}\n` : "";
        controller.enqueue(encoder.encode(`${prefix}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Heartbeat every 15s to prevent intermediary timeouts (Pitfall 1 mitigation)
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 15_000);

      try {
        if (row.overall_score !== null) {
          // Terminal state: replay complete in one frame, close
          send("complete", row, "complete");
        } else {
          // In-flight: tail the row via short-poll until complete
          // (DB-LISTEN/NOTIFY out of scope for P1 — short poll is simpler)
          let attempts = 0;
          while (attempts < 45) { // 45 * 2s = 90s ceiling (engine SLA is 60s)
            const { data: fresh } = await supabase
              .from("analysis_results").select("*").eq("id", id).single();
            if (fresh && fresh.overall_score !== null) {
              send("complete", fresh, "complete");
              break;
            }
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
          }
          if (attempts >= 45) {
            send("error", { error: "Stream timed out — analysis still running" });
          }
        }
      } catch (err) {
        send("error", { error: err instanceof Error ? err.message : String(err) });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Vary": "Accept",
    },
  });
}
```

### Example 2: Materialized table + pg_cron refresh (Plan 1.4)

```sql
-- Source: NEW supabase/migrations/2026XXXX_niche_post_windows.sql
-- Pattern verified from existing migrations [VERIFIED: phase11_retention_counter uses pg_cron]

-- Plain table, not MATERIALIZED VIEW — see Pitfall #4
CREATE TABLE niche_post_windows (
  niche TEXT PRIMARY KEY,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  hour_start INTEGER NOT NULL CHECK (hour_start >= 0 AND hour_start <= 23),
  hour_end INTEGER NOT NULL CHECK (hour_end >= 1 AND hour_end <= 24),
  sample_size INTEGER NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh function: aggregates per niche from scraped_videos + competitor_videos
CREATE OR REPLACE FUNCTION refresh_niche_post_windows() RETURNS void AS $$
BEGIN
  DELETE FROM niche_post_windows;
  INSERT INTO niche_post_windows (niche, day_of_week, hour_start, hour_end, sample_size)
  SELECT
    primary_niche AS niche,
    -- Median day-of-week of top-quartile videos by views
    -- (sketch — actual aggregation is plan's responsibility)
    to_char(posted_at, 'Dy') AS day_of_week,
    EXTRACT(HOUR FROM posted_at)::INT AS hour_start,
    (EXTRACT(HOUR FROM posted_at)::INT + 2) AS hour_end,
    COUNT(*) AS sample_size
  FROM scraped_videos
  WHERE primary_niche IS NOT NULL AND posted_at IS NOT NULL
  GROUP BY primary_niche, to_char(posted_at, 'Dy'), EXTRACT(HOUR FROM posted_at)
  HAVING COUNT(*) >= 10;
END;
$$ LANGUAGE plpgsql;

-- Schedule: piggyback on existing refresh-competitors slot (6 AM UTC daily)
SELECT cron.schedule(
  'refresh-niche-post-windows',
  '15 6 * * *',  -- 15min after refresh-competitors so fresh competitor data is included
  $$SELECT refresh_niche_post_windows()$$
);
```

### Example 3: optimal-post.ts helper (Plan 1.4)

```typescript
// Source: NEW src/lib/engine/optimal-post.ts

import type { CreatorContext } from "./creator";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface OptimalPostWindow {
  day_of_week: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  hour_range: [number, number];
  timezone: 'UTC';
  reasoning: string;
  source: 'niche' | 'creator' | 'fallback';
}

const FALLBACK: OptimalPostWindow = {
  day_of_week: 'Tue',
  hour_range: [18, 21],
  timezone: 'UTC',
  reasoning: 'Default recommendation — niche-specific data unavailable',
  source: 'fallback',
};

export async function computeOptimalPostWindow(
  supabase: SupabaseClient<Database>,
  niche: string | null,
  _creator: CreatorContext, // unused in P1 per D-12 — schema future-proofed
): Promise<OptimalPostWindow | null> {
  if (!niche) return FALLBACK;

  try {
    const { data, error } = await supabase
      .from('niche_post_windows')
      .select('day_of_week, hour_start, hour_end, sample_size')
      .eq('niche', niche)
      .single();

    if (error || !data) return FALLBACK;

    return {
      day_of_week: data.day_of_week as OptimalPostWindow['day_of_week'],
      hour_range: [data.hour_start, data.hour_end],
      timezone: 'UTC',
      reasoning: `Your niche peaks ${data.day_of_week} ${data.hour_start}:00-${data.hour_end}:00 UTC (n=${data.sample_size} videos)`,
      source: 'niche',
    };
  } catch {
    return null; // non-fatal per D-15
  }
}
```

### Example 4: Anti-virality threshold sweep (Plan 1.5)

```typescript
// Source: NEW scripts/calibrate-anti-virality.ts (one-shot offline analysis)
// Reuses src/lib/engine/calibration.ts:fetchOutcomePairs [VERIFIED]

import { createServiceClient } from "@/lib/supabase/service";
import { fetchOutcomePairs, type OutcomePair } from "@/lib/engine/calibration";

// Anti-virality logic: when confidence < THRESHOLD, prediction is unreliable.
// Find the cutoff where prediction error inverts — i.e., where the model is
// systematically WRONG (so the "don't post" verdict is statistically meaningful).
//
// Method: sweep threshold from 0.1 to 0.7 in 0.05 steps. For each threshold:
//   - Group outcomes where prediction.confidence < THRESHOLD
//   - Compute "inverted error": did high-predicted-score actually flop?
//   - Look for the lowest threshold where >50% of low-confidence high-score
//     predictions actually underperformed
//
// Output: single number + rationale doc.

interface ConfidenceRow extends OutcomePair { confidence: number; }

async function sweep(pairs: ConfidenceRow[]) {
  for (let t = 0.1; t <= 0.7; t += 0.05) {
    const lowConf = pairs.filter(p => p.confidence < t);
    const highPredicted = lowConf.filter(p => p.predicted > 0.6);
    const actuallyFlopped = highPredicted.filter(p => p.actual < 0.4);
    const inversionRate = actuallyFlopped.length / Math.max(1, highPredicted.length);
    console.log(`threshold=${t.toFixed(2)}  n=${lowConf.length}  highPred=${highPredicted.length}  flop_rate=${(inversionRate*100).toFixed(1)}%`);
  }
}
```

If no outcomes table data exists yet (likely — STATE.md says "calibration has no outcome data"), fall back to **option (c)** — reuse `is_calibrated=false` as the gate. Locked threshold = 0.4 with rationale "no calibration corpus yet; matches `confidence < 0.4` LOW band in `calculateConfidence`". Add TODO to revisit after corpus accumulates.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages-router API route SSE (`res.writeHead`) | App-router Route Handler + Web Streams API (`new Response(stream)`) | Next.js 13.4 (2023) | Existing `/api/analyze` already uses this pattern — keep consistent. |
| `setTimeout` reconnect ladder | Native EventSource auto-reconnect with `Last-Event-ID` | HTML Living Standard | Use the browser. Don't reinvent. |
| `MATERIALIZED VIEW` with full refresh | Plain TABLE + `pg_cron` upsert OR `MATERIALIZED VIEW CONCURRENTLY` (with unique idx) | PostgreSQL 9.4+ | This codebase uses plain TABLES — follow precedent. |
| Vercel serverless 60s max | Fluid Compute 300s default (Apr 2025) | Vercel platform change | Already configured at 300s in existing analyze route. Mirror it. |
| React 18 Suspense for data | React 19 `use(promise)` + Suspense for streaming | React 19.0 | Project explicitly defers per CONTEXT — `panelReady` explicit state instead. |
| EventSource only (browser) | EventSource + fetch-event-source polyfill for headers | 2018+ | Phase 1 uses native EventSource since same-origin auth = cookies = automatic. |

**Deprecated/outdated in our codebase:** Nothing in this phase touches deprecated APIs. The existing `useAnalyze` POST+body-reader pattern is intentionally preserved per D-01.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `outcomes` table has at least a few rows for anti-virality threshold sweep | Anti-Virality Threshold Calibration (Plan 1.5) | If empty: fall back to fixed 0.4 + TODO. Documented in recommendation. Low risk — pre-planned fallback. |
| A2 | `scraped_videos.primary_niche` + `competitor_videos.posted_at` are populated enough for niche-grouped post-time aggregation | Plan 1.4 — `niche_post_windows` source query | If empty/sparse: Plan 1.4 ships with `FALLBACK` only. Affects UX quality of "When to post" panel. Pre-planned fallback exists. |
| A3 | Adding `emotion_arc` to Omni Plus prompt does not significantly bump per-call cost or break existing Zod parsing | Plan 1.3 | Higher cost / Zod regressions. Mitigation: add as `.optional()` with backward-compat fallback to single `Emotional Charge` factor score. |
| A4 | Browser EventSource auto-attaches Supabase HTTP-only cookies on same-origin GET | Plan 1.1 D-04 implementation | If cookies don't attach: GET stream returns 401. Mitigation already proven — Supabase middleware reads cookies from every same-origin request, and EventSource follows browser cookie rules just like `<img>` or `fetch`. [VERIFIED: WHATWG SSE spec + browser implementations] |
| A5 | Adding placeholder `analysis_results` row at POST start (Pitfall #6 Option A) does not break existing `useAnalyze` consumers | Plan 1.1 (Pitfall #6) | Existing dashboard hook ignores `event: started` (unknown event type just doesn't update state). Mitigation: confirm in code review — `useAnalyze` lines 86-96 only branches on `phase`, `complete`, `error` event types. Unknown events silently ignored. [VERIFIED: use-analyze.ts] |
| A6 | TypeScript `Database` type for the new `niche_post_windows` table is regenerated after the migration | Plan 1.4 | Type errors. Mitigation: include `npx supabase gen types typescript --local > src/types/database.types.ts` step in the plan. |

## Open Questions

1. **Outcomes table actual row count** (resolved via DB query before Plan 1.5 execution)
   - What we know: STATE.md says "calibration has no outcome data yet"
   - What's unclear: whether ANY rows exist (could be 0, could be 100)
   - Recommendation: Plan 1.5 first task = `SELECT COUNT(*) FROM outcomes WHERE actual_score IS NOT NULL` against production DB. If <50, lock 0.4 with documented "insufficient data" rationale. If ≥50, run the sweep.

2. **Which corpus table has best niche-tagged `posted_at` density?**
   - What we know: `scraped_videos.primary_niche` was backfilled in Phase 8 migration; `competitor_videos` has no niche tag (relies on profile-level niche which is NOT a column on `competitor_profiles`); `training_corpus.niche` exists with 5 niches.
   - What's unclear: which one has best density of recent `posted_at` data.
   - Recommendation: Plan 1.4 first task = run analytics query on both. Use whichever has higher density. Initial bet: `scraped_videos` (Phase 8 backfill is recent and includes posted_at).

3. **Does `analysis_results` row need a new column for `optimal_post_window` JSONB?**
   - What we know: existing route inserts the full PredictionResult shape into typed columns (overall_score, factors, etc.).
   - What's unclear: whether `optimal_post_window` should be top-level JSONB column or nested under existing `feature_vector` / `signal_availability` JSONB.
   - Recommendation: Add as top-level `optimal_post_window JSONB` column. New panels read it directly. Migration owns this.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase pgvector + pg_cron | Plan 1.4 cron-refresh of materialized table | ✓ | pgvector installed Phase 6; pg_cron installed via Supabase Free plan | — |
| Next.js 16.1.5 | Plan 1.1 SSE Route Handler | ✓ | 16.1.5 | — |
| TypeScript supabase CLI | Plan 1.4 type regen after new table | likely ✓ | supabase@2.74.5 in devDeps | Manual hand-write of `niche_post_windows` row type if CLI unavailable |
| `pg_cron` extension | Plan 1.4 daily refresh | ✓ (verified — already used by phase11 retention counter migration) | — | Could replace with Vercel Cron + admin API route, but pg_cron is simpler |
| Vercel Fluid Compute | Plan 1.1 GET stream maxDuration=300 | ✓ (existing analyze route uses maxDuration=300) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (unit) + Playwright 1.58.0 (e2e) |
| Config file | `vitest.config.ts` + `e2e/playwright.config.ts` |
| Quick run command | `npx vitest run src/lib/engine src/hooks` |
| Full suite command | `npx vitest run && npx playwright test --config e2e/playwright.config.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2.1 | `useAnalysisStream` parses stage events and builds panelReady | unit (happy-dom) | `npx vitest run src/hooks/queries/__tests__/use-analysis-stream.test.tsx` | ❌ Wave 0 |
| R2.1 | `useAnalysisStream` reconnects once then polls on connection drop | unit (happy-dom + mock EventSource) | `npx vitest run src/hooks/queries/__tests__/use-analysis-stream-reconnect.test.tsx` | ❌ Wave 0 |
| R2.1 | `GET /api/analyze/[id]/stream` returns 401 unauth, 404 missing, 200 with text/event-stream | unit (route handler) | `npx vitest run src/app/api/analyze/__tests__/stream-route.test.ts` | ❌ Wave 0 |
| R2.1 | E2E: submit on `/analyze`, navigate to `/analyze/[id]`, see panels transition idle→loading→ready | e2e | `npx playwright test e2e/result-surface-stream.spec.ts --project=chromium` | ❌ Wave 0 |
| R1.7 | Emotion arc field populated on video uploads | unit (engine) | `npx vitest run src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` | ❌ Wave 0 |
| R6.1 | `optimal_post_window` returned for known-niche analysis | unit (aggregator) | `npx vitest run src/lib/engine/__tests__/aggregator-optimal-post.test.ts` | ❌ Wave 0 |
| R6.1 | `computeOptimalPostWindow` returns FALLBACK on unknown niche | unit | `npx vitest run src/lib/engine/__tests__/optimal-post.test.ts` | ❌ Wave 0 |
| R6.1 | `niche_post_windows` migration creates table + cron schedule | manual | `psql ... \d niche_post_windows && SELECT * FROM cron.job WHERE jobname='refresh-niche-post-windows'` | manual |
| R1.9 | Anti-virality threshold constant exists + documented | unit | `npx vitest run src/lib/engine/__tests__/anti-virality.test.ts` | ❌ Wave 0 |
| Pitfall #6 | POST route inserts placeholder row + emits `event: started` BEFORE stream starts | unit (route handler) | `npx vitest run src/app/api/analyze/__tests__/route-started-event.test.ts` | ❌ Wave 0 |
| Pitfall #3 | ResultCard skips stream open when `initialData.overall_score !== null` | unit (happy-dom) | `npx vitest run src/app/\(app\)/analyze/__tests__/result-card.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/engine src/hooks src/app/api/analyze`
- **Per wave merge:** `npx vitest run` (full Vitest including engine 80% coverage gate)
- **Phase gate:** Full `npx vitest run && npx playwright test --config e2e/playwright.config.ts` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/queries/__tests__/use-analysis-stream.test.tsx` — happy-dom env, mock fetch + EventSource, assert panelReady transitions
- [ ] `src/hooks/queries/__tests__/use-analysis-stream-reconnect.test.tsx` — happy-dom env, simulate connection drop, assert single-reconnect + polling fallback
- [ ] `src/app/api/analyze/__tests__/stream-route.test.ts` — node env, mock supabase, assert headers + status codes + heartbeat
- [ ] `src/app/api/analyze/__tests__/route-started-event.test.ts` — node env, assert `event: started` frame on POST start
- [ ] `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` — node env, mock Qwen response, assert emotion_arc parsed
- [ ] `src/lib/engine/__tests__/aggregator-optimal-post.test.ts` — node env, mock supabase, assert optimal_post_window populated on PredictionResult
- [ ] `src/lib/engine/__tests__/optimal-post.test.ts` — node env, pure function tests with mock supabase
- [ ] `src/lib/engine/__tests__/anti-virality.test.ts` — node env, assert threshold constant + edge cases
- [ ] `src/app/(app)/analyze/__tests__/result-card.test.tsx` — happy-dom env, render with/without initialData, assert stream gate
- [ ] `e2e/result-surface-stream.spec.ts` — Playwright, mock-pipeline backend OR use cached test analysis
- [ ] Test fixture: `src/test/fixtures/stage-events.ts` — canonical sequence of stage events for hook tests
- [ ] Test fixture: `src/test/fixtures/completed-prediction.ts` — canonical completed PredictionResult for initialData tests
- [ ] No framework install needed — Vitest + Playwright + happy-dom (pragma-based) all present

## Sources

### Primary (HIGH confidence)
- **Codebase grep + read** (2026-05-24):
  - `src/lib/engine/events.ts` (StageEvent shape)
  - `src/lib/engine/pipeline.ts` (orchestration)
  - `src/lib/engine/aggregator.ts` (Stage 10/11 ordering)
  - `src/lib/engine/types.ts` (PredictionResult schema)
  - `src/app/api/analyze/route.ts` (POST SSE pattern)
  - `src/hooks/queries/use-analyze.ts` (SSE parse loop)
  - `src/lib/engine/calibration.ts` (ECE + outcome pair helpers)
  - `src/lib/engine/qwen/omni-analysis.ts` + `schemas.ts` (no emotion_arc found)
  - `supabase/migrations/20260216100000_competitor_tables.sql` (competitor_videos schema)
  - `supabase/migrations/20260518000000_phase8_pgvector.sql` (scraped_videos.primary_niche)
  - `vitest.config.ts` + `e2e/playwright.config.ts`
- **Context7 /vercel/next.js** — Streaming Route Handlers, runtime config (force-dynamic, maxDuration). Verified canonical Next.js 16 patterns.
- **HTML Living Standard** — Server-Sent Events spec (https://html.spec.whatwg.org/multipage/server-sent-events.html). Last-Event-ID semantics, retry timing.
- **MDN EventSource API** — Browser support + auto-reconnect behavior.

### Secondary (MEDIUM confidence)
- **whatwg/html#2177** (https://github.com/whatwg/html/issues/2177) — EventSource cannot send custom headers (open issue, no spec change pending).
- **Vercel Fluid Compute docs** (https://vercel.com/docs/fluid-compute) — 300s default maxDuration since April 2025.
- **datawookie blog** (https://datawookie.dev/blog/2022/03/scheduling-refresh-materialised-view/) — pg_cron + materialized view refresh patterns.
- **Supabase blog: Supabase Cron** — pg_cron usage on Supabase.

### Tertiary (LOW confidence — context only, not load-bearing for plan)
- **Hacker News thread** (https://news.ycombinator.com/item?id=30313515) — Community confirmation of EventSource header limitation.
- **Pedro Alonso blog on SSE in Next.js** — Implementation patterns (not authoritative).
- **Various calibration / ROC threshold academic papers** — Background on ECE and confidence calibration, not directly applied (Phase 1 uses corpus sweep approach + Platt is already wired).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libs verified in package.json
- Architecture: HIGH — CONTEXT decisions fully locked, codebase patterns proven
- Pitfalls: HIGH for items verified in codebase (1, 5, 6, 7), MEDIUM for browser behavior (2, 8)
- Emotion arc absence finding: HIGH — multi-pattern grep confirmed
- Calibration approach: MEDIUM — depends on `outcomes` table row count (resolved at execution time)
- niche_post_windows source table: MEDIUM — depends on `scraped_videos` posted_at density (verified at execution time)

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (30 days — stable Next.js / Supabase landscape; key dep versions all pinned in package.json)

## Project Constraints (from CLAUDE.md)

- **Stack required:** Next.js 16, TypeScript strict, Tailwind v4, Supabase. (Note: CLAUDE.md says "Next.js 15" — STACK.md verified as 16.1.5. Use 16 per actual codebase.)
- **Branding/design:** Coral #FF7F50, Raycast aesthetic, 36-component design system. New skeleton panels MUST reuse existing `<Skeleton>` and `<GlassPanel>` — no new design tokens (NF3).
- **GlassPanel rules:** Zero-config, 4 props (children, className, style, as). Fixed 5px blur, 12px radius, Raycast gradient. No tint/blur/opacity/innerGlow/borderGlow props.
- **Backdrop-filter:** Apply via React inline styles, not CSS classes (Lightning CSS strips it).
- **Borders:** Universal 6%, hover 10%. Radius 12px for cards, 8px for inputs/buttons.
- **Server components by default**, client only when interactive ("use client").
- **Commit format:** `type(phase): description` (existing convention).
- **No new design tokens** (project rule + R-NF3).
- **NEVER hardcode secrets** — all DB access goes through existing Supabase client trio.
- **Path alias:** `@/*` → `src/*`.
- **Tests required after changes** — Vitest run gate before any commit.
