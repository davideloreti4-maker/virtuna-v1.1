---
phase: 02-remix-mode-one-board-two-config
reviewed: 2026-06-01T12:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/app/api/analyze/route.ts
  - src/components/app/content-form.tsx
  - src/components/board/Board.tsx
  - src/components/board/BoardMobile.tsx
  - src/components/board/GroupFrameOverlay.tsx
  - src/components/board/board-constants.ts
  - src/components/board/board-types.ts
  - src/components/board/adapt/AdaptShellNode.tsx
  - src/components/board/decode/DecodeShellNode.tsx
  - src/hooks/queries/use-analysis-stream.ts
  - src/lib/engine/cache/prediction-cache.ts
  - src/lib/engine/corpus/eval-runner.ts
  - src/lib/engine/learning/predict.ts
  - src/lib/engine/types.ts
  - src/types/database.types.ts
  - supabase/migrations/20260601000000_add_mode_to_analysis_results.sql
  - src/app/api/analyze/__tests__/derive-and-drop.test.ts
  - src/components/app/__tests__/content-form.test.tsx
  - src/components/board/__tests__/BoardMobile.test.tsx
  - src/components/board/__tests__/board-constants.test.ts
  - src/components/board/adapt/__tests__/AdaptShellNode.test.tsx
  - src/components/board/decode/__tests__/DecodeShellNode.test.tsx
  - src/lib/engine/__tests__/analysis-input-schema.test.ts
  - src/lib/engine/__tests__/deepseek.test.ts
  - src/lib/engine/__tests__/pipeline.test.ts
  - src/lib/engine/__tests__/prediction-cache.test.ts
  - src/lib/engine/__tests__/tiktok-url-branch.test.ts
  - src/lib/engine/__tests__/trends.test.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-01T12:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This phase adds a `mode` enum (`score`/`remix`) threading from the intent selector in `content-form` through the POST body, both DB INSERT sites in `analyze/route.ts`, the `computeContentHash` cache key, and the `resolveBoardLayout` frame-swap. The core remix wiring is structurally sound. Three critical issues were found: a score-path hash regression introduced by `computeContentHash`'s text-mode code path, a `mode` column type drift between migration and TypeScript types, and a missing `mode` field in the safety-net UPDATE that can leave the DB row in a `score`-labelled state even after a remix analysis completes. Five warnings cover edge cases in the board layout, form coupling, and DB column ordering.

---

## Critical Issues

### CR-01: `computeContentHash` folds `mode=remix` into text-mode hashes, breaking the score-path-stable invariant

**File:** `src/lib/engine/cache/prediction-cache.ts:50-53`

**Issue:** For `input_mode === "text"`, the function appends `::mode=remix` when `input.mode === "remix"`. But the `AnalysisInputSchema` refine at `types.ts:171-173` **rejects** `{ mode: "remix", input_mode: "text" }` — that combination never reaches the cache. The append is therefore dead code for the text path. The test `score-path-stability → score-mode hash equals hash of same input without mode field` passes a raw `AnalysisInput` cast that bypasses the Zod refine, so it exercises the dead branch and compiles a fixture against it. If the refine is ever relaxed (e.g., to allow remix captions), the text-mode hash will silently diverge from all pre-existing text-mode cache rows — a silent cache-poisoning regression.

More immediately: the `EXPECTED_SCORE_HASH` fixture in `prediction-cache.test.ts:209` is computed with `mode: "score"` on a `tiktok_url` input where the mode segment is NOT appended (correct). But the equivalent text-mode fixture test does NOT exist in the test file, meaning a developer who changes the text-mode `if (input.mode === "remix")` block has no pinned hash to catch the regression.

**Fix:** Remove the dead `if (input.mode === "remix") h.update("::mode=remix")` block from the `h.update((input.content_text ?? "").trim())` path entirely. Text+remix is schema-rejected; the fold only needs to exist for `video_upload` and `tiktok_url` paths (where it already does, correctly). Also add a pinned hash fixture for text-mode score input to prevent future regression.

```typescript
// prediction-cache.ts — text-mode branch (lines 50-53)
h.update((input.content_text ?? "").trim());
// REMOVE the following — dead code; text+remix is Zod-rejected:
// if (input.mode === "remix") h.update("::mode=remix");
return h.digest("hex");
```

---

### CR-02: `mode` column type in migration is plain `TEXT` but `database.types.ts` declares it as non-nullable `string` with no enum constraint at the TypeScript layer

**File:** `supabase/migrations/20260601000000_add_mode_to_analysis_results.sql:7` and `src/types/database.types.ts:208`

**Issue:** The migration adds `mode TEXT NOT NULL DEFAULT 'score' CHECK (mode IN ('score', 'remix'))`. The TypeScript types in `database.types.ts` reflect `mode: string` (Row) and `mode?: string` (Insert/Update). The `buildInsertRow` in `route.ts:434` writes `mode: validated.mode` where `validated.mode` is typed as `"score" | "remix"`. However, the **safety-net UPDATE** at `route.ts:729-762` (the explicit targeted UPDATE that fires for the SSE branch before `send("complete")`) **does not include `mode`** in its SET clause.

This means if the placeholder INSERT at line 586 writes `mode: validated.mode` correctly but the UPSERT at line 692 also writes it correctly, the safety-net UPDATE at line 727 then issues a second UPDATE that sets `overall_score`, `confidence`, and many other columns — but does NOT set `mode`. This is normally harmless because the UPSERT already wrote `mode`. However, the safety-net UPDATE also runs `WHERE user_id = user.id` — if the UPSERT silently conflicted and fell back to INSERT (an edge the comment at line 721-723 explicitly acknowledges as a concern), the `mode` column could be missing from the corrective write path, leaving the row with whatever the DB DEFAULT (`score`) is rather than the submitted intent.

The deeper issue: the TypeScript types do not express the `"score" | "remix"` union, so any cast back from the DB row (e.g., in `rowToPredictionResult`) leaves `mode` typed as `string`, not the union. This means `boardMode` derivation in `Board.tsx:166-168` that reads `permalinkQuery.data?.mode` must narrow it at runtime, which it does via the type assertion `(permalinkQuery.data as { mode?: 'score' | 'remix' } | null)?.mode` — safe enough, but brittle.

**Fix:** Add `mode` to the safety-net UPDATE clause, and tighten the TypeScript type to `"score" | "remix"` for `analysis_results.mode`:

```typescript
// In route.ts safety-net UPDATE (around line 750):
.update({
  overall_score: finalResult.overall_score,
  // ... existing fields ...
  mode: validated.mode,   // ADD THIS LINE
  updated_at: new Date().toISOString(),
})
```

For the types, after next Supabase type regen, the generated type should be `mode: 'score' | 'remix'`. Until then, add a cast helper or branded type to prevent silent widening.

---

### CR-03: `database.types.ts` Insert type has `id: string` (REQUIRED, no `?`), but the JSON-branch INSERT at `route.ts:529-531` passes `id: jsonInsertId` — which is correct — however `mode` is listed in the `Insert` type as `mode?: string` (optional), while the DB schema adds it as `NOT NULL DEFAULT 'score'`

**File:** `src/types/database.types.ts:259-260` and `src/app/api/analyze/route.ts:586-603`

**Issue:** The `analysis_results` Insert type in `database.types.ts` declares `mode?: string` (optional). The placeholder INSERT at route.ts line 586-603 correctly includes `mode: validated.mode`. However, TypeScript does NOT enforce this presence because the field is marked optional in the generated types — a future developer removing `mode: validated.mode` from the placeholder INSERT will get no compile error, and the DB will silently fall back to `DEFAULT 'score'` even on a remix submission, causing silent persistence failure.

This is a type-accuracy bug: the generated types reflect an optional field but the DB column is `NOT NULL`. The types.ts file was not regenerated after the migration ran, so the `mode` column was manually added to `database.types.ts` with incorrect optionality in the Insert type.

**Fix:** Update `database.types.ts` Insert type for `analysis_results` to mark `mode` as required (matching the NOT NULL constraint):

```typescript
// database.types.ts — analysis_results Insert:
mode: string   // NOT mode?: string
```

This makes it a compile-time error to omit `mode` from any INSERT.

---

## Warnings

### WR-01: `resolveBoardLayout` remaps `verdict`→`decode` and `actions`→`adapt` at the return-frame level, but `measuredH` keys in Board.tsx are still indexed by the original `GroupId` values (`verdict`, `actions`)

**File:** `src/components/board/board-constants.ts:164-168` and `src/components/board/Board.tsx:99`

**Issue:** `measuredH` state in `Board.tsx` is typed as `Partial<Record<GroupId, number>>`. In remix mode, `GroupFrameOverlay` calls `onMeasure` with the remapped layout's `id` (i.e., `'decode'` and `'adapt'`). `handleMeasureFrame` stores those heights under the `decode`/`adapt` keys. When `resolveBoardLayout` is called with those measured heights, it looks up `h('verdict')` and `h('actions')` — but those keys won't be present in `measuredH` (the remix overlay reported under `decode`/`adapt`). Result: in remix mode, the Decode/Adapt frames never get their measured heights applied; they always fall back to the constant floor.

```typescript
// board-constants.ts h() lookup:
const verdictH = h('verdict');  // measured['verdict'] → always undefined in remix mode
const actionsH = h('actions');  // measured['actions'] → always undefined in remix mode
```

**Fix:** In `resolveBoardLayout`, when in remix mode, also check `measured['decode']` for the verdict slot and `measured['adapt']` for the actions slot:

```typescript
const verdictH = mode === 'remix'
  ? (h('decode' as GroupId) || h('verdict'))
  : h('verdict');
const actionsH = mode === 'remix'
  ? (h('adapt' as GroupId) || h('actions'))
  : h('actions');
```

Or, alternatively, have `handleMeasureFrame` in Board.tsx normalize remix IDs back to their score equivalents before storing.

---

### WR-02: `handleIntentChange` closure captures `activeTab` but is not in the `useCallback` dependency array — stale closure risk

**File:** `src/components/app/content-form.tsx:241-249`

**Issue:** `handleIntentChange` is defined with `useCallback([activeTab])` (line 249) — the dependency IS listed. However, the inner `setFormData((prev) => ({ ...prev, mode: newIntent }))` at line 246 runs the functional updater form correctly, but the outer `setActiveTab("video_upload")` at line 244 and `setFormData((prev) => ({ ...prev, input_mode: "video_upload" }))` at line 245 run as a separate call — this is fine. The actual bug is more subtle: `handleIntentChange` re-creates on every `activeTab` change. Any child component that receives `handleIntentChange` as a prop (e.g., a memoized segmented control) would rerender on every keystroke in the text tab since `activeTab` changes on tab switch. This is a performance quality issue with minor functional risk (no stale state bug, just unnecessary re-renders in React 18 strict mode).

More importantly: the `handleIntentChange` at line 244 calls `setActiveTab` and then immediately `setFormData` with `input_mode`. React batches these in a single render (React 18), so this is safe. But the comment at line 239 says "coupling reset must mirror handleTabChange body" — `handleTabChange` (line 229) calls `setErrors({})` at the end. `handleIntentChange` also calls `setErrors({})`. However, `handleTabChange` updates `formData.input_mode` via `setFormData((prev) => ({ ...prev, input_mode: mode }))` which is a separate state setter. When `handleIntentChange` resets to `video_upload`, it calls TWO `setFormData` updaters (lines 246 and 245 in sequence), both using the functional form. React will batch them, so the second one receives the state after the first applied — this is correct. No functional bug here, just the noise.

**Fix:** Minor — extract the activeTab reset logic into a single `setFormData` call to reduce cognitive load and ensure atomic state update:

```typescript
if (newIntent === "remix" && activeTab === "text") {
  setActiveTab("video_upload");
  setFormData((prev) => ({ ...prev, input_mode: "video_upload", mode: newIntent }));
} else {
  setFormData((prev) => ({ ...prev, mode: newIntent }));
}
```

---

### WR-03: `BoardMobile` receives `boardMode` as an optional prop defaulting to `'score'`, but `Board.tsx` passes the live `boardMode` value — there is a flash-of-wrong-mode on permalink load

**File:** `src/components/board/Board.tsx:456` and `src/components/board/BoardMobile.tsx:86`

**Issue:** `boardMode` in `Board.tsx` defaults to `'score'` (line 165, `submittedIntent` starts as `'score'`). On permalink load (`/analyze/[id]`), `permalinkQuery.data` is null until the API call resolves. During that window (typically 100-500ms), `boardMode` evaluates to `submittedIntent = 'score'`, and `BoardMobile` renders the score card order (`Input, Score, Audience, Actions, Content craft, Engine`). When `permalinkQuery.data` resolves and carries `mode: 'remix'`, the component re-renders with the remix order. Users on slow connections will see a brief layout flash from score to remix order on permalink load.

**Fix:** Derive `boardMode` from `permalinkQuery.data` first when on a permalink route (before `submittedIntent`), which is what the comment at lines 160-168 describes — but `permalinkQuery.data?.mode` is only consumed as the second priority after `stream.result?.mode`. This is correct in theory, but `stream.result` is always `null` on fresh permalink load and `permalinkQuery.data` may still be loading. The actual fix is to show a loading/skeleton state in `BoardMobile` until `permalinkQuery.data` has settled when `urlAnalysisId` is present:

```typescript
// Board.tsx — pass a loading flag to BoardMobile
const boardModeLoading = !!urlAnalysisId && permalinkQuery.isLoading;

<BoardMobile
  boardMode={boardModeLoading ? undefined : boardMode}
  // ... rest of props
/>
```

---

### WR-04: The Zod refine for `remix+text` rejection uses `{ message: "..." }` but does not pass a `path`, so `ZodError` surfaces as a top-level issue — the route's catch block at `route.ts:341` returns the entire Zod error message string which may leak implementation detail to the client

**File:** `src/lib/engine/types.ts:171-173` and `src/app/api/analyze/route.ts:341`

**Issue:** When Zod validation fails, `route.ts:341` returns `error instanceof Error ? error.message : "Invalid input"`. For Zod errors, `error.message` is a serialized `ZodError.message`, which by default includes the full path, value, and issue description: `"[ { message: 'Remix mode requires a video or link source, not text', path: [] } ]"`. This leaks the schema refine message verbatim to the client, which is acceptable for user-facing copy (the message is intentionally readable) but it also leaks the JSON array wrapper shape, revealing internal schema structure. A malicious client could probe which fields trigger which specific Zod refinements.

Additionally, the `input_mode === "text"` check in the refine fires before the `required field missing` refine (order-of-refine evaluation) — this is fine. But the error message format is `ZodError.message` which serializes as a JSON string, not a plain English sentence. The client receives `"[\n  {\n    \"message\": \"Remix mode requires...\"\n  }\n]"` as the `error` field value.

**Fix:** Normalize Zod errors at the catch boundary in `route.ts`:

```typescript
// route.ts line 341-345
} catch (error) {
  cleanupRawUpload(service, body as Record<string, unknown>, retentionOptedIn, log);
  const message = error instanceof ZodError
    ? error.errors[0]?.message ?? "Invalid input"
    : error instanceof Error ? error.message : "Invalid input";
  return Response.json({ error: message }, { status: 400 });
}
```

This requires importing `ZodError` from `zod`.

---

### WR-05: `computePresetTargets` has a non-null assertion `byId.engine!` that crashes if `engine` frame is absent from the resolved layout

**File:** `src/components/board/board-constants.ts:185-187`

**Issue:** `computePresetTargets` builds `byId` from whatever frames `resolveBoardLayout` returns. In both score and remix modes, `engine` is always present (it's never swapped). However, the function asserts `byId.engine!` — if `resolveBoardLayout` is ever called with a filtered frame list (e.g., a future "collapsed" mode omitting the engine frame), this will throw `TypeError: Cannot read properties of undefined`. The same pattern is used for `inp = byId.input!` and `aud = byId.audience!`. All three are hot paths during every layout reflow.

The test `computePresetTargets does not throw on a remix-resolved frame set` passes today because remix preserves these frames, but there is no guard.

**Fix:** Add explicit guards or use optional chaining with a fallback:

```typescript
const inp = byId.input ?? byId.engine ?? { x: 0, y: 0, width: 0, height: 0 };
// OR assert with a meaningful error:
if (!byId.input || !byId.engine || !byId.audience) {
  throw new Error('computePresetTargets: required frames missing from layout');
}
```

---

## Info

### IN-01: `CAMERA_PRESET_TARGETS` static constant in `board-constants.ts` is never updated in remix mode — it always points to the score-mode `verdict` frame bounds

**File:** `src/components/board/board-constants.ts:64-75`

**Issue:** `CAMERA_PRESET_TARGETS` is a module-level constant derived from `GROUP_FRAMES` (score-mode frames only). The `computePresetTargets` function correctly handles remix mode dynamically. However, `CAMERA_PRESET_TARGETS` is still exported and its `verdict` preset still points to the score-mode verdict bounds — not the decode frame. Any consumer of the static constant (outside the `resolvedFrames`/`computePresetTargets` path) will get stale bounds in remix mode. Currently `Board.tsx` uses `computePresetTargets(resolvedFrames)` correctly. But if any future code imports `CAMERA_PRESET_TARGETS.verdict` directly for a remix board, it will pan to the wrong position.

**Fix:** Deprecate `CAMERA_PRESET_TARGETS` exports or add a JSDoc note that they are score-mode-only and `computePresetTargets` must be used for mode-aware targets.

---

### IN-02: `formData.mode` is initialized to `'score'` in state AND `intent` state is separately initialized to `'score'` — two sources of truth for the same value

**File:** `src/components/app/content-form.tsx:165,175-187`

**Issue:** Both `intent` (line 165, `useState<"score" | "remix">("score")`) and `formData.mode` (line 180, `mode: "score"`) track the same value. `handleIntentChange` updates both (lines 242-243). `onSubmit` sends `formData` which carries `mode`. The `intent` state drives the UI rendering (tabs, placeholder, caption suppression). If these ever diverge (e.g., a bug in `handleIntentChange` updates one but not the other), the submitted `formData.mode` could disagree with the visible UI state. The current implementation keeps them in sync, but the duplication is unnecessary complexity.

**Fix:** Derive one from the other. The simplest approach: remove `mode` from `ContentFormData` and derive it from `intent` at submit time, OR remove the `intent` state and derive it from `formData.mode`. Given `onSubmit(formData)` already carries `mode`, keeping `formData.mode` as the single source and removing the separate `intent` state would reduce surface area. This is a minor refactor.

---

### IN-03: `rowToPredictionResult` in `prediction-cache.ts` does not map the new `mode` field from DB rows

**File:** `src/lib/engine/cache/prediction-cache.ts:135-153`

**Issue:** `rowToPredictionResult` spreads the raw row and then overrides specific typed fields. The `mode` field added by this phase is spread in via `...(row as unknown as Partial<PredictionResult>)` but is NOT explicitly mapped. This means `mode` will be present in the result as a `string` (from the JSONB spread), not as the `"score" | "remix"` union type that `PredictionResult.mode` declares. TypeScript won't catch this because the spread types it as `Partial<PredictionResult>`, which is structurally compatible.

For a cache hit that returns a previously-stored remix analysis, the `boardMode` derivation in `Board.tsx:166` reads `stream.result?.mode` — this value comes from the L1/L2 cache via `rowToPredictionResult`. If the spread silently coerces or widens the value, the board would fall back to `submittedIntent` rather than the persisted mode.

In practice the value will be the correct string since it came from the DB column, but the explicit mapping is missing, making the code fragile to future DB schema changes.

**Fix:** Add explicit mapping in `rowToPredictionResult`:

```typescript
export function rowToPredictionResult(row: Record<string, unknown>): PredictionResult {
  return {
    ...(row as unknown as Partial<PredictionResult>),
    overall_score: row.overall_score as number,
    // ... existing explicit fields ...
    mode: (row.mode as 'score' | 'remix' | undefined) ?? 'score',
  } as PredictionResult;
}
```

---

_Reviewed: 2026-06-01T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
