# Phase 6 Research — Reshoot script + optimal post time

**Researched:** 2026-05-28
**Domain:** Script transformation endpoint + optimal post time UI — pure engine consumption
**Confidence:** HIGH (all items verified from codebase source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All 40 decisions (O-1..O-8, D-01..D-40) in 06-CONTEXT.md are locked. Phase 6 is pure consumption — no engine schema changes. Every architectural choice (server-first, TanStack Query, Sheet primitives, GlassPill, logger pattern) is confirmed below with file+line evidence.

### Claude's Discretion
All 24 gray-area items from CONTEXT.md §"Claude's Discretion (researcher locks during planning)" are resolved in the Locked Items section below.

### Deferred Ideas (OUT OF SCOPE)
- Notion import URL for script (R5.2 explicit defer to M2-II)
- Calendar integration for post-time (R6.2 explicit defer)
- Creator-profile-wide preferred-post-window (M2-II)
- Engine `reasoning_sections` field (future engine extension)
- Script export formats beyond markdown
- Per-section regeneration (LLM call — violates R5.1)
- Audio voice-over generation
- Multi-language script output
- Niche peer comparison beyond reasoning string
- Post-time "best 3 windows" (engine schema change needed)
- A/B variant outcome attribution (M2-II)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R5.1 | Script endpoint `/api/analyze/<id>/script` — fast (<200ms), pure transformation, no LLM, cache result | D-01 mirrors comparisons/route.ts; D-07 latency budget confirmed; D-09 additive JSONB column |
| R5.2 | Script UI — 4 sections, per-section copy, Copy-all with headers | ScriptBody.tsx pattern; useCopyToClipboard confirmed; GlassPill confirmed; Sheet confirmed |
| R5.3 | Empty state when confidence >= 0.7 — "Your video is solid" + A/B opening variants | signal_anchor enum locked; `counterfactuals.band` confirmed in CounterfactualResult |
| R6.2 | When-to-post panel — auto-detected timezone, editable, reasoning one-liner | OptimalPostWindow shape confirmed; override endpoint mirrors override/route.ts |
| NF1 | Performance tiers — p95 <200ms for script endpoint | Cache hit path = single PK SELECT ~10-30ms; confirmed by prediction-cache.ts L2 pattern |
| NF2 | Accessibility WCAG AA — keyboard nav, aria-live, Sheet trap-focus | Sheet uses Radix Dialog (trap-focus + Esc-closes built in); ActionsNode aria-live="polite" confirmed |
| NF4 | Telemetry — structured logger for all events | logger.ts + actions-constants.ts TELEMETRY pattern confirmed |
</phase_requirements>

---

## Locked Items

### 1. signal_anchor enum — VERIFIED

**Source:** `src/lib/engine/stage11-counterfactuals-prompts.ts` (lines 33-34, 67-168) and `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` (fixture signal_anchors, lines 67-140)

The system prompt instructs the LLM to set `signal_anchor` to "which signal this addresses" with examples. `signal_anchor` is `z.string()` with no enum constraint — it is free-form text. From test fixtures and the prompt, the observed/expected anchors are:

| Observed anchor | Source |
|-----------------|--------|
| `hook_decomposition.visual_stop_power` | Test fixture line 67, prompt line 33 |
| `hook_decomposition.audio_hook_quality` | Test fixture line 74 |
| `hook_decomposition.text_overlay_score` | Prompt line 33 |
| `hook_decomposition.first_words_speech_score` | Prompt line 33 |
| `audio_signals.music_ratio` | Test fixture line 101 |
| `audio_signals.voice_clarity` | Test fixture line 109 |
| `gemini_factor.Share Trigger` | Test fixture line 82 — note: space not dot |
| `gemini_factor.Completion Pull` | Test fixture line 125 |
| `persona_dissent` | Test fixture line 138 |
| `platform_fit` | Prompt line 33 |

**Regex correction for D-03 Step 3 (empty-state hook filter) and D-03 Step 4 (opening_line hook filter):**

The CONTEXT.md regex `/^hook_decomposition\.visual_stop_power$|^hook_decomposition\.audio_hook_quality$|^hook_decomposition\.first_words_speech_score$|^hook_decomposition\.text_overlay_score$|gemini_factor\.Hook|opening/i` has one gap: `gemini_factor.Hook` with a dot won't match observed patterns like `gemini_factor.Share Trigger` (space, not dot). The pattern for gemini_factor anchors uses a space: `"gemini_factor.{FactorName}"` where FactorName is one of the 5 Gemini factors (hookScore, completionPull, etc. — mapped to their display name strings).

**Corrected regex (drop `gemini_factor\.Hook`, broaden to any gemini_factor with hook-related terms):**
```
/^hook_decomposition\.|gemini_factor\.(Hook|Scroll-Stop|Completion Pull)|first_words|opening/i
```

The `hook_decomposition.*` prefix-match covers all 4 decomposition anchors. For gemini_factor, hook-related factors use display names (from factors array): "Scroll-Stop Power", "Completion Pull" — check factor names against `/hook|scroll.stop|completion/i` for the opening_line fallback path.

**For text/caption detection (D-06):** regex `/text_overlay|hashtag|caption|cta/i` is correct — these are free-form strings from the prompt examples and match `hook_decomposition.text_overlay_score`.

**Bottom line:** `signal_anchor` is free-form string, no fixed enum. The prefix-match approach (`/^hook_decomposition\./`) is the safe pattern — it matches all 4 hook decomposition sub-signals without needing to enumerate values.

---

### 2. segment idx → timestamp_ms mapping — VERIFIED

**Source:** `src/lib/engine/types.ts` lines 27-51 (`HeatmapPayload`), `PredictionResult` line 332

`HeatmapPayload.segments` exists with `idx`, `t_start`, `t_end` fields. However, **`heatmap` is optional on `PredictionResult`** (declared `heatmap?: HeatmapPayload | null`). The analyze route's `buildInsertRow` at line 266-320 does NOT persist `heatmap` to `analysis_results` — it's not in the INSERT column list. The `counterfactuals.suggestions[].timestamp_ms` field is already a direct millisecond timestamp — no segment index lookup needed.

**D-04 ruling:** `dropoff_segment_indices` contains segment array indices, but segment→timestamp mapping requires the `heatmap` JSONB — which is NOT stored in `analysis_results`. The script endpoint cannot reconstruct `t_start` for segment indices from the row alone.

**Confirmed fallback:** Sort `counterfactuals.suggestions[]` where `type === 'fix'` by `timestamp_ms` ASC (native field on each suggestion). No segment-index resolution needed. The CONTEXT.md fallback is the ONLY path — implement it directly. Drop the prioritization heuristic from D-04 entirely; use `timestamp_ms` ASC sort as primary.

---

### 3. formatTime helper location — VERIFIED

**Source:** `grep -r "formatTime\|formatMs"` returned zero results in `src/lib/`. No existing time formatter exists.

**Ruling:** Inline a 4-line `formatTime(ms: number): string` in `src/components/board/actions/script/script-utils.ts` colocated with the script transformation logic. Do not create a separate `src/lib/time.ts` package.

```typescript
// src/components/board/actions/script/script-utils.ts
export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
```

Note: this util is also used server-side in the `/script` endpoint — collocate it in `src/lib/script-utils.ts` instead so both the endpoint and the client can import it without cross-boundary issues. Keep it to the 4-line function.

---

### 4. useCopyToClipboard shape + concurrency — VERIFIED

**Source:** `src/hooks/useCopyToClipboard.ts` (lines 1-51)

- Returns `{ copied: boolean, copy: (text: string) => Promise<boolean> }` — exactly matches CONTEXT.md O-3.
- Default reset delay is `2000ms` (not 1.5s — note CONTEXT.md says 1.5s; actual default is 2s). Planner should use 2s or pass `resetDelay={1500}` explicitly.
- Concurrency: uses `useState` + `setTimeout`. If `copy()` is called twice within 2s (per-section + Copy-all simultaneously), the second call sets `copied=true` and schedules a second `setTimeout`. Both timeouts will fire — the first fires at original_time+2s setting `copied=false`, then the second fires at original_time+2s+delta also setting `copied=false`. This is "last-write-wins" as expected per CONTEXT.md O-3. No race condition concern — acceptable behavior.
- **One hook instance serves all copy buttons** safely. Phase 6 can instantiate one per panel (reshoot panel + optimal post panel) or one global per `ScriptBody` component.

---

### 5. Sheet primitive — VERIFIED

**Source:** `src/components/ui/sheet.tsx` (lines 1-143)

- `Sheet` exported (line 134). Uses Radix `Dialog` primitive via `import { Dialog as SheetPrimitive } from "radix-ui"` — trap-focus and Esc-closes are Radix built-ins.
- `SheetContent` accepts `side?: "top" | "right" | "bottom" | "left"` (line 53). Default `side="right"`. Mobile drawer = `side="bottom"`.
- `side="bottom"` class: `"inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"` (line 70-72).
- `showCloseButton?: boolean` prop (default `true`) — adds X close button top-right.
- No `reduced-motion` handling in the Sheet primitive itself — animations use `data-[state=...]` CSS classes. The slide animation DOES fire regardless of `prefers-reduced-motion`. Phase 6 will need to conditionally pass `className` overriding transition to `none` when `prefersReducedMotion` is true, OR accept that Sheet animations run (low priority since Radix sets `duration-300`/`duration-500`).
- `PersonaInspector.tsx` (lines 84-225) uses `Sheet` with dynamic `side = isMobile ? 'bottom' : 'right'` — confirms the pattern Phase 6 inherits for `ScriptInspectorTrigger` + `OptimalPostEditSheet`.
- **`onCloseAutoFocus` prop** on `SheetPrimitive.Content` is used in PersonaInspector line 121 for focus-return to trigger element — Phase 6 should use the same pattern with a `triggerRef`.

---

### 6. GlassPill component path — VERIFIED

**Source:** `src/components/primitives/GlassPill.tsx` (lines 1-152)

- Import path: `@/components/primitives/GlassPill` (NOT `@/components/ui/GlassPill`).
- Exported as named export: `export function GlassPill({ ... }: GlassPillProps)`.
- Props: `children`, `color?: PillColor | "neutral"` (default `"neutral"`), `size?: "sm" | "md" | "lg"` (default `"md"`), `variant?: "subtle" | "solid" | "outline"` (default `"subtle"`), `active?: boolean`, `className?`, `style?`, `onClick?`, `disabled?`.
- Size map: `sm = "px-2.5 py-1 text-xs"`, `md = "px-3 py-1.5 text-sm"`, `lg = "px-4 py-2 text-base"`.
- When `onClick` provided, renders as `<button type="button">`.
- Already used in: `SimilarVideoCardCompact.tsx`, `PercentileChip.tsx`, `HookDecompNode.tsx`, `EmotionArcNode.tsx`, `legend-pills.tsx`, `filter-pills.tsx` — confirmed production-ready pattern.
- **Tailwind v4 oklch caveat (from CLAUDE.md):** oklch colors used in `colorValues` (lines 31-66) may compile incorrectly for very dark colors (L < 0.15). The `neutral` color uses `oklch(0.25 ...)` — above the danger threshold. Safe for Phase 6 use.

---

### 7. CopyButton primitive — VERIFIED

**Source:** `src/components/referral/CopyButton.tsx` (lines 1-55); `src/app/(marketing)/showcase/_components/copy-button.tsx`

Two `CopyButton` components exist but both are wrong for Phase 6:
- `src/components/referral/CopyButton.tsx`: uses Lucide icons (`CheckIcon`, `ClipboardIcon`), `Button variant="primary"` — too prominent for ghost icon-button use inside ScriptBody.
- Marketing showcase copy-button: different domain entirely.

**Ruling:** Do NOT reuse either existing `CopyButton`. Phase 6 builds a new `src/components/board/actions/script/CopyButton.tsx` (~30 lines) using:
- `@phosphor-icons/react` `Copy` + `CheckCircle` icons (Phosphor is already used by ActionsReshootHeroSlot + ActionsOptimalPostSlot).
- `useCopyToClipboard(1500)` — note: override default 2000ms to 1500ms for tighter feedback loop.
- Ghost style: white/55 → white/80 on hover.
- Inline "Copied!" text replaces icon for 1.5s.

---

### 8. Day picker primitive — VERIFIED

**Source:** `find src/components/ui/ -type f` — full list of 31 UI components confirmed. No weekday/day-of-week picker exists.

**Ruling:** Inline 7-pill `role="radiogroup"` approach confirmed. Build inline in `OptimalPostEditSheet.tsx`. Day labels: `['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']`. Use `GlassPill` with `active` prop for selection state and arrow-key navigation via `onKeyDown`.

---

### 9. API route mirror — comparisons/route.ts — VERIFIED

**Source:** `src/app/api/analyze/[id]/comparisons/route.ts` (lines 1-71)

Exact lines Phase 6 `/script` endpoint mirrors:

```typescript
// Line 24-30: ParamsSchema
const ParamsSchema = z.object({
  id: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/u, 'id must be url-safe id'),
});

// Line 32-36: handler signature
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const validated = ParamsSchema.safeParse(resolved);
  if (!validated.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { id } = validated.data;

  // Line 43-48: auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Line 51-60: RLS query with user_id filter
  const { data, error } = await supabase
    .from('analysis_results')
    .select('...')
    .eq('user_id', user.id)
    ...
```

**Key differences for `/script`:**
- SELECT columns: `id, counterfactuals, factors, reasoning, confidence, confidence_label, anti_virality_gated, hook_decomposition, engine_version, script_result` (note: `dropoff_segment_indices` is NOT needed — fallback to timestamp_ms sort per Item 2).
- 404 unification: return 404 for both missing-row AND wrong-owner (same as stream/route.ts:78 pattern).
- **`runtime`/`dynamic`/`maxDuration`**: comparisons/route.ts does NOT export these (confirmed: 0 grep matches). Stream route has `runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=300`. For `/script`, add: `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 30;` (not 300 — pure DB lookup).
- Error logger: use `createLogger({ module: 'analyze.script' })` (see prediction-cache.ts pattern).

---

### 10. API route mirror — override/route.ts — VERIFIED

**Source:** `src/app/api/analyze/[id]/override/route.ts` (lines 1-106)

Exact lines Phase 6 `/optimal-post-override` mirrors:

```typescript
// Lines 36-52: POST handler with auth pattern
export async function POST(req, { params }) {
  const { id } = await params;  // NOTE: no Zod validation on id here (difference from comparisons)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Lines 50-55: JSON parse with error handling
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Lines 66-79: update with RLS (service-client NOT used — user client enforces RLS UPDATE)
  const { error: e1 } = await (supabase as any)
    .from('analysis_results')
    .update({ analysis_override: { ... } })
    .eq('id', id);
  if (e1) return NextResponse.json({ error: 'override_write_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

**Key differences for `/optimal-post-override`:**
- Request body Zod schema: `OptimalPostOverrideSchema` with `day_of_week: z.enum(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])`, `hour_range: z.tuple([z.number().int().min(0).max(23), z.number().int().min(1).max(24)])` with refine `hour_range[1] > hour_range[0]`.
- Write column: `analysis_results.optimal_post_override` (not `analysis_override`).
- Written shape: `{ day_of_week, hour_range, saved_at: new Date().toISOString() }`.
- No `save_as_default` branch (creator-wide preference is M2-II).
- **SECURITY NOTE:** The existing override/route.ts does NOT validate `id` with Zod (line 39 uses raw `await params`). Phase 6 `/optimal-post-override` MUST add `ParamsSchema` validation (same as comparisons) — this is a security improvement over the template. Also add `.eq('user_id', user.id)` to the UPDATE query for defense-in-depth (override/route.ts omits this, relying only on RLS UPDATE policy — Phase 6 should add it).

---

### 11. prediction-cache.ts write pattern — VERIFIED

**Source:** `src/lib/engine/cache/prediction-cache.ts` (lines 107-120)

```typescript
// Line 107-120: populatePredictionCache — L1 write only
export function populatePredictionCache(
  contentHash: string,
  userId: string,
  result: PredictionResult,
  opts: { bypass?: boolean } = {},
): void {
  const key = cacheKey(contentHash, userId);
  L1.set(key, result);  // In-memory only
}
```

**Critical finding:** `populatePredictionCache` writes to L1 in-memory cache ONLY. The L2 (`analysis_results`) write happens in the main `analyze/route.ts` INSERT, not here. Phase 6's `script_result` cache write-through is a different pattern — a service-client UPDATE on the existing row.

**D-08 service-client pattern for Phase 6:**
```typescript
import { createServiceClient } from '@/lib/supabase/service';

// After computing script on cache miss:
const serviceClient = createServiceClient();
serviceClient
  .from('analysis_results')
  .update({ script_result: computedScript })
  .eq('id', analysisId)
  .then(({ error }) => {
    if (error) log.warn('script_result cache write failed', { analysisId, error: error.message });
  });
// Do NOT await — fire-and-forget per D-08
```

**Why service-client:** The `/script` GET endpoint uses the user-scoped `createClient()` for the SELECT (RLS enforced). The `script_result` UPDATE needs service-client to bypass RLS UPDATE restrictions cleanly (same as the pattern for L2 cache writes in prediction-cache.ts which uses `createServiceClient()` at line 75).

**L2 cache contract confirmation:** L2 lookup at lines 74-101 selects `*` from analysis_results filtered by `(user_id, content_hash, engine_version)` within 24h TTL. Phase 6's `script_result` column will be read via the `*` select — the hydrated result includes it transparently. The `rowToPredictionResult` function at line 129 spreads the raw row, so `script_result` flows through as `row.script_result` (JSONB, typed as `unknown`). Phase 6 must Zod-parse it before use.

---

### 12. TanStack Query hook colocation — VERIFIED

**Source:** `src/components/board/verdict/use-comparisons.ts` (lines 1-24); `src/hooks/queries/` directory (listing confirmed)

Two colocation patterns exist in the codebase:
1. **Colocated with component:** `use-comparisons.ts` lives at `src/components/board/verdict/` alongside `VsHistoryCollapsible.tsx`.
2. **Global hooks/queries:** `src/hooks/queries/` for cross-cutting hooks (use-analysis-stream, use-creator-profile, etc.).

**Key naming pattern from use-comparisons.ts:**
- Query key: `['comparisons', analysisId]` — simple array, NOT using `queryKeys` factory.
- `staleTime: 5 * 60 * 1000` (5 minutes).
- `enabled: !!analysisId`.

**Ruling for Phase 6:** Colocate hooks with their consumer components per the verdict precedent:
- `src/components/board/actions/script/use-script.ts` — query key `['script', analysisId]`, `staleTime: Infinity`, `enabled: !!analysisId && phase === 'complete'`.
- `src/components/board/actions/optimal-post/use-optimal-post-override.ts` — mutation hook for POST + query for reading override.

Do NOT add to `src/hooks/queries/` (those are for cross-cutting concerns). Do NOT add to `queryKeys` factory in `src/lib/queries/query-keys.ts` (local hooks use inline string arrays per precedent).

---

### 13. logger.info telemetry pattern — VERIFIED

**Source:** `src/lib/logger.ts` (lines 56-76), `src/components/board/actions/actions-constants.ts` (lines 18-21), `src/components/board/actions/ActionsNode.tsx` (line 13, 33)

**Logger signature:**
```typescript
logger.info(msg: string, data?: Record<string, unknown>): void
```

**ActionsNode pattern (line 33):**
```typescript
import { logger } from '@/lib/logger';
logger.info(TELEMETRY.ACTIONS_RESHOOT_PLACEHOLDER_VISIBLE, {});
```

Note: `logger` (not `createLogger`) is imported — the singleton at logger.ts:75. For server-side (endpoint), use `createLogger({ module: 'analyze.script' })` to get module-scoped logger.

**Phase 6 telemetry events (extend actions-constants.ts TELEMETRY object):**
```typescript
// New entries in TELEMETRY constant:
SCRIPT_SECTION_COPIED: 'script_section_copied',
SCRIPT_COPY_ALL: 'script_copy_all',
SCRIPT_INSPECTOR_OPENED: 'script_inspector_opened',
SCRIPT_EMPTY_STATE_SHOWN: 'script_empty_state_shown',
OPTIMAL_POST_TZ_CONVERTED: 'optimal_post_tz_converted',
OPTIMAL_POST_EDITED: 'optimal_post_edited',
OPTIMAL_POST_SOURCE_EXPLAINED: 'optimal_post_source_explained',
OPTIMAL_POST_RESET: 'optimal_post_reset_to_recommendation',
```

**Usage pattern:**
```typescript
logger.info(TELEMETRY.SCRIPT_SECTION_COPIED, {
  analysis_id: analysisId,
  section: 'opening',
  char_count: text.length,
});
```

Server-side events (cache hit/miss) use the module logger:
```typescript
const log = createLogger({ module: 'analyze.script' });
log.info('script_endpoint_cache_hit', { analysis_id: id });
```

---

### 14. Phase 5 actions wrappers + testids — VERIFIED

**Source:** `src/components/board/actions/ActionsReshootHeroSlot.tsx` (23 lines), `src/components/board/actions/ActionsOptimalPostSlot.tsx` (14 lines), `src/components/board/actions/ActionsNode.tsx` (92 lines), `src/components/board/actions/actions-constants.ts` (27 lines)

**Wrapper APIs:**

`ActionsReshootHeroSlot`:
- Props: `{ className?: string; style?: React.CSSProperties }` (line 5-7)
- Outer div testid: `data-testid="actions-reshoot-hero-slot"` (line 14) — KEEP this in Phase 6.
- Inner placeholder testid: `data-testid="actions-reshoot-placeholder"` on `<PlaceholderCard>` — this is INSIDE the wrapper, on the PlaceholderCard child. Phase 6 removes PlaceholderCard, so this testid disappears. Tests expecting it need updating.

`ActionsOptimalPostSlot`:
- No props.
- No outer wrapper div — `PlaceholderCard` is the direct return.
- Testid: `data-testid="actions-optimal-post-placeholder"` is on the PlaceholderCard inside.
- Phase 6 wraps content in a div with `data-testid="actions-optimal-post-card"`. The slot component needs to accept children or be refactored per O-1.

**Grid constants (actions-constants.ts:23-27):**
```typescript
export const ACTIONS_FRAME_DEFAULT_HEIGHT = 200;
export const ACTIONS_FRAME_AV_HEIGHT = 360;
export const ACTIONS_GRID_DEFAULT_ROWS = '88px 88px';
export const ACTIONS_GRID_AV_ROWS = '160px 1fr';
```
These stay unchanged in Phase 6.

**TELEMETRY (actions-constants.ts:18-21):** Phase 6 extends with 8 new entries (see Item 13).

**ActionsNode.tsx imports (lines 7-8):** `ActionsReshootHeroSlot` and `ActionsOptimalPostSlot` imported by name — these filenames stay unchanged per O-1.

**`getFrameAntiViralityState` (line 22):** imported from `'../cross-group-state'` — Phase 6 inherits.

**`useBoardStore` selector (line 21):** `useBoardStore((s) => s.boardState)` — exact pattern for Phase 6 D-37.

---

### 15. PlaceholderCard tests needing testid updates — VERIFIED

**Source:** `src/components/board/actions/__tests__/ActionsNode.test.tsx` (lines 81-95, 104-109)

Tests referencing placeholder testids that break when Phase 6 replaces placeholders:

| Test (line) | testid queried | Phase 6 action |
|-------------|----------------|----------------|
| Line 86 | `actions-reshoot-placeholder` | Update to `actions-reshoot-body` (or remove — hero slot now renders real content) |
| Line 94 | `actions-optimal-post-placeholder` | Update to `actions-optimal-post-card` |
| Line 106 (AV state) | `actions-optimal-post-placeholder` | Update to `actions-optimal-post-card` |

`PlaceholderCard.test.tsx` tests the PlaceholderCard component directly — NOT affected by Phase 6 (PlaceholderCard still used by `ActionsShareSlot`).

`SimilarVideosCard.*.test.ts` — unaffected.

**Wave 0 task:** Update `ActionsNode.test.tsx` lines 86, 94, 95, 106 to query new testids.

---

### 16. Supabase migrations directory — VERIFIED

**Source:** `ls supabase/migrations/ | sort | tail -10`

Latest migrations:
```
20260517120000_phase3_pipeline_columns.sql
20260517210000_creator_profile_9card_columns.sql
20260518000000_phase8_pgvector.sql
20260519000000_phase6_audio_fingerprint.sql
20260520000000_phase10_platt_parameters.sql
20260520100000_phase11_retention_counter.sql
20260524000000_niche_post_windows.sql
20260526000000_outcomes_and_filmstrips.sql
20260526100000_add_projects.sql
20260527000000_audience_overrides.sql
```

**Latest date prefix:** `20260527000000`. Phase 6 migrations must sort AFTER this.

**Confirmed migration filenames for Phase 6 (D-09, D-28):**
- `20260530000000_script_result.sql` — adds `analysis_results.script_result JSONB`
- `20260530000001_optimal_post_override.sql` — adds `analysis_results.optimal_post_override JSONB`

Both fit after `20260527000000` with `20260530` prefix (May 30, 2026 — after research date May 28).

---

### 17. `analysis_results` table — RLS policies — VERIFIED

**Source:** `supabase/migrations/20260213000000_content_intelligence.sql` (lines 206-236), `supabase/migrations/20260527000000_audience_overrides.sql` (lines 10-11)

**Existing columns on `analysis_results`** (from original migration + additive migrations):
- Original: `id UUID PK`, `user_id`, `content_text`, `content_type`, `society_id`, `overall_score`, `confidence`, `factors JSONB`, `suggestions JSONB`, `personas JSONB`, `variants JSONB`, `insights TEXT`, `conversation_themes JSONB`, `gemini_model`, `deepseek_model`, `engine_version`, `latency_ms`, `cost_cents`, `rule_score`, `trend_score`, `ml_score`, `score_weights JSONB`, `deleted_at`, `created_at`, `updated_at`
- Additive (from later migrations): `analysis_override JSONB` (20260527), `audio_description TEXT` (Phase 6 audio migration), `content_hash`, `signal_availability JSONB`, `behavioral_predictions JSONB`, `feature_vector JSONB`, `reasoning TEXT`, `warnings JSONB`, `input_mode`, `has_video`, `gemini_score`, `ml_score`, and many more.

**RLS policies on `analysis_results` (verbatim from migration:224-236):**
```sql
CREATE POLICY "Users can view their own non-deleted analysis results"
  ON analysis_results FOR SELECT
  USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own analysis results"
  ON analysis_results FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own analysis results"
  ON analysis_results FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```

**RLS implication for Phase 6:**
- `script_result` WRITE: service-client bypasses RLS entirely. No policy change needed.
- `optimal_post_override` WRITE: `POST /optimal-post-override` uses user-scoped client. The existing `"Users can update their own analysis results"` policy already permits authenticated user to UPDATE rows where `user_id = auth.uid()`. **No new RLS policy needed for either new column.**
- Phase 6 migrations need only `ADD COLUMN IF NOT EXISTS` — no policy changes.

---

### 18. `reasoning` field — markdown? — VERIFIED

**Source:** `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` (lines 207, 396-413)

Test fixture at line 207:
```typescript
reasoning: "Full untruncated DeepSeek reasoning about hook analysis, persona simulation, and content scoring with no artificial cutoff."
```

Test 9 at lines 396-413 passes a 2000-char string of `"A".repeat(2000)` — plain ASCII, no markdown.

The prompt builder at stage11-counterfactuals-prompts.ts does NOT generate `reasoning` — it reads it. DeepSeek generates `reasoning` as its chain-of-thought; this is structured plain prose per DeepSeek's output format.

**Ruling:** `reasoning` is plain prose (no markdown headers, no bold, no bullets). The CONTEXT.md D-05 strip pattern `replace(/(\*\*|__|`)/g, '')` is a defensive measure — keep it as a 1-line regex strip before concatenation, but expect it never to fire in practice.

**Implementation:**
```typescript
const cleanReasoning = (reasoning ?? '').replace(/\*\*|__|`/g, '').trim();
```

---

### 19. `creator_profiles.niche_primary` access path — VERIFIED

**Source:** `src/hooks/queries/use-creator-profile.ts` (lines 17-68), `src/types/database.types.ts` (line 613)

`use-creator-profile.ts` already has a hook `useCreatorProfile()` that returns `{ niche_primary: string | null, ... }` via GET `/api/profile/creator-profile`. `staleTime: 5 * 60 * 1000`.

**For D-29 source-pill tooltip:** The script endpoint response could include `niche_primary` by joining `creator_profiles` on the server — but that adds a second DB query to the endpoint. Cheaper: the `optimal_post_window.reasoning` string already encodes the niche in free-form text (e.g., `"Your fitness niche peaks Tue 18:00-21:00 UTC (n=12 videos)"`). The client extracts it via regex.

**Cheapest path:**
1. Parse niche from `optimal_post_window.reasoning` on client: regex `/Your (\w+) niche/i`.
2. For `n=` count: regex `/\(n=(\d+)/`.
3. If either fails, omit from tooltip — graceful degrade.
4. Do NOT add `niche_primary` fetch to the script endpoint. The `useCreatorProfile()` hook already caches it — components can consume both hooks.

**But simplest:** Tooltip text can just be "Based on videos in your niche" without embedding `niche_primary` by name — avoids any parsing fragility. Reserve `niche_primary` display for when `useCreatorProfile()` is already mounted (e.g., if the board page already calls it — check before adding a new fetch).

---

### 20. `Intl.DateTimeFormat.formatRange` browser support — VERIFIED

**Source:** [CITED: MDN Web Docs — Intl.DateTimeFormat.prototype.formatRange()]

`Intl.DateTimeFormat.prototype.formatRange()` support:
- Chrome 76+ (released July 2019)
- Safari 14.1+ (released April 2021)
- Firefox 91+ (released August 2021)
- Edge 79+ (Chromium-based, January 2020)

Virtuna's browser targets: Next.js 16 defaults to modern-evergreen browsers. No explicit `browserslist` in project (not found in package.json or .browserslistrc). Next.js default targets cover the above baselines safely.

**Ruling:** `Intl.DateTimeFormat.formatRange()` is safe to use without polyfill. For the hour-range edge case (AM/PM crossing), use:
```typescript
const dtf = new Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: true, timeZone: userTz });
const start = new Date(`2000-01-01T${padHour(hourStart)}:00:00Z`);
const end = new Date(`2000-01-01T${padHour(hourEnd)}:00:00Z`);
const formatted = dtf.formatRange(start, end);
// e.g., "6–9 PM" or "11 AM – 1 PM"
```

When `formatRange` spans AM/PM boundary, it produces full labels on both ends automatically.

---

### 21. Validation tests / test runner — VERIFIED

**Source:** `vitest.config.ts` (lines 1-30), `.planning/codebase/STACK.md` (line 78-80), `src/app/api/analyze/[id]/override/__tests__/route.test.ts`

- **Test runner:** Vitest 4.x (`@vitest/coverage-v8 4.0.18`).
- **Config:** `vitest.config.ts` in project root.
- **Quick run:** `npx vitest run src/app/api/analyze/[id]/script/` (directory-scoped).
- **Full suite:** `npx vitest run` or `npm test`.
- **Environment:** Default `node`; component tests use `/** @vitest-environment happy-dom */` pragma.
- **Test include pattern:** `"src/**/*.test.ts"`, `"src/**/*.test.tsx"`.

**Existing test pattern from `override/__tests__/route.test.ts`:**
- Mock `@/lib/supabase/server` via `vi.mock()` before importing route.
- Helper functions: `createMockClient()` + `makeRequest()`.
- Tests: 401 auth, 400 invalid JSON, 400 Zod rejection, 200 success, 500 DB error.
- Pattern: `vi.mocked(createClient).mockResolvedValue(client as ...)`.

No existing `comparisons/route.test.ts` — Phase 6 `/script` endpoint is the first with a co-located route test in this directory pattern.

---

### 22. `use-analysis-stream.ts` phase enum — VERIFIED

**Source:** `src/hooks/queries/use-analysis-stream.ts` (lines 36-42)

```typescript
export type AnalysisStreamPhase =
  | "idle"
  | "analyzing"
  | "reconnecting"
  | "polling"
  | "complete"
  | "error";
```

**D-35 enable flag for `useScript`:**
```typescript
enabled: !!analysisId && phase === 'complete'
```

This is exact — `'complete'` is the correct string. Note: `'reconnecting'` is a valid in-progress state (not complete). The hook should NOT fetch during `reconnecting` — the enable flag correctly excludes it.

**D-36 optimal-post renders on partial:** The `partial` state from `useAnalysisStream` is `PartialStreamState` = `{ personas: PerPersonaPartial[] }`. `optimal_post_window` is NOT on `partial` — it's on `result: PredictionResult | null`. The optimal-post panel must wait for `result !== null` (available when phase === 'complete') to render the window. Render skeleton when `result === null`. The CONTEXT.md D-36 claim that "engine emits `optimal_post_window` early" is true in the engine pipeline, but the SSE consumer only exposes it via the terminal `complete` event result. So D-36 simplifies to: render skeleton until `result !== null`, then show `result.optimal_post_window`.

---

### 23. Existing `/script` and `/optimal-post-override` endpoints — VERIFIED

**Source:** `find src/app/api/analyze -type f` — full directory listing confirmed.

Existing files under `src/app/api/analyze/`:
- `route.ts` — main analyze POST
- `[id]/comparisons/route.ts`
- `[id]/override/route.ts`
- `[id]/stream/route.ts`
- `__tests__/` (3 test files)
- `[id]/override/__tests__/route.test.ts`

**Confirmed:** Neither `src/app/api/analyze/[id]/script/route.ts` nor `src/app/api/analyze/[id]/optimal-post-override/route.ts` exists. Phase 6 creates both from scratch.

---

### 24. `board-store` boardState selector — VERIFIED

**Source:** `src/stores/board-store.ts` (lines 24-29, 142, 157-163)

```typescript
export type BoardMachineState =
  | 'idle'
  | 'streaming'
  | 'complete'
  | 'anti-virality'
  | 'edit-input';
```

**Phase 6 usage pattern (D-37):**
```typescript
const boardMachineState = useBoardStore((s) => s.boardState);
const avState = getFrameAntiViralityState('actions', boardMachineState);
const isAV = avState === 'anti-virality';
```

This is already live in `ActionsNode.tsx` lines 21-23 — Phase 6 inherits unchanged. No new state additions needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/app/api/analyze/\\[id\\]/script/` |
| Full suite command | `npm test` or `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R5.1 | Script endpoint — cache hit returns fast | integration | `npx vitest run src/app/api/analyze/\\[id\\]/script/__tests__/` | Wave 0 |
| R5.1 | Script endpoint — cache miss computes + writes | integration | same | Wave 0 |
| R5.1 | Script endpoint — auth 401 | integration | same | Wave 0 |
| R5.1 | Script endpoint — invalid id 400 | integration | same | Wave 0 |
| R5.1 | Script endpoint — wrong-owner 404 | integration | same | Wave 0 |
| R5.1 | Script endpoint — engine_version skew recomputes | integration | same | Wave 0 |
| R5.1 | Script endpoint — empty analysis_results SELECT | integration | same | Wave 0 |
| R5.2 | ScriptBody renders 4 sections | component | `npx vitest run src/components/board/actions/script/__tests__/` | Wave 0 |
| R5.2 | CopyButton fires telemetry + clipboard write | component | same | Wave 0 |
| R5.3 | ScriptEmptyState renders with opening_variants | component | same | Wave 0 |
| R5.3 | is_empty_state=true path — endpoint logic | integration | script endpoint tests | Wave 0 |
| R6.2 | OptimalPostCard renders UTC→userTZ conversion | unit | `npx vitest run src/lib/optimal-post-time.test.ts` | Wave 0 |
| R6.2 | Override endpoint — Zod rejection 400 | integration | `npx vitest run src/app/api/analyze/\\[id\\]/optimal-post-override/__tests__/` | Wave 0 |
| R6.2 | Override endpoint — auth 401 | integration | same | Wave 0 |
| R6.2 | Override endpoint — write success 200 | integration | same | Wave 0 |
| NF2 | ActionsNode testid updates — no regressions | component | `npx vitest run src/components/board/actions/__tests__/ActionsNode.test.tsx` | ✅ exists — needs update |

### Endpoint Integration Tests (script endpoint)

Mirror `override/__tests__/route.test.ts` pattern exactly. Test matrix:

1. **Cache hit** — `script_result` IS NOT NULL in mock row → returns parsed result immediately, no transformation.
2. **Cache miss — low band** — `script_result` IS NULL, `band='low'`, 3 fix suggestions → returns full script with opening_line, scene_order, voiceover, captions.
3. **Cache miss — high band (empty state)** — `confidence_label='HIGH'`, `anti_virality_gated=false`, `band='high'` → returns `is_empty_state: true` with opening_variants.
4. **Cache miss — AV state** — `anti_virality_gated=true` → returns full script (NOT empty state).
5. **Auth failure** — `user = null` → 401.
6. **Invalid id** — `id='../../../etc'` → 400 `invalid_id`.
7. **RLS bypass attempt** — wrong owner (user_id mismatch) → 404 (return null from SELECT).
8. **Missing analysis** — row not found → 404.
9. **Engine version skew** — `script_result.engine_version !== row.engine_version` → force recompute.
10. **Service-client write failure** — UPDATE errors are swallowed, response still 200.

### Override Endpoint Tests

Mirror `override/__tests__/route.test.ts` directly:

1. **Zod rejection** — invalid `day_of_week` → 400.
2. **Zod rejection** — `hour_range[1] <= hour_range[0]` → 400.
3. **Auth** — no user → 401.
4. **Write success** → 200 `{ ok: true }`.
5. **DB error** → 500 `override_write_failed`.
6. **XSS guard** — error response never echoes raw input.

### Component Tests

Use `/** @vitest-environment happy-dom */` pragma.

1. **ScriptBody** — renders 4 section headings + content strings, fires `onCopySection` callback when copy button clicked.
2. **ScriptEmptyState** — renders "Your video is solid" + opening_variants chips, fires copy callbacks.
3. **ScriptInspectorTrigger** — shows compact teaser, Sheet opens on click, renders ScriptBody inside.
4. **OptimalPostCard** — renders day + hour range formatted in user TZ, renders reasoning string truncated, shows source pill.
5. **OptimalPostEditSheet** — day picker renders 7 pills, Save button fires mutation, Reset link fires reset.
6. **OptimalPostSourcePill** — renders "from your niche" / "default" / "yours" labels per source prop.

### TZ Conversion Unit Tests (src/lib/optimal-post-time.test.ts)

```typescript
// Test matrix for convertUTCWindow(day, hourRange, userTz):
// 1. UTC → America/Los_Angeles (PST = UTC-8): Tue [18,21] → Tue 10AM-1PM
// 2. UTC → Asia/Tokyo (JST = UTC+9): Tue [18,21] → Wed 3AM-6AM (midnight crossing)
// 3. UTC → Europe/London (BST = UTC+1): Tue [18,21] → Tue 7PM-10PM
// 4. formatRange edge case: span crosses AM/PM boundary → "11 AM – 1 PM"
// 5. formatRange same period: both PM → "6–9 PM"
// 6. Midnight crossing day correction: UTC Tue 23 → Wed in user TZ
```

### A11y Tests

Component tests validate:
- Script copy buttons: `Tab` navigable, `Enter` triggers copy.
- Day picker: `role="radiogroup"`, arrow keys navigate pills.
- Sheet: focus trapped inside (Radix guarantee), Esc closes.
- `aria-live="polite"` announcements: "Reshoot script ready — 4 sections." fires on first render.

### Telemetry Assertion Tests

Unit tests for telemetry side-effects:
- `script_empty_state_shown` fires once per analysis render (useRef guard).
- `optimal_post_tz_converted` fires once with `crossed_midnight: boolean`.
- `script_section_copied` fires with correct `section` enum value.

### Wave 0 Gaps

- [ ] `src/app/api/analyze/[id]/script/__tests__/route.test.ts` — endpoint integration tests
- [ ] `src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts` — override endpoint tests
- [ ] `src/components/board/actions/script/__tests__/ScriptBody.test.tsx`
- [ ] `src/components/board/actions/script/__tests__/ScriptEmptyState.test.tsx`
- [ ] `src/components/board/actions/optimal-post/__tests__/OptimalPostCard.test.tsx`
- [ ] `src/lib/optimal-post-time.test.ts` — TZ conversion + formatRange
- [ ] Update `src/components/board/actions/__tests__/ActionsNode.test.tsx` lines 86, 94, 95, 106

---

## Surprises / Deviations from CONTEXT.md

### S-1: `heatmap` NOT persisted to `analysis_results`

**CONTEXT.md D-04** assumes `dropoff_segment_indices` can be mapped to timestamps via `heatmap.segments[].t_start`. **Finding:** `heatmap` is not in the `buildInsertRow` INSERT payload (`analyze/route.ts:266-320`). It's available during the SSE stream but not stored. The script endpoint can only read what's in the `analysis_results` row.

**Impact:** D-04 dropoff-segment prioritization MUST use the fallback (sort `timestamp_ms` ASC). The heuristic of "prioritize suggestions in dropoff zones" is unavailable server-side without a schema change.

**Planner action:** Remove the segment-lookup branch from D-04. Only implement: filter `type === 'fix'`, sort `timestamp_ms` ASC, cap at 6 items.

### S-2: `ActionsOptimalPostSlot` has no outer div wrapper

**CONTEXT.md O-1** says "Phase 6 keeps the wrapper component name + filename + testid and swaps the child." But `ActionsOptimalPostSlot.tsx` has NO outer div — it returns `<PlaceholderCard>` directly. There is no outer element carrying a stable testid for Phase 6 to preserve.

**Impact:** Phase 6 must add an outer `<div data-testid="actions-optimal-post-slot">` wrapper when refactoring this component, making it match `ActionsReshootHeroSlot`'s structure (which DOES have an outer div with testid).

**Planner action:** Phase 6 wraps `ActionsOptimalPostSlot` content in `<div data-testid="actions-optimal-post-slot">` — minor wrapper addition, not a design change.

### S-3: `populatePredictionCache` is L1-only — L2 write uses a different pattern

**CONTEXT.md D-08** says "Mirrors `prediction-cache.ts:populatePredictionCache` pattern." But `populatePredictionCache` only writes to L1 in-memory — the L2 (`analysis_results`) write is done by the main `analyze/route.ts` INSERT. Phase 6's `script_result` write-through is an UPDATE on an existing row, which is structurally different.

**Impact:** Phase 6 uses `createServiceClient().from('analysis_results').update(...)` directly — NOT `populatePredictionCache`. The "mirrors the spirit" phrasing in CONTEXT.md is accurate; the literal function cannot be reused.

**Planner action:** D-08 implementation = direct service-client UPDATE fire-and-forget. Document this explicitly in the plan.

### S-4: `useCopyToClipboard` default reset delay is 2000ms, not 1500ms

**CONTEXT.md** says "Inline 'Copied!' pill replaces icon for 1.5s post-copy." The hook defaults to `resetDelay = 2000`. Phase 6 should pass `useCopyToClipboard(1500)` explicitly to get 1.5s behavior.

### S-5: `reasoning` reasoning string from `optimal_post_window` is DIFFERENT from `optimal-post.ts`

**CONTEXT.md D-29** references reasoning like "Your fitness niche peaks Tue 18:00-21:00 UTC (n=12 videos)". **Finding:** `optimal-post.ts:99` generates exactly: `"Your niche peaks ${dow} ${data.hour_start}:00-${data.hour_end}:00 UTC (n=${data.sample_size} videos)"` — note "Your niche" (no `{niche_name}`). The niche name is NOT embedded in the reasoning string.

**Impact:** Regex `/Your (\w+) niche/i` will NOT extract a niche name from this string (it says "Your niche peaks", not "Your fitness niche peaks"). The `niche_primary` from creator_profiles is the only source for the niche name in the tooltip.

**Planner action for D-29 tooltip:** Either (a) call `useCreatorProfile()` in `OptimalPostSourcePill` for `niche_primary`, or (b) simplify tooltip to "Based on {N} videos in your niche" (extracting N via `/\(n=(\d+)/`). Option (b) avoids an extra fetch.

### S-6: `comparisons` hook is colocated with verdict, NOT in `src/hooks/queries/`

**CONTEXT.md D-11** says "Mirrors `useComparisons` Phase 5 pattern (researcher confirms file path)." Confirmed: `use-comparisons.ts` is at `src/components/board/verdict/use-comparisons.ts`. Phase 6 follows the same colocation pattern: `use-script.ts` lives at `src/components/board/actions/script/use-script.ts`.

---

## Open Questions for Planner

All items resolved from codebase. No blocking unknowns remain.

One low-priority decision for planner judgment:

**Q1: `niche_primary` in D-29 source-pill tooltip**
- Option A: Call `useCreatorProfile()` in `OptimalPostSourcePill` — adds one cached query, gets exact niche name.
- Option B: Omit niche name, use "Based on {N} videos in your niche" — zero extra fetch, slightly less personalized.
- Recommendation: Option B for Phase 6 v1; upgrade to Option A when telemetry shows tooltip engagement.

---

## RESEARCH COMPLETE
