# One thread, one renderer — Lane 1 CLOSED · Lane 2 open

**Status:** Lane 1 complete and **CLOSED**. Net **−1,788 lines** across 31 files.

**✅ VERIFIED LIVE 2026-07-28** on a production build, all six steps — §5. The walk-through found
two defects Lane 1 had introduced (the Stop disc firing a second billed run; every finished run
rendering twice). Both are fixed, mutation-guarded, **merged to `main` as `9902b45f` (PR #392)**
and **live in production** (deploy READY, aliased to numenmachines.com). Suite **4764/0** on the
fix branch · `tsc` clean · build compiles.

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

## 5. THE LIVE WALK-THROUGH — DONE 2026-07-28. All six steps pass; two defects found and fixed.

Run on a production build (`npm run build` → `next start -p 3210`) driven by raw Playwright, asserting
on the DOM rather than screenshots (the ambient-room animations never settle, so captures hang).

| # | Step | Result |
|---|------|--------|
| 1 | Hooks → intro, spine, cards, outro | ✅ live intro present-tense + spine, settles to past tense + ✓ receipt (3 steps) + 5 cards + outro |
| 2 | **Script without switching** | ✅ **THE REPORTED BUG IS FIXED** — hooks turn untouched, script appends its own intro/spine/receipt/card |
| 3 | Reload | ✅ both turns identical, past-tense intros, receipts, outros, correct order |
| 4 | Stop mid-stream | ❌ → ✅ **fired a SECOND billed run** (see below) |
| 5 | Send during a run | ✅ `canSubmit` is false while streaming; Enter starts nothing |
| 6 | Pre-existing thread | ✅ unstamped legacy turns get intro + receipt from `classifyTurn` — no backfill needed |

**DEFECT A — the Stop disc fired a second billed run.** One click on Stop aborted the run *and*
POSTed `/api/tools/hooks` again within 100ms; the two runs' cards merged into a single **ten-card**
turn in the persisted thread. Form submission is the CLICK's default action, dispatched *after*
React flushes the discrete event — so `stopActive()` flipped `isStreaming`, React re-rendered the
same node to `type="submit"`, and the browser submitted the form it was then looking at. `type`
alone cannot close this. Fixed by cancelling the default action in the handler
(`composer.tsx`, the send disc). Guard: `__tests__/composer-stop-disc.test.tsx`.

**DEFECT B — every finished run rendered TWICE.** ~2s after each run settled, a duplicate user
bubble plus a second Maven block appeared (same past-tense intro, same closing line, no cards, no
receipt) and never cleared. Cause: routes emit `done` BEFORE the closing line and hold the SSE open
to stream it (§S2), so the fold — which fires on `done` — reloads history, `reset()`s the stream,
and *then* the late `followup` frame refills one field of the emptied hook. `hasContent()` counted
follow-up text as content, so the empty stream re-claimed the tail. It could never self-heal:
`reset()` also cleared `isDone`, leaving the completion effect nothing to fire on. Fixed by
excluding `followupText` from `hasContent` (`use-active-run.ts`). Guard:
`__tests__/use-active-run.test.ts`.

That exclusion alone would have cost the last run its closing line until the next reload, so the
composer now does **one more reload when a follow-up lands on an already-folded stream** — the
frame's only remaining job is to say "the line is persisted now". Measured: fold-reload at t+27.3s,
follow-up reload at t+29.5s, outro on screen at t+29.9s, `turns=1` throughout.

Both guards are **mutation-verified** — each was watched going red against the un-fixed code.

⚠️ Still open, seen in passing (NOT a regression): a legacy turn whose blocks mix a skill run with
`video-test-card`s classifies as `test`, which has no authored intro, so that turn shows neither
intro nor receipt. `classifyTurn` ranks `video-test-card` above `hook-card`. Legacy data shape only.

## 6. LANE 2 — not started (owner-confirmed order)

The composer chrome. Deliberately deferred: it carries the money risk and deserves its own context.

### START HERE — two preconditions, both learned the hard way on 2026-07-28

1. **Lane 2 gets its OWN worktree, off `main`.** Not `~/virtuna-platform`. That worktree sits on
   `lane/platform-surface`, a SECOND session was committing into it live (the ARM `＋`-door lane,
   `0f5d292c`/`0ea85d9d`), and its half-finished `/api/tools/react` edit broke the build in the
   middle of Lane 1's verification — the walk-through only completed because the work was moved to
   a throwaway worktree. Lane 2 edits `composer.tsx`, the same neighbourhood.

   ```bash
   git -C ~/virtuna-platform fetch origin
   git -C ~/virtuna-platform worktree add -b lane/composer-chrome ~/virtuna-composer origin/main
   ```

2. **`lane/platform-surface` still carries the PRE-FIX thread code** until it merges `main`.
   Anything measured in that worktree will still show the duplicate turn and the double-fire.

### Verifying anything on this app (cost ~1h to work out)

- `/home` **reopens the last thread** — click "New Thread" for a clean one, or step 2 lands in the
  wrong thread and reads as a bug.
- The login page has **two** `input[name="email"]`: the OTP front door shadows the folded password
  form. Fill `form input[name="email"]` **last**, or the sign-in silently never happens.
- Launch the server as `node node_modules/next/dist/bin/next start -p 3210`. A shell wrapper
  mangles `npx next` (and `git diff`) into a useless summary and exits 1.
- Screenshots hang — the ambient room never settles. Assert on the DOM.
- A run's real cost is ~20s; budget for it rather than polling tightly.

### The order

> ⚠️ **Step 1 below was WRONG on the facts, and step 2 was bigger than it looked.** Both were
> re-scoped on 2026-07-28 after reading the code; the corrected state is in §8. Left here as
> written because the error is instructive: every claim in it is plausible and none survived
> contact with the source.

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

## 7. Follow-up left open (not a blocker)

The late-follow-up reload (§5) costs a second `GET /api/threads/open` per run to collect one
sentence. It is correct, but the cleaner shapes are: emit `followup` BEFORE `done`, or expose a
real stream-closed signal from the four generative hooks so the fold can wait for it. Both are
larger than that fix deserved on the day, and both touch the S2 "unblock the UI early"
optimization — so treat them as a deliberate trade, not an oversight.

---

## 8. LANE 2 — in progress (`lane/composer-chrome`, worktree `~/virtuna-composer`)

Steps 1–2 are **done, verified and pushed**. Steps 3–5 are **not started**.

| # | Step | State |
|---|------|-------|
| 1 | Prefill fix (was: add 4 skills to `SKILL_TOOLS`) | ✅ `f724deb7` |
| 2 | Gate + bill agent-fired runs | ✅ `5c01f0ed` + wall `b242cabb` |
| 3 | Delete the skill pill | ⬜ not started |
| 4 | Delete "Ask the room" | ⬜ not started |
| 5 | Start-grid tile → one-shot → chat | ⬜ not started |

Suite **4777/0** · `tsc` clean · production build compiles.

### §8.1 — Step 1's premise was false. Read this before trusting a plan again.

**The claim:** removing the pill deletes capability, because chat has no test/account/remix/explore
tool. **The fact:** chat has reached all five (those four + `read`) for months — not through
`SKILL_TOOLS` but through **`request_input`** (`chat-agent-loop.ts` + `skill-capabilities.ts`). The
agent calls `request_input({action})`, the loop emits an `input-request` block, and
`input-request-block.tsx` renders a field whose submit runs that skill's **own dedicated route** —
gated, billed, with its own 300s budget. All five submit branches ship today.

**Doing step 1 as written would have been actively harmful.** `SkillTool.run` executes the runner
*in-process inside the chat route*, which (a) declares **no `maxDuration`** while `remix/run`,
`account-read` and `analyze` each declare `300`, (b) bypassed billing entirely, and (c) has no
runner for `test` at all — it needs an uploaded file, which a model tool call cannot supply. It
would have moved the two most expensive actions in the product onto an ungated, unbilled,
too-short path.

**The real defect nearby was much smaller:** a pasted link had to be typed **twice** — prefill was
restricted to `cap.prefillable && cap.kind === "text"`, so `test`/`remix` surfaced an empty field.
That is what step 1 became. `SKILL_CAPABILITIES.prefillable` (boolean) is now `prefill` (the
declared SHAPE: `"text" | "url" | "tiktok-url"`), checked at the loop boundary; a mismatch is
DROPPED, so the model can never seed a field the field would visibly reject.

### §8.2 — The pill was load-bearing for REVENUE, not just UX

The actual blocker, and it was step 2. `creditGate`/`billUsage` appeared **nowhere** in
`chat/route.ts`, `chat-agent-loop.ts` or `skill-dispatch.ts` — only in comments. So ideas/hooks/
script ran through the agent with **no gate and no ledger row**, while the identical pack cost
credits from the pill. Deleting the pill would have moved **100% of generator traffic onto the free
door** — a pricing change wearing a UI change's clothes.

- `SkillTool.paid: boolean` → `billable?: BillableAction`. A skill now declares WHICH price it
  carries; "it costs money" was not enough information to charge anything.
- `deps.billing` (`SkillBilling`) is the gate + till, implemented in the route over the SAME
  `creditGate` / `billUsage` / `quotaRefusalMessage` the dedicated routes call — one implementation,
  so the two doors into the engine cannot drift.
- Order is load-bearing: **gate → run → bill**. A refused run costs nothing; a run that throws is
  never billed.
- 🔑 **FAILS CLOSED.** A skill that declares a price with no seam wired is REFUSED, never run free.
  The 4 existing tests that reach the paid engine all went red until handed a till — the guard
  proved itself by construction.
- The refusal also raises the **real paywall dialog** (`credit-wall` SSE frame → `reportCredit402`
  → the existing listener), not just a sentence the model relays. Without it, once the pill is gone
  that is the ONLY paywall a creator meets, and it would have no upgrade door.

⚠️ `route-wiring.test.ts` listed chat under `FREE_ROUTES` asserting *"no gate, no bill (a decision,
not an omission)"* — **and its own comment already flagged the hole it was covering for.** A blanket
"no `billUsage` in this file" assertion passes loudest exactly when the meter is missing. Chat now
has its own test pinning both halves separately: the turn stays free, the dispatched skills pay.

### §8.3 — Traps for steps 3–5

- **Steps 3 and 5 are COUPLED and must be designed together.** `activeTool` is no longer a render
  input (Lane 1 fixed that), but it is still the **submit router** — ~28 call sites, incl. the
  slash menu, the audience-mode coercion, the rehydrate restore, and the Start-grid arming
  (`setActiveTool("test")` at composer.tsx:1106/1130, `"script"` :1118, `"hooks"` :1144). Step 5's
  one-shot tile needs that router; step 3 only removes the pill UI. Do not delete `activeTool`.
- **The `/` slash menu is a second door to the same picker** and shares `isSkillVisible` with the
  pill (composer.tsx:2019-2026). Deleting the pill without deciding the slash menu's fate leaves
  half a selector.
- Full-suite runs report **3 unhandled errors** — **pre-existing**, verified on `origin/main`
  (which is 4764/0 with the same 3). They misattribute the blame line to whatever test was running,
  so a real failure can look like it is in an unrelated file. Read the `Failed Tests` block, not
  the error's "originated in" line.
- The shell wrapper mangles `npx`/`pnpm exec`. Use `node node_modules/vitest/vitest.mjs run` and
  `node node_modules/next/dist/bin/next build`.
- A fresh worktree has **no `node_modules`** — `pnpm install --frozen-lockfile` first (~1 min).

### §8.4 — Still open

- An agent-dispatched **`account`** run is still neither gated nor billed — `/api/account-read` has
  no gate at all (pre-existing; it is a pricing call the owner owes, and `account` is not in
  `CREDIT_COSTS`). The chat path reaches it via `request_input`, so it inherits that hole.
- `runSkillDispatch` (skill-dispatch.ts) is **not on the live path** — the route uses
  `runChatAgentStream`. It kept its own leash and is now `billable`-aware, but it has no billing
  seam. If it is ever revived, it needs one.
