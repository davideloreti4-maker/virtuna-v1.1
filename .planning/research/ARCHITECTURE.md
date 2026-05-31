# Architecture: Viral Remix integration

**Milestone:** v3.2 Viral Remix
**Researched:** 2026-05-31
**Mode:** Integration / architecture (subsequent milestone — integrate, don't rebuild)
**Overall confidence:** HIGH. The SSE hook, `/api/analyze` route, sidebar, mobile card-stack, **and the Konva canvas root (`Board.tsx`)** plus `board-constants.ts`/`board-types.ts` were all read verbatim. The one-board-two-config recommendation is grounded in the verified canvas rendering path.

> **Source-of-truth note:** Code was read from `/Users/davideloreti/virtuna-v1.1/src` (the cwd worktree on `feat/actions-frame-inline-redesign`). The `milestone/viral-remix` worktree (`/Users/davideloreti/virtuna-viral-remix`, branch `milestone/viral-remix`, commit 997a79f) is a sibling worktree of the **same** repo built off this base (per MILESTONE/PROJECT), so paths and line numbers below are valid in the viral-remix worktree. Paths are repo-relative (`src/...`).

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

Every board frame (Input, Engine, Audience, Verdict, Actions, Content Craft) is an **independent self-hydrating component** that reads the same shared TanStack cache keyed on the analysis id — no shared board context. The canvas (`Board.tsx`) renders `resolvedFrames.map(...)` where `resolvedFrames = resolveBoardLayout(measuredH)` (verified, Board.tsx line 98 + 435–485), and the mobile card-stack (`BoardMobile.tsx`) renders off the same `GROUP_FRAMES` registry. **That shared, list-driven rendering is the lever for "one board, two configs": drive frame selection from a `mode` value rather than swapping component trees.**

The cheapest correct design:
1. Add a `mode: 'score' | 'remix'` flag at the input; thread it through `AnalysisStreamInput` → `/api/analyze` body → `AnalysisInputSchema` → persisted on the row.
2. Make the **frame registry mode-aware** (one extra field per frame entry) and have both `Board.tsx` and `BoardMobile.tsx` select frames by the active mode. Because the canvas already maps over a computed frame list, this is the lowest-churn swap — no parallel board component, no route fork. The one contained edit is teaching `resolveBoardLayout` where to place the new frames (it currently hardcodes the column plan by `GroupId`).
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
| 1. Toggle UI | `src/components/app/tiktok-url-input.tsx` (named in SPEC §Background line 20) and/or `content-form` (Board.tsx imports `ContentFormData`, line 44) | Add a two-option segmented control "Score my content" / "Remix a viral video"; carry `mode` on `ContentFormData` | Modified |
| 2. Submit handler | `Board.tsx` `handleContentSubmit` (lines 282–312) — builds the input object and calls `stream.start(...)` | Add `...(data.mode && { mode: data.mode })` alongside the existing `niche` spread (line 310) | Modified |
| 3. Stream input type | `src/hooks/queries/use-analysis-stream.ts` — `AnalysisStreamInput` interface (lines 59–68) | Add optional `mode?: 'score' \| 'remix'` and `parent_id?: string` (niche already exists, line 66) | Modified |
| 4. POST body | `use-analysis-stream.ts` `mutationFn` → `fetch("/api/analyze", { body: JSON.stringify(input) })` (lines 320–325) | No code change — `input` is serialized whole; `mode` rides along once added to the type | Modified (type only) |
| 5. Route validation | `src/app/api/analyze/route.ts` — `AnalysisInputSchema.parse(body)` (line 395), schema in `src/lib/engine/types.ts` | Add `mode` to `AnalysisInputSchema` (defaults `'score'`); branch the pipeline on `mode === 'remix'` to run decode/adapt generation | Modified |
| 6. Persist mode | `route.ts` `buildInsertRow` (lines 460–543) **and** the SSE placeholder insert (lines 643–662) | Add `mode` (and `parent_id`) to both the placeholder insert and `buildInsertRow` so the row records its configuration | Modified |
| 7. Board reads mode | Frames hydrate from the persisted row via the shared cache (`queryKeys.analysis.detail(id)`, use-analysis-stream.ts 249–251, 463–508). `Board.tsx` already destructures `stream.result` near lines 397–409. | Read `result.mode` (fallback to in-flight input) to choose the frame config | Modified |

**Key insight (verified in the hook):** the hook already serializes the entire `AnalysisStreamInput` to the POST body (line 322) and already surfaces `analysisId` from the `started` SSE frame (lines 167–175) for the `/analyze/[id]` push. So the `mode` flag needs **zero new transport** — it is purely a new field on an existing object plus a branch in the route. This is why the toggle is low-risk.

**Determinism guarantee (req #1 acceptance):** because `mode` is an explicit body field validated by Zod and persisted on the row, the board configuration is a pure function of the stored row — no heuristics, no handle-matching.

---

## 2. One board, two configurations — recommended swap mechanism

### What the board actually is (verified — Board.tsx + BoardMobile.tsx + board-constants.ts read in full)

- **A single frame registry drives everything.** `GROUP_FRAMES` (board-constants.ts lines 26–45) is an array of `GroupFrameLayout` objects `{ id, label, bounds }`. `GroupId` (board-types.ts 15–21) is the union `'input' | 'engine' | 'audience' | 'verdict' | 'actions' | 'content-analysis'`.
- **The canvas renders whatever the resolved list contains.** `Board.tsx` line 98: `const resolvedFrames = useMemo(() => resolveBoardLayout(measuredH), [measuredH])`. Lines 435–441 render `resolvedFrames.map((layout) => <GroupFrame key={layout.id} layout={layout} .../>)`; lines 455–485 render `resolvedFrames.map((layout) => <GroupFrameOverlay ...>{ frame body }</GroupFrameOverlay>)`. The frame **body** is chosen by `layout.id ===` checks (lines 470–483): `'input'→InputResultCard`, `'engine'→EngineGroup`, `'audience'→AudienceNode`, `'verdict'→VerdictNode`, `'actions'→ActionsNode`, `'content-analysis'→ContentAnalysisFrame`. **Positions are list-derived, not hardcoded per component.**
- **`resolveBoardLayout`** (board-constants.ts 107–147) computes each frame's `{x,y,width,height}` from `GROUP_FRAMES` + measured content heights; `BOARD_BOUNDS`/overview camera fit also derive from the array (47–51, `computeBoardBounds`). A shorter/longer/different frame list reflows automatically at the render layer.
- **Mobile uses the same registry.** `BoardMobile.tsx` builds `LAYOUT_BY_ID = new Map(GROUP_FRAMES.map(f => [f.id, f]))` (48–50), iterates a fixed `MOBILE_ORDER: GroupId[]` (24–31), and renders each via a `renderBody(id)` switch (81–107) calling the same nodes with `{ camera: CARD_CAMERA, layout }`. Doc comment 53–57: "reuses the exact content nodes from the canvas … nodes self-hydrate … the card stack needs no data wiring."

### Three candidate mechanisms (evaluated against the real code)

| Mechanism | What it means | Churn | Verdict |
|-----------|---------------|-------|---------|
| **A. Conditional render / parallel board tree** | A second `<BoardRemix>` / `<BoardMobileRemix>` rendering Decode+Adapt instead of Verdict+Actions | HIGH — duplicates the Konva camera/pan/zoom (`use-camera`, `BoardCanvas`, command bar, roving tabindex) + card-stack scaffolding; two files to keep in sync; violates "don't bolt on" (req #6) | ❌ Reject |
| **B. Frame registry, mode-tagged (RECOMMENDED)** | Add a `modes: BoardMode[]` field to each `GroupFrameLayout` entry; select frames by active `mode` in both renderers; add `Decode`/`Adapt` as new registry entries + `GroupId`s; extend `resolveBoardLayout` with the remix column plan | LOW — one new field, two new frame components, two new `GroupId` members, two new `layout.id===` slot arms, one scoped edit to `resolveBoardLayout`/`computePresetTargets` | ✅ **Choose** |
| **C. Per-frame internal switch** | Keep 6 fixed slots; Verdict slot internally renders Decode when `mode==='remix'`, Actions slot renders Adapt | MEDIUM — couples unrelated frames; Verdict/Actions grow a second identity; the verdict frame is only 280px tall (board-constants.ts line 36) while Decode wants the full right column — geometry fights the fixed slot | ❌ Reject |

### Why B is lowest-churn and correct

1. **Single source of truth, verified.** The canvas renders `resolvedFrames.map(...)` (Board.tsx 435–485) and the mobile stack maps `GROUP_FRAMES` (BoardMobile 48–50, 121–129). Selecting the frame set by mode is the minimal delta — no new layout engine, no second board component. The SPEC's "reflow the Konva grid" (req #6) is satisfied at the render layer for free.
2. **The one nuance — `resolveBoardLayout` hardcodes the column plan by `GroupId`.** It computes `inputH→engineY`, `verdictH→actionsY`, and places `content-analysis` under the taller column, referring to the six ids by name (107–147). For remix it must place `decode`/`adapt` into the freed right column (x=864, where verdict/actions sat). This is a contained ~30-line edit to one pure function (+ matching `computePresetTargets`, 157–184), fully unit-testable (`__tests__/board-constants.test.ts` already exists). It is **not** a canvas/Konva refactor.
3. **Mobile absorbs the swap.** `MOBILE_ORDER` (24–31) is the only fixed phone order — make it mode-aware (or derive from the mode-filtered registry); add `case 'decode':`/`case 'adapt':` arms to `renderBody` (81–107). `MobileFrameCard` is reused verbatim (read: it's a generic title-bar + collapse card, MobileFrameCard.tsx).
4. **Frames already self-hydrate**, so changing which frames mount needs **no data wiring** (BoardMobile 53–57; every node mounts its own `useAnalysisStream`).
5. **Grade board untouched** (req #6 acceptance + "no regression"): shared frames carry `modes: ['score','remix']`; verdict/actions stay `modes: ['score']`; the score path renders identically and `resolveBoardLayout`'s existing branch is unchanged.

### Concrete registry shape (recommendation)

```ts
// board-types.ts
export type BoardMode = 'score' | 'remix';
export type GroupId =
  | 'input' | 'engine' | 'audience' | 'content-analysis'   // shared (both modes)
  | 'verdict' | 'actions'                                   // score-only
  | 'decode' | 'adapt';                                     // remix-only

// board-constants.ts — GROUP_FRAMES entries gain a `modes` field on GroupFrameLayout:
// { id: 'verdict', label: 'Score',  bounds: {...}, modes: ['score'] }
// { id: 'decode',  label: 'Decode', bounds: {...}, modes: ['remix'] }
// { id: 'input',   label: 'Input',  bounds: {...}, modes: ['score','remix'] }

// resolveBoardLayout(measured, mode): branch the right-column composition —
//   score → verdict→actions ;  remix → decode→adapt  (same x=864 column)
// Board.tsx line 98 → resolveBoardLayout(measuredH, mode)
// Board.tsx 470–483 → add `layout.id === 'decode'` / `'adapt'` slot arms
// BoardMobile MOBILE_ORDER → mode-aware; renderBody → add decode/adapt cases
```

`mode` is read from the hydrated `result.mode` (persisted on the row) for permalink replay, and from the in-flight `AnalysisStreamInput.mode` during a live run. **Both renderers must derive `mode` the same way** — see Risk #2.

---

## 3. Decode + Adapt as new frames (matching existing frame patterns)

Both are **new components** modeled 1:1 on the existing frame contract verified in `Board.tsx` (470–483) and `BoardMobile.tsx` (97–103):

- Live under `src/components/board/decode/DecodeNode.tsx` and `src/components/board/adapt/AdaptNode.tsx` (mirrors the `verdict/`, `actions/` directory convention).
- Props: `{ camera: Camera; layout: GroupFrameLayout }` — identical to `VerdictNode`/`ActionsNode`.
- Self-hydrate from the shared analysis cache (read their fields off the `PredictionResult` row via the same permalink/stream cache the other nodes use — no new context). New decode/adapt payloads are persisted on the row (see §5 / variants note) so both live-SSE and permalink reload paint them.
- Register in `GROUP_FRAMES` with `modes: ['remix']`; add `'decode'`/`'adapt'` to `GroupId`; add them to `AUTO_HEIGHT_FRAMES` (board-constants.ts 82–89) if content-sized; add the remix column plan to `resolveBoardLayout`.
- Add `case 'decode':`/`case 'adapt':` arms to `BoardMobile.renderBody` (81–107) and to the remix `MOBILE_ORDER`.
- Match the score-frame internal style and reuse the shared frame kit in `src/components/board/_kit/` (`FrameHero`, `StatTile`, `DataTable`, `FrameTabs`, etc.) for visual consistency. Raycast tokens (CLAUDE.md): 6% borders, 12px radius, Inter, `bg-transparent`.

**Where the decode/adapt data comes from:** the route's `mode === 'remix'` branch (§1 hop 5) runs Qwen-only decode + adapt generation and writes the result onto the row. **Recommendation: stash decode/adapt payloads in the existing `variants` JSONB bag** (no migration) — the same no-migration extensibility pattern already used for craft signals (`persistCraftToVariants`, route.ts 104–147) and `filmstrip_segments`. Decode = structural teardown (hook pattern, pacing/structure, the turn, emotional beat) + repeatable-vs-luck split; Adapt = exactly 3 concepts (req #3), each `{ angle, hook, who_its_for, source_structure_ref }`. This keeps the only **schema** change to `parent_id` (§5).

**Content/IP guard (constraint):** Adapt copy is generated as "adapt this format," references source *structure* not *content*, and the source video is never persisted/rebroadcast (SPEC Boundaries + Constraints). A prompt-design + copy constraint on the new route branch, not an architecture change.

---

## 4. Per-concept Develop → one child /api/analyze run + navigation

**This is the highest-reuse seam — almost entirely existing machinery.**

Each Adapt concept exposes "Develop & predict →". Clicking it = **start a brand-new analysis** of that single concept through the existing pipeline (req #4 — per-concept, never bulk; engine latency 90–312s makes bulk prohibitive).

Mechanism (all existing, verified in Board.tsx):
1. The concept's text becomes an `AnalysisStreamInput` (`input_mode: 'text'`, `content_text: <concept>`, `content_type: 'post'`, `niche`), **plus** `parent_id: <remix analysis id>` and `mode: 'score'` (the developed child is a normal graded analysis).
2. Call `useAnalysisStream.start(input)` (hook line 560–565). This is **exactly** the existing submit path — `handleContentSubmit` (Board.tsx 282–312) builds the same shape (note the `niche` spread, line 310) and calls `stream.start`; `mutationFn` clears state, POSTs `/api/analyze`, reads the SSE, surfaces the new `analysisId` from the `started` frame (hook 310–367, 167–175).
3. Navigate to `/analyze/[id]`. **Verified:** a dedicated effect fires `router.push('/analyze/${id}')` exactly on the `null→string` `analysisId` transition (Board.tsx 273–280). The Develop button reuses this identical path — no new navigation code. The child opens its own grade board (Verdict+Actions, score mode) with a real score.
4. "Other concepts not scored" (req #4 acceptance) is automatic — only the clicked concept calls `start()`.

| Element | File · location | New/Modified |
|---------|-----------------|--------------|
| "Develop & predict" button per concept | new `adapt/AdaptNode.tsx` (or a `ConceptCard` child) | New |
| Build child `AnalysisStreamInput` w/ `parent_id` + `content_text`, call `stream.start` | reuses `handleContentSubmit` pattern (Board.tsx 282–312) / hook `start()` (line 560) | Modified (new caller) |
| Route accepts `parent_id` | `route.ts` `buildInsertRow` (460–543) + placeholder insert (643–662) | Modified |
| Navigation | existing `analysisId` → `/analyze/[id]` push (Board.tsx 273–280) | Reused (no change) |

**Plumbing detail:** `parent_id` must be added to `AnalysisStreamInput` (59–68) and to `AnalysisInputSchema` so it survives Zod parse, then written by `buildInsertRow`. Same one-field-through-the-pipe pattern as `mode`. The Adapt frame (a node, not the command bar) needs access to a `start`-capable stream + router; cleanest is to lift a small `onDevelop(concept)` callback from `Board.tsx` (which owns `stream` + `router`) down to `AdaptNode` via props, mirroring how `handleContentSubmit` is passed to `CommandBar` (Board.tsx line 448).

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

- `text` to match the existing id type — ids are generated with `nanoid(12)` (route.ts lines 3, 586, 643), so the PK is a 12-char text id, **not** a uuid. The FK column must be `text`.
- `on delete set null` keeps a child viewable if the source remix is deleted (chip just hides).
- Index because future lineage queries (and the Pattern Playbook milestone) filter by parent; cheap now.

### Where parent_id is written (verified insert sites)

There are **three** insert/upsert sites in `route.ts` — all must carry `parent_id`:
1. `buildInsertRow` (460–543) — the shared builder used by both branches. **Add `parent_id: validated.parent_id ?? null` here** (covers JSON insert line 589 and SSE upsert line 754).
2. SSE **placeholder** insert (643–662) — add `parent_id: validated.parent_id ?? null` so the in-flight row already has lineage (the GET-stream reconnect reads this placeholder).
3. (The safety-net UPDATE at 788–826 does not need it — `parent_id` is immutable after insert.)

`validated.parent_id` exists once `parent_id` is added to `AnalysisInputSchema` (the same schema edit as `mode`, §1 hop 5).

### "Remixed from" chip (UI, new)

- The child board reads `result.parent_id` from the hydrated row (shared cache). When non-null, render a chip linking to `/analyze/${parent_id}` (req #5 acceptance: "working link back to the source").
- Lowest-churn placement: the **Input frame** of the child board (`InputResultCard`, rendered at Board.tsx 470–477 and BoardMobile line 86) — it already presents the analyzed content, so a "remixed from <source>" chip belongs there. A new sub-element, not a new frame.
- Resolving the source label (parent's content/title) needs the parent row. **Recommendation:** extend `/api/analysis/[id]` to also return a minimal `parent: { id, content_text }` summary — one query, avoids a client waterfall.

### Recent list (verified — needs essentially no change)

`Sidebar.tsx` Recent is driven by `useAnalysisHistory()` (line 361) → `recentBoards = (historyData ?? []).slice(0, 8)` (362). It lists **all** the user's analyses chronologically with no parent/child filter (rows 538–577). **A developed child appears in Recent automatically** because it's a normal `analysis_results` row (req #5 acceptance "appears in Recent" = free). Optional enhancement: a small "remix" glyph on child rows — add `parent_id` to the `recentBoards` row shape (362–367) and whatever `useAnalysisHistory` selects. **Nice-to-have, not required** by the acceptance criteria.

---

## 6. Niche source (req #7) — minor integration

- `AnalysisStreamInput` already has `niche?: string` (line 66) and `creator_handle?: string` (67) — the transport exists, and `Board.tsx` already spreads `niche` into the submit input (line 310).
- Adapt generation needs the user's niche. Source from `creator_profiles` (the route already reads `creator_profiles` for `storage_retention_opted_in`, lines 340–345 — add a `niche` select alongside it), or read it client-side from `useProfile()` (sidebar already uses it, Sidebar.tsx import line 51).
- **Inline fallback:** if niche is empty when Remix is submitted, the Adapt frame prompts for it before concepts generate (req #7 acceptance). Lowest-churn: gate concept generation in the remix route branch on a non-empty niche; the Adapt frame renders an inline "enter your niche" prompt when its payload is empty-because-no-niche. A new small UI affordance, not a new data path.

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
| `src/components/app/tiktok-url-input.tsx` / `content-form` | Add Score/Remix toggle; carry `mode` on `ContentFormData` |
| `src/components/board/Board.tsx` (`handleContentSubmit` 282–312; slot arms 470–483; layout call line 98; `onDevelop` lift) | Spread `mode` into submit input; add `decode`/`adapt` slot arms; pass `mode` to `resolveBoardLayout` + `BoardMobile`; provide `onDevelop` to AdaptNode |
| `src/hooks/queries/use-analysis-stream.ts` (`AnalysisStreamInput` 59–68) | Add `mode`, `parent_id` (niche already present) |
| `src/app/api/analyze/route.ts` (395, 460–543, 643–662) | Add `mode`+`parent_id` to schema; branch pipeline on `mode==='remix'`; write both fields in `buildInsertRow` + placeholder insert; persist decode/adapt into `variants` |
| `src/lib/engine/types.ts` (`AnalysisInputSchema`, `PredictionResult`) | Add `mode`, `parent_id` to schema; type the decode/adapt payload (or read from `variants`) |
| `src/components/board/board-types.ts` (15–35) | Add `BoardMode`; extend `GroupId` with `'decode'`/`'adapt'`; add `modes` to `GroupFrameLayout` |
| `src/components/board/board-constants.ts` (`GROUP_FRAMES` 26–45; `resolveBoardLayout` 107–147; `computePresetTargets` 157–184; `AUTO_HEIGHT_FRAMES` 82–89) | Tag each frame with `modes`; add `decode`/`adapt` entries + geometry; add remix column plan to the layout functions |
| `src/components/board/BoardMobile.tsx` (24–31, 81–107) | Mode-aware `MOBILE_ORDER`; add `decode`/`adapt` cases to `renderBody` |
| `src/components/board/InputResultCard.tsx` | "Remixed from" chip when `result.parent_id != null` |
| `src/app/api/analysis/[id]/route.ts` | Return minimal `parent` summary for the chip label (avoid client waterfall) |
| `src/components/board/__tests__/board-constants.test.ts` | Cover remix layout (no holes, decode/adapt positioned, score layout unchanged) |
| `src/components/sidebar/Sidebar.tsx` (362–367) — *optional* | Add `parent_id` to `recentBoards` shape + remix glyph (nice-to-have) |
| `creator_profiles` read (route.ts 340–345 or `useProfile`) | Surface `niche` for Adapt grounding + inline fallback |

---

## 8. Suggested build order (ingestion spike gates everything)

Dependency-ordered; **Phase 1 is the spike and blocks Decode** (req #8 ⚠ is the milestone's stated first task).

**Phase 1 — Ingestion-depth spike (GATE, req #8).** Determine empirically what `/api/analyze` obtains for an **arbitrary, non-owned** TikTok URL: frames + transcript, or metadata only. Trace `input_mode: 'tiktok_url'` through `runPredictionPipeline` (route.ts line 693) into the engine's TikTok ingestion. Write `INGESTION-SPIKE.md`: the exact signal available + whether it's sufficient for structural Decode; if insufficient, document the remediation (e.g. a scrape/frame-extract step) **before Decode is planned**. **No frame work starts until this lands.** *Why first: Decode's entire value (and feasibility) depends on the answer.*

**Phase 2 — Mode flag plumbing (no UI swap yet).** Add `mode` to `AnalysisStreamInput` + `AnalysisInputSchema`; persist on the row (`buildInsertRow` + placeholder); add the toggle to the input + the `handleContentSubmit` spread. Checkpoint: a remix-mode submit produces a row with `mode='remix'` and still renders the existing board (frames not yet swapped). *Pure plumbing, no engine dependency — can run partly parallel with Phase 1.*

**Phase 3 — Frame registry made mode-aware + empty Decode/Adapt shells.** Add `BoardMode`, `modes` field, `decode`/`adapt` `GroupId`s; extend `resolveBoardLayout`/`computePresetTargets` with the remix column plan; add slot arms in `Board.tsx` (470–483) + `BoardMobile.renderBody`; register placeholder Decode/Adapt frames; update `board-constants.test.ts`. Checkpoint: remix board shows Input+Engine+Audience+Content Craft+Decode(empty)+Adapt(empty) on canvas **and** mobile, no holes; grade board unchanged. *Establishes the one-board-two-config skeleton; depends on Phase 2's `mode` value.*

**Phase 4 — Decode frame (depends on Phase 1 + 3).** Qwen-only decode generation in the remix route branch → persist into `variants`; `DecodeNode` renders structural teardown + repeatable-vs-luck. *Blocked by the spike: needs confirmed ingestion signal.*

**Phase 5 — Adapt frame + niche (depends on Phase 3 + req #7).** Qwen-only adapt generation grounded in `creator_profiles.niche` (inline fallback); `AdaptNode` renders exactly 3 concepts. *Independent of Decode generation; shares the remix route branch.*

**Phase 6 — Develop & predict + lineage (depends on Phase 5 + schema).** `parent_id` migration; thread `parent_id` through input → schema → both inserts; "Develop" button (via lifted `onDevelop`) calls existing `stream.start` with `parent_id` + `mode:'score'`; navigation reuses the existing `analysisId` push (Board.tsx 273–280); "remixed from" chip in `InputResultCard`; `/api/analysis/[id]` returns parent summary. Recent inclusion is free. *Last because it composes everything.*

**Phase 7 — Polish / regression.** Verify grade-mode board and existing analyze flow unchanged (acceptance); mobile card-stack absorbs Decode/Adapt; optional Recent remix glyph; Raycast styling pass on the two new frames.

```
P1 spike ─┬─▶ P4 Decode ───┐
          │                 ├─▶ P7 polish
P2 mode ──┴─▶ P3 registry ──┼─▶ P5 Adapt ─▶ P6 Develop+lineage ─┘
                            └────────────────┘
```

---

## 9. Risks — where one-board-two-config can go wrong

1. **`resolveBoardLayout` hardcodes the column composition by `GroupId` (MEDIUM — verified, scoped).** Confirmed by reading board-constants.ts 107–147: `resolveBoardLayout` does NOT generically pack an arbitrary frame list — it explicitly computes `inputH→engineY`, `verdictH→actionsY`, and places `content-analysis` under the taller column, referencing the six ids by name. `computePresetTargets` (157–184) likewise reads `byId.verdict` etc. So merely filtering `GROUP_FRAMES` to the remix set would leave `decode`/`adapt` **unpositioned**. **Mitigation:** Phase 3 extends these two pure functions with a `mode`-aware remix column plan (place `decode`/`adapt` in the x=864 right column, reuse the `verdictH→actionsY` stacking). ~30 lines, unit-testable, NOT a canvas refactor — the render layer (`resolvedFrames.map`) needs zero change. *Downgraded from a pre-read HIGH "unknown": the canvas rendering is generic; only the layout math is `GroupId`-specific, and that is the deliberate edit point.*

2. **Live vs permalink mode disagreement (MEDIUM).** Live: `mode` from `AnalysisStreamInput`. Permalink reload: `mode` from the persisted `result.mode`. **Verified:** `Board.tsx` reads the permalink row via its own `permalinkQuery` (132–142) → `initialData` to `useAnalysisStream` (145–147); every node mounts its own `useAnalysisStream` re-deriving from `queryKeys.analysis.detail(id)` (hook 450–508). If one renderer sources `mode` differently, canvas and a frame can disagree. **Mitigation:** compute `mode` once in `Board.tsx` near where it already destructures `stream.result` (397–409): `const mode = stream.result?.mode ?? inFlightMode ?? 'score'`; pass it to `resolveBoardLayout` + `BoardMobile`; branching frames read `result.mode` from the same shared cache. Single source = no disagreement.

3. **Ingestion insufficiency invalidates Decode (HIGH — the SPEC's own #1 risk).** If the spike (Phase 1) finds only metadata is available for non-owned URLs, Decode cannot do structural teardown without new ingestion work. **Mitigation:** the spike *is* Phase 1 and explicitly gates Decode; remediation is documented before any Decode UI is built.

4. **Latency UX on Develop (MEDIUM).** A developed child runs the full 90–312s pipeline. **Verified safe:** the existing `null→string analysisId` effect (Board.tsx 273–280) navigates *before* completion, and the streaming board handles in-flight state (placeholder row + stage events + the persistent "Analyzing your video" toast, Board.tsx 175–192). **Mitigation:** the Develop handler must NOT `await` completion before navigating — just call `stream.start(...)` and let the existing effect push. No new pattern.

5. **`variants` JSONB write races (LOW–MEDIUM).** Decode/adapt persistence into `variants` shares the bag with `persistCraftToVariants` (route.ts 104–147) and filmstrip extraction — both do read-merge-write and **race** (documented 89–103). A third writer increases race surface. **Mitigation:** follow the spread-merge pattern (`{ ...current, decode, adapt }`); never wholesale-overwrite `variants`. If contention proves real, promote decode/adapt to dedicated columns later (deferred).

6. **Mobile reading order assumes fixed frames (LOW).** `MOBILE_ORDER` (BoardMobile 24–31) is a hardcoded `GroupId[]`. Forgetting to make it mode-aware shows score-mode order with empty Verdict/Actions cards in remix. **Mitigation:** derive the mobile order from the mode-filtered registry (or two explicit arrays) — caught by the Phase-3 mobile checkpoint.

7. **JSON branch + cache parity (LOW).** `/api/analyze` has a JSON one-shot branch (route.ts 549–631) and a two-tier prediction cache keyed on `computeContentHash(validated)` (line 414). New fields (`mode`, `parent_id`) must be in `buildInsertRow` so **both** branches persist them. Critically, a remix-decode and a grade of the *same URL* must not collapse into one cache entry. **Mitigation:** include `mode` in `computeContentHash`'s input so the two don't alias.

8. **Frame count / refs assumptions (LOW).** `Board.tsx` builds `frameRefs` from `GROUP_FRAMES.length` and self-corrects if length changes (110–113), and `expanded` state is keyed by `GROUP_FRAMES` ids (90–92). These iterate the full registry, so adding `decode`/`adapt` entries is absorbed — but the `expanded` initializer keys *all* registry ids regardless of mode (harmless; unused ids just sit in state). Confirmed non-blocking.

---

## Confidence assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Mode flag transport (input→hook→route→row) | HIGH | `use-analysis-stream.ts`, `route.ts`, `Board.tsx` `handleContentSubmit` read verbatim |
| Develop→child run + navigation | HIGH | `start()`/`mutationFn`/`analysisId` push + Board.tsx router effect (273–280) read verbatim |
| parent_id schema + write sites | HIGH | All three insert sites located by line; nanoid text-id PK confirmed (route.ts 3, 586, 643) |
| Recent list inclusion | HIGH | `Sidebar.tsx` Recent reads all rows, no filter (361–367, 538–577) |
| Mobile frame swap | HIGH | `BoardMobile.tsx` registry+switch read verbatim |
| Canvas registry-driven reflow (Mechanism B) | HIGH | `Board.tsx` renders `resolvedFrames.map(...)` (435–485) off `resolveBoardLayout(measuredH)` (98); `layout.id===` slot pattern (470–483) is the Decode/Adapt mount point. Caveat: layout math is `GroupId`-specific (Risk #1) — a scoped one-function edit |
| Decode/Adapt frame contract | HIGH | `{camera,layout}` + self-hydrate confirmed in Board.tsx 480–483 and BoardMobile 97–103 |
| Ingestion depth for non-owned URLs | LOW (by design) | Unverified — req #8 spike; route only validates URL format (300–308), engine ingestion not traced |

## Open questions (for the spike / executor)

- **(Spike, req #8)** Does the engine pull frames/transcript for a non-owned TikTok URL, or metadata only? — gates Decode.
- **(Executor, Phase 3)** Implement the remix column plan in `resolveBoardLayout` + `computePresetTargets` (place `decode`/`adapt` in the x=864 right column); add `board-constants.test.ts` coverage. Canvas rendering itself needs no change.
- Exact `creator_profiles` column exposing niche (name) for Adapt grounding + inline fallback.
- Should `mode` participate in `computeContentHash` to avoid remix/score cache aliasing? (Recommended: yes.)
