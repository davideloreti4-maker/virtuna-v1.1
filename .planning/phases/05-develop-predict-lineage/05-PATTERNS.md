# Phase 5: Develop & Predict + Lineage - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/analyze/route.ts` (modify) | route/handler | request-response + streaming | self (3 insert sites) | self |
| `src/lib/engine/types.ts` (modify `AnalysisInputSchema`) | schema/config | transform | self | self |
| `src/app/api/analysis/[id]/route.ts` (modify + add `?summary`) | route/handler | request-response | self | self |
| `src/types/database.types.ts` (modify — add `parent_id`) | model/types | n/a | self (pattern: add column to Row/Insert/Update) | self |
| `supabase/migrations/YYYYMMDD_add_parent_id.sql` (new) | migration | n/a | `20260601000000_add_mode_to_analysis_results.sql` | exact |
| `src/hooks/queries/use-analysis-stream.ts` (modify) | hook | event-driven + polling | self (completion gate ~412, ceiling ~422) | self |
| `src/components/board/adapt/AdaptConceptCard.tsx` (modify — add Develop trigger) | component | request-response | `AdaptConceptCard.tsx` self + `AdaptFrameBody.tsx` (trigger pattern) | exact |
| `src/components/board/adapt/AdaptFrameBody.tsx` (modify — plumb `analysisId` + `parent_id` down) | component | request-response | self + `src/components/board/Board.tsx` (`stream.start` + router.push) | exact |
| `src/components/sidebar/use-sidebar-queries.ts` (modify — Remix tag) | hook/query | CRUD | self | self |
| `src/components/board/decode/DecodeShellNode.tsx` (polish/error boundary) | component | event-driven | self | self |
| `src/components/board/BoardMobile.tsx` (polish/mobile sweep) | component | request-response | self | self |

---

## Pattern Assignments

### `supabase/migrations/YYYYMMDD_add_parent_id.sql` (new migration)

**Analog:** `supabase/migrations/20260601000000_add_mode_to_analysis_results.sql`

**Migration pattern** (full file):
```sql
-- Phase: Viral Remix (v3.2) — Plan 02-01
-- Adds the `mode` column to analysis_results to distinguish score vs remix submissions.
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'score' CHECK (mode IN ('score', 'remix'));

COMMENT ON COLUMN public.analysis_results.mode IS '...';
```

**Copy pattern for `parent_id`:**
- File naming convention: `YYYYMMDDHHMMSS_add_parent_id_to_analysis_results.sql`
- Use `ADD COLUMN IF NOT EXISTS`
- Column: `parent_id TEXT NULL` (nullable; FK optional — see D-59 Claude's Discretion note on FK vs plain nullable text)
- If FK: `REFERENCES public.analysis_results(id) ON DELETE SET NULL`
- Add `COMMENT ON COLUMN` with phase attribution
- No DEFAULT, no backfill — historical rows stay null (matches `20260531000000` pattern: "No backfill: historical rows keep NULL")

---

### `src/types/database.types.ts` — add `parent_id` to `analysis_results`

**Analog:** existing `mode` column addition pattern in this file (line ~208)

**Row/Insert/Update triple pattern** (lines 181–350, abridged):
```typescript
// Row block (~line 181):
Row: {
  // ...existing columns...
  mode: string           // NOT NULL with DEFAULT
  parent_id: string | null  // ADD HERE — nullable FK
  // ...
}

// Insert block (~line 234):
Insert: {
  // ...existing columns...
  mode?: string
  parent_id?: string | null  // ADD HERE — optional in insert
  // ...
}

// Update block (~line 287):
Update: {
  // ...existing columns...
  mode?: string
  parent_id?: string | null  // ADD HERE
  // ...
}
```

All three blocks must be updated in sync. Pattern: nullable columns use `type | null` in Row and `type | null` (optional `?:`) in Insert/Update.

---

### `src/lib/engine/types.ts` — extend `AnalysisInputSchema` with `parent_id`

**Analog:** existing `mode` field addition (lines 157–159)

**Existing schema pattern** (lines 135–173):
```typescript
export const AnalysisInputSchema = z
  .object({
    input_mode: z.enum(["text", "tiktok_url", "video_upload"]),
    content_text: z.string().max(10000).optional(),
    tiktok_url: z.string().url().optional(),
    video_storage_path: z.string().optional(),
    content_type: z.enum(["post", "reel", "story", "video", "thread"]),
    society_id: z.string().optional(),
    niche: z.string().optional(),
    creator_handle: z.string().optional(),
    mode: z.enum(["score", "remix"]).default("score"),
    // ADD HERE:
    parent_id: z.string().optional(),  // nullable FK to analysis_results.id
  })
  .refine(...)
  .refine(
    // Existing: !(mode === "remix" && input_mode === "text")
    // Develop submits input_mode='text' with mode='score' so no new refine needed
  );
```

`parent_id` is `z.string().optional()` — not required, not nullable (absent = no parent). No new `.refine()` needed: Develop always sends `mode='score'` + `input_mode='text'`.

---

### `src/app/api/analyze/route.ts` — thread `parent_id` at three insert sites

**Analog:** `mode` field threading (same file; pattern repeated at all 3 sites)

**Site 1 — `buildInsertRow()` definition** (lines 500–584):
```typescript
const buildInsertRow = (
  finalResult: PredictionResult,
  _ruleContributions: Array<Record<string, unknown>>
) => ({
  user_id: user.id,
  content_text: validated.content_text ?? "",
  content_type: validated.content_type,
  mode: validated.mode,               // existing — pattern to copy
  // ADD:
  parent_id: validated.parent_id ?? null,
  // ...rest of fields unchanged
});
```

`validated.parent_id` comes from `AnalysisInputSchema` parse at the top of the handler. The cast from `validated` is already typed as `AnalysisInput = z.infer<typeof AnalysisInputSchema>`.

**Site 2 — JSON-branch INSERT** (line 629):
```typescript
const { error: insertError } = await service
  .from("analysis_results")
  .insert({ ...buildInsertRow(finalResult, ruleContributions), id: jsonInsertId });
// parent_id flows through buildInsertRow — no additional change here
```

**Site 3 — SSE-branch placeholder INSERT** (lines 681–701):
```typescript
const { error: placeholderError } = await service
  .from("analysis_results")
  .insert({
    id: analysisId,
    user_id: user.id,
    content_text: validated.content_text ?? "",
    content_type: validated.content_type,
    mode: validated.mode,             // existing — pattern to copy
    // ADD:
    parent_id: validated.parent_id ?? null,
    overall_score: null,              // sentinel: marks row in-flight
    // ...rest of sentinel fields unchanged
  });
```

**Site 4 — SSE-branch UPSERT** (line 836):
```typescript
const { error: insertError } = await service
  .from("analysis_results")
  .upsert(
    { ...buildInsertRow(finalResult, ruleContributions), id: analysisId },
    { onConflict: "id" }
  );
// parent_id flows through buildInsertRow — no additional change here
```

---

### `src/app/api/analysis/[id]/route.ts` — add `?summary` param

**Analog:** existing GET handler structure (lines 10–178)

**Auth pattern** (lines 13–24):
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Query pattern** (lines 25–38):
```typescript
const { data, error } = await supabase
  .from("analysis_results")
  .select("*")
  .eq("id", id)
  .eq("user_id", user.id)
  .is("deleted_at", null)
  .single();

if (error || !data) {
  return Response.json({ error: "Analysis not found" }, { status: 404 });
}
```

**Add `?summary` branch** — insert BEFORE the existing enrichment block:
```typescript
const url = new URL(_request.url);
if (url.searchParams.has("summary")) {
  // Minimal parent summary for the "remixed from" chip (D-10).
  // Returns id + caption/handle identifier + created_at only — NOT the full row.
  return Response.json({
    id: data.id,
    caption: (data.content_text ?? "").slice(0, 120) || null,
    created_at: data.created_at,
  });
}
// ...existing enrichment block continues unchanged
```

`_request` param already exists in the function signature — change from `_request: Request` to `request: Request` to access `.url`. The summary shape (`id`, `caption`, `created_at`) is Claude's discretion per D-10.

**Error handling pattern** (lines 175–178):
```typescript
} catch (error) {
  console.error("[analysis/id] GET error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
```

---

### `src/hooks/queries/use-analysis-stream.ts` — completion gate + ceiling lift

**Analog:** self (lines 411–432)

**Completion gate** (lines 411–420 — current):
```typescript
useEffect(() => {
  if (pollQuery.data?.overall_score != null) {
    setResult(pollQuery.data as PredictionResult);
    setPhase("complete");
    if (analysisId) {
      queryClient.setQueryData(queryKeys.analysis.detail(analysisId), pollQuery.data);
    }
  }
}, [pollQuery.data, analysisId, queryClient]);
```

**Modified gate — add `variants.remix != null` check (D-13, m3 fix):**
```typescript
useEffect(() => {
  const d = pollQuery.data;
  const isScoreComplete = d?.overall_score != null;
  const isRemixComplete =
    (d as { variants?: { remix?: unknown } } | undefined)?.variants?.remix != null;
  if (isScoreComplete || isRemixComplete) {
    setResult(d as PredictionResult);
    setPhase("complete");
    if (analysisId) {
      queryClient.setQueryData(queryKeys.analysis.detail(analysisId), d);
    }
  }
}, [pollQuery.data, analysisId, queryClient]);
```

**Ceiling lift** (lines 422–432 — current, 90_000ms):
```typescript
useEffect(() => {
  if (phase !== "polling") return;
  const t = setTimeout(() => {
    if (phaseRef.current === "polling") {
      setError("Stream timed out — analysis still running");
      setPhase("error");
    }
  }, 90_000);
  return () => clearTimeout(t);
}, [phase]);
```

**Modified ceiling — lift to 360s for developed children (D-13):**
The hook doesn't know whether the current row is a developed child. Two options — prefer the simpler one: always lift the ceiling to 360s (developed children run the full ~90–332s pipeline; the old 90s ceiling was already causing false timeouts on long analyses). If mode discrimination is needed, read `initialData?.mode` — but since `initialData` is already in scope, check `initialData?.parent_id != null` once the column exists.

```typescript
// Lift ceiling from 90s → 360s to accommodate developed-child full pipeline runs (D-13).
const POLLING_CEILING_MS = 360_000;
// Replace 90_000 with POLLING_CEILING_MS in the setTimeout above.
```

---

### `src/components/board/adapt/AdaptConceptCard.tsx` — add "Develop & predict →" trigger

**Analog:** `AdaptConceptCard.tsx` self (lines 24–57) + `AdaptFrameBody.tsx` `handleGenerateWithNiche` trigger pattern

**Existing card anatomy** (lines 24–57):
```typescript
export function AdaptConceptCard({ concept }: AdaptConceptCardProps) {
  return (
    <article
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-transparent p-4',
        'hover:bg-white/[0.02]',
      )}
      style={{ boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset' }}
    >
      {/* 1. Hook headline */}
      <p className="text-base font-semibold text-foreground">{concept.hook}</p>
      {/* 2. format_borrowed chip */}
      <span className="inline-flex w-fit text-xs font-medium text-accent bg-accent/[0.12] rounded-full px-2 py-0.5">
        Borrowed: {concept.format_borrowed}
      </span>
      {/* 3. Divider */}
      <div className="border-t border-white/[0.04]" />
      {/* 4. Angle + 5. Who it's for rows */}
      ...
    </article>
  );
}
```

**Extended props — add `onDevelop` callback:**
```typescript
interface AdaptConceptCardProps {
  concept: AdaptConcept;
  onDevelop?: () => void;    // ADD: fires Develop & predict for this concept
  isPending?: boolean;       // ADD: disables trigger while stream is starting
}
```

**Develop trigger placement — after "Who it's for" row, above closing `</article>`:**
```typescript
{/* Develop trigger — Raycast secondary button, full-width, bottom of card */}
{onDevelop && (
  <>
    <div className="border-t border-white/[0.04]" />
    <button
      type="button"
      onClick={onDevelop}
      disabled={isPending}
      className={cn(
        'w-full text-left text-xs font-medium text-white/55',
        'flex items-center justify-between',
        'hover:text-foreground transition-colors',
        isPending && 'opacity-40 pointer-events-none',
      )}
    >
      Develop &amp; predict
      <span className="text-white/30">→</span>
    </button>
  </>
)}
```

Raycast rules: no colored button for secondary action, no border change on hover, `text-white/55` → `text-foreground` on hover only. Arrow `→` as plain text (no icon dep). Full-width tap target per mobile-card-stack requirement.

---

### `src/components/board/adapt/AdaptFrameBody.tsx` — plumb `parent_id` + wire Develop

**Analog:** `Board.tsx` `router.push` + `stream.start` pattern (lines 297–305, 307–350)

**Board.tsx navigation pattern** (lines 297–305):
```typescript
const router = useRouter();
const prevAnalysisIdRef = useRef<string | null>(stream.analysisId);
useEffect(() => {
  const id = stream.analysisId;
  if (id && prevAnalysisIdRef.current === null) {
    router.push(`/analyze/${id}`);
  }
  prevAnalysisIdRef.current = id;
}, [stream.analysisId, router]);
```

**Board.tsx `stream.start` pattern** (lines 329–350, abridged):
```typescript
stream.start({
  input_mode: 'text',
  content_text: data.content_text,
  content_type: 'video',
  mode: 'score',
});
```

**AdaptFrameBody additions:**

1. `analysisId` already sourced from `usePermalinkAnalysis` (line 59) — this is the `parent_id` for Develop requests.

2. Import and use `useAnalysisStream` child instance for the Develop stream:
```typescript
// Develop stream — separate from the remix stream already on line 60
import { useRouter } from 'next/navigation';

const router = useRouter();
const developStream = useAnalysisStream({ initialData: null });
const developPrevIdRef = useRef<string | null>(null);

// Navigate on started (D-01 pattern — identical to Board.tsx lines 299–305)
useEffect(() => {
  const id = developStream.analysisId;
  if (id && developPrevIdRef.current === null) {
    router.push(`/analyze/${id}`);
  }
  developPrevIdRef.current = id;
}, [developStream.analysisId, router]);
```

3. Per-concept handler — assemble `content_text` brief (D-04/D-05) and start stream:
```typescript
const handleDevelop = useCallback((concept: AdaptConcept) => {
  if (!analysisId) return;
  // D-04: brief = hook + angle + format_borrowed (full concept context)
  // D-05: label = concept.hook (recognizable in Recent list)
  const brief = [
    concept.hook,
    concept.angle,
    `Format: ${concept.format_borrowed}`,
  ].join('\n\n');

  developStream.start({
    input_mode: 'text',
    content_text: brief,
    content_type: 'video',
    mode: 'score',          // D-06: child is a standard scored analysis
    parent_id: analysisId,  // D-07: source remix analysis id
  });
}, [analysisId, developStream]);
```

4. Pass down to concept cards:
```typescript
// In the success render block (line 232–245):
{adapt.map((concept, i) => (
  <AdaptConceptCard
    key={i}
    concept={concept}
    onDevelop={() => handleDevelop(concept)}
    isPending={developStream.phase === 'analyzing' || developStream.phase === 'reconnecting'}
  />
))}
```

---

### `src/components/sidebar/use-sidebar-queries.ts` — Remix tag (D-11)

**Analog:** self (lines 12–44)

**Existing `SidebarAnalysis` shape** (lines 12–16):
```typescript
export interface SidebarAnalysis {
  id: string;
  title: string | null;
}
```

**Extended shape — add `isRemix` flag:**
```typescript
export interface SidebarAnalysis {
  id: string;
  title: string | null;
  isRemix: boolean;  // ADD: true when overall_score == null && variants.remix != null (D-11/D-12)
}
```

**Existing projection** (lines 31–38):
```typescript
const rows: SidebarAnalysis[] = Array.isArray(history.data)
  ? (history.data as Array<{ id: string; content_text?: string | null }>).slice(0, 3).map(
      (row) => ({
        id: row.id,
        title: row.content_text ? row.content_text.slice(0, 80) : null,
      }),
    )
  : [];
```

**Extended projection:**
```typescript
const rows: SidebarAnalysis[] = Array.isArray(history.data)
  ? (history.data as Array<{
      id: string;
      content_text?: string | null;
      overall_score?: number | null;
      variants?: { remix?: unknown } | null;
    }>).slice(0, 3).map((row) => ({
      id: row.id,
      title: row.content_text ? row.content_text.slice(0, 80) : null,
      // Remix rows have null overall_score + non-null variants.remix (m3 completion marker)
      isRemix: row.overall_score == null && row.variants?.remix != null,
    }))
  : [];
```

The Remix tag render is in whatever component consumes `SidebarAnalysis` — check the InputDrawer / CommandBar for where `.title` is rendered and add a small "Remix" badge when `isRemix` is true. Raycast badge: `text-[10px] text-white/45 uppercase tracking-widest` or a `rounded-full bg-white/[0.06] px-1.5 py-0.5` pill.

---

### `src/components/board/decode/DecodeShellNode.tsx` — polish / error boundary sweep (D-14)

**Analog:** self (complete file, 207 lines)

Current implementation is complete (Phase 3). Phase 5 polish scope:
- Error boundary: `DecodeErrorState()` already exists (lines 60–74). Wrap `<DecodeShellNode>` mount in an `<ErrorBoundary>` at the call site in `Board.tsx` and `BoardMobile.tsx` if not already done.
- Mobile: renders in `MOBILE_ORDER_REMIX` at position 1 (BoardMobile.tsx line 38) — verify `data-testid="decode-shell"` is visible and scrollable in the card stack.
- Grade-mode regression: confirm `DecodeShellNode` is NOT rendered when `boardMode === 'score'` (it's only mounted in the remix branch in Board.tsx and BoardMobile.tsx).

**Existing `isDecoding` guard pattern** (lines 172–190) — copy for any new loading states:
```typescript
const isDecoding =
  phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

// m3 dual-read pattern — direct permalink fallback for null-score rows:
const decode: DecodeResult | null =
  row?.variants?.remix?.decode ??
  (permalinkData as { variants?: { remix?: { decode?: DecodeResult } } } | null)
    ?.variants?.remix?.decode ??
  null;
```

---

### `src/components/board/BoardMobile.tsx` — mobile card-stack sweep (D-14)

**Analog:** self (lines 1–60+)

Key patterns already in place:
- `MOBILE_ORDER_REMIX` (lines 37–44) includes `'decode'` and `'adapt'`
- `MOBILE_LABELS` fallback (lines 49–53) covers `decode`/`adapt`
- `CARD_CAMERA` sentinel (line 20) passed to `AdaptShellNode`

Phase 5 sweep scope:
- Verify `AdaptConceptCard` Develop trigger is tappable at full width on mobile (≥44px tap target)
- Confirm `AdaptShellNode` receives `camera={CARD_CAMERA}` (already the pattern from Desktop via GroupFrame — check `BoardMobile`'s `MobileFrameCard` rendering for adapt frame)
- Verify no `pointer-events-none` or `overflow-hidden` on mobile card stack cuts off the Develop button

---

## Shared Patterns

### Authentication (all API routes)
**Source:** `src/app/api/analysis/[id]/route.ts` lines 13–24
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Error handling (all API routes)
**Source:** `src/app/api/analysis/[id]/route.ts` lines 175–178
```typescript
} catch (error) {
  console.error("[analysis/id] GET error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
```

### Supabase row shape — nullable JSON cast
**Source:** `src/app/api/analyze/route.ts` lines 510–584 (`buildInsertRow`)
```typescript
// Structural Json cast pattern — use for any new Json column:
parent_id: validated.parent_id ?? null,          // plain string — no cast needed
// For typed objects narrower than Json:
someField: (finalResult.someField ?? null) as unknown as Json,
```

### Raycast card anatomy (concept cards)
**Source:** `src/components/board/adapt/AdaptConceptCard.tsx` lines 24–57
```typescript
// Card container:
className="relative flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-transparent p-4 hover:bg-white/[0.02]"
style={{ boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset' }}

// Section divider within card:
<div className="border-t border-white/[0.04]" />

// Muted label row:
<span className="text-xs font-medium text-white/45 uppercase tracking-widest">Label</span>

// Accent chip (coral):
className="inline-flex w-fit text-xs font-medium text-accent bg-accent/[0.12] rounded-full px-2 py-0.5"
```

### Dual-read (persisted + live stream) pattern
**Source:** `src/components/board/adapt/AdaptFrameBody.tsx` lines 57–70
```typescript
const { data: permalinkData, id: analysisId } = usePermalinkAnalysis();
const stream = useAnalysisStream({ initialData: permalinkData ?? null });
const row = stream.result as unknown as AdaptRow | null;
const persistedAdapt = (row?.variants?.remix?.adapt ?? null) as AdaptConcept[] | null;
const [liveAdaptConcepts, setLiveAdaptConcepts] = useState<AdaptConcept[] | null>(null);
const adapt: AdaptConcept[] | null = persistedAdapt ?? liveAdaptConcepts;
```
Apply to "remixed from" chip: derive from `permalinkData` (already loaded), not a separate fetch for the source parent (separate `?summary` call only needed for getting parent row, not current row).

### Already-fired guard (prevent re-runs on permalink reload)
**Source:** `src/components/board/adapt/AdaptFrameBody.tsx` lines 93–97
```typescript
const adaptFiredRef = useRef(false);
if (persistedAdapt && !adaptFiredRef.current) {
  adaptFiredRef.current = true;
}
```
Apply same pattern to `developStream` — once a Develop stream has started (child id known), don't restart on re-render.

---

## No Analog Found

No files are truly novel — all have exact or role-match analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/app/api/analyze/`, `src/app/api/analysis/`, `src/lib/engine/types.ts`, `src/lib/engine/remix/decode-types.ts`, `src/types/database.types.ts`, `supabase/migrations/`, `src/hooks/queries/`, `src/components/board/adapt/`, `src/components/board/decode/`, `src/components/board/BoardMobile.tsx`, `src/components/sidebar/`
**Files scanned:** 15
**Pattern extraction date:** 2026-06-02
