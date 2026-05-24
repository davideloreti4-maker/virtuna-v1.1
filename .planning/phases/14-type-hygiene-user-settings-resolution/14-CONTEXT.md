# Phase 14: Type Hygiene & user_settings Resolution - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Drive `pnpm exec tsc --noEmit` to 0 errors across the entire app (not just `src/lib/engine/`), log the `user_settings` decision (real table vs dead consumer), and remove hand-patched types so `database.types.ts` is a faithful generation from the live Supabase schema.

**Live-state finding that compresses scope:** all three "missing" tables already exist on the live project `qyxvxleheckijapurisj` and `pnpm exec tsc --noEmit` already returns 0 errors on this worktree. Phase 14 is now a verification + cleanup phase, not a "write migration + fix 966 errors" phase. Plans must lead with re-establishing baseline truth and gating on it; the original 966-error baseline in MILESTONE.md / REQUIREMENTS.md is stale and must be footnoted, not relied on.

</domain>

<decisions>
## Implementation Decisions

User delegated decisions to Claude after live-state research (Supabase MCP + `tsc --noEmit` + git history). Decisions below are locked unless the user objects.

### Baseline Truth (TYPES-05)
- **D-01:** `tsc --noEmit` baseline is **0 errors** on `milestone/engine-hardening` HEAD as of 2026-05-24. The 966-error figure in MILESTONE.md and REQUIREMENTS.md is a stale carry-forward from a pre-`bbb4e81` snapshot. Plans must re-run `tsc --noEmit` at the start of the first plan and capture the actual baseline in `.planning/research/user-settings-audit.md` — TYPES-05 is verified-met, not work-to-do.
- **D-02:** Acceptance gate for TYPES-05 is `pnpm exec tsc --noEmit` returning 0 errors after types regen + any cleanup commits, not just at baseline. Re-run after every commit that touches `database.types.ts` or `src/app/api/{profile,settings,team}/*`.

### Path Decision (TYPES-02)
- **D-03:** **Path (a) — migrate** is confirmed. The migration `supabase/migrations/20260217100000_user_settings.sql` is the local source of truth; live Supabase has already applied it as version `20260519113322 user_settings`. Path (b) — rip out — is rejected on evidence that all routes are reached by React Query hooks (`src/hooks/queries/use-profile.ts`, `use-team.ts`, `use-creator-profile.ts`).
- **D-04:** No new migration work needed. `teams` (`20260519113337`) is also live. Phase 14 does not write or apply a single new SQL migration; if planner concludes otherwise, surface that as a deviation before acting.

### Audit Artifact (TYPES-01)
- **D-05:** Produce `.planning/research/user-settings-audit.md`. Must include:
  - All 9 grep hits enumerated with file + line
  - Per call site: reachable-from-deployed-UI marking, fields touched, breakage if table absent
  - React Query hook → API route → table column trace for `use-profile`, `use-team`, `use-creator-profile`
  - Live Supabase migration list (output of `supabase__list_migrations` for project `qyxvxleheckijapurisj`) proving `user_settings` + `teams` + `team_members` exist
  - Column-level diff between hand-patched `database.types.ts` block (lines 1166–1226, 1479–1521) and live `information_schema.columns` query — confirms identity
  - Final path decision recap
- **D-06:** The audit doc is the primary deliverable for TYPES-01. Inline notes in CONTEXT.md or commit messages do not satisfy the requirement.

### Type Regeneration (TYPES-03)
- **D-07:** Regenerate `src/types/database.types.ts` with the Supabase CLI: `pnpm exec supabase gen types typescript --project-id qyxvxleheckijapurisj > src/types/database.types.ts.new` then diff vs current file, commit only after diff review. Do not use `--linked` (unsafe — relies on local `supabase link` state not committed to repo).
- **D-08:** Hand-patched blocks to verify are absorbed by regen: `team_members` (1166), `teams` (1207), `user_settings` (1479). Also re-check `creator_profiles`, `analysis_results`, `platt_parameters`, `trending_sounds` columns (added at `1c590ac`, `37a7fa4`, `8eec2a9`, `5ee7693`) — these are autogen-from-live now but may have drifted if any column was added/altered post-`9794ffa`.
- **D-09:** If regen drops a field the consumer code uses (audit will detect this), do NOT re-add the hand-patch. Either add the missing column via migration (preferred — proves the schema gap exists) or remove the consumer reference. Hand-patching is the failure mode this phase exists to kill.
- **D-10:** Regen step must be a single atomic commit: `feat(14): regenerate database.types.ts from live schema`. Diff lives in commit history; do not check in a `.new` file.

### Verification Gates (across requirements)
- **D-11:** Phase exit gates, in order:
  1. `pnpm exec tsc --noEmit` → 0 errors
  2. `pnpm build` → green
  3. `pnpm vitest run` → unchanged from baseline (no regression from type churn; not a coverage requirement)
  4. `.planning/research/user-settings-audit.md` checked in
  5. `database.types.ts` regenerated commit landed
- **D-12:** UAT against deployed app (verifying React Query hooks actually exercise the routes end-to-end) is **out of scope for Phase 14** and deferred to Phase 18 (VERIF debt closure). Phase 14 verifies type/schema integrity only; runtime exercise is VERIF-01's job.

### Claude's Discretion
- Exact wording / structure of `user-settings-audit.md` beyond the required content checklist (D-05).
- Whether to split the regen + cleanup into one plan or two — planner decides based on diff size when regen output is in hand.
- Test additions: not required by phase. If regen surfaces broken consumer code that already lacks coverage, planner may add a smoke test as part of the same plan, but no test-first mandate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + Requirements
- `.planning/MILESTONE.md` — Engine Hardening identity; "Stack decisions" block locks path (a) default and Qwen-only stack
- `.planning/REQUIREMENTS.md` §TYPES — TYPES-01..05 wording (note: 966-error baseline figure is stale; see D-01)
- `.planning/ROADMAP.md` §"Phase 14" — Goal, success criteria, depends-on graph

### Live Supabase Evidence (must reproduce during audit)
- Supabase MCP — project_id `qyxvxleheckijapurisj`
  - `list_migrations` — proves `20260519113322 user_settings` and `20260519113337 teams` are applied
  - `list_tables(schemas=["public"])` — proves `user_settings`, `teams`, `team_members` exist
  - `information_schema.columns` query for the three tables — proves hand-patched columns match live schema

### Local Migration Source of Truth
- `supabase/migrations/20260217100000_user_settings.sql` — local filename; live version-stamped `20260519113322`. Defines table + 3 RLS policies + `avatars` storage bucket (2MB, image mimes only) + 3 storage policies.
- `supabase/migrations/20260217200000_teams.sql` — local; live `20260519113337`. Teams + team_members.

### Type Surface
- `src/types/database.types.ts` — 1820 lines, no autogen header. Hand-patched blocks at:
  - Lines 1166–1226 (`team_members`, `teams`)
  - Lines 1479–1521 (`user_settings`)
- Plus other manually-merged blocks from prior phases (Phase 6 audio fingerprint, Phase 8 pgvector, Phase 10 platt, Phase 11 retention, Phase 13 Qwen migration) — verify by full-file regen diff.

### Consumer Surface (the "9 grep hits")
- `src/app/api/profile/route.ts` — GET + PATCH; `user_settings` upsert at line 100, fetch at line 31
- `src/app/api/profile/avatar/route.ts` — `user_settings.avatar_url` update at line 61
- `src/app/api/settings/notifications/route.ts` — uses `UserSettingsInsert` typedef + upserts notification flags
- `src/hooks/queries/use-profile.ts` — React Query hooks calling `/api/profile`, `/api/profile/avatar`, `/api/settings/notifications`, `/api/settings/account/password`
- `src/hooks/queries/use-team.ts` — `/api/team`, `/api/team/invite`, `/api/team/members/[id]`
- `src/hooks/queries/use-creator-profile.ts` — `/api/profile/creator-profile`

### Supabase CLI
- `package.json` — confirm `supabase` is a devDependency (STACK.md says yes, v2.74.5)
- `npx supabase gen types typescript --project-id qyxvxleheckijapurisj` — type generation invocation. Requires access token; user must have `SUPABASE_ACCESS_TOKEN` env or be logged in via `supabase login`.

### Codebase Maps
- `.planning/codebase/STACK.md` §Database — Supabase 2.74.5 CLI, auto-generated types pattern, RLS enabled
- `.planning/codebase/STRUCTURE.md` — locate `src/app/api/` layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/server.ts` (assumed location per Next.js pattern) — server-side Supabase client for API routes; routes already use it
- React Query hooks pattern (`src/hooks/queries/use-*.ts`) — already the consumer layer; no rewiring needed
- Supabase CLI is a project devDependency (per STACK.md) — `pnpm exec supabase gen types` works without global install

### Established Patterns
- Type regen on schema change: prior phases (`1c590ac`, `37a7fa4`, `39cadb3`) regenerated `database.types.ts` after applying migrations. Same pattern applies here, but the trigger is "remove hand-patches," not "add columns."
- Migration naming: local files use stamped names (e.g., `20260217100000_user_settings.sql`); Supabase re-stamps on apply (`20260519113322`). Local + remote version mismatch is normal and not a sync bug.
- RLS-first: every user-scoped table has `auth.uid() = user_id` policies. `user_settings` migration follows this; no policy work needed.

### Integration Points
- API routes in `src/app/api/{profile,settings,team}/*` already import `Database` type from `src/types/database.types.ts`. Regen is transparent to them as long as column names match (they do — proven by live schema query).
- Avatars storage bucket is referenced by `src/app/api/profile/avatar/route.ts` (assumed). Migration creates the bucket; verify it exists on live via Supabase Studio or `storage.buckets` query as part of audit.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly delegated this discussion ("do research, analyze and decide yourself"). Live-state research drove every decision above. If the planner finds evidence contradicting any decision (e.g., a column drift the audit missed, a non-React-Query consumer in legacy code), surface it as a deviation per GSD protocol — do not silently rework scope.
- Phase 14's value-add post-research is small: it's a verification ceremony plus type cleanup. Plan accordingly — likely 2 plans max (audit doc + type regen), not 5+.

</specifics>

<deferred>
## Deferred Ideas

- **End-to-end UAT of profile/settings/team UI flows** — verifying React Query hooks actually render in the deployed app, on-screen edit succeeds, etc. Belongs in Phase 18 (VERIF-01 / VERIF-03 territory). Phase 14 verifies schema/type integrity only.
- **Migration history reconciliation** — local `20260217*` filenames vs live `20260519*` stamps. Cosmetic. No functional impact. Defer unless a future migration apply fails on order checks.
- **Hand-patch detection tooling** — a CI guard that fails if `database.types.ts` lacks the autogen header. Would prevent regression. Out of scope for Phase 14 (additive only per milestone rule); capture as a future tech-debt todo.
- **Avatars bucket cost/quota verification** — file size limit is 2MB per migration; no quota tracking on the bucket. Defer to a hardening phase if storage costs become a concern.

</deferred>

---

*Phase: 14-type-hygiene-user-settings-resolution*
*Context gathered: 2026-05-24*
