# Open Debt Audit — 2026-06-29

> Point-in-time audit of OPEN technical debt across all Virtuna worktrees, taken after
> the `lane/shell` premium-thread initiative shipped (PRs #85, #88) and was verified
> running live on `main` (real-engine browser pass, 0 console errors).
>
> **Scope:** what is still open as of 2026-06-29. Excludes work already merged to `main`.
> Supersedes the stale survey baseline in `docs/WORKTREE-DEBT-LEDGER.md` (last reconciled
> 2026-06-26, predates PRs #71–#90). **Reconcile the ledger from this doc.**
>
> **Companions:**
> - `docs/WORKTREE-MERGE-AUDIT-2026-06-29.md` — per-worktree git forensics (polish / shell / frame /
>   discover-feed / numen-gsi): exactly what landed vs missing, each item code-verified with `file:line`.
>   Verdict: all five lanes' code is on `main`; only `polish/cards-next` has unmerged (superseded) commits.
> - `docs/DEV-VERIFICATION-2026-06-29.md` — **live browser pass** (dev :3300, authed) confirming
>   working-vs-stub on the real app + screenshots (`docs/verification/`). It **corrects** this ledger where
>   the running app contradicted the static reads (notably: the feed filters/suggested work shipped in #90).
> - `docs/FINAL-AUDIT-PR-COMMIT-2026-06-29.md` — whole-history audit (80 merged / 4 closed-unmerged / 0
>   open PRs; 2968 commits; GSI 7/7 phases) + **honest doc/memory coverage attestation** (the ~2,300-file
>   per-worktree archive is settled/superseded; only #60 creator-voice is real unshipped work).
> - `docs/HANDOFF-NEXT-SESSION.md` — **fresh-session pick-up doc** + the **"merged-but-not-visible-in-UI"**
>   catalog (mode-gated GSI verbs · routes not in nav · stubs · not-built · the 3× Marcus-Reyes dup). Start here.

---

## ✅ CLOSED — refine-lane session 2 (2026-06-30)

Shipped to `lane/refine` (pushed to `origin/lane/refine`, tip `e0e06dba`; NOT yet merged to main):

1. **Merged-but-not-visible buckets A + B (nav/visibility)** — the owner's main concern, mostly resolved:
   - **GSI verbs surfaced** (`4a5748b5`) — `composer-controls.tsx` now shows Profile/Simulate/Predict in an
     always-visible **General** group regardless of audience mode (new shared `isSkillVisible()`; slash menu
     reuses it). Browser-verified. Selecting Simulate/Predict without a General audience still funnels to
     Build (§16.4) — unchanged, matches the Home chips.
   - **`/discover` → `/feed` redirect** (`f508a6df`) — was a live duplicate of `/feed`; now `redirect("/feed")`
     mirroring `/saved`→`/library`. `DiscoverClient` + `/api/discover` left for a later sweep.
   - **Competitors / Partnerships / Referrals into the sidebar** (`2c139870`, `Sidebar.tsx`) — the 3 orphan
     routes (no nav entry) now surfaced with phosphor icons; all 3 browser-verified to render. `/saved` was
     already a redirect to `/library` (handoff was stale on that — no action needed).
2. **Theme C dead-glass deleted** (`6be82815`) — `GlassToast` + `GlassSkeleton` (+ `SkeletonText`/`SkeletonCard`)
   removed + barrel + stale `skeleton.tsx` comment. Zero consumers confirmed. *(See §Shell Theme C — the
   inset-shine MATTE items remain.)*
3. **3× Marcus Reyes dedup** (`e0e06dba`) — root-cause fix `upsertProfileAudience()` (find caller's own
   same-name General SIM → update-in-place, else create; sentinel/virtual rows excluded), wired as
   `runProfile`'s default save; +5 tests. Prod DB cleaned: deleted the 2 stale orphans (none FK-referenced),
   kept newest `fb6047a7`.

⚠️ **CORRECTION — the "Dead-file delete `ai/{deepseek,gemini}.ts`" item below is WRONG; do NOT delete.**
Code-verified this session: `src/lib/ai/intelligence-service.ts:14-15` imports both, and it is **live** via
`/competitors/[handle]` + `/api/intelligence`. The audit self-contradicted (§Engine: "runs live" row vs
"no importers → remove" row). Deleting breaks the build + the competitors-intel feature. The only real item
there is **provider consolidation** (the M-sized row), not a delete. Both prior session debt-dumps repeated
the false "no importers" claim — it is hereby retired.

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

## 🟠 Production hardening — open GitHub issues #7–#12

All **OPEN** (live-verified 2026-06-29). Real bugs, none GSI-blocking; do before public launch (or
opportunistically when touching the file). The 🟠 cluster (#7/#8/#11/#12) is what actually bites users.

| # | Item | Sev |
|---|------|-----|
| #7  | Remix variants JSONB read-modify-write race (no atomic merge) | 🟠 |
| #8  | Apify `defaultDatasetId` used without runtime guard; `scrape*` methods lack try/catch | 🟠 |
| #11 | Adapt retry leaks AbortController timer on Zod-fail `continue` | 🟠 |
| #12 | `AdaptFrameBody` auto-fire effect omits `analysisId` from deps (latent stuck-empty) | 🟠 |
| #10 | `APIFY_TOKEN` missing → falls back to empty string → opaque 401, no fail-fast | 🟡 |
| #9  | Remix SSRF allowlist permits bare-apex (`apify.com`, `tiktokcdn.com`) — auditor over-rated | 🟢 |

---

## ✅ GSI Milestone — SHIPPED (2026-06-29)

- **v7.0 Numen GSI merged to `main`** via PR #91 (`b09c4f51`) + archived (`6d83bfb1`). All 7 phases
  done. Phase 07 (audience-as-front-door, mode-scoped skill menu) completed; audience-dropdown clip
  fixed via body-portal; 4 code-review warnings + 2 build-gate type errors fixed; 6-file divergence
  merge resolved (both sides integrated, full-suite-gated); squash-merged.
- ⚠️ Do NOT `git merge rework/engine-core` (Phase 0, already on main).
- **Deferred into the next milestone** (GSI `STATE.md` → Deferred Items + `todos/pending/`; see the
  per-worktree forensics in **`docs/WORKTREE-MERGE-AUDIT-2026-06-29.md` §4**):
  1. **P05 code-review follow-ups** (`p05-code-review-followups.md`, low-med) —
     **WR-01** text cap bypassed via file/image upload (`api/tools/profile/route.ts`, only `kind:"text"`
     capped; add decoded-size cap on file_text ~1MB / image ~10MB) ·
     **WR-03** Simulate 500 on resolvable non-General audience (`api/tools/simulate/route.ts` +
     `simulate-runner.ts:~158-161` throw → should be 400) ·
     **WR-04** composer video path silent no-op + orphaned storage (`composer.tsx:~722-743` when `!userId`).
  2. **Simulate person-framing** (`simulate-reaction-person-framing.md`, medium, engine/`simulate-runner.ts`)
     — the baked **person** SIM reacts like a generic **content** critic ("scroll", "first second") not the
     person reacting to the *message*; `runSimulate` uses the content-reaction frame and doesn't import
     `behavioral-core.ts` (Pitfall 5). Chain renders/chains fine; only the reaction *framing* is off.
  3. **`next build` tsc baseline** — `src/components/app/brand-deals/earnings-chart.tsx:97`
     `<Tooltip content={EarningsTooltip}>` recharts-3 type mismatch fails the full-project tsc step
     (`next dev` skips it). Pre-existing since 05-01; part of the ~20-err baseline → see the eslint-refactor
     debt below. **Confirmed on main.** S.
  4. **06-REVIEW (Predict verb) — appears UNRESOLVED on main** (06-REVIEW left "issues_found", not in any
     todo; see `WORKTREE-MERGE-AUDIT-2026-06-29.md` §C):
     **WR-01 (M)** `coercePredictResponse` salvages lean casing but not length/archetype overflow → a common
     model overflow **500s the whole Predict feature** (`predict-schema.ts` has no length/archetype cap on
     main) · **WR-02 (S)** Predict route data-fence uses a guessable static delimiter `SCENARIO` (use a nonce).
  5. **03-REVIEW accepted/deferred** (engine-internal, low): WR-04 + IN-02 (deep element/repaint shaping
     deferred with the scorer) + IN-03/IN-04.
- **Close-out hygiene (cheap):** `~/virtuna-numen-gsi` + `milestone/numen-gsi` are merged → retire
  the worktree/branch per the convention. First verify no stranded work — audit earlier flagged
  `audience-presence.tsx` modified (`diff --stat` no net change = whitespace/no-op; verify or revert).

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
| — | ~~Dead-file delete — `ai/deepseek.ts` + `gemini.ts`~~ ❌ **RETIRED — FALSE (see CLOSED §, session 2):** they're LIVE via `intelligence-service.ts` → `/competitors` + `/api/intelligence`. Do NOT delete. Real item = the provider-consolidation row above. | `src/lib/ai/` | — |
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

**Shell-lane peripheral chrome (separate from premium-thread; code-verified on main):**
- 🔴 `src/components/app/auth-guard.tsx:71` `bg-[#0A0A0A]` + `:73` `border-zinc-800` — raw Raycast
  off-token leftover on the loading gate. **Confirmed still on main.** S.
- `settings/billing-section.tsx` — session notes claimed zinc/glass; grep found none on main → likely
  already resolved (#69/#71). Verify visually then drop. · Sidebar inset — claimed, not re-verified, low.

**Shell loading-states backlog — LARGELY OPEN** (SSOT `docs/subsystems/ui-loading-states.md`; full
file:line + code-verification in `WORKTREE-MERGE-AUDIT-2026-06-29.md` §A). Only A1–A4 + some #72 route
skeletons shipped; memory's "only the engine ask is deferred" was wrong. Still open on main:
- **Theme A:** A5 Account-Read dedicated loading view (M) · A6 Script/Remix skeleton caption
  (`script-thread-view.tsx:114`/`remix-thread-view.tsx:115`, S) · A7 optimistic thread delete
  (`use-threads.ts:73`, S) · Explore double skeleton+checklist (S).
- **Theme B — route skeletons ABSENT:** `home` (P0), `analyze/layout.tsx:26` blank `fallback={null}` (P0),
  `library` · `audience` · `audience/[id]` (P1), `audience/new` (P2), `competitors/[handle]`+`/compare` raw
  pulse (P3). M each.
- **Theme C — MATTE/cleanup:** toast inset-shine (`toast.tsx:213`) · card inset-shine (`card.tsx:61`) ·
  ~~delete dead `GlassToast` + `GlassSkeleton`~~ ✅ **DONE (session 2, `6be82815`)** · Button/Input loading→`<Spinner>`
  (`button.tsx:179`/`input.tsx:191`) · pricing spinner · stale "coral" JSDoc · shared `<SurfaceEmptyState>`
  extract · board `audience-constants.ts:91` coral `#FF7F50` (XS). S each.

---

## 🟢 Feed / Discover — parked for GSI (lanes merged #89 + #90)

Consolidated parked ledger (SSOT detail in memory `discover-feed-milestone.md` → PARKED section).

**A. Close-out hygiene (cheap):**
- `~/virtuna-discover-feed` sits on merged `feat/feed-ui-refinement` (squash tip not an ancestor of
  main) → reset to `origin/main` or `git worktree remove`.
- (Now handled by the refine-lane setup; both feed branches are history-only.)

**B. Phase-3 analyze pipeline (the big deferred feature) — unblocks 3 prod stubs:**
1. Hooks vault → "Hooks from your analyzed videos" — empty "coming soon"
   (`hooks-client.tsx:152,230`). Needs: extract hook template (category + inspired-by + outlier/views)
   from a scraped video → store → surface alongside the 12 default seeds. M.
2. Videos → "Status / Analyzed" filter — no-op toggle (`feed-filters.tsx:282,295,361`). Needs an
   `analyzed` flag on `scraped_video` (= whether it has a derived Read/idea). S/M.
3. Hooks → "Create from video" toolbar — currently a popover → `/feed`; should trigger the
   video→hook extraction. S.

**C. Channels "Describe" tab backend** — describe→suggest service stub
(`add-channel-panel.tsx:278,325`); UI fully built, no backend. M.

**D. Carried data/engine debt (open since Phase 2):**
1. Trending `outlier_multiplier` NULL → "—" — needs a per-niche recompute job; trending tiles can't
   sort/filter by outlier. M.
2. `shouldDownloadVideos:false` feed-ingest variant — current ingest downloads ~12 mp4s/channel
   (calibration config), wasteful for a metadata-only feed. Cost optimization. S.
3. Multi-platform corpus — ingest is TikTok-only, so Channels Search Platform dropdown +
   Suggested-seed IG/YouTube badges are forward-looking only. M.

**E. Verify / polish loose ends:**
1. Fire E2E Remix click on `/feed` (code-identical to prod-proven discover path, unconfirmed on this
   surface — would trigger paid Apify rehost).
2. Re-check the pre-redesign max-effort `/code-review` findings against the rewritten
   `feed-card` / `feed-results` (review ran on the old branch).

**F. UI refinement — ✅ MOSTLY SHIPPED in #90** (corrected by the live `DEV-VERIFICATION-2026-06-29.md`
pass; the `HANDOFF-FEED-UI-REFINEMENT.md` list was a *pre-#90 plan*):
- ✅ **Filters min–max ranges** (Outlier/Views/Engagement) + `max*` params + `postedWithinUnit` (Posted-in-
  last + unit) + **Save-filter** button + **Channels multi-select** — all **live** in the filter sidebar.
- ✅ **Suggested-channels** creator-strategy categories + per-channel follower/view counts — **live**.
- ✅ **Design decisions (§6)** — the restrained choice shipped (neutral metric pills, matte platform badges).
  Re-open only if the owner wants tints. Hooks v1 = seed-only shipped (analyzed = stub, item B above).
- Still open: **Save-filter persistence** not exercised in the browser (present, assume wired — verify). S.

## 🟢 Frame (all PRs merged; worktree clean)

- **video-card lucide → phosphor** (deferred = GSI seam). S.
- **ui/card + ui/select + ui/toast glass holdouts** — SHARED primitives, GSI-adjacent, deferred. M.
- **`format` save path** — speculative. S.

## 🟢 UI / Design

- **Part B per-persona reaction MODAL on the Read hero** — SIM-1 Max badge ships; only modal remains. M.

## 🔸 Post-GSI refactor debt (self-inflicted by the eslint green-up)

The `main` eslint gate is **green (0 err)** — but only because ~20+ LIVE components were batched into
`eslint.config.mjs` `globalIgnores` (React-19-compiler error class: refs-during-render /
setState-in-effect / create-components-in-render) to green the gate before GSI branched. They now lose
full lint coverage. **Real fix = refactor each, then un-ignore.** M total, file-by-file.

- Shared UI primitives: `ui/card.tsx`, `carousel.tsx`, `select.tsx`, `skeleton.tsx`, `toast.tsx`, `typography.tsx`
- `reading/reading.tsx` + `use-reading-reveal.ts`, `command-bar/{CommandBar,ExpertChatInput,ExpertChatThread}.tsx`
- `audience-lens/ReplayController.tsx`, `app/profile-settings-form.tsx`, `app/settings/**`, `app/home/use-ambient-focus.ts`
- `app/cards/{reference-creators-input,wins-flops-input}.tsx`, `hooks/{use-infinite-videos,usePrefersReducedMotion}.ts`
- `primitives/TrafficLights.tsx`, `motion/**`, `visualization/**`, `viral-results/**`, `trending/**`, `hive/**`
- (Genuinely dead, fine to leave ignored or delete: `competitors/**`, `extraction/`, `scripts/`, `verification/`.)

---

## 🧹 Infra / Repo Hygiene

- ~~**Trunk carries 1 unpushed auto-wip commit** `120ea41b`~~ → ✅ **DONE 2026-06-29** — trunk reset
  clean to `origin/main`; the 3 real subsystem docs inside it (HANDOFF-backend-audit, score-pipeline,
  skills-grounding) rescued onto `lane/refine` (`56dad6e1`), the noise dropped.
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
- ~~**MEMORY.md over cap** — 25KB > 24.4KB~~ → ✅ **DONE 2026-06-29** — compacted 25.2KB→13.5KB
  (index lines collapsed to one-liners, detail stays in topic files; added `refine-lane.md`).
- **Parked branches needing a decision** (loose ends, not active debt):
  - `feat/creator-voice-sample` — PR #60 CLOSED unmerged (un-mergeable monster); re-extract clean
    during GSI grounding §4.3. M.
  - `feat/chat-ethics-gate` — Chase Hughes; A/B inconclusive + cost flag; decision pending. S.
  - `fix/flash-coercion-stability` — mostly superseded by #56; verify nothing stranded, then retire. S.
  - `cursor/27a9b701` (ui-restrained Cursor WT) — uncommitted `audience-presence.tsx` edits; commit
    or discard, then `git worktree remove`. NOTE: same filename now lived in the GSI worktree —
    confirm nothing was lost in the GSI merge. S.
  - `polish/cards-next` + `lane/polish` — skill-card lane shipped (#73–#80); stranded WIP is
    throwaway → safe to reset to main / prune. S.

---

## Contradictions vs memory (to fix when reconciling)

1. PR #60 (creator-voice) — memory/ledger say OPEN; actually **CLOSED unmerged** 2026-06-26.
2. `polish/cards-next` — memory says skill-card lane fully shipped; worktree holds **3 abandoned WIP commits**.
3. Ledger says trunk main is "stale, git pull needed" — actually **1 ahead** (auto-wip), 0 behind.
4. Ledger §6 ui-restrained Cursor worktree (`audience-presence.tsx`) — that worktree is **gone from
   `git worktree list`**; the same file now shows modified in the GSI worktree. Verify nothing was lost.

---

**Net:** GSI v7.0 is **shipped + merged to main** (PR #91). The only truly *blocking* items are the
**stuck Vercel production deploy** (#1 — that's why prod still shows the Jan init build) and
**rate-limiting** before public launch. The 🟠 GitHub-issue cluster (#7/#8/#11/#12) bites users but
doesn't block. Everything else is polish, repo hygiene, or parked feature work.

---

> **Reconcile log (2026-06-29, refine-lane):** carried this doc onto `lane/refine` as the SSOT;
> folded in GitHub issues #7–#12, the post-GSI eslint-refactor debt, the dead-`ai/*.ts` deletion, the
> full discover-feed parked ledger (A–E), GSI Phase-05 deferred items, and parked-branch decisions.
> Marked trunk-reset + MEMORY.md-trim DONE. The stale `WORKTREE-DEBT-LEDGER.md` should be reconciled
> from this doc (or retired in its favor) when convenient.
