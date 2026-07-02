# Handoff — Next Session (refine lane)

> Pick-up doc for a FRESH session continuing the post-GSI refinement work in `~/virtuna-refine`
> (branch `lane/refine`, off `origin/main`). Everything below is verified on `main` as of 2026-06-29.
> The four audit docs are the detail; this is the map + the **"merged-but-not-visible-in-UI"** catalog
> (the thing the owner flagged: a lot is shipped but you can't find it in the running app).

## ⚑ MVP decisions (owner) — status
- ✅ **DONE (session 5, `81f8294d`) — Remove brand-deals (Partnerships) from MVP.** Whole vertical deleted
  in one `git revert`-able commit (45 files, −4,216); shared-file edits (nav/barrel/middleware/2 tests)
  restored by the same revert. `tsc`: 0 new source errors; the `earnings-chart.tsx:97` blocker is gone.
  **Restore later: `git revert 81f8294d`.** Detail in OPEN-DEBT "CLOSED — session 5".

## ⏱ Lane status (end of refine session 5, 2026-07-02)
`lane/refine` **MERGED to main** via the lane PR (2026-07-02). Session-5 work: brand-deals removal
(`81f8294d`) + doc reconcile. Prior lane content (sessions 1–4): GSI verbs surfaced · `/discover`→`/feed` ·
3 routes→nav · Theme-C glass deleted · Marcus-Reyes dedup + profile-dedup fix. Trunk now carries all of it.
**Next by value:** 06-REVIEW Predict WR-01 (coercion overflow 500s the now-surfaced Predict verb) ·
`auth-guard.tsx:71` raw `#0A0A0A` · P0 route skeletons (home/analyze). See §"open-work backlog".

## Start here
```
cd ~/virtuna-refine            # branch lane/refine (= origin/main + the refine docs)
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack --port 3300
# auth: e2e-test@virtuna.local / e2e-test-password-2026  (npx tsx e2e/create-test-user.ts to ensure)
```
Read the four audit docs in `docs/` (all on this lane):
1. `OPEN-DEBT-AUDIT-2026-06-29.md` — the open-debt ledger (SSOT).
2. `WORKTREE-MERGE-AUDIT-2026-06-29.md` — per-worktree landed-vs-missing + deep `.planning` deferred sweep.
3. `DEV-VERIFICATION-2026-06-29.md` (+ `docs/verification/*.png`) — live browser pass, working-vs-stub.
4. `FINAL-AUDIT-PR-COMMIT-2026-06-29.md` — PR/commit history + doc-coverage attestation.

## Coverage attestation (what was/wasn't read)
- **PRs/commits:** fully audited — 80 merged / 4 closed-unmerged / 0 open; 2,968 commits. Only stranded
  work = closed PR **#60 creator-voice** (330 branch-ahead, re-extract).
- **Lane `.planning` (shell/frame/polish/discover-feed):** **proven byte-identical** — all 4 share the
  SAME inherited landing-v2-era `.planning` (`LANDING-VISION`, `BRIEF-P0/P1/P2`, `AUDIT-ui-surfaces-260624`,
  phases `foundation-shell`→`proof-conversion`). The lanes never ran their own GSD milestones; they shipped
  via PRs + the HANDOFF docs (`HANDOFF-premium-thread`, `HANDOFF-FEED-UI-REFINEMENT`, `HANDOFF-ui-restrained`
  — all read). The one previously-unread lane doc, `AUDIT-ui-surfaces-260624.md`, is **historical** (2026-06-24
  de-Claude era; every gap it found — chat shell / skill cards / audience / library scaffolds — shipped via
  #73/#75/#85/#88 + GSI). **Nothing lane-specific is unaccounted for.**
- **GSI milestone:** STATE / ROADMAP (7/7 phases, 30/30 reqs) / all 7 REVIEWs / todos / deferred-items read.
- **Engine SSOT `DISSECTION-BACKLOG.md`:** read in full; the OPEN-DEBT engine list matches it exactly.
- **NOT read (by design):** the ~2,300-file historical `.planning` archive of completed milestones — settled/
  superseded; only residual risk is a deferral buried in an archived phase note never promoted to STATE/REVIEW/
  todo (low; a full archive sweep would be a token-heavy multi-agent pass — ask before running).

---

## 🔦 Merged-but-NOT-visible in the UI — the catalog (this is the owner's main concern)

Verified live on :3300. It is NOT env-flags (there are none in the UI). The gap is **gating / nav / wiring /
not-built**, in 5 buckets:

> **✅ SESSION 2 UPDATE (2026-06-30, `lane/refine` tip `e0e06dba`, pushed not-merged):** buckets **A**, **B**,
> and **E** are now RESOLVED (annotated inline below). Remaining live-UI gaps = **C** (Phase-3 analyze stubs)
> and **D** (route skeletons, the inset-shine MATTE leftovers, premium-thread Generating, GSI Part-B modal).

### A. ✅ RESOLVED (session 2) — Mode-gated GSI verbs now always visible
- **Profile / Simulate / Predict verbs** are fully built + wired, but the skill menu is **audience-mode-scoped**.
  With the DEFAULT socials "General" audience you see creator skills (Explore/Ideas/Hooks/Script/Remix/Test/Chat);
  the 3 verbs only appear after selecting a **general-mode** audience (Analyst Panel / Hiring Panel / a Profiled
  person SIM). The 3 Home chips ("Test an idea / Profile a chat / Predict an outcome") are the only default entry
  point. **Why it feels missing:** a creator landing on the default audience never sees the GSI verbs in the menu.
  *Lever:* surface the verbs more (e.g. always-visible "General" section, or a verb switcher) — design decision.
  **✅ FIXED `4a5748b5`:** shared `isSkillVisible()` shows the 3 verbs in an always-visible **General** group
  in every audience mode (popover + `/` slash). No-General-audience Simulate/Predict still funnels to Build.

### B. ⚠️ MOSTLY RESOLVED (session 2) — Built routes were NOT in the primary nav
The sidebar had only **Audience / Library / Feed**. These shipped routes had **no nav entry**:
- `/competitors`, `/competitors/[handle]`, `/competitors/compare` — **✅ added to sidebar `2c139870`** (Binoculars).
  (Also where the `video-card` lucide + the eslint-`globalIgnores`'d `competitors/**` live — both still open.)
- `/brand-deals` — ✅ **REMOVED from MVP (session 5, `81f8294d`)** per owner decision; whole vertical gone,
  restore with `git revert 81f8294d`. (This also deleted `earnings-chart.tsx` → its tsc error is gone.)
- `/referrals` — **✅ added to sidebar `2c139870`** (Gift). Renders a Pro-gated upsell.
- `/discover`, `/discover/...` — **✅ now `redirect("/feed")` `f508a6df`** (was a live duplicate of `/feed`).
- `/saved` — **already** a `redirect("/library")` (handoff was stale — it was never a live duplicate).
- `/analyze`, `/analyze/[id]` — the Reading; reached by running Test/a Read, not nav (intentional, left as-is).
*Outcome:* all 3 real surfaces wired to nav; both superseded routes redirect. Nothing left to decide here.

### C. Built but stub / "coming soon" (visible, intentionally inert)
- Feed Hooks "from your analyzed videos · 0" · Channels **Describe** (Search disabled) · Videos **Status/Analyzed**
  filter — all three = the unbuilt **Phase-3 analyze pipeline**.

### D. NOT built yet → nothing to see (so it reads as "missing")
- **Theme B route loading skeletons** — `home`, `analyze`, `library`, `audience`, `audience/[id]`, `audience/new`,
  `feed/channels`, `feed/hooks`, `saved` have no `loading.tsx` (blank/generic flash on nav). SSOT `ui-loading-states.md` §2.
- **Theme C** MATTE debt — toast/card inset-shine still present. (`GlassToast`/`GlassSkeleton` ✅ deleted session 2 `6be82815`.) §3.
- **A5/A6/A7** loading states (account-read view, script/remix caption, optimistic delete). §1.
- **Premium-thread "Generating"** parks ~52s then flashes the rest (`hooks/route.ts:182/186/198`).
- **GSI:** per-persona reaction MODAL (Part B) — note the cards DO have a "See how the room reacted to this hook"
  button now (AudienceLens opens), so verify what's actually missing vs the deferred full modal.

### E. ✅ RESOLVED (session 2) — Data-quality dupes
- **3× "Marcus Reyes"** general audiences in the switcher — Profile-bake created duplicates (no dedup on
  re-profiling the same chat). **✅ FIXED `e0e06dba`:** `upsertProfileAudience()` updates a same-name General
  SIM in place instead of inserting (+5 tests); prod DB cleaned to the single newest row (`fb6047a7`).

---

## The open-work backlog (consolidated — full detail + file:line in the 4 docs)
- 🔴 **Blocking:** Vercel prod stuck on the Jan-init commit (5mo undeployed; auto-deploy disconnected) · rate-limit HARDEN-01.
- 🟠 **GitHub issues #7–#12** (remix race, apify guard, abort-timer leak, missing dep, apify-token, SSRF-low).
- 🟠 **GSI carry-forward:** p05 WR-01/03/04 · Simulate person-framing · `earnings-chart.tsx:97` next-build tsc · 06-REVIEW Predict WR-01 (coercion overflow 500s) / WR-02 · 03-REVIEW WR-04/IN-02-04.
- 🟢 **Engine (DISSECTION-BACKLOG):** A6 · A-T · S6 · R3 · R5 · E2 · G3 · G-D/RAG · gen-latency ~110s · provider-*consolidation* (`ai/*` runs live on deepseek+gemini). ❌ NOT "delete dead `ai/*.ts`" — that claim is FALSE (files are live via `/competitors`; see OPEN-DEBT CLOSED §).
- 🟢 **Shell:** the Theme A/B/C backlog above (`ui-loading-states.md`) + auth-guard `#0A0A0A`.
- 🟢 **Frame** (triaged S3): only `competitors/detail/video-card.tsx` lucide→phosphor (4 icons, on GSI seam) is frame-scoped. `ui/{card,select,toast}` glass = GSI-adjacent defer; GSI-owned verb glass = DO NOT touch; `format` save path = skip (speculative). Sanctioned-not-debt list in OPEN-DEBT §Frame.
- 🟢 **Feed:** the 3 analyze-pipeline stubs + trending-metric backfill + no-download ingest + multi-platform corpus + Save-filter persistence verify.
- 🔸 **Post-GSI refactor:** ~20 LIVE files in `eslint.config.mjs` globalIgnores (refactor + un-ignore).
- 🧹 **Hygiene:** retire 4 landed worktrees (shell/frame/discover-feed/numen-gsi) + prune merged branches + 3 stale stashes + re-extract #60 creator-voice. (Owner said DON'T retire yet.)

## Suggested first moves for the fresh session
1. ✅ **DONE (session 2)** — nav/visibility story (buckets A + B): GSI verbs surfaced, `/discover`→`/feed`,
   3 routes wired to the sidebar.
2. ⚠️ **PARTLY DONE (session 2)** — quick wins: ✅ Marcus-Reyes dedup, ✅ Theme C dead-glass deletes; the
   `ai/*.ts` delete was ❌ FALSE (files live — not done, retired). Still open: **A6 caption one-liners**.
3. ✅ **DONE (session 5, `81f8294d`)** — brand-deals removed from MVP as one `git revert`-able commit
   (route + components + api + hooks + types/libs + nav/barrel/middleware/2 tests). `tsc`: 0 new source
   errors; the `earnings-chart.tsx:97` blocker is gone (superseded). Restore later: `git revert 81f8294d`.
4. **Then** **06-REVIEW Predict WR-01** (coercion overflow 500s the now-surfaced Predict verb) · `auth-guard`
   raw `#0A0A0A` · P0 route skeletons (home/analyze) · video-card lucide→phosphor.
5. **Then** pick from the backlog by value (the Vercel deploy is the only true launch-blocker).

## Gotchas
- Dev heap 3072+ (768 OOMs on browser waits). Use `node ./node_modules/next/dist/bin/next dev` (npx wrapper breaks dev).
- `next build` clobbers a live dev's `.next` → restart dev after a build.
- Tests: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)).
- Trunk stays clean on origin/main; lane scaffolding commits were hook-bypassed (not pushed) — push on first real PR.
