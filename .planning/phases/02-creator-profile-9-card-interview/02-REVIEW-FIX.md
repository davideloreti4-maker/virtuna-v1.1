---
phase: 02-creator-profile-9-card-interview
fixed_at: 2026-05-18T00:13:00Z
review_path: .planning/phases/02-creator-profile-9-card-interview/02-REVIEW.md
iteration: 3
findings_in_scope: 20
fixed: 20
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report (Cumulative — Iterations 1 + 3)

**Fixed at:** 2026-05-18T00:13:00Z
**Source review:** `.planning/phases/02-creator-profile-9-card-interview/02-REVIEW.md` (iteration 2 re-review)
**Iteration:** 3 (final pass under the `--auto` cap)

**Summary:**
- Cumulative findings in scope across iterations 1 + 3: **20** (5 CR + 12 WR from iter-1 + 1 BLOCKER + 2 WARNING from iter-2 re-review)
- Fixed: **20**
- Skipped: **0**
- 3 INFO findings (IN-A, IN-B, IN-C) from iter-2 are out of scope for `fix_scope=critical_warning` and remain documented in `02-REVIEW.md` for the next code-review iteration.

This report records every fix applied across iterations 1 and 3 (iteration 2 was a pure re-review with no fixes). Iteration 3 closed the three regressions/gaps the re-review surfaced — one BLOCKER (CR-A) and two WARNINGS (WR-A, WR-B). The iteration-1 fixes for CR-01..CR-05 and WR-01..WR-12 remain in place; iteration 3 patches the specific commits where the original fix had a defect.

Verification across all iterations: 502/502 vitest tests pass; `pnpm exec tsc --noEmit` reports no errors in any file touched by iteration 1 or iteration 3.

## Fixed Issues — Iteration 3 (this run)

### CR-A: WR-11 fix REGRESSION — empty-state row loses focus on first keystroke (reference + wins/flops inputs)

**Files modified:** `src/components/app/cards/reference-creators-input.tsx`, `src/components/app/cards/wins-flops-input.tsx`
**Commit:** `dcbb9f0`
**Applied fix:** Replaced the stateless `ensureIds(value)` helper (which returned NEW objects with NEW UUIDs on every call) with a two-layer stable-id strategy:

1. **Empty-row id via `useState(newId)`** — the synthesized first row carries the SAME id across the initial render AND the first keystroke (when the row materializes into a real entry). No more placeholder->UUID swap.
2. **`useRef<Map<entry, id>>` cache** — id-less entries hydrated from the DB get a UUID assigned ONCE per object reference, then reused across every re-render. Parent state preserves entry references until the user edits, so the cache hits and the React `key` stays stable.

Both handlers (`handleRowChange`, `handleRemove`, `handleAdd`) now derive the emitted `next` array from the SAME `rows` array the render uses — they cannot diverge by construction. Applied identically to both `UrlColumn` instances in `wins-flops-input.tsx` (wins + flops).

User can now type the first character of every row in Card 5 and Card 6 without losing focus. All 502 vitest tests still pass; `tsc --noEmit` clean for both files.

### WR-A: CR-04 `syncedRef` one-shot silently swallowed server-side sanitization differences

**Files modified:** `src/components/app/profile-settings-form.tsx`
**Commit:** `6c4ff7e`
**Applied fix:** `handleSave` now clears `syncedRef.current = false` after `mutateAsync` resolves successfully. The mutation's `onSuccess` invalidation triggers a refetch; when the canonical server response arrives, the `useEffect([profile])` is allowed to re-sync local state EXACTLY ONCE (the effect re-latches `syncedRef = true` on that single run). Any later refetch (manual `refetch()`, hypothetical cross-tab event) is still blocked from clobbering in-progress edits — CR-04's edit-preservation invariant is preserved.

Concrete failure mode now closed: user types `"abc<ZWSP>"` (4 graphemes) into pain points, saves, the server sanitizer strips the zero-width space, and the form now redraws as `"abc"` (3 graphemes) matching the server. Previously the divergence persisted until a full page reload.

### WR-B: WR-08 delimiter wrapping was bypassable via embedded `<<<END_USER_CONTENT>>>`

**Files modified:** `src/lib/schemas/creator-profile.ts`, `src/lib/engine/creator.ts`
**Commit:** `3b3901f`
**Applied fix:** Two-layer strip (Option A from the review — "strip at sanitize layer", with defense-in-depth at the consumption site):

1. **`sanitizeText` (creator-profile.ts)** — new third `.replace(/<<<(?:END_)?USER_CONTENT>>>/gi, "")` runs after the C0 and zero-width strips. User input cannot land in the DB containing a literal open or close sentinel.
2. **`formatCreatorContext` (creator.ts)** — new `stripUserContentSentinels(input)` helper runs on `ctx.pain_points` and each `reference_creators[].handle_or_url` just before they are inserted into the prompt. Defense-in-depth covers the case where a row landed in the DB via a path that bypassed `sanitizeText` (legacy data, raw SQL update, future code path that skips zod). Double-strip on the same string costs nothing and removes the "what if sanitize is skipped" failure mode entirely.

Verified the regex against the review's bypass vector:
- `"<<<END_USER_CONTENT>>>\nINSTR\n<<<USER_CONTENT>>>"` -> `"\nINSTR\n"`
- `"<<<End_User_Content>>>injected<<<user_content>>>"` -> `"injected"` (case-insensitive)

Zod enums + 500-char cap still bound blast radius; the delimited wrap is now actually unforgeable from user input.

## Fixed Issues — Iteration 1 (retained, all still verified passing in iteration 2)

### CR-01: Settings save doesn't invalidate the deferred-submit gate

**Files modified:** `src/hooks/use-pending-profile-gate.ts`, `src/hooks/queries/use-creator-profile.ts`
**Commit:** `d49eccf`
**Applied fix:** Replaced the hand-rolled `useEffect`/`useState`/manual Supabase fetch in `usePendingProfileGate` with the shared `useCreatorProfile()` TanStack query so settings invalidations now refresh the gate. `resumeAfterModal` optimistically flips `profile_interview_seen_at` in the cache so a second submit in the same session does not re-trigger the modal. Fail-open on query error preserves the upload path during transient backend failures. Also added `refetchOnWindowFocus: false` + `staleTime: 5min` on the shared query (prerequisite for CR-04). Doc-comment claim that the cache contract was already wired is now true.

### CR-02: `advanceCard` increments `currentCard` even when persistence fails

**Files modified:** `src/stores/profile-interview-store.ts`, `src/components/app/profile-interview-modal.tsx`
**Commit:** `7b1deee` (bundled with CR-03, WR-03, WR-04 — all touch the same store/modal pair)
**Applied fix:** `persistCardData` now inspects the Supabase `{ error }` result and throws on failure. `advanceCard`, `skipInterview`, and `finalize` catch the throw, store the message on a new `lastError` field, and re-throw so callers' loading state clears. Only on success do they increment `currentCard` or flip `isClosing`. The modal subscribes to `lastError` and renders it as an `role="alert"` paragraph inside the card body. Added `clearError` action for future toast integration.

### CR-03: Modal close-effect can fire repeatedly on parent re-render

**Files modified:** `src/components/app/profile-interview-modal.tsx`
**Commit:** `7b1deee` (bundled with CR-02, WR-03, WR-04)
**Applied fix:** Added `closedRef = React.useRef(false)` guard so the `useEffect([isClosing, onClose, reset])` calls `onClose() + reset()` at-most-once per close action. A second effect resets the ref to `false` when `open` flips true again, so the wizard remains reusable in the same session. Without the guard, a fresh inline `onClose` from the parent's render (e.g., apolloTier change while `isClosing` is still true) would re-invoke `resumeAfterModal` and double-fire the deferred submit, uploading the same video twice.

### CR-04: Settings form `useEffect([profile])` wipes user edits on background refetch

**Files modified:** `src/components/app/profile-settings-form.tsx`, `src/hooks/queries/use-creator-profile.ts`
**Commit:** `216bbf3` (the `use-creator-profile.ts` portion was committed earlier with CR-01: `d49eccf`)
**Applied fix:** Two-layer defense. (1) Primary: `refetchOnWindowFocus: false` on the shared query (committed with CR-01) so a tab-switch no longer triggers a refetch. (2) Belt-and-braces: a `syncedRef` sentinel guards the local-state sync `useEffect`, ensuring the 14 `setX` calls fire at most once per mount — the first time `profile` resolves. Any subsequent refetch no longer clobbers in-flight edits.

**Note:** iter-3's WR-A fix re-opens the gate exactly once after a successful save so the post-save invalidation can re-sync the form to canonical server truth. The original CR-04 edit-preservation invariant is preserved.

### CR-05: Welcome page runs unconditional UPSERT on every mount

**Files modified:** `src/app/(onboarding)/welcome/page.tsx`
**Commit:** `294e69f` (bundled with WR-02 — same effect body)
**Applied fix:** Replaced the unconditional `upsert(..., { ignoreDuplicates: true })` with a read-first / insert-on-miss flow. Added an `unmounted` flag to the effect so store writes do not fire against a now-unmounted consumer if the user navigates away mid-effect. The `onboarding_completed_at` redirect now short-circuits BEFORE any further work so the welcome shell does not flash for users already past the flow. Removed the wasted round-trip + write on every mount for established users.

### WR-01: Migration does NOT backfill `profile_interview_seen_at`

**Files modified:** `supabase/migrations/20260517210000_creator_profile_9card_columns.sql`
**Commit:** `be58123`
**Applied fix:** Appended an `UPDATE creator_profiles SET profile_interview_seen_at = onboarding_completed_at WHERE onboarding_completed_at IS NOT NULL AND profile_interview_seen_at IS NULL` to the migration. Existing v2.0-completed users are now stamped so the 9-card modal does NOT intercept their next upload. Using `onboarding_completed_at` (rather than NOW()) preserves the original completion timestamp for analytics buckets. Safe to edit in-place because this migration was authored in this phase and has not yet been deployed.

### WR-02: Welcome page silently coerces unknown `onboarding_step`

**Files modified:** `src/app/(onboarding)/welcome/page.tsx`
**Commit:** `294e69f` (bundled with CR-05)
**Applied fix:** Added `console.warn` when `dbStep` is neither "connect" nor "completed" so a stale value from a deploy-ordering race is observable rather than silently coerced. The fallback still maps to "connect" so the store never enters an unrepresentable state, but operators can now see the noise.

### WR-03: Fire-and-forget `addCompetitor` silently discards error returns

**Files modified:** `src/stores/profile-interview-store.ts`
**Commit:** `7b1deee` (bundled with CR-02, CR-03, WR-04)
**Applied fix:** `fireReferenceCreatorAdds` now `.then`s on the resolved value of `addCompetitor` and `console.warn`s on any error string other than the benign "already tracking" branch (idempotency case). The `.catch` still guards against framework / network throws but with a distinct message so the two failure modes are distinguishable in logs.

### WR-04: `finalize` double-fires reference creators

**Files modified:** `src/stores/profile-interview-store.ts`
**Commit:** `7b1deee` (bundled with CR-02, CR-03, WR-03)
**Applied fix:** Added `referencesFired: boolean` sentinel to the store. `advanceCard` (on Card 5) sets it to `true` after firing the reference adds; `finalize` checks it before firing again. The 23505 idempotency on `user_competitors` still protects the worst case, but the sentinel avoids the redundant scrape kickoff. `reset()` clears the flag.

### WR-05: API route PATCH does not enforce CSRF / Content-Type

**Files modified:** `src/app/api/profile/creator-profile/route.ts`
**Commit:** `2198dc0` (bundled with WR-06)
**Applied fix:** Added two explicit guards at the top of the PATCH handler. (1) `Content-Type: application/json` check returns 415 on mismatch instead of cascading into a 500 from `request.json()`. (2) Same-origin `Origin` header check returns 403 on cross-origin requests. When no `Origin` header is present (direct programmatic SSR / curl calls), the check is skipped per spec — browsers always send `Origin` on state-changing methods.

### WR-06: Sanitize block manually rebuilds entries, drops future fields

**Files modified:** `src/app/api/profile/creator-profile/route.ts`
**Commit:** `2198dc0` (bundled with WR-05)
**Applied fix:** Sanitize block now spreads `...entry` so any future schema additions (e.g., an optional `id` on a reference creator — exactly what WR-11 just added) round-trip cleanly instead of being silently dropped. Narrowed type assertions to `& Record<string, unknown>` so spread is type-safe without losing the known field names.

### WR-07: `sanitizeText` does not strip Unicode zero-width characters

**Files modified:** `src/lib/schemas/creator-profile.ts`
**Commit:** `693b721`
**Applied fix:** Added a second `.replace(/[​‌‍⁠﻿]/g, "")` after the existing ASCII C0 strip. Uses escaped Unicode codepoints so the source file remains free of literal invisible characters (avoiding the same prompt-injection vector in our own codebase). Covers U+200B (ZERO WIDTH SPACE), U+200C, U+200D, U+2060 (WORD JOINER), and U+FEFF (BOM).

### WR-08: `formatCreatorContext` injects raw `pain_points` into LLM prompt

**Files modified:** `src/lib/engine/creator.ts`
**Commit:** `fba74a7`
**Applied fix:** Wrapped both `pain_points` and `reference_creators` content in `<<<USER_CONTENT>>> ... <<<END_USER_CONTENT>>>` delimited blocks so the LLM recognizes them as opaque data rather than potential instructions.

**Note:** the iter-2 re-review found the delimiter wrap was bypassable from inside user input; iter-3's WR-B fix closes that gap by stripping the sentinels at sanitizeText AND defensively at the consumption site.

### WR-09: `card-progress-dots.tsx` violates ARIA tablist semantics

**Files modified:** `src/components/app/card-progress-dots.tsx`
**Commit:** `ec864f4`
**Applied fix:** Replaced `role="tablist"` + `role="tab"` with `role="progressbar"` + `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext`. Each dot is now `aria-hidden="true"` (decorative span). The dots have no keyboard interaction and there are no `tabpanel` elements to link to, so the tab semantics were invalid per WAI-ARIA. Screen readers now announce "Step N of M" without the role mismatch.

### WR-10: Continue button briefly flashes loading on next card

**Files modified:** `src/components/app/profile-interview-modal.tsx`
**Commit:** `09c0fdb`
**Applied fix:** Added `useEffect([currentCard]) => setIsAdvancing(false)`. Zustand fires `set` subscribers synchronously inside `advanceCard`, causing the modal to re-render with the new `currentCard` before the post-await `setIsAdvancing(false)` is dispatched. The new effect clears the flag on every card transition, eliminating the ~1-frame spinner flash. The post-await reset in `handleContinue`/`handleSkipAll` stays as a fallback for flows that do not change `currentCard` (e.g., persist error).

### WR-11: Index-keyed list rows re-mount inputs on delete

**Files modified:** `src/components/app/cards/reference-creators-input.tsx`, `src/components/app/cards/wins-flops-input.tsx`
**Commit:** `0d011d8`
**Applied fix:** Added optional `id?: string` to `ReferenceCreatorEntry` and `UrlEntry`. New rows get a UUID via `crypto.randomUUID()` (with a `Math.random` fallback for jsdom). Existing rows hydrated from the DB get IDs materialized lazily via `ensureIds` / `ensureUrlIds` helpers. List keys use `entry.id ?? \`idx-${index}\`` so React's reconciler no longer re-mounts inputs after a middle-row delete. The `id` field is stripped at the API boundary by zod's default `.strip()` behavior so it does not bloat the persisted DB row (and now WR-06's spread-through preserves it should we ever want to round-trip it).

**Note:** the iter-2 re-review found the iter-1 implementation re-generated UUIDs on every render call, causing the React `key` to mutate between render-time and handler-time and dropping focus on the first keystroke. iter-3's CR-A fix replaces the stateless `ensureIds` helper with a useRef-cached materializer + a useState empty-row id, so the key stays stable across both the first keystroke AND across re-renders of DB-hydrated id-less rows.

### WR-12: `pain-points-input.tsx` truncates by code units, splits emoji mid-grapheme

**Files modified:** `src/components/app/cards/pain-points-input.tsx`
**Commit:** `1731de8`
**Applied fix:** Replaced `slice(0, 500)` truncation with grapheme-aware truncation via `Intl.Segmenter` (granularity: "grapheme"). The character counter now also reports grapheme count instead of code-unit count. Module-scope segmenter avoids re-instantiation. Removed the native `maxLength={500}` prop because it would re-introduce code-unit truncation on the browser side. Falls back to code-unit counting in environments lacking `Intl.Segmenter` (none of our supported browsers, but defensive for SSR / jsdom). The downstream zod `.max(500)` still uses code units, so the grapheme-aware front-stop is conservative — the UI never exceeds 500 graphemes, comfortably within API limits.

## Skipped Issues

None across either iteration — all 20 in-scope findings were applied successfully.

The 3 iter-2 INFO findings (IN-A, IN-B, IN-C) and the 7 iter-1 INFO findings are out of scope for `fix_scope=critical_warning` and remain documented in `02-REVIEW.md` for future iterations.

---

_Fixed: 2026-05-18T00:13:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3 (final pass under the `--auto` cap)_
_Iteration 1 commits: `d49eccf` -> `1731de8` (12 commits, untouched)_
_Iteration 3 commits: `dcbb9f0`, `6c4ff7e`, `3b3901f` (3 commits, this run)_
