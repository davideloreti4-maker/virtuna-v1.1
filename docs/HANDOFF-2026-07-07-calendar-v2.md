# Handoff — /calendar v2: real drag/tap content planner (2026-07-07)

**Status:** ✅ SHIPPED to `main` (PR — see below). Migration LIVE on prod Supabase. Fully browser-verified.
**Worktree:** `~/virtuna-explore-c` (was branch `feat/calendar-v2`, off `lane/explore-c` == `origin/main`).
**Author session:** rebuilt `/calendar` from a read-only projection into a real, persisted planner; wired `/start` to the same source.

---

## 1. What changed (the one-paragraph version)

`/calendar` was a **read-only illusion**: `buildLivePlan` deterministically projected the day's ranked ideas onto upcoming days (idea[0]→today+1, idea[1]→today+3…). You couldn't schedule, move, or persist anything; future months were always empty. It's now a **real content calendar**: the creator drags or taps pre-tested ideas (the `/start` ideas cache) onto days, and each placement is **snapshotted** into a new `planned_posts` table so it survives the rolling 18h ideas-cache churn. `/start`'s month widget + "Your plan" now read the SAME `planned_posts`, so the two surfaces agree.

## 2. The model

- **A scheduled post** = a warmed idea (`LiveIdeaCard`, `contentId` like `idea-N`) frozen onto a day: `{scheduled_date, content_id, title, format, personas}`.
- **Backlog "Ideas" pool** = today's cached ideas whose `content_id` ∉ `planned_posts`.
- **"Scheduled" tab** = the `planned_posts` rows, soonest first.
- **Schedule** = insert · **Move** = update `scheduled_date` · **Unschedule** = delete (idea returns to the pool if still cached).
- **Honesty spine:** tone / stop-rate / verbatim reaction all derive from the row's **frozen `personas`** via `personasToCardFace`; "See the room" replays that exact cast. The reaction is real; the DAY is the creator's choice.
- **Best-slot rings:** picking up an idea rings Maven's recommended days — `recommendedDays` heuristic (fill upcoming gaps keeping a ~2-day cadence). Labeled guidance; a real best-time-to-post engine swaps in later with no schema change.
- **Two-state** (Idea → Scheduled). `status` column is `CHECK IN ('scheduled','draft')` so a Draft state is addable without a migration.

## 3. Database (⚠️ migration ALREADY APPLIED to prod)

Project `virtuna-v1.1` / `qyxvxleheckijapurisj`. Table `public.planned_posts`:
- Columns: `id, user_id, scheduled_date (date), content_id (text), title, format (CHECK Reel|Carousel), personas (jsonb), status (CHECK scheduled|draft), created_at, updated_at`.
- **own-rows RLS** (`auth.uid() = user_id`), `UNIQUE(user_id, content_id)` (re-scheduling an idea moves it, never double-books), index `(user_id, scheduled_date)`.
- Migration file `supabase/migrations/20260707120000_planned_posts.sql` mirrors what was applied.
- **Test data:** the e2e test user (`e2e-test@virtuna.local`) has ONE real scheduled post (`idea-0` on 2026-07-08) left as living proof. Harmless; delete with `delete from planned_posts where content_id='idea-0'` if you want a clean slate.

## 4. Files

**New**
- `supabase/migrations/20260707120000_planned_posts.sql` — the table.
- `src/lib/planned-posts/planned-posts-repo.ts` — repo (`listPlannedPosts`, `upsertPlannedPost`, `movePlannedPost`, `deletePlannedPost`). Untyped-client cast (not in `database.types.ts`, mirrors pillars/account-posts).
- `src/app/actions/planned-posts/actions.ts` — `schedulePost` / `movePost` / `unschedulePost` server actions (RLS user client, input validation, `revalidatePath` /calendar + /start).
- `src/lib/calendar/planned-plan.ts` — PURE: `buildPlannedPlan`, `recommendedDays`, `cadenceNext7`, `nextPlanned`, `labelWhen`, `toISODate`, `plannedToWidgetDays`, `plannedToList`. Fully unit-tested.
- `src/lib/calendar/__tests__/planned-plan.test.ts` — 13 tests.
- `src/components/calendar/up-next.tsx` — the up-next hero.
- `src/components/calendar/backlog-rail.tsx` — Ideas/Scheduled tabs + cards.

**Rewritten**
- `src/components/calendar/calendar-workspace.tsx` — orchestrator (optimistic writes → actions, placement mode, drag payload ref).
- `src/components/calendar/month-grid.tsx` — placement mode + drag + tap + real `PlannedPost`.
- `src/app/(app)/calendar/page.tsx` — loads `listPlannedPosts` (current month onward).
- `src/app/(app)/start/page.tsx` — loads `initialPlanned` (skipped for first-run).
- `src/components/surfaces/start-page.tsx` — widget + today's-plan now from `buildPlannedPlan`; `roomFocusFor` falls back to the plan's frozen personas.

**Deleted:** `src/components/calendar/day-detail.tsx` (v2 has no separate day-detail panel).
**Touched:** `src/components/reading/__tests__/reskin-matte.test.ts` (guard list: dropped day-detail, added up-next + backlog-rail).

## 5. Verification (all green)

- `tsc --noEmit`: clean.
- vitest: planned-plan 13/13; regression (calendar + surfaces/month-plan + reskin-matte) 66/66.
- Browser (logged in as e2e user, dev :3003): tap idea → rings 8/10/12 → tap day 8 → schedules → up-next + counts update → **reload persists from DB** (row confirmed, 10 personas frozen). `/start` widget shows "1 planned", "Your plan" lists the real Jul 8 post — matches /calendar. **0 console errors** on both surfaces.

## 6. Deferred (intentionally — flagged to owner)

1. **idea→pillar classification** → a pillar-filter on the backlog + pillar tag on scheduled cards. `LiveIdeaCard` carries no pillar today; real tagging means touching the ideas-generation pipeline (engine surface) for a ~4–6 item pool → low value now. The pillar *rail* still works as a Make-handoff.
2. **Real best-time-to-post engine** — `recommendedDays` is a ~2-day heuristic. A real model (from the creator's engagement history) is milestone-sized; swaps in behind the same signature.
3. **Generate-into-backlog** for the gap pillar — the gap CTA currently launches a Make thread (today's seam), not an instant new tested card.
4. **Drafts as a 3rd state** — owner chose two-state; `status` enum already extensible.
5. **Dead code:** `src/lib/surfaces/month-plan.ts` `buildLivePlan`/`planToWidgetDays`/`planToList` are now unused (its TYPES `LivePlannedPost`/`WidgetDay` are still used by the section components). Left in place; safe to prune + relocate the two types in a cleanup pass.
6. **`/start` day deep-link:** `MonthCalendar` still pushes `/calendar?day=N`; the v2 `/calendar` ignores `?day` (no day-detail panel to pre-select). Harmless — opens the calendar.

## 7. How to continue from this worktree

After the merge, `~/virtuna-explore-c` is synced to `main` (the calendar work is in). Cut a new short branch off `main` for the next thing:
```
cd ~/virtuna-explore-c
git fetch origin && git checkout lane/explore-c && git merge --ff-only origin/main   # or: git switch -c feat/<next>
```
Dev server: `NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3003` (direct node, not npx). Login: `e2e-test@virtuna.local` / `e2e-test-password-2026`.

Sketch artifacts (throwaway) live in `.sketch/` (gitignored).
