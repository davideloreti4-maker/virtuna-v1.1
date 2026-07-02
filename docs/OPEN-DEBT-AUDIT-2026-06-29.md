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

## ✅ CLOSED — refine-lane session 5 (2026-07-02)

Committed to `lane/refine` (`81f8294d`), merged to main via the lane PR (2026-07-02):

1. **Brand-deals (Partnerships) removed from MVP** (owner decision) — the whole self-contained vertical
   deleted in ONE `git revert`-able commit (**45 files, −4,216**): route `(app)/brand-deals/` + 21
   components + `api/{deals,earnings,affiliate-links,programs}` + 4 query hooks + `types/brand-deals` +
   `lib/{deal-utils,affiliate-programs,affiliate/cj-client,mappers}`. Shared-file edits restored by the
   same revert: Sidebar nav item + `Handshake` import + `isOnBrandDeals`; hooks-barrel re-exports;
   middleware `PROTECTED_PREFIXES`; 2 tests (`reskin-matte`, `Sidebar.a11y`). Cluster boundary was grep-
   verified self-contained before deletion. `tsc --noEmit`: **0 new source errors**; 2 edited tests green
   (15/15). **Restore later: `git revert 81f8294d`.**
2. **`earnings-chart.tsx:97` next-build tsc blocker — GONE** (the file is deleted by #1). Superseded, not
   fixed — do NOT re-open it as a work item. (Updates GSI carry-forward #3 below.)
3. **`polish/cards-next` stranded WIP — verified DISCARD-safe** (inspected, NOT pruned — owner "hold
   worktrees" + it carries a live auto-wip Stop-hook). Main is more evolved than the 06-27 snapshot
   (`account-read-block` 400 lines vs WIP 329; rebasing the WIP onto main adds only 5 lines); the WIP's
   own commit reads "HOLD — do not PR alone … foundation … throwaway harness." Superseded by #80 + later
   PRs. When ready: `git worktree remove ~/virtuna-polish` + `git branch -D polish/cards-next` loses nothing.

---

## ✅ CLOSED — refine-lane session 6 (2026-07-02, post-merge continuation)

Batched on `lane/refine` after the PR #92 merge (not yet PR'd — commits below):

1. **Predict WR-01 + WR-02** (`d52b9aaf`) — the 500-on-overflow + the guessable data-fence delimiter.
   See the struck-through GSI carry-forward #4 for detail. 39 flash/predict tests green.
2. **auth-guard loading skeleton detokenized** (`3fe62a8b`) — the last raw `#0A0A0A` + `border-zinc-800`
   → flat-warm tokens (`bg-background` / `bg-background-elevated` / `border-white/[0.06]`); added to the
   `reskin-matte` gate (14 green) so it can't regress.
3. **video-card lucide→phosphor** (`0dd5f846`) — competitor-detail metric icons (Eye/Heart/ChatCircle/
   ShareNetwork); the last lucide holdout on the frame seam. tsc clean.
4. **/home route loading skeleton** (`deb7ced4`) — Theme B P0; hero-anchored logo+serif+composer skeleton
   mirroring HomePageLayout (no more generic dashboard-grid flash on nav). Authed browser pass: GET /home
   200, 0 console errors.

⚠️ **CORRECTION — analyze P0 (`analyze/layout.tsx:26` `fallback={null}`):** that Suspense wraps the inner
`<Reading>`, a CLIENT tree that loads via hooks (not Suspense), so the fallback is effectively inert — the
real load state lives INSIDE Reading. The Theme-B "analyze skeleton" fix is therefore a Reading-internal
loading state, not a layout fallback swap; needs a live Reading-load observation before touching (memory
`reading-live-load-froze` flags this surface as delicate). Left open with this corrected diagnosis.

---

## ✅ CLOSED / CORRECTED — refine-lane session 7 (2026-07-02, debt sweep)

Batched on `lane/refine` (commits below). This session ALSO re-verified the open items against
current code (the owner asked to confirm accuracy) — several were stale or intentional:

**Fixed:**
1. **#10 apify token fail-fast** + **#8 dataset guard** (`da68f37a`) — constructor rejects a missing
   token (was `?? APIFY_TOKEN!` → opaque 401); `.dataset(run.defaultDatasetId)` centralized behind a
   guarded `listRunItems()`.
2. **#11 adapt abort-timer leak** (`da68f37a`) — the Zod-fail `continue` skipped `clearTimeout`; moved
   the clear into a `finally` (every path clears now).
3. **p05 WR-01 upload size cap** + **WR-03 Simulate 500→400** (`a0d03f7d`) — file_text/image now cap
   decoded size before decode; a resolvable non-General audience is a boundary 400, not a runner-throw 500.
   +2 tests.

**CORRECTED (verified NOT real / not actionable — do not re-open):**
- **#12 `AdaptFrameBody` missing-dep effect — STALE.** The component was deleted (P7 dead-code sweep
  `b436b7f3` + the viral-remix rework); it survives only as a comment in `use-analysis-stream.ts:526`.
  The buggy auto-fire effect no longer exists. `useAdaptConcepts` is also caller-less (minor dead hook).
- **G3 `cron/refresh-corpus` stub — INTENTIONAL, not a no-op bug.** It's a documented Phase-1 stub
  (returns 200 so the `vercel.json` schedule fires; full 30-day refresh explicitly deferred to Phase 11/12).
  Cutting it would break the registered cron. Leave until that phase.
- **S6 `assertBlocksInRegistry` — INTENTIONAL, keep.** Documented "retained for re-use" and covered by 4
  test files; only its prod caller was cut in S4. Not dead — no rewire/cut needed.
- **#7 remix variants JSONB race — REAL but MIGRATION-GATED.** The only correct fix is a DB-atomic
  `jsonb_set` merge via a Postgres RPC (Supabase JS `.update()` can't deep-merge atomically) — a prod
  schema change, out of scope for an autonomous code sweep. Needs an owner-approved migration.

---

## ✅ CLOSED / CORRECTED — refine-lane session 8 (2026-07-02, refactor + audit-verify)

Batched on `lane/refine`. E2 + SSOT merged to main via PR #95 (`c9afa5a0`); Theme-B skeletons on the
lane after. Two shipped; two queue items verified out.

**Fixed:**
1. **E2 — shared `resolveThreadAudience` helper** (`52f657fe`, merged #95) — the per-thread active-audience read
   (D-04 pin) was duplicated as a ~10-line block across 6 generative tool routes
   (ideas/hooks/script/chat/react/explore). Extracted to
   `src/lib/audience/resolve-thread-audience.ts`. **Net −67 lines**; dropped the stale
   `as … & { active_audience_id }` casts + now-unused `Audience` imports. Placed in its OWN module
   (not audience-repo) so the helper's `getAudience`/`GENERAL_AUDIENCE` imports resolve through the
   cross-module binding — the existing route-test mocks (react's `getAudience` spy + CR-01 assertion,
   explore's full module replace) keep passing **unchanged**. +5-case unit test. 50 tests green, tsc + eslint clean.
2. **Theme-B route loading skeletons** (`c100c9f8`) — added route-level `loading.tsx` for the 4 (app) routes
   that lacked one and fell back to the generic `(app)/loading.tsx` dashboard grid: `library`, `audience`,
   `audience/[id]`, `audience/new`. Each mirrors its page's real layout verbatim (SavedShelf chrome + 6-card
   grid / AudienceManager header + list / a verbatim copy of the page's own client DetailSkeleton / form
   field-groups) → shape-matched, no layout shift. `competitors/[handle]` + `/compare` (handoff P3) were
   **already covered** by pre-existing `loading.tsx` (handoff stale). Verified authed on dev :3300: tsc +
   eslint clean, all 4 render final content with 0 console errors, skeleton renders cleanly in-shell. Theme B
   is now complete bar the deferred `analyze` Reading-internal state.
3. **WR-04 composer video silent no-ops + orphaned blob** (`3245f7e7`) — both video paths (Test upload +
   Profile evidence) had failure branches that returned BEFORE `stream.start`, so `stream.phase` never owned
   the error and the button went dead-quiet. Test path `!userId` / storage-upload-error now set a new
   `submitError` in the existing inline error slot; Profile path `!userId` surfaces via `evidenceError`.
   Orphaned storage: Profile path best-effort removes the staged clip on server reject (safe — synchronous
   route); Test path deliberately does NOT clean client-side (`/api/analyze` async background job → deleting
   would race the server; left to a server sweep, documented inline). **Browser-proven** on dev :3300: forced
   a storage 500 with a staged video → "That upload didn't go through…" renders (was silent). tsc + eslint clean.

**CORRECTED (verified NOT the low-risk items the auditor rated — do not re-open as quick wins):**
- **A6 `(supabase as any)` casts — MIS-SCOPED, NOT a low-risk strip.** Two distinct blockers:
  (1) `database.types.ts` is stale — the generated `audiences` Row is missing `mode` /
  `success_criterion` / `custom_context` (added by migrations `20260619`/`20260624`/`20260627`), so
  typed `.insert`/`.select` would error on those columns; (2) `audience-repo.ts` deliberately types
  `AudienceRow` with `unknown` / `unknown[]`, which is NOT assignable to the generated `Json`-based
  types — the `any` cast bridges that gap. Removing it cleanly needs either a **live-DB types regen**
  (wide blast radius) or a **type-reconciliation refactor**, not a cast strip. The `cron/audience-drift`
  half is more tractable (its client is genuinely `SupabaseClient<Database>` and all its columns exist)
  but stripping the client `any` just relocates casts onto the `.update()` payload (domain `unknown`
  fields → generated `Json`) + the `data as PersonalAudienceRow[]` narrowing — marginal. **Deferred:**
  do it as part of a proper `database.types.ts` regen, owner-gated (touches generated file + wants
  live-DB verify).
- **#9 SSRF bare-apex allowlist — NOT a real vulnerability.** `apify-provider.ts`
  `isAllowedPostUrl`/`isAllowedMp4Host` gate on HTTPS + private-IP rejection + suffix allowlist
  (`host === suffix.slice(1) || host.endsWith(suffix)`). `endsWith(".tiktok.com")` requires controlling
  a real subdomain of `tiktok.com` (`eviltiktok.com` / `tiktok.com.evil.com` both fail — the leading `.`
  blocks suffix confusion); the bare-apex clause admits only the legit registrable apex (TikTok/Apify
  owned) and is plausibly needed for canonical apex URLs; raw/encoded IPs can't pass a `.tiktok.com`
  suffix anyway. Tightening the apex clause = zero security gain, risk of breaking legit URLs. Auditor
  over-rated it — confirmed non-issue, close it.

---

## 🔴 Blocking

### 1. Production is stuck on the January init commit
- Vercel prod project `virtuna-v1.1` has exactly **one** production deployment ever:
  `dpl_EhDYbNekZSPLA6kHfmfxx7ZMUjvH`, created **2026-01-27**, from commit
  `f510cf0f` *"feat: initialize virtuna v1.1 project"* (the first commit).
- State READY, but ~5 months of merged work (v5.0, v6.0, discover-feed, every UI lane,
  **premium-thread**) is **NOT deployed**. GitHub→Vercel auto-deploy appears disconnected/paused.
- Size: **L** · Owner: infra.

#### DIAGNOSED + PARTIALLY ACTIONED (2026-07-02, via Vercel MCP — read-only)
- **Root cause:** the GitHub→Vercel Git integration fired **exactly once**, at project
  creation (`githubDeployment:"1"`, 10:53:07 — 23s after the project was created 10:52:44),
  and **never again**. Not a build failure — there are **zero failed deploys**; nothing was
  *triggering* a deploy at all. Verified: `f510cf0f` IS the root commit
  (`git rev-list --max-parents=0`); **3,010 commits** on `origin/main` since, none deployed;
  Vercel-linked repo = `davideloreti4-maker/virtuna-v1.1` (matches `origin`); project
  `live:false`. IDs: project `prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url`, team `team_4eBJIDHXvR0VGq2Nrgr9xt21`.
- **Step 1 DONE (owner):** Git integration **reconnected** in Vercel dashboard on 2026-07-02
  ~11:38 (project `updatedAt` moved May-17 → 2026-07-02 11:38:34, confirming the settings write).
  ⚠️ Reconnect does **NOT** backfill a deploy — still 1 deploy / `live:false`. The pipe is
  *armed for future pushes*, unproven until a push to `main` or a manual deploy fires.
- **NOT an Anthropic-key issue** (owner's initial worry): the webhook is the Vercel **GitHub
  App** (OAuth, no key). And the app runtime reads **DashScope/Gemini/DeepSeek**, never
  `ANTHROPIC_API_KEY` (code-verified grep of `process.env.*`).
- **Env vars to set in Vercel (Production) before first real deploy** — copy values from local
  `.env.local`; dashboard-check which already exist (MCP can't read env vars):
  - 🔴 build/app breaks: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
  - 🟠 core product 500s (build still passes): `DASHSCOPE_API_KEY` (engine hero, 18 refs),
    `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `APIFY_TOKEN` (16 refs).
  - 🟡 if feature live: `WHOP_API_KEY`/`WHOP_WEBHOOK_SECRET`/`WHOP_PRODUCT_ID_STARTER`/`_PRO`
    (billing), `CRON_SECRET`, `APIFY_WEBHOOK_SECRET`, `FILMSTRIP_EXTRACT_SECRET`,
    `NEXT_PUBLIC_SENTRY_DSN`.
  - ⚪ skip (code defaults): `FLASH_MODEL`, `EMBEDDING_MODEL`, `QWEN_*_MODEL`, `FOLD_*`,
    `OMNI_MAX_TOKENS`, `RECALIBRATION_STEP`, `APIFY_ACTOR_*`, `SCRAPER_HASHTAGS`,
    `RUN_VISION_LIVE_SMOKE`. `NODE_ENV`/`NEXT_RUNTIME` are Vercel-set.
- **Second landmine (not yet checked):** deployed code expects a Supabase **prod DB schema**
  with ~5mo of migrations applied. Memory flags `database.types.ts` missing
  `mode`/`success_criterion`/`custom_context` cols — if prod DB is stuck at Jan-27 schema the
  app errors even with keys set. Confirm prod migration state (Supabase MCP, read-only) before deploy.
- **DEFERRED (owner decision 2026-07-02):** do NOT trigger the deploy yet — stay on local dev.
  Remaining next steps when resumed: (1) set 🔴+🟠 env vars, (2) confirm prod Supabase migrations,
  (3) fire first deploy by merging any small PR to `main` (proves reconnected webhook + ships tip
  in one shot), (4) verify landed via MCP.

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
| #7  | Remix variants JSONB read-modify-write race — REAL but **migration-gated** (atomic `jsonb_set` RPC); see session-7 CORRECTED | 🟠 |
| ~~#8~~  | ✅ **CLOSED s7 `da68f37a`** — `defaultDatasetId` guarded via `listRunItems()` | ✅ |
| ~~#11~~ | ✅ **CLOSED s7 `da68f37a`** — abort timer cleared in a `finally` | ✅ |
| ~~#12~~ | ✅ **STALE (s7)** — `AdaptFrameBody` was deleted; effect no longer exists | ✅ |
| ~~#10~~ | ✅ **CLOSED s7 `da68f37a`** — constructor fails fast on a missing token | ✅ |
| ~~#9~~  | ✅ **NOT REAL (s8)** — suffix allowlist + HTTPS + private-IP gate is safe; bare-apex admits only legit owned apexes. Close. See session-8 CORRECTED | ✅ |

---

## ✅ GSI Milestone — SHIPPED (2026-06-29)

- **v7.0 Numen GSI merged to `main`** via PR #91 (`b09c4f51`) + archived (`6d83bfb1`). All 7 phases
  done. Phase 07 (audience-as-front-door, mode-scoped skill menu) completed; audience-dropdown clip
  fixed via body-portal; 4 code-review warnings + 2 build-gate type errors fixed; 6-file divergence
  merge resolved (both sides integrated, full-suite-gated); squash-merged.
- ⚠️ Do NOT `git merge rework/engine-core` (Phase 0, already on main).
- **Deferred into the next milestone** (GSI `STATE.md` → Deferred Items + `todos/pending/`; see the
  per-worktree forensics in **`docs/WORKTREE-MERGE-AUDIT-2026-06-29.md` §4**):
  1. ~~**P05 code-review follow-ups** (`p05-code-review-followups.md`, low-med)~~ ✅ **ALL CLOSED (s9 verify,
     2026-07-02)** — todo → `todos/done/`. Every actionable WR finding is shipped + tested; only the
     "acknowledged/optional" Info items (non-commitments) remain:
     ~~**WR-01** text cap bypassed via file/image upload~~ ✅ **CLOSED (`a0d03f7d`)** — decoded-size caps
     (`MAX_FILE_TEXT_BYTES` ~1MB / `MAX_IMAGE_BYTES` ~10MB) checked from the base64 length BEFORE decode
     in `api/tools/profile/route.ts` → 400; test locks over-cap `file_text` → 400, `runProfile` not called. ·
     ~~**WR-03** Simulate 500 on resolvable non-General audience~~ ✅ **CLOSED (`a0d03f7d`)** — the route
     guards `resolveTier(audience) !== "Directional"` → 400 `audience_not_eligible` BEFORE `runSimulate`
     (the runner throw is now defense-in-depth only); test locks socials-mode → 400, not 500, runner not called. ·
     ~~**WR-04** composer video path silent no-op + orphaned storage~~ ✅ **CLOSED s8 (`3245f7e7`)** — both
     video paths surfaced their pre-`stream.start` failures (Test → new `submitError`; profile → `evidenceError`)
     + profile path best-effort removes the staged blob on server reject (Test path async → deferred to a
     server sweep, documented). Browser-proven (forced storage 500 → error renders).
  2. ~~**Simulate person-framing** (`simulate-reaction-person-framing.md`, medium, engine/`simulate-runner.ts`)
     — the baked **person** SIM reacts like a generic **content** critic ("scroll", "first second") not the
     person reacting to the *message*~~ ✅ **CLOSED s9 (2026-07-02)** — the person path (`subjectKind:"person"`)
     now BYPASSES the Flash content-critic engine and fires ONE deterministic behavioral call grounded in the
     baked signature (the same cached `BEHAVIORAL_SYSTEM_PROMPT_FLASH` the Profile READ rides — revising the
     05-05 Pitfall 5 boundary, which was the cause). Message + a `describePerson` subject description ride the
     D-08 USER data block; the reaction reads the ask/argument/tone, not a hook. PANEL path byte-untouched
     (Flash gate holds); band/fraction stay suppressed (Pitfall 2). Live before/after on a baked "Marcus Reyes":
     BEFORE *"Scrolled instantly. The first second offered zero visual intrigue…"* → AFTER *"Where are the
     baseline definitions and control parameters?… 'Excited' isn't a metric."* +4 tests; todo → `todos/done/`.
  3. ~~**`next build` tsc baseline** — `src/components/app/brand-deals/earnings-chart.tsx:97` recharts-3
     type mismatch~~ ✅ **CLOSED (session 5, `81f8294d`)** — the file was deleted by the MVP brand-deals
     removal, so the blocker is gone. Do NOT re-open. *(The full-project tsc still carries the ~17 pre-existing
     `Audience.mode` test-fixture errors — separate baseline, tracked under the eslint-refactor debt below.)*
  4. ~~**06-REVIEW (Predict verb)**~~ ✅ **CLOSED (session 6, `d52b9aaf`)** — **WR-01** `coercePredictResponse`
     now truncates factor/reasoning to the schema cap (shared `FACTOR_MAX`/`REASONING_MAX`), so a verbose
     model no longer fails Zod `.max()` and 500s the whole panel (+2 tests) · **WR-02** the scenario data
     fence now carries a random per-call `node:crypto` nonce (injectable via `deps.nonce` for tests) so
     untrusted bytes can't forge the closing delimiter (+3 tests). 39 flash/predict tests green.
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
| ~~E2~~ | ✅ **CLOSED s8 `52f657fe`** — shared `resolveThreadAudience` helper; 6 routes, −67 lines, +5 tests | ✅ |
| G3 | no-op stub | `cron/refresh-corpus/route.ts:23` | S |
| ~~A6~~ | ⚠️ **MIS-SCOPED (s8)** — blocked on stale `database.types.ts` (missing `mode`/`success_criterion`/`custom_context`) + repo's loose `unknown[]` `AudienceRow`; needs a types regen, not a cast strip. Owner-gated. See session-8 CORRECTED | 🟠 |
| A-T | target 3-position model (STEER via attributes; weights→REACT+REFINE) not implemented | — | M (feature) |
| S6 | `assertBlocksInRegistry` now caller-less after S4 cut → rewire vs cut | `block-registry.ts` | S |
| — | **Gen latency ~110s** — `qwen3.7-plus` generation is the E2E bottleneck (SIM half fixed S3′) | gen pipeline | L |
| — | Provider drift — competitor-intel `src/lib/ai/*` runs live on `deepseek-chat` + `gemini-2.5-flash-lite`; consolidation decision pending | `src/lib/ai/*` | M |
| — | ~~Dead-file delete — `ai/deepseek.ts` + `gemini.ts`~~ ❌ **RETIRED — FALSE (see CLOSED §, session 2):** they're LIVE via `intelligence-service.ts` → `/competitors` + `/api/intelligence`. Do NOT delete. Real item = the provider-consolidation row above. | `src/lib/ai/` | — |
| G-D/M2 | RAG dead — `engine/retrieval/` + `engine/corpus/` entangled (~2.4K LOC); surgical cut deferred | engine | L |
| D-R1 | drop Read judgment fields → pure-sensor (atomic 5-file + version bump) | — | M |
| — | Optional hardening (low): bounded gen-retry backoff, ~~SSRF bare-apex tighten (#9)~~ ✅ closed-not-real s8, apify try/catch (#8/#10) | — | S each |

---

## 🟢 Premium-thread (shell) — long-Generating UX gap

- **Symptom:** the progress spine parks on "Generating / Drafting against your audience" for
  the full ~52s of a hooks run, then flashes Self-judge → Simulating → Ranking in the final ms.
  **Working, not broken** — session-4 live log: `POST /api/tools/hooks 200 in 52s` (a 2nd run 55s),
  cards resolve after the await. **Rule of thumb: >90s with no cards = a real SSE bug, not this.**
- **Cause (not a bug):** `src/app/api/tools/hooks/route.ts:186` — `runHooksPipeline` is one
  awaited call (GENERATE→SIM→GATE→RANK). The route emits `Generating: active` before it (`:182`),
  marks it done (`:198`), then (comment at `route.ts:200–205`) emits the remaining stages back-to-back
  (`:206–209`) because *"the runner doesn't expose per-phase callbacks."* All real latency buckets into one stage.
- **Clean fix:** cross-lane engine ask — per-phase callbacks / `detail?` field on the stage SSE
  for a live counter (memory `lane-shell-premium-thread` flags this as the ONLY deferred shell item).
  The seam exists: `progress-checklist.tsx:34` already renders `stage.detail ?? STAGE_COPY[name]`,
  so the engine just needs to stream `detail` on the stage event.
- **Cheap client win** (file: `src/components/thread/progress-checklist.tsx`, ~`:86` active sub-detail):
  cycle the sub-detail copy + show elapsed seconds during the Generating stage so it shows life (no faked
  stage completion — respects the D-02 "real not timed" rule).
- Size: S (client win) / M (engine callbacks).

**Shell-lane peripheral chrome (separate from premium-thread; code-verified on main):**
- ~~🔴 `src/components/app/auth-guard.tsx:71` `bg-[#0A0A0A]` + `:73` `border-zinc-800`~~ ✅ **CLOSED
  (session 6, `3fe62a8b`)** — flat-warm tokens + added to the `reskin-matte` gate.
- `settings/billing-section.tsx` — session notes claimed zinc/glass; grep found none on main → likely
  already resolved (#69/#71). Verify visually then drop. · Sidebar inset — claimed, not re-verified, low.

**Shell loading-states backlog — LARGELY OPEN** (SSOT `docs/subsystems/ui-loading-states.md`; full
file:line + code-verification in `WORKTREE-MERGE-AUDIT-2026-06-29.md` §A). Only A1–A4 + some #72 route
skeletons shipped; memory's "only the engine ask is deferred" was wrong. Still open on main:
- **Theme A:**
  - ✅ **A7 optimistic thread delete DONE (session 10, `0256d187`)** (`use-threads.ts` `useArchiveThread` —
    `onMutate` remove + rollback + settle).
  - ✅ **Explore double skeleton+checklist DONE (session 10)** (gated the skeleton behind
    `stages.length===0`, matching every other view; caption still shows pre-stages).
  - ✅ **A6 Script/Remix skeleton caption DONE (session 11)** — but NOT the way the SSOT framed it.
    Investigation: the skeleton only renders while `stages.length===0` (pre-first-stage), and the FIRST
    SSE event both routes emit is a `stage` (`Generating`/`Resolving`) → the skeleton is replaced the
    instant streaming produces anything. The full `statusMessage`→caption plumbing (like hooks/ideas)
    would render **nothing** (it's vestigial there too — status fires *after* the first stage; generation
    is already narrated by `ProgressChecklist` `STAGE_COPY`). The honest fix for the actual symptom
    ("generic *Running your skill…*") is a **specific static caption**: `script-thread-view.tsx` →
    "Drafting your script…", `remix-thread-view.tsx` → "Reworking the video for your audience…". 1 line each.
  - ⛔ **A5 Account-Read dedicated loading view — BLOCKED, SSOT PREMISE WAS WRONG (session 11):** the SSOT
    claimed "Account Read is delivered through the chat surface" — it is **not delivered at all**. Account
    Read is a **built-but-UNWIRED** skill: `/api/account-read` SSE route (emits `status`/`fallback`/`done{block}`)
    + refined `account-read-block.tsx` renderer exist (last touched #74), but **zero client code triggers
    it** — no `fetch`/`EventSource`/stream-hook, not a `ToolId`, no thread-view slot, no button. Building a
    shaped loading skeleton now = **orphan UI for an unreachable feature** (dead code, untestable). A5 is
    therefore **blocked on first wiring the trigger** — a real feature needing a product decision on the
    entry point (skill chip? profile-page button? chat quick-action?), NOT a refine loading-view fix.
- **Theme B — route skeletons:** ✅ `home` (P0) **DONE** (session 6, `deb7ced4`) · ✅ **`library` · `audience` ·
  `audience/[id]` (P1) + `audience/new` (P2) DONE (session 8, `c100c9f8`)** — each mirrors its page's real
  layout verbatim (SavedShelf chrome / AudienceManager list / DetailSkeleton copy / form field-groups); tsc +
  eslint clean, all 4 render with 0 console errors, skeleton renders cleanly in-shell. `competitors/[handle]` +
  `/compare` (P3) were **already covered** (own `loading.tsx` pre-existing — handoff was stale). `analyze` (P0)
  **deferred** — its `layout.tsx:26 fallback={null}` is the inert inner-Reading Suspense; the real fix is a
  Reading-internal loading state (see the session-6 CORRECTION). **Theme B is now effectively complete** bar
  the deferred `analyze` Reading-internal state.
- **Theme C — MATTE/cleanup (session 10, `0256d187`):**
  - ✅ **Button/Input loading→`<Spinner>` DONE** — last two lucide `Loader2` holdouts swapped for the
    design-system `<Spinner>` (`button.tsx`/`input.tsx`).
  - ✅ **pricing spinner DONE** — bespoke ring-spinner `<div>` → `<Spinner size="sm">` (`pricing-section.tsx`).
  - ✅ **board `audience-constants.ts` coral `#FF7F50` DONE** — resolved by **deleting the dead
    `MARKER_RING_COLOR` export** (zero importers; it held the last `#FF7F50` in `src/`).
  - ⛔ **toast/card inset-shine — DEFERRED (editing would be WRONG):** the matte guard's own scope note
    (`reskin-matte.test.ts:132–135`) **sanctions** `inset 0 1px 0 0 rgba(255,255,255,0.05)` — it's the
    gold-standard (billing-section uses it, verified clean). `card.tsx:61` is exactly that sanctioned form.
    `toast.tsx`'s real violation is `backdrop-filter` **glass**, which is the 🟠 owner-gated
    `ui/{card,select,toast}` GSI-rippling deferral. (Note: `CLAUDE.md` "no inset-shine" contradicts the
    enforced gate — flagged for owner to reconcile.)
  - ⏸️ **stale "coral" JSDoc — DEFERRED:** the coral type helpers (`CoralStep`/`GradientToken 'coral'`/
    `colorVar('coral')`) in `types/design-tokens.ts` are **unused outside that file** (dead scaffolding), but
    it's a foundational types file with zero user value → belongs in the dead-code/eslint-un-ignore pass, not a cosmetic batch.
  - ⏸️ **shared `<SurfaceEmptyState>` extract — DEFERRED:** 20+ disparate empty-state call sites; a real
    refactor needing shared-API design, not an S cleanup.
  - ✅ ~~delete dead `GlassToast` + `GlassSkeleton`~~ **DONE (session 2, `6be82815`)**.

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

## 🟢 Frame (all PRs merged; worktree clean) — triaged 2026-06-30 (session 3, live-verified)

**Only one item is actually frame-scoped + actionable:**
- ~~**`competitors/detail/video-card.tsx` lucide → phosphor**~~ ✅ **CLOSED (session 6, `0dd5f846`)** —
  Eye/Heart/ChatCircle/ShareNetwork; GSI merged so the seam was stable. tsc clean.
- **`format` save path** — speculative; **no confirmed defect → SKIP** unless a real bug surfaces.

**NOT frame lane (routed elsewhere — do not pick up here):**
- **Shared primitives `ui/{card,select,toast}.tsx`** — glass still live but editing ripples into GSI
  surfaces → **defer** (GSI-adjacent). M.
- **GSI-owned verb surfaces — DO NOT TOUCH** (GSI milestone owns these; token-seam rule = polish *around*,
  not *into*): `app/{content-form,test-type-selector,survey-form,tiktok-account-selector,delete-test-modal}.tsx`,
  `command-bar/CommandBar.tsx`, `primitives/{CommandPalette,GlassPanel}.tsx`, `tooltips/contextual-tooltip.tsx`
  (full Raycast 137deg glass holdouts — spot-verified still present).
- **Shell lane** (`lane/shell`): `auth-guard.tsx` P0 raw `#0A0A0A`+`border-zinc-800` · `settings/billing-section.tsx`
  zinc/glass · sidebar inset. *(Also listed under §Shell above.)*

**✅ Confirmed NOT debt — sanctioned, leave alone (re-flagged by auditors otherwise):**
`saved/saved-item-card.tsx:334` + `competitors/remove-competitor-button.tsx:71` `blur(4px)` scrims (legit
overlay scrims, not chrome glass) · `GlassPill.tsx` 137deg = legacy *comment* only (primitive is matte) ·
`globals.css` token defs · `platforms.ts` brand colors · `__tests__/*` matte guards.

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
  text-patterns half + throwaway harness`). ✅ **Verified DISCARD-safe (session 5)** — fully superseded
  by main (#80 + later); rebasing the WIP adds only 5 lines. Prune when the owner lifts the worktree hold. S.
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
