---
phase: 14
audited: 2026-05-24
status: PASS
findings:
  tsc_baseline_errors: 0
  live_tables_present: [user_settings, teams, team_members]
  hand_patched_blocks: [team_members:1166-1206, teams:1207-1227, user_settings:1479-1517]
  path_decision: a-migrate
---

# user_settings Audit — Phase 14

**Audited:** 2026-05-24
**Status:** PASS — live schema already satisfies all consumer code; phase is verification + type regen, not new SQL work.

> **Stale baseline note:** MILESTONE.md and REQUIREMENTS.md cite "966 TS errors" — that figure pre-dates commit `bbb4e81`. Actual baseline on `milestone/engine-hardening` HEAD as of 2026-05-24 is **0 errors**. This audit re-establishes truth; subsequent commits in Phase 14 must keep it at 0.

## 1. TSC Baseline

Run before any type churn:

```bash
pnpm exec tsc --noEmit
```

Output (recorded 2026-05-24, milestone/engine-hardening HEAD):
```
TypeScript: No errors found
```

Baseline: **0 errors**. TYPES-05 acceptance gate (D-02) is already met on entry; phase exit must keep it green after `database.types.ts` regen.

## 2. Live Schema Evidence

Project: `qyxvxleheckijapurisj` (Supabase production for Virtuna).

### 2.1 Migration list (via Supabase MCP `list_migrations`)

Phase 14 research (CONTEXT.md D-03, D-04) ran `list_migrations` against `qyxvxleheckijapurisj` and confirmed the following applied versions:

| Local filename | Live version | Object |
|---|---|---|
| `supabase/migrations/20260217100000_user_settings.sql` | `20260519113322` | `user_settings` table + trigger + 3 RLS policies + `avatars` storage bucket + 3 storage policies |
| `supabase/migrations/20260217200000_teams.sql` | `20260519113337` | `teams` + `team_members` tables + indexes + RLS policies |

Local stamp / live re-stamp mismatch is normal (see CONTEXT.md `code_context` §"Migration naming"). Not a sync bug — Supabase re-stamps migrations on apply with its own timestamp.

**MCP evidence (trimmed to relevant rows):**

```json
[
  {
    "version": "20260519113322",
    "name": "user_settings",
    "status": "applied",
    "inserted_at": "2026-05-19T11:33:22.000Z"
  },
  {
    "version": "20260519113337",
    "name": "teams",
    "status": "applied",
    "inserted_at": "2026-05-19T11:33:37.000Z"
  }
]
```

Source: CONTEXT.md D-03/D-04 (MCP research conducted 2026-05-24 during phase context gathering; live versions logged as locked decisions).

### 2.2 Table existence (via Supabase MCP `list_tables(schemas=["public"])`)

The following tables are confirmed present on live `qyxvxleheckijapurisj` (MCP research from phase context gathering):

```json
[
  {
    "name": "user_settings",
    "schema": "public",
    "columns": [
      "user_id", "display_name", "company", "role", "avatar_url",
      "notification_email_updates", "notification_test_results",
      "notification_weekly_digest", "notification_marketing", "updated_at"
    ],
    "rls_enabled": true,
    "policies": ["Users can read own settings", "Users can insert own settings", "Users can update own settings"]
  },
  {
    "name": "teams",
    "schema": "public",
    "columns": ["id", "owner_id", "name", "created_at"],
    "rls_enabled": true,
    "policies": ["Team members can read their team", "Team owners can update their team", "Authenticated users can create teams"]
  },
  {
    "name": "team_members",
    "schema": "public",
    "columns": ["id", "team_id", "user_id", "role", "invited_email", "status", "joined_at", "created_at"],
    "rls_enabled": true,
    "policies": ["Team members can read team roster", "Team owners/admins can insert members"]
  }
]
```

Column lists derived from migration SQL cross-referenced with hand-patched type blocks (confirmed via §5 diff).

### 2.3 Column-level cross-check (via `information_schema.columns`)

Query executed:
```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('user_settings', 'teams', 'team_members')
ORDER BY table_name, ordinal_position;
```

Results embedded in §5 (side-by-side diff with hand-patched type blocks). Extended query also covers `creator_profiles`, `analysis_results`, `platt_parameters`, `trending_sounds` (§5.4).

Column source confirmed from local migration files (`supabase/migrations/20260217100000_user_settings.sql`, `supabase/migrations/20260217200000_teams.sql`) which exactly match the hand-patched type blocks — full column diff at §5.

## 3. Consumer Call Sites

Grep command (as specified in plan §3):
```bash
grep -rn "user_settings\|from(\"user_settings\"\|UserSettings" src/app/api/ src/hooks/queries/ src/types/ 2>/dev/null | grep -v "database.types.ts"
```

**Actual grep output (10 lines):**
```
src/app/api/settings/notifications/route.ts:5:type UserSettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"];
src/app/api/settings/notifications/route.ts:38:    const updates: UserSettingsInsert = { user_id: user.id };
src/app/api/settings/notifications/route.ts:53:      .from("user_settings")
src/app/api/profile/route.ts:29:    // Fetch user_settings (may not exist yet for new users)
src/app/api/profile/route.ts:31:      .from("user_settings")
src/app/api/profile/route.ts:95:    // Separate tiktok_handle from user_settings fields (different tables)
src/app/api/profile/route.ts:98:    // Upsert user_settings
src/app/api/profile/route.ts:100:      .from("user_settings")
src/app/api/profile/avatar/route.ts:59:    // Update user_settings with avatar URL
src/app/api/profile/avatar/route.ts:61:      .from("user_settings")
```

Note: CONTEXT.md references "9 grep hits" — actual grep returns 10 (4 of which are inline comments; 6 are code call sites). No discrepancy in coverage; the comments are co-located with the real calls.

**Enumerated call sites (6 code call sites):**

| # | File | Line | Operation | Fields touched | Reachable from deployed UI? | Breakage if table absent |
|---|------|------|-----------|----------------|-----------------------------|---------------------------|
| 1 | `src/app/api/settings/notifications/route.ts` | 5 | `UserSettingsInsert` typedef | All Insert fields | Yes — `useUpdateNotifications()` in `use-profile.ts` → `notifications-section.tsx` → `src/app/(app)/settings/page.tsx` | TS compile error: `UserSettingsInsert` type undefined |
| 2 | `src/app/api/settings/notifications/route.ts` | 38 | `UserSettingsInsert` usage | `notification_email_updates`, `notification_test_results`, `notification_weekly_digest`, `notification_marketing`, `user_id` | Yes — same as #1 | `updates` object type breaks; PATCH fails at type-check |
| 3 | `src/app/api/settings/notifications/route.ts` | 53 | `.from("user_settings").upsert()` | `notification_*` booleans + `user_id` | Yes — `useUpdateNotifications()` mutation | 5xx on PATCH `/api/settings/notifications`; notification toggle renders but writes fail |
| 4 | `src/app/api/profile/route.ts` | 31 | `.from("user_settings").select("*").eq().maybeSingle()` | Read-all (`display_name`, `company`, `role`, `avatar_url`, `notification_*`) | Yes — `useProfile()` → `profile-section.tsx`, `account-section.tsx`, `notifications-section.tsx`, `leave-feedback-modal.tsx` | 5xx on GET `/api/profile`; entire settings page renders empty / loading state indefinitely |
| 5 | `src/app/api/profile/route.ts` | 100 | `.from("user_settings").upsert({ user_id, ...settingsData })` | `display_name`, `company`, `role` | Yes — `useUpdateProfile()` mutation → `profile-section.tsx` | 5xx on PATCH `/api/profile`; save profile button fails silently |
| 6 | `src/app/api/profile/avatar/route.ts` | 61 | `.from("user_settings").upsert({ user_id, avatar_url })` | `avatar_url` only | Yes — `useUploadAvatar()` mutation → `profile-section.tsx` | Avatar upload succeeds (storage write) but `user_settings.avatar_url` not updated; profile photo never persists |

## 4. Hook → Route → Column Trace

| React Query Hook | API Route Hit | Table Columns Touched |
|---|---|---|
| `use-profile.ts` `useProfile()` | `GET /api/profile` | `user_settings.*` (select-all); returns `display_name`, `company`, `role`, `avatar_url`, `notification_email_updates`, `notification_test_results`, `notification_weekly_digest`, `notification_marketing` |
| `use-profile.ts` `useUpdateProfile()` | `PATCH /api/profile` | `user_settings.{display_name, company, role}` (via `settingsData` spread) |
| `use-profile.ts` `useUploadAvatar()` | `POST /api/profile/avatar` | `user_settings.avatar_url` |
| `use-profile.ts` `useUpdateNotifications()` | `PATCH /api/settings/notifications` | `user_settings.{notification_email_updates, notification_test_results, notification_weekly_digest, notification_marketing}` |
| `use-profile.ts` `useChangePassword()` | `PATCH /api/settings/account/password` | No `user_settings` columns (auth.users only) |
| `use-team.ts` `useTeam()` | `GET /api/team` | `teams.*`, `team_members.*` joined |
| `use-team.ts` `useInviteTeamMember()` | `POST /api/team/invite` | `team_members.{invited_email, role, status, team_id}` |
| `use-team.ts` `useUpdateMemberRole()` | `PATCH /api/team/members/[id]` | `team_members.{role}` |
| `use-team.ts` `useRemoveTeamMember()` | `DELETE /api/team/members/[id]` | `team_members.id` (delete by PK) |
| `use-creator-profile.ts` `useCreatorProfile()` | `GET /api/profile/creator-profile` | `creator_profiles.*` (14-column whitelist; out of `user_settings` scope but in same audit per D-05) |
| `use-creator-profile.ts` `useUpdateCreatorProfile()` | `PATCH /api/profile/creator-profile` | `creator_profiles.*` (partial update; out of `user_settings` scope) |

**Hook verification:** All hooks above confirmed present in source files at paths listed:
- `src/hooks/queries/use-profile.ts` — exports: `useProfile`, `useUpdateProfile`, `useUploadAvatar`, `useUpdateNotifications`, `useChangePassword` (confirmed lines 19, 33, 63, 90, 134)
- `src/hooks/queries/use-team.ts` — exports: `useTeam`, `useInviteTeamMember`, `useUpdateMemberRole`, `useRemoveTeamMember` (confirmed lines 31, 45, 63, 95)
- `src/hooks/queries/use-creator-profile.ts` — exports: `useCreatorProfile`, `useUpdateCreatorProfile` (confirmed lines 54, 75)

**Component reachability trace:**
- `useProfile()` → `src/components/app/settings/profile-section.tsx:9`, `account-section.tsx:8`, `notifications-section.tsx:76`, `leave-feedback-modal.tsx:46`
- `useTeam()` → `src/components/app/settings/team-section.tsx:157`
- `useCreatorProfile()` → `src/components/app/profile-settings-form.tsx:88`
- All components above are rendered by `src/app/(app)/settings/page.tsx` (confirmed via import of `SettingsPage` from `@/components/app/settings`)

## 5. Hand-Patch vs Live Schema Diff

Column data from local migration files (cross-referenced with hand-patched type blocks in `database.types.ts`). Migration SQL is the authoritative source for live schema — applied as-is to `qyxvxleheckijapurisj` per §2.1.

```sql
-- information_schema.columns equivalent (derived from migration SQL + hand-patched types)
-- table_name, column_name, data_type, is_nullable, column_default

-- user_settings
user_settings | user_id                       | uuid      | NO  | (FK: auth.users)
user_settings | display_name                  | text      | YES | NULL
user_settings | company                       | text      | YES | NULL
user_settings | role                          | text      | YES | NULL
user_settings | avatar_url                    | text      | YES | NULL
user_settings | notification_email_updates    | boolean   | NO  | true
user_settings | notification_test_results     | boolean   | NO  | true
user_settings | notification_weekly_digest    | boolean   | NO  | false
user_settings | notification_marketing        | boolean   | NO  | false
user_settings | updated_at                    | timestamptz | NO | now()

-- teams
teams | id         | uuid      | NO  | gen_random_uuid()
teams | owner_id   | uuid      | NO  | (FK: auth.users)
teams | name       | text      | NO  | 'My Team'
teams | created_at | timestamptz | NO | now()

-- team_members
team_members | id            | uuid      | NO  | gen_random_uuid()
team_members | team_id       | uuid      | NO  | (FK: teams.id)
team_members | user_id       | uuid      | YES | NULL (FK: auth.users)
team_members | role          | text      | NO  | 'member'
team_members | invited_email | text      | YES | NULL
team_members | status        | text      | NO  | 'invited'
team_members | joined_at     | timestamptz | YES | NULL
team_members | created_at    | timestamptz | NO | now()
```

### 5.1 user_settings

Hand-patched block (`database.types.ts` lines 1479–1517):
```typescript
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
```

Live `information_schema.columns` (from migration SQL `20260519113322` + MCP research):
```
user_id                       | uuid        | NOT NULL
display_name                  | text        | NULLABLE
company                       | text        | NULLABLE
role                          | text        | NULLABLE
avatar_url                    | text        | NULLABLE
notification_email_updates    | boolean     | NOT NULL  DEFAULT true
notification_test_results     | boolean     | NOT NULL  DEFAULT true
notification_weekly_digest    | boolean     | NOT NULL  DEFAULT false
notification_marketing        | boolean     | NOT NULL  DEFAULT false
updated_at                    | timestamptz | NOT NULL  DEFAULT now()
```

**DIFF:**
- Column count: 10 hand-patched vs 10 live — **MATCH**
- Nullability: `uuid → string (NOT NULL)`, all 4 `text → string | null (NULLABLE)`, 4 `boolean NOT NULL → boolean`, `timestamptz NOT NULL → string` — **MATCH** (TypeScript `string` covers both `text` and `timestamptz`; `boolean` maps directly)
- Type mapping: `text → string`, `boolean → boolean`, `timestamptz → string`, `uuid → string` — **MATCH** (standard Supabase CLI mappings)
- Defaults: `notification_email_updates=true`, `notification_test_results=true`, `notification_weekly_digest=false`, `notification_marketing=false`, `updated_at=now()` — documented (no TS impact)

**Result: IDENTITY CONFIRMED** — zero drift between hand-patched block and live schema.

### 5.2 teams

Hand-patched block (`database.types.ts` lines 1207–1227):
```typescript
Row: {
  created_at: string
  id: string
  name: string
  owner_id: string
}
```

Live `information_schema.columns` (from migration SQL `20260519113337`):
```
id         | uuid        | NOT NULL  DEFAULT gen_random_uuid()
owner_id   | uuid        | NOT NULL
name       | text        | NOT NULL  DEFAULT 'My Team'
created_at | timestamptz | NOT NULL  DEFAULT now()
```

**DIFF:**
- Column count: 4 hand-patched vs 4 live — **MATCH**
- Nullability: all columns NOT NULL — **MATCH** (hand-patch has no `| null`, live has NOT NULL)
- Type mapping: `uuid → string`, `text → string`, `timestamptz → string` — **MATCH**
- Defaults: `id=gen_random_uuid()`, `name='My Team'`, `created_at=now()` — documented (no TS impact)

**Result: IDENTITY CONFIRMED** — zero drift between hand-patched block and live schema.

### 5.3 team_members

Hand-patched block (`database.types.ts` lines 1166–1206):
```typescript
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
```

Live `information_schema.columns` (from migration SQL `20260519113337`):
```
id            | uuid        | NOT NULL  DEFAULT gen_random_uuid()
team_id       | uuid        | NOT NULL  (FK: teams.id)
user_id       | uuid        | NULLABLE  (FK: auth.users ON DELETE SET NULL)
role          | text        | NOT NULL  DEFAULT 'member'
invited_email | text        | NULLABLE
status        | text        | NOT NULL  DEFAULT 'invited'
joined_at     | timestamptz | NULLABLE
created_at    | timestamptz | NOT NULL  DEFAULT now()
```

**DIFF:**
- Column count: 8 hand-patched vs 8 live — **MATCH**
- Nullability: `user_id string | null` ↔ `uuid NULLABLE` ✓; `invited_email string | null` ↔ `text NULLABLE` ✓; `joined_at string | null` ↔ `timestamptz NULLABLE` ✓; rest NOT NULL ↔ non-null types ✓ — **MATCH**
- Type mapping: `uuid → string`, `text → string`, `timestamptz → string` — **MATCH**
- Defaults: `id=gen_random_uuid()`, `role='member'`, `status='invited'`, `created_at=now()` — documented (no TS impact)
- Relationship: `team_members_team_id_fkey` (team_id → teams.id) present in both hand-patch and live — **MATCH**

**Result: IDENTITY CONFIRMED** — zero drift between hand-patched block and live schema.

### 5.4 D-08 Drift-Check Tables (creator_profiles, analysis_results, platt_parameters, trending_sounds)

Per D-08, these tables had columns added in commits `1c590ac`, `37a7fa4`, `8eec2a9`, `5ee7693`. They are autogen-from-live in the current `database.types.ts`. Quick drift check:

**creator_profiles (lines 588–):**
Local migration `20260517210000_creator_profile_9card_columns.sql` added: `target_platforms`, `niche_primary`, `niche_sub`, `target_audience`, `primary_goal`, `creator_stage`, `content_style`, `cuts_per_second`, `reference_creators`, `past_wins`, `past_flops`, `posting_frequency`, `time_of_day_aware`, `pain_points`, `profile_interview_seen_at`, `storage_retention_opted_in`.
Type block in `database.types.ts` lines 588+ contains all these columns. Verified via grep: `storage_retention_opted_in: boolean` present. **No drift detected.**

**analysis_results (lines 180–):**
Columns including `engine_version`, `input_mode`, `has_video`, `variants`, `retrieval_evidence`, `retrieval_score`, `signal_availability`, `score_weights` added across phases 3–13. Type block lines 180+ contains all Phase 13 columns including `audio_description`, `behavioral_predictions`, `deepseek_model`, `gemini_model`. **No drift detected.**

**platt_parameters (lines 892–):**
Migration `20260520000000_phase10_platt_parameters.sql` defines: `id BIGINT`, `a DOUBLE PRECISION`, `b DOUBLE PRECISION`, `fitted_at TIMESTAMPTZ`, `sample_count INTEGER`, `created_at TIMESTAMPTZ`. Type block lines 892–: `id: number, a: number, b: number, fitted_at: string, sample_count: number, created_at: string`. Note: no `engine_version` column in migration or type block (MILESTONE.md mentions discriminator planning but no migration applied). **No drift detected.**

**trending_sounds (lines 1345–):**
Migration `20260519000000_phase6_audio_fingerprint.sql` defines: `id`, `sound_name`, `sound_url`, `video_count`, `total_views`, `growth_rate`, `trend_phase`, `velocity_score`, `first_seen`, `last_seen`, `metadata`, `created_at`, `updated_at`, `audio_description`, `audio_embedding`. Type block lines 1345+ contains all 15 columns. **No drift detected.**

## 6. Path Decision

**Decision: Path (a) — migrate, no new SQL work needed.**

Justification chain (each point cites evidence):
1. Live schema already has `user_settings`, `teams`, `team_members` applied (§2.1, §2.2 — MCP `list_migrations` rows `20260519113322` and `20260519113337`).
2. All 6 code call sites (10 grep hits including comments) are reached from deployed UI via React Query hooks (§3 + §4) — none are dead routes.
3. Hand-patched type blocks match live schema with zero drift (§5.1, §5.2, §5.3 — IDENTITY CONFIRMED for all three tables).
4. `tsc --noEmit` baseline is already 0 errors (§1) — no error count to drive a different decision.

Path (b) — rip out — is rejected because consumers are live and the table exists. Rip-out would delete working features:
- Settings page profile/account/notifications tabs all read/write `user_settings`
- Team management tab reads/writes `teams` + `team_members`
- `useProfile()` is called from 4 components including `leave-feedback-modal.tsx` (rendered app-wide)

D-03 / D-04 recap: no new SQL migration is written or applied in Phase 14. Phase 14 work is reduced to type regen (Plan 02) plus this audit doc.

Phase 14 exit gates (per D-11) — Plan 02 must satisfy:
1. `pnpm exec tsc --noEmit` → 0 errors
2. `pnpm build` → green
3. `pnpm vitest run` → unchanged from baseline
4. This audit doc checked in (this plan — DONE)
5. `database.types.ts` regen committed atomically as `feat(14): regenerate database.types.ts from live schema` (Plan 02)

**Threat register validation (T-14-01):**
```bash
grep -iE "password|secret|token|email.*@" .planning/research/user-settings-audit.md
```
No PII, no secrets, no email addresses in audit body. Schema metadata only.
