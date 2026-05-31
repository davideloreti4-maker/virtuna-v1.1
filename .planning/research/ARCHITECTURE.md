# Architecture: Viral Remix integration

**Milestone:** v3.2 Viral Remix
**Researched:** 2026-05-31
**Mode:** Integration / architecture (subsequent milestone — integrate, don't rebuild)
**Overall confidence:** HIGH for the SSE/route/sidebar/mobile integration points (read verbatim); MEDIUM for the Konva canvas frame-registry internals (role + shape confirmed via `BoardMobile.tsx` imports and `board-constants`/`board-types` references, but the canvas composition root could not be read in full this session — flagged as executor must-read-first).

> **Source-of-truth note:** Code was read from `/Users/davideloreti/virtuna-v1.1/src` (the cwd worktree on `feat/actions-frame-inline-redesign`). The `milestone/viral-remix` branch is a sibling worktree of the **same** repo built off this base (per MILESTONE/PROJECT), so paths and line numbers below are valid in the viral-remix worktree. Paths are repo-relative (`src/...`).

---

## Summary

The existing analyze flow is a **single linear spine** that Remix can splice into at four seams, with **one schema change**:

```
tiktok-url-input.tsx ──(AnalysisStreamInput)──▶ useAnalysisStream.start()
   └─ POST /api/analyze ──▶ AnalysisInputSchema.parse ──▶ runPredictionPipeline ──▶ aggregateScores
        └─ SSE: started{id} → phase → stage* → complete{PredictionResult}
             └─ buildInsertRow → analysis_results (Supabase)
                  └─ /analyze/[id] permalink ; useAnalysisHistory → Sidebar Recent
```

Every board frame (Input, Engine, Audience, Verdict, Actions, Content Craft) is an **independent self-hydrating component** that reads the same shared TanStack cache keyed on the analysis id — no shared board context. The canvas (`Board.tsx`) and the mobile card-stack (`BoardMobile.tsx`) both render frames off a **single registry** (`GROUP_FRAMES` in `board-constants.ts`, typed by `GroupId` in `board-types.ts`). That shared registry is the lever for "one board, two configs": **drive frame selection from a `mode` value rather than swapping component trees.**

The cheapest correct design:
1. Add a `mode: 'score' | 'remix'` flag at the input; thread it through `AnalysisStreamInput` → `/api/analyze` body → `AnalysisInputSchema` → persisted on the row.
2. Make the **frame registry mode-aware** (one extra field per frame entry: which mode(s) it belongs to) and have both `Board.tsx` and `BoardMobile.tsx` filter `GROUP_FRAMES` by the active mode. This is the lowest-churn swap — no parallel board component, no route fork.
3. Add `Decode` + `Adapt` as two new frame components that follow the exact `VerdictNode`/`ActionsNode` contract (`{ camera, layout }` props; self-hydrate from the shared cache).
4. "Develop & predict" = a normal `useAnalysisStream.start()` of one concept as a fresh analysis, carrying `parent_id`.
5. `parent_id` column on `analysis_results` (self-referencing FK) → drives the "remixed from" chip + Recent inclusion (Recent already lists all rows; no filter change needed).

The **gating unknown** (req #8) is whether `/api/analyze` actually ingests frames/transcript for a **non-owned** TikTok URL or only metadata. Decode quality depends entirely on this, so the **ingestion-depth spike is build-order phase 1** and blocks the Decode frame.

---

## 1. Mode toggle flow (input → /api/analyze → board config)

**Goal:** an explicit `mode` chosen at the input deterministically selects the board configuration end-to-end. No auto-detect (req #1).

### The value to thread

Introduce a discriminator, e.g. `mode: 'score' | 'remix'` (default `'score'` for backward compat — every existing caller and the JSON branch keep working untouched).

### Hop-by-hop plumbing (all grounded in read code)

| Hop | File · location | Change | New/Modified |
|-----|-----------------|--------|--------------|
| 1. Toggle UI | `src/components/app/tiktok-url-input.tsx` (named in SPEC §Background line 20; not read this session) | Add a two-option segmented control "Score my content" / "Remix a viral video"; hold local `mode` state | Modified |
| 2. Stream input type | `src/hooks/queries/use-analysis-stream.ts` — `AnalysisStreamInput` interface (lines 59–68) | Add optional `mode?: 'score' \| 'remix'` and `niche?: string` (niche field already exists, line 66) | Modified |
| 3. POST body | `use-analysis-stream.ts` `mutationFn` → `fetch("/api/analyze", { body: JSON.stringify(input) })` (line 320–325) | No code change needed — `input` is serialized whole; `mode` rides along automatically once added to the type | Modified (type only) |
| 4. Route validation | `src/app/api/analyze/route.ts` — `AnalysisInputSchema.parse(body)` (line 395), schema in `src/lib/engine/types.ts` | Add `mode` to `AnalysisInputSchema` (defaults `'score'`); branch the pipeline on `mode === 'remix'` to run decode/adapt generation instead of (or in addition to) the grade aggregation | Modified |
| 5. Persist mode | `route.ts` `buildInsertRow` (lines 460–543) **and** the SSE placeholder insert (lines 643–662) | Add `mode` (and later `parent_id`) to both the placeholder insert and `buildInsertRow` so the row records its configuration | Modified |
| 6. Board reads mode | The board frames hydrate from the persisted row via the shared cache (`queryKeys.analysis.detail(id)`, see `use-analysis-stream.ts` lines 249–251, 463–508). The row now carries `mode`, so any frame/registry filter can read `result.mode`. | Read `result.mode` to choose the frame config | Modified |

**Key insight (from `use-analysis-stream.ts`):** the hook already serializes the entire `AnalysisStreamInput` to the POST body (line 322) and already surfaces `analysisId` from the `started` SSE frame (lines 167–175) for the `/analyze/[id]` push. So the `mode` flag needs **zero new transport** — it is purely a new field on an existing object plus a branch in the route. This is why the toggle is low-risk.

**Determinism guarantee (req #1 acceptance):** because `mode` is an explicit body field validated by Zod and persisted on the row, the board configuration is a pure function of the stored row — no heuristics, no handle-matching.

---

## 2. One board, two configurations — recommended swap mechanism

### What the board actually is (verified)

From `BoardMobile.tsx` (read verbatim):
- A **single frame registry** drives everything: `GROUP_FRAMES` (imported from `./board-constants`, line 4) is an array of `GroupFrameLayout` objects, each `{ id: GroupId, label: string, ... }`. `BoardMobile` builds `LAYOUT_BY_ID = new Map(GROUP_FRAMES.map(f => [f.id, f]))` (lines 48–50).
- `GroupId` (from `./board-types`, line 13) is the union: `'input' | 'verdict' | 'audience' | 'actions' | 'content-analysis' | 'engine'` (proven by `MOBILE_ORDER`, lines 24–31, and the `renderBody` switch, lines 81–107).
- Each frame is an **independent component taking `{ camera, layout }`** and self-hydrating — e.g. `<VerdictNode camera={CARD_CAMERA} layout={layout} />` (line 99), `<ActionsNode .../>` (line 100), `<AudienceNode .../>` (line 97), `<ContentAnalysisFrame .../>` (line 103). Confirmed by the doc comment lines 53–57: "reuses the exact content nodes from the canvas. The nodes self-hydrate from the analysis stream / permalink hooks, so the card stack needs no data wiring."
- The Konva canvas (`Board.tsx`) consumes the **same `GROUP_FRAMES`** registry to lay out the grid (the registry holds the per-frame `GroupFrameLayout` geometry — `Camera`, `GroupFrameLayout` types come from `board-types.ts`).

> ⚠ **Executor must-read-first (MEDIUM-confidence area):** `src/components/board/Board.tsx`, `src/components/board/board-constants.ts` (`GROUP_FRAMES`), and `src/components/board/board-types.ts` (`GroupId`, `GroupFrameLayout`, `Camera`) could not be read in full this session (tool channel failed mid-run). Their **roles and shapes** are confirmed via `BoardMobile.tsx` imports/usage, but the executor MUST open these three files first to confirm the exact registry field names and the canvas grid/reflow logic before implementing the swap.

### Three candidate mechanisms (evaluated against the real code)

| Mechanism | What it means | Churn | Verdict |
|-----------|---------------|-------|---------|
| **A. Conditional render / parallel board tree** | A second `<BoardRemix>` / `<BoardMobileRemix>` rendering Decode+Adapt instead of Verdict+Actions | HIGH — duplicates the Konva camera/pan/zoom + card-stack scaffolding; two files to keep in sync; violates "don't bolt on" (req #6) | ❌ Reject |
| **B. Frame registry, mode-tagged (RECOMMENDED)** | Add a `modes: Mode[]` field to each `GroupFrameLayout` entry in `GROUP_FRAMES`; both `Board.tsx` and `BoardMobile.tsx` filter the registry by the active `mode`; add `Decode`/`Adapt` as new registry entries + new `GroupId`s | LOW — one new field on the registry, one `.filter()` per renderer, two new frame components, two new `GroupId` union members | ✅ **Choose** |
| **C. Per-frame internal switch** | Keep 6 fixed slots; have the Verdict slot internally render Decode when `mode==='remix'`, Actions slot render Adapt | MEDIUM — couples unrelated frames; Verdict/Actions components grow a second identity; grid geometry can't reflow (still 6 fixed slots, but Decode/Adapt may want different sizes) | ❌ Reject |

### Why B is lowest-churn and correct

1. **Single source of truth already exists.** Both renderers already derive their frame set from `GROUP_FRAMES`. Adding a `modes` discriminator to each entry and filtering is the minimal delta — no new layout engine, no second board component. The SPEC's "reflow the Konva grid" (req #6) becomes "the grid lays out whatever `GROUP_FRAMES.filter(f => f.modes.includes(mode))` returns" — the canvas already computes geometry from the registry, so a shorter/longer list reflows for free **if** the canvas derives positions from the filtered list rather than hardcoded coordinates (executor must verify in `Board.tsx`).
2. **Mobile absorbs the swap automatically.** `BoardMobile`'s `MOBILE_ORDER` (lines 24–31) is the only place the phone order is fixed. Make `MOBILE_ORDER` mode-aware (or derive it from the filtered registry) — Decode/Adapt then render as cards via the same `renderBody` switch (add two `case` arms, lines 81–107). No new card scaffolding (`MobileFrameCard` is reused verbatim).
3. **Frames already self-hydrate**, so swapping which frames mount needs **no data wiring** (BoardMobile doc comment lines 53–57). Decode/Adapt just need to read their slice of the persisted row from the shared cache like the others.
4. **Grade board untouched** (req #6 acceptance + "no regression"): score-mode entries keep `modes: ['score']` (or both), so the existing 6-frame board renders identically.

### Concrete registry shape (recommendation)

```ts
// board-types.ts
export type BoardMode = 'score' | 'remix';
export type GroupId =
  | 'input' | 'engine' | 'audience' | 'content-analysis'   // shared (both modes)
  | 'verdict' | 'actions'                                   // score-only
  | 'decode' | 'adapt';                                     // remix-only

// board-constants.ts — GROUP_FRAMES entries gain a `modes` field:
// { id: 'verdict', label: 'Verdict', modes: ['score'], ...layout }
// { id: 'decode',  label: 'Decode',  modes: ['remix'], ...layout }
// { id: 'input',   label: 'Input',   modes: ['score','remix'], ...layout }

// Board.tsx and BoardMobile.tsx:
const frames = GROUP_FRAMES.filter(f => f.modes.includes(mode));
```

`mode` is read from the hydrated `result.mode` (persisted on the row) for permalink replay, and from the in-flight `AnalysisStreamInput.mode` during a live run. Both renderers must derive `mode` the same way (likely a small selector on the shared result cache or a board-store value) so live and permalink paths agree.

---

## 3. Decode + Adapt as new frames (matching existing frame patterns)

Both are **new components** modeled 1:1 on the existing frame contract verified in `BoardMobile.tsx`:

- Live under `src/components/board/decode/DecodeNode.tsx` and `src/components/board/adapt/AdaptNode.tsx` (mirrors `verdict/VerdictNode.tsx`, `actions/ActionsNode.tsx` directory convention seen in imports lines 8–9).
- Props: `{ camera: Camera; layout: GroupFrameLayout }` — identical to `VerdictNode`/`ActionsNode` (lines 99–100).
- Self-hydrate from the shared analysis cache (read their fields off the `PredictionResult` row via the same permalink/stream cache the other nodes use — no new context). New decode/adapt payloads should be persisted on the row (see §5 / variants note below) so both live-SSE and permalink reload paint them.
- Register in `GROUP_FRAMES` with `modes: ['remix']` and add `'decode'`/`'adapt'` to `GroupId`.
- Add `case 'decode':`/`case 'adapt':` arms to `BoardMobile.renderBody` (lines 81–107) and to `MOBILE_ORDER` (remix variant).
- Style per Raycast (CLAUDE.md): 6% borders, 12px radius, Inter, `bg-transparent` cards.

**Where the decode/adapt data comes from:** the route's `mode === 'remix'` branch (§1 hop 4) runs Qwen-only decode + adapt generation and writes the result onto the row. **Recommendation: stash decode/adapt payloads in the existing `variants` JSONB bag** (no migration) — the same no-migration extensibility pattern already used for craft signals (`persistCraftToVariants`, route.ts lines 104–147) and `filmstrip_segments`. Decode = structural teardown + repeatable-vs-luck split; Adapt = exactly 3 concepts (req #3) each `{ angle, hook, who_its_for, source_structure_ref }`. This keeps the only **schema** change to `parent_id` (§5).

**Content/IP guard (constraint):** Adapt frame copy is generated as "adapt this format," references source *structure* not *content*, and the source video is never persisted/rebroadcast (SPEC Boundaries + Constraints). This is a prompt-design + copy constraint on the new route branch, not an architecture change.

---

## 4. Per-concept Develop → one child /api/analyze run + navigation

**This is the highest-reuse seam — almost entirely existing machinery.**

Each Adapt concept exposes "Develop & predict →". Clicking it = **start a brand-new analysis** of that single concept through the existing pipeline (req #4 — per-concept, never bulk; engine latency 90–312s makes bulk prohibitive).

Mechanism (all existing):
1. The concept's text becomes an `AnalysisStreamInput` (`input_mode: 'text'`, `content_text: <concept>`, `content_type`, `niche`), **plus** `parent_id: <remix analysis id>` and `mode: 'score'` (the developed child is a normal graded analysis).
2. Call `useAnalysisStream.start(input)` (line 560–565). This is **exactly** the existing submit path — `mutationFn` clears state, POSTs `/api/analyze`, reads the SSE, surfaces the new `analysisId` from the `started` frame (lines 310–367, 167–175).
3. Navigate to `/analyze/[id]`. The board already pushes the route on the `null→string` `analysisId` transition (documented in `use-analysis-stream.ts` lines 304–309). The developed child therefore opens its own grade board (Verdict+Actions — it's score mode) with a real score.
4. "Other concepts not scored" (req #4 acceptance) is automatic — only the clicked concept calls `start()`.

| Element | File · location | New/Modified |
|---------|-----------------|--------------|
| "Develop & predict" button per concept | new `adapt/AdaptNode.tsx` (or a `ConceptCard` child) | New |
| Build child `AnalysisStreamInput` w/ `parent_id` + `content_text` | calls existing `useAnalysisStream.start()` (line 560) | Modified (new caller) — no hook change beyond the `parent_id`/`mode` fields on the input type (§1, §5) |
| Route accepts `parent_id` | `route.ts` `buildInsertRow` (lines 460–543) + placeholder insert (lines 643–662) | Modified |
| Navigation | existing `analysisId` → `/analyze/[id]` push | Reused (no change) |

**Plumbing detail:** `parent_id` must be added to `AnalysisStreamInput` (line 59–68) and to `AnalysisInputSchema` so it survives Zod parse, then written by `buildInsertRow`. Same one-field-through-the-pipe pattern as `mode`.

---

## 5. parent_id lineage — schema + "remixed from" chip + Recent

### Schema change (the milestone's ONE migration)

`analysis_results` gains a self-referencing nullable column:

```sql
-- supabase/migrations/<ts>_add_parent_id_to_analysis_results.sql
alter table analysis_results
  add column parent_id text references analysis_results(id) on delete set null;
create index analysis_results_parent_id_idx on analysis_results(parent_id);
```

- `text` to match the existing id type — ids are generated with `nanoid(12)` (route.ts lines 643, 586; `import { nanoid }` line 3), so the PK is a 12-char text id, **not** a uuid. The FK column must be `text`.
- `on delete set null` keeps a child viewable if the source remix is deleted (chip just hides).
- Index because the future Pattern Playbook / lineage queries will filter by parent (and it's cheap now).

### Where parent_id is written (verified insert sites)

There are **three** insert/upsert sites in `route.ts` — all must carry `parent_id`:
1. `buildInsertRow` (lines 460–543) — the shared builder used by both branches. **Add `parent_id: validated.parent_id ?? null` here** (covers JSON branch line 589 and SSE upsert line 754).
2. SSE **placeholder** insert (lines 643–662) — add `parent_id: validated.parent_id ?? null` so the in-flight row already has lineage (the GET-stream reconnect reads this placeholder).
3. (The safety-net UPDATE at lines 788–826 does not need it — `parent_id` is immutable after insert.)

`validated.parent_id` exists once `parent_id` is added to `AnalysisInputSchema` (the same schema edit as `mode`, §1 hop 4).

### "Remixed from" chip (UI, new)

- The child board reads `result.parent_id` from the hydrated row (shared cache). When non-null, render a chip linking to `/analyze/${parent_id}` (req #5 acceptance: "working link back to the source").
- Lowest-churn placement: the **Input frame** of the child board (`InputResultCard`, imported in BoardMobile line 11) — it already presents the analyzed content, so a "remixed from <source>" chip belongs there. Alternatively a small banner in the board header. Either is a new sub-element, not a new frame.
- Resolving the source label (the parent's content/title) needs the parent row; either join in `/api/analysis/[id]` to return `parent: { id, content_text }`, or lazily fetch the parent via the existing `/api/analysis/[id]` endpoint. **Recommendation:** extend the detail endpoint to also return a minimal `parent` summary — one query, avoids a client waterfall.

### Recent list (verified — needs essentially no change)

`Sidebar.tsx` Recent is driven by `useAnalysisHistory()` (line 361) → `recentBoards = (historyData ?? []).slice(0, 8)` (line 362). It lists **all** the user's analyses chronologically with no parent/child filter (rows render lines 538–577). **A developed child appears in Recent automatically** because it's a normal `analysis_results` row (req #5 acceptance "appears in Recent" = free). Optional enhancement: show a small "remix" glyph on child rows by checking `board.parent_id` (would require adding `parent_id` to the `recentBoards` row shape, lines 362–367, and to whatever `useAnalysisHistory` selects) — **nice-to-have, not required** by the acceptance criteria.

---

## 6. Niche source (req #7) — minor integration

- `AnalysisStreamInput` already has `niche?: string` (line 66) and `creator_handle?: string` (line 67) — the transport exists.
- Adapt generation needs the user's niche. Source from the `creator_profiles` table (the route already reads `creator_profiles` for `storage_retention_opted_in`, lines 340–345 — add a `niche`/`primary_niche` select alongside it, or read it client-side from `useProfile()` which the sidebar already uses, line 51 / `use-profile`).
- **Inline fallback:** if niche is empty when Remix is submitted, the Adapt frame (or the input) prompts for it before concepts generate (req #7 acceptance). Lowest-churn: gate concept generation in the remix route branch on a non-empty niche, and have the Adapt frame render an inline "enter your niche" prompt when the row's adapt payload is empty-because-no-niche. This is a new small UI affordance, not a new data path.

---

## 7. New vs Modified files

### New components / files

| Path | Purpose |
|------|---------|
| `src/components/board/decode/DecodeNode.tsx` | Decode frame (structural teardown + repeatable-vs-luck), `{camera,layout}` contract |
| `src/components/board/adapt/AdaptNode.tsx` | Adapt frame: exactly 3 niche concepts + per-concept "Develop & predict →" |
| `src/components/board/adapt/ConceptCard.tsx` (optional) | One concept: angle/hook/who-it's-for + Develop button |
| `src/lib/engine/remix/decode.ts` | Qwen-only decode generation (called from route remix branch) |
| `src/lib/engine/remix/adapt.ts` | Qwen-only adapt/concept generation (niche-grounded) |
| `supabase/migrations/<ts>_add_parent_id_to_analysis_results.sql` | The one schema change |
| `.planning/research/INGESTION-SPIKE.md` (or phase artifact) | Spike output for req #8 |

### Modified existing files

| Path · anchor | Change |
|---------------|--------|
| `src/components/app/tiktok-url-input.tsx` | Add Score/Remix toggle; pass `mode` into the submit input |
| `src/hooks/queries/use-analysis-stream.ts` (`AnalysisStreamInput`, lines 59–68) | Add `mode`, `parent_id` to the input type (niche already present) |
| `src/app/api/analyze/route.ts` (lines 395, 460–543, 643–662) | Add `mode`+`parent_id` to schema; branch pipeline on `mode==='remix'`; write both fields in `buildInsertRow` + placeholder insert; persist decode/adapt into `variants` |
| `src/lib/engine/types.ts` (`AnalysisInputSchema`, `PredictionResult`) | Add `mode`, `parent_id` to schema; type the decode/adapt payload (or read from `variants`) |
| `src/components/board/board-types.ts` | Add `BoardMode`; extend `GroupId` with `'decode'`/`'adapt'`; add `modes` to `GroupFrameLayout` |
| `src/components/board/board-constants.ts` (`GROUP_FRAMES`) | Tag each frame with `modes`; add `decode`/`adapt` entries + their grid geometry |
| `src/components/board/Board.tsx` (canvas root — **executor read-first**) | Filter `GROUP_FRAMES` by active mode; confirm grid reflows from filtered list |
| `src/components/board/BoardMobile.tsx` (lines 24–31, 81–107) | Mode-aware `MOBILE_ORDER`; add `decode`/`adapt` cases to `renderBody` |
| `src/components/board/InputResultCard.tsx` | "Remixed from" chip when `result.parent_id != null` |
| `src/app/api/analysis/[id]/route.ts` | Return minimal `parent` summary for the chip label (avoid client waterfall) |
| `src/components/sidebar/Sidebar.tsx` (lines 362–367) — *optional* | Add `parent_id` to `recentBoards` shape + a remix glyph on child rows (nice-to-have) |
| `src/hooks/queries/use-profile.ts` / `creator_profiles` read | Surface `niche` for Adapt grounding + inline fallback |

---

## 8. Suggested build order (ingestion spike gates everything)

Dependency-ordered; **Phase 1 is the spike and blocks Decode** (req #8 ⚠ is the milestone's stated first task).

**Phase 1 — Ingestion-depth spike (GATE, req #8).** Determine empirically what `/api/analyze` obtains for an **arbitrary, non-owned** TikTok URL: frames + transcript, or metadata only. Trace `input_mode: 'tiktok_url'` through `runPredictionPipeline` (route.ts line 693) into the engine's TikTok ingestion. Write `INGESTION-SPIKE.md`: the exact signal available + whether it's sufficient for structural Decode; if insufficient, document the remediation (e.g. a scrape/frame-extract step) **before Decode is planned**. **No frame work starts until this lands.** *Why first: Decode's entire value (and feasibility) depends on the answer; building Decode UI before knowing the signal risks a rewrite.*

**Phase 2 — Mode flag plumbing (no UI swap yet).** Add `mode` to `AnalysisStreamInput` + `AnalysisInputSchema`; persist on the row (`buildInsertRow` + placeholder). Add the toggle to `tiktok-url-input.tsx`. Acceptance checkpoint: a remix-mode submit produces a row with `mode='remix'` and still renders the existing board (frames not yet swapped). *Pure plumbing, no engine dependency — de-risks the transport early. Can run partly parallel with Phase 1 since it doesn't touch ingestion.*

**Phase 3 — Frame registry made mode-aware + empty Decode/Adapt shells.** Read `Board.tsx`/`board-constants.ts`/`board-types.ts` first. Add `BoardMode`, `modes` field, `decode`/`adapt` `GroupId`s; filter in `Board.tsx` + `BoardMobile.tsx`; register placeholder Decode/Adapt frames. Acceptance: remix board shows Input+Engine+Audience+Content Craft+Decode(empty)+Adapt(empty) on canvas **and** mobile; grade board unchanged. *Establishes the one-board-two-config skeleton; depends on Phase 2's `mode` value.*

**Phase 4 — Decode frame (depends on Phase 1 + 3).** Qwen-only decode generation in the remix route branch → persist into `variants`; `DecodeNode` renders structural teardown + repeatable-vs-luck. *Blocked by the spike: needs confirmed ingestion signal.*

**Phase 5 — Adapt frame + niche (depends on Phase 3 + req #7).** Qwen-only adapt generation grounded in `creator_profiles.niche` (inline fallback); `AdaptNode` renders exactly 3 concepts. *Independent of Decode generation, but shares the remix route branch.*

**Phase 6 — Develop & predict + lineage (depends on Phase 5 for the button, schema for parent_id).** `parent_id` migration; thread `parent_id` through input → schema → both inserts; "Develop" button calls existing `useAnalysisStream.start()` with `parent_id` + `mode:'score'`; navigation reuses the existing `analysisId` push; "remixed from" chip in `InputResultCard`; `/api/analysis/[id]` returns parent summary. Recent inclusion is free. *Last because it composes everything: needs concepts (P5), the schema, and the existing develop/nav machinery.*

**Phase 7 — Polish / regression.** Verify grade-mode board and existing analyze flow unchanged (no regression — acceptance); mobile card-stack absorbs Decode/Adapt; optional Recent remix glyph; Raycast styling pass on the two new frames.

```
P1 spike ─┬─▶ P4 Decode ───┐
          │                 ├─▶ P7 polish
P2 mode ──┴─▶ P3 registry ──┼─▶ P5 Adapt ─▶ P6 Develop+lineage ─┘
                            └────────────────┘
```

---

## 9. Risks — where one-board-two-config can go wrong

1. **Canvas grid hardcodes frame positions (HIGH).** Mechanism B assumes `Board.tsx` derives the Konva grid from the (now filterable) `GROUP_FRAMES` list. If frame coordinates are hardcoded per `GroupId` rather than computed from the list, removing Verdict/Actions leaves **holes** and Decode/Adapt won't reflow. **Mitigation:** Phase-3 executor must open `Board.tsx` + the `GroupFrameLayout` geometry in `board-constants.ts` first and confirm positions are list-derived; if not, the reflow becomes a small layout refactor (in-scope, but must be sized in Phase 3, not discovered in Phase 6). *This is the single biggest unknown in the design and the reason `Board.tsx` is flagged read-first.*

2. **Live vs permalink mode disagreement (MEDIUM).** During a live run, `mode` comes from `AnalysisStreamInput`; on permalink reload it must come from the persisted `result.mode`. The frames hydrate independently (no shared board context — `use-analysis-stream.ts` lines 450–508 document each node mounting standalone). If even one renderer reads `mode` from a different source, the canvas and a frame can disagree (e.g. canvas shows remix frames but a node renders score content). **Mitigation:** single `mode` selector off the shared result cache, used identically by `Board.tsx`, `BoardMobile.tsx`, and any frame that branches. Mirror the existing pattern where every node reads `queryKeys.analysis.detail(id)`.

3. **Ingestion insufficiency invalidates Decode (HIGH — the SPEC's own #1 risk).** If the spike (Phase 1) finds only metadata is available for non-owned URLs, Decode cannot do structural teardown without new ingestion work. **Mitigation:** the spike *is* Phase 1 and explicitly gates Decode; remediation is documented before any Decode UI is built.

4. **Latency UX on Develop (MEDIUM).** A developed child runs the full 90–312s pipeline. Navigating immediately to a near-empty `/analyze/[id]` is fine (the existing SSE/streaming board handles in-flight state — placeholder row + stage events), but the **transition from the Adapt frame** must not block. **Mitigation:** reuse the existing optimistic nav (the `null→string analysisId` push already fires before completion); the child board streams as normal. No new pattern needed — just don't `await` completion before navigating.

5. **`variants` JSONB write races (LOW–MEDIUM).** Decode/adapt persistence into `variants` shares the bag with `persistCraftToVariants` (route.ts 104–147) and filmstrip extraction — both do read-merge-write and **race** (documented lines 89–103). Adding a third writer (decode/adapt) increases race surface. **Mitigation:** follow the existing spread-merge pattern (`{ ...current, decode, adapt }`) so concurrent writers preserve each other's keys; never wholesale-overwrite `variants`. If contention proves real, promote decode/adapt to dedicated columns later (deferred — not worth a migration now).

6. **Mobile reading order assumes 6 fixed frames (LOW).** `MOBILE_ORDER` (BoardMobile lines 24–31) is a hardcoded `GroupId[]`. Forgetting to make it mode-aware means the phone shows score-mode order with empty Verdict/Actions cards in remix. **Mitigation:** derive the mobile order from the filtered registry (or keep two explicit arrays) — caught by the Phase-3 mobile acceptance check.

7. **JSON branch + cache parity (LOW).** `/api/analyze` has a JSON one-shot branch (route.ts 549–631) and a two-tier prediction cache keyed on `computeContentHash(validated)` (line 414). New fields (`mode`, `parent_id`) must be in `buildInsertRow` so **both** branches persist them, and the content-hash cache must not collapse a remix and a score request for the same URL into one entry. **Mitigation:** include `mode` in the cache key / `computeContentHash` input so a remix-decode and a grade of the same URL don't alias.

---

## Confidence assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Mode flag transport (input→hook→route→row) | HIGH | `use-analysis-stream.ts` + `route.ts` read verbatim; `AnalysisStreamInput` and `buildInsertRow` shapes confirmed |
| Develop→child run + navigation | HIGH | `start()`/`mutationFn`/`analysisId` push all read verbatim |
| parent_id schema + write sites | HIGH | All three insert sites located by line; nanoid text-id PK confirmed (route.ts lines 3, 586, 643) |
| Recent list inclusion | HIGH | `Sidebar.tsx` Recent reads all rows, no filter (lines 361–367, 538–577) |
| Mobile frame swap | HIGH | `BoardMobile.tsx` registry+switch read verbatim |
| Decode/Adapt frame contract | HIGH | `{camera,layout}` + self-hydrate confirmed from BoardMobile imports/usage |
| Canvas registry-driven reflow (Mechanism B) | MEDIUM | `GROUP_FRAMES`/`GroupId` role confirmed via BoardMobile; `Board.tsx` internals not read this session — **executor read-first** |
| Ingestion depth for non-owned URLs | LOW (by design) | Unverified — req #8 spike; route only validates URL format (lines 300–308), engine ingestion not traced |

## Open questions (for the spike / executor)

- **(Spike, req #8)** Does the engine pull frames/transcript for a non-owned TikTok URL, or metadata only? — gates Decode.
- **(Executor, Phase 3)** Are Konva frame positions in `Board.tsx`/`board-constants.ts` derived from the `GROUP_FRAMES` list (reflow-for-free) or hardcoded per `GroupId` (needs layout refactor)?
- Where exactly does `creator_profiles` expose niche (column name) for Adapt grounding + inline fallback?
- Should `mode` participate in `computeContentHash` to avoid remix/score cache aliasing? (Recommended: yes.)
