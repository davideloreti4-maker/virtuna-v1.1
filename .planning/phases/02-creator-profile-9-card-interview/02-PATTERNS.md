# Phase 2: Creator Profile & 9-Card Interview — Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 34 (new + modified)
**Analogs found:** 31 / 34
**Net-new (no analog needed):** 3 (`use-pending-profile-gate`, `card-progress-dots`, `truthfulness-callout`)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260517210000_creator_profile_9card_columns.sql` | migration | schema-additive | `supabase/migrations/20260213000000_onboarding_columns.sql` | exact (ALTER TABLE additive) |
| `src/lib/niches/taxonomy.ts` | lib (pure TS module) | static data | none — net new module | role-only (similar to typed const-tree modules) |
| `src/lib/engine/creator.ts` (modify) | engine / lib | request-response (server read) | self (extending existing) | exact |
| `src/lib/engine/__tests__/creator.test.ts` (extend) | test (unit) | mock-driven | self (extending) | exact |
| `src/lib/schemas/creator-profile.ts` | lib (zod schemas) | validation | `src/lib/schemas/competitor.ts` | exact |
| `src/lib/handles/parse-handle.ts` (OR reuse) | lib (util) | transform | `src/lib/schemas/competitor.ts:9-20` `normalizeHandle()` | exact — research recommends reuse, no new file |
| `src/lib/__tests__/reference-creators.test.ts` | test (unit) | mock-driven | `src/lib/engine/__tests__/creator.test.ts` (vi.mock pattern) | role-match |
| `src/lib/__tests__/migration.test.ts` | test (unit/integration) | DB introspect | none — net-new; use Supabase service client query against `information_schema.columns` | role-only |
| `src/lib/niches/__tests__/taxonomy.test.ts` | test (unit) | pure | none (any other vitest pure-data unit test) | role-only |
| `src/app/api/profile/creator-profile/route.ts` | route handler (Next.js) | request-response (PATCH/GET) | `src/app/api/profile/route.ts` | exact |
| `src/hooks/queries/use-creator-profile.ts` | hook (TanStack Query) | request-response (cached) | `src/hooks/queries/use-profile.ts` | exact |
| `src/hooks/use-pending-profile-gate.ts` | hook (client state) | event-driven (deferred submit) | none — net-new | role-only |
| `src/stores/profile-interview-store.ts` | store (Zustand) | event-driven + persist | `src/stores/onboarding-store.ts` (esp. `persistToSupabase` line 48) | exact (mirror pattern) |
| `src/stores/onboarding-store.ts` (modify) | store (Zustand) | event-driven + persist | self (collapse state machine) | exact |
| `src/stores/__tests__/profile-interview-store.test.ts` | test (unit) | mock-driven | none yet; use vi.mock pattern from creator.test.ts | role-only |
| `src/components/app/content-form.tsx` (modify) | component (client) | event-driven (submit) | self (wrapping `handleSubmit` at line 141-145) | exact |
| `src/components/app/profile-interview-modal.tsx` | component (client) | modal lifecycle | `src/components/ui/dialog.tsx` composition + UI-SPEC | role-match |
| `src/components/app/interview-card.tsx` | component (client) | render-only | composes `Heading` + `Text` + `Button` (no direct analog) | role-only |
| `src/components/app/card-progress-dots.tsx` | component (client) | render-only | none — net-new (UI-SPEC §"Progress indicator") | role-only |
| `src/components/app/truthfulness-callout.tsx` | component (client) | render-only | none — net-new (UI-SPEC) | role-only |
| `src/components/app/cards/platform-picker.tsx` | component (client) | event-driven (multi-select) | `src/components/onboarding/goal-step.tsx:60-94` (tile-button pattern) | role-match |
| `src/components/app/cards/niche-picker.tsx` | component (client) | event-driven (drill-down) | none (composes tiles + `NICHE_TREE`) | role-only |
| `src/components/app/cards/audience-picker.tsx` | component (client) | form input | `src/components/ui/select.tsx` + `InputField` composition | role-only |
| `src/components/app/cards/goal-stage-picker.tsx` | component (client) | event-driven (single-select × 2) | `goal-step.tsx:60-94` tile pattern | role-match |
| `src/components/app/cards/content-style-picker.tsx` | component (client) | event-driven (single-select grid) | `goal-step.tsx:60-94` tile pattern | role-match |
| `src/components/app/cards/reference-creators-input.tsx` | component (client) | form input (dynamic list) | `src/components/ui/input.tsx:269-314` (InputField) + add/remove ghost button | role-only |
| `src/components/app/cards/wins-flops-input.tsx` | component (client) | form input (dynamic list × 2) | same as `reference-creators-input.tsx` | role-only |
| `src/components/app/cards/cadence-picker.tsx` | component (client) | form input | `src/components/ui/select.tsx` + `src/components/ui/toggle.tsx` | role-only |
| `src/components/app/cards/pain-points-input.tsx` | component (client) | form input | `src/components/ui/textarea.tsx` + char-count helper | role-only |
| `src/components/app/profile-settings-form.tsx` | component (client) | request-response (mutation) | `src/components/app/settings/profile-section.tsx:75-183` | exact |
| `src/components/app/settings/creator-profile-section.tsx` | component (client) | render-only (wraps form) | `src/components/app/settings/profile-section.tsx` | exact |
| `src/components/app/settings/settings-page.tsx` (modify) | component (client) | event-driven (tabs) | self (extend TABS array + tab type) | exact |
| `src/app/(app)/settings/page.tsx` (modify) | route page (Next.js server) | request-response | self (extend `VALID_TABS`) | exact |
| `src/app/actions/competitors/add.ts` (modify) | server action | request-response (mutation + side-effect) | self (extend signature + junction insert) | exact |
| `src/app/(onboarding)/welcome/page.tsx` (modify) | route page (Next.js client) | event-driven (state machine) | self (collapse to single step) | exact |
| `src/components/onboarding/goal-step.tsx` (DELETE) | component | n/a | — | — |
| `src/components/onboarding/preview-step.tsx` (DELETE) | component | n/a | — | — |
| `e2e/profile-interview.spec.ts` | test (playwright) | end-to-end (browser-driven) | `e2e/viral-predictor.spec.ts` | exact (test framework) |
| `src/components/app/cards/__tests__/niche-picker.test.tsx` | test (component) | render + interaction | none yet — use Vitest + Testing Library | role-only |
| `src/components/app/cards/__tests__/pain-points-input.test.tsx` | test (component) | render + interaction | same | role-only |

---

## Pattern Assignments

### 1. `supabase/migrations/20260517210000_creator_profile_9card_columns.sql` (migration, schema-additive)

**Analog:** `supabase/migrations/20260213000000_onboarding_columns.sql`

**Full file pattern** (lines 1-6 — the entire analog):
```sql
-- Add onboarding tracking columns to creator_profiles
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'connect',
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```

**What to copy:**
- Header comment style ("-- <plain-English description>")
- Single `ALTER TABLE creator_profiles` statement with one `ADD COLUMN IF NOT EXISTS` per line
- All columns nullable (no `NOT NULL`, no `DEFAULT` for non-default-needing fields)
- One-blank-line trailer

**Phase 2 extension shape** (per RESEARCH.md §Migration File + D-16):
```sql
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

ALTER TABLE user_competitors
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_add'
    CHECK (source IN ('manual_add', 'profile_reference'));

-- Pitfall #5 mitigation: remap legacy onboarding_step values
UPDATE creator_profiles
SET onboarding_step = 'connect'
WHERE onboarding_step IN ('goal', 'preview');
```

**Reads from:** none (DDL).
**Consumed by:** `src/lib/engine/creator.ts` (SELECT), `src/stores/profile-interview-store.ts` (UPDATE), `src/app/actions/competitors/add.ts` (junction `source` column).

---

### 2. `src/lib/niches/taxonomy.ts` (lib, static data)

**Analog:** None — net-new module. Style is a typed const tree. The closest stylistic reference in the codebase is `src/components/onboarding/goal-step.tsx:13-32` (typed const-tuple of options).

**Reference shape** (`goal-step.tsx:13-32`):
```typescript
const GOALS: { id: PrimaryGoal; title: string; description: string; icon: LucideIcon }[] = [
  {
    id: "monetization",
    title: "Monetization",
    description: "Maximize your earnings through referrals and creator tools",
    icon: Briefcase,
  },
  // ...
];
```

**Phase 2 shape** (RESEARCH.md §Niche Taxonomy Module Skeleton + Seed Proposal):
```typescript
export type NicheSubItem = { slug: string; label: string };
export type NichePrimary = { slug: string; label: string; subs: NicheSubItem[] };
export type NicheTree = NichePrimary[];

export const NICHE_TREE: NicheTree = [
  { slug: "beauty",   label: "Beauty",    subs: [{ slug: "skincare", label: "Skincare" }, /* … */] },
  { slug: "fitness",  label: "Fitness",   subs: [/* Strength Training, Calisthenics, … */] },
  // … 8 more (Education, Comedy, Lifestyle, Food & Cooking, Tech & Gadgets, Gaming, Fashion & Style, Music & Performance)
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

**Reads from:** none (pure module).
**Consumed by:** `src/components/app/cards/niche-picker.tsx` (Card 1 UI), Phase 4 niche detector (`CONTENT-02`).

---

### 3. `src/lib/engine/creator.ts` (modify — engine/lib, request-response)

**Analog:** self (extending existing file).

**Current `CreatorContext` interface** (`creator.ts:11-24`):
```typescript
export interface CreatorContext {
  found: boolean;
  follower_count: number | null;
  avg_views: number | null;
  engagement_rate: number | null;
  niche: string | null;
  posting_frequency: string | null;
  platform_averages: {
    avg_views: number;
    avg_engagement_rate: number;
    avg_share_rate: number;
    avg_comment_rate: number;
  };
}
```

**Current SELECT** (`creator.ts:135-141`):
```typescript
const { data: profile, error } = await supabase
  .from("creator_profiles")
  .select(
    "tiktok_followers, engagement_rate, niches, display_name"
  )
  .eq("tiktok_handle", creator_handle)
  .maybeSingle();
```

**Current null-guarded prompt formatter** (`creator.ts:184-200`) — the gold-standard pattern for new fields:
```typescript
if (ctx.found) {
  lines.push(`Creator profile: found`);
  if (ctx.follower_count !== null) {
    lines.push(`Follower count: ${ctx.follower_count.toLocaleString()}`);
  }
  if (ctx.avg_views !== null) {
    lines.push(`Average views: ${ctx.avg_views.toLocaleString()}`);
  }
  if (ctx.engagement_rate !== null) {
    lines.push(`Engagement rate: ${(ctx.engagement_rate * 100).toFixed(2)}%`);
  }
  if (ctx.niche) {
    lines.push(`Niche: ${ctx.niche}`);
  }
  if (ctx.posting_frequency) {
    lines.push(`Posting frequency: ${ctx.posting_frequency}`);
  }
}
```

**What to copy:**
1. Flat-add new nullable fields to the interface (D-19) — match the 1-per-line `field: Type | null;` style, comment-tag each with `// Card N`.
2. Extend SELECT column list in a single multiline backtick string (mirror existing pattern).
3. For every new field in `formatCreatorContext`, mirror the `if (ctx.field !== null) { lines.push(...) }` null-guard pattern (Pitfall #3).

**Reads from:** `creator_profiles` table (extended SELECT).
**Consumed by:** prediction pipeline (Gemini/DeepSeek prompt builders, persona allocator).

---

### 4. `src/lib/engine/__tests__/creator.test.ts` (extend — test, mock-driven)

**Analog:** self (extending existing file).

**Existing test scaffold** (`creator.test.ts:5-57`):
```typescript
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/cache", () => ({
  createCache: () => ({ get: vi.fn(() => null), set: vi.fn(), invalidate: vi.fn() }),
}));

let tableResponses: Record<string, { data: unknown; error: unknown }> = {};

const mockSupabaseChain = (tableResult: { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "not", "gte", "gt", "or", "order", "limit", "maybeSingle"];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(tableResult);
  return chain;
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      const response = tableResponses[table] ?? { data: [], error: null };
      return mockSupabaseChain(response);
    }),
  })),
}));
```

**Existing test pattern** (`creator.test.ts:96-114`):
```typescript
it("returns found=true with profile data when creator exists", async () => {
  tableResponses.creator_profiles = {
    data: { tiktok_followers: 50000, engagement_rate: 0.08, niches: ["fitness", "lifestyle"], display_name: "Test Creator" },
    error: null,
  };
  const supabase = createServiceClient();
  const result = await fetchCreatorContext(supabase, "test_creator", null);
  expect(result.found).toBe(true);
  expect(result.follower_count).toBe(50000);
});
```

**What to copy:**
- Reuse the mock scaffold as-is.
- Add new `it(...)` blocks that seed `tableResponses.creator_profiles.data` with the new 9-card columns and assert each lands on the returned `CreatorContext`.
- Add an `it("formats new profile fields with null-guards (no 'null' strings)")` test asserting `formatCreatorContext` does NOT push lines when fields are null.

---

### 5. `src/lib/schemas/creator-profile.ts` (lib, zod)

**Analog:** `src/lib/schemas/competitor.ts`

**Imports + zod-object pattern** (`competitor.ts:1-43`):
```typescript
import { z } from "zod";

export function normalizeHandle(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/);
  if (urlMatch?.[1]) return urlMatch[1].toLowerCase();
  return trimmed.replace(/^@/, "").toLowerCase();
}

export const apifyProfileSchema = z.object({
  authorMeta: z.object({
    name: z.string().transform(normalizeHandle),
    nickName: z.string().optional().default(""),
    // …
  }),
});
export type ApifyProfile = z.infer<typeof apifyProfileSchema>;
```

**What to copy:**
- One zod schema per card (Card 0..Card 8) or a single combined schema with all 14 fields optional.
- Use `z.infer<typeof ...>` to derive the TS type.
- Default values via `.optional().default(...)` for forgiving PATCH bodies.
- File header `import { z } from "zod";` only — no logger / no createClient.

---

### 6. `src/lib/handles/parse-handle.ts` — REUSE recommendation (no new file)

**Analog & decision:** `src/lib/schemas/competitor.ts:9-20` `normalizeHandle()`.

**Existing utility** (verbatim, `competitor.ts:9-20`):
```typescript
export function normalizeHandle(input: string): string {
  const trimmed = input.trim();
  // Extract handle from TikTok URLs like https://tiktok.com/@user123
  const urlMatch = trimmed.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1].toLowerCase();
  }
  // Strip leading @ and lowercase
  return trimmed.replace(/^@/, "").toLowerCase();
}
```

**Recommendation:** Don't create `src/lib/handles/parse-handle.ts`. Import `normalizeHandle` from `@/lib/schemas/competitor` everywhere Card 5 / settings auto-add needs handle parsing (RESEARCH.md File Inventory line: "RECOMMEND: reuse `normalizeHandle` directly — no new file"). If a new helper is justified later (Instagram/YouTube parsing), do it then.

---

### 7. `src/app/api/profile/creator-profile/route.ts` (route handler — Next.js)

**Analog:** `src/app/api/profile/route.ts`

**Auth + zod-validation + upsert pattern** (`route.ts:76-114`):
```typescript
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });

    if (error) {
      log.error("PATCH upsert error", { error: error.message });
      return Response.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    log.error("PATCH error", { error: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Logger init** (`route.ts:1-7`):
```typescript
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger({ module: "profile" });
```

**Fire-and-forget side-effect pattern** (`route.ts:132-150` — applicable if route triggers Apify scrape):
```typescript
void (async () => {
  try {
    const scraper = createScrapingProvider();
    const profileData = await scraper.scrapeProfile(handle);
    // …
  } catch (err) {
    log.warn("Background scrape failed (non-blocking)", { handle, error: ... });
    // Intentionally swallowed
  }
})();
```

**What to copy:**
- `try/catch` wrapper around the handler body returning 500 on unknown error.
- `createLogger({ module: "creator-profile" })` for module-scoped logging.
- `safeParse` + 400 with `error.flatten()` on validation failure.
- `Response.json({ success: true })` for success.
- For the 9-card columns, write directly to `creator_profiles` (not `user_settings`).

---

### 8. `src/hooks/queries/use-creator-profile.ts` (hook, TanStack Query)

**Analog:** `src/hooks/queries/use-profile.ts`

**Query pattern** (`use-profile.ts:19-28`):
```typescript
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json() as Promise<ProfileResponse>;
    },
  });
}
```

**Mutation pattern** (`use-profile.ts:33-58`):
```typescript
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Pick<UserProfile, "name" | "company" | "role">>) => {
      const body: Record<string, string> = {};
      if (updates.name !== undefined) body.display_name = updates.name;
      // ...
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current() });
    },
  });
}
```

**What to copy:**
- Export both `useCreatorProfile()` (GET) and `useUpdateCreatorProfile()` (PATCH) from the same file.
- Use `queryKeys.profile.creatorProfile()` (extend `queryKeys` registry; pattern: add new key node).
- Same `onSuccess: () => invalidateQueries` pattern. The settings form needs wait-for-200 + invalidate (RESEARCH §Open Question 5).
- Return type must include `profile_interview_seen_at` so `usePendingProfileGate` can read it.

---

### 9. `src/hooks/use-pending-profile-gate.ts` (hook — net-new, deferred-submit pattern)

**Analog:** None — net-new. Shape locked by RESEARCH.md §Pattern 1.

**Pattern** (RESEARCH.md §Pattern 1, verbatim):
```typescript
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

**Reads from:** `useCreatorProfile()`.
**Consumed by:** `src/components/app/content-form.tsx` submit handler.

**Pitfall guard** (Pitfall #1): callers MUST also gate `isSubmitDisabled` on `isLoading` to prevent race between submit and gate decision.

---

### 10. `src/stores/profile-interview-store.ts` (Zustand, net-new — mirror of onboarding-store)

**Analog:** `src/stores/onboarding-store.ts`

**Persist helper pattern** (`onboarding-store.ts:48-59` — copy directly):
```typescript
async function persistToSupabase(updates: Record<string, unknown>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("creator_profiles")
    .update(updates)
    .eq("user_id", user.id);
}
```

**Store create pattern** (`onboarding-store.ts:61-86`):
```typescript
export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  step: "connect",
  tiktokHandle: "",
  primaryGoal: null,
  _isHydrated: false,

  setStep: (step) => {
    const state = get();
    saveToStorage({ step, tiktokHandle: state.tiktokHandle, primaryGoal: state.primaryGoal });
    set({ step });
    persistToSupabase({ onboarding_step: step });
  },

  setTiktokHandle: (tiktokHandle) => {
    const state = get();
    saveToStorage({ step: state.step, tiktokHandle, primaryGoal: state.primaryGoal });
    set({ tiktokHandle });
    persistToSupabase({ tiktok_handle: tiktokHandle });
  },
  // …
}));
```

**localStorage hydration pattern** (`onboarding-store.ts:27-46`):
```typescript
const STORAGE_KEY = "virtuna-onboarding";
function loadFromStorage(): Partial<OnboardingState> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
function saveToStorage(state: Pick<OnboardingState, "step" | "tiktokHandle" | "primaryGoal">) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
```

**Phase 2 store shape** (RESEARCH.md §Code Examples + §Pattern 2 — adapted):
```typescript
export const useProfileInterviewStore = create<ProfileInterviewState>((set, get) => ({
  currentCard: 0,
  draft: { /* initial per-card empty values */ },
  setDraftField: (k, v) => set(s => ({ draft: { ...s.draft, [k]: v } })),
  advanceCard: async () => {
    const card = get().currentCard;
    await persistCardData(serializeCard(card, get().draft));
    if (card === 5) await addReferenceCreators(get().draft.references);
    set({ currentCard: card + 1 });
  },
  skipCard: () => set(s => ({ currentCard: s.currentCard + 1 })),
  goBack: () => set(s => ({ currentCard: Math.max(0, s.currentCard - 1) })),
  skipInterview: async () => {
    await persistCardData({ profile_interview_seen_at: new Date().toISOString() });
  },
  finalize: async () => {
    await persistCardData({
      ...serializeAllCards(get().draft),
      profile_interview_seen_at: new Date().toISOString(),
    });
  },
}));
```

**What to copy:**
- File header `import { create } from "zustand"; import { createClient } from "@/lib/supabase/client";`
- Module-scope `persistToSupabase()` (rename to `persistCardData` for clarity).
- `currentCard: number` replaces the `step: OnboardingStep` named enum.
- localStorage hydration is optional for the interview store (RESEARCH doesn't require it; ephemeral draft fine).

---

### 11. `src/stores/onboarding-store.ts` (modify — collapse state machine)

**Analog:** self.

**Modification scope:**
1. `OnboardingStep` union (line 4) narrows: `"connect" | "goal" | "preview" | "completed"` → `"connect" | "completed"`.
2. Remove `primaryGoal` field, `setPrimaryGoal()` action (lines 5-8 of `PrimaryGoal` type; line 15; line 21; lines 95-100).
3. Remove `primaryGoal` from `saveToStorage` payload (line 38, 83, 90, 97, 105, 118).
4. Remove `primary_goal` write from `completeOnboarding()` (line 111).

**Migration coordination:** the SQL `UPDATE` in the migration (Pitfall #5) handles legacy DB rows; the store narrowing is safe because the migration runs first.

---

### 12. `src/components/app/content-form.tsx` (modify — wrap handleSubmit)

**Analog:** self.

**Current submit handler** (`content-form.tsx:141-150`):
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate()) return;
  onSubmit(formData);
};

const isSubmitDisabled =
  (activeTab === "text" && !formData.caption.trim()) ||
  (activeTab === "tiktok_url" && !formData.tiktok_url.trim()) ||
  (activeTab === "video_upload" && !formData.video_file);
```

**Modification shape** (RESEARCH §Code Examples — Modal Trigger Wiring):
```typescript
const { shouldShowModal, interceptOrProceed, resumeAfterModal } = usePendingProfileGate();
const [modalOpen, setModalOpen] = React.useState(false);

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate()) return;
  const { intercepted } = interceptOrProceed(() => onSubmit(formData));
  if (intercepted) setModalOpen(true);
};

// JSX additions: render <ProfileInterviewModal onClose={() => { setModalOpen(false); resumeAfterModal(); }} /> when modalOpen
```

**Pitfall guard:** add `isLoading` from `useCreatorProfile()` to `isSubmitDisabled` (Pitfall #1).

---

### 13. `src/components/app/profile-interview-modal.tsx` (component — outer Dialog shell)

**Analog:** Existing `Dialog` composition from `src/components/ui/dialog.tsx`. Closest in-tree usage: any existing Radix Dialog consumer.

**DialogContent + props pattern** (`dialog.tsx:154-172`):
```typescript
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent
    size="lg"
    onEscapeKeyDown={(e) => e.preventDefault()}
    onPointerDownOutside={(e) => e.preventDefault()}
  >
    <DialogHeader>
      <DialogTitle>{cardTitle}</DialogTitle>
    </DialogHeader>
    {/* card slot */}
    <DialogFooter>
      <Button variant="ghost">Back</Button>
      <Button variant="primary">{isLastCard ? "Save Profile" : "Continue"}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Critical accessibility overrides** (UI-SPEC §Accessibility — mandatory):
- `onEscapeKeyDown={(e) => e.preventDefault()}` — modal is mandatory, Escape must not close.
- `onPointerDownOutside={(e) => e.preventDefault()}` — backdrop click must not close.
- No `<DialogClose>` rendered — no X button.

**Modal title size override** (UI-SPEC §Typography): the default `DialogTitle` is `text-lg font-semibold`; UI-SPEC wants `text-lg font-medium`. Add `className="font-medium"` override.

---

### 14. `src/components/app/cards/platform-picker.tsx` + `goal-stage-picker.tsx` + `content-style-picker.tsx` (tile pickers)

**Analog:** `src/components/onboarding/goal-step.tsx`

**Tile button pattern** (`goal-step.tsx:60-94`):
```typescript
{GOALS.map(({ id, title, description, icon: Icon }) => (
  <button
    key={id}
    type="button"
    onClick={() => setSelected(id)}
    className={cn(
      "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
      selected === id
        ? "border-accent bg-accent/[0.08]"
        : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]"
    )}
    style={
      selected === id
        ? { boxShadow: "rgba(255,127,80,0.1) 0 1px 0 0 inset" }
        : undefined
    }
  >
    <div className={cn(
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
      selected === id ? "bg-accent/20 text-accent" : "bg-white/[0.05] text-foreground-secondary"
    )}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-foreground-secondary">{description}</p>
    </div>
  </button>
))}
```

**Per UI-SPEC §Color, ADAPT the analog**:
- The analog uses `border-accent + bg-accent/[0.08]` for selected state.
- UI-SPEC §Color explicitly forbids accent on tiles: "Card option tiles (selected state uses `bg-white/[0.08]` border, not coral fill)".
- The new components MUST use `bg-white/[0.08]` + `border-white/[0.12]` for selected state instead. Use the tile structure (icon block + label/description) from the analog, but swap the selected-state classes.

**Multi-select variant** (Card 0 PlatformPicker): replace `setSelected(id)` with toggle-in-array logic; `aria-pressed={selected.includes(id)}`.

---

### 15. `src/components/app/cards/reference-creators-input.tsx` + `wins-flops-input.tsx` (dynamic URL lists)

**Analog:** `src/components/ui/input.tsx:269-314` (`InputField`).

**InputField + label pattern** (`input.tsx:269-313`):
```typescript
const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, helperText, error, id, className, ...props }, ref) => {
    const reactId = React.useId();
    const generatedId = id || `input${reactId}`;
    // ...
    return (
      <div className={cn("space-y-1.5", className)}>
        {label && (
          <label htmlFor={generatedId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <Input id={generatedId} error={hasError} aria-describedby={describedBy} ref={ref} {...props} />
        {helperText && !hasError && (
          <p id={helperId} className="text-sm text-foreground-muted">{helperText}</p>
        )}
        {errorMessage && (
          <p id={errorId} className="text-sm text-error" role="alert">{errorMessage}</p>
        )}
      </div>
    );
  }
);
```

**Usage shape** (Phase 2 dynamic-list — built from `InputField` + a ghost X button per row):
- Render N existing entries as `<InputField>` rows with a ghost icon button on the right.
- Ghost button: `aria-label="Remove creator {index + 1}"` (UI-SPEC §Card 5) or `"Remove win {index + 1}"` / `"Remove flop {index + 1}"` (UI-SPEC §Card 6).
- Below: "+ Add creator" / "+ Add win/flop" ghost button (only when count < max).

---

### 16. `src/components/app/cards/pain-points-input.tsx` (Card 8 — textarea + char count)

**Analog:** `src/components/ui/textarea.tsx` (existing primitive).

**Phase 2 shape:**
```typescript
<Textarea
  value={value}
  onChange={(e) => onChange(e.target.value.slice(0, 500))}
  maxLength={500}
  rows={4}
  placeholder="What's your biggest challenge as a creator right now?"
/>
<p className="text-xs text-foreground-muted text-right">
  {value.length} / 500
</p>
```

---

### 17. `src/components/app/cards/audience-picker.tsx` + `cadence-picker.tsx` (Select + toggle compositions)

**Analog:** `src/components/ui/select.tsx` + `src/components/ui/toggle.tsx`.

**Phase 2 shape:** straight composition — no project-internal analog file (Select usage is local-only in callers). Use UI-SPEC §Card 2 / §Card 7 contracts for option lists.

---

### 18. `src/components/app/profile-settings-form.tsx` (settings edit form — all 9 cards as one form)

**Analog:** `src/components/app/settings/profile-section.tsx`

**Form-state + mutate pattern** (`profile-section.tsx:8-35`):
```typescript
export function ProfileSection() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  // …

  const [name, setName] = useState("");
  // … per-field state …

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      // …
    }
  }, [profile]);

  const handleSave = async () => {
    await updateProfile.mutateAsync({ name, company, role });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
```

**Loading skeleton pattern** (`profile-section.tsx:52-72`):
```typescript
if (isLoading) {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-6 w-24 rounded bg-zinc-800" />
        <div className="mt-2 h-4 w-64 rounded bg-zinc-800" />
      </div>
      {/* … */}
    </div>
  );
}
```

**What to copy:**
- TanStack-driven local-state pattern: `useState` per editable field, `useEffect` to sync once `profile` resolves.
- Skeleton render branch for `isLoading`.
- `await updateProfile.mutateAsync(...)` → toast (use existing `Toast` from `src/components/ui/toast.tsx`).
- Section headers per card (UI-SPEC §Settings — "Section headers per card: same heading text as modal card titles").

---

### 19. `src/components/app/settings/creator-profile-section.tsx` (settings tab wrapper)

**Analog:** `src/components/app/settings/profile-section.tsx` (full file structure).

**What to copy:**
- File header pattern: `"use client";` then named import of `ProfileSettingsForm`.
- Tiny wrapper: renders `<ProfileSettingsForm />` (the actual form is the heavier file).
- Mirrors how `ProfileSection` is consumed by `settings-page.tsx`.

---

### 20. `src/components/app/settings/settings-page.tsx` (modify — add 6th tab)

**Analog:** self.

**Current TABS array + tab type** (`settings-page.tsx:12-22`):
```typescript
interface SettingsPageProps {
  defaultTab?: "profile" | "account" | "notifications" | "billing" | "team";
}

const TABS = [
  { value: "profile", label: "Profile", icon: User },
  { value: "account", label: "Account", icon: Settings },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "team", label: "Team", icon: Users },
] as const;
```

**Tabs.Content pattern** (`settings-page.tsx:53-67`):
```typescript
<Tabs.Content value="profile" className="outline-none">
  <ProfileSection />
</Tabs.Content>
{/* … other tabs … */}
```

**What to modify:**
- Add `"creator-profile"` to the `SettingsPageProps.defaultTab` union (line 13).
- Add `{ value: "creator-profile", label: "Creator Profile", icon: Sparkles /* or UserCog */ }` to the TABS array.
- Add `<Tabs.Content value="creator-profile"><CreatorProfileSection /></Tabs.Content>` matching the existing pattern.
- Import `CreatorProfileSection` from `./creator-profile-section`.

---

### 21. `src/app/(app)/settings/page.tsx` (modify — add to VALID_TABS)

**Analog:** self.

**Current** (`page.tsx:13-22`):
```typescript
const VALID_TABS = ["profile", "account", "notifications", "billing", "team"] as const;
type ValidTab = (typeof VALID_TABS)[number];

export default async function Settings({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "profile";
  return <SettingsPage defaultTab={defaultTab} />;
}
```

**What to modify:** add `"creator-profile"` to `VALID_TABS` tuple. `ValidTab` derives automatically. Default branch unchanged.

---

### 22. `src/app/actions/competitors/add.ts` (modify — accept `source` parameter)

**Analog:** self.

**Current signature + junction insert** (`add.ts:15-15` + `add.ts:131-141`):
```typescript
export async function addCompetitor(handle: string): Promise<ActionResult> {
  // …
  const { error: junctionError } = await supabase
    .from("user_competitors")
    .insert({ user_id: user.id, competitor_id: profileId });

  if (junctionError) {
    if (junctionError.code === "23505") {
      return { error: "You are already tracking this competitor" };
    }
    return { error: "Failed to track competitor" };
  }
```

**What to modify:**
```typescript
export async function addCompetitor(
  handle: string,
  source: "manual_add" | "profile_reference" = "manual_add"
): Promise<ActionResult> {
  // … existing scrape/lookup logic unchanged …

  const { error: junctionError } = await supabase
    .from("user_competitors")
    .insert({ user_id: user.id, competitor_id: profileId, source });
  // … rest unchanged …
}
```

**Idempotency note** (RESEARCH.md §Pattern 4): the existing `UNIQUE(user_id, competitor_id)` in `user_competitors` makes calling `addCompetitor(handle, "profile_reference")` for a handle the user already manually-added safely return `23505` — handled at line 137-138 already.

---

### 23. `src/app/(onboarding)/welcome/page.tsx` (modify — collapse to single step)

**Analog:** self.

**Current STEPS + state restore** (`welcome/page.tsx:12, 60-71`):
```typescript
const STEPS = ["connect", "goal", "preview"] as const;
// …
if (profile) {
  const dbStep = profile.onboarding_step as typeof step;
  if (dbStep && dbStep !== store.step) {
    store.setStep(dbStep);
  }
  if (profile.tiktok_handle && !store.tiktokHandle) {
    store.setTiktokHandle(profile.tiktok_handle);
  }
  if (profile.primary_goal && !store.primaryGoal) {
    store.setPrimaryGoal(profile.primary_goal as ...);
  }
}
```

**Current render branches** (`welcome/page.tsx:137-141`):
```typescript
<div className="min-h-[320px]">
  {step === "connect" && <ConnectStep />}
  {step === "goal" && <GoalStep />}
  {step === "preview" && <PreviewStep />}
</div>
```

**What to modify:**
- `STEPS = ["connect"] as const;` (single step).
- Remove `GoalStep` and `PreviewStep` imports (lines 8-9).
- Remove the `primary_goal` SELECT and the `setPrimaryGoal` restore branch.
- Remove the `step === "goal"` and `step === "preview"` render branches.
- After `connect` completes, navigate directly to `/dashboard` (the existing `step === "completed"` redirect at line 79-82 already handles this).

---

### 24. `src/components/onboarding/{goal-step,preview-step}.tsx` (DELETE)

**Analog:** n/a (deletion).

**Verification before delete** (RESEARCH §Runtime State Inventory):
- `goal-step.tsx` and `preview-step.tsx` are imported only by `src/app/(onboarding)/welcome/page.tsx` (verified via grep in RESEARCH §Runtime State Inventory).
- `<HiveDemoCanvas />` (preview-step's only external dep) is not deleted — preview-step is the only caller.
- Safe to remove both files in the same commit that updates `welcome/page.tsx`.

---

### 25. `e2e/profile-interview.spec.ts` (test, playwright)

**Analog:** `e2e/viral-predictor.spec.ts`

**Test file structure** (`viral-predictor.spec.ts:1-86`):
```typescript
import { test, expect } from '@playwright/test';

const SAMPLE_CAPTION = '…';

test.describe('Viral Predictor E2E', () => {
  test('text mode — full prediction flow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill(SAMPLE_CAPTION);

    await page.locator('button[aria-label="Submit test"]').click();

    await expect(
      page.locator('.animate-pulse, [class*="GlassCard"], [class*="glass-card"]').first()
    ).toBeVisible({ timeout: 15000 });
    // …assertions…
  });
});
```

**What to copy:**
- `test.describe('Profile Interview E2E', () => { ... })` block.
- `page.goto('/dashboard')` + `waitForLoadState('networkidle')` setup.
- `page.locator(...)` + `expect(...).toBeVisible({ timeout })` assertion pattern.
- 3 test cases per RESEARCH §Validation Architecture — "E2E happy path", "E2E skip-all path", and a Settings edit case.

**Stable selectors for new modal:**
- Modal trigger: `[data-testid="profile-interview-modal"]` on the Dialog root.
- Card heading: `[data-testid="card-{index}-heading"]`.
- Primary CTA: `button:has-text("Continue")` / `button:has-text("Save Profile")`.
- Skip link: `button:has-text("Skip this question")` / `button:has-text("I'll do this later")`.

---

## Shared Patterns

### A. Authentication (server-side)
**Source:** `src/app/actions/competitors/add.ts:16-24` + `src/app/api/profile/route.ts:21-27`

```typescript
const supabase = await createClient();
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();

if (authError || !user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Apply to:** every new server-side handler (`/api/profile/creator-profile/route.ts`, any new server actions).

---

### B. Browser-side Supabase write (per-card persist)
**Source:** `src/stores/onboarding-store.ts:48-59`

```typescript
async function persistToSupabase(updates: Record<string, unknown>) {
  const supabase = createClient();   // browser client (no await on factory)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("creator_profiles").update(updates).eq("user_id", user.id);
}
```

**Apply to:** `src/stores/profile-interview-store.ts` (rename to `persistCardData`). Uses browser client (RLS-scoped); no service-role key in the bundle.

---

### C. Zod validation at API boundary
**Source:** `src/app/api/profile/route.ts:85-93`

```typescript
const body = await request.json();
const parsed = updateProfileSchema.safeParse(body);

if (!parsed.success) {
  return Response.json(
    { error: "Validation failed", details: parsed.error.flatten() },
    { status: 400 }
  );
}
```

**Apply to:** `/api/profile/creator-profile/route.ts` PATCH using schemas from `src/lib/schemas/creator-profile.ts`.

---

### D. Module-scoped logger
**Source:** `src/lib/engine/creator.ts:1-5` + `src/app/api/profile/route.ts:1-7`

```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "profile" });   // or "creator-profile", "profile-interview"
// usage: log.info("…", { …context });  log.warn(…); log.error(…);
```

**Apply to:** `/api/profile/creator-profile/route.ts` and any new lib/server-side modules.

---

### E. Fire-and-forget side-effect (Apify scrape kickoff)
**Source:** `src/app/api/profile/route.ts:130-150`

```typescript
void (async () => {
  try {
    const scraper = createScrapingProvider();
    const profileData = await scraper.scrapeProfile(handle);
    await service.from("creator_profiles").update({ ... }).eq("user_id", user.id);
    log.info("Background creator scrape complete", { handle });
  } catch (err) {
    log.warn("Background creator scrape failed (non-blocking)", { handle, error: ... });
  }
})();
```

**Apply to:** Card 5 reference-creator auto-add (research recommends the simpler `void addCompetitor(...).catch(...)` form because `addCompetitor` is already async + idempotent on `23505`).

---

### F. TanStack Query GET + PATCH pair
**Source:** `src/hooks/queries/use-profile.ts:19-58`

```typescript
export function useFoo() {
  return useQuery({
    queryKey: queryKeys.X(),
    queryFn: async () => {
      const res = await fetch("/api/foo");
      if (!res.ok) throw new Error("Failed to fetch foo");
      return res.json();
    },
  });
}
export function useUpdateFoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const res = await fetch("/api/foo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.X() }),
  });
}
```

**Apply to:** `src/hooks/queries/use-creator-profile.ts` (export both `useCreatorProfile` and `useUpdateCreatorProfile`).

---

### G. Null-guarded prompt formatter
**Source:** `src/lib/engine/creator.ts:184-200`

```typescript
if (ctx.field !== null) {
  lines.push(`Field name: ${ctx.field}`);
}
```

**Apply to:** every new field added to `formatCreatorContext()` for the 14 new profile columns. Pitfall #3 mitigation.

---

### H. Selected-tile visual treatment (Raycast — NOT coral on tiles)
**Source:** UI-SPEC §Color "Accent must NOT appear on … Card option tiles (selected state uses `bg-white/[0.08]` border, not coral fill)"

**Critical override of the analog:** `goal-step.tsx` uses `border-accent + bg-accent/[0.08]` for selected state — this is the OLD pattern. All new Phase 2 card pickers must use:
- Selected: `bg-white/[0.08]` + `border-white/[0.12]`
- Unselected: `border-white/[0.06]` + `bg-transparent`
- Hover: `bg-white/[0.02]`

Reserve coral (`bg-accent`) exclusively for: primary CTAs ("Continue" / "Save Profile"), active progress dot, focus ring.

---

### I. Vitest mock scaffold for Supabase
**Source:** `src/lib/engine/__tests__/creator.test.ts:5-57`

```typescript
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/cache", () => ({ createCache: () => ({ get: vi.fn(() => null), set: vi.fn(), invalidate: vi.fn() }) }));

let tableResponses: Record<string, { data: unknown; error: unknown }> = {};
const mockSupabaseChain = (tableResult) => { /* chains select/eq/maybeSingle and resolves via .then */ };

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table) => mockSupabaseChain(tableResponses[table] ?? { data: [], error: null })),
  })),
}));
```

**Apply to:** any new vitest unit test that mocks Supabase queries (`profile-interview-store.test.ts`, `reference-creators.test.ts`).

---

### J. Playwright stable-selector + visibility-timeout pattern
**Source:** `e2e/viral-predictor.spec.ts:19-22`

```typescript
await expect(
  page.locator('.animate-pulse, [class*="GlassCard"], [class*="glass-card"]').first()
).toBeVisible({ timeout: 15000 });
```

**Apply to:** `e2e/profile-interview.spec.ts` — use `data-testid` attributes for modal/cards because UI-SPEC composition uses generic Dialog classes shared across the app.

---

## No Analog Found

These files have no close in-tree match. Use UI-SPEC + RESEARCH skeletons listed in the section above.

| File | Role | Data Flow | Reason no analog |
|------|------|-----------|------------------|
| `src/hooks/use-pending-profile-gate.ts` | hook (gate/deferred submit) | event-driven | No existing deferred-submit pattern in the codebase. Shape locked verbatim in RESEARCH §Pattern 1. |
| `src/components/app/card-progress-dots.tsx` | component (visual indicator) | render-only | UI-SPEC §Progress indicator defines it. 9-dot row, coral-active, transition 150ms. |
| `src/components/app/truthfulness-callout.tsx` | component (info block) | render-only | UI-SPEC §Color defines it. Subtle surface-elevated container, NOT coral, used on Card 0 + Card 6. |
| `src/components/app/interview-card.tsx` | component (card frame) | render-only | Net-new layout — composes `Heading`, `Text`, slot, `DialogFooter`. UI-SPEC §Component Inventory. |
| `src/components/app/cards/niche-picker.tsx` | component (hierarchical drill-down) | event-driven | No existing 2-level animated drill-down. UI-SPEC §Card 1 defines slide-down animation. |
| `src/lib/niches/taxonomy.ts` | lib (typed const tree) | static data | Net-new domain module. Shape locked in RESEARCH §Niche Taxonomy Module Skeleton. |
| `src/lib/__tests__/migration.test.ts` | test (DB introspection) | DB query | No existing schema-assertion test. RESEARCH §Validation Architecture sketches `information_schema.columns` query. |

---

## Metadata

**Analog search scope:**
- `src/components/app/` (37 files inspected)
- `src/components/ui/` (Radix wrappers — dialog, input, button, select, textarea, tabs)
- `src/components/onboarding/` (connect-step, goal-step, preview-step — all read)
- `src/stores/` (onboarding-store, settings-store)
- `src/lib/engine/` (creator.ts, creator.test.ts)
- `src/lib/schemas/` (competitor.ts)
- `src/hooks/queries/` (use-profile.ts)
- `src/app/api/profile/` (route.ts)
- `src/app/actions/competitors/` (add.ts)
- `src/app/(app)/settings/` (page.tsx)
- `src/app/(onboarding)/welcome/` (page.tsx)
- `supabase/migrations/` (v16_schema, onboarding_columns, competitor_tables — all read at relevant sections)
- `e2e/` (viral-predictor.spec.ts)

**Files scanned:** ~25 core analogs + structure inspection across `src/` and `supabase/migrations/`.

**Pattern extraction date:** 2026-05-17

**Key insight (confirmed by RESEARCH.md):** Phase 2 is almost entirely composition + extension of existing patterns. True net-new infrastructure is small: the niche taxonomy module, the deferred-submit hook, and 3 UI-only components (progress dots, truthfulness callout, niche picker). Everything else follows an existing file's exact shape.

---

## PATTERN MAPPING COMPLETE
