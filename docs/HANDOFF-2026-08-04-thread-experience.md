# Handoff — thread experience → production ready (2026-08-04)

**Goal:** one thread that feels smooth, clean and finished — a creator talks, the right thing happens,
and nothing on screen lies to them.

**Base:** `origin/main` @ **`6d48efab`** (PR #424 merged 2026-08-04, deployed). Read that ref with
`git rev-parse`, never `git log --oneline` — it elides merge commits in this repo.
**Worktree:** `~/virtuna-slot-a` (a slot worktree; see `CLAUDE.md`).
**Predecessor:** `docs/HANDOFF-2026-08-04-chat-agent-dispatch.md` — ✅ CLOSED. Read it for the
mechanisms and the traps, not for work.

⚠️ **Merging to `main` IS deploying.** Prod builds ~3s later; there are no preview URLs. Gate before
the push, not after — and a green Vercel check on a PR is **not** a build (`ignoreCommand` skips and
posts success). Run `tsc` yourself; vitest does not typecheck.

---

## 0. Where the thread actually stands

Agent→skill routing **works now** and did not before 2026-08-04 — it had been broken since #316
(2026-07-17). Five defects were fixed and measured on the way (see the predecessor). What that buys:

- a creator can ask for ideas / hooks / a script in chat and the real pipeline runs, cards stream in,
  gated and billed at the same price as the skill pill;
- it keeps working on the **second and third** ask in the same thread (it used to poison itself);
- tapping a follow-up chip runs the thing the chip promises;
- the model can now **discuss the cards it made** instead of asking the creator to paste them back.

What that does **not** buy: the agent reaches a third of the product. That is the headline gap below.

---

## 1. THE MAP — what chat can actually reach

Twelve creator-facing skills. This table is the thing to argue with; everything else in §2 follows
from it.

| tier | skills | what happens when a creator asks in chat |
|---|---|---|
| **1 — the agent RUNS it** | `ideas` · `hooks` · `script` | the pipeline runs inline, cards stream into the thread, credit gated + billed |
| **2 — the agent BROKERS it** | `remix` · `account-read` · `explore` · `read` · `test` | `request_input` surfaces an inline field or a confirm button; the **client** runs the skill on its own route when the creator submits |
| **3 — no agent path at all** | `predict` · `profile` · `simulate` · `refine` | reachable only by tapping in the UI. Chat cannot start them |

**8 of 12 reachable through conversation, 3 of 12 actually driven by the agent.**

### Why tier 2 is not tier 1 — mostly NOT a capability limit

`explore-runner.ts`, `remix-runner.ts`, `predict-runner.ts`, `profile-runner.ts` and
`simulate-runner.ts` all exist as extractable library modules — the exact shape `SKILL_TOOLS` already
wraps for ideas/hooks/script. Binding one is a registry entry, not a build. The five split in two:

**Genuinely blocked — the model cannot fabricate the input (2):**
- `test` — needs a real video **file** or a TikTok URL. A file upload cannot come from a model.
- `remix` — needs a *specific external video link*; a model inventing one is the failure mode.

**A policy choice, not a limit (3):**
- `account-read` — `kind: "none"`. Needs **nothing typed**; it is a bare confirm button.
- `explore` — *"leave it blank to pull your niche"*. Runs with no input at all.
- `read` — takes a concept/hook the model could extract from the conversation exactly like a `topic`.

### The policy has a real reason — do not casually undo it

The confirm tap is a **spending-consent gate on a different wallet**. Tier 1 spends *credits* (your
own ledger, gated and billed). `account-read`, `explore` and `remix` hit **Apify scrapes**: rotating
FREE accounts on a **$5/month hard cap** (~$3.40 left, resets 2026-08-20), 25–126s each. An agent that
can *decide* to scrape can burn that cap with nobody tapping anything.

🔑 So the promotion candidate is **`read`** — it is an audience SIM, not a scrape, so the cap argument
does not apply. **Verify it touches no Apify path before moving it**; that assumption is unverified.

### Tier 3 is NOT dormant — checked, not assumed

`composer.tsx` calls all three routes: `simulate` is the ＋door lane that shipped, `profile` is the
evidence-upload path (`handleProfileSubmit`), `predict` renders through `reaction-distribution-block.tsx`.
They are **live skills with no agent path** — a creator can tap them but cannot ask for them. That
makes the gap bigger, not smaller. (`refine` is deliberately here — see §3.)

---

## 2. The work, ranked

### P0 — Drive a real anonymous `/go` session through the chat route
The **only** claim in the predecessor measured offline-only (§3 there), and it guards the free door
into the paid engine. `FREE_SKILL_TOOLS` is empty, so an anonymous visitor binds NO generators and the
agent must refuse honestly rather than writing the pack out in prose. Offline it went 0/6 → 6/6, with
a residual **1/6 leak** that is the ceiling of a prompt-level guard.

Now doubly worth doing: §6b puts real card text into the replayed transcript, and the guard keeping it
away from an unbound session is a **unit test, not a live observation**.

Definition of done: a real unauthenticated session driven through `/api/tools/chat`, showing the
refusal and **no hook/idea/script lines** in the response body.

### P1 — Close the coverage gap: `read` → tier 1, `predict`/`profile` → tier 2
Takes conversation from 8/12 to 10/12 without touching the scrape budget.
- `read` — bind as a `SkillTool` (registry entry + adapter over its runner). Check the Apify question first.
- `predict`, `profile` — add `SKILL_CAPABILITIES` entries so `request_input` can surface their field.
  `profile` needs a file/evidence upload → `kind: "upload"`; `predict` needs a concept → `kind: "text"`.

Guard to add either way: a drift test asserting every `ChatTurnKind` is either bound, brokered, or on
an explicit "no agent path" allowlist — so the next skill added cannot silently be unreachable.

### P2 — Look at the thread in a browser
Every claim about chips, capsules and loading states is measured at the wire or in the loop. **Nobody
has watched a creator tap one.** ⚠️ `CLAUDE.md`: Playwright screenshots hang on this app (ambient
animations never settle) — use raw Playwright with `animations: 'disabled'` + `caret: 'hide'` + a
tight `clip`, or verify via `getComputedStyle` / `getBoundingClientRect`.

Specifically worth looking at: the dispatch capsule labelling itself ~22s before cards land; the
chip row under a completed turn; what a credit-wall mid-stream actually looks like.

### P3 — Decide whether a pinned chip should show its price
A chip now reliably **spends a credit** where it used to degrade into free prose. That is correct
(prose delivery of a paid pack was the leak) but it was previously free-by-accident, so the affordance
may deserve a beat of UI. Product call, not an engineering one.

### P4 — The four blind scrape waits
25–126s each with artifacts already in hand. Calibration is the cheapest fix: it HAS real stages, it
just sends them as `status`. See `docs/HANDOFF-2026-08-01-thread-loading-premium.md` §7–§10.

---

## 3. Decided — do not re-litigate

- **`refine` is NOT bound to the agent loop, and should not be.** It is CARD-scoped: needs a `cardRef`
  plus the card's content as `anchor`, returns ONE card. It already has a live door — the composer's
  `detectRefineIntent` fires on "make hook 2 punchier" and routes to `hooks.startRefine`. A turn-level
  chip has no card in hand, so binding it would mean inventing a reference. "Punch them up" wants a
  fresh scored hooks run = `generate_hooks`, already bound.
- **Continuation chips carry their intent as DATA, not as a better sentence.** Rewording was tried and
  measured: a continuation clause reached 1/3 and destabilised sibling chips.
- **`mode` stays `"chat"` on the agent path**; only `modeLabel` moves. `mode` selects `MODE_ROLES`, so
  changing it would change the grounding content.

---

## 4. How to measure anything here

```bash
# OFFLINE — replays a REAL thread through the real loop. 5 asks × 3 seeds × 3 variants.
# COSTS NOTHING: `billing` is omitted, so billable skills FAIL CLOSED and the paid engine never runs.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs --tsconfig ./tsconfig.json \
  scripts/probe-chat-dispatch.ts
PROBE_DRY=true …                       # anchor only, no model calls
PROBE_THREAD=<id> PROBE_ASK="<ask>" …  # a different thread / cut point

# LIVE — mints a session, drives the SSE route. SPENDS REAL CREDITS (one run per turn).
npm run dev -- --port 3005
node --env-file=.env.local scripts/live-chat-turn.mjs                                # the §4 sequence
node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<ask>"         # one typed turn
node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<prompt>" hooks # …as a CHIP
```

🔑 **Replay the conversation that actually failed — never a synthetic one.** A hand-built transcript
carrying the same poisoned sentence dispatched **3/3 and proved nothing**; the real thread reproduced
the bug on the first run.

🔑 **Keep the no-dispatch controls, and READ WHAT THEY SAY.** A change that only dispatches MORE is not
a fix. And §6b — a whole defect — was hiding inside a control that was passing.

Live auth: `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with `apikey` + `Authorization:
Bearer <ANON>` → cookie `sb-<ref>-auth-token.0 = 'base64-' + base64url(JSON(session))`, chunked at
3180. Creds `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` in `.env.local` — a **real prod account**. The
thread a turn lands in is the `maven_active_thread` cookie; `__new__` forces a fresh one.

⚠️ `curl` is not installed — use `node -e` with `fetch`.
⚠️ `next dev` buffers stdout when not a TTY: the log stays 0 bytes while the server serves fine. Probe
it with a request; do not tail the log to decide whether it is up.

---

## 5. Gates, and the traps in them

```bash
node node_modules/typescript/bin/tsc --noEmit     # vitest does NOT typecheck — run this separately
node node_modules/vitest/vitest.mjs run > /tmp/suite.log 2>&1; echo "EXIT=$?"
```

Baseline at `6d48efab`: **tsc 0 errors · 460 files / 5106 tests / 0 failures · 42 skipped.**

- ⚠️ **`EXIT=1` with zero failures** is known drift in the slot worktrees. Judge on the `Tests N failed`
  line only.
- ⚠️ **3 "Errors"** are pre-existing unhandled rejections from `composer.tsx:2019` in `composer.test.tsx`.
- ⚠️ **Never pipe the suite through `| tail -n`** — it discards the `FAIL` lines you need, and the pipe
  makes `$?` the *tail's* status, so `EXIT=0` means nothing. This cost a full re-run.
- 🔑 **`composer-*.test.tsx` fails on a COLD vitest cache and passes on re-run**, with
  `Error: Test timed out in 5000ms` at `await import('../composer')` — a module-TRANSFORM cost, not
  behaviour. **Bisecting it with `git stash` LIES**: stashing rewrites the files whose transform cache
  is the variable you are measuring. It produced a clean, false "my change caused it", twice. Settle it
  by stashing back to the committed HEAD and running the file **twice** — at HEAD, run 1 failed and
  run 2 passed with none of the new code present.
- ⚠️ `git stash push -u` sweeps **untracked** files. This worktree is shared with another session whose
  `zz-*` files are untracked. Stash by explicit path, without `-u`. Stage by name; never `git add -A`.

---

## 6. Files you will touch

| file | what it owns |
|---|---|
| `src/lib/tools/skill-dispatch.ts` | `SKILL_TOOLS` — the registry. **Adding a skill to tier 1 is one entry here.** |
| `src/lib/tools/skill-capabilities.ts` | `SKILL_CAPABILITIES` — the `request_input` actions (tier 2). One entry each. |
| `src/lib/tools/chat-agent-loop.ts` | the streaming loop: tool binding, the directive, `forceSkill`, `replayPriorTurn`, the billing seam |
| `src/lib/threads/chat-prior-turns.ts` | the anchor — past runs + their card lines |
| `src/lib/tools/chat-followups.ts` | the chips and their declared `skill` |
| `src/app/api/tools/chat/route.ts` | the SSE route: binds skills per user, forwards `forceSkill`, persists |
| `src/components/thread/thread-turn.tsx` | THE turn renderer — one component, every skill, live or reloaded |

---

## 7. Ground rules that keep paying off

1. **Structure beats prompt text.** Every fix that stuck was structural; every prompt attempt
   plateaued and destabilised something else.
2. **Measure the thing that actually failed** — replay the real thread, not a synthetic one.
3. **A change that only dispatches MORE is not a fix.** Keep controls, and preserve them by
   construction rather than by the model's good judgement.
4. **Read what your controls SAY, not just whether they passed.**
5. **A green suite is not a verified feature.** 5000 tests were green through a routing bug that meant
   the product's main door did nothing — the loop test passes `systemPrompt: "sys"` and the route test
   mocks `assembleBundle` down to `input.ask`, so neither real prompt ever entered a test.
