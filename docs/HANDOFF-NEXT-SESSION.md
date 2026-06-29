# Handoff — Next Session (refine lane)

> Pick-up doc for a FRESH session continuing the post-GSI refinement work in `~/virtuna-refine`
> (branch `lane/refine`, off `origin/main`). Everything below is verified on `main` as of 2026-06-29.
> The four audit docs are the detail; this is the map + the **"merged-but-not-visible-in-UI"** catalog
> (the thing the owner flagged: a lot is shipped but you can't find it in the running app).

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

### A. Mode-gated — visible only with the right audience selected  ← the big GSI one
- **Profile / Simulate / Predict verbs** are fully built + wired, but the skill menu is **audience-mode-scoped**.
  With the DEFAULT socials "General" audience you see creator skills (Explore/Ideas/Hooks/Script/Remix/Test/Chat);
  the 3 verbs only appear after selecting a **general-mode** audience (Analyst Panel / Hiring Panel / a Profiled
  person SIM). The 3 Home chips ("Test an idea / Profile a chat / Predict an outcome") are the only default entry
  point. **Why it feels missing:** a creator landing on the default audience never sees the GSI verbs in the menu.
  *Lever:* surface the verbs more (e.g. always-visible "General" section, or a verb switcher) — design decision.

### B. Built routes NOT in the primary nav (reachable only by deep-link / contextual entry)
The sidebar has only **Audience / Library / Feed**. These shipped routes have **no nav entry**:
- `/competitors`, `/competitors/[handle]`, `/competitors/compare` — competitor-intel subsystem (also the
  `video-card` lucide + the eslint-`globalIgnores`'d `competitors/**` live here).
- `/brand-deals` — monetization surface (earnings, deals, affiliate cards).
- `/referrals` — referral stats.
- `/discover`, `/discover/...` — the OLD discover surface; **superseded by `/feed`** but route still live (decide: redirect/retire vs link).
- `/saved` — the OLD saved shelf; **superseded by `/library`** but route still live (same decide).
- `/analyze`, `/analyze/[id]` — the Reading; reached by running Test/a Read, not nav (intentional).
*Lever:* decide per route — add to nav, move under a menu, or retire the superseded ones (discover/saved).

### C. Built but stub / "coming soon" (visible, intentionally inert)
- Feed Hooks "from your analyzed videos · 0" · Channels **Describe** (Search disabled) · Videos **Status/Analyzed**
  filter — all three = the unbuilt **Phase-3 analyze pipeline**.

### D. NOT built yet → nothing to see (so it reads as "missing")
- **Theme B route loading skeletons** — `home`, `analyze`, `library`, `audience`, `audience/[id]`, `audience/new`,
  `feed/channels`, `feed/hooks`, `saved` have no `loading.tsx` (blank/generic flash on nav). SSOT `ui-loading-states.md` §2.
- **Theme C** dead-glass + MATTE debt (`GlassToast`/`GlassSkeleton` still present; toast/card inset-shine). §3.
- **A5/A6/A7** loading states (account-read view, script/remix caption, optimistic delete). §1.
- **Premium-thread "Generating"** parks ~52s then flashes the rest (`hooks/route.ts:182/186/198`).
- **GSI:** per-persona reaction MODAL (Part B) — note the cards DO have a "See how the room reacted to this hook"
  button now (AudienceLens opens), so verify what's actually missing vs the deferred full modal.

### E. Data-quality dupes (visible but messy)
- **3× "Marcus Reyes"** general audiences in the switcher — Profile-bake created duplicates (no dedup on
  re-profiling the same chat). Worth a dedup/cleanup + a guard in `runProfile`/`createAudience`.

---

## The open-work backlog (consolidated — full detail + file:line in the 4 docs)
- 🔴 **Blocking:** Vercel prod stuck on the Jan-init commit (5mo undeployed; auto-deploy disconnected) · rate-limit HARDEN-01.
- 🟠 **GitHub issues #7–#12** (remix race, apify guard, abort-timer leak, missing dep, apify-token, SSRF-low).
- 🟠 **GSI carry-forward:** p05 WR-01/03/04 · Simulate person-framing · `earnings-chart.tsx:97` next-build tsc · 06-REVIEW Predict WR-01 (coercion overflow 500s) / WR-02 · 03-REVIEW WR-04/IN-02-04.
- 🟢 **Engine (DISSECTION-BACKLOG):** A6 · A-T · S6 · R3 · R5 · E2 · G3 · G-D/RAG · gen-latency ~110s · provider-drift + delete dead `ai/{deepseek,gemini}.ts`.
- 🟢 **Shell:** the Theme A/B/C backlog above (`ui-loading-states.md`) + auth-guard `#0A0A0A`.
- 🟢 **Frame:** `video-card` lucide→phosphor · `ui/{card,select,toast}` glass.
- 🟢 **Feed:** the 3 analyze-pipeline stubs + trending-metric backfill + no-download ingest + multi-platform corpus + Save-filter persistence verify.
- 🔸 **Post-GSI refactor:** ~20 LIVE files in `eslint.config.mjs` globalIgnores (refactor + un-ignore).
- 🧹 **Hygiene:** retire 4 landed worktrees (shell/frame/discover-feed/numen-gsi) + prune merged branches + 3 stale stashes + re-extract #60 creator-voice. (Owner said DON'T retire yet.)

## Suggested first moves for the fresh session
1. **Decide the nav/visibility story** (bucket A + B) — it's the highest-leverage "why can't I see my work"
   fix and it's mostly wiring/design, not new features: surface the GSI verbs + decide discover/saved/competitors/
   brand-deals/referrals nav placement vs retire.
2. **Quick wins:** A6 caption one-liners, the Marcus-Reyes dedup, delete dead `ai/*.ts`, Theme C dead-glass deletes.
3. **Then** pick from the backlog by value (the Vercel deploy is the only true launch-blocker).

## Gotchas
- Dev heap 3072+ (768 OOMs on browser waits). Use `node ./node_modules/next/dist/bin/next dev` (npx wrapper breaks dev).
- `next build` clobbers a live dev's `.next` → restart dev after a build.
- Tests: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)).
- Trunk stays clean on origin/main; lane scaffolding commits were hook-bypassed (not pushed) — push on first real PR.
