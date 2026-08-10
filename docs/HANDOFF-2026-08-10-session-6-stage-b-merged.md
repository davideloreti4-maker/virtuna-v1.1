# Handoff — session 6: Stage B complete, walked, MERGED to main (2026-08-10)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Outcome:** Stage B built, tested, live-measured and **merged to `main`**. Everything ships dark
— `NEXT_PUBLIC_ENGINE_ONE_BRAIN` is set nowhere, so merging changed no product behaviour.
**Vercel is disconnected/inactive (owner switching accounts): merging did NOT deploy.**

Read `docs/CONTEXT-AUDIT-2026-08-10.md` next — it is the brief for the following session.

---

## 1. What this session inherited

A **half-built, untested, uncommitted Stage B** in the working tree. A prior session had written
the SERVER halves of B1/B2/B3 and stopped mid-flight:

- `one-brain-flag.ts` existed with **zero consumers**
- `preGuess` was exposed by the stream hook and **rendered nowhere**
- `ThreadOutro` accepted a `cardLines` prop **nobody passed**
- `pre-router.ts`'s header claimed "unit-tested in `__tests__/pre-router.test.ts`" — **the file did
  not exist**
- nothing was committed; the task list said B2 "in_progress"

Reconstructing that state cost roughly a third of the session. **Lesson for future sessions on this
lane: commit at every green point, even mid-stage.** The auto-push hook makes it cheap.

## 2. What was built (client halves + the fixes the tests found)

| Lever | What it does now |
|---|---|
| **B1** | A card CTA ("Write the script →") enters the agent loop carrying the clicked line as an `anchor` rider, instead of POSTing the pinned one-shot that cannot see the conversation. `forceAnchor` overrides whatever anchor the model wrote and stands in as `topic` so a pinned run never dies on "no topic". |
| **B2** | A rewrite chip carries the pack it points at. `ThreadTurn` collects `cardLinesOf(body)` → `ThreadOutro` → `FollowupRow` → composer → the chat body's `cards`, fenced by the assembler under a rewrite contract. Pack size drives the hook count. |
| **B3** | The router's dead zone gets a hedged label ("Looks like a hooks run…") from a keyword pre-router, replaced the moment the real `dispatch` frame lands. |

Scope is the pin's scope — round 1, the pinned tool only. A typed ask and every later round stay
byte-identical, and a chip with no pack calls its handler with the arity it always did.

### Defects the tests found in the inherited code

1. **The pre-router guessed a run on its own documented counter-example.** Its header names *"how do
   my hooks compare"* as the thing that must NOT guess — and `do` was in the generation-verb list.
   Dropped it, plus added a `QUESTION_OPENER` guard for the harder case a verb list cannot see
   (*"what should I write, hooks or a script?"* carries a real verb AND a real noun and is still a
   question). `can/could/would` excluded — "can you write me hooks" is a request.
2. **"Turn the best idea into a script" guessed `ideas`.** First-noun-by-position is wrong after
   "into", which names a destination — and it is the product's own chip copy.
3. **The assembler told the model to "REWRITE these exact script"** when the numbered list under it
   was that script's beats. Now "script beats".

## 3. What was measured

### The A/B that justifies B2 (`.scratch/probe-stage-b.ts`, re-runnable)

Two real hooks runs, temp-0, same profile, the real "Punch them up" chip prompt over a 5-hook pack:

| arm | mean subject retention | cards | s |
|---|---|---|---|
| A · control (no pack) | **7%** | 5 | 15 |
| B · packed (Stage B) | **75%** | 5 | 10 |

Arm A returned five strangers — the measured defect reproducing exactly. Arm B returned sharper
versions of all five inputs. **Caveat:** one of B's five came back essentially verbatim
(punctuation only), so "punch them up" did nothing for that card. Craft, not wiring.

### The signed-in walk — 7 real runs (~9 credits) on `e2e-test@virtuna.local`

| # | question | verdict |
|---|---|---|
| 1 | end to end | ✅ hint at 0.0s → dispatch at 2.9s → 5 hook cards |
| 2 | typed "rewrite these" fills the `cards` slot? | ❌ **NO — see §4** |
| 3 | route bouncer | ✅ typed ask → `{certain:false}`; question → no frame; chip → `{certain:true}`; unknown skill → no frame |
| 4 | billing | ✅ hooks 1 credit ×5, script 2 ×2, each **billed once**, same price as the old one-shot |
| 5 | after reload | ✅ identical; the CTA's user turn reads naturally |
| 6 | pre-router on REAL asks | ✅ 82 asks from `messages`: **93% correct, 0 wrong-skill, 1 false alarm** |
| 7 | hint timing | ✅ frame at 0.0s server-side; capsule seeds at 0.9s for a declared skill |

**B1 verified by network capture:** the CTA POSTs `/api/tools/chat` with
`{ask:"Write the script from this hook.", skill:"script", anchor:"<clicked line verbatim>"}` and
makes **no** POST to `/api/tools/script`.

**Pre-router improved by the real data:** the 10 misses shared one shape — asks that OPEN with the
artefact and skip the verb ("3 hooks for gym myths", "/hooks for my app"). Added `LEADING_REQUEST`,
anchored to the start (which is what makes it safe without a verb). 87% → 93%.

## 4. 🔴 The two findings that change what to build next

### B2's TYPED door does not work — and never did

A typed *"rewrite these tighter and more specific"* under a fresh hooks pack produced **no dispatch
at all**: the model rewrote the five hooks **as prose** in the chat answer, bypassing the pipeline
entirely (no scoring, no cards, nothing saveable). Re-run with the flag **OFF**: identical.

- **Stage B did not break it — it was already broken this way.**
- **The `cards` schema slot + directive currently earn nothing.** The model never reaches for them.
- B2's measured 7%→75% comes **entirely from the chip path**, where the CLIENT supplies the pack.

The fix is probably to treat a typed rewrite the way a chip is treated — detect the intent, pin the
skill, attach the pack — rather than asking the model to copy lines into an argument. Note the
comment in `skill-dispatch.ts` describing the old defect ("returned five strangers") no longer
matches reality: today it does not run at all.

### Context makes the agent claim work it did not do

In a thread that already held a hooks pack about "morning focus", the ask *"write me 5 hooks about
morning focus"* produced `meta → predispatch → done` in 3.5s — **no dispatch, no cards** — with the
answer *"Here are 5 hooks for 'morning focus'…"*. The identical ask on a fresh topic dispatched
normally and produced 5 real cards. The model treated a repeat ask as already satisfied and then
narrated delivery. **Reproducible: ask for the same thing twice in one thread.**

## 5. Gates + merge

tsc clean · **5,807 tests passed / 0 failed** · prod build clean — run again on the merged tree
(main had moved 6 commits, all landing-page work, disjoint; merge was clean).

Commits on the lane this session:

```
19a63f57  docs(engine): commit the session-4/5 A/B evidence residue
49964fb8  feat(chat): pre-router learns the leading-artefact ask; walk closes all 7 items
403b5bd5  docs(chat): session-6 handoff — Stage B complete, 7%→75% measured
98e7c860  feat(chat): Stage B one brain — card CTAs, rewrite packs, pre-dispatch hint
```

## 6. Still open

**Owner decisions**
1. **The flag flip.** Everything is dark. Recommended set when Vercel is back:
   `GROUNDING_SCRIPT_ADAPT` + `GROUNDING_HOOKS_ADAPT` + `GROUNDING_HOOKS_SURFACE=structure` +
   `ENGINE_JUDGE_{HOOKS,IDEAS,SCRIPT}` + `NEXT_PUBLIC_ENGINE_ONE_BRAIN`. `GROUNDING_IDEAS_ADAPT`
   still held. ⚠️ `NEXT_PUBLIC_` ⇒ needs a REDEPLOY to reach the client; without it the server
   honours riders the client never sends.
2. **F-6 multiplier positioning** — still bracketed.
3. **`composer.tsx` split** — Stage B touched only two callbacks, so the "split WITH Stage B"
   argument no longer applies.
4. **Should the co-pilot sound like the creator, or like Maven?** Taste, not engineering — it
   decides whether `voice` joins `MODE_ROLES.chat`.

**Not verified**
- Rider capping at the route (anchor 5000-slice, `sanitizeCards` on the body, riders dropped
  without a `skill`) — not observable without a paid run per case; unit-tested one layer down.
- The sealed-visitor guard on the predispatch frame — needs an anonymous `/go` session.
- Production. Everything was a local dev server against the shared prod database.

**Coverage gaps carried from session 5** — `develop`/`refine`/`chat` still have no quality lever;
`remix` is unguarded by the judge.

## 7. Traps learned this session

- **A card CTA's accessible name is its `aria-label`, not its visible text.** The hook-card button
  reads "Write the script →" but announces "Write a full script from this hook", so
  `getByRole('button', {name:/Write the script/})` finds NOTHING. Use a text locator.
- **Playwright's `.textContent()` on a vanished locator blocks for the full 30s timeout**, so a poll
  loop sampling a disappearing element reports a plateau that never happened. It made a 0.9s capsule
  seed look like 33 seconds of "Thinking…". Sample with `$$eval` over a list (length 0 when absent).
- **Two `next dev` servers cannot run from one worktree** — they fight over `.next/dev/lock`. To A/B
  a server-read env flag, restart the same server; do not start a second.
- **The first request to a dev route returns nothing for >12s** while Turbopack compiles it. A probe
  with a timeout records an empty result that looks exactly like a broken feature. Warm, then measure.
- **A stale `.next/dev/types/validator.ts` fails `tsc` after you delete a page the dev server saw.**
  `rm -rf .next/dev`.
- **`public.messages` is not the only `messages` table** — `information_schema` without
  `table_schema='public'` describes Realtime's internal one instead, silently. The app's user text
  lives at `body->'blocks'->0->'props'->>'text'`.
- **`FollowupRow` calls its handler with the OLD arity when there is no pack**, deliberately — the
  control tests assert exact arity and vitest counts it.
- **`chat-turn.test.tsx`'s `SCRIPT_CARD` fixture is stale** — beats carry `text`, the real schema
  (`blocks.ts`) says `content`, which is what `cardLinesOf` reads.
- **🟡 Four composer tests are FLAKY under full-suite load.** On the first post-merge full run,
  `composer-fold-on-close`, `composer-offline-gate` (×2) and `composer-stop-disc` failed. All three
  files pass in isolation, and a second full run was green (5,807/0). Not caused by this session's
  composer edits — the pre-merge full run was green with those edits already in. Recorded because
  "green on the retry" is exactly how a real order-dependent bug hides. If they fail again, chase
  test pollution / worker ordering, not the composer.
- **The memory store cannot be written from this worktree** — the path guard rejects
  `~/.claude/projects/...` because it resolves to a different git root. `in-thread-chat-audit-lane.md`
  is therefore STALE (still says "Stages B/C/D not started"). Only a session in the trunk worktree
  can fix it. These docs are the durable record.

## 8. Re-runnable harnesses (`.scratch/`, gitignored)

```bash
# Stage B live A/B — 2 hooks runs + 1 script run, flash credits, ~40s
node node_modules/tsx/dist/cli.mjs .scratch/probe-stage-b.ts
# Pre-router vs 82 real asks — free, no network
node node_modules/tsx/dist/cli.mjs .scratch/probe-pre-router-real.ts
# Signed-in probes — mint the cookie first (writes .scratch/auth-state.json; deleted at session end)
node node_modules/tsx/dist/cli.mjs .scratch/mint-auth.ts
node .scratch/probe-route-riders.mjs          # the bouncer
node .scratch/probe-full-turn.mjs "<ask>"     # every frame of one turn
node .scratch/walk-cta.mjs                    # click the card CTA, capture the POST
```

Dev server for the walk: `NEXT_PUBLIC_ENGINE_ONE_BRAIN=true npm run dev -- --port 3011`.
Spend: 3 probe runs + 7 walk runs this session, all flash; ~9 credits on the e2e account.
