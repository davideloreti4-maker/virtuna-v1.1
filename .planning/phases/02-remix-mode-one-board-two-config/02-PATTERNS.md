# Phase 2: Remix Mode + One-Board-Two-Config - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 12 (2 new components + 1 new migration + 9 edits)
**Analogs found:** 12 / 12 (every new file has a direct in-repo analog)

> RESEARCH.md already named every integration point and read it this session. This map adds the concrete excerpts (with line numbers) the planner copies from. **The single load-bearing correction stands: Decode/Adapt shells are DOM components (clone `VerdictNode`), NOT Konva `<Text>`/`<Rect>`. The UI-SPEC §3/§4 "Konva-renderable spec" is visual intent only.**

---

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `src/components/board/decode/DecodeShellNode.tsx` | NEW | component (board frame node) | static / request-response (none this phase) | `src/components/board/verdict/VerdictNode.tsx` | role-match (static shell vs data node) |
| `src/components/board/adapt/AdaptShellNode.tsx` | NEW | component (board frame node) | static | `DecodeShellNode` (sibling) / `VerdictNode` | exact (clone of Decode) |
| `supabase/migrations/202606XXXXXX_add_mode_to_analysis_results.sql` | NEW | migration | DDL ADD COLUMN + default backfill | `20260528113615_add_heatmap_to_analysis_results.sql` | exact (additive ALTER) |
| `src/components/board/board-types.ts` | edit | types | n/a | self (`GroupId` / `CameraPresetKey` unions) | exact |
| `src/components/board/board-constants.ts` | edit | config (layout resolver) | transform (pure fn) | self (`resolveBoardLayout`, `computePresetTargets`) | exact |
| `src/components/board/Board.tsx` | edit | component (canvas host) | request-response + render dispatch | self (overlay dispatch 470-484, `handleContentSubmit` 282-312) | exact |
| `src/components/board/BoardMobile.tsx` | edit | component (card stack) | render dispatch | self (`MOBILE_ORDER` 24-31, `renderBody` 81-107) | exact |
| `src/components/app/content-form.tsx` | edit | component (form) | event-driven (controlled state) | self (`MODE_CONFIG`, `handleTabChange`, `ContentFormData`) | exact |
| `src/hooks/queries/use-analysis-stream.ts` | edit | hook | request-response (POST payload) | self (`AnalysisStreamInput` 59-68) | exact |
| `src/lib/engine/types.ts` | edit | model (Zod schema) | validation | self (`AnalysisInputSchema` 135-165) | exact |
| `src/lib/engine/cache/prediction-cache.ts` | edit | service (hash builder) | transform (SHA-256) | self (`computeContentHash` 31-48) | exact |
| `src/app/api/analyze/route.ts` | edit | route (API boundary) | CRUD (validate + persist) | self (`buildInsertRow` 402, placeholder INSERT 585) | exact |
| `src/types/database.types.ts` | edit | model (generated artifact) | n/a | self (`analysis_results` Row/Insert/Update) | exact |

> `src/app/api/analysis/[id]/route.ts` requires **NO edit**: it uses `select("*")` (line 28) and spreads `...data` into `enriched` (line 154), so the new `mode` column flows through the permalink read automatically.

---

## Pattern Assignments

### `src/components/board/decode/DecodeShellNode.tsx` (NEW — DOM shell, clone of VerdictNode shape)

**Analog:** `src/components/board/verdict/VerdictNode.tsx` (the *shape*: a `<div>` returning JSX, rendered as a child of `GroupFrameOverlay`).

**Critical:** The title-bar label is already rendered by `GroupFrameOverlay` from `layout.label` — see `GroupFrameOverlay.tsx:157`:
```tsx
<span className="text-xs font-semibold text-foreground">{layout.label}</span>
```
So the shell body needs **only the descriptor `<p>`** (do not repeat the "Decode" label). This resolves RESEARCH Open Question 2 / Assumption A1: the overlay HAS a title bar; the shell is the descriptor alone.

**Node root shape to copy** (VerdictNode.tsx:84-89):
```tsx
return (
  <div
    aria-busy={isStreaming}
    className="relative flex w-full flex-col gap-4"
    data-testid="verdict-node"
  >
```

**Descriptor styling** — map UI-SPEC §3 Konva values to DOM. The `text-white/35` + `text-xs leading-[1.4]` idiom is verified against the existing empty-state DOM (`GroupFrameOverlay.tsx:196`: `text-xs leading-snug text-foreground-muted`) and the FrameHero label idiom. Recommended shell (≈12 lines):
```tsx
export function DecodeShellNode() {
  return (
    <div className="relative flex w-full flex-col gap-2" data-testid="decode-shell">
      <p className="max-w-[44ch] text-xs leading-[1.4] text-white/35">
        Structural breakdown of why this video worked.
      </p>
    </div>
  );
}
```
Descriptor copy is locked default from UI-SPEC §Copywriting (D-11 neutral, no date).

**Anti-pattern (RESEARCH Pitfall 1):** Do NOT write `<Text>`/`<Rect>` Konva nodes. Konva children inside the `GroupFrameOverlay` DOM div render nothing and throw "div is not a valid Konva node".

---

### `src/components/board/adapt/AdaptShellNode.tsx` (NEW — clone of DecodeShellNode)

**Analog:** `DecodeShellNode` (identical structure). Only `data-testid="adapt-shell"` and the descriptor copy differ:
```tsx
<p className="max-w-[44ch] text-xs leading-[1.4] text-white/35">
  Niche-adapted concepts drawn from the source format.
</p>
```

---

### `supabase/migrations/202606XXXXXX_add_mode_to_analysis_results.sql` (NEW)

**Analog:** `supabase/migrations/20260528113615_add_heatmap_to_analysis_results.sql` (full file):
```sql
-- Phase: Result Surface
-- Adds the assembled heatmap payload ...
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS heatmap jsonb;

COMMENT ON COLUMN public.analysis_results.heatmap IS '...';
```

**Pattern to follow** (D-12/D-13): additive `ALTER TABLE ... ADD COLUMN` with `NOT NULL DEFAULT 'score'` + `CHECK`. The `DEFAULT 'score'` backfills all existing rows in the same statement (no separate `UPDATE` — Postgres applies the default to existing rows on `ADD COLUMN`):
```sql
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'score'
  CHECK (mode IN ('score','remix'));

COMMENT ON COLUMN public.analysis_results.mode IS
  'User intent: score (grade my content) vs remix (decode a viral video). Distinct from input_mode (how content arrives). Default score backfills historical rows.';
```
Note: latest migration is `20260531000003` — pick a timestamp after it. Use `public.` schema prefix to match the analog.

---

### `src/components/board/board-types.ts` (edit — extend unions)

**Analog:** self, lines 15-28. Add `'decode' | 'adapt'` to `GroupId`:
```ts
export type GroupId =
  | 'input'
  | 'engine'
  | 'audience'
  | 'verdict'
  | 'actions'
  | 'content-analysis'
  | 'decode'      // NEW (remix-mode right-column hero — reuses verdict bounds)
  | 'adapt';      // NEW (remix-mode tall column — reuses actions bounds)
```
`CameraPresetKey` (lines 23-28) keeps the `'verdict'` key name (internal-only; the remix preset falls back to `decode` bounds — see board-constants pattern below).

---

### `src/components/board/board-constants.ts` (edit — mode-aware resolver)

**Analog:** self. `resolveBoardLayout` (lines 107-147), `AUTO_HEIGHT_FRAMES` (82-89), `computePresetTargets` (157-184).

**Verdict/Actions bounds to reuse 1:1 (D-07)** — from `GROUP_FRAMES` (lines 36, 40):
```ts
{ id: 'verdict',  label: 'Score',   bounds: { x: 864, y:   0, width: 360, height: 280 } },
{ id: 'actions',  label: 'Actions', bounds: { x: 864, y: 312, width: 360, height: 760 } },
```

**Resolver extension — use Pattern (a): rewrite `{id,label}` on the already-resolved verdict/actions entries; do NOT look up `base['decode']`** (RESEARCH Pitfall 2 — `base` is built from `GROUP_FRAMES` which has no decode/adapt entries, so `base['decode']` is `undefined`). Current signature + return (lines 107-146):
```ts
export function resolveBoardLayout(
  measured: Partial<Record<GroupId, number>>,
): GroupFrameLayout[] {
  const base = Object.fromEntries(GROUP_FRAMES.map((f) => [f.id, f])) as Record<GroupId, GroupFrameLayout>;
  const h = (id: GroupId): number => { /* measured-or-constant */ };
  // ... returns 6 frames including verdict + actions, bounds already computed
}
```
New signature: `resolveBoardLayout(measured, mode: 'score' | 'remix' = 'score')`. In remix mode, take the resolved array and rewrite the verdict entry → `{ ...entry, id: 'decode', label: 'Decode' }` and actions → `{ ...entry, id: 'adapt', label: 'Adapt' }`. Bounds stay verbatim. **Default param `'score'` keeps every existing caller (and the 56-assertion `board-constants.test.ts`) byte-identical.**

**`AUTO_HEIGHT_FRAMES`** (82-89) — add `'decode'` and `'adapt'` to the Set so the shells auto-height like verdict/actions.

**`computePresetTargets` camera fallback** (RESEARCH Pitfall 3) — line 166 reads `const ver = byId.verdict;` then `ver.x`. In remix mode `byId.verdict` is undefined. Minimal safe fix:
```ts
const ver = byId.verdict ?? byId.decode;   // remix hero is decode, same bounds
```
Do the same for any `byId.actions` reference if added. The `'verdict'` preset KEY stays (it's internal `CameraPresetKey`, not user-facing).

---

### `src/components/board/Board.tsx` (edit — derive mode, pass to resolver, dispatch shells, thread mode to submit)

**Analog:** self. Four touch points:

**1. Overlay dispatch** (lines 470-484) — the per-id render switch inside `GroupFrameOverlay`. Add two cases alongside the existing ones:
```tsx
{layout.id === 'verdict' && <VerdictNode camera={camera} layout={layout} />}
{layout.id === 'actions' && <ActionsNode camera={camera} layout={layout} />}
// ADD:
{layout.id === 'decode' && <DecodeShellNode />}
{layout.id === 'adapt'  && <AdaptShellNode />}
```
(Shells take no props — they self-render static copy. VerdictNode/ActionsNode take `camera`/`layout` only because they read the stream; the shells don't.)

**2. Mode-aware layout** (line 98): `resolveBoardLayout(measuredH)` → `resolveBoardLayout(measuredH, mode)`. Derive `mode` per RESEARCH Open Question 1 recommendation — hold a `mode` slice (board-store or local `Board` state) set at submit time for the live path; on permalink reload read it from the hydrated row. The board already reads the permalink row via `permalinkQuery` (lines 132-142, `select('*')` includes `mode`).

**3. Submit threading** (RESEARCH Pitfall 7) — `handleContentSubmit` (lines 282-312) builds `stream.start({...})` with an **explicit field allowlist (it does NOT spread `data`)**. Must add `mode: data.mode` explicitly:
```tsx
stream.start({
  input_mode: data.input_mode,
  content_type: data.input_mode === 'text' ? 'post' : 'video',
  // ...existing conditional fields...
  mode: data.mode,   // ADD — without this the row persists default 'score'
}).catch(() => {});
```

**4. `expanded` / frame refs** initialized from `GROUP_FRAMES` (lines 90-92, 107-113) — these iterate `GROUP_FRAMES` (always score ids). `resolvedFrames` (the rendered set) may contain `decode`/`adapt`. Verify `expanded[layout.id]` lookups don't return `undefined` for new ids — initialize `expanded` to default-true for decode/adapt too, or guard with `expanded[layout.id] ?? true`.

---

### `src/components/board/BoardMobile.tsx` (edit — mode-aware order + renderBody cases)

**Analog:** self. `MOBILE_ORDER` (lines 24-31), `renderBody` switch (81-107), `LAYOUT_BY_ID` (48-50).

**Order** — make it mode-parameterized (UI-SPEC §6):
```ts
const MOBILE_ORDER_SCORE: GroupId[] = ['input','verdict','audience','actions','content-analysis','engine'];
const MOBILE_ORDER_REMIX: GroupId[] = ['input','decode','audience','adapt','content-analysis','engine'];
```

**renderBody** (81-107) — add cases. Note the existing switch reads `LAYOUT_BY_ID.get(id)!` (built from `GROUP_FRAMES`); decode/adapt are NOT in `GROUP_FRAMES`, so `LAYOUT_BY_ID.get('decode')` is `undefined`. The shells take no layout prop, so guard the lookup or only call it for the data nodes:
```tsx
case 'decode': return <DecodeShellNode />;
case 'adapt':  return <AdaptShellNode />;
```

**Card label** — the `.map` at lines 121-129 reads `LAYOUT_BY_ID.get(id)!.label` for the `MobileFrameCard label`. For decode/adapt, supply the label without the `GROUP_FRAMES` map (e.g. a `MOBILE_LABELS` record or fall back: `LAYOUT_BY_ID.get(id)?.label ?? capitalize(id)`). `MobileFrameCard` (the card chrome) needs no change — it already renders `label` + collapse + Raycast card (`bg-[#18191a]`, 6% border, 12px radius).

---

### `src/components/app/content-form.tsx` (edit — intent selector + coupling + mode field)

**Analog:** self. The whole controlled-state + `MODE_CONFIG` tab pattern is the template.

**`ContentFormData`** (lines 112-123) — add `mode`:
```ts
export interface ContentFormData {
  input_mode: "text" | "tiktok_url" | "video_upload";
  mode: "score" | "remix";   // ADD — user intent (D-12)
  // ...existing fields...
}
```
Initialize in `useState` default (lines 167-178): `mode: "score"` (D-02).

**Intent selector — copy the existing tab-button idiom** (`MODE_CONFIG.map` render, lines 390-420). The selected/unselected class pattern is verified (lines 401-405):
```tsx
className={cn(
  "flex items-center gap-1.5 rounded-md py-1.5 transition-colors",
  isActive
    ? "bg-white/[0.08] text-foreground px-2.5"
    : "text-foreground-muted hover:text-foreground hover:bg-white/[0.04] px-1.5",
)}
```
UI-SPEC §1 promotes this to a two-segment `flex w-full` pill (each segment `flex-1`, 0px gap, container `bg-white/[0.03] border border-white/[0.06]` 8px radius, 36px tall, selected `bg-white/[0.08]` — NOT coral). Add `role="tablist"` / `role="tab"` / `aria-selected` (UI-SPEC §Accessibility).

**`MODE_CONFIG` filter (D-04)** — when `mode === 'remix'`, render only `[Video, Link]` and drop Text. The array (lines 132-136) is already `[Video, Text, URL]`; filter to `value !== 'text'` in remix.

**Tab-coupling reset (RESEARCH Pitfall 8)** — `handleTabChange` (220-224) sets `activeTab` + `formData.input_mode` together. When intent flips to Remix while `activeTab === 'text'`, reset `activeTab` to `'video_upload'` and update `formData.input_mode` to match — mirror the `handleTabChange` body. (Use a setter that does both, like the existing `handleTabChange`.)

**Caption suppression (D-05)** — the video caption textarea is conditional at lines 343-358 (`{formData.video_file && <textarea .../>}`). In remix mode, suppress it entirely (`mode === 'remix'` short-circuits the textarea). Remix URL placeholder override: "Paste a TikTok URL to decode..." (UI-SPEC §Copywriting).

---

### `src/hooks/queries/use-analysis-stream.ts` (edit — extend AnalysisStreamInput)

**Analog:** self, `AnalysisStreamInput` (lines 59-68) — a closed interface (not a spread). Add one field (RESEARCH Pitfall 7):
```ts
export interface AnalysisStreamInput {
  input_mode: "text" | "tiktok_url" | "video_upload";
  // ...existing fields...
  mode?: "score" | "remix";   // ADD — forwarded into the POST body verbatim
}
```
The mutation `body: JSON.stringify(input)` (line 324) forwards it unchanged — no other change in this file.

---

### `src/lib/engine/types.ts` (edit — Zod schema + refine)

**Analog:** self, `AnalysisInputSchema` (lines 135-165). Add `mode` to the `.object` and extend the `.refine`:
```ts
export const AnalysisInputSchema = z
  .object({
    input_mode: z.enum(["text", "tiktok_url", "video_upload"]),
    mode: z.enum(["score", "remix"]).default("score"),   // ADD (D-12)
    // ...existing fields...
  })
  .refine(
    (data) => {
      if (data.input_mode === "text") return !!data.content_text;
      if (data.input_mode === "tiktok_url") return !!data.tiktok_url;
      if (data.input_mode === "video_upload") return !!data.video_storage_path;
      return false;
    },
    { message: "Required field missing for selected input_mode" }
  )
  .refine(
    (data) => !(data.mode === "remix" && data.input_mode === "text"),  // ADD (Pitfall 6, D-04 server-side)
    { message: "Remix mode requires a video or link source, not text" }
  );
```
`AnalysisInput = z.infer<...>` (line 167) picks up `mode` automatically. **Also add an optional `mode?: 'score' | 'remix'` to `PredictionResult`** (RESEARCH Pitfall 4 / Assumption A2) so the value carries row→board without casts (`rowToPredictionResult` spreads the raw row, so it flows at runtime; the type just needs to allow it).

---

### `src/lib/engine/cache/prediction-cache.ts` (edit — fold mode, score-path-safe)

**Analog:** self, `computeContentHash` (lines 31-48). **Use strategy 5a: append a mode segment ONLY for remix** (RESEARCH Pitfall 5) so every existing score-mode hash stays byte-identical and no L1/L2 cache entry is orphaned:
```ts
export function computeContentHash(input: AnalysisInput, videoBuffer?: Buffer): string {
  const h = createHash("sha256");
  // ...existing per-input_mode h.update(...) branches, UNCHANGED...
  // append BEFORE digest, only in remix:
  if (input.mode === "remix") h.update("::mode=remix");
  return h.digest("hex");
}
```
Caution: the current function has **early `return h.digest("hex")` inside each branch** (lines 41, 45). The mode segment must be applied before each digest — either restructure to a single tail `digest`, or add the `if (input.mode === 'remix') h.update(...)` line before each of the three `return h.digest()` calls. `cacheKey` (20-22) and `lookupPredictionCache` (55-101, keys on `content_hash`) need NO change — the hash change alone makes Score/Remix distinct (D-14).

---

### `src/app/api/analyze/route.ts` (edit — persist mode in BOTH write sites)

**Analog:** self. `mode` is validated already (the schema parse at line 337 now includes it). **Two INSERT sites must carry `mode`:**

**1. Placeholder INSERT** (lines 583-601) — this is the row read on permalink reload (SSE branch upserts onto it by id). Add `mode`:
```ts
.insert({
  id: analysisId,
  user_id: user.id,
  content_text: validated.content_text ?? "",
  content_type: validated.content_type,
  // ...existing sentinels...
  input_mode: validated.input_mode,
  mode: validated.mode,   // ADD — survives permalink reload (D-15)
})
```

**2. `buildInsertRow`** (lines 402-485) — the JSON-branch insert + the final UPSERT. Add `mode: validated.mode` alongside `input_mode: finalResult.input_mode` (line 432). Use `validated.mode` (the request intent) — `finalResult` may not echo it unless added to `PredictionResult`.

The rate limiter is mode-agnostic (RESEARCH Security; STATE Plan 03) — do NOT add a second limiter. No new route — `mode` is additive metadata on `/api/analyze`.

---

### `src/types/database.types.ts` (edit — add mode to Row/Insert/Update)

**Analog:** self, `analysis_results` block (Row 181-232, Insert 233, Update 285). Prefer Supabase MCP `generate_typescript_types` regen after the migration applies; fallback is a 3-line hand-edit matching the existing `input_mode` entries:
- Row (after line 207 `input_mode: string | null`): `mode: string`  *(NOT NULL → non-optional, non-null)*
- Insert: `mode?: string`
- Update: `mode?: string`

---

## Shared Patterns

### Frame body is DOM, rendered inside `GroupFrameOverlay` (CRITICAL)
**Source:** `Board.tsx:454-486` (the `pointer-events-none` overlay div + per-id dispatch); `GroupFrameOverlay.tsx:136-201` (camera-scaled interior + title bar + body slot); `VerdictNode.tsx:84-89` (a node = a `<div>` returning JSX).
**Apply to:** `DecodeShellNode`, `AdaptShellNode`, and their Board.tsx/BoardMobile.tsx dispatch.
**Rule:** Konva (`GroupFrame.tsx`) draws only the rect/border chrome; ALL content is DOM children of the overlay. Shells are DOM. Title label comes from `layout.label` (overlay line 157) — shell renders descriptor only.

### Frame label / descriptor typography
**Source:** `GroupFrameOverlay.tsx:157` (title `text-xs font-semibold text-foreground`), `:196` (sub `text-xs leading-snug text-foreground-muted`); FrameHero label idiom `text-[10px] uppercase tracking-[0.1em] text-white/45`.
**Apply to:** Decode/Adapt descriptors → `text-xs leading-[1.4] text-white/35` (UI-SPEC §Typography, 12px medium muted descriptor).

### Mobile card chrome
**Source:** `MobileFrameCard.tsx` (whole file) — `rounded-[12px] border bg-[#18191a]`, 6% border, inset shadow `rgba(255,255,255,0.05) 0 1px 0 0 inset`, collapse chevron, `aria-label={label}`.
**Apply to:** decode/adapt mobile cards — reuse verbatim, only supply `label` + the shell as children. No backdrop-filter (RESEARCH Pitfall 9 — flat dark card, no glass).

### Single-source-of-truth layout (D-08)
**Source:** `board-constants.ts:resolveBoardLayout` (107-147).
**Apply to:** both Board.tsx and BoardMobile.tsx derive their frame set from mode → resolver / `MOBILE_ORDER_*`. No mode logic scattered into render.

### Input validation at the boundary (CLAUDE.md)
**Source:** `types.ts:AnalysisInputSchema` (135-165) `.refine` + `route.ts:337` parse-or-400.
**Apply to:** `mode` enum + remix↔text `.refine` rejection. DB `CHECK` constraint is defense-in-depth (V5).

### user_id-scoped persistence (ASVS V4)
**Source:** `prediction-cache.ts:80` (`.eq("user_id", userId)`), `analysis/[id]/route.ts:30` (`.eq("user_id", user.id)`), `route.ts` INSERTs set `user_id: user.id`.
**Apply to:** unchanged — `mode` adds no access surface; keep every user_id filter.

### Explicit-allowlist payload threading (NOT spread)
**Source:** `Board.tsx:301-311` (`stream.start` builds fields one-by-one) + `use-analysis-stream.ts:59` (closed `AnalysisStreamInput`).
**Apply to:** `mode` must be added at THREE points — `ContentFormData`, `AnalysisStreamInput`, and the explicit `mode: data.mode` in `stream.start({...})`. Missing any one drops the value (Pitfall 7).

---

## No Analog Found

None. Every new file has a direct in-repo analog (the two shells clone `VerdictNode`'s DOM shape; the migration clones the heatmap ADD COLUMN). The planner does not need to fall back to RESEARCH.md generic patterns for any file.

---

## Metadata

**Analog search scope:** `src/components/board/**`, `src/components/app/`, `src/hooks/queries/`, `src/lib/engine/**`, `src/app/api/analyze|analysis/`, `src/types/`, `supabase/migrations/`
**Files read this session:** VerdictNode.tsx, board-constants.ts, GroupFrameOverlay.tsx, Board.tsx, BoardMobile.tsx, board-types.ts, content-form.tsx, use-analysis-stream.ts, prediction-cache.ts, MobileFrameCard.tsx, types.ts (schema block), analyze/route.ts (parse + buildInsertRow + placeholder), analysis/[id]/route.ts, database.types.ts (analysis_results block); migrations dir listing + heatmap migration.
**Pattern extraction date:** 2026-06-01
