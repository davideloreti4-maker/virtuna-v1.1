# Phase 11: Existing UI Integration + Privacy Policy - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260520XXXXXX_phase11_retention_counter.sql` | migration | batch | `supabase/migrations/20260520000000_phase10_platt_parameters.sql` | exact |
| `src/app/api/cron/delete-retained-videos/route.ts` | middleware | batch | `src/app/api/cron/calibration-audit/route.ts` | exact |
| `src/app/api/analyze/route.ts` (modify) | controller | request-response | itself (existing pattern) | exact |
| `src/components/app/simulation/signal-availability-chips.tsx` | component | request-response | `src/components/app/simulation/impact-score.tsx` | role-match |
| `src/components/app/simulation/results-panel.tsx` (modify) | component | request-response | itself (existing pattern) | exact |
| `src/components/app/video-upload.tsx` (modify) | component | request-response | itself (existing pattern) | exact |
| `src/components/app/simulation/goal-recheck-banner.tsx` | component | request-response | `src/components/app/simulation/results-panel.tsx` (WarningsBanner sub-component) | role-match |
| `src/components/app/settings/creator-profile-section.tsx` (modify) | component | CRUD | `src/components/app/profile-settings-form.tsx` | exact |

---

## Pattern Assignments

### `supabase/migrations/20260520XXXXXX_phase11_retention_counter.sql` (migration, batch)

**Analog:** `supabase/migrations/20260520000000_phase10_platt_parameters.sql`

**Core pattern** (lines 1–25 of analog):
```sql
-- Use IF NOT EXISTS for idempotent re-runs (same as Phase 10 pattern)
-- Enable RLS on new columns' parent table

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS analysis_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS storage_retention_opted_in BOOLEAN NOT NULL DEFAULT false;

-- Optional: atomic increment helper function (see /api/analyze pattern below)
CREATE OR REPLACE FUNCTION increment_creator_analysis_count(p_user_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE creator_profiles
  SET analysis_count = analysis_count + 1
  WHERE user_id = p_user_id;
$$;
```

**Header comment pattern** (lines 1–12 of analog):
```sql
-- Phase 11: <description of what this migration adds>
-- <explain usage, who reads/writes, and via which client role>
-- All statements use IF NOT EXISTS for idempotent re-runs.
```

**RLS pattern** (lines 22–25 of analog): No new policy needed — `creator_profiles` RLS from Phase 2 already restricts writes to `WHERE user_id = auth.uid()`. The new columns inherit that policy automatically.

---

### `src/app/api/cron/delete-retained-videos/route.ts` (middleware, batch)

**Analog:** `src/app/api/cron/calibration-audit/route.ts`

**Imports pattern** (lines 1–12 of analog):
```typescript
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/delete-retained-videos" });
```

**Auth pattern** (lines 26–28 of analog):
```typescript
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;
  // ...
```

**Core batch pattern** (lines 64–96 of analog, adapted):
```typescript
  try {
    const supabase = createServiceClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Query expired videos for non-opted-in users
    const { data: expiredVideos, error: queryError } = await supabase
      .from("analysis_results")
      .select("video_storage_path, user_id, created_at, creator_profiles!inner(storage_retention_opted_in)")
      .lt("created_at", thirtyDaysAgo)
      .not("video_storage_path", "is", null)
      .eq("creator_profiles.storage_retention_opted_in", false);

    if (queryError) {
      log.error("Query failed", { error: queryError.message });
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const paths = (expiredVideos ?? []).map(r => r.video_storage_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("videos").remove(paths);
    }

    return NextResponse.json({ status: "completed", deleted: paths.length });
  } catch (error) {
    log.error("Failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Retention cron failed" }, { status: 500 });
  }
```

**Error handling pattern** (lines 97–106 of analog):
```typescript
  } catch (error) {
    log.error("Failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Calibration audit failed" },
      { status: 500 }
    );
  }
```

**vercel.json append** (existing `crons` array in `vercel.json` lines 1–36):
```json
{
  "path": "/api/cron/delete-retained-videos",
  "schedule": "0 3 * * *"
}
```
Append to the existing `crons` array. All existing entries follow `"0 H * * *"` daily format.

---

### `src/app/api/analyze/route.ts` (modify — controller, request-response)

**Analog:** itself (two insertion points)

**Insertion point 1 — analysis_count increment (after line 330 / line 422 in both JSON and SSE branches):**

Add after each `usage_tracking` upsert block. Atomic raw UPDATE avoids race condition — do NOT read then write:

```typescript
// After service.from("usage_tracking").upsert(...)

// D-08: Increment lifetime analysis counter on creator_profiles (PROFILE-16 trigger)
// Using rpc for atomic increment — avoids read-then-write race condition
await service.rpc("increment_creator_analysis_count", { p_user_id: user.id });
```

**Insertion point 2 — retention opt-in gate on storage delete (lines 343–354 and 438–446):**

Replace unconditional delete with opt-in check. Read `storage_retention_opted_in` alongside the subscription query (lines 136–150) at route start:

```typescript
// Alongside existing subscription query (after line 136):
const { data: creatorProfile } = await supabase
  .from("creator_profiles")
  .select("storage_retention_opted_in")
  .eq("user_id", user.id)
  .single();

const retentionOptedIn = creatorProfile?.storage_retention_opted_in ?? false;
```

Then gate the delete (replaces lines 343–354 and 438–446):
```typescript
// Best-effort: delete uploaded video ONLY if user has NOT opted into retention
if (
  validated.input_mode === "video_upload" &&
  validated.video_storage_path &&
  !retentionOptedIn
) {
  service.storage
    .from("videos")
    .remove([validated.video_storage_path])
    .catch(() => {
      // Best-effort cleanup — don't fail the response
    });
}
```

**Existing auth pattern** (lines 53–62 — unchanged, shown for context):
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

### `src/components/app/simulation/signal-availability-chips.tsx` (component, request-response)

**Analog:** `src/components/app/simulation/impact-score.tsx` — SIGNALS array + Badge rendering pattern (lines 40–99)

**Imports pattern** (impact-score.tsx lines 1–6):
```typescript
'use client';

import type { SignalAvailability } from '@/lib/engine/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
```

**Core chip array pattern** (analog lines 40–45, adapted):
```typescript
// Mirror SIGNALS pattern from impact-score.tsx lines 40-45
const CHIP_SIGNALS: Array<{ key: keyof SignalAvailability; label: string }> = [
  { key: "audio", label: "Audio" },
  { key: "personas", label: "Personas" },
  { key: "retrieval", label: "Retrieval" },
  { key: "ml", label: "ML" },
];

interface SignalAvailabilityChipsProps {
  signalAvailability: SignalAvailability;
  className?: string;
}

export function SignalAvailabilityChips({
  signalAvailability,
  className,
}: SignalAvailabilityChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {CHIP_SIGNALS.map(({ key, label }) => {
        const available = signalAvailability?.[key] ?? false;
        return (
          <Badge
            key={key}
            variant={available ? "success" : "default"}
            size="sm"
            className={available ? "" : "line-through opacity-40"}
          >
            {label} {available ? "✓" : "✕"}
          </Badge>
        );
      })}
    </div>
  );
}
```

**Badge variant reference** (`src/components/ui/badge.tsx` lines 48–63):
- `variant="success"` → `bg-success/10 text-success border border-success/20`
- `variant="default"` → `bg-surface text-foreground-secondary border border-border`
- `size="sm"` → `h-5 px-2 text-[10px]`

---

### `src/components/app/simulation/results-panel.tsx` (modify — component, request-response)

**Analog:** itself — two insertion points

**Insertion point 1 — SignalAvailabilityChips below HeroScore GlassSection (after line 166):**
```typescript
// After the HeroScore GlassSection (line 166):
{result.signal_availability && (
  <div className="px-1">
    <SignalAvailabilityChips signalAvailability={result.signal_availability} />
  </div>
)}
```

Import to add at top:
```typescript
import { SignalAvailabilityChips } from './signal-availability-chips';
import { GoalRecheckBanner } from './goal-recheck-banner';
```

**Insertion point 2 — GoalRecheckBanner at top of results (after line 137, before TikTokResultCard):**
```typescript
// Props addition to ResultsPanelProps:
interface ResultsPanelProps {
  result: PredictionResult;
  onRunAnother: () => void;
  analysisCount?: number;       // NEW — from DashboardClient
  primaryGoal?: string | null;  // NEW — from DashboardClient
}

// Banner render at top of return (before TikTokResultCard):
{analysisCount !== undefined &&
  analysisCount > 0 &&
  analysisCount % 10 === 0 &&
  primaryGoal && (
    <GoalRecheckBanner goal={primaryGoal} onDismiss={...} />
  )
}
```

**Existing expandable pattern** (`WarningsBanner` sub-component, lines 38–73) — reuse for GoalRecheckBanner:
```typescript
// Collapsible toggle: useState(false) + CSS max-height transition
const [expanded, setExpanded] = useState(false);
// ...
<div className={`overflow-hidden transition-all duration-200 ${
  expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
}`}>
```

---

### `src/components/app/simulation/goal-recheck-banner.tsx` (component, request-response)

**Analog:** `WarningsBanner` sub-component in `src/components/app/simulation/results-panel.tsx` (lines 38–73)

**Imports pattern** (results-panel.tsx lines 1–9):
```typescript
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
```

**Core banner pattern** (adapted from WarningsBanner, lines 38–73):
```typescript
interface GoalRecheckBannerProps {
  goal: string;
  onDismiss: () => void;
}

export function GoalRecheckBanner({ goal, onDismiss }: GoalRecheckBannerProps) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 flex items-center gap-3">
      <p className="text-sm text-foreground flex-1">
        Quick check — is your goal still{" "}
        <span className="text-accent">{goal}</span>?
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-foreground-muted hover:text-foreground transition-colors"
      >
        Yes, still right
      </button>
    </div>
  );
}
```

**GlassSection style reference** (results-panel.tsx lines 22–36) — border + bg tokens:
```typescript
// Raycast card tokens from CLAUDE.md:
// border: border-white/[0.06]
// bg: bg-white/[0.03] (for inline banners, lighter than glass panels)
// hover border: white/[0.1]
```

---

### `src/components/app/video-upload.tsx` (modify — component, request-response)

**Analog:** itself — insertion point below empty state (lines 218–232)

**Existing state pattern** (lines 57–61):
```typescript
const [isDragging, setIsDragging] = React.useState(false);
const [error, setError] = React.useState<string | null>(null);
const [thumbnail, setThumbnail] = React.useState<string | null>(null);
const [duration, setDuration] = React.useState<number | null>(null);
```
Add: `const [dataDisclosureOpen, setDataDisclosureOpen] = React.useState(false);`

**Existing Badge import** (line 6 — already imported):
```typescript
import { Badge } from "@/components/ui/badge";
```
Add: `import { ChevronDown } from "lucide-react";` (already uses `Upload` and `X` from lucide)

**Core disclosure pattern** — add after closing `</div>` of empty state (after line 232), still inside outer `div`:
```typescript
{/* "About your data" expandable — only in empty state */}
{!file && (
  <div className="px-4 pb-3">
    <button
      type="button"
      className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
      onClick={(e) => {
        e.stopPropagation(); // Prevents outer dropzone onClick from firing file picker
        setDataDisclosureOpen((v) => !v);
      }}
    >
      About your data
      <ChevronDown
        className={cn(
          "w-3 h-3 transition-transform",
          dataDisclosureOpen && "rotate-180"
        )}
      />
    </button>
    {dataDisclosureOpen && (
      <p className="mt-1.5 text-xs text-foreground-muted leading-relaxed">
        Videos are automatically deleted after 30 days. To keep for
        re-analysis, go to Settings.
      </p>
    )}
  </div>
)}
```

**Critical:** `e.stopPropagation()` is required. Outer `div` has `onClick={() => inputRef.current?.click()}` active when `!file` (line 191).

---

### `src/components/app/settings/creator-profile-section.tsx` (modify — component, CRUD)

**Analog:** `src/components/app/profile-settings-form.tsx` — settings section save pattern (lines 169–198)

**Existing mutation pattern** (profile-settings-form.tsx lines 169–198):
```typescript
const handleSave = async (): Promise<void> => {
  try {
    await updateMutation.mutateAsync({ /* fields */ });
    toast({ variant: "success", title: "Profile updated" });
  } catch {
    toast({ variant: "error", title: "Failed to save — please try again" });
  }
};
```

**Retention toggle addition** — add new boolean field to the section. The `CreatorProfileSection` renders `ProfileSettingsForm`; the simplest path is adding the toggle there. Pattern from profile-settings-form.tsx section structure (lines 216–315):
```typescript
// New section at bottom of ProfileSettingsForm, above the save button:
<section data-testid="settings-data" className="space-y-2">
  <label className="block text-sm font-medium text-foreground">
    Video storage
  </label>
  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
    <div>
      <p className="text-sm text-foreground">Keep my uploaded videos for re-analysis</p>
      <p className="text-xs text-foreground-muted mt-0.5">
        Default: deleted after 30 days
      </p>
    </div>
    {/* Toggle — use existing boolean field pattern from todAware (line 113) */}
    <input
      type="checkbox"
      checked={retentionOptedIn}
      onChange={(e) => setRetentionOptedIn(e.target.checked)}
      className="..."
    />
  </div>
</section>
```

**Mutation field addition** — add `storage_retention_opted_in: retentionOptedIn` to the `mutateAsync` call payload (profile-settings-form.tsx line 171). The `useUpdateCreatorProfile` hook PATCHes `/api/profile/creator-profile` — that route's whitelist may need updating to accept the new field.

**useCreatorProfile hook** (`src/hooks/queries/use-creator-profile.ts` lines 53–67):
```typescript
// Add to CreatorProfileResponse interface:
storage_retention_opted_in: boolean | null;

// Hook fetches GET /api/profile/creator-profile — already handles partial fields
```

---

## Shared Patterns

### Cron Authentication
**Source:** `src/app/api/cron/calibration-audit/route.ts` lines 27–28
**Apply to:** `delete-retained-videos/route.ts`
```typescript
const authError = verifyCronAuth(request);
if (authError) return authError;
```

### Service Client (server-to-DB, bypasses RLS)
**Source:** `src/app/api/cron/calibration-audit/route.ts` line 64
**Apply to:** `delete-retained-videos/route.ts`
```typescript
const supabase = createServiceClient();
```

### Storage Batch Delete (best-effort)
**Source:** `src/app/api/analyze/route.ts` lines 348–353
**Apply to:** `delete-retained-videos/route.ts`
```typescript
service.storage
  .from("videos")
  .remove([validated.video_storage_path])
  .catch(() => {
    // Best-effort cleanup — don't fail the response
  });
```
Cron variant: `await supabase.storage.from("videos").remove(paths)` (awaited, not fire-and-forget).

### Raycast Card / Glass Section
**Source:** `src/components/app/simulation/results-panel.tsx` lines 22–36
**Apply to:** `goal-recheck-banner.tsx`, inline disclosure in `video-upload.tsx`
```typescript
// Card tokens per CLAUDE.md:
// border: border-white/[0.06]   hover: border-white/[0.1]
// bg: bg-white/[0.03]
// radius: rounded-lg (12px)
// inset shadow: rgba(255,255,255,0.05) 0 1px 0 0 inset
```

### Collapsible / Expandable (CSS max-height)
**Source:** `src/components/app/simulation/results-panel.tsx` lines 59–69 (`WarningsBanner`)
**Apply to:** `goal-recheck-banner.tsx` (if collapsible needed), `video-upload.tsx` disclosure
```typescript
// CSS transition — already used in results-panel.tsx, no framer-motion needed
const [expanded, setExpanded] = useState(false);
// ...
<div className={`overflow-hidden transition-all duration-200 ${
  expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
}`}>
```

### Error / Success Toast
**Source:** `src/components/app/profile-settings-form.tsx` lines 193–197
**Apply to:** retention toggle save in settings
```typescript
toast({ variant: "success", title: "Profile updated" });
// or:
toast({ variant: "error", title: "Failed to save — please try again" });
```

### Logger (structured, per-module)
**Source:** `src/app/api/cron/calibration-audit/route.ts` lines 12–12
**Apply to:** `delete-retained-videos/route.ts`
```typescript
const log = createLogger({ module: "cron/delete-retained-videos" });
log.info("...", { key: value });
log.error("...", { error: ... });
```

---

## No Analog Found

All Phase 11 files have close analogs. No new-pattern files.

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/components/`, `src/hooks/`, `supabase/migrations/`, `vercel.json`
**Files read:** 13 source files
**Pattern extraction date:** 2026-05-20

### Critical Pre-Implementation Notes

1. **Wave 0 migration runs first** — `analysis_count` and `storage_retention_opted_in` columns must exist on `creator_profiles` before any code tasks. After migration, regenerate `database.types.ts` via `npx supabase gen types typescript`.

2. **Chip list goes in `ResultsPanel` directly, not `ViralScoreRing`** — `ViralScoreRing` is only used on the `/viral-score-test` marketing page. Dashboard uses `HeroScore` in `impact-score.tsx`. Add `SignalAvailabilityChips` as a sibling to the `HeroScore` GlassSection in `results-panel.tsx`.

3. **`storage_retention_opted_in` must be read early in `/api/analyze`** — query it alongside the subscription check (lines 136–150) so the storage delete gate at lines 343–354 and 438–446 can use it.

4. **`analysis_count` for PROFILE-16 banner** — increment via RPC in route, read locally in `DashboardClient` (fetch once on mount, increment locally after each successful analysis). Do NOT use `usage_tracking.analysis_count` (daily rate-limit counter, resets daily).

5. **`verifyCronAuth` is the only cron auth** — never build a custom token check; the function is in `@/lib/cron-auth`.
