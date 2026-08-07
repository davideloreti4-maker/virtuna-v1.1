# Worktree inventory & retirement ledger (ARCHIVED)

> ⚠️ **STALE — snapshot of 2026-07-30, moved out of `CLAUDE.md` on 2026-08-07.**
> It does not list the `slot-a` / `slot-b` / `slot-c` worktrees added later.
> Re-measure with `git worktree list` + `git cherry -v main <branch>` before trusting any row.
> Kept for the *reasoning* it records (how to tell a dead branch, which branches are
> superseded and must never be merged) — not for the inventory itself.

**Live inventory — re-measured 2026-07-30 (11 worktrees, down from 15).** Counts are `git cherry main <branch>`
(**patch-id**, so a lane whose work merged reads 0 even when its tip looks ahead). ⚠️ Do NOT use
`git rev-list --count main..br` for this — it counts rebased/merged commits as unmerged.

| Path | Branch | Role |
|------|--------|------|
| `~/virtuna-v1.1/` | `main` | **Trunk / command center.** Stays on `main` (✅ synced to `origin/main` 2026-07-30, tip `a6b8a0e5` — PR #406 priced `/api/account-read` at 5 credits and gated it; PR #407 below it reactivated Discover + Library). tsc 0 errors; prod deployment `dpl_AtNJQ95d` serves this exact sha. Never holds a long-lived branch. |
| `~/virtuna-onboarding/` | `milestone/onboarding` | 2 unique (2026-07-27). #387/#388 landed the demo entitlement + /go rebuild. ⚠️ **the old "carries ~1.4k uncommitted lines of /go-v2 work" note was TRUE on 2026-07-27 and is now FALSE** — verified clean 2026-07-29. Owns port 3000. |
| `~/virtuna-audience-sim-v2/` | `feat/audience-sim-v2` | 20 unique (2026-07-17). Audience simulation v2 — verify against the shipped ambient-v2 before reviving. |
| `~/virtuna-e2e-audit/` | `audit/e2e-walkthrough` | 17 unique, **docs only** (2026-07-26). The 3 code blockers (F-019/F-017/F-021) already landed on `main`. |
| `~/virtuna-thread-cards/` | `feat/thread-cards` | 12 unique (2026-07-21). |
| `~/virtuna-explore-b/` | `feat/per-persona-ideas-script` | 3 unique (2026-07-16). |
| `~/virtuna-grounding-tools/` | `feat/grounding-reference-cards` | 2 unique (2026-07-20). One of a 5-branch grounding cluster; the rest are branch-only, no worktree. |
| `~/virtuna-polish/` | `polish/cards-next` | 2 unique (2026-06-27). |
| `~/virtuna-start-composer/` | `design/start-composer-v2` | 2 unique (2026-07-20). |
| `~/virtuna-ui-opt/` | `milestone/ui-opt` | 2 unique (2026-06-01) — stale, candidate for retirement. |
| `~/virtuna-prod/` | `docs/handoff-make-card-polish` | 1 unique (2026-07-27, incl. archived p4-live sketches). |

**Retired 2026-07-30** (worktree folder removed, **branch + commits kept** and confirmed on `origin`):
`feat/price-account-read` (~/virtuna-composer — **PR #406 MERGED `a6b8a0e5`**, lane complete) ·
`lane/platform-surface` (~/virtuna-platform, #402) · `docs/pillars-handoff` (~/virtuna-the-room) ·
`docs/handoff-read-family-cards` (~/virtuna-explore-c). All four verified before removal: 0 unique
by `git cherry`, clean tree, no stashes, tip == `origin/<branch>`. ~7.5 GB reclaimed.

> 🔑 **`comm -13` "branch-only files" do NOT block a retirement.** All four listed
> `src/app/(app)/discover/discover-client.tsx` + `loading.tsx`, and the two docs lanes listed 14–31
> more (`components/thread/*-thread-view.tsx`, `lib/billing/record-reading.ts`, …). Every one is a
> file **`main` deleted** — the branch is simply older. `comm -13` answers "what does the branch
> still have", never "what has main not got"; only `git cherry` answers the second. Corroborate a
> surprising list against `git log --diff-filter=D` on `main` before concluding work is stranded.
>
> ⚠️ `git worktree remove` deletes the **gitignored** files too — `.env.local` above all, which is
> on no branch and in no backup. Copy it out first. (The four removed here each differed from
> trunk's: composer + platform carried `NEXT_PUBLIC_AMBIENT_V2=true`, the two docs lanes were
> missing the three `GROUNDING_*` flags. Backed up to the session scratchpad 2026-07-30.)
> ✅ **Trunk's `.env.local` now carries `NEXT_PUBLIC_AMBIENT_V2=true` (added 2026-07-30).** It did
> not, while production has had the flag ON since 2026-07-29 — so trunk dev rendered the LEGACY
> room against a v2 prod, and the only worktrees holding the flag were the two just retired.
> `NEXT_PUBLIC_*` inlines at BUILD time: restart the dev server (and clear `.next/`) after touching it.
> ⚠️ `~/virtuna-platform` failed its `rmdir` and left ~1.8 GB on disk **after** git had already
> deregistered it — `git worktree list` said gone while the folder was still there. Check the
> filesystem, not just the list.

**Retired 2026-07-27** (worktree removed, **branch + commits kept** in `.git`): `lane/refine` · `lane/billing-prod` · `lane/launch-prep` · `lane/shell` · `lane/frame` · `lane/cursor-ui` · `lane/maven-offer` · `lane/skill-cards-prod` · `fix/whop-api-drift` · `milestone/numen-gsi` · `milestone/numen-surface` · `milestone/numen-landing` · `milestone/numen-tools` · `milestone/landing` · `milestone/viral-remix` · `milestone/viral-remix-adapt` · `milestone/ambient-room-v2` · `reconcile/reading-pr19` · `verify/main-state` · `final-verify` · 3 spikes · `rework/engine-core` (idle) · 3 superseded audience branches (below).

> ⚠️ **Three audience branches are SUPERSEDED — never merge them.** `feat/audience-brain-panel`
> (324 behind), `design/ambient-audience-ui` (264 behind), `design/audience-rework` (245 behind,
> PR #343 **closed** 2026-07-27). Their work shipped via **#339** (ambient audience production
> pass), **#317** (Audience rebuild) and **#312**; every file existing only on them was *deliberately
> deleted* from `main`. Merging would resurrect ~51k lines of dead code. Branches retained for history.
>
> ⚠️ **`lane/door-arm` is SUPERSEDED — never merge it (2026-07-29).** It holds the *duplicate*
> phases 5+6 of the ＋door lane, built by a second session at the same hour as the version that
> shipped. `main` took the OTHER implementation (`69414a16`) and then reconciled the difference in
> PR #403 (`407741a1`), whose own message settles it: *"Everything else that session shipped is
> better and stands; this is only the delta."* Merging would resurrect the rejected build. Its one
> branch-only file (`dev/cards/__tests__/room-simulate.test.tsx`) is superseded coverage — `main`
> tests the same component at `audience-lens/v2/__tests__/sim-door.test.tsx`. Retained for history,
> and because §0.1 of the ＋door handoff cites it.
>
> **Also superseded, retained for history:** `lane/composer-chrome` (shipped as `6392ff85`; its
> branch-only `composer-ask-credit-wall.test.tsx` covers the composer `ask` verb that **#398
> deleted** — the path no longer exists on `main`), `lane/composer-pill` (shipped as #398
> `5006f9c3`, zero branch-only files), `verify-main` (docs only).
>
> **Deleted 2026-07-29** — the only two that were provably lossless (`git cherry` showed every
> commit already in `main` by patch-id): `fix/thread-stop-double-run` · `docs/lane2-preconditions`.
> Everything else keeps its branch: the house rule is retire the WORKTREE, keep the commits.
>
> 🔑 **How to tell if a branch is dead:** `git diff --stat main...br` (three-dot) shows what the branch
> *added since it forked* — it says NOTHING about whether `main` already has it, and reads as huge
> pending work when the branch is actually stale. Two-dot `git diff main br` is no better: it reports
> main's own newer code as giant DELETIONS, so a merged lane looks like it is removing 5k lines.
> **The sharp tool is `git cherry -v main <branch>`** — patch-id, so `-` means "already in main"
> regardless of rebase or squash. Corroborate a `+` with `comm -13` of the two `git ls-tree` file
> lists (what exists ONLY on the branch) and a title grep against `git log main`; a lane that merged
> via PR reads `+` purely because merging shifted its patch-ids.
>
> Canonical historical map: `docs/WORKTREE-DEBT-LEDGER.md` (tracked, full branch survey) — note it
> predates this reconcile and still lists the retired worktrees above.
