# Phase 14: Type Hygiene & user_settings Resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 14-type-hygiene-user-settings-resolution
**Mode:** User delegated to Claude ("do research, analyze and decide yourself") — auto-flow with live-state research before locking decisions.
**Areas discussed:** Baseline truth, Migration application, Type regen + commit, Audit artifact

---

## Pre-discussion research

Before presenting gray areas, Claude scouted:
- `grep user_settings src/` → 9 hits across `src/app/api/{profile,settings}/*` + `src/types/database.types.ts`
- `grep '/api/profile|/api/settings|/api/team' src/hooks src/lib src/components` → 11 hits in React Query hooks (use-profile, use-team, use-creator-profile)
- `pnpm exec tsc --noEmit` on `milestone/engine-hardening` HEAD → **0 errors** (contradicts MILESTONE.md's 966-error baseline)
- Read local migration `supabase/migrations/20260217100000_user_settings.sql` → defines table, 3 RLS policies, avatars bucket, 3 storage policies
- Confirmed `database.types.ts` is hand-patched (1820 lines, no autogen header)

This research compressed the gray-area set from "8 open decisions" to "4 worth confirming."

## Gray area presentation

| Area | Description | Selected |
|------|-------------|----------|
| Baseline truth | tsc reports 0 errors locally but milestone says 966. Real baseline + verification? | (delegated) |
| Migration application | apply_migration MCP vs `supabase db push` vs Studio | (delegated) |
| Type regen + commit | `supabase gen types --linked` overwrite, diff review, hand-patch drop strategy | (delegated) |
| Audit artifact | Formal `.planning/research/user-settings-audit.md` vs inline notes | (delegated) |

**User's choice:** "do research, analyze and decide yourself" — single-pass auto mode triggered.

## Post-delegation research (Supabase MCP)

| Tool call | Finding |
|-----------|---------|
| `list_migrations(qyxvxleheckijapurisj)` | `20260519113322 user_settings` and `20260519113337 teams` are APPLIED on live |
| `list_tables(public)` | `user_settings`, `teams`, `team_members` exist on live (0 rows each) |
| `information_schema.columns` query | Live column shapes match hand-patched types column-for-column for all three tables |
| `git log -- src/types/database.types.ts` | Last regen at commit `1c590ac` (Phase 6); subsequent hand-patches at `37a7fa4`, `39cadb3`, `8eec2a9`, `5ee7693` |

## Decisions locked (see CONTEXT.md for full text)

- **Baseline:** 0 errors confirmed. 966-figure is stale. TYPES-05 is verified-met at baseline; re-run after every cleanup commit.
- **Path:** (a) migrate confirmed. Live migration already applied. No new SQL work.
- **Migration application:** N/A — already done. If planner thinks otherwise, treat as deviation.
- **Type regen:** `pnpm exec supabase gen types typescript --project-id qyxvxleheckijapurisj` (project-id form, not `--linked`); single atomic commit; diff review before commit; do not re-add hand-patches if regen drops a field — file as deviation instead.
- **Audit artifact:** Required. `.planning/research/user-settings-audit.md` with 9 call sites + reachability + column-level live diff + migration list proof + path decision recap.
- **UAT:** Deferred to Phase 18 (VERIF-01 / VERIF-03).

## Claude's Discretion

- Audit doc structure beyond the required content checklist
- Plan split decision (1 vs 2 plans) — planner choice based on regen diff size
- Whether to add a smoke test for any consumer surfaced by regen as broken (not required)

## Deferred Ideas

- E2E UAT of profile/settings/team UI surfaces → Phase 18
- Local migration filename vs live version stamp reconciliation → cosmetic, defer
- CI guard against hand-patched `database.types.ts` → future tech-debt todo
- Avatars bucket quota/cost tracking → future hardening phase
