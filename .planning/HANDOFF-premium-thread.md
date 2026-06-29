# HANDOFF — lane/shell · Premium conversational thread

> Worktree `~/virtuna-shell` · branch `lane/shell` (chrome UI lane) · updated 2026-06-28.
> **Design phase DONE (sketch signed off at v3.2). Now BUILDING.** This handoff kicks off **PR-1 / Chunk 1.**

---

## ⎘ PASTE THIS INTO A FRESH SESSION (build PR-1)

```
Continuing lane/shell (chrome UI lane), "premium conversational thread". DESIGN IS DONE — the sketch is
signed off (v3.2) and there's a build spec. Now build PR-1.

READ FIRST (in order):
  1. .planning/premium-thread-build-spec.md   ← the contract; build to this. PR-1 section is your scope.
  2. docs/subsystems/ui-loading-states.md §1   ← A1/A2/A3 mechanisms + exact file:line seams.
  3. .planning/premium-thread-copy-floor.md     ← only needed for PR-2 (copy), skip for PR-1.
  open .planning/sketches/premium-thread.html  ← the visual target (↻ replay; ▶ play switch = A1).

PR-1 / Chunk 1 = switch & submit mechanics (chrome only, NO stream/card changes):
- A1 thread-switch (the worst UX): add a `rehydrating` flag in composer.tsx — set TRUE synchronously at the
  top of the [activeThreadSignal] switch effect (~:381, before the :388-405 wipes), FALSE when
  loadPersistedBlocks() (:408) settles. Plumb into home-page-layout.tsx: gate hero on
  `!hasConversation && !rehydrating`, keep thread layout on `hasThread || rehydrating`; render
  <ThreadLoadingSkeleton variant="chat" caption="Opening thread…"/> in the scroll while rehydrating.
  CONSTRAINT: do NOT remove the activateThread await in Sidebar.handleOpenThread (Sidebar.tsx:291) — it's
  load-bearing (/api/threads/open reads most-recent). Cover the gap with the skeleton, don't close it.
- A2 row pending: `activatingId` state in Sidebar; ThreadRow (:179) shows terracotta left-border + dim-pulse
  (+ optional <Spinner size="sm">) while activating. Set before await, clear after.
- A3 test-submit: composer test path (:813/:855) never calls captureUserTurn → echo the URL + a muted
  stream.phase status line before navigating (button loading ~:1362).

Locked constraints: client-side ONLY (no engine/SSE change); terracotta dosage = active/live states only,
primary action = cream; reuse <Skeleton> + ThreadLoadingSkeleton; cards = locked hook-card-refined,
untouched. Keep the auto-wip Stop hook (hardened). Rebase lane/shell on origin/main BEFORE opening the PR.

Verify (REQUIRED — vitest can't catch Next bundle leaks, do a real browser pass):
  node ./node_modules/vitest/vitest.mjs run   (npm test lies — rtk shim)
  then a browser pass on throttled network: switch threads = NO serif hero-flash (A1), row signals
  instantly (A2), test-submit echoes (A3). Auth via e2e/create-test-user.ts. tsc --noEmit clean on the diff;
  keep reading/__tests__/reskin-matte.test.ts green.

When PR-1 is green: PR it, merge, then PR-2 / Chunk 2 (A4 proof pending→scored + conversational frame) per
the build spec. Memory `lane-shell-premium-thread` has the full grounded picture.
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
**v3.2 (2026-06-28) — added the Chunk-1 loading MECHANICS** (verified-rendering): **A4** hook cards stream
in with a **pending** proof (matte-shimmer "Scoring with your 10 reactors…"), then band+fraction+ribbon
**resolve in** (no silent rewrite); **A1** thread-switch mini-demo ("▶ play switch") — row **pending** →
thread **shell stays + ThreadLoadingSkeleton** → content, never the serif hero-flash. The sketch now depicts
the full arc AND the two hard transitions Chunk 1 builds.
**Remaining → sign-off:** owner replays v3.2 (motion-timing fine-tune; error-state live-retry call). On
sign-off → write the build spec → **Chunk 1** = A1 (rehydrating flag → shell+skeleton) + A2 (row pending) +
A3 (test-submit echo) + A4 (proof pending→scored) + the conversational frame (thin intro slot, restyle
`followupText` outro, spine from real `stages`, static sub-detail + filed engine `detail` ask).

## State of the tree
`lane/shell` @ `6b2d110b` (= main) + this session's docs/sketch/handoff committed on top. No app code
touched yet (sketch-first). Nothing to merge — this is design/spec prep.
