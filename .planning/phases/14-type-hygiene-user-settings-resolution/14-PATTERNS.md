# Phase 14: Type Hygiene & user_settings Resolution - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 2 (1 new deliverable + 1 regen target) + 5 consumer surfaces (read-only verification)
**Analogs found:** 4 / 7 (consumer surfaces have no close analog — they ARE the primary source; regen has commit-history pattern; audit doc has no prior analog in `.planning/research/`)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.planning/research/user-settings-audit.md` | audit deliverable | transform (grep → structured report) | `.planning/milestones/v2.3-MILESTONE-AUDIT.md` (structure only) | partial (different purpose) |
| `src/types/database.types.ts` (full regen) | model/types | batch (CLI → file replace) | Commits `37a7fa4`, `68e489e`, `1c590ac` (git history) | exact (same file, same regen method) |
| `src/app/api/profile/route.ts` (read-only verify) | controller | request-response | itself | self-reference |
| `src/app/api/profile/avatar/route.ts` (read-only verify) | controller | file-I/O | itself | self-reference |
| `src/app/api/settings/notifications/route.ts` (read-only verify) | controller | request-response | itself | self-reference |
| `src/hooks/queries/use-profile.ts` (read-only verify) | hook | request-response | itself | self-reference |
| `src/hooks/queries/use-team.ts` (read-only verify) | hook | request-response | itself | self-reference |

---

## Pattern Assignments

### `.planning/research/user-settings-audit.md` (new audit deliverable)

**No prior analog exists in `.planning/research/`** — the directory is empty. Structure is Claude's discretion (D-05 content checklist is locked; layout is not).

**Required content checklist from D-05:**
1. All 9 grep hits enumerated with file + line
2. Per call site: reachable-from-deployed-UI marking, fields touched, breakage if table absent
3. React Query hook → API route → table column trace for `use-profile`, `use-team`, `use-creator-profile`
4. Live Supabase migration list (output of `list_migrations` for project `qyxvxleheckijapurisj`) proving `user_settings` + `teams` + `team_members` exist
5. Column-level diff between hand-patched blocks (lines 1166–1226, 1479–1521) and live `information_schema.columns`
6. Final path decision recap

**Closest structural analog for tone/section ordering:** `.planning/milestones/v2.3-MILESTONE-AUDIT.md`

Section ordering to copy from that analog:
- Frontmatter block (YAML: milestone, audited date, status, findings object)
- `## [Topic] Coverage` tables
- Evidence sections with inline grep output
- Decision recap at bottom

**Recommended section order for `user-settings-audit.md`:**
```
# user_settings Audit — Phase 14
**Audited:** <date>
**Status:** PASS | FAIL

## 1. TSC Baseline
## 2. Live Schema Evidence
## 3. Consumer Call Sites (9 grep hits)
## 4. Hook → Route → Column Trace
## 5. Hand-Patch vs Live Schema Diff
## 6. Path Decision
```

---

### `src/types/database.types.ts` (full regeneration)

**Method pattern extracted from git history (commits `37a7fa4`, `68e489e`, `1c590ac`):**

Two methods have been used in this repo:

**Method A — Supabase MCP (used in `37a7fa4`, `1c590ac`):**
The MCP tool `generate_typescript_types` was called with project `qyxvxleheckijapurisj` and output pasted directly into `database.types.ts`. No CLI invocation recorded in commit messages.

Commit `37a7fa4` message:
```
- Extracted from Supabase MCP generate_typescript_types output (live DB introspection)
```

Commit `1c590ac` message:
```
Generated via MCP after `mcp__supabase__apply_migration` succeeded against
project qyxvxleheckijapurisj (virtuna-v1.1).
```

**Method B — CLI with project-id flag (per D-07 decision, preferred for Phase 14):**
```bash
pnpm exec supabase gen types typescript --project-id qyxvxleheckijapurisj > src/types/database.types.ts.new
```
Then review diff before replacing:
```bash
diff src/types/database.types.ts src/types/database.types.ts.new
cp src/types/database.types.ts.new src/types/database.types.ts
rm src/types/database.types.ts.new
```

**D-07 constraint:** Do NOT use `--linked` flag. Use `--project-id qyxvxleheckijapurisj` explicitly.

**Commit message pattern** (from `37a7fa4` and `68e489e`):
```
feat(14): regenerate database.types.ts from live schema

- Removes hand-patched blocks: team_members (1166), teams (1207), user_settings (1479)
- Verifies absorption of prior phase columns (audio fingerprint, pgvector, platt, retention, Qwen)
- pnpm exec tsc --noEmit: 0 errors
- pnpm test: N passed, N skipped, 0 failed
```

**File header pattern** (current file — no autogen header exists, lines 1–8):
```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
```

Note: regen output from Supabase CLI typically includes this same header. If the CLI output omits `__InternalSupabase`, DO NOT remove it — it is load-bearing (per CONTEXT.md code_context).

**Hand-patched blocks that regen must absorb:**

Block 1 — `team_members` (lines 1166–1206):
```typescript
// src/types/database.types.ts lines 1166-1206
team_members: {
  Row: {
    created_at: string
    id: string
    invited_email: string | null
    joined_at: string | null
    role: string
    status: string
    team_id: string
    user_id: string | null
  }
  // Insert, Update omitted for brevity — full block lines 1177-1205
  Relationships: [
    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
      isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },
  ]
}
```

Block 2 — `teams` (lines 1207–1227):
```typescript
// src/types/database.types.ts lines 1207-1227
teams: {
  Row: {
    created_at: string
    id: string
    name: string
    owner_id: string
  }
  // Insert, Update — abbreviated
  Relationships: []
}
```

Block 3 — `user_settings` (lines 1479–1517):
```typescript
// src/types/database.types.ts lines 1479-1517
user_settings: {
  Row: {
    avatar_url: string | null
    company: string | null
    display_name: string | null
    notification_email_updates: boolean
    notification_marketing: boolean
    notification_test_results: boolean
    notification_weekly_digest: boolean
    role: string | null
    updated_at: string
    user_id: string
  }
  Insert: {
    avatar_url?: string | null
    company?: string | null
    display_name?: string | null
    notification_email_updates?: boolean
    notification_marketing?: boolean
    notification_test_results?: boolean
    notification_weekly_digest?: boolean
    role?: string | null
    updated_at?: string
    user_id: string
  }
  Update: { /* same as Insert with user_id?: string */ }
  Relationships: []
}
```

---

## Consumer Surface Patterns (Read-Only Verification)

These files are NOT modified in Phase 14. Patterns extracted so planner can write precise grep verification commands.

### `src/app/api/settings/notifications/route.ts` — `Database` import pattern

**Lines 1–5:**
```typescript
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { Database } from "@/types/database.types";

type UserSettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"];
```

**Verification grep:** `grep -n 'Database\["public"\]\["Tables"\]' src/app/api/settings/notifications/route.ts`

**Note:** `profile/route.ts` and `profile/avatar/route.ts` do NOT import `Database` directly — they rely on Supabase's inferred generics via `createClient()`. Only `notifications/route.ts` uses an explicit `Database` typedef alias. Regen correctness is verified by `tsc --noEmit` passing, not by grep on these files.

### `src/app/api/profile/route.ts` — table access pattern (no direct `Database` import)

**Lines 1–6:**
```typescript
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createScrapingProvider } from "@/lib/scraping";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
```

**`user_settings` access pattern (lines 30–34, 99–107):**
```typescript
// Read (line 30-34)
const { data: settings } = await supabase
  .from("user_settings")
  .select("*")
  .eq("user_id", user.id)
  .maybeSingle();

// Write (lines 99-107)
const { error } = await supabase
  .from("user_settings")
  .upsert(
    { user_id: user.id, ...settingsData },
    { onConflict: "user_id" }
  );
```

**Fields consumed:** `display_name`, `company`, `role`, `avatar_url`, `notification_email_updates`, `notification_test_results`, `notification_weekly_digest`, `notification_marketing`

### `src/app/api/profile/avatar/route.ts` — storage + `user_settings` pattern

**`user_settings` write (lines 61–65):**
```typescript
await supabase
  .from("user_settings")
  .upsert(
    { user_id: user.id, avatar_url: publicUrl },
    { onConflict: "user_id" }
  );
```

**Field consumed:** `avatar_url` only

### `src/hooks/queries/use-profile.ts` — NO direct `Database` import

**Lines 1–5:**
```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { UserProfile, NotificationPrefs } from "@/types/settings";
```

Types are from `@/types/settings` (local shape types), not `Database`. Regen has no direct impact on this file's imports.

### `src/hooks/queries/use-team.ts` — NO direct `Database` import

**Lines 1–4:**
```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
```

Uses inline interface shapes (`TeamMemberResponse`, `TeamResponse`) — no `Database` import. Regen impact: zero (type safety flows through API layer, not direct DB typing in hook).

### `src/hooks/queries/use-creator-profile.ts` — NO direct `Database` import

**Lines 1–11:**
```typescript
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/query-keys";
```

Uses inline `CreatorProfileResponse` interface. No `Database` import.

---

## Shared Patterns

### Auth Pattern
**Source:** `src/app/api/profile/route.ts` lines 22–27 (same pattern in all 3 route files)
**Apply to:** Any new API route added during type-fix cleanup

```typescript
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Error Handling Pattern
**Source:** `src/app/api/profile/route.ts` lines 64–68 (outer catch)
**Apply to:** Any route modified during Phase 14

```typescript
} catch (error) {
  log.error("GET error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
```

Note: `profile/avatar/route.ts` uses `console.error` instead of structured `log.error` — this is an existing inconsistency, out of scope for Phase 14 to fix.

### Upsert + onConflict Pattern
**Source:** `src/app/api/settings/notifications/route.ts` lines 52–54
**Apply to:** Any new `user_settings` write operations

```typescript
const { error } = await supabase
  .from("user_settings")
  .upsert(updates, { onConflict: "user_id" });
```

### Verification Commands (for planner to embed in plan actions)
```bash
# TSC baseline (re-run after every commit touching database.types.ts)
pnpm exec tsc --noEmit

# Build gate
pnpm build

# Test regression check
pnpm vitest run

# Verify Database typedef alias still resolves after regen
grep -n 'Database\["public"\]\["Tables"\]\["user_settings"\]' src/app/api/settings/notifications/route.ts

# Verify hand-patches are gone from regenerated file
grep -n "// hand-patch\|// manually added\|// patched" src/types/database.types.ts
```

---

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `.planning/research/user-settings-audit.md` | audit deliverable | `.planning/research/` is empty — no prior research doc in this milestone. Closest structural reference is `.planning/milestones/v2.3-MILESTONE-AUDIT.md` but it is a different artifact type. Content checklist is locked in D-05; layout is Claude's discretion. |

---

## Metadata

**Analog search scope:** `.planning/research/`, `.planning/milestones/`, `src/types/`, `src/app/api/profile/`, `src/app/api/settings/`, `src/hooks/queries/`, git log `-- src/types/database.types.ts`
**Files scanned:** 8 source files + 15 commits in `database.types.ts` history
**Pattern extraction date:** 2026-05-24
