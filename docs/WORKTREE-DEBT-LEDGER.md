<!-- CANONICAL (tracked) — supersedes the local ~/virtuna-v1.1/.planning/WORKTREE-DEBT-LEDGER.md. Edit here; it ships in the repo so web/other-machine sessions see it. -->

# Worktree + Branch + Debt Ledger

> **The map.** Status of every branch/worktree + an index to the debt SSOTs (§3).
> **Refreshed 2026-06-26** from a live `git` survey, then a **full cleanup pass same day**
> (see §5): stale PR #42 closed; 4 retired worktrees removed; 49 branches pruned →
> **63→13 remote branches**. Every branch carrying unmerged commits was `archive/<name>`-tagged
> on origin BEFORE deletion (recoverable: `git checkout archive/<name>`). The 13 survivors =
> trunk + 8 worktree-backed tracks + the ui-restrained Cursor WT + creator-voice PR #60 + 2
> parked decisions. Pointer/triage doc — indexes the detailed SSOTs, doesn't duplicate them.
>
> Legend: ✅ delete-safe · 🟢 keep-active · 🟡 dormant/parked (real, paused) ·
> 🗄️ squash-dangling (content on main, branch is history) · 🧹 cursor-scratch ·
> ⚰️ ancient/abandoned · ❓ foreign/unknown

---

## 0. Engine-rework status (2026-06-26) — track essentially COMPLETE

Headline engine-rework work is DONE + merged to `origin/main`:
- R1′ Part A (2-model consolidation, PR #53) + **validated live** (PR #54: 41s/90s, diversity 0.31 no-retry, 0.56¢).
- R1′ Part B — fold↔calibrated-audience unification, A/B-proven the moat moves the model (PR #55).
- omni-read null-coercion reliability fix — a live Read failure caught + fixed (PR #56).
- §04 backlog R2 + R4 verified-resolved + marked (PR #57).

Engine-rework worktree `~/virtuna-engine-rework` is now IDLE (detached on `origin/main`).
Remaining engine debt is all lower-value (DISSECTION-BACKLOG: R3 post-launch-A/B, R5, E2, G3,
A6, A-T, S6). **The branch cleanup ran 2026-06-26 — ✅ COMPLETE (63→13 remote, see §5).**

## 1. Active — touch with care

| Branch | Worktree | State | Note |
|---|---|---|---|
| `main` | `~/virtuna-v1.1` | 🟢 trunk | stays clean; launch GSI from here. ⚠️ trunk's LOCAL main is STALE — `git pull` in `~/virtuna-v1.1` to sync `origin/main` (now through #59 + the cleanup pass). |
| `milestone/numen-tools` | `~/virtuna-numen-tools` | 🟢 debt worktree | v6.0 shipped (squash #23); worktree STAYS LIVE to burn `DEBT-BACKLOG.md` (§3). 537 ahead = pre-squash history. |
| `milestone/numen-surface` | `~/virtuna-numen-surface` | 🟢 active (v5.0) | mobile-first rebrand/UX; 83 ahead. |
| `feat/creator-voice-sample` | — | 🟢 **PR #60 OPEN (review)** | voice role across idea/hooks/script/remix runners + Card 9 `VoiceSampleInput` UI; 28/28 green at authoring. **330 ahead / 46 BEHIND main** → rebase onto current main (konva/glass removal + R1′) + re-run suite BEFORE merge. Feeds GSI grounding §4.3. |

## 2. Dormant / parked — real tracks, paused (keep worktree)

| Branch | Worktree | Note |
|---|---|---|
| `reconcile/reading-pr19` | `~/virtuna-numen-rework` | 🟡 v5.0 reading reconcile; 127 ahead, WT live |
| `milestone/numen-landing` | `~/virtuna-numen-landing` | 🟡 reading-gallery/landing; 99 ahead |
| `milestone/viral-remix` (+`-adapt`) | `~/virtuna-viral-remix(-adapt)` | 🟡 P1+P2 done; Remix prior art — scout for GSI Remix reuse before any rebuild |
| `milestone/landing` | `~/virtuna-landing` | 🟡 Landing v1 roadmap; 4 ahead |
| `milestone/ui-opt` | `~/virtuna-ui-opt` | 🟡 UI opt; 2 ahead |
| `spike/quantum-cognition` | `~/virtuna-quantum-spike` | 🟡 R&D, spec in worktree, not built |
| `feat/chat-ethics-gate` | — | 🟡 Chase Hughes knowledge layer, PARKED (A/B inconclusive + cost flag); 4 ahead, decision pending |
| `fix/flash-coercion-stability` | — | 🟡→🗄️ **MOSTLY SUPERSEDED** — the read-coercion half (`coerceOmniRead`) was PORTED to main via PR #56 (2026-06-26); the fold-coercion half is already live. Little unique value left — verify nothing else stranded, then retire. |

## 3. Open-debt index (detail lives in these SSOTs — do not duplicate)

| Debt source | Location | Scope |
|---|---|---|
| **Engine dissection** | `docs/DISSECTION-BACKLOG.md` (main) | engine refinements/cuts. R1/Part B/omni/R2/R4 DONE; OPEN = R3 (post-launch A/B), R5, E2, G3, A6, A-T, S6 — all lower-value |
| **v6.0 deferred work** | `~/virtuna-numen-tools/.planning/DEBT-BACKLOG.md` | gen reliability, latency, P15/16/17, rebrand sweep |
| **GSI vision** | `.planning/NUMEN-GSI-VISION.md` (main) | the horizontal milestone (next big build) |
| **Parked decisions** | memory: `engine-model-assignment`, `chat-citations-not-grounded`, `rubric-critic-deactivated` | model stack (now 2-model + validated), fake §pills (dropped #51), critic (cut #...) |

**Cross-cutting (not yet fully in any SSOT):**
- `feat/creator-voice-sample` merge/abandon decision (§1).
- main eslint regression (UI-lane) — **count UNVERIFIED 2026-06-26** (was reported 39err/66warn at the UI merge); re-check on `main`, owned by UI worktree.
- Part B per-persona reaction MODAL on the Read hero — UI-lane (the SIM-1 Max badge already ships; only the modal remains).
- Competitor-intelligence (`src/lib/ai/*`) on deepseek-chat + gemini-2.5-flash-lite — provider-consolidation decision.

## 4. GSI carryover — parked work that feeds the horizontal milestone

- S3′ SIM-1 Flash text tier + SIMULATE primitive → **MERGED (PR #49)** = GSI Phase 0's `simulate()` core (no longer a live branch).
- R1′ Part B fold↔audience unification → **MERGED (PR #55)** = the SIM/population primitive now spans video Read too.
- `feat/creator-voice-sample` → grounding stack §4.3 (creator voice) — decide.
- `milestone/viral-remix*` → a General/Socials skill; scout before rebuild.
- AudienceSignature (on main) → the SIM/population primitive + trustworthy-SIM answer.

## 5. Cleanup pass — ✅ DONE 2026-06-26 (63→13 remote branches)

Ran from the engine-rework worktree (idle). **Every branch with unmerged commits was
`archive/<name>`-tagged on origin BEFORE deletion** → fully recoverable via
`git checkout archive/<name>` (or `git branch <name> archive/<name>`). 12 such tags exist.

**Deleted (49 branches + 1 PR closed):**
- **Stale PR #42** (`docs/s3-handoff`) closed + branch deleted (superseded by S3′ #49).
- **18 merged-by-ancestry, no-worktree** (content on main): `cursor/3acde074`, 3× `gsd-reviewfix/*`,
  `milestone/{backend-completion,backend-foundation,backend-reliability,engine-hardening,engine-opt,mvp-cut,mvp-ready,result-surface}`,
  4× `phase-*`, `worktree-agent-abee5b17a39191285`.
- **15 squash-dangling, merged-PR-verified, no-worktree**: `fix/r1-validate-live` (#54),
  `feat/r1b-fold-audience-unify` (#55), `fix/omni-read-null-coercion` (#56), `chore/r2-r4-verify-mark` (#57),
  `chore/track-worktree-ledger` (#58), `feat/persona-weights-live` (#30), `fix/s4-cut-dead-runner-scaffolding` (#39),
  `chore/s5-cut-rubric-critic` (#34), `chore/a5-nudge-and-ci-cleanup` (#35), `fix/audience-backlog-a2-a4` (#31),
  `fix/ci-review-permissions` (#33), `ship/v6.0-numen-studio` (#23), `milestone/viral-remix-pr` (#6),
  `rework/engine-core` (#24), `cursor/08bbd10c` (#29).
- **4 retired worktrees removed, then branch deleted**: `chore/ui-deadcode` (#45)→ui-deadcode,
  `milestone/landing-v2` (#22)→landing-v2, `design/ui-system`→numen-ui (5 throwaway composer sketches
  there were untracked — design-explored, rebrand shipped). **NOT removed: ui-restrained**
  (`cursor/27a9b701`) — had real uncommitted source edits + is Cursor-managed → left intact (§6).
- **12 archived-then-deleted** (`archive/*` tag on origin): `cursor/181f2a73`, `cursor/b87137e7`,
  `p1-fixes`, `fix/ui-refinement`, `milestone/numen-rework` (#20 content on main), 7× ancient
  `milestone/{landing-linear-clone,landing-page,landing-page-redesign,mvp-launch,platform-refinement,prediction-engine-integration,prediction-engine-v2}`.
- **1 foreign, deleted no-archive**: `claude/analyze-langstrasse-app-sNRWE` (wrong repo).

**Kept (the 13 survivors):** `main`; 8 worktree-backed tracks
(`milestone/{numen-surface,numen-tools,numen-landing,landing,ui-opt,viral-remix,viral-remix-adapt}`,
`reconcile/reading-pr19`); `cursor/27a9b701` (ui-restrained WT); `feat/creator-voice-sample` (PR #60);
`feat/chat-ethics-gate` (parked); `fix/flash-coercion-stability` (verify+retire, §2). Plus 3 LOCAL-only
spike branches not on origin (`change/flash-spike`, `spike/local-gemma`, `spike/quantum-cognition`).

## 6. Reconciliation needed

- ✅ **DONE 2026-06-26 — CLAUDE.md worktree table reconciled** (engine-rework row now reads
  "Track COMPLETE / idle"; reconcile note repoints here as the canonical map). Landed in the
  same PR as this ledger update.
- ✅ **DONE 2026-06-26 — stale PR #42** (`docs/s3-handoff`) closed + branch deleted (superseded
  by merged S3′ #49). It was the only open PR.
- Re-verify the **main eslint count** (UI-lane) before quoting it anywhere — UNVERIFIED here.
- ⚠️ **ui-restrained worktree has uncommitted work** (`cursor/27a9b701`, `~/.cursor/.../virtuna-ui-restrained`):
  `src/components/audience-lens/audience-presence.tsx` (heroDots 110→84 + padding), Cursor-managed.
  UI-lane decision: commit or discard those edits, THEN `git worktree remove` + delete the branch
  (the last retired-WT cleanup).
- **Trunk `~/virtuna-v1.1` local `main` is stale** — `git pull` there to pick up #53–#59 + the cleanup pass.
