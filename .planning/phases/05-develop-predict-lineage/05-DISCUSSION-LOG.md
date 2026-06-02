# Phase 5: Develop & Predict + Lineage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 5-develop-predict-lineage
**Areas discussed:** Develop trigger & transition, What gets scored, "Remixed from" chip, Recent-list representation

User requested: always lead each answer with a recommendation (recommended option first). Honored throughout.

---

## Develop Trigger & Transition

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate immediately | Reuse existing `started`→`router.push('/analyze/[id]')`; land on child streaming board live; zero new nav code | ✓ |
| Stay, then navigate | Keep remix board, inline progress, auto-navigate on completion; needs new in-place progress UI | |
| Confirm first | Confirm modal before starting; adds friction to core payoff | |

**User's choice:** Navigate immediately
**Notes:** Consistent with grade-mode flow; remix source stays in Recent + reachable via chip. → D-01.

---

## What Gets Scored

| Option | Description | Selected |
|--------|-------------|----------|
| Assembled concept brief (text) | `input_mode='text'`; assemble hook + angle + format_borrowed into content_text; child labeled with hook | ✓ |
| Hook line only | Score just the hook string; discards angle/format context | |
| You decide the assembly | Lock text mode; leave field→content_text assembly to planning | |

**User's choice:** Assembled concept brief (text)
**Notes:** Concept has no video → text-prediction path. Exact assembly format + label = Claude discretion. → D-04/D-05/D-06.

---

## "Remixed From" Chip

| Option | Description | Selected |
|--------|-------------|----------|
| Source caption + link back | Chip 'Remixed from "[caption/@handle]"' → `/analyze/[parentId]`; minimal summary via `/api/analysis/[id]?summary` | ✓ |
| Generic label + link | 'Remixed from a viral video' → link; no source detail fetched | |
| Thumbnail + caption + link | Richer chip with thumbnail; NOT feasible — derive-and-drop persists no media | |

**User's choice:** Source caption + link back
**Notes:** Concrete navigable lineage; thumbnail ruled out by derive-and-drop IP boundary. → D-09/D-10.

---

## Recent-List Representation

| Option | Description | Selected |
|--------|-------------|----------|
| Tag remix rows, children normal | Children render normally (real score); remix/decode source rows get a "Remix" tag instead of a score number | ✓ |
| Uniform, no distinction | All rows same; risks blank score slot on null-score remix rows | |
| Children only | Hide remix/decode sources from Recent; loses source from history | |

**User's choice:** Tag remix rows, children normal
**Notes:** Backend already returns all rows (no completion filter); work is render-side tag + m3 hydration. → D-11/D-12.

---

## Claude's Discretion

- Exact `content_text` brief assembly + child label/title format.
- Develop trigger placement/styling/copy within the Phase 4 concept card.
- "Remixed from" chip styling/position + `?summary` response shape.
- "Remix" tag/icon design in Recent.
- Migration naming + FK-vs-plain-nullable for `parent_id`.
- Where the source remix id is held in remix-board client state.

## Deferred Ideas

- Bulk / batch developing multiple concepts — out of scope (cost/latency).
- Source video thumbnail in chip — not feasible under derive-and-drop.
- Richer lineage view (sibling tree) — beyond this milestone.
- Adapt concept-card shape / niche prompt — Phase 4 (ADAPT-01/02).
