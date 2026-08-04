# Handoff — the thread never scrolled, and the corpus SSOT was missing (2026-08-04, late)

**Base:** `origin/main` @ **`0d09c5f8`** (PR #434, merged + **deployed READY** to numenmachines.com).
Read refs with `git rev-parse` — `git log` elides merge commits in this repo.
**Worktree:** `~/virtuna-slot-a`.

Supersedes the P1/P2 sections of `docs/HANDOFF-2026-08-04-chat-routing-and-model-stack.md`. That
document is still the map for routing, the model stack and the thread's memory — read it for those.
Read THIS one for what is true now and **which of its numbers are wrong**.

---

## 0. What shipped

| PR | what | state |
|---|---|---|
| **#434** | the home thread never scrolled · the corpus SSOT recovered · the chat stance amended | merged, **live** |

Build took **118 seconds** wall clock (`buildingAt` → `ready`), not the ~4 minutes the previous
handoff estimates. That estimate is safe-but-conservative; the trap it guards against (calling a
live build dead) is real and unchanged.

---

## 1. ⚠️ THE CORRECTIONS — three numbers in the previous handoff are wrong

1. **The test baseline is `5250`, not `5219`.** Measured at pristine `470ef6ae` in a throwaway
   worktree: **472 files / 5250 passed / 0 failures / 3 errors / EXIT=1**. Quoting 5219 makes any
   honest delta look like ~31 mystery tests appeared.
2. **`scripts/live-chat-memory.mjs` is a SMOKE TEST, not a gate.** Its `PASS — the thread remembers`
   / `FAIL — context is being lost` reads as decisive and **flakes on untouched code**: pristine
   `470ef6ae` scored **3 PASS / 1 FAIL** over 4 runs. Never conclude anything from one run.
3. **Prod builds: ~2 minutes**, measured. See §0.

---

## 2. THE DEFECT — the home thread had no scroll code at all

P1 of the previous handoff said *"watch a creator use it, signed in, in a browser — nobody has
watched a chip get tapped."* Doing that broke it open on the first send.

A creator types a question into a restored thread. The agent answers in ~4s. **The screen is
pixel-identical before and after.** Their own message never appears either. Measured:
`composer-thread-region` at `scrollTop: 0`, answer at **y=1596**, chips at **y=1765**, viewport
**900px**.

`composer.tsx` had **no** `scrollTop` / `scrollIntoView` / `scrollTo` anywhere — while
`reading-chat.tsx`, `ExpertChatThread.tsx` and `PersonaChatDrawer.tsx` all pin to the bottom. The
product's **primary** surface was the only chat that did not. Everything shipped across
#424/#426/#427/#430 — the routing, the memory, the chips, the 68ch measure — was landing where
nobody could see it.

> 🔑 **Why ~5,200 tests and every `scripts/` probe missed it.** The region is `overflow-y-auto`
> inside `h-full`, so `window.scrollY` stays 0 and `document.scrollHeight === innerHeight`. Every
> page-level check reads "no scroll, nothing wrong". **You must measure the REGION.** And jsdom has
> no layout and no ResizeObserver, so no unit test can see it at all.

### The contract now in force — `src/components/app/home/use-thread-autoscroll.ts`

| behaviour | verified |
|---|---|
| open / switch a thread → newest turn | 9/9 scrollable threads, incl. one 14,041px tall |
| send / tap a chip → follow the stream | `below=0` through a 22s hooks dispatch, incl. the 2,700px jump when cards land |
| creator scrolls up → **leave them there** | **0px drift** under a real mouse wheel mid-stream |
| back within `PIN_THRESHOLD_PX` (120) | re-pins and follows again |

**Do not "simplify" this into a `useEffect` on message count.** The thread's height changes token by
token from a dozen independent streams (chat, hooks, ideas, script, remix, explore) plus async card
hydration, and no single piece of state changes on all of them. The element's own height, via
`ResizeObserver`, is the only honest signal. Scrolling is **instant, never smooth** — `smooth`
restarts its animation on every token and the thread judders for the length of a stream.

### Two traps this cost, both worth remembering

1. **A tapped chip can be thousands of pixels up.** Every completed turn keeps its chip row, so
   tapping one from an earlier turn is normal — and it ran the skill and streamed cards ~7,000px
   below the viewport. An explicit tap is consent to be taken to its result, so **send and follow-up
   both re-pin** (`scrollThreadToBottom`).
2. **The hook released its OWN pin.** A `scroll` event is delivered a frame *after* the write that
   caused it, and React flushes the optimistic user bubble in between — so the handler compared the
   position just written against a now-taller thread, got 122px against the 120px threshold, and
   concluded the creator had scrolled away. `lastWrittenTopRef` makes our own scroll
   non-reinterpretable.
   > 🔑 **Any "is the user at the bottom?" check has this race.**

---

## 3. THE CORPUS — it was gone; it is now tracked

`.planning/corpus/*.md` — described everywhere as the prose SSOT — had **zero tracked files**,
existed in **none** of the 15 worktrees on this machine, and `scripts/regen-kc.ts` died with
`ENOENT` on `base.md`. So `src/lib/kc/compiled.ts`, banner-marked *"GENERATED — do not hand-edit"*,
was in practice the **only** copy of the knowledge core, and the documented way to change it could
not be run by anyone.

Recovered by importing `compiled.ts` and writing each constant's **runtime value** back to markdown —
the template literal's value *is* the original file, so this inverts `escapeForTemplate` exactly with
no hand-unescaping to get wrong.

**Proof it is lossless:** regen over the recovered corpus reproduced `compiled.ts` at
`sha256 889004bd…9318`, byte-identical to the shipped file, *before* any edit.

> 🔑 **The editing path works again — use it.** Edit `.planning/corpus/*.md`, then
> `node node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json scripts/regen-kc.ts`. **Never
> hand-edit `compiled.ts`** — it is regenerated wholesale and your edit will vanish. The
> byte-stability contract (no interpolation, no timestamps) protects Qwen's input-cache prefix; a
> regen changes that prefix, which is expected and fine, but a *hand* edit that later gets
> regenerated over is silent data loss.

### The chat stance amendment (owner call, 2026-08-04)

Kept **verbatim**: `"NOT a list of considerations"`, `"NOT a 5-point breakdown of 'it depends'"`,
`"Direct opinion over enumerated options"`, and the Hedge-by-enumeration failure mode. Added one
Craft Pattern: structure is allowed when it **carries** the answer (steps in an order, a line worth
quoting), still forbidden when it **replaces** it with a menu of angles.

Measured by A/B on one dev server, swapping `compiled.ts` between arms:
- The two things that looked like amendment regressions occur in the **baseline too**: a sycophantic
  opener on turn 1, and turn 1 dispatching `ideas`. **Neither is caused by the change.**
- Recall: baseline 3 PASS / 1 FAIL, amended 3 PASS / 2 FAIL — both arms failing the *same* check the
  *same* way (turn 4 answers from the stored profile, not the thread). See §1.2.

---

## 4. 🔑 THE METHOD — `scripts/probe-surface-live.mjs` (new, committed)

The fix is worth less than the method that found it. This probe opens any route **signed in, in a
real browser**, and reports what a screenshot cannot be trusted for and a unit test cannot reach.
**FREE** — it loads a page, sends nothing, spends no credits.

```bash
npm run dev -- --port 3005                       # slot worktrees must NOT use :3000

set -a; . ./.env.local; set +a                   # signed-in state, ~2.3s
E2E_BASE_URL=http://localhost:3005 \
  node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts

node scripts/probe-surface-live.mjs /home,/discover,/library
SHOTS=1 VIEWPORT=390x844 node scripts/probe-surface-live.mjs /home
```

It distinguishes a **streaming region** (must stay pinned — `composer-thread-region`) from a **list**
(correctly opens at the top). Add any new streaming surface to `STREAMING_REGIONS` or it will not be
checked. Current state on `0d09c5f8`: `/home`, `/discover`, `/library` all **✓ nothing flagged**.

**Traps already baked into it** (each cost real time):
- `waitUntil: 'networkidle'` **never** settles here (dev HMR socket). `domcontentloaded` + an
  explicit wait.
- The **MCP screenshot tool hangs** on this app — ambient animations never settle. Raw Playwright
  with `animations:'disabled'` + `caret:'hide'` only.
- The app SSRs to a near-empty shell; a short `body` is **not** proof a route is broken.
- **Mobile: resizing a loaded page does not give you the mobile UI** — components measure at MOUNT.
  `VIEWPORT` is applied before navigation for exactly that reason. Never resize after load.
- Playwright's `.click()` auto-scrolls the target into view, which legitimately releases the
  autoscroll pin. When measuring scroll around a click, do **not** also call
  `scrollIntoViewIfNeeded()` — you will measure your own harness. (This produced a convincing false
  "the fix failed" during this session.)

---

## 5. Carried forward — DO NOT UNDO (unchanged, re-verified this session)

1. **FIVE model constants, three deliberately on `qwen3.7-plus`** — `QWEN_APOLLO_MODEL` (flash
   emitted zero framework citations), `QWEN_CALIBRATE_MODEL` (flash 0/7, an **outage** — every bake
   returns `scrape_failed` *after* the Apify scrape is paid for), `QWEN_UNBOUND_CHAT_MODEL` (flash
   handed the paid pack to anonymous visitors 5/6). ✅ re-verified on `0d09c5f8`.
2. **Chat reaches 8 of 12, not more.** `profile`/`simulate`/`predict` are `enabled:
   HORIZONTAL_ENABLED` and that flag is **false**. ✅ re-verified — `chat-reachability.test.ts`
   asserts the list `account, explore, hooks, ideas, read, remix, script, test` and ties it to the
   flag rather than to a document, so flipping the flag updates it automatically. 56 tests green.
3. **`refine` stays unbound** (card-scoped); **the scrape skills stay brokered** behind a confirm tap
   — Apify's $5/mo cap is not the agent's to spend.

---

## 6. Gates

```bash
node node_modules/typescript/bin/tsc --noEmit                       # vitest does NOT typecheck
node node_modules/vitest/vitest.mjs run > /tmp/s.log 2>&1; echo "EXIT=$?"
```

At `0d09c5f8`: **tsc 0 · 473 files · 5258 passed · 0 failures · 42 skipped · 3 errors · EXIT=1.**
`EXIT=1` with zero failures is known slot drift; the 3 "Errors" are pre-existing `composer.tsx`
unhandled rejections. **Never pipe the suite through `| tail`** — it eats FAIL lines and `$?`
becomes the pipe's.

⚠️ **A full run while a dev server and live probes compete for CPU showed
`composer-fold-on-close` and `composer-stop-disc` timing out at ~5010ms.** They pass in isolation on
this branch **and** at pristine `470ef6ae`. They are **load-dependent, not a regression** — settle
them by running the two files alone before assuming anything.

---

## 7. The work, ranked — production readiness, not P3–P5

> The owner's direction for the next session: **new work that gets closer to production ready**,
> rather than the previous handoff's P3–P5 (flash retry / scrape waits / chip pricing). Those stay
> open and are listed in §8.

### P1 — Walk the whole product signed in, the way §4 walked the thread
The scroll defect existed because **nobody had looked**. That is not a thread-specific failure; it is
a coverage gap across every surface. Run `probe-surface-live.mjs` over every route, then actually
*use* each one signed in — desktop **and** mobile. Everything already flagged as "shipped and live"
was verified at the wire, not at the viewport.

Two leads this session already surfaced and did **not** chase:
- **`/discover` renders only 758 chars of body text signed in.** Suspiciously thin for a surface
  whose corpus is 500+ items. Could be a correct empty state, could be Discover showing a signed-in
  user nothing. **Look before theorising.**
- **Two `.md` blocks render at 696px with `max-width: none`** while the chat turn correctly caps at
  686px/68ch. There is a second markdown surface that never got the measure fix. Find which.

### P2 — Mobile has never been systematically verified
`VIEWPORT=390x844` in the probe, plus a real walk. ⚠️ Resizing a loaded page does **not** produce the
mobile UI — components measure at mount, so every check must navigate at the mobile viewport. This is
a large unknown for a product with zero customers and a paid funnel.

### P3 — The unhappy paths
Nothing in this repo's verification history covers: empty states, a failed scrape, an expired
session mid-stream, a credit wall arriving mid-dispatch, offline. The credit wall in particular is
a **revenue** surface and I could not trigger it this session (the test account has credits).

### P4 — Retire the 3 pre-existing `composer.tsx` unhandled rejections
They have been "pre-existing" across at least three handoffs and they make every suite run end
`EXIT=1`, which trains everyone to ignore the exit code. That is exactly how a real failure ships.

---

## 8. Still open from the previous handoff (deliberately not done)

- **P3 there** — retry flash on `QWEN_UNBOUND_CHAT_MODEL`. Holdout, not a verdict. Roll forward ONLY
  behind a fresh `live-chat-anon.mjs` showing **6/6 refused, 0 leaked**.
- **P4 there** — the four blind scrape waits (25–126s each, artifacts already in hand). Calibration
  is the cheapest fix: it HAS real stages, it just sends them as `status`.
- **P5 there** — should a pinned chip show its price? Product call.
- **PR #431** (`lane/flash-apollo-calibrate`) and **#433** (omni modality split) are open and belong
  to other sessions — both were pushing commits while this session ran. `main` moves; re-measure.

---

## 9. Ground rules that paid off again

1. **Open the browser.** Five merged PRs and ~5,200 tests were green through a surface whose view
   never moved. Wire-level verification cannot see a viewport.
2. **A flag is a lead, not a verdict.** The probe's first version called a healthy saved-items list a
   defect and flagged 25 nodes of normal scrolled-past history.
3. **Measure both arms.** Two apparent regressions from the prompt amendment were present in the
   baseline. One run of a nondeterministic probe proves nothing.
4. **Suspect your own harness.** A convincing "the fix failed" was Playwright's `.click()`
   auto-scrolling; a convincing "3 tests fail" was CPU contention.
5. **Verify the SSOT exists before trusting the doc that points at it.** The corpus had been
   referenced as authoritative in multiple handoffs while absent from the repo entirely.
