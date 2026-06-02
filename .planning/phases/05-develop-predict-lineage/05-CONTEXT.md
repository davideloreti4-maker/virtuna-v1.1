# Phase 5: Develop & Predict + Lineage - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Each Adapt concept exposes **"Develop & predict →"** that runs **that single concept** through the existing `/api/analyze` SSE pipeline, producing **one scored `/analyze/[id]` child board** and navigating to it (no bulk scoring — zero streams until click, then exactly 1). The developed **child stores a non-null `parent_id`** (the source remix analysis id), shows a working **"remixed from" chip** linking back to the source, and **appears in the sidebar Recent** list. This phase also owns the **grade-mode regression sweep** and **Raycast / mobile card-stack / error-boundary polish** on the two new frames (Decode + Adapt).

**Delivers:** DEVELOP-01 (per-concept Develop → one scored child via existing pipeline, no bulk), DEVELOP-02 (child stores `parent_id`, "remixed from" chip, appears in Recent).

**Explicitly NOT this phase:**
- The Adapt frame body / concept generation / niche prompt (Phase 4 — ADAPT-01/02). Phase 5 only adds the per-concept Develop trigger onto whatever concept-card shape Phase 4 lands.
- The Decode frame body (Phase 3 — complete).
- Any *new* scoring capability — Develop reuses the existing `/api/analyze` pipeline unchanged; no new engine path.
- Bulk / auto-scoring of all concepts (explicitly out of scope — cost/latency prohibitive).

**Sequencing note:** Phase 4 (Adapt) is not yet built. Phase 5 composes Phase 4's concept output. The Develop/lineage decisions below are independent of Adapt's internals, but the **concept-card shape Develop hangs off is Phase 4's to lock** — planning must treat the concept object shape (`variants.remix.adapt[]`) as a Phase 4 contract, not invent it here.

</domain>

<decisions>
## Implementation Decisions

### Develop Trigger & Transition (DEVELOP-01)
- **D-01:** **On click → navigate immediately.** "Develop & predict →" reuses the existing `started`-event → `router.push('/analyze/[id]')` pattern (Board.tsx ~line 57): the user lands on the child's **streaming board right away** and watches it score live. Zero new navigation code; identical to the grade-mode flow. Rejected: stay-on-remix-with-inline-progress (needs new in-place progress UI, diverges from existing flow) and confirm-modal-first (friction on the core payoff).
- **D-02:** **Exactly one stream per click, zero until click** (pitfall C3). The other concepts are NOT scored unless separately developed. No prefetch, no bulk. One Develop click = one `/api/analyze` submission = one child row.
- **D-03:** The Develop affordance is **one trigger per concept card** (a primary "Develop & predict →" action on each of the 3 Adapt concepts). Exact placement/styling within the concept card follows Phase 4's card layout + Raycast design language (Claude discretion, see below).

### What Gets Scored (DEVELOP-01)
- **D-04:** A concept (`{hook, angle, who_its_for, format_borrowed}`) has **no video**, so Develop submits **`input_mode='text'`** — the pipeline's existing text-prediction path. The concept is **assembled into a single `content_text` brief** (hook + angle + format_borrowed) so the prediction reflects the full concept, not just the hook line. Rejected: scoring the hook string alone (throws away the angle/format context that makes the prediction meaningful).
- **D-05:** The child is **labeled with the concept's hook** (or equivalent recognizable concept identifier) so it's identifiable in the Recent list. Exact `content_text` assembly format and the child label string are Claude discretion (see below).
- **D-06:** The developed child is a **standard scored analysis** — it runs the full pipeline, gets a real `overall_score`, and renders as a normal score board. It is distinguished from ordinary analyses *only* by `parent_id != null`. (It is NOT a remix/decode row; `variants.remix` is null on the child, `overall_score` is populated.)

### Lineage: parent_id (DEVELOP-02)
- **D-07:** `parent_id` = the **source remix analysis id** — stable and known *before* Develop starts (NOT derived from the child's `started` SSE frame), passed in the Develop request body. **Written at all three insert sites** in `route.ts` (placeholder INSERT ~682, JSON-branch `buildInsertRow` ~626, SSE-branch UPSERT ~833). `buildInsertRow()` signature must accept `parent_id`.
- **D-08:** **New migration required** — `analysis_results` has no `parent_id` column today. Add nullable `parent_id` (FK → `analysis_results(id)`), regenerate `database.types.ts`. This phase owns the migration.

### "Remixed From" Chip (DEVELOP-02)
- **D-09:** The chip on the child board reads **'Remixed from "[source caption / @handle]"'** and links to **`/analyze/[parentId]`** (the source remix/decode board). Concrete, navigable lineage — not a generic label.
- **D-10:** The chip's parent detail comes from a **minimal parent summary** via `/api/analysis/[id]` (add a `?summary` param returning id + caption/handle + created_at, NOT the full row). Rejected: thumbnail-based chip — **derive-and-drop means source media is never persisted**, so there is no stored thumbnail to show.

### Recent-List Representation (DEVELOP-02)
- **D-11:** **Developed children render normally** in Recent (they have a real `overall_score`). **Remix/decode source rows get a small "Remix" tag/icon** instead of a score number (they have `overall_score = null` — no number to show). Both appear in Recent; the tag distinguishes the un-scored remix source from scored analyses. Rejected: uniform rendering (risks a blank score slot on null-score rows) and hiding remix sources (loses the source from history; only reachable via the child chip).
- **D-12:** Recent list backend already returns all non-deleted rows (no completion filter) — so remix rows already surface. The work is the **render-side tag** + ensuring remix/decode rows hydrate correctly (completion marker `variants.remix != null`, pitfall m3).

### Polling / Hydration (DEVELOP-02 SC#4)
- **D-13:** The permalink completion gate (`use-analysis-stream.ts` ~line 412) currently transitions on `overall_score != null` — this **never fires for remix rows** (null score). Add the distinct marker: complete when `overall_score != null` **OR** `variants.remix != null`. **Lift the 90s polling ceiling** (~line 422) for remix-developed children (developed children run the full ~90–332s pipeline, exceeding the current 90s hard timeout).

### Regression & Polish (this phase owns)
- **D-14:** Full **grade-mode regression sweep**: grade board + existing analyze flow unchanged (no remix change leaks into the score path). Plus **Raycast styling, error boundaries, and mobile card-stack (<768px)** verification on both Decode and Adapt frames.

### Claude's Discretion
- Exact `content_text` brief assembly from the concept fields (hook + angle + format_borrowed → one string) and the child's label/title format.
- Exact placement, styling, and copy of the "Develop & predict →" trigger within the Phase 4 concept card (per Raycast design language).
- Exact "remixed from" chip styling, position on the child board, and the `?summary` response shape from `/api/analysis/[id]`.
- Exact "Remix" tag/icon design in the Recent list.
- Migration file naming + whether `parent_id` carries an FK constraint vs. plain nullable text (decide against existing migration conventions).
- Where the source remix analysis id is held in the remix-board client state so it's available to the Develop request (must be stable, pre-known).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — DEVELOP-01, DEVELOP-02 acceptance; Out of Scope (no bulk auto-scoring; derive-and-drop IP boundary; Qwen-only; TikTok-only).
- `.planning/ROADMAP.md` §"Phase 5: Develop & Predict + Lineage" — goal + 5 success criteria; pitfalls C3 (one stream per click), m3 (completion marker `variants.remix != null`).
- `.planning/milestones/viral-remix-SPEC.md` — locked seed reqs 4 (Develop) + 5 (lineage).

### Upstream phases (dependencies)
- `.planning/phases/03-decode-frame/03-CONTEXT.md` — D-10 (`variants.remix.decode` persistence; remix row `overall_score = null`; completion marker `variants.remix != null`); D-07 (Decode = analysis / Adapt = personalization seam).
- `.planning/phases/04-adapt-frame-niche/04-CONTEXT.md` *(Phase 4 — not yet created)* — **the concept-card shape + `variants.remix.adapt[]` object contract Develop hangs off. Develop's trigger placement (D-03) and concept-brief assembly (D-04) depend on this. Re-read once Phase 4 lands.**
- `.planning/phases/02-remix-mode-one-board-two-config/02-CONTEXT.md` — mode threading, board mode-awareness, `mode` folded into content hash.

### Pipeline & Insert Sites (parent_id threading — D-07)
- `src/app/api/analyze/route.ts` — entrypoint (~268). **Three insert sites:** placeholder INSERT (~682–701), JSON-branch `buildInsertRow` (~626–629), SSE-branch UPSERT (~833–838). `buildInsertRow()` definition ~500–584 — must accept `parent_id`. Request validated by `AnalysisInputSchema` (import ~line 8).
- `src/lib/...` `AnalysisInputSchema` (Zod) — add optional `parent_id` to the request schema.

### Lineage & Chip
- `src/app/api/analysis/[id]/route.ts` (~10–179) — GET returns full row today; add a minimal `?summary` parent-summary response for the chip (D-10).
- `src/types/database.types.ts` (`analysis_results` ~180–348) — **no `parent_id` column yet**; add via migration + regenerate (D-08).
- `supabase/migrations/` — convention reference for the new `parent_id` migration.

### Recent List & Hydration
- `src/components/sidebar/use-sidebar-queries.ts` (~24–44, `useSidebarRecent`) + `src/app/api/analysis/history/route.ts` (~9–42) — returns all non-deleted rows, no completion filter (remix rows already surface). Render-side "Remix" tag work (D-11).
- `src/hooks/queries/use-analysis-stream.ts` — completion gate (~412, `overall_score != null`) + 90s polling ceiling (~422–431). Add `variants.remix != null` marker + lift ceiling for developed children (D-13).
- `src/components/board/Board.tsx` (~57) — `started`-event → `router.push('/analyze/[id]')` navigation pattern Develop reuses (D-01).

### Frames to polish (D-14)
- `src/components/board/adapt/AdaptShellNode.tsx` — current stub; Phase 4 fills the body, Phase 5 adds the Develop trigger + polishes.
- `src/components/board/decode/DecodeShellNode.tsx` — Phase 3 body; Phase 5 polish/error-boundary/mobile sweep.
- `src/components/board/BoardMobile.tsx` — mobile card-stack (<768px) verification.

### Design language
- `CLAUDE.md` §"Raycast Design Language Rules" + `BRAND-BIBLE.md` — chip, Develop trigger, Recent tag styling (6% borders, Inter, 12px radius, no glow/tint).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Existing `/api/analyze` SSE pipeline** — Develop submits to it unchanged (`input_mode='text'`). No new engine path; the entire scoring path is reused.
- **`started`-event → `router.push` navigation** (Board.tsx ~57) — Develop reuses this verbatim; no new navigation code (D-01).
- **`/api/analysis/[id]` GET route** — already exists; extend with a `?summary` param for the chip (D-10).
- **Recent list query** (`use-sidebar-queries.ts` + `history/route.ts`) — already returns all non-deleted rows including remix; only render-side tag is new (D-11).
- **`use-analysis-stream` polling** — exists; needs the `variants.remix` marker + ceiling lift, not a rewrite (D-13).

### Established Patterns
- **`buildInsertRow()` is the single row-builder** for two of three insert sites — adding `parent_id` there covers them both; the placeholder INSERT is a separate inline literal that must also be threaded (D-07).
- **`variants` JSON column** for remix payloads (`variants.remix.decode` from Phase 3) — the child does NOT use it (child is a standard scored row); lineage is the new scalar `parent_id` column.
- **Qwen-only** — Develop runs the existing Qwen pipeline; no new model call introduced this phase.
- **Server components by default; client only when interactive** — board/frames already client.

### Integration Points
- Adapt concept card "Develop & predict →" → `/api/analyze` (`input_mode='text'`, `content_text`=concept brief, `parent_id`=source remix id) → `started` event → navigate to `/analyze/[childId]`.
- Child board → "remixed from" chip → `/api/analysis/[parentId]?summary` → link to `/analyze/[parentId]`.
- Source remix id (held in remix-board client state, stable/pre-known) → Develop request body `parent_id`.
- Migration: `analysis_results.parent_id` (nullable FK) → `database.types.ts` regen → `buildInsertRow` + placeholder INSERT + `AnalysisInputSchema`.

</code_context>

<specifics>
## Specific Ideas

- **"Develop" = the payoff that closes the loop** — paste viral video → Decode why → Adapt to niche → Develop one concept into a real scored prediction. Develop is the bridge from remix-analysis back into the core engine.
- **Lineage must be honest and navigable** — the chip shows the actual source ("Remixed from '[caption]'"), not a vague label; clicking it returns to the real source board. The relationship is concrete in both directions (parent_id down, chip up).
- **The child is a real analysis, not a special case** — once developed, it's a normal scored board indistinguishable from any other except for the lineage chip + `parent_id`. Keeps the engine path untouched and the regression surface minimal.
- **One click, one stream** — the C3 discipline (zero streams until click, then exactly one) is the cost/latency guardrail that makes per-concept Develop viable where bulk scoring was rejected.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk / batch developing multiple concepts at once** — explicitly out of scope (cost/latency); one concept per click only.
- **Source video thumbnail in the chip** — not feasible under derive-and-drop (media never persisted). Would require a deliberate thumbnail-capture decision in a future phase.
- **Richer lineage view** (tree of all children of a source, "siblings") — beyond this milestone; only the single parent→child chip + parent_id are in scope.
- **Adapt concept-card shape / niche prompt** — Phase 4 (ADAPT-01/02); Develop only consumes the resulting concept objects.

</deferred>

---

*Phase: 05-develop-predict-lineage*
*Context gathered: 2026-06-02*
