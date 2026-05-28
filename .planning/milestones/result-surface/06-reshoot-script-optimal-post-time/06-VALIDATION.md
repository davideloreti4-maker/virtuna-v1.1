---
phase: 6
slug: reshoot-script-optimal-post-time
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
revised: 2026-05-28
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (per `package.json` devDependencies) |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm test` (resolves to `vitest run`) |
| **Estimated runtime** | ~25-40 seconds for full suite at current footprint (~150 test files); Phase 6 file-scoped runs <5s each |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` `npx vitest run <path>` (or `npx tsc --noEmit` for type-only tasks). Phase 6 tasks all complete in < 10s individually.
- **After every plan wave:** Run `npm test` (full vitest sweep). Required at end of waves 1, 2, 3, 4 to catch cross-plan regressions.
- **Before `/gsd-verify-work`:** Full suite + `npx tsc --noEmit` both green.
- **Max feedback latency:** 40 seconds (full suite). 10 seconds (per-task).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 01 | 1 | R5.1, R5.3, R6.2 | T-06-01 / T-06-02 / T-06-03 | Additive idempotent migration; no RLS policy changes (inherits existing) | grep/file-existence | `test -f supabase/migrations/20260530000000_script_result.sql && test -f supabase/migrations/20260530000001_optimal_post_override.sql && grep -q "ADD COLUMN IF NOT EXISTS" supabase/migrations/20260530000000_script_result.sql && grep -q "ADD COLUMN IF NOT EXISTS" supabase/migrations/20260530000001_optimal_post_override.sql` | ❌ W0 (created in task) | ⬜ pending |
| 06-01-T3 | 01 | 1 | R5.1, R5.3 | — | Pure functions; no import side effects; no app-layer imports | unit | `npx vitest run src/lib/script-utils.test.ts src/lib/optimal-post-time.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 06-01-T4 | 01 | 1 | R5.1, R5.3, R6.2 | T-06-05 | Constants extend (do not replace) TELEMETRY; verbatim copy strings per UI-SPEC | type-check + grep | `npx tsc --noEmit -p tsconfig.json` (filter to script-types/script-constants/optimal-post-constants/actions-constants files) + acceptance-criteria greps | ❌ W0 (created in task) | ⬜ pending |
| 06-02-T1 | 02 | 2 | R5.1, R5.3 | T-06-06 / T-06-07 / T-06-08 / T-06-09 / T-06-10 / T-06-13 | Zod params before auth; .eq('user_id', user.id) defense-in-depth; service-client only writes to verified-owned id; engine-version skew forces recompute | type-check + grep | `npx tsc --noEmit -p tsconfig.json 2>&1 \| grep "src/app/api/analyze/\[id\]/script" \| head -10` + grep gates from acceptance criteria | ❌ W0 (created in task) | ⬜ pending |
| 06-02-T2 | 02 | 2 | R5.1, R5.3 | T-06-06 / T-06-07 / T-06-08 / T-06-09 / T-06-10 / T-06-12 | 10-case matrix covers: auth gate (T-06-06), id Zod (T-06-07), 404-unification (T-06-08), engine-version-skew (T-06-10), write-error-swallow (T-06-12) | integration | `npx vitest run "src/app/api/analyze/[id]/script/__tests__/route.test.ts"` | ❌ W0 (created in task) | ⬜ pending |
| 06-03-T1 | 03 | 2 | R6.2 | T-06-14 / T-06-15 / T-06-16 / T-06-16b / T-06-17 / T-06-18 / T-06-19 | Discriminated-union body (SET + CLEAR per D-27); ParamsSchema before auth (T-06-15); z.literal(true) for CLEAR (T-06-16b); .eq('user_id', user.id) defense-in-depth (T-06-17); generic error codes (T-06-18) | type-check + grep | `test -f "src/app/api/analyze/[id]/optimal-post-override/route.ts"` + acceptance-criteria greps (ParamsSchema, ClearSchema, z.literal, z.union, optimal_post_override: null, refine, .eq user_id) + `npx tsc --noEmit` | ❌ W0 (created in task) | ⬜ pending |
| 06-03-T2 | 03 | 2 | R6.2 | T-06-14 / T-06-15 / T-06-16 / T-06-16b / T-06-18 / T-06-19 | 9-case matrix covers: Zod rejections (T-06-16, T-06-16b), auth gate (T-06-14), SET payload shape, CLEAR writes NULL per D-27, DB error 500, XSS guard (T-06-19), id-before-auth (T-06-15) | integration | `npx vitest run "src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts"` | ❌ W0 (created in task) | ⬜ pending |
| 06-04-T1 | 04 | 3 | R5.2, R5.3, NF2, NF4 | — | Telemetry fires only on user gesture (copy success); 44x44 tap target; phase-gated useScript (no fetch during streaming, prevents premature DB hit) | unit (component) | `npx vitest run src/components/board/actions/script/__tests__/CopyButton.test.tsx src/components/board/actions/script/__tests__/ScriptEmptyState.test.tsx` + `npx tsc --noEmit` | ❌ W0 (created in task) | ⬜ pending |
| 06-04-T2 | 04 | 3 | R5.2, R5.3, NF2, NF4 | T-06-21 / T-06-22 / T-06-23 | React text-node rendering (no dangerouslySetInnerHTML) (T-06-21); clipboard requires user gesture (T-06-22); Sheet onCloseAutoFocus returns focus (T-06-23); Copy-all GlassPill has NO onClick (no nested buttons) | unit (component) | `npx vitest run src/components/board/actions/script/__tests__/ScriptBody.test.tsx` + `npx tsc --noEmit` + `grep -B1 -A6 'absolute right-3 top-2' src/components/board/actions/script/ScriptBody.tsx \| grep -c 'GlassPill[^>]*onClick'` (must be 0) | ❌ W0 (created in task) | ⬜ pending |
| 06-05-T1 | 05 | 3 | R6.2, NF2, NF4 | T-06-27 / T-06-28 / T-06-29 | Mutation invalidates ['analysis', analysisId] on success; reasoning rendered as React text + title (T-06-27); source pill exposes N count which user already owns (T-06-28) | unit (component) | `npx vitest run src/components/board/actions/optimal-post/__tests__/OptimalPostSourcePill.test.tsx` + `npx tsc --noEmit` | ❌ W0 (created in task) | ⬜ pending |
| 06-05-T2 | 05 | 3 | R6.2, NF2, NF4 | T-06-25 / T-06-26 / T-06-26b / T-06-29 | Client TZ accepted as local-only spoof (T-06-25); SET payload constrained by day picker + hour selects + server Zod (T-06-26); CLEAR payload `{ clear: true }` has no user-controllable fields (T-06-26b); override mutation scoped to authenticated user via analysisId path (T-06-29); D-27 Reset writes NULL via `{ clear: true }`; D-29 source pill returns to engine source after Reset | unit (component) | `npx vitest run src/components/board/actions/optimal-post/__tests__/` + `npx tsc --noEmit` + `grep -q "mutateAsync({ clear: true })" src/components/board/actions/optimal-post/OptimalPostEditSheet.tsx` | ❌ W0 (created in task) | ⬜ pending |
| 06-06-T1 | 06 | 4 | R5.2, R5.3 | T-06-31 / T-06-32 | useScript phase-gated to phase === 'complete' (T-06-32 — no DB hit during streaming); result.id exposed via testid is no new exposure since already in URL (T-06-31) | grep + type-check | grep acceptance criteria (phase !== 'complete', useScript(analysisId, phase), data.is_empty_state, ScriptInspectorTrigger, AV_HEADLINE) + `npx tsc --noEmit` | ❌ W0 (created in task) | ⬜ pending |
| 06-06-T2 | 06 | 4 | R6.2 | T-06-32 / T-06-33 | Pre-complete phase keeps placeholder (no premature fetch — T-06-32); override prop forwarded from RLS-filtered SELECT (T-06-33) | grep + type-check | grep gates (actions-optimal-post-slot, actions-optimal-post-placeholder, OptimalPostCard) + `npx tsc --noEmit` | ❌ W0 (created in task) | ⬜ pending |
| 06-06-T3 | 06 | 4 | R5.2, R5.3, R6.2 | T-06-30 / T-06-33 | database.types.ts hand-patch documented + flagged for canonical regeneration (T-06-30); override forwarding via prop-only flow (T-06-33) | grep + type-check | grep gates (analysisId =, <ActionsReshootHeroSlot, analysisId={analysisId}, script_result, optimal_post_override) + `npx tsc --noEmit` | ❌ W0 (created in task) | ⬜ pending |
| 06-06-T4 | 06 | 4 | R5.2, R5.3, R6.2 | T-06-31 / T-06-32 | New behavior tests cover: pre-complete continuity (no premature fetch — T-06-32), AV chrome render, empty-state win over default slot | integration (component) | `npx vitest run src/components/board/actions/__tests__/ActionsNode.test.tsx` (all tests pass — existing + 3 new Phase 6 tests) | ❌ W0 (created in task) | ⬜ pending |

*Status legend:* ⬜ pending · ✅ green · ❌ red · ⚠️ flaky

*Note on `File Exists` column:* All files are created in their respective tasks (Wave 0 = "not yet built, task creates"). After task execution, this column flips to ✅.

*Note on checkpoint task (06-01-T2):* `[BLOCKING] Push Supabase schema migrations` is a `checkpoint:human-action` task. Verification is performed via the human-readable how-to-verify steps in the checkpoint (`supabase db push` succeeds + `information_schema.columns` query returns 2 rows). Not represented in the automated map above by design — checkpoint tasks are out of scope for Nyquist compliance per planner spec.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- `vitest` already installed (`package.json` line: `"vitest": "^4.0.18"`)
- `vitest.config.ts` present at repo root
- `@testing-library/react` already in use (existing component tests under `src/components/board/`)
- `npm test` script resolves to `vitest run`
- `npx tsc --noEmit` works against `tsconfig.json` at repo root
- `happy-dom` environment available (used by existing tests)
- Supabase migrations directory present (`supabase/migrations/`) with established `ADD COLUMN IF NOT EXISTS` precedent (`20260527000000_audience_overrides.sql`)

No new framework installation, test scaffolds, or shared fixtures required. Phase 6 creates its own per-task test files following established patterns from analog tests (`src/app/api/analyze/[id]/override/__tests__/route.test.ts`, etc.).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `supabase db push` applies both Phase 6 migrations to live DB | R5.1, R5.3, R6.2 | CLI invocation requires user's Supabase auth context (access token / login session) which cannot be embedded in automated tests; the schema is NOT applied just by writing the migration files | Per Task 06-01-T2 checkpoint: ensure `SUPABASE_ACCESS_TOKEN` is set OR run `supabase login`; from repo root run `supabase db push`; confirm both `20260530000000_script_result` and `20260530000001_optimal_post_override` are reported applied; verify via `supabase db diff` (no pending) AND `select column_name, data_type from information_schema.columns where table_name = 'analysis_results' and column_name in ('script_result', 'optimal_post_override');` returns 2 rows, both `jsonb`. |
| Visual: Copy-all pill renders without nested-button hydration warning in browser DevTools | R5.2, NF2 | Browser-only React hydration warnings; jsdom/happy-dom does not surface all SSR/CSR mismatches identically to real React renderer | After Plan 04 execution: `npm run dev`, navigate to a completed analysis, observe the ActionsReshoot AV state, open browser DevTools console — confirm no React warnings about `<button>` nested in `<button>`. Automated grep (`grep -c 'GlassPill[^>]*onClick'` around `'absolute right-3 top-2'` == 0) covers the static-code side; runtime visual check supplements. |
| Visual: TZ conversion produces correct local-time chip across DST boundaries | R6.2, NF2 | Real-world DST behavior depends on the user's runtime TZ + the reference date used; unit tests use a fixed 2024-01-01 Monday reference which falls in winter for all northern-hemisphere zones. Automated tests cover the conversion logic; visual check confirms acceptable behavior across actual DST transitions. | Manual check post-Plan-05 execution: in OS settings, switch TZ to a DST-observing zone (e.g., America/Los_Angeles), reload the app during a DST transition window if available; confirm the day/time chip changes hour offset appropriately. Document any DST edge cases in 06-05-SUMMARY.md. |

All other phase behaviors have automated verification (vitest unit/integration tests + tsc + grep gates).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every `type="auto"` task in plans 01-06 has a concrete `npx vitest run <path>`, `npx tsc --noEmit`, or grep-based command in its `<verify>` block (audited above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — confirmed (15 auto tasks all have automated commands; the 1 checkpoint task in 06-01 is sandwiched by 2 automated tasks)
- [x] Wave 0 covers all MISSING references — none MISSING; existing infrastructure suffices
- [x] No watch-mode flags — all commands use `npx vitest run` (single-shot) or `npx tsc --noEmit` (single-shot), never `vitest --watch` or `tsc -w`
- [x] Feedback latency < 40s — full suite ≤ 40s, per-task ≤ 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-28 (revision after checker feedback)
