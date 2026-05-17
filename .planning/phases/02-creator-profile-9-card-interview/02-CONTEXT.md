# Phase 2: Creator Profile & 9-Card Interview - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver three coupled artifacts that unlock profile-aware prediction:

1. **9-card interview modal** (`ProfileInterviewModal`) — intercepts the upload action in `content-form.tsx` for any user without a creator profile; mandatory-but-skippable per-card with truthfulness messaging; closes and resumes upload after "Save Profile" or "Skip interview". Visual + interaction contract is locked by `02-UI-SPEC.md` (approved 2026-05-17) and is not re-litigated here.

2. **`creator_profiles` table extension** — extends the existing `creator_profiles` table (created in `20260202000000_v16_schema.sql`, augmented in `20260213000000_onboarding_columns.sql`) with the 9-card fields, plus a `/settings/creator-profile` edit-from-settings flow surfaced as a new 6th tab in `SettingsPage`.

3. **Profile-aware `CreatorContext`** — extends `fetchCreatorContext()` in `src/lib/engine/creator.ts` to merge persisted 9-card fields into the context object that downstream pipeline stages (Gemini prompts, persona allocation in Phase 7, suggestion framing, benchmark pool filtering in Phase 8, self-critique grounding in Phase 9, platform-fit weighting in Phase 9) read at every prediction.

Plus two integration cleanups:
- **Welcome flow trim** — existing `/welcome` 3-step onboarding (connect → goal → preview) reduces to TikTok handle only. The `goal-step.tsx` collection step is removed; `primary_goal` becomes the Card 3 output, not a welcome-flow output.
- **Reference creator side-effect** — Card 5 entries auto-add to the Competitors tool (existing Apify scrape pipeline) AND inform predictions.

Out of scope this phase (deferred to Phase 11): re-prompt micro-card mechanism (PROFILE-16) including its counter, trigger logic, inline card above upload, and toast surface. Out of scope for this milestone entirely: polished post-prediction result card, live audience viz, mobile-first analysis route.

</domain>

<decisions>
## Implementation Decisions

### UI / Interaction Contract (LOCKED upstream)

- **D-01:** All visual, interaction, copy, animation, accessibility, and component-inventory decisions are locked by `.planning/phases/02-creator-profile-9-card-interview/02-UI-SPEC.md` (approved 2026-05-17). Downstream planning + execution MUST read UI-SPEC.md first and treat it as authoritative. Decisions below are HOW-to-implement decisions that UI-SPEC did not lock.

### Onboarding Alignment

- **D-02:** **9-card modal lives at video upload, not in `/welcome` onboarding.** Intercept point is the upload action in `src/components/app/content-form.tsx` (line 171, where `<VideoUpload>` is rendered). User explicitly chose this placement — interception is mandatory (modal must appear), but each card is individually skippable, and the user can "Skip interview" on any card to abort the flow.

- **D-03:** **Welcome flow trims to TikTok handle only.** The existing `/(onboarding)/welcome/` flow keeps `connect-step.tsx` (TikTok handle) but removes `goal-step.tsx` (and the `preview-step.tsx` that depends on it). The 9-card modal becomes the sole source of `primary_goal`. Rationale: avoid duplicate questions; user explicitly chose to remove duplication.

- **D-04:** **Truthfulness emphasis surfaced twice** (per UI-SPEC: Card 0 and Card 6) using the exact copy "Honest answers improve your prediction accuracy by ~30%." User reinforced: "with clear info that this is really important for prediction accuracy."

- **D-05:** **Mandatory-but-skippable semantics:** the modal MUST appear before the first upload completes, but the user may dismiss all cards with empty data (the `creator_profiles` row is created with only the fields they answered, all skipped fields = null). After dismissal, upload proceeds. A `profile_interview_seen_at` timestamp on `creator_profiles` records that the modal was shown so it does not re-trigger. Server enforcement is NOT required (engine handles missing profile data via existing graceful-degradation pattern from Phase 1).

### Reference Creators (Card 5)

- **D-06:** **Card 5 entries auto-add to the Competitors tool AND inform predictions.** When the user enters a TikTok handle or URL in any of the 3 reference creator inputs, on profile save:
  1. The string is persisted to the profile (raw, no URL validation per UI-SPEC).
  2. The handle/URL is parsed (handle extraction from URL forms) and inserted into the existing `user_competitors` + `competitor_profiles` flow (the same path the existing `/competitors` "Add competitor" server action uses at `src/app/actions/competitors/add.ts`).
  3. Predictions reference the persisted strings directly (no dependency on competitor scrape completing) for suggestion framing + persona allocation context.
- **D-07:** **Reference-creator scrape is async** — adding to competitor table happens synchronously (just an insert), but the Apify scrape kickoff uses the same async webhook pattern existing competitors use. Profile save returns immediately; scrape data populates over the following minutes/hours. No spinner blocking the user.
- **D-08:** **Source badge on auto-added competitors.** Competitors added via Card 5 carry a `source` field = `profile_reference` (vs `manual_add`) so `/competitors` UI can render a small "from your profile" badge. Per UI-SPEC scope ("not the polished UX that ships in Intelligence Surface"), the badge itself is Claude's discretion — the schema field is the load-bearing decision.

### Niche Taxonomy (Card 1 + Phase 4 reuse)

- **D-09:** **2 levels of user-input depth: primary + sub-niche.** User explicitly chose this over the 3-level (primary → sub → micro) shape in UI-SPEC. Card 1 UI surfaces only the first two levels of drill-down. The level-3 micro-niche picker referenced in UI-SPEC §Card 1 is dropped (UI-SPEC marked it optional anyway). Phase 4's AI niche detector (`CONTENT-02` in REQUIREMENTS) populates `micro_niche` from video content automatically when a video is analyzed.
- **D-10:** **Taxonomy lives in a hardcoded TypeScript module: `src/lib/niches/taxonomy.ts`.** Exports a typed tree (`type NicheTree = ...`). Versioned in git, type-safe, importable by both Card 1 (`NichePicker` component) and Phase 4's niche detector. Edits = code change + deploy. Rejected: Supabase table (adds query per render + per detector call), JSON config (less type-safe).
- **D-11:** **Primary niche list seeds from the Phase 1 corpus set + extensions.** Includes the 5 corpus niches (Beauty, Fitness, Education, Comedy, Lifestyle) plus a researcher-defined extension set for creator coverage breadth (researcher to propose; planner to lock). Each primary has 8–12 sub-niches.

### Settings Page Integration

- **D-12:** **New 'Creator Profile' tab in `/settings` — adds a 6th tab to the existing `SettingsPage` Tabs component** (`src/components/app/settings/settings-page.tsx`, currently 5 tabs: profile/account/notifications/billing/team). The existing "Profile" tab stays as-is for identity (display name, avatar, handles, etc.). The new "Creator Profile" tab renders the 9-card edit form (`ProfileSettingsForm` per UI-SPEC) as a single scrollable form (no wizard stepping).
- **D-13:** **Route addition:** `/settings?tab=creator-profile`. The existing `SettingsPage` already routes via `tab` query param; just add `"creator-profile"` to the `VALID_TABS` array in `src/app/(app)/settings/page.tsx`.

### Re-prompt Cadence (PROFILE-16)

- **D-14:** **Defer ALL re-prompt work to Phase 11** — including the analyses counter, the trigger logic, the inline card above upload, and the toast surface. UI-SPEC already deferred the UI surface; per user decision, the underlying mechanism is also deferred. Phase 2 does NOT add a counter column or any trigger code. Phase 11 ships the full mechanism end-to-end alongside other UI integration work.

### Profile Data Shape & `creator_profiles` Extension

- **D-15:** **Extend the existing `creator_profiles` table** (do NOT create a new table). The table already holds tiktok_handle, instagram_handle, youtube_handle, twitter_handle, follower counts, niches[], display_name, primary_goal, onboarding_step, onboarding_completed_at. Add columns for the 9-card data via a new migration. New migration follows the established `supabase/migrations/YYYYMMDDHHMMSS_description.sql` convention.
- **D-16:** **Column shape — mixed scalar + JSONB for the variable-shape cards.** Final column-by-column design is Claude's discretion (see below), but the load-bearing direction:
  - Card 0 (platforms): scalar array `target_platforms TEXT[]`
  - Card 1 (niche): two TEXT columns `niche_primary` + `niche_sub`; existing `niches[]` deprecated but not dropped (left in place for backwards-compat with any reads).
  - Card 2 (audience): JSONB `target_audience` ({age_range, gender_skew, geo, language})
  - Card 3 (goal+stage): scalar `primary_goal` (REUSE existing column) + new `creator_stage TEXT`
  - Card 4 (style): scalar `content_style TEXT` + `cuts_per_second TEXT`
  - Card 5 (references): JSONB `reference_creators` (array of {handle_or_url, normalized_handle, competitor_id_if_added})
  - Card 6 (wins/flops): JSONB `past_wins` + `past_flops` (each: array of {url, optional metadata})
  - Card 7 (cadence): scalar `posting_frequency TEXT` + `time_of_day_aware BOOLEAN`
  - Card 8 (pain points): scalar `pain_points TEXT`
  - Modal-seen flag: TIMESTAMPTZ `profile_interview_seen_at`
- **D-17:** **RLS pattern: user-scoped, same as existing `creator_profiles` policy.** New columns inherit existing RLS policies from `20260202000000_v16_schema.sql`. No additional policies needed.
- **D-18:** **Save-on-each-card-advance.** Persist incrementally — after each "Continue" press, write the card's data to `creator_profiles`. Rationale: matches UI-SPEC's "Skip interview" semantics (only completed-so-far fields populated) and survives mid-flow browser crashes. Implementation pattern can reuse `useOnboardingStore`'s `persistToSupabase` style (currently used in `src/stores/onboarding-store.ts`).

### `CreatorContext` Extension (PROFILE-17)

- **D-19:** **Flat extension of the existing `CreatorContext` interface in `src/lib/engine/creator.ts`** — add new fields directly to the existing interface rather than nest under a `profile` sub-object. Rationale: keeps consumer code (Gemini prompt builders, persona allocator, aggregator) reading from a single flat shape; matches the existing additive style. New fields all default to `null` when profile is missing so existing graceful degradation works unchanged.
- **D-20:** **Existing `found: boolean` semantics preserved** — `found = true` still means "we have a scraped creator record"; profile fields are independent and may be present even when scraped data is not. Downstream consumers must null-check profile fields individually.

### Claude's Discretion

These remain HOW-to-implement details for the researcher and planner to lock without further user input:

- **Reference creator handle parsing & normalization** — exact regex/parser for extracting `@handle` from full TikTok URLs vs. raw handles, where it lives (`src/lib/scraping/` extension vs. new util).
- **Competitor auto-add transactional shape** — whether the profile-save and competitor-insert happen in a single Supabase transaction, or sequential with idempotency (CARD 5 entries already in `user_competitors` are skipped, not duplicated).
- **Engine handling of missing card data** — defaults each consumer applies when a profile field is null (e.g., Phase 7 persona allocation falls back to balanced 6/2/1/1 when `target_audience` is null). Each consuming phase implements via existing `graceful_degradation` pattern.
- **`goal-step.tsx` and `preview-step.tsx` removal** — full removal vs. soft-deprecate; whether `onboarding-store.ts` `step` state machine collapses to `connect → completed`. Planner to decide.
- **`creator_profiles` migration file structure** — single migration with all new columns, or split per-card. Single migration is simpler; planner can choose.
- **Pain points (Card 8) engine usage** — feed verbatim into Phase 9 self-critique prompt context vs. classify into known categories via LLM extraction. Phase 9 decides; Phase 2 just stores the string.
- **Niche taxonomy extension primary list** — researcher proposes 10–15 primaries (anchored on the 5 corpus niches), planner locks.
- **Settings save UX details** — toast copy already in UI-SPEC; whether settings form uses optimistic update or wait-for-PATCH-200 is planner's call.
- **Test surface** — Vitest unit tests on niche-taxonomy module, handle-parser, creator-context-merger; Playwright e2e on modal happy path + skip-all path. Specific coverage targets per project's 80% threshold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Upstream Contracts (READ FIRST)
- `.planning/phases/02-creator-profile-9-card-interview/02-UI-SPEC.md` — **APPROVED 2026-05-17.** Visual, interaction, copy, animation, accessibility contract. All UI questions are answered here. Card-by-card spec for all 9 cards. Settings page contract.

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 2: Creator Profile & 9-Card Interview" — phase goal, dependencies (kickoff — parallel with Phase 1), 5 success criteria.
- `.planning/REQUIREMENTS.md` §"Creator Profile + Interview" (PROFILE-01..17) — 17 requirements covering schema, modal flow, every card, truthfulness, skippability, edit-from-settings, re-prompt, CreatorContext enrichment.
- `.planning/REQUIREMENTS.md` §"Integration + Privacy" INT-02, INT-04 — `video-upload.tsx` profile gate integration; onboarding integration without duplication.
- `.planning/PROJECT.md` §"Creator profile (9-card interview)" — milestone-level overview, card list, how profile feeds the engine (persona allocation weighting, suggestion framing, benchmark pool filtering, self-critique grounding, platform-fit weighting).
- `.planning/STATE.md` §"Accumulated Context: Decisions" — milestone-start decisions (additive-only engine, persona allocation, etc.) carry into this phase.

### Prior Phase Context (Carry-Forward)
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md` — corpus niches (Beauty/Fitness/Edu/Comedy/Lifestyle) reused for Card 1 primary list seeding; graceful-degradation pattern referenced for missing profile fields; service-role client pattern; Vitest 80% threshold.

### Codebase Maps
- `.planning/codebase/STACK.md` — TypeScript / Next.js App Router / Supabase / Tailwind v4 / Vitest 80% / Radix UI components.
- `.planning/codebase/ARCHITECTURE.md` — Route group segmentation (`(app)` / `(marketing)` / `(onboarding)`); server components by default; Zustand for client UI state; TanStack Query for server state.
- `.planning/codebase/STRUCTURE.md` — Directory layout; component organization (`ui/`, `app/`, `onboarding/`); store layout; engine module layout.
- `.planning/codebase/INTEGRATIONS.md` — Supabase auth + RLS; Apify scraping pattern (relevant for Card 5 auto-add competitor flow).

### Existing Schema & Migrations
- `supabase/migrations/20260202000000_v16_schema.sql` — **`creator_profiles` table base definition.** Already has display_name, tiktok_handle, instagram_handle, youtube_handle, twitter_handle, follower counts, niches[], engagement_rate, RLS policies. Phase 2 EXTENDS this table — does not create fresh.
- `supabase/migrations/20260213000000_onboarding_columns.sql` — Adds onboarding_step, primary_goal, onboarding_completed_at to `creator_profiles`. Phase 2 reuses `primary_goal` column (Card 3 writes to it).

### Existing Code to Extend / Integrate With
- `src/lib/engine/creator.ts` — **`CreatorContext` interface + `fetchCreatorContext()`**. Phase 2 extends interface (flat add of 9-card fields per D-19) and updates `fetchCreatorContext()` to include them in returned context.
- `src/stores/onboarding-store.ts` — Existing Zustand store with `persistToSupabase` pattern. Save-on-each-card-advance (D-18) reuses this pattern style.
- `src/components/onboarding/connect-step.tsx` — KEEP (TikTok handle entry survives the welcome trim).
- `src/components/onboarding/goal-step.tsx` — REMOVE (D-03; goal moves to Card 3).
- `src/components/onboarding/preview-step.tsx` — REMOVE or refactor (depends on whether preview was depending on goal data; planner's call).
- `src/components/app/video-upload.tsx` — Component rendered inside content-form.tsx. The modal trigger interception happens at the surrounding `content-form.tsx` level (not inside video-upload itself).
- `src/components/app/content-form.tsx` line 171 — **Modal trigger interception point.** When the user clicks "Run analysis" on the video tab with no `creator_profiles.profile_interview_seen_at`, render the `ProfileInterviewModal` before the analysis submit fires.
- `src/app/(app)/settings/page.tsx` + `src/components/app/settings/settings-page.tsx` — Add "creator-profile" to `VALID_TABS` and add a 6th `Tabs.Trigger` + `Tabs.Content` rendering `ProfileSettingsForm`.
- `src/app/actions/competitors/add.ts` — Reuse this server action for D-06 auto-adding reference creators to the competitors flow (or extract its core to a util both callers share).
- `src/lib/supabase/server.ts` + `src/lib/supabase/service.ts` — Existing Supabase client factories.
- `src/lib/logger.ts` — `createLogger({ module: "profile" })` pattern for any new server-side handlers.

### Design System
- `CLAUDE.md` (repo root) — Raycast design language rules: 6% borders, 12px card radius, Inter font, accent only on primary CTAs / active progress dot / focus ring (UI-SPEC enforces these for this phase).
- `src/app/globals.css` — Token source-of-truth (`--color-*`, `--spacing-*`, typography tokens). UI-SPEC references these directly.
- `src/components/ui/dialog.tsx`, `button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `typography.tsx`, `badge.tsx`, `tabs.tsx`, `skeleton.tsx`, `spinner.tsx`, `toast.tsx` — All existing primitives the new components compose from (per UI-SPEC inventory).

### Phase 2 Outputs (will be created)
- `src/lib/niches/taxonomy.ts` — Hardcoded TS niche tree (per D-10).
- `supabase/migrations/<timestamp>_creator_profile_9card_columns.sql` — column additions.
- 14 new components per UI-SPEC inventory (ProfileInterviewModal, InterviewCard, CardProgressDots, 9 picker/input components, TruthfulnessCallout, ProfileSettingsForm).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`creator_profiles` table** — already exists with social handles, niches[], primary_goal, onboarding columns. New 9-card columns extend rather than replace.
- **`useOnboardingStore` `persistToSupabase` pattern** — incremental-save pattern reusable for the save-on-each-card-advance behavior (D-18). Could split out a shared utility (Claude's discretion) or inline a parallel pattern in the new modal store.
- **`src/components/ui/dialog.tsx` Radix Dialog wrapper** — UI-SPEC explicitly composes from this. Includes `DialogContent` (with `size="lg"` per UI-SPEC), `DialogHeader`, `DialogFooter`, animations matching the design system.
- **Existing Radix `Tabs` in `settings-page.tsx`** — adding the 6th "Creator Profile" tab is a one-pattern-match extension; same icon-prefix style, same `data-[state=active]` styling.
- **`/api/profile` route handler** (`src/app/api/profile/route.ts`) — existing GET/PATCH handler for the basic profile section. New 9-card data can route through either an extension of this handler (PATCH whitelisted to 9-card columns) or a sibling handler (`/api/profile/creator-profile`). Planner's call.
- **`src/app/actions/competitors/add.ts`** — server action for adding a competitor (used by /competitors UI). D-06 auto-add reference-creator flow reuses this path.
- **`src/lib/engine/creator.ts` `fetchCreatorContext()`** — extension point per PROFILE-17 / D-19.
- **Apify scraping module** (`src/lib/scraping/`) + Apify webhook pattern — async scrape kickoff (D-07) reuses existing infrastructure.
- **Zod schemas** — project pattern: validate at API boundary; new schemas for 9-card PATCH bodies.

### Established Patterns
- **Server components by default; `"use client"` only when interactive** — `ProfileInterviewModal`, all picker components, `ProfileSettingsForm` are client components. The route pages that host them stay server-rendered.
- **Zustand for client UI state** — `useProfileInterviewStore` (new) for card-advance state, draft answers, current card index. Separate from `useOnboardingStore` (different lifecycle).
- **TanStack Query for server state** — `useCreatorProfile()` (new query hook) for /settings/creator-profile read + mutation.
- **RLS on user-scoped tables** — `creator_profiles` already has user-scoped RLS; new columns inherit it.
- **Graceful degradation in engine stages** — Phase 1 D-rule. Missing 9-card data must NOT throw or block the pipeline; null fields = stage uses defaults + emits warning.
- **`timed()` wrapper for stage timing** — preserved; no engine pipeline shape change in Phase 2.
- **Vitest 80% coverage threshold** — new modules (niches/taxonomy, profile context merger, handle parser) need tests.

### Integration Points
- **`content-form.tsx` ⟷ ProfileInterviewModal** — interception point; modal mounts on demand, blocks upload submit until dismissed.
- **`fetchCreatorContext` ⟷ 9-card columns** — single read merges scraped data + profile data into one context object for downstream pipeline stages.
- **Card 5 ⟷ Competitors tool** — auto-add via `add.ts` server action; bidirectional reference (Card 5 entry references competitor row; competitor row carries `source: "profile_reference"`).
- **Card 0 (platforms) + Card 1 (niche) + Card 3 (goal/stage)** ⟷ Phase 4 (niche detector confidence fallback), Phase 7 (persona allocation tuning), Phase 9 (platform-fit weighting) — these phases consume profile fields directly via the extended CreatorContext.
- **NEW: `src/lib/niches/taxonomy.ts`** — single source consumed by Card 1 NichePicker + Phase 4 niche detector. Defines `type NicheTree`, `getNicheBranches(primary)`, etc.
- **NO changes to:** `pipeline.ts`, `aggregator.ts`, `types.ts` (PredictionResult schema) — phase is additive per milestone constraint.

</code_context>

<specifics>
## Specific Ideas

- **User opened the discussion with a direction-locking statement**: "the cards shouldn't be with onboarding but at the video upload, mandatory but skippable and with clear info that this is really important for prediction accuracy." This collapses multiple decisions into one product directive — UI-SPEC was already consistent, but this is the user's voice on placement, mandatoriness semantics, and the emotional weight of the truthfulness callout. Honor this voice when researcher/planner write copy or interaction details that go beyond UI-SPEC.
- **User self-identified as non-technical**: "I don't have much technical knowledge, ask me all questions you need to know." Honor this in the planner output too — copy + interaction details get user attention; schema column shapes, migration structure, and code organization are Claude's call. When asking the user follow-ups in later phases (research clarifications, plan-review questions), prefer user-vision framing over technical framing.
- **User chose to remove duplication aggressively** — picking "trim welcome to TikTok handle only" over "keep welcome as-is" signals an instinct to minimize friction. Apply this same instinct elsewhere in the implementation (e.g., don't ask for fields in the modal that are already known from elsewhere; if the user already has TikTok handle from welcome, Card 0 platform-pick infers TikTok = already-on).
- **Reference-creator auto-add is the highest-leverage user-vision decision** — it deeply links the 9-card flow to the existing competitors tool. The user picked the most aggressive integration option. Downstream: ensure /competitors UI handles the new `source: "profile_reference"` rows gracefully (small badge per UI-SPEC scope), and the 9-card edit-from-settings flow shows scrape status for those references.
- **2-level niche depth was a user pushback against UI-SPEC's 3-level shape** — UI-SPEC said level 3 was optional; user removed it entirely from the UI. Treat this as a UI-SPEC adjustment (record in `02-UI-SPEC.md` notes if it gets updated, or carry forward as a known divergence). Phase 4 (Wave 0 niche detector) inherits the responsibility for `micro_niche`.

</specifics>

<deferred>
## Deferred Ideas

- **PROFILE-16 re-prompt micro-card** — analysis counter, trigger logic, inline card above upload, toast surface. Entire mechanism deferred to Phase 11 integration work per D-14.
- **Card 1 level-3 micro-niche UI picker** — dropped from Card 1 UI per D-09. Phase 4 niche detector populates `micro_niche` automatically. If pilot data reveals AI inference is weak, revisit by re-adding a level-3 picker as an optional drill-down.
- **`/competitors` UI badge for `source: "profile_reference"`** — schema field is locked in D-08; the UI badge is Claude's discretion in Phase 2 (basic "from your profile" label is acceptable) but a polished surface belongs in M2 alongside other polished UX.
- **Pain points (Card 8) LLM classification into structured pain categories** — Phase 2 just stores the string; Phase 9 may add an extraction pass if self-critique prompt quality benefits. Track as a Phase 9 consideration.
- **Onboarding step state machine cleanup** — `useOnboardingStore`'s `step` field currently transitions connect → goal → preview → completed. After D-03 removes goal+preview, the state machine collapses. Refactor is Claude's discretion but worth noting as a code-cleanup item the planner should fold in (not as new scope).
- **Soft-delete vs hard-delete for `creator_profiles.niches[]`** — existing column is superseded by `niche_primary` + `niche_sub` per D-16. Drop or keep for backwards-compat is a planner call; this CONTEXT.md notes the supersession.

</deferred>

---

*Phase: 2-Creator Profile & 9-Card Interview*
*Context gathered: 2026-05-17*
