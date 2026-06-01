# Phase 2: Remix Mode + One-Board-Two-Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 02-remix-mode-one-board-two-config
**Areas discussed:** Intent selector UX + form coupling, Mode-aware layout plan, Decode/Adapt empty-shell render, mode data model + persistence

---

## Intent Selector UX + Form Coupling

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level segmented control above tabs | Score/Remix segmented control above the text/Video/URL tabs | ✓ |
| Two top-level tabs, input adapts below | Score/Remix as primary tab row, sub-tabs adapt | |

**User's choice:** Top-level segmented control. User added: wants test/remix with input type ordered 1. Video 2. Link 3. Text; on a TikTok video or link, no caption/additional text field. Asked "what would Apple, Linear, Raycast do."

| Option | Description | Selected |
|--------|-------------|----------|
| Force URL-only in Remix | Lock Remix to TikTok URL field | |
| Keep all tabs, validate on submit | All tabs available, error on bad input | |

**User's choice:** Deferred — "I don't know what's best, could be useful to do remix with all kinds of input?" → resolved in follow-up.

| Option | Description | Selected |
|--------|-------------|----------|
| Score (preserve current behavior) | Default to Score, Remix opt-in | ✓ |
| Remember last used | Persist last intent | |

**User's choice:** Score (preserve current behavior).

### Follow-up: Remix input scope

| Option | Description | Selected |
|--------|-------------|----------|
| Video + Link, no Text, no caption | Remix shows Video+Link, Text hidden, no caption field | ✓ |
| Link-only in Remix | Just the TikTok Link field | |
| All three (Video/Link/Text) | Keep Text, error on submit | |

**User's choice:** Video + Link, no Text, no caption.
**Notes:** Claude argued Text cannot produce a structural Decode (no video signal) — make invalid states unrepresentable (Apple/Linear/Raycast principle). User agreed.

---

## Mode-Aware Layout Plan

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 positional swap | Decode→Verdict bounds, Adapt→Actions bounds | ✓ |
| New remix column plan now | Fresh bounds tuned to eventual content | |

**User's choice:** 1:1 positional swap.

| Option | Description | Selected |
|--------|-------------|----------|
| resolveBoardLayout(mode) returns frame set | Single source of truth for both configs | ✓ |
| Conditional frame swap at render | Swap component at render layer | |

**User's choice:** resolveBoardLayout(mode) returns frame set.

| Option | Description | Selected |
|--------|-------------|----------|
| Same slots as Verdict+Actions | Mobile cards in exact Verdict/Actions positions | ✓ |
| Decode + Adapt at the end | Append after Content Craft | |

**User's choice:** Same slots as Verdict+Actions.

---

## Decode/Adapt Empty-Shell Render

| Option | Description | Selected |
|--------|-------------|----------|
| Titled frame + quiet placeholder line | Title + one muted descriptor line | ✓ |
| Skeleton/shimmer | Loading-skeleton placeholders | |
| Bare titled frame only | Frame chrome + title, empty interior | |

**User's choice:** Titled frame + quiet placeholder line.

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral descriptor, no promise | "What it's for" line, no date | ✓ |
| Explicit "coming soon" | Label as upcoming | |

**User's choice:** Neutral descriptor, no promise.

---

## mode Data Model + Persistence

(All three questions deferred to Claude's recommendation — user: "what do you recommend" / "what you think is best".)

| Option | Description | Selected |
|--------|-------------|----------|
| `mode` | Matches spec wording; CHECK constraint | ✓ (Claude) |
| `analysis_mode` | More explicit vs input_mode | |

**Claude's call:** `mode` (text, `CHECK (mode IN ('score','remix'))`) — matches spec/ROADMAP wording referenced by Phases 3-5.

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix/segment mode into hash input | mode segmented into hashed string | ✓ (Claude) |
| Separate cache namespace by mode | mode in L2 lookup key | |

**Claude's call:** Segment mode into the hash input — hash is the single content identity; no cache-query-layer change.

| Option | Description | Selected |
|--------|-------------|----------|
| Default 'score', backfill existing | NOT NULL DEFAULT 'score' + backfill | ✓ (Claude) |
| Nullable, treat null as score | Nullable + coalesce at read | |

**Claude's call:** NOT NULL DEFAULT 'score' + backfill — total column, no scattered null-coalesce, zero regression.

---

## Claude's Discretion

- Segmented-control visual styling (Raycast design language).
- Exact Decode/Adapt shell descriptor copy (neutral, no promise).
- Migration filename/timestamp; TS union typing of `mode`.
- Selector state holding (local vs form state).
- All three `mode` data-model decisions (column name, hash inclusion, backfill) — user deferred.

## Deferred Ideas

- Last-used intent persistence — future.
- Decode content (Phase 3), Adapt content + niche (Phase 4), Develop/lineage + `parent_id` (Phase 5).
- Mode analytics/telemetry — out of scope.
