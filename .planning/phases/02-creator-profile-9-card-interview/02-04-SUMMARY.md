---
phase: 02-creator-profile-9-card-interview
plan: 04
subsystem: ui-state
tags: [react, nextjs, zustand, radix-dialog, supabase-client, deferred-submit, wizard-modal, accessibility, raycast]

requires:
  - phase: 02-creator-profile-9-card-interview
    provides: "Plan 02-01 schema columns (target_platforms, niche_primary, niche_sub, target_audience, primary_goal, creator_stage, content_style, cuts_per_second, reference_creators, past_wins, past_flops, posting_frequency, time_of_day_aware, pain_points, profile_interview_seen_at) consumed by serializeCard + persistCardData"
  - phase: 02-creator-profile-9-card-interview
    provides: "Plan 02-03 nine controlled picker components in src/components/app/cards/* — imported and composed by the modal's renderCardBody switch"

provides:
  - "ProfileInterviewModal (src/components/app/profile-interview-modal.tsx) — Radix Dialog wizard shell with mandatory-flow accessibility overrides, 9-case renderCardBody switch, TruthfulnessCallout on Card 0 + Card 6, CardProgressDots above the frame"
  - "useProfileInterviewStore (src/stores/profile-interview-store.ts) — Zustand store: currentCard, draft (14-field InterviewDraft), advanceCard / skipCard / goBack / skipInterview / finalize / reset actions, per-card serializeCard switch (9 cases), persistCardData helper writes to creator_profiles via browser Supabase client, user_id always derived from auth.getUser()"
  - "usePendingProfileGate (src/hooks/use-pending-profile-gate.ts) — deferred-submit hook: shouldShowModal + isLoading + interceptOrProceed + resumeAfterModal. Pitfall #1 mitigation: loading window treated as intercept."
  - "InterviewCard (src/components/app/interview-card.tsx) — per-card frame with heading + description + body slot + Back/Continue/Skip-this-question footer + Card-0-only 'I'll do this later' ghost link"
  - "CardProgressDots (src/components/app/card-progress-dots.tsx) — 9-dot progress indicator, coral active dot (8×8), white/30 completed dots (6×6), white/12 upcoming dots, role='tablist'"
  - "TruthfulnessCallout (src/components/app/truthfulness-callout.tsx) — D-04 reminder with exact copy 'Honest answers improve your prediction accuracy by ~30%.' (no coral, neutral white/[0.02] surface)"
  - "content-form.tsx integration — handleSubmit wraps onSubmit in interceptOrProceed; isSubmitDisabled prepends isProfileLoading guard; modal mounted conditionally as JSX sibling to form (fragment wrap)"

affects:
  - "02-05 (Settings form) — reuses the same InterviewDraft type indirectly via picker prop shapes. Settings does NOT mount the modal; it renders the same 9 pickers as inline form sections via a separate useUpdateCreatorProfile hook in 02-05."
  - "02-06 (Save flow / e2e + DB-types regen) — owns the Card 5 competitor auto-add side-effect (currently NOT wired in the store; advanceCard persists references[] only). Also owns the Supabase types regeneration that removes the `as any` casts in this plan's store + gate hook."

tech-stack:
  added: []
  patterns:
    - "Deferred-submit gate: hook ref-stashes the submit callback while gate-state is unresolved or modal is shown; modal's onClose fires the callback after persistence resolves"
    - "Mandatory-flow Radix Dialog: onEscapeKeyDown / onPointerDownOutside / onInteractOutside all preventDefault; onOpenChange ignores false (close ignored); no DialogClose component rendered — exit ONLY via store-controlled isClosing flag"
    - "Per-card incremental persist: each Continue press writes only that card's columns via persistCardData(serializeCard(currentCard, draft)); finalize() writes all 14 columns + profile_interview_seen_at in one update"
    - "user_id always derived inside persistCardData via supabase.auth.getUser() — never accepted from caller scope (T-02-02a mitigation, layered with RLS)"
    - "Empty-row filter inside serializeCard: Card 5 and Card 6 filter out entries whose handle_or_url / url is empty after trim, matching the picker's synthesized-empty-row convention so the persisted JSONB never contains placeholder rows"
    - "isClosing flag coordination: modal's useEffect watches isClosing and calls parent's onClose + store.reset() once per cycle — prevents double-fire"
    - "Loading-as-intercept (Pitfall #1): interceptOrProceed treats `isLoading` the same as `shouldShowModal` — defers the submit until the gate state resolves. Submit button is disabled during the same window via isProfileLoading in isSubmitDisabled."

key-files:
  created:
    - src/components/app/profile-interview-modal.tsx
    - src/components/app/interview-card.tsx
    - src/components/app/card-progress-dots.tsx
    - src/components/app/truthfulness-callout.tsx
    - src/stores/profile-interview-store.ts
    - src/hooks/use-pending-profile-gate.ts
  modified:
    - src/components/app/content-form.tsx

key-decisions:
  - "Cast persistCardData updates payload (`update(updates as any)`) and the gate-hook select (`select('profile_interview_seen_at' as any)`) because src/types/database.types.ts has not been regenerated to include the 9-card columns added by Plan 02-01's migration. The columns exist at runtime; only the typed schema is stale. Plan 02-06 is the documented owner of the DB-types regen that removes both casts."
  - "Render the DialogTitle as `sr-only` rather than visible. UI-SPEC says the modal title is 'Tell us about your content' on every card, but the same string is also the Card 0 heading — rendering it twice (once as the dialog header, once as the card heading) creates redundant visual weight. The visible heading lives inside InterviewCard; the sr-only DialogTitle satisfies the Radix accessibility requirement (Dialog must have a title for screen readers)."
  - "Modal mounts conditionally on `{modalOpen && ...}` rather than always-mounted with `open` prop. Reason: the store's INITIAL_DRAFT lives in module scope; an always-mounted modal would subscribe even when closed, retaining the draft across navigations. Conditional mount + reset() on close ensures a clean re-entry next session."
  - "isAdvancing local useState (not store flag) drives the loading spinner. The store's actions are async but the spinner is purely a UI concern — keeping it local matches the principle that the store represents persisted state, not transient interaction state."
  - "Fragment wrap (`<>...</>`) of content-form's return is the minimum-impact change to mount the modal as a sibling. Wrapping the form in a div would alter the layout grid; the fragment is invisible to CSS."

requirements-completed:
  - PROFILE-02
  - PROFILE-12
  - PROFILE-13
  - PROFILE-14
  - INT-02

duration: 9min
completed: 2026-05-17
---

# Phase 02 Plan 04: 9-Card Interview Modal Summary

**Mandatory-but-skippable Radix Dialog wizard intercepts content-form submit via a deferred-submit gate hook, composes all 9 picker components from Plan 02-03 into a 9-case render switch, and persists each card to `creator_profiles` incrementally with the user_id always derived from `auth.getUser()` inside the store.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-17T20:28:08Z
- **Completed:** 2026-05-17T20:37:48Z
- **Tasks:** 3 (all `type="auto"`)
- **Files created:** 6 (modal shell, interview card frame, progress dots, truthfulness callout, Zustand store, gate hook)
- **Files modified:** 1 (content-form.tsx — 22-line surgical edit to wrap submit + mount modal)

## Accomplishments

- **Deferred-submit gate (PROFILE-14):** `usePendingProfileGate` ref-stashes the submit callback when the modal must open; `resumeAfterModal` fires it after the modal closes (whether via finalize or skipInterview). Pitfall #1 mitigated — the brief window where `profileSeen === null` is treated as intercept, AND the submit button is disabled via `isProfileLoading` so the user cannot double-click.
- **Mandatory-flow accessibility (PROFILE-13 / D-05):** Escape, pointer-outside, and interaction-outside all `preventDefault()`; no `DialogClose` / X button. The only exits are `finalize()` (Save Profile on Card 8) and `skipInterview()` (I'll do this later on Card 0). Both flip the store's `isClosing` flag, which the modal's effect picks up to fire `onClose()` + `reset()` exactly once.
- **Per-card incremental persist (D-18):** `advanceCard` writes only `serializeCard(currentCard, draft)` — Card 0 writes target_platforms, Card 1 writes niche_primary + niche_sub, etc. `finalize` writes all 9 cards' columns plus `profile_interview_seen_at` in one update. `skipInterview` writes only `profile_interview_seen_at` with no other columns.
- **Truthfulness double-surfacing (D-04):** `<TruthfulnessCallout />` rendered above the picker body on Card 0 and Card 6 with the exact grep-locked copy `"Honest answers improve your prediction accuracy by ~30%."`. The callout itself uses neutral `white/[0.02]` surface — no coral (UI-SPEC §Color).
- **9-dot CardProgressDots (UI-SPEC §Animation):** Active dot is coral 8×8 (the only legitimate accent surface on the wizard), completed dots are white/30 6×6, upcoming dots are white/12 6×6, all with 150ms ease transitions and `role="tablist"` for screen-reader navigation.
- **Inline Card-0 validation (UI-SPEC line 290):** When `draft.platforms.length === 0` on Card 0, the inline error `"Select at least one platform to continue."` renders in `role="alert"` below the picker AND the Continue button is disabled. Skip-this-question still works to advance with empty data.
- **Continue/Save-Profile label switch:** `isLastCard={currentCard === 8}` makes the InterviewCard's primary button read "Save Profile" on Card 8 and "Continue" elsewhere.
- **content-form.tsx surgical edit:** 22 lines added, 1 line removed. Two new imports, one `usePendingProfileGate` destructure, one `modalOpen` useState, three-line `handleSubmit` change, one-line `isSubmitDisabled` change, fragment wrap of the return, conditional modal mount. `video-upload.tsx` untouched (per D-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: Foundation — store + gate hook + 3 primitives** — `882366e` (feat) — profile-interview-store.ts, use-pending-profile-gate.ts, truthfulness-callout.tsx, card-progress-dots.tsx, interview-card.tsx
2. **Task 2: ProfileInterviewModal shell** — `2af2e39` (feat) — profile-interview-modal.tsx (composes Task 1 outputs + Plan 02-03's 9 pickers)
3. **Task 3: content-form integration** — `e2de8ab` (feat) — content-form.tsx (surgical wrap + modal mount)

_The plan-metadata commit (this SUMMARY.md) lands separately as the final commit._

## Files

| Layer | File | Role |
|-------|------|------|
| Visual primitive | `src/components/app/truthfulness-callout.tsx` | D-04 callout (Card 0 + Card 6) |
| Visual primitive | `src/components/app/card-progress-dots.tsx` | 9-dot progress with coral active dot |
| Visual primitive | `src/components/app/interview-card.tsx` | Per-card frame: heading + body + Back/Continue/Skip footer |
| Wizard shell | `src/components/app/profile-interview-modal.tsx` | Radix Dialog + 9-case renderCardBody switch + mandatory-flow overrides |
| State | `src/stores/profile-interview-store.ts` | Zustand store: currentCard + draft + serializeCard + persistCardData + actions |
| Gate hook | `src/hooks/use-pending-profile-gate.ts` | Deferred-submit pattern: interceptOrProceed + resumeAfterModal |
| Integration | `src/components/app/content-form.tsx` | handleSubmit wrap + modal mount (22-line edit) |

## Per-Card DB Column Mapping (serializeCard switch)

| Card | Draft Field(s) | DB Column(s) | Notes |
|------|---------------|--------------|-------|
| 0 | `platforms: PlatformId[]` | `target_platforms TEXT[]` | Direct array |
| 1 | `niche_primary: string \| null`, `niche_sub: string \| null` | `niche_primary TEXT`, `niche_sub TEXT` | Two scalar columns |
| 2 | `audience: TargetAudience` | `target_audience JSONB` | `{age_range, gender_skew, geo, language}` |
| 3 | `goal: CreatorGoal \| null`, `stage: CreatorStage \| null` | `primary_goal TEXT`, `creator_stage TEXT` | `primary_goal` reuses existing column |
| 4 | `style: ContentStyle \| null`, `cuts: CutsPerSecond \| null` | `content_style TEXT`, `cuts_per_second TEXT` | Two scalars |
| 5 | `references: ReferenceCreatorEntry[]` | `reference_creators JSONB` | Filtered: only entries with non-empty handle_or_url after trim |
| 6 | `wins: UrlEntry[]`, `flops: UrlEntry[]` | `past_wins JSONB`, `past_flops JSONB` | Filtered: only entries with non-empty url after trim |
| 7 | `cadence: PostingFrequency \| null`, `todAware: boolean` | `posting_frequency TEXT`, `time_of_day_aware BOOLEAN` | |
| 8 | `pain: string` | `pain_points TEXT` | Trimmed; empty coerces to NULL |
| Finalize | All of above + flag | All of above + `profile_interview_seen_at TIMESTAMPTZ` | One UPDATE writes 14 columns at once |
| Skip-all | (no card data) | `profile_interview_seen_at TIMESTAMPTZ` only | Profile row gets only the seen flag |

## Deferred Pattern (the heart of this plan)

```
ContentForm                  usePendingProfileGate              Store
─────────────────────────────────────────────────────────────────────────
handleSubmit fires
  validate()
  interceptOrProceed(() => onSubmit(formData))
                              ┌─ if shouldShowModal || isLoading:
                              │    pendingSubmit.current = callback
                              │    return { intercepted: true }
                              └─ else: callback() + return { intercepted: false }
  if intercepted: setModalOpen(true)
                              ┌─ User cycles through cards…
                              │  Each Continue → advanceCard()
                              │                   → persistCardData(serializeCard(N, draft))
                              │                   → set currentCard = N+1
                              │
                              │  Last card "Save Profile" → finalize()
                              │                   → persistCardData({...all9, profile_interview_seen_at: now})
                              │                   → set isClosing: true
                              │
                              │  "I'll do this later" → skipInterview()
                              │                   → persistCardData({profile_interview_seen_at: now})
                              │                   → set isClosing: true
                              └
  Modal useEffect on isClosing
    onClose() → setModalOpen(false) + resumeAfterModal()
                              ┌─ pendingSubmit.current() invoked (the original onSubmit(formData))
                              │  setProfileSeen(true) locally — second submit this session won't re-trigger
                              └
  store.reset() — fresh currentCard=0, draft=INITIAL_DRAFT for next session
```

## Decisions Made

- **Casts at the Supabase boundary.** The migration in Plan 02-01 added the 9-card columns but `src/types/database.types.ts` has not been regenerated. The typed Supabase client refuses to compile against unknown columns, so both the gate-hook `.select()` and the store's `.update()` use `as any` with eslint-disable + explanatory comments pointing at Plan 02-06 (DB-types regen). Removing the casts is a 2-line edit once the types regen lands.
- **sr-only DialogTitle.** UI-SPEC says the modal title is "Tell us about your content" on every card. But the same string is also Card 0's visible heading. Rendering it twice creates redundant weight. The visible heading lives in `InterviewCard.heading`; the `<DialogTitle className="sr-only">` satisfies Radix's accessibility requirement without visual noise.
- **Conditional `{modalOpen && <Modal />}` mount, not always-mounted with `open` prop.** An always-mounted modal would keep the Zustand draft alive across navigations even when closed. Conditional mount + the `useEffect(reset)` on isClosing guarantees a clean re-entry. (Radix's animation system tolerates remount; the 150ms duration is preserved.)
- **`isAdvancing` is local useState, not a store flag.** The spinner is a transient UI concern. The store represents persisted state, so async loading flags don't belong there. The local state also makes the button instantly re-enabled if the user navigates back.
- **Fragment wrap (`<>...</>`) of content-form return.** Minimum-impact change to add the modal as a JSX sibling. Wrapping in a `<div>` would change the layout grid; the fragment is invisible to CSS. The plan acceptance criterion `grep -cE '^\s*<>|^\s*</>'` returning exactly 2 verified the wrap shape.
- **Card 5 side-effect (competitor auto-add) NOT wired here.** The store's `advanceCard` persists `reference_creators` JSONB only. The Apify scrape kickoff that D-06/D-07 describe is owned by Plan 02-06's save flow; wiring it into `advanceCard` would couple the modal to the scrape pipeline and violate the plan's "modal subsystem only" scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules in worktree**
- **Found during:** Pre-Task-1 setup (verifying `pnpm exec tsc --noEmit` was available)
- **Issue:** Fresh worktree had `package.json` but no `node_modules/` — `tsc`, `vitest`, and `pnpm build` could not run
- **Fix:** Ran `pnpm install --prefer-offline --frozen-lockfile`
- **Files modified:** None tracked (node_modules is gitignored)
- **Verification:** `pnpm exec tsc --noEmit` then `pnpm test --run` then `pnpm build` all succeeded
- **Committed in:** N/A (no tracked files changed)

**2. [Rule 3 - Blocking] Cast Supabase calls to bypass stale generated types**
- **Found during:** Task 1 verification (first `pnpm exec tsc --noEmit` after writing the gate hook)
- **Issue:** `src/hooks/use-pending-profile-gate.ts(71,38): error TS2339: Property 'profile_interview_seen_at' does not exist on type 'SelectQueryError<...column 'profile_interview_seen_at' does not exist on 'creator_profiles'...'>`. The migration in Plan 02-01 (`20260517210000_creator_profile_9card_columns.sql`) added the column to the actual DB schema, but `src/types/database.types.ts` was not regenerated. The typed Supabase client therefore refuses to compile against the new columns.
- **Fix:** Added `as any` casts to the `.select()` and `.update()` calls with eslint-disable lines and explanatory comments pointing at Plan 02-06 as the documented owner of the DB-types regen. The casts are narrowly scoped (one per file) and localized to the Supabase boundary.
- **Files modified:** `src/hooks/use-pending-profile-gate.ts`, `src/stores/profile-interview-store.ts`
- **Verification:** `pnpm exec tsc --noEmit` returns no errors for either file; the columns exist at runtime per the migration; the cast is removed in one diff once the types regen lands.
- **Committed in:** Folded into Task 1 (`882366e`)

**3. [Rule 1 - Bug] Fixed `copy` possibly-undefined under noUncheckedIndexedAccess**
- **Found during:** Task 2 verification (`pnpm exec tsc --noEmit`)
- **Issue:** TS18048 — `'copy' is possibly 'undefined'` on lines 296/297. The CARD_COPY lookup `CARD_COPY[currentCard] ?? CARD_COPY[0]` had TypeScript treating `CARD_COPY[0]` as `CardCopy | undefined` under `noUncheckedIndexedAccess`.
- **Fix:** Added non-null assertion to the fallback: `CARD_COPY[0]!` with an inline comment explaining the safety (CARD_COPY[0] is statically defined above). The nullish-coalesce + assertion combo handles both cases.
- **Files modified:** `src/components/app/profile-interview-modal.tsx`
- **Verification:** TypeScript clean.
- **Committed in:** Folded into Task 2 (`2af2e39`) before commit

---

**Total deviations:** 3 auto-fixed (1 blocking dependency install, 1 type-system workaround at the Supabase boundary, 1 noUncheckedIndexedAccess fix). No functional impact — all three are mechanical workarounds for environment/tooling state, not behavioral changes.

## Issues Encountered

- **Pre-existing TS errors** in unrelated test files (`src/lib/engine/__tests__/calibration.test.ts` etc.) appear in `pnpm exec tsc --noEmit` output. These are out of scope per the executor's scope boundary — they pre-date this plan and are unrelated to the files this plan touches. The plan's verification gate scopes to the 7 files in this plan and passes cleanly.
- **No regression** in `pnpm test --run` (498 passed, 7 skipped — all pre-existing). No regression in `pnpm build` (full Next.js typed build succeeded end-to-end).
- **content-form.tsx edit is 22 lines added** — the plan's `<done>` block suggested "under 15 lines". The non-negotiable parts (2 imports, 1 destructure, 1 useState, the `<>...</>` wrap, the modal sibling) total 14 lines; the remaining 8 lines come from formatting the `usePendingProfileGate` destructure across multiple lines for readability. Acceptance criterion `grep -cE '^\s*<>|^\s*</>'` returning exactly 2 passes — the fragment shape is correct.

## User Setup Required

None — the modal and store are pure client code. No env vars. No external services. The migration that defines the columns these files write to landed in Plan 02-01.

## Threat Surface Notes

Per the plan's `<threat_model>`:

- **T-02-02a (IDOR on profile update):** Mitigated as planned. `persistCardData` calls `supabase.auth.getUser()` inside the helper and writes via `.eq("user_id", user.id)` — the user_id is never accepted from caller scope. Combined with the existing RLS policy on `creator_profiles`, a malicious caller cannot trick the store into writing another user's row. Verified by inspecting the helper at `src/stores/profile-interview-store.ts:91-104`.
- **T-02-05a (Modal-bypass via direct DB write):** Accepted as planned. RLS already restricts UPDATEs to the user's own row. The `profile_interview_seen_at` flag is a UX hint, not a security boundary. Direct query bypass only triggers the modal on next session — by design.
- **T-02-01b (Prompt injection via Card 8 pain text):** Partial mitigation as planned. The store calls `draft.pain.trim() || null` to coerce empty strings to NULL but does NOT strip control characters. Full sanitation (zod + control-char strip) lands at the Plan 02-05 API boundary. For modal saves, the 500-character cap enforced inside `PainPointsInput` (Plan 02-03) provides blast-radius mitigation.

No new threat surface introduced beyond the registered threats. The store has zero awareness of re-prompts (D-14 honored — `grep -E 'profile_analyses_count|re_prompt|reprompt|prompt_after_10'` returns empty).

## Known Stubs

**Card 5 competitor auto-add side-effect is not wired in the store.** `advanceCard` for Card 5 persists `reference_creators` JSONB only; it does NOT insert into `user_competitors` / `competitor_profiles` (D-06) or kick off the Apify scrape (D-07). This is intentional and scoped to Plan 02-06 per the plan's `<done>` block ("Plan 02-06 wires that"). Documented for traceability.

No other stubs — every other surface is feature-complete against its `<interface>` declaration and `<acceptance_criteria>` block.

## Next Phase Readiness

- **Plan 02-05 (Settings form, this wave / sibling agent):** Independent files. Will reuse the picker prop shapes from Plan 02-03 verbatim. Does NOT touch the modal subsystem files in this plan. The shared `InterviewDraft` type lives in the store but is NOT exported as a contract — Plan 02-05 builds its own form-state shape via its own `useUpdateCreatorProfile` hook (per the plan's `<interfaces>` block note).
- **Plan 02-06 (Save flow + e2e + DB-types regen, next wave):** Owns three follow-ups: (1) wire the Card 5 competitor auto-add side-effect into the save flow, (2) regenerate `src/types/database.types.ts` so the two `as any` casts in this plan can be removed, (3) e2e tests against the `data-testid="profile-interview-modal"` selectors with full happy-path + skip-all coverage.
- **No blockers** for downstream consumers. The modal is mountable today; the store persists today; the gate hook intercepts today.

## Self-Check: PASSED

- `src/stores/profile-interview-store.ts` — FOUND
- `src/hooks/use-pending-profile-gate.ts` — FOUND
- `src/components/app/truthfulness-callout.tsx` — FOUND
- `src/components/app/card-progress-dots.tsx` — FOUND
- `src/components/app/interview-card.tsx` — FOUND
- `src/components/app/profile-interview-modal.tsx` — FOUND
- `src/components/app/content-form.tsx` — FOUND (modified)
- Commit `882366e` (Task 1) — FOUND in git log
- Commit `2af2e39` (Task 2) — FOUND in git log
- Commit `e2de8ab` (Task 3) — FOUND in git log
- `grep -c 'case [0-8]:' src/stores/profile-interview-store.ts` → 9 — PASS
- `grep -c 'case [0-8]:' src/components/app/profile-interview-modal.tsx` → 9 — PASS
- `grep -c 'TruthfulnessCallout' src/components/app/profile-interview-modal.tsx` → 4 (≥2) — PASS
- `grep -cE '^\s*<>|^\s*</>' src/components/app/content-form.tsx` → 2 — PASS
- `! grep -q "DialogClose" src/components/app/profile-interview-modal.tsx` — PASS
- `pnpm exec tsc --noEmit` — no errors in any of the 7 files — PASS
- `pnpm test --run` — 498 passed, 7 skipped (pre-existing) — PASS (no regression)
- `pnpm build` — full Next.js typed build succeeded — PASS (final JSX integrity gate)

---
*Phase: 02-creator-profile-9-card-interview*
*Plan: 04 — 9-Card Interview Modal Wizard*
*Completed: 2026-05-17*
