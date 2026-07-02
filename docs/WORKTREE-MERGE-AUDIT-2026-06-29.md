# Worktree Merge Audit — 2026-06-29

> Forensic per-worktree audit: for each lane, **what landed on `main`** vs **what's still missing**,
> verified against `origin/main` tip **`b09c4f51`** (PR #91, GSI v7.0). Method: git ancestry +
> tree-level content-parity diffs (not just ancestry — squash merges hide content behind a single
> commit) + direct `grep` of the live `main` tree (the `~/virtuna-refine` worktree *is* origin/main
> content) for every "still missing" claim. Nothing here is parroted from memory; every open item has a
> code-verified `file:line`.

**TL;DR:** All five lanes' *code* is fully landed on `main`. The only branch with unmerged commits is
`polish/cards-next`, and those 3 commits are **superseded throwaway** (main is ahead of them). What
remains is **feature/stub debt and polish**, not stranded merges. Four worktrees are retire-able.

| Worktree | Branch | Tip | Merge verdict | Disposition |
|---|---|---|---|---|
| `~/virtuna-shell` | `lane/shell` | `e4a60593` | ✅ 100% landed (tip is ancestor of main) | retire-able |
| `~/virtuna-frame` | `lane/frame` | `9464ccb0` | ✅ 100% landed (tip is ancestor of main) | retire-able |
| `~/virtuna-discover-feed` | `feat/feed-ui-refinement` | `8388b85f` | ✅ 100% landed (tree == #90 squash) | retire-able |
| `~/virtuna-numen-gsi` | `milestone/numen-gsi` | `67f5836a` | ✅ 100% landed (diff vs main = **0 lines**) | retire-able |
| `~/virtuna-polish` | `polish/cards-next` | `580fe392` | ⚠️ 3 unmerged commits, all **superseded WIP** | reset/prune |

---

## 1. `~/virtuna-shell` — `lane/shell` @ `e4a60593` — ✅ FULLY LANDED

- **Evidence:** `git merge-base --is-ancestor e4a60593 origin/main` → **YES**. `rev-list` = 3 behind / **0 ahead**. No unmerged commits, clean working tree.
- **What landed (PRs on main):**
  - #70 `fa6125c4` — multi-thread chat history in the sidebar
  - #72 `6b2d110b` — chrome pass: error/404 reskin + dead-link fix, route skeletons, thread delete
  - #85 `1547fde4` — premium thread PR-1: switch & submit mechanics (A1/A2/A3)
  - #88 `e4a60593` — premium thread PR-2: card pending + conversational frame (A4 + intro/outro/spine)
  - (settings reskin #69 `2f8c32cc` is shell-adjacent; also on main)
- **What's still missing (code-verified on main):**
  - **Premium-thread "Generating" UX gap** — `src/app/api/tools/hooks/route.ts:182/186/198`:
    `send("stage", {name:"Generating", status:"active"})` (182) → one awaited `runHooksPipeline` (186)
    → `status:"done"` (198). All ~52s of GENERATE→SIM→GATE→RANK buckets into one stage; spine parks on
    "Generating" then flashes the rest in the final ms. **Not a bug** (D-02 "real not timed").
    - Cheap client win (S): cycle sub-detail copy + show elapsed seconds during Generating.
    - Clean fix (M): cross-lane engine ask — per-phase callbacks / `detail?` on the stage SSE.
  - **Shell-lane peripheral chrome (separate from premium-thread):**
    - 🔴 `src/components/app/auth-guard.tsx:71` `bg-[#0A0A0A]` + `:73` `border-zinc-800` — raw Raycast
      off-token leftover. **CONFIRMED still on main.** P0-ish (it's the loading gate). S.
    - `src/components/app/settings/billing-section.tsx` — session notes claimed zinc/glass; **grep found
      NO `zinc`/`backdropFilter`/`backdrop-blur`** → appears already resolved (likely via #69/#71). Verify visually, then drop from the ledger.
    - Sidebar inset — claimed; not re-verified this pass; low priority.
- **Disposition:** nothing unmerged → `git worktree remove ~/virtuna-shell` safe (branch kept in `.git`).

---

## 2. `~/virtuna-frame` — `lane/frame` @ `9464ccb0` — ✅ FULLY LANDED

- **Evidence:** `git merge-base --is-ancestor 9464ccb0 origin/main` → **YES**. `rev-list` = 5 behind / **0 ahead**. Clean.
- **What landed (PRs on main):**
  - #71 `62bbb60a` — settings close-out, auth glass→matte, pricing + invisible-text fixes
  - #77 `e8ad2ef0` — dead-code sweep: retire Raycast showcase gallery + view-selector + dead token
  - #79 `5f2bc1a4` — wire outlier save-path + Library cover echo
  - #81 `9a1e7ed3` — kill the Raycast glass holdout: matte GlassPill + dead-token sweep
  - #82 `523d1f58` — retire two Raycast leftovers (upgrade-prompt + CompetitorEmptyState)
  - #83 `8eee459f` — token-hygiene sweep (F-05 $-amount, raw tailwind colors → tokens)
  - #84 `eec66c1f` — kill glass holdout on remove-competitor confirm dialog
  - #86 `9464ccb0` — echo the source tile's cover overlay on saved outlier cards
  - (library #75 `59b29f0d` is frame-adjacent; on main)
- **What's still missing (code-verified on main):**
  - `src/components/competitors/detail/video-card.tsx:1` `import { Eye, Heart, MessageCircle, Share2 } from "lucide-react"` (used 71/75/79/83) → **lucide→phosphor**. **CONFIRMED still on main.** S.
    ⚠️ Flagged "GSI seam" — competitor-detail abuts GSI surfaces; confirm not about to be reworked before touching.
  - **Shared-primitive glass holdouts (GSI-adjacent, defer):** **CONFIRMED on main** —
    `src/components/ui/card.tsx:123` `backdropFilter: blur(...)`,
    `src/components/ui/select.tsx:712` `backdropFilter:"blur(12px)"`,
    `src/components/ui/toast.tsx:214` `backdropFilter:"blur(12px)"`. Editing ripples into GSI surfaces → defer. M.
  - `format` save path — speculative, no confirmed defect. Skip unless a real bug surfaces. S.
- **Disposition:** nothing unmerged → `git worktree remove ~/virtuna-frame` safe.

---

## 3. `~/virtuna-discover-feed` — `feat/feed-ui-refinement` @ `8388b85f` — ✅ FULLY LANDED

- **Evidence:** ancestry shows 1 "ahead" (the pre-squash commit) / 2 behind, BUT tree-parity is exact:
  `git diff 8388b85f b8ee80b1 --stat` = **0 lines** → the branch tip is byte-identical to the #90
  squash commit `b8ee80b1`. (The misleading 347-file `diff origin/main..8388b85f` is just the branch
  lacking the GSI milestone — it predates #91.)
- **What landed (PRs on main):**
  - #89 `38acaa89` — Discover Feed + Channels: persistent Videos feed (watched + trending)
  - #90 `b8ee80b1` — Sandcastles-grade Channels + Videos refinement + new Hooks vault (= this branch)
- **What's still missing — the Phase-3 analyze pipeline + stubs (CONFIRMED on main, with line refs):**
  1. **Hooks "from your analyzed videos"** — `src/app/(app)/feed/hooks/hooks-client.tsx:152` ("Auto-extracting hooks … is coming soon"), `:221/:224` ("Hooks from your analyzed videos · 0"), `:230`. Empty until the analyze pipeline lands. Needs: extract hook template (category + inspired-by + outlier/views) from a scraped video → store → surface alongside the 12 seeds. M.
  2. **Videos "Status / Analyzed" filter** — `src/components/feed/feed-filters.tsx:157-159` (`statusAnalyzed`/`statusUnanalyzed` state), `:282` ("parity stub"), `:288-290` (StatusChips). Renders but **does not filter** — needs an `analyzed` flag on `scraped_video`. S/M.
  3. **Hooks "Create from video" toolbar** — popover → `/feed` today; should trigger video→hook extraction. S.
  4. **Channels "Describe" tab backend** — `src/components/channels/add-channel-panel.tsx:8` ("suggest stub"), `:165-166` (Describe tab). UI fully built, **no backend** describe→suggest service. M.
  5. **Carried data/engine debt (open since Phase 2):** trending `outlier_multiplier` NULL → "—" (needs per-niche recompute job); `shouldDownloadVideos:false` ingest variant (today downloads ~12 mp4s/channel, wasteful for metadata-only feed); multi-platform corpus (ingest is TikTok-only → Channels Platform dropdown + IG/YT seed badges are forward-looking only).
  6. **Verify/polish:** fire E2E Remix click on `/feed` (unconfirmed on this surface, triggers paid Apify rehost); re-check pre-redesign `/code-review` findings against the rewritten `feed-card`/`feed-results`.
- **Disposition:** branch is history-only; `git worktree remove ~/virtuna-discover-feed` safe (or reset to `origin/main`). Both `feat/feed-ui-refinement` + `milestone/discover-feed` are prune candidates on origin.

---

## 4. `~/virtuna-numen-gsi` — `milestone/numen-gsi` @ `67f5836a` — ✅ FULLY LANDED (v7.0)

- **Evidence:** `git diff origin/main..milestone/numen-gsi --stat` = **0 lines** → origin/main and the GSI
  branch tip are **content-identical**. The "238 ahead / 1 behind" is pure squash-merge ancestry
  artifact (238 = the milestone's own commits; 1 = the squash commit `b09c4f51` itself). 100% landed.
- **What landed:** #91 `b09c4f51` (squash of all 7 phases) + archive `6d83bfb1`. All of Phase 04
  (input-adapter: stimulus types/tier/ingest/vision/normalize), Phase 05 (Profile/Simulate wow),
  Phase 06 (Predict panel), Phase 07 (audience-as-front-door, mode-scoped skill menu).
- **Resolved since the last audit:** `src/components/audience-lens/audience-presence.tsx` (earlier
  flagged as uncommitted) is now **clean** (`git status` empty) — committed/reverted during the merge. Nothing lost.
- **What's still missing — carry-forward (GSI `STATE.md` Deferred Items + `todos/pending/`):**
  - **A. `p05-code-review-followups.md`** (low-medium; api/tools routes + composer; CR-01/WR-02 already fixed):
    - **WR-01 (medium)** — text cap bypassed via file upload. `MAX_EVIDENCE_LENGTH` (8000) enforced only on `kind:"text"` in `src/app/api/tools/profile/route.ts`; `file_text` (~1MB) + `image` (~10MB) feed far larger content to both LLM calls. Add a decoded-size cap on file/image branches.
    - **WR-03 (low)** — Simulate 500 on resolvable non-General audience. `src/app/api/tools/simulate/route.ts` + `simulate-runner.ts:~158-161` throw → 500; should be a 400 validation reject (check `audience.mode === "general"`). *(Note: same class as engine ledger item; this is the Simulate-route instance.)*
    - **WR-04 (low)** — composer video path silent no-op. `src/components/app/home/composer.tsx:~722-743`: when `!userId` the video evidence path returns with no error + can orphan an uploaded storage object. Surface an inline error; cleanup on reject.
    - **Info (optional):** `detectSubjectKind` regex over-matches `https://`/`Note:`/`TODO:` (person→panel mis-detect, default-safe); profile poll burns its full ~3-min budget even when no Simulate starts (arm poll only after CTA); `assertBlocksInRegistry` dead code; `23505` fallback in `createOpenThreadLazy` inert until the partial unique index exists.
  - **B. `simulate-reaction-person-framing.md`** (medium; engine / `simulate-runner.ts` 05-05):
    The Simulate verb runs a draft through the baked **person** General SIM, but the reaction reads as a
    generic **content** critique ("Boring start… visuals… I'm gone", "Instant scroll") not how the baked
    person (e.g. a skeptical analyst) would react to a *business message*. Hypothesis: `runSimulate`
    lifts the content-reaction frame (`two-audience-read.ts` → `buildAudienceRepaint` → `runFlashTextMode`
    → `aggregateFlash`) and deliberately does NOT import the person's `behavioral-core.ts` (Pitfall 5 in
    05-05), so message-reactions fall back to content heuristics. The Profile→Simulate chain renders +
    chains correctly; only the reaction *framing* is off.
  - **C. Pre-existing build blocker** — `src/components/app/brand-deals/earnings-chart.tsx:97`
    `<Tooltip content={EarningsTooltip} cursor={false} />` recharts-3 type mismatch fails `next build`'s
    **full-project tsc step** (`next dev` skips it). **CONFIRMED on main.** Part of the ~20-error tsc
    baseline carried since GSI 05-01. (See also the post-GSI eslint `globalIgnores` debt — same era.)
  - **v2 (roadmap-deferred, not now):** SIM marketplace + rev-share (MKT-*), Anchor Pack #2 Marketing (PACK2-01), self-calibration Directional→Validated (CAL-01).
- **Doc staleness note:** GSI `STATE.md` → "Session Continuity" still says *"07-06 Task 4 human-verify
  PENDING"* — **stale**; Task 4 was approved (STATE line 146 "real authed /home browser pass APPROVED")
  and the milestone shipped + archived. Ignore that block.
- **Disposition:** `git worktree remove ~/virtuna-numen-gsi` safe; do **NOT** `git merge rework/engine-core` (Phase 0, already on main). Copy `todos/pending/*` + `deferred-items.md` forward before removing (they're the carry-forward source).

---

## 5. `~/virtuna-polish` — `polish/cards-next` @ `580fe392` — ⚠️ SUPERSEDED WIP

- **Evidence:** 18 behind / **3 ahead**. The 3 unmerged commits are the only non-landed work in any lane:
  - `580fe392` chore(auto-wip): ui — page.tsx, outlier-tile.tsx, remix-card-block.tsx +6 (13 files, +430/-12)
  - `1ff3c12f` wip(account-read): densified text-patterns half + throwaway harness (empty `--stat`)
  - `8f34a700` chore(auto-wip): ui — page.tsx, account-read-block.tsx (2 files, +201/-155)
- **Are they unique unshipped work?** No — **superseded**. The skill-card redesign shipped via separate
  daemon-safe ship-worktrees as PRs **#73** `1d62473c` (refine skill cards), **#74** `2523e12c` (Account
  Read Tier C), **#76** `8f11f267` (Discover+Remix covers), **#78** `cf3244b8` (honest reject + drop
  card-reaction), **#80** `6ab1c3cc` (Write-to-strengths). **Proof of supersession:**
  `git diff origin/main:…/account-read-block.tsx 580fe392:…/account-read-block.tsx` = **+4 / −75** →
  main's version is **75 lines ahead** of the polish WIP. The dev harness `src/app/dev/cards/page.tsx`
  is intentionally **absent from main** (never-ship harness, per design).
- **What's still missing:** nothing unique here. (UI/Design open item that's real: **Part B per-persona
  reaction MODAL** on the Read hero — SIM-1 Max badge ships; only the modal remains. M. That work was
  never on this branch.)
- **Disposition:** **reset to `origin/main` or prune.** `polish/cards-next` + `lane/polish` are
  throwaway-only. No salvage needed (main is the superset).

---

## Cross-cutting / repo hygiene

- **3 global stashes** (shared `.git`, visible from every worktree) — all old, candidates to drop after a glance:
  - `stash@{0}` On main: `trunk-cleanup-pre-polish-lane`
  - `stash@{1}` WIP on main: `chore(auto-wip): misc — fold-flash-stability-spike.ts` (2026-06-14)
  - `stash@{2}` On main: `v1.1-pre-mvp-cut-setup-stale-edits`
- **Branch pruning (origin):** the merged lane branches are history-only — `feat/frame-*`, `fix/frame-*`,
  `polish/account-read-tierc`, `polish/skill-cards`, `feat/feed-ui-refinement`, `milestone/discover-feed`,
  `milestone/numen-gsi`, `lane/shell`, `lane/frame`. Prune when convenient.
- **Worktrees safe to `git worktree remove`:** `~/virtuna-shell`, `~/virtuna-frame`,
  `~/virtuna-discover-feed`, `~/virtuna-numen-gsi` (all fully landed). `~/virtuna-polish` → reset/prune.

---

## Net (this audit)

- **Code:** 100% of shell / frame / discover-feed / GSI is on `main`. Zero stranded merges. `polish/cards-next` holds only superseded WIP.
- **Open work is debt, not lost merges** — and it's the same set the consolidated ledger already tracks
  (`docs/OPEN-DEBT-AUDIT-2026-06-29.md`): the feed analyze-pipeline stubs, frame `video-card` + `ui/*`
  glass, shell `auth-guard` + premium-thread Generating, GSI's `p05-code-review-followups` /
  `simulate-reaction-person-framing` / `earnings-chart` tsc-baseline, and the Read per-persona modal.
- **New/sharpened vs the prior ledger:** the GSI WR-01/WR-03/WR-04 follow-ups + the person-framing
  Simulate issue + the `earnings-chart.tsx:97` build blocker were not in the OPEN-DEBT-AUDIT; fold them in.

---

# Deep deferred-work sweep — every worktree's `.planning` (pass 2, 2026-06-29)

> Second pass per the "double-verify everything landed + capture ALL deferred work" ask. I read every
> `.planning` deferred-tracking artifact in all 5 worktrees (HANDOFF / REVIEW / deferred-items / todos)
> and code-verified each open item against the live `main` tree. **Headline: the shell lane carried a
> much larger loading-states backlog than memory recorded — most of Theme B + Theme C never shipped.**

## Double-verification of "everything landed" (stronger than pass 1)
- **shell / frame** — branch tip is a git **ancestor** of `origin/main` ⇒ every commit is on main (definitive).
- **discover-feed** — `git diff 8388b85f b8ee80b1` = **0 lines** ⇒ branch tip tree == #90 squash (definitive).
- **GSI** — `git diff origin/main..milestone/numen-gsi` = **0 lines** ⇒ trees identical (definitive).
- **polish** — per-file vs main: **8/13 byte-identical to main**, 1 is the never-ship `dev/cards` harness,
  4 are main-superset. The *only* polish-unique lines: a superseded "+ Track account" draft button in
  `outlier-tile.tsx` (the real track/watchlist shipped via #79/#89) and a **stale** "Write to my strengths
  → deferred" comment in `account-read-block.tsx` for work that **shipped as #80**. **Nothing stranded.**

## A. SHELL (`lane/shell`) — premium-thread loading-states backlog ⚠️ LARGELY OPEN
SSOT: **`docs/subsystems/ui-loading-states.md`** (on main, full file:line). Shipped: A1/A2/A3 (#85),
A4 + conversational frame (#88), some route skeletons + `global-error` (#72). **Still open, code-verified:**
- **Theme A leftovers:**
  - **A5** — Account Read has no dedicated loading view (no `account-read-thread-view.tsx`; uses the wrong
    `variant="chat"` prose skeleton via `chat-thread-view.tsx:149`). M.
  - **A6** — Script/Remix skeleton drops the status caption: `script-thread-view.tsx:114` +
    `remix-thread-view.tsx:115` render `<ThreadLoadingSkeleton variant="skill"/>` with **no `caption`** (hooks/ideas pass it). One line each. S.
  - **A7** — Thread delete not optimistic: `src/hooks/queries/use-threads.ts:73` only `invalidateQueries`, no `onMutate`. **Verified: no optimistic markers in Sidebar/use-threads.** S.
  - **Bonus** — Explore double-renders skeleton + checklist (`explore-thread-view.tsx:279-287`). S.
- **Theme B — route loading skeletons (CONFIRMED ABSENT on main):**
  `home/loading.tsx` (P0), `analyze/layout.tsx:26` `<Suspense fallback={null}>` → blank surface (P0),
  `library/loading.tsx` (P1), `audience/loading.tsx` (P1), `audience/[id]/loading.tsx` (P1),
  `audience/new/loading.tsx` (P2), `competitors/[handle]`+`/compare` raw `animate-pulse` (P3).
  (`feed/loading.tsx` present ✓; brand-deals/discover/referrals/settings already good.)
- **Theme C — primitives / MATTE debt (CONFIRMED present on main):**
  toast inset-shine `ui/toast.tsx:213-216`, card inset-shine `ui/card.tsx:61`, **delete dead
  `primitives/GlassToast.tsx`** (still present), **delete dead `primitives/GlassSkeleton.tsx`**
  (`SkeletonText`/`SkeletonCard`, still present), unify Button+Input loading→`<Spinner>`
  (`ui/button.tsx:179` + `ui/input.tsx:191`, currently lucide `Loader2`), pricing spinner
  `pricing-section.tsx:113`, stale "coral" JSDoc (button/toggle/skeleton), extract shared
  `<SurfaceEmptyState>`, board `audience-constants.ts:91` coral `#FF7F50` (XS, board refactor).
  (`card-reaction-at-rest` already deleted in #78.)
- **Engine ask (the one item memory had):** add `detail` to the stage SSE event / `StageState` for the
  live Generating counter (also unblocks the "stuck Generating" item).

## B. DISCOVER-FEED (`feat/feed-ui-refinement`) — ⚠️ CORRECTED by live verification
The `HANDOFF-FEED-UI-REFINEMENT.md` §3–6 list was a **pre-#90 plan**; the live `/feed` pass
(`DEV-VERIFICATION-2026-06-29.md`) proves **#90 shipped most of it**:
- ✅ **SHIPPED** (live in the filter sidebar): min–max ranges (Outlier/Views/Engagement), `max*` params,
  `postedWithinUnit` (Posted-in-last + unit dropdown), **Save-filter** button, **Channels multi-select**.
- ✅ **SHIPPED**: Suggested-channels creator-strategy categories + per-channel follower/view counts.
- ✅ **Design decisions (§6) decided** — restrained shipped (neutral pills, matte badges, Remix→Read kept).
- **Still open:** the 3 Phase-3-pipeline stubs (Hooks-from-analyzed, Channels Describe backend,
  Status/Analyzed filter — all live-confirmed as "coming soon"), trending-metric backfill
  (`@khaby.lame`/`@chrisbumstead` show "-- followers · 0 views"), `shouldDownloadVideos:false` ingest
  cost-opt, multi-platform corpus, the unrun E2E-Remix-on-`/feed` check, Save-filter persistence verify.

## C. NUMEN-GSI — review carry-forward beyond the p05 todos
- **06-REVIEW (Predict verb) — appears UNRESOLVED on main** (06-REVIEW left "issues_found"; not in any todo):
  - **WR-01 (M)** — `coercePredictResponse` salvages lean casing but **not length/archetype overflow**; a
    common model overflow **500s the whole Predict feature**. `predict-schema.ts` on main has no length/archetype cap. **Verify + fix.**
  - **WR-02 (S)** — prompt-injection data fence uses a guessable static delimiter `SCENARIO` (vs a random
    nonce). Harden the Predict route's USER fence.
- **03-REVIEW (general-population honesty) — accepted/deferred:** WR-04 + **IN-02** ("deep element/repaint
  shaping deferred with the scorer") + IN-03/IN-04. Engine-internal, lower priority; tracked here so they're not lost.
- (Already in ledger: p05 WR-01/WR-03/WR-04 + Simulate person-framing + `earnings-chart.tsx:97`.)

## D. POLISH — no real deferred work
`HANDOFF-ui-restrained.md` is **stale historical** (2026-06-24; references the **reverted** signal-red
`#e23b2d` accent — that de-Claude rebrand shipped via #36 + #45/#46/#47). The skill-card lane shipped
(#73–#80). Nothing open here. *(One latent cross-track flag from that handoff: the P1 audience copy "…not
how Numen writes" goes stale if/when the engine wires weights→generation — A1; engine R1′b moved that
direction, so re-check the disclaimer.)*

## E. Stale-inherited (NOT one of the 5 lanes — do not re-surface as active)
The lane worktrees share an inherited landing-v2-era `.planning` (phases `01-foundation-shell` /
`03-story-showcase` / `04-proof-conversion`, `AUDIT-ui-surfaces-260624.md`). Its `deferred-items.md`
items are **superseded:** the "58 err/68 warn engine lint debt" → resolved by #67 (now the `globalIgnores`
debt) and the "dead `showcase/` token refs" → `showcase/` was **deleted in #77**. Ignore.
