# Handoff — Content Pillars made real (2026-07-06)

Content pillars (the creator's recurring themes on the `/start · /calendar · /grow` rails) went
from all-mock fixtures to a **real end-to-end feature**. All merged to `main`. This is the
architecture + verification + what's left. Companion to memory `content-pillars-real.md` and the
reconciled `docs/THE-ROOM-DEBT-2026-07-06.md`.

## Shipped (5 PRs)

| PR | Commit | Phase | What |
|----|--------|-------|------|
| #193 | `bccedc01` | A | `account_posts` table + cron persists the captions it already scraped |
| #196 | `ae74d8ee` | B | `content_pillars` (frozen names) + `cluster.ts` (LLM naming/assignment) + FK |
| #197 | `409e7d67` | C | `buildContentPillars` SSOT + swap 3 surfaces + `MOCK_PILLARS` retired |
| #199 | `d34519b8` | Move 2 | propose→confirm `PillarConfirmCard` + tone baseline → mean |
| #200 | `56ef936b` | — | debt-doc reconcile |

## The pipeline (data flow)

```
daily cron (refresh-account-snapshots, 07:00 UTC, self-driving off account_snapshots)
  └─ clockworks scrapeVideos(handle)         ← already ran for recent_views; captions were discarded
  └─ upsertAccountPosts()                    → account_posts   (caption + engagement + posted_at)
  └─ clusterPillarsForUser()                 → content_pillars (frozen names) + account_posts.pillar_id
       ├─ first run  (no pillars, ≥8 posts): LLM names 3–6 themes + assigns every post
       └─ incremental (pillars exist):        LLM classifies ONLY unassigned posts into EXISTING names

server components (/start, /calendar, /grow)
  └─ buildContentPillars(userId)             → Pillar[]  (share/count/cadence/gap + engagement tone)
       └─ ContentPillars rail  (shared component; honest empty state when [])
       └─ PillarConfirmCard    (/start only, when anyUnconfirmedPillars → one-time review)
```

**One SSOT** (`buildContentPillars`) feeds all three surfaces so they agree.

## Key files

- `supabase/migrations/2026070613/14/15*.sql` — `account_posts`, `content_pillars` (+FK), `confirmed`
- `src/lib/account-metrics/account-posts-repo.ts` — `upsertAccountPosts` (idempotent, preserves `pillar_id`), `listAllPosts`, `assignPostsToPillar`
- `src/lib/content-pillars/pillars-repo.ts` — `listPillars` / `createPillars` (frozen names) / `anyUnconfirmedPillars`
- `src/lib/content-pillars/cluster.ts` — the LLM job (qwen3.7-plus, `enable_thinking:false`, index-based I/O, cost-gated)
- `src/lib/content-pillars/build-pillars.ts` — **pure** `buildPillars(pillars, posts, nowMs)` + async wrapper
- `src/app/actions/content-pillars/save-pillars.ts` — the confirm action (rename/remove/confirm)
- `src/components/surfaces/sections/{content-pillars,pillar-confirm-card}.tsx`

## Design decisions (locked)

- **Apify/clockworks only** — no OAuth/Composio (unavailable). The captions were already scraped daily.
- **Frozen names** — first-run names them; incremental only *classifies* new posts into existing names. Renaming reads as flaky, so names never re-word on their own.
- **Index-based LLM I/O** — posts shown as `[0]…[n]`, model returns indices → can't hallucinate TikTok ids.
- **Cost-gated** — the model runs only on first cluster or when unassigned posts exist; steady state = `noop`.
- **Tone** = per-post engagement rate `(likes+comments+shares+saves)/views`, pillar median vs the creator's own **mean** baseline; `loved`/`bounced` only on a clear **±25%** deviation, else neutral. Real signal, labeled `· Directional`.
- **Cadence** ignores pinned posts (they sit at top for months and would lie about recency).

## Verified

- **Pure-fn unit tests (7)** — share sums to 1, tone bands, cadence buckets, single-gap, pinned-excluded, honest-empty.
- **Live** on a seeded creator (30 real posts): clustered into 5 specific named pillars, 30/30 assigned, re-run `noop`; `buildContentPillars` → shares 100%, real cadence, single gap; confirm-action DB ops (rename/delete/confirm/flag) exercised non-destructively.
- tsc + lint + `next build` clean (no RSC/client-server leak).

## Not done (ranked next steps)

1. **Browser click-through of the confirm card** — data layer + compile verified, but the in-browser
   render→edit→confirm→dismiss was not run (needs a seeded logged-in user with unconfirmed pillars).
   Small Playwright pass; closes the one verification gap.
2. **Pillar *evolution* / periodic re-cluster** — the incremental classifier only assigns new posts to
   *existing* pillars; it never introduces a new theme or retires a dead one. A creator who pivots their
   content gets **stale pillars** over months. Add a periodic full re-cluster (or a "fits no pillar →
   propose a new one" path, gated by propose→confirm). This is the most valuable pillars-specific follow-up.
3. **Merge two pillars into one** — the confirm card ships rename + remove + confirm; merge (remove +
   reassign posts) was deferred.
4. **Tone feel** — for the seeded creator the rail reads mostly neutral/bounced (his real pattern). Watch
   how it reads for a creator with a clear standout theme once real users land; the band/baseline is a
   one-line knob in `build-pillars.ts`.

## Gotchas carried forward

- **auto-wip daemon** front-runs every commit in this worktree. Harmless (squash cleans), but: never
  reset/force-push under it; if a squash-merged base makes a branch's 3-dot diff misleading, cut a fresh
  branch off `origin/main` + `git checkout <old> -- <files>`; and merge with
  `gh pr merge --squash --subject "…"` so the auto-wip message doesn't become the squash subject (#197's did).
- **Supabase types** regen returns JSON-wrapped output over the tool token limit → extract `.types` via a
  short python slice and overwrite `src/types/database.types.ts`.
- **DashScope qwen** non-streaming needs `enable_thinking:false` or it times out (thinking mode).
