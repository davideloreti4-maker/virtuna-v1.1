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

## 8. LANE 2 — ✅ COMPLETE AND MERGED TO `main`

**All five steps are on `main`.** Steps 1–2 via PR #395 (`6392ff85`); steps 3+4+5 via
**PR #398, squash `5006f9c3`** — they landed together on purpose (see §8.8).

| # | Step | State |
|---|------|-------|
| 1 | Prefill fix (was: add 4 skills to `SKILL_TOOLS`) | ✅ merged `6392ff85` |
| 2 | Gate + bill agent-fired runs (+ the wall) | ✅ merged `6392ff85` |
| 3 | Delete the skill pill | ✅ merged `5006f9c3` |
| 4 | Delete "Ask the room" | ✅ merged `5006f9c3` — owner RE-CONFIRMED against new facts (§8.7) |
| 5 | Start-grid tile → one-shot → chat | ✅ merged `5006f9c3` |

Verified **on the merged `main` tree**, not just on the branch: suite **4824/0** (441 files,
1 skipped) · `tsc` clean. On the branch it was also 4825/0 with `NEXT_PUBLIC_AMBIENT_V2=true`,
the production build compiled, and the **live walk-through PASSED on a production build** (§8.8).
Baseline before the lane: 4813/0.

Owner calls taken this session: **remove the `ask` verb** · **KEEP the `/` slash menu**.

⚠️ **If you are the ＋door / ARM lane, read §8.10 BEFORE you rebase.**

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

### §8.5 — ⚠️ THE ARM LANE CHANGED STEP 4'S PREMISE. Do not start step 4 without the owner.

While Lane 2 steps 1–2 were in flight, a second session shipped to `main`:

- `fe067d1b` — **"Ask the room" is now a PRICED action**: `/api/tools/react` gates and bills at
  **1 credit** under its own `react` key in `CREDIT_COSTS`.
- `39fc42d7` — a refused Ask-the-room **raises the credit wall** (the same fix this lane made for a
  refused agent dispatch — the two sessions converged independently).
- `e29d3930` — the `＋ Test something of your own` cold door promotes the room reaction to a
  **primary action**, which is *why* it got priced.

Step 4 as written is **"delete Ask the room"** (an owner call, locked). That call was made when the
room reaction was a free side-feature. It is now a priced, walled, primary-doored action that
another lane just invested in. **Deleting it would delete a revenue line that is four days old.**

This is not a conflict to resolve in code — it is a product decision the owner has to re-make with
the new facts. `/api/tools/react` was always going to STAY (the room rail is its other caller); what
is now in question is whether the composer's `ask` VERB should go at all.

### §8.6 — Copy-paste brief for the fresh session

Everything below is verified as of 2026-07-28, tip `6392ff85`.

```
Continuing Virtuna, Lane 2 (composer chrome). Steps 1-2 are MERGED to main
(PR #395, squash 6392ff85) and the worktree ~/virtuna-composer is already on
that tip with node_modules installed — work there, do NOT use ~/virtuna-platform
(another session commits into it live).

Read docs/HANDOFF-2026-07-28-one-thread-one-renderer.md §8 first. It is the SSOT
and it records the two places the original Lane 2 plan was wrong.

Cut a fresh branch off main before touching anything:
  cd ~/virtuna-composer && git fetch origin && git checkout -b lane/composer-pill origin/main

REMAINING WORK, in order:
  3. Delete the skill pill (composer-controls.tsx + its popover).
  5. Start-grid tile becomes a one-shot, then falls back to chat.
  4. "Ask the room" — DISCUSS WITH THE OWNER FIRST, do not just delete it (§8.5).

Steps 3 and 5 are COUPLED — do them together. activeTool is no longer a render
input (Lane 1 fixed that) but it is STILL the submit router across ~28 call
sites, including the Start-grid arming that step 5 needs. Do NOT delete
activeTool; delete only the pill UI. Also decide the `/` slash menu's fate — it
is a second door to the same picker and shares isSkillVisible, so removing the
pill alone leaves half a selector.

Owner calls LOCKED: keep the Start grid · no skill pill in the composer · one
run at a time · intro/outro/loading states preserved 1:1. ("remove Ask the room"
was also locked, but §8.5 explains why it now needs re-confirming.)

Before step 3 lands, two things are owed:
  - A LIVE walk-through of the billing path on a production build. The suite is
    green and tsc is clean, and Lane 1 proved that is not enough — both defects
    it shipped were found live. Deleting the pill is what makes this path
    load-bearing.
  - The `account` pricing call: /api/account-read has NO gate and `account` is
    not in CREDIT_COSTS, so an agent-dispatched account read is still free.
    That is a decision, not a code task.

Verification gotchas that cost real time (§6 + §8.3):
  - The shell wrapper mangles npx/pnpm exec. Use:
      node node_modules/vitest/vitest.mjs run
      node node_modules/next/dist/bin/next build
      node node_modules/typescript/bin/tsc --noEmit
  - A full suite run reports 3 UNHANDLED ERRORS that are PRE-EXISTING (verified
    on origin/main). They misattribute the blame line to whatever test was
    running, so a real failure can look like it is in an unrelated file. Read the
    "Failed Tests" block, not the error's "originated in" line.
  - /home reopens the last thread — click "New Thread" for a clean one.
  - The login page has TWO input[name="email"]; fill form input[name="email"] LAST.
  - Screenshots hang (the ambient room never settles). Assert on the DOM.

Carry these two habits in — both were earned expensively:
  - A plan's file-level claims are GUESSES until you read the source. Lane 1's
    plan was wrong in 5 places; Lane 2's step 1 premise was simply false, and
    building it as written would have moved the two most expensive actions in
    the product onto an ungated, unbilled path.
  - Mutation-verify every guard. A test you have not watched fail is a guess.
```

### §8.7 — Step 4: §8.5 was right to stop, and wrong about what was at stake

§8.5 said deleting "Ask the room" would "delete a revenue line that is four days old". Measured
before touching anything, and it was not:

- **The verb and the rail's armed sim are two different doors** to `/api/tools/react`. The route,
  its 1-credit price, the `＋ Test something of your own` cold door and `AmbientOverviewRail.fireSim`
  are all untouched by step 4. What the ARM lane invested in was the rail's door, and it survives.
- **`NEXT_PUBLIC_AMBIENT_V2` is NOT set in production** (`vercel env ls production` — 23 vars, not
  among them). Prod still renders the LEGACY room, so the v2 rail the ARM lane built is not live yet.
- **The verb billed for silence.** A throwaway probe rendered the real `Composer`, fired a
  *successful* ask, and asked what reached the DOM:

  | | react call | thought shown | verdict shown |
  |---|---|---|---|
  | flag OFF, fresh /home | 1 (billed) | ✗ | ✗ |
  | flag OFF, existing thread | 1 (billed) | ✓ (collapsed pulse bar) | ✗ |
  | flag ON, either state | 1 (billed) | ✗ | ✗ |

  Under the v2 flag `AmbientOverviewRail`/`Sheet` never consumed `audienceAsks` or the thought
  focus at all — so the direction the product is heading in made the verb *more* dead, not less.

Its only doors were the pill (deleted the same day) and `/ask`. **The owner re-confirmed the
original call with these facts in hand.**

⚠️ **The deletion's other half:** the ONLY test asserting that a refused room reaction raises the
credit wall was `composer-ask-credit-wall.test.tsx` — written against the *verb*. Deleting the verb
would have taken that coverage with it and left the surviving, owner-invested door with none. The
behaviour moved, so the test moved: `AmbientOverviewRail.credit-wall.test.tsx`.

### §8.8 — Steps 3+5 are ONE change, and what building it actually taught

**Why they cannot ship apart.** Deleting the pill removes the only way to *un-arm* yourself. Without
the one-shot, a creator who tapped a Start tile — or merely reloaded a thread of hook cards, which
used to restore the arm — would sit silently armed on a paid skill, and every plain sentence they
typed afterwards would buy another pack. The pill's deletion is what makes the one-shot mandatory.

**`activeTool` had to split in two.** `activeTool` = what the NEXT send does (submit router,
placeholder, model tier, Start tile highlight, armed indicator). `runningTool` = what the LAST send
did. Everything keyed on the run that is ON SCREEN moved to `runningTool`, and each would have
broken silently otherwise:

- `testSubmitPending` — the ~2-minute Test progress spine would have blanked the instant the run
  started, because that is exactly when the arm reverts.
- `testRunFailed` — the failure turn would never render.
- `canRoomRewrite` / `onRoomRewrite` / the reseed effect — the "Rewrite to win back the N% who
  bounced →" CTA appears AFTER a run produces cards, i.e. after the revert. It would have vanished
  at the moment it becomes meaningful.

**Three things only the build revealed:**

1. 🔴 **The rehydration fetch is a round-trip, and it clobbered a live run.** Seeding `runningTool`
   from the thread's last persisted card landed AFTER a run the creator had started in the meantime
   and overwrote it — a funnel visitor's dead video Test rendered *nothing at all*. Guarded by
   `hasDispatchedRunRef`; caught by the Test failure-turn suite the moment the seed was added.
2. 🔑 **A retry must NAME its tool.** `handleSubmit()` reads the CURRENT arm, which by the time an
   error card exists is chat — so "Retry the video test" would have sent the failed video's URL as a
   chat message. Hence `handleSubmit(toolOverride?: ToolId)` and `handleSubmit("test")`.
3. 🔑 **`armFired()` sits at each DISPATCH, never at the top of handleSubmit.** A branch that bails
   (the General-verb audience gate, an expired session, a failed upload, a non-TikTok URL) must keep
   its arm, or a creator whose upload failed would have to walk back to the Start grid.

**The pill's replacement is not a smaller pill.** `armedIndicator` STATES the armed skill and offers
exactly one control — `×`, back to chat. No menu. It exists because the placeholder was going to be
the only signal that the next send spends 10 credits on a video Test, and a placeholder vanishes the
moment you type. If it ever grows a popover it has become the thing that was deleted.

**Nine guards, all mutation-verified** — each watched failing against a deliberate reintroduction of
the bug it claims to catch (pill restored · one-shot removed · reload re-arming · retry inferring its
tool · spine on the arm · the rehydration race · `ask` resurrected in the registry · the rail's wall
removed).

**LIVE WALK-THROUGH — PASSED 2026-07-28**, production build, real anonymous session, port 3210:

| Check | Result |
|---|---|
| skill pill (`#composer-skill-pill`, `aria-label^="Skill:"`) | **absent** |
| `/` slash menu | opens, 8 skills, groups Make/Test/Ask |
| `/ask` · an "Ask the room" row | **gone** |
| `?v=Test` launch → armed indicator | "A real video" |
| indicator `×` | → chat placeholder, Test drop zone collapses to 0px |
| Start grid Hooks tile | arms "Hooks"; **zero** API calls on arming |
| send | `/api/tools/hooks` · indicator gone · placeholder back to chat |
| **the next send** | **`/api/tools/chat`** — NOT a second hooks pack |
| `/api/tools/react` | **never called**, on any path |
| reload | thread restored, **no arm restored** |

⚠️ Two traps re-confirmed while doing it: `NEXT_PUBLIC_*` inlines at BUILD time (the first build
predated copying `.env.local`, so every Supabase client threw), and `~/virtuna-composer` starts with
**no `.env.local`** — copy it from trunk. `NEXT_PUBLIC_AMBIENT_V2=true` was added to that copy so the
Start grid renders; **production does not have it.**

### §8.9 — Still open after Lane 2

- 🔴 **`/api/account-read` still has NO gate and no `account` key in `CREDIT_COSTS`** — re-checked
  this session, unchanged. An agent-dispatched account read is still free. It is a pricing call the
  owner owes, not a code task.
- `runSkillDispatch` (skill-dispatch.ts) remains off the live path with no billing seam (§8.4).
- The composer's `ask` deletion left `asks` / `asking` / `onReask` on `<AudiencePresence>` as
  optional props with **no producer**. Left in place deliberately: that component is already on the
  v2 cutover's list, and widening this diff into it bought nothing.

### §8.10 — ⚠️ THE ＋DOOR LANE MUST REBASE, AND `composer.tsx` IS WHERE IT WILL HURT

`lane/platform-surface` (＋door Phases 3+4, `257fecbf`) was **unmerged** when Lane 2 landed, and
both lanes edit `src/components/app/home/composer.tsx`:

| lane | composer.tsx |
|---|---|
| ＋door (`lane/platform-surface`) | +144 / −25 |
| Lane 2 (merged `5006f9c3`) | +309 / −249 |

A dry-run `git merge-tree` reported a conflict **before** the merge, which is exactly why Lane 2
was landed first: it was finished and verified end-to-end, while the ＋door lane is still moving
(Phases 5+6 to come). Rebasing a moving branch onto a settled file is the cheap direction.

**What changed underneath you, and what it means for the conflict:**

1. **`activeTool` is no longer the whole story.** It split into `activeTool` (what the NEXT send
   does) and `runningTool` (what the LAST send did). If your hunk reads `activeTool` to decide
   something about a run that is ON SCREEN — a spine, a receipt, a CTA, a retry — it is now
   wrong and must read `runningTool`. `activeTool` reverts to `chat` the instant a run dispatches.
2. **`handleSubmit` takes an optional tool**: `handleSubmit(toolOverride?: ToolId)`. Any new
   retry/re-run path must NAME its tool, or it fires as a chat turn.
3. **`ToolId` no longer contains `"ask"`**, and `SKILLS` / `SKILL_ICON` / `VERB_BY_TOOL` /
   `PLACEHOLDER_BY_TOOL` lost their `ask` entries. tsc will catch a resurrection; a string id in
   a registry will not — `composer-controls.test.tsx` has the guard for that.
4. **`ComposerControls` no longer takes `onSelectTool` / `activeMode`** and renders `null` under
   every skill except `explore`.
5. **`AmbientOverviewRail.credit-wall.test.tsx` is new** and pins `fireSim`'s 402 → wall path.
   Your lane also edits `AmbientOverviewRail.tsx`; keep that test green — it is the ONLY
   remaining assertion that a refused room reaction says anything at all.

**Rebase, then re-run both flag ways** (`node node_modules/vitest/vitest.mjs run`, and again with
`NEXT_PUBLIC_AMBIENT_V2=true`). A green run one way is green for the product you did not ship.

---

## 9. COPY-PASTE BRIEF FOR THE FRESH SESSION

Everything below is verified as of 2026-07-28, `main` at `5006f9c3`.

```
Virtuna. Lane 2 (composer chrome) is DONE and MERGED — all five steps, main 5006f9c3.
Do not re-open it. Read docs/HANDOFF-2026-07-28-one-thread-one-renderer.md §8 only if
you need the WHY; §8.10 is the part that affects live work.

STATE OF main (5006f9c3), verified on the merged tree:
  suite 4824 passed / 0 failed (441 files, 1 skipped) · tsc clean
  The 3 "unhandled errors" in a full run are PRE-EXISTING (composer.test.tsx, a mocked
  stream.start on the tiktok_url path). They misattribute the blame line to whatever
  test was running — read the "Failed Tests" block, never the error's "originated in".

WHAT LANDED, so you don't trip on it:
  - The composer skill PILL is deleted. The `/` slash menu is the skill picker now
    (owner call: keep). A non-interactive armed indicator
    (data-testid="composer-armed-skill") states the armed skill; its only control is
    × back to chat.
  - "Ask the room" is gone from the composer FIELD. /api/tools/react, its 1-credit
    price, the ＋ cold door and AmbientOverviewRail.fireSim are all UNTOUCHED — that
    door survives and is the only one now.
  - THE ONE-SHOT: a skill is armed for exactly ONE send. activeTool = what the NEXT
    send does; runningTool = what the LAST send did. Anything about a run that is ON
    SCREEN (Test progress spine, its failure turn, the Room Rewrite CTA) reads
    runningTool. A reload restores runningTool but NEVER an arm.
  - handleSubmit(toolOverride?: ToolId) — a retry must NAME its tool or it fires as chat.

▶ THE ONE URGENT THING: `lane/platform-surface` (＋door Phases 3+4, 257fecbf) is
  UNMERGED and edits composer.tsx (+144/−25) against Lane 2's (+309/−249). It WILL
  conflict. §8.10 lists exactly what moved underneath it. Rebase it onto main before
  building Phases 5+6, and re-run the suite BOTH flag ways after.

🔴 OWNER-OWED, not a code task: /api/account-read has NO credit gate and `account` is
  not in CREDIT_COSTS, so an agent-dispatched account read is still free. It is a
  1–3 min Apify call. Re-checked 2026-07-28, unchanged. Name the price, then it's
  a small piece of work.

Verification gotchas that cost real time:
  - The shell wrapper mangles npx/pnpm exec. Use:
      node node_modules/vitest/vitest.mjs run
      node node_modules/next/dist/bin/next build
      node node_modules/typescript/bin/tsc --noEmit
  - Run the suite BOTH ways — `NEXT_PUBLIC_AMBIENT_V2=true` prefixed, and without.
    Production does NOT set that var (checked via `vercel env ls production`), so the
    default run is prod parity and the flagged run is the direction of travel.
  - A fresh worktree has NO .env.local — copy it from ~/virtuna-v1.1 BEFORE you build.
    NEXT_PUBLIC_* inlines at BUILD time, so building first gives you a bundle whose
    Supabase client throws on every page.
  - /home reopens the last thread — click "New Thread" for a clean one.
  - The login page has TWO input[name="email"]; fill form input[name="email"] LAST.
  - Screenshots hang (the ambient room never settles). Assert on the DOM.
  - To reach /home without credentials: open /go and click "Test a video free" — it
    mints an anonymous session. Anonymous is entitled to ONE Test; everything else
    refuses with the trial paywall, which is a fine way to exercise a refusal path.

Two habits, both earned expensively on this lane:
  - A plan's file-level claims are GUESSES until you read the source. §8.5 said step 4
    would "delete a revenue line four days old"; measuring found the opposite — the
    verb billed 1 credit and rendered NOTHING, both flag ways.
  - Mutation-verify every guard: watch it FAIL against a deliberate reintroduction of
    the bug it claims to catch. Nine were verified this way, and one of them caught a
    real defect the moment it was written (a rehydration round-trip clobbering a live
    run).
```
