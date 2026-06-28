# HANDOFF — lane/shell · Premium conversational thread

> Worktree `~/virtuna-shell` · branch `lane/shell` (chrome UI lane) · 2026-06-27.
> Two SSOTs to read first: **`docs/subsystems/ui-loading-states.md`** (audit + north star §5) and this file.

---

## ⎘ PASTE THIS INTO A FRESH SESSION

```
Continuing lane/shell (chrome UI lane), "premium conversational thread" initiative.
READ FIRST: docs/subsystems/ui-loading-states.md (loading audit + north star §5) and
.planning/HANDOFF-premium-thread.md. Then open the sketch:
  open .planning/sketches/premium-thread.html   (↻ replay top-center)

Where we are: PR #72 merged to main; loading/chrome surface fully audited (Themes A=in-thread,
B=route skeletons, C=primitives debt). North star = make the thread feel like Perplexity/Claude/
Cursor: (1) text → cards → text conversational shape, (2) premium narrated progress for our
high-latency skills. Sketch v2 built + verified; owner says "way better, still a lot to refine" —
direction RIGHT, not final.

Locked decisions: keep the auto-wip Stop hook (it's hardened); conversational prose = CLIENT-TEMPLATED
now, engine synthesis later (stay in lane, NO engine work); sketch-first before any app code.

Do next: keep refining the sketch per my feedback (motion-timing/smoothness pass; progress-state
pacing + sub-detail copy; then real avatars, lens-open, a pure chat turn, error/retry, per-skill
copy). When I sign off the sketch → write a build spec → build Chunk 1 (A1 thread-switch thrash +
A2 row feedback + A3 test-submit feedback). Reuse <Skeleton> + refine ProgressChecklist; cards =
locked hook-card-refined, untouched. Client-side only.
```

---

## TL;DR
Started by cleanly shipping the prior session's work (PR #72), then the owner redirected the lane
from "loading polish" to a real initiative: **make the Numen thread feel like a premium high-end tool
(Perplexity / Claude / Cursor).** We audited the whole loading/chrome surface, set the north star,
and are iterating on a throwaway HTML sketch that locks the target feel before any app code. Sketch is
at **v3** (2026-06-28); v2 owner reaction was "way better, still a lot to refine" — v3 cleared most of the
named backlog (lens-open, real avatars, pure chat turn, error/retry, per-skill copy, sharper sub-detail,
motion pass) and is **verified-rendering via Playwright**, pending owner review.

## What shipped this session (DONE, on main)
- **PR #72 squash-merged → main `6b2d110b`.** The prior session left it CONFLICTING because `lane/shell`
  carried `1291a4cb` (multi-thread) that had already landed via #70 (squash) — byte-identical, the whole
  conflict. Fix: `git rebase --onto origin/main 1291a4cb lane/shell` dropped the dup, replayed only the
  chrome-pass commit; resolved 2 conflicts (`not-found.tsx` → kept Button reskin; `top-bar-account-chip` →
  honored delete after re-confirming 0 consumers). Verified: 40/40 tests, tsc/eslint clean (the 2 tsc +
  28 eslint findings are pre-existing main baseline, none in the diff). `lane/shell` then reset to main =
  clean, ready. **0 open PRs.**
- **Auto-wip hook investigated → KEEP.** It's NOT a naive daemon — it's a hardened Stop hook
  (`~/.claude/hooks/auto-commit-on-stop.sh`, wired in `~/.claude/settings.json`): merge-safe, single
  self-collapsing rolling checkpoint, identifiable trailer, no-push. It didn't cause the #72 mess (stale
  base did). Memory corrected. (See memory `auto-wip-daemon-hazard`.)

## The initiative — north star (owner direction)
The thread must feel premium on two axes the current build misses:
1. **Premium wait** — instant echo, a *living* narrated progress indicator (not a dead spinner), content
   that streams/reveals. Our skills have real latency, so this is the most-watched surface and must be
   excellent (reference: Perplexity / Claude / Cursor long-task progress).
2. **It's a conversation, not a card dump** — every skill turn = **intro line → cards → outro + next-step
   chips**. Cards become artifacts embedded in a dialogue, like a Claude reply with a table.

## Locked decisions
- **Keep the auto-wip hook** (hardened; real lesson = rebase lanes before PR).
- **Conversational prose = client-templated NOW** (hybrid; engine-written synthesis later). Keeps the work
  in `lane/shell` with zero engine change. The `ThreadAssistantTurn`/`SkillResultCard` wrapper is the seam
  for intro/outro slots.
- **Sketch-first** — lock the feel in HTML before app code.
- Terracotta dosage = active/live states ONLY; primary action = cream, never accent.
- Reuse existing primitives: `<Skeleton>` (`src/components/ui/skeleton.tsx`), refine `ProgressChecklist`
  (`src/components/thread/progress-checklist.tsx`); cards = locked `hook-card-refined`, untouched.

## Artifacts (all in this worktree)
| File | What |
|---|---|
| `docs/subsystems/ui-loading-states.md` | **The SSOT** — full audit (Themes A/B/C), north star §5, sketch status + refinement backlog |
| `.planning/sketches/premium-thread.html` | The animated target sketch (v2). `open` it; ↻ replay top-center |
| `.planning/sketches/premium-thread.png` | Reference still |
| `.planning/HANDOFF-premium-thread.md` | This file |

## The work plan (from the audit)
Three themes, sequenced as PRs; all fold into the sketched target.
- **Theme A — in-thread loading (highest value).** A1 thread-switch layout thrash (worst UX), A2 row click
  feedback, A3 test/Read submit silence, A4 unscored-card silent rewrite, A5 account-read skeleton, A6
  script/remix caption, A7 optimistic delete. Full mechanisms + file:line in the doc §1.
- **Theme B — route loading skeletons** (P0: `home`, `analyze/layout` `fallback={null}`; P1: library,
  audience, audience/[id]). Doc §2.
- **Theme C — primitives/MATTE debt** (toast/card inset-shine, delete dead GlassToast/GlassSkeleton/
  card-reaction-at-rest, unify spinner, stale JSDoc). Doc §3.

**Build target = the sketch.** Chunk 1 = A1+A2+A3 (all on the #70/#72 multi-thread surface) + the
conversational intro/outro framing, once the sketch is signed off.

## Key code seams for when building starts (from the audit)
- Thread-switch thrash (A1): `src/components/app/home/composer.tsx:381` effect on `[activeThreadSignal]`
  wipes blocks synchronously (`:388–405`) before async `loadPersistedBlocks` (`:408`); `hasThread` derived
  `:280`; layout hero/thread switch in `src/components/app/home/home-page-layout.tsx`. Fix = `rehydrating`
  flag → keep thread shell + skeleton, don't collapse to hero. **Constraint:** the `activateThread` await
  in `Sidebar.handleOpenThread` (`src/components/sidebar/Sidebar.tsx:291`) is load-bearing (`/api/threads/open`
  reads most-recent) — don't remove it.
- Row feedback (A2): `ThreadRow` `src/components/sidebar/Sidebar.tsx:179` (add `activatingId`).
- Test submit (A3): `composer.tsx:813/855` (test path never calls `captureUserTurn`); button `:~1362`.
- Unscored cards (A4): `src/hooks/queries/use-hooks-stream.ts:487` (`band ?? 'Mixed'`), `ProofUnit`.
- Conversational slots: `ThreadAssistantTurn` / `SkillResultCard` (`src/components/thread/skill-result-card.tsx`).

## Sketch refinement backlog (with owner)
**v3 (2026-06-28) cleared:** lens-open (inline VerbatimWall + avatars) · real reactor avatars · pure
text/chat turn (Turn 3) · error/partial-failure + Retry (static ref) · per-skill step copy gallery ·
motion pass.
**v3.1 (2026-06-28) — re-copied to the honest FLOOR after the client-vs-engine prose test
(`.planning/premium-thread-copy-floor.md`).** Result: **~90% of the premium shape ships in-lane with zero
fabrication** — the outro is already the engine's real `followupText`, the spine is real SSE `stages`,
chips are real handoffs, script-intro cites the real input hook. Changes: hooks-intro → thin orientation;
outro = engine text (restyle, not template); sub-detail → static honest descriptor (killed the faked
"Reactor 6/10" counter); script proof → "8/10 stopped · opener"; lens read-only.
**Owner decisions LOCKED (2026-06-28):** (1) hooks intro = **thin orientation**; (2) progress sub-detail =
**static now + filed engine ask** (add `detail` to the stage SSE event / `StageState` — the one justified
engine request, carry to GSI/engine lane).
**Remaining:** **add the loading MECHANICS** to the sketch (v3.2) — **A1** thread-switch shell+skeleton (no
hero-flash) + **A4** unscored→scored card transition; these are what Chunk 1 builds and the sketch's happy
conversation doesn't yet show them. Then motion-timing fine-tune + error-state live-retry call → sign-off →
build spec → Chunk 1.

## State of the tree
`lane/shell` @ `6b2d110b` (= main) + this session's docs/sketch/handoff committed on top. No app code
touched yet (sketch-first). Nothing to merge — this is design/spec prep.
