# Phase 11: Existing UI Integration + Privacy Policy - Research

**Researched:** 2026-05-20
**Domain:** Next.js UI integration, Supabase Storage/Cron, React component extension
**Confidence:** HIGH (all findings verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard Display**
- D-01: Score + availability only for M1. No calibration badge. All new detail panels hidden until M2. `FactorsList` renders only existing known factors — new top-level fields (`platform_fit`, `retrieval_score`) ignored in UI.
- D-02: `signal_availability` as chip list beneath `ViralScoreRing`. Small chip row: `Audio ✓`, `Personas ✓`, `Retrieval ✗`. Chips greyed/strikethrough if signal unavailable. Handles ML disabled case (`ML ✕`) with no special code path.
- D-03: No calibration badge if `is_calibrated = false`. Score shows normally.

**Storage Retention Policy**
- D-04: One-time settings toggle for opt-in. Settings page (existing "Creator Profile" tab or new "Data" subsection). Default off (auto-delete at 30 days). No per-upload friction.
- D-05: Expandable "About your data ▾" disclosure below dropzone in `video-upload.tsx`. Collapsed by default.
- D-06: INT-07 GDPR export/deletion deferred to M2.

**PROFILE-16 Micro-card**
- D-07: Inline banner post-result. When `analysis_count % 10 === 0` AND user has profile, render collapsible banner: "Quick check — is your goal still X?" Non-blocking; dismissable.
- D-08: `analysis_count` incremented in `/api/analyze` on success via `UPDATE creator_profiles SET analysis_count = analysis_count + 1 WHERE user_id = $userId`. Atomic with analysis result write.

**Engine v3 Wiring**
- D-09: Remove Phase 10 dev guards if any; then smoke test both `tiktok_url` and `video_upload` modes.
- D-10: ML disabled = chip shows `ML ✕`, no special handling. `signal_availability.ml = false` → chip renders unavailable.

### Claude's Discretion
- Exact placement of "About your data" expandable within `video-upload.tsx` layout
- Whether retention settings toggle lives in existing "Creator Profile" tab or new "Data" subsection
- Chip list component choice: reuse `Badge` or inline spans

### Deferred Ideas (OUT OF SCOPE)
- INT-07 GDPR data export + deletion request (M2)
- Polished result panels (persona viz, audio breakdown, hook decomp cards, retrieval evidence cards, calibration confidence banner) — M2
- Anti-virality / don't-post-yet UI surfaces — M2
- Watermark detection UI — M2
- ENGINE_VERSION `3.0.0-dev` → `3.0.0` flip — Phase 12
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Existing `/api/analyze` switched to engine v3; smoke test passes end-to-end (both modes) | Route already calls `runPredictionPipeline` + `aggregateScores`; verify no dev guards in aggregator; smoke test protocol defined below |
| INT-02 | `video-upload.tsx` triggers 9-card profile modal for users without profile | Already complete (Phase 2); no Phase 11 code changes |
| INT-03 | Existing dashboard renders updated `PredictionResult` with new fields (basic display) | `ResultsPanel` + `HeroScore` components identified; chip list addition to `ViralScoreRing` defined |
| INT-04 | MVP Launch onboarding integrates with 9-card profile (no field duplication) | Already complete (Phase 2); no Phase 11 code changes |
| INT-05 | Storage retention cron auto-deletes uploaded videos after 30 days unless opted in | Cron pattern from `calibration-audit/route.ts` confirmed; retention cron structure defined; migration needed for `storage_retention_opted_in` |
| INT-06 | Retention policy shown in upload UI before upload | `video-upload.tsx` empty-state identified; expandable disclosure pattern defined |
| INT-07 | GDPR-compliant user data export/deletion | DEFERRED to M2 per D-06 |
| PROFILE-16 | Re-prompt micro-card every 10 analyses | `analysis_count` column needed on `creator_profiles`; banner component pattern defined |
</phase_requirements>

---

## Summary

Phase 11 is a glue phase — it wires four independent deliverables onto existing infrastructure. No new engine work; no new pipeline stages. All deliverables are UI additions or small API additions onto already-complete backend foundation.

**Critical gap found:** `analysis_count` does NOT exist on `creator_profiles` in the live DB schema. The column lives on `usage_tracking` (daily rate-limiting counter). D-08 requires a separate `analysis_count` column on `creator_profiles` for the 10-analysis re-prompt trigger. A migration is required before any code touches this.

**Second gap found:** `storage_retention_opted_in` (boolean, default false) does not exist anywhere in the DB schema. Required by INT-05 before the retention cron can honor user opt-in. Migration needed.

**Primary recommendation:** Plan a Wave 0 migration task that adds both columns to `creator_profiles` before any code tasks run.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Engine v3 smoke test | API / Backend | — | `/api/analyze` owns pipeline invocation; smoke test verifies route→pipeline→aggregator chain |
| signal_availability chip list | Browser / Client | — | `ViralScoreRing` is a client component; chip rendering is pure display logic |
| "About your data" disclosure | Browser / Client | — | `video-upload.tsx` is client component; expandable is local UI state |
| Retention settings toggle | Browser / Client | API / Backend | Client toggle → upsert preference to `creator_profiles`; cron reads it |
| Storage retention cron | API / Backend | Database / Storage | Vercel cron route; queries `creator_profiles` for opted-in users; calls Supabase Storage delete |
| analysis_count increment | API / Backend | Database | POST-success UPDATE on `creator_profiles`; triggers frontend banner check |
| PROFILE-16 inline banner | Browser / Client | — | Banner reads `analysis_count` from result context or profile fetch; pure client render |

---

## Standard Stack

### Core (already in project — no installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 | App framework + cron route host | Project constraint |
| Supabase JS | (project version) | DB client for `creator_profiles` UPDATE + Storage delete | Project constraint |
| React | (Next.js peer) | Component rendering | Project constraint |
| Tailwind v4 | (project version) | Chip list styling | Project constraint |
| `class-variance-authority` | (project version) | `Badge` variant selection | Already used in `badge.tsx` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `framer-motion` | (project version) | Collapsible animation on "About your data" disclosure | Already used in `ViralScoreRing` — reuse `AnimatePresence` pattern |
| `@radix-ui/react-collapsible` | (project version) | Headless accessible collapsible | Only if framer-motion `AnimatePresence` insufficient; check imports first |

**No new installs needed.** All required libraries are already in `package.json`. [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
User Upload Click
       │
       ▼
[video-upload.tsx] ──► "About your data ▾" disclosure (collapsed, local state)
       │
       ▼ (file selected)
[/api/analyze POST]
       │
       ├── runPredictionPipeline() + aggregateScores()
       │          │
       │          ▼
       │   PredictionResult { signal_availability, overall_score, ... }
       │
       ├── INSERT analysis_results (existing)
       ├── UPDATE usage_tracking.analysis_count (existing)
       ├── UPDATE creator_profiles.analysis_count += 1  ◄─ NEW (D-08)
       │
       └── StorageDelete (video_upload mode)
               │
               └── IF creator_profiles.storage_retention_opted_in = true → SKIP delete

[ResultsPanel / ViralScoreRing]
       │
       ├── chip list from signal_availability (NEW — D-02)
       │   Audio ✓/✕  Personas ✓/✕  Retrieval ✓/✕  ML ✓/✕
       │
       └── IF analysis_count % 10 === 0 → PROFILE-16 inline banner (NEW — D-07)

[Vercel Cron: /api/cron/delete-retained-videos]  ◄─ NEW (INT-05)
       │
       └── Query: analysis_results WHERE uploaded_at < NOW()-30d
                  JOIN creator_profiles WHERE storage_retention_opted_in = false
           → Supabase Storage delete batch

[Settings Page — "Creator Profile" tab or new "Data" section]
       │
       └── retention toggle → UPDATE creator_profiles.storage_retention_opted_in
```

### Recommended Project Structure

No new directories. All additions slot into existing locations:

```
src/
├── app/api/analyze/route.ts          # +analysis_count UPDATE (D-08)
├── app/api/cron/
│   └── delete-retained-videos/
│       └── route.ts                  # NEW cron (INT-05)
├── components/
│   ├── app/
│   │   ├── video-upload.tsx          # +"About your data" disclosure (D-05)
│   │   └── simulation/
│   │       ├── results-panel.tsx     # +PROFILE-16 banner (D-07)
│   │       └── signal-availability-chips.tsx  # NEW component (D-02)
│   └── viral-results/
│       └── ViralScoreRing.tsx        # +chip list prop + render (D-02)
└── supabase/migrations/
    └── 20260520XX_phase11_retention_counter.sql  # analysis_count + storage_retention_opted_in
```

### Pattern 1: Cron Route (follow calibration-audit pattern)

**What:** Vercel cron route using `verifyCronAuth` + `createServiceClient` + batch Supabase Storage deletes
**When to use:** Storage retention cron (INT-05)

```typescript
// Source: src/app/api/cron/calibration-audit/route.ts (VERIFIED)
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  // Query analysis_results for videos older than 30 days
  // where creator_profiles.storage_retention_opted_in = false
  // then call supabase.storage.from("videos").remove([...paths])
  return NextResponse.json({ status: "completed", deleted: N });
}
```

**vercel.json cron entry** (append to existing `crons` array):
```json
{
  "path": "/api/cron/delete-retained-videos",
  "schedule": "0 3 * * *"
}
```
[VERIFIED: vercel.json in codebase — daily schedule matches `validate-rules` cron pattern]

### Pattern 2: analysis_count Increment in /api/analyze

**What:** After successful INSERT to `analysis_results`, fire a separate `UPDATE` on `creator_profiles`.
**When to use:** D-08 — atomic with analysis write, no background lag

```typescript
// Source: /api/analyze/route.ts lines 320-356 (insert + usage update pattern — VERIFIED)
// After the existing service.from("analysis_results").insert(...)
// Add:
const { error: counterError } = await service
  .from("creator_profiles")
  .update({ analysis_count: /* supabase RPC or direct */ })
  // Use RPC for atomic increment, or raw SQL via rpc():
  // analysis_count: /* use supabase.rpc('increment_analysis_count', { uid: user.id }) */
  .eq("user_id", user.id);
```

**Recommended approach:** Use Supabase `rpc()` call to a `increment_analysis_count(user_id)` SQL function, OR use the pattern from `usage_tracking` upsert (lines 332-341) which does `analysis_count: currentCount + 1` after reading the current value. For `creator_profiles`, a read-then-write introduces a race condition for concurrent analyses. Use a DB function instead.

**Alternative:** Add a PostgreSQL function in the migration:
```sql
CREATE OR REPLACE FUNCTION increment_creator_analysis_count(p_user_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE creator_profiles
  SET analysis_count = analysis_count + 1
  WHERE user_id = p_user_id;
$$;
```
Then call `supabase.rpc('increment_creator_analysis_count', { p_user_id: user.id })`. [ASSUMED — pattern consistent with Supabase docs but not a pre-existing function in this codebase]

### Pattern 3: signal_availability Chip List

**What:** Horizontal row of `Badge` components beneath `ViralScoreRing`
**When to use:** D-02 — every result display

`ViralScoreRing` currently has props: `score`, `tier`, `size`, `animated`, `className`. To add chip list, either:

**Option A (recommended):** Add optional `signalAvailability?: SignalAvailability` prop to `ViralScoreRing`. Component renders chip row below tier label. Keeps chip list co-located with ring.

**Option B:** Parent `ResultsPanel` (or `HeroScore`) renders chips separately, below ring. Avoids prop threading but duplicates positioning logic.

D-02 says "below score ring" — Option A is cleaner since `ViralScoreRing` already controls its own vertical layout with `flex flex-col items-center gap-4`.

Chip render pattern using existing `Badge` component:

```typescript
// Source: src/components/ui/badge.tsx (VERIFIED — variant system)
const CHIP_SIGNALS: Array<{
  key: keyof SignalAvailability;
  label: string;
}> = [
  { key: "audio", label: "Audio" },
  { key: "personas", label: "Personas" },
  { key: "retrieval", label: "Retrieval" },
  { key: "ml", label: "ML" },
];

// Available → variant="success", Unavailable → variant="default" + line-through text
{CHIP_SIGNALS.map(({ key, label }) => {
  const available = signalAvailability?.[key] ?? false;
  return (
    <Badge
      key={key}
      variant={available ? "success" : "default"}
      size="sm"
      className={available ? "" : "line-through opacity-50"}
    >
      {label} {available ? "✓" : "✕"}
    </Badge>
  );
})}
```

[VERIFIED: Badge variants `success` and `default` confirmed in badge.tsx]

### Pattern 4: "About your data" Expandable

**What:** Collapsed section below video dropzone in `video-upload.tsx` empty-state
**When to use:** INT-06 — always visible in empty state before upload

`video-upload.tsx` empty state (line 218-232) renders inside the outer `div`. Add expandable below the empty-state inner `div`:

```typescript
// VERIFIED: video-upload.tsx uses local useState already (isDragging, error, thumbnail, duration)
// Add: const [dataDisclosureOpen, setDataDisclosureOpen] = useState(false);

{!file && (
  <div className="px-4 pb-3">
    <button
      type="button"
      className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
      onClick={(e) => { e.stopPropagation(); setDataDisclosureOpen(v => !v); }}
    >
      About your data
      <ChevronDown className={cn("w-3 h-3 transition-transform", dataDisclosureOpen && "rotate-180")} />
    </button>
    {dataDisclosureOpen && (
      <p className="mt-1.5 text-xs text-foreground-muted leading-relaxed">
        Videos are automatically deleted after 30 days. To keep for re-analysis, go to Settings.
      </p>
    )}
  </div>
)}
```

**Key:** `e.stopPropagation()` prevents click from triggering the outer dropzone's `onClick` (file picker open). [VERIFIED: dropzone `onClick` at line 191 of video-upload.tsx fires on `!file` condition]

### Pattern 5: PROFILE-16 Inline Banner

**What:** Collapsible banner in `ResultsPanel` post-result, shown when `analysis_count % 10 === 0`
**When to use:** D-07 — after pipeline completes, user has profile

Banner data required: `creator_profiles.primary_goal` (Card 3, confirmed in DB schema as `primary_goal` column). Needs a fetch of the profile or passing `primary_goal` through the result response. Options:

**Option A:** Fetch `creator_profiles` in `DashboardClient` alongside analysis; pass `primaryGoal` and `analysisCount` as props to `ResultsPanel`.

**Option B:** Fetch profile lazily inside `ResultsPanel` on result render using `useEffect` + Supabase client. Adds one extra query per result display.

Option A is cleaner — `DashboardClient` already creates a Supabase client (line 22). The banner check only renders when condition is met, so fetch can be conditional.

The banner itself is NOT the `ProfileInterviewModal`. It's a simple inline component:

```typescript
// Collapsible inline banner — NOT ProfileInterviewModal
function GoalRecheckBanner({ goal, onDismiss }: { goal: string; onDismiss: () => void }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 flex items-center gap-3">
      <p className="text-sm text-foreground flex-1">
        Quick check — is your goal still <span className="text-accent">{goal}</span>?
      </p>
      <button onClick={onDismiss} className="text-xs text-foreground-muted hover:text-foreground">
        Yes, still right
      </button>
    </div>
  );
}
```

[VERIFIED: ResultsPanel at results-panel.tsx — renders result prop; has access to useSimulationStore]

### Anti-Patterns to Avoid

- **Modifying `ViralScoreRing` props as required:** Keep `signalAvailability` optional (`?`) so existing usage in `/viral-score-test/page.tsx` continues compiling without changes.
- **Deleting video immediately post-analysis for opted-in users:** Current route deletes immediately after pipeline (lines 344-354 and 438-445). Must gate this on `storage_retention_opted_in`. Users who opt in should NOT have their video deleted immediately.
- **Using `analysis_count` from `usage_tracking` for the 10-analysis check:** `usage_tracking.analysis_count` is a DAILY rate-limit counter, reset daily. D-08 requires a LIFETIME counter on `creator_profiles`. These are distinct columns with distinct semantics.
- **Race condition on `analysis_count` increment:** Don't read then write `creator_profiles.analysis_count` in two separate Supabase calls (risk of concurrent-write collision). Use atomic DB function or Postgres `UPDATE ... SET analysis_count = analysis_count + 1`.
- **Querying `signal_availability.ml_classifier`:** The key is `ml` (not `ml_classifier`) per `SignalAvailability` interface. [VERIFIED: types.ts line 244]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron auth | Custom token check | `verifyCronAuth` from `@/lib/cron-auth` | Already in all cron routes; single source of truth |
| Storage bucket delete | Custom fetch to Supabase REST | `createServiceClient().storage.from("videos").remove([...])` | Already used in `/api/analyze` lines 349-353 |
| Animated collapsible | Custom CSS transitions | CSS `max-height` transition (already used in `results-panel.tsx` lines 60-63) or `AnimatePresence` | Pattern already in codebase |
| Badge status chip | Custom span with inline styles | `Badge` component with `variant="success"/"default"` + `size="sm"` | Existing component, correct semantics |

---

## DB Schema Gaps (Wave 0 Migration Required)

**CRITICAL — both items block subsequent code tasks:**

### Gap 1: `creator_profiles.analysis_count` (MISSING)
[VERIFIED: database.types.ts `creator_profiles` Row definition lines 586-621 — column absent]

`analysis_count` currently lives on `usage_tracking` (daily rate-limit counter). D-08 requires a SEPARATE lifetime counter on `creator_profiles`.

```sql
ALTER TABLE creator_profiles
  ADD COLUMN analysis_count INTEGER NOT NULL DEFAULT 0;
```

### Gap 2: `creator_profiles.storage_retention_opted_in` (MISSING)
[VERIFIED: database.types.ts — column absent from creator_profiles schema]

```sql
ALTER TABLE creator_profiles
  ADD COLUMN storage_retention_opted_in BOOLEAN NOT NULL DEFAULT false;
```

Combined migration file: `supabase/migrations/20260520XXXXXX_phase11_retention_counter.sql`

After migration: `database.types.ts` must be regenerated (`npx supabase gen types typescript`).

---

## Phase 10 Sync Verification (Required Before INT-01 Execution)

CONTEXT.md notes Phase 11 depends on Phase 10 outputs. Before executing INT-01 smoke test:

1. **ENGINE_VERSION tag:** `src/lib/engine/version.ts` line 6 currently = `"3.0.0-dev"` [VERIFIED]. Do NOT change in Phase 11 (Phase 12 owns the flip).
2. **ML_SIGNAL_WEIGHT:** `SCORE_WEIGHTS.ml = 0.05` in `aggregator.ts` line 56 [VERIFIED — "down-weighted after Phase 10 audit"]. Phase 10 completed this.
3. **`platt_parameters` DB table:** `supabase/migrations/20260520000000_phase10_platt_parameters.sql` exists [VERIFIED]. Assume table applied.
4. **Dev guards in aggregator:** No feature flags found — aggregator uses direct constants per Phase 10 D-02 pattern. [VERIFIED: aggregator.ts imports are direct, no conditional pipeline gates]

---

## Common Pitfalls

### Pitfall 1: stopPropagation on Disclosure Click
**What goes wrong:** Clicking "About your data ▾" opens file picker dialog.
**Why it happens:** Outer `div` in video-upload.tsx has `onClick={() => inputRef.current?.click()}` active when `!file`. Any click inside propagates to it.
**How to avoid:** `e.stopPropagation()` on the disclosure button's click handler. [VERIFIED: video-upload.tsx line 191]

### Pitfall 2: Wrong analysis_count column
**What goes wrong:** Code reads `usage_tracking.analysis_count` for the 10-analysis check and never triggers (resets daily to 0).
**Why it happens:** Two tables both have `analysis_count`; easy to confuse.
**How to avoid:** D-08 explicitly targets `creator_profiles.analysis_count`. The migration in Wave 0 creates this. All code in `/api/analyze` for the re-prompt check must query `creator_profiles`, not `usage_tracking`.

### Pitfall 3: Video deleted immediately for opted-in users
**What goes wrong:** User opts in to video retention, but video is deleted immediately post-analysis anyway.
**Why it happens:** Current route has unconditional `service.storage.from("videos").remove(...)` at lines 344-354 (JSON branch) and 438-445 (SSE branch).
**How to avoid:** Gate immediate delete on `!storage_retention_opted_in`. Query `creator_profiles.storage_retention_opted_in` early in the route (alongside the subscription query) and skip immediate delete if opted in.
**Warning sign:** User reports video not available after opting in.

### Pitfall 4: ViralScoreRing prop change breaks viral-score-test page
**What goes wrong:** TypeScript error on `/viral-score-test/page.tsx` if `signalAvailability` is added as a required prop.
**Why it happens:** That page already uses `ViralScoreRing` without any `signalAvailability` prop.
**How to avoid:** `signalAvailability?: SignalAvailability` — optional prop. If `undefined`, chip row simply doesn't render. [VERIFIED: viral-score-test/page.tsx line 90 — no signalAvailability prop]

### Pitfall 5: signal_availability not surfaced to ResultsPanel
**What goes wrong:** Chip list always shows all signals as unavailable (renders from undefined).
**Why it happens:** `ResultsPanel` receives full `PredictionResult` but `ViralScoreRing` is not used in `ResultsPanel` — it uses `HeroScore` (impact-score.tsx) instead. [VERIFIED: results-panel.tsx line 157-166 — `HeroScore` component, not `ViralScoreRing`]
**How to avoid:** Check `HeroScore` component (`src/components/app/simulation/impact-score.tsx`) for where to add chip list — it may be the correct insertion point, NOT `ViralScoreRing` directly in the dashboard flow.

### Pitfall 6: Cron deletes videos that are still in-flight
**What goes wrong:** Retention cron runs at 03:00 UTC and deletes a video that was uploaded 30 days ago but whose retention preference just changed.
**Why it happens:** Cron queries by upload date only; preference is not checked at upload time.
**How to avoid:** JOIN `creator_profiles.storage_retention_opted_in = false` in the cron query. This is already the design intent but needs explicit JOIN.

---

## Code Examples

### Supabase Storage batch delete (existing route pattern)
```typescript
// Source: /api/analyze/route.ts lines 348-353 (VERIFIED)
service.storage
  .from("videos")
  .remove([validated.video_storage_path])
  .catch(() => {
    // Best-effort cleanup — don't fail the response
  });
```

### Cron batch delete pattern
```typescript
// Source: /api/cron/calibration-audit/route.ts (VERIFIED — adapted for retention)
// Query: analysis_results joined with creator_profiles
const { data: expiredVideos } = await supabase
  .from("analysis_results")
  .select("video_storage_path, user_id, created_at, creator_profiles!inner(storage_retention_opted_in)")
  .lt("created_at", thirtyDaysAgo)
  .not("video_storage_path", "is", null)
  .eq("creator_profiles.storage_retention_opted_in", false);

// Then batch:
const paths = expiredVideos?.map(r => r.video_storage_path) ?? [];
if (paths.length) {
  await supabase.storage.from("videos").remove(paths);
}
```

Note: `analysis_results` schema must be verified to confirm `video_storage_path` is persisted there. [ASSUMED — current route stores path via `video_storage_path` in `validated` but buildInsertRow does not include it. Planner must verify or add this column.]

### Badge chip list
```typescript
// Source: badge.tsx variants (VERIFIED)
<div className="flex flex-wrap gap-1.5 mt-2">
  {chips.map(({ key, label }) => (
    <Badge key={key} variant={available[key] ? "success" : "default"} size="sm"
           className={available[key] ? "" : "line-through opacity-40"}>
      {label}
    </Badge>
  ))}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Immediate video delete post-analysis (best-effort) | 30-day retention window with opt-in toggle | Phase 11 | User control over data; INT-06 compliance |
| No analysis counter on profiles | `analysis_count` on `creator_profiles` for lifetime tracking | Phase 11 migration | Enables PROFILE-16 re-prompt |
| No signal transparency in UI | `signal_availability` chip row under score ring | Phase 11 | ML-disabled case visible to user; no special code path |

---

## Open Questions

1. **Where is chip list added — ViralScoreRing or HeroScore?**
   - What we know: `ResultsPanel` uses `HeroScore` (not `ViralScoreRing`) for the score display in the live dashboard.
   - What's unclear: D-02 says "beneath `ViralScoreRing`" but `ViralScoreRing` is only used in the marketing `/viral-score-test` page. The dashboard uses `HeroScore` in `impact-score.tsx`.
   - Recommendation: Planner should read `src/components/app/simulation/impact-score.tsx` before assigning this task. Likely need to add chip list to `HeroScore` (which wraps the score display for the dashboard) and separately update `ViralScoreRing` for consistency. Or — simpler — add `signalAvailability` chips as a new sub-component in `ResultsPanel` directly below the `HeroScore` section.

2. **Does `analysis_results` persist `video_storage_path`?**
   - What we know: `buildInsertRow` in route.ts does not include `video_storage_path` in the INSERT.
   - What's unclear: How does the retention cron know which Supabase Storage paths to delete 30 days later if paths are not persisted in the DB?
   - Recommendation: Either (a) add `video_storage_path` column to `analysis_results` and persist it, or (b) the cron deletes all files in the `videos/` bucket older than 30 days using Storage's list+filter API. Option (b) is simpler and doesn't require a schema change. Planner must decide which approach.

3. **PROFILE-16 banner: where does it read `analysis_count` from?**
   - What we know: D-08 says increment on success in `/api/analyze`. The route returns `PredictionResult` which does not include `analysis_count`.
   - What's unclear: The frontend needs to know the count to trigger the banner. Either (a) return `analysis_count` in the prediction response (add to `PredictionResult` or as a side-channel SSE event), or (b) have `DashboardClient` fetch `creator_profiles` on mount and track locally.
   - Recommendation: Option (b) — fetch `creator_profiles.analysis_count` in `DashboardClient` once on mount; after each successful analysis, increment the local count. When `localCount % 10 === 0`, show banner. No schema change to `PredictionResult`.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config/SQL changes. No external tool dependencies beyond the existing Supabase project and Vercel (both confirmed active per STATE.md).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.*` (project root) |
| Quick run command | `npm test -- --run src/app/api/analyze/__tests__/route.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | `/api/analyze` completes end-to-end (both modes, no dev guards) | smoke / manual | `npm test -- --run src/app/api/analyze/__tests__/route.test.ts` | ✅ |
| INT-03 | `signal_availability` chip list renders correct state | unit | `npm test -- --run src/components/viral-results/__tests__/` | ❌ Wave 0 |
| INT-05 | Retention cron skips opted-in users; deletes non-opted videos | unit | `npm test -- --run src/app/api/cron/delete-retained-videos/__tests__/` | ❌ Wave 0 |
| INT-06 | "About your data" expandable renders; toggle works | unit | `npm test -- --run src/components/app/__tests__/video-upload.test.tsx` | ❌ Wave 0 |
| PROFILE-16 | Banner shows when analysis_count % 10 === 0 | unit | `npm test -- --run src/components/app/simulation/__tests__/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run <relevant test file>`
- **Per wave merge:** `npm test` (full suite — must remain green per BENCH-05)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/viral-results/__tests__/signal-chips.test.tsx` — covers INT-03 chip render
- [ ] `src/app/api/cron/delete-retained-videos/__tests__/route.test.ts` — covers INT-05 cron logic
- [ ] `src/components/app/__tests__/video-upload-disclosure.test.tsx` — covers INT-06 expandable
- [ ] `src/components/app/simulation/__tests__/goal-recheck-banner.test.tsx` — covers PROFILE-16

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase `auth.getUser()` — already in `/api/analyze` |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | RLS on `creator_profiles` — verify retention toggle only updates own row |
| V5 Input Validation | yes | Retention toggle is boolean — validate server-side before upsert |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User updates another user's `storage_retention_opted_in` | Tampering | RLS policy `WHERE user_id = auth.uid()` already on `creator_profiles` (Phase 2) |
| Cron route called without auth header | Elevation of privilege | `verifyCronAuth(request)` — already pattern in all cron routes |
| Storage path traversal in batch delete | Tampering | Query paths from `analysis_results` (DB-owned), never from user input |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `increment_creator_analysis_count` RPC function is the cleanest atomic increment | Architecture Patterns — Pattern 2 | Race condition if two analyses complete simultaneously for same user; resolve by using DB function or UPDATE without prior SELECT |
| A2 | `analysis_results` table does not currently persist `video_storage_path` | Open Questions #2 | If it does persist it (in a column not surfaced in `buildInsertRow`), the simpler cron approach changes |
| A3 | `RLS on creator_profiles` from Phase 2 already restricts writes to own row | Security Domain | If Phase 2 RLS is incomplete, retention toggle write could be exploited |

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/analyze/route.ts` — analyzed line by line; video delete pattern, usage tracking pattern, user auth pattern
- `src/lib/engine/version.ts` — ENGINE_VERSION = "3.0.0-dev" confirmed
- `src/lib/engine/aggregator.ts` — SCORE_WEIGHTS.ml = 0.05 confirmed; no dev guards found
- `src/lib/engine/types.ts` — SignalAvailability interface; `ml` key (not `ml_classifier`) confirmed
- `src/types/database.types.ts` — `creator_profiles` schema; `analysis_count` absent; `storage_retention_opted_in` absent
- `src/components/viral-results/ViralScoreRing.tsx` — current props; insertion point for chips identified
- `src/components/app/video-upload.tsx` — empty-state structure; Badge already imported; stopPropagation requirement identified
- `src/components/app/simulation/results-panel.tsx` — HeroScore (not ViralScoreRing) in dashboard; PROFILE-16 insertion point
- `src/components/app/settings/settings-page.tsx` — 6 tabs confirmed; "creator-profile" tab exists
- `src/components/ui/badge.tsx` — variant/size API confirmed
- `vercel.json` — cron pattern; 8 existing crons; append pattern confirmed
- `src/app/api/cron/calibration-audit/route.ts` — cron structure pattern confirmed
- `supabase/migrations/` — latest migration is `20260520000000_phase10_platt_parameters.sql`

### Secondary (MEDIUM confidence)
- `src/app/(app)/dashboard/dashboard-client.tsx` — HeroScore usage; Supabase client creation on line 22; confirmed profile fetch is viable

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Architecture: HIGH — all integration points verified against live code
- DB schema gaps: HIGH — verified by direct inspection of database.types.ts
- Pitfalls: HIGH — derived from verified code reading, not speculation

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable stack; engine types unlikely to shift before Phase 12)
