# Next session — copy-paste brief (session 15 close-out, 2026-08-15)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Shipped:** **PR #514** — F-1 CLOSED · F-7 CLOSED · `ENGINE_GEN_CONVERSATION` default ON.
**Gates at close:** `tsc` 0 · `npm run build` 0 · **6476 tests pass.** Tree clean, branch pushed.

> ⚠️ **This supersedes `NEXT-SESSION-2026-08-16.md`** (session 14's brief). Two of its entries are
> now wrong: the `text-foreground-tertiary` loose end was FALSE, and `ENGINE_GEN_CONVERSATION` is ON.

---

## ▶️ PASTE THIS TO START

```
Read docs/HANDOFF-2026-08-15-f1-f7-closed.md.

Repo ~/virtuna-in-thread-chat, branch lane/in-thread-chat. Session 15 shipped PR #514:
F-1 and F-7 both CLOSED, ENGINE_GEN_CONVERSATION flipped default ON. tsc + build +
6476 tests green at close.

⚠️ CHECK WHETHER #514 IS MERGED FIRST: gh pr view 514 --json state,mergedAt
   git fetch && git rev-parse origin/main
Main moved FOUR times during session 15 alone (#511, #512, #513, and my own). Re-measure
before branching AND again before opening a PR.

CONTEXT: this is the in-thread chat lane — chat runs the tools. The last week has been
auditing what that surface produces. The F-audit backlog is now down to four never-measured
rows and one genuinely new defect.

🔴 BEFORE TREATING ANY INHERITED CLAIM AS OPEN WORK:
  git log --all --grep="<claim>"   AND THEN OPEN THE HITS.
Session 15 killed two inherited claims this way. Both had been "re-derived by hand" and
confirmed by a previous session, and both were wrong:
  - F-7 "no diversity constraint exists" — it existed in hooks-runner since 7d4bc133.
    The re-derivation read build-proof.ts, which STRUCTURALLY CANNOT hold the fix.
  - "text-foreground-tertiary is live in two files" — it is one JSDoc COMMENT, and the
    second file never contained it. A grep hit inside a comment looks like a real one.
A fix that lands for ONE caller leaves a claim that is half true, and re-deriving the
OTHER caller confirms it. Check every caller, and read what the grep actually matched.

OPEN, in the order I would take them — ASK before draining, this lane is at a clean stop:
  1. The monologue leak's LIVE half. One turn persisted 20,742 chars of the model's own
     planning voice as the answer. #514 stops it PERSISTING; it still STREAMS to the
     creator. NOT a subset of F-1 — needs its own diagnosis.
  2. F-3, F-8, F-11, F-12 — never measured, one live run each.
  3. The sidebar ⋯ menu — a design call, not a CSS one.

DO NOT:
  - Do not cap a search-and-answer turn's prose. 25 of 34 over-cap turns are those, and
    their long prose IS the answer. There is no card pack to duplicate. Pinned by a test.
  - Do not key a new card guard on skillRuns alone — emit_card routes to uiBlocks, and
    COMPOSED_CARDS is default ON. That is how composed cards had no text limit at all.
  - Do not remove the templateInstantiated guard or touch the ~4% proof rate. Both CORRECT.
  - Do not propose reconnecting the deploy. OFF deliberately, owner-confirmed.
  - Do not backfill funnel_events.origin. Do not delete the 9 card pickers (/settings, LIVE).

💰 Do not walk /welcome with a real handle — a ~128s Apify scrape on a $5/mo capped account.
   Use scripts/probe-wait-questions.mjs.

⚠️ The suite flakes NON-DETERMINISTICALLY. Three full runs of an identical tree in session
15 gave: the omni flake, three composer timeouts, and a clean 6476/0. ALWAYS re-run a
failure in isolation before blaming your diff, and check whether the file even imports
what you changed.

VERIFY IN A BROWSER on a PROD build. Recipe: handoff §6. Note ⚠️ `main` is NOT the
scroller on /home — a fullPage screenshot stops at the fold.
```

---

## 1. What #514 actually changed, in one paragraph each

**F-1.** Not "the model re-emits the pack" — the loop concatenates every round's text into one
persisted block, and the 600-char cap is computed per round from a `skillRuns` that is empty until a
skill has run. So a round that narrates *and* calls the skill streams uncapped, and because cards are
inserted as their own message first, that narration reappears below them as a second answer. Fixed by
dropping pre-card text at assembly (never buffering — that is the cost `prose-call.ts` refuses to pay)
and dropping over-budget post-card text whole rather than truncating.

**F-7.** The cap already existed and `ideas-runner` simply never called it. Now it does, and both
runners are pinned by `source-diversity.test.ts` — neither had any test before, so the cap could have
been deleted with every suite green.

**`ENGINE_GEN_CONVERSATION`.** Default ON via the code (`!== "false"`), because with the deploy off an
env var reaches nobody. ⚠️ It shipped **without** the live A/B its own comment promised. Suspect it
first if quality regresses; `=false` is a one-line kill switch.

## 2. 🔴 The memory work order — previous handoffs named the WRONG remedy

Three handoffs have said the lane memory "needs a session started in `~/virtuna-v1.1`". **That would
fail too.** `$HOME` is itself a git repository, the memory directory lives inside it, and the guard
compares that git root against the session's worktree root — which differs for *every* project
worktree, trunk included. **Only a session rooted at `~` can write it.** Full content to save:
handoff §5b.

## 3. Known-good — do not re-litigate

- The 25 search→prose turns are correct behaviour and are now pinned.
- `checkout_open` is **not** an unreachable event; its zero is real.
- The 9 card pickers are LIVE on `/settings`.
- `LIVE_SCRAPE_DEFAULT` (#511) is default OFF — `=== "true"`, deliberately inverse to the house
  switch so a spend is never armed by a half-set env.
- The ~4% proof rate is a correct guard stripping citations the model did not earn.
