---
phase: 02-omni-verbatim
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/lib/engine/qwen/schemas.ts
  - src/lib/engine/qwen/omni-analysis.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/types.ts
  - src/app/api/analyze/route.ts
  - src/lib/engine/version.ts
  - src/types/database.types.ts
  - supabase/migrations/20260604000000_persist_engine_verbatim_phase2.sql
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: resolved
resolution:
  fixed: [CR-01, WR-02]
  wontfix: [IN-02]
  deferred: [WR-01, WR-03, IN-01]
  fixed_in: 2026-06-04
---

# Phase 02: Code Review Report — Omni Verbatim Threading

> **Resolution (2026-06-04):** CR-01 fixed — verbatim now survives segment merge
> (concatenated, not dropped) and is no longer duplicated across the hook-zone split
> (continuation child `spoken_text` nulled; `on_screen_text` retained). 4 regression
> tests added in `normalize-segments.test.ts`. WR-02 fixed (migration null-contract
> comment corrected). IN-02 reviewed and intentionally left as-is (`!= null` is the
> correct present-flag guard; the suggested `!== undefined` would mislabel silence as
> present). WR-01 (hook vs segment field-name divergence), WR-03 (no segments-array
> length cap — per-field D-04.4 caps already bound element size), and IN-01 (null-guard
> style) deferred as low-severity polish. Full suite green (1776 passed).

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 2 adds verbatim transcription (hook-level `hook_verbatim` + per-segment `spoken_text`/`on_screen_text`) through the full stack: Zod schema → prompt → assembly object → aggregator pluck → `VerbatimPayload` → `PredictionResult` → two DB write paths (INSERT + SSE safety-net UPDATE) → a dedicated `verbatim` JSONB migration. Engine version bumped 3.1.0 → 3.2.0 to invalidate cached rows.

The plumbing is sound and mirrors the proven `emotion_arc` pattern. Two write sites (JSON INSERT and SSE UPSERT+UPDATE) both include `verbatim`, satisfying T-2-05. The migration is `ADD COLUMN IF NOT EXISTS` (non-destructive) and `database.types.ts` is regenerated to match.

One critical defect found: `normalizeSegments` silently drops `spoken_text`/`on_screen_text` from merged segments because `mergeSubMinSegments` uses a spread that only carries the *next* segment's text, discarding the shorter segment's text without a concatenation or selection strategy. This is the primary data-loss risk in the change. Three warnings cover a schema asymmetry, a silent empty-hook branch, and an unbounded payload size risk. Two info items cover minor quality issues.

---

## Critical Issues

### CR-01: mergeSubMinSegments drops verbatim from consumed segment on every merge

**File:** `src/lib/engine/qwen/normalize-segments.ts:144`
**Issue:** When a sub-1s segment is merged into its neighbor, the spread `{ ...nextSeg, t_start: seg.t_start }` retains only `nextSeg.spoken_text`/`nextSeg.on_screen_text` — the shorter segment's verbatim text is silently discarded. The same applies to the backward merge at line 156 (`{ ...prevSeg, t_end: seg.t_end }`). This is a net data-loss bug on any video where a natural scene boundary is < 1 s and carries speech (e.g., a quick spoken title card at the start of a reel). The segments phase 2 was specifically designed to capture become partially empty after normalization without any indication to the caller.

This file was not touched in this PR but is a direct consumer of the new `spoken_text`/`on_screen_text` fields on `SegmentGrid`; the schema change makes the silent drop observable where it was previously invisible.

**Fix:** When merging two segments, concatenate non-null spoken_text values with a space, and union non-null on_screen_text values (same or concatenated). At minimum, prefer the non-null text over null:
```typescript
// In mergeSubMinSegments, both merge paths:
const mergedSpokenText =
  seg.spoken_text && nextSeg.spoken_text
    ? `${seg.spoken_text} ${nextSeg.spoken_text}`
    : seg.spoken_text ?? nextSeg.spoken_text ?? null;
const mergedOnScreenText =
  seg.on_screen_text && nextSeg.on_screen_text
    ? `${seg.on_screen_text} ${nextSeg.on_screen_text}`
    : seg.on_screen_text ?? nextSeg.on_screen_text ?? null;
next.push({
  ...nextSeg,
  t_start: seg.t_start,
  spoken_text: mergedSpokenText,
  on_screen_text: mergedOnScreenText,
});
```

The same pattern applies to the `enforceHookZoneBoundary` split — the two child segments produced from a straddling segment both inherit the parent's verbatim wholesale (via `...seg`), so a segment spanning 2s–4s would have the full 2s-worth of text on the hook-zone half AND the post-hook half. This is over-propagation rather than loss, but it is semantically incorrect for downstream Apollo/Audience-Sim consumers that read per-segment speech.

---

## Warnings

### WR-01: Schema asymmetry — `hook_verbatim.spoken_words` vs `VerbatimPayload.hook.spoken_words` naming inconsistency creates silent field rename on every run

**File:** `src/lib/engine/qwen/schemas.ts:167-170`, `src/lib/engine/types.ts:30-32`
**Issue:** The Omni JSON response field is `hook_verbatim.spoken_words`. `OmniAnalysisZodSchema` parses it as `spoken_words`. The aggregator plucks it correctly. But `VerbatimPayload.hook` also uses `spoken_words`, and the per-segment counterpart on the schema is `spoken_text` (not `spoken_words`). The top-level hook field and the segment field use different names for semantically equivalent data (`spoken_words` vs `spoken_text`). Consumers reading `verbatim.hook.spoken_words` and `verbatim.segments[n].spoken_text` will have to track this naming split. If a future consumer writes a generic "get spoken text from verbatim" helper it will need special-casing.

This is not a runtime bug because the plumbing is explicit, but it is a latent inconsistency that will cause misread code in future R2/R3 consumers (Apollo rewrite path, Audience-Sim).

**Fix:** Standardize on one name throughout. `spoken_text` is used on segments and is more accurate. Update `VerbatimPayload.hook` to `spoken_text` (matching segments) and update the Omni schema `spoken_words` field name at parse time (via `.transform()` or rename at the assembly step in `omni-analysis.ts:277`). Or keep `spoken_words` but propagate it consistently to `SegmentGrid` too.

---

### WR-02: Hook-only `verbatim` object set to `null` when `hook_verbatim` is absent but segments carry text — `hook` key silently omitted

**File:** `src/lib/engine/aggregator.ts:539-552`
**Issue:** The hook pluck runs first and only writes `verbatim = { hook }` when `hookRaw` is truthy. If the model emits segments with `spoken_text` but omits `hook_verbatim` (legitimate — the model may decide the hook has no cleanly transcribable speech while body segments do), the `verbatim` object is left as `null` at the hook-pluck stage. The segment-fill block later at line 916-919 then constructs `{ segments: verbatimSegments }` — without a `hook` key. This is the correct shape for `VerbatimPayload` but is inconsistent with the intent described in the migration comment: "Full column null when video has no speech AND no on-screen text." A video with segment text but no hook text is NOT fully null, but downstream code checking `verbatim?.hook` would get `undefined` and might misread this as "hook text unavailable due to verbatim being absent" rather than "hook genuinely had no speech".

**Fix:** The current behavior is technically correct per the `VerbatimPayload` interface (both `hook` and `segments` are optional). But the migration comment should be updated to reflect this, and downstream consumers should be written to check `verbatim !== null` (data available) separately from `verbatim?.hook` (hook text available), not collapse them. No code change strictly required, but the comment on the SQL migration line 21 ("Full column null when video has no speech AND no on-screen text") is misleading and should say "...when hook AND all segments have no speech AND no on-screen text."

---

### WR-03: Unbounded `verbatim` JSONB payload on long videos — no segment count cap before DB write

**File:** `src/lib/engine/aggregator.ts:895-923`, `src/app/api/analyze/route.ts:598`
**Issue:** `verbatimSegments` is built from the full `omniSegments` array with no upper bound check. For a 10-minute video at 2s buckets that is 300 segments × (up to 500 chars `spoken_text` + 500 chars `on_screen_text`) = potentially ~300 KB of verbatim text per row. The `VerbatimPayload` interface and the `verbatim JSONB` column have no size guard. Supabase JSONB columns will accept this, but:
1. The `complete` SSE event sends the entire `finalResult` including `verbatim` to the client — a 300 KB verbatim object inside an SSE frame is not intended and may trip browser SSE buffering limits or Vercel edge response limits.
2. The analysis cache (`populatePredictionCache`) stores the full `PredictionResult` including verbatim in L1 (in-memory) — large verbatim objects inflate the memory footprint of the L1 cache on the server.

The immediate real-world risk is low (TikTok videos are capped and the model's segment count is bounded by the Zod `segments` array), but there is no explicit defense.

**Fix:** Cap verbatim segments before DB write. A practical cap of 50 segments (consistent with the 10-persona × 5-bucket heatmap budget) covers any real TikTok video:
```typescript
const MAX_VERBATIM_SEGMENTS = 50;
const cappedSegments = verbatimSegments.slice(0, MAX_VERBATIM_SEGMENTS);
```

---

## Info

### IN-01: `emotion_arc` guard uses `Array.isArray + .length > 0` but `verbatim` hook guard uses truthiness — inconsistent null-guard style

**File:** `src/lib/engine/aggregator.ts:527-530` vs `540-552`
**Issue:** The `emotion_arc` pluck explicitly checks `Array.isArray(arcRaw) && arcRaw.length > 0`. The `hook_verbatim` pluck just checks `if (hookRaw)`. These are functionally equivalent for these types, but the inconsistency makes the code harder to scan and violates the pattern the comments themselves point to ("same pattern as emotion_arc"). Minor.

**Fix:** Use the same explicit guard style, or document why `hook_verbatim` can rely on truthiness (it can, since it's an object, not an array).

---

### IN-02: `verbatim_present` log field uses `!= null` loose equality — inconsistent with codebase `!== null` convention

**File:** `src/lib/engine/qwen/omni-analysis.ts:283`
**Issue:**
```typescript
verbatim_present: data.hook_verbatim != null
```
Uses loose `!=` rather than strict `!== null && data.hook_verbatim !== undefined`. The codebase uses strict equality throughout (all other null checks in this file use `!==`). Since `hook_verbatim` is typed as `{ ... } | undefined` from Zod inference, loose `!= null` is actually correct (catches both `null` and `undefined`), but the style inconsistency is a lint-bait and someone will flip it to `!== null` in a future pass, changing behavior for the `undefined` case.

**Fix:**
```typescript
verbatim_present: data.hook_verbatim !== undefined
```
This matches the actual type (Zod `.optional()` produces `T | undefined`, not `T | null`) and is explicit about what's being checked.

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
