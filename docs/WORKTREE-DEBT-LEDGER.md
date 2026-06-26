<!-- CANONICAL (tracked) — supersedes the local ~/virtuna-v1.1/.planning/WORKTREE-DEBT-LEDGER.md. Edit here; it ships in the repo so web/other-machine sessions see it. -->

# Worktree + Branch + Debt Ledger

> **The map.** Status of every branch/worktree + an index to the debt SSOTs (§3).
> **Refreshed 2026-06-26** from a live `git` survey: **61 remote branches** — 21 merged
> into `origin/main` (delete-safe by ancestry), 40 unmerged (most are squash-dangling or
> active-worktree). Pointer/triage doc — indexes the detailed SSOTs, does not duplicate them.
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

Engine-rework worktree `~/virtuna-engine-rework` is now IDLE on the merged
`chore/r2-r4-verify-mark`. Remaining engine debt is all lower-value (DISSECTION-BACKLOG:
R3 post-launch-A/B, R5, E2, G3, A6, A-T, S6). **The branch cleanup (now 61 branches) is UNBLOCKED.**

## 1. Active — touch with care

| Branch | Worktree | State | Note |
|---|---|---|---|
| `main` | `~/virtuna-v1.1` | 🟢 trunk | stays clean; launch GSI from here. ⚠️ trunk's LOCAL main was stale this session — `git pull` to sync `origin/main` (#53–#57). |
| `milestone/numen-tools` | `~/virtuna-numen-tools` | 🟢 debt worktree | v6.0 shipped (squash #23); worktree STAYS LIVE to burn `DEBT-BACKLOG.md` (§3). 537 ahead = pre-squash history. |
| `milestone/numen-surface` | `~/virtuna-numen-surface` | 🟢 active (v5.0) | mobile-first rebrand/UX; 83 ahead. |
| `feat/creator-voice-sample` | — | 🟢 **DECIDE — built + green, UNMERGED (330 ahead, last 06-19)** | voice role across idea/hooks/script/remix runners + Card 9 `VoiceSampleInput` UI, 28/28 green. Feeds GSI grounding §4.3. **Action: merge or explicitly abandon — don't let it rot.** |

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

## 5. Cleanup actions (now UNBLOCKED — run from `main` in a quick-fix sitting)

**✅ MERGED into origin/main by ancestry (21, delete-safe):**
`cursor/3acde074`, `design/ui-system` (⚠️ still has WT `~/virtuna-numen-ui` — remove first),
`gsd-reviewfix/05-15361`, `gsd-reviewfix/05-6008`, `gsd-reviewfix/07-5638`,
`milestone/backend-completion`, `milestone/backend-foundation`, `milestone/backend-reliability`,
`milestone/engine-hardening`, `milestone/engine-opt`, `milestone/landing-v2` (⚠️ WT `~/virtuna-landing-v2`),
`milestone/mvp-cut`, `milestone/mvp-ready`, `milestone/result-surface`, `phase-3-pipeline-infra`,
`phase-5-video-segmentation`, `phase-6-audio-fingerprint`, `phase-7-multi-persona-sim`,
`phase-8-benchmark-retrieval`, `worktree-agent-abee5b17a39191285`.

**🗄️ Squash-dangling — content ON main via a merged PR, ancestry shows "ahead" only because
squash doesn't preserve it. Verify nothing stranded, then delete:**
This session: `fix/r1-validate-live` (#54), `feat/r1b-fold-audience-unify` (#55),
`fix/omni-read-null-coercion` (#56), `chore/r2-r4-verify-mark` (#57, current engine-rework WT).
Prior: `feat/persona-weights-live` (#30), `fix/s4-cut-dead-runner-scaffolding` (#39),
`chore/s5-cut-rubric-critic`, `chore/a5-nudge-and-ci-cleanup`, `fix/audience-backlog-a2-a4` (#31),
`ship/v6.0-numen-studio` (#23), `chore/ui-deadcode` (#45, ⚠️ WT `~/virtuna-ui-deadcode`),
`milestone/numen-rework` (#20), `rework/engine-core` (engine-rework squashes — do NOT `git merge`),
`fix/ci-review-permissions` (CI workflow deleted — dead), `fix/ui-refinement`, `milestone/viral-remix-pr`.

**🧹 Cursor-scratch — delete after confirming nothing stranded:**
`cursor/08bbd10c`, `cursor/181f2a73`, `cursor/b87137e7`, `p1-fixes` (dup of cursor/08bbd10c),
`cursor/27a9b701` (= the `~/.cursor/worktrees/virtuna-ui-restrained` WT — remove WT first).

**⚰️ Ancient/abandoned — archive then delete (Feb–May, no worktree, the abandoned landing
attempts are "reference only, do not revive" per numen-surface):**
`milestone/landing-linear-clone`, `milestone/landing-page`, `milestone/landing-page-redesign`,
`milestone/mvp-launch`, `milestone/platform-refinement`, `milestone/prediction-engine-v2`,
`milestone/prediction-engine-integration`.

**❓ FOREIGN — not this project, delete:**
`claude/analyze-langstrasse-app-sNRWE` (LangstrasseZurich.ch planning doc — wrong repo, a=1, 02-20).

> ⚠️ Do bulk cleanup from `main` AFTER `git worktree remove`-ing retired worktrees
> (`design/ui-system`→numen-ui, `chore/ui-deadcode`→ui-deadcode, `cursor/27a9b701`→ui-restrained,
> `milestone/landing-v2`→landing-v2 if truly done). Never delete a branch with a live worktree.

## 6. Reconciliation needed

- **CLAUDE.md worktree table is STALE** — lists engine-rework on `rework/engine-core ~8 ahead`.
  Reality: that worktree is on `chore/r2-r4-verify-mark` (all session work merged), and the
  engine-rework milestone is essentially complete (§0). Update the table when convenient.
- **Close stale OPEN PR #42** (`docs/s3-handoff`) — it's the only open PR; superseded by the
  merged S3′ work. Close it + delete the branch.
- Re-verify the **main eslint count** (UI-lane) before quoting it anywhere — UNVERIFIED here.
