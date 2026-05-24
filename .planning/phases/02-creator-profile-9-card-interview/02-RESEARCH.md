# Phase 2: Creator Profile & 9-Card Interview — Research

**Researched:** 2026-05-17
**Domain:** Frontend modal flow + Supabase schema migration + engine `CreatorContext` extension
**Confidence:** HIGH (codebase verified; all anchor files read line-by-line)

---

## Summary

Phase 2 ships three coupled artifacts inside an established Next.js 15 + Supabase + Zustand codebase. CONTEXT.md and UI-SPEC.md have already locked the visual/interaction contract, the table-extension direction, the per-card column shape, the engine-extension shape (flat-add to `CreatorContext`), and the reference-creator auto-add side-effect. Research therefore focuses on **HOW to wire these decisions into existing code** — not what to build.

The codebase exhibits two patterns that this phase reuses directly: (a) Zustand stores with a `persistToSupabase()` helper that does `creator_profiles.update().eq("user_id", user.id)` per field-change, and (b) server-side `fetchCreatorContext()` that returns a graceful-degraded object when no profile row exists. Both patterns are additive-friendly. The biggest integration risk is the **modal-resume-after-skip mechanic** in `content-form.tsx` — there is no existing pattern for "intercept submit, show modal, resume submit." Research recommends a deferred-submit pattern (capture form data on first submit, store pending submit in ref, re-fire after modal close).

**Primary recommendation:** Treat the modal as a **submit-time gate** (not a render-time gate). Add a single `usePendingProfileGate()` hook that returns `{ shouldShowModal, recordModalSeen, openModalAndDefer }` so `content-form.tsx` line 141-145 wraps `onSubmit(formData)` with one conditional. Persist incrementally per-card via a new `useProfileInterviewStore` (Zustand) that calls the same `persistToSupabase` pattern as `onboarding-store.ts`. Extend `CreatorContext` flatly with 14 new nullable fields (one per card data column), matching the existing `found: boolean` graceful-degradation idiom.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 through D-20)

- **D-01:** All visual / interaction / copy / animation / accessibility decisions are locked by `02-UI-SPEC.md`. Treat UI-SPEC as authoritative; do not re-derive UI.
- **D-02:** Modal intercept at `src/components/app/content-form.tsx` line 171 (where `<VideoUpload>` renders). Mandatory appearance, individually skippable cards.
- **D-03:** Welcome flow trims to TikTok handle only. Remove `goal-step.tsx`; `preview-step.tsx` is removable since it only depends on `tiktokHandle` (verified — see Pattern #G).
- **D-04:** Truthfulness callout appears on Card 0 + Card 6 with exact copy from UI-SPEC.
- **D-05:** Mandatory-but-skippable. `profile_interview_seen_at` TIMESTAMPTZ on `creator_profiles` records that modal was shown. No server enforcement.
- **D-06/D-07/D-08:** Card 5 entries auto-add to Competitors via the same path as `src/app/actions/competitors/add.ts`. Async scrape kickoff (no spinner). Schema field `source TEXT` on `user_competitors` set to `'profile_reference'` vs `'manual_add'`.
- **D-09/D-10/D-11:** 2-level niche depth (primary + sub). Hardcoded TS module at `src/lib/niches/taxonomy.ts`. Seed: 5 corpus niches (Beauty, Fitness, Education, Comedy, Lifestyle) plus extension set (researcher proposes — see §Niche Taxonomy Seed Proposal below).
- **D-12/D-13:** 6th tab "Creator Profile" added to `SettingsPage`. Add `"creator-profile"` to `VALID_TABS` in `src/app/(app)/settings/page.tsx`.
- **D-14:** Re-prompt mechanism (PROFILE-16) **fully deferred to Phase 11** — no counter column, no trigger logic. Mark PROFILE-16 as `Deferred to Phase 11` in REQUIREMENTS.md traceability table.
- **D-15/D-16:** Extend existing `creator_profiles` (do NOT new table). Migration follows `YYYYMMDDHHMMSS_description.sql` naming. Column-by-column shape locked (see §Migration File below).
- **D-17:** New columns inherit existing user-scoped RLS policy from `20260202000000_v16_schema.sql` lines 200-211. No policy changes needed.
- **D-18:** Save-on-each-card-advance using `persistToSupabase` pattern from `src/stores/onboarding-store.ts:48`.
- **D-19/D-20:** Flat extension of `CreatorContext`. Preserve `found: boolean` semantics; profile fields independent and individually null-safe.

### Claude's Discretion

- Reference creator handle parsing — exact regex/parser location.
- Competitor auto-add transactional shape (transaction vs idempotent sequential).
- Engine handling of missing card data — defaults per consuming phase.
- `goal-step.tsx` and `preview-step.tsx` removal — full removal vs soft-deprecate; whether `onboarding-store.ts` `step` state machine collapses.
- `creator_profiles` migration file structure — single migration vs split.
- Niche taxonomy extension primary list — researcher proposes, planner locks.
- Settings save UX details — optimistic update vs wait-for-PATCH-200.
- Test surface specifics.

### Deferred Ideas (OUT OF SCOPE)

- PROFILE-16 re-prompt micro-card (analyses counter, trigger, inline card, toast) — Phase 11.
- Card 1 level-3 micro-niche UI picker — Phase 4 niche detector handles it.
- `/competitors` UI badge for `source: "profile_reference"` — polished surface in M2.
- Pain points (Card 8) LLM classification into structured categories — Phase 9 may add.
- Soft-delete vs hard-delete for legacy `creator_profiles.niches[]` — planner's call.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROFILE-01 | `creator_profiles` table schema with RLS | §Migration File — `creator_profiles` exists since `20260202000000_v16_schema.sql:9-33`; RLS policies at lines 200-211. Phase 2 adds columns via ALTER TABLE; RLS auto-inherits. |
| PROFILE-02 | 9-card interview modal with progressive disclosure | §Modal Interception Pattern; §Component Inventory (UI-SPEC) |
| PROFILE-03 | Card 0 — Platform multi-select | §Component Inventory: `PlatformPicker`. New column `target_platforms TEXT[]`. |
| PROFILE-04 | Card 1 — Niche hierarchical | §Niche Taxonomy Module. 2-level per D-09. New columns `niche_primary TEXT`, `niche_sub TEXT`. |
| PROFILE-05 | Card 2 — Target audience | JSONB column `target_audience` per D-16. |
| PROFILE-06 | Card 3 — Goal + Stage | Reuses existing `primary_goal` column; new `creator_stage TEXT`. |
| PROFILE-07 | Card 4 — Content style + cuts/sec | New `content_style TEXT`, `cuts_per_second TEXT`. |
| PROFILE-08 | Card 5 — Reference creators | New JSONB `reference_creators` + side-effect competitor auto-add (§Reference Creator Side-Effect). |
| PROFILE-09 | Card 6 — Past wins + flops | New JSONB `past_wins`, `past_flops`. |
| PROFILE-10 | Card 7 — Cadence | New `posting_frequency TEXT`, `time_of_day_aware BOOLEAN`. |
| PROFILE-11 | Card 8 — Pain points | New `pain_points TEXT`. |
| PROFILE-12 | Truthfulness messaging | UI-SPEC §Card 0 + §Card 6; component `TruthfulnessCallout`. |
| PROFILE-13 | Cards skippable; flow mandatory | §Modal Interception Pattern + `profile_interview_seen_at` flag. |
| PROFILE-14 | Modal-on-first-upload-click trigger | §Modal Interception Pattern (deferred-submit hook). |
| PROFILE-15 | Edit-from-settings | §Settings Page 6th Tab Integration. |
| PROFILE-16 | Re-prompt every 10 analyses | **Deferred to Phase 11 per D-14.** Plan should add a one-line traceability entry pointing to Phase 11, not orphan it. Suggested: `REQUIREMENTS.md` row for PROFILE-16 shows `Phase 11` in Phase column, `Deferred per Phase 2 D-14` in Plan column. |
| PROFILE-17 | Profile loaded into every analysis as enriched `CreatorContext` | §Engine Extension. |
| INT-02 | `video-upload.tsx` integrated with profile gate | §Modal Interception Pattern. Note: gate lives in `content-form.tsx`, not `video-upload.tsx` itself (per D-02 + CONTEXT.md). |
| INT-04 | Existing onboarding integrates without duplication | §Welcome Flow Trim. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Modal trigger (gate) | Browser/Client | API/Backend (read profile row server-side, hydrate gate) | Modal is client-only UI; profile-exists check needs DB read (current user's `creator_profiles.profile_interview_seen_at`). Avoid render-time fetch — load once in `content-form.tsx` parent. |
| Per-card UI state | Browser/Client | — | Zustand `useProfileInterviewStore` (ephemeral; draft answers). |
| Per-card persistence | Browser/Client | API/Backend | Card "Continue" → `persistToSupabase()` PATCH (matches `onboarding-store.ts:48`). |
| Reference-creator auto-add | API/Backend | External (Apify webhook) | Reuse `src/app/actions/competitors/add.ts` server action; Apify scrape async (fire-and-forget pattern from `route.ts:132`). |
| Niche taxonomy lookup | Browser/Client (Card 1) + API/Backend (Phase 4 detector) | — | Pure TS module loaded by both sides. |
| Settings edit | Browser/Client (form) | API/Backend (PATCH `/api/profile/creator-profile` or extend existing `/api/profile`) | Mirrors existing `ProfileSection` pattern at `src/components/app/settings/profile-section.tsx`. |
| `CreatorContext` enrichment | API/Backend (pipeline) | Database | `src/lib/engine/creator.ts:135` query extended to SELECT new columns. |
| Welcome flow trim | Browser/Client | — | Pure component removal + `onboarding-store.ts` state-machine simplification. |

---

## Standard Stack

### Core (already installed — verified via package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.1.5 | App Router, server components, server actions | Already the framework |
| `react` | 19.2.3 | UI | Already in use |
| `@supabase/ssr` | 0.8.0 | Server/client Supabase clients | `src/lib/supabase/{client,server,service}.ts` pattern locked |
| `@supabase/supabase-js` | 2.93.1 | DB queries | Existing |
| `@radix-ui/react-dialog` | 1.1.15 | Modal primitive | UI-SPEC composes from `src/components/ui/dialog.tsx` |
| `@radix-ui/react-tabs` | 1.1.13 | Settings tabs | Used directly in `settings-page.tsx:3` |
| `@radix-ui/react-switch` | 1.2.6 | Card 7 time-of-day toggle | `src/components/ui/toggle.tsx` wraps it |
| `zustand` | 5.0.10 | `useProfileInterviewStore` | `onboarding-store.ts` pattern |
| `@tanstack/react-query` | 5.90.21 | `useCreatorProfile()` for settings | `hooks/queries/use-profile.ts` pattern |
| `zod` | 4.3.6 | 9-card PATCH body validation | `competitor.ts:31` pattern |
| `lucide-react` | 0.563.0 | Card icons (Briefcase, TrendingUp, etc.) | Already used in `goal-step.tsx:4` |
| `class-variance-authority` | 0.7.1 | Tile/chip variants | `button.tsx:32`, `dialog.tsx:85` patterns |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supabase` CLI | 2.74.5 (devDep) | Migration apply via `supabase db push` | Phase 1 Plan 01-01 used this exact CLI; SUMMARY documents the procedure |
| `vitest` + `@vitest/coverage-v8` | 4.0.18 | Unit tests at 80% threshold | `vitest.config.ts` already configured |
| `@playwright/test` | 1.58.0 | E2E modal happy path | `e2e/viral-predictor.spec.ts` is the existing template |

**No new dependencies required.** All Phase 2 work is wiring on top of existing libraries.

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| Hardcoded TS niche tree | Supabase `niche_taxonomy` table | Type-unsafe; one extra query per detector call | D-10 rejected this; stay TS-only |
| New `creator_card_responses` table | Extend `creator_profiles` | Extra join on every fetchCreatorContext; per-user is 1:1 anyway | D-15 rejected; extend existing |
| TanStack Query for modal state | Zustand + persistToSupabase | TanStack handles server cache; modal needs ephemeral local state + per-card POST | Use both: Zustand for modal, TanStack for settings edit form (mirrors existing `useProfile` hook) |

**Installation:** No new install. Migration apply:

```bash
supabase db push  # (Phase 1 pattern — see 01-01-SUMMARY.md:173-174)
```

---

## Architecture Patterns

### System Architecture Diagram

```
                  ┌─────────────────────────────┐
                  │  User clicks "Run analysis" │
                  │  in content-form.tsx        │
                  └──────────────┬──────────────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │  usePendingProfileGate hook │
                  │  - Reads creator_profiles.  │
                  │    profile_interview_       │
                  │    seen_at (server-side via │
                  │    parent page hydration)   │
                  └──────┬──────────────────────┘
                         │
            ┌────────────▼────────────┐
            │  seen_at == null?       │
            └─┬─────────────────────┬─┘
              │ YES                 │ NO
              ▼                     ▼
   ┌───────────────────┐   ┌──────────────────┐
   │ ProfileInterview  │   │  onSubmit(data)  │
   │ Modal opens       │   │  proceeds as     │
   │ pendingSubmit =   │   │  normal          │
   │ {formData} ref    │   └──────────────────┘
   └────────┬──────────┘
            │
            ▼ per-card "Continue"
   ┌────────────────────────────────┐
   │  useProfileInterviewStore:     │
   │  - validate card draft         │
   │  - persistToSupabase(cardData) │
   │  - advance to next card        │
   │  - on Card 5: kick off async   │
   │    addCompetitor(handle) for   │
   │    each reference creator      │
   └────────┬───────────────────────┘
            │ user "Save Profile" OR "Skip interview"
            ▼
   ┌────────────────────────────────┐
   │  finalize:                     │
   │  - PATCH profile_interview_    │
   │    seen_at = now()             │
   │  - close modal                 │
   │  - re-fire pendingSubmit       │
   └────────┬───────────────────────┘
            │
            ▼
   ┌────────────────────────────────┐
   │  Upload proceeds.              │
   │  /api/analyze calls            │
   │  fetchCreatorContext which     │
   │  now reads 9-card columns into │
   │  CreatorContext (additive)     │
   └────────────────────────────────┘
```

### Recommended Project Structure (deltas only)

```
src/
├── app/
│   ├── (app)/settings/page.tsx                            # MODIFY: add "creator-profile" to VALID_TABS
│   ├── actions/
│   │   └── competitors/add.ts                             # OPTIONAL: extract `addCompetitor` core to lib/ if Card 5 needs differentiated source field
│   └── api/profile/
│       └── creator-profile/route.ts                       # NEW: PATCH endpoint for 9-card columns (zod-validated)
├── components/
│   ├── app/
│   │   ├── content-form.tsx                               # MODIFY (~line 141-145): wrap handleSubmit with usePendingProfileGate
│   │   ├── profile-interview-modal.tsx                    # NEW (UI-SPEC component)
│   │   ├── interview-card.tsx                             # NEW
│   │   ├── card-progress-dots.tsx                         # NEW
│   │   ├── truthfulness-callout.tsx                       # NEW
│   │   ├── profile-settings-form.tsx                      # NEW
│   │   ├── cards/                                         # NEW DIR (9 card components)
│   │   │   ├── platform-picker.tsx
│   │   │   ├── niche-picker.tsx
│   │   │   ├── audience-picker.tsx
│   │   │   ├── goal-stage-picker.tsx
│   │   │   ├── content-style-picker.tsx
│   │   │   ├── reference-creators-input.tsx
│   │   │   ├── wins-flops-input.tsx
│   │   │   ├── cadence-picker.tsx
│   │   │   └── pain-points-input.tsx
│   │   └── settings/
│   │       ├── settings-page.tsx                          # MODIFY: add 6th tab + CreatorProfileSection
│   │       └── creator-profile-section.tsx                # NEW (renders ProfileSettingsForm)
│   └── onboarding/
│       ├── goal-step.tsx                                  # DELETE
│       └── preview-step.tsx                               # DELETE (only depends on tiktokHandle — no tight coupling)
├── hooks/
│   ├── queries/use-creator-profile.ts                     # NEW (TanStack Query GET + PATCH)
│   └── use-pending-profile-gate.ts                        # NEW (client-side gate hook)
├── lib/
│   ├── niches/
│   │   └── taxonomy.ts                                    # NEW (D-10 hardcoded TS tree)
│   ├── engine/
│   │   └── creator.ts                                     # MODIFY: extend CreatorContext interface + SELECT
│   ├── schemas/
│   │   └── creator-profile.ts                             # NEW (zod schemas for PATCH body)
│   └── handles/
│       └── parse-handle.ts                                # NEW or reuse `normalizeHandle` from competitor.ts:9
├── stores/
│   ├── onboarding-store.ts                                # MODIFY: collapse step state machine (remove "goal"/"preview")
│   └── profile-interview-store.ts                         # NEW (Zustand; draft answers + per-card persist)
└── app/(onboarding)/welcome/page.tsx                      # MODIFY: render only ConnectStep; remove GoalStep/PreviewStep imports + STEPS array

supabase/migrations/
└── 20260517210000_creator_profile_9card_columns.sql      # NEW (single migration, all columns + source field on user_competitors)
```

**Filename convention check:** Phase 1 migration timestamps were `20260512000000_*`, `20260512000100_*`, `20260512010000_*`. Phase 2's current time is `20260517205014`. Use `20260517210000_creator_profile_9card_columns.sql` (rounded to nearest 10-minute mark) for consistency with prior cadence.

### Pattern 1: Modal Interception via Deferred Submit

**What:** Capture the would-be submit, show modal, replay submit on modal close.

**When to use:** Submit-time gate where the user has already filled the form and clicks the CTA.

**Example:**
```typescript
// hooks/use-pending-profile-gate.ts (NEW)
"use client";
import { useRef, useCallback } from "react";
import { useCreatorProfile } from "@/hooks/queries/use-creator-profile";

export function usePendingProfileGate() {
  const { data: profile, isLoading } = useCreatorProfile();
  const pendingSubmit = useRef<(() => void) | null>(null);
  const shouldShowModal = !isLoading && !profile?.profile_interview_seen_at;

  const interceptOrProceed = useCallback(
    (proceed: () => void) => {
      if (shouldShowModal) {
        pendingSubmit.current = proceed;
        return { intercepted: true };
      }
      proceed();
      return { intercepted: false };
    },
    [shouldShowModal]
  );

  const resumeAfterModal = useCallback(() => {
    if (pendingSubmit.current) {
      pendingSubmit.current();
      pendingSubmit.current = null;
    }
  }, []);

  return { shouldShowModal, interceptOrProceed, resumeAfterModal };
}
```

**Integration into `content-form.tsx`** (modifies line 141-145):
```typescript
// Source: src/components/app/content-form.tsx:141-145 (current)
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate()) return;
  onSubmit(formData);
};

// After modification:
const { interceptOrProceed, resumeAfterModal } = usePendingProfileGate();
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate()) return;
  interceptOrProceed(() => onSubmit(formData));
};
// Then render <ProfileInterviewModal onClose={resumeAfterModal} /> conditionally.
```

### Pattern 2: Per-Card Incremental Persist (mirror of `onboarding-store.ts:48`)

**What:** Each "Continue" writes that card's data to `creator_profiles` immediately.

**When to use:** Wizard with skip semantics — partial data must survive mid-flow exits.

**Example:**
```typescript
// stores/profile-interview-store.ts (NEW)
// Source pattern: src/stores/onboarding-store.ts:48-59 (persistToSupabase)
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

async function persistCardData(updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("creator_profiles")
    .update(updates)
    .eq("user_id", user.id);
}

export const useProfileInterviewStore = create<ProfileInterviewState>((set, get) => ({
  currentCard: 0,
  draft: { /* per-card draft state */ },

  advanceCard: async () => {
    const card = get().currentCard;
    const cardData = serializeCard(card, get().draft);
    await persistCardData(cardData);
    set({ currentCard: card + 1 });
  },

  skipCard: async () => {
    set({ currentCard: get().currentCard + 1 });
  },

  skipInterview: async () => {
    await persistCardData({ profile_interview_seen_at: new Date().toISOString() });
  },

  finalize: async () => {
    const draft = get().draft;
    await persistCardData({
      ...serializeAllCards(draft),
      profile_interview_seen_at: new Date().toISOString(),
    });
  },
}));
```

### Pattern 3: `CreatorContext` Flat Extension (mirror of `creator.ts:11-24`)

**Source:** `src/lib/engine/creator.ts:11-24` (current shape):
```typescript
export interface CreatorContext {
  found: boolean;
  follower_count: number | null;
  avg_views: number | null;
  engagement_rate: number | null;
  niche: string | null;
  posting_frequency: string | null;
  platform_averages: { /* ... */ };
}
```

**Extended shape (D-19 flat-add):**
```typescript
export interface CreatorContext {
  // Existing
  found: boolean;
  follower_count: number | null;
  avg_views: number | null;
  engagement_rate: number | null;
  niche: string | null;
  posting_frequency: string | null;
  platform_averages: { /* ... */ };

  // NEW: 9-card profile fields (all nullable for graceful degradation)
  target_platforms: string[] | null;       // Card 0
  niche_primary: string | null;            // Card 1
  niche_sub: string | null;                // Card 1
  target_audience: {                       // Card 2 JSONB
    age_range: string | null;
    gender_skew: "female" | "balanced" | "male" | null;
    geo: string | null;
    language: string | null;
  } | null;
  primary_goal: string | null;             // Card 3 (reuses existing column)
  creator_stage: string | null;            // Card 3
  content_style: string | null;            // Card 4
  cuts_per_second: string | null;          // Card 4
  reference_creators: Array<{              // Card 5 JSONB
    handle_or_url: string;
    normalized_handle: string | null;
    competitor_id_if_added: string | null;
  }> | null;
  past_wins: Array<{ url: string }> | null;   // Card 6 JSONB
  past_flops: Array<{ url: string }> | null;  // Card 6 JSONB
  time_of_day_aware: boolean | null;       // Card 7
  pain_points: string | null;              // Card 8
}
```

**`fetchCreatorContext()` modification** (extends SELECT at `creator.ts:135-141`):
```typescript
// Current SELECT (creator.ts:135-141):
const { data: profile, error } = await supabase
  .from("creator_profiles")
  .select("tiktok_followers, engagement_rate, niches, display_name")
  .eq("tiktok_handle", creator_handle)
  .maybeSingle();

// Extended:
const { data: profile, error } = await supabase
  .from("creator_profiles")
  .select(`
    tiktok_followers, engagement_rate, niches, display_name,
    target_platforms, niche_primary, niche_sub, target_audience,
    primary_goal, creator_stage, content_style, cuts_per_second,
    reference_creators, past_wins, past_flops,
    posting_frequency, time_of_day_aware, pain_points
  `)
  .eq("tiktok_handle", creator_handle)
  .maybeSingle();
```

**Critical preservation:** `found: boolean` semantics — `found = true` still means "scraped creator record exists in DB". New profile fields are independent; downstream consumers must null-check each individually (per D-20). Update `formatCreatorContext()` at `creator.ts:181-219` to include profile lines only when non-null (don't pollute prompts with "Niche: null").

### Pattern 4: Reference Creator Side-Effect (Card 5 auto-add)

**What:** On profile save (or on Card 5 advance — researcher recommends Card 5 advance for parallel scrape), parse each `reference_creators[].handle_or_url` and call the same path as `src/app/actions/competitors/add.ts`.

**Decision: extract or call as-is?**
- **Option A (recommended):** Call existing `addCompetitor()` server action directly. Add an optional second parameter: `source: 'profile_reference' | 'manual_add' = 'manual_add'`. Backwards-compatible.
- **Option B:** Extract the core scrape+upsert logic to `lib/competitors/add-core.ts`, callable from both the action and the new profile-save path.

Option A is simpler and matches the existing server-action pattern. The `source` field gets written when the junction row is inserted at `add.ts:131-133`:

```typescript
// Source: src/app/actions/competitors/add.ts:131-133 (current)
const { error: junctionError } = await supabase
  .from("user_competitors")
  .insert({ user_id: user.id, competitor_id: profileId });

// Modified:
const { error: junctionError } = await supabase
  .from("user_competitors")
  .insert({
    user_id: user.id,
    competitor_id: profileId,
    source: source ?? 'manual_add',  // NEW
  });
```

**Idempotency:** `user_competitors` has `UNIQUE(user_id, competitor_id)` constraint (verified in `20260216100000_competitor_tables.sql:50`). Adding the same handle twice returns Postgres `23505` (already handled at `add.ts:135-138`). Card 5 → addCompetitor with `source: 'profile_reference'` is safe to call even if user already manually added that handle.

**Async pattern:** `addCompetitor()` is `async` and synchronously inserts the junction + upserts the profile, but the actual Apify scrape inside it (line 55) blocks. For Card 5's async kickoff (D-07: "no spinner blocking the user"), wrap in fire-and-forget:

```typescript
// In profile-interview-store.ts finalize() or Card 5 advance:
for (const entry of referenceCreators) {
  const normalized = normalizeHandle(entry.handle_or_url);
  if (!normalized) continue;
  // Fire-and-forget — same pattern as /api/profile/route.ts:132-150
  void addCompetitor(normalized, 'profile_reference').catch((e) => {
    console.warn('[profile] reference creator add failed:', e);
  });
}
```

This matches the existing fire-and-forget pattern at `route.ts:132` (`void (async () => { ... })()`).

### Anti-Patterns to Avoid

- **Don't fetch profile on every modal render.** Read once when the parent page mounts (TanStack `useCreatorProfile`); pass result down. The gate is a render-once decision.
- **Don't block upload on Apify scrape.** D-07 explicitly says async. Use fire-and-forget; the user clicks "Save Profile" and the upload proceeds even if scrape is still running.
- **Don't add micro_niche to the UI.** D-09 dropped level-3 from Card 1 — leave Phase 4 niche detector to populate `micro_niche` automatically.
- **Don't reach into `<VideoUpload>` for the gate.** Per D-02 and CONTEXT.md, the intercept point is `content-form.tsx`'s submit handler, NOT the `VideoUpload` component. Touching `video-upload.tsx` would couple unrelated concerns.
- **Don't add `profile_analyses_count` column.** D-14 says re-prompt is Phase 11. No counter, no trigger.
- **Don't drop `niches[]` column.** Per D-16, keep for backwards-compat. Migration only ADDs columns.

---

## Migration File

Single migration file proposed (D-15 leaves this to planner; researcher recommends single for simpler rollback):

**Filename:** `supabase/migrations/20260517210000_creator_profile_9card_columns.sql`

**Content shape (planner finalizes — illustrative):**
```sql
-- Phase 2: 9-card interview extends creator_profiles
-- New columns are all nullable for graceful degradation when interview is skipped.

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS target_platforms       TEXT[]      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS niche_primary          TEXT,
  ADD COLUMN IF NOT EXISTS niche_sub              TEXT,
  ADD COLUMN IF NOT EXISTS target_audience        JSONB,
  ADD COLUMN IF NOT EXISTS creator_stage          TEXT,
  ADD COLUMN IF NOT EXISTS content_style          TEXT,
  ADD COLUMN IF NOT EXISTS cuts_per_second        TEXT,
  ADD COLUMN IF NOT EXISTS reference_creators     JSONB,
  ADD COLUMN IF NOT EXISTS past_wins              JSONB,
  ADD COLUMN IF NOT EXISTS past_flops             JSONB,
  ADD COLUMN IF NOT EXISTS posting_frequency      TEXT,
  ADD COLUMN IF NOT EXISTS time_of_day_aware      BOOLEAN,
  ADD COLUMN IF NOT EXISTS pain_points            TEXT,
  ADD COLUMN IF NOT EXISTS profile_interview_seen_at TIMESTAMPTZ;

-- D-08: source field on user_competitors for reference-creator provenance
ALTER TABLE user_competitors
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_add'
    CHECK (source IN ('manual_add', 'profile_reference'));

-- Note: existing RLS policies on creator_profiles (lines 200-211 in 20260202000000_v16_schema.sql)
-- automatically apply to new columns. No new policies needed (D-17).
```

**Note on `primary_goal`:** Already exists since `20260213000000_onboarding_columns.sql:4`. Card 3 reuses it; no new column.

**Note on `posting_frequency`:** Re-check current state — `creator_profiles` does NOT currently have this column (verified against `20260202000000_v16_schema.sql:9-31` and `20260213000000_onboarding_columns.sql:1-6`). Add it.

**Migration apply mechanism** (per Phase 1 SUMMARY `01-01-SUMMARY.md:173-174`):
```bash
npx supabase link --project-ref <project-ref>   # one-time
npx supabase db push                             # applies new migration(s)
```

The repo has `supabase/config.toml` (verified) with project_id `virtuna-v1.1`; `supabase` CLI is in devDependencies. The same pattern applied 4 migrations in Phase 1. No new tooling needed.

**Regenerate types after push:**
```bash
npx supabase gen types typescript --linked > src/types/database.types.ts
```

(Per `01-01-SUMMARY.md:120`. Currently the file is hand-augmented because Docker wasn't running in Phase 1; once project is linked, this command replaces hand-augmentation cleanly.)

---

## Niche Taxonomy Seed Proposal

**Module:** `src/lib/niches/taxonomy.ts` (NEW per D-10)

**Type shape:**
```typescript
export type NicheSubItem = { slug: string; label: string };
export type NichePrimary = {
  slug: string;
  label: string;
  subs: NicheSubItem[];
};
export type NicheTree = NichePrimary[];

export const NICHE_TREE: NicheTree = [/* see below */];

export function getNicheBranches(primarySlug: string): NicheSubItem[] {
  return NICHE_TREE.find(p => p.slug === primarySlug)?.subs ?? [];
}
```

**Seed list — 10 primaries × 8–10 subs each (researcher proposal; planner locks):**

Anchored on the 5 Phase 1 corpus niches (Beauty, Fitness, Education, Comedy, Lifestyle) + 5 extensions for creator-coverage breadth:

1. **Beauty** — Skincare, Makeup, Hair, Nails, Fragrance, Skincare Reviews, Get Ready With Me, Tutorials, Hauls
2. **Fitness** — Strength Training, Calisthenics, Yoga, Running, Home Workouts, Nutrition/Diet, Mobility, Crossfit, Powerlifting, Bodybuilding
3. **Education** — Coding/Programming, Personal Finance, Career Advice, Language Learning, Science, History, Self-Improvement, Study Tips
4. **Comedy** — Skits, Stand-Up Clips, Parody, Observational, Pranks, Memes, Storytelling, Character/Persona, Reactions
5. **Lifestyle** — Day in the Life, Travel, Home Decor, Productivity, Routines, Minimalism, Sustainable Living, Hauls
6. **Food & Cooking** — Quick Recipes, Restaurant Reviews, Baking, Healthy Eating, Meal Prep, International Cuisine, Drink/Cocktails, Food Hacks
7. **Tech & Gadgets** — Smartphone Reviews, Apps, Gaming Gear, Tutorials, Productivity Tools, AI Tools, Smart Home, Unboxings
8. **Gaming** — Mobile Games, PC Gaming, Console Gaming, Speedruns, Tips/Tutorials, Streaming Highlights, Esports, Indie Games
9. **Fashion & Style** — OOTD, Thrifting, Sustainable Fashion, Streetwear, Vintage, Capsule Wardrobes, Style Tips
10. **Music & Performance** — Singing, Dancing, Instrument Covers, Music Production, Songwriting, Reactions to Music

Total: ~85 sub-niches across 10 primaries — fits comfortably in a TS module under 200 lines.

**Tradeoff note:** This is broad-but-shallow. The Phase 4 AI niche detector (CONTENT-02) handles `micro_niche` automatically per D-09, so depth-coverage in this hardcoded list is intentionally light.

---

## File Inventory

Concrete file-by-file map with closest analog and code anchors.

| New/Modified File | Closest Analog | Code Anchor | Notes |
|-------------------|----------------|-------------|-------|
| `supabase/migrations/20260517210000_creator_profile_9card_columns.sql` | `20260213000000_onboarding_columns.sql` | Lines 1-5 (ALTER TABLE pattern) | Single migration, additive ALTER TABLE only. |
| `src/lib/niches/taxonomy.ts` | None — net new | (see Niche Taxonomy Seed Proposal above) | Pure TS module. Shared by Card 1 and Phase 4. |
| `src/lib/engine/creator.ts` | (modifying existing) | Interface lines 11-24, fetchCreatorContext lines 112-173, formatCreatorContext lines 181-219 | Flat extension of CreatorContext per D-19. Extend SELECT (line 137-138). Add `formatCreatorContext` profile lines guarded by null checks. |
| `src/lib/handles/parse-handle.ts` | `src/lib/schemas/competitor.ts:9-20` (normalizeHandle) | `function normalizeHandle(input: string): string` | RECOMMEND: reuse `normalizeHandle` from `competitor.ts` directly — no new file. Already handles `tiktok.com/@user`, `@user`, and bare-handle forms. |
| `src/lib/schemas/creator-profile.ts` | `src/lib/schemas/competitor.ts:31-43` | apifyProfileSchema (zod object shape) | Zod schemas for PATCH body per-card (server-side validation). |
| `src/app/api/profile/creator-profile/route.ts` | `src/app/api/profile/route.ts:76-160` | Full PATCH handler | Mirror existing PATCH pattern: auth check, zod parse, upsert. Per-card PATCH or single bulk PATCH — planner's call. |
| `src/hooks/queries/use-creator-profile.ts` | `src/hooks/queries/use-profile.ts:19-58` | `useProfile()` + `useUpdateProfile()` | TanStack Query GET (returns profile + seen_at flag) and PATCH mutation. |
| `src/hooks/use-pending-profile-gate.ts` | None — net new | (see Pattern 1 above) | Client-side gate hook. |
| `src/stores/profile-interview-store.ts` | `src/stores/onboarding-store.ts:48-132` | `persistToSupabase()` (line 48), state machine (line 61-132) | Mirrors onboarding-store but with `currentCard: number` instead of named steps. |
| `src/stores/onboarding-store.ts` | (modifying existing) | `OnboardingStep` type (line 4), state machine (line 61-132) | Collapse: remove `"goal"` and `"preview"` from `OnboardingStep` union; remove `setPrimaryGoal` and `primaryGoal` (move to profile interview); rename `step` machine to `connect → completed` only. |
| `src/components/app/content-form.tsx` | (modifying existing) | Submit handler lines 141-145 | Wrap `onSubmit(formData)` with `interceptOrProceed()`. Render `<ProfileInterviewModal />` conditionally. |
| `src/components/app/profile-interview-modal.tsx` | `src/components/ui/dialog.tsx` | `DialogContent size="lg"` line 116 | Outer Dialog shell. Suppress onEscapeKeyDown + onPointerDownOutside per UI-SPEC Accessibility. |
| `src/components/app/interview-card.tsx` | None — net new (composes Heading, Text, Button) | UI-SPEC §Components | Single-card frame; takes children slot for picker. |
| `src/components/app/card-progress-dots.tsx` | None | UI-SPEC §"Progress indicator" | 9-dot row. |
| `src/components/app/truthfulness-callout.tsx` | None | UI-SPEC §Color "Truthfulness callout" | Reused on Card 0 + Card 6. |
| `src/components/app/cards/platform-picker.tsx` | `src/components/onboarding/goal-step.tsx:60-94` | Tile-button pattern (button + selected state) | Multi-select variant of goal-step's single-select tiles. |
| `src/components/app/cards/niche-picker.tsx` | None — net new | UI-SPEC §Card 1 | Reads from `NICHE_TREE` in taxonomy module. 2-level animated drill-down per D-09. |
| `src/components/app/cards/audience-picker.tsx` | `src/components/ui/select.tsx` for age dropdown | Select usage pattern | Composes Select + tile toggles + InputField. |
| `src/components/app/cards/goal-stage-picker.tsx` | `src/components/onboarding/goal-step.tsx:60-94` | Same tile pattern | 2 stacked groups: goal (2×2) + stage (3-in-a-row). |
| `src/components/app/cards/content-style-picker.tsx` | `goal-step.tsx` tile pattern | (as above) | 2×3 grid + 3-option toggle. |
| `src/components/app/cards/reference-creators-input.tsx` | `src/components/ui/input.tsx:269-314` (InputField) | InputField + remove ghost button | 3 URL inputs + add/remove. |
| `src/components/app/cards/wins-flops-input.tsx` | (same as reference-creators-input) | InputField pattern | 2×2 columns. |
| `src/components/app/cards/cadence-picker.tsx` | `src/components/ui/select.tsx` + `src/components/ui/toggle.tsx` | Both | Select + Switch. |
| `src/components/app/cards/pain-points-input.tsx` | `src/components/ui/textarea.tsx` | Textarea | 500-char cap. |
| `src/components/app/profile-settings-form.tsx` | `src/components/app/settings/profile-section.tsx:75-183` | Form structure + handleSave pattern | Scrollable form, all 9 cards as sections, single "Save changes" CTA. |
| `src/components/app/settings/settings-page.tsx` | (modifying existing) | Lines 13, 16-22, 53-67 (TABS array, Tabs.Content) | Add `"creator-profile"` literal to type union (line 13), add to TABS array, add Tabs.Content rendering `<CreatorProfileSection />`. |
| `src/components/app/settings/creator-profile-section.tsx` | `src/components/app/settings/profile-section.tsx` | Full file (188 lines) | Renders ProfileSettingsForm. |
| `src/app/(app)/settings/page.tsx` | (modifying existing) | Line 13 `VALID_TABS` | Add `"creator-profile"` to tuple + ValidTab type. |
| `src/app/actions/competitors/add.ts` | (modifying existing) | Lines 15, 131-133 | Add optional `source` parameter; thread into junction insert. |
| `src/app/(onboarding)/welcome/page.tsx` | (modifying existing) | Lines 12, 70-71, 138-141 | Remove `STEPS = ["connect", "goal", "preview"]` → `["connect"]`. Remove GoalStep/PreviewStep imports + render branches. Add direct redirect to `/dashboard` after connect-step completes. |
| `src/components/onboarding/goal-step.tsx` | (deleting) | Entire file (117 lines) | DELETE — `primary_goal` now collected in Card 3. |
| `src/components/onboarding/preview-step.tsx` | (deleting) | Entire file (42 lines) | DELETE — depends only on `tiktokHandle`; not load-bearing. Note: `<HiveDemoCanvas />` import is the only external dep — safe to remove. |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap inside modal | Manual `tabindex` cycling | Radix Dialog (already in `dialog.tsx`) | UI-SPEC explicit; Radix `DialogPrimitive.Content` handles focus trap + scroll lock |
| TikTok handle parsing | Custom regex | `normalizeHandle` from `src/lib/schemas/competitor.ts:9-20` | Already handles `tiktok.com/@user`, `@user`, bare-handle. Tested in addCompetitor flow. |
| Apify scrape kickoff | New Apify client init | `createScrapingProvider()` from `src/lib/scraping/index.ts:9-15` | Pattern used by addCompetitor; lazy-loads to avoid bundling Apify in client. |
| Tabs primitive for settings | New tab component | Existing Radix `Tabs.Root` already in `settings-page.tsx:29` | Settings page uses Radix directly, not the UI primitive at `src/components/ui/tabs.tsx`. Match existing style. |
| Profile gate via middleware | New middleware route | Client-side `useCreatorProfile()` + render-time check | Simpler; profile reads are cheap; one TanStack Query handles cache. |
| Migration runner | Custom SQL execution | `supabase db push` (Phase 1 pattern) | CLI in devDependencies; SUMMARY documents exact procedure. |
| Niche taxonomy storage | Supabase table | Hardcoded TS module per D-10 | Type-safe; no per-render query. |
| Per-card save endpoint | New SSE / WebSocket | Existing `creator_profiles.update().eq("user_id", ...)` via browser client | RLS already scoped to `user_id`. No backend round-trip needed. |
| Zod validation primitives | Custom validators | Zod (already in `competitor.ts:31`) | Composes with existing pattern. |
| Toast feedback | Custom alert | Existing `ToastProvider` in `(app)/layout.tsx:27` | Wraps all dashboard routes. |

**Key insight:** Phase 2 is almost entirely composition of existing patterns. The only true net-new infrastructure is the niche taxonomy module and the deferred-submit hook. Everything else is "mirror this existing file's shape."

---

## Runtime State Inventory

This phase is greenfield (additive). However, since it touches `creator_profiles` and removes onboarding components, complete the runtime-state inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `creator_profiles` rows exist for current users with `niches[]`, `primary_goal`, `onboarding_step` values. New columns default to NULL — no migration script for existing rows needed. | None — graceful degradation handles missing card data. |
| Live service config | None — Apify scrapes are async fire-and-forget; no external config keyed on the modal flow. | None. |
| OS-registered state | None — no cron jobs, scheduled tasks, or systemd units touch profile data. | None. |
| Secrets/env vars | `APIFY_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` already in use by addCompetitor and `/api/profile`. No new secrets. | None. |
| Build artifacts | `src/types/database.types.ts` will be stale after migration — regenerate via `npx supabase gen types typescript --linked > src/types/database.types.ts`. | Regenerate after `supabase db push`. |
| Component dependencies | `goal-step.tsx` and `preview-step.tsx` are imported only by `src/app/(onboarding)/welcome/page.tsx` (verified via grep). Safe to delete. | Delete files + remove imports. |
| State machine | `onboarding-store.ts` `OnboardingStep` union currently `"connect" \| "goal" \| "preview" \| "completed"`. After D-03 trim: collapse to `"connect" \| "completed"`. | Update union, remove `setPrimaryGoal` (moved to profile interview). |

**Nothing else found:** Verified by grepping `goal-step|preview-step|primaryGoal|primary_goal` across `src/`. Onboarding page and store are the only callers.

---

## Common Pitfalls

### Pitfall 1: Modal renders before profile fetch resolves

**What goes wrong:** First-time user clicks "Run analysis"; `useCreatorProfile()` is still loading; gate flips between `shouldShowModal=false` (no data) → `true` (data arrives showing null seen_at) → modal pops AFTER submit fires.

**Why it happens:** TanStack `isLoading` not gated before submit decision.

**How to avoid:** Disable the submit button (or show subtle skeleton on the form) while `isLoading=true`. Existing `isSubmitDisabled` at `content-form.tsx:147-150` already gates on form-validity; add an OR clause for profile-loading state.

**Warning signs:** Race-condition in e2e test where rapid form-submission triggers modal AFTER the upload starts.

### Pitfall 2: Apify scrape errors crash profile save

**What goes wrong:** Card 5 reference creator handle is invalid (e.g., typo); `addCompetitor` throws "TikTok handle not found or could not be scraped" (`add.ts:59`); the error propagates and blocks `finalize()`.

**Why it happens:** `addCompetitor` returns `{ error }` for some failures but throws inside the scraper. Without fire-and-forget guard, errors bubble.

**How to avoid:** Always wrap reference-creator adds in `void addCompetitor(...).catch()`. Mirror the existing fire-and-forget pattern at `route.ts:132-150`. The user should never see "Failed to add competitor" from Card 5 — that's a follow-up surface.

**Warning signs:** Profile save fails on a single bad URL; user can't proceed past Card 5.

### Pitfall 3: `formatCreatorContext()` outputs `null` to prompts

**What goes wrong:** When extending `formatCreatorContext()` at `creator.ts:181-219` for new fields, naive `lines.push(\`Niche primary: ${ctx.niche_primary}\`)` writes `Niche primary: null` to Gemini/DeepSeek prompts when field is null.

**Why it happens:** No null-guard on push.

**How to avoid:** Mirror the existing pattern at lines 186-200: `if (ctx.niche_primary) { lines.push(...) }`. Each new field gets its own `if` guard.

**Warning signs:** Prompts contain literal "null" strings in production logs.

### Pitfall 4: Type regeneration overwrites hand-augmented types

**What goes wrong:** After `supabase db push`, running `npx supabase gen types typescript --linked > src/types/database.types.ts` replaces a file that may have hand-augmented blocks (per `01-01-SUMMARY.md:120`). Could lose existing type definitions if Phase 1 added types that weren't applied via migration.

**Why it happens:** Phase 1 hand-augmented `database.types.ts` because Docker wasn't running locally; Phase 2 may legitimately need to regenerate.

**How to avoid:** Before regenerating, `git diff` the current file to see hand-augmented sections. After regenerating, verify no regression. The Phase 1 migrations are committed and present in `supabase/migrations/`, so a regenerate-against-linked-project should produce a superset of the hand-augmented file (everything PLUS the new Phase 2 columns).

**Warning signs:** Build fails with missing types from training_corpus or benchmark_results.

### Pitfall 5: Welcome flow trim breaks existing user mid-flow

**What goes wrong:** A user who started onboarding before this deploy may have `onboarding_step = 'goal'` in their `creator_profiles` row. After deploy, `OnboardingStep` union no longer includes `"goal"`; the welcome page can't restore them.

**Why it happens:** Type narrowing on the state machine.

**How to avoid:** In `welcome/page.tsx:62-65` where step is restored from DB, add a fallback: any unrecognized step → reset to `"connect"`. Better: write a one-time data migration UPDATE that maps `'goal'` and `'preview'` rows to `'connect'`. Add to the same migration file:

```sql
UPDATE creator_profiles
SET onboarding_step = 'connect'
WHERE onboarding_step IN ('goal', 'preview');
```

**Warning signs:** Old user lands on `/welcome` and sees a blank page or runtime error.

### Pitfall 6: Card 5 idempotency on re-edit

**What goes wrong:** User opens settings, edits Card 5 to remove reference creator A and add B. Naive save calls `addCompetitor` for B (correct) but doesn't UNDO the auto-add of A (incorrect — A's `user_competitors` row stays as `source='profile_reference'`).

**Why it happens:** Profile is the source of truth; competitors junction is a side-effect. Without diff logic, side-effects leak.

**How to avoid:** Profile save computes diff: removed handles → `removeCompetitor` (existing pattern); added handles → `addCompetitor(handle, 'profile_reference')`. Alternative: planner can defer this to a "settings edit doesn't auto-remove from competitors" simplification — match the deferred-polish scope of M1 per UI-SPEC §"Scope Note".

**Warning signs:** Competitors list has stale entries the user thought they removed.

---

## Code Examples

### Modal Trigger Wiring (content-form.tsx)

```typescript
// Source: src/components/app/content-form.tsx:141-180 (modified)
"use client";
import { usePendingProfileGate } from "@/hooks/use-pending-profile-gate";
import { ProfileInterviewModal } from "@/components/app/profile-interview-modal";

export function ContentForm({ onSubmit, uploadProgress, className }: ContentFormProps) {
  // ... existing state ...
  const { shouldShowModal, interceptOrProceed, resumeAfterModal } = usePendingProfileGate();
  const [modalOpen, setModalOpen] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const { intercepted } = interceptOrProceed(() => onSubmit(formData));
    if (intercepted) setModalOpen(true);
  };

  return (
    <>
      <form onSubmit={handleSubmit} {...existing}>
        {/* unchanged */}
      </form>
      {modalOpen && (
        <ProfileInterviewModal
          onClose={() => {
            setModalOpen(false);
            resumeAfterModal();
          }}
        />
      )}
    </>
  );
}
```

### Per-Card Persistence (profile-interview-store.ts)

```typescript
// Source: mirrors src/stores/onboarding-store.ts:48-59
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

interface CardDraft { /* shape per UI-SPEC */ }

interface ProfileInterviewState {
  currentCard: number;
  draft: CardDraft;
  setDraftField: <K extends keyof CardDraft>(k: K, v: CardDraft[K]) => void;
  advanceCard: () => Promise<void>;
  skipCard: () => void;
  goBack: () => void;
  skipInterview: () => Promise<void>;
  finalize: () => Promise<void>;
}

async function persistCardData(updates: Record<string, unknown>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("creator_profiles").update(updates).eq("user_id", user.id);
}

const serializeCard = (cardIdx: number, draft: CardDraft): Record<string, unknown> => {
  switch (cardIdx) {
    case 0: return { target_platforms: draft.platforms };
    case 1: return { niche_primary: draft.nichePrimary, niche_sub: draft.nicheSub };
    case 2: return { target_audience: draft.audience };  // JSONB
    case 3: return { primary_goal: draft.primaryGoal, creator_stage: draft.stage };
    case 4: return { content_style: draft.style, cuts_per_second: draft.cuts };
    case 5: return { reference_creators: draft.references };  // JSONB
    case 6: return { past_wins: draft.wins, past_flops: draft.flops };  // JSONB
    case 7: return { posting_frequency: draft.cadence, time_of_day_aware: draft.todAware };
    case 8: return { pain_points: draft.pain };
    default: return {};
  }
};

export const useProfileInterviewStore = create<ProfileInterviewState>((set, get) => ({
  currentCard: 0,
  draft: { /* initial */ },
  setDraftField: (k, v) => set(s => ({ draft: { ...s.draft, [k]: v } })),
  advanceCard: async () => {
    const card = get().currentCard;
    await persistCardData(serializeCard(card, get().draft));
    if (card === 5) await addReferenceCreators(get().draft.references);  // Card 5 side-effect
    set({ currentCard: card + 1 });
  },
  skipCard: () => set(s => ({ currentCard: s.currentCard + 1 })),
  goBack: () => set(s => ({ currentCard: Math.max(0, s.currentCard - 1) })),
  skipInterview: async () => {
    await persistCardData({ profile_interview_seen_at: new Date().toISOString() });
  },
  finalize: async () => {
    await persistCardData({ profile_interview_seen_at: new Date().toISOString() });
  },
}));

async function addReferenceCreators(refs: Array<{ handle_or_url: string }>) {
  const { addCompetitor } = await import("@/app/actions/competitors/add");
  const { normalizeHandle } = await import("@/lib/schemas/competitor");
  for (const ref of refs) {
    const normalized = normalizeHandle(ref.handle_or_url);
    if (!normalized) continue;
    void addCompetitor(normalized, "profile_reference").catch(e =>
      console.warn("[profile] reference creator add failed:", e)
    );
  }
}
```

### Niche Taxonomy Module Skeleton

```typescript
// Source: src/lib/niches/taxonomy.ts (NEW)
export type NicheSubItem = { slug: string; label: string };
export type NichePrimary = { slug: string; label: string; subs: NicheSubItem[] };
export type NicheTree = NichePrimary[];

export const NICHE_TREE: NicheTree = [
  {
    slug: "beauty",
    label: "Beauty",
    subs: [
      { slug: "skincare", label: "Skincare" },
      { slug: "makeup", label: "Makeup" },
      { slug: "hair", label: "Hair" },
      // ...
    ],
  },
  {
    slug: "fitness",
    label: "Fitness",
    subs: [
      { slug: "strength_training", label: "Strength Training" },
      { slug: "calisthenics", label: "Calisthenics" },
      // ...
    ],
  },
  // ... 8 more primaries
];

export function getNicheBranches(primarySlug: string): NicheSubItem[] {
  return NICHE_TREE.find(p => p.slug === primarySlug)?.subs ?? [];
}

export function getPrimaryLabel(slug: string): string | null {
  return NICHE_TREE.find(p => p.slug === slug)?.label ?? null;
}

export function getSubLabel(primarySlug: string, subSlug: string): string | null {
  return getNicheBranches(primarySlug).find(s => s.slug === subSlug)?.label ?? null;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `niches TEXT[]` on creator_profiles | `niche_primary TEXT` + `niche_sub TEXT` + Phase 4 detector for `micro_niche` | Phase 2 (D-09, D-16) | Existing column kept for backwards-compat; new code reads new columns. |
| Welcome flow asks `primary_goal` | Card 3 of interview asks `primary_goal` | Phase 2 (D-03) | Welcome trims to TikTok handle only. |
| `CreatorContext` only has scraped fields | `CreatorContext` adds 14 nullable profile fields | Phase 2 (D-19) | Downstream consumers individually null-check (D-20). |
| Competitors only added manually | Competitors added manually OR via Card 5 with `source='profile_reference'` | Phase 2 (D-08) | `user_competitors.source` enables future UI badge in M2. |

**Deprecated/outdated:**
- `OnboardingStep = "connect" | "goal" | "preview" | "completed"` → `"connect" | "completed"`. Old enum values remain in DB rows; mitigate via the migration UPDATE shown in Pitfall #5.
- `useOnboardingStore.setPrimaryGoal` → use `useProfileInterviewStore` Card 3 instead.
- The `goal-step.tsx` and `preview-step.tsx` components — delete.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (unit) + Playwright 1.58.0 (e2e) |
| Config file | `vitest.config.ts` (root) + `e2e/playwright.config.ts` |
| Quick run command | `npm test -- src/lib/niches/__tests__/taxonomy.test.ts` |
| Full suite command | `npm test` (vitest) + `npm run e2e` (playwright) |
| Coverage threshold | 80% lines/functions/branches/statements |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PROFILE-01 | New columns present + RLS still attached | unit (migration assertion) | `npm test -- src/lib/__tests__/migration.test.ts` | ❌ Wave 0 |
| PROFILE-02 | Modal renders with 9-dot progress | playwright | `npm run e2e -- e2e/profile-interview.spec.ts -g "modal renders"` | ❌ Wave 0 |
| PROFILE-03 | Card 0 multi-select platform | playwright | `npm run e2e -- e2e/profile-interview.spec.ts -g "card 0 platforms"` | ❌ Wave 0 |
| PROFILE-04 | Card 1 niche drill-down | unit (component) + playwright | `npm test -- src/components/app/cards/__tests__/niche-picker.test.tsx` | ❌ Wave 0 |
| PROFILE-05 | Card 2 audience JSONB persists | playwright | `npm run e2e -- -g "card 2 audience persists"` | ❌ Wave 0 |
| PROFILE-06 | Card 3 goal+stage writes both columns | unit (store) | `npm test -- src/stores/__tests__/profile-interview-store.test.ts` | ❌ Wave 0 |
| PROFILE-07 | Card 4 style + cuts | unit (store) | (same) | ❌ Wave 0 |
| PROFILE-08 | Card 5 reference creator auto-add | unit + playwright | `npm test -- src/lib/__tests__/reference-creators.test.ts` | ❌ Wave 0 |
| PROFILE-09 | Card 6 wins/flops JSONB | unit (store) | (same) | ❌ Wave 0 |
| PROFILE-10 | Card 7 cadence | unit (store) | (same) | ❌ Wave 0 |
| PROFILE-11 | Card 8 pain points 500-char cap | unit (component) | `npm test -- src/components/app/cards/__tests__/pain-points-input.test.tsx` | ❌ Wave 0 |
| PROFILE-12 | TruthfulnessCallout rendered Card 0 + Card 6 | playwright (text assertion) | `npm run e2e -- -g "truthfulness copy on cards 0 and 6"` | ❌ Wave 0 |
| PROFILE-13 | Skip all path produces seen_at flag, no card data | playwright | `npm run e2e -- -g "skip-all path persists seen_at"` | ❌ Wave 0 |
| PROFILE-14 | Modal triggers on first upload click | playwright | `npm run e2e -- -g "modal triggers on first upload"` | ❌ Wave 0 |
| PROFILE-15 | Settings edit form persists | playwright | `npm run e2e -- -g "settings card 2 edit persists"` | ❌ Wave 0 |
| PROFILE-16 | (deferred) | manual | Skipped — Phase 11 | N/A |
| PROFILE-17 | Profile fields appear in CreatorContext | unit | `npm test -- src/lib/engine/__tests__/creator.test.ts` (extend existing) | ✅ extend `src/lib/engine/__tests__/creator.test.ts` |
| INT-02 | content-form.tsx gate works | playwright | (same as PROFILE-14) | ❌ Wave 0 |
| INT-04 | Welcome → dashboard flow works without goal-step | playwright | `npm run e2e -- -g "welcome trim — connect only"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Quick targeted run for the changed module: `npm test -- src/path/to/changed.test.ts`
- **Per wave merge:** Full vitest suite: `npm test`
- **Phase gate:** Full vitest + full playwright + coverage report: `npm test:coverage && npm run e2e`

### Wave 0 Gaps

- [ ] `src/lib/niches/__tests__/taxonomy.test.ts` — covers PROFILE-04 (niche tree integrity, getBranches lookups)
- [ ] `src/lib/__tests__/reference-creators.test.ts` — covers PROFILE-08 (handle normalize + addCompetitor fire-and-forget)
- [ ] `src/stores/__tests__/profile-interview-store.test.ts` — covers store advance/skip/finalize per-card persist
- [ ] `src/components/app/cards/__tests__/niche-picker.test.tsx` — UI integration with taxonomy
- [ ] `src/components/app/cards/__tests__/pain-points-input.test.tsx` — 500-char cap
- [ ] `src/lib/__tests__/migration.test.ts` — schema assertions (new columns exist, source field on user_competitors)
- [ ] `e2e/profile-interview.spec.ts` — happy path + skip-all path + Card 5 auto-add + Settings edit
- [ ] Extend `src/lib/engine/__tests__/creator.test.ts` — new profile fields returned in CreatorContext when set; null when not set

**Migration verification specifics:** Since vitest runs in Node environment, schema verification requires Supabase service client + querying `information_schema.columns`. Example shape:

```typescript
// src/lib/__tests__/migration.test.ts
describe("Phase 2 migration", () => {
  it("creator_profiles has new 9-card columns", async () => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "creator_profiles");
    const cols = data!.map(r => r.column_name);
    expect(cols).toContain("target_platforms");
    expect(cols).toContain("niche_primary");
    // ... etc
  });
});
```

(Alternative: a SQL fixture file checked into the migration test directory that asserts the expected schema. Planner's choice.)

**E2E happy path (Playwright) — narrative:**

1. Authenticate as new test user (use existing `e2e/create-test-user.ts` pattern).
2. Navigate to `/dashboard`.
3. Click video-upload mode in `<ContentForm>`.
4. Drop a small test video file (use `data-testid="video-upload-input"` for stable selector).
5. Click submit. **Assert modal appears within 1s.**
6. Card 0: select TikTok tile. Click Continue. **Assert progress dots advance.**
7. Card 1: select primary "Fitness" → select sub "Strength Training". Click Continue.
8. Card 2: skip via "Skip this question".
9. ... skip cards 3-7 ...
10. Card 8: type "Hook is weak". Click "Save Profile". **Assert modal closes; assert upload begins (progress bar visible).**
11. After upload completes (mock the analyze API), navigate to `/dashboard` again.
12. Click submit again. **Assert modal does NOT appear (seen_at is set).**

**E2E skip-all path:** Click "I'll do this later" on Card 0 → modal closes → upload proceeds → `creator_profiles` row has `profile_interview_seen_at` set but all 9-card fields null. Prediction succeeds with graceful-degraded CreatorContext.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ (assumed) | 20+ | — |
| npm/pnpm | Package management | ✓ | 10+ | — |
| Supabase CLI | Migration apply + type regen | ✓ (devDep) | 2.74.5 | — |
| Supabase project link | `db push` + `gen types --linked` | UNKNOWN (Phase 1 ran without Docker — used hand-augmentation) | — | Apply migration via dashboard SQL editor if `db push` not viable |
| Apify token | Reference creator scrape | ✓ (env var; existing) | — | Gracefully skip scrape if `APIFY_TOKEN` missing |
| Docker | Local Supabase stack (optional) | UNKNOWN | — | Use remote Supabase project directly |
| Playwright browsers | E2E tests | UNKNOWN (typical install gap) | — | Run `npx playwright install` before e2e |

**Missing dependencies with no fallback:**
- None known. Phase 1 succeeded without local Docker by hand-augmenting types.

**Missing dependencies with fallback:**
- Local Supabase stack — fall back to remote project for `db push`.
- Playwright browsers — install on first e2e run (`npx playwright install`).

**Action for planner:** First plan should include "verify `supabase link --project-ref <ref>` succeeded" as a precondition. If link not set up, document the dashboard-paste workflow.

---

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 16.1.5, TypeScript, Tailwind v4, Supabase — locked.
- **Worktree:** This phase runs in `~/virtuna-engine-foundation/` (current cwd) on `main` branch (per init context).
- **Raycast design language:** 6% borders, 12px card radius, Inter font, single font; accent only on primary CTAs / active progress dot / focus ring. UI-SPEC enforces.
- **Server components default; `"use client"` only when interactive.** All new picker components + modal are client-side; settings sections are client-side (existing pattern).
- **Commit format:** `type(phase): description` (e.g., `feat(phase-2): add ProfileInterviewModal`).
- **No proactive .md files unless asked.** Only this RESEARCH.md is created in `.planning/`.
- **NEVER save working files to root** — all new files under `/src`, `/tests`, `/supabase/migrations`.
- **Tailwind v4 oklch caveat:** Very dark colors must use hex. Phase 2 uses existing tokens — no new color decisions.
- **`backdrop-filter` via React inline styles, not CSS classes** — UI-SPEC modal already uses this pattern (`dialog.tsx:74` and `:163`).
- **Auto-push hook:** Commits push automatically — visible to web Claude sessions.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] Supabase project is already `link`-ed (or planner will link before push) | Migration File / Environment Availability | Migration won't apply; need fallback to dashboard SQL editor. |
| A2 | [ASSUMED] `user_competitors` table does not currently have a `source` column | File Inventory + Migration | Verified against `20260216100000_competitor_tables.sql:44-50` and database.types.ts — no source column. HIGH confidence this is correct. |
| A3 | [ASSUMED] Niche extension list (10 primaries × ~9 subs) is acceptable scope | Niche Taxonomy Seed | If user requires fewer/more, planner can trim. Low-stakes — TS module edit. |
| A4 | [ASSUMED] Existing `addCompetitor` server action signature can accept optional `source` parameter without breaking other callers | Reference Creator Side-Effect | Verified: only callers grep is `add.ts` itself (server action) — no other internal callers. Adding optional 2nd param is backwards-compatible. |
| A5 | [ASSUMED] `preview-step.tsx` is safe to delete (only depends on `tiktokHandle` + HiveDemoCanvas) | File Inventory | Verified by reading the file — confirmed. |
| A6 | [ASSUMED] Hand-augmented `database.types.ts` will not conflict with regenerated types post-migration | Pitfall 4 | Phase 1 SUMMARY documents this is safe once project is linked. |
| A7 | [ASSUMED] Settings page `ProfileSection` (`profile-section.tsx`) is for IDENTITY (display_name, email, company, role) and is separate from the new "Creator Profile" tab (9-card data) | Settings Page 6th Tab | Verified by reading `profile-section.tsx:1-183` — no 9-card fields, distinct concern. Both tabs can coexist. |
| A8 | [ASSUMED] Existing graceful-degradation pattern in `creator.ts:121-132` covers all-null profile fields without modification | Engine Extension | Verified by reading the existing branch; new null fields simply propagate to formatCreatorContext which (with the null-guards proposed in Pitfall 3) handles them. |
| A9 | [ASSUMED] Migration filename `20260517210000_creator_profile_9card_columns.sql` matches convention | Migration File | Pattern is `YYYYMMDDHHMMSS_description.sql` per existing files. Verified format. |
| A10 | [ASSUMED] Phase 4's AI niche detector (CONTENT-02) will populate `micro_niche` automatically per D-09 | Niche Taxonomy Seed | This is a forward-looking dependency, not a current code claim. Phase 2 ships only `niche_primary` + `niche_sub`; no micro_niche column added. |

**Items needing user confirmation before planning:** A1 (Supabase link status) and A3 (niche extension list is right scope).

---

## Open Questions

1. **Is the Supabase project linked locally?**
   - What we know: Phase 1 documents that `db push` is the standard apply mechanism, but ran on un-linked project (hand-augmented types).
   - What's unclear: Current link state.
   - Recommendation: Planner asks user "Is `supabase link --project-ref ...` set up?" in first plan, or includes a precondition step.

2. **Should Card 5 auto-add happen on Card 5 advance or on finalize?**
   - What we know: D-07 says async, no spinner. Either point works.
   - What's unclear: User experience preference.
   - Recommendation: Card 5 advance gives 5+ minutes of scrape lead-time before user finishes (better data when they return); finalize is simpler (one site of side-effect). Planner: choose Card 5 advance with retry-on-finalize for handles still unprocessed.

3. **Single migration or split per-card?**
   - What we know: D-15/D-16 leave this to planner; single is simpler.
   - What's unclear: None.
   - Recommendation: Single migration. Easier rollback; ALL or NOTHING.

4. **`/api/profile/creator-profile` route or extend `/api/profile`?**
   - What we know: Existing `/api/profile/route.ts` handles display_name + tiktok_handle + notifications.
   - What's unclear: Best separation.
   - Recommendation: New route `/api/profile/creator-profile/route.ts` with PATCH only. Keeps existing handler's concerns minimal; new route can return 9-card subset of profile. The settings TanStack hook `useCreatorProfile` calls the new route.

5. **Optimistic update or wait-for-200 on settings save?**
   - What we know: UI-SPEC says toast on success — implies waiting for response.
   - What's unclear: Whether to optimistically update query cache.
   - Recommendation: Wait-for-200 + toast (matches `useProfile.useUpdateProfile` pattern in `use-profile.ts:33-58`). Avoids surprise rollback.

6. **`OnboardingStep` state machine type change — breaking or backwards-compat?**
   - What we know: `OnboardingStep` union narrows to `"connect" | "completed"`.
   - What's unclear: Will users mid-flow have rows in invalid states?
   - Recommendation: Add a one-time data migration UPDATE (Pitfall 5) to map any `'goal'` or `'preview'` rows to `'connect'`. Safer than waiting for runtime fallback.

---

## Sources

### Primary (HIGH confidence — codebase verified line-by-line)

- `src/components/app/content-form.tsx:1-251` — interception point and submit flow
- `src/lib/engine/creator.ts:1-219` — CreatorContext interface + fetchCreatorContext + formatCreatorContext
- `src/stores/onboarding-store.ts:1-132` — persistToSupabase pattern + state machine
- `src/app/actions/competitors/add.ts:1-146` — competitor server action; reference for auto-add
- `src/lib/schemas/competitor.ts:1-75` — normalizeHandle + zod patterns
- `src/components/app/settings/settings-page.tsx:1-72` — 5-tab Tabs.Root structure
- `src/app/(app)/settings/page.tsx:1-24` — VALID_TABS array
- `src/app/(onboarding)/welcome/page.tsx:1-144` — current 3-step state machine + restore logic
- `src/components/onboarding/{connect,goal,preview}-step.tsx` — 3 onboarding components (all read)
- `src/components/ui/dialog.tsx:1-249` — Radix Dialog wrapper with `size="lg"`
- `src/components/ui/button.tsx:1-193` — Button variants (primary/secondary/ghost)
- `src/components/ui/input.tsx:1-316` — Input + InputField with size="md" (42px)
- `src/components/ui/select.tsx:1-100` — Select primitive
- `src/components/ui/toggle.tsx:1-60` — Radix Switch wrapper
- `src/app/api/profile/route.ts:1-160` — GET + PATCH pattern; fire-and-forget Apify scrape (line 132)
- `src/hooks/queries/use-profile.ts:1-150` — TanStack Query GET/PATCH pattern
- `src/lib/engine/__tests__/creator.test.ts:1-130` — existing test shape to extend
- `supabase/migrations/20260202000000_v16_schema.sql:9-211` — creator_profiles + RLS
- `supabase/migrations/20260213000000_onboarding_columns.sql:1-6` — onboarding_step, primary_goal, onboarding_completed_at
- `supabase/migrations/20260216100000_competitor_tables.sql:9-164` — competitor_profiles + user_competitors + RLS
- `package.json:25-95` — verified package versions
- `vitest.config.ts:1-26` — 80% coverage thresholds
- `e2e/playwright.config.ts:1-44` — chromium project + setup auth pattern
- `e2e/viral-predictor.spec.ts:1-30` — existing e2e shape

### Secondary (MEDIUM confidence — design context)

- `.planning/codebase/STACK.md` — version inventory
- `.planning/codebase/STRUCTURE.md` — directory layout
- `.planning/phases/01-training-corpus-eval-foundation/01-01-SUMMARY.md:120-174` — Supabase migration procedure documentation
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` — all D-01..D-20 lockdowns
- `.planning/phases/02-creator-profile-9-card-interview/02-UI-SPEC.md` — full visual contract

### Tertiary (LOW confidence — assumed / unverified)

- Supabase link status of the local project (Open Question 1)
- Whether docker-based local Supabase is set up for `db reset` (Pitfall 4)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages and versions verified against `package.json`
- Architecture patterns: HIGH — all patterns derived from verified existing files
- Migration shape: HIGH — column list is locked by D-16; only naming/structure decisions remain
- Modal interception mechanic: HIGH — deferred-submit pattern is the only viable shape given UI-SPEC + D-02
- Niche taxonomy seed list: MEDIUM — primary list is researcher proposal anchored on corpus
- Test surface: MEDIUM — coverage targets are concrete; specific test cases need planner expansion
- Environment availability (Supabase link): LOW — unknown until planner verifies

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (Phase 2 should plan + execute within ~30 days; UI-SPEC and CONTEXT are stable)

---

## RESEARCH COMPLETE

**Phase:** 02 - Creator Profile & 9-Card Interview
**Confidence:** HIGH

### Executive Summary (5–8 bullets — planner-scannable in <30s)

- **Migration is purely additive ALTER TABLE.** Single file `supabase/migrations/20260517210000_creator_profile_9card_columns.sql` adds 14 nullable columns to `creator_profiles` (per D-16 shape) + one `source TEXT` column to `user_competitors` (per D-08). RLS auto-inherits per D-17. Apply via `supabase db push` (Phase 1 pattern verified in `01-01-SUMMARY.md:173-174`).
- **Modal interception is a deferred-submit hook**, not a render-time gate. New `usePendingProfileGate()` hook wraps the `onSubmit(formData)` call at `content-form.tsx:144`; modal opens, per-card data persists incrementally via Zustand `useProfileInterviewStore` mirroring the `persistToSupabase` pattern from `onboarding-store.ts:48`; on close, the stored submit is replayed. INT-02 satisfied.
- **`CreatorContext` extends flat with 14 new nullable fields**; `found: boolean` semantics preserved per D-19/D-20. Only changes to `creator.ts`: extend the interface, extend the SELECT at line 137-138, add null-guarded lines in `formatCreatorContext()` to prevent "null" strings leaking into Gemini/DeepSeek prompts. PROFILE-17 satisfied.
- **Reference creator auto-add reuses `src/app/actions/competitors/add.ts`** with an optional new `source: 'profile_reference'` parameter (backwards-compatible). Apify scrape stays fire-and-forget (mirror of `/api/profile/route.ts:132` pattern). The same `user_competitors` UNIQUE constraint at line 50 of `20260216100000_competitor_tables.sql` provides idempotency. PROFILE-08 + D-06/07/08 satisfied.
- **Welcome flow trim is mechanical:** delete `goal-step.tsx` and `preview-step.tsx`; collapse `OnboardingStep` union to `"connect" | "completed"`; add a one-time UPDATE in the migration to remap existing `'goal'`/`'preview'` rows to `'connect'` (avoids Pitfall #5). `<HiveDemoCanvas />` import is the only external dep in preview-step — safe to remove. INT-04 satisfied.
- **Niche taxonomy ships as `src/lib/niches/taxonomy.ts`** with `NicheTree` exported. Researcher proposes 10 primaries (5 Phase 1 corpus + 5 extensions) × ~9 subs each. Level-3 micro_niche is intentionally absent per D-09; Phase 4's AI detector fills that gap automatically.
- **Settings 6th tab is a pattern-match extension** of `settings-page.tsx:13-22`: add `"creator-profile"` to the type union + TABS array + `VALID_TABS` in the route. New `ProfileSettingsForm` component renders all 9 cards as a single scrollable form using existing TanStack `useUpdateProfile` style. PROFILE-15 satisfied.
- **PROFILE-16 is fully deferred to Phase 11 per D-14** — researcher recommends adding the row to the REQUIREMENTS.md traceability table with `Phase 11` in the Phase column to prevent orphaning. No counter column, no trigger code in Phase 2.
- **Test surface is well-scoped:** ~7 vitest files + 1 playwright spec covering migration verification, niche taxonomy, store state machine, reference-creator handle parsing, UI component validation (500-char cap, niche drill-down), CreatorContext extension, and 3 e2e flows (happy path / skip-all / settings edit). All under the existing 80% threshold from `vitest.config.ts`.

### Open Questions for the Planner (3 high-value)

1. **Supabase project link status** — verify `supabase link --project-ref ...` before first plan that touches the migration. Fallback: paste SQL via dashboard.
2. **Card 5 auto-add timing** — recommend Card 5 advance (parallel scrape) over finalize. Planner decides.
3. **Niche extension list scope** — confirm the 10-primary seed (Beauty / Fitness / Education / Comedy / Lifestyle / Food / Tech / Gaming / Fashion / Music) before locking. Trim if user prefers tighter scope.

### File Created

`/Users/davideloreti/virtuna-engine-foundation/.planning/phases/02-creator-profile-9-card-interview/02-RESEARCH.md`

### Ready for Planning

Research complete. Planner can now create PLAN.md files. Recommended plan slicing (~5 plans):

- **Plan 02-01:** Migration + types regen (+ deprecation UPDATE for onboarding_step) — sequential, blocks all others
- **Plan 02-02:** Niche taxonomy module + tests — parallel-able with 02-01 (pure TS)
- **Plan 02-03:** Modal + 9 card components + Zustand store + `usePendingProfileGate` hook + content-form.tsx wiring — biggest plan; after 02-01
- **Plan 02-04:** Settings 6th tab + ProfileSettingsForm + TanStack hooks + `/api/profile/creator-profile` route — parallel-able with 02-03 (different files)
- **Plan 02-05:** Engine extension (creator.ts) + welcome trim + reference-creator auto-add side-effect + e2e tests + REQUIREMENTS.md PROFILE-16 traceability row — final wave; depends on 02-01..04
