# Open Debt Audit — 2026-06-29

> Point-in-time audit of OPEN technical debt across all Virtuna worktrees, taken after
> the `lane/shell` premium-thread initiative shipped (PRs #85, #88) and was verified
> running live on `main` (real-engine browser pass, 0 console errors).
>
> **Scope:** what is still open as of 2026-06-29. Excludes work already merged to `main`.
> Supersedes the stale survey baseline in `docs/WORKTREE-DEBT-LEDGER.md` (last reconciled
> 2026-06-26, predates PRs #71–#90). **Reconcile the ledger from this doc.**

---

## 🔴 Blocking

### 1. Production is stuck on the January init commit
- Vercel prod project `virtuna-v1.1` has exactly **one** production deployment ever:
  `dpl_EhDYbNekZSPLA6kHfmfxx7ZMUjvH`, created **2026-01-27**, from commit
  `f510cf0f` *"feat: initialize virtuna v1.1 project"* (the first commit).
- State READY, but ~5 months of merged work (v5.0, v6.0, discover-feed, every UI lane,
  **premium-thread**) is **NOT deployed**. GitHub→Vercel auto-deploy appears disconnected/paused.
- **Action:** investigate the GitHub integration — why no deploy fires on `main` push.
- Size: **L** · Owner: infra.

### 2. Rate-limiting (HARDEN-01) — pre-public-launch gate
- 6 tool routes unprotected; `src/app/api/tools/ideas/route.ts:117` has a voided TODO;
  only `analyze-chat` is wired.
- Size: **M** · gates public launch.

---

## 🟡 GSI Milestone — the headline active build

- Worktree `~/virtuna-numen-gsi` (branch `milestone/numen-gsi`). **~86% (6/7 phases).**
- Currently executing **Phase 07 — audience-as-front-door-surface** (mode-scoped skill menu),
  plan 2 of 6; 8 unpushed commits.
- Branch is **23 ahead / 206 behind `main`** → needs a main merge/rebase before completion.
- One uncommitted modified file `src/components/audience-lens/audience-presence.tsx`
  (`diff --stat` shows no net change — likely whitespace/no-op; verify or revert).
- ⚠️ Do NOT `git merge rework/engine-core` (that track is Phase 0, already on main).
- **Next:** finish Phase 07.

---

## 🟢 Engine (nice-to-have unless noted)

SSOT: `docs/DISSECTION-BACKLOG.md`. Dissection scope COMPLETE (16 FIXED + 5 RESOLVED). Remaining:

| ID | Item | File | Size |
|----|------|------|------|
| R3 | 0.5/0.5 video blend asserted, never calibrated | `aggregator.ts` | S |
| R5 | `wave0 confidence:1.0` fabricated; `applyCtaPenalty`/`FeatureVector` unused | — | S |
| E2 | 10-line audience-resolve block copy-pasted into ~7 tool routes → extract helper | tool routes | S |
| G3 | no-op stub | `cron/refresh-corpus/route.ts:23` | S |
| A6 | `(supabase as any)` casts throughout | `audience-repo.ts`, `cron/audience-drift` | S |
| A-T | target 3-position model (STEER via attributes; weights→REACT+REFINE) not implemented | — | M (feature) |
| S6 | `assertBlocksInRegistry` now caller-less after S4 cut → rewire vs cut | `block-registry.ts` | S |
| — | **Gen latency ~110s** — `qwen3.7-plus` generation is the E2E bottleneck (SIM half fixed S3′) | gen pipeline | L |
| — | Provider drift — competitor-intel `src/lib/ai/*` runs live on `deepseek-chat` + `gemini-2.5-flash-lite`; consolidation decision pending | `src/lib/ai/*` | M |
| G-D/M2 | RAG dead — `engine/retrieval/` + `engine/corpus/` entangled (~2.4K LOC); surgical cut deferred | engine | L |
| D-R1 | drop Read judgment fields → pure-sensor (atomic 5-file + version bump) | — | M |
| — | Optional hardening (low): bounded gen-retry backoff, SSRF bare-apex tighten (#9), apify try/catch (#8/#10) | — | S each |

---

## 🟢 Premium-thread (shell) — long-Generating UX gap

- **Symptom:** the progress spine parks on "Generating / Drafting against your audience" for
  the full ~52s of a hooks run, then flashes Self-judge → Simulating → Ranking in the final ms.
- **Cause (not a bug):** `src/app/api/tools/hooks/route.ts:186` — `runHooksPipeline` is one
  awaited call (GENERATE→SIM→GATE→RANK). The route emits `Generating: active` before it, then
  (comment at `route.ts:202–205`) emits the remaining stages back-to-back after it, because
  *"the runner doesn't expose per-phase callbacks."* All real latency buckets into one stage.
- **Clean fix:** cross-lane engine ask — per-phase callbacks / `detail?` field on the stage SSE
  for a live counter (memory `lane-shell-premium-thread` flags this as the ONLY deferred shell item).
- **Cheap client win:** cycle the sub-detail copy + show elapsed seconds during the Generating
  stage so it shows life (no faked stage completion — respects the D-02 "real not timed" rule).
- Size: S (client win) / M (engine callbacks).

---

## 🟢 Feed / Discover (lane merged #89 + #90; only stubs remain)

- **Hooks "from your analyzed videos"** — only curated seed + empty state shipped; real path needs
  the Phase-3 analyze pipeline (extract hook template from a scraped video). M, feature.
- **Channels "Describe" tab** — UI only; backend (describe→suggest service) stubbed. M.
- **Videos "Status / Analyzed" filter** — stub checkboxes; no analyzed-flag tracking yet. S/M.

## 🟢 Frame (all PRs merged; worktree clean)

- **video-card lucide → phosphor** (deferred = GSI seam). S.
- **ui/card + ui/select + ui/toast glass holdouts** — SHARED primitives, GSI-adjacent, deferred. M.
- **`format` save path** — speculative. S.

## 🟢 UI / Design

- **Part B per-persona reaction MODAL on the Read hero** — SIM-1 Max badge ships; only modal remains. M.
- **main eslint status uncertain** — ledger §3 flagged 39err/66warn from the UI merge; prep PR #67
  claimed →0err/29warn. Contradictory — re-verify on `main`. S.

---

## 🧹 Infra / Repo Hygiene

- **Trunk `~/virtuna-v1.1` main carries 1 unpushed auto-wip commit** `120ea41b`
  (*"chore(auto-wip): docs"*) on top of `origin/main`. Rule: trunk stays clean on origin/main.
  Push or drop it. S.
- **PR #60 (creator-voice) is CLOSED, not merged** — branch `feat/creator-voice-sample` is
  330 ahead / 76 behind (the un-mergeable monster). Re-extract clean during GSI grounding §4.3. M.
- **polish/cards-next has 3 stranded WIP commits** (auto-wip ×2 + `wip(account-read): densified
  text-patterns half + throwaway harness`). Memory says the skill-card lane fully shipped → decide
  prune vs resurrect. S.
- **Stale merged branches to prune (origin):** `feat/frame-library-cover-echo`,
  `fix/frame-empty-state-token`, `fix/frame-glass-confirm-dialog`, `fix/frame-token-hygiene`,
  `polish/account-read-tierc`, `polish/skill-cards`. S.
- **Squash-dangling worktrees to retire:** `~/virtuna-discover-feed` (`feat/feed-ui-refinement` = #90)
  + `milestone/discover-feed` (#89) — content on main, branches are just history. S.
- **Canonical ledger `docs/WORKTREE-DEBT-LEDGER.md` is STALE** — last reconciled 2026-06-26;
  omits 7 newer worktrees (cursor, discover-feed, frame, polish, shell, flash-spike, local-gemma),
  lists PR #60 as OPEN, says trunk needs `git pull`. Reconcile from this doc. S.
- **MEMORY.md over cap** — 25KB > 24.4KB; index truncated on load. Trim entries to one line. S.
- **Parked branches:** `fix/flash-coercion-stability` (mostly superseded by #56 — verify, then retire),
  `feat/chat-ethics-gate` (Chase Hughes; A/B inconclusive + cost flag; decision pending). S each.

---

## Contradictions vs memory (to fix when reconciling)

1. PR #60 (creator-voice) — memory/ledger say OPEN; actually **CLOSED unmerged** 2026-06-26.
2. `polish/cards-next` — memory says skill-card lane fully shipped; worktree holds **3 abandoned WIP commits**.
3. Ledger says trunk main is "stale, git pull needed" — actually **1 ahead** (auto-wip), 0 behind.
4. Ledger §6 ui-restrained Cursor worktree (`audience-presence.tsx`) — that worktree is **gone from
   `git worktree list`**; the same file now shows modified in the GSI worktree. Verify nothing was lost.

---

**Net:** only truly *blocking* items are the **stuck Vercel production deploy** and **rate-limiting**
before public launch. Everything else is polish, repo hygiene, or the in-flight **GSI Phase 07**.
