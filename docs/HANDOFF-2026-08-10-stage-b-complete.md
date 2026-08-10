# Handoff — in-thread chat: STAGE B COMPLETE (2026-08-10, session 6)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Position at write time:** working tree on `28d177e3` (session 5's last commit). **UNCOMMITTED —
see §Commit status.** No env var set anywhere; every Stage B lever ships dark behind
`NEXT_PUBLIC_ENGINE_ONE_BRAIN` (default OFF).

## One paragraph

This session inherited a **half-built, untested, uncommitted Stage B** in the working tree (an
earlier session had built the server halves of B1/B2/B3 and stopped). It finished the client halves,
tested the whole surface, gated it, and measured it live. **Stage B is now complete**: card CTAs
enter the agent loop carrying the clicked line as data (B1), rewrite chips carry the pack of cards
they point at (B2), and the router's ~4.8s dead zone is labelled with a hedged pre-router guess
(B3). The live A/B is decisive — **"Rewrite these hooks tighter" went from 7% to 75% subject
retention**, i.e. the control reproduced the measured defect (five strangers) and the packed arm
rewrote all five real hooks, at no latency cost. Writing the tests found **two real defects in the
inherited pre-router** and one in the assembler's fence label; all three are fixed.

## What the working tree now contains

| Part | Server half (inherited) | Client half (this session) |
|---|---|---|
| **B1** card CTA → one brain | route `anchor` rider · loop `forceAnchor` on the round-1 pinned call | `handleWriteScript` routes through `chat.start(ask, platform, "script", {anchor})` when the flag is on; the pinned one-shot stays the dark path |
| **B2** the rewrite pack | `withCardsSlot` (per-request schema) · assembler `cards` fence · runners' `cards` · `sanitizeCards` · `carryCards` chips · `cardLinesOf` | `ThreadTurn` collects `cardLinesOf(body)` → `ThreadOutro` → `FollowupRow`; composer `sendChatFollowup` forwards the pack |
| **B3** the dead zone | `pre-router.ts` · `predispatch` SSE frame · `preGuess` on the stream hook | `preGuess` → `liveTurn.live` → `ChatTypingIndicator label` ("Looks like a hooks run…") |

**Gates:** tsc clean · **full suite 5,799 passed / 0 failed** (+70 tests this session, all new) ·
prod build clean.

## 🔴 Three defects the tests found in the inherited code

1. **The pre-router guessed a run on its own counter-example.** `pre-router.ts`'s header names
   *"how do my hooks compare"* as the thing that must NOT guess — and `do` was in the generation-verb
   list, so it guessed `hooks`. Dropped `do`, and added a `QUESTION_OPENER` guard (how/what/which/
   why/is/are/…) that catches the harder case a verb list cannot see: *"what should I write, hooks
   or a script?"* carries a real verb AND a real noun and is still a strategy question.
   `can/could/would` are deliberately excluded — "can you write me hooks" is a request.
2. **"Turn the best idea into a script" guessed `ideas`.** First-noun-by-position is the wrong rule
   after "into", which names a destination. This is not a corner case: the product's own chip copy
   is *"Turn the strongest idea into a full script."* Added the `into` rule.
3. **The assembler told the model to "REWRITE these exact script".** A script pack is the BEATS of
   the one script on screen, so the noun is now `script beats` — the old label both misread as a
   stack of whole scripts and disagreed with the numbered list under it.

## Live evidence (`.scratch/probe-stage-b.ts`, re-runnable, gitignored)

Two real hooks runs + one script run, temp-0, same profile, same ask — the real
"Punch them up" chip prompt over a 5-hook pack:

| arm | mean subject retention | cards | s |
|---|---|---|---|
| A · control (no pack — today's behaviour) | **7%** | 5 | 15 |
| B · packed (Stage B) | **75%** | 5 | 10 |

Arm A returned five strangers ("Strong focus systems for your deep work days") — the measured defect
reproducing exactly. Arm B returned sharper versions of all five inputs ("Your morning routine isn't
the problem. Your 4pm slump is."). The pack also drove the COUNT: 5 in → 5 out.

**Honest caveat:** one of B's five came back essentially verbatim (100% retention, punctuation only)
— the run kept the card instead of sharpening it. Not a wiring failure, a craft one; worth a look if
a "punch them up" that changes nothing is reported.

**B1 live:** a script run anchored on a clicked line opened from that line verbatim — the anchor
still binds with the rider path in place.

**Browser verify** (throwaway `zz-preview` page, no auth, no credits — deleted before writing this):
the hint row renders as "Looks like a hooks run…" beside the accent dot, the control row still says
"Thinking…", and "Punch them up" reaches the handler carrying exactly the two hook lines on screen
while "More hooks" carries nothing. Zero pageerrors. Screenshot: `.scratch/stage-b.png`.

## What is NOT verified

- **The composer → route glue has not been exercised signed-in.** `sendChatFollowup`'s pack
  forwarding and `handleWriteScript`'s one-brain branch are covered by types, unit tests and the
  component-level browser check, but no live signed-in run has gone through `/api/tools/chat` with
  the flag on. That needs the e2e prod account and spends real credits.
- **The route's own Stage B code** (predispatch emission, rider capping, sealed-visitor guard) has
  no route-level test — the lane has no chat-route test harness. Covered by reading + the loop
  tests underneath it.

## Open owner decisions (carried forward, updated)

1. **Prod flip** (deployment currently OFF — owner switching Vercel accounts; touch nothing).
   Recommended set unchanged from session 5, **plus `NEXT_PUBLIC_ENGINE_ONE_BRAIN`** — note it is
   `NEXT_PUBLIC_`, so flipping it needs a REDEPLOY to reach the client half.
   `GROUNDING_IDEAS_ADAPT` still held.
2. **F-6 multiplier positioning** — still bracketed.
3. **`composer.tsx` split** — still bracketed. Stage B touched only two callbacks in it, so the
   "split WITH Stage B" recommendation no longer has the seams-are-open-anyway argument behind it.
4. **Next stage:** C2/C4 were queued behind Stage B. Also still open from the session-5 coverage
   map: `develop`/`refine`/`chat` have no quality lever, and `remix` is unguarded by the judge.

## Commit status — NOTHING IS COMMITTED

Per the owner's standing rule (commits and pushes only when asked) and because this worktree's
post-commit hook **auto-pushes**, the session stopped at a green working tree. Everything above is
in the working tree only. `git status` at write time:

```
 M src/app/api/tools/chat/route.ts          M src/lib/tools/chat-followups.ts
 M src/components/thread/conversational-frame.tsx   M src/lib/tools/runners/hooks-runner.ts
 M src/components/thread/followup-row.tsx    M src/lib/tools/runners/ideas-runner.ts
 M src/components/thread/thread-turn.tsx     M src/lib/tools/runners/script-runner.ts
 M src/components/app/home/composer.tsx      M src/lib/tools/skill-dispatch.ts
 M src/hooks/queries/use-chat-stream.ts      M src/lib/kc/assembler.ts
 M src/lib/followup-context.ts               M src/lib/tools/chat-agent-loop.ts
 ?? src/lib/tools/one-brain-flag.ts          ?? src/lib/tools/pre-router.ts
 ?? src/lib/tools/__tests__/pre-router.test.ts
 (+ session-4/5 untracked doc residue: docs/AB-ADAPT-IDEAS-SCRIPT-2026-08-10.md,
    docs/AB-JUDGE-2026-08-10-script.md)
```

## Traps (session-6 additions)

- **A stale `.next/dev/types/validator.ts` fails `tsc` after you delete a page the dev server saw.**
  Two phantom errors about the removed route; `rm -rf .next/dev` clears them. Do not go looking for
  a real type error.
- **`FollowupRow` calls its handler with the OLD arity when there is no pack** — deliberately. The
  existing control tests assert `toHaveBeenCalledWith(prompt, skill)` exactly, and vitest counts
  arity, so passing a third `undefined` fails them. That failure is the guard working: a chip with
  nothing to carry must be indistinguishable from the pre-Stage-B chip.
- **`chat-turn.test.tsx`'s `SCRIPT_CARD` fixture is stale** — its beats carry `text`, but the real
  block schema (`blocks.ts`) says `content`, which is what `cardLinesOf` reads. New tests use a
  schema-accurate fixture; the old one is only ever rendered, never extracted from.
- The `.claude` memory store is outside this worktree's git root — the path guard blocks Write from
  here (07-15 precedent). THIS DOC is the durable record.

## Resume recipe

Session 3's recipe still holds. New harnesses:

```bash
# Stage B live A/B (2 hooks runs + 1 script run, flash credits, ~40s):
node node_modules/tsx/dist/cli.mjs .scratch/probe-stage-b.ts
# Client-half browser check: recreate src/app/zz-preview/page.tsx (pattern in this doc's history),
# then: NEXT_PUBLIC_ENGINE_ONE_BRAIN=true npm run dev -- --port 3011
#       node .scratch/verify-stage-b.mjs      # prints the hint rows + what each chip sent
```

Spend note: 3 pipeline runs this session, all DashScope flash via the probe — zero prod
e2e-account credits, no auth session used.
