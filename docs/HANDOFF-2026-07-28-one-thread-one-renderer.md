# One thread, one renderer — Lane 1 SHIPPED · Lane 2 open

**Status:** Lane 1 complete. Suite **4758/0** · `tsc` clean · `npm run build` compiles · lint at
baseline (9 pre-existing errors, **0 new**). Net **−1,788 lines** across 31 files.

**⚠️ NOT YET VERIFIED LIVE.** `/home` needs auth and there is no E2E harness in the repo. The
browser walk-through is the FIRST thing the next session does — steps in §5.

---

## 1. Why this existed

The app did not have one chat. It had **a per-skill viewport plus a migration step**, and the
migration was racy — the "I ask for hooks, then want something else, and sometimes it doesn't work"
report.

- `activeTool` was a **render input**, not just a submit router. Seven surfaces mounted off it
  (`showIdeasView`, `showHooksView`, `showChatView`, `showScriptView`, `showRemixView`,
  `showExploreView`, `showAccountView`).
- A completed run stayed in its own private view and entered the thread only when the creator
  **left the skill**, via a fold effect with four holes:
  1. `account` and `test` were not in the fold list at all.
  2. A mid-stream switch bailed on `isStreaming` — but the view had already unmounted
     synchronously, and the effect only re-fired on the *next* switch.
  3. A failed reload skipped `stream.reset()` with the view already gone.
  4. Even the happy path blinked: unmount is synchronous, the reload is a round-trip.

## 2. What shipped

**One renderer.** `src/components/thread/thread-turn.tsx` — every turn, live or reloaded:

```
ThreadUserTurn → ThreadIntro → SkillProgress → MessageBlocks → RunWarnings/OutliersOffer → ThreadOutro
```

`persisted-thread-stream.tsx` maps persisted turns **and** the live tail through it. Nothing reads
`activeTool`; there is no second surface to race with.

**A run enters the thread WHEN IT FINISHES** (`composer.tsx`, the run-completion effect), not when
the user navigates away. Generalized from the chat-only swap. `reset()` runs only on a successful
reload — a failed fetch must never clear an unpersisted turn.

**Persistence — the `run-header` block.** 18th registry type; `messages.body` is `jsonb` so **no DB
migration**. Stamped by all six routes (`hooks`, `ideas`, `script`, `explore`, `test/card`,
`account-read`) via `src/lib/tools/run-header.ts`. Rebuilds on reload: the intro (naming the REAL
audience), the stage receipt, the outro treatment.

**One run at a time.** `use-active-run.ts` normalizes all seven stream hooks; the send disc becomes
a stop control backed by the `AbortController` each hook already had.

**Deleted:** 7 view files, 7 gates, the fold effect (~2,680 lines).

## 3. Five things the plan got WRONG — found only mid-build

Re-read this before touching the thread again; each was invisible until the code was written.

1. **Explore could not join the stream.** Its grid's Remix/Track handlers rode **props**, and
   `MessageBlocks` passes only `block` — so a rehydrated grid would have been inert tiles. That is
   the whole reason `outlier-grid` had been filtered out of the unified stream. Fixed by moving
   them to `OutlierGridActionsContext` + `use-outlier-grid-actions.ts`. The count hero + card frame
   moved INTO the block renderer (they derive from `block.props.tiles`, so they now survive reload).
2. **Three chat behaviours would have been dropped**: the typing indicator, the dispatch-labelled
   capsule, and prose streaming live. The composer now passes `chat.dispatchedSkill` as the run's
   skill — which is what gives an agent-routed run the same intro/spine/outro as running the skill
   directly.
3. **Cards were gated on the wrong signal.** A chat-dispatched skill produces its cards at the END
   of the pipeline **while the SSE stream is still open**. Gating on `isStreaming` held them back.
   Everything pivots on `runLive` (`isStreaming && stages not all done`), never `isStreaming`.
4. **Explore and Account had their own error copy** ("Couldn't reach that source") — the generic
   renderer would have replaced it with a lie about the SIM pass. `ERROR_COPY` in `thread-turn.tsx`.
5. **The intro is present-tense.** Making it persistent meant a finished run announced itself as
   in-flight; the old views dodged this by suppressing the intro on rehydrate, which is not an
   option once it persists. `introLine(..., settled)` adds a past-tense branch.

## 4. Traps for the next session

- **`SkillProgress` renders NOTHING for a settled run with no stages**, and stage events are never
  persisted. That is why reload lost every receipt. `thread-turn.tsx` reconstructs `settledStages`
  from the skill's canonical `STAGE_PLANS` — honest, because a turn carrying cards is a run that
  completed.
- **THE NAMESPACE TRAP (F-017's second act).** `run-header.props.skill` is the DISPLAY namespace
  (`ChatTurnKind` — `"ideas"` PLURAL), never the composer `ToolId` (`"idea"` singular). The two
  differ in exactly this one id and a cast between them **cannot fail at compile time**.
  `__tests__/run-header.test.tsx` statically scans all six routes. **Mutation-verified**: stamping
  `"idea"` turns it red while `tsc` stays silent.
- **The ambient ledger is POSITIONAL.** `run-header` is rendered as `null` rather than filtered,
  because filtering on one side only shifts every later card's `data-card-id` and hands the room
  another card's reaction. Only a TRAILING block may be removed (that is why the outro split is
  index-safe). Guard: `__tests__/ambient-card-anchors.test.tsx`.
- **`/dev/cards` now renders through the real `ThreadTurn`** via local adapters at the top of the
  page. Do not re-fork it — a stale gallery that reads as authoritative has already cost one design
  session.
- Two per-file FS-lint gates (`radius-scale`, `section-label-scale`) lost 6 tests each simply
  because there are 6 fewer files to scan. Test-count delta is fully accounted: `4755 − 12 + 15`.

## 5. FIRST THING NEXT SESSION — the live walk-through

Credentials are in the session-start prompt (deliberately **not** committed here).

```bash
npm run build && npx next start -p 3210
```

On a **production build** — `next dev` StrictMode fakes a broken funnel on this app and has cost
~3h before. In ONE thread:

1. Run **Hooks** → intro, spine, cards, outro.
2. **Without switching**, run **Script** → the hooks turn stays; script appends with its own intro,
   spine, outro. ← **THE REPORTED BUG. This is the one that matters.**
3. **Reload** → both turns intact, **past-tense** intros + receipts + outros, correct order.
4. Start a run, hit **Stop** mid-stream → aborts, send returns, thread stays coherent.
5. Send during a run → the disc is a stop control, not a second run.
6. Open a **pre-existing** thread → renders with inferred intros/receipts, nothing lost.

Screenshots hang on this app (the ambient-room animations never settle). Use raw Playwright with
`animations: 'disabled'` + `caret: 'hide'`, or assert via `getComputedStyle` / `getBoundingClientRect`.

## 6. LANE 2 — not started (owner-confirmed order)

The composer chrome. Deliberately deferred: it carries the money risk and deserves its own context.

1. **Add `test` / `account` / `remix` / `explore` to `SKILL_TOOLS`** (`skill-dispatch.ts` — today
   only 3 of 9: ideas/hooks/script). **Blocking.** Until this lands, removing the pill DELETES
   capability: a pasted TikTok link in chat currently reaches an agent with no test tool, so it
   *talks about* your video instead of testing it.
2. **Spend consent** for agent-fired Max runs. `maxSkillRuns` is a run COUNT, not consent.
3. **Delete the skill pill.** Once `activeTool` is no longer a render input (done), it is only a
   submit router — and a submit router with no view side-effects is what the agent replaces.
4. **Delete "Ask the room"** — `composer.tsx` `isAsk` + its branches. `/api/tools/react` STAYS; the
   room rail (`AmbientOverviewRail`/`Sheet`) is its other caller.
5. **Start grid tile becomes a ONE-SHOT** — fires once, then falls back to chat. Owner keeps the
   grid as the discovery surface.

**Owner calls already locked:** keep the Start grid · remove Ask the room · no skill pill in the
composer · one run at a time · intro/outro/loading states preserved 1:1.
