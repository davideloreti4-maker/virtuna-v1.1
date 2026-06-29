# Final Audit — PRs, Commits, Doc Coverage — 2026-06-29

> Closing audit over the whole repo history (all PRs + commits) and an honest statement of **which
> documents/memory were actually read** across the 4 lane worktrees + the numen-gsi milestone. Completes
> the trilogy: `OPEN-DEBT-AUDIT` (what's open) · `WORKTREE-MERGE-AUDIT` (per-worktree landed-vs-missing +
> deferred sweep) · `DEV-VERIFICATION` (live browser) · **this** (PR/commit history + coverage attestation).

---

## 1. Pull-request audit (all states)

**80 merged · 4 closed-unmerged · 0 open.** (`gh pr list --state all`, verified 2026-06-29.)

### Closed-unmerged — disposition (the only place work could be stranded)
| PR | Branch | Disposition | Stranded? |
|----|--------|-------------|-----------|
| #1 | `milestone/mvp-launch` | branch **pruned**; the original MVP (auth/landing/onboarding/payments) shipped via the app's evolution, superseded by later milestones | ❌ no |
| #40 | `fix/tsc-clean-gate` | branch **pruned**; tsc-gate work superseded by #43/#47 (gate→0) | ❌ no |
| #42 | `docs/s3-handoff` | branch **pruned**; S3 handoff doc superseded by #49 (S3′ shipped) | ❌ no |
| #60 | `feat/creator-voice-sample` | **still on origin, 77 main-ahead / 330 branch-ahead** — the un-mergeable +62k auto-wip monster | ⚠️ **YES** — the creator voice-sample feature is real unshipped work; re-extract cleanly (GSI grounding §4.3). Already tracked as a parked branch. |

### Merged — what shipped (the post-v6.0 wave, #62→#91)
- **Pre-GSI prod-readiness (#62–#68):** deferred-inventory log, GAP-REMIX-01 fix (#63), dead `/api/outcomes` cut (#64, closes #41), readiness-sprint docs (#65), GSI-worktree map (#66), eslint-gate green-up (#67), UI-lane rule retarget (#68).
- **Shell lane (#69-ish, #70, #72, #85, #88):** settings reskin, multi-thread sidebar, chrome pass (error/404 + route skeletons), premium thread PR-1 (A1/A2/A3) + PR-2 (A4 + conversational frame).
- **Cards/polish lane (#73, #74, #76, #78, #80):** skill-card redesign, Account-Read Tier C, Discover+Remix covers, honest IG reject, Write-to-strengths.
- **Frame lane (#71, #77, #79, #81, #82, #83, #84, #86) + library (#75):** settings/auth glass→matte, dead-code sweep, outlier save-path + cover echo, matte GlassPill, empty-state + token-hygiene + confirm-dialog sweeps, library elevation.
- **Landing (#87):** credibility wall + differentiated visuals + eyebrow headings.
- **Discover-feed (#89, #90):** persistent Videos feed (watched+trending) + Sandcastles-grade Channels/Videos refinement + Hooks vault.
- **GSI v7.0 (#91):** the whole synthetic-population milestone (Profile/Simulate/Predict).
- (Engine-rework #53–#58 + earlier dissection PRs landed pre-#62.)

**All 80 merged PRs' content is on `main`** (the per-lane tree-parity verification is in `WORKTREE-MERGE-AUDIT`).

---

## 2. Commit audit
- **2,968** total commits on `main`; **573** in the last 30 days; **74** PR squash/merge commits.
- The 30-day burst = the post-v6.0 UI-lane wave + discover-feed + GSI, all squash-merged (clean linear-ish history; no stray merge commits on `main` outside the PR squashes).
- **Trunk hygiene:** the only non-`origin/main` commit was the stray auto-wip `120ea41b` (dropped; its 3 real docs rescued onto `lane/refine`). 3 stale global stashes remain (droppable).

---

## 3. GSI milestone completeness
- **ROADMAP: all 7 phases `[x]` complete** (Engine/Pack-Seam · Trustworthy-SIM Spike · General-Population+Honesty · Input-Adapter · Profile→Simulate Wow · Predict Verb · Audience-as-Front-Door). **30/30 v1 requirements** mapped (100% coverage). 7/7 phase dirs built. Phase 5 Task-2 + Phase 7 Task-4 human-verifies PASSED.
- Squash-merged as #91; `git diff origin/main..milestone/numen-gsi` = **0 lines** (fully landed).
- **Deferred (carry-forward, not lost):** `todos/pending/p05-code-review-followups.md` (WR-01/03/04), `simulate-reaction-person-framing.md`, the `earnings-chart.tsx:97` tsc-baseline, **06-REVIEW Predict WR-01/WR-02** (appear unresolved), 03-REVIEW WR-04/IN-02-04, and v2 scope (marketplace/Pack#2/self-calibration). All in `OPEN-DEBT-AUDIT` + `WORKTREE-MERGE-AUDIT` §C.

---

## 4. Engine-debt reconciliation vs the SSOT
Cross-checked `OPEN-DEBT-AUDIT`'s engine list against **`docs/DISSECTION-BACKLOG.md`** (the engine SSOT,
read in full). **They match** — the open set is exactly: **A6** (`(supabase as any)` casts), **A-T**
(target 3-position model), **S6** (`assertBlocksInRegistry` caller-less), **R3** (0.5/0.5 blend, post-launch
A/B), **R5** (`wave0 confidence:1.0` + unused `applyCtaPenalty`/`FeatureVector`), **E2** (audience-resolve
helper extract), **G3** (`refresh-corpus` no-op stub), **G-D/M2** (RAG dead, surgical cut deferred ~2.4K LOC).
Everything else in the dissection is FIXED/RESOLVED (16+5). The numen-tools `DEBT-BACKLOG.md` and parts of
memory **over-report** (the SSOT explicitly flags this — e.g. the flywheel-pin "dormant" claim was DISPROVEN).

---

## 5. Document & memory coverage — honest attestation

**Did I read *every* document in the 4 worktrees + GSI? No — and that would be the wrong target.** Each
worktree's `.planning/` holds **~450–511 `.md` files**, but those are the **accumulated historical archive**
of every completed milestone (mvp-launch, backend-completion, result-surface, engine-hardening, viral-remix,
engine-opt, mvp-ready, numen-rework, landing-v2, numen-tools, …) — settled, shipped, superseded. The lane
worktrees (polish/shell/frame/discover-feed) **share** this inherited archive; they did not run their own GSD
milestones (they shipped via PRs), so their unique planning surface is just the HANDOFF docs.

**What I DID read + verify (the open-work-relevant set):**
- **Lane handoffs:** `HANDOFF-premium-thread.md` (shell), `HANDOFF-FEED-UI-REFINEMENT.md` (feed),
  `HANDOFF-ui-restrained.md` (polish — found stale/historical).
- **Shell SSOT:** `docs/subsystems/ui-loading-states.md` (the full Theme A/B/C backlog — surfaced the
  largely-unshipped route-skeleton + MATTE debt).
- **GSI milestone:** `STATE.md` (Deferred Items), `ROADMAP.md` (7/7 phase completeness), `todos/pending/*`,
  all 7 phase `REVIEW.md` files (01–07; 03 + 06 had open/deferred markers — captured), `deferred-items.md`.
- **Engine SSOT:** `docs/DISSECTION-BACKLOG.md` (full) — reconciled, matches.
- **Live app:** authed browser pass of every lane surface (`DEV-VERIFICATION`).
- **Memory:** the `MEMORY.md` index + the lane-relevant topic files (`refine-lane`, `lane-shell-premium-thread`,
  `discover-feed-milestone`, `library-elevation`, `skill-cards-ui-refinement`, `ui-lanes-vs-gsi`,
  `numen-gsi-vision`, `engine-model-assignment`, `skills-grounding-audit`). Memory was found to **over-report**
  in two places, now corrected: (a) shell "only the engine ask deferred" → actually a large loading-states
  backlog; (b) feed filters "deferred" → actually shipped in #90.

**What I deliberately did NOT read** (and why it's safe): the ~2,300 archived phase-plan/research/summary/
sketch files across completed milestones. They describe *shipped* work; their only open residue (deferred-items
within them) was swept — e.g. the inherited landing-era `01-foundation-shell/deferred-items.md` was checked and
found **superseded** (its lint debt → #67; its dead `showcase/` refs → deleted #77).

**Confidence:** the open-work picture is complete to the granularity of "anything still actionable has a
`file:line` or a PR/branch pointer in one of the four refine docs." If you want belt-and-suspenders, the one
residual risk is a deferred item buried inside an *archived* milestone's phase notes that was never promoted to
a STATE/REVIEW/todo — low probability (GSD promotes deferrals to those surfaces), but a full archive sweep would
need a dedicated multi-agent pass (token-heavy; not run without your OK).

---

## 6. Net
- **Merges:** 80/80 PR content on `main`; the only unshipped real work is closed-PR **#60 creator-voice** (re-extract).
- **History:** clean (one stray auto-wip dropped; 3 stale stashes).
- **GSI:** 100% complete (7/7 phases, 30/30 reqs); deferred = carry-forward todos + 06-REVIEW WRs + v2.
- **Engine debt:** reconciled to the DISSECTION-BACKLOG SSOT (8 open items, all 🟡/🟢).
- **Coverage:** open-work docs + SSOTs + live app verified; the 2,300-file historical archive intentionally not re-read (settled/superseded).
- **All documented on `lane/refine`:** `OPEN-DEBT-AUDIT` · `WORKTREE-MERGE-AUDIT` · `DEV-VERIFICATION` · this doc.
